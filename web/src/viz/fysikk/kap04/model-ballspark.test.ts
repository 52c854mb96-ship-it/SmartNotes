import { describe, expect, it } from 'vitest';
import {
  SPORTS,
  SPORT_IDS,
  fmaxFor,
  impulseIntegral,
  kick,
  kickAt,
  maxSpeed,
  pulseForce,
  pulseImpulse,
  shapeFactor,
  speedLevel,
  squashMax,
  typicalKick,
  type PulseShape,
} from './model-ballspark';

const SHAPES: PulseShape[] = ['bue', 'trekant'];

/** Trapesmetoden: ∫ f fra a til b med n delintervaller. */
function integrate(f: (t: number) => number, a: number, b: number, n = 4000): number {
  const h = (b - a) / n;
  let sum = (f(a) + f(b)) / 2;
  for (let i = 1; i < n; i++) sum += f(a + i * h);
  return sum * h;
}

describe('kraftpulsen', () => {
  it('arealet er 2/π · F_maks · Δt for en bue og ½ · F_maks · Δt for en trekant', () => {
    expect(shapeFactor('bue')).toBeCloseTo(2 / Math.PI, 12);
    expect(shapeFactor('trekant')).toBe(0.5);
    expect(pulseImpulse('bue', 1500, 0.01, 0.01)).toBeCloseTo((2 / Math.PI) * 15, 10);
    expect(pulseImpulse('trekant', 1500, 0.01, 0.01)).toBeCloseTo(7.5, 10);
  });

  it('kraften er null før og etter treffet og størst midt i', () => {
    for (const shape of SHAPES) {
      expect(pulseForce(shape, 1000, 0.01, -0.001)).toBe(0);
      expect(pulseForce(shape, 1000, 0.01, 0)).toBe(0);
      expect(pulseForce(shape, 1000, 0.01, 0.01)).toBe(0);
      expect(pulseForce(shape, 1000, 0.01, 0.02)).toBe(0);
      expect(pulseForce(shape, 1000, 0.01, 0.005)).toBeCloseTo(1000, 9);
      // Symmetrisk om midten
      expect(pulseForce(shape, 1000, 0.01, 0.002)).toBeCloseTo(pulseForce(shape, 1000, 0.01, 0.008), 9);
      expect(pulseForce(shape, 1000, 0.01, 0.003)).toBeLessThan(1000);
    }
    expect(pulseForce('trekant', 1000, 0.01, 0.0025)).toBeCloseTo(500, 9);
    expect(pulseForce('bue', 1000, 0.01, 0.0025)).toBeCloseTo(1000 * Math.SQRT1_2, 9);
  });

  it('impulsen så langt er arealet under kraftkurven (numerisk integrasjon)', () => {
    for (const shape of SHAPES) {
      for (const t of [0.001, 0.0025, 0.005, 0.0071, 0.0099]) {
        const num = integrate((u) => pulseForce(shape, 1200, 0.01, u), 0, t);
        expect(pulseImpulse(shape, 1200, 0.01, t)).toBeCloseTo(num, 6);
      }
      // Halve arealet er nådd midt i treffet (symmetrisk puls)
      expect(pulseImpulse(shape, 1200, 0.01, 0.005)).toBeCloseTo(pulseImpulse(shape, 1200, 0.01, 0.01) / 2, 10);
      // Før treffet ingen impuls, etter treffet hele arealet
      expect(pulseImpulse(shape, 1200, 0.01, -0.003)).toBe(0);
      expect(pulseImpulse(shape, 1200, 0.01, 0.05)).toBeCloseTo(shapeFactor(shape) * 12, 10);
    }
  });

  it('∫ I dt stemmer med numerisk integrasjon, også etter treffet', () => {
    for (const shape of SHAPES) {
      for (const t of [0.002, 0.005, 0.0083, 0.01, 0.016]) {
        const num = integrate((u) => pulseImpulse(shape, 900, 0.01, u), 0, t);
        expect(impulseIntegral(shape, 900, 0.01, t)).toBeCloseTo(num, 8);
      }
      // Ved slutten av treffet: I · Δt / 2
      const I = shapeFactor(shape) * 900 * 0.01;
      expect(impulseIntegral(shape, 900, 0.01, 0.01)).toBeCloseTo((I * 0.01) / 2, 12);
      expect(impulseIntegral(shape, 900, 0.01, -1)).toBe(0);
    }
  });

  it('er kontinuerlig midt i trekanten og ved slutten av treffet', () => {
    const dt = 0.008;
    for (const shape of SHAPES) {
      for (const t of [dt / 2, dt]) {
        // Over 2 ns endres I med høyst F_maks · 2 ns = 1,4 · 10⁻⁶ N·s, og ∫ I dt med høyst I · 2 ns
        expect(pulseImpulse(shape, 700, dt, t - 1e-9)).toBeCloseTo(pulseImpulse(shape, 700, dt, t + 1e-9), 5);
        expect(impulseIntegral(shape, 700, dt, t - 1e-9)).toBeCloseTo(impulseIntegral(shape, 700, dt, t + 1e-9), 7);
      }
    }
  });

  it('gir null og ikke NaN når kontakttiden er null', () => {
    for (const shape of SHAPES) {
      expect(pulseForce(shape, 1000, 0, 0.001)).toBe(0);
      expect(pulseImpulse(shape, 1000, 0, 0.001)).toBe(0);
      expect(impulseIntegral(shape, 1000, 0, 0.001)).toBe(0);
    }
  });
});

