import { describe, expect, it } from 'vitest';
import {
  BODY_LENGTH,
  BRIDGE_HEIGHT,
  BUNGEE_RANGES,
  bungeeKeyPoints,
  bungeeState,
  inG,
  momentTime,
  simulateBungee,
  type BungeeParams,
} from './model-strikkhopp';

const g = 9.81;
const START: BungeeParams = { m: BUNGEE_RANGES.m.start, L0: BUNGEE_RANGES.L0.start, k: BUNGEE_RANGES.k.start };

/** Alle hjørnene i parameterrommet pluss standardverdiene (s_maks er monoton i hver parameter). */
function corners(): BungeeParams[] {
  const r = BUNGEE_RANGES;
  const out: BungeeParams[] = [START];
  for (const m of [r.m.min, r.m.max])
    for (const L0 of [r.L0.min, r.L0.max]) for (const k of [r.k.min, r.k.max]) out.push({ m, L0, k });
  return out;
}

describe('strikkhopp: nøkkeltall', () => {
  it('stemmer med regning for hånd (70 kg, 20 m, 120 N/m)', () => {
    const key = bungeeKeyPoints(START);
    expect(key.G).toBeCloseTo(686.7, 6);
    expect(key.dEq).toBeCloseTo(686.7 / 120, 9); // 5,7225 m
    expect(key.tTaut).toBeCloseTo(Math.sqrt(40 / g), 9); // 2,019 s
    expect(key.vTaut).toBeCloseTo(Math.sqrt(2 * g * 20), 9); // 19,81 m/s
    // Laveste punkt fra mg·s = ½k(s − L₀)² (energibevaring, kapittel 3): s = L₀ + d + √(d² + 2dL₀)
    const d = 686.7 / 120;
    const sMax = 20 + d + Math.sqrt(d * d + 2 * d * 20);
    expect(key.sMax).toBeCloseTo(sMax, 9);
    expect(key.sMax).toBeCloseTo(41.90, 2);
    expect(key.hMin).toBeCloseTo(BRIDGE_HEIGHT - sMax, 9);
    // Største akselerasjon: a = g · √(1 + 2L₀/d) ≈ 27,7 m/s² ≈ 2,8 g
    expect(key.aMax).toBeCloseTo(g * Math.sqrt(1 + (2 * 20) / d), 9);
    expect(key.aMax).toBeCloseTo(27.73, 2);
    expect(inG(key.aMax)).toBeCloseTo(2.83, 2);
    // Største fart: v = √(2gL₀ + gd) ≈ 21,2 m/s
    expect(key.vMax).toBeCloseTo(Math.sqrt(2 * g * 20 + g * d), 9);
    expect(key.vMax).toBeCloseTo(21.18, 2);
    // Strikkraften i bunnen er m(g + a)
    expect(key.SMax).toBeCloseTo(70 * (g + key.aMax), 6);
  });

  it('har tidene i riktig rekkefølge: stram < størst fart < bunn < slakk igjen < periode', () => {
    for (const p of corners()) {
      const key = bungeeKeyPoints(p);
      expect(key.tTaut).toBeLessThan(key.tVmax);
      expect(key.tVmax).toBeLessThan(key.tBottom);
      expect(key.tBottom).toBeLessThan(key.tEnd);
      expect(key.tEnd).toBeLessThan(key.period);
      // Strekkfasen er symmetrisk om bunnen
      expect(key.tEnd - key.tBottom).toBeCloseTo(key.tBottom - key.tTaut, 9);
      expect(momentTime(key, 'stram')).toBe(key.tTaut);
      expect(momentTime(key, 'vmaks')).toBe(key.tVmax);
      expect(momentTime(key, 'bunn')).toBe(key.tBottom);
    }
  });

  it('uten slakk strikk (L₀ → 0) blir største strekk 2 · mg/k og største akselerasjon g', () => {
    const p = { m: 70, L0: 1e-9, k: 120 };
    const key = bungeeKeyPoints(p);
    expect(key.sMax).toBeCloseTo(2 * key.dEq, 6);
    expect(key.aMax).toBeCloseTo(g, 6);
    expect(key.SMax).toBeCloseTo(2 * key.G, 6);
  });

  it('en svært stiv strikk stopper hopperen like etter at den strammes, med enorm akselerasjon', () => {
    const key = bungeeKeyPoints({ m: 70, L0: 20, k: 1e7 });
    // Δx = d + √(d² + 2dL₀) ≈ √(2dL₀) ≈ 5 cm
    expect(key.sMax - 20).toBeLessThan(0.06);
    expect(key.aMax).toBeGreaterThan(1000);
    expect(key.vMax).toBeCloseTo(key.vTaut, 2);
  });

  it('tyngre, lengre og mykere gir lavere laveste punkt; stivere og lengre gir større akselerasjon', () => {
    const base = bungeeKeyPoints(START);
    expect(bungeeKeyPoints({ ...START, m: 90 }).sMax).toBeGreaterThan(base.sMax);
    expect(bungeeKeyPoints({ ...START, L0: 24 }).sMax).toBeGreaterThan(base.sMax);
    expect(bungeeKeyPoints({ ...START, k: 100 }).sMax).toBeGreaterThan(base.sMax);
    expect(bungeeKeyPoints({ ...START, k: 160 }).aMax).toBeGreaterThan(base.aMax);
    expect(bungeeKeyPoints({ ...START, L0: 24 }).aMax).toBeGreaterThan(base.aMax);
    // Tyngre hopper med samme strikk: mykere oppbremsing (mindre a), men lavere punkt
    expect(bungeeKeyPoints({ ...START, m: 90 }).aMax).toBeLessThan(base.aMax);
  });

  it('holder hodet over vannet og gir fornuftige tall for alle ytterverdier', () => {
    for (const p of corners()) {
      const key = bungeeKeyPoints(p);
      for (const v of Object.values(key)) expect(Number.isFinite(v)).toBe(true);
      expect(key.headClearance).toBeGreaterThan(5);
      expect(key.hMin).toBeGreaterThan(BODY_LENGTH + 5);
      expect(key.sMax).toBeGreaterThan(p.L0);
      expect(key.aMax).toBeGreaterThan(g);
      expect(key.aMax).toBeLessThan(60); // figurens akse går til 60 m/s²
      expect(key.vMax).toBeLessThan(30); // fartsaksen går til ±30 m/s
      expect(key.tEnd).toBeGreaterThan(2.5);
      expect(key.tEnd).toBeLessThan(8);
    }
  });
});

