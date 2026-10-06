/**
 * Krasjtest: scenen med krasjhallen, betongveggen, bilen som presses sammen og krasjtestdukken i forsetet.
 * Egne gjenstander for kapittel 4 i samme stil som scene-kit-et (toninger fra core, SCENE-farger, kontur, myk skygge):
 * `Krasjvegg` (betongblokk med stålplate og varselstriper), `KnustFront` og `Bulker` (sammenpresset front og panser
 * som bretter seg opp), `Interior` og `Kollisjonspute` (kupeen sett med døra og A-stolpen skåret bort) og
 * `Maalemerke` (gult og svart merke som på krasjtestbiler).
 *
 * Bilen tegnes med `Bil` fra scene-kit-et i fast skala (PX_PER_M). Fronten klippes bort der den er presset sammen,
 * og den knuste delen tegnes i stedet. Alt i bilen regnes i bilens egne enheter (440 fra støtfanger til støtfanger,
 * som i kjoretoy.tsx) med ankerpunktet midt mellom hjulene på bakken, og gjøres om til figurens koordinater med `P`.
 * Dukken, beltet og målene regnes i ekte centimeter (PXR).
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { Txt, TSub, VIZ, fmt } from '../../kit';
import {
  BIL_MAAL,
  Bil,
  Callout,
  ContactShadow,
  Dimension,
  ForceArrow,
  LinearGradient,
  PAINTS,
  Person,
  Place,
  Rom,
  SCENE,
  hjulvinkelFraStrekning,
  materialStops,
  mix,
  personPunkter,
  sceneRandom,
  shade,
  tint,
  useStrokeScale,
  useSvgId,
  type Leddvinkler,
} from '../../kit/scene';
import { RESTRAINTS, airbagFill, crashAt, type CrashResult } from './model-krasjtest';

/* ================================================================================================
 * Mål og oppsett
 * ============================================================================================== */

/** Fast skala i hele scenen: 140 px per meter. */
export const PX_PER_M = 140;
/** Piksler per (ekte) centimeter. */
const PXR = PX_PER_M / 100;
/**
 * Bilen er en stor stasjonsvogn på 5,0 m (1,7 m høy), så dukken på 1,75 m får like god plass fram til frontruta som
 * i en ekte bil. `Bil` i scene-kit-et tegnes i 440 enheter fra støtfanger til støtfanger.
 */
const CAR_M = 5.0;
/** Piksler per enhet i bilens koordinater, og ekte centimeter per enhet. */
const KC = (CAR_M * PX_PER_M) / 440;
const CU = (CAR_M * 100) / 440;
/** Fartspilene: piksler per m/s (90 km/h = 25 m/s gir 150 px). */
const PX_PER_MS = 6;
const W = 800;
/** Veggflaten (der støtfangeren treffer). */
const WALL_X = 734;
/** Fra ankerpunktet fram til støtfangeren (bilens enheter). */
const FRONT = BIL_MAAL.foran * 100;
/** Ankerpunktet til bilen i det støtfangeren treffer veggen. */
const ANCHOR0 = WALL_X - FRONT * KC;
/** Høyden på bilen (px). */
const CAR_H = BIL_MAAL.hoyde * (CAR_M / BIL_MAAL.lengde) * PX_PER_M;
/** På mobil viser figuren bare den fremre delen av bilen (fra x = 180), så dukken og fronten blir større. */
const CROP_X = 180;
/** Målemerket på bakdøra, som bilens strekning måles fra (bilens enheter). */
const CAR_MARK: Pt = { x: -84, y: -66 };

/**
 * Plassering av scenen. `f` er tekstskaleringen figuren får (1 på PC, større på mobil), `crop` om figuren er
 * beskåret til den fremre delen av bilen (mobil).
 */
export function crashLayout(f: number, crop: boolean) {
  const G = Math.round(CAR_H + 42 + 56 * f);
  const roofY = G - CAR_H;
  const vArrowY = roofY - 13 - 9 * f;
  const dimY = vArrowY - 24 - 22 * f;
  const carDimY = G + 8 + 22 * f;
  const H = Math.round(carDimY + 10 + 4 * f);
  const vbX = crop ? CROP_X : 0;
  return { G, roofY, vArrowY, dimY, carDimY, H, vbX, vbW: W - vbX, viewBox: `${vbX} 0 ${W - vbX} ${H}` };
}

/**
 * Om scenen skal beskjæres (smal beholder) og tekstskaleringen figuren da får (samme regel som Figure i
 * kit/controls), målt på beholderen før figuren tegnes, så viewBox-en kan velges etter den.
 */
export function useCrashFrame<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [frame, setFrame] = useState({ f: 1, crop: false });
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const update = () => {
      const w = el.getBoundingClientRect().width;
      if (!(w > 0)) return;
      const crop = w < 560;
      const vbW = crop ? W - CROP_X : W;
      const f = Math.round(Math.max(1, 12.5 / 17 / (w / vbW)) * 20) / 20;
      setFrame((old) => (old.f === f && old.crop === crop ? old : { f, crop }));
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, frame] as const;
}

type Pt = { x: number; y: number };
const r2 = (v: number) => Math.round(v * 100) / 100;
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const poly = (pts: [number, number][]) => `M${pts.map(([x, y]) => `${r2(x)},${r2(y)}`).join('L')}Z`;
const line = (pts: [number, number][]) => `M${pts.map(([x, y]) => `${r2(x)},${r2(y)}`).join('L')}`;

/* ================================================================================================
 * Bilens profil (bilens enheter, samme mål som Bil i kjoretoy.tsx)
 * ============================================================================================== */

