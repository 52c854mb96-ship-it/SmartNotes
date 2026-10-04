import { useEffect, useId, useState, type ReactNode } from 'react';
import {
  Controls,
  Explain,
  Figure,
  Legend,
  Readout,
  Readouts,
  Slider,
  Toolbar,
  VIZ,
  VizLayout,
  clamp,
  scaleLinear,
  useSimClock,
  useTextScale,
} from '../../kit';
import { fmtSig, fmtYears, yearsParts } from './format';
import {
  CHANDRASEKHAR,
  M_BLACK_HOLE,
  M_SUPERNOVA,
  MAIN_SEQUENCE,
  UNIVERSE_AGE,
  WD_RADIUS,
  alongTrack,
  fate,
  lifeStages,
  luminosityFromRT,
  msLifetime,
  msLuminosity,
  radiusFromLT,
  starColor,
  type Element,
  type Fate,
  type Stage,
  type StageId,
} from './model';
import { PlayBar, Tag, textWidth, useNarrow } from './parts';

const STAGE_NAME: Record<StageId, string> = {
  protostjerne: 'Protostjerne',
  hovedserie: 'Hovedseriestjerne',
  'rod-kjempe': 'Rød kjempe',
  'planetarisk-take': 'Planetarisk tåke',
  'hvit-dverg': 'Hvit dverg',
  'rod-superkjempe': 'Rød superkjempe',
  supernova: 'Supernova',
  noytronstjerne: 'Nøytronstjerne',
  'svart-hull': 'Svart hull',
};

const FATE_NAME: Record<Fate, string> = {
  'hvit-dverg-helium': 'en hvit dverg av helium',
  'hvit-dverg': 'en hvit dverg',
  noytronstjerne: 'en nøytronstjerne',
  'svart-hull': 'et svart hull',
};

const ELEMENT: Record<Element, { label: string; color: string }> = {
  H: { label: 'H', color: VIZ.series[0] },
  He: { label: 'He', color: VIZ.series[2] },
  CO: { label: 'C, O', color: VIZ.tension },
  C: { label: 'C', color: VIZ.tension },
  O: { label: 'O', color: VIZ.velocity },
  Si: { label: 'Si', color: VIZ.series[3] },
  Fe: { label: 'Fe', color: VIZ.series[1] },
  n: { label: 'n', color: VIZ.series[4] },
};

/** Fargen på fusjonsteksten og supernovaen (samme oransje som jernkjernen). */
const HOT = VIZ.series[1];

/** Massebryteren går i log M: 10^−0,5 ≈ 0,3 til 10^1,5 ≈ 32 solmasser. */
const LOGM_MIN = -0.5;
const LOGM_MAX = 1.5;
/** Hvor langt inn i hvert stadium vi viser når eleven velger stadiet (0–1). */
const REST = 0.6;

