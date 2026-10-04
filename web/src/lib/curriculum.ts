/**
 * Delkapitler og kompetansemål. Eldre rader (fra før serveren sendte disse feltene)
 * kan mangle dem – alt her tåler `undefined` og behandler det som tomt.
 */
import type { Chapter, CompetenceAim, Note, Section, Subject } from '@smartnotes/shared';
import { compareChapters, compareNotes } from './format';

export function sectionsOf(chapter: Pick<Chapter, 'sections'> | null | undefined): Section[] {
  return Array.isArray(chapter?.sections) ? chapter.sections : [];
}

export function aimsOf(subject: Pick<Subject, 'aims'> | null | undefined): CompetenceAim[] {
  return Array.isArray(subject?.aims) ? subject.aims : [];
}

export function noteSectionCode(note: Pick<Note, 'section'>): string | null {
  return typeof note.section === 'string' && note.section ? note.section : null;
}

export function noteSearchText(note: Pick<Note, 'searchText'>): string {
  return typeof note.searchText === 'string' ? note.searchText : '';
}

/** Delkapittelet notatet hører til (bare hvis koden finnes i kapittelet). */
export function noteSection(note: Pick<Note, 'section'>, chapter: Chapter | null | undefined): Section | null {
  const code = noteSectionCode(note);
  if (!code) return null;
  return sectionsOf(chapter).find((s) => s.code === code) ?? null;
}

/** Kompetansemålene til et notat = målene til delkapittelet. */
export function noteAimCodes(note: Pick<Note, 'section'>, chapter: Chapter | null | undefined): string[] {
  const aims = noteSection(note, chapter)?.aims;
  return Array.isArray(aims) ? aims : [];
}

/** «2E Newtons 2. lov» */
export function sectionLabel(s: Pick<Section, 'code' | 'title'>): string {
  return `${s.code} ${s.title}`;
}

/** Forkortet målformulering til nedtrekkslister. */
export function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  const space = cut.lastIndexOf(' ');
  return `${(space > max * 0.6 ? cut.slice(0, space) : cut).replace(/[\s,.;:–-]+$/, '')}…`;
}

/** Kode → mål, for oppslag av teksten til en KM-brikke. */
export function aimMap(subject: Pick<Subject, 'aims'> | null | undefined): Map<string, CompetenceAim> {
  return new Map(aimsOf(subject).map((a) => [a.code, a]));
}

/** Sorterer KM-koder naturlig (KM2 før KM10). */
export function compareAimCodes(a: string, b: string): number {
  return a.localeCompare(b, 'nb', { numeric: true });
}

// ---------- Gruppering ----------

export interface NoteGroup {
  key: string;
  /** Kode i monospace foran tittelen, f.eks. «2E» eller kapittelnummer. */
  code: string | null;
  title: string;
  /** Anker-id i DOM, slik at f.eks. søk kan rulle til gruppen. */
  anchor: string;
  /** Kapittel-id når gruppene er kapitler. */
  chapterId?: string | null;
  notes: Note[];
}

export function sectionAnchor(code: string): string {
  return `del-${code.replace(/[^\w-]/g, '_')}`;
}

/**
 * Notatene i et kapittel gruppert etter delkapittel i bokas rekkefølge.
 * Delkapitler uten notater utelates; notater uten (gyldig) delkapittel havner sist.
 */
export function groupBySection(chapter: Chapter | null | undefined, notes: Note[]): NoteGroup[] {
  const sections = sectionsOf(chapter);
  const byCode = new Map<string, Note[]>();
  const rest: Note[] = [];
  const known = new Set(sections.map((s) => s.code));
  for (const n of notes) {
    const code = noteSectionCode(n);
    if (code && known.has(code)) {
      const list = byCode.get(code) ?? [];
      list.push(n);
      byCode.set(code, list);
    } else {
      rest.push(n);
    }
  }
  const groups: NoteGroup[] = [];
  for (const s of sections) {
    const list = byCode.get(s.code);
    if (list?.length) {
      groups.push({ key: `s:${s.code}`, code: s.code, title: s.title, anchor: sectionAnchor(s.code), notes: list.sort(compareNotes) });
    }
  }
  if (rest.length) {
    groups.push({
      key: 's:',
      code: null,
      title: sections.length ? 'Uten delkapittel' : 'Notater',
      anchor: 'del-uten',
      notes: rest.sort(compareNotes),
    });
  }
  return groups;
}

/** Notater gruppert etter kapittel i rekkefølge, med «Uten kapittel» sist. */
export function groupByChapter(chapters: Chapter[], notes: Note[]): NoteGroup[] {
  const byId = new Map<string, Note[]>();
  const rest: Note[] = [];
  const known = new Set(chapters.map((c) => c.id));
  for (const n of notes) {
    if (n.chapterId && known.has(n.chapterId)) {
      const list = byId.get(n.chapterId) ?? [];
      list.push(n);
      byId.set(n.chapterId, list);
    } else {
      rest.push(n);
    }
  }
  const groups: NoteGroup[] = [];
  for (const c of [...chapters].sort(compareChapters)) {
    const list = byId.get(c.id);
    if (list?.length) {
      groups.push({ key: `c:${c.id}`, code: c.number, title: c.title, anchor: `kap-${c.id}`, chapterId: c.id, notes: list.sort(compareNotes) });
    }
  }
  if (rest.length) {
    groups.push({ key: 'c:', code: null, title: 'Uten kapittel', anchor: 'kap-uten', chapterId: null, notes: rest.sort(compareNotes) });
  }
  return groups;
}

/** Antall notater per kompetansemål i et fag. */
export function aimCounts(chapters: Chapter[], notes: Note[]): Map<string, number> {
  const byId = new Map(chapters.map((c) => [c.id, c]));
  const counts = new Map<string, number>();
  for (const n of notes) {
    for (const code of noteAimCodes(n, n.chapterId ? byId.get(n.chapterId) : null)) {
      counts.set(code, (counts.get(code) ?? 0) + 1);
    }
  }
  return counts;
}

/** Notatene i faget som dekker et gitt kompetansemål. */
export function notesForAim(chapters: Chapter[], notes: Note[], aim: string): Note[] {
  const byId = new Map(chapters.map((c) => [c.id, c]));
  return notes.filter((n) => noteAimCodes(n, n.chapterId ? byId.get(n.chapterId) : null).includes(aim));
}
