import { describe, expect, it } from 'vitest';
import {
  B_HYDROGEN,
  C_LIGHT,
  H_PLANCK,
  HYDROGEN_TASKS,
  J_PER_EV,
  VISIBLE_MAX,
  VISIBLE_MIN,
  colorNameOf,
  ionization,
  levelEnergy,
  regionOf,
  solveHydrogenTask,
  wavelengthFromEnergy,
} from './model-eks-hydrogen';

/** Avrunding slik fmt viser tallet (d desimaler). */
const round = (v: number, d: number) => Math.round(v * 10 ** d) / 10 ** d;
/** Mantissen når tallet skrives med 10⁻¹⁹ (alle nivåene n ≥ 2 og fotonene i oppgaven). */
const m19 = (v: number) => v / 1e-19;
/** Avrunding til `sig` gjeldende siffer. */
const sig = (v: number, s: number) => {
  const e = Math.floor(Math.log10(Math.abs(v)));
  return Math.round(v / 10 ** (e - s + 1)) * 10 ** (e - s + 1);
};

describe('energinivåene i hydrogen (E_n = −B/n²)', () => {
  it('gir kjente verdier', () => {
    expect(levelEnergy(1)).toBeCloseTo(-2.18e-18, 30);
    expect(levelEnergy(2)).toBeCloseTo(-5.45e-19, 30);
    expect(levelEnergy(3)).toBeCloseTo(-2.4222e-19, 23);
    expect(levelEnergy(4)).toBeCloseTo(-1.3625e-19, 30);
    // −13,6 eV i grunntilstanden og −3,41 eV i nivå 2
    expect(levelEnergy(1) / J_PER_EV).toBeCloseTo(-13.625, 9);
    expect(levelEnergy(2) / J_PER_EV).toBeCloseTo(-3.40625, 9);
  });

  it('er negative, stiger mot 0 og ligger tettere og tettere oppover', () => {
    let prevGap = Infinity;
    for (let n = 1; n <= 10; n++) {
      expect(levelEnergy(n)).toBeLessThan(0);
      expect(levelEnergy(n + 1)).toBeGreaterThan(levelEnergy(n));
      const gap = levelEnergy(n + 1) - levelEnergy(n);
      expect(gap).toBeLessThan(prevGap);
      prevGap = gap;
    }
    expect(levelEnergy(Infinity)).toBe(0);
    expect(levelEnergy(1e6)).toBeCloseTo(0, 25);
  });
});

