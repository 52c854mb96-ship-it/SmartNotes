import { useState, type ReactNode } from 'react';
import {
  Controls,
  Explain,
  Figure,
  Formel,
  Formula,
  FormulaLine,
  KJEMI,
  Readout,
  Readouts,
  Segmented,
  Select,
  Slider,
  Sub,
  TFormel,
  Toolbar,
  Txt,
  VIZ,
  VizLayout,
  capitalize,
  fmt,
  fmtSig,
  phColor,
  scaleLinear,
  superscript,
  useContainerTextScale,
} from '../kit';
import { indicatorColor } from './indikator';
import { EVERYDAY, INDICATORS, character, fromPH, indicatorColorWord, nearestEveryday, type IndicatorId } from './model';

type Control = 'pH' | 'h3o' | 'oh' | 'pOH';

const X0 = 40;
const X1 = 760;
const sx = scaleLinear([0, 14], [X0, X1]);

/** Omtrentlig bredde av en tekst i figurens enheter (gjennomsnittlig tegnbredde ca. 0,56 em). */
const textW = (s: string, f: number, size = 1) => s.length * 0.56 * 17 * f * size;

const H3O = (
  <>
    [<Formel f="H3O^+" />]
  </>
);
const OH = (
  <>
    [<Formel f="OH^-" />]
  </>
);

const round1 = (v: number) => Math.round(v * 10) / 10;

export default function PhSkala() {
  const [pH, setPHRaw] = useState(5);
  const [control, setControl] = useState<Control>('pH');
  const [ref, f] = useContainerTextScale<HTMLDivElement>();
  const setPH = (v: number) => setPHRaw(Math.min(14, Math.max(0, round1(v))));

  const s = fromPH(pH);
  const ch = character(pH);
  const near = nearestEveryday(pH);
  const exact = EVERYDAY.find((e) => Math.abs(e.pH - pH) < 0.01);
  const layout = scaleLayout(f);
  const indLayout = indicatorLayout(f);

  const slider =
    control === 'pH'
      ? { value: pH, min: 0, max: 14, label: <>pH</>, aria: 'pH', set: (v: number) => setPH(v), show: (v: number) => fmt(v, 1) }
      : control === 'pOH'
        ? { value: round1(14 - pH), min: 0, max: 14, label: <>pOH</>, aria: 'pOH', set: (v: number) => setPH(14 - v), show: (v: number) => fmt(v, 1) }
        : control === 'h3o'
          ? {
              value: round1(-pH),
              min: -14,
              max: 0,
              label: H3O,
              aria: 'Konsentrasjon av oksoniumioner',
              set: (v: number) => setPH(-v),
              show: (v: number) => `${fmtSig(10 ** v, 2)} mol/L`,
            }
          : {
              value: round1(pH - 14),
              min: -14,
              max: 0,
              label: OH,
              aria: 'Konsentrasjon av hydroksidioner',
              set: (v: number) => setPH(v + 14),
              show: (v: number) => `${fmtSig(10 ** v, 2)} mol/L`,
            };

  return (
    <VizLayout>
      <Toolbar>
        <Segmented
          label="Hvilken størrelse vil du styre?"
          options={[
            { value: 'pH', label: 'pH' },
            { value: 'h3o', label: H3O },
            { value: 'oh', label: OH },
            { value: 'pOH', label: 'pOH' },
          ]}
          value={control}
          onChange={setControl}
        />
        <Select
          label="Stoff"
          value={exact?.id ?? ''}
          onChange={(id) => {
            const e = EVERYDAY.find((x) => x.id === id);
            if (e) setPH(e.pH);
          }}
          options={[{ value: '', label: 'Egen verdi' }, ...EVERYDAY.map((e) => ({ value: e.id, label: `${capitalize(e.name)} (pH ${fmt(e.pH, 1)})` }))]}
        />
      </Toolbar>
      <Controls>
        <Slider label={slider.label} ariaLabel={slider.aria} value={slider.value} onChange={slider.set} min={slider.min} max={slider.max} step={0.1} format={slider.show} />
      </Controls>

      <div ref={ref}>
        <Figure
          viewBox={`0 0 800 ${layout.H}`}
          label={`pH-skalaen med pH ${fmt(pH, 1)}: [H₃O⁺] = ${fmtSig(s.h3o, 2)} mol/L, [OH⁻] = ${fmtSig(s.oh, 2)} mol/L og pOH ${fmt(s.pOH, 1)}.`}
          caption="Buene over skalaen viser at [H₃O⁺] blir 10 ganger større for hvert pH-steg mot venstre (eller 10 ganger mindre mot høyre). Stoffene står ved typisk pH."
          maxHeight={layout.H}
        >
          <ScaleFigure pH={pH} f={f} layout={layout} highlight={near?.id ?? null} />
        </Figure>
      </div>

      <Figure
        viewBox={`0 0 800 ${indLayout.H}`}
        label={`Indikatorfarger ved pH ${fmt(pH, 1)}.`}
        caption="Hver stripe viser fargen til indikatoren fra pH 0 til 14. Fargen skifter bare i omslagsområdet (tallene i parentes)."
        maxHeight={indLayout.H}
      >
        <IndicatorFigure pH={pH} f={f} layout={indLayout} />
      </Figure>

      <Readouts>
        <Readout label="pH" value={fmt(pH, 1)} />
        <Readout label={H3O} value={fmtSig(s.h3o, 2)} unit="mol/L" tone={KJEMI.plus} />
        <Readout label={OH} value={fmtSig(s.oh, 2)} unit="mol/L" tone={KJEMI.minus} />
        <Readout label="pOH" value={fmt(s.pOH, 1)} />
      </Readouts>

      <Formula label="Utregning">
        <FormulaLine>
          pH = −lg{H3O} = −lg({fmtSig(s.h3o, 2)}) = {fmt(pH, 2)}
        </FormulaLine>
        <FormulaLine>
          {OH} = K<Sub>w</Sub> / {H3O} = 1,0 · 10⁻¹⁴ / {fmtSig(s.h3o, 2)} = {fmtSig(s.oh, 2)} mol/L
        </FormulaLine>
        <FormulaLine>
          pOH = 14,00 − pH = 14,00 − {fmt(pH, 2)} = {fmt(s.pOH, 2)}
        </FormulaLine>
      </Formula>

      <Explain>{explanation(pH, ch, near?.name ?? null)}</Explain>
    </VizLayout>
  );
}

