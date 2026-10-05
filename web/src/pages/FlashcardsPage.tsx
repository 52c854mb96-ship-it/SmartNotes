import { Link, useParams } from 'react-router';
import { AlertCircle, ChevronLeft, GalleryVerticalEnd, Loader2, Plus } from 'lucide-react';
import type { Deck, Flashcard } from '@smartnotes/shared';
import { EmptyState, PageSkeleton } from '../components/EmptyState';
import { useSubject, useSubjectNotes } from '../data';
import { useDecks, useSubjectCards } from '../flashcards/data';
import { DIFFICULTY_LABEL } from '../flashcards/labels';
import { masteredCount, masteryPct } from '../flashcards/model';
import { plural } from '../lib/format';
import { useDocumentTitle } from '../lib/useDocumentTitle';
import { NotFoundPage } from './NotFoundPage';

/** Kortstokkene i et fag. */
export function FlashcardsPage() {
  const { subjectId } = useParams();
  const subject = useSubject(subjectId);
  const decks = useDecks(subjectId);
  const cards = useSubjectCards(subjectId);
  const notes = useSubjectNotes(subjectId);
  useDocumentTitle(subject ? `Flashcards · ${subject.name}` : null);

  if (subject === undefined || decks === undefined || cards === undefined || notes === undefined) return <PageSkeleton />;
  if (subject === null) return <NotFoundPage what="faget" />;

  const doneNotes = notes.filter((n) => n.status === 'done').length;
  const newLink = `/fag/${subject.id}/flashcards/ny`;

  return (
    <div className="page">
      <nav className="breadcrumb" aria-label="Brødsmuler">
        <Link to={`/fag/${subject.id}`}>
          <ChevronLeft size={16} aria-hidden />
          {subject.name}
        </Link>
      </nav>
      <header className="page-header">
        <div className="page-heading">
          <p className="eyebrow">{subject.name}</p>
          <h1 className="page-title">Flashcards</h1>
          <p className="page-subtitle">
            Velg notater, så lager Claude spørsmål og svar. Du vurderer selv hvor godt du kunne hvert kort, og kortene du
            ikke kunne, kommer igjen.
          </p>
        </div>
        {decks.length > 0 && doneNotes > 0 && (
          <div className="page-actions">
            <Link to={newLink} className="btn btn-primary">
              <Plus size={18} aria-hidden /> Ny kortstokk
            </Link>
          </div>
        )}
      </header>

      {decks.length === 0 ? (
        <EmptyState
          icon={<GalleryVerticalEnd size={30} aria-hidden />}
          title="Ingen kortstokker ennå"
          actions={
            doneNotes > 0 ? (
              <Link to={newLink} className="btn btn-primary">
                <Plus size={18} aria-hidden /> Lag den første
              </Link>
            ) : undefined
          }
        >
          <p>
            {doneNotes > 0
              ? 'Marker notatene som skal være med og velg vanskelighetsgrad. Kortene lagres og kan brukes offline på alle enhetene dine.'
              : 'Last opp notater først. Når de er konvertert, kan du lage flashcards av dem.'}
          </p>
        </EmptyState>
      ) : (
        <ul className="fc-deck-grid" role="list">
          {decks.map((d) => (
            <li key={d.id}>
              <DeckCard subjectId={subject.id} deck={d} cards={cards.get(d.id) ?? []} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function DeckCard({ subjectId, deck, cards }: { subjectId: string; deck: Deck; cards: Flashcard[] }) {
  const pct = masteryPct(cards);
  return (
    <Link to={`/fag/${subjectId}/flashcards/${deck.id}`} className="fc-deck-card">
      <span className="fc-deck-title">{deck.title}</span>
      <span className="fc-deck-meta">
        {deck.status === 'generating' ? (
          <span className="with-icon">
            <Loader2 size={15} className="spin" aria-hidden /> Lager kortene …
          </span>
        ) : deck.status === 'failed' ? (
          <span className="with-icon text-danger">
            <AlertCircle size={15} aria-hidden /> Kortene kunne ikke lages
          </span>
        ) : (
          <>
            {plural(cards.length, 'kort', 'kort')} · {DIFFICULTY_LABEL[deck.difficulty]} · {masteredCount(cards)} mestret
          </>
        )}
      </span>
      {deck.status === 'ready' && (
        <span className="fc-bar fc-bar-sm" aria-hidden>
          <span style={{ width: `${pct}%` }} />
        </span>
      )}
    </Link>
  );
}
