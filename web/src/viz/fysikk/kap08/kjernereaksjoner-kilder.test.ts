import { describe, expect, it } from 'vitest';
import { KILDER, kildeFor, kildeSkala, maalTekst } from './kjernereaksjoner-kilder';
import { decay, decayEnergy, findNuclide } from './model';

describe('hverdagssituasjonene i kjernereaksjoner', () => {
  it('hver startkjerne er radioaktiv, har kjent henfall og frigjør energi', () => {
    for (const k of KILDER) {
      const n = findNuclide(k.Z, k.A);
      expect(n?.mode, `${k.Z}-${k.A}`).toBeDefined();
      const e = decayEnergy(decay(k.Z, k.A, n!.mode!));
      expect(e!.Q).toBeGreaterThan(0);
    }
  });

  it('har riktige mål og en praktisk kobling', () => {
    for (const k of KILDER) {
      expect(k.bredde).toBeGreaterThan(0.01);
      expect(k.hoyde).toBeGreaterThan(0.01);
      expect(k.maal).toBeLessThanOrEqual(Math.max(k.bredde, k.hoyde));
      expect(k.derfor.startsWith('Det er derfor')).toBe(true);
      expect(k.navn.length).toBeLessThan(22);
    }
    expect(new Set(KILDER.map((k) => k.type)).size).toBe(KILDER.length);
  });

  it('skalaen gjør den største siden like stor for alle gjenstandene', () => {
    for (const k of KILDER) expect(kildeSkala(k, 190) * Math.max(k.bredde, k.hoyde)).toBeCloseTo(190, 8);
    // Røykvarsleren er 11 cm: 190 px / 0,11 m ≈ 1727 px/m
    expect(kildeSkala(kildeFor(95, 241), 190)).toBeCloseTo(1727.3, 1);
    // Ukjent startkjerne gir alunskiferen
    expect(kildeFor(1, 1).type).toBe('skifer');
  });

  it('målet skrives i centimeter med desimalkomma', () => {
    expect(maalTekst(0.078)).toBe('7,8 cm');
    expect(maalTekst(0.14)).toBe('14 cm');
    expect(maalTekst(0.025)).toBe('2,5 cm');
    expect(maalTekst(0.3)).toBe('30 cm');
    expect(maalTekst(0.05)).toBe('5 cm');
  });
});
