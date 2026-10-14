/**
 * Kart og terreng i geofag: et høydefelt (tenkt landskap fra landformer og fast frø), koter (marching squares med
 * sammenhengende linjer), høyde og helning i et punkt, terrengprofil mellom A og B, vannets vei nedover og vannskillet
 * for et utløp (D8), og målestokk. Ren logikk uten React; `Kotekart` i `kotekart.tsx` tegner resultatet.
 *
 * Koordinater er i **meter i terrenget** med origo i nordvest: x mot øst og y mot **sør** (samme retning som SVG), så
 * kartet tegnes med `x · k` og `y · k`. Høyder er i m o.h. Ugyldige tall og punkter utenfor feltet gir `null` eller
 * tomme lister, aldri `NaN` eller `Infinity`.
 *
 *   const felt = hoydefelt(7, [
 *     { type: 'plan', z0: 300, helningX: 0, helningY: -0.05 },
 *     { type: 'topp', x: 1400, y: 500, hoyde: 450, radius: 700 },
 *     { type: 'dal', punkter: [[200, 200], [900, 800], [1000, 1500]], dybde: 120, bredde: 500 },
 *   ], { ujevnhet: 15 })!;
 *   koter(felt, 20)               // én Kote per 20 m, hver femte tykk
 *   helning(felt, 800, 600)       // { grader, prosent, retning … }
 *   vannskille(felt, [1000, 1480]) // nedbørfeltet til utløpet
 */
import { seededRandom } from '../../kjemi/kit/random';

/** Et punkt [x, y] i meter (x mot øst, y mot sør). */
export type Kartpunkt = readonly [number, number];

/** Et regelmessig høydefelt (rutenett av høyder). */
export interface Hoydefelt {
  /** Antall gitterpunkter mot øst (x). */
  nx: number;
  /** Antall gitterpunkter mot sør (y). */
  ny: number;
  /** Avstanden mellom gitterpunktene i meter. */
  celle: number;
  /** Feltets utstrekning mot øst i meter: (nx − 1) · celle. */
  bredde: number;
  /** Feltets utstrekning mot sør i meter: (ny − 1) · celle. */
  lengde: number;
  /** Høydene i m o.h., radvis: `z[j * nx + i]` er punktet (i · celle, j · celle). */
  z: readonly number[];
  /** Laveste høyde i feltet. */
  min: number;
  /** Høyeste høyde i feltet. */
  max: number;
}

/**
 * En landform som legges til høydefeltet (alle mål i meter):
 * - `plan`: et skråplan z0 + helningX · x + helningY · y (helning i m per m; negativ helningY = stiger mot nord);
 * - `topp`: en avrundet topp (cosinusklokke) med høyden `hoyde` i midten og foten i avstanden `radius`;
 * - `kjegle`: en kjegle med rette sider (koter som sirkler med lik avstand);
 * - `senkning`: en skål som trekkes fra (til et vann), dyp `dybde`;
 * - `dal`: en dal langs en linje gjennom `punkter`, dyp `dybde` og bred `bredde` (V-form for en elvedal, U-form for en
 *   isbredal);
 * - `rygg`: en rygg langs en linje, høy `hoyde` og bred `bredde`.
 */
export type Landform =
  | { type: 'plan'; z0: number; helningX: number; helningY: number }
  | { type: 'topp'; x: number; y: number; hoyde: number; radius: number }
  | { type: 'kjegle'; x: number; y: number; hoyde: number; radius: number }
  | { type: 'senkning'; x: number; y: number; dybde: number; radius: number }
  | { type: 'dal'; punkter: readonly Kartpunkt[]; dybde: number; bredde: number; form?: 'V' | 'U' }
  | { type: 'rygg'; punkter: readonly Kartpunkt[]; hoyde: number; bredde: number };

/** Valg til `hoydefelt`. */
export interface HoydefeltValg {
  /** Utstrekning mot øst i meter (standard 2000). */
  bredde?: number;
  /** Utstrekning mot sør i meter (standard 1500). */
  lengde?: number;
  /** Avstanden mellom gitterpunktene i meter (standard 25). Høyst 401 punkter hver vei. */
  celle?: number;
  /** Høyden som landformene legges på, i m o.h. (standard 0). */
  grunnhoyde?: number;
  /** Amplituden i meter for en jevn, tilfeldig ujevnhet med fast frø (standard 0). */
  ujevnhet?: number;
  /** Bølgelengden til ujevnheten i meter (standard 400). */
  bolgelengde?: number;
  /** Laveste tillatte høyde (standard ingen); f.eks. 0 for havnivå, så havet blir flatt. */
  gulv?: number;
}

