import { describe, expect, it } from 'vitest';
import {
  BOX_H,
  BOX_W,
  CATALYST_FACTOR,
  HI_K,
  ICE_PRESETS,
  LC_SYSTEMS,
  PARTICLE_R,
  SOLID_SIDE,
  T0,
  arrheniusFactor,
  boxPosition,
  direction,
  energyDensity,
  erfc,
  extentBounds,
  fractionAbove,
  gasPressure,
  lcSystem,
  lcTimeline,
  leChatelier,
  meanEnergy,
  particleStateAt,
  quotient,
  reactionPossible,
  recentEvents,
  sampleAt,
  simulateAB,
  simulateBox,
  simulateHI,
  solidPieces,
  solidSurface,
  solveEquilibrium,
  stochasticAB,
  stochasticHI,
  temperatureFactor,
  vantHoff,
} from './model';

const rel = (a: number, b: number) => Math.abs(a - b) / Math.max(Math.abs(b), 1e-300);

describe('reaksjonskvotient og grenser', () => {
  it('Q = produkter / reaktanter med eksponenter', () => {
    expect(quotient([-1, -1, 2], [0.5, 0.25, 1])).toBeCloseTo(1 / (0.5 * 0.25), 10);
    expect(quotient([-1, -3, 2], [1, 2, 0.5])).toBeCloseTo(0.25 / 8, 10);
    expect(quotient([-1, 1], [1, 0])).toBe(0);
    expect(quotient([-1, 1], [0, 1])).toBe(Infinity);
  });
  it('omsetningen kan ikke gjøre en konsentrasjon negativ', () => {
    expect(extentBounds([-1, -1, 2], [1, 0.5, 0])).toEqual([0, 0.5]);
    expect(extentBounds([-1, -3, 2], [1, 1.5, 0.4])).toEqual([-0.2, 0.5]);
  });
});

describe('likevektsberegning', () => {
  it('H₂ + I₂ ⇌ 2 HI, K = 54, 1,00 mol/L av hver: x = 0,786 (lærebokeksempelet)', () => {
    const r = solveEquilibrium([-1, -1, 2], [1, 1, 0], 54);
    const exact = Math.sqrt(54) / (2 + Math.sqrt(54));
    expect(r.x).toBeCloseTo(exact, 10);
    expect(r.c[2]).toBeCloseTo(2 * exact, 10);
    expect(rel(quotient([-1, -1, 2], r.c), 54)).toBeLessThan(1e-9);
  });
  it('samme likevekt fra begge sider: 2,00 mol/L HI gir det samme som 1,00 + 1,00', () => {
    const a = solveEquilibrium([-1, -1, 2], [1, 1, 0], 54);
    const b = solveEquilibrium([-1, -1, 2], [0, 0, 2], 54);
    expect(b.x).toBeLessThan(0);
    b.c.forEach((c, i) => expect(c).toBeCloseTo(a.c[i]!, 9));
  });
  it('N₂O₄ ⇌ 2 NO₂ stemmer med andregradsformelen', () => {
    const K = 4.6e-3;
    const r = solveEquilibrium([-1, 2], [0.5, 0], K);
    const x = (-K + Math.sqrt(K * K + 16 * K * 0.5)) / 8;
    expect(r.x).toBeCloseTo(x, 12);
  });
  it('alle forvalg: Q = K, ingen negative konsentrasjoner, fra K = 10⁻⁴ til 10⁴', () => {
    for (const p of ICE_PRESETS) {
      const nu = p.species.map((s) => s.nu);
      for (const K of p.K ? [p.K] : [1e-4, 0.01, 1, 100, 1e4]) {
        const r = solveEquilibrium(nu, p.c0, K);
        r.c.forEach((c) => expect(c).toBeGreaterThanOrEqual(0));
        expect(rel(quotient(nu, r.c), K)).toBeLessThan(1e-6);
      }
    }
  });
  it('atomene er bevart (N og H i ammoniakklikevekten)', () => {
    const r = solveEquilibrium([-1, -3, 2], [1, 1.5, 0.2], 0.5);
    expect(2 * r.c[0]! + r.c[2]!).toBeCloseTo(2 * 1 + 0.2, 10);
    expect(2 * r.c[1]! + 3 * r.c[2]!).toBeCloseTo(2 * 1.5 + 3 * 0.2, 10);
  });
  it('ingen reaksjon mulig: bare A og ingen B i A + B ⇌ C', () => {
    const r = solveEquilibrium([-1, -1, 1], [1, 0, 0], 10);
    expect(r.x).toBe(0);
    expect(r.c).toEqual([1, 0, 0]);
  });
  it('reaksjon mulig: ikke med bare én reaktant eller ingenting, men i en blanding som allerede er i likevekt', () => {
    expect(reactionPossible([-1, -1, 2], [0, 0, 0])).toBe(false);
    expect(reactionPossible([-1, -1, 2], [1, 0, 0])).toBe(false);
    expect(reactionPossible([-1, -1, 2], [1, 0, 1])).toBe(true);
    expect(reactionPossible([-1, -1, 2], [0, 0, 2])).toBe(true);
    const eq = solveEquilibrium([-1, -1, 2], [1, 1, 0], 54).c;
    expect(reactionPossible([-1, -1, 2], eq)).toBe(true);
  });
  it('retning: Q < K mot høyre, Q > K mot venstre', () => {
    expect(direction(0, 54)).toBe('høyre');
    expect(direction(100, 54)).toBe('venstre');
    expect(direction(Infinity, 54)).toBe('venstre');
    expect(direction(54, 54)).toBe('likevekt');
  });
  it('stor K: nesten alt blir produkt; liten K: nesten ingenting', () => {
    const big = solveEquilibrium([-1, 1], [1, 0], 1e4);
    const small = solveEquilibrium([-1, 1], [1, 0], 1e-4);
    expect(big.c[1]).toBeGreaterThan(0.999);
    expect(small.c[1]).toBeLessThan(0.001);
  });
});

