import { useEffect, useRef, useState, type FocusEvent, type KeyboardEvent, type RefObject } from 'react';
import type { Flashcard } from '@smartnotes/shared';
import { CardDetail, CardMeta, type CardFaceState } from './CardFace';
import { clozeKeys, usePracticeKeys } from './keys';
import type { ClozeOutcome } from './model';
import { matchesTerm, parseBackLine, type Cloze } from './richtext';
import { RichText } from './RichText';

/** Ordet slik eleven skrev det, uten forskjell på store og små bokstaver eller mellomrom rundt. */
const sameText = (a: string, b: string) => a.trim().toLocaleLowerCase('nb') === b.trim().toLocaleLowerCase('nb');

/** På berøringsskjermer rulles feltet inn i bildet over skjermtastaturet når det har kommet opp. */
function scrollAboveKeyboard(e: FocusEvent<HTMLInputElement>): void {
  const el = e.currentTarget;
  if (!window.matchMedia?.('(pointer: coarse)').matches) return;
  setTimeout(() => {
    if (el.isConnected && document.activeElement === el) el.scrollIntoView({ block: 'center' });
  }, 300);
}

const RESULT: Record<ClozeOutcome, string> = {
  right: 'Riktig.',
  wrong: 'Ikke riktig.',
  shown: 'Svaret vises.',
};

/**
 * Luketekst, et kort med luke: spørsmålet og svarpunktene vises med ett nøkkelbegrep byttet ut med et felt. Eleven
 * skriver ordet og trykker Enter (eller «Sjekk»), eller «Vis» for å gi opp. Feltet blir grønt eller rødt og fasiten
 * vises; er eleven uenig i rettingen, gjør «Jeg hadde rett» svaret riktig. Vurderingen (`onDone`) kommer først med
 * «Neste», så eleven rekker å se fasiten. Komponenten får ny `key` for hvert kort, så feltet starter tomt.
 */
export function ClozeRound({
  card,
  cloze,
  source,
  face,
  focusField,
  keysOn,
  tick,
  onDone,
  onUndo,
}: {
  card: Flashcard;
  cloze: Cloze;
  source: string;
  face: CardFaceState;
  /** Sann når fokus skal til feltet med en gang (etter en vurdering eller angring). Settes tilbake her. */
  focusField: RefObject<boolean>;
  keysOn: boolean;
  tick: () => void;
  onDone: (outcome: ClozeOutcome) => void;
  onUndo: () => void;
}) {
  const [typed, setTyped] = useState('');
  const [outcome, setOutcome] = useState<ClozeOutcome | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const nextRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!focusField.current) return;
    focusField.current = false;
    inputRef.current?.focus({ preventScroll: true });
  }, [focusField]);

  // Etter sjekken står fokus på «Neste»: Enter går videre, og skjermtastaturet lukkes.
  useEffect(() => {
    if (outcome) nextRef.current?.focus({ preventScroll: true });
  }, [outcome]);

  const check = () => {
    if (outcome || !typed.trim()) return;
    tick();
    setOutcome(matchesTerm(typed, cloze.term) ? 'right' : 'wrong');
  };
  const reveal = () => {
    if (outcome) return;
    tick();
    setOutcome('shown');
  };
  const overrule = () => {
    tick();
    setOutcome('right');
  };
  const next = () => {
    if (outcome) onDone(outcome);
  };

  usePracticeKeys(
    clozeKeys({
      checked: outcome !== null,
      focusField: () => inputRef.current?.focus(),
      next,
      undo: onUndo,
      toggleDetail: face.toggleDetail,
    }),
    keysOn,
  );

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      check();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      reveal();
    }
  };

  const showTerm = outcome === 'wrong' || outcome === 'shown' || (outcome === 'right' && !sameText(typed, cloze.term));
  const gap =
    outcome === 'shown' ? (
      <b className="fc-gap-answer">{cloze.term}</b>
    ) : (
      <>
        <input
          ref={inputRef}
          type="text"
          className={`fc-gap${outcome === 'right' ? ' is-right' : outcome === 'wrong' ? ' is-wrong' : ''}`}
          style={{ width: `${Math.min(Math.max(cloze.term.length, 6) + 3, 26)}ch` }}
          value={typed}
          readOnly={outcome !== null}
          aria-label="Begrepet som mangler"
          aria-invalid={outcome === 'wrong' || undefined}
          autoCapitalize="off"
          autoCorrect="off"
          autoComplete="off"
          spellCheck={false}
          enterKeyHint="done"
          onChange={(e) => setTyped(e.currentTarget.value)}
          onKeyDown={onKeyDown}
          onFocus={scrollAboveKeyboard}
        />
        {showTerm && <b className="fc-gap-answer">{cloze.term}</b>}
      </>
    );

  return (
    <>
      <div ref={face.cardRef} className="fc-card is-flipped is-cloze">
        <CardMeta card={card} source={source} />
        <p ref={face.questionRef} className="fc-question" tabIndex={-1}>
          <RichText text={card.front} />
        </p>
        <ul ref={face.answerRef} className="fc-answer" tabIndex={-1} aria-label="Svar med luke">
          {card.back.map((line, i) => {
            const l = parseBackLine(line);
            return (
              <li key={i} className={l.label ? 'is-label' : undefined}>
                <RichText text={l.text} gap={i === cloze.line ? { part: cloze.part, node: gap } : undefined} />
              </li>
            );
          })}
        </ul>
        {outcome && <CardDetail card={card} face={face} />}
      </div>

      <p className={`fc-cloze-result${outcome === 'right' ? ' is-ok' : outcome ? ' is-bad' : ''}`} aria-live="polite">
        {outcome && (
          <>
            {RESULT[outcome]}
            {outcome !== 'right' && ` Fasit: ${cloze.term}.`}
          </>
        )}
      </p>
      <div className="fc-cloze-actions" role="group" aria-label="Luka">
        {outcome === null ? (
          <>
            <button type="button" className="fc-cloze-quiet" onClick={reveal}>
              Vis
            </button>
            <button type="button" className="fc-cloze-main" disabled={!typed.trim()} onClick={check}>
              Sjekk
            </button>
          </>
        ) : (
          <>
            {outcome === 'wrong' && (
              <button type="button" className="fc-cloze-quiet" onClick={overrule}>
                Jeg hadde rett
              </button>
            )}
            <button ref={nextRef} type="button" className="fc-cloze-main" onClick={next}>
              Neste
            </button>
          </>
        )}
      </div>
    </>
  );
}
