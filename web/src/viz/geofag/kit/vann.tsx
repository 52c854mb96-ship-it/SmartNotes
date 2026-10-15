/**
 * Vann i geofagfigurene: grunnvann i snitt (`Grunnvannssnitt` med umettet sone, kapillærsone, grunnvannsspeil og
 * mettet sone), brønner i snitt (`Bronn`: borebrønn i fjell, løsmassebrønn, gravd brønn, observasjonsbrønn, energibrønn
 * og borehull), nedbør med skydekke (`Nedbor`, `Skydekke`) og strømmer langs en sti (`Stromlinjer`: grunnvann,
 * isstrøm, mantelstrøm, karbon- og vannstrømmer, bølgefronter).
 *
 * Samme stil som scene-kit-et og Snittblokk: toninger fra core.tsx, kontur, lys fra øvre venstre og myk skygge, ingen
 * filtre og ingen bilder. Flater bruker GEO- og SCENE-fargene; strømmene får fargen fra kapittelet (VIZ.velocity for
 * farter og strømning, GEO.nedbor, GEO.fordamping … i kretsløp). Regn og snø bygger på Regn og Snofall i
 * fysikk/kap02/fore-og-bremsing-deler.tsx (kopiert, ikke importert).
 */
import { memo, useMemo, type CSSProperties, type ReactNode } from 'react';
import { useTextScale } from '../../kit/controls';
import { VIZ } from '../../kit/colors';
import { Txt } from '../../kit/txt';
import { ContactShadow, LinearGradient, RadialGradient, alpha, mix, sceneRandom, shade, tint, useSvgId } from '../../kit/scene/core';
import { PAINTS, SCENE } from '../../kit/scene/palette';
import { GEO } from './colors';
import { tekstBredde } from './diagram';
import { useGeoScale, useGeoStroke } from './felles';
import { LagFlate, LagMonstre, useLagMonstre } from './monstre';
import { SnittEtiketter, snittblokkPerspektiv, type SnittEtikett, type SnittKurve, type SnittPunkt } from './snitt';
import type { MonsterId } from './typer';

type Fn = (x: number) => number;
type P = readonly [number, number];

const r2 = (v: number) => Math.round(v * 100) / 100;
const fin = (v: number | undefined, d: number) => (v !== undefined && Number.isFinite(v) ? v : d);
const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
const mod = (a: number, n: number) => (n > 0 ? ((a % n) + n) % n : 0);
const sti = (p: readonly P[], lukket = false) =>
  p.length < 2 ? '' : `${p.map(([px, py], i) => `${i ? 'L' : 'M'}${r2(px)} ${r2(py)}`).join('')}${lukket ? 'Z' : ''}`;

/** En kurve (tall eller funksjon av x) som funksjon som alltid gir et endelig tall. */
function somFn(k: SnittKurve | undefined, d: number): Fn {
  if (typeof k === 'function') {
    return (x: number) => {
      const v = k(x);
      return Number.isFinite(v) ? v : d;
    };
  }
  const c = fin(k, d);
  return () => c;
}

function linspace(a: number, b: number, n: number): number[] {
  const m = Math.max(1, Math.round(n));
  return Array.from({ length: m + 1 }, (_, i) => a + ((b - a) * i) / m);
}

/* =====================================================================================================================
 * Grunnvann: geometri
 * ================================================================================================================== */

/** Én brønn som senker grunnvannsspeilet (alle mål i figurens enheter). */
export interface Senkning {
  /** Midten av brønnen. */
  x: number;
  /** Hvor mye speilet senkes ved brønnen (positiv = nedover). */
  senkning: number;
  /** Influensradius R: der senkningen er 0. */
  radius: number;
  /** Radien til brønnen (standard 4): senkningen er full innenfor den. */
  rBronn?: number;
}

/**
 * Grunnvannsspeil med senkningstrakt rundt én eller flere brønner som pumper: speilet `speil` (tall eller y(x)) senket
 * med s(r) = s₀ · ln(R / r) / ln(R / r_b) for r_b ≤ r ≤ R (Thiems likning for et åpent magasin, forenklet), og summen
 * når traktene overlapper. Gir en funksjon y(x) som kan gis rett til `speil` på Grunnvannssnitt:
 *   speil={senkningstrakt(140, { x: 300, senkning: 40, radius: 220 })}
 * Brønner med radius ≤ 0 eller ugyldige tall hoppes over, så funksjonen gir aldri NaN.
 */
export function senkningstrakt(speil: SnittKurve, ...bronner: readonly Senkning[]): Fn {
  const base = somFn(speil, 0);
  const gyldige = bronner
    .filter((b) => Number.isFinite(b.x) && Number.isFinite(b.senkning) && Number.isFinite(b.radius) && b.radius > 0)
    .map((b) => {
      const rb = clamp(fin(b.rBronn, 4), 0.25, b.radius * 0.5);
      return { x: b.x, s: b.senkning, R: b.radius, rb, ln: Math.log(b.radius / rb) };
    });
  return (x: number) => {
    let yy = base(x);
    if (!Number.isFinite(x)) return yy;
    for (const b of gyldige) {
      const r = Math.max(Math.abs(x - b.x), b.rb);
      if (r >= b.R || !(b.ln > 0)) continue;
      yy += (b.s * Math.log(b.R / r)) / b.ln;
    }
    return yy;
  };
}

/** En innsjø eller elv der grunnvannsspeilet står over bakken: fra og til (x) og vannflaten (y). */
export interface GrunnvannInnsjo {
  fra: number;
  til: number;
  niva: number;
}

/** Valgene til `grunnvannGeometri` (de samme som på Grunnvannssnitt). */
export interface GrunnvannGeometriValg {
  w: number;
  h: number;
  overflate?: SnittKurve;
  speil?: SnittKurve;
  kapillar?: number | false;
}

/** Geometrien i et grunnvannssnitt (snittets koordinater, y nedover). */
export interface GrunnvannGeometri {
  /** Bakken (y) ved x, med innsjøbunnen. */
  overflate: Fn;
  /** Grunnvannsspeilet (y) ved x, begrenset til snittet. */
  speil: Fn;
  /** Toppen av kapillærsonen (y) ved x (lik speilet uten kapillærsone, aldri over bakken). */
  kapillarTopp: Fn;
  /** Tykkelsen på kapillærsonen (figurens enheter). */
  kapillar: number;
  /** Innsjøer og elver der speilet står over bakken. */
  innsjoer: GrunnvannInnsjo[];
  /** Toppen av det som synes ved x: vannflaten i en innsjø, ellers bakken. */
  topp: Fn;
  /** Avstanden fra bakken ned til speilet (0 i innsjøene). */
  dybdeTilSpeil: Fn;
}

/**
 * Geometrien i et Grunnvannssnitt som ren funksjon: bakken, speilet, kapillærsonen og innsjøene der speilet står over
 * bakken (vannflaten er vannrett, i høyden der speilet møter bakken). Bruk den til å sette brønner, hus og piler på
 * riktig sted: `const g = grunnvannGeometri({ w, h, overflate, speil }); <Bronn x={300} y={g.overflate(300)} …/>`.
 * Standard bakke 0,15 · h, speil 0,45 · h og kapillærsone 0,05 · h (6–28). Gir aldri NaN.
 */
export function grunnvannGeometri({ w, h, overflate, speil, kapillar }: GrunnvannGeometriValg): GrunnvannGeometri {
  const W = Math.max(1, fin(w, 1));
  const H = Math.max(1, fin(h, 1));
  const ov0 = somFn(overflate, 0.15 * H);
  const sp0 = somFn(speil, 0.45 * H);
  const ov: Fn = (x) => clamp(ov0(x), -H, H);
  const sp: Fn = (x) => clamp(sp0(x), -H, H);
  const kap = kapillar === false ? 0 : clamp(fin(kapillar, clamp(0.05 * H, 6, 28)), 0, H);

  // Innsjøene: der speilet står over bakken (mindre y), funnet ved sampling og lineær interpolasjon av kantene
  const n = clamp(Math.round(W / 3), 60, 400);
  const xs = linspace(0, W, n);
  const d = xs.map((x) => ov(x) - sp(x)); // > 0: speilet over bakken
  const innsjoer: GrunnvannInnsjo[] = [];
  let start: number | null = null;
  const kryss = (i: number) => {
    const a = d[i - 1]!;
    const b = d[i]!;
    const t = a === b ? 0.5 : a / (a - b);
    return xs[i - 1]! + clamp(t, 0, 1) * (xs[i]! - xs[i - 1]!);
  };
  for (let i = 0; i < xs.length; i++) {
    const over = d[i]! > 0.01;
    if (over && start === null) start = i === 0 ? 0 : kryss(i);
    if (!over && start !== null) {
      innsjoer.push(lagInnsjo(start, kryss(i), start === 0, false, sp, ov));
      start = null;
    }
  }
  if (start !== null) innsjoer.push(lagInnsjo(start, W, start === 0, true, sp, ov));
  const ekte = innsjoer.filter((s) => s.til - s.fra > 0.5);

  const innsjoVed = (x: number) => ekte.find((s) => x >= s.fra && x <= s.til);
  const topp: Fn = (x) => {
    const s = innsjoVed(x);
    return s ? Math.min(s.niva, ov(x)) : ov(x);
  };
  return {
    overflate: ov,
    speil: sp,
    kapillar: kap,
    kapillarTopp: (x) => Math.max(ov(x), sp(x) - kap),
    innsjoer: ekte,
    topp,
    dybdeTilSpeil: (x) => Math.max(0, sp(x) - ov(x)),
  };
}

function lagInnsjo(fra: number, til: number, vKant: boolean, hKant: boolean, sp: Fn, ov: Fn): GrunnvannInnsjo {
  // Vannflaten ligger der speilet møter bakken (lik i begge ender for en symmetrisk dal); mot kanten av snittet brukes
  // den indre bredden, og står hele overflaten under vann, brukes midten av speilet.
  let niva: number;
  if (!vKant && !hKant) niva = (sp(fra) + sp(til) + ov(fra) + ov(til)) / 4;
  else if (vKant && !hKant) niva = (sp(til) + ov(til)) / 2;
  else if (!vKant && hKant) niva = (sp(fra) + ov(fra)) / 2;
  else niva = sp((fra + til) / 2);
  return { fra, til, niva: Number.isFinite(niva) ? niva : 0 };
}

/* =====================================================================================================================
 * Grunnvannssnitt
 * ================================================================================================================== */

/** Ett lag i grunnvannssnittet, eldste først (som i Snittblokk). Det yngste laget går opp til bakken. */
export interface GrunnLag {
  /** Mønsteret (sand, grus, morene, leire, granitt …). */
  type: MonsterId;
  /** Toppen av laget (tall eller y(x)). Ikke nødvendig for det yngste laget, som går opp til bakken. */
  topp?: SnittKurve;
  /** Navn i etikettkolonnen (bare med `etiketter="hoyre"`). */
  navn?: string;
  /** Tett lag (leire, tett fjell): tegnes uten vannfarge, så det skiller seg fra magasinet. */
  tett?: boolean;
  /** Ton ned laget. */
  dim?: boolean;
}

const STANDARD_LAG: readonly GrunnLag[] = [{ type: 'sand' }];

/** Løsmassene: vannet fyller porene (klar blåfarge). I berggrunnen står vannet i sprekker (gråere blå). */
const LOSMASSE: ReadonlySet<MonsterId> = new Set<MonsterId>(['morene', 'breelv', 'leire', 'kvikkleire', 'silt', 'sand', 'grus', 'torv', 'ur', 'aske']);

/** Props til `Grunnvannssnitt`. Alle y-verdier er i snittets koordinater (0 = toppen av boksen, y nedover). */
export interface GrunnvannssnittProps {
  /** Øverste venstre hjørne av snittet foran (standard 0, 0). */
  x?: number;
  y?: number;
  /** Bredde og høyde på snittet foran. Bunnen av snittet er i y + h. */
  w: number;
  h: number;
  /** Bakken (tall eller y(x)). Standard 0,15 · h. */
  overflate?: SnittKurve;
  /**
   * Grunnvannsspeilet (tall eller y(x)): en funksjon kan vise et skrånende speil eller en senkningstrakt
   * (`senkningstrakt`). Der speilet står over bakken, blir det innsjø eller elv. Standard 0,45 · h.
   */
  speil?: SnittKurve;
  /** Tykkelsen på kapillærsonen over speilet (figurens enheter), eller false. Standard 0,05 · h (6–28). */
  kapillar?: number | false;
  /** Lagene, eldste først (standard ett lag sand). Det yngste går opp til bakken. */
  lag?: readonly GrunnLag[];
  /** Det som dekker bakken: 'gress' (standard), 'jord', 'sno' eller 'ingen' (det øverste laget synes). */
  mark?: 'gress' | 'jord' | 'sno' | 'ingen';
  /** Innsjø eller elv der speilet står over bakken (standard på). */
  overflatevann?: boolean;
  /** Fargelegg sonene (umettet, kapillær og mettet). Standard på. */
  soner?: boolean;
  /** X for grunnvannsspeil-symbolet (▽ med to streker under), eller false. Standard: et sted med plass til venstre. */
  speilMerke?: number | false;
  /**
   * Sonenavnene: 'hoyre' (kolonne til høyre for blokka fra x + w + dx + 16, med lagnavnene; trenger ca. 160 enheter,
   * mer på mobil), 'inne' (i sonene ved `etikettX`, og «Grunnvannsspeil» like over speilet der det er flatt og ledig,
   * borte fra `unnga` og sonenavnene; uten ledig plass står den like under speilet, ellers sløyfes den) eller false
   * (standard).
   */
  etiketter?: 'hoyre' | 'inne' | false;
  /**
   * X-er i snittet (brønner, hus, piler) som «Grunnvannsspeil» skal holde seg unna med `etiketter="inne"`, f.eks.
   * brønnenes x fra `bronnPunkter`.
   */
  unnga?: readonly number[];
  /** Hvor etikettene peker (x i snittet). Standard nær høyre kant ('hoyre') eller venstre kant ('inne'). */
  etikettX?: number;
  /** Hvor langt blokka går innover (standard 0,08 · w, høyst 70). 0 gir et flatt snitt. */
  dybde?: number;
  /** Vinkelen på bakkanten (grader, standard 34). */
  vinkel?: number;
  /** Myk skygge under blokka (standard på). */
  skygge?: boolean;
  dim?: boolean;
  /** Tegnes i snittets koordinater og klippes til bakken og vannet (strømlinjer, forurensning, brønner under bakken). */
  children?: ReactNode;
  /** Tegnes oppå i snittets koordinater uten klipping (brønner, hus, nedbør, piler over bakken). */
  over?: ReactNode;
}

