import { describe, expect, it } from 'vitest';
import { elementName, elementSymbol, nuclideText, nuclideWords, Z_MAX } from './elements';
import { placeLabels } from './labels';
import {
  atomInfo,
  BALMER_STRENGTH,
  colorName,
  chargeSuperscript,
  electronRange,
  elementLines,
  hydrogenVisibleLines,
  levelEnergyEV,
  levelEnergyJ,
  mostCommonA,
  nearestLine,
  neutronRange,
  H_PLANCK,
  photonFromWavelength,
  photonSteps,
  roundSig,
  seriesName,
  shellConfig,
  sigDecimals,
  spectralRegion,
  STABLE_ISOTOPES,
  strongestLine,
  sunLinesOf,
  transitionPhoton,
  wavelengthColor,
  wavelengthToRgb,
} from './model';

describe('grunnstofftabellen', () => {
  it('har symbol og norsk navn for Z = 1–95', () => {
    expect(Z_MAX).toBeGreaterThanOrEqual(95);
    for (let Z = 1; Z <= 95; Z++) {
      expect(elementSymbol(Z)).toMatch(/^[A-Z][a-z]?$/);
      expect(elementName(Z).length).toBeGreaterThan(1);
    }
    expect(elementSymbol(11)).toBe('Na');
    expect(elementName(11)).toBe('natrium');
    expect(elementSymbol(26)).toBe('Fe');
    expect(elementSymbol(82)).toBe('Pb');
    expect(elementSymbol(92)).toBe('U');
    expect(elementName(92)).toBe('uran');
    expect(elementSymbol(95)).toBe('Am');
  });

  it('skriver nuklider med hevet nukleontall', () => {
    expect(nuclideText(6, 14)).toBe('¹⁴C');
    expect(nuclideText(92, 238)).toBe('²³⁸U');
    expect(nuclideWords(6, 14)).toBe('karbon-14');
    expect(elementSymbol(200)).toBe('?');
  });
});

describe('atomets sammensetning', () => {
  it('fyller skallene 2, 8, 8, 2', () => {
    expect(shellConfig(1)).toEqual([1]);
    expect(shellConfig(2)).toEqual([2]);
    expect(shellConfig(11)).toEqual([2, 8, 1]);
    expect(shellConfig(18)).toEqual([2, 8, 8]);
    expect(shellConfig(20)).toEqual([2, 8, 8, 2]);
    expect(shellConfig(0)).toEqual([]);
    for (let e = 0; e <= 20; e++) expect(shellConfig(e).reduce((a, b) => a + b, 0)).toBe(e);
  });

  it('natrium-23: A = Z + N, nøytralt og stabilt', () => {
    const a = atomInfo(11, 12, 11);
    expect(a.A).toBe(23);
    expect(a.symbol).toBe('Na');
    expect(a.charge).toBe(0);
    expect(a.status).toBe('stabil');
    expect(a.shells).toEqual([2, 8, 1]);
  });

  it('ioner: Na⁺ har mistet ett elektron, O²⁻ har fått to', () => {
    expect(atomInfo(11, 12, 10).charge).toBe(1);
    expect(atomInfo(8, 8, 10).charge).toBe(-2);
    expect(chargeSuperscript(1)).toBe('⁺');
    expect(chargeSuperscript(2)).toBe('²⁺');
    expect(chargeSuperscript(-1)).toBe('⁻');
    expect(chargeSuperscript(-2)).toBe('²⁻');
    expect(chargeSuperscript(0)).toBe('');
    expect(chargeSuperscript(12)).toBe('¹²⁺');
  });

  it('isotoper: ¹⁴C er radioaktiv, ¹²C og ¹³C er stabile', () => {
    expect(atomInfo(6, 6, 6).status).toBe('stabil');
    expect(atomInfo(6, 7, 6).status).toBe('stabil');
    const c14 = atomInfo(6, 8, 6);
    expect(c14.status).toBe('radioaktiv');
    expect(c14.halfLife).toBe('5730 år');
    expect(atomInfo(1, 2, 1).status).toBe('radioaktiv');
  });

  it('for mange eller for få nøytroner gir ustabile kjerner', () => {
    expect(atomInfo(8, 12, 8).status).toBe('for-mange-noytroner');
    expect(atomInfo(8, 6, 8).status).toBe('for-faa-noytroner');
  });

  it('nesten all massen sitter i kjernen', () => {
    const h = atomInfo(1, 0, 1);
    expect(h.nucleusMassFraction).toBeCloseTo(1.673e-27 / (1.673e-27 + 9.11e-31), 9);
    expect(h.nucleusMassFraction).toBeGreaterThan(0.999);
    expect(atomInfo(20, 20, 20).nucleusMassFraction).toBeGreaterThan(0.9997);
    // Helt ionisert (bare kjernen): all massen i kjernen
    expect(atomInfo(2, 2, 0).nucleusMassFraction).toBe(1);
  });

  it('glidebryterområdene gir alltid gyldige atomer', () => {
    for (let Z = 1; Z <= 20; Z++) {
      const [nLo, nHi] = neutronRange(Z);
      const [eLo, eHi] = electronRange(Z);
      expect(nLo).toBeGreaterThanOrEqual(0);
      expect(nHi).toBeGreaterThan(nLo);
      expect(eLo).toBe(0);
      expect(eHi).toBeLessThanOrEqual(20);
      expect(eHi).toBeGreaterThanOrEqual(Z);
      // Den vanligste isotopen ligger innenfor området
      const N0 = mostCommonA(Z) - Z;
      expect(N0).toBeGreaterThanOrEqual(nLo);
      expect(N0).toBeLessThanOrEqual(nHi);
      for (const A of STABLE_ISOTOPES[Z] ?? []) expect(A - Z).toBeLessThanOrEqual(nHi);
    }
    expect(neutronRange(1)).toEqual([0, 2]);
    expect(mostCommonA(18)).toBe(40);
  });
});

