import { describe, expect, it } from 'vitest';
import {
  activity,
  atomicMass,
  atomsInSample,
  bindingEnergy,
  conservation,
  countRemaining,
  CURVE,
  decay,
  decayConstant,
  decayEnergy,
  decayTimes,
  findNuclide,
  gammaPhotons,
  HALF_LIFE_PRESETS,
  halfLifeSeconds,
  isStable,
  massEnergyMeV,
  NUCLIDES,
  reactionEnergy,
  REACTIONS,
  remaining,
  YEAR_S,
  type DecayType,
} from './model';

const TYPES: DecayType[] = ['alfa', 'beta-', 'beta+', 'gamma'];

describe('masse og energi', () => {
  it('1 u svarer til ca. 934 MeV med konstantene i ERGO (931,5 MeV med flere siffer)', () => {
    expect(massEnergyMeV(1)).toBeCloseTo((1.66e-27 * 9e16) / 1.6e-13, 6);
    expect(Math.abs(massEnergyMeV(1) - 931.5) / 931.5).toBeLessThan(0.003);
  });

  it('nuklidetabellen har unike kjerner med masse nær A', () => {
    const keys = new Set(NUCLIDES.map((n) => `${n.Z}-${n.A}`));
    expect(keys.size).toBe(NUCLIDES.length);
    for (const n of NUCLIDES) {
      expect(Math.abs(n.mass - n.A)).toBeLessThan(0.1);
      if (n.mode) expect(n.halfLife).not.toBeNull();
    }
    expect(atomicMass(0, 1)).toBeCloseTo(1.008665, 6);
    expect(atomicMass(99, 999)).toBeUndefined();
  });
});

describe('bindingsenergi', () => {
  it('⁴He: Δm = 0,0304 u og ca. 7,1 MeV per nukleon', () => {
    const b = bindingEnergy(2, 4, 4.002603);
    expect(b.dm).toBeCloseTo(0.030377, 6);
    expect(b.E).toBeCloseTo(28.4, 1);
    expect(b.perNucleon).toBeCloseTo(7.09, 2);
  });

  it('¹H har ingen bindingsenergi, ²H er svakt bundet', () => {
    expect(bindingEnergy(1, 1, 1.007825).E).toBeCloseTo(0, 9);
    expect(bindingEnergy(1, 2, 2.014102).perNucleon).toBeCloseTo(1.11, 2);
  });

  it('toppen av kurven ligger ved jern og nikkel (A = 56–62)', () => {
    const best = CURVE.reduce((a, n) => (bindingEnergy(n.Z, n.A, n.mass).perNucleon > bindingEnergy(a.Z, a.A, a.mass).perNucleon ? n : a));
    expect(best.A).toBeGreaterThanOrEqual(56);
    expect(best.A).toBeLessThanOrEqual(62);
    const fe = findNuclide(26, 56)!;
    expect(bindingEnergy(26, 56, fe.mass).perNucleon).toBeCloseTo(8.81, 2);
    // Avvik fra tabellverdien 8,79 MeV skyldes de avrundede konstantene (u = 1,66 · 10⁻²⁷ kg, c = 3,00 · 10⁸ m/s)
    expect(Math.abs(bindingEnergy(26, 56, fe.mass).perNucleon - 8.79) / 8.79).toBeLessThan(0.004);
  });

  it('uran er svakere bundet per nukleon enn mellomtunge kjerner', () => {
    const u = findNuclide(92, 235)!;
    expect(bindingEnergy(92, 235, u.mass).perNucleon).toBeCloseTo(7.61, 1);
    expect(CURVE.length).toBeGreaterThanOrEqual(25);
    for (let i = 1; i < CURVE.length; i++) expect(CURVE[i]!.A).toBeGreaterThan(CURVE[i - 1]!.A);
  });
});

