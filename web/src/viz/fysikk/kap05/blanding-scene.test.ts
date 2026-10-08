import { describe, expect, it } from 'vitest';
import {
  CAL_METAL,
  CAL_WATER,
  METAL_BLOCK_X,
  METAL_DENSITY,
  METAL_THERMO_X,
  THERMO_LENGTH,
  flowFraction,
  levelInCylinder,
  levelInRing,
  levelWithBlock,
  metalBlock,
  sceneLayout,
  separateTags,
  thermoScaleY,
  valueTagWidth,
  volumeCm3,
  warmth,
  type MetalId,
} from './blanding-scene';
import { mixState } from './model';

const METALS: MetalId[] = ['aluminium', 'jern', 'kobber', 'bly'];

describe('volum og vannstand', () => {
  it('1 kg vann er 1000 cm³, og 1 kg jern er 127 cm³', () => {
    expect(volumeCm3(1, 1000)).toBeCloseTo(1000, 9);
    expect(volumeCm3(1, METAL_DENSITY.jern)).toBeCloseTo(127.06, 2);
    expect(volumeCm3(0, 1000)).toBe(0);
    expect(volumeCm3(-1, 1000)).toBe(0);
  });

  it('vannstanden er V/A', () => {
    // 1 L i et kar med radius 10 cm: 1000 / (π · 100) = 3,18 cm
    expect(levelInCylinder(1, 10)).toBeCloseTo(1000 / (Math.PI * 100), 9);
    expect(levelInRing(1, 6.5, 10)).toBeCloseTo(1000 / (Math.PI * (100 - 42.25)), 9);
    expect(levelInCylinder(1, 0)).toBe(0);
    expect(levelInRing(1, 10, 10)).toBe(0);
  });

  it('alt vannet får plass i vannforsøket (2 kg i begeret og 2 kg i ringen)', () => {
    const cup = CAL_WATER.cup!;
    const hot = levelInCylinder(2, cup.r - cup.wall);
    const cold = levelInRing(2, cup.r, CAL_WATER.innerR);
    expect(hot).toBeCloseTo(15.79, 1);
    expect(hot).toBeLessThan(cup.h - 1);
    expect(cold).toBeLessThan(cup.h);
    expect(cup.h).toBeLessThanOrEqual(CAL_WATER.innerH);
    // Minste masse (0,1 kg) gir fortsatt synlig vann
    expect(levelInCylinder(0.1, cup.r - cup.wall)).toBeGreaterThan(0.5);
    expect(levelInRing(0.1, cup.r, CAL_WATER.innerR)).toBeGreaterThan(0.4);
  });
});

describe('metallbiten', () => {
  it('er en sylinder med høyde = diameter og riktig volum', () => {
    for (const metal of METALS) {
      for (const m of [0.05, 0.5, 1]) {
        const b = metalBlock(metal, m);
        expect(b.h).toBe(b.d);
        expect((Math.PI * b.d ** 3) / 4).toBeCloseTo(b.V, 6);
        expect(b.V).toBeCloseTo((m / METAL_DENSITY[metal]) * 1e6, 6);
      }
    }
    // 1 kg aluminium er størst: 370 cm³, ca. 7,8 cm
    expect(metalBlock('aluminium', 1).d).toBeCloseTo(7.78, 2);
    // Samme masse bly er mye mindre enn aluminium
    expect(metalBlock('bly', 0.5).d).toBeLessThan(metalBlock('aluminium', 0.5).d * 0.7);
  });

  it('får plass i karet med termometeret ved siden av', () => {
    const big = metalBlock('aluminium', 1);
    // Det største tilfellet: biten rører verken veggen eller termometeret (røret er 0,06 · 26 cm bredt)
    expect(METAL_BLOCK_X - big.d / 2).toBeGreaterThan(-CAL_METAL.innerR + 0.5);
    expect(METAL_BLOCK_X + big.d / 2).toBeLessThan(METAL_THERMO_X - (0.06 * THERMO_LENGTH) / 2 - 0.5);
    // Kula på termometeret er innenfor veggen
    expect(METAL_THERMO_X + 0.06 * THERMO_LENGTH * 0.68).toBeLessThan(CAL_METAL.innerR);
  });

  it('vannstanden med biten i: dekket eller ikke', () => {
    const r = CAL_METAL.innerR;
    const b = metalBlock('jern', 0.5);
    const lvl = levelWithBlock(0.5, b, r);
    expect(lvl.covered).toBe(true);
    // Dekket: vannet + biten fyller hele tverrsnittet opp til vannstanden
    expect(lvl.level).toBeCloseTo((500 + b.V) / (Math.PI * r * r), 9);
    // Lite vann og stor bit: vannet står bare rundt biten
    const big = metalBlock('aluminium', 1);
    const low = levelWithBlock(0.1, big, r);
    expect(low.covered).toBe(false);
    expect(low.level).toBeCloseTo(100 / (Math.PI * (r * r - (big.d / 2) ** 2)), 9);
    expect(low.level).toBeLessThan(big.h);
    // Det verste tilfellet får plass i karet
    expect(levelWithBlock(1, big, r).level).toBeLessThan(CAL_METAL.innerH - 2);
    // Standardverdiene (0,5 kg jern i 0,5 kg vann): biten er dekket, også for kobber og bly (aluminium er større)
    for (const metal of ['jern', 'kobber', 'bly'] as const) expect(levelWithBlock(0.5, metalBlock(metal, 0.5), r).covered).toBe(true);
  });

  it('vannstanden er kontinuerlig der vannet akkurat dekker biten', () => {
    const r = CAL_METAL.innerR;
    const b = metalBlock('kobber', 0.4);
    // Massen som akkurat fyller rommet rundt biten
    const mJust = ((Math.PI * r * r - Math.PI * (b.d / 2) ** 2) * b.h) / 1e6 * 1000;
    const below = levelWithBlock(mJust - 1e-6, b, r).level;
    const above = levelWithBlock(mJust + 1e-6, b, r).level;
    expect(below).toBeCloseTo(b.h, 4);
    expect(above).toBeCloseTo(b.h, 4);
  });
});

