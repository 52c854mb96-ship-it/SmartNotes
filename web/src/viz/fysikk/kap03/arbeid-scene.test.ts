import { describe, expect, it } from 'vitest';
import { ATTACH_FRONT, ATTACH_REAR, HAND_LOW, naturalHandHeight, pullLayout } from './arbeid-scene';

const ALL = Array.from({ length: 37 }, (_, i) => i * 5);

describe('tauet og hendene i kjelkescenen', () => {
  it('tauet går langs kraften: fra festet til hendene i retningen (cos α, sin α)', () => {
    for (const a of ALL) {
      const L = pullLayout(a, 4);
      const rad = (a * Math.PI) / 180;
      expect(L.dir.x).toBeCloseTo(Math.cos(rad), 12);
      expect(L.dir.y).toBeCloseTo(Math.sin(rad), 12);
      if (!Number.isFinite(L.d)) continue;
      // Hendene ligger på tauet: (hånd − feste) er parallell med retningen og peker samme vei.
      const vx = L.hand.x - L.attach.x;
      const vy = L.hand.y - L.attach.y;
      expect(vx * L.dir.y - vy * L.dir.x).toBeCloseTo(0, 9);
      expect(vx * L.dir.x + vy * L.dir.y).toBeGreaterThanOrEqual(0);
      expect(Math.hypot(vx, vy)).toBeCloseTo(L.ropeLength, 9);
    }
  });

  it('personen står foran når α ≤ 90° og bak kjelken når α > 90°', () => {
    expect(pullLayout(30, 4).side).toBe(1);
    expect(pullLayout(30, 4).attach).toEqual(ATTACH_FRONT);
    expect(pullLayout(90, 4).side).toBe(1);
    expect(pullLayout(95, 4).side).toBe(-1);
    expect(pullLayout(150, 4).attach).toEqual(ATTACH_REAR);
    expect(pullLayout(150, 4).alphaEff).toBe(30);
  });

  it('rett opp: hendene rett over festet, og et vannrett tau kan ikke holdes av en som står', () => {
    const up = pullLayout(90, 4);
    expect(up.d).toBe(0);
    expect(up.hand.x).toBeCloseTo(ATTACH_FRONT.x, 12);
    expect(up.handHeight).toBeCloseTo(naturalHandHeight(90), 12);
    expect(up.visible).toBe(true);
    for (const a of [0, 180]) {
      const flat = pullLayout(a, 4);
      expect(flat.d).toBe(Infinity);
      expect(flat.visible).toBe(false);
    }
  });

  it('hendene er i en høyde et menneske klarer, og tauet blir ikke lenger enn dMax når personen synes', () => {
    for (const dMax of [2.6, 4.4]) {
      for (const a of ALL) {
        const L = pullLayout(a, dMax);
        if (!L.visible) continue;
        expect(L.handHeight).toBeGreaterThanOrEqual(HAND_LOW - 1e-9);
        expect(L.handHeight).toBeLessThanOrEqual(naturalHandHeight(90) + 1e-9);
        expect(L.d).toBeLessThanOrEqual(dMax + 1e-9);
        expect(L.crouch).toBeGreaterThanOrEqual(0);
        expect(L.crouch).toBeLessThanOrEqual(1);
      }
    }
  });

  it('små vinkler: personen bøyer knærne, og bare de aller minste vinklene havner utenfor bildet', () => {
    expect(pullLayout(30, 4.4).crouch).toBe(0);
    expect(pullLayout(10, 4.4).crouch).toBe(0);
    expect(pullLayout(10, 4.4).visible).toBe(true);
    expect(pullLayout(5, 4.4).visible).toBe(false);
    // Med kortere plass (mobil) må personen bøye knærne for å holde tauet lavt nok.
    expect(pullLayout(15, 2.6).crouch).toBeGreaterThan(0);
    expect(pullLayout(10, 2.6).crouch).toBeGreaterThan(0.9);
    expect(pullLayout(10, 2.6).visible).toBe(true);
    expect(pullLayout(5, 2.6).visible).toBe(false);
  });

  it('speilsymmetri: α og 180° − α gir samme høyde og avstand på hver sin side', () => {
    for (const a of [25, 45, 60, 85]) {
      const front = pullLayout(a, 4);
      const back = pullLayout(180 - a, 4);
      expect(back.side).toBe(-1);
      expect(back.handHeight).toBeCloseTo(front.handHeight, 12);
      expect(front.hand.x).toBeGreaterThan(ATTACH_FRONT.x);
      expect(back.hand.x).toBeLessThan(ATTACH_REAR.x);
      expect(back.dir.x).toBeCloseTo(-front.dir.x, 12);
      expect(back.dir.y).toBeCloseTo(front.dir.y, 12);
    }
  });

  it('ugyldige vinkler gir et tall, ikke NaN', () => {
    const L = pullLayout(Number.NaN, 4);
    expect(Number.isFinite(L.dir.x)).toBe(true);
    expect(pullLayout(-20, 4).alphaEff).toBe(0);
    expect(pullLayout(400, 4).alphaEff).toBe(0);
  });
});
