import { describe, expect, it } from 'vitest';
import type { Flashcard } from '@smartnotes/shared';
import type { PracticeState } from '../db';
import {
  MASTER,
  addActiveTime,
  buildPass,
  buildQueue,
  buildQuickQueue,
  correctPct,
  emptyRound,
  knownFirstTry,
  masteryPct,
  normalizePracticeState,
  pickChunk,
  rate,
  rateCloze,
  rateQuick,
  reconcilePass,
  reconcileQueue,
  reconcileQuickQueue,
  repetitionChoices,
  schedule,
  selectCards,
  stepPass,
  toggleMark,
  type Grade,
  type RateContext,
  type Round,
} from './model';

function card(id: string, over: Partial<Flashcard> = {}): Flashcard {
  return {
    id,
    deckId: 'd',
    noteId: 'n1',
    kind: 'concept',
    front: id,
    back: ['svar'],
    detail: '',
    position: Number(id.replace(/\D/g, '')) || 0,
    level: 0,
    levelAt: null,
    rev: 1,
    deleted: false,
    createdAt: '',
    updatedAt: '',
    ...over,
  };
}

/** Kontekst der alle kortene hører til notatet «n1» med navnet «Newtons lover». */
function ctx(levels: Record<string, number>, grade: Grade, best = 0, ids = Object.keys(levels)): RateContext {
  return {
    grade,
    levels: new Map(Object.entries(levels)),
    groupOf: () => 'n1',
    groupCards: () => ids,
    groupName: () => 'Newtons lover',
    best,
  };
}

const queue = (n: number) => Array.from({ length: n }, (_, i) => `c${i + 1}`);

describe('nivå og avstand (som i originalen)', () => {
  it('følger tabellen for vurderingene 1–4', () => {
    expect(schedule(2, 1)).toEqual({ level: 0, gap: 3 });
    expect(schedule(1, 2)).toEqual({ level: 1, gap: 4 });
    expect(schedule(0, 3)).toEqual({ level: 1, gap: 5 });
    expect(schedule(1, 3)).toEqual({ level: 2, gap: 9 });
    expect(schedule(0, 4)).toEqual({ level: 2, gap: 10 });
    expect(schedule(2, 4)).toEqual({ level: MASTER, gap: 10 });
  });
});

