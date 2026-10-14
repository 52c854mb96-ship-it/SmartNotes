import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Deck, Flashcard, FlashcardKind, Note } from '@smartnotes/shared';
import type { PracticeLength, PracticeMode, PracticeOrder, PracticePass, PracticeState } from '../db';
import { plural } from '../lib/format';
import { confirmDialog } from '../lib/ui';
import { recordBest, restoreBest, savePractice, setCardLevels } from './actions';
import { useCardFace } from './CardFace';
import { ClassicPass } from './ClassicPass';
import { usePracticeState } from './data';
import { KIND_FILTER_LABEL, KINDS } from './labels';
import { MasteryRound } from './MasteryRound';
import { ModePicker } from './ModePicker';
import {
  OWN_CARDS,
  buildPass,
  buildQueue,
  buildQuickQueue,
  emptyRound,
  masteryPct,
  normalizePracticeState,
  pickChunk,
  reconcilePass,
  reconcileQueue,
  reconcileQuickQueue,
  selectCards,
  type Round,
} from './model';
import { BreakBar, PauseOverlay } from './Pause';
import { QuickRound } from './QuickRound';
import {
  useFeedback,
  usesLength,
  type BestStreak,
  type NextChunk,
  type Session,
  type UndoEntry,
  type ViewFilter,
} from './session';
import { useBreakClock } from './useBreakClock';

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

const sameList = (a: string[], b: string[]) => a.length === b.length && a.every((x, i) => x === b[i]);
const samePass = (a: PracticePass, b: PracticePass) => a.index === b.index && sameList(a.ids, b.ids) && sameList(a.marked, b.marked);

/** En lagret kø mot dagens kort: Mestring tar bare kort som ikke er mestret, Rask runde og Luketekst tar alle. */
function reconcileFor(mode: PracticeMode, queue: string[], selection: Flashcard[], done: string[] | undefined): string[] {
  return mode === 'mastery' ? reconcileQueue(queue, selection) : reconcileQuickQueue(queue, selection, done);
}

/**
 * En ny runde med utvalget `f`. Er en lengde valgt og ikke noe utvalg gitt, plukkes den neste korte økta (`pickChunk`,
 * lagt i `subset`). Klassisk får en ny gjennomgang, de andre formene en ny kø.
 */
function begin(cards: Flashcard[], f: ViewFilter): { filter: ViewFilter; queue: string[]; pass: PracticePass | null } {
  let filter: ViewFilter = f.subset ? f : { ...f, subsetKind: undefined };
  if (!filter.subset && filter.length !== null && usesLength(filter.mode)) {
    const chunk = pickChunk(selectCards(cards, filter), filter.order, filter.length, filter.mode, filter.seen);
    filter = chunk.ids.length ? { ...filter, subset: chunk.ids, subsetKind: 'chunk', seen: chunk.seen } : { ...filter, seen: chunk.seen };
  }
  const sel = selectCards(cards, filter);
  if (filter.mode === 'classic') return { filter, queue: [], pass: buildPass(sel, filter.order) };
  return { filter, queue: filter.mode === 'mastery' ? buildQueue(sel, filter.order) : buildQuickQueue(sel, filter.order), pass: null };
}