/* ---------- Figur 1: pH-skalaen og de tre aksene under ---------- */

interface ScaleLayout {
  H: number;
  title: number;
  labelRows: number;
  rowOf: number[];
  labelX: number[];
  labelY: (row: number) => number;
  arcBase: number;
  barTop: number;
  barH: number;
  ticks: number;
  hint: number;
  rows: number[];
}

const ROW_LABELS = ['[H₃O⁺] i mol/L', '[OH⁻] i mol/L', 'pOH'];

function scaleLayout(f: number): ScaleLayout {
  // Etikettene til stoffene fordeles på rader så de ikke overlapper.
  const size = 0.82;
  const gap = 10;
  const rowEnds: number[] = [];
  const rowOf: number[] = [];
  const labelX: number[] = [];
  for (const e of EVERYDAY) {
    const w = textW(e.name, f, size);
    const x = Math.min(X1 + 30 - w / 2, Math.max(X0 - 30 + w / 2, sx(e.pH)));
    let r = rowEnds.findIndex((end) => end + gap < x - w / 2);
    if (r < 0) {
      r = rowEnds.length;
      rowEnds.push(-Infinity);
    }
    rowEnds[r] = x + w / 2;
    rowOf.push(r);
    labelX.push(x);
  }
  const labelRows = rowEnds.length;
  const rowH = 22 * f;
  const title = 22 * f;
  const labelsTop = title + 8 * f;
  const arcBase = labelsTop + labelRows * rowH + 8 + 76 * f;
  const barTop = arcBase;
  const barH = 22 + 10 * f;
  const ticks = barTop + barH + 20 * f;
  const hint = ticks + 24 * f;
  const rows = [0, 1, 2].map((i) => hint + 46 * f + i * 74 * f);
  return {
    H: Math.round(rows[2]! + 26 * f + 12),
    title,
    labelRows,
    rowOf,
    labelX,
    labelY: (row: number) => labelsTop + (labelRows - row) * rowH,
    arcBase,
    barTop,
    barH,
    ticks,
    hint,
    rows,
  };
}

