import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Coffee, RotateCcw, Undo2 } from 'lucide-react';
import type { Deck, Flashcard, FlashcardKind, Note } from '@smartnotes/shared';
import type { PracticeOrder, PracticeState } from '../db';
import { plural } from '../lib/format';
import { confirmDialog } from '../lib/ui';
import { recordBest, restoreBest, savePractice, setCardLevels } from './actions';
import { usePracticeState } from './data';
import { bump, burst, centerOf, flash, pop, toast } from './effects';
import { KIND_FILTER_LABEL, KIND_LABEL, KINDS } from './labels';
import {
  BREAK_MS,
  MASTER,
  OWN_CARDS,
  UNDO_LIMIT,
  addActiveTime,
  buildQueue,
  correctPct,
  emptyRound,
  isGrade,
  levelOf,
  masteredCount,
  masteryPct,
  rate,
  reconcileQueue,
  repetitionChoices,
  selectCards,
  type Filter,
  type Grade,
  type Round,
  type Tone,
} from './model';
import { parseBackLine } from './richtext';
import { RichParagraphs, RichText } from './RichText';

interface Props {
  deck: Deck;
  /** Alle kortene i kortstokken (i rekkefølge). */
  cards: Flashcard[];
  /** Notatene i faget (til navn på gruppene). */
  notes: Note[];
  /** false når fanen med øvingen er skjult: tastatursnarveiene er da av, men økta beholdes. */
  active?: boolean;
}

/** Øving med kortene i kortstokken. Økta lagres på enheten, nivåene synkes. */
export function Practice(props: Props) {
  const saved = usePracticeState(props.deck.id);
  if (saved === undefined) {
    return (
      <div className="fc-practice" aria-busy="true" aria-label="Laster">
        <div className="skeleton fc-card-skeleton" />
      </div>
    );
  }
  return <PracticeSession {...props} initial={saved} />;
}

interface UndoEntry {
  round: Round;
  cardId: string;
  level: number;
  /** Beste rekke før vurderingen (angring setter den tilbake, som i originalen). */
  best: number;
}

/**
 * Pauseklokka per kortstokk lever utenfor komponenten, så den teller videre når man bytter fane eller side og kommer
 * tilbake (inaktiv tid over 2 minutter teller uansett ikke).
 */
const breakClocks = new Map<string, { sinceBreak: number; lastAction: number; due: boolean }>();

function breakClock(deckId: string) {
  let c = breakClocks.get(deckId);
  if (!c) breakClocks.set(deckId, (c = { sinceBreak: 0, lastAction: Date.now(), due: false }));
  return c;
}

type ViewFilter = Filter & { order: PracticeOrder };

const GRADES: { grade: Grade; label: string; hint: string }[] = [
  { grade: 1, label: 'Feil', hint: 'Husket ikke' },
  { grade: 2, label: 'Delvis', hint: 'Noe manglet' },
  { grade: 3, label: 'Bra', hint: 'Det viktigste' },
  { grade: 4, label: 'Perfekt', hint: 'Alt, uten å nøle' },
];

/** Fokus i faner og menyer: piltastene og tallene hører til dem, ikke til øvingen. */
function inWidget(el: Element | null): boolean {
  return !!el?.closest('[role="tablist"], [role="menu"], [role="listbox"]');
}

function isEditable(el: Element | null): boolean {
  return (
    el instanceof HTMLInputElement ||
    el instanceof HTMLTextAreaElement ||
    el instanceof HTMLSelectElement ||
    (el instanceof HTMLElement && el.isContentEditable)
  );
}

const sameList = (a: string[], b: string[]) => a.length === b.length && a.every((x, i) => x === b[i]);

