import { describe, expect, it } from 'vitest';
import {
  backToText,
  clozeCandidates,
  clozeOf,
  matchesTerm,
  paragraphs,
  parseBackLine,
  parseInline,
  plainText,
  termMatch,
  textToBack,
} from './richtext';

describe('markering i kortene', () => {
  it('fet skrift og formler', () => {
    expect(parseInline('**Akselerasjon** er $a = \\frac{\\Delta v}{\\Delta t}$.')).toEqual([
      { type: 'text', text: 'Akselerasjon', bold: true },
      { type: 'text', text: ' er ', bold: false },
      { type: 'math', tex: 'a = \\frac{\\Delta v}{\\Delta t}', bold: false, display: false },
      { type: 'text', text: '.', bold: false },
    ]);
  });

  it('formel inne i fet tekst og kjemi med \\ce', () => {
    expect(parseInline('**Vann $\\ce{H2O}$**')).toEqual([
      { type: 'text', text: 'Vann ', bold: true },
      { type: 'math', tex: '\\ce{H2O}', bold: true, display: false },
    ]);
  });

  it('dollartegn uten partner, escapet dollar og ** uten partner er vanlig tekst', () => {
    expect(parseInline('Det koster 5 $ og 3 \\$')).toEqual([{ type: 'text', text: 'Det koster 5 $ og 3 $', bold: false }]);
    expect(parseInline('2 ** 3')).toEqual([{ type: 'text', text: '2 ** 3', bold: false }]);
    expect(parseInline('$ $')).toEqual([{ type: 'text', text: '$ $', bold: false }]);
  });

  it('formel som egen linje med $$', () => {
    expect(parseInline('$$E = mc^2$$')).toEqual([{ type: 'math', tex: 'E = mc^2', bold: false, display: true }]);
  });

  it('svarlinjer, avsnitt og redigering', () => {
    expect(parseBackLine('!Fremgangsmåte')).toEqual({ label: true, text: 'Fremgangsmåte' });
    expect(parseBackLine(' Punkt ')).toEqual({ label: false, text: 'Punkt' });
    expect(paragraphs('Første.\n\n  \nAndre\nlinje.\n')).toEqual(['Første.', 'Andre\nlinje.']);
    expect(textToBack(' a \n\n!\n b')).toEqual(['a', 'b']);
    expect(backToText(['a', 'b'])).toBe('a\nb');
    expect(plainText('**Fart** $v$')).toBe('Fart v');
  });
});

