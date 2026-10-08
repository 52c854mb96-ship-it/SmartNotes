import { describe, expect, it } from 'vitest';
import { fmt, fmtSci } from '../../kit/format';
import {
  C_LIGHT,
  H_PLANCK,
  J_PER_EV,
  PHOTON_TASKS,
  UVB_MAX,
  UVB_MIN,
  VISIBLE_MAX,
  VISIBLE_MIN,
  photonEnergy,
  photonsPerSecond,
  regionOf,
  solvePhotonTask,
  wavelengthNm,
} from './model-eks-foton';

/** Avrunding til `sig` gjeldende siffer (slik fmtSci viser tallet med sig − 1 desimaler). */
const sig = (v: number, s: number) => {
  const e = Math.floor(Math.log10(Math.abs(v)));
  return Math.round(v / 10 ** (e - s + 1)) * 10 ** (e - s + 1);
};

describe('fotonenergien E = hc/λ', () => {
  it('gir kjente verdier', () => {
    // hc = 1,989 · 10⁻²⁵ J m med konstantene i boka
    expect(H_PLANCK * C_LIGHT).toBeCloseTo(1.989e-25, 30);
    expect(photonEnergy(650)).toBeCloseTo(3.06e-19, 30);
    expect(photonEnergy(532)).toBeCloseTo(3.7387e-19, 23);
    expect(photonEnergy(300)).toBeCloseTo(6.63e-19, 30);
    // ca. 1,9 eV for rødt, 2,3 eV for grønt og 4,1 eV for UV-B
    expect(photonEnergy(650) / J_PER_EV).toBeCloseTo(1.9125, 6);
    expect(photonEnergy(532) / J_PER_EV).toBeCloseTo(2.3367, 4);
    expect(photonEnergy(300) / J_PER_EV).toBeCloseTo(4.14375, 6);
  });

  it('er omvendt proporsjonal med bølgelengden', () => {
    expect(photonEnergy(325) / photonEnergy(650)).toBeCloseTo(2, 12);
    expect(photonEnergy(400) * 400).toBeCloseTo(photonEnergy(700) * 700, 30);
    for (let nm = 200; nm < 900; nm += 50) expect(photonEnergy(nm + 50)).toBeLessThan(photonEnergy(nm));
  });

  it('wavelengthNm er den omvendte funksjonen', () => {
    for (const nm of [91.2, 300, 532, 650, 1875]) expect(wavelengthNm(photonEnergy(nm))).toBeCloseTo(nm, 9);
  });

  it('deler spekteret i ultrafiolett, synlig og infrarødt', () => {
    expect(regionOf(300)).toBe('uv');
    expect(regionOf(VISIBLE_MIN)).toBe('synlig');
    expect(regionOf(650)).toBe('synlig');
    expect(regionOf(VISIBLE_MAX)).toBe('synlig');
    expect(regionOf(800)).toBe('ir');
  });
});

describe('fotoner per sekund N = P/E', () => {
  it('rød laserpeker på 1,0 mW og 650 nm: 3,27 · 10¹⁵ fotoner per sekund', () => {
    expect(photonsPerSecond(1e-3, photonEnergy(650))).toBeCloseTo(3.268e15, -12);
  });

  it('er proporsjonal med effekten og med bølgelengden', () => {
    const E = photonEnergy(532);
    expect(photonsPerSecond(2e-3, E)).toBeCloseTo(2 * photonsPerSecond(1e-3, E), -3);
    expect(photonsPerSecond(1e-3, photonEnergy(600)) / photonsPerSecond(1e-3, photonEnergy(400))).toBeCloseTo(1.5, 12);
  });
});

