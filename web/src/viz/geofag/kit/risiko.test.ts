import { describe, expect, it } from 'vitest';
import {
  BYGGTYPE_IDS,
  BYGGTYPER,
  FARESONER,
  fareniva,
  forventetSkade,
  KVIKKLEIRE_GRENSE_KPA,
  oppfyller,
  risikoklasse,
  sannsynlighetstrinn,
  sikkerhetsklasse,
  SIKKERHETSKLASSER,
  SPROBRUDD_GRENSE_KPA,
  vurderLeire,
  vurderTomt,
  type Faresone,
} from './risiko';

describe('sikkerhetsklassene i TEK17', () => {
  it('har grensene i § 7-2 (flom) og § 7-3 (skred)', () => {
    expect(SIKKERHETSKLASSER.F1.maksAarlig).toBeCloseTo(1 / 20, 15);
    expect(SIKKERHETSKLASSER.F2.maksAarlig).toBeCloseTo(1 / 200, 15);
    expect(SIKKERHETSKLASSER.F3.maksAarlig).toBeCloseTo(1 / 1000, 15);
    expect(SIKKERHETSKLASSER.S1.maksAarlig).toBeCloseTo(1 / 100, 15);
    expect(SIKKERHETSKLASSER.S2.maksAarlig).toBeCloseTo(1 / 1000, 15);
    expect(SIKKERHETSKLASSER.S3.maksAarlig).toBeCloseTo(1 / 5000, 15);
    for (const k of Object.values(SIKKERHETSKLASSER)) expect(k.gjentaksintervall * k.maksAarlig).toBeCloseTo(1, 12);
    expect(FARESONER).toHaveLength(5);
  });

  it('plasserer byggtypene som i veiledningen', () => {
    expect(sikkerhetsklasse('garasje', 'flom')!.id).toBe('F1');
    expect(sikkerhetsklasse('bolig', 'flom')!.id).toBe('F2');
    expect(sikkerhetsklasse('skole', 'flom')!.id).toBe('F2');
    expect(sikkerhetsklasse('sykehjem', 'flom')!.id).toBe('F3');
    expect(sikkerhetsklasse('garasje', 'skred')!.id).toBe('S1');
    expect(sikkerhetsklasse('bolig', 'skred')!.id).toBe('S2');
    expect(sikkerhetsklasse('skole', 'skred')!.id).toBe('S3');
    expect(sikkerhetsklasse('sykehjem', 'skred')!.id).toBe('S3');
    expect(sikkerhetsklasse('beredskap', 'skred')).toBeNull();
    expect(BYGGTYPE_IDS).toEqual(Object.keys(BYGGTYPER));
  });

  it('lar ikke en bolig stå i 1/100-sonen for skred (S2)', () => {
    expect(oppfyller('bolig', { fare: 'skred', aarlig: 1 / 100 })).toBe(false);
    expect(oppfyller('bolig', { fare: 'skred', aarlig: 1 / 1000 })).toBe(false);
    expect(oppfyller('bolig', { fare: 'skred', aarlig: 1 / 5000 })).toBe(true);
    expect(oppfyller('garasje', { fare: 'skred', aarlig: 1 / 1000 })).toBe(true);
    expect(oppfyller('skole', { fare: 'skred', aarlig: 1 / 5000 })).toBe(false);
  });

  it('krever at en bolig står over 200-årsflommen og et sykehjem over 1000-årsflommen', () => {
    expect(oppfyller('bolig', { fare: 'flom', aarlig: 1 / 200 })).toBe(false);
    expect(oppfyller('bolig', { fare: 'flom', aarlig: 1 / 1000 })).toBe(true);
    expect(oppfyller('sykehjem', { fare: 'flom', aarlig: 1 / 1000 })).toBe(false);
    expect(oppfyller('garasje', { fare: 'flom', aarlig: 1 / 200 })).toBe(true);
    expect(oppfyller('garasje', { fare: 'flom', aarlig: 1 / 20 })).toBe(false);
  });

  it('oppfyller alltid kravet utenfor sonene, og beredskap aldri i en sone', () => {
    for (const b of BYGGTYPE_IDS) expect(oppfyller(b, null)).toBe(true);
    expect(oppfyller('beredskap', { fare: 'flom', aarlig: 1 / 1000 })).toBe(false);
    expect(vurderTomt('beredskap', [{ fare: 'flom', aarlig: 1 / 1000 }]).status).toBe('ikke-tillatt');
  });

  it('gir aldri en årlig sannsynlighet eller «oppfyller» for kvikkleire', () => {
    for (const b of BYGGTYPE_IDS) expect(oppfyller(b, { fare: 'kvikkleire' })).toBeNull();
    const v = vurderTomt('garasje', [{ fare: 'flom', aarlig: 1 / 1000 }, { fare: 'kvikkleire' }]);
    expect(v.status).toBe('utredning');
    expect(v.tekst).toMatch(/geoteknisk utredning/);
  });

  it('vurderer tomter i flere soner', () => {
    expect(vurderTomt('bolig', []).status).toBe('ok');
    expect(vurderTomt('bolig', []).tekst).toMatch(/en bolig/);
    const soner: Faresone[] = [
      { fare: 'flom', aarlig: 1 / 1000 },
      { fare: 'skred', aarlig: 1 / 5000 },
    ];
    expect(vurderTomt('bolig', soner)).toMatchObject({ status: 'ok', klasser: ['F2', 'S2'] });
    expect(vurderTomt('sykehjem', soner)).toMatchObject({ status: 'ikke-ok', klasser: ['F3', 'S3'] });
    expect(vurderTomt('sykehjem', []).tekst).toMatch(/et sykehjem/);
  });
});

