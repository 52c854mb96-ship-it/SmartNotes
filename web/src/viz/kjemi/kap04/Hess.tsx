import { useState, type CSSProperties, type ReactNode } from 'react';
import {
  Explain,
  Figure,
  Formel,
  Formula,
  FormulaLine,
  KJEMI,
  Legend,
  Readout,
  Readouts,
  Reaksjon,
  Segmented,
  Select,
  TFormel,
  Toggle,
  Toolbar,
  Txt,
  VIZ,
  VizLayout,
  coefText,
  fmt,
  formulaText,
  scaleLinear,
  useContainerTextScale,
  type Term,
} from '../kit';
import { HESS_EXAMPLES, HESS_FACTORS, hessHint, hessSum, scaleEquation, staircase, type HessChoice, type HessExample, type StairLevel } from './model';

const OK = VIZ.series[2]!;
const BAD = VIZ.series[1]!;

const signed = (v: number) => (v > 0 ? `+${fmt(v, 1)}` : fmt(v, 1));
const start = (ex: HessExample): HessChoice[] => ex.given.map(() => ({ reverse: false, factor: 1 }));

/** «(1)», «−(2)», «2 · (2)», «−½ · (3)». */
function tag(i: number, c: HessChoice): string {
  const f = c.factor === 1 ? '' : `${coefText(c.factor)} · `;
  return `${c.reverse ? '−' : ''}${f}(${i + 1})`;
}

export default function Hess() {
  const [id, setId] = useState(HESS_EXAMPLES[0]!.id);
  const ex = HESS_EXAMPLES.find((e) => e.id === id) ?? HESS_EXAMPLES[0]!;
  const [choices, setChoices] = useState<HessChoice[]>(() => start(ex));
  const [ref, f] = useContainerTextScale<HTMLDivElement>();

  const sum = hessSum(ex, choices);
  const levels = staircase(ex, choices);
  const narrow = f > 1.3;
  const L = stairLayout(ex, levels, narrow);

  const choose = (next: string) => {
    const e = HESS_EXAMPLES.find((x) => x.id === next) ?? ex;
    setId(next);
    setChoices(start(e));
  };
  const update = (i: number, patch: Partial<HessChoice>) => setChoices((prev) => prev.map((c, j) => (j === i ? { ...c, ...patch } : c)));

  return (
    <VizLayout>
      <Toolbar>
        <Select label="Eksempel" value={id} onChange={choose} options={HESS_EXAMPLES.map((e) => ({ value: e.id, label: e.name }))} />
        <button type="button" className="btn btn-sm" onClick={() => setChoices(ex.solution.map((c) => ({ ...c })))}>
          Vis løsning
        </button>
        <button type="button" className="btn btn-sm btn-ghost" onClick={() => setChoices(start(ex))}>
          Start på nytt
        </button>
      </Toolbar>

      <div style={TARGET(sum.matches)}>
        <span style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--text-3)' }}>Målreaksjon</span>
        <span style={{ fontSize: 19, fontWeight: 600, color: 'var(--text)' }}>
          <Reaksjon r={ex.target} />
        </span>
        <span style={{ fontSize: 17, fontWeight: 700, color: sum.matches ? 'var(--success)' : 'var(--text-2)' }}>
          ΔH = {sum.matches ? `${signed(ex.target.dH)} kJ` : '?'}
        </span>
      </div>

      <div style={{ display: 'grid', gap: 8 }}>
        {ex.given.map((g, i) => {
          const c = choices[i] ?? { reverse: false, factor: 1 };
          const s = scaleEquation(g, c);
          return (
            <div key={i} style={CARD}>
              <span style={{ fontWeight: 700, color: 'var(--text-2)', minWidth: '2.2em' }}>({i + 1})</span>
              <span style={{ flex: '1 1 300px', display: 'flex', flexWrap: 'wrap', alignItems: 'baseline', gap: '2px 14px' }}>
                <span style={{ fontSize: 17, fontWeight: 600, color: 'var(--text)' }}>
                  <Reaksjon r={s} />
                </span>
                <span style={{ fontWeight: 650, color: s.dH < 0 ? KJEMI.exo : KJEMI.endo, whiteSpace: 'nowrap' }}>ΔH = {signed(s.dH)} kJ</span>
              </span>
              <span style={{ display: 'inline-flex', flexWrap: 'wrap', alignItems: 'center', gap: '6px 12px' }}>
                <Toggle label="Snu" checked={c.reverse} onChange={(v) => update(i, { reverse: v })} />
                <Segmented
                  label={`Gang likning ${i + 1} med`}
                  value={String(c.factor)}
                  onChange={(v) => update(i, { factor: Number(v) })}
                  options={HESS_FACTORS.map((x) => ({ value: String(x), label: `· ${coefText(x) || '1'}` }))}
                />
              </span>
            </div>
          );
        })}
      </div>

      <div ref={ref}>
        <Figure
          viewBox={`0 0 ${L.W} ${L.H}`}
          label={`Energitrapp: ${levels.map((l) => `${signed(l.H)} kJ`).join(', ')}. ${sum.matches ? `Summen gir målreaksjonen med ΔH = ${signed(sum.dH)} kJ.` : 'Summen gir ikke målreaksjonen ennå.'}`}
          maxHeight={L.H}
        >
          <Stairs levels={levels} choices={choices} sumDH={sum.dH} matches={sum.matches} L={L} />
        </Figure>
      </div>
      <Legend
        items={[
          { color: KJEMI.exo, label: 'Trinn ned: ΔH < 0' },
          { color: KJEMI.endo, label: 'Trinn opp: ΔH > 0' },
          { color: sum.matches ? OK : VIZ.muted, label: 'Direkte vei (målreaksjonen)', dashed: !sum.matches },
        ]}
      />

      <Readouts>
        <Readout label="ΔH for summen" value={signed(sum.dH)} unit="kJ" />
        <Readout label="Gir summen målet?" value={sum.matches ? 'Ja' : 'Ikke ennå'} tone={sum.matches ? OK : BAD} />
        <Readout
          label="ΔH for målreaksjonen"
          value={sum.matches ? signed(ex.target.dH) : '?'}
          unit={sum.matches ? 'kJ' : undefined}
          tone={sum.matches ? OK : undefined}
        />
      </Readouts>

      <Formula label="Summen av likningene">
        {sum.scaled.map((s, i) => (
          <FormulaLine key={i}>
            {tag(i, choices[i]!)}: <Reaksjon r={s} /> &nbsp; ΔH = {signed(s.dH)} kJ
          </FormulaLine>
        ))}
        <FormulaLine>
          Sum: <TermsText terms={sum.allLeft} /> → <TermsText terms={sum.allRight} />
        </FormulaLine>
        {sum.cancelled.length > 0 && (
          <FormulaLine>
            Stryk det som står på begge sider: <TermsText terms={sum.cancelled} sep=", " />
          </FormulaLine>
        )}
        <FormulaLine>
          Netto: {sum.net.reactants.length + sum.net.products.length > 0 ? <Reaksjon r={sum.net} /> : 'ingenting'} &nbsp; ΔH ={' '}
          {sum.scaled.map((s, i) => `${i > 0 ? ' + ' : ''}(${signed(s.dH)})`).join('')} = {signed(sum.dH)} kJ
        </FormulaLine>
      </Formula>

      <Explain>{explanation(ex, choices, sum)}</Explain>
    </VizLayout>
  );
}

