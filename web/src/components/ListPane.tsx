import { useMemo } from 'react';
import { Link } from 'react-router';
import { FileStack, FileText, PanelLeftClose, PanelLeftOpen, Upload, X } from 'lucide-react';
import type { Note } from '@smartnotes/shared';
import { useChapters, useOutbox, useSubject, useSubjectNotes } from '../data';
import type { OutboxEntry } from '../db';
import { useOnline } from '../lib/connectivity';
import {
  aimsOf,
  groupByChapter,
  groupBySection,
  notesForAim,
  truncate,
} from '../lib/curriculum';
import { chapterHeading, plural } from '../lib/format';
import { useHashScroll } from '../lib/useHashScroll';
import { aimFilterStore, listCollapsedStore, openUpload, setListCollapsed } from '../lib/ui';
import { useSyncState } from '../sync';
import { NoteListGroups, NoteListItem } from './NoteGroups';
import { OutboxStatusBadge } from './Status';

/**
 * Midtkolonnen i tre-kolonne-oppsettet: notatene i kapittelet (gruppert etter delkapittel)
 * eller i hele faget (gruppert etter kapittel), med filter på kompetansemål.
 */
export function ListPane({
  subjectId,
  chapterId,
  noteId,
}: {
  subjectId: string;
  /** Kapittel i kontekst, 'uten' for usorterte, eller undefined. */
  chapterId?: string;
  noteId?: string;
}) {
  const collapsed = listCollapsedStore.use();
  if (collapsed) {
    return (
      <aside className="list-rail" aria-label="Notatliste (skjult)">
        <button
          type="button"
          className="icon-btn"
          onClick={() => setListCollapsed(false)}
          aria-label="Vis notatlisten"
          title="Vis notatlisten"
        >
          <PanelLeftOpen size={19} aria-hidden />
        </button>
      </aside>
    );
  }
  return <ListPaneBody subjectId={subjectId} chapterId={chapterId} noteId={noteId} />;
}

