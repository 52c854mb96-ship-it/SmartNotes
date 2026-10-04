import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router';
import { BookOpen, Camera, FileStack, FolderOpen, ListPlus, ListTree, Settings, Shapes, Upload, X } from 'lucide-react';
import type { Chapter, Subject } from '@smartnotes/shared';
import { AimsBlock } from '../components/AimsBlock';
import { EmptyState, PageSkeleton } from '../components/EmptyState';
import { WorkInProgress } from '../components/WorkInProgress';
import { chapterStats, useChapters, useOutbox, useSubject, useSubjectNotes, type ChapterStats } from '../data';
import { sectionsOf } from '../lib/curriculum';
import { formatDayShort, plural } from '../lib/format';
import { openUpload } from '../lib/ui';
import { useDocumentTitle } from '../lib/useDocumentTitle';
import { LAST_SUBJECT_KEY } from './HomePage';
import { hasVisualizations } from '../viz/registry';
import { NotFoundPage } from './NotFoundPage';

export function SubjectPage() {
  const { subjectId } = useParams();
  const subject = useSubject(subjectId);
  const chapters = useChapters(subjectId);
  const notes = useSubjectNotes(subjectId);
  const outbox = useOutbox(subjectId);
  const stats = useMemo(() => chapterStats(notes ?? []), [notes]);
  useDocumentTitle(subject?.name);

  useEffect(() => {
    if (!subject) return;
    try {
      localStorage.setItem(LAST_SUBJECT_KEY, subject.id);
    } catch {
      /* ignorer */
    }
  }, [subject]);

  if (subject === undefined || chapters === undefined || notes === undefined) return <PageSkeleton />;
  if (subject === null) return <NotFoundPage what="faget" />;

  const unsorted = stats.get('');
  const doneCount = notes.filter((n) => n.status === 'done').length;

  return (
    <div className="page">
      <header className="page-header">
        <div className="page-heading">
          <p className="eyebrow">Fag</p>
          <h1 className="page-title">{subject.name}</h1>
          <p className="page-subtitle">
            {subject.textbook && (
              <span className="with-icon">
                <BookOpen size={15} aria-hidden /> {subject.textbook}
              </span>
            )}
            <span>
              {plural(notes.length, 'notat', 'notater')}
              {chapters.length > 0 && ` i ${plural(chapters.length, 'kapittel', 'kapitler')}`}
            </span>
          </p>
        </div>
        <div className="page-actions">
          <button type="button" className="btn btn-primary" onClick={() => openUpload({ subjectId: subject.id })}>
            <Upload size={18} aria-hidden /> Last opp notater
          </button>
          {hasVisualizations(subject) && (
            <Link to={`/fag/${subject.id}/visualiseringer`} className="btn">
              <Shapes size={18} aria-hidden /> Visualiseringer
            </Link>
          )}
          {doneCount > 0 && (
            <Link to={`/fag/${subject.id}/pdf`} className="btn">
              <FileStack size={18} aria-hidden /> Hele faget som PDF
            </Link>
          )}
          <Link
            to={`/fag/${subject.id}/innstillinger`}
            className="btn btn-icon-only"
            aria-label="Innstillinger for faget"
            title="Innstillinger for faget"
          >
            <Settings size={18} aria-hidden />
          </Link>
        </div>
      </header>

      <WorkInProgress outbox={outbox ?? []} notes={notes} />

      <MissingSectionsHint subject={subject} chapters={chapters} />

      {chapters.length === 0 ? (
        <EmptyState
          icon={<ListPlus size={30} aria-hidden />}
          title="Legg inn kapitlene fra læreboka"
          actions={
            <>
              <Link to={`/fag/${subject.id}/innstillinger`} className="btn btn-primary">
                <ListPlus size={18} aria-hidden /> Legg inn kapitler
              </Link>
              <button type="button" className="btn" onClick={() => openUpload({ subjectId: subject.id })}>
                <Upload size={18} aria-hidden /> Last opp likevel
              </button>
            </>
          }
        >
          <p>
            Notatene sorteres etter kapitlene i læreboka{subject.textbook ? ` «${subject.textbook}»` : ''}. Lim inn
            innholdsfortegnelsen eller ta et bilde av den, så plasserer Claude hvert notat i riktig kapittel.
          </p>
        </EmptyState>
      ) : (
        <section aria-labelledby="chapters-title">
          <h2 id="chapters-title" className="section-title">
            Kapitler
          </h2>
          <ul className="chapter-grid" role="list">
            {chapters.map((c) => (
              <li key={c.id}>
                <ChapterCard subjectId={subject.id} chapter={c} stats={stats.get(c.id)} />
              </li>
            ))}
          </ul>
        </section>
      )}

      {unsorted && unsorted.count > 0 && (
        <section aria-label="Uten kapittel" className="section-gap">
          <ul className="chapter-grid" role="list">
            <li>
              <ChapterCard subjectId={subject.id} chapter={null} stats={unsorted} />
            </li>
          </ul>
        </section>
      )}

      <AimsBlock subject={subject} chapters={chapters} notes={notes} />
    </div>
  );
}