function PracticeSession({ deck, cards, notes, initial, active = true }: Props & { initial: PracticeState | null }) {
  // ---------- Nivåer: lokale vurderinger gjelder til databasen har tatt dem igjen ----------
  const [overrides, setOverrides] = useState<Map<string, { level: number; at: string }>>(() => new Map());
  const effCards = useMemo(
    () =>
      cards.map((c) => {
        const o = overrides.get(c.id);
        return o && (c.levelAt === null || c.levelAt <= o.at) && o.level !== c.level ? { ...c, level: o.level } : c;
      }),
    [cards, overrides],
  );
  const setLevels = useCallback((ids: string[], level: number) => {
    const at = new Date().toISOString();
    setOverrides((m) => {
      const next = new Map(m);
      for (const id of ids) next.set(id, { level, at });
      return next;
    });
    void setCardLevels(ids, level, at);
  }, []);

  // ---------- Grupper (notatene kortene er laget fra) ----------
  const noteTitles = useMemo(() => new Map(notes.map((n) => [n.id, n.title || 'Notat uten tittel'])), [notes]);
  const groups = useMemo(() => {
    const present = new Set(cards.map((c) => c.noteId ?? OWN_CARDS));
    const ordered = deck.noteIds.filter((id) => present.has(id));
    for (const c of cards) {
      const g = c.noteId ?? OWN_CARDS;
      if (!ordered.includes(g) && g !== OWN_CARDS) ordered.push(g);
    }
    if (present.has(OWN_CARDS)) ordered.push(OWN_CARDS);
    return ordered;
  }, [cards, deck.noteIds]);
  const groupName = useCallback(
    (g: string) => (g === OWN_CARDS ? 'Egne kort' : (noteTitles.get(g) ?? 'Slettet notat')),
    [noteTitles],
  );

  // ---------- Utvalg og runde ----------
  const [init] = useState(() => {
    // Et lagret notatfilter kan peke på kort som er slettet siden: da starter vi på hele kortstokken.
    const valid = !!initial && (initial.noteId === null || groups.includes(initial.noteId));
    const filter: ViewFilter = {
      noteId: valid ? initial.noteId : null,
      kind: initial?.kind ?? null,
      subset: valid ? initial.subset : null,
      order: initial?.order ?? 'notes',
    };
    const sel = selectCards(cards, filter);
    const round: Round = valid
      ? {
          queue: reconcileQueue(initial.queue, sel),
          grades: initial.grades,
          answered: initial.answered,
          correct: initial.correct,
          streak: initial.streak,
        }
      : emptyRound(buildQueue(sel, filter.order), initial?.streak ?? 0);
    return { filter, round };
  });
  const [filter, setFilter] = useState<ViewFilter>(init.filter);
  const [round, setRound] = useState<Round>(init.round);
  const selection = useMemo(() => selectCards(effCards, filter), [effCards, filter]);

  // Kortene kan endres mens man øver (synk fra en annen enhet, redigering): køen følger etter.
  useEffect(() => {
    const q = reconcileQueue(round.queue, selection);
    if (!sameList(q, round.queue)) setRound((r) => ({ ...r, queue: reconcileQueue(r.queue, selection) }));
  }, [selection, round.queue]);

  useEffect(() => {
    void savePractice({
      deckId: deck.id,
      noteId: filter.noteId,
      kind: filter.kind,
      order: filter.order,
      subset: filter.subset,
      queue: round.queue,
      grades: round.grades,
      answered: round.answered,
      correct: round.correct,
      streak: round.streak,
      updatedAt: 0,
    });
  }, [deck.id, filter, round]);

  const [flipped, setFlipped] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [undoStack, setUndoStack] = useState<UndoEntry[]>([]);
  const [localBest, setLocalBest] = useState<number | null>(null);
  const best = localBest ?? deck.best;
  // Rekorden fra andre enheter (via synk) gjelder når den er høyere.
  useEffect(() => {
    if (localBest !== null && deck.best > localBest) setLocalBest(null);
  }, [deck.best, localBest]);

  // ---------- Tilbakemelding ----------
  const [feedback, setFeedbackState] = useState<{ text: string; tone: Tone | '' }>({ text: '', tone: '' });
  const feedbackTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const setFeedback = useCallback((text: string, tone: Tone | '') => {
    setFeedbackState({ text, tone });
    clearTimeout(feedbackTimer.current);
    if (text) feedbackTimer.current = setTimeout(() => setFeedbackState({ text: '', tone: '' }), 3500);
  }, []);
  useEffect(() => () => clearTimeout(feedbackTimer.current), []);

  // ---------- Pause ----------
  const clock = breakClock(deck.id);
  const [breakDue, setBreakDueState] = useState(clock.due);
  const setBreakDue = useCallback(
    (due: boolean) => {
      clock.due = due;
      setBreakDueState(due);
    },
    [clock],
  );
  const [pausedAt, setPausedAt] = useState<number | null>(null);
  const tick = useCallback(() => {
    const now = Date.now();
    clock.sinceBreak = addActiveTime(clock.sinceBreak, clock.lastAction, now);
    clock.lastAction = now;
    if (clock.sinceBreak >= BREAK_MS) setBreakDue(true);
  }, [clock, setBreakDue]);
  const endPause = () => {
    setPausedAt(null);
    clock.sinceBreak = 0;
    clock.lastAction = Date.now();
    focusNext.current = flipped ? 'answer' : 'question';
  };

  // ---------- Elementer for effektene og fokus ----------
  const rootRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const questionRef = useRef<HTMLParagraphElement>(null);
  const answerRef = useRef<HTMLUListElement>(null);
  const streakRef = useRef<HTMLSpanElement>(null);
  const liveRef = useRef<HTMLDivElement>(null);
  // Etter snu og vurdering flyttes fokus til svaret eller det nye spørsmålet, så skjermlesere leser det opp og fokus
  // ikke blir stående på en knapp som forsvant eller ble deaktivert.
  const focusNext = useRef<'question' | 'answer' | null>(null);
  useEffect(() => {
    const target = focusNext.current;
    if (!target) return;
    focusNext.current = null;
    const activeEl = document.activeElement;
    if (activeEl && activeEl !== document.body && !rootRef.current?.contains(activeEl)) return;
    (target === 'answer' ? answerRef.current : questionRef.current)?.focus({ preventScroll: true });
  });

  const current = round.queue.length ? effCards.find((c) => c.id === round.queue[0]) : undefined;

  const restart = useCallback(
    (next: ViewFilter, resetIds: string[] = []) => {
      // Nivåene som nullstilles, gjelder allerede for den nye køen.
      const reset = new Set(resetIds);
      const sel = selectCards(effCards, next).map((c) => (reset.has(c.id) ? { ...c, level: 0 } : c));
      if (resetIds.length) setLevels(resetIds, 0);
      setFilter(next);
      setRound((r) => emptyRound(buildQueue(sel, next.order), r.streak));
      setFlipped(false);
      setDetailOpen(false);
      setUndoStack([]);
      setFeedback('', '');
    },
    [effCards, setLevels, setFeedback],
  );

  // ---------- Handlinger ----------
  const flip = useCallback(() => {
    if (!current) return;
    tick();
    if (flipped) setDetailOpen(false);
    focusNext.current = flipped ? 'question' : 'answer';
    setFlipped(!flipped);
  }, [current, flipped, tick]);

  const toggleDetail = useCallback(() => {
    if (!current?.detail) return;
    tick();
    if (!detailOpen && !flipped) {
      setFlipped(true);
      focusNext.current = 'answer';
    }
    setDetailOpen(!detailOpen);
  }, [current, detailOpen, flipped, tick]);

  const onRate = useCallback(
    (grade: Grade) => {
      if (!flipped || !current) return;
      tick();
      const levels = new Map(effCards.map((c) => [c.id, levelOf(c)]));
      const out = rate(round, {
        grade,
        levels,
        best,
        groupOf: (id) => {
          const c = effCards.find((x) => x.id === id);
          return c ? (c.noteId ?? OWN_CARDS) : null;
        },
        groupCards: (g) => effCards.filter((c) => (c.noteId ?? OWN_CARDS) === g).map((c) => c.id),
        groupName,
      });
      if (!out) return;
      setUndoStack((s) => [...s.slice(-(UNDO_LIMIT - 1)), { round, cardId: out.cardId, level: levels.get(out.cardId) ?? 0, best }]);
      setLevels([out.cardId], out.level);
      if (out.best > best) {
        setLocalBest(out.best);
        void recordBest(deck.id, out.best);
      }
      setRound(out.round);
      setFlipped(false);
      setDetailOpen(false);
      focusNext.current = 'question';

      const center = centerOf(cardRef.current);
      flash(cardRef.current, out.fx.flash);
      pop(out.fx.pop.text, out.fx.pop.tone, out.fx.pop.word, center);
      if (out.fx.bump) bump(streakRef.current);
      burst(center, out.fx.burst);
      if (out.fx.toast) toast(out.fx.toast.text, out.fx.toast.tone, liveRef.current);
      setFeedback(out.fx.feedback.text, out.fx.feedback.tone);
    },
    [flipped, current, tick, effCards, round, best, groupName, setLevels, deck.id, setFeedback],
  );

  const onUndo = useCallback(() => {
    const last = undoStack[undoStack.length - 1];
    if (!last) return;
    setUndoStack((s) => s.slice(0, -1));
    setRound(last.round);
    setLevels([last.cardId], last.level);
    if (last.best < best) {
      setLocalBest(last.best);
      void restoreBest(deck.id, last.best);
    }
    setFlipped(true);
    setDetailOpen(false);
    focusNext.current = 'answer';
    setFeedback('Angret.', '');
  }, [undoStack, setLevels, setFeedback, best, deck.id]);

  const onReset = async () => {
    const ok = await confirmDialog({
      title: 'Nullstille fremgangen?',
      body: `Mestringen for ${selection.length === 1 ? 'kortet' : `de ${selection.length} kortene`} i dette utvalget settes tilbake til null, også på de andre enhetene dine.`,
      confirmLabel: 'Nullstill',
      danger: true,
    });
    if (ok) restart({ ...filter }, selection.map((c) => c.id));
  };

  // ---------- Tastatur ----------
  const handlers = useRef({ flip, toggleDetail, onRate, onUndo });
  handlers.current = { flip, toggleDetail, onRate, onUndo };
  const paused = pausedAt !== null;
  useEffect(() => {
    if (paused || !active) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey) return;
      if (document.querySelector('dialog[open]')) return;
      const focused = document.activeElement;
      if (isEditable(focused) || inWidget(focused)) return;
      const h = handlers.current;
      if (e.key === ' ' || e.key === 'Enter') {
        if (focused instanceof HTMLButtonElement || focused instanceof HTMLAnchorElement || focused?.tagName === 'SUMMARY') return;
        e.preventDefault();
        h.flip();
      } else if (isGrade(Number(e.key))) h.onRate(Number(e.key) as Grade);
      else if (e.key === 'ArrowLeft') h.onRate(1);
      else if (e.key === 'ArrowRight') h.onRate(3);
      else if (e.key === 'z' || e.key === 'Z') h.onUndo();
      else if (e.key === 'd' || e.key === 'D') h.toggleDetail();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [paused, active]);

  // Et notatfilter eller repetisjonsutvalg uten kort igjen (slettet her eller på en annen enhet): tilbake til alle kort.
  useEffect(() => {
    const noteGone = filter.noteId !== null && !groups.includes(filter.noteId);
    const subsetGone = filter.subset !== null && selection.length === 0;
    if (noteGone || subsetGone) restart({ ...filter, noteId: noteGone ? null : filter.noteId, subset: null });
  }, [groups, filter, selection.length, restart]);

  // ---------- Visning ----------
  const mastered = masteredCount(selection);
  const pct = masteryPct(selection);
  const groupPct = (g: string | null) => masteryPct(selectCards(effCards, { noteId: g, kind: filter.kind, subset: null }));
  const changeFilter = (patch: Partial<ViewFilter>) => restart({ ...filter, ...patch, subset: null });

  return (
    <div ref={rootRef} className="fc-practice">
      <div className="fc-controls">
        {(groups.length > 1 || filter.noteId !== null) && (
          <label className="field">
            <span className="field-label">Notat</span>
            <select value={filter.noteId ?? ''} onChange={(e) => changeFilter({ noteId: e.currentTarget.value || null })}>
              <option value="">Alle notater ({groupPct(null)} %)</option>
              {groups.map((g) => (
                <option key={g} value={g}>
                  {groupName(g)} ({groupPct(g)} %)
                </option>
              ))}
            </select>
          </label>
        )}
        <label className="field">
          <span className="field-label">Korttype</span>
          <select
            value={filter.kind ?? ''}
            onChange={(e) => changeFilter({ kind: (e.currentTarget.value || null) as FlashcardKind | null })}
          >
            <option value="">Alle typer</option>
            {KINDS.map((k) => (
              <option key={k} value={k}>
                {KIND_FILTER_LABEL[k]}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span className="field-label">Rekkefølge</span>
          <select value={filter.order} onChange={(e) => changeFilter({ order: e.currentTarget.value as PracticeOrder })}>
            <option value="notes">Som i notatene</option>
            <option value="shuffle">Blandet</option>
          </select>
        </label>
      </div>

      {breakDue && !paused && (
        <div className="fc-breakbar" role="status">
          <span>Du har øvd i 30 minutter. En kort pause hjelper hukommelsen.</span>
          <span className="fc-breakbar-actions">
            <button
              type="button"
              className="btn btn-sm btn-primary"
              onClick={() => {
                setBreakDue(false);
                setPausedAt(Date.now());
              }}
            >
              <Coffee size={16} aria-hidden /> Ta pause
            </button>
            <button
              type="button"
              className="btn btn-sm"
              onClick={() => {
                setBreakDue(false);
                clock.sinceBreak = 0;
              }}
            >
              Fortsett
            </button>
          </span>
        </div>
      )}

      {filter.subset && (
        <div className="fc-repeat-note">
          <span>Repetisjon av {plural(filter.subset.length, 'kort', 'kort')}</span>
          <button type="button" className="link-btn" onClick={() => restart({ ...filter, subset: null })}>
            Tilbake til hele utvalget
          </button>
        </div>
      )}

      <div className="fc-status">
        <span>{selection.length > 0 && `${mastered} av ${selection.length} mestret`}</span>
        <span className="fc-pills">
          <span ref={streakRef} className={`fc-pill${round.streak >= 5 ? ' is-hot' : ''}`}>
            Rekke {round.streak}
          </span>
          <span className="fc-pill is-best">Beste {best}</span>
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
          <div
            ref={cardRef}
            className={`fc-card${flipped ? ' is-flipped' : ''}`}
            onClick={(e) => {
              if ((e.target as Element).closest('.fc-detail-btn, .fc-detail, .fc-flip-hint')) return;
              flip();
            }}
          >
            <div className="fc-meta">
              <span className="fc-source">{groupName(current.noteId ?? OWN_CARDS)}</span>
              <span className="fc-meta-right">
                <span className="fc-dots" role="img" aria-label={`Nivå ${levelOf(current)} av ${MASTER}`}>
                  {Array.from({ length: MASTER }, (_, i) => (
                    <i key={i} className={i < levelOf(current) ? 'is-on' : undefined} />
                  ))}
                </span>
                <span className={`fc-tag fc-tag-${current.kind}`}>{KIND_LABEL[current.kind]}</span>
              </span>
            </div>
            <p ref={questionRef} className="fc-question" tabIndex={-1}>
              <RichText text={current.front} />
            </p>
            {flipped ? (
              <ul ref={answerRef} className="fc-answer" tabIndex={-1} aria-label="Svar">
                {current.back.map((line, i) => {
                  const l = parseBackLine(line);
                  return (
                    <li key={i} className={l.label ? 'is-label' : undefined}>
                      <RichText text={l.text} />
                    </li>
                  );
                })}
              </ul>
            ) : (
              <button type="button" className="fc-flip-hint" onClick={flip}>
                Trykk for å snu kortet
              </button>
            )}
            {current.detail && (
              <button type="button" className="fc-detail-btn" aria-expanded={detailOpen} onClick={toggleDetail}>
                {detailOpen ? 'Skjul detaljert forklaring' : 'Detaljert forklaring'}
              </button>
            )}
            {detailOpen && current.detail && (
              <div className="fc-detail">
                <RichParagraphs text={current.detail} />
              </div>
            )}
          </div>

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
            <button type="button" className="link-btn" onClick={() => void onReset()}>
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
        <Done
          selection={selection}
          round={round}
          best={best}
          filter={filter}
          groups={groups}
          groupName={groupName}
          groupDone={(g) => selectCards(effCards, { noteId: g, kind: filter.kind, subset: null }).every((c) => levelOf(c) >= MASTER)}
          onRepeat={(ids) => restart({ ...filter, subset: ids }, ids)}
          onRepeatAll={() => {
            const all = selectCards(effCards, { ...filter, subset: null });
            restart({ ...filter, subset: null }, all.map((c) => c.id));
          }}
          onNext={(g) => restart({ ...filter, noteId: g, subset: null })}
          undo={undoStack.length > 0 ? onUndo : null}
        />
      )}

      <div ref={liveRef} className="sr-only" aria-live="polite" />
      {paused && <PauseOverlay since={pausedAt} onResume={endPause} />}
    </div>
  );
}

function Done({
  selection,
  round,
  best,
  filter,
  groups,
  groupName,
  groupDone,
  onRepeat,
  onRepeatAll,
  onNext,
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
  onNext: (g: string) => void;
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
  return (
    <section className="fc-done is-win" aria-live="polite">
      <h2>Alt i dette utvalget er mestret</h2>
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
      <h3 className="fc-repeat-title">Repeter</h3>
      <div className="fc-repeat">
        {choices.misses.length > 0 && (
          <button type="button" className="fc-repeat-btn is-primary" onClick={() => onRepeat(choices.misses)}>
            <span className="fc-repeat-label">De du ikke kunne</span>
            <span className="fc-repeat-meta">
              {plural(choices.misses.length, 'kort', 'kort')} du svarte «Feil» på minst én gang
            </span>
          </button>
        )}
        {choices.unsure.length > choices.misses.length && (
          <button
            type="button"
            className={`fc-repeat-btn${choices.misses.length === 0 ? ' is-primary' : ''}`}
            onClick={() => onRepeat(choices.unsure)}
          >
            <span className="fc-repeat-label">{choices.misses.length > 0 ? 'Også de du var usikker på' : 'De du var usikker på'}</span>
            <span className="fc-repeat-meta">{plural(choices.unsure.length, 'kort', 'kort')} med «Feil» eller «Delvis»</span>
          </button>
        )}
        <button type="button" className="fc-repeat-btn" onClick={onRepeatAll}>
          <span className="fc-repeat-label">{filter.subset ? 'Hele utvalget på nytt' : 'Alle på nytt'}</span>
          <span className="fc-repeat-meta">
            {allCount !== null ? `${plural(allCount, 'kort', 'kort')} fra nivå 0` : 'Alle kortene i utvalget fra nivå 0'}
          </span>
        </button>
        {next && (
          <button type="button" className="fc-repeat-btn" onClick={() => onNext(next)}>
            <span className="fc-repeat-label">Gå videre til {groupName(next)}</span>
            <span className="fc-repeat-meta">Neste notat som ikke er mestret</span>
          </button>
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

function PauseOverlay({ since, onResume }: { since: number | null; onResume: () => void }) {
  const [now, setNow] = useState(() => Date.now());
  const ref = useRef<HTMLDialogElement>(null);
  const resume = useRef(onResume);
  resume.current = onResume;
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  // Ekte modal dialog: fokus holdes inne, bakgrunnen kan ikke brukes, og Esc betyr «Fortsett å øve».
  useLayoutEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (!dialog.open) dialog.showModal();
    const onCancel = (e: Event) => {
      e.preventDefault();
      resume.current();
    };
    dialog.addEventListener('cancel', onCancel);
    return () => {
      dialog.removeEventListener('cancel', onCancel);
      if (dialog.open) dialog.close();
    };
  }, []);
  const s = Math.max(0, Math.floor((now - (since ?? now)) / 1000));
  return (
    <dialog ref={ref} className="fc-pause" aria-labelledby="fc-pause-title">
      <h2 id="fc-pause-title">Pause</h2>
      <div className="fc-pause-clock" aria-hidden>
        {Math.floor(s / 60)}:{String(s % 60).padStart(2, '0')}
      </div>
      <p>Se bort fra skjermen, strekk på deg og drikk litt vann. Fremgangen din er lagret.</p>
      <button type="button" className="btn btn-primary btn-lg" onClick={onResume} autoFocus>
        Fortsett å øve
      </button>
    </dialog>
  );
}
