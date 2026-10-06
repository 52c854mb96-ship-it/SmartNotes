import { describe, expect, it } from 'vitest';
import { ATTACH_FRONT, ATTACH_REAR, HAND_LOW, areaSpans, naturalHandHeight, pullLayout, shownWork } from './arbeid-scene';
import { sledWork } from './model';

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

describe('arbeid som areal', () => {
  it('friksjonen står alltid fra 0 til −R, og F∥ fra 0 til F∥, også når begge er negative', () => {
    // α = 180°, F = 200 N, μ = 0,5: R = 0,5 · 245 N = 123 N (ikke F∥ − R = −323 N)
    const r1 = sledWork({ F: 200, alphaDeg: 180, s: 10, mu: 0.5 });
    const a = areaSpans(r1.Fpar, r1.R);
    expect(a.R[0]).toBeCloseTo(-122.6, 1);
    expect(a.R[1]).toBe(0);
    expect(a.F).toEqual([r1.Fpar, 0]);
    // α = 135°, μ = 0,3, F = 150 N: R = 42 N
    const r2 = sledWork({ F: 150, alphaDeg: 135, s: 10, mu: 0.3 });
    const b = areaSpans(r2.Fpar, r2.R);
    expect(-b.R[0]).toBeCloseTo(41.76, 1);
    expect(b.F[0]).toBeCloseTo(-106.1, 1);
  });

  it('arealene er arbeidet, og etikettbåndene overlapper ikke', () => {
    for (const F of [0, 50, 150, 200])
      for (const alphaDeg of [0, 30, 60, 90, 100, 120, 135, 150, 180])
        for (const mu of [0, 0.1, 0.3, 0.5]) {
          const s = 7;
          const r = sledWork({ F, alphaDeg, s, mu });
          const a = areaSpans(r.Fpar, r.R);
          // Fortegnet arealet: over aksen positivt, under negativt
          const signed = (sp: [number, number]) => (sp[1] > 0 ? sp[1] - sp[0] : sp[0] - sp[1]) * s;
          expect(signed(a.F)).toBeCloseTo(r.WF, 9);
          expect(signed(a.R)).toBeCloseTo(r.WR, 9);
          // Båndene ligger inne i sitt rektangel og overlapper ikke hverandre
          expect(a.bandF[0]).toBeGreaterThanOrEqual(a.F[0] - 1e-9);
          expect(a.bandF[1]).toBeLessThanOrEqual(a.F[1] + 1e-9);
          expect(a.bandR[0]).toBeGreaterThanOrEqual(a.R[0] - 1e-9);
          expect(a.bandR[1]).toBeLessThanOrEqual(a.R[1] + 1e-9);
          const overlap = Math.min(a.bandF[1], a.bandR[1]) - Math.max(a.bandF[0], a.bandR[0]);
          expect(overlap).toBeLessThanOrEqual(1e-9);
          expect(a.lowest).toBeLessThanOrEqual(Math.min(0, r.Fpar, -r.R));
        }
  });
});

describe('tallene i utregningen', () => {
  it('W = W_F + W_R går opp med de avrundede tallene (før: −1 061 J + (−418 J) = −1 478 J)', () => {
    const r = sledWork({ F: 150, alphaDeg: 135, s: 10, mu: 0.3 });
    const d = shownWork({ WF: r.WF, N: r.N, mu: 0.3, s: 10 });
    expect(d.WF).toBe(-1061);
    expect(d.N).toBe(139.18);
    expect(d.WR).toBe(-418);
    expect(d.W).toBe(-1479);
    // Halve joule rundes bort fra null, som på kalkulatoren: 0,5 · 245,25 N · 20 m = 2 452,5 J
    const h = sledWork({ F: 200, alphaDeg: 180, s: 20, mu: 0.5 });
    expect(shownWork({ WF: h.WF, N: h.N, mu: 0.5, s: 20 }).WR).toBe(-2453);
    for (const F of [0, 35, 150, 200])
      for (const alphaDeg of [0, 25, 90, 135, 180])
        for (const mu of [0, 0.07, 0.15, 0.5])
          for (const s of [1, 7, 20]) {
            const q = sledWork({ F, alphaDeg, s, mu });
            const e = shownWork({ WF: q.WF, N: q.N, mu, s });
            expect(e.W).toBe(e.WF + e.WR);
            expect(e.WR).toBe(-Math.round(mu * e.N * s) || 0);
            expect(Math.abs(e.WR - q.WR)).toBeLessThanOrEqual(1);
            expect(Object.is(e.WR, -0)).toBe(false);
          }
  });
});
