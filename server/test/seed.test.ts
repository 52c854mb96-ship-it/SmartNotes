import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { Repo } from '../src/db.js';
import { SUBJECT_PRESETS, findPreset, type SubjectPreset } from '../src/presets.js';

const dirs: string[] = [];
function freshRepo(): Repo {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'smartnotes-seed-'));
  dirs.push(dir);
  return new Repo(path.join(dir, 'db.sqlite'));
}
afterEach(() => {
  for (const d of dirs.splice(0)) fs.rmSync(d, { recursive: true, force: true });
});

const fysikk = SUBJECT_PRESETS['fysikk-1-lk20']!;
const kjemi: SubjectPreset = {
  id: 'test-kjemi',
  aliases: ['gammel-kjemi'],
  subjectName: 'Kjemi 1',
  profile: 'chemistry',
  udir: { plan: 'KJE01-02', aimSet: 'KV532' },
  aims: [{ code: 'KM1', text: 'Et mål', cross: false }],
  chapters: [{ number: '1', title: 'Atomer', sections: [{ code: '1.1', title: 'Atomet', aims: ['KM1'] }] }],
};

describe('startoppsett', () => {
  it('lager Fysikk 1 med temaene etter læreplanen ved første oppstart, og bare da', () => {
    const repo = freshRepo();
    expect(repo.seed([fysikk])).toEqual(['Fysikk 1']);
    expect(repo.seed([fysikk])).toEqual([]);
    const subjects = repo.listSubjects(1);
    expect(subjects).toHaveLength(1);
    // Ingen lærebok: eleven kan legge inn sin egen i faginnstillingene.
    expect(subjects[0]).toMatchObject({ name: 'Fysikk 1', textbook: null, profile: 'physics' });
    const chapters = repo.listChapters(subjects[0]!.id);
    expect(chapters.map((c) => `${c.number} ${c.title}`)).toEqual([
      '1 Rettlinjet bevegelse',
      '2 Krefter og Newtons lover',
      '3 Arbeid og energi',
      '4 Bevegelsesmengde og støt',
      '5 Varme og termodynamikk',
      '6 Bølger og stråling',
      '7 Atomfysikk',
      '8 Kjernefysikk',
      '9 Astrofysikk',
      '10 Elektriske kretser',
    ]);
    repo.close();
  });

  it('en database som har oppsettet under en tidligere id, får det ikke på nytt', () => {
    const repo = freshRepo();
    repo.seed([{ ...fysikk, id: 'ergo-fysikk-1', aliases: [] }]);
    const before = repo.listSubjects(1).map((s) => s.id);
    expect(repo.seed([fysikk])).toEqual([]);
    expect(repo.listSubjects(1).map((s) => s.id)).toEqual(before);
    // Gamle id-er i SEED_TEXTBOOKS finner fram til de nye oppsettene.
    expect(findPreset('ergo-fysikk-1')?.id).toBe('fysikk-1-lk20');
    expect(findPreset('aschehoug-kjemi-1')?.id).toBe('kjemi-1-lk20');
    expect(findPreset('gyldendal-bi-1')?.id).toBe('biologi-1-lk20');
    expect(findPreset('ukjent')).toBeUndefined();
    repo.close();
  });

  it('legger til nye fag i en database som allerede har fysikk, uten å lage fysikk på nytt', () => {
    const repo = freshRepo();
    // Fysikk lagt inn med den gamle ordningen (ingen merknad i meta om hvilke oppsett som er lagt inn)
    repo.createSubject({ userId: 1, name: 'Fysikk 1', profile: 'physics', textbook: 'En lærebok' });
    expect(repo.seed([fysikk, kjemi])).toEqual(['Kjemi 1']);
    const subjects = repo.listSubjects(1);
    expect(subjects.map((s) => `${s.name}:${s.profile}`)).toEqual(['Fysikk 1:physics', 'Kjemi 1:chemistry']);
    expect(repo.listChapters(subjects[1]!.id)[0]).toMatchObject({ number: '1', title: 'Atomer' });
    expect(subjects[1]!.aims).toEqual(kjemi.aims);
    // Nye fag får ny rev, så de synkes til enhetene
    expect(repo.sync(1, 0).subjects).toHaveLength(2);
    repo.close();
  });

  it('et fag brukeren har slettet, kommer ikke tilbake', () => {
    const repo = freshRepo();
    repo.seed([fysikk, kjemi]);
    const k = repo.listSubjects(1).find((s) => s.profile === 'chemistry')!;
    repo.deleteSubject(k.id);
    expect(repo.seed([fysikk, kjemi])).toEqual([]);
    expect(repo.listSubjects(1).map((s) => s.name)).toEqual(['Fysikk 1']);
    repo.close();
  });

  it('Geofag 1 legges ikke inn av seg selv, verken i en ny database eller hos dem som har en fra før', async () => {
    const { loadConfig } = await import('../src/config.js');
    const defaults = loadConfig({ NODE_ENV: 'test', APP_PASSWORD: 'x' }).seedTextbooks;
    expect(defaults).not.toContain('geofag-1-lk20');
    const presets = () => defaults.map((id) => findPreset(id)!);
    // En database som er lagt inn med de tre fagene fra før (som elevens), og en helt ny.
    const existing = freshRepo();
    existing.seed([fysikk, SUBJECT_PRESETS['kjemi-1-lk20']!, SUBJECT_PRESETS['biologi-1-lk20']!]);
    expect(existing.seed(presets())).toEqual([]);
    const fresh = freshRepo();
    fresh.seed(presets());
    for (const repo of [existing, fresh]) {
      expect(repo.listSubjects(1).map((s) => s.profile)).not.toContain('geoscience');
      repo.close();
    }
  });

  it('README oppgir standarden for SEED_TEXTBOOKS slik den er i koden', async () => {
    const { DEFAULT_SEED_PRESETS } = await import('../src/presets.js');
    const readme = fs.readFileSync(path.join(import.meta.dirname, '..', '..', 'README.md'), 'utf8');
    const row = readme.split('\n').find((l) => l.startsWith('| `SEED_TEXTBOOKS` |'));
    expect(row?.split('|')[2]?.trim()).toBe(`\`${DEFAULT_SEED_PRESETS.join(',')}\``);
    expect(Object.keys(SUBJECT_PRESETS).filter((id) => !DEFAULT_SEED_PRESETS.includes(id))).toEqual(['geofag-1-lk20']);
  });

  it('«Legg til fag» legger inn et oppsett med temaer og mål, én gang', () => {
    const repo = freshRepo();
    repo.seed([fysikk]);
    const geofag = SUBJECT_PRESETS['geofag-1-lk20']!;
    const subject = repo.addPreset(1, geofag);
    expect(subject).toMatchObject({ name: 'Geofag 1', profile: 'geoscience', textbook: null });
    expect(subject!.aims).toEqual(geofag.aims);
    const chapters = repo.listChapters(subject!.id);
    expect(chapters).toHaveLength(9);
    expect(chapters[1]).toMatchObject({ number: '2', title: 'Jordas indre og platetektonikk' });
    expect(chapters[1]!.sections.map((x) => x.code)).toEqual(['2.1', '2.2', '2.3']);
    // Ikke to ganger, og startoppsettet legger det ikke inn på nytt, selv om det står i SEED_TEXTBOOKS.
    expect(repo.addPreset(1, geofag)).toBeNull();
    expect(repo.seed([fysikk, geofag])).toEqual([]);
    // Et slettet fag kan legges til igjen av brukeren selv, men kommer ikke tilbake av seg selv.
    repo.deleteSubject(subject!.id);
    expect(repo.seed([fysikk, geofag])).toEqual([]);
    expect(repo.addPreset(1, geofag)).toMatchObject({ name: 'Geofag 1' });
    expect(repo.listSubjects(1).map((s) => s.name)).toEqual(['Fysikk 1', 'Geofag 1']);
    repo.close();
  });

  it('uten oppsett: et tomt fag «Fysikk» bare i en tom database', () => {
    const repo = freshRepo();
    expect(repo.seed([])).toEqual(['Fysikk']);
    expect(repo.seed([])).toEqual([]);
    expect(repo.listSubjects(1)).toHaveLength(1);
    repo.close();
  });
});

