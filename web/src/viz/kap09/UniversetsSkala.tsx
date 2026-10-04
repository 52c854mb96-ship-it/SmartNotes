import { useState, type ReactNode } from 'react';
import {
  Controls,
  Explain,
  Figure,
  Formula,
  FormulaLine,
  Label,
  Readout,
  Readouts,
  Slider,
  Toolbar,
  VIZ,
  VizLayout,
  clamp,
  fmtSci,
  scaleLinear,
  useTextScale,
} from '../kit';
import { fmtPow10, fmtSig, fmtWords } from './format';
import {
  AU,
  C_LIGHT,
  LIGHT_YEAR,
  SPACE_OBJECTS,
  YEAR,
  lightTime,
  lightTravel,
  nearestObject,
  scaleModel,
  toAU,
  toKm,
  toLightYears,
  type SpaceObject,
} from './model';
import { Select, Tag, textWidth, useNarrow } from './parts';

/** Hele skalaen: 10⁵ m (100 km) til 10²⁷ m. Glidebryteren stopper ved kanten av det observerbare universet. */
const LOG_MIN = 5;
const LOG_MAX = 27;
const SLIDER_MAX = 26.65;
/** Lenger ut enn ca. 1 milliard lysår må vi ta hensyn til at universet utvider seg. */
const EXPANSION_LOG = 25;
/** Halve bredden av utsnittet, i tierpotenser. */
const HALF = 2;
/** Glidebryteren fester seg til et objekt når den er nærmere enn dette (tierpotenser). */
const SNAP = 0.12;
const CURSOR = VIZ.series[0];

const logOf = (o: SpaceObject) => Math.log10(o.d);

export default function UniversetsSkala() {
  const [logD, setLogD] = useState(Math.log10(4.24 * LIGHT_YEAR));
  const near = nearestObject(logD);
  const focus = near.decades < 1e-6 ? near.obj : null;
  const d = 10 ** logD;
  const travel = focus?.lookbackYears ? { value: focus.lookbackYears, unit: 'år' as const } : lightTravel(d);
  /** Mellom ca. 1 milliard lysår og universets kant (utenom selve kanten) gir ikke s/c lystiden. */
  const expanding = !focus?.lookbackYears && logD > EXPANSION_LOG;
  const [wrapRef, narrow] = useNarrow<HTMLDivElement>();
  const H = narrow ? 440 : 300;

  const onSlide = (v: number) => {
    const n = nearestObject(v);
    setLogD(n.decades < SNAP ? logOf(n.obj) : v);
  };

  return (
    <VizLayout>
      <Controls>
        <Slider label="Avstand fra oss" value={logD} onChange={onSlide} min={LOG_MIN} max={SLIDER_MAX} step={0.01} format={(v) => fmtDistance(10 ** v)} />
      </Controls>
      <Toolbar>
        <Select
          label="Gå til"
          value={focus?.id ?? ''}
          options={[{ value: '', label: 'Velg et objekt' }, ...SPACE_OBJECTS.map((o) => ({ value: o.id, label: o.label }))]}
          onChange={(id) => {
            const o = SPACE_OBJECTS.find((x) => x.id === id);
            if (o) setLogD(logOf(o));
          }}
        />
      </Toolbar>

      <div ref={wrapRef}>
        <Figure
          viewBox={`0 0 800 ${H}`}
          label={`Logaritmisk avstandsskala fra 100 km til kanten av det observerbare universet. Valgt avstand: ${fmtDistance(d)}${focus ? ` (${focus.label})` : ''}.`}
          maxHeight={480}
        >
          <Scale logD={logD} focus={focus} H={H} />
        </Figure>
      </div>

      <Readouts>
        <Readout label="Avstand i km" value={fmtSig(toKm(d), 4)} unit="km" />
        <Readout label="I astronomiske enheter" value={fmtSig(toAU(d))} unit="AE" />
        <Readout label="I lysår" value={fmtSig(toLightYears(d))} unit="lysår" />
        <Readout
          label="Lyset er underveis i"
          value={expanding ? '–' : travel.unit === 'år' ? fmtWords(travel.value) : fmtSig(travel.value)}
          unit={expanding ? undefined : travel.unit}
          tone={CURSOR}
        />
      </Readouts>

      <Formula label="Omregning mellom enhetene">
        <FormulaLine>1 AE = {fmtSci(AU, 3)} m</FormulaLine>
        <FormulaLine>
          1 lysår = c · 1 år = {fmtSci(LIGHT_YEAR, 2)} m = {fmtSig(LIGHT_YEAR / AU)} AE
        </FormulaLine>
        {expanding ? (
          <FormulaLine>Så langt ute utvider universet seg mens lyset er underveis, så t = s/c gjelder ikke</FormulaLine>
        ) : focus?.lookbackYears ? (
          <FormulaLine>Lyset har reist i {fmtWords(focus.lookbackYears)} år, men avstanden er nå {fmtWords(toLightYears(d))} lysår</FormulaLine>
        ) : (
          <FormulaLine>
            t = s/c = {fmtSci(d, 2)} m / {fmtSci(C_LIGHT, 2)} m/s = {fmtSci(lightTime(d), 2)} s
            {travel.unit !== 's' && travel.unit !== 'ms' && ` = ${travel.unit === 'år' ? fmtWords(travel.value) : fmtSig(travel.value)} ${travel.unit}`}
          </FormulaLine>
        )}
      </Formula>

      <Explain>{explanation(logD, focus, travel)}</Explain>
    </VizLayout>
  );
}