/**
 * Grunnvann i snitt, som i læreboka: lagene (sand, grus, morene, fjell …) med mønster, umettet sone (porer med luft),
 * kapillærsone, grunnvannsspeilet (blå linje med ▽) og mettet sone (blå), gress på toppen i svakt perspektiv og innsjø
 * eller elv der speilet står over bakken. Speilet kan være et tall, en skråning eller en senkningstrakt. Bakken og
 * speilet kan være nye pilfunksjoner i hver render (en trakt som følger pumperaten): geometrien huskes etter verdiene
 * langs snittet, ikke etter hvilken funksjon det er.
 *
 * Ankerpunkt: (x, y) er øverste venstre hjørne av snittet foran, som i Snittblokk. Et punkt (sx, sy) i snittet står i
 * (x + sx, y + sy); bakkanten er forskjøvet (dx, −dy) fra `snittblokkPerspektiv(dybde, vinkel)`. Bruk
 * `grunnvannGeometri` med de samme verdiene for å sette brønner og piler (`over`), og barna for det som skal klippes til
 * bakken:
 *   const g = grunnvannGeometri({ w: 600, h: 300, overflate, speil });
 *   <Grunnvannssnitt x={20} y={40} w={600} h={300} overflate={overflate} speil={speil} etiketter="hoyre"
 *     lag={[{ type: 'granitt', topp: 250, navn: 'Fjell' }, { type: 'sand', navn: 'Sand' }]}
 *     over={<Bronn x={200} y={g.overflate(200)} bunn={240} vannstand={g.speil(200)} type="losmasse" />} />
 */
export function Grunnvannssnitt({
  x = 0,
  y = 0,
  w,
  h,
  overflate,
  speil,
  kapillar,
  lag = STANDARD_LAG,
  mark = 'gress',
  overflatevann = true,
  soner = true,
  speilMerke,
  etiketter = false,
  etikettX,
  unnga,
  dybde,
  vinkel,
  skygge = true,
  dim,
  children,
  over,
}: GrunnvannssnittProps) {
  const f = useTextScale();
  const s = useGeoStroke();
  const k = useGeoScale();
  const monstre = useLagMonstre('gv');
  const uid = useSvgId('gv');
  // Geometrien huskes etter verdiene til bakken og speilet (65 punkter), ikke etter hvilken funksjon de er, så nye
  // pilfunksjoner i hver ramme (en senkningstrakt som følger pumperaten) ikke regner alt på nytt
  const kurver = `${kurveNokkel(overflate, w)}|${kurveNokkel(speil, w)}`;
  const g = useMemo(() => grunnvannGeometri({ w, h, overflate, speil, kapillar }), [w, h, kapillar, kurver]);
  const lagListe = lag.length > 0 ? lag : STANDARD_LAG;
  const typerNokkel = lagListe.map((l) => l.type).join(',');
  const typer = useMemo(() => [...new Set(lagListe.map((l) => l.type))], [typerNokkel]);
  // Mønstrene i den mettede sonen: samme strek, men blå bunn (grunnvann i porene), laget ved å overstyre fargevariablene
  const vaate = useLagMonstre('gvv');
  const vaatStil = useMemo(
    () => Object.fromEntries(typer.map((t) => [`--geo-rock-${t}`, LOSMASSE.has(t) ? GEO.grunnvann.fill : mix(GEO.grunnvann.fill, SCENE.stone, 0.4)])) as CSSProperties,
    [typer],
  );
  if (!(w > 0) || !(h > 0) || !Number.isFinite(x) || !Number.isFinite(y)) return null;

  const D = Math.max(0, fin(dybde, Math.min(70, 0.08 * w)));
  const { dx, dy } = snittblokkPerspektiv(D, vinkel);
  const harPerspektiv = dx > 0.5 && dy > 0.5;
  const n = clamp(Math.round(w / 5), 40, 240);
  const innsjoer = overflatevann ? g.innsjoer : [];
  // Kantene av innsjøene er egne punkter, så vannflaten møter bredden nøyaktig
  const xs = [...linspace(0, w, n), ...innsjoer.flatMap((v) => [v.fra, v.til])].sort((a, b) => a - b).filter((v, i, a) => i === 0 || v - a[i - 1]! > 1e-6);
  const ov = g.overflate;
  const sp = g.speil;
  const innsjoVed = (sx: number) => innsjoer.find((v) => sx >= v.fra && sx <= v.til);
  const topp: Fn = (sx) => {
    const v = innsjoVed(sx);
    return v ? Math.min(v.niva, ov(sx)) : ov(sx);
  };

  // Lagene som bånd: toppen er max(lagets topp, bakken), bunnen er toppen av det eldre laget under
  const siste = lagListe.length - 1;
  const raa: Fn[] = lagListe.map((l, i) => (i === siste ? ov : somFn(l.topp, h)));
  const lagTopp: Fn[] = raa.map((t) => (sx: number) => clamp(Math.max(t(sx), ov(sx)), -h, h));
  const lagBunn: Fn[] = lagListe.map((_, i) => (i === 0 ? () => h : (sx: number) => clamp(raa[i - 1]!(sx), lagTopp[i]!(sx), h)));
  const band = (a: Fn, b: Fn): P[] => [...xs.map((sx): P => [sx, a(sx)]), ...[...xs].reverse().map((sx): P => [sx, b(sx)])];
  const tykk = (a: Fn, b: Fn) => xs.some((sx) => b(sx) - a(sx) > 0.3);

  // Sonene (allerede begrenset til bakken, så de trenger ikke klipping)
  const kapTopp = g.kapillarTopp;
  const mettetTopp: Fn = (sx) => Math.max(ov(sx), sp(sx));
  const tetteLag = lagListe.map((l, i) => ({ l, i })).filter(({ l }) => l.tett);

  // Toppflaten i løp med samme helningstrinn (lys fra venstre), som i Snittblokk
  const lop: { p: P[]; q: number; vann: boolean }[] = [];
  if (harPerspektiv) {
    for (let i = 0; i < xs.length - 1; i++) {
      const a = xs[i]!;
      const b = xs[i + 1]!;
      const m = (a + b) / 2;
      const vann = !!innsjoVed(m) && ov(m) > (innsjoVed(m)?.niva ?? 0);
      const ya = vann ? innsjoVed(m)!.niva : topp(a);
      const yb = vann ? innsjoVed(m)!.niva : topp(b);
      const q = vann ? 0 : helning(b - a, yb - ya);
      const sisteLop = lop[lop.length - 1];
      if (sisteLop && sisteLop.q === q && sisteLop.vann === vann) sisteLop.p.push([b, yb]);
      else lop.push({ p: [[a, ya], [b, yb]], q, vann });
    }
  }
  const markFyll = (q: number) => {
    const base = mark === 'jord' ? SCENE.soil : mark === 'sno' ? SCENE.snow : mark === 'ingen' ? mix(SCENE.stone, SCENE.soil, 0.4) : SCENE.grass;
    if (q > 0) return tint(base, 0.07 * q);
    if (q < 0) return mark === 'sno' ? mix(base, SCENE.snowShade, 0.25 * -q) : shade(base, 0.065 * -q);
    return base;
  };

  // Sideflaten ved x = w: lagene og sonene som felt langs en loddrett linje
  const tw = topp(w);
  const sideFelt: { y0: number; y1: number; fyll: string; kant?: string }[] = [];
  const vH = innsjoVed(w);
  if (vH && vH.niva < ov(w)) sideFelt.push({ y0: vH.niva, y1: ov(w), fyll: SCENE.water });
  lagListe.forEach((l, i) => {
    const a = lagTopp[i]!(w);
    const b = lagBunn[i]!(w);
    if (b - a > 0.3) sideFelt.push({ y0: a, y1: b, fyll: monstre.fyll(l.type).fill, kant: GEO.bergart[l.type].line });
  });
  const sideVaate = soner
    ? lagListe
        .map((l, i) => ({ l, a: Math.max(lagTopp[i]!(w), mettetTopp(w)), b: lagBunn[i]!(w) }))
        .filter(({ l, a, b }) => !l.tett && b - a > 0.3)
    : [];

  // Etiketter
  const fs = 17 * f;
  const etiketterListe: SnittEtikett[] = [];
  const inneTekster: { x: number; y: number; tekst: string; size: number }[] = [];
  // Med etikettene inne står ▽ til høyre for sonenavnene, så de ikke overlapper
  const etterInne = etiketter === 'inne' ? clamp(fin(etikettX, 10 * f), 0, w) + 12 * 0.58 * 17 * 0.74 * f + 22 * f : 0;
  const merkeX = speilMerke === false ? null : velgMerkeX(speilMerke, xs, w, g, innsjoVed, 16 * k, etterInne);
  if (etiketter === 'hoyre') {
    // Uten etikettX peker etikettene på sideflaten (sonene lengst inne, lagnavnene nærmere snittet), ellers på snittet
    const ex = clamp(fin(etikettX, w), 0, w);
    const paaSiden = harPerspektiv && etikettX === undefined;
    const pkt = (yy: number, inne: number): { x: number; y: number } =>
      paaSiden ? { x: w + inne * dx, y: yy - inne * dy } : { x: ex - (etikettX === undefined ? (1 - inne) * 0.12 * w : 0), y: yy };
    const o = ov(ex);
    const spe = Math.max(sp(ex), o);
    const kt = kapTopp(ex);
    if (kt - o > 3) etiketterListe.push({ ...pkt((o + kt) / 2, 0.7), tekst: 'Umettet sone', undertekst: 'luft og vann i porene' });
    if (g.kapillar >= 3 && spe - kt > 2) etiketterListe.push({ ...pkt((kt + spe) / 2, 0.7), tekst: 'Kapillærsone' });
    if (sp(ex) > o) etiketterListe.push({ ...pkt(spe, 0.7), tekst: 'Grunnvannsspeil', uthevet: true });
    const tett = tetteLag.find(({ i }) => lagTopp[i]!(ex) > spe);
    const mettetBunn = tett ? lagTopp[tett.i]!(ex) : h;
    if (mettetBunn - spe > 6) etiketterListe.push({ ...pkt((spe + mettetBunn) / 2, 0.7), tekst: 'Mettet sone', undertekst: 'grunnvann' });
    lagListe.forEach((l, i) => {
      if (!l.navn) return;
      const a = lagTopp[i]!(ex);
      const b = lagBunn[i]!(ex);
      if (b - a < 2) return;
      etiketterListe.push({ ...pkt((a + b) / 2, 0.25), tekst: l.navn, undertekst: l.tett ? 'tett lag' : undefined, dim: l.dim });
    });
    etiketterListe.sort((a, b) => a.y - b.y);
  } else if (etiketter === 'inne') {
    const ex = clamp(fin(etikettX, 10 * f), 0, w);
    const o = topp(ex);
    const kt = kapTopp(ex);
    const spe = Math.max(sp(ex), ov(ex));
    const size = 0.74;
    const lh = fs * size;
    if (kt - o > lh * 1.25) inneTekster.push({ x: ex, y: (o + kt) / 2 + lh * 0.35, tekst: 'Umettet sone', size });
    if (spe - kt > lh * 1.15) inneTekster.push({ x: ex, y: (kt + spe) / 2 + lh * 0.32, tekst: 'Kapillærsone', size: size * 0.9 });
    const tett = tetteLag.find(({ i }) => lagTopp[i]!(ex) > spe);
    const mettetBunn = tett ? lagTopp[tett.i]!(ex) : h;
    if (mettetBunn - spe > lh * 1.4) inneTekster.push({ x: ex, y: (spe + Math.min(mettetBunn, spe + 3 * lh)) / 2 + lh * 0.35, tekst: 'Mettet sone', size });
  }
  const speilTekst =
    etiketter === 'inne' && soner
      ? plasserSpeilTekst({ w, h, f, k, xs, ov, sp, innsjoVed, hindre: [...(unnga ?? []), ...(merkeX !== null ? [merkeX] : [])], tekster: inneTekster })
      : null;

  const front = sti([...xs.map((sx): P => [sx, topp(sx)]), [w, h], [0, h]], true);
  const lysId = `${uid}-lys`;
  const sideLysId = `${uid}-sidelys`;
  const vannId = `${uid}-vann`;
  const kontur = monstre.kontur;

  return (
    <g transform={`translate(${r2(x)} ${r2(y)})`} opacity={dim ? 0.4 : undefined}>
      <LagMonstre id={monstre.id} bare={typer} />
      {soner && (
        <g style={vaatStil}>
          <LagMonstre id={vaate.id} bare={typer} />
        </g>
      )}
      <defs>
        <clipPath id={`${uid}-klipp`}>
          <path d={front} />
        </clipPath>
      </defs>
      <LinearGradient
        id={lysId}
        x2={0.3}
        y2={1}
        stops={[
          [0, SCENE.highlight, 0.38],
          [0.4, SCENE.highlight, 0],
          [1, SCENE.shadow, 0.5],
        ]}
      />
      <LinearGradient
        id={sideLysId}
        x2={1}
        y2={0}
        stops={[
          [0, SCENE.shadow, 0.75],
          [1, SCENE.shadow, 1],
        ]}
      />
      <LinearGradient
        id={vannId}
        stops={[
          [0, SCENE.waterLight],
          [0.6, SCENE.water],
          [1, SCENE.waterDeep],
        ]}
      />
      {skygge && <ContactShadow cx={(w + dx) / 2} cy={h - dy / 2 + 3} rx={(w + dx) / 2 + 8} ry={Math.max(6, dy / 2 + 7)} opacity={0.75} />}

      {/* ---------- Toppflaten (fra venstre mot høyre, så det nærmeste dekker det bakerste) ---------- */}
      {harPerspektiv &&
        lop.map((l, i) => {
          const bak = [...l.p].reverse().map(([px, py]): P => [px + dx, py - dy]);
          const fyll = l.vann ? mix(SCENE.water, SCENE.waterLight, 0.55) : markFyll(l.q);
          return (
            <g key={`t${i}`}>
              <path d={sti([...l.p, ...bak], true)} fill={fyll} stroke={fyll} strokeWidth={0.8} strokeLinejoin="round" />
              <path
                d={sti(i === 0 ? [[0, l.p[0]![1]], ...[...bak].reverse()] : [...bak].reverse())}
                fill="none"
                stroke={SCENE.outline}
                strokeWidth={1.2 * s}
                strokeLinecap="round"
              />
            </g>
          );
        })}
      {harPerspektiv &&
        innsjoer.map((v, i) => {
          const bred = v.til - v.fra;
          if (bred < 30) return null;
          return (
            <g key={`vl${i}`} stroke={SCENE.highlight} strokeLinecap="round">
              {[0.3, 0.62].map((t, j) => (
                <line
                  key={j}
                  x1={r2(v.fra + t * dx + bred * (0.12 + 0.1 * j))}
                  x2={r2(v.til + t * dx - bred * (0.18 + 0.08 * j))}
                  y1={r2(v.niva - t * dy)}
                  y2={r2(v.niva - t * dy)}
                  strokeWidth={1.4 * s}
                  opacity={0.9 - 0.3 * j}
                />
              ))}
            </g>
          );
        })}

      {/* ---------- Sideflaten (i skygge) ---------- */}
      {harPerspektiv && (
        <g transform={`matrix(${r2(dx / D)} ${r2(-dy / D)} 0 1 ${r2(w)} 0)`}>
          {sideFelt.map((fe, i) => (
            <rect key={i} x={0} y={r2(fe.y0)} width={r2(D)} height={r2(Math.max(0, fe.y1 - fe.y0))} fill={fe.fyll} stroke={fe.fyll} strokeWidth={0.6} />
          ))}
          {soner && (
            <>
              {kapTopp(w) - ov(w) > 0.5 && <rect x={0} y={r2(ov(w))} width={r2(D)} height={r2(kapTopp(w) - ov(w))} fill={GEO.umettet.fill} opacity={0.3} />}
              {sideVaate.map(({ l, a, b }, i) => (
                <rect key={`sv${i}`} x={0} y={r2(a)} width={r2(D)} height={r2(b - a)} fill={vaate.fyll(l.type).fill} stroke={vaate.fyll(l.type).fill} strokeWidth={0.6} />
              ))}
            </>
          )}
          <rect x={0} y={r2(tw)} width={r2(D)} height={r2(Math.max(0, h - tw))} fill={`url(#${sideLysId})`} />
          {sideFelt.slice(1).map((fe, i) => (
            <line key={`g${i}`} x1={0} x2={r2(D)} y1={r2(fe.y0)} y2={r2(fe.y0)} stroke={fe.kant ?? GEO.grunnvann.line} strokeWidth={kontur * 0.9} />
          ))}
          {soner && sp(w) > ov(w) && <line x1={0} x2={r2(D)} y1={r2(sp(w))} y2={r2(sp(w))} stroke={GEO.grunnvann.line} strokeWidth={1.8 * s} />}
        </g>
      )}

      {/* ---------- Snittet foran: lagene, sonene og vannet ---------- */}
      {lagListe.map((l, i) =>
        tykk(lagTopp[i]!, lagBunn[i]!) ? <LagFlate key={`l${i}`} points={band(lagTopp[i]!, lagBunn[i]!)} type={l.type} monstre={monstre.id} lys={false} dim={l.dim} /> : null,
      )}
      {soner && (
        <g>
          <path d={sti(band(ov, kapTopp), true)} fill={GEO.umettet.fill} opacity={0.3} />
          {g.kapillar > 0.5 &&
            [0, 1, 2, 3, 4].map((j) => {
              const a: Fn = (sx) => Math.max(ov(sx), sp(sx) - (g.kapillar * (5 - j)) / 5);
              const b: Fn = (sx) => Math.max(ov(sx), sp(sx) - (g.kapillar * (4 - j)) / 5);
              return <path key={j} d={sti(band(a, b), true)} fill={GEO.grunnvann.fill} opacity={0.12 + 0.13 * j} />;
            })}
          {/* Den mettede sonen: lagene med blå bunn i mønsteret (tette lag beholder fargen) */}
          {lagListe.map((l, i) => {
            if (l.tett) return null;
            const a: Fn = (sx) => Math.max(lagTopp[i]!(sx), mettetTopp(sx));
            const b = lagBunn[i]!;
            return tykk(a, b) ? <LagFlate key={`m${i}`} points={band(a, (sx) => Math.max(a(sx), b(sx)))} type={l.type} monstre={vaate.id} lys={false} dim={l.dim} /> : null;
          })}
        </g>
      )}
      {innsjoer.map((v, i) => {
        const xsV = xs.filter((sx) => sx > v.fra && sx < v.til);
        const bunn: P[] = [[v.til, Math.max(v.niva, ov(v.til))], ...[...xsV].reverse().map((sx): P => [sx, Math.max(v.niva, ov(sx))]), [v.fra, Math.max(v.niva, ov(v.fra))]];
        return (
          <g key={`v${i}`}>
            <path d={sti([[v.fra, v.niva], [v.til, v.niva], ...bunn], true)} fill={`url(#${vannId})`} />
            <line x1={r2(v.fra)} x2={r2(v.til)} y1={r2(v.niva)} y2={r2(v.niva)} stroke={SCENE.waterLight} strokeWidth={1.6 * s} />
          </g>
        );
      })}
      <path d={front} fill={`url(#${lysId})`} />
      {soner && <SpeilLinje xs={xs} ov={ov} sp={sp} s={s} />}
      <g clipPath={`url(#${uid}-klipp)`}>{children}</g>

      {/* ---------- Kantene ---------- */}
      {mark !== 'ingen' && <Markkant xs={xs} ov={ov} innsjoVed={innsjoVed} mark={mark} s={s} />}
      <g fill="none" stroke={SCENE.outline} strokeWidth={1.2 * s} strokeLinejoin="round" strokeLinecap="round">
        <path d={`M0 ${r2(topp(0))}L0 ${r2(h)}L${r2(w)} ${r2(h)}L${r2(w)} ${r2(tw)}`} />
        {harPerspektiv && <path d={`M${r2(w)} ${r2(tw)}l${r2(dx)} ${r2(-dy)}V${r2(h - dy)}L${r2(w)} ${r2(h)}`} />}
      </g>
      {soner && merkeX !== null && <SpeilSymbol x={merkeX} y={sp(merkeX)} k={k} s={s} />}
      {inneTekster.map((t, i) => (
        <Txt key={`it${i}`} x={r2(t.x)} y={r2(t.y)} anchor="start" size={t.size} color={VIZ.ink} weight={600}>
          {t.tekst}
        </Txt>
      ))}
      {speilTekst && (
        <Txt x={r2(speilTekst.x)} y={r2(speilTekst.y)} anchor="start" size={0.74} color={GEO.grunnvann.line} weight={700}>
          Grunnvannsspeil
        </Txt>
      )}
      {over}
      {etiketter === 'hoyre' && etiketterListe.length > 0 && (
        <SnittEtiketter x={w + dx + 16} topp={Math.min(...xs.map((sx) => topp(sx))) - dy} bunn={h} etiketter={etiketterListe} />
      )}
    </g>
  );
}

