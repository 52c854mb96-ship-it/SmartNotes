import { describe, expect, it } from 'vitest';
import { ConversionError } from '../src/errors.js';
import type { ConvertRequest } from '../src/pipeline/ai.js';
import { FakeClaude } from '../src/pipeline/claude.js';
import { MeteredAi, costUsd, summarizeUsage, usageScope, withUsage, zeroUsage, type Usage, type UsageEntry } from '../src/usage.js';

const sonnet = (u: Partial<Usage> = {}): Usage => ({ ...zeroUsage('convert', 'claude-sonnet-5-5'), ...u });

function entry(e: Partial<UsageEntry>): UsageEntry {
  return {
    ...zeroUsage('convert', 'claude-sonnet-5-5'),
    at: Date.UTC(2026, 9, 11, 12),
    provider: 'anthropic',
    durationMs: 1000,
    ok: true,
    error: null,
    noteId: null,
    deckId: null,
    subjectId: null,
    ...e,
  };
}

/** En AI-tjeneste der konverteringen gjør det testen ber om. */
class ScriptedAi extends FakeClaude {
  override readonly provider = 'anthropic';
  constructor(private readonly onConvert: () => Promise<never>) {
    super(0);
  }
  override convert(): Promise<never> {
    return this.onConvert();
  }
}

describe('MeteredAi', () => {
  it('logger vellykkede kall med notatet fra usageScope', async () => {
    const log: UsageEntry[] = [];
    const ai = new MeteredAi(new FakeClaude(0), (e) => log.push(e));
    const req = { profile: { id: 'physics' }, pages: [{ path: '', width: 100, height: 100 }], chapters: [], fixedChapter: null } as unknown as ConvertRequest;
    await usageScope({ noteId: 'n1', subjectId: 's1' }, () => ai.convert(req));
    await ai.fix({ profile: { id: 'physics' } as never, body: 'x', errorReport: '' });
    expect(log).toHaveLength(2);
    expect(log[0]).toMatchObject({ kind: 'convert', provider: 'fake', model: 'fake-claude', ok: true, noteId: 'n1', subjectId: 's1', deckId: null });
    // Utenfor usageScope er det ingen kobling til notat eller fag.
    expect(log[1]).toMatchObject({ kind: 'fix', ok: true, noteId: null, subjectId: null });
    expect(log[0]!.durationMs).toBeGreaterThanOrEqual(0);
  });

  it('logger feil med forbruket når modellen svarte, og uten tokens ellers', async () => {
    const log: UsageEntry[] = [];
    const answered = new ScriptedAi(async () =>
      withUsage(sonnet({ inputTokens: 900, outputTokens: 64_000 }), () => {
        throw new ConversionError('Notatet ble for langt.');
      }),
    );
    const ai = new MeteredAi(answered, (e) => log.push(e));
    await expect(ai.convert({} as ConvertRequest)).rejects.toThrow('Notatet ble for langt.');
    expect(log[0]).toMatchObject({ kind: 'convert', ok: false, inputTokens: 900, outputTokens: 64_000, error: 'Notatet ble for langt.' });

    const network = new MeteredAi(
      new ScriptedAi(async () => {
        throw new ConversionError('Fikk ikke kontakt med Claude.', true);
      }),
      (e) => log.push(e),
    );
    await expect(network.convert({} as ConvertRequest)).rejects.toThrow('Fikk ikke kontakt');
    expect(log[1]).toMatchObject({ kind: 'convert', ok: false, inputTokens: 0, outputTokens: 0, model: 'fake-claude' });
  });

  it('logger innholdsfortegnelse, kompetansemål og kortstokker med riktig type', async () => {
    const log: UsageEntry[] = [];
    const ai = new MeteredAi(new FakeClaude(0), (e) => log.push(e));
    const physics = { id: 'physics', label: 'Fysikk' } as never;
    const aims = [{ code: 'KM1', text: 'Mål', cross: false }];
    const toc = await usageScope({ subjectId: 's1' }, () => ai.extractToc(physics, [], aims));
    expect(toc.chapters.length).toBeGreaterThan(0);
    const mapped = await ai.mapSectionAims(physics, [{ number: '1', title: 'A', sections: [{ code: '1A', title: 'B', aims: [] }] }], aims);
    expect(mapped.chapters[0]!.sections![0]!.aims).toEqual(['KM1']);
    await usageScope({ deckId: 'd1' }, () =>
      ai.generateFlashcards({ subjectName: 'Fysikk 1', subjectLabel: 'Fysikk', difficulty: 'medium', count: null, notes: [] } as never),
    );
    expect(log.map((e) => [e.kind, e.subjectId, e.deckId])).toEqual([
      ['toc', 's1', null],
      ['aims', null, null],
      ['flashcards', null, 'd1'],
    ]);
  });

  it('en feil i loggingen stopper ikke arbeidet', async () => {
    const errors: unknown[] = [];
    const ai = new MeteredAi(
      new FakeClaude(0),
      () => {
        throw new Error('disken er full');
      },
      (err) => errors.push(err),
    );
    const res = await ai.fix({ profile: { id: 'physics' } as never, body: 'x', errorReport: '' });
    expect(res.body).toBe('x');
    expect(errors).toHaveLength(1);
  });
});

