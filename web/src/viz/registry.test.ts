import { describe, expect, it } from 'vitest';
import type { SubjectProfile } from '@smartnotes/shared';
import { getViz, hasVisualizations, vizChapterNumbers, vizEntries, vizForSection } from './registry';

const PROFILES: SubjectProfile[] = ['physics', 'chemistry', 'biology'];

describe('registeret for visualiseringer', () => {
  it.each(PROFILES)('%s: unike nøkler, gyldige id-er og delkapitler i riktig kapittel', (profile) => {
    const entries = vizEntries(profile);
    const keys = entries.map((e) => e.key);
    expect(new Set(keys).size).toBe(keys.length);
    for (const e of entries) {
      expect(e.profile).toBe(profile);
      expect(e.id).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
      expect(e.chapter).toMatch(/^\d+$/);
      expect(e.sections.length).toBeGreaterThan(0);
      // «2C» i ERGO Fysikk 1, «3.2» eller «3A» i de andre bøkene: koden starter med kapittelnummeret,
      // og minst ett av delkapitlene hører til kapittelet visualiseringen står under.
      for (const code of e.sections) expect(code).toMatch(/^\d+([A-Z]|\.\d+)$/);
      expect(e.sections.some((code) => code.replace(/([A-Z]|\.\d+)$/, '') === e.chapter)).toBe(true);
      expect(e.title).not.toMatch(/^[A-ZÆØÅ ]{4,}$/);
      expect(getViz(profile, e.key)).toBe(e);
    }
  });

  it('kapitlene kommer i stigende rekkefølge', () => {
    for (const profile of PROFILES) {
      const order = vizEntries(profile).map((e) => Number(e.chapter));
      expect(order).toEqual([...order].sort((a, b) => a - b));
      expect(vizChapterNumbers(profile)).toEqual([...new Set(order)].map(String));
    }
  });

  it('fysikk har visualiseringer, og oppslag går per fagtype', () => {
    expect(hasVisualizations({ profile: 'physics' })).toBe(true);
    expect(hasVisualizations(null)).toBe(false);
    expect(getViz('physics', 'k2-friksjon')?.title).toBe('Statisk friksjon og glidefriksjon');
    expect(getViz(undefined, 'k2-friksjon')).toBeUndefined();
    expect(vizForSection('physics', '2C').map((e) => e.key)).toContain('k2-friksjon');
    expect(vizForSection('chemistry', '2C')).toEqual([]);
    expect(vizForSection('physics', null)).toEqual([]);
  });
});
