/**
 * Kart for geofag: `Kotekart` tegner et høydefelt fra kart.ts som et topografisk kart (høydelag, relieffskygge, koter med
 * kotetall, hav, innsjøer, elver, vannskille, soner, merker, profillinje, nordpil og målestokk), og `Profildiagram`
 * tegner terrengprofilet langs en linje med valgfri overhøyde. Hjelpere: `kartSkala` (meter → figur), `ekvidistanseFor`,
 * `hoydelagFor` (til en tegnforklaring) og `glattSti` (glatt kurve gjennom punkter).
 *
 * Kartkoordinatene er meter i terrenget med origo i nordvest, x mot øst og y mot sør (som i kart.ts og SVG), så nord er
 * opp på kartet.
 */
import { useMemo, type ReactNode } from 'react';
import { useTextScale } from '../../kit/controls';
import { VIZ } from '../../kit/colors';
import { Txt } from '../../kit/txt';
import { fmt } from '../../kit/format';
import { alpha, mix, shade, useSvgId, LinearGradient } from '../../kit/scene/core';
import { SCENE } from '../../kit/scene/palette';
import { GEO } from './colors';
import { geoHoyde, useGeoScale, useGeoStroke } from './felles';
import { flytvei, hoydeVed, koter, maalestokkTekst, skalastokk, terrengprofil, vannskille, type Hoydefelt, type Kartpunkt, type Kote } from './kart';
import { LogPlot, tekstBredde, type LogPlotSkalaer } from './diagram';

type P = [number, number];

/* ================================================================================================ Hjelpere */

/**
 * Glatt SVG-sti gjennom punktene (Catmull-Rom gjort om til kubiske Bézier-kurver), åpen eller lukket. Punktene er i
 * figurens enheter. Brukes til koter, kystlinjer, elver og soner, så knekkene fra rutenettet forsvinner. Like punkter
 * etter hverandre hoppes over; under to punkter gir tom sti.
 */
export function glattSti(punkter: readonly (readonly [number, number])[], lukket = false): string {
  const p: P[] = [];
  for (const q of punkter) {
    if (!Number.isFinite(q[0]) || !Number.isFinite(q[1])) continue;
    const s = p[p.length - 1];
    if (!s || Math.abs(s[0] - q[0]) > 1e-6 || Math.abs(s[1] - q[1]) > 1e-6) p.push([q[0], q[1]]);
  }
  if (lukket && p.length > 2) {
    const a = p[0]!;
    const b = p[p.length - 1]!;
    if (Math.abs(a[0] - b[0]) < 1e-6 && Math.abs(a[1] - b[1]) < 1e-6) p.pop();
  }
  const n = p.length;
  if (n < 2) return '';
  const r = (v: number) => Math.round(v * 100) / 100;
  if (n === 2) return `M${r(p[0]![0])} ${r(p[0]![1])}L${r(p[1]![0])} ${r(p[1]![1])}${lukket ? 'Z' : ''}`;
  const hent = (i: number): P => (lukket ? p[((i % n) + n) % n]! : p[Math.max(0, Math.min(n - 1, i))]!);
  let d = `M${r(p[0]![0])} ${r(p[0]![1])}`;
  const segs = lukket ? n : n - 1;
  for (let i = 0; i < segs; i++) {
    const p0 = hent(i - 1);
    const p1 = hent(i);
    const p2 = hent(i + 1);
    const p3 = hent(i + 2);
    const c1x = p1[0] + (p2[0] - p0[0]) / 6;
    const c1y = p1[1] + (p2[1] - p0[1]) / 6;
    const c2x = p2[0] - (p3[0] - p1[0]) / 6;
    const c2y = p2[1] - (p3[1] - p1[1]) / 6;
    d += `C${r(c1x)} ${r(c1y)} ${r(c2x)} ${r(c2y)} ${r(p2[0])} ${r(p2[1])}`;
  }
  return lukket ? `${d}Z` : d;
}

/** Fra meter i terrenget til figurens koordinater: resultatet av `kartSkala`, og det barna i `Kotekart` får. */
export interface KartSkala {
  /** Meter mot øst → x i figuren. */
  px: (x: number) => number;
  /** Meter mot sør → y i figuren. */
  py: (y: number) => number;
  /** Et punkt [x, y] i meter → [x, y] i figuren. */
  punkt: (p: Kartpunkt) => [number, number];
  /** Figurenheter per meter. */
  k: number;
  /** Kartets ramme i figuren. */
  x0: number;
  y0: number;
  w: number;
  h: number;
  /** Figurens x og y → meter i terrenget (til dra-punkter). */
  mx: (px: number) => number;
  my: (py: number) => number;
}

/**
 * Skalaen fra terrenget (meter) til figuren for et kart som er `width` bredt med øvre venstre hjørne i (x, y). Høyden
 * følger av feltet: `h = width · lengde / bredde`.
 */
export function kartSkala(felt: Hoydefelt, width: number, x = 0, y = 0): KartSkala {
  const w = Number.isFinite(width) && width > 0 ? width : 1;
  const k = felt.bredde > 0 ? w / felt.bredde : 1;
  const x0 = Number.isFinite(x) ? x : 0;
  const y0 = Number.isFinite(y) ? y : 0;
  return {
    px: (v) => x0 + v * k,
    py: (v) => y0 + v * k,
    punkt: (p) => [x0 + p[0] * k, y0 + p[1] * k],
    k,
    x0,
    y0,
    w,
    h: felt.lengde * k,
    mx: (v) => (v - x0) / k,
    my: (v) => (v - y0) / k,
  };
}

const EKVIDISTANSER = [1, 2, 2.5, 5, 10, 20, 25, 50, 100, 200, 250, 500, 1000];

/**
 * En passende ekvidistanse (m) for et høydefelt: den minste av 1, 2, 5, 10, 20, 25, 50, 100 … som gir høyst `maksKoter`
 * koter (standard 22). Et flatt felt gir 1.
 */
export function ekvidistanseFor(felt: Hoydefelt, maksKoter = 22): number {
  const span = felt.max - felt.min;
  if (!Number.isFinite(span) || span <= 0) return 1;
  return EKVIDISTANSER.find((e) => span / e <= maksKoter) ?? Math.ceil(span / maksKoter / 1000) * 1000;
}

/** Ett høydelag på kartet: fra og til (m o.h.) og fargen. */
export interface Hoydelag {
  fra: number;
  til: number;
  farge: string;
}

/**
 * Høydelagene `Kotekart` bruker, fra lavest til høyest (til en tegnforklaring med `Legend`). Standard: grensene følger
 * kotene (et multiplum av ekvidistansen), høyst seks lag, og fargene spres fra lavland (grønn) til høyfjell (lys grå).
 * Med egne grenser (m o.h.) får laget over grense nr. i fargen `GEO.hoydelag[i + 1]` (fast betydning). Med `hav` begynner
 * det laveste laget ved havnivå.
 */
