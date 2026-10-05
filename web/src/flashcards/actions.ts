/**
 * Endringer i kortstokker og kort. Opprettelse, redigering og sletting går via serveren (krever nett), som resten av
 * appen. Fremgang fra øving lagres lokalt med en gang og sendes når det er nett (se `flushProgress` i sync.ts).
 */
import type { CreateDeckRequest, Deck, FlashcardInput, UpdateFlashcardRequest } from '@smartnotes/shared';
import { api } from '../api';
import { db, type PracticeState } from '../db';
import { applyServerRows, syncNow, syncProgressSoon } from '../sync';

// ---------- Kortstokker ----------

export async function createDeck(req: CreateDeckRequest): Promise<Deck> {
  const deck = await api.createDeck(req);
  await applyServerRows({ decks: [deck] });
  void syncNow();
  return deck;
}

export async function renameDeck(id: string, title: string): Promise<Deck> {
  const deck = await api.updateDeck(id, { title });
  await applyServerRows({ decks: [deck] });
  void syncNow();
  return deck;
}

export async function retryDeck(id: string): Promise<Deck> {
  const deck = await api.retryDeck(id);
  await applyServerRows({ decks: [deck] });
  void syncNow();
  return deck;
}

export async function deleteDeck(id: string): Promise<void> {
  await api.deleteDeck(id);
  await db.transaction('rw', [db.decks, db.cards, db.practice, db.progress], async () => {
    const cardIds = await db.cards.where('deckId').equals(id).primaryKeys();
    await db.progress.bulkDelete([`deck:${id}`, ...cardIds.map((c) => `card:${c}`)]);
    await db.cards.bulkDelete(cardIds);
    await db.practice.delete(id);
    await db.decks.delete(id);
  });
  void syncNow();
}

// ---------- Kort ----------

export async function createCard(deckId: string, input: FlashcardInput) {
  const card = await api.createCard(deckId, input);
  await applyServerRows({ cards: [card] });
  void syncNow();
  return card;
}

export async function updateCard(id: string, req: UpdateFlashcardRequest) {
  const card = await api.updateCard(id, req);
  await applyServerRows({ cards: [card] });
  void syncNow();
  return card;
}

export async function deleteCard(id: string): Promise<void> {
  await api.deleteCard(id);
  await db.transaction('rw', [db.cards, db.progress], async () => {
    await db.cards.delete(id);
    await db.progress.delete(`card:${id}`);
  });
  void syncNow();
}

// ---------- Fremgang (fungerer offline) ----------

/** Setter mestringsnivået for kortene her og nå, og legger endringen i køen til serveren. */
export async function setCardLevels(ids: string[], level: number, at = new Date().toISOString()): Promise<void> {
  if (!ids.length) return;
  await db.transaction('rw', [db.cards, db.progress], async () => {
    for (const id of ids) {
      const updated = await db.cards.update(id, { level, levelAt: at });
      if (updated) await db.progress.put({ key: `card:${id}`, type: 'card', id, level, at });
    }
  });
  syncProgressSoon();
}

/** Ny beste rekke for kortstokken (bare hvis den er høyere enn før). */
export async function recordBest(deckId: string, best: number): Promise<void> {
  await db.transaction('rw', [db.decks, db.progress], async () => {
    const deck = await db.decks.get(deckId);
    if (!deck || deck.best >= best) return;
    await db.decks.update(deckId, { best });
    await db.progress.put({ key: `deck:${deckId}`, type: 'deck', id: deckId, best });
  });
  syncProgressSoon();
}

/**
 * Angring av en vurdering som ga ny rekord: rekorden settes tilbake lokalt og i køen til serveren. Er den høyere
 * rekorden alt sendt, blir den stående der (høyeste verdi vinner), og kommer tilbake ved neste fulle synk.
 */
export async function restoreBest(deckId: string, best: number): Promise<void> {
  await db.transaction('rw', [db.decks, db.progress], async () => {
    const deck = await db.decks.get(deckId);
    if (deck && deck.best > best) await db.decks.update(deckId, { best });
    const key = `deck:${deckId}`;
    if (await db.progress.get(key)) await db.progress.put({ key, type: 'deck', id: deckId, best });
  });
}

/** Øktene lagres bare på denne enheten. */
export async function savePractice(state: PracticeState): Promise<void> {
  await db.practice.put({ ...state, updatedAt: Date.now() });
}