describe('luker', () => {
  const card = (back: string[], front = 'Hva sier Newtons andre lov?', id = 'k1') => ({ id, front, back });

  it('et fett begrep blir en luke', () => {
    expect(clozeOf(card(['Summen av kreftene er lik massen ganger **akselerasjonen**']), 0)).toEqual({
      line: 0,
      part: 1,
      term: 'akselerasjonen',
    });
  });

  it('flere fete ord: fast luke for samme runde, en annen neste runde', () => {
    const c = card(['**Fart** er hvor fort noe beveger seg.', 'Den måles i **meter per sekund**.'], 'Hva beskriver hvor raskt noe går?');
    expect(clozeCandidates(c).map((x) => x.term)).toEqual(['Fart', 'meter per sekund']);
    for (const seed of [0, 1, 7, -3]) {
      expect(clozeOf(c, seed)).toEqual(clozeOf({ ...c }, seed));
      expect(clozeOf(c, seed + 1)!.term).not.toBe(clozeOf(c, seed)!.term);
    }
  });

  it('fet tekst i $…$, inntil en formel eller med formeltegn blir ikke luke', () => {
    expect(clozeOf(card(['**$F = m \\cdot a$**']), 0)).toBeNull();
    expect(clozeOf(card(['**Vann $\\ce{H2O}$** er et løsemiddel']), 0)).toBeNull();
    expect(clozeOf(card(['**F = ma**']), 0)).toBeNull();
    expect(clozeOf(card(['Formel: $F = m \\cdot a$', 'Kalles **kraftloven**']), 0)?.term).toBe('kraftloven');
  });

  it('hopper over «!»-linjer', () => {
    expect(clozeOf(card(['!**Definisjon**', 'Noe annet']), 0)).toBeNull();
    // Kort 2 fra falsk Claude: én luke.
    const fake = card(
      ['!Tre punkter', 'Første punkt', 'Andre punkt med **nøkkelbegrep**', 'Tredje punkt med $v = \\frac{s}{t}$'],
      'Forklar hovedideen i «Newtons lover».',
    );
    expect(clozeOf(fake, 4)).toEqual({ line: 2, part: 1, term: 'nøkkelbegrep' });
  });

  it('et begrep som står i spørsmålet eller et annet sted i svaret, blir ikke luke', () => {
    // Kort 1 fra falsk Claude: notattittelen er fet og står i spørsmålet.
    expect(clozeOf(card(['**Newtons lover**', 'Formel: $F = m \\cdot a$'], 'Hva handler notatet «Newtons lover» om?'), 0)).toBeNull();
    expect(clozeOf(card(['**Fart** er strekning delt på tid'], 'Hvordan finner du farten?'), 0)).toBeNull();
    expect(clozeOf(card(['**Fotosyntese** lager sukker', 'Fotosyntesen skjer i kloroplastene'], 'Hva gjør plantene?'), 0)).toBeNull();
  });

  it('to motsatte begreper i samme kort: det ene som står synlig, godtas ikke i luka for det andre', () => {
    const c = card(['**Elastisk** støt: den kinetiske energien er bevart', '**Uelastisk** støt: noe går over til varme'], 'Hva skiller støtene?');
    expect(clozeCandidates(c).map((x) => x.term)).toEqual(['Elastisk', 'Uelastisk']);
    expect(matchesTerm('elastisk', 'Uelastisk')).toBe(false);
    expect(matchesTerm('uelastisk', 'Elastisk')).toBe(false);
  });

  it('fraser på mer enn tre ord og kort uten fet tekst blir ikke luke', () => {
    expect(clozeOf(card(['Det er **summen av alle kreftene**']), 0)).toBeNull();
    expect(clozeOf(card(['Det er **summen av kreftene**']), 0)?.term).toBe('summen av kreftene');
    expect(clozeOf(card(['Bare vanlig tekst', '$a = 2$']), 0)).toBeNull();
    expect(clozeOf(card([]), 0)).toBeNull();
    expect(clozeOf(card(['** **', '**42**']), 0)).toBeNull();
  });
});

