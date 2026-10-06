import { describe, expect, it } from 'vitest';
import {
  POWER_REFS,
  bestPullAngle,
  liftsOffAtHump,
  makeTrack,
  niceCeil,
  pace,
  sampleAt,
  simulateTrack,
  sledWork,
  stairRun,
  startPosition,
  timeForEnergy,
  BREAD_SLICE_ENERGY,
  MUSCLE_EFFICIENCY,
  bodyEnergy,
  stairProgress,
} from './model';

describe('akser', () => {
  it('runder opp til pene verdier', () => {
    expect(niceCeil(3532)).toBe(4000);
    expect(niceCeil(7.3)).toBe(8);
    expect(niceCeil(0)).toBe(1);
  });
});

describe('arbeid på kjelke', () => {
  it('lærebokeksempel: 100 N i 30° over 10 m uten friksjon gir 866 J', () => {
    const r = sledWork({ F: 100, alphaDeg: 30, s: 10, mu: 0 });
    expect(r.Fpar).toBeCloseTo(86.6, 1);
    expect(r.WF).toBeCloseTo(866, 0);
    expect(r.WR).toBe(-0);
    expect(r.W).toBeCloseTo(r.WF, 9);
  });

  it('kraft vinkelrett på bevegelsen gjør ikke arbeid', () => {
    const r = sledWork({ F: 150, alphaDeg: 90, s: 10, mu: 0.1 });
    expect(r.WF).toBe(0);
    expect(r.Fperp).toBeCloseTo(150, 9);
  });

  it('arbeidet er negativt når α > 90°', () => {
    const r = sledWork({ F: 100, alphaDeg: 150, s: 10, mu: 0 });
    expect(r.Fpar).toBeLessThan(0);
    expect(r.WF).toBeCloseTo(-866, 0);
  });

  it('friksjonsarbeidet er negativt, og å dra på skrå gir mindre normalkraft og friksjon', () => {
    const flat = sledWork({ F: 100, alphaDeg: 0, s: 10, mu: 0.1 });
    const up = sledWork({ F: 100, alphaDeg: 30, s: 10, mu: 0.1 });
    expect(flat.N).toBeCloseTo(25 * 9.81, 9);
    expect(flat.WR).toBeCloseTo(-0.1 * 25 * 9.81 * 10, 9);
    expect(up.N).toBeCloseTo(25 * 9.81 - 50, 9);
    expect(up.WR).toBeGreaterThan(flat.WR);
    expect(up.WR).toBeLessThan(0);
    expect(up.W).toBeCloseTo(up.WF + up.WR, 9);
    expect(up.WG).toBe(0);
    expect(up.WN).toBe(0);
  });

  it('normalkraften blir aldri negativ', () => {
    expect(sledWork({ F: 400, alphaDeg: 90, s: 1, mu: 0.3 }).N).toBe(0);
  });

  it('mest totalt arbeid for samme kraft når tan α = μ', () => {
    expect(bestPullAngle(0)).toBe(0);
    expect(bestPullAngle(0.1)).toBeCloseTo(5.71, 2);
    expect(bestPullAngle(1)).toBeCloseTo(45, 9);
    for (const mu of [0.05, 0.1, 0.3, 0.5]) {
      const best = bestPullAngle(mu);
      const W = (a: number) => sledWork({ F: 150, alphaDeg: a, s: 10, mu }).W;
      expect(W(best)).toBeGreaterThan(W(best - 2));
      expect(W(best)).toBeGreaterThan(W(best + 2));
      expect(W(best)).toBeGreaterThan(W(0));
    }
  });

  it('alle kombinasjoner av glidebryterne gir endelige tall, og W = W_F + W_R', () => {
    for (const F of [0, 5, 150, 200])
      for (const alphaDeg of [0, 5, 45, 90, 135, 180])
        for (const s of [1, 20])
          for (const mu of [0, 0.5]) {
            const r = sledWork({ F, alphaDeg, s, mu });
            for (const v of Object.values(r)) expect(Number.isFinite(v)).toBe(true);
            expect(r.N).toBeGreaterThan(0);
            expect(r.WR).toBeLessThanOrEqual(0);
            expect(r.W).toBeCloseTo(r.WF + r.WR, 9);
          }
  });
});

