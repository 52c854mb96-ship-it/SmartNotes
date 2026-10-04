import { lazy } from 'react';
import type { Subject } from '@smartnotes/shared';
import type { VizEntry, VizMeta } from './types';
import kap01 from './kap01';
import kap02 from './kap02';
import kap03 from './kap03';
import kap04 from './kap04';
import kap05 from './kap05';
import kap06 from './kap06';
import kap07 from './kap07';
import kap08 from './kap08';
import kap09 from './kap09';
import kap10 from './kap10';

/**
 * Alle visualiseringer, i kapittelrekkefølge. Hvert kapittel eier sin egen `kapNN/index.ts`,
 * så nye visualiseringer legges til der (ikke her).
 */
const ALL_META: VizMeta[] = [...kap01, ...kap02, ...kap03, ...kap04, ...kap05, ...kap06, ...kap07, ...kap08, ...kap09, ...kap10];

export const VIZ_ENTRIES: VizEntry[] = ALL_META.map((m) => ({
  ...m,
  key: vizKey(m),
  Component: lazy(m.load),
}));

export function vizKey(m: Pick<VizMeta, 'chapter' | 'id'>): string {
  return `k${m.chapter}-${m.id}`;
}

const BY_KEY = new Map(VIZ_ENTRIES.map((e) => [e.key, e]));

export function getViz(key: string | undefined): VizEntry | undefined {
  return key ? BY_KEY.get(key) : undefined;
}

/** Visualiseringer for et kapittelnummer (f.eks. «2»), i registrert rekkefølge. */
export function vizForChapter(chapter: string | null | undefined): VizEntry[] {
  if (!chapter) return [];
  return VIZ_ENTRIES.filter((e) => e.chapter === chapter);
}

/** Visualiseringer for et delkapittel (f.eks. «2C»). */
export function vizForSection(section: string | null | undefined): VizEntry[] {
  if (!section) return [];
  return VIZ_ENTRIES.filter((e) => e.sections.includes(section));
}

/** Enkelt søk i tittel, sammendrag, delkapittel og søkeord. */
export function matchesViz(e: VizEntry, query: string): boolean {
  const q = query.trim().toLocaleLowerCase('nb');
  if (!q) return true;
  const hay = [e.title, e.summary, ...e.sections, ...(e.keywords ?? [])].join(' ').toLocaleLowerCase('nb');
  return q.split(/\s+/).every((w) => hay.includes(w));
}

/** Kapittelnumrene som har visualiseringer, i stigende rekkefølge. */
export function vizChapterNumbers(): string[] {
  return [...new Set(VIZ_ENTRIES.map((e) => e.chapter))].sort((a, b) => Number(a) - Number(b));
}

/** Visualiseringene er laget for Fysikk 1 og vises bare for fysikkfag. */
export function hasVisualizations(subject: Pick<Subject, 'profile'> | null | undefined): boolean {
  return subject?.profile === 'physics' && VIZ_ENTRIES.length > 0;
}
