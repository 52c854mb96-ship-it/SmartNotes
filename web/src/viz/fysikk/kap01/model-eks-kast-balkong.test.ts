import { describe, expect, it } from 'vitest';
import { fmt } from '../../kit/format';
import {
  BALCONY_THROW_TASKS,
  BEACH_BALL,
  FLOOR_HEIGHT,
  G,
  HAND_OVER_FLOOR,
  buildingFloors,
  dragForceAt,
  equalForceSpeed,
  floorLevel,
  fmtPercent,
  fmtSig,
  graphAxes,
  landingQuadratic,
  positionAt,
  roofLevel,
  simulateWithDrag,
  solveBalconyThrow,
  timeAtPositionDown,
  velocityAt,
  type BalconyThrowTask,
} from './model-eks-kast-balkong';

describe('golfball fra balkongen: tallsett 1 (8,4 m, 7,5 m/s)', () => {
  const task = BALCONY_THROW_TASKS[0]!;
  const s = solveBalconyThrow(task);

  it('toppunktet er 2,87 m over hånda og 11,3 m over plenen, etter 0,765 s', () => {
    expect(s.sTop).toBeCloseTo(56.25 / 19.62, 12);
    expect(s.sTop).toBeCloseTo(2.867, 3);
    expect(s.H).toBeCloseTo(11.267, 3);
    expect(s.tTop).toBeCloseTo(0.7645, 4);
    expect(velocityAt(task, s.tTop)).toBeCloseTo(0, 12);
    expect(positionAt(task, s.tTop)).toBeCloseTo(s.sTop, 12);
  });

  it('andregradslikningen 4,905t² − 7,5t − 8,4 = 0 har løsningene 2,28 s og −0,751 s', () => {
    const q = s.quad;
    expect(q.a).toBeCloseTo(4.905, 12);
    expect(q.b).toBe(-7.5);
    expect(q.c).toBe(-8.4);
    expect(q.disc).toBeCloseTo(56.25 + 4 * 4.905 * 8.4, 9);
    expect(q.root).toBeCloseTo(14.868, 3);
    expect(s.tLand).toBeCloseTo(2.280, 3);
    expect(s.tNeg).toBeCloseTo(-0.751, 3);
    // Begge løsningene oppfyller likningen
    for (const t of [s.tLand, s.tNeg]) expect(q.a * t * t + q.b * t + q.c).toBeCloseTo(0, 9);
    expect(positionAt(task, s.tLand)).toBeCloseTo(-task.h0, 9);
  });

  it('ballen treffer plenen med 14,9 m/s nedover (53,5 km/h)', () => {
    expect(s.vLand).toBeCloseTo(-14.868, 3);
    expect(s.speedLand).toBeCloseTo(14.868, 3);
    expect(s.speedLandKmh).toBeCloseTo(53.5, 1);
  });

  it('luftmotstanden like før landingen er 0,066 N, 15 % av tyngden 0,451 N', () => {
    expect(s.weight).toBeCloseTo(0.4513, 4);
    expect(s.dragMax).toBeCloseTo(3.0e-4 * (56.25 + 2 * 9.81 * 8.4), 12);
    expect(s.dragMax).toBeCloseTo(0.0663, 4);
    expect(s.dragRatio).toBeCloseTo(0.147, 3);
    expect(fmtPercent(s.dragRatio)).toBe('15 %');
  });

  it('med luftmotstand blir toppunktet 11,2 m og farten ved plenen 14,3 m/s', () => {
    expect(s.dragH).toBeCloseTo(11.21, 2);
    expect(s.dragSpeed).toBeCloseTo(14.30, 2);
    expect(s.drag.tLand).toBeCloseTo(2.285, 3);
  });

  it('balkongen er i 3. etasje: gulvet 6,5 m over plenen og hånda 1,9 m over gulvet', () => {
    expect(floorLevel(3)).toBeCloseTo(6.5, 12);
    expect(s.floorY).toBeCloseTo(6.5, 12);
    expect(buildingFloors(3)).toEqual([0.7, 0.7 + FLOOR_HEIGHT, 0.7 + 2 * FLOOR_HEIGHT]);
    expect(roofLevel(3)).toBeCloseTo(9.4, 12);
  });
});