export default function StjernensLivslop() {
  const [logM, setLogM] = useState(0);
  const M = 10 ** logM;
  const stages = lifeStages(M);
  const n = stages.length;
  const clock = useSimClock({ tMax: n, speed: 0.6 });
  const { setT, pause } = clock;
  // Start med sola midt på hovedserien.
  useEffect(() => setT(1 + REST), [setT]);
  const t = clamp(clock.t, 0, n);
  const i = Math.min(n - 1, Math.floor(t));
  const frac = t - i;
  const stage = stages[i]!;
  const pos = alongTrack(stage.track, frac);
  const [wrapRef, narrow] = useNarrow<HTMLDivElement>();
  const hrH = narrow ? 560 : 420;
  const H = narrow ? hrH + 580 : 420;
  const ms = msLifetime(M);
  const dur = durationParts(stage);

  const go = (k: number) => {
    pause();
    setT(k + REST);
  };

  return (
    <VizLayout>
      <Controls>
        <Slider
          label="Masse M"
          value={logM}
          onChange={(v) => {
            setLogM(v);
            const nn = lifeStages(10 ** v).length;
            if (clock.t > nn) setT(nn);
          }}
          min={LOGM_MIN}
          max={LOGM_MAX}
          step={0.01}
          format={(v) => `${fmtSig(10 ** v, 2)} M☉`}
          ariaLabel="Masse i solmasser"
        />
        <Slider
          label="Livsløp"
          value={t}
          onChange={(v) => {
            pause();
            setT(v);
          }}
          min={0}
          max={n}
          step={0.01}
          format={(v) => STAGE_NAME[stages[Math.min(n - 1, Math.floor(v))]!.id]}
          ariaLabel="Hvor langt stjerna har kommet i livet"
        />
      </Controls>
      <Toolbar>
        <PlayBar clock={clock} status={`${i + 1} av ${n}: ${STAGE_NAME[stage.id]}`} />
      </Toolbar>

      <div ref={wrapRef}>
        <Figure
          viewBox={`0 0 800 ${H}`}
          label={`Livsløpet til en stjerne på ${fmtSig(M, 2)} solmasser. Nå: ${STAGE_NAME[stage.id]}. Veien i HR-diagrammet og lagene inne i stjerna.`}
          maxHeight={narrow ? 900 : 440}
        >
          <MiniHr stages={stages} i={i} pos={pos} W={narrow ? 800 : 430} H={hrH} />
          <Inside stage={stage} pos={pos} M={M} x={narrow ? 0 : 440} y={narrow ? hrH : 0} W={narrow ? 800 : 360} H={narrow ? H - hrH : 420} />
        </Figure>
      </div>

      <Legend
        items={[
          { color: VIZ.series[0], label: 'Hovedserien' },
          { color: VIZ.series[3], label: 'Hvite dverger' },
          { color: VIZ.muted, label: 'Veien så langt' },
          { color: VIZ.ink, label: 'Veien i HR-diagrammet nå' },
          { color: VIZ.muted, label: 'Veien videre', dashed: true },
        ]}
      />

      <Figure viewBox={`0 0 800 ${narrow ? 30 + n * 74 : 112}`} label="Tidslinje over stadiene i livet til stjerna" maxHeight={narrow ? 600 : 140}>
        <Timeline stages={stages} i={i} narrow={narrow} onPick={go} />
      </Figure>

      <Readouts>
        <Readout label="Luminositet på hovedserien" value={fmtSig(msLuminosity(M), 2)} unit="L☉" />
        <Readout label="Tid på hovedserien" value={yearsParts(ms).value} unit={yearsParts(ms).unit} />
        <Readout label="Denne fasen varer" value={dur.value} unit={dur.unit || undefined} />
      </Readouts>

      <Explain>
        {explanation(stage, M)}
        <p>{fateText(M)}</p>
      </Explain>
    </VizLayout>
  );
}

function durationParts(stage: Stage): { value: string; unit: string } {
  if (stage.id === 'supernova') return { value: 'noen', unit: 'måneder' };
  // En hvit dverg kjøles ned i mye mer enn 10 milliarder år; nøytronstjerner og svarte hull blir værende.
  if (!Number.isFinite(stage.years)) return stage.id === 'hvit-dverg' ? { value: 'over 10', unit: 'milliarder år' } : { value: 'svært lenge', unit: '' };
  return yearsParts(stage.years);
}

function durationText(stage: Stage): string {
  if (stage.id === 'supernova') return 'noen måneder';
  if (!Number.isFinite(stage.years)) return stage.id === 'hvit-dverg' ? 'milliarder av år' : 'svært lenge';
  return fmtYears(stage.years);
}

/* ---------- HR-diagram med veien stjerna følger ---------- */

const T_HOT = Math.log10(70000);
const T_COLD = Math.log10(2400);
const L_MIN = -4.6;
const L_MAX = 6.8;

