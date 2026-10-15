/**
 * Modellen bak «Kotekart og terrengprofil» (k9-kotekart): et tenkt norsk landskap (dal med elv og vann, en topp og to
 * åser), profillinja A–B styrt av retning og forskyvning, punktet P på linja, kotekrysningene langs linja (slik et
 * profil konstrueres for hånd), avstanden mellom kotene ved P og hvor mye overhøyden overdriver skråningene.
 *
 * Bygger på kart.ts i geofag-kit-et (høydefelt, koter, terrengprofil, helning, flytvei, vannskille og målestokk).
 * Koordinatene er meter i terrenget med origo i nordvest, x mot øst og y mot sør (som i kart.ts og SVG). Ugyldige tall
 * gir null eller tomme lister, aldri NaN eller Infinity.
 */
import { flytvei, helning, hoydefelt, hoydeVed, kartavstand, terrengprofil, vannskille, type Hoydefelt, type Kartpunkt, type Landform, type ProfilPunkt } from '../kit/kart';
import { fmt } from '../../kit/format';

type P = [number, number];

/* ================================================================================================ Landskapet */

/** Kartets utstrekning i meter (4 × 2,8 km) og avstanden mellom gitterpunktene. */
export const KART = { bredde: 4000, lengde: 2800, celle: 20 } as const;

/** Frøet til den jevne ujevnheten i terrenget (samme frø gir alltid samme kart). */
export const LANDSKAP_FRO = 5;

/**
 * Landformene i det tenkte landskapet: et platå som heller mot sør, en V-formet elvedal fra nord til sør med en
 * senkning der vannet ligger, en topp i vest på en rygg som går nord–sør, en bekkedal ned fra toppen mot vannet, en
 * mindre bekkedal fra øst, og to åser i øst (den nordlige på en rygg mot kartkanten).
 */
export const LANDFORMER: readonly Landform[] = [
  { type: 'plan', z0: 330, helningX: 0, helningY: -0.045 },
  {
    type: 'dal',
    punkter: [
      [2700, -100],
      [2450, 700],
      [2250, 1300],
      [2000, 1900],
      [1650, 2900],
    ],
    dybde: 100,
    bredde: 1300,
    form: 'V',
  },
  { type: 'topp', x: 900, y: 850, hoyde: 230, radius: 1000 },
  {
    type: 'rygg',
    punkter: [
      [450, 250],
      [900, 850],
      [1050, 1900],
    ],
    hoyde: 70,
    bredde: 900,
  },
  { type: 'topp', x: 3250, y: 2000, hoyde: 150, radius: 800 },
  { type: 'topp', x: 3350, y: 700, hoyde: 110, radius: 750 },
  {
    type: 'rygg',
    punkter: [
      [3350, 700],
      [3650, -100],
    ],
    hoyde: 50,
    bredde: 700,
  },
  { type: 'senkning', x: 2230, y: 1300, dybde: 32, radius: 460 },
  {
    type: 'dal',
    punkter: [
      [1200, 650],
      [1700, 1050],
      [2100, 1250],
    ],
    dybde: 50,
    bredde: 380,
    form: 'V',
  },
  {
    type: 'dal',
    punkter: [
      [3550, 1350],
      [3050, 1450],
      [2550, 1650],
    ],
    dybde: 35,
    bredde: 340,
    form: 'V',
  },
];

/** Stedene på kartet (meter). Navnene er tenkte. */
export const STEDER = {
  topp: { p: [900, 850] as Kartpunkt, navn: 'Storhøgda' },
  aasNord: { p: [3350, 700] as Kartpunkt, navn: 'Kollen' },
  aasSor: { p: [3250, 2000] as Kartpunkt, navn: 'Råsen' },
  /** Vannet fyller senkningen opp til terskelen der Dalelva renner ut (ca. 161 m o.h.). */
  vann: { punkt: [2140, 1280] as Kartpunkt, niva: 160, navn: 'Langvatnet' },
  elv: { fra: [2690, 20] as Kartpunkt, navn: 'Dalelva' },
  bekk: { fra: [1250, 680] as Kartpunkt, navn: 'Fossbekken' },
  /** Bekken fra skaret mellom Kollen og Råsen (uten navn på kartet). */
  sidebekk: { fra: [3480, 1370] as Kartpunkt },
  /** Der Dalelva renner ut av kartet i sør: utløpet nedbørfeltet regnes til. */
  utlop: { p: [1690, 2780] as Kartpunkt, navn: 'Nedbørfeltet til Dalelva' },
  hus: [
    [2470, 1560],
    [2530, 1610],
    [2440, 1650],
    [2590, 1700],
  ] as readonly Kartpunkt[],
} as const;

