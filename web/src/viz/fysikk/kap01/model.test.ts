import { describe, expect, it } from 'vitest';
import {
  displacement,
  dragAcceleration,
  eulerFall,
  exactPosition,
  exactVelocity,
  facingDirection,
  flightTime,
  groupMarks,
  isReversing,
  impactSpeed,
  kmhToMs,
  maxHeight,
  maxVelocityError,
  niceAxis,
  niceRange,
  pathLength,
  position,
  positionExtent,
  sceneCamera,
  secondMarks,
  speedTrend,
  stopPosition,
  stopVelocity,
  stopping,
  terminalVelocity,
  throwHeight,
  throwVelocity,
  topTime,
  turnTime,
  velocity,
} from './model';

describe('akser', () => {
  it('runder ut til pene verdier og tar med null', () => {
    expect(niceRange(-5, 4)).toEqual([-6, 4]);
    expect(niceRange(0, 37)).toEqual([0, 40]);
    expect(niceRange(-142, 0)).toEqual([-150, 0]);
  });

  it('akseverdiene bruker samme steg som grensene, så det blir minst tre', () => {
    expect(niceAxis(-35, 38, 4)).toEqual({ min: -40, max: 40, ticks: [-40, -20, 0, 20, 40] });
    expect(niceAxis(-75, 0, 4, 4).ticks).toEqual([-80, -60, -40, -20, 0]);
    for (let i = 0; i <= 54; i++)
      for (let j = 0; j <= 46; j++) {
        const lo = -3.7 * i;
        const hi = 4.3 * j;
        const ax = niceAxis(lo, hi, 4, 4);
        expect(ax.ticks.length).toBeGreaterThanOrEqual(3);
        expect(ax.ticks[0]).toBeCloseTo(ax.min, 9);
        expect(ax.ticks[ax.ticks.length - 1]).toBeCloseTo(ax.max, 9);
        expect(ax.min).toBeLessThanOrEqual(lo + 1e-9);
        expect(ax.max).toBeGreaterThanOrEqual(hi - 1e-9);
      }
  });

  it('gir et minste spenn når alt er null, uten å flytte null', () => {
    expect(niceRange(0, 0, 5, 2)).toEqual([-1, 1]);
    expect(niceRange(0, 0.2, 5, 2)).toEqual([0, 2]);
    expect(niceRange(-0.2, 0, 5, 2)).toEqual([-2, 0]);
  });
});

describe('bevegelsesgrafer (konstant akselerasjon)', () => {
  const m = { s0: -5, v0: 6, a: -2 };

  it('bevegelseslikningene', () => {
    expect(position(m, 0)).toBe(-5);
    expect(position(m, 3)).toBeCloseTo(4, 12);
    expect(velocity(m, 3)).toBeCloseTo(0, 12);
    expect(velocity(m, 5)).toBeCloseTo(-4, 12);
  });

  it('v² − v₀² = 2a·Δs (tidløs likning)', () => {
    for (const t of [0.5, 2, 4.5, 6]) {
      const v = velocity(m, t);
      expect(v * v - m.v0 * m.v0).toBeCloseTo(2 * m.a * displacement(m, t), 9);
    }
  });

  it('arealet under v-t-grafen (trapes) er forflytningen', () => {
    const t = 4;
    const trapezoid = ((m.v0 + velocity(m, t)) / 2) * t;
    expect(displacement(m, t)).toBeCloseTo(trapezoid, 12);
  });

  it('snur der v = 0, og veilengden blir større enn forflytningen etterpå', () => {
    expect(turnTime(m)).toBeCloseTo(3, 12);
    expect(displacement(m, 6)).toBeCloseTo(0, 12);
    expect(pathLength(m, 6)).toBeCloseTo(18, 12);
    expect(pathLength(m, 2)).toBeCloseTo(displacement(m, 2), 12);
    expect(turnTime({ s0: 0, v0: 2, a: 1 })).toBeNull();
    expect(turnTime({ s0: 0, v0: 2, a: 0 })).toBeNull();
  });

  it('største og minste posisjon tar med toppunktet', () => {
    expect(positionExtent(m, 6)).toEqual([-5, 4]);
    expect(positionExtent({ s0: 0, v0: 1, a: 0 }, 6)).toEqual([0, 6]);
  });

  it('negativ akselerasjon betyr ikke alltid at farten avtar', () => {
    expect(speedTrend(m, 1)).toBe('avtar');
    expect(speedTrend(m, 3)).toBe('snur');
    expect(speedTrend(m, 5)).toBe('øker');
    expect(speedTrend({ s0: 0, v0: -4, a: 2 }, 1)).toBe('avtar');
    expect(speedTrend({ s0: 0, v0: 3, a: 0 }, 1)).toBe('konstant');
    expect(speedTrend({ s0: 0, v0: 0, a: 0 }, 1)).toBe('ro');
  });

  it('v = 0 i starten er ikke et vendepunkt', () => {
    expect(speedTrend({ s0: 0, v0: 0, a: 2 }, 0)).toBe('starter');
    expect(turnTime({ s0: 0, v0: 0, a: 2 })).toBeNull();
    expect(speedTrend({ s0: 0, v0: 0, a: -2 }, 1)).toBe('øker');
  });
});

