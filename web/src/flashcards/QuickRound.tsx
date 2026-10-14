import { useCallback, useRef, type Dispatch, type SetStateAction } from 'react';
import { Undo2 } from 'lucide-react';
import type { Flashcard } from '@smartnotes/shared';
import { plural } from '../lib/format';
import { CardFace } from './CardFace';
import { Choice } from './Choice';
import { ClozeRound } from './ClozeRound';
import { quickKeys, usePracticeKeys } from './keys';
import {
  OWN_CARDS,
  correctPct,
  knownFirstTry,
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
 * Luketekst: kort med et nøkkelbegrep får en luke i svaret (`ClozeRound`), og de andre vises som i Rask runde.
 */
export function QuickRound({
  session,
  round,
  setRound,
  cloze,
}: {
  session: Session;
  round: Round;
  setRound: Dispatch<SetStateAction<Round>>;
  cloze: number | null;
}) {
  const { cards, selection, current, groupName, best, face, feedback, tick, undoStack } = session;
  const { flipped } = face;
  const streakRef = useRef<HTMLSpanElement>(null);
  const rating = useRating(session, round, setRound, streakRef);
  /** Luketekst: fokus til feltet i det neste kortet med luke. */
  const focusGap = useRef(false);

  const gapOf = useCallback((card: Flashcard | undefined) => (cloze !== null && card ? clozeOf(card, cloze) : null), [cloze]);
  const gap = gapOf(current);

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
    const restoredGap = gapOf(cards.find((c) => c.id === last.cardId)) !== null;
    focusGap.current = restoredGap;
    rating.undo(!restoredGap);
  }, [undoStack, gapOf, cards, rating]);

  usePracticeKeys(quickKeys({ flip: face.flip, answer: onAnswer, undo: onUndo, toggleDetail: face.toggleDetail }), session.keysOn && !gap);

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
          {gap ? (
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
          {gap ? (
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
        <QuickDone session={session} round={round} cloze={cloze !== null} undo={undoStack.length > 0 ? onUndo : null} />
      )}
    </>
  );
}

/**
 * Etter Rask runde (og Luketekst): hvor mange kort eleven kunne med en gang, og valgene videre. Ingen av dem nullstiller
 * nivåene: kortene eleven ikke kunne, i en ny runde eller med mestring, eller alle på nytt.
 */
export function QuickDone({
  session,
  round,
  cloze,
  undo,
}: {
  session: Session;
  round: Round;
  cloze: boolean;
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
  return (
    <section className="fc-done is-win" aria-live="polite">
      <h2>
        {known} av {total} kunne du med en gang
      </h2>
      <p className="muted">
        {cloze
          ? 'Riktige luker gir minst nivå 1, men gjør aldri et kort mestret. Kortene uten luke flytter nivåene som i en rask runde.'
          : 'Kortene du kunne, gikk ett nivå opp. De du ikke kunne, er tilbake på nivå 0 og kommer også med i Mestring.'}
      </p>
      {round.answered > 0 && (
        <div className="fc-stats">
          <div>
            <b>{round.answered}</b>
            <span>svar i runden</span>
          </div>
          <div>
            <b>{correctPct(round)} %</b>
            <span>kunne</span>
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
          <>
            <Choice
              primary={!nextChunk}
              label="De du ikke kunne"
              meta={`${plural(misses.length, 'kort', 'kort')} i en ny runde, nivåene beholdes`}
              onClick={() => restart({ ...filter, subset: misses, subsetKind: 'repeat' })}
            />
            <Choice
              label="Øv dem med mestring"
              meta="Grundig: kortene kommer igjen til du kan dem"
              onClick={() => restart({ ...filter, mode: 'mastery', subset: misses, subsetKind: 'repeat', seen: [] })}
            />
          </>
        )}
        <Choice
          primary={!nextChunk && misses.length === 0}
          label={cloze ? 'Ny runde med alle' : 'Ny rask runde med alle'}
          meta={`${plural(total, 'kort', 'kort')}, nivåene beholdes`}
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