function MiniHr({ stages, i, pos, W, H }: { stages: Stage[]; i: number; pos: [number, number] | null; W: number; H: number }) {
  const f = useTextScale();
  const clipId = useId();
  const x0 = 58 * f;
  const x1 = W - 12;
  const y0 = H - 46 * f;
  const y1 = 16;
  const sx = scaleLinear([T_HOT, T_COLD], [x0, x1]);
  const sy = scaleLinear([L_MIN, L_MAX], [y0, y1]);
  const path = (pts: [number, number][]) => pts.map(([a, b], k) => `${k ? 'L' : 'M'}${sx(a).toFixed(1)},${sy(b).toFixed(1)}`).join('');
  const msPath = path(MAIN_SEQUENCE.map(([T, l]) => [Math.log10(T), l]));
  const wdPath = path([
    [Math.log10(40000), Math.log10(luminosityFromRT(WD_RADIUS, 40000))],
    [Math.log10(4500), Math.log10(luminosityFromRT(WD_RADIUS, 4500))],
  ]);
  const stage = stages[i]!;
  const last = [...stages.slice(0, i + 1)].reverse().find((s) => s.track.length > 0)?.track.at(-1);
  const sn = stage.id === 'supernova' && pos;
  // Alle linjestykkene i figuren (SVG-koordinater), så etiketten kan plasseres der den ikke krysser veien.
  const segments: Seg[] = stages.flatMap((s) =>
    s.track.slice(1).map((b, k): Seg => {
      const a = s.track[k]!;
      return [sx(a[0]), sy(a[1]), sx(b[0]), sy(b[1])];
    }),
  );
  const outsideW = textWidth(19, f);

  return (
    <g>
      <defs>
        <clipPath id={clipId}>
          <rect x={x0} y={y1} width={x1 - x0} height={y0 - y1} />
        </clipPath>
      </defs>
      {[-4, 0, 4].map((l) => (
        <g key={l}>
          <line x1={x0} x2={x1} y1={sy(l)} y2={sy(l)} className="viz-gridline" />
          <text x={x0 - 8} y={sy(l) + 5 * f} textAnchor="end" className="viz-tick">
            {l === 0 ? '1' : l < 0 ? '10⁻⁴' : '10⁴'}
          </text>
        </g>
      ))}
      {[40000, 10000, 3000].map((T) => (
        <g key={T}>
          <line x1={sx(Math.log10(T))} x2={sx(Math.log10(T))} y1={y0} y2={y1} className="viz-gridline" />
          <text x={sx(Math.log10(T))} y={y0 + 20 * f} textAnchor="middle" className="viz-tick">
            {T.toLocaleString('nb-NO')}
          </text>
        </g>
      ))}
      <line x1={x0} x2={x1} y1={y0} y2={y0} className="viz-axis" />
      <line x1={x0} x2={x0} y1={y0} y2={y1} className="viz-axis" />
      <text x={(x0 + x1) / 2} y={H - 8} textAnchor="middle" className="viz-axis-label">
        Temperatur T (K)
      </text>
      <text x={16 * f} y={(y0 + y1) / 2} textAnchor="middle" className="viz-axis-label" transform={`rotate(-90 ${16 * f} ${(y0 + y1) / 2})`}>
        Luminositet L (L☉)
      </text>

      <g clipPath={`url(#${clipId})`}>
        <path d={msPath} fill="none" stroke={VIZ.series[0]} strokeOpacity={0.14} strokeWidth={30} strokeLinecap="round" strokeLinejoin="round" />
        <path d={wdPath} fill="none" stroke={VIZ.series[3]} strokeOpacity={0.14} strokeWidth={26} strokeLinecap="round" />
        {/* Hele veien: ferdige stadier heltrukket, framtidige stiplet, nåværende tykk */}
        {stages.map((s, k) =>
          s.track.length > 1 ? (
            <path
              key={s.id}
              d={path(s.track)}
              fill="none"
              stroke={k === i ? VIZ.ink : VIZ.muted}
              strokeWidth={k === i ? 3 : 2}
              strokeDasharray={k > i || s.future ? '6 5' : undefined}
              strokeOpacity={k > i ? 0.6 : 1}
              strokeLinejoin="round"
            />
          ) : null,
        )}
      </g>
      {sn && <Burst x={sx(sn[0])} y={sy(sn[1])} r={34} />}
      {pos && !sn && (
        <circle cx={sx(pos[0])} cy={sy(pos[1])} r={9} fill={starColor(10 ** pos[0])} stroke={VIZ.ink} strokeWidth={2.5} />
      )}
      {!pos && last && (
        <Tag x={clamp(sx(last[0]), x0 + outsideW / 2 + 4, x1 - outsideW / 2 - 4)} y={Math.min(y0 - 10, sy(last[1]) + 40 * f)} anchor="middle" muted>
          utenfor diagrammet
        </Tag>
      )}
      {(pos || sn) && (
        <StageTag
          x={sx((pos ?? last)![0])}
          y={sy((pos ?? last)![1])}
          text={STAGE_NAME[stage.id]}
          box={[x0, y1, x1, y0]}
          burst={!!sn}
          segments={segments}
        />
      )}
    </g>
  );
}

