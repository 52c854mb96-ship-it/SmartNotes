/**
 * Figurene til «Blanding og termisk likevekt»:
 * - BlandingScene: labbenken med kalorimeteret i snitt (isopor med lokk), termometrene, energistrømmen Q gjennom
 *   metallveggen (eller ut av metallbiten) og skilt med temperaturene. På bred skjerm står også vannkokeren (eller
 *   kokeplata med vannbadet metallbiten ble varmet i), en mugge med kaldt vann og en stoppeklokke på benken.
 * - BlandingGraf: temperaturene som funksjon av tiden og søyler for energien som er avgitt og mottatt så langt.
 */
import { useMemo } from 'react';
import { Figure, Plot, TSub, Txt, VIZ, fmt, linePath, sample, useTextScale } from '../../kit';
import {
  ForceArrow,
  Kasserolle,
  Kokeplate,
  LinearGradient,
  Rom,
  Stoppeklokke,
  Underlag,
  ValueTag,
  Vannkoker,
  alpha,
  shade,
  tint,
  useStrokeScale,
  useSvgId,
} from '../../kit/scene';
import { mixState, type MixInput, type MixState } from './model';
import {
  CAL_METAL,
  CAL_WATER,
  METAL_BLOCK_X,
  METAL_THERMO_X,
  THERMO_LENGTH,
  THERMO_LIFT,
  flowFraction,
  levelInCylinder,
  levelInRing,
  levelWithBlock,
  metalBlock,
  sceneLayout,
  separateTags,
  thermoScaleY,
  thermoTubeWidth,
  valueTagWidth,
  warmth,
  type MetalId,
} from './blanding-scene';
import { Kalorimeter, Mugge, type ThermoSpec } from './blanding-deler';

export const HOT = VIZ.series[1];
export const COLD = VIZ.series[0];
/** Lengden på tidsaksen (s). */
export const T_END = 40;

export interface Body {
  m: number;
  T: number;
}

export interface SceneProps {
  water: boolean;
  metal: MetalId;
  hot: Body;
  cold: Body;
  st: MixState;
  t: number;
  showFlow: boolean;
  narrow: boolean;
  label: string;
}

export function BlandingScene(props: SceneProps) {
  const L = sceneLayout(props.narrow);
  return (
    <Figure viewBox={`0 0 ${L.W} ${L.H}`} label={props.label} maxHeight={props.narrow ? 760 : 540}>
      <SceneContent {...props} />
    </Figure>
  );
}

/** Ledestrek fra et skilt ned til det skiltet hører til, med glorie og en prikk i enden. */
function Leader({ x1, y1, x2, y2, color }: { x1: number; y1: number; x2: number; y2: number; color: string }) {
  const ss = useStrokeScale();
  if (Math.hypot(x2 - x1, y2 - y1) < 4) return null;
  return (
    <g>
      <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={VIZ.surface} strokeWidth={3.6 * ss} strokeLinecap="round" opacity={0.85} />
      <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={color} strokeWidth={1.5 * ss} strokeLinecap="round" />
      <circle cx={x2} cy={y2} r={3.2 * ss} fill={color} stroke={VIZ.surface} strokeWidth={1.4 * ss} />
    </g>
  );
}

