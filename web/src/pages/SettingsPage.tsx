import { Fragment, useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { CheckCircle2, CloudDownload, HardDriveDownload, LogOut, RefreshCw, XCircle } from 'lucide-react';
import type {
  AiStatusResponse,
  BackupStatusResponse,
  ComparisonSummaryResponse,
  ComparisonVerdict,
  HealthResponse,
  UsageKind,
  UsageSummaryResponse,
} from '@smartnotes/shared';
import { api, errorMessage, urls } from '../api';
import { Spinner } from '../components/Status';
import { ThemeSwitch } from '../components/ThemeSwitch';
import { db } from '../db';
import { isOnline, useOnline } from '../lib/connectivity';
import { downloadUrl } from '../lib/download';
import { formatBytes, formatTimestamp, isSameDay, kroner, plural } from '../lib/format';
import { confirmDialog, toast } from '../lib/ui';
import { useDocumentTitle } from '../lib/useDocumentTitle';
import { downloadAllForOffline, logoutAndClear, requestPersistentStorage, syncNow, useSyncState } from '../sync';
import { Link, useNavigate } from 'react-router';

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
      <UsageCard />
      <ComparisonCard />
      <BackupCard />
      <SyncCard />
      <StorageCard />
      <AccountCard />
      <AboutCard />
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

const TASK_LABELS: Record<NonNullable<HealthResponse['ai']>[number]['task'], string> = {
  convert: 'Konvertering',
  flashcards: 'Kortstokker',
  toc: 'Innholdsfortegnelser',
};

const PROVIDER_LABELS: Record<string, string> = { anthropic: 'Claude', ollama: 'lokal (Ollama)', remote: 'hjemmemaskin' };

/** Hjemmemaskinene som henter AI-kall fra serveren, og hvor mange kall som venter. */
function RemoteStatus() {
  const [status, setStatus] = useState<AiStatusResponse['remote']>(null);
  useEffect(() => {
    const ctrl = new AbortController();
    const load = () =>
      api
        .aiStatus(ctrl.signal)
        .then((s) => setStatus(s.remote))
        .catch(() => {});
    void load();
    // Hjemmemaskinen kan komme og gå mens siden er åpen.
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible') void load();
    }, 30_000);
    return () => {
      clearInterval(timer);
      ctrl.abort();
    };
  }, []);
  if (!status) return null;
  const online = status.workers.filter((w) => w.online);
  const queue = status.waiting > 0 ? `${plural(status.waiting, 'kall venter', 'kall venter')}` : 'ingen kall venter';
  return (
    <StatusLine
      ok={online.length > 0}
      label={online.length > 0 ? `Hjemmemaskin på nett: ${online.map((w) => w.name).join(', ')}` : 'Ingen hjemmemaskin på nett'}
      detail={
        online.length > 0
          ? queue
          : `${queue}${status.fallback ? ', Claude brukes i mellomtiden' : ''}${
              status.workers.length ? ` · sist sett ${formatTimestamp(Math.max(...status.workers.map((w) => Date.parse(w.lastSeenAt))))}` : ''
            }`
      }
    />
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
          {/* Én linje når alt går til samme Claude-modell; ellers modell og leverandør per oppgave. */}
          {(health.ai ?? []).every((t) => t.provider === 'anthropic' || t.provider === 'fake') && new Set((health.ai ?? []).map((t) => t.model)).size <= 1 ? (
            <StatusLine
              ok={health.claudeConfigured}
              label={health.claudeConfigured ? 'Claude er satt opp' : 'Claude er ikke satt opp (mangler API-nøkkel)'}
              detail={health.claudeConfigured ? health.model : undefined}
            />
          ) : (
            <>
              {health.ai!.some((t) => t.provider === 'anthropic') && (
                <StatusLine
                  ok={health.claudeConfigured}
                  label={health.claudeConfigured ? 'Claude er satt opp' : 'Claude er ikke satt opp (mangler API-nøkkel)'}
                />
              )}
              <StatusLine
                ok={null}
                label="AI per oppgave"
                detail={health.ai!.map((t) => `${TASK_LABELS[t.task]}: ${PROVIDER_LABELS[t.provider] ?? t.provider}, ${t.model}`).join(' · ')}
              />
              {health.ai!.some((t) => t.provider === 'remote') && <RemoteStatus />}
            </>
          )}
          {health.fakeClaude && <StatusLine ok={null} label="Testmodus: falsk Claude (ingen ekte konvertering)" />}
        </ul>
      )}
    </section>
  );
}

const USAGE_DAYS = 30;
const KIND_LABELS: Record<UsageKind, string> = {
  convert: 'Konvertering',
  fix: 'Retting av LaTeX',
  flashcards: 'Kortstokker',
  toc: 'Innholdsfortegnelser',
  aims: 'Kompetansemål',
};

