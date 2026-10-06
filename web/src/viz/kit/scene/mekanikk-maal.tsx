/**
 * Familien «mekanikk», del 3: måleinstrumenter – kraftmåler, badevekt, målebånd og stoppeklokke.
 * Eksporteres via mekanikk.tsx.
 */
import { useTextScale } from '../controls';
import { fmt } from '../format';
import {
  ContactShadow,
  LinearGradient,
  Place,
  RadialGradient,
  SCENE_DIM,
  alpha,
  materialStops,
  shade,
  tint,
  useStrokeScale,
  useSvgId,
} from './core';
import { MEK, DEG, ObjectText, clamp, coilPaths, decimalsFor, num, pt, r2, scaleSteps } from './mekanikk-felles';
import { PAINTS, SCENE, paint, type PaintName } from './palette';

/* ---------------------------------------------------------------- Kraftmåler */

export interface KraftmaalerProps {
  /** (x, y) er toppen av ringen øverst (der kraftmåleren henger eller holdes). */
  x: number;
  y: number;
  /** Hele lengden fra ringen øverst til bunnen av kroken nederst, som er i (x, y + lengde). */
  lengde: number;
  /** Kraften kraftmåleren viser (samme enhet som skalaen). Viseren står på dette tallet. */
  kraft: number;
  /** Største verdi på skalaen. */
  maks: number;
  /** Enheten på skalaen. Standard «N». */
  enhet?: string;
  /** Fargen på lokkene og viseren (navn fra PAINTS eller CSS-farge). Standard «rod». */
  farge?: PaintName | string;
  /** Grader med klokka, dreid rundt ringen øverst (f.eks. når du drar skrått i en kloss). */
  rotate?: number;
  dim?: boolean;
  title?: string;
}

/**
 * Kraftmåler (fjærvekt) med gjennomsiktig rør, skala, synlig fjær og en viser som står på `kraft`. Fjæra inni
 * strekkes like mye som viseren flytter seg. Ankerpunkt: (x, y) er toppen av ringen; kroken nederst er i
 * (x, y + lengde), så et lodd kan henge der. Skalaen får tall i fine steg (0, 2, 4 … 10).
 *   <Kraftmaaler x={400} y={40} lengde={220} kraft={4.9} maks={10} />
 *   <Lodd x={400} y={40 + 220} size={30} label="500 g" />
 */
