import { useCallback, useRef, type Dispatch, type SetStateAction } from 'react';
import { RotateCcw, Undo2 } from 'lucide-react';
import type { Flashcard } from '@smartnotes/shared';
import { plural } from '../lib/format';
import { CardFace } from './CardFace';
import { Choice } from './Choice';
import { masteryKeys, usePracticeKeys } from './keys';
import {
  MASTER,
  OWN_CARDS,
  correctPct,
  levelOf,
  masteredCount,
  masteryPct,
  rate,
  repetitionChoices,
  selectCards,
  type Grade,
  type Round,
} from './model';
import type { NextChunk, Session, ViewFilter } from './session';
import { useRating } from './useRating';

const GRADES: { grade: Grade; label: string; hint: string }[] = [
  { grade: 1, label: 'Feil', hint: 'Husket ikke' },
  { grade: 2, label: 'Delvis', hint: 'Noe manglet' },
  { grade: 3, label: 'Bra', hint: 'Det viktigste' },
  { grade: 4, label: 'Perfekt', hint: 'Alt, uten å nøle' },
];

/**
 * Mestring, standardformen: eleven snur kortet og vurderer svaret 1–4, og kortet kommer igjen til det er mestret
 * (reglene står i model.ts). Viser mestringen i utvalget, kortet, knappene og `MasteryDone` når køen er tom.
 */
export function MasteryRound({
  session,
  round,
  setRound,
}: {
  session: Session;
  round: Round;
  setRound: Dispatch<SetStateAction<Round>>;
}) {
  const { cards, selection, current, filter, groups, groupName, best, restart, face, feedback, tick } = session;
  const { undoStack } = session;
  const { flipped } = face;
  const streakRef = useRef<HTMLSpanElement>(null);
  const rating = useRating(session, round, setRound, streakRef);

  const onRate = useCallback(
    (grade: Grade) => {
      if (!flipped || !current) return;
      tick();
      rating.apply(rate(round, { ...rating.context(), grade }));
    },
    [flipped, current, tick, round, rating],
  );

  const onUndo = useCallback(() => rating.undo(), [rating]);

  usePracticeKeys(masteryKeys({ flip: face.flip, rate: onRate, undo: onUndo, toggleDetail: face.toggleDetail }), session.keysOn);

  const mastered = masteredCount(selection);
  const pct = masteryPct(selection);

  return (
    <>
      <div className="fc-status">
        <span>{selection.length > 0 && `${mastered} av ${selection.length} mestret`}</span>
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
        aria-label="Mestring i utvalget"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={pct}
      >
        <div style={{ width: `${pct}%` }} />
      </div>

      {current ? (
        <>
          <CardFace card={current} source={groupName(current.noteId ?? OWN_CARDS)} face={face} />

          <div className="fc-rate" role="group" aria-label="Hvor godt svarte du?">
            {GRADES.map((g) => (
              <button key={g.grade} type="button" className={`fc-g${g.grade}`} disabled={!flipped} onClick={() => onRate(g.grade)}>
                {g.label}
                <small>{g.hint}</small>
              </button>
            ))}
          </div>
          <div className={`fc-feedback${feedback.tone ? ` is-${feedback.tone}` : ''}`} aria-live="polite">
            {feedback.text}
          </div>
          <div className="fc-sub">
            <button type="button" className="link-btn" disabled={!undoStack.length} onClick={onUndo}>
              <Undo2 size={15} aria-hidden /> Angre forrige
            </button>
            <button type="button" className="link-btn" onClick={() => void session.resetProgress()}>
              <RotateCcw size={15} aria-hidden /> Nullstill fremgang i dette utvalget
            </button>
          </div>
          <p className="fc-keys">
            <span>
              <kbd>Mellomrom</kbd> snu
            </span>
            <span>
              <kbd>1</kbd>–<kbd>4</kbd> vurder svaret
            </span>
            <span>
              <kbd>D</kbd> detaljert forklaring
            </span>
            <span>
              <kbd>Z</kbd> angre
            </span>
          </p>
        </>
      ) : (
        <MasteryDone
          selection={selection}
          round={round}
          best={best.value}
          filter={filter}
          groups={groups}
          groupName={groupName}
          groupDone={(g) => selectCards(cards, { noteId: g, kind: filter.kind, subset: null }).every((c) => levelOf(c) >= MASTER)}
          onRepeat={(ids) => restart({ ...filter, subset: ids, subsetKind: 'repeat' }, ids)}
          onRepeatAll={() => {
            const all = selectCards(cards, { ...filter, subset: null });
            restart({ ...filter, subset: null }, all.map((c) => c.id));
          }}
          onQuick={() => restart({ ...filter, mode: 'quick', seen: filter.subsetKind === 'chunk' && filter.subset ? filter.subset : [] })}
          onNext={(g) => restart({ ...filter, noteId: g, subset: null })}
          nextChunk={session.nextChunk}
          undo={undoStack.length > 0 ? onUndo : null}
        />
      )}
    </>
  );
}

