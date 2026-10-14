import { useMemo } from 'react';
import { Link } from 'react-router';
import { useLiveQuery } from 'dexie-react-hooks';
import { ArrowRight, FileText, GalleryVerticalEnd, Plus, Shapes, type LucideIcon } from 'lucide-react';
import type { Subject } from '@smartnotes/shared';
import { Logo } from '../components/Logo';
import { PageSkeleton } from '../components/EmptyState';
import { useSubjects } from '../data';
import { db } from '../db';
import { useOnline } from '../lib/connectivity';
import { formatChangedDay, plural } from '../lib/format';
import { lastSubjectId } from '../lib/lastSubject';
import { SubjectIcon, profileOf } from '../lib/subjects';
import { newSubjectStore } from '../lib/ui';
import { useSyncState } from '../sync';
import { APP_TITLE, useDocumentTitle } from '../lib/useDocumentTitle';
import { hasVisualizations } from '../viz/registry';

interface Feature {
  id: string;
  icon: LucideIcon;
  title: string;
  text: string;
  /** Én setning om hvorfor det hjelper. Hold den til det forskningen støtter. */
  why: string;
  /** Snarveien inn i faget som sist var åpent, når det har det kortet viser fram. */
  link?: (subject: Subject) => { to: string; label: string } | null;
}

// Visualiseringskortet nevner ingen fag: ikke alle fagene har visualiseringer ennå.
const FEATURES: Feature[] = [
  {
    id: 'notes',
    icon: FileText,
    title: 'Notatene dine, pene og samlet',
    text:
      'Ta bilde av de håndskrevne notatene. SmartNotes skriver dem om til pene PDF-er med formler og figurer og ' +
      'sorterer dem etter tema. De ligger også på enheten, så du kan lese dem uten nett.',
    why: 'Du bruker tiden i timen på å forstå, ikke på å skrive pent av.',
  },
  {
    id: 'viz',
    icon: Shapes,
    title: 'Visualiseringer',
    text:
      'Interaktive forklaringer der du styrer tallene selv og ser hva som skjer, for eksempel med en kasse som sklir, ' +
      'en titrering eller en vaksine som stopper smitte. Noen temaer har også eksempeloppgaver med løsning steg for ' +
      'steg.',
    why: 'Når du ser en sammenheng endre seg, blir den ofte lettere å forstå enn en formel på papir.',
    link: (s) =>
      hasVisualizations(s) ? { to: `/fag/${s.id}/visualiseringer`, label: `Visualiseringer i ${s.name}` } : null,
  },
  {
    id: 'flashcards',
    icon: GalleryVerticalEnd,
    title: 'Flashcards',
    text:
      'Lag kortstokker fra dine egne notater. Svar i hodet, snu kortet og se om du kunne det. Øv grundig med mestring, ' +
      'eller ta en rask runde når du har lite tid.',
    why:
      'Å hente fram svaret fra hukommelsen er en av de best dokumenterte måtene å lære på, og virker bedre enn å ' +
      'lese notatene om igjen.',
    link: (s) => ({ to: `/fag/${s.id}/flashcards`, label: `Flashcards i ${s.name}` }),
  },
];

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

/**
 * Forsiden: en kort presentasjon av SmartNotes (notater, visualiseringer og flashcards, med hvorfor hver del
 * hjelper) og fagene til brukeren som kort i fagenes farger. Siden sender ikke brukeren videre av seg selv;
 * «Fortsett i …» og lenkene i presentasjonen er bare snarveier til faget som sist var åpent.
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

  // Kortene venter også på tallene, ellers står «Ingen notater ennå» et øyeblikk før antallet kommer.
  if (subjects === undefined || stats === undefined || (subjects.length === 0 && sync.running && !sync.lastSyncAt)) return <PageSkeleton />;

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
          <h1 className="page-title">{APP_TITLE}</h1>
          <p className="home-intro">
            Notater og flashcards i fysikk, kjemi, biologi og geofag etter læreplanen for videregående (LK20), med
            interaktive visualiseringer til mange av temaene.
          </p>
        </div>
      </header>

      {/* Rett under ingressen, så eleven slipper å rulle forbi presentasjonen på telefonen hver gang appen åpnes. */}
      {last && (
        <p className="home-continue">
          <Link to={`/fag/${last.id}`}>
            Fortsett i {last.name} <ArrowRight size={16} aria-hidden />
          </Link>
        </p>
      )}

      <ul className="home-features" role="list" aria-label="Dette er SmartNotes">
        {FEATURES.map((f) => (
          <FeatureCard key={f.id} feature={f} last={last} />
        ))}
      </ul>
      <p className="home-flow">
        <strong>Slik henger det sammen:</strong> skriv i timen, forstå med visualiseringene, øv med flashcards.
      </p>

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

function FeatureCard({ feature, last }: { feature: Feature; last: Subject | null }) {
  const Icon = feature.icon;
  const link = last && feature.link ? feature.link(last) : null;
  return (
    <li className="home-feature">
      <div className="home-feature-head">
        <span className="home-feature-icon">
          <Icon size={20} aria-hidden />
        </span>
        <h2 className="home-feature-title">{feature.title}</h2>
      </div>
      <p className="home-feature-text">{feature.text}</p>
      <p className="home-feature-why">
        <span className="home-feature-why-label">Hvorfor:</span> {feature.why}
      </p>
      {link && last && (
        <Link to={link.to} className="home-feature-link" data-profile={profileOf(last.profile)}>
          {link.label} <ArrowRight size={16} aria-hidden />
        </Link>
      )}
    </li>
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
