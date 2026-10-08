import { describe, expect, it } from 'vitest';
import {
  C_LIGHT,
  DEFAULT_ENERGY_INDEX,
  ENERGY_STEPS,
  E_CHARGE,
  H_MAX,
  H_MIN,
  H_PLANCK,
  LINES,
  LINE_ORDER,
  SOFT_SHARE,
  N2PLUS_B_EV,
  N2_IONIZATION_EV,
  airDensity,
  auroraProfile,
  collisionCount,
  decimalsFor,
  GRAPH_GAINS,
  graphGains,
  roundSig,
  deposition,
  depositionMono,
  dominantLine,
  emission,
  emissionQuantile,
  emissionRange,
  excitationEnergy,
  lightenRgb,
  lineShares,
  lowerEdge,
  mixLight,
  nmFromEV,
  oxygenFraction,
  oxygenLevels,
  parseRgb,
  peakAltitude,
  photonFromNm,
  quenchAltitude,
  rgbText,
  scaleHeight,
  spectrumWeights,
  survival,
  transitionLevels,
  typicalAltitude,
} from './model-nordlys';

const close = (a: number, b: number, rel = 1e-9) => expect(Math.abs(a - b)).toBeLessThanOrEqual(rel * Math.max(1, Math.abs(b)));

/** Integral over høyden med trapesmetoden (km). */
function integrate(f: (h: number) => number, a = 40, b = 800, n = 7600): number {
  const dh = (b - a) / n;
  let s = 0.5 * (f(a) + f(b));
  for (let i = 1; i < n; i++) s += f(a + i * dh);
  return s * dh;
}

describe('konstantene som i ERGO Fysikk 1', () => {
  it('har h, c og e med tre gjeldende siffer', () => {
    expect(H_PLANCK).toBe(6.63e-34);
    expect(C_LIGHT).toBe(3.0e8);
    expect(E_CHARGE).toBe(1.6e-19);
  });
});

describe('fotonene: f = c/λ og E = hf', () => {
  it('regner ut det grønne oksygenfotonet for hånd', () => {
    // f = 3,00 · 10⁸ / 557,7 · 10⁻⁹ = 5,379 · 10¹⁴ Hz, E = 6,63 · 10⁻³⁴ · 5,379 · 10¹⁴ = 3,566 · 10⁻¹⁹ J = 2,229 eV
    const p = photonFromNm(557.7);
    close(p.lambda, 557.7e-9);
    close(p.f, 5.3792361484669e14, 1e-9);
    close(p.E, 3.5664335664e-19, 1e-9);
    close(p.eV, 2.2290209790, 1e-9);
  });

  it('gir de kjente fotonenergiene for alle tre linjene', () => {
    expect(photonFromNm(LINES.gronn.nm).eV).toBeCloseTo(2.23, 2);
    expect(photonFromNm(LINES.rod.nm).eV).toBeCloseTo(1.97, 2);
    expect(photonFromNm(LINES.blaa.nm).eV).toBeCloseTo(2.91, 2);
  });

  it('gir mer energi for kortere bølgelengde (blåfiolett > grønt > rødt)', () => {
    const E = (id: 'gronn' | 'rod' | 'blaa') => photonFromNm(LINES[id].nm).E;
    expect(E('blaa')).toBeGreaterThan(E('gronn'));
    expect(E('gronn')).toBeGreaterThan(E('rod'));
  });

  it('er konsistent: E = hc/λ, og nmFromEV går tilbake', () => {
    for (const nm of [380, 427.8, 557.7, 630, 750]) {
      const p = photonFromNm(nm);
      close(p.E, (H_PLANCK * C_LIGHT) / (nm * 1e-9));
      close(p.f * p.lambda, C_LIGHT);
      close(nmFromEV(p.eV), nm, 1e-12);
    }
  });

  it('gir NaN for ugyldige bølgelengder og energier, ikke krasj', () => {
    expect(photonFromNm(0).eV).toBeNaN();
    expect(photonFromNm(-5).f).toBeNaN();
    expect(photonFromNm(Number.NaN).E).toBeNaN();
    expect(nmFromEV(0)).toBeNaN();
  });
});

