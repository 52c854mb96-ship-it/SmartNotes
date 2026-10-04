import { useMemo, useState } from 'react';
import { Link, NavLink, useNavigate } from 'react-router';
import { ChevronRight, FolderOpen, Plus, Search, Settings, Shapes, Upload, X } from 'lucide-react';
import type { Subject } from '@smartnotes/shared';
import { chapterStats, useChapters, useSubjectNotes, useSubjects } from '../data';
import { useActiveIds } from '../lib/useActive';
import { SubjectIcon } from '../lib/subjects';
import { drawerStore, newSubjectStore, openSearch, openUpload } from '../lib/ui';
import { hasVisualizations } from '../viz/registry';
import { Logo } from './Logo';
import { SyncStatus } from './SyncStatus';
import { ThemeSwitch } from './ThemeSwitch';

const IS_MAC = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);

export function Sidebar({ id }: { id: string }) {
  const subjects = useSubjects();
  const active = useActiveIds();
  const [toggled, setToggled] = useState<Record<string, boolean>>({});

  return (
    <aside id={id} className="sidebar" aria-label="Fag og kapitler">
      <div className="sidebar-top">
        <Link to="/" className="brand">
          <Logo size={30} />
          <span className="brand-name">SmartNotes</span>
        </Link>
        <button
          type="button"
          className="icon-btn drawer-close"
          aria-label="Lukk meny"
          onClick={() => drawerStore.set(false)}
        >
          <X size={20} aria-hidden />
        </button>
      </div>

      <div className="sidebar-actions">
        <button
          type="button"
          className="search-trigger"
          onClick={() => {
            drawerStore.set(false);
            openSearch();
          }}
          aria-keyshortcuts={IS_MAC ? 'Meta+K' : 'Control+K'}
        >
          <Search size={17} aria-hidden />
          <span className="search-trigger-label">Søk</span>
          <kbd className="search-trigger-kbd" aria-hidden>
            {IS_MAC ? '⌘K' : 'Ctrl K'}
          </kbd>
        </button>
        <button
          type="button"
          className="btn btn-primary btn-block"
          onClick={() => {
            drawerStore.set(false);
            openUpload({ subjectId: active.subjectId, chapterId: active.noteId ? undefined : active.chapterId });
          }}
        >
          <Upload size={18} aria-hidden />
          Last opp notater
        </button>
      </div>

      <nav className="sidebar-nav" aria-label="Fag">
        <div className="sidebar-section-head">
          <span className="sidebar-section-title">Fag</span>
          <button
            type="button"
            className="icon-btn icon-btn-sm"
            aria-label="Nytt fag"
            title="Nytt fag"
            onClick={() => {
              drawerStore.set(false);
              newSubjectStore.set(true);
            }}
          >
            <Plus size={18} aria-hidden />
          </button>
        </div>

        {subjects === undefined ? (
          <div className="sidebar-skeleton" aria-hidden>
            <div className="skeleton skeleton-line" />
            <div className="skeleton skeleton-line short" />
          </div>
        ) : subjects.length === 0 ? (
          <p className="sidebar-empty">Ingen fag ennå.</p>
        ) : (
          <ul className="subject-list" role="list">
            {subjects.map((s) => {
              const expanded = toggled[s.id] ?? s.id === active.subjectId;
              return (
                <SubjectItem
                  key={s.id}
                  subject={s}
                  expanded={expanded}
                  isActive={s.id === active.subjectId}
                  activeChapterId={s.id === active.subjectId ? active.chapterId : undefined}
                  onToggle={() => setToggled((t) => ({ ...t, [s.id]: !expanded }))}
                  onOpen={() => setToggled((t) => ({ ...t, [s.id]: true }))}
                />
              );
            })}
          </ul>
        )}
      </nav>

      <div className="sidebar-footer">
        <SyncStatus />
        <div className="sidebar-footer-row">
          <NavLink to="/innstillinger" className="sidebar-link">
            <Settings size={18} aria-hidden />
            Innstillinger
          </NavLink>
          <ThemeSwitch variant="compact" />
        </div>
      </div>
    </aside>
  );
}

