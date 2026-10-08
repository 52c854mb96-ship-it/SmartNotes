import { describe, expect, it } from 'vitest';
import {
  DEPTH_MAX,
  DEPTH_MIN,
  ELEMENTS,
  ELEMENT_ORDER,
  MATCH_TOL,
  RANGE,
  STARS,
  STAR_ORDER,
  analyse,
  atomAngles,
  balmer,
  continuum,
  defaultLineIndex,
  hasLineAt,
  intensity,
  labLines,
  peakWavelength,
  photon,
  presentElements,
  spectrumCurve,
  starLines,
  type ElementId,
} from './model-stjernespekter';

describe('linjene i laboratoriet', () => {
  it('ligger innenfor figuren og er sortert', () => {
    for (const id of ELEMENT_ORDER) {
      const ll = labLines(id);
      expect(ll.length).toBeGreaterThan(0);
      ll.forEach((l, i) => {
        expect(l.nm).toBeGreaterThanOrEqual(RANGE[0]);
        expect(l.nm).toBeLessThanOrEqual(RANGE[1]);
        expect(l.I).toBeGreaterThan(0);
        expect(l.I).toBeLessThanOrEqual(1);
        if (i > 0) expect(l.nm).toBeGreaterThan(ll[i - 1]!.nm);
      });
    }
  });

  it('to grunnstoffer har aldri linjer så tett at de kan forveksles', () => {
    const all = ELEMENT_ORDER.flatMap((id) => ELEMENTS[id].lines.map((l) => ({ id, nm: l.nm })));
    for (const a of all)
      for (const b of all) {
        if (a.id === b.id) continue;
        expect(Math.abs(a.nm - b.nm)).toBeGreaterThan(2 * MATCH_TOL);
      }
  });

  it('heliums gule linje er skilt fra natriums D-linjer', () => {
    expect(hasLineAt(labLines('Na'), 587.56)).toBe(false);
    expect(hasLineAt(labLines('Na'), 589.0)).toBe(true);
  });

  it('hydrogenlinjene stemmer med Bohrs modell (innenfor 0,2 %)', () => {
    for (const l of ELEMENTS.H.lines) {
      const b = balmer(l.n!);
      expect(Math.abs(b.nm - l.nm) / l.nm).toBeLessThan(0.002);
      // Energien fra λ og fra nivåene er den samme med tre gjeldende siffer
      expect(photon(l.nm).E).toBeCloseTo(b.E, 21);
    }
    // Hα: E₃ − E₂ = 2,18 · 10⁻¹⁸ J · (1/4 − 1/9) = 3,03 · 10⁻¹⁹ J
    expect(balmer(3).E).toBeCloseTo(3.028e-19, 21);
    expect(balmer(3).nm).toBeCloseTo(656.9, 0);
  });
});

describe('fotonet i en linje', () => {
  it('natriums gule linje: f = c/λ og E = hf', () => {
    const p = photon(589.0);
    expect(p.f).toBeCloseTo(5.093e14, -11);
    expect(p.E).toBeCloseTo(3.377e-19, 21);
    expect(p.eV).toBeCloseTo(2.11, 2);
  });

  it('Hβ har 2,56 eV, og kortere bølgelengde gir mer energi', () => {
    expect(photon(486.13).eV).toBeCloseTo(2.557, 2);
    expect(photon(410.17).eV).toBeGreaterThan(photon(656.28).eV);
  });
});