describe('tallsett 1 (650 nm, 532 nm, 1,0 mW, 300 nm)', () => {
  const s = solvePhotonTask(PHOTON_TASKS[0]!);

  it('rød: 3,06 · 10⁻¹⁹ J = 1,91 eV og 3,3 · 10¹⁵ fotoner per sekund', () => {
    expect(fmtSci(s.red.E, 2)).toBe('3,06 · 10⁻¹⁹');
    expect(fmt(s.red.eV, 2)).toBe('1,91');
    expect(fmtSci(s.red.N, 1)).toBe('3,3 · 10¹⁵');
    expect(s.red.f).toBeCloseTo(4.615e14, -11);
  });

  it('grønn: 3,74 · 10⁻¹⁹ J = 2,34 eV og 2,7 · 10¹⁵ fotoner per sekund', () => {
    expect(fmtSci(s.green.E, 2)).toBe('3,74 · 10⁻¹⁹');
    expect(fmt(s.green.eV, 2)).toBe('2,34');
    expect(fmtSci(s.green.N, 1)).toBe('2,7 · 10¹⁵');
  });

  it('grønt foton har 22 % mer energi, og den grønne sender 18 % færre fotoner', () => {
    expect(s.ratioE).toBeCloseTo(650 / 532, 12);
    expect(s.ratioN).toBeCloseTo(532 / 650, 12);
    expect(s.morePct).toBe(22);
    expect(s.fewerPct).toBe(18);
  });

  it('UV-B på 300 nm: 6,63 · 10⁻¹⁹ J = 4,14 eV, og grensen for DNA-skade er 311 nm', () => {
    expect(fmtSci(s.uv.E, 2)).toBe('6,63 · 10⁻¹⁹');
    expect(fmt(s.uv.eV, 2)).toBe('4,14');
    expect(s.damageJ).toBeCloseTo(6.4e-19, 30);
    expect(s.maxNm).toBeCloseTo(310.78, 2);
    expect(fmt(s.maxNm, 0)).toBe('311');
    expect(fmtSci(s.uv.N, 1)).toBe('1,5 · 10¹⁵');
  });

  it('tre røde fotoner har til sammen mer enn 4,0 eV (men tas opp hver for seg)', () => {
    expect(s.redNeeded).toBe(3);
    expect(2 * s.red.eV).toBeLessThan(4);
    expect(3 * s.red.eV).toBeGreaterThan(4);
  });
});

