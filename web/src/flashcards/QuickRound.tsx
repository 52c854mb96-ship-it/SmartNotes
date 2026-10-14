import { useCallback, useMemo, useRef, type Dispatch, type SetStateAction } from 'react';
import { Undo2 } from 'lucide-react';
import type { Flashcard } from '@smartnotes/shared';
import { plural } from '../lib/format';
import { CardFace } from './CardFace';
import { Choice } from './Choice';
import { ChoiceRound } from './ChoiceRound';
import { ClozeRound } from './ClozeRound';
import { quickKeys, usePracticeKeys } from './keys';
import {
  CHOICE_MAX_LEVEL,
  MASTER,
  OWN_CARDS,
  choiceOptions,
  correctPct,
  hasChoices,
  knownFirstTry,
  levelOf,
  rateChoice,
  rateCloze,
  rateQuick,
  repetitionChoices,
  type ClozeOutcome,
  type RateOutcome,
  type Round,
} from './model';
import { clozeOf } from './richtext';
import type { Session } from './session';
import { useRating } from './useRating';

/**
 * Rask runde: eleven snur kortet og svarer «Kunne» (ett nivå opp, ferdig i runden) eller «Kunne ikke» (nivå 0, kommer
 * igjen til slutt). Alle kortene i utvalget er med, også de mestrede. Med `cloze` (rundenummeret til `clozeOf`) er det
 * Luketekst: kort med et nøkkelbegrep får en luke i svaret (`ClozeRound`), og de andre vises som i Rask runde. Med
 * `choice` (rundenummeret til `choiceOptions`) er det Flervalg: kort med svaralternativer vises med alternativene
 * (`ChoiceRound`), og de andre som i Rask runde.
 */