function cubicPts(p0: Pt, p1: Pt, p2: Pt, p3: Pt, n: number): Pt[] {
  const out: Pt[] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const u = 1 - t;
    out.push({
      x: u * u * u * p0.x + 3 * u * u * t * p1.x + 3 * u * t * t * p2.x + t * t * t * p3.x,
      y: u * u * u * p0.y + 3 * u * u * t * p1.y + 3 * u * t * t * p2.y + t * t * t * p3.y,
    });
  }
  return out;
}

/** Overkanten av bilen fra frontruta (x = 70) til fronten (x = 226): panseret og den øvre delen av fronten. */
const TOP_PROFILE: Pt[] = [
  ...cubicPts({ x: 70, y: -97 }, { x: 112, y: -93 }, { x: 172, y: -86 }, { x: 212, y: -77 }, 24),
  ...cubicPts({ x: 212, y: -77 }, { x: 222, y: -72 }, { x: 226, y: -64 }, { x: 226, y: -50 }, 12).slice(1),
].sort((a, b) => a.x - b.x);

/** Høyden (y, negativ oppover) til overkanten av bilen ved x (bilens enheter). */
function topY(x: number): number {
  const p = TOP_PROFILE;
  if (x <= p[0]!.x) return p[0]!.y;
  for (let i = 1; i < p.length; i++) {
    const a = p[i - 1]!;
    const b = p[i]!;
    if (x <= b.x) return b.x - a.x < 1e-6 ? Math.min(a.y, b.y) : lerp(a.y, b.y, (x - a.x) / (b.x - a.x));
  }
  return p[p.length - 1]!.y;
}

/** Hvor tykt laget av sammenpresset metall blir når fronten er presset sammen C (bilens enheter). */
const crumpleWidth = (C: number) => (C > 0.5 ? 5 + 0.42 * C : 0);

/**
 * Åpningen der døra og A-stolpen er skåret bort (bilens enheter): fra B-stolpen langs taket, ned langs innsiden av frontruta og
 * dørkanten til dørterskelen.
 */
const CABIN = 'M-22,-143C-12,-142.7 -6,-142.6 -2,-142.5C20,-136 44,-114 66,-99L74,-96C86,-82 94,-62 95,-30L-24,-30L-23.5,-99Z';
/** Innsiden av frontruta (bilens enheter), der ruta er skåret over. */
const WINDSHIELD = 'M-2,-142.5C20,-136 44,-114 66,-99';

/** Sittebeina til dukken og føttene på gulvet (bilens enheter). */
const SEAT_ANCHOR: Pt = { x: 7.5, y: -45 };
const FEET: Record<'venstreFot' | 'hoyreFot', Pt> = { venstreFot: { x: 61, y: -35 }, hoyreFot: { x: 55, y: -35 } };
/** Dukken er 1,75 m (stående). */
const DUMMY_CM = 175;
/** Ryggen lener seg 20° bakover i setet. */
const RYGG0 = -20;
/** Øvre feste for beltet på B-stolpen (bilens enheter). */
const BELT_TOP: Pt = { x: -23, y: -104 };
/** Dukkens farger: gul «hud» og mørk drakt. */
const DUMMY_SKIN = mix(PAINTS.gul, SCENE.skin, 0.25);
const DUMMY_SUIT = mix(PAINTS.svart, SCENE.denim, 0.3);

/* ================================================================================================
 * Dukken: positur fra hvor langt den har glidd fram i bilen
 * ============================================================================================== */

interface DummyPose {
  /** Hvor langt hofta har glidd fram (cm). */
  hip: number;
  ledd: Partial<Leddvinkler>;
}

function dummyLedd(rygg: number, p: number, kind: 'jevn' | 'treff'): Partial<Leddvinkler> {
  return {
    rygg,
    nakke: kind === 'jevn' ? 4 + 20 * p : 4 + 10 * p,
    venstreSkulder: 24 + 34 * p,
    hoyreSkulder: 18 + 36 * p,
    venstreAlbue: 62 - 26 * p,
    hoyreAlbue: 66 - 30 * p,
  };
}

/** Hodets x (cm, fra sittebeina) for en positur. */
function headX(ledd: Partial<Leddvinkler>): number {
  return personPunkter('sitte', DUMMY_CM, ledd).hode.x;
}

/**
 * Positur når dukken har glidd `rel` (m) fram i bilen. Hofta glir litt (beltet holder den), resten er overkroppen som
 * bøyer seg fram, så hodet flytter seg nøyaktig `rel` fram i forhold til bilen (det er hodet vi måler på).
 * `p` er hvor langt i bevegelsen dukken er kommet (0–1), til armer og nakke.
 */
function dummyPose(rel: number, p: number, kind: 'jevn' | 'treff'): DummyPose {
  const relCm = Math.max(0, rel * 100);
  const hip = kind === 'jevn' ? 0.22 * relCm : Math.min(0.25 * relCm, 11);
  if (relCm <= 0) return { hip: 0, ledd: dummyLedd(RYGG0, 0, kind) };
  const x0 = headX(dummyLedd(RYGG0, 0, kind));
  const target = x0 + relCm - hip;
  let lo = RYGG0 - 10;
  let hi = 75;
  for (let i = 0; i < 28; i++) {
    const mid = (lo + hi) / 2;
    if (headX(dummyLedd(mid, p, kind)) < target) lo = mid;
    else hi = mid;
  }
  return { hip, ledd: dummyLedd((lo + hi) / 2, p, kind) };
}

/* ================================================================================================
 * Små gjenstander
 * ============================================================================================== */