export function hoydelagFor(felt: Hoydefelt, ekvidistanse = ekvidistanseFor(felt), hav: number | null = null, grenser?: readonly number[]): Hoydelag[] {
  const bunn = hav !== null && Number.isFinite(hav) ? Math.max(felt.min, hav) : felt.min;
  const topp = felt.max;
  if (!(topp > bunn)) return [{ fra: bunn, til: topp, farge: GEO.hoydelag[0]! }];
  let niva: number[];
  let farger: string[];
  if (grenser && grenser.length > 0) {
    niva = [...grenser].filter((g) => Number.isFinite(g) && g > bunn && g < topp).sort((a, b) => a - b).slice(0, 5);
    const alle = [...grenser].filter(Number.isFinite).sort((a, b) => a - b);
    farger = [bunn, ...niva].map((v) => GEO.hoydelag[Math.min(5, alle.filter((g) => g <= v + 1e-9).length)]!);
  } else {
    const e = Number.isFinite(ekvidistanse) && ekvidistanse > 0 ? ekvidistanse : ekvidistanseFor(felt);
    const span = topp - bunn;
    let steg = e;
    for (const m of [1, 2, 4, 5, 10, 20, 25, 50, 100, 200, 500, 1000]) {
      steg = e * m;
      if (span / steg <= 5) break;
    }
    niva = [];
    for (let v = Math.ceil((bunn + 1e-9) / steg) * steg; v < topp - 1e-9 && niva.length < 5; v += steg) niva.push(Number(v.toPrecision(12)));
    const n = niva.length + 1;
    farger = Array.from({ length: n }, (_, i) => GEO.hoydelag[n === 1 ? 0 : Math.round((i * 5) / (n - 1))]!);
  }
  const grenseListe = [bunn, ...niva, topp];
  return farger.map((farge, i) => ({ fra: grenseListe[i]!, til: grenseListe[i + 1]!, farge }));
}

/**
 * Omrisset av området der `verdier` (én per gitterpunkt, radvis som `felt.z`) er ≥ 0, som lukkede ringer i meter
 * (langs kartkanten der området når den). Fyll alle ringene i én sti med `fillRule="evenodd"`, så hull blir hull.
 */
function omrader(felt: Hoydefelt, verdier: ArrayLike<number>): P[][] {
  const { nx, ny, celle } = felt;
  const px = nx + 2;
  const py = ny + 2;
  const z = new Array<number>(px * py).fill(-1);
  let mn = -1;
  let mx = -1;
  for (let j = 0; j < ny; j++) {
    for (let i = 0; i < nx; i++) {
      const v = verdier[j * nx + i];
      const t = v !== undefined && Number.isFinite(v) ? v : -1;
      z[(j + 1) * px + i + 1] = t;
      if (t < mn) mn = t;
      if (t > mx) mx = t;
    }
  }
  if (mx < 0) return [];
  const fake: Hoydefelt = { nx: px, ny: py, celle, bredde: (px - 1) * celle, lengde: (py - 1) * celle, z, min: mn, max: mx };
  const ekv = mx - mn + 1;
  const klemX = (v: number) => Math.min(felt.bredde, Math.max(0, v - celle));
  const klemY = (v: number) => Math.min(felt.lengde, Math.max(0, v - celle));
  return koter(fake, ekv, { hovedkoteHver: 1 }).flatMap((kt) => kt.linjer.map((l) => l.punkter.map(([x, y]) => [klemX(x), klemY(y)] as P)));
}

/** Arealtyngdepunktet til den største ringen (til en etikett midt i et område), eller null. */
function midtpunkt(ringer: readonly P[][]): P | null {
  let best: P | null = null;
  let bestA = 0;
  for (const r of ringer) {
    let a = 0;
    let cx = 0;
    let cy = 0;
    for (let i = 0; i < r.length; i++) {
      const [x1, y1] = r[i]!;
      const [x2, y2] = r[(i + 1) % r.length]!;
      const c = x1 * y2 - x2 * y1;
      a += c;
      cx += (x1 + x2) * c;
      cy += (y1 + y2) * c;
    }
    if (Math.abs(a) > bestA && a !== 0) {
      bestA = Math.abs(a);
      best = [cx / (3 * a), cy / (3 * a)];
    }
  }
  return best;
}

/**
 * Innsjøen rundt et punkt: gitterpunktene under vannstanden som henger sammen med punktet (4-naboer). Renner vannet ut
 * av kartet eller i havet ved den vannstanden, senkes den til like under terskelen (der vannet ville rent over), så
 * innsjøen aldri flyter ut over landskapet. Null når punktet ligger over vannstanden.
 */