describe('likevekt innstilles', () => {
  it('A ⇌ B: [B]/[A] går mot K, farten mot høyre og venstre blir like', () => {
    for (const K of [0.2, 1, 4, 10]) {
      const s = simulateAB(1, 0, K, 40);
      const end = s[s.length - 1]!;
      expect(end.c[1]! / end.c[0]!).toBeCloseTo(K, 6);
      expect(rel(end.rf, end.rb)).toBeLessThan(1e-6);
      for (const x of s) expect(x.c[0]! + x.c[1]!).toBeCloseTo(1, 12);
    }
  });
  it('H₂ + I₂ ⇌ 2 HI: kinetikken ender i samme likevekt som beregningen, og atomene er bevart', () => {
    const s = simulateHI(1, 0.8, 0.2, 40, 400);
    const end = s[s.length - 1]!;
    const eq = solveEquilibrium([-1, -1, 2], [1, 0.8, 0.2], HI_K);
    end.c.forEach((c, i) => expect(c).toBeCloseTo(eq.c[i]!, 4));
    for (const x of s) {
      expect(2 * x.c[0]! + x.c[2]!).toBeCloseTo(2 + 0.2, 9);
      expect(2 * x.c[1]! + x.c[2]!).toBeCloseTo(1.6 + 0.2, 9);
    }
    expect(rel(end.rf, end.rb)).toBeLessThan(1e-3);
  });
  it('H₂ + I₂ ⇌ 2 HI: likevekten nås godt innenfor de 10 s grafen viser (1,0 mol/L av hver)', () => {
    const s = simulateHI(1, 1, 0, 10, 200);
    const at6 = sampleAt(s, 6);
    expect(rel(at6.q, HI_K)).toBeLessThan(0.01);
    expect(rel(s[s.length - 1]!.q, HI_K)).toBeLessThan(0.001);
    // [HI] ved likevekt: 2x med x = √K / (2 + √K) = 0,786
    expect(s[s.length - 1]!.c[2]!).toBeCloseTo((2 * Math.sqrt(HI_K)) / (2 + Math.sqrt(HI_K)), 2);
  });
  it('sampleAt interpolerer', () => {
    const s = simulateAB(1, 0, 1, 10, 10);
    expect(sampleAt(s, 0).c[0]).toBe(1);
    expect(sampleAt(s, 0.5).c[0]).toBeCloseTo((s[0]!.c[0]! + s[1]!.c[0]!) / 2, 12);
    expect(sampleAt(s, 99).c[0]).toBe(s[s.length - 1]!.c[0]);
  });
  it('partikkelbildet: samme frø gir samme film, antallet er bevart', () => {
    const a = stochasticAB(20, 10, 2, 10, 7);
    const b = stochasticAB(20, 10, 2, 10, 7);
    expect(a).toEqual(b);
    const st = particleStateAt(a, 10);
    expect(st.kind).toHaveLength(30);
  });
  it('dynamisk likevekt: omdanningene fortsetter begge veier, og gjennomsnittet stemmer med K', () => {
    const K = 2;
    const run = stochasticAB(30, 0, K, 60, 11);
    let fb = 0;
    let n = 0;
    for (let t = 15; t <= 60; t += 0.5) {
      const st = particleStateAt(run, t);
      fb += st.kind.filter((k) => k === 1).length / st.kind.length;
      n++;
    }
    expect(fb / n).toBeCloseTo(K / (1 + K), 1);
    const late = recentEvents(run, 60, 20);
    expect(late.forward).toBeGreaterThan(5);
    expect(late.backward).toBeGreaterThan(5);
    expect(Math.abs(late.forward - late.backward)).toBeLessThan(0.5 * (late.forward + late.backward));
  });
  it('H₂ + I₂ ⇌ 2 HI med molekyler: antallet molekyler og atomer er bevart', () => {
    const run = stochasticHI(12, 12, 0, 12, 20, 5);
    for (const t of [0, 2, 5, 10, 20]) {
      const k = particleStateAt(run, t).kind;
      const h2 = k.filter((x) => x === 0).length;
      const i2 = k.filter((x) => x === 1).length;
      const hi = k.filter((x) => x === 2).length;
      expect(h2 + i2 + hi).toBe(24);
      expect(2 * h2 + hi).toBe(24);
      expect(2 * i2 + hi).toBe(24);
    }
    expect(run.events.some((e) => !e.forward)).toBe(true);
  });
});