/** Gult og svart målemerke (kvartsirkler), som på krasjtestbiler og -dukker. (x, y) er midten. */
export function Maalemerke({ x, y, r, ghost }: { x: number; y: number; r: number; ghost?: boolean }) {
  const ss = useStrokeScale();
  if (!(r > 0)) return null;
  if (ghost) return <circle cx={x} cy={y} r={r} fill="none" stroke={VIZ.ink} strokeWidth={1.2 * ss} strokeDasharray="3 2.5" opacity={0.6} />;
  const q = (a0: number) => {
    const a = (a0 * Math.PI) / 180;
    const b = ((a0 + 90) * Math.PI) / 180;
    return `M${r2(x)},${r2(y)}L${r2(x + r * Math.cos(a))},${r2(y + r * Math.sin(a))}A${r2(r)},${r2(r)} 0 0 1 ${r2(x + r * Math.cos(b))},${r2(y + r * Math.sin(b))}Z`;
  };
  return (
    <g aria-hidden>
      <circle cx={x} cy={y} r={r} fill={PAINTS.gul} />
      <path d={`${q(0)}${q(180)}`} fill={PAINTS.svart} />
      <circle cx={x} cy={y} r={r} fill="none" stroke={SCENE.outline} strokeWidth={0.8 * ss} />
    </g>
  );
}

/**
 * Betongveggen bilen kjører inn i, sett fra siden: en tung blokk med stålplate på flaten bilen treffer og gule og
 * svarte varselstriper langs kanten. (x, y) er nederst på veggflaten; blokken går ut av figuren til høyre.
 */
export function Krasjvegg({ x, y, h, right = W + 10 }: { x: number; y: number; h: number; right?: number }) {
  const ss = useStrokeScale();
  const id = useSvgId('krasjvegg');
  const top = y - h;
  const plate = 7;
  const stripeX = x + plate;
  const stripeW = 11;
  const lift = 9;
  let stripes = '';
  for (let yy = top - 14; yy < y + 14; yy += 14)
    stripes += `M${r2(stripeX)},${r2(yy)}L${r2(stripeX + stripeW)},${r2(yy - 7)}L${r2(stripeX + stripeW)},${r2(yy)}L${r2(stripeX)},${r2(yy + 7)}Z`;
  let seams = '';
  for (let yy = top + h * 0.34; yy < y - 6; yy += h * 0.33) seams += `M${r2(stripeX + stripeW + 2)},${r2(yy)}H${r2(right)}`;
  return (
    <g aria-hidden>
      <ContactShadow cx={x + 40} cy={y + 1} rx={70} ry={5} />
      <LinearGradient id={`${id}-side`} stops={materialStops(SCENE.concrete, 0.8)} />
      <LinearGradient id={`${id}-top`} stops={[[0, tint(SCENE.concrete, 0.3)], [1, tint(SCENE.concrete, 0.12)]]} />
      <LinearGradient id={`${id}-plate`} x2={1} y2={0} stops={[[0, SCENE.metalDark], [0.45, SCENE.metal], [1, SCENE.metalLight]]} />
      <clipPath id={`${id}-clip`}>
        <rect x={stripeX} y={top} width={stripeW} height={h} />
      </clipPath>
      <path d={`M${x},${top}L${x + lift},${top - lift}H${right}V${top}Z`} fill={`url(#${id}-top)`} stroke={SCENE.outline} strokeWidth={0.8 * ss} />
      <rect x={x} y={top} width={right - x} height={h} fill={`url(#${id}-side)`} stroke={SCENE.outline} strokeWidth={0.9 * ss} />
      <path d={seams} stroke={shade(SCENE.concrete, 0.18)} strokeWidth={1 * ss} opacity={0.7} />
      {[0.22, 0.56, 0.88].map((u) =>
        [0.17, 0.5, 0.83].map((v) => (
          <circle key={`${u}-${v}`} cx={lerp(stripeX + stripeW + 10, right - 6, u)} cy={top + h * v} r={1.6 * ss} fill={shade(SCENE.concrete, 0.3)} opacity={0.6} />
        )),
      )}
      <rect x={stripeX} y={top} width={stripeW} height={h} fill={PAINTS.gul} />
      <path d={stripes} fill={PAINTS.svart} clipPath={`url(#${id}-clip)`} opacity={0.9} />
      <rect x={stripeX} y={top} width={stripeW} height={h} fill="none" stroke={SCENE.outline} strokeWidth={0.8 * ss} />
      <rect x={x} y={top - 2} width={plate} height={h + 2} fill={`url(#${id}-plate)`} stroke={SCENE.outline} strokeWidth={0.9 * ss} />
    </g>
  );
}

/**
 * Den sammenpressede fronten (bilens enheter): mellom kuttet i karosseriet og veggen. Metallet er brettet som et
 * trekkspill i noen få brede folder med lyse og mørke flater og skarpe bretter, og den svarte støtfangeren er klemt
 * flat mot veggen. `C` er hvor mye fronten er presset sammen. Tegnes før bilen, så forhjulet ligger oppå.
 */
