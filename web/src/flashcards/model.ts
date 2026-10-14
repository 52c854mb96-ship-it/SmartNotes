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
 *
 * Det over er Mestring, standardformen. De andre formene (valgt per kortstokk, `PracticeMode`):
 *   Rask runde  «Kunne» = Bra (ett nivå opp, ut av runden), «Kunne ikke» = Feil (nivå 0, sist i køen). Mestrede
 *               kort er med.
 *   Klassisk    Bla gjennom alle kortene og merk dem du vil øve mer på. Rører ikke nivåene, rekka eller «Beste».
 *   Luketekst   Motoren fra Rask runde. Riktig luke gir minst nivå 1 og senker aldri; feil eller «Vis» rører ikke
 *               nivået. Formen kan altså aldri gjøre et kort mestret.
 * Lengde (10 eller 20 kort) gjør utvalget mindre med `pickChunk`; reglene er formens.
 */
import type { Flashcard, FlashcardKind } from '@smartnotes/shared';
import type { PracticeLength, PracticeMode, PracticePass, PracticeState } from '../db';

export type { PracticeLength, PracticeMode, PracticePass };

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
  /** Rask runde og Luketekst: kortene eleven har kunnet i runden (følger med i angrestakken). */
  done?: string[];
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
  /** Plassen i køen kortet ble satt tilbake på (0 = med en gang, mestret eller ute av runden). */
  back: number;
  /** Kortet ble mestret av denne vurderingen. */
  mastered: boolean;
  best: number;
  fx: Effects;
}

const levelIn = (levels: ReadonlyMap<string, number>, id: string) => Math.min(levels.get(id) ?? 0, MASTER);

/** Navnet på gruppa (notatet) som ble mestret da kortet fikk nivået `level`, ellers null. */
function groupJustDone(ctx: Omit<RateContext, 'grade'>, cardId: string, level: number): string | null {
  const group = ctx.groupOf(cardId);
  if (group === null) return null;
  const done = (levels: ReadonlyMap<string, number>) => ctx.groupCards(group).every((id) => levelIn(levels, id) >= MASTER);
  return !done(ctx.levels) && done(new Map(ctx.levels).set(cardId, level)) ? ctx.groupName(group) : null;
}

/** Rekka, riktige svar, beste rekke og dårligste vurdering per kort etter en vurdering. «Delvis» og bedre er riktig. */
function tally(round: Round, cardId: string, grade: Grade, prevBest: number) {
  let { streak, correct } = round;
  let best = prevBest;
  if (grade >= 2) {
    streak += 1;
    correct += 1;
    if (streak > best) best = streak;
  } else streak = 0;
  const grades = { ...round.grades, [cardId]: Math.min(round.grades[cardId] ?? 4, grade) };
  return { grades, answered: round.answered + 1, correct, streak, best };
}

interface FxInput {
  grade: Grade;
  /** Kortet ble mestret av vurderingen. */
  mastered: boolean;
  /** Rekka etter vurderingen. */
  streak: number;
  /** Beste rekke før vurderingen. */
  prevBest: number;
  /** Gruppa (notatet) som ble mestret nå, ellers null. */
  groupDone: string | null;
  /** Køen er tom: runden er ferdig. */
  allDone: boolean;
  feedback: Effects['feedback'];
}

/**
 * Blink, merke, partikler og meldinger for en vurdering, felles for formene som flytter nivåene. Partikler kommer bare
 * ved «Perfekt», hver femte på rad, når et kort eller et notat blir mestret og når runden er ferdig.
 */
