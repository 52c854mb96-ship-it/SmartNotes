import { Component, Suspense, type ErrorInfo, type ReactNode } from 'react';
import { Link, useParams } from 'react-router';
import { ArrowLeft, ArrowRight, ChevronLeft, NotebookPen, RotateCw } from 'lucide-react';
import { PageSkeleton } from '../components/EmptyState';
import { useChapters, useSubject } from '../data';
import { sectionLabel, sectionsOf } from '../lib/curriculum';
import { useDocumentTitle } from '../lib/useDocumentTitle';
import { getViz, vizEntries } from '../viz/registry';
import { NotFoundPage } from './NotFoundPage';

/** Én interaktiv visualisering. */
export function VisualizationPage() {
  const { subjectId, vizKey } = useParams();
  const subject = useSubject(subjectId);
  const chapters = useChapters(subjectId);
  const entry = getViz(subject?.profile, vizKey);
  useDocumentTitle(entry?.title ?? null);

  if (subject === undefined || chapters === undefined) return <PageSkeleton />;
  if (subject === null) return <NotFoundPage what="faget" />;
  if (!entry) return <NotFoundPage what="visualiseringen" />;

  const chapter = chapters.find((c) => c.number === entry.chapter) ?? null;
  // Delkapitler fra alle kapitlene, siden en visualisering kan høre til delkapitler i flere kapitler.
  const sections = chapters.flatMap((c) => sectionsOf(c));
  const sectionText = entry.sections
    .map((code) => {
      const s = sections.find((x) => x.code === code);
      return s ? sectionLabel(s) : code;
    })
    .join(' · ');
  const all = vizEntries(subject.profile);
  const i = all.indexOf(entry);
  const prev = i > 0 ? all[i - 1] : undefined;
  const next = i < all.length - 1 ? all[i + 1] : undefined;
  const base = `/fag/${subject.id}/visualiseringer`;
  const Viz = entry.Component;

  return (
    <div className="page">
      <nav className="breadcrumb" aria-label="Brødsmuler">
        <Link to={base}>
          <ChevronLeft size={16} aria-hidden />
          Visualiseringer
        </Link>
      </nav>
      <header className="page-header">
        <div className="page-heading">
          <p className="eyebrow">
            Kapittel {entry.chapter}
            {chapter ? ` ${chapter.title}` : ''}
            {sectionText ? ` · ${sectionText}` : ''}
          </p>
          <h1 className="page-title">{entry.title}</h1>
          <p className="page-subtitle">{entry.summary}</p>
        </div>
        {chapter && (
          <div className="page-actions">
            <Link to={`/fag/${subject.id}/kapittel/${chapter.id}`} className="btn">
              <NotebookPen size={18} aria-hidden /> Notater i kapittelet
            </Link>
          </div>
        )}
      </header>

      <VizBoundary key={entry.key}>
        <Suspense fallback={<p className="viz-loading">Laster visualiseringen …</p>}>
          <Viz />
        </Suspense>
      </VizBoundary>

      <nav className="viz-page-nav" aria-label="Andre visualiseringer">
        {prev ? (
          <Link to={`${base}/${prev.key}`} className="btn btn-ghost">
            <ArrowLeft size={18} aria-hidden /> {prev.title}
          </Link>
        ) : (
          <span />
        )}
        {next && (
          <Link to={`${base}/${next.key}`} className="btn btn-ghost">
            {next.title} <ArrowRight size={18} aria-hidden />
          </Link>
        )}
      </nav>
    </div>
  );
}

/** Viser en melding i stedet for en tom side hvis visualiseringen ikke kan lastes (f.eks. uten nett etter en oppdatering). */
class VizBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  override state = { failed: false };

  static getDerivedStateFromError(): { failed: boolean } {
    return { failed: true };
  }

  override componentDidCatch(error: unknown, info: ErrorInfo): void {
    console.error('Visualiseringen feilet', error, info.componentStack);
  }

  override render(): ReactNode {
    if (!this.state.failed) return this.props.children;
    return (
      <div className="panel-message" role="alert">
        <p>Klarte ikke å vise visualiseringen. Sjekk nettforbindelsen og prøv igjen.</p>
        <button type="button" className="btn" onClick={() => location.reload()}>
          <RotateCw size={18} aria-hidden /> Last inn på nytt
        </button>
      </div>
    );
  }
}
