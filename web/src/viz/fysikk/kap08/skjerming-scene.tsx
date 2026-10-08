/**
 * Figuren til «Skjerming»: øverst oppsettet på labbenken (telleapparat, skinne med strålekilde, skjerm i holder og
 * geiger-müller-rør), og under en forstørrelse av avstanden mellom kilden og røret, der sporene til strålingen viser
 * hvor mye som stoppes i skjermen og hvor mye som når fram. Alt i én skala per del (P px/m).
 */
import { useMemo } from 'react';
import { VIZ, fmt } from '../../kit';
import {
  Atomkjerne,
  Callout,
  Dimension,
  Elektron,
  Foton,
  LinearGradient,
  RadialGradient,
  Rom,
  SCENE,
  Underlag,
  ValueTag,
  alpha,
  tint,
  useSceneScale,
  useStrokeScale,
  useSvgId,
} from '../../kit/scene';
import { COUNTER, GM, GmRor, Lydbuer, Telleapparat, Varselskilt } from './halveringstid-deler';
import {
  MATERIALS,
  RADIATIONS,
  SHEET,
  seededRandom,
  shownPassing,
  stopDepth,
  type MaterialId,
  type RadiationId,
  type TrackDraw,
} from './model-skjerming';
import { GmFront, KILDE, KILDE_LENGDE, Kabel, Kildestav, Klemmering, Plater, Rytter, SKINNE, Skinne, Skjermholder, plateWidth } from './skjerming-deler';

export const W = 800;

/** Fargen til hver stråling: α som protonene (oransje), β som elektronene (blå) og γ som fotonene (fiolett). */
export const RAD_COLOR: Record<RadiationId, string> = {
  alfa: VIZ.series[1]!,
  beta: VIZ.series[0]!,
  gamma: VIZ.series[3]!,
};
/** Bakgrunnsstrålingen: stiplet i tekstfargen, så den synes oppå metallet i røret. */
export const BACKGROUND_COLOR = VIZ.ink;

/** Antall spor i forstørrelsen. */
export const N_TRACKS = 10;

export interface SkLayout {
  narrow: boolean;
  f: number;
  H: number;
  strip: { P: number; benchY: number; axisY: number; railTop: number; railX1: number; railX2: number; counterX: number; tipX: number; bottom: number };
  zoom: { x: number; y: number; w: number; h: number; P: number; axisY: number; tipX: number; topRow: number; dimY: number; bottomRow: number };
}

/** Plassen til alt i figuren. Oppsettet øverst og forstørrelsen under, både på PC og mobil (større tekst og forstørrelse). */
export function skLayout(narrow: boolean, f: number): SkLayout {
  const P = 1400;
  const benchY = 190;
  const axisY = benchY - 0.05 * P;
  const counterX = 18 + (COUNTER.w / 2) * P;
  const railX1 = counterX + (COUNTER.w / 2) * P + 30;
  const tipX = railX1 + 0.012 * P + KILDE_LENGDE * P;
  const bottom = benchY + 34;
  // Forstørrelsen: β og γ har 6 cm mellom kilden og røret, og det skal få plass med enden av kilden og litt av røret
  const zP = narrow ? 9500 : 8000;
  const zx = 14;
  const zw = W - 2 * zx;
  const zy = bottom + 14;
  const r = GM.r * zP;
  const topPad = 14 + 26 * f;
  const bottomPad = 22 + 52 * f;
  const zh = Math.round(topPad + 2 * r + bottomPad);
  const zAxis = zy + topPad + r;
  return {
    narrow,
    f,
    H: Math.round(zy + zh + 8),
    strip: { P, benchY, axisY, railTop: benchY - SKINNE.h * P, railX1, railX2: W - 14, counterX, tipX, bottom },
    zoom: {
      x: zx,
      y: zy,
      w: zw,
      h: zh,
      P: zP,
      axisY: zAxis,
      tipX: zx + (narrow ? 110 : 120),
      topRow: zy + 10 + 14 * f,
      dimY: zAxis + r + 14 + 8 * f,
      bottomRow: zy + zh - 12,
    },
  };
}