describe('scenen til bevegelsesgrafene (bil på vei)', () => {
  const m = { s0: -5, v0: 6, a: -2 };

  it('fronten peker i startretningen, og bilen rygger etter vendepunktet', () => {
    expect(facingDirection(m)).toBe(1);
    expect(facingDirection({ s0: 0, v0: -3, a: 2 })).toBe(-1);
    expect(facingDirection({ s0: 0, v0: 0, a: -1 })).toBe(-1);
    expect(facingDirection({ s0: 0, v0: 0, a: 0 })).toBe(1);
    expect(isReversing(m, 2)).toBe(false);
    expect(isReversing(m, 3)).toBe(false); // står akkurat stille i vendepunktet
    expect(isReversing(m, 5)).toBe(true);
    // Starter fra ro: kjører alltid forover, aldri rygging
    for (const t of [0, 1, 6]) expect(isReversing({ s0: 0, v0: 0, a: -3 }, t)).toBe(false);
    // Konstant fart rygger aldri
    expect(isReversing({ s0: 0, v0: -4, a: 0 }, 6)).toBe(false);
  });

  it('merkene hvert hele sekund ligger på s-t-grafen, også rundt vendepunktet', () => {
    const marks = secondMarks(m, 4.5);
    expect(marks.map((p) => p.t)).toEqual([0, 1, 2, 3, 4]);
    expect(marks.map((p) => p.s)).toEqual([-5, 0, 3, 4, 3]);
    expect(secondMarks(m, 0)).toEqual([{ t: 0, s: -5 }]);
    expect(secondMarks(m, 6).length).toBe(7);
    expect(secondMarks(m, 1.99).length).toBe(2);
    // Avrundingsfeil fra glidebryteren (0,05 · 40) skal ikke miste merket ved 2 s
    expect(secondMarks(m, 1.9999999999).length).toBe(3);
    expect(secondMarks(m, -1)).toEqual([]);
  });

  it('kameraet viser hele strekningen når den får plass, ellers følger det bilen', () => {
    // 10 m på 520 enheter: 52 per meter er over taket på 40, så hele strekningen vises med 40 per meter
    const fit = sceneCamera(-5, 5, 2, 520, 16, 40);
    expect(fit).toEqual({ pxPerM: 40, center: 0, follows: false });
    // 26 m: skalaen tilpasses (20 per meter)
    expect(sceneCamera(-6, 20, 3, 520, 16, 40)).toEqual({ pxPerM: 20, center: 7, follows: false });
    // 200 m: minste skala, og kameraet følger bilen, men stopper ved endene
    const far = (s: number) => sceneCamera(-50, 150, s, 520, 16, 40);
    expect(far(40)).toEqual({ pxPerM: 16, center: 40, follows: true });
    expect(far(-50).center).toBeCloseTo(-50 + 260 / 16, 12);
    expect(far(150).center).toBeCloseTo(150 - 260 / 16, 12);
  });

  it('bilen holder seg innenfor det indre feltet uansett tallsett og tidspunkt', () => {
    const inner = 520;
    for (const s0 of [-20, -5, 0, 20])
      for (const v0 of [-10, -2.5, 0, 6, 10])
        for (const a of [-4, -1, 0, 2.5, 4]) {
          const mm = { s0, v0, a };
          const [lo, hi] = positionExtent(mm, 6);
          for (const t of [0, 0.7, 2, 3.3, 6]) {
            const s = position(mm, t);
            const cam = sceneCamera(Math.min(0, lo), Math.max(0, hi), s, inner, 16, 40);
            expect(cam.pxPerM).toBeGreaterThanOrEqual(16);
            expect(cam.pxPerM).toBeLessThanOrEqual(40);
            expect(Math.abs((s - cam.center) * cam.pxPerM)).toBeLessThanOrEqual(inner / 2 + 1e-6);
          }
        }
  });

  it('kameraet flytter seg jevnt (ingen hopp) når bilen kjører', () => {
    let prev = sceneCamera(0, 150, 0, 520, 16, 40).center;
    for (let s = 0.5; s <= 150; s += 0.5) {
      const c = sceneCamera(0, 150, s, 520, 16, 40).center;
      expect(Math.abs(c - prev)).toBeLessThanOrEqual(0.5 + 1e-9);
      prev = c;
    }
  });

  it('etikettene til merker som ligger tett, slås sammen', () => {
    const w = (times: number[]) => 10 + 8 * times.length;
    // 2 s og 4 s på samme sted (vendepunkt), 3 s like ved: alle havner i én gruppe
    const g = groupMarks(
      [
        { t: 0, x: 0 },
        { t: 1, x: 200 },
        { t: 2, x: 320 },
        { t: 3, x: 340 },
        { t: 4, x: 320 },
      ],
      w,
    );
    expect(g.map((p) => p.times)).toEqual([[0], [1], [2, 3, 4]]);
    expect(g[2]!.x).toBeCloseTo(330, 12);
    // Langt fra hverandre: ingen sammenslåing, sortert etter x
    expect(groupMarks([{ t: 1, x: 100 }, { t: 0, x: 0 }], w).map((p) => p.times)).toEqual([[0], [1]]);
    expect(groupMarks([], w)).toEqual([]);
    // Etter sammenslåing overlapper ingen etiketter
    const many = Array.from({ length: 7 }, (_, i) => ({ t: i, x: i * 12 }));
    const res = groupMarks(many, w);
    for (let i = 1; i < res.length; i++) {
      const a = res[i - 1]!;
      const b = res[i]!;
      expect(b.x - w(b.times) / 2 - (a.x + w(a.times) / 2)).toBeGreaterThanOrEqual(4);
    }
    expect(res.flatMap((p) => p.times).sort()).toEqual([0, 1, 2, 3, 4, 5, 6]);
  });
});

