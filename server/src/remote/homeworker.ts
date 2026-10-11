/**
 * Hjemmemaskinen: henter AI-kall fra serveren, kjører dem med den lokale AI-en (Ollama) og sender svaret tilbake.
 * Kobler seg bare utover til serveren (HTTPS), så ingenting på hjemmenettet må åpnes. Én oppgave om gangen.
 */
import os from 'node:os';
import type { AiService } from '../pipeline/ai.js';
import { PROTOCOL_VERSION, executeRemoteCall, type RemoteOutcome, type RemoteTask } from './protocol.js';

export interface HomeWorkerOptions {
  /** Adressen til SmartNotes-serveren, f.eks. https://smartnotes.up.railway.app. */
  serverUrl: string;
  token: string;
  /** Navnet som vises i innstillingene, f.eks. «Eskils PC». */
  name: string;
  ai: AiService;
  /** Modellene maskinen bruker (for visning på serveren). */
  models: string[];
  tmpDir?: string;
  fetchImpl?: typeof fetch;
  log?: (line: string) => void;
  /** Hvor ofte maskinen sier fra at den fortsatt jobber (ms). */
  heartbeatMs?: number;
  /** Når maskinen tar imot oppgaver (se `parseHours`). Utenfor disse timene henter den ingenting. */
  activeHours?: (now: Date) => boolean;
}

/**
 * «16-23,0-7» → true fra 16:00 til 23:59 og fra 00:00 til 07:59 (lokal tid). Tom tekst = hele døgnet.
 * Kaster ved ugyldig format.
 */
export function parseHours(spec: string | undefined): (now: Date) => boolean {
  const text = spec?.trim() ?? '';
  if (!text) return () => true;
  const ranges = text.split(',').map((part) => {
    const m = /^\s*(\d{1,2})\s*-\s*(\d{1,2})\s*$/.exec(part);
    if (!m || Number(m[1]) > 23 || Number(m[2]) > 23) throw new Error(`Ugyldig WORKER_HOURS «${text}». Skriv for eksempel 16-23,0-7.`);
    return [Number(m[1]), Number(m[2])] as const;
  });
  return (now) => {
    const h = now.getHours();
    return ranges.some(([from, to]) => (from <= to ? h >= from && h <= to : h >= from || h <= to));
  };
}

/**
 * Leser en .env-fil inn i `env` uten å overskrive verdier som allerede er satt. Tåler det Notisblokk på Windows
 * lager: BOM først i filen, CRLF-linjeskift og anførselstegn rundt verdien.
 */
