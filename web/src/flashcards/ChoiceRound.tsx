import { useEffect, useRef, useState } from 'react';
import { Check, X } from 'lucide-react';
import type { Flashcard } from '@smartnotes/shared';
import { CardDetail, CardMeta, type CardFaceState } from './CardFace';
import { choiceKeys, usePracticeKeys } from './keys';
import type { ChoiceOption } from './model';
import { parseBackLine } from './richtext';
import { RichText } from './RichText';

/**
 * Flervalg, et kort med svaralternativer: spørsmålet og alternativene (`options`, i den faste rekkefølgen for runden,
 * se `choiceOptions`). Eleven velger med et trykk eller tastene 1–4. Riktig: alternativet blir grønt. Galt: det valgte
 * blir rødt og det riktige grønt, og baksiden og «Detaljert forklaring» vises. Vurderingen (`onDone`) kommer først med
 * «Neste», så eleven rekker å se svaret; ingenting går videre av seg selv (det roligste). Komponenten får ny `key` for
 * hvert kort, så alternativene starter uvalgt.
 */
export function ChoiceRound({
  card,
  options,
  source,
  face,
  keysOn,
  tick,
  onPick,
  onDone,
  onUndo,
}: {
  card: Flashcard;
  options: ChoiceOption[];
  source: string;
  face: CardFaceState;
  keysOn: boolean;
  tick: () => void;
  /** Eleven har valgt (linja om forrige kort forsvinner, så bare resultatet står). */
  onPick: () => void;
  /** «Neste»: `right` er sann når det valgte alternativet var det riktige. */
  onDone: (right: boolean) => void;
  onUndo: () => void;
}) {
  const [picked, setPicked] = useState<number | null>(null);
  const right = picked === null ? null : (options[picked]?.correct ?? false);
  const nextRef = useRef<HTMLButtonElement>(null);
  const correct = options.find((o) => o.correct);

  // Etter valget står fokus på «Neste»: Enter eller mellomrom går videre.
  useEffect(() => {
    if (picked !== null) nextRef.current?.focus({ preventScroll: true });
  }, [picked]);

  const pick = (i: number) => {
    if (picked !== null || !options[i]) return;
    tick();
    onPick();
    setPicked(i);
    // Galt svar: baksiden vises. Kortet regnes da som snudd, så «Detaljert forklaring» ikke flytter fokus fra «Neste».
    if (!options[i].correct) face.show('answer', false);
  };
  const next = () => {
    if (right !== null) onDone(right);
  };

  usePracticeKeys(
    choiceKeys({
      answered: picked !== null,
      count: options.length,
      pick,
      next,
      undo: onUndo,
      toggleDetail: right === false && card.detail ? face.toggleDetail : undefined,
    }),
    keysOn,
  );

  return (
    <>
      <div ref={face.cardRef} className="fc-card is-choice">
        <CardMeta card={card} source={source} />
        <p ref={face.questionRef} className="fc-question" tabIndex={-1}>
          <RichText text={card.front} />
        </p>
        <div className="fc-options" role="group" aria-label="Svaralternativer">
          {options.map((o, i) => {
            const state = picked === null ? '' : o.correct ? ' is-right' : i === picked ? ' is-wrong' : ' is-dim';
            return (
              <button
                key={i}
                type="button"
                className={`fc-option${state}`}
                aria-disabled={picked !== null || undefined}
                aria-keyshortcuts={String(i + 1)}
                onClick={() => pick(i)}
              >
                <span className="fc-option-key" aria-hidden>
                  {i + 1}
                </span>
                <span className="fc-option-text">
                  <RichText text={o.text} />
                </span>
                {picked !== null && o.correct && (
                  <>
                    <Check className="fc-option-mark" size={19} aria-hidden />
                    <span className="sr-only">, riktig svar</span>
                  </>
                )}
                {i === picked && !o.correct && (
                  <>
                    <X className="fc-option-mark" size={19} aria-hidden />
                    <span className="sr-only">, ditt svar</span>
                  </>
                )}
              </button>
            );
          })}
        </div>
        {right === false && (
          <>
            <ul ref={face.answerRef} className="fc-answer fc-choice-back" tabIndex={-1} aria-label="Svar">
              {card.back.map((line, i) => {
                const l = parseBackLine(line);
                return (
                  <li key={i} className={l.label ? 'is-label' : undefined}>
                    <RichText text={l.text} />
                  </li>
                );
              })}
            </ul>
            <CardDetail card={card} face={face} />
          </>
        )}
      </div>

      <p className={`fc-choice-result${right === true ? ' is-ok' : right === false ? ' is-bad' : ''}`} aria-live="polite">
        {right === true && 'Riktig.'}
        {right === false && (
          <>
            Ikke riktig.
            {correct && (
              <span className="sr-only">
                {' '}
                Riktig svar: <RichText text={correct.text} />.
              </span>
            )}
          </>
        )}
      </p>
      {picked !== null && (
        <div className="fc-choice-actions">
          <button ref={nextRef} type="button" className="fc-choice-next" onClick={next}>
            Neste
          </button>
        </div>
      )}
    </>
  );
}