/** Vinduet på røret (x) i en del med skala P, når kilden har tuppen i tipX. */
export function windowX(tipX: number, P: number, rad: RadiationId): number {
  return tipX + (RADIATIONS[rad].gap / 1000) * P;
}

/** Synsfeltet til forstørrelsen, tegnet som en stiplet ramme i oppsettet. */
function zoomField(L: SkLayout) {
  const { strip: s, zoom: z } = L;
  const k = s.P / z.P;
  return {
    x0: s.tipX - (z.tipX - z.x) * k,
    x1: s.tipX + (z.x + z.w - z.tipX) * k,
    y0: s.axisY - (z.axisY - z.y) * k,
    y1: s.axisY + (z.y + z.h - z.axisY) * k,
  };
}

/** Oppsettet på labbenken. */
export function LabStrip({ L, rad, mat, d, count, blink }: { L: SkLayout; rad: RadiationId; mat: MaterialId; d: number; count: number; blink: number }) {
  const ss = useStrokeScale();
  const { P, benchY, axisY, railTop, railX1, railX2, counterX, tipX, bottom } = L.strip;
  const win = windowX(tipX, P, rad);
  const tubeR = GM.r * P;
  const bnc = win + (GM.len + GM.cap + GM.bnc) * P;
  const counterTop = benchY - COUNTER.h * P;
  const counterRight = counterX + (COUNTER.w / 2) * P;
  const connY = benchY - COUNTER.connY * P;
  const plateX = (tipX + win) / 2;
  const field = zoomField(L);
  const z = L.zoom;

  const backdrop = useMemo(() => {
    const depth = bottom - benchY;
    return (
      <>
        <Rom x={0} y={0} w={W} h={bottom} gulvY={benchY + 0.8 * depth} gulv="betong" />
        <Underlag x1={0} x2={W} y={benchY} depth={depth} type="labbenk" />
      </>
    );
  }, [bottom, benchY]);

  const cableX = bnc + 0.012 * P;
  const cableBackY = benchY - 0.004 * P;
  return (
    <g>
      {backdrop}
      <Varselskilt x={W - 50} y={14} P={1000} />
      {/* Kabelen ligger på benken bak skinna, fra røret til kontakten på telleapparatet */}
      <Kabel
        points={[
          [bnc - 2, axisY],
          [cableX, axisY],
          [cableX, cableBackY],
          [counterRight + 0.012 * P, cableBackY],
          [counterRight + 0.012 * P, connY],
          [counterRight + 0.006 * P, connY],
        ]}
        r={0.012 * P}
      />
      <Telleapparat x={counterX} y={benchY} P={P} count={count} blink={blink} />
      <Lydbuer
        x={counterX - (COUNTER.w / 2) * P - 0.002 * P}
        y={counterTop + 0.031 * P}
        P={P}
        n={blink > 0 ? 3 : 0}
        strength={blink > 0 ? 0.4 + 0.6 * blink : 0}
        color={RAD_COLOR[rad]}
      />
      <Skinne x1={railX1} x2={railX2} benchY={benchY} P={P} zero={tipX} />

      {/* Kilden på en rytter */}
      <Rytter x={tipX - 0.058 * P} railTop={railTop} topY={axisY + KILDE.handleR * P} P={P} />
      <Kildestav tipX={tipX} y={axisY} P={P} short={RADIATIONS[rad].short} />
      <Klemmering x={tipX - 0.058 * P} y={axisY} r={KILDE.handleR * P} P={P} />

      {/* Skjermen */}
      <Skjermholder x={plateX} railTop={railTop} axisY={axisY} mat={mat} d={d} P={P} minW={1.6} />

      {/* Geiger-müller-røret ligger med vinduet mot kilden */}
      <Rytter x={win + 0.07 * P} railTop={railTop} topY={axisY + tubeR} P={P} />
      <g transform={`rotate(90 ${win} ${axisY})`}>
        <GmRor x={win} windowY={axisY} P={P} />
      </g>
      <Klemmering x={win + 0.07 * P} y={axisY} r={tubeR} P={P} />

      {/* Synsfeltet til forstørrelsen */}
      <rect
        x={field.x0}
        y={field.y0}
        width={field.x1 - field.x0}
        height={field.y1 - field.y0}
        rx={5}
        fill="none"
        stroke={VIZ.ink}
        strokeWidth={1.3 * ss}
        strokeDasharray={`${5 * ss} ${4 * ss}`}
        opacity={0.6}
      />
      {[
        [field.x0, field.y1, z.x + 10, z.y],
        [field.x1, field.y1, z.x + z.w - 10, z.y],
      ].map(([x1, y1, x2, y2], i) => (
        <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke={VIZ.ink} strokeWidth={1.1 * ss} opacity={0.32} />
      ))}

      <Callout x={counterX - 0.05 * P} y={counterTop + 2} lx={counterX - 0.036 * P} ly={counterTop - 0.012 * P - 9 * L.f} anchor="start">
        Geigerteller
      </Callout>
    </g>
  );
}