describe('alle tallsettene gir fysisk fornuftige svar', () => {
  it.each(BALCONY_THROW_TASKS.map((t, i) => [i + 1, t] as const))('tallsett %i', (_, task) => {
    const s = solveBalconyThrow(task);
    // Hånda er 1,9 m over gulvet i etasjen, og kasteren er i øverste etasje (ingen balkong over å treffe).
    expect(task.h0 - floorLevel(task.floor)).toBeCloseTo(HAND_OVER_FLOOR, 9);
    expect(buildingFloors(task.floor)).toHaveLength(task.floor);
    expect(roofLevel(task.floor)).toBeGreaterThan(task.h0);
    // Toppunktet: v = 0, høyeste posisjon, over hånda og over plenen
    expect(s.sTop).toBeGreaterThan(0.5);
    expect(s.H).toBeCloseTo(task.h0 + s.sTop, 12);
    expect(velocityAt(task, s.tTop)).toBeCloseTo(0, 12);
    for (const dt of [-0.1, 0.1]) expect(positionAt(task, s.tTop + dt)).toBeLessThan(s.sTop);
    // Den tidløse formelen gir samme toppunkt: v² − v₀² = 2as med v = 0, a = −g
    expect(-(task.v0 ** 2) / (2 * -G)).toBeCloseTo(s.sTop, 12);
    // Landingen: én positiv og én negativ løsning, og den positive kommer etter toppunktet
    expect(s.tLand).toBeGreaterThan(s.tTop);
    expect(s.tNeg).toBeLessThan(0);
    expect(s.tLand).toBeGreaterThan(1.5);
    expect(s.tLand).toBeLessThan(3);
    expect(positionAt(task, s.tLand)).toBeCloseTo(-task.h0, 9);
    expect(positionAt(task, s.tNeg)).toBeCloseTo(-task.h0, 9);
    // Vieta: produktet av løsningene er c/a = −h₀/(½g), summen −b/a = v₀/(½g)
    expect(s.tLand * s.tNeg).toBeCloseTo(-task.h0 / (0.5 * G), 9);
    expect(s.tLand + s.tNeg).toBeCloseTo(task.v0 / (0.5 * G), 9);
    // Kontrollen i b): tiden opp pluss tiden ned fra toppunktet
    expect(s.tTop + s.tFall).toBeCloseTo(s.tLand, 9);
    // Farten: v = v₀ + at og den tidløse formelen gir det samme
    expect(s.vLand).toBeLessThan(0);
    expect(s.vLand * s.vLand).toBeCloseTo(s.vSquared, 9);
    expect(s.speedLand).toBeCloseTo(Math.sqrt(task.v0 ** 2 + 2 * G * task.h0), 9);
    // Energibevaring som kontroll (½mv² = ½mv₀² + mgh₀)
    expect(0.5 * s.speedLand ** 2).toBeCloseTo(0.5 * task.v0 ** 2 + G * task.h0, 9);
    // Farten når ballen passerer hånda på vei ned er like stor som startfarten
    expect(velocityAt(task, (2 * task.v0) / G)).toBeCloseTo(-task.v0, 12);
    // Rimelige verdier for et kast fra en balkong
    expect(s.H).toBeGreaterThan(9);
    expect(s.H).toBeLessThan(14);
    expect(s.speedLand).toBeGreaterThan(12);
    expect(s.speedLand).toBeLessThan(17);
    // Luftmotstanden er størst like før landingen, og der er den liten i forhold til tyngden
    expect(s.dragRatio).toBeGreaterThan(0.08);
    expect(s.dragRatio).toBeLessThan(0.2);
    for (let t = 0; t <= s.tLand; t += 0.05) expect(dragForceAt(task, t)).toBeLessThanOrEqual(s.dragMax + 1e-12);
    expect(dragForceAt(task, s.tTop)).toBeCloseTo(0, 12);
  });

  it.each(BALCONY_THROW_TASKS.map((t, i) => [i + 1, t] as const))('tallsett %i: luftmotstanden endrer svarene bare noen prosent', (_, task) => {
    const s = solveBalconyThrow(task);
    // Lavere toppunkt og mindre fart ved plenen, men under 2 % og 5 %; tiden endres under 1,5 %
    expect(s.dragH).toBeLessThan(s.H);
    expect(s.dragChangeH).toBeGreaterThan(-0.02);
    expect(s.dragSpeed).toBeLessThan(s.speedLand);
    expect(s.dragChangeSpeed).toBeGreaterThan(-0.05);
    expect(s.dragChangeSpeed).toBeLessThan(-0.02);
    expect(Math.abs(s.dragChangeT)).toBeLessThan(0.015);
    // Tekstene i løsningen: de avrundede tallene skal ikke bli like (da ville sammenligningen se rar ut)
    expect(fmtSig(s.dragSpeed)).not.toBe(fmtSig(s.speedLand));
    expect(fmt(s.drag.tLand, 3)).not.toBe(fmt(s.tLand, 3));
    // Tiden endres lite fordi ballen bruker kortere tid opp og lengre tid ned
    expect(s.drag.tTop).toBeLessThan(s.tTop);
    expect(s.drag.tLand - s.drag.tTop).toBeGreaterThan(s.tLand - s.tTop);
  });

  it.each(BALCONY_THROW_TASKS.map((t, i) => [i + 1, t] as const))('tallsett %i: med avrundet tid i c) blir farten synlig feil', (_, task) => {
    // Vanlig feil i c): v = v₀ − g · (tiden avrundet til én desimal) gir et annet svar med én desimal
    const s = solveBalconyThrow(task);
    const tRounded = Math.round(s.tLand * 10) / 10;
    expect(fmt(task.v0 - G * tRounded, 1)).not.toBe(fmt(s.vLand, 1));
  });

  it.each(BALCONY_THROW_TASKS.map((t, i) => [i + 1, t] as const))('tallsett %i: s = +h₀ (feil fortegn) har ingen løsning', (_, task) => {
    // ½gt² − v₀t + h₀ = 0 har negativ diskriminant: ballen kommer aldri h₀ over hånda
    expect(task.v0 ** 2 - 4 * (0.5 * G) * task.h0).toBeLessThan(0);
    expect(timeAtPositionDown(task, task.h0)).toBeNaN();
  });

  it('en badeball har like stor luftmotstand som tyngde allerede ved ca. 5 m/s, golfballen først ved ca. 39 m/s', () => {
    expect(equalForceSpeed(BEACH_BALL.m, BEACH_BALL.k)).toBeGreaterThan(4.5);
    expect(equalForceSpeed(BEACH_BALL.m, BEACH_BALL.k)).toBeLessThan(6);
    const golf = BALCONY_THROW_TASKS[0]!;
    expect(equalForceSpeed(golf.m, golf.k)).toBeCloseTo(38.8, 1);
    for (const task of BALCONY_THROW_TASKS) expect(equalForceSpeed(task.m, task.k)).toBeGreaterThan(2 * solveBalconyThrow(task).speedLand);
  });
});

