/**
 * Egne gjenstander til kraftparscenen (k2-kraftpar, 2D) som scene-kit-et ikke har: en lærebok sett fra snittkanten
 * (sidene mellom to permer), en hånd som presser flatt ned på noe (underarm med genserermet) og et snitt av grunnen
 * under huset (gulvbord, betongplate, pukk, jord og berg). Samme stil som scene-kit-et: toninger fra core,
 * SCENE-farger, tynn kontur og myke skygger. Alle mål er i figurens enheter.
 */
import { memo, useMemo } from 'react';
import {
  ContactShadow,
  LinearGradient,
  PAINTS,
  SCENE,
  SCENE_DIM,
  materialStops,
  mix,
  paint,
  sceneRandom,
  shade,
  tint,
  useStrokeScale,
  useSvgId,
  type PaintName,
} from '../../kit/scene';

type Pt = [number, number];
const r1 = (v: number) => (Number.isFinite(v) ? Math.round(v * 10) / 10 : 0);
const p = ([x, y]: Pt) => `${r1(x)},${r1(y)}`;
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/* ---------------------------------------------------------------- Bok */

/**
 * Lærebok som ligger flatt, sett fra snittkanten: sidene (lyse, med tynne linjer) mellom to permer som stikker litt
 * ut, og et bokmerkebånd som henger ut i den høyre enden. Ankerpunkt: (x, y) midt på undersiden, der boka ligger
 * på bordet; boka går fra y − t til y.
 *   <Bok x={400} y={bordplate} w={125} t={17} perm="rod" />
 */
export function Bok({ x, y, w, t, perm = 'rod', dim }: { x: number; y: number; w: number; t: number; perm?: PaintName | string; dim?: boolean }) {
  const ss = useStrokeScale();
  const id = useSvgId('kp-bok');
  if (!(w > 6) || !(t > 0.5) || !Number.isFinite(x) || !Number.isFinite(y)) return null;
  const c = paint(perm);
  const cover = Math.min(t * 0.3, clamp(t * 0.12, 1.6, 3.2));
  const over = Math.min(2.4, w * 0.02);
  const L = x - w / 2;
  const R = x + w / 2;
  const T = y - t;
  const pL = L + over;
  const pR = R - over;
  const pT = T + cover;
  const pB = y - cover;
  const ph = pB - pT;
  const paper = mix(PAINTS.hvit, SCENE.woodLight, 0.22);
  // Tynne linjer mellom arkene (ca. hver 2,6. enhet), svakere jo tettere de ligger.
  let lines = '';
  const n = Math.floor(ph / 2.6);
  for (let i = 1; i < n; i++) {
    const yy = pT + (ph * i) / n;
    lines += `M${r1(pL + 0.6)},${r1(yy)}H${r1(pR - 0.6)}`;
  }
  const rib = Math.max(1.6, w * 0.014);
  return (
    <g opacity={dim ? SCENE_DIM : undefined}>
      <ContactShadow cx={x} cy={y} rx={w * 0.56} ry={Math.max(2.5, w * 0.03)} />
      <LinearGradient
        id={`${id}p`}
        stops={[
          [0, tint(paper, 0.18)],
          [1, shade(paper, 0.14)],
        ]}
      />
      <LinearGradient id={`${id}c`} stops={materialStops(c, 1.1)} />
      <LinearGradient
        id={`${id}s`}
        x2={1}
        y2={0}
        stops={[
          [0, SCENE.highlight, 0.5],
          [0.18, SCENE.highlight, 0],
          [0.82, SCENE.shadow, 0],
          [1, SCENE.shadow, 0.45],
        ]}
      />
      {/* Bokmerkebåndet henger ut av sidene og ligger på bordet */}
      <path
        d={`M${p([R - w * 0.12, pB - ph * 0.3])}Q${p([R + 2, pB])} ${p([R + w * 0.06, y - 0.6])}`}
        fill="none"
        stroke={shade(PAINTS.gul, 0.08)}
        strokeWidth={rib}
        strokeLinecap="round"
      />
      <rect x={pL} y={pT - 0.4} width={pR - pL} height={ph + 0.8} fill={`url(#${id}p)`} />
      {lines && <path d={lines} fill="none" stroke={shade(paper, 0.3)} strokeWidth={0.55 * ss} opacity={0.55} />}
      <rect x={L} y={T} width={w} height={cover} rx={Math.min(1.2, cover * 0.4)} fill={`url(#${id}c)`} />
      <rect x={L} y={pB} width={w} height={cover} rx={Math.min(1.2, cover * 0.4)} fill={`url(#${id}c)`} />
      <rect x={L} y={T} width={w} height={t} fill={`url(#${id}s)`} />
      <rect x={L} y={T} width={w} height={t} rx={Math.min(1.4, t * 0.15)} fill="none" stroke={SCENE.outline} strokeWidth={0.9 * ss} />
      <line x1={L + 1.5} y1={T + 0.7 * ss} x2={R - 1.5} y2={T + 0.7 * ss} stroke={SCENE.highlight} strokeWidth={1.1 * ss} strokeLinecap="round" />
    </g>
  );
}