export function Kraftmaaler({ x, y, lengde, kraft, maks, enhet = 'N', farge = 'rod', rotate, dim, title }: KraftmaalerProps) {
  const id = useSvgId('sc-kraftm');
  const ss = useStrokeScale();
  const Lg = Math.max(40, num(lengde, 200));
  const W = clamp(Lg * 0.17, 12, 64);
  const max = num(maks, 10) > 0 ? num(maks, 10) : 10;
  const F = clamp(num(kraft, 0), 0, max * 1.03);
  const color = paint(farge);

  const wire = Math.max(1.2 * ss, W * 0.08);
  const rho = W * 0.22;
  const ringC = rho - wire / 2;
  const capT = ringC + rho + W * 0.14;
  const capH = W * 0.3;
  const tubeT = capT + capH;
  const hookRho = W * 0.18;
  const hookC = Lg - hookRho + wire / 2;
  const botCapH = W * 0.24;
  const botCapB = hookC - W * 0.5;
  const tubeB = botCapB - botCapH;
  const s0 = tubeT + W * 0.55;
  const s1 = Math.max(s0 + 10, tubeB - W * 0.32);
  const yF = s0 + ((s1 - s0) * F) / max;

  // Skala på en lys stripe til venstre i røret
  const stripL = -W / 2 + W * 0.07;
  const stripR = -W / 2 + W * 0.58;
  const steps = scaleSteps(max, 5, (s1 - s0) / max, 3.2 * ss);
  const dec = decimalsFor(steps.major);
  const n = Math.round(max / steps.minor);
  let ticks = '';
  const labels: { v: number; y: number }[] = [];
  for (let i = 0; i <= n && i <= 200; i++) {
    const v = i * steps.minor;
    const ty = s0 + ((s1 - s0) * v) / max;
    const major = Math.abs(v / steps.major - Math.round(v / steps.major)) < 1e-6;
    const half = !major && Math.abs((2 * v) / steps.major - Math.round((2 * v) / steps.major)) < 1e-6;
    const len = major ? W * 0.17 : half ? W * 0.12 : W * 0.075;
    ticks += `M${pt(stripR, ty)} H${r2(stripR - len)}`;
    if (major) labels.push({ v, y: ty });
  }
  const longest = Math.max(...labels.map((l) => fmt(l.v, dec).length), 1);
  const numW = stripR - stripL - W * 0.22;
  const px = Math.min(W * 0.27, numW / (longest * 0.56), ((s1 - s0) / Math.max(1, labels.length - 1)) * 0.8);

  // Fjæra mellom toppen av røret og viseren
  const springX = W * 0.29;
  const springR = W * 0.15;
  const coil = coilPaths(springX, tubeT, springX, yF - W * 0.04, springR, 9, W * 0.12, 0.12);
  const sw = Math.max(0.9 * ss, W * 0.05);
  const hook = `M${pt(hookRho, botCapB)} V${r2(hookC)} A${r2(hookRho)},${r2(hookRho)} 0 0 1 ${pt(-hookRho, hookC)} L${pt(-hookRho, hookC - hookRho * 0.7)}`;

  return (
    <Place x={x} y={y} rotate={rotate} opacity={dim ? SCENE_DIM : undefined}>
      {title && <title>{title}</title>}
      <LinearGradient
        id={`${id}c`}
        x2={1}
        y2={0}
        stops={[
          [0, tint(color, 0.2)],
          [0.35, tint(color, 0.08)],
          [1, shade(color, 0.3)],
        ]}
      />
      <LinearGradient
        id={`${id}g`}
        x2={1}
        y2={0}
        stops={[
          [0, SCENE.glass, 0.75],
          [0.2, SCENE.glass, 0.35],
          [0.75, SCENE.glass, 0.45],
          [1, SCENE.glassEdge, 0.8],
        ]}
      />
      {/* Ring øverst og krok nederst */}
      <circle cx={0} cy={ringC} r={rho} fill="none" stroke={SCENE.outline} strokeWidth={wire + 1.3 * ss} />
      <circle cx={0} cy={ringC} r={rho} fill="none" stroke={SCENE.metal} strokeWidth={wire} />
      <line x1={0} y1={ringC + rho} x2={0} y2={capT} stroke={SCENE.metalDark} strokeWidth={wire} />
      <path d={hook} fill="none" stroke={SCENE.outline} strokeWidth={wire + 1.3 * ss} strokeLinecap="round" />
      <path d={hook} fill="none" stroke={SCENE.metal} strokeWidth={wire} strokeLinecap="round" />
      {/* Røret: fjær og stang inni, glass, skala trykt på forsiden og viseren */}
      <rect x={-W / 2} y={tubeT} width={W} height={tubeB - tubeT} fill={SCENE.glass} opacity={0.35} />
      <rect x={-W / 2} y={tubeT} width={W} height={tubeB - tubeT} fill={`url(#${id}g)`} />
      <line x1={springX} y1={yF} x2={springX} y2={tubeB} stroke={SCENE.metalDark} strokeWidth={Math.max(1, W * 0.06)} />
      <path d={coil.back} fill="none" stroke={MEK.coilBack} strokeWidth={sw * 0.8} strokeLinecap="round" />
      <path d={coil.front} fill="none" stroke={SCENE.outline} strokeWidth={sw + 0.8 * ss} strokeLinecap="round" opacity={0.6} />
      <path d={coil.front} fill="none" stroke={SCENE.metal} strokeWidth={sw} strokeLinecap="round" />
      <rect x={stripL} y={tubeT + W * 0.06} width={stripR - stripL} height={tubeB - tubeT - W * 0.12} rx={W * 0.04} fill={MEK.paper} opacity={0.94} />
      <path d={ticks} stroke={MEK.print} strokeWidth={Math.max(0.6, W * 0.022) * ss} />
      {px >= 3 &&
        labels.map((l) => (
          <text
            key={l.v}
            x={r2(stripR - W * 0.2)}
            y={r2(l.y + px * 0.36)}
            fontSize={r2(px)}
            fill={MEK.print}
            fontWeight={650}
            textAnchor="end"
            style={{ fontVariantNumeric: 'tabular-nums' }}
          >
            {fmt(l.v, dec)}
          </text>
        ))}
      <ObjectText x={(stripL + stripR) / 2} y={(tubeT + s0) / 2 + W * 0.02} w={stripR - stripL} h={(s0 - tubeT) * 0.8} text={enhet} color={MEK.print} max={12} />
      {/* Viseren går over den høyre delen av røret, med spissen mot strekene, så tallene ikke dekkes */}
      <path
        d={`M${pt(stripR - W * 0.17, yF)} L${pt(stripR - W * 0.02, yF - W * 0.1)} V${r2(yF - W * 0.045)} H${r2(W / 2 - 0.8)} V${r2(yF + W * 0.045)} H${r2(stripR - W * 0.02)} V${r2(yF + W * 0.1)} Z`}
        fill={color}
        stroke={shade(color, 0.45)}
        strokeWidth={0.6 * ss}
        strokeLinejoin="round"
      />
      <line x1={-W * 0.42} y1={tubeT + W * 0.1} x2={-W * 0.42} y2={tubeB - W * 0.1} stroke={SCENE.highlight} strokeWidth={Math.max(0.8 * ss, W * 0.04)} strokeLinecap="round" />
      <rect x={-W / 2} y={tubeT} width={W} height={tubeB - tubeT} fill="none" stroke={SCENE.glassEdge} strokeWidth={1 * ss} />
      <rect x={-W / 2} y={tubeT} width={W} height={tubeB - tubeT} fill="none" stroke={SCENE.outline} strokeWidth={0.6 * ss} opacity={0.6} />
      {/* Lokk */}
      <rect x={-W * 0.56} y={capT} width={W * 1.12} height={capH} rx={W * 0.08} fill={`url(#${id}c)`} stroke={SCENE.outline} strokeWidth={0.9 * ss} />
      <rect x={-W * 0.56} y={tubeB} width={W * 1.12} height={botCapH} rx={W * 0.08} fill={`url(#${id}c)`} stroke={SCENE.outline} strokeWidth={0.9 * ss} />
      <line x1={-W * 0.44} y1={capT + capH * 0.28} x2={W * 0.3} y2={capT + capH * 0.28} stroke={SCENE.highlight} strokeWidth={Math.max(0.8 * ss, W * 0.05)} strokeLinecap="round" />
    </Place>
  );
}

