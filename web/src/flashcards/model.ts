/**
 * Øvingslogikken for flashcards, uten DOM og database (testes i model.test.ts).
 *
 * Hvert kort har et mestringsnivå 0–3. Eleven vurderer svaret sitt fra 1 til 4:
 *   1 Feil     → nivå 0, kortet kommer igjen etter 3 kort
 *   2 Delvis   → samme nivå, igjen etter 4 kort
 *   3 Bra      → ett nivå opp, igjen etter 5 kort (første gang) eller 9
 *   4 Perfekt  → to nivåer opp, igjen etter 10 kort
 * Et kort på nivå 3 er mestret og tas ut av køen. Runden er ferdig når køen er tom. Da kan eleven repetere kortene
 * hen ikke kunne (vurdert 1 minst én gang), også de hen var usikker på (1–2), eller alle.
 */
import type { Flashcard, FlashcardKind } from '@smartnotes/shared';

export const MASTER = 3;
/** Pausepåminnelse etter så mye aktiv øving. */
export const BREAK_MS = 30 * 60 * 1000;
/** Inaktiv tid over dette regnes ikke som øving. */
export const IDLE_CAP = 2 * 60 * 1000;
export const UNDO_LIMIT = 30;

export type Grade = 1 | 2 | 3 | 4;

export function isGrade(n: number): n is Grade {
  return n === 1 || n === 2 || n === 3 || n === 4;
}

/** Nytt nivå og hvor mange kort det går før kortet vises igjen. */
export function schedule(before: number, grade: Grade): { level: number; gap: number } {
  if (grade === 1) return { level: 0, gap: 3 };
  if (grade === 2) return { level: before, gap: 4 };
  if (grade === 3) {
    const level = Math.min(before + 1, MASTER);
    return { level, gap: level === 1 ? 5 : 9 };
  }
  return { level: Math.min(before + 2, MASTER), gap: 10 };
}

export const levelOf = (card: Pick<Flashcard, 'level'> | undefined): number => Math.max(0, Math.min(card?.level ?? 0, MASTER));

// ---------- Utvalg og kø ----------

/** Filterverdi for kort brukeren har laget selv (uten notat). */
export const OWN_CARDS = 'egne';

export interface Filter {
  /** Bare kort fra dette notatet (null = alle, OWN_CARDS = egne kort). */
  noteId: string | null;
  kind: FlashcardKind | null;
  /** Repetisjon av bestemte kort (null = alle i utvalget). */
  subset: string[] | null;
}

/** Kortene i utvalget, i kortstokkens rekkefølge. */
export function selectCards(cards: Flashcard[], f: Filter): Flashcard[] {
  const subset = f.subset ? new Set(f.subset) : null;
  return cards
    .filter(
      (c) =>
        (f.noteId === null || (c.noteId ?? OWN_CARDS) === f.noteId) &&
        (f.kind === null || c.kind === f.kind) &&
        (!subset || subset.has(c.id)),
    )
    .sort((a, b) => a.position - b.position);
}

