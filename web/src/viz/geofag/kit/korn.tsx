/**
 * Korn og kornstørrelse i geofagfigurene: ett korn med rundhet og bergartsfarge (`Korn`), et forstørret utsnitt av
 * pakkede korn der porene er fylt med vann, olje, gass, CO₂, luft, sement eller leire (`Kornpakning`), og kumulativ
 * kornfordeling på logaritmisk akse med kornklassene som bånd (`Kornkurve`).
 *
 * Samme stil som scene-kit-et: toninger fra core.tsx, kontur, lys fra øvre venstre og ingen filtre. Kornene har
 * bergartsfargen fra `GEO.bergart` (samme som mønstrene), porevæskene fargene fra GEO (vann blått, olje grønn og gass
 * rød som hos Sokkeldirektoratet). Kornene vokser på mobil med `useGeoScale`. De rene hjelperne (`kornOmriss`, `kornSti`,
 * `pakkKorn`, `porositetIUtsnitt`, `porositetEtterSortering`, `voronoiCeller`, `punktIPolygon`, `polygonAreal`) kan
 * brukes i model.ts og testes uten React.
 */
import { useMemo, type ReactNode } from 'react';
import { useTextScale } from '../../kit/controls';
import { VIZ } from '../../kit/colors';
import { linePath, TSub } from '../../kit/svg';
import { fmt } from '../../kit/format';
import { Txt } from '../../kit/txt';
import { ContactShadow, LinearGradient, RadialGradient, alpha, mix, shade, tint, useSvgId } from '../../kit/scene/core';
import { SCENE } from '../../kit/scene/palette';
import { placeParticles, seededRandom } from '../../kjemi/kit/random';
import { GEO, type GeoPaint } from './colors';
import { LogPlot, tekstBredde, type LogPlotSkalaer } from './diagram';
import { geoHoyde, useGeoScale, useGeoStroke } from './felles';
import { KORNKLASSER, dPersentil, type KornklasseId, type KurvePunkt } from './kornstorrelse';
import { normalKumulativ, normalKvantil } from './statistikk';
import type { MonsterId } from './typer';

type P = readonly [number, number];

const r2 = (v: number) => Math.round(v * 100) / 100;
const fin = (v: number | undefined, d: number) => (v !== undefined && Number.isFinite(v) ? v : d);
const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
const RAD = Math.PI / 180;

/* ================================================================================================ Rundhet */

/** Rundhetsklassene for korn, fra svært kantet til godt rundet. */
export type RundhetId = 'svaert-kantet' | 'kantet' | 'kantrundet' | 'noe-rundet' | 'rundet' | 'godt-rundet';

/** Én rundhetsklasse med verdien `Korn` bruker (0 = svært kantet, 1 = godt rundet). */
export interface Rundhetsklasse {
  id: RundhetId;
  /** «kantrundet». */
  navn: string;
  /** Rundheten til `Korn` og `Kornpakning` (0–1). */
  verdi: number;
}

/*
 * Kilde: Powers 1953 (J. Sediment. Petrol. 23, 117–119), seks klasser fra «very angular» til «well rounded». De norske
 * navnene som i lærebøker og hos NGU (kantet, kantrundet, rundet). Verdiene 0–1 er bare til tegningen.
 */
/** Rundhetsklassene etter Powers 1953, fra svært kantet til godt rundet. */
export const RUNDHETSKLASSER: readonly Rundhetsklasse[] = [
  { id: 'svaert-kantet', navn: 'svært kantet', verdi: 0 },
  { id: 'kantet', navn: 'kantet', verdi: 0.2 },
  { id: 'kantrundet', navn: 'kantrundet', verdi: 0.4 },
  { id: 'noe-rundet', navn: 'noe rundet', verdi: 0.6 },
  { id: 'rundet', navn: 'rundet', verdi: 0.8 },
  { id: 'godt-rundet', navn: 'godt rundet', verdi: 1 },
];

/** Rundheten (0–1) for en klasse eller et tall. Ugyldige tall gir 0,6 (noe rundet). */
export function rundhetVerdi(r: number | RundhetId | undefined): number {
  if (typeof r === 'string') return RUNDHETSKLASSER.find((k) => k.id === r)?.verdi ?? 0.6;
  return r !== undefined && Number.isFinite(r) ? clamp(r, 0, 1) : 0.6;
}

/** Klassen som ligger nærmest rundheten `r` (0–1). Ugyldige tall gir null. */
export function rundhetsklasse(r: number): Rundhetsklasse | null {
  if (!Number.isFinite(r)) return null;
  let best = RUNDHETSKLASSER[0]!;
  for (const k of RUNDHETSKLASSER) if (Math.abs(k.verdi - r) < Math.abs(best.verdi - r)) best = k;
  return best;
}

/* ================================================================================================ Omrisset av et korn */

/** Omrisset av ett korn med radius 1 rundt (0, 0): hjørnene, hvor mye de er avrundet, og konturen som tett polygon. */
export interface KornOmriss {
  /** Hjørnene i grunnpolygonet. Ingen ligger lenger enn 1 fra midten. */
  hjorner: P[];
  /** Hvor stor del av hver kant som går med til avrundingen av hjørnet (0,03 = skarpt, 0,5 = helt rundt). */
  avrunding: number;
  /** Den avrundede konturen som tett polygon, til areal og treff (`punktIPolygon`). */
  kontur: P[];
  /** Spissen av hvert avrundede hjørne (midt på buen), i samme rekkefølge som `hjorner`. */
  spisser: P[];
}

/** Valgene til `kornOmriss` (og `kornSti`): rundhet, hvor avlangt og frøet til formen. */
export interface KornOmrissValg {
  /** 0 = svært kantet, 1 = godt rundet (standard 0,6). */
  rundhet?: number;
  /** 0 = like bredt som høyt, 0,6 = tydelig avlangt (standard 0). */
  avlang?: number;
  /** Frø til formen (standard 1). Samme frø gir samme korn. */
  seed?: number;
}

/**
 * Omrisset av et korn med radius 1 rundt (0, 0): et tilfeldig (men fast for frøet) mangekantet korn der hjørnene
 * rundes av etter rundheten, fra skarpe kanter (svært kantet, f.eks. forvitret grus og morene) til en jevn, rund form
 * (godt rundet, f.eks. strandsand og elvestein). Ingen del av kornet ligger lenger enn 1 fra midten, så korn med radius
 * r kan pakkes som sirkler. Ren funksjon.
 */
export function kornOmriss(valg: KornOmrissValg = {}): KornOmriss {
  const ru = clamp(fin(valg.rundhet, 0.6), 0, 1);
  const e = clamp(fin(valg.avlang, 0), 0, 0.8);
  const seed = Math.floor(fin(valg.seed, 1));
  const rnd = seededRandom(seed * 7919 + 13);
  const n = ru < 0.5 ? 6 + Math.floor(rnd() * 3) : 7 + Math.floor(rnd() * 3);
  const ujevn = 0.34 - 0.22 * ru;
  const a0 = rnd() * 2 * Math.PI;
  const sx = 1 + 0.45 * e;
  const sy = 1 - 0.35 * e;
  const raa: [number, number][] = [];
  for (let i = 0; i < n; i++) {
    const a = a0 + (2 * Math.PI * i) / n + (rnd() - 0.5) * 0.7 * ((2 * Math.PI) / n);
    const rr = 1 - ujevn * rnd();
    raa.push([Math.cos(a) * rr * sx, Math.sin(a) * rr * sy]);
  }
  const maks = Math.max(...raa.map(([x, y]) => Math.hypot(x, y)), 1e-9);
  const hjorner: P[] = raa.map(([x, y]) => [x / maks, y / maks]);
  const t = 0.03 + 0.47 * ru;
  const kontur: P[] = [];
  const spisser: P[] = [];
  for (let i = 0; i < n; i++) {
    const V = hjorner[i]!;
    const Pf = hjorner[(i + n - 1) % n]!;
    const N = hjorner[(i + 1) % n]!;
    const A: P = [V[0] + t * (Pf[0] - V[0]), V[1] + t * (Pf[1] - V[1])];
    const B: P = [V[0] + t * (N[0] - V[0]), V[1] + t * (N[1] - V[1])];
    for (let s = 0; s <= 6; s++) {
      const u = s / 6;
      const q: P = [(1 - u) ** 2 * A[0] + 2 * u * (1 - u) * V[0] + u * u * B[0], (1 - u) ** 2 * A[1] + 2 * u * (1 - u) * V[1] + u * u * B[1]];
      kontur.push(q);
      if (s === 3) spisser.push(q);
    }
  }
  return { hjorner, avrunding: t, kontur, spisser };
}

/** Transformerer et punkt i et enhetsomriss til figuren: skalert med r, dreid `rot` grader og flyttet til (x, y). */
function plasser(p: P, x: number, y: number, r: number, rot: number): P {
  const c = Math.cos(rot * RAD);
  const s = Math.sin(rot * RAD);
  return [x + r * (p[0] * c - p[1] * s), y + r * (p[0] * s + p[1] * c)];
}

/**
 * SVG-stien til et korn med midten i (x, y) og radius r, dreid `rotate` grader: de avrundede hjørnene som
 * kvadratiske buer (skarpe ved rundhet 0). Gi enten et ferdig omriss eller valgene til `kornOmriss`.
 *   <path d={kornSti(120, 80, 14, { rundhet: 0.2, seed: 4 })} … />
 */