function avstandTilLinje(px: number, py: number, punkter: readonly Kartpunkt[]): number {
  if (punkter.length === 0) return Infinity;
  if (punkter.length === 1) return Math.hypot(px - punkter[0]![0], py - punkter[0]![1]);
  let best = Infinity;
  for (let i = 0; i < punkter.length - 1; i++) {
    const [ax, ay] = punkter[i]!;
    const [bx, by] = punkter[i + 1]!;
    const dx = bx - ax;
    const dy = by - ay;
    const l2 = dx * dx + dy * dy;
    const t = l2 > 0 ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / l2)) : 0;
    best = Math.min(best, Math.hypot(px - (ax + t * dx), py - (ay + t * dy)));
  }
  return best;
}

/** Cosinusklokke: 1 i midten, 0 ved og utenfor radius. */
function klokke(r: number, radius: number): number {
  if (!(radius > 0) || r >= radius) return 0;
  return 0.5 * (1 + Math.cos((Math.PI * r) / radius));
}

function landformHoyde(f: Landform, x: number, y: number): number {
  switch (f.type) {
    case 'plan':
      return f.z0 + f.helningX * x + f.helningY * y;
    case 'topp':
      return f.hoyde * klokke(Math.hypot(x - f.x, y - f.y), f.radius);
    case 'kjegle':
      return f.radius > 0 ? f.hoyde * Math.max(0, 1 - Math.hypot(x - f.x, y - f.y) / f.radius) : 0;
    case 'senkning':
      return -f.dybde * klokke(Math.hypot(x - f.x, y - f.y), f.radius);
    case 'dal': {
      const halv = f.bredde / 2;
      if (!(halv > 0)) return 0;
      const d = avstandTilLinje(x, y, f.punkter);
      const u = d / halv;
      if (u >= 1) return 0;
      // V: rett ned mot elva. U: flat bunn og bratte sider (som etter en isbre).
      const profil = f.form === 'U' ? 1 - u ** 4 : 1 - u;
      return -f.dybde * profil;
    }
    case 'rygg': {
      const d = avstandTilLinje(x, y, f.punkter);
      return f.hoyde * klokke(d, f.bredde / 2);
    }
  }
}

function landformGyldig(f: Landform): boolean {
  const tall = (...v: number[]) => v.every(Number.isFinite);
  const linje = (p: readonly Kartpunkt[]) => p.length > 0 && p.every(([a, b]) => tall(a, b));
  switch (f.type) {
    case 'plan':
      return tall(f.z0, f.helningX, f.helningY);
    case 'topp':
    case 'kjegle':
      return tall(f.x, f.y, f.hoyde, f.radius);
    case 'senkning':
      return tall(f.x, f.y, f.dybde, f.radius);
    case 'dal':
      return tall(f.dybde, f.bredde) && linje(f.punkter);
    case 'rygg':
      return tall(f.hoyde, f.bredde) && linje(f.punkter);
  }
}

/** Jevn, tilfeldig støy (verdistøy med to oktaver) med fast frø, i området omtrent −1 til 1. */
function lagStoy(fro: number, bredde: number, lengde: number, bolge: number): (x: number, y: number) => number {
  const rand = seededRandom(fro);
  const oktaver = [bolge, bolge / 2].map((L, o) => {
    const mx = Math.ceil(bredde / L) + 2;
    const my = Math.ceil(lengde / L) + 2;
    const v: number[] = [];
    for (let k = 0; k < mx * my; k++) v.push(rand() * 2 - 1);
    return { L, mx, my, v, vekt: o === 0 ? 1 : 0.5 };
  });
  const s = (t: number) => t * t * (3 - 2 * t);
  return (x, y) => {
    let sum = 0;
    for (const o of oktaver) {
      const gx = x / o.L;
      const gy = y / o.L;
      const i = Math.min(o.mx - 2, Math.max(0, Math.floor(gx)));
      const j = Math.min(o.my - 2, Math.max(0, Math.floor(gy)));
      const tx = s(Math.min(1, Math.max(0, gx - i)));
      const ty = s(Math.min(1, Math.max(0, gy - j)));
      const a = o.v[j * o.mx + i]!;
      const b = o.v[j * o.mx + i + 1]!;
      const c = o.v[(j + 1) * o.mx + i]!;
      const d = o.v[(j + 1) * o.mx + i + 1]!;
      sum += o.vekt * (a + (b - a) * tx + (c - a) * ty + (a - b - c + d) * tx * ty);
    }
    return sum / 1.5;
  };
}

/**
 * Lager et høydefelt for et tenkt landskap: summen av landformene (plan, topper, kjegler, senkninger, daler og rygger)
 * pluss en jevn ujevnhet med fast frø, så samme frø alltid gir samme kart. Ugyldige landformer hoppes over; ugyldig
 * størrelse eller celle gir null.
 *
 * @param fro Frø til ujevnheten (heltall).
 * @param former Landformene, se `Landform`.
 * @param valg Størrelse, celle, grunnhøyde, ujevnhet og gulv.
 */
