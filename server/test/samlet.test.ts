import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { assembleNoteDoc, compileLatex, errorExcerpt, sanitizeBody } from '../src/pipeline/latex.js';
import { getProfile, PROFILE_IDS, readPreamble } from '../src/profiles/index.js';

/**
 * `samlet` og `\uleselig` i formler kommer fra EXTRA_PREAMBLE og gjelder alle fag og alle modeller (også notater som
 * allerede er lagret, når en kapittel-PDF settes sammen). Testene kompilerer ekte dokumenter og leser teksten i PDF-en.
 */

const calc = (n: number) => String.raw`START-${n} Utregning:
\begin{align*}
E_k &= \tfrac12 m v^2 \\
&= \tfrac12 \cdot \qty{2,0}{kg} \cdot (\qty{3,0}{m/s})^2 \\
&= \qty{9,0}{J} \\
E_p &= m g h \\
&= \qty{9,0}{J}
\end{align*}
SLUTT-${n}`;

const longRows = Array.from({ length: 70 }, (_, i) => `x_{${i + 1}} &= ${i + 1} \\\\`).join('\n');

const BODY = String.raw`\section{Samlet}
Tekst før, med $\uleselig{v}^2$, $\uleselig{f}'(x)$, $\uleselig{v_0}$ og \uleselig{ord}, og i størrelser og formler:
\qty{\uleselig{9,81}}{m/s^2}, $g = \qty{9,8\uleselig{1}}{m/s^2}$, \num{\uleselig{3,0}}, \ce{\uleselig{SO4}^2-} og $\ce{SO\uleselig{4}^2-}$,
\ang{\uleselig{30}}, \qtyrange{\uleselig{1,5}}{3}{m}, \qty{\uleselig{[uleselig]}}{kg}, \uleselig{\qty{[uleselig]}{kg}}, $g = \qty{?}{m/s^2}$ og \num{\uleselig{[uleselig]}}.
\begin{figure}[H]\centering\begin{tikzpicture}\begin{axis}[axis lines=left, xmin=0, xmax=2.5, ymin=0, ymax=1, width=6cm, height=4cm, xtick={0,0.5,1,1.5,2,2.5}]\addplot[thick, domain=0:2.5, samples=100] {0.1*x^2};\end{axis}\end{tikzpicture}\caption{Graf}\end{figure}
\begin{samlet}
Kode i blokken: \verb|10 % 3| gir VERB-REST.
\begin{verbatim}
x = 10 % 3  # VERBATIM-REST
\end{verbatim}
\end{samlet}
\begin{eksempel}[Skråplan]
Boksfotnote\footnote{BOKS-FN-1.}
\begin{samlet}
Kreftene på klossen\footnote{SAMLET-FN-I-BOKS.}:
\begin{figure}[H]
\centering
\begin{tikzpicture}[>={Stealth}]
  \coordinate (A) at (0,0); \coordinate (B) at (4,0); \coordinate (C) at (4,2);
  \draw[thick] (A) -- (B) -- (C) -- cycle;
  \pic[draw, "$\alpha$", angle radius=8mm] {angle=B--A--C};
  \draw (A) -- node[above, sloped] {$s$} (C);
\end{tikzpicture}
\caption{Skråplan}
\end{figure}
\begin{align*} G_x &= mg\sin\alpha \end{align*}
\end{samlet}
Etter\footnote{BOKS-FN-3.}
\end{eksempel}
\begin{samlet}
En blokk med fotnote\footnote{FOTNOTE-I-SAMLET} og en figur:
\begin{figure}[H]\centering\begin{tikzpicture}\draw (0,0) rectangle (2,1);\end{tikzpicture}\caption{Første}\end{figure}
\end{samlet}
\begin{figure}[H]\centering\begin{tikzpicture}\draw (0,0) circle (0.5);\end{tikzpicture}\caption{Andre}\end{figure}
\begin{enumerate}
\item \begin{samlet}
LISTEPUNKT-EN
\begin{align*} a &= b \end{align*}
\end{samlet}
\item \begin{samlet}
LISTEPUNKT-TO:
\begin{center}SENTRERT\end{center}
\end{samlet}
\item VANLIG-PUNKT
\end{enumerate}
\begin{eksempel}[Ball]
\begin{samlet}
${calc(0)}
\end{samlet}
\end{eksempel}
${Array.from({ length: 12 }, (_, i) => `Tekst mellom blokkene.\n\\begin{samlet}\n${calc(i + 1)}\n\\end{samlet}`).join('\n\n')}

${Array.from({ length: 10 }, (_, i) => String.raw`Tekst før boksblokken.
\begin{samlet}
BSTART-${i} Formelen vi bruker:
\begin{formel}[Formel ${i}]
BOKS-${i}-A
\[ E_k = \tfrac12 m v^2 \]
BOKS-${i}-B
\[ E_p = m g h \]
BOKS-${i}-C
\end{formel}
BSLUTT-${i} Her er m massen.
\end{samlet}`).join('\n\n')}

\begin{samlet}
\section{Lang seksjon}
LANG-START
\begin{figure}[H]\centering\begin{tikzpicture}\draw (0,0) -- (1,0);\end{tikzpicture}\caption{Ytre}\end{figure}
\begin{samlet}
\begin{figure}[H]\centering\begin{tikzpicture}\draw (0,0) -- (0,1);\end{tikzpicture}\caption{Indre}\end{figure}
\end{samlet}
\begin{align*}
${longRows}
x &= \text{slutt}
\end{align*}
LANG-SLUTT
\end{samlet}
\begin{enumerate}
\item \begin{samlet}
LANG-I-LISTE
\begin{align*}
${longRows}
\end{align*}
\end{samlet}
\end{enumerate}
\begin{figure}[H]\centering\begin{tikzpicture}\draw (0,0) -- (1,1);\end{tikzpicture}\caption{Tredje}\end{figure}
`;

