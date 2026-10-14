/**
 * Redigeringen i appen (web/src/flashcards/choices.ts) sjekker svaralternativene før kortet sendes. Reglene og meldingene
 * må være serverens (`choicesProblem`, `normalizeChoice` og `choiceText` i routes/flashcards.ts), ellers kunne eleven få
 * en annen feil fra serveren enn den appen viser, eller ingen feil i appen for et kort serveren avviser.
 */
import { describe, expect, it } from 'vitest';
import { MAX_CHOICE_CHARS, WRONG_CHOICES, choicesProblem, normalizeChoice } from '../src/flashcards/prompt.js';
import * as web from '../../web/src/flashcards/choices.js';

/** Som `choiceText` i rutene: ett mellomrom mellom ordene, uten mellomrom i endene. */
const line = (s: string) => s.replace(/\s+/g, ' ').trim();

describe('svaralternativene i appen følger serverens regler', () => {
  it('de samme grensene og den samme normaliseringen', () => {
    expect(web.MAX_CHOICE_CHARS).toBe(MAX_CHOICE_CHARS);
    expect(web.WRONG_CHOICES).toBe(WRONG_CHOICES);
    for (const s of [
      ' **2,0 m/s** . ', 'Ja!!', 'é', 'mJ', 'MJ', '$F = m \\cdot a$', ' . ', '**', 'a\n b', '1.5.',
      '$6{,}0\\ \\text{N}$', '$6{,}0\\,\\text{N}$', '$6{,}0~\\text{N}$', '$6{,}0\\quad\\mathrm{N}$', '6,0 N', '$ $', '$\\,$', 'Koster \\$5', '$\\ce{CO}$',
    ]) {
      expect(web.normalizeChoice(s)).toBe(normalizeChoice(s));
    }
  });

  it('den samme meldingen (eller ingen) for hvert sett som ikke er tomt', () => {
    const long = 'x'.repeat(MAX_CHOICE_CHARS + 1);
    const cases: [string, string[]][] = [
      ['Newton', ['Joule', 'Watt', 'Pascal']],
      ['', ['Joule', 'Watt', 'Pascal']],
      ['**', ['Joule', 'Watt', 'Pascal']],
      ['Newton', ['', 'Watt', 'Pascal']],
      ['Newton', ['Joule', 'Watt', ' ! ']],
      ['Newton', ['Joule', '', '']],
      [long, ['a', 'b', 'c']],
      ['a', ['b', long, 'c']],
      [`${'x'.repeat(MAX_CHOICE_CHARS - 1)}    y`, ['a', 'b', 'c']],
      ['2,0 m/s', ['3,0 m/s', '2,0m/s.', '4,0 m/s']],
      ['**Fart**', ['Fart!', 'Akselerasjon', 'Strekning']],
      ['Newton', ['Joule', 'Watt', 'Jo ule']],
      ['2,0 mJ', ['2,0 MJ', '2,0 kJ', '2,0 J']],
      ['CO', ['Co', 'CO2', 'C']],
      ['a\nb', ['c\n\nd', 'e', 'f']],
      // Det samme svaret med et annet LaTeX-mellomrom, og en formel uten innhold.
      ['$6{,}0\\ \\text{N}$', ['$6{,}0\\,\\text{N}$', 'b', 'c']],
      ['$6{,}0\\ \\text{N}$', ['$5{,}0\\ \\text{N}$', '$1{,}5\\ \\text{N}$', '$6{,}0\\ \\text{kg}$']],
      ['a', ['$ $', 'b', 'c']],
      ['$\\,$', ['a', 'b', 'c']],
    ];
    for (const [correct, wrong] of cases) {
      const server = choicesProblem({ correct: line(correct), wrong: wrong.map(line) });
      const app = web.readChoiceFields({ correct, wrong });
      expect(app.ok ? null : app.error, JSON.stringify([correct, wrong])).toBe(server);
      if (app.ok) expect(app.choices).toEqual({ correct: line(correct), wrong: wrong.map(line) });
    }
  });

  it('meldingene for samme svar med et annet LaTeX-mellomrom og for en tom formel', () => {
    expect(web.readChoiceFields({ correct: '$6{,}0\\ \\text{N}$', wrong: ['$6{,}0\\,\\text{N}$', 'b', 'c'] })).toEqual({
      ok: false,
      error: 'Et galt svar kan ikke være likt det riktige svaret.',
      field: 0,
    });
    expect(web.readChoiceFields({ correct: 'a', wrong: ['b', '$ $', 'c'] })).toMatchObject({ ok: false, field: 1 });
  });

  it('tomme felt i appen betyr ingen alternativer (null), som serveren godtar', () => {
    expect(web.readChoiceFields({ correct: ' ', wrong: ['', '\n', ''] })).toEqual({ ok: true, choices: null });
  });
});