describe('fotonet ved en overgang', () => {
  it('Hα (3 → 2): 3,03 · 10⁻¹⁹ J, 1,89 eV, 4,57 · 10¹⁴ Hz og 657 nm rødt lys', () => {
    const s = solveHydrogenTask({ upper: 3, lower: 2 });
    expect(s.photon.E).toBeCloseTo(3.0278e-19, 22);
    expect(s.photon.eV).toBeCloseTo(1.892, 3);
    expect(s.photon.f).toBeCloseTo(4.567e14, -11);
    expect(s.photon.nm).toBeCloseTo(656.9, 1);
    expect(s.region).toBe('synlig');
    expect(s.color).toBe('rød');
  });

  it('Hβ (4 → 2): 4,09 · 10⁻¹⁹ J og 487 nm blågrønt lys', () => {
    const s = solveHydrogenTask({ upper: 4, lower: 2 });
    expect(s.photon.E).toBeCloseTo(4.0875e-19, 23);
    expect(s.photon.nm).toBeCloseTo(486.6, 1);
    expect(s.region).toBe('synlig');
    expect(s.color).toBe('blågrønn');
  });

  it('Paschen α (4 → 3): 1,06 · 10⁻¹⁹ J og 1,88 µm, infrarødt og ikke synlig', () => {
    const s = solveHydrogenTask({ upper: 4, lower: 3 });
    expect(s.photon.E).toBeCloseTo(1.0597e-19, 23);
    expect(s.photon.nm).toBeCloseTo(1876.9, 1);
    expect(s.region).toBe('ir');
    expect(s.color).toBeNull();
  });

  it('stemmer med de målte bølgelengdene (656,3, 486,1 og 1875 nm) innenfor 0,2 %', () => {
    const measured = [656.3, 486.1, 1875.1];
    HYDROGEN_TASKS.forEach((t, i) => {
      const nm = solveHydrogenTask(t).photon.nm;
      expect(Math.abs(nm / measured[i]! - 1)).toBeLessThan(0.002);
    });
  });

  it('følger Rydbergs formel 1/λ = R(1/n₁² − 1/n₂²) med R = B/(hc) ≈ 1,097 · 10⁷ /m', () => {
    const R = B_HYDROGEN / (H_PLANCK * C_LIGHT);
    expect(R).toBeCloseTo(1.096e7, -4);
    for (const t of HYDROGEN_TASKS) {
      const s = solveHydrogenTask(t);
      expect(1 / s.photon.lambda).toBeCloseTo(R * (1 / t.lower ** 2 - 1 / t.upper ** 2), 3);
    }
  });

  it('bevarer energien: E_øvre = E_nedre + E_foton, og E = hf = hc/λ', () => {
    for (const t of HYDROGEN_TASKS) {
      const s = solveHydrogenTask(t);
      expect(s.Elower + s.photon.E).toBeCloseTo(s.Eupper, 30);
      expect(H_PLANCK * s.photon.f).toBeCloseTo(s.photon.E, 30);
      expect(s.photon.lambda * s.photon.f).toBeCloseTo(C_LIGHT, 0);
      expect(wavelengthFromEnergy(s.photon.E)).toBeCloseTo(s.photon.lambda, 18);
    }
  });
});

describe('ionisering', () => {
  it('fra grunntilstanden: 2,18 · 10⁻¹⁸ J = 13,6 eV, og bare fotoner med λ ≤ 91,2 nm (ultrafiolett) klarer det', () => {
    const ion = ionization(1);
    expect(ion.E).toBeCloseTo(B_HYDROGEN, 30);
    expect(ion.eV).toBeCloseTo(13.625, 9);
    expect(ion.maxNm).toBeCloseTo(91.24, 2);
    expect(ion.region).toBe('uv');
  });

  it('fra nivå 2: 5,45 · 10⁻¹⁹ J = 3,41 eV og 365 nm (ultrafiolett, like utenfor det synlige)', () => {
    const ion = ionization(2);
    expect(ion.E).toBeCloseTo(5.45e-19, 30);
    expect(ion.eV).toBeCloseTo(3.406, 3);
    expect(ion.maxNm).toBeCloseTo(364.95, 2);
    expect(ion.region).toBe('uv');
  });

  it('fra nivå 3: 2,42 · 10⁻¹⁹ J og 821 nm (infrarødt: alt synlig lys kan ionisere)', () => {
    const ion = ionization(3);
    expect(ion.E).toBeCloseTo(2.4222e-19, 23);
    expect(ion.maxNm).toBeCloseTo(821.1, 1);
    expect(ion.region).toBe('ir');
    expect(ion.maxNm).toBeGreaterThan(VISIBLE_MAX);
  });

  it('krever mer energi enn et sprang ned til samme nivå (serien har en grense)', () => {
    for (const t of HYDROGEN_TASKS) {
      const s = solveHydrogenTask(t);
      expect(s.ionLower.E).toBeGreaterThan(s.photon.E);
      expect(s.ionLower.maxNm).toBeLessThan(s.photon.nm);
      // Grunntilstanden er dypest, så den krever mest.
      expect(s.ionGround.E).toBeGreaterThan(s.ionLower.E);
      expect(s.ionGround.E).toBeCloseTo(-s.E1, 30);
      expect(s.ionLower.E).toBeCloseTo(-s.Elower, 30);
    }
  });
});

