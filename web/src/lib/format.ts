import type { Chapter, Note, NoteStage, NoteStatus } from '@smartnotes/shared';

const LOCALE = 'nb-NO';

const dateFmt = new Intl.DateTimeFormat(LOCALE, { day: 'numeric', month: 'short', year: 'numeric' });
const dateNoYearFmt = new Intl.DateTimeFormat(LOCALE, { day: 'numeric', month: 'short' });
const timeFmt = new Intl.DateTimeFormat(LOCALE, { hour: '2-digit', minute: '2-digit' });
const monthShortFmt = new Intl.DateTimeFormat(LOCALE, { month: 'short' });

/** 'YYYY-MM-DD' → Date i lokal tid (unngår UTC-forskyvning). */
export function parseDay(day: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(day);
  if (!m) return null;
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

/** «12. sep. 2026» */
export function formatDay(day: string | null | undefined): string {
  if (!day) return '';
  const d = parseDay(day);
  return d ? dateFmt.format(d) : day;
}

/** «12. sep.» hvis inneværende år, ellers med år. */
export function formatDayShort(day: string | null | undefined): string {
  if (!day) return '';
  const d = parseDay(day);
  if (!d) return day;
  return d.getFullYear() === new Date().getFullYear() ? dateNoYearFmt.format(d) : dateFmt.format(d);
}

/** Dag og måned hver for seg, til «kalenderbrikken» på notatkort. */
export function dayParts(day: string): { day: string; month: string } | null {
  const d = parseDay(day);
  if (!d) return null;
  return { day: String(d.getDate()), month: monthShortFmt.format(d).replace('.', '') };
}

export function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

/** «14:32» i dag, ellers «3. okt. 14:32». */
export function formatTimestamp(ms: number | string | null | undefined): string {
  if (ms === null || ms === undefined) return '';
  const d = new Date(ms);
  if (Number.isNaN(d.getTime())) return '';
  if (isSameDay(d, new Date())) return timeFmt.format(d);
  return `${dateNoYearFmt.format(d)} ${timeFmt.format(d)}`;
}

/** Lokal dato som 'YYYY-MM-DD'. */
export function todayISO(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Datoen et notat sorteres og vises etter: forelesningsdato, ellers opplastingsdato. */
export function noteDay(note: Pick<Note, 'noteDate' | 'createdAt'>): string {
  return note.noteDate ?? note.createdAt.slice(0, 10);
}

export function compareNotes(a: Note, b: Note): number {
  const da = noteDay(a);
  const dbb = noteDay(b);
  if (da !== dbb) return da < dbb ? -1 : 1;
  return a.createdAt < b.createdAt ? -1 : a.createdAt > b.createdAt ? 1 : 0;
}

export function compareChapters(a: Chapter, b: Chapter): number {
  if (a.position !== b.position) return a.position - b.position;
  return (a.number ?? '').localeCompare(b.number ?? '', LOCALE, { numeric: true });
}

/** «3 Newtons lover» */
export function chapterLabel(c: Pick<Chapter, 'number' | 'title'>): string {
  return c.number ? `${c.number} ${c.title}` : c.title;
}

/** «Kap. 3 · Newtons lover» */
export function chapterHeading(c: Pick<Chapter, 'number' | 'title'>): string {
  return c.number ? `Kap. ${c.number} · ${c.title}` : c.title;
}

export function plural(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
}

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 kB';
  const units = ['B', 'kB', 'MB', 'GB'];
  let i = 0;
  let v = bytes;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i += 1;
  }
  const digits = v < 10 && i > 0 ? 1 : 0;
  return `${v.toLocaleString(LOCALE, { maximumFractionDigits: digits })} ${units[i]}`;
}

export function stageText(stage: NoteStage | null): string {
  switch (stage) {
    case 'preparing':
      return 'Forbereder sidene …';
    case 'reading':
      return 'Leser håndskrift …';
    case 'compiling':
      return 'Lager PDF …';
    case 'fixing':
      return 'Retter LaTeX-feil …';
    default:
      return 'Konverterer …';
  }
}

export function stageDescription(stage: NoteStage | null): string {
  switch (stage) {
    case 'preparing':
      return 'Sidene gjøres klare for Claude.';
    case 'reading':
      return 'Claude tolker notatene og skriver LaTeX. Det tar gjerne et par minutter.';
    case 'compiling':
      return 'LaTeX-koden settes til en PDF.';
    case 'fixing':
      return 'Det oppsto en kompileringsfeil, som Claude nå retter.';
    default:
      return 'Notatet konverteres.';
  }
}

export function statusText(status: NoteStatus, stage: NoteStage | null): string {
  switch (status) {
    case 'queued':
      return 'I kø';
    case 'processing':
      return stageText(stage);
    case 'failed':
      return 'Feilet – prøv igjen';
    case 'done':
      return 'Ferdig';
  }
}

/** Filnavn-vennlig versjon av en tittel. */
export function slugify(text: string, fallback = 'notat'): string {
  const s = text
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/æ/gi, 'ae')
    .replace(/ø/gi, 'o')
    .replace(/å/gi, 'a')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase()
    .slice(0, 60);
  return s || fallback;
}