export function kornSti(x: number, y: number, r: number, omriss: KornOmriss | KornOmrissValg = {}, rotate = 0): string {
  if (![x, y, r].every(Number.isFinite) || !(r > 0)) return '';
  const o = 'kontur' in omriss ? omriss : kornOmriss(omriss);
  const rot = fin(rotate, 0);
  const n = o.hjorner.length;
  const t = o.avrunding;
  const ut = (p: P) => {
    const q = plasser(p, x, y, r, rot);
    return `${r2(q[0])} ${r2(q[1])}`;
  };
  let d = '';
  for (let i = 0; i < n; i++) {
    const V = o.hjorner[i]!;
    const Pf = o.hjorner[(i + n - 1) % n]!;
    const N = o.hjorner[(i + 1) % n]!;
    const A: P = [V[0] + t * (Pf[0] - V[0]), V[1] + t * (Pf[1] - V[1])];
    const B: P = [V[0] + t * (N[0] - V[0]), V[1] + t * (N[1] - V[1])];
    d += `${i ? 'L' : 'M'}${ut(A)}Q${ut(V)} ${ut(B)}`;
  }
  return `${d}Z`;
}

/** Om punktet (x, y) ligger inne i polygonet (jevn–odde-regelen). */
export function punktIPolygon(x: number, y: number, poly: readonly P[]): boolean {
  let inne = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i]!;
    const [xj, yj] = poly[j]!;
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi || 1e-12) + xi) inne = !inne;
  }
  return inne;
}

/** Arealet av et polygon (alltid positivt). */
export function polygonAreal(poly: readonly P[]): number {
  let a = 0;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) a += poly[j]![0] * poly[i]![1] - poly[i]![0] * poly[j]![1];
  return Math.abs(a) / 2;
}

/* ================================================================================================ Mosaikk (Voronoi) */

/** Klipper et konvekst polygon med halvplanet der (p − m) · n ≤ 0 (Sutherland–Hodgman). */
function klipp(polygon: P[], m: P, n: P): P[] {
  const ut: P[] = [];
  const side = (q: P) => (q[0] - m[0]) * n[0] + (q[1] - m[1]) * n[1];
  for (let i = 0; i < polygon.length; i++) {
    const a = polygon[i]!;
    const b = polygon[(i + 1) % polygon.length]!;
    const sa = side(a);
    const sb = side(b);
    if (sa <= 0) ut.push(a);
    if (sa <= 0 !== sb <= 0) {
      const t = sa / (sa - sb);
      ut.push([a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1])]);
    }
  }
  return ut;
}

/**
 * Voronoi-cellene til punktene innenfor boksen: hver celle er området som ligger nærmere sitt punkt enn noe annet. Gir
 * en mosaikk av korn som griper inn i hverandre, som krystallene i granitt eller marmor (`Steinprove`). `naboAvstand`
 * begrenser hvilke punkter som sjekkes (standard alle). Ren funksjon.
 */
export function voronoiCeller(punkter: readonly P[], boks: { x0: number; y0: number; x1: number; y1: number }, naboAvstand = Infinity): P[][] {
  const ramme: P[] = [
    [boks.x0, boks.y0],
    [boks.x1, boks.y0],
    [boks.x1, boks.y1],
    [boks.x0, boks.y1],
  ];
  return punkter.map((s, i) => {
    let celle = ramme;
    for (let j = 0; j < punkter.length && celle.length > 0; j++) {
      if (j === i) continue;
      const t = punkter[j]!;
      if (Math.abs(t[0] - s[0]) > naboAvstand || Math.abs(t[1] - s[1]) > naboAvstand) continue;
      celle = klipp(celle, [(s[0] + t[0]) / 2, (s[1] + t[1]) / 2], [t[0] - s[0], t[1] - s[1]]);
    }
    return celle;
  });
}

/* ================================================================================================ Pakking */

/**
 * Kornene tegnes litt større enn sirkelen de pakkes som (omrisset ligger ellers helt innenfor), så nabokorn berører
 * hverandre. Porøsiteten regnes med samme størrelse.
 */
export const KORN_TEGNESKALA = 1.06;

/** Ett pakket korn: midten, radiusen (største avstand fra midten til kanten), frøet til formen og dreiingen. */
export interface PakketKorn {
  x: number;
  y: number;
  r: number;
  seed: number;
  /** Grader. */
  rotate: number;
  /** Et fast tall 0–1 per korn (til farge og variasjon). */
  u: number;
}

/** Valgene til `pakkKorn`: boksen, mediankornet, sorteringen, rundheten og frøet. */
export interface PakkKornValg {
  /** Boksen kornene fylles i: fra (0, 0) til (w, h), y nedover. Kornene får henge litt utenfor kantene. */
  w: number;
  h: number;
  /** Mediankornets radius i samme enheter. */
  r: number;
  /**
   * Sorteringen som standardavvik σ i φ-enheter, som `sortering` i kornstorrelse.ts (Folk og Ward): 0 = alle like
   * store, 0,35 svært godt sortert, 1 moderat, 2 svært dårlig sortert (morene). Standard 0,5.
   */
  sortering?: number;
  /** Frø (standard 1). */
  seed?: number;
  /** Høyst så mange korn før finstoffet (standard 700). */
  maks?: number;
  /** Rundheten til kornene (0–1, standard 0,6), som i tegningen: brukes når porøsiteten regnes ut. */
  rundhet?: number;
}

/*
 * Kilde: Beard og Weyl 1973 (AAPG Bulletin 57, 349–369), porøsiteten i våtpakket, ukonsolidert sand: i snitt 42,4 % for
 * ekstremt godt sortert og 27,9 % for svært dårlig sortert sand, nesten uavhengig av kornstørrelsen. Mellomverdiene
 * (40,8, 39,0, 34,0 og 30,7 %) og oversettelsen fra deres sorteringsklasser (Trask) til σ i φ-enheter er omtrentlige.
 */
const PORE_SORTERING: readonly (readonly [number, number])[] = [
  [0.1, 0.424],
  [0.3, 0.408],
  [0.55, 0.39],
  [1.1, 0.34],
  [1.8, 0.307],
  [2.4, 0.279],
];

/**
 * Omtrentlig porøsitet (0–1) i løst pakket, vannmettet sand med sorteringen σ (φ-enheter, Folk og Ward): fra ca. 42 %
 * for svært godt sortert til ca. 28 % for svært dårlig sortert (Beard og Weyl 1973). Utenfor tabellen brukes endene.
 * Ugyldig eller negativ σ gir null. `Kornpakning` bruker den til hvor mye finstoff som fyller porene.
 */
export function porositetEtterSortering(sigma: number): number | null {
  if (!Number.isFinite(sigma) || sigma < 0) return null;
  const t = PORE_SORTERING;
  if (sigma <= t[0]![0]) return t[0]![1];
  for (let i = 1; i < t.length; i++) {
    const [s0, p0] = t[i - 1]!;
    const [s1, p1] = t[i]!;
    if (sigma <= s1) return p0 + ((sigma - s0) / (s1 - s0)) * (p1 - p0);
  }
  return t[t.length - 1]![1];
}

/** Rutenett for raske naboer: hvert korn legges i alle rutene det dekker. */
function rutenett(X0: number, Y0: number, BW: number, BH: number, celle: number) {
  const nx = Math.max(1, Math.ceil(BW / celle));
  const ny = Math.max(1, Math.ceil(BH / celle));
  const ruter: number[][] = Array.from({ length: nx * ny }, () => []);
  const spenn = (x: number, y: number, r: number) =>
    [
      clamp(Math.floor((x - r - X0) / celle), 0, nx - 1),
      clamp(Math.floor((x + r - X0) / celle), 0, nx - 1),
      clamp(Math.floor((y - r - Y0) / celle), 0, ny - 1),
      clamp(Math.floor((y + r - Y0) / celle), 0, ny - 1),
    ] as const;
  return {
    legg(i: number, x: number, y: number, r: number) {
      const [a0, a1, b0, b1] = spenn(x, y, r);
      for (let a = a0; a <= a1; a++) for (let b = b0; b <= b1; b++) ruter[b * nx + a]!.push(i);
    },
    /** Kaller `fn` for hver kandidat nær (x, y) med radius r (samme kandidat kan komme flere ganger). */
    naboer(x: number, y: number, r: number, fn: (j: number) => boolean | void) {
      const [a0, a1, b0, b1] = spenn(x, y, r);
      for (let a = a0; a <= a1; a++) for (let b = b0; b <= b1; b++) for (const j of ruter[b * nx + a]!) if (fn(j) === false) return;
    },
  };
}

/**
 * Pakker korn tett i en boks, som i en sandstein eller et sediment: kornene får tilfeldige plasser og vokser gradvis
 * mens de skyves fra hverandre, til de ligger tett inntil hverandre uten å overlappe (tilfeldig tett pakking).
 * Kornstørrelsene følger sorteringen σ (i φ-enheter, som Folk og Ward, regnet på massen): godt sorterte masser har like
 * store korn, dårlig sorterte noen store og mange små. Til slutt fyller små korn (finstoff) porene, så porøsiteten
 * faller med sorteringen omtrent som i `porositetEtterSortering`. Kornene fyller også litt utenfor boksen, så kantene av
 * et utsnitt ikke blir tomme. Fast frø gir samme pakking hver gang. Ren funksjon; ugyldige mål gir en tom liste.
 */