function effectsOf({ grade, mastered, streak, prevBest, groupDone, allDone, feedback }: FxInput): Effects {
  if (grade === 1) {
    return { flash: 'bad', pop: { text: '✕', tone: 'bad', word: false }, burst: 0, bump: false, toast: null, feedback };
  }
  const milestone = streak >= 5 && streak % 5 === 0;
  const big = grade === 4 || milestone || mastered || groupDone !== null || allDone;
  const pop: Effects['pop'] =
    grade === 2
      ? { text: 'Delvis', tone: 'mid', word: true }
      : { text: mastered ? 'Mestret' : grade === 4 ? '✓✓' : '✓', tone: 'ok', word: mastered };
  let burst = 0;
  if (groupDone !== null || allDone || milestone || mastered) burst = allDone || groupDone !== null ? 46 : milestone ? 26 : 16;
  else if (grade === 4) burst = 10;
  let toast: Effects['toast'] = null;
  if (groupDone !== null) toast = { text: `${groupDone} er mestret`, tone: 'ok' };
  else if (streak === prevBest + 1 && prevBest >= 5) toast = { text: `Ny rekord: ${streak} på rad`, tone: 'flame' };
  else if (milestone) toast = { text: `${streak} på rad`, tone: 'flame' };
  return { flash: grade === 2 ? 'mid' : big ? 'ok-big' : 'ok', pop, burst, bump: true, toast, feedback };
}

/** Vurderer kortet først i køen (Mestring). Gir null hvis køen er tom. */
export function rate(round: Round, ctx: RateContext): RateOutcome | null {
  const cardId = round.queue[0];
  if (cardId === undefined) return null;
  const { grade } = ctx;
  const before = levelIn(ctx.levels, cardId);
  const queue = round.queue.slice(1);
  const { level, gap } = schedule(before, grade);
  const mastered = level >= MASTER;
  let back = 0;
  if (!mastered) {
    back = Math.min(gap, queue.length);
    queue.splice(back, 0, cardId);
  }
  const t = tally(round, cardId, grade, ctx.best);
  const next: Round = { queue, grades: t.grades, answered: t.answered, correct: t.correct, streak: t.streak };

  const comeBack = back ? `Kortet kommer tilbake om ${back} kort.` : 'Kortet kommer tilbake med en gang.';
  const feedback: Effects['feedback'] =
    grade === 1
      ? { text: `Tilbake til nivå 0. ${comeBack}`, tone: 'bad' }
      : mastered
        ? { text: 'Kortet er mestret og tas ut av køen.', tone: 'ok' }
        : grade === 2
          ? { text: `Blir på nivå ${level}. ${comeBack}`, tone: 'mid' }
          : { text: `Nivå ${level} av ${MASTER}. ${comeBack}`, tone: 'ok' };
  const fx = effectsOf({
    grade,
    mastered,
    streak: t.streak,
    prevBest: ctx.best,
    groupDone: grade === 1 ? null : groupJustDone(ctx, cardId, level),
    allDone: queue.length === 0,
    feedback,
  });
  return { round: next, cardId, level, back, mastered, best: t.best, fx };
}

// ---------- Rask runde og Luketekst ----------

/** Som RateContext, uten vurderingen: formene med «Kunne» og «Kunne ikke». */
export type QuickContext = Omit<RateContext, 'grade'>;

/** Ny kø for Rask runde: hele utvalget, også mestrede kort, i rekkefølge eller blandet. */
export function buildQuickQueue(selection: Flashcard[], order: 'notes' | 'shuffle', random: () => number = Math.random): string[] {
  const ids = selection.map((c) => c.id);
  return order === 'shuffle' ? shuffle(ids, random) : ids;
}

/**
 * En lagret kø for Rask runde mot dagens kort: kort som er slettet eller flyttet ut av utvalget, fjernes, og kort som
 * mangler, legges sist, men ikke dem eleven alt har kunnet i runden (`done`). Mestrede kort blir stående.
 */
export function reconcileQuickQueue(queue: string[], selection: Flashcard[], done: readonly string[] = []): string[] {
  const present = new Set(selection.map((c) => c.id));
  const kept = [...new Set(queue)].filter((id) => present.has(id));
  const skip = new Set([...kept, ...done]);
  return [...kept, ...selection.map((c) => c.id).filter((id) => !skip.has(id))];
}

/**
 * Felles motor: «Kunne» tar kortet ut av runden (inn i `done`), ellers legges det sist i køen. Nivået er formens.
 * Rekka og «Beste» telles som «Bra» (kunne) og «Feil» (kunne ikke), og `grades` får 3 eller 1, så
 * `repetitionChoices(...).misses` gir kortene eleven ikke kunne.
 */
