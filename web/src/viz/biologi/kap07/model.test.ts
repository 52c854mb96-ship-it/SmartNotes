import { describe, expect, it } from 'vitest';
import {
  CHECKPOINTS,
  CLONE_START,
  CYCLE,
  CYCLE_HOURS,
  MEIOSIS,
  R0,
  ONCOGENE_DRIVE,
  allCombinations,
  checkpointStatus,
  combinations,
  cycleCounts,
  cycleTime,
  distinctGametes,
  divisionRate,
  dnaAmount,
  gameteKey,
  healedTime,
  maxTotal,
  meiosisGametes,
  mitosisShare,
  randomGametes,
  randomOrientation,
  recombinantSegments,
  replicatedCount,
  solveTissue,
  stepAt,
  stepStart,
  tissueAt,
  tissueState,
  zygoteCombinations,
} from './model';

describe('cellesyklusen', () => {
  it('varer 24 timer, og mitosen er en liten del av den', () => {
    expect(CYCLE_HOURS).toBeCloseTo(24, 9);
    expect(stepStart(0)).toBe(0);
    expect(stepStart(1)).toBe(11);
    expect(stepStart(3)).toBe(23);
    expect(mitosisShare()).toBeCloseTo(1 / 24, 9);
    // Interfasen (G1, S, G2) er over 90 % av syklusen
    expect(stepStart(3) / CYCLE_HOURS).toBeGreaterThan(0.9);
  });

  it('tidspunkt og steg henger sammen', () => {
    for (let i = 0; i < CYCLE.length; i++) {
      expect(stepAt(cycleTime(i, 0.5))).toBe(i);
      expect(cycleTime(i, 0)).toBeCloseTo(stepStart(i), 9);
    }
    expect(stepAt(0)).toBe(0);
    expect(stepAt(30)).toBe(CYCLE.length - 1);
  });

  it('DNA-mengden går fra 2c til 4c i S-fasen og tilbake til 2c etter delingen', () => {
    expect(dnaAmount(0)).toBe(2);
    expect(dnaAmount(10.9)).toBe(2);
    expect(dnaAmount(15)).toBeCloseTo(3, 9);
    expect(dnaAmount(19)).toBe(4);
    expect(dnaAmount(23.9)).toBe(4);
    expect(dnaAmount(24)).toBe(2);
    // Aldri mindre enn 2c eller mer enn 4c, og øker monotont fram til delingen
    let prev = 0;
    for (let h = 0; h < 24; h += 0.25) {
      const d = dnaAmount(h);
      expect(d).toBeGreaterThanOrEqual(prev - 1e-12);
      expect(d).toBeGreaterThanOrEqual(2);
      expect(d).toBeLessThanOrEqual(4);
      prev = d;
    }
  });

  it('kromosomtallet er 2n hele tida, men 4n i cella mellom anafasen og cytokinesen', () => {
    expect(cycleCounts('G1', 4)).toEqual({ cells: 1, chromosomesPerCell: 4, chromatidsPerChromosome: 1, dnaPerCell: 2 });
    expect(cycleCounts('G2', 4).chromosomesPerCell).toBe(4);
    expect(cycleCounts('metafase', 6)).toEqual({ cells: 1, chromosomesPerCell: 6, chromatidsPerChromosome: 2, dnaPerCell: 4 });
    expect(cycleCounts('anafase', 4).chromosomesPerCell).toBe(8);
    expect(cycleCounts('cytokinese', 4)).toEqual({ cells: 2, chromosomesPerCell: 4, chromatidsPerChromosome: 1, dnaPerCell: 2 });
    // S-fasen: DNA-mengden øker, kromosomtallet ikke
    expect(cycleCounts('S', 4, 0.5)).toMatchObject({ chromosomesPerCell: 4, dnaPerCell: 3 });
    // DNA er bevart: 4c i morcella = 2 · 2c i dattercellene
    expect(cycleCounts('telofase', 4).dnaPerCell).toBe(2 * cycleCounts('cytokinese', 4).dnaPerCell);
  });

  it('antall kopierte kromosomer i S-fasen', () => {
    expect(replicatedCount(4, 0)).toBe(0);
    expect(replicatedCount(4, 0.5)).toBe(2);
    expect(replicatedCount(4, 1)).toBe(4);
    expect(replicatedCount(6, 2)).toBe(6);
  });
});

