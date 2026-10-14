import { describe, expect, it } from 'vitest';
import {
  grenseDyp,
  gVed,
  isostatiskNedsynking,
  JORDAS_LAG,
  jordasMasse,
  JORDRADIUS,
  lagVed,
  MOHO,
  temperaturVed,
  TETTHETER,
  tetthetVed,
  trykkVed,
  vpVed,
  vsVed,
} from './jorda';

describe('jordas lag', () => {
  it('begge inndelingene er sammenhengende fra overflaten til sentrum', () => {
    for (const lag of [JORDAS_LAG.kjemisk, JORDAS_LAG.mekanisk]) {
      expect(lag[0]!.topp).toBe(0);
      expect(lag.at(-1)!.bunn).toBe(JORDRADIUS);
      for (let i = 1; i < lag.length; i++) expect(lag[i]!.topp).toBe(lag[i - 1]!.bunn);
      for (const l of lag) expect(l.bunn).toBeGreaterThan(l.topp);
    }
  });

  it('har nedre mantel, flytende ytre kjerne og kjernegrensen på 2891 km', () => {
    expect(JORDAS_LAG.kjemisk.map((l) => l.id)).toContain('nedreMantel');
    expect(JORDAS_LAG.mekanisk.map((l) => l.id)).toEqual(['litosfare', 'astenosfare', 'nedreMantel', 'ytreKjerne', 'indreKjerne']);
    expect(lagVed(3000)?.tilstand).toBe('flytende');
    expect(lagVed(6000)?.tilstand).toBe('fast');
    expect(lagVed(2891)?.id).toBe('ytreKjerne');
    expect(lagVed(2890.9)?.id).toBe('nedreMantel');
  });

  it('slår opp lag i begge inndelinger', () => {
    expect(lagVed(10)?.id).toBe('skorpe');
    expect(lagVed(10, 'mekanisk')?.id).toBe('litosfare');
    expect(lagVed(200, 'mekanisk')?.id).toBe('astenosfare');
    expect(lagVed(200)?.id).toBe('ovreMantel');
    expect(lagVed(JORDRADIUS)?.id).toBe('indreKjerne');
    expect(lagVed(-1)).toBeNull();
    expect(lagVed(7000)).toBeNull();
    expect(lagVed(Number.NaN)).toBeNull();
  });
});

describe('forenklet PREM', () => {
  it('kjente verdier fra PREM (Dziewonski og Anderson 1981)', () => {
    // Sentrum
    expect(tetthetVed(JORDRADIUS)).toBeCloseTo(13.09, 2);
    expect(vpVed(JORDRADIUS)).toBeCloseTo(11.26, 2);
    // Kjerne–mantel-grensen: mantelen over, kjernen under
    expect(tetthetVed(2890.99)).toBeCloseTo(5.57, 2);
    expect(tetthetVed(2891)).toBeCloseTo(9.9, 1);
    expect(vpVed(2890.99)).toBeCloseTo(13.72, 2);
    expect(vpVed(2891)).toBeCloseTo(8.06, 2);
    expect(vsVed(2890.99)).toBeCloseTo(7.26, 2);
    // Den indre kjernen er fast
    expect(vsVed(5200)).toBeGreaterThan(3.4);
    // Like under Moho
    expect(tetthetVed(MOHO.kontinent)).toBeCloseTo(3.38, 1);
    expect(vpVed(MOHO.kontinent)).toBeCloseTo(8.1, 1);
  });

  it('S-bølger går ikke gjennom den flytende ytre kjernen', () => {
    for (const d of [2891, 3500, 4500, 5100]) expect(vsVed(d)).toBe(0);
    for (const d of [0, 100, 1000, 2800, 5200, 6371]) expect(vsVed(d)).toBeGreaterThan(0);
  });

  it('tettheten øker innover og spranget er størst ved kjernen', () => {
    let forrige = 0;
    for (let d = 0; d <= JORDRADIUS; d += 25) {
      const rho = tetthetVed(d)!;
      // I PREM avtar tettheten litt fra Moho ned til 220 km (3,38 → 3,36, varmere mantel)
      expect(rho).toBeGreaterThanOrEqual(forrige - (d <= 220 ? 0.03 : 1e-9));
      forrige = rho;
    }
    expect(tetthetVed(2891)! - tetthetVed(2890.99)!).toBeGreaterThan(4);
  });

  it('skorpa: kontinent eller havbunn', () => {
    expect(tetthetVed(10)).toBe(TETTHETER.skorpeKontinent);
    expect(tetthetVed(10, 'hav')).toBeGreaterThan(3.3);
    expect(tetthetVed(5, 'hav')).toBe(TETTHETER.skorpeHav);
    expect(grenseDyp('hav')[0]).toBe(MOHO.hav);
    expect(grenseDyp()).toContain(2891);
    expect(grenseDyp()).toContain(670);
  });

  it('gir null utenfor jorda', () => {
    expect(tetthetVed(-1)).toBeNull();
    expect(vpVed(6372)).toBeNull();
    expect(vsVed(Number.NaN)).toBeNull();
    expect(gVed(Number.POSITIVE_INFINITY)).toBeNull();
    expect(trykkVed(-0.1)).toBeNull();
    expect(temperaturVed(1e5)).toBeNull();
  });
});