/** En nøkkel for en kurve (tall, eller 65 verdier langs 0–w), til memo på verdiene i stedet for funksjonen. */
function kurveNokkel(k: SnittKurve | undefined, w: number): string {
  if (typeof k !== 'function') return String(k);
  const W = Number.isFinite(w) && w > 0 ? w : 1;
  let ut = '';
  for (let i = 0; i <= 64; i++) {
    const v = k((i * W) / 64);
    ut += `${Number.isFinite(v) ? Math.round(v * 10) / 10 : 'x'},`;
  }
  return ut;
}

/**
 * Plassen til «Grunnvannsspeil» med etikettene inne: like over speilet der det er nesten flatt over hele teksten (så
 * linja ikke krysser den), med plass under bakken, borte fra hindrene (brønner, ▽) og sonenavnene. Uten ledig plass
 * over speilet prøves like under det; ellers null (teksten sløyfes).
 */
function plasserSpeilTekst(v: {
  w: number;
  h: number;
  f: number;
  k: number;
  xs: readonly number[];
  ov: Fn;
  sp: Fn;
  innsjoVed: (x: number) => GrunnvannInnsjo | undefined;
  hindre: readonly number[];
  tekster: readonly { x: number; y: number; tekst: string; size: number }[];
}): { x: number; y: number } | null {
  const { w, h, f, k, ov, sp, innsjoVed, hindre, tekster } = v;
  const px = 17 * 0.74 * f;
  const tb = 'Grunnvannsspeil'.length * 0.58 * px;
  const luft = 5 * k;
  const bokser = tekster.map((t) => {
    const p = 17 * t.size * f;
    return { x0: t.x - 3, x1: t.x + t.tekst.length * 0.58 * p + 3, y0: t.y - p * 0.85, y1: t.y + p * 0.25 };
  });
  const fri = (x0: number, y0: number, x1: number, y1: number) => !bokser.some((b) => x0 < b.x1 && b.x0 < x1 && y0 < b.y1 && b.y0 < y1);
  type Kandidat = { x: number; y: number; kost: number };
  let best: Kandidat | null = null;
  const steg = Math.max(4, w / 80);
  for (const under of [false, true]) {
    for (let x0 = 0.03 * w; x0 + tb <= 0.97 * w; x0 += steg) {
      const x1 = x0 + tb;
      let minSp = Infinity;
      let maxSp = -Infinity;
      let maxOv = -Infinity;
      let gyldig = true;
      for (let i = 0; i <= 12; i++) {
        const x = x0 + (i / 12) * tb;
        if (innsjoVed(x)) gyldig = false;
        minSp = Math.min(minSp, sp(x));
        maxSp = Math.max(maxSp, sp(x));
        maxOv = Math.max(maxOv, ov(x));
      }
      if (!gyldig || !(minSp > maxOv + 2)) continue;
      const y = under ? maxSp + px * 0.85 + luft : minSp - luft;
      const y0 = y - px * 0.85;
      const y1 = y + px * 0.25;
      if (under ? y1 > h - 2 : y0 < maxOv + 2) continue;
      if (!fri(x0 - 4, y0, x1 + 4, y1)) continue;
      // Avstanden til nærmeste hinder (brønn, ▽) langs x; for nær gir ugyldig plass
      const avst = hindre.length ? Math.min(...hindre.map((hx) => (hx < x0 ? x0 - hx : hx > x1 ? hx - x1 : 0))) : w;
      if (avst < 14 * k) continue;
      const skraa = maxSp - minSp;
      const kost = skraa * 3 + Math.max(0, 60 - avst) + (under ? 40 : 0) + x0 * 0.02;
      if (!best || kost < best.kost) best = { x: x0, y, kost };
    }
    if (best) break;
  }
  return best ? { x: best.x, y: best.y } : null;
}

/** Helningstrinn −3 … 3 for toppflaten (positiv = vender mot lyset fra venstre). */
function helning(ddx: number, ddy: number): number {
  if (!(Math.abs(ddx) > 1e-6)) return 0;
  const v = Math.atan(ddy / ddx);
  return clamp(Math.round((-v / (Math.PI / 4)) * 3), -3, 3);
}

/** Et sted for ▽-symbolet: litt inn fra venstre, ikke i en innsjø og med plass mellom bakken og speilet. */
function velgMerkeX(
  onsket: number | undefined,
  xs: readonly number[],
  w: number,
  g: GrunnvannGeometri,
  innsjoVed: (x: number) => GrunnvannInnsjo | undefined,
  plass: number,
  fra = 0,
): number | null {
  if (onsket !== undefined && Number.isFinite(onsket)) return clamp(onsket, 0, w);
  const kandidater = xs.filter((sx) => sx > Math.max(0.06 * w, fra) && sx < 0.94 * w - plass);
  const ok = kandidater.find((sx) => !innsjoVed(sx) && !innsjoVed(sx + plass) && g.dybdeTilSpeil(sx) > 18);
  return ok ?? kandidater.find((sx) => !innsjoVed(sx) && g.dybdeTilSpeil(sx) > 4) ?? null;
}

/** Grunnvannsspeilet: blå linje der speilet ligger under bakken. */
function SpeilLinje({ xs, ov, sp, s }: { xs: readonly number[]; ov: Fn; sp: Fn; s: number }) {
  let d = '';
  let pa = false;
  for (const sx of xs) {
    const under = sp(sx) > ov(sx) + 0.4;
    if (under) {
      d += `${pa ? 'L' : 'M'}${r2(sx)} ${r2(sp(sx))}`;
      pa = true;
    } else pa = false;
  }
  if (!d) return null;
  return (
    <g fill="none" strokeLinejoin="round" strokeLinecap="round">
      <path d={d} stroke={VIZ.surface} strokeWidth={4.2 * s} opacity={0.55} />
      <path d={d} stroke={GEO.grunnvann.line} strokeWidth={2.2 * s} />
    </g>
  );
}

/**
 * Symbolet for grunnvannsspeil (▽ med to korte streker under), som på hydrogeologiske snitt. (x, y) er punktet på
 * speilet: trekanten står over, strekene under. Størrelsen følger useGeoScale.
 */
export function SpeilSymbol({ x, y, k, s }: { x: number; y: number; k?: number; s?: number }) {
  const kk = fin(k, 1);
  const ss = fin(s, 1);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  const a = 7 * kk;
  return (
    <g strokeLinejoin="round" strokeLinecap="round">
      <path d={`M${r2(x)} ${r2(y - 1.2 * ss)}L${r2(x - a)} ${r2(y - 1.2 * ss - a * 1.15)}H${r2(x + a)}Z`} fill="none" stroke={VIZ.surface} strokeWidth={4.2 * ss} opacity={0.85} />
      <path d={`M${r2(x)} ${r2(y - 1.2 * ss)}L${r2(x - a)} ${r2(y - 1.2 * ss - a * 1.15)}H${r2(x + a)}Z`} fill={GEO.grunnvann.fill} stroke={GEO.grunnvann.line} strokeWidth={1.6 * ss} />
      <path
        d={`M${r2(x - a * 0.75)} ${r2(y + 3.6 * kk)}H${r2(x + a * 0.75)}M${r2(x - a * 0.4)} ${r2(y + 6.8 * kk)}H${r2(x + a * 0.4)}`}
        stroke={GEO.grunnvann.line}
        strokeWidth={1.6 * ss}
      />
    </g>
  );
}