describe('strikkhopp: bevegelsen', () => {
  it('starter i ro på brua og faller fritt til strikken strammes', () => {
    const key = bungeeKeyPoints(START);
    const s0 = bungeeState(START, 0, key);
    expect(s0.s).toBe(0);
    expect(s0.h).toBe(BRIDGE_HEIGHT);
    expect(s0.v).toBeCloseTo(0, 12);
    expect(s0.a).toBeCloseTo(-g, 12);
    expect(s0.S).toBe(0);
    const s1 = bungeeState(START, 1.5, key);
    expect(s1.phase).toBe('fritt-fall-ned');
    expect(s1.s).toBeCloseTo(0.5 * g * 1.5 * 1.5, 9);
    expect(s1.v).toBeCloseTo(-g * 1.5, 9);
    expect(s1.a).toBeCloseTo(-g, 12);
    expect(s1.sumF).toBeCloseTo(-s1.G, 9);
  });

  it('er kontinuerlig der strikken strammes', () => {
    const key = bungeeKeyPoints(START);
    const a = bungeeState(START, key.tTaut - 1e-9, key);
    const b = bungeeState(START, key.tTaut + 1e-9, key);
    expect(b.s).toBeCloseTo(START.L0, 6);
    expect(b.s - a.s).toBeCloseTo(0, 6);
    expect(b.v - a.v).toBeCloseTo(0, 6);
    expect(b.a - a.a).toBeCloseTo(0, 5);
  });

  it('har ΣF = 0, a = 0 og størst fart i likevektspunktet', () => {
    for (const p of corners()) {
      const key = bungeeKeyPoints(p);
      const st = bungeeState(p, key.tVmax, key);
      expect(st.s).toBeCloseTo(key.sEq, 8);
      expect(st.S).toBeCloseTo(st.G, 6);
      expect(st.sumF).toBeCloseTo(0, 6);
      expect(st.a).toBeCloseTo(0, 8);
      expect(-st.v).toBeCloseTo(key.vMax, 8);
      // Farten er mindre like før og like etter
      expect(Math.abs(bungeeState(p, key.tVmax - 0.05, key).v)).toBeLessThan(key.vMax);
      expect(Math.abs(bungeeState(p, key.tVmax + 0.05, key).v)).toBeLessThan(key.vMax);
    }
  });

  it('har v = 0 og størst akselerasjon oppover i det laveste punktet', () => {
    for (const p of corners()) {
      const key = bungeeKeyPoints(p);
      const st = bungeeState(p, key.tBottom, key);
      expect(st.s).toBeCloseTo(key.sMax, 8);
      expect(st.v).toBeCloseTo(0, 8);
      expect(st.a).toBeCloseTo(key.aMax, 6);
      expect(st.S).toBeCloseTo(key.SMax, 6);
      expect(bungeeState(p, key.tBottom + 0.01, key).phase).toBe('strukket-opp');
      // Største a i hele bevegelsen
      for (let t = 0; t <= key.tEnd; t += key.tEnd / 400) expect(bungeeState(p, t, key).a).toBeLessThanOrEqual(key.aMax + 1e-9);
    }
  });

  it('bevarer mekanisk energi: mg·s = ½mv² + ½k(Δx)²', () => {
    for (const p of corners()) {
      const key = bungeeKeyPoints(p);
      for (let i = 0; i <= 200; i++) {
        const st = bungeeState(p, (key.period * i) / 200, key);
        const lost = p.m * g * st.s;
        const gained = 0.5 * p.m * st.v * st.v + 0.5 * p.k * st.dx * st.dx;
        expect(gained).toBeCloseTo(lost, 6);
      }
    }
  });

  it('følger Newtons 2. lov: a = (S − G)/m, og v og a er stigningstallene til h og v', () => {
    const key = bungeeKeyPoints(START);
    const e = 1e-5;
    for (let t = 0.1; t < key.tEnd; t += 0.137) {
      const st = bungeeState(START, t, key);
      expect(st.a).toBeCloseTo((st.S - st.G) / START.m, 12);
      const before = bungeeState(START, t - e, key);
      const after = bungeeState(START, t + e, key);
      expect((after.h - before.h) / (2 * e)).toBeCloseTo(st.v, 4);
      expect((after.v - before.v) / (2 * e)).toBeCloseTo(st.a, 3);
    }
  });

  it('stemmer med utregning i små tidssteg (Euler–Cromer, 2F)', () => {
    for (const p of [START, { m: 40, L0: 25, k: 250 }, { m: 120, L0: 25, k: 80 }]) {
      const key = bungeeKeyPoints(p);
      const pts = simulateBungee(p, 1e-4, key.tEnd);
      let deepest = 0;
      let tDeep = 0;
      let fastest = 0;
      for (const [t, s, v] of pts) {
        if (s > deepest) {
          deepest = s;
          tDeep = t;
        }
        fastest = Math.max(fastest, -v);
      }
      expect(deepest).toBeCloseTo(key.sMax, 2);
      expect(tDeep).toBeCloseTo(key.tBottom, 2);
      expect(fastest).toBeCloseTo(key.vMax, 2);
      const last = pts[pts.length - 1]!;
      expect(last[1]).toBeCloseTo(p.L0, 1);
    }
  });

  it('er symmetrisk: strikken blir slakk igjen i samme høyde med like stor fart oppover', () => {
    for (const p of corners()) {
      const key = bungeeKeyPoints(p);
      const st = bungeeState(p, key.tEnd, key);
      expect(st.s).toBeCloseTo(p.L0, 8);
      expect(st.v).toBeCloseTo(key.vTaut, 8);
      expect(st.a).toBeCloseTo(-g, 6);
    }
  });

  it('er periodisk uten energitap, og gir aldri NaN', () => {
    const key = bungeeKeyPoints(START);
    const top = bungeeState(START, key.period, key);
    expect(top.s).toBeCloseTo(0, 9);
    expect(top.v).toBeCloseTo(0, 9);
    const a = bungeeState(START, 3.3, key);
    const b = bungeeState(START, 3.3 + key.period, key);
    expect(b.s).toBeCloseTo(a.s, 8);
    expect(b.v).toBeCloseTo(a.v, 8);
    const up = bungeeState(START, key.tEnd + 0.5 * key.tTaut, key);
    expect(up.phase).toBe('fritt-fall-opp');
    expect(up.v).toBeGreaterThan(0);
    for (const t of [-1, 0, NaN, Infinity]) {
      const st = bungeeState(START, t, key);
      expect(Number.isFinite(st.s) && Number.isFinite(st.v) && Number.isFinite(st.a)).toBe(true);
    }
  });
});