/* ---------------------------------------------------------------- Hand */

export interface HandProps {
  /** Hælen på håndflata, på flaten hånda presser mot (ankerpunktet). Fingrene peker mot venstre. */
  x: number;
  y: number;
  /** Skalaen i figuren (enheter per meter). En voksen hånd er ca. 19 cm lang. */
  k: number;
  /** Øvre kant av figuren: armen fortsetter ut av bildet over denne. */
  top: number;
  /** Hvor mye underarmen heller mot høyre oppover (grader fra loddrett). */
  vinkel?: number;
  /** Hånda løftes så mye (figurens enheter) over flaten, f.eks. når den ikke presser. */
  loft?: number;
  /** Farge på genseren. */
  genser?: PaintName | string;
  dim?: boolean;
}

/**
 * Høyre hånd som presser flatt ned på noe, sett fra tommelsiden: håndflata ligger på flaten med fingrene mot venstre,
 * håndleddet er bøyd bakover og underarmen går opp og ut av bildet, med genserermet og vrangbord. Lyset kommer fra
 * øvre venstre.
 *   <Hand x={452} y={bokTopp} k={480} top={0} />
 */
export function Hand({ x, y, k, top, vinkel = 14, loft = 0, genser = 'gul', dim }: HandProps) {
  const ss = useStrokeScale();
  const id = useSvgId('kp-hand');
  if (!(k > 0) || !Number.isFinite(x) || !Number.isFinite(y)) return null;
  const y0 = y - Math.max(0, loft);
  const P = (mx: number, my: number): Pt => [x + mx * k, y0 + my * k];
  const th = (vinkel * Math.PI) / 180;
  const u: Pt = [Math.sin(th), -Math.cos(th)];
  const nrm: Pt = [Math.cos(th), Math.sin(th)];
  const wl: Pt = [-0.018, -0.046];
  const wr: Pt = [0.036, -0.026];
  const widen = (s: number) => 0.0055 * clamp(s / 0.1, 0, 1);
  const edge = (side: -1 | 1, s: number, extra = 0): Pt => {
    const b = side < 0 ? wl : wr;
    const d = (widen(s) + extra) * side;
    return P(b[0] + s * u[0] + d * nrm[0], b[1] + s * u[1] + d * nrm[1]);
  };
  // Hvor langt armen må gå (meter langs underarmen) for å nå ut av bildet.
  const sEnd = Math.max(0.25, (y0 - top) / (k * Math.cos(th)) + 0.08);
  const s0 = Math.min(0.12, sEnd * 0.6);
  const sSkin = s0 + 0.02;
  const steps = [0.03, 0.06, 0.09, sSkin];

  const skin = SCENE.skin;
  const cloth = paint(genser);
  const skinPath =
    `M${p(P(-0.176, 0))}L${p(P(0.016, 0))}Q${p(P(0.036, 0))} ${p(P(0.036, -0.02))}L${p(edge(1, 0))}` +
    steps.map((s) => `L${p(edge(1, s))}`).join('') +
    `L${p(edge(-1, sSkin))}` +
    steps
      .slice(0, -1)
      .reverse()
      .map((s) => `L${p(edge(-1, s))}`)
      .join('') +
    `L${p(edge(-1, 0))}` +
    `C${p(P(-0.036, -0.045))} ${p(P(-0.066, -0.035))} ${p(P(-0.094, -0.028))}` +
    `C${p(P(-0.12, -0.022))} ${p(P(-0.15, -0.019))} ${p(P(-0.172, -0.0145))}` +
    `Q${p(P(-0.188, -0.012))} ${p(P(-0.187, -0.005))}Q${p(P(-0.186, 0))} ${p(P(-0.176, 0))}Z`;
  // Tommelen ligger langs siden av håndflata, med en negl ytterst.
  const thumbA = P(-0.014, -0.017);
  const thumbB = P(-0.086, -0.0105);
  const tr = 0.0085 * k;
  const tdx = thumbB[0] - thumbA[0];
  const tdy = thumbB[1] - thumbA[1];
  const tl = Math.hypot(tdx, tdy);
  const tn: Pt = [(-tdy / tl) * tr, (tdx / tl) * tr];
  const thumb = `M${p([thumbA[0] + tn[0], thumbA[1] + tn[1]])}L${p([thumbB[0] + tn[0] * 0.8, thumbB[1] + tn[1] * 0.8])}A${r1(tr * 0.8)},${r1(tr * 0.8)} 0 0 0 ${p([thumbB[0] - tn[0] * 0.8, thumbB[1] - tn[1] * 0.8])}L${p([thumbA[0] - tn[0], thumbA[1] - tn[1]])}Z`;
  const nail = P(-0.079, -0.0135);
  const tipNail = P(-0.174, -0.0128);

  const sleeve = (() => {
    const pts: Pt[] = [];
    const ss2 = [s0, s0 + 0.04, s0 + 0.1, sEnd];
    for (const s of ss2) pts.push(edge(1, s, 0.011));
    for (const s of ss2.slice().reverse()) pts.push(edge(-1, s, 0.011));
    return `M${pts.map(p).join('L')}Z`;
  })();
  const cuffEnd = s0 + 0.035;
  const cuff = `M${p(edge(1, s0, 0.012))}L${p(edge(1, cuffEnd, 0.011))}L${p(edge(-1, cuffEnd, 0.011))}L${p(edge(-1, s0, 0.012))}Z`;
  // Vrangbord: tynne streker langs armen i mansjetten.
  let rib = '';
  for (let i = 1; i < 9; i++) {
    const tt = i / 9;
    const a = mixPt(edge(-1, s0, 0.012), edge(1, s0, 0.012), tt);
    const b = mixPt(edge(-1, cuffEnd, 0.011), edge(1, cuffEnd, 0.011), tt);
    rib += `M${p(a)}L${p(b)}`;
  }
  // Fold i ermet og en skygge på huden under mansjetten.
  const fold = `M${p(mixPt(edge(-1, s0 + 0.09, 0.011), edge(1, s0 + 0.09, 0.011), 0.15))}Q${p(mixPt(edge(-1, s0 + 0.075, 0.011), edge(1, s0 + 0.075, 0.011), 0.5))} ${p(mixPt(edge(-1, s0 + 0.085, 0.011), edge(1, s0 + 0.085, 0.011), 0.85))}`;

  return (
    <g opacity={dim ? SCENE_DIM : undefined} aria-hidden>
      <LinearGradient
        id={`${id}h`}
        x2={1}
        y2={0}
        stops={[
          [0, tint(skin, 0.16)],
          [0.55, skin],
          [1, shade(skin, 0.14)],
        ]}
      />
      <LinearGradient
        id={`${id}g`}
        x2={1}
        y2={0}
        stops={[
          [0, tint(cloth, 0.2)],
          [0.5, cloth],
          [1, shade(cloth, 0.22)],
        ]}
      />
      {loft > 0.5 && <ContactShadow cx={x - 0.08 * k} cy={y} rx={0.09 * k} ry={Math.max(2, 0.008 * k)} opacity={0.6} />}
      <path d={skinPath} fill={`url(#${id}h)`} stroke={SCENE.outline} strokeWidth={0.9 * ss} strokeLinejoin="round" />
      {/* Knoker og ledd: svake streker over fingrene */}
      <path
        d={`M${p(P(-0.098, -0.027))}q${r1(0.004 * k)},${r1(0.006 * k)} ${r1(0.002 * k)},${r1(0.012 * k)}M${p(P(-0.138, -0.0195))}q${r1(0.003 * k)},${r1(0.004 * k)} ${r1(0.001 * k)},${r1(0.009 * k)}`}
        fill="none"
        stroke={SCENE.skinShade}
        strokeWidth={0.8 * ss}
        strokeLinecap="round"
        opacity={0.8}
      />
      <ellipse cx={tipNail[0]} cy={tipNail[1]} rx={0.007 * k} ry={0.0022 * k} fill={tint(skin, 0.4)} stroke={SCENE.skinShade} strokeWidth={0.5 * ss} />
      <path d={thumb} fill={shade(skin, 0.05)} stroke={SCENE.outline} strokeWidth={0.75 * ss} strokeLinejoin="round" />
      <ellipse cx={nail[0]} cy={nail[1]} rx={0.0065 * k} ry={0.0024 * k} fill={tint(skin, 0.4)} stroke={SCENE.skinShade} strokeWidth={0.5 * ss} />
      <path
        d={`M${p(P(-0.04, -0.04))}Q${p(P(-0.07, -0.034))} ${p(P(-0.1, -0.026))}`}
        fill="none"
        stroke={SCENE.highlight}
        strokeWidth={1.2 * ss}
        strokeLinecap="round"
      />
      {/* Genserermet */}
      <path d={sleeve} fill={`url(#${id}g)`} stroke={SCENE.outline} strokeWidth={0.9 * ss} strokeLinejoin="round" />
      <path d={fold} fill="none" stroke={shade(cloth, 0.3)} strokeWidth={0.9 * ss} strokeLinecap="round" opacity={0.7} />
      <path d={cuff} fill={shade(cloth, 0.08)} stroke={SCENE.outline} strokeWidth={0.8 * ss} strokeLinejoin="round" />
      <path d={rib} fill="none" stroke={shade(cloth, 0.3)} strokeWidth={0.6 * ss} opacity={0.6} />
    </g>
  );
}

