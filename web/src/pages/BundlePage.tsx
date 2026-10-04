import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router';
import { useLiveQuery } from 'dexie-react-hooks';
import { ChevronLeft, CloudOff, Download, FileStack, RefreshCw } from 'lucide-react';
import { api, errorMessage, urls } from '../api';
import { EmptyState, PageSkeleton } from '../components/EmptyState';
import { PdfViewer } from '../components/PdfViewer';
import { Spinner } from '../components/Status';
import { useChapter, useChapters, useSubject, useSubjectNotes } from '../data';
import { asBlob, db, storable } from '../db';
import { useOnline } from '../lib/connectivity';
import { downloadUrl, saveBlob } from '../lib/download';
import { chapterHeading, chapterLabel, formatTimestamp, plural, slugify } from '../lib/format';
import { toast } from '../lib/ui';
import { useDocumentTitle } from '../lib/useDocumentTitle';
import { NotFoundPage } from './NotFoundPage';

export function BundlePage() {
  const { subjectId, chapterId } = useParams();
  const isChapter = chapterId !== undefined;
  const key = isChapter ? `chapter:${chapterId}` : `subject:${subjectId}`;
  const subject = useSubject(subjectId);
  const chapter = useChapter(chapterId);
  const chapters = useChapters(subjectId);
  const notes = useSubjectNotes(subjectId);
  const cached = useLiveQuery(async () => (await db.bundlePdfs.get(key)) ?? null, [key]);
  const { online } = useOnline();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  const scopeNotes = useMemo(
    () =>
      (notes ?? []).filter(
        (n) => n.status === 'done' && n.pdfRev > 0 && (!isChapter || n.chapterId === chapterId),
      ),
    [notes, isChapter, chapterId],
  );

  // Signatur av innholdet – endres den, er den lagrede samle-PDF-en utdatert.
  const sig = useMemo(() => {
    const parts = scopeNotes.map((n) => `${n.id}:${n.pdfRev}`).sort();
    const heads = isChapter
      ? [chapter ? chapterLabel(chapter) : '']
      : [subject?.name ?? '', subject?.textbook ?? '', ...(chapters ?? []).map((c) => `${c.id}:${chapterLabel(c)}`)];
    return `${parts.join(',')}|${heads.join('|')}`;
  }, [scopeNotes, isChapter, chapter, chapters, subject]);

  const ready = notes !== undefined && cached !== undefined && subject !== undefined && (!isChapter || chapter !== undefined);
  const stale = !cached || cached.sig !== sig;
  const title = isChapter ? (chapter ? chapterHeading(chapter) : '') : (subject?.name ?? '');
  useDocumentTitle(title ? `${title} (PDF)` : null);

  useEffect(() => {
    if (!ready || !stale || !online || scopeNotes.length === 0) return;
    if (!subjectId || (isChapter && !chapterId)) return;
    const ctrl = new AbortController();
    setLoading(true);
    setError(null);
    const request = isChapter ? api.chapterPdf(chapterId, ctrl.signal) : api.subjectPdf(subjectId, ctrl.signal);
    request
      .then(async (blob) => {
        await db.bundlePdfs.put({ key, blob: await storable(blob), fetchedAt: Date.now(), sig });
        if (!ctrl.signal.aborted) setLoading(false);
      })
      .catch((err: unknown) => {
        if (ctrl.signal.aborted) return;
        setLoading(false);
        setError(errorMessage(err, 'Kunne ikke sette sammen PDF-en.'));
      });
    return () => {
      ctrl.abort();
      setLoading(false);
    };
    // scopeNotes.length dekkes av sig.
  }, [ready, stale, online, key, sig, attempt, isChapter, chapterId, subjectId]);

  if (!ready) return <PageSkeleton />;
  if (!subject) return <NotFoundPage what="faget" />;
  if (isChapter && !chapter) return <NotFoundPage what="kapittelet" />;

  const backTo = isChapter ? `/fag/${subject.id}/kapittel/${chapterId}` : `/fag/${subject.id}`;
  const backLabel = isChapter && chapter ? chapterHeading(chapter) : subject.name;
  const filename = `${slugify(isChapter && chapter ? `${subject.name} ${chapterLabel(chapter)}` : subject.name, 'samle')}.pdf`;

  const download = () => {
    if (cached) saveBlob(asBlob(cached.blob, 'application/pdf'), filename);
    else if (online) downloadUrl(isChapter ? urls.chapterPdfDownload(chapterId) : urls.subjectPdfDownload(subject.id), filename);
    else toast('PDF-en er ikke lagret på denne enheten.', { kind: 'error' });
  };

  const refresh = async () => {
    setError(null);
    if (cached) await db.bundlePdfs.update(key, { sig: '' });
    setAttempt((a) => a + 1);
  };

  let body;
  if (scopeNotes.length === 0 && !cached) {
    body = (
      <EmptyState icon={<FileStack size={30} aria-hidden />} title="Ingen ferdige notater ennå">
        <p>Samle-PDF-en lages av alle ferdige notater {isChapter ? 'i kapittelet' : 'i faget'}.</p>
      </EmptyState>
    );
  } else if (cached) {
    body = (
      <PdfViewer
        blob={asBlob(cached.blob, 'application/pdf')}
        docKey={`${key}:${cached.fetchedAt}`}
        label={`Samle-PDF: ${title}`}
        toolbarExtra={
          <button type="button" className="btn btn-ghost btn-sm" onClick={download}>
            <Download size={16} aria-hidden />
            <span className="hide-xs">Last ned</span>
          </button>
        }
      />
    );
  } else if (loading) {
    body = (
      <div className="assembling" role="status">
        <Spinner size={28} />
        <strong>Setter sammen PDF …</strong>
        <p>Dette kan ta et halvt minutt.</p>
      </div>
    );
  } else if (!online) {
    body = (
      <EmptyState icon={<CloudOff size={30} aria-hidden />} title="Ikke lagret på enheten">
        <p>Denne samle-PDF-en er ikke lastet ned ennå. Koble til nettet for å lage den.</p>
      </EmptyState>
    );
  } else {
    body = (
      <div className="panel-message" role="alert">
        <p>{error ?? 'Kunne ikke sette sammen PDF-en.'}</p>
        <button type="button" className="btn" onClick={() => setAttempt((a) => a + 1)}>
          <RefreshCw size={16} aria-hidden /> Prøv igjen
        </button>
      </div>
    );
  }

  return (
    <div className="page page-bundle">
      <nav className="breadcrumb" aria-label="Brødsmuler">
        <Link to={backTo}>
          <ChevronLeft size={16} aria-hidden />
          {backLabel}
        </Link>
      </nav>
      <header className="page-header">
        <div className="page-heading">
          <h1 className="page-title">{title}</h1>
          <p className="page-subtitle">
            <span>
              {isChapter ? 'Hele kapittelet' : 'Hele faget'} som én PDF · {plural(scopeNotes.length, 'notat', 'notater')}
            </span>
          </p>
        </div>
        <div className="page-actions">
          <button
            type="button"
            className="btn"
            onClick={() => void refresh()}
            disabled={!online || loading || scopeNotes.length === 0}
            title={online ? 'Lag PDF-en på nytt' : 'Krever nett'}
          >
            <RefreshCw size={17} aria-hidden className={loading ? 'spin' : undefined} />
            <span className="hide-xs">Oppdater</span>
          </button>
          <button type="button" className="btn btn-primary" onClick={download} disabled={!cached && !online}>
            <Download size={17} aria-hidden /> Last ned
          </button>
        </div>
      </header>

      {cached && (
        <p className="inline-note" role="status">
          {loading ? (
            <>
              <Spinner size={12} /> Setter sammen en oppdatert versjon … dette kan ta et halvt minutt.
            </>
          ) : !online ? (
            <>
              <CloudOff size={14} aria-hidden /> Offline – viser versjonen lagret {formatTimestamp(cached.fetchedAt)}.
            </>
          ) : error ? (
            <>{error} Viser versjonen lagret {formatTimestamp(cached.fetchedAt)}.</>
          ) : stale ? (
            <>Lagret {formatTimestamp(cached.fetchedAt)} – kan være utdatert.</>
          ) : (
            <>Lagret for offline {formatTimestamp(cached.fetchedAt)}.</>
          )}
        </p>
      )}

      {body}
    </div>
  );
}