describe('vurdering', () => {
  const levels = Object.fromEntries(queue(12).map((id) => [id, 0]));

  it('feil: nivå 0, tilbake etter 3 kort, rekka nullstilles', () => {
    const round: Round = { ...emptyRound(queue(12)), streak: 4 };
    const out = rate(round, ctx({ ...levels, c1: 2 }, 1))!;
    expect(out.level).toBe(0);
    expect(out.back).toBe(3);
    expect(out.round.queue.slice(0, 4)).toEqual(['c2', 'c3', 'c4', 'c1']);
    expect(out.round.streak).toBe(0);
    expect(out.round.correct).toBe(0);
    expect(out.round.answered).toBe(1);
    expect(out.fx).toMatchObject({ flash: 'bad', pop: { text: '✕', tone: 'bad' }, burst: 0, bump: false });
    expect(out.fx.feedback).toEqual({ text: 'Tilbake til nivå 0. Kortet kommer tilbake om 3 kort.', tone: 'bad' });
  });

  it('delvis: samme nivå, tilbake etter 4 kort', () => {
    const out = rate(emptyRound(queue(12)), ctx({ ...levels, c1: 1 }, 2))!;
    expect(out.level).toBe(1);
    expect(out.back).toBe(4);
    expect(out.round.streak).toBe(1);
    expect(out.fx.flash).toBe('mid');
    expect(out.fx.pop).toEqual({ text: 'Delvis', tone: 'mid', word: true });
    expect(out.fx.feedback.text).toBe('Blir på nivå 1. Kortet kommer tilbake om 4 kort.');
  });

  it('bra: ett nivå opp; perfekt: to nivåer opp med små partikler', () => {
    const good = rate(emptyRound(queue(12)), ctx(levels, 3))!;
    expect(good.level).toBe(1);
    expect(good.back).toBe(5);
    expect(good.fx).toMatchObject({ flash: 'ok', pop: { text: '✓' }, burst: 0, bump: true });
    expect(good.fx.feedback.text).toBe('Nivå 1 av 3. Kortet kommer tilbake om 5 kort.');
    const great = rate(emptyRound(queue(12)), ctx(levels, 4))!;
    expect(great.level).toBe(2);
    expect(great.back).toBe(10);
    expect(great.fx).toMatchObject({ flash: 'ok-big', pop: { text: '✓✓' }, burst: 10 });
  });

  it('kortet kommer tilbake tidligere når køen er kort', () => {
    const out = rate(emptyRound(['c1', 'c2']), ctx({ c1: 0, c2: 0 }, 1))!;
    expect(out.round.queue).toEqual(['c2', 'c1']);
    expect(out.back).toBe(1);
    const alone = rate(emptyRound(['c1']), ctx({ c1: 0 }, 2))!;
    expect(alone.back).toBe(0);
    expect(alone.fx.feedback.text).toBe('Blir på nivå 0. Kortet kommer tilbake med en gang.');
  });

  it('mestret kort tas ut av køen', () => {
    const out = rate(emptyRound(queue(3)), ctx({ c1: 2, c2: 0, c3: 0 }, 3))!;
    expect(out.mastered).toBe(true);
    expect(out.round.queue).toEqual(['c2', 'c3']);
    expect(out.fx.pop).toEqual({ text: 'Mestret', tone: 'ok', word: true });
    expect(out.fx.burst).toBe(16);
    expect(out.fx.feedback).toEqual({ text: 'Kortet er mestret og tas ut av køen.', tone: 'ok' });
  });

  it('siste kort i gruppa: «… er mestret» og stor feiring', () => {
    const out = rate(emptyRound(['c3']), ctx({ c1: 3, c2: 3, c3: 2 }, 4))!;
    expect(out.round.queue).toEqual([]);
    expect(out.fx.burst).toBe(46);
    expect(out.fx.toast).toEqual({ text: 'Newtons lover er mestret', tone: 'ok' });
  });

  it('hver femte på rad gir milepæl, og ny rekord over 5 meldes', () => {
    const at4: Round = { ...emptyRound(queue(12)), streak: 4 };
    const fifth = rate(at4, ctx(levels, 3, 10))!;
    expect(fifth.round.streak).toBe(5);
    expect(fifth.fx.toast).toEqual({ text: '5 på rad', tone: 'flame' });
    expect(fifth.fx.burst).toBe(26);
    expect(fifth.best).toBe(10);

    const record = rate({ ...emptyRound(queue(12)), streak: 6 }, ctx(levels, 2, 6))!;
    expect(record.best).toBe(7);
    expect(record.fx.toast).toEqual({ text: 'Ny rekord: 7 på rad', tone: 'flame' });

    const small = rate({ ...emptyRound(queue(12)), streak: 3 }, ctx(levels, 3, 3))!;
    expect(small.best).toBe(4);
    expect(small.fx.toast).toBeNull();
  });

  it('husker dårligste vurdering per kort i runden', () => {
    let round = emptyRound(['c1', 'c2']);
    const lv = { c1: 0, c2: 0 };
    round = rate(round, ctx(lv, 1))!.round; // c1 feil
    round = rate(round, ctx(lv, 3))!.round; // c2 bra
    round = rate(round, ctx(lv, 4))!.round; // c1 perfekt
    expect(round.grades).toEqual({ c1: 1, c2: 3 });
    expect(round.answered).toBe(3);
    expect(correctPct(round)).toBe(67);
  });

  it('tom kø gir null', () => {
    expect(rate(emptyRound([]), ctx({}, 3))).toBeNull();
  });

  it('en hel runde ender med tom kø og alle kort mestret', () => {
    const levelsNow = new Map(queue(5).map((id) => [id, 0]));
    let round = emptyRound(queue(5));
    let steps = 0;
    while (round.queue.length && steps < 200) {
      const id = round.queue[0]!;
      const grade: Grade = steps % 7 === 0 ? 1 : steps % 3 === 0 ? 2 : 3;
      const out = rate(round, { ...ctx({}, grade), levels: levelsNow, groupCards: () => queue(5) })!;
      levelsNow.set(id, out.level);
      round = out.round;
      steps += 1;
    }
    expect(round.queue).toEqual([]);
    expect([...levelsNow.values()].every((l) => l === MASTER)).toBe(true);
  });
});

