import { describe, expect, it } from 'vitest';
import {
  CITY_TRIP_TASKS,
  accelerationAt,
  fmtSig,
  phaseAt,
  positionAt,
  solveCityTrip,
  strobePositions,
  tripAxes,
  velocityAt,
  type CityTripTask,
} from './model-eks-vt-graf';

describe('bil i bytrafikk: tallsett 1 (12 m/s i 50-sonen)', () => {
  const task = CITY_TRIP_TASKS[0]!;
  const s = solveCityTrip(task);
  const [p1, p2, p3] = s.phases;

  it('akselerasjonen er 2,0 m/s², 0 og −3,0 m/s² i de tre delene', () => {
    expect(p1.a).toBeCloseTo(2.0, 12);
    expect(p2.a).toBe(0);
    expect(p3.a).toBeCloseTo(-3.0, 12);
    expect(p1.dt).toBe(6);
    expect(p2.dt).toBe(20);
    expect(p3.dt).toBe(4);
    expect(p3.dv).toBe(-12);
  });

  it('strekningene er 36 m, 240 m og 24 m, til sammen 300 m', () => {
    expect(p1.s).toBeCloseTo(36, 12);
    expect(p2.s).toBeCloseTo(240, 12);
    expect(p3.s).toBeCloseTo(24, 12);
    expect(s.s).toBeCloseTo(300, 12);
    expect(p2.start).toBeCloseTo(36, 12);
    expect(p3.start).toBeCloseTo(276, 12);
  });

  it('gjennomsnittsfarten er 10 m/s = 36 km/h, og bilen holder fartsgrensen (43,2 km/h)', () => {
    expect(s.vAvg).toBeCloseTo(10, 12);
    expect(s.vAvgKmh).toBeCloseTo(36, 12);
    expect(s.vMaxKmh).toBeCloseTo(43.2, 12);
    expect(s.withinLimit).toBe(true);
    expect(s.overLimitKmh).toBe(0);
  });

  it('med 12 m/s hele tiden ville bilen kjørt 360 m; trekantene over grafen er 60 m', () => {
    expect(s.sAllMax).toBeCloseTo(360, 12);
    expect(s.sMissing).toBeCloseTo(60, 12);
    expect(s.tAllMax).toBeCloseTo(25, 12);
  });

  it('feilsvaret «gjennomsnittet av fartene i delene» er 8 m/s, ikke 10 m/s', () => {
    expect(s.meanOfPhaseSpeeds).toBeCloseTo(8, 12);
  });

  it('posisjonen i knekkpunktene er 36 m, 276 m og 300 m', () => {
    expect(positionAt(task, 6)).toBeCloseTo(36, 12);
    expect(positionAt(task, 26)).toBeCloseTo(276, 12);
    expect(positionAt(task, 30)).toBeCloseTo(300, 12);
    expect(positionAt(task, 3)).toBeCloseTo(9, 12);
    expect(positionAt(task, 28)).toBeCloseTo(276 + 24 - 6, 12);
  });
});

describe('bil i bytrafikk: tallsett 2 og 3', () => {
  it('tallsett 2: 1,5 m/s² og −2,5 m/s², 465 m på 39 s, og 54 km/h er 4 km/h over fartsgrensen', () => {
    const s = solveCityTrip(CITY_TRIP_TASKS[1]!);
    expect(s.phases[0].a).toBeCloseTo(1.5, 12);
    expect(s.phases[2].a).toBeCloseTo(-2.5, 12);
    expect(s.phases.map((p) => p.s)).toEqual([75, 345, 45]);
    expect(s.s).toBeCloseTo(465, 12);
    expect(s.vAvg).toBeCloseTo(465 / 39, 12);
    expect(s.vAvg).toBeCloseTo(11.92, 2);
    expect(s.vMaxKmh).toBeCloseTo(54, 12);
    expect(s.withinLimit).toBe(false);
    expect(s.overLimitKmh).toBeCloseTo(4, 12);
  });

  it('tallsett 3: 1,6 m/s² og −2,0 m/s², 156 m på 24 s (6,5 m/s), og 28,8 km/h i 30-sonen', () => {
    const s = solveCityTrip(CITY_TRIP_TASKS[2]!);
    expect(s.phases[0].a).toBeCloseTo(1.6, 12);
    expect(s.phases[2].a).toBeCloseTo(-2.0, 12);
    expect(s.phases.map((p) => p.s)).toEqual([20, 120, 16]);
    expect(s.s).toBeCloseTo(156, 12);
    expect(s.vAvg).toBeCloseTo(6.5, 12);
    expect(s.vMaxKmh).toBeCloseTo(28.8, 12);
    expect(s.withinLimit).toBe(true);
  });
});

