/**
 * Scene-kit, familien «mekanikk»: kasse, kloss, ball, curlingstein, trinse, tau, snor, fjær, strikk, kraftmåler,
 * badevekt, bord, rampe, lodd, målebånd og stoppeklokke – tegnet som lærebokillustrasjoner (lys fra øvre venstre,
 * myk skygge, tynn kontur), så kraftpilene fra overlay.tsx kan ligge oppå.
 *
 *   <Rampe x={80} y={300} lengde={420} vinkel={25} />
 *   <Kasse {...rampePunkt({ x: 80, y: 300, vinkel: 25 }, 220)} w={90} h={70} label="20 kg" />
 *
 * Ankerpunkt: gjenstander som står på noe, har (x, y) midt på bunnen, så `rotate` dreier dem om kontaktflaten.
 * Alle mål er i figurens enheter. Gjenstandene vokser ikke på mobil (kapittelet styrer størrelsen), men streker og
 * tekst på dem gjør det.
 */
import './mekanikk.css';
import { useTextScale } from '../controls';
import {
  ContactShadow,
  LinearGradient,
  Place,
  RadialGradient,
  SCENE_DIM,
  materialStops,
  mix,
  sceneRandom,
  shade,
  sphereStops,
  tint,
  useStrokeScale,
  useSvgId,
  type SceneObjectProps,
} from './core';
import { MEK, DEG, ObjectText, clamp, num, pt, r2 } from './mekanikk-felles';
import { PAINTS, SCENE, paint, type PaintName } from './palette';

export { Trinse, Tau, Snor, Fjaer, Strikk } from './mekanikk-tau';
export type { TrinseProps, TauProps, FjaerProps, StrikkProps } from './mekanikk-tau';
export { Kraftmaaler, Badevekt, Maalebaand, Stoppeklokke } from './mekanikk-maal';
export type { KraftmaalerProps, BadevektProps, MaalebaandProps, StoppeklokkeProps } from './mekanikk-maal';

/**
 * Lys venstre kant og litt mørkere høyre kant (lys fra øvre venstre), lagt oppå en flate. Midten er uendret, så
 * flaten ser flat ut. Tegnes alltid utenfor `flip`, så lyset ikke speilvendes.
 */
function SideShade({ id, x, y, w, h, rx = 0, strength = 1 }: { id: string; x: number; y: number; w: number; h: number; rx?: number; strength?: number }) {
  return (
    <>
      <LinearGradient
        id={id}
        x2={1}
        y2={0}
        stops={[
          [0, SCENE.highlight, 0.4 * strength],
          [0.25, SCENE.highlight, 0],
          [0.8, SCENE.shadow, 0],
          [1, SCENE.shadow, 0.5 * strength],
        ]}
      />
      <rect x={x} y={y} width={w} height={h} rx={rx} fill={`url(#${id})`} />
    </>
  );
}

/* ---------------------------------------------------------------- Kasse */

export interface KasseProps extends Omit<SceneObjectProps, 'size'> {
  /** Bredde i figurens enheter. */
  w: number;
  /** Høyde i figurens enheter. */
  h: number;
  /** Trekasse med planker og skråstag, eller pappeske med teip. Standard «tre». */
  materiale?: 'tre' | 'papp';
  /** Kort tekst på en lapp på siden, f.eks. «20 kg» eller «m». */
  label?: string;
  /**
   * Hvor lappen sitter: «midt» (standard) eller «oppe-venstre», som holder midtlinjene fri, så kraftpiler som starter
   * midt i kassen ikke dekker teksten.
   */
  labelPlass?: 'midt' | 'oppe-venstre';
  /** Myk skygge under kassen (standard på). Slå av når kassen henger eller flyr. */
  skygge?: boolean;
}

/**
 * Kasse i tre (planker, ramme og skråstag) eller papp (med teip). Ankerpunkt: (x, y) midt på bunnen, så den kan
 * settes rett på et underlag og dreies med en rampe. `flip` speilvender skråstaget; lyset kommer alltid fra øvre
 * venstre, og lappen blir der `labelPlass` sier.
 *   <Kasse x={300} y={260} w={110} h={80} label="20 kg" />
 *   <Kasse {...rampePunkt(rampe, 180)} w={70} h={56} materiale="papp" />
 */