function SceneContent({ water, metal, hot, cold, st, t, showFlow, narrow }: SceneProps) {
  const f = useTextScale();
  const ss = useStrokeScale();
  const L = sceneLayout(narrow);
  const { W, H, benchY, k, cx } = L;
  const geo = water ? CAL_WATER : CAL_METAL;
  const yF = benchY - geo.base * k;
  const flow = flowFraction(st.T1, st.T2, hot.T, cold.T);

  // Vannstander, metallbiten og termometrene (cm)
  let waterLevel: number;
  let cupLevel = 0;
  let blockGeo: { d: number; h: number } | null = null;
  let thermos: ThermoSpec[];
  if (water) {
    const cup = CAL_WATER.cup!;
    cupLevel = levelInCylinder(hot.m, cup.r - cup.wall);
    waterLevel = levelInRing(cold.m, cup.r, CAL_WATER.innerR);
    thermos = [
      { x: -1.5, lift: 0.2 + THERMO_LIFT, temp: st.T1, skala: 'hoyre' },
      { x: (cup.r + CAL_WATER.innerR) / 2, lift: THERMO_LIFT, temp: st.T2, skala: 'hoyre' },
    ];
  } else {
    const blk = metalBlock(metal, hot.m);
    waterLevel = levelWithBlock(cold.m, blk, CAL_METAL.innerR).level;
    blockGeo = blk;
    thermos = [{ x: METAL_THERMO_X, lift: THERMO_LIFT, temp: st.T2, skala: 'hoyre' }];
  }

  const Hth = THERMO_LENGTH * k;
  const tw = thermoTubeWidth(Hth);
  const thermoBase = (th: ThermoSpec) => yF - th.lift * k;
  const thermoTop = (th: ThermoSpec) => thermoBase(th) - Hth;

  // Skiltene med temperaturene: over termometeret (T₂) og over termometeret eller metallbiten (T₁)
  const t2 = thermos[thermos.length - 1]!;
  const tagY = thermoTop(t2) - 24 * f - (17 * 0.9 * f * 1.55) / 2;
  const tag1 = `T₁ = ${fmt(st.T1, 1)} °C`;
  const tag2 = `T₂ = ${fmt(st.T2, 1)} °C`;
  const w1 = valueTagWidth(tag1.length, f);
  const w2 = valueTagWidth(tag2.length, f);
  const obj1 = water
    ? { x: cx + thermos[0]!.x * k, y: thermoTop(thermos[0]!) }
    : (() => {
        const rb = (blockGeo!.d / 2) * k;
        return { x: cx + METAL_BLOCK_X * k, y: yF - 0.16 * rb - blockGeo!.h * k - rb * 0.42 };
      })();
  const obj2 = { x: cx + t2.x * k, y: thermoTop(t2) };
  const [x1, x2] = separateTags(obj1.x, w1, obj2.x, w2, 10 * f, 6, W - 6);
  const tagBottom = tagY + (17 * 0.9 * f * 1.55) / 2;

  // Energistrømmen Q: piler fra det varme gjennom veggen (eller ut av metallbiten) og inn i det kalde vannet
  const arrowW = (4 + 8 * flow) * (narrow ? 1.2 : 1);
  const arrows: { x1: number; x2: number; y: number; label: boolean; lx: number }[] = [];
  let calmX = cx;
  let calmY = yF;
  if (water) {
    const cup = CAL_WATER.cup!;
    const overlap = Math.min(cupLevel + 0.2, waterLevel);
    const ys = overlap >= 6 ? [0.7, 0.3] : [0.5];
    const xTail = cx - 3.1 * k;
    const xTip = cx - (CAL_WATER.innerR - 0.4) * k;
    const lx = cx - ((cup.r + CAL_WATER.innerR) / 2) * k;
    ys.forEach((q, i) => arrows.push({ x1: xTail, x2: xTip, y: yF - Math.max(0.45, q * overlap) * k, label: i === 0, lx }));
    // «Likevekt» over veggen i begeret, til venstre for termometeret
    calmY = yF - Math.max(0.45, 0.5 * overlap) * k;
    const maxRight = cx + thermos[0]!.x * k - tw * 0.7 - 6;
    calmX = Math.min(cx - cup.r * k, maxRight - valueTagWidth(8, f) / 2);
  } else if (blockGeo) {
    const left = METAL_BLOCK_X - blockGeo.d / 2;
    const right = METAL_BLOCK_X + blockGeo.d / 2;
    const inside = Math.min(0.8, blockGeo.d * 0.3);
    const sub = Math.min(waterLevel, blockGeo.h);
    const rb = (blockGeo.d / 2) * k;
    const y = yF - 0.16 * rb - Math.max(0.35, sub / 2) * k;
    const tubeLeft = METAL_THERMO_X - (tw / k) * 0.5 - 0.15;
    const tipL = cx + Math.max(left - 1.3, -CAL_METAL.innerR + 0.25) * k;
    arrows.push({ x1: cx + (left + inside) * k, x2: tipL, y, label: true, lx: tipL });
    arrows.push({ x1: cx + (right - inside) * k, x2: cx + Math.min(right + 1.3, tubeLeft) * k, y, label: false, lx: 0 });
    calmY = y;
    calmX = Math.min(cx + METAL_BLOCK_X * k, cx + tubeLeft * k - 6 - valueTagWidth(8, f) / 2);
  }

  // Sluttemperaturen som en stiplet strek på termometrene
  const tsMarks = thermos.map((th) => ({ x: cx + th.x * k, y: thermoBase(th) + thermoScaleY(Hth, 0, 100, st.Ts) }));

  const background = useMemo(
    () => (
      <g>
        <Rom x={0} y={0} w={W} h={H} gulvY={H - 4} gulv="betong" />
        <Underlag x1={0} x2={W} y={benchY} depth={H - benchY} type="labbenk" />
      </g>
    ),
    [W, H, benchY],
  );

  return (
    <g>
      {background}

      {/* Utstyret ved siden av (bare på bred skjerm) */}
      {L.props && water && (
        <Vannkoker x={118} y={benchY} size={22 * k} vann={0.35} damp={Math.min(0.5, Math.max(0, (hot.T - 85) / 15) * 0.5)} tid={t} />
      )}
      {L.props && !water && (
        <g>
          <Kokeplate x={112} y={benchY} w={18 * k} effekt={Math.min(1, Math.max(0, (hot.T - 20) / 80))} />
          <Kasserolle
            x={112}
            y={benchY - 0.25 * 18 * k}
            w={0.62 * 18 * k}
            vann={0.62}
            damp={hot.T >= 97 ? 0.9 : Math.min(0.5, Math.max(0, (hot.T - 60) / 40) * 0.5)}
            snitt
            tid={t}
          />
        </g>
      )}
      {L.props && <Mugge x={668} y={benchY} size={17 * k} vann={0.45} />}
      {L.props ? <Stoppeklokke x={712} y={84} r={40} t={t} desimaler={1} /> : <Stoppeklokke x={96} y={150} r={58} t={t} desimaler={1} />}

      <Kalorimeter
        x={cx}
        y={benchY}
        k={k}
        geo={geo}
        water={{ level: waterLevel, warm: warmth(st.T2) }}
        cup={water ? { level: cupLevel, warm: warmth(st.T1) } : undefined}
        block={!water && blockGeo ? { x: METAL_BLOCK_X, d: blockGeo.d, h: blockGeo.h, metal, warm: warmth(st.T1) } : undefined}
        thermometers={thermos}
      />

      {tsMarks.map((m, i) => (
        <path
          key={i}
          d={`M${m.x - tw * 1.05},${m.y}H${m.x + tw * 0.75}`}
          stroke={VIZ.ink}
          strokeWidth={1.6 * ss}
          strokeDasharray={`${3 * ss} ${2.2 * ss}`}
          opacity={0.75}
        />
      ))}

      {showFlow &&
        (flow > 0.01 ? (
          arrows.map((a, i) => (
            <ForceArrow
              key={i}
              x1={a.x1}
              y1={a.y}
              x2={a.x2}
              y2={a.y}
              color={HOT}
              width={arrowW}
              label={a.label ? 'Q' : undefined}
              labelY={a.y - 8 * f - arrowW * ss}
              labelX={a.lx}
              labelAnchor="middle"
            />
          ))
        ) : (
          <ValueTag x={calmX} y={calmY} text="Likevekt" />
        ))}

      <Leader x1={x1} y1={tagBottom} x2={obj1.x} y2={obj1.y - 3} color={HOT} />
      <Leader x1={x2} y1={tagBottom} x2={obj2.x} y2={obj2.y - 3} color={COLD} />
      <ValueTag x={x1} y={tagY} text={tag1} color={HOT} />
      <ValueTag x={x2} y={tagY} text={tag2} color={COLD} />
    </g>
  );
}

