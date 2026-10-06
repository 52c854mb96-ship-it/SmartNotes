import { describe, expect, it } from 'vitest';
import {
  bookOnTable,
  bookThickness,
  TEXTBOOK,
  coupled,
  criticalAngleDeg,
  dragFall,
  eulerFall,
  friction,
  FRICTION_FLOORS,
  incline,
  liftPhases,
  liftState,
  pushRamp,
  pushRampEnd,
  pushRampFor,
  RAMP_TASKS,
  solveRampTask,
  scaleForce,
  terminalVelocity,
} from './model';

describe('friksjon', () => {
  const base = { m: 6, muS: 0.5, muK: 0.3 };

  it('statisk friksjon er like stor som dyttet så lenge klossen står i ro', () => {
    const r = friction({ ...base, F: 12 });
    expect(r.moving).toBe(false);
    expect(r.R).toBe(12);
    expect(r.a).toBe(0);
    expect(r.N).toBeCloseTo(58.86, 2);
    expect(r.Rmax).toBeCloseTo(29.43, 2);
  });

  it('akkurat på grensen står klossen fortsatt i ro', () => {
    const N = 6 * 9.81;
    expect(friction({ ...base, F: 0.5 * N }).moving).toBe(false);
  });

  it('glir når dyttet er større enn μs·N, og da er friksjonen μk·N', () => {
    const r = friction({ ...base, F: 40 });
    expect(r.moving).toBe(true);
    expect(r.R).toBeCloseTo(17.658, 3);
    expect(r.a).toBeCloseTo((40 - 17.658) / 6, 3);
  });

  it('holder seg i gang mellom μk·N og μs·N når den allerede glir', () => {
    expect(friction({ ...base, F: 20, wasMoving: false }).moving).toBe(false);
    expect(friction({ ...base, F: 20, wasMoving: true }).moving).toBe(true);
    expect(friction({ ...base, F: 15, wasMoving: true }).moving).toBe(false);
  });

  it('μk kan aldri bli større enn μs', () => {
    const r = friction({ m: 1, muS: 0.2, muK: 0.6, F: 5 });
    expect(r.Rk).toBeCloseTo(r.Rmax, 9);
  });

  it('trekasse på 30 kg på tregulv: N = 294 N, μsN = 147 N og μkN = 88,3 N', () => {
    const r = friction({ m: 30, ...FRICTION_FLOORS.tregulv, F: 100 });
    expect(r.N).toBeCloseTo(294.3, 6);
    expect(r.Rmax).toBeCloseTo(147.15, 6);
    expect(r.Rk).toBeCloseTo(88.29, 6);
    expect(r.moving).toBe(false);
    expect(r.R).toBe(100);
    // Dytter du med 200 N, glir kassen med a = (200 − 88,29)/30
    const g = friction({ m: 30, ...FRICTION_FLOORS.tregulv, F: 200 });
    expect(g.a).toBeCloseTo(3.7237, 4);
  });
});

describe('gulvene i friksjonsvisualiseringen', () => {
  it('har μk ≤ μs og ligger innenfor glidebryterne (μs 0,1–1, μk 0,05–1, steg 0,05)', () => {
    for (const { muS, muK } of Object.values(FRICTION_FLOORS)) {
      expect(muK).toBeLessThanOrEqual(muS);
      expect(muS).toBeGreaterThanOrEqual(0.1);
      expect(muS).toBeLessThanOrEqual(1);
      expect(muK).toBeGreaterThanOrEqual(0.05);
      expect(Math.abs(muS / 0.05 - Math.round(muS / 0.05))).toBeLessThan(1e-9);
      expect(Math.abs(muK / 0.05 - Math.round(muK / 0.05))).toBeLessThan(1e-9);
    }
  });

  it('is har mye lavere friksjon enn tregulv og betong', () => {
    expect(FRICTION_FLOORS.is.muS).toBeLessThan(FRICTION_FLOORS.tregulv.muS / 3);
    expect(FRICTION_FLOORS.is.muK).toBeLessThan(FRICTION_FLOORS.tregulv.muK / 3);
    expect(FRICTION_FLOORS.betong.muS).toBeGreaterThan(FRICTION_FLOORS.tregulv.muS);
  });
});