export function hoydefelt(fro: number, former: readonly Landform[], valg: HoydefeltValg = {}): Hoydefelt | null {
  const bredde = valg.bredde ?? 2000;
  const lengde = valg.lengde ?? 1500;
  const celle = valg.celle ?? 25;
  const grunn = valg.grunnhoyde ?? 0;
  const ujevnhet = valg.ujevnhet ?? 0;
  const bolge = valg.bolgelengde ?? 400;
  if (![bredde, lengde, celle, grunn, ujevnhet, bolge].every(Number.isFinite)) return null;
  if (bredde <= 0 || lengde <= 0 || celle <= 0 || bolge <= 0) return null;
  const nx = Math.round(bredde / celle) + 1;
  const ny = Math.round(lengde / celle) + 1;
  if (nx < 2 || ny < 2 || nx > 401 || ny > 401) return null;
  const gyldige = former.filter(landformGyldig);
  const stoy = ujevnhet !== 0 ? lagStoy(Number.isFinite(fro) ? Math.round(fro) : 0, bredde, lengde, bolge) : null;
  const gulv = valg.gulv;
  const z: number[] = new Array(nx * ny);
  let min = Infinity;
  let max = -Infinity;
  for (let j = 0; j < ny; j++) {
    for (let i = 0; i < nx; i++) {
      const x = i * celle;
      const y = j * celle;
      let h = grunn;
      for (const f of gyldige) h += landformHoyde(f, x, y);
      if (stoy) h += ujevnhet * stoy(x, y);
      if (gulv !== undefined && Number.isFinite(gulv)) h = Math.max(gulv, h);
      if (!Number.isFinite(h)) h = grunn;
      z[j * nx + i] = h;
      if (h < min) min = h;
      if (h > max) max = h;
    }
  }
  return { nx, ny, celle, bredde: (nx - 1) * celle, lengde: (ny - 1) * celle, z, min, max };
}

/**
 * Høyden (m o.h.) i et punkt, interpolert bilineært mellom gitterpunktene. Punkter utenfor feltet gir null.
 *
 * @param felt Høydefeltet.
 * @param x Meter mot øst.
 * @param y Meter mot sør.
 */
export function hoydeVed(felt: Hoydefelt, x: number, y: number): number | null {
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  const eps = 1e-9 * Math.max(1, felt.bredde, felt.lengde);
  if (x < -eps || y < -eps || x > felt.bredde + eps || y > felt.lengde + eps) return null;
  const gx = Math.min(felt.nx - 1, Math.max(0, x / felt.celle));
  const gy = Math.min(felt.ny - 1, Math.max(0, y / felt.celle));
  const i = Math.min(felt.nx - 2, Math.floor(gx));
  const j = Math.min(felt.ny - 2, Math.floor(gy));
  const tx = gx - i;
  const ty = gy - j;
  const n = felt.nx;
  const a = felt.z[j * n + i]!;
  const b = felt.z[j * n + i + 1]!;
  const c = felt.z[(j + 1) * n + i]!;
  const d = felt.z[(j + 1) * n + i + 1]!;
  return a * (1 - tx) * (1 - ty) + b * tx * (1 - ty) + c * (1 - tx) * ty + d * tx * ty;
}

// ---------------------------------------------------------------------------------------------------------------------
// Koter

/** Én sammenhengende kotelinje. */
export interface Kotelinje {
  /** Punktene i meter. */
  punkter: [number, number][];
  /** true når linja går rundt og slutter der den startet (en topp eller en senkning); ellers går den ut av kartet. */
  lukket: boolean;
}

/** Alle linjene for én kotehøyde. */
export interface Kote {
  /** Høyden i m o.h. */
  hoyde: number;
  /** true for hovedkotene (hver femte, f.eks. 100, 200 … med ekvidistanse 20 m), som tegnes tykkere og får tall. */
  tykk: boolean;
  linjer: Kotelinje[];
}

/** Valg til `koter`. */
export interface KoteValg {
  /** Hver hvor mange koter som er hovedkote (standard 5). */
  hovedkoteHver?: number;
}

/** Høyst så mange kotehøyder (ellers er ekvidistansen for liten til å tegnes). */
const MAKS_KOTER = 1000;

/**
 * Marching squares på et rutenett med verdier `v` (radvis, nx · ny) for nivået `niva`. Gir sammenhengende linjer i
 * gitterkoordinater skalert med `celle`. Saddelruter avgjøres med middelverdien i ruta.
 */
