import { describe, expect, it } from 'vitest';
import type { SubjectProfile } from '@smartnotes/shared';
import { getViz, hasVisualizations, vizChapterNumbers, vizEntries, vizForSection } from './registry';

const PROFILES: SubjectProfile[] = ['physics', 'chemistry', 'biology', 'geoscience'];

/** Deltemaene i Geofag 1 i SmartNotes' eget oppsett (server/src/presets.ts, 'geofag-1-lk20'). */
const GEOFAG_SECTIONS: Record<string, string> = {
  '1.1': 'Geosfæren, hydrosfæren, atmosfæren og biosfæren',
  '1.2': 'Vekselvirkninger mellom jordsystemene',
  '2.1': 'Jordas oppbygning',
  '2.2': 'Plategrenser og platebevegelser',
  '2.3': 'Jordskjelv, vulkaner og fjellkjeder',
  '3.1': 'Mineraler og mineralgrupper',
  '3.2': 'Magmatiske, sedimentære og metamorfe bergarter',
  '3.3': 'Bergartssyklusen',
  '4.1': 'Relativ alder og lagfølger',
  '4.2': 'Radiometrisk datering',
  '4.3': 'Den geologiske historien til et område',
  '5.1': 'Forvitring, erosjon og avsetning',
  '5.2': 'Isbreer og istider',
  '5.3': 'Løsmasser og jordarter',
  '5.4': 'Mennesket og landskapet',
  '6.1': 'Det hydrologiske kretsløpet',
  '6.2': 'Grunnvann, elver og innsjøer',
  '6.3': 'Ferskvann som ressurs',
  '7.1': 'Malm, mineraler og byggeråstoff',
  '7.2': 'Energi fra undergrunnen',
  '7.3': 'Utvinning og bærekraft',
  '8.1': 'Skred',
  '8.2': 'Flom',
  '8.3': 'Risiko, forebygging og tilpasning',
  '9.1': 'Planlegging og innsamling av data',
  '9.2': 'Bearbeiding, tolking og presentasjon',
};

describe('registeret for visualiseringer', () => {
  it.each(PROFILES)('%s: unike nøkler, gyldige id-er og delkapitler i riktig kapittel', (profile) => {
    const entries = vizEntries(profile);
    const keys = entries.map((e) => e.key);
    expect(new Set(keys).size).toBe(keys.length);
    for (const e of entries) {
      expect(e.profile).toBe(profile);
      expect(e.id).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
      expect(e.chapter).toMatch(/^\d+$/);
      // Fysikk og geofag er koblet til deltemaene i SmartNotes' eget oppsett (server/src/presets.ts). Kjemi og biologi
      // har ingen deltemaer der, og da vises visualiseringen etter temaet.
      if (profile === 'physics' || profile === 'geoscience') expect(e.sections.length).toBeGreaterThan(0);
      // «2.3»: koden starter med temanummeret, og minst ett av deltemaene hører til temaet visualiseringen står under.
      for (const code of e.sections) expect(code).toMatch(/^\d+\.\d+$/);
      if (e.sections.length) expect(e.sections.some((code) => code.replace(/\.\d+$/, '') === e.chapter)).toBe(true);
      expect(e.title).not.toMatch(/^[A-ZÆØÅ ]{4,}$/);
      // Eksempeloppgaver har id som starter med «eks-», og bare de.
      expect(e.id.startsWith('eks-')).toBe(e.kind === 'eksempel');
      expect(getViz(profile, e.key)).toBe(e);
    }
  });

  // VizCard har deltematitlene inne i lenka, så en tittel lik en deltematittel ville gitt to treff i e2e-testene.
  it('geofag: deltemaene finnes i oppsettet, ingen tittel er lik et deltema, og kompetansemålet står i søkeordene', () => {
    const titles = new Set(Object.values(GEOFAG_SECTIONS).map((t) => t.toLowerCase()));
    for (const e of vizEntries('geoscience')) {
      for (const code of e.sections) expect(Object.keys(GEOFAG_SECTIONS), `${e.key}: ${code}`).toContain(code);
      expect(titles.has(e.title.toLowerCase()), e.key).toBe(false);
      expect((e.keywords ?? []).some((k) => /^KM\d+$/.test(k)), e.key).toBe(true);
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
    expect(vizForSection('physics', '2.3').map((e) => e.key)).toContain('k2-friksjon');
    expect(vizForSection('chemistry', '2.3')).toEqual([]);
    expect(vizForSection('physics', null)).toEqual([]);
  });
});