describe('dytt som øker jevnt fra null', () => {
  const box = { m: 30, muS: 0.5, muK: 0.3 };
  const N = 30 * 9.81;
  const ramp = pushRampFor(box, 400);

  it('rampen når μs·N etter 3 s og stopper på 1,5 · μs·N (men aldri over Fmax)', () => {
    expect(ramp.rate).toBeCloseTo((0.5 * N) / 3, 9);
    expect(ramp.Fend).toBeCloseTo(1.5 * 0.5 * N, 9);
    expect(pushRamp(box, ramp, 3).tBreak).toBeCloseTo(3, 9);
    const heavy = pushRampFor({ m: 40, muS: 1 }, 400);
    expect(heavy.Fend).toBe(400);
  });

  it('i ro før grensen: R = F = rate · t, og a = v = s = 0', () => {
    for (const t of [0, 0.5, 1.7, 2.999]) {
      const p = pushRamp(box, ramp, t);
      expect(p.moving).toBe(false);
      expect(p.F).toBeCloseTo(ramp.rate * t, 9);
      expect(p.R).toBe(p.F);
      expect([p.a, p.v, p.s]).toEqual([0, 0, 0]);
    }
  });

  it('etter grensen: R = μk·N, og a = (F − R)/m som i friction()', () => {
    for (const t of [3.01, 3.5, 4.2, 4.5, 6]) {
      const p = pushRamp(box, ramp, t);
      const r = friction({ ...box, F: p.F, wasMoving: true });
      expect(p.moving).toBe(true);
      expect(p.R).toBeCloseTo(0.3 * N, 9);
      expect(p.a).toBeCloseTo(r.a, 9);
      expect(p.a).toBeGreaterThan(0);
    }
  });

  it('farten og strekningen stemmer med en tett numerisk integrasjon (også etter at dyttet er konstant)', () => {
    const dt = 1e-4;
    let v = 0;
    let s = 0;
    for (let i = 0; i < 70000; i++) {
      const t = i * dt;
      const a0 = pushRamp(box, ramp, t).a;
      const a1 = pushRamp(box, ramp, t + dt).a;
      const v1 = v + ((a0 + a1) / 2) * dt;
      s += ((v + v1) / 2) * dt;
      v = v1;
    }
    const p = pushRamp(box, ramp, 7);
    expect(p.v).toBeCloseTo(v, 4);
    expect(p.s).toBeCloseTo(s, 4);
  });

  it('v er den deriverte av s, og a den deriverte av v', () => {
    const h = 1e-5;
    for (const t of [3.3, 4.0, 5.2]) {
      const p = pushRamp(box, ramp, t);
      const ds = (pushRamp(box, ramp, t + h).s - pushRamp(box, ramp, t - h).s) / (2 * h);
      const dv = (pushRamp(box, ramp, t + h).v - pushRamp(box, ramp, t - h).v) / (2 * h);
      expect(ds).toBeCloseTo(p.v, 5);
      expect(dv).toBeCloseTo(p.a, 4);
    }
  });

  it('impulsen: m·v er lik arealet under (F − R) etter at kassen begynner å gli', () => {
    // Fra tb = 3 til te = 4,5 øker F − R lineært fra (μs − μk)N til (1,5μs − μk)N
    const p = pushRamp(box, ramp, 4.5);
    const area = (1.5 * ((0.5 - 0.3) * N + (0.75 - 0.3) * N)) / 2;
    expect(box.m * p.v).toBeCloseTo(area, 6);
  });

  it('kassen står i ro hele tiden når Fmax ikke er nok (μs·N > Fmax)', () => {
    const heavy = { m: 40, muS: 1, muK: 0.5 };
    const r = pushRampFor(heavy, 300);
    const p = pushRamp(heavy, r, 10);
    expect(p.moving).toBe(false);
    expect(p.tBreak).toBe(Infinity);
    expect(p.F).toBe(300);
    expect(p.R).toBe(300);
  });

  it('med μk = μs starter kassen med a = 0 og blir raskere etter hvert', () => {
    const same = { m: 20, muS: 0.4, muK: 0.4 };
    const r = pushRampFor(same, 400);
    expect(pushRamp(same, r, 3 + 1e-9).a).toBeCloseTo(0, 6);
    expect(pushRamp(same, r, 4).a).toBeGreaterThan(0);
  });

  it('avspillingen stopper når kassen har glidd sMax, eller ved tMax', () => {
    const t = pushRampEnd(box, ramp, 1.2, 7);
    expect(t).toBeGreaterThan(3);
    expect(t).toBeLessThan(7);
    expect(pushRamp(box, ramp, t).s).toBeCloseTo(1.2, 6);
    const heavy = { m: 40, muS: 1, muK: 0.5 };
    expect(pushRampEnd(heavy, pushRampFor(heavy, 300), 1.2, 7)).toBe(7);
  });

  it('alle ytterpunkter på glidebryterne gir endelige tall og en kasse som holder seg i figuren', () => {
    for (const m of [10, 40])
      for (const muS of [0.1, 1])
        for (const muK of [0.05, muS]) {
          const input = { m, muS, muK };
          const r = pushRampFor(input, 400);
          const tEnd = pushRampEnd(input, r, 1.2, 7);
          const p = pushRamp(input, r, tEnd);
          for (const v of [p.F, p.R, p.a, p.v, p.s, tEnd]) expect(Number.isFinite(v)).toBe(true);
          expect(p.s).toBeLessThanOrEqual(1.2 + 1e-6);
          expect(p.F).toBeLessThanOrEqual(400);
        }
  });
});

