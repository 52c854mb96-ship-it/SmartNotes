/**
 * Energiflyten i «Byggekran løfter en last» (k3-eks-kran): et Sankey-diagram der bredden på båndene er
 * proporsjonal med energien. Opp: elektrisk energi → motor, gir og vinsj → potensiell energi i lasta, og varme ned.
 * Ned: potensiell energi → motoren som generator → elektrisk energi tilbake til nettet, og varme ned. Hele turen
 * viser begge radene og at netto elektrisk energi er like mye som all varmen. Samme farger som vannkraftverket:
 * elektrisk energi grønn, potensiell energi oransje og varme lilla.
 */
import { Txt, VIZ, fmt } from '../../kit';
import { SCENE, mix, useStrokeScale } from '../../kit/scene';
import type { CraneSolution, CraneTask } from './model-eks-kran';
import { J_PER_KWH, sigDecimals } from './model-eks-kran';

export type FlowStage = 'up' | 'upKwh' | 'down' | 'round';

const C_EL = VIZ.applied;
const C_EP = VIZ.gravity;
const C_HEAT = VIZ.friction;

/** Energi i kJ med tre gjeldende siffer: 266 832 J → «267 kJ», 66 708 J → «66,7 kJ». */
export function kJ3(E: number): string {
  const k = E / 1000;
  return `${fmt(k, sigDecimals(k, 3))} kJ`;
}

/**
 * Energi i kWh med tre gjeldende siffer, som kJ3, så svaret har like mange siffer i begge enhetene:
 * 266 832 J → «0,0741 kWh», 463 523 J → «0,129 kWh».
 */
export function kWh3(E: number): string {
  const kwh = E / J_PER_KWH;
  return `${fmt(kwh, sigDecimals(kwh, 3))} kWh`;
}

/** Prosent uten desimaler: 0,75 → «75 %». */
const pct = (x: number) => `${fmt(x * 100, 0)} %`;

interface Row {
  machine: string;
  inName: string;
  inColor: string;
  inE: number;
  /** Ekstra linje i inn-båndet (kWh i d). */
  inExtra?: string;
  outName: string;
  outColor: string;
  outE: number;
  outShare: number;
  heatE: number;
  heatShare: number;
}

/** Hvor høy figuren for energiflyten er (figurenheter), så viewBox kan settes før den tegnes. */
export function flowHeight(stage: FlowStage, f: number): number {
  const row = rowHeight(f);
  return stage === 'round' ? 2 * row + 18 + 58 * f : row + 8;
}

/** Største båndbredde (den elektriske energien ved løftet). Større på mobil, der teksten i båndene er større. */
const tMax = (f: number) => (f > 1.25 ? 90 : 60);

function rowHeight(f: number): number {
  const Tmax = tMax(f);
  // Til og med verdien under varmepila (se FlowRow): yb + Tin + 24 + 20f, og litt luft
  return 14 + 46 * f + Tmax + 24 + 20 * f + 12;
}

/** Energiflyten for steget: én rad (opp eller ned) eller begge og nettoen (hele turen). */
export function EnergyFlow({ task, s, stage, f }: { task: CraneTask; s: CraneSolution; stage: FlowStage; f: number }) {
  const up: Row = {
    machine: 'Motor, gir og vinsj',
    inName: 'Elektrisk energi',
    inColor: C_EL,
    inE: s.Eel,
    inExtra: stage === 'upKwh' ? `≈ ${kWh3(s.Eel)}` : undefined,
    outName: 'Potensiell energi',
    outColor: C_EP,
    outE: s.W,
    outShare: task.eta,
    heatE: s.heatUp,
    heatShare: 1 - task.eta,
  };
  const down: Row = {
    machine: 'Motoren som generator',
    inName: 'Potensiell energi',
    inColor: C_EP,
    inE: s.dEp,
    outName: 'Tilbake til nettet',
    outColor: C_EL,
    outE: s.Eback,
    outShare: task.etaBack,
    heatE: s.heatDown,
    heatShare: 1 - task.etaBack,
  };
  const rowH = rowHeight(f);
  const scale = s.Eel;
  if (stage === 'round') {
    const narrow = f > 1.25;
    const y2 = rowH + 18;
    const ySum = 2 * rowH + 18 + 26 * f;
    return (
      <g>
        <FlowRow row={up} y0={0} f={f} scale={scale} title="Opp" />
        <FlowRow row={down} y0={y2} f={f} scale={scale} title="Ned" />
        <line x1={16} x2={784} y1={rowH + 8} y2={rowH + 8} stroke={VIZ.grid} strokeWidth={1.2} />
        <Txt x={20} y={ySum} anchor="start" size={0.92} weight={700}>
          {narrow ? 'Netto' : 'Netto fra strømnettet'}: {kJ3(s.Eel)} − {kJ3(s.Eback)} = <tspan style={{ fill: C_HEAT }}>{kJ3(s.net)}</tspan>
        </Txt>
        <Txt x={20} y={ySum + 25 * f} anchor="start" size={0.85} muted>
          = all varmen: {kJ3(s.heatUp)} + {kJ3(s.heatDown)}
          {narrow ? '' : ' (lasta er tilbake der den startet)'}
        </Txt>
      </g>
    );
  }
  return <FlowRow row={stage === 'down' ? down : up} y0={0} f={f} scale={scale} />;
}

/**
 * Én rad: inn-båndet fra venstre inn i maskinen, ut-båndet videre mot høyre med pil, og varmen som bøyer ned fra
 * maskinen. Båndbredden er `Tmax · E / scale`, så radene kan sammenlignes. Navnene står over båndene, verdiene inni
 * når de får plass.
 */
