import { describe, expect, it } from 'vitest';
import {
  DEKK,
  KELVIN,
  P0_BAR,
  absoluteAt,
  absolutePressure,
  celsiusLineAt,
  driveProgress,
  gaugeLineWrongAt,
  gaugePressure,
  isochoricPressure,
  predictTyre,
  solveTyre,
  toKelvin,
  tyreAirTemperature,
  zeroGaugeTemperature,
} from './model-dekktrykk';

/** Alle tallene glidebryterne kan gi (i hele steg). */
function grid(min: number, max: number, step: number): number[] {
  const out: number[] = [];
  for (let v = min; v <= max + 1e-9; v += step) out.push(Math.round(v * 1000) / 1000);
  return out;
}
const FILLS = grid(DEKK.fill.min, DEKK.fill.max, DEKK.fill.step);
const GARAGES = grid(DEKK.garage.min, DEKK.garage.max, DEKK.garage.step);
const OUTSIDES = grid(DEKK.outside.min, DEKK.outside.max, DEKK.outside.step);

describe('kelvin og trykk', () => {
  it('regner om mellom celsius og kelvin', () => {
    expect(toKelvin(20)).toBeCloseTo(293.15, 10);
    expect(toKelvin(-15)).toBeCloseTo(258.15, 10);
    expect(toKelvin(-KELVIN)).toBe(0);
  });

  it('absolutt trykk = manometertrykk + lufttrykk, og tilbake', () => {
    expect(absolutePressure(2.5)).toBeCloseTo(3.513, 10);
    expect(gaugePressure(3.513)).toBeCloseTo(2.5, 10);
    expect(gaugePressure(P0_BAR)).toBe(0);
    expect(P0_BAR * 100).toBeCloseTo(101.3, 10); // 101,3 kPa
  });

  it('p₂ = p₁ · T₂/T₁ ved fast volum, og p/T er konstant', () => {
    expect(isochoricPressure(3, 300, 150)).toBeCloseTo(1.5, 12);
    expect(isochoricPressure(3, 300, 300)).toBe(3);
    expect(isochoricPressure(3, 300, 0)).toBe(0);
    expect(isochoricPressure(3, 0, 300)).toBeNaN();
    expect(isochoricPressure(3, 300, -1)).toBeNaN();
  });
});

describe('dekket fra 20 °C til −15 °C (standardverdiene)', () => {
  const s = solveTyre(2.5, 20, -15);

  it('gir kjente tall', () => {
    expect(s.T1).toBeCloseTo(293.15, 10);
    expect(s.T2).toBeCloseTo(258.15, 10);
    expect(s.p1).toBeCloseTo(3.513, 10);
    // 3,513 · 258,15 / 293,15 = 3,0936 bar
    expect(s.p2).toBeCloseTo(3.09357, 4);
    expect(s.pm2).toBeCloseTo(2.08057, 4);
    expect(s.drop).toBeCloseTo(0.41943, 4);
    // Ca. 0,012 bar per grad: omtrent 0,1 bar for hver 8. grad
    expect(s.perKelvin).toBeCloseTo(0.011984, 5);
  });

  it('fallet er likt for absolutt trykk og manometertrykk, men en større andel av det måleren viser', () => {
    expect(s.p1 - s.p2).toBeCloseTo(s.pm1 - s.pm2, 12);
    expect(s.dropShareAbsolute).toBeCloseTo(35 / 293.15, 10);
    expect(s.dropShareGauge).toBeCloseTo(0.41943 / 2.5, 4);
    expect(s.dropShareGauge).toBeGreaterThan(s.dropShareAbsolute);
  });

  it('fallet er proporsjonalt med temperaturendringen i kelvin', () => {
    expect(s.drop).toBeCloseTo(s.perKelvin * (s.T1 - s.T2), 12);
  });
});

describe('alle glidebryterverdiene', () => {
  it('gir p/T konstant, positivt trykk og en viser innenfor skalaen', () => {
    for (const pm1 of FILLS)
      for (const t1 of GARAGES)
        for (const t2 of OUTSIDES) {
          const s = solveTyre(pm1, t1, t2);
          expect(s.p2 / s.T2).toBeCloseTo(s.p1 / s.T1, 12);
          expect(s.p2).toBeGreaterThan(0);
          expect(s.pm2).toBeGreaterThan(0.5);
          expect(s.pm2).toBeLessThan(DEKK.gaugeMax);
          // Kaldere gir lavere trykk, varmere høyere, lik temperatur ingen endring
          expect(Math.sign(Math.round(s.drop * 1e9)) + 0).toBe(Math.sign(t1 - t2) + 0);
        }
  });

  it('manometerfeilen gir alltid for lite endring, celsiusfeilen er umulig under 0 °C', () => {
    for (const pm1 of FILLS)
      for (const t1 of GARAGES)
        for (const t2 of OUTSIDES) {
          const s = solveTyre(pm1, t1, t2);
          const m = predictTyre('manometer', pm1, t1, t2);
          expect(Math.abs(m.drop)).toBeLessThanOrEqual(Math.abs(s.drop) + 1e-12);
          expect(m.impossible).toBe(false);
          const c = predictTyre('celsius', pm1, t1, t2);
          expect(c.impossible).toBe(t2 < 0);
          expect(Number.isFinite(c.p2)).toBe(true);
          const r = predictTyre('riktig', pm1, t1, t2);
          expect(r.error).toBe(0);
          expect(r.pm2).toBe(s.pm2);
        }
  });
});