let lagret: Hoydefelt | null = null;

/** Høydefeltet for det tenkte landskapet (regnes ut én gang og gjenbrukes). */
export function landskap(): Hoydefelt {
  if (!lagret) {
    lagret = hoydefelt(LANDSKAP_FRO, LANDFORMER, { bredde: KART.bredde, lengde: KART.lengde, celle: KART.celle, ujevnhet: 11, bolgelengde: 350 });
  }
  if (!lagret) throw new Error('Landskapet kunne ikke lages');
  return lagret;
}

/* ================================================================================================ Innsjøen */

/** Innsjøen: hvilke gitterpunkter som er vann, og vannstanden. */
export interface Innsjo {
  maske: boolean[];
  niva: number;
  antall: number;
}

/**
 * Innsjøen rundt `punkt` med vannstanden `niva`: gitterpunktene under vannstanden som henger sammen med punktet
 * (4-naboer), samme regel som `Kotekart` bruker. Renner vannet ut av kartet ved den vannstanden, senkes den til like
 * under terskelen. Null når punktet ligger over vannstanden.
 *
 * Kopiert fra den interne `innsjo` i kotekart.tsx (ikke eksportert), så profilet viser det samme vannet som kartet.
 */
export function innsjo(felt: Hoydefelt, punkt: Kartpunkt, niva: number): Innsjo | null {
  const { nx, ny, celle, z } = felt;
  if (!Number.isFinite(punkt[0]) || !Number.isFinite(punkt[1]) || !Number.isFinite(niva)) return null;
  const i0 = Math.min(nx - 1, Math.max(0, Math.round(punkt[0] / celle)));
  const j0 = Math.min(ny - 1, Math.max(0, Math.round(punkt[1] / celle)));
  const start = j0 * nx + i0;
  const bunn = z[start]!;
  const komponent = (L: number) => {
    const maske = new Array<boolean>(nx * ny).fill(false);
    let lekker = false;
    let antall = 0;
    const ko = [start];
    maske[start] = true;
    while (ko.length) {
      const k = ko.pop()!;
      antall++;
      const i = k % nx;
      const j = (k - i) / nx;
      if (i === 0 || j === 0 || i === nx - 1 || j === ny - 1) lekker = true;
      for (const [di, dj] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ] as const) {
        const a = i + di;
        const b = j + dj;
        if (a < 0 || b < 0 || a >= nx || b >= ny) continue;
        const q = b * nx + a;
        if (!maske[q] && z[q]! < L) {
          maske[q] = true;
          ko.push(q);
        }
      }
    }
    return { maske, lekker, antall };
  };
  if (!(bunn < niva)) return null;
  const forst = komponent(niva);
  if (!forst.lekker) return { maske: forst.maske, niva, antall: forst.antall };
  let lo = bunn;
  let hi = niva;
  for (let n = 0; n < 24; n++) {
    const mid = (lo + hi) / 2;
    if (komponent(mid).lekker) hi = mid;
    else lo = mid;
  }
  const L = lo - 0.05;
  if (L <= bunn + 0.05) return null;
  const k = komponent(L);
  return { maske: k.maske, niva: L, antall: k.antall };
}