function konturer(v: readonly number[], nx: number, ny: number, celle: number, niva: number): Kotelinje[] {
  const H = (nx - 1) * ny; // vannrette kanter: id = j * (nx − 1) + i
  const kantId = (vannrett: boolean, i: number, j: number) => (vannrett ? j * (nx - 1) + i : H + j * nx + i);
  const punktPaa = (vannrett: boolean, i: number, j: number): [number, number] => {
    const a = v[j * nx + i]!;
    const b = vannrett ? v[j * nx + i + 1]! : v[(j + 1) * nx + i]!;
    const t = b === a ? 0.5 : Math.min(1, Math.max(0, (niva - a) / (b - a)));
    return vannrett ? [(i + t) * celle, j * celle] : [i * celle, (j + t) * celle];
  };
  const seg: [number, number][] = [];
  const pos = new Map<number, [number, number]>();
  const leggTil = (k1: [boolean, number, number], k2: [boolean, number, number]) => {
    const a = kantId(...k1);
    const b = kantId(...k2);
    if (!pos.has(a)) pos.set(a, punktPaa(...k1));
    if (!pos.has(b)) pos.set(b, punktPaa(...k2));
    seg.push([a, b]);
  };
  for (let j = 0; j < ny - 1; j++) {
    for (let i = 0; i < nx - 1; i++) {
      const z0 = v[j * nx + i]!; // nordvest
      const z1 = v[j * nx + i + 1]!; // nordøst
      const z2 = v[(j + 1) * nx + i + 1]!; // sørøst
      const z3 = v[(j + 1) * nx + i]!; // sørvest
      const c = (z0 >= niva ? 1 : 0) | (z1 >= niva ? 2 : 0) | (z2 >= niva ? 4 : 0) | (z3 >= niva ? 8 : 0);
      if (c === 0 || c === 15) continue;
      const N: [boolean, number, number] = [true, i, j];
      const S: [boolean, number, number] = [true, i, j + 1];
      const V: [boolean, number, number] = [false, i, j];
      const O: [boolean, number, number] = [false, i + 1, j];
      switch (c) {
        case 1:
        case 14:
          leggTil(V, N);
          break;
        case 2:
        case 13:
          leggTil(N, O);
          break;
        case 3:
        case 12:
          leggTil(V, O);
          break;
        case 4:
        case 11:
          leggTil(O, S);
          break;
        case 6:
        case 9:
          leggTil(N, S);
          break;
        case 7:
        case 8:
          leggTil(V, S);
          break;
        case 5:
        case 10: {
          // Sadel: avgjør med middelverdien om de høye hjørnene henger sammen gjennom midten.
          const midtHoy = (z0 + z1 + z2 + z3) / 4 >= niva;
          const nvHoy = c === 5; // 5: nordvest og sørøst høye
          if (midtHoy === nvHoy) {
            leggTil(V, S);
            leggTil(N, O);
          } else {
            leggTil(V, N);
            leggTil(O, S);
          }
          break;
        }
      }
    }
  }
  // Kjed segmentene sammen via kantene de deler.
  const naboer = new Map<number, number[]>();
  seg.forEach(([a, b], k) => {
    for (const e of [a, b]) {
      const l = naboer.get(e);
      if (l) l.push(k);
      else naboer.set(e, [k]);
    }
  });
  const brukt = new Array<boolean>(seg.length).fill(false);
  const linjer: Kotelinje[] = [];
  const folg = (start: number, fraKant: number): Kotelinje => {
    const kanter = [fraKant];
    let k = start;
    let kant = fraKant;
    let lukket = false;
    for (;;) {
      brukt[k] = true;
      const [a, b] = seg[k]!;
      const neste = a === kant ? b : a;
      if (neste === fraKant) {
        lukket = true;
        kanter.push(neste);
        break;
      }
      kanter.push(neste);
      const videre = (naboer.get(neste) ?? []).find((s) => !brukt[s]);
      if (videre === undefined) break;
      k = videre;
      kant = neste;
    }
    return { punkter: kanter.map((e) => [...pos.get(e)!] as [number, number]), lukket };
  };
  // Først linjer som starter i kartkanten (kanter med bare ett segment), så de lukkede.
  for (const [kant, l] of naboer) {
    if (l.length !== 1 || brukt[l[0]!]) continue;
    linjer.push(folg(l[0]!, kant));
  }
  for (let k = 0; k < seg.length; k++) if (!brukt[k]) linjer.push(folg(k, seg[k]![0]));
  // Dropp linjer som har krympet til ett punkt (et nivå som bare berører et gitterpunkt, f.eks. akkurat på en topp).
  const min = 1e-6 * celle;
  return linjer.filter((l) => {
    if (l.punkter.length < 2) return false;
    const [x0, y0] = l.punkter[0]!;
    return l.punkter.some(([x, y]) => Math.abs(x - x0) > min || Math.abs(y - y0) > min);
  });
}

/**
 * Kotene i et høydefelt med ekvidistansen `ekvidistanse` (m): én `Kote` per høyde som er et helt multiplum av
 * ekvidistansen, med sammenhengende linjer (marching squares). Hver femte kote (100, 200 … med 20 m ekvidistanse) er
 * hovedkote (`tykk`). Tette koter betyr bratt terreng, og koter som danner en V oppover en dal, viser en elv.
 * Ekvidistanse ≤ 0 eller så liten at det blir over 1000 koter, gir en tom liste.
 *
 * @param felt Høydefeltet.
 * @param ekvidistanse Høydeforskjellen mellom kotene i meter.
 * @param valg `hovedkoteHver` (standard 5).
 */