function FlowRow({ row, y0, f, scale, title }: { row: Row; y0: number; f: number; scale: number; title?: string }) {
  const ss = useStrokeScale();
  const narrow = f > 1.25;
  const Tmax = tMax(f);
  const T = (E: number) => Math.max(3, (Tmax * E) / scale);
  const Tin = T(row.inE);
  const Tout = T(row.outE);
  const Th = Math.max(3, Tin - Tout);
  const x0 = title ? (narrow ? 96 : 70) : 20;
  const xm = narrow ? 380 : 340;
  const mw = 22;
  const xo1 = narrow ? 712 : 700;
  const tip = xo1 + 34;
  const yName = y0 + 14 + 32 * f;
  const yMachine = y0 + 14 + 10 * f;
  const yb = y0 + 14 + 46 * f;
  // Varmen: kvart sirkel fra maskinen og ned, med pil
  const ri = 10;
  const ro = ri + Th;
  const cx = xm + mw;
  const cy = yb + Tout + ro;
  const ya = cy + 14;
  const heatTip = ya + 22;
  const textH = 17 * f;
  const fits = (T: number, lines = 1) => T >= textH * (lines === 1 ? 1.15 : 2.2) + 4;
  const heatPath = [
    `M${cx},${yb + Tout}`,
    `A${ro},${ro} 0 0 1 ${cx + ro},${cy}`,
    `L${cx + ro},${ya}`,
    `L${cx + ro + 7},${ya}`,
    `L${cx + (ri + ro) / 2},${heatTip}`,
    `L${cx + ri - 7},${ya}`,
    `L${cx + ri},${ya}`,
    `L${cx + ri},${cy}`,
    `A${ri},${ri} 0 0 0 ${cx},${yb + Tin}`,
    'Z',
  ].join(' ');
  const outPath = `M${xm + mw},${yb} L${xo1},${yb} L${xo1},${yb - 7} L${tip},${yb + Tout / 2} L${xo1},${yb + Tout + 7} L${xo1},${yb + Tout} L${xm + mw},${yb + Tout} Z`;
  const inValue = row.inExtra ? [kJ3(row.inE), row.inExtra] : [kJ3(row.inE)];
  const outValue = `${kJ3(row.outE)} (${pct(row.outShare)})`;
  // Verdien står alltid inni ut-båndet; er båndet smalt, blir teksten litt mindre (ned til 0,7).
  const outSize = Math.max(0.7, Math.min(0.95, (Tout - 3) / (17 * f * 1.05)));
  return (
    <g>
      {title && (
        <Txt x={16} y={yb + Tin / 2 + 6 * f} anchor="start" size={0.9} weight={760}>
          {title}
        </Txt>
      )}
      {/* Inn */}
      <rect x={x0} y={yb} width={xm - x0} height={Tin} fill={row.inColor} />
      <Txt x={x0} y={yName} anchor="start" size={0.85} weight={680} color={row.inColor}>
        {row.inName}
      </Txt>
      {fits(Tin, inValue.length) ? (
        inValue.map((v, i) => (
          <Txt key={i} x={x0 + 12} y={yb + Tin / 2 + (i - (inValue.length - 1) / 2) * 20 * f + 6 * f} anchor="start" size={i ? 0.85 : 1} weight={i ? 650 : 760} color={VIZ.surface} halo={false}>
            {v}
          </Txt>
        ))
      ) : (
        <Txt x={x0 + 4} y={yb + Tin + 20 * f} anchor="start" size={0.9} weight={760} color={row.inColor}>
          {inValue.join(' ')}
        </Txt>
      )}
      {/* Ut, med pil */}
      <path d={outPath} fill={row.outColor} />
      <Txt x={xm + mw + 14} y={yName} anchor="start" size={0.85} weight={680} color={row.outColor}>
        {row.outName}
      </Txt>
      <Txt x={xm + mw + 14} y={yb + Tout / 2 + 0.36 * 17 * f * outSize} anchor="start" size={outSize} weight={760} color={VIZ.surface} halo={false}>
        {outValue}
      </Txt>
      {/* Varme */}
      <path d={heatPath} fill={C_HEAT} />
      <Txt x={cx + ro + 14} y={ya - 2} anchor="start" size={0.85} weight={680} color={C_HEAT}>
        Varme
      </Txt>
      <Txt x={cx + ro + 14} y={ya + 20 * f} anchor="start" size={0.95} weight={760} color={C_HEAT}>
        {kJ3(row.heatE)} ({pct(row.heatShare)})
      </Txt>
      {/* Maskinen */}
      <rect x={xm} y={yb - 8} width={mw} height={Tin + 16} rx={4} fill={mix(SCENE.metal, VIZ.surface, 0.3)} stroke={SCENE.outline} strokeWidth={0.9 * ss} />
      <Txt x={xm + mw / 2} y={yMachine} anchor="middle" size={0.8} weight={650} muted>
        {row.machine}
      </Txt>
    </g>
  );
}

/** Kort tekst for skjermlesere. */
export function flowLabel(s: CraneSolution, stage: FlowStage): string {
  const up = `Elektrisk energi ${kJ3(s.Eel)} blir ${kJ3(s.W)} potensiell energi i lasta og ${kJ3(s.heatUp)} varme.`;
  const down = `Når lasta senkes, blir ${kJ3(s.dEp)} potensiell energi til ${kJ3(s.Eback)} elektrisk energi tilbake til nettet og ${kJ3(s.heatDown)} varme.`;
  if (stage === 'down') return down;
  if (stage === 'round') return `${up} ${down} Netto brukte kranen ${kJ3(s.net)}, like mye som all varmen.`;
  return up;
}