/* ---------------------------------------------------------------- Badevekt */

export interface BadevektProps {
  /** (x, y) er midt på bunnen (gulvet). Toppen, der personen står, er i y − 0,16 · w. */
  x: number;
  y: number;
  /** Bredden. Ekte badevekt: ca. 30 cm. */
  w: number;
  /** Teksten på displayet, f.eks. «58,9 kg». */
  visning: string;
  /** Myk skygge under vekta (standard på). */
  skygge?: boolean;
  dim?: boolean;
  title?: string;
}

/**
 * Digital badevekt med glassplate og display foran. Ankerpunkt: (x, y) midt på bunnen; personen står på toppen i
 * y − 0,16 · w. Displayet er lite som på en ekte vekt: legg gjerne en ValueTag over når tallet er det viktige.
 *   <Badevekt x={400} y={gulv} w={150} visning={`${fmt(m, 1)} kg`} />
 */
export function Badevekt({ x, y, w, visning, skygge = true, dim, title }: BadevektProps) {
  const id = useSvgId('sc-vekt');
  const ss = useStrokeScale();
  const W = Math.max(20, num(w, 150));
  const foot = W * 0.02;
  const bodyT = -W * 0.14;
  const glassT = -W * 0.16;
  const dw = W * 0.46;
  const dh = W * 0.085;
  const dy = (bodyT - foot) / 2;
  return (
    <Place x={x} y={y} opacity={dim ? SCENE_DIM : undefined}>
      {title && <title>{title}</title>}
      {skygge && <ContactShadow cx={0} cy={0} rx={W * 0.56} />}
      <LinearGradient id={`${id}b`} stops={materialStops(SCENE.plastic, 1.2)} />
      <LinearGradient
        id={`${id}g`}
        stops={[
          [0, tint(SCENE.glass, 0.5)],
          [1, SCENE.glassEdge],
        ]}
      />
      <g fill={SCENE.rubber}>
        <rect x={-W * 0.42} y={-foot - 0.5} width={W * 0.09} height={foot + 0.5} rx={foot * 0.3} />
        <rect x={W * 0.33} y={-foot - 0.5} width={W * 0.09} height={foot + 0.5} rx={foot * 0.3} />
      </g>
      <rect x={-W / 2} y={bodyT} width={W} height={bodyT * -1 - foot} rx={W * 0.03} fill={`url(#${id}b)`} stroke={SCENE.outline} strokeWidth={1 * ss} />
      <rect x={-W * 0.495} y={glassT} width={W * 0.99} height={glassT * -1 + bodyT + 0.6} rx={W * 0.012} fill={`url(#${id}g)`} stroke={SCENE.outline} strokeWidth={0.9 * ss} />
      <line x1={-W * 0.47} y1={glassT + 0.9 * ss} x2={W * 0.47} y2={glassT + 0.9 * ss} stroke={SCENE.highlight} strokeWidth={1.2 * ss} strokeLinecap="round" />
      <rect x={-dw / 2} y={dy - dh / 2} width={dw} height={dh} rx={dh * 0.18} fill={SCENE.display} stroke={shade(SCENE.plastic, 0.4)} strokeWidth={0.8 * ss} />
      <ObjectText x={0} y={dy} w={dw * 0.9} h={dh * 0.9} text={visning} color={SCENE.displayText} weight={650} max={16} />
    </Place>
  );
}

