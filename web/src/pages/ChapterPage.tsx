import { useMemo } from 'react';
import { Link, useParams } from 'react-router';
import { ChevronLeft, FileStack, MousePointerClick, NotebookPen, Upload } from 'lucide-react';
import type { Chapter, Note, Subject } from '@smartnotes/shared';
import { AimChips } from '../components/AimChips';
import { EmptyState, PageSkeleton } from '../components/EmptyState';
import { NoteCardGroups } from '../components/NoteGroups';
import { WorkInProgress } from '../components/WorkInProgress';
import { useChapter, useOutbox, useSubject, useSubjectNotes } from '../data';
import { aimMap, groupBySection, noteSectionCode, sectionAnchor, sectionsOf } from '../lib/curriculum';
import { chapterHeading, plural } from '../lib/format';
import { useListPaneShown } from '../lib/layout';
import { openUpload } from '../lib/ui';
import { useDocumentTitle } from '../lib/useDocumentTitle';
import { useHashScroll } from '../lib/useHashScroll';
import { NotFoundPage } from './NotFoundPage';

export function ChapterPage() {
  const { subjectId, chapterId } = useParams();
  const unsorted = chapterId === 'uten';
  const subject = useSubject(subjectId);
  const chapter = useChapter(unsorted ? undefined : chapterId);
  const allNotes = useSubjectNotes(subjectId);
  const outbox = useOutbox(subjectId);
  const paneShown = useListPaneShown();

  const notes = useMemo(
    () => (allNotes ?? []).filter((n) => (unsorted ? n.chapterId === null : n.chapterId === chapterId)),
    [allNotes, chapterId, unsorted],
  );
  const queued = useMemo(
    () => (outbox ?? []).filter((e) => !unsorted && e.chapterId === chapterId),
    [outbox, chapterId, unsorted],
  );
  const groups = useMemo(() => groupBySection(unsorted ? null : chapter, notes), [chapter, notes, unsorted]);
  const heading = unsorted ? 'Uten kapittel' : chapter ? chapterHeading(chapter) : '';
  useDocumentTitle(heading || null);
  useHashScroll([groups.length, paneShown]);

  if (subject === undefined || allNotes === undefined || (!unsorted && chapter === undefined)) return <PageSkeleton />;
  if (subject === null) return <NotFoundPage what="faget" />;
  if (!unsorted && (chapter === null || chapter?.subjectId !== subject.id)) return <NotFoundPage what="kapittelet" />;

  const doneCount = notes.filter((n) => n.status === 'done').length;
  const sections = sectionsOf(chapter);
  const upload = () => openUpload({ subjectId: subject.id, chapterId: unsorted ? undefined : chapterId });

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
            {sections.length > 0 && ` · ${plural(sections.length, 'delkapittel', 'delkapitler')}`}
            {unsorted && ' som ikke er sortert i et kapittel ennå'}
          </p>
        </div>
        <div className="page-actions">
          <button type="button" className="btn btn-primary" onClick={upload}>
            <Upload size={18} aria-hidden /> Last opp
          </button>
          {!unsorted && doneCount > 0 && (
            <Link to={`/fag/${subject.id}/kapittel/${chapterId}/pdf`} className="btn">
              <FileStack size={18} aria-hidden /> Kapittel som PDF
            </Link>
          )}
        </div>
      </header>

      {paneShown ? (
        <ChapterOverview subject={subject} chapter={unsorted ? null : (chapter ?? null)} notes={notes} />
      ) : (
        <>
          <WorkInProgress outbox={queued} notes={[]} />
          {notes.length === 0 ? (
            queued.length === 0 && (
              <EmptyState
                icon={<NotebookPen size={30} aria-hidden />}
                title="Ingen notater her ennå"
                actions={
                  <button type="button" className="btn btn-primary" onClick={upload}>
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
              <NoteCardGroups groups={groups} showSection={false} />
            </section>
          )}
        </>
      )}
    </div>
  );
}

/** Kapitteloversikt når notatlisten vises i midtkolonnen (tre kolonner). */
function ChapterOverview({ subject, chapter, notes }: { subject: Subject; chapter: Chapter | null; notes: Note[] }) {
  const aims = useMemo(() => aimMap(subject), [subject]);
  const sections = sectionsOf(chapter);
  const counts = useMemo(() => {
    const m = new Map<string, number>();
    for (const n of notes) {
      const code = noteSectionCode(n);
      if (code) m.set(code, (m.get(code) ?? 0) + 1);
    }
    return m;
  }, [notes]);
  const withoutSection = notes.filter((n) => !sections.some((s) => s.code === noteSectionCode(n))).length;

  const jump = (code: string) => {
    const el = document.getElementById(sectionAnchor(code));
    if (!el) return;
    el.scrollIntoView({ block: 'start', behavior: 'smooth' });
    el.classList.add('is-flash');
    setTimeout(() => el.classList.remove('is-flash'), 1600);
  };

  return (
    <>
      <p className="select-hint">
        <MousePointerClick size={18} aria-hidden />
        {notes.length > 0 ? 'Velg et notat i listen.' : 'Ingen notater her ennå – last opp de første.'}
      </p>
      {sections.length > 0 && (
        <section className="card section-overview" aria-labelledby="sections-h">
          <div className="card-head">
            <h2 id="sections-h" className="card-title">
              Delkapitler
            </h2>
          </div>
          <ol className="section-rows" role="list">
            {sections.map((s) => {
              const count = counts.get(s.code) ?? 0;
              return (
                <li key={s.code}>
                  <button
                    type="button"
                    className={`section-row${count === 0 ? ' is-empty' : ''}`}
                    onClick={() => jump(s.code)}
                    disabled={count === 0}
                  >
                    <span className="group-code">{s.code}</span>
                    <span className="section-row-title">{s.title}</span>
                    <AimChips codes={s.aims ?? []} aims={aims} size="sm" />
                    <span className="section-row-count">{count > 0 ? plural(count, 'notat', 'notater') : 'Ingen notater'}</span>
                  </button>
                </li>
              );
            })}
          </ol>
          {withoutSection > 0 && (
            <p className="muted small">{plural(withoutSection, 'notat', 'notater')} uten delkapittel.</p>
          )}
        </section>
      )}
    </>
  );
}
