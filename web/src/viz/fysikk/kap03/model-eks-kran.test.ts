import { describe, expect, it } from 'vitest';
import { fmt } from '../../kit/format';
import { CRANE_TASKS, J_PER_KWH, LOAD_TEXT, POWER_PRICE, roundSig, sigDecimals, solveCraneTask, type CraneTask } from './model-eks-kran';

const g = 9.81;
const task1 = CRANE_TASKS[0]!;

describe('solveCraneTask – tallsett 1 regnet for hånd', () => {
  const s = solveCraneTask(task1);

  it('har tallene fra oppgaveteksten', () => {
    expect(task1).toEqual({ load: 'murstein', m: 850, h: 24, v: 0.8, eta: 0.75, etaBack: 0.7 });
  });

  it('a) snordraget er like stort som tyngden ved jevn fart', () => {
    expect(s.G).toBeCloseTo(850 * 9.81, 6); // 8 338,5 N
    expect(s.S).toBeCloseTo(8338.5, 6);
    expect(s.SkNShown).toBeCloseTo(8.3, 10);
    expect(s.SkNDecimals).toBe(1);
  });

  it('b) arbeidet og økningen i potensiell energi', () => {
    expect(s.W).toBeCloseTo(8338.5 * 24, 6); // 200 124 J
    expect(s.W).toBeCloseTo(200124, 6);
    expect(s.dEp).toBeCloseTo(s.W, 6);
    expect(s.WG).toBeCloseTo(-200124, 6);
    expect(s.Wtot).toBeCloseTo(0, 6);
  });

  it('c) tid og effekt', () => {
    expect(s.t).toBeCloseTo(30, 10);
    expect(s.P).toBeCloseTo(200124 / 30, 6); // 6 670,8 W
    expect(s.P).toBeCloseTo(6670.8, 6);
    expect(s.PFv).toBeCloseTo(s.P, 6);
  });

  it('d) elektrisk energi med virkningsgraden', () => {
    expect(s.Eel).toBeCloseTo(200124 / 0.75, 6); // 266 832 J
    expect(s.Eel).toBeCloseTo(266832, 6);
    expect(s.EelKWh).toBeCloseTo(266832 / 3.6e6, 10); // 0,0741 kWh
    expect(s.EelKWh).toBeCloseTo(0.07412, 5);
    expect(s.Pel).toBeCloseTo(6670.8 / 0.75, 6); // 8 894 W
    expect(s.heatUp).toBeCloseTo(66708, 6);
    expect(s.wrongEel).toBeCloseTo(150093, 6);
    expect(s.costOre).toBeCloseTo(0.07412 * 150, 1); // ca. 11 øre
  });

  it('e) senking: negativt arbeid, energi tilbake og netto', () => {
    expect(s.WSDown).toBeCloseTo(-200124, 6);
    expect(s.dEDown).toBeCloseTo(-200124, 6);
    expect(s.Eback).toBeCloseTo(0.7 * 200124, 6); // 140 087 J
    expect(s.heatDown).toBeCloseTo(0.3 * 200124, 6); // 60 037 J
    expect(s.net).toBeCloseTo(266832 - 140086.8, 6); // 126 745 J
    expect(s.heatTotal).toBeCloseTo(s.net, 6);
  });
});

