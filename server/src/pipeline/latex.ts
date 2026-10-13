import { spawn } from 'node:child_process';
import fsp from 'node:fs/promises';
import path from 'node:path';

// ---------- Tekst → LaTeX ----------

const LATEX_SPECIALS: Record<string, string> = {
  '\\': '\\textbackslash{}',
  '{': '\\{',
  '}': '\\}',
  $: '\\$',
  '&': '\\&',
  '#': '\\#',
  '^': '\\textasciicircum{}',
  _: '\\_',
  '%': '\\%',
  '~': '\\textasciitilde{}',
};

/** Escaper vanlig tekst (titler, fagnavn) slik at den kan settes rett inn i LaTeX. */
export function escapeLatex(text: string): string {
  return text.replace(/[\\{}$&#^_%~]/g, (c) => LATEX_SPECIALS[c]!).replace(/\s+/g, ' ').trim();
}

const MONTHS = ['januar', 'februar', 'mars', 'april', 'mai', 'juni', 'juli', 'august', 'september', 'oktober', 'november', 'desember'];

/** 2026-09-12 → «12. september 2026» */
export function formatDateNo(iso: string | null): string {
  if (!iso) return '';
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return '';
  const month = MONTHS[Number(m[2]) - 1];
  return month ? `${Number(m[3])}. ${month} ${m[1]}` : '';
}

export function chapterLabel(c: { number: string | null; title: string } | null): string {
  if (!c) return 'Uten kapittel';
  return c.number ? `Kap. ${c.number} – ${c.title}` : c.title;
}

// ---------- Rensing av LaTeX fra Claude ----------

/**
 * Kommandoer som aldri skal stå i en dokumentkropp: de leser/skriver filer, endrer preamble eller
 * kategorikoder. Kompilering skjer i tillegg med `openin_any=p`, `openout_any=p` og uten shell escape,
 * så dette er et ekstra lag.
 */
const FORBIDDEN = [
  'documentclass',
  'usepackage',
  'RequirePackage',
  'input',
  'include',
  'includeonly',
  'InputIfFileExists',
  'write18',
  'immediate',
  'openin',
  'openout',
  'newwrite',
  'newread',
  'read',
  'readline',
  'catcode',
  'special',
  'pdfobj',
  'pdfximage',
  'pdfliteral',
  'directlua',
  'usetikzlibrary',
  'usepgfplotslibrary',
  'tableofcontents',
  'maketitle',
  'pagestyle',
  'thispagestyle',
  'endinput',
  'end{document}',
];

const FORBIDDEN_RE = new RegExp(String.raw`\\(${FORBIDDEN.map((f) => f.replace(/[{}]/g, '\\$&')).join('|')})(?![a-zA-Z])`, 'g');

/**
 * Kode som normaliseringen ikke skal røre: tegninger (prosenttegn og hakeparenteser betyr noe annet der) og ordrett
 * tekst (`verbatim`, `\verb|…|`, programkode der `10 % 3` er riktig).
 */
const PASS_THROUGH =
  /\\begin\{(tikzpicture|circuitikz|verbatim\*?|Verbatim|lstlisting|minted)\}[\s\S]*?\\end\{\1\}|\\verb\*?([^a-zA-Z*\s])[^\n]*?\2/g;

/**
 * Retter vanlige småfeil i en modells LaTeX som ellers gir kompileringsfeil eller stille feil i PDF-en. Bare mønstre
 * som aldri er riktige med SmartNotes-malen endres, så en kropp som allerede er riktig, blir som den er (figurer og
 * tabeller får alltid plassering [H], slik instruksen sier). Tegnekode (TikZ, circuitikz) røres ikke.
 */
export function normalizeBody(body: string): string {
  // \caption utenfor en figur (i en center-blokk, ofte rundt en tegning) feiler; \captionof virker overalt. En
  // center-blokk inne i en figur- eller tabellomgivelse er riktig fra før og hoppes over (den matches hel først).
  body = body.replace(/\\begin\{(figure|table)(\*?)\}[\s\S]*?\\end\{\1\2\}|\\begin\{center\}[\s\S]*?\\end\{center\}/g, (block, float?: string) =>
    float ? block : block.replace(/\\caption(?=\s*[[{])/g, isTableBlock(block) ? '\\captionof{table}' : '\\captionof{figure}'),
  );
  const out: string[] = [];
  let last = 0;
  for (const m of body.matchAll(PASS_THROUGH)) {
    out.push(normalizeText(body.slice(last, m.index)), m[0]);
    last = m.index + m[0].length;
  }
  out.push(normalizeText(body.slice(last)));
  return out.join('');
}

/** En center-blokk med en tabell og ingen tegning eller bilde får «Tabell» i bildeteksten. */
function isTableBlock(block: string): boolean {
  return /\\begin\{tabular/.test(block) && !/\\begin\{(tikzpicture|circuitikz)\}|\\includegraphics|\\originalfigur|\\chemfig/.test(block);
}

const TITLE_WORD: Record<string, RegExp> = {
  eksempel: /^\s*eksempel\b\s*[:.\-–]?\s*/i,
  oppgave: /^\s*oppgave\b\s*[:.\-–]?\s*/i,
  definisjon: /^\s*definisjon\s*[:\-–]\s*/i,
};

function normalizeText(t: string): string {
  return (
    t
      // «35 %» uten \ blir en kommentar som stille kutter resten av linjen.
      .replace(/(\d)([ \t~]*)%/g, (_m, d: string, space: string) => `${d}${space ? '\\,' : ''}\\%`)
      // Boksen heter losning (uten ø).
      .replace(/\\(begin|end)\{løsning\}/g, '\\$1{losning}')
      // husk, merknad og losning har ingen tittel; «[NB!]» ville blitt skrevet ut som tekst.
      .replace(/\\begin\{(husk|merknad|losning)\}[ \t]*\[([^\]\n]*)\]/g, (_m, env: string, title: string) =>
        title.trim() ? `\\begin{${env}}\\textbf{${title.trim()}} ` : `\\begin{${env}}`,
      )
      // Malen setter selv «Eksempel:», «Oppgave» og «Definisjon:» foran tittelen.
      .replace(/\\begin\{(eksempel|oppgave|definisjon)\}\[([^\]\n]*)\]/g, (m, env: string, title: string) => {
        const rest = title.replace(TITLE_WORD[env]!, '');
        return rest && rest !== title ? `\\begin{${env}}[${rest}]` : m;
      })
      // En flytende figur inne i en boks gir «Not in outer par mode»; [H] virker overalt.
      .replace(/\\begin\{(figure|table)\}(?:[ \t]*\[[^\]\n]*\])?/g, '\\begin{$1}[H]')
      // En tom linje inne i en formel gir «Paragraph ended before … was complete».
      .replace(/\\begin\{(align\*?|equation\*?|gather\*?|multline\*?)\}[\s\S]*?\\end\{\1\}/g, (block) => block.replace(/\n[ \t]*\n+/g, '\n'))
      .replace(/(?<!\\)\\\[[\s\S]*?(?<!\\)\\\]/g, (block) => block.replace(/\n[ \t]*\n+/g, '\n'))
  );
}

/** Gjør Claudes svar om til en trygg dokumentkropp. */
export function sanitizeBody(raw: string): string {
  let body = raw.replace(/\r\n?/g, '\n');
  // Markdown-kodeblokker
  body = body.replace(/^\s*```[a-zA-Z]*\s*\n/, '').replace(/\n\s*```\s*$/, '');
  // Hvis Claude likevel har skrevet et helt dokument, ta bare kroppen.
  const begin = body.indexOf('\\begin{document}');
  if (begin !== -1) {
    body = body.slice(begin + '\\begin{document}'.length);
    const end = body.lastIndexOf('\\end{document}');
    if (end !== -1) body = body.slice(0, end);
  }
  body = normalizeBody(body);
  body = body.replace(FORBIDDEN_RE, (_m, cmd: string) => `\\snfjernet{${cmd.replace(/[{}]/g, '')}}`);
  return body.trim() + '\n';
}

/** Finner figur-id-er som brukes med \originalfigur. */
export function referencedFigures(body: string): string[] {
  const ids = new Set<string>();
  const re = /\\originalfigur\s*(?:\[[^\]]*\])?\s*\{([^}]*)\}/g;
  for (const m of body.matchAll(re)) ids.add(m[1]!.trim());
  return [...ids];
}

