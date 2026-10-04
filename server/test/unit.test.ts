import { describe, expect, it } from 'vitest';
import { buildContext } from '../src/pipeline/claude.js';
import { cropFigure, fitScale, sniffKind } from '../src/pipeline/images.js';
import {
  assembleNoteDoc,
  errorExcerpt,
  escapeLatex,
  formatDateNo,
  parseLatexErrors,
  referencedFigures,
  replaceMissingFigures,
  sanitizeBody,
} from '../src/pipeline/latex.js';
import { parseConversion, parseMeta } from '../src/pipeline/parse.js';
import { physicsProfile } from '../src/profiles/physics.js';
import { parseTocText } from '../src/toc.js';

describe('escapeLatex', () => {
  it('escaper spesialtegn', () => {
    expect(escapeLatex('50% av $ & #1 a_b {x} ~ ^')).toBe(
      '50\\% av \\$ \\& \\#1 a\\_b \\{x\\} \\textasciitilde{} \\textasciicircum{}',
    );
    expect(escapeLatex('C:\\fil')).toBe('C:\\textbackslash{}fil');
  });
  it('formaterer norske datoer', () => {
    expect(formatDateNo('2026-09-12')).toBe('12. september 2026');
    expect(formatDateNo(null)).toBe('');
    expect(formatDateNo('tull')).toBe('');
  });
});

