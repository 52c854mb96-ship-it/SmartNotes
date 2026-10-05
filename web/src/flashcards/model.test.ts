import { describe, expect, it } from 'vitest';
import type { Flashcard } from '@smartnotes/shared';
import {
  MASTER,
  addActiveTime,
  buildQueue,
  correctPct,
  emptyRound,
  masteryPct,
  rate,
  reconcileQueue,
  repetitionChoices,
  schedule,
  selectCards,
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
