import { useMemo } from 'react';
import { Link } from 'react-router';
import { useLiveQuery } from 'dexie-react-hooks';
import { ArrowRight, Plus } from 'lucide-react';
import type { Subject } from '@smartnotes/shared';
import { Logo } from '../components/Logo';
import { PageSkeleton } from '../components/EmptyState';
import { useSubjects } from '../data';
import { db } from '../db';
import { useOnline } from '../lib/connectivity';
import { formatChangedDay, plural } from '../lib/format';
import { SubjectIcon, profileOf } from '../lib/subjects';
import { newSubjectStore } from '../lib/ui';
import { useSyncState } from '../sync';
import { useDocumentTitle } from '../lib/useDocumentTitle';

export const LAST_SUBJECT_KEY = 'smartnotes:lastSubject';

/** Antall notater og når noe sist ble endret, per fag (fra Dexie, så det virker uten nett). */
function useSubjectStats(): Map<string, { notes: number; changedAt: string | null }> | undefined {
  return useLiveQuery(async () => {
    const stats = new Map<string, { notes: number; changedAt: string | null }>();
    await db.notes.each((n) => {
      const s = stats.get(n.subjectId) ?? { notes: 0, changedAt: null };
      s.notes++;
      if (!s.changedAt || n.updatedAt > s.changedAt) s.changedAt = n.updatedAt;
      stats.set(n.subjectId, s);
    });
    return stats;
  }, []);
}

function lastSubjectId(): string | null {
  try {
    return localStorage.getItem(LAST_SUBJECT_KEY);
  } catch {
    return null;
  }
}

/**
 * Forsiden: en kort presentasjon av SmartNotes og fagene til brukeren som kort i fagenes farger. Siden sender ikke
 * brukeren videre av seg selv; «Fortsett i …» er bare en snarvei til faget som sist var åpent.
 */
export function HomePage() {
  useDocumentTitle(null);
  const subjects = useSubjects();
  const stats = useSubjectStats();
  const sync = useSyncState();
  const { online } = useOnline();
  const last = useMemo(() => {
    const id = lastSubjectId();
    return subjects?.find((s) => s.id === id) ?? null;
  }, [subjects]);

  if (subjects === undefined || (subjects.length === 0 && sync.running && !sync.lastSyncAt)) return <PageSkeleton />;

  const addSubject = (
    <button
      type="button"
      className={subjects.length === 0 ? 'btn btn-primary' : 'btn'}
      onClick={() => newSubjectStore.set(true)}
      disabled={!online}
      title={online ? undefined : 'Krever nett'}
    >
      <Plus size={18} aria-hidden /> Legg til fag
    </button>
  );

  return (
    <div className="page home-page">
      <header className="home-hero">
        <Logo size={48} />
        <div className="home-hero-text">
          <h1 className="page-title">SmartNotes</h1>
          <p className="home-intro">
            Ta bilde av de håndskrevne notatene dine. SmartNotes skriver dem om til pene PDF-er med formler og figurer, og
            sorterer dem etter fag og tema. Notatene ligger også på enheten, så du kan lese dem uten nett.
          </p>
        </div>
      </header>

      {last && (
        <p className="home-continue">
          <Link to={`/fag/${last.id}`}>
            Fortsett i {last.name} <ArrowRight size={16} aria-hidden />
          </Link>
        </p>
      )}

      <section aria-labelledby="home-subjects-h">
        <div className="home-section-head">
          <h2 id="home-subjects-h" className="section-title">
            Fagene dine
          </h2>
          {subjects.length > 0 && addSubject}
        </div>
        {subjects.length === 0 ? (
          <div className="home-empty">
            <p>Du har ingen fag ennå. Legg til faget ditt, så får det egne temaer og kompetansemålene fra læreplanen.</p>
            {addSubject}
          </div>
        ) : (
          <ul className="subject-cards" role="list">
            {subjects.map((s) => (
              <li key={s.id}>
                <SubjectCard subject={s} stats={stats?.get(s.id)} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function SubjectCard({ subject, stats }: { subject: Subject; stats: { notes: number; changedAt: string | null } | undefined }) {
  const profile = profileOf(subject.profile);
  const notes = stats?.notes ?? 0;
  const changed = formatChangedDay(stats?.changedAt ?? subject.updatedAt);
  return (
    <Link to={`/fag/${subject.id}`} className="subject-card" data-profile={profile}>
      <span className="subject-card-icon">
        <SubjectIcon profile={profile} size={22} />
      </span>
      <span className="subject-card-text">
        <span className="subject-card-name">{subject.name}</span>
        <span className="subject-card-meta">
          {notes === 0 ? 'Ingen notater ennå' : plural(notes, 'notat', 'notater')}
          {changed && ` · Sist endret ${changed}`}
        </span>
      </span>
      <ArrowRight size={18} aria-hidden className="subject-card-arrow" />
    </Link>
  );
}
