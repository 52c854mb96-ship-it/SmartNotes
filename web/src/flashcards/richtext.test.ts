import { describe, expect, it } from 'vitest';
import { backToText, paragraphs, parseBackLine, parseInline, plainText, textToBack } from './richtext';

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
