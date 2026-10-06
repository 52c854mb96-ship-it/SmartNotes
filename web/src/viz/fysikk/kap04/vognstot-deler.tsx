/**
 * Gjenstander til eksempeloppgaven «Godsvogner som kobles sammen» (k4-eks-vognstot), i samme stil som scene-kit-et
 * (toninger fra core.tsx, SCENE- og PAINTS-farger, kontur og myk skygge). Scene-kit-et har ingen jernbane, så den
 * ligger her:
 * - `Godsvogn`: toakslet containervogn sett fra siden, med buffere, automatisk kobling, hjulsatser med bladfjær,
 *   skiftetrinn og eventuelt en 20- eller 40-fots container. Ekte mål i meter (VOGN), tegnet i én skala P (px/m).
 * - `Jernbanespor`: pukk, betongsviller og to skinner i svakt perspektiv.
 * - `Terminal`: containerstabler, en kran og en lysmast i det fjerne (godsterminal), dempet med dis.
 * - `Innfelt`: innfelt panel med tittel (energistolper, forstørrelse og F-t-graf).
 */
import { memo, useMemo, type ReactNode } from 'react';
import { TSub, Txt, VIZ, fmt, superscript, useTextScale } from '../../kit';
import {
  ContactShadow,
  LinearGradient,
  PAINTS,
  Place,
  RadialGradient,
  SCENE,
  SCENE_DIM,
  alpha,
  materialStops,
  mix,
  sceneRandom,
  shade,
  tint,
  useStrokeScale,
  useSvgId,
} from '../../kit/scene';
import { BUFFER_STROKE, type WagonLoad } from './model-eks-vognstot';

/** Tall på standardform uansett størrelse: 14 529 → «1,45 · 10⁴» (fmtSci i kit-et skriver tall under 10⁵ vanlig). */
export function fmtPot(value: number, decimals = 2): string {
  if (!Number.isFinite(value)) return '–';
  if (value === 0) return '0';
  let exp = Math.floor(Math.log10(Math.abs(value)));
  let m = value / 10 ** exp;
  const f = 10 ** decimals;
  if (Math.abs(Math.round(m * f) / f) >= 10) {
    m /= 10;
    exp += 1;
  }
  return `${fmt(m, decimals)} · 10${superscript(exp)}`;
}

const r2 = (v: number) => (Number.isFinite(v) ? Math.round(v * 100) / 100 : 0);
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/* ================================================================================================
 * Godsvogn
 * ============================================================================================== */

/** Målene til containervogna og containerne i meter (toakslet vogn for én 40-fots container). */
export const VOGN = {
  /** Lengden over bufferne. Vogna er symmetrisk om midten mellom hjulene. */
  lengde: 14.0,
  /** Høyden til overkanten av rammen (lasteplanet) over skinnetoppen. */
  dekk: 1.2,
  /** Midten av bufferne over skinnetoppen. */
  buffer: 1.04,
  /** Hvor langt en buffer kan trykkes inn (samme som i modellen). */
  bufferslag: BUFFER_STROKE,
  hjulradius: 0.46,
  /** Avstanden mellom hjulsatsene. */
  akselavstand: 8.0,
  containerHoyde: 2.59,
  container40: 12.19,
  container20: 6.06,
} as const;

/** Høyden til det øverste på vogna (m): containertaket, eller tappene på en tom vogn. */
export function vognTopp(last: WagonLoad): number {
  return last === 'tom' ? VOGN.dekk + 0.06 : VOGN.dekk + VOGN.containerHoyde;
}

/** Omtrent hvor høyt tyngdepunktet ligger (m), til G-pila: tom vogn, med en 20-fots eller en full 40-fots container. */
export function vognTyngdepunkt(last: WagonLoad): number {
  return last === 'tom' ? 0.75 : last === 'container20' ? 1.35 : 1.9;
}

export interface GodsvognProps {
  /** Midt mellom hjulene, på skinnetoppen. */
  x: number;
  y: number;
  /** Skala: piksler per meter. */
  P: number;
  last: WagonLoad;
  /** Fargen på containeren (et navn fra PAINTS eller en CSS-farge). */
  lakk?: string;
  /** Hvor mye bufferne er trykt inn (0–1) i venstre og høyre ende. */
  bufferInn?: { venstre?: number; hoyre?: number };
  /** Om koblingen i hver ende har låst seg i koblingen på vogna ved siden av (låsebolten vises). */
  laast?: { venstre?: boolean; hoyre?: boolean };
  dim?: boolean;
  title?: string;
}