function innsjo(felt: Hoydefelt, punkt: Kartpunkt, niva: number, hav: number | null): { maske: boolean[]; niva: number } | null {
  const { nx, ny, celle, z } = felt;
  if (!Number.isFinite(punkt[0]) || !Number.isFinite(punkt[1]) || !Number.isFinite(niva)) return null;
  const i0 = Math.min(nx - 1, Math.max(0, Math.round(punkt[0] / celle)));
  const j0 = Math.min(ny - 1, Math.max(0, Math.round(punkt[1] / celle)));
  const start = j0 * nx + i0;
  const bunn = z[start]!;
  const komponent = (L: number) => {
    const maske = new Array<boolean>(nx * ny).fill(false);
    let lekker = false;
    const ko = [start];
    maske[start] = true;
    while (ko.length) {
      const kk = ko.pop()!;
      const i = kk % nx;
      const j = (kk - i) / nx;
      if (i === 0 || j === 0 || i === nx - 1 || j === ny - 1 || (hav !== null && z[kk]! <= hav)) lekker = true;
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
    return { maske, lekker };
  };
  if (!(bunn < niva)) return null;
  const forst = komponent(niva);
  if (!forst.lekker) return { maske: forst.maske, niva };
  let lo = bunn;
  let hi = niva;
  for (let n = 0; n < 24; n++) {
    const mid = (lo + hi) / 2;
    if (komponent(mid).lekker) hi = mid;
    else lo = mid;
  }
  const L = lo - 0.05;
  if (L <= bunn + 0.05) return null;
  return { maske: komponent(L).maske, niva: L };
}

/* ================================================================================================ Kotekart */

/** En innsjø: vannet fyller forsenkningen rundt `punkt` opp til `niva` (m o.h.). */
export interface KartInnsjo {
  punkt: Kartpunkt;
  niva: number;
  navn?: string;
}

/** En elv: fra en kilde og nedover (D8 med `flytvei`, til havet eller kartkanten), eller langs egne punkter. */
export interface KartElv {
  fra?: Kartpunkt;
  punkter?: readonly Kartpunkt[];
  navn?: string;
  /** Strekbredde ved kilden og ved utløpet i figurens enheter (standard [1,3; 3,6]). */
  bredde?: readonly [number, number];
}

/** Et vannskille: nedbørfeltet til et utløp (`vannskille` i kart.ts), med stiplet grense og valgfritt fyll. */
export interface KartVannskille {
  utlop: Kartpunkt;
  /** Fyll nedbørfeltet svakt (standard på). */
  fyll?: boolean;
  /** Merke ved utløpet (standard på). */
  utlopMerke?: boolean;
  navn?: string;
  farge?: string;
}

/**
 * En sone på kartet (faresone, nedbørfelt, arealbruk): et polygon i meter, eller området der `verdi(x, y, z) > 0`
 * (regnet i hvert gitterpunkt, med glatt kant), f.eks. flomsone under 12 m o.h.: `verdi: (x, y, z) => 12 − z`.
 */
export interface KartSone {
  punkter?: readonly Kartpunkt[];
  verdi?: (x: number, y: number, z: number) => number;
  farge: string;
  navn?: string;
  /** Skrå skravur i sonefargen (som faresoner hos NVE). */
  skravur?: boolean;
  /** Dekkevne for fyllet 0–1 (standard 0,32; 0 = bare kant og skravur). */
  fyll?: number;
  kant?: 'hel' | 'stiplet' | 'ingen';
  /** Hvor navnet står (standard midt i sonen). */
  etikett?: Kartpunkt;
}

/** Et merke på kartet: topp (trekant med høyden), punkt, hus, brønn eller kryss. */
export interface KartMerke {
  p: Kartpunkt;
  symbol?: 'topp' | 'punkt' | 'hus' | 'bronn' | 'kryss';
  navn?: string;
  /** Skriv høyden (m o.h.) ved merket (standard på for topper). */
  hoyde?: boolean;
  farge?: string;
}

/** Profillinja A–B på kartet (samme punkter som `Profildiagram`). */
export interface KartProfil {
  A: Kartpunkt;
  B: Kartpunkt;
  navn?: readonly [string, string];
  farge?: string;
}

export interface KotekartProps {
  felt: Hoydefelt;
  /** Øvre venstre hjørne av kartet i figuren (standard 0, 0). */
  x?: number;
  y?: number;
  /** Kartets bredde i figuren; høyden blir `width · lengde / bredde` (se `kartSkala`). */
  width: number;
  /** Høydeforskjellen mellom kotene i meter (standard `ekvidistanseFor(felt)`). */
  ekvidistanse?: number;
  /** Hver hvor mange koter som er tykke tellekoter med tall (standard 5). */
  hovedkoteHver?: number;
  /** Tall på tellekotene (standard på). */
  kotetall?: boolean;
  /**
   * Hvordan kotetallene dreies: `'lesbar'` (standard: aldri opp ned) eller `'terreng'` (toppen av tallet peker oppover i
   * terrenget, som på norske topografiske kart, så noen tall står opp ned).
   */
  kotetallRetning?: 'lesbar' | 'terreng';
  /** Høydelag i farger (standard på), eller egne grenser i m o.h. med fast fargebetydning. */
  hoydelag?: boolean | readonly number[];
  /** Relieffskygge med lys fra nordvest (standard på). */
  relieff?: boolean;
  /**
   * Havnivå i m o.h.: alt på eller under er hav, med kystlinje, og elvene stopper der (standard ingen hav). La feltet gå
   * under havnivået (ikke bruk `gulv` i `hoydefelt`), så blir kystlinja glatt; med `gulv` følger den rutenettet.
   */
  hav?: number | null;
  innsjoer?: readonly KartInnsjo[];
  elver?: readonly KartElv[];
  vannskiller?: readonly KartVannskille[];
  soner?: readonly KartSone[];
  merker?: readonly KartMerke[];
  profil?: KartProfil | null;
  /** Nordpil øverst til høyre (standard på). */
  nordpil?: boolean;
  /** Målestokklinje nederst til venstre (standard på); et tall gir også målestokken «1 : 50 000». */
  maalestokk?: boolean | number;
  /** «Ekvidistanse 20 m» ved målestokken (standard på når det er koter). */
  visEkvidistanse?: boolean;
  /** Dempet grunnkart, når sonene eller tegningen oppå er poenget. */
  dempet?: boolean;
  /** Ekstra tegning oppå kartet (klippet til kartet), med skalaen fra meter til figuren. */
  children?: (s: KartSkala) => ReactNode;
}

interface Kotetall {
  x: number;
  y: number;
  vinkel: number;
  tekst: string;
  w: number;
  h: number;
}

/**
 * Topografisk kart fra et høydefelt (`hoydefelt` i kart.ts): høydelag i farger, myk relieffskygge med lys fra nordvest,
 * koter med hver femte tykk og med tall (lesbare, eller med toppen mot høyere terreng som på norske kart), hav med
 * kystlinje, innsjøer, elver som følger terrenget (`flytvei`), vannskille og nedbørfelt (`vannskille`), soner (faresoner,
 * arealbruk), merker (topper med høyde, hus, brønner), profillinje A–B, nordpil og målestokk med ekvidistanse. Tekst og
 * symboler vokser på mobil. Høyden er `width · lengde / bredde`:
 *   const felt = useMemo(() => hoydefelt(7, former, { bredde: 2000, lengde: 1400, gulv: 0 })!, []);
 *   <Figure viewBox={`0 0 800 ${800 * felt.lengde / felt.bredde}`} label="Kotekart">
 *     <Kotekart felt={felt} width={800} hav={0} elver={[{ fra: [1500, 200] }]} profil={{ A: [200, 700], B: [1800, 700] }} />
 *   </Figure>
 */
export function Kotekart(props: KotekartProps) {
  const { felt } = props;
  const f = useTextScale();
  const k = useGeoScale();
  const ss = useGeoStroke();
  const id = useSvgId('kotekart');
  const S = kartSkala(felt, props.width, props.x, props.y);
  const ekv = props.ekvidistanse !== undefined && Number.isFinite(props.ekvidistanse) && props.ekvidistanse > 0 ? props.ekvidistanse : ekvidistanseFor(felt);
  const hoved = Math.max(1, Math.round(props.hovedkoteHver ?? 5));
  const hav = props.hav !== undefined && props.hav !== null && Number.isFinite(props.hav) ? props.hav : null;
  const lagValg = props.hoydelag ?? true;
  const lagNokkel = Array.isArray(lagValg) ? lagValg.join(',') : String(lagValg);
  const relieff = props.relieff !== false;
  const visKotetall = props.kotetall !== false;
  const terrengRetning = props.kotetallRetning === 'terreng';
  const tallPx = 17 * 0.64 * f;

  // Grunnkartet: høydelag, relieff, koter og kotetall (regnes bare ut når feltet eller valgene endres)
  const grunn = useMemo(() => {
    const { nx, ny, celle, z } = felt;
    const N = nx * ny;
    const tilSti = (ringer: readonly P[][], minRute = 0) =>
      ringer
        .filter((r) => {
          if (minRute <= 0) return true;
          const xs = r.map((p) => p[0]);
          const ys = r.map((p) => p[1]);
          return Math.max(...xs) - Math.min(...xs) > minRute * celle || Math.max(...ys) - Math.min(...ys) > minRute * celle;
        })
        .map((r) => glattSti(r.map(S.punkt), true))
        .join('');
    const landGrense = hav !== null ? hav + 0.05 : -Infinity;
    // Land (over havet)
    const landRinger = hav !== null ? omrader(felt, Array.from(z, (v) => v - landGrense)) : null;
    const land = landRinger ? tilSti(landRinger) : null;
    // Høydelag
    const lag = lagValg === false ? [] : hoydelagFor(felt, ekv, hav, Array.isArray(lagValg) ? lagValg : undefined);
    const lagStier = lag.map((l, i) => {
      if (i === 0) return { farge: l.farge, d: land ?? `M${S.x0} ${S.y0}h${S.w}v${S.h}h${-S.w}Z` };
      return { farge: l.farge, d: tilSti(omrader(felt, Array.from(z, (v) => v - l.fra))) };
    });
    // Relieffskygge: hvor mye hver flate vender mot lyset fra nordvest
    const skygge: { d: string; mork: boolean; styrke: number }[] = [];
    if (relieff && felt.max > felt.min) {
      const gx = new Float64Array(N);
      const gy = new Float64Array(N);
      const mag: number[] = [];
      for (let j = 0; j < ny; j++) {
        for (let i = 0; i < nx; i++) {
          const a = Math.max(0, i - 1);
          const b = Math.min(nx - 1, i + 1);
          const c = Math.max(0, j - 1);
          const d = Math.min(ny - 1, j + 1);
          const dzdx = (z[j * nx + b]! - z[j * nx + a]!) / ((b - a) * celle || 1);
          const dzdy = (z[d * nx + i]! - z[c * nx + i]!) / ((d - c) * celle || 1);
          gx[j * nx + i] = dzdx;
          gy[j * nx + i] = dzdy;
          mag.push(Math.hypot(dzdx, dzdy));
        }
      }
      mag.sort((p, q) => p - q);
      const p90 = mag[Math.floor(mag.length * 0.9)] ?? 0;
      const e = 0.8 / Math.max(p90, 0.03);
      const sv = new Float64Array(N);
      for (let q = 0; q < N; q++) {
        const t = ((gx[q]! + gy[q]!) / Math.SQRT2) * e;
        sv[q] = t / Math.sqrt(1 + t * t);
        if (hav !== null && z[q]! <= landGrense) sv[q] = 0;
      }
      const trinn: [number, boolean, number][] = [
        ...[0.12, 0.26, 0.4, 0.54, 0.68].map((t): [number, boolean, number] => [t, true, 0.15]),
        ...[0.18, 0.36, 0.54].map((t): [number, boolean, number] => [t, false, 0.24]),
      ];
      for (const [terskel, mork, styrke] of trinn) {
        const d = tilSti(
          omrader(
            felt,
            Array.from(sv, (v) => (mork ? -v : v) - terskel),
          ),
          1.5,
        );
        if (d) skygge.push({ d, mork, styrke });
      }
    }
    // Koter (ikke i havet)
    const alle: Kote[] = koter(felt, ekv, { hovedkoteHver: hoved }).filter((kt) => hav === null || kt.hoyde > landGrense);
    const tynne = alle
      .filter((kt) => !kt.tykk)
      .flatMap((kt) => kt.linjer.map((l) => glattSti(l.punkter.map(S.punkt), l.lukket)))
      .join('');
    const tykke = alle
      .filter((kt) => kt.tykk)
      .flatMap((kt) => kt.linjer.map((l) => glattSti(l.punkter.map(S.punkt), l.lukket)))
      .join('');
    return { land, landRinger, lagStier, lag, skygge, alle, tynne, tykke };
  }, [felt, ekv, hoved, hav, lagNokkel, relieff, S.x0, S.y0, S.w]);

  // Innsjøer
  const innsjoer = useMemo(
    () =>
      (props.innsjoer ?? []).map((sj) => {
        const sjo = innsjo(felt, sj.punkt, sj.niva, hav);
        if (!sjo) return null;
        const { maske, niva } = sjo;
        const v = felt.z.map((zz, q) => (maske[q] ? niva - zz : zz >= niva ? Math.min(niva - zz, -1e-6) : -1));
        const ringer = omrader(felt, v);
        return { maske, ringer, d: ringer.map((r) => glattSti(r.map(S.punkt), true)).join(''), navn: sj.navn, midt: midtpunkt(ringer) };
      }),
    [felt, JSON.stringify(props.innsjoer ?? []), hav, S.x0, S.y0, S.w],
  );

  /** Ligger punktet (meter) i havet eller i en innsjø? */
  const iVann = (x: number, y: number): boolean => {
    const zz = hoydeVed(felt, x, y);
    if (zz === null) return false;
    if (hav !== null && zz <= hav + 0.05) return true;
    const i = Math.min(felt.nx - 1, Math.max(0, Math.round(x / felt.celle)));
    const j = Math.min(felt.ny - 1, Math.max(0, Math.round(y / felt.celle)));
    return innsjoer.some((sj) => sj?.maske[j * felt.nx + i] === true);
  };

  // Kotetall på tellekotene: rette strekninger, ikke i vann, ikke ved kanten og ikke oppå hverandre
  const kotetall = useMemo(() => {
    if (!visKotetall) return [] as Kotetall[];
    const ut: Kotetall[] = [];
    const kant = 10 * f;
    const tykke = grunn.alle.filter((kt) => kt.tykk);
    for (const kt of tykke) {
      const tekst = fmt(kt.hoyde, Number.isInteger(kt.hoyde) ? 0 : 1).replace(/\s/g, '');
      const w = tekstBredde(tekst, tallPx) + 6;
      const h = tallPx * 1.1;
      for (const linje of kt.linjer) {
        const pts = linje.punkter.map(S.punkt);
        const cum: number[] = [0];
        for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1]! + Math.hypot(pts[i]![0] - pts[i - 1]![0], pts[i]![1] - pts[i - 1]![1]));
        const L = cum[cum.length - 1] ?? 0;
        if (L < w * 3) continue;
        const antall = Math.max(1, Math.min(3, Math.floor(L / (460 * Math.max(1, f * 0.8)))));
        const punktVed = (s: number): P => {
          let i = cum.findIndex((c) => c >= s);
          if (i <= 0) i = 1;
          const a = pts[i - 1]!;
          const b = pts[i]!;
          const seg = cum[i]! - cum[i - 1]! || 1;
          const t = (s - cum[i - 1]!) / seg;
          return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
        };
        for (let n = 0; n < antall; n++) {
          for (const forskyv of [0, 0.12, -0.12, 0.24, -0.24]) {
            const s = L * ((n + 0.5) / antall + forskyv / antall);
            if (s - w < 0 || s + w > L) continue;
            const a = punktVed(s - w / 2);
            const b = punktVed(s + w / 2);
            const c = punktVed(s);
            // Rett nok: midtpunktet ligger nær korden
            const kx = (a[0] + b[0]) / 2;
            const ky = (a[1] + b[1]) / 2;
            if (Math.hypot(c[0] - kx, c[1] - ky) > tallPx * 0.3) continue;
            if (c[0] < S.x0 + kant + w / 2 || c[0] > S.x0 + S.w - kant - w / 2 || c[1] < S.y0 + kant + h || c[1] > S.y0 + S.h - kant - h) continue;
            if (iVann(S.mx(c[0]), S.my(c[1]))) continue;
            if (ut.some((o) => Math.hypot(o.x - c[0], o.y - c[1]) < (o.w + w) / 2 + 14 * f)) continue;
            let vinkel = (Math.atan2(b[1] - a[1], b[0] - a[0]) * 180) / Math.PI;
            if (vinkel > 90) vinkel -= 180;
            if (vinkel <= -90) vinkel += 180;
            // Toppen av tallet skal peke oppover i terrenget
            const r = (vinkel * Math.PI) / 180;
            const ux = Math.sin(r);
            const uy = -Math.cos(r);
            const d = (tallPx * 1.2) / S.k;
            const zOpp = hoydeVed(felt, S.mx(c[0]) + ux * d, S.my(c[1]) + uy * d);
            const zNed = hoydeVed(felt, S.mx(c[0]) - ux * d, S.my(c[1]) - uy * d);
            if (terrengRetning && zOpp !== null && zNed !== null && zOpp < zNed) vinkel += 180;
            ut.push({ x: c[0], y: c[1], vinkel, tekst, w, h });
            break;
          }
        }
      }
    }
    return ut;
  }, [grunn, visKotetall, tallPx, innsjoer, terrengRetning]);

  // Elver
  const elver = (props.elver ?? []).map((elv, i) => {
    let pts: Kartpunkt[] = elv.punkter ? [...elv.punkter] : elv.fra ? flytvei(felt, elv.fra) : [];
    if (!elv.punkter && hav !== null) {
      const stopp = pts.findIndex((p) => {
        const zz = hoydeVed(felt, p[0], p[1]);
        return zz !== null && zz <= hav + 0.05;
      });
      if (stopp > 0) pts = pts.slice(0, stopp + 1);
    }
    const px = pts.map(S.punkt);
    const [w0, w1] = elv.bredde ?? [1.3, 3.6];
    const deler = Math.min(5, Math.max(1, Math.floor(px.length / 6)));
    const biter: { d: string; w: number }[] = [];
    for (let d = 0; d < deler; d++) {
      const a = Math.floor((d * (px.length - 1)) / deler);
      const b = Math.floor(((d + 1) * (px.length - 1)) / deler);
      const t = deler === 1 ? 0.5 : d / (deler - 1);
      biter.push({ d: glattSti(px.slice(a, b + 1)), w: (w0 + (w1 - w0) * t) * ss });
    }
    return { biter, navn: elv.navn, midt: px[Math.floor(px.length * 0.55)] ?? null, retning: px, key: i };
  });

  // Vannskiller
  const vannskiller = useMemo(
    () =>
      (props.vannskiller ?? []).map((vs) => {
        const nf = vannskille(felt, vs.utlop);
        if (!nf) return null;
        return {
          grense: nf.grense.map((l) => glattSti(l.punkter.map(S.punkt), l.lukket)).join(''),
          omriss: nf.omriss.map((l) => glattSti(l.punkter.map(S.punkt), true)).join(''),
          utlop: S.punkt(nf.utlop),
          midt: midtpunkt(nf.omriss.map((l) => l.punkter)),
          vs,
        };
      }),
    [felt, JSON.stringify(props.vannskiller ?? []), S.x0, S.y0, S.w],
  );

  // Soner
  const soner = (props.soner ?? []).map((sone) => {
    let ringer: P[][] = [];
    if (sone.punkter && sone.punkter.length > 2) ringer = [sone.punkter.map((p) => [p[0], p[1]] as P)];
    else if (sone.verdi) {
      const v = new Array<number>(felt.nx * felt.ny);
      for (let j = 0; j < felt.ny; j++)
        for (let i = 0; i < felt.nx; i++) {
          const r = sone.verdi(i * felt.celle, j * felt.celle, felt.z[j * felt.nx + i]!);
          v[j * felt.nx + i] = Number.isFinite(r) ? (r > 0 ? r : Math.min(r, -1e-9)) : -1;
        }
      ringer = omrader(felt, v);
    }
    const d = sone.punkter ? ringer.map((r) => `M${r.map((p) => S.punkt(p).join(' ')).join('L')}Z`).join('') : ringer.map((r) => glattSti(r.map(S.punkt), true)).join('');
    const midt = sone.etikett ? ([sone.etikett[0], sone.etikett[1]] as P) : midtpunkt(ringer);
    return { sone, d, midt };
  });

  const W = S.w;
  const Hh = S.h;
  const klipp = `${id}-klipp`;
  const landKlipp = `${id}-land`;
  const maske = `${id}-maske`;
  const havFyll = mix(SCENE.waterLight, VIZ.surface, 0.42);
  const vannLinje = mix(SCENE.water, VIZ.ink, 0.22);
  const papir = mix(VIZ.surface, GEO.hoydelag[2]!, 0.28);
  const etikettEl: ReactNode[] = [];
  const dempet = props.dempet === true;

  // Målestokk og nordpil
  const skala = skalastokk(1 / S.k, Math.min(W * 0.3, 210 * f));
  const msTall = typeof props.maalestokk === 'number' ? props.maalestokk : null;
  const visMs = props.maalestokk !== false && skala !== null;
  const visEkv = (props.visEkvidistanse ?? true) && grunn.alle.length > 0;
  const linjer: string[] = [];
  if (msTall !== null) linjer.push(`Målestokk ${maalestokkTekst(msTall)}`);
  if (visEkv) linjer.push(`Ekvidistanse ${fmt(ekv, Number.isInteger(ekv) ? 0 : 1)} m`);
  const msPx = 17 * 0.68 * f;
  const msB = visMs ? Math.max(skala!.enheter + tekstBredde(skala!.tekst, msPx) / 2 + 8, ...linjer.map((l) => tekstBredde(l, msPx))) + 20 : 0;
  const msH = visMs ? 14 * k + msPx * 1.3 + linjer.length * msPx * 1.25 + 14 : 0;

  return (
    <g>
      <defs>
        <clipPath id={klipp}>
          <rect x={S.x0} y={S.y0} width={W} height={Hh} />
        </clipPath>
        {grunn.land && (
          <clipPath id={landKlipp}>
            <path d={grunn.land} clipRule="evenodd" />
          </clipPath>
        )}
        {kotetall.length > 0 && (
          <mask id={maske} maskUnits="userSpaceOnUse" x={S.x0} y={S.y0} width={W} height={Hh}>
            <rect x={S.x0} y={S.y0} width={W} height={Hh} fill="white" />
            {kotetall.map((t, i) => (
              <rect key={i} x={-t.w / 2} y={-t.h / 2} width={t.w} height={t.h} rx={2} fill="black" transform={`translate(${t.x} ${t.y}) rotate(${t.vinkel})`} />
            ))}
          </mask>
        )}
        {soner.map(({ sone }, i) =>
          sone.skravur ? (
            <pattern key={i} id={`${id}-skr${i}`} patternUnits="userSpaceOnUse" width={9 * k} height={9 * k} patternTransform="rotate(45)">
              <line x1={0} y1={0} x2={0} y2={9 * k} stroke={sone.farge} strokeWidth={2 * ss} />
            </pattern>
          ) : null,
        )}
      </defs>
      <g clipPath={`url(#${klipp})`}>
        {/* Grunnkart: hav, høydelag, relieff og koter */}
        <g opacity={dempet ? 0.55 : 1}>
          {hav !== null && <rect x={S.x0} y={S.y0} width={W} height={Hh} fill={havFyll} />}
          {grunn.land && <path d={grunn.land} fill="none" stroke={alpha(SCENE.waterLight, 0.55)} strokeWidth={12 * ss} strokeLinejoin="round" />}
          {lagValg === false ? (
            <path d={grunn.land ?? `M${S.x0} ${S.y0}h${W}v${Hh}h${-W}Z`} fill={papir} fillRule="evenodd" />
          ) : (
            grunn.lagStier.map((l, i) => (l.d ? <path key={i} d={l.d} fill={l.farge} fillRule="evenodd" /> : null))
          )}
          <g clipPath={grunn.land ? `url(#${landKlipp})` : undefined}>
            {grunn.skygge.map((s, i) => (
              <path key={i} d={s.d} fill={s.mork ? SCENE.shadow : SCENE.highlight} fillOpacity={s.styrke} fillRule="evenodd" />
            ))}
          </g>
          <g mask={kotetall.length > 0 ? `url(#${maske})` : undefined}>
            <path d={grunn.tynne} fill="none" stroke={GEO.kote} strokeWidth={0.95 * ss} strokeLinejoin="round" opacity={0.9} />
            <path d={grunn.tykke} fill="none" stroke={GEO.kote} strokeWidth={1.9 * ss} strokeLinejoin="round" />
          </g>
          {kotetall.map((t, i) => (
            <g key={i} transform={`translate(${t.x} ${t.y}) rotate(${t.vinkel})`}>
              <text x={0} y={tallPx * 0.36} textAnchor="middle" style={{ fontSize: tallPx, fontWeight: 650, fill: GEO.kote }}>
                {t.tekst}
              </text>
            </g>
          ))}
        </g>
        {/* Vann */}
        {elver.map((e) => (
          <g key={e.key}>
            {e.biter.map((b, j) => (
              <path key={j} d={b.d} fill="none" stroke={vannLinje} strokeWidth={b.w} strokeLinecap="round" strokeLinejoin="round" />
            ))}
          </g>
        ))}
        {innsjoer.map((sj, i) =>
          sj ? <path key={i} d={sj.d} fill={havFyll} fillRule="evenodd" stroke={vannLinje} strokeWidth={1.4 * ss} strokeLinejoin="round" /> : null,
        )}
        {grunn.land && <path d={grunn.land} fill="none" stroke={vannLinje} strokeWidth={1.4 * ss} strokeLinejoin="round" />}
        {/* Soner og vannskiller */}
        {soner.map(({ sone, d }, i) =>
          d ? (
            <g key={i}>
              <path d={d} fill={sone.farge} fillOpacity={sone.fyll ?? 0.32} fillRule="evenodd" />
              {sone.skravur && <path d={d} fill={`url(#${id}-skr${i})`} fillRule="evenodd" opacity={0.75} />}
              {sone.kant !== 'ingen' && (
                <path
                  d={d}
                  fill="none"
                  stroke={sone.farge}
                  strokeWidth={2 * ss}
                  strokeDasharray={sone.kant === 'stiplet' ? `${7 * ss} ${5 * ss}` : undefined}
                  strokeLinejoin="round"
                />
              )}
            </g>
          ) : null,
        )}
        {vannskiller.map((v, i) =>
          v ? (
            <g key={i}>
              {v.vs.fyll !== false && <path d={v.omriss} fill={v.vs.farge ?? GEO.vannskille} fillOpacity={0.12} fillRule="evenodd" />}
              <path d={v.grense} fill="none" stroke={VIZ.surface} strokeWidth={5 * ss} strokeLinecap="round" strokeLinejoin="round" opacity={0.7} />
              <path
                d={v.grense}
                fill="none"
                stroke={v.vs.farge ?? GEO.vannskille}
                strokeWidth={2.6 * ss}
                strokeDasharray={`${9 * ss} ${5 * ss}`}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              {v.vs.utlopMerke !== false && (
                <circle cx={v.utlop[0]} cy={v.utlop[1]} r={5 * k} fill={v.vs.farge ?? GEO.vannskille} stroke={VIZ.surface} strokeWidth={1.6 * ss} />
              )}
            </g>
          ) : null,
        )}
        {props.children?.(S)}
      </g>

      {/* Profillinje og merker (over alt, ikke klippet) */}
      {props.profil && <Profillinje profil={props.profil} S={S} />}
      {(props.merker ?? []).map((m, i) => (
        <Merke key={i} merke={m} S={S} felt={felt} />
      ))}

      {/* Navn på innsjøer, elver, soner og vannskiller */}
      {(() => {
        innsjoer.forEach((sj, i) => {
          if (sj?.navn && sj.midt) {
            const [x, y] = S.punkt(sj.midt);
            etikettEl.push(
              <Txt key={`sj${i}`} x={x} y={y + 5 * f} size={0.7} color={vannLinje} weight={650}>
                {sj.navn}
              </Txt>,
            );
          }
        });
        elver.forEach((e) => {
          if (e.navn && e.midt) {
            const w = tekstBredde(e.navn, 17 * 0.68 * f);
            const hoyre = e.midt[0] + 10 + w <= S.x0 + S.w - 6;
            etikettEl.push(
              <Txt key={`elv${e.key}`} x={hoyre ? e.midt[0] + 10 : e.midt[0] - 10} y={e.midt[1] - 6} anchor={hoyre ? 'start' : 'end'} size={0.68} color={vannLinje} weight={650}>
                {e.navn}
              </Txt>,
            );
          }
        });
        soner.forEach(({ sone, midt }, i) => {
          if (sone.navn && midt) {
            const [x, y] = S.punkt(midt);
            etikettEl.push(
              <Txt key={`sone${i}`} x={x} y={y + 5 * f} size={0.74} weight={700} color={shade(sone.farge, 0.25)}>
                {sone.navn}
              </Txt>,
            );
          }
        });
        vannskiller.forEach((v, i) => {
          if (v?.vs.navn && v.midt) {
            const [x, y] = S.punkt(v.midt);
            etikettEl.push(
              <Txt key={`vs${i}`} x={x} y={y + 5 * f} size={0.76} weight={700} color={v.vs.farge ?? GEO.vannskille}>
                {v.vs.navn}
              </Txt>,
            );
          }
        });
        return etikettEl;
      })()}

      {/* Ramme, nordpil og målestokk */}
      <rect x={S.x0} y={S.y0} width={W} height={Hh} fill="none" stroke={VIZ.ink} strokeWidth={1.4 * ss} opacity={0.8} />
      {props.nordpil !== false && <Nordpil x={S.x0 + W - 26 * k} y={S.y0 + 14 * f} />}
      {visMs && skala && (
        <g>
          <rect x={S.x0 + 8} y={S.y0 + Hh - 8 - msH} width={msB} height={msH} rx={6} fill={alpha(VIZ.surface, 0.85)} stroke={alpha(VIZ.ink, 0.25)} strokeWidth={1} />
          <Skalastokk x={S.x0 + 18} y={S.y0 + Hh - 8 - msH + 10 + msPx * 1.3} lengde={skala.enheter} tekst={skala.tekst} h={7 * k} />
          {linjer.map((l, i) => (
            <Txt key={l} x={S.x0 + 18} y={S.y0 + Hh - 8 - msH + 10 + msPx * 1.3 + 7 * k + 8 + msPx * 1.05 + i * msPx * 1.25} anchor="start" size={0.68} muted>
              {l}
            </Txt>
          ))}
        </g>
      )}
    </g>
  );
}

