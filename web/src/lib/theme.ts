import { createStore } from './store';

/** Fargetema per enhet. `system` følger operativsystemet. */
export type ThemePref = 'light' | 'dark' | 'system';

/** Samme nøkkel og farger som det lille skriptet i index.html (som kjører før første opptegning). */
const KEY = 'smartnotes:theme';
const SUBJECT_KEY = 'smartnotes:subjectTheme';
/** Bakgrunnsfargen per fag (samme som --bg i base.css og subjects.css), til statuslinja i nettleseren. */
const THEME_COLORS = {
  physics: { light: '#f5f6f8', dark: '#0f1318' },
  chemistry: { light: '#f3f4ef', dark: '#1b2420' },
  biology: { light: '#fafaf7', dark: '#141814' },
} as const;

type SubjectTheme = keyof typeof THEME_COLORS;
let subjectTheme: SubjectTheme = 'physics';

function readPref(): ThemePref {
  try {
    const v = localStorage.getItem(KEY);
    return v === 'light' || v === 'dark' ? v : 'system';
  } catch {
    return 'system';
  }
}

export const themeStore = createStore<ThemePref>(readPref());

function apply(pref: ThemePref): void {
  const root = document.documentElement;
  if (pref === 'system') root.removeAttribute('data-theme');
  else root.setAttribute('data-theme', pref);
  // Fargen på statuslinja/fanelinja (iOS, Android, Safari).
  for (const meta of document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]')) {
    const forDark = (meta.getAttribute('media') ?? '').includes('dark');
    const scheme = pref === 'system' ? (forDark ? 'dark' : 'light') : pref;
    meta.content = THEME_COLORS[subjectTheme][scheme];
  }
}

/** Fargetema for faget som er åpent (fysikk = standard). Settes av AppShell. */
export function setSubjectTheme(profile: string | null | undefined): void {
  const next: SubjectTheme = profile === 'chemistry' || profile === 'biology' ? profile : 'physics';
  if (next === subjectTheme && document.documentElement.dataset.subject === (next === 'physics' ? undefined : next)) return;
  subjectTheme = next;
  if (next === 'physics') delete document.documentElement.dataset.subject;
  else document.documentElement.dataset.subject = next;
  apply(themeStore.get());
  // Huskes til neste oppstart, så skriptet i index.html kan bruke riktig fagtema før første opptegning.
  try {
    localStorage.setItem(SUBJECT_KEY, next);
  } catch {
    /* ignorer */
  }
}

export function setTheme(pref: ThemePref): void {
  try {
    if (pref === 'system') localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, pref);
  } catch {
    /* privat modus o.l. – gjelder bare denne økta */
  }
  apply(pref);
  themeStore.set(pref);
}

/** Kalles ved oppstart for å sikre at attributt og meta-farger stemmer (skriptet i index.html gjør det meste). */
export function initTheme(): void {
  apply(themeStore.get());
}

export const THEME_OPTIONS: { value: ThemePref; label: string }[] = [
  { value: 'light', label: 'Lys' },
  { value: 'dark', label: 'Mørk' },
  { value: 'system', label: 'System' },
];
