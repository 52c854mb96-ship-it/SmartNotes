import { useEffect, useState, type KeyboardEvent } from 'react';
import { Link, useParams } from 'react-router';
import {
  AlertTriangle,
  Check,
  ChevronLeft,
  CloudOff,
  Download,
  FileX,
  FlaskConical,
  MessageSquareWarning,
  RefreshCw,
  RotateCcw,
} from 'lucide-react';
import type { ComparisonVerdict, Note, NoteComparison } from '@smartnotes/shared';
import { api, errorMessage } from '../api';
import { PageSkeleton } from '../components/EmptyState';
import { PdfViewer } from '../components/PdfViewer';
import { Spinner } from '../components/Status';
import { useNote } from '../data';
import { useOnline } from '../lib/connectivity';
import { saveBlob } from '../lib/download';
import { formatTimestamp, kroner, slugify, stageText } from '../lib/format';
import { useMediaQuery } from '../lib/media';
import { confirmDialog, toast } from '../lib/ui';
import { useDocumentTitle } from '../lib/useDocumentTitle';
import { NotFoundPage } from './NotFoundPage';
import { PdfTab } from './note/PdfTab';
import { downloadNotePdf } from './note/downloadPdf';

/** Så ofte siden spør om Haiku-versjonen er ferdig (bare mens den lages og siden er synlig). */
const POLL_MS = 4000;
/** Fra denne bredden vises de to PDF-ene ved siden av hverandre; smalere byttes det med faner. */
const SIDE_BY_SIDE_QUERY = '(min-width: 1400px)';
const OFFLINE_TEXT = 'Sammenligningen krever nett.';

const VERDICTS: { id: ComparisonVerdict; label: string }[] = [
  { id: 'haiku_ok', label: 'Haiku er god nok' },
  { id: 'sonnet_better', label: 'Sonnet er bedre' },
];

type Side = 'base' | 'haiku';
const SIDES: { id: Side; label: string }[] = [
  { id: 'base', label: 'Sonnet' },
  { id: 'haiku', label: 'Haiku' },
];

/** Omtrentlig pris i øre for en Haiku-versjon (ca. 1,5 øre per side). */
function estimateOre(pageCount: number): number {
  return Math.max(1, Math.round(pageCount * 1.5));
}

/**
 * Notatet konvertert med Haiku ved siden av den vanlige versjonen, med vurdering. Krever nett (lagres bare på
 * serveren). Én visning per notat (`key`), så tilstand fra et annet notat ikke blir hengende igjen.
 */
export function ComparePage() {
  const { noteId } = useParams();
  return <CompareView key={noteId} noteId={noteId} />;
}