describe('alle tallsettene', () => {
  for (const [i, task] of PHOTON_TASKS.entries()) {
    const s = solvePhotonTask(task);
    describe(`tallsett ${i + 1}`, () => {
      it('har vanlige laserpekere og UV-B fra sola', () => {
        // Rødt lys fra 625 nm, grønt fra 495 til 570 nm, effekt på høyst 1 mW (klasse 2)
        expect(task.redNm).toBeGreaterThanOrEqual(625);
        expect(task.redNm).toBeLessThanOrEqual(700);
        expect(task.greenNm).toBeGreaterThanOrEqual(495);
        expect(task.greenNm).toBeLessThanOrEqual(570);
        expect(task.P).toBeGreaterThan(0);
        expect(task.P).toBeLessThanOrEqual(1e-3);
        expect(task.uvNm).toBeGreaterThanOrEqual(UVB_MIN);
        expect(task.uvNm).toBeLessThanOrEqual(UVB_MAX);
        expect(s.red.region).toBe('synlig');
        expect(s.green.region).toBe('synlig');
        expect(s.uv.region).toBe('uv');
      });

      it('bevarer energien: N · E = P for hver stråle', () => {
        for (const p of [s.red, s.green, s.uv]) {
          expect(p.N * p.E).toBeCloseTo(task.P, 15);
          expect(p.f * p.lambda).toBeCloseTo(C_LIGHT, 3);
          expect(p.E).toBeCloseTo(H_PLANCK * p.f, 30);
        }
      });

      it('grønt foton har mer energi, men det kommer færre av dem (ratioE · ratioN = 1)', () => {
        expect(s.green.E).toBeGreaterThan(s.red.E);
        expect(s.green.N).toBeLessThan(s.red.N);
        expect(s.ratioE * s.ratioN).toBeCloseTo(1, 12);
        expect(s.ratioE).toBeCloseTo(task.redNm / task.greenNm, 12);
        expect(s.morePct).toBeGreaterThan(s.fewerPct);
        expect(s.morePct).toBeGreaterThan(10);
        expect(s.morePct).toBeLessThan(40);
        // Prosentene stemmer med forholdstallene slik de vises (tre desimaler)
        expect(Math.round((Number(fmt(s.ratioE, 3).replace(',', '.')) - 1) * 100)).toBe(s.morePct);
        expect(Math.round((1 - Number(fmt(s.ratioN, 3).replace(',', '.'))) * 100)).toBe(s.fewerPct);
        expect(fmt(1 / s.ratioE, 3)).toBe(fmt(s.ratioN, 3));
      });

      it('bare UV-B-fotonet kan skade DNA, og grensen ligger mellom UV-B og synlig lys', () => {
        expect(s.uv.canDamage).toBe(true);
        expect(s.red.canDamage).toBe(false);
        expect(s.green.canDamage).toBe(false);
        expect(s.uv.eV).toBeGreaterThan(task.damageEV + 0.05);
        expect(s.maxNm).toBeGreaterThan(task.uvNm);
        expect(s.maxNm).toBeLessThan(VISIBLE_MIN);
        expect(s.maxNm).toBeLessThan(UVB_MAX);
        expect(photonEnergy(s.maxNm)).toBeCloseTo(s.damageJ, 30);
        expect(s.redNeeded * s.red.eV).toBeGreaterThanOrEqual(task.damageEV);
        expect((s.redNeeded - 1) * s.red.eV).toBeLessThan(task.damageEV);
        // Heller ikke det mest energirike synlige lyset (fiolett, 380 nm) kan skade: 3,27 eV
        expect(s.visibleMaxEV).toBeCloseTo(3.271, 3);
        expect(s.visibleMaxEV).toBeLessThan(task.damageEV);
        expect(s.visibleMaxEV).toBeGreaterThan(s.green.eV);
      });

      it('går opp når eleven regner videre med tallene slik de vises', () => {
        // E med fire gjeldende siffer (mellomsvar) og N med fire og to
        for (const p of [s.red, s.green, s.uv]) {
          const E4 = sig(p.E, 4);
          expect(sig((H_PLANCK * C_LIGHT) / (sig(p.lambda, 3)), 4)).toBe(E4);
          // eV med tre gjeldende siffer, regnet fra mellomsvaret
          expect(Math.abs(E4 / J_PER_EV - p.eV)).toBeLessThan(0.002);
          expect(fmt(E4 / J_PER_EV, 2)).toBe(fmt(p.eV, 2));
          expect(fmtSci(task.P / E4, 1)).toBe(fmtSci(p.N, 1));
        }
        for (const p of [s.red, s.green]) expect(fmtSci(task.P / sig(p.E, 4), 3)).toBe(fmtSci(p.N, 3));
        // λ_maks fra E_min i joule med tre gjeldende siffer
        expect(fmtSci(wavelengthNm(sig(s.damageJ, 3)) * 1e-9, 3)).toBe(fmtSci(s.maxNm * 1e-9, 3));
        expect(fmt(sig(s.maxNm, 4), 0)).toBe(fmt(s.maxNm, 0));
      });

      it('gir ingen ugyldige tall', () => {
        const all = [s.ratioE, s.ratioN, s.damageJ, s.maxNm, s.redNeeded, s.morePct, s.fewerPct];
        for (const p of [s.red, s.green, s.uv]) all.push(p.E, p.eV, p.N, p.f, p.lambda);
        for (const v of all) {
          expect(Number.isFinite(v)).toBe(true);
          expect(v).toBeGreaterThan(0);
        }
      });
    });
  }

  it('tallsettene er forskjellige', () => {
    const keys = PHOTON_TASKS.map((t) => `${t.redNm}-${t.greenNm}-${t.P}-${t.uvNm}`);
    expect(new Set(keys).size).toBe(PHOTON_TASKS.length);
    const pct = PHOTON_TASKS.map((t) => solvePhotonTask(t).morePct);
    expect(new Set(pct).size).toBe(PHOTON_TASKS.length);
  });
});
