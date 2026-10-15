/**
 * Kart for geofag: `Kotekart` tegner et høydefelt fra kart.ts som et topografisk kart (høydelag, relieffskygge, koter med
 * kotetall, hav, innsjøer, elver, vannskille, soner, merker, profillinje, nordpil og målestokk), og `Profildiagram`
 * tegner terrengprofilet langs en linje med valgfri overhøyde. Hjelpere: `kartSkala` (meter → figur), `ekvidistanseFor`,
 * `hoydelagFor` (til en tegnforklaring), `glattSti` (glatt kurve gjennom punkter) og `jevnLinje` (fjerner trappetrinn).
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
import { fmtTall } from './akser';

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

/**
 * Jevner ut en linje med glidende middel (vektene 1, 2, 1), `runder` ganger, så trappetrinnene fra et rutenett (elver
 * fra `flytvei`, vannskiller) blir myke kurver. Endepunktene i en åpen linje ligger fast; en lukket linje jevnes rundt.
 * Ugyldige punkter fjernes.
 */
export function jevnLinje(punkter: readonly (readonly [number, number])[], lukket = false, runder = 3): [number, number][] {
  let p: [number, number][] = punkter.filter((q) => Number.isFinite(q[0]) && Number.isFinite(q[1])).map((q) => [q[0], q[1]]);
  const n = p.length;
  if (n < 3) return p;
  for (let r = 0; r < Math.max(0, Math.round(runder)); r++) {
    p = p.map((q, i) => {
      if (!lukket && (i === 0 || i === n - 1)) return q;
      const a = p[(i - 1 + n) % n]!;
      const b = p[(i + 1) % n]!;
      return [(a[0] + 2 * q[0] + b[0]) / 4, (a[1] + 2 * q[1] + b[1]) / 4];
    });
  }
  return p;
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
 * Innsjøen rundt et punkt (samme som `Kotekart` og `Profildiagram` tegner): gitterpunktene i høydefeltet under
 * vannstanden som henger sammen med punktet (4-naboer), som en maske i samme rekkefølge som `felt.z` (indeks j · nx + i),
 * og den faktiske vannstanden. Renner vannet ut av kartet eller i havet ved den vannstanden, senkes den til like under
 * terskelen (der vannet ville rent over), så innsjøen aldri flyter ut over landskapet. Null når punktet ligger over
 * vannstanden eller tallene er ugyldige.
 *   const sjo = innsjoMaske(felt, [900, 600], 210, null);   // sjo.maske[j * felt.nx + i], sjo.niva
 */
export function innsjoMaske(felt: Hoydefelt, punkt: Kartpunkt, niva: number, hav: number | null = null): { maske: boolean[]; niva: number } | null {
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
  /**
   * Hvor navnet står ved merket. Standard: den første siden av høyre, venstre, over og under der det ikke dekker andre
   * navn, profilendene, profillinja, nordpila eller målestokken.
   */
  navnSide?: 'hoyre' | 'venstre' | 'over' | 'under';
}

/** Profillinja A–B på kartet (samme punkter som `Profildiagram`). */
export interface KartProfil {
  A: Kartpunkt;
  B: Kartpunkt;
  navn?: readonly [string, string];
  farge?: string;
}

/** Props til `Kotekart`: høydefeltet, plassen i figuren og det som skal tegnes på kartet. */
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
  /**
   * Ekstra tegning oppå kartet (klippet til kartet), med skalaen fra meter til figuren og det kartet har regnet ut:
   * kotene (`koter` fra kart.ts med ekvidistansen), og flatene navn, merker, profilender, nordpil og målestokk tar.
   */
  children?: (s: KartSkala, kart: KotekartInfo) => ReactNode;
}

