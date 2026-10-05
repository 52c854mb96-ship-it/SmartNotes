/** Lesehooks for flashcards. `undefined` betyr «laster», `null` betyr «finnes ikke». */
import { useLiveQuery } from 'dexie-react-hooks';
import type { Deck, Flashcard } from '@smartnotes/shared';
import { db, type PracticeState } from '../db';

export function useDecks(subjectId: string | undefined): Deck[] | undefined {
  return useLiveQuery(async () => {
    if (!subjectId) return [];
    const rows = await db.decks.where('subjectId').equals(subjectId).toArray();
    return rows.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }, [subjectId]);
}

export function useDeck(id: string | undefined): Deck | null | undefined {
  return useLiveQuery(async () => (id ? ((await db.decks.get(id)) ?? null) : null), [id]);
}

export function useDeckCards(deckId: string | undefined): Flashcard[] | undefined {
  return useLiveQuery(async () => {
    if (!deckId) return [];
    const rows = await db.cards.where('deckId').equals(deckId).toArray();
    return rows.sort((a, b) => a.position - b.position);
  }, [deckId]);
}

/** Kortene i alle kortstokkene i faget, gruppert per kortstokk (til oversikten). */
export function useSubjectCards(subjectId: string | undefined): Map<string, Flashcard[]> | undefined {
  return useLiveQuery(async () => {
    const map = new Map<string, Flashcard[]>();
    if (!subjectId) return map;
    const deckIds = await db.decks.where('subjectId').equals(subjectId).primaryKeys();
    const cards = await db.cards.where('deckId').anyOf(deckIds).toArray();
    for (const c of cards) {
      const list = map.get(c.deckId) ?? [];
      list.push(c);
      map.set(c.deckId, list);
    }
    return map;
  }, [subjectId]);
}

/** Lagret økt for kortstokken på denne enheten (`null` = ingen). */
export function usePracticeState(deckId: string | undefined): PracticeState | null | undefined {
  return useLiveQuery(async () => (deckId ? ((await db.practice.get(deckId)) ?? null) : null), [deckId]);
}