const TARGET = (ok: boolean): CSSProperties => ({
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'baseline',
  gap: '4px 16px',
  padding: '12px 14px',
  background: 'var(--surface-2)',
  borderRadius: 'var(--radius)',
  boxShadow: ok ? 'inset 0 0 0 2px var(--success)' : undefined,
});

const CARD: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'center',
  gap: '8px 14px',
  padding: '10px 12px',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius)',
  background: 'var(--surface)',
};

function TermsText({ terms, sep = ' + ' }: { terms: Term[]; sep?: string }) {
  return (
    <>
      {terms.map((t, i) => (
        <span key={i}>
          {i > 0 && sep}
          <Formel f={t.formula} coef={t.coef} />
        </span>
      ))}
    </>
  );
}

/* ---------- Figur: energitrappa ---------- */

interface StairLayout {
  W: number;
  narrow: boolean;
  sy: (h: number) => number;
  lineH: number;
  labelW: number;
  /** Etikettene for nivåene: første linjes grunnlinje og linjene (over streken når det er plass, ellers under). */
  placed: Map<number, { first: number; lines: Term[][] }>;
  H: number;
}

const LINE_H = 22;
const TITLE_Y = 22;

/** Plassering av alt i trappa. Nivåetikettene legges over streken, eller under når nivået over står for nær. */
function stairLayout(ex: HessExample, levels: StairLevel[], narrow: boolean): StairLayout {
  const W = narrow ? 400 : 800;
  const labelW = narrow ? 170 : 330;
  const lines = levels.map((l) => splitTerms(sortSpecies(ex, l.species), labelW - 10));
  const Hs = levels.map((l) => l.H);
  const hMax = Math.max(...Hs);
  const hMin = Math.min(...Hs);
  const highest = Hs.indexOf(hMax);
  // Etiketten til det øverste nivået skal få plass over streken, under tittelen.
  const top = TITLE_Y + 40 + (lines[highest]!.length - 1) * LINE_H;
  const low = top + (narrow ? 300 : 280);
  const sy = scaleLinear([hMin, hMax === hMin ? hMin + 1 : hMax], [low, top]);
  const order = levels.map((l, i) => ({ i, y: sy(l.H) })).sort((a, b) => a.y - b.y);
  const placed = new Map<number, { first: number; lines: Term[][] }>();
  let prevBottom = TITLE_Y + 6;
  for (const o of order) {
    const ls = lines[o.i]!;
    const n = ls.length;
    const above = o.y - 7 - (n - 1) * LINE_H;
    const first = above - 15 >= prevBottom + 4 ? above : Math.max(o.y + 21, prevBottom + 19);
    placed.set(o.i, { first, lines: ls });
    prevBottom = first + (n - 1) * LINE_H + 5;
  }
  return { W, narrow, sy, lineH: LINE_H, labelW, placed, H: Math.round(Math.max(low + 34, prevBottom + 12)) };
}

