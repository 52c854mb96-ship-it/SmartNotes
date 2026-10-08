import { describe, expect, it } from 'vitest';
import {
  CALORIMETER,
  CALORIMETER_TASKS,
  C_WATER,
  METAL_TABLE,
  blockSize,
  calorimeterFill,
  equilibriumTemp,
  metalEntry,
  roundSig,
  solveCalorimeterTask,
  type CalorimeterTask,
} from './model-eks-kalorimeter';

describe('kalorimeter: tallsett 1 (aluminium)', () => {
  const task = CALORIMETER_TASKS[0]!;
  const s = solveCalorimeterTask(task);

  it('vannet mottar Q = 4180 · 0,400 · 9,2 = 15 382 J', () => {
    expect(s.dTWater).toBeCloseTo(9.2, 10);
    expect(s.CWater).toBeCloseTo(1672, 10);
    expect(s.Qw).toBeCloseTo(15382.4, 6);
  });

  it('c = 15 382 J / (0,250 kg · 72,8 K) = 845 J/(kg·K), omtrent 850', () => {
    expect(s.dTMetal).toBeCloseTo(72.8, 10);
    expect(s.c).toBeCloseTo(845.19, 2);
    expect(s.cRounded).toBe(850);
  });

  it('nærmest i tabellen er aluminium (−6,1 %), deretter titan', () => {
    expect(s.best.entry.id).toBe('aluminium');
    expect(s.best.dev).toBeCloseTo(-0.0609, 4);
    expect(s.runnerUp.entry.id).toBe('titan');
    expect(s.closeBelow).toBeNull();
  });

  it('uten varmetap blir likevekten 27,7 °C, og 6,1 % av energien gikk tapt', () => {
    expect(s.CMetal).toBeCloseTo(225, 10);
    expect(s.TIdeal).toBeCloseTo(27.726, 3);
    expect(s.QMetal).toBeCloseTo(16380, 6);
    expect(s.QLoss).toBeCloseTo(997.6, 6);
    expect(s.lossFrac).toBeCloseTo(0.0609, 4);
  });
});

describe('kalorimeter: tallsett 2 (jern) og 3 (bly)', () => {
  it('jern: c = 429 J/(kg·K), kobber er nest nærmest og ligger under målingen', () => {
    const s = solveCalorimeterTask(CALORIMETER_TASKS[1]!);
    expect(s.c).toBeCloseTo(429.09, 2);
    expect(s.cRounded).toBe(430);
    expect(s.best.entry.id).toBe('jern');
    expect(s.runnerUp.entry.id).toBe('kobber');
    expect(s.closeBelow?.entry.id).toBe('kobber');
    expect(s.TIdeal).toBeCloseTo(24.974, 3);
    expect(s.lossFrac).toBeCloseTo(0.0465, 4);
  });

  it('bly: c = 121 J/(kg·K), omtrent 120', () => {
    const s = solveCalorimeterTask(CALORIMETER_TASKS[2]!);
    expect(s.c).toBeCloseTo(121.16, 2);
    expect(s.cRounded).toBe(120);
    expect(s.best.entry.id).toBe('bly');
    expect(s.closeBelow).toBeNull();
    expect(s.TIdeal).toBeCloseTo(22.254, 3);
    expect(s.lossFrac).toBeCloseTo(0.068, 4);
  });
});

