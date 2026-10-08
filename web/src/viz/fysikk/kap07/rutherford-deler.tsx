/**
 * Tegnedelene til Rutherfords spredningsforsøk: vakuumkammeret sett ovenfra (kilde, gullfolie og skjerm som lyser
 * der α-partiklene treffer), telleren for avbøyningsvinklene, gullatomene i folien (rosinbolle eller kjerne) og
 * utsnittet rundt én kjerne med hyperbelbanen.
 */
import { useMemo } from 'react';
import { Pause, Play, RotateCcw } from 'lucide-react';
import { Txt, VIZ, fmt, superscript, useTextScale, type SimClock } from '../../kit';
import {
  Atomkjerne,
  Callout,
  Dimension,
  ForceArrow,
  LinearGradient,
  RadialGradient,
  SCENE,
  alpha,
  mix,
  sceneRandom,
  shade,
  sphereStops,
  tint,
  useSceneScale,
  useStrokeScale,
  useSvgId,
} from '../../kit/scene';
import {
  BIN_COUNT,
  FM,
  GOLD,
  N_TOTAL,
  RING_BUCKETS,
  RING_STEP_DEG,
  VIEW_RADIUS,
  asymptoteCenter,
  fireTime,
  firedCount,
  headOnDistance,
  nucleusForce,
  pointAt,
  rutherfordAngle,
  trajectory,
  type Experiment,
  type ModelId,
  type Tally,
} from './model-rutherford';

/** Farger: α-partiklene (oransje som protonene), målt (nøytral) og modellene. */
export const RUTH = {
  alpha: VIZ.series[1]!,
  measured: VIZ.series[1]!,
  thomson: VIZ.series[4]!,
  rutherford: VIZ.series[2]!,
  electron: VIZ.series[0]!,
} as const;

export const modelColor = (m: ModelId): string => (m === 'thomson' ? RUTH.thomson : RUTH.rutherford);

/** Lyset fra skjermen (sinksulfid lyser grønnhvitt der en α-partikkel treffer). */
const FLASH = SCENE.displayText;
/** α-spor i det mørke kammeret. */
const TRACK = mix(SCENE.glow, VIZ.series[1]!, 0.45);
/** Tekst inne i det mørke kammeret (samme i begge temaer). */
const ON_DARK = SCENE.star;

const r2 = (v: number) => Math.round(v * 100) / 100;

/** Punkt på en sirkel: vinkel i grader mot klokka fra +x (oppover er positiv). */
function polar(cx: number, cy: number, r: number, aDeg: number): [number, number] {
  const a = (aDeg * Math.PI) / 180;
  return [cx + r * Math.cos(a), cy - r * Math.sin(a)];
}

/** Bue mot klokka fra vinkel a0 til a1 (grader, a1 > a0). */
function arcPath(cx: number, cy: number, r: number, a0: number, a1: number): string {
  const [x0, y0] = polar(cx, cy, r, a0);
  const [x1, y1] = polar(cx, cy, r, a1);
  const large = a1 - a0 > 180 ? 1 : 0;
  return `M${r2(x0)} ${r2(y0)}A${r2(r)} ${r2(r)} 0 ${large} 0 ${r2(x1)} ${r2(y1)}`;
}

// ---------------------------------------------------------------- avspilling

/** Spill av / pause og antall skutt (som PlayControls, men med antall α-partikler i stedet for tiden). */
export function PlayBar({ clock, text }: { clock: SimClock; text: string }) {
  return (
    <div className="viz-play">
      <button type="button" className="btn btn-sm" onClick={clock.toggle} aria-pressed={clock.playing}>
        {clock.playing ? <Pause size={16} aria-hidden /> : <Play size={16} aria-hidden />}
        {clock.playing ? 'Pause' : 'Skyt α-partikler'}
      </button>
      <button type="button" className="btn btn-sm btn-ghost" onClick={clock.reset}>
        <RotateCcw size={16} aria-hidden />
        Start på nytt
      </button>
      <span className="viz-play-time" aria-live="off">
        {text}
      </span>
    </div>
  );
}

// ---------------------------------------------------------------- vakuumkammeret

/** Skjermen dekker vinkler opp til denne (bak blyblokka kommer ingen α-partikler fram). */
const SCREEN_MAX = 164;
/** Tiden en α-partikkel bruker fra kilden til skjermen i avspillingen (s), og hvor lenge glimtet varer. */
const FLIGHT = 0.5;
const GLOW = 0.6;

interface ChamberProps {
  cx: number;
  cy: number;
  /** Radien til skjermen. */
  R: number;
  model: ModelId;
  exp: Experiment;
  tally: Tally;
  /** Antall skutt så langt. */
  n: number;
  /** Tiden i avspillingen (s), og om den går. */
  t: number;
  playing: boolean;
  /** Indeksene til α-partiklene med avbøyning over 30° (lyser som egne glimt). */
  large: number[];
}

