/**
 * Scenen «Vogner med fjær» til «Eksplosjon og rekyl»: to dynamikkvogner står inntil hverandre på en aluminiumsbane
 * med målebånd i fysikklaben. En skruefjær på vogn 1 er presset sammen mot vogn 2, og en snor rundt vognene holder
 * den sammen. Når snora kuttes, spretter fjæra ut og dytter vognene fra hverandre. Alt i én skala px/m.
 */
import { useMemo } from 'react';
import { fmt, useTextScale } from '../../kit';
import { Fjaer, Maalebaand, Rom, SCENE, Snor, Underlag, Vogn, hjulvinkelFraStrekning, useStrokeScale } from '../../kit/scene';
import { Labbane } from './eksplosjon-deler';
import { exitTime } from './eksplosjon-form';
import { pushAt, type PushResult } from './model';
import { BodyLabels, ForcePair, HeadRow, VelocityPair, W, arrowScale, sumText, topRows, type Timeline, type TopRows } from './eksplosjon-scene';

/** Banebiten som vises (m): på mobil en kortere bit, så vognene blir store nok. */
const TRACK_WIDE = 1.2;
const TRACK_NARROW = 0.8;
const X0 = 20;
/** Vogna (scene-kit-et): 0,2 m lang, endestykkene til ±0,101 m, hjulradius 0,014 m. */
const CART_END = 0.101;
const CART_LEN = 0.2;
const WHEEL_R = 0.014;
/** Høyden på vogna med tre lodd oppå (m). */
const CART_TALL = 0.111;
/** Fjæra: hvilelengde, hvor mye den er presset sammen (= hvor mye avstanden øker mens den dytter) og høyden over banen. */
export const SPRING_L0 = 0.07;
export const SPRING_TRAVEL = 0.045;
const SPRING_Y = 0.04;
const SPRING_R = 0.011;
/** Snora rundt vognene (høyde over banen). */
const THREAD_Y = 0.051;
/** Endestoppene (m): bredden på klossen. */
const STOP_W = 0.014;
/** Utløsningen (s) og lengste avspilling etter den. */
const CART_RELEASE = 0.5;
const CART_MAX = 5;

/** Antall lodd oppå vogna (0–3), så tunge vogner ser tunge ut. Den tomme vogna er 0,5 kg. */
export function loddFor(m: number): number {
  return Math.min(3, Math.max(0, Math.round((m - 0.5) / 1.5)));
}

export interface CartLayout {
  f: number;
  P: number;
  length: number;
  H: number;
  rows: TopRows;
  trackY: number;
  trackH: number;
  benchY: number;
  /** Midten av banen, der fjæra er ved start. */
  xc: number;
  /** Grensene for midten av en vogn før den treffer endestoppet. */
  lo: number;
  hi: number;
}

export function cartLayout(f: number, narrow: boolean): CartLayout {
  const length = narrow ? TRACK_NARROW : TRACK_WIDE;
  const P = (W - 2 * X0) / length;
  const rows = topRows(f);
  const massBase = rows.below + 12 * f + 4;
  const trackY = massBase + 4 + 5 * f + CART_TALL * P;
  const tapeH = 11.5 * f * 1.75;
  const trackH = Math.max(0.03 * P, tapeH + 7);
  const benchY = trackY + trackH + 5 + 0.008 * P;
  const H = Math.round(benchY + 44 + 6 * f);
  const reach = (STOP_W + CART_END + 0.004) * P;
  return { f, P, length, H, rows, trackY, trackH, benchY, xc: X0 + (length / 2) * P, lo: X0 + reach, hi: W - X0 - reach };
}

export interface CartSpec {
  m1: number;
  m2: number;
  r: PushResult;
}

/** Midten av vognene ved tiden ts etter utløsningen (figurens enheter), og fjæra og snora. */
export function cartFrame(spec: CartSpec, layout: CartLayout, ts: number) {
  const { P, xc } = layout;
  const st = pushAt(spec.m1, spec.m2, spec.r, ts);
  const compressed = SPRING_L0 - SPRING_TRAVEL;
  const c1 = xc - (compressed / 2 + CART_END) * P + st.x1 * P;
  const c2 = xc + (compressed / 2 + CART_END) * P + st.x2 * P;
  return { st, c1, c2, face1: c1 + CART_END * P, face2: c2 - CART_END * P };
}

export function cartTimeline(spec: CartSpec, layout: CartLayout): Timeline {
  const { r } = spec;
  const fr = cartFrame(spec, layout, r.dt);
  // Til den første vogna treffer endestoppet, eller fartspila ellers ville gått ut av figuren
  const S = arrowScale(Math.max(Math.abs(r.v1), Math.abs(r.v2)), layout.f);
  const lo = Math.max(layout.lo, 12 + Math.abs(r.v1) * S);
  const hi = Math.min(layout.hi, W - 12 - Math.abs(r.v2) * S);
  const motion = Math.min(
    exitTime([fr.c1], [r.v1 * layout.P], lo, Infinity, CART_MAX),
    exitTime([fr.c2], [r.v2 * layout.P], -Infinity, hi, CART_MAX),
  );
  return { release: CART_RELEASE, end: CART_RELEASE + r.dt + motion };
}