describe('spekteret og fargene', () => {
  it('deler inn i ultrafiolett, synlig og infrarødt', () => {
    expect(regionOf(VISIBLE_MIN - 1)).toBe('uv');
    expect(regionOf(VISIBLE_MIN)).toBe('synlig');
    expect(regionOf(VISIBLE_MAX)).toBe('synlig');
    expect(regionOf(VISIBLE_MAX + 1)).toBe('ir');
  });

  it('gir samme fargenavn som spektrene i kapittelet', () => {
    expect(colorNameOf(410)).toBe('fiolett');
    expect(colorNameOf(434)).toBe('blåfiolett');
    expect(colorNameOf(470)).toBe('blå');
    expect(colorNameOf(530)).toBe('grønn');
    expect(colorNameOf(580)).toBe('gul');
    expect(colorNameOf(600)).toBe('oransje');
    expect(colorNameOf(700)).toBe('rød');
    expect(colorNameOf(300)).toBeNull();
    expect(colorNameOf(900)).toBeNull();
    expect(colorNameOf(Number.NaN)).toBeNull();
  });
});

describe('tallsettene', () => {
  it('gir endelige, fornuftige svar', () => {
    for (const t of HYDROGEN_TASKS) {
      expect(t.upper).toBeGreaterThan(t.lower);
      const s = solveHydrogenTask(t);
      expect(s.asked).toEqual([...new Set([1, t.lower, t.upper])].sort((a, b) => a - b));
      for (const v of [s.E1, s.Elower, s.Eupper, s.photon.E, s.photon.f, s.photon.lambda, s.ionGround.maxNm, s.ionLower.maxNm]) {
        expect(Number.isFinite(v)).toBe(true);
      }
      expect(s.photon.E).toBeGreaterThan(0);
      // Fotonene fra overgangene i oppgaven ligger mellom ca. 100 nm og 3 µm.
      expect(s.photon.nm).toBeGreaterThan(100);
      expect(s.photon.nm).toBeLessThan(3000);
      expect(s.color === null).toBe(s.region !== 'synlig');
    }
  });

  it('har både synlige og usynlige overganger, og begge utfallene i e)', () => {
    const sols = HYDROGEN_TASKS.map(solveHydrogenTask);
    expect(sols.some((s) => s.region === 'synlig')).toBe(true);
    expect(sols.some((s) => s.region === 'ir')).toBe(true);
    expect(sols.some((s) => s.ionLower.region === 'uv')).toBe(true);
    expect(sols.some((s) => s.ionLower.region === 'ir')).toBe(true);
  });

  it('går opp i b): de avrundede nivåene fra a) gir det avrundede svaret', () => {
    for (const t of HYDROGEN_TASKS) {
      const s = solveHydrogenTask(t);
      // Alle nivåene n ≥ 2 og fotonene i oppgaven skrives med 10⁻¹⁹.
      expect(Math.floor(Math.log10(-s.Eupper))).toBe(-19);
      expect(Math.floor(Math.log10(-s.Elower))).toBe(-19);
      expect(Math.floor(Math.log10(s.photon.E))).toBe(-19);
      const diff = round(round(m19(s.Eupper), 2) - round(m19(s.Elower), 2), 2);
      expect(diff).toBeCloseTo(round(m19(s.photon.E), 2), 9);
    }
  });

  it('går opp i c), d) og e): mellomsvaret med fire siffer gir samme svar med tre siffer', () => {
    const hc = 6.63 * 3.0; // · 10⁻²⁶ J m
    for (const t of HYDROGEN_TASKS) {
      const s = solveHydrogenTask(t);
      const fromShown = (hc / round(m19(s.photon.E), 3)) * 1e2; // nm
      expect(sig(fromShown, 3)).toBeCloseTo(sig(s.photon.nm, 3), 6);
      const ionShown = (hc / round(m19(s.ionLower.E), 3)) * 1e2;
      expect(sig(ionShown, 3)).toBeCloseTo(sig(s.ionLower.maxNm, 3), 6);
    }
    const ground = (hc / 21.8) * 1e2;
    expect(sig(ground, 3)).toBeCloseTo(sig(ionization(1).maxNm, 3), 6);
  });
});
