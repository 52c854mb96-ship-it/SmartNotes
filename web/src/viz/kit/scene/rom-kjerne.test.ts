import { describe, expect, it } from 'vitest';
import { packNucleus, type PackedNucleus } from './rom-kjerne';

/** Hvor stor del av kjerneskiva (innenfor `share` av radien) som dekkes av nukleonene som tegnes. */
function coverage(p: PackedNucleus, share = 0.85): number {
  const R = p.radius * share;
  const step = R / 40;
  let hit = 0;
  let all = 0;
  for (let x = -R; x <= R; x += step)
    for (let y = -R; y <= R; y += step) {
      if (x * x + y * y > R * R) continue;
      all++;
      if (p.list.some((n) => (n.x - x) ** 2 + (n.y - y) ** 2 <= 1)) hit++;
    }
  return hit / all;
}

/** Største avvik fra Z/A i andelen protoner blant de fremste nukleonene, i fire kvadranter sett forfra. */
function quadrantSpread(p: PackedNucleus, Z: number): number {
  const front = p.list.filter((n) => n.front);
  const share = Z / p.A;
  let worst = 0;
  for (const [sx, sy] of [
    [1, 1],
    [1, -1],
    [-1, 1],
    [-1, -1],
  ] as const) {
    const q = front.filter((n) => Math.sign(n.x) === sx && Math.sign(n.y) === sy);
    if (q.length < 4) continue;
    worst = Math.max(worst, Math.abs(q.filter((n) => n.proton).length / q.length - share));
  }
  return worst;
}

describe('rom: atomkjerner', () => {
  it('store kjerner er tette kuler uten hull og med få elementer', () => {
    for (const [Z, N] of [
      [26, 30],
      [90, 144],
      [92, 146],
    ] as const)
      for (const seed of [1, 2, 3]) {
        const p = packNucleus(Z, N, seed);
        expect(coverage(p)).toBeGreaterThanOrEqual(0.95);
        if (Z + N > 200) expect(p.list.length).toBeLessThanOrEqual(90);
      }
  });

  it('ingen nukleoner stikker ut av omrisset', () => {
    for (const seed of [1, 2, 3, 4]) {
      const p = packNucleus(92, 146, seed);
      const dists = p.list.map((n) => Math.hypot(n.x, n.y, n.z)).sort((a, b) => a - b);
      // Den ytterste ligger høyst litt utenfor de nest ytterste (ingen enkeltkuler som stikker ut).
      expect(dists[dists.length - 1]! - dists[Math.floor(dists.length * 0.8)]!).toBeLessThan(0.6);
    }
  });

  it('radien vokser som A^(1/3)', () => {
    const r = (Z: number, N: number) => packNucleus(Z, N, 1).core;
    expect(r(26, 30) / r(6, 6)).toBeCloseTo(Math.cbrt(56 / 12), 0);
    expect(r(92, 146) / r(26, 30)).toBeGreaterThan(1.4);
    expect(r(92, 146) / r(26, 30)).toBeLessThan(1.9);
  });

  it('har nøyaktig Z protoner, spredt jevnt (ingen klynger)', () => {
    for (const [Z, N] of [
      [8, 8],
      [26, 30],
      [92, 146],
    ] as const)
      for (const seed of [1, 2, 3]) {
        // Alle nukleonene for små kjerner, så telle protonene er mulig
        const p = packNucleus(Z, N, seed);
        if (Z + N <= 30) expect(p.list.filter((n) => n.proton).length).toBe(Z);
        if (Z + N > 50) expect(quadrantSpread(p, Z)).toBeLessThan(0.17);
      }
  });

  it('er lik for samme frø og ulik for ulike frø', () => {
    const a = packNucleus(26, 30, 5);
    const b = packNucleus(26, 30, 5);
    const c = packNucleus(26, 30, 6);
    expect(a.list).toEqual(b.list);
    expect(a.list).not.toEqual(c.list);
  });

  it('de minste kjernene har faste former med alle nukleonene synlige', () => {
    const he = packNucleus(2, 2, 1);
    expect(he.list.length).toBe(4);
    expect(he.list.filter((n) => n.proton).length).toBe(2);
    expect(packNucleus(1, 0, 1).list.length).toBe(1);
    expect(packNucleus(0, 0, 1).list.length).toBe(0);
  });

  it('rapport', () => {
    for (const [Z, N] of [
      [6, 6],
      [8, 8],
      [26, 30],
      [90, 144],
      [92, 146],
    ] as const)
      for (const seed of [1, 2, 3]) {
        const p = packNucleus(Z, N, seed);
        console.log(Z + N, seed, 'n', p.list.length, 'cov', coverage(p).toFixed(3), 'core', p.core.toFixed(2), 'spread', quadrantSpread(p, Z).toFixed(2));
      }
  });
});