describe('samlet og \\uleselig', () => {
  for (const id of PROFILE_IDS) {
    it(`holder blokkene samlet uten å miste noe (${id})`, async () => {
      const doc = assembleNoteDoc({
        preamble: readPreamble(getProfile(id)),
        subjectName: 'Test',
        chapterLabel: 'Kapittel',
        sectionLabel: null,
        title: 'Samlet',
        dateIso: null,
        figureDir: 'fig',
        body: sanitizeBody(BODY),
      });
      const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'smartnotes-samlet-'));
      const res = await compileLatex(dir, doc.tex, 120_000);
      expect(res.ok, res.ok ? '' : res.log.slice(-2000)).toBe(true);
      const pages = execFileSync('pdftotext', ['-layout', path.join(dir, 'main.pdf'), '-'], { encoding: 'utf8' }).split('\f');
      const pageOf = (marker: string) => pages.findIndex((p) => p.includes(marker));
      // En kort blokk brytes aldri over to sider, heller ikke en boks inne i den (delene i riktig rekkefølge).
      for (let n = 0; n <= 12; n++) {
        expect(pageOf(`START-${n}`), `blokk ${n}`).toBeGreaterThanOrEqual(0);
        expect(pageOf(`SLUTT-${n}`), `blokk ${n}`).toBe(pageOf(`START-${n}`));
      }
      // En hel boks har samme høyde overalt; en boks som er delt og satt sammen igjen, får ekstra luft ved skjøten.
      const bbox = execFileSync('pdftotext', ['-bbox', path.join(dir, 'main.pdf'), '-'], { encoding: 'utf8' });
      const y = (word: string) => Number(new RegExp(`yMin="([\\d.]+)"[^>]*>${word}<`).exec(bbox)?.[1] ?? NaN);
      const heights = Array.from({ length: 10 }, (_, n) => {
        expect(pageOf(`BSLUTT-${n}`), `boksblokk ${n}`).toBe(pageOf(`BSTART-${n}`));
        return y(`BOKS-${n}-C`) - y(`BOKS-${n}-A`);
      });
      expect(Math.max(...heights) - Math.min(...heights), heights.join(', ')).toBeLessThan(1);
      // En blokk som er høyere enn en side, brytes som vanlig tekst og mister ingenting.
      const text = pages.join('\n');
      expect(pageOf('LANG-SLUTT')).toBeGreaterThan(pageOf('LANG-START'));
      for (let i = 1; i <= 70; i++) expect(text).toMatch(new RegExp(`x${i}\\s*=\\s*${i}\\b`));
      // Fotnoten i blokken står under den, tellerne telles én gang, og listenummeret står ved første linje.
      expect(text).toContain('FOTNOTE-I-SAMLET');
      // I en boks samler boksen fotnotene, også dem i blokken.
      expect(text).toMatch(/Etter[\s\S]*BOKS-FN-1\.[\s\S]*SAMLET-FN-I-BOKS\.[\s\S]*BOKS-FN-3\./);
      expect(text).toMatch(/Figur 1: Graf[\s\S]*Figur 2: Skråplan[\s\S]*Figur 3: Første[\s\S]*Figur 4: Andre[\s\S]*Figur 5: Ytre[\s\S]*Figur 6: Indre[\s\S]*Figur 7: Tredje/);
      // Aksene i grafer har desimalkomma.
      expect(text).toMatch(/0,5\s+1\s+1,5\s+2\s+2,5/);
      expect(text).toMatch(/1\.\s+LISTEPUNKT-EN/);
      expect(text).toMatch(/2\.\s+LISTEPUNKT-TO/);
      // Med samme innrykk som et vanlig listepunkt.
      const column = (marker: string) => {
        const line = text.split('\n').find((l) => l.includes(marker))!;
        return line.search(/\d\./);
      };
      expect(Math.abs(column('LISTEPUNKT-EN') - column('VANLIG-PUNKT'))).toBeLessThanOrEqual(1);
      expect(text).toMatch(/\d\.\s+LANG-I-LISTE/);
      // Ordrett tekst i en blokk, og ett bokmerke per overskrift.
      expect(text).toContain('10 % 3 gir VERB-REST');
      expect(text).toMatch(/x = 10 % 3\s+# VERBATIM-REST/);
      const aux = fs.readFileSync(path.join(dir, 'main.aux'), 'utf8');
      expect(aux.match(/Lang seksjon/g)?.length ?? 0).toBeLessThanOrEqual(2);
    }, 150_000);
  }

  for (const id of PROFILE_IDS) {
    it(`har vanlig linjeavstand når blokken begynner med en liste i en boks (${id})`, async () => {
      const box = (tag: string, wrap: boolean) => String.raw`\begin{losning}
INTRO-${tag} pq.
${wrap ? '\\begin{samlet}\n' : ''}\begin{itemize}
\item PUNKT-${tag} Pqgjy
\end{itemize}
${wrap ? '\\end{samlet}\n' : ''}\end{losning}`;
      const doc = assembleNoteDoc({
        preamble: readPreamble(getProfile(id)),
        subjectName: 'Test',
        chapterLabel: 'Kapittel',
        sectionLabel: null,
        title: 'Avstand',
        dateIso: null,
        figureDir: 'fig',
        body: sanitizeBody(`${box('A', false)}\n\n${box('B', true)}`),
      });
      const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'smartnotes-samlet-avstand-'));
      const res = await compileLatex(dir, doc.tex, 120_000);
      expect(res.ok, res.ok ? '' : res.log.slice(-2000)).toBe(true);
      const bbox = execFileSync('pdftotext', ['-bbox', path.join(dir, 'main.pdf'), '-'], { encoding: 'utf8' });
      const y = (word: string) => Number(new RegExp(`yMin="([\\d.]+)"[^>]*>${word}<`).exec(bbox)![1]);
      const gap = (tag: string) => y(`PUNKT-${tag}`) - y(`INTRO-${tag}`);
      expect(Math.abs(gap('B') - gap('A'))).toBeLessThan(0.5);
    }, 150_000);
  }

  it('viser hele blokken i utdraget når LaTeX melder feilen på \\end{samlet}', () => {
    const body = ['Før.', '\\begin{samlet}', 'a', 'b', 'c', 'd', 'e', 'FEILLINJE', 'f', 'g', 'h', '\\end{samlet}', 'Etter.'].join('\n');
    const excerpt = errorExcerpt(body, [{ line: 12, message: 'Undefined control sequence.', context: '' }], 1);
    expect(excerpt).toContain('FEILLINJE');
    expect(excerpt).toContain('\\begin{samlet}');
    // Andre feil får det vanlige, korte utdraget.
    expect(errorExcerpt(body, [{ line: 3, message: 'x', context: '' }], 1)).not.toContain('FEILLINJE');
  });
});
