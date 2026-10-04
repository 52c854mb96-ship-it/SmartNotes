import { useEffect, useRef, useState } from 'react';
import { Navigate, Outlet, ScrollRestoration, useLocation } from 'react-router';
import { Menu, Upload } from 'lucide-react';
import { useAuth } from '../lib/connectivity';
import { reloadPendingStore } from '../lib/pwa';
import { drawerStore, openUpload, toast, uploadStore } from '../lib/ui';
import { isAcceptedFile } from '../lib/images';
import { useActiveIds } from '../lib/useActive';
import { Logo } from './Logo';
import { NewSubjectDialog } from './NewSubjectDialog';
import { OfflineBanner } from './OfflineBanner';
import { Sidebar } from './Sidebar';
import { UploadDialog } from './UploadDialog';

const NARROW = '(max-width: 899.98px)';

function useIsNarrow(): boolean {
  const [narrow, setNarrow] = useState(() => window.matchMedia(NARROW).matches);
  useEffect(() => {
    const mq = window.matchMedia(NARROW);
    const onChange = () => setNarrow(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);
  return narrow;
}

export function AppShell() {
  const auth = useAuth();
  const location = useLocation();
  const drawerOpen = drawerStore.use();
  const narrow = useIsNarrow();
  const active = useActiveIds();
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
    <div className={`app${drawerOpen ? ' drawer-open' : ''}`}>
      <a href="#main" className="skip-link">
        Hopp til innhold
      </a>
      <Sidebar id="sidebar" />
      <div className="drawer-backdrop" onClick={() => drawerStore.set(false)} aria-hidden />
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
          <button
            type="button"
            className="icon-btn"
            aria-label="Last opp notater"
            onClick={() => openUpload({ subjectId: active.subjectId, chapterId: active.noteId ? undefined : active.chapterId })}
          >
            <Upload size={20} aria-hidden />
          </button>
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
      <ScrollRestoration />
    </div>
  );
}