/* ---------------------------------------------------------------- Målebånd */

export interface MaalebaandProps {
  /** Der skalaen begynner (verdien `fra`). Haken i enden av båndet stikker høyst 4 enheter ut forbi x1. */
  x1: number;
  /**
   * Der skalaen slutter (verdien `til`). Båndet slutter 3 enheter etter, så x2 kan ligge helt ut mot kanten av
   * figuren uten at noe klippes.
   */
  x2: number;
  /** Overkanten av båndet. Båndet går nedover herfra, så det kan ligge langs bakkekanten foran gjenstandene. */
  y: number;
  /** Verdien ved x1. Standard 0. */
  fra?: number;
  /** Verdien ved x2. */
  til: number;
  /**
   * Enheten. Den står etter det siste tallet når det er plass, ellers etter det første («0 m»). Standard «m».
   */
  enhet?: string;
  /** Omtrent hvor mange intervaller med tall (standard: så mange som får plass). Tallene kommer i fine steg. */
  merker?: number;
  dim?: boolean;
  title?: string;
}

/** Omtrentlig bredde på tekst i fet skrift (tall er ca. 0,64 em, smale tegn mindre, «m» og «w» mer). */
function textWidth(text: string, px: number): number {
  let em = 0;
  for (const ch of text) em += /[0-9]/.test(ch) ? 0.64 : /[,.:; ]/.test(ch) ? 0.36 : /[mwMW]/.test(ch) ? 1.02 : 0.66;
  return em * px;
}

/**
 * Målebånd langs bakken med streker og tall. Ankerpunkt: overkanten (y) fra x1 til x2. Alt holder seg innenfor
 * x1 − 4 … x2 + 3 (haken sitter i x1-enden). Båndet blir litt høyere på mobil, så tallene kan leses.
 *   <Maalebaand x1={80} x2={720} y={bakke} til={40} />      // 0 m, 5, 10 … 40
 *   <Maalebaand x1={80} x2={560} y={bakke} til={4.8} />     // 0, 1, 2, 3, 4 m
 */