export function CartScene({
  spec,
  layout,
  tl,
  t,
  showForces,
}: {
  spec: CartSpec;
  layout: CartLayout;
  tl: Timeline;
  t: number;
  showForces: boolean;
}) {
  const f = useTextScale();
  const ss = useStrokeScale();
  const { m1, m2, r } = spec;
  const { P, trackY, trackH, benchY, H, rows } = layout;
  const ts = t - tl.release;
  const { st, c1, c2, face1, face2 } = cartFrame(spec, layout, ts);
  const lodd1 = loddFor(m1);
  const lodd2 = loddFor(m2);
  const top = (lodd: number) => trackY - (lodd > 0 ? 0.074 + 0.0124 * (lodd - 1) : 0.062) * P;
  const labelGap = 4 + 5 * f;

  const S = arrowScale(Math.max(Math.abs(r.v1), Math.abs(r.v2)), f);
  // Kraften fra fjæra: én skala px/N (40 N gir 0,1 m i figuren)
  const kF = (0.1 * P) / 40;
  const forcesNow = showForces && st.phase === 'under';
  const sy = trackY - SPRING_Y * P;
  const ty = trackY - THREAD_Y * P;
  const springEnd = Math.min(face2, face1 + SPRING_L0 * P);
  const p = m1 * st.v1 + m2 * st.v2;
  const title = st.phase === 'for' ? 'Før utløsningen' : st.phase === 'under' ? 'Fjæra spretter ut' : 'Etter utløsningen';
  const backdrop = useMemo(
    () => (
      <>
        <Rom x={0} y={0} w={W} h={H} gulvY={H - 4} gulv="betong" />
        <Underlag x1={0} x2={W} y={benchY} depth={H - benchY} type="labbenk" />
        <Labbane x1={X0 - 6} x2={W - X0 + 6} y={trackY} h={trackH} foot={benchY} feet={[W * 0.12, W * 0.5, W * 0.88]} stop={0.035 * P} />
        <Maalebaand x1={X0 + STOP_W * P} x2={W - X0 - STOP_W * P} y={trackY + 3} fra={0} til={layout.length - 2 * STOP_W} />
      </>
    ),
    [H, benchY, trackY, trackH, P, layout.length],
  );

  // Snora: hel før utløsningen, kuttet etterpå (en bit henger igjen på hver vogn)
  const tie = 0.05 * P;
  const thread =
    st.phase === 'for' ? (
      <Snor points={[[face1 - tie, ty], [face2 + tie, ty]]} tykkelse={1.8} type="hamp" />
    ) : (
      <>
        <Snor points={[[face1 - tie, ty], [face1 - 0.002 * P, ty], [face1 + 0.003 * P, ty + 0.016 * P]]} tykkelse={1.8} type="hamp" />
        <Snor points={[[face2 + tie, ty], [face2 + 0.002 * P, ty], [face2 - 0.003 * P, ty + 0.016 * P]]} tykkelse={1.8} type="hamp" />
      </>
    );

  return (
    <>
      {backdrop}

      <Fjaer x1={face1} y1={sy} x2={springEnd} y2={sy} vindinger={8} radius={SPRING_R * P} />
      {/* Endeplate på fjæra */}
      <rect
        x={springEnd - 0.004 * P}
        y={sy - 0.016 * P}
        width={0.004 * P}
        height={0.032 * P}
        rx={1.2}
        fill={SCENE.metalDark}
        stroke={SCENE.outline}
        strokeWidth={0.7 * ss}
      />
      <Vogn
        x={c1}
        y={trackY}
        size={CART_LEN * P}
        lakk="blaa"
        stotfanger="ingen"
        lodd={lodd1}
        hjulvinkel={hjulvinkelFraStrekning(st.x1, WHEEL_R)}
        title={`Vogn 1, ${fmt(m1, 1)} kg`}
      />
      <Vogn
        x={c2}
        y={trackY}
        size={CART_LEN * P}
        lakk="oransje"
        stotfanger="ingen"
        lodd={lodd2}
        hjulvinkel={hjulvinkelFraStrekning(st.x2, WHEEL_R)}
        title={`Vogn 2, ${fmt(m2, 1)} kg`}
      />
      {thread}

      {forcesNow && <ForcePair x={(face1 + face2) / 2} y={sy} len={st.F * kF} />}

      <BodyLabels
        x1={c1}
        y1={top(lodd1) - labelGap}
        x2={c2}
        y2={top(lodd2) - labelGap}
        mass1={`${fmt(m1, 1)} kg`}
        mass2={`${fmt(m2, 1)} kg`}
        force={forcesNow ? st.F : null}
      />

      <VelocityPair rows={rows} c1={c1} c2={c2} v1={st.v1} v2={st.v2} S={S} d1={2} d2={2} />

      <HeadRow rows={rows} title={title} sum={sumText(p, 2)} />
    </>
  );
}