describe('solveCraneTask – fysiske sammenhenger', () => {
  const tasks: CraneTask[] = [
    ...CRANE_TASKS,
    { load: 'murstein', m: 1, h: 1, v: 1, eta: 1, etaBack: 1 },
    { load: 'gips', m: 2000, h: 50, v: 0.3, eta: 0.5, etaBack: 0.4 },
  ];

  it.each(tasks.map((t, i) => [i, t] as const))('tallsett %i: bevaring og sammenhenger', (_, task) => {
    const s = solveCraneTask(task);
    const mgh = task.m * g * task.h;
    // Newtons 1. lov og arbeid = endring i potensiell energi
    expect(s.S).toBeCloseTo(s.G, 9);
    expect(s.W).toBeCloseTo(mgh, 6);
    expect(s.dEp).toBeCloseTo(mgh, 6);
    expect(s.W + s.WG).toBeCloseTo(0, 6);
    // Effekt: P = W/t = S·v
    expect(s.P).toBeCloseTo(s.S * task.v, 6);
    expect(s.P * s.t).toBeCloseTo(s.W, 6);
    // Energibevaring i motoren: tilført = nyttig + varme
    expect(s.Eel).toBeCloseTo(s.W + s.heatUp, 6);
    expect(s.W / s.Eel).toBeCloseTo(task.eta, 10);
    expect(s.Pel * s.t).toBeCloseTo(s.Eel, 6);
    expect(s.EelKWh * J_PER_KWH).toBeCloseTo(s.Eel, 6);
    // Senking: mgh = tilbake + varme, og netto = all varmen på turen
    expect(s.dEDown).toBeCloseTo(-mgh, 6);
    expect(s.WSDown).toBeCloseTo(s.dEDown, 6);
    expect(s.Eback + s.heatDown).toBeCloseTo(mgh, 6);
    expect(s.net).toBeCloseTo(s.heatTotal, 6);
    expect(s.net).toBeGreaterThanOrEqual(0);
  });

  it('virkningsgrad 1 både opp og ned gir ingen varme og netto null', () => {
    const s = solveCraneTask({ load: 'murstein', m: 500, h: 10, v: 1, eta: 1, etaBack: 1 });
    expect(s.heatUp).toBeCloseTo(0, 9);
    expect(s.heatDown).toBeCloseTo(0, 9);
    expect(s.net).toBeCloseTo(0, 9);
  });

  it('dobbel masse gir dobbelt arbeid og effekt, men samme tid', () => {
    const a = solveCraneTask(task1);
    const b = solveCraneTask({ ...task1, m: 2 * task1.m });
    expect(b.W).toBeCloseTo(2 * a.W, 6);
    expect(b.P).toBeCloseTo(2 * a.P, 6);
    expect(b.t).toBeCloseTo(a.t, 10);
  });

  it('dobbel fart gir samme arbeid, halve tida og dobbel effekt', () => {
    const a = solveCraneTask(task1);
    const b = solveCraneTask({ ...task1, v: 2 * task1.v });
    expect(b.W).toBeCloseTo(a.W, 6);
    expect(b.t).toBeCloseTo(a.t / 2, 10);
    expect(b.P).toBeCloseTo(2 * a.P, 6);
  });

  it('grensetilfeller gir ingen NaN', () => {
    const zeroH = solveCraneTask({ ...task1, h: 0 });
    expect(zeroH.W).toBe(0);
    expect(zeroH.t).toBe(0);
    expect(zeroH.P).toBe(0);
    expect(Number.isNaN(zeroH.Eel)).toBe(false);
    const still = solveCraneTask({ ...task1, v: 0 });
    expect(still.t).toBe(Infinity);
    expect(still.P).toBe(0);
    const noEta = solveCraneTask({ ...task1, eta: 0 });
    expect(noEta.Eel).toBe(Infinity);
  });
});