export function Kasse({ x, y, w, h, materiale = 'tre', label, labelPlass = 'midt', rotate, flip, dim, title, skygge = true }: KasseProps) {
  const id = useSvgId('sc-kasse');
  const ss = useStrokeScale();
  const f = useTextScale();
  const W = Math.max(4, num(w, 60));
  const H = Math.max(4, num(h, 50));
  const L = -W / 2;
  const T = -H;
  const rx = Math.min(2, W * 0.03);
  // Bare skråstaget og årringene speilvendes; lys, skygge og lapp står fast.
  const mirror = flip ? 'scale(-1 1)' : undefined;

  let body;
  if (materiale === 'papp') {
    const tw = clamp(W * 0.16, 4, 40);
    const top = Math.min(H * 0.3, 40);
    const bot = Math.min(H * 0.16, 22);
    const tooth = tw / 3;
    const jag = Math.max(1.2, tw * 0.07);
    body = (
      <>
        <LinearGradient id={`${id}a`} stops={materialStops(MEK.papp, 0.8)} />
        <rect x={L} y={T} width={W} height={H} rx={rx} fill={`url(#${id}a)`} />
        {/* Brettekanter ved hjørnene */}
        <path
          d={`M${pt(L + W * 0.025, T + 1.5)} V${r2(-1.5)} M${pt(-L - W * 0.025, T + 1.5)} V${r2(-1.5)}`}
          stroke={MEK.pappDark}
          strokeWidth={0.8 * ss}
          opacity={0.5}
        />
        {/* Teip over lokket og under bunnen, med takket ende */}
        <path
          d={`M${pt(-tw / 2, T)} H${r2(tw / 2)} V${r2(T + top)} L${pt(tw / 2 - tooth / 2, T + top - jag)} L${pt(tw / 2 - tooth, T + top)} L${pt(-tw / 2 + tooth, T + top - jag)} L${pt(-tw / 2 + tooth / 2, T + top)} L${pt(-tw / 2, T + top - jag)} Z`}
          fill={MEK.teip}
          stroke={shade(MEK.teip, 0.25)}
          strokeWidth={0.6 * ss}
        />
        <path
          d={`M${pt(-tw / 2, 0)} H${r2(tw / 2)} V${r2(-bot)} L${pt(0, -bot + jag)} L${pt(-tw / 2, -bot)} Z`}
          fill={MEK.teip}
          stroke={shade(MEK.teip, 0.25)}
          strokeWidth={0.6 * ss}
        />
        <path
          d={`M${pt(-tw * 0.28, T + 1)} V${r2(T + top - jag * 1.5)} M${pt(-tw * 0.28, -1)} V${r2(-bot + jag * 1.5)}`}
          stroke={SCENE.highlight}
          strokeWidth={Math.max(0.8 * ss, tw * 0.12)}
          strokeLinecap="round"
        />
      </>
    );
  } else {
    const b = clamp(Math.min(W, H) * 0.13, 2.5, 16);
    const iL = L + b;
    const iR = -L - b;
    const iT = T + b;
    const iB = -b;
    const iw = iR - iL;
    const ih = iB - iT;
    const t = b * 0.45;
    const diag = Math.hypot(iw, ih);
    const bv = Math.min(ih * 0.4, (t * diag) / Math.max(1, iw));
    const bh = Math.min(iw * 0.4, (t * diag) / Math.max(1, ih));
    const seam = shade(SCENE.wood, 0.5);
    const wood = mix(SCENE.wood, SCENE.woodLight, 0.45);
    const nail = Math.max(0.7, b * 0.1);
    const grain = (yy: number) => `M${pt(L + W * 0.07, yy)} q${r2(W * 0.18)},${r2(-b * 0.18)} ${r2(W * 0.36)},0 t${r2(W * 0.36)},0`;
    body = (
      <>
        <LinearGradient id={`${id}a`} stops={materialStops(shade(SCENE.wood, 0.2))} />
        <LinearGradient id={`${id}b`} stops={materialStops(wood, 0.8)} />
        <rect x={L} y={T} width={W} height={H} rx={rx} fill={`url(#${id}a)`} />
        {ih > b * 2.6 && (
          <path d={`M${pt(iL, iT + ih / 3)} H${r2(iR)} M${pt(iL, iT + (2 * ih) / 3)} H${r2(iR)}`} stroke={seam} strokeWidth={0.8 * ss} opacity={0.7} />
        )}
        {iw > b * 1.5 && ih > b * 1.5 && (
          <path
            d={`M${pt(iL, iB)} L${pt(iL + bh, iB)} L${pt(iR, iT + bv)} L${pt(iR, iT)} L${pt(iR - bh, iT)} L${pt(iL, iB - bv)} Z`}
            fill={`url(#${id}b)`}
            stroke={seam}
            strokeWidth={0.7 * ss}
            transform={mirror}
          />
        )}
        <g fill={`url(#${id}b)`} stroke={seam} strokeWidth={0.7 * ss}>
          <rect x={L} y={T} width={W} height={b} />
          <rect x={L} y={-b} width={W} height={b} />
          <rect x={L} y={iT} width={b} height={ih} />
          <rect x={iR} y={iT} width={b} height={ih} />
        </g>
        <path d={`${grain(T + b * 0.5)} ${grain(-b * 0.45)}`} fill="none" stroke={seam} strokeWidth={0.6 * ss} opacity={0.45} transform={mirror} />
        <g fill={SCENE.metalDark}>
          <circle cx={L + b / 2} cy={T + b / 2} r={nail} />
          <circle cx={-L - b / 2} cy={T + b / 2} r={nail} />
          <circle cx={L + b / 2} cy={-b / 2} r={nail} />
          <circle cx={-L - b / 2} cy={-b / 2} r={nail} />
        </g>
      </>
    );
  }

  // Lapp med tekst: midt på siden, eller i øvre venstre kvadrant (fri for kraftpiler fra midten)
  let tag = null;
  if (label) {
    const corner = labelPlass === 'oppe-venstre';
    const px = 14 * f;
    const maxW = corner ? W * 0.42 : W * 0.8;
    const ph = Math.min(H * (corner ? 0.3 : 0.42), px * 1.45);
    const pw = Math.min(maxW, label.length * px * 0.6 + px * 0.9);
    const cx = corner ? -W * 0.06 - pw / 2 : 0;
    const cy = corner ? -H + Math.max(H * 0.1, Math.min(W, H) * 0.13 + 1) + ph / 2 : -H / 2;
    tag = (
      <g>
        <rect x={cx - pw / 2} y={cy - ph / 2} width={pw} height={ph} rx={Math.min(2, ph * 0.15)} fill={MEK.paper} stroke={shade(MEK.paper, 0.35)} strokeWidth={0.7 * ss} />
        <ObjectText x={cx} y={cy} w={pw * 0.88} h={ph * 0.82} text={label} color={MEK.print} />
      </g>
    );
  }

  return (
    <Place x={x} y={y} rotate={rotate} opacity={dim ? SCENE_DIM : undefined}>
      {title && <title>{title}</title>}
      {skygge && <ContactShadow cx={0} cy={0} rx={W * 0.6} />}
      {body}
      <SideShade id={`${id}s`} x={L} y={T} w={W} h={H} rx={rx} strength={materiale === 'papp' ? 0.8 : 1} />
      {tag}
      <rect x={L} y={T} width={W} height={H} rx={rx} fill="none" stroke={SCENE.outline} strokeWidth={1 * ss} />
      <line x1={L + 1.5} y1={T + 0.9 * ss} x2={-L - 1.5} y2={T + 0.9 * ss} stroke={SCENE.highlight} strokeWidth={1.2 * ss} strokeLinecap="round" />
    </Place>
  );
}

/* ---------------------------------------------------------------- Kloss */

export type KlossMateriale = 'tre' | 'metall' | 'stein' | 'gummi' | 'is' | 'plast';

export interface KlossProps extends Omit<SceneObjectProps, 'size'> {
  /** Bredde i figurens enheter. */
  w: number;
  /** Høyde i figurens enheter. */
  h: number;
  materiale: KlossMateriale;
  /** Kort tekst på klossen, f.eks. «A», «m» eller «2,0 kg». */
  label?: string;
  /** Hvor teksten står: «midt» (standard) eller «oppe-venstre», som holder midtlinjene fri for kraftpiler. */
  labelPlass?: 'midt' | 'oppe-venstre';
  /** Fargen på en plastkloss (navn fra PAINTS eller en CSS-farge). Standard «gul». */
  farge?: PaintName | string;
  /**
   * Øyeskrue midt på siden, til en snor. Øyet har radius rr = min(6, max(2,5, 0,1 · h)) og sentrum i
   * (x ± (w/2 + 1,9 · rr), y − h/2). La snora ende i ytterkanten av øyet, (x ± (w/2 + 2,9 · rr), y − h/2) (før
   * `rotate`), så ser den ut som den er knyttet i det. Sidene følger navnet, også med `flip`.
   */
  krok?: 'venstre' | 'hoyre' | 'begge';
  /** Myk skygge under klossen (standard på). */
  skygge?: boolean;
}

/**
 * Kloss som i fysikkoppgaver, men i ekte materiale: tre, metall, stein, gummi, is eller plast. Ankerpunkt: (x, y)
 * midt på bunnen. `flip` speilvender bare teksturen (årringer, korn, sprekk); lyset kommer alltid fra øvre venstre.
 *   <Kloss x={240} y={300} w={80} h={50} materiale="tre" label="A" krok="hoyre" />
 *   <Snor points={[[240 + 40 + 2.9 * 5, 275], [520, 275]]} />  // h = 50 gir rr = 5
 *   <Kloss {...rampePunkt(rampe, 150)} w={60} h={40} materiale="is" />
 */
