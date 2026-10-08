/**
 * Scenen i «Termofysikkens første lov»: 1,0 mol luft i en stor glassylinder med stempel på labbenken. Under
 * sylinderen står en kokeplate (Q > 0), en isblokk (Q < 0) eller en isoporplate (Q = 0). Et digitalt termometer
 * måler temperaturen i gassen. Energipilene W (gjennom stempelet) og Q (gjennom bunnen) har samme skala (px/J), og
 * etikettene til høyre leses ovenfra og ned som W, ΔU og Q.
 */
import { useMemo } from 'react';
import { Txt, VIZ, fmt, useTextScale } from '../../kit';
import {
  Callout,
  Dimension,
  ForceArrow,
  Kokeplate,
  RadialGradient,
  Rom,
  SCENE,
  Underlag,
  ValueTag,
  alpha,
  sphereStops,
  useSceneScale,
  useStrokeScale,
  useSvgId,
} from '../../kit/scene';
import { Bunnplate, DigitalTermometer, Foler, Gass, Rim, Slange, Stempel, SylinderBak, SylinderForan } from './gassmodell-deler';
import { Underplate } from './forstelov-deler';
import {
  MAAL,
  PX_PER_M,
  T_START,
  V_START,
  cylinderAt,
  energyArrowLength,
  frontArcDepth,
  frostAmount,
  gasWarmth,
  particlePoint,
  plateEffect,
  spreadLabels,
  type ProcessState,
  type SceneLayout,
} from './forstelov-prosess';
import { useGasSim } from './marks';
import { toCelsius } from './model';

/** Fargene for energiene (samme som i «Varmepumpe»: arbeid grønn, varme oransje). */
export const COLOR_W = VIZ.series[2];
export const COLOR_Q = VIZ.series[1];
export const COLOR_U = VIZ.series[3];

/** Fortegn foran tallet: «+500», «−200», «0». */
export function signed(v: number, d = 0): string {
  if (!Number.isFinite(v)) return fmt(v, d);
  if (Math.abs(v) < 0.5 * 10 ** -d) return fmt(0, d);
  return v > 0 ? `+${fmt(v, d)}` : fmt(v, d);
}

const PARTICLES = 32;
const PARTICLE_R = 5.5;
/** Typisk fart på partiklene i bildet ved romtemperatur (px/s). */
const SPEED_PX = 110;

