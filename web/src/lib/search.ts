/**
 * Lokalt søk i Dexie-dataene (fungerer offline).
 * Normalisering: små bokstaver og uten aksenter/diakritiske tegn – men æ, ø og å holdes adskilt.
 */
import type { Chapter, Note, Section, Subject } from '@smartnotes/shared';
import { chapterHeading, chapterLabel, compareChapters, noteDay } from './format';
import { noteSearchText, noteSection, sectionLabel, sectionsOf } from './curriculum';

const MARKS = /[̀-ͯ]/g;
const KEEP = /^[\x00-\x7fæøå]$/;

function foldChar(ch: string): string {
  const lower = ch.toLowerCase();
  if (KEEP.test(lower)) return lower;
  return lower.normalize('NFD').replace(MARKS, '');
}

/** Normaliserer tekst for sammenligning. */
export function normalize(text: string): string {
  return text
    .normalize('NFC')
    .toLowerCase()
    .replace(/[^\x00-\x7fæøå]/g, (ch) => ch.normalize('NFD').replace(MARKS, ''));
}

/** Normalisert tekst + hvor hvert normalisert tegn kommer fra i originalen (for markering). */
function normalizeWithMap(text: string): { norm: string; starts: number[]; ends: number[] } {
  let norm = '';
  const starts: number[] = [];
  const ends: number[] = [];
  let i = 0;
  for (const ch of text) {
    const folded = foldChar(ch);
    for (let k = 0; k < folded.length; k++) {
      starts.push(i);
      ends.push(i + ch.length);
    }
    norm += folded;
    i += ch.length;
  }
  return { norm, starts, ends };
}

export function parseTerms(query: string): string[] {
  return normalize(query)
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 8);
}

// ---------- Indeks ----------

interface NoteEntry {
  note: Note;
  subject: Subject | null;
  chapter: Chapter | null;
  section: Section | null;
  title: string;
  meta: string;
  body: string;
  sortKey: string;
}

interface PlaceEntry {
  kind: 'chapter' | 'section';
  subject: Subject | null;
  chapter: Chapter;
  section: Section | null;
  text: string;
  /** Kode/nummer i normalisert form, for eksakte treff. */
  code: string;
  order: number;
}

export interface SearchIndex {
  notes: NoteEntry[];
  places: PlaceEntry[];
}

export function buildIndex(subjects: Subject[], chapters: Chapter[], notes: Note[]): SearchIndex {
  const subjectById = new Map(subjects.map((s) => [s.id, s]));
  const chapterById = new Map(chapters.map((c) => [c.id, c]));
  const noteEntries: NoteEntry[] = notes.map((note) => {
    const chapter = note.chapterId ? (chapterById.get(note.chapterId) ?? null) : null;
    const section = noteSection(note, chapter);
    const meta = [section ? sectionLabel(section) : '', chapter ? chapterLabel(chapter) : ''].join(' \n ');
    return {
      note,
      subject: subjectById.get(note.subjectId) ?? null,
      chapter,
      section,
      title: normalize(note.title ?? ''),
      meta: normalize(meta),
      body: normalize(noteSearchText(note)),
      sortKey: `${noteDay(note)} ${note.createdAt}`,
    };
  });

  const places: PlaceEntry[] = [];
  let order = 0;
  for (const chapter of [...chapters].sort(
    (a, b) => (a.subjectId < b.subjectId ? -1 : a.subjectId > b.subjectId ? 1 : compareChapters(a, b)),
  )) {
    const subject = subjectById.get(chapter.subjectId) ?? null;
    places.push({
      kind: 'chapter',
      subject,
      chapter,
      section: null,
      text: normalize(chapterLabel(chapter)),
      code: normalize(chapter.number ?? ''),
      order: order++,
    });
    for (const section of sectionsOf(chapter)) {
      places.push({
        kind: 'section',
        subject,
        chapter,
        section,
        text: normalize(sectionLabel(section)),
        code: normalize(section.code),
        order: order++,
      });
    }
  }
  return { notes: noteEntries, places };
}

// ---------- Søk ----------

export interface NoteHit {
  note: Note;
  subject: Subject | null;
  chapter: Chapter | null;
  section: Section | null;
  /** 0 = alle ordene i tittelen … 3 = bare i teksten. */
  tier: number;
}

export interface PlaceHit {
  kind: 'chapter' | 'section';
  subject: Subject | null;
  chapter: Chapter;
  section: Section | null;
  label: string;
  sub: string;
}

export interface SearchResult {
  notes: NoteHit[];
  places: PlaceHit[];
  /** Totalt antall notattreff (før begrensning). */
  totalNotes: number;
}