describe('pris', () => {
  it('regner listepris for Sonnet 5.5 med hurtigbuffer', () => {
    // 10 000 inn × $2 + 2 000 ut × $10 + 50 000 lest × $0,10 + 5 000 skrevet × $2,50 (per million)
    const usd = costUsd('anthropic', sonnet({ inputTokens: 10_000, outputTokens: 2_000, cacheReadTokens: 50_000, cacheWriteTokens: 5_000 }));
    expect(usd).toBeCloseTo((20_000 + 20_000 + 5_000 + 12_500) / 1_000_000, 10);
  });

  it('Haiku 5.5 har høyere pris over 100 000 tokens inn', () => {
    const short = costUsd('anthropic', { ...zeroUsage('convert', 'claude-haiku-5-5'), inputTokens: 100_000, outputTokens: 1_000 });
    const long = costUsd('anthropic', { ...zeroUsage('convert', 'claude-haiku-5-5'), inputTokens: 100_001, outputTokens: 1_000 });
    expect(short).toBeCloseTo((100_000 * 0.1 + 1_000 * 0.5) / 1_000_000, 10);
    expect(long).toBeCloseTo((100_001 * 0.5 + 1_000 * 2.5) / 1_000_000, 10);
  });

  it('lokale og falske modeller er gratis, ukjente modeller har ukjent pris', () => {
    expect(costUsd('fake', sonnet({ inputTokens: 1_000_000 }))).toBe(0);
    expect(costUsd('ollama', { ...zeroUsage('convert', 'qwen2.5vl:7b'), inputTokens: 5_000 })).toBe(0);
    expect(costUsd('anthropic', { ...zeroUsage('convert', 'claude-ukjent'), inputTokens: 5_000 })).toBeNull();
  });
});

describe('summarizeUsage', () => {
  it('grupperer per type, dag (norsk tid) og modell, og regner om til kroner', () => {
    const entries = [
      // 1 million tokens ut med Sonnet = $10
      entry({ kind: 'convert', outputTokens: 1_000_000, at: Date.UTC(2026, 9, 11, 12) }),
      // 23:30 UTC 11. oktober er 01:30 natt til 12. oktober i Norge (sommertid).
      entry({ kind: 'fix', outputTokens: 100_000, ok: false, at: Date.UTC(2026, 9, 11, 23, 30) }),
      entry({ kind: 'flashcards', provider: 'fake', model: 'fake-claude', outputTokens: 500 }),
      entry({ kind: 'toc', model: 'claude-ukjent', inputTokens: 10 }),
    ];
    const s = summarizeUsage(entries, { days: 30, since: Date.UTC(2026, 8, 11), usdNok: 10 });
    expect(s.total).toMatchObject({ calls: 4, failed: 1, costNok: 110, unpricedCalls: 1 });
    expect(s.byKind.map((k) => k.kind)).toEqual(['convert', 'fix', 'flashcards', 'toc']);
    expect(s.byKind[0]).toMatchObject({ kind: 'convert', calls: 1, costNok: 100 });
    expect(s.byDay.map((d) => [d.day, d.calls])).toEqual([
      ['2026-10-11', 3],
      ['2026-10-12', 1],
    ]);
    expect(s.byModel.find((m) => m.model === 'fake-claude')).toMatchObject({ provider: 'fake', calls: 1, costNok: 0 });
    expect(s.usdNok).toBe(10);
  });
});
