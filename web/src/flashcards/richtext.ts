/**
 * Den enkle markeringen i kortene: **fet** for nøkkelbegreper og $…$ for formler (LaTeX, vises med KaTeX).
 * \$ gir et vanlig dollartegn. Et dollartegn eller ** uten partner vises som vanlig tekst.
 */
import type { Flashcard } from '@smartnotes/shared';

export type Inline = { type: 'text'; text: string; bold: boolean } | { type: 'math'; tex: string; bold: boolean; display: boolean };

/** Finner neste dollartegn som ikke er escapet, fra og med `from`. */
function nextDollar(src: string, from: number): number {
  for (let i = from; i < src.length; i++) {
    if (src[i] === '\\') {
      i++;
      continue;
    }
    if (src[i] === '$') return i;
  }
  return -1;
}

export function parseInline(src: string): Inline[] {
  const out: Inline[] = [];
  let bold = false;
  let buf = '';
  const flush = () => {
    if (!buf) return;
    const last = out[out.length - 1];
    if (last && last.type === 'text' && last.bold === bold) last.text += buf;
    else out.push({ type: 'text', text: buf, bold });
    buf = '';
  };
  let i = 0;
  while (i < src.length) {
    const ch = src[i]!;
    if (ch === '\\' && src[i + 1] === '$') {
      buf += '$';
      i += 2;
      continue;
    }
    if (ch === '$') {
      const display = src[i + 1] === '$';
      const start = i + (display ? 2 : 1);
      let end = nextDollar(src, start);
      if (display) while (end !== -1 && src[end + 1] !== '$') end = nextDollar(src, end + 1);
      const tex = end === -1 ? '' : src.slice(start, end);
      if (end !== -1 && tex.trim()) {
        flush();
        out.push({ type: 'math', tex: tex.trim(), bold, display });
        i = end + (display ? 2 : 1);
        continue;
      }
      buf += ch;
      i += 1;
      continue;
    }
    if (ch === '*' && src[i + 1] === '*') {
      // Bare som markering når det finnes en partner (eller vi er inne i fet tekst).
      if (bold || src.indexOf('**', i + 2) !== -1) {
        flush();
        bold = !bold;
        i += 2;
        continue;
      }
    }
    buf += ch;
    i += 1;
  }
  flush();
  return out;
}

export interface BackLine {
  /** Overskriftslinje («!» først), vises uten punkttegn. */
  label: boolean;
  text: string;
}

export function parseBackLine(line: string): BackLine {
  const t = line.trim();
  return t.startsWith('!') ? { label: true, text: t.slice(1).trim() } : { label: false, text: t };
}

/** Avsnittene i en detaljert forklaring (skilt med tom linje). */
export function paragraphs(text: string): string[] {
  return text
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);
}

/** Ren tekst uten markering, til søk og skjermlesere. */
export function plainText(src: string): string {
  return parseInline(src)
    .map((x) => (x.type === 'text' ? x.text : x.tex))
    .join('');
}

/** Svaret som tekst i et skrivefelt (én linje per punkt) og tilbake. */
export function backToText(back: string[]): string {
  return back.join('\n');
}

export function textToBack(text: string): string[] {
  return text
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && l !== '!');
}

// ---------- Luketekst ----------

/** En luke i svaret: ett nøkkelbegrep (fet tekst) er byttet ut med et skrivefelt. */
export interface Cloze {
  /** Svarlinja med luka (indeks i `back`). */
  line: number;
  /** Delen av linja som er byttet ut: indeks i `parseInline(parseBackLine(back[line]).text)`. */
  part: number;
  /** Begrepet eleven skal skrive, slik det står på kortet. */
  term: string;
}

/** Lengste frase som kan bli en luke. */
const CLOZE_MAX_WORDS = 3;
/** Fet tekst med disse tegnene er en formel skrevet uten $…$. */
const FORMULA_CHARS = /[=<>^_\\]/;

/**
 * Den fete teksten i svaret som kan bli en luke, i kortets rekkefølge. Hopper over formler (også fet tekst inntil en
 * formel), «!»-linjer, fraser på mer enn tre ord, tekst uten bokstaver og begreper som står i spørsmålet eller et annet
 * sted i svaret, for der ville svaret stått rett foran eleven.
 */