describe('bane for energibevaring', () => {
  it('U-rampen er symmetrisk med bunn i midten', () => {
    const tr = makeTrack('rampe');
    expect(tr.height(6)).toBe(0);
    expect(tr.height(0)).toBeCloseTo(6, 12);
    expect(tr.height(3)).toBeCloseTo(tr.height(9), 12);
    expect(tr.slope(6)).toBe(0);
  });

  it('bakken er sammenhengende med riktig helning, og har en topp på 3 m', () => {
    const tr = makeTrack('bakke');
    const h = 1e-6;
    for (const x of [1, 4.5, 7, 9, 11, 12.5, 15]) {
      expect(tr.height(x + h)).toBeCloseTo(tr.height(x - h), 4);
      expect((tr.height(x + h) - tr.height(x - h)) / (2 * h)).toBeCloseTo(tr.slope(x), 4);
    }
    expect(tr.height(9)).toBeCloseTo(3, 12);
    expect(tr.height(4.5)).toBeCloseTo(0, 12);
  });

  it('krumningsradien på toppen stemmer med den andrederiverte, og en rask, løs kule ville lettet', () => {
    const tr = makeTrack('bakke');
    const hump = tr.hump!;
    // Høyre side er brattest: r = 2 · 3,5² / (π² · 3) ≈ 0,83 m
    expect(hump.r).toBeCloseTo(0.8275, 3);
    // h′ = 0 på toppen, så r = 1/|h″| (h″ regnet numerisk rett til høyre for toppen)
    const curvRight = (tr.slope(hump.x + 2e-4) - tr.slope(hump.x + 1e-4)) / 1e-4;
    expect(1 / Math.abs(curvRight)).toBeCloseTo(hump.r, 2);
    // v² på toppen = 2g(h₀ − 3 m); lettet når v² > g·r, altså h₀ > 3 m + r/2 ≈ 3,41 m
    const m = 50;
    expect(liftsOffAtHump(tr, m * 9.81 * 3.2, m)).toBe(false);
    expect(liftsOffAtHump(tr, m * 9.81 * 4, m)).toBe(true);
    expect(liftsOffAtHump(makeTrack('rampe'), m * 9.81 * 5, m)).toBe(false);
  });

  it('startpunktet ligger på riktig høyde på venstre side', () => {
    for (const kind of ['rampe', 'bakke'] as const) {
      const tr = makeTrack(kind);
      const x = startPosition(tr, 4);
      expect(tr.height(x)).toBeCloseTo(4, 6);
      expect(x).toBeLessThan(tr.xBottom);
    }
  });
});

describe('energibevaring på bane', () => {
  it('uten friksjon er E_p + E_k konstant, og farten i bunnen er √(2gh₀)', () => {
    const sim = simulateTrack({ track: makeTrack('rampe'), h0: 4, m: 50, mu: 0, tMax: 10 });
    for (const s of sim.samples) expect(s.E / sim.E0).toBeCloseTo(1, 4);
    const bottom = sim.samples.reduce((a, b) => (b.h < a.h ? b : a));
    expect(Math.abs(bottom.v)).toBeCloseTo(Math.sqrt(2 * 9.81 * 4), 1);
    expect(sim.stopTime).toBeNull();
    // Når aldri høyere enn starthøyden
    expect(Math.max(...sim.samples.map((s) => s.h))).toBeLessThan(4 + 1e-3);
  });

  it('massen påvirker energien, men ikke bevegelsen', () => {
    const a = simulateTrack({ track: makeTrack('rampe'), h0: 3, m: 20, mu: 0, tMax: 4 });
    const b = simulateTrack({ track: makeTrack('rampe'), h0: 3, m: 80, mu: 0, tMax: 4 });
    expect(sampleAt(a, 2.5).x).toBeCloseTo(sampleAt(b, 2.5).x, 9);
    expect(sampleAt(b, 2.5).E).toBeCloseTo(4 * sampleAt(a, 2.5).E, 6);
  });

  it('med friksjon minker mekanisk energi like mye som varmen øker (ΔE = W_R)', () => {
    const sim = simulateTrack({ track: makeTrack('rampe'), h0: 5, m: 60, mu: 0.06, tMax: 45 });
    for (const s of sim.samples) expect((s.E + s.heat) / sim.E0).toBeCloseTo(1, 3);
    const last = sim.samples[sim.samples.length - 1]!;
    expect(last.E).toBeLessThan(0.5 * sim.E0);
    expect(sim.stopTime).not.toBeNull();
    // Varmen øker hele tiden
    for (let i = 1; i < sim.samples.length; i++) expect(sim.samples[i]!.heat).toBeGreaterThanOrEqual(sim.samples[i - 1]!.heat);
  });

  it('kommer over toppen bare når starthøyden er høyere enn toppen', () => {
    const tr = makeTrack('bakke');
    const low = simulateTrack({ track: tr, h0: 2.5, m: 50, mu: 0, tMax: 15 });
    const high = simulateTrack({ track: tr, h0: 4, m: 50, mu: 0, tMax: 15 });
    expect(Math.max(...low.samples.map((s) => s.x))).toBeLessThan(9);
    expect(Math.max(...high.samples.map((s) => s.x))).toBeGreaterThan(12.5);
    for (const s of high.samples) expect(s.E / high.E0).toBeCloseTo(1, 4);
  });
});