/** Linjestykke [x1, y1, x2, y2] i SVG-koordinater. */
type Seg = [number, number, number, number];

/** Hvor mange punkter langs linjestykkene som ligger inni rektangelet [venstre, topp, høyre, bunn]. */
function hits(rect: [number, number, number, number], segments: Seg[]): number {
  const [l, t, r, b] = rect;
  let n = 0;
  for (const [ax, ay, bx, by] of segments) {
    const steps = Math.max(1, Math.ceil(Math.hypot(bx - ax, by - ay) / 3));
    for (let k = 0; k <= steps; k++) {
      const px = ax + ((bx - ax) * k) / steps;
      const py = ay + ((by - ay) * k) / steps;
      if (px >= l && px <= r && py >= t && py <= b) n++;
    }
  }
  return n;
}

/**
 * Navnet på stadiet ved prikken. Prøver flere plasseringer rundt prikken og velger den første som er inni
 * diagrammet og ikke krysser veien stjerna følger (eller den som krysser minst).
 */
function StageTag({ x, y, text, box, burst, segments }: { x: number; y: number; text: string; box: [number, number, number, number]; burst: boolean; segments: Seg[] }) {
  const f = useTextScale();
  const [bx0, by1, bx1, by0] = box;
  const w = textWidth(text.length, f);
  const gap = burst ? 40 : 16;
  const up = burst ? 6 : -12;
  const down = burst ? 30 * f : 12 + 14 * f;
  const candidates: { x: number; y: number; anchor: 'start' | 'end' | 'middle' }[] = [
    { x: x + gap, y: y + up, anchor: 'start' },
    { x: x - gap, y: y + up, anchor: 'end' },
    { x: x + gap, y: y + down, anchor: 'start' },
    { x: x - gap, y: y + down, anchor: 'end' },
    { x, y: y + (burst ? 44 : 26) + 14 * f, anchor: 'middle' },
    { x, y: y - (burst ? 44 : 22), anchor: 'middle' },
  ];
  let best = candidates[0]!;
  let bestScore = Infinity;
  for (const c of candidates) {
    const left = c.anchor === 'start' ? c.x : c.anchor === 'end' ? c.x - w : c.x - w / 2;
    const rect: [number, number, number, number] = [left - 4, c.y - 14 * f, left + w + 4, c.y + 5 * f];
    const inside = rect[0] >= bx0 && rect[2] <= bx1 + 8 && rect[1] >= by1 - 4 && rect[3] <= by0;
    const score = (inside ? 0 : 1000) + hits(rect, segments);
    if (score < bestScore) {
      best = c;
      bestScore = score;
      if (score === 0) break;
    }
  }
  return (
    <Tag x={best.x} y={best.y} anchor={best.anchor} weight={700}>
      {text}
    </Tag>
  );
}