/** Målestokklinje i to felt (svart og hvitt) med «0» og lengden, f.eks. «500 m». (x, y) er venstre ende av linja. */
function Skalastokk({ x, y, lengde, tekst, h }: { x: number; y: number; lengde: number; tekst: string; h: number }) {
  const ss = useGeoStroke();
  const halv = lengde / 2;
  return (
    <g>
      <rect x={x} y={y} width={halv} height={h} fill={VIZ.ink} />
      <rect x={x + halv} y={y} width={halv} height={h} fill={VIZ.surface} />
      <rect x={x} y={y} width={lengde} height={h} fill="none" stroke={VIZ.ink} strokeWidth={1.2 * ss} />
      <Txt x={x} y={y - 5} size={0.68} anchor="middle">
        0
      </Txt>
      <Txt x={x + lengde} y={y - 5} size={0.68} anchor="middle">
        {tekst}
      </Txt>
    </g>
  );
}

/** Nordpil: smal pil med «N» over, på en lys rund plate. (x, y) er toppen av «N». */
function Nordpil({ x, y }: { x: number; y: number }) {
  const k = useGeoScale();
  const ss = useGeoStroke();
  const f = useTextScale();
  const L = 30 * k;
  const b = 7 * k;
  const top = y + 17 * 0.8 * f * 0.35 + 6;
  return (
    <g>
      <rect x={x - 16 * k} y={y - 17 * 0.8 * f * 0.85} width={32 * k} height={top + L + 6 - (y - 17 * 0.8 * f * 0.85)} rx={8} fill={alpha(VIZ.surface, 0.82)} />
      <polygon points={`${x},${top} ${x + b},${top + L} ${x},${top + L * 0.74}`} fill={VIZ.ink} />
      <polygon points={`${x},${top} ${x - b},${top + L} ${x},${top + L * 0.74}`} fill={VIZ.surface} stroke={VIZ.ink} strokeWidth={1.2 * ss} strokeLinejoin="round" />
      <Txt x={x} y={y + 17 * 0.8 * f * 0.1} size={0.8} weight={750} halo={false}>
        N
      </Txt>
    </g>
  );
}

