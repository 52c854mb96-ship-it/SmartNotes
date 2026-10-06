import { describe, expect, it } from 'vitest';
import { PULLEY_TASKS, solvePulleyTask, type PulleyTask } from './model-eks-trinse';

const g = 9.81;

describe('vogn og lodd over trinse: tallsett 1', () => {
  const s = solvePulleyTask(PULLEY_TASKS[0]!);

  it('0,40 kg vogn og 0,20 kg lodd gir a = g/3 = 3,27 m/s²', () => {
    expect(s.G1).toBeCloseTo(3.924, 10);
    expect(s.G2).toBeCloseTo(1.962, 10);
    expect(s.N).toBeCloseTo(3.924, 10);
    expect(s.a).toBeCloseTo(3.27, 10);
  });

  it('snordraget er 1,31 N, to tredjedeler av tyngden til loddet', () => {
    expect(s.S).toBeCloseTo(1.308, 10);
    expect(s.ratioS).toBeCloseTo(2 / 3, 12);
    expect(s.netLodd).toBeCloseTo(0.654, 10);
  });

  it('farten er 1,72 m/s når loddet har falt 0,45 m, etter 0,525 s', () => {
    expect(s.v).toBeCloseTo(1.7155, 4);
    expect(s.t).toBeCloseTo(0.5246, 4);
  });

  it('med treklossen (μ = 0,20): R = 0,785 N, a = g/5 = 1,96 m/s² og S = 1,57 N', () => {
    expect(s.slides).toBe(true);
    expect(s.R).toBeCloseTo(0.7848, 10);
    expect(s.aF).toBeCloseTo(1.962, 10);
    expect(s.SF).toBeCloseTo(1.5696, 10);
    expect(s.vF).toBeCloseTo(1.3288, 4);
  });
});

describe('vogn og lodd over trinse: sammenhengene', () => {
  const tasks: PulleyTask[] = [
    ...PULLEY_TASKS,
    { m1: 1.0, m2: 0.05, h: 0.8, muK: 0.02, bars: 3 },
    { m1: 0.1, m2: 2.0, h: 0.2, muK: 0.5, bars: 0 },
  ];

  it('vogna alene, loddet alene og hele systemet gir samme snordrag og akselerasjon', () => {
    for (const task of tasks) {
      const s = solvePulleyTask(task);
      // Vogna: S = m₁a. Loddet: G₂ − S = m₂a. Summen: G₂ = (m₁ + m₂)a.
      expect(s.S).toBeCloseTo(task.m1 * s.a, 12);
      expect(s.G2 - s.S).toBeCloseTo(task.m2 * s.a, 12);
      expect(s.netLodd).toBeCloseTo(task.m2 * s.a, 12);
      expect(s.G2).toBeCloseTo((task.m1 + task.m2) * s.a, 12);
      expect(s.S).toBeCloseTo(task.m2 * (g - s.a), 12);
    }
  });

  it('a er alltid mindre enn g, og snordraget alltid mindre enn tyngden til loddet', () => {
    for (const task of tasks) {
      const s = solvePulleyTask(task);
      expect(s.a).toBeGreaterThan(0);
      expect(s.a).toBeLessThan(g);
      expect(s.S).toBeLessThan(s.G2);
      expect(s.S / s.G2).toBeCloseTo(s.ratioS, 12);
    }
  });

  it('bevegelseslikningene henger sammen: v² = 2ah, v = at og h = ½at²', () => {
    for (const task of tasks) {
      const s = solvePulleyTask(task);
      expect(s.v * s.v).toBeCloseTo(2 * s.a * task.h, 12);
      expect(s.a * s.t).toBeCloseTo(s.v, 12);
      expect(0.5 * s.a * s.t * s.t).toBeCloseTo(task.h, 12);
    }
  });

  it('energien er bevart uten friksjon: m₂gh = ½(m₁ + m₂)v²', () => {
    for (const task of tasks) {
      const s = solvePulleyTask(task);
      expect(task.m2 * g * task.h).toBeCloseTo(0.5 * (task.m1 + task.m2) * s.v * s.v, 12);
    }
  });

  it('med friksjon blir akselerasjonen og farten mindre og snordraget større', () => {
    for (const task of tasks) {
      const s = solvePulleyTask(task);
      expect(s.aF).toBeLessThan(s.a);
      expect(s.vF).toBeLessThan(s.v);
      expect(s.SF).toBeGreaterThan(s.S);
      expect(s.SF).toBeLessThanOrEqual(s.G2 + 1e-12);
    }
  });

  it('med friksjon gir klossen alene og loddet alene samme snordrag: S = m₁a + R = m₂(g − a)', () => {
    for (const task of tasks) {
      const s = solvePulleyTask(task);
      if (!s.slides) continue;
      expect(s.R).toBeCloseTo(task.muK * task.m1 * g, 12);
      expect(s.SF).toBeCloseTo(task.m1 * s.aF + s.R, 12);
      expect(s.G2 - s.R).toBeCloseTo((task.m1 + task.m2) * s.aF, 12);
      // Energien: m₂gh = ½(m₁ + m₂)v² + Rh (friksjonsarbeidet)
      expect(task.m2 * g * task.h).toBeCloseTo(0.5 * (task.m1 + task.m2) * s.vF * s.vF + s.R * task.h, 12);
    }
  });
});

