/**
 * Scenen «Gevær og kule» til «Eksplosjon og rekyl»: en jaktrifle ligger løst på to sandsekker på et skytebord ute på
 * skytebanen (innskyting før jakta). Løpet er tegnet gjennomskåret, så kula og kruttgassen synes mens kula går
 * gjennom løpet. Alt i én skala px/m, og avspillingen går i sakte film (tusendels sekunder).
 */
import { useMemo } from 'react';
import { VIZ, fmt, useTextScale } from '../../kit';
import { ForceArrow, Himmel, Landskap, SCENE, Underlag, useStrokeScale } from '../../kit/scene';
import { Gevaerkule, Jaktrifle, Kruttroyk, RIFLE, Skytepute } from './eksplosjon-deler';
import { bulletSize, exitTime } from './eksplosjon-form';
import { pushAt, type PushResult } from './model';
import { BodyLabels, HeadRow, VelocityPair, W, arrowScale, sumText, topRows, type Timeline, type TopRows } from './eksplosjon-scene';

/** Avfyringen (s) og hvor lenge røyken vises etter at kula er ute (andel av tiden etterpå). */
const FIRE = 0.0003;

export interface RifleLayout {
  f: number;
  P: number;
  /** Lengden på den lengste fartspila (før mobilskaleringen). */
  arrowLen: number;
  H: number;
  rows: TopRows;
  /** Munningen ved start (x) og løpets akse (y). */
  muzzle: number;
  axisY: number;
  tableY: number;
  horizon: number;
  /** Kula skal stoppe her (midten), så fartspila fortsatt får plass i figuren. */
  stopX: number;
}

export function rifleLayout(f: number, narrow: boolean): RifleLayout {
  const P = narrow ? 430 : 380;
  const arrowLen = narrow ? 100 : 150;
  const rows = topRows(f);
  const labelRoom = 17 * f * 0.85 + 10;
  const axisY = Math.round(rows.below + labelRoom + 0.09 * P);
  const tableY = axisY + 0.16 * P;
  const H = Math.round(tableY + 40 + 10 * f);
  const muzzle = narrow ? 525 : 500;
  const k = 1 + 0.4 * (Math.max(1, f) - 1);
  return { f, P, arrowLen, H, rows, muzzle, axisY, tableY, horizon: axisY - 0.13 * P, stopX: W - 22 - arrowLen * k };
}

export interface RifleSpec {
  m1: number;
  m2: number;
  r: PushResult;
}

/** Rifla og kula ved tiden ts etter avfyringen (figurens enheter). */
export function rifleFrame(spec: RifleSpec, layout: RifleLayout, ts: number) {
  const { P, muzzle } = layout;
  const st = pushAt(spec.m1, spec.m2, spec.r, ts);
  const muzzleX = muzzle + st.x1 * P;
  // Bakkanten av kula: starter foran i patronhylsa (ved kammeret), og har gått st.x2 − st.x1 i forhold til løpet.
  const travel = st.x2 - st.x1;
  const bulletX = muzzle - RIFLE.barrel * P + st.x2 * P;
  return { st, muzzleX, travel, bulletX, inBarrel: travel < RIFLE.barrel };
}

export function rifleTimeline(spec: RifleSpec, layout: RifleLayout): Timeline {
  const { r } = spec;
  const { length } = bulletSize(spec.m2);
  const fr = rifleFrame(spec, layout, r.dt);
  // Etter at kula er ute: til midten av kula når stopX (eller rifla har gått langt, som aldri skjer med disse tallene)
  const flight = exitTime([fr.bulletX + (length * layout.P) / 2], [r.v2 * layout.P], -Infinity, layout.stopX, 0.01);
  return { release: FIRE, end: FIRE + r.dt + Math.max(flight, 0.00005) };
}