function mixPt(a: Pt, b: Pt, t: number): Pt {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
}

/* ---------------------------------------------------------------- Grunnsnitt */

/**
 * Snitt av grunnen under et hus, rett under gulvet i et <Rom>: gulvbord, betongplate, pukk, jord med stein og berg
 * nederst. Ikke i målestokk (lagene er tegnet tynnere enn de er), men viser at huset står på jorda.
 * Ankerpunkt: (x, y) er øverste venstre hjørne (forkanten av gulvet), og snittet fyller w × h.
 *   <Rom x={0} y={0} w={800} h={420} gulvY={345} gulv="tre" />
 *   <Grunnsnitt x={0} y={420} w={800} h={100} />
 */
export const Grunnsnitt = memo(function Grunnsnitt({ x, y, w, h, seed = 3 }: { x: number; y: number; w: number; h: number; seed?: number }) {
  const ss = useStrokeScale();
  const id = useSvgId('kp-grunn');
  const geo = useMemo(() => {
    const rand = sceneRandom(seed * 7919 + Math.round(w) * 31 + Math.round(h));
    const board = clamp(h * 0.07, 4, 8);
    const slab = clamp(h * 0.13, 6, 16);
    const gravel = clamp(h * 0.11, 5, 14);
    const yB = y + board;
    const yS = yB + slab;
    const yG = yS + gravel;
    // Skjøter i gulvbordene
    let joints = '';
    for (let jx = x + 40 + rand() * 80; jx < x + w; jx += 110 + rand() * 90) joints += `M${r1(jx)},${r1(y + 0.6)}V${r1(yB - 0.6)}`;
    // Tilslag i betongen: små prikker
    let aggregate = '';
    for (let i = 0; i < w / 9; i++) {
      const ax = x + rand() * w;
      const ay = yB + 2 + rand() * (slab - 4);
      const ar = 0.6 + rand() * 0.9;
      aggregate += `M${r1(ax - ar)},${r1(ay)}a${r1(ar)},${r1(ar)} 0 1,0 ${r1(2 * ar)},0a${r1(ar)},${r1(ar)} 0 1,0 ${r1(-2 * ar)},0Z`;
    }
    // Pukk: tett med kantete steiner
    let pebbles = '';
    for (let i = 0; i < w / 6; i++) {
      const cx = x + rand() * w;
      const cy = yS + 1.5 + rand() * (gravel - 3);
      const rr = 1.4 + rand() * 2;
      const a = rand() * Math.PI;
      const pts: Pt[] = [0, 1, 2, 3, 4].map((j) => {
        const ang = a + (j * 2 * Math.PI) / 5 + (rand() - 0.5) * 0.6;
        const rad = rr * (0.75 + rand() * 0.4);
        return [cx + Math.cos(ang) * rad, cy + Math.sin(ang) * rad * 0.8];
      });
      pebbles += `M${pts.map(p).join('L')}Z`;
    }
    // Berget nederst: ujevn overkant
    const rockBase = y + h - clamp(h * 0.24, 14, 34);
    const rock: Pt[] = [];
    const nR = Math.max(6, Math.round(w / 55));
    for (let i = 0; i <= nR; i++) rock.push([x + (w * i) / nR, rockBase - rand() * h * 0.12 + (i % 3 === 1 ? h * 0.05 : 0)]);
    let rockPath = `M${r1(x)},${r1(y + h + 1)}L${p(rock[0]!)}`;
    for (let i = 1; i < rock.length; i++) {
      const a = rock[i - 1]!;
      const b = rock[i]!;
      rockPath += `Q${p(a)} ${p([(a[0] + b[0]) / 2, (a[1] + b[1]) / 2])}`;
    }
    rockPath += `L${p(rock[rock.length - 1]!)}L${r1(x + w)},${r1(y + h + 1)}Z`;
    // Sprekker i berget
    let cracks = '';
    for (let i = 0; i < w / 120; i++) {
      const cx = x + rand() * w;
      const cy = rockBase + 4 + rand() * (y + h - rockBase - 6);
      cracks += `M${r1(cx)},${r1(cy)}l${r1(6 + rand() * 10)},${r1(-2 + rand() * 5)}l${r1(5 + rand() * 9)},${r1(rand() * 4)}`;
    }
    // Stein i jorda: noen få, avrundede
    const stones: { cx: number; cy: number; rx: number; ry: number }[] = [];
    for (let i = 0; i < w / 95; i++) {
      const rx = 3 + rand() * 6;
      stones.push({ cx: x + rand() * w, cy: yG + 6 + rand() * Math.max(4, rockBase - yG - 14), rx, ry: rx * (0.55 + rand() * 0.25) });
    }
    // Små røtter og korn i jorda
    let grains = '';
    for (let i = 0; i < w / 7; i++) {
      const gx = x + rand() * w;
      const gy = yG + 2 + rand() * Math.max(2, rockBase - yG);
      grains += `M${r1(gx)},${r1(gy)}h${r1(0.8 + rand() * 1.4)}`;
    }
    return { yB, yS, yG, joints, aggregate, pebbles, rockPath, cracks, stones, grains, rockBase };
  }, [x, y, w, h, seed]);
  if (!(w > 0) || !(h > 10)) return null;
  const { yB, yS, yG } = geo;
  return (
    <g aria-hidden>
      <LinearGradient id={`${id}j`} userSpace x1={0} y1={yG} x2={0} y2={y + h} stops={[[0, SCENE.soil], [1, shade(SCENE.soilDark, 0.15)]]} />
      <LinearGradient id={`${id}b`} userSpace x1={0} y1={yB} x2={0} y2={yS} stops={materialStops(SCENE.concrete, 0.8)} />
      <LinearGradient id={`${id}f`} userSpace x1={0} y1={y} x2={0} y2={yB} stops={materialStops(shade(SCENE.floor, 0.06), 1)} />
      <LinearGradient id={`${id}r`} userSpace x1={0} y1={geo.rockBase - h * 0.12} x2={0} y2={y + h} stops={materialStops(SCENE.stone, 1)} />
      {/* Jord, med korn og stein */}
      <rect x={x} y={yG} width={w} height={y + h - yG} fill={`url(#${id}j)`} />
      <path d={geo.grains} stroke={SCENE.soilDark} strokeWidth={1.1 * ss} strokeLinecap="round" opacity={0.7} />
      {geo.stones.map((s, i) => (
        <ellipse key={i} cx={s.cx} cy={s.cy} rx={s.rx} ry={s.ry} fill={mix(SCENE.stone, SCENE.soil, 0.25)} stroke={SCENE.outline} strokeWidth={0.6 * ss} opacity={0.9} />
      ))}
      {/* Berg */}
      <path d={geo.rockPath} fill={`url(#${id}r)`} stroke={SCENE.outline} strokeWidth={0.7 * ss} />
      <path d={geo.cracks} fill="none" stroke={SCENE.stoneDark} strokeWidth={0.9 * ss} strokeLinecap="round" opacity={0.8} />
      {/* Pukk */}
      <rect x={x} y={yS} width={w} height={yG - yS} fill={SCENE.gravel} />
      <path d={geo.pebbles} fill={SCENE.gravelDark} stroke={shade(SCENE.gravelDark, 0.25)} strokeWidth={0.4 * ss} opacity={0.85} />
      <line x1={x} x2={x + w} y1={yG} y2={yG} stroke={SCENE.outline} strokeWidth={0.6 * ss} opacity={0.5} />
      {/* Betongplate */}
      <rect x={x} y={yB} width={w} height={yS - yB} fill={`url(#${id}b)`} />
      <path d={geo.aggregate} fill={SCENE.concreteDark} opacity={0.6} />
      <line x1={x} x2={x + w} y1={yS} y2={yS} stroke={SCENE.outline} strokeWidth={0.7 * ss} opacity={0.6} />
      {/* Gulvbordene (forkanten av gulvet) */}
      <rect x={x} y={y} width={w} height={yB - y} fill={`url(#${id}f)`} />
      <path d={geo.joints} stroke={SCENE.floorDark} strokeWidth={0.8 * ss} />
      <line x1={x} x2={x + w} y1={yB} y2={yB} stroke={SCENE.outline} strokeWidth={0.7 * ss} opacity={0.6} />
      <line x1={x} x2={x + w} y1={y} y2={y} stroke={SCENE.outline} strokeWidth={0.9 * ss} />
    </g>
  );
});