describe('simuleringen med luftmotstand (Eulers metode som i 1E)', () => {
  const task = BALCONY_THROW_TASKS[0]!;

  it('uten luftmotstand (k = 0) treffer Euler den eksakte løsningen', () => {
    const free: BalconyThrowTask = { ...task, k: 0 };
    const sim = simulateWithDrag(free, 0.0005);
    const s = solveBalconyThrow(free);
    expect(sim.tLand).toBeCloseTo(s.tLand, 2);
    expect(Math.abs(sim.vLand)).toBeCloseTo(s.speedLand, 2);
    expect(sim.sTop).toBeCloseTo(s.sTop, 2);
  });

  it('konvergerer når tidssteget blir mindre', () => {
    const a = simulateWithDrag(task, 0.001);
    const b = simulateWithDrag(task, 0.0001);
    expect(Math.abs(a.vLand - b.vLand)).toBeLessThan(0.01);
    expect(Math.abs(a.sTop - b.sTop)).toBeLessThan(0.01);
  });

  it('akselerasjonen er større enn g på vei opp og mindre enn g på vei ned', () => {
    const { points } = simulateWithDrag(task, 0.001);
    const accel = (i: number) => (points[i + 1]!.v - points[i]!.v) / (points[i + 1]!.t - points[i]!.t);
    expect(-accel(10)).toBeGreaterThan(G);
    expect(-accel(points.length - 10)).toBeLessThan(G);
    // Siste punkt er på plenen
    expect(points.at(-1)!.s).toBeCloseTo(-task.h0, 9);
  });

  it('en tung ball merker nesten ikke luftmotstanden', () => {
    const heavy: BalconyThrowTask = { ...task, m: 5 };
    const s = solveBalconyThrow(heavy);
    expect(Math.abs(s.dragChangeSpeed)).toBeLessThan(0.001);
  });
});