/** Bytter ut \originalfigur for figurer som ikke finnes, med en synlig plassholder. */
export function replaceMissingFigures(body: string, available: Set<string>): string {
  const re = /\\originalfigur\s*(?:\[[^\]]*\])?\s*\{([^}]*)\}\s*\{((?:[^{}]|\{[^{}]*\})*)\}/g;
  return body.replace(re, (match, id: string, caption: string) =>
    available.has(id.trim()) ? match : `\\manglerfigur{${caption.trim() || id.trim()}}`,
  );
}

// ---------- Ren tekst for søk ----------

const DRAWINGS = /\\begin\{(tikzpicture|circuitikz|axis)\}[\s\S]*?\\end\{\1\}/g;

/**
 * Gjør en dokumentkropp om til ren tekst for søk: tegninger fjernes, kommandoer fjernes men teksten i
 * argumentene beholdes (overskrifter, bildetekster, boksetitler), og matematikk blir stående som tegn.
 */
export function latexToText(body: string, max = 30_000): string {
  let t = body.replace(/(^|[^\\])%.*$/gm, '$1');
  t = t.replace(DRAWINGS, ' ');
  t = t.replace(/\\originalfigur\s*(?:\[[^\]]*\])?\s*\{[^}]*\}/g, ' ');
  t = t.replace(/\\(?:begin|end)\{[^}]*\}(?:\[([^\]]*)\])?/g, (_m, opt: string | undefined) =>
    opt && !/^[htbpH!]+$/.test(opt.trim()) ? ` ${opt} ` : ' ',
  );
  t = t.replace(/\\(?:includegraphics|label|ref|eqref|pageref)\s*(?:\[[^\]]*\])?\s*\{[^}]*\}/g, ' ');
  t = t.replace(/\\[a-zA-Z@]+\*?/g, ' ');
  t = t.replace(/\\./g, ' ');
  t = t.replace(/[{}$&~^_]|\[|\]/g, ' ');
  return t.replace(/\s+/g, ' ').trim().slice(0, max);
}

