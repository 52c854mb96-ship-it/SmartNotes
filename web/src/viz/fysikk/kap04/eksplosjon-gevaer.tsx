/**
 * Scenen «Gevær og kule» til «Eksplosjon og rekyl»: en jaktrifle ligger løst på to sandsekker på et skytebord ute på
 * skytebanen (innskyting før jakta). Løpet er tegnet gjennomskåret, så kula og kruttgassen synes mens kula går
 * gjennom løpet. Alt i én skala px/m, og avspillingen går i sakte film (tusendels sekunder).
 *
 * I virkelig skala er kula og gassen bare noen få piksler, så en lupe under geværet viser løpet forstørret, med
 * kraftparet fra kruttgassen der det virker (på kula og på sluttstykket). Rekylfarten er så liten at fartspila til
 * geværet tegnes forstørret (1, 2 eller 5 ganger en tierpotens), og forstørrelsen står ved pila.
 */
import { useMemo } from 'react';
import { Txt, VIZ, fmt, useTextScale } from '../../kit';
import { ForceArrow, Himmel, Landskap, SCENE, Underlag, useStrokeScale } from '../../kit/scene';
import { Gevaerkule, Jaktrifle, Kruttroyk, RIFLE, Skilt, Skytepute, tagWidth } from './eksplosjon-deler';
import { arrowZoom, bulletSize, exitTime } from './eksplosjon-form';
import { RifleLupe, lupeHeight } from './eksplosjon-lupe';
import { pushAt, type PushResult } from './model';
import {
  BodyLabels,
  HeadRow,
  TAG_SIZE,
  W,
  arrowScale,
  placeTags,
  speedTag,
  sumText,
  topRows,
  type Timeline,
  type TopRows,
} from './eksplosjon-scene';

/** Avfyringen (s) og hvor lenge røyken vises etter at kula er ute (andel av tiden etterpå). */
const FIRE = 0.0003;
/** Den største kraften fra kruttgassen med glidebryterne (4 kJ over løpet), som får den lengste kraftpila i lupen. */
const F_MAX = 4000 / RIFLE.barrel;
/** Massesenteret til rifla (m bak munningen): der masse, fartspil og fartsskilt står. */
const RIFLE_CM = 0.72;

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
  /** Lupen under geværet: plassering, piksler per meter og den lengste kraftpila i den. */
  lupe: { x: number; y: number; w: number; h: number };
  M: number;
  maxForceArrow: number;
}

