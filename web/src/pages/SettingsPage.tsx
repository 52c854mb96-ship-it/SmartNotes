import { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { CheckCircle2, CloudDownload, LogOut, RefreshCw, XCircle } from 'lucide-react';
import type { HealthResponse } from '@smartnotes/shared';
import { api, errorMessage } from '../api';
import { Spinner } from '../components/Status';
import { ThemeSwitch } from '../components/ThemeSwitch';
import { db } from '../db';
import { useOnline } from '../lib/connectivity';
import { formatBytes, formatTimestamp, plural } from '../lib/format';
import { confirmDialog, toast } from '../lib/ui';
import { useDocumentTitle } from '../lib/useDocumentTitle';
import { downloadAllForOffline, logoutAndClear, requestPersistentStorage, syncNow, useSyncState } from '../sync';
import { useNavigate } from 'react-router';

export function SettingsPage() {
  useDocumentTitle('Innstillinger');
  return (
    <div className="page page-narrow">
      <header className="page-header">
        <div className="page-heading">
          <h1 className="page-title">Innstillinger</h1>
        </div>
      </header>
      <AppearanceCard />
      <ServerCard />
      <SyncCard />
      <StorageCard />
      <AccountCard />
    </div>
  );
}

function AppearanceCard() {
  return (
    <section className="card" aria-labelledby="appearance-h">
      <div className="card-head">
        <h2 id="appearance-h" className="card-title">
          Utseende
        </h2>
        <p className="card-text">Velg lyst eller mørkt tema, eller følg innstillingen på enheten. Valget gjelder bare denne enheten.</p>
      </div>
      <ThemeSwitch />
    </section>
  );
}

function StatusLine({ ok, label, detail }: { ok: boolean | null; label: string; detail?: string }) {
  return (
    <li className="status-line">
      {ok === null ? (
        <span className="status-line-icon muted">–</span>
      ) : ok ? (
        <CheckCircle2 size={18} aria-hidden className="status-line-icon ok" />
      ) : (
        <XCircle size={18} aria-hidden className="status-line-icon bad" />
      )}
      <span>
        {label}
        {detail && <span className="muted"> · {detail}</span>}
      </span>
    </li>
  );
}

function ServerCard() {
  const { online } = useOnline();
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!online) return;
    const ctrl = new AbortController();
    api
      .health(ctrl.signal)
      .then((h) => {
        setHealth(h);
        setError(null);
      })
      .catch((err: unknown) => {
        if (!ctrl.signal.aborted) setError(errorMessage(err, 'Fikk ikke kontakt med serveren.'));
      });
    return () => ctrl.abort();
  }, [online]);

  return (
    <section className="card" aria-labelledby="server-h">
      <div className="card-head">
        <h2 id="server-h" className="card-title">
          Server
        </h2>
      </div>
      {!online ? (
        <p className="muted">Du er offline, så serverstatus kan ikke hentes nå.</p>
      ) : error ? (
        <p className="form-error">{error}</p>
      ) : !health ? (
        <div className="skeleton skeleton-line" />
      ) : (
        <ul className="status-lines" role="list">
          <StatusLine ok={health.ok} label={health.ok ? 'Serveren svarer' : 'Serveren har problemer'} detail={`versjon ${health.version}`} />
          <StatusLine ok={health.latex} label={health.latex ? 'LaTeX er installert' : 'LaTeX mangler på serveren'} />
          <StatusLine
            ok={health.claudeConfigured}
            label={health.claudeConfigured ? 'Claude er satt opp' : 'Claude er ikke satt opp (mangler API-nøkkel)'}
            detail={health.claudeConfigured ? health.model : undefined}
          />
          {health.fakeClaude && <StatusLine ok={null} label="Testmodus: falsk Claude (ingen ekte konvertering)" />}
        </ul>
      )}
    </section>
  );
}

function SyncCard() {
  const sync = useSyncState();
  const { online } = useOnline();
  const counts = useLiveQuery(async () => {
    const [subjects, chapters, notes, outbox] = await Promise.all([
      db.subjects.count(),
      db.chapters.count(),
      db.notes.count(),
      db.outbox.count(),
    ]);
    return { subjects, chapters, notes, outbox };
  }, []);

  return (
    <section className="card" aria-labelledby="sync-h">
      <div className="card-head">
        <h2 id="sync-h" className="card-title">
          Synkronisering
        </h2>
        <p className="card-text">Notatene synkroniseres mellom enhetene dine via serveren.</p>
      </div>
      <dl className="kv">
        <dt>Status</dt>
        <dd>{!online ? 'Offline' : sync.running ? 'Synkroniserer …' : 'På nett'}</dd>
        <dt>Sist synkronisert</dt>
        <dd>{sync.lastSyncAt ? formatTimestamp(sync.lastSyncAt) : 'Aldri'}</dd>
        {counts && (
          <>
            <dt>På denne enheten</dt>
            <dd>
              {plural(counts.subjects, 'fag', 'fag')}, {plural(counts.chapters, 'kapittel', 'kapitler')},{' '}
              {plural(counts.notes, 'notat', 'notater')}
            </dd>
            <dt>Venter på opplasting</dt>
            <dd>{counts.outbox}</dd>
          </>
        )}
        {sync.lastError && (
          <>
            <dt>Siste feil</dt>
            <dd className="text-danger">{sync.lastError}</dd>
          </>
        )}
      </dl>
      <div className="card-actions">
        <button
          type="button"
          className="btn"
          onClick={() => void syncNow()}
          disabled={!online || sync.running}
          title={online ? undefined : 'Krever nett'}
        >
          <RefreshCw size={17} aria-hidden className={sync.running ? 'spin' : undefined} /> Synkroniser nå
        </button>
      </div>
    </section>
  );
}