function CompareView({ noteId }: { noteId: string | undefined }) {
  const note = useNote(noteId);
  const { online } = useOnline();
  /** `undefined` til første svar fra serveren; `null` når notatet ikke er sammenlignet ennå. */
  const [comparison, setComparison] = useState<NoteComparison | null | undefined>(undefined);
  const [loadError, setLoadError] = useState<string | null>(null);
  /** Økes for å hente på nytt. */
  const [reload, setReload] = useState(0);
  /** Økes når en henting er ferdig (også ved feil), så neste spørring planlegges først da. */
  const [loads, setLoads] = useState(0);
  const [starting, setStarting] = useState(false);
  useDocumentTitle(note === null ? 'Fant ikke notatet' : 'Sammenlign med Haiku');

  useEffect(() => {
    if (!noteId || !online) return;
    const ctrl = new AbortController();
    api
      .comparison(noteId, ctrl.signal)
      .then((res) => {
        if (ctrl.signal.aborted) return;
        setComparison(res.comparison);
        setLoadError(null);
      })
      .catch((err: unknown) => {
        if (!ctrl.signal.aborted) setLoadError(errorMessage(err, 'Kunne ikke hente sammenligningen.'));
      })
      .finally(() => {
        if (!ctrl.signal.aborted) setLoads((n) => n + 1);
      });
    return () => ctrl.abort();
  }, [noteId, online, reload]);

  // Mens Haiku jobber: spør igjen en stund etter forrige svar, men bare når siden er synlig og notatet finnes.
  const running = comparison?.status === 'running';
  const gone = note === null;
  useEffect(() => {
    if (!running || !online || gone) return;
    const timer = window.setTimeout(() => {
      if (document.visibilityState === 'visible') setReload((n) => n + 1);
    }, POLL_MS);
    return () => window.clearTimeout(timer);
  }, [running, online, gone, loads]);

  // Tilbake til appen: hent på nytt (og start spørringen igjen hvis den stoppet mens siden var skjult).
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible') setReload((n) => n + 1);
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, []);

  if (note === undefined) return <PageSkeleton />;
  if (note === null) return <NotFoundPage what="notatet" />;

  const start = async (current: NoteComparison | null) => {
    // Spør først når noe går tapt: en ferdig Haiku-PDF eller en vurdering (også av en mislykket kjøring).
    if (current && (current.status === 'done' || current.verdict)) {
      const lost =
        current.status !== 'done'
          ? 'vurderingen din erstattes'
          : current.verdict
            ? 'Haiku-PDF-en og vurderingen din erstattes'
            : 'Haiku-PDF-en erstattes';
      const ok = await confirmDialog({
        title: 'Lage Haiku-versjonen på nytt?',
        body: `Haiku leser sidene på nytt, og ${lost}. Det koster omtrent ${estimateOre(note.pageCount)} øre.`,
        confirmLabel: 'Lag på nytt',
      });
      if (!ok) return;
    }
    setStarting(true);
    try {
      const res = await api.startComparison(note.id);
      setComparison(res.comparison);
    } catch (err) {
      toast(errorMessage(err, 'Kunne ikke starte Haiku-versjonen.'), { kind: 'error' });
      // F.eks. allerede i gang fra en annen enhet: vis det som faktisk skjer.
      setReload((n) => n + 1);
    } finally {
      setStarting(false);
    }
  };

  const title = note.title || 'Uten tittel';
  const settled = comparison && comparison.status !== 'running' ? comparison : null;

  return (
    <div className="page page-compare">
      <nav className="breadcrumb" aria-label="Brødsmuler">
        <Link to={`/notat/${note.id}`}>
          <ChevronLeft size={16} aria-hidden />
          {title}
        </Link>
      </nav>
      <header className="page-header">
        <div className="page-heading">
          <h1 className="page-title">Sammenlign med Haiku</h1>
        </div>
      </header>

      {comparison === undefined ? (
        !online ? (
          <div className="panel-message">
            <CloudOff size={28} aria-hidden />
            <p>{OFFLINE_TEXT}</p>
          </div>
        ) : loadError ? (
          <div className="panel-message" role="alert">
            <p>{loadError}</p>
            <button type="button" className="btn" onClick={() => setReload((n) => n + 1)}>
              <RefreshCw size={16} aria-hidden /> Prøv igjen
            </button>
          </div>
        ) : (
          <div className="skeleton skeleton-card" aria-busy="true" aria-label="Laster" />
        )
      ) : (
        <>
          <div className="compare-top">
            {!online && (
              <p className="inline-note" role="status">
                <CloudOff size={15} aria-hidden /> {OFFLINE_TEXT}
              </p>
            )}
            {comparison === null && (
              <StartCard note={note} online={online} busy={starting} onStart={() => void start(null)} />
            )}
            {comparison?.status === 'running' && <RunningCard comparison={comparison} />}
            {comparison?.status === 'failed' && (
              <FailedCard
                comparison={comparison}
                online={online}
                busy={starting}
                onRetry={() => void start(comparison)}
              />
            )}
            {settled && (
              <RatingCard
                key={settled.createdAt}
                noteId={note.id}
                comparison={settled}
                online={online}
                busy={starting}
                onSaved={setComparison}
                onRestart={() => void start(settled)}
              />
            )}
            {settled?.baseChanged && (
              <p className="inline-note">Den vanlige versjonen er endret etter at Haiku-versjonen ble laget.</p>
            )}
          </div>
          {settled && <ComparePanes note={note} comparison={settled} />}
        </>
      )}
    </div>
  );
}

function StartCard({ note, online, busy, onStart }: { note: Note; online: boolean; busy: boolean; onStart: () => void }) {
  const ready = note.status === 'done' && note.pdfRev > 0;
  return (
    <section className="card">
      <p>
        Haiku leser de samme sidene og lager en egen PDF ved siden av den vanlige, som ikke endres. Det koster omtrent{' '}
        {estimateOre(note.pageCount)} øre.
      </p>
      <div className="card-actions">
        <button
          type="button"
          className="btn btn-primary"
          onClick={onStart}
          disabled={!online || !ready || busy}
          title={!online ? 'Krever nett' : undefined}
        >
          {busy ? <Spinner size={14} /> : <FlaskConical size={17} aria-hidden />} Lag Haiku-versjon
        </button>
        {!ready && <span className="muted small">Notatet må være ferdig konvertert først.</span>}
      </div>
    </section>
  );
}

function RunningCard({ comparison }: { comparison: NoteComparison }) {
  return (
    <section className="progress-card" role="status" aria-live="polite">
      <Spinner size={22} />
      <div className="progress-card-body">
        <strong>{comparison.stage ? `Haiku: ${stageText(comparison.stage)}` : 'Venter på tur'}</strong>
        <p>Haiku lager sin versjon av notatet. Du kan trygt lukke appen.</p>
      </div>
    </section>
  );
}

