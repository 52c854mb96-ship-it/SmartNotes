import { describe, expect, it } from 'vitest';
import {
  BOWENS_REKKE,
  GLANS_NAVN,
  hardhetFraRissetester,
  mineral,
  MINERAL_IDS,
  MINERAL_TONER,
  MINERALER,
  MINERALGRUPPER,
  MOHS_ABSOLUTT,
  muligeMineraler,
  RISSETESTER,
  SILIKATSTRUKTURER,
  SKORPAS_MINERALER,
  STREK_NAVN,
} from './mineraler';

const ids = (liste: { id: string }[]) => liste.map((m) => m.id);

describe('mineraltabellen', () => {
  it('har gyldige egenskaper for hvert mineral', () => {
    for (const id of MINERAL_IDS) {
      const m = MINERALER[id];
      expect(m.id).toBe(id);
      expect(m.hardhet[0]).toBeGreaterThanOrEqual(1);
      expect(m.hardhet[1]).toBeLessThanOrEqual(10);
      expect(m.hardhet[0]).toBeLessThanOrEqual(m.hardhet[1]);
      expect(m.tetthet[0]).toBeGreaterThan(1.5);
      expect(m.tetthet[0]).toBeLessThanOrEqual(m.tetthet[1]);
      expect(m.glans.length).toBeGreaterThan(0);
      for (const g of m.glans) expect(GLANS_NAVN[g]).toBeDefined();
      expect(m.strek.length).toBeGreaterThan(0);
      for (const s of m.strek) expect(STREK_NAVN[s]).toBeDefined();
      expect(MINERAL_TONER).toContain(m.tone);
      expect(m.navn).toBe(m.navn.toLowerCase());
      // Silikater har struktur, andre har det ikke
      expect(m.silikatstruktur !== undefined).toBe(m.gruppe === 'silikat');
      expect(MINERALGRUPPER[m.gruppe]).toBeDefined();
    }
  });

  it('aniongruppen følger gruppen, med unntak for pyritt og halogenidene', () => {
    expect(MINERALER.kalkspat.aniongruppe).toBe('CO₃²⁻');
    expect(MINERALER.olivin.aniongruppe).toBe('SiO₄⁴⁻');
    expect(MINERALER.pyritt.aniongruppe).toBe('S₂²⁻');
    expect(MINERALER.halitt.aniongruppe).toBe('Cl⁻');
    expect(MINERALER.flusspat.aniongruppe).toBe('F⁻');
    expect(MINERALER.gips.aniongruppe).toBe('SO₄²⁻');
    expect(MINERALER.gull.aniongruppe).toBe('');
  });

  it('kjente verdier', () => {
    expect(MINERALER.kvarts.hardhet).toEqual([7, 7]);
    expect(MINERALER.kalkspat.bruser).toBe('ja');
    expect(MINERALER.dolomitt.bruser).toBe('pulver');
    expect(MINERALER.magnetitt.magnetisk).toBe('sterkt');
    expect(MINERALER.hematitt.strek).toContain('rodbrun');
    expect(MINERALER.halitt.krystallform).toBe('terning');
    expect(MINERALER.granat.krystallform).toBe('dodekaeder');
    expect(MINERALER.blyglans.tetthet[0]).toBeGreaterThan(7);
    expect(mineral('kvarts')?.navn).toBe('kvarts');
    expect(mineral('finnes-ikke')).toBeNull();
  });

  it('formlene inneholder ikke «NaN»', () => {
    for (const id of MINERAL_IDS) expect(MINERALER[id].formel).not.toContain('NaN');
  });
});

describe('silikatstrukturene', () => {
  it('går fra minst til mest sammenkoblet, og eksemplene finnes', () => {
    for (let k = 1; k < SILIKATSTRUKTURER.length; k++) {
      expect(SILIKATSTRUKTURER[k]!.delteO).toBeGreaterThanOrEqual(SILIKATSTRUKTURER[k - 1]!.delteO);
    }
    expect(SILIKATSTRUKTURER[0]!.id).toBe('oy');
    expect(SILIKATSTRUKTURER.at(-1)!.id).toBe('rammeverk');
  });

  it('hvert silikat i tabellen står som eksempel under sin struktur', () => {
    for (const id of MINERAL_IDS) {
      const m = MINERALER[id];
      if (!m.silikatstruktur) continue;
      const s = SILIKATSTRUKTURER.find((x) => x.id === m.silikatstruktur)!;
      expect(s.eksempler, id).toContain(id);
    }
  });

  it('Si : O passer med antall delte oksygen', () => {
    // Hvert tetraeder har 4 O; delte O telles halvt: O per Si = 4 − delteO / 2
    for (const s of SILIKATSTRUKTURER) {
      const [si, o] = s.siO.split(' : ').map(Number) as [number, number];
      expect(o / si).toBeCloseTo(4 - s.delteO / 2, 6);
    }
  });
});

