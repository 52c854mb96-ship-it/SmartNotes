import { useEffect, useState } from 'react';
import { Download, FileClock, RefreshCw } from 'lucide-react';
import type { Note } from '@smartnotes/shared';
import { errorMessage } from '../../api';
import { PdfViewer } from '../../components/PdfViewer';
import { Spinner } from '../../components/Status';
import { useCachedPdf } from '../../data';
import { asBlob } from '../../db';
import { useOnline } from '../../lib/connectivity';
import { fetchNotePdf } from '../../sync';

export function PdfTab({ note, onDownload }: { note: Note; onDownload: () => void }) {
  const cached = useCachedPdf(note.id);
  const { online } = useOnline();
  const [fetching, setFetching] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  const loading = cached === undefined;
  const fresh = !!cached && cached.rev >= note.pdfRev;

  useEffect(() => {
    if (loading || note.pdfRev === 0 || fresh || !online) return;
    let cancelled = false;
    setFetching(true);
    setFetchError(null);
    fetchNotePdf(note.id, note.pdfRev)
      .catch((err: unknown) => {
        if (!cancelled) setFetchError(errorMessage(err, 'Kunne ikke hente PDF-en.'));
      })
      .finally(() => {
        if (!cancelled) setFetching(false);
      });
    return () => {
      cancelled = true;
    };
  }, [note.id, note.pdfRev, loading, fresh, online, attempt]);

  if (loading) return <div className="skeleton pdf-page-skeleton" style={{ aspectRatio: '210 / 297' }} />;

  if (note.pdfRev === 0 && !cached) {
    return (
      <div className="panel-message">
        <FileClock size={28} aria-hidden />
        <p>
          {note.status === 'failed'
            ? 'Konverteringen feilet, så det finnes ingen PDF ennå.'
            : 'PDF-en lages nå. Den dukker opp her når den er klar.'}
        </p>
      </div>
    );
  }

  if (cached) {
    return (
      <>
        {!fresh && (
          <p className="inline-note" role="status">
            {fetching ? (
              <>
                <Spinner size={12} /> Henter ny versjon av PDF-en …
              </>
            ) : online ? (
              fetchError ?? 'Viser en eldre versjon av PDF-en.'
            ) : (
              'Viser en eldre versjon – den nye lastes ned når du er på nett.'
            )}
          </p>
        )}
        <PdfViewer
          blob={asBlob(cached.blob, 'application/pdf')}
          docKey={`${note.id}:${cached.rev}`}
          label={`PDF: ${note.title}`}
          toolbarExtra={
            <button type="button" className="btn btn-ghost btn-sm" onClick={onDownload}>
              <Download size={16} aria-hidden />
              <span className="hide-xs">Last ned</span>
            </button>
          }
        />
      </>
    );
  }

  if (fetching || (online && !fetchError)) {
    return (
      <div className="panel-message" aria-busy="true">
        <Spinner size={22} />
        <p>Henter PDF …</p>
      </div>
    );
  }

  if (!online) {
    return (
      <div className="panel-message">
        <FileClock size={28} aria-hidden />
        <p>PDF-en er ikke lastet ned til denne enheten ennå. Koble til nettet for å se den.</p>
      </div>
    );
  }

  return (
    <div className="panel-message" role="alert">
      <p>{fetchError}</p>
      <button type="button" className="btn" onClick={() => setAttempt((a) => a + 1)}>
        <RefreshCw size={16} aria-hidden /> Prøv igjen
      </button>
    </div>
  );
}
