import { Link } from 'react-router';
import { ListChecks, Shapes } from 'lucide-react';
import { isExample } from '../viz/registry';
import type { VizEntry } from '../viz/types';

/** Brikker som lenker til visualiseringer, f.eks. på kapittel- og notatsiden. */
export function VizLinks({ subjectId, entries }: { subjectId: string; entries: VizEntry[] }) {
  if (entries.length === 0) return null;
  return (
    <ul className="viz-links" role="list">
      {entries.map((e) => (
        <li key={e.key}>
          <Link to={`/fag/${subjectId}/visualiseringer/${e.key}`} className="viz-link-chip" title={e.summary}>
            {isExample(e) ? <ListChecks size={15} aria-hidden /> : <Shapes size={15} aria-hidden />}
            {isExample(e) && <span className="sr-only">Eksempeloppgave: </span>}
            {e.title}
          </Link>
        </li>
      ))}
    </ul>
  );
}

/** Kort med kapittelets visualiseringer. */
export function ChapterVizCard({ subjectId, entries }: { subjectId: string; entries: VizEntry[] }) {
  if (entries.length === 0) return null;
  const viz = entries.filter((e) => !isExample(e));
  const examples = entries.filter(isExample);
  return (
    <section className="card" aria-labelledby="chapter-viz-h">
      <div className="card-head">
        <h2 id="chapter-viz-h" className="card-title">
          {examples.length > 0 && viz.length > 0 ? 'Visualiseringer og eksempeloppgaver' : examples.length > 0 ? 'Eksempeloppgaver' : 'Visualiseringer'}
        </h2>
        <p className="card-text">
          {viz.length > 0 && 'Utforsk kapittelet interaktivt: dra i glidebryterne og se hva som skjer.'}
          {viz.length > 0 && examples.length > 0 && ' '}
          {examples.length > 0 && 'Eksempeloppgavene viser løsningen steg for steg.'}
        </p>
      </div>
      <VizLinks subjectId={subjectId} entries={viz} />
      <VizLinks subjectId={subjectId} entries={examples} />
    </section>
  );
}