function FailedCard({
  comparison,
  online,
  busy,
  onRetry,
}: {
  comparison: NoteComparison;
  online: boolean;
  busy: boolean;
  onRetry: () => void;
}) {
  return (
    <section className="error-card" role="alert">
      <AlertTriangle size={22} aria-hidden className="error-card-icon" />
      <div className="error-card-body">
        <strong>Haiku-versjonen feilet</strong>
        <p>{comparison.error ?? 'Noe gikk galt da Haiku skulle lage PDF-en.'}</p>
        <div className="error-card-actions">
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={onRetry}
            disabled={!online || busy}
            title={online ? undefined : 'Krever nett'}
          >
            {busy ? <Spinner size={14} /> : <RotateCcw size={15} aria-hidden />} Prøv igjen
          </button>
        </div>
      </div>
    </section>
  );
}

function RatingCard({
  noteId,
  comparison,
  online,
  busy,
  onSaved,
  onRestart,
}: {
  noteId: string;
  comparison: NoteComparison;
  online: boolean;
  busy: boolean;
  onSaved: (c: NoteComparison) => void;
  onRestart: () => void;
}) {
  const [comment, setComment] = useState(comparison.comment ?? '');
  const [saving, setSaving] = useState<ComparisonVerdict | null>(null);
  // Uten PDF fra Haiku kan den ikke være god nok; da kan eleven bare telle det som «Sonnet er bedre».
  const failed = comparison.status === 'failed';
  const verdicts = failed ? VERDICTS.filter((v) => v.id === 'sonnet_better') : VERDICTS;
  /** Kommentaren er endret etter at vurderingen ble lagret. */
  const dirty = comparison.verdict !== null && comment.trim() !== (comparison.comment ?? '');

  const rate = async (verdict: ComparisonVerdict) => {
    setSaving(verdict);
    try {
      const res = await api.rateComparison(noteId, { verdict, comment: comment.trim() || null });
      if (res.comparison) onSaved(res.comparison);
      toast('Vurderingen er lagret.', { kind: 'success' });
    } catch (err) {
      toast(errorMessage(err, 'Kunne ikke lagre vurderingen.'), { kind: 'error' });
    } finally {
      setSaving(null);
    }
  };

  return (
    <section className="card" aria-labelledby="compare-rating-h">
      <div className="card-head">
        <h2 id="compare-rating-h" className="card-title">
          Din vurdering
        </h2>
        <p className="card-text">
          {failed
            ? 'Haiku laget ingen PDF denne gangen. Vil du telle det som at Sonnet er bedre?'
            : 'Se gjennom begge PDF-ene og velg det som passer best. Kommentaren lagres sammen med vurderingen.'}
        </p>
      </div>
      <label className="field">
        <span className="field-label">
          Kommentar <span className="optional">(valgfri)</span>
        </span>
        <textarea
          className="compare-comment"
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          rows={2}
          maxLength={2000}
          placeholder="F.eks. «Haiku leste formelen på side 2 feil»"
        />
      </label>
      <div className="card-actions">
        {verdicts.map((v) => {
          const chosen = comparison.verdict === v.id;
          return (
            <button
              key={v.id}
              type="button"
              className="btn compare-verdict"
              aria-pressed={chosen}
              onClick={() => void rate(v.id)}
              disabled={!online || saving !== null}
              title={online ? undefined : 'Krever nett'}
            >
              {saving === v.id ? <Spinner size={14} /> : chosen ? <Check size={17} aria-hidden /> : null}
              {v.label}
            </button>
          );
        })}
        {dirty && (
          <button
            type="button"
            className="btn btn-sm"
            onClick={() => void rate(comparison.verdict!)}
            disabled={!online || saving !== null}
            title={online ? undefined : 'Krever nett'}
          >
            Lagre kommentar
          </button>
        )}
        <span className="spacer" />
        {comparison.status === 'done' && (
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={onRestart}
            disabled={!online || busy}
            title={online ? undefined : 'Krever nett'}
          >
            <RotateCcw size={15} aria-hidden /> Lag på nytt …
          </button>
        )}
      </div>
      {dirty ? (
        <p className="muted small">Kommentaren er endret, men ikke lagret.</p>
      ) : (
        comparison.ratedAt && <p className="muted small">Sist lagret {formatTimestamp(comparison.ratedAt)}.</p>
      )}
    </section>
  );
}