// ---------------------------------------------------------------------------------------------------------------
// Forstørrelsen

type Pt = [number, number];

/** Ett spor i forstørrelsen: punktene langs veien, om det når fram, og om det stoppes i skjermen. */
interface ZoomTrack {
  points: Pt[];
  passes: boolean;
  /** Stoppet i skjermen (ikke bare ute av bildet). */
  stopped: boolean;
}

/** Sikksakk for et elektron gjennom stoff fra a til b: flere og større knekk jo lenger det går. */
function zigzag(a: Pt, b: Pt, rnd: () => number, scale: number): Pt[] {
  const len = b[0] - a[0];
  if (!(len > 2)) return [b];
  const m = Math.max(2, Math.min(7, Math.round(len / (7 * scale))));
  const out: Pt[] = [];
  let drift = 0;
  for (let i = 1; i <= m; i++) {
    const t = i / m;
    drift += (rnd() - 0.5) * (len / m) * 1.5;
    const x = a[0] + len * t;
    const y = a[1] + (b[1] - a[1]) * t + (i === m ? drift * 0.8 : drift);
    out.push([x, y]);
  }
  return out;
}

function buildTracks(
  draws: TrackDraw[],
  rad: RadiationId,
  mat: MaterialId,
  d: number,
  T: number,
  geo: { tipX: number; win: number; axisY: number; spot: number; winR: number; a0: number; a1: number },
  seed: number,
  scale: number,
): ZoomTrack[] {
  const k = shownPassing(draws.length, T);
  const width = geo.a1 - geo.a0;
  return draws.map((dr, i) => {
    const S: Pt = [geo.tipX, geo.axisY + dr.y0 * geo.spot];
    const E: Pt = [geo.win, geo.axisY + dr.y1 * geo.winR];
    const at = (x: number): Pt => [x, S[1] + ((E[1] - S[1]) * (x - S[0])) / (E[0] - S[0])];
    const passes = dr.rank < k;
    const rnd = seededRandom(seed * 97 + i * 13 + 5);
    if (!(width > 0)) return { points: [S, E], passes: true, stopped: false };
    const entry = at(geo.a0);
    if (passes) {
      if (rad === 'beta') {
        const exit = at(geo.a1);
        const inside = zigzag(entry, [exit[0], exit[1]], rnd, scale);
        return { points: [S, entry, ...inside, E], passes, stopped: false };
      }
      return { points: [S, E], passes, stopped: false };
    }
    const z = stopDepth(rad, mat, d, dr.v);
    const sx = geo.a0 + Math.min(width, Math.max(0.6, (z / d) * width));
    const stop = at(sx);
    if (rad === 'beta') return { points: [S, entry, ...zigzag(entry, stop, rnd, scale)], passes, stopped: true };
    return { points: [S, stop], passes, stopped: true };
  });
}

function pathLength(pts: Pt[]): number {
  let L = 0;
  for (let i = 1; i < pts.length; i++) L += Math.hypot(pts[i]![0] - pts[i - 1]![0], pts[i]![1] - pts[i - 1]![1]);
  return L;
}