// Vogna tegnes i centimeter med origo på skinnetoppen midt mellom hjulene (y oppover er negativ).
const HALF_FRAME = 620;
const SOLE_TOP = -120;
const SOLE_BOT = -86;
const WHEEL_X = 400;
const WHEEL_R = 46;
const BUF_Y = -104;
/** Hvor langt bufferne stikker ut fra endebjelken (cm), så lengden over bufferne blir 2 · (620 + 80) = 1400. */
const BUF_OUT = 80;

/** Toakslet containervogn sett fra siden, som kjører mot høyre. Ankerpunkt: på skinnetoppen midt mellom hjulene. */
export const Godsvogn = memo(function Godsvogn({ x, y, P, last, lakk = 'blaa', bufferInn, laast, dim, title }: GodsvognProps) {
  const k = Math.max(0.01, P) / 100;
  const ssBase = useStrokeScale();
  const sw = (w: number) => (w * ssBase) / k;
  const id = useSvgId('godsvogn');
  const frame = mix(PAINTS.svart, PAINTS.graa, 0.38);
  const steel = SCENE.metalDark;
  const step = mix(PAINTS.gul, PAINTS.hvit, 0.15);
  const container = lakk in PAINTS ? PAINTS[lakk as keyof typeof PAINTS] : lakk;
  const cIn = { venstre: clamp(bufferInn?.venstre ?? 0, 0, 1), hoyre: clamp(bufferInn?.hoyre ?? 0, 0, 1) };

  const end = (dir: 1 | -1) => {
    const c = dir > 0 ? cIn.hoyre : cIn.venstre;
    const locked = dir > 0 ? !!laast?.hoyre : !!laast?.venstre;
    const X = (v: number) => r2(dir * v);
    const face = HALF_FRAME + BUF_OUT - VOGN.bufferslag * 100 * c; // bufferflaten
    const rect = (x0: number, x1: number, y0: number, y1: number) => {
      const a = Math.min(X(x0), X(x1));
      const b = Math.max(X(x0), X(x1));
      return { x: a, width: r2(b - a), y: y0, height: r2(y1 - y0) };
    };
    return (
      <g key={dir}>
        {/* Automatisk kobling under bufferne: skaft og koblingshode med fronten i flukt med bufferflaten */}
        <rect {...rect(HALF_FRAME, face - 22, -79, -71)} fill={shade(frame, 0.1)} stroke={SCENE.outline} strokeWidth={sw(0.6)} />
        <path
          d={`M${X(face - 24)},-88 L${X(face - 2)},-88 Q${X(face)},-88 ${X(face)},-85 L${X(face)},-74 L${X(face - 8)},-74 L${X(face - 8)},-68 L${X(face)},-68 L${X(face)},-64 Q${X(face)},-61 ${X(face - 2)},-61 L${X(face - 24)},-61 Z`}
          fill={`url(#${id}-kobling)`}
          stroke={SCENE.outline}
          strokeWidth={sw(0.7)}
          strokeLinejoin="round"
        />
        {locked && <circle cx={X(face - 13)} cy={-74.5} r={4.2} fill={tint(SCENE.metal, 0.2)} stroke={SCENE.outline} strokeWidth={sw(0.5)} />}
        {/* Endebjelken */}
        <rect {...rect(HALF_FRAME - 10, HALF_FRAME + 4, -127, -80)} rx={2} fill={shade(frame, 0.12)} stroke={SCENE.outline} strokeWidth={sw(0.8)} />
        {/* Bufferen: hylse, stempel og bufferskive */}
        <rect {...rect(HALF_FRAME + 4, HALF_FRAME + 44, BUF_Y - 15, BUF_Y + 15)} rx={3} fill={`url(#${id}-hylse)`} stroke={SCENE.outline} strokeWidth={sw(0.7)} />
        <rect {...rect(HALF_FRAME + 44, face - 7, BUF_Y - 11, BUF_Y + 11)} fill={`url(#${id}-stempel)`} stroke={SCENE.outline} strokeWidth={sw(0.6)} />
        <rect {...rect(face - 8, face, BUF_Y - 22, BUF_Y + 22)} rx={3} fill={`url(#${id}-skive)`} stroke={SCENE.outline} strokeWidth={sw(0.8)} />
        <line x1={X(face - 1.5)} y1={BUF_Y - 18} x2={X(face - 1.5)} y2={BUF_Y + 14} stroke={SCENE.highlight} strokeWidth={sw(0.9)} strokeLinecap="round" />
        {/* Skiftetrinn med håndtak */}
        <path d={`M${X(HALF_FRAME - 26)},${SOLE_BOT} L${X(HALF_FRAME - 26)},-40 M${X(HALF_FRAME - 64)},${SOLE_BOT} L${X(HALF_FRAME - 64)},-40`} stroke={shade(frame, 0.05)} strokeWidth={sw(1.6)} />
        <rect {...rect(HALF_FRAME - 70, HALF_FRAME - 18, -42, -36)} rx={1.5} fill={step} stroke={SCENE.outline} strokeWidth={sw(0.6)} />
        <path
          d={`M${X(HALF_FRAME - 64)},${SOLE_TOP + 4} L${X(HALF_FRAME - 64)},${SOLE_TOP - 10} L${X(HALF_FRAME - 26)},${SOLE_TOP - 10} L${X(HALF_FRAME - 26)},${SOLE_TOP + 4}`}
          fill="none"
          stroke={step}
          strokeWidth={sw(1.8)}
          strokeLinejoin="round"
        />
      </g>
    );
  };

  const wheel = (cx: number) => {
    const inner = cx > 0 ? -1 : 1; // mot midten av vogna
    return (
      <g key={cx}>
        {/* Bremseklossen på innsiden av hjulet, med henger opp til rammen */}
        <path d={`M${cx + inner * 60},${SOLE_BOT} L${cx + inner * 52},-52`} stroke={shade(frame, 0.05)} strokeWidth={sw(1.4)} />
        <path
          d={`M${cx + inner * 44},-70 Q${cx + inner * 56},-46 ${cx + inner * 44},-22 L${cx + inner * 52},-22 Q${cx + inner * 64},-46 ${cx + inner * 52},-70 Z`}
          fill={shade(steel, 0.25)}
          stroke={SCENE.outline}
          strokeWidth={sw(0.6)}
        />
        {/* Hjulet: flensen (bak skinna), slitebanen og hjulskiva */}
        <g clipPath={`url(#${id}-over)`}>
          <circle cx={cx} cy={-WHEEL_R} r={WHEEL_R + 4} fill={shade(steel, 0.35)} />
        </g>
        <circle cx={cx} cy={-WHEEL_R} r={WHEEL_R} fill={`url(#${id}-hjul)`} stroke={SCENE.outline} strokeWidth={sw(0.8)} />
        <circle cx={cx} cy={-WHEEL_R} r={WHEEL_R - 6} fill={`url(#${id}-skive)`} stroke={shade(steel, 0.3)} strokeWidth={sw(0.5)} />
        <circle cx={cx} cy={-WHEEL_R} r={WHEEL_R - 16} fill="none" stroke={shade(steel, 0.25)} strokeWidth={sw(0.6)} opacity={0.7} />
        <path
          d={`M${cx - 40},${-WHEEL_R - 12} A42,42 0 0 1 ${cx - 12},${-WHEEL_R - 40}`}
          fill="none"
          stroke={SCENE.highlight}
          strokeWidth={sw(1.2)}
          strokeLinecap="round"
          opacity={0.7}
        />
        {/* Akselgaffelen rundt akselkassa */}
        <path
          d={`M${cx - 32},${SOLE_BOT} L${cx - 30},-24 L${cx + 30},-24 L${cx + 32},${SOLE_BOT}`}
          fill="none"
          stroke={frame}
          strokeWidth={sw(2.4)}
          strokeLinejoin="round"
        />
        {/* Akselkassa med lokk */}
        <rect x={cx - 21} y={-66} width={42} height={38} rx={5} fill={`url(#${id}-kasse)`} stroke={SCENE.outline} strokeWidth={sw(0.7)} />
        <circle cx={cx} cy={-46} r={11} fill={tint(steel, 0.12)} stroke={SCENE.outline} strokeWidth={sw(0.5)} />
        <circle cx={cx} cy={-46} r={4} fill={shade(steel, 0.3)} />
        {/* Bladfjæra oppå akselkassa, med fjærhengere opp til rammen */}
        <path
          d={`M${cx - 96},-86 Q${cx},-70 ${cx + 96},-86 L${cx + 94},-81 Q${cx + 40},-73 ${cx + 22},-66 L${cx - 22},-66 Q${cx - 40},-73 ${cx - 94},-81 Z`}
          fill={`url(#${id}-fjaer)`}
          stroke={SCENE.outline}
          strokeWidth={sw(0.7)}
          strokeLinejoin="round"
        />
        <path d={`M${cx - 80},-80.5 Q${cx},-67 ${cx + 80},-80.5 M${cx - 58},-76 Q${cx},-65 ${cx + 58},-76`} fill="none" stroke={shade(steel, 0.4)} strokeWidth={sw(0.6)} />
        <rect x={cx - 11} y={-78} width={22} height={14} rx={2} fill={shade(steel, 0.2)} stroke={SCENE.outline} strokeWidth={sw(0.5)} />
        <path d={`M${cx - 98},-86 L${cx - 104},${SOLE_BOT - 2} M${cx + 98},-86 L${cx + 104},${SOLE_BOT - 2}`} stroke={shade(steel, 0.3)} strokeWidth={sw(1.6)} strokeLinecap="round" />
        <rect x={cx - 114} y={SOLE_BOT - 2} width={22} height={6} fill={frame} />
        <rect x={cx + 92} y={SOLE_BOT - 2} width={22} height={6} fill={frame} />
      </g>
    );
  };

  const cLen = last === 'container40' ? VOGN.container40 * 100 : last === 'container20' ? VOGN.container20 * 100 : 0;
  const cTop = SOLE_TOP - VOGN.containerHoyde * 100;
  const cL = -cLen / 2;
  const cR = cLen / 2;

  // Korrugeringen i containerveggen: lyse og mørke striper med fast avstand.
  const ribs = useMemo(() => {
    if (cLen <= 0) return { light: '', dark: '' };
    let light = '';
    let dark = '';
    for (let rx = cL + 26; rx < cR - 24; rx += 28) {
      light += `M${r2(rx)},${cTop + 10}h5v${VOGN.containerHoyde * 100 - 20}h-5Z`;
      dark += `M${r2(rx + 11)},${cTop + 10}h5v${VOGN.containerHoyde * 100 - 20}h-5Z`;
    }
    return { light, dark };
  }, [cLen, cL, cR, cTop]);

  return (
    <Place x={x} y={y} scale={k} opacity={dim ? SCENE_DIM : undefined}>
      {title && <title>{title}</title>}
      <LinearGradient id={`${id}-ramme`} stops={materialStops(frame, 1.2)} />
      <LinearGradient id={`${id}-hylse`} stops={materialStops(shade(frame, 0.05), 1.4)} />
      <LinearGradient id={`${id}-stempel`} stops={[[0, SCENE.metalLight], [0.45, SCENE.metal], [1, SCENE.metalDark]]} />
      <LinearGradient id={`${id}-skive`} x2={1} y2={1} stops={[[0, tint(SCENE.metal, 0.25)], [0.6, SCENE.metal], [1, shade(SCENE.metalDark, 0.15)]]} />
      <LinearGradient id={`${id}-kobling`} stops={materialStops(shade(frame, 0.05), 1.3)} />
      <LinearGradient id={`${id}-kasse`} stops={materialStops(shade(steel, 0.15), 1.2)} />
      <LinearGradient id={`${id}-fjaer`} stops={materialStops(shade(steel, 0.1), 1.3)} />
      <RadialGradient id={`${id}-hjul`} stops={[[0.75, shade(steel, 0.2)], [0.92, steel], [1, shade(steel, 0.4)]]} />
      <defs>
        <clipPath id={`${id}-over`}>
          <rect x={-800} y={-300} width={1600} height={299} />
        </clipPath>
      </defs>
      <ContactShadow cx={0} cy={0} rx={650} ry={12} opacity={0.8} />

      {/* Containeren */}
      {cLen > 0 && (
        <g>
          <LinearGradient id={`${id}-container`} stops={materialStops(container, 1.1)} />
          <rect x={cL} y={cTop} width={cLen} height={VOGN.containerHoyde * 100} fill={`url(#${id}-container)`} />
          <path d={ribs.light} fill={SCENE.highlight} opacity={0.45} />
          <path d={ribs.dark} fill={shade(container, 0.35)} opacity={0.4} />
          {/* Toppskinne, bunnskinne og hjørnestolper */}
          <rect x={cL} y={cTop} width={cLen} height={9} fill={shade(container, 0.18)} />
          <rect x={cL} y={SOLE_TOP - 10} width={cLen} height={10} fill={shade(container, 0.32)} />
          <rect x={cL} y={cTop} width={13} height={VOGN.containerHoyde * 100} fill={shade(container, 0.2)} />
          <rect x={cR - 13} y={cTop} width={13} height={VOGN.containerHoyde * 100} fill={shade(container, 0.2)} />
          {/* Merking (containernummer) øverst til høyre */}
          <rect x={cR - 150} y={cTop + 22} width={118} height={11} rx={2} fill={tint(container, 0.75)} opacity={0.7} />
          <rect x={cR - 112} y={cTop + 39} width={80} height={9} rx={2} fill={tint(container, 0.75)} opacity={0.6} />
          {/* Hjørnebeslag */}
          {[cL, cR - 17].map((hx) =>
            [cTop, SOLE_TOP - 13].map((hy) => (
              <g key={`${hx}-${hy}`}>
                <rect x={hx} y={hy} width={17} height={13} rx={1.5} fill={shade(container, 0.45)} />
                <ellipse cx={hx + 8.5} cy={hy + 6.5} rx={4.5} ry={2.6} fill={shade(container, 0.75)} />
              </g>
            )),
          )}
          <rect x={cL} y={cTop} width={cLen} height={VOGN.containerHoyde * 100} fill="none" stroke={SCENE.outline} strokeWidth={sw(0.9)} />
        </g>
      )}
      {/* Tappene (twistlock) som containerne låses fast i, der det ikke står noen container */}
      {[-603, -300, 300, 603]
        .filter((tx) => cLen <= 0 || tx < cL - 5 || tx > cR + 5)
        .map((tx) => (
          <path key={tx} d={`M${tx - 9},${SOLE_TOP} L${tx - 6},${SOLE_TOP - 7} L${tx + 6},${SOLE_TOP - 7} L${tx + 9},${SOLE_TOP} Z`} fill={step} stroke={SCENE.outline} strokeWidth={sw(0.5)} />
        ))}

      {/* Rammen (langdrageren) med avstivere */}
      <rect x={-HALF_FRAME} y={SOLE_TOP} width={HALF_FRAME * 2} height={SOLE_BOT - SOLE_TOP} fill={`url(#${id}-ramme)`} stroke={SCENE.outline} strokeWidth={sw(0.9)} />
      <line x1={-HALF_FRAME + 4} y1={SOLE_TOP + 2.5} x2={HALF_FRAME - 4} y2={SOLE_TOP + 2.5} stroke={SCENE.highlight} strokeWidth={sw(1)} />
      <path
        d={Array.from({ length: 9 }, (_, i) => `M${-480 + i * 120},${SOLE_TOP + 4}V${SOLE_BOT - 3}`).join('')}
        stroke={shade(frame, 0.35)}
        strokeWidth={sw(0.8)}
        opacity={0.8}
      />
      {/* Et lite merkeskilt midt på rammen */}
      <rect x={-46} y={SOLE_TOP + 8} width={92} height={18} rx={2} fill={tint(frame, 0.55)} opacity={0.55} />

      {end(-1)}
      {end(1)}
      {wheel(-WHEEL_X)}
      {wheel(WHEEL_X)}
    </Place>
  );
});