export function koter(felt: Hoydefelt, ekvidistanse: number, valg: KoteValg = {}): Kote[] {
  if (!Number.isFinite(ekvidistanse) || ekvidistanse <= 0) return [];
  const hver = Math.max(1, Math.round(valg.hovedkoteHver ?? 5));
  const n0 = Math.ceil(felt.min / ekvidistanse - 1e-9);
  const n1 = Math.floor(felt.max / ekvidistanse + 1e-9);
  if (!Number.isFinite(n0) || !Number.isFinite(n1) || n1 - n0 + 1 > MAKS_KOTER) return [];
  const ut: Kote[] = [];
  for (let n = n0; n <= n1; n++) {
    const hoyde = Number((n * ekvidistanse).toPrecision(12));
    const linjer = konturer(felt.z, felt.nx, felt.ny, felt.celle, hoyde);
    if (linjer.length > 0) ut.push({ hoyde, tykk: ((n % hver) + hver) % hver === 0, linjer });
  }
  return ut;
}

// ---------------------------------------------------------------------------------------------------------------------
// Profil og helning

/** Ett punkt på et terrengprofil. */
export interface ProfilPunkt {
  /** Avstand fra A langs profilet i meter. */
  s: number;
  x: number;
  y: number;
  /** Høyden i m o.h. */
  z: number;
}

/**
 * Terrengprofilet langs en rett linje fra A til B med `n` jevnt fordelte punkter (A og B tatt med). Punkter utenfor
 * feltet flyttes inn til kanten. n < 2 eller ugyldige tall gir en tom liste.
 *
 * @param felt Høydefeltet.
 * @param A Startpunktet [x, y].
 * @param B Sluttpunktet [x, y].
 * @param n Antall punkter (standard 100).
 */
export function terrengprofil(felt: Hoydefelt, A: Kartpunkt, B: Kartpunkt, n = 100): ProfilPunkt[] {
  if (![A[0], A[1], B[0], B[1], n].every(Number.isFinite) || n < 2) return [];
  const antall = Math.min(5000, Math.round(n));
  const inn = (x: number, y: number): [number, number] => [
    Math.min(felt.bredde, Math.max(0, x)),
    Math.min(felt.lengde, Math.max(0, y)),
  ];
  const [ax, ay] = inn(A[0], A[1]);
  const [bx, by] = inn(B[0], B[1]);
  const lengde = Math.hypot(bx - ax, by - ay);
  const ut: ProfilPunkt[] = [];
  for (let k = 0; k < antall; k++) {
    const t = k / (antall - 1);
    const x = ax + t * (bx - ax);
    const y = ay + t * (by - ay);
    ut.push({ s: t * lengde, x, y, z: hoydeVed(felt, x, y) ?? felt.min });
  }
  return ut;
}

/** Helningen i et punkt: resultatet av `helning`. */
export interface Helning {
  /** Helningsvinkelen i grader (0 = flatt). */
  grader: number;
  /** Helningen i prosent (100 % = 45°). */
  prosent: number;
  /**
   * Retningen terrenget heller mot (dit vannet renner), som kompassretning i grader: 0 = nord, 90 = øst, 180 = sør,
   * 270 = vest. null når terrenget er flatt.
   */
  retning: number | null;
  /** Stigningen mot øst (m per m). */
  dzdx: number;
  /** Stigningen mot sør (m per m). */
  dzdy: number;
}

/**
 * Helningen i et punkt fra høydefeltet (sentrale differanser over én rute): grader, prosent og retning. Et skråplan gir
 * nøyaktig planets helning. Punkter utenfor feltet gir null.
 *
 * @param felt Høydefeltet.
 * @param x Meter mot øst.
 * @param y Meter mot sør.
 */
export function helning(felt: Hoydefelt, x: number, y: number): Helning | null {
  if (hoydeVed(felt, x, y) === null) return null;
  const h = felt.celle / 2;
  const x0 = Math.max(0, x - h);
  const x1 = Math.min(felt.bredde, x + h);
  const y0 = Math.max(0, y - h);
  const y1 = Math.min(felt.lengde, y + h);
  const zx0 = hoydeVed(felt, x0, y);
  const zx1 = hoydeVed(felt, x1, y);
  const zy0 = hoydeVed(felt, x, y0);
  const zy1 = hoydeVed(felt, x, y1);
  if (zx0 === null || zx1 === null || zy0 === null || zy1 === null || x1 <= x0 || y1 <= y0) return null;
  const dzdx = (zx1 - zx0) / (x1 - x0);
  const dzdy = (zy1 - zy0) / (y1 - y0);
  const g = Math.hypot(dzdx, dzdy);
  let retning: number | null = null;
  if (g > 1e-12) {
    // Nedover: (−dzdx mot øst, −dzdy mot sør) = (−dzdx øst, +dzdy nord).
    const r = (Math.atan2(-dzdx, dzdy) * 180) / Math.PI;
    retning = (r + 360) % 360;
  }
  return { grader: (Math.atan(g) * 180) / Math.PI, prosent: g * 100, retning, dzdx, dzdy };
}