export function loadEnvFile(text: string, env: NodeJS.ProcessEnv = process.env): void {
  for (const raw of text.replace(/^\uFEFF/, '').split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const m = /^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/.exec(line);
    if (!m) continue;
    let value = m[2]!.trim();
    const quoted = /^(["'])(.*)\1$/.exec(value);
    if (quoted) value = quoted[2]!;
    else value = value.replace(/\s+#.*$/, '');
    if (env[m[1]!] === undefined) env[m[1]!] = value;
  }
}

/** HTTPS, eller HTTP bare mot denne maskinen (for testing), så nøkkelen ikke sendes ukryptert over nettet. */
export function safeServerUrl(text: string): boolean {
  let url: URL;
  try {
    url = new URL(text);
  } catch {
    return false;
  }
  if (url.username || url.password) return false;
  if (url.protocol === 'https:') return true;
  return url.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
}

/** Feil som betyr at det ikke hjelper å prøve igjen (feil nøkkel, feil versjon). */
export class FatalWorkerError extends Error {}

/** Venter `ms`, eller til `signal` avbrytes. */
function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  if (signal?.aborted) return Promise.resolve();
  return new Promise<void>((resolve) => {
    const done = () => {
      clearTimeout(t);
      signal?.removeEventListener('abort', done);
      resolve();
    };
    const t = setTimeout(done, ms);
    signal?.addEventListener('abort', done, { once: true });
  });
}

/** Hvor lenge en henting får vente på svar. Serveren svarer etter 25 s når den ikke har noe; resten er slingringsmonn. */
const CLAIM_TIMEOUT_MS = 90_000;

export class HomeWorker {
  private readonly fetch: typeof fetch;
  private readonly log: (line: string) => void;
  private readonly base: string;
  private stopped = false;
  /** Avbryter bare venting (henting av ny oppgave, pauser), aldri en oppgave som pågår eller leveringen av svaret. */
  private readonly idle = new AbortController();
  /** Antall oppgaver som er fullført og levert (for tester og logg). */
  completed = 0;

  constructor(private readonly opts: HomeWorkerOptions) {
    this.fetch = opts.fetchImpl ?? fetch;
    this.log = opts.log ?? (() => {});
    this.base = opts.serverUrl.replace(/\/+$/, '');
  }

  /** Stopper etter oppgaven som eventuelt pågår (svaret leveres først). */
  stop(): void {
    this.stopped = true;
    this.idle.abort();
  }

  /** Henter og kjører oppgaver til `stop()` kalles. Kaster FatalWorkerError ved feil nøkkel eller versjon. */
  async run(): Promise<void> {
    let delay = 2_000;
    let connected = false;
    let resting = false;
    while (!this.stopped) {
      if (this.opts.activeHours && !this.opts.activeHours(new Date())) {
        if (!resting) this.log('Utenfor timene i WORKER_HOURS. Tar ikke imot oppgaver før de begynner igjen.');
        resting = true;
        connected = false;
        await sleep(60_000, this.idle.signal);
        continue;
      }
      resting = false;
      let task: RemoteTask | null;
      try {
        task = await this.claim();
        if (!connected) {
          this.log(`Koblet til ${this.base} som «${this.opts.name}». Venter på oppgaver …`);
          connected = true;
        }
        delay = 2_000;
      } catch (err) {
        if (err instanceof FatalWorkerError) throw err;
        if (this.stopped) return;
        if (connected) this.log(`Mistet kontakten med serveren (${(err as Error).message}). Prøver igjen …`);
        connected = false;
        await sleep(delay, this.idle.signal);
        delay = Math.min(delay * 2, 60_000);
        continue;
      }
      if (task) await this.work(task);
    }
  }

  private headers(): Record<string, string> {
    return { authorization: `Bearer ${this.opts.token}`, 'content-type': 'application/json', 'x-smartnotes': '1' };
  }

  /** `redirect: 'error'`: nøkkelen skal aldri følge med en videresending til en annen adresse. */
  private async post(path: string, body: unknown, timeoutMs: number, signal?: AbortSignal): Promise<Response> {
    const timeout = AbortSignal.timeout(timeoutMs);
    return this.fetch(`${this.base}${path}`, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify(body),
      redirect: 'error',
      signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
    });
  }

  private async claim(): Promise<RemoteTask | null> {
    const body = { name: this.opts.name, protocol: PROTOCOL_VERSION, models: this.opts.models };
    const res = await this.post('/api/worker/claim', body, CLAIM_TIMEOUT_MS, this.idle.signal);
    if (res.status === 204) return null;
    if (res.status === 401) throw new FatalWorkerError('Serveren godtok ikke WORKER_TOKEN. Sjekk at den er lik på serveren og her.');
    if (res.status === 404) throw new FatalWorkerError('Serveren har ikke slått på hjemmemaskinen (WORKER_TOKEN mangler på serveren), eller adressen er feil.');
    if (res.status === 426) throw new FatalWorkerError(((await res.json().catch(() => ({}))) as { message?: string }).message ?? 'Oppdater hjemmemaskinen.');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return ((await res.json()) as { task: RemoteTask }).task;
  }

  private async work(task: RemoteTask): Promise<void> {
    const started = Date.now();
    const what = task.call.method === 'convert' ? `konvertering (${task.call.req.pages.length} sider)` : task.call.method;
    this.log(`Starter ${what} …`);
    let lost = false;
    // Livstegn mens oppgaven kjører og mens svaret leveres, så reservasjonen ikke går ut underveis.
    const beat = setInterval(
      () => {
        this.post(`/api/worker/tasks/${task.id}/heartbeat`, { name: this.opts.name, lease: task.lease }, 15_000)
          .then((r) => {
            if (r.status === 410) lost = true;
          })
          .catch(() => {});
      },
      this.opts.heartbeatMs ?? Math.max(1_000, Math.floor(task.leaseMs / 4)),
    );
    try {
      const outcome = await executeRemoteCall(task.call, this.opts.ai, this.opts.tmpDir ?? os.tmpdir());
      const seconds = ((Date.now() - started) / 1000).toFixed(1);
      if (lost) {
        this.log(`Oppgaven ble avbrutt eller gitt til en annen maskin mens denne jobbet (${seconds} s). Svaret forkastes.`);
        return;
      }
      const delivered = await this.deliver(task, outcome);
      if (delivered === 'gone') this.log(`Serveren trengte ikke svaret lenger (${seconds} s). Det forkastes.`);
      if (delivered !== 'ok') return;
      this.completed += 1;
      this.log(outcome.ok ? `Ferdig med ${what} på ${seconds} s.` : `${what} feilet etter ${seconds} s: ${outcome.error.message}`);
    } finally {
      clearInterval(beat);
    }
  }

  /** Svaret er verdifullt (minutter med GPU-tid): prøver flere ganger hvis nettet svikter. */
  private async deliver(task: RemoteTask, outcome: RemoteOutcome): Promise<'ok' | 'gone' | 'failed'> {
    for (let attempt = 1; ; attempt++) {
      try {
        const res = await this.post(`/api/worker/tasks/${task.id}/result`, { name: this.opts.name, lease: task.lease, outcome }, 60_000);
        if (res.ok) return 'ok';
        if (res.status === 410) return 'gone';
        // Serveren godtar ikke svaret (for stort eller ugyldig): si fra at kallet feilet i stedet for å prøve igjen.
        if ((res.status === 400 || res.status === 413) && outcome.ok) {
          this.log(`Serveren godtok ikke svaret (HTTP ${res.status}).`);
          outcome = { ok: false, error: { message: 'Svaret fra hjemmemaskinen var for stort eller ugyldig.', retryable: false } };
          continue;
        }
        throw new Error(`HTTP ${res.status}`);
      } catch (err) {
        if (attempt >= 5) {
          this.log(`Klarte ikke å levere svaret (${(err as Error).message}).`);
          return 'failed';
        }
        await sleep(2_000 * attempt);
      }
    }
  }
}
