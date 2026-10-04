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
      const from = Math.max(1, rel - radius);
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

function tailLines(s: string, n: number): string {
  return s.split('\n').slice(-n).join('\n');
}

export async function latexAvailable(): Promise<boolean> {
  const r = await run('latexmk', ['-v'], process.cwd(), 10_000);
  return r.code === 0;
}