export function pakkKorn(valg: PakkKornValg): PakketKorn[] {
  const w = fin(valg.w, 0);
  const h = fin(valg.h, 0);
  const r = fin(valg.r, 0);
  if (!(w > 0 && h > 0 && r > 0) || w / r > 300 || h / r > 300) return [];
  const sigma = clamp(fin(valg.sortering, 0.5), 0, 3);
  const rundhet = clamp(fin(valg.rundhet, 0.6), 0, 1);
  const rnd = seededRandom(Math.floor(fin(valg.seed, 1)) * 104729 + 7);
  const maks = clamp(Math.floor(fin(valg.maks, 700)), 1, 3000);
  const rMin = r * 0.25;
  const rMax = Math.max(r, Math.min(r * 4.5, 0.45 * Math.min(w, h)));
  const marg = 1.2 * r;
  const X0 = -marg;
  const Y0 = -marg;
  const BW = w + 2 * marg;
  const BH = h + 2 * marg;

  // 1. Størrelsene. Massen (arealet) er lognormal i φ med median r, så antallet per størrelse er forskjøvet mot de små
  //    (μ − 2s²). Kornene under rMin blir finstoff til slutt; de større trekkes fra halen (invers fordelingsfunksjon).
  const s = Math.max(1e-6, sigma * Math.LN2);
  const mu = Math.log(r) - 2 * s * s;
  const p0 = sigma > 0 ? (normalKumulativ((Math.log(rMin) - mu) / s) ?? 0) : 0;
  const maal = 0.8 * BW * BH;
  const rs: number[] = [];
  let areal = 0;
  while (areal < maal && rs.length < maks) {
    const u = p0 + (1 - p0) * (0.0005 + 0.999 * rnd());
    const z = clamp(normalKvantil(clamp(u, 1e-9, 1 - 1e-9)) ?? 0, -4, 6);
    const rr = sigma > 0 ? clamp(Math.exp(mu + s * z), rMin, rMax) : r;
    rs.push(rr);
    areal += Math.PI * rr * rr;
  }
  rs.sort((a, b) => b - a);
  const n = rs.length;

  // 2. Start: tilfeldige plasser for kornene i 55 % størrelse, store først
  const xs: number[] = [];
  const ys: number[] = [];
  for (let i = 0; i < n; i++) {
    const ri = 0.55 * rs[i]!;
    let bx = 0;
    let by = 0;
    let best = Infinity;
    for (let t = 0; t < 24; t++) {
      const x = X0 + ri + rnd() * Math.max(0, BW - 2 * ri);
      const y = Y0 + ri + rnd() * Math.max(0, BH - 2 * ri);
      let o = 0;
      for (let j = 0; j < i; j++) o = Math.max(o, ri + 0.55 * rs[j]! - Math.hypot(x - xs[j]!, y - ys[j]!));
      if (o < best) {
        best = o;
        bx = x;
        by = y;
      }
      if (o <= 0) break;
    }
    xs.push(bx);
    ys.push(by);
  }

  // 3. Kornene vokser til full størrelse og skyves fra hverandre (de små flytter seg mest)
  const midtR = [...rs].sort((a, b) => a - b)[Math.floor(n / 2)] ?? r;
  const celle = Math.max(2 * rMin, 2 * midtR);
  const merke = new Int32Array(n).fill(-1);
  for (let it = 0; it < 120; it++) {
    const g = 0.55 + 0.45 * Math.min(1, it / 45);
    merke.fill(-1);
    const nett = rutenett(X0, Y0, BW, BH, celle);
    for (let i = 0; i < n; i++) nett.legg(i, xs[i]!, ys[i]!, g * rs[i]!);
    let verst = 0;
    for (let i = 0; i < n; i++) {
      const ri = g * rs[i]!;
      nett.naboer(xs[i]!, ys[i]!, ri, (j) => {
        if (j <= i || merke[j] === i) return;
        merke[j] = i;
        const rj = g * rs[j]!;
        let dx = xs[j]! - xs[i]!;
        let dy = ys[j]! - ys[i]!;
        let d = Math.hypot(dx, dy);
        if (d >= ri + rj) return;
        if (d < 1e-9) {
          const a = rnd() * 2 * Math.PI;
          dx = Math.cos(a);
          dy = Math.sin(a);
          d = 1;
        }
        const o = ri + rj - d;
        verst = Math.max(verst, o / Math.min(ri, rj));
        const mi = ri * ri;
        const mj = rj * rj;
        xs[i] = xs[i]! - (dx / d) * o * (mj / (mi + mj));
        ys[i] = ys[i]! - (dy / d) * o * (mj / (mi + mj));
        xs[j] = xs[j]! + (dx / d) * o * (mi / (mi + mj));
        ys[j] = ys[j]! + (dy / d) * o * (mi / (mi + mj));
      });
    }
    for (let i = 0; i < n; i++) {
      const ri = g * rs[i]!;
      xs[i] = clamp(xs[i]!, X0 + ri, Math.max(X0 + ri, X0 + BW - ri));
      ys[i] = clamp(ys[i]!, Y0 + ri, Math.max(Y0 + ri, Y0 + BH - ri));
    }
    if (it > 45 && verst < 0.01) break;
  }

  // 4. Der kornene fortsatt overlapper (små korn som ble klemt), krympes det minste, eller det tas bort
  const rEnde = [...rs];
  {
    const nett = rutenett(X0, Y0, BW, BH, celle);
    for (let i = 0; i < n; i++) nett.legg(i, xs[i]!, ys[i]!, rs[i]!);
    for (let i = n - 1; i >= 0; i--) {
      nett.naboer(xs[i]!, ys[i]!, rs[i]!, (j) => {
        if (j === i || !(rEnde[j]! > 0) || !(rEnde[i]! > 0)) return;
        const d = Math.hypot(xs[j]! - xs[i]!, ys[j]! - ys[i]!);
        if (rEnde[i]! + rEnde[j]! - d <= 0.04 * Math.min(rEnde[i]!, rEnde[j]!)) return;
        const liten = rEnde[i]! <= rEnde[j]! ? i : j;
        const stor = liten === i ? j : i;
        const ny = d - rEnde[stor]! + 0.03 * rEnde[liten]!;
        rEnde[liten] = ny >= 0.6 * rs[liten]! ? ny : 0;
      });
    }
  }
  const korn: PakketKorn[] = [];
  for (let i = 0; i < n; i++) {
    const seed = Math.floor(rnd() * 1e6);
    const rotate = rnd() * 360;
    const u = rnd();
    if (rEnde[i]! > 0) korn.push({ x: xs[i]!, y: ys[i]!, r: rEnde[i]!, seed, rotate, u });
  }

  // 5. Finstoff i porene: jo dårligere sortert, jo mer, så porøsiteten faller som i `porositetEtterSortering`
  const indre: Utsnitt = { x: w / 2, y: h / 2, w, h };
  const naa = porositetIUtsnitt(korn, indre, rundhet, 36);
  const ref = porositetEtterSortering(0.45)!;
  const maalPor = naa === null ? null : naa * ((porositetEtterSortering(sigma) ?? ref) / ref);
  if (naa !== null && maalPor !== null && naa - maalPor > 0.005) {
    const rf = 0.13 * r;
    const fyll = 0.7 + 0.2 * rundhet;
    const maalAreal = ((naa - maalPor) * BW * BH) / fyll;
    const S = KORN_TEGNESKALA;
    const omr = korn.map((k) => kornOmriss({ rundhet, seed: k.seed }));
    const former = omr.map((o, i) => o.kontur.filter((_, j) => j % 2 === 0).map((p) => plasser(p, korn[i]!.x, korn[i]!.y, korn[i]!.r * S, korn[i]!.rotate)));
    const indreR = omr.map((o) => Math.min(...o.kontur.map(([px, py]) => Math.hypot(px, py))));
    const antallStore = korn.length;
    const nett = rutenett(X0, Y0, BW, BH, Math.max(4 * rf, celle));
    korn.forEach((k, i) => nett.legg(i, k.x, k.y, k.r * S));
    let finAreal = 0;
    for (let t = 0; t < 15000 && finAreal < maalAreal && korn.length < maks + 1500; t++) {
      const ri = rf * (0.65 + 0.7 * rnd());
      const x = X0 + rnd() * BW;
      const y = Y0 + rnd() * BH;
      let ledig = true;
      nett.naboer(x, y, ri, (j) => {
        const q = korn[j]!;
        const d = Math.hypot(q.x - x, q.y - y);
        if (j >= antallStore) {
          if (d < (q.r + ri) * S) ledig = false;
        } else if (d < q.r * S * indreR[j]! - ri) {
          ledig = false;
        } else if (d < (q.r + ri) * S) {
          const f = former[j]!;
          for (let a = 0; a < 5 && ledig; a++) {
            const px = a === 4 ? x : x + ri * S * Math.cos((a * Math.PI) / 2);
            const py = a === 4 ? y : y + ri * S * Math.sin((a * Math.PI) / 2);
            if (punktIPolygon(px, py, f)) ledig = false;
          }
        }
        if (!ledig) return false;
      });
      if (!ledig) continue;
      korn.push({ x, y, r: ri, seed: Math.floor(rnd() * 1e6), rotate: rnd() * 360, u: rnd() });
      nett.legg(korn.length - 1, x, y, ri * S);
      finAreal += Math.PI * ri * ri;
    }
  }
  return korn;
}

/** Et utsnitt: en sirkel `{ x, y, r }` eller et rektangel `{ x, y, w, h }` med midten i (x, y). */
export type Utsnitt = { x: number; y: number; r: number } | { x: number; y: number; w: number; h: number };

function iUtsnitt(u: Utsnitt, px: number, py: number): boolean {
  if ('r' in u) return (px - u.x) ** 2 + (py - u.y) ** 2 <= u.r * u.r;
  return Math.abs(px - u.x) <= u.w / 2 && Math.abs(py - u.y) <= u.h / 2;
}

