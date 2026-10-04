import type { FastifyBaseLogger } from 'fastify';
import type { Repo } from '../db.js';
import type { Converter } from './converter.js';

/**
 * Bakgrunnskø: henter notater med status «queued» og konverterer dem, ett og ett (eller flere i
 * parallell). Køen ligger i databasen, så den overlever omstart av serveren.
 */
export class Worker {
  private running = 0;
  private timer: NodeJS.Timeout | null = null;
  private stopped = false;
  private readonly active = new Set<Promise<void>>();

  constructor(
    private readonly repo: Repo,
    private readonly converter: Converter,
    private readonly concurrency: number,
    private readonly log: FastifyBaseLogger,
  ) {}

  start(): void {
    const reset = this.repo.resetInterrupted();
    if (reset > 0) this.log.info({ count: reset }, 'avbrutte konverteringer lagt tilbake i køen');
    this.stopped = false;
    // Plukker også opp notater med utsatt nytt forsøk (not_before).
    this.timer = setInterval(() => this.kick(), 5_000);
    this.timer.unref();
    this.kick();
  }

  /** Kalles når et nytt notat er lagt i køen. */
  kick(): void {
    while (!this.stopped && this.running < this.concurrency) {
      const row = this.repo.claimNextQueued();
      if (!row) return;
      this.running++;
      const p = this.converter
        .convertNote(row)
        .catch((err) => this.log.error({ err, noteId: row.id }, 'konvertering krasjet'))
        .finally(() => {
          this.running--;
          this.active.delete(p);
          this.kick();
        });
      this.active.add(p);
    }
  }

  /** Venter på pågående arbeid (brukes i tester og ved nedstenging). */
  async idle(): Promise<void> {
    while (this.active.size > 0) await Promise.all([...this.active]);
  }

  async stop(): Promise<void> {
    this.stopped = true;
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }
}