describe('energinivåene', () => {
  it('bygger oksygenets nivåer av fotonene: E₁ = 1,97 eV og E₂ = 4,20 eV', () => {
    const o = oxygenLevels();
    expect(o.ground).toBe(0);
    expect(o.first).toBeCloseTo(1.97, 2);
    expect(o.second).toBeCloseTo(4.2, 2);
  });

  it('bevarer energien: grønt + rødt foton = hele veien ned fra nivå 2', () => {
    const o = oxygenLevels();
    close(photonFromNm(LINES.gronn.nm).eV + photonFromNm(LINES.rod.nm).eV, o.second - o.ground);
  });

  it('gir fotonenergien som forskjellen mellom nivåene for alle linjene', () => {
    for (const id of LINE_ORDER) {
      const t = transitionLevels(id);
      expect(t.upper).toBeGreaterThan(t.lower);
      close(t.upper - t.lower, photonFromNm(LINES[id].nm).eV);
    }
  });

  it('krever mer energi i støtet enn fotonet tar med seg', () => {
    for (const id of LINE_ORDER) expect(excitationEnergy(id)).toBeGreaterThanOrEqual(photonFromNm(LINES[id].nm).eV - 1e-12);
    // N₂⁺: ionisering av N₂ og eksitasjon av ionet, ca. 19 eV
    close(excitationEnergy('blaa'), N2_IONIZATION_EV + N2PLUS_B_EV);
    expect(excitationEnergy('blaa')).toBeCloseTo(18.75, 2);
    expect(excitationEnergy('gronn')).toBeCloseTo(4.2, 2);
  });

  it('har riktig bestemt form av fargene (det grønne, røde og blåfiolette lyset)', () => {
    expect(LINE_ORDER.map((id) => LINES[id].colorDef)).toEqual(['grønne', 'røde', 'blåfiolette']);
  });

  it('har levetider i riktig rekkefølge: rødt ≫ grønt ≫ blåfiolett', () => {
    expect(LINES.rod.lifetime).toBeGreaterThan(100 * LINES.gronn.lifetime);
    expect(LINES.gronn.lifetime).toBeGreaterThan(1e6 * LINES.blaa.lifetime);
  });
});

describe('elektronene: raskere elektroner kommer lenger ned', () => {
  it('gir lavere stopphøyde for høyere energi', () => {
    let prev = Infinity;
    for (const E of [0.05, 0.1, 0.3, 1, 3, 10, 30, 100, 300]) {
      const h = peakAltitude(E);
      expect(h).toBeLessThan(prev);
      prev = h;
    }
  });

  it('treffer kjente høyder: ca. 145 km for 1 keV og ca. 105 km for 10 keV', () => {
    expect(peakAltitude(1)).toBeCloseTo(145, 5);
    expect(peakAltitude(10)).toBeCloseTo(105, 5);
    expect(peakAltitude(3)).toBeGreaterThan(115);
    expect(peakAltitude(3)).toBeLessThan(128);
  });

  it('klemmer utenfor tabellen og gir NaN for ugyldig energi', () => {
    expect(peakAltitude(0.001)).toBe(260);
    expect(peakAltitude(1e4)).toBe(74);
    expect(peakAltitude(0)).toBeNaN();
    expect(peakAltitude(-1)).toBeNaN();
  });

  it('gir fra seg all energien: arealet under avsetningskurva er 1', () => {
    for (const E of [0.12, 0.5, 5, 50]) close(integrate((h) => depositionMono(h, E)), 1, 2e-3);
    for (const E of ENERGY_STEPS) close(integrate((h) => deposition(h, E)), 1, 3e-3);
  });

  it('har maksimum i stopphøyden og er bratt nede, slakk oppe', () => {
    const E = 5;
    const hp = peakAltitude(E);
    const d0 = depositionMono(hp, E);
    expect(depositionMono(hp - 2, E)).toBeLessThan(d0);
    expect(depositionMono(hp + 2, E)).toBeLessThan(d0);
    // 15 km under er nesten ingenting igjen, 15 km over er det fortsatt litt
    expect(depositionMono(hp - 15, E)).toBeLessThan(depositionMono(hp + 15, E));
  });

  it('har spekterandeler som summerer til 1', () => {
    for (const E of ENERGY_STEPS) close(spectrumWeights(E).reduce((a, b) => a + b, 0), 1);
    expect(spectrumWeights(0).every((w) => w === 0)).toBe(true);
  });
});

