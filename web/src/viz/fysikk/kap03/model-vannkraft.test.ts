import { describe, expect, it } from 'vitest';
import {
  ETA_MAX,
  ETA_MIN,
  FLOW_STEPS,
  HEAD_STEPS,
  HOUSEHOLD_POWER,
  PHONE_CHARGE_J,
  PRESETS,
  decimalsFor,
  hydroPower,
  matchPreset,
  nearestIndex,
  niceSteps,
  pictogramUnit,
  plantSize,
  roundSig,
  settlementName,
  stepDecimals,
  volumeComparison,
  withPrefix,
} from './model-vannkraft';

const close = (a: number, b: number, rel = 1e-9) => expect(Math.abs(a - b)).toBeLessThanOrEqual(rel * Math.max(1, Math.abs(b)));

describe('effekten P = η·ρ·g·Q·h', () => {
  it('regner ut et kjent eksempel for hånd', () => {
    // 2,5 m³/s faller 200 m: 2 500 kg/s · 9,81 m/s² · 200 m = 4 905 000 W, og 85 % av det er 4 169 250 W.
    const r = hydroPower({ h: 200, Q: 2.5, eta: 0.85 });
    close(r.massPerSecond, 2500);
    close(r.inputPower, 4.905e6);
    close(r.power, 4169250);
    close(r.loss, 735750);
    close(r.energyPerKg, 1962);
    close(r.electricPerLitre, 0.85 * 1962);
  });

  it('er proporsjonal med fallhøyden, vannføringen og virkningsgraden', () => {
    const base = hydroPower({ h: 100, Q: 4, eta: 0.8 }).power;
    close(hydroPower({ h: 200, Q: 4, eta: 0.8 }).power, 2 * base);
    close(hydroPower({ h: 100, Q: 8, eta: 0.8 }).power, 2 * base);
    close(hydroPower({ h: 100, Q: 4, eta: 0.4 }).power, base / 2);
    // Halv fallhøyde og dobbel vannføring gir samme effekt
    close(hydroPower({ h: 50, Q: 8, eta: 0.8 }).power, base);
  });

  it('bevarer energien: elektrisk effekt + tap = tilført effekt', () => {
    for (const h of [5, 40, 600, 1000]) {
      for (const Q of [0.01, 2.5, 300]) {
        for (const eta of [ETA_MIN, 0.85, ETA_MAX]) {
          const r = hydroPower({ h, Q, eta });
          close(r.power + r.loss, r.inputPower);
          expect(r.loss).toBeGreaterThan(0);
          close(r.power / r.inputPower, eta);
        }
      }
    }
  });

  it('gir null effekt uten fall eller uten vann, og ingen NaN', () => {
    for (const p of [
      { h: 0, Q: 10, eta: 0.9 },
      { h: 100, Q: 0, eta: 0.9 },
      { h: -5, Q: -1, eta: 2 },
    ]) {
      const r = hydroPower(p);
      expect(r.power).toBe(0);
      expect(r.households).toBe(0);
      expect(Number.isNaN(r.freeFallSpeed)).toBe(false);
      // Energien per liter avhenger bare av fallhøyden: uten fall kan ingen mengde vann lade mobilen
      expect(Number.isFinite(r.litresPerPhone)).toBe(p.h > 0);
    }
  });

  it('gir farten i fritt fall fra energibevaring, v = √(2gh)', () => {
    const r = hydroPower({ h: 200, Q: 1, eta: 0.9 });
    close(r.freeFallSpeed, Math.sqrt(2 * 9.81 * 200));
    // ½mv² = mgh for én kilo vann
    close(0.5 * r.freeFallSpeed ** 2, r.energyPerKg);
  });

  it('regner om til husstander og årsproduksjon', () => {
    // 16 000 kWh i året er 1 826,5 W i snitt
    close(HOUSEHOLD_POWER, 16e6 / 8760);
    const r = hydroPower({ h: 200, Q: 2.5, eta: 0.85 });
    close(r.households, 4169250 / HOUSEHOLD_POWER);
    expect(Math.round(r.households)).toBe(2283);
    // Årsproduksjonen delt på forbruket til én husstand gir det samme tallet
    close(r.energyPerYearKWh / 16000, r.households);
  });

  it('regner ut hvor mye vann som må gjennom turbinen for å lade en mobil', () => {
    const r = hydroPower({ h: 100, Q: 1, eta: 0.9 });
    // Én liter gir 0,9 · 9,81 · 100 = 882,9 J, og en mobil trenger 54 000 J
    close(r.litresPerPhone, PHONE_CHARGE_J / 882.9);
    expect(r.litresPerPhone).toBeGreaterThan(60);
    expect(r.litresPerPhone).toBeLessThan(62);
  });
});

