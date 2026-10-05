import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router';
import { ChevronLeft, CircleAlert, ListChecks, Pencil, RotateCcw, Trash2, GalleryVerticalEnd } from 'lucide-react';
import type { Deck, Flashcard, Note } from '@smartnotes/shared';
import { errorMessage } from '../api';
import { PageSkeleton } from '../components/EmptyState';
import { Menu } from '../components/Menu';
import { Modal } from '../components/Modal';
import { useSubject, useSubjectNotes } from '../data';
import { deleteDeck, renameDeck, retryDeck, setCardLevels } from '../flashcards/actions';
import { CardList } from '../flashcards/CardList';
import { useDeck, useDeckCards } from '../flashcards/data';
import { DIFFICULTY_LABEL } from '../flashcards/labels';
import { Practice } from '../flashcards/Practice';
import { db } from '../db';
import { plural } from '../lib/format';
import { confirmDialog, toast } from '../lib/ui';
import { useDocumentTitle } from '../lib/useDocumentTitle';
import { NotFoundPage } from './NotFoundPage';

type Tab = 'ov' | 'kort';

/** Én kortstokk: øving og alle kortene (faner, som i originalen). */
export function DeckPage() {
  const { subjectId, deckId } = useParams();
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const subject = useSubject(subjectId);
  const deck = useDeck(deckId);
  const cards = useDeckCards(deckId);
  const notes = useSubjectNotes(subjectId);
  const [renaming, setRenaming] = useState(false);
  // Øvingen tas ned mens fremgangen nullstilles, så den ikke lagrer den gamle økta på nytt.
  const [resetting, setResetting] = useState(false);
  useDocumentTitle(deck ? `${deck.title} · Flashcards` : null);

  if (subject === undefined || deck === undefined || cards === undefined || notes === undefined) return <PageSkeleton />;
  if (subject === null) return <NotFoundPage what="faget" />;
  if (deck === null || deck.subjectId !== subject.id) return <NotFoundPage what="kortstokken" />;

  const tab: Tab = params.get('vis') === 'kort' ? 'kort' : 'ov';
  const setTab = (t: Tab) => setParams(t === 'kort' ? { vis: 'kort' } : {}, { replace: true });
  const noteCount = new Set(cards.map((c) => c.noteId).filter(Boolean)).size;

  const remove = async () => {
    const ok = await confirmDialog({
      title: 'Slette kortstokken?',
      body: `«${deck.title}» og ${plural(cards.length, 'kort', 'kort')} slettes på alle enhetene dine. Notatene beholdes.`,
      confirmLabel: 'Slett',
      danger: true,
    });
    if (!ok) return;
    try {
      await deleteDeck(deck.id);
      toast('Kortstokken er slettet.', { kind: 'success' });
      navigate(`/fag/${subject.id}/flashcards`, { replace: true });
    } catch (err) {
      toast(errorMessage(err, 'Kunne ikke slette kortstokken.'), { kind: 'error' });
    }
  };

  const resetAll = async () => {
    const ok = await confirmDialog({
      title: 'Nullstille all fremgang?',
      body: 'Alle kortene i kortstokken settes tilbake til nivå 0, også på de andre enhetene dine.',
      confirmLabel: 'Nullstill',
      danger: true,
    });
    if (!ok) return;
    setResetting(true);
    try {
      await setCardLevels(
        cards.map((c) => c.id),
        0,
      );
      await db.practice.delete(deck.id);
      toast('Fremgangen er nullstilt.', { kind: 'success' });
    } finally {
      setResetting(false);
    }
  };

  return (
    <div className="page page-narrow">
      <nav className="breadcrumb" aria-label="Brødsmuler">
        <Link to={`/fag/${subject.id}/flashcards`}>
          <ChevronLeft size={16} aria-hidden />
          Flashcards
        </Link>
      </nav>
      <header className="page-header">
        <div className="page-heading">
          <p className="eyebrow">Kortstokk · {DIFFICULTY_LABEL[deck.difficulty]}</p>
          <h1 className="page-title">{deck.title}</h1>
          {deck.status === 'ready' && (
            <p className="page-subtitle">
              {plural(cards.length, 'kort', 'kort')}
              {noteCount > 0 && ` fra ${plural(noteCount, 'notat', 'notater')}`}
            </p>
          )}
        </div>
        <div className="page-actions">
          <Menu
            label="Mer"
            items={[
              { label: 'Gi nytt navn', icon: <Pencil size={16} aria-hidden />, onSelect: () => setRenaming(true) },
              {
                label: 'Nullstill fremgang',
                icon: <RotateCcw size={16} aria-hidden />,
                onSelect: () => void resetAll(),
                disabled: cards.length === 0,
              },
              { label: 'Slett kortstokken', icon: <Trash2 size={16} aria-hidden />, onSelect: () => void remove(), danger: true },
            ]}
          />
        </div>
      </header>

      {deck.status === 'generating' && <Generating />}
      {deck.status === 'failed' && <Failed deck={deck} />}
      {deck.status === 'ready' && (
        <>
          <div className="tabs" role="tablist" aria-label="Visning">
            <button
              type="button"
              role="tab"
              className="tab"
              id="fc-tab-ov"
              aria-selected={tab === 'ov'}
              aria-controls="fc-panel"
              onClick={() => setTab('ov')}
            >
              <GalleryVerticalEnd size={17} aria-hidden /> Øv
            </button>
            <button
              type="button"
              role="tab"
              className="tab"
              id="fc-tab-kort"
              aria-selected={tab === 'kort'}
              aria-controls="fc-panel"
              onClick={() => setTab('kort')}
            >
              <ListChecks size={17} aria-hidden /> Alle kort
            </button>
          </div>
          <div id="fc-panel" role="tabpanel" aria-labelledby={tab === 'ov' ? 'fc-tab-ov' : 'fc-tab-kort'}>
            {tab === 'kort' ? (
              <CardList deck={deck} cards={cards} notes={notes} />
            ) : resetting ? null : (
              <PracticeTab deck={deck} cards={cards} notes={notes} />
            )}
          </div>
        </>
      )}

      <RenameDialog deck={deck} open={renaming} onClose={() => setRenaming(false)} />
    </div>
  );
}