// ---------------------------------------------------------------------------------------------------------------------
// Drenering: vannets vei og vannskille (D8)

interface Drenering {
  /** Mottakeren for hvert gitterpunkt (indeks), eller −1 når vannet renner ut av kartet. */
  mottaker: Int32Array;
  /** Antall gitterpunkter som drenerer gjennom hvert punkt (seg selv medregnet). */
  tilsig: Int32Array;
}

const dreneringCache = new WeakMap<Hoydefelt, Drenering>();

/** Enkel binærhaug (minste først) for Priority-Flood. */
class Haug {
  private h: number[] = [];
  private p: number[] = [];
  get storrelse() {
    return this.h.length;
  }
  legg(prio: number, verdi: number) {
    const h = this.h;
    const p = this.p;
    h.push(verdi);
    p.push(prio);
    let i = h.length - 1;
    while (i > 0) {
      const f = (i - 1) >> 1;
      if (p[f]! <= p[i]!) break;
      [h[f], h[i]] = [h[i]!, h[f]!];
      [p[f], p[i]] = [p[i]!, p[f]!];
      i = f;
    }
  }
  ta(): [number, number] {
    const h = this.h;
    const p = this.p;
    const topp: [number, number] = [p[0]!, h[0]!];
    const sh = h.pop()!;
    const sp = p.pop()!;
    if (h.length > 0) {
      h[0] = sh;
      p[0] = sp;
      let i = 0;
      for (;;) {
        const l = 2 * i + 1;
        const r = l + 1;
        let m = i;
        if (l < h.length && p[l]! < p[m]!) m = l;
        if (r < h.length && p[r]! < p[m]!) m = r;
        if (m === i) break;
        [h[m], h[i]] = [h[i]!, h[m]!];
        [p[m], p[i]] = [p[i]!, p[m]!];
        i = m;
      }
    }
    return topp;
  }
}

const NABO_DI = [-1, 0, 1, -1, 1, -1, 0, 1];
const NABO_DJ = [-1, -1, -1, 0, 0, 1, 1, 1];

/*
 * Kilde: D8 etter O'Callaghan og Mark 1984 (vannet renner til den av de åtte naboene som gir brattest fall), med
 * groper fylt først etter Priority-Flood + ε (Barnes mfl. 2014), så alt vann finner veien ut av kartet.
 */
function drenering(felt: Hoydefelt): Drenering {
  const lagret = dreneringCache.get(felt);
  if (lagret) return lagret;
  const { nx, ny, celle } = felt;
  const N = nx * ny;
  const fylt = new Float64Array(N);
  const besokt = new Uint8Array(N);
  const haug = new Haug();
  const eps = Math.max(1e-6, (felt.max - felt.min) * 1e-7);
  for (let j = 0; j < ny; j++) {
    for (let i = 0; i < nx; i++) {
      if (i === 0 || j === 0 || i === nx - 1 || j === ny - 1) {
        const k = j * nx + i;
        fylt[k] = felt.z[k]!;
        besokt[k] = 1;
        haug.legg(fylt[k]!, k);
      }
    }
  }
  while (haug.storrelse > 0) {
    const [h, k] = haug.ta();
    const i = k % nx;
    const j = (k - i) / nx;
    for (let n = 0; n < 8; n++) {
      const ii = i + NABO_DI[n]!;
      const jj = j + NABO_DJ[n]!;
      if (ii < 0 || jj < 0 || ii >= nx || jj >= ny) continue;
      const kk = jj * nx + ii;
      if (besokt[kk]) continue;
      besokt[kk] = 1;
      fylt[kk] = Math.max(felt.z[kk]!, h + eps);
      haug.legg(fylt[kk]!, kk);
    }
  }
  const mottaker = new Int32Array(N).fill(-1);
  for (let j = 0; j < ny; j++) {
    for (let i = 0; i < nx; i++) {
      const k = j * nx + i;
      let best = 0;
      let bestK = -1;
      for (let n = 0; n < 8; n++) {
        const ii = i + NABO_DI[n]!;
        const jj = j + NABO_DJ[n]!;
        if (ii < 0 || jj < 0 || ii >= nx || jj >= ny) continue;
        const kk = jj * nx + ii;
        const fall = (fylt[k]! - fylt[kk]!) / (celle * Math.hypot(NABO_DI[n]!, NABO_DJ[n]!));
        if (fall > best) {
          best = fall;
          bestK = kk;
        }
      }
      mottaker[k] = bestK;
    }
  }
  // Tilsig: gå fra høyeste til laveste (fylte) punkt og send videre til mottakeren.
  const rekkefolge = Array.from({ length: N }, (_, k) => k).sort((a, b) => fylt[b]! - fylt[a]!);
  const tilsig = new Int32Array(N).fill(1);
  for (const k of rekkefolge) {
    const m = mottaker[k]!;
    if (m >= 0) tilsig[m] = tilsig[m]! + tilsig[k]!;
  }
  const d = { mottaker, tilsig };
  dreneringCache.set(felt, d);
  return d;
}