function KnustFront({ C, color, sw }: { C: number; color: string; sw: number }) {
  const id = useSvgId('knust');
  const w = crumpleWidth(C);
  if (!(w > 0)) return null;
  const wall = FRONT - C;
  const cut = wall - w;
  const y0 = topY(cut);
  const yFront = Math.max(y0 + 4, -78);
  const bottom = -16;
  const n = Math.max(2, Math.min(5, Math.round(w / 6.5)));
  const amp = Math.min(6, 1.2 + 0.12 * C);
  const fold = Math.min(3.2, (0.32 * w) / n);
  // Bretter fra topp til bunn: sikksakk, så flatene mellom dem står på skrå som i et trekkspill.
  const levels = [0, 0.3, 0.62, 1];
  const crease = (i: number): [number, number][] => {
    const x = cut + (w * i) / n;
    const yt = lerp(y0, yFront, i / n) - (i % 2 === 1 ? amp : 0);
    return levels.map((v, j) => [x + (j % 2 === 0 ? fold : -fold) * (i % 2 === 0 ? 1 : -1), lerp(yt, bottom, v)]);
  };
  const creases = Array.from({ length: n + 1 }, (_, i) => crease(i));
  const topEdge: [number, number][] = creases.map((c) => c[0]!);
  topEdge[0] = [cut, y0];
  topEdge[n] = [wall - 0.6, yFront];
  const outline = poly([...topEdge, [wall, yFront + 3], [wall, -22], [wall - 2.5, bottom + 1], [cut + 0.5 * w, bottom - 0.5], [cut, bottom - 3]]);
  const panels = Array.from({ length: n }, (_, i) => poly([...creases[i]!, ...[...creases[i + 1]!].reverse()]));
  const bumper = Math.min(7, 0.38 * w);
  const bumperPath = poly([
    [wall - bumper, -54],
    [wall - bumper * 0.45, -47],
    [wall - bumper, -40],
    [wall - bumper * 0.4, -33],
    [wall - bumper, -26],
    [wall - bumper * 0.5, -20],
    [wall - 2.5, bottom + 1],
    [wall, -22],
    [wall, -54],
  ]);
  return (
    <g>
      <LinearGradient id={`${id}-lakk`} stops={materialStops(shade(color, 0.06), 1.3)} />
      <clipPath id={`${id}-clip`}>
        <path d={outline} />
      </clipPath>
      <path d={outline} fill={`url(#${id}-lakk)`} />
      <g clipPath={`url(#${id}-clip)`}>
        {panels.map((d, i) => (
          <path key={i} d={d} fill={i % 2 === 0 ? shade(color, 0.36) : tint(color, 0.35)} opacity={i % 2 === 0 ? 0.9 : 0.6} />
        ))}
        {creases.slice(1, n).map((c, i) => (
          <g key={i} fill="none" strokeLinejoin="round">
            <path d={line(c)} stroke={shade(color, 0.7)} strokeWidth={sw * 1.5} />
            <path d={line(c.map(([x, y]) => [x + 1, y]))} stroke={SCENE.highlight} strokeWidth={sw} />
          </g>
        ))}
        {/* Mørkt motorrom som synes der panseret er presset opp */}
        <path d={poly([[cut, y0 + 2], [cut + 0.45 * w, y0 + 1 - amp * 0.5], [cut + 0.75 * w, yFront + 4], [cut + 0.4 * w, y0 + 10], [cut, y0 + 8]])} fill={shade(SCENE.rubberLight, 0.15)} opacity={0.8} />
        <path d={bumperPath} fill={SCENE.rubberLight} stroke={SCENE.outline} strokeWidth={sw} />
        {/* Knust frontlykt */}
        <path d={poly([[wall - 0.5, yFront + 5], [wall - Math.min(6, 0.45 * w), yFront + 8], [wall - 1.2, yFront + 13]])} fill={SCENE.metalLight} opacity={0.9} />
      </g>
      <path d={outline} fill="none" stroke={SCENE.outline} strokeWidth={sw} strokeLinejoin="round" />
    </g>
  );
}

/**
 * Panseret og skjermen bak den knuste delen (bilens enheter): panseret bretter seg opp i en rygg, og skjermen over
 * forhjulet får lange skrå bretter. Tegnes oppå bilen.
 */
function Bulker({ C, color, sw }: { C: number; color: string; sw: number }) {
  if (!(C > 3)) return null;
  const w = crumpleWidth(C);
  const cut = FRONT - C - w;
  const hb = Math.min(48, 0.7 * C + 8);
  const xb0 = cut - hb;
  const amp = Math.min(15, 0.36 * C);
  const ridge = xb0 + 0.58 * hb;
  const yr = topY(ridge) - amp;
  const back = poly([
    [xb0, topY(xb0) + 0.3],
    [ridge, yr],
    [ridge, topY(ridge) + 0.5],
  ]);
  const frontFace = poly([
    [ridge, yr],
    [cut + 0.3, topY(cut) - amp * 0.25],
    [cut + 0.3, topY(cut) + 1],
    [ridge, topY(ridge) + 0.5],
  ]);
  // Mørk glipe under den fremre kanten av ryggen, der panseret har løftet seg fra skjermen
  const gap = poly([
    [ridge + 1, topY(ridge) + 0.5],
    [cut + 0.3, topY(cut) + 1],
    [cut + 0.3, topY(cut) + 3.5],
    [ridge + 4, topY(ridge + 4) + 2.2],
  ]);
  // Lange, skrå bretter i skjermen fra ryggen ned mot hjulbuen
  const folds: [number, number][][] = [0, 1].map((i) => {
    const x = lerp(ridge - 4, cut - 2, i * 0.75);
    const y1 = topY(x) + 2.5;
    const len = Math.min(26, 8 + 0.4 * C) * (1 - 0.25 * i);
    return [
      [x, y1],
      [x + len * 0.35, y1 + len * 0.55],
      [x + len * 0.45, y1 + len],
    ];
  });
  return (
    <g>
      {folds.map((d, i) => (
        <g key={i} fill="none" strokeLinecap="round" strokeLinejoin="round">
          <path d={line(d)} stroke={shade(color, 0.42)} strokeWidth={sw * 1.8} />
          <path d={line(d.map(([x, y]) => [x - 1.4, y + 0.3]))} stroke={SCENE.highlight} strokeWidth={sw * 1.3} />
        </g>
      ))}
      <path d={gap} fill={shade(SCENE.rubberLight, 0.2)} />
      <path d={back} fill={tint(color, 0.2)} stroke={SCENE.outline} strokeWidth={sw} strokeLinejoin="round" />
      <path d={frontFace} fill={shade(color, 0.28)} stroke={SCENE.outline} strokeWidth={sw} strokeLinejoin="round" />
      <path d={`M${r2(xb0 + 2)},${r2(topY(xb0 + 2) - 0.6)}L${r2(ridge - 0.5)},${r2(yr + 1)}`} stroke={SCENE.highlight} strokeWidth={sw * 1.8} strokeLinecap="round" />
    </g>
  );
}

