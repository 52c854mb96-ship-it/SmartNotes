import { Children, Fragment, useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { ArrowLeft, ArrowRight, ListOrdered, RotateCcw, Rows3 } from 'lucide-react';

/**
 * Eksempeloppgaver: en oppgave i eksamensstil med deloppgaver, en figur som bygger seg opp, og løsningen steg for
 * steg. Eleven blar gjennom løsningen (ingen svarfelt) og kan vise hele løsningen på én gang.
 *
 *   <WorkedExample
 *     intro={<p>En kasse på 25 kg sklir ned en rampe …</p>}
 *     given={['m = 25 kg', 'α = 30°', <>μ<Sub>k</Sub> = 0,20</>]}
 *     parts={[{ id: 'a', text: 'Tegn kreftene …' }, { id: 'b', text: 'Finn akselerasjonen.' }]}
 *     steps={[{ part: 'a', title: 'Hvilke krefter virker?', body: …, figure: 'krefter' }, …]}
 *     figure={({ step }) => <Scene showForces={step >= 1} />}
 *   />
 *
 * Oppgavene skal være egne (egen tekst, egne tall, egne situasjoner), aldri kopier av ekte eksamens- eller
 * læreboksoppgaver.
 */

export interface ExamplePart {
  /** «a», «b», «c» … */
  id: string;
  /** Spørsmålet i deloppgaven. */
  text: ReactNode;
}

export interface ExampleStep {
  /** Deloppgaven steget hører til («a», «b» …). */
  part: string;
  /** Kort overskrift: «Tegn kreftene på kassen», «Bruk Newtons 2. lov langs rampa». */
  title: ReactNode;
  /** Forklaringen: hva vi gjør og hvorfor (gjerne et par setninger). */
  body?: ReactNode;
  /** Utregningen, én linje per element. Bruk levende tall fra modellen. */
  math?: ReactNode[];
  /** Svaret på deloppgaven (uthevet). Settes på det siste steget i deloppgaven. */
  answer?: ReactNode;
  /** Et tips som hører til steget (vises som «Tips»). */
  tip?: ReactNode;
  /** En typisk feil elever gjør her (vises som «Vanlig feil»). */
  pitfall?: ReactNode;
}

export interface FigureState {
  /** 0 før løsningen starter, deretter 1 … antall steg. */
  step: number;
  /** Deloppgaven til steget som vises (null før løsningen starter). */
  part: string | null;
  /** Om hele løsningen vises (figuren bør da vise alt). */
  showAll: boolean;
}

export interface WorkedExampleProps {
  /** Oppgaveteksten: situasjonen og tallene. */
  intro: ReactNode;
  /** Opplysningene oppgaven gir, kort («m = 25 kg»). Valgfritt, vises som en liste. */
  given?: ReactNode[];
  /** Deloppgavene i rekkefølge. */
  parts: ExamplePart[];
  /** Løsningen steg for steg, i rekkefølge. Hver deloppgave bør ha minst ett steg. */
  steps: ExampleStep[];
  /** Figuren, som kan bygge seg opp med stegene. */
  figure: (state: FigureState) => ReactNode;
  /**
   * Valgfrie tallsett («Andre tall»): oppgaven regnes ut på nytt med andre tall, og løsningen følger med.
   * `labels` vises som knapper, f.eks. ['Tallsett 1', 'Tallsett 2', 'Tallsett 3'].
   */
  variants?: { labels: string[]; value: number; onChange: (index: number) => void };
}

/** En hel eksempeloppgave. Brukes i stedet for VizLayout i komponenter med `kind: 'eksempel'`. */
export function WorkedExample({ intro, given, parts, steps, figure, variants }: WorkedExampleProps) {
  const [step, setStep] = useState(0);
  const [showAll, setShowAll] = useState(false);
  const n = steps.length;
  const current = step > 0 ? steps[step - 1] : undefined;
  const part = showAll ? null : (current?.part ?? null);
  const panel = useRef<HTMLDivElement>(null);
  const headingId = useId();
  const firstRender = useRef(true);

  // Flytt fokus til steget når eleven blar (skjermlesere leser det da opp), men ikke ved første visning.
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    if (!showAll) panel.current?.focus({ preventScroll: true });
  }, [step, showAll]);

  const go = (s: number) => setStep(Math.max(0, Math.min(n, s)));
  const onKey = (e: KeyboardEvent) => {
    if (showAll) return;
    if (e.key === 'ArrowRight') {
      e.preventDefault();
      go(step + 1);
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      go(step - 1);
    }
  };
  const firstStepOf = (id: string) => steps.findIndex((s) => s.part === id) + 1;
  const answered = (id: string) => steps.some((s, i) => s.part === id && s.answer !== undefined && (showAll || i < step));

  return (
    <div className="viz viz-example">
      <section className="viz-task" aria-labelledby={headingId}>
        <div className="viz-task-head">
          <h2 id={headingId} className="viz-task-title">
            Oppgave
          </h2>
          {variants && variants.labels.length > 1 && (
            <div className="viz-segmented" role="radiogroup" aria-label="Velg tallsett">
              {variants.labels.map((label, i) => (
                <button
                  key={i}
                  type="button"
                  role="radio"
                  aria-checked={i === variants.value}
                  className={i === variants.value ? 'is-on' : undefined}
                  onClick={() => variants.onChange(i)}
                >
                  {label}
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="viz-task-intro">{intro}</div>
        {given && given.length > 0 && (
          <ul className="viz-task-given" role="list" aria-label="Oppgitt">
            {given.map((g, i) => (
              <li key={i}>{g}</li>
            ))}
          </ul>
        )}
        <ol className="viz-task-parts" role="list">
          {parts.map((p) => {
            const first = firstStepOf(p.id);
            return (
              <li key={p.id} className={`${p.id === part ? 'is-current' : ''}${answered(p.id) ? ' is-done' : ''}`}>
                <span className="viz-task-part-id">{p.id})</span>
                <span className="viz-task-part-text">{p.text}</span>
                {!showAll && first > 0 && (
                  <button type="button" className="btn btn-sm btn-ghost viz-task-jump" onClick={() => go(first)}>
                    Til løsningen
                  </button>
                )}
              </li>
            );
          })}
        </ol>
      </section>

      {figure({ step: showAll ? n : step, part, showAll })}

      <div className="viz-steps-bar">
        {!showAll && (
          <>
            <button type="button" className="btn btn-sm" onClick={() => go(step - 1)} disabled={step === 0}>
              <ArrowLeft size={16} aria-hidden /> Forrige
            </button>
            <button type="button" className="btn btn-sm btn-primary" onClick={() => go(step + 1)} disabled={step === n}>
              {step === 0 ? 'Vis første steg' : 'Neste steg'} <ArrowRight size={16} aria-hidden />
            </button>
            <span className="viz-steps-count" aria-live="off">
              {step === 0 ? `${n} steg` : `Steg ${step} av ${n}`}
            </span>
          </>
        )}
        <span className="viz-steps-spacer" />
        {!showAll && step > 0 && (
          <button type="button" className="btn btn-sm btn-ghost" onClick={() => go(0)}>
            <RotateCcw size={16} aria-hidden /> Start på nytt
          </button>
        )}
        <button type="button" className="btn btn-sm btn-ghost" onClick={() => setShowAll((v) => !v)} aria-pressed={showAll}>
          {showAll ? <ListOrdered size={16} aria-hidden /> : <Rows3 size={16} aria-hidden />}
          {showAll ? 'Steg for steg' : 'Vis hele løsningen'}
        </button>
      </div>

      {!showAll && (
        <div className="viz-steps-dots" role="group" aria-label="Gå til steg">
          {steps.map((s, i) => {
            const newPart = i === 0 || steps[i - 1]?.part !== s.part;
            return (
              <Fragment key={i}>
                {newPart && <span className="viz-steps-dot-part">{s.part})</span>}
                <button
                  type="button"
                  className={`viz-steps-dot${i + 1 === step ? ' is-current' : i + 1 < step ? ' is-seen' : ''}`}
                  aria-label={`Steg ${i + 1}`}
                  aria-current={i + 1 === step ? 'step' : undefined}
                  onClick={() => go(i + 1)}
                />
              </Fragment>
            );
          })}
        </div>
      )}

      {showAll ? (
        <div className="viz-steps-all">
          {parts.map((p) => (
            <section key={p.id} className="viz-steps-part" aria-label={`Deloppgave ${p.id}`}>
              <h3 className="viz-steps-part-title">
                <span className="viz-task-part-id">{p.id})</span> {p.text}
              </h3>
              {steps
                .filter((s) => s.part === p.id)
                .map((s, i) => (
                  <StepCard key={i} step={s} />
                ))}
            </section>
          ))}
        </div>
      ) : (
        <div className="viz-step-panel" ref={panel} tabIndex={-1} onKeyDown={onKey} aria-live="polite">
          {current ? (
            <StepCard step={current} label={`${current.part})`} />
          ) : (
            <div className="viz-step is-intro">
              <p>
                <strong>Prøv selv først.</strong> Les oppgaven, tegn en skisse og skriv ned hva du vet og hva du skal finne. Bla deretter
                gjennom løsningen ett steg om gangen, og sammenlign med din egen.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function StepCard({ step, label }: { step: ExampleStep; label?: string }) {
  return (
    <div className="viz-step">
      <h3 className="viz-step-title">
        {label && <span className="viz-task-part-id">{label}</span>} {step.title}
      </h3>
      {step.body && <div className="viz-step-body">{step.body}</div>}
      {step.math && step.math.length > 0 && (
        <div className="viz-formula" aria-label="Utregning">
          {step.math.map((line, i) => (
            <div key={i} className="viz-formula-line">
              {Children.map(line, wrapRoot)}
            </div>
          ))}
        </div>
      )}
      {step.answer && (
        <div className="viz-answer">
          <span className="viz-answer-label">Svar</span>
          <span className="viz-answer-text">{step.answer}</span>
        </div>
      )}
      {step.tip && (
        <div className="viz-tip">
          <span className="viz-tip-label">Tips</span>
          <span>{step.tip}</span>
        </div>
      )}
      {step.pitfall && (
        <div className="viz-tip is-pitfall">
          <span className="viz-tip-label">Vanlig feil</span>
          <span>{step.pitfall}</span>
        </div>
      )}
    </div>
  );
}

/** Samme som i FormulaLine: √ settes med vanlig skrift. */
function wrapRoot(child: ReactNode): ReactNode {
  if (typeof child !== 'string' || !child.includes('√')) return child;
  return child.split('√').flatMap((part, i) => (i === 0 ? [part] : [<span key={i} className="viz-root">√</span>, part]));
}
