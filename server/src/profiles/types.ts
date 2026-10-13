import type { SubjectProfile } from '@smartnotes/shared';

/** En fagprofil: LaTeX-mal og instruksjoner til Claude. Nye fag legges til som nye profiler. */
export interface Profile {
  id: SubjectProfile;
  label: string;
  preamblePath: string;
  /** Stabil systeminstruks for konvertering (caches). */
  systemPrompt: string;
  /** Instruks når LaTeX-koden ikke kompilerte. */
  fixInstructions: string;
  /** Instruks for å lese av en innholdsfortegnelse fra bilde. */
  tocPrompt: string;
  /**
   * De presise reglene (`profiles/precise.ts`), seksjon 7 i instruksen for alle Claude-modeller: konkrete regler og
   * maler for fagets tegninger. Lokale modeller (Ollama) får bare `systemPrompt`.
   */
  preciseRules: string;
}