/** Biter av glass og plast på gulvet foran veggen (figurens koordinater). */
function Rusk({ G, C, sw }: { G: number; C: number; sw: number }) {
  const bits = useMemo(() => {
    const rnd = sceneRandom(41);
    return Array.from({ length: 9 }, (_, i) => ({
      x: WALL_X - 6 - rnd() * 70,
      dy: 1 + rnd() * 9,
      s: 1.6 + rnd() * 2.6,
      a: rnd() * 180,
      kind: i % 3,
      show: 6 + rnd() * 30,
    }));
  }, []);
  return (
    <g aria-hidden>
      {bits
        .filter((b) => C > b.show)
        .map((b, i) => (
          <path
            key={i}
            d={poly([
              [-b.s, -b.s * 0.4],
              [b.s * 0.7, -b.s * 0.6],
              [b.s, b.s * 0.3],
              [-b.s * 0.3, b.s * 0.5],
            ])}
            transform={`translate(${r2(b.x)} ${r2(G + b.dy)}) rotate(${r2(b.a)})`}
            fill={b.kind === 0 ? SCENE.glassEdge : b.kind === 1 ? SCENE.rubberLight : SCENE.metalLight}
            stroke={SCENE.outline}
            strokeWidth={sw * 0.6}
          />
        ))}
    </g>
  );
}

/* ================================================================================================
 * Kupeen: interiør, dukke, belte og kollisjonspute
 * ============================================================================================== */

/** Interiøret bak dukken (bilens enheter, klippet til åpningen). */
function Interior({ sw }: { sw: number }) {
  const id = useSvgId('kupe');
  const trim = mix(SCENE.rubberLight, SCENE.plasticShade, 0.28);
  const seat = mix(SCENE.rubberLight, SCENE.denim, 0.35);
  return (
    <g>
      <LinearGradient id={`${id}-rute`} stops={[[0, mix(SCENE.wall, SCENE.glass, 0.55)], [1, mix(SCENE.wall, SCENE.glass, 0.3)]]} />
      <LinearGradient id={`${id}-dor`} stops={materialStops(trim, 0.8)} />
      <LinearGradient id={`${id}-dash`} stops={[[0, tint(SCENE.rubberLight, 0.14)], [1, shade(SCENE.rubberLight, 0.2)]]} />
      <LinearGradient id={`${id}-sete`} x2={1} y2={0} stops={[[0, shade(seat, 0.15)], [1, tint(seat, 0.12)]]} />
      {/* Ruta på den andre siden (hallen bak), takhimlingen og dørpanelet på den andre siden */}
      <rect x={-40} y={-152} width={150} height={54} fill={`url(#${id}-rute)`} />
      <path d="M-40,-152H110V-139C60,-137 10,-138 -40,-138Z" fill={SCENE.plasticShade} />
      <rect x={-40} y={-100} width={150} height={72} fill={`url(#${id}-dor)`} />
      <path d="M-40,-99.5H110" stroke={shade(trim, 0.35)} strokeWidth={sw * 1.6} />
      <path d="M-30,-74C0,-75 30,-75 60,-73" fill="none" stroke={shade(trim, 0.25)} strokeWidth={sw * 2.4} strokeLinecap="round" opacity={0.6} />
      <rect x={-40} y={-35} width={150} height={6} fill={SCENE.rubber} />
      {/* Dashbordet med hanskerom og luke for kollisjonsputa */}
      <path
        d="M72,-98.5L41,-104.5C35,-105 32.5,-102 33,-97L35,-83C35.8,-77.5 39,-75.5 45,-75L70,-71L91,-57L96,-31H110V-110Z"
        fill={`url(#${id}-dash)`}
        stroke={SCENE.outline}
        strokeWidth={sw}
        strokeLinejoin="round"
      />
      <path d="M41,-103.4L70,-98.2" stroke={SCENE.highlight} strokeWidth={sw * 1.2} strokeLinecap="round" />
      <path d="M38,-92L60,-90L66,-80L44,-80.5Z" fill="none" stroke={shade(SCENE.rubberLight, 0.35)} strokeWidth={sw} strokeLinejoin="round" />
      <path d="M45,-103.4L60,-100.7" stroke={shade(SCENE.rubberLight, 0.5)} strokeWidth={sw * 1.1} strokeDasharray="2 1.4" />
      {/* Setet: hodestøtte, ryggen (lener 20° bakover bak dukken), setet og setefoten */}
      <rect x={-12} y={-37} width={34} height={3} fill={shade(SCENE.rubber, 0.1)} />
      <path d="M-20.5,-103L-22.5,-97.5" stroke={SCENE.metal} strokeWidth={sw * 2.4} strokeLinecap="round" />
      <rect x={-5} y={-7.5} width={10} height={15} rx={4} transform="translate(-25 -111) rotate(-20)" fill={`url(#${id}-sete)`} stroke={SCENE.outline} strokeWidth={sw} />
      <rect x={-5.5} y={-29} width={11} height={58} rx={4.5} transform="translate(-14.7 -74.2) rotate(-20)" fill={`url(#${id}-sete)`} stroke={SCENE.outline} strokeWidth={sw} />
      <path
        d="M-12,-37L-13,-44Q-12,-47.5 -8,-47.5L26,-48.5Q31,-48.5 31,-45L30,-40Q29.5,-37 26,-37Z"
        fill={`url(#${id}-sete)`}
        stroke={SCENE.outline}
        strokeWidth={sw}
        strokeLinejoin="round"
      />
      <path d="M-7,-46.4L26,-47.3" stroke={SCENE.highlight} strokeWidth={sw} strokeLinecap="round" />
    </g>
  );
}