describe('forhåndsvalgene', () => {
  it('ligger på glidebryterne', () => {
    for (const p of PRESETS) {
      expect(HEAD_STEPS).toContain(p.h);
      expect(FLOW_STEPS).toContain(p.Q);
      expect(p.eta).toBeGreaterThanOrEqual(ETA_MIN);
      expect(p.eta).toBeLessThanOrEqual(ETA_MAX);
      // Virkningsgraden er et helt antall prosent (glidebryteren går i hele prosent)
      expect(Math.abs(p.eta * 100 - Math.round(p.eta * 100))).toBeLessThan(1e-9);
      expect(matchPreset(p)).toBe(p.id);
    }
  });

  it('gir fornuftige størrelser og husstander', () => {
    const r = Object.fromEntries(PRESETS.map((p) => [p.id, hydroPower(p)]));
    expect(plantSize(r.hytte!.power)).toBe('mikro');
    expect(plantSize(r.smaa!.power)).toBe('smaa');
    expect(plantSize(r.elv!.power)).toBe('stort');
    expect(plantSize(r.fjell!.power)).toBe('stort');
    // Hytta: noen få kW, nok til et par husstander. Fjellkraftverket: hundrevis av MW.
    expect(r.hytte!.power).toBeGreaterThan(3e3);
    expect(r.hytte!.power).toBeLessThan(10e3);
    expect(r.fjell!.power).toBeGreaterThan(200e6);
    expect(r.fjell!.power).toBeLessThan(400e6);
    // Elvekraftverket har lav fallhøyde, men så mye vann at det gir mer enn småkraftverket
    expect(r.elv!.power).toBeGreaterThan(r.smaa!.power);
  });

  it('kjenner ikke igjen andre tall', () => {
    expect(matchPreset({ h: 200, Q: 2.5, eta: 0.84 })).toBeNull();
    expect(matchPreset({ h: 250, Q: 2.5, eta: 0.85 })).toBeNull();
  });
});

describe('glidebryterne', () => {
  it('har pene, stigende tall fra minst til størst', () => {
    expect(HEAD_STEPS[0]).toBe(5);
    expect(HEAD_STEPS[HEAD_STEPS.length - 1]).toBe(1000);
    expect(FLOW_STEPS[0]).toBe(0.01);
    expect(FLOW_STEPS[FLOW_STEPS.length - 1]).toBe(300);
    for (const list of [HEAD_STEPS, FLOW_STEPS]) {
      for (let i = 1; i < list.length; i++) expect(list[i]!).toBeGreaterThan(list[i - 1]!);
    }
    expect(niceSteps(1, 10)).toEqual([1, 1.2, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10]);
    expect(niceSteps(0, 10)).toEqual([]);
  });

  it('har dobbelt så store tall å gå til (for å se at P dobles)', () => {
    for (const [a, b] of [
      [100, 200],
      [20, 40],
      [300, 600],
    ])
      expect(HEAD_STEPS.includes(a!) && HEAD_STEPS.includes(b!)).toBe(true);
    for (const [a, b] of [
      [2.5, 5],
      [25, 50],
      [0.01, 0.02],
    ])
      expect(FLOW_STEPS.includes(a!) && FLOW_STEPS.includes(b!)).toBe(true);
  });

  it('finner nærmeste trinn', () => {
    expect(HEAD_STEPS[nearestIndex(HEAD_STEPS, 200)]).toBe(200);
    expect(HEAD_STEPS[nearestIndex(HEAD_STEPS, 210)]).toBe(200);
    expect(FLOW_STEPS[nearestIndex(FLOW_STEPS, 0.0105)]).toBe(0.01);
    expect(FLOW_STEPS[nearestIndex(FLOW_STEPS, 1e6)]).toBe(300);
  });

  it('viser tallene nøyaktig med få desimaler', () => {
    expect(stepDecimals(0.012)).toBe(3);
    expect(stepDecimals(0.01)).toBe(2);
    expect(stepDecimals(0.25)).toBe(2);
    expect(stepDecimals(2.5)).toBe(1);
    expect(stepDecimals(40)).toBe(0);
    for (const q of FLOW_STEPS) {
      const d = stepDecimals(q);
      expect(Math.abs(Number(q.toFixed(d)) - q)).toBeLessThan(1e-12);
    }
  });
});