/** Ligger punktet (meter) i innsjøen? Nærmeste gitterpunkt avgjør. */
export function iInnsjo(felt: Hoydefelt, sjo: Innsjo | null, x: number, y: number): boolean {
  if (!sjo || !Number.isFinite(x) || !Number.isFinite(y)) return false;
  if (x < 0 || y < 0 || x > felt.bredde || y > felt.lengde) return false;
  const i = Math.min(felt.nx - 1, Math.max(0, Math.round(x / felt.celle)));
  const j = Math.min(felt.ny - 1, Math.max(0, Math.round(y / felt.celle)));
  return sjo.maske[j * felt.nx + i] === true;
}

/* ================================================================================================ Profillinja */

/** Hvor langt inn fra kartkanten A og B ligger (m), så bokstavene får plass innenfor kartet. */
export const KANTMARG = 220;

export const RETNING_MIN = 0;
export const RETNING_MAKS = 355;
export const RETNING_STEG = 5;
export const FORSKYVNING_MAKS = 1100;
export const FORSKYVNING_STEG = 50;

/** Profillinja: endepunktene A og B (meter) og lengden. */
export interface Profillinje {
  A: P;
  B: P;
  lengde: number;
}

/**
 * Profillinja for en retning og en forskyvning: en rett linje fra kant til kant (`KANTMARG` inn fra kartkanten) som går
 * i kompassretningen `retning` fra A mot B (0 = nord, 90 = øst) og er flyttet `forskyvning` meter til høyre for
 * retningen (sett fra A mot B; negativ = til venstre) fra midten av kartet. Null når linja ikke treffer kartet.
 *
 * @param retning Kompassretningen fra A mot B i grader.
 * @param forskyvning Meter til høyre for midten (sett fra A mot B).
 * @param bredde Kartets bredde i meter (standard `KART.bredde`).
 * @param lengde Kartets lengde (nord–sør) i meter (standard `KART.lengde`).
 */
export function profillinje(retning: number, forskyvning: number, bredde: number = KART.bredde, lengde: number = KART.lengde): Profillinje | null {
  if (![retning, forskyvning, bredde, lengde].every(Number.isFinite)) return null;
  const x0 = KANTMARG;
  const y0 = KANTMARG;
  const x1 = bredde - KANTMARG;
  const y1 = lengde - KANTMARG;
  if (!(x1 > x0) || !(y1 > y0)) return null;
  const r = (retning * Math.PI) / 180;
  const dx = Math.sin(r);
  const dy = -Math.cos(r);
  // Til høyre for retningen: (−dy, dx)
  const cx = bredde / 2 + -dy * forskyvning;
  const cy = lengde / 2 + dx * forskyvning;
  // Klipp linja c + s · d mot rektangelet (Liang–Barsky)
  let lo = -Infinity;
  let hi = Infinity;
  for (const [p, q0, q1] of [
    [dx, x0 - cx, x1 - cx],
    [dy, y0 - cy, y1 - cy],
  ] as const) {
    if (Math.abs(p) < 1e-12) {
      if (q0 > 0 || q1 < 0) return null;
      continue;
    }
    const a = q0 / p;
    const b = q1 / p;
    lo = Math.max(lo, Math.min(a, b));
    hi = Math.min(hi, Math.max(a, b));
  }
  if (!(hi > lo) || !Number.isFinite(lo) || !Number.isFinite(hi)) return null;
  const A: P = [cx + dx * lo, cy + dy * lo];
  const B: P = [cx + dx * hi, cy + dy * hi];
  return { A, B, lengde: hi - lo };
}

/** Punktet en andel `t` (0–1) av veien fra A til B. */
export function punktPaaLinje(linje: Profillinje, t: number): P {
  const u = Number.isFinite(t) ? Math.min(1, Math.max(0, t)) : 0;
  return [linje.A[0] + (linje.B[0] - linje.A[0]) * u, linje.A[1] + (linje.B[1] - linje.A[1]) * u];
}

/** Andelen t (0–1) av veien fra A til B for punktet på linja som ligger nærmest `p` (til peking på kartet). */
export function projiserPaaLinje(linje: Profillinje, p: Kartpunkt): number {
  const vx = linje.B[0] - linje.A[0];
  const vy = linje.B[1] - linje.A[1];
  const l2 = vx * vx + vy * vy;
  if (!(l2 > 0) || !Number.isFinite(p[0]) || !Number.isFinite(p[1])) return 0;
  const t = ((p[0] - linje.A[0]) * vx + (p[1] - linje.A[1]) * vy) / l2;
  return Math.min(1, Math.max(0, t));
}