export function RifleScene({
  spec,
  layout,
  tl,
  t,
  showForces,
}: {
  spec: RifleSpec;
  layout: RifleLayout;
  tl: Timeline;
  t: number;
  showForces: boolean;
}) {
  const f = useTextScale();
  const { m1, m2, r } = spec;
  const { P, axisY, tableY, H, rows } = layout;
  const ts = t - tl.release;
  const { st, muzzleX, travel, bulletX, inBarrel } = rifleFrame(spec, layout, ts);
  const bs = bulletSize(m2);
  const bulletMid = bulletX + (bs.length * P) / 2;
  const S = arrowScale(Math.max(Math.abs(r.v1), Math.abs(r.v2)), f, 60, layout.arrowLen);
  // Kraften fra kruttgassen: én skala px/N (6 667 N, det største med glidebryterne, gir 0,22 m)
  const kF = (0.22 * P) / 6667;
  const forcesNow = showForces && st.phase === 'under';
  const labelGap = 6 + 4 * f;
  const scopeTop = axisY - 0.083 * P;
  // Rifla: etiketten og fartspila over kolben; kula: over kula
  const c1 = muzzleX - 0.98 * P;
  const p = m1 * st.v1 + m2 * st.v2;
  const exitAt = r.dt;
  const smokeAge = st.phase === 'etter' ? (ts - exitAt) / Math.max(1e-9, (tl.end - tl.release - exitAt) * 1.6) : -1;
  const title = st.phase === 'for' ? 'Før skuddet' : st.phase === 'under' ? 'Kula går gjennom løpet' : 'Etter skuddet';
  const backdrop = useMemo(
    () => (
      <>
        <Himmel w={W} h={layout.horizon + 4} skyer={2} seed={7} />
        <Landskap x={0} y={layout.horizon} w={W} h={Math.min(0.13 * P, layout.horizon * 0.4)} type="skog" seed={6} />
        <Underlag x1={0} x2={W} y={tableY - 1} depth={4} type="gress" horisont={layout.horizon} seed={3} />
        <Skive x={W * 0.88} y={layout.horizon + 8} s={Math.max(9, 0.04 * P)} />
        <Underlag x1={-10} x2={W + 10} y={tableY} depth={H - tableY} type="tregulv" seed={4} />
      </>
    ),
    [layout.horizon, P, tableY, H],
  );

  const rX = (m: number) => muzzleX + m * P;
  // Kraftpilene like over løpet, så de ikke skjuler kula og gassen inni
  const fy = axisY - 0.03 * P;
  return (
    <>
      {backdrop}

      {/* Sandsekkene: under forskjeftet og under kolben */}
      <Skytepute x={layout.muzzle + RIFLE.restFront * P} y={tableY} w={0.16 * P} h={tableY - (axisY + RIFLE.restFrontY * P)} />
      <Skytepute x={layout.muzzle + RIFLE.restBack * P} y={tableY} w={0.12 * P} h={tableY - (axisY + RIFLE.restBackY * P)} />

      <Jaktrifle
        x={muzzleX}
        y={axisY}
        P={P}
        bullet={inBarrel ? Math.max(0, travel) : null}
        gas={st.phase === 'under' ? 1 : st.phase === 'etter' ? Math.max(0, 1 - smokeAge * 3) : 0}
        bulletLength={bs.length}
        bulletDiameter={bs.diameter}
        title={`Jaktrifle, ${fmt(m1, 1)} kg`}
      />
      {!inBarrel && (
        <>
          <Kruttroyk x={muzzleX} y={axisY} age={smokeAge} size={0.09 * P} />
          {bulletX < W + 4 && <Gevaerkule x={bulletX} y={axisY} P={P} length={bs.length} diameter={bs.diameter} />}
        </>
      )}

      {/* Kraftparet mens kula er i løpet: gassen dytter kula fram og rifla bak (på bunnen av patronen) */}
      {forcesNow && (
        <>
          <ForceArrow x1={bulletX} y1={fy} x2={bulletX + st.F * kF} y2={fy} color={VIZ.applied} width={5} minLength={2} origin />
          <ForceArrow
            x1={rX(-RIFLE.barrel - RIFLE.caseLength)}
            y1={fy}
            x2={rX(-RIFLE.barrel - RIFLE.caseLength) - st.F * kF}
            y2={fy}
            color={VIZ.applied}
            width={5}
            minLength={2}
            origin
          />
        </>
      )}

      <BodyLabels
        x1={c1}
        y1={scopeTop - labelGap}
        x2={Math.min(bulletMid, W - 30)}
        y2={scopeTop - labelGap}
        mass1={`${fmt(m1, 1)} kg`}
        mass2={`${fmt(m2 * 1000, 0)} g`}
        force={forcesNow ? st.F : null}
      />

      <VelocityPair rows={rows} c1={c1} c2={Math.min(bulletMid, W - 30)} v1={st.v1} v2={st.v2} S={S} d1={2} d2={0} />

      <HeadRow rows={rows} title={title} sum={sumText(p, 2)} />
    </>
  );
}

/** Skyteskive langt borte: hvit papp med svarte ringer på to stolper. (x, y) er midt mellom stolpene på bakken. */
function Skive({ x, y, s }: { x: number; y: number; s: number }) {
  const ss = useStrokeScale();
  return (
    <g aria-hidden opacity={0.9}>
      <rect x={x - s * 0.42} y={y - s * 1.9} width={s * 0.08} height={s * 1.9} fill={SCENE.woodDark} />
      <rect x={x + s * 0.34} y={y - s * 1.9} width={s * 0.08} height={s * 1.9} fill={SCENE.woodDark} />
      <rect x={x - s * 0.5} y={y - s * 2} width={s} height={s} fill={SCENE.plastic} stroke={SCENE.outline} strokeWidth={0.6 * ss} />
      <circle cx={x} cy={y - s * 1.5} r={s * 0.36} fill="none" stroke={SCENE.rubber} strokeWidth={Math.max(0.6, s * 0.06)} />
      <circle cx={x} cy={y - s * 1.5} r={s * 0.18} fill={SCENE.rubber} />
    </g>
  );
}