/* ================================================================================================
 * Jernbanespor
 * ============================================================================================== */

/** Hvor mye dybde (bort fra betrakteren) trykkes sammen i høyden: et punkt d meter bak den nære skinna står q·d·P høyere. */
const DEPTH_Q = 0.22;
const RAIL_H = 0.172;

/** Hvor langt under skinnetoppen bakken foran sporet ligger (figurens enheter). */
export function sporFot(P: number): number {
  return (RAIL_H + 0.45) * P + 2.0 * DEPTH_Q * P;
}

/**
 * Jernbanespor sett fra siden og litt ovenfra: pukk, betongsviller (0,6 m mellom), og to skinner. `y` er toppen av den
 * nære skinna, der hjulene står. Pukkskulderen går ned til y + sporFot(P), der bakken (Underlag) kan begynne.
 */
export const Jernbanespor = memo(function Jernbanespor({ x1, x2, y, P, seed = 3 }: { x1: number; x2: number; y: number; P: number; seed?: number }) {
  const id = useSvgId('spor');
  const ss = useStrokeScale();
  const q = DEPTH_Q * P;
  const base = y + RAIL_H * P; // svilletoppen / pukktoppen rett under den nære skinna
  const farEdge = base - 2.4 * q;
  const nearEdge = base + 1.0 * q;
  const toe = y + sporFot(P);
  const sleeperFar = base - 2.0 * q;
  const sleeperNear = base + 0.6 * q;
  const farRail = y - 1.435 * q;
  const rh = RAIL_H * P;

  const stones = useMemo(() => {
    const rand = sceneRandom(seed * 7919 + 11);
    const tones: string[] = ['', '', ''];
    const r = Math.max(0.8, 0.045 * P);
    const area = (x2 - x1) * (toe - farEdge);
    const n = Math.min(2600, Math.round(area / (r * r * 7)));
    for (let i = 0; i < n; i++) {
      const sx = x1 + rand() * (x2 - x1);
      const sy = farEdge + rand() * (toe - farEdge);
      // Skulderen skrår: hold steinene innenfor
      const t = rand();
      const rr = r * (0.6 + rand() * 0.7);
      const j = t < 0.4 ? 0 : t < 0.75 ? 1 : 2;
      tones[j] += `M${r2(sx - rr)},${r2(sy)}a${r2(rr)},${r2(rr * 0.7)} 0 1 0 ${r2(2 * rr)},0a${r2(rr)},${r2(rr * 0.7)} 0 1 0 ${r2(-2 * rr)},0`;
    }
    return tones;
  }, [x1, x2, farEdge, toe, P, seed]);

  const sleepers = useMemo(() => {
    let top = '';
    let face = '';
    const sw = 0.26 * P;
    const gap = 0.6 * P;
    for (let sx = x1 - ((x1 % gap) + gap) % gap; sx < x2; sx += gap) {
      top += `M${r2(sx)},${r2(sleeperFar)}h${r2(sw)}V${r2(sleeperNear)}h${r2(-sw)}Z`;
      face += `M${r2(sx)},${r2(sleeperNear)}h${r2(sw)}v${r2(0.07 * P)}h${r2(-sw)}Z`;
    }
    return { top, face };
  }, [x1, x2, P, sleeperFar, sleeperNear]);

  const w = x2 - x1;
  return (
    <g aria-hidden>
      <LinearGradient id={`${id}-skulder`} stops={materialStops(SCENE.stone, 1.2)} />
      <LinearGradient id={`${id}-skinne`} stops={[[0, tint(SCENE.metal, 0.5)], [0.3, SCENE.metal], [0.42, shade(SCENE.metalDark, 0.35)], [1, shade(SCENE.metalDark, 0.2)]]} />
      {/* Pukken: toppflaten og skulderen foran */}
      <rect x={x1} y={farEdge} width={w} height={nearEdge - farEdge} fill={tint(SCENE.stone, 0.12)} />
      <path d={`M${x1},${nearEdge} L${x2},${nearEdge} L${x2},${toe} L${x1},${toe} Z`} fill={`url(#${id}-skulder)`} />
      <path d={stones[0]} fill={shade(SCENE.stone, 0.18)} opacity={0.75} />
      <path d={stones[1]} fill={tint(SCENE.stone, 0.3)} opacity={0.7} />
      <path d={stones[2]} fill={SCENE.stoneDark} opacity={0.6} />
      {/* Svillene */}
      <path d={sleepers.top} fill={tint(SCENE.concrete, 0.05)} stroke={shade(SCENE.concreteDark, 0.25)} strokeWidth={0.6 * ss} />
      <path d={sleepers.face} fill={SCENE.concreteDark} />
      {/* Den fjerne skinna og den nære */}
      <rect x={x1} y={farRail} width={w} height={rh} fill={`url(#${id}-skinne)`} opacity={0.9} />
      <rect x={x1} y={y} width={w} height={rh} fill={`url(#${id}-skinne)`} />
      <line x1={x1} y1={y + 0.4} x2={x2} y2={y + 0.4} stroke={SCENE.metalLight} strokeWidth={Math.max(0.8, 0.03 * P) * ss} opacity={0.9} />
      <line x1={x1} y1={y + rh} x2={x2} y2={y + rh} stroke={SCENE.outline} strokeWidth={0.7 * ss} opacity={0.7} />
    </g>
  );
});