describe('meiosen', () => {
  it('to delinger: kromosomtallet halveres i meiose I, og det blir fire celler', () => {
    expect(MEIOSIS).toHaveLength(9);
    const telo1 = MEIOSIS.findIndex((m) => m.id === 'telofase1');
    MEIOSIS.forEach((m, i) => expect(m.ploidy).toBe(i < telo1 ? '2n' : 'n'));
    expect(MEIOSIS[MEIOSIS.length - 1]!.cells).toBe(4);
  });

  it('2ⁿ kombinasjoner: 4, 8 og over 8 millioner hos mennesket', () => {
    expect(combinations(2)).toBe(4);
    expect(combinations(3)).toBe(8);
    expect(combinations(23)).toBe(8_388_608);
    expect(zygoteCombinations(23)).toBeCloseTo(7.04e13, -11);
    const all = allCombinations(3);
    expect(all).toHaveLength(8);
    expect(new Set(all.map(gameteKey)).size).toBe(8);
  });

  it('fire kjønnsceller med ett kromosom fra hvert par, og alle kromatidene blir brukt', () => {
    for (const overkrysning of [false, true]) {
      for (const orient of [
        [true, false, true],
        [false, false, false],
      ]) {
        const g = meiosisGametes(3, orient, overkrysning);
        expect(g).toHaveLength(4);
        for (const gamete of g) {
          expect(gamete.map((c) => c.par)).toEqual([0, 1, 2]);
        }
        // Hvert par: mors og fars kromosom havner i to kjønnsceller hver
        for (let par = 0; par < 3; par++) {
          const origins = g.map((gamete) => gamete[par]!.opphav);
          expect(origins.filter((o) => o === 'mor')).toHaveLength(2);
          // Kjønnsceller fra samme celle i meiose I har samme kromosom (fra mor eller far)
          expect(origins[0]).toBe(origins[1]);
          expect(origins[2]).toBe(origins[3]);
          expect(origins[0]).not.toBe(origins[2]);
        }
      }
    }
  });

  it('uten overkrysning er kjønnscellene like to og to; med overkrysning er alle fire ulike', () => {
    const without = meiosisGametes(2, [true, false], false);
    expect(gameteKey(without[0]!)).toBe(gameteKey(without[1]!));
    expect(distinctGametes(without)).toBe(2);
    const withX = meiosisGametes(2, [true, false], true);
    expect(distinctGametes(withX)).toBe(4);
    // En rekombinant kromatide har et stykke fra den andre forelderen
    const rec = withX.flat().find((c) => c.rekombinant)!;
    const seg = recombinantSegments(rec);
    expect(seg).toHaveLength(1);
    expect(seg[0]!.opphav).not.toBe(rec.opphav);
    expect(seg[0]!.til).toBe(1);
  });

  it('tilfeldige kjønnsceller og orienteringer er like for samme frø', () => {
    expect(randomGametes(3, true, 10, 4)).toEqual(randomGametes(3, true, 10, 4));
    expect(randomOrientation(3, 9)).toEqual(randomOrientation(3, 9));
    const list = randomGametes(2, false, 50, 1);
    expect(distinctGametes(list)).toBeLessThanOrEqual(4);
    expect(distinctGametes(randomGametes(2, true, 200, 1))).toBeLessThanOrEqual(16);
    expect(distinctGametes(randomGametes(2, true, 200, 1))).toBeGreaterThan(4);
  });
});