function Profillinje({ profil, S }: { profil: KartProfil; S: KartSkala }) {
  const ss = useGeoStroke();
  const k = useGeoScale();
  const f = useTextScale();
  const [ax, ay] = S.punkt(profil.A);
  const [bx, by] = S.punkt(profil.B);
  const L = Math.hypot(bx - ax, by - ay);
  if (!Number.isFinite(L) || L < 1) return null;
  const ux = (bx - ax) / L;
  const uy = (by - ay) / L;
  const farge = profil.farge ?? VIZ.ink;
  const [na, nb] = profil.navn ?? ['A', 'B'];
  const off = 15 * f;
  return (
    <g>
      <line x1={ax} y1={ay} x2={bx} y2={by} stroke={VIZ.surface} strokeWidth={5.5 * ss} strokeLinecap="round" opacity={0.85} />
      <line x1={ax} y1={ay} x2={bx} y2={by} stroke={farge} strokeWidth={2.4 * ss} strokeLinecap="round" />
      <circle cx={ax} cy={ay} r={4.5 * k} fill={farge} stroke={VIZ.surface} strokeWidth={1.5 * ss} />
      <circle cx={bx} cy={by} r={4.5 * k} fill={farge} stroke={VIZ.surface} strokeWidth={1.5 * ss} />
      <Txt x={ax - ux * off} y={ay - uy * off + 6 * f} size={0.92} weight={750} color={farge}>
        {na}
      </Txt>
      <Txt x={bx + ux * off} y={by + uy * off + 6 * f} size={0.92} weight={750} color={farge}>
        {nb}
      </Txt>
    </g>
  );
}

