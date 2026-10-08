/**
 * Figurene til «Bølger»: scenen i fysikkrommet (en elev rister i et tau eller dytter i en lang spiralfjær på
 * labbenken, med målebånd på gulvet) og grafen over utslaget til det merkede punktet som funksjon av tiden.
 *
 * Én skala PX_PER_M i hele scenen (se bolger-scene.ts). Fartspilene (bølgen og det merkede punktet) har én felles
 * skala, så de kan sammenlignes.
 */
import { memo, type ReactNode } from 'react';
import { Arrow, Plot, Txt, VIZ, fmt, linePath, sample, useTextScale } from '../../kit';
import { Callout, Dimension, ForceArrow, Maalebaand, Person, Rom, Tau, Underlag, alpha, useSceneScale, useStrokeScale } from '../../kit/scene';
import { Spiralfjaer, Tauband } from './bolger-deler';
import {
  BENCH_M,
  COIL_M,
  PERSON_SIZE,
  PX_PER_M,
  ROPE_M,
  SLINKY_R_M,
  W,
  X0,
  X_END,
  X_MAX,
  XP,
  coilPositions,
  compressionCenters,
  driverPose,
  lambdaSpan,
  rarefactionCenters,
  speedScale,
  type WaveKind,
} from './bolger-scene';
import { ColorDot } from './marks';
import { crestPositions, particleVelocity, period, waveDisplacement } from './model';

/** Fargen til det merkede punktet (båndet eller vindingen) og grafen for det. */
export const MARK = VIZ.series[1];

/** Høyden på scenen: høyere på mobil, der teksten og målebåndet er større. */
export const sceneHeight = (narrow: boolean) => (narrow ? 430 : 340);

const px = (x: number) => X0 + x * PX_PER_M;
/** Omtrent bredden på «λ = 0,00 m» på PC (figurens enheter). */
const LAMBDA_LABEL_W = 92;

/** Fysikkrommet: vegg og betonggulv, og labbenken når fjæra ligger på den. Endres ikke under avspillingen. */
const Backdrop = memo(function Backdrop({ H, floor, bench }: { H: number; floor: number; bench: number | null }) {
  // Veggen møter gulvet bak benken, så overgangen skjules av den (se Rom).
  const gulvY = floor - 22;
  return (
    <>
      <Rom x={-2} y={0} w={W + 4} h={H} gulvY={gulvY} gulv="betong" />
      {bench !== null && <Underlag x1={px(-0.12)} x2={W + 4} y={bench} depth={floor - bench} type="labbenk" seed={2} />}
    </>
  );
});

export interface WaveSceneProps {
  kind: WaveKind;
  t: number;
  A: number;
  lambda: number;
  f: number;
  H: number;
  /** Vis målene (λ og A) og fartspilene. */
  show: boolean;
}