function UsageCard() {
  const { online } = useOnline();
  const [usage, setUsage] = useState<UsageSummaryResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!online) return;
    const ctrl = new AbortController();
    api
      .usage(USAGE_DAYS, ctrl.signal)
      .then((u) => {
        setUsage(u);
        setError(null);
      })
      .catch((err: unknown) => {
        if (!ctrl.signal.aborted) setError(errorMessage(err, 'Kunne ikke hente forbruket.'));
      });
    return () => ctrl.abort();
  }, [online]);

  return (
    <section className="card" aria-labelledby="usage-h">
      <div className="card-head">
        <h2 id="usage-h" className="card-title">
          Forbruk av AI
        </h2>
        <p className="card-text">
          Hva AI-kallene de siste {USAGE_DAYS} dagene har kostet, beregnet etter listeprisen. Lokale modeller koster ingenting
          her.
        </p>
      </div>
      {!online ? (
        <p className="muted">Du er offline, så forbruket kan ikke hentes nå.</p>
      ) : error ? (
        <p className="form-error">{error}</p>
      ) : !usage ? (
        <div className="skeleton skeleton-line" />
      ) : usage.total.calls === 0 ? (
        <p className="muted">Ingen AI-kall de siste {USAGE_DAYS} dagene.</p>
      ) : (
        <>
          <dl className="kv">
            <dt>Totalt</dt>
            <dd>
              {kroner(usage.total.costNok)} · {plural(usage.total.calls, 'kall', 'kall')}
              {usage.total.failed > 0 && <span className="muted"> ({usage.total.failed} feilet)</span>}
            </dd>
            {usage.byKind.map((k) => (
              <Fragment key={k.kind}>
                <dt>{KIND_LABELS[k.kind] ?? k.kind}</dt>
                <dd>
                  {kroner(k.costNok)} · {plural(k.calls, 'kall', 'kall')}
                </dd>
              </Fragment>
            ))}
            <dt>Modeller</dt>
            <dd>{usage.byModel.map((m) => `${m.model} (${m.calls})`).join(', ')}</dd>
          </dl>
          <p className="muted small">
            {usage.total.unpricedCalls > 0 &&
              `${plural(usage.total.unpricedCalls, 'kall', 'kall')} med ukjent pris er ikke regnet med. `}
            Kurs: 1 dollar = {usage.usdNok.toLocaleString('nb-NO')} kr. Den faktiske regningen står i Anthropic Console under
            Usage.
          </p>
        </>
      )}
    </section>
  );
}

const VERDICT_TEXT: Record<ComparisonVerdict, string> = {
  haiku_ok: 'Haiku er god nok',
  sonnet_better: 'Sonnet er bedre',
};