/** Gress-, jord- eller snøkanten langs bakken foran (ikke under vann). */
function Markkant({ xs, ov, innsjoVed, mark, s }: { xs: readonly number[]; ov: Fn; innsjoVed: (x: number) => GrunnvannInnsjo | undefined; mark: string; s: number }) {
  let d = '';
  let pa = false;
  for (const sx of xs) {
    const v = innsjoVed(sx);
    const tort = !v || ov(sx) <= v.niva + 0.5;
    if (tort) {
      d += `${pa ? 'L' : 'M'}${r2(sx)} ${r2(ov(sx))}`;
      pa = true;
    } else pa = false;
  }
  if (!d) return null;
  const farge = mark === 'sno' ? SCENE.snow : mark === 'jord' ? SCENE.soilDark : SCENE.grassDark;
  return <path d={d} fill="none" stroke={farge} strokeWidth={(mark === 'sno' ? 3.6 : 3.2) * s} strokeLinejoin="round" strokeLinecap="round" />;
}

/* =====================================================================================================================
 * Bronn
 * ================================================================================================================== */

/** Brønntypene. */
export type BronnType = 'fjell' | 'losmasse' | 'gravd' | 'observasjon' | 'energi' | 'borehull';

/** Norske navn på brønntypene (til knapper og forklaringer). */
export const BRONN_NAVN: Readonly<Record<BronnType, string>> = {
  fjell: 'Borebrønn i fjell',
  losmasse: 'Løsmassebrønn',
  gravd: 'Gravd brønn',
  observasjon: 'Observasjonsbrønn',
  energi: 'Energibrønn',
  borehull: 'Borehull',
};

/** Standardmål per type (figurens enheter før useGeoScale): bredde, hvor langt toppen stikker opp, og om den har pumpe. */
const BRONN_MAAL: Readonly<Record<BronnType, { bredde: number; over: number; pumpe: boolean }>> = {
  fjell: { bredde: 13, over: 9, pumpe: true },
  losmasse: { bredde: 14, over: 9, pumpe: true },
  gravd: { bredde: 40, over: 9, pumpe: false },
  observasjon: { bredde: 8, over: 14, pumpe: false },
  energi: { bredde: 14, over: 7, pumpe: false },
  borehull: { bredde: 10, over: 0, pumpe: false },
};

/** Props til `Bronn`. Alle y-verdier er i figurens koordinater (de samme som `y`), ikke dybder. */
export interface BronnProps {
  /** Midtlinja til brønnen. */
  x: number;
  /** Bakken ved brønnen. */
  y: number;
  /** Bunnen av brønnen (y). */
  bunn: number;
  type?: BronnType;
  /** Vannstanden i brønnen (y), f.eks. grunnvannsspeilet der (`grunnvannGeometri(…).speil(x)`). Uten: tørr. */
  vannstand?: number;
  /** Toppen av fjellet (y). Foringsrøret går gjennom løsmassene og litt ned i fjellet (fjell- og energibrønn). */
  fjell?: number;
  /** Filteret (y fra, y til) i en løsmasse- eller observasjonsbrønn. Standard den nederste fjerdedelen. */
  filter?: readonly [number, number];
  /** Pumpe med stigerør (standard i fjell- og løsmassebrønner). I en gravd brønn: et sugerør med bunnventil. */
  pumpe?: boolean;
  /** Hvor pumpen henger (y). Standard godt under vannstanden. */
  pumpeDybde?: number;
  /** Ledning fra brønnen til siden under bakken (mot huset), og hvor lang den er (standard 60 · k). */
  tilkobling?: 'venstre' | 'hoyre';
  tilkoblingLengde?: number;
  /** Peilebånd med lodd ned til vannstanden (observasjonsbrønn). */
  peilebaand?: boolean;
  /** ▽ ved vannstanden (standard på når brønnen har vann). */
  merke?: boolean;
  /** Bredden på hullet (figurens enheter). Standard etter typen, større på mobil. */
  bredde?: number;
  seed?: number;
  dim?: boolean;
}

/** Punktene på en brønn som kapitlene fester piler og etiketter til (figurens koordinater). */
export interface BronnPunkter {
  /** Toppen av brønnhodet (lokket). */
  topp: { x: number; y: number };
  /** Midten av vannflaten i brønnen, eller null når den er tørr. */
  vannstand: { x: number; y: number } | null;
  /** Midten av pumpen (eller enden av sugerøret), eller null. */
  pumpe: { x: number; y: number } | null;
  /** Midten av filteret (der vannet går inn), eller null. */
  filter: { x: number; y: number } | null;
  /** Enden av ledningen mot siden, eller null. */
  utlop: { x: number; y: number } | null;
  /** Midt på bunnen. */
  bunn: { x: number; y: number };
  /** Bredden på hullet og høyden der ledningen går ut. */
  bredde: number;
  ledningY: number;
}

interface BronnGeo {
  bw: number;
  topp: number;
  B: number;
  vy: number | null;
  fy: number | null;
  ror: number;
  filter: [number, number] | null;
  pumpe: boolean;
  py: number | null;
  ph: number;
  ledningY: number;
  utlopX: number | null;
}

function bronnGeo(p: BronnProps, k: number): BronnGeo {
  const type = p.type ?? 'fjell';
  const spec = BRONN_MAAL[type];
  const kk = fin(k, 1);
  const yy = fin(p.y, 0);
  const bw = Math.max(3, fin(p.bredde, spec.bredde * kk));
  const B = Math.max(fin(p.bunn, yy + 40), yy + 4);
  const topp = yy - spec.over * kk;
  const vy = p.vannstand !== undefined && Number.isFinite(p.vannstand) ? clamp(p.vannstand, Math.min(yy, topp + 2), B) : null;
  const fy = p.fjell !== undefined && Number.isFinite(p.fjell) ? clamp(p.fjell, yy, B) : null;
  // Foringsrøret: gjennom løsmassene og litt ned i fjellet, ellers til filteret eller den øverste tredjedelen
  let filter: [number, number] | null = null;
  if (type === 'losmasse' || type === 'observasjon') {
    const f0 = p.filter ? fin(p.filter[0], B - 0.25 * (B - yy)) : B - 0.25 * (B - yy);
    const f1 = p.filter ? fin(p.filter[1], B) : B;
    const a = clamp(Math.min(f0, f1), yy + 2, B);
    const b = clamp(Math.max(f0, f1), a, B);
    if (b - a > 1) filter = [a, b];
  }
  const ror =
    type === 'borehull'
      ? yy
      : type === 'gravd'
        ? B
        : filter
          ? filter[0]
          : fy !== null
            ? Math.min(B, fy + Math.max(5 * kk, 0.05 * (B - yy)))
            : Math.min(B, yy + 0.3 * (B - yy));
  const pumpe = p.pumpe ?? spec.pumpe;
  const ph = type === 'gravd' ? 0 : Math.max(16 * kk, 2.4 * 0.62 * bw);
  let py: number | null = null;
  if (pumpe) {
    const lav = vy !== null ? vy + 0.65 * (B - vy) : B - 0.18 * (B - yy);
    py = clamp(fin(p.pumpeDybde, lav), Math.min(B, (vy ?? yy) + ph / 2 + 2), Math.max(yy + ph / 2, B - ph / 2 - 3 * kk));
  }
  const ledningY = Math.min(B - 2, yy + Math.max(10 * kk, Math.min(0.09 * (B - yy), 22 * kk)));
  const L = fin(p.tilkoblingLengde, 60 * kk);
  const utlopX = p.tilkobling === 'venstre' ? fin(p.x, 0) - bw / 2 - L : p.tilkobling === 'hoyre' ? fin(p.x, 0) + bw / 2 + L : null;
  return { bw, topp, B, vy, fy, ror, filter, pumpe, py, ph, ledningY, utlopX };
}

/**
 * Punktene på en brønn (samme props som `Bronn`, og `k` = useGeoScale() i figuren): toppen, vannflaten, pumpen,
 * filteret, enden av ledningen og bunnen, til piler og etiketter:
 *   const p = bronnPunkter({ x: 300, y: 120, bunn: 330, vannstand: 180, type: 'fjell' }, k);
 *   <ForceArrow x1={p.pumpe.x} … />
 */
export function bronnPunkter(p: BronnProps, k = 1): BronnPunkter {
  const g = bronnGeo(p, k);
  const x = fin(p.x, 0);
  const type = p.type ?? 'fjell';
  const lokk = type === 'gravd' ? 5 * fin(k, 1) : type === 'observasjon' ? 4 * fin(k, 1) : type === 'borehull' ? 0 : 3.5 * fin(k, 1);
  return {
    topp: { x, y: g.topp - lokk },
    vannstand: g.vy !== null ? { x, y: g.vy } : null,
    pumpe: g.py !== null ? { x, y: g.py } : type === 'gravd' && g.pumpe ? { x, y: g.B - 0.12 * (g.B - fin(p.y, 0)) } : null,
    filter: g.filter ? { x, y: (g.filter[0] + g.filter[1]) / 2 } : type === 'gravd' ? { x, y: g.B } : null,
    utlop: g.utlopX !== null ? { x: g.utlopX, y: g.ledningY } : null,
    bunn: { x, y: g.B },
    bredde: g.bw,
    ledningY: g.ledningY,
  };
}

/**
 * Brønn i snitt: borebrønn i fjell (foringsrør gjennom løsmassene og ned i fjellet, åpent hull i fjellet, dykkpumpe på
 * stigerør), løsmassebrønn (foringsrør med filter nederst), gravd brønn (betongringer med lokk, åpen bunn med grus),
 * observasjonsbrønn (smalt plastrør med filter, beskyttelsesrør og eventuelt peilebånd), energibrønn (foringsrør,
 * U-formet kollektorslange med bunnlodd) eller et rent borehull. Vannet i brønnen står i `vannstand`, med ▽.
 *
 * Ankerpunkt: (x, y) er der brønnen møter bakken, midt på; alle andre høyder er y-verdier i samme koordinater (ikke
 * dybder). Brønnen er tegnet bredere enn i virkeligheten, så den synes; bredden vokser med useGeoScale. Tegn den etter
 * bakken og lagene (i `over` på Grunnvannssnitt eller Snittblokk). Bruk `bronnPunkter` for piler.
 *   <Bronn x={300} y={120} bunn={330} fjell={190} vannstand={170} type="fjell" tilkobling="venstre" />
 */