describe('lufta', () => {
  it('blir tynnere oppover', () => {
    let prev = Infinity;
    for (let h = 50; h <= 600; h += 10) {
      const n = airDensity(h);
      expect(n).toBeLessThan(prev);
      expect(n).toBeGreaterThan(0);
      prev = n;
    }
  });

  it('har realistiske tall: ca. 10¹³ per cm³ ved 100 km og ca. 10¹⁰ ved 200 km', () => {
    expect(Math.log10(airDensity(100))).toBeCloseTo(13, 0);
    expect(Math.log10(airDensity(200))).toBeCloseTo(10, 0);
  });

  it('har skalahøyde som vokser oppover (ca. 6 km ved 100 km, ca. 35 km ved 200 km)', () => {
    expect(scaleHeight(100)).toBeGreaterThan(4);
    expect(scaleHeight(100)).toBeLessThan(8);
    expect(scaleHeight(200)).toBeGreaterThan(25);
    expect(scaleHeight(200)).toBeLessThan(45);
    expect(scaleHeight(300)).toBeGreaterThan(scaleHeight(150));
  });

  it('har mest N₂ nede og mest O-atomer oppe', () => {
    expect(oxygenFraction(100)).toBeLessThan(0.2);
    expect(oxygenFraction(300)).toBeGreaterThan(0.9);
    for (let h = 80; h < 450; h += 10) expect(oxygenFraction(h + 10)).toBeGreaterThan(oxygenFraction(h));
  });
});

describe('støt tar energien før fotonet sendes ut', () => {
  it('lar flere lyse jo høyere opp (tynnere luft)', () => {
    for (const id of LINE_ORDER) {
      for (let h = 80; h < 440; h += 20) {
        expect(survival(id, h + 20)).toBeGreaterThanOrEqual(survival(id, h));
        expect(survival(id, h)).toBeGreaterThan(0);
        expect(survival(id, h)).toBeLessThanOrEqual(1);
      }
    }
  });

  it('stopper det røde lyset under ca. 200 km og det grønne under ca. 100 km, men ikke nitrogenionet', () => {
    const rod = quenchAltitude('rod');
    const gronn = quenchAltitude('gronn');
    expect(rod).toBeGreaterThan(190);
    expect(rod).toBeLessThan(260);
    expect(gronn).toBeGreaterThan(85);
    expect(gronn).toBeLessThan(105);
    expect(survival('blaa', 80)).toBeGreaterThan(0.99);
  });
});