export function ForsteLovScene({
  layout,
  t,
  W,
  Q,
  state,
  showArrows,
}: {
  layout: SceneLayout;
  /** Simulert tid (s) for partiklene. */
  t: number;
  /** Arbeidet og varmen for hele prosessen (J). */
  W: number;
  Q: number;
  /** Tilstanden nå (underveis i avspillingen eller etter prosessen). */
  state: ProcessState;
  showArrows: boolean;
}) {
  const f = useTextScale();
  const k = useSceneScale();
  const ss = useStrokeScale();
  const pid = useSvgId('forstelov-partikkel');
  const { cx, benchY } = layout;
  const g = cylinderAt(layout, state.V);
  const g0 = cylinderAt(layout, V_START);
  const e = g.ellipse;
  const pr = PARTICLE_R * Math.min(1.35, k);
  const scale = Math.sqrt(Math.max(0, state.T) / T_START);
  const sim = useGasSim(t, {
    count: PARTICLES,
    seed: 5051,
    speed: SPEED_PX,
    scale,
    width: g.gasH - 2 * pr,
    height: 2 * (g.r - pr),
  });

  // Bakgrunnen endrer seg ikke under avspillingen
  const backdrop = useMemo(
    () => (
      <>
        <Rom x={layout.left} y={layout.top} w={layout.right - layout.left} h={layout.bottom - layout.top} gulvY={benchY + (layout.bottom - benchY) * 0.8} gulv="betong" vindu={!layout.narrow} vinduX={665} />
        <Underlag x1={layout.left - 10} x2={layout.right + 10} y={benchY} depth={layout.bottom - benchY + 4} type="labbenk" />
      </>
    ),
    [layout.left, layout.right, layout.top, layout.bottom, layout.narrow, benchY],
  );

  const flensBottom = g.supportTop;
  const flensT = flensBottom - g.flensTop;
  const heat = plateEffect(Q);
  const support = Q > 0 ? 'kokeplate' : Q < 0 ? 'is' : 'isopor';
  const slabD = 2 * MAAL.flensR * PX_PER_M * e * 1.25;
  const slabH = benchY - g.supportTop - slabD / 2;

  // Termometeret til venstre og ledningen fra føleren (gjennom bunnplata foran)
  const thermo = { x: layout.thermoX, w: 62 * Math.min(1.4, k), h: 94 * Math.min(1.4, k) };
  const plugX = thermo.x + thermo.w * 0.25;
  const plugY = benchY - thermo.h - 7;
  const portX = cx - 0.55 * g.flensR;
  const port = { x: portX, y: flensBottom + g.flensR * e * Math.sqrt(1 - 0.55 ** 2) - flensT / 2 };
  const cable = `M${port.x},${port.y} C${port.x - 30},${benchY + 18} ${plugX + 60},${benchY - 2} ${plugX},${plugY}`;
  const probeX = cx - 0.62 * g.r;

  // Energipilene: W gjennom stempelet (til høyre for stanga), Q gjennom bunnen (til venstre for midten)
  const wLen = energyArrowLength(W * state.s);
  const qLen = energyArrowLength(Q * state.s);
  const wx = cx + 0.5 * g.r;
  const wBase = g.pistonTop + 0.5 * frontArcDepth(g, cx, wx);
  const qx = cx - 0.3 * g.r;
  const qBase = g.flensTop + frontArcDepth(g, cx, qx) + 24;
  const wArrow = W > 0 ? { y1: wBase - wLen, y2: wBase } : { y1: wBase, y2: wBase - wLen };
  const qArrow = Q > 0 ? { y1: qBase, y2: qBase - qLen } : { y1: qBase - qLen, y2: qBase };

  // Etikettene til høyre: W ved pila over stempelet, ΔU midt i gassen, Q ved bunnen. Tekstlinja er 0,95 · 17 · f høy.
  const lineH = 17 * f;
  const twoLines = !layout.narrow;
  const gap = (twoLines ? 2.25 : 1.6) * lineH;
  const labelX = cx + g.rOuter + (layout.narrow ? 10 : 20);
  const callY = benchY - 12;
  const wMid = Math.abs(W) > 0 ? (wArrow.y1 + wArrow.y2) / 2 : g.pistonTop - 8;
  const qMid = Math.abs(Q) > 0 ? (qArrow.y1 + qArrow.y2) / 2 : g.flensTop - 6;
  const [wY, uY, qY] = spreadLabels([wMid, (g.gasTop + g.flensTop) / 2, qMid], gap, layout.top + 28 * f, callY - (twoLines ? 1.9 : 1.5) * lineH - 4);

  // «Før»: der stempelet startet
  const moved = Math.abs(g.gasTop - g0.gasTop) > 6;
  const dimX = cx - g.rOuter;
  const dimOffset = 14 + 4 * f;
  const tTag = `T = ${fmt(state.T, 0)} K`;

  const supportName = layout.narrow
    ? support === 'kokeplate'
      ? 'Kokeplate'
      : support === 'is'
        ? 'Isblokk'
        : 'Isopor'
    : support === 'kokeplate'
      ? 'Kokeplate: varme inn'
      : support === 'is'
        ? 'Isblokk: varme ut'
        : 'Isopor: ingen varme';

  return (
    <>
      {backdrop}

      {/* Det sylinderen står på */}
      {support === 'kokeplate' ? (
        <Kokeplate x={cx} y={benchY} w={g.supportW} effekt={heat} title="Kokeplate som står på" />
      ) : (
        <Underplate
          x={cx}
          y={benchY}
          w={g.supportW * 0.92}
          h={slabH}
          d={slabD}
          type={support}
          title={support === 'is' ? 'Isblokk som tar opp varme fra gassen' : 'Isoporplate som isolerer'}
        />
      )}
      <Bunnplate cx={cx} top={g.flensTop} R={g.flensR} thick={flensT} e={e} heat={heat * 0.8} portX={portX} />

      {/* Glassylinderen med gassen, partiklene og stempelet */}
      <SylinderBak cx={cx} r={g.r} rOuter={g.rOuter} rimY={g.rimY} bottom={g.flensTop} e={e} />
      <Gass cx={cx} r={g.r} top={g.gasTop} bottom={g.flensTop} e={e} warmth={gasWarmth(state.T)} />
      <Foler x={probeX} bottom={g.flensTop + g.r * e * 0.6} len={30} />
      <RadialGradient id={pid} fx={0.35} fy={0.32} stops={sphereStops(COLOR_U)} />
      <g aria-hidden>
        {sim.particles.map((pt, i) => {
          const { x, y } = particlePoint(g, cx, pr, pt.u, pt.w);
          // Simuleringen: vx er mot stempelet (opp), vy bortover. Halen viser farten.
          const tail = 0.13 * scale;
          const tx = Math.max(cx - g.r, Math.min(cx + g.r, x - pt.vy * tail));
          const td = frontArcDepth(g, cx, tx);
          const ty = Math.max(g.gasTop + td, Math.min(g.flensTop + td, y + pt.vx * tail));
          return (
            <g key={i}>
              {scale > 0 && <line x1={tx} y1={ty} x2={x} y2={y} stroke={alpha(COLOR_U, 0.38)} strokeWidth={2.4 * ss} strokeLinecap="round" />}
              <circle cx={x} cy={y} r={pr} fill={`url(#${pid})`} stroke={alpha(VIZ.surface, 0.5)} strokeWidth={0.6 * ss} />
            </g>
          );
        })}
      </g>
      <Stempel cx={cx} r={g.r - 0.5} top={g.pistonTop} bottom={g.gasTop} e={e} rodTop={g.rodTop} rodW={MAAL.stang * PX_PER_M} />
      <SylinderForan cx={cx} r={g.r} rOuter={g.rOuter} rimY={g.rimY} bottom={g.flensTop} e={e} />
      <Rim cx={cx} rOuter={g.rOuter} top={g.rimY} bottom={g.flensTop} amount={frostAmount(state.T)} />

      {/* Termometeret */}
      <Slange d={cable} width={3.4 * Math.min(1.3, ss)} color={SCENE.rubber} />
      <DigitalTermometer
        x={thermo.x}
        y={benchY}
        w={thermo.w}
        h={thermo.h}
        tekst={`${fmt(toCelsius(state.T), 0)} °C`}
        title={`Digitalt termometer som viser ${fmt(toCelsius(state.T), 0)} °C`}
      />
      <ValueTag x={thermo.x} y={benchY - thermo.h - 20 - 14 * f} text={tTag} pointer={8} />

      {/* Startposisjonen og volumet */}
      {moved && (
        <g aria-hidden>
          <path
            d={`M${cx - g.r},${g0.gasTop} A${g.r},${g.r * e} 0 0 0 ${cx + g.r},${g0.gasTop}`}
            fill="none"
            stroke={VIZ.ink}
            strokeWidth={1.4 * ss}
            strokeDasharray={`${5 * ss} ${4 * ss}`}
            opacity={0.65}
          />
          <Txt x={cx - g.r + 8} y={g0.gasTop + g.r * e * 0.5 + (g0.gasTop < g.gasTop ? -8 : 15) * f} anchor="start" size={0.75} muted>
            start
          </Txt>
        </g>
      )}
      {/* Volumet: mållinja langs gassen, med teksten øverst (så den ikke kommer i veien for termometeret) */}
      <Dimension x1={dimX} y1={g.flensTop} x2={dimX} y2={g.gasTop} offset={dimOffset} />
      <Txt x={dimX - dimOffset - 8 * f} y={g.gasTop + 16 * f} anchor="end" size={0.9} weight={650}>
        V = {fmt(state.V * 1000, 1)} L
      </Txt>
      <Txt x={dimX - dimOffset - 8 * f} y={g.gasTop - 4 * f} anchor="end" size={0.8} weight={600} muted>
        1,0 mol luft
      </Txt>

      {/* Energien inn og ut av gassen */}
      {showArrows && (
        <g>
          <ForceArrow x1={wx} y1={wArrow.y1} x2={wx} y2={wArrow.y2} color={COLOR_W} width={8} minLength={4} />
          <ForceArrow x1={qx} y1={qArrow.y1} x2={qx} y2={qArrow.y2} color={COLOR_Q} width={8} minLength={4} />
          <EnergyLabel x={labelX} y={wY!} color={COLOR_W} symbol="W" value={W * state.s} text={twoLines ? 'arbeid på gassen' : undefined} />
          <EnergyLabel x={labelX} y={uY!} color={COLOR_U} symbol="ΔU" value={state.dU} text={twoLines ? 'endring i indre energi' : undefined} />
          <EnergyLabel x={labelX} y={qY!} color={COLOR_Q} symbol="Q" value={Q * state.s} text={twoLines ? 'tilført varme' : undefined} />
        </g>
      )}
      <Callout x={cx + g.supportW * 0.36} y={benchY - slabH * 0.45} lx={labelX + 10} ly={callY} anchor="start" size={0.8}>
        {supportName}
      </Callout>
    </>
  );
}

/** Etikett med symbol og verdi i energifargen, og hva det er under. (x, y) er venstre kant, midt mellom linjene. */
function EnergyLabel({ x, y, color, symbol, value, text }: { x: number; y: number; color: string; symbol: string; value: number; text?: string }) {
  const f = useTextScale();
  return (
    <g>
      <Txt x={x} y={text ? y - 2 * f : y + 6 * f} anchor="start" color={color} weight={720} size={1}>
        {symbol} = {signed(value)} J
      </Txt>
      {text && (
        <Txt x={x} y={y + 15 * f} anchor="start" size={0.75} muted>
          {text}
        </Txt>
      )}
    </g>
  );
}
