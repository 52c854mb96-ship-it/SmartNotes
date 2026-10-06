import { describe, expect, it } from 'vitest';
import {
  PENDULUM_TASKS,
  blockLength,
  roundSig,
  solvePendulumTask,
  swingAt,
  type PendulumTask,
} from './model-eks-ballistisk-pendel';

const g = 9.81;

describe('ballistisk pendel: tallsett 1 (0,53 g kule, 95 g kloss, h = 4,4 cm)', () => {
  const task = PENDULUM_TASKS[0]!;
  const s = solvePendulumTask(task);

  it('a) klossen med kula får farten V = √(2gh) = 0,929 m/s', () => {
    expect(s.mTot).toBeCloseTo(0.09553, 12);
    expect(s.V).toBeCloseTo(Math.sqrt(2 * 9.81 * 0.044), 12);
    expect(s.V).toBeCloseTo(0.92913, 5);
  });

  it('b) kula hadde farten v = 95,53/0,53 · V = 167,5 m/s, om lag 170 m/s', () => {
    expect(s.ratio).toBeCloseTo(95.53 / 0.53, 10);
    expect(s.v).toBeCloseTo(167.471, 3);
    expect(s.vShown).toBe(170);
    expect(s.p).toBeCloseTo(0.08876, 5);
  });

  it('c) 7,43 J før og 0,0412 J etter: 7,39 J (99,4 %) blir omdannet', () => {
    expect(s.EkBefore).toBeCloseTo(7.4323, 4);
    expect(s.EkAfter).toBeCloseTo(0.041235, 6);
    expect(s.lost).toBeCloseTo(7.3911, 4);
    expect(s.lossShare).toBeCloseTo(0.99445, 5);
  });

  it('energibevaring gjennom støtet gir en altfor liten fart (12,5 m/s)', () => {
    expect(s.vWrong).toBeCloseTo(12.474, 3);
    expect(s.vWrong).toBeLessThan(s.v / 10);
  });

  it('d) impulsloven: Δp = −0,0883 kg·m/s gir F = −441 N, om lag 85 000 ganger tyngden til kula', () => {
    expect(s.dpBullet).toBeCloseTo(-0.088267, 6);
    expect(s.Fbullet).toBeCloseTo(-441.34, 2);
    expect(s.F).toBeCloseTo(441.34, 2);
    expect(s.Gbullet).toBeCloseTo(0.0051993, 7);
    expect(s.forceRatio).toBeGreaterThan(84_000);
    expect(s.forceRatio).toBeLessThan(86_000);
  });

  it('d) tyngden av klossen er 0,932 N, og kraften er om lag 470 ganger så stor', () => {
    expect(s.Gblock).toBeCloseTo(0.93195, 5);
    expect(s.forceRatioBlock).toBeCloseTo(441.34 / 0.93195, 0);
  });

  it('d) klossen flytter seg bare 0,093 mm mens kula trenger 1,67 cm inn', () => {
    expect(s.sBlock).toBeCloseTo(9.291e-5, 8);
    expect(s.depth).toBeCloseTo(0.016747, 6);
    expect(s.sBullet).toBeCloseTo(0.01684, 5);
  });

  it('snorene står i 31,4° når klossen snur (L = 0,30 m)', () => {
    expect((s.thetaMax * 180) / Math.PI).toBeCloseTo(31.424, 3);
  });
});

describe('ballistisk pendel: tallsett 2 og 3', () => {
  it('tallsett 2: V = 1,010 m/s, v = 179 m/s (om lag 180), F = 673 N', () => {
    const s = solvePendulumTask(PENDULUM_TASKS[1]!);
    expect(s.V).toBeCloseTo(1.01007, 5);
    expect(s.v).toBeCloseTo(179.258, 3);
    expect(s.vShown).toBe(180);
    expect(s.lost).toBeCloseTo(10.8638, 4);
    expect(s.F).toBeCloseTo(673.38, 2);
  });

  it('tallsett 3: V = 1,085 m/s, v = 157 m/s (om lag 160), F = 312 N', () => {
    const s = solvePendulumTask(PENDULUM_TASKS[2]!);
    expect(s.V).toBeCloseTo(1.08499, 5);
    expect(s.ratio).toBeCloseTo(145, 10);
    expect(s.v).toBeCloseTo(157.323, 3);
    expect(s.vShown).toBe(160);
    expect(s.lossShare).toBeCloseTo(72 / 72.5, 12);
    expect(s.F).toBeCloseTo(312.48, 2);
  });
});