export function Kloss({ x, y, w, h, materiale, label, labelPlass = 'midt', farge, krok, rotate, flip, dim, title, skygge = true }: KlossProps) {
  const id = useSvgId('sc-kloss');
  const ss = useStrokeScale();
  const W = Math.max(3, num(w, 60));
  const H = Math.max(3, num(h, 40));
  const L = -W / 2;
  const T = -H;
  const m = Math.min(W, H);
  const mirror = flip ? 'scale(-1 1)' : undefined;

  let base: string = SCENE.wood;
  let rx = Math.min(2, m * 0.05);
  let ink: string = MEK.inkTre;
  let stops = materialStops(base);
  let details = null;
  let fillOpacity = 1;
  switch (materiale) {
    case 'tre': {
      base = mix(SCENE.wood, SCENE.woodLight, 0.4);
      stops = materialStops(base, 0.8);
      const line = (fy: number, k: number) =>
        `M${pt(L + W * 0.05, T + H * fy)} q${r2(W * 0.22)},${r2(-H * 0.05 * k)} ${r2(W * 0.45)},${r2(H * 0.01)} t${r2(W * 0.45)},${r2(-H * 0.01)}`;
      details = (
        <path d={`${line(0.28, 1)} ${line(0.52, -1)} ${line(0.77, 0.7)}`} fill="none" stroke={shade(base, 0.35)} strokeWidth={0.7 * ss} opacity={0.5} transform={mirror} />
      );
      break;
    }
    case 'metall':
      base = SCENE.metal;
      rx = Math.min(1.5, m * 0.04);
      ink = MEK.inkMetall;
      stops = [
        [0, SCENE.metalLight],
        [0.16, SCENE.metal],
        [0.5, shade(SCENE.metal, 0.06)],
        [0.56, tint(SCENE.metal, 0.3)],
        [1, SCENE.metalDark],
      ];
      details = (
        <path
          d={`M${pt(L + W * 0.06, T + H * 0.32)} H${r2(-L - W * 0.3)} M${pt(L + W * 0.25, T + H * 0.74)} H${r2(-L - W * 0.08)}`}
          stroke={SCENE.highlight}
          strokeWidth={0.8 * ss}
          opacity={0.7}
        />
      );
      break;
    case 'stein': {
      base = SCENE.stone;
      rx = m * 0.1;
      ink = MEK.inkStein;
      stops = materialStops(base, 0.9);
      const rnd = sceneRandom(Math.round(W * 7 + H * 13));
      const dots = Array.from({ length: 12 }, (_, i) => ({
        cx: L + W * (0.08 + rnd() * 0.84),
        cy: T + H * (0.12 + rnd() * 0.78),
        r: Math.max(0.6, m * (0.012 + rnd() * 0.02)),
        light: i % 3 === 0,
      }));
      details = (
        <g transform={mirror}>
          {dots.map((d, i) => (
            <circle key={i} cx={r2(d.cx)} cy={r2(d.cy)} r={r2(d.r)} fill={d.light ? tint(SCENE.stone, 0.35) : SCENE.stoneDark} opacity={0.75} />
          ))}
        </g>
      );
      break;
    }
    case 'gummi':
      base = SCENE.rubber;
      rx = m * 0.18;
      ink = MEK.inkGummi;
      stops = [
        [0, SCENE.rubberLight],
        [0.5, SCENE.rubber],
        [1, shade(SCENE.rubber, 0.3)],
      ];
      details = <rect x={L + W * 0.1} y={T + H * 0.12} width={W * 0.5} height={Math.max(1.2, H * 0.08)} rx={H * 0.04} fill={SCENE.highlight} opacity={0.45} />;
      break;
    case 'is':
      base = SCENE.ice;
      rx = m * 0.16;
      ink = MEK.inkIs;
      fillOpacity = 0.92;
      stops = [
        [0, SCENE.iceShine],
        [0.45, SCENE.ice],
        [1, shade(SCENE.ice, 0.16)],
      ];
      details = (
        <g>
          <path
            d={`M${pt(L + W * 0.16, -H * 0.12)} L${pt(L + W * 0.42, T + H * 0.14)} L${pt(L + W * 0.56, T + H * 0.14)} L${pt(L + W * 0.3, -H * 0.12)} Z`}
            fill={SCENE.iceShine}
            opacity={0.5}
          />
          <path
            d={`M${pt(-L - W * 0.18, T + H * 0.22)} l${r2(-W * 0.08)},${r2(H * 0.2)} l${r2(W * 0.05)},${r2(H * 0.12)} l${r2(-W * 0.06)},${r2(H * 0.2)}`}
            fill="none"
            stroke={SCENE.iceShine}
            strokeWidth={0.8 * ss}
            opacity={0.85}
            transform={mirror}
          />
          <rect x={L + 2} y={T + 2} width={W - 4} height={H - 4} rx={Math.max(0, rx - 2)} fill="none" stroke={SCENE.iceShine} strokeWidth={0.9 * ss} opacity={0.6} />
        </g>
      );
      break;
    case 'plast':
      base = paint(farge ?? 'gul');
      rx = m * 0.1;
      ink = shade(base, 0.62);
      stops = [
        [0, tint(base, 0.32)],
        [0.5, base],
        [1, shade(base, 0.24)],
      ];
      details = <rect x={L + W * 0.07} y={T + H * 0.1} width={W * 0.86} height={Math.max(1.2, H * 0.09)} rx={H * 0.045} fill={SCENE.highlight} />;
      break;
  }
  rx = Math.min(rx, m / 2);

  const rr = clamp(H * 0.1, 2.5, 6);
  const sides = krok === 'begge' ? [-1, 1] : krok === 'venstre' ? [-1] : krok === 'hoyre' ? [1] : [];

  return (
    <Place x={x} y={y} rotate={rotate} opacity={dim ? SCENE_DIM : undefined}>
      {title && <title>{title}</title>}
      {skygge && <ContactShadow cx={0} cy={0} rx={W * 0.6} />}
      {sides.map((s) => (
        <g key={s}>
          <line x1={s * (W / 2 - 1)} y1={-H / 2} x2={s * (W / 2 + rr)} y2={-H / 2} stroke={SCENE.metalDark} strokeWidth={Math.max(1.2, rr * 0.5) * ss} strokeLinecap="round" />
          <circle cx={s * (W / 2 + rr * 1.9)} cy={-H / 2} r={rr} fill="none" stroke={SCENE.outline} strokeWidth={(rr * 0.42 + 1.2) * ss} />
          <circle cx={s * (W / 2 + rr * 1.9)} cy={-H / 2} r={rr} fill="none" stroke={SCENE.metal} strokeWidth={rr * 0.42 * ss} />
        </g>
      ))}
      <LinearGradient id={`${id}a`} stops={stops} />
      <rect x={L} y={T} width={W} height={H} rx={rx} fill={`url(#${id}a)`} fillOpacity={fillOpacity} />
      {details}
      <SideShade id={`${id}s`} x={L} y={T} w={W} h={H} rx={rx} strength={materiale === 'is' ? 0.5 : 0.85} />
      <rect
        x={L}
        y={T}
        width={W}
        height={H}
        rx={rx}
        fill="none"
        stroke={materiale === 'is' ? shade(SCENE.ice, 0.4) : SCENE.outline}
        strokeWidth={1 * ss}
      />
      <line x1={L + Math.max(1.5, rx * 0.7)} y1={T + 0.9 * ss} x2={-L - Math.max(1.5, rx * 0.7)} y2={T + 0.9 * ss} stroke={SCENE.highlight} strokeWidth={1.2 * ss} strokeLinecap="round" />
      {label &&
        (labelPlass === 'oppe-venstre' ? (
          <ObjectText x={-W / 4} y={-H * 0.74} w={W * 0.42} h={H * 0.4} text={label} color={ink} max={16} />
        ) : (
          <ObjectText x={0} y={-H / 2} w={W * 0.84} h={H * 0.62} text={label} color={ink} max={16} />
        ))}
    </Place>
  );
}

