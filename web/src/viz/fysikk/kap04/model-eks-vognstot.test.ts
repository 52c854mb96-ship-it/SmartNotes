import { describe, expect, it } from 'vitest';
import { WAGON_TASKS, peakForce, pulseForce, roundSig, sigDecimals, solveWagonTask, type WagonTask } from './model-eks-vognstot';

const g = 9.81;

describe('vognstøt: tallsett 1 (38 t i 1,5 m/s inn i 13 t i ro)', () => {
  const task = WAGON_TASKS[0]!;
  const s = solveWagonTask(task);

  it('a) Σp = 57 000 kg·m/s, og V = 57 000/51 000 = 1,118 m/s (om lag 1,1 m/s)', () => {
    expect(s.pA).toBe(57_000);
    expect(s.pB).toBe(0);
    expect(s.p).toBe(57_000);
    expect(s.M).toBe(51_000);
    expect(s.V).toBeCloseTo(57 / 51, 12);
    expect(s.V).toBeCloseTo(1.117647, 6);
    expect(s.VShown).toBeCloseTo(1.1, 12);
  });

  it('b) 42,75 kJ før og 31,85 kJ etter: 10,90 kJ (25,5 %) blir omdannet', () => {
    expect(s.EkA).toBeCloseTo(42_750, 9);
    expect(s.EkB).toBe(0);
    expect(s.EkAfter).toBeCloseTo(31_852.94, 2);
    expect(s.lost).toBeCloseTo(10_897.06, 2);
    expect(s.lossShare).toBeCloseTo(0.254902, 6);
    // B står i ro: andelen er m_B/(m_A + m_B) = 13/51
    expect(s.lossShare).toBeCloseTo(13 / 51, 12);
  });

  it('a) bevaring av kinetisk energi ville gitt en for stor fart (1,29 m/s)', () => {
    expect(s.vEnergyWrong).toBeCloseTo(1.294786, 6);
    expect(s.vEnergyWrong).toBeGreaterThan(s.V);
    // Fortegnet spiller ingen rolle når B står i ro
    expect(s.vSignWrong).toBeCloseTo(s.V, 12);
  });

  it('d) impulsene er −14 529 N·s på A og +14 529 N·s på B', () => {
    expect(s.IA).toBeCloseTo(-14_529.41, 2);
    expect(s.IB).toBeCloseTo(14_529.41, 2);
    expect(s.dvA).toBeCloseTo(-0.382353, 6);
    expect(s.dvB).toBeCloseTo(1.117647, 6);
  });

  it('e) F = 14 529/0,30 = 48,4 kN, a_A = 1,27 m/s² og a_B = 3,73 m/s²', () => {
    expect(s.F).toBeCloseTo(48_431.37, 2);
    expect(s.aA).toBeCloseTo(1.27451, 5);
    expect(s.aB).toBeCloseTo(3.72549, 5);
    // Samme som fartsendringen delt på tiden
    expect(s.aA).toBeCloseTo(-s.dvA / task.dt, 12);
    expect(s.aB).toBeCloseTo(s.dvB / task.dt, 12);
  });
});

describe('vognstøt: tallsett 2 (B triller samme vei) og 3 (B triller mot A)', () => {
  it('tallsett 2: Σp = 80 000 kg·m/s, V = 1,481 m/s, 17,2 % tapt, F = 55,1 kN', () => {
    const t = WAGON_TASKS[1]!;
    const s = solveWagonTask(t);
    expect(s.pA).toBeCloseTo(68_000, 9);
    expect(s.pB).toBeCloseTo(12_000, 9);
    expect(s.p).toBeCloseTo(80_000, 9);
    expect(s.V).toBeCloseTo(80 / 54, 12);
    expect(s.VShown).toBeCloseTo(1.5, 12);
    expect(s.EkBefore).toBeCloseTo(71_600, 9);
    expect(s.EkAfter).toBeCloseTo(59_259.26, 2);
    expect(s.lossShare).toBeCloseTo(0.172357, 6);
    expect(s.IB).toBeCloseTo(17_629.63, 2);
    expect(s.F).toBeCloseTo(55_092.59, 2);
    expect(s.aA).toBeCloseTo(1.62037, 5);
    expect(s.aB).toBeCloseTo(2.75463, 5);
  });

  it('tallsett 3: Σp = 64 000 − 11 200 = 52 800 kg·m/s, V = 0,978 m/s, 53,6 % tapt, F = 62,2 kN', () => {
    const t = WAGON_TASKS[2]!;
    const s = solveWagonTask(t);
    expect(s.pB).toBeCloseTo(-11_200, 9);
    expect(s.p).toBeCloseTo(52_800, 9);
    expect(s.V).toBeCloseTo(52.8 / 54, 12);
    expect(s.VShown).toBeCloseTo(0.98, 12);
    expect(s.EkBefore).toBeCloseTo(55_680, 9);
    expect(s.lost).toBeCloseTo(29_866.67, 2);
    expect(s.lossShare).toBeCloseTo(0.536398, 6);
    expect(s.IB).toBeCloseTo(24_888.89, 2);
    expect(s.F).toBeCloseTo(62_222.22, 2);
    expect(s.aB).toBeCloseTo(4.444444, 6);
  });

  it('tallsett 3: glemmer du fortegnet til v_B, får du 1,39 m/s i stedet for 0,98 m/s', () => {
    const s = solveWagonTask(WAGON_TASKS[2]!);
    expect(s.vSignWrong).toBeCloseTo(75.2 / 54, 12);
    expect(s.vSignWrong).toBeGreaterThan(s.V + 0.3);
  });
});

