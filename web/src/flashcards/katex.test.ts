import katex from 'katex';
import 'katex/contrib/mhchem';
import { describe, expect, it } from 'vitest';
import { renderTex } from './katex';

describe('formler på kortene', () => {
  it('forstår makroene fra notatmalene', () => {
    for (const tex of ['\\dv{v}{t}', '\\vb{F}', '\\abs{x}', '\\enhet{m/s}', '\\qty{9.81}{m/s^2}']) {
      expect(renderTex(katex, tex, false), tex).not.toContain('katex-error');
    }
  });

  it('kjemi med mhchem', () => {
    expect(renderTex(katex, '\\ce{2H2 + O2 -> 2H2O}', false)).toContain('katex');
  });

  it('feil som KaTeX kaster, vises som tekst i stedet for å krasje appen', () => {
    const html = renderTex(katex, '\\ce{CH2 \\bond{} CH2}<b>', false);
    expect(html).toContain('katex-error');
    expect(html).not.toContain('<b>');
  });

  it('slipper ikke gjennom lenker eller HTML', () => {
    expect(renderTex(katex, '\\href{javascript:alert(1)}{x}', false)).not.toMatch(/href=/);
  });
});
