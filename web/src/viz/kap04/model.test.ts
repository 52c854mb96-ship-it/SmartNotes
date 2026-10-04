import { describe, expect, it } from 'vitest';
import { collide, dtForFmax, elasticityForLossShare, explode, fitTrack, impact, maxLoss, pulseForce, pulseImpulse } from './model';

describe('impulsloven', () => {
  // Egg på 60 g som faller 1,0 m: v = √(2gh) = 4,43 m/s
  const m = 0.06;
  const v = Math.sqrt(2 * 9.81 * 1);

  it('Δp = mv, F_gj = Δp/Δt og bremselengden er vΔt/2', () => {
    const r = impact(m, v, 0.01);
    expect(v).toBeCloseTo(4.43, 2);
    expect(r.dp).toBeCloseTo(0.2658, 4);
    expect(r.Favg).toBeCloseTo(26.58, 2);
    expect(r.Fmax).toBeCloseTo(41.75, 2);
    expect(r.stopDist).toBeCloseTo(0.02215, 5);
  });

  it('arealet under F-t-grafen er lik Δp, uansett støttid', () => {
    for (const dt of [0.002, 0.01, 0.03]) {
      const r = impact(m, v, dt);
      // Numerisk integrasjon (midtpunktsmetoden)
      const n = 2000;
      let area = 0;
      for (let i = 0; i < n; i++) area += pulseForce(r.Fmax, dt, ((i + 0.5) * dt) / n) * (dt / n);
      expect(area).toBeCloseTo(r.dp, 6);
      expect(pulseImpulse(r.Fmax, dt, dt)).toBeCloseTo(r.dp, 12);
      expect(r.Favg * dt).toBeCloseTo(r.dp, 12);
    }
  });

  it('halv støttid gir dobbelt så stor kraft', () => {
    const a = impact(m, v, 0.02);
    const b = impact(m, v, 0.01);
    expect(b.Fmax / a.Fmax).toBeCloseTo(2, 12);
    expect(b.Favg / a.Favg).toBeCloseTo(2, 12);
  });

  it('kraften er null før og etter støtet, og størst midt i', () => {
    expect(pulseForce(10, 0.01, -0.001)).toBe(0);
    expect(pulseForce(10, 0.01, 0.011)).toBe(0);
    expect(pulseForce(10, 0.01, 0.005)).toBeCloseTo(10, 12);
  });

  it('støttiden for en gitt største kraft', () => {
    const r = impact(m, v, 0.012);
    expect(dtForFmax(r.dp, r.Fmax)).toBeCloseTo(0.012, 12);
    // Egget (tåler ca. 35 N) holder når støttiden er over ca. 12 ms
    const dtEgg = dtForFmax(r.dp, 35);
    expect(dtEgg * 1000).toBeCloseTo(11.9, 1);
    expect(impact(m, v, dtEgg).Fmax).toBeCloseTo(35, 9);
  });

  it('bremselengden vΔt/2 stemmer også når kraften er en halv sinusbue', () => {
    // v(t) = v − (1/m)·∫F dt, og s = ∫v dt (midtpunktsmetoden)
    for (const dt of [0.005, 0.03]) {
      const r = impact(m, v, dt);
      const n = 4000;
      let s = 0;
      for (let i = 0; i < n; i++) {
        const t = ((i + 0.5) * dt) / n;
        s += (v - pulseImpulse(r.Fmax, dt, t) / m) * (dt / n);
      }
      expect(s).toBeCloseTo(r.stopDist, 7);
      // Farten er null akkurat når støtet er over
      expect(v - pulseImpulse(r.Fmax, dt, dt) / m).toBeCloseTo(0, 12);
    }
  });

  it('bilfører på 75 kg som stopper fra 50 km/h: kraften i antall G', () => {
    const r = impact(75, 50 / 3.6, 0.1);
    expect(r.dp).toBeCloseTo(1041.7, 1);
    expect(r.Gs).toBeCloseTo(r.Fmax / (75 * 9.81), 12);
    expect(r.Gs).toBeCloseTo(22.2, 1);
  });
});