describe('stjernene', () => {
  it('alle stjernene har hydrogen, og linjene ligger i figuren', () => {
    for (const s of STAR_ORDER) {
      expect(presentElements(s)).toContain('H');
      const lines = starLines(s);
      lines.forEach((l, i) => {
        expect(l.nm).toBeGreaterThanOrEqual(RANGE[0]);
        expect(l.nm).toBeLessThanOrEqual(RANGE[1]);
        expect(l.depth).toBeGreaterThanOrEqual(DEPTH_MIN);
        expect(l.depth).toBeLessThanOrEqual(DEPTH_MAX);
        expect(l.sigma).toBeGreaterThan(0);
        if (i > 0) expect(l.nm).toBeGreaterThanOrEqual(lines[i - 1]!.nm);
      });
    }
  });

  it('fasiten passer med temperaturen: helium bare i den varmeste, metaller i de kjølige', () => {
    expect(presentElements('bellatrix')).toEqual(['H', 'He']);
    expect(presentElements('vega')).toEqual(['H', 'Ca']);
    expect(presentElements('capella')).toEqual(['H', 'Na', 'Ca', 'Fe']);
    expect(presentElements('arcturus')).toEqual(['H', 'Na', 'Ca', 'Fe']);
    // Hydrogenlinjene er sterkest i Vega (ca. 10 000 K) og svakest i den kjøligste stjernen
    const hb = (s: (typeof STAR_ORDER)[number]) => starLines(s).find((l) => l.lab.n === 4)!;
    expect(hb('vega').depth).toBeGreaterThan(hb('bellatrix').depth);
    expect(hb('vega').depth).toBeGreaterThan(hb('capella').depth);
    expect(hb('capella').depth).toBeGreaterThan(hb('arcturus').depth);
    expect(hb('vega').sigma).toBeGreaterThan(hb('arcturus').sigma);
    const temps = STAR_ORDER.map((s) => STARS[s].T);
    expect([...temps].sort((a, b) => b - a)).toEqual(temps);
  });

  it('standardlinja er Hβ', () => {
    for (const s of STAR_ORDER) {
      const lines = starLines(s);
      expect(lines[defaultLineIndex(lines)]!.nm).toBeCloseTo(486.13, 2);
    }
  });
});

describe('sammenligningen', () => {
  it('med fasiten slått på er alle linjene forklart', () => {
    for (const s of STAR_ORDER) {
      const a = analyse(s, presentElements(s));
      expect(a.explained).toBe(a.total);
      expect(a.solved).toBe(true);
      expect(a.wrong).toEqual([]);
      expect(a.found).toEqual(presentElements(s));
      for (const id of presentElements(s)) expect(a.elements[id].missing).toEqual([]);
    }
  });

  it('grunnstoffer som ikke er i stjernen, treffer ingen linjer', () => {
    for (const s of STAR_ORDER) {
      const absent = ELEMENT_ORDER.filter((id) => !presentElements(s).includes(id));
      const a = analyse(s, ELEMENT_ORDER);
      for (const id of absent) {
        expect(a.elements[id].verdict).toBe('passer-ikke');
        expect(a.elements[id].hits).toBe(0);
        expect(a.elements[id].missing.length).toBe(a.elements[id].total);
      }
      // Alle fem på: alt er forklart, men ikke løst, fordi noen grunnstoffer ikke passer
      expect(a.explained).toBe(a.total);
      expect(a.solved).toBe(false);
      expect(a.wrong).toEqual(absent);
    }
  });

  it('uten grunnstoffer er ingen linjer forklart', () => {
    const a = analyse('capella', []);
    expect(a.explained).toBe(0);
    expect(a.found).toEqual([]);
    expect(a.solved).toBe(false);
    for (const id of ELEMENT_ORDER) expect(a.elements[id].verdict).toBe('av');
  });

  it('delvis riktig: hydrogen alene i Capella forklarer de fire Balmer-linjene', () => {
    const a = analyse('capella', ['H']);
    expect(a.explained).toBe(4);
    expect(a.found).toEqual(['H']);
    expect(a.solved).toBe(false);
    expect(a.lines.filter((l) => l.explainedBy === 'H').map((l) => l.line.lab.name)).toEqual(['Hδ', 'Hγ', 'Hβ', 'Hα']);
  });

  it('teller linjer og treff riktig for alle kombinasjoner', () => {
    for (const s of STAR_ORDER) {
      for (let mask = 0; mask < 32; mask++) {
        const on = ELEMENT_ORDER.filter((_, i) => mask & (1 << i)) as ElementId[];
        const a = analyse(s, on);
        const expected = starLines(s).filter((l) => on.includes(l.element)).length;
        expect(a.explained).toBe(expected);
        expect(a.solved).toBe(on.length === presentElements(s).length && presentElements(s).every((id) => on.includes(id)));
      }
    }
  });
});