describe('kalorimeter: alle tallsettene gir fornuftige svar', () => {
  for (const [i, task] of CALORIMETER_TASKS.entries()) {
    const s = solveCalorimeterTask(task);
    const name = `tallsett ${i + 1} (${task.metal})`;

    it(`${name}: metallet i tabellen er det biten faktisk er laget av`, () => {
      expect(s.best.entry.id).toBe(task.metal);
      expect(s.cTable).toBe(metalEntry(task.metal).c);
    });

    it(`${name}: målingen er 4–8 % for lav, som i et ekte forsøk med litt varmetap`, () => {
      expect(s.c).toBeLessThan(s.cTable);
      expect(s.lossFrac).toBeGreaterThan(0.04);
      expect(s.lossFrac).toBeLessThan(0.08);
      // Avviket i c er det samme som andelen som gikk tapt.
      expect(s.lossFrac).toBeCloseTo(1 - s.c / s.cTable, 12);
      expect(-s.best.dev).toBeCloseTo(s.lossFrac, 12);
    });

    it(`${name}: det nest nærmeste metallet er tydelig lenger unna`, () => {
      expect(Math.abs(s.runnerUp.dev)).toBeGreaterThan(Math.abs(s.best.dev) + 0.03);
    });

    it(`${name}: energibevaring og temperaturene henger sammen`, () => {
      // Uten tap: avgitt = mottatt med den målte c.
      expect(s.c * task.mMetal * s.dTMetal).toBeCloseTo(s.Qw, 8);
      // Med tabellverdien: avgitt = mottatt + tap.
      expect(s.QMetal).toBeCloseTo(s.Qw + s.QLoss, 8);
      expect(s.QLoss).toBeGreaterThan(0);
      // Likevekten uten tap ligger mellom start og slutt, og over den målte (energien som gikk tapt, mangler).
      expect(s.TIdeal).toBeGreaterThan(task.TEnd);
      expect(s.TIdeal).toBeLessThan(task.TMetal);
      expect(s.TIdeal - task.TEnd).toBeLessThan(1.2);
      // Den ideelle likevekten oppfyller energibevaringen, og vannet ville fått mer energi enn det fikk.
      expect(s.CMetal * (task.TMetal - s.TIdeal)).toBeCloseTo(s.CWater * (s.TIdeal - task.TWater), 8);
      expect(s.QIdeal).toBeCloseTo(s.CWater * (s.TIdeal - task.TWater), 8);
      expect(s.QIdeal).toBeGreaterThan(s.Qw);
      expect(s.QIdeal).toBeLessThan(s.QMetal);
      // Vannet blir 5–10 °C varmere: lett å lese av på et termometer.
      expect(s.dTWater).toBeGreaterThan(5);
      expect(s.dTWater).toBeLessThan(10);
      expect(task.TMetal).toBe(100);
    });

    it(`${name}: «Vis at»-verdien ligger innenfor avrundingen av c`, () => {
      expect(Math.abs(s.cRounded - s.c) / s.c).toBeLessThan(0.05);
      expect(roundSig(s.c, 2)).toBe(s.cRounded);
    });

    it(`${name}: vannet dekker metallbiten i kalorimeteret, og biten får plass`, () => {
      const { level, block } = calorimeterFill(task);
      expect(level).toBeGreaterThan(block.h + 0.7);
      expect(level).toBeLessThan(CALORIMETER.innerH - 2);
      expect(block.d).toBeLessThan(2 * CALORIMETER.innerR - 4);
    });
  }
});

describe('kalorimeter: hjelpefunksjonene', () => {
  it('roundSig avrunder til gjeldende siffer', () => {
    expect(roundSig(843.2, 2)).toBe(840);
    expect(roundSig(845.19, 2)).toBe(850);
    expect(roundSig(120.97, 2)).toBe(120);
    expect(roundSig(0.04647, 2)).toBeCloseTo(0.046, 12);
    expect(roundSig(0, 2)).toBe(0);
  });

  it('likevekt: like varmekapasiteter gir gjennomsnittet, og stor C trekker mot sin egen temperatur', () => {
    expect(equilibriumTemp(1000, 80, 1000, 20)).toBeCloseTo(50, 12);
    expect(equilibriumTemp(1e9, 80, 1, 20)).toBeCloseTo(80, 6);
    expect(Number.isNaN(equilibriumTemp(0, 80, 0, 20))).toBe(true);
  });

  it('blockSize gir riktig volum og h = 0,75 · d', () => {
    const b = blockSize(0.27, 2700);
    expect(b.V).toBeCloseTo(100, 10);
    expect(b.h).toBeCloseTo(0.75 * b.d, 12);
    expect((Math.PI * b.d * b.d * b.h) / 4).toBeCloseTo(100, 8);
    expect(blockSize(0, 2700).d).toBe(0);
  });

  it('tabellen er sortert etter c, og vann har mye større c enn alle metallene', () => {
    for (let i = 1; i < METAL_TABLE.length; i++) expect(METAL_TABLE[i]!.c).toBeLessThan(METAL_TABLE[i - 1]!.c);
    expect(C_WATER).toBeGreaterThan(4 * METAL_TABLE[0]!.c);
  });

  it('uten temperaturfall i metallet blir c ugyldig (ingen deling på null)', () => {
    const bad: CalorimeterTask = { metal: 'jern', mMetal: 0.5, mWater: 0.4, TWater: 20, TMetal: 100, TEnd: 100 };
    expect(Number.isNaN(solveCalorimeterTask(bad).c)).toBe(true);
  });
});
