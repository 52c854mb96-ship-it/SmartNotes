import { describe, expect, it } from 'vitest';
import { countSides, expectedSideA } from '../kit';
import {
  CROSS_RATE,
  C_ISO,
  OSMOSIS_V0,
  PARTICLES_PER_MMOL,
  cellInSolution,
  diffusionConcentrations,
  diffusionHalfTime,
  diffusionSpec,
  lysisConcentration,
  makeDiffusionTracks,
  osmolarity,
  osmosis,
  osmosisAt,
  osmosisEquilibrium,
  osmoticPressure,
  rbcVolume,
  tonicity,
  waterColumn,
} from './model';

describe('diffusjon', () => {
  it('konsentrasjonene går mot snittet, og stoffmengden er bevart', () => {
    const c0 = diffusionConcentrations(16, 2, 0);
    expect(c0).toEqual({ left: 16, right: 2 });
    for (const t of [3, 10, 30]) {
      const c = diffusionConcentrations(16, 2, t);
      expect(c.left + c.right).toBeCloseTo(18, 12);
      expect(c.left).toBeGreaterThan(c.right);
    }
    const late = diffusionConcentrations(16, 2, 1000);
    expect(late.left).toBeCloseTo(9, 9);
    expect(late.right).toBeCloseTo(9, 9);
  });

  it('forskjellen halveres på ln 2 / 2k', () => {
    const th = diffusionHalfTime();
    expect(th).toBeCloseTo(Math.LN2 / (2 * CROSS_RATE), 12);
    const c = diffusionConcentrations(16, 2, th);
    expect(c.left - c.right).toBeCloseTo(7, 9);
  });

  it('like konsentrasjoner gir ingen netto transport', () => {
    expect(diffusionConcentrations(8, 8, 25)).toEqual({ left: 8, right: 8 });
  });

  it('partikkelmodellen har samme forventning som formelen', () => {
    const spec = diffusionSpec(16, 2, false);
    expect(spec.n).toEqual([32, 4]);
    for (const t of [5, 15, 40]) expect(expectedSideA(spec, t) / PARTICLES_PER_MMOL).toBeCloseTo(diffusionConcentrations(16, 2, t).left, 9);
    // Partiklene er bevart, og med kanaler krysser de bare ved portene
    const tracks = makeDiffusionTracks(16, 2, true);
    expect(countSides(tracks, 30).reduce((a, b) => a + b, 0)).toBe(36);
    for (const tr of tracks) for (const c of tr.crossings) expect([0, 1, 2]).toContain(c.gate);
  });
});

describe('osmose', () => {
  it('vannet strømmer mot siden med mest sukker, og sukkeret blir der det er', () => {
    const r = osmosis(0.6, 0.1);
    const s0 = osmosisAt(r, 0);
    expect(s0.VLeft).toBeCloseTo(OSMOSIS_V0, 9);
    expect(s0.flow).toBeLessThan(0); // mot venstre
    const s = osmosisAt(r, 60);
    expect(s.VLeft).toBeGreaterThan(OSMOSIS_V0);
    expect(s.VLeft + s.VRight).toBeCloseTo(2 * OSMOSIS_V0, 9);
    // Sukkermengden er den samme (c · V er konstant)
    expect((s.cLeft * s.VLeft) / OSMOSIS_V0).toBeCloseTo(0.6, 9);
    expect((s.cRight * s.VRight) / OSMOSIS_V0).toBeCloseTo(0.1, 9);
    // Konsentrasjonsforskjellen blir mindre, men forsvinner ikke (vannsøylen holder igjen)
    expect(s.cLeft - s.cRight).toBeLessThan(0.5);
    expect(s.cLeft).toBeGreaterThan(s.cRight);
  });

  it('nærmer seg likevekten, der strømmen stopper', () => {
    const r = osmosis(1, 0);
    const eq = osmosisEquilibrium(1, 0);
    expect(eq).toBeCloseTo((2 + Math.sqrt(12)) / 4, 6); // 1/V = 2(V − 1)
    expect(osmosisAt(r, 60).VLeft / OSMOSIS_V0).toBeCloseTo(eq, 2);
    expect(Math.abs(osmosisAt(r, 60).flow)).toBeLessThan(0.05);
  });

  it('er symmetrisk og står stille ved like konsentrasjoner', () => {
    expect(osmosisEquilibrium(0.4, 0.4)).toBeCloseTo(1, 9);
    expect(osmosisAt(osmosis(0.4, 0.4), 30).flow).toBeCloseTo(0, 9);
    expect(osmosisEquilibrium(0.2, 0.7) + osmosisEquilibrium(0.7, 0.2)).toBeCloseTo(2, 9);
  });

  it('osmotisk trykk: 0,1 mol/L ved 25 °C kan løfte vann ca. 25 m', () => {
    const p = osmoticPressure(0.1, 298);
    expect(p).toBeCloseTo(2.48, 2);
    expect(waterColumn(p)).toBeCloseTo(25.3, 1);
  });
});

describe('celle i løsning', () => {
  it('0,9 % NaCl er isotont (ca. 0,29 osmol/L, som blodplasma)', () => {
    expect(tonicity(C_ISO)).toBe('isoton');
    expect(tonicity(0.2)).toBe('hypoton');
    expect(tonicity(2)).toBe('hyperton');
    expect(osmolarity(0.9)).toBeCloseTo(0.286, 3);
    expect(rbcVolume(C_ISO)).toBeCloseTo(1, 12);
  });

  it('blodcellen sprekker under ca. 0,45 % og skrumper i sterk saltløsning', () => {
    expect(lysisConcentration()).toBeCloseTo(0.45, 9);
    expect(cellInSolution(0).rbc).toMatchObject({ burst: true, state: 'hemolyse' });
    expect(cellInSolution(0.44).rbc.burst).toBe(true);
    expect(cellInSolution(0.5).rbc).toMatchObject({ burst: false, state: 'svulmer' });
    const salt = cellInSolution(3);
    expect(salt.rbc.state).toBe('skrumper');
    expect(salt.rbc.volume).toBeCloseTo(0.58, 9);
    expect(salt.water).toBe('ut');
  });

  it('plantecellen: turgor i hypoton løsning, slapp i isoton, plasmolyse i hyperton', () => {
    const fresh = cellInSolution(0);
    expect(fresh.plant.state).toBe('turgid');
    expect(fresh.plant.volume).toBe(1);
    expect(fresh.plant.turgor).toBeCloseTo(osmoticPressure(osmolarity(0.9)), 9);
    expect(fresh.plant.turgor).toBeGreaterThan(6);
    expect(fresh.water).toBe('inn');
    expect(cellInSolution(0.9).plant).toMatchObject({ state: 'slapp', turgor: 0, volume: 1 });
    const salt = cellInSolution(3);
    expect(salt.plant.state).toBe('plasmolyse');
    expect(salt.plant.volume).toBeLessThan(0.5);
    expect(salt.plant.turgor).toBe(0);
  });
});