describe('tallsettene i oppgaven', () => {
  it.each(CRANE_TASKS.map((t, i) => [i + 1, t] as const))('tallsett %i gir fornuftige svar', (_, task) => {
    const s = solveCraneTask(task);
    // Lasta og høyden: det en tårnkran løfter på en byggeplass
    expect(task.m).toBeGreaterThanOrEqual(500);
    expect(task.m).toBeLessThanOrEqual(1500);
    expect(task.h).toBeGreaterThanOrEqual(15);
    expect(task.h).toBeLessThanOrEqual(35);
    // Snordraget 5–15 kN, og «Vis at»-verdien er entydig (minst 0,1 avrundingssteg fra grensen)
    expect(s.S).toBeGreaterThan(5000);
    expect(s.S).toBeLessThan(15000);
    const step = 10 ** -s.SkNDecimals;
    const frac = (s.S / 1000 / step) % 1;
    expect(Math.abs(frac - 0.5)).toBeGreaterThan(0.1);
    expect(Math.abs(s.S / 1000 - s.SkNShown)).toBeLessThan(step / 2);
    // Tida under ett minutt (stoppeklokka går én runde på 60 s), og hele sekunder eller halve
    expect(s.t).toBeGreaterThan(5);
    expect(s.t).toBeLessThan(60);
    expect((s.t * 2) % 1).toBeCloseTo(0, 9);
    // Effekten på lasta og den elektriske effekten er det en heisemotor på en tårnkran klarer (5–30 kW)
    expect(s.P).toBeGreaterThan(5000);
    expect(s.Pel).toBeLessThan(30000);
    // Virkningsgradene: realistiske, og generatoren gir aldri tilbake mer enn motoren bruker ved løft
    expect(task.eta).toBeGreaterThanOrEqual(0.6);
    expect(task.eta).toBeLessThanOrEqual(0.9);
    expect(task.etaBack).toBeLessThanOrEqual(task.eta);
    expect(s.Eback).toBeLessThan(s.W);
    expect(s.W).toBeLessThan(s.Eel);
    // Netto er positivt og mindre enn det som ble brukt ved løftet
    expect(s.net).toBeGreaterThan(0);
    expect(s.net).toBeLessThan(s.Eel);
    // kWh er et lite tall (et løft koster noen øre)
    expect(s.EelKWh).toBeGreaterThan(0.01);
    expect(s.EelKWh).toBeLessThan(1);
    expect(s.costOre).toBeGreaterThan(1);
    expect(s.costOre).toBeLessThan(100);
    expect(LOAD_TEXT[task.load].what.length).toBeGreaterThan(0);
  });

  it('tallsettene er forskjellige laster', () => {
    expect(new Set(CRANE_TASKS.map((t) => t.load)).size).toBe(CRANE_TASKS.length);
  });

  it('strømprisen er et rimelig tall', () => {
    expect(POWER_PRICE).toBeGreaterThan(0.5);
    expect(POWER_PRICE).toBeLessThan(5);
  });
});

describe('roundSig og sigDecimals', () => {
  it('avrunder til gjeldende siffer', () => {
    expect(roundSig(8.3385, 2)).toBeCloseTo(8.3, 10);
    expect(roundSig(11.772, 2)).toBeCloseTo(12, 10);
    expect(roundSig(6.278, 2)).toBeCloseTo(6.3, 10);
    expect(roundSig(0, 2)).toBe(0);
  });
  it('finner antall desimaler', () => {
    expect(sigDecimals(8.3385, 2)).toBe(1);
    expect(sigDecimals(11.772, 2)).toBe(0);
    expect(sigDecimals(9.96, 2)).toBe(0); // 9,96 → 10
    expect(sigDecimals(0.45, 2)).toBe(2);
  });
});

describe('svaret i d) har like mange gjeldende siffer i kJ og kWh', () => {
  // Samme regel som kJ3 og kWh3 i eks-kran-energi.tsx: tre gjeldende siffer i begge enhetene
  const kJ3 = (E: number) => fmt(E / 1000, sigDecimals(E / 1000, 3));
  const kWh3 = (E: number) => fmt(E / J_PER_KWH, sigDecimals(E / J_PER_KWH, 3));
  it('gir 267 kJ ≈ 0,0741 kWh, 464 kJ ≈ 0,129 kWh og 161 kJ ≈ 0,0448 kWh', () => {
    const shown = CRANE_TASKS.map((t) => {
      const s = solveCraneTask(t);
      return `${kJ3(s.Eel)} kJ ≈ ${kWh3(s.Eel)} kWh`;
    });
    expect(shown).toEqual(['267 kJ ≈ 0,0741 kWh', '464 kJ ≈ 0,129 kWh', '161 kJ ≈ 0,0448 kWh']);
  });
});