function naermesteIndeks(felt: Hoydefelt, x: number, y: number): number | null {
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  if (x < 0 || y < 0 || x > felt.bredde || y > felt.lengde) return null;
  const i = Math.min(felt.nx - 1, Math.max(0, Math.round(x / felt.celle)));
  const j = Math.min(felt.ny - 1, Math.max(0, Math.round(y / felt.celle)));
  return j * felt.nx + i;
}

/**
 * Veien vannet tar nedover fra et punkt (D8: alltid til den bratteste av de åtte nabopunktene, med groper fylt), til det
 * renner ut av kartet. Punktene er gitterpunkter i meter, med startpunktet først. Brukes til å tegne en elv eller en
 * dråpes vei. Punkt utenfor feltet gir en tom liste.
 *
 * @param felt Høydefeltet.
 * @param fra Startpunktet [x, y].
 */
export function flytvei(felt: Hoydefelt, fra: Kartpunkt): [number, number][] {
  const start = naermesteIndeks(felt, fra[0], fra[1]);
  if (start === null) return [];
  const { mottaker } = drenering(felt);
  const ut: [number, number][] = [];
  let k = start;
  for (let steg = 0; steg <= felt.nx * felt.ny && k >= 0; steg++) {
    const i = k % felt.nx;
    ut.push([i * felt.celle, ((k - i) / felt.nx) * felt.celle]);
    k = mottaker[k]!;
  }
  return ut;
}

/** Nedbørfeltet til et utløp: resultatet av `vannskille`. */
export interface Nedborfelt {
  /** Utløpet (gitterpunktet i elva nærmest punktet du ga), i meter. */
  utlop: [number, number];
  /** For hvert gitterpunkt (radvis, som `felt.z`): true når vannet derfra renner til utløpet. */
  maske: boolean[];
  /** Antall gitterpunkter i feltet. */
  antall: number;
  /** Arealet i m² (antall · celle²; del på 10⁶ for km²). */
  areal: number;
  /**
   * Vannskillet: grensen mellom nedbørfeltet og nabofeltene, som linjer i meter. Der feltet når kartkanten, er linjene
   * åpne (kartkanten er ikke et vannskille).
   */
  grense: Kotelinje[];
  /** Omrisset av nedbørfeltet som lukkede linjer (langs kartkanten der feltet når den), til å fylle feltet med farge. */
  omriss: Kotelinje[];
}

/**
 * Nedbørfeltet og vannskillet for et utløp: alle punktene der vannet (D8, groper fylt) renner forbi utløpet. Utløpet
 * flyttes til punktet med størst tilsig innen to ruter, så et punkt ved siden av elva treffer elva. Punkt utenfor feltet
 * gir null.
 *
 * @param felt Høydefeltet.
 * @param utlop Utløpet [x, y], f.eks. der elva renner ut av kartet eller ut i et vann.
 */
