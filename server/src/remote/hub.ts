/**
 * Køen på serveren for AI-kall som skal kjøres på hjemmemaskinen.
 *
 * Et AI-kall (for eksempel konvertering av et notat) legges i køen og venter til en hjemmemaskin henter det. Henting
 * gir en kort reservasjon (lease) som hjemmemaskinen fornyer med heartbeat mens den jobber. Forsvinner den (strømbrudd,
 * lokket lukket), går reservasjonen ut og kallet legges tilbake i køen, som en kølapp som går tilbake i bunken når
 * ingen svarer.
 */
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { AbortedError, ConversionError } from '../errors.js';
import { parseMeta } from '../pipeline/parse.js';
import type { AiService, ConvertRequest, ConvertResult, FixRequest } from '../pipeline/ai.js';
import type { ChapterInput, CompetenceAim } from '@smartnotes/shared';
import type { ChoicesRequest, FlashcardRequest, RawCardChoices, RawFlashcard } from '../flashcards/prompt.js';
import type { Profile } from '../profiles/index.js';
import { currentUsageRef, type Usage, type UsageRef } from '../usage.js';
import { encodePages, type ClaimRequest, type RemoteCall, type RemoteMethod, type RemoteOutcome, type RemoteTask } from './protocol.js';

export interface RemoteHubOptions {
  /** Hvor lenge en henting er reservert uten heartbeat (ms). */
  leaseMs: number;
  /** Hvor lenge et kall kan vente på en hjemmemaskin før det gir opp (ms). */
  maxWaitMs: number;
  /** Samme for kall der brukeren venter på svar i appen (innholdsfortegnelse, kompetansemål). */
  interactiveWaitMs: number;
  /** Hvor lenge en hjemmemaskin kan jobbe med ett kall, selv med heartbeat (ms). Stopper kall som henger. */
  maxRunMs: number;
  /** Hvor mange ganger et kall kan hentes uten svar før det gir opp. */
  maxAttempts: number;
  /** En hjemmemaskin regnes som på nett hvis den har spurt etter oppgaver så nylig (ms). */
  onlineWithinMs: number;
  /**
   * Om det finnes en reserve (Claude). Da gir køen opp kall med en gang ingen hjemmemaskin er på nett, eller når
   * hjemmemaskinen ikke klarer dem, så `RemoteWithFallback` kan sende dem til reserven i stedet for å vente.
   */
  fallback?: boolean;
  /**
   * Kalles når et kall må vente fordi ingen hjemmemaskin hentet det med en gang, og når ventingen er over: kallet er
   * hentet, eller det går til reserven.
   */
  onWaiting?: (ref: UsageRef, method: RemoteMethod) => void;
  onWaitEnded?: (ref: UsageRef, method: RemoteMethod) => void;
  now?: () => number;
}

interface Pending {
  id: string;
  call: RemoteCall;
  ref: UsageRef;
  interactive: boolean;
  createdAt: number;
  attempts: number;
  /** Tilfeldig id for hver henting, så et svar fra en eldre henting av samme kall ikke godtas. */
  lease: string | null;
  leasedBy: string | null;
  leasedAt: number;
  leaseUntil: number;
  waitingReported: boolean;
  resolve: (outcome: RemoteOutcome) => void;
}

export interface RemoteWorkerInfo {
  name: string;
  lastSeenAt: string;
  models: string[];
  busy: boolean;
  online: boolean;
}

/** Hjemmemaskiner som ikke har vært i kontakt på et døgn, fjernes fra listen. */
const FORGET_WORKER_MS = 24 * 60 * 60_000;

export class RemoteHub {
  private readonly queue: Pending[] = [];
  private readonly leased = new Map<string, Pending>();
  private readonly waiters = new Set<{ take: (task: Pending) => boolean; cancel: () => void }>();
  private readonly workers = new Map<string, { lastSeen: number; models: string[] }>();
  private readonly timer: NodeJS.Timeout;
  private closed = false;
  private readonly now: () => number;

  constructor(private readonly opts: RemoteHubOptions) {
    this.now = opts.now ?? Date.now;
    this.timer = setInterval(() => this.sweep(), 2_000);
    this.timer.unref();
  }

