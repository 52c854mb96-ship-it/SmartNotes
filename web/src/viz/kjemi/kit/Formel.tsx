/**
 * Kjemiske formler og reaksjonslikninger med riktig senket og hevet skrift, både i vanlig HTML og inne i SVG-tekst.
 *
 *   <Formel f="Ca(OH)2" />                 Ca(OH)₂ i HTML (Readout, Explain, Formula, knapper)
 *   <Formel f="NaCl(aq)" />                NaCl(aq) – tilstanden i formelen vises
 *   <Formel f="Cu^2+" state="aq" />        Cu²⁺(aq)
 *   <Txt x={…} y={…}><TFormel f="SO4^2-" /></Txt>      inne i en SVG-<text>
 *   <Reaksjon r="2 H2 + O2 → 2 H2O" />     hele likningen (også ⇌ for likevekt)
 *
 * Ugyldige formler vises som de er skrevet (siden krasjer ikke). Tolk med parseFormula først når du vil vise en feil.
 */
import { Fragment, type ReactNode } from 'react';
import { Sub, Sup, TSub, TSup } from '../../kit';
import { coefText, parseFormula, parseReaction, type Formula, type Reaction, type State, type Term } from './formel';

export interface FormelProps {
  /** Formelen som tekst («H2O», «SO4^2-», «Cu^2+(aq)») eller allerede tolket. */
  f: string | Formula;
  /** true (standard): vis tilstanden hvis den står i formelen. false: aldri. «aq», «s» …: vis denne. */
  state?: boolean | State;
  /** Koeffisient foran formelen (1 vises ikke). */
  coef?: number;
}

function resolve(f: string | Formula): Formula | null {
  if (typeof f !== 'string') return f;
  const r = parseFormula(f);
  return r.ok ? r.formula : null;
}

function stateOf(p: Formula, state: boolean | State | undefined): State | null {
  if (state === false) return null;
  if (typeof state === 'string') return state;
  return p.state;
}

/** Formel i vanlig HTML med <sub>/<sup>. */
export function Formel({ f, state = true, coef }: FormelProps) {
  const p = resolve(f);
  const c = coef === undefined ? '' : coefText(coef);
  if (!p) return <span className="kj-formel">{typeof f === 'string' ? f : f.source}</span>;
  const st = stateOf(p, state);
  return (
    <span className="kj-formel">
      {c && `${c} `}
      {p.tokens.map((t, i) =>
        t.kind === 'sub' ? <Sub key={i}>{t.text}</Sub> : t.kind === 'sup' ? <Sup key={i}>{t.text}</Sup> : <Fragment key={i}>{t.text}</Fragment>,
      )}
      {st && <span className="kj-state">({st})</span>}
    </span>
  );
}

/** Formel inne i SVG-tekst (<text>, <Txt>, <Label>), med kit-ets TSub/TSup. */
export function TFormel({ f, state = true, coef }: FormelProps) {
  const p = resolve(f);
  const c = coef === undefined ? '' : coefText(coef);
  if (!p) return <>{typeof f === 'string' ? f : f.source}</>;
  const st = stateOf(p, state);
  return (
    <>
      {c && `${c} `}
      {p.tokens.map((t, i) =>
        t.kind === 'sub' ? <TSub key={i}>{t.text}</TSub> : t.kind === 'sup' ? <TSup key={i}>{t.text}</TSup> : <Fragment key={i}>{t.text}</Fragment>,
      )}
      {st && <tspan fontSize="0.85em">({st})</tspan>}
    </>
  );
}

export interface ReaksjonProps {
  /** Likningen som tekst («2 H2 + O2 → 2 H2O») eller strukturert ({ reactants, products, equilibrium }). */
  r: string | Reaction;
  /** Vis tilstandssymbolene (standard true). */
  states?: boolean;
}

function resolveReaction(r: string | Reaction): Reaction | null {
  if (typeof r !== 'string') return r;
  const res = parseReaction(r);
  return res.ok ? res.reaction : null;
}

function terms(ts: Term[], states: boolean, svg: boolean): ReactNode[] {
  const out: ReactNode[] = [];
  ts.forEach((t, i) => {
    if (i > 0) out.push(<Fragment key={`p${i}`}>{' + '}</Fragment>);
    const st = states ? (t.state ?? true) : false;
    out.push(svg ? <TFormel key={i} f={t.formula} coef={t.coef} state={st} /> : <Formel key={i} f={t.formula} coef={t.coef} state={st} />);
  });
  return out;
}

/** Reaksjonslikning i vanlig HTML: «2 H₂ + O₂ → 2 H₂O». */
export function Reaksjon({ r, states = true }: ReaksjonProps) {
  const rx = resolveReaction(r);
  if (!rx) return <span>{typeof r === 'string' ? r : ''}</span>;
  return (
    <span className="kj-reaction">
      {terms(rx.reactants, states, false)}
      <span className="kj-reaction-arrow">{rx.equilibrium ? '⇌' : '→'}</span>
      {terms(rx.products, states, false)}
    </span>
  );
}

/** Reaksjonslikning inne i SVG-tekst. */
export function TReaksjon({ r, states = true }: ReaksjonProps) {
  const rx = resolveReaction(r);
  if (!rx) return <>{typeof r === 'string' ? r : ''}</>;
  return (
    <>
      {terms(rx.reactants, states, true)}
      {rx.equilibrium ? ' ⇌ ' : ' → '}
      {terms(rx.products, states, true)}
    </>
  );
}