export function QuickRound({
  session,
  round,
  setRound,
  cloze,
  choice = null,
}: {
  session: Session;
  round: Round;
  setRound: Dispatch<SetStateAction<Round>>;
  cloze: number | null;
  choice?: number | null;
}) {
  const { cards, selection, current, groupName, best, face, feedback, tick, undoStack } = session;
  const { flipped } = face;
  const streakRef = useRef<HTMLSpanElement>(null);
  const rating = useRating(session, round, setRound, streakRef);
  /** Luketekst: fokus til feltet i det neste kortet med luke. */
  const focusGap = useRef(false);

  const gapOf = useCallback((card: Flashcard | undefined) => (cloze !== null && card ? clozeOf(card, cloze) : null), [cloze]);
  const gap = gapOf(current);
  const options = useMemo(() => (choice !== null && current ? choiceOptions(current, choice) : null), [choice, current]);

  /** Bruker vurderingen. Har neste kort en luke, går fokus til feltet i stedet for spørsmålet. */
  const finish = useCallback(
    (out: RateOutcome | null) => {
      if (!out) return;
      const nextGap = gapOf(cards.find((c) => c.id === out.round.queue[0])) !== null;
      focusGap.current = nextGap;
      rating.apply(out, !nextGap);
    },
    [gapOf, cards, rating],
  );

  const onAnswer = useCallback(
    (known: boolean) => {
      if (!flipped || !current || gap) return;
      tick();
      finish(rateQuick(round, rating.context(), known));
    },
    [flipped, current, gap, tick, finish, round, rating],
  );

  const onChoice = useCallback(
    (right: boolean) => {
      if (!current || !options) return;
      tick();
      finish(rateChoice(round, rating.context(), right));
    },
    [current, options, tick, finish, round, rating],
  );

  const onCloze = useCallback(
    (outcome: ClozeOutcome) => {
      if (!current || !gap) return;
      tick();
      finish(rateCloze(round, rating.context(), outcome));
    },
    [current, gap, tick, finish, round, rating],
  );

  const onUndo = useCallback(() => {
    const last = undoStack[undoStack.length - 1];
    if (!last) return;
    const restored = cards.find((c) => c.id === last.cardId);
    const restoredGap = gapOf(restored) !== null;
    focusGap.current = restoredGap;
    // Et kort med svaralternativer vises uvalgt igjen, med fokus på spørsmålet; de andre med svaret, som før.
    if (choice !== null && hasChoices(restored)) rating.undo(false, true);
    else rating.undo(!restoredGap);
  }, [undoStack, gapOf, cards, rating, choice]);

  usePracticeKeys(
    quickKeys({ flip: face.flip, answer: onAnswer, undo: onUndo, toggleDetail: face.toggleDetail }),
    session.keysOn && !gap && !options,
  );

  const total = selection.length;
  const left = round.queue.length;
  const pct = total ? Math.round(((total - left) / total) * 100) : 0;
  const source = current ? groupName(current.noteId ?? OWN_CARDS) : '';

  return (
    <>
      <div className="fc-status">
        <span>{total > 0 && `Igjen ${left} av ${total}`}</span>
        <span className="fc-pills">
          <span ref={streakRef} className={`fc-pill${round.streak >= 5 ? ' is-hot' : ''}`}>
            Rekke {round.streak}
          </span>
          <span className="fc-pill is-best">Beste {best.value}</span>
        </span>
      </div>
      <div
        className="fc-bar"
        role="progressbar"
        aria-label="Fremdrift i runden"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={pct}
      >
        <div style={{ width: `${pct}%` }} />
      </div>

      {current ? (
        <>
          {options ? (
            <ChoiceRound
              key={`${current.id}:${round.answered}`}
              card={current}
              options={options}
              source={source}
              face={face}
              keysOn={session.keysOn}
              tick={tick}
              onPick={() => feedback.set('', '')}
              onDone={onChoice}
              onUndo={onUndo}
            />
          ) : gap ? (
            <ClozeRound
              key={`${current.id}:${round.answered}`}
              card={current}
              cloze={gap}
              source={source}
              face={face}
              focusField={focusGap}
              keysOn={session.keysOn}
              tick={tick}
              onCheck={() => feedback.set('', '')}
              onDone={onCloze}
              onUndo={onUndo}
            />
          ) : (
            <>
              <CardFace card={current} source={source} face={face} />
              <div className="fc-two" role="group" aria-label="Kunne du svaret?">
                <button type="button" className="fc-no" disabled={!flipped} onClick={() => onAnswer(false)}>
                  Kunne ikke
                  <small>Tilbake til nivå 0</small>
                </button>
                <button type="button" className="fc-yes" disabled={!flipped} onClick={() => onAnswer(true)}>
                  Kunne
                  <small>Ett nivå opp</small>
                </button>
              </div>
            </>
          )}
          <div className={`fc-feedback${feedback.tone ? ` is-${feedback.tone}` : ''}`} aria-live="polite">
            {feedback.text}
          </div>
          <div className="fc-sub">
            <button type="button" className="link-btn" disabled={!undoStack.length} onClick={onUndo}>
              <Undo2 size={15} aria-hidden /> Angre forrige
            </button>
          </div>
          {options ? (
            <p className="fc-keys">
              <span>
                <kbd>1</kbd>–<kbd>4</kbd> velg svar
              </span>
              <span>
                <kbd>Enter</kbd> neste
              </span>
              <span>
                <kbd>D</kbd> detaljert forklaring
              </span>
              <span>
                <kbd>Z</kbd> angre
              </span>
            </p>
          ) : gap ? (
            <p className="fc-keys">
              <span>
                <kbd>Enter</kbd> sjekk og gå videre
              </span>
              <span>
                <kbd>Esc</kbd> vis svaret
              </span>
              <span>
                <kbd>Z</kbd> angre
              </span>
            </p>
          ) : (
            <p className="fc-keys">
              <span>
                <kbd>Mellomrom</kbd> snu
              </span>
              <span>
                <kbd>←</kbd> kunne ikke
              </span>
              <span>
                <kbd>→</kbd> kunne
              </span>
              <span>
                <kbd>D</kbd> detaljert forklaring
              </span>
              <span>
                <kbd>Z</kbd> angre
              </span>
            </p>
          )}
        </>
      ) : (
        <QuickDone
          session={session}
          round={round}
          variant={choice !== null ? 'choice' : cloze !== null ? 'cloze' : 'quick'}
          undo={undoStack.length > 0 ? onUndo : null}
        />
      )}
    </>
  );
}

/** Formene som bruker motoren fra Rask runde. */
export type QuickVariant = 'quick' | 'cloze' | 'choice';

/** Linja under overskriften etter runden: hva runden gjorde med nivåene. */
function doneText(variant: QuickVariant, missed: boolean, someWithout: boolean): string {
  if (variant === 'cloze') {
    return 'Riktige luker gir minst nivå 1, men gjør aldri et kort mestret. Kortene uten luke flytter nivåene som i en rask runde.';
  }
  if (variant === 'choice') {
    const base = `Et riktig svar gir ett nivå opp, men høyst nivå ${CHOICE_MAX_LEVEL}, fordi det er lettere å kjenne igjen svaret enn å huske det.`;
    const miss = missed ? ' Kortene du svarte feil på, falt til nivå 0 og står nå på nivå 1.' : '';
    const rest = someWithout ? ' Kortene uten svaralternativer flyttet nivåene som i en rask runde.' : '';
    return base + miss + rest;
  }
  return missed
    ? 'Kortene du kunne med en gang, gikk ett nivå opp, høyst til mestret. De du ikke kunne, falt til nivå 0 og står nå på nivå 1.'
    : 'Alle kortene gikk ett nivå opp, og kort som alt var mestret, er fortsatt mestret.';
}