function ChapterCard({
  subjectId,
  chapter,
  stats,
}: {
  subjectId: string;
  chapter: Chapter | null;
  stats: ChapterStats | undefined;
}) {
  const count = stats?.count ?? 0;
  return (
    <Link
      to={`/fag/${subjectId}/kapittel/${chapter ? chapter.id : 'uten'}`}
      className={`chapter-card${count === 0 ? ' is-empty' : ''}${chapter ? '' : ' is-unsorted'}`}
    >
      <span className="chapter-card-num" aria-hidden>
        {chapter ? (chapter.number ?? '·') : <FolderOpen size={18} />}
      </span>
      <span className="chapter-card-body">
        <span className="chapter-card-title">{chapter ? chapter.title : 'Uten kapittel'}</span>
        <span className="chapter-card-meta">
          {count === 0
            ? 'Ingen notater ennå'
            : `${plural(count, 'notat', 'notater')}${stats?.lastDay ? ` · sist ${formatDayShort(stats.lastDay)}` : ''}`}
          {stats && stats.converting > 0 && <span className="dot-sep">· konverterer {stats.converting}</span>}
        </span>
      </span>
    </Link>
  );
}

const HINT_KEY = (subjectId: string) => `smartnotes:sectionsHint:${subjectId}`;

/**
 * Når noen kapitler mangler delkapitler (f.eks. Kjemi 1 og Biologi 1, der innholdsfortegnelsen ikke kunne bekreftes),
 * foreslås bildeimport av innholdsfortegnelsen. Kan skjules på denne enheten.
 */
function MissingSectionsHint({ subject, chapters }: { subject: Subject; chapters: Chapter[] }) {
  const [hidden, setHidden] = useState(() => {
    try {
      return localStorage.getItem(HINT_KEY(subject.id)) === '1';
    } catch {
      return false;
    }
  });
  const missing = chapters.filter((c) => sectionsOf(c).length === 0).length;
  if (hidden || chapters.length === 0 || missing === 0) return null;
  const hide = () => {
    setHidden(true);
    try {
      localStorage.setItem(HINT_KEY(subject.id), '1');
    } catch {
      /* ignorer */
    }
  };
  return (
    <aside className="callout callout-accent hint-card" aria-label="Delkapitler mangler">
      <ListTree size={18} aria-hidden />
      <div className="hint-card-body">
        <strong>
          {missing === chapters.length
            ? 'Kapitlene har ingen delkapitler ennå.'
            : `${plural(missing, 'kapittel', 'kapitler')} mangler delkapitler.`}
        </strong>
        <span>
          Ta bilde av innholdsfortegnelsen i {subject.textbook ? `«${subject.textbook}»` : 'læreboka'}, så legges
          delkapitlene inn{subject.aims.length > 0 ? ' og kobles til kompetansemålene' : ''}. Da kan Claude plassere
          notatene mer presist.
        </span>
        <span className="hint-card-actions">
          <Link to={`/fag/${subject.id}/innstillinger#innholdsfortegnelse`} className="btn btn-sm">
            <Camera size={16} aria-hidden /> Importer innholdsfortegnelsen
          </Link>
        </span>
      </div>
      <button type="button" className="icon-btn" onClick={hide} aria-label="Skjul forslaget" title="Skjul">
        <X size={17} aria-hidden />
      </button>
    </aside>
  );
}