describe('utvalg, kø og repetisjon', () => {
  const cards = [
    card('c3', { kind: 'apply' }),
    card('c1'),
    card('c2', { noteId: 'n2', kind: 'explain', level: 3 }),
    card('c4', { noteId: 'n2', level: 1 }),
  ];

  it('filtrerer på notat, korttype og repetisjonsutvalg, i kortstokkens rekkefølge', () => {
    expect(selectCards(cards, { noteId: null, kind: null, subset: null }).map((c) => c.id)).toEqual(['c1', 'c2', 'c3', 'c4']);
    expect(selectCards(cards, { noteId: 'n2', kind: null, subset: null }).map((c) => c.id)).toEqual(['c2', 'c4']);
    expect(selectCards(cards, { noteId: null, kind: 'concept', subset: null }).map((c) => c.id)).toEqual(['c1', 'c4']);
    expect(selectCards(cards, { noteId: null, kind: null, subset: ['c4', 'c3'] }).map((c) => c.id)).toEqual(['c3', 'c4']);
  });

  it('køen har bare kort som ikke er mestret, og kan blandes', () => {
    const sel = selectCards(cards, { noteId: null, kind: null, subset: null });
    expect(buildQueue(sel, 'notes')).toEqual(['c1', 'c3', 'c4']);
    const shuffled = buildQueue(sel, 'shuffle', () => 0);
    expect([...shuffled].sort()).toEqual(['c1', 'c3', 'c4']);
    expect(shuffled).not.toEqual(['c1', 'c3', 'c4']);
  });

  it('en lagret kø oppdateres mot kortene slik de er nå', () => {
    const sel = selectCards(cards, { noteId: null, kind: null, subset: null });
    // c9 er slettet, c2 er mestret, c1 mangler i køen (f.eks. nullstilt på en annen enhet).
    expect(reconcileQueue(['c4', 'c9', 'c2', 'c3', 'c4'], sel)).toEqual(['c4', 'c3', 'c1']);
  });

  it('repetisjonsvalg etter runden', () => {
    const sel = selectCards(cards, { noteId: null, kind: null, subset: null });
    const choices = repetitionChoices(sel, { c1: 1, c3: 2, c4: 4 });
    expect(choices.misses).toEqual(['c1']);
    expect(choices.unsure).toEqual(['c1', 'c3']);
    expect(choices.all).toEqual(['c1', 'c2', 'c3', 'c4']);
  });

  it('fremdrift og aktiv tid', () => {
    expect(masteryPct([{ level: 3 }, { level: 0 }, { level: 1 }])).toBe(44);
    expect(masteryPct([])).toBe(0);
    expect(addActiveTime(0, 1_000, 61_000)).toBe(60_000);
    expect(addActiveTime(0, 0, 10 * 60_000)).toBe(2 * 60_000);
  });
});

