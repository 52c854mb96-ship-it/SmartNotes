import { describe, expect, it } from 'vitest';
import { SLED_TASKS, roundSig, sigDecimals, solveSledTask, type SledTask } from './model-eks-akebakke';

describe('akebrett ned bakken: tallsett 1 (Ida)', () => {
  const task = SLED_TASKS[0]!;
  const s = solveSledTask(task);

  it('energien på toppen: E_p = 3 311 J, E_k = 51 J, E_A = 3 362 J', () => {
    expect(s.EpA).toBeCloseTo(45 * 9.81 * 7.5, 10);
    expect(s.EpA).toBeCloseTo(3310.875, 10);
    expect(s.EkA).toBeCloseTo(50.625, 10);
    expect(s.EA).toBeCloseTo(3361.5, 10);
  });

  it('uten friksjon blir farten nederst 12,2 m/s, om lag 12 m/s', () => {
    expect(s.vIdeal).toBeCloseTo(Math.sqrt(1.5 ** 2 + 2 * 9.81 * 7.5), 12);
    expect(s.vIdeal).toBeCloseTo(12.223, 3);
    expect(s.vIdealShown).toBe(12);
    // Å legge sammen fartene gir for mye: 1,5 + √(2gh) = 13,6 m/s
    expect(s.vWrongSum).toBeCloseTo(13.63, 2);
  });

  it('med målt fart 8,0 m/s er 1 922 J (57 %) blitt termisk energi', () => {
    expect(s.EkB).toBeCloseTo(1440, 10);
    expect(s.Q).toBeCloseTo(1921.5, 10);
    expect(s.QShare).toBeCloseTo(0.5716, 4);
    expect(s.Wmot).toBeCloseTo(-1921.5, 10);
  });

  it('den samlede motkraften (friksjon og luftmotstand) i bakken er 64 N i gjennomsnitt', () => {
    expect(s.Fmot).toBeCloseTo(64.05, 10);
  });

  it('på flaten er N = G = 441 N og R = 53,0 N, og brettet glir 27,2 m', () => {
    expect(s.Nflat).toBeCloseTo(441.45, 10);
    expect(s.Rflat).toBeCloseTo(52.974, 3);
    expect(s.d).toBeCloseTo(64 / (2 * 0.12 * 9.81), 10);
    expect(s.d).toBeCloseTo(27.18, 2);
  });

  it('helningen er 14,5°, friksjonen fra snøen 51,3 N og luftmotstanden 12,8 N (20 %)', () => {
    expect(s.sinA).toBeCloseTo(0.25, 12);
    expect(s.alphaDeg).toBeCloseTo(14.48, 2);
    expect(s.Nslope).toBeCloseTo(427.43, 2);
    expect(s.muN).toBeCloseTo(51.29, 2);
    expect(s.L).toBeCloseTo(12.76, 2);
    expect(s.airShare).toBeCloseTo(0.199, 3);
  });

  it('overslaget med luftmotstand på flaten gir om lag 22 m', () => {
    expect(s.dEst).toBeCloseTo(1440 / (52.974 + 12.758), 2);
    expect(s.dEst).toBeCloseTo(21.9, 1);
  });
});

describe('akebrett ned bakken: sammenhengene', () => {
  const tasks: SledTask[] = [
    ...SLED_TASKS,
    { name: 'Test', pronoun: 'han', m: 80, h: 12, s: 60, v0: 0, vB: 10, mu: 0.08 },
    { name: 'Test', pronoun: 'hun', m: 20, h: 2, s: 10, v0: 3, vB: 4, mu: 0.2 },
  ];

  it('uten friksjon er den mekaniske energien bevart: ½mv² = mgh + ½mv₀²', () => {
    for (const t of tasks) {
      const s = solveSledTask(t);
      expect(0.5 * t.m * s.vIdeal ** 2).toBeCloseTo(s.EA, 9);
      expect(s.vIdeal).toBeGreaterThan(t.v0);
      // Farten nederst er mindre enn summen av fartene (energiene legges sammen, ikke fartene)
      expect(s.vIdeal).toBeLessThanOrEqual(s.vWrongSum + 1e-12);
    }
  });

  it('energiregnskapet går opp: E_A = E_kB + Q, og W_mot = ΔE = −F_mot · s', () => {
    for (const t of tasks) {
      const s = solveSledTask(t);
      expect(s.EkB + s.Q).toBeCloseTo(s.EA, 9);
      expect(s.Wmot).toBeCloseTo(s.EkB - s.EA, 9);
      expect(-s.Fmot * t.s).toBeCloseTo(s.Wmot, 9);
    }
  });

  it('på flaten blir all kinetisk energi termisk: μmg · d = ½mv_B², og bevegelseslikningene stemmer', () => {
    for (const t of tasks) {
      const s = solveSledTask(t);
      expect(s.Rflat * s.d).toBeCloseTo(s.EkB, 9);
      expect(t.vB ** 2).toBeCloseTo(2 * s.aFlat * s.d, 9);
      expect(0.5 * s.aFlat * s.tFlat ** 2).toBeCloseTo(s.d, 9);
      // Massen forkortes bort
      const tung = solveSledTask({ ...t, m: 2 * t.m });
      expect(tung.d).toBeCloseTo(s.d, 9);
      expect(tung.vIdeal).toBeCloseTo(s.vIdeal, 12);
    }
  });

  it('geometrien i bakken: sin α = h/s, run² + h² = s² og μN + L = F_mot', () => {
    for (const t of tasks) {
      const s = solveSledTask(t);
      expect(s.run ** 2 + t.h ** 2).toBeCloseTo(t.s ** 2, 9);
      expect(Math.sin((s.alphaDeg * Math.PI) / 180)).toBeCloseTo(t.h / t.s, 12);
      expect(s.muN + s.L).toBeCloseTo(s.Fmot, 9);
      expect(s.Nslope).toBeLessThan(s.Nflat);
    }
  });

  it('overslaget med luftmotstand er kortere enn d når luftmotstanden er positiv', () => {
    for (const t of tasks) {
      const s = solveSledTask(t);
      if (s.L > 0) expect(s.dEst).toBeLessThan(s.d);
      expect(s.dEst * (s.Rflat + s.L)).toBeCloseTo(s.EkB, 9);
    }
  });
});

