import { useMemo } from 'react';
import { Link, useParams } from 'react-router';
import { ChevronLeft, FileStack, NotebookPen, Upload } from 'lucide-react';
import { EmptyState, PageSkeleton } from '../components/EmptyState';
import { NoteCard } from '../components/NoteCard';
import { WorkInProgress } from '../components/WorkInProgress';
import { useChapter, useOutbox, useSubject, useSubjectNotes } from '../data';
import { chapterHeading, plural } from '../lib/format';
import { openUpload } from '../lib/ui';
import { useDocumentTitle } from '../lib/useDocumentTitle';
import { NotFoundPage } from './NotFoundPage';

export function ChapterPage() {
  const { subjectId, chapterId } = useParams();
  const unsorted = chapterId === 'uten';
  const subject = useSubject(subjectId);
  const chapter = useChapter(unsorted ? undefined : chapterId);
  const allNotes = useSubjectNotes(subjectId);
  const outbox = useOutbox(subjectId);

  const notes = useMemo(
    () => (allNotes ?? []).filter((n) => (unsorted ? n.chapterId === null : n.chapterId === chapterId)),
    [allNotes, chapterId, unsorted],
  );
  const queued = useMemo(
    () => (outbox ?? []).filter((e) => !unsorted && e.chapterId === chapterId),
    [outbox, chapterId, unsorted],
  );
  const heading = unsorted ? 'Uten kapittel' : chapter ? chapterHeading(chapter) : '';
  useDocumentTitle(heading || null);

  if (subject === undefined || allNotes === undefined || (!unsorted && chapter === undefined)) return <PageSkeleton />;
  if (subject === null) return <NotFoundPage what="faget" />;
  if (!unsorted && (chapter === null || chapter?.subjectId !== subject.id)) return <NotFoundPage what="kapittelet" />;

  const doneCount = notes.filter((n) => n.status === 'done').length;

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
          <h1 className="page-title">{heading}</h1>
          <p className="page-subtitle">
            {plural(notes.length, 'notat', 'notater')}
            {unsorted && ' som ikke er sortert i et kapittel ennå'}
          </p>
        </div>
        <div className="page-actions">
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => openUpload({ subjectId: subject.id, chapterId: unsorted ? undefined : chapterId })}
          >
            <Upload size={18} aria-hidden /> Last opp
          </button>
          {!unsorted && doneCount > 0 && (
            <Link to={`/fag/${subject.id}/kapittel/${chapterId}/pdf`} className="btn">
              <FileStack size={18} aria-hidden /> Kapittel som PDF
            </Link>
          )}
        </div>
      </header>

      <WorkInProgress outbox={queued} notes={[]} />

      {notes.length === 0 ? (
        queued.length === 0 && (
          <EmptyState
            icon={<NotebookPen size={30} aria-hidden />}
            title="Ingen notater her ennå"
            actions={
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => openUpload({ subjectId: subject.id, chapterId: unsorted ? undefined : chapterId })}
              >
                <Upload size={18} aria-hidden /> Last opp notater
              </button>
            }
          >
            <p>Ta bilde av notatene fra forelesningen, så blir de til en pen PDF i dette kapittelet.</p>
          </EmptyState>
        )
      ) : (
        <section aria-label="Notater">
          {unsorted && (
            <p className="section-intro">Åpne et notat og velg kapittel for å flytte det dit det hører hjemme.</p>
          )}
          <ul className="note-list" role="list">
            {notes.map((n) => (
              <li key={n.id}>
                <NoteCard note={n} />
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