describe('treffet', () => {
  it('et typisk spark: 1,5 kN i 10 ms gir I = 9,55 N·s og v = 22,2 m/s (80 km/h)', () => {
    const r = kick(0.43, 1500, 0.01, 'bue');
    expect(r.I).toBeCloseTo(9.549, 3);
    expect(r.Favg).toBeCloseTo(954.9, 1);
    expect(r.v).toBeCloseTo(22.21, 2);
    expect(r.kmh).toBeCloseTo(79.9, 1);
    // Impulsloven: I = Δp = m·v − 0
    expect(r.p).toBeCloseTo(r.I, 12);
    expect(r.Ek).toBeCloseTo(0.5 * 0.43 * r.v ** 2, 9);
    // Ballen flytter seg v·Δt/2 ≈ 11 cm mens den er i kontakt med foten
    expect(r.contactDist).toBeCloseTo((r.v * 0.01) / 2, 12);
  });

  it('trekantform: I = ½ · F_maks · Δt', () => {
    const r = kick(0.057, 800, 0.004, 'trekant');
    expect(r.I).toBeCloseTo(1.6, 12);
    expect(r.v).toBeCloseTo(1.6 / 0.057, 10);
    expect(r.Favg).toBeCloseTo(400, 9);
  });

  it('dobbel kontakttid eller dobbel kraft gir dobbel impuls og dobbel fart', () => {
    for (const shape of SHAPES) {
      const a = kick(0.43, 1500, 0.01, shape);
      const b = kick(0.43, 1500, 0.02, shape);
      const c = kick(0.43, 3000, 0.01, shape);
      expect(b.I / a.I).toBeCloseTo(2, 12);
      expect(c.v / a.v).toBeCloseTo(2, 12);
      // Gjennomsnittskraften avhenger bare av F_maks og formen
      expect(b.Favg).toBeCloseTo(a.Favg, 9);
    }
  });

  it('samme impuls gir større fart til en lettere ball (v = I/m)', () => {
    const fot = kick(0.43, 1500, 0.01, 'bue');
    const golf = kick(0.0459, 9000, 0.00045, 'bue');
    expect(golf.I).toBeLessThan(fot.I);
    expect(golf.v).toBeGreaterThan(2 * fot.v);
  });

  it('tilstanden underveis følger impulsloven: m·v = arealet så langt', () => {
    const m = 0.43;
    for (const shape of SHAPES) {
      for (const t of [-0.004, 0, 0.002, 0.005, 0.009, 0.01, 0.014]) {
        const st = kickAt(m, 1500, 0.01, shape, t);
        expect(m * st.v).toBeCloseTo(st.I, 12);
        expect(st.F).toBe(pulseForce(shape, 1500, 0.01, t));
      }
      expect(kickAt(m, 1500, 0.01, shape, -0.004)).toEqual({ F: 0, I: 0, v: 0, s: 0, phase: 'for' });
      expect(kickAt(m, 1500, 0.01, shape, 0.005).phase).toBe('under');
      const after = kickAt(m, 1500, 0.01, shape, 0.01);
      expect(after.phase).toBe('etter');
      expect(after.v).toBeCloseTo(kick(m, 1500, 0.01, shape).v, 12);
      // Etter treffet: konstant fart, så strekningen vokser lineært
      const s1 = kickAt(m, 1500, 0.01, shape, 0.012).s;
      const s2 = kickAt(m, 1500, 0.01, shape, 0.016).s;
      expect((s2 - s1) / 0.004).toBeCloseTo(after.v, 9);
      // Farten øker hele tiden under treffet (kraften er aldri negativ)
      let prev = -1;
      for (let i = 0; i <= 20; i++) {
        const v = kickAt(m, 1500, 0.01, shape, (i / 20) * 0.01).v;
        expect(v).toBeGreaterThanOrEqual(prev);
        prev = v;
      }
    }
  });

  it('fmaxFor er den omvendte av kick', () => {
    for (const shape of SHAPES) {
      const F = fmaxFor(0.43, 30, 0.01, shape);
      expect(kick(0.43, F, 0.01, shape).v).toBeCloseTo(30, 10);
    }
    expect(fmaxFor(0.43, 30, 0.01, 'bue')).toBeCloseTo((0.43 * 30 * Math.PI) / (2 * 0.01), 8);
  });
});