/** Målreaksjonens stoffer først (i samme rekkefølge som i målet), så resten. */
function sortSpecies(ex: HessExample, species: Term[]): Term[] {
  const order = [...ex.target.reactants, ...ex.target.products].map((t) => t.formula);
  const rank = (f: string) => {
    const i = order.indexOf(f);
    return i < 0 ? 100 : i;
  };
  return [...species].sort((a, b) => rank(a.formula) - rank(b.formula));
}

/** Deler en liste med stoffer i linjer som får plass i bredden (omtrentlig tekstbredde for 17 px skrift). */
function splitTerms(terms: Term[], maxW: number): Term[][] {
  const width = (t: Term) => (formulaText(t.formula, true).length + (t.coef !== 1 ? 2 : 0) + 3) * 0.56 * 15.5;
  const lines: Term[][] = [[]];
  let w = 0;
  for (const t of terms) {
    const tw = width(t);
    if (w + tw > maxW && lines[lines.length - 1]!.length > 0) {
      lines.push([]);
      w = 0;
    }
    lines[lines.length - 1]!.push(t);
    w += tw;
  }
  return lines;
}

function Stairs({ levels, choices, sumDH, matches, L }: { levels: StairLevel[]; choices: HessChoice[]; sumDH: number; matches: boolean; L: StairLayout }) {
  const { W, narrow, sy } = L;
  const nSteps = levels.length - 1;
  const arrowsX0 = L.labelW + (narrow ? 34 : 50);
  const directX = W - (narrow ? 58 : 110);
  const stepDx = Math.min(narrow ? 46 : 90, (directX - 40 - arrowsX0) / Math.max(1, nSteps - 1));
  const xs = levels.slice(1).map((_, i) => arrowsX0 + i * stepDx);
  const arrow = (x: number, y1: number, y2: number, color: string, dashed = false) => {
    const len = Math.abs(y2 - y1);
    if (len < 3) return <circle cx={x} cy={y1} r={4} fill={color} />;
    const dir = y2 > y1 ? 1 : -1;
    const h = Math.min(12, len * 0.45);
    return (
      <g>
        <line x1={x} y1={y1} x2={x} y2={y2 - dir * h} stroke={color} strokeWidth={3} strokeDasharray={dashed ? '6 5' : undefined} />
        <polygon points={`${x},${y2} ${x - 6.5},${y2 - dir * h} ${x + 6.5},${y2 - dir * h}`} fill={color} />
      </g>
    );
  };
  const yStart = sy(levels[0]!.H);
  const yEnd = sy(levels[levels.length - 1]!.H);
  const directColor = matches ? OK : VIZ.muted;
  return (
    <g>
      <Txt x={10} y={TITLE_Y} anchor="start" muted size={0.85}>
        {narrow ? 'Entalpi H' : 'Entalpi H (relativ, kJ)'}
      </Txt>
      {levels.map((l, i) => {
        const y = sy(l.H);
        const p = L.placed.get(i)!;
        return (
          <g key={i}>
            <line x1={10} y1={y} x2={W - 10} y2={y} stroke={VIZ.grid} strokeWidth={1.5} />
            <line x1={10} y1={y} x2={L.labelW} y2={y} stroke={VIZ.ink} strokeWidth={3} />
            {/* Loddrett strek fra nivået til etiketten, så det er tydelig hvilket nivå den hører til */}
            <line x1={11.5} x2={11.5} y1={y} y2={p.first < y ? p.first - 14 : p.first + (p.lines.length - 1) * L.lineH + 5} stroke={VIZ.ink} strokeWidth={3} />
            {p.lines.map((line, j) => (
              <Txt key={j} x={20} y={p.first + j * L.lineH} anchor="start" size={0.9} weight={650}>
                {line.map((t, k) => (
                  <tspan key={k}>
                    {k > 0 ? ' + ' : ''}
                    <TFormel f={t.formula} coef={t.coef} />
                  </tspan>
                ))}
                {j < p.lines.length - 1 ? ' +' : ''}
              </Txt>
            ))}
          </g>
        );
      })}
      {xs.map((x, i) => {
        const y1 = sy(levels[i]!.H);
        const y2 = sy(levels[i + 1]!.H);
        const dH = levels[i + 1]!.H - levels[i]!.H;
        const color = dH < 0 ? KJEMI.exo : KJEMI.endo;
        const mid = (y1 + y2) / 2;
        const t = tag(i, choices[i]!);
        return (
          <g key={i}>
            <line x1={x - 14} y1={y1} x2={x + 14} y2={y1} stroke={VIZ.ink} strokeWidth={2} />
            {arrow(x, y1, y2, color)}
            {narrow ? (
              // På mobil står merket ved starten av pila (over den når den går ned, under når den går opp).
              <Txt x={x} y={dH <= 0 ? y1 - 9 : y1 + 22} size={0.85} weight={700} color={color}>
                {t.replace(/ /g, '')}
              </Txt>
            ) : (
              <>
                <Txt x={x + 8} y={mid - 4} anchor="start" size={0.8} weight={700} color={color}>
                  {t}
                </Txt>
                <Txt x={x + 8} y={mid + 18} anchor="start" size={0.8} color={color}>
                  {signed(dH)}
                </Txt>
              </>
            )}
          </g>
        );
      })}
      {arrow(directX, yStart, yEnd, directColor, !matches)}
      <Txt x={directX + 10} y={(yStart + yEnd) / 2 - 4} anchor="start" weight={700} color={directColor} size={0.9}>
        ΔH
      </Txt>
      <Txt x={directX + 10} y={(yStart + yEnd) / 2 + 18} anchor="start" weight={700} color={directColor} size={0.85}>
        {matches ? signed(sumDH) : '?'}
      </Txt>
    </g>
  );
}