describe('Le Chateliers prinsipp', () => {
  it("van 't Hoff: K0 ved T0, eksoterm gir lavere K når det blir varmere", () => {
    const h = lcSystem('haber');
    expect(vantHoff(h.K0, h.T0, h.T0, h.dH)).toBeCloseTo(h.K0, 12);
    // Tabellverdi K = 0,105 ved 472 °C
    expect(vantHoff(h.K0, h.T0, 472 + T0, h.dH)).toBeCloseTo(0.105, 2);
    expect(vantHoff(1, 300, 350, 50)).toBeGreaterThan(1);
    expect(vantHoff(1, 300, 350, -50)).toBeLessThan(1);
  });
  it('startlikevekten har Q = K for alle systemene', () => {
    for (const s of LC_SYSTEMS) {
      const r = leChatelier(s, { kind: 'katalysator' });
      expect(rel(r.before.q, r.before.K)).toBeLessThan(1e-6);
      expect(r.direction).toBe('ingen');
    }
  });
  it('ammoniakk: mer N₂ → mot høyre, men N₂ blir ikke helt borte igjen', () => {
    const s = lcSystem('haber');
    const r = leChatelier(s, { kind: 'stoff', index: 0, factor: 2 });
    expect(r.direction).toBe('høyre');
    expect(r.after.q).toBeLessThan(r.after.K);
    expect(r.final.c[2]!).toBeGreaterThan(r.before.c[2]!);
    expect(r.final.c[0]!).toBeGreaterThan(r.before.c[0]!);
    expect(r.final.c[0]!).toBeLessThan(r.after.c[0]!);
    expect(rel(r.final.q, r.final.K)).toBeLessThan(1e-6);
  });
  it('ammoniakk: mindre volum (høyere trykk) → mot siden med færrest gassmolekyler', () => {
    const s = lcSystem('haber');
    expect(leChatelier(s, { kind: 'volum', V: 0.5 }).direction).toBe('høyre');
    expect(leChatelier(s, { kind: 'volum', V: 2 }).direction).toBe('venstre');
  });
  it('ammoniakk: høyere temperatur → mot venstre (eksoterm), katalysator → ingen endring', () => {
    const s = lcSystem('haber');
    expect(leChatelier(s, { kind: 'temperatur', T: 500 + T0 }).direction).toBe('venstre');
    expect(leChatelier(s, { kind: 'temperatur', T: 300 + T0 }).direction).toBe('høyre');
    const c = leChatelier(s, { kind: 'katalysator' });
    c.final.c.forEach((x, i) => expect(x).toBeCloseTo(c.before.c[i]!, 12));
  });
  it('fjern NH₃ → mot høyre', () => {
    expect(leChatelier(lcSystem('haber'), { kind: 'stoff', index: 2, factor: 0.3 }).direction).toBe('høyre');
  });
  it('jern(III)tiocyanat: fortynning → mot venstre (flere partikler), mer SCN⁻ → mot høyre, varme → mot venstre', () => {
    const s = lcSystem('tiocyanat');
    expect(leChatelier(s, { kind: 'volum', V: 2 }).direction).toBe('venstre');
    expect(leChatelier(s, { kind: 'stoff', index: 1, factor: 3 }).direction).toBe('høyre');
    expect(leChatelier(s, { kind: 'stoff', index: 0, factor: 0.3 }).direction).toBe('venstre');
    expect(leChatelier(s, { kind: 'temperatur', T: 60 + T0 }).direction).toBe('venstre');
  });
  it('koboltklorid: varme og mer Cl⁻ gir blått, fortynning gir rosa', () => {
    const s = lcSystem('kobolt');
    const before = leChatelier(s, { kind: 'katalysator' }).before;
    // Fiolett ved 25 °C: omtrent like mye av begge kompleksene
    const ratio = before.c[2]! / before.c[0]!;
    expect(ratio).toBeGreaterThan(0.6);
    expect(ratio).toBeLessThan(1.4);
    expect(leChatelier(s, { kind: 'temperatur', T: 80 + T0 }).direction).toBe('høyre');
    expect(leChatelier(s, { kind: 'stoff', index: 1, factor: 1.5 }).direction).toBe('høyre');
    expect(leChatelier(s, { kind: 'volum', V: 2 }).direction).toBe('venstre');
  });
  it('Q rett etter forstyrrelsen peker samme vei som forskyvningen', () => {
    for (const s of LC_SYSTEMS)
      for (const d of [
        { kind: 'stoff' as const, index: 0, factor: 2 },
        { kind: 'stoff' as const, index: 0, factor: 0.5 },
        { kind: 'volum' as const, V: 0.5 },
        { kind: 'volum' as const, V: 3 },
      ]) {
        const r = leChatelier(s, d);
        const dq = direction(r.after.q, r.after.K);
        expect(dq === 'likevekt' ? 'ingen' : dq).toBe(r.direction);
      }
  });
  it('stoffmengdene er bevart (Co og Cl i koboltsystemet)', () => {
    const s = lcSystem('kobolt');
    const r = leChatelier(s, { kind: 'temperatur', T: 90 + T0 });
    expect(r.final.n[0]! + r.final.n[2]!).toBeCloseTo(s.mix[0]!, 10);
    expect(r.final.n[1]! + 4 * r.final.n[2]!).toBeCloseTo(s.mix[1]!, 10);
  });
  it('tidslinjen: likevekt før, sprang ved t = 0 og ny likevekt til slutt', () => {
    const s = lcSystem('haber');
    const r = leChatelier(s, { kind: 'stoff', index: 0, factor: 2 });
    expect(lcTimeline(r, 1, -1)).toEqual(r.before.c);
    expect(lcTimeline(r, 1, 0)).toEqual(r.after.c);
    lcTimeline(r, 1, 50).forEach((c, i) => expect(c).toBeCloseTo(r.final.c[i]!, 9));
  });
  it('trykket i ammoniakkreaktoren er noen hundre bar (ideell gass)', () => {
    expect(gasPressure(1, 22.711, T0)).toBeCloseTo(1, 3);
    const s = lcSystem('haber');
    const r = leChatelier(s, { kind: 'katalysator' });
    const p = gasPressure(
      r.before.n.reduce((a, b) => a + b, 0),
      r.before.V,
      r.before.T,
    );
    expect(p).toBeGreaterThan(100);
    expect(p).toBeLessThan(400);
  });
});