describe('bok på bord', () => {
  it('N = G uten hånd, og kraftparene er like store', () => {
    const r = bookOnTable(1.5);
    expect(r.G).toBeCloseTo(14.715, 3);
    expect(r.N).toBe(r.G);
    expect(r.earthAccel).toBeLessThan(1e-23);
  });

  it('dytt fra hånda gjør N større enn G', () => {
    const r = bookOnTable(1.5, 10);
    expect(r.N - r.G).toBeCloseTo(10, 9);
    expect(r.F).toBe(10);
  });

  it('kraftsummen på boka er null for alle masser og dytt på glidebryterne', () => {
    for (let m = 0.5; m <= 2.5 + 1e-9; m += 0.1) {
      for (let push = 0; push <= 10; push += 0.5) {
        const r = bookOnTable(m, push);
        expect(r.net).toBeCloseTo(0, 9);
        expect(r.N).toBeGreaterThanOrEqual(r.G);
        expect(r.G).toBeCloseTo(m * 9.81, 9);
      }
    }
  });

  it('jorda får en umerkelig akselerasjon av G′ = G', () => {
    const r = bookOnTable(1.5);
    expect(r.earthAccel).toBeCloseTo(14.715 / 5.97e24, 30);
    expect(r.earthAccel * 5.97e24).toBeCloseTo(r.G, 9);
    expect(bookOnTable(2.5).earthAccel / bookOnTable(0.5).earthAccel).toBeCloseTo(5, 9);
  });

  it('største normalkraft på glidebryterne er 34,5 N (2,5 kg og 10 N dytt), som figuren setter av plass til', () => {
    const r = bookOnTable(2.5, 10);
    expect(r.G).toBeCloseTo(24.525, 9);
    expect(r.N).toBeCloseTo(34.525, 9);
    expect(r.N - r.F).toBeCloseTo(r.G, 12);
  });

  it('negativt dytt regnes som null (hånda kan ikke dra i boka)', () => {
    const r = bookOnTable(1, -3);
    expect(r.F).toBe(0);
    expect(r.N).toBe(r.G);
  });
});