export function WaveScene({ kind, t, A, lambda, f, H, show }: WaveSceneProps) {
  const fT = useTextScale();
  const k = useSceneScale();
  const ss = useStrokeScale();
  const floor = H - (fT > 1.2 ? 70 : 46);
  const yOf = (m: number) => floor - m * PX_PER_M;
  const u = (x: number) => waveDisplacement(x, t, A, lambda, f);
  const v = lambda * f;
  const uMax = 2 * Math.PI * f * A;
  const kS = speedScale(v, uMax);
  const uP = particleVelocity(XP, t, A, lambda, f);
  const tapeY = floor + 9;
  const longi = kind === 'longitudinal';
  const bench = longi ? yOf(BENCH_M) : null;
  const look = { jakke: 'gronn', har: 'brun', frisyre: 'hestehale' as const, sko: 'svart' };
  const tape = <Maalebaand x1={px(0)} x2={px(X_MAX)} y={tapeY} til={X_MAX} />;

  // Fartspila for bølgen: øverst til venstre, fra x = 0,5 m. Lengden er v · kS (minst 18, så den alltid synes).
  const vArrow = (y: number) => (
    <ForceArrow
      x1={px(0.5)}
      y1={y}
      x2={px(0.5) + Math.max(18, v * kS)}
      y2={y}
      color={VIZ.velocity}
      width={6}
      label={`v = ${fmt(v, 2)} m/s`}
    />
  );

  if (!longi) {
    const yRope = yOf(ROPE_M);
    const ropeY = (x: number) => yRope - u(x) * PX_PER_M;
    const hand = { x: px(0), y: ropeY(0) };
    const back = { x: hand.x - 0.11 * PX_PER_M, y: hand.y + 0.015 * PX_PER_M };
    const pose = driverPose(hand, floor, 'transversal');
    // Tauet: enden henger ned bak den bakerste hånda, så går det gjennom begge hendene og bortover.
    const pts: [number, number][] = [
      [back.x - 0.05 * PX_PER_M, back.y + 0.3 * PX_PER_M],
      [back.x - 0.07 * PX_PER_M, back.y + 0.14 * PX_PER_M],
      [back.x - 0.04 * PX_PER_M, back.y + 0.03 * PX_PER_M],
      [back.x, back.y],
    ];
    const step = Math.min(0.03, lambda / 24);
    for (let x = 0; x <= X_END + 1e-9; x += step) pts.push([px(x), ropeY(x)]);
    const Apx = A * PX_PER_M;

    // λ mellom to daler (eller topper), med mållinja under dalene og hjelpelinjer ned til målebåndet.
    const span = lambdaSpan('transversal', t, lambda, f);
    const yDim = yRope + Apx + 0.17 * PX_PER_M;
    // A ved en topp eller dal mellom eleven og båndet.
    const crests = crestPositions(t, lambda, f, 0, X_MAX).map((x) => ({ x, up: true }));
    const troughs = crestPositions(t + 0.5 / f, lambda, f, 0, X_MAX).map((x) => ({ x, up: false }));
    const aAt = [...crests, ...troughs].filter((p) => p.x > 0.55 && p.x < 2.55).sort((p, q) => p.x - q.x)[0];
    const xr = px(XP);

    return (
      <g>
        <Backdrop H={H} floor={floor} bench={null} />
        {/* Likevektslinja: der tauet ligger når ingen rister i det */}
        <line x1={px(0)} x2={W} y1={yRope} y2={yRope} stroke={VIZ.muted} strokeWidth={1.2 * ss} strokeDasharray={`${5 * ss} ${5 * ss}`} opacity={0.65} />
        {/* Båndet går bare opp og ned langs den stiplede streken */}
        <Track x1={xr} y1={yRope - Apx} x2={xr} y2={yRope + Apx} />
        <Tau points={pts} tykkelse={5 * ss} />
        <Person
          x={pose.x}
          y={floor}
          size={PERSON_SIZE}
          pose="dra"
          ledd={pose.ledd}
          fest={{ hoyreHand: hand, venstreHand: back }}
          {...look}
        />
        <Tauband x={xr} y={ropeY(XP)} color={MARK} size={9 * k} />
        {tape}

        {show && span !== undefined && (
          <g>
            {[span, span + lambda].map((x) => (
              <line key={x} x1={px(x)} x2={px(x)} y1={ropeY(x) + 5 * ss} y2={yDim} stroke={VIZ.ink} strokeWidth={1 * ss} strokeDasharray="3 3" opacity={0.55} />
            ))}
            <Dimension x1={px(span)} y1={tapeY} x2={px(span + lambda)} y2={tapeY} offset={tapeY - yDim} />
            {lambda * PX_PER_M >= LAMBDA_LABEL_W * fT + 12 ? (
              <Txt x={px(span + lambda / 2)} y={yDim + 8 + 14 * fT} weight={700}>
                λ = {fmt(lambda, 2)} m
              </Txt>
            ) : (
              // Kort bølgelengde: teksten ved siden av mållinja, så hjelpelinjene ikke går gjennom den.
              <Txt x={px(span + lambda) + 8} y={yDim + 6 * fT} anchor="start" weight={700}>
                λ = {fmt(lambda, 2)} m
              </Txt>
            )}
          </g>
        )}
        {show && aAt && Apx >= 16 && (
          <Dimension x1={px(aAt.x)} y1={yRope} x2={px(aAt.x)} y2={aAt.up ? yRope - Apx : yRope + Apx} label="A" labelSize={1} />
        )}
        {show && (
          <ForceArrow x1={xr + 15 * k} y1={ropeY(XP)} x2={xr + 15 * k} y2={ropeY(XP) - uP * kS} color={VIZ.velocity} width={4.5} minLength={5} />
        )}
        {show && vArrow(yOf(ROPE_M + 0.5 + 0.3))}
      </g>
    );
  }

  // Longitudinal: fjæra ligger på labbenken, og eleven dytter enden fram og tilbake langs fjæra.
  const yBench = bench!;
  const R = SLINKY_R_M * PX_PER_M * k;
  const yAxis = yBench - R;
  const coils = coilPositions(t, A, lambda, f).map(px);
  const hand = { x: coils[0]!, y: yAxis };
  const pose = driverPose(hand, floor, 'longitudinal');
  const iP = Math.round(XP / COIL_M);
  const xm = coils[iP]!;
  const top = yAxis - R;
  const trackY = top - 8 * k;
  const arrowY = top - 21 * k;
  const yDim = top - 26 - 8 * k - 12 * fT;

  // λ mellom to fortetninger, med mållinja over fjæra.
  const span = lambdaSpan('longitudinal', t, lambda, f);
  // Navn på en fortetning og en fortynning under fjæra, langt nok fra hverandre til at tekstene ikke overlapper.
  // (Posisjonene er der vindingene er nå; i midten av en fortetning eller fortynning er forskyvningen null.)
  const comp = compressionCenters(t, lambda, f, 0.9, X_MAX - 0.9);
  const c0 = comp[0];
  const rare = c0 === undefined ? undefined : rarefactionCenters(t, lambda, f, 0.9, X_MAX - 0.9).find((x) => Math.abs(px(x) - px(c0)) > 118 * fT);
  const labelY = yBench + 26 + 18 * fT;

  return (
    <g>
      <Backdrop H={H} floor={floor} bench={yBench} />
      {tape}
      <Spiralfjaer coils={coils} y={yAxis} r={R} mark={iP} markColor={MARK} maxX={W + 10} />
      <Person
        x={pose.x}
        y={floor}
        size={PERSON_SIZE}
        pose="dra"
        ledd={{ ...pose.ledd, venstreSkulder: 4, venstreAlbue: 28 }}
        fest={{ hoyreHand: hand }}
        {...look}
      />
      {/* Den merkede vindingen går bare fram og tilbake langs den stiplede streken */}
      <Track x1={px(XP - A)} y1={trackY} x2={px(XP + A)} y2={trackY} />
      {c0 !== undefined && (
        <Callout x={px(c0)} y={yAxis + R * 0.7} lx={px(c0)} ly={labelY} anchor="middle" size={0.85}>
          fortetning
        </Callout>
      )}
      {rare !== undefined && (
        <Callout x={px(rare)} y={yAxis + R * 0.7} lx={px(rare)} ly={labelY} anchor="middle" size={0.85}>
          fortynning
        </Callout>
      )}
      {show && span !== undefined && (
        <Dimension x1={px(span)} y1={top - 3} x2={px(span + lambda)} y2={top - 3} offset={top - 3 - yDim} label={`λ = ${fmt(lambda, 2)} m`} labelSize={1} />
      )}
      {show && <ForceArrow x1={xm} y1={arrowY} x2={xm + uP * kS} y2={arrowY} color={VIZ.velocity} width={4.5} minLength={5} />}
      {show && vArrow(yDim - 34 - 22 * fT)}
    </g>
  );
}