function Burst({ x, y, r }: { x: number; y: number; r: number }) {
  const spikes = Array.from({ length: 12 }, (_, k) => (k * Math.PI) / 6);
  return (
    <g>
      {spikes.map((a, k) => (
        <line
          key={k}
          x1={x + Math.cos(a) * r * 0.3}
          y1={y + Math.sin(a) * r * 0.3}
          x2={x + Math.cos(a) * r * (k % 2 ? 0.75 : 1)}
          y2={y + Math.sin(a) * r * (k % 2 ? 0.75 : 1)}
          stroke={HOT}
          strokeWidth={3}
          strokeLinecap="round"
        />
      ))}
      <circle cx={x} cy={y} r={r * 0.28} fill={HOT} />
    </g>
  );
}

/* ---------- Inni stjerna ---------- */

const RADII: Record<number, number[]> = {
  1: [1],
  2: [1, 0.36],
  3: [1, 0.5, 0.25],
  6: [1, 0.8, 0.64, 0.49, 0.35, 0.2],
};

function Inside({ stage, pos, M, x, y, W, H }: { stage: Stage; pos: [number, number] | null; M: number; x: number; y: number; W: number; H: number }) {
  const f = useTextScale();
  const cx = x + W / 2;
  const top = y + 30 * f;
  const maxChars = Math.floor((W - 20) / textWidth(1, f));
  const [head, ...rest] = fusionText(stage);
  const headLines = wrap([head ?? ''], maxChars);
  const lines = [...headLines, ...wrap(rest, maxChars)];
  const bottomText = lines.length * 22 * f + 14;
  const R0 = Math.min(W / 2 - 30, (H - (top - y) - 36 * f - bottomText) / 2 - 8);
  const cy = top + 22 * f + R0 + 10;
  const T = pos ? 10 ** pos[0] : 6000;
  const radius = pos ? radiusFromLT(10 ** pos[1], T) : NaN;
  const layers = stage.layers;
  const radii = RADII[layers.length] ?? layers.map((_, k) => 1 - k / layers.length);

  let body: ReactNode;
  if (stage.id === 'supernova') {
    body = (
      <g>
        <Burst x={cx} y={cy} r={R0} />
        <circle cx={cx} cy={cy} r={R0 * 0.16} fill={ELEMENT.Fe.color} fillOpacity={0.6} stroke={ELEMENT.Fe.color} />
      </g>
    );
  } else if (stage.id === 'noytronstjerne') {
    body = (
      <g>
        <circle cx={cx} cy={cy} r={14} fill={ELEMENT.n.color} fillOpacity={0.5} stroke={ELEMENT.n.color} strokeWidth={2} />
        <Tag x={cx} y={cy + 36 * f} anchor="middle">
          ca. 20 km tvers over
        </Tag>
      </g>
    );
  } else if (stage.id === 'svart-hull') {
    body = (
      <g>
        <circle cx={cx} cy={cy} r={R0 * 0.35} fill={VIZ.surface} stroke={VIZ.ink} strokeWidth={4} />
        <Tag x={cx} y={cy + R0 * 0.35 + 28 * f} anchor="middle" muted>
          hendelseshorisonten
        </Tag>
      </g>
    );
  } else {
    // Planetarisk tåke og hvit dverg: bare en liten kjerne er igjen.
    const small = stage.id === 'hvit-dverg' || stage.id === 'planetarisk-take';
    const scale = small ? 0.22 : 1;
    body = (
      <g>
        {stage.id === 'planetarisk-take' &&
          [0.95, 0.75].map((k) => (
            <circle key={k} cx={cx} cy={cy} r={R0 * k} fill={ELEMENT.H.color} fillOpacity={0.08} stroke={ELEMENT.H.color} strokeOpacity={0.5} strokeWidth={2} strokeDasharray="10 8" />
          ))}
        {!small && <circle cx={cx} cy={cy} r={R0 + 4} fill="none" stroke={starColor(T)} strokeWidth={8} />}
        {layers.map((el, k) => (
          <circle
            key={el}
            cx={cx}
            cy={cy}
            r={R0 * scale * radii[k]!}
            fill={ELEMENT[el].color}
            fillOpacity={stage.id === 'protostjerne' ? 0.15 : 0.32}
            stroke={ELEMENT[el].color}
            strokeWidth={1.5}
          />
        ))}
        {!small &&
          layers.map((el, k) => {
            // Etiketten står midt i laget, annenhver gang øverst og nederst, så smale lag får plass.
            const r0 = R0 * radii[k]!;
            const r1 = R0 * (radii[k + 1] ?? 0);
            const mid = k === layers.length - 1 ? 0 : (r0 + r1) / 2;
            const ly = k % 2 === 0 ? cy - mid : cy + mid;
            return (
              <Tag key={el} x={cx} y={ly + 6 * f} anchor="middle" weight={700}>
                {ELEMENT[el].label}
              </Tag>
            );
          })}
        {small && (
          <Tag x={cx} y={cy + R0 * scale + 30 * f} anchor="middle">
            {stage.id === 'hvit-dverg' ? 'omtrent like stor som jorda' : 'kjernen'}
          </Tag>
        )}
        {small && (
          <Tag x={cx + R0 * scale + 10} y={cy + 6 * f} anchor="start" weight={700}>
            {ELEMENT[layers[0]!].label}
          </Tag>
        )}
      </g>
    );
  }

  return (
    <g>
      <Tag x={cx} y={top} anchor="middle" weight={700}>
        {STAGE_NAME[stage.id]}
      </Tag>
      <Tag x={cx} y={top + 22 * f} anchor="middle" muted>
        {Number.isFinite(radius) && stage.id !== 'supernova'
          ? `radius ca. ${fmtSig(radius, radius < 1 ? 1 : 2)} R☉ · ikke i målestokk`
          : stage.id === 'supernova'
            ? `${fmtSig(M, 2)} M☉ eksploderer`
            : 'ikke i målestokk'}
      </Tag>
      {body}
      {lines.map((l, k) => (
        <Tag key={k} x={cx} y={y + H - bottomText + 8 + k * 22 * f + 10 * f} anchor="middle" color={k < headLines.length ? HOT : undefined} weight={k < headLines.length ? 650 : 560}>
          {l}
        </Tag>
      ))}
    </g>
  );
}

