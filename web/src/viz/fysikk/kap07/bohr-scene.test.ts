import { describe, expect, it } from 'vitest';
import {
  BALMER_WEIGHTS,
  BOHR_ANIM,
  BOHR_RADIUS,
  absorptionTiming,
  dischargeRgb,
  electronAt,
  emissionSpeed,
  emittedPhoton,
  incomingPhoton,
  jumpTrace,
  orbitPx,
  orbitRadius,
  outerTangents,
  passingPhotons,
  photonFromEV,
  pxPerNm,
  scaleBar,
} from './bohr-scene';
import { levelEnergyEV, transitionPhoton } from './model';

describe('banene i Bohrs modell', () => {
  it('r = n² · a₀: den innerste banen er 0,053 nm, bane 3 er 9 ganger så stor', () => {
    expect(orbitRadius(1) * 1e9).toBeCloseTo(0.0529, 4);
    expect(orbitRadius(3) / orbitRadius(1)).toBeCloseTo(9, 10);
    expect(BOHR_RADIUS).toBeCloseTo(5.29e-11, 13);
  });

  it('én skala for alle banene: bane `upper` får radien rFit, og forholdet n² holder', () => {
    for (let upper = 2; upper <= 6; upper++) {
      expect(orbitPx(upper, upper, 113)).toBeCloseTo(113, 10);
      for (let n = 1; n < upper; n++) expect(orbitPx(n, upper, 113) / orbitPx(1, upper, 113)).toBeCloseTo(n * n, 10);
    }
    // Bane 6 er 36 ganger så stor som bane 1
    expect(orbitPx(6, 6, 113) / orbitPx(1, 6, 113)).toBeCloseTo(36, 10);
  });

  it('skalaen i px per nm stemmer med radiene', () => {
    const k = pxPerNm(3, 120);
    expect(orbitRadius(3) * 1e9 * k).toBeCloseTo(120, 8);
  });

  it('målestokken er rund og får plass', () => {
    for (let upper = 2; upper <= 6; upper++) {
      const k = pxPerNm(upper, 113);
      const bar = scaleBar(k, 0.4 * 162);
      expect([0.01, 0.02, 0.05, 0.1, 0.2, 0.5, 1, 2, 5]).toContain(bar.nm);
      expect(bar.px).toBeLessThanOrEqual(0.4 * 162 + 1e-9);
      // Ikke for kort heller: minst en firedel av plassen
      expect(bar.px).toBeGreaterThan(0.1 * 162);
      expect(bar.px).toBeCloseTo(bar.nm * k, 10);
    }
  });
});

describe('fargen til et hydrogenrør', () => {
  it('er rosa-lilla: mest rødt (Hα), så blått, minst grønt', () => {
    const [r, g, b] = dischargeRgb();
    expect(r).toBe(255);
    expect(b).toBeGreaterThan(g);
    expect(b).toBeGreaterThan(80);
    expect(g).toBeGreaterThan(30);
    for (const c of [r, g, b]) expect(Number.isInteger(c) && c >= 0 && c <= 255).toBe(true);
  });

  it('Hα er sterkest og linjene blir svakere mot fiolett', () => {
    for (let i = 1; i < BALMER_WEIGHTS.length; i++) expect(BALMER_WEIGHTS[i]).toBeLessThan(BALMER_WEIGHTS[i - 1]!);
    expect(BALMER_WEIGHTS[0] / BALMER_WEIGHTS[1]).toBeGreaterThan(2.5);
  });
});

describe('lupen', () => {
  it('tangentene står vinkelrett på radiene i begge sirklene', () => {
    const a = { x: 140, y: 150, r: 14 };
    const b = { x: 448, y: 175, r: 162 };
    const t = outerTangents(a, b);
    expect(t).not.toBeNull();
    for (const [p, q] of t!) {
      expect(Math.hypot(p.x - a.x, p.y - a.y)).toBeCloseTo(a.r, 8);
      expect(Math.hypot(q.x - b.x, q.y - b.y)).toBeCloseTo(b.r, 8);
      const tx = q.x - p.x;
      const ty = q.y - p.y;
      expect(tx * (p.x - a.x) + ty * (p.y - a.y)).toBeCloseTo(0, 6);
      expect(tx * (q.x - b.x) + ty * (q.y - b.y)).toBeCloseTo(0, 6);
    }
    // Den ene tangenten går over, den andre under linja mellom sentrene
    expect(t![0][1].y).not.toBeCloseTo(t![1][1].y, 1);
  });

  it('gir null når den ene sirkelen ligger inne i den andre', () => {
    expect(outerTangents({ x: 0, y: 0, r: 100 }, { x: 10, y: 0, r: 20 })).toBeNull();
  });
});

