import { describe, expect, it } from 'vitest';
import { MAX_CHOICE_CHARS, choiceFieldsOf, choiceLine, choicesChanged, normalizeChoice, readChoiceFields, type ChoiceFields } from './choices';

const fields = (correct: string, ...wrong: string[]): ChoiceFields => ({ correct, wrong: [...wrong, '', '', ''].slice(0, 3) });

describe('svaralternativer i redigeringen', () => {
  it('alle feltene tomme (også bare mellomrom) gir ingen alternativer', () => {
    expect(readChoiceFields(fields(''))).toEqual({ ok: true, choices: null });
    expect(readChoiceFields(fields('  ', '\n', ' \t '))).toEqual({ ok: true, choices: null });
  });

  it('gyldige alternativer kommer tilbake på én linje, ellers som eleven skrev dem', () => {
    expect(readChoiceFields(fields('  $6{,}0\\ \\text{N}$ ', '$5{,}0\\ \\text{N}$', 'Massen\nganger  farten', '**Treghet**'))).toEqual({
      ok: true,
      choices: { correct: '$6{,}0\\ \\text{N}$', wrong: ['$5{,}0\\ \\text{N}$', 'Massen ganger farten', '**Treghet**'] },
    });
  });

  it('det riktige svaret mangler', () => {
    const error = 'Skriv det riktige svaret kort, eller la alle feltene for svaralternativer stå tomme.';
    expect(readChoiceFields(fields('', 'a', 'b', 'c'))).toEqual({ ok: false, error, field: 'correct' });
    // Bare markering eller tegnsetting til slutt er også tomt.
    expect(readChoiceFields(fields('**', 'a', 'b', 'c'))).toMatchObject({ ok: false, field: 'correct' });
    expect(readChoiceFields(fields(' . ', 'a', 'b', 'c'))).toMatchObject({ ok: false, field: 'correct' });
  });

  it('færre enn tre gale svar peker på det første tomme feltet', () => {
    const error = 'Skriv tre gale svar, eller la alle feltene for svaralternativer stå tomme.';
    expect(readChoiceFields(fields('Newton'))).toEqual({ ok: false, error, field: 0 });
    expect(readChoiceFields(fields('Newton', 'Joule', '', 'Watt'))).toEqual({ ok: false, error, field: 1 });
    expect(readChoiceFields(fields('Newton', 'Joule', 'Watt', '!'))).toEqual({ ok: false, error, field: 2 });
    // Gale svar uten riktig svar: det riktige mangler først.
    expect(readChoiceFields(fields('', 'Joule'))).toMatchObject({ ok: false, field: 'correct' });
  });

  it(`høyst ${MAX_CHOICE_CHARS} tegn per alternativ, regnet på én linje`, () => {
    const long = 'x'.repeat(MAX_CHOICE_CHARS + 1);
    const error = `Et svaralternativ kan ha høyst ${MAX_CHOICE_CHARS} tegn.`;
    expect(readChoiceFields(fields(long, 'a', 'b', 'c'))).toEqual({ ok: false, error, field: 'correct' });
    expect(readChoiceFields(fields('a', 'b', 'c', long))).toEqual({ ok: false, error, field: 2 });
    const ok = 'x'.repeat(MAX_CHOICE_CHARS);
    expect(readChoiceFields(fields(` ${ok}  `, 'a', 'b', 'c')).ok).toBe(true);
    // Mellomrom som slås sammen, teller ikke.
    expect(readChoiceFields(fields(`${'x'.repeat(MAX_CHOICE_CHARS - 1)}    y`, 'a', 'b', 'c')).ok).toBe(false);
    expect(readChoiceFields(fields(`${'x'.repeat(MAX_CHOICE_CHARS - 2)}    y`, 'a', 'b', 'c')).ok).toBe(true);
  });

  it('et galt svar likt det riktige etter normalisering', () => {
    const error = 'Et galt svar kan ikke være likt det riktige svaret.';
    expect(readChoiceFields(fields('2,0 m/s', '3,0 m/s', '2,0m/s.', '4,0 m/s'))).toEqual({ ok: false, error, field: 1 });
    expect(readChoiceFields(fields('**Fart**', 'Fart!', 'Akselerasjon', 'Strekning'))).toEqual({ ok: false, error, field: 0 });
  });

  it('de gale svarene må være ulike, men store og små bokstaver teller', () => {
    const error = 'De tre gale svarene må være ulike.';
    expect(readChoiceFields(fields('Newton', 'Joule', 'Watt', 'Jo ule'))).toEqual({ ok: false, error, field: 2 });
    expect(readChoiceFields(fields('2,0 mJ', '2,0 MJ', '2,0 kJ', '2,0 J')).ok).toBe(true);
    expect(readChoiceFields(fields('CO', 'Co', 'CO2', 'C')).ok).toBe(true);
  });

  it('feltene for et kort: alternativene det har, eller tomme', () => {
    expect(choiceFieldsOf(null)).toEqual({ correct: '', wrong: ['', '', ''] });
    expect(choiceFieldsOf(undefined)).toEqual({ correct: '', wrong: ['', '', ''] });
    expect(choiceFieldsOf({ correct: 'a', wrong: ['b', 'c', 'd'] })).toEqual({ correct: 'a', wrong: ['b', 'c', 'd'] });
    // Lest tilbake gir det samme settet.
    expect(readChoiceFields(choiceFieldsOf({ correct: 'a', wrong: ['b', 'c', 'd'] }))).toEqual({
      ok: true,
      choices: { correct: 'a', wrong: ['b', 'c', 'd'] },
    });
  });

  it('normaliseringen er serverens: uten mellomrom, fet skrift og punktum eller utropstegn til slutt', () => {
    expect(normalizeChoice(' **2,0 m/s** . ')).toBe('2,0m/s');
    expect(normalizeChoice('Ja!!')).toBe('Ja');
    expect(normalizeChoice('é')).toBe('é');
    expect(normalizeChoice('mJ')).not.toBe(normalizeChoice('MJ'));
    expect(choiceLine(' a \n  b\t')).toBe('a b');
  });
  it('samme svar med et annet LaTeX-mellomrom er likt, og en formel uten innhold er tom', () => {
    expect(readChoiceFields(fields('$6{,}0\\ \\text{N}$', '$6{,}0\\,\\text{N}$', 'b', 'c'))).toEqual({
      ok: false,
      error: 'Et galt svar kan ikke være likt det riktige svaret.',
      field: 0,
    });
    expect(readChoiceFields(fields('$ $', 'a', 'b', 'c'))).toMatchObject({ ok: false, field: 'correct' });
    expect(normalizeChoice('$6{,}0~\\mathrm{N}$')).toBe(normalizeChoice('6,0 N'));
  });

  it('ved redigering sendes alternativene bare når eleven har endret dem', () => {
    const choices = { correct: 'Newton', wrong: ['Joule', 'Watt', 'Pascal'] };
    // Urørte felt: tomme på et kort uten, eller de samme på et kort med (mellomrom i endene teller ikke).
    expect(choicesChanged(null, choiceFieldsOf(null))).toBe(false);
    expect(choicesChanged(undefined, fields(' ', '', '\n'))).toBe(false);
    expect(choicesChanged(choices, choiceFieldsOf(choices))).toBe(false);
    expect(choicesChanged(choices, fields(' Newton ', 'Joule', 'Watt  ', 'Pascal'))).toBe(false);
    // Tømte, skrevne eller endrede felt.
    expect(choicesChanged(choices, choiceFieldsOf(null))).toBe(true);
    expect(choicesChanged(null, fields('Newton', 'Joule', 'Watt', 'Pascal'))).toBe(true);
    expect(choicesChanged(choices, fields('Newton', 'Joule', 'Watt', 'Bar'))).toBe(true);
  });
});