function fusionText(stage: Stage): string[] {
  switch (stage.id) {
    case 'protostjerne':
      return ['Ingen fusjon ennå', 'Gassen varmes opp av sammentrekningen'];
    case 'supernova':
      return ['Jernkjernen kollapser', 'Grunnstoffer tyngre enn jern dannes'];
    case 'planetarisk-take':
      return ['Ingen fusjon', 'De ytre lagene blåses av'];
    case 'hvit-dverg':
      return ['Ingen fusjon', 'Den kjøles langsomt ned'];
    case 'noytronstjerne':
      return ['Ingen fusjon', 'Protoner og elektroner er presset til nøytroner'];
    case 'svart-hull':
      return ['Ingen fusjon', 'Ikke engang lys slipper ut'];
    default:
      return [`Fusjon: ${stage.fusion.join(' · ')}`];
  }
}

/** Del tekstlinjer slik at hver får plass. Bryter bare mellom deler skilt med « · » (eller mellom ord). */
function wrap(lines: string[], maxChars: number): string[] {
  const out: string[] = [];
  for (const line of lines) {
    const parts = line.includes(' · ') ? line.split(' · ') : line.split(' ');
    const sep = line.includes(' · ') ? ' · ' : ' ';
    let cur = '';
    for (const part of parts) {
      const next = cur ? `${cur}${sep}${part}` : part;
      if (next.length > maxChars && cur) {
        out.push(cur);
        cur = part;
      } else cur = next;
    }
    if (cur) out.push(cur);
  }
  return out;
}

/* ---------- Tidslinje ---------- */

