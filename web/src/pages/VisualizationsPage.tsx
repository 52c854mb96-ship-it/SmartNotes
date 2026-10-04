import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router';
import { ChevronLeft, NotebookPen, Shapes } from 'lucide-react';
import type { Chapter } from '@smartnotes/shared';
import { EmptyState, PageSkeleton } from '../components/EmptyState';
import { useChapters, useSubject } from '../data';
import { plural } from '../lib/format';
import { useDocumentTitle } from '../lib/useDocumentTitle';
import { VIZ_ENTRIES, hasVisualizations, matchesViz, vizChapterNumbers } from '../viz/registry';
import type { VizEntry } from '../viz/types';
import { NotFoundPage } from './NotFoundPage';

/** Oversikt over de interaktive visualiseringene, ordnet etter kapitlene i læreboka. */
export function VisualizationsPage() {
  const { subjectId } = useParams();
  const subject = useSubject(subjectId);
  const chapters = useChapters(subjectId);
  const [query, setQuery] = useState('');
  useDocumentTitle(subject ? `Visualiseringer · ${subject.name}` : null);

  const groups = useMemo(() => {
    const byNumber = new Map((chapters ?? []).map((c) => [c.number, c]));
    return vizChapterNumbers().map((no) => ({
      no,
      chapter: byNumber.get(no) ?? null,
      entries: VIZ_ENTRIES.filter((e) => e.chapter === no && matchesViz(e, query)),
    }));
  }, [chapters, query]);

  if (subject === undefined || chapters === undefined) return <PageSkeleton />;
  if (subject === null) return <NotFoundPage what="faget" />;

  const back = (
    <nav className="breadcrumb" aria-label="Brødsmuler">
      <Link to={`/fag/${subject.id}`}>
        <ChevronLeft size={16} aria-hidden />
        {subject.name}
      </Link>
    </nav>
  );

  if (!hasVisualizations(subject)) {
    return (
      <div className="page">
        {back}
        <EmptyState icon={<Shapes size={30} aria-hidden />} title="Ingen visualiseringer for dette faget ennå">
          <p>Visualiseringene finnes foreløpig bare for fysikk.</p>
        </EmptyState>
      </div>
    );
  }

  const shown = groups.filter((g) => g.entries.length > 0);
  const total = VIZ_ENTRIES.length;

  return (
    <div className="page">
      {back}
      <header className="page-header">
        <div className="page-heading">
          <p className="eyebrow">{subject.name}</p>
          <h1 className="page-title">Visualiseringer</h1>
          <p className="page-subtitle">
            {plural(total, 'interaktiv forklaring', 'interaktive forklaringer')} ordnet etter kapitlene i læreboka. Dra i
            glidebryterne og se hva som skjer.
          </p>
        </div>
      </header>

      <div className="viz-filter">
        <input
          type="search"
          className="viz-search"
          placeholder="Filtrer, f.eks. friksjon eller 2E"
          aria-label="Filtrer visualiseringene"
          value={query}
          onChange={(e) => setQuery(e.currentTarget.value)}
        />
        {query && (
          <span className="muted small" role="status">
            {plural(
              shown.reduce((n, g) => n + g.entries.length, 0),
              'treff',
              'treff',
            )}
          </span>
        )}
      </div>

      {shown.length === 0 && <p className="muted">Ingen visualiseringer passer med «{query}».</p>}

      {shown.map((g) => (
        <section key={g.no} className="viz-chapter" aria-labelledby={`viz-ch-${g.no}`}>
          <div className="viz-chapter-head">
            <h2 id={`viz-ch-${g.no}`} className="viz-chapter-title">
              <span className="viz-chapter-no">{g.no}</span>
              {g.chapter?.title ?? `Kapittel ${g.no}`}
            </h2>
            {g.chapter && (
              <Link to={`/fag/${subject.id}/kapittel/${g.chapter.id}`} className="btn btn-sm btn-ghost">
                <NotebookPen size={16} aria-hidden /> Notater
              </Link>
            )}
          </div>
          <ul className="viz-cards" role="list">
            {g.entries.map((e) => (
              <li key={e.key}>
                <VizCard subjectId={subject.id} entry={e} chapter={g.chapter} />
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

function VizCard({ subjectId, entry, chapter }: { subjectId: string; entry: VizEntry; chapter: Chapter | null }) {
  const sectionTitles = new Map((chapter?.sections ?? []).map((s) => [s.code, s.title]));
  return (
    <Link to={`/fag/${subjectId}/visualiseringer/${entry.key}`} className="viz-card">
      <span className="viz-card-title">{entry.title}</span>
      <span className="viz-card-summary">{entry.summary}</span>
      <span className="viz-card-meta">
        {entry.sections.map((code) => (
          <span key={code} className="viz-tag" title={sectionTitles.get(code)}>
            {code}
            {sectionTitles.has(code) ? ` ${sectionTitles.get(code)}` : ''}
          </span>
        ))}
      </span>
    </Link>
  );
}