/** Hvordan Haiku-versjonene av notatene er vurdert mot den vanlige versjonen («Prøv med Haiku …» på et notat). */
function ComparisonCard() {
  const { online } = useOnline();
  const [summary, setSummary] = useState<ComparisonSummaryResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!online) return;
    const ctrl = new AbortController();
    api
      .comparisonSummary(ctrl.signal)
      .then((s) => {
        setSummary(s);
        setError(null);
      })
      .catch((err: unknown) => {
        if (!ctrl.signal.aborted) setError(errorMessage(err, 'Kunne ikke hente sammenligningene.'));
      });
    return () => ctrl.abort();
  }, [online]);

  const empty =
    !!summary &&
    summary.rated + summary.unrated + summary.failed + summary.running === 0 &&
    summary.items.length === 0 &&
    summary.versions.length === 0;
  /** Vurderinger gjort med eldre Haiku-instrukser, for å se om de nye hjelper. */
  const older = summary?.versions.filter((v) => v.version !== summary.promptVersion) ?? [];
  return (
    <section className="card" aria-labelledby="comparison-h">
      <div className="card-head">
        <h2 id="comparison-h" className="card-title">
          Haiku eller Sonnet
        </h2>
        <p className="card-text">Notater du har latt Haiku lage på nytt og sammenlignet med den vanlige versjonen.</p>
      </div>
      {!online ? (
        <p className="muted">Du er offline, så sammenligningene kan ikke hentes nå.</p>
      ) : error ? (
        <p className="form-error">{error}</p>
      ) : !summary ? (
        <div className="skeleton skeleton-line" />
      ) : empty ? (
        <p className="muted">Ingen sammenligninger ennå. Velg «Prøv med Haiku …» i menyen på et notat.</p>
      ) : (
        <>
          <p className="comparison-headline">
            {summary.rated > 0
              ? `Haiku god nok på ${summary.haikuOk} av ${summary.rated}`
              : older.length > 0
                ? 'Ingen er vurdert med de nye instruksene ennå'
                : 'Ingen er vurdert ennå'}
          </p>
          <p className="muted small">Med Haiku-instruksene som gjelder nå (versjon {summary.promptVersion}).</p>
          <dl className="kv">
            {summary.rated > 0 && (
              <>
                <dt>Sonnet er bedre</dt>
                <dd>{summary.sonnetBetter}</dd>
              </>
            )}
            {summary.running > 0 && (
              <>
                <dt>Lages nå</dt>
                <dd>{summary.running}</dd>
              </>
            )}
            {summary.unrated > 0 && (
              <>
                <dt>Ikke vurdert</dt>
                <dd>{summary.unrated}</dd>
              </>
            )}
            {summary.failed > 0 && (
              <>
                <dt>Feilet</dt>
                <dd>{summary.failed}</dd>
              </>
            )}
            {older.map((v) => (
              <Fragment key={v.version}>
                <dt>Versjon {v.version}</dt>
                <dd>
                  Haiku god nok på {v.haikuOk} av {v.rated}
                </dd>
              </Fragment>
            ))}
            <dt>Kostnad</dt>
            <dd>{kroner(summary.costNok)}</dd>
          </dl>
          {summary.items.length > 0 && (
            <details className="comparison-items">
              <summary>Vurderte notater ({summary.items.length})</summary>
              <ul className="comparison-list" role="list">
                {summary.items.map((item) => (
                  <li key={item.noteId}>
                    <span className="comparison-item-head">
                      {item.deleted ? (
                        <span className="muted">Slettet notat</span>
                      ) : (
                        <Link to={`/notat/${item.noteId}/sammenlign`}>{item.title || 'Uten tittel'}</Link>
                      )}
                      <span className={`badge ${item.verdict === 'haiku_ok' ? 'badge-success' : 'badge-neutral'}`}>
                        {VERDICT_TEXT[item.verdict]}
                      </span>
                      {item.promptVersion !== summary.promptVersion && (
                        <span className="muted small">versjon {item.promptVersion}</span>
                      )}
                    </span>
                    {item.comment && <span className="muted small">{item.comment}</span>}
                  </li>
                ))}
              </ul>
            </details>
          )}
        </>
      )}
    </section>
  );
}

const MONTH_MS = 30 * 24 * 60 * 60 * 1000;
/** Så lenge Innstillinger spør serveren om nedlastingen er ferdig (en stor kopi over mobilnett tar litt tid). */
const BACKUP_WATCH_MS = 3 * 60_000;
const backupDateFmt = new Intl.DateTimeFormat('nb-NO', { day: 'numeric', month: 'short', year: 'numeric' });
const backupTimeFmt = new Intl.DateTimeFormat('nb-NO', { hour: '2-digit', minute: '2-digit' });

/** «i dag kl. 14:03» eller «3. okt. 2026 kl. 14:03». Med årstall, så en kopi fra i fjor ikke ser fersk ut. */
function backupTimeText(d: Date): string {
  const time = backupTimeFmt.format(d);
  return isSameDay(d, new Date()) ? `i dag kl. ${time}` : `${backupDateFmt.format(d)} kl. ${time}`;
}

