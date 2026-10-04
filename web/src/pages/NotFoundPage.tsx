import { Link } from 'react-router';
import { SearchX } from 'lucide-react';
import { EmptyState } from '../components/EmptyState';
import { useDocumentTitle } from '../lib/useDocumentTitle';

export function NotFoundPage({ what }: { what?: string }) {
  useDocumentTitle('Fant ikke siden');
  return (
    <div className="page">
      <EmptyState
        icon={<SearchX size={30} aria-hidden />}
        title={what ? `Fant ikke ${what}` : 'Fant ikke siden'}
        actions={
          <Link to="/" className="btn btn-primary">
            Til forsiden
          </Link>
        }
      >
        <p>{what ? 'Det kan ha blitt slettet, eller er ikke synkronisert til denne enheten ennå.' : 'Lenken er kanskje feil.'}</p>
      </EmptyState>
    </div>
  );
}