function Scale({ logD, focus, H }: { logD: number; focus: SpaceObject | null; H: number }) {
  const f = useTextScale();
  const rowGap = 30 * f;
  const titleW = textWidth(5, f) + 14;
  const X0 = 24 + titleW;
  const X1 = 800 - 28;
  const yAx = H - (3 * rowGap + 22);
  const yOv = 22 + 12 * f;
  const c = clamp(logD, LOG_MIN + HALF, LOG_MAX - HALF);
  const lo = c - HALF;
  const hi = c + HALF;
  const sx = scaleLinear([lo, hi], [X0, X1]);
  const ox = scaleLinear([LOG_MIN, LOG_MAX], [X0, X1]);
  const xCur = sx(logD);

  // Etiketter i opptil tre rader over aksen, så de ikke overlapper.
  const visible = SPACE_OBJECTS.filter((o) => logOf(o) >= lo - 0.02 && logOf(o) <= hi + 0.02);
  const rowEnd = [-Infinity, -Infinity, -Infinity];
  const placed = visible.map((o) => {
    const x = sx(logOf(o));
    const w = textWidth(o.label.length, f) + 8;
    const lx = clamp(x, 8 + w / 2, 800 - 8 - w / 2);
    let row = rowEnd.findIndex((end) => end + 14 < lx - w / 2);
    if (row < 0) row = rowEnd.indexOf(Math.min(...rowEnd));
    rowEnd[row] = lx + w / 2;
    return { o, x, lx, row };
  });
  const labelY = (row: number) => yAx - 22 * f - row * rowGap;
  const topY = labelY(2) - 18 * f;

  const rows: { title: string; offset: number }[] = [
    { title: 'km', offset: 3 },
    { title: 'AE', offset: Math.log10(AU) },
    { title: 'lysår', offset: Math.log10(LIGHT_YEAR) },
  ];

  return (
    <g>
      {/* Oversikt over hele skalaen med utsnittet markert */}
      <line x1={X0} y1={yOv} x2={X1} y2={yOv} className="viz-axis" />
      {Array.from({ length: LOG_MAX - LOG_MIN + 1 }, (_, i) => LOG_MIN + i).map((n) => (
        <line key={n} x1={ox(n)} y1={yOv - (n % 5 === 0 ? 6 : 3)} x2={ox(n)} y2={yOv + (n % 5 === 0 ? 6 : 3)} className="viz-axis" />
      ))}
      <rect x={ox(lo)} y={yOv - 11} width={ox(hi) - ox(lo)} height={22} rx={6} fill={CURSOR} fillOpacity={0.12} stroke={CURSOR} strokeWidth={1.5} />
      {SPACE_OBJECTS.map((o) => (
        <circle key={o.id} cx={ox(logOf(o))} cy={yOv} r={3.5} fill={o === focus ? CURSOR : VIZ.muted} />
      ))}

      {/* Linjer fra utsnittet i oversikten ned til hovedaksen */}
      <line x1={ox(lo)} y1={yOv + 11} x2={X0} y2={topY} stroke={CURSOR} strokeOpacity={0.35} strokeWidth={1} />
      <line x1={ox(hi)} y1={yOv + 11} x2={X1} y2={topY} stroke={CURSOR} strokeOpacity={0.35} strokeWidth={1} />

      {/* Rutenett for hver tierpotens (meter) */}
      {Array.from({ length: Math.floor(hi) - Math.ceil(lo) + 1 }, (_, i) => Math.ceil(lo) + i).map((n) => (
        <line key={n} x1={sx(n)} y1={topY} x2={sx(n)} y2={yAx + 3 * rowGap + 8} className="viz-gridline" />
      ))}

      {/* Hovedaksen */}
      <line x1={X0} y1={yAx} x2={X1} y2={yAx} className="viz-axis" />
      {Array.from({ length: Math.floor(hi) - Math.ceil(lo) + 1 }, (_, i) => Math.ceil(lo) + i).map((n) => (
        <line key={n} x1={sx(n)} y1={yAx - 6} x2={sx(n)} y2={yAx + 6} className="viz-axis" />
      ))}

      {/* Enhetsrader: samme akse, merket i km, AE og lysår. Omregning er bare en forskyvning på en log-skala. */}
      {rows.map((r, i) => {
        const y = yAx + (i + 1) * rowGap;
        const first = Math.ceil(lo - r.offset);
        const last = Math.floor(hi - r.offset);
        return (
          <g key={r.title}>
            <Label x={X0 - 10} y={y + 5 * f} anchor="end" muted>
              {r.title}
            </Label>
            {Array.from({ length: Math.max(0, last - first + 1) }, (_, k) => first + k).map((n) => {
              const x = sx(n + r.offset);
              const text = fmtPow10(n);
              // Akseverdier som ville kollidert med radtittelen eller gått ut av figuren, får bare et merke.
              const half = (text.length * 8 * f) / 2;
              const room = x - half > X0 - 4 && x + half < 800 - 4;
              return (
                <g key={n}>
                  <line x1={x} y1={y - 19 * f} x2={x} y2={y - 13 * f} stroke={VIZ.muted} strokeWidth={1.5} />
                  {room && (
                    <text x={x} y={y + 5 * f} textAnchor="middle" className="viz-tick">
                      {text}
                    </text>
                  )}
                </g>
              );
            })}
          </g>
        );
      })}

      {/* Objektene med etiketter */}
      {placed.map(({ o, x, lx, row }) => (
        <line key={`l${o.id}`} x1={x} y1={yAx} x2={lx} y2={labelY(row) + 6} stroke={o === focus ? CURSOR : VIZ.muted} strokeWidth={1} strokeOpacity={0.7} />
      ))}
      {placed.map(({ o, x }) => (
        <circle key={`d${o.id}`} cx={x} cy={yAx} r={o === focus ? 8 : 5.5} fill={o === focus ? CURSOR : VIZ.muted} stroke={VIZ.surface} strokeWidth={2} />
      ))}
      {placed.map(({ o, lx, row }) => (
        <Tag key={`t${o.id}`} x={lx} y={labelY(row)} color={o === focus ? CURSOR : undefined} weight={o === focus ? 700 : 600}>
          {o.label}
        </Tag>
      ))}

      {/* Markøren: avstanden som er valgt */}
      {!focus && (
        <g>
          <line x1={xCur} y1={topY} x2={xCur} y2={yAx + 3 * rowGap + 8} stroke={CURSOR} strokeWidth={2} strokeDasharray="5 4" />
          <polygon points={`${xCur},${yAx - 2} ${xCur - 7},${yAx - 14} ${xCur + 7},${yAx - 14}`} fill={CURSOR} />
        </g>
      )}
    </g>
  );
}