describe('fagoppsettene', () => {
  // Et notat om virkningsgraden til en kran havnet i 5.3, fordi ordet bare sto der. Det står nå også i 3.3.
  it('Fysikk 1 har virkningsgrad også i 3.3, ikke bare i termodynamikken', () => {
    const k3 = fysikk.chapters.find((c) => c.number === '3')!;
    expect(k3.sections.find((s) => s.code === '3.3')?.title).toMatch(/virkningsgrad/);
  });

  it('standard er fysikk, kjemi og biologi, i den rekkefølgen', async () => {
    const { DEFAULT_SEED_PRESETS } = await import('../src/presets.js');
    expect(DEFAULT_SEED_PRESETS).toEqual(['fysikk-1-lk20', 'kjemi-1-lk20', 'biologi-1-lk20']);
    const repo = freshRepo();
    expect(repo.seed(DEFAULT_SEED_PRESETS.map((id) => SUBJECT_PRESETS[id]!))).toEqual(['Fysikk 1', 'Kjemi 1', 'Biologi 1']);
    expect(repo.listSubjects(1).map((s) => `${s.name}:${s.profile}:${s.aims.length}`)).toEqual([
      'Fysikk 1:physics:14',
      'Kjemi 1:chemistry:17',
      'Biologi 1:biology:11',
    ]);
    repo.close();
  });

  it.each(Object.values(SUBJECT_PRESETS))('$id henger sammen: mål KM1…, unike kapitler og delkapitler, kjente mål', (preset) => {
    expect(preset.aims.map((a) => a.code)).toEqual(preset.aims.map((_, i) => `KM${i + 1}`));
    const codes = new Set(preset.aims.map((a) => a.code));
    const numbers = preset.chapters.map((c) => c.number);
    expect(new Set(numbers).size).toBe(numbers.length);
    const sections = preset.chapters.flatMap((c) => c.sections.map((s) => ({ ...s, chapter: c.number })));
    expect(new Set(sections.map((s) => s.code)).size).toBe(sections.length);
    for (const s of sections) {
      // «2.3»: koden starter med temanummeret
      expect(s.code).toMatch(new RegExp(`^${s.chapter}\\.\\d+$`));
      expect(s.aims.length).toBeGreaterThan(0);
      for (const a of s.aims) expect(codes.has(a)).toBe(true);
    }
  });

  it('ingen forlag eller lærebøker i oppsettene (utenom de gamle id-ene og lærebøkene som kjennes igjen)', () => {
    const text = JSON.stringify(Object.values(SUBJECT_PRESETS).map(({ aliases: _a, legacyTextbooks: _l, ...rest }) => rest));
    expect(text).not.toMatch(/ERGO|Aschehoug|Gyldendal|Cappelen|Bi 1\b/);
  });
});
