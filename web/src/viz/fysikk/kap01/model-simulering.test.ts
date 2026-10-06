import { describe, expect, it } from 'vitest';
import { eulerFall, exactPosition, exactVelocity, terminalVelocity } from './model';
import {
  BODY_POSITIONS,
  DEPLOY_HEIGHT,
  EXIT_HEIGHT,
  SIM_DT_MAX,
  SIM_DT_MIN,
  altitude,
  bodyPositionOf,
  dragForce,
  eulerStateAt,
  extremes,
  forceScale,
  isHeadDown,
  rowStep,
  sDecimals,
  simTime,
  stepIndex,
  tableWindow,
  timeToFall,
  toKmh,
} from './model-simulering';

const p = { m: 80, k: 0.25 };
const g = 9.81;

describe('simuleringstid og tabell', () => {
  it('simulerer til farten er nær terminalfarten, i hele 5 s mellom 10 og 40 s', () => {
    expect(simTime(terminalVelocity(p))).toBe(20); // 3,2 · 56,0 / 9,81 = 18,3 → 20
    expect(simTime(terminalVelocity({ m: 50, k: 0.5 }))).toBe(15); // v_T = 31,3 m/s
    expect(simTime(terminalVelocity({ m: 120, k: 0.1 }))).toBe(40); // v_T = 108 m/s
    expect(simTime(5)).toBe(10);
    expect(simTime(Number.NaN)).toBe(10);
    for (const m of [50, 80, 120])
      for (const k of [0.1, 0.25, 0.5]) {
        const vT = terminalVelocity({ m, k });
        const T = simTime(vT);
        expect(T % 5).toBe(0);
        // Ved slutten er den eksakte farten minst 99 % av terminalfarten (eller vi har nådd taket på 40 s)
        if (T < 40) expect(exactVelocity({ m, k }, T)).toBeGreaterThan(0.99 * vT);
      }
  });

  it('desimaler på s: tre for små tidssteg, én ellers', () => {
    expect(sDecimals(0.1)).toBe(3);
    expect(sDecimals(0.4)).toBe(3);
    expect(sDecimals(0.5)).toBe(1);
    expect(sDecimals(2.5)).toBe(1);
  });

  it('vinduet i tabellen viser alltid steg n og neste rad', () => {
    expect(tableWindow(0, 21)).toBe(0);
    expect(tableWindow(4, 21)).toBe(0); // rad 0–5: steg 4 og 5 synes
    expect(tableWindow(5, 21)).toBe(2); // rad 2–7
    expect(tableWindow(20, 21)).toBe(15); // siste rader
    expect(tableWindow(3, 5)).toBe(0); // færre rader enn vinduet
    for (const total of [5, 6, 7, 21, 401])
      for (let n = 0; n < total; n++) {
        const start = tableWindow(n, total);
        expect(start).toBeGreaterThanOrEqual(0);
        expect(start).toBeLessThanOrEqual(n);
        expect(Math.min(n + 1, total - 1)).toBeLessThan(start + 6);
      }
  });
});