// ---------- Sammensetting av dokumenter ----------

export interface NoteDocInput {
  preamble: string;
  subjectName: string;
  chapterLabel: string;
  /** Delkapittel, f.eks. «2E Newtons 2. lov», eller null. */
  sectionLabel?: string | null;
  title: string;
  dateIso: string | null;
  /** Relativ mappe (fra byggemappen) med figurene til notatet. */
  figureDir: string;
  body: string;
}

/** Ekstra makro som brukes når forbudte kommandoer er fjernet. */
const EXTRA_PREAMBLE = String.raw`
\newcommand{\snfjernet}[1]{\textcolor{snorange}{\texttt{[fjernet: \textbackslash #1]}}}
\makeatletter
% Holder en sammenhengende utregning eller forklaring på samme side. Innholdet settes først i en boks for å måles:
% en kort blokk settes som én enhet (hel til neste side om den ikke får plass, også inne i en boks som brytes), og
% en blokk som er høyere enn nesten en hel side, settes på nytt som vanlig tekst, så ingenting forsvinner nederst.
% Tellerne (figurer, ligninger) settes tilbake før den andre settingen, og fotnoter i en kort blokk står rett under
% den, som i en minipage. Brukes av Haiku.
\newsavebox{\sn@samlet}
\newskip\sn@samletskip
\def\sn@savecounters{\begingroup\def\@elt##1{\global\csname c@##1\endcsname\the\csname c@##1\endcsname}%
  \xdef\sn@restorecounters{\cl@@ckpt}\endgroup}
\NewDocumentEnvironment{samlet}{+b}{\par\sn@savecounters
  \setbox\sn@samlet\vbox{\hsize\linewidth\@parboxrestore\setlength{\parskip}{0.5\baselineskip}%
    \def\@mpfn{mpfootnote}\def\thempfn{\thempfootnote}\c@mpfootnote\z@\let\@footnotetext\@mpfootnotetext
    \noindent\ignorespaces#1\par\xdef\sn@samletdepth{\the\prevdepth}\global\sn@samletskip\lastskip\unskip\unpenalty\unskip
    \ifvoid\@mpfootins\else\vskip\skip\@mpfootins\normalcolor\footnoterule\unvbox\@mpfootins\fi}%
  \ifdim\dimexpr\ht\sn@samlet+\dp\sn@samlet\relax>0.85\textheight
    \sn@restorecounters{\allowdisplaybreaks[1]\noindent\ignorespaces#1\par}%
  \else{\parfillskip\z@skip\noindent\vtop{\unvbox\sn@samlet}\par}\prevdepth\sn@samletdepth\relax\vskip\sn@samletskip\fi}{}
\makeatother
% \uleselig også i formler (et usikkert tegn eller symbol i en ligning). Den ytre gruppen gjør at en eksponent eller
% et merke etter (\uleselig{v}^2, \uleselig{f}') ikke blir en dobbel eksponent.
\DeclareRobustCommand{\uleselig}[1]{\ifmmode{{\color{sngray}#1}^{\textcolor{snorange}{?}}}\else
  \textcolor{sngray}{\textit{#1}}\textsuperscript{\textcolor{snorange}{\,?}}\fi}
% Engelske navn på boksene, så en modell som skriver dem, ikke får kompileringsfeil.
\ProvideDocumentEnvironment{solution}{}{\begin{losning}}{\end{losning}}
\ProvideDocumentEnvironment{definition}{O{}}{\begin{definisjon}[#1]}{\end{definisjon}}
\ProvideDocumentEnvironment{example}{O{}}{\begin{eksempel}[#1]}{\end{eksempel}}
\ProvideDocumentEnvironment{exercise}{O{}}{\begin{oppgave}[#1]}{\end{oppgave}}
`;