/* ---------------------------------------------------------------- Ball */

export type BallType = 'fotball' | 'tennis' | 'staal' | 'gummi' | 'basket' | 'golf';

export interface BallProps {
  /** Sentrum av ballen. */
  x: number;
  y: number;
  /** Radius i figurens enheter. Ekte radier: fotball 11 cm, basketball 12 cm, tennisball 3,3 cm, golfball 2,1 cm. */
  r: number;
  type: BallType;
  /** Hvor mye mønsteret er dreid (grader med klokka). Gi den rulle- eller spinnvinkelen, så ser du at ballen roterer. */
  spinn?: number;
  /** Fargen på en gummiball (navn fra PAINTS eller en CSS-farge). Standard «rod». */
  farge?: PaintName | string;
  /** y-koordinaten til bakken under ballen: tegner en skygge der som blir mindre og svakere jo høyere ballen er. */
  bakke?: number;
  dim?: boolean;
  title?: string;
}

/** Hvor blankt høylyset er: filt og lær er matt, gummi og stål blankt. */
const GLOSS: Record<BallType, number> = { fotball: 0.8, tennis: 0.3, staal: 0.9, gummi: 0.85, basket: 0.45, golf: 0.7 };

const pentagon = (size: number, start: number) =>
  Array.from({ length: 5 }, (_, i) => {
    const a = (start + i * 72) * DEG;
    return pt(Math.cos(a) * size, Math.sin(a) * size);
  }).join(' ');

/**
 * Ball med ekte mønster: fotball, tennisball, stålkule, gummiball, basketball eller golfball. Ankerpunkt: sentrum.
 * Lyset og høylyset står stille mens mønsteret dreies med `spinn`.
 *   <Ball x={sx(t)} y={sy(t)} r={14} type="fotball" spinn={t * 360} bakke={300} />
 */
export function Ball({ x, y, r, type, spinn = 0, farge, bakke, dim, title }: BallProps) {
  const id = useSvgId('sc-ball');
  const ss = useStrokeScale();
  const R = Math.max(1, num(r, 12));
  const X = num(x, 0);
  const Y = num(y, 0);

  const base =
    type === 'fotball' || type === 'golf'
      ? PAINTS.hvit
      : type === 'tennis'
        ? MEK.tennis
        : type === 'basket'
          ? MEK.basket
          : type === 'staal'
            ? SCENE.metal
            : paint(farge ?? 'rod');
  const sw = (k: number) => Math.max(0.6 * ss, R * k);

  let pattern = null;
  switch (type) {
    case 'fotball': {
      // Avkortet ikosaeder sett rett forfra: én femkant midt på, fem forkortede femkanter mot kanten og sømmene
      // mellom sekskantene.
      const p = R * 0.36;
      const op = p * 0.95;
      const dist = R * 0.93;
      const squash = 0.42;
      const outer = (k: number, i: number): [number, number] => {
        const a = (-90 + k * 72) * DEG;
        const b = (180 + i * 72) * DEG;
        const lx = dist + Math.cos(b) * op * squash;
        const ly = Math.sin(b) * op;
        return [lx * Math.cos(a) - ly * Math.sin(a), lx * Math.sin(a) + ly * Math.cos(a)];
      };
      const seams: string[] = [];
      for (let k = 0; k < 5; k++) {
        const a = (-90 + k * 72) * DEG;
        const [ix, iy] = outer(k, 0);
        const [sx, sy] = outer(k, 4);
        const [nx, ny] = outer(k + 1, 1);
        seams.push(`M${pt(Math.cos(a) * p, Math.sin(a) * p)} L${pt(ix, iy)}`);
        seams.push(`M${pt(sx, sy)} L${pt(nx, ny)}`);
        for (const [vx, vy] of [
          [sx, sy],
          [nx, ny],
        ] as const) {
          const l = Math.hypot(vx, vy) || 1;
          seams.push(`M${pt(vx, vy)} L${pt((vx / l) * R * 1.05, (vy / l) * R * 1.05)}`);
        }
      }
      pattern = (
        <g>
          <path d={seams.join(' ')} stroke={shade(PAINTS.hvit, 0.42)} strokeWidth={sw(0.028)} fill="none" strokeLinecap="round" />
          <polygon points={pentagon(p, -90)} fill={PAINTS.svart} stroke={PAINTS.svart} strokeWidth={sw(0.02)} strokeLinejoin="round" />
          {[0, 1, 2, 3, 4].map((k) => (
            <polygon
              key={k}
              points={pentagon(op, 180)}
              transform={`rotate(${-90 + k * 72}) translate(${r2(dist)} 0) scale(${squash} 1)`}
              fill={PAINTS.svart}
            />
          ))}
        </g>
      );
      break;
    }
    case 'tennis':
      pattern = (
        <g fill="none" strokeLinecap="round">
          <path
            d={`M${pt(-R * 0.6, -R * 0.85)} C${pt(-R * 0.05, -R * 0.42)} ${pt(-R * 0.05, R * 0.42)} ${pt(-R * 0.6, R * 0.85)} M${pt(R * 0.6, -R * 0.85)} C${pt(R * 0.05, -R * 0.42)} ${pt(R * 0.05, R * 0.42)} ${pt(R * 0.6, R * 0.85)}`}
            stroke={shade(MEK.tennis, 0.3)}
            strokeWidth={sw(0.13)}
            opacity={0.6}
          />
          <path
            d={`M${pt(-R * 0.6, -R * 0.85)} C${pt(-R * 0.05, -R * 0.42)} ${pt(-R * 0.05, R * 0.42)} ${pt(-R * 0.6, R * 0.85)} M${pt(R * 0.6, -R * 0.85)} C${pt(R * 0.05, -R * 0.42)} ${pt(R * 0.05, R * 0.42)} ${pt(R * 0.6, R * 0.85)}`}
            stroke={PAINTS.hvit}
            strokeWidth={sw(0.075)}
          />
        </g>
      );
      break;
    case 'gummi':
      pattern = (
        <path d={`M${pt(-R, 0)} A${r2(R)},${r2(R * 0.3)} 0 0 0 ${pt(R, 0)}`} fill="none" stroke={shade(base, 0.35)} strokeWidth={sw(0.035)} />
      );
      break;
    case 'basket':
      pattern = (
        <path
          d={`M0,${r2(-R)} V${r2(R)} M${pt(-R, 0)} A${r2(R)},${r2(R * 0.22)} 0 0 0 ${pt(R, 0)} M${pt(-R * 0.66, -R * 0.75)} C${pt(-R * 0.18, -R * 0.3)} ${pt(-R * 0.18, R * 0.3)} ${pt(-R * 0.66, R * 0.75)} M${pt(R * 0.66, -R * 0.75)} C${pt(R * 0.18, -R * 0.3)} ${pt(R * 0.18, R * 0.3)} ${pt(R * 0.66, R * 0.75)}`}
          fill="none"
          stroke={shade(MEK.basket, 0.72)}
          strokeWidth={sw(0.045)}
        />
      );
      break;
    case 'golf': {
      const dimples: { d: number; a: number; s: number }[] = [{ d: 0, a: 0, s: 1 }];
      for (let k = 0; k < 6; k++) dimples.push({ d: 0.44, a: k * 60 + 30, s: 0.9 });
      for (let k = 0; k < 10; k++) dimples.push({ d: 0.8, a: k * 36, s: 0.6 });
      pattern = (
        <g fill={shade(PAINTS.hvit, 0.16)} opacity={0.8}>
          {dimples.map((dm, i) => (
            <ellipse key={i} rx={r2(R * 0.1 * dm.s)} ry={r2(R * 0.1)} transform={`rotate(${dm.a}) translate(${r2(R * dm.d)} 0)`} />
          ))}
        </g>
      );
      break;
    }
    case 'staal':
      break;
  }

  const metal = type === 'staal';
  let shadow = null;
  if (bakke !== undefined && Number.isFinite(bakke)) {
    const above = Math.max(0, bakke - (Y + R));
    const k = clamp(1 - above / (R * 10 + 80), 0.25, 1);
    shadow = <ContactShadow cx={X} cy={bakke} rx={R * (0.55 + 0.45 * k)} opacity={k} />;
  }

  return (
    <g opacity={dim ? SCENE_DIM : undefined}>
      {title && <title>{title}</title>}
      {shadow}
      <g transform={`translate(${r2(X)} ${r2(Y)})`}>
        {metal ? (
          <>
            {/* Polert stål speiler omgivelsene: lys himmel øverst, mørk horisont litt under midten, bakken nederst */}
            <LinearGradient
              id={`${id}a`}
              stops={[
                [0, mix(SCENE.metalLight, SCENE.metal, 0.5)],
                [0.3, SCENE.metalLight],
                [0.52, tint(SCENE.metalLight, 0.45)],
              ]}
            />
            <LinearGradient
              id={`${id}g`}
              stops={[
                [0, shade(SCENE.metalDark, 0.35)],
                [0.18, SCENE.metalDark],
                [0.65, SCENE.metal],
                [1, mix(SCENE.metal, SCENE.metalLight, 0.5)],
              ]}
            />
          </>
        ) : (
          <RadialGradient id={`${id}a`} fx={0.36} fy={0.32} stops={sphereStops(base)} />
        )}
        <RadialGradient
          id={`${id}o`}
          fx={0.38}
          fy={0.34}
          stops={[
            [0, SCENE.outline, 0],
            [0.62, SCENE.outline, 0.04],
            [1, SCENE.outline, 0.6],
          ]}
        />
        <clipPath id={`${id}c`}>
          <circle r={R * 0.99} />
        </clipPath>
        <circle r={R} fill={`url(#${id}a)`} />
        {pattern && (
          <g clipPath={`url(#${id}c)`}>
            <g transform={spinn ? `rotate(${r2(spinn)})` : undefined}>{pattern}</g>
          </g>
        )}
        {metal && (
          <g clipPath={`url(#${id}c)`}>
            <path
              d={`M${pt(-R * 1.05, -R * 0.03)} Q${pt(0, R * 0.32)} ${pt(R * 1.05, -R * 0.03)} V${r2(R * 1.05)} H${r2(-R * 1.05)} Z`}
              fill={`url(#${id}g)`}
            />
            <ellipse cx={0} cy={R * 0.66} rx={R * 0.6} ry={R * 0.22} fill={SCENE.metalLight} opacity={0.3} />
          </g>
        )}
        <circle r={R} fill={`url(#${id}o)`} />
        <ellipse
          cx={-R * 0.36}
          cy={-R * 0.4}
          rx={R * (metal ? 0.22 : 0.24)}
          ry={R * (metal ? 0.13 : 0.15)}
          transform={`rotate(-35 ${r2(-R * 0.36)} ${r2(-R * 0.4)})`}
          fill={metal ? tint(SCENE.metalLight, 0.6) : SCENE.highlight}
          opacity={metal ? 0.55 : GLOSS[type]}
        />
        {metal && <circle cx={-R * 0.38} cy={-R * 0.42} r={Math.max(0.6 * ss, R * 0.085)} fill={tint(SCENE.metalLight, 0.9)} />}
        <circle r={R} fill="none" stroke={SCENE.outline} strokeWidth={1 * ss} />
      </g>
    </g>
  );
}

