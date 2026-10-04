import { lazy } from 'react';
import type { Subject, SubjectProfile } from '@smartnotes/shared';
import type { VizEntry, VizMeta } from './types';
import fysikk from './fysikk';
import kjemi from './kjemi';
import biologi from './biologi';

/**
 * Alle visualiseringer per fagtype, i kapittelrekkefølge. Hvert fag har sin egen mappe (`fysikk/`, `kjemi/`,
 * `biologi/`) med én undermappe per kapittel, og hvert kapittel eier sin egen `kapNN/index.ts`.
 * Nye visualiseringer legges til der (ikke her).
 */
const META_BY_PROFILE: Record<SubjectProfile, VizMeta[]> = { physics: fysikk, chemistry: kjemi, biology: biologi };

export function vizKey(m: Pick<VizMeta, 'chapter' | 'id'>): string {
  return `k${m.chapter}-${m.id}`;
}

const ENTRIES_BY_PROFILE = Object.fromEntries(
  (Object.keys(META_BY_PROFILE) as SubjectProfile[]).map((profile) => [
    profile,
    META_BY_PROFILE[profile].map((m): VizEntry => ({ ...m, profile, key: vizKey(m), Component: lazy(m.load) })),
  ]),
) as Record<SubjectProfile, VizEntry[]>;

const BY_KEY = new Map(
  Object.values(ENTRIES_BY_PROFILE)
    .flat()
    .map((e) => [`${e.profile}/${e.key}`, e]),
);

type Profile = SubjectProfile | null | undefined;

/** Alle visualiseringene for en fagtype, i kapittelrekkefølge. */
export function vizEntries(profile: Profile): VizEntry[] {
  return (profile && ENTRIES_BY_PROFILE[profile]) || [];
}

export function getViz(profile: Profile, key: string | undefined): VizEntry | undefined {
  return profile && key ? BY_KEY.get(`${profile}/${key}`) : undefined;
}

/** Visualiseringer for et kapittelnummer (f.eks. «2»), i registrert rekkefølge. */
export function vizForChapter(profile: Profile, chapter: string | null | undefined): VizEntry[] {
  if (!chapter) return [];
  return vizEntries(profile).filter((e) => e.chapter === chapter);
}

/**
 * Visualiseringer for et delkapittel (f.eks. «2C»). Kodene starter med kapittelnummeret, så de er unike i boka,
 * og en visualisering kan høre til delkapitler i flere kapitler (f.eks. atommodellen i både 7A og 8A).
 */
export function vizForSection(profile: Profile, section: string | null | undefined): VizEntry[] {
  if (!section) return [];
  return vizEntries(profile).filter((e) => e.sections.includes(section));
}

/** Enkelt søk i tittel, sammendrag, delkapittel og søkeord. */
export function matchesViz(e: VizEntry, query: string): boolean {
  const q = query.trim().toLocaleLowerCase('nb');
  if (!q) return true;
  const hay = [e.title, e.summary, ...e.sections, ...(e.keywords ?? [])].join(' ').toLocaleLowerCase('nb');
  return q.split(/\s+/).every((w) => hay.includes(w));
}

/** Kapittelnumrene som har visualiseringer, i stigende rekkefølge. */
export function vizChapterNumbers(profile: Profile): string[] {
  return [...new Set(vizEntries(profile).map((e) => e.chapter))].sort((a, b) => Number(a) - Number(b));
}

/** Visualiseringene er laget etter kapitlene i læreboka til hver fagtype (ERGO Fysikk 1, Kjemi 1, Bi 1). */
export function hasVisualizations(subject: Pick<Subject, 'profile'> | null | undefined): boolean {
  return vizEntries(subject?.profile).length > 0;
}