/** Vakuumkammeret sett ovenfra: kilde i blyblokk, gullfolie i midten og en sirkelformet skjerm rundt. */
export function Chamber({ cx, cy, R, model, exp, tally, n, t, playing, large }: ChamberProps) {
  const f = useTextScale();
  const k = useSceneScale();
  const ss = useStrokeScale();
  const rimId = useSvgId('ruth-rim');
  const floorId = useSvgId('ruth-gulv');
  const leadId = useSvgId('ruth-bly');
  const foilId = useSvgId('ruth-folie');
  const srcId = useSvgId('ruth-kilde');

  const rimOuter = R + 26 * k;
  const rimInner = R + 12 * k;
  const band = 9 * k;
  const blockW = 0.34 * R;
  const blockH = 0.28 * R;
  const blockX = cx - 0.7 * R; // midten av blokka
  const exitX = blockX + blockW / 2;
  const foilH = 0.34 * R;
  const foilW = 4.5 * k;

  // Glød langs skjermen: logaritmisk, så ett enkelt treff også synes.
  const maxCount = Math.max(1, ...Array.from(tally.up), ...Array.from(tally.down));
  const lmax = Math.log10(1 + maxCount);
  const glowArcs: { d: string; o: number; key: string }[] = [];
  for (let b = 0; b < RING_BUCKETS; b++) {
    const a0 = b * RING_STEP_DEG;
    if (a0 >= SCREEN_MAX) break;
    const a1 = Math.min(SCREEN_MAX, a0 + RING_STEP_DEG);
    for (const [side, arr] of [
      [1, tally.up],
      [-1, tally.down],
    ] as const) {
      const c = arr[b]!;
      if (c <= 0) continue;
      const o = 0.3 + 0.7 * (Math.log10(1 + c) / lmax);
      const d = side > 0 ? arcPath(cx, cy, R, a0, a1) : arcPath(cx, cy, R, -a1, -a0);
      glowArcs.push({ d, o, key: `${side}-${b}` });
    }
  }
  const forward = (tally.up[0] ?? 0) + (tally.down[0] ?? 0) + (tally.up[1] ?? 0) + (tally.down[1] ?? 0);

  // Glimt og spor for de store vinklene (de vises hver for seg).
  const shownLarge = large.filter((i) => i < n);
  const jitter = useMemo(() => {
    const rnd = sceneRandom(11);
    return large.map(() => rnd() - 0.5);
  }, [large]);

  // α-partikler i lufta under avspillingen: et jevnt utvalg av dem som er skutt det siste halve sekundet.
  const flying: { i: number; age: number }[] = [];
  if (playing && n > 0) {
    const lo = firedCount(Math.max(0, t - FLIGHT - GLOW));
    const step = Math.max(1, Math.floor((n - lo) / 28));
    for (let i = n - 1; i >= lo; i -= step) flying.push({ i, age: t - fireTime(i) });
    for (const i of shownLarge) if (i >= lo && (n - 1 - i) % step !== 0) flying.push({ i, age: t - fireTime(i) });
  }
  const dispAngle = (i: number) => (exp.side[i]! > 0 ? 1 : -1) * Math.min(SCREEN_MAX - 1, exp.thetaDeg[i]!);

  const bolts = 10;
  return (
    <g>
      {/* Kammeret: stålring med bolter og mørkt innvendig (forsøket ble gjort i mørke og vakuum). */}
      <RadialGradient
        id={rimId}
        cx={0.42}
        cy={0.38}
        r={0.62}
        stops={[
          [0, SCENE.metalLight],
          [0.7, SCENE.metal],
          [1, SCENE.metalDark],
        ]}
      />
      <RadialGradient
        id={floorId}
        stops={[
          [0, mix(SCENE.space, SCENE.metalDark, 0.32)],
          [1, SCENE.space],
        ]}
      />
      <circle cx={cx} cy={cy + 4 * k} r={rimOuter + 2} fill={SCENE.shadow} opacity={0.35} />
      <circle cx={cx} cy={cy} r={rimOuter} fill={`url(#${rimId})`} stroke={SCENE.outline} strokeWidth={1.2 * ss} />
      {Array.from({ length: bolts }, (_, i) => {
        const [bx, by] = polar(cx, cy, (rimOuter + rimInner) / 2, (360 * (i + 0.5)) / bolts);
        return <circle key={i} cx={r2(bx)} cy={r2(by)} r={2.6 * k} fill={SCENE.metalDark} stroke={SCENE.metalLight} strokeWidth={0.8 * ss} />;
      })}
      <circle cx={cx} cy={cy} r={rimInner} fill={`url(#${floorId})`} stroke={shade(SCENE.metalDark, 0.3)} strokeWidth={1.4 * ss} />

      {/* Skjermen (sinksulfid) og gløden der det har kommet treff. */}
      <path d={arcPath(cx, cy, R, -SCREEN_MAX, SCREEN_MAX)} fill="none" stroke={mix(SCENE.metalDark, FLASH, 0.22)} strokeWidth={band} />
      <g strokeLinecap="butt" fill="none">
        {glowArcs.map((a) => (
          <path key={a.key} d={a.d} stroke={FLASH} strokeWidth={band} opacity={r2(a.o)} />
        ))}
      </g>

      {/* Gradestokk langs skjermen. */}
      {[0, 30, 60, 90, 120, 150].map((a) => (
        <g key={a}>
          {[1, -1].map((s) => {
            if (a === 0 && s < 0) return null;
            const [x0, y0] = polar(cx, cy, R - band / 2 - 3 * k, s * a);
            const [x1, y1] = polar(cx, cy, R - band / 2 - 10 * k, s * a);
            return <line key={s} x1={r2(x0)} y1={r2(y0)} x2={r2(x1)} y2={r2(y1)} stroke={ON_DARK} strokeWidth={1.2 * ss} opacity={0.7} />;
          })}
          {a > 0 && (
            <Txt
              x={r2(polar(cx, cy, R - band / 2 - 24 * f, a)[0])}
              y={r2(polar(cx, cy, R - band / 2 - 24 * f, a)[1] + 5 * f)}
              size={0.72}
              color={ON_DARK}
              halo={false}
            >
              {a}°
            </Txt>
          )}
        </g>
      ))}

      {/* Thomsons forutsigelse: alle treffer i en smal stripe rett fram. */}
      {model === 'thomson' && (
        <g>
          <path
            d={`M${cx} ${cy}L${r2(polar(cx, cy, R, 2.5)[0])} ${r2(polar(cx, cy, R, 2.5)[1])}A${R} ${R} 0 0 1 ${r2(polar(cx, cy, R, -2.5)[0])} ${r2(polar(cx, cy, R, -2.5)[1])}Z`}
            fill={alpha(RUTH.thomson, 0.45)}
          />
          <Txt x={cx + 0.5 * R} y={cy - 0.2 * R} size={0.78} color={tint(RUTH.thomson, 0.55)} halo={false} weight={650}>
            Thomson: alle hit
          </Txt>
        </g>
      )}

      {/* Spor for dem som ble kastet tilbake (svake), og glimt på skjermen for alle over 30°. */}
      <g stroke={TRACK} strokeWidth={1.2 * ss} opacity={playing ? 0.25 : 0.45}>
        {shownLarge
          .filter((i) => exp.thetaDeg[i]! > 90)
          .map((i) => {
            const [x, y] = polar(cx, cy, R - band / 2, dispAngle(i));
            return <line key={i} x1={cx} y1={cy} x2={r2(x)} y2={r2(y)} />;
          })}
      </g>
      {shownLarge.map((i, j) => {
        const [x, y] = polar(cx, cy, R + (jitter[j] ?? 0) * band * 0.6, dispAngle(i));
        const back = exp.thetaDeg[i]! > 90;
        return (
          <g key={`f${i}`}>
            <circle cx={r2(x)} cy={r2(y)} r={(back ? 5.5 : 4) * k} fill={FLASH} opacity={0.35} />
            <circle cx={r2(x)} cy={r2(y)} r={(back ? 2.6 : 1.9) * k} fill={tint(FLASH, 0.6)} />
          </g>
        );
      })}

      {/* Strålen fra kilden til folien, og videre rett fram. */}
      <line x1={exitX} y1={cy} x2={cx} y2={cy} stroke={TRACK} strokeWidth={3.2 * k} opacity={n > 0 ? 0.55 : 0.2} strokeLinecap="round" />
      {forward > 0 && (
        <line
          x1={cx}
          y1={cy}
          x2={cx + R - band / 2}
          y2={cy}
          stroke={TRACK}
          strokeWidth={r2((2 + 4 * Math.min(1, Math.log10(1 + forward) / 5)) * k)}
          opacity={r2(0.35 + 0.45 * Math.min(1, Math.log10(1 + forward) / 4))}
          strokeLinecap="round"
        />
      )}

      {/* α-partikler i lufta. */}
      {flying.map(({ i, age }) => {
        const th = dispAngle(i);
        if (age < 0) return null;
        if (age < FLIGHT) {
          const u = age / FLIGHT;
          const leg1 = 0.45;
          let x: number;
          let y: number;
          if (u < leg1) {
            x = exitX + (cx - exitX) * (u / leg1);
            y = cy;
          } else {
            [x, y] = polar(cx, cy, (R - band / 2) * ((u - leg1) / (1 - leg1)), th);
          }
          return (
            <g key={`a${i}`}>
              {u >= leg1 && <line x1={cx} y1={cy} x2={r2(x)} y2={r2(y)} stroke={TRACK} strokeWidth={1.4 * ss} opacity={0.6} />}
              <circle cx={r2(x)} cy={r2(y)} r={3.4 * k} fill={tint(RUTH.alpha, 0.25)} stroke={SCENE.outline} strokeWidth={0.6 * ss} />
            </g>
          );
        }
        const g = (age - FLIGHT) / GLOW;
        if (g >= 1) return null;
        const [x, y] = polar(cx, cy, R, th);
        return (
          <g key={`a${i}`} opacity={r2(1 - g)}>
            <line x1={cx} y1={cy} x2={r2(x)} y2={r2(y)} stroke={TRACK} strokeWidth={1.2 * ss} opacity={0.45} />
            <circle cx={r2(x)} cy={r2(y)} r={(4 + 6 * g) * k} fill={FLASH} opacity={0.5} />
          </g>
        );
      })}

      {/* Blyblokka med kilden (americium-241) og en kanal som slipper ut en smal stråle. */}
      <LinearGradient id={leadId} stops={[[0, tint(SCENE.metalDark, 0.18)], [0.5, SCENE.metalDark], [1, shade(SCENE.metalDark, 0.35)]]} />
      <rect
        x={blockX - blockW / 2}
        y={cy - blockH / 2}
        width={blockW}
        height={blockH}
        rx={3 * k}
        fill={`url(#${leadId})`}
        stroke={SCENE.outline}
        strokeWidth={1 * ss}
      />
      <rect x={blockX} y={cy - 1.6 * k} width={blockW / 2} height={3.2 * k} fill={SCENE.space} />
      <RadialGradient id={srcId} stops={[[0, SCENE.glow], [0.45, alpha(VIZ.series[1]!, 0.8)], [1, alpha(VIZ.series[1]!, 0)]]} />
      <circle cx={blockX} cy={cy} r={8 * k} fill={`url(#${srcId})`} />
      <circle cx={blockX} cy={cy} r={2.6 * k} fill={SCENE.glow} />

      {/* Gullfolien i en holder. */}
      <rect x={cx - 6 * k} y={cy - foilH / 2 - 7 * k} width={12 * k} height={7 * k} rx={1.5 * k} fill={SCENE.metal} stroke={SCENE.outline} strokeWidth={0.8 * ss} />
      <rect x={cx - 6 * k} y={cy + foilH / 2} width={12 * k} height={7 * k} rx={1.5 * k} fill={SCENE.metal} stroke={SCENE.outline} strokeWidth={0.8 * ss} />
      <LinearGradient id={foilId} x2={1} y2={0} stops={[[0, shade(SCENE.gold, 0.15)], [0.45, tint(SCENE.gold, 0.45)], [1, shade(SCENE.gold, 0.2)]]} />
      <rect x={cx - foilW / 2} y={cy - foilH / 2} width={foilW} height={foilH} fill={`url(#${foilId})`} stroke={shade(SCENE.gold, 0.45)} strokeWidth={0.6 * ss} />

      {/* Etiketter inne i kammeret. */}
      <Txt x={blockX} y={cy + blockH / 2 + 20 * f} size={0.78} color={ON_DARK} halo={false} weight={600}>
        α-kilde i bly
      </Txt>
      <Txt x={cx} y={cy + foilH / 2 + 7 * k + 20 * f} size={0.78} color={ON_DARK} halo={false} weight={600}>
        gullfolie
      </Txt>
      <Txt x={cx} y={cy + R - band / 2 - 14 * f} size={0.78} color={ON_DARK} halo={false} weight={600}>
        skjerm
      </Txt>
    </g>
  );
}