/** Retning og forskyvning (avrundet til glidebryternes steg) for en linje som går gjennom `fra` og så `til`. */
export function linjeGjennom(fra: Kartpunkt, til: Kartpunkt): { retning: number; forskyvning: number } {
  const dx = til[0] - fra[0];
  const dy = til[1] - fra[1];
  let retning = (Math.atan2(dx, -dy) * 180) / Math.PI;
  retning = (((Math.round(retning / RETNING_STEG) * RETNING_STEG) % 360) + 360) % 360;
  const r = (retning * Math.PI) / 180;
  // Forskyvningen er avstanden fra midten til linja, målt til høyre for retningen: (cos r, sin r)
  const mx = (fra[0] + til[0]) / 2 - KART.bredde / 2;
  const my = (fra[1] + til[1]) / 2 - KART.lengde / 2;
  const f = mx * Math.cos(r) + my * Math.sin(r);
  const forskyvning = Math.max(-FORSKYVNING_MAKS, Math.min(FORSKYVNING_MAKS, Math.round(f / FORSKYVNING_STEG) * FORSKYVNING_STEG));
  return { retning, forskyvning: forskyvning === 0 ? 0 : forskyvning };
}

/** Et forhåndsvalg for profillinja: retning, forskyvning og hvor P står (andel av A–B). */
export interface Forvalg {
  id: 'over-dalen' | 'langs-dalen' | 'over-bekken' | 'over-aasene';
  navn: string;
  retning: number;
  forskyvning: number;
  /** Andelen av veien fra A til B der P står. */
  t: number;
}

const ov = linjeGjennom(STEDER.topp.p, STEDER.vann.punkt);
const ld = linjeGjennom([2600, 200], [1900, 2300]);
const ob = linjeGjennom([1100, 1000], [1600, 500]);
const oa = linjeGjennom([1500, 2200], STEDER.aasSor.p);

/** Forhåndsvalgene for profillinja. */
export const FORVALG: readonly Forvalg[] = [
  { id: 'over-dalen', navn: 'Over dalen', ...ov, t: 0.32 },
  { id: 'langs-dalen', navn: 'Langs dalen', ...ld, t: 0.45 },
  { id: 'over-bekken', navn: 'Over bekken', ...ob, t: 0.6 },
  { id: 'over-aasene', navn: 'Opp på Råsen', ...oa, t: 0.7 },
];

/* ================================================================================================ Langs profilet */

/** Én kotekrysning langs profillinja: der linja krysser en kote. */
export interface Kotekrysning {
  /** Avstand fra A i meter. */
  s: number;
  x: number;
  y: number;
  /** Kotens høyde i m o.h. */
  hoyde: number;
  /** Hovedkote (tellekote)? */
  tykk: boolean;
}

/**
 * Kotekrysningene langs et profil: der terrenget passerer et helt multiplum av ekvidistansen, slik man merker av på en
 * papirstrimmel langs A–B når man tegner et profil for hånd. Hver kote telles én gang der linja passerer den (også når
 * et profilpunkt ligger nøyaktig på koten), i rekkefølgen fra A, og A tas med når den ligger på en kote. Ekvidistanse
 * ≤ 0 gir en tom liste.
 *
 * @param profil Profilpunktene (tette nok til at to koter ikke havner mellom to punkter, f.eks. 400 punkter).
 * @param ekvidistanse Meter mellom kotene.
 * @param hovedkoteHver Hver hvor mange koter som er hovedkote (standard 5).
 */