function BackupCard() {
  const { online } = useOnline();
  const [status, setStatus] = useState<BackupStatusResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const [refresh, setRefresh] = useState(0);
  /** «Sist sendt» fra før nedlastingen startet, mens vi venter på at serveren har sendt hele fila. */
  const [watching, setWatching] = useState<{ before: string | null } | null>(null);

  useEffect(() => {
    if (!online) return;
    const ctrl = new AbortController();
    api
      .backupStatus(ctrl.signal)
      .then((s) => {
        setStatus(s);
        setError(null);
      })
      .catch((err: unknown) => {
        if (!ctrl.signal.aborted) setError(errorMessage(err, 'Kunne ikke hente informasjon om sikkerhetskopien.'));
      });
    return () => ctrl.abort();
  }, [online, refresh]);

  // Hent på nytt når man kommer tilbake til appen, for eksempel etter å ha lagret fila.
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible') setRefresh((n) => n + 1);
    };
    window.addEventListener('focus', onVisible);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.removeEventListener('focus', onVisible);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, []);

  // «Sist sendt» settes på serveren når hele fila er sendt (om den ble lagret, vet bare enheten). Spør jevnlig til
  // det skjer, en stund.
  useEffect(() => {
    if (!watching) return;
    const started = Date.now();
    const timer = window.setInterval(() => {
      if (Date.now() - started > BACKUP_WATCH_MS) setWatching(null);
      else void api.backupStatus().then(setStatus, () => {});
    }, 3000);
    return () => window.clearInterval(timer);
  }, [watching]);
  useEffect(() => {
    if (watching && status && status.lastBackupAt !== watching.before) setWatching(null);
  }, [status, watching]);

  const download = async () => {
    setStarting(true);
    try {
      // Sjekker innloggingen først, så nettleseren ikke lagrer en feilmelding som fil.
      const before = await api.backupStatus();
      setStatus(before);
      downloadUrl(urls.backup());
      setWatching({ before: before.lastBackupAt });
      toast('Sikkerhetskopien lastes ned. Sjekk at fila ligger i Nedlastinger, og flytt den til iCloud Drive.', { kind: 'success' });
    } catch (err) {
      toast(errorMessage(err, 'Kunne ikke starte nedlastingen.'), { kind: 'error' });
    } finally {
      // Et dobbeltklikk skal ikke gi to nedlastinger.
      setTimeout(() => setStarting(false), 4000);
    }
  };

  const last = status?.lastBackupAt ? new Date(status.lastBackupAt) : null;
  return (
    <section className="card" aria-labelledby="backup-h">
      <div className="card-head">
        <h2 id="backup-h" className="card-title">
          Sikkerhetskopi
        </h2>
        <p className="card-text">
          Last ned alt som ligger på serveren som én fil: fagene, notatene med originalbildene, PDF-ene og kortstokkene.
          Lagre fila et trygt sted, for eksempel i iCloud Drive, og ta en ny kopi av og til.
        </p>
      </div>
      {!online ? (
        <p className="muted">Du er offline, så sikkerhetskopien kan ikke lastes ned nå.</p>
      ) : error ? (
        <p className="form-error">{error}</p>
      ) : !status ? (
        <div className="skeleton skeleton-line" />
      ) : (
        <dl className="kv">
          <dt>Størrelse</dt>
          <dd>
            ca. {formatBytes(status.approxBytes)} · {plural(status.notes, 'notat', 'notater')}
          </dd>
          <dt>Sist sendt fra serveren</dt>
          <dd>
            {last ? backupTimeText(last) : 'Aldri'}
            {(!last || Date.now() - last.getTime() > MONTH_MS) && (
              <span className="muted"> · {last ? 'over en måned siden' : 'ta gjerne en nå'}</span>
            )}
          </dd>
        </dl>
      )}
      <div className="card-actions">
        <button
          type="button"
          className="btn"
          onClick={() => void download()}
          disabled={!online || starting}
          title={online ? undefined : 'Krever nett'}
        >
          {starting ? <Spinner size={14} /> : <HardDriveDownload size={17} aria-hidden />} Last ned sikkerhetskopi
        </button>
      </div>
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

/** Kilder og lisens for kompetansemålene (NLOD krever kildehenvisning). */
function AboutCard() {
  return (
    <section className="card" aria-labelledby="about-h">
      <div className="card-head">
        <h2 id="about-h" className="card-title">
          Om SmartNotes
        </h2>
      </div>
      <p className="card-text">
        Kompetansemålene er hentet fra læreplanene i LK20 og inneholder data under Norsk lisens for offentlige data (NLOD),
        tilgjengeliggjort av Utdanningsdirektoratet på data.udir.no. Temaene og deltemaene i fagene er SmartNotes&apos; egne.
      </p>
      <p className="card-text">
        SmartNotes er ikke tilknyttet Utdanningsdirektoratet eller noe forlag. En innholdsfortegnelse du importerer fra din
        egen lærebok, er bare synlig for deg.
      </p>
    </section>
  );
}

function AccountCard() {
  const navigate = useNavigate();
  const outboxCount = useLiveQuery(() => db.outbox.count(), []) ?? 0;
  const progressCount = useLiveQuery(() => db.progress.count(), []) ?? 0;
  const logout = async () => {
    // Fremgang fra øving sendes ved utlogging hvis det er nett; uten nett går den tapt.
    const progressLost = progressCount > 0 && !isOnline();
    const losses = [
      outboxCount > 0 ? `${plural(outboxCount, 'opplasting', 'opplastinger')} som ikke er sendt ennå, går tapt!` : '',
      progressLost ? 'Fremgang fra øving med flashcards som ikke er sendt ennå, går tapt.' : '',
    ].filter(Boolean);
    const ok = await confirmDialog({
      title: 'Logge ut?',
      body: losses.length
        ? `Alle lokalt lagrede notater og PDF-er fjernes fra denne enheten. ${losses.join(' ')}`
        : 'Alle lokalt lagrede notater og PDF-er fjernes fra denne enheten. Alt ligger trygt på serveren og hentes igjen når du logger inn.',
      confirmLabel: 'Logg ut',
      danger: losses.length > 0,
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