describe('tykkelsen til en lærebok', () => {
  it('1,5 kg gir ca. 3,6 cm', () => {
    expect(bookThickness(1.5)).toBeCloseTo(1.5 / (850 * 0.26 * 0.19), 12);
    expect(bookThickness(1.5)).toBeCloseTo(0.0357, 3);
  });

  it('tykkelsen er proporsjonal med massen, og massen kommer tilbake fra volumet', () => {
    expect(bookThickness(2.5) / bookThickness(0.5)).toBeCloseTo(5, 9);
    const t = bookThickness(2);
    expect(t * TEXTBOOK.length * TEXTBOOK.width * TEXTBOOK.density).toBeCloseTo(2, 12);
  });

  it('glidebryteren gir bøker mellom ca. 1 cm og 6 cm', () => {
    expect(bookThickness(0.5)).toBeGreaterThan(0.01);
    expect(bookThickness(2.5)).toBeLessThan(0.065);
    expect(bookThickness(0)).toBe(0);
    expect(bookThickness(Number.NaN)).toBe(0);
  });
});

describe('koblede klosser', () => {
  it('eksempelet fra boka: 9 N på 2 kg + 4 kg', () => {
    const r = coupled(2, 4, 9);
    expect(r.a).toBeCloseTo(1.5, 9);
    expect(r.S).toBeCloseTo(3, 9);
    expect(r.netA).toBeCloseTo(2 * r.a, 9);
    expect(r.netB).toBeCloseTo(4 * r.a, 9);
  });

  it('uten kraft står alt stille', () => {
    expect(coupled(3, 3, 0)).toEqual({ a: 0, S: 0, netA: 0, netB: 0 });
  });
});

describe('kloss på skråplan', () => {
  const base = { m: 4, muS: 0.5, muK: 0.3 };

  it('dekomponerer G: G∥ = G·sin α og N = G⊥ = G·cos α', () => {
    const r = incline({ ...base, alphaDeg: 20 });
    expect(r.G).toBeCloseTo(39.24, 2);
    expect(r.Gpar).toBeCloseTo(39.24 * Math.sin((20 * Math.PI) / 180), 9);
    expect(r.N).toBeCloseTo(39.24 * Math.cos((20 * Math.PI) / 180), 9);
    expect(r.Gpar ** 2 + r.Gperp ** 2).toBeCloseTo(r.G ** 2, 6);
  });

  it('ligger i ro med R = G∥ så lenge tan α ≤ μs', () => {
    const r = incline({ ...base, alphaDeg: 26 });
    expect(r.moving).toBe(false);
    expect(r.R).toBeCloseTo(r.Gpar, 9);
    expect(r.a).toBe(0);
    expect(r.R).toBeLessThanOrEqual(r.Rmax);
  });

  it('glir over grensevinkelen med a = g(sin α − μk·cos α)', () => {
    const r = incline({ ...base, alphaDeg: 30 });
    expect(r.moving).toBe(true);
    expect(r.R).toBeCloseTo(r.Rk, 9);
    expect(r.a).toBeCloseTo(9.81 * (0.5 - 0.3 * Math.cos(Math.PI / 6)), 9);
    expect(r.a).toBeCloseTo(2.36, 2);
  });

  it('akselerasjonen avhenger ikke av massen', () => {
    const a1 = incline({ ...base, m: 1, alphaDeg: 40 }).a;
    const a2 = incline({ ...base, m: 10, alphaDeg: 40 }).a;
    expect(a1).toBeCloseTo(a2, 9);
  });

  it('grensevinkelen er arctan μs (μs = 0,5 gir 26,6°, μs = 1 gir 45°)', () => {
    expect(criticalAngleDeg(0.5)).toBeCloseTo(26.57, 2);
    expect(criticalAngleDeg(1)).toBeCloseTo(45, 9);
    // Akkurat på grensen ligger klossen fortsatt i ro
    expect(incline({ ...base, muS: 1, alphaDeg: 45 }).moving).toBe(false);
  });

  it('glatt skråplan gir a = g·sin α, og vannrett underlag gir N = G uten friksjon', () => {
    expect(incline({ m: 2, muS: 0, muK: 0, alphaDeg: 30 }).a).toBeCloseTo(4.905, 9);
    const flat = incline({ ...base, alphaDeg: 0 });
    expect(flat.N).toBeCloseTo(flat.G, 9);
    expect(flat.R).toBe(0);
    expect(flat.moving).toBe(false);
  });

  it('μk kan aldri bli større enn μs', () => {
    const r = incline({ m: 1, muS: 0.2, muK: 0.6, alphaDeg: 30 });
    expect(r.Rk).toBeCloseTo(r.Rmax, 9);
    expect(r.a).toBeGreaterThan(0);
  });
});