describe('vognstøt: lovene og sammenhengene', () => {
  const tasks: WagonTask[] = [
    ...WAGON_TASKS,
    { mA: 10_000, vA: 2, mB: 10_000, vB: 0, dt: 0.2, loadA: 'tom', loadB: 'tom' }, // like masser
    { mA: 20_000, vA: 1, mB: 20_000, vB: -1, dt: 0.5, loadA: 'tom', loadB: 'tom' }, // like store og motsatte p
    { mA: 30_000, vA: 1.2, mB: 15_000, vB: 1.2, dt: 0.3, loadA: 'tom', loadB: 'tom' }, // samme fart: ingen støt
    { mA: 80_000, vA: 1, mB: 1_000, vB: 0, dt: 0.3, loadA: 'tom', loadB: 'tom' }, // svært tung A
  ];

  it('bevegelsesmengden er bevart: m_A·v_A + m_B·v_B = (m_A + m_B)·V', () => {
    for (const t of tasks) {
      const s = solveWagonTask(t);
      expect(t.mA * t.vA + t.mB * t.vB).toBeCloseTo(s.M * s.V, 8);
      expect(s.p).toBeCloseTo(s.pA + s.pB, 8);
    }
  });

  it('V ligger mellom v_B og v_A (vognene får felles fart)', () => {
    for (const t of tasks) {
      const s = solveWagonTask(t);
      expect(s.V).toBeLessThanOrEqual(Math.max(t.vA, t.vB) + 1e-12);
      expect(s.V).toBeGreaterThanOrEqual(Math.min(t.vA, t.vB) - 1e-12);
    }
  });

  it('energitapet er ½ · m_A·m_B/(m_A + m_B) · (v_A − v_B)², aldri negativt', () => {
    for (const t of tasks) {
      const s = solveWagonTask(t);
      expect(s.lost).toBeCloseTo(0.5 * s.mu * s.u * s.u, 6);
      expect(s.lost).toBeGreaterThanOrEqual(-1e-9);
      expect(s.EkAfter).toBeLessThanOrEqual(s.EkBefore + 1e-9);
    }
    // Like masser, B i ro: halvparten går tapt. Like store og motsatte p: alt går tapt. Samme fart: ingenting.
    expect(solveWagonTask(tasks[3]!).lossShare).toBeCloseTo(0.5, 12);
    expect(solveWagonTask(tasks[4]!).V).toBeCloseTo(0, 12);
    expect(solveWagonTask(tasks[4]!).lossShare).toBeCloseTo(1, 12);
    expect(solveWagonTask(tasks[5]!).lost).toBeCloseTo(0, 9);
    expect(solveWagonTask(tasks[5]!).IB).toBeCloseTo(0, 9);
  });

  it('impulsene er like store og motsatt rettede (Newtons 3. lov), og I = Δp for hver vogn', () => {
    for (const t of tasks) {
      const s = solveWagonTask(t);
      expect(s.IA + s.IB).toBeCloseTo(0, 6);
      expect(s.IA).toBeCloseTo(t.mA * s.V - s.pA, 6);
      expect(s.IB).toBeCloseTo(t.mB * s.V - s.pB, 6);
      expect(s.IA).toBeLessThanOrEqual(1e-9);
      expect(s.IB).toBeGreaterThanOrEqual(-1e-9);
    }
  });

  it('Newtons 2. lov: samme kraft gir m_A·a_A = m_B·a_B, og den letteste vogna får størst akselerasjon', () => {
    for (const t of tasks) {
      const s = solveWagonTask(t);
      expect(t.mA * s.aA).toBeCloseTo(s.F, 6);
      expect(t.mB * s.aB).toBeCloseTo(s.F, 6);
      expect(s.F * t.dt).toBeCloseTo(Math.abs(s.IB), 6);
      if (t.mB < t.mA) expect(s.aB).toBeGreaterThan(s.aA - 1e-12);
    }
  });

  it('bevaring av kinetisk energi gir aldri en mindre fart enn V', () => {
    for (const t of tasks) {
      const s = solveWagonTask(t);
      expect(s.vEnergyWrong).toBeGreaterThanOrEqual(Math.abs(s.V) - 1e-12);
    }
  });

  it('alle tallene er endelige (ingen NaN), også med null masse eller null tid', () => {
    const extra: WagonTask[] = [...tasks, { mA: 0, vA: 0, mB: 0, vB: 0, dt: 0, loadA: 'tom', loadB: 'tom' }];
    for (const t of extra) {
      const s = solveWagonTask(t);
      for (const [key, value] of Object.entries(s)) expect(Number.isFinite(value), key).toBe(true);
    }
  });

  it('tyngden til vognene er mg', () => {
    const s = solveWagonTask(WAGON_TASKS[0]!);
    expect(s.GA).toBeCloseTo(38_000 * g, 9);
    expect(s.GB).toBeCloseTo(13_000 * g, 9);
  });
});