  /** Legger et AI-kall i køen og venter på svaret fra hjemmemaskinen. */
  submit(call: RemoteCall, opts: { interactive?: boolean; ref?: UsageRef } = {}): Promise<RemoteOutcome> {
    if (this.closed) return Promise.resolve(aborted('Serveren holder på å stenge. Prøver igjen om litt.'));
    const interactive = opts.interactive ?? false;
    if ((interactive || this.opts.fallback) && !this.online()) {
      return Promise.resolve(this.giveUp('Hjemmemaskinen med den lokale AI-en er ikke på nett akkurat nå. Prøv igjen senere.', false));
    }
    return new Promise<RemoteOutcome>((resolve) => {
      const task: Pending = {
        id: randomUUID(),
        call,
        ref: opts.ref ?? {},
        interactive,
        createdAt: this.now(),
        attempts: 0,
        lease: null,
        leasedBy: null,
        leasedAt: 0,
        leaseUntil: 0,
        waitingReported: false,
        resolve,
      };
      if (!this.offer(task)) this.enqueue(task, false);
    });
  }

  /**
   * Henter neste kall for hjemmemaskinen `req.name`, og venter inntil `waitMs` hvis køen er tom (long polling).
   * `gone` sier om forespørselen er avbrutt, så et kall ikke reserveres til en tilkobling som er borte.
   */
  claim(req: ClaimRequest, waitMs: number, gone: () => boolean): Promise<RemoteTask | null> {
    this.seen(req.name, req.models);
    const next = this.queue.shift();
    if (next) return Promise.resolve(this.lease(next, req.name));
    if (this.closed || waitMs <= 0) return Promise.resolve(null);
    return new Promise((resolve) => {
      const done = (task: RemoteTask | null) => {
        this.waiters.delete(waiter);
        clearTimeout(timeout);
        resolve(task);
      };
      const waiter = {
        // En avbrutt forespørsel får ikke kallet; det går videre til neste som venter, eller tilbake i køen.
        take: (task: Pending): boolean => {
          if (gone()) {
            done(null);
            return false;
          }
          done(this.lease(task, req.name));
          return true;
        },
        cancel: () => done(null),
      };
      const timeout = setTimeout(() => {
        this.seen(req.name, req.models);
        done(null);
      }, waitMs);
      this.waiters.add(waiter);
    });
  }

  /** Forlenger reservasjonen. `false` hvis kallet ikke lenger er reservert til denne hentingen. */
  heartbeat(id: string, lease: string, name: string): boolean {
    const task = this.leased.get(id);
    if (!task || task.lease !== lease) return false;
    // Livstegn holder maskinen «på nett» mens den jobber og ikke spør etter nye oppgaver.
    this.seen(name);
    task.leaseUntil = this.now() + this.opts.leaseMs;
    return true;
  }

  /** Svaret fra hjemmemaskinen. `false` hvis kallet allerede er avsluttet eller gitt til en annen. */
  complete(id: string, lease: string, name: string, outcome: RemoteOutcome): boolean {
    const task = this.leased.get(id);
    if (!task || task.lease !== lease) return false;
    this.seen(name);
    this.leased.delete(id);
    task.resolve(outcome);
    return true;
  }

  /**
   * Avbryter kallene som hører til det `match` velger (f.eks. et notat som er slettet), både i køen og hos en
   * hjemmemaskin. Hjemmemaskinen får vite det ved neste heartbeat, og svaret dens forkastes.
   */
  cancel(match: (ref: UsageRef) => boolean): number {
    let n = 0;
    for (let i = this.queue.length - 1; i >= 0; i--) {
      if (!match(this.queue[i]!.ref)) continue;
      this.queue.splice(i, 1)[0]!.resolve(aborted('Avbrutt.'));
      n++;
    }
    for (const task of [...this.leased.values()]) {
      if (!match(task.ref)) continue;
      this.leased.delete(task.id);
      task.resolve(aborted('Avbrutt.'));
      n++;
    }
    return n;
  }