describe('vanlige feil', () => {
  it('celsius: 3,513 bar · (−15)/20 gir negativt absolutt trykk', () => {
    const c = predictTyre('celsius', 2.5, 20, -15);
    expect(c.p2).toBeCloseTo(-2.63475, 5);
    expect(c.pm2).toBeCloseTo(-3.64775, 5);
    expect(c.impossible).toBe(true);
    // Ved 0 °C sier celsius-regningen at dekket er helt tomt for luft
    expect(predictTyre('celsius', 2.5, 20, 0).p2).toBe(0);
    // Ved 30 °C sier den at trykket øker med 50 %
    expect(predictTyre('celsius', 2.5, 20, 30).p2).toBeCloseTo(3.513 * 1.5, 10);
    // Deler aldri på null uten å si fra
    expect(predictTyre('celsius', 2.5, 0, -15).impossible).toBe(true);
  });

  it('manometertrykket i forholdet gir for lite fall (2,20 bar i stedet for 2,08 bar)', () => {
    const m = predictTyre('manometer', 2.5, 20, -15);
    expect(m.pm2).toBeCloseTo(2.5 * (258.15 / 293.15), 10);
    expect(m.pm2).toBeCloseTo(2.2015, 4);
    expect(m.error).toBeCloseTo(2.2015 - 2.08057, 3);
    expect(m.drop).toBeCloseTo(0.2985, 3);
    expect(m.p2).toBeCloseTo(m.pm2 + P0_BAR, 12);
  });
});

describe('linjene i grafen', () => {
  const s = solveTyre(2.5, 20, -15);

  it('absolutt trykk går gjennom de to tilstandene og er null ved 0 K', () => {
    expect(absoluteAt(s, 20)).toBeCloseTo(s.p1, 12);
    expect(absoluteAt(s, -15)).toBeCloseTo(s.p2, 12);
    expect(absoluteAt(s, -KELVIN)).toBeCloseTo(0, 12);
  });

  it('celsius-linja går gjennom (0 °C, 0) og fyllingen', () => {
    expect(celsiusLineAt(s, 0)).toBe(0);
    expect(celsiusLineAt(s, 20)).toBeCloseTo(s.p1, 12);
    expect(celsiusLineAt({ p1: 3, t1: 0 }, 5)).toBeNaN();
  });

  it('manometerlinja (feil) går gjennom fyllingen og er null ved 0 K', () => {
    expect(gaugeLineWrongAt(s, 20)).toBeCloseTo(2.5, 12);
    expect(gaugeLineWrongAt(s, -KELVIN)).toBeCloseTo(0, 12);
  });

  it('måleren viser 0 når det absolutte trykket er lik lufttrykket (rundt −189 °C)', () => {
    const t0 = zeroGaugeTemperature(s);
    expect(absoluteAt(s, t0)).toBeCloseTo(P0_BAR, 12);
    expect(t0).toBeCloseTo(-188.62, 1);
  });
});

describe('avkjøling og animasjon', () => {
  it('lufta i dekket starter på garasjetemperaturen og ender på utetemperaturen', () => {
    expect(tyreAirTemperature(20, -15, 0)).toBe(20);
    expect(tyreAirTemperature(20, -15, -1)).toBe(20);
    // Nøyaktig utetemperaturen ved slutten, så formelen viser −15 °C og 258,15 K
    expect(tyreAirTemperature(20, -15, DEKK.hours.max)).toBe(-15);
    expect(tyreAirTemperature(20, -15, DEKK.hours.max + 1)).toBe(-15);
    // Etter én tidskonstant er ca. 63 % av forskjellen borte (justeringen er under 0,2 %)
    expect(tyreAirTemperature(20, -15, DEKK.tau)).toBeCloseTo(-15 + 35 / Math.E, 1);
    // Kontinuerlig inn mot slutten
    expect(Math.abs(tyreAirTemperature(20, -15, DEKK.hours.max - 1e-6) - -15)).toBeLessThan(1e-4);
  });

  it('avkjølingen går hele tiden mot utetemperaturen, aldri forbi', () => {
    let prev = tyreAirTemperature(20, -15, 0);
    for (let h = 0.05; h < DEKK.hours.max - 1e-6; h += 0.05) {
      const t = tyreAirTemperature(20, -15, h);
      expect(t).toBeLessThan(prev);
      expect(t).toBeGreaterThan(-15);
      prev = t;
    }
    // Varmere ute: stiger i stedet
    expect(tyreAirTemperature(15, 30, 1)).toBeGreaterThan(15);
    expect(tyreAirTemperature(15, 30, 1)).toBeLessThan(30);
  });

  it('bilen ruller ut av garasjen med myk start og stopp', () => {
    expect(driveProgress(0)).toBe(0);
    expect(driveProgress(DEKK.drive / 2)).toBeCloseTo(0.5, 12);
    expect(driveProgress(DEKK.drive)).toBe(1);
    expect(driveProgress(3)).toBe(1);
    let prev = 0;
    for (let h = 0.005; h < DEKK.drive; h += 0.005) {
      const p = driveProgress(h);
      expect(p).toBeGreaterThan(prev);
      prev = p;
    }
  });
});