describe('Bohrs modell for hydrogen', () => {
  it('energinivåene E_n = −2,18 · 10⁻¹⁸ J/n² = −13,6 eV/n²', () => {
    expect(levelEnergyJ(1)).toBeCloseTo(-2.18e-18, 30);
    expect(levelEnergyEV(1)).toBeCloseTo(-13.6, 1);
    expect(levelEnergyEV(2)).toBeCloseTo(-3.41, 2);
    expect(levelEnergyEV(3)).toBeCloseTo(-1.51, 2);
    expect(levelEnergyJ(2) / levelEnergyJ(1)).toBeCloseTo(1 / 4, 12);
  });

  it('Hα (3 → 2) er rødt lys ved ca. 656 nm', () => {
    const p = transitionPhoton(3, 2);
    expect(p.E).toBeCloseTo(3.03e-19, 21);
    expect(p.eV).toBeCloseTo(1.89, 2);
    expect(p.f).toBeCloseTo(4.57e14, -12);
    expect(p.lambda * 1e9).toBeGreaterThan(655);
    expect(p.lambda * 1e9).toBeLessThan(658);
  });

  it('de fire synlige Balmer-linjene: 656, 486, 434 og 410 nm (innenfor 0,2 %)', () => {
    const want = [656.3, 486.1, 434.0, 410.2];
    want.forEach((nm, i) => {
      const got = transitionPhoton(i + 3, 2).lambda * 1e9;
      expect(Math.abs(got - nm) / nm).toBeLessThan(0.002);
    });
  });

  it('emisjon og absorpsjon mellom de samme nivåene gir samme foton', () => {
    expect(transitionPhoton(4, 2)).toEqual(transitionPhoton(2, 4));
  });

  it('energibevaring: E = hf = hc/λ = E_øvre − E_nedre', () => {
    for (const [a, b] of [
      [2, 1],
      [6, 5],
      [5, 3],
    ] as const) {
      const p = transitionPhoton(a, b);
      expect(p.E).toBeCloseTo(levelEnergyJ(a) - levelEnergyJ(b), 30);
      expect(6.63e-34 * p.f).toBeCloseTo(p.E, 30);
      expect(p.f * p.lambda).toBeCloseTo(3e8, 0);
    }
  });

  it('Lyman-α er ultrafiolett, Paschen er infrarødt', () => {
    expect(spectralRegion(transitionPhoton(2, 1).lambda * 1e9)).toBe('uv');
    expect(transitionPhoton(2, 1).lambda * 1e9).toBeCloseTo(121.6, 0);
    expect(spectralRegion(transitionPhoton(4, 3).lambda * 1e9)).toBe('ir');
    expect(spectralRegion(transitionPhoton(3, 2).lambda * 1e9)).toBe('synlig');
    // Ioniseringsgrensen for Lyman er ca. 91 nm
    expect(photonFromWavelength(91.2).eV).toBeCloseTo(13.6, 0);
  });

  it('energiene vises med tre gjeldende siffer', () => {
    expect(sigDecimals(levelEnergyEV(1))).toBe(1);
    expect(sigDecimals(levelEnergyEV(2))).toBe(2);
    expect(sigDecimals(levelEnergyEV(4))).toBe(3);
    expect(sigDecimals(0)).toBe(0);
  });

  it('seriene har navn etter nederste nivå', () => {
    expect(seriesName(1)).toBe('Lyman');
    expect(seriesName(2)).toBe('Balmer');
    expect(seriesName(3)).toBe('Paschen');
    expect(seriesName(5)).toBe('Pfund');
  });

  it('fotonenergien fra bølgelengden: 550 nm gir ca. 2,26 eV', () => {
    const p = photonFromWavelength(550);
    expect(p.eV).toBeCloseTo(2.26, 2);
    expect(p.f).toBeCloseTo(5.45e14, -12);
  });
});