export function shuffle<T>(list: T[], random: () => number = Math.random): T[] {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

/** Ny kø: kortene i utvalget som ikke er mestret, i rekkefølge eller blandet. */
export function buildQueue(selection: Flashcard[], order: 'notes' | 'shuffle', random: () => number = Math.random): string[] {
  const ids = selection.filter((c) => levelOf(c) < MASTER).map((c) => c.id);
  return order === 'shuffle' ? shuffle(ids, random) : ids;
}

/**
 * En lagret kø mot dagens kort: kort som er slettet, flyttet ut av utvalget eller mestret (f.eks. på en annen enhet)
 * fjernes, og kort som mangler (nye, eller nullstilt et annet sted) legges sist.
 */
export function reconcileQueue(queue: string[], selection: Flashcard[]): string[] {
  const open = new Map(selection.filter((c) => levelOf(c) < MASTER).map((c) => [c.id, c]));
  const kept = [...new Set(queue)].filter((id) => open.has(id));
  const inQueue = new Set(kept);
  return [...kept, ...[...open.keys()].filter((id) => !inQueue.has(id))];
}

/** Andel av mulige nivåer som er nådd (0–100), som fremdriftslinja i originalen. */
export function masteryPct(cards: Pick<Flashcard, 'level'>[]): number {
  if (!cards.length) return 0;
  return Math.round((cards.reduce((s, c) => s + levelOf(c), 0) / (cards.length * MASTER)) * 100);
}

export function masteredCount(cards: Pick<Flashcard, 'level'>[]): number {
  return cards.filter((c) => levelOf(c) >= MASTER).length;
}

// ---------- Vurdering ----------

export interface Round {
  queue: string[];
  /** Dårligste vurdering per kort i runden. */
  grades: Record<string, number>;
  answered: number;
  correct: number;
  streak: number;
}

export const emptyRound = (queue: string[], streak = 0): Round => ({ queue, grades: {}, answered: 0, correct: 0, streak });

export interface RateContext {
  grade: Grade;
  /** Nivåene før vurderingen, for alle kortene i kortstokken. */
  levels: ReadonlyMap<string, number>;
  /** Gruppen (notatet) et kort hører til, for meldingen «… er mestret». */
  groupOf: (cardId: string) => string | null;
  /** Alle kortene i en gruppe (hele kortstokken, uansett filter). */
  groupCards: (group: string) => string[];
  groupName: (group: string) => string;
  best: number;
}

export type Tone = 'bad' | 'mid' | 'ok';

export interface Effects {
  flash: 'bad' | 'mid' | 'ok' | 'ok-big';
  pop: { text: string; tone: Tone; word: boolean };
  /** Antall partikler (0 = ingen). */
  burst: number;
  /** «Rekke»-pillen spretter. */
  bump: boolean;
  toast: { text: string; tone: 'ok' | 'flame' } | null;
  feedback: { text: string; tone: Tone };
}

export interface RateOutcome {
  round: Round;
  cardId: string;
  level: number;
  /** Plassen i køen kortet ble satt tilbake på (0 = med en gang eller mestret). */
  back: number;
  mastered: boolean;
  best: number;
  fx: Effects;
}

/** Vurderer kortet først i køen. Gir null hvis køen er tom. */
export function rate(round: Round, ctx: RateContext): RateOutcome | null {
  const cardId = round.queue[0];
  if (cardId === undefined) return null;
  const { grade } = ctx;
  const lvl = (id: string, levels: ReadonlyMap<string, number>) => Math.min(levels.get(id) ?? 0, MASTER);
  const group = ctx.groupOf(cardId);
  const groupDone = (levels: ReadonlyMap<string, number>) =>
    group !== null && ctx.groupCards(group).every((id) => lvl(id, levels) >= MASTER);

  const before = lvl(cardId, ctx.levels);
  const groupWasDone = groupDone(ctx.levels);
  const prevBest = ctx.best;
  const queue = round.queue.slice(1);
  const { level, gap } = schedule(before, grade);
  const after = new Map(ctx.levels).set(cardId, level);
  const mastered = level >= MASTER;
  let back = 0;
  if (!mastered) {
    back = Math.min(gap, queue.length);
    queue.splice(back, 0, cardId);
  }
  let { streak, correct } = round;
  let best = prevBest;
  if (grade >= 2) {
    streak += 1;
    correct += 1;
    if (streak > best) best = streak;
  } else streak = 0;
  const grades = { ...round.grades, [cardId]: Math.min(round.grades[cardId] ?? 4, grade) };
  const next: Round = { queue, grades, answered: round.answered + 1, correct, streak };

  const comeBack = back ? `Kortet kommer tilbake om ${back} kort.` : 'Kortet kommer tilbake med en gang.';
  if (grade === 1) {
    return {
      round: next,
      cardId,
      level,
      back,
      mastered,
      best,
      fx: {
        flash: 'bad',
        pop: { text: '✕', tone: 'bad', word: false },
        burst: 0,
        bump: false,
        toast: null,
        feedback: { text: `Tilbake til nivå 0. ${comeBack}`, tone: 'bad' },
      },
    };
  }
  const milestone = streak >= 5 && streak % 5 === 0;
  const groupNowDone = !groupWasDone && groupDone(after);
  const allDone = queue.length === 0;
  const big = grade === 4 || milestone || mastered || groupNowDone || allDone;

  const pop: Effects['pop'] =
    grade === 2
      ? { text: 'Delvis', tone: 'mid', word: true }
      : { text: mastered ? 'Mestret' : grade === 4 ? '✓✓' : '✓', tone: 'ok', word: mastered };
  let burst = 0;
  if (groupNowDone || allDone || milestone || mastered) burst = allDone || groupNowDone ? 46 : milestone ? 26 : 16;
  else if (grade === 4) burst = 10;
  let toast: Effects['toast'] = null;
  if (groupNowDone && group !== null) toast = { text: `${ctx.groupName(group)} er mestret`, tone: 'ok' };
  else if (streak === prevBest + 1 && prevBest >= 5) toast = { text: `Ny rekord: ${streak} på rad`, tone: 'flame' };
  else if (milestone) toast = { text: `${streak} på rad`, tone: 'flame' };
  const feedback: Effects['feedback'] = mastered
    ? { text: 'Kortet er mestret og tas ut av køen.', tone: 'ok' }
    : grade === 2
      ? { text: `Blir på nivå ${level}. ${comeBack}`, tone: 'mid' }
      : { text: `Nivå ${level} av ${MASTER}. ${comeBack}`, tone: 'ok' };

  return {
    round: next,
    cardId,
    level,
    back,
    mastered,
    best,
    fx: { flash: grade === 2 ? 'mid' : big ? 'ok-big' : 'ok', pop, burst, bump: true, toast, feedback },
  };
}

// ---------- Etter runden ----------

export interface RepetitionChoices {
  /** Kort vurdert «Feil» minst én gang i runden. */
  misses: string[];
  /** Kort vurdert «Feil» eller «Delvis» minst én gang. */
  unsure: string[];
  /** Hele utvalget. */
  all: string[];
}

export function repetitionChoices(selection: Flashcard[], grades: Record<string, number>): RepetitionChoices {
  const ids = selection.map((c) => c.id);
  return {
    misses: ids.filter((id) => grades[id] === 1),
    unsure: ids.filter((id) => grades[id] !== undefined && grades[id]! <= 2),
    all: ids,
  };
}

/** Andel svar i runden som var «delvis» eller bedre (0–100). */
export function correctPct(round: Pick<Round, 'answered' | 'correct'>): number {
  return round.answered ? Math.round((round.correct / round.answered) * 100) : 0;
}

/** Aktiv øvetid: tiden siden forrige handling teller, men høyst IDLE_CAP. */
export function addActiveTime(sinceBreak: number, lastAction: number, now: number): number {
  return sinceBreak + Math.max(0, Math.min(now - lastAction, IDLE_CAP));
}