describe('høydene fargene kommer fra', () => {
  it('legger lagene i riktig rekkefølge: blåfiolett nederst, så grønt, rødt øverst', () => {
    for (const E of ENERGY_STEPS) {
      const b = emissionQuantile('blaa', E, 0.5);
      const g = emissionQuantile('gronn', E, 0.5);
      const r = emissionQuantile('rod', E, 0.5);
      expect(b).toBeLessThan(g);
      expect(g).toBeLessThan(r);
    }
  });

  it('stemmer med lærebokas tall ved vanlige energier (5 keV)', () => {
    const E = 5;
    const g = emissionRange('gronn', E);
    const r = emissionRange('rod', E);
    const b = emissionRange('blaa', E);
    // Grønt ca. 100–200 km, rødt over ca. 200 km, blåfiolett rundt 100 km
    expect(g[0]).toBeGreaterThanOrEqual(95);
    expect(g[1]).toBeLessThanOrEqual(200);
    expect(r[0]).toBeGreaterThanOrEqual(190);
    expect(r[1]).toBeLessThanOrEqual(400);
    expect(b[0]).toBeGreaterThanOrEqual(85);
    expect(b[1]).toBeLessThanOrEqual(125);
  });

  it('flytter nordlyset nedover når elektronene blir raskere', () => {
    let prevEdge = Infinity;
    let prevGreen = Infinity;
    for (const E of ENERGY_STEPS) {
      const edge = lowerEdge(E);
      const g = typicalAltitude('gronn', E);
      expect(edge).toBeLessThan(prevEdge);
      expect(g).toBeLessThanOrEqual(prevGreen);
      prevEdge = edge;
      prevGreen = g;
    }
    expect(lowerEdge(10)).toBeLessThan(90);
    expect(lowerEdge(0.3)).toBeGreaterThan(105);
  });

  it('gir rødt nordlys med langsomme elektroner og grønt med raske', () => {
    const slow = lineShares(ENERGY_STEPS[0]!);
    const typical = lineShares(ENERGY_STEPS[DEFAULT_ENERGY_INDEX]!);
    expect(slow.rod).toBeGreaterThan(0.4);
    expect(typical.gronn).toBeGreaterThan(0.5);
    expect(dominantLine(5)).toBe('gronn');
    expect(slow.rod).toBeGreaterThan(typical.rod);
    // Mer blåfiolett jo dypere elektronene kommer
    let prev = 0;
    for (const E of ENERGY_STEPS) {
      const s = lineShares(E).blaa;
      expect(s).toBeGreaterThan(prev);
      prev = s;
    }
  });

  it('har andeler som summerer til 1 og ingen NaN for alle valgene', () => {
    for (const E of ENERGY_STEPS) {
      const s = lineShares(E);
      close(s.gronn + s.rod + s.blaa, 1);
      const p = auroraProfile(E);
      expect(p.h[0]).toBe(H_MIN);
      expect(p.h[p.h.length - 1]).toBe(H_MAX);
      expect(p.max).toBeGreaterThan(0);
      for (const id of LINE_ORDER) {
        expect(p.I[id].every((v) => Number.isFinite(v) && v >= 0)).toBe(true);
        const [lo, hi] = emissionRange(id, E);
        expect(lo).toBeLessThan(hi);
        expect(lo).toBeGreaterThanOrEqual(H_MIN);
        expect(hi).toBeLessThanOrEqual(H_MAX);
        expect(lo % 5).toBe(0);
      }
    }
  });

  it('gir bare de langsomme elektronene når hovedenergien er ugyldig (ingen NaN)', () => {
    close(integrate((h) => deposition(h, 0)), SOFT_SHARE, 3e-3);
    for (const id of LINE_ORDER) {
      const v = emission(id, 250, 0);
      expect(Number.isFinite(v)).toBe(true);
      expect(v).toBeGreaterThanOrEqual(0);
    }
  });
});

describe('fargeblanding av lys', () => {
  it('gir den rene fargen for én linje og normerer til 255', () => {
    expect(mixLight([{ rgb: [100, 50, 0], w: 3 }])).toEqual([255, 128, 0]);
  });

  it('blander rødt og grønt til gult (additivt)', () => {
    expect(mixLight([
      { rgb: [255, 0, 0], w: 1 },
      { rgb: [0, 255, 0], w: 1 },
    ])).toEqual([255, 255, 0]);
  });

  it('tåler null, negative og ugyldige vekter', () => {
    expect(mixLight([])).toEqual([0, 0, 0]);
    expect(mixLight([{ rgb: [255, 0, 0], w: -1 }, { rgb: [0, 0, 255], w: Number.NaN }])).toEqual([0, 0, 0]);
  });

  it('gjør farger lysere mot hvitt og skriver dem som rgb-tekst', () => {
    expect(lightenRgb([100, 0, 255], 0)).toEqual([100, 0, 255]);
    expect(lightenRgb([100, 0, 255], 1)).toEqual([255, 255, 255]);
    expect(lightenRgb([100, 0, 255], 0.2)).toEqual([131, 51, 255]);
    expect(lightenRgb([100, 0, 255], Number.NaN)).toEqual([100, 0, 255]);
    expect(rgbText([1, 2, 3])).toBe('rgb(1 2 3)');
  });

  it('leser rgb-tekst med og uten komma', () => {
    expect(parseRgb('rgb(154 0 213)')).toEqual([154, 0, 213]);
    expect(parseRgb('rgb(1, 2, 3)')).toEqual([1, 2, 3]);
    expect(parseRgb('grønn')).toEqual([0, 0, 0]);
  });
});

