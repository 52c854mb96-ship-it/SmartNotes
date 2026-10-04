import { Navigate } from 'react-router';
import { Plus } from 'lucide-react';
import { Logo } from '../components/Logo';
import { EmptyState, PageSkeleton } from '../components/EmptyState';
import { useSubjects } from '../data';
import { useOnline } from '../lib/connectivity';
import { newSubjectStore } from '../lib/ui';
import { useSyncState } from '../sync';
import { useDocumentTitle } from '../lib/useDocumentTitle';

export const LAST_SUBJECT_KEY = 'smartnotes:lastSubject';

export function HomePage() {
  const subjects = useSubjects();
  const sync = useSyncState();
  const { online } = useOnline();
  useDocumentTitle(null);

  if (subjects === undefined) return <PageSkeleton />;
  if (subjects.length > 0) {
    let last: string | null = null;
    try {
      last = localStorage.getItem(LAST_SUBJECT_KEY);
    } catch {
      /* ikke tilgjengelig */
    }
    const target = subjects.find((s) => s.id === last) ?? subjects[0]!;
    return <Navigate to={`/fag/${target.id}`} replace />;
  }
  if (sync.running && !sync.lastSyncAt) return <PageSkeleton />;

  return (
    <div className="page">
      <EmptyState
        icon={<Logo size={56} />}
        title="Velkommen til SmartNotes"
        actions={
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => newSubjectStore.set(true)}
            disabled={!online}
            title={online ? undefined : 'Krever nett'}
          >
            <Plus size={18} aria-hidden /> Nytt fag
          </button>
        }
      >
        <p>
          Her samles de håndskrevne notatene dine som pene PDF-er, sortert etter fag og kapittel. Start med å opprette
          et fag.
        </p>
      </EmptyState>
    </div>
  );
}