/**
 * Porøsiteten i et utsnitt av en pakking: andelen (0–1) av punktene i et rutenett (n × n over utsnittet) som ikke
 * ligger i noe korn. Kornformene er `kornOmriss` med samme rundhet og frø som i tegningen, så tallet passer til
 * figuren (et snitt gjennom kornene, som i et tynnslip). Ugyldig utsnitt gir null.
 */
export function porositetIUtsnitt(korn: readonly PakketKorn[], utsnitt: Utsnitt, rundhet = 0.6, n = 60): number | null {
  const bx = 'r' in utsnitt ? utsnitt.r : utsnitt.w / 2;
  const byy = 'r' in utsnitt ? utsnitt.r : utsnitt.h / 2;
  if (![utsnitt.x, utsnitt.y, bx, byy].every(Number.isFinite) || !(bx > 0 && byy > 0)) return null;
  const m = clamp(Math.floor(fin(n, 60)), 4, 300);
  const S = KORN_TEGNESKALA;
  const X0 = utsnitt.x - bx;
  const Y0 = utsnitt.y - byy;
  const relevante = korn.filter((k) => k.x + k.r * S > X0 && k.x - k.r * S < X0 + 2 * bx && k.y + k.r * S > Y0 && k.y - k.r * S < Y0 + 2 * byy);
  const former = relevante.map((k) => kornOmriss({ rundhet, seed: k.seed }).kontur.map((p) => plasser(p, k.x, k.y, k.r * S, k.rotate)));
  const rr = relevante.map((k) => k.r).sort((a, b) => a - b);
  const celle = Math.max((2 * Math.max(bx, byy)) / 40, 2 * S * (rr[Math.floor(rr.length / 2)] ?? bx));
  const nett = rutenett(X0, Y0, 2 * bx, 2 * byy, celle);
  relevante.forEach((k, i) => nett.legg(i, k.x, k.y, k.r * S));
  let tot = 0;
  let pore = 0;
  for (let i = 0; i < m; i++) {
    for (let j = 0; j < m; j++) {
      const px = X0 + ((i + 0.5) / m) * 2 * bx;
      const py = Y0 + ((j + 0.5) / m) * 2 * byy;
      if (!iUtsnitt(utsnitt, px, py)) continue;
      tot++;
      let iKorn = false;
      nett.naboer(px, py, 0, (q) => {
        const k = relevante[q]!;
        const dx = px - k.x;
        const dy = py - k.y;
        if (dx * dx + dy * dy > k.r * k.r * S * S) return;
        if (punktIPolygon(px, py, former[q]!)) {
          iKorn = true;
          return false;
        }
      });
      if (!iKorn) pore++;
    }
  }
  return tot > 0 ? pore / tot : null;
}

/* ================================================================================================ Korn */

/** Lys fra øvre venstre i SVG-koordinater (y nedover). */
const LYS: P = [-0.56, -0.83];

/** Fargene til ett korn: fyll og kant, som en bergart (`GEO.bergart[id]`). */
function kornFarge(type: MonsterId | undefined, farge?: string, kant?: string): GeoPaint {
  const c = GEO.bergart[type ?? 'sand'] ?? GEO.bergart.sand;
  return { fill: farge ?? c.fill, line: kant ?? c.line };
}

/** Toningen for et korn: lys flekk øverst til venstre, mørkere nederst til høyre. Sterkere for runde korn. */
function KornToning({ id, farge, rundhet }: { id: string; farge: string; rundhet: number }) {
  return (
    <RadialGradient
      id={id}
      cx={0.42}
      cy={0.4}
      r={0.72}
      fx={0.3}
      fy={0.26}
      stops={[
        [0, tint(farge, 0.18 + 0.3 * rundhet)],
        [0.5, farge],
        [1, shade(farge, 0.18 + 0.12 * rundhet)],
      ]}
    />
  );
}

interface KornTegningProps {
  x: number;
  y: number;
  r: number;
  omriss: KornOmriss;
  rotate: number;
  rundhet: number;
  toning: string;
  farge: GeoPaint;
  strek: number;
  flekker?: number;
  seed?: number;
}

/** Tegner ett korn med en ferdig toning: fyll, fasetter (kantete korn), glans (runde korn) og kontur. */
function KornTegning({ x, y, r, omriss, rotate, rundhet, toning, farge, strek, flekker = 0, seed = 1 }: KornTegningProps) {
  const d = kornSti(x, y, r, omriss, rotate);
  if (!d) return null;
  const kantet = 1 - rundhet;
  const n = omriss.hjorner.length;
  // Fasetter: trekanter fra et punkt litt mot lyset ut til hver kant, lyse mot lyset og mørke bort fra det
  const fasetter: ReactNode[] = [];
  if (kantet > 0.25 && r > 5) {
    const sentrum = plasser([-0.16, -0.2], x, y, r, 0);
    const t = omriss.avrunding;
    for (let i = 0; i < n; i++) {
      const V = omriss.hjorner[i]!;
      const N = omriss.hjorner[(i + 1) % n]!;
      const B: P = [V[0] + t * (N[0] - V[0]), V[1] + t * (N[1] - V[1])];
      const A: P = [N[0] + t * (V[0] - N[0]), N[1] + t * (V[1] - N[1])];
      const pts = [sentrum, plasser(omriss.spisser[i]!, x, y, r, rotate), plasser(B, x, y, r, rotate), plasser(A, x, y, r, rotate), plasser(omriss.spisser[(i + 1) % n]!, x, y, r, rotate)];
      const ex = pts[3]![0] - pts[2]![0];
      const ey = pts[3]![1] - pts[2]![1];
      const len = Math.hypot(ex, ey) || 1;
      // Utovervendt normal (omrisset går med klokka eller mot; velg den som peker bort fra midten)
      let nx = ey / len;
      let ny = -ex / len;
      const mx = (pts[2]![0] + pts[3]![0]) / 2 - x;
      const my = (pts[2]![1] + pts[3]![1]) / 2 - y;
      if (nx * mx + ny * my < 0) {
        nx = -nx;
        ny = -ny;
      }
      const b = nx * LYS[0] + ny * LYS[1];
      const fyll = b > 0 ? alpha(SCENE.highlight, 0.75 * b * kantet) : alpha(SCENE.shadow, 0.55 * -b * kantet);
      fasetter.push(<path key={i} d={`M${pts.map((p) => `${r2(p[0])} ${r2(p[1])}`).join('L')}Z`} fill={fyll} />);
    }
  }
  const prikker: ReactNode[] = [];
  if (flekker > 0 && r > 6) {
    const rnd = seededRandom(seed * 31 + 5);
    for (let i = 0; i < flekker; i++) {
      const a = rnd() * 2 * Math.PI;
      const rr = Math.sqrt(rnd()) * 0.55 * r;
      const pr = (0.05 + 0.05 * rnd()) * r;
      prikker.push(<circle key={i} cx={r2(x + rr * Math.cos(a))} cy={r2(y + rr * Math.sin(a))} r={r2(pr)} fill={shade(farge.fill, 0.45)} opacity={0.75} />);
    }
  }
  return (
    <g>
      <path d={d} fill={`url(#${toning})`} />
      {fasetter}
      {prikker}
      {rundhet > 0.45 && r > 5 && (
        <ellipse
          cx={r2(x - 0.34 * r)}
          cy={r2(y - 0.4 * r)}
          rx={r2(0.24 * r)}
          ry={r2(0.13 * r)}
          transform={`rotate(-32 ${r2(x - 0.34 * r)} ${r2(y - 0.4 * r)})`}
          fill={alpha(SCENE.highlight, 0.35 + 0.6 * (rundhet - 0.45))}
        />
      )}
      <path d={d} fill="none" stroke={farge.line} strokeWidth={r2(strek)} strokeLinejoin="round" />
    </g>
  );
}

/** Props til `Korn`. */
export interface KornProps {
  /** Midten av kornet. */
  x: number;
  y: number;
  /** Diameteren i figurens enheter (største mål), før `useGeoScale`. Standard 40. */
  d?: number;
  /** Rundheten: 0 (svært kantet) til 1 (godt rundet), eller en klasse fra `RUNDHETSKLASSER`. Standard 0,6. */
  rundhet?: number | RundhetId;
  /** Hvor avlangt kornet er: 0 = like bredt som høyt, 0,6 = tydelig avlangt. Standard 0. */
  avlang?: number;
  /** Bergarten kornet er av, for fargen (`GEO.bergart[type]`). Standard 'sand'. */
  type?: MonsterId;
  /** Egen fyllfarge (overstyrer bergarten). */
  farge?: string;
  /** Egen kantfarge. */
  kant?: string;
  /** Frø til formen (standard 1). */
  seed?: number;
  /** Dreiing i grader. */
  rotate?: number;
  /** Små mørke mineralkorn i kornet (antall, standard 0), f.eks. biotitt i et granittkorn. */
  flekker?: number;
  /** Myk skygge under kornet, når det ligger på et underlag (standard av). */
  skygge?: boolean;
  /** Ankerpunktet: `'midt'` (standard, midten av kornet) eller `'bunn'` (det laveste punktet, så kornet ligger på y). */
  anker?: 'midt' | 'bunn';
  /** Ikke gang størrelsen med `useGeoScale` (når kornet er en del av en scene i fast målestokk). */
  fastStorrelse?: boolean;
  dim?: boolean;
  /** Tekst for skjermlesere. */
  title?: string;
}