/* ---------------------------------------------------------------- Curlingstein */

export interface CurlingsteinProps extends Omit<SceneObjectProps, 'size'> {
  /** Diameteren i figurens enheter (ekte stein: 29 cm bred og 11 cm høy, med håndtak ca. 16 cm totalt). */
  size?: number;
  /** Fargen på håndtaket og lokket (navn fra PAINTS eller CSS-farge). Standard «rod». */
  lakk?: PaintName | string;
  /** Myk skygge under steinen (standard på). */
  skygge?: boolean;
}

/**
 * Curlingstein i granitt med polert slagbånd og farget håndtak. Ankerpunkt: (x, y) midt på bunnen. Håndtaket peker
 * mot høyre; bruk `flip` for en stein som glir mot venstre (bare håndtaket speilvendes, lyset står fast).
 *   <Curlingstein x={sx} y={isY} size={70} lakk="gul" />
 */
export function Curlingstein({ x, y, size = 60, lakk = 'rod', skygge = true, rotate, flip, dim, title }: CurlingsteinProps) {
  const id = useSvgId('sc-curling');
  const ss = useStrokeScale();
  const D = Math.max(6, num(size, 60));
  const Hb = D * 0.39;
  const color = paint(lakk);
  const body = `M${pt(-D * 0.36, 0)} C${pt(-D * 0.47, 0)} ${pt(-D * 0.5, -Hb * 0.22)} ${pt(-D * 0.5, -Hb * 0.5)} C${pt(-D * 0.5, -Hb * 0.8)} ${pt(-D * 0.46, -Hb)} ${pt(-D * 0.37, -Hb)} L${pt(D * 0.37, -Hb)} C${pt(D * 0.46, -Hb)} ${pt(D * 0.5, -Hb * 0.8)} ${pt(D * 0.5, -Hb * 0.5)} C${pt(D * 0.5, -Hb * 0.22)} ${pt(D * 0.47, 0)} ${pt(D * 0.36, 0)} Z`;
  const rnd = sceneRandom(29);
  const dots = Array.from({ length: 14 }, (_, i) => ({
    cx: (rnd() - 0.5) * D * 0.86,
    cy: -Hb * (0.12 + rnd() * 0.76),
    r: D * (0.007 + rnd() * 0.009),
    light: i % 3 === 0,
  }));
  const capY = -Hb - D * 0.03;
  const handle = `M${pt(-D * 0.1, capY)} V${r2(capY - D * 0.08)} Q${pt(-D * 0.1, capY - D * 0.13)} ${pt(-D * 0.03, capY - D * 0.13)} L${pt(D * 0.28, capY - D * 0.115)}`;
  return (
    <Place x={x} y={y} rotate={rotate} opacity={dim ? SCENE_DIM : undefined}>
      {title && <title>{title}</title>}
      {skygge && <ContactShadow cx={0} cy={0} rx={D * 0.46} />}
      <LinearGradient
        id={`${id}a`}
        x2={1}
        y2={0}
        stops={[
          [0, shade(SCENE.stone, 0.08)],
          [0.22, tint(SCENE.stone, 0.28)],
          [0.6, SCENE.stone],
          [1, shade(SCENE.stone, 0.38)],
        ]}
      />
      <path d={body} fill={`url(#${id}a)`} />
      <g>
        {dots.map((d, i) => (
          <circle key={i} cx={r2(d.cx)} cy={r2(d.cy)} r={r2(d.r)} fill={d.light ? tint(SCENE.stone, 0.4) : SCENE.stoneDark} opacity={0.8} />
        ))}
      </g>
      <rect x={-D * 0.497} y={-Hb * 0.62} width={D * 0.994} height={Hb * 0.2} fill={SCENE.highlight} opacity={0.55} />
      <path d={`M${pt(-D * 0.497, -Hb * 0.62)} H${r2(D * 0.497)} M${pt(-D * 0.497, -Hb * 0.42)} H${r2(D * 0.497)}`} stroke={SCENE.stoneDark} strokeWidth={0.6 * ss} opacity={0.6} />
      <path d={body} fill="none" stroke={SCENE.outline} strokeWidth={1 * ss} />
      {/* Lokk og håndtak (det eneste som speilvendes) */}
      <rect x={-D * 0.24} y={capY} width={D * 0.48} height={D * 0.035} rx={D * 0.012} fill={shade(color, 0.1)} stroke={SCENE.outline} strokeWidth={0.8 * ss} />
      <g transform={flip ? 'scale(-1 1)' : undefined}>
        <path d={handle} fill="none" stroke={SCENE.outline} strokeWidth={D * 0.075 + 1.6 * ss} strokeLinecap="round" strokeLinejoin="round" />
        <path d={handle} fill="none" stroke={color} strokeWidth={D * 0.075} strokeLinecap="round" strokeLinejoin="round" />
        <path
          d={`M${pt(-D * 0.03, capY - D * 0.14)} L${pt(D * 0.27, capY - D * 0.125)}`}
          stroke={SCENE.highlight}
          strokeWidth={Math.max(0.8 * ss, D * 0.016)}
          strokeLinecap="round"
        />
      </g>
    </Place>
  );
}