export interface AssembledDoc {
  tex: string;
  /** Linjenummeret (1-basert) i .tex-filen der kroppen starter. */
  bodyStartLine: number;
}

export function assembleNoteDoc(d: NoteDocInput): AssembledDoc {
  const head = [
    d.preamble.trimEnd(),
    EXTRA_PREAMBLE.trim(),
    `\\renewcommand{\\snfag}{${escapeLatex(d.subjectName)}}`,
    `\\renewcommand{\\snkapittel}{${escapeLatex(d.chapterLabel)}}`,
    `\\renewcommand{\\notedir}{${d.figureDir}}`,
    `\\hypersetup{pdftitle={${escapeLatex(d.title)}},pdfauthor={SmartNotes}}`,
    '\\begin{document}',
    `\\notehode{${escapeLatex(d.title)}}{${escapeLatex([d.subjectName, d.chapterLabel, d.sectionLabel].filter(Boolean).join(' · '))}}{${escapeLatex(formatDateNo(d.dateIso))}}`,
    '',
  ].join('\n');
  const bodyStartLine = head.split('\n').length;
  return { tex: `${head}${d.body.trimEnd()}\n\\end{document}\n`, bodyStartLine };
}

export interface BundleNote {
  id: string;
  title: string;
  dateIso: string | null;
  figureDir: string;
  body: string;
}

export interface BundleSection {
  /** Overskrift for gruppen (kapittel i fag-PDF, delkapittel i kapittel-PDF), eller null. */
  heading: string | null;
  /** Ny tekst i sidehodet fra denne gruppen; udefinert = behold sidehodet. */
  pageHeader?: string;
  notes: BundleNote[];
}

export interface BundleDocInput {
  preamble: string;
  subjectName: string;
  title: string;
  subtitle: string;
  /** Header øverst til høyre når det bare er ett kapittel. */
  headerLabel: string;
  sections: BundleSection[];
}