describe('fotoner som går rett gjennom ved absorpsjon', () => {
  it('ligger midt mellom linjene og passer ikke med noen overgang fra nivået', () => {
    for (let lower = 1; lower <= 5; lower++) {
      for (let upper = lower + 1; upper <= 6; upper++) {
        const e = transitionPhoton(upper, lower).eV;
        const { more, less } = passingPhotons(upper, lower);
        expect(more.eV).toBeGreaterThan(e);
        expect(less.eV).toBeLessThan(e);
        expect(less.eV).toBeGreaterThan(0);
        // For lite til å ionisere atomet fra nivået
        expect(more.eV).toBeLessThan(-levelEnergyEV(lower));
        for (let k = lower + 1; k <= 60; k++) {
          const line = transitionPhoton(k, lower).eV;
          expect(Math.abs(more.eV - line)).toBeGreaterThan(1e-4);
          expect(Math.abs(less.eV - line)).toBeGreaterThan(1e-4);
        }
      }
    }
  });

  it('E = hf = hc/λ for fotonene', () => {
    const p = photonFromEV(1.89);
    expect(p.E).toBeCloseTo(1.89 * 1.6e-19, 25);
    expect(p.f * 6.63e-34).toBeCloseTo(p.E, 25);
    expect(p.lambda * p.f).toBeCloseTo(3.0e8, 0);
    // 1,89 eV er rødt lys ved ca. 658 nm
    expect(p.lambda * 1e9).toBeGreaterThan(650);
    expect(p.lambda * 1e9).toBeLessThan(665);
  });

  it('Hα-eksempelet: mer energi gir kortere bølgelengde, mindre energi lengre', () => {
    const nm = transitionPhoton(3, 2).lambda * 1e9;
    const { more, less } = passingPhotons(3, 2);
    expect(more.lambda * 1e9).toBeLessThan(nm);
    expect(less.lambda * 1e9).toBeGreaterThan(nm);
  });
});

describe('avspillingen', () => {
  it('elektronet er på startbanen før spranget og på sluttbanen etter, aldri mellom', () => {
    const a = 0.5;
    expect(electronAt(0, 3, 2, a)).toMatchObject({ n: 3, jumped: false });
    expect(electronAt(BOHR_ANIM.jump - 1e-6, 3, 2, a).n).toBe(3);
    expect(electronAt(BOHR_ANIM.jump, 3, 2, a)).toMatchObject({ n: 2, jumped: true });
    expect(electronAt(BOHR_ANIM.total, 3, 2, a).n).toBe(2);
    // Vinkelen er alpha i hoppøyeblikket, på begge sider
    expect(electronAt(BOHR_ANIM.jump - 1e-9, 3, 2, a).angle).toBeCloseTo(a, 6);
    expect(electronAt(BOHR_ANIM.jump, 3, 2, a).angle).toBeCloseTo(a, 10);
  });

  it('sporet etter spranget blekner bort', () => {
    expect(jumpTrace(0)).toBe(0);
    expect(jumpTrace(BOHR_ANIM.jump)).toBe(1);
    expect(jumpTrace(BOHR_ANIM.jump + BOHR_ANIM.fade / 2)).toBeCloseTo(0.5, 10);
    expect(jumpTrace(BOHR_ANIM.total)).toBe(0);
  });

  it('fotonet ved emisjon kommer ut av atomet og har forlatt figuren før slutt', () => {
    const x0 = 560;
    const xEnd = 792;
    const L = 180;
    const tEmit = BOHR_ANIM.jump;
    const v = emissionSpeed(x0, xEnd, L, tEmit);
    expect(emittedPhoton(0, x0, xEnd, L, v, tEmit)).toBeNull();
    expect(emittedPhoton(tEmit, x0, xEnd, L, v, tEmit)).toBeNull();
    const mid = emittedPhoton(tEmit + 0.3, x0, xEnd, L, v, tEmit)!;
    expect(mid[0]).toBe(x0);
    expect(mid[1]).toBeCloseTo(x0 + 0.3 * v, 8);
    expect(emittedPhoton(BOHR_ANIM.total, x0, xEnd, L, v, tEmit)).toBeNull();
    // Hodet går bare fremover
    let last = -Infinity;
    for (let t = tEmit + 0.05; t < BOHR_ANIM.total - 0.3; t += 0.05) {
      const p = emittedPhoton(t, x0, xEnd, L, v, tEmit);
      if (!p) continue;
      expect(p[1]).toBeGreaterThanOrEqual(last);
      last = p[1];
    }
  });

  it('ved absorpsjon treffer det riktige fotonet elektronet når det hopper, og de andre går ut av figuren', () => {
    const xStart = 300;
    const xHit = 420;
    const xEnd = 792;
    const L = 150;
    const { v, tHit } = absorptionTiming(xStart, xHit, xEnd, L);
    // Hodet kommer til inngangen etter en kort stund, og før det synes ingenting
    expect(xHit + v * (0.45 - tHit)).toBeCloseTo(xStart, 8);
    expect(incomingPhoton(0.2, xStart, xHit, tHit, L, v, { stop: xHit })).toBeNull();
    // Fotonet som tas opp: hodet er ved elektronet i treffet, og det er borte når halen når elektronet
    const hit = incomingPhoton(tHit, xStart, xHit, tHit, L, v, { stop: xHit })!;
    expect(hit[1]).toBeCloseTo(xHit, 8);
    expect(incomingPhoton(tHit + L / v + 0.01, xStart, xHit, tHit, L, v, { stop: xHit })).toBeNull();
    // Fotonene som går forbi, har forlatt figuren når avspillingen slutter
    expect(incomingPhoton(BOHR_ANIM.total + 1e-6, xStart, xHit, tHit, L, v, { xEnd })).toBeNull();
    expect(incomingPhoton(tHit, xStart, xHit, tHit, L, v, { xEnd })![1]).toBeCloseTo(xHit, 8);
    expect(tHit).toBeGreaterThan(0.8);
    expect(tHit).toBeLessThan(BOHR_ANIM.total - 0.8);
  });
});