/* ================================================================================================
 * Godsterminalen i det fjerne
 * ============================================================================================== */

const STACK_COLORS: (keyof typeof PAINTS)[] = ['rod', 'blaa', 'graa', 'gronn', 'hvit', 'oransje', 'blaa', 'rod', 'gul', 'graa'];

/**
 * Containerstabler, en containerkran og en lysmast i det fjerne, med dis (blandet med himmelfargen). (x1, x2) er
 * området, `y` horisonten (foten av stablene), `p` skalaen i det fjerne (px/m, standard 7).
 */
export const Terminal = memo(function Terminal({ x1, x2, y, p = 7, seed = 5 }: { x1: number; x2: number; y: number; p?: number; seed?: number }) {
  const ss = useStrokeScale();
  const haze = (c: string, t = 0.5) => mix(c, SCENE.skyBottom, t);
  const items = useMemo(() => {
    const rand = sceneRandom(seed * 104729 + 3);
    const out: { x: number; w: number; level: number; color: keyof typeof PAINTS }[] = [];
    const h = 2.59 * p;
    let cx = x1 + 6;
    let ci = 0;
    while (cx < x2 - 20) {
      // Et kvartal med stabler, så en åpning
      const blockEnd = Math.min(x2 - 4, cx + (150 + rand() * 120) * (p / 7));
      while (cx < blockEnd) {
        const long = rand() < 0.65;
        const w = (long ? 12.19 : 6.06) * p;
        if (cx + w > blockEnd) break;
        const levels = 1 + Math.floor(rand() * 3.2);
        for (let lv = 0; lv < levels; lv++) {
          out.push({ x: cx, w, level: lv, color: STACK_COLORS[(ci + lv * 3) % STACK_COLORS.length] ?? 'graa' });
        }
        ci++;
        cx += w + 0.4 * p;
      }
      cx += (60 + rand() * 80) * (p / 7);
    }
    return { out, h };
  }, [x1, x2, p, seed]);

  // Containerkran (portalkran) og en lysmast, enda lenger unna
  const kp = p * 0.75;
  const craneX = x1 + (x2 - x1) * 0.66;
  const craneW = 34 * kp;
  const craneH = 30 * kp;
  const craneColor = haze(PAINTS.blaa, 0.64);
  const mastX = x1 + (x2 - x1) * 0.18;
  const mastH = 26 * kp;
  return (
    <g aria-hidden>
      {/* Lysmasten */}
      <line x1={mastX} y1={y} x2={mastX} y2={y - mastH} stroke={haze(PAINTS.graa, 0.55)} strokeWidth={1.6 * ss} />
      <rect x={mastX - 7} y={y - mastH - 4} width={14} height={5} rx={1} fill={haze(PAINTS.graa, 0.5)} />
      {/* Portalkranen: to bein, bjelke over sporene og en løpekatt */}
      <g fill="none" stroke={craneColor} strokeWidth={2.2 * ss} strokeLinejoin="round">
        <path d={`M${r2(craneX)},${y} L${r2(craneX + 3 * kp)},${r2(y - craneH)} L${r2(craneX + 6 * kp)},${y}`} />
        <path d={`M${r2(craneX + craneW)},${y} L${r2(craneX + craneW - 3 * kp)},${r2(y - craneH)} L${r2(craneX + craneW - 6 * kp)},${y}`} />
        <path d={`M${r2(craneX - 8 * kp)},${r2(y - craneH)} L${r2(craneX + craneW + 8 * kp)},${r2(y - craneH)}`} strokeWidth={4 * ss} />
        <path d={`M${r2(craneX + 1.5 * kp)},${r2(y - craneH * 0.5)} L${r2(craneX + craneW - 1.5 * kp)},${r2(y - craneH * 0.5)}`} strokeWidth={1.2 * ss} />
      </g>
      <rect x={r2(craneX + craneW * 0.42)} y={r2(y - craneH - 3.4 * kp)} width={r2(6 * kp)} height={r2(3 * kp)} fill={craneColor} />
      <line x1={r2(craneX + craneW * 0.42 + 3 * kp)} y1={r2(y - craneH)} x2={r2(craneX + craneW * 0.42 + 3 * kp)} y2={r2(y - craneH * 0.42)} stroke={craneColor} strokeWidth={1 * ss} />
      {/* Containerstablene */}
      {items.out.map((c, i) => {
        const top = y - (c.level + 1) * items.h;
        const col = haze(PAINTS[c.color], 0.58);
        return (
          <g key={i}>
            <rect x={r2(c.x)} y={r2(top)} width={r2(c.w)} height={r2(items.h)} fill={col} stroke={haze(SCENE.outline, 0.4)} strokeWidth={0.6 * ss} />
            <rect x={r2(c.x)} y={r2(top)} width={r2(c.w)} height={r2(items.h * 0.16)} fill={shade(col, 0.12)} />
            <path
              d={Array.from({ length: Math.max(1, Math.floor(c.w / 9)) }, (_, j) => `M${r2(c.x + (j + 0.5) * (c.w / Math.max(1, Math.floor(c.w / 9))))},${r2(top + 3)}v${r2(items.h - 5)}`).join('')}
              stroke={shade(col, 0.15)}
              strokeWidth={0.6 * ss}
              opacity={0.6}
            />
          </g>
        );
      })}
    </g>
  );
});