describe('masse, tyngde og trykk', () => {
  it('jordas masse er omtrent 5,97 · 10²⁴ kg', () => {
    expect(jordasMasse() / 5.972e24).toBeCloseTo(1, 2);
    expect(jordasMasse('hav') / 5.972e24).toBeCloseTo(1, 2);
  });

  it('g er 9,8 ved overflaten, størst ved kjernen og 0 i sentrum', () => {
    expect(gVed(0)).toBeCloseTo(9.82, 1);
    expect(gVed(2891)).toBeCloseTo(10.68, 1);
    expect(gVed(JORDRADIUS)).toBe(0);
    let maks = 0;
    let maksDyp = 0;
    for (let d = 0; d <= JORDRADIUS; d += 10) {
      const g = gVed(d)!;
      if (g > maks) {
        maks = g;
        maksDyp = d;
      }
    }
    expect(Math.abs(maksDyp - 2891)).toBeLessThan(50);
  });

  it('trykket stemmer med PREM innenfor 2 %', () => {
    expect(trykkVed(0)).toBe(0);
    expect(trykkVed(2891)! / 135.8).toBeCloseTo(1, 1);
    expect(Math.abs(trykkVed(2891)! / 135.8 - 1)).toBeLessThan(0.02);
    expect(Math.abs(trykkVed(5149.5)! / 328.9 - 1)).toBeLessThan(0.02);
    expect(Math.abs(trykkVed(JORDRADIUS)! / 363.9 - 1)).toBeLessThan(0.02);
    // Omtrent 1 GPa per 30 km i skorpa
    expect(trykkVed(30)).toBeGreaterThan(0.7);
    expect(trykkVed(30)).toBeLessThan(0.9);
  });

  it('trykket øker hele veien inn', () => {
    let forrige = -1;
    for (let d = 0; d <= JORDRADIUS; d += 50) {
      const p = trykkVed(d)!;
      expect(p).toBeGreaterThan(forrige);
      forrige = p;
    }
  });
});

describe('temperatur', () => {
  it('øker innover med kjente omtrentlige punkter', () => {
    expect(temperaturVed(0)).toBe(10);
    expect(temperaturVed(100)).toBe(1300);
    expect(temperaturVed(2891)).toBe(3700);
    expect(temperaturVed(JORDRADIUS)).toBe(5500);
    let forrige = -Infinity;
    for (let d = 0; d <= JORDRADIUS; d += 20) {
      const t = temperaturVed(d)!;
      expect(t).toBeGreaterThan(forrige);
      forrige = t;
    }
  });

  it('gradienten i skorpa er omtrent 15–30 °C per km', () => {
    const grad = (temperaturVed(10)! - temperaturVed(0)!) / 10;
    expect(grad).toBeGreaterThan(10);
    expect(grad).toBeLessThan(30);
  });
});

describe('tettheter og isostasi', () => {
  it('is flyter på vann, skorpa flyter på mantelen', () => {
    expect(TETTHETER.is).toBeLessThan(TETTHETER.vann);
    expect(TETTHETER.vann).toBeLessThan(TETTHETER.sjovann);
    expect(TETTHETER.skorpeKontinent).toBeLessThan(TETTHETER.skorpeHav);
    expect(TETTHETER.skorpeHav).toBeLessThan(TETTHETER.mantel);
  });

  it('3000 m is trykker skorpa ned omtrent 830 m', () => {
    expect(isostatiskNedsynking(3000)).toBeCloseTo(833.6, 0);
    expect(isostatiskNedsynking(0)).toBe(0);
    expect(isostatiskNedsynking(-1)).toBeNull();
    expect(isostatiskNedsynking(1000, 1, 0)).toBeNull();
    expect(isostatiskNedsynking(Number.NaN)).toBeNull();
  });
});