export function Maalebaand({ x1, x2, y, fra = 0, til, enhet = 'm', merker, dim, title }: MaalebaandProps) {
  const id = useSvgId('sc-maal');
  const ss = useStrokeScale();
  const f = useTextScale();
  const a = num(x1, 0);
  const b = num(x2, a + 100);
  const v0 = num(fra, 0);
  const v1 = num(til, v0 + 1);
  const width = b - a;
  const range = v1 - v0;
  if (!(Math.abs(width) > 4) || !(Math.abs(range) > 0)) return null;
  const dir = width > 0 ? 1 : -1;
  const px = 11.5 * f;
  const hb = px * 1.75;
  const upv = width / range;
  const longest = Math.max(fmt(v0, 1).length, fmt(v1, 1).length);
  const fit = Math.max(1, Math.floor(Math.abs(width) / (longest * px * 0.64 + 12 * f)));
  const want = merker !== undefined && merker > 0 ? Math.min(merker, fit) : Math.min(fit, Math.max(1, Math.round(Math.abs(width) / (75 * f))));
  const steps = scaleSteps(range, want, upv, 4 * ss);
  const dec = decimalsFor(steps.major);

  // Båndet går fra x1 til x2 pluss en fast ende; haken sitter utenfor x1.
  const END = 3;
  const left = dir > 0 ? a : b - END;
  const right = dir > 0 ? b + END : a;
  const inL = left + 2;
  const inR = right - 2;

  let ticks = '';
  type Label = { text: string; x: number; l: number; r: number; anchor: 'start' | 'middle' | 'end' };
  const labels: Label[] = [];
  const lo = Math.min(v0, v1);
  const hi = Math.max(v0, v1);
  const first = Math.ceil(lo / steps.minor - 1e-9);
  const last = Math.floor(hi / steps.minor + 1e-9);
  for (let i = first; i <= last && i - first <= 400; i++) {
    const v = i * steps.minor;
    const tx = a + (v - v0) * upv;
    const major = Math.abs(v / steps.major - Math.round(v / steps.major)) < 1e-6;
    const half = !major && Math.abs((2 * v) / steps.major - Math.round((2 * v) / steps.major)) < 1e-6;
    const len = major ? hb * 0.4 : half ? hb * 0.28 : hb * 0.17;
    ticks += `M${pt(tx, y)} V${r2(y + len)}`;
    if (!major) continue;
    // Null skrives «0», som på en ekte linjal. Tall som ville stikke ut av båndet, skyves inn (start/slutt).
    const text = Math.abs(v) < 1e-9 ? '0' : fmt(v, dec);
    const tw = textWidth(text, px);
    if (tx - tw / 2 < inL) labels.push({ text, x: inL, l: inL, r: inL + tw, anchor: 'start' });
    else if (tx + tw / 2 > inR) labels.push({ text, x: inR, l: inR - tw, r: inR, anchor: 'end' });
    else labels.push({ text, x: tx, l: tx - tw / 2, r: tx + tw / 2, anchor: 'middle' });
  }
  labels.sort((p, q) => p.x - q.x);

  // Enheten: etter det siste tallet, ellers etter det første, ellers helt til høyre (og tall som kolliderer, hoppes over).
  let unit: { x: number; anchor: 'start' | 'end' } | null = null;
  let shown = labels;
  if (enhet) {
    const uw = textWidth(enhet, px);
    const gap = px * 0.35;
    const lastL = labels[labels.length - 1];
    const firstL = labels[0];
    if (lastL && lastL.r + gap + uw <= inR) unit = { x: lastL.r + gap, anchor: 'start' };
    else if (firstL && firstL.r + gap + uw + gap <= (labels[1]?.l ?? inR + gap)) unit = { x: firstL.r + gap, anchor: 'start' };
    else {
      unit = { x: inR, anchor: 'end' };
      shown = labels.filter((l) => l.r <= inR - uw - gap);
    }
  }

  const tab = Math.max(4, hb * 0.28);
  const hook = Math.min(3.5, tab * 0.5);
  const hx = dir > 0 ? left : right;
  return (
    <g opacity={dim ? SCENE_DIM : undefined}>
      {title && <title>{title}</title>}
      <LinearGradient id={`${id}b`} stops={materialStops(MEK.maalebaand, 0.7)} />
      <rect x={left} y={y} width={right - left} height={hb} rx={1.5} fill={`url(#${id}b)`} stroke={SCENE.outline} strokeWidth={0.9 * ss} />
      <line x1={left + 1} y1={y + 0.8 * ss} x2={right - 1} y2={y + 0.8 * ss} stroke={SCENE.highlight} strokeWidth={1.1 * ss} />
      <path d={ticks} stroke={MEK.print} strokeWidth={0.9 * ss} />
      <g fill={MEK.print} fontWeight={650} fontSize={r2(px)} style={{ fontVariantNumeric: 'tabular-nums' }}>
        {shown.map((l, i) => (
          <text key={i} x={r2(l.x)} y={r2(y + hb - px * 0.3)} textAnchor={l.anchor}>
            {l.text}
          </text>
        ))}
        {unit && (
          <text x={r2(unit.x)} y={r2(y + hb - px * 0.3)} textAnchor={unit.anchor} fontWeight={600}>
            {enhet}
          </text>
        )}
      </g>
      {/* Metallhaken i x1-enden av båndet */}
      <path
        d={`M${pt(hx - dir * hook, y - tab * 0.6)} H${r2(hx + dir * 0.5)} V${r2(y + hb)} H${r2(hx - dir * hook)} Z`}
        fill={SCENE.metal}
        stroke={SCENE.outline}
        strokeWidth={0.8 * ss}
      />
    </g>
  );
}