/* ================================================================================================
 * Innfelt panel og energistolper
 * ============================================================================================== */

/** Høyden på tittellinja i et innfelt panel (figurens enheter). */
export const innfeltTittel = (f: number) => 14 + 17 * f;

/** Innfelt panel (kort) med tittel. (x, y) er øverste venstre hjørne. */
export function Innfelt({ x, y, w, h, title, children }: { x: number; y: number; w: number; h: number; title: ReactNode; children?: ReactNode }) {
  const ss = useStrokeScale();
  const f = useTextScale();
  return (
    <g>
      <rect x={x + 3} y={y + 4} width={w} height={h} rx={10} fill={alpha(SCENE.shadow, 0.35)} />
      <rect x={x} y={y} width={w} height={h} rx={10} fill={VIZ.surface} opacity={0.97} stroke={SCENE.outline} strokeWidth={1 * ss} />
      <Txt x={x + 12} y={y + 6 + 15 * f} anchor="start" size={0.85} weight={700}>
        {title}
      </Txt>
      {children}
    </g>
  );
}

/** Høyden energistolpene trenger (figurens enheter). */
export function energiHoyde(f: number): number {
  const line = 17 * f;
  const barH = Math.round(18 + 4 * f);
  return 4 + 2 * barH + 14 + 10 + line * 0.8 + line * 0.95 + 6;
}