export function kotekrysninger(profil: readonly ProfilPunkt[], ekvidistanse: number, hovedkoteHver = 5): Kotekrysning[] {
  if (!Number.isFinite(ekvidistanse) || ekvidistanse <= 0) return [];
  const hver = Math.max(1, Math.round(hovedkoteHver));
  const ut: Kotekrysning[] = [];
  const lag = (p: ProfilPunkt, n: number): Kotekrysning => ({ s: p.s, x: p.x, y: p.y, hoyde: Number((n * ekvidistanse).toPrecision(12)), tykk: ((n % hver) + hver) % hver === 0 });
  const eps = 1e-9;
  // Ligger A nøyaktig på en kote, merkes den også
  const forste = profil[0];
  if (forste) {
    const n = Math.round(forste.z / ekvidistanse);
    if (Math.abs(forste.z - n * ekvidistanse) < eps * Math.max(1, Math.abs(forste.z))) ut.push(lag(forste, n));
  }
  for (let i = 1; i < profil.length; i++) {
    const a = profil[i - 1]!;
    const b = profil[i]!;
    if (a.z === b.z) continue;
    // Nivåene etter a (ikke a selv, den er telt i forrige strekning) til og med b, i den rekkefølgen linja møter dem
    const opp = b.z > a.z;
    const n0 = opp ? Math.floor(a.z / ekvidistanse + eps) + 1 : Math.ceil(a.z / ekvidistanse - eps) - 1;
    const n1 = opp ? Math.floor(b.z / ekvidistanse + eps) : Math.ceil(b.z / ekvidistanse - eps);
    if (Math.abs(n1 - n0) > 1000) continue;
    for (let n = n0; opp ? n <= n1 : n >= n1; n += opp ? 1 : -1) {
      const h = n * ekvidistanse;
      const t = Math.min(1, Math.max(0, (h - a.z) / (b.z - a.z)));
      ut.push({
        s: a.s + (b.s - a.s) * t,
        x: a.x + (b.x - a.x) * t,
        y: a.y + (b.y - a.y) * t,
        hoyde: Number(h.toPrecision(12)),
        tykk: ((n % hver) + hver) % hver === 0,
      });
    }
  }
  return ut;
}

/** Avstanden mellom kotene ved et punkt, målt rett på kotene (i den bratteste retningen). */
export interface Kotavstand {
  /** Avstanden i meter mellom koten under og koten over punktet. */
  d: number;
  /** Der målelinja krysser koten under og koten over (meter). */
  fra: P;
  til: P;
  /** Kotene under og over (m o.h.). */
  under: number;
  over: number;
  /** Snitthelningen mellom de to kotene: tan α = ekvidistanse / d, i grader. */
  grader: number;
}

/**
 * Avstanden mellom de to kotene på hver side av punktet (x, y), målt langs en rett linje i den bratteste retningen
 * (vinkelrett på kotene): slik eleven måler på kartet før hun regner ut helningen med tan α = ekvidistanse / avstand.
 * Null når terrenget er flatt, når en av kotene ikke finnes innen `maks` meter (på en topp eller i en dalbunn), eller
 * når ekvidistansen er ≤ 0.
 *
 * @param felt Høydefeltet.
 * @param x Meter mot øst.
 * @param y Meter mot sør.
 * @param ekvidistanse Meter mellom kotene.
 * @param maks Lengst avstand å lete i hver retning (standard 600 m).
 */