describe('Rask runde', () => {
  const sel = [card('c1'), card('c2', { level: 3 }), card('c3', { level: 1 })];

  it('køen tar med mestrede kort, i rekkefølge eller blandet', () => {
    expect(buildQuickQueue(sel, 'notes')).toEqual(['c1', 'c2', 'c3']);
    const shuffled = buildQuickQueue(sel, 'shuffle', () => 0);
    expect([...shuffled].sort()).toEqual(['c1', 'c2', 'c3']);
    expect(shuffled).not.toEqual(['c1', 'c2', 'c3']);
  });

  it('«Kunne» gir ett nivå opp og tar kortet ut; «Kunne ikke» gir 0 og legger det sist', () => {
    const known = rateQuick(emptyRound(queue(3)), ctx({ c1: 1, c2: 0, c3: 0 }, 3), true)!;
    expect(known.level).toBe(2);
    expect(known.back).toBe(0);
    expect(known.mastered).toBe(false);
    expect(known.round.queue).toEqual(['c2', 'c3']);
    expect(known.round.done).toEqual(['c1']);
    expect(known.fx).toMatchObject({ flash: 'ok', pop: { text: '✓', tone: 'ok' }, burst: 0, bump: true, toast: null });
    expect(known.fx.feedback).toEqual({ text: 'Nivå 2 av 3. Kortet er ferdig for denne runden.', tone: 'ok' });

    const missed = rateQuick({ ...emptyRound(queue(3)), streak: 3 }, ctx({ c1: 2, c2: 0, c3: 0 }, 1), false)!;
    expect(missed.level).toBe(0);
    expect(missed.back).toBe(2);
    expect(missed.round.queue).toEqual(['c2', 'c3', 'c1']);
    expect(missed.round.done).toEqual([]);
    expect(missed.round.streak).toBe(0);
    expect(missed.fx).toMatchObject({ flash: 'bad', pop: { text: '✕', tone: 'bad' }, burst: 0, bump: false });
    expect(missed.fx.feedback).toEqual({ text: 'Tilbake til nivå 0. Kortet kommer igjen til slutt.', tone: 'bad' });

    const alone = rateQuick(emptyRound(['c1']), ctx({ c1: 0 }, 1), false)!;
    expect(alone.round.queue).toEqual(['c1']);
    expect(alone.fx.feedback.text).toBe('Tilbake til nivå 0. Kortet kommer tilbake med en gang.');
  });

  it('et mestret kort med «Kunne» blir på 3; et kort på 2 blir mestret', () => {
    const stays = rateQuick(emptyRound(['c1', 'c2']), ctx({ c1: 3, c2: 0 }, 3), true)!;
    expect(stays.level).toBe(MASTER);
    expect(stays.mastered).toBe(false);
    expect(stays.fx.burst).toBe(0);
    expect(stays.fx.feedback.text).toBe('Nivå 3 av 3. Kortet er ferdig for denne runden.');

    const now = rateQuick(emptyRound(['c1', 'c2']), ctx({ c1: 2, c2: 0 }, 3), true)!;
    expect(now.level).toBe(MASTER);
    expect(now.mastered).toBe(true);
    expect(now.fx.pop).toEqual({ text: 'Mestret', tone: 'ok', word: true });
    expect(now.fx.burst).toBe(16);
    expect(now.fx.feedback).toEqual({ text: 'Kortet er mestret og tas ut av køen.', tone: 'ok' });

    // Et mestret kort som får «Kunne ikke», faller til 0 og kommer med i Mestring igjen.
    expect(rateQuick(emptyRound(['c1', 'c2']), ctx({ c1: 3, c2: 0 }, 1), false)!.level).toBe(0);
  });

  it('avstemmingen legger ikke tilbake kort eleven har kunnet, og fjerner ikke mestrede kort', () => {
    // c1 er besvart med «Kunne», c2 er mestret (f.eks. på en annen enhet) og mangler i køen.
    expect(reconcileQuickQueue(['c3'], sel, ['c1'])).toEqual(['c3', 'c2']);
    expect(reconcileQuickQueue(['c2', 'c3', 'c2'], sel)).toEqual(['c2', 'c3', 'c1']);
    expect(reconcileQuickQueue([], sel, ['c1', 'c2', 'c3'])).toEqual([]);
  });

  it('et kort slettet midt i runden forsvinner, og et nytt kort kommer sist', () => {
    const now = [card('c2', { level: 3 }), card('c3'), card('c4')];
    expect(reconcileQuickQueue(['c3', 'c1', 'c2'], now, ['c5'])).toEqual(['c3', 'c2', 'c4']);
  });

  it('rekka og «Beste» telles, og etter runden gir misses kortene eleven ikke kunne', () => {
    const levels = new Map(queue(3).map((id) => [id, 0]));
    let round = emptyRound(queue(3), 2);
    let best = 3;
    const answers = [true, false, true, true]; // c1 kunne, c2 kunne ikke, c3 kunne, c2 kunne
    const streaks: number[] = [];
    for (const known of answers) {
      const out = rateQuick(round, { ...ctx({}, 3, best, queue(3)), levels }, known)!;
      levels.set(out.cardId, out.level);
      round = out.round;
      best = out.best;
      streaks.push(round.streak);
    }
    expect(streaks).toEqual([3, 0, 1, 2]);
    expect(best).toBe(3);
    expect(round.queue).toEqual([]);
    expect(round.done).toEqual(['c1', 'c3', 'c2']);
    expect(round).toMatchObject({ answered: 4, correct: 3, grades: { c1: 3, c2: 1, c3: 3 } });
    expect([...levels.values()]).toEqual([1, 1, 1]);
    const sel3 = queue(3).map((id) => card(id));
    expect(repetitionChoices(sel3, round.grades).misses).toEqual(['c2']);
    expect(knownFirstTry(queue(3), round.grades)).toBe(2);

    const record = rateQuick({ ...emptyRound(queue(3)), streak: 6 }, ctx({ c1: 0, c2: 0, c3: 0 }, 3, 6), true)!;
    expect(record.best).toBe(7);
    expect(record.fx.toast).toEqual({ text: 'Ny rekord: 7 på rad', tone: 'flame' });
  });

  it('effektene: ingen partikler per kort, bare ved 5 på rad og 46 når runden er ferdig', () => {
    const levels = new Map(queue(4).map((id) => [id, 0]));
    let round = emptyRound(queue(4));
    const bursts: number[] = [];
    while (round.queue.length) {
      const out = rateQuick(round, { ...ctx({}, 3, 20, queue(4)), levels }, true)!;
      levels.set(out.cardId, out.level);
      round = out.round;
      bursts.push(out.fx.burst);
    }
    expect(bursts).toEqual([0, 0, 0, 46]);
    const fifth = rateQuick({ ...emptyRound(queue(3)), streak: 4 }, ctx({ c1: 0, c2: 0, c3: 0 }, 3, 20), true)!;
    expect(fifth.fx.burst).toBe(26);
    expect(fifth.fx.toast).toEqual({ text: '5 på rad', tone: 'flame' });
  });

  it('tom kø gir null', () => {
    expect(rateQuick(emptyRound([]), ctx({}, 3), true)).toBeNull();
    expect(rateCloze(emptyRound([]), ctx({}, 3), 'right')).toBeNull();
  });
});

