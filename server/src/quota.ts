import type { QuotaUsage } from '@smartnotes/shared';
import type { Config } from './config.js';
import type { QuotaKind, Repo } from './db.js';
import { costUsd } from './usage.js';

/**
 * Gratiskvotene: sider per døgn (telt når konverteringen starter, også «Konverter på nytt»), kortstokker og
 * innholdsfortegnelser med AI per døgn, et tak på notater i kø, og et felles dagsbudsjett for alt gratisbrukerne bruker
 * av AI. Døgnet er norsk (Europe/Oslo). Eieren har ingen tak.
 *
 * Tenk på det som et klippekort som fylles på hver natt: hver side klipper ett hull, og når kortet er fullt, venter
 * notatet til i morgen i stedet for å bli avvist.
 */

const OSLO = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Europe/Oslo',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

function osloParts(ms: number): { y: number; m: number; d: number; hh: number; mm: number } {
  const p = Object.fromEntries(OSLO.formatToParts(new Date(ms)).map((x) => [x.type, x.value]));
  return { y: Number(p.year), m: Number(p.month), d: Number(p.day), hh: Number(p.hour), mm: Number(p.minute) };
}

/** Midnatt norsk tid for datoen (y, m, d) som epoch ms. Sommertiden skifter klokka 02/03, aldri ved midnatt. */
function osloMidnight(y: number, m: number, d: number): number {
  const utc = Date.UTC(y, m - 1, d);
  const p = osloParts(utc);
  // Hvor mye norsk tid ligger foran UTC ved denne midnatten (1 eller 2 timer).
  const offset = Date.UTC(p.y, p.m - 1, p.d, p.hh, p.mm) - utc;
  return utc - offset;
}

/** Døgnet `now` ligger i, norsk tid: datoen, når det startet og når neste starter. */
export function osloDay(now: number): { day: string; start: number; next: number } {
  const { y, m, d } = osloParts(now);
  const start = osloMidnight(y, m, d);
  const tomorrow = new Date(Date.UTC(y, m - 1, d + 1));
  const next = osloMidnight(tomorrow.getUTCFullYear(), tomorrow.getUTCMonth() + 1, tomorrow.getUTCDate());
  return { day: `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`, start, next };
}

export const QUOTA_MESSAGES = {
  pages: (limit: number) => `Dagens kvote er brukt – konverteres i morgen. Gratiskontoer kan konvertere ${limit} sider per døgn.`,
  budget: 'Dagens kvote er brukt – konverteres i morgen. Serveren har brukt opp det den kan bruke på gratiskontoer i dag.',
  decks: (limit: number) => `Du har laget ${limit} kortstokker i dag, som er grensen for gratiskontoer. Prøv igjen i morgen.`,
  decksBudget: 'Serveren har brukt opp det den kan bruke på gratiskontoer i dag. Prøv å lage kortstokken i morgen.',
  toc: (limit: number) => `Du har latt AI-en lese ${limit} innholdsfortegnelser i dag, som er grensen for gratiskontoer. Prøv igjen i morgen.`,
  tocBudget: 'Serveren har brukt opp det den kan bruke på gratiskontoer i dag. Prøv igjen i morgen.',
  queue: (limit: number) => `Du har ${limit} notater i kø, som er grensen for gratiskontoer. Vent til noen er konvertert, og last opp på nytt.`,
};

export class Quota {
  constructor(
    private readonly repo: Repo,
    private readonly config: Config,
    private readonly now: () => number = Date.now,
  ) {}

  /** Bare gratiskontoer har tak (eieren og senere pro har det ikke). */
  limited(userId: number): boolean {
    return this.repo.getUser(userId)?.plan === 'free';
  }

  private get limits() {
    return this.config.quota;
  }

  /** Om gratiskontoene samlet har brukt dagsbudsjettet (kostnad til listepris, som i «Forbruk av AI»). */
  budgetUsed(): boolean {
    if (this.limits.dailyBudgetNok <= 0) return false;
    const { start } = osloDay(this.now());
    const usd = this.repo.freeUsageSince(start).reduce((sum, e) => sum + (costUsd(e.provider, e) ?? 0), 0);
    return usd * this.config.usdNok >= this.limits.dailyBudgetNok;
  }

  /**
   * Rett før AI-en leser et notat: er det plass i dagens kvote, telles sidene og konverteringen kan starte (null).
   * Ellers venter notatet til neste døgn. Det første notatet i et døgn får alltid starte, også om det har flere sider
   * enn taket, så et langt notat ikke venter for alltid.
   */
  startConversion(userId: number, noteId: string, pages: number): { until: Date; message: string } | null {
    if (!this.limited(userId)) return null;
    const { start, next } = osloDay(this.now());
    if (this.budgetUsed()) return { until: new Date(next), message: QUOTA_MESSAGES.budget };
    const used = this.repo.quotaUsed(userId, 'pages', start);
    if (used > 0 && used + pages > this.limits.pagesPerDay) return { until: new Date(next), message: QUOTA_MESSAGES.pages(this.limits.pagesPerDay) };
    this.repo.addQuota(userId, 'pages', pages, noteId, this.now());
    return null;
  }

  /** Før en kortstokk lages: null når den kan lages (og den telles), ellers meldingen brukeren får. */
  takeDeck(userId: number, deckRef: string | null): string | null {
    return this.take(userId, 'decks', this.limits.decksPerDay, deckRef, QUOTA_MESSAGES.decks, QUOTA_MESSAGES.decksBudget);
  }

  /** Før AI-en leser en innholdsfortegnelse eller kobler delkapitler til kompetansemål. */
  takeToc(userId: number, ref: string | null): string | null {
    return this.take(userId, 'toc', this.limits.tocPerDay, ref, QUOTA_MESSAGES.toc, QUOTA_MESSAGES.tocBudget);
  }

  private take(
    userId: number,
    kind: QuotaKind,
    limit: number,
    ref: string | null,
    message: (limit: number) => string,
    budgetMessage: string,
  ): string | null {
    if (!this.limited(userId)) return null;
    if (this.budgetUsed()) return budgetMessage;
    const { start } = osloDay(this.now());
    if (this.repo.quotaUsed(userId, kind, start) >= limit) return message(limit);
    this.repo.addQuota(userId, kind, 1, ref, this.now());
    return null;
  }

  /** Gir tilbake det `take*` telte, når arbeidet ikke ble noe av (for eksempel fordi AI-en ikke svarte). */
  refund(userId: number, kind: QuotaKind, ref: string | null): void {
    if (this.limited(userId)) this.repo.addQuota(userId, kind, -1, ref, this.now());
  }

  /** En ny opplasting: null når det er plass i køen, ellers meldingen. */
  queueFull(userId: number): string | null {
    if (!this.limited(userId)) return null;
    return this.repo.queuedNoteCount(userId) >= this.limits.queueMax ? QUOTA_MESSAGES.queue(this.limits.queueMax) : null;
  }

  /** Det brukeren har brukt i dag (for Innstillinger), eller null uten tak. */
  usage(userId: number): QuotaUsage | null {
    if (!this.limited(userId)) return null;
    const { start, next } = osloDay(this.now());
    const used = (kind: QuotaKind) => Math.max(0, this.repo.quotaUsed(userId, kind, start));
    return {
      pages: { used: used('pages'), limit: this.limits.pagesPerDay },
      decks: { used: used('decks'), limit: this.limits.decksPerDay },
      toc: { used: used('toc'), limit: this.limits.tocPerDay },
      queueMax: this.limits.queueMax,
      resetsAt: new Date(next).toISOString(),
    };
  }
}