export function clozeCandidates(card: Pick<Flashcard, 'front' | 'back'>): Cloze[] {
  const lines = card.back.map(parseBackLine);
  const parsed = lines.map((l) => parseInline(l.text));
  const question = plainText(card.front);
  const out: Cloze[] = [];
  parsed.forEach((parts, line) => {
    if (lines[line]!.label) return;
    parts.forEach((p, i) => {
      if (p.type !== 'text' || !p.bold) return;
      const term = p.text.trim();
      if (!/\p{L}/u.test(term) || FORMULA_CHARS.test(term) || term.split(/\s+/).length > CLOZE_MAX_WORDS) return;
      if ([parts[i - 1], parts[i + 1]].some((q) => q?.type === 'math' && q.bold)) return;
      const rest = parsed
        .map((ps, l) => ps.map((q, j) => (l === line && j === i ? ' ' : q.type === 'text' ? q.text : q.tex)).join(''))
        .join('\n');
      if (containsTerm(question, term) || containsTerm(rest, term)) return;
      out.push({ line, part: i, term });
    });
  });
  return out;
}

/** FNV-1a: et fast tall for en tekst. */
function hashString(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 0x01000193);
  return h >>> 0;
}

/**
 * Luka i kortet for runden `seed`, eller null når kortet ikke har noen (da vises det med to knapper som i Rask runde).
 * Valget er fast for samme kort og runde, så luka er den samme etter omlasting. Neste runde (`seed + 1`) gir neste
 * fete begrep, så et kort med flere får en annen luke.
 */
export function clozeOf(card: Pick<Flashcard, 'id' | 'front' | 'back'>, seed: number): Cloze | null {
  const list = clozeCandidates(card);
  const n = list.length;
  if (!n) return null;
  const turn = Number.isFinite(seed) ? Math.trunc(seed) : 0;
  return list[(((hashString(card.id) + turn) % n) + n) % n] ?? null;
}

/** Vanlige norske endelser som godtas («akselerasjonen» = «akselerasjon», «cellene» = «celle»). */
const ENDINGS = ['enes', 'erne', 'ene', 'ens', 'ets', 'ane', 'en', 'et', 'er', 'a', 'e', 's'];
/** Ord med så mange bokstaver tåler én skrivefeil. */
const TYPO_MIN = 6;

/** Ordene i en tekst med små bokstaver, uten tegnsetting og aksenter (æ, ø og å beholdes). */
function words(s: string): string[] {
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, (m) => (m === '\u030a' ? m : ''))
    .normalize('NFC')
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean);
}

/** Ordet selv og ordet uten hver endelse det kan ha. */
function stems(w: string): string[] {
  return [w, ...ENDINGS.filter((e) => w.length - e.length >= 2 && w.endsWith(e)).map((e) => w.slice(0, -e.length))];
}

/** Ett tegn satt inn, fjernet eller byttet, eller to nabotegn i bytte rekkefølge (Damerau-Levenshtein ≤ 1). */
function withinOneEdit(a: string, b: string): boolean {
  if (a === b) return true;
  if (Math.abs(a.length - b.length) > 1) return false;
  let i = 0;
  while (i < a.length && i < b.length && a[i] === b[i]) i++;
  if (a.length === b.length) {
    const swapped = a[i] === b[i + 1] && a[i + 1] === b[i];
    return a.slice(i + 1) === b.slice(i + 1) || (swapped && a.slice(i + 2) === b.slice(i + 2));
  }
  return a.length > b.length ? a.slice(i + 1) === b.slice(i) : a.slice(i) === b.slice(i + 1);
}

function sameWord(typed: string, expected: string, typos: boolean): boolean {
  const a = stems(typed);
  const b = stems(expected);
  if (a.some((x) => b.includes(x))) return true;
  if (!typos || expected.length < TYPO_MIN) return false;
  if (withinOneEdit(typed, expected)) return true;
  // Skrivefeil og endelse samtidig («akselerasjnen»): bare mellom stammer som ikke er for korte.
  return a.some((x) => x.length >= 5 && b.some((y) => y.length >= 5 && withinOneEdit(x, y)));
}

/** Begrepet står i teksten, også med en annen endelse («farten» i et spørsmål om «fart»). */
function containsTerm(text: string, term: string): boolean {
  const t = words(term);
  const w = words(text);
  if (!t.length) return false;
  for (let i = 0; i + t.length <= w.length; i++) if (t.every((x, j) => sameWord(w[i + j]!, x, false))) return true;
  return false;
}

/**
 * Om det eleven skrev i luka, er begrepet. Store og små bokstaver, mellomrom, tegnsetting og aksenter spiller ingen
 * rolle, vanlige endelser godtas, og ord på seks bokstaver eller mer tåler én skrivefeil. Æ, ø og å er egne bokstaver.
 */
export function matchesTerm(typed: string, term: string): boolean {
  const a = words(typed);
  const b = words(term);
  if (!a.length || !b.length) return false;
  if (a.length === b.length && a.every((w, i) => sameWord(w, b[i]!, true))) return true;
  return sameWord(a.join(''), b.join(''), true);
}