describe('farger og spektre', () => {
  it('gir farge bare i det synlige området', () => {
    expect(wavelengthToRgb(300)).toBeNull();
    expect(wavelengthToRgb(800)).toBeNull();
    expect(wavelengthToRgb(Number.NaN)).toBeNull();
    expect(wavelengthColor(1000, 'x')).toBe('x');
  });

  it('656 nm er rødt, 486 nm blågrønt, 434 nm blåfiolett og 410 nm fiolett', () => {
    const red = wavelengthToRgb(656)!;
    expect(red[0]).toBeGreaterThan(200);
    expect(red[1]).toBeLessThan(40);
    const cyan = wavelengthToRgb(486)!;
    expect(cyan[2]).toBeGreaterThan(200);
    expect(cyan[1]).toBeGreaterThan(150);
    const blue = wavelengthToRgb(434)!;
    expect(blue[2]).toBeGreaterThan(200);
    expect(blue[0]).toBeLessThan(80);
    const violet = wavelengthToRgb(410)!;
    expect(violet[0]).toBeGreaterThan(80);
    expect(violet[2]).toBeGreaterThan(150);
    const yellow = wavelengthToRgb(589)!;
    expect(yellow[0]).toBe(255);
    expect(yellow[1]).toBeGreaterThan(180);
  });

  it('roundSig runder til gjeldende siffer', () => {
    expect(roundSig(7465.2, 3)).toBe(7470);
    expect(roundSig(656.93, 3)).toBe(657);
    expect(roundSig(93.78, 3)).toBeCloseTo(93.8, 10);
    expect(roundSig(0.16734, 3)).toBeCloseTo(0.167, 10);
    expect(roundSig(-2.4222e-19, 4)).toBeCloseTo(-2.422e-19, 30);
    expect(roundSig(0, 3)).toBe(0);
  });

  it('mellomregningene i formelboksen gir samme svar som den uavrundede utregningen, for alle overganger', () => {
    for (let upper = 2; upper <= 6; upper++)
      for (let lower = 1; lower < upper; lower++) {
        const s = photonSteps(upper, lower);
        const p = transitionPhoton(upper, lower);
        expect(s.nm).toBe(roundSig(p.lambda * 1e9, 3));
        expect(s.eV).toBe(roundSig(p.eV, 3));
        expect(roundSig(s.f, 3)).toBe(roundSig(p.f, 3));
        expect(roundSig(s.E, 3)).toBe(roundSig(p.E, 3));
        // Regner eleven videre med tallene som står, får hun det samme
        expect(roundSig(s.E / H_PLANCK, 4)).toBe(s.f);
        expect(roundSig(s.Eupper - s.Elower, 4)).toBe(s.E);
      }
    // Hα: 3,028 · 10⁻¹⁹ J, 4,567 · 10¹⁴ Hz, 657 nm
    const ha = photonSteps(3, 2);
    expect(ha.E).toBeCloseTo(3.028e-19, 30);
    expect(ha.f).toBeCloseTo(4.567e14, 0);
    expect(ha.nm).toBe(657);
    expect(photonSteps(6, 5).nm).toBe(7470);
  });

  it('Balmer-linjene har samme styrke som i hydrogenrøret, og bare Hα–Hδ er tydelige', () => {
    const lines = hydrogenVisibleLines();
    lines.forEach((l, i) => expect(l.I).toBe(BALMER_STRENGTH[i]));
    expect(lines[0]!.I / lines[1]!.I).toBeGreaterThan(2.5);
    expect(lines.filter((l) => !l.faint).map((l) => l.name)).toEqual(['Hα', 'Hβ', 'Hγ', 'Hδ']);
    for (const l of lines.filter((l) => l.faint)) expect(l.nm).toBeLessThan(400);
  });

  it('hydrogenlinjene fra Bohrs modell ligger i det synlige området og blir svakere', () => {
    const lines = hydrogenVisibleLines();
    expect(lines.length).toBeGreaterThanOrEqual(4);
    expect(lines[0]!.name).toBe('Hα');
    expect(lines.every((l) => l.name && l.name.startsWith('H'))).toBe(true);
    for (const l of lines) {
      expect(l.nm).toBeGreaterThanOrEqual(380);
      expect(l.nm).toBeLessThanOrEqual(750);
    }
    for (let i = 1; i < lines.length; i++) expect(lines[i]!.I).toBeLessThan(lines[i - 1]!.I);
  });

  it('absorpsjonslinjene i sollys passer med hydrogen og natrium, ikke med kvikksølv', () => {
    for (const h of hydrogenVisibleLines().slice(0, 4)) expect(nearestLine(sunLinesOf('hydrogen'), h.nm, 1.5)).not.toBeNull();
    for (const na of elementLines('natrium').filter((l) => l.I > 0.5))
      expect(nearestLine(sunLinesOf('natrium'), na.nm, 0.5)).not.toBeNull();
    expect(sunLinesOf('kvikksolv')).toEqual([]);
  });

  it('natriumets gule D-linjer heter D₂ (589,0 nm) og D₁ (589,6 nm)', () => {
    const d = elementLines('natrium').filter((l) => l.name?.startsWith('D'));
    expect(d.map((l) => [l.name, l.nm])).toEqual([
      ['D₂', 589.0],
      ['D₁', 589.6],
    ]);
    expect(colorName(589.3)).toBe('gul');
  });

  it('finner nærmeste og sterkeste linje', () => {
    const na = elementLines('natrium');
    expect(nearestLine(na, 589.4)?.nm).toBe(589.6);
    expect(nearestLine(na, 500, 1)).toBeNull();
    expect(strongestLine(na)?.nm).toBe(589.0);
    expect(strongestLine(elementLines('helium'))?.nm).toBe(587.6);
    expect(strongestLine([])).toBeUndefined();
  });
});

