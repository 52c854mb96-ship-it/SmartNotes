/**
 * Egne gjenstander til kraftparscenen (k2-kraftpar, 2D) som scene-kit-et ikke har: en lærebok sett fra snittkanten
 * (sidene mellom to permer), en hånd som presser flatt ned på noe (underarm med genserermet), nedre del av et vindu,
 * en vegghylle med bøker, en blyant og et snitt gjennom gulvet og grunnen ned til jordas sentrum. Samme stil som
 * scene-kit-et: toninger fra core, SCENE-farger, tynn kontur og myke skygger. Alle mål er i figurens enheter.
 */
import { useMemo } from 'react';
import {
  ContactShadow,
  LinearGradient,
  PAINTS,
  RadialGradient,
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
import { VIZ } from '../../kit';

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
  const wl: Pt = [-0.022, -0.052];
  const wr: Pt = [0.036, -0.028];
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
    `M${p(P(-0.088, 0))}L${p(P(0.016, 0))}Q${p(P(0.036, 0))} ${p(P(0.036, -0.02))}L${p(edge(1, 0))}` +
    steps.map((s) => `L${p(edge(1, s))}`).join('') +
    `L${p(edge(-1, sSkin))}` +
    steps
      .slice(0, -1)
      .reverse()
      .map((s) => `L${p(edge(-1, s))}`)
      .join('') +
    `L${p(edge(-1, 0))}` +
    // Håndryggen ned til knokene, og pekefingeren som bøyer seg svakt ned mot flaten (avslappet hånd som presser
    // med håndflata), så det blir en liten glipe under fingeren.
    `C${p(P(-0.042, -0.051))} ${p(P(-0.07, -0.045))} ${p(P(-0.097, -0.037))}` +
    `C${p(P(-0.122, -0.033))} ${p(P(-0.14, -0.031))} ${p(P(-0.153, -0.025))}` +
    `C${p(P(-0.167, -0.018))} ${p(P(-0.177, -0.012))} ${p(P(-0.182, -0.006))}` +
    `Q${p(P(-0.185, 0))} ${p(P(-0.176, 0))}` +
    `Q${p(P(-0.16, -0.002))} ${p(P(-0.138, -0.008))}Q${p(P(-0.108, -0.012))} ${p(P(-0.088, 0))}Z`;
  // Langfingeren bak stikker litt lenger fram enn pekefingeren.
  const backFinger =
    `M${p(P(-0.138, -0.022))}C${p(P(-0.162, -0.022))} ${p(P(-0.182, -0.016))} ${p(P(-0.19, -0.007))}` +
    `Q${p(P(-0.193, 0))} ${p(P(-0.184, 0))}Q${p(P(-0.164, -0.002))} ${p(P(-0.138, -0.008))}Z`;
  // Tommelen ligger langs siden av håndflata: bred ved roten og smalere mot tuppen, med en negl.
  const thumb =
    `M${p(P(-0.016, -0.037))}C${p(P(-0.04, -0.035))} ${p(P(-0.066, -0.028))} ${p(P(-0.085, -0.02))}` +
    `Q${p(P(-0.097, -0.014))} ${p(P(-0.094, -0.0075))}Q${p(P(-0.09, -0.003))} ${p(P(-0.08, -0.0045))}` +
    `C${p(P(-0.058, -0.009))} ${p(P(-0.036, -0.011))} ${p(P(-0.014, -0.012))}Z`;
  const nail = P(-0.084, -0.0168);
  const tipNail = P(-0.1795, -0.0095);

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
      <path d={backFinger} fill={shade(skin, 0.16)} stroke={SCENE.outline} strokeWidth={0.8 * ss} strokeLinejoin="round" />
      <path d={skinPath} fill={`url(#${id}h)`} stroke={SCENE.outline} strokeWidth={0.9 * ss} strokeLinejoin="round" />
      {/* Ledd på pekefingeren: svake buer */}
      <path
        d={`M${p(P(-0.15, -0.026))}q${r1(-0.004 * k)},${r1(0.006 * k)} ${r1(-0.002 * k)},${r1(0.013 * k)}M${p(P(-0.171, -0.015))}q${r1(-0.004 * k)},${r1(0.003 * k)} ${r1(-0.003 * k)},${r1(0.009 * k)}`}
        fill="none"
        stroke={SCENE.skinShade}
        strokeWidth={0.8 * ss}
        strokeLinecap="round"
        opacity={0.85}
      />
      <ellipse cx={tipNail[0]} cy={tipNail[1]} rx={0.0075 * k} ry={0.0022 * k} transform={`rotate(-55 ${r1(tipNail[0])} ${r1(tipNail[1])})`} fill={tint(skin, 0.4)} stroke={SCENE.skinShade} strokeWidth={0.5 * ss} />
      <path d={thumb} fill={tint(skin, 0.06)} stroke={SCENE.outline} strokeWidth={0.75 * ss} strokeLinejoin="round" />
      <ellipse cx={nail[0]} cy={nail[1]} rx={0.0068 * k} ry={0.0024 * k} transform={`rotate(-22 ${r1(nail[0])} ${r1(nail[1])})`} fill={tint(skin, 0.4)} stroke={SCENE.skinShade} strokeWidth={0.5 * ss} />
      <path
        d={`M${p(P(-0.034, -0.047))}Q${p(P(-0.066, -0.043))} ${p(P(-0.097, -0.034))}`}
        fill="none"
        stroke={SCENE.highlight}
        strokeWidth={1.3 * ss}
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

/* ---------------------------------------------------------------- Vindu (nedre del) */

/** Hvit karm og list (som fotlisten i Rom), litt varmere enn veggen. */
const TRIM = mix(PAINTS.hvit, SCENE.wall, 0.35);

/**
 * Nedre del av et vindu på veggen bak skrivebordet: glasset med himmel og åser utenfor, midtpost, karm og en
 * vinduspost (benk) med skygge under. Vinduet fortsetter opp og ut av figuren over `top`.
 * Ankerpunkt: (x, bunn) er midt på underkanten av glasset. `w` er bredden på glasset.
 *   <VinduUtsnitt x={712} w={130} top={0} bunn={74} />
 */
export function VinduUtsnitt({ x, w, top, bunn }: { x: number; w: number; top: number; bunn: number }) {
  const ss = useStrokeScale();
  const id = useSvgId('kp-vindu');
  if (!(w > 10) || !(bunn - top > 8)) return null;
  const f = clamp(w * 0.07, 4, 9);
  const L = x - w / 2;
  const R = x + w / 2;
  const T = top - 4;
  const gh = bunn - T;
  return (
    <g aria-hidden>
      <LinearGradient
        id={`${id}h`}
        userSpace
        x1={0}
        y1={T}
        x2={0}
        y2={bunn}
        stops={[
          [0, SCENE.skyTop],
          [1, SCENE.skyBottom],
        ]}
      />
      {/* Skygge av karmen på veggen */}
      <rect x={L - f + 3} y={T} width={w + 2 * f} height={gh + f + 3} fill={SCENE.shadow} opacity={0.45} />
      <rect x={L - f} y={T} width={w + 2 * f} height={gh + f} fill={TRIM} stroke={SCENE.outline} strokeWidth={0.8 * ss} />
      <rect x={L} y={T} width={w} height={gh} fill={`url(#${id}h)`} />
      {/* Utsikten: fjerne og nære åser, og toppen av et par grantrær */}
      <path
        d={`M${r1(L)},${r1(bunn - gh * 0.42)}Q${r1(L + w * 0.3)},${r1(bunn - gh * 0.62)} ${r1(L + w * 0.62)},${r1(bunn - gh * 0.46)}T${r1(R)},${r1(bunn - gh * 0.5)}V${r1(bunn)}H${r1(L)}Z`}
        fill={SCENE.hillFar}
      />
      <path
        d={`M${r1(L)},${r1(bunn - gh * 0.2)}Q${r1(L + w * 0.45)},${r1(bunn - gh * 0.34)} ${r1(R)},${r1(bunn - gh * 0.16)}V${r1(bunn)}H${r1(L)}Z`}
        fill={SCENE.hillNear}
      />
      {[0.72, 0.84].map((t, i) => {
        const tx = L + w * t;
        const th = gh * (0.36 - i * 0.08);
        const tb = bunn - gh * 0.2;
        return (
          <path
            key={i}
            d={`M${r1(tx)},${r1(tb - th)}L${r1(tx + th * 0.22)},${r1(tb)}H${r1(tx - th * 0.22)}Z`}
            fill={SCENE.foliageDark}
            opacity={0.8}
          />
        );
      })}
      {/* Gjenskinn i glasset */}
      <path
        d={`M${r1(L + w * 0.12)},${r1(T)}H${r1(L + w * 0.3)}L${r1(L + w * 0.08)},${r1(bunn)}H${r1(L)}V${r1(T + gh * 0.4)}Z`}
        fill={SCENE.highlight}
        opacity={0.5}
      />
      <rect x={x - f * 0.45} y={T} width={f * 0.9} height={gh} fill={TRIM} stroke={SCENE.outline} strokeWidth={0.6 * ss} />
      {/* Vinduspost (benken) med skygge på veggen under */}
      <rect x={L - f * 2.2} y={bunn + f * 0.7} width={w + f * 4.4} height={f * 1.2} rx={1} fill={TRIM} stroke={SCENE.outline} strokeWidth={0.8 * ss} />
      <line x1={L - f * 2.2 + 1} y1={bunn + f * 0.7 + 0.8 * ss} x2={R + f * 2.2 - 1} y2={bunn + f * 0.7 + 0.8 * ss} stroke={SCENE.highlight} strokeWidth={1.1 * ss} />
      <rect x={L - f * 2.2} y={bunn + f * 1.9} width={w + f * 4.4} height={f * 1.3} fill={SCENE.shadow} opacity={0.4} />
    </g>
  );
}

/* ---------------------------------------------------------------- Vegghylle */

/** Bøkene på hylla: bredde og høyde i meter, farge og helning (grader, mot høyre). */
const SHELF_BOOKS: { w: number; h: number; c: PaintName; lean?: number }[] = [
  { w: 0.035, h: 0.24, c: 'blaa' },
  { w: 0.028, h: 0.22, c: 'gronn' },
  { w: 0.045, h: 0.25, c: 'rod' },
  { w: 0.022, h: 0.2, c: 'gul' },
  { w: 0.03, h: 0.23, c: 'graa' },
  { w: 0.026, h: 0.21, c: 'blaa', lean: 14 },
];

/**
 * Vegghylle i tre med bøker (ryggene vender ut) og en liten potteplante. Ankerpunkt: (x, y) er venstre ende av
 * oversiden av hyllebrettet; `w` er lengden og `k` skalaen (figurens enheter per meter).
 *   <Vegghylle x={30} y={150} w={150} k={420} />
 */
export function Vegghylle({ x, y, w, k }: { x: number; y: number; w: number; k: number }) {
  const ss = useStrokeScale();
  const id = useSvgId('kp-hylle');
  if (!(w > 20) || !(k > 0)) return null;
  const board = Math.max(3, 0.022 * k);
  let bx = x + 0.03 * k;
  const books = SHELF_BOOKS.map((b, i) => {
    const bw = b.w * k;
    const bh = b.h * k;
    const left = bx;
    bx += bw + (b.lean ? bh * Math.sin(((b.lean ?? 0) * Math.PI) / 180) : 0.5);
    // Dempede farger: bøkene i bakgrunnen skal ikke konkurrere med kraftpilene.
    const c = mix(paint(b.c), SCENE.wall, 0.3);
    // Den siste boka lener seg mot de andre: dreid om det nederste høyre hjørnet.
    const tr = b.lean ? `rotate(${b.lean} ${r1(left + bw)} ${r1(y)})` : undefined;
    const band = Math.max(2, bh * 0.07);
    return (
      <g key={i} transform={tr}>
        <rect x={left} y={y - bh} width={bw} height={bh} rx={Math.min(1.5, bw * 0.12)} fill={`url(#${id}b${i})`} />
        <LinearGradient
          id={`${id}b${i}`}
          x2={1}
          y2={0}
          stops={[
            [0, tint(c, 0.12)],
            [0.35, mix(c, SCENE.wall, 0.15)],
            [1, shade(c, 0.28)],
          ]}
        />
        <rect x={left} y={y - bh + bh * 0.12} width={bw} height={band} fill={shade(c, 0.35)} opacity={0.55} />
        <rect x={left} y={y - bh * 0.24} width={bw} height={band * 0.6} fill={tint(c, 0.4)} opacity={0.6} />
        <rect x={left} y={y - bh} width={bw} height={bh} rx={Math.min(1.5, bw * 0.12)} fill="none" stroke={SCENE.outline} strokeWidth={0.7 * ss} />
      </g>
    );
  });
  // Potteplante i den høyre enden
  const px = x + w - 0.07 * k;
  const pr = 0.045 * k;
  const ph = 0.08 * k;
  const pot = shade(mix(SCENE.brick, SCENE.soil, 0.3), 0.02);
  const leaves: string[] = [];
  for (const [a, l] of [
    [-62, 1],
    [-30, 1.25],
    [-5, 1.1],
    [25, 1.2],
    [58, 0.95],
  ] as const) {
    const rad = (a * Math.PI) / 180;
    const len = 0.11 * k * l;
    const bx0 = px;
    const by0 = y - ph + 2;
    const tx = bx0 + Math.sin(rad) * len;
    const ty = by0 - Math.cos(rad) * len;
    const nx = Math.cos(rad) * len * 0.22;
    const ny = Math.sin(rad) * len * 0.22;
    const mx = (bx0 + tx) / 2;
    const my = (by0 + ty) / 2;
    leaves.push(`M${r1(bx0)},${r1(by0)}Q${r1(mx + nx)},${r1(my + ny)} ${r1(tx)},${r1(ty)}Q${r1(mx - nx)},${r1(my - ny)} ${r1(bx0)},${r1(by0)}Z`);
  }
  return (
    <g aria-hidden>
      <LinearGradient id={`${id}t`} stops={materialStops(SCENE.wood, 0.8)} />
      <LinearGradient
        id={`${id}p`}
        x2={1}
        y2={0}
        stops={[
          [0, tint(pot, 0.18)],
          [0.5, pot],
          [1, shade(pot, 0.25)],
        ]}
      />
      {/* Konsollene under brettet og skyggen på veggen */}
      <rect x={x + 3} y={y + board} width={w} height={board * 1.4} fill={SCENE.shadow} opacity={0.35} />
      {[x + w * 0.18, x + w * 0.82].map((cx, i) => (
        <path
          key={i}
          d={`M${r1(cx - 1.5)},${r1(y + board)}V${r1(y + board + 0.06 * k)}L${r1(cx + 1.5)},${r1(y + board + 0.06 * k - 3)}V${r1(y + board)}Z`}
          fill={SCENE.metalDark}
        />
      ))}
      {books}
      <path d={leaves.join('')} fill={SCENE.foliage} stroke={SCENE.foliageDark} strokeWidth={0.7 * ss} strokeLinejoin="round" />
      <path
        d={`M${r1(px - pr)},${r1(y - ph)}H${r1(px + pr)}L${r1(px + pr * 0.78)},${r1(y)}H${r1(px - pr * 0.78)}Z`}
        fill={`url(#${id}p)`}
        stroke={SCENE.outline}
        strokeWidth={0.8 * ss}
        strokeLinejoin="round"
      />
      <rect x={px - pr * 1.05} y={y - ph} width={pr * 2.1} height={ph * 0.18} rx={1} fill={tint(pot, 0.1)} stroke={SCENE.outline} strokeWidth={0.7 * ss} />
      <rect x={x} y={y} width={w} height={board} rx={1} fill={`url(#${id}t)`} stroke={SCENE.outline} strokeWidth={0.8 * ss} />
      <line x1={x + 1} y1={y + 0.7 * ss} x2={x + w - 1} y2={y + 0.7 * ss} stroke={SCENE.highlight} strokeWidth={1 * ss} />
    </g>
  );
}

/* ---------------------------------------------------------------- Blyant */

/**
 * Gul blyant (sekskantet) som ligger på bordet, sett fra siden: spissen mot venstre, viskelær med metallhylse til
 * høyre. Ankerpunkt: (x, y) er midt på blyanten der den ligger på flaten. `k` er skalaen (enheter per meter);
 * en blyant er 17 cm lang og 7 mm tykk.
 */
export function Blyant({ x, y, k }: { x: number; y: number; k: number }) {
  const ss = useStrokeScale();
  const id = useSvgId('kp-blyant');
  if (!(k > 0)) return null;
  const len = 0.17 * k;
  const d = Math.max(2.4, 0.007 * k);
  const L = x - len / 2;
  const R = x + len / 2;
  const tip = len * 0.11;
  const ferrule = len * 0.07;
  const eraser = len * 0.055;
  const T = y - d;
  const body = PAINTS.gul;
  return (
    <g aria-hidden>
      <ContactShadow cx={x} cy={y} rx={len * 0.5} ry={Math.max(1.5, d * 0.45)} opacity={0.8} />
      <LinearGradient id={`${id}b`} stops={materialStops(body, 1.2)} />
      <LinearGradient id={`${id}m`} stops={materialStops(SCENE.metal, 1.4)} />
      <path d={`M${r1(L + tip)},${r1(T)}L${r1(L)},${r1(y - d * 0.5)}L${r1(L + tip)},${r1(y)}Z`} fill={SCENE.woodLight} stroke={SCENE.outline} strokeWidth={0.6 * ss} strokeLinejoin="round" />
      <path d={`M${r1(L + tip * 0.32)},${r1(y - d * 0.66)}L${r1(L)},${r1(y - d * 0.5)}L${r1(L + tip * 0.32)},${r1(y - d * 0.34)}Z`} fill={SCENE.rubber} />
      <rect x={L + tip} y={T} width={len - tip - ferrule - eraser} height={d} fill={`url(#${id}b)`} />
      <line x1={L + tip} y1={y - d * 0.5} x2={R - ferrule - eraser} y2={y - d * 0.5} stroke={shade(body, 0.2)} strokeWidth={0.5 * ss} opacity={0.6} />
      <rect x={R - ferrule - eraser} y={T - d * 0.04} width={ferrule} height={d * 1.08} fill={`url(#${id}m)`} />
      <rect x={R - eraser} y={T} width={eraser} height={d} rx={Math.min(1.2, d * 0.3)} fill={tint(PAINTS.rod, 0.45)} />
      <rect x={L + tip} y={T} width={len - tip} height={d} rx={Math.min(1, d * 0.2)} fill="none" stroke={SCENE.outline} strokeWidth={0.7 * ss} />
    </g>
  );
}

/* ---------------------------------------------------------------- Snitt ned til jordas sentrum */

export interface JordSnittProps {
  /** Venstre og høyre kant av snittet. */
  x1: number;
  x2: number;
  /** Forkanten av gulvet: snittet begynner her med betongplata. */
  y: number;
  /** Bruddlinja: over den er snittet i målestokk, under den er avstanden ned til sentrum forkortet. */
  brudd: number;
  /** Jordas sentrum (spissen av kilen). */
  cx: number;
  cy: number;
  /** Halve åpningsvinkelen til kilen i grader (standard 56). */
  vinkel?: number;
  dim?: boolean;
}

/** Siksakkant langs en bruddlinje: punktene går vekselvis opp og ned med amplituden `a`. */
function zigzag(xa: number, xb: number, y: number, a: number, step: number): [number, number][] {
  const n = Math.max(2, Math.round((xb - xa) / step));
  const pts: [number, number][] = [];
  for (let i = 0; i <= n; i++) pts.push([xa + ((xb - xa) * i) / n, y + (i % 2 === 0 ? -a : a)]);
  return pts;
}

/**
 * Snitt under gulvet, som i en lærebokfigur: betongplate, pukk og jord, en bruddlinje, og under den en kile av jordas
 * indre (mantel, ytre og indre kjerne) som smalner inn mot jordas sentrum i (cx, cy). Kilen viser at jorda er ei kule,
 * og at kreftene fra og på jorda som helhet tegnes i sentrum.
 *   <JordSnitt x1={0} x2={800} y={516} brudd={566} cx={400} cy={682} />
 */
export function JordSnitt({ x1, x2, y, brudd, cx, cy, vinkel = 56, dim }: JordSnittProps) {
  const ss = useStrokeScale();
  const id = useSvgId('kp-snitt');
  const slab = Math.min(16, (brudd - y) * 0.3);
  const gravel = Math.min(12, (brudd - y) * 0.22);
  const amp = 3;
  const gap = 7;
  const wedgeTop = brudd + gap;
  const h = cy - wedgeTop;
  const tanA = Math.tan((clamp(vinkel, 10, 80) * Math.PI) / 180);
  const half = h * tanA;
  const rand = useMemo(() => {
    const rnd = sceneRandom(7);
    const stones: { x: number; y: number; rx: number; ry: number; a: number; layer: 'pukk' | 'jord' }[] = [];
    const span = x2 - x1;
    for (let i = 0; i < Math.round(span / 9); i++) {
      stones.push({ x: x1 + rnd() * span, y: y + slab + 2 + rnd() * (gravel - 4), rx: 1.6 + rnd() * 2.2, ry: 1.2 + rnd() * 1.4, a: rnd() * 180, layer: 'pukk' });
    }
    for (let i = 0; i < Math.round(span / 40); i++) {
      stones.push({ x: x1 + rnd() * span, y: y + slab + gravel + 6 + rnd() * Math.max(2, brudd - y - slab - gravel - 14), rx: 2.5 + rnd() * 4, ry: 1.8 + rnd() * 2.4, a: rnd() * 180, layer: 'jord' });
    }
    const dots: string[] = [];
    for (let i = 0; i < Math.round(span / 6); i++) {
      const dx = x1 + rnd() * span;
      const dy = y + 2 + rnd() * (slab - 4);
      dots.push(`M${r1(dx)},${r1(dy)}h0.01`);
    }
    return { stones, dots: dots.join('') };
  }, [x1, x2, y, slab, gravel, brudd]);
  if (!(x2 > x1) || !(brudd > y + 10) || !(h > 10)) return null;

  const ground = zigzag(x1, x2, brudd, amp, 14);
  const groundPath = `M${r1(x1)},${r1(y)}H${r1(x2)}` + ground.reverse().map(([px, py]) => `L${r1(px)},${r1(py)}`).join('') + 'Z';
  const topEdge = zigzag(cx - half, cx + half, wedgeTop, amp, 14);
  const wedgePath = `M${r1(cx)},${r1(cy)}` + topEdge.map(([px, py]) => `L${r1(px)},${r1(py)}`).join('') + 'Z';
  // Lagene i jorda (radius 6 370 km): ytre kjerne fra 3 480 km og indre kjerne fra 1 220 km. Kilen viser de
  // nederste ca. 80 % av radien, så grensene havner ved 0,55/0,8 og 0,19/0,8 av høyden.
  const rOuter = h * 0.68;
  const rInner = h * 0.24;
  // Mantelen er en lys steinfarge, så kilen skiller seg fra bakgrunnen også i mørkt tema (skumring); kjernen blir
  // varmere innover. Fargene er dempet, så den oransje G′-pila i sentrum fortsatt synes best.
  const mantle = tint(mix(SCENE.stone, SCENE.soil, 0.5), 0.12);
  const outer = mix(mix(SCENE.stone, SCENE.soil, 0.35), SCENE.warm, 0.3);
  const inner = mix(mix(tint(SCENE.stone, 0.2), SCENE.glow, 0.35), SCENE.warm, 0.1);
  return (
    <g opacity={dim ? SCENE_DIM : undefined} aria-hidden>
      <LinearGradient
        id={`${id}b`}
        userSpace
        x1={0}
        y1={y}
        x2={0}
        y2={y + slab}
        stops={[
          [0, tint(SCENE.concrete, 0.1)],
          [1, shade(SCENE.concrete, 0.12)],
        ]}
      />
      <LinearGradient
        id={`${id}j`}
        userSpace
        x1={0}
        y1={y + slab + gravel}
        x2={0}
        y2={brudd}
        stops={[
          [0, SCENE.soil],
          [1, shade(SCENE.soilDark, 0.1)],
        ]}
      />
      <RadialGradient
        id={`${id}m`}
        userSpace
        cx={cx}
        cy={cy}
        r={h}
        stops={[
          [0, tint(mantle, 0.2)],
          [1, shade(mantle, 0.15)],
        ]}
      />
      <clipPath id={`${id}k`}>
        <path d={wedgePath} />
      </clipPath>
      <clipPath id={`${id}g`}>
        <path d={groundPath} />
      </clipPath>
      {/* Grunnen under huset: betongplate, pukk og jord, med bruddlinje nederst */}
      <g clipPath={`url(#${id}g)`}>
        <rect x={x1} y={y} width={x2 - x1} height={brudd - y + amp} fill={`url(#${id}j)`} />
        <rect x={x1} y={y + slab} width={x2 - x1} height={gravel} fill={SCENE.gravel} />
        {rand.stones.map((s, i) => (
          <ellipse
            key={i}
            cx={s.x}
            cy={s.y}
            rx={s.rx}
            ry={s.ry}
            transform={`rotate(${r1(s.a)} ${r1(s.x)} ${r1(s.y)})`}
            fill={s.layer === 'pukk' ? (i % 3 === 0 ? SCENE.gravelDark : tint(SCENE.gravel, 0.25)) : mix(SCENE.stone, SCENE.soilDark, 0.35)}
            stroke={SCENE.outline}
            strokeWidth={0.4 * ss}
            opacity={0.9}
          />
        ))}
        <rect x={x1} y={y} width={x2 - x1} height={slab} fill={`url(#${id}b)`} />
        <path d={rand.dots} stroke={SCENE.concreteDark} strokeWidth={1.6 * ss} strokeLinecap="round" opacity={0.7} />
        <line x1={x1} y1={y + slab} x2={x2} y2={y + slab} stroke={SCENE.outline} strokeWidth={0.6 * ss} opacity={0.6} />
      </g>
      <path d={groundPath} fill="none" stroke={SCENE.outline} strokeWidth={0.9 * ss} strokeLinejoin="round" />
      {/* Kilen ned til sentrum */}
      <g clipPath={`url(#${id}k)`}>
        <rect x={cx - half - 2} y={wedgeTop - amp - 2} width={2 * half + 4} height={h + amp + 4} fill={`url(#${id}m)`} />
        <circle cx={cx} cy={cy} r={rOuter} fill={outer} />
        <circle cx={cx} cy={cy} r={rOuter} fill="none" stroke={SCENE.outline} strokeWidth={0.6 * ss} opacity={0.5} />
        <circle cx={cx} cy={cy} r={rInner} fill={inner} />
        <circle cx={cx} cy={cy} r={rInner} fill="none" stroke={SCENE.outline} strokeWidth={0.6 * ss} opacity={0.5} />
        <path
          d={`M${r1(cx - half)},${r1(wedgeTop)}L${r1(cx)},${r1(cy)}`}
          stroke={SCENE.highlight}
          strokeWidth={2 * ss}
          opacity={0.6}
        />
      </g>
      {/* Kanten på kilen: en lys strek innenfor konturen, så formen synes mot bakgrunnen i begge temaene */}
      <path d={wedgePath} fill="none" stroke={VIZ.muted} strokeWidth={2.2 * ss} strokeLinejoin="round" opacity={0.75} />
      <path d={wedgePath} fill="none" stroke={SCENE.outline} strokeWidth={0.9 * ss} strokeLinejoin="round" />
    </g>
  );
}