describe('heis', () => {
  it('vekta viser N = m(g + a)', () => {
    expect(scaleForce(70, 0)).toBeCloseTo(686.7, 1);
    expect(scaleForce(70, 2)).toBeCloseTo(826.7, 1);
    expect(scaleForce(70, -2)).toBeCloseTo(546.7, 1);
  });

  it('i fritt fall er normalkraften null, og den blir aldri negativ', () => {
    expect(scaleForce(70, -9.81)).toBe(0);
    expect(scaleForce(70, -12)).toBe(0);
  });

  it('tur opp: fart og forflytning fase for fase', () => {
    const ph = liftPhases('opp', 2);
    expect(liftState(ph, 0.5)).toMatchObject({ a: 0, v: 0, y: 0 });
    const acc = liftState(ph, 2);
    expect(acc.phase.kind).toBe('akselererer');
    expect(acc.a).toBe(2);
    expect(acc.v).toBeCloseTo(2, 9);
    expect(acc.y).toBeCloseTo(1, 9);
    const cruise = liftState(ph, 5);
    expect(cruise.phase.kind).toBe('konstant');
    expect(cruise.a).toBe(0);
    expect(cruise.v).toBeCloseTo(4, 9);
    const brake = liftState(ph, 8);
    expect(brake.phase.kind).toBe('bremser');
    expect(brake.a).toBe(-2);
    expect(brake.v).toBeGreaterThan(0);
    // Står stille til slutt etter 12·a0 = 24 m
    const end = liftState(ph, 10);
    expect(end.v).toBeCloseTo(0, 9);
    expect(end.y).toBeCloseTo(24, 9);
  });

  it('tur ned er speilbildet av tur opp', () => {
    const up = liftState(liftPhases('opp', 1.5), 8);
    const down = liftState(liftPhases('ned', 1.5), 8);
    expect(down.a).toBe(-up.a);
    expect(down.v).toBeCloseTo(-up.v, 9);
    expect(down.y).toBeCloseTo(-up.y, 9);
  });

  it('fritt fall: a = −g, og nødbremsen stopper heisen igjen', () => {
    const ph = liftPhases('fritt-fall', 2);
    const fall = liftState(ph, 2);
    expect(fall.phase.kind).toBe('fritt-fall');
    expect(fall.v).toBeCloseTo(-9.81, 9);
    expect(scaleForce(70, fall.a)).toBe(0);
    const brake = liftState(ph, 4);
    expect(brake.phase.kind).toBe('nodbrems');
    expect(scaleForce(70, brake.a)).toBeCloseTo(2 * 70 * 9.81, 9);
    const end = liftState(ph, 10);
    expect(end.v).toBeCloseTo(0, 9);
    expect(end.y).toBeCloseTo(-2 * 9.81 * 2, 9);
  });
});