/**
 * Kollisjonsputa (bilens enheter): blåses opp fra dashbordet og presses flat av dukken mot frontruta. `fill` er hvor
 * full den er (0–1), `rear` er hvor langt bak den kan bre seg før den møter dukken (x).
 */
function Kollisjonspute({ fill, rear, sw }: { fill: number; rear: number; sw: number }) {
  const id = useSvgId('pute');
  if (!(fill > 0.01)) return null;
  const front = 64;
  const module = 52;
  const fullRear = 2;
  const r = Math.min(front - 8, Math.max(lerp(module, fullRear, fill), rear));
  const rx = (front - r) / 2;
  const free = (front - fullRear) / 2;
  // Presses den sammen, buler den ut i høyden.
  const ry = 20 * fill * Math.min(1.4, Math.sqrt(free / Math.max(rx, 1)));
  const cx = (front + r) / 2;
  const cy = -111 + (1 - fill) * 8;
  return (
    <g>
      <LinearGradient
        id={id}
        x2={1}
        y2={0}
        stops={[
          [0, tint(SCENE.plastic, 0.4)],
          [0.5, SCENE.plastic],
          [1, SCENE.plasticShade],
        ]}
      />
      <ellipse cx={cx} cy={cy} rx={rx} ry={ry} fill={`url(#${id})`} stroke={SCENE.outline} strokeWidth={sw} />
      <path
        d={`M${r2(cx - rx * 0.55)},${r2(cy - ry * 0.5)}Q${r2(cx - rx * 0.2)},${r2(cy - ry * 0.05)} ${r2(cx - rx * 0.6)},${r2(cy + ry * 0.45)}M${r2(cx + rx * 0.1)},${r2(cy - ry * 0.8)}Q${r2(cx + rx * 0.35)},${r2(cy)} ${r2(cx + rx * 0.05)},${r2(cy + ry * 0.75)}`}
        fill="none"
        stroke={SCENE.plasticShade}
        strokeWidth={sw * 1.2}
        strokeLinecap="round"
      />
      <ellipse cx={cx - rx * 0.35} cy={cy - ry * 0.45} rx={rx * 0.25} ry={ry * 0.18} fill={SCENE.highlight} opacity={0.7} />
    </g>
  );
}

/* ================================================================================================
 * Hele scenen
 * ============================================================================================== */

export interface CrashSceneProps {
  r: CrashResult;
  /** Tiden etter treffet (s). */
  t: number;
  /** Tekstskaleringen viewBox-høyden er valgt for, og om figuren er beskåret (mobil). */
  f: number;
  crop: boolean;
}