describe('ballistisk pendel: sammenhengene', () => {
  const tasks: PendulumTask[] = [
    ...PENDULUM_TASKS,
    { m: 10e-3, M: 4.0, h: 0.2, dt: 1e-3, L: 2.0 }, // jaktrifle i en sandsekk
    { m: 0.05, M: 0.05, h: 0.1, dt: 5e-3, L: 1.0 }, // like masser
    { m: 1e-3, M: 0.5, h: 0, dt: 1e-4, L: 0.5 }, // klossen står i ro: ingen fart
  ];

  it('bevegelsesmengden er bevart i støtet: mv = (m + M)V', () => {
    for (const t of tasks) {
      const s = solvePendulumTask(t);
      expect(t.m * s.v).toBeCloseTo(s.mTot * s.V, 12);
      expect(s.p).toBeCloseTo(s.mTot * s.V, 12);
    }
  });

  it('mekanisk energi er bevart i svingningen: ½(m + M)V² = (m + M)gh', () => {
    for (const t of tasks) {
      const s = solvePendulumTask(t);
      expect(s.EkAfter).toBeCloseTo(s.mTot * g * t.h, 12);
    }
  });

  it('andelen som blir omdannet er M/(m + M), og energien etter er aldri større enn før', () => {
    for (const t of tasks) {
      const s = solvePendulumTask(t);
      expect(s.lost).toBeGreaterThanOrEqual(0);
      expect(s.EkAfter).toBeLessThanOrEqual(s.EkBefore + 1e-15);
      if (s.EkBefore > 0) expect(s.lossShare).toBeCloseTo(t.M / (t.m + t.M), 12);
    }
    // Like masser: halvparten går tapt.
    expect(solvePendulumTask(tasks[4]!).lossShare).toBeCloseTo(0.5, 12);
  });

  it('kraftparet gir like store og motsatt rettede impulser (Newtons 3. lov)', () => {
    for (const t of tasks) {
      const s = solvePendulumTask(t);
      expect(s.dpBullet + s.dpBlock).toBeCloseTo(0, 12);
      expect(s.Fbullet * t.dt).toBeCloseTo(s.dpBullet, 12);
      expect(s.F * t.dt).toBeCloseTo(s.dpBlock, 12);
      expect(s.Fbullet).toBeLessThanOrEqual(0);
    }
  });

  it('arbeidet på kula og klossen gir arbeid-energi-setningen og nøyaktig energitapet: F · d = ΔE', () => {
    for (const t of tasks) {
      const s = solvePendulumTask(t);
      // Kula: W = ΔE_k (konstant kraft)
      expect(s.Wbullet).toBeCloseTo(0.5 * t.m * (s.V * s.V - s.v * s.v), 10);
      // Klossen: W = ½MV²
      expect(s.Wblock).toBeCloseTo(0.5 * t.M * s.V * s.V, 12);
      // Til sammen: −F · d = −ΔE
      expect(s.Wbullet + s.Wblock).toBeCloseTo(-s.lost, 10);
      expect(s.F * s.depth).toBeCloseTo(s.lost, 10);
      expect(s.depth).toBeCloseTo(0.5 * s.v * t.dt, 12);
    }
  });

  it('alle tallene er endelige (ingen NaN), også med h = 0', () => {
    for (const t of tasks) {
      const s = solvePendulumTask(t);
      for (const [key, value] of Object.entries(s)) {
        expect(Number.isFinite(value), key).toBe(true);
      }
    }
  });
});