export const Bronn = memo(function Bronn(props: BronnProps) {
  const { x, y, type = 'fjell', tilkobling, peilebaand, merke = true, seed = 3, dim } = props;
  const k = useGeoScale();
  const s = useGeoStroke();
  const id = useSvgId('bronn');
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  const g = bronnGeo(props, k);
  const { bw, topp, B, vy, ror, filter, pumpe, py, ph, ledningY, utlopX } = g;
  const L = x - bw / 2;
  const R = x + bw / 2;
  const gravd = type === 'gravd';
  const obs = type === 'observasjon';
  const energi = type === 'energi';
  // Veggen i røret eller ringen (betong i en gravd brønn)
  const vegg = gravd ? Math.max(3 * k, 0.13 * bw) : obs ? Math.max(1.6 * s, 0.2 * bw) : Math.max(1.8 * s, 0.17 * bw);
  const hull = gravd ? mix(SCENE.stoneDark, SCENE.concreteDark, 0.35) : shade(SCENE.stoneDark, 0.45);
  const metall = SCENE.metal;
  const plast = mix(PE_LYS, SCENE.metalLight, 0.3);
  const rorFarge = gravd ? SCENE.concrete : obs ? plast : metall;
  const rand = sceneRandom(seed);

  // Ru vegger i fjellet (åpent hull under foringsrøret)
  const ruVegg = (side: -1 | 1) => {
    const ys = linspace(Math.max(ror, y), B, Math.max(2, Math.round((B - Math.max(ror, y)) / (5 * k))));
    return ys.map((yy, i): P => [x + side * (bw / 2 + (i === 0 || i === ys.length - 1 ? 0 : (rand() - 0.4) * 0.07 * bw)), yy]);
  };
  const apentHull = ror < B - 1;
  const venstreVegg = apentHull ? ruVegg(-1) : [];
  const hoyreVegg = apentHull ? ruVegg(1) : [];
  const hullForm: P[] = apentHull ? [...venstreVegg, ...[...hoyreVegg].reverse()] : [];

  // Ledningen ut mot siden (vannledning eller kollektorslanger), og stigerøret fra pumpen
  const rorB = Math.max(1.8 * s, Math.min(4.5 * k, 0.24 * bw));
  const stigX = x - (energi ? 0 : 0.12 * bw);
  const stigTopp = utlopX !== null ? ledningY : topp;

  return (
    <g opacity={dim ? 0.4 : undefined} aria-hidden>
      <LinearGradient
        id={`${id}h`}
        x2={1}
        y2={0}
        stops={[
          [0, shade(hull, 0.35)],
          [0.45, hull],
          [1, shade(hull, 0.45)],
        ]}
      />
      <LinearGradient
        id={`${id}v`}
        x2={1}
        y2={0}
        stops={[
          [0, shade(SCENE.waterDeep, 0.1)],
          [0.32, SCENE.water],
          [1, shade(SCENE.waterDeep, 0.3)],
        ]}
      />
      <LinearGradient
        id={`${id}r`}
        x2={1}
        y2={0}
        stops={[
          [0, shade(rorFarge, 0.25)],
          [0.35, tint(rorFarge, 0.35)],
          [1, shade(rorFarge, 0.3)],
        ]}
      />
      <LinearGradient
        id={`${id}p`}
        x2={1}
        y2={0}
        stops={[
          [0, shade(SCENE.metalLight, 0.2)],
          [0.35, tint(SCENE.metalLight, 0.5)],
          [1, shade(SCENE.metal, 0.3)],
        ]}
      />

      {/* Hullet (luft) og vannet */}
      <rect x={r2(L)} y={r2(Math.min(y, topp))} width={r2(bw)} height={r2(Math.max(0, Math.min(ror, B) - Math.min(y, topp)))} fill={`url(#${id}h)`} />
      {apentHull && <path d={sti(hullForm, true)} fill={`url(#${id}h)`} />}
      {vy !== null && (
        <>
          <rect x={r2(L)} y={r2(vy)} width={r2(bw)} height={r2(Math.max(0, Math.min(ror, B) - vy))} fill={`url(#${id}v)`} />
          {apentHull && <path d={sti(hullForm.map(([px, py2]): P => [px, Math.max(py2, vy)]), true)} fill={`url(#${id}v)`} />}
          <line x1={r2(L + vegg)} x2={r2(R - vegg)} y1={r2(vy)} y2={r2(vy)} stroke={SCENE.waterLight} strokeWidth={1.4 * s} />
        </>
      )}
      {apentHull && (
        <g fill="none" stroke={SCENE.outline} strokeWidth={1.1 * s} strokeLinejoin="round">
          <path d={sti(venstreVegg)} />
          <path d={sti(hoyreVegg)} />
        </g>
      )}
      {/* Grus i bunnen av en gravd brønn */}
      {gravd && <Grus x={x} y={B} w={bw - 2 * vegg} k={k} s={s} seed={seed} />}

      {/* Energibrønn: U-formet kollektorslange med bunnlodd */}
      {energi && <Kollektor x={x} bw={bw} B={B} ledningY={ledningY} utlopX={utlopX} topp={topp} k={k} s={s} />}

      {/* Stigerør og pumpe */}
      {pumpe && !gravd && py !== null && (
        <g>
          <path
            d={`M${r2(stigX)} ${r2(py - ph / 2)}V${r2(stigTopp)}${utlopX !== null ? `H${r2(utlopX)}` : ''}`}
            fill="none"
            stroke={PE_MORK}
            strokeWidth={rorB}
            strokeLinejoin="round"
          />
          <path
            d={`M${r2(stigX - rorB * 0.2)} ${r2(py - ph / 2)}V${r2(stigTopp)}`}
            fill="none"
            stroke={PE_LYS}
            strokeWidth={rorB * 0.22}
            opacity={0.6}
          />
          <path d={`M${r2(x + 0.18 * bw)} ${r2(py)}V${r2(Math.max(topp + 2, y))}`} fill="none" stroke={shade(SCENE.stoneDark, 0.3)} strokeWidth={Math.max(0.8, 0.9 * s)} />
          <Dykkpumpe x={x} y={py} w={Math.max(5 * k, 0.6 * bw)} h={ph} gid={`${id}p`} s={s} />
        </g>
      )}
      {pumpe && gravd && (
        <path
          d={`M${r2(x)} ${r2(B - 0.12 * (B - y))}V${r2(utlopX !== null ? ledningY : topp)}${utlopX !== null ? `H${r2(utlopX)}` : ''}`}
          fill="none"
          stroke={PE_MORK}
          strokeWidth={rorB * 0.7}
          strokeLinejoin="round"
        />
      )}
      {pumpe && gravd && <rect x={r2(x - 3 * k)} y={r2(B - 0.12 * (B - y))} width={r2(6 * k)} height={r2(5 * k)} rx={1.5 * k} fill={metall} stroke={SCENE.outline} strokeWidth={0.8 * s} />}
      {/* Vannledning ut uten pumpe (energibrønn har egne slanger) */}
      {!pumpe && !energi && utlopX !== null && vy !== null && (
        <path d={`M${r2(x)} ${r2(ledningY)}H${r2(utlopX)}`} fill="none" stroke={PE_MORK} strokeWidth={rorB} />
      )}

      {/* Foringsrøret, filteret og betongringene */}
      {type !== 'borehull' && (
        <g>
          <rect x={r2(L)} y={r2(topp)} width={r2(vegg)} height={r2(Math.max(0, ror - topp))} fill={`url(#${id}r)`} />
          <rect x={r2(R - vegg)} y={r2(topp)} width={r2(vegg)} height={r2(Math.max(0, ror - topp))} fill={`url(#${id}r)`} />
          {gravd &&
            linspace(topp, B, Math.max(1, Math.round((B - topp) / Math.max(10, 0.55 * bw)))).slice(1, -1).map((yy, i) => (
              <path key={i} d={`M${r2(L)} ${r2(yy)}h${r2(vegg)}M${r2(R - vegg)} ${r2(yy)}h${r2(vegg)}`} stroke={SCENE.concreteDark} strokeWidth={1 * s} />
            ))}
          <path
            d={`M${r2(L)} ${r2(topp)}V${r2(ror)}M${r2(L + vegg)} ${r2(topp)}V${r2(ror)}M${r2(R - vegg)} ${r2(topp)}V${r2(ror)}M${r2(R)} ${r2(topp)}V${r2(ror)}`}
            stroke={SCENE.outline}
            strokeWidth={0.8 * s}
            opacity={0.8}
          />
          {filter && (
            <g>
              <rect x={r2(L)} y={r2(filter[0])} width={r2(vegg)} height={r2(filter[1] - filter[0])} fill={`url(#${id}r)`} />
              <rect x={r2(R - vegg)} y={r2(filter[0])} width={r2(vegg)} height={r2(filter[1] - filter[0])} fill={`url(#${id}r)`} />
              <path
                d={linspace(filter[0] + 2.5 * k, filter[1] - 2.5 * k, Math.max(1, Math.round((filter[1] - filter[0]) / (3.4 * k))))
                  .map((yy) => `M${r2(L - 0.3)} ${r2(yy)}h${r2(vegg + 0.6)}M${r2(R - vegg - 0.3)} ${r2(yy)}h${r2(vegg + 0.6)}`)
                  .join('')}
                stroke={hull}
                strokeWidth={Math.max(0.9, 1.1 * s)}
              />
              <rect x={r2(L)} y={r2(filter[1] - Math.max(2, 1.4 * vegg))} width={r2(bw)} height={r2(Math.max(2, 1.4 * vegg))} fill={rorFarge} stroke={SCENE.outline} strokeWidth={0.8 * s} />
            </g>
          )}
        </g>
      )}

      {/* Brønnhodet over bakken */}
      <Bronnhode type={type} x={x} y={y} topp={topp} bw={bw} k={k} s={s} />

      {/* Peilebånd med lodd ned til vannstanden */}
      {peilebaand && <Peilebaand x={x} topp={topp} bw={bw} vy={vy ?? B - 2} k={k} s={s} />}

      {merke && vy !== null && <SpeilSymbol x={tilkobling === 'hoyre' ? L - 9 * k : R + 9 * k} y={vy} k={k * 0.8} s={s} />}
    </g>
  );
});

/** Mørk og lys PE-plast (stigerør, slanger). */
const PE_MORK = mix(SCENE.rubber, SCENE.stoneDark, 0.3);
const PE_LYS = SCENE.rubberLight;

function Dykkpumpe({ x, y, w, h, gid, s }: { x: number; y: number; w: number; h: number; gid: string; s: number }) {
  const t = y - h / 2;
  const motor = h * 0.45;
  return (
    <g>
      <rect x={r2(x - w / 2)} y={r2(t)} width={r2(w)} height={r2(h)} rx={r2(w * 0.25)} fill={`url(#${gid})`} stroke={SCENE.outline} strokeWidth={0.9 * s} />
      <rect x={r2(x - w / 2)} y={r2(t + h - motor)} width={r2(w)} height={r2(motor)} rx={r2(w * 0.25)} fill={shade(SCENE.metal, 0.25)} opacity={0.75} />
      <path
        d={linspace(t + h * 0.38, t + h * 0.5, 3)
          .map((yy) => `M${r2(x - w * 0.3)} ${r2(yy)}H${r2(x + w * 0.3)}`)
          .join('')}
        stroke={SCENE.outline}
        strokeWidth={0.8 * s}
      />
    </g>
  );
}

function Grus({ x, y, w, k, s, seed }: { x: number; y: number; w: number; k: number; s: number; seed: number }) {
  const rand = sceneRandom(seed + 9);
  const n = Math.max(4, Math.round(w / (5 * k)));
  return (
    <g stroke={SCENE.outline} strokeWidth={0.6 * s}>
      {Array.from({ length: n }, (_, i) => {
        const cx = x - w / 2 + ((i + 0.5) * w) / n + (rand() - 0.5) * 2 * k;
        const r = (1.8 + rand() * 1.6) * k;
        return <ellipse key={i} cx={r2(cx)} cy={r2(y - r * 0.7)} rx={r2(r)} ry={r2(r * 0.7)} fill={rand() > 0.5 ? SCENE.gravel : SCENE.gravelDark} />;
      })}
    </g>
  );
}

function Kollektor({ x, bw, B, ledningY, utlopX, topp, k, s }: { x: number; bw: number; B: number; ledningY: number; utlopX: number | null; topp: number; k: number; s: number }) {
  const a = x - 0.22 * bw;
  const b = x + 0.22 * bw;
  const rU = (b - a) / 2;
  const bunnY = B - 6 * k - rU;
  const slange = Math.max(1.5 * s, Math.min(3.4 * k, 0.16 * bw));
  const ut = utlopX;
  const opp = ut !== null ? ledningY : topp;
  const dir = ut !== null && ut < x ? -1 : 1;
  // Slangen nærmest utløpet går ut lavest, så de to ikke krysser hverandre
  const tur = ut !== null ? `M${r2(a)} ${r2(bunnY)}V${r2(opp + (dir < 0 ? 4 * k : 0))}H${r2(ut)}` : `M${r2(a)} ${r2(bunnY)}V${r2(opp)}`;
  const retur = ut !== null ? `M${r2(b)} ${r2(bunnY)}V${r2(opp + (dir < 0 ? 0 : 4 * k))}H${r2(ut)}` : `M${r2(b)} ${r2(bunnY)}V${r2(opp)}`;
  const u = `M${r2(a)} ${r2(bunnY)}A${r2(rU)} ${r2(rU)} 0 0 0 ${r2(b)} ${r2(bunnY)}`;
  return (
    <g fill="none" strokeLinejoin="round">
      {[tur, retur, u].map((d, i) => (
        <g key={i}>
          <path d={d} stroke={PE_MORK} strokeWidth={slange} />
          <path d={d} stroke={PE_LYS} strokeWidth={slange * 0.25} opacity={0.55} />
        </g>
      ))}
      <rect x={r2(x - 0.18 * bw)} y={r2(bunnY + rU)} width={r2(0.36 * bw)} height={r2(5 * k)} rx={1 * k} fill={shade(SCENE.metal, 0.3)} stroke={SCENE.outline} strokeWidth={0.7 * s} />
    </g>
  );
}

function Bronnhode({ type, x, y, topp, bw, k, s }: { type: BronnType; x: number; y: number; topp: number; bw: number; k: number; s: number }) {
  if (type === 'borehull') return null;
  if (type === 'gravd') {
    const lw = bw + 8 * k;
    const lh = 5 * k;
    return (
      <g>
        <rect x={r2(x - lw / 2)} y={r2(topp - lh)} width={r2(lw)} height={r2(lh)} rx={1.2 * k} fill={tint(SCENE.concrete, 0.12)} stroke={SCENE.outline} strokeWidth={1 * s} />
        <rect x={r2(x - lw * 0.18)} y={r2(topp - lh - 2.2 * k)} width={r2(lw * 0.36)} height={r2(2.2 * k)} rx={0.8 * k} fill={SCENE.concreteDark} stroke={SCENE.outline} strokeWidth={0.8 * s} />
        <ContactShadow cx={x} cy={y} rx={lw * 0.7} ry={2.5 * k} opacity={0.6} />
      </g>
    );
  }
  if (type === 'observasjon') {
    // Beskyttelsesrør i stål med lokk
    const pw = bw + 7 * k;
    const ph = y - topp + 9 * k;
    return (
      <g>
        <rect x={r2(x - pw / 2)} y={r2(topp - 2 * k)} width={r2(pw)} height={r2(ph)} fill={mix(SCENE.metal, PAINTS.gronn, 0.35)} stroke={SCENE.outline} strokeWidth={0.9 * s} />
        <rect x={r2(x - pw / 2 - 1.2 * k)} y={r2(topp - 5 * k)} width={r2(pw + 2.4 * k)} height={r2(3.4 * k)} rx={1 * k} fill={shade(mix(SCENE.metal, PAINTS.gronn, 0.35), 0.2)} stroke={SCENE.outline} strokeWidth={0.9 * s} />
        <rect x={r2(x - pw / 2)} y={r2(y)} width={r2(pw)} height={r2(7 * k)} fill={SCENE.concrete} opacity={0.75} />
      </g>
    );
  }
  // Foringsrør med brønnlokk (fjell, løsmasse, energi)
  const lw = bw + 3.2 * k;
  return (
    <g>
      <rect x={r2(x - lw / 2)} y={r2(topp - 3.5 * k)} width={r2(lw)} height={r2(3.5 * k)} rx={1 * k} fill={shade(SCENE.metal, 0.15)} stroke={SCENE.outline} strokeWidth={0.9 * s} />
      <rect x={r2(x - lw * 0.15)} y={r2(topp - 5.2 * k)} width={r2(lw * 0.3)} height={r2(1.8 * k)} fill={SCENE.metalDark} />
    </g>
  );
}

function Peilebaand({ x, topp, bw, vy, k, s }: { x: number; topp: number; bw: number; vy: number; k: number; s: number }) {
  // Snella står til høyre for røret; båndet går over kanten og ned til vannet, med et lodd som akkurat når vannflaten
  const sx = x + bw / 2 + 12 * k;
  const sy = topp - 14 * k;
  const r = 6 * k;
  const band = mix(SCENE.snow, PAINTS.gul, 0.55);
  const lodd = 7 * k;
  return (
    <g>
      <path
        d={`M${r2(sx - r * 0.6)} ${r2(sy + r * 0.8)}L${r2(x + bw * 0.1)} ${r2(topp - 6 * k)}V${r2(vy - lodd)}`}
        fill="none"
        stroke={shade(band, 0.25)}
        strokeWidth={Math.max(1.4, 1.8 * s)}
      />
      <path d={`M${r2(x + bw * 0.1)} ${r2(topp - 6 * k)}V${r2(vy - lodd)}`} fill="none" stroke={band} strokeWidth={Math.max(0.8, 1 * s)} />
      <rect x={r2(x + bw * 0.1 - 1.6 * k)} y={r2(vy - lodd)} width={r2(3.2 * k)} height={r2(lodd)} rx={1.4 * k} fill={SCENE.metalLight} stroke={SCENE.outline} strokeWidth={0.7 * s} />
      <circle cx={r2(sx)} cy={r2(sy)} r={r2(r)} fill={PAINTS.gul} stroke={SCENE.outline} strokeWidth={0.9 * s} />
      <circle cx={r2(sx)} cy={r2(sy)} r={r2(r * 0.35)} fill={SCENE.metalDark} />
      <path d={`M${r2(sx)} ${r2(sy + r)}L${r2(sx + r * 0.2)} ${r2(topp + 2 * k)}`} stroke={SCENE.outline} strokeWidth={1.2 * s} />
    </g>
  );
}