/** Krasjhallen med veggen, bilen som presses sammen, dukken, fartspilene og målene. */
export function CrashScene({ r, t, f, crop }: CrashSceneProps) {
  const ss = useStrokeScale();
  const ids = useSvgId('krasj');
  const L = crashLayout(f, crop);
  const { G } = L;
  const spec = RESTRAINTS[r.restraint];
  const s = crashAt(r, t);
  const xc = s.car.x;
  const rel = Math.max(0, s.rel);
  /** Hvor mye fronten er presset sammen, i bilens enheter. */
  const C = (xc * 100) / CU;
  const Xa = ANCHOR0 + xc * PX_PER_M;
  const P = (p: Pt): Pt => ({ x: Xa + p.x * KC, y: G + p.y * KC });
  const P0 = (p: Pt): Pt => ({ x: ANCHOR0 + p.x * KC, y: G + p.y * KC });
  const progress = r.rel > 0 ? clamp(rel / r.rel, 0, 1) : 0;
  const pose = useMemo(() => dummyPose(rel, progress, spec.kind), [rel, progress, spec.kind]);
  const seat = P({ x: SEAT_ANCHOR.x + pose.hip / CU, y: SEAT_ANCHOR.y });
  const fest = { venstreFot: P(FEET.venstreFot), hoyreFot: P(FEET.hoyreFot) };
  const pp = personPunkter('sitte', DUMMY_CM * PXR, pose.ledd, { x: seat.x, y: seat.y, fest });
  const head0 = useMemo(
    () => personPunkter('sitte', DUMMY_CM * PXR, dummyLedd(RYGG0, 0, spec.kind), { x: ANCHOR0 + SEAT_ANCHOR.x * KC, y: G + SEAT_ANCHOR.y * KC }).hode,
    [G, spec.kind],
  );

  const lakk = PAINTS.hvit;
  const wallCar = FRONT - C;
  const cut = wallCar - crumpleWidth(C);
  const clipCar = `${ids}-bil`;
  const clipCabin = `${ids}-kupe`;
  const sw = (0.9 * ss) / KC;
  const wheel = P({ x: BIL_MAAL.akselavstand * 50, y: -BIL_MAAL.hjulradius * 100 });
  const airbag = r.restraint === 'pute' ? airbagFill(t) : 0;
  /** Hvor langt fram dukken når (bilens enheter): fronten av hodet eller brystet. */
  const front = Math.max((pp.hode.x - Xa + 11 * PXR) / KC, (pp.skulder.x - Xa + 14 * PXR) / KC);
  const cabinTransform = `translate(${r2(Xa)} ${G}) scale(${r2(KC)})`;

  // Beltet: fra B-stolpen til skulderen, på skrå over brystet til låsen ved hofta, og hoftebeltet over hofta.
  const belt = r.restraint !== 'ingen';
  const ux = pp.nakke.x - pp.hofte.x;
  const uy = pp.nakke.y - pp.hofte.y;
  const ul = Math.hypot(ux, uy) || 1;
  const up = { x: ux / ul, y: uy / ul };
  const fwd = { x: -up.y, y: up.x };
  /** Punkt langs overkroppen (a cm opp, b cm fram) fra o. */
  const along = (o: Pt, a: number, b: number): Pt => ({ x: o.x + (up.x * a + fwd.x * b) * PXR, y: o.y + (up.y * a + fwd.y * b) * PXR });
  const sh = along(pp.skulder, 6, -2);
  const buckle = along(pp.hofte, 3, 9);
  const lap0 = along(pp.hofte, 1, -12);
  const anchor = P(BELT_TOP);
  const pt = (p: Pt) => `${r2(p.x)},${r2(p.y)}`;
  const beltPath = `M${pt(anchor)}L${pt(sh)}L${pt(buckle)}M${pt(lap0)}L${pt(buckle)}`;

  // Fartspilene
  const vCarLen = s.car.v * PX_PER_MS;
  const vPassLen = s.passenger.v * PX_PER_MS;
  const carArrow = P({ x: 84, y: -118 });
  const headNow = { x: head0.x + s.passenger.x * PX_PER_M, y: pp.hode.y };
  const ghostHead = { x: head0.x + xc * PX_PER_M, y: head0.y };
  const mark0 = P0(CAR_MARK);
  const mark = P(CAR_MARK);

  return (
    <g>
      <Rom x={0} y={0} w={W} h={L.H} gulvY={G - 44} gulv="betong" />
      <defs>
        <clipPath id={clipCar}>
          <rect x={-50} y={-50} width={Math.max(0, Xa + cut * KC + 50)} height={L.H + 100} />
          <rect x={Xa + cut * KC - 1} y={G - 7 * KC} width={Math.max(0, (wallCar - cut) * KC + 2)} height={40} />
          <circle cx={wheel.x} cy={wheel.y} r={(BIL_MAAL.hjulradius * 100 + 0.6) * KC} />
        </clipPath>
        <clipPath id={clipCabin}>
          <path d={CABIN} transform={cabinTransform} />
        </clipPath>
      </defs>
      {/* Bilen: den knuste fronten bak, bilen klippet ved kuttet, bulkene oppå */}
      <Place x={Xa} y={G} scale={KC}>
        <KnustFront C={C} color={lakk} sw={sw} />
      </Place>
      <g clipPath={`url(#${clipCar})`}>
        <Bil x={Xa} y={G} size={CAR_M * PX_PER_M} lakk={lakk} type="stasjonsvogn" hjulvinkel={hjulvinkelFraStrekning(xc, BIL_MAAL.hjulradius * CU)} />
      </g>
      <Place x={Xa} y={G} scale={KC}>
        <Bulker C={C} color={lakk} sw={sw} />
      </Place>
      <Rusk G={G} C={C} sw={sw * KC} />
      <Maalemerke x={mark.x} y={mark.y} r={6 * KC} />
      {!crop && <Maalemerke x={P({ x: -176, y: -64 }).x} y={P({ x: -176, y: -64 }).y} r={5 * KC} />}
      {/* Kupeen med døra og A-stolpen skåret bort */}
      <g clipPath={`url(#${clipCabin})`}>
        <Place x={Xa} y={G} scale={KC}>
          <Interior sw={sw} />
          <Kollisjonspute fill={airbag} rear={front - 1} sw={sw} />
        </Place>
        {rel > 0.04 && <Maalemerke x={ghostHead.x} y={ghostHead.y} r={10 * PXR} ghost />}
        <Person
          x={seat.x}
          y={seat.y}
          size={DUMMY_CM * PXR}
          pose="sitte"
          ledd={pose.ledd}
          fest={fest}
          hud={DUMMY_SKIN}
          har={DUMMY_SKIN}
          jakke={PAINTS.gul}
          bukse={DUMMY_SUIT}
          sko="svart"
        />
        <Maalemerke x={pp.hode.x - 1.5 * PXR} y={pp.hode.y - 1 * PXR} r={3.6 * PXR} />
        {belt && (
          <g fill="none" strokeLinecap="round" strokeLinejoin="round">
            <path d={beltPath} stroke={SCENE.outline} strokeWidth={5.4 * PXR} />
            <path d={beltPath} stroke={SCENE.rubberLight} strokeWidth={4.3 * PXR} />
            <path d={beltPath} stroke={SCENE.highlight} strokeWidth={0.8 * PXR} opacity={0.45} />
            <rect x={buckle.x - 3 * PXR} y={buckle.y - 2 * PXR} width={6 * PXR} height={4 * PXR} rx={1 * PXR} fill={SCENE.metal} stroke={SCENE.outline} strokeWidth={0.8 * ss} />
          </g>
        )}
      </g>
      {/* Snittkantene: frontruta og kanten rundt åpningen */}
      <path d={CABIN} transform={cabinTransform} fill="none" stroke={shade(lakk, 0.35)} strokeWidth={2.2 * ss} strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
      <path d={WINDSHIELD} transform={cabinTransform} fill="none" stroke={SCENE.glassEdge} strokeWidth={3 * ss} strokeLinecap="round" vectorEffect="non-scaling-stroke" opacity={0.9} />
      <Krasjvegg x={WALL_X} y={G} h={1.8 * PX_PER_M} />

      {/* Fysikken oppå: fartspilene, strekningene og knusesonen */}
      <ForceArrow
        x1={carArrow.x}
        y1={carArrow.y}
        x2={carArrow.x + vCarLen}
        y2={carArrow.y}
        color={VIZ.velocity}
        minLength={4}
        label={
          <>
            v<TSub>bil</TSub>
          </>
        }
        labelX={carArrow.x + 2}
        labelY={carArrow.y - 12 * f}
        labelAnchor="start"
      />
      <ForceArrow
        x1={headNow.x}
        y1={L.vArrowY}
        x2={headNow.x + vPassLen}
        y2={L.vArrowY}
        color={VIZ.velocity}
        minLength={4}
        label={
          <>
            v<TSub>passasjer</TSub>
          </>
        }
        labelX={headNow.x - 10}
        labelY={L.vArrowY + 6 * f}
        labelAnchor="end"
      />
      <PassengerDistance r={r} x0={head0.x} xGhost={ghostHead.x} xNow={headNow.x} y={L.dimY} roofY={L.roofY} f={f} />
      {xc > 0.005 && (
        <g>
          <Maalemerke x={mark0.x} y={mark0.y} r={6 * KC} ghost />
          <line x1={mark0.x} y1={mark0.y + 9} x2={mark0.x} y2={L.carDimY + 6} stroke={VIZ.ink} strokeWidth={1 * ss} strokeDasharray="3 3" opacity={0.5} />
          <line x1={mark.x} y1={mark.y + 9} x2={mark.x} y2={L.carDimY + 6} stroke={VIZ.ink} strokeWidth={1 * ss} strokeDasharray="3 3" opacity={0.5} />
          <Dimension x1={mark0.x} y1={L.carDimY} x2={mark.x} y2={L.carDimY} label={`d = ${fmt(xc, 2)} m`} color={VIZ.ink} labelSize={0.85} />
        </g>
      )}
      <Callout x={P({ x: C > 1 ? (cut + wallCar) / 2 : 205, y: -50 }).x} y={G - 50 * KC} lx={WALL_X - 8} ly={L.carDimY + 4} anchor="end">
        {r.d <= 0.2 ? 'Stiv front' : 'Knusesone'}
      </Callout>
    </g>
  );
}