// ---------------------------------------------------------------- telleren

export const BIN_LABELS = ['Under 5°', '5°–30°', '30°–90°', 'Over 90°'] as const;
export const BIN_NOTES = ['nesten rett fram', 'litt avbøyd', 'kraftig avbøyd', 'kastet tilbake'] as const;

/** Høyden telleren trenger med tekstskaleringen f. */
export function counterHeight(f: number): number {
  return 34 * f + BIN_COUNT * counterRowHeight(f) + 34 * f;
}
function counterRowHeight(f: number): number {
  return 24 * f + 2 * 13 * f + 5 * f + 16 * f;
}

/**
 * Telleren: antall treff i hvert vinkelintervall, målt og forutsagt av modellen, som liggende søyler på
 * logaritmisk skala (hver strek er 10 ganger mer).
 */
export function Counter({
  x,
  y,
  w,
  model,
  counts,
  expected,
}: {
  x: number;
  y: number;
  w: number;
  model: ModelId;
  counts: number[];
  expected: number[];
}) {
  const f = useTextScale();
  const ss = useStrokeScale();
  const rowH = counterRowHeight(f);
  const barH = 13 * f;
  const numW = 78 * f;
  const x0 = x;
  const x1 = x + w - numW;
  const L0 = Math.log10(0.5);
  const L1 = Math.log10(N_TOTAL) + 0.05;
  const sx = (c: number) => x0 + ((Math.log10(c) - L0) / (L1 - L0)) * (x1 - x0);
  const top = y + 34 * f;
  const bottom = top + BIN_COUNT * rowH;
  const color = modelColor(model);
  const decades = [0, 1, 2, 3, 4, 5];
  const show = (v: number) => (v < 0.5 ? 0 : Math.round(v));
  return (
    <g>
      <Txt x={x} y={y + 18 * f} anchor="start" weight={700} size={0.95}>
        Treff på skjermen
      </Txt>
      {decades.map((e) => (
        <line key={e} x1={r2(sx(10 ** e))} x2={r2(sx(10 ** e))} y1={top} y2={bottom} className="viz-gridline" />
      ))}
      {counts.map((c, i) => {
        const ry = top + i * rowH;
        const by1 = ry + 24 * f + 2 * f;
        const by2 = by1 + barH + 5 * f;
        const e = show(expected[i] ?? 0);
        return (
          <g key={i}>
            <Txt x={x} y={ry + 18 * f} anchor="start" weight={700} size={0.85}>
              {BIN_LABELS[i]}
              <tspan dx={8 * f} className="is-muted" style={{ fontWeight: 500 }}>
                {BIN_NOTES[i]}
              </tspan>
            </Txt>
            {c > 0 && <rect x={x0} y={by1} width={r2(Math.max(2, sx(c) - x0))} height={barH} rx={2} fill={RUTH.measured} />}
            <Txt x={(c > 0 ? sx(c) : x0) + 6 * f} y={by1 + barH - 2 * f} anchor="start" size={0.78} weight={650} color={RUTH.measured}>
              {fmt(c, 0)}
            </Txt>
            {e > 0 && (
              <rect
                x={x0}
                y={by2}
                width={r2(Math.max(2, sx(e) - x0))}
                height={barH}
                rx={2}
                fill={alpha(color, 0.35)}
                stroke={color}
                strokeWidth={1.3 * ss}
              />
            )}
            <Txt x={(e > 0 ? sx(e) : x0) + 6 * f} y={by2 + barH - 2 * f} anchor="start" size={0.78} weight={650} color={color}>
              {fmt(e, 0)}
            </Txt>
          </g>
        );
      })}
      <line x1={x0} x2={x1} y1={bottom} y2={bottom} className="viz-axis" />
      {decades.map((e) => (
        <text key={e} x={r2(sx(10 ** e))} y={bottom + 20 * f} textAnchor="middle" className="viz-tick">
          {e === 0 ? '1' : e === 1 ? '10' : `10${superscript(e)}`}
        </text>
      ))}
    </g>
  );
}