/* =====================================================================================================================
 * Nedbør og skydekke
 * ================================================================================================================== */

/** Props til `Skydekke`. */
export interface SkydekkeProps {
  /** Området skylaget fyller: øverste venstre hjørne, bredde og høyde (skybasen er nederst, ca. i y + 0,8 · h). */
  x?: number;
  y?: number;
  w: number;
  h: number;
  /** 0 = lyse, tynne skyer (overskyet opphold), 1 = mørke regnskyer. Standard 0,5. */
  tetthet?: number;
  /**
   * Grått slør fra y ned til y + himmel, så en solskinnshimmel blir overskyet. Sløret må ligge bak landskapet: tegn
   * Skydekke rett etter Himmel og før Landskap og Terreng.
   */
  himmel?: number;
  /** Runde skytopper også øverst. Standard som `avrundet` (ellers går skylaget rett ut over toppen av figuren). */
  toppkant?: boolean;
  /**
   * Avrundede ender og topp: en skybanke som holder seg mellom x og x + w (f.eks. en regnsky over et snitt). Standard
   * av: laget går rett ut til kantene, som når skydekket dekker hele himmelen.
   */
  avrundet?: boolean;
  seed?: number;
  dim?: boolean;
}

interface Puff {
  cx: number;
  cy: number;
  r: number;
  /** Høyde i forhold til bredde (flatere puter i bunnen). */
  e: number;
}

/**
 * Skyputene: et bakre lag (lysere, høyere) og et fremre lag langs skybasen. Avrundet: putene holder seg innenfor
 * 0 … w og blir mindre mot endene; ellers går de litt ut over kantene (og klippes).
 */
function planPuffs(w: number, h: number, seed: number, toppkant: boolean, avrundet: boolean, k: number): { bak: Puff[]; foran: Puff[]; topp: Puff[]; r0: number } {
  if (!(w > 0) || !(h > 0)) return { bak: [], foran: [], topp: [], r0: 0 };
  const rand = sceneRandom(seed);
  const r0 = clamp(h * 0.4, 9, 80) * Math.min(1.25, Math.max(1, k));
  const rad = (y0: number, y1: number, r: number, tett: number, e: number): Puff[] => {
    const ut: Puff[] = [];
    const a = avrundet ? r * 0.85 : -r * 0.4;
    const b = avrundet ? w - r * 0.85 : w + r * 0.4;
    const n = Math.max(2, Math.round((b - a) / (r * tett)));
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const kant = Math.min(t, 1 - t) * n; // 0 i endene
      const smal = avrundet ? (kant < 0.5 ? 0.62 : kant < 1.5 ? 0.85 : 1) : 1;
      const rr = r * (0.7 + rand() * 0.6) * smal;
      ut.push({ cx: a + t * (b - a) + (rand() - 0.5) * r * 0.45, cy: y0 + rand() * (y1 - y0), r: rr, e: e * (0.85 + rand() * 0.3) });
    }
    return ut;
  };
  const bak = rad(h * 0.3, h * 0.46, r0 * 1.2, 1.25, 0.72);
  const foran = rad(h * 0.56, h * 0.7, r0 * 0.95, 1.05, 0.62);
  const topp = toppkant ? rad(h * 0.18, h * 0.28, r0 * 0.95, 1.4, 0.75) : [];
  return { bak, foran, topp, r0 };
}

/**
 * Skydekke for overskyet vær og regnvær: et sammenhengende skylag av tette skyputer i to lag, med lyse topper og mørkere
 * skybase, i grått som blir mørkere med `tetthet`. Med `himmel` legges et grått slør under skyene, så en
 * solskinnshimmel blir overskyet (tegn da Skydekke rett etter Himmel og før landskapet). Himmel i scene-kit-et har bare
 * sol og haugskyer. Bare toninger, ingen filtre.
 *
 * Ankerpunkt: øverste venstre hjørne. Skyene holder seg mellom x og x + w (avrundet i endene), og skybasen ligger
 * ca. i y + 0,8 · h. Uten `toppkant` er toppen rett (skylaget går ut over figuren).
 *   <Himmel w={800} h={260} /> <Skydekke w={800} h={80} tetthet={0.8} himmel={240} /> <Landskap … />
 */
export const Skydekke = memo(function Skydekke({ x = 0, y = 0, w, h, tetthet = 0.5, himmel, avrundet = false, toppkant = avrundet, seed = 5, dim }: SkydekkeProps) {
  const id = useSvgId('skydekke');
  const k = useGeoScale();
  const puter = useMemo(() => planPuffs(w, h, seed, toppkant, avrundet, k), [w, h, seed, toppkant, avrundet, k]);
  if (!(w > 0) || !(h > 0) || !Number.isFinite(x) || !Number.isFinite(y)) return null;
  const t = clamp(fin(tetthet, 0.5), 0, 1);
  // Lyse, tynne skyer ved 0; tunge, blygrå regnskyer ved 1 (GEO.skydekke har stort spenn også i mørkt tema)
  const lys = mix(GEO.skydekke.lett, GEO.skydekke.tung, 0.12 + 0.5 * t);
  const mork = mix(GEO.skydekke.lett, GEO.skydekke.tung, 0.42 + 0.58 * t);
  const H = fin(himmel, 0);
  const inn = avrundet ? puter.r0 * 0.75 : 0;
  const pute = (p: Puff, fyll: string, i: number, lysFyll?: string) => (
    <g key={i}>
      <ellipse cx={r2(x + p.cx)} cy={r2(y + p.cy)} rx={r2(p.r)} ry={r2(p.r * p.e)} fill={fyll} />
      {lysFyll && <ellipse cx={r2(x + p.cx)} cy={r2(y + p.cy)} rx={r2(p.r)} ry={r2(p.r * p.e)} fill={lysFyll} />}
    </g>
  );
  return (
    <g opacity={dim ? 0.4 : undefined} aria-hidden>
      <LinearGradient
        id={`${id}g`}
        userSpace
        x1={0}
        y1={y}
        x2={0}
        y2={y + h}
        stops={[
          [0, tint(lys, 0.12)],
          [0.45, lys],
          [0.78, mix(lys, mork, 0.65)],
          [1, mork],
        ]}
      />
      <LinearGradient
        id={`${id}b`}
        userSpace
        x1={0}
        y1={y}
        x2={0}
        y2={y + h}
        stops={[
          [0, tint(lys, 0.2)],
          [0.6, mix(lys, mork, 0.25)],
          [1, mix(lys, mork, 0.55)],
        ]}
      />
      <RadialGradient
        id={`${id}l`}
        fx={0.36}
        fy={0.28}
        stops={[
          [0, GEO.skydekke.lett, 0.55 - 0.3 * t],
          [0.6, GEO.skydekke.lett, 0.08],
          [1, GEO.skydekke.lett, 0],
        ]}
      />
      {H > 0 && (
        <>
          <LinearGradient
            id={`${id}s`}
            userSpace
            x1={0}
            y1={y}
            x2={0}
            y2={y + H}
            stops={[
              [0, mix(lys, mork, 0.35), 0.96],
              [0.5, mix(lys, mork, 0.25), 0.82],
              [1, mix(lys, mork, 0.12), 0.6 + 0.25 * t],
            ]}
          />
          <rect x={r2(x)} y={r2(y)} width={r2(w)} height={r2(H)} fill={`url(#${id}s)`} />
        </>
      )}
      {!avrundet && (
        <defs>
          <clipPath id={`${id}k`}>
            <rect x={r2(x)} y={r2(y - h)} width={r2(w)} height={r2(3 * h)} />
          </clipPath>
        </defs>
      )}
      <g clipPath={avrundet ? undefined : `url(#${id}k)`}>
        {/* Skylaget bak putene (rett topp, eller avrundet med toppkant) */}
        <rect x={r2(x + inn)} y={r2(toppkant ? y + h * 0.3 : y - 2)} width={r2(Math.max(0, w - 2 * inn))} height={r2(toppkant ? h * 0.32 : h * 0.55 + 2)} fill={`url(#${id}b)`} />
        {puter.topp.map((p, i) => pute(p, `url(#${id}b)`, i, `url(#${id}l)`))}
        {puter.bak.map((p, i) => pute(p, `url(#${id}b)`, i, `url(#${id}l)`))}
        {puter.foran.map((p, i) => pute(p, `url(#${id}g)`, i, `url(#${id}l)`))}
      </g>
    </g>
  );
});

/** Nedbørtypene. */
export type NedborType = 'regn' | 'sno' | 'sludd';

/** Props til `Nedbor`. */
export interface NedborProps {
  /** Området nedbøren faller i: øverste venstre hjørne, bredde og høyde. */
  x?: number;
  y?: number;
  w: number;
  h: number;
  /** Regn (standard), snø eller sludd. */
  type?: NedborType;
  /** 0–1: fra noen få dråper (yr) til styrtregn eller tett snøvær. Styrer tettheten og lengden på stripene. Standard 0,5. */
  intensitet?: number;
  /** Vind fra −1 (mot venstre) til 1 (mot høyre): stripene heller og fnuggene driver. Standard 0,2. */
  vind?: number;
  /** Antall dråper eller fnugg (overstyrer intensiteten). */
  n?: number;
  /** Tid i sekunder: med `t` faller nedbøren (bruk useSimClock). Uten står den stille. */
  t?: number;
  /** Bakken (tall eller y(x) i samme koordinater): dråpene stopper der, med små sprut ved kraftig regn. */
  bakke?: SnittKurve;
  /**
   * Skylag øverst i området (`Skydekke`): true, eller { tetthet, hoyde, utenSkyer, avrundet }. Nedbøren starter under skybasen,
   * og ved kraftig regn faller et regnslør fra skyene. Standard: et skylag med tetthet etter intensiteten (nedbør faller
   * ikke fra en skyfri himmel); `false` gir ingen skyer. For en grå himmel bak landskapet: tegn Skydekke med `himmel`
   * (og samme høyde) rett etter Himmel, og gi Nedbor `utenSkyer: true`, så skyene ikke tegnes to ganger.
   */
  skydekke?: boolean | { tetthet?: number; hoyde?: number; utenSkyer?: boolean; avrundet?: boolean };
  seed?: number;
  dim?: boolean;
}

/**
 * Nedbør: regn (skrå striper i to avstander), snø (runde fnugg som daler og driver) eller sludd, med intensitet, vind og
 * fast frø, så figuren og skjermbildene blir like hver gang. Med `t` faller den (sett `t={clock.t}`). Med `skydekke`
 * tegnes et skylag øverst, og ved kraftig regn et regnslør under det. Fargen har kontrast mot himmelen i begge temaer.
 * Bygd på Regn og Snofall i fysikk/kap02.
 *
 * Ankerpunkt: øverste venstre hjørne av området. Med `bakke` stopper dråpene ved bakken, så området kan gå ned forbi
 * en terrengprofil. Tegn Nedbor etter landskapet:
 *   <Nedbor w={800} h={300} intensitet={0.8} vind={0.3} skydekke={{ tetthet: 0.9 }} bakke={(x) => 240 - 0.1 * x} t={clock.t} />
 */