/* ---------- Forklaring ---------- */

function hint(ex: HessExample, choices: HessChoice[]): ReactNode {
  const h = hessHint(ex, choices);
  if (!h) return <>Sjekk at stoffene som ikke er med i målreaksjonen, står like mange ganger på hver side, så de kan strykes.</>;
  return (
    <>
      <Formel f={h.species} /> finnes bare i likning ({h.eq + 1}).{' '}
      {h.want === 0 ? (
        <>Den skal ikke være med i målreaksjonen, så den må strykes mot noe på den andre siden.</>
      ) : (
        <>
          I målreaksjonen står {coefText(Math.abs(h.want)) || '1'} <Formel f={h.species} state={false} /> på {h.want > 0 ? 'høyre' : 'venstre'} side, så likning (
          {h.eq + 1}) skal {h.reverse ? 'snus' : 'ikke snus'} og ganges med {coefText(h.factor) || '1'}.
        </>
      )}
    </>
  );
}

function explanation(ex: HessExample, choices: HessChoice[], sum: ReturnType<typeof hessSum>): ReactNode {
  return (
    <>
      <p>
        <strong>Hess' lov:</strong> ΔH for en reaksjon avhenger bare av start og slutt, ikke av veien. Derfor kan vi finne ΔH for en reaksjon vi ikke kan måle,
        ved å legge sammen likninger med kjent ΔH slik at summen blir målreaksjonen. Snur du en likning, skifter ΔH fortegn. Ganger du en likning med et tall,
        ganges også ΔH med det samme tallet.
      </p>
      <p>
        {sum.matches ? (
          <>
            <strong>Summen gir målreaksjonen.</strong> Stoffene som står på begge sider, strykes, og ΔH ={' '}
            {sum.scaled.map((s, i) => `${i > 0 ? ' + ' : ''}(${signed(s.dH)})`).join('')} = {signed(sum.dH)} kJ. I trappa ender trinnene på samme nivå som den
            direkte veien: energien er den samme uansett vei.
          </>
        ) : (
          <>
            <strong>Summen gir ikke målreaksjonen ennå.</strong> {hint(ex, choices)} Begynn med stoffene som bare finnes i én av likningene.
          </>
        )}
      </p>
      <p>{ex.note}</p>
    </>
  );
}