describe('fisjon og fusjon', () => {
  it('fisjon av ²³⁵U gir ca. 174 MeV, og nukleontall og ladning er bevart', () => {
    const r = reactionEnergy(REACTIONS.fisjon);
    expect(r.dm).toBeCloseTo(0.186024, 5);
    expect(r.Q).toBeCloseTo(173.7, 0);
    expect(r.A[0]).toBe(r.A[1]);
    expect(r.Z[0]).toBe(r.Z[1]);
    expect(r.perNucleon).toBeCloseTo(0.74, 2);
    expect(r.perKg).toBeCloseTo(7.1e13, -12);
  });

  it('fisjonsenergien er lik økningen i bindingsenergi', () => {
    const be = (Z: number, A: number) => bindingEnergy(Z, A, atomicMass(Z, A)!).E;
    const gain = be(56, 141) + be(36, 92) - be(92, 235);
    expect(gain).toBeCloseTo(reactionEnergy(REACTIONS.fisjon).Q, 6);
  });

  it('fusjon D + T gir 17,6 MeV, og mye mer energi per nukleon enn fisjon', () => {
    const f = reactionEnergy(REACTIONS.fusjon);
    expect(f.Q).toBeCloseTo(17.6, 1);
    expect(f.A).toEqual([5, 5]);
    expect(f.Z).toEqual([2, 2]);
    expect(f.perNucleon).toBeGreaterThan(4 * reactionEnergy(REACTIONS.fisjon).perNucleon);
    expect(f.perKg).toBeGreaterThan(reactionEnergy(REACTIONS.fisjon).perKg);
  });

  it('i sola blir fire protoner til helium og gir ca. 26,7 MeV', () => {
    const s = reactionEnergy(REACTIONS.sola);
    expect(s.Q).toBeCloseTo(26.8, 1);
    expect(s.A).toEqual([4, 4]);
    // Ladningen går fra +4 til +2: de to positronene som sendes ut, er ikke med i atommassene
    expect(s.dm / s.mBefore).toBeCloseTo(0.0071, 4);
  });
});

describe('halveringstid og aktivitet', () => {
  it('N = N₀ · (1/2)^(t/T½)', () => {
    expect(remaining(400, 0, 5730)).toBe(400);
    expect(remaining(400, 5730, 5730)).toBeCloseTo(200, 9);
    expect(remaining(400, 2 * 5730, 5730)).toBeCloseTo(100, 9);
    // Etter to halveringstider er det fortsatt en firedel igjen, ikke null
    expect(remaining(1, 2, 1)).toBe(0.25);
  });

  it('λ = ln 2 / T½: ¹⁴C har λ = 3,83 · 10⁻¹² s⁻¹', () => {
    const c14 = HALF_LIFE_PRESETS.find((p) => p.id === 'c14')!;
    expect(decayConstant(halfLifeSeconds(c14))).toBeCloseTo(3.83e-12, 14);
    expect(decayConstant(1) * 1).toBeCloseTo(0.693, 3);
  });

  it('aktiviteten til 1 g ¹⁴C er ca. 1,65 · 10¹¹ Bq, og 1 g ²³⁸U ca. 12 kBq', () => {
    const c = HALF_LIFE_PRESETS.find((p) => p.id === 'c14')!;
    const u = HALF_LIFE_PRESETS.find((p) => p.id === 'u238')!;
    expect(activity(decayConstant(halfLifeSeconds(c)), atomsInSample(1e-3, 14))).toBeCloseTo(1.65e11, -9);
    expect(activity(decayConstant(halfLifeSeconds(u)), atomsInSample(1e-3, 238))).toBeCloseTo(1.24e4, -2);
    expect(halfLifeSeconds(u)).toBeCloseTo(4.47e9 * YEAR_S, -10);
  });

  it('tilfeldig henfall med fast frø: samme resultat hver gang', () => {
    expect(decayTimes(50, 7)).toEqual(decayTimes(50, 7));
    expect(decayTimes(50, 7)).not.toEqual(decayTimes(50, 8));
    for (const t of decayTimes(400, 1)) expect(t).toBeGreaterThanOrEqual(0);
  });

  it('i snitt halveres antallet for hver halveringstid', () => {
    const times = decayTimes(100000, 3);
    expect(countRemaining(times, 0)).toBe(100000);
    expect(countRemaining(times, 1) / 100000).toBeCloseTo(0.5, 2);
    expect(countRemaining(times, 2) / 100000).toBeCloseTo(0.25, 2);
    // Med 400 kjerner er avviket fra 200 lite (innenfor 3 standardavvik = 30)
    for (const seed of [1, 2, 3, 4, 5]) expect(Math.abs(countRemaining(decayTimes(400, seed), 1) - 200)).toBeLessThan(30);
    // Gjennomsnittlig levetid er T½ / ln 2 ≈ 1,44 T½
    expect(times.reduce((a, b) => a + b, 0) / times.length).toBeCloseTo(1 / Math.LN2, 1);
  });

  it('antallet går aldri opp', () => {
    const times = decayTimes(400, 9);
    let prev = 400;
    for (let t = 0; t <= 6; t += 0.05) {
      const n = countRemaining(times, t);
      expect(n).toBeLessThanOrEqual(prev);
      prev = n;
    }
  });
});