/* ---------------------------------------------------------------- Bord */

export interface BordProps extends Omit<SceneObjectProps, 'size' | 'rotate' | 'flip'> {
  /** (x, y) er midt på bordplatens overflate, der ting settes. */
  x: number;
  y: number;
  /** Bredden på bordplaten. */
  w: number;
  /** Høyden fra gulvet til bordplatens overflate (gulvet er i y + h). Ekte bord: ca. 75 cm høyt og 120–180 cm bredt. */
  h: number;
  /** Laboratoriebenk (lys plate og metallbein) eller trebord. Standard «lab». */
  type?: 'lab' | 'tre';
}

/**
 * Bord med plate og bein: laboratoriebenk eller trebord. Ankerpunkt: (x, y) midt på overflaten av bordplaten, så
 * gjenstander kan settes rett på i (x, y). Gulvet er i y + h.
 *   <Bord x={330} y={210} w={420} h={170} type="lab" />
 *   <Kloss x={300} y={210} w={70} h={40} materiale="tre" />
 */
export function Bord({ x, y, w, h, type = 'lab', dim, title }: BordProps) {
  const id = useSvgId('sc-bord');
  const ss = useStrokeScale();
  const W = Math.max(10, num(w, 300));
  const Hh = Math.max(10, num(h, 160));
  const lab = type === 'lab';
  const tt = lab ? clamp(W * 0.04, 4, 14) : clamp(W * 0.035, 3, 10);
  const legW = lab ? clamp(W * 0.03, 3, 9) : clamp(W * 0.04, 3, 10);
  const inset = lab ? legW * 1.2 : legW * 0.7;
  const legX = W / 2 - inset - legW / 2;
  const apronH = Math.min(lab ? tt * 0.8 : clamp(W * 0.05, 4, 14), Hh * 0.2);
  const top = lab ? SCENE.bench : mix(SCENE.wood, SCENE.woodLight, 0.4);
  const legColor = lab ? SCENE.metal : SCENE.wood;
  const leg = (s: number) =>
    lab
      ? `M${pt(s * legX - legW / 2, tt)} H${r2(s * legX + legW / 2)} V${r2(Hh)} H${r2(s * legX - legW / 2)} Z`
      : `M${pt(s * legX - legW / 2, tt)} H${r2(s * legX + legW / 2)} L${pt(s * legX + legW * 0.36, Hh)} H${r2(s * legX - legW * 0.36)} Z`;
  return (
    <Place x={x} y={y} opacity={dim ? SCENE_DIM : undefined}>
      {title && <title>{title}</title>}
      <ContactShadow cx={0} cy={Hh} rx={W * 0.5} ry={Math.max(3, W * 0.025)} opacity={0.5} />
      <ContactShadow cx={-legX} cy={Hh} rx={legW * 1.8} />
      <ContactShadow cx={legX} cy={Hh} rx={legW * 1.8} />
      <LinearGradient
        id={`${id}l`}
        x2={1}
        y2={0}
        stops={[
          [0, tint(legColor, 0.25)],
          [0.4, legColor],
          [1, shade(legColor, 0.3)],
        ]}
      />
      <LinearGradient id={`${id}t`} stops={materialStops(top, 0.7)} />
      {lab && (
        <rect
          x={-legX - legW * 0.4}
          y={Hh * 0.8}
          width={2 * legX + legW * 0.8}
          height={legW * 0.75}
          fill={shade(SCENE.metal, 0.15)}
          stroke={SCENE.outline}
          strokeWidth={0.8 * ss}
        />
      )}
      <path d={leg(-1)} fill={`url(#${id}l)`} stroke={SCENE.outline} strokeWidth={0.9 * ss} />
      <path d={leg(1)} fill={`url(#${id}l)`} stroke={SCENE.outline} strokeWidth={0.9 * ss} />
      {lab && (
        <g fill={SCENE.rubber}>
          <rect x={-legX - legW * 0.65} y={Hh - legW * 0.45} width={legW * 1.3} height={legW * 0.45} rx={legW * 0.15} />
          <rect x={legX - legW * 0.65} y={Hh - legW * 0.45} width={legW * 1.3} height={legW * 0.45} rx={legW * 0.15} />
        </g>
      )}
      <rect
        x={-W / 2 + inset * 0.6}
        y={tt}
        width={W - inset * 1.2}
        height={apronH}
        fill={lab ? SCENE.metalDark : shade(SCENE.wood, 0.12)}
        stroke={SCENE.outline}
        strokeWidth={0.8 * ss}
      />
      <rect x={-W / 2} y={0} width={W} height={tt} rx={Math.min(1.5, tt * 0.25)} fill={`url(#${id}t)`} />
      {lab ? (
        <rect x={-W / 2} y={tt * 0.62} width={W} height={tt * 0.38} fill={SCENE.benchEdge} />
      ) : (
        <path
          d={`M${pt(-W * 0.44, tt * 0.5)} q${r2(W * 0.2)},${r2(-tt * 0.2)} ${r2(W * 0.42)},0 t${r2(W * 0.44)},0`}
          fill="none"
          stroke={shade(top, 0.35)}
          strokeWidth={0.6 * ss}
          opacity={0.6}
        />
      )}
      <rect x={-W / 2} y={0} width={W} height={tt} rx={Math.min(1.5, tt * 0.25)} fill="none" stroke={SCENE.outline} strokeWidth={1 * ss} />
      <line x1={-W / 2 + 1.5} y1={0.8 * ss} x2={W / 2 - 1.5} y2={0.8 * ss} stroke={SCENE.highlight} strokeWidth={1.2 * ss} strokeLinecap="round" />
    </Place>
  );
}