describe('steget simuleringen er i, og tilstanden mellom radene', () => {
  const rows = eulerFall(p, 1, 20);

  it('stegnummeret tåler flyttall: t = 0,6 s med Δt = 0,3 s er steg 2', () => {
    const r3 = eulerFall(p, 0.3, 20);
    expect(rowStep(r3)).toBeCloseTo(0.3, 12);
    expect(stepIndex(r3, 0.6)).toBe(2);
    expect(stepIndex(r3, 0.59)).toBe(1);
    expect(stepIndex(rows, 4)).toBe(4);
    expect(stepIndex(rows, 4.99)).toBe(4);
    expect(stepIndex(rows, -1)).toBe(0);
    expect(stepIndex(rows, 1e6)).toBe(rows.length - 1);
    expect(stepIndex(rows, Number.NaN)).toBe(0);
    expect(stepIndex([], 3)).toBe(0);
  });

  it('ved t_n er tilstanden lik raden, med L = kv² og a = (G − L)/m', () => {
    for (const n of [0, 1, 4, 10]) {
      const row = rows[n]!;
      const st = eulerStateAt(p, rows, row.t);
      expect(st.n).toBe(n);
      expect(st.v).toBeCloseTo(row.v, 12);
      expect(st.s).toBeCloseTo(row.s, 12);
      expect(st.a).toBeCloseTo(row.a, 12);
      expect(st.L).toBeCloseTo(0.25 * row.v * row.v, 9);
      expect(st.a).toBeCloseTo((p.m * g - st.L) / p.m, 9);
    }
    // Steg 4 med standardverdiene: v₄ = 35,33 m/s, L₄ = 312 N, a₄ = 5,91 m/s²
    const s4 = eulerStateAt(p, rows, 4);
    expect(s4.v).toBeCloseTo(35.33, 2);
    expect(s4.L).toBeCloseTo(312.0, 0);
    expect(s4.a).toBeCloseTo(5.91, 2);
    expect(rows[5]!.s).toBeCloseTo(133.7, 1);
  });

  it('i et steg holdes a og L faste, farten vokser lineært og ender i neste rad (ingen hopp)', () => {
    const r = eulerFall(p, 2, 20);
    for (let n = 0; n < r.length - 1; n++) {
      const a = r[n]!;
      const b = r[n + 1]!;
      const mid = eulerStateAt(p, r, a.t + 0.5);
      expect(mid.n).toBe(n);
      expect(mid.a).toBe(a.a);
      expect(mid.L).toBeCloseTo(dragForce(p, a.v), 12);
      expect(mid.v).toBeCloseTo(a.v + a.a * 0.5, 12);
      expect(mid.vn).toBe(a.v);
      // Like før neste rad er tilstanden (nesten) lik neste rad
      const end = eulerStateAt(p, r, b.t - 1e-9);
      expect(end.v).toBeCloseTo(b.v, 6);
      expect(end.s).toBeCloseTo(b.s, 6);
    }
    // Etter siste rad står tilstanden på siste rad
    const last = r[r.length - 1]!;
    const after = eulerStateAt(p, r, 999);
    expect(after.n).toBe(r.length - 1);
    expect(after.v).toBe(last.v);
    expect(after.t).toBe(last.t);
  });

  it('luftmotstanden virker mot farten og er null når hopperen står stille', () => {
    expect(dragForce(p, 0)).toBe(0);
    expect(dragForce(p, 10)).toBeCloseTo(25, 12);
    expect(dragForce(p, -10)).toBeCloseTo(-25, 12);
    expect(dragForce(p, terminalVelocity(p))).toBeCloseTo(p.m * g, 9); // L = G ved terminalfarten
  });
});