describe('Luketekst', () => {
  it('riktig luke løfter kortet til minst nivå 1, senker det aldri og tar det ut av runden', () => {
    const from0 = rateCloze(emptyRound(queue(3)), ctx({ c1: 0, c2: 0, c3: 0 }, 3), 'right')!;
    expect(from0.level).toBe(1);
    expect(from0.round.queue).toEqual(['c2', 'c3']);
    expect(from0.round.done).toEqual(['c1']);
    expect(from0.round.streak).toBe(1);
    expect(from0.fx.feedback).toEqual({ text: 'Nivå 1 av 3. Kortet er ferdig for denne runden.', tone: 'ok' });
    expect(rateCloze(emptyRound(queue(3)), ctx({ c1: 2, c2: 0, c3: 0 }, 3), 'right')!.level).toBe(2);
    const kept = rateCloze(emptyRound(queue(3)), ctx({ c1: 3, c2: 0, c3: 0 }, 3), 'right')!;
    expect(kept.level).toBe(MASTER);
    expect(kept.mastered).toBe(false);
  });

  it('feil eller «Vis» rører ikke nivået og legger kortet sist', () => {
    for (const outcome of ['wrong', 'shown'] as const) {
      const out = rateCloze({ ...emptyRound(queue(3)), streak: 2 }, ctx({ c1: 2, c2: 0, c3: 0 }, 3), outcome)!;
      expect(out.level).toBe(2);
      expect(out.round.queue).toEqual(['c2', 'c3', 'c1']);
      expect(out.round.grades).toEqual({ c1: 1 });
      expect(out.round.streak).toBe(0);
      expect(out.fx.feedback).toEqual({ text: 'Nivået er uendret. Kortet kommer igjen til slutt.', tone: 'bad' });
    }
  });

  it('formen gjør aldri et kort mestret, uansett hvor mange runder', () => {
    let level = 0;
    for (let i = 0; i < 6; i++) {
      const out = rateCloze(emptyRound(['c1', 'c2']), ctx({ c1: level, c2: 0 }, 3), 'right')!;
      expect(out.mastered).toBe(false);
      level = out.level;
    }
    expect(level).toBe(1);
  });
});