/* ---------------------------------------------------------------- Stoppeklokke */

export interface StoppeklokkeProps {
  /** Sentrum av urskiven. */
  x: number;
  y: number;
  /** Radius på kassen. Knappen og øyet øverst går 0,55 · r over kassen. */
  r: number;
  /** Tiden i sekunder. Viseren går én runde på 60 s. */
  t: number;
  /** Vis tiden digitalt i et lite vindu (standard på). */
  digital?: boolean;
  /** Desimaler i den digitale visningen. Standard 2. */
  desimaler?: number;
  dim?: boolean;
  title?: string;
}

/**
 * Analog stoppeklokke med sekundviser (én runde = 60 s) og digital visning av tiden. Ankerpunkt: sentrum av urskiven.
 *   <Stoppeklokke x={700} y={70} r={44} t={clock.t} />
 */
export function Stoppeklokke({ x, y, r, t, digital = true, desimaler = 2, dim, title }: StoppeklokkeProps) {
  const id = useSvgId('sc-klokke');
  const ss = useStrokeScale();
  const R = Math.max(8, num(r, 40));
  const time = Math.max(0, num(t, 0));
  const dec = clamp(Math.round(num(desimaler, 2)), 0, 3);
  const angle = ((time % 60) / 60) * 360;
  // Rund av først, så 59,996 s blir «1:00,00» og ikke «60,00 s».
  const tr = Math.round(time * 10 ** dec) / 10 ** dec;
  let text: string;
  if (tr < 60) text = `${fmt(tr, dec)} s`;
  else {
    const min = Math.floor(tr / 60);
    const sec = fmt(tr - min * 60, dec);
    text = `${min}:${sec.length < (dec ? dec + 3 : 2) ? `0${sec}` : sec}`;
  }
  const dial = R * 0.86;
  let major = '';
  let minor = '';
  for (let i = 0; i < 60; i++) {
    const a = (i * 6 - 90) * DEG;
    const big = i % 5 === 0;
    const r0 = dial * 0.96;
    const r1 = dial * (big ? 0.82 : 0.89);
    const seg = `M${pt(Math.cos(a) * r0, Math.sin(a) * r0)} L${pt(Math.cos(a) * r1, Math.sin(a) * r1)}`;
    if (big) major += seg;
    else minor += seg;
  }
  const npx = R * 0.2;
  const nums: [string, number, number][] = [
    ['60', 0, -dial * 0.62],
    ['15', dial * 0.62, 0],
    // «30» flyttes litt ned når vinduet er der, så det ikke rører vinduet
    ['30', 0, dial * (digital ? 0.68 : 0.62)],
    ['45', -dial * 0.62, 0],
  ];
  const hand = `M${pt(-R * 0.025, R * 0.12)} L${pt(-R * 0.012, -dial * 0.9)} L${pt(R * 0.012, -dial * 0.9)} L${pt(R * 0.025, R * 0.12)} Z`;
  const dW = dial * 1.12;
  const dH = R * 0.32;
  const dY = R * 0.32;
  const hand2 = PAINTS.rod;
  return (
    <g transform={`translate(${r2(num(x, 0))} ${r2(num(y, 0))})`} opacity={dim ? SCENE_DIM : undefined}>
      {title && <title>{title}</title>}
      <RadialGradient
        id={`${id}c`}
        fx={0.34}
        fy={0.3}
        stops={[
          [0, SCENE.metalLight],
          [0.55, SCENE.metal],
          [1, SCENE.metalDark],
        ]}
      />
      {/* Øye, krone og knapp */}
      <circle cx={0} cy={-R * 1.4} r={R * 0.13} fill="none" stroke={SCENE.outline} strokeWidth={R * 0.07 + 1.2 * ss} />
      <circle cx={0} cy={-R * 1.4} r={R * 0.13} fill="none" stroke={SCENE.metal} strokeWidth={R * 0.07} />
      <rect x={-R * 0.1} y={-R * 1.2} width={R * 0.2} height={R * 0.26} fill={SCENE.metalDark} stroke={SCENE.outline} strokeWidth={0.8 * ss} />
      <rect x={-R * 0.19} y={-R * 1.3} width={R * 0.38} height={R * 0.13} rx={R * 0.04} fill={`url(#${id}c)`} stroke={SCENE.outline} strokeWidth={0.8 * ss} />
      <rect
        x={-R * 0.08}
        y={-R * 1.16}
        width={R * 0.16}
        height={R * 0.2}
        fill={SCENE.metalDark}
        stroke={SCENE.outline}
        strokeWidth={0.8 * ss}
        transform={`rotate(45)`}
      />
      {/* Kasse og urskive */}
      <circle r={R} fill={`url(#${id}c)`} stroke={SCENE.outline} strokeWidth={1 * ss} />
      <circle r={dial} fill={MEK.dial} stroke={shade(SCENE.metal, 0.4)} strokeWidth={1 * ss} />
      <path d={minor} stroke={MEK.print} strokeWidth={Math.max(0.5, R * 0.012) * ss} opacity={0.75} />
      <path d={major} stroke={MEK.print} strokeWidth={Math.max(0.9, R * 0.028) * ss} />
      <g fill={MEK.print} fontWeight={650} fontSize={r2(npx)} textAnchor="middle" style={{ fontVariantNumeric: 'tabular-nums' }}>
        {npx >= 3 &&
          nums.map(([s, nx, ny]) => (
            <text key={s} x={r2(nx)} y={r2(ny + npx * 0.36)}>
              {s}
            </text>
          ))}
      </g>
      <g transform={`rotate(${r2(angle)})`}>
        <path d={hand} fill={hand2} stroke={shade(hand2, 0.35)} strokeWidth={0.5 * ss} strokeLinejoin="round" />
      </g>
      <circle r={R * 0.07} fill={hand2} stroke={shade(hand2, 0.35)} strokeWidth={0.6 * ss} />
      <circle r={R * 0.025} fill={SCENE.metalLight} />
      {/* Vinduet ligger over viseren, så tiden alltid kan leses (spissen synes utenfor) */}
      {digital && (
        <>
          <rect x={-dW / 2} y={dY - dH / 2} width={dW} height={dH} rx={dH * 0.18} fill={SCENE.display} stroke={shade(SCENE.metal, 0.35)} strokeWidth={0.7 * ss} />
          <ObjectText x={0} y={dY} w={dW * 0.9} h={dH * 0.95} text={text} color={SCENE.displayText} weight={650} max={14} />
        </>
      )}
      {/* Glasset */}
      <path
        d={`M${pt(Math.cos(195 * DEG) * dial * 0.86, Math.sin(195 * DEG) * dial * 0.86)} A${r2(dial * 0.86)},${r2(dial * 0.86)} 0 0 1 ${pt(Math.cos(250 * DEG) * dial * 0.86, Math.sin(250 * DEG) * dial * 0.86)}`}
        fill="none"
        stroke={alpha(SCENE.metalLight, 0.9)}
        strokeWidth={Math.max(0.8 * ss, R * 0.05)}
        strokeLinecap="round"
        opacity={0.7}
      />
    </g>
  );
}
