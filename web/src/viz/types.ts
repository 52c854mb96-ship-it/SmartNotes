import type { ComponentType } from 'react';
import type { SubjectProfile } from '@smartnotes/shared';

/**
 * En interaktiv visualisering. Hvert kapittel eksporterer en liste med disse fra `<fag>/kapNN/index.ts`.
 * Selve komponenten lastes først når den åpnes (`load`), så oversiktssiden er rask.
 */
export interface VizMeta {
  /** Kort id innen kapittelet, små bokstaver og bindestrek, f.eks. «friksjon». */
  id: string;
  /** Kapittelnummer i læreboka til faget (f.eks. ERGO Fysikk 1), f.eks. «2». */
  chapter: string;
  /** Delkapitlene visualiseringen hører til, f.eks. ["2C"]. */
  sections: string[];
  /** Kort tittel, stor forbokstav bare i første ord: «Statisk friksjon og glidefriksjon». */
  title: string;
  /** Én til to setninger om hva du kan utforske. */
  summary: string;
  /** Ekstra søkeord (valgfritt). */
  keywords?: string[];
  /**
   * «eksempel» for eksempeloppgaver (en oppgave i eksamensstil med løsning steg for steg, se kit/eksempel.tsx).
   * Id-en starter da med «eks-». Standard er en vanlig visualisering.
   */
  kind?: VizKind;
  load: () => Promise<{ default: ComponentType }>;
}

export type VizKind = 'visualisering' | 'eksempel';

export interface VizEntry extends VizMeta {
  /** Fagtypen visualiseringen hører til. */
  profile: SubjectProfile;
  /** Nøkkel i URL-en, unik innen faget: `k{kapittel}-{id}`, f.eks. «k2-friksjon». */
  key: string;
  Component: ComponentType;
}