/**
 * Ett korn sett fra siden med lys fra øvre venstre: kantete korn har skarpe hjørner og lyse og mørke fasetter, runde
 * korn er jevne med glans, som stein fra en elv eller strand. Fargen er bergartens (`GEO.bergart[type]`). Størrelsen
 * ganges med `useGeoScale`, så små korn synes på mobil.
 *   <Korn x={120} y={80} d={36} rundhet="kantet" type="granitt" flekker={5} />
 *   <Korn x={300} y={bunnY} d={60} anker="bunn" skygge fastStorrelse />   // ligger på bunnen av elva
 * Ankerpunkt: (x, y) er midten av kornet (kornet ligger innenfor en sirkel med radius d/2, ganget med useGeoScale), eller
 * det laveste punktet med `anker="bunn"`.
 */
export function Korn({ x, y, d = 40, rundhet, avlang, type, farge, kant, seed = 1, rotate = 0, flekker = 0, skygge, anker = 'midt', fastStorrelse, dim, title }: KornProps) {
  const k = useGeoScale();
  const ss = useGeoStroke();
  const id = useSvgId('korn');
  const ru = rundhetVerdi(rundhet);
  const omriss = useMemo(() => kornOmriss({ rundhet: ru, avlang, seed }), [ru, avlang, seed]);
  const r = (fin(d, 40) / 2) * (fastStorrelse ? 1 : k);
  if (!(r > 0) || !Number.isFinite(x) || !Number.isFinite(y)) return null;
  const c = kornFarge(type, farge, kant);
  const lavest = Math.max(...omriss.kontur.map((p) => plasser(p, 0, 0, r, rotate)[1]));
  const cy = anker === 'bunn' ? y - lavest : y;
  const bunn = cy + lavest;
  return (
    <g opacity={dim ? 0.38 : undefined}>
      {title && <title>{title}</title>}
      {skygge && <ContactShadow cx={x + 0.08 * r} cy={bunn} rx={0.85 * r} ry={Math.max(2, 0.16 * r)} />}
      <KornToning id={id} farge={c.fill} rundhet={ru} />
      <KornTegning x={x} y={cy} r={r} omriss={omriss} rotate={rotate} rundhet={ru} toning={id} farge={c} strek={Math.max(1, 1.2 * ss * Math.min(1, r / 10))} flekker={flekker} seed={seed} />
    </g>
  );
}

/* ================================================================================================ Kornpakning */

/** Hva porene er fylt med. */
export type PoreFyll = 'vann' | 'olje' | 'gass' | 'co2' | 'luft' | 'sement' | 'leire';

/** Navnene til forklaringer og knapper. */
export const PORE_NAVN: Record<PoreFyll, string> = {
  vann: 'Vann',
  olje: 'Olje',
  gass: 'Gass',
  co2: 'CO₂',
  luft: 'Luft',
  sement: 'Sement',
  leire: 'Leire',
};

/** Fargen på væsken eller gassen i porene (lyst og mørkt tema). Sement er kalkspat, leire er vann med leirpartikler. */
export function poreFarge(fyll: PoreFyll): GeoPaint {
  switch (fyll) {
    case 'olje':
      return GEO.olje;
    case 'gass':
      return GEO.gass;
    case 'co2':
      return GEO.co2;
    case 'luft':
      return { fill: mix(VIZ.surface, SCENE.skyBottom, 0.3), line: VIZ.muted };
    case 'sement':
      return { fill: mix(GEO.bergart.marmor.fill, GEO.bergart.kalkstein.fill, 0.3), line: GEO.bergart.marmor.line };
    default:
      return GEO.grunnvann;
  }
}

/** Det `kornpakningGeometri` gir: kornene i figurens koordinater, kontaktene, utsnittet og porøsiteten. */
export interface KornpakningGeometri {
  /** Kornene i figurens koordinater (bare de som synes i utsnittet). */
  korn: PakketKorn[];
  /** Kontaktpunktene mellom korn som berører hverandre (der vann henger igjen i umettet sone). */
  kontakter: { x: number; y: number; r: number }[];
  /** Utsnittet: sirkel eller rektangel med midten i (x, y). */
  utsnitt: Utsnitt;
  /** Midlere kornradius i figuren (etter `useGeoScale`). */
  kornRadius: number;
  /** Porøsiteten i utsnittet (0–1) som `porositetIUtsnitt`, eller null. */
  porositet: number | null;
}

/** Utsnittet og kornene i en `Kornpakning`: midten (x, y), sirkel (r) eller rektangel (w, h), kornstørrelse, sortering, rundhet og frø. */
export interface KornpakningGeometriValg {
  x: number;
  y: number;
  /** Radius på en rund lupe (standard 110). */
  r?: number;
  /** Bredde og høyde gir et rektangulært utsnitt i stedet. */
  w?: number;
  h?: number;
  /** Mediankornets radius i figurens enheter, før skaleringen `k`. Standard: 1/7 av radiusen (eller av den minste siden). */
  korn?: number;
  sortering?: number;
  rundhet?: number | RundhetId;
  seed?: number;
}

/**
 * Kornene i en `Kornpakning` uten å tegne dem: til strømlinjer gjennom porene, merker på enkeltkorn eller porøsiteten i
 * en model.ts. `k` er `useGeoScale()` (kornene vokser på mobil). Ren funksjon.
 */
export function kornpakningGeometri(v: KornpakningGeometriValg, k = 1): KornpakningGeometri | null {
  const rekt = v.w !== undefined && v.h !== undefined;
  const R = fin(v.r, 110);
  const W = rekt ? fin(v.w, 0) : 2 * R;
  const H = rekt ? fin(v.h, 0) : 2 * R;
  if (!(W > 0 && H > 0) || !Number.isFinite(v.x) || !Number.isFinite(v.y)) return null;
  const kk = Number.isFinite(k) && k > 0 ? k : 1;
  const rk = Math.max(1.5, fin(v.korn, Math.min(W, H) / 14) * kk);
  const ru = rundhetVerdi(v.rundhet);
  const x0 = v.x - W / 2;
  const y0 = v.y - H / 2;
  const alle = pakkKorn({ w: W, h: H, r: rk, sortering: v.sortering, seed: v.seed, rundhet: ru });
  const utsnitt: Utsnitt = rekt ? { x: v.x, y: v.y, w: W, h: H } : { x: v.x, y: v.y, r: R };
  const korn = alle
    .map((q) => ({ ...q, x: q.x + x0, y: q.y + y0 }))
    .filter((q) => {
      if ('r' in utsnitt) return Math.hypot(q.x - utsnitt.x, q.y - utsnitt.y) < utsnitt.r + q.r;
      return Math.abs(q.x - utsnitt.x) < utsnitt.w / 2 + q.r && Math.abs(q.y - utsnitt.y) < utsnitt.h / 2 + q.r;
    });
  const kontakter: { x: number; y: number; r: number }[] = [];
  for (let i = 0; i < korn.length; i++) {
    const a = korn[i]!;
    for (let j = i + 1; j < korn.length; j++) {
      const b = korn[j]!;
      const dd = Math.hypot(b.x - a.x, b.y - a.y);
      if (dd < 0.985 * (a.r + b.r)) {
        const t = a.r / (a.r + b.r);
        kontakter.push({ x: a.x + t * (b.x - a.x), y: a.y + t * (b.y - a.y), r: 0.36 * Math.min(a.r, b.r) });
      }
    }
  }
  return { korn, kontakter, utsnitt, kornRadius: rk, porositet: porositetIUtsnitt(korn, utsnitt, ru, 50) };
}

/** Props til `Kornpakning`. */
export interface KornpakningProps extends KornpakningGeometriValg {
  /** Hva porene er fylt med (standard 'vann'). */
  fyll?: PoreFyll;
  /**
   * Tynn vannhinne rundt kornene og vann i kontaktene mellom dem: vannfuktet reservoarbergart med olje, gass eller CO₂
   * i midten av porene, eller umettet sone (luft). Standard på for olje, gass, CO₂ og luft.
   */
  vannfilm?: boolean;
  /** Sement som vokser ut fra kornene og tetter porene (0 = ingen, 1 = helt sementert). Standard 0 (1 for fyll='sement'). */
  sement?: number;
  /** Mengden leirpartikler i porene (0–1). Standard 0 (0,7 for fyll='leire'). */
  leire?: number;
  /** Bergarten kornene er av (fargen, standard 'sand'). */
  type?: MonsterId;
  /** Korn av flere mineraler: kvarts (bergartsfargen), feltspat (rosa) og noen mørke korn. Standard på. */
  blandet?: boolean;
  /** Tynn ring eller ramme rundt utsnittet (standard på; slå av inne i en `Lupe`). */
  ramme?: boolean;
  /** Målestokk nederst i utsnittet: `{ lengde, tekst }`, f.eks. `{ lengde: 60, tekst: '1 mm' }`. */
  malestokk?: { lengde: number; tekst: string };
  /** Tegnes oppå kornene, klippet til utsnittet, i figurens koordinater (f.eks. strømlinjer gjennom porene). */
  children?: ReactNode | ((g: KornpakningGeometri) => ReactNode);
  dim?: boolean;
}

/**
 * Forstørret utsnitt (lupe) av pakkede korn med porene mellom: vann, olje, gass, CO₂, luft, sement eller leire.
 * Kornene legger seg som når de synker i vann (`pakkKorn`), med sorteringen som prop: godt sorterte masser har like
 * store korn og store porer, dårlig sorterte har små korn i hullene og lavere porøsitet. Olje, gass og CO₂ tegnes med
 * en vannhinne rundt kornene (vannfuktet bergart), luft med vann i kontaktene (umettet sone). Fast frø gir samme bilde.
 *   <Kornpakning x={200} y={160} r={120} fyll="olje" sortering={0.4} rundhet="rundet" />
 * Ankerpunkt: (x, y) er midten av utsnittet (sirkel med radius r, eller rektangel w × h).
 */