export function rifleLayout(f: number, narrow: boolean): RifleLayout {
  const P = narrow ? 430 : 380;
  const arrowLen = narrow ? 100 : 150;
  const rows = topRows(f);
  const labelRoom = 17 * f * 0.85 + 10;
  const axisY = Math.round(rows.below + labelRoom + 0.09 * P);
  const tableY = axisY + 0.16 * P;
  const muzzle = narrow ? 525 : 500;
  const k = 1 + 0.4 * (Math.max(1, f) - 1);
  // Lupen ligger på skytebordet under geværet, nesten like bred som figuren
  const M = narrow ? 3400 : 3000;
  const mx = narrow ? 8 : 14;
  const lupe = { x: mx, y: Math.round(tableY + 12 + 4 * f), w: W - 2 * mx, h: Math.round(lupeHeight(f, M)) };
  const H = lupe.y + lupe.h + 12;
  const maxForceArrow = narrow ? 112 : 100;
  return { f, P, arrowLen, H, rows, muzzle, axisY, tableY, horizon: axisY - 0.13 * P, stopX: W - 22 - arrowLen * k, lupe, M, maxForceArrow };
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

/**
 * Skalaen for fartspilene (px per m/s, den samme for kula og geværet) og forstørrelsen av pila til geværet, så den
 * synes: rekylfarten er ofte under en hundredel av farten til kula.
 */
export function rifleArrows(spec: RifleSpec, layout: RifleLayout): { S: number; zoom: number } {
  const { r } = spec;
  const S = arrowScale(Math.max(Math.abs(r.v1), Math.abs(r.v2)), layout.f, 60, layout.arrowLen);
  const c1 = layout.muzzle - RIFLE_CM * layout.P;
  // Pila går mot venstre fra massesenteret; forstørrelsen («× 200») står til venstre for spissen.
  const note = 6 * 17 * 0.8 * layout.f * 0.6;
  const maxLen = Math.min(layout.arrowLen * (layout.f > 1.2 ? 1 : 0.75), c1 - 24 - note);
  return { S, zoom: arrowZoom(Math.abs(r.v1) * S, maxLen) };
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
  const ss = useStrokeScale();
  const { m1, m2, r } = spec;
  const { P, axisY, tableY, H, rows, lupe, M } = layout;
  const ts = t - tl.release;
  const { st, muzzleX, travel, bulletX, inBarrel } = rifleFrame(spec, layout, ts);
  const bs = bulletSize(m2);
  const bulletMid = bulletX + (bs.length * P) / 2;
  const { S, zoom } = rifleArrows(spec, layout);
  const forcesNow = showForces && st.phase === 'under';
  const labelGap = 6 + 4 * f;
  const scopeTop = axisY - 0.083 * P;
  // Rifla: etiketten og fartspila over massesenteret (ved kikkerten); kula: over kula
  const c1 = muzzleX - RIFLE_CM * P;
  const c2 = Math.min(bulletMid, W - 30);
  const p = m1 * st.v1 + m2 * st.v2;
  const exitAt = r.dt;
  const smokeAge = st.phase === 'etter' ? (ts - exitAt) / Math.max(1e-9, (tl.end - tl.release - exitAt) * 1.6) : -1;
  const gas = st.phase === 'under' ? 1 : st.phase === 'etter' ? Math.max(0, 1 - smokeAge * 3) : 0;
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

  // Rammen rundt løpet i scenen, og strekene derfra til lupen
  const fx0 = muzzleX - (RIFLE.barrel + RIFLE.caseLength + 0.05) * P;
  const fx1 = muzzleX + 0.012 * P;
  const fTop = axisY - 0.026 * P;
  const fBot = axisY + 0.026 * P;
  const frameLines = [
    [fx0, fBot, lupe.x + 10, lupe.y],
    [fx1, fBot, lupe.x + lupe.w - 10, lupe.y],
  ] as const;

  // Fartspilene: én skala for begge, men pila til geværet forstørret `zoom` ganger
  const t1 = speedTag('₁', st.v1, 2);
  const t2 = speedTag('₂', st.v2, 0);
  const [a, b] = placeTags(c1, c2, tagWidth(t1, f, TAG_SIZE), tagWidth(t2, f, TAG_SIZE));
  const len1 = st.v1 * S * zoom;
  const zoomText = `× ${fmt(zoom, 0)}`;

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
        gas={gas}
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

      {/* Lupen: rammen rundt løpet og strekene ned til nærbildet */}
      <g fill="none" strokeLinecap="round" aria-hidden>
        {frameLines.map(([ax, ay, bx, by], i) => (
          <line key={`h${i}`} x1={ax} y1={ay} x2={bx} y2={by} stroke={VIZ.surface} strokeWidth={3.4 * ss} opacity={0.7} />
        ))}
        <rect x={fx0} y={fTop} width={fx1 - fx0} height={fBot - fTop} rx={4 * ss} stroke={VIZ.surface} strokeWidth={3.4 * ss} opacity={0.7} />
        {frameLines.map(([ax, ay, bx, by], i) => (
          <line key={`l${i}`} x1={ax} y1={ay} x2={bx} y2={by} stroke={VIZ.ink} strokeWidth={1.1 * ss} opacity={0.75} />
        ))}
        <rect x={fx0} y={fTop} width={fx1 - fx0} height={fBot - fTop} rx={4 * ss} stroke={VIZ.ink} strokeWidth={1.3 * ss} />
      </g>
      <RifleLupe
        {...lupe}
        M={M}
        zoom={M / P}
        travel={travel}
        powder={st.phase === 'for'}
        gas={gas}
        force={forcesNow ? st.F : null}
        kF={layout.maxForceArrow / F_MAX}
        maxArrow={layout.maxForceArrow}
        bulletLength={bs.length}
        bulletDiameter={bs.diameter}
      />

      <BodyLabels
        x1={c1}
        y1={scopeTop - labelGap}
        x2={c2}
        y2={scopeTop - labelGap}
        mass1={`${fmt(m1, 1)} kg`}
        mass2={`${fmt(m2 * 1000, 0)} g`}
        force={null}
      />

      {/* Fartspilene og skiltene; pila til geværet er forstørret, og forstørrelsen står ved spissen */}
      <ForceArrow x1={c1} y1={rows.arrowY} x2={c1 + len1} y2={rows.arrowY} color={VIZ.velocity} width={6} origin minLength={2} />
      <ForceArrow x1={c2} y1={rows.arrowY} x2={c2 + st.v2 * S} y2={rows.arrowY} color={VIZ.velocity} width={6} origin minLength={2} />
      {zoom > 1 && Math.abs(len1) > 12 && (
        <Txt x={c1 + len1 - 9 * ss} y={rows.arrowY + 5 * f} anchor="end" size={0.8} weight={700} color={VIZ.velocity}>
          {zoomText}
        </Txt>
      )}
      <Skilt x={a} y={rows.tagY} measure={t1} color={VIZ.velocity}>
        {t1}
      </Skilt>
      <Skilt x={b} y={rows.tagY} measure={t2} color={VIZ.velocity}>
        {t2}
      </Skilt>

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