function quickStep(
  round: Round,
  ctx: QuickContext,
  known: boolean,
  levelFor: (before: number) => number,
  missText: string,
): RateOutcome | null {
  const cardId = round.queue[0];
  if (cardId === undefined) return null;
  const grade: Grade = known ? 3 : 1;
  const before = levelIn(ctx.levels, cardId);
  const level = levelFor(before);
  const queue = round.queue.slice(1);
  const done = round.done ?? [];
  const back = known ? 0 : queue.length;
  if (!known) queue.push(cardId);
  const mastered = before < MASTER && level >= MASTER;
  const t = tally(round, cardId, grade, ctx.best);
  const next: Round = {
    queue,
    grades: t.grades,
    answered: t.answered,
    correct: t.correct,
    streak: t.streak,
    done: known && !done.includes(cardId) ? [...done, cardId] : done,
  };
  const again = back ? 'Kortet kommer igjen til slutt.' : 'Kortet kommer tilbake med en gang.';
  const feedback: Effects['feedback'] = !known
    ? { text: `${missText} ${again}`, tone: 'bad' }
    : mastered
      ? { text: 'Kortet er mestret og tas ut av køen.', tone: 'ok' }
      : { text: `Nivå ${level} av ${MASTER}. Kortet er ferdig for denne runden.`, tone: 'ok' };
  const fx = effectsOf({
    grade,
    mastered,
    streak: t.streak,
    prevBest: ctx.best,
    groupDone: known ? groupJustDone(ctx, cardId, level) : null,
    allDone: queue.length === 0,
    feedback,
  });
  return { round: next, cardId, level, back, mastered, best: t.best, fx };
}

/**
 * Rask runde: «Kunne» (`known`) gir ett nivå opp som «Bra» (høyst 3) og tar kortet ut av runden. «Kunne ikke» gir
 * nivå 0 som «Feil» og legger kortet sist. Gir null hvis køen er tom.
 */
export function rateQuick(round: Round, ctx: QuickContext, known: boolean): RateOutcome | null {
  return quickStep(round, ctx, known, (before) => schedule(before, known ? 3 : 1).level, 'Tilbake til nivå 0.');
}

/** Luketekst: riktig ord, feil ord, eller «Vis» (eleven ga opp). */
export type ClozeOutcome = 'right' | 'wrong' | 'shown';

/**
 * Luketekst, for kort med luke (kort uten luke bruker `rateQuick`). Riktig luke løfter kortet til minst nivå 1 og
 * senker det aldri, og tar det ut av runden. Feil eller «Vis» rører ikke nivået (rettingen kan ta feil, for eksempel
 * med synonymer) og legger kortet sist. En luke er et hint, så formen gjør aldri et kort mestret.
 */
export function rateCloze(round: Round, ctx: QuickContext, outcome: ClozeOutcome): RateOutcome | null {
  const right = outcome === 'right';
  return quickStep(round, ctx, right, (before) => (right ? Math.max(before, 1) : before), 'Nivået er uendret.');
}

/** Rask runde: kortene i utvalget eleven kunne med en gang (bare «Kunne» i runden). */
export function knownFirstTry(ids: string[], grades: Record<string, number>): number {
  return ids.filter((id) => grades[id] === 3).length;
}

// ---------- Klassisk ----------

/** Ny gjennomgang: hele utvalget, også mestrede kort, i rekkefølge eller blandet. */
export function buildPass(selection: Flashcard[], order: 'notes' | 'shuffle', random: () => number = Math.random): PracticePass {
  return { ids: buildQuickQueue(selection, order, random), index: 0, marked: [] };
}

/**
 * En lagret gjennomgang mot dagens kort: slettede kort (og kort flyttet ut av utvalget) fjernes, nye legges sist.
 * Kortet som vises, blir stående; er det slettet, vises det neste. Merkingen på kortene som finnes, beholdes.
 */