/** Samle-PDF for et kapittel eller et helt fag: forside med innholdsliste og ett notat per side. */
export function assembleBundleDoc(d: BundleDocInput): string {
  const out: string[] = [
    d.preamble.trimEnd(),
    EXTRA_PREAMBLE.trim(),
    `\\renewcommand{\\snfag}{${escapeLatex(d.subjectName)}}`,
    `\\renewcommand{\\snkapittel}{${escapeLatex(d.headerLabel)}}`,
    `\\hypersetup{pdftitle={${escapeLatex(d.title)}},pdfauthor={SmartNotes}}`,
    '\\begin{document}',
    '\\thispagestyle{empty}',
    '\\begin{center}',
    '\\vspace*{3cm}',
    `{\\Huge\\bfseries ${escapeLatex(d.title)}\\par}`,
    '\\vspace{8pt}',
    `{\\large\\textcolor{sngray}{${escapeLatex(d.subtitle)}}\\par}`,
    '\\vspace{6pt}\\textcolor{snblue}{\\rule{0.5\\linewidth}{1.2pt}}',
    '\\end{center}',
    '\\vspace{1.5cm}',
    '\\noindent{\\large\\bfseries Innhold}\\par\\vspace{4pt}',
  ];
  let n = 0;
  for (const s of d.sections) {
    if (s.heading) out.push(`\\par\\vspace{6pt}\\noindent{\\bfseries ${escapeLatex(s.heading)}}\\par`);
    for (const note of s.notes) {
      n++;
      const date = formatDateNo(note.dateIso);
      out.push(
        `\\noindent\\hyperref[sn-note-${n}]{${escapeLatex(note.title)}${date ? ` \\textcolor{sngray}{\\small(${escapeLatex(date)})}` : ''}}\\dotfill\\pageref{sn-note-${n}}\\par`,
      );
    }
  }
  n = 0;
  for (const s of d.sections) {
    if (s.heading) {
      out.push('\\clearpage');
      if (s.pageHeader !== undefined) out.push(`\\renewcommand{\\snkapittel}{${escapeLatex(s.pageHeader)}}`);
      out.push(`\\pdfbookmark[0]{${escapeLatex(s.heading)}}{sn-ch-${n + 1}}`);
    }
    for (const note of s.notes) {
      n++;
      out.push(
        '\\clearpage',
        `\\renewcommand{\\notedir}{${note.figureDir}}`,
        `\\phantomsection\\label{sn-note-${n}}`,
        `\\pdfbookmark[${s.heading ? 1 : 0}]{${escapeLatex(note.title)}}{sn-bm-${n}}`,
        `\\notehode{${escapeLatex(note.title)}}{${escapeLatex(d.subjectName)}}{${escapeLatex(formatDateNo(note.dateIso))}}`,
        note.body.trimEnd(),
      );
    }
  }
  out.push('\\end{document}', '');
  return out.join('\n');
}

// ---------- Kompilering ----------

export interface LatexErrorInfo {
  line: number | null;
  message: string;
  context: string;
}

export type CompileResult =
  | { ok: true; pdfPath: string; log: string }
  | { ok: false; log: string; errors: LatexErrorInfo[]; timedOut: boolean };

/**
 * Kompilerer `main.tex` i `workDir` med latexmk/pdflatex.
 * Sikkerhet: ingen shell escape, og kpathsea får bare lese/skrive filer i byggemappen
 * (openin_any/openout_any = p).
 */
export async function compileLatex(workDir: string, tex: string, timeoutMs: number): Promise<CompileResult> {
  const texPath = path.join(workDir, 'main.tex');
  await fsp.writeFile(texPath, tex, 'utf8');
  const { timedOut, output } = await run(
    'latexmk',
    ['-pdf', '-norc', '-interaction=nonstopmode', '-halt-on-error', '-file-line-error', '-no-shell-escape', 'main.tex'],
    workDir,
    timeoutMs,
  );
  const log = await fsp.readFile(path.join(workDir, 'main.log'), 'utf8').catch(() => output);
  const pdfPath = path.join(workDir, 'main.pdf');
  const hasPdf = await fsp
    .stat(pdfPath)
    .then((s) => s.size > 0)
    .catch(() => false);
  const errors = parseLatexErrors(log);
  if (!timedOut && hasPdf && errors.length === 0) return { ok: true, pdfPath, log };
  if (timedOut) errors.unshift({ line: null, message: 'Kompileringen tok for lang tid (tidsavbrudd).', context: '' });
  if (errors.length === 0) errors.push({ line: null, message: 'Ukjent LaTeX-feil.', context: tailLines(log, 30) });
  return { ok: false, log, errors, timedOut };
}