describe('visning', () => {
  it('gir tre gjeldende siffer', () => {
    expect(decimalsFor(2.229)).toBe(2);
    expect(decimalsFor(18.75)).toBe(1);
    expect(decimalsFor(557.7)).toBe(0);
    expect(decimalsFor(0)).toBe(0);
    expect(decimalsFor(Number.NaN)).toBe(0);
  });
});

describe('grafen «Lys fra hver høyde»', () => {
  it('den sterkeste kurven får ingen forstørrelse, og en forstørret kurve holder seg innenfor grafen', () => {
    for (const keV of ENERGY_STEPS) {
      const p = auroraProfile(keV, 5);
      const g = graphGains(p);
      const peaks = LINE_ORDER.map((id) => Math.max(...p.I[id]) / p.max);
      expect(Math.max(...peaks)).toBeCloseTo(1, 10);
      LINE_ORDER.forEach((id, i) => {
        const peak = peaks[i]!;
        expect(g[id] === 1 || GRAPH_GAINS.includes(g[id])).toBe(true);
        if (peak >= 0.3) expect(g[id]).toBe(1);
        else expect(g[id]).toBeGreaterThan(1);
        expect(peak * g[id]).toBeLessThanOrEqual(0.95 + 1e-12);
        // Forstørret kurve blir tydelig (minst 40 % av bredden), men aldri sterkere enn den sterkeste
        if (g[id] > 1) expect(peak * g[id]).toBeGreaterThanOrEqual(0.4);
      });
    }
  });

  it('ved 5 keV er den røde toppen svak (under 10 % av den grønne) og vises × 10', () => {
    const p = auroraProfile(5, 5);
    const red = Math.max(...p.I.rod) / Math.max(...p.I.gronn);
    expect(red).toBeLessThan(0.1);
    expect(graphGains(p).rod).toBe(10);
    expect(graphGains(p).gronn).toBe(1);
  });
});

describe('antall støt ett elektron rekker', () => {
  it('regnes med den viste energien og to gjeldende siffer', () => {
    expect(roundSig(1190.48, 2)).toBe(1200);
    expect(roundSig(18.749999, 3)).toBeCloseTo(18.7, 10);
    expect(roundSig(18.75, 3)).toBeCloseTo(18.8, 10);
    expect(collisionCount('gronn', 5)).toEqual({ eV: 4.2, count: 1200 });
    expect(collisionCount('gronn', 10).count).toBe(2400);
    expect(collisionCount('rod', 5)).toEqual({ eV: 1.97, count: 2500 });
    expect(collisionCount('gronn', 0.3).count).toBe(71);
    // N₂⁺: 15,6 eV + 3,2 eV ≈ 18,8 eV, som i formelen
    expect(collisionCount('blaa', 5).eV).toBeCloseTo(18.8, 10);
    expect(collisionCount('blaa', 5).count).toBe(270);
    for (const id of LINE_ORDER)
      for (const keV of ENERGY_STEPS) {
        const c = collisionCount(id, keV);
        expect(c.count).toBe(roundSig((keV * 1000) / c.eV, 2));
        expect(Math.abs(c.eV - excitationEnergy(id))).toBeLessThan(0.051);
      }
  });
});
