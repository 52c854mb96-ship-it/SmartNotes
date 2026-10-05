import { useMemo, useState } from 'react';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import type { Deck, Flashcard, Note } from '@smartnotes/shared';
import { errorMessage } from '../api';
import { confirmDialog, toast } from '../lib/ui';
import { plural } from '../lib/format';
import { deleteCard } from './actions';
import { CardEditor } from './CardEditor';
import { KIND_LABEL } from './labels';
import { MASTER, OWN_CARDS, levelOf } from './model';
import { parseBackLine, plainText } from './richtext';
import { RichParagraphs, RichText } from './RichText';

/** Alle kortene i kortstokken, gruppert per notat, med søk, redigering og sletting (som «Mål-mal» i originalen). */
export function CardList({ deck, cards, notes }: { deck: Deck; cards: Flashcard[]; notes: Note[] }) {
  const [query, setQuery] = useState('');
  const [editing, setEditing] = useState<Flashcard | null | 'new'>(null);
  const titles = useMemo(() => new Map(notes.map((n) => [n.id, n.title || 'Notat uten tittel'])), [notes]);

  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();
    const match = (c: Flashcard) =>
      !q || [c.front, ...c.back, c.detail].some((t) => plainText(t).toLowerCase().includes(q));
    const order = [...deck.noteIds];
    for (const c of cards) if (c.noteId && !order.includes(c.noteId)) order.push(c.noteId);
    order.push(OWN_CARDS);
    return order
      .map((g) => ({
        id: g,
        name: g === OWN_CARDS ? 'Egne kort' : (titles.get(g) ?? 'Slettet notat'),
        cards: cards.filter((c) => (c.noteId ?? OWN_CARDS) === g && match(c)),
      }))
      .filter((g) => g.cards.length > 0);
  }, [cards, deck.noteIds, query, titles]);
  const hits = groups.reduce((n, g) => n + g.cards.length, 0);

  const remove = async (card: Flashcard) => {
    const ok = await confirmDialog({
      title: 'Slette kortet?',
      body: `«${plainText(card.front)}» slettes fra kortstokken på alle enhetene dine.`,
      confirmLabel: 'Slett',
      danger: true,
    });
    if (!ok) return;
    try {
      await deleteCard(card.id);
      toast('Kortet er slettet.', { kind: 'success' });
    } catch (err) {
      toast(errorMessage(err, 'Kunne ikke slette kortet.'), { kind: 'error' });
    }
  };

  return (
    <div className="fc-list">
      <div className="fc-list-toolbar">
        <input
          type="search"
          placeholder="Søk i kortene"
          aria-label="Søk i kortene"
          value={query}
          onChange={(e) => setQuery(e.currentTarget.value)}
        />
        <button type="button" className="btn" onClick={() => setEditing('new')}>
          <Plus size={18} aria-hidden /> Nytt kort
        </button>
      </div>
      {query && (
        <p className="muted small" role="status">
          {plural(hits, 'treff', 'treff')}
        </p>
      )}
      {groups.length === 0 && <p className="muted">{query ? 'Ingen treff. Prøv et annet søkeord.' : 'Kortstokken har ingen kort.'}</p>}
      {groups.map((g) => (
        <section key={g.id} className="fc-list-group" aria-label={g.name}>
          <h3 className="fc-list-title">{g.name}</h3>
          {g.cards.map((c) => (
            <details key={c.id} className="fc-item" open={!!query}>
              <summary>
                <span className={`fc-tag fc-tag-${c.kind}`}>{KIND_LABEL[c.kind]}</span>
                <span className="fc-item-front">
                  <RichText text={c.front} />
                </span>
                <span className="fc-dots" role="img" aria-label={`Nivå ${levelOf(c)} av ${MASTER}`}>
                  {Array.from({ length: MASTER }, (_, i) => (
                    <i key={i} className={i < levelOf(c) ? 'is-on' : undefined} />
                  ))}
                </span>
              </summary>
              <div className="fc-item-body">
                <ul className="fc-answer">
                  {c.back.map((line, i) => {
                    const l = parseBackLine(line);
                    return (
                      <li key={i} className={l.label ? 'is-label' : undefined}>
                        <RichText text={l.text} />
                      </li>
                    );
                  })}
                </ul>
                {c.detail && (
                  <div className="fc-detail">
                    <RichParagraphs text={c.detail} />
                  </div>
                )}
                <div className="fc-item-actions">
                  <button type="button" className="btn btn-sm" onClick={() => setEditing(c)}>
                    <Pencil size={15} aria-hidden /> Rediger
                  </button>
                  <button type="button" className="btn btn-sm btn-ghost" onClick={() => void remove(c)}>
                    <Trash2 size={15} aria-hidden /> Slett
                  </button>
                </div>
              </div>
            </details>
          ))}
        </section>
      ))}
      <CardEditor open={editing !== null} deckId={deck.id} card={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />
    </div>
  );
}