function ScaleFigure({ pH, f, layout: L, highlight }: { pH: number; f: number; layout: ScaleLayout; highlight: string | null }) {
  const xm = sx(pH);
  const strips: ReactNode[] = [];
  for (let p = 0; p < 14; p += 0.25)
    strips.push(<rect key={p} x={sx(p)} y={L.barTop} width={sx(0.25) - sx(0) + 0.6} height={L.barH} fill={phColor(p + 0.125)} />);
  // Buene: ett og to pH-steg mot venstre (eller mot høyre helt til venstre på skalaen)
  const dir = pH >= 2 ? -1 : 1;
  const arcs = [1, 2].map((n) => ({ n, x2: sx(pH + dir * n), h: (n === 1 ? 16 : 56) * f }));
  // Verdien står rett til høyre for markøren (eller til venstre helt til høyre), men aldri oppå radtittelen.
  const value = (row: number, text: string) => {
    const titleEnd = X0 + textW(ROW_LABELS[row]!, f, 0.85) + 14;
    const w = textW(text, f, 0.95);
    if (xm + 12 + w <= X1 + 30) return { x: Math.max(xm + 12, titleEnd), anchor: 'start' as const };
    return { x: xm - 12, anchor: 'end' as const };
  };
  const vals = [`${fmtSig(10 ** -pH, 2)}`, `${fmtSig(10 ** (pH - 14), 2)}`, fmt(14 - pH, 1)];
  const tickEvery = 2;
  const tickPs = Array.from({ length: 15 }, (_, i) => i);
  const rowTick = (row: number, p: number) => {
    if (row === 2) return fmt(14 - p, 0);
    const e = row === 0 ? -p : p - 14;
    return e === 0 ? '1' : `10${superscript(e)}`;
  };
  const bubbleW = textW(`pH ${fmt(pH, 1)}`, f, 0.95) + 18;
  const bx = Math.min(X1 - bubbleW / 2 + 6, Math.max(X0 + bubbleW / 2 - 6, xm));
  return (
    <g>
      <Txt x={X0 - 20} y={L.title} anchor="start" muted size={0.9}>
        pH-skalaen ved 25 °C
      </Txt>

      {/* Stoffene */}
      {EVERYDAY.map((e, i) => {
        const r = L.rowOf[i]!;
        const ly = L.labelY(r);
        const on = e.id === highlight;
        return (
          <g key={e.id}>
            <line x1={sx(e.pH)} y1={ly + 6} x2={sx(e.pH)} y2={L.barTop} stroke={on ? VIZ.ink : VIZ.muted} strokeWidth={on ? 2 : 1} opacity={on ? 1 : 0.55} />
            <circle cx={sx(e.pH)} cy={L.barTop} r={4.5} fill={on ? VIZ.ink : VIZ.surface} stroke={VIZ.ink} strokeWidth={1.5} />
            <Txt x={L.labelX[i]!} y={ly} size={0.82} weight={on ? 700 : 500} muted={!on}>
              {e.name}
            </Txt>
          </g>
        );
      })}

      {/* Buene ×10 og ×100 */}
      {arcs.map((a) => {
        if (a.x2 < X0 - 1 || a.x2 > X1 + 1) return null;
        const y0 = L.arcBase - 2;
        const mid = (xm + a.x2) / 2;
        return (
          <g key={a.n}>
            <path d={`M${xm},${y0} Q${mid},${y0 - 2 * a.h} ${a.x2},${y0}`} fill="none" stroke={KJEMI.plus} strokeWidth={2} />
            <circle cx={a.x2} cy={y0} r={3.5} fill={KJEMI.plus} />
            <Txt x={mid} y={y0 - a.h - 5} size={0.8} weight={700} color={KJEMI.plus}>
              {dir < 0 ? '×' : '÷'}
              {a.n === 1 ? '10' : '100'}
            </Txt>
          </g>
        );
      })}

      {/* Selve skalaen */}
      {strips}
      <rect x={X0} y={L.barTop} width={X1 - X0} height={L.barH} fill="none" stroke={VIZ.grid} strokeWidth={1.5} rx={3} />
      {tickPs.map((p) => (
        <g key={p}>
          <line x1={sx(p)} y1={L.barTop + L.barH} x2={sx(p)} y2={L.barTop + L.barH + 6} className="viz-axis" />
          {(f < 1.3 || p % tickEvery === 0) && (
            <text x={sx(p)} y={L.ticks} textAnchor="middle" className="viz-tick">
              {p}
            </text>
          )}
        </g>
      ))}
      <Txt x={X0} y={L.hint} anchor="start" size={0.8} muted>
        ← sur
      </Txt>
      <Txt x={sx(7)} y={L.hint} size={0.8} muted>
        nøytral
      </Txt>
      <Txt x={X1} y={L.hint} anchor="end" size={0.8} muted>
        basisk →
      </Txt>

      {/* Markøren gjennom alle aksene */}
      <line x1={xm} y1={L.barTop - 4} x2={xm} y2={L.rows[2]!} stroke={VIZ.ink} strokeWidth={2} strokeDasharray="5 4" />
      <rect x={bx - bubbleW / 2} y={L.barTop + L.barH / 2 - 11 * f} width={bubbleW} height={22 * f} rx={6} fill={VIZ.surface} stroke={VIZ.ink} strokeWidth={2} />
      <Txt x={bx} y={L.barTop + L.barH / 2 + 6 * f} size={0.95} weight={700} halo={false}>
        pH {fmt(pH, 1)}
      </Txt>

      {/* [H₃O⁺], [OH⁻] og pOH */}
      {L.rows.map((y, row) => {
        const v = value(row, vals[row]!);
        const color = row === 0 ? KJEMI.plus : row === 1 ? KJEMI.minus : VIZ.ink;
        return (
          <g key={row}>
            <Txt x={X0} y={y - 16 * f} anchor="start" size={0.85} muted>
              {row === 0 ? (
                <>
                  [<TFormel f="H3O^+" />] i mol/L
                </>
              ) : row === 1 ? (
                <>
                  [<TFormel f="OH^-" />] i mol/L
                </>
              ) : (
                'pOH'
              )}
            </Txt>
            <line x1={X0} y1={y} x2={X1} y2={y} className="viz-axis" />
            {tickPs.map((p) => (
              <g key={p}>
                <line x1={sx(p)} y1={y - 4} x2={sx(p)} y2={y + 4} className="viz-axis" />
                {p % tickEvery === 0 && (
                  <text x={sx(p)} y={y + 22 * f} textAnchor="middle" className="viz-tick">
                    {rowTick(row, p)}
                  </text>
                )}
              </g>
            ))}
            <circle cx={xm} cy={y} r={6} fill={color} stroke={VIZ.surface} strokeWidth={2} />
            <Txt x={v.x} y={y - 16 * f} anchor={v.anchor} size={0.95} weight={700} color={color}>
              {vals[row]}
            </Txt>
          </g>
        );
      })}
    </g>
  );
}