describe('energistrømmen og fargene', () => {
  it('flowFraction er 1 ved start og går mot 0 i likevekt', () => {
    const input = { c1: 4180, m1: 0.5, T1: 80, c2: 4180, m2: 1, T2: 20 };
    const s0 = mixState(input, 0);
    expect(flowFraction(s0.T1, s0.T2, 80, 20)).toBeCloseTo(1, 9);
    const s1 = mixState(input, 6);
    expect(flowFraction(s1.T1, s1.T2, 80, 20)).toBeCloseTo(Math.exp(-1), 9);
    const sEnd = mixState(input, Infinity);
    expect(flowFraction(sEnd.T1, sEnd.T2, 80, 20)).toBeCloseTo(0, 9);
    expect(flowFraction(50, 50, 50, 50)).toBe(0);
  });

  it('warmth er 0 for kaldt vann og 1 ved 100 °C, og lik for like temperaturer', () => {
    expect(warmth(0)).toBe(0);
    expect(warmth(20)).toBe(0);
    expect(warmth(60)).toBeCloseTo(0.5, 9);
    expect(warmth(100)).toBe(1);
    expect(warmth(Number.NaN)).toBe(0);
  });
});

describe('termometeret og skiltene', () => {
  it('thermoScaleY følger kit-ets termometer: 0 nederst, 100 øverst', () => {
    const H = 260;
    const tw = 0.06 * H;
    expect(thermoScaleY(H, 0, 100, 0)).toBeCloseTo(-tw * 2.3 - tw * 0.9, 9);
    expect(thermoScaleY(H, 0, 100, 100)).toBeCloseTo(-H + tw * 1.3, 9);
    expect(thermoScaleY(H, 0, 100, 50)).toBeCloseTo((thermoScaleY(H, 0, 100, 0) + thermoScaleY(H, 0, 100, 100)) / 2, 9);
  });

  it('separateTags skyver skilt fra hverandre og holder dem i figuren', () => {
    expect(separateTags(100, 50, 300, 50, 8, 0, 800)).toEqual([100, 300]);
    const [a, b] = separateTags(380, 120, 420, 120, 8, 0, 800);
    expect(b - a).toBeCloseTo(128, 9);
    expect((a + b) / 2).toBeCloseTo(400, 9);
    const [c, d] = separateTags(30, 120, 60, 120, 8, 0, 800);
    expect(c - 60).toBeCloseTo(0, 9);
    expect(d - c).toBeCloseTo(128, 9);
    const [e, g] = separateTags(760, 120, 790, 120, 8, 0, 800);
    expect(g + 60).toBeCloseTo(800, 9);
    expect(g - e).toBeCloseTo(128, 9);
  });

  it('oppsettet gir plass til termometrene og skiltene over dem', () => {
    for (const narrow of [false, true]) {
      const f = narrow ? 1.8 : 1;
      const L = sceneLayout(narrow);
      const thermoTop = L.benchY - (CAL_WATER.base + 0.4 + THERMO_LENGTH) * L.k;
      const tagH = 17 * 0.9 * f * 1.55;
      expect(thermoTop - 26 * f - tagH).toBeGreaterThan(0);
      expect(L.H).toBeGreaterThan(L.benchY);
      // Kalorimeteret får plass i bredden
      expect((CAL_WATER.innerR + CAL_WATER.wall) * L.k * 2).toBeLessThan(L.W * 0.7);
      // To skilt med «T₁ = 100,0 °C» får plass ved siden av hverandre
      expect(2 * valueTagWidth(13, f) + 8).toBeLessThan(L.W);
    }
  });
});
