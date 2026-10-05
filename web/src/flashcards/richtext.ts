/**
 * Den enkle markeringen i kortene: **fet** for nøkkelbegreper og $…$ for formler (LaTeX, vises med KaTeX).
 * \$ gir et vanlig dollartegn. Et dollartegn eller ** uten partner vises som vanlig tekst.
 */
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