function Timeline({ stages, i, narrow, onPick }: { stages: Stage[]; i: number; narrow: boolean; onPick: (k: number) => void }) {
  const n = stages.length;
  const gap = 14;
  const items = stages.map((s, k) => {
    const box = narrow
      ? { x: 20, y: 16 + k * 74, w: 760, h: 62 }
      : { x: 10 + (k * (780 + gap)) / n, y: 14, w: 780 / n - gap, h: 84 };
    const on = k === i;
    return (
      <g
        key={s.id}
        role="button"
        tabIndex={0}
        aria-label={`${STAGE_NAME[s.id]}, ${durationText(s)}`}
        aria-pressed={on}
        style={{ cursor: 'pointer' }}
        onClick={() => onPick(k)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onPick(k);
          }
        }}
      >
        <rect
          x={box.x}
          y={box.y}
          width={box.w}
          height={box.h}
          rx={10}
          fill={on ? VIZ.bodyStrong : VIZ.body}
          stroke={on ? VIZ.ink : VIZ.grid}
          strokeWidth={on ? 2.5 : 1.5}
          strokeDasharray={s.future ? '7 5' : undefined}
        />
        {narrow ? (
          <>
            <Tag x={box.x + 18} y={box.y + box.h / 2 + 8} anchor="start" weight={on ? 750 : 600}>
              {k + 1}. {s.id === 'hovedserie' ? 'Hovedserie' : STAGE_NAME[s.id]}
            </Tag>
            <Tag x={box.x + box.w - 18} y={box.y + box.h / 2 + 8} anchor="end" muted>
              {durationText(s)}
            </Tag>
          </>
        ) : (
          <>
            <Tag x={box.x + box.w / 2} y={box.y + 34} anchor="middle" weight={on ? 750 : 600} size={15}>
              {s.id === 'hovedserie' ? 'Hovedserie' : STAGE_NAME[s.id]}
            </Tag>
            <Tag x={box.x + box.w / 2} y={box.y + 62} anchor="middle" muted size={14}>
              {durationText(s)}
            </Tag>
          </>
        )}
      </g>
    );
  });
  return <g>{items}</g>;
}

/* ---------- Forklaring ---------- */