function Merke({ merke, S, felt }: { merke: KartMerke; S: KartSkala; felt: Hoydefelt }) {
  const k = useGeoScale();
  const ss = useGeoStroke();
  const f = useTextScale();
  const [x, y] = S.punkt(merke.p);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  const sym = merke.symbol ?? 'punkt';
  const farge = merke.farge ?? (sym === 'bronn' ? mix(SCENE.water, VIZ.ink, 0.22) : VIZ.ink);
  const z = hoydeVed(felt, merke.p[0], merke.p[1]);
  const visHoyde = merke.hoyde ?? sym === 'topp';
  const deler = [merke.navn, visHoyde && z !== null ? fmt(z, 0).replace(/\s/g, '') : undefined].filter(Boolean) as string[];
  const tekst = deler.join(' ');
  const tPx = 17 * 0.72 * f;
  const venstre = x + 10 * k + tekstBredde(tekst, tPx) > S.x0 + S.w - 4;
  const r = 5 * k;
  let symbol: ReactNode;
  switch (sym) {
    case 'topp':
      symbol = <polygon points={`${x},${y - r * 1.15} ${x + r},${y + r * 0.7} ${x - r},${y + r * 0.7}`} fill={farge} stroke={VIZ.surface} strokeWidth={1.3 * ss} strokeLinejoin="round" />;
      break;
    case 'hus':
      symbol = <rect x={x - r * 0.75} y={y - r * 0.75} width={r * 1.5} height={r * 1.5} fill={farge} stroke={VIZ.surface} strokeWidth={1.2 * ss} />;
      break;
    case 'bronn':
      symbol = (
        <g>
          <circle cx={x} cy={y} r={r} fill={VIZ.surface} stroke={farge} strokeWidth={2 * ss} />
          <circle cx={x} cy={y} r={r * 0.4} fill={farge} />
        </g>
      );
      break;
    case 'kryss':
      symbol = (
        <g stroke={farge} strokeWidth={2.4 * ss} strokeLinecap="round">
          <line x1={x - r} y1={y - r} x2={x + r} y2={y + r} />
          <line x1={x - r} y1={y + r} x2={x + r} y2={y - r} />
        </g>
      );
      break;
    default:
      symbol = <circle cx={x} cy={y} r={r * 0.85} fill={farge} stroke={VIZ.surface} strokeWidth={1.4 * ss} />;
  }
  return (
    <g>
      {symbol}
      {tekst && (
        <Txt x={venstre ? x - 9 * k : x + 9 * k} y={y + tPx * 0.36} anchor={venstre ? 'end' : 'start'} size={0.72} weight={650} color={merke.farge}>
          {tekst}
        </Txt>
      )}
    </g>
  );
}