/* ---------- Figur 2: indikatorene ---------- */

const IND_ROWS: { id: IndicatorId | 'universal'; name: string }[] = [
  { id: 'metyloransje', name: 'metyloransje (3,1–4,4)' },
  { id: 'lakmus', name: 'lakmus (4,5–8,3)' },
  { id: 'bromtymolblatt', name: 'bromtymolblått (6,0–7,6)' },
  { id: 'fenolftalein', name: 'fenolftalein (8,2–10,0)' },
  { id: 'universal', name: 'universalindikator' },
];

function indicatorLayout(f: number) {
  // På mobil står navnet og fargen over stripa, og stripa går over hele bredden.
  const stacked = f > 1.3;
  const rowH = stacked ? 40 * f + 34 : 46;
  const top = 26 * f;
  return {
    stacked,
    rowH,
    top,
    stripX0: stacked ? 20 : 250,
    stripX1: stacked ? 780 : 640,
    stripH: stacked ? 26 : 22,
    H: Math.round(top + IND_ROWS.length * rowH + 10 * f),
  };
}

const UNIVERSAL_WORDS = ['rød', 'oransje', 'gul', 'grønn', 'blågrønn', 'blå', 'fiolett'];

function IndicatorFigure({ pH, f, layout: L }: { pH: number; f: number; layout: ReturnType<typeof indicatorLayout> }) {
  const ix = scaleLinear([0, 14], [L.stripX0, L.stripX1]);
  const xm = ix(pH);
  const swR = L.stacked ? 9 * f : 14;
  return (
    <g>
      <Txt x={L.stripX0} y={L.top - 8 * f} anchor="start" size={0.8} muted>
        pH 0
      </Txt>
      <Txt x={L.stripX1} y={L.top - 8 * f} anchor="end" size={0.8} muted>
        14
      </Txt>
      {IND_ROWS.map((r, i) => {
        const y0 = L.top + i * L.rowH;
        const stripY = L.stacked ? y0 + 30 * f : y0 + 8;
        const nameY = L.stacked ? y0 + 20 * f : stripY + L.stripH / 2 + 6;
        const color = indicatorColor(r.id, pH);
        const word = r.id === 'universal' ? UNIVERSAL_WORDS[Math.min(6, Math.max(0, Math.round((pH - 1) / 2)))]! : indicatorColorWord(INDICATORS[r.id], pH);
        const rects: ReactNode[] = [];
        for (let p = 0; p < 14; p += 0.1) rects.push(<rect key={p} x={ix(p)} y={stripY} width={ix(0.1) - ix(0) + 0.5} height={L.stripH} fill={indicatorColor(r.id, p + 0.05)} />);
        // Fargeprøven: til høyre for stripa på PC, til høyre på navnelinja på mobil
        const sw = L.stacked ? { x: L.stripX1 - swR, y: nameY - 6 * f } : { x: 672, y: stripY + L.stripH / 2 };
        return (
          <g key={r.id}>
            <Txt x={L.stacked ? L.stripX0 : 20} y={nameY} anchor="start" size={0.85}>
              {r.name}
            </Txt>
            {rects}
            <rect x={L.stripX0} y={stripY} width={L.stripX1 - L.stripX0} height={L.stripH} fill="none" stroke={VIZ.grid} strokeWidth={1.2} />
            {r.id !== 'universal' &&
              [INDICATORS[r.id].low, INDICATORS[r.id].high].map((v) => (
                <line key={v} x1={ix(v)} y1={stripY - 4} x2={ix(v)} y2={stripY + L.stripH + 4} stroke={VIZ.muted} strokeWidth={1.2} />
              ))}
            <circle cx={sw.x} cy={sw.y} r={swR} fill={color} stroke={KJEMI.glass} strokeWidth={2} />
            {L.stacked ? (
              <Txt x={sw.x - swR - 8} y={nameY} anchor="end" size={0.8} muted>
                {word}
              </Txt>
            ) : (
              <Txt x={sw.x + swR + 8} y={sw.y + 6} anchor="start" size={0.8} muted>
                {word}
              </Txt>
            )}
          </g>
        );
      })}
      <line x1={xm} y1={L.top - 2} x2={xm} y2={L.top + IND_ROWS.length * L.rowH - 4} stroke={VIZ.ink} strokeWidth={2} strokeDasharray="5 4" />
      <polygon points={`${xm - 7},${L.top - 12} ${xm + 7},${L.top - 12} ${xm},${L.top - 2}`} fill={VIZ.ink} />
    </g>
  );
}