describe('reaksjonslengde og bremselengde', () => {
  it('80 km/h, 1,0 s reaksjonstid og 8,0 m/s²', () => {
    const v0 = kmhToMs(80);
    expect(v0).toBeCloseTo(22.22, 2);
    const r = stopping({ v0, tr: 1, a: 8 });
    expect(r.sr).toBeCloseTo(22.2, 1);
    expect(r.sb).toBeCloseTo(30.9, 1);
    expect(r.total).toBeCloseTo(53.1, 1);
    expect(r.tb).toBeCloseTo(2.78, 2);
  });

  it('dobbel fart gir dobbel reaksjonslengde og fire ganger så lang bremselengde', () => {
    const a = stopping({ v0: 15, tr: 1.2, a: 5 });
    const b = stopping({ v0: 30, tr: 1.2, a: 5 });
    expect(b.sr / a.sr).toBeCloseTo(2, 12);
    expect(b.sb / a.sb).toBeCloseTo(4, 12);
  });

  it('bremselengden er arealet av trekanten under v-t-grafen', () => {
    const r = stopping({ v0: 20, tr: 1, a: 5 });
    expect(r.sb).toBeCloseTo(0.5 * 20 * r.tb, 12);
  });

  it('posisjon og fart henger sammen med fasene', () => {
    const input = { v0: 20, tr: 1, a: 5 };
    const r = stopping(input);
    expect(stopVelocity(input, 0.5)).toBe(20);
    expect(stopVelocity(input, 3)).toBeCloseTo(10, 12);
    expect(stopVelocity(input, 100)).toBe(0);
    expect(stopPosition(input, 1)).toBeCloseTo(r.sr, 12);
    expect(stopPosition(input, r.tStop)).toBeCloseTo(r.total, 9);
    expect(stopPosition(input, 100)).toBeCloseTo(r.total, 9);
  });
});