describe('fall med luftmotstand', () => {
  it('terminalfart v_T = √(mg/k): fallskjermhopper på 80 kg med k = 0,25 kg/m', () => {
    expect(terminalVelocity(80, 0.25)).toBeCloseTo(56.03, 2);
    expect(terminalVelocity(80, 0)).toBe(Infinity);
  });

  it('starter med a = g og L = 0', () => {
    const r = dragFall(80, 0.25, 0);
    expect(r.v).toBe(0);
    expect(r.L).toBe(0);
    expect(r.a).toBeCloseTo(9.81, 9);
  });

  it('Newtons 2. lov gjelder hele veien: m·a = mg − kv²', () => {
    for (const t of [0.5, 2, 5, 12]) {
      const r = dragFall(70, 0.3, t);
      expect(70 * r.a).toBeCloseTo(70 * 9.81 - 0.3 * r.v ** 2, 9);
      // a = dv/dt (numerisk derivert)
      const h = 1e-5;
      const dv = (dragFall(70, 0.3, t + h).v - dragFall(70, 0.3, t - h).v) / (2 * h);
      expect(dv).toBeCloseTo(r.a, 4);
    }
  });

  it('nærmer seg terminalfarten, og L nærmer seg G', () => {
    const r = dragFall(80, 0.25, 60);
    expect(r.v).toBeCloseTo(terminalVelocity(80, 0.25), 6);
    expect(r.L).toBeCloseTo(80 * 9.81, 3);
    expect(r.a).toBeCloseTo(0, 6);
    expect(Number.isFinite(dragFall(40, 1, 500).s)).toBe(true);
  });

  it('i starten er fallet nesten som uten luftmotstand', () => {
    const t = 0.3;
    expect(dragFall(80, 0.25, t).v).toBeCloseTo(9.81 * t, 2);
    expect(dragFall(80, 0.25, t).s).toBeCloseTo(0.5 * 9.81 * t * t, 2);
    expect(dragFall(80, 0, 3)).toMatchObject({ v: 9.81 * 3, a: 9.81, L: 0 });
  });

  it('Eulers metode nærmer seg den eksakte løsningen når Δt blir liten', () => {
    const exact = dragFall(80, 0.25, 5).v;
    const coarse = eulerFall(80, 0.25, 1, 5).at(-1)![1];
    const fine = eulerFall(80, 0.25, 0.001, 5).at(-1)![1];
    expect(Math.abs(fine - exact)).toBeLessThan(0.01);
    expect(Math.abs(coarse - exact)).toBeGreaterThan(Math.abs(fine - exact));
    // Første steg: v = g·Δt
    expect(eulerFall(80, 0.25, 1, 2)[1]).toEqual([1, 9.81]);
  });
});

describe('eksempeloppgave: kasse ned en rampe', () => {
  it('standardtallene gir lærebokverdiene', () => {
    const s = solveRampTask(RAMP_TASKS[0]!);
    expect(s.G).toBeCloseTo(245.25, 2);
    expect(s.Gpar).toBeCloseTo(103.65, 1);
    expect(s.N).toBeCloseTo(222.27, 1);
    expect(s.R).toBeCloseTo(66.68, 1);
    expect(s.a).toBeCloseTo(1.479, 2);
    expect(s.v).toBeCloseTo(2.98, 2);
    expect(s.t).toBeCloseTo(2.01, 2);
    expect(s.critDeg).toBeCloseTo(24.2, 1);
  });

  it('a = g(sin α − μk cos α), og massen forkortes', () => {
    for (const task of RAMP_TASKS) {
      const s = solveRampTask(task);
      const al = (task.alphaDeg * Math.PI) / 180;
      expect(s.a).toBeCloseTo(9.81 * (Math.sin(al) - task.muK * Math.cos(al)), 10);
      expect(solveRampTask({ ...task, m: task.m * 3 }).a).toBeCloseTo(s.a, 10);
      // Bevegelseslikningene henger sammen: s = ½at² og v = at
      expect(0.5 * s.a * s.t * s.t).toBeCloseTo(task.L, 10);
      expect(s.a * s.t).toBeCloseTo(s.v, 10);
    }
  });

  it('i alle tallsettene glir kassen av seg selv (tan α > μs) og akselererer', () => {
    for (const task of RAMP_TASKS) {
      const s = solveRampTask(task);
      expect(task.alphaDeg).toBeGreaterThan(s.critDeg);
      expect(task.muK).toBeLessThan(task.muS);
      expect(s.a).toBeGreaterThan(0.5);
    }
  });
});