/** Delen av sporet fram til andelen `s` (0–1) av lengden, og retningen der. */
function partial(pts: Pt[], s: number): { pts: Pt[]; dir: Pt } {
  const total = pathLength(pts);
  const target = total * Math.min(1, Math.max(0, s));
  const out: Pt[] = [pts[0]!];
  let acc = 0;
  let dir: Pt = [1, 0];
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1]!;
    const b = pts[i]!;
    const seg = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (seg > 0) dir = [(b[0] - a[0]) / seg, (b[1] - a[1]) / seg];
    if (acc + seg >= target) {
      const t = seg > 0 ? (target - acc) / seg : 0;
      out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
      return { pts: out, dir };
    }
    out.push(b);
    acc += seg;
  }
  return { pts: out, dir };
}

const poly = (pts: Pt[]) => pts.map(([x, y]) => `${Math.round(x * 10) / 10},${Math.round(y * 10) / 10}`).join(' ');

/** Tidene (s) i animasjonen: hver partikkel flyr i FLIGHT s, blir liggende litt og sendes ut på nytt hvert PERIOD s. */
const PERIOD = 4;
const FLIGHT = 1.4;
const LINGER = 1.3;

/** Den forstørrede avstanden mellom kilden og røret, med skjermen og sporene. */
export function ZoomPanel({
  L,
  rad,
  mat,
  d,
  T,
  draws,
  seed,
  t,
  animate,
}: {
  L: SkLayout;
  rad: RadiationId;
  mat: MaterialId;
  d: number;
  T: number;
  draws: TrackDraw[];
  seed: number;
  /** Tida i målingen (s). */
  t: number;
  /** Sporene flyr ut (under en måling) eller vises alle ferdig tegnet. */
  animate: boolean;
}) {
  const id = useSvgId('sk-zoom');
  const ss = useStrokeScale();
  const k = useSceneScale();
  const z = L.zoom;
  const f = L.f;
  const P = z.P;
  const win = windowX(z.tipX, P, rad);
  const tubeR = GM.r * P;
  const minW = 4 * k;
  const w = plateWidth(d, P, minW);
  const mid = (z.tipX + win) / 2;
  const a0 = mid - w / 2;
  const a1 = mid + w / 2;
  const color = RAD_COLOR[rad];
  const tracks = useMemo(
    () => buildTracks(draws, rad, mat, d, T, { tipX: z.tipX, win, axisY: z.axisY, spot: KILDE.spotR * P * 0.85, winR: tubeR * 0.72, a0, a1 }, seed, k),
    [draws, rad, mat, d, T, z.tipX, win, z.axisY, P, tubeR, a0, a1, seed, k],
  );

  const plateTag = d > 0 ? plateText(mat, d) : 'Ingen skjerm';
  const tagW = (plateTag.length * 17 * 0.85 * f * 0.6 + 16 * f) / 2;
  const tagX = Math.min(z.x + z.w - tagW - 8, Math.max(z.x + tagW + 8, mid));
  const gapCm = RADIATIONS[rad].gap / 10;

  // Bakgrunnsstrålingen: to spor ovenfra (fra omgivelsene og verdensrommet) som går inn i røret gjennom veggen
  const span = z.x + z.w - win;
  const e1: Pt = [win + Math.min(0.6 * span, 0.05 * P), z.axisY - tubeR * 0.3];
  const e2: Pt = [win + Math.min(0.32 * span, 0.04 * P), z.axisY + tubeR * 0.35];
  const background: [Pt, Pt][] = [
    [[e1[0] + 0.45 * (e1[1] - z.y), z.y], e1],
    [[e2[0] - 0.3 * (e2[1] - z.y), z.y], e2],
  ];
  const tubeLabelX = Math.min(win + 0.03 * P, z.x + z.w - 30 * k);

  return (
    <g>
      <defs>
        <clipPath id={`${id}c`}>
          <rect x={z.x} y={z.y} width={z.w} height={z.h} rx={12} />
        </clipPath>
      </defs>
      <LinearGradient id={`${id}bg`} stops={[[0, tint(SCENE.wall, 0.12)], [1, SCENE.wallShade]]} />
      <g clipPath={`url(#${id}c)`}>
        <rect x={z.x} y={z.y} width={z.w} height={z.h} fill={`url(#${id}bg)`} />
        {/* Kilden (bare enden synes) */}
        <Kildestav tipX={z.tipX} y={z.axisY} P={P} short={RADIATIONS[rad].short} />
        {/* Skjermen går utenfor bildet over og under */}
        {d > 0 && <Plater x0={a0} x1={a1} yTop={z.y - 4} yBot={z.y + z.h + 4} mat={mat} d={d} rounded={false} />}
        <GmFront windowX={win} x2={z.x + z.w + 4} y={z.axisY} P={P} />

        {/* Bakgrunnsstråling */}
        {background.map(([a, b], i) => (
          <g key={i} aria-hidden>
            <line x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} stroke={VIZ.surface} strokeWidth={3.6 * ss} opacity={0.6} strokeLinecap="round" />
            <line x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} stroke={BACKGROUND_COLOR} strokeWidth={2 * ss} strokeDasharray={`${6 * ss} ${4 * ss}`} strokeLinecap="round" opacity={0.75} />
            <circle cx={b[0]} cy={b[1]} r={3 * k} fill={BACKGROUND_COLOR} opacity={0.8} />
          </g>
        ))}

        {/* Sporene */}
        {tracks.map((tr, i) => (
          <TrackView key={i} tr={tr} rad={rad} color={color} k={k} state={trackState(i, t, animate)} />
        ))}
      </g>
      <rect x={z.x} y={z.y} width={z.w} height={z.h} rx={12} fill="none" stroke={alpha(VIZ.ink, 0.35)} strokeWidth={1.3 * ss} />

      {/* Etiketter */}
      <ValueTag x={tagX} y={z.topRow} text={plateTag} size={0.85} />
      <Callout x={tubeLabelX} y={z.axisY + tubeR} lx={z.x + z.w - 14} ly={z.bottomRow} anchor="end">
        Geiger-müller-rør
      </Callout>
      <Dimension x1={z.tipX} y1={z.dimY} x2={win} y2={z.dimY} label={`${fmt(gapCm, 1)} cm`} labelSize={0.85} />
      <Callout x={z.tipX - 2} y={z.axisY + KILDE.cupR * P * 0.9} lx={z.x + 12} ly={z.bottomRow} anchor="start">
        {`Kilde: ${RADIATIONS[rad].source}`}
      </Callout>
    </g>
  );
}