  /** Om en hjemmemaskin har vært i kontakt nylig. */
  online(withinMs = this.opts.onlineWithinMs): boolean {
    const t = this.now();
    for (const w of this.workers.values()) if (t - w.lastSeen <= withinMs) return true;
    return false;
  }

  status(): { workers: RemoteWorkerInfo[]; waiting: number; running: number } {
    const t = this.now();
    const busy = new Set([...this.leased.values()].map((task) => task.leasedBy));
    return {
      workers: [...this.workers].map(([name, w]) => ({
        name,
        lastSeenAt: new Date(w.lastSeen).toISOString(),
        models: w.models,
        busy: busy.has(name),
        online: t - w.lastSeen <= this.opts.onlineWithinMs,
      })),
      waiting: this.queue.length,
      running: this.leased.size,
    };
  }

  /**
   * Avslutter alt som venter (ved nedstenging). Kallene avbrytes uten at noe lagres, og notatene konverteres på nytt
   * fra notatkøen etter omstart.
   */
  close(): void {
    this.closed = true;
    clearInterval(this.timer);
    for (const task of [...this.queue, ...this.leased.values()]) task.resolve(aborted('Serveren startet på nytt. Prøver igjen om litt.'));
    this.queue.length = 0;
    this.leased.clear();
    for (const w of [...this.waiters]) w.cancel();
  }

  /** Utløpte reservasjoner og kall som har ventet for lenge. Kjøres jevnlig; eksportert for tester. */
  sweep(): void {
    const t = this.now();
    for (const task of [...this.leased.values()]) {
      const overtime = t - task.leasedAt >= this.opts.maxRunMs;
      if (task.leaseUntil > t && !overtime) continue;
      this.leased.delete(task.id);
      task.lease = null;
      task.leasedBy = null;
      if (overtime) {
        const minutes = Math.round(this.opts.maxRunMs / 60_000);
        task.resolve(this.giveUp(`Hjemmemaskinen brukte mer enn ${minutes} minutter på dette og ble stoppet. Prøv igjen.`, false));
      } else if (task.attempts >= this.opts.maxAttempts) {
        task.resolve(this.giveUp('Hjemmemaskinen ble borte midt i arbeidet flere ganger. Prøver igjen om litt.', true));
      } else if (!this.offer(task)) {
        this.enqueue(task, true);
      }
    }
    // Med en reserve venter ingenting på en hjemmemaskin som ikke er på nett.
    const offline = this.opts.fallback && !this.online();
    for (let i = this.queue.length - 1; i >= 0; i--) {
      const task = this.queue[i]!;
      const limit = task.interactive ? this.opts.interactiveWaitMs : this.opts.maxWaitMs;
      if (!offline && t - task.createdAt < limit) continue;
      this.queue.splice(i, 1);
      if (this.opts.fallback) this.opts.onWaitEnded?.(task.ref, task.call.method);
      const hours = Math.round(limit / 3_600_000);
      task.resolve(
        this.giveUp(
          task.interactive
            ? 'Hjemmemaskinen med den lokale AI-en svarte ikke i tide. Prøv igjen senere.'
            : `Hjemmemaskinen med den lokale AI-en har ikke vært ledig på ${hours >= 1 ? `${hours} timer` : 'en stund'}. Trykk «Prøv igjen» når den er på nett.`,
          false,
        ),
      );
    }
    for (const [name, w] of this.workers) if (t - w.lastSeen > FORGET_WORKER_MS) this.workers.delete(name);
  }

  /** Når hjemmemaskinen ikke kan ta kallet: med reserve går det dit, ellers feiler det med `message`. */
  private giveUp(message: string, retryable: boolean): RemoteOutcome {
    return this.opts.fallback ? { ok: false, error: { message, retryable: true, code: 'unavailable' } } : fail(message, retryable);
  }

  private enqueue(task: Pending, front: boolean): void {
    if (front) this.queue.unshift(task);
    else this.queue.push(task);
    task.waitingReported = true;
    this.opts.onWaiting?.(task.ref, task.call.method);
  }

  private offer(task: Pending): boolean {
    for (const waiter of [...this.waiters]) if (waiter.take(task)) return true;
    return false;
  }