describe('risiko', () => {
  it('gir null forventet skade uten bygg', () => {
    expect(forventetSkade([])).toBe(0);
  });

  it('summerer sannsynlighet × konsekvens', () => {
    expect(forventetSkade([{ aarlig: 1 / 200, konsekvens: 2_000_000 }])).toBeCloseTo(10_000, 8);
    expect(
      forventetSkade([
        { aarlig: 1 / 20, konsekvens: 100_000 },
        { aarlig: 1 / 1000, konsekvens: 5_000_000 },
      ]),
    ).toBeCloseTo(10_000, 8);
    expect(forventetSkade([{ aarlig: 2, konsekvens: 1 }])).toBeNull();
    expect(forventetSkade([{ aarlig: 0.1, konsekvens: Number.NaN }])).toBeNull();
  });

  it('lar et tiltak som senker sannsynligheten aldri øke den forventede skaden', () => {
    const k = 3_000_000;
    let forrige = Infinity;
    for (const p of FARESONER) {
      const s = forventetSkade([{ aarlig: p, konsekvens: k }])!;
      expect(s).toBeLessThan(forrige);
      forrige = s;
    }
  });

  it('har en risikoklasse som øker med begge faktorene', () => {
    const rang = { lav: 0, middels: 1, hoy: 2 } as const;
    const ps = [0, 1 / 10_000, 1 / 5000, 1 / 1000, 1 / 200, 1 / 100, 1 / 20, 1];
    for (let a = 0; a < ps.length; a++) {
      for (let k = 1; k <= 5; k++) {
        const r = risikoklasse(ps[a]!, k)!;
        if (a > 0) expect(rang[r.klasse]).toBeGreaterThanOrEqual(rang[risikoklasse(ps[a - 1]!, k)!.klasse]);
        if (k > 1) expect(rang[r.klasse]).toBeGreaterThanOrEqual(rang[risikoklasse(ps[a]!, k - 1)!.klasse]);
      }
    }
    expect(risikoklasse(1 / 20, 5)!.klasse).toBe('hoy');
    expect(risikoklasse(1 / 10_000, 1)!.klasse).toBe('lav');
    expect(risikoklasse(1 / 100, 4)!.navn).toBe('høy risiko');
    expect(risikoklasse(0.1, 0)).toBeNull();
    expect(risikoklasse(0.1, 6)).toBeNull();
    expect(risikoklasse(Number.NaN, 3)).toBeNull();
  });

  it('har sannsynlighetstrinn og faregrad etter faresonene', () => {
    expect(FARESONER.map((p) => sannsynlighetstrinn(p))).toEqual([5, 4, 3, 3, 2]);
    expect(sannsynlighetstrinn(1 / 10_000)).toBe(1);
    expect(FARESONER.map((p) => fareniva(p))).toEqual([3, 2, 2, 1, 0]);
    expect(fareniva(-1)).toBeNull();
  });
});

describe('kvikkleire', () => {
  it('bruker grensene 0,5 og 2 kPa for omrørt skjærfasthet', () => {
    expect(KVIKKLEIRE_GRENSE_KPA).toBe(0.5);
    expect(SPROBRUDD_GRENSE_KPA).toBe(2);
    expect(vurderLeire(0.3)).toMatchObject({ kvikk: true, sprobrudd: true });
    expect(vurderLeire(1.2)).toMatchObject({ kvikk: false, sprobrudd: true });
    expect(vurderLeire(5)).toMatchObject({ kvikk: false, sprobrudd: false });
    expect(vurderLeire(0)).toMatchObject({ kvikk: true });
    expect(vurderLeire(-1)).toBeNull();
    expect(vurderLeire(0.3)!.tekst).toMatch(/geoteknisk utredning/);
  });
});