/** Teksten på skiltet over skjermen: «Papir, 3 ark (0,3 mm)», «Aluminium, 2,0 mm», «Bly, 10 mm». */
export function plateText(mat: MaterialId, d: number): string {
  if (mat === 'papir') {
    const n = Math.round(d / SHEET);
    return `Papir, ${n} ark (${fmt(d, 1)} mm)`;
  }
  return `${MATERIALS[mat].name}, ${fmt(d, mat === 'bly' ? 0 : 1)} mm`;
}

/** Hvor langt partikkel nr. i har kommet (0–1) og hvor synlig den er, ved tida t. */
function trackState(i: number, t: number, animate: boolean): { s: number; opacity: number; fresh: number } {
  if (!animate) return { s: 1, opacity: 1, fresh: 1 };
  const offset = (i / N_TRACKS) * PERIOD + ((i * 7) % 5) * 0.11;
  if (t < offset) return { s: 0, opacity: 0, fresh: 0 };
  const local = (t - offset) % PERIOD;
  const s = Math.min(1, local / FLIGHT);
  const after = local - FLIGHT;
  const opacity = after <= LINGER ? 1 : Math.max(0, 1 - (after - LINGER) / 0.5);
  const fresh = after >= 0 && after < 0.5 ? 1 - after / 0.5 : 0;
  return { s, opacity, fresh };
}