export function reconcilePass(pass: PracticePass, selection: Flashcard[]): PracticePass {
  const present = new Set(selection.map((c) => c.id));
  const kept = new Set<string>();
  let index = 0;
  pass.ids.forEach((id, i) => {
    if (!present.has(id) || kept.has(id)) return;
    if (i < pass.index) index += 1;
    kept.add(id);
  });
  const ids = [...kept, ...selection.map((c) => c.id).filter((id) => !kept.has(id))];
  const marked = new Set(pass.marked);
  return { ids, index, marked: ids.filter((id) => marked.has(id)) };
}

/** Ett kort fram (1) eller tilbake (−1). Stopper på første kort og etter siste (gjennomgangen er ferdig). */
export function stepPass(pass: PracticePass, step: 1 | -1): PracticePass {
  const index = Math.max(0, Math.min(pass.index + step, pass.ids.length));
  return index === pass.index ? pass : { ...pass, index };
}

/** Merker kortet, eller fjerner merket. */
export function toggleMark(pass: PracticePass, cardId: string): PracticePass {
  if (!pass.ids.includes(cardId)) return pass;
  const marked = new Set(pass.marked);
  if (marked.has(cardId)) marked.delete(cardId);
  else marked.add(cardId);
  return { ...pass, marked: pass.ids.filter((id) => marked.has(id)) };
}

// ---------- Lengde ----------

export interface Chunk {
  /** Kortene i den korte økta (legges i `subset`). */
  ids: string[];
  /** Kortene eleven har hatt i denne omgangen, etter denne økta (Rask runde). */
  seen: string[];
}

/**
 * De neste `n` kortene til en kort økt, i valgt rekkefølge. Mestring tar de første som ikke er mestret. Rask runde og
 * Luketekst tar de første eleven ikke har hatt i denne omgangen (`seen`); når alle er sett, begynner en ny omgang.
 */
export function pickChunk(
  selection: Flashcard[],
  order: 'notes' | 'shuffle',
  n: number,
  mode: PracticeMode,
  seen: readonly string[],
  random: () => number = Math.random,
): Chunk {
  const pick = (cards: Flashcard[]) => buildQuickQueue(cards, order, random).slice(0, Math.max(0, n));
  if (mode === 'mastery') return { ids: pick(selection.filter((c) => levelOf(c) < MASTER)), seen: [...seen] };
  const present = new Set(selection.map((c) => c.id));
  const had = new Set(seen.filter((id) => present.has(id)));
  const fresh = selection.filter((c) => !had.has(c.id));
  const ids = pick(fresh.length ? fresh : selection);
  return { ids, seen: [...(fresh.length ? had : []), ...ids] };
}

// ---------- Lagret økt ----------

export const isPracticeMode = (v: unknown): v is PracticeMode => v === 'mastery' || v === 'quick' || v === 'classic' || v === 'cloze';

/** En lagret økt med feltene formene trenger, alltid satt. */
export type NormalizedPractice = PracticeState & {
  mode: PracticeMode;
  length: PracticeLength | null;
  done: string[];
  seen: string[];
};

const idList = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []);

/**
 * Leser en lagret økt trygt: økter fra før formene (uten `mode`) blir Mestring, et utvalg uten `subsetKind` er en
 * repetisjon, og felt med ugyldige verdier fjernes eller får standardverdien.
 */
export function normalizePracticeState(s: PracticeState): NormalizedPractice {
  const { pass, clozeSeed, subsetKind, ...rest } = s;
  const out: NormalizedPractice = {
    ...rest,
    mode: isPracticeMode(s.mode) ? s.mode : 'mastery',
    length: s.length === 10 || s.length === 20 ? s.length : null,
    done: idList(s.done),
    seen: idList(s.seen),
  };
  if (s.subset) out.subsetKind = subsetKind === 'chunk' ? 'chunk' : 'repeat';
  if (pass && Array.isArray(pass.ids)) {
    const ids = idList(pass.ids);
    const marked = new Set(idList(pass.marked));
    const index = Number.isInteger(pass.index) ? Math.max(0, Math.min(pass.index, ids.length)) : 0;
    out.pass = { ids, index, marked: ids.filter((id) => marked.has(id)) };
  }
  if (Number.isInteger(clozeSeed)) out.clozeSeed = clozeSeed;
  return out;
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