/* ---------- Forklaring ---------- */

function explanation(pH: number, ch: ReturnType<typeof character>, near: string | null): ReactNode {
  const s = fromPH(pH);
  const ratio = 10 ** (7 - pH);
  const like = near ? <> Det er omtrent som {near}.</> : null;
  const compare =
    ch === 'nøytral' ? (
      <>
        Her er {H3O} = {OH} = 1,0 · 10⁻⁷ mol/L, som i rent vann.
      </>
    ) : ch === 'sur' ? (
      <>
        {H3O} = {fmtSig(s.h3o, 2)} mol/L er {fmtSig(ratio, 2)} ganger så mye som i rent vann.
      </>
    ) : (
      <>
        {H3O} = {fmtSig(s.h3o, 2)} mol/L er bare 1/{fmtSig(1 / ratio, 2)} av det i rent vann, mens {OH} er {fmtSig(1 / ratio, 2)} ganger så stor.
      </>
    );
  const btb = INDICATORS.bromtymolblatt;
  const php = INDICATORS.fenolftalein;
  return (
    <>
      <p>
        <strong>
          pH {fmt(pH, 1)}: løsningen er {ch}.
        </strong>{' '}
        {compare}
        {like}
      </p>
      <p>
        pH-skalaen er logaritmisk: Når pH synker med 1, blir {H3O} ti ganger større. pH 3 er altså ikke «litt» surere enn pH 4, men ti
        ganger så surt. Både sure og basiske løsninger inneholder begge ionene, for {H3O} · {OH} = K<Sub>w</Sub> = 1,0 · 10⁻¹⁴ ved 25 °C.
      </p>
      <p>
        Bromtymolblått er {indicatorColorWord(btb, pH)} og fenolftalein {indicatorColorWord(php, pH)} her. En indikator viser bare om pH er
        over eller under omslagsområdet sitt, så du trenger flere indikatorer (eller universalindikator) for å anslå pH.
      </p>
    </>
  );
}