describe('kjernereaksjoner og bevaringslover', () => {
  it('α-henfall av ²³⁸U gir ²³⁴Th og frigjør ca. 4,3 MeV', () => {
    const d = decay(92, 238, 'alfa');
    expect(d.daughter).toMatchObject({ Z: 90, A: 234 });
    const e = decayEnergy(d)!;
    expect(e.dm).toBeCloseTo(0.004584, 6);
    expect(e.Q).toBeCloseTo(4.28, 2);
  });

  it('β⁻-henfall av ¹⁴C gir ¹⁴N og 0,16 MeV', () => {
    const d = decay(6, 14, 'beta-');
    expect(d.daughter).toMatchObject({ Z: 7, A: 14 });
    expect(d.emitted.map((e) => e.name)).toEqual(['elektron', 'antinøytrino']);
    expect(decayEnergy(d)!.Q).toBeCloseTo(0.157, 3);
  });

  it('β⁺-henfall av ²²Na gir ²²Ne*, og Q trekker fra to elektronmasser', () => {
    const d = decay(11, 22, 'beta+');
    // ²²Na henfaller nesten alltid til den eksiterte ²²Ne* (1,275 MeV), som sender ut γ-fotonet på 1,27 MeV
    expect(d.daughter).toMatchObject({ Z: 10, A: 22, excited: true });
    const e = decayEnergy(d)!;
    expect(e.Qmass).toBeCloseTo(1.82, 2);
    expect(e.daughterExcitation).toBeCloseTo(1.275, 3);
    // Positronet og nøytrinoet deler ca. 0,55 MeV (tabellverdi 0,546 MeV)
    expect(e.Q).toBeCloseTo(0.55, 2);
    const g = decay(10, 22, 'gamma', true);
    expect(g.possible).toBe(true);
    expect(decayEnergy(g)!.Q).toBeCloseTo(1.275, 3);
    // ¹⁸F (brukt i PET): 0,63 MeV
    expect(decayEnergy(decay(9, 18, 'beta+'))!.Q).toBeCloseTo(0.635, 2);
  });

  it('⁶⁰Co gir eksitert ⁶⁰Ni*, som sender ut γ-stråling (1,17 + 1,33 MeV)', () => {
    const d = decay(27, 60, 'beta-');
    expect(d.daughter).toMatchObject({ Z: 28, A: 60, excited: true });
    expect(decayEnergy(d)!.Q).toBeCloseTo(2.83 - 2.505, 1);
    const g = decay(28, 60, 'gamma', true);
    expect(g.daughter).toMatchObject({ Z: 28, A: 60, excited: false });
    expect(decayEnergy(g)!.Q).toBeCloseTo(2.505, 3);
    // To fotoner som til sammen bærer eksitasjonsenergien
    expect(g.emitted).toHaveLength(2);
    expect(gammaPhotons(28, 60)!.reduce((a, b) => a + b, 0)).toBeCloseTo(2.505, 3);
    expect(decay(56, 137, 'gamma', true).emitted).toHaveLength(1);
    // ¹³⁷Cs → ¹³⁷Ba*: β⁻ med 0,51 MeV og γ med 0,662 MeV
    expect(decayEnergy(decay(55, 137, 'beta-'))!.Q).toBeCloseTo(0.516, 2);
    expect(decayEnergy(decay(56, 137, 'gamma', true))!.Q).toBeCloseTo(0.662, 3);
  });

  it('nukleontall og ladning er bevart i alle henfall for alle kjernene i tabellen', () => {
    for (const n of NUCLIDES)
      for (const t of TYPES) {
        const c = conservation(decay(n.Z, n.A, t));
        expect(c.A[0]).toBe(c.A[1]);
        expect(c.Z[0]).toBe(c.Z[1]);
      }
  });

  it('naturlige henfall i tabellen frigjør energi (Q > 0)', () => {
    for (const n of NUCLIDES) {
      if (!n.mode) continue;
      const e = decayEnergy(decay(n.Z, n.A, n.mode));
      if (e) expect(e.Q).toBeGreaterThan(0);
    }
  });

  it('uranserien ender i stabilt ²⁰⁶Pb etter 8 α og 6 β⁻', () => {
    let Z = 92;
    let A = 238;
    let alpha = 0;
    let beta = 0;
    for (let i = 0; i < 20; i++) {
      const n = findNuclide(Z, A);
      expect(n).toBeDefined();
      if (!n!.mode) break;
      if (n!.mode === 'alfa') alpha++;
      if (n!.mode === 'beta-') beta++;
      const d = decay(Z, A, n!.mode).daughter;
      Z = d.Z;
      A = d.A;
    }
    expect([Z, A]).toEqual([82, 206]);
    expect(isStable(82, 206)).toBe(true);
    expect([alpha, beta]).toEqual([8, 6]);
  });

  it('neptuniumserien fra ²⁴¹Am ender i stabilt ²⁰⁵Tl etter 9 α og 4 β⁻', () => {
    let Z = 95;
    let A = 241;
    const seen: string[] = [];
    for (let i = 0; i < 20; i++) {
      const n = findNuclide(Z, A);
      expect(n).toBeDefined();
      if (!n!.mode) break;
      seen.push(n!.mode);
      const d = decay(Z, A, n!.mode);
      expect(decayEnergy(d)!.Q).toBeGreaterThan(0);
      Z = d.daughter.Z;
      A = d.daughter.A;
    }
    expect([Z, A]).toEqual([81, 205]);
    expect(seen.filter((m) => m === 'alfa')).toHaveLength(9);
    expect(seen.filter((m) => m === 'beta-')).toHaveLength(4);
  });

  it('henfall som ikke frigjør energi, skjer ikke av seg selv: ⁴⁰Ca → ⁴⁰K ved β⁺ gir Q < 0', () => {
    expect(decayEnergy(decay(20, 40, 'beta+'))!.Q).toBeLessThan(0);
    expect(decayEnergy(decay(7, 14, 'beta+'))!.Q).toBeLessThan(0);
  });

  it('umulige henfall og ukjente kjerner gir ingen energi', () => {
    expect(decay(2, 4, 'alfa').possible).toBe(false);
    expect(decay(1, 1, 'beta+').possible).toBe(false);
    expect(decayEnergy(decay(2, 4, 'alfa'))).toBeNull();
    expect(decayEnergy(decay(92, 238, 'beta+'))).toBeNull();
    expect(decayEnergy(decay(92, 238, 'gamma'))).toBeNull();
  });

  it('γ-stråling kommer bare fra eksiterte kjerner, ikke fra grunntilstanden', () => {
    const g = decay(92, 238, 'gamma');
    expect(g.possible).toBe(false);
    expect(g.parent.excited).toBe(false);
    // Etter γ fra ⁶⁰Ni* er ⁶⁰Ni i grunntilstanden og kan ikke sende ut mer γ
    expect(decay(28, 60, 'gamma', true).possible).toBe(true);
    expect(decay(28, 60, 'gamma', false).possible).toBe(false);
    expect(decay(28, 60, 'gamma', false).parent.excited).toBe(false);
  });

  it('en eksitert morkjerne har eksitasjonsenergien i tillegg til massetapet', () => {
    const e = decayEnergy(decay(28, 60, 'beta+', true))!;
    expect(e.parentExcitation).toBeCloseTo(2.505, 3);
    expect(e.Q).toBeCloseTo(e.Qmass + 2.505, 6);
    // Fortsatt negativ: ⁶⁰Ni* blir ikke til ⁶⁰Co
    expect(e.Q).toBeLessThan(0);
  });

  it('de andre henfallstypene for startkjernene frigjør ikke energi (Q < 0)', () => {
    const cases: [number, number, DecayType][] = [
      [6, 14, 'alfa'], // ¹⁴C → ¹⁰Be + α
      [6, 14, 'beta+'], // ¹⁴C → ¹⁴B
      [19, 40, 'alfa'], // ⁴⁰K → ³⁶Cl + α
      [27, 60, 'alfa'],
      [27, 60, 'beta+'],
      [11, 22, 'beta-'],
      [11, 22, 'alfa'],
      [9, 18, 'beta-'],
      [9, 18, 'alfa'],
      [88, 226, 'beta-'],
      [95, 241, 'beta+'],
      [92, 238, 'beta-'], // ²³⁸U er β-stabil: ²³⁸Np er tyngre
    ];
    for (const [Z, A, t] of cases) {
      const e = decayEnergy(decay(Z, A, t));
      expect(e, `${Z}-${A} ${t}`).not.toBeNull();
      expect(e!.Q, `${Z}-${A} ${t}`).toBeLessThan(0);
    }
    // ¹⁴C → ¹⁰Be + α ville krevd ca. 12 MeV
    expect(decayEnergy(decay(6, 14, 'alfa'))!.Q).toBeCloseTo(-12.0, 1);
  });
});