function TrackView({ tr, rad, color, k, state }: { tr: ZoomTrack; rad: RadiationId; color: string; k: number; state: { s: number; opacity: number; fresh: number } }) {
  const ss = useStrokeScale();
  if (state.opacity <= 0 || state.s <= 0) return null;
  const { pts, dir } = partial(tr.points, state.s);
  const end = pts[pts.length - 1]!;
  const arrived = state.s >= 1;
  const trailW = rad === 'alfa' ? 3.4 : rad === 'beta' ? 1.7 : 1.2;
  const trailOp = rad === 'gamma' ? 0.45 : 0.75;
  const packet = Math.min(46 * k, pathLength(pts));
  return (
    <g opacity={state.opacity}>
      <polyline points={poly(pts)} fill="none" stroke={VIZ.surface} strokeWidth={(trailW + 2.2) * ss} strokeLinecap="round" strokeLinejoin="round" opacity={0.45} />
      <polyline points={poly(pts)} fill="none" stroke={color} strokeWidth={trailW * ss} strokeLinecap="round" strokeLinejoin="round" opacity={trailOp} />
      {arrived && tr.passes && <Flash x={end[0]} y={end[1]} r={11 * k} color={color} strength={0.55 + 0.45 * state.fresh} />}
      {arrived && tr.stopped && rad === 'gamma' && <Absorbed x={end[0]} y={end[1]} k={k} color={color} />}
      {rad === 'gamma' ? (
        packet >= 16 &&
        !(arrived && tr.stopped) && <Foton x1={end[0] - dir[0] * packet} y1={end[1] - dir[1] * packet} x2={end[0]} y2={end[1]} bolgelengde={0.002} farge={color} amplitude={4.2 * k} svingninger={5} />
      ) : rad === 'alfa' ? (
        <Atomkjerne x={end[0] - dir[0] * 3 * k} y={end[1] - dir[1] * 3 * k} Z={2} N={2} r={3.1 * k} tegn={false} />
      ) : (
        <Elektron x={end[0] - dir[0] * 3 * k} y={end[1] - dir[1] * 3 * k} r={3.8 * k} tegn={false} />
      )}
    </g>
  );
}

/** Lite lysglimt der strålingen blir registrert i røret. */
function Flash({ x, y, r, color, strength }: { x: number; y: number; r: number; color: string; strength: number }) {
  const id = useSvgId('sk-flash');
  return (
    <g aria-hidden>
      <RadialGradient
        id={id}
        stops={[
          [0, tint(color, 0.35), 0.75 * strength],
          [0.45, color, 0.35 * strength],
          [1, color, 0],
        ]}
      />
      <circle cx={x} cy={y} r={r} fill={`url(#${id})`} />
    </g>
  );
}

/** γ-foton som blir absorbert eller spredt i skjermen: en liten stjerne der det vekselvirker med stoffet. */
function Absorbed({ x, y, k, color }: { x: number; y: number; k: number; color: string }) {
  const ss = useStrokeScale();
  const rays = [0, 1, 2, 3, 4, 5].map((i) => (i * Math.PI) / 3 + Math.PI / 6);
  return (
    <g aria-hidden>
      <circle cx={x} cy={y} r={6.5 * k} fill={VIZ.surface} opacity={0.35} />
      {rays.map((a, i) => (
        <line key={i} x1={x + Math.cos(a) * 1.8 * k} y1={y + Math.sin(a) * 1.8 * k} x2={x + Math.cos(a) * 5.5 * k} y2={y + Math.sin(a) * 5.5 * k} stroke={color} strokeWidth={1.5 * ss} strokeLinecap="round" />
      ))}
      <circle cx={x} cy={y} r={1.6 * k} fill={color} />
    </g>
  );
}

/** Beskrivelse av figuren for skjermlesere. */
export function sceneLabel(rad: RadiationId, mat: MaterialId, d: number, T: number, count: number): string {
  const r = RADIATIONS[rad];
  const screen = d > 0 ? plateText(mat, d).toLowerCase() : 'ingen skjerm';
  return `Strålekilde med ${r.source} (${r.name}) ${fmt(r.gap / 10, 1)} cm fra et geiger-müller-rør, med ${screen} imellom. ${fmt(T * 100, 0)} % av strålingen slipper gjennom. Telleren viser ${count} klikk.`;
}

