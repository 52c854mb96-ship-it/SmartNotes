import { describe, expect, it } from 'vitest';
import { GAS_N, PISTON_AREA, gasPressure } from './model';
import {
  MANOMETER_MAX,
  PX_PER_M,
  T_MAX,
  T_REF,
  V_MAX,
  V_MIN,
  V_REF,
  boreRadius,
  cylinderAt,
  forceArrowLength,
  frontArcDepth,
  frostAmount,
  gasColumnHeight,
  gasWarmth,
  gaugeAngle,
  maxForceAt,
  particlePoint,
  pistonForce,
  plateEffect,
  sceneLayout,
} from './gassmodell-scene';

const volumes = Array.from({ length: Math.round((V_MAX - V_MIN) / 0.05) + 1 }, (_, i) => V_MIN + 0.05 * i);

describe('sylinderen i riktige proporsjoner', () => {
  it('200 cm² gir en innvendig diameter på 16 cm', () => {
    expect(PISTON_AREA).toBeCloseTo(0.02, 9);
    expect(2 * boreRadius()).toBeCloseTo(0.1596, 4);
    expect(Math.PI * boreRadius() ** 2).toBeCloseTo(PISTON_AREA, 12);
  });

  it('V = A · h: 1,0 L gir 5,0 cm, 2,40 L gir 12,0 cm og 3,0 L gir 15,0 cm', () => {
    expect(gasColumnHeight(1)).toBeCloseTo(0.05, 9);
    expect(gasColumnHeight(V_REF)).toBeCloseTo(0.12, 9);
    expect(gasColumnHeight(3)).toBeCloseTo(0.15, 9);
    // Volumet til gass-søylen i figuren (πr²h) er volumet på glidebryteren
    for (const V of volumes) {
      const g = cylinderAt(sceneLayout(false), V);
      const volumeM3 = Math.PI * (g.r / PX_PER_M) ** 2 * (g.gasH / PX_PER_M);
      expect(volumeM3 * 1000).toBeCloseTo(V, 9);
    }
  });

  it('F = p · A: lufttrykket på 200 cm² gir omtrent 2 kN', () => {
    expect(pistonForce(101_300)).toBeCloseTo(2026, 0);
    expect(pistonForce(gasPressure(GAS_N, T_REF, V_REF * 1e-3))).toBeCloseTo(2029, 0);
    expect(pistonForce(0)).toBe(0);
    expect(pistonForce(-5)).toBe(0);
  });
});

describe('scenen holder seg innenfor figuren', () => {
  for (const narrow of [false, true]) {
    const layout = sceneLayout(narrow);
    it(`stempelet, stanga og kraftpila får plass for alle volum (${narrow ? 'mobil' : 'PC'})`, () => {
      for (const V of volumes) {
        const g = cylinderAt(layout, V);
        // Stempelet er inne i glasset, og stanga når opp gjennom klemmen
        expect(g.pistonTop).toBeGreaterThan(g.rimY);
        expect(g.rodTop).toBeLessThan(g.clampY - 8);
        expect(g.rodTop).toBeGreaterThan(layout.top + 10);
        // Kraftpila (fra undersiden av stempelet) ved høyeste temperatur går ikke ut av figuren
        const tip = g.gasTop - forceArrowLength(gasPressure(GAS_N, T_MAX, V * 1e-3));
        expect(tip).toBeGreaterThan(layout.top + 14);
        expect(maxForceAt(V) * 0.026).toBeCloseTo(g.gasTop - tip, 6);
      }
    });
  }

  it('pila er lang nok til å sees ved romtemperatur', () => {
    expect(forceArrowLength(gasPressure(GAS_N, T_REF, V_REF * 1e-3))).toBeGreaterThan(45);
  });

  it('klemmen står fast, og stempelet flytter seg like mye som gass-søylen vokser', () => {
    const layout = sceneLayout(false);
    const a = cylinderAt(layout, 1);
    const b = cylinderAt(layout, 3);
    expect(a.clampY).toBe(b.clampY);
    expect(a.rimY).toBe(b.rimY);
    expect(a.pistonTop - b.pistonTop).toBeCloseTo(0.1 * PX_PER_M, 9);
    expect(a.rodTop - b.rodTop).toBeCloseTo(0.1 * PX_PER_M, 9);
  });

  it('partiklene havner inne i gassen', () => {
    const layout = sceneLayout(false);
    const g = cylinderAt(layout, V_MIN);
    for (const [u, w] of [
      [0, 0],
      [1, 1],
      [0.5, 0.5],
    ] as const) {
      const p = particlePoint(g, layout.cx, 5, u, w);
      const d = frontArcDepth(g, layout.cx, p.x);
      expect(p.x).toBeGreaterThanOrEqual(layout.cx - g.r + 5 - 1e-9);
      expect(p.x).toBeLessThanOrEqual(layout.cx + g.r - 5 + 1e-9);
      // Mellom den fremre buen av bunnen og den fremre buen av undersiden av stempelet
      expect(p.y).toBeLessThanOrEqual(g.flensTop + d - 5 + 1e-9);
      expect(p.y).toBeGreaterThanOrEqual(g.gasTop + d + 5 - 1e-9);
    }
  });

  it('de fremre buene: dypest midt foran (r · e), null ved veggene', () => {
    const layout = sceneLayout(false);
    const g = cylinderAt(layout, V_REF);
    expect(frontArcDepth(g, layout.cx, layout.cx)).toBeCloseTo(g.r * g.ellipse, 9);
    expect(frontArcDepth(g, layout.cx, layout.cx + g.r)).toBe(0);
    expect(frontArcDepth(g, layout.cx, layout.cx - g.r - 10)).toBe(0);
    expect(frontArcDepth(g, layout.cx, layout.cx + g.r / 2)).toBeCloseTo(g.r * g.ellipse * Math.sqrt(0.75), 9);
  });
});

describe('kokeplate, rim og manometer', () => {
  it('kokeplata er av ved romtemperatur og under, og står på fullt ved T_MAX', () => {
    expect(plateEffect(0)).toBe(0);
    expect(plateEffect(T_REF)).toBe(0);
    expect(plateEffect(T_MAX)).toBe(1);
    expect(plateEffect(450)).toBeGreaterThan(0.4);
  });

  it('rim bare under 0 °C, mest ved de laveste temperaturene', () => {
    expect(frostAmount(T_REF)).toBe(0);
    expect(frostAmount(273)).toBe(0);
    expect(frostAmount(200)).toBeGreaterThan(0.4);
    expect(frostAmount(0)).toBe(1);
  });

  it('gassen er nøytral ved romtemperatur, varm over og kald under', () => {
    expect(gasWarmth(T_REF)).toBe(0);
    expect(gasWarmth(T_MAX)).toBe(1);
    expect(gasWarmth(0)).toBe(-1);
    expect(gasWarmth(150)).toBeLessThan(0);
  });

  it('manometeret: 0 kPa rett ned til venstre, fullt utslag ned til høyre, og trykket ved 20 °C omtrent på 100', () => {
    expect(gaugeAngle(0)).toBe(-135);
    expect(gaugeAngle(MANOMETER_MAX)).toBe(135);
    expect(gaugeAngle(MANOMETER_MAX / 2)).toBe(0);
    expect(gaugeAngle(-10)).toBe(-135);
    expect(gaugeAngle(Number.NaN)).toBe(-135);
    // Største trykket i visualiseringen (600 K og 1,0 L) er innenfor skalaen
    expect(gasPressure(GAS_N, T_MAX, V_MIN * 1e-3) / 1000).toBeLessThan(MANOMETER_MAX);
  });
});
