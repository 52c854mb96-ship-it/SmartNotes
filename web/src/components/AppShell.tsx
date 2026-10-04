import { useEffect, useRef, useState } from 'react';
import { Navigate, Outlet, ScrollRestoration, useLocation } from 'react-router';
import { Menu, Search, Upload } from 'lucide-react';
import { useAuth } from '../lib/connectivity';
import { reloadPendingStore } from '../lib/pwa';
import { drawerStore, listCollapsedStore, openSearch, openUpload, searchStore, toast, uploadStore } from '../lib/ui';
import { isAcceptedFile } from '../lib/images';
import { isListRoute } from '../lib/layout';
import { NARROW_QUERY, WIDE_QUERY, useMediaQuery } from '../lib/media';
import { useActiveIds } from '../lib/useActive';
import { ListPane } from './ListPane';
import { Logo } from './Logo';
import { NewSubjectDialog } from './NewSubjectDialog';
import { OfflineBanner } from './OfflineBanner';
import { SearchPalette } from './SearchPalette';
import { Sidebar } from './Sidebar';
import { UploadDialog } from './UploadDialog';

function isEditable(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return (
    target.isContentEditable ||
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement
  );
}

export function AppShell() {
  const auth = useAuth();
  const location = useLocation();
  const drawerOpen = drawerStore.use();
  const narrow = useMediaQuery(NARROW_QUERY);
  const wide = useMediaQuery(WIDE_QUERY);
  const collapsed = listCollapsedStore.use();
  const active = useActiveIds();
  const showList = wide && isListRoute(location.pathname) && !!active.subjectId;
  const firstPath = useRef(location.pathname);
  const [dragging, setDragging] = useState(false);

  // Lukk skuffen ved navigering; last inn ny versjon ved første navigering etter oppdatering.
  useEffect(() => {
    drawerStore.set(false);
    if (location.pathname !== firstPath.current && reloadPendingStore.get()) window.location.reload();
  }, [location.pathname]);

  useEffect(() => {
    if (!narrow) drawerStore.set(false);
  }, [narrow]);

  // Esc lukker skuffen, og fokus flyttes inn i den når den åpnes.
  useEffect(() => {
    if (!drawerOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') drawerStore.set(false);
    };
    window.addEventListener('keydown', onKey);
    document.querySelector<HTMLElement>('#sidebar .subject-link, #sidebar a')?.focus();
    return () => window.removeEventListener('keydown', onKey);
  }, [drawerOpen]);

  // Søk: Ctrl/Cmd+K overalt, «/» når fokus ikke står i et skrivefelt.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || searchStore.get()) return;
      const otherDialog = document.querySelector('dialog[open]:not(.search-palette)');
      const mod = e.metaKey || e.ctrlKey;
      if (mod && !e.altKey && !e.shiftKey && e.key.toLowerCase() === 'k') {
        if (otherDialog) return;
        e.preventDefault();
        drawerStore.set(false);
        openSearch();
      } else if (e.key === '/' && !mod && !e.altKey && !isEditable(e.target) && !otherDialog) {
        e.preventDefault();
        drawerStore.set(false);
        openSearch();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Dra og slipp filer hvor som helst i vinduet.
  const activeRef = useRef(active);
  activeRef.current = active;
  useEffect(() => {
    let depth = 0;
    const hasFiles = (e: DragEvent) => !!e.dataTransfer && Array.from(e.dataTransfer.types).includes('Files');
    const onEnter = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      depth += 1;
      if (!uploadStore.get()) setDragging(true);
    };
    const onOver = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy';
    };
    const onLeave = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      depth = Math.max(0, depth - 1);
      if (depth === 0) setDragging(false);
    };
    const onDrop = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      depth = 0;
      setDragging(false);
      if (uploadStore.get()) return; // opplastingsdialogen håndterer egne slipp
      const files = Array.from(e.dataTransfer?.files ?? []);
      const accepted = files.filter(isAcceptedFile);
      if (accepted.length < files.length) toast('Bare bilder og PDF-er kan lastes opp.', { kind: 'error' });
      if (!accepted.length) return;
      const { subjectId, chapterId, noteId } = activeRef.current;
      openUpload({ subjectId, chapterId: noteId ? undefined : chapterId, files: accepted });
    };
    window.addEventListener('dragenter', onEnter);
    window.addEventListener('dragover', onOver);
    window.addEventListener('dragleave', onLeave);
    window.addEventListener('drop', onDrop);
    return () => {
      window.removeEventListener('dragenter', onEnter);
      window.removeEventListener('dragover', onOver);
      window.removeEventListener('dragleave', onLeave);
      window.removeEventListener('drop', onDrop);
    };
  }, []);

  if (auth === 'checking') {
    return (
      <div className="splash" aria-busy="true" aria-label="Starter SmartNotes">
        <Logo size={56} />
      </div>
    );
  }
  if (auth === 'required') {
    return <Navigate to="/logg-inn" replace state={{ from: location.pathname + location.search }} />;
  }

  return (
    <div
      className={`app${drawerOpen ? ' drawer-open' : ''}${showList ? (collapsed ? ' has-list list-collapsed' : ' has-list') : ''}`}
    >
      <a href="#main" className="skip-link">
        Hopp til innhold
      </a>
      <Sidebar id="sidebar" />
      <div className="drawer-backdrop" onClick={() => drawerStore.set(false)} aria-hidden />
      {showList && active.subjectId && (
        <ListPane subjectId={active.subjectId} chapterId={active.chapterId} noteId={active.noteId} />
      )}
      <div className="main-col" inert={narrow && drawerOpen}>
        <header className="topbar">
          <button
            type="button"
            className="icon-btn"
            aria-label="Åpne meny"
            aria-controls="sidebar"
            aria-expanded={drawerOpen}
            onClick={() => drawerStore.set(true)}
          >
            <Menu size={22} aria-hidden />
          </button>
          <div className="topbar-brand">
            <Logo size={24} />
            <span>SmartNotes</span>
          </div>
          <span className="topbar-actions">
            <button type="button" className="icon-btn" aria-label="Søk" onClick={openSearch}>
              <Search size={20} aria-hidden />
            </button>
            <button
              type="button"
              className="icon-btn"
              aria-label="Last opp notater"
              onClick={() =>
                openUpload({ subjectId: active.subjectId, chapterId: active.noteId ? undefined : active.chapterId })
              }
            >
              <Upload size={20} aria-hidden />
            </button>
          </span>
        </header>
        <OfflineBanner />
        <main id="main" className="main" tabIndex={-1}>
          <Outlet />
        </main>
      </div>
      {dragging && (
        <div className="drop-overlay" aria-hidden>
          <div className="drop-overlay-card">
            <Upload size={28} aria-hidden />
            <span>Slipp filene for å laste opp</span>
          </div>
        </div>
      )}
      <UploadDialog />
      <NewSubjectDialog />
      <SearchPalette />
      <ScrollRestoration />
    </div>
  );
}
