import { Link } from 'react-router';
import { Shapes } from 'lucide-react';
import type { VizEntry } from '../viz/types';

/** Brikker som lenker til visualiseringer, f.eks. på kapittel- og notatsiden. */
export function VizLinks({ subjectId, entries }: { subjectId: string; entries: VizEntry[] }) {
  if (entries.length === 0) return null;
  return (
    <ul className="viz-links" role="list">
      {entries.map((e) => (
        <li key={e.key}>
          <Link to={`/fag/${subjectId}/visualiseringer/${e.key}`} className="viz-link-chip" title={e.summary}>
            <Shapes size={15} aria-hidden />
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
  return (
    <section className="card" aria-labelledby="chapter-viz-h">
      <div className="card-head">
        <h2 id="chapter-viz-h" className="card-title">
          Visualiseringer
        </h2>
        <p className="card-text">Utforsk kapittelet interaktivt: dra i glidebryterne og se hva som skjer.</p>
      </div>
      <VizLinks subjectId={subjectId} entries={entries} />
    </section>
  );
}