/** Det `Kotekart` gir til barna: kotene, ekvidistansen og hvor tekst og symboler står (figurens koordinater). */
export interface KotekartInfo {
  koter: readonly Kote[];
  ekvidistanse: number;
  opptatt: readonly { x0: number; y0: number; x1: number; y1: number }[];
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
 * arealbruk), merker (topper med høyde, hus, brønner), profillinje A–B, nordpil og målestokk med ekvidistanse. Øvre
 * venstre hjørne er (x, y), og høyden er `width · lengde / bredde`. Tekst og symboler vokser på mobil; kotetallene holder
 * seg unna navn, merker, nordpila og målestokken, og elvenavnene står der elva ikke deler løp med en annen elv:
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

  // Relieffskyggen regnes bare ut når feltet, havet eller plassen endres (ikke når ekvidistansen byttes)
  const skygge = useMemo(() => {
    const { nx, ny, celle, z } = felt;
    const N = nx * ny;
    const tilSti = ringSti(S, celle);
    const landGrense = hav !== null ? hav + 0.05 : -Infinity;
    const skygge: { d: string; mork: boolean; styrke: number }[] = [];
    if (!relieff || !(felt.max > felt.min)) return skygge;
    {
      // Relieffskygge: hvor mye hver flate vender mot lyset fra nordvest
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
    return skygge;
  }, [felt, hav, relieff, S.x0, S.y0, S.w]);

  // Grunnkartet: land, høydelag og koter (regnes bare ut når feltet eller valgene endres)
  const grunn = useMemo(() => {
    const { z } = felt;
    const tilSti = ringSti(S, felt.celle);
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
  }, [felt, ekv, hoved, hav, lagNokkel, skygge, S.x0, S.y0, S.w]);

  // Innsjøer
  const innsjoer = useMemo(
    () =>
      (props.innsjoer ?? []).map((sj) => {
        const sjo = innsjoMaske(felt, sj.punkt, sj.niva, hav);
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

  // Elver: fra kilden og nedover (flytvei, jevnet ut og stoppet ved havet eller kartkanten) eller langs egne punkter
  const elver = (props.elver ?? []).map((elv, i) => {
    let pts: [number, number][] = elv.punkter ? elv.punkter.map((p) => [p[0], p[1]]) : elv.fra ? flytvei(felt, elv.fra) : [];
    if (!elv.punkter && pts.length > 1) {
      // Stopp der elva når havet, eller kartkanten etter å ha vært inne på kartet (ikke la den renne langs kanten)
      let inne = false;
      const stopp = pts.findIndex((p) => {
        const ii = Math.round(p[0] / felt.celle);
        const jj = Math.round(p[1] / felt.celle);
        const kant = ii <= 0 || jj <= 0 || ii >= felt.nx - 1 || jj >= felt.ny - 1;
        if (kant && inne) return true;
        if (!kant) inne = true;
        const zz = hoydeVed(felt, p[0], p[1]);
        return inne && hav !== null && zz !== null && zz <= hav + 0.05;
      });
      if (stopp > 0) pts = pts.slice(0, stopp + 1);
      pts = jevnLinje(pts, false, 3);
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
    return { biter, navn: elv.navn, px, key: i };
  });

  // Vannskiller (grensen jevnet ut, så trappetrinnene fra rutenettet blir borte)
  const vannskiller = useMemo(
    () =>
      (props.vannskiller ?? []).map((vs) => {
        const nf = vannskille(felt, vs.utlop);
        if (!nf) return null;
        return {
          grense: nf.grense.map((l) => glattSti(jevnLinje(l.punkter, l.lukket, 2).map(S.punkt), l.lukket)).join(''),
          omriss: nf.omriss.map((l) => glattSti(jevnLinje(l.punkter, true, 2).map(S.punkt), true)).join(''),
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
  const nordX = S.x0 + W - 26 * k;
  const nordY = S.y0 + 14 * f;
  const nordBoks: Boks | null = props.nordpil !== false ? nordpilBoks(nordX, nordY, f, k) : null;

  // Profillinja: et hinder for alle navn
  const profilSeg = props.profil ? ([S.punkt(props.profil.A), S.punkt(props.profil.B)] as const) : null;
  const paaProfil = (b: Boks) => (profilSeg ? boksKrysserStrek(b, profilSeg[0], profilSeg[1], 3 * ss) : false);
  const merkeSymboler: Boks[] = (props.merker ?? []).flatMap((m) => {
    const [mx, my] = S.punkt(m.p);
    const r = 5 * k;
    return Number.isFinite(mx) && Number.isFinite(my) ? [[mx - r - 2, my - r * 1.2 - 2, mx + r + 2, my + r + 2] as Boks] : [];
  });

  // Målestokken i det første ledige hjørnet: nede til venstre, nede til høyre eller oppe til venstre (nordpila står
  // oppe til høyre), så profilendene og merkene ikke havner under den
  const profilEnder: Boks[] = profilSeg ? profilSeg.map(([px, py]) => [px - 26 * f, py - 26 * f, px + 26 * f, py + 26 * f] as Boks) : [];
  const msKandidater: Boks[] = [
    [S.x0 + 8, S.y0 + Hh - 8 - msH, S.x0 + 8 + msB, S.y0 + Hh - 8],
    [S.x0 + W - 8 - msB, S.y0 + Hh - 8 - msH, S.x0 + W - 8, S.y0 + Hh - 8],
    [S.x0 + 8, S.y0 + 8, S.x0 + 8 + msB, S.y0 + 8 + msH],
  ];
  const msBoks: Boks | null = visMs
    ? (msKandidater.find((b) => !paaProfil(b) && ![...profilEnder, ...merkeSymboler].some((o) => overlapp(b, o))) ?? msKandidater[0]!)
    : null;

  // Navn og etiketter plasseres i rekkefølge; alt som er plassert, er hinder for det neste
  const hindre: Boks[] = [...merkeSymboler];
  if (nordBoks) hindre.push(nordBoks);
  if (msBoks) hindre.push(msBoks);
  const innenfor = (b: Boks) => b[0] >= S.x0 + 4 && b[2] <= S.x0 + W - 4 && b[1] >= S.y0 + 4 && b[3] <= S.y0 + Hh - 4;
  const ledig = (b: Boks, medProfil = true) => innenfor(b) && !hindre.some((o) => overlapp(b, o)) && !(medProfil && paaProfil(b));

  // 1) A og B: på forlengelsen av linja, ellers vinkelrett på den eller innover, alltid inne i kartet
  const profilTekst = props.profil ? profilEtiketter(props.profil, S, f, k, (b) => ledig(b, false), innenfor) : null;
  if (profilTekst) for (const e of profilTekst) hindre.push(e.boks);

  // 2) Navnene ved merkene: valgt side, ellers den første ledige
  const merkePlasser = (props.merker ?? []).map((m) => {
    const o = merkePlass(m, S, felt, f, k, ledig);
    if (o?.tekstBoks) hindre.push(o.tekstBoks);
    return o;
  });

  // 3) Navn på innsjøer, elver, soner og vannskiller (før kotetallene, så tallene holder seg unna)
  const navn: Navnelapp[] = [];
  const nb = navnBoks(f);
  const legg = (kandidater: Navnelapp[], maa: boolean) => {
    const fri = kandidater.find((n) => ledig(nb(n)));
    const valgt = fri ?? (maa ? (kandidater.find((n) => innenfor(nb(n)) && !hindre.some((o) => overlapp(nb(n), o))) ?? kandidater[0]) : undefined);
    if (valgt) {
      navn.push(valgt);
      hindre.push(nb(valgt));
    }
  };
  const rundt = (x: number, y: number, px: number, w: number) =>
    [
      [0, 0],
      [0, -1.4 * px],
      [0, 1.4 * px],
      [-0.65 * w, 0],
      [0.65 * w, 0],
      [0, -2.8 * px],
      [0, 2.8 * px],
      [-0.65 * w, -1.4 * px],
      [0.65 * w, 1.4 * px],
    ].map(([dx, dy]) => [x + dx!, y + dy!] as const);
  innsjoer.forEach((sj, i) => {
    if (!sj?.navn || !sj.midt) return;
    const [x, y] = S.punkt(sj.midt);
    const px = 17 * 0.7 * f;
    const w = tekstBredde(sj.navn, px);
    legg(
      rundt(x, y + 5 * f, px, w).map(([cx, cy]) => ({ key: `sj${i}`, x: cx, y: cy, tekst: sj.navn!, size: 0.7, weight: 650, farge: vannLinje, anchor: 'middle' as const })),
      true,
    );
  });
  // Elvenavn: ved siden av elva der den ikke deler løp med en annen elv, innenfor kartet og ikke oppå et annet navn
  elver.forEach((e) => {
    if (!e.navn || e.px.length < 2) return;
    const andre = elver.filter((o) => o.key !== e.key).flatMap((o) => o.px);
    const kandidater: Navnelapp[] = [];
    for (const t of [0.45, 0.35, 0.55, 0.25, 0.65, 0.15, 0.75]) {
      const p = e.px[Math.floor((e.px.length - 1) * t)]!;
      if (andre.some((q) => Math.hypot(q[0] - p[0], q[1] - p[1]) < 30 * f)) continue;
      for (const [hoyre, dy] of [
        [true, -6],
        [false, -6],
        [true, 14 * f],
        [false, 14 * f],
      ] as const)
        kandidater.push({ key: `elv${e.key}`, x: hoyre ? p[0] + 10 : p[0] - 10, y: p[1] + dy, tekst: e.navn, size: 0.68, weight: 650, farge: vannLinje, anchor: hoyre ? 'start' : 'end' });
    }
    if (kandidater.length === 0) {
      const p = e.px[Math.floor((e.px.length - 1) * 0.5)]!;
      kandidater.push({ key: `elv${e.key}`, x: p[0] + 10, y: p[1] - 6, tekst: e.navn, size: 0.68, weight: 650, farge: vannLinje, anchor: 'start' });
    }
    legg(kandidater, true);
  });
  soner.forEach(({ sone, midt }, i) => {
    if (!sone.navn || !midt) return;
    const [x, y] = S.punkt(midt);
    const px = 17 * 0.74 * f;
    legg(
      rundt(x, y + 5 * f, px, tekstBredde(sone.navn, px)).map(([cx, cy]) => ({
        key: `sone${i}`,
        x: cx,
        y: cy,
        tekst: sone.navn!,
        size: 0.74,
        weight: 700,
        farge: mix(sone.farge, VIZ.ink, 0.35),
        anchor: 'middle' as const,
      })),
      true,
    );
  });
  // Navnet på et nedbørfelt sløyfes hvis det ikke får en ledig plass (feltet synes på fyllet og grensen)
  vannskiller.forEach((v, i) => {
    if (!v?.vs.navn || !v.midt) return;
    const [x, y] = S.punkt(v.midt);
    const px = 17 * 0.76 * f;
    legg(
      rundt(x, y + 5 * f, px, tekstBredde(v.vs.navn, px)).map(([cx, cy]) => ({
        key: `vs${i}`,
        x: cx,
        y: cy,
        tekst: v.vs.navn!,
        size: 0.76,
        weight: 700,
        farge: v.vs.farge ?? GEO.vannskille,
        anchor: 'middle' as const,
      })),
      false,
    );
  });

  // Alt kotetallene skal holde seg unna: navn, merker, profilendene, nordpila og målestokken
  const opptatt: Boks[] = [...hindre, ...profilEnder];
  const opptattNokkel = opptatt.map((b) => b.map((v) => Math.round(v)).join(',')).join(';');

  // Kotetall på tellekotene: rette strekninger, ikke i vann, ikke ved kanten og ikke oppå hverandre eller annen tekst
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
          for (const forskyv of [0, 0.12, -0.12, 0.24, -0.24, 0.36, -0.36]) {
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
            if (opptatt.some(([x0, y0, x1, y1]) => c[0] > x0 - w / 2 - 3 && c[0] < x1 + w / 2 + 3 && c[1] > y0 - h / 2 - 3 && c[1] < y1 + h / 2 + 3)) continue;
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
  }, [grunn, visKotetall, tallPx, innsjoer, terrengRetning, opptattNokkel]);

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
        {/* Soner og nedbørfelt under vannet, så elvene ligger øverst */}
        {soner.map(({ sone, d }, i) =>
          d ? (
            <g key={i}>
              <path d={d} fill={sone.farge} fillOpacity={sone.fyll ?? 0.28} fillRule="evenodd" />
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
          v && v.vs.fyll !== false ? <path key={i} d={v.omriss} fill={v.vs.farge ?? GEO.vannskille} fillOpacity={0.1} fillRule="evenodd" /> : null,
        )}
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
        {/* Vannskillene øverst */}
        {vannskiller.map((v, i) =>
          v ? (
            <g key={i}>
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
        {props.children?.(S, { koter: grunn.alle, ekvidistanse: ekv, opptatt: opptatt.map(([x0, y0, x1, y1]) => ({ x0, y0, x1, y1 })) })}
      </g>

      {/* Ramme, nordpil og målestokk, så profilendene, merkene og navnene står oppå */}
      <rect x={S.x0} y={S.y0} width={W} height={Hh} fill="none" stroke={VIZ.ink} strokeWidth={1.4 * ss} opacity={0.8} />
      {props.nordpil !== false && <Nordpil x={nordX} y={nordY} />}
      {visMs && skala && msBoks && (
        <g>
          <rect x={msBoks[0]} y={msBoks[1]} width={msB} height={msH} rx={6} fill={alpha(VIZ.surface, 0.85)} stroke={alpha(VIZ.ink, 0.25)} strokeWidth={1} />
          <Skalastokk x={msBoks[0] + 10} y={msBoks[1] + 10 + msPx * 1.3} lengde={skala.enheter} tekst={skala.tekst} h={7 * k} />
          {linjer.map((l, i) => (
            <Txt key={l} x={msBoks[0] + 10} y={msBoks[1] + 10 + msPx * 1.3 + 7 * k + 8 + msPx * 1.05 + i * msPx * 1.25} anchor="start" size={0.68} muted>
              {l}
            </Txt>
          ))}
        </g>
      )}

      {/* Profillinje og merker (over alt, ikke klippet) */}
      {props.profil && <Profillinje profil={props.profil} S={S} etiketter={profilTekst} />}
      {merkePlasser.map((o, i) => (o ? <Merke key={i} merke={(props.merker ?? [])[i]!} plass={o} /> : null))}

      {/* Navn på innsjøer, elver, soner og vannskiller */}
      {navn.map((n) => (
        <Txt key={n.key} x={n.x} y={n.y} anchor={n.anchor} size={n.size} weight={n.weight} color={n.farge}>
          {n.tekst}
        </Txt>
      ))}
    </g>
  );
}

/** Et rektangel [x0, y0, x1, y1] i figuren som kotetallene holder seg unna. */
type Boks = [number, number, number, number];

/** Gjør ringer i meter om til én glatt sti i figuren; `minRute` > 0 hopper over ringer mindre enn så mange ruter. */
function ringSti(S: KartSkala, celle: number) {
  return (ringer: readonly P[][], minRute = 0) =>
    ringer
      .filter((r) => {
        if (minRute <= 0) return true;
        const xs = r.map((p) => p[0]);
        const ys = r.map((p) => p[1]);
        return Math.max(...xs) - Math.min(...xs) > minRute * celle || Math.max(...ys) - Math.min(...ys) > minRute * celle;
      })
      .map((r) => glattSti(r.map(S.punkt), true))
      .join('');
}

/** Et navn på kartet (innsjø, elv, sone eller vannskille). */
interface Navnelapp {
  key: string;
  x: number;
  y: number;
  tekst: string;
  size: number;
  weight: number;
  farge: string;
  anchor: 'start' | 'middle' | 'end';
}

const navnBoks =
  (f: number) =>
  (n: Navnelapp): Boks => {
    const px = 17 * n.size * f;
    const w = tekstBredde(n.tekst, px);
    const x0 = n.anchor === 'start' ? n.x : n.anchor === 'end' ? n.x - w : n.x - w / 2;
    return [x0 - 4, n.y - px * 0.85, x0 + w + 4, n.y + px * 0.3];
  };

/** Plassen nordpila tar (samme mål som `Nordpil`). */
function nordpilBoks(x: number, y: number, f: number, k: number): Boks {
  const top = y + 17 * 0.8 * f * 0.35 + 6;
  return [x - 16 * k, y - 17 * 0.8 * f * 0.85, x + 16 * k, top + 30 * k + 6];
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

/** Overlapper to bokser? */
function overlapp(a: Boks, b: Boks): boolean {
  return a[0] < b[2] && b[0] < a[2] && a[1] < b[3] && b[1] < a[3];
}

/** Krysser streken p–q boksen (utvidet med `m`)? Sjekket med punkter langs streken. */
function boksKrysserStrek(b: Boks, p: readonly [number, number], q: readonly [number, number], m = 0): boolean {
  const L = Math.hypot(q[0] - p[0], q[1] - p[1]);
  const n = Math.max(2, Math.ceil(L / 3));
  for (let i = 0; i <= n; i++) {
    const x = p[0] + ((q[0] - p[0]) * i) / n;
    const y = p[1] + ((q[1] - p[1]) * i) / n;
    if (x > b[0] - m && x < b[2] + m && y > b[1] - m && y < b[3] + m) return true;
  }
  return false;
}

/** Plassen til A og B på profillinja: (x, y) er grunnlinjen midt i bokstaven, `boks` flaten den tar. */
interface ProfilEtikett {
  x: number;
  y: number;
  tekst: string;
  boks: Boks;
}

/**
 * A og B ved endene av profillinja: på forlengelsen av linja når det er plass, ellers vinkelrett på linja eller innover
 * langs den, alltid inne i kartet (en profil fra kant til kant får bokstavene inne i rammen).
 */
function profilEtiketter(profil: KartProfil, S: KartSkala, f: number, k: number, ledig: (b: Boks) => boolean, innenfor: (b: Boks) => boolean): ProfilEtikett[] | null {
  const [ax, ay] = S.punkt(profil.A);
  const [bx, by] = S.punkt(profil.B);
  const L = Math.hypot(bx - ax, by - ay);
  if (!Number.isFinite(L) || L < 1) return null;
  const ux = (bx - ax) / L;
  const uy = (by - ay) / L;
  const [na, nb] = profil.navn ?? ['A', 'B'];
  const px = 17 * 0.92 * f;
  const off = 15 * f + 2 * k;
  const ut: ProfilEtikett[] = [];
  for (const [x, y, tekst, ret] of [
    [ax, ay, na, -1],
    [bx, by, nb, 1],
  ] as const) {
    const tw = tekstBredde(tekst, px);
    const boksVed = (cx: number, cy: number): Boks => [cx - tw / 2 - 2, cy - px * 0.5, cx + tw / 2 + 2, cy + px * 0.5];
    // Retninger: ut langs linja, vinkelrett på begge sider, skrått og til slutt innover langs linja
    const dir: [number, number][] = [
      [ret * ux, ret * uy],
      [-uy, ux],
      [uy, -ux],
      [ret * ux - uy, ret * uy + ux],
      [ret * ux + uy, ret * uy - ux],
      [-ret * ux - uy, -ret * uy + ux],
      [-ret * ux + uy, -ret * uy - ux],
    ];
    const kandidater = dir.map(([dx, dy]) => {
      const l = Math.hypot(dx, dy) || 1;
      const cx = x + (dx / l) * off;
      const cy = y + (dy / l) * off;
      return { cx, cy, boks: boksVed(cx, cy) };
    });
    let valgt = kandidater.find((c) => ledig(c.boks)) ?? kandidater.find((c) => innenfor(c.boks)) ?? kandidater[0]!;
    if (!innenfor(valgt.boks)) {
      // Klem inn i kartet
      const dx = Math.max(0, S.x0 + 4 - valgt.boks[0]) - Math.max(0, valgt.boks[2] - (S.x0 + S.w - 4));
      const dy = Math.max(0, S.y0 + 4 - valgt.boks[1]) - Math.max(0, valgt.boks[3] - (S.y0 + S.h - 4));
      valgt = { cx: valgt.cx + dx, cy: valgt.cy + dy, boks: boksVed(valgt.cx + dx, valgt.cy + dy) };
    }
    ut.push({ x: valgt.cx, y: valgt.cy + px * 0.36, tekst, boks: valgt.boks });
  }
  return ut;
}

function Profillinje({ profil, S, etiketter }: { profil: KartProfil; S: KartSkala; etiketter: readonly ProfilEtikett[] | null }) {
  const ss = useGeoStroke();
  const k = useGeoScale();
  const [ax, ay] = S.punkt(profil.A);
  const [bx, by] = S.punkt(profil.B);
  const L = Math.hypot(bx - ax, by - ay);
  if (!Number.isFinite(L) || L < 1) return null;
  const farge = profil.farge ?? VIZ.ink;
  return (
    <g>
      <line x1={ax} y1={ay} x2={bx} y2={by} stroke={VIZ.surface} strokeWidth={5.5 * ss} strokeLinecap="round" opacity={0.85} />
      <line x1={ax} y1={ay} x2={bx} y2={by} stroke={farge} strokeWidth={2.4 * ss} strokeLinecap="round" />
      <circle cx={ax} cy={ay} r={4.5 * k} fill={farge} stroke={VIZ.surface} strokeWidth={1.5 * ss} />
      <circle cx={bx} cy={by} r={4.5 * k} fill={farge} stroke={VIZ.surface} strokeWidth={1.5 * ss} />
      {(etiketter ?? []).map((e) => (
        <Txt key={e.tekst} x={e.x} y={e.y} size={0.92} weight={750} color={farge}>
          {e.tekst}
        </Txt>
      ))}
    </g>
  );
}

/** Plassen til et merke og navnet ved det (`Merke` tegner det, kotetallene og andre navn holder seg unna). */
interface MerkePlass {
  x: number;
  y: number;
  r: number;
  sym: NonNullable<KartMerke['symbol']>;
  tekst: string;
  tx: number;
  ty: number;
  anchor: 'start' | 'middle' | 'end';
  /** Flaten teksten tar, eller null uten tekst. */
  tekstBoks: Boks | null;
}

/** Plasserer navnet ved et merke på den valgte siden, eller den første ledige av høyre, venstre, over og under. */
function merkePlass(merke: KartMerke, S: KartSkala, felt: Hoydefelt, f: number, k: number, ledig: (b: Boks) => boolean): MerkePlass | null {
  const [x, y] = S.punkt(merke.p);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  const sym = merke.symbol ?? 'punkt';
  const z = hoydeVed(felt, merke.p[0], merke.p[1]);
  const visHoyde = merke.hoyde ?? sym === 'topp';
  const tekst = [merke.navn, visHoyde && z !== null ? fmtTall(z, 0) : undefined].filter(Boolean).join(' ');
  const tPx = 17 * 0.72 * f;
  const tw = tekst ? tekstBredde(tekst, tPx) : 0;
  const r = 5 * k;
  if (!tekst) return { x, y, r, sym, tekst, tx: x, ty: y, anchor: 'start', tekstBoks: null };
  const sider: Record<NonNullable<KartMerke['navnSide']>, { tx: number; ty: number; anchor: 'start' | 'middle' | 'end'; boks: Boks }> = {
    hoyre: { tx: x + 9 * k, ty: y + tPx * 0.36, anchor: 'start', boks: [x + 9 * k - 2, y - tPx * 0.6, x + 9 * k + tw + 2, y + tPx * 0.5] },
    venstre: { tx: x - 9 * k, ty: y + tPx * 0.36, anchor: 'end', boks: [x - 9 * k - tw - 2, y - tPx * 0.6, x - 9 * k + 2, y + tPx * 0.5] },
    over: { tx: x, ty: y - r * 1.3 - 4, anchor: 'middle', boks: [x - tw / 2 - 2, y - r * 1.3 - 4 - tPx * 0.85, x + tw / 2 + 2, y - r * 1.3 - 4 + tPx * 0.25] },
    under: { tx: x, ty: y + r + 4 + tPx * 0.8, anchor: 'middle', boks: [x - tw / 2 - 2, y + r + 4 - tPx * 0.05, x + tw / 2 + 2, y + r + 4 + tPx * 1.05] },
  };
  const rekkefolge: NonNullable<KartMerke['navnSide']>[] = merke.navnSide ? [merke.navnSide] : ['hoyre', 'venstre', 'over', 'under'];
  const valgt = rekkefolge.map((sd) => sider[sd]).find((o) => ledig(o.boks)) ?? (merke.navnSide ? sider[merke.navnSide] : null);
  // Uten ledig side: høyre, eller venstre når høyre går ut av kartet
  const reserve = sider.hoyre.boks[2] > S.x0 + S.w - 4 ? sider.venstre : sider.hoyre;
  const o = valgt ?? reserve;
  return { x, y, r, sym, tekst, tx: o.tx, ty: o.ty, anchor: o.anchor, tekstBoks: o.boks };
}

function Merke({ merke, plass }: { merke: KartMerke; plass: MerkePlass }) {
  const ss = useGeoStroke();
  const { x, y, r, sym, tekst, tx, ty, anchor } = plass;
  const farge = merke.farge ?? (sym === 'bronn' ? mix(SCENE.water, VIZ.ink, 0.22) : VIZ.ink);
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
        <Txt x={tx} y={ty} anchor={anchor} size={0.72} weight={650} color={merke.farge}>
          {tekst}
        </Txt>
      )}
    </g>
  );
}

/* ================================================================================================ Profildiagram */

/** Props til `Profildiagram`: høydefeltet, linja A–B, størrelsen og overhøyden. */
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
  /** Innsjøer (samme som på `Kotekart`): der profilet krysser en innsjø, tegnes vannet opp til vannstanden. */
  innsjoer?: readonly KartInnsjo[];
  /**
   * Med `overhoyde`: blir profilet høyere enn plottet, blir plottet smalere (samme overhøyde, midt i bredden) i stedet
   * for at toppen og bunnen klippes. Standard av.
   */
  tilpass?: boolean;
  /** Skriv overhøyden («Overhøyde 5 ganger», «Ingen overhøyde») øverst midt i diagrammet (standard på). */
  visOverhoyde?: boolean;
  /** Ekstra tegning med skalaene (avstand i meter: `sx`, høyde i m o.h.: `sy`). */
  children?: (s: LogPlotSkalaer) => ReactNode;
}

/**
 * Terrengprofilet langs linja A–B i et høydefelt (`terrengprofil` i kart.ts): avstand langs bakken (m eller km) mot høyde
 * (m o.h.), med terrenget fylt og havet som vann. Med `overhoyde` blir høydeaksen strukket nøyaktig så mange ganger i
 * forhold til avstandsaksen (1 = riktige forhold), og overhøyden skrives øverst, så eleven ser hvor mye profilet
 * overdriver. Øvre venstre hjørne er `at` (standard [0, 0]). Bygd på `LogPlot` med lineære akser; barna får skalaene
 * (`sx` i meter langs profilet, `sy` i m o.h.).
 */
export function Profildiagram({
  felt,
  A,
  B,
  width = 800,
  height,
  at,
  overhoyde = null,
  navn = ['A', 'B'],
  hav = null,
  innsjoer,
  tilpass = false,
  visOverhoyde = true,
  children,
}: ProfildiagramProps) {
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
  // Faste marger, så overhøyden blir nøyaktig
  const marg = profildiagramMarger(f, zMin, zMax);
  const { top: topp, bottom: bunn, left: venstre, right: hoyre } = marg;
  let plotB = Math.max(10, width - venstre - hoyre);
  const plotH = Math.max(10, H - topp - bunn);
  let yLo: number;
  let yHi: number;
  const oh = overhoyde !== null && Number.isFinite(overhoyde) && overhoyde > 0 ? overhoyde : null;
  // Smalere plott med samme overhøyde når profilet ellers ville blitt klippet
  if (oh !== null && tilpass && L > 0) {
    const relieff = Math.max(zMax - Math.min(zMin, hav ?? zMin), 1);
    plotB = Math.max(10, Math.min(plotB, (plotH * L) / (relieff * 1.2 * oh)));
  }
  const bredde = venstre + plotB + hoyre;
  const at0: readonly [number, number] = at ?? [0, 0];
  const atBrukt: readonly [number, number] = bredde < width - 0.5 ? [at0[0] + (width - bredde) / 2, at0[1]] : at0;
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
  // Innsjøene langs profilet: strekningene der profilet ligger i en innsjø, med vannstanden
  const sjoer = (innsjoer ?? []).map((sj) => innsjoMaske(felt, sj.punkt, sj.niva, hav)).filter((v): v is { maske: boolean[]; niva: number } => v !== null);
  const vannLop: { fra: number; til: number; niva: number }[] = [];
  if (sjoer.length > 0) {
    let lop: { fra: number; til: number; niva: number } | null = null;
    for (const p of prof) {
      const i = Math.min(felt.nx - 1, Math.max(0, Math.round(p.x / felt.celle)));
      const j = Math.min(felt.ny - 1, Math.max(0, Math.round(p.y / felt.celle)));
      const sj = sjoer.find((v) => v.maske[j * felt.nx + i]);
      if (sj && p.z < sj.niva) {
        if (lop && lop.niva === sj.niva) lop.til = p.s;
        else {
          if (lop) vannLop.push(lop);
          lop = { fra: p.s, til: p.s, niva: sj.niva };
        }
      } else if (lop) {
        vannLop.push(lop);
        lop = null;
      }
    }
    if (lop) vannLop.push(lop);
  }
  const faktisk = L > 0 && yHi > yLo ? plotH / (yHi - yLo) / (plotB / L) : NaN;
  const ganger = (v: number) => fmt(v, v < 10 && Math.abs(v - Math.round(v)) > 0.05 ? 1 : 0);
  const ohTekst =
    oh !== null
      ? Math.abs(oh - 1) < 1e-9
        ? 'Ingen overhøyde'
        : `Overhøyde ${ganger(oh)} ganger`
      : Math.abs(faktisk - 1) < 0.05
        ? 'Nesten ingen overhøyde'
        : `Overhøyde ca. ${ganger(faktisk)} ganger`;
  const pts: [number, number][] = prof.map((p) => [p.s, p.z]);
  return (
    <LogPlot
      at={atBrukt}
      width={bredde}
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
              {vannLop.map((v, i) => {
                const del = pts.filter(([a]) => a >= v.fra - 1e-6 && a <= v.til + 1e-6);
                if (del.length < 2) return null;
                const bunnSti = del.map(([a, b]) => `${sx(a).toFixed(2)},${sy(Math.min(b, v.niva)).toFixed(2)}`);
                return (
                  <g key={`sj${i}`}>
                    <path d={`M${sx(del[0]![0])},${sy(v.niva)}L${bunnSti.join('L')}L${sx(del[del.length - 1]![0])},${sy(v.niva)}Z`} fill={mix(SCENE.waterLight, VIZ.surface, 0.35)} />
                    <line x1={sx(del[0]![0])} x2={sx(del[del.length - 1]![0])} y1={sy(v.niva)} y2={sy(v.niva)} stroke={mix(SCENE.water, VIZ.ink, 0.22)} strokeWidth={1.4 * ss} />
                  </g>
                );
              })}
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

/**
 * Margene `Profildiagram` bruker (aksetitler, akseverdier og navnene A og B over plottet), så et eget plott eller en
 * beregning av bredden ved fast overhøyde kan bruke de samme: `{ top, bottom, left, right }` i figurens enheter for
 * tekstskaleringen `f` og høydene zMin–zMax (m o.h.).
 */
export function profildiagramMarger(f: number, zMin: number, zMax: number): { top: number; bottom: number; left: number; right: number } {
  const ff = Number.isFinite(f) ? Math.max(1, f) : 1;
  const tickPx = 15 * ff;
  const titlePx = 15.6 * ff;
  const storst = Math.max(Math.abs(Number.isFinite(zMax) ? zMax : 0), Math.abs(Number.isFinite(zMin) ? zMin : 0));
  return {
    top: 20 * ff + titlePx * 1.2,
    bottom: 22 * ff + 10 + titlePx * 1.1,
    left: titlePx * 1.25 + 14 + tekstBredde(fmt(storst * 1.3, 0).replace(/\s/g, '') + '0', tickPx) + 10,
    right: 30 * ff,
  };
}

/** Meter som km med så få desimaler som trengs: 1500 → «1,5», 2000 → «2». */
function kmTekst(m: number): string {
  const km = m / 1000;
  const d = Math.abs(km - Math.round(km)) < 1e-9 ? 0 : Math.abs(km * 10 - Math.round(km * 10)) < 1e-9 ? 1 : 2;
  return fmt(km, d);
}