describe('akebrett ned bakken: alle tallsettene gir fornuftige svar', () => {
  for (const [i, t] of SLED_TASKS.entries()) {
    const s = solveSledTask(t);
    describe(`tallsett ${i + 1} (${t.name})`, () => {
      it('bakken er en vanlig akebakke (10–16°) og farten er realistisk', () => {
        expect(s.alphaDeg).toBeGreaterThan(10);
        expect(s.alphaDeg).toBeLessThan(16);
        expect(s.vIdeal).toBeGreaterThan(9);
        expect(s.vIdeal).toBeLessThan(15);
        // Den målte farten er tydelig lavere, men ikke urimelig lav (55–75 % av farten uten friksjon)
        expect(t.vB / s.vIdeal).toBeGreaterThan(0.55);
        expect(t.vB / s.vIdeal).toBeLessThan(0.75);
      });

      it('«om lag»-verdien i a) ligger godt unna en avrundingsgrense', () => {
        const step = 10 ** (Math.floor(Math.log10(s.vIdealShown)) - 1);
        expect(Math.abs(s.vIdeal - s.vIdealShown)).toBeLessThan(0.4 * step);
        // Også med g = 9,8 m/s² får eleven samme avrundede svar
        const v98 = Math.sqrt(t.v0 ** 2 + 2 * 9.8 * t.h);
        expect(roundSig(v98, 2)).toBe(s.vIdealShown);
      });

      it('omtrent halvparten av energien blir termisk energi i bakken (40–70 %)', () => {
        expect(s.Q).toBeGreaterThan(0);
        expect(s.QShare).toBeGreaterThan(0.4);
        expect(s.QShare).toBeLessThan(0.7);
        expect(s.Fmot).toBeGreaterThan(40);
        expect(s.Fmot).toBeLessThan(90);
      });

      it('luftmotstanden er en mindre, men tydelig del av motkraften (15–30 %), med et rimelig luftmotstandsareal', () => {
        expect(s.L).toBeGreaterThan(0);
        expect(s.airShare).toBeGreaterThan(0.15);
        expect(s.airShare).toBeLessThan(0.3);
        // L = ½ρ·C·A·v² med ρ = 1,3 kg/m³ og snittet av v² i bakken gir C·A mellom 0,35 og 0,75 m²
        const CA = s.L / (0.5 * 1.3 * ((t.v0 ** 2 + t.vB ** 2) / 2));
        expect(CA).toBeGreaterThan(0.35);
        expect(CA).toBeLessThan(0.75);
      });

      it('glidestrekningen på flaten er 20–35 m, og overslaget med luftmotstand 15–30 % kortere', () => {
        expect(s.d).toBeGreaterThan(20);
        expect(s.d).toBeLessThan(35);
        expect(s.dEst / s.d).toBeGreaterThan(0.7);
        expect(s.dEst / s.d).toBeLessThan(0.85);
        expect(s.tFlat).toBeGreaterThan(4);
        expect(s.tFlat).toBeLessThan(10);
      });
    });
  }

  it('tallsettene er forskjellige', () => {
    const ds = SLED_TASKS.map((t) => Math.round(solveSledTask(t).d));
    expect(new Set(ds).size).toBe(SLED_TASKS.length);
    const names = SLED_TASKS.map((t) => t.name);
    expect(new Set(names).size).toBe(SLED_TASKS.length);
  });
});

describe('gjeldende siffer', () => {
  it('roundSig og sigDecimals', () => {
    expect(roundSig(12.223, 2)).toBe(12);
    expect(roundSig(9.607, 2)).toBeCloseTo(9.6, 12);
    expect(roundSig(1921.5, 2)).toBe(1900);
    expect(roundSig(0, 2)).toBe(0);
    expect(sigDecimals(12.223, 2)).toBe(0);
    expect(sigDecimals(9.607, 2)).toBe(1);
    expect(sigDecimals(0.456, 2)).toBe(2);
    expect(sigDecimals(9.96, 2)).toBe(0);
  });
});