function ListPaneBody({ subjectId, chapterId, noteId }: { subjectId: string; chapterId?: string; noteId?: string }) {
  const subject = useSubject(subjectId);
  const chapters = useChapters(subjectId);
  const notes = useSubjectNotes(subjectId);
  const outbox = useOutbox(subjectId);
  const filterState = aimFilterStore.use();
  const filter = filterState?.subjectId === subjectId ? filterState.aim : null;
  const aims = aimsOf(subject);
  const activeAim = filter ? aims.find((a) => a.code === filter) : undefined;

  const chapter = chapterId && chapterId !== 'uten' ? (chapters?.find((c) => c.id === chapterId) ?? null) : null;

  const { inProgress, groups, total } = useMemo(() => {
    const all = notes ?? [];
    const busy = (n: Note) => n.status === 'queued' || n.status === 'processing';
    const settled = all.filter((n) => !busy(n));
    if (filter) {
      const matched = notesForAim(chapters ?? [], settled, filter);
      return { inProgress: [] as Note[], groups: groupByChapter(chapters ?? [], matched), total: matched.length };
    }
    if (chapter) {
      const inChapter = settled.filter((n) => n.chapterId === chapter.id);
      return { inProgress: all.filter(busy), groups: groupBySection(chapter, inChapter), total: inChapter.length };
    }
    return { inProgress: all.filter(busy), groups: groupByChapter(chapters ?? [], settled), total: settled.length };
  }, [notes, chapters, chapter, filter]);

  useHashScroll([groups.length]);

  const loading = subject === undefined || chapters === undefined || notes === undefined;
  const doneInChapter = chapter ? (notes ?? []).some((n) => n.chapterId === chapter.id && n.status === 'done') : false;
  const showOutbox = !filter && (outbox?.length ?? 0) > 0;

  return (
    <aside className="list-pane" aria-label="Notatliste">
      <header className="list-head">
        <div className="list-head-top">
          <div className="list-head-titles">
            <Link to={`/fag/${subjectId}`} className="list-eyebrow">
              {subject?.name ?? ' '}
            </Link>
            <h2 className="list-title">{chapter ? chapterHeading(chapter) : chapterId === 'uten' ? 'Uten kapittel' : 'Alle notater'}</h2>
          </div>
          <button
            type="button"
            className="icon-btn icon-btn-sm"
            onClick={() => setListCollapsed(true)}
            aria-label="Skjul notatlisten"
            title="Skjul notatlisten"
          >
            <PanelLeftClose size={18} aria-hidden />
          </button>
        </div>
        <div className="list-actions">
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={() => openUpload({ subjectId, chapterId: chapter?.id })}
          >
            <Upload size={15} aria-hidden /> Last opp
          </button>
          {chapter && doneInChapter && (
            <Link to={`/fag/${subjectId}/kapittel/${chapter.id}/pdf`} className="btn btn-sm">
              <FileStack size={15} aria-hidden /> Kapittel som PDF
            </Link>
          )}
        </div>
        {aims.length > 0 && (
          <div className="list-filter">
            <label className="sr-only" htmlFor="aim-filter">
              Filtrer på kompetansemål
            </label>
            <select
              id="aim-filter"
              className="list-filter-select"
              value={filter ?? ''}
              onChange={(e) => aimFilterStore.set(e.target.value ? { subjectId, aim: e.target.value } : null)}
            >
              <option value="">Alle kompetansemål</option>
              {aims.map((a) => (
                <option key={a.code} value={a.code}>
                  {a.code} – {truncate(a.text, 44)}
                </option>
              ))}
            </select>
          </div>
        )}
        {filter && (
          <div className="list-filter-active" role="status">
            <div className="list-filter-row">
              <span>
                Notater i faget som dekker <strong>{filter}</strong>
              </span>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => aimFilterStore.set(null)}>
                <X size={14} aria-hidden /> Fjern filter
              </button>
            </div>
            {activeAim && (
              <span className="list-filter-aim" title={activeAim.text}>
                {activeAim.text}
              </span>
            )}
          </div>
        )}
      </header>

      <div className="list-body">
        {loading ? (
          <div className="list-skeleton" aria-busy="true" aria-label="Laster">
            <div className="skeleton skeleton-line" />
            <div className="skeleton skeleton-line short" />
            <div className="skeleton skeleton-line" />
          </div>
        ) : (
          <>
            {(showOutbox || inProgress.length > 0) && (
              <section className="list-group" aria-label="Under arbeid">
                <h3 className="list-group-head">
                  <span className="group-title">Under arbeid</span>
                </h3>
                <ul className="list-notes" role="list">
                  {showOutbox && outbox?.map((e) => <OutboxItem key={e.clientId} entry={e} />)}
                  {inProgress.map((n) => (
                    <li key={n.id}>
                      <NoteListItem note={n} current={n.id === noteId} showSection />
                    </li>
                  ))}
                </ul>
              </section>
            )}
            <NoteListGroups groups={groups} currentNoteId={noteId} showSection={!chapter || !!filter} />
            {total === 0 && inProgress.length === 0 && !showOutbox && (
              <p className="list-empty">
                {filter
                  ? `Ingen notater dekker ${filter} ennå.`
                  : chapter
                    ? 'Ingen notater i dette kapittelet ennå.'
                    : 'Ingen notater ennå.'}
              </p>
            )}
            {!filter && total > 0 && (
              <p className="list-foot">{plural(total, 'notat', 'notater')}</p>
            )}
          </>
        )}
      </div>
    </aside>
  );
}

function OutboxItem({ entry }: { entry: OutboxEntry }) {
  const { online } = useOnline();
  const { uploadProgress } = useSyncState();
  return (
    <li>
      <div className="list-note is-static">
        <span className="list-note-title">
          <FileText size={14} aria-hidden className="list-note-icon" />
          {entry.title || `Nytt notat (${plural(entry.files.length, 'fil', 'filer')})`}
        </span>
        <span className="list-note-meta">
          <OutboxStatusBadge entry={entry} online={online} progress={uploadProgress[entry.clientId]} />
        </span>
      </div>
    </li>
  );
}