describe('hardhet', () => {
  it('Mohs-skalaen har ti trinn med økende absolutt hardhet', () => {
    expect(MOHS_ABSOLUTT).toHaveLength(10);
    MOHS_ABSOLUTT.forEach((t, i) => {
      expect(t.mohs).toBe(i + 1);
      expect(MINERALER[t.mineral].hardhet[0]).toBe(t.mohs);
      if (i > 0) expect(t.absolutt).toBeGreaterThan(MOHS_ABSOLUTT[i - 1]!.absolutt);
    });
    expect(MOHS_ABSOLUTT.at(-1)!.absolutt / MOHS_ABSOLUTT[8]!.absolutt).toBeGreaterThan(3);
  });

  it('rissetester gir et hardhetsintervall', () => {
    expect(RISSETESTER.find((r) => r.id === 'negl')!.hardhet).toBe(2.5);
    expect(hardhetFraRissetester([])).toEqual({ min: 1, max: 10 });
    expect(
      hardhetFraRissetester([
        { redskap: 'negl', risses: false },
        { redskap: 'kniv', risses: true },
      ]),
    ).toEqual({ min: 2.5, max: 5.5 });
    expect(hardhetFraRissetester([{ redskap: 7, risses: true }])).toEqual({ min: 1, max: 7 });
  });

  it('motstridende tester gir null', () => {
    expect(
      hardhetFraRissetester([
        { redskap: 'negl', risses: true },
        { redskap: 'stalfil', risses: false },
      ]),
    ).toBeNull();
    expect(hardhetFraRissetester([{ redskap: Number.NaN, risses: true }])).toBeNull();
  });
});

describe('mineralbestemmelse', () => {
  it('uten observasjoner er alle mulige', () => {
    expect(muligeMineraler({})).toHaveLength(MINERAL_IDS.length);
  });

  it('metallglans og rødbrun strek gir hematitt', () => {
    expect(ids(muligeMineraler({ glans: 'metall', strek: 'rodbrun' }))).toEqual(['hematitt']);
  });

  it('magnetisk og svart strek gir magnetitt (og den svakt magnetiske ilmenitten)', () => {
    expect(ids(muligeMineraler({ magnetisk: true, strek: 'svart' }))).toEqual(['magnetitt', 'ilmenitt']);
    expect(ids(muligeMineraler({ magnetisk: false, strek: 'svart' }))).not.toContain('magnetitt');
  });

  it('bruser i saltsyre: kalkspat og dolomitt', () => {
    expect(ids(muligeMineraler({ bruser: true }))).toEqual(['kalkspat', 'dolomitt']);
    expect(ids(muligeMineraler({ bruser: true, rissetester: [{ redskap: 'kobbermynt', risses: true }] }))).toEqual([
      'kalkspat',
      'dolomitt',
    ]);
    expect(ids(muligeMineraler({ bruser: false }))).not.toContain('dolomitt');
  });

  it('pyritt og kobberkis skilles med kniven', () => {
    const messing = { glans: 'metall' as const, strek: 'gronnsvart' as const };
    expect(ids(muligeMineraler({ ...messing, rissetester: [{ redskap: 'kniv', risses: true }] }))).toContain('kobberkis');
    expect(ids(muligeMineraler({ ...messing, rissetester: [{ redskap: 'kniv', risses: true }] }))).not.toContain('pyritt');
    expect(ids(muligeMineraler({ ...messing, rissetester: [{ redskap: 'kniv', risses: false }] }))).toContain('pyritt');
  });

  it('glassglans, hvit strek, risser glass og ingen spalting: kvarts blant få', () => {
    const r = ids(muligeMineraler({ glans: 'glass', strek: 'hvit', spalting: 0, rissetester: [{ redskap: 'glass', risses: false }] }));
    expect(r).toContain('kvarts');
    expect(r).not.toContain('kalkspat');
    expect(r).not.toContain('kalifeltspat');
  });

  it('tetthet med toleranse', () => {
    expect(ids(muligeMineraler({ tetthet: 7.5 }))).toEqual(['blyglans']);
    expect(ids(muligeMineraler({ tetthet: 2.6, bruser: true }))).toEqual(['kalkspat']);
  });

  it('motstridende hardhet gir ingen', () => {
    expect(
      muligeMineraler({
        rissetester: [
          { redskap: 'negl', risses: true },
          { redskap: 'stalfil', risses: false },
        ],
      }),
    ).toEqual([]);
    expect(muligeMineraler({ hardhet: { min: 8, max: 3 } })).toEqual([]);
  });
});

describe('jordskorpa og Bowens rekke', () => {
  it('summen er 100 % og silikatene er over 90 %', () => {
    const sum = SKORPAS_MINERALER.reduce((s, a) => s + a.prosent, 0);
    expect(sum).toBe(100);
    const silikat = SKORPAS_MINERALER.filter((a) => a.silikat).reduce((s, a) => s + a.prosent, 0);
    expect(silikat).toBeGreaterThan(90);
    for (const a of SKORPAS_MINERALER) for (const id of a.mineraler) expect(MINERALER[id]).toBeDefined();
  });

  it('Bowens rekke bruker mineraler fra tabellen', () => {
    for (const id of [...BOWENS_REKKE.diskontinuerlig, ...BOWENS_REKKE.tilSlutt]) expect(MINERALER[id]).toBeDefined();
    expect(BOWENS_REKKE.diskontinuerlig[0]).toBe('olivin');
    expect(BOWENS_REKKE.tilSlutt.at(-1)).toBe('kvarts');
  });
});