export function Kornpakning(props: KornpakningProps) {
  const { fyll = 'vann', type = 'sand', blandet = true, ramme = true, malestokk, children, dim } = props;
  const k = useGeoScale();
  const ss = useGeoStroke();
  const f = useTextScale();
  const clipId = useSvgId('kornpakning');
  const bakId = useSvgId('porer');
  const kantId = useSvgId('lupekant');
  const tonId = useSvgId('korntone');
  const maskId = useSvgId('sement');
  const ru = rundhetVerdi(props.rundhet);
  const { x, y, r, w, h, korn: kornR, sortering, seed } = props;
  const g = useMemo(() => kornpakningGeometri({ x, y, r, w, h, korn: kornR, sortering, rundhet: ru, seed }, k), [x, y, r, w, h, kornR, sortering, ru, seed, k]);
  const omriss = useMemo(() => new Map((g?.korn ?? []).map((q) => [q.seed, kornOmriss({ rundhet: ru, seed: q.seed })])), [g, ru]);
  const film = props.vannfilm ?? (fyll === 'olje' || fyll === 'gass' || fyll === 'co2' || fyll === 'luft');
  const sement = clamp(fin(props.sement, fyll === 'sement' ? 1 : 0), 0, 1);
  const leire = clamp(fin(props.leire, fyll === 'leire' ? 0.7 : 0), 0, 1);
  const leirFlak = useMemo(() => {
    if (!g || leire <= 0) return [];
    const u = g.utsnitt;
    const fr = Math.max(1.5 * k, 0.15 * g.kornRadius);
    const rnd = seededRandom((seed ?? 1) * 13 + 3);
    const ut: { x: number; y: number; r: number; vinkel: number }[] = [];
    const ledig = (x: number, y: number, egen: PakketKorn | null) =>
      iUtsnitt(u, x, y) && !g.korn.some((q) => q !== egen && Math.hypot(x - q.x, y - q.y) < 0.9 * q.r * KORN_TEGNESKALA + 0.3 * fr);
    // Leirhinner: flak som ligger langs overflaten av kornene
    for (const q of g.korn) {
      if (q.r < 2.2 * fr) continue;
      const o = omriss.get(q.seed) ?? kornOmriss({ rundhet: ru, seed: q.seed });
      const omkrets = 2 * Math.PI * q.r;
      const m = Math.round((leire * 0.9 * omkrets) / (2.6 * fr));
      for (let i = 0; i < m; i++) {
        const j = Math.floor(rnd() * o.kontur.length);
        const a = plasser(o.kontur[j]!, q.x, q.y, q.r * KORN_TEGNESKALA, q.rotate);
        const b = plasser(o.kontur[(j + 1) % o.kontur.length]!, q.x, q.y, q.r * KORN_TEGNESKALA, q.rotate);
        const nx = a[0] - q.x;
        const ny = a[1] - q.y;
        const l = Math.hypot(nx, ny) || 1;
        const x = a[0] + (nx / l) * 0.45 * fr;
        const y = a[1] + (ny / l) * 0.45 * fr;
        if (!ledig(x, y, q)) continue;
        ut.push({ x, y, r: fr, vinkel: (Math.atan2(b[1] - a[1], b[0] - a[0]) * 180) / Math.PI + (rnd() - 0.5) * 25 });
      }
    }
    // Noen løse flak midt i porene
    const bw = 'r' in u ? 2 * u.r : u.w;
    const bh = 'r' in u ? 2 * u.r : u.h;
    const n = Math.round((leire * bw * bh) / (fr * fr * 60));
    placeParticles({ x: u.x - bw / 2, y: u.y - bh / 2, w: bw, h: bh }, [{ n: Math.min(400, n), r: fr }], (seed ?? 1) * 7 + 5, 0.5 * fr).forEach((p) => {
      if (ledig(p.x, p.y, null)) ut.push({ x: p.x, y: p.y, r: fr, vinkel: (p.phase * 180) / Math.PI });
    });
    return ut;
  }, [g, leire, k, seed, omriss, ru]);
  // Krystallmosaikk i sementen: Voronoi-celler som krystaller (synes bare der det er sement)
  const mosaikk = useMemo(() => {
    if (sement <= 0.05 || !g) return [];
    const rnd = seededRandom((seed ?? 1) * 17 + 11);
    const u0 = g.utsnitt;
    const bx = 'r' in u0 ? u0.r : u0.w / 2;
    const by = 'r' in u0 ? u0.r : u0.h / 2;
    const c = Math.max(4 * k, 0.75 * g.kornRadius);
    const pts: P[] = [];
    for (let i = 0; i < Math.min(1600, ((2 * bx) / c) * ((2 * by) / c)); i++) pts.push([u0.x - bx + rnd() * 2 * bx, u0.y - by + rnd() * 2 * by]);
    return voronoiCeller(pts, { x0: u0.x - bx, y0: u0.y - by, x1: u0.x + bx, y1: u0.y + by }, 3 * c).map((cell, i) => ({ d: cell.length > 2 ? `M${cell.map(([px, py]) => `${r2(px)} ${r2(py)}`).join('L')}Z` : '', lys: (i * 37) % 5 }));
  }, [g, sement, seed, k]);
  if (!g) return null;
  const u = g.utsnitt;
  const pore = poreFarge(fyll === 'sement' || fyll === 'leire' ? 'vann' : fyll);
  const bunnfarge = pore;
  const vann = GEO.grunnvann;
  const sem = poreFarge('sement');
  const rk = g.kornRadius;
  const strek = Math.max(0.8, 1.1 * ss * Math.min(1, rk / 9));
  const hovedfarge = kornFarge(type);
  const farger: GeoPaint[] = blandet ? [hovedfarge, GEO.bergart.granitt, { fill: mix(GEO.bergart.basalt.fill, GEO.bergart.kull.fill, 0.3), line: GEO.bergart.basalt.line }] : [hovedfarge];
  const fargeFor = (q: PakketKorn) => (blandet ? (q.u < 0.74 ? 0 : q.u < 0.93 ? 1 : 2) : 0);
  const ramm = 'r' in u ? { x: u.x - u.r, y: u.y - u.r, w: 2 * u.r, h: 2 * u.r } : { x: u.x - u.w / 2, y: u.y - u.h / 2, w: u.w, h: u.h };
  const formSti =
    'r' in u
      ? `M${r2(u.x - u.r)} ${r2(u.y)}a${r2(u.r)} ${r2(u.r)} 0 1 0 ${r2(2 * u.r)} 0a${r2(u.r)} ${r2(u.r)} 0 1 0 ${r2(-2 * u.r)} 0Z`
      : `M${r2(ramm.x)} ${r2(ramm.y)}h${r2(ramm.w)}v${r2(ramm.h)}h${r2(-ramm.w)}Z`;
  const filmBredde = fyll === 'luft' ? Math.max(1.4 * ss, 0.1 * rk) : Math.max(1.8 * ss, 0.16 * rk);
  const semBredde = sement >= 0.999 ? 0 : sement * 0.9 * rk;
  const kornStier = g.korn.map((q) => ({ q, d: kornSti(q.x, q.y, q.r * KORN_TEGNESKALA, omriss.get(q.seed) ?? { rundhet: ru, seed: q.seed }, q.rotate) }));
  const innhold = typeof children === 'function' ? children(g) : children;
  return (
    <g opacity={dim ? 0.38 : undefined}>
      <defs>
        <clipPath id={clipId}>
          <path d={formSti} />
        </clipPath>
      </defs>
      <LinearGradient id={bakId} stops={[[0, tint(bunnfarge.fill, 0.18)], [1, shade(bunnfarge.fill, 0.06)]]} />
      {farger.map((c, i) => (
        <KornToning key={i} id={`${tonId}-${i}`} farge={c.fill} rundhet={ru} />
      ))}
      <RadialGradient
        id={kantId}
        stops={[
          [0, SCENE.shadow, 0],
          [0.82, SCENE.shadow, 0],
          [1, SCENE.shadow, 0.55],
        ]}
      />
      <g clipPath={`url(#${clipId})`}>
        <rect x={r2(ramm.x)} y={r2(ramm.y)} width={r2(ramm.w)} height={r2(ramm.h)} fill={`url(#${bakId})`} />
        {/* Sement (kalkspat eller kvarts) som vokser ut fra kornene og tetter porene, med krystallgrenser */}
        {sement > 0.05 && (
          <g>
            <defs>
              <mask id={maskId} maskUnits="userSpaceOnUse" x={r2(ramm.x)} y={r2(ramm.y)} width={r2(ramm.w)} height={r2(ramm.h)}>
                {sement >= 0.999 ? (
                  <rect x={r2(ramm.x)} y={r2(ramm.y)} width={r2(ramm.w)} height={r2(ramm.h)} fill="white" />
                ) : (
                  <g>
                    {kornStier.map(({ q, d }) => (
                      <path key={q.seed} d={d} fill="white" stroke="white" strokeWidth={r2(2 * semBredde)} strokeLinejoin="round" />
                    ))}
                    {g.kontakter.map((c, i) => (
                      <circle key={i} cx={r2(c.x)} cy={r2(c.y)} r={r2(c.r * (0.8 + 2 * sement))} fill="white" />
                    ))}
                  </g>
                )}
              </mask>
            </defs>
            <g mask={`url(#${maskId})`}>
              <rect x={r2(ramm.x)} y={r2(ramm.y)} width={r2(ramm.w)} height={r2(ramm.h)} fill={sem.fill} />
              {mosaikk.map((c, i) => (c.d ? <path key={i} d={c.d} fill={c.lys > 2 ? tint(sem.fill, 0.05 * (c.lys - 2)) : shade(sem.fill, 0.03 * c.lys)} stroke={alpha(sem.line, 0.45)} strokeWidth={r2(0.7 * ss)} strokeLinejoin="round" /> : null))}
            </g>
          </g>
        )}
        {/* Vannhinne rundt kornene og vann i kontaktene */}
        {film && (
          <g>
            {g.kontakter.map((c, i) => (
              <circle key={i} cx={r2(c.x)} cy={r2(c.y)} r={r2(c.r * (fyll === 'luft' ? 1 : 1.35))} fill={vann.fill} />
            ))}
            {kornStier.map(({ q, d }) => (
              <path key={q.seed} d={d} fill={vann.fill} stroke={vann.fill} strokeWidth={r2(2 * filmBredde)} strokeLinejoin="round" />
            ))}
          </g>
        )}
        {/* Leirpartikler i porene */}
        {leirFlak.map((p, i) => (
          <rect
            key={i}
            x={r2(p.x - 1.3 * p.r)}
            y={r2(p.y - 0.38 * p.r)}
            width={r2(2.6 * p.r)}
            height={r2(0.76 * p.r)}
            rx={r2(0.3 * p.r)}
            transform={`rotate(${r2(p.vinkel)} ${r2(p.x)} ${r2(p.y)})`}
            fill={mix(GEO.bergart.leire.fill, GEO.bergart.leire.line, 0.35)}
            stroke={GEO.bergart.leire.line}
            strokeWidth={r2(0.6 * ss)}
          />
        ))}
        {kornStier.map(({ q }) => {
          const ci = fargeFor(q);
          const c = farger[ci]!;
          return (
            <KornTegning
              key={q.seed}
              x={q.x}
              y={q.y}
              r={q.r * KORN_TEGNESKALA}
              omriss={omriss.get(q.seed) ?? kornOmriss({ rundhet: ru, seed: q.seed })}
              rotate={q.rotate}
              rundhet={ru}
              toning={`${tonId}-${ci}`}
              farge={c}
              strek={strek}
            />
          );
        })}
        {innhold}
        {ramme && <path d={formSti} fill={`url(#${kantId})`} />}
      </g>
      {malestokk && malestokk.lengde > 0 && <Malestokk x={u.x} y={ramm.y + ramm.h - 16 * f} lengde={malestokk.lengde} tekst={malestokk.tekst} />}
      {ramme && <path d={formSti} fill="none" stroke={SCENE.outline} strokeWidth={r2(1.6 * ss)} />}
    </g>
  );
}