export function kotavstand(felt: Hoydefelt, x: number, y: number, ekvidistanse: number, maks = 600): Kotavstand | null {
  if (!Number.isFinite(ekvidistanse) || ekvidistanse <= 0) return null;
  const z0 = hoydeVed(felt, x, y);
  const h = helning(felt, x, y);
  if (z0 === null || !h) return null;
  const g = Math.hypot(h.dzdx, h.dzdy);
  if (!(g > 1e-4)) return null;
  const ux = h.dzdx / g;
  const uy = h.dzdy / g;
  // Står punktet på en kote, er koten selv «under» og den neste «over».
  const under = Math.floor(z0 / ekvidistanse + 1e-9) * ekvidistanse;
  const over = under + ekvidistanse;
  const steg = felt.celle / 4;
  /** Gå fra punktet i retningen (sx, sy) til høyden passerer `mal`; gir punktet og avstanden. */
  const ga = (sx: number, sy: number, mal: number, opp: boolean): { p: P; s: number } | null => {
    let forrige = z0;
    let ytterst = z0;
    for (let s = steg; s <= maks; s += steg) {
      const px = x + sx * s;
      const py = y + sy * s;
      const z = hoydeVed(felt, px, py);
      if (z === null) return null;
      if (opp ? z >= mal : z <= mal) {
        const t = z === forrige ? 1 : (mal - forrige) / (z - forrige);
        const ss = s - steg + steg * Math.min(1, Math.max(0, t));
        return { p: [x + sx * ss, y + sy * ss], s: ss };
      }
      // Snur terrenget (over en topp eller gjennom en dalbunn) før koten, finnes ingen kote i denne retningen.
      if (opp ? z < ytterst - 2 : z > ytterst + 2) return null;
      ytterst = opp ? Math.max(ytterst, z) : Math.min(ytterst, z);
      forrige = z;
    }
    return null;
  };
  const opp = ga(ux, uy, over, true);
  const ned = z0 - under < 1e-9 ? { p: [x, y] as P, s: 0 } : ga(-ux, -uy, under, false);
  if (!opp || !ned) return null;
  const d = opp.s + ned.s;
  if (!(d > 0)) return null;
  return { d, fra: ned.p, til: opp.p, under: Number(under.toPrecision(12)), over: Number(over.toPrecision(12)), grader: (Math.atan(ekvidistanse / d) * 180) / Math.PI };
}

/**
 * Helningen langs profillinja i et punkt (grader, positiv når terrenget stiger fra A mot B), fra høydene `ds` meter på
 * hver side langs linja. Til forskjell fra `helning` i kart.ts, som gir den bratteste helningen i punktet, er dette
 * helningen eleven ser i profilet. Null utenfor feltet.
 */
export function helningLangsLinja(felt: Hoydefelt, linje: Profillinje, t: number, ds = 10): number | null {
  if (!(linje.lengde > 0) || !Number.isFinite(t)) return null;
  const ux = (linje.B[0] - linje.A[0]) / linje.lengde;
  const uy = (linje.B[1] - linje.A[1]) / linje.lengde;
  const [x, y] = punktPaaLinje(linje, t);
  const s = t * linje.lengde;
  const a = Math.max(0, s - ds);
  const b = Math.min(linje.lengde, s + ds);
  if (!(b > a)) return null;
  const za = hoydeVed(felt, linje.A[0] + ux * a, linje.A[1] + uy * a);
  const zb = hoydeVed(felt, linje.A[0] + ux * b, linje.A[1] + uy * b);
  if (za === null || zb === null || hoydeVed(felt, x, y) === null) return null;
  return (Math.atan((zb - za) / (b - a)) * 180) / Math.PI;
}

/**
 * Vinkelen en skråning ser ut til å ha i et profil med overhøyde: tan(vist) = overhøyde · tan(ekte). Med overhøyde 3
 * ser en li på 20° ut som 47°. Ugyldige tall, overhøyde ≤ 0 eller |ekte| ≥ 90° gir null.
 */
export function vistVinkel(ekte: number, overhoyde: number): number | null {
  if (!Number.isFinite(ekte) || !Number.isFinite(overhoyde) || overhoyde <= 0 || Math.abs(ekte) >= 90) return null;
  return (Math.atan(overhoyde * Math.tan((ekte * Math.PI) / 180)) * 180) / Math.PI;
}

/** Strekningene (avstand fra A i meter) der profilet går gjennom innsjøen. */
export function vannIProfil(felt: Hoydefelt, sjo: Innsjo | null, profil: readonly ProfilPunkt[]): [number, number][] {
  const ut: [number, number][] = [];
  let start: number | null = null;
  let siste = 0;
  for (const p of profil) {
    const inne = iInnsjo(felt, sjo, p.x, p.y);
    if (inne && start === null) start = p.s;
    if (!inne && start !== null) {
      ut.push([start, siste]);
      start = null;
    }
    if (inne) siste = p.s;
  }
  if (start !== null) ut.push([start, siste]);
  return ut.filter(([a, b]) => b > a);
}