export function search(index: SearchIndex, terms: string[], limit = 30): SearchResult {
  if (!terms.length) return { notes: [], places: [], totalNotes: 0 };

  const noteHits: (NoteHit & { sortKey: string })[] = [];
  for (const e of index.notes) {
    let inTitle = 0;
    let inMeta = 0;
    let ok = true;
    for (const t of terms) {
      const t1 = e.title.includes(t);
      const t2 = !t1 && e.meta.includes(t);
      if (t1) inTitle++;
      else if (t2) inMeta++;
      else if (!e.body.includes(t)) {
        ok = false;
        break;
      }
    }
    if (!ok) continue;
    const tier = inTitle === terms.length ? 0 : inTitle > 0 ? 1 : inMeta > 0 ? 2 : 3;
    noteHits.push({ note: e.note, subject: e.subject, chapter: e.chapter, section: e.section, tier, sortKey: e.sortKey });
  }
  // Tittel-treff først, deretter nyeste notat først.
  noteHits.sort((a, b) => a.tier - b.tier || (a.sortKey < b.sortKey ? 1 : a.sortKey > b.sortKey ? -1 : 0));

  const placeHits: (PlaceHit & { rank: number; order: number })[] = [];
  for (const p of index.places) {
    if (!terms.every((t) => p.text.includes(t))) continue;
    const exact = terms.some((t) => t === p.code);
    const prefix = terms.some((t) => p.text.startsWith(t));
    placeHits.push({
      kind: p.kind,
      subject: p.subject,
      chapter: p.chapter,
      section: p.section,
      label: p.section ? sectionLabel(p.section) : chapterHeading(p.chapter),
      sub: p.section ? chapterHeading(p.chapter) : (p.subject?.name ?? ''),
      rank: exact ? 0 : prefix ? 1 : 2,
      order: p.order,
    });
  }
  placeHits.sort((a, b) => a.rank - b.rank || a.order - b.order);

  const maxPlaces = Math.min(placeHits.length, Math.max(6, limit - noteHits.length));
  const maxNotes = Math.min(noteHits.length, limit - maxPlaces);
  return {
    notes: noteHits.slice(0, maxNotes),
    places: placeHits.slice(0, maxPlaces),
    totalNotes: noteHits.length,
  };
}

// ---------- Markering ----------

export interface Segment {
  text: string;
  mark: boolean;
}

function markRanges(norm: string, starts: number[], ends: number[], terms: string[], from: number, to: number) {
  const ranges: [number, number][] = [];
  for (const t of terms) {
    if (!t) continue;
    let i = norm.indexOf(t);
    while (i >= 0) {
      const s = starts[i]!;
      const e = ends[i + t.length - 1]!;
      if (e > from && s < to) ranges.push([Math.max(s, from), Math.min(e, to)]);
      i = norm.indexOf(t, i + t.length);
    }
  }
  ranges.sort((a, b) => a[0] - b[0]);
  const merged: [number, number][] = [];
  for (const r of ranges) {
    const last = merged[merged.length - 1];
    if (last && r[0] <= last[1]) last[1] = Math.max(last[1], r[1]);
    else merged.push([r[0], r[1]]);
  }
  return merged;
}

function toSegments(text: string, ranges: [number, number][], from: number, to: number): Segment[] {
  const out: Segment[] = [];
  let pos = from;
  for (const [s, e] of ranges) {
    if (s > pos) out.push({ text: text.slice(pos, s), mark: false });
    out.push({ text: text.slice(s, e), mark: true });
    pos = e;
  }
  if (pos < to) out.push({ text: text.slice(pos, to), mark: false });
  return out;
}

/** Hele teksten med søkeordene markert. */
export function highlightSegments(raw: string, terms: string[]): Segment[] {
  const text = raw.normalize('NFC');
  const { norm, starts, ends } = normalizeWithMap(text);
  return toSegments(text, markRanges(norm, starts, ends, terms, 0, text.length), 0, text.length);
}

/** Et kort utdrag rundt første treff, med søkeordene markert. `null` hvis teksten er tom. */
export function snippetSegments(raw: string, terms: string[], before = 50, after = 120): Segment[] | null {
  const text = raw.normalize('NFC').replace(/\s+/g, ' ').trim();
  if (!text) return null;
  const { norm, starts, ends } = normalizeWithMap(text);
  let first = -1;
  for (const t of terms) {
    const i = norm.indexOf(t);
    if (i >= 0 && (first < 0 || i < first)) first = i;
  }
  const hitAt = first >= 0 ? starts[first]! : 0;
  let from = first >= 0 ? Math.max(0, hitAt - before) : 0;
  let to = Math.min(text.length, (first >= 0 ? hitAt : 0) + after + (first >= 0 ? 0 : before));
  // Ikke kutt midt i et ord.
  if (from > 0) {
    const sp = text.indexOf(' ', from);
    if (sp >= 0 && sp < hitAt) from = sp + 1;
  }
  if (to < text.length) {
    const sp = text.lastIndexOf(' ', to);
    if (sp > Math.max(from, hitAt) + 10) to = sp;
  }
  const segments = toSegments(text, markRanges(norm, starts, ends, terms, from, to), from, to);
  if (from > 0) segments.unshift({ text: '… ', mark: false });
  if (to < text.length) segments.push({ text: ' …', mark: false });
  return segments;
}
