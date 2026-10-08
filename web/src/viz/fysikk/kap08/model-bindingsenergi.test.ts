import { describe, expect, it } from 'vitest';
import { REACTIONS, atomicMass, reactionEnergy } from './model';
import {
  COAL_J_PER_KG,
  FISSION_NEUTRON_MEV,
  SUN_POWER_W,
  coalEquivalentKg,
  fissionFragments,
  fusionFragments,
  kineticSplit,
  massLossPerSecond,
  nucleonCloud,
  speedFromKinetic,
} from './model-bindingsenergi';

describe('fart fra bevegelsesenergi', () => {
  it('et nøytron med 2 MeV har ca. 2,0 · 10⁷ m/s', () => {
    expect(speedFromKinetic(2, 1.008665)).toBeCloseTo(1.955e7, -5);
  });
  it('null energi gir null fart, og ugyldige verdier gir NaN', () => {
    expect(speedFromKinetic(0, 4)).toBe(0);
    expect(speedFromKinetic(-1, 4)).toBeNaN();
    expect(speedFromKinetic(1, 0)).toBeNaN();
  });
});

describe('to partikler som farer fra hverandre', () => {
  it('energien er bevart og bevegelsesmengden er like stor', () => {
    const s = kineticSplit(10, 4, 1);
    expect(s.KA + s.KB).toBeCloseTo(10, 12);
    expect(4 * s.vA).toBeCloseTo(1 * s.vB, 0);
    // Den lette får mest energi
    expect(s.KB).toBeCloseTo(8, 12);
  });
  it('like tunge deler energien likt', () => {
    const s = kineticSplit(6, 2, 2);
    expect(s.KA).toBeCloseTo(3, 12);
    expect(s.vA).toBeCloseTo(s.vB, 6);
  });
});

describe('fisjon av uran-235', () => {
  const f = fissionFragments();
  const mBa = atomicMass(56, 141)!;
  const mKr = atomicMass(36, 92)!;
  it('Q er den samme som i reaksjonen, og energien er bevart', () => {
    expect(f.Q).toBeCloseTo(reactionEnergy(REACTIONS.fisjon).Q, 10);
    expect(f.ba.K + f.kr.K + 3 * f.n.K).toBeCloseTo(f.Q, 8);
    expect(f.n.K).toBe(FISSION_NEUTRON_MEV);
  });
  it('bruddstykkene får like stor bevegelsesmengde, og krypton farer fortest', () => {
    expect(mBa * f.ba.v).toBeCloseTo(mKr * f.kr.v, -3);
    expect(f.kr.v).toBeGreaterThan(f.ba.v);
    expect(f.ba.K).toBeGreaterThan(60);
    expect(f.ba.K).toBeLessThan(70);
    expect(f.kr.K).toBeGreaterThan(95);
    expect(f.kr.K).toBeLessThan(105);
  });
  it('fartene er under 10 % av lysfarten (vi kan bruke ½mv²)', () => {
    for (const v of [f.ba.v, f.kr.v, f.n.v]) {
      expect(v).toBeGreaterThan(5e6);
      expect(v).toBeLessThan(3e7);
    }
  });
});

describe('fusjon av deuterium og tritium', () => {
  const f = fusionFragments();
  it('nøytronet får ca. 80 % av 17,6 MeV og farer ca. 4 ganger så fort som heliumkjernen', () => {
    expect(f.Q).toBeCloseTo(17.5, 0);
    expect(f.he.K + f.n.K).toBeCloseTo(f.Q, 10);
    expect(f.n.K / f.Q).toBeCloseTo(0.8, 2);
    expect(f.n.v / f.he.v).toBeCloseTo(atomicMass(2, 4)! / atomicMass(0, 1)!, 6);
    expect(f.n.K).toBeCloseTo(14.0, 0);
    expect(f.he.K).toBeCloseTo(3.5, 0);
  });
});

describe('praktiske sammenligninger', () => {
  it('ett gram uran-235 gir like mye energi som over 2 tonn kull', () => {
    const perGram = reactionEnergy(REACTIONS.fisjon).perKg / 1000;
    const kg = coalEquivalentKg(perGram);
    expect(kg).toBeGreaterThan(2000);
    expect(kg).toBeLessThan(3000);
    expect(coalEquivalentKg(COAL_J_PER_KG)).toBe(1);
  });
  it('sola blir ca. 4 millioner tonn lettere hvert sekund', () => {
    expect(massLossPerSecond(SUN_POWER_W)).toBeCloseTo(4.28e9, -8);
  });
});

describe('frie nukleoner i scenen', () => {
  const cases: [number, number][] = [
    [1, 0],
    [1, 1],
    [2, 2],
    [6, 6],
    [26, 30],
    [92, 143],
    [92, 146],
  ];
  it.each(cases)('Z = %i, N = %i: riktig antall, riktig antall protoner og ingen overlapp', (Z, N) => {
    const r = 4;
    const pts = nucleonCloud(Z, N, 120, 70, r);
    expect(pts).toHaveLength(Z + N);
    expect(pts.filter((p) => p.proton)).toHaveLength(Z);
    for (let i = 0; i < pts.length; i++)
      for (let j = i + 1; j < pts.length; j++) {
        const a = pts[i]!;
        const b = pts[j]!;
        expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeGreaterThanOrEqual(2 * r);
      }
  });
  it('ligger omtrent inne i ellipsen når det er plass', () => {
    const pts = nucleonCloud(26, 30, 120, 70, 4);
    for (const p of pts) expect((p.x / 128) ** 2 + (p.y / 78) ** 2).toBeLessThanOrEqual(1);
  });
  it('er lik hver gang (fast frø) og tom for ugyldige verdier', () => {
    expect(nucleonCloud(26, 30, 120, 70, 4)).toEqual(nucleonCloud(26, 30, 120, 70, 4));
    expect(nucleonCloud(0, 0, 120, 70, 4)).toEqual([]);
    expect(nucleonCloud(2, 2, 0, 70, 4)).toEqual([]);
  });
});