/**
 * Liten målestokk med tekst over, sentrert om x (til Kornpakning og Lupe). `y` er streken. Hvit glorie, så den
 * synes på korn og porer i begge temaer.
 */
export function Malestokk({ x, y, lengde, tekst, farge = VIZ.ink }: { x: number; y: number; lengde: number; tekst: string; farge?: string }) {
  const ss = useGeoStroke();
  if (![x, y, lengde].every(Number.isFinite) || !(lengde > 0)) return null;
  const x0 = x - lengde / 2;
  const x1 = x + lengde / 2;
  const t = 5 * ss;
  const d = `M${r2(x0)} ${r2(y - t)}V${r2(y)}H${r2(x1)}V${r2(y - t)}`;
  return (
    <g>
      <path d={d} fill="none" stroke={VIZ.surface} strokeWidth={r2(5 * ss)} strokeLinejoin="round" strokeLinecap="round" opacity={0.85} />
      <path d={d} fill="none" stroke={farge} strokeWidth={r2(2 * ss)} strokeLinejoin="round" />
      <Txt x={x} y={y - t - 5} size={0.78} color={farge} weight={600}>
        {tekst}
      </Txt>
    </g>
  );
}

/* ================================================================================================ Kornkurve */

/** Én kurve i `Kornkurve`. */
export interface KornkurveSerie {
  /** Punktene: fra `kumulativKurve` (sikteanalyse) eller `lognormalKurve`. */
  punkter: readonly KurvePunkt[];
  /** Navnet i forklaringen («Strandsand»). */
  navn?: string;
  /** Fargen (standard `VIZ.series[i]`). */
  farge?: string;
  stiplet?: boolean;
  /** Prikker ved siktene. Standard: når kurven har 16 punkter eller færre. */
  merker?: boolean;
  dim?: boolean;
}

/** Props til `Kornkurve`. */
export interface KornkurveProps {
  kurver: readonly KornkurveSerie[];
  /** Standard 800. */
  width?: number;
  /** Standard `geoHoyde(f, 340)`, høyere på mobil. */
  height?: number;
  /** Øvre venstre hjørne. */
  at?: readonly [number, number];
  /** Minste og største kornstørrelse på aksen (mm). Standard 0,001 og 100. */
  dMin?: number;
  dMax?: number;
  /** Kornklassene (leire, silt, sand, grus …) som fargede bånd med navn over diagrammet. Standard på. */
  baand?: boolean;
  /** Persentiler som leses av på kurven `persentilKurve` med stiplede linjer, f.eks. [10, 60] for d₁₀ og d₆₀. */
  persentiler?: readonly number[];
  /** Hvilken kurve persentilene leses av på (standard 0). */
  persentilKurve?: number;
  /** Loddrette streker ved maskevidden til siktene (mm). */
  sikter?: readonly number[];
  /** Forklaring med navnene inne i diagrammet (standard på når en kurve har navn). */
  forklaring?: boolean;
  /**
   * Hvor forklaringen står: `'auto'` (standard: under diagrammet på mobil med to eller flere navn, ellers det hjørnet
   * kurvene og avlesningene ikke går gjennom), `'oppe-venstre'`, `'nede-hoyre'` eller `'under'` (rader under aksetittelen;
   * diagrammet blir da lavere innenfor samme høyde).
   */
  forklaringPlass?: 'auto' | 'oppe-venstre' | 'nede-hoyre' | 'under';
  /** Ekstra innhold i diagrammets skalaer. */
  children?: (s: LogPlotSkalaer) => ReactNode;
}

/** Fargen til båndet for en kornklasse: samme som mønsteret for klassen (leire, silt, sand, grus, ur). */
const BAAND_MONSTER: Record<KornklasseId, MonsterId> = { leire: 'leire', silt: 'siltstein', sand: 'sand', grus: 'grus', stein: 'ur', blokk: 'ur' };

/** Diameter i mm med passe mange desimaler: 25, 2,5, 0,15, 0,012. */
export function fmtMm(d: number): string {
  if (!Number.isFinite(d) || d <= 0) return '–';
  const des = clamp(Math.ceil(-Math.log10(d)) + 1, 0, 4);
  return fmt(d, des);
}

/**
 * Kumulativ kornfordeling (prosent gjennomgang mot kornstørrelse på logaritmisk akse) som i en sikteanalyse, med
 * kornklassene leire, silt, sand og grus (og stein) som bånd og navnene over diagrammet. Kurvene får prikker ved siktene,
 * og persentiler (d₁₀, d₆₀ …) kan leses av med stiplede linjer. Bygd på `LogPlot`; høyden vokser på mobil.
 *   <Kornkurve kurver={[{ punkter: kumulativKurve(sikter, masser, bunn)!, navn: 'Prøve A' }]} persentiler={[10, 60]} />
 * Ankerpunkt: `at` er øvre venstre hjørne (standard 0, 0).
 */