/**
 * Etter runden i Mestring: alt i utvalget er mestret. Repeter det eleven ikke kunne, alt (fra nivå 0, eller i en rask
 * runde uten nullstilling), ta neste korte økt, eller gå til neste notat.
 */
export function MasteryDone({
  selection,
  round,
  best,
  filter,
  groups,
  groupName,
  groupDone,
  onRepeat,
  onRepeatAll,
  onQuick,
  onNext,
  nextChunk,
  undo,
}: {
  selection: Flashcard[];
  round: Round;
  best: number;
  filter: ViewFilter;
  groups: string[];
  groupName: (g: string) => string;
  groupDone: (g: string) => boolean;
  onRepeat: (ids: string[]) => void;
  onRepeatAll: () => void;
  /**
   * «Rask runde med alle» (eller med de samme kortene i en repetisjon eller kort økt), uten å nullstille nivåene. Med en
   * lengde valgt og ingen økt (alt var mestret) plukker den rask runden i økter på så mange kort.
   */
  onQuick: () => void;
  onNext: (g: string) => void;
  nextChunk: NextChunk | null;
  undo: (() => void) | null;
}) {
  if (selection.length === 0) {
    return (
      <section className="fc-done" aria-live="polite">
        <h2>Ingen kort med dette utvalget</h2>
        <p className="muted">Velg et annet notat eller en annen korttype.</p>
      </section>
    );
  }
  const choices = repetitionChoices(selection, round.grades);
  const next = filter.noteId !== null ? groups.find((g) => g !== filter.noteId && !groupDone(g)) : undefined;
  const allCount = filter.subset ? null : choices.all.length;
  const quickMeta =
    !filter.subset && filter.length !== null && choices.all.length > filter.length
      ? `${plural(filter.length, 'kort', 'kort')} om gangen, uten å nullstille`
      : `${plural(choices.all.length, 'kort', 'kort')}, uten å nullstille`;
  return (
    <section className="fc-done is-win" aria-live="polite">
      <h2>
        {filter.subsetKind !== 'chunk'
          ? 'Alt i dette utvalget er mestret'
          : selection.length === 1
            ? 'Kortet i økta er mestret'
            : `Alle de ${selection.length} kortene i økta er mestret`}
      </h2>
      <p className="muted">
        Hvert kort er besvart riktig flere ganger med andre kort imellom. Velg hva du vil repetere, eller gå videre.
      </p>
      {round.answered > 0 && (
        <div className="fc-stats">
          <div>
            <b>{round.answered}</b>
            <span>svar i økta</span>
          </div>
          <div>
            <b>{correctPct(round)} %</b>
            <span>delvis eller bedre</span>
          </div>
          <div>
            <b>{best}</b>
            <span>beste rekke</span>
          </div>
        </div>
      )}
      <h3 className="fc-repeat-title">{nextChunk ? 'Gå videre' : 'Repeter'}</h3>
      <div className="fc-repeat">
        {nextChunk && (
          <Choice
            primary
            label={`Neste ${plural(nextChunk.count, 'kort', 'kort')}`}
            meta="De neste kortene som ikke er mestret"
            onClick={nextChunk.start}
          />
        )}
        {choices.misses.length > 0 && (
          <Choice
            primary={!nextChunk}
            label="De du ikke kunne"
            meta={`${plural(choices.misses.length, 'kort', 'kort')} du svarte «Feil» på minst én gang`}
            onClick={() => onRepeat(choices.misses)}
          />
        )}
        {choices.unsure.length > choices.misses.length && (
          <Choice
            primary={!nextChunk && choices.misses.length === 0}
            label={choices.misses.length > 0 ? 'Også de du var usikker på' : 'De du var usikker på'}
            meta={`${plural(choices.unsure.length, 'kort', 'kort')} med «Feil» eller «Delvis»`}
            onClick={() => onRepeat(choices.unsure)}
          />
        )}
        <Choice
          primary={!nextChunk && choices.unsure.length === 0}
          label={filter.subset ? 'Rask runde med de samme kortene' : 'Rask runde med alle'}
          meta={quickMeta}
          onClick={onQuick}
        />
        <Choice
          label={filter.subset ? 'Hele utvalget på nytt' : 'Alle på nytt'}
          meta={allCount !== null ? `${plural(allCount, 'kort', 'kort')} fra nivå 0` : 'Alle kortene i utvalget fra nivå 0'}
          onClick={onRepeatAll}
        />
        {next && (
          <Choice label={`Gå videre til ${groupName(next)}`} meta="Neste notat som ikke er mestret" onClick={() => onNext(next)} />
        )}
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