/* ================================================================================================ Profildiagram */

export interface ProfildiagramProps {
  felt: Hoydefelt;
  /** Start- og sluttpunktet på kartet (meter), som `profil` i `Kotekart`. */
  A: Kartpunkt;
  B: Kartpunkt;
  /** Bredde (standard 800) og høyde (standard `geoHoyde(f, 260)`). */
  width?: number;
  height?: number;
  at?: readonly [number, number];
  /** Overhøyde: hvor mange ganger høydene er forstørret i forhold til lengdene (1 = riktige forhold). Standard: fyller høyden, og overhøyden skrives. */
  overhoyde?: number | null;
  /** Navnene i endene (standard A og B). */
  navn?: readonly [string, string];
  /** Havnivå (m o.h.): havet under profilet tegnes som vann. */
  hav?: number | null;
  /** Skriv overhøyden øverst til høyre (standard på). */
  visOverhoyde?: boolean;
  /** Ekstra tegning med skalaene (avstand i meter: `sx`, høyde i m o.h.: `sy`). */
  children?: (s: LogPlotSkalaer) => ReactNode;
}

/**
 * Terrengprofilet langs linja A–B i et høydefelt (`terrengprofil` i kart.ts): avstand langs bakken (m eller km) mot høyde
 * (m o.h.), med terrenget fylt og havet som vann. Med `overhoyde` blir høydeaksen strukket nøyaktig så mange ganger i
 * forhold til avstandsaksen (1 = riktige forhold), og overhøyden skrives i hjørnet, så eleven ser hvor mye profilet
 * overdriver. Bygd på `LogPlot` med lineære akser; barna får skalaene (`sx` i meter langs profilet).
 */