function SubjectItem({
  subject,
  expanded,
  isActive,
  activeChapterId,
  onToggle,
  onOpen,
}: {
  subject: Subject;
  expanded: boolean;
  isActive: boolean;
  activeChapterId?: string;
  onToggle: () => void;
  onOpen: () => void;
}) {
  const navigate = useNavigate();
  const listId = `subject-${subject.id}-chapters`;
  return (
    <li className={`subject-item${isActive ? ' is-active' : ''}`}>
      <div className="subject-row">
        <button
          type="button"
          className="subject-link"
          aria-current={isActive && !activeChapterId ? 'page' : undefined}
          onClick={() => {
            onOpen();
            navigate(`/fag/${subject.id}`);
          }}
        >
          <SubjectIcon profile={subject.profile} size={18} className="subject-icon" />
          <span className="subject-name">{subject.name}</span>
        </button>
        <button
          type="button"
          className="icon-btn icon-btn-sm subject-toggle"
          aria-expanded={expanded}
          aria-controls={listId}
          aria-label={expanded ? `Skjul kapitler i ${subject.name}` : `Vis kapitler i ${subject.name}`}
          onClick={onToggle}
        >
          <ChevronRight size={16} aria-hidden className={`chevron${expanded ? ' is-open' : ''}`} />
        </button>
      </div>
      {expanded && (
        <ChapterList subjectId={subject.id} id={listId} activeChapterId={activeChapterId} showViz={hasVisualizations(subject)} />
      )}
    </li>
  );
}

function ChapterList({
  subjectId,
  id,
  activeChapterId,
  showViz,
}: {
  subjectId: string;
  id: string;
  activeChapterId?: string;
  showViz: boolean;
}) {
  const chapters = useChapters(subjectId);
  const notes = useSubjectNotes(subjectId);
  const stats = useMemo(() => chapterStats(notes ?? []), [notes]);
  const unsorted = stats.get('');

  if (chapters === undefined) {
    return (
      <div className="chapter-skeleton" aria-hidden>
        <div className="skeleton skeleton-line" />
        <div className="skeleton skeleton-line" />
      </div>
    );
  }

  return (
    <ul className="chapter-list" id={id} role="list">
      {chapters.length === 0 && !unsorted && (
        <li className="chapter-empty">
          <Link to={`/fag/${subjectId}/innstillinger`}>Legg inn kapitler</Link>
        </li>
      )}
      {chapters.map((c) => {
        const s = stats.get(c.id);
        return (
          <li key={c.id}>
            <NavLink
              to={`/fag/${subjectId}/kapittel/${c.id}`}
              className={`chapter-link${activeChapterId === c.id ? ' is-current' : ''}`}
              title={c.title}
            >
              {c.number && <span className="chapter-num">{c.number}</span>}
              <span className="chapter-title">{c.title}</span>
              {s && s.count > 0 && <span className="count-badge">{s.count}</span>}
            </NavLink>
          </li>
        );
      })}
      {unsorted && unsorted.count > 0 && (
        <li>
          <NavLink
            to={`/fag/${subjectId}/kapittel/uten`}
            className={`chapter-link is-unsorted${activeChapterId === 'uten' ? ' is-current' : ''}`}
          >
            <FolderOpen size={15} aria-hidden className="chapter-num-icon" />
            <span className="chapter-title">Uten kapittel</span>
            <span className="count-badge">{unsorted.count}</span>
          </NavLink>
        </li>
      )}
      {showViz && (
        <li className="chapter-list-extra">
          <NavLink to={`/fag/${subjectId}/visualiseringer`} className="chapter-link is-viz">
            <Shapes size={15} aria-hidden className="chapter-num-icon" />
            <span className="chapter-title">Visualiseringer</span>
          </NavLink>
        </li>
      )}
    </ul>
  );
}
