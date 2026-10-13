import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import type { Subject } from '@smartnotes/shared';
import type { Repo } from '../src/db.js';
import { buildContext } from '../src/pipeline/ai.js';
import { Converter } from '../src/pipeline/converter.js';
import { SUBJECT_PRESETS, userTextbook } from '../src/presets.js';

const ROOT = path.resolve(import.meta.dirname, '..', '..');

describe('læreboka i faget', () => {
  it('regnes bare med når brukeren har skrevet den selv', () => {
    expect(userTextbook({ textbook: 'Min egen bok' })).toBe('Min egen bok');
    expect(userTextbook({ textbook: '  Min egen bok ' })).toBe('Min egen bok');
    expect(userTextbook({ textbook: null })).toBeNull();
    expect(userTextbook({ textbook: '   ' })).toBeNull();
    // Lærebøkene en tidligere versjon av SmartNotes la inn selv, uansett store og små bokstaver.
    for (const preset of Object.values(SUBJECT_PRESETS)) {
      for (const t of preset.legacyTextbooks ?? []) {
        expect(userTextbook({ textbook: t })).toBeNull();
        expect(userTextbook({ textbook: ` ${t.toUpperCase()} ` })).toBeNull();
      }
    }
  });

  it('sendes til AI-en bare når brukeren har skrevet den selv', () => {
    const repo = { listChapters: () => [], getChapter: () => null } as unknown as Repo;
    const converter = new Converter(repo, {} as never, {} as never, {} as never, {} as never);
    const request = (textbook: string | null) => {
      const subject = { id: 's1', name: 'Fysikk 1', profile: 'physics', textbook } as Subject;
      const row = { chapter_auto: 1, title_auto: 1, date_auto: 1, chapter_id: null, title: null, note_date: null, instructions: null };
      return converter.buildConvertRequest(row as never, subject, [], '/tmp').req;
    };
    expect(request('ERGO Fysikk 1').textbook).toBeNull();
    expect(buildContext(request('ERGO Fysikk 1'))).not.toMatch(/ERGO/i);
    expect(request('Min egen bok').textbook).toBe('Min egen bok');
    expect(buildContext(request('Min egen bok'))).toContain('Lærebok/emne: Min egen bok');
  });
});

describe('kompetansemålene', () => {
  // Hentet fra Udirs Grep (data.udir.no) 13. oktober 2026; se _kilde i fila.
  const udir = JSON.parse(fs.readFileSync(path.join(import.meta.dirname, 'fixtures', 'udir-kompetansemaal.json'), 'utf8')) as {
    sett: Record<string, { laereplan: string; kompetansemaal: { kode: string; tekst: string }[] }>;
  };

  it.each(Object.values(SUBJECT_PRESETS).map((p) => [p.id, p] as const))('%s har målene ordrett fra Udir, i Udirs rekkefølge', (_id, preset) => {
    const set = udir.sett[preset.udir.aimSet];
    expect(set, `mangler ${preset.udir.aimSet} i fixtures/udir-kompetansemaal.json`).toBeDefined();
    expect(set!.laereplan).toBe(preset.udir.plan);
    expect(preset.aims.map((a) => a.text)).toEqual(set!.kompetansemaal.map((k) => k.tekst));
  });
});

describe('forlagsnavn', () => {
  /** Forlag og lærebokserier som har vært i koden før navneoppryddingen (#15), og noen flere norske skoleforlag. */
  const PUBLISHERS = /\b(aschehoug|gyldendal|cappelen|damm|ergo|fagbokforlaget|samlaget|vigmostad|universitetsforlaget|bi 1)\b/i;

  function* files(dir: string): Generator<string> {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) yield* files(full);
      else if (/\.(ts|tsx|tex|css|html|json)$/.test(entry.name) && !/\.test\.ts$/.test(entry.name)) yield full;
    }
  }

  it('står bare i de gamle id-ene og lærebøkene som kjennes igjen', () => {
    const hits: string[] = [];
    for (const dir of ['server/src', 'server/latex', 'shared/src', 'web/src', 'web/index.html']) {
      const full = path.join(ROOT, dir);
      for (const file of fs.statSync(full).isDirectory() ? files(full) : [full]) {
        fs.readFileSync(file, 'utf8')
          .split('\n')
          .forEach((line, i) => {
            if (PUBLISHERS.test(line) && !/^\s*(aliases|legacyTextbooks): \[/.test(line)) hits.push(`${path.relative(ROOT, file)}:${i + 1}: ${line.trim()}`);
          });
      }
    }
    expect(hits).toEqual([]);
  });
});