/* ---------------------------------------------------------------- Rampe */

export interface RampeProps {
  /** Hjørnet der rampa møter bakken (ankerpunktet). */
  x: number;
  y: number;
  /** Lengden langs skråflaten, fra bakken til toppen. */
  lengde: number;
  /** Helningsvinkelen i grader (0–80). */
  vinkel: number;
  /** Hvilken vei rampa stiger. Standard «opp-hoyre». */
  retning?: 'opp-hoyre' | 'opp-venstre';
  /** Massiv kile i tre, eller metallplate med sideskinne på et stativ (stolpe, stag og bunnskinne). Standard «tre». */
  materiale?: 'tre' | 'metall';
  dim?: boolean;
  title?: string;
}

/**
 * Skråplan: en kile i tre eller en metallrampe på stativ. Ankerpunkt: (x, y) er hjørnet der skråflaten møter bakken.
 * Bruk `rampePunkt` til å sette ting på skråflaten.
 *   const rampe = { x: 80, y: 320, lengde: 440, vinkel: 25 };
 *   <Rampe {...rampe} />
 *   <Kasse {...rampePunkt(rampe, 200)} w={80} h={60} />
 */
export function Rampe({ x, y, lengde, vinkel, retning = 'opp-hoyre', materiale = 'tre', dim, title }: RampeProps) {
  const id = useSvgId('sc-rampe');
  const ss = useStrokeScale();
  const L = Math.max(4, num(lengde, 300));
  const deg = clamp(num(vinkel, 20), 0, 80);
  const th = deg * DEG;
  const c = Math.cos(th);
  const s = Math.sin(th);
  const tx = L * c;
  const ty = -L * s;
  const wood = materiale === 'tre';
  const t = wood ? clamp(L * 0.025, 3, 9) : clamp(L * 0.02, 3, 7);
  const flat = s < 0.01;
  const shadow = (
    <ContactShadow cx={(flat ? L : tx) * 0.5} cy={0} rx={(flat ? L : tx) * 0.56} ry={Math.max(3, Math.min(8, tx * 0.03))} opacity={0.7} />
  );

  if (!wood) {
    // Metallrampe: plate med sideskinne (C-profil) langs skråflaten, gummitupp mot bakken, stolpe, stag og bunnskinne.
    const railH = t * 2.2;
    const rb = clamp(L * 0.016, 2.5, 6);
    const pw = clamp(L * 0.024, 3.5, 9);
    const sw = clamp(L * 0.016, 2.5, 6);
    const tip = clamp(railH / Math.max(s, 0.05), railH * 1.5, L * 0.1);
    // Stag fra undersiden av skinna (42 % opp) til foten av stolpen
    const sx = tx * 0.42 + s * railH * 0.9;
    const sy = ty * 0.42 + c * railH * 0.9;
    const ex = tx - pw;
    const ey = -rb;
    const strutLen = Math.hypot(ex - sx, ey - sy);
    const strutDeg = (Math.atan2(ey - sy, ex - sx) * 180) / Math.PI;
    const tf = t / railH;
    return (
      <Place x={x} y={y} flip={retning === 'opp-venstre'} opacity={dim ? SCENE_DIM : undefined}>
        {title && <title>{title}</title>}
        {shadow}
        <LinearGradient id={`${id}v`} stops={[[0, SCENE.metalLight], [0.45, SCENE.metal], [1, SCENE.metalDark]]} />
        <LinearGradient id={`${id}h`} x2={1} y2={0} stops={[[0, SCENE.metalLight], [0.4, SCENE.metal], [1, SCENE.metalDark]]} />
        <LinearGradient
          id={`${id}p`}
          stops={[
            [0, SCENE.metalLight],
            [tf * 0.85, SCENE.metal],
            [tf, shade(SCENE.metalDark, 0.1)],
            [tf + 0.07, tint(SCENE.metal, 0.25)],
            [1, SCENE.metalDark],
          ]}
        />
        {!flat && (
          <g stroke={SCENE.outline} strokeWidth={0.8 * ss}>
            <rect x={0} y={-rb} width={tx} height={rb} rx={Math.min(1, rb * 0.3)} fill={`url(#${id}v)`} />
            <rect x={tx - pw} y={ty + t} width={pw} height={Math.max(0, -ty - t - rb)} fill={`url(#${id}h)`} />
            <g transform={`translate(${r2(sx)} ${r2(sy)}) rotate(${r2(strutDeg)})`}>
              <rect x={0} y={-sw / 2} width={strutLen} height={sw} rx={sw * 0.3} fill={`url(#${id}v)`} />
            </g>
          </g>
        )}
        <clipPath id={`${id}k`}>
          <rect x={-L} y={-2 * L} width={3 * L} height={2 * L} />
        </clipPath>
        <g clipPath={flat ? undefined : `url(#${id}k)`}>
          <g transform={flat ? undefined : `rotate(${r2(-deg)})`}>
            <rect x={0} y={0} width={L} height={railH} fill={`url(#${id}p)`} />
            {!flat && <rect x={0} y={0} width={tip} height={railH} rx={Math.min(2, railH * 0.2)} fill={SCENE.rubber} />}
            <rect x={0} y={0} width={L} height={railH} fill="none" stroke={SCENE.outline} strokeWidth={1 * ss} />
            <line x1={3} y1={0.9 * ss} x2={L - 3} y2={0.9 * ss} stroke={SCENE.highlight} strokeWidth={1.3 * ss} strokeLinecap="round" />
          </g>
        </g>
      </Place>
    );
  }

  // Trekile: planken langs skråflaten (flaten øverst, undersiden parallelt med avstand t) oppå en massiv kile.
  const lowToe = flat ? 0 : Math.min(tx, t / s);
  const lowBack = flat ? t : Math.min(-ty, t / Math.max(0.01, c));
  const plank = flat
    ? `M0,0 H${r2(L)} V${r2(t)} H0 Z`
    : `M0,0 L${pt(tx, ty)} L${pt(tx, ty + lowBack)} L${pt(lowToe, 0)} Z`;
  const hp = L * s * c;
  const grain = flat
    ? ''
    : [0.38, 0.66]
        .map((k) => k * hp)
        .filter((d) => d > t * 1.2)
        .map((d) => `M${pt(d / s, 0)} L${pt(tx, ty + d / c)}`)
        .join(' ');
  const post = Math.max(2, t * 0.6);

  return (
    <Place x={x} y={y} flip={retning === 'opp-venstre'} opacity={dim ? SCENE_DIM : undefined}>
      {title && <title>{title}</title>}
      {shadow}
      <LinearGradient id={`${id}p`} stops={materialStops(SCENE.woodLight, 0.6)} />
      {!flat && (
        <>
          <LinearGradient id={`${id}a`} stops={materialStops(SCENE.wood, 0.8)} />
          <path d={`M0,0 L${pt(tx, ty)} V0 Z`} fill={`url(#${id}a)`} />
          {grain && <path d={grain} stroke={shade(SCENE.wood, 0.35)} strokeWidth={0.7 * ss} opacity={0.5} />}
          <path d={`M${pt(tx - post / 2, ty + post)} V0`} stroke={shade(SCENE.wood, 0.3)} strokeWidth={post} opacity={0.5} />
        </>
      )}
      <path d={plank} fill={`url(#${id}p)`} />
      {!flat && <path d={`M${pt(0, 0)} L${pt(tx, ty)} V0 Z`} fill="none" stroke={SCENE.outline} strokeWidth={1 * ss} strokeLinejoin="round" />}
      <path d={plank} fill="none" stroke={SCENE.outline} strokeWidth={1 * ss} strokeLinejoin="round" />
      <line
        x1={c * 3}
        y1={-s * 3 + 0.9 * ss}
        x2={tx - c * 3}
        y2={ty + 0.9 * ss}
        stroke={SCENE.highlight}
        strokeWidth={1.3 * ss}
        strokeLinecap="round"
      />
    </Place>
  );
}