export function vannskille(felt: Hoydefelt, utlop: Kartpunkt): Nedborfelt | null {
  const naer = naermesteIndeks(felt, utlop[0], utlop[1]);
  if (naer === null) return null;
  const { mottaker, tilsig } = drenering(felt);
  const { nx, ny, celle } = felt;
  const i0 = naer % nx;
  const j0 = (naer - i0) / nx;
  let ut = naer;
  for (let dj = -2; dj <= 2; dj++) {
    for (let di = -2; di <= 2; di++) {
      const i = i0 + di;
      const j = j0 + dj;
      if (i < 0 || j < 0 || i >= nx || j >= ny || di * di + dj * dj > 4) continue;
      const k = j * nx + i;
      if (tilsig[k]! > tilsig[ut]!) ut = k;
    }
  }
  // Giverne til hvert punkt (motsatt vei av mottaker), og bredde-først fra utløpet.
  const N = nx * ny;
  const forste = new Int32Array(N).fill(-1);
  const neste = new Int32Array(N).fill(-1);
  for (let k = 0; k < N; k++) {
    const m = mottaker[k]!;
    if (m >= 0) {
      neste[k] = forste[m]!;
      forste[m] = k;
    }
  }
  const maske = new Array<boolean>(N).fill(false);
  const ko = [ut];
  maske[ut] = true;
  let antall = 0;
  while (ko.length > 0) {
    const k = ko.pop()!;
    antall++;
    for (let g = forste[k]!; g >= 0; g = neste[g]!) {
      if (!maske[g]) {
        maske[g] = true;
        ko.push(g);
      }
    }
  }
  const verdier = maske.map((b) => (b ? 1 : 0));
  // Omrisset: samme maske med en ramme av nuller rundt, så linjene lukker seg langs kartkanten.
  const px = nx + 2;
  const py = ny + 2;
  const polstret = new Array<number>(px * py).fill(0);
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) polstret[(j + 1) * px + i + 1] = verdier[j * nx + i]!;
  const omriss = konturer(polstret, px, py, celle, 0.5).map((l) => ({
    lukket: l.lukket,
    punkter: l.punkter.map(([x, y]) => [Math.min(felt.bredde, Math.max(0, x - celle)), Math.min(felt.lengde, Math.max(0, y - celle))] as [number, number]),
  }));
  const ui = ut % nx;
  return {
    utlop: [ui * celle, ((ut - ui) / nx) * celle],
    maske,
    antall,
    areal: antall * celle * celle,
    grense: konturer(verdier, nx, ny, celle, 0.5),
    omriss,
  };
}

// ---------------------------------------------------------------------------------------------------------------------
// Målestokk

/**
 * Avstanden på kartet i cm for en avstand i terrenget: med målestokk 1 : 50 000 blir 1 km til 2 cm. Målestokktall ≤ 0
 * eller ugyldige tall gir null.
 *
 * @param meter Avstanden i terrenget i meter.
 * @param maalestokk Målestokktallet (50 000 for 1 : 50 000).
 */
export function kartavstand(meter: number, maalestokk: number): number | null {
  if (!Number.isFinite(meter) || !Number.isFinite(maalestokk) || maalestokk <= 0) return null;
  return (meter * 100) / maalestokk;
}

/**
 * Avstanden i terrenget i meter for en avstand på kartet i cm: med målestokk 1 : 50 000 er 1 cm 500 m. Målestokktall ≤ 0
 * eller ugyldige tall gir null.
 *
 * @param cm Avstanden på kartet i cm.
 * @param maalestokk Målestokktallet.
 */
export function terrengavstand(cm: number, maalestokk: number): number | null {
  if (!Number.isFinite(cm) || !Number.isFinite(maalestokk) || maalestokk <= 0) return null;
  return (cm * maalestokk) / 100;
}

/**
 * Målestokken skrevet på norsk: `maalestokkTekst(50000)` → «1 : 50 000» (hardt mellomrom som tusenskille). Ugyldig tall
 * gir «–».
 *
 * @param maalestokk Målestokktallet.
 */
export function maalestokkTekst(maalestokk: number): string {
  if (!Number.isFinite(maalestokk) || maalestokk <= 0) return '–';
  const tall = Math.round(maalestokk);
  const tekst = tall >= 10_000 ? tall.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ') : String(tall);
  return `1 : ${tekst}`;
}

/** En målestokklinje: resultatet av `skalastokk`. */
export interface Skalastokk {
  /** Lengden i terrenget i meter (1, 2 eller 5 ganger en tierpotens). */
  meter: number;
  /** Lengden i kartets enheter (f.eks. SVG-piksler). */
  enheter: number;
  /** Etiketten: «500 m», «1 km», «2 km». */
  tekst: string;
}

/**
 * Den lengste «runde» målestokklinja (1, 2 eller 5 ganger en tierpotens i meter) som får plass på `maksEnheter`, når én
 * kartenhet (f.eks. én SVG-piksel) er `meterPerEnhet` meter. Ugyldige tall gir null.
 *
 * @param meterPerEnhet Meter i terrenget per kartenhet.
 * @param maksEnheter Høyst så lang linje i kartenheter.
 */
export function skalastokk(meterPerEnhet: number, maksEnheter: number): Skalastokk | null {
  if (!Number.isFinite(meterPerEnhet) || !Number.isFinite(maksEnheter) || meterPerEnhet <= 0 || maksEnheter <= 0) return null;
  const maksMeter = meterPerEnhet * maksEnheter;
  let k = Math.floor(Math.log10(maksMeter));
  let meter = 0;
  for (; k > -10 && meter === 0; k--) {
    for (const m of [5, 2, 1]) {
      const kandidat = Number((m * 10 ** k).toPrecision(12));
      if (kandidat <= maksMeter * (1 + 1e-9)) {
        meter = kandidat;
        break;
      }
    }
  }
  if (meter === 0) return null;
  const tekst = meter >= 1000 ? `${String(meter / 1000).replace('.', ',')} km` : `${String(meter).replace('.', ',')} m`;
  return { meter, enheter: meter / meterPerEnhet, tekst };
}