// ---------------------------------------------------------------- gullatomene i folien

export interface LatticeGeometry {
  atoms: { cx: number; cy: number }[];
  r: number;
  target: { cx: number; cy: number };
  tracks: number[];
}

/** Plasseringen av atomene i utsnittet av folien, og hvilket atom α-partikkelen sikter mot. */
export function latticeGeometry(x: number, y: number, w: number, h: number, cols: number, rows: number): LatticeGeometry {
  const sx = w / cols;
  const sy = h / rows;
  const atoms: { cx: number; cy: number }[] = [];
  for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) atoms.push({ cx: x + sx * (i + 0.5), cy: y + sy * (j + 0.5) });
  const ti = Math.floor(cols / 2);
  const tj = Math.max(0, Math.floor((rows - 1) / 2));
  const target = atoms[tj * cols + ti]!;
  // Andre spor gjennom folien: gjennom atomene, men langt fra kjernene.
  const tracks: number[] = [];
  for (let j = 0; j < rows; j++) {
    const cy = y + sy * (j + 0.5);
    if (j !== tj) tracks.push(cy + (j % 2 === 0 ? -0.28 : 0.3) * sy);
    if (j === tj) tracks.push(cy + 0.36 * sy);
  }
  return { atoms, r: Math.min(sx, sy) * 0.47, target, tracks };
}