describe('kollisjonsteori', () => {
  it('erfc: kjente verdier og liten relativ feil langt ute i halen', () => {
    expect(erfc(0)).toBeCloseTo(1, 7);
    expect(erfc(1)).toBeCloseTo(0.157299207, 7);
    expect(rel(erfc(3), 2.209049699858544e-5)).toBeLessThan(2e-7);
    expect(rel(erfc(5), 1.5374597944280349e-12)).toBeLessThan(2e-7);
    expect(erfc(-1)).toBeCloseTo(2 - 0.157299207, 7);
  });
  const integrate = (f: (x: number) => number, a: number, b: number, n = 20000) => {
    const h = (b - a) / n;
    let s = 0;
    for (let i = 0; i < n; i++) s += f(a + (i + 0.5) * h) * h;
    return s;
  };
  it('energifordelingen har areal 1 og middelenergi 3/2·RT', () => {
    const T = 298.15;
    expect(integrate((E) => energyDensity(E, T), 0, 60)).toBeCloseTo(1, 4);
    expect(integrate((E) => E * energyDensity(E, T), 0, 80)).toBeCloseTo(meanEnergy(T), 3);
  });
  it('andelen med E ≥ Ea stemmer med arealet under halen', () => {
    for (const [Ea, T] of [
      [5, 298.15],
      [10, 298.15],
      [15, 350],
    ] as const)
      expect(
        rel(
          fractionAbove(Ea, T),
          integrate((E) => energyDensity(E, T), Ea, Ea + 80),
        ),
      ).toBeLessThan(1e-3);
  });
  it('tommelfingerregelen: 10 °C høyere omtrent dobler farten når Ea ≈ 50 kJ/mol', () => {
    const f = temperatureFactor(50, 298.15, 308.15);
    expect(f).toBeGreaterThan(1.8);
    expect(f).toBeLessThan(2.2);
    expect(arrheniusFactor(50, 298.15, 308.15)).toBeCloseTo(1.92, 2);
    // Lav Ea gir mindre økning, høy Ea større
    expect(temperatureFactor(20, 298.15, 308.15)).toBeLessThan(1.5);
    expect(temperatureFactor(100, 298.15, 308.15)).toBeGreaterThan(3);
  });
  it('katalysator: lavere Ea gir mange ganger større andel', () => {
    expect(fractionAbove(50 * CATALYST_FACTOR, 298.15) / fractionAbove(50, 298.15)).toBeGreaterThan(1000);
    expect(fractionAbove(0, 300)).toBe(1);
  });
});

