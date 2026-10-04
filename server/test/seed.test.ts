import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { Repo } from '../src/db.js';
import { TEXTBOOKS, type TextbookPreset } from '../src/textbooks.js';

const dirs: string[] = [];
function freshRepo(): Repo {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'smartnotes-seed-'));
  dirs.push(dir);
  return new Repo(path.join(dir, 'db.sqlite'));
}
afterEach(() => {
  for (const d of dirs.splice(0)) fs.rmSync(d, { recursive: true, force: true });
});

const ergo = TEXTBOOKS['ergo-fysikk-1']!;
const kjemi: TextbookPreset = {
  id: 'test-kjemi',
  subjectName: 'Kjemi 1',
  textbook: 'Test-kjemi',
  profile: 'chemistry',
  aims: [{ code: 'KM1', text: 'Et mål', cross: false }],
  chapters: [{ number: '1', title: 'Atomer', sections: [{ code: '1.1', title: 'Atomet', aims: ['KM1'] }] }],
};

describe('startoppsett', () => {
  it('lager Fysikk 1 med kapitlene fra ERGO Fysikk 1 ved første oppstart, og bare da', () => {
    const repo = freshRepo();
    expect(repo.seed([ergo])).toEqual(['Fysikk 1']);
    expect(repo.seed([ergo])).toEqual([]);
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
  });

  it('legger til nye fag i en database som allerede har fysikk, uten å lage fysikk på nytt', () => {
    const repo = freshRepo();
    // Fysikk lagt inn med den gamle ordningen (ingen merknad i meta om hvilke læreboksett som er lagt inn)
    repo.createSubject({ name: 'Fysikk 1', profile: 'physics', textbook: 'ERGO Fysikk 1' });
    expect(repo.seed([ergo, kjemi])).toEqual(['Kjemi 1']);
    const subjects = repo.listSubjects();
    expect(subjects.map((s) => `${s.name}:${s.profile}`)).toEqual(['Fysikk 1:physics', 'Kjemi 1:chemistry']);
    expect(repo.listChapters(subjects[1]!.id)[0]).toMatchObject({ number: '1', title: 'Atomer' });
    expect(subjects[1]!.aims).toEqual(kjemi.aims);
    // Nye fag får ny rev, så de synkes til enhetene
    expect(repo.sync(0).subjects).toHaveLength(2);
    repo.close();
  });

  it('et fag brukeren har slettet, kommer ikke tilbake', () => {
    const repo = freshRepo();
    repo.seed([ergo, kjemi]);
    const k = repo.listSubjects().find((s) => s.profile === 'chemistry')!;
    repo.deleteSubject(k.id);
    expect(repo.seed([ergo, kjemi])).toEqual([]);
    expect(repo.listSubjects().map((s) => s.name)).toEqual(['Fysikk 1']);
    repo.close();
  });

  it('uten læreboksett: et tomt fag «Fysikk» bare i en tom database', () => {
    const repo = freshRepo();
    expect(repo.seed([])).toEqual(['Fysikk']);
    expect(repo.seed([])).toEqual([]);
    expect(repo.listSubjects()).toHaveLength(1);
    repo.close();
  });
});

describe('læreboksettene', () => {
  it('standard er fysikk, kjemi og biologi, i den rekkefølgen', async () => {
    const { DEFAULT_SEED_TEXTBOOKS } = await import('../src/textbooks.js');
    expect(DEFAULT_SEED_TEXTBOOKS).toEqual(['ergo-fysikk-1', 'aschehoug-kjemi-1', 'gyldendal-bi-1']);
    const repo = freshRepo();
    expect(repo.seed(DEFAULT_SEED_TEXTBOOKS.map((id) => TEXTBOOKS[id]!))).toEqual(['Fysikk 1', 'Kjemi 1', 'Biologi 1']);
    expect(repo.listSubjects().map((s) => `${s.name}:${s.profile}:${s.aims.length}`)).toEqual([
      'Fysikk 1:physics:14',
      'Kjemi 1:chemistry:17',
      'Biologi 1:biology:11',
    ]);
    repo.close();
  });

  it.each(Object.values(TEXTBOOKS))('$id henger sammen: mål KM1…, unike kapitler og delkapitler, kjente mål', (preset) => {
    expect(preset.aims.map((a) => a.code)).toEqual(preset.aims.map((_, i) => `KM${i + 1}`));
    const codes = new Set(preset.aims.map((a) => a.code));
    const numbers = preset.chapters.map((c) => c.number);
    expect(new Set(numbers).size).toBe(numbers.length);
    const sections = preset.chapters.flatMap((c) => c.sections.map((s) => ({ ...s, chapter: c.number })));
    expect(new Set(sections.map((s) => s.code)).size).toBe(sections.length);
    for (const s of sections) {
      // «2C» eller «2.3»: koden starter med kapittelnummeret
      expect(s.code).toMatch(new RegExp(`^${s.chapter}(?:[A-Z]|\\.\\d+)$`));
      expect(s.aims.length).toBeGreaterThan(0);
      for (const a of s.aims) expect(codes.has(a)).toBe(true);
    }
  });
});
