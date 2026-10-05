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
import {
  CASCADES,
  GLUT,
  ION,
  K_CHANNEL,
  PUMP_STEPS,
  SUBSTANCES,
  VESICLE_PHASES,
  amplification,
  carrierFlux,
  carrierOccupancy,
  carrierVmax,
  cascadeAt,
  cascadeProgress,
  cascadeTotals,
  channelFlux,
  endocytosisShape,
  passiveNetRate,
  pumpPerCycle,
  pumpSteadyState,
  responseTime,
  vesicleArea,
  vesiclePhase,
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

describe('membrantransport: passiv diffusjon', () => {
  it('O₂ og CO₂ går lett gjennom lipidlaget, vann sakte, glukose og ioner ikke', () => {
    expect(SUBSTANCES.O2.rel).toBeGreaterThan(SUBSTANCES.vann.rel);
    expect(SUBSTANCES.CO2.rel).toBeGreaterThan(SUBSTANCES.vann.rel);
    expect(SUBSTANCES.glukose.rel).toBe(0);
    expect(SUBSTANCES.Na.rel).toBe(0);
  });

  it('netto transport er proporsjonal med konsentrasjonsforskjellen og går ned gradienten', () => {
    const a = passiveNetRate('O2', 10, 2);
    expect(a).toBeGreaterThan(0);
    expect(passiveNetRate('O2', 18, 2)).toBeCloseTo(2 * a, 12);
    expect(passiveNetRate('O2', 2, 10)).toBeCloseTo(-a, 12);
    expect(passiveNetRate('O2', 7, 7)).toBe(0);
    expect(passiveNetRate('Na', 20, 0)).toBe(0);
  });
});

describe('membrantransport: fasilitert diffusjon', () => {
  it('bæreproteiner mettes: aldri over n · kcat, halv fart ved Km', () => {
    expect(carrierOccupancy(GLUT.Km)).toBeCloseTo(0.5, 12);
    expect(carrierFlux(GLUT.Km, 0, 1)).toBeCloseTo(GLUT.kcat / 2, 9);
    expect(carrierFlux(1e6, 0, 3)).toBeLessThan(carrierVmax(3));
    expect(carrierFlux(1e6, 0, 3)).toBeGreaterThan(0.99 * carrierVmax(3));
    // Dobbel konsentrasjon gir mindre enn dobbel fart (ikke lineært)
    expect(carrierFlux(10, 0, 1)).toBeLessThan(2 * carrierFlux(5, 0, 1));
    // Flere bæreproteiner: proporsjonalt
    expect(carrierFlux(5, 1, 4)).toBeCloseTo(4 * carrierFlux(5, 1, 1), 9);
  });

  it('fasilitert diffusjon er passiv: ingen netto transport ved like konsentrasjoner, og den kan gå begge veier', () => {
    expect(carrierFlux(5, 5, 3)).toBe(0);
    expect(carrierFlux(2, 8, 1)).toBeLessThan(0);
    expect(carrierFlux(0, 0, 5)).toBe(0);
  });

  it('kanaler: rett linje og millioner av ioner per sekund', () => {
    const J = channelFlux(ION.kIn, ION.kOut, 1);
    expect(J).toBeCloseTo(K_CHANNEL.g * 136, 6);
    expect(J).toBeGreaterThan(1e6);
    expect(J / carrierVmax(1)).toBeGreaterThan(1000);
    expect(channelFlux(50, 50, 3)).toBe(0);
    expect(channelFlux(100, 4, 2)).toBeCloseTo(2 * channelFlux(100, 4, 1), 6);
    expect(channelFlux(140, 4, 0)).toBe(0);
  });
});

describe('membrantransport: natrium-kalium-pumpa', () => {
  it('full ATP-tilgang gir de vanlige konsentrasjonene', () => {
    const s = pumpSteadyState(1);
    expect(s.naIn).toBeCloseTo(ION.naIn, 6);
    expect(s.kIn).toBeCloseTo(ION.kIn, 6);
    expect(s.rate).toBeCloseTo(1, 9);
  });

  it('uten ATP forsvinner gradientene', () => {
    const s = pumpSteadyState(0);
    expect(s.naIn).toBeCloseTo(ION.naOut, 6);
    expect(s.kIn).toBeCloseTo(ION.kOut, 6);
    expect(s.atpPerS).toBe(0);
  });

  it('mindre ATP gir mer Na⁺ og mindre K⁺ inne (monotont)', () => {
    let prev = pumpSteadyState(1);
    for (const a of [0.8, 0.5, 0.2, 0.05]) {
      const s = pumpSteadyState(a);
      expect(s.naIn).toBeGreaterThan(prev.naIn);
      expect(s.kIn).toBeLessThan(prev.kIn);
      prev = s;
    }
  });

  it('per runde: 3 Na⁺ ut, 2 K⁺ inn, 1 ATP og én positiv ladning ut', () => {
    expect(pumpPerCycle(1)).toEqual({ naOut: 3, kIn: 2, atp: 1, charge: 1 });
    expect(pumpPerCycle(100).naOut).toBe(300);
    // Stegene: Na⁺ bindes på innsiden (åpen mot cytoplasma), K⁺ på utsiden
    expect(PUMP_STEPS).toHaveLength(6);
    expect(PUMP_STEPS[0]).toMatchObject({ state: 1, na: 3 });
    expect(PUMP_STEPS[3]).toMatchObject({ state: 0, k: 2, fosfat: true });
    expect(PUMP_STEPS.filter((s) => s.fosfat).length).toBeGreaterThan(0);
  });
});

describe('membrantransport: endo- og eksocytose', () => {
  it('fasene kommer i rekkefølge', () => {
    for (const kind of ['endo', 'ekso'] as const) {
      const ph = VESICLE_PHASES[kind];
      expect(ph[0]!.from).toBe(0);
      for (let i = 1; i < ph.length; i++) expect(ph[i]!.from).toBeGreaterThan(ph[i - 1]!.from);
      expect(vesiclePhase(kind, 0)).toBe(0);
      expect(vesiclePhase(kind, 1)).toBe(ph.length - 1);
    }
  });

  it('lomma blir dypere til vesikkelen snøres av og fraktes inn', () => {
    expect(endocytosisShape(0)).toEqual({ depth: -1, detached: false, travel: 0 });
    let prev = -1;
    for (let p = 0.15; p <= 0.72; p += 0.03) {
      const s = endocytosisShape(p);
      expect(s.depth).toBeGreaterThanOrEqual(prev - 1e-12);
      prev = s.depth;
    }
    expect(endocytosisShape(0.5).detached).toBe(false);
    expect(endocytosisShape(0.9)).toMatchObject({ depth: 1, detached: true });
    expect(endocytosisShape(1).travel).toBeCloseTo(1, 12);
    expect(vesicleArea(100)).toBeCloseTo(0.0314, 4);
  });
});

describe('cellesignalering', () => {
  it('forsterkning: ett adrenalinmolekyl gir ca. 10⁸ glukosemolekyler, kortisol ca. 10⁴ proteiner', () => {
    expect(amplification('vannloselig')).toBe(1e8);
    expect(amplification('fettloselig')).toBe(1e4);
    expect(cascadeTotals('vannloselig', 1)).toEqual([1, 100, 1e4, 1e4, 1e6, 1e8]);
    expect(cascadeTotals('vannloselig', 3)[5]).toBe(3e8);
  });

  it('trinnene kommer etter hverandre og når full respons', () => {
    for (const kind of ['vannloselig', 'fettloselig'] as const) {
      const n = CASCADES[kind].levels.length;
      const t = CASCADES[kind].tau * 2;
      for (let i = 1; i < n; i++) expect(cascadeProgress(kind, i, t)).toBeLessThan(cascadeProgress(kind, i - 1, t));
      expect(cascadeProgress(kind, 0, 0)).toBe(0);
      expect(cascadeProgress(kind, n - 1, CASCADES[kind].tMax)).toBeGreaterThan(0.99);
      // Første trinn: 1 − e^(−t/τ)
      expect(cascadeProgress(kind, 0, CASCADES[kind].tau)).toBeCloseTo(1 - Math.exp(-1), 12);
    }
  });

  it('vannløselige hormoner virker på sekunder, fettløselige på timer', () => {
    const w = responseTime('vannloselig');
    const f = responseTime('fettloselig');
    expect(CASCADES.vannloselig.unit).toBe('s');
    expect(w).toBeGreaterThan(3);
    expect(w).toBeLessThan(20);
    expect(CASCADES.fettloselig.unit).toBe('min');
    expect(f).toBeGreaterThan(60);
    expect(f).toBeLessThan(180);
  });

  it('uten reseptor skjer det ingenting', () => {
    expect(cascadeAt('vannloselig', 5, 20, false).every((v) => v === 0)).toBe(true);
    const on = cascadeAt('vannloselig', 1, 20);
    expect(on[5]!).toBeGreaterThan(0.99e8);
  });
});
