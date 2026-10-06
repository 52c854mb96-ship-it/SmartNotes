import { describe, expect, it } from 'vitest';
import { POSER } from '../../kit/scene/figurer-skjelett';
import { DRAG_RANGES, terminalVelocity } from './model';
import { POSTURE_PRESETS, posture } from './luftmotstand-positur';

describe('kroppsstillingen følger luftmotstandstallet k', () => {
  it('knappene gir riktig stilling og navn', () => {
    const names = POSTURE_PRESETS.map((p) => posture(p.k).name);
    expect(names).toEqual(['Hodet først', 'Magen ned', 'Vingedrakt']);
    // Knappene ligger innenfor glidebryteren, og to av dem er endene.
    for (const p of POSTURE_PRESETS) {
      expect(p.k).toBeGreaterThanOrEqual(DRAG_RANGES.k.min);
      expect(p.k).toBeLessThanOrEqual(DRAG_RANGES.k.max);
    }
    expect(POSTURE_PRESETS[0]!.k).toBe(DRAG_RANGES.k.min);
    expect(POSTURE_PRESETS[1]!.k).toBe(DRAG_RANGES.k.start);
  });

  it('hodet først står nesten loddrett, magen ned er vannrett og bruker standardposituren', () => {
    const hode = posture(0.12);
    expect(hode.rotate).toBeGreaterThan(165);
    expect(hode.belly).toBe(0);
    const mage = posture(0.25);
    expect(mage.rotate).toBe(90);
    expect(mage.belly).toBe(1);
    expect(mage.spread).toBe(0);
    expect(mage.wings).toBe(0);
    expect(mage.ledd).toEqual(POSER.falle);
  });

  it('større k gir mer spredte armer og bein og til slutt vingedrakt, uten store hopp for ett steg på glidebryteren', () => {
    let prev = posture(DRAG_RANGES.k.min);
    for (let k = 0.13; k <= 1.0001; k += 0.01) {
      const p = posture(k);
      expect(p.belly).toBeGreaterThanOrEqual(prev.belly);
      expect(p.spread).toBeGreaterThanOrEqual(prev.spread);
      expect(p.wings).toBeGreaterThanOrEqual(prev.wings);
      expect(Math.abs(p.rotate - prev.rotate)).toBeLessThan(20);
      for (const key of Object.keys(p.ledd) as (keyof typeof p.ledd)[]) {
        expect(Number.isFinite(p.ledd[key])).toBe(true);
        expect(Math.abs(p.ledd[key] - prev.ledd[key])).toBeLessThan(20);
      }
      prev = p;
    }
    expect(posture(1).wings).toBe(1);
  });

  it('navnene passer med terminalfarten for en hopper på 80 kg', () => {
    // Hodet først er raskest, vingedrakt saktest.
    const kmh = POSTURE_PRESETS.map((p) => terminalVelocity(80, p.k) * 3.6);
    expect(kmh[0]!).toBeGreaterThan(kmh[1]!);
    expect(kmh[1]!).toBeGreaterThan(kmh[2]!);
  });
});
