import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { Repo } from '../src/db.js';
import { TEXTBOOKS } from '../src/textbooks.js';

describe('startoppsett', () => {
  it('lager Fysikk 1 med kapitlene fra ERGO Fysikk 1 ved første oppstart, og bare da', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'smartnotes-seed-'));
    const repo = new Repo(path.join(dir, 'db.sqlite'));
    repo.seed(TEXTBOOKS['ergo-fysikk-1']!);
    repo.seed(TEXTBOOKS['ergo-fysikk-1']!);
    const subjects = repo.listSubjects();
    expect(subjects).toHaveLength(1);
    expect(subjects[0]).toMatchObject({ name: 'Fysikk 1', textbook: 'ERGO Fysikk 1', profile: 'physics' });
    const chapters = repo.listChapters(subjects[0]!.id);
    expect(chapters.map((c) => `${c.number} ${c.title}`)).toEqual([
      '1 Rettlinjet bevegelse',
      '2 Krefter',
      '3 Mekanisk energi',
      '4 Kollisjoner og eksplosjoner',
      '5 Termisk energi',
      '6 Bølger og stråling',
      '7 Atomfysikk',
      '8 Kjernefysikk',
      '9 Astrofysikk',
      '10 Elektrisitet',
    ]);
    repo.close();
    fs.rmSync(dir, { recursive: true, force: true });
  });
});