export const Nedbor = memo(function Nedbor({
  x = 0,
  y = 0,
  w,
  h,
  type = 'regn',
  intensitet = 0.5,
  vind = 0.2,
  n,
  t,
  bakke,
  skydekke,
  seed = 7,
  dim,
}: NedborProps) {
  const k = useGeoScale();
  const s = useGeoStroke();
  const id = useSvgId('nedbor');
  if (!(w > 0) || !(h > 0) || !Number.isFinite(x) || !Number.isFinite(y)) return null;
  const I = clamp(fin(intensitet, 0.5), 0, 1);
  const V = clamp(fin(vind, 0), -1, 1);
  const tt = t !== undefined && Number.isFinite(t) ? t : 0;
  const skyInn = skydekke ?? { tetthet: 0.15 + 0.65 * I };
  const sky = skyInn ? (typeof skyInn === 'object' ? skyInn : {}) : null;
  const skyH = sky ? clamp(fin(sky.hoyde, 0.3 * h), 12, h * 0.8) : 0;
  const skyT = sky ? clamp(fin(sky.tetthet, 0.35 + 0.6 * I), 0, 1) : 0;
  const y0 = y + skyH * 0.7;
  const H = y + h - y0;
  const grunn = bakke === undefined ? () => y + h : somFn(bakke, y + h);
  const areal = (w * Math.max(0, H)) / (800 * 300);
  const nBase = type === 'regn' ? 300 : type === 'sno' ? 160 : 220;
  const antall = Math.round(clamp(fin(n, nBase * (0.08 + 0.92 * I * I) * areal), 0, 1200));
  const rand = sceneRandom(seed);
  // Mørkere enn himmelen i lyst tema og lysere i mørkt (blekket følger temaet)
  const regnFarge = mix(GEO.nedbor, VIZ.ink, 0.3);

  let nar = '';
  let fjern = '';
  let sprut = '';
  const fnugg: { cx: number; cy: number; r: number; vaat: boolean }[] = [];
  for (let i = 0; i < antall; i++) {
    const z = rand();
    const fx = rand();
    const fy = rand();
    const fase = rand() * 6.283;
    const erStripe = type === 'regn' || (type === 'sludd' && i % 2 === 0);
    if (erStripe) {
      const len = (8 + 20 * I) * (0.6 + 0.65 * z) * (type === 'sludd' ? 0.5 : 1) * Math.min(1.25, k);
      const fart = H * (1.5 + 0.8 * z);
      const dxs = V * 0.55 * len;
      const yy = y0 - len + mod(fy * (H + len) + fart * tt, H + len);
      const xx = x + mod(fx * w + V * fart * 0.55 * tt, w);
      const yb = grunn(xx + dxs);
      if (yy >= yb) continue;
      const bunn = Math.min(yy + len, yb);
      const top = Math.max(yy, y0);
      if (bunn - top < 1.5) continue;
      const fr = (top - yy) / len;
      const tl = (bunn - yy) / len;
      const seg = `M${r2(xx + dxs * fr)} ${r2(top)}L${r2(xx + dxs * tl)} ${r2(bunn)}`;
      if (z > 0.45) nar += seg;
      else fjern += seg;
      if (bakke !== undefined && I > 0.65 && bunn >= yb - 0.5 && z > 0.55) {
        const sx = xx + dxs * tl;
        sprut += `M${r2(sx - 3 * k)} ${r2(yb - 1.8 * k)}L${r2(sx - 1 * k)} ${r2(yb - 0.2)}M${r2(sx + 3 * k)} ${r2(yb - 1.8 * k)}L${r2(sx + 1 * k)} ${r2(yb - 0.2)}`;
      }
    } else {
      const r = (1.2 + 1.9 * z) * k * (type === 'sludd' ? 0.85 : 1);
      const fart = H * (type === 'sno' ? 0.18 + 0.12 * z : 0.45);
      const cy = y0 + mod(fy * H + fart * tt, H);
      const cx = x + mod(fx * w + V * fart * 1.2 * tt + Math.sin(tt * 1.3 + fase) * 4 * k, w);
      if (cy + r > grunn(cx)) continue;
      fnugg.push({ cx, cy, r, vaat: type === 'sludd' });
    }
  }

  const slor = sky && type !== 'sno' && I > 0.35;
  return (
    <g opacity={dim ? 0.4 : undefined} aria-hidden>
      {slor && (
        <>
          <defs>
            <clipPath id={`${id}k`}>
              <rect x={r2(x)} y={r2(y)} width={r2(w)} height={r2(h)} />
            </clipPath>
          </defs>
          <LinearGradient
            id={`${id}slor`}
            userSpace
            x1={0}
            y1={y0}
            x2={0}
            y2={y + h}
            stops={[
              [0, mix(SCENE.cloudShade, VIZ.ink, 0.25), 0.1 + 0.42 * (I - 0.35)],
              [1, mix(SCENE.cloudShade, VIZ.ink, 0.25), 0],
            ]}
          />
          {/* Sløret i striper med mykt fall mot kantene, så det ikke får harde sider */}
          <g clipPath={`url(#${id}k)`}>
            {Array.from({ length: 18 }, (_, j) => {
              const a = x + (w * j) / 18;
              const b = x + (w * (j + 1)) / 18;
              const m = (j + 0.5) / 18;
              const o = Math.sin(Math.PI * m) ** 0.8;
              const sk = V * 0.25 * H;
              return <path key={j} d={`M${r2(a)} ${r2(y0)}H${r2(b + 0.6)}L${r2(b + 0.6 + sk)} ${r2(y + h)}H${r2(a + sk)}Z`} fill={`url(#${id}slor)`} opacity={r2(o)} />;
            })}
          </g>
        </>
      )}
      {fjern && <path d={fjern} fill="none" stroke={regnFarge} strokeWidth={0.9 * s} strokeLinecap="round" opacity={0.38} />}
      {nar && <path d={nar} fill="none" stroke={regnFarge} strokeWidth={1.35 * s} strokeLinecap="round" opacity={0.62} />}
      {sprut && <path d={sprut} fill="none" stroke={regnFarge} strokeWidth={0.9 * s} strokeLinecap="round" opacity={0.55} />}
      {fnugg.length > 0 && (
        <g stroke={alpha(VIZ.ink, 0.3)} strokeWidth={0.6 * s}>
          {fnugg.map((fl, i) => (
            <circle key={i} cx={r2(fl.cx)} cy={r2(fl.cy)} r={r2(fl.r)} fill={fl.vaat ? mix(SCENE.snow, SCENE.water, 0.3) : SCENE.snow} />
          ))}
        </g>
      )}
      {sky && !sky.utenSkyer && <Skydekke x={x} y={y} w={w} h={skyH} tetthet={skyT} avrundet={sky.avrundet} seed={seed + 3} />}
    </g>
  );
});

/* =====================================================================================================================
 * Stromlinjer
 * ================================================================================================================== */

/** Stilen på en strøm. */
export type StromStil = 'baand' | 'linje' | 'stiplet' | 'prikker' | 'front';

/** Én strøm langs en sti. */
export interface StromLinje {
  /** Punktene stien går gjennom (minst to). Glattes med Catmull-Rom når `glatt` er på. */
  punkter: readonly SnittPunkt[];
  /** Tykkelsen (figurens enheter): gjør den proporsjonal med mengden (`stromBredde`). For 'front': bredden på fronten. */
  bredde?: number;
  /** Egen farge for denne strømmen. */
  farge?: string;
  /** Etikett ved stien («Fordamping 413», «Isstrøm»). */
  label?: string;
  /** Hvor langs stien etiketten står (0–1, standard 0,5). */
  labelPos?: number;
  /** Hvilken side av stien etiketten står på, sett i strømretningen (standard 'venstre', som er over en strøm mot høyre). */
  labelSide?: 'venstre' | 'hoyre';
  /** Ton ned strømmen. */
  dim?: boolean;
}

/** Props til `Stromlinjer`: én sti (`punkter`) eller flere (`linjer`) med felles stil, farge og tid. */
export interface StromlinjerProps {
  /** Flere strømmer. */
  linjer?: readonly StromLinje[];
  /** Én strøm (i stedet for `linjer`). */
  punkter?: readonly SnittPunkt[];
  bredde?: number;
  label?: string;
  labelPos?: number;
  labelSide?: 'venstre' | 'hoyre';
  /** Fargen (kapittelet velger: VIZ.velocity for strømning, GEO.nedbor, GEO.fordamping … i kretsløp). */
  farge: string;
  /**
   * 'baand' (standard): tykt bånd med pilspiss, som i et kretsløp (karbon, vann); 'linje': tynn linje med piler langs
   * (strømlinjer i grunnvann og is); 'stiplet': stiplet linje med pil; 'prikker': partikler langs stien;
   * 'front': bølgefronter på tvers av stien (bølger, seismikk).
   */
  stil?: StromStil;
  /** Glatt kurve gjennom punktene (standard på). */
  glatt?: boolean;
  /** Lukket sløyfe (mantelstrøm, konveksjonscelle): piler langs hele sløyfa, ingen ende. */
  lukket?: boolean;
  /** Pilspiss i enden (standard på, men av for 'front'). */
  pil?: boolean;
  /** Tid i sekunder: med `t` beveger pilene, stiplene, partiklene eller frontene seg langs stien. */
  t?: number;
  /** Farten langs stien (figurens enheter per sekund, standard 40). */
  fart?: number;
  /** Avstanden mellom pilene, partiklene eller frontene (standard etter stilen). */
  avstand?: number;
  /** Relativ tekststørrelse på etikettene (standard 0,8). */
  labelSize?: number;
  /**
   * Området etikettene må holde seg innenfor (figurens koordinater), f.eks. viewBox-en: `{ x0: 0, y0: 0, x1: 800, y1: H }`.
   * En etikett som ellers ville gått utenfor, bytter side av stien og flyttes inn. Standard: bare x0 = 0 og y0 = 0.
   */
  ramme?: { x0?: number; y0?: number; x1?: number; y1?: number };
  dim?: boolean;
}

interface Sti {
  p: P[];
  cum: number[];
  len: number;
  lukket: boolean;
}

/** Punktene langs en glatt kurve gjennom `punkter` (samme Catmull-Rom som glattSti i kotekart.tsx). */
function glattePunkter(punkter: readonly SnittPunkt[], lukket: boolean, perSegment = 14): P[] {
  const p: P[] = [];
  for (const q of punkter) {
    if (!Number.isFinite(q[0]) || !Number.isFinite(q[1])) continue;
    const sist = p[p.length - 1];
    if (!sist || Math.abs(sist[0] - q[0]) > 1e-6 || Math.abs(sist[1] - q[1]) > 1e-6) p.push([q[0], q[1]]);
  }
  if (lukket && p.length > 2) {
    const a = p[0]!;
    const b = p[p.length - 1]!;
    if (Math.abs(a[0] - b[0]) < 1e-6 && Math.abs(a[1] - b[1]) < 1e-6) p.pop();
  }
  const n = p.length;
  if (n < 3) return lukket && n === 2 ? [...p, p[0]!] : p;
  const hent = (i: number): P => (lukket ? p[((i % n) + n) % n]! : p[Math.max(0, Math.min(n - 1, i))]!);
  const out: P[] = [p[0]!];
  const segs = lukket ? n : n - 1;
  for (let i = 0; i < segs; i++) {
    const p0 = hent(i - 1);
    const p1 = hent(i);
    const p2 = hent(i + 1);
    const p3 = hent(i + 2);
    const c1: P = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2: P = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    for (let j = 1; j <= perSegment; j++) {
      const t = j / perSegment;
      const u = 1 - t;
      out.push([
        u * u * u * p1[0] + 3 * u * u * t * c1[0] + 3 * u * t * t * c2[0] + t * t * t * p2[0],
        u * u * u * p1[1] + 3 * u * u * t * c1[1] + 3 * u * t * t * c2[1] + t * t * t * p2[1],
      ]);
    }
  }
  return out;
}

function lagSti(punkter: readonly SnittPunkt[], glatt: boolean, lukket: boolean): Sti | null {
  let p = glatt ? glattePunkter(punkter, lukket) : punkter.filter((q) => Number.isFinite(q[0]) && Number.isFinite(q[1])).map((q): P => [q[0], q[1]]);
  if (!glatt && lukket && p.length > 2) p = [...p, p[0]!];
  if (p.length < 2) return null;
  const cum = [0];
  for (let i = 1; i < p.length; i++) cum.push(cum[i - 1]! + Math.hypot(p[i]![0] - p[i - 1]![0], p[i]![1] - p[i - 1]![1]));
  const len = cum[cum.length - 1]!;
  if (!(len > 0.5)) return null;
  return { p, cum, len, lukket };
}

/** Punktet og retningen (enhetsvektor) en strekning `d` langs stien. */
function stiVed(st: Sti, d: number): { x: number; y: number; ux: number; uy: number } {
  const dd = st.lukket ? mod(d, st.len) : clamp(d, 0, st.len);
  let lo = 0;
  let hi = st.cum.length - 1;
  while (hi - lo > 1) {
    const m = (lo + hi) >> 1;
    if (st.cum[m]! <= dd) lo = m;
    else hi = m;
  }
  const a = st.p[lo]!;
  const b = st.p[hi]!;
  const seg = st.cum[hi]! - st.cum[lo]! || 1;
  const t = clamp((dd - st.cum[lo]!) / seg, 0, 1);
  const ux = (b[0] - a[0]) / seg;
  const uy = (b[1] - a[1]) / seg;
  const l = Math.hypot(ux, uy) || 1;
  return { x: a[0] + t * (b[0] - a[0]), y: a[1] + t * (b[1] - a[1]), ux: ux / l, uy: uy / l };
}

/** Delen av stien fra d0 til d1 (åpen sti) som punkter. */
function delSti(st: Sti, d0: number, d1: number): P[] {
  const a = clamp(d0, 0, st.len);
  const b = clamp(d1, a, st.len);
  const start = stiVed(st, a);
  const slutt = stiVed(st, b);
  const inn = st.p.filter((_, i) => st.cum[i]! > a && st.cum[i]! < b);
  return [[start.x, start.y], ...inn, [slutt.x, slutt.y]];
}

/**
 * Punktet en andel (0–1) langs en sti (glattet som i Stromlinjer), og retningen der i grader (0 = mot høyre, 90 = ned,
 * som i SVG). Til etiketter, symboler og egne piler langs samme sti. Gir null for en sti uten lengde.
 */
export function langsSti(
  punkter: readonly SnittPunkt[],
  andel: number,
  valg: { glatt?: boolean; lukket?: boolean } = {},
): { x: number; y: number; vinkel: number } | null {
  const st = lagSti(punkter, valg.glatt ?? true, valg.lukket ?? false);
  if (!st) return null;
  const a = Number.isFinite(andel) ? andel : 0;
  const q = stiVed(st, (st.lukket ? mod(a, 1) : clamp(a, 0, 1)) * st.len);
  return { x: q.x, y: q.y, vinkel: (Math.atan2(q.uy, q.ux) * 180) / Math.PI };
}

/** Lengden på stien (glattet som i Stromlinjer), eller 0. */
export function stiLengde(punkter: readonly SnittPunkt[], valg: { glatt?: boolean; lukket?: boolean } = {}): number {
  return lagSti(punkter, valg.glatt ?? true, valg.lukket ?? false)?.len ?? 0;
}

/**
 * Tykkelsen på en strøm proporsjonal med mengden: `mengde / maks · maksBredde`, men aldri tynnere enn `minBredde` (så små
 * strømmer synes). Ugyldige tall og maks ≤ 0 gir `minBredde`.
 *   <Stromlinjer farge={GEO.fordamping} linjer={[{ punkter, bredde: stromBredde(413, 413), label: 'Fordamping' }]} />
 */
export function stromBredde(mengde: number, maks: number, maksBredde = 18, minBredde = 1.5): number {
  const mb = Number.isFinite(maksBredde) && maksBredde > 0 ? maksBredde : 18;
  const mi = Number.isFinite(minBredde) && minBredde >= 0 ? Math.min(minBredde, mb) : 1.5;
  if (!Number.isFinite(mengde) || !Number.isFinite(maks) || !(maks > 0)) return mi;
  return clamp((Math.abs(mengde) / maks) * mb, mi, mb);
}

/**
 * Strømmer langs en sti: tykke bånd med pilspiss for mengder i et kretsløp (karbon, vann: bredden etter mengden), tynne
 * strømlinjer med piler (grunnvann, isstrøm), stiplede linjer, partikler eller bølgefronter. En lukket sløyfe gir en
 * konveksjonscelle (mantelstrøm). Med `t` beveger pilene, stiplene, partiklene eller frontene seg langs stien med
 * `fart`. Fargen velger kapittelet; alt har glorie i flatefargen, så det synes oppå mønstre og vann.
 *
 * Ankerpunkt: punktene er i figurens koordinater (eller snittets inne i en Snittblokk eller et Grunnvannssnitt).
 * Strømmen går fra det første punktet til det siste.
 *   <Stromlinjer stil="linje" farge={VIZ.velocity} t={clock.t} linjer={[{ punkter: [[40, 200], [300, 230], [520, 180]] }]} />
 *   <Stromlinjer farge={GEO.nedbor} punkter={[[600, 60], [600, 200]]} bredde={stromBredde(111, 505)} label="Nedbør 111" />
 */