describe('vognstøt: tallsettene er fysisk fornuftige', () => {
  for (const [i, t] of WAGON_TASKS.entries()) {
    const s = solveWagonTask(t);
    it(`tallsett ${i + 1}: containervogner, skiftefart og rimelig kraft`, () => {
      // Toakslede containervogner: 12–45 t; A er lastet og tyngst.
      expect(t.mA).toBeGreaterThan(t.mB);
      for (const m of [t.mA, t.mB]) {
        expect(m).toBeGreaterThanOrEqual(12_000);
        expect(m).toBeLessThanOrEqual(45_000);
      }
      // Skiftefart: under 2,5 m/s (9 km/h), og A tar igjen B.
      expect(t.vA).toBeGreaterThan(0);
      expect(t.vA).toBeLessThanOrEqual(2.5);
      expect(s.u).toBeGreaterThan(0);
      // Et støt mellom buffere varer noen tidels sekunder; kraften er titalls kN, akselerasjonen under g/2.
      expect(t.dt).toBeGreaterThanOrEqual(0.2);
      expect(t.dt).toBeLessThanOrEqual(0.5);
      expect(s.F).toBeGreaterThan(20_000);
      expect(s.F).toBeLessThan(100_000);
      expect(s.aB).toBeLessThan(g / 2);
      // Vognene ruller videre i fartsretningen til A, og noe, men ikke all, energi går tapt.
      expect(s.V).toBeGreaterThan(0.5);
      expect(s.lossShare).toBeGreaterThan(0.1);
      expect(s.lossShare).toBeLessThan(0.8);
    });

    it(`tallsett ${i + 1}: «om lag»-farten i a) ligger ikke på grensen mellom to avrundinger`, () => {
      const d = sigDecimals(s.V, 2);
      const scaled = s.V * 10 ** d;
      // Minst 0,15 enheter i siste siffer fra «…,5», så avrundingen ikke kan diskuteres.
      expect(Math.abs(scaled - Math.floor(scaled) - 0.5)).toBeGreaterThan(0.15);
      expect(Math.abs(s.V - s.VShown)).toBeLessThan(0.5 * 10 ** -d);
    });
  }

  it('B står i ro, triller samme vei og triller mot A i de tre tallsettene', () => {
    expect(WAGON_TASKS.map((t) => Math.sign(t.vB))).toEqual([0, 1, -1]);
  });
});

describe('hjelpefunksjoner', () => {
  it('roundSig og sigDecimals', () => {
    expect(roundSig(1.117647, 2)).toBeCloseTo(1.1, 12);
    expect(roundSig(0.977778, 2)).toBeCloseTo(0.98, 12);
    expect(roundSig(48_431.37, 2)).toBe(48_000);
    expect(roundSig(0, 2)).toBe(0);
    expect(sigDecimals(1.117647, 2)).toBe(1);
    expect(sigDecimals(0.977778, 2)).toBe(2);
    expect(sigDecimals(48_431, 2)).toBe(0);
    expect(sigDecimals(0, 2)).toBe(0);
  });

  it('F-t-grafen: arealet under den halve sinusbølgen er F · Δt = |I|', () => {
    for (const t of WAGON_TASKS) {
      const s = solveWagonTask(t);
      const n = 4000;
      let area = 0;
      for (let k = 0; k < n; k++) area += pulseForce(((k + 0.5) / n) * t.dt, s.F, t.dt) * (t.dt / n);
      expect(area).toBeCloseTo(Math.abs(s.IB), 0);
      expect(pulseForce(t.dt / 2, s.F, t.dt)).toBeCloseTo(peakForce(s.F), 9);
      expect(pulseForce(0, s.F, t.dt)).toBe(0);
      expect(pulseForce(t.dt, s.F, t.dt)).toBe(0);
    }
  });
});