describe('vogn og lodd over trinse: grensetilfeller', () => {
  it('uten lodd står vogna i ro, og snora er slakk', () => {
    const s = solvePulleyTask({ m1: 0.5, m2: 0, h: 0.4, muK: 0.2, bars: 0 });
    expect(s.a).toBe(0);
    expect(s.S).toBe(0);
    expect(s.v).toBe(0);
    expect(s.t).toBe(0);
  });

  it('en svært lett vogn gir nesten fritt fall og nesten ikke noe snordrag', () => {
    const s = solvePulleyTask({ m1: 1e-6, m2: 0.2, h: 0.4, muK: 0.2, bars: 0 });
    expect(s.a).toBeCloseTo(g, 4);
    expect(s.S).toBeCloseTo(0, 4);
    expect(s.v).toBeCloseTo(Math.sqrt(2 * g * 0.4), 4);
  });

  it('en svært tung vogn gir nesten ingen akselerasjon, og da er S nesten lik G₂', () => {
    const s = solvePulleyTask({ m1: 1000, m2: 0.2, h: 0.4, muK: 0, bars: 0 });
    expect(s.a).toBeLessThan(0.002);
    expect(s.S).toBeCloseTo(s.G2, 3);
  });

  it('uten friksjon (μ = 0) gir treklossen samme svar som vogna', () => {
    const task: PulleyTask = { m1: 0.4, m2: 0.2, h: 0.45, muK: 0, bars: 1 };
    const s = solvePulleyTask(task);
    expect(s.R).toBe(0);
    expect(s.aF).toBeCloseTo(s.a, 12);
    expect(s.SF).toBeCloseTo(s.S, 12);
    expect(s.vF).toBeCloseTo(s.v, 12);
  });

  it('klossen blir liggende når G₂ ikke er større enn μm₁g, og da er S = G₂', () => {
    const s = solvePulleyTask({ m1: 0.4, m2: 0.05, h: 0.45, muK: 0.3, bars: 1 });
    expect(s.slides).toBe(false);
    expect(s.aF).toBe(0);
    expect(s.vF).toBe(0);
    expect(s.SF).toBeCloseTo(s.G2, 12);
    expect(s.R).toBeCloseTo(s.G2, 12);
  });

  it('ingen NaN for null og negative høyder', () => {
    const s = solvePulleyTask({ m1: 0.4, m2: 0.2, h: -1, muK: 0.2, bars: 0 });
    expect(s.v).toBe(0);
    expect(s.vF).toBe(0);
    expect(Number.isFinite(s.t)).toBe(true);
  });
});

