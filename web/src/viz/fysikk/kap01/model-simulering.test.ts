import { describe, expect, it } from 'vitest';
import { eulerFall, exactPosition, exactVelocity, maxVelocityError, niceRange, terminalVelocity } from './model';
import {
  BODY_POSITIONS,
  DEPLOY_HEIGHT,
  EXIT_HEIGHT,
  SIM_DT_MAX,
  SIM_DT_MIN,
  altitude,
  bodyPoseOf,
  bodyPositionOf,
  dragForce,
  eulerStateAt,
  extremes,
  forceScale,
  isHeadDown,
  labelSpot,
  planeRise,
  PLANE_DEPTH,
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

  it('stillingen som tegnes, følger k: forhåndsvalgene gir sin egen stilling, egne verdier den nærmeste', () => {
    for (const b of BODY_POSITIONS) expect(bodyPoseOf(b.k)).toBe(b.id);
    expect(bodyPoseOf(0.1)).toBe('hode');
    expect(bodyPoseOf(0.16)).toBe('hode');
    expect(bodyPoseOf(0.17)).toBe('mage');
    expect(bodyPoseOf(0.32)).toBe('mage');
    expect(bodyPoseOf(0.33)).toBe('vid');
    expect(bodyPoseOf(0.5)).toBe('vid');
    // Grensene ligger mellom forhåndsvalgene
    const ks = BODY_POSITIONS.map((b) => b.k);
    expect(0.17).toBeGreaterThan(ks[0]!);
    expect(0.17).toBeLessThan(ks[1]!);
    expect(0.33).toBeGreaterThan(ks[1]!);
    expect(0.33).toBeLessThan(ks[2]!);
  });

  it('flyet glir oppover i dybdeskalaen når hopperen faller, og står stille i starten', () => {
    expect(planeRise(0, 86)).toBe(0);
    expect(planeRise(10, 86)).toBeCloseTo(10 * 86 * PLANE_DEPTH, 12);
    expect(planeRise(-3, 86)).toBe(0);
    expect(planeRise(Number.NaN, 86)).toBe(0);
    // Etter første steg med Δt = 1 s (s₁ = g · Δt² = 9,81 m) har flyet glidd over 200 figurenheter: ute av scenen
    const r = eulerFall(p, 1, 20);
    expect(planeRise(r[1]!.s, 150 / 1.75)).toBeGreaterThan(200);
    expect(PLANE_DEPTH).toBeGreaterThan(0);
    expect(PLANE_DEPTH).toBeLessThan(1);
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
    // Fallet til 1 000 m (3 000 m) med luftmotstand og magen ned tar ca. 1 min; lang tid i forhold til simuleringen
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

describe('plassen til verdien i avviksgrafen', () => {
  /** Avviksgrafen slik ErrorPlot tegner den: PC (f = 1, 800 × 260) og mobil (f = 1,8, 800 × 400). */
  function plot(q: { m: number; k: number }, f: number, height: number) {
    const T = simTime(terminalVelocity(q));
    const curve: [number, number][] = [];
    for (let d = SIM_DT_MIN; d <= SIM_DT_MAX + 1e-9; d += 0.05) curve.push([d, maxVelocityError(q, eulerFall(q, d, T))]);
    const peak = Math.max(...curve.map(([, e]) => e), 0.1);
    const [, yMax] = niceRange(0, peak * 1.05, 4, 0.5);
    const x0 = 72 * f;
    const x1 = 800 - 24 * f;
    const y1 = 34 * f;
    const y0 = height - 56 * f;
    const sx = (d: number) => x0 + (d / SIM_DT_MAX) * (x1 - x0);
    const sy = (e: number) => y0 - (e / yMax) * (y0 - y1);
    return { curve, pts: curve.map(([d, e]) => [sx(d), sy(e)] as [number, number]), sx, sy, box: { x0, x1, top: y1 + 6 * f, bottom: y0 }, T };
  }

  it('teksten står alltid inne i plottet, uten å krysse kurven eller dekke punktet, også ved Δt = 2,5 s', () => {
    for (const [f, height] of [
      [1, 260],
      [1.8, 400],
    ] as const)
      for (const m of [50, 80, 120])
        for (const k of [0.1, 0.25, 0.5]) {
          const q = { m, k };
          const { pts, sx, sy, box, T } = plot(q, f, height);
          for (const dt of [SIM_DT_MIN, 0.5, 1, 1.5, 2, 2.4, SIM_DT_MAX]) {
            const err = maxVelocityError(q, eulerFall(q, dt, T));
            const px = sx(dt);
            const py = sy(err);
            const h = 17 * 0.85 * f;
            const w = `${err.toFixed(2)} m/s`.length * 0.6 * h;
            const drop: [number, number][] = [
              [px, py],
              [px, box.bottom],
            ];
            const spot = labelSpot(pts, px, py, w, h, box, 10 * f, [drop]);
            const left = spot.anchor === 'end' ? spot.x - w : spot.x;
            expect(left).toBeGreaterThanOrEqual(box.x0 - 1e-6);
            expect(left + w).toBeLessThanOrEqual(box.x1 + 1e-6);
            expect(spot.y - h).toBeGreaterThanOrEqual(box.top - 1e-6);
            expect(spot.y + 0.25 * h).toBeLessThanOrEqual(box.bottom + 1e-6);
            expect(spot.crossing).toBe(false);
            // Punktet og den stiplede streken ned til aksen ligger utenfor teksten
            const overDrop = px > left && px < left + w && spot.y + 0.25 * h > py;
            expect(overDrop).toBe(false);
          }
        }
  });

  it('midt på en stigende kurve står teksten rett over til venstre for punktet, uten strek', () => {
    const pts: [number, number][] = [
      [0, 200],
      [400, 100],
    ];
    const s = labelSpot(pts, 200, 150, 60, 14, { x0: 0, x1: 400, top: 0, bottom: 200 }, 10);
    expect(s).toMatchObject({ x: 190, y: 140, anchor: 'end', leader: null, crossing: false });
  });

  it('i hjørnet oppe til høyre flyttes teksten inn i plottet, med strek til punktet når den står langt unna', () => {
    // Kurven stiger bratt mot punktet helt oppe i høyre hjørne
    const pts: [number, number][] = [
      [0, 200],
      [300, 120],
      [400, 6],
    ];
    const s = labelSpot(pts, 400, 6, 80, 14, { x0: 0, x1: 400, top: 0, bottom: 200 }, 10);
    expect(s.anchor === 'end' ? s.x : s.x + 80).toBeLessThanOrEqual(400);
    expect(s.y - 14).toBeGreaterThanOrEqual(0);
    expect(s.crossing).toBe(false);
  });
});
