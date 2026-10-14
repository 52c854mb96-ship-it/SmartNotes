import { useEffect } from 'react';

/**
 * Navnet på forsiden, i fanen og når appen installeres. web/index.html og manifestet i vite.config.ts har det
 * samme navnet.
 */
export const APP_TITLE = 'SmartNotes – Realfag VGS';

/** Fanetittelen: «<side> – SmartNotes» på de indre sidene, og hele navnet uten side (forsiden). */
export function useDocumentTitle(title: string | null | undefined): void {
  useEffect(() => {
    document.title = title ? `${title} – SmartNotes` : APP_TITLE;
  }, [title]);
}