/* ---------------------------------------------------------------- Grafen og energisøylene */

export interface GrafProps {
  input: MixInput;
  st: MixState;
  t: number;
  narrow: boolean;
  label: string;
}

export function BlandingGraf({ input, st, t, narrow, label }: GrafProps) {
  const plotH = narrow ? 440 : 340;
  const barsH = narrow ? 400 : 340;
  const H = narrow ? plotH + 20 + barsH : plotH;
  return (
    <Figure viewBox={`0 0 800 ${H}`} label={label} maxHeight={narrow ? 900 : 420}>
      {narrow ? (
        <>
          <MixGraph input={input} st={st} t={t} width={800} height={plotH} />
          <g transform={`translate(0 ${plotH + 20})`}>
            <EnergyBars x0={120} w={560} h={barsH} st={st} />
          </g>
        </>
      ) : (
        <>
          <MixGraph input={input} st={st} t={t} width={570} height={plotH} />
          <EnergyBars x0={584} w={216} h={barsH} st={st} />
        </>
      )}
    </Figure>
  );
}

function MixGraph({ input, st, t, width, height }: { input: MixInput; st: MixState; t: number; width: number; height: number }) {
  const f = useTextScale();
  const ss = useStrokeScale();
  const T1 = useMemo(() => sample((x) => mixState(input, x).T1, 0, T_END, 160), [input]);
  const T2 = useMemo(() => sample((x) => mixState(input, x).T2, 0, T_END, 160), [input]);
  return (
    <Plot
      x={{ min: 0, max: T_END, label: 'Tid t (s)' }}
      y={{ min: 0, max: 100, label: 'Temperatur (°C)', ticks: [0, 20, 40, 60, 80, 100] }}
      width={width}
      height={height}
    >
      {({ sx, sy, x0, x1, y0 }) => {
        const tsY = sy(st.Ts);
        // Etiketten for sluttemperaturen står over linja, eller under når kurven for T₁ er i veien helt til høyre
        const labelY = tsY > sy(90) ? tsY - 12 * f : tsY + 26 * f;
        // Lyst felt mellom kurvene: temperaturforskjellen som driver energistrømmen
        const band =
          T1.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${sx(x).toFixed(1)},${sy(y).toFixed(1)}`).join('') +
          [...T2]
            .reverse()
            .map(([x, y]) => `L${sx(x).toFixed(1)},${sy(y).toFixed(1)}`)
            .join('') +
          'Z';
        const start1 = sy(input.T1);
        const start2 = sy(input.T2);
        return (
          <g>
            <path d={band} fill={alpha(HOT, 0.07)} />
            <line x1={x0} x2={x1} y1={tsY} y2={tsY} stroke={VIZ.muted} strokeWidth={1.6 * ss} strokeDasharray="6 5" />
            <Txt x={x1 - 6} y={labelY} anchor="end" size={0.85} weight={650} muted>
              T = {fmt(st.Ts, 1)} °C
            </Txt>
            <path d={linePath(T1, sx, sy)} fill="none" stroke={HOT} strokeWidth={3.5 * ss} strokeLinecap="round" />
            <path d={linePath(T2, sx, sy)} fill="none" stroke={COLD} strokeWidth={3.5 * ss} strokeLinecap="round" />
            <Txt x={x0 + 12} y={start1 - 10 * f} anchor="start" size={0.9} weight={700} color={HOT}>
              T<TSub>1</TSub>
            </Txt>
            <Txt x={x0 + 12} y={start2 + 24 * f} anchor="start" size={0.9} weight={700} color={COLD}>
              T<TSub>2</TSub>
            </Txt>
            <line x1={sx(t)} x2={sx(t)} y1={y0} y2={sy(100)} stroke={VIZ.ink} strokeWidth={1.5 * ss} opacity={0.45} />
            <circle cx={sx(t)} cy={sy(st.T1)} r={7.5 * ss} fill={HOT} stroke={VIZ.surface} strokeWidth={2.5 * ss} />
            <circle cx={sx(t)} cy={sy(st.T2)} r={7.5 * ss} fill={COLD} stroke={VIZ.surface} strokeWidth={2.5 * ss} />
          </g>
        );
      }}
    </Plot>
  );
}

/** Søyler for energien som er avgitt og mottatt så langt. Stiplet omriss = all energien som overføres til slutt. */
function EnergyBars({ x0, w, h, st }: { x0: number; w: number; h: number; st: MixState }) {
  const f = useTextScale();
  const ss = useStrokeScale();
  const id = useSvgId('blanding-q');
  const base = h - 18 - 26 * f;
  const topY = 34 + 70 * f;
  const k = (base - topY) / Math.max(1e-9, st.Qtotal);
  const bw = Math.min(64 * Math.max(1, f * 0.8), w * 0.26);
  const bars = [
    { x: x0 + w * 0.3, color: HOT, label: 'avgitt', key: 'a' },
    { x: x0 + w * 0.7, color: COLD, label: 'mottatt', key: 'm' },
  ];
  const qh = Math.max(1.5, st.Q * k);
  return (
    <g>
      {bars.map((b) => (
        <LinearGradient
          key={b.key}
          id={`${id}-${b.key}`}
          x2={1}
          y2={0}
          stops={[
            [0, tint(b.color, 0.18)],
            [0.55, b.color],
            [1, shade(b.color, 0.16)],
          ]}
        />
      ))}
      <Txt x={x0 + w / 2} y={34} size={0.95} weight={700}>
        Energi Q (kJ)
      </Txt>
      <Txt x={x0 + w / 2} y={34 + 26 * f} size={0.82} muted>
        totalt {fmt(st.Qtotal / 1000, 1)} kJ
      </Txt>
      <line x1={x0 + 8} x2={x0 + w - 8} y1={base} y2={base} stroke={VIZ.muted} strokeWidth={1.5 * ss} />
      {bars.map((b) => (
        <g key={b.key}>
          <rect
            x={b.x - bw / 2}
            y={base - st.Qtotal * k}
            width={bw}
            height={st.Qtotal * k}
            rx={3}
            fill={alpha(b.color, 0.06)}
            stroke={b.color}
            strokeWidth={1.5 * ss}
            strokeDasharray={`${5 * ss} ${4 * ss}`}
          />
          <rect x={b.x - bw / 2} y={base - qh} width={bw} height={qh} rx={3} fill={`url(#${id}-${b.key})`} />
          <Txt x={b.x} y={base - qh - 9} size={0.85} weight={700} color={b.color}>
            {fmt(st.Q / 1000, 1)}
          </Txt>
          <Txt x={b.x} y={base + 24 * f} size={0.82} muted>
            {b.label}
          </Txt>
        </g>
      ))}
      <Txt x={x0 + w / 2} y={Math.min(base - qh / 2, base - 16 * f) + 9 * f} size={1.2} weight={700} muted>
        =
      </Txt>
    </g>
  );
}
