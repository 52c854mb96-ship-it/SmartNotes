/**
 * Det øvingen (`PracticeSession` i Practice.tsx) deler med formene: utvalget, nivåene, kortet som vises, angring,
 * tilbakemelding og pauseklokka. Hver form (`MasteryRound`, `QuickRound`, `ClassicPass`) får dette som `Session` og
 * står for sin egen runde.
 */
import { useCallback, useEffect, useRef, useState, type Dispatch, type RefObject, type SetStateAction } from 'react';
import type { Flashcard } from '@smartnotes/shared';
import type { PracticeLength, PracticeMode, PracticeOrder } from '../db';
import type { CardFaceState } from './CardFace';
import type { Filter, Round, Tone } from './model';

/** Utvalget i øvingen: filteret, rekkefølgen og formen. Et nytt utvalg (`restart`) starter en ny runde. */
export type ViewFilter = Filter & {
  order: PracticeOrder;
  mode: PracticeMode;
  /** Lengde: korte økter på 10 eller 20 kort (null = hele utvalget). Brukes ikke i Klassisk. */
  length: PracticeLength | null;
  /** Hva `subset` er: en repetisjon etter runden (standard) eller en kort økt. */
  subsetKind?: 'repeat' | 'chunk';
  /** Kortene eleven har hatt i denne omgangen med korte økter (Rask runde og Luketekst, se `pickChunk`). */
  seen: string[];
};

/** Formene med «Lengde». Klassisk er rask nok uten. */
export const usesLength = (mode: PracticeMode): boolean => mode !== 'classic';

/** «Neste 10 kort» etter en kort økt. */
export interface NextChunk {
  /** Antall kort i den neste økta (færre enn lengden mot slutten av utvalget). */
  count: number;
  start: () => void;
}

export interface UndoEntry {
  round: Round;
  cardId: string;
  level: number;
  /** Beste rekke før vurderingen (angring setter den tilbake, som i originalen). */
  best: number;
}

/** Linja under knappene som sier hva vurderingen gjorde. Forsvinner av seg selv. */
export interface Feedback {
  text: string;
  tone: Tone | '';
  set: (text: string, tone: Tone | '') => void;
}

export function useFeedback(): Feedback {
  const [state, setState] = useState<{ text: string; tone: Tone | '' }>({ text: '', tone: '' });
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const set = useCallback((text: string, tone: Tone | '') => {
    setState({ text, tone });
    clearTimeout(timer.current);
    if (text) timer.current = setTimeout(() => setState({ text: '', tone: '' }), 3500);
  }, []);
  useEffect(() => () => clearTimeout(timer.current), []);
  return { text: state.text, tone: state.tone, set };
}

/** Beste rekke i kortstokken. */
export interface BestStreak {
  value: number;
  /** Ny rekord fra en vurdering. */
  record: (best: number) => void;
  /** En angring setter rekorden tilbake. */
  restore: (best: number) => void;
}

export interface Session {
  /** Alle kortene i kortstokken, med nivåene fra vurderinger databasen ennå ikke har tatt igjen. */
  cards: Flashcard[];
  /** Kortene i utvalget, i kortstokkens rekkefølge. */
  selection: Flashcard[];
  /** Kortet som vises (undefined = runden er ferdig). */
  current: Flashcard | undefined;
  filter: ViewFilter;
  /** Notatene kortene er laget fra (og `OWN_CARDS`), i kortstokkens rekkefølge. */
  groups: string[];
  groupName: (group: string) => string;
  /** Setter nivået for kortene her og nå, også på de andre enhetene. */
  setLevels: (ids: string[], level: number) => void;
  best: BestStreak;
  /** Ny runde med utvalget `next`. Nivåene til `resetIds` settes til 0 først. */
  restart: (next: ViewFilter, resetIds?: string[]) => void;
  /** «Nullstill fremgang i dette utvalget», etter en bekreftelse. */
  resetProgress: () => Promise<void>;
  /** Den neste korte økta når en lengde er valgt, ellers null. */
  nextChunk: NextChunk | null;
  face: CardFaceState;
  undoStack: UndoEntry[];
  setUndoStack: Dispatch<SetStateAction<UndoEntry[]>>;
  feedback: Feedback;
  /** En handling i øvingen (pauseklokka). */
  tick: () => void;
  /** Tastatursnarveiene er på: fanen vises, og det er ikke pause. */
  keysOn: boolean;
  /** Skjult område der skjermlesere får meldingene (`toast`). */
  liveRef: RefObject<HTMLDivElement | null>;
}