export function Stromlinjer({
  linjer,
  punkter,
  bredde,
  label,
  labelPos,
  labelSide,
  farge,
  stil = 'baand',
  glatt = true,
  lukket = false,
  pil,
  t,
  fart = 40,
  avstand,
  labelSize = 0.8,
  ramme,
  dim,
}: StromlinjerProps) {
  const s = useGeoStroke();
  const k = useGeoScale();
  const f = useTextScale();
  const liste: StromLinje[] = linjer ? [...linjer] : punkter ? [{ punkter, bredde, label, labelPos, labelSide }] : [];
  const tt = t !== undefined && Number.isFinite(t) ? t : 0;
  const v = fin(fart, 40);
  const medPil = pil ?? stil !== 'front';
  return (
    <g opacity={dim ? 0.4 : undefined}>
      {liste.map((l, i) => {
        const st = lagSti(l.punkter, glatt, lukket);
        if (!st) return null;
        const c = l.farge ?? farge;
        const standardBredde = stil === 'baand' ? 8 : stil === 'front' ? 34 : 2.2;
        const b = Math.max(0.8, fin(l.bredde ?? bredde, standardBredde)) * (stil === 'baand' || stil === 'front' ? 1 : s);
        const gap = Math.max(12, fin(avstand, stil === 'prikker' ? 26 * k : stil === 'front' ? 30 * k : stil === 'baand' ? 60 : 80));
        const fase = mod(v * tt, gap);
        return (
          <g key={i} opacity={l.dim ? 0.4 : undefined}>
            <StromTegning st={st} c={c} b={b} stil={stil} pil={medPil && !lukket} gap={gap} fase={fase} t={tt} v={v} s={s} k={k} />
            {l.label && (
              <StromEtikett
                st={st}
                c={c}
                b={stil === 'front' ? b * 0.5 : b}
                tekst={l.label}
                pos={l.labelPos ?? labelPos ?? 0.5}
                side={l.labelSide ?? labelSide ?? 'venstre'}
                f={f}
                size={labelSize}
                pilLengde={medPil && !lukket ? (stil === 'baand' ? Math.max(11 * s, 1.5 * b) : 12 * s) : 0}
                ramme={ramme}
              />
            )}
          </g>
        );
      })}
    </g>
  );
}

function pilspiss(x: number, y: number, ux: number, uy: number, lengde: number, halv: number): string {
  const bx = x - ux * lengde;
  const by = y - uy * lengde;
  const nx = -uy;
  const ny = ux;
  return `M${r2(x)} ${r2(y)}L${r2(bx + nx * halv)} ${r2(by + ny * halv)}L${r2(bx + ux * lengde * 0.18)} ${r2(by + uy * lengde * 0.18)}L${r2(bx - nx * halv)} ${r2(by - ny * halv)}Z`;
}

function StromTegning({
  st,
  c,
  b,
  stil,
  pil,
  gap,
  fase,
  t,
  v,
  s,
  k,
}: {
  st: Sti;
  c: string;
  b: number;
  stil: StromStil;
  pil: boolean;
  gap: number;
  fase: number;
  t: number;
  v: number;
  s: number;
  k: number;
}) {
  const kant = shade(c, 0.32);
  const halo = VIZ.surface;
  if (stil === 'baand') {
    const hl = Math.min(st.len * 0.45, Math.max(11 * s, 1.5 * b));
    const hh = Math.max(6.5 * s, 0.98 * b);
    const kropp = pil ? delSti(st, 0, st.len - hl * 0.82) : st.p;
    const d = sti(kropp, st.lukket && !pil);
    const ende = stiVed(st, st.len);
    const spiss = pil ? pilspiss(ende.x, ende.y, ende.ux, ende.uy, hl, hh) : '';
    // Lyse vinkler inne i båndet som viser retningen (og beveger seg med t)
    const vinkler: string[] = [];
    if (b >= 7) {
      const slutt = pil ? st.len - hl * 1.3 : st.len;
      for (let d0 = fase + gap * 0.5; d0 < slutt - b * 0.3; d0 += gap) {
        if (d0 < b * 0.6) continue;
        const q = stiVed(st, d0);
        const a = b * 0.28;
        const nx = -q.uy;
        const ny = q.ux;
        vinkler.push(`M${r2(q.x - q.ux * a + nx * a * 1.1)} ${r2(q.y - q.uy * a + ny * a * 1.1)}L${r2(q.x + q.ux * a * 0.4)} ${r2(q.y + q.uy * a * 0.4)}L${r2(q.x - q.ux * a - nx * a * 1.1)} ${r2(q.y - q.uy * a - ny * a * 1.1)}`);
      }
    }
    return (
      <g strokeLinejoin="round">
        <path d={d} fill="none" stroke={halo} strokeWidth={b + 4 * s} opacity={0.85} strokeLinecap="butt" />
        {spiss && <path d={spiss} fill={halo} stroke={halo} strokeWidth={4 * s} opacity={0.85} />}
        <path d={d} fill="none" stroke={kant} strokeWidth={b + 1.6 * s} strokeLinecap="butt" />
        <path d={d} fill="none" stroke={c} strokeWidth={b} strokeLinecap="butt" />
        {b >= 6 && <path d={d} fill="none" stroke={tint(c, 0.35)} strokeWidth={b * 0.22} strokeLinecap="butt" opacity={0.45} transform={`translate(${r2(-b * 0.12)} ${r2(-b * 0.12)})`} />}
        {vinkler.length > 0 && <path d={vinkler.join('')} fill="none" stroke={tint(c, 0.55)} strokeWidth={Math.max(1.2, b * 0.14)} strokeLinecap="round" opacity={0.85} />}
        {spiss && <path d={spiss} fill={c} stroke={kant} strokeWidth={1 * s} />}
      </g>
    );
  }
  if (stil === 'front') {
    const fronter: { d: string; o: number }[] = [];
    for (let d0 = fase; d0 <= st.len; d0 += gap) {
      const q = stiVed(st, d0);
      const nx = -q.uy;
      const ny = q.ux;
      const a = b / 2;
      const bue = b * 0.22;
      const rel = d0 / st.len;
      const o = st.lukket ? 1 : clamp(Math.min(rel / 0.12, (1 - rel) / 0.12, 1), 0.15, 1);
      fronter.push({
        d: `M${r2(q.x + nx * a - q.ux * bue)} ${r2(q.y + ny * a - q.uy * bue)}Q${r2(q.x + q.ux * bue)} ${r2(q.y + q.uy * bue)} ${r2(q.x - nx * a - q.ux * bue)} ${r2(q.y - ny * a - q.uy * bue)}`,
        o,
      });
    }
    const ende = stiVed(st, st.len);
    return (
      <g fill="none" strokeLinecap="round">
        {fronter.map((fr, i) => (
          <g key={i} opacity={fr.o}>
            <path d={fr.d} stroke={halo} strokeWidth={5.5 * s} opacity={0.8} />
            <path d={fr.d} stroke={c} strokeWidth={2.6 * s} />
          </g>
        ))}
        {pil && <path d={pilspiss(ende.x, ende.y, ende.ux, ende.uy, 12 * s, 6.5 * s)} fill={c} stroke={halo} strokeWidth={1.5 * s} className="sc-force" />}
      </g>
    );
  }
  // Tynne stiler: linje, stiplet og prikker
  const hl = Math.max(9 * s, 3.4 * b);
  const hh = Math.max(4.8 * s, 1.9 * b);
  const ende = stiVed(st, st.len);
  const kropp = pil ? delSti(st, 0, st.len - hl * 0.7) : st.p;
  const d = sti(kropp, st.lukket && !pil);
  const piler: string[] = [];
  if (stil === 'linje') {
    for (let d0 = fase + gap * 0.5; d0 < st.len; d0 += gap) {
      if (!st.lukket && (d0 < hl * 1.2 || (pil && d0 > st.len - gap * 0.45))) continue;
      const q = stiVed(st, d0 + hl * 0.5);
      piler.push(pilspiss(q.x, q.y, q.ux, q.uy, hl * 0.9, hh * 0.9));
    }
  }
  const prikker: P[] = [];
  if (stil === 'prikker') {
    for (let d0 = fase; d0 < st.len - (pil ? hl * 1.2 : 0); d0 += gap) {
      const q = stiVed(st, d0);
      prikker.push([q.x, q.y]);
    }
  }
  const strek = stil === 'stiplet' ? `${r2(Math.max(5, 2.6 * b + 4 * s))} ${r2(Math.max(4, 1.8 * b + 3 * s))}` : undefined;
  const strekFase = stil === 'stiplet' ? r2(-mod(v * t, 1000)) : undefined;
  return (
    <g strokeLinejoin="round">
      <path d={d} fill="none" stroke={halo} strokeWidth={b + 3 * s} opacity={stil === 'prikker' ? 0.5 : 0.75} strokeLinecap="round" />
      <path
        d={d}
        fill="none"
        stroke={c}
        strokeWidth={stil === 'prikker' ? Math.max(1, b * 0.6) : b}
        strokeLinecap={stil === 'stiplet' ? 'butt' : 'round'}
        strokeDasharray={strek}
        strokeDashoffset={strekFase}
        opacity={stil === 'prikker' ? 0.45 : 1}
      />
      {piler.length > 0 && <path d={piler.join('')} fill={c} stroke={halo} strokeWidth={1.4 * s} className="sc-force" />}
      {prikker.map(([px, py], i) => (
        <circle key={i} cx={r2(px)} cy={r2(py)} r={r2(Math.max(2.4 * k, 1.1 * b))} fill={c} stroke={halo} strokeWidth={1.2 * s} />
      ))}
      {pil && <path d={pilspiss(ende.x, ende.y, ende.ux, ende.uy, hl, hh)} fill={c} stroke={halo} strokeWidth={1.5 * s} className="sc-force" />}
    </g>
  );
}

function StromEtikett({
  st,
  c,
  b,
  tekst,
  pos,
  side,
  f,
  size,
  pilLengde,
  ramme,
}: {
  st: Sti;
  c: string;
  b: number;
  tekst: string;
  pos: number;
  side: 'venstre' | 'hoyre';
  f: number;
  size: number;
  pilLengde: number;
  ramme?: { x0?: number; y0?: number; x1?: number; y1?: number };
}) {
  const fs = 17 * size * f;
  const tb = tekstBredde(tekst, fs);
  // Hold etiketten unna pilspissen i enden (de siste ca. 10 % av stien)
  const maks = pilLengde > 0 && !st.lukket ? clamp(1 - (pilLengde + 0.6 * fs) / st.len, 0.5, 0.9) : 1;
  const onsket = Math.min(clamp(fin(pos, 0.5), 0, 1), maks);
  const X0 = fin(ramme?.x0, 0);
  const Y0 = fin(ramme?.y0, 0);
  const X1 = fin(ramme?.x1, Infinity);
  const Y1 = fin(ramme?.y1, Infinity);
  const ende = stiVed(st, st.len);
  const spissR = pilLengde > 0 && !st.lukket ? pilLengde + b / 2 + 3 : 0;
  const plasser = (andel: number, sd: 'venstre' | 'hoyre') => {
    const q = stiVed(st, andel * st.len);
    // Venstre for retningen (u) er (uy, −ux) i SVG (y nedover)
    const sgn = sd === 'venstre' ? 1 : -1;
    const nx = q.uy * sgn;
    const ny = -q.ux * sgn;
    const avst = b / 2 + 7 * f;
    const lx = q.x + nx * avst;
    const ly = q.y + ny * avst;
    const anchor: 'start' | 'middle' | 'end' = Math.abs(nx) < 0.35 ? 'middle' : nx > 0 ? 'start' : 'end';
    const baseline = ny > 0.35 ? ly + fs * 0.8 : ny < -0.35 ? ly - fs * 0.15 : ly + fs * 0.33;
    const x0 = anchor === 'start' ? lx : anchor === 'end' ? lx - tb : lx - tb / 2;
    const y0 = baseline - fs * 0.85;
    const y1 = baseline + fs * 0.25;
    const ut = Math.max(0, X0 - x0) + Math.max(0, x0 + tb - X1) + Math.max(0, Y0 - y0) + Math.max(0, y1 - Y1);
    // Overlapp med pilspissen (en boks rundt spissen)
    const paaSpiss =
      spissR > 0 && x0 < ende.x + spissR && ende.x - spissR < x0 + tb && y0 < ende.y + spissR && ende.y - spissR < y1 ? 1 : 0;
    return { lx, baseline, anchor, x0, ut, paaSpiss };
  };
  const andre = side === 'venstre' ? 'hoyre' : 'venstre';
  let valgt: ReturnType<typeof plasser> | null = null;
  let reserve: ReturnType<typeof plasser> | null = null;
  // Prøv den ønskede plassen, så litt bakover langs stien; først den valgte siden, så den andre
  for (let i = 0; i <= 8 && !valgt; i++) {
    const andel = onsket - 0.07 * i;
    if (andel < 0.05 && i > 0) break;
    for (const sd of [side, andre] as const) {
      const p = plasser(Math.max(0, andel), sd);
      if (p.ut <= 0.5 && !p.paaSpiss) {
        valgt = p;
        break;
      }
      if (!reserve || p.ut + 1000 * p.paaSpiss < reserve.ut + 1000 * reserve.paaSpiss) reserve = p;
    }
  }
  valgt = valgt ?? reserve ?? plasser(onsket, side);
  // Flytt inn det som fortsatt stikker ut
  const dx = Math.max(0, X0 - valgt.x0) - Math.max(0, valgt.x0 + tb - X1);
  const topp = valgt.baseline - fs * 0.85;
  const dy = Math.max(0, Y0 - topp) - Math.max(0, valgt.baseline + fs * 0.25 - Y1);
  return (
    <Txt x={r2(valgt.lx + dx)} y={r2(valgt.baseline + dy)} anchor={valgt.anchor} size={size} color={c} weight={700}>
      {tekst}
    </Txt>
  );
}