  private lease(task: Pending, name: string): RemoteTask {
    task.attempts += 1;
    task.lease = randomUUID();
    task.leasedBy = name;
    task.leasedAt = this.now();
    task.leaseUntil = task.leasedAt + this.opts.leaseMs;
    this.leased.set(task.id, task);
    if (task.waitingReported) this.opts.onWaitEnded?.(task.ref, task.call.method);
    return { id: task.id, lease: task.lease, call: task.call, leaseMs: this.opts.leaseMs };
  }

  private seen(name: string, models?: string[]): void {
    const w = this.workers.get(name);
    this.workers.set(name, { lastSeen: this.now(), models: models ?? w?.models ?? [] });
  }
}

function fail(message: string, retryable: boolean): RemoteOutcome {
  return { ok: false, error: { message, retryable } };
}

function aborted(message: string): RemoteOutcome {
  return { ok: false, error: { message, retryable: true, code: 'aborted' } };
}

// ---------- AI-tjenesten som sender kallene til hjemmemaskinen ----------

const usageSchema = z.object({
  kind: z.enum(['convert', 'fix', 'toc', 'aims', 'flashcards']),
  model: z.string(),
  inputTokens: z.number(),
  outputTokens: z.number(),
  cacheReadTokens: z.number(),
  cacheWriteTokens: z.number(),
});
const figureSchema = z.object({ id: z.string(), page: z.number().int(), box: z.tuple([z.number(), z.number(), z.number(), z.number()]) });
const metaSchema = z.object({
  title: z.string().nullable(),
  chapter: z.string().nullable(),
  section: z.string().nullable(),
  newChapter: z.object({ number: z.string().nullable(), title: z.string() }).nullable(),
  date: z.string().nullable(),
  figures: z.array(figureSchema),
  remarks: z.array(z.string()),
});
const sectionSchema = z.object({ code: z.string(), title: z.string(), aims: z.array(z.string()).default([]) });
const chaptersSchema = z.array(z.object({ number: z.string().nullable(), title: z.string(), sections: z.array(sectionSchema).optional() }));
/** Svaralternativer fra hjemmemaskinen. Uten feltet i skjemaet ville zod fjerne dem i stillhet. */
const choicesWireSchema = z.object({ correct: z.string(), wrong: z.array(z.string()) });
const RESULT_SCHEMAS = {
  convert: z.object({ meta: metaSchema, body: z.string(), usage: usageSchema }),
  fix: z.object({ body: z.string(), usage: usageSchema }),
  extractToc: z.object({ chapters: chaptersSchema, usage: usageSchema }),
  mapSectionAims: z.object({ chapters: chaptersSchema, usage: usageSchema }),
  generateFlashcards: z.object({
    cards: z.array(
      z.object({
        note: z.string(),
        kind: z.string(),
        front: z.string(),
        back: z.array(z.string()),
        detail: z.string(),
        choices: choicesWireSchema.nullable().optional(),
      }),
    ),
    usage: usageSchema,
  }),
  generateChoices: z.object({
    cards: z.array(z.object({ card: z.string(), choices: choicesWireSchema.nullable() })),
    usage: usageSchema,
  }),
} satisfies Record<RemoteMethod, z.ZodType>;

/** Ingen hjemmemaskin kunne ta kallet, og det finnes en reserve (`RemoteWithFallback` sender det dit). */
export class RemoteUnavailableError extends ConversionError {
  constructor(message: string) {
    super(message, true);
  }
}

/** Kaller hjemmemaskinen via køen. Svarene kontrolleres før de brukes. */
export class RemoteAi implements AiService {
  readonly fake = false;
  readonly configured = true;
  readonly provider = 'remote';

  constructor(private readonly hub: RemoteHub) {}

  get model(): string {
    return this.hub.status().workers[0]?.models[0] ?? 'hjemmemaskin';
  }

  async convert(req: ConvertRequest): Promise<ConvertResult> {
    const { profile, pages, ...rest } = req;
    const result = await this.call('convert', { method: 'convert', req: { ...rest, profile: profile.id, pages: await encodePages(pages) } });
    // Samme kontroll som for svar fra Claude: figur-id-ene blir filnavn, så bare trygge tegn slipper gjennom.
    return { ...result, meta: parseMeta(JSON.stringify(result.meta)) };
  }