describe('tall med prefiks og gjeldende siffer', () => {
  it('runder av til tre gjeldende siffer', () => {
    expect(roundSig(145016)).toBe(145000);
    expect(roundSig(4.16925)).toBe(4.17);
    expect(roundSig(0.0123456)).toBe(0.0123);
    expect(roundSig(0)).toBe(0);
    expect(decimalsFor(4.17)).toBe(2);
    expect(decimalsFor(44.1)).toBe(1);
    expect(decimalsFor(265)).toBe(0);
    expect(decimalsFor(0.107)).toBe(3);
  });

  it('velger prefiks etter avrundingen', () => {
    expect(withPrefix(264.87e6, 'W')).toEqual({ value: 265, unit: 'MW', decimals: 0 });
    expect(withPrefix(4169250, 'W')).toEqual({ value: 4.17, unit: 'MW', decimals: 2 });
    expect(withPrefix(5494, 'W')).toEqual({ value: 5.49, unit: 'kW', decimals: 2 });
    expect(withPrefix(196.2, 'W')).toEqual({ value: 196, unit: 'W', decimals: 0 });
    expect(withPrefix(2.796e9, 'W')).toEqual({ value: 2.8, unit: 'GW', decimals: 2 });
    // 999 600 W rundes til 1,00 MW, ikke 1 000 kW
    expect(withPrefix(999600, 'W')).toEqual({ value: 1, unit: 'MW', decimals: 2 });
    expect(withPrefix(36.5e9, 'Wh')).toEqual({ value: 36.5, unit: 'GWh', decimals: 1 });
    expect(withPrefix(24.5e12, 'Wh')).toEqual({ value: 24.5, unit: 'TWh', decimals: 1 });
    expect(withPrefix(0, 'W')).toEqual({ value: 0, unit: 'W', decimals: 0 });
  });
});

describe('sammenligninger', () => {
  it('sammenligner vannmengden med bøtter, badekar og et basseng', () => {
    expect(volumeComparison(0.02)).toEqual({ kind: 'botter', count: 2 });
    const tub = volumeComparison(2.5);
    expect(tub.kind).toBe('badekar');
    if (tub.kind === 'badekar') close(tub.count, 2.5 / 0.15);
    const pool = volumeComparison(250);
    expect(pool).toEqual({ kind: 'basseng', seconds: 2 });
    expect(volumeComparison(15).kind).toBe('basseng');
    expect(volumeComparison(14.9).kind).toBe('badekar');
  });

  it('har en enhet i bildediagrammet som gir høyst 20 hus', () => {
    expect(pictogramUnit(3)).toBe(1);
    expect(pictogramUnit(0.1)).toBe(1);
    expect(pictogramUnit(2283)).toBe(200);
    expect(pictogramUnit(145000)).toBe(10000);
    for (const p of PRESETS) {
      const n = hydroPower(p).households;
      expect(n / pictogramUnit(n)).toBeLessThanOrEqual(20);
    }
    for (let n = 0.5; n < 3e6; n *= 1.37) {
      const u = pictogramUnit(n);
      expect(n / u).toBeLessThanOrEqual(20 + 1e-9);
      // Ikke for grovt: minst 4 hus når det er mer enn 20 husstander
      if (n > 20) expect(n / u).toBeGreaterThanOrEqual(4);
    }
  });

  it('beskriver hvor mange husstander det er', () => {
    expect(settlementName(0.5)).toMatch(/mindre enn/);
    expect(settlementName(3)).toBe('noen få hus');
    expect(settlementName(2283)).toBe('en småby');
    expect(settlementName(145000)).toBe('en by');
  });

  it('dekker hele området til glidebryterne uten NaN', () => {
    for (const h of [HEAD_STEPS[0]!, HEAD_STEPS[HEAD_STEPS.length - 1]!]) {
      for (const Q of [FLOW_STEPS[0]!, FLOW_STEPS[FLOW_STEPS.length - 1]!]) {
        for (const eta of [ETA_MIN, ETA_MAX]) {
          const r = hydroPower({ h, Q, eta });
          for (const v of Object.values(r)) expect(Number.isFinite(v)).toBe(true);
          const p = withPrefix(r.power, 'W');
          expect(Number.isFinite(p.value)).toBe(true);
        }
      }
    }
  });
});