function explanation(stage: Stage, M: number): ReactNode {
  const m = `${fmtSig(M, 2)} M☉`;
  const tMS = msLifetime(M);
  switch (stage.id) {
    case 'protostjerne':
      return (
        <p>
          <strong>En stjerne blir til.</strong> En kald sky av gass og støv trekker seg sammen på grunn av gravitasjonen. Gassen varmes
          opp, og protostjerna lyser av energien som frigjøres når den faller sammen, ikke av fusjon. Når kjernen når ca. 10 millioner K,
          tenner hydrogenfusjonen, og stjerna er født. For {m} tar dette ca. {fmtYears(stage.years)}.
        </p>
      );
    case 'hovedserie':
      return (
        <p>
          <strong>Hovedserien.</strong> Stjerna fusjonerer hydrogen til helium i kjernen, og trykket fra den varme gassen holder igjen
          mot gravitasjonen. Med {m} lyser den {fmtSig(msLuminosity(M), 2)} ganger så sterkt som sola og blir på hovedserien i{' '}
          {fmtYears(tMS)}. {M > 1.05 ? (
            <>
              Tyngre stjerner lever kortere, fordi L ∝ M<sup>3,5</sup> vokser mye raskere enn drivstoffet.
            </>
          ) : M < 0.95 ? (
            <>
              Lette stjerner er sparsommelige: L ∝ M<sup>3,5</sup> blir mye mindre, mens drivstoffet bare minker litt.
            </>
          ) : (
            'Sola er omtrent halvveis.'
          )}{' '}
          {tMS > UNIVERSE_AGE && 'Det er lenger enn universets alder, så ingen så lette stjerner har forlatt hovedserien ennå.'}
        </p>
      );
    case 'rod-kjempe':
      return (
        <p>
          <strong>Rød kjempe.</strong> Hydrogenet i kjernen er brukt opp. Kjernen trekker seg sammen og blir varmere, mens de ytre lagene
          sveller opp og kjøles ned, så stjerna blir stor og rød. Hydrogen fusjonerer videre i et skall, og ved ca. 100 millioner K
          begynner helium å fusjonere til karbon og oksygen. Mye av karbonet i kroppen din er laget slik.
        </p>
      );
    case 'planetarisk-take':
      return (
        <p>
          <strong>Planetarisk tåke.</strong> De ytre lagene blåses rolig ut i rommet og lyser opp som en glødende gassky (navnet er
          historisk og har ingenting med planeter å gjøre). Karbonet og oksygenet stjerna har laget, blandes inn i gassen som nye stjerner
          og planeter blir til av.
        </p>
      );
    case 'hvit-dverg':
      return stage.future ? (
        <p>
          <strong>Hvit dverg av helium, i framtiden.</strong> En rød dverg, en stjerne under ca. 0,5 M☉, blir aldri en rød kjempe. Den bruker opp nesten alt hydrogenet og ender
          til slutt som en hvit dverg av helium. Det tar over {fmtYears(tMS)}, mye lenger enn universets alder på 13,8 milliarder år, så
          ingen røde dverger har kommet så langt ennå.
        </p>
      ) : (
        <p>
          <strong>Hvit dverg.</strong> Igjen er en kjerne av karbon og oksygen med mindre masse enn {fmtSig(CHANDRASEKHAR, 2)} M☉ og
          omtrent jordas størrelse. Uten fusjon kjøles den langsomt ned. Alle stjerner under ca. {M_SUPERNOVA} M☉ ender slik, også sola:
          den blir <em>ikke</em> et svart hull.
        </p>
      );
    case 'rod-superkjempe':
      return (
        <p>
          <strong>Rød superkjempe.</strong> En så tung stjerne blir varm nok til å fusjonere stadig tyngre grunnstoffer. De ligger i skall
          som i en løk, med H ytterst og så He, C, O, Si og Fe innerst. Hvert trinn går raskere enn det forrige. Jern er sluttpunktet: jern har størst bindingsenergi per
          nukleon, så fusjon av jern gir ingen energi.
        </p>
      );
    case 'supernova':
      return (
        <p>
          <strong>Supernova.</strong> Jernkjernen kan ikke lage mer energi og kollapser på under ett sekund. Sjokkbølgen blåser resten av
          stjerna ut i rommet, og eksplosjonen kan en kort tid lyse like sterkt som en hel galakse. I eksplosjonen (og når
          nøytronstjerner kolliderer) dannes grunnstoffer tyngre enn jern, som gull og uran.
        </p>
      );
    case 'noytronstjerne':
      return (
        <p>
          <strong>Nøytronstjerne.</strong> Kjernen som er igjen, har ca. 1,4–3 solmasser presset sammen til en kule på ca. 20 km. Protoner
          og elektroner er presset sammen til nøytroner, og en teskje av stoffet veier like mye som et fjell. Stjerner mellom ca.{' '}
          {M_SUPERNOVA} og {M_BLACK_HOLE}–25 M☉ ender slik.
        </p>
      );
    case 'svart-hull':
      return (
        <p>
          <strong>Svart hull.</strong> Restkjernen er så tung (over ca. 3 M☉) at ingenting kan stoppe kollapsen. Gravitasjonen blir så
          sterk at ikke engang lys slipper ut. Bare de tyngste stjernene, over ca. {M_BLACK_HOLE}–25 M☉, ender slik. De aller fleste
          stjerner blir hvite dverger.
        </p>
      );
  }
}

function fateText(M: number): ReactNode {
  const fa = fate(M);
  const rule =
    fa === 'hvit-dverg-helium'
      ? 'Røde dverger under ca. 0,5 M☉ blir aldri røde kjemper.'
      : fa === 'hvit-dverg'
        ? `Alle stjerner under ca. ${M_SUPERNOVA} M☉ ender slik.`
        : fa === 'noytronstjerne'
          ? `Stjerner mellom ca. ${M_SUPERNOVA} og ${M_BLACK_HOLE}–25 M☉ ender som supernova og nøytronstjerne.`
          : `Bare stjerner over ca. ${M_BLACK_HOLE}–25 M☉ ender som svarte hull.`;
  return (
    <>
      Massen bestemmer livsløpet: en stjerne på {fmtSig(M, 2)} M☉ ender som <strong>{FATE_NAME[fa]}</strong>. {rule}
    </>
  );
}