describe('bil i bytrafikk: sammenhengene i alle tallsettene', () => {
  const tasks: CityTripTask[] = [...CITY_TRIP_TASKS, { limitKmh: 60, vMax: 16.5, t1: 7.5, t2: 21, t3: 28.2 }];

  it('strekningen er arealet av trapeset: ½ · (t₃ + (t₂ − t₁)) · v_maks', () => {
    for (const task of tasks) {
      const s = solveCityTrip(task);
      expect(s.s).toBeCloseTo(0.5 * (task.t3 + (task.t2 - task.t1)) * task.vMax, 10);
      expect(s.sMissing).toBeCloseTo(s.phases[0].s + s.phases[2].s, 10);
    }
  });

  it('hver del oppfyller bevegelseslikningene for konstant akselerasjon', () => {
    for (const task of tasks) {
      for (const p of solveCityTrip(task).phases) {
        expect(p.v1).toBeCloseTo(p.v0 + p.a * p.dt, 10);
        expect(p.s).toBeCloseTo(p.v0 * p.dt + 0.5 * p.a * p.dt * p.dt, 10);
        if (p.a !== 0) expect(p.v1 * p.v1 - p.v0 * p.v0).toBeCloseTo(2 * p.a * p.s, 8);
        expect(p.vAvg).toBeCloseTo(p.s / p.dt, 10);
      }
    }
  });

  it('posisjonen er kontinuerlig, stiger hele tiden og ender på hele strekningen', () => {
    for (const task of tasks) {
      const s = solveCityTrip(task);
      const [p1, p2, p3] = s.phases;
      expect(positionAt(task, p1.to)).toBeCloseTo(p2.start, 10);
      expect(positionAt(task, p2.to)).toBeCloseTo(p3.start, 10);
      expect(positionAt(task, task.t3)).toBeCloseTo(s.s, 10);
      expect(positionAt(task, task.t3 + 5)).toBeCloseTo(s.s, 10);
      expect(positionAt(task, -1)).toBe(0);
      let prev = -1;
      for (let i = 0; i <= 400; i++) {
        const x = positionAt(task, (task.t3 * i) / 400);
        expect(x).toBeGreaterThanOrEqual(prev - 1e-12);
        prev = x;
      }
    }
  });

  it('farten er stigningstallet til s-t-grafen, og akselerasjonen stigningstallet til v-t-grafen', () => {
    const h = 1e-5;
    for (const task of tasks) {
      for (let i = 1; i < 60; i++) {
        const t = (task.t3 * i) / 60;
        if ([task.t1, task.t2].some((k) => Math.abs(t - k) < 1e-3)) continue;
        const v = (positionAt(task, t + h) - positionAt(task, t - h)) / (2 * h);
        expect(v).toBeCloseTo(velocityAt(task, t), 4);
        const a = (velocityAt(task, t + h) - velocityAt(task, t - h)) / (2 * h);
        expect(a).toBeCloseTo(accelerationAt(task, t), 4);
      }
    }
  });

  it('farten er 0 i start og slutt, v_maks i del 2 og aldri større enn v_maks', () => {
    for (const task of tasks) {
      expect(velocityAt(task, 0)).toBe(0);
      expect(velocityAt(task, task.t3)).toBe(0);
      expect(velocityAt(task, (task.t1 + task.t2) / 2)).toBe(task.vMax);
      for (let i = 0; i <= 100; i++) expect(velocityAt(task, (task.t3 * i) / 100)).toBeLessThanOrEqual(task.vMax);
    }
  });

  it('delene: phaseAt og akselerasjonen i hvert intervall', () => {
    const task = CITY_TRIP_TASKS[0]!;
    expect(phaseAt(task, -1)).toBe(0);
    expect(phaseAt(task, 0)).toBe(1);
    expect(phaseAt(task, 5.9)).toBe(1);
    expect(phaseAt(task, 6)).toBe(2);
    expect(phaseAt(task, 26)).toBe(3);
    expect(phaseAt(task, 30)).toBe(0);
    expect(accelerationAt(task, 0)).toBeCloseTo(2, 12);
    expect(accelerationAt(task, 10)).toBe(0);
    expect(accelerationAt(task, 27)).toBeCloseTo(-3, 12);
    expect(accelerationAt(task, 31)).toBe(0);
  });

  it('gjennomsnittsfarten ligger mellom v_maks/2 og v_maks, og feilsvaret er et annet tall', () => {
    for (const task of tasks) {
      const s = solveCityTrip(task);
      expect(s.vAvg).toBeLessThan(task.vMax);
      expect(s.vAvg).toBeGreaterThan(task.vMax / 2);
      expect(s.vAvg * s.T).toBeCloseTo(s.s, 10);
      expect(s.tAllMax).toBeLessThan(s.T);
      expect(Math.abs(s.meanOfPhaseSpeeds - s.vAvg)).toBeGreaterThan(0.5);
    }
  });

  it('bildene hvert sekund: tettere i del 1 og 3, like langt mellom i del 2', () => {
    for (const task of CITY_TRIP_TASKS) {
      const pts = strobePositions(task);
      expect(pts[0]).toEqual({ t: 0, s: 0 });
      expect(pts[pts.length - 1]!.t).toBe(task.t3);
      const gaps = pts.slice(1).map((p, i) => ({ t: p.t, d: p.s - pts[i]!.s }));
      for (let i = 1; i < gaps.length; i++) {
        const g = gaps[i]!;
        const prev = gaps[i - 1]!;
        if (g.t <= task.t1) expect(g.d).toBeGreaterThan(prev.d);
        else if (prev.t >= task.t1 + 1 && g.t <= task.t2) expect(g.d).toBeCloseTo(task.vMax, 10);
        else if (prev.t >= task.t2 + 1) expect(g.d).toBeLessThan(prev.d);
      }
    }
  });
});