/**
 * Gullatomene i folien: rosinboller (positiv bolle med elektroner som rosiner) i Thomsons modell, eller en
 * elektronsky med en bitteliten kjerne i Rutherfords. α-partiklene kommer fra venstre; den vi sikter med, bøyes
 * av i Rutherfords modell (θ fra glidebryteren).
 */
export function Lattice({
  x,
  y,
  w,
  h,
  geo,
  model,
  bFm,
  u,
}: {
  x: number;
  y: number;
  w: number;
  h: number;
  geo: LatticeGeometry;
  model: ModelId;
  bFm: number;
  /** Hvor langt α-partiklene har kommet (0–1, går rundt), eller null når avspillingen står stille. */
  u: number | null;
}) {
  const k = useSceneScale();
  const ss = useStrokeScale();
  const clip = useSvgId('ruth-gitter');
  const bunId = useSvgId('ruth-bolle');
  const cloudId = useSvgId('ruth-sky');
  const { atoms, r, target } = geo;
  const rnd = useMemo(() => sceneRandom(5), []);
  const deco = useMemo(
    () =>
      atoms.map(() => ({
        e: Array.from({ length: 6 }, () => [rnd() * 2 * Math.PI, 0.3 + 0.55 * Math.sqrt(rnd())] as const),
        p: Array.from({ length: 5 }, () => [rnd() * 2 * Math.PI, 0.2 + 0.6 * Math.sqrt(rnd())] as const),
      })),
    [atoms, rnd],
  );

  // Sporet vi sikter med: en hyperbel forstørret så svingen synes (samme vinkel θ).
  const dPx = 12 * k;
  const d = headOnDistance() / FM;
  const bPx = (bFm / d) * dPx;
  const spot = useMemo(() => (model === 'rutherford' ? trajectory(bPx, dPx, 3 * (w + h), 220) : null), [model, bPx, dPx, w, h]);
  const spotPath = spot
    ? spot.pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${r2(target.cx + p[0])} ${r2(target.cy - p[1])}`).join('')
    : `M${x} ${r2(target.cy - bPx)}H${x + w}`;
  let spotA: { x: number; y: number };
  if (spot) {
    // Stille: α er et stykke etter svingen. Avspilling: fra venstre kant til den forlater utsnittet.
    const inside = (p: [number, number]) => {
      const X = target.cx + p[0];
      const Y = target.cy - p[1];
      return X >= x && X <= x + w && Y >= y && Y <= y + h;
    };
    let iStart = 0;
    while (iStart < spot.nearest && !inside(spot.pts[iStart]!)) iStart++;
    let iEnd = spot.nearest;
    while (iEnd < spot.pts.length - 1 && inside(spot.pts[iEnd + 1]!)) iEnd++;
    let iRest = spot.nearest;
    while (iRest < iEnd && Math.hypot(spot.pts[iRest]![0], spot.pts[iRest]![1]) < 40 * k) iRest++;
    const t0 = spot.time[iStart] ?? 0;
    const t1 = spot.time[iEnd] ?? t0;
    const tau = u === null ? (spot.time[iRest] ?? t0) : t0 + u * (t1 - t0);
    const p = pointAt(spot, tau);
    spotA = { x: target.cx + p.x, y: target.cy - p.y };
  } else {
    spotA = { x: u === null ? target.cx + 0.3 * w : x + u * w, y: target.cy - bPx };
  }

  const thomson = model === 'thomson';
  return (
    <g>
      <defs>
        <clipPath id={clip}>
          <rect x={x} y={y} width={w} height={h} rx={10} />
        </clipPath>
      </defs>
      <RadialGradient id={bunId} fx={0.36} fy={0.32} stops={sphereStops(mix(SCENE.woodLight, RUTH.thomson, 0.22))} />
      <RadialGradient
        id={cloudId}
        stops={[
          [0, alpha(RUTH.electron, 0.2)],
          [0.7, alpha(RUTH.electron, 0.1)],
          [1, alpha(RUTH.electron, 0)],
        ]}
      />
      <rect x={x} y={y} width={w} height={h} rx={10} fill={thomson ? alpha(SCENE.woodLight, 0.12) : alpha(SCENE.space, 0.04)} stroke={VIZ.grid} strokeWidth={1.2 * ss} />
      <g clipPath={`url(#${clip})`}>
        {atoms.map((a, i) => {
          const dd = deco[i]!;
          return thomson ? (
            <g key={i}>
              <circle cx={a.cx} cy={a.cy} r={r * 0.98} fill={`url(#${bunId})`} stroke={SCENE.outline} strokeWidth={0.8 * ss} />
              {dd.p.map(([ang, rr], j) => {
                const px = a.cx + Math.cos(ang) * rr * r;
                const py = a.cy + Math.sin(ang) * rr * r;
                const s = 3.2 * k;
                return (
                  <path
                    key={j}
                    d={`M${r2(px - s)} ${r2(py)}h${r2(2 * s)}M${r2(px)} ${r2(py - s)}v${r2(2 * s)}`}
                    stroke={shade(RUTH.thomson, 0.15)}
                    strokeWidth={1.3 * ss}
                    opacity={0.75}
                  />
                );
              })}
              {dd.e.map(([ang, rr], j) => (
                <circle
                  key={j}
                  cx={r2(a.cx + Math.cos(ang) * rr * r)}
                  cy={r2(a.cy + Math.sin(ang) * rr * r)}
                  r={3.3 * k}
                  fill={RUTH.electron}
                  stroke={SCENE.outline}
                  strokeWidth={0.6 * ss}
                />
              ))}
            </g>
          ) : (
            <g key={i}>
              <circle cx={a.cx} cy={a.cy} r={r} fill={`url(#${cloudId})`} />
              {dd.e.slice(0, 4).map(([ang, rr], j) => (
                <circle
                  key={j}
                  cx={r2(a.cx + Math.cos(ang) * (0.35 + 0.6 * rr) * r)}
                  cy={r2(a.cy + Math.sin(ang) * (0.35 + 0.6 * rr) * r)}
                  r={2.4 * k}
                  fill={RUTH.electron}
                  opacity={0.8}
                />
              ))}
              <circle cx={a.cx} cy={a.cy} r={2.1 * k} fill={VIZ.series[1]} stroke={SCENE.outline} strokeWidth={0.5 * ss} />
            </g>
          );
        })}

        {/* De andre α-partiklene: rett gjennom. */}
        {geo.tracks.map((ty, i) => {
          const ax = u === null ? x + ((0.18 + 0.29 * i) % 1) * w : x + ((u + 0.37 * i) % 1) * w;
          return (
            <g key={i}>
              <line x1={x} y1={ty} x2={x + w} y2={ty} stroke={RUTH.alpha} strokeWidth={1.6 * ss} opacity={0.5} />
              <Atomkjerne x={r2(ax)} y={ty} Z={2} N={2} r={2.2 * k} />
            </g>
          );
        })}

        {/* Den vi sikter med. */}
        <path d={spotPath} fill="none" stroke={alpha(VIZ.surface, 0.8)} strokeWidth={5 * ss} strokeLinejoin="round" />
        <path d={spotPath} fill="none" stroke={RUTH.alpha} strokeWidth={2.6 * ss} strokeLinejoin="round" />
        <Atomkjerne x={r2(spotA.x)} y={r2(spotA.y)} Z={2} N={2} r={2.6 * k} />
      </g>
      <circle cx={target.cx} cy={target.cy} r={13 * k} fill="none" stroke={VIZ.ink} strokeWidth={1.4 * ss} strokeDasharray={`${3 * ss} ${2.5 * ss}`} />
    </g>
  );
}