  fix(req: FixRequest): Promise<{ body: string; usage: Usage }> {
    return this.call('fix', { method: 'fix', req: { profile: req.profile.id, body: req.body, errorReport: req.errorReport } });
  }

  extractToc(
    profile: Profile,
    images: { data: Buffer; mediaType: 'image/jpeg' | 'image/png' }[],
    aims: CompetenceAim[] = [],
  ): Promise<{ chapters: ChapterInput[]; usage: Usage }> {
    const call: RemoteCall = { method: 'extractToc', profile: profile.id, images: images.map((i) => ({ data: i.data.toString('base64'), mediaType: i.mediaType })), aims };
    return this.call('extractToc', call, true);
  }

  mapSectionAims(profile: Profile, chapters: ChapterInput[], aims: CompetenceAim[]): Promise<{ chapters: ChapterInput[]; usage: Usage }> {
    return this.call('mapSectionAims', { method: 'mapSectionAims', profile: profile.id, chapters, aims }, true);
  }

  generateFlashcards(req: FlashcardRequest): Promise<{ cards: RawFlashcard[]; usage: Usage }> {
    return this.call('generateFlashcards', { method: 'generateFlashcards', req });
  }

  generateChoices(req: ChoicesRequest): Promise<{ cards: RawCardChoices[]; usage: Usage }> {
    return this.call('generateChoices', { method: 'generateChoices', req });
  }

  private async call<M extends RemoteMethod>(method: M, call: RemoteCall, interactive = false): Promise<z.infer<(typeof RESULT_SCHEMAS)[M]>> {
    const outcome = await this.hub.submit(call, { interactive, ref: currentUsageRef() });
    if (!outcome.ok) {
      const { message, retryable, code } = outcome.error;
      if (code === 'aborted') throw new AbortedError(message);
      if (code === 'unavailable') throw new RemoteUnavailableError(message);
      const err = new ConversionError(message, retryable);
      const usage = usageSchema.safeParse(outcome.error.usage);
      if (usage.success) err.usage = usage.data;
      throw err;
    }
    const parsed = RESULT_SCHEMAS[method].safeParse(outcome.result);
    if (!parsed.success) throw new ConversionError('Hjemmemaskinen svarte i et uventet format. Er den oppdatert?');
    return parsed.data as z.infer<(typeof RESULT_SCHEMAS)[M]>;
  }
}

/**
 * Hjemmemaskinen, med Claude som reserve: er ingen hjemmemaskin på nett når kallet starter, eller blir den borte
 * mens kallet venter, går det til `fallback`.
 */
export class RemoteWithFallback implements AiService {
  readonly fake = false;
  readonly configured = true;
  readonly provider = 'remote';

  constructor(
    private readonly remote: AiService,
    private readonly fallback: AiService,
    private readonly hub: RemoteHub,
  ) {}

  get model(): string {
    return this.remote.model;
  }

  private async run<T>(call: (ai: AiService) => Promise<T>): Promise<T> {
    if (!this.hub.online()) return call(this.fallback);
    try {
      return await call(this.remote);
    } catch (err) {
      if (err instanceof RemoteUnavailableError) return call(this.fallback);
      throw err;
    }
  }

  convert(req: ConvertRequest) {
    return this.run((ai) => ai.convert(req));
  }
  fix(req: FixRequest) {
    return this.run((ai) => ai.fix(req));
  }
  extractToc(profile: Profile, images: { data: Buffer; mediaType: 'image/jpeg' | 'image/png' }[], aims?: CompetenceAim[]) {
    return this.run((ai) => ai.extractToc(profile, images, aims));
  }
  mapSectionAims(profile: Profile, chapters: ChapterInput[], aims: CompetenceAim[]) {
    return this.run((ai) => ai.mapSectionAims(profile, chapters, aims));
  }
  generateFlashcards(req: FlashcardRequest) {
    return this.run((ai) => ai.generateFlashcards(req));
  }
  generateChoices(req: ChoicesRequest) {
    return this.run((ai) => ai.generateChoices(req));
  }
}