describe('sentrale støt', () => {
  it('elastisk støt mellom like masser: vognene bytter fart', () => {
    const r = collide(1, 2, 1, 0, 1);
    expect(r.u1).toBeCloseTo(0, 12);
    expect(r.u2).toBeCloseTo(2, 12);
  });

  it('elastisk støt mot tyngre vogn i ro: vogn 1 spretter tilbake', () => {
    const r = collide(1, 2, 2, 0, 1);
    expect(r.u1).toBeCloseTo(-2 / 3, 12);
    expect(r.u2).toBeCloseTo(4 / 3, 12);
    expect(r.EkAfter).toBeCloseTo(r.EkBefore, 12);
    expect(r.lost).toBeCloseTo(0, 12);
  });

  it('fullstendig uelastisk: 2,0 kg i 3,0 m/s treffer 1,0 kg i ro og de får 2,0 m/s', () => {
    const r = collide(2, 3, 1, 0, 0);
    expect(r.u1).toBeCloseTo(2, 12);
    expect(r.u2).toBeCloseTo(2, 12);
    expect(r.EkBefore).toBeCloseTo(9, 12);
    expect(r.EkAfter).toBeCloseTo(6, 12);
    expect(r.lost).toBeCloseTo(maxLoss(2, 3, 1, 0), 12);
  });

  it('bevegelsesmengden er bevart for alle typer støt, også når vognene kjører mot hverandre', () => {
    for (const e of [0, 0.3, 0.7, 1])
      for (const [m1, v1, m2, v2] of [
        [2, 1, 1, -2],
        [0.5, 3, 5, 0.5],
        [4, -0.5, 1, -2.5],
      ] as const) {
        const r = collide(m1, v1, m2, v2, e);
        expect(r.pAfter).toBeCloseTo(r.pBefore, 12);
        expect(r.lost).toBeGreaterThanOrEqual(-1e-12);
        // Vognene går ikke gjennom hverandre
        expect(r.u1).toBeLessThanOrEqual(r.u2 + 1e-12);
      }
  });

  it('energitapet er andelen (1 − e²) av det størst mulige tapet', () => {
    const share = 0.4;
    const r = collide(1.5, 2, 3, -1, elasticityForLossShare(share));
    expect(r.lost).toBeCloseTo(share * maxLoss(1.5, 2, 3, -1), 12);
    expect(elasticityForLossShare(0)).toBe(1);
    expect(elasticityForLossShare(1)).toBe(0);
  });

  it('ingen støt når vogn 1 ikke tar igjen vogn 2', () => {
    const r = collide(1, 1, 1, 2, 1);
    expect(r.collides).toBe(false);
    expect(r.u1).toBe(1);
    expect(r.u2).toBe(2);
    expect(maxLoss(1, 1, 1, 2)).toBe(0);
  });
});

describe('eksplosjon', () => {
  it('Σp = 0, og energien deles omvendt proporsjonalt med massen', () => {
    const r = explode(1, 3, 6);
    expect(r.p1 + r.p2).toBeCloseTo(0, 12);
    expect(r.Ek1 + r.Ek2).toBeCloseTo(6, 12);
    expect(r.Ek1 / r.Ek2).toBeCloseTo(3, 12);
    expect(r.v1 / r.v2).toBeCloseTo(-3, 12);
    expect(r.v1).toBeLessThan(0);
  });

  it('like masser får like mye energi og like stor fart', () => {
    const r = explode(2, 2, 4);
    expect(r.Ek1).toBeCloseTo(2, 12);
    expect(r.v2).toBeCloseTo(-r.v1, 12);
    expect(r.v2).toBeCloseTo(Math.sqrt(2), 12);
  });

  it('rekyl: gevær på 4,0 kg og kule på 10 g med 3,5 kJ', () => {
    const r = explode(4, 0.01, 3500);
    expect(r.v2).toBeCloseTo(836, 0);
    expect(r.v1).toBeCloseTo(-2.09, 2);
    expect(r.Ek2 / (r.Ek1 + r.Ek2)).toBeGreaterThan(0.997);
  });

  it('uten energi skjer det ingenting', () => {
    expect(explode(1, 1, 0)).toMatchObject({ p1: -0, p2: 0, Ek1: 0, Ek2: 0 });
  });
});

describe('plass på banen', () => {
  it('alle legemene får plass, og skalaen er aldri større enn maks', () => {
    const ext: [number, number, number, number][] = [
      [-4, 1, 100, 0],
      [-2, 6, 0, 80],
    ];
    const fit = fitTrack(ext, 20, 780, 200);
    expect(fit.scale).toBeLessThanOrEqual(200);
    for (const [a, b, pl, pr] of ext) {
      expect(fit.origin + a * fit.scale - pl).toBeGreaterThanOrEqual(20 - 1e-6);
      expect(fit.origin + b * fit.scale + pr).toBeLessThanOrEqual(780 + 1e-6);
    }
    // Uten bevegelse brukes maksimal skala og alt sentreres
    const still = fitTrack([[0, 0, 50, 50]], 0, 800, 120);
    expect(still.scale).toBe(120);
    expect(still.origin).toBeCloseTo(400, 9);
  });
});
