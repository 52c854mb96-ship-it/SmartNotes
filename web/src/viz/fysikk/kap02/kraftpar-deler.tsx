/**
 * Egne gjenstander til kraftparscenen (k2-kraftpar, 2D) som scene-kit-et ikke har: en lærebok sett fra snittkanten
 * (sidene mellom to permer) og en hånd som presser flatt ned på noe (underarm med genserermet). Samme stil som
 * scene-kit-et: toninger fra core, SCENE-farger, tynn kontur og myke skygger. Alle mål er i figurens enheter.
 */
import {
  ContactShadow,
  LinearGradient,
  PAINTS,
  SCENE,
  SCENE_DIM,
  materialStops,
  mix,
  paint,
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