describe('trappeløp', () => {
  it('60 kg opp 9 m på 10 s', () => {
    const r = stairRun({ m: 60, h: 9, t: 10 });
    expect(r.W).toBeCloseTo(5297.4, 1);
    expect(r.P).toBeCloseTo(529.7, 1);
    expect(r.vertical).toBeCloseTo(0.9, 9);
    expect(pace(r.vertical)).toBe('løping');
  });

  it('samme arbeid uansett tid, men halv tid gir dobbel effekt', () => {
    const slow = stairRun({ m: 70, h: 6, t: 12 });
    const fast = stairRun({ m: 70, h: 6, t: 6 });
    expect(fast.W).toBe(slow.W);
    expect(fast.P / slow.P).toBeCloseTo(2, 12);
  });

  it('tempo og sammenligninger', () => {
    expect(pace(0.1)).toBe('rolig');
    expect(pace(0.3)).toBe('gange'); // vanlig gange i trapp, ca. 0,3 m/s
    expect(pace(0.5)).toBe('løping');
    expect(pace(1.5)).toBe('sprint');
    expect(pace(3)).toBe('urealistisk');
    expect(timeForEnergy(4000, 2000)).toBe(2);
    expect(POWER_REFS.map((r) => r.P)).toEqual([...POWER_REFS.map((r) => r.P)].sort((a, b) => a - b));
  });

  it('arbeidet så langt vokser jevnt: W(τ) = P · τ, og hele arbeidet når du er oppe', () => {
    const input = { m: 60, h: 9, t: 10 };
    const r = stairRun(input);
    const half = stairProgress(input, 5);
    expect(half.u).toBe(0.5);
    expect(half.climbed).toBeCloseTo(4.5, 12);
    expect(half.W).toBeCloseTo(r.P * 5, 9);
    expect(stairProgress(input, 0)).toEqual({ u: 0, climbed: 0, W: 0 });
    expect(stairProgress(input, 10).W).toBeCloseTo(r.W, 9);
    // Klokka kan stå forbi slutten (kortere tid valgt): da er du oppe, ikke lenger.
    expect(stairProgress(input, 25).climbed).toBe(9);
    expect(stairProgress(input, -1).u).toBe(0);
    for (const tau of [0, 1.3, 4, 7.7, 10]) {
      const p = stairProgress(input, tau);
      expect(p.W).toBeCloseTo(60 * 9.81 * p.climbed, 9);
    }
  });

  it('kroppen bruker omtrent fire ganger arbeidet', () => {
    expect(MUSCLE_EFFICIENCY).toBe(0.25);
    expect(bodyEnergy(5297.4)).toBeCloseTo(21189.6, 6);
    // Én brødskive med ost holder til omtrent 33 turer opp 9 m for en elev på 60 kg.
    expect(BREAD_SLICE_ENERGY / bodyEnergy(stairRun({ m: 60, h: 9, t: 10 }).W)).toBeCloseTo(33, 0);
  });
});