/**
 * Det som er felles for formene: nivåene, utvalget, formen og filtrene, runden som lagres, rekorden, kortet som vises,
 * angring, tilbakemelding og pausen. Formen (`MasteryRound`, `QuickRound` eller `ClassicPass`) viser kortet og står for
 * vurderingen.
 */
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
    // Eldre økter (uten form) leses som Mestring. Et lagret notatfilter kan peke på kort som er slettet siden: da
    // starter vi på hele kortstokken.
    const saved = initial ? normalizePracticeState(initial) : null;
    const valid = !!saved && (saved.noteId === null || groups.includes(saved.noteId));
    const filter: ViewFilter = {
      noteId: valid ? saved.noteId : null,
      kind: saved?.kind ?? null,
      subset: valid ? saved.subset : null,
      order: saved?.order ?? 'notes',
      mode: saved?.mode ?? 'mastery',
      length: saved?.length ?? null,
      seen: valid ? saved.seen : [],
    };
    if (filter.subset) filter.subsetKind = saved?.subsetKind ?? 'repeat';
    const seed = saved?.clozeSeed ?? 0;
    // En økt uten noe gjort (f.eks. etter «Nullstill fremgang» med en lengde valgt) starter som en ny runde.
    const fresh =
      !valid ||
      (filter.mode === 'classic'
        ? !saved.pass
        : filter.length !== null && !filter.subset && saved.queue.length === 0 && saved.answered === 0);
    if (fresh) {
      const start = begin(cards, filter);
      return { filter: start.filter, round: emptyRound(start.queue, saved?.streak ?? 0), pass: start.pass, seed };
    }
    const sel = selectCards(cards, filter);
    const round: Round = {
      queue: filter.mode === 'classic' ? [] : reconcileFor(filter.mode, saved.queue, sel, saved.done),
      grades: saved.grades,
      answered: saved.answered,
      correct: saved.correct,
      streak: saved.streak,
    };
    if (filter.mode === 'quick' || filter.mode === 'cloze') round.done = saved.done;
    const pass = filter.mode === 'classic' && saved.pass ? reconcilePass(saved.pass, sel) : null;
    return { filter, round, pass, seed };
  });
  const [filter, setFilter] = useState<ViewFilter>(init.filter);
  const [round, setRound] = useState<Round>(init.round);
  /** Klassisk: gjennomgangen. */
  const [pass, setPass] = useState<PracticePass | null>(init.pass);
  /** Luketekst: rundenummeret som velger luka i hvert kort. */
  const [clozeSeed, setClozeSeed] = useState(init.seed);
  const selection = useMemo(() => selectCards(effCards, filter), [effCards, filter]);

  // Kortene kan endres mens man øver (synk fra en annen enhet, redigering): køen eller gjennomgangen følger etter.
  useEffect(() => {
    if (filter.mode === 'classic') {
      if (!pass) setPass(buildPass(selection, filter.order));
      else if (!samePass(reconcilePass(pass, selection), pass)) setPass((p) => (p ? reconcilePass(p, selection) : p));
      return;
    }
    const q = reconcileFor(filter.mode, round.queue, selection, round.done);
    if (!sameList(q, round.queue)) setRound((r) => ({ ...r, queue: reconcileFor(filter.mode, r.queue, selection, r.done) }));
  }, [selection, round.queue, round.done, filter.mode, filter.order, pass]);

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
      mode: filter.mode,
      length: filter.length,
      ...(filter.subset ? { subsetKind: filter.subsetKind ?? 'repeat' } : {}),
      seen: filter.seen,
      ...(round.done ? { done: round.done } : {}),
      ...(pass ? { pass } : {}),
      clozeSeed,
    });
  }, [deck.id, filter, round, pass, clozeSeed]);

  const [undoStack, setUndoStack] = useState<UndoEntry[]>([]);
  const [localBest, setLocalBest] = useState<number | null>(null);
  const bestValue = localBest ?? deck.best;
  // Rekorden fra andre enheter (via synk) gjelder når den er høyere.
  useEffect(() => {
    if (localBest !== null && deck.best > localBest) setLocalBest(null);
  }, [deck.best, localBest]);
  const best = useMemo<BestStreak>(
    () => ({
      value: bestValue,
      record: (n) => {
        setLocalBest(n);
        void recordBest(deck.id, n);
      },
      restore: (n) => {
        setLocalBest(n);
        void restoreBest(deck.id, n);
      },
    }),
    [bestValue, deck.id],
  );

  const feedback = useFeedback();
  const setFeedback = feedback.set;
  const clock = useBreakClock(deck.id);

  // ---------- Kortet som vises ----------
  const rootRef = useRef<HTMLDivElement>(null);
  const liveRef = useRef<HTMLDivElement>(null);
  const currentId = filter.mode === 'classic' ? pass?.ids[pass.index] : round.queue[0];
  const current = currentId === undefined ? undefined : effCards.find((c) => c.id === currentId);
  const face = useCardFace(current, clock.tick, rootRef);
  const showFace = face.show;

  const restart = useCallback(
    (next: ViewFilter, resetIds: string[] = []) => {
      // Nivåene som nullstilles, gjelder allerede for den nye runden.
      const reset = new Set(resetIds);
      const all = effCards.map((c) => (reset.has(c.id) ? { ...c, level: 0 } : c));
      if (resetIds.length) setLevels(resetIds, 0);
      const start = begin(all, next);
      setFilter(start.filter);
      setRound((r) => emptyRound(start.queue, r.streak));
      setPass(start.pass);
      if (start.filter.mode === 'cloze') setClozeSeed((n) => n + 1);
      showFace('question', false);
      setUndoStack([]);
      setFeedback('', '');
    },
    [effCards, setLevels, showFace, setFeedback],
  );

  const resetProgress = async () => {
    const ok = await confirmDialog({
      title: 'Nullstille fremgangen?',
      body: `Mestringen for ${selection.length === 1 ? 'kortet' : `de ${selection.length} kortene`} i dette utvalget settes tilbake til null, også på de andre enhetene dine.`,
      confirmLabel: 'Nullstill',
      danger: true,
    });
    if (ok) restart({ ...filter }, selection.map((c) => c.id));
  };

  const endPause = () => {
    clock.endPause();
    face.refocus();
  };

  // Et notatfilter eller repetisjonsutvalg uten kort igjen (slettet her eller på en annen enhet): tilbake til alle kort.
  useEffect(() => {
    const noteGone = filter.noteId !== null && !groups.includes(filter.noteId);
    const subsetGone = filter.subset !== null && selection.length === 0;
    if (noteGone || subsetGone) restart({ ...filter, noteId: noteGone ? null : filter.noteId, subset: null });
  }, [groups, filter, selection.length, restart]);

  // ---------- Visning ----------
  const groupPct = (g: string | null) => masteryPct(selectCards(effCards, { noteId: g, kind: filter.kind, subset: null }));
  // Et nytt filter, en ny form eller en ny lengde starter en ny runde (og en ny omgang med korte økter).
  const changeFilter = (patch: Partial<ViewFilter>) => restart({ ...filter, ...patch, subset: null, seen: [] });
  const changeMode = (mode: PracticeMode, fromPointer: boolean) => {
    // Etter et klikk skal fokus ikke bli stående i velgeren, der piltastene og mellomrom hører til velgeren og ikke til
    // kortet: fokus går til spørsmålet (eller ingen steder, når runden ikke har noe kort).
    if (fromPointer) (document.activeElement as HTMLElement | null)?.blur();
    if (mode === filter.mode) return;
    changeFilter({ mode });
    if (fromPointer) showFace('question', true);
  };
  const nextChunk = useMemo<NextChunk | null>(() => {
    if (filter.length === null || !usesLength(filter.mode)) return null;
    const all = selectCards(effCards, { ...filter, subset: null });
    const count = pickChunk(all, 'notes', filter.length, filter.mode, filter.seen).ids.length;
    return count ? { count, start: () => restart({ ...filter, subset: null }) } : null;
  }, [effCards, filter, restart]);
  const session: Session = {
    cards: effCards,
    selection,
    current,
    filter,
    groups,
    groupName,
    setLevels,
    best,
    restart,
    resetProgress,
    nextChunk,
    face,
    undoStack,
    setUndoStack,
    feedback,
    tick: clock.tick,
    keysOn: !clock.paused && active,
    liveRef,
  };

  return (
    <div ref={rootRef} className="fc-practice">
      <ModePicker mode={filter.mode} onChange={changeMode} />
      <div className="fc-controls">
        {(groups.length > 1 || filter.noteId !== null) && (
          <label className="field fc-control-wide">
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
        {/* Står alltid alene på sin rad på mobil (det tredje valget etter «Korttype» og «Rekkefølge»). */}
        {usesLength(filter.mode) && (
          <label className="field fc-control-wide">
            <span className="field-label">Lengde</span>
            <select
              value={filter.length ?? ''}
              onChange={(e) => changeFilter({ length: e.currentTarget.value ? (Number(e.currentTarget.value) as PracticeLength) : null })}
            >
              <option value="">Alle kort</option>
              <option value="10">10 kort</option>
              <option value="20">20 kort</option>
            </select>
          </label>
        )}
      </div>

      {clock.due && !clock.paused && <BreakBar onPause={clock.startPause} onContinue={clock.skipBreak} />}

      {filter.subset && (
        <div className="fc-repeat-note">
          <span>
            {filter.subsetKind === 'chunk' ? 'Økt på' : 'Repetisjon av'} {plural(filter.subset.length, 'kort', 'kort')}
          </span>
          {/* Fra en kort økt slås lengden av; fra en repetisjon fortsetter øvingen som før (med lengden, neste økt). */}
          <button
            type="button"
            className="link-btn"
            onClick={() => (filter.subsetKind === 'chunk' ? changeFilter({ length: null }) : restart({ ...filter, subset: null }))}
          >
            Tilbake til hele utvalget
          </button>
        </div>
      )}

      {filter.mode === 'classic' ? (
        pass && <ClassicPass session={session} pass={pass} setPass={setPass} />
      ) : filter.mode === 'mastery' ? (
        <MasteryRound session={session} round={round} setRound={setRound} />
      ) : (
        <QuickRound session={session} round={round} setRound={setRound} cloze={filter.mode === 'cloze' ? clozeSeed : null} />
      )}

      <div ref={liveRef} className="sr-only" aria-live="polite" />
      {clock.paused && <PauseOverlay since={clock.pausedAt} onResume={endPause} />}
    </div>
  );
}
