import { createStore } from './store';

/** Fargetema per enhet. `system` følger operativsystemet. */
export type ThemePref = 'light' | 'dark' | 'system';

/** Samme nøkkel og farger som det lille skriptet i index.html (som kjører før første opptegning). */
const KEY = 'smartnotes:theme';
const THEME_COLORS = { light: '#f5f6f8', dark: '#0f1318' } as const;

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
    meta.content = THEME_COLORS[scheme];
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