describe('det kontinuerlige spekteret', () => {
  it('Wiens lov: sola (5 800 K) lyser sterkest ved ca. 500 nm', () => {
    expect(peakWavelength(5800)).toBeCloseTo(500, -1);
    expect(peakWavelength(5800) * 5800 * 1e-9).toBeCloseTo(2.9e-3, 4);
  });

  it('er normert til 1 og har riktig helning: blå stjerne mest blått, oransje stjerne mest rødt', () => {
    for (const s of STAR_ORDER) {
      const T = STARS[s].T;
      let max = 0;
      for (let nm = RANGE[0]; nm <= RANGE[1]; nm += 1) {
        const c = continuum(nm, T);
        expect(Number.isFinite(c)).toBe(true);
        expect(c).toBeLessThanOrEqual(1 + 1e-9);
        max = Math.max(max, c);
      }
      expect(max).toBeGreaterThan(0.999);
    }
    expect(continuum(400, STARS.bellatrix.T)).toBeGreaterThan(continuum(650, STARS.bellatrix.T));
    expect(continuum(400, STARS.arcturus.T)).toBeLessThan(continuum(650, STARS.arcturus.T));
  });

  it('linjene er mørkere enn omgivelsene, men ikke svarte', () => {
    for (const s of STAR_ORDER) {
      const lines = starLines(s);
      for (const l of lines) {
        const inLine = intensity(s, l.nm, lines);
        const c = continuum(l.nm, STARS[s].T);
        expect(inLine).toBeLessThan(c * (1 - 0.9 * l.depth) + 1e-9);
        expect(inLine).toBeGreaterThan(0);
      }
    }
  });

  it('grafen har bare endelige verdier mellom 0 og 1', () => {
    for (const s of STAR_ORDER) {
      const pts = spectrumCurve(s, 0.5);
      expect(pts[0]![0]).toBe(RANGE[0]);
      expect(pts[pts.length - 1]![0]).toBeCloseTo(RANGE[1], 6);
      for (const [, y] of pts) {
        expect(Number.isFinite(y)).toBe(true);
        expect(y).toBeGreaterThan(0);
        expect(y).toBeLessThanOrEqual(1 + 1e-9);
      }
    }
  });
});

describe('atomene i atmosfæren', () => {
  it('atomet som tar opp linja, står på strålen, og ingen står på samme sted', () => {
    for (let n = 1; n <= 5; n++)
      for (let k = 0; k < n; k++) {
        const a = atomAngles(n, k);
        expect(a.length).toBe(n);
        expect(a[k]).toBe(0);
        expect(new Set(a).size).toBe(n);
      }
  });
});

describe('tekstene', () => {
  it('gir lesbar tekst for alle stjerner og alle kombinasjoner av grunnstoffer', async () => {
    const { progressText, darkLineText, temperatureText, labMatchText, listNames } = await import('./stjernespekter-tekst');
    expect(listNames(['H'])).toBe('hydrogen');
    expect(listNames(['H', 'Ca'])).toBe('hydrogen og kalsium');
    expect(listNames(['H', 'Na', 'Fe'])).toBe('hydrogen, natrium og jern');
    for (const s of STAR_ORDER) {
      for (let mask = 0; mask < 32; mask++) {
        const on = ELEMENT_ORDER.filter((_, i) => mask & (1 << i)) as ElementId[];
        const a = analyse(s, on);
        const texts = [progressText(s, a, on), temperatureText(s, a)];
        for (const st of a.lines) texts.push(darkLineText(st.line, st.explainedBy), labMatchText(st.line, st.explainedBy, on));
        for (const t of texts) {
          expect(t.length).toBeGreaterThan(20);
          expect(t).not.toMatch(/NaN|undefined|Infinity|null/);
        }
        if (a.solved) expect(progressText(s, a, on)).toContain('Alle de');
      }
    }
  });

  it('avslører ikke grunnstoffet bak en linje som ikke er forklart', async () => {
    const { darkLineText } = await import('./stjernespekter-tekst');
    const line = starLines('capella').find((l) => l.element === 'Fe')!;
    expect(darkLineText(line, null)).not.toMatch(/\bjern\b/); // («stjernen» inneholder «jern»)
    expect(darkLineText(line, 'Fe')).toMatch(/\bjern\b/);
  });
});