describe('hjelpefunksjoner', () => {
  it('andregradslikningen for s = −h₀', () => {
    const q = landingQuadratic({ v0: 0, h0: 4.905 });
    expect(q.tPos).toBeCloseTo(1, 12);
    expect(q.tNeg).toBeCloseTo(-1, 12);
  });

  it('timeAtPositionDown gir tiden på vei ned, og NaN over toppunktet', () => {
    const task = BALCONY_THROW_TASKS[0]!;
    const s = solveBalconyThrow(task);
    expect(timeAtPositionDown(task, -task.h0)).toBeCloseTo(s.tLand, 12);
    expect(timeAtPositionDown(task, 0)).toBeCloseTo((2 * task.v0) / G, 12);
    expect(timeAtPositionDown(task, s.sTop)).toBeCloseTo(s.tTop, 6);
    expect(timeAtPositionDown(task, s.sTop + 1)).toBeNaN();
  });

  it('aksene får plass til begge løsningene og toppunktet, med akseverdier innenfor', () => {
    for (const task of BALCONY_THROW_TASKS) {
      const s = solveBalconyThrow(task);
      for (const [step, pad] of [[0.5, 1.5], [1, 1.5], [1, 2.2]] as const) {
        const ax = graphAxes(s, task.h0, step, pad);
        expect(ax.tMin).toBeLessThan(s.tNeg - 0.15);
        expect(ax.tMax).toBeGreaterThan(s.tLand + 0.1);
        expect(ax.sMin).toBeCloseTo(-task.h0 - pad, 12);
        expect(ax.sMax).toBeGreaterThan(s.sTop + 1);
        expect(ax.tTicks).toContain(0);
        expect(ax.sTicks).toContain(0);
        for (const t of ax.tTicks) expect(t >= ax.tMin - 1e-9 && t <= ax.tMax + 1e-9).toBe(true);
        // Ingen akseverdier under plenen: der står tekstene om løsningene
        for (const v of ax.sTicks) expect(v >= -task.h0 - 1e-9 && v <= ax.sMax).toBe(true);
        expect(ax.tTicks.length).toBeGreaterThanOrEqual(4);
        expect(ax.sTicks.length).toBeGreaterThanOrEqual(5);
        // Ingen «−0»
        expect(ax.tTicks.some((t) => Object.is(t, -0))).toBe(false);
      }
    }
  });

  it('fmtSig og fmtPercent', () => {
    expect(fmtSig(2.867)).toBe('2,87');
    expect(fmtSig(11.267)).toBe('11,3');
    expect(fmtSig(14.868)).toBe('14,9');
    expect(fmtSig(0.0663, 2)).toBe('0,066');
    expect(fmtSig(-0.751)).toBe('−0,751');
    expect(fmtPercent(0.147)).toBe('15 %');
    expect(fmtPercent(-0.038)).toBe('3,8 %');
  });
});
