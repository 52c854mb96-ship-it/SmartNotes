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

/** Feil som betyr at det ikke hjelper å prøve igjen (feil nøkkel, feil versjon). */
export class FatalWorkerError extends Error {}

const sleep = (ms: number, signal?: AbortSignal) =>
  new Promise<void>((resolve) => {
    const t = setTimeout(resolve, ms);
    signal?.addEventListener('abort', () => {
      clearTimeout(t);
      resolve();
    });
  });

export class HomeWorker {
  private readonly fetch: typeof fetch;
  private readonly log: (line: string) => void;
  private readonly base: string;
  private stopped = false;
  private readonly abort = new AbortController();
  /** Antall oppgaver som er fullført (for tester og logg). */
  completed = 0;

  constructor(private readonly opts: HomeWorkerOptions) {
    this.fetch = opts.fetchImpl ?? fetch;
    this.log = opts.log ?? (() => {});
    this.base = opts.serverUrl.replace(/\/+$/, '');
  }

  /** Stopper etter oppgaven som eventuelt pågår. */
  stop(): void {
    this.stopped = true;
    this.abort.abort();
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
        await sleep(60_000, this.abort.signal);
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
        await sleep(delay, this.abort.signal);
        delay = Math.min(delay * 2, 60_000);
        continue;
      }
      if (task) await this.work(task);
    }
  }

  private headers(): Record<string, string> {
    return { authorization: `Bearer ${this.opts.token}`, 'content-type': 'application/json', 'x-smartnotes': '1' };
  }

  private async post(path: string, body: unknown, timeoutMs: number): Promise<Response> {
    const signal = AbortSignal.any([this.abort.signal, AbortSignal.timeout(timeoutMs)]);
    return this.fetch(`${this.base}${path}`, { method: 'POST', headers: this.headers(), body: JSON.stringify(body), signal });
  }

  private async claim(): Promise<RemoteTask | null> {
    const res = await this.post('/api/worker/claim', { name: this.opts.name, protocol: PROTOCOL_VERSION, models: this.opts.models }, 40_000);
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
    const beat = setInterval(
      () => {
        this.post(`/api/worker/tasks/${task.id}/heartbeat`, { name: this.opts.name }, 15_000)
          .then((r) => {
            if (r.status === 410) lost = true;
          })
          .catch(() => {});
      },
      this.opts.heartbeatMs ?? Math.max(1_000, Math.floor(task.leaseMs / 4)),
    );
    let outcome: RemoteOutcome;
    try {
      outcome = await executeRemoteCall(task.call, this.opts.ai, this.opts.tmpDir ?? os.tmpdir());
    } finally {
      clearInterval(beat);
    }
    const seconds = ((Date.now() - started) / 1000).toFixed(1);
    if (lost) {
      this.log(`Oppgaven ble gitt til en annen maskin mens denne jobbet (${seconds} s). Svaret forkastes.`);
      return;
    }
    // Svaret er verdifullt (minutter med GPU-tid): prøv å levere det flere ganger hvis nettet svikter.
    for (let attempt = 1; attempt <= 5; attempt++) {
      try {
        const res = await this.post(`/api/worker/tasks/${task.id}/result`, { name: this.opts.name, outcome }, 60_000);
        if (res.ok || res.status === 410) break;
        throw new Error(`HTTP ${res.status}`);
      } catch (err) {
        if (attempt === 5 || this.stopped) {
          this.log(`Klarte ikke å levere svaret (${(err as Error).message}).`);
          return;
        }
        await sleep(2_000 * attempt, this.abort.signal);
      }
    }
    this.completed += 1;
    this.log(outcome.ok ? `Ferdig med ${what} på ${seconds} s.` : `${what} feilet etter ${seconds} s: ${outcome.error.message}`);
  }
}