/** En elv som profilet krysser: avstanden fra A og navnet. */
export interface Elvekryssing {
  s: number;
  x: number;
  y: number;
  navn: string;
}

/** Der profillinja krysser elvene (polylinjer i meter), sortert etter avstanden fra A. */
export function elvekryssinger(linje: Profillinje, elver: readonly { punkter: readonly Kartpunkt[]; navn: string }[]): Elvekryssing[] {
  const ut: Elvekryssing[] = [];
  const [ax, ay] = linje.A;
  const rx = linje.B[0] - ax;
  const ry = linje.B[1] - ay;
  for (const elv of elver) {
    for (let i = 1; i < elv.punkter.length; i++) {
      const [px, py] = elv.punkter[i - 1]!;
      const [qx, qy] = elv.punkter[i]!;
      const sx = qx - px;
      const sy = qy - py;
      const nevner = rx * sy - ry * sx;
      if (Math.abs(nevner) < 1e-12) continue;
      const t = ((px - ax) * sy - (py - ay) * sx) / nevner;
      const u = ((px - ax) * ry - (py - ay) * rx) / nevner;
      if (t < 0 || t > 1 || u < 0 || u >= 1) continue;
      const x = ax + rx * t;
      const y = ay + ry * t;
      // Hopp over kryssinger tett på en vi har: trappetrinn i D8, eller en bekk som går videre i hovedelva
      if (ut.some((k) => Math.hypot(k.x - x, k.y - y) < 60)) continue;
      ut.push({ s: t * linje.lengde, x, y, navn: elv.navn });
    }
  }
  return ut.sort((a, b) => a.s - b.s);
}

/* ================================================================================================ Elver og nedbørfelt */

/**
 * Elvene i landskapet som polylinjer i meter (D8 fra kilden), med navn: Dalelva fra nordkanten gjennom Langvatnet og ut
 * av kartet i sør, Fossbekken fra lia under Storhøgda til den renner ut i vannet, og bekken fra skaret i øst til den
 * møter Dalelva (resten av veien er Dalelva).
 */
export function elveLop(felt: Hoydefelt, sjo: Innsjo | null): { punkter: P[]; navn: string }[] {
  const elv = flytvei(felt, STEDER.elv.fra);
  const bekk = flytvei(felt, STEDER.bekk.fra);
  const inn = bekk.findIndex(([x, y]) => iInnsjo(felt, sjo, x, y));
  // Sidebekken følger Dalelva når den når den; resten av veien er Dalelva
  const side = flytvei(felt, STEDER.sidebekk.fra);
  const elvSett = new Set(elv.map(([x, y]) => `${x},${y}`));
  const mot = side.findIndex(([x, y]) => elvSett.has(`${x},${y}`));
  return [
    { punkter: elv, navn: STEDER.elv.navn },
    { punkter: inn > 0 ? bekk.slice(0, inn + 1) : bekk, navn: STEDER.bekk.navn },
    { punkter: mot > 0 ? side.slice(0, mot + 1) : side, navn: 'Bekk' },
  ];
}

/** Det høyeste gitterpunktet innen `radius` meter fra `rundt` (til toppmerkene, så høyden ved merket er toppens). */
export function hoyestePunkt(felt: Hoydefelt, rundt: Kartpunkt, radius = 200): P {
  let best: P = [rundt[0], rundt[1]];
  let bestZ = hoydeVed(felt, rundt[0], rundt[1]) ?? -Infinity;
  const c = felt.celle;
  for (let y = Math.max(0, rundt[1] - radius); y <= Math.min(felt.lengde, rundt[1] + radius); y += c) {
    for (let x = Math.max(0, rundt[0] - radius); x <= Math.min(felt.bredde, rundt[0] + radius); x += c) {
      if (Math.hypot(x - rundt[0], y - rundt[1]) > radius) continue;
      const gx = Math.round(x / c) * c;
      const gy = Math.round(y / c) * c;
      const z = hoydeVed(felt, gx, gy);
      if (z !== null && z > bestZ) {
        bestZ = z;
        best = [gx, gy];
      }
    }
  }
  return best;
}