describe('regulering av celledelingen', () => {
  const none = { onkogen: false, tsg: false };

  it('delingsraten: kontakthemming stopper normale celler i fullt vev', () => {
    expect(divisionRate(1, none)).toBe(0);
    expect(divisionRate(0, none)).toBeCloseTo(R0, 9);
    expect(divisionRate(0.5, none)).toBeGreaterThan(divisionRate(0.9, none));
    // Onkogen alene: raskere, men bremsen stopper fortsatt
    expect(divisionRate(0, { onkogen: true, tsg: false })).toBeCloseTo(R0 * ONCOGENE_DRIVE, 9);
    expect(divisionRate(1, { onkogen: true, tsg: false })).toBe(0);
    // Uten brems deler cellene seg også i fullt vev
    expect(divisionRate(1, { onkogen: false, tsg: true })).toBeGreaterThan(0);
    expect(divisionRate(2, { onkogen: true, tsg: true })).toBeCloseTo(R0 * ONCOGENE_DRIVE, 9);
    // DNA-skade bremser celler med virkende kontrollpunkter
    expect(divisionRate(0.5, none, true)).toBeLessThan(divisionRate(0.5, none));
  });

  it('et sår gror og stopper ved fullt vev', () => {
    const r = solveTissue({ ...none, wound: 0.5, damage: false });
    expect(tissueAt(r, 0).total).toBeCloseTo(0.5, 9);
    for (let t = 0; t <= 30; t += 1) expect(tissueAt(r, t).total).toBeLessThanOrEqual(1 + 1e-9);
    expect(tissueAt(r, 30).total).toBeGreaterThan(0.99);
    const healed = healedTime(r)!;
    expect(healed).toBeGreaterThan(5);
    expect(healed).toBeLessThan(20);
    expect(tissueState(r, none, 1)).toBe('gror');
    expect(tissueState(r, none, 30)).toBe('helt');
    // Med DNA-skade tar det lengre tid
    const dmg = solveTissue({ ...none, wound: 0.5, damage: true });
    expect(healedTime(dmg)!).toBeGreaterThan(healed);
    // Uten sår skjer det ingenting
    const intact = solveTissue({ ...none, wound: 0, damage: false });
    expect(tissueAt(intact, 30).total).toBeCloseTo(1, 9);
  });

  it('én mutasjon gir ikke svulst, men begge gjør det', () => {
    const onko = solveTissue({ onkogen: true, tsg: false, wound: 0.5, damage: false });
    expect(tissueAt(onko, 30).total).toBeLessThanOrEqual(1 + 1e-9);
    expect(tissueAt(onko, 30).mutant).toBeGreaterThan(CLONE_START);
    const tsg = solveTissue({ onkogen: false, tsg: true, wound: 0.5, damage: false });
    expect(tissueAt(tsg, 30).total).toBeGreaterThan(1);
    expect(tissueAt(tsg, 30).total).toBeLessThan(1.2);
    expect(tissueState(tsg, { onkogen: false, tsg: true }, 30)).toBe('vokser-sakte');
    const both = solveTissue({ onkogen: true, tsg: true, wound: 0.5, damage: false });
    expect(tissueAt(both, 30).total).toBeGreaterThan(3);
    expect(tissueState(both, { onkogen: true, tsg: true }, 30)).toBe('svulst');
    // Startverdiene: like mange celler totalt med og uten mutasjon
    expect(tissueAt(both, 0).total).toBeCloseTo(0.5, 9);
    expect(tissueAt(both, 0).mutant).toBeCloseTo(CLONE_START, 9);
    // Største antall celler: aldri over fullt vev med bare onkogen, over 300 % for en svulst
    expect(maxTotal(onko)).toBeLessThanOrEqual(1 + 1e-9);
    expect(maxTotal(tsg)).toBeLessThan(1.2);
    expect(maxTotal(both)).toBeGreaterThan(3);
  });

  it('kontrollpunktene', () => {
    expect(CHECKPOINTS.map((c) => c.id)).toEqual(['G1', 'G2', 'M']);
    expect(checkpointStatus('G1', none, true, false).status).toBe('stopp');
    expect(checkpointStatus('G2', none, true, false).status).toBe('stopp');
    expect(checkpointStatus('G1', none, false, true).status).toBe('g0');
    expect(checkpointStatus('G1', none, false, false).status).toBe('passer');
    // Uten brems slipper skadde celler gjennom
    expect(checkpointStatus('G1', { onkogen: false, tsg: true }, true, true).status).toBe('passer');
    expect(checkpointStatus('G2', { onkogen: false, tsg: true }, true, false).status).toBe('passer');
    // Onkogen alene: kontakthemmingen stopper cella i fullt vev
    expect(checkpointStatus('G1', { onkogen: true, tsg: false }, false, true).status).toBe('stopp');
    expect(checkpointStatus('G1', { onkogen: true, tsg: false }, false, false).status).toBe('passer');
    expect(checkpointStatus('M', none, true, true).status).toBe('passer');
  });
});