describe('Klassisk', () => {
  const sel = [card('c1'), card('c2', { level: 3 }), card('c3'), card('c4', { level: 3 })];
  const ids = ['c1', 'c2', 'c3', 'c4'];

  it('gjennomgangen tar med mestrede kort', () => {
    expect(buildPass(sel, 'notes')).toEqual({ ids, index: 0, marked: [] });
    expect([...buildPass(sel, 'shuffle', () => 0).ids].sort()).toEqual(ids);
  });

  it('stepPass går fram og tilbake og stopper i begge ender', () => {
    const start = buildPass(sel, 'notes');
    expect(stepPass(start, -1)).toBe(start);
    let pass = start;
    for (let i = 0; i < 6; i++) pass = stepPass(pass, 1);
    expect(pass.index).toBe(4); // etter siste kort: ferdig
    expect(stepPass(pass, 1)).toBe(pass);
    expect(stepPass(pass, -1).index).toBe(3);
  });

  it('reconcilePass justerer plassen når et kort før eller under det er slettet', () => {
    const pass = { ids, index: 2, marked: [] }; // c3 vises
    const without = (id: string) => sel.filter((c) => c.id !== id);
    expect(reconcilePass(pass, without('c1'))).toEqual({ ids: ['c2', 'c3', 'c4'], index: 1, marked: [] });
    expect(reconcilePass(pass, without('c3'))).toEqual({ ids: ['c1', 'c2', 'c4'], index: 2, marked: [] });
    expect(reconcilePass(pass, without('c4'))).toEqual({ ids: ['c1', 'c2', 'c3'], index: 2, marked: [] });
    // Et nytt kort legges sist; en ferdig gjennomgang fortsetter med det.
    expect(reconcilePass({ ids, index: 4, marked: [] }, [...without('c1'), card('c5')])).toEqual({
      ids: ['c2', 'c3', 'c4', 'c5'],
      index: 3,
      marked: [],
    });
  });

  it('merkede kort overlever avstemmingen, i gjennomgangens rekkefølge', () => {
    let pass = buildPass(sel, 'notes');
    pass = toggleMark(pass, 'c4');
    pass = toggleMark(pass, 'c2');
    pass = toggleMark(pass, 'c1');
    pass = toggleMark(pass, 'c1');
    expect(pass.marked).toEqual(['c2', 'c4']);
    expect(toggleMark(pass, 'c9')).toBe(pass);
    const out = reconcilePass(pass, [card('c2', { level: 3 }), card('c3'), card('c5')]);
    expect(out).toEqual({ ids: ['c2', 'c3', 'c5'], index: 0, marked: ['c2'] });
  });
});