/**
 * Punktet på skråflaten til en rampe, `s` langs rampa fra bunnen, og vinkelen en gjenstand der må dreies.
 * `hoyde` flytter punktet vinkelrett ut fra flaten (f.eks. sentrum av en ball med radius r, eller midten av en kloss).
 *   <Kloss {...rampePunkt(rampe, 120)} w={60} h={40} materiale="tre" />
 *   const c = rampePunkt(rampe, 120, 20);  // midt i en kloss som er 40 høy, for kraftpilene
 */
export function rampePunkt(
  props: Pick<RampeProps, 'x' | 'y' | 'vinkel' | 'retning'>,
  s: number,
  hoyde = 0,
): { x: number; y: number; rotate: number } {
  const th = clamp(num(props.vinkel, 20), 0, 80) * DEG;
  const dir = props.retning === 'opp-venstre' ? -1 : 1;
  const d = num(s, 0);
  const n = num(hoyde, 0);
  return {
    x: num(props.x, 0) + dir * d * Math.cos(th) - dir * n * Math.sin(th),
    y: num(props.y, 0) - d * Math.sin(th) - n * Math.cos(th),
    rotate: -dir * (th / DEG),
  };
}

/* ---------------------------------------------------------------- Lodd */

export interface LoddProps extends Omit<SceneObjectProps, 'size' | 'flip'> {
  /** (x, y) er toppen av kroken (der loddet henger i snora eller kraftmåleren). */
  x: number;
  y: number;
  /** Diameteren på loddet. Hele loddet er 2 · size høyt, så bunnen er i y + 2 · size. Ekte 100 g-lodd: ca. 2,5 cm bredt. */
  size?: number;
  /** Tekst preget i loddet, f.eks. «500 g». */
  label?: string;
  /** Messing (gyllent) eller stål. Standard «messing». */
  materiale?: 'messing' | 'staal';
}

/**
 * Lodd med krok fra fysikklaben: sylinder i messing med hals og krok. Ankerpunkt: (x, y) er toppen av kroken; bunnen
 * er i y + 2 · size, og tyngdepunktet (midt i sylinderen) i y + 1,36 · size. Teksten står øverst på sylinderen, så en
 * G-pil fra tyngdepunktet ikke dekker den.
 *   <Lodd x={400} y={kraftmaalerBunn} size={34} label="500 g" />
 */
export function Lodd({ x, y, size = 30, label, materiale = 'messing', rotate, dim, title }: LoddProps) {
  const id = useSvgId('sc-lodd');
  const ss = useStrokeScale();
  const D = Math.max(4, num(size, 30));
  const base = materiale === 'staal' ? SCENE.metal : SCENE.gold;
  const wire = Math.max(1.2 * ss, D * 0.075);
  const rho = D * 0.17;
  const hc = rho - wire / 2;
  const neck0 = D * 0.5;
  const e = D * 0.09;
  const bTop = D * 0.72;
  const bBot = D * 2;
  const hook = `M0,${r2(neck0)} C${pt(0, hc + rho * 1.6)} ${pt(-rho, hc + rho * 1.4)} ${pt(-rho, hc)} A${r2(rho)},${r2(rho)} 0 0 1 ${pt(rho, hc)} L${pt(rho, hc + rho * 0.5)}`;
  const body = `M${pt(-D / 2, bTop + e)} V${r2(bBot - e)} A${r2(D / 2)},${r2(e)} 0 0 0 ${pt(D / 2, bBot - e)} V${r2(bTop + e)} Z`;
  const nw = D * 0.34;
  const neck = `M${pt(-nw / 2, neck0)} V${r2(bTop + e)} A${r2(nw / 2)},${r2(e * 0.4)} 0 0 0 ${pt(nw / 2, bTop + e)} V${r2(neck0)} Z`;
  return (
    <Place x={x} y={y} rotate={rotate} opacity={dim ? SCENE_DIM : undefined}>
      {title && <title>{title}</title>}
      <LinearGradient
        id={`${id}a`}
        x2={1}
        y2={0}
        stops={[
          [0, shade(base, 0.12)],
          [0.22, tint(base, 0.4)],
          [0.55, base],
          [1, shade(base, 0.4)],
        ]}
      />
      <path d={hook} fill="none" stroke={SCENE.outline} strokeWidth={wire + 1.4 * ss} strokeLinecap="round" />
      <path d={hook} fill="none" stroke={SCENE.metal} strokeWidth={wire} strokeLinecap="round" />
      <path d={body} fill={`url(#${id}a)`} />
      <ellipse cx={0} cy={bTop + e} rx={D / 2} ry={e} fill={tint(base, 0.3)} />
      <path d={body} fill="none" stroke={SCENE.outline} strokeWidth={1 * ss} />
      <path d={`M${pt(-D / 2, bTop + e)} A${r2(D / 2)},${r2(e)} 0 0 1 ${pt(D / 2, bTop + e)}`} fill="none" stroke={SCENE.outline} strokeWidth={0.8 * ss} />
      <ellipse cx={0} cy={bTop + e} rx={nw * 0.62} ry={e * 0.5} fill={shade(base, 0.3)} opacity={0.55} />
      <path d={neck} fill={`url(#${id}a)`} stroke={SCENE.outline} strokeWidth={0.8 * ss} />
      <ellipse cx={0} cy={neck0} rx={nw / 2} ry={e * 0.4} fill={tint(base, 0.35)} stroke={SCENE.outline} strokeWidth={0.6 * ss} />
      <line x1={-D * 0.3} y1={bTop + e * 2.2} x2={-D * 0.3} y2={bBot - e * 1.8} stroke={SCENE.highlight} strokeWidth={Math.max(0.8 * ss, D * 0.05)} strokeLinecap="round" />
      {label && (
        <ObjectText x={D * 0.04} y={bTop + e * 2 + D * 0.16} w={D * 0.86} h={D * 0.34} text={label} color={shade(base, 0.6)} weight={760} max={14} />
      )}
    </Place>
  );
}
