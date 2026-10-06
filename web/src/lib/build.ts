import { createStore } from './store';

/** Byggnummeret til versjonen som kjører (skrives i index.html ved bygging, mangler under utvikling). */
export const RUNNING_BUILD: string | null =
  (typeof document !== 'undefined' && document.querySelector<HTMLMetaElement>('meta[name="smartnotes-build"]')?.content) || null;

/** Byggnummeret serveren sist oppga (headeren `X-SmartNotes-Build` på API-svar). */
export const serverBuildStore = createStore<string | null>(null);