describe('loddrett kast', () => {
  const th = { v0: 12, h0: 0 };

  it('toppunkt: v = 0 etter v₀/g, og høyden er v₀²/2g', () => {
    const tTop = topTime(th)!;
    expect(tTop).toBeCloseTo(1.223, 3);
    expect(throwVelocity(th, tTop)).toBeCloseTo(0, 12);
    expect(maxHeight(th)).toBeCloseTo(7.339, 3);
    expect(throwHeight(th, tTop)).toBeCloseTo(maxHeight(th), 12);
  });

  it('akselerasjonen er −g hele tiden, også i toppunktet', () => {
    const h = 1e-4;
    for (const t of [0.2, topTime(th)!, 2]) {
      expect((throwVelocity(th, t + h) - throwVelocity(th, t - h)) / (2 * h)).toBeCloseTo(-9.81, 6);
    }
  });

  it('fra bakken: like lang tid opp som ned, og samme fart ned som opp', () => {
    expect(flightTime(th)).toBeCloseTo(2 * topTime(th)!, 12);
    expect(impactSpeed(th)).toBeCloseTo(12, 12);
    expect(throwVelocity(th, flightTime(th))).toBeCloseTo(-12, 9);
  });

  it('fra en høyde treffer ballen bakken med v² = v₀² + 2gh₀', () => {
    const t2 = { v0: 5, h0: 20 };
    const T = flightTime(t2);
    expect(throwHeight(t2, T)).toBeCloseTo(0, 9);
    expect(-throwVelocity(t2, T)).toBeCloseTo(Math.sqrt(25 + 2 * 9.81 * 20), 9);
  });

  it('kast nedover har ikke toppunkt, og en ball på bakken blir liggende', () => {
    expect(topTime({ v0: -5, h0: 10 })).toBeNull();
    expect(maxHeight({ v0: -5, h0: 10 })).toBe(10);
    expect(flightTime({ v0: -5, h0: 0 })).toBe(0);
    expect(flightTime({ v0: 0, h0: 0 })).toBe(0);
    expect(impactSpeed({ v0: 0, h0: 0 })).toBe(0);
  });
});

describe('simulering med luftmotstand (Eulers metode)', () => {
  const p = { m: 80, k: 0.25 };

  it('terminalfarten er der L = G', () => {
    const vT = terminalVelocity(p);
    expect(vT).toBeCloseTo(56.03, 2);
    expect(dragAcceleration(p, vT)).toBeCloseTo(0, 9);
    expect(p.k * vT * vT).toBeCloseTo(p.m * 9.81, 9);
  });

  it('den eksakte løsningen oppfyller dv/dt = g − (k/m)v² og nærmer seg v_T', () => {
    const h = 1e-4;
    for (const t of [0.5, 3, 8]) {
      const dvdt = (exactVelocity(p, t + h) - exactVelocity(p, t - h)) / (2 * h);
      expect(dvdt).toBeCloseTo(dragAcceleration(p, exactVelocity(p, t)), 5);
      const dsdt = (exactPosition(p, t + h) - exactPosition(p, t - h)) / (2 * h);
      expect(dsdt).toBeCloseTo(exactVelocity(p, t), 5);
    }
    expect(exactVelocity(p, 60)).toBeCloseTo(terminalVelocity(p), 6);
    expect(exactPosition(p, 0)).toBeCloseTo(0, 12);
    expect(Number.isFinite(exactPosition(p, 1e4))).toBe(true);
  });

  it('første steg følger fritt fall: v₁ = g·Δt, s₁ = v₁·Δt (farten oppdateres før posisjonen)', () => {
    const rows = eulerFall(p, 0.5, 5);
    expect(rows[0]).toEqual({ n: 0, t: 0, v: 0, a: 9.81, s: 0 });
    expect(rows[1]!.v).toBeCloseTo(4.905, 12);
    expect(rows[1]!.s).toBeCloseTo(4.905 * 0.5, 12);
    expect(rows[1]!.a).toBeCloseTo(9.81 - (0.25 / 80) * 4.905 ** 2, 12);
    expect(rows).toHaveLength(11);
  });

  it('Euler ligger over den eksakte kurven, og feilen er omtrent proporsjonal med Δt', () => {
    const coarse = eulerFall(p, 0.4, 20);
    expect(coarse[5]!.v).toBeGreaterThan(exactVelocity(p, coarse[5]!.t));
    const e1 = maxVelocityError(p, eulerFall(p, 0.2, 20));
    const e2 = maxVelocityError(p, eulerFall(p, 0.1, 20));
    const e4 = maxVelocityError(p, eulerFall(p, 0.05, 20));
    expect(e1 / e2).toBeGreaterThan(1.8);
    expect(e1 / e2).toBeLessThan(2.2);
    expect(e2 / e4).toBeGreaterThan(1.8);
    expect(e2 / e4).toBeLessThan(2.2);
  });

  it('Euler nærmer seg terminalfarten, også med store tidssteg', () => {
    const rows = eulerFall({ m: 50, k: 0.5 }, 2.5, 40);
    const last = rows[rows.length - 1]!;
    expect(last.v).toBeCloseTo(terminalVelocity({ m: 50, k: 0.5 }), 1);
    expect(rows.every((r) => Number.isFinite(r.v) && Number.isFinite(r.s))).toBe(true);
  });
});