function ComparePanes({ note, comparison }: { note: Note; comparison: NoteComparison }) {
  const sideBySide = useMediaQuery(SIDE_BY_SIDE_QUERY);
  const [view, setView] = useState<Side>('haiku');
  const title = note.title || 'Uten tittel';
  const version = comparison.finishedAt ?? comparison.createdAt;

  const onTabKey = (e: KeyboardEvent) => {
    const i = SIDES.findIndex((s) => s.id === view);
    let next = -1;
    if (e.key === 'ArrowRight') next = (i + 1) % SIDES.length;
    else if (e.key === 'ArrowLeft') next = (i - 1 + SIDES.length) % SIDES.length;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = SIDES.length - 1;
    if (next < 0) return;
    e.preventDefault();
    const side = SIDES[next]!;
    setView(side.id);
    document.getElementById(`compare-tab-${side.id}`)?.focus();
  };

  // Faner på smale skjermer: begge panelene er montert, så PDF-ene ikke lastes på nytt ved bytte.
  const paneProps = (side: Side) =>
    sideBySide
      ? { 'aria-labelledby': `compare-${side}-h` }
      : {
          role: 'tabpanel',
          id: `compare-panel-${side}`,
          'aria-labelledby': `compare-tab-${side}`,
          hidden: view !== side,
        };

  return (
    <div className="compare">
      {!sideBySide && (
        <div className="segmented compare-switch" role="tablist" aria-label="Versjon" onKeyDown={onTabKey}>
          {SIDES.map((s) => (
            <button
              key={s.id}
              type="button"
              role="tab"
              id={`compare-tab-${s.id}`}
              aria-selected={view === s.id}
              aria-controls={`compare-panel-${s.id}`}
              tabIndex={view === s.id ? 0 : -1}
              className="segment"
              onClick={() => setView(s.id)}
            >
              {s.label}
            </button>
          ))}
        </div>
      )}
      <div className={sideBySide ? 'compare-panes is-side-by-side' : 'compare-panes'}>
        <section className="compare-pane" {...paneProps('base')}>
          <div className="compare-pane-head">
            <h2 id="compare-base-h" className="compare-pane-title">
              Vanlig versjon
            </h2>
            {comparison.baseModel && <span className="muted small">{comparison.baseModel}</span>}
          </div>
          <Remarks items={note.remarks} />
          <PdfTab note={note} onDownload={() => void downloadNotePdf(note)} />
        </section>
        <section className="compare-pane" {...paneProps('haiku')}>
          <div className="compare-pane-head">
            <h2 id="compare-haiku-h" className="compare-pane-title">
              Haiku-versjon
            </h2>
            <span className="muted small">
              {comparison.model}
              {comparison.costNok !== null && ` · ${kroner(comparison.costNok)}`}
            </span>
          </div>
          {comparison.status === 'done' ? (
            <>
              <Remarks items={comparison.remarks} />
              <HaikuPdf noteId={note.id} version={version} title={title} />
            </>
          ) : (
            <div className="panel-message">
              <FileX size={28} aria-hidden />
              <p>Haiku klarte ikke å lage en PDF denne gangen.</p>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function Remarks({ items }: { items: string[] }) {
  if (items.length === 0) return null;
  return (
    <details className="remarks">
      <summary>
        <MessageSquareWarning size={17} aria-hidden />
        Merknader ({items.length})
      </summary>
      <ul>
        {items.map((r, i) => (
          <li key={i}>{r}</li>
        ))}
      </ul>
    </details>
  );
}

/** Haiku-PDF-en hentes rett fra serveren til minnet (den lagres ikke på enheten). */
function HaikuPdf({ noteId, version, title }: { noteId: string; version: string; title: string }) {
  const [blob, setBlob] = useState<Blob | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const ctrl = new AbortController();
    setBlob(null);
    setError(null);
    api.comparePdf(noteId, version, ctrl.signal).then(
      (b) => {
        if (!ctrl.signal.aborted) setBlob(b);
      },
      (err: unknown) => {
        if (!ctrl.signal.aborted) setError(errorMessage(err, 'Kunne ikke hente Haiku-PDF-en.'));
      },
    );
    return () => ctrl.abort();
  }, [noteId, version, attempt]);

  if (error) {
    return (
      <div className="panel-message" role="alert">
        <p>{error}</p>
        <button type="button" className="btn" onClick={() => setAttempt((a) => a + 1)}>
          <RefreshCw size={16} aria-hidden /> Prøv igjen
        </button>
      </div>
    );
  }
  if (!blob) {
    return (
      <div className="panel-message" aria-busy="true">
        <Spinner size={22} />
        <p>Henter PDF …</p>
      </div>
    );
  }
  return (
    <PdfViewer
      blob={blob}
      docKey={`haiku:${noteId}:${version}`}
      label={`Haiku-PDF: ${title}`}
      toolbarExtra={
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          aria-label="Last ned Haiku-PDF"
          title="Last ned Haiku-PDF"
          onClick={() => saveBlob(blob, `${slugify(title)}-haiku.pdf`)}
        >
          <Download size={16} aria-hidden />
          <span className="hide-xs">Last ned</span>
        </button>
      }
    />
  );
}
