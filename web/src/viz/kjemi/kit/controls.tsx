/**
 * Kontroller som kjemien trenger i tillegg til kit-ets Slider/Segmented/Toggle: nedtrekksliste, formelfelt og et lite
 * periodesystem for å velge grunnstoff. Plasser dem i <Toolbar> (eller rett i <VizLayout>).
 */
import { useId, type CSSProperties, type ReactNode } from 'react';
import { atomColors } from './colors';
import { parseFormula, type FormulaResult } from './formel';
import { Formel } from './Formel';
import { capitalize, getElement, type Element } from './grunnstoffer';

/** Nedtrekksliste med synlig etikett, f.eks. «Stoff: [vann (H₂O) ▾]». Bruker appens vanlige <select>-stil. */
export function Select<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: ReactNode;
  value: T;
  /** Tekstene i lista må være ren tekst (bruk Unicode-formler: «vann (H₂O)», se formulaText). */
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
}) {
  const id = useId();
  return (
    <span className="kj-select">
      <label htmlFor={id}>{label}</label>
      <select id={id} value={value} onChange={(e) => onChange(e.currentTarget.value as T)}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </span>
  );
}

/**
 * Tekstfelt for en kjemisk formel. Viser formelen pent (H₂SO₄) når den kan tolkes, og en forklarende feilmelding
 * når den ikke kan det. Send inn `result` hvis du allerede har tolket teksten, ellers tolkes den her.
 */
export function FormulaField({
  label,
  value,
  onChange,
  result,
  placeholder = 'f.eks. H2SO4',
}: {
  label: ReactNode;
  value: string;
  onChange: (value: string) => void;
  result?: FormulaResult;
  placeholder?: string;
}) {
  const id = useId();
  const errId = `${id}-feil`;
  const r = result ?? parseFormula(value);
  const showError = !r.ok && value.trim() !== '';
  return (
    <span className="kj-field">
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        type="text"
        inputMode="text"
        autoCapitalize="off"
        autoCorrect="off"
        autoComplete="off"
        spellCheck={false}
        value={value}
        placeholder={placeholder}
        aria-invalid={showError || undefined}
        aria-describedby={showError ? errId : undefined}
        onChange={(e) => onChange(e.currentTarget.value)}
      />
      {r.ok && (
        <span className="kj-field-preview" aria-hidden>
          <Formel f={r.formula} />
        </span>
      )}
      {showError && (
        <span id={errId} className="kj-field-error" role="status">
          {r.error}
        </span>
      )}
    </span>
  );
}

/**
 * Lite periodesystem med bare de grunnstoffene du gir den, plassert etter gruppe (kolonne) og periode (rad).
 * Knappene får en farget stripe etter atomfargen. Velg ett grunnstoff om gangen (`onPick`); `selected` markerer
 * valgte, og `badges` setter et lite merke på knappen (f.eks. «A» og «B» når du velger to atomer).
 *
 *   <ElementPicker label="Velg atom A" elements={['H', 'C', 'N', 'O', 'Na', 'Cl']} selected={[a]} onPick={setA}
 *     detail={(e) => fmt(e.electronegativity ?? NaN, 2)} />
 */
export function ElementPicker({
  label,
  elements,
  selected = [],
  badges = {},
  onPick,
  detail,
  showGroups = false,
}: {
  /** Etikett for skjermlesere (og over gruppa). */
  label: string;
  /** Symbolene som kan velges. Ukjente symboler hoppes over. */
  elements: readonly string[];
  selected?: readonly string[];
  badges?: Readonly<Record<string, ReactNode>>;
  onPick: (symbol: string) => void;
  /** Liten tekst under symbolet, f.eks. elektronegativiteten. */
  detail?: (e: Element) => ReactNode;
  /** Vis gruppenumrene over kolonnene. */
  showGroups?: boolean;
}) {
  const els = elements.map((s) => getElement(s)).filter((e): e is Element => !!e);
  const groups = [...new Set(els.map((e) => e.group ?? 3))].sort((a, b) => a - b);
  const periods = [...new Set(els.map((e) => e.period))].sort((a, b) => a - b);
  const cols = groups.length;
  const cells: ReactNode[] = [];
  if (showGroups)
    groups.forEach((g) =>
      cells.push(
        <span key={`g${g}`} className="kj-picker-head" aria-hidden>
          {g}
        </span>,
      ),
    );
  for (const p of periods)
    for (const g of groups) {
      const e = els.find((x) => x.period === p && (x.group ?? 3) === g);
      if (!e) {
        cells.push(<span key={`${p}-${g}`} aria-hidden />);
        continue;
      }
      const on = selected.includes(e.symbol);
      const badge = badges[e.symbol];
      const d = detail?.(e);
      cells.push(
        <button
          key={e.symbol}
          type="button"
          className={`kj-picker-cell${on ? ' is-on' : ''}`}
          aria-pressed={on}
          title={capitalize(e.name)}
          style={{ '--c': atomColors(e.symbol).line } as CSSProperties}
          onClick={() => onPick(e.symbol)}
        >
          <span className="kj-picker-sym">{e.symbol}</span>
          {d !== undefined && <span className="kj-picker-detail">{d}</span>}
          {badge !== undefined && <span className="kj-picker-badge">{badge}</span>}
          <span className="sr-only">{` ${e.name}`}</span>
        </button>,
      );
    }
  return (
    <div className="kj-picker" role="group" aria-label={label} style={{ '--kj-cols': cols } as CSSProperties}>
      {cells}
    </div>
  );
}