/** Skrå «forstørrelseskjegle» fra en liten sirkel til en stor (de ytre tangentene). */
export function ZoomCone({ x1, y1, r1, x2, y2, r2: R2 }: { x1: number; y1: number; r1: number; x2: number; y2: number; r2: number }) {
  const ss = useStrokeScale();
  const dx = x2 - x1;
  const dy = y2 - y1;
  const D = Math.hypot(dx, dy);
  if (D <= Math.abs(R2 - r1)) return null;
  const phi = Math.atan2(dy, dx);
  const beta = Math.acos((r1 - R2) / D);
  const pts = [1, -1].map((s) => {
    const a = phi + s * beta;
    return [x1 + r1 * Math.cos(a), y1 + r1 * Math.sin(a), x2 + R2 * Math.cos(a), y2 + R2 * Math.sin(a)] as const;
  });
  const p = pts[0]!;
  const q = pts[1]!;
  return (
    <g>
      <path
        d={`M${r2(p[0])} ${r2(p[1])}L${r2(p[2])} ${r2(p[3])}L${r2(q[2])} ${r2(q[3])}L${r2(q[0])} ${r2(q[1])}Z`}
        fill={alpha(VIZ.ink, 0.05)}
      />
      {pts.map((t, i) => (
        <line key={i} x1={r2(t[0])} y1={r2(t[1])} x2={r2(t[2])} y2={r2(t[3])} stroke={VIZ.muted} strokeWidth={1.1 * ss} strokeDasharray={`${4 * ss} ${3 * ss}`} />
      ))}
    </g>
  );
}