describe('ballene', () => {
  it('har realistiske masser og radier', () => {
    expect(SPORTS.fotball.m).toBeCloseTo(0.43, 3);
    expect(SPORTS.tennis.m).toBeGreaterThan(0.056);
    expect(SPORTS.tennis.m).toBeLessThan(0.0594);
    expect(SPORTS.golf.m).toBeLessThanOrEqual(0.04593);
    expect(2 * SPORTS.fotball.r).toBeCloseTo(0.22, 2);
    expect(2 * SPORTS.tennis.r).toBeCloseTo(0.067, 3);
    expect(2 * SPORTS.golf.r).toBeCloseTo(0.0427, 3);
  });

  it('standardverdiene ligger på glidebryterne og gir et realistisk treff', () => {
    const expected: Record<string, [number, number, string]> = {
      // [fart i m/s, presisjon, nivå]
      fotball: [22.2, 1, 'hardt'],
      tennis: [39.1, 1, 'hardt'],
      golf: [56.2, 1, 'middels'],
    };
    for (const id of SPORT_IDS) {
      const s = SPORTS[id];
      for (const r of [s.dtMs, s.F]) {
        expect(r.def).toBeGreaterThanOrEqual(r.min);
        expect(r.def).toBeLessThanOrEqual(r.max);
        // Standardverdien og maks er på et steg fra min
        for (const v of [r.def, r.max]) {
          const k = (v - r.min) / r.step;
          expect(Math.abs(k - Math.round(k))).toBeLessThan(1e-9);
        }
      }
      // Aksene har plass til den største verdien på glidebryterne
      expect(s.tAxisMs).toBeGreaterThan(s.dtMs.max);
      expect(s.FAxis).toBeGreaterThan(s.F.max);
      // Toppen av pulsen holder seg under etikettene øverst i grafen (øverste 30 %)
      expect(s.F.max / s.FAxis).toBeLessThanOrEqual(0.71);
      const k = typicalKick(s);
      const [v, d, level] = expected[id]!;
      expect(k.v).toBeCloseTo(v, d);
      expect(speedLevel(s, k.v).id).toBe(level);
    }
  });

  it('kontakttidene og kreftene er i riktig rekkefølge: golf kortest og størst', () => {
    const f = typicalKick(SPORTS.fotball);
    const t = typicalKick(SPORTS.tennis);
    const g = typicalKick(SPORTS.golf);
    expect(SPORTS.golf.dtMs.def).toBeLessThan(SPORTS.tennis.dtMs.def);
    expect(SPORTS.tennis.dtMs.def).toBeLessThan(SPORTS.fotball.dtMs.def);
    expect(SPORTS.golf.F.def).toBeGreaterThan(SPORTS.fotball.F.def);
    // Fotballen får størst impuls, men golfballen størst fart
    expect(f.I).toBeGreaterThan(g.I);
    expect(f.I).toBeGreaterThan(t.I);
    expect(g.v).toBeGreaterThan(t.v);
    expect(t.v).toBeGreaterThan(f.v);
  });

  it('største mulige fart (til skalaen på fartspila) er større enn i et typisk treff', () => {
    expect(maxSpeed(SPORTS.fotball)).toBeCloseTo(62.2, 1);
    expect(maxSpeed(SPORTS.tennis)).toBeCloseTo(107.2, 1);
    expect(maxSpeed(SPORTS.golf)).toBeCloseTo(135.9, 1);
    for (const id of SPORT_IDS) expect(maxSpeed(SPORTS[id])).toBeGreaterThan(2 * typicalKick(SPORTS[id]).v);
  });

  it('alle ytterpunkter på glidebryterne gir endelige tall', () => {
    for (const id of SPORT_IDS) {
      const s = SPORTS[id];
      for (const dt of [s.dtMs.min, s.dtMs.max])
        for (const F of [s.F.min, s.F.max])
          for (const shape of SHAPES) {
            const r = kick(s.m, F, dt / 1000, shape);
            for (const v of Object.values(r)) expect(Number.isFinite(v)).toBe(true);
            expect(r.v).toBeGreaterThan(0.5);
            const q = squashMax(s, F, dt);
            expect(q).toBeGreaterThanOrEqual(0.04);
            expect(q).toBeLessThanOrEqual(0.45);
          }
    }
  });

  it('fartsnivåene er stigende og dekker alle farter', () => {
    for (const id of SPORT_IDS) {
      const ls = SPORTS[id].levels;
      expect(ls.map((l) => l.id)).toEqual(['rolig', 'middels', 'hardt', 'topp', 'ekstrem']);
      for (let i = 1; i < ls.length; i++) expect(ls[i]!.upTo).toBeGreaterThan(ls[i - 1]!.upTo);
      expect(ls[ls.length - 1]!.upTo).toBe(Infinity);
      expect(speedLevel(SPORTS[id], 0).id).toBe('rolig');
      expect(speedLevel(SPORTS[id], 1e6).id).toBe('ekstrem');
    }
    // Grensene: et skudd på 45 m/s (162 km/h) er mer enn nesten noen klarer
    expect(speedLevel(SPORTS.fotball, 44.9).id).toBe('topp');
    expect(speedLevel(SPORTS.fotball, 45).id).toBe('ekstrem');
  });

  it('sammentrykningen vokser med kraften og kontakttiden, og er standard ved standardverdiene', () => {
    const s = SPORTS.fotball;
    expect(squashMax(s, s.F.def, s.dtMs.def)).toBeCloseTo(s.squashDef, 12);
    expect(squashMax(s, 1800, 10)).toBeGreaterThan(squashMax(s, 1500, 10));
    expect(squashMax(s, 1500, 11)).toBeGreaterThan(squashMax(s, 1500, 10));
    expect(squashMax(s, Number.NaN, 10)).toBe(0.04);
  });
});