/** Stiplet strek som viser hvor langt det merkede punktet svinger, med små tverrstreker i endene. */
function Track({ x1, y1, x2, y2 }: { x1: number; y1: number; x2: number; y2: number }) {
  const ss = useStrokeScale();
  const len = Math.hypot(x2 - x1, y2 - y1);
  if (!(len > 1)) return null;
  const nx = (-(y2 - y1) / len) * 5 * ss;
  const ny = ((x2 - x1) / len) * 5 * ss;
  return (
    <g stroke={MARK} strokeWidth={2.2 * ss} strokeLinecap="round" aria-hidden>
      <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={alpha(VIZ.surface, 0.7)} strokeWidth={4.5 * ss} />
      <line x1={x1} y1={y1} x2={x2} y2={y2} strokeDasharray={`${4 * ss} ${4 * ss}`} />
      <line x1={x1 - nx} y1={y1 - ny} x2={x1 + nx} y2={y1 + ny} />
      <line x1={x2 - nx} y1={y2 - ny} x2={x2 + nx} y2={y2 + ny} />
    </g>
  );
}

/** Høyden på grafen. */
export const graphHeight = (narrow: boolean) => (narrow ? 400 : 270);
/** Tidsvinduet i grafen (s). */
export const T_WINDOW = 10;

