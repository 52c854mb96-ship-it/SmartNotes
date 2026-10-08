import { describe, expect, it } from 'vitest';
import {
  BENSIN,
  C_LIGHT,
  FUEL_KG,
  KULL,
  MASS_TASKS,
  MEV_J,
  PARTICLES,
  U_KG,
  heapFor,
  sig,
  solveMassTask,
  tankFor,
  type MassTask,
} from './model-eks-massedefekt';

const task = (id: MassTask['id']) => MASS_TASKS.find((t) => t.id === id)!;

describe('eksempeloppgaven «Energi fra en kjernereaksjon»', () => {
  it('har tre tallsett: fisjon, fusjon og sola', () => {
    expect(MASS_TASKS.map((t) => t.id)).toEqual(['fisjon', 'fusjon', 'sola']);
  });

  it('finner den ukjente partikkelen med bevaring av nukleontall og ladning', () => {
    const f = solveMassTask(task('fisjon'));
    expect(f.A).toEqual({ before: 236, knownAfter: 142, X: 94 });
    expect(f.Z).toEqual({ before: 92, knownAfter: 54, X: 38 });
    expect(f.X).toBe(PARTICLES.Sr94);

    const d = solveMassTask(task('fusjon'));
    expect([d.A.X, d.Z.X]).toEqual([1, 0]);
    expect(d.X).toBe(PARTICLES.n);

    const s = solveMassTask(task('sola'));
    expect(s.countX).toBe(2);
    expect([s.A.X, s.Z.X]).toEqual([1, 1]);
    expect(s.X).toBe(PARTICLES.p);
  });

  it.each(MASS_TASKS)('$id: X fra bevaringslovene er partikkelen i likningen, og A, Z og elektronene går opp', (t) => {
    const s = solveMassTask(t);
    const x = t.products.find((p) => p.unknown)!;
    expect(s.X).toBe(x.p);
    const sumA = (terms: typeof t.products) => terms.reduce((a, p) => a + p.count * p.p.A, 0);
    const sumZ = (terms: typeof t.products) => terms.reduce((a, p) => a + p.count * p.p.Z, 0);
    expect(sumA(t.reactants)).toBe(sumA(t.products));
    expect(sumZ(t.reactants)).toBe(sumZ(t.products));
    // Atommassene tar med elektronene: like mange før og etter, så de faller bort i Δm.
    expect(s.electrons[0]).toBe(s.electrons[1]);
    // Bare ett ukjent ledd.
    expect(t.products.filter((p) => p.unknown)).toHaveLength(1);
  });

  it('fisjon av uran-235: Δm = 0,198263 u, ca. 185 MeV per spaltning', () => {
    const s = solveMassTask(task('fisjon'));
    expect(s.mBefore).toBeCloseTo(236.052595, 6);
    expect(s.mAfter).toBeCloseTo(235.854332, 6);
    expect(s.dm).toBeCloseTo(0.198263, 6);
    expect(s.dmKg).toBeCloseTo(3.2912e-28, 31);
    expect(s.EJ).toBeCloseTo(2.962e-11, 13);
    expect(s.EMeV).toBeCloseTo(185.1, 1);
    // Med tabellverdien 931,5 MeV per u (kjent verdi for denne spaltningen: ca. 184,7 MeV).
    expect(s.EMeVTable).toBeCloseTo(184.7, 1);
  });

  it('fusjon av deuterium og tritium: ca. 17,6 MeV', () => {
    const s = solveMassTask(task('fusjon'));
    expect(s.dm).toBeCloseTo(0.018883, 6);
    expect(s.EMeV).toBeCloseTo(17.63, 2);
    expect(s.EMeVTable).toBeCloseTo(17.59, 2);
  });

  it('³He + ³He i sola: ca. 12,9 MeV', () => {
    const s = solveMassTask(task('sola'));
    expect(s.dm).toBeCloseTo(0.013805, 6);
    expect(s.EMeV).toBeCloseTo(12.89, 2);
    expect(s.EMeVTable).toBeCloseTo(12.86, 2);
  });

  it('energien i 1,0 kg brensel og massen kull eller bensin som gir like mye', () => {
    const f = solveMassTask(task('fisjon'));
    expect(f.fuelKgEach).toBeCloseTo(3.9017e-25, 28);
    expect(f.N).toBeCloseTo(2.563e24, -21);
    expect(sig(f.Etot, 2)).toBe(7.6e13);
    expect(sig(f.compareKg, 2)).toBe(2.5e6);

    const d = solveMassTask(task('fusjon'));
    expect(sig(d.Etot, 2)).toBe(3.4e14);
    expect(sig(d.compareKg, 2)).toBe(7.9e6);

    const s = solveMassTask(task('sola'));
    expect(sig(s.Etot, 2)).toBe(2.1e14);
    expect(sig(s.compareKg, 2)).toBe(6.9e6);
  });

  it.each(MASS_TASKS)('$id: fysisk fornuftige svar', (t) => {
    const s = solveMassTask(t);
    // Massen før er større enn etter (energi frigjøres), men bare en liten brøkdel forsvinner.
    expect(s.dm).toBeGreaterThan(0);
    expect(s.fraction).toBeGreaterThan(1e-4);
    expect(s.fraction).toBeLessThan(1e-2);
    // Noen MeV til et par hundre MeV per reaksjon.
    expect(s.EMeV).toBeGreaterThan(5);
    expect(s.EMeV).toBeLessThan(250);
    // Millioner av ganger mer energi per kilogram enn forbrenning.
    expect(s.ratio).toBeGreaterThan(1e6);
    expect(s.ratio).toBeLessThan(1e8);
    // Forholdet mellom masseandelene er det samme som forholdet mellom massene (E per kg ∝ massen som forsvinner).
    expect(s.fraction / s.chemFraction).toBeCloseTo(s.ratio, -3);
    // E = Δm c² og 1 MeV = 1,60 · 10⁻¹³ J.
    expect(s.EJ).toBeCloseTo(s.dm * U_KG * C_LIGHT ** 2, 25);
    expect(s.EMeV * MEV_J).toBeCloseTo(s.EJ, 25);
    // Energien fra 1,0 kg = antall reaksjoner · energien per reaksjon.
    expect(s.Etot).toBeCloseTo(s.N * s.EJ, -6);
    expect(s.N * s.fuelKgEach).toBeCloseTo(FUEL_KG, 10);
    // Med 931,5 MeV per u blir svaret litt mindre (konstantene i boka er avrundet), under 0,3 % forskjell.
    expect(Math.abs(s.EMeVTable / s.EMeV - 1)).toBeLessThan(0.003);
  });

  it.each(MASS_TASKS)('$id: hver linje i utregningen går opp med tallene som vises', (t) => {
    const s = solveMassTask(t);
    // Δm i kg vises med fire gjeldende siffer, energien med fire (mellomsvar) og svaret med tre.
    const dmKg = sig(s.dm * U_KG, 4);
    expect(dmKg).toBe(sig(s.dmKg, 4));
    const EJfromShown = dmKg * C_LIGHT ** 2;
    // Mellomsvaret kan avvike med én i det siste (ekstra) sifferet; svaret med tre siffer er det samme.
    expect(Math.abs(sig(EJfromShown, 4) - sig(s.EJ, 4))).toBeLessThanOrEqual(1.0001 * 10 ** (Math.floor(Math.log10(s.EJ)) - 3));
    expect(sig(EJfromShown, 3)).toBe(sig(s.EJ, 3));
    expect(sig(sig(s.EJ, 4) / MEV_J, 3)).toBe(sig(s.EMeV, 3));
    // d: N · E med de viste tallene gir samme svar med to siffer.
    expect(sig(sig(s.N, 4) * sig(s.EJ, 4), 2)).toBe(sig(s.Etot, 2));
    // e: massen kull eller bensin med det viste mellomsvaret.
    expect(sig(sig(s.Etot, 4) / t.compare.heat, 2)).toBe(sig(s.compareKg, 2));
  });

  it('haugen med kull og tanken med bensin har riktig volum', () => {
    const V = 3000;
    const h = heapFor(V);
    expect((Math.PI / 3) * h.r * h.r * h.h).toBeCloseTo(V, 6);
    expect(h.h / h.r).toBeCloseTo(Math.tan((35 * Math.PI) / 180), 10);
    const tk = tankFor(V);
    expect(Math.PI * (tk.d / 2) ** 2 * tk.h).toBeCloseTo(V, 6);
  });

  it('1,0 kg uran er en kube på ca. 3,7 cm, og haugene og tanken er like store som hus', () => {
    const f = solveMassTask(task('fisjon'));
    expect(f.cubeSide! * 100).toBeCloseTo(3.74, 2);
    expect(f.heap.h).toBeGreaterThan(8);
    expect(f.heap.h).toBeLessThan(20);
    const d = solveMassTask(task('fusjon'));
    expect(d.cubeSide).toBeNull();
    expect(d.tank.d).toBeGreaterThan(20);
    expect(d.tank.d).toBeLessThan(40);
    expect(BENSIN.heat).toBeGreaterThan(KULL.heat);
  });

  it('sig avrunder til gjeldende siffer', () => {
    expect(sig(185.128, 3)).toBe(185);
    expect(sig(0.0123456, 2)).toBe(0.012);
    expect(sig(2.5299e6, 2)).toBe(2.5e6);
    expect(sig(0, 3)).toBe(0);
  });
});