/** Avstand i en enhet som passer: km i nærheten av jorda, AE i solsystemet, lysår ellers. */
export function fmtDistance(d: number): string {
  if (d < 1e9) return `${fmtSig(toKm(d))} km`;
  if (d < 0.3 * LIGHT_YEAR) return `${fmtSig(toAU(d))} AE`;
  return `${fmtWords(toLightYears(d))} lysår`;
}

/** Lengde i skalamodellen (m) i en enhet som passer. */
function fmtModelLength(m: number): string {
  if (m < 0.01) return `${fmtSig(m * 1000, 2)} mm`;
  if (m < 1) return `${fmtSig(m * 100, 2)} cm`;
  if (m < 1000) return `${fmtSig(m, 2)} m`;
  return `${fmtWords(m / 1000, 2)} km`;
}

function travelText(travel: { value: number; unit: string }): string {
  const v = travel.unit === 'år' ? fmtWords(travel.value) : fmtSig(travel.value);
  const unit = travel.unit === 'timer' && travel.value < 1.05 ? 'time' : travel.unit;
  return `${v} ${unit}`;
}

function explanation(logD: number, focus: SpaceObject | null, travel: { value: number; unit: string }): ReactNode {
  const d = 10 ** logD;
  if (!focus) {
    const below = [...SPACE_OBJECTS].reverse().find((o) => logOf(o) < logD);
    const above = SPACE_OBJECTS.find((o) => logOf(o) > logD);
    return (
      <p>
        {below && above ? (
          <>
            Du er mellom <strong>{below.label}</strong> og <strong>{above.label}</strong>, {fmtDistance(d)} unna.{' '}
          </>
        ) : (
          <>Du er {fmtDistance(d)} unna. </>
        )}
        Skalaen er logaritmisk: hvert merke på aksen er ti ganger lenger unna enn det forrige. Derfor får både månen og
        Andromedagalaksen plass på samme akse, selv om Andromeda er ca. 6 · 10¹³ ganger lenger unna.{' '}
        {logD > EXPANSION_LOG
          ? 'Så langt ute utvider universet seg merkbart mens lyset er underveis, så lystiden er ikke lenger bare s/c.'
          : `Lyset bruker ${travelText(travel)} hit.`}
      </p>
    );
  }
  const old = travel.unit === 'år';
  const showModel = d >= AU && focus.id !== 'univers';
  return (
    <>
      <p>
        <strong>{focus.label}.</strong> {focus.fact}
        {!focus.lookbackYears && (
          <>
            {' '}
            Lyset bruker {travelText(travel)} derfra.
            {old && ` Vi ser altså lys som ble sendt ut for ${travelText(travel)} siden.`}
          </>
        )}
      </p>
      {old && !focus.lookbackYears && (
        <p>
          Et lysår er en <strong>avstand</strong>, ikke en tid: strekningen lyset går på ett år, c · 1 år ={' '}
          {fmtSci(C_LIGHT, 2)} m/s · {fmtSci(YEAR, 3)} s ≈ {fmtSci(LIGHT_YEAR, 2)} m.
        </p>
      )}
      {showModel && (
        <p>
          Skalamodell: krymper vi avstanden jorda–sola til 1 cm, ligger {focus.label} {fmtModelLength(scaleModel(d))} unna.
        </p>
      )}
    </>
  );
}