describe('sanitizeBody', () => {
  it('fjerner kodeblokker og dokumentrammer', () => {
    const raw = '```latex\n\\documentclass{article}\n\\begin{document}\nHei $x$\n\\end{document}\n```';
    expect(sanitizeBody(raw)).toBe('Hei $x$\n');
  });
  it('nøytraliserer farlige kommandoer, men ikke includegraphics', () => {
    const out = sanitizeBody('\\input{/etc/passwd}\n\\immediate\\write18{rm -rf /}\n\\includegraphics{fig1}\n\\usepackage{x}');
    expect(out).not.toMatch(/\\input\{/);
    expect(out).not.toMatch(/\\write18/);
    expect(out).not.toMatch(/\\usepackage/);
    expect(out).toContain('\\includegraphics{fig1}');
    expect(out).toContain('\\snfjernet{input}');
  });
});

describe('figurer', () => {
  it('finner og erstatter manglende figurer', () => {
    const body = 'A\n\\originalfigur[0.5]{fig1}{Skisse}\nB\n\\originalfigur{fig2}{}\n';
    expect(referencedFigures(body)).toEqual(['fig1', 'fig2']);
    const out = replaceMissingFigures(body, new Set(['fig1']));
    expect(out).toContain('\\originalfigur[0.5]{fig1}{Skisse}');
    expect(out).toContain('\\manglerfigur{fig2}');
  });
});

describe('parseConversion', () => {
  it('leser metadata og latex', () => {
    const text = `<metadata>
{"title":"Newtons lover","chapter":"k3","new_chapter":null,"date":"2026-09-12",
 "figures":[{"id":"fig1","page":1,"box":[10,20,300,400]},{"id":"bad id","page":1,"box":[1,2,3,4]}],
 "remarks":["Ett ord var uleselig."]}
</metadata>
<latex>
\\section{Hei}
$F = ma$
</latex>`;
    const { meta, body } = parseConversion(text);
    expect(meta.title).toBe('Newtons lover');
    expect(meta.chapter).toBe('k3');
    expect(meta.date).toBe('2026-09-12');
    expect(meta.figures).toEqual([{ id: 'fig1', page: 1, box: [10, 20, 300, 400] }]);
    expect(meta.remarks).toEqual(['Ett ord var uleselig.']);
    expect(body).toBe('\\section{Hei}\n$F = ma$');
  });
  it('tåler ugyldig JSON og ugyldig dato', () => {
    expect(parseMeta('{tull').title).toBeNull();
    expect(parseMeta('{"date":"2026-02-30","new_chapter":{"number":3,"title":"Energi"}}')).toMatchObject({
      date: null,
      newChapter: { number: '3', title: 'Energi' },
    });
  });
  it('kaster ved avkortet svar', () => {
    expect(() => parseConversion('<metadata>{}</metadata><latex>\\section{x}')).toThrow(/avkortet/);
  });
});

describe('LaTeX-feil', () => {
  it('leser feil med linjenummer og lager utdrag relativt til kroppen', () => {
    const log = './main.tex:105: Undefined control sequence.\nl.105 \\foo\n             \n';
    const errors = parseLatexErrors(log);
    expect(errors[0]).toMatchObject({ line: 105, message: 'Undefined control sequence.' });
    const body = Array.from({ length: 10 }, (_, i) => `linje ${i + 1}`).join('\n');
    const excerpt = errorExcerpt(body, errors, 100);
    expect(excerpt).toContain('Feil på linje 6');
    expect(excerpt).toContain('   6 > linje 6');
  });
  it('kroppen starter på oppgitt linje', () => {
    const doc = assembleNoteDoc({
      preamble: 'P1\nP2',
      subjectName: 'Fysikk',
      chapterLabel: 'Kap. 1 – Måling',
      title: 'Test & sånt',
      dateIso: '2026-01-02',
      figureDir: 'fig',
      body: 'KROPP',
    });
    expect(doc.tex.split('\n')[doc.bodyStartLine - 1]).toBe('KROPP');
    expect(doc.tex).toContain('\\notehode{Test \\& sånt}');
    expect(doc.tex).toContain('2. januar 2026');
  });
});

describe('innholdsfortegnelse', () => {
  it('tolker vanlige formater', () => {
    const text = `Innhold
1 Fysikk og måling ........ 9
Kapittel 2: Bevegelse
3.2 Krefter 45
Kap. 4 – Energi    78
• Register
`;
    expect(parseTocText(text)).toEqual([
      { number: null, title: 'Innhold' },
      { number: '1', title: 'Fysikk og måling' },
      { number: '2', title: 'Bevegelse' },
      { number: '3.2', title: 'Krefter' },
      { number: '4', title: 'Energi' },
      { number: null, title: 'Register' },
    ]);
  });
});

describe('bilder', () => {
  it('gjenkjenner filtyper', () => {
    expect(sniffKind(Buffer.from('%PDF-1.7'))).toBe('pdf');
    expect(sniffKind(Buffer.from([0xff, 0xd8, 0xff, 0xe0]))).toBe('jpeg');
    expect(sniffKind(Buffer.from('hello world!'))).toBeNull();
  });
  it('holder bilder innenfor grensene til Claude', () => {
    const s = fitScale(4032, 3024);
    expect(Math.round(4032 * s)).toBeLessThanOrEqual(2576);
    expect(Math.round(4032 * s) * Math.round(3024 * s)).toBeLessThanOrEqual(3_750_000);
    expect(fitScale(800, 600)).toBe(1);
  });
  it('avviser ugyldige figurbokser', async () => {
    expect(await cropFigure('/finnes/ikke.jpg', { width: 100, height: 100 }, [5, 5, 6, 6], '/tmp/x.png')).toBe(false);
  });
});

describe('forespørsel til Claude', () => {
  it('lister kapitler med alias', () => {
    const ctx = buildContext({
      profile: physicsProfile,
      subjectName: 'Fysikk',
      textbook: 'Ergo Fysikk 1',
      chapters: [
        { alias: 'k1', number: '1', title: 'Fysikk og måling' },
        { alias: 'k2', number: '2', title: 'Bevegelse' },
      ],
      fixedChapter: null,
      userTitle: null,
      userDate: null,
      instructions: 'Side 2 er en fortsettelse',
      today: '2026-10-04',
      pages: [],
    });
    expect(ctx).toContain('k2: 2 Bevegelse');
    expect(ctx).toContain('Lærebok/emne: Ergo Fysikk 1');
    expect(ctx).toContain('Ekstra instruksjoner fra brukeren: Side 2 er en fortsettelse');
  });
  it('systeminstruksen er stabil (ingen dato) for prompt-caching', () => {
    expect(physicsProfile.systemPrompt).not.toMatch(/\d{4}-\d{2}-\d{2}/);
    expect(physicsProfile.systemPrompt.length).toBeGreaterThan(4000);
  });
});