function PracticeTab({ deck, cards, notes }: { deck: Deck; cards: Flashcard[]; notes: Note[] }) {
  if (cards.length === 0) {
    return <p className="muted">Kortstokken har ingen kort. Legg til kort under «Alle kort».</p>;
  }
  return <Practice key={deck.id} deck={deck} cards={cards} notes={notes} />;
}

function Generating() {
  return (
    <section className="fc-status-panel" aria-live="polite">
      <span className="spinner" aria-hidden />
      <div>
        <h2>Lager kortene …</h2>
        <p className="muted">
          Claude leser notatene og skriver spørsmål og svar. Det tar gjerne et halvt til ett par minutter. Du kan gå videre
          til noe annet, kortstokken blir klar her.
        </p>
      </div>
    </section>
  );
}

function Failed({ deck }: { deck: Deck }) {
  const [busy, setBusy] = useState(false);
  const retry = async () => {
    setBusy(true);
    try {
      await retryDeck(deck.id);
    } catch (err) {
      toast(errorMessage(err, 'Kunne ikke prøve igjen.'), { kind: 'error' });
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="fc-status-panel is-error" role="alert">
      <CircleAlert size={22} aria-hidden />
      <div>
        <h2>Kortene kunne ikke lages</h2>
        <p className="muted">{deck.error ?? 'Ukjent feil.'}</p>
        <button type="button" className="btn btn-primary" disabled={busy} onClick={() => void retry()}>
          <RotateCcw size={17} aria-hidden /> Prøv igjen
        </button>
      </div>
    </section>
  );
}

function RenameDialog({ deck, open, onClose }: { deck: Deck; open: boolean; onClose: () => void }) {
  const [title, setTitle] = useState(deck.title);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (!open) return;
    setTitle(deck.title);
    setError(null);
  }, [open, deck.title]);
  const save = async () => {
    if (!title.trim()) return setError('Kortstokken må ha et navn.');
    setBusy(true);
    setError(null);
    try {
      await renameDeck(deck.id, title.trim());
      onClose();
    } catch (err) {
      setError(errorMessage(err, 'Kunne ikke gi nytt navn.'));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal
      open={open}
      onClose={onClose}
      busy={busy}
      size="sm"
      title="Gi nytt navn"
      footer={
        <>
          <button type="button" className="btn" onClick={onClose} disabled={busy}>
            Avbryt
          </button>
          <button type="button" className="btn btn-primary" onClick={() => void save()} disabled={busy}>
            Lagre
          </button>
        </>
      }
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
      >
        <label className="field">
          <span className="field-label">Navn</span>
          <input type="text" value={title} maxLength={120} onChange={(e) => setTitle(e.currentTarget.value)} data-autofocus />
        </label>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
      </form>
    </Modal>
  );
}