/**
 * Mål over bilen: hvor langt hodet til passasjeren har flyttet seg siden treffet. Med belte bremses passasjeren hele
 * veien, og strekningen er knusesonen d (bilen flytter seg) pluss Δx (passasjeren glir fram i bilen). Uten belte er
 * det først en strekning uten bremsing (stiplet) og så en kort strekning der hen bremses.
 */
function PassengerDistance({ r, x0, xGhost, xNow, y, roofY, f }: { r: CrashResult; x0: number; xGhost: number; xNow: number; y: number; roofY: number; f: number }) {
  const ss = useStrokeScale();
  const moved = (xNow - x0) / PX_PER_M;
  if (!(moved > 0.005)) return null;
  const guide = (x: number) => <line x1={x} y1={y + 6} x2={x} y2={roofY - 4} stroke={VIZ.ink} strokeWidth={1 * ss} strokeDasharray="3 3" opacity={0.45} />;
  const fits = (a: number, b: number, chars: number) => Math.abs(b - a) > chars * 17 * 0.8 * f * 0.56 + 6;
  if (r.restraint !== 'ingen') {
    return (
      <g>
        {guide(x0)}
        {guide(xNow)}
        <Dimension x1={x0} y1={y} x2={xNow} y2={y} label={`bremses over ${fmt(moved, 2)} m`} color={VIZ.ink} labelSize={0.85} />
        {xGhost > x0 + 2 && xGhost < xNow - 2 && (
          <>
            {guide(xGhost)}
            <line x1={xGhost} y1={y - 6} x2={xGhost} y2={y + 6} stroke={VIZ.ink} strokeWidth={1.4 * ss} />
          </>
        )}
        {fits(x0, xGhost, 1) && (
          <Txt x={(x0 + xGhost) / 2} y={y + 19 * f} size={0.8} muted>
            d
          </Txt>
        )}
        {fits(xGhost, xNow, 2) && (
          <Txt x={(xGhost + xNow) / 2} y={y + 19 * f} size={0.8} muted>
            Δx
          </Txt>
        )}
      </g>
    );
  }
  const xHit = x0 + r.sFree * PX_PER_M;
  const freeEnd = Math.min(xNow, xHit);
  const braking = xNow > xHit + 0.5;
  return (
    <g>
      {guide(x0)}
      {guide(xNow)}
      <line x1={x0} y1={y} x2={freeEnd} y2={y} stroke={VIZ.muted} strokeWidth={1.6 * ss} strokeDasharray="6 4" />
      <line x1={x0} y1={y - 6} x2={x0} y2={y + 6} stroke={VIZ.muted} strokeWidth={1.4 * ss} />
      <Txt x={(x0 + freeEnd) / 2} y={y - 9 * f} size={0.85} muted weight={600}>
        uten bremsing {fmt((freeEnd - x0) / PX_PER_M, 2)} m
      </Txt>
      {braking && (
        <>
          <line x1={xHit} y1={y - 7} x2={xHit} y2={y + 7} stroke={VIZ.ink} strokeWidth={1.4 * ss} />
          <line x1={xNow} y1={y - 7} x2={xNow} y2={y + 7} stroke={VIZ.ink} strokeWidth={1.4 * ss} />
          <line x1={xHit} y1={y} x2={xNow} y2={y} stroke={VIZ.ink} strokeWidth={2.6 * ss} />
          <Txt x={xNow + 8} y={y + 22 * f} anchor="start" size={0.85} weight={650}>
            bremses over {fmt((xNow - xHit) / PX_PER_M, 2)} m
          </Txt>
        </>
      )}
    </g>
  );
}