describe('bil i bytrafikk: fornuftige tall i alle tallsettene', () => {
  it('realistiske akselerasjoner, farter og tider i bytrafikk', () => {
    for (const task of CITY_TRIP_TASKS) {
      const s = solveCityTrip(task);
      expect(s.phases[0].a).toBeGreaterThanOrEqual(1);
      expect(s.phases[0].a).toBeLessThanOrEqual(3);
      expect(s.phases[2].a).toBeLessThanOrEqual(-1.5);
      expect(s.phases[2].a).toBeGreaterThanOrEqual(-4);
      expect(s.vMaxKmh).toBeLessThanOrEqual(task.limitKmh + 10);
      expect(s.T).toBeGreaterThanOrEqual(20);
      expect(s.T).toBeLessThanOrEqual(45);
      expect(s.s).toBeGreaterThan(100);
      expect(s.s).toBeLessThan(600);
      // Del 2 er lengst, så grafen ser ut som en tur gjennom en gate og ikke bare start og stopp
      expect(s.phases[1].dt).toBeGreaterThan(s.phases[0].dt + s.phases[2].dt);
      // Svaret i «vis at»-oppgaven er et helt antall meter, så det kan stå i oppgaveteksten
      expect(s.s).toBeCloseTo(Math.round(s.s), 10);
    }
  });

  it('hjørnene i grafen ligger på rutelinjene, og v_maks står på en tallverdi', () => {
    for (const task of CITY_TRIP_TASKS) {
      const s = solveCityTrip(task);
      const ax = tripAxes(task, s.s);
      for (const t of [0, task.t1, task.t2, task.t3]) expect((t / ax.tMinor) % 1).toBeCloseTo(0, 9);
      expect((task.vMax / ax.vMinor) % 1).toBeCloseTo(0, 9);
      expect(ax.vTicks).toContain(task.vMax);
      expect(ax.tMax).toBeGreaterThan(task.t3);
      expect(ax.vTop).toBeGreaterThan(task.vMax);
      expect(ax.sTop).toBeGreaterThan(s.s);
      expect(ax.sTop).toBeLessThan(s.s * 1.4);
      for (const ticks of [ax.tTicks, ax.vTicks, ax.sTicks]) {
        expect(ticks[0]).toBe(0);
        expect(ticks.length).toBeGreaterThanOrEqual(4);
        expect(ticks.length).toBeLessThanOrEqual(10);
      }
      expect(ax.tTicks[ax.tTicks.length - 1]).toBe(ax.tMax);
      expect(ax.vTicks[ax.vTicks.length - 1]).toBe(ax.vTop);
      expect(ax.sTicks[ax.sTicks.length - 1]).toBe(ax.sTop);
    }
  });

  it('s-aksen har plass til etiketten over sluttpunktet (minst 15 % over)', () => {
    for (const task of CITY_TRIP_TASKS) {
      const s = solveCityTrip(task);
      expect(tripAxes(task, s.s).sTop).toBeGreaterThanOrEqual(s.s * 1.15);
    }
  });

  it('tall med gjeldende siffer: 6,0 · 26 · 12 · 11,9 · 6,50 · 0', () => {
    expect(fmtSig(6)).toBe('6,0');
    expect(fmtSig(26)).toBe('26');
    expect(fmtSig(11.923)).toBe('12');
    expect(fmtSig(11.923, 3)).toBe('11,9');
    expect(fmtSig(6.5, 3)).toBe('6,50');
    expect(fmtSig(10, 3)).toBe('10,0');
    expect(fmtSig(-12)).toBe('−12');
    expect(fmtSig(0)).toBe('0');
    expect(fmtSig(43.2)).toBe('43');
  });

  it('aksene i tallsett 1: 0–32 s, 0–14 m/s og 0–350 m', () => {
    const task = CITY_TRIP_TASKS[0]!;
    const ax = tripAxes(task, solveCityTrip(task).s);
    expect(ax.tMax).toBe(32);
    expect(ax.tMinor).toBe(2);
    expect(ax.vTop).toBe(14);
    expect(ax.sTop).toBe(350);
  });
});