describe('kroppsstilling, høyde og utløsning', () => {
  it('kroppsstillingene gir realistiske terminalfarter for en hopper på 80 kg', () => {
    const kmh = (id: string) => toKmh(terminalVelocity({ m: 80, k: BODY_POSITIONS.find((b) => b.id === id)!.k }));
    expect(kmh('hode')).toBeGreaterThan(250);
    expect(kmh('hode')).toBeLessThan(330);
    expect(kmh('mage')).toBeGreaterThan(180);
    expect(kmh('mage')).toBeLessThan(220);
    expect(kmh('vid')).toBeGreaterThan(140);
    expect(kmh('vid')).toBeLessThan(175);
    // Alle ligger innenfor glidebryteren (0,10–0,50 kg/m) og på et helt hundredels steg
    for (const b of BODY_POSITIONS) {
      expect(b.k).toBeGreaterThanOrEqual(0.1);
      expect(b.k).toBeLessThanOrEqual(0.5);
      expect(Math.abs(b.k * 100 - Math.round(b.k * 100))).toBeLessThan(1e-9);
      expect(bodyPositionOf(b.k)).toBe(b.id);
    }
    expect(bodyPositionOf(0.31)).toBeNull();
    expect(isHeadDown(0.12)).toBe(true);
    expect(isHeadDown(0.25)).toBe(false);
  });

  it('høyden over bakken er 4 000 m minus strekningen, aldri negativ', () => {
    expect(altitude(0)).toBe(EXIT_HEIGHT);
    expect(altitude(133.7)).toBeCloseTo(3866.3, 9);
    expect(altitude(5000)).toBe(0);
    expect(altitude(Number.NaN)).toBe(EXIT_HEIGHT);
    expect(DEPLOY_HEIGHT).toBeLessThan(EXIT_HEIGHT);
  });

  it('tiden for å falle en strekning er den omvendte av den eksakte s(t)', () => {
    for (const q of [p, { m: 50, k: 0.5 }, { m: 120, k: 0.1 }])
      for (const t of [0.5, 3, 12, 40]) expect(timeToFall(q, exactPosition(q, t))).toBeCloseTo(t, 6);
    expect(timeToFall(p, 0)).toBe(0);
    // Fritt fall til 1 000 m (3 000 m) med magen ned tar ca. 1 min; lang tid i forhold til simuleringen
    const t = timeToFall(p, EXIT_HEIGHT - DEPLOY_HEIGHT);
    expect(t).toBeGreaterThan(55);
    expect(t).toBeLessThan(60);
    // Med hodet ned og stor masse når hopperen 1 000 m før simuleringen er ferdig (40 s)
    expect(timeToFall({ m: 120, k: 0.1 }, EXIT_HEIGHT - DEPLOY_HEIGHT)).toBeLessThan(40);
  });
});

describe('skalaer i scenen', () => {
  it('kraftskalaen er felles for G og L og krymper bare når en pil ellers går ut av figuren', () => {
    expect(forceScale(785, 785, 160, 160, 0.12)).toBeCloseTo(0.12, 12);
    expect(forceScale(1177, 1400, 150, 200, 0.12)).toBeCloseTo(150 / 1400, 12);
    expect(forceScale(1177, 900, 150, 100, 0.12)).toBeCloseTo(100 / 1177, 12);
    expect(forceScale(0, 0, 0, 0, 0.12)).toBe(0.12);
  });

  it('største fart og luftmotstand i simuleringen, også når store tidssteg skyter over', () => {
    const fine = eulerFall(p, SIM_DT_MIN, 20);
    const ef = extremes(p, fine);
    expect(ef.vMax).toBeLessThanOrEqual(terminalVelocity(p) + 1e-9);
    expect(ef.Lmax).toBeLessThanOrEqual(p.m * g + 1e-6);
    expect(ef.aMin).toBeCloseTo(0, 3);
    const q = { m: 50, k: 0.5 };
    const coarse = extremes(q, eulerFall(q, SIM_DT_MAX, 15));
    expect(coarse.vMax).toBeGreaterThan(terminalVelocity(q)); // skyter over
    expect(coarse.Lmax).toBeGreaterThan(q.m * g); // L > G et øyeblikk
    expect(coarse.aMin).toBeLessThan(0); // da bremses hopperen
  });

  it('alle ytterpunktene på glidebryterne gir endelige tilstander', () => {
    for (const m of [50, 120])
      for (const k of [0.1, 0.5])
        for (const dt of [SIM_DT_MIN, 1, SIM_DT_MAX]) {
          const q = { m, k };
          const T = simTime(terminalVelocity(q));
          const r = eulerFall(q, dt, T);
          for (const t of [0, dt / 2, 4, T / 2, T]) {
            const st = eulerStateAt(q, r, t);
            for (const v of [st.v, st.s, st.a, st.L]) expect(Number.isFinite(v)).toBe(true);
            expect(st.s).toBeGreaterThanOrEqual(0);
          }
          const e = extremes(q, r);
          expect(e.vMax).toBeLessThan(2 * terminalVelocity(q));
        }
  });
});