export function Kornkurve({ kurver, width = 800, height, at, dMin = 0.001, dMax = 100, baand = true, persentiler, persentilKurve = 0, sikter, forklaring, forklaringPlass = 'auto', children }: KornkurveProps) {
  const f = useTextScale();
  const ss = useGeoStroke();
  const k = useGeoScale();
  const H = height ?? geoHoyde(f, 340);
  const lo = Number.isFinite(dMin) && dMin > 0 ? dMin : 0.001;
  const hi = Number.isFinite(dMax) && dMax > lo ? dMax : lo * 1e5;
  const navnPx = 17 * 0.8 * f;
  const baandTopp = baand ? navnPx + 10 : 0;
  const visForklaring = forklaring ?? kurver.some((c) => c.navn);
  const navngitte = kurver.map((c, i) => ({ c, i })).filter(({ c }) => c.navn);
  const radH = 20 * f;
  const under = visForklaring && navngitte.length > 0 && (forklaringPlass === 'under' || (forklaringPlass === 'auto' && f > 1.3 && navngitte.length >= 2));
  // Rader med forklaringen under aksetittelen: elementene brytes når de ikke får plass
  const underRader: { i: number; x: number }[][] = [];
  if (under) {
    let rad: { i: number; x: number }[] = [];
    let x = 0;
    const maks = width - 40;
    for (const { c, i } of navngitte) {
      const b = 34 + tekstBredde(c.navn ?? '', navnPx) + 26;
      if (rad.length && x + b > maks) {
        underRader.push(rad);
        rad = [];
        x = 0;
      }
      rad.push({ i, x });
      x += b;
    }
    if (rad.length) underRader.push(rad);
  }
  const bunnStd = 22 * f + 10 + 15.6 * f * 1.1;
  const underHoyde = under ? underRader.length * radH + 10 : 0;
  return (
    <LogPlot
      width={width}
      height={H}
      at={at}
      x={{ min: lo, max: hi, log: true, label: 'Kornstørrelse (mm)' }}
      y={{ min: 0, max: 100, label: 'Gjennomgang (%)', ticks: [0, 20, 40, 60, 80, 100] }}
      margin={{ top: 12 * f + baandTopp, ...(under ? { bottom: bunnStd + underHoyde } : {}) }}
    >
      {(s) => {
        const klasser = KORNKLASSER.map((kk) => ({ kk, a: Math.max(kk.min, lo), b: Math.min(kk.max ?? hi, hi) })).filter((c) => c.b > c.a);
        // Navnene over båndene: midt i båndet, skjøvet til siden når båndet er for smalt
        const etiketter = klasser.map((c) => {
          const tekst = c.kk.navn.charAt(0).toUpperCase() + c.kk.navn.slice(1);
          const bredde = tekstBredde(tekst, navnPx);
          return { tekst, bredde, midt: (s.sx(c.a) + s.sx(c.b)) / 2, id: c.kk.id };
        });
        const venstre = etiketter.map((e) => e.midt - e.bredde / 2);
        for (let i = 0; i < etiketter.length; i++) {
          const min = i === 0 ? s.x0 : venstre[i - 1]! + etiketter[i - 1]!.bredde + 8;
          venstre[i] = Math.max(venstre[i]!, min);
        }
        for (let i = etiketter.length - 1; i >= 0; i--) {
          const max = i === etiketter.length - 1 ? s.x1 - etiketter[i]!.bredde : venstre[i + 1]! - etiketter[i]!.bredde - 8;
          venstre[i] = Math.min(venstre[i]!, max);
        }
        const pk = kurver[persentilKurve];
        const pFarge = pk ? (pk.farge ?? VIZ.series[persentilKurve % VIZ.series.length]!) : VIZ.ink;
        const fBredde = Math.max(0, ...navngitte.map(({ c }) => tekstBredde(c.navn ?? '', navnPx))) + 46;
        const fHoyde = navngitte.length * radH + 10;
        // Forklaringen i det hjørnet der færrest kurvepunkter og avlesninger ligger
        const hindringer: P[] = [];
        for (const c of kurver) {
          const pts = [...c.punkter].filter((q) => Number.isFinite(q.d) && q.d > 0 && Number.isFinite(q.gjennomgang)).sort((a, b) => a.d - b.d);
          for (let i = 0; i < pts.length; i++) {
            const a = pts[i]!;
            hindringer.push([s.sx(a.d), s.sy(a.gjennomgang)]);
            const b = pts[i + 1];
            if (b) for (let t = 0.2; t < 1; t += 0.2) hindringer.push([s.sx(Math.exp(Math.log(a.d) + t * (Math.log(b.d) - Math.log(a.d)))), s.sy(a.gjennomgang + t * (b.gjennomgang - a.gjennomgang))]);
          }
        }
        for (const p of persentiler ?? []) for (let t = 0; t <= 1; t += 0.1) hindringer.push([s.x0 + 8 + t * 150 * f, s.sy(p) - 10]);
        const hjorner = { 'oppe-venstre': [s.x0 + 10, s.y1 + 8], 'nede-hoyre': [s.x1 - 10 - fBredde, s.y0 - 8 - fHoyde] } as const;
        const treff = (hj: readonly [number, number]) => hindringer.filter(([hx, hy]) => hx > hj[0] - 4 && hx < hj[0] + fBredde + 4 && hy > hj[1] - 4 && hy < hj[1] + fHoyde + 4).length;
        const plass = forklaringPlass === 'oppe-venstre' || forklaringPlass === 'nede-hoyre' ? forklaringPlass : treff(hjorner['nede-hoyre']) < treff(hjorner['oppe-venstre']) ? 'nede-hoyre' : 'oppe-venstre';
        const [fx0, fy0] = hjorner[plass];
        const underY = s.y0 + bunnStd + 4;
        const underB = Math.max(0, ...underRader.map((rad) => { const siste = rad[rad.length - 1]!; return siste.x + 34 + tekstBredde(kurver[siste.i]?.navn ?? '', navnPx); }));
        const underX0 = (s.x0 + s.x1) / 2 - underB / 2;
        return (
          <g>
            {baand &&
              klasser.map((c, i) => {
                const m = BAAND_MONSTER[c.kk.id];
                return (
                  <g key={c.kk.id}>
                    <rect x={r2(s.sx(c.a))} y={r2(s.y1)} width={r2(s.sx(c.b) - s.sx(c.a))} height={r2(s.y0 - s.y1)} fill={alpha(GEO.bergart[m].fill, i % 2 ? 0.5 : 0.32)} />
                    {c.a > lo && <line x1={r2(s.sx(c.a))} x2={r2(s.sx(c.a))} y1={r2(s.y0)} y2={r2(s.y1 - baandTopp + 4)} stroke={VIZ.muted} strokeWidth={r2(1.1 * ss)} strokeDasharray="5 4" />}
                    <Txt x={r2(venstre[i]! + etiketter[i]!.bredde / 2)} y={r2(s.y1 - 7)} size={0.8} weight={600} color={GEO.bergart[m].line}>
                      {etiketter[i]!.tekst}
                    </Txt>
                  </g>
                );
              })}
            {sikter?.map((d) =>
              Number.isFinite(d) && d >= lo && d <= hi ? (
                <line key={d} x1={r2(s.sx(d))} x2={r2(s.sx(d))} y1={r2(s.y0)} y2={r2(s.y1)} stroke={VIZ.muted} strokeWidth={r2(1 * ss)} strokeDasharray="2 4" opacity={0.8} />
              ) : null,
            )}
            <g clipPath={s.clip}>
              {kurver.map((c, i) => {
                const farge = c.farge ?? VIZ.series[i % VIZ.series.length]!;
                const pts = [...c.punkter].filter((p) => Number.isFinite(p.d) && p.d > 0 && Number.isFinite(p.gjennomgang)).sort((a, b) => a.d - b.d);
                const merker = c.merker ?? pts.length <= 16;
                return (
                  <g key={i} opacity={c.dim ? 0.35 : undefined}>
                    <path d={linePath(pts.map((p) => [p.d, p.gjennomgang]), s.sx, s.sy)} fill="none" stroke={VIZ.surface} strokeWidth={r2(6 * ss)} strokeLinejoin="round" opacity={0.7} />
                    <path
                      d={linePath(pts.map((p) => [p.d, p.gjennomgang]), s.sx, s.sy)}
                      fill="none"
                      stroke={farge}
                      strokeWidth={r2(3 * ss)}
                      strokeLinejoin="round"
                      strokeDasharray={c.stiplet ? '10 6' : undefined}
                    />
                    {merker &&
                      pts.map((p) =>
                        p.d >= lo && p.d <= hi ? <circle key={p.d} cx={r2(s.sx(p.d))} cy={r2(s.sy(p.gjennomgang))} r={r2(4.5 * k)} fill={farge} stroke={VIZ.surface} strokeWidth={r2(1.5 * ss)} /> : null,
                      )}
                  </g>
                );
              })}
            </g>
            {pk &&
              persentiler?.map((p) => {
                const d = dPersentil(pk.punkter, p);
                if (d === null || d < lo || d > hi) return null;
                const px = s.sx(d);
                const py = s.sy(p);
                return (
                  <g key={p}>
                    <path d={`M${r2(s.x0)} ${r2(py)}H${r2(px)}V${r2(s.y0)}`} fill="none" stroke={pFarge} strokeWidth={r2(1.6 * ss)} strokeDasharray="6 5" />
                    <circle cx={r2(px)} cy={r2(py)} r={r2(5 * k)} fill={VIZ.surface} stroke={pFarge} strokeWidth={r2(2.2 * ss)} />
                    <Txt x={r2(s.x0 + 8)} y={r2(py - 7)} anchor="start" size={0.8} weight={600} color={pFarge}>
                      d<TSub>{fmt(p, 0)}</TSub> = {fmtMm(d)} mm
                    </Txt>
                  </g>
                );
              })}
            {under &&
              underRader.map((rad, ri) =>
                rad.map(({ i, x }) => {
                  const c = kurver[i]!;
                  const farge = c.farge ?? VIZ.series[i % VIZ.series.length]!;
                  const yy = underY + (ri + 0.5) * radH;
                  return (
                    <g key={i} opacity={c.dim ? 0.45 : undefined}>
                      <line x1={r2(underX0 + x)} x2={r2(underX0 + x + 26)} y1={r2(yy)} y2={r2(yy)} stroke={farge} strokeWidth={r2(3 * ss)} strokeDasharray={c.stiplet ? '7 4' : undefined} />
                      <Txt x={r2(underX0 + x + 32)} y={r2(yy + 5 * f)} anchor="start" size={0.8}>
                        {c.navn}
                      </Txt>
                    </g>
                  );
                }),
              )}
            {visForklaring && !under && navngitte.length > 0 && (
              <g>
                <rect
                  x={r2(fx0)}
                  y={r2(fy0)}
                  width={r2(fBredde)}
                  height={r2(fHoyde)}
                  rx={6}
                  fill={alpha(VIZ.surface, 0.88)}
                  stroke={VIZ.grid}
                  strokeWidth={r2(ss)}
                />
                {navngitte.map(({ c, i }, n) => {
                  const farge = c.farge ?? VIZ.series[i % VIZ.series.length]!;
                  const yy = fy0 + 5 + (n + 0.5) * radH;
                  return (
                    <g key={i} opacity={c.dim ? 0.45 : undefined}>
                      <line x1={r2(fx0 + 8)} x2={r2(fx0 + 34)} y1={r2(yy)} y2={r2(yy)} stroke={farge} strokeWidth={r2(3 * ss)} strokeDasharray={c.stiplet ? '7 4' : undefined} />
                      <Txt x={r2(fx0 + 40)} y={r2(yy + 5 * f)} anchor="start" size={0.8} halo={false}>
                        {c.navn}
                      </Txt>
                    </g>
                  );
                })}
              </g>
            )}
            {children?.(s)}
          </g>
        );
      }}
    </LogPlot>
  );
}