describe('Lengde', () => {
  const sel = [card('c1'), card('c2', { level: 3 }), card('c3', { level: 2 }), card('c4'), card('c5'), card('c6', { level: 3 })];

  it('Mestring tar de første n som ikke er mestret', () => {
    expect(pickChunk(sel, 'notes', 3, 'mastery', []).ids).toEqual(['c1', 'c3', 'c4']);
    expect(pickChunk(sel, 'notes', 10, 'mastery', []).ids).toEqual(['c1', 'c3', 'c4', 'c5']);
    const mixed = pickChunk(sel, 'shuffle', 3, 'mastery', [], () => 0).ids;
    expect(mixed).toHaveLength(3);
    expect(mixed.every((id) => ['c1', 'c3', 'c4', 'c5'].includes(id))).toBe(true);
  });

  it('Rask runde tar de neste n som ikke er sett i omgangen, og begynner på nytt når alle er sett', () => {
    const first = pickChunk(sel, 'notes', 4, 'quick', []);
    expect(first).toEqual({ ids: ['c1', 'c2', 'c3', 'c4'], seen: ['c1', 'c2', 'c3', 'c4'] });
    const second = pickChunk(sel, 'notes', 4, 'quick', first.seen);
    expect(second).toEqual({ ids: ['c5', 'c6'], seen: ['c1', 'c2', 'c3', 'c4', 'c5', 'c6'] });
    const again = pickChunk(sel, 'notes', 4, 'quick', second.seen);
    expect(again).toEqual({ ids: ['c1', 'c2', 'c3', 'c4'], seen: ['c1', 'c2', 'c3', 'c4'] });
    // Slettede kort glemmes.
    expect(pickChunk(sel, 'notes', 2, 'quick', ['c9', 'c1']).seen).toEqual(['c1', 'c2', 'c3']);
  });
});

describe('lagret økt', () => {
  const old: PracticeState = {
    deckId: 'd',
    noteId: null,
    kind: null,
    order: 'notes',
    subset: ['c1'],
    queue: ['c1'],
    grades: {},
    answered: 2,
    correct: 1,
    streak: 1,
    updatedAt: 5,
  };

  it('en gammel økt uten form blir Mestring, og utvalget er en repetisjon', () => {
    const s = normalizePracticeState(old);
    expect(s).toEqual({ ...old, mode: 'mastery', length: null, done: [], seen: [], subsetKind: 'repeat' });
    expect(s.pass).toBeUndefined();
    expect(normalizePracticeState({ ...old, subset: null }).subsetKind).toBeUndefined();
  });

  it('beholder gyldige felt og retter ugyldige', () => {
    const pass = { ids: ['c1', 'c2'], index: 1, marked: ['c2'] };
    const quick: PracticeState = {
      ...old,
      mode: 'quick',
      length: 10,
      subsetKind: 'chunk',
      seen: ['c1'],
      done: ['c1'],
      pass,
      clozeSeed: 3,
    };
    expect(normalizePracticeState(quick)).toEqual(quick);
    const odd = { ...old, mode: 'flervalg', length: 15, pass: { ids: ['c1', 'c2'], index: 9, marked: ['c3', 'c1'] }, clozeSeed: 0.5 };
    const s = normalizePracticeState(odd as unknown as PracticeState);
    expect(s).toMatchObject({ mode: 'mastery', length: null, pass: { ids: ['c1', 'c2'], index: 2, marked: ['c1'] } });
    expect(s.clozeSeed).toBeUndefined();
  });
});
