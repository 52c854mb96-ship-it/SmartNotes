import { describe, expect, it } from 'vitest';
import { atomInfo, electronRange, neutronRange, shellConfig } from './model';
import {
  ATOM_DIAMETER,
  EVERYDAY,
  PITCH_LENGTH,
  TABLE_CELLS,
  atomToNucleusRatio,
  groupOfColumn,
  nucleusDiameter,
  roundSig,
  outerElectrons,
  scaleObject,
  scaledNucleus,
  tablePosition,
} from './model-atomets-oppbygning';

describe('målestokk: kjernen og atomet', () => {
  it('d = 2 · 1,2 · 10⁻¹⁵ m · ∛A: protonet 2,4 · 10⁻¹⁵ m, natrium-23 ca. 6,8 · 10⁻¹⁵ m', () => {
    expect(nucleusDiameter(1)).toBeCloseTo(2.4e-15, 20);
    expect(nucleusDiameter(23)).toBeCloseTo(6.83e-15, 17);
    expect(nucleusDiameter(27)).toBeCloseTo(7.2e-15, 20);
  });

  it('kjernen vokser som ∛A: åtte ganger så mange nukleoner gir dobbel diameter', () => {
    expect(nucleusDiameter(64) / nucleusDiameter(8)).toBeCloseTo(2, 12);
    expect(nucleusDiameter(8) / nucleusDiameter(1)).toBeCloseTo(2, 12);
  });

  it('ingen nukleoner gir ingen kjerne (og ingen NaN)', () => {
    expect(nucleusDiameter(0)).toBe(0);
    expect(nucleusDiameter(-3)).toBe(0);
    expect(nucleusDiameter(Number.NaN)).toBe(0);
    expect(atomToNucleusRatio(0)).toBe(Infinity);
  });

  it('kjernen er 10⁻¹⁵–10⁻¹⁴ m, og atomet er 10 000–100 000 ganger bredere for alle atomene i visualiseringen', () => {
    for (let Z = 1; Z <= 20; Z++) {
      const [lo, hi] = neutronRange(Z);
      for (const N of [lo, hi]) {
        const d = nucleusDiameter(Z + N);
        expect(d).toBeGreaterThan(1e-15);
        expect(d).toBeLessThan(1e-14);
        const ratio = atomToNucleusRatio(Z + N);
        expect(ratio).toBeGreaterThan(1e4);
        expect(ratio).toBeLessThan(1e5);
        expect(ATOM_DIAMETER / ratio).toBeCloseTo(d, 25);
      }
    }
  });

  it('atomet som en fotballbane på 100 m: natriumkjernen blir 6,8 mm, som en ert', () => {
    expect(PITCH_LENGTH).toBe(100);
    const mm = scaledNucleus(23) * 1000;
    expect(mm).toBeCloseTo(6.83, 2);
    expect(scaleObject(mm).name).toBe('en ert');
    // Samme forhold i begge målestokker: kjerne/atom = kjerne på banen/banen
    expect(scaledNucleus(23) / PITCH_LENGTH).toBeCloseTo(nucleusDiameter(23) / ATOM_DIAMETER, 12);
  });

  it('sammenligningen går fra knappenålshode (hydrogen) til blåbær (kalsium-40)', () => {
    expect(scaleObject(scaledNucleus(1) * 1000).name).toBe('et knappenålshode');
    expect(scaleObject(scaledNucleus(4) * 1000).name).toBe('et pepperkorn');
    expect(scaleObject(scaledNucleus(12) * 1000).name).toBe('en ert');
    expect(scaleObject(scaledNucleus(40) * 1000).name).toBe('et blåbær');
  });

  it('forholdet vises med to gjeldende siffer: ca. 15 000 for natrium-23', () => {
    expect(roundSig(atomToNucleusRatio(23))).toBe(15000);
    expect(roundSig(14641)).toBe(15000);
    expect(roundSig(0.0123, 2)).toBeCloseTo(0.012, 12);
    expect(roundSig(0)).toBe(0);
    expect(roundSig(Infinity)).toBe(Infinity);
  });

  it('tingene blir større jo større kjernen er (aldri baklengs)', () => {
    let last = 0;
    for (let A = 1; A <= 60; A++) {
      const typical = scaleObject(scaledNucleus(A) * 1000).typicalMm;
      expect(typical).toBeGreaterThanOrEqual(last);
      last = typical;
    }
  });
});

describe('utsnitt av periodesystemet', () => {
  it('har Z = 1–20 som kan velges og Ga–Kr som fullfører periode 4', () => {
    expect(TABLE_CELLS.filter((c) => c.selectable).map((c) => c.Z)).toEqual(Array.from({ length: 20 }, (_, i) => i + 1));
    expect(TABLE_CELLS.filter((c) => !c.selectable).map((c) => c.symbol)).toEqual(['Ga', 'Ge', 'As', 'Se', 'Br', 'Kr']);
  });

  it('ingen celler overlapper', () => {
    const keys = new Set(TABLE_CELLS.map((c) => `${c.period}-${c.col}`));
    expect(keys.size).toBe(TABLE_CELLS.length);
  });

  it('kjente plasser: H og Na i gruppe 1, He og Ar i gruppe 18, C i gruppe 14, Ca i periode 4', () => {
    const at = (s: string) => TABLE_CELLS.find((c) => c.symbol === s)!;
    expect([at('H').group, at('Na').group]).toEqual([1, 1]);
    expect([at('He').group, at('Ar').group, at('Kr').group]).toEqual([18, 18, 18]);
    expect(at('C').group).toBe(14);
    expect(at('Ca')).toMatchObject({ period: 4, group: 2, name: 'Kalsium' });
    expect(groupOfColumn(0)).toBe(1);
    expect(groupOfColumn(2)).toBe(13);
    expect(groupOfColumn(7)).toBe(18);
    expect(tablePosition(25)).toBeNull();
    expect(tablePosition(0)).toBeNull();
  });

  it('periode = antall skall, og i gruppe 1, 2 og 13–17 er antall ytterelektroner det siste sifferet i gruppenummeret', () => {
    for (const c of TABLE_CELLS.filter((c) => c.selectable)) {
      expect(shellConfig(c.Z).length).toBe(c.period);
      const outer = outerElectrons(c.Z);
      if (c.Z === 2) expect(outer).toBe(2);
      else if (c.group === 18) expect(outer).toBe(8);
      else expect(outer).toBe(c.group % 10);
    }
  });

  it('hvert grunnstoff som kan velges, har et hverdagseksempel som nevner grunnstoffet', () => {
    for (let Z = 1; Z <= 20; Z++) {
      const text = EVERYDAY[Z];
      expect(text, `Z = ${Z}`).toBeTruthy();
      const name = atomInfo(Z, 0, Z).name;
      expect(text!.toLowerCase()).toContain(name);
      expect(text).toMatch(/^[A-ZÆØÅ]/);
      expect(text).toMatch(/\.$/);
      // Teksten settes inn ved siden av symbolene: ingen «NaN» i noe som vises
      expect(text).not.toMatch(/NaN|undefined/);
    }
  });

  it('elektronområdet og nøytronområdet passer med tabellen (Z ≤ 20)', () => {
    for (let Z = 1; Z <= 20; Z++) {
      expect(electronRange(Z)[1]).toBeLessThanOrEqual(20);
      expect(neutronRange(Z)[0]).toBeGreaterThanOrEqual(0);
    }
  });
});