/** Utslaget (eller forskyvningen) til det merkede punktet som funksjon av tiden, med perioden T målt mellom to topper. */
export function TimeGraph({ kind, t, A, lambda, f, height }: { kind: WaveKind; t: number; A: number; lambda: number; f: number; height: number }) {
  const s = useTextScale();
  const yp = (tt: number) => waveDisplacement(XP, tt, A, lambda, f);
  const T = period(f);
  // Første topp: f·t − x/λ = 1/4 + n
  const n0 = Math.ceil(XP / lambda - 0.25 - 1e-9);
  let tPeak = (0.25 + n0 - XP / lambda) / f;
  while (tPeak < 0) tPeak += T;
  const dimY = A + 0.13;
  return (
    <Plot
      x={{ min: 0, max: T_WINDOW, label: 'Tid t (s)' }}
      y={{ min: -0.65, max: 0.8, label: kind === 'longitudinal' ? 'Forskyvning (m)' : 'Utslag y (m)', ticks: [-0.5, 0, 0.5], decimals: 1 }}
      width={800}
      height={height}
    >
      {({ sx, sy }) => (
        <g>
          {/* Amplituden: de stiplede linjene i ± A, som sporet til båndet i scenen */}
          {[A, -A].map((a) => (
            <line key={a} x1={sx(0)} x2={sx(T_WINDOW)} y1={sy(a)} y2={sy(a)} stroke={MARK} strokeWidth={1.2} strokeDasharray="4 5" opacity={0.45} />
          ))}
          <path d={linePath(sample(yp, 0, T_WINDOW, 800), sx, sy)} fill="none" stroke={MARK} strokeWidth={3} strokeLinejoin="round" />
          {tPeak + T <= T_WINDOW && (
            <g>
              <line x1={sx(tPeak)} x2={sx(tPeak)} y1={sy(A) - 4} y2={sy(dimY) - 8} className="viz-guide" />
              <line x1={sx(tPeak + T)} x2={sx(tPeak + T)} y1={sy(A) - 4} y2={sy(dimY) - 8} className="viz-guide" />
              <Arrow x1={sx(tPeak + T / 2)} y1={sy(dimY)} x2={sx(tPeak) + 1} y2={sy(dimY)} color={VIZ.ink} width={1.8} head={9} />
              <Arrow x1={sx(tPeak + T / 2)} y1={sy(dimY)} x2={sx(tPeak + T) - 1} y2={sy(dimY)} color={VIZ.ink} width={1.8} head={9} />
              {sx(tPeak + T) + 8 + 5.6 * 17 * s <= sx(T_WINDOW) ? (
                <Txt x={sx(tPeak + T) + 8} y={sy(dimY) + 6} anchor="start" weight={700}>
                  T = {fmt(T, 2)} s
                </Txt>
              ) : (
                <Txt x={sx(tPeak + T / 2)} y={sy(dimY) - 9} weight={700}>
                  T = {fmt(T, 2)} s
                </Txt>
              )}
            </g>
          )}
          <line x1={sx(t)} x2={sx(t)} y1={sy(-0.65)} y2={sy(0.8)} stroke={VIZ.ink} strokeWidth={1.5} opacity={0.4} />
          <ColorDot x={sx(t)} y={sy(yp(t))} r={8 * Math.min(s, 1.2)} color={MARK} />
        </g>
      )}
    </Plot>
  );
}

/** Tekst til forklaringen under figuren (brukes også i Legend). */
export function markName(kind: WaveKind): ReactNode {
  return kind === 'transversal' ? 'Båndet på tauet (x = 3 m) og grafen for det' : 'Den merkede vindingen (x = 3 m) og grafen for den';
}