describe('partikkelboks: overflate og konsentrasjon', () => {
  it('oppdeling: samme mengde stoff, k ganger så stor overflate', () => {
    const one = solidPieces(1);
    for (const k of [2, 3, 4]) {
      const p = solidPieces(k);
      expect(p).toHaveLength(k * k);
      expect(p.reduce((s, x) => s + x.s * x.s, 0)).toBeCloseTo(SOLID_SIDE * SOLID_SIDE, 12);
      expect(solidSurface(p) / solidSurface(one)).toBeCloseTo(k, 12);
      for (const x of p) {
        expect(x.x).toBeGreaterThan(0);
        expect(x.x + x.s).toBeLessThan(BOX_W);
        expect(x.y).toBeGreaterThan(0);
        expect(x.y + x.s).toBeLessThan(BOX_H);
      }
    }
  });
  it('partiklene holder seg i boksen og utenfor det faste stoffet', () => {
    const pieces = solidPieces(3);
    const run = simulateBox({ n: 20, pieces, speed: 0.5, pEffective: 0.2, tMax: 6 });
    for (let f = 0; f < run.frames; f += 7)
      for (let i = 0; i < run.n; i++) {
        const { x, y } = boxPosition(run, i, f * run.dt);
        expect(x).toBeGreaterThanOrEqual(PARTICLE_R - 1e-6);
        expect(x).toBeLessThanOrEqual(BOX_W - PARTICLE_R + 1e-6);
        expect(y).toBeGreaterThanOrEqual(PARTICLE_R - 1e-6);
        expect(y).toBeLessThanOrEqual(BOX_H - PARTICLE_R + 1e-6);
        for (const p of pieces) expect(x > p.x && x < p.x + p.s && y > p.y && y < p.y + p.s).toBe(false);
      }
  });
  it('flere partikler og større overflate gir flere treff', () => {
    const hits = (n: number, k: number) => simulateBox({ n, pieces: solidPieces(k), speed: 0.5, pEffective: 0.2, tMax: 20, seed: 9 }).hits.length;
    const h10 = hits(10, 1);
    const h30 = hits(30, 1);
    expect(h30 / h10).toBeGreaterThan(2);
    expect(h30 / h10).toBeLessThan(4.5);
    expect(hits(20, 4)).toBeGreaterThan(2 * hits(20, 1));
  });
  it('samme innstillinger gir samme film', () => {
    const a = simulateBox({ n: 8, pieces: solidPieces(2), speed: 0.4, pEffective: 0.3, tMax: 3, seed: 2 });
    const b = simulateBox({ n: 8, pieces: solidPieces(2), speed: 0.4, pEffective: 0.3, tMax: 3, seed: 2 });
    expect(a.hits).toEqual(b.hits);
    expect(Array.from(a.pos)).toEqual(Array.from(b.pos));
  });
});
