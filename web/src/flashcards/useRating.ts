import { useCallback, useMemo, type Dispatch, type RefObject, type SetStateAction } from 'react';
import { playEffects } from './effects';
import { OWN_CARDS, UNDO_LIMIT, levelOf, type QuickContext, type RateOutcome, type Round } from './model';
import type { Session } from './session';

/** Vurderingene i formene som flytter nivåene (Mestring, Rask runde og Luketekst). */
export interface Rating {
  /** Nivåene og gruppene akkurat nå, til `rate`, `rateQuick` og `rateCloze`. */
  context: () => QuickContext;
  /**
   * Bruker utfallet av en vurdering: angrestakken, nivået (også på de andre enhetene, når `out.write`), rekorden,
   * runden, effektene og linja under knappene. Neste spørsmål vises; med `focus` false flyttes ikke fokus dit (Luketekst flytter det til
   * feltet selv).
   */
  apply: (out: RateOutcome | null, focus?: boolean) => void;
  /**
   * Angrer forrige vurdering: runden, nivået og rekorden settes tilbake, og kortet vises med svaret. Med `showAnswer`
   * false vises spørsmålet, uten å flytte fokus (et kort med luke i Luketekst).
   */
  undo: (showAnswer?: boolean) => void;
}

export function useRating(
  session: Session,
  round: Round,
  setRound: Dispatch<SetStateAction<Round>>,
  streakRef: RefObject<HTMLElement | null>,
): Rating {
  const { cards, groupName, setLevels, best, face, undoStack, setUndoStack, liveRef } = session;
  const { show, cardRef } = face;
  const setFeedback = session.feedback.set;

  const context = useCallback(
    (): QuickContext => ({
      levels: new Map(cards.map((c) => [c.id, levelOf(c)])),
      best: best.value,
      groupOf: (id) => {
        const c = cards.find((x) => x.id === id);
        return c ? (c.noteId ?? OWN_CARDS) : null;
      },
      groupCards: (g) => cards.filter((c) => (c.noteId ?? OWN_CARDS) === g).map((c) => c.id),
      groupName,
    }),
    [cards, best.value, groupName],
  );

  const apply = useCallback(
    (out: RateOutcome | null, focus = true) => {
      if (!out) return;
      const before = levelOf(cards.find((c) => c.id === out.cardId));
      setUndoStack((s) => [
        ...s.slice(-(UNDO_LIMIT - 1)),
        { round, cardId: out.cardId, level: before, best: best.value, wrote: out.write },
      ]);
      if (out.write) setLevels([out.cardId], out.level);
      if (out.best > best.value) best.record(out.best);
      setRound(out.round);
      show('question', focus);
      playEffects(out.fx, { card: cardRef.current, streak: streakRef.current, live: liveRef.current });
      setFeedback(out.fx.feedback.text, out.fx.feedback.tone);
    },
    [cards, round, best, setUndoStack, setLevels, setRound, show, cardRef, streakRef, liveRef, setFeedback],
  );

  const undo = useCallback(
    (showAnswer = true) => {
      const last = undoStack[undoStack.length - 1];
      if (!last) return;
      setUndoStack((s) => s.slice(0, -1));
      setRound(last.round);
      if (last.wrote !== false) setLevels([last.cardId], last.level);
      if (last.best < best.value) best.restore(last.best);
      if (showAnswer) show('answer');
      else show('question', false);
      setFeedback('Angret.', '');
    },
    [undoStack, setUndoStack, setRound, setLevels, best, show, setFeedback],
  );

  return useMemo(() => ({ context, apply, undo }), [context, apply, undo]);
}
