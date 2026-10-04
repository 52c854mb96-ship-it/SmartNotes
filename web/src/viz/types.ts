import type { ComponentType } from 'react';

/**
 * En interaktiv visualisering. Hvert kapittel eksporterer en liste med disse fra `kapNN/index.ts`.
 * Selve komponenten lastes først når den åpnes (`load`), så oversiktssiden er rask.
 */
export interface VizMeta {
  /** Kort id innen kapittelet, små bokstaver og bindestrek, f.eks. «friksjon». */
  id: string;
  /** Kapittelnummer i ERGO Fysikk 1, f.eks. «2». */
  chapter: string;
  /** Delkapitlene visualiseringen hører til, f.eks. ["2C"]. */
  sections: string[];
  /** Kort tittel, stor forbokstav bare i første ord: «Statisk friksjon og glidefriksjon». */
  title: string;
  /** Én til to setninger om hva du kan utforske. */
  summary: string;
  /** Ekstra søkeord (valgfritt). */
  keywords?: string[];
  load: () => Promise<{ default: ComponentType }>;
}

export interface VizEntry extends VizMeta {
  /** Unik nøkkel i URL-en: `k{kapittel}-{id}`, f.eks. «k2-friksjon». */
  key: string;
  Component: ComponentType;
}