describe('fargenavn og etiketter', () => {
  it('gir norske fargenavn', () => {
    expect(colorName(400)).toBe('fiolett');
    expect(colorName(470)).toBe('blå');
    expect(colorName(530)).toBe('grønn');
    expect(colorName(580)).toBe('gul');
    expect(colorName(600)).toBe('oransje');
    expect(colorName(656)).toBe('rød');
    expect(colorName(300)).toBe('ultrafiolett');
    expect(colorName(900)).toBe('infrarødt');
  });

  it('Balmer-linjene får samme fargenavn overalt: rød, blågrønn, blåfiolett og fiolett', () => {
    const names = [3, 4, 5, 6].map((n) => colorName(transitionPhoton(n, 2).lambda * 1e9));
    expect(names).toEqual(['rød', 'blågrønn', 'blåfiolett', 'fiolett']);
    expect(colorName(589)).toBe('gul');
    expect(colorName(546)).toBe('grønn');
  });

  it('etiketter med høyest prioritet plasseres først', () => {
    // Den svake etiketten til venstre må vike for de to sterke, selv om den kommer først langs aksen
    const rows = placeLabels(
      [
        { x: 110, width: 30, priority: 0.3 },
        { x: 120, width: 30, priority: 1 },
        { x: 140, width: 30, priority: 0.9 },
      ],
      2,
    );
    expect(rows).toEqual([-1, 0, 1]);
    // Uten prioritet: i rekkefølge etter x
    expect(placeLabels([{ x: 140, width: 30 }, { x: 100, width: 30 }], 1)).toEqual([0, 0]);
  });

  it('plasserer etiketter i rader uten overlapp', () => {
    const rows = placeLabels(
      [
        { x: 100, width: 30 },
        { x: 110, width: 30 },
        { x: 120, width: 30 },
        { x: 300, width: 30 },
      ],
      2,
    );
    expect(rows).toEqual([0, 1, -1, 0]);
    expect(placeLabels([], 2)).toEqual([]);
  });
});