function StorageCard() {
  const { online } = useOnline();
  const sync = useSyncState();
  const [estimate, setEstimate] = useState<StorageEstimate | null>(null);
  const [persisted, setPersisted] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const pdfStats = useLiveQuery(async () => {
    let count = 0;
    let bytes = 0;
    await db.pdfs.each((p) => {
      count += 1;
      bytes += p.size;
    });
    const bundles = await db.bundlePdfs.count();
    const done = await db.notes.where('status').equals('done').count();
    return { count, bytes, bundles, done };
  }, []);

  const refreshEstimate = () => {
    navigator.storage
      ?.estimate?.()
      .then(setEstimate)
      .catch(() => {});
    navigator.storage
      ?.persisted?.()
      .then(setPersisted)
      .catch(() => {});
  };
  useEffect(refreshEstimate, [pdfStats?.count]);

  const downloadAll = async () => {
    setBusy(true);
    try {
      const res = await downloadAllForOffline();
      if (res.missing === 0) toast('Alt er lastet ned og kan leses offline.', { kind: 'success' });
      else toast(`${plural(res.missing, 'PDF', 'PDF-er')} kunne ikke lastes ned. Prøv igjen senere.`, { kind: 'error' });
    } finally {
      setBusy(false);
      refreshEstimate();
    }
  };

  const persist = async () => {
    const ok = await requestPersistentStorage();
    setPersisted(ok);
    if (!ok) toast('Nettleseren ga ikke varig lagring. Legg appen til på hjemskjermen for best resultat.');
  };

  return (
    <section className="card" aria-labelledby="storage-h">
      <div className="card-head">
        <h2 id="storage-h" className="card-title">
          Lagring på denne enheten
        </h2>
        <p className="card-text">Ferdige PDF-er lagres lokalt, så du kan lese dem uten nett.</p>
      </div>
      <dl className="kv">
        <dt>PDF-er lagret</dt>
        <dd>
          {pdfStats ? `${pdfStats.count} av ${pdfStats.done}` : '…'}
          {pdfStats && pdfStats.bytes > 0 && <span className="muted"> · {formatBytes(pdfStats.bytes)}</span>}
        </dd>
        {pdfStats && pdfStats.bundles > 0 && (
          <>
            <dt>Samle-PDF-er</dt>
            <dd>{pdfStats.bundles}</dd>
          </>
        )}
        <dt>Brukt plass</dt>
        <dd>
          {estimate?.usage !== undefined
            ? `${formatBytes(estimate.usage)}${estimate.quota ? ` av ${formatBytes(estimate.quota)}` : ''}`
            : 'Ukjent'}
        </dd>
        <dt>Varig lagring</dt>
        <dd>
          {persisted === null ? (
            'Ukjent'
          ) : persisted ? (
            'På'
          ) : (
            <>
              Av{' '}
              <button type="button" className="link-btn" onClick={() => void persist()}>
                Be om varig lagring
              </button>
            </>
          )}
        </dd>
      </dl>
      {sync.prefetch && (
        <p className="inline-note" role="status">
          <Spinner size={12} /> Laster ned PDF {Math.min(sync.prefetch.done + 1, sync.prefetch.total)} av{' '}
          {sync.prefetch.total} …
        </p>
      )}
      <div className="card-actions">
        <button
          type="button"
          className="btn"
          onClick={() => void downloadAll()}
          disabled={!online || busy}
          title={online ? undefined : 'Krever nett'}
        >
          {busy ? <Spinner size={14} /> : <CloudDownload size={17} aria-hidden />} Last ned alt for offline
        </button>
      </div>
    </section>
  );
}

function AccountCard() {
  const navigate = useNavigate();
  const outboxCount = useLiveQuery(() => db.outbox.count(), []) ?? 0;
  const logout = async () => {
    const ok = await confirmDialog({
      title: 'Logge ut?',
      body:
        outboxCount > 0
          ? `Alle lokalt lagrede notater og PDF-er fjernes fra denne enheten. ${plural(outboxCount, 'opplasting', 'opplastinger')} som ikke er sendt ennå, går tapt!`
          : 'Alle lokalt lagrede notater og PDF-er fjernes fra denne enheten. Alt ligger trygt på serveren og hentes igjen når du logger inn.',
      confirmLabel: 'Logg ut',
      danger: outboxCount > 0,
    });
    if (!ok) return;
    await logoutAndClear();
    navigate('/logg-inn', { replace: true });
  };
  return (
    <section className="card" aria-labelledby="account-h">
      <div className="card-head">
        <h2 id="account-h" className="card-title">
          Konto
        </h2>
      </div>
      <div className="card-actions">
        <button type="button" className="btn btn-danger-outline" onClick={() => void logout()}>
          <LogOut size={17} aria-hidden /> Logg ut
        </button>
      </div>
    </section>
  );
}