describe('vogn og lodd over trinse: tallsettene er fornuftige', () => {
  it('massene og høyden passer et labforsøk, og figuren har plass', () => {
    for (const task of PULLEY_TASKS) {
      expect(task.m1).toBeGreaterThanOrEqual(0.2);
      expect(task.m1).toBeLessThanOrEqual(1);
      expect(task.m2).toBeGreaterThanOrEqual(0.05);
      expect(task.m2).toBeLessThan(task.m1);
      // Loddet henger under bordplata (bordet er 0,85 m høyt) og lander før vogna når trinsa.
      expect(task.h).toBeGreaterThanOrEqual(0.3);
      expect(task.h).toBeLessThanOrEqual(0.5);
      expect(task.muK).toBeGreaterThanOrEqual(0.15);
      expect(task.muK).toBeLessThanOrEqual(0.4);
      expect(task.bars).toBeGreaterThanOrEqual(0);
      expect(task.bars).toBeLessThanOrEqual(3);
    }
  });

  it('pila S er minst 0,28 av G₁, så den synes ved siden av G₁ og N', () => {
    for (const task of PULLEY_TASKS) {
      const s = solvePulleyTask(task);
      expect(s.S / s.G1).toBeGreaterThan(0.28);
      expect(s.R / s.G1).toBeGreaterThanOrEqual(0.15);
    }
  });

  it('akselerasjonen og farten er som i et vanlig forsøk, og klossen glir tydelig', () => {
    for (const task of PULLEY_TASKS) {
      const s = solvePulleyTask(task);
      expect(s.a).toBeGreaterThan(2);
      expect(s.a).toBeLessThan(4.5);
      expect(s.v).toBeGreaterThan(1);
      expect(s.v).toBeLessThan(2.5);
      expect(s.slides).toBe(true);
      expect(s.aF).toBeGreaterThan(1);
      // Snordraget øker merkbart (mer enn 10 %), så forskjellen synes i figuren og svarene.
      expect(s.SF / s.S).toBeGreaterThan(1.1);
    }
  });

  it('tallsettene gir ulike svar', () => {
    const as = PULLEY_TASKS.map((t) => Math.round(solvePulleyTask(t).a * 100));
    expect(new Set(as).size).toBe(PULLEY_TASKS.length);
    const Ss = PULLEY_TASKS.map((t) => Math.round(solvePulleyTask(t).S * 100));
    expect(new Set(Ss).size).toBe(PULLEY_TASKS.length);
  });

  it('«Vis at»-verdien i b) (én desimal) ligger innenfor avrundingen av a', () => {
    for (const task of PULLEY_TASKS) {
      const s = solvePulleyTask(task);
      const shown = Math.round(s.a * 10) / 10;
      expect(Math.abs(shown - s.a)).toBeLessThanOrEqual(0.05);
    }
  });
});

describe('vogn og lodd over trinse: utregningene i løsningen går opp med de viste tallene', () => {
  // Løsningen viser mellomsvar med to eller tre desimaler. Regner eleven videre med de viste tallene, skal svaret
  // bli det samme som i løsningen, eller høyst én enhet forskjellig i siste siffer.
  const r = (v: number, d: number) => Math.round(v * 10 ** d) / 10 ** d;
  const close = (a: number, b: number, d: number) => expect(Math.abs(r(a, d) - r(b, d))).toBeLessThanOrEqual(10 ** -d + 1e-9);

  it('b) til e) med tallene slik de står i utregningen', () => {
    for (const task of PULLEY_TASKS) {
      const s = solvePulleyTask(task);
      const M = task.m1 + task.m2;
      const a = r(s.a, 2);
      // c) S = m₁a, S = m₂(g − a) og kraftsummen på loddet G₂ − S
      close(task.m1 * a, s.S, 2);
      close(task.m2 * (g - a), s.S, 2);
      close(r(s.G2, 2) - r(s.S, 2), s.netLodd, 2);
      // d) v = √(2as)
      close(Math.sqrt(2 * a * task.h), s.v, 2);
      // e) a = (G₂ − R)/(m₁ + m₂) med tre desimaler, S = m₂(g − a) og S = m₁a + R
      expect(r((r(s.G2, 3) - r(s.R, 3)) / M, 2)).toBe(r(s.aF, 2));
      const aF = r(s.aF, 2);
      close(task.m2 * (g - aF), s.SF, 2);
      close(task.m1 * aF + r(s.R, 3), s.SF, 2);
      close(Math.sqrt(2 * aF * task.h), s.vF, 2);
    }
  });
});