describe('retting av luka', () => {
  it('store og små bokstaver, mellomrom og tegnsetting spiller ingen rolle', () => {
    expect(matchesTerm('  Akselerasjon. ', 'akselerasjon')).toBe(true);
    expect(matchesTerm('nøkkel begrep', 'nøkkelbegrep')).toBe(true);
    expect(matchesTerm('nøkkel-begrep', 'nøkkelbegrep')).toBe(true);
    expect(matchesTerm('Meter  per sekund!', 'meter per sekund')).toBe(true);
    expect(matchesTerm('meterpersekund', 'meter per sekund')).toBe(true);
    expect(matchesTerm('idé', 'ide')).toBe(true);
  });

  it('vanlige endelser godtas', () => {
    expect(matchesTerm('akselerasjonen', 'akselerasjon')).toBe(true);
    expect(matchesTerm('akselerasjon', 'akselerasjonen')).toBe(true);
    expect(matchesTerm('cellene', 'celle')).toBe(true);
    expect(matchesTerm('atomer', 'atomet')).toBe(true);
    expect(matchesTerm('pulsen', 'puls')).toBe(true);
    expect(matchesTerm('farten', 'fart')).toBe(true);
    expect(matchesTerm('Newtons første lov', 'Newton første lov')).toBe(true);
    // Dobbel konsonant og -el-ord, begge veier.
    for (const [x, y] of [
      ['strømmen', 'strøm'],
      ['strømmer', 'strøm'],
      ['summen', 'sum'],
      ['rommet', 'rom'],
      ['partikler', 'partikkel'],
      ['reduksjonsmidler', 'reduksjonsmiddel'],
      ['sykler', 'sykkel'],
      ['modellen', 'modeller'],
      ['modell', 'modellen'],
    ]) {
      expect(matchesTerm(x!, y!), `${x} for ${y}`).toBe(true);
      expect(matchesTerm(y!, x!), `${y} for ${x}`).toBe(true);
    }
    expect(matchesTerm('kraften', 'kreft')).toBe(false);
    expect(matchesTerm('kreft', 'kraften')).toBe(false);
    expect(matchesTerm('sump', 'sum')).toBe(false);
  });

  it('enheter med hevet og senket skrift kan skrives med vanlige tall', () => {
    expect(matchesTerm('m/s2', 'm/s²')).toBe(true);
    expect(matchesTerm('m/s^2', 'm/s²')).toBe(true);
    expect(matchesTerm('CO2', 'CO₂')).toBe(true);
    expect(matchesTerm('m/s', 'm/s²')).toBe(false);
  });

  it('én skrivefeil i ord på seks bokstaver eller mer', () => {
    expect(matchesTerm('akselerasjn', 'akselerasjon')).toBe(true);
    expect(matchesTerm('aksellerasjon', 'akselerasjon')).toBe(true);
    expect(matchesTerm('akselerajson', 'akselerasjon')).toBe(true);
    expect(matchesTerm('akselerasjnen', 'akselerasjon')).toBe(true);
    expect(matchesTerm('enrgi', 'energi')).toBe(true);
    expect(matchesTerm('akslerasjn', 'akselerasjon')).toBe(false);
    expect(matchesTerm('fard', 'fart')).toBe(false);
    expect(matchesTerm('nasse', 'masse')).toBe(false);
  });

  it('motsatte og ulike fagord godtas ikke som skrivefeil', () => {
    for (const [x, y] of [
      ['elastisk', 'uelastisk'],
      ['polare', 'upolare'],
      ['mettet', 'umettet'],
      ['løselig', 'uløselig'],
      ['organisk', 'uorganisk'],
      ['metanol', 'etanol'],
      ['fenotype', 'genotype'],
      ['fisjon', 'fusjon'],
      ['alkaner', 'alkener'],
      ['alkan', 'alken'],
      ['propan', 'propen'],
    ]) {
      expect(matchesTerm(x!, y!), `${x} for ${y}`).toBe(false);
      expect(matchesTerm(y!, x!), `${y} for ${x}`).toBe(false);
    }
    expect(matchesTerm('alkan', 'alkener')).toBe(false);
    expect(matchesTerm('elastiske', 'uelastisk')).toBe(false);
  });

  it('et treff med skrivefeil skilles fra et likt svar, så fasiten kan vises', () => {
    expect(termMatch('Akselerasjonen', 'akselerasjon')).toBe('exact');
    expect(termMatch('meterpersekund', 'meter per sekund')).toBe('exact');
    expect(termMatch('akselerasjn', 'akselerasjon')).toBe('typo');
    expect(termMatch('Newtons førse lov', 'Newtons første lov')).toBe('typo');
    // Par ingen bokstavregel skiller: godtatt, men med fasiten ved siden av.
    expect(termMatch('kromatin', 'kromatid')).toBe('typo');
    expect(termMatch('fusjon', 'fisjon')).toBeNull();
  });

  it('feil ord og tomt svar godtas ikke', () => {
    expect(matchesTerm('fart', 'akselerasjon')).toBe(false);
    expect(matchesTerm('første lov', 'Newtons første lov')).toBe(false);
    expect(matchesTerm('', 'fart')).toBe(false);
    expect(matchesTerm(' .. ', 'fart')).toBe(false);
  });

  it('æ, ø og å virker og er egne bokstaver', () => {
    expect(matchesTerm('NØKKELBEGREP', 'nøkkelbegrep')).toBe(true);
    expect(matchesTerm('Øyets linse', 'øyets linse')).toBe(true);
    expect(matchesTerm('ærfugl', 'Ærfugl')).toBe(true);
    expect(matchesTerm('årsak', 'årsak')).toBe(true);
    expect(matchesTerm('måne', 'mane')).toBe(false);
    expect(matchesTerm('bolge', 'bølge')).toBe(false);
    expect(matchesTerm('arsak', 'årsak')).toBe(false);
    expect(matchesTerm('bølgelengden', 'bølgelengde')).toBe(true);
  });
});