/**
 * Etter Rask runde (og Luketekst og Flervalg): hvor mange kort eleven kunne med en gang, og valgene videre. Ingen av dem
 * nullstiller nivåene: kortene eleven ikke kunne, i en ny runde eller med mestring, eller alle på nytt. Mestring hopper
 * over mestrede kort, så «Øv dem med mestring» tar bare de bommede som ikke er mestret (i Luketekst kan et mestret kort
 * bommes uten å falle).
 */
export function QuickDone({
  session,
  round,
  variant,
  undo,
}: {
  session: Session;
  round: Round;
  variant: QuickVariant;
  undo: (() => void) | null;
}) {
  const { selection, filter, restart, nextChunk, best } = session;
  if (selection.length === 0) {
    return (
      <section className="fc-done" aria-live="polite">
        <h2>Ingen kort med dette utvalget</h2>
        <p className="muted">Velg et annet notat eller en annen korttype.</p>
      </section>
    );
  }
  const total = selection.length;
  const known = knownFirstTry(
    selection.map((c) => c.id),
    round.grades,
  );
  const { misses } = repetitionChoices(selection, round.grades);
  const missed = new Set(misses);
  const open = selection.filter((c) => missed.has(c.id) && levelOf(c) < MASTER).map((c) => c.id);
  /** Runden gjaldt bare noen kort (en repetisjon eller en kort økt), så «på nytt» gir de samme kortene. */
  const same = filter.subset !== null;
  const quick = variant === 'quick';
  const someWithout = variant === 'choice' && !selection.every(hasChoices);
  return (
    <section className="fc-done is-win" aria-live="polite">
      <h2>{variant === 'choice' ? `${known} av ${total} riktige med en gang` : `${known} av ${total} kunne du med en gang`}</h2>
      <p className="muted">{doneText(variant, misses.length > 0, someWithout)}</p>
      {round.answered > 0 && (
        <div className="fc-stats">
          <div>
            <b>{round.answered}</b>
            <span>svar i runden</span>
          </div>
          <div>
            <b>{correctPct(round)} %</b>
            <span>{variant === 'choice' ? 'riktige' : 'kunne'}</span>
          </div>
          <div>
            <b>{best.value}</b>
            <span>beste rekke</span>
          </div>
        </div>
      )}
      <h3 className="fc-repeat-title">Gå videre</h3>
      <div className="fc-repeat">
        {nextChunk && (
          <Choice
            primary
            label={`Neste ${plural(nextChunk.count, 'kort', 'kort')}`}
            meta="Kort du ikke har hatt i denne omgangen"
            onClick={nextChunk.start}
          />
        )}
        {misses.length > 0 && (
          <Choice
            primary={!nextChunk}
            label={variant === 'choice' ? 'De du svarte feil på' : 'De du ikke kunne'}
            meta={`${plural(misses.length, 'kort', 'kort')} i en ny runde`}
            onClick={() => restart({ ...filter, subset: misses, subsetKind: 'repeat' })}
          />
        )}
        {open.length > 0 && (
          <Choice
            label="Øv dem med mestring"
            meta={`Grundig: ${plural(open.length, 'kort', 'kort')}${open.length < misses.length ? ' som ikke er mestret,' : ''} kommer igjen til du kan dem`}
            onClick={() => restart({ ...filter, mode: 'mastery', subset: open, subsetKind: 'repeat', seen: [] })}
          />
        )}
        <Choice
          primary={!nextChunk && misses.length === 0}
          label={same ? (quick ? 'Samme kort i en ny rask runde' : 'Samme kort i en ny runde') : quick ? 'Ny rask runde med alle' : 'Ny runde med alle'}
          meta={`${plural(total, 'kort', 'kort')}${same ? (filter.subsetKind === 'chunk' ? ' fra økta' : ' fra repetisjonen') : ''}, uten å nullstille`}
          onClick={() => restart({ ...filter })}
        />
      </div>
      {undo && (
        <div className="fc-sub">
          <button type="button" className="link-btn" onClick={undo}>
            <Undo2 size={15} aria-hidden /> Angre forrige
          </button>
        </div>
      )}
    </section>
  );
}