function run(cmd: string, args: string[], cwd: string, timeoutMs: number): Promise<{ code: number | null; timedOut: boolean; output: string }> {
  return new Promise((resolve) => {
    const child = spawn(cmd, args, {
      cwd,
      detached: true,
      env: {
        ...process.env,
        openin_any: 'p',
        openout_any: 'p',
        max_print_line: '1000',
        TEXMFOUTPUT: cwd,
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let output = '';
    const collect = (b: Buffer) => {
      if (output.length < 200_000) output += b.toString('utf8');
    };
    child.stdout.on('data', collect);
    child.stderr.on('data', collect);
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      try {
        process.kill(-child.pid!, 'SIGKILL');
      } catch {
        child.kill('SIGKILL');
      }
    }, timeoutMs);
    child.on('error', (err) => {
      clearTimeout(timer);
      resolve({ code: null, timedOut, output: output + String(err) });
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      resolve({ code, timedOut, output });
    });
  });
}

/** Henter feilene fra en LaTeX-logg (krever -file-line-error). */
export function parseLatexErrors(log: string): LatexErrorInfo[] {
  const lines = log.split('\n');
  const errors: LatexErrorInfo[] = [];
  for (let i = 0; i < lines.length && errors.length < 5; i++) {
    const line = lines[i]!;
    const fileLine = /^(?:\.\/)?main\.tex:(\d+): (.*)$/.exec(line);
    const bang = !fileLine && /^! (.*)$/.exec(line);
    if (!fileLine && !bang) continue;
    const message = (fileLine ? fileLine[2] : bang ? bang[1] : '')!.trim();
    if (/^==> Fatal error occurred/.test(message) || /^Emergency stop/.test(message)) continue;
    const ctx = lines.slice(i + 1, i + 8).filter((l) => l.trim() !== '');
    errors.push({ line: fileLine ? Number(fileLine[1]) : null, message, context: ctx.join('\n') });
  }
  return errors;
}

/** Kort, lesbar feilmelding for brukeren, med linjenumre relativt til dokumentkroppen. */
export function formatErrors(errors: LatexErrorInfo[], bodyStartLine: number): string {
  return errors
    .map((e) => {
      const rel = e.line !== null ? e.line - bodyStartLine + 1 : null;
      const where = rel !== null && rel > 0 ? `Linje ${rel}: ` : '';
      return `${where}${e.message}${e.context ? `\n${e.context}` : ''}`;
    })
    .join('\n\n');
}

/** Viser linjene rundt hver feil i kroppen, nummerert – til bruk i rette-forespørselen til Claude. */
export function errorExcerpt(body: string, errors: LatexErrorInfo[], bodyStartLine: number, radius = 4): string {
  const lines = body.split('\n');
  const parts: string[] = [];
  for (const e of errors) {
    const rel = e.line !== null ? e.line - bodyStartLine + 1 : null;
    let snippet = '';
    if (rel !== null && rel > 0 && rel <= lines.length + 1) {
      // samlet leser hele blokken før den settes, så LaTeX melder en feil inne i den på linjen med \end{samlet}.
      // Utdraget viser da hele blokken (inntil 40 linjer før), så feilen er med.
      const start = /\\end\{samlet\}/.test(lines[rel - 1] ?? '') ? samletStart(lines, rel) : null;
      const from = Math.max(1, start !== null ? Math.max(start, rel - 40) : rel - radius);
      const to = Math.min(lines.length, rel + radius);
      snippet = lines
        .slice(from - 1, to)
        .map((l, k) => `${String(from + k).padStart(4)}${from + k === rel ? ' >' : '  '} ${l}`)
        .join('\n');
    }
    parts.push(`Feil${rel !== null && rel > 0 ? ` på linje ${rel}` : ''}: ${e.message}\n${e.context}${snippet ? `\nUtdrag:\n${snippet}` : ''}`);
  }
  return parts.join('\n\n');
}

/** Linjenummeret (1-basert) til \begin{samlet} som hører til \end{samlet} på linje `end`. */
function samletStart(lines: string[], end: number): number | null {
  let depth = 0;
  for (let i = end; i >= 1; i--) {
    const line = lines[i - 1]!;
    depth += (line.match(/\\end\{samlet\}/g) ?? []).length - (line.match(/\\begin\{samlet\}/g) ?? []).length;
    if (depth <= 0) return i;
  }
  return null;
}

function tailLines(s: string, n: number): string {
  return s.split('\n').slice(-n).join('\n');
}

export async function latexAvailable(): Promise<boolean> {
  const r = await run('latexmk', ['-v'], process.cwd(), 10_000);
  return r.code === 0;
}