/** Arealet av nedbørfeltet til Dalelva ved kartkanten i km² (null når det ikke kan regnes ut). */
export function nedborfeltAreal(felt: Hoydefelt): number | null {
  const nf = vannskille(felt, STEDER.utlop.p);
  return nf ? nf.areal / 1e6 : null;
}

/* ================================================================================================ Profilfiguren */

/**
 * Hvor bredt plottet i profildiagrammet kan være (figurenheter) når høydene skal tegnes med nøyaktig overhøyde og hele
 * terrenget skal få plass i høyden `plotH`: med høyst `plotBmaks` i bredden, og smalere når overhøyden er så stor at
 * profilet ellers ville gått ut av plottet. Da blir profilet tegnet i en mindre målestokk, men med riktig overhøyde.
 * `luft` er hvor mye høyere plottet skal være enn høydeforskjellen langs linja (standard 1,25). Null for ugyldige tall.
 *
 * @param L Lengden av profilet i meter.
 * @param zMin Laveste høyde langs profilet.
 * @param zMax Høyeste høyde langs profilet.
 * @param overhoyde Overhøyden (1 = riktige forhold).
 * @param plotBmaks Største bredde på plottet.
 * @param plotH Høyden på plottet.
 */
export function profilBredde(L: number, zMin: number, zMax: number, overhoyde: number, plotBmaks: number, plotH: number, luft = 1.25): number | null {
  if (![L, zMin, zMax, overhoyde, plotBmaks, plotH, luft].every(Number.isFinite)) return null;
  if (L <= 0 || overhoyde <= 0 || plotBmaks <= 0 || plotH <= 0 || zMax < zMin) return null;
  const relieff = Math.max(zMax - zMin, 1);
  const kxMaks = plotH / (relieff * luft * overhoyde);
  return Math.min(plotBmaks, kxMaks * L);
}

/* ================================================================================================ Tekst */

const KOMPASS = ['nord', 'nordøst', 'øst', 'sørøst', 'sør', 'sørvest', 'vest', 'nordvest'];

/** Kompassretningen (åtte streker) for en retning i grader: 100 → «øst», 140 → «sørøst». */
export function kompassretning(grader: number): string {
  if (!Number.isFinite(grader)) return '–';
  const i = Math.round((((grader % 360) + 360) % 360) / 45) % 8;
  return KOMPASS[i]!;
}

/** En avstand i meter som «450 m» eller «3,24 km». Ugyldige tall gir «–». */
export function fmtAvstand(m: number | null): string {
  if (m === null || !Number.isFinite(m)) return '–';
  if (Math.abs(m) >= 1000) return `${fmt(m / 1000, 2)} km`;
  return `${fmt(m, 0)} m`;
}

/** Hvor bratt terrenget er, i ord, med grensene som brukes i forklaringen. */
export type Brattklasse = 'flatt' | 'slakt' | 'middels' | 'bratt' | 'skredterreng';

/** Ordner en helning i grader i en klasse: under 3° flatt, 3–10° slakt, 10–20° middels bratt, 20–30° bratt, over 30° skredterreng. */
export function brattklasse(grader: number | null): Brattklasse | null {
  if (grader === null || !Number.isFinite(grader) || grader < 0) return null;
  if (grader < 3) return 'flatt';
  if (grader < 10) return 'slakt';
  if (grader < 20) return 'middels';
  if (grader < 30) return 'bratt';
  return 'skredterreng';
}

/** Målestokken på papirkartet regnestykket i forklaringen bruker (som et turkart). */
export const PAPIR_MAALESTOKK = 25_000;

/** A–B målt på et papirkart i `PAPIR_MAALESTOKK`, i cm (null for ugyldige tall). */
export function papirLengde(meter: number): number | null {
  return kartavstand(meter, PAPIR_MAALESTOKK);
}

/** Profilpunktene langs linja (400 punkter, nok til at alle kotekrysningene kommer med). */
export function profilFor(felt: Hoydefelt, linje: Profillinje, n = 400): ProfilPunkt[] {
  return terrengprofil(felt, linje.A, linje.B, n);
}