export function Profildiagram({ felt, A, B, width = 800, height, at, overhoyde = null, navn = ['A', 'B'], hav = null, visOverhoyde = true, children }: ProfildiagramProps) {
  const f = useTextScale();
  const ss = useGeoStroke();
  const gid = useSvgId('profil');
  const H = height ?? geoHoyde(f, 260);
  const prof = terrengprofil(felt, A, B, 160);
  const L = prof.length ? prof[prof.length - 1]!.s : 0;
  const km = L >= 2000;
  const zs = prof.map((p) => p.z);
  const zMin = zs.length ? Math.min(...zs, hav ?? Infinity) : 0;
  const zMax = zs.length ? Math.max(...zs) : 1;
  const tickPx = 15 * f;
  const titlePx = 15.6 * f;
  // Faste marger, så overhøyden blir nøyaktig
  const topp = 20 * f + titlePx * 1.2;
  const bunn = 22 * f + 10 + titlePx * 1.1;
  const venstre = titlePx * 1.25 + 14 + tekstBredde(fmt(Math.max(Math.abs(zMax), Math.abs(zMin)) * 1.3, 0).replace(/\s/g, '') + '0', tickPx) + 10;
  const hoyre = 30 * f;
  const plotB = Math.max(10, width - venstre - hoyre);
  const plotH = Math.max(10, H - topp - bunn);
  let yLo: number;
  let yHi: number;
  const oh = overhoyde !== null && Number.isFinite(overhoyde) && overhoyde > 0 ? overhoyde : null;
  if (oh !== null && L > 0) {
    const span = plotH / ((plotB / L) * oh);
    const midt = (zMin + zMax) / 2;
    yLo = Math.max(Math.min(zMin, hav ?? zMin) - span * 0.08, midt - span / 2);
    if (zMin >= 0 && yLo < 0 && span > zMax) yLo = Math.min(0, zMin);
    yHi = yLo + span;
  } else {
    const pad = (zMax - zMin) * 0.12 || 10;
    yLo = zMin >= 0 && zMin - pad * 2 < 0 ? 0 : zMin - pad;
    yHi = zMax + pad;
  }
  const faktisk = L > 0 && yHi > yLo ? plotH / (yHi - yLo) / (plotB / L) : NaN;
  const ohTekst = oh !== null ? `Overhøyde ${fmt(oh, oh < 10 && !Number.isInteger(oh) ? 1 : 0)} ×` : `Overhøyde ca. ${fmt(faktisk, faktisk < 10 ? 1 : 0)} ×`;
  const pts: [number, number][] = prof.map((p) => [p.s, p.z]);
  return (
    <LogPlot
      at={at}
      width={width}
      height={H}
      margin={{ top: topp, bottom: bunn, left: venstre, right: hoyre }}
      x={{ min: 0, max: Math.max(L, 1), label: km ? 'Avstand (km)' : 'Avstand (m)', format: km ? kmTekst : undefined }}
      y={{ min: yLo, max: yHi, label: 'Høyde (m o.h.)' }}
    >
      {(s) => {
        const { sx, sy, y0, x0, x1, y1, clip } = s;
        const linje = pts.map(([a, b]) => `${sx(a).toFixed(2)},${sy(b).toFixed(2)}`);
        const flate = pts.length > 1 ? `M${sx(0)},${y0 + 2}L${linje.join('L')}L${sx(L)},${y0 + 2}Z` : '';
        const havY = hav !== null && Number.isFinite(hav) ? sy(hav) : null;
        return (
          <g>
            <LinearGradient
              id={gid}
              stops={[
                [0, GEO.hoydelag[1]!],
                [0.55, GEO.hoydelag[3]!],
                [1, shade(GEO.hoydelag[4]!, 0.12)],
              ]}
            />
            <g clipPath={clip}>
              {havY !== null && havY < y0 && <rect x={x0} y={Math.max(y1, havY)} width={x1 - x0} height={y0 - Math.max(y1, havY)} fill={mix(SCENE.waterLight, VIZ.surface, 0.35)} />}
              {flate && <path d={flate} fill={`url(#${gid})`} />}
              {havY !== null && havY < y0 && havY > y1 && <line x1={x0} x2={x1} y1={havY} y2={havY} stroke={mix(SCENE.water, VIZ.ink, 0.22)} strokeWidth={1.4 * ss} />}
              {pts.length > 1 && <path d={`M${linje.join('L')}`} fill="none" stroke={VIZ.ink} strokeWidth={2.4 * ss} strokeLinejoin="round" />}
            </g>
            {pts.length > 1 && (
              <g>
                <Txt x={sx(0) + 4} y={y1 - 8} anchor="start" size={0.92} weight={750} halo>
                  {navn[0]}
                </Txt>
                <Txt x={sx(L) - 4} y={y1 - 8} anchor="end" size={0.92} weight={750} halo>
                  {navn[1]}
                </Txt>
              </g>
            )}
            {visOverhoyde && Number.isFinite(faktisk) && (
              <Txt x={(x0 + x1) / 2} y={y1 - 8} size={0.72} muted>
                {ohTekst}
              </Txt>
            )}
            {children?.(s)}
          </g>
        );
      }}
    </LogPlot>
  );
}

/** Meter som km med så få desimaler som trengs: 1500 → «1,5», 2000 → «2». */
function kmTekst(m: number): string {
  const km = m / 1000;
  const d = Math.abs(km - Math.round(km)) < 1e-9 ? 0 : Math.abs(km * 10 - Math.round(km * 10)) < 1e-9 ? 1 : 2;
  return fmt(km, d);
}