// ---------------------------------------------------------------- utsnittet rundt én kjerne

/** Sikteavstandene til de svake banene i bakgrunnen (fm), over og under kjernen. */
const REF_B = [10, 28, 55, 95];

/**
 * Utsnitt rundt én gullkjerne i riktig målestokk (radius 200 fm): banene til α-partikler med ulike sikteavstander,
 * den valgte tykt, med vinkelen θ, sikteavstanden b og kraften fra kjernen. I Thomsons modell er ladningen spredt
 * jevnt, så banene er rette.
 */
export function NucleusLens({
  cx,
  cy,
  R,
  model,
  bFm,
  u,
}: {
  cx: number;
  cy: number;
  R: number;
  model: ModelId;
  bFm: number;
  /** Hvor langt α har kommet langs banen (0–1), eller null: i det nærmeste punktet. */
  u: number | null;
}) {
  const f = useTextScale();
  const k = useSceneScale();
  const ss = useStrokeScale();
  const clip = useSvgId('ruth-lupe');
  const glowId = useSvgId('ruth-glod');
  const rView = VIEW_RADIUS / FM;
  const s = R / rView; // px per fm
  const d = headOnDistance() / FM;
  const P = (x: number, y: number): [number, number] => [cx + x * s, cy - y * s];
  const thomson = model === 'thomson';

  const refs = useMemo(() => REF_B.flatMap((b) => [b, -b]).map((b) => ({ b, tr: trajectory(Math.abs(b), d, rView, 120) })), [d, rView]);
  const tr = useMemo(() => trajectory(bFm, d, rView, 200), [bFm, d, rView]);
  const pathOf = (pts: [number, number][], flip: number) =>
    pts.map((p, i) => {
      const [X, Y] = P(p[0], flip * p[1]);
      return `${i === 0 ? 'M' : 'L'}${r2(X)} ${r2(Y)}`;
    }).join('');
  const straight = (b: number) => {
    const half = Math.sqrt(Math.max(0, rView * rView - b * b));
    const [xa, ya] = P(-half, b);
    const [xb] = P(half, b);
    return `M${r2(xa)} ${r2(ya)}H${r2(xb)}`;
  };

  // α-partikkelen: i det nærmeste punktet (stille) eller langs banen (avspilling).
  let ax: number;
  let ay: number;
  let forceN = 0;
  if (thomson) {
    const half = Math.sqrt(Math.max(0, rView * rView - bFm * bFm));
    const xa = u === null ? 0 : -half + 2 * half * u;
    [ax, ay] = P(xa, bFm);
  } else {
    const end = tr.time[tr.time.length - 1] ?? 0;
    const tau = u === null ? (tr.time[tr.nearest] ?? 0) : u * end;
    const p = pointAt(tr, tau);
    [ax, ay] = P(p.x, p.y);
    forceN = nucleusForce(Math.hypot(p.x, p.y) * FM);
  }
  const pxPerN = 3.1 * s * (rView / 150);
  const dirX = ax - cx;
  const dirY = ay - cy;
  const dl = Math.hypot(dirX, dirY) || 1;
  const fl = forceN * pxPerN;

  const theta = (rutherfordAngle(bFm * FM) * 180) / Math.PI;
  const [ccx, ccy] = (() => {
    const c = asymptoteCenter(bFm, d);
    return P(c[0], c[1]);
  })();
  const ra = 24 * k;
  const thetaLabelAngle = theta < 50 ? -24 : theta / 2;
  const [tlx, tly] = polar(ccx, ccy, ra + 26 * f, thetaLabelAngle);
  const [ex, ey] = polar(ccx, ccy, 72 * k, theta);

  const nucleusR = Math.max(3.5 * k, GOLD.nucleusRadius / FM * s);
  const plusGrid = useMemo(() => {
    const out: [number, number][] = [];
    const step = 30;
    for (let gx = -R; gx <= R; gx += step) for (let gy = -R; gy <= R; gy += step) if (gx * gx + gy * gy < R * R) out.push([gx, gy]);
    return out;
  }, [R]);

  const dimX = cx - 0.75 * R;
  return (
    <g>
      <defs>
        <clipPath id={clip}>
          <circle cx={cx} cy={cy} r={R} />
        </clipPath>
      </defs>
      <RadialGradient
        id={glowId}
        stops={[
          [0, alpha(VIZ.series[1]!, 0.3)],
          [0.25, alpha(VIZ.series[1]!, 0.08)],
          [1, alpha(VIZ.series[1]!, 0)],
        ]}
      />
      <circle cx={cx} cy={cy + 3 * k} r={R + 3} fill={SCENE.shadow} opacity={0.25} />
      <circle cx={cx} cy={cy} r={R} fill={VIZ.surface} />
      <g clipPath={`url(#${clip})`}>
        {thomson ? (
          <g>
            <rect x={cx - R} y={cy - R} width={2 * R} height={2 * R} fill={alpha(mix(SCENE.woodLight, RUTH.thomson, 0.22), 0.55)} />
            {plusGrid.map(([gx, gy], i) => (
              <path
                key={i}
                d={`M${r2(cx + gx - 3.5 * k)} ${r2(cy + gy)}h${r2(7 * k)}M${r2(cx + gx)} ${r2(cy + gy - 3.5 * k)}v${r2(7 * k)}`}
                stroke={shade(RUTH.thomson, 0.1)}
                strokeWidth={1.2 * ss}
                opacity={0.45}
              />
            ))}
          </g>
        ) : (
          <circle cx={cx} cy={cy} r={0.9 * R} fill={`url(#${glowId})`} />
        )}

        {/* Siktelinja gjennom kjernen. */}
        <line x1={cx - R} y1={cy} x2={cx + R} y2={cy} stroke={VIZ.muted} strokeWidth={1 * ss} strokeDasharray={`${5 * ss} ${4 * ss}`} opacity={0.7} />

        {/* Svake baner for andre sikteavstander. */}
        <g fill="none" stroke={RUTH.alpha} strokeWidth={1.3 * ss} opacity={0.35}>
          {refs.map(({ b, tr: t }) => (
            <path key={b} d={thomson ? straight(b) : pathOf(t.pts, Math.sign(b))} />
          ))}
        </g>

        {/* Den valgte banen. */}
        <path d={thomson ? straight(bFm) : pathOf(tr.pts, 1)} fill="none" stroke={alpha(VIZ.surface, 0.85)} strokeWidth={6 * ss} strokeLinejoin="round" />
        <path d={thomson ? straight(bFm) : pathOf(tr.pts, 1)} fill="none" stroke={RUTH.alpha} strokeWidth={3 * ss} strokeLinejoin="round" />

        {/* Vinkelen θ mellom retningen inn og retningen ut. */}
        {!thomson && theta > 1 && (
          <g>
            <line x1={ccx} y1={ccy} x2={ccx + 72 * k} y2={ccy} stroke={VIZ.ink} strokeWidth={1.1 * ss} strokeDasharray={`${4 * ss} ${3 * ss}`} opacity={0.75} />
            <line x1={ccx} y1={ccy} x2={r2(ex)} y2={r2(ey)} stroke={VIZ.ink} strokeWidth={1.1 * ss} strokeDasharray={`${4 * ss} ${3 * ss}`} opacity={0.75} />
            <path d={arcPath(ccx, ccy, ra, 0, Math.min(179.5, theta))} fill="none" stroke={VIZ.ink} strokeWidth={1.6 * ss} />
            <Txt x={r2(tlx)} y={r2(tly + 6 * f)} anchor={theta < 50 ? 'start' : 'middle'} size={0.85} weight={700}>
              θ = {fmt(theta, 0)}°
            </Txt>
          </g>
        )}

        {/* Kjernen (i riktig størrelse) og α-partikkelen (forstørret). */}
        {!thomson && (
          <g>
            <circle cx={cx} cy={cy} r={nucleusR * 2.2} fill={alpha(VIZ.series[1]!, 0.18)} />
            <Atomkjerne x={cx} y={cy} Z={GOLD.Z} N={GOLD.N} r={nucleusR / 7.4} />
          </g>
        )}
        {!thomson && fl >= 16 && (
          <ForceArrow
            x1={r2(ax)}
            y1={r2(ay)}
            x2={r2(ax + (dirX / dl) * fl)}
            y2={r2(ay + (dirY / dl) * fl)}
            color={VIZ.applied}
            width={5}
            label="F"
            labelSize={0.9}
          />
        )}
        <Atomkjerne x={r2(ax)} y={r2(ay)} Z={2} N={2} r={2.8 * k} />
      </g>

      <circle cx={cx} cy={cy} r={R} fill="none" stroke={VIZ.ink} strokeWidth={1.6 * ss} />

      {/* Sikteavstanden b, målestokk og etiketter. */}
      {bFm >= 4 ? (
        <Dimension x1={dimX} y1={cy} x2={dimX} y2={cy - bFm * s} label="b" offset={0} labelSize={0.85} />
      ) : (
        <Txt x={dimX} y={cy - 30 * f} size={0.85} weight={650}>
          b ≈ 0
        </Txt>
      )}
      <line x1={cx - 25 * s} x2={cx + 25 * s} y1={cy + R - 22 * f} y2={cy + R - 22 * f} stroke={VIZ.ink} strokeWidth={2 * ss} />
      <Txt x={cx} y={cy + R - 30 * f} size={0.72} weight={600}>
        50 fm
      </Txt>
      {thomson ? (
        <g>
          <Txt x={cx} y={cy + 0.42 * R} size={0.8} weight={700} color={RUTH.thomson}>
            positiv ladning spredt jevnt
          </Txt>
          <Txt x={cx} y={cy + 0.42 * R + 20 * f} size={0.8} weight={700} color={RUTH.thomson}>
            kraften er nesten null
          </Txt>
        </g>
      ) : (
        <Callout x={cx + 4 * k} y={cy + 4 * k} lx={cx + 0.3 * R} ly={cy + 0.42 * R} size={0.8}>
          gullkjerne, +79e
        </Callout>
      )}
    </g>
  );
}