/**
 * To liggende stolper for den samlede kinetiske energien før og etter støtet (kJ). Med `tapt` vises energien som er
 * omdannet, skravert, så «etter»-stolpen blir like lang som «før»-stolpen. (x, y) er øverste venstre hjørne.
 */
export function EnergiStolper({ x, y, w, before, after, tapt }: { x: number; y: number; w: number; before: number; after: number; tapt: boolean }) {
  const hatch = useSvgId('vognstot-tapt');
  const ss = useStrokeScale();
  const f = useTextScale();
  const line = 17 * f;
  const labelW = 50 * f;
  const valueW = 74 * f;
  const x0 = x + labelW;
  const x1 = x + w - valueW;
  const k = before > 0 ? (x1 - x0) / before : 0;
  const barH = Math.round(18 + 4 * f);
  const y1 = y + 4;
  const y2 = y1 + barH + 14;
  const wAfter = Math.max(2.5, after * k);
  const lost = before - after;
  const share = before > 0 ? lost / before : 0;
  const kJ = (v: number) => `${fmt(v / 1000, 1)} kJ`;
  const row = (yy: number, label: string) => (
    <Txt x={x} y={yy + barH / 2 + line * 0.3} anchor="start" size={0.82} muted>
      {label}
    </Txt>
  );
  const value = (yy: number, text: string) => (
    <Txt x={x1 + 8} y={yy + barH / 2 + line * 0.3} anchor="start" size={0.82} weight={700}>
      {text}
    </Txt>
  );
  const ly = y2 + barH + 10 + line * 0.8;
  const sq = 10 * f;
  return (
    <g>
      <defs>
        <pattern id={hatch} width={8} height={8} patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <rect width={8} height={8} fill={alpha(VIZ.muted, 0.08)} />
          <line x1={0} y1={0} x2={0} y2={8} stroke={VIZ.muted} strokeWidth={2.2} opacity={0.6} />
        </pattern>
      </defs>
      {row(y1, 'Før')}
      <rect x={x0} y={y1} width={r2(before * k)} height={barH} fill={VIZ.velocity} stroke={SCENE.outline} strokeWidth={1 * ss} />
      {value(y1, kJ(before))}
      {row(y2, 'Etter')}
      {tapt && (
        <g>
          <rect x={x0 + wAfter} y={y2} width={r2(Math.max(0, x1 - x0 - wAfter))} height={barH} fill={`url(#${hatch})`} />
          <rect
            x={x0 + wAfter + 0.75}
            y={y2 + 0.75}
            width={r2(Math.max(0, x1 - x0 - wAfter - 1.5))}
            height={barH - 1.5}
            fill="none"
            stroke={VIZ.muted}
            strokeWidth={1.3 * ss}
            strokeDasharray="5 3"
          />
        </g>
      )}
      <rect x={x0} y={y2} width={r2(wAfter)} height={barH} fill={VIZ.velocity} stroke={SCENE.outline} strokeWidth={1 * ss} />
      {value(y2, kJ(after))}
      <circle cx={x0 + sq / 2} cy={ly - line * 0.3} r={sq / 2} fill={VIZ.velocity} stroke={SCENE.outline} strokeWidth={1 * ss} />
      <Txt x={x0 + sq + 6} y={ly} anchor="start" size={0.78}>
        kinetisk energi E<TSub>k</TSub>
      </Txt>
      {tapt && (
        <>
          <rect x={x0} y={ly + line * 0.95 - sq * 0.8} width={sq} height={sq} fill={`url(#${hatch})`} stroke={VIZ.muted} strokeWidth={1 * ss} />
          <Txt x={x0 + sq + 6} y={ly + line * 0.95} anchor="start" size={0.78} weight={650}>
            omdannet: {kJ(lost)} ({fmt(share * 100, 1)} %)
          </Txt>
        </>
      )}
    </g>
  );
}