describe('ballistisk pendel: tallsettene er fysisk fornuftige', () => {
  for (const [i, t] of PENDULUM_TASKS.entries()) {
    const s = solvePendulumTask(t);
    it(`tallsett ${i + 1}: luftgeværfart, målbar høyde og rimelig kraft`, () => {
      // Et vanlig luftgevær skyter 150–200 m/s.
      expect(s.v).toBeGreaterThan(150);
      expect(s.v).toBeLessThan(200);
      // Klossen stiger noen få centimeter, og snorene svinger 25–40°.
      expect(t.h).toBeGreaterThanOrEqual(0.03);
      expect(t.h).toBeLessThanOrEqual(0.07);
      const deg = (s.thetaMax * 180) / Math.PI;
      expect(deg).toBeGreaterThan(25);
      expect(deg).toBeLessThan(40);
      // Nesten all energien går tapt, kula stopper på 1–3 cm, og klossen flytter seg under 0,2 mm.
      expect(s.lossShare).toBeGreaterThan(0.99);
      expect(s.depth).toBeGreaterThan(0.01);
      expect(s.depth).toBeLessThan(0.03);
      expect(s.sBlock).toBeLessThan(0.2e-3);
      // Kraften er mange tusen ganger tyngden, så tyngden og snordraget kan ses bort fra under støtet.
      expect(s.forceRatio).toBeGreaterThan(10_000);
      // Også tyngden av klossen og snordraget er bitte små mot kraften. Snordraget er av samme størrelse som tyngden
      // av klossen: Mg før støtet og (m + M)(g + V²/L) i bunnen like etter.
      expect(s.Gblock).toBeCloseTo(t.M * 9.81, 10);
      expect(s.forceRatioBlock).toBeGreaterThan(200);
      const S = swingAt(t, s, 0).S;
      expect(S).toBeGreaterThan(s.Gblock);
      expect(S).toBeLessThan(1.5 * s.Gblock);
      expect(s.F / S).toBeGreaterThan(200);
    });

    it(`tallsett ${i + 1}: «om lag»-verdien i b) ligger ikke på grensen mellom to avrundinger`, () => {
      // Avstanden fra v til nærmeste «…5» skal være minst 1 m/s, så avrundingen ikke kan diskuteres.
      const half = Math.round((s.v - 5) / 10) * 10 + 5;
      expect(Math.abs(s.v - half)).toBeGreaterThan(1);
      expect(Math.abs(s.v - s.vShown)).toBeLessThan(5);
    });

    it(`tallsett ${i + 1}: klossen er 6–13 cm lang (furu, 4,5 × 4,5 cm)`, () => {
      const len = blockLength(t.M);
      expect(len).toBeGreaterThan(0.06);
      expect(len).toBeLessThan(0.13);
    });
  }
});

describe('svingningen (til figuren)', () => {
  const task = PENDULUM_TASKS[0]!;
  const s = solvePendulumTask(task);

  it('farten er V i bunnen og 0 i toppen, og høyden i toppen er h', () => {
    const bottom = swingAt(task, s, 0);
    expect(bottom.u).toBeCloseTo(s.V, 12);
    expect(bottom.dy).toBe(0);
    const top = swingAt(task, s, s.thetaMax);
    expect(top.dy).toBeCloseTo(task.h, 12);
    expect(top.u).toBeCloseTo(0, 6);
    // Snordraget i toppen er bare G cos θ (farten er null).
    expect(top.S).toBeCloseTo(top.G * Math.cos(s.thetaMax), 10);
  });

  it('energien er den samme overalt på banen, og vinkelen klemmes til θmax', () => {
    for (const phi of [0.1, 0.2, 0.3, 0.4]) {
      const st = swingAt(task, s, phi);
      expect(0.5 * s.mTot * st.u * st.u + s.mTot * g * st.dy).toBeCloseTo(s.EkAfter, 12);
      expect(st.S).toBeGreaterThan(st.G * Math.cos(st.phi) - 1e-12);
    }
    expect(swingAt(task, s, 2).phi).toBeCloseTo(s.thetaMax, 12);
  });

  it('roundSig avrunder til gjeldende siffer', () => {
    expect(roundSig(167.47, 2)).toBe(170);
    expect(roundSig(179.26, 2)).toBe(180);
    expect(roundSig(0.0412, 2)).toBeCloseTo(0.041, 12);
    expect(roundSig(0, 2)).toBe(0);
  });
});
