import { describe, expect, it } from 'vitest';
import {
  POWER_REFS,
  bestPullAngle,
  SLED_HILL,
  humpOutcome,
  makeTrack,
  minNormalRatio,
  normalRatio,
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

  it('akebakken er glatt (høyde og helning henger sammen), starter og slutter på 6 m og har en kul på 2,5 m', () => {
    const tr = makeTrack('bakke');
    const d = 1e-6;
    for (let x = tr.xMin + 0.013; x < tr.xMax; x += 0.0731) {
      expect(tr.height(x + d)).toBeCloseTo(tr.height(x - d), 4);
      expect((tr.height(x + d) - tr.height(x - d)) / (2 * d)).toBeCloseTo(tr.slope(x), 4);
    }
    expect(tr.height(tr.xMin)).toBeCloseTo(6, 9);
    expect(tr.height(tr.xMax)).toBeCloseTo(6, 9);
    expect(tr.slope(tr.xMin)).toBeCloseTo(0, 9);
    expect(tr.slope(tr.xMax)).toBeCloseTo(0, 9);
    expect(tr.height(tr.xBottom)).toBeCloseTo(0, 9);
    expect(tr.slope(tr.xBottom)).toBeCloseTo(0, 9);
    const hump = tr.hump!;
    expect(hump.h).toBe(2.5);
    expect(tr.height(hump.x)).toBeCloseTo(2.5, 9);
    expect(tr.slope(hump.x)).toBeCloseTo(0, 9);
    // Symmetrisk om kulen, og ingen del av banen er lavere enn nullnivået
    for (let u = 0; u < hump.x; u += 0.37) expect(tr.height(hump.x - u)).toBeCloseTo(tr.height(hump.x + u), 9);
    for (let x = tr.xMin; x <= tr.xMax; x += 0.05) expect(tr.height(x)).toBeGreaterThan(-1e-9);
  });

  it('akebakken er realistisk: sidene høyst 30° og kulen høyst 25° bratt', () => {
    const tr = makeTrack('bakke');
    const deg = (x: number) => (Math.atan(Math.abs(tr.slope(x))) * 180) / Math.PI;
    let side = 0;
    let hump = 0;
    for (let x = tr.xMin; x <= tr.xMax; x += 0.01) {
      if (tr.height(x) <= tr.hump!.h && Math.abs(x - tr.hump!.x) < 9) hump = Math.max(hump, deg(x));
      else side = Math.max(side, deg(x));
    }
    expect(side).toBeLessThanOrEqual(SLED_HILL.sideDeg + 1e-9);
    expect(side).toBeGreaterThan(29);
    expect(hump).toBeLessThanOrEqual(SLED_HILL.humpDeg + 1e-9);
  });

  it('krumningen stemmer med den andrederiverte: negativ over kulen, positiv i dalene og i halfpipen', () => {
    for (const kind of ['rampe', 'bakke'] as const) {
      const tr = makeTrack(kind);
      const d = 1e-4;
      for (let x = tr.xMin + 0.05; x < tr.xMax - 0.05; x += 0.173) {
        const h2 = (tr.slope(x + d) - tr.slope(x - d)) / (2 * d);
        const k = tr.slope(x);
        // Hopp i krumningen der stykkene møtes: hopp over punktene der den numeriske verdien ligger mellom to stykker
        if (Math.abs(tr.curvature(x + d) - tr.curvature(x - d)) > 1e-6) continue;
        expect(tr.curvature(x)).toBeCloseTo(h2 / (1 + k * k) ** 1.5, 4);
      }
    }
    const tr = makeTrack('bakke');
    expect(tr.curvature(tr.hump!.x)).toBeCloseTo(-1 / 7.5, 9);
    expect(tr.curvature(tr.xBottom)).toBeCloseTo(1 / SLED_HILL.valleyR, 9);
    expect(makeTrack('rampe').curvature(6)).toBeCloseTo(1 / 3, 9);
  });

  it('akebrettet letter aldri fra kulen: v² < g·r på toppen og N > 0 overalt, for hele glidebryteren', () => {
    const tr = makeTrack('bakke');
    const g = 9.81;
    const hump = tr.hump!;
    for (let h0 = 0.5; h0 <= 5.5 + 1e-9; h0 += 0.1) {
      if (h0 > hump.h) expect(2 * g * (h0 - hump.h)).toBeLessThan(g * hump.r);
      expect(minNormalRatio(tr, h0)).toBeGreaterThan(0.12);
    }
    // r ≥ 2(h₀,maks − h_kul) med margin, og en spiss kul (r = 0,8 m som den gamle) ville ikke holdt
    expect(hump.r).toBeGreaterThan(2 * (5.5 - hump.h));
    // N/(mg) = cos θ + κv²/g: i ro på toppen er N = G, og i en dal blir N større enn G når farten øker
    expect(normalRatio(tr, hump.x, 0)).toBeCloseTo(1, 9);
    expect(normalRatio(tr, tr.xBottom, 8)).toBeCloseTo(1 + 64 / SLED_HILL.valleyR / 9.81, 9);
    expect(normalRatio(tr, hump.x, Math.sqrt(9.81 * hump.r))).toBeCloseTo(0, 9);
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

  it('kommer over kulen bare når starthøyden er høyere enn kulen', () => {
    const tr = makeTrack('bakke');
    const hump = tr.hump!;
    const low = simulateTrack({ track: tr, h0: 2.0, m: 50, mu: 0, tMax: 30 });
    const high = simulateTrack({ track: tr, h0: 4, m: 50, mu: 0, tMax: 30 });
    expect(Math.max(...low.samples.map((s) => s.x))).toBeLessThan(hump.x);
    // Snur i 2,0 m høyde i bakken opp mot kulen
    const turn = low.samples.reduce((a, b) => (b.x > a.x ? b : a));
    expect(turn.h).toBeCloseTo(2.0, 2);
    expect(Math.max(...high.samples.map((s) => s.x))).toBeGreaterThan(hump.x + 8);
    for (const s of high.samples) expect(s.E / high.E0).toBeCloseTo(1, 4);
  });

  it('resultatet ved toppen følger simuleringen, også med friksjon og på grensen', () => {
    const tr = makeTrack('bakke');
    const run = (h0: number, mu: number) => humpOutcome(tr, simulateTrack({ track: tr, h0, m: 50, mu, tMax: 45 }), 50)!;
    expect(run(2.0, 0).result).toBe('under');
    expect(run(2.0, 0).Etop).toBeNull();
    const over = run(4, 0);
    expect(over.result).toBe('over');
    expect(over.need).toBeCloseTo(50 * 9.81 * 2.5, 9);
    // Uten friksjon er E på toppen lik E₀
    expect(over.Etop! / (50 * 9.81 * 4)).toBeCloseTo(1, 4);
    // Akkurat like høyt som kulen: i teorien stopper den på toppen
    expect(run(2.5, 0).result).toBe('akkurat');
    // Med friksjon holder ikke 3,2 m: friksjonen tar mer enn 0,7 m · mg på de ca. 16 m fram til toppen
    expect(run(3.2, 0.06).result).toBe('under');
    // 4 m holder, men E på toppen er mindre enn E₀ (og fortsatt større enn det som trengs)
    const f = run(4, 0.06);
    expect(f.result).toBe('over');
    expect(f.Etop!).toBeLessThan(50 * 9.81 * 4);
    expect(f.Etop!).toBeGreaterThan(f.need);
    // E på toppen er E₀ − R · (strekningen fram til toppen), regnet akkurat på toppen
    const sim = simulateTrack({ track: tr, h0: 4, m: 50, mu: 0.06, tMax: 45 });
    const i = sim.samples.findIndex((s) => s.x >= tr.hump!.x);
    const a = sim.samples[i - 1]!;
    const b = sim.samples[i]!;
    const dTop = a.d + ((b.d - a.d) * (tr.hump!.x - a.x)) / (b.x - a.x);
    expect(f.Etop!).toBeCloseTo(sim.E0 - sim.R * dTop, 1);
    // U-rampen har ingen topp
    expect(humpOutcome(makeTrack('rampe'), simulateTrack({ track: makeTrack('rampe'), h0: 4, m: 50, mu: 0, tMax: 5 }), 50)).toBeNull();
  });

  it('alle starthøyder på glidebryteren gir endelige tall, og aldri høyere enn h₀', () => {
    for (const kind of ['rampe', 'bakke'] as const)
      for (const h0 of [0.5, 2.4, 2.5, 2.6, 5.5])
        for (const mu of [0, 0.06]) {
          const sim = simulateTrack({ track: makeTrack(kind), h0, m: 100, mu, tMax: 45 });
          for (const s of sim.samples) {
            for (const v of [s.x, s.v, s.h, s.Ep, s.Ek, s.E, s.heat]) expect(Number.isFinite(v)).toBe(true);
            expect(s.h).toBeLessThan(h0 + 1e-3);
            expect(Math.abs(s.E + s.heat - sim.E0)).toBeLessThan(0.5);
          }
        }
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
