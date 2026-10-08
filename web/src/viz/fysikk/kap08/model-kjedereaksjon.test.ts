import { describe, expect, it } from 'vitest';
import {
  CAPTURE_PCT,
  CHANNELS,
  NU,
  NUCLIDES,
  PRESETS,
  REACTOR_THERMAL_W,
  TREE_GENERATIONS,
  buildChainTree,
  captureForK,
  expectedFissions,
  fissionCounts,
  fissionEnergy,
  fissionTime,
  fissionsPerSecond,
  graphMax,
  niceCeil,
  generationAt,
  generationsToDoubleOrHalve,
  layoutChainTree,
  multiplicationFactor,
  neutronProgress,
  presetFor,
  regime,
  seededRandom,
  spreadPositions,
  treeEnergyMeV,
  u235KgPerDay,
  type ChainTree,
} from './model-kjedereaksjon';

const allPcts = (): number[] => {
  const out: number[] = [];
  for (let p = CAPTURE_PCT.min; p <= CAPTURE_PCT.max; p += CAPTURE_PCT.step) out.push(p);
  return out;
};

describe('fisjonsenergi', () => {
  it('bevarer nukleontall og ladning i begge spaltingene', () => {
    for (const ch of Object.values(CHANNELS)) {
      const e = fissionEnergy(ch);
      expect(e.A[0]).toBe(236);
      expect(e.A[1]).toBe(236);
      expect(e.Z[0]).toBe(92);
      expect(e.Z[1]).toBe(92);
    }
  });

  it('gir kjente verdier: ca. 174 MeV for Ba-141 + Kr-92 + 3n og ca. 185 MeV for Xe-140 + Sr-94 + 2n', () => {
    const ba = fissionEnergy(CHANNELS['ba-kr']);
    expect(ba.dm).toBeCloseTo(0.186, 3);
    expect(ba.EJ).toBeCloseTo(2.78e-11, 13);
    expect(ba.EMeV).toBeGreaterThan(170);
    expect(ba.EMeV).toBeLessThan(178);
    const xe = fissionEnergy(CHANNELS['xe-sr']);
    expect(xe.dm).toBeCloseTo(0.1983, 3);
    expect(xe.EMeV).toBeGreaterThan(180);
    expect(xe.EMeV).toBeLessThan(190);
    // Massen etter er mindre enn før: energien kommer fra massetapet.
    expect(ba.mAfter).toBeLessThan(ba.mBefore);
  });

  it('bruker samme nøytronmasse på begge sider', () => {
    const e = fissionEnergy(CHANNELS['ba-kr']);
    expect(e.mBefore).toBeCloseTo(NUCLIDES.U235.mass + NUCLIDES.n.mass, 9);
  });
});

describe('formeringsfaktoren k', () => {
  it('er ν · (1 − f)', () => {
    expect(multiplicationFactor(0.6)).toBeCloseTo(1, 12);
    expect(multiplicationFactor(0.4)).toBeCloseTo(1.5, 12);
    expect(multiplicationFactor(0.8)).toBeCloseTo(0.5, 12);
    expect(multiplicationFactor(0)).toBe(NU);
    expect(multiplicationFactor(1)).toBe(0);
    expect(multiplicationFactor(Number.NaN)).toBe(NU);
  });

  it('captureForK er den omvendte', () => {
    for (const k of [0.5, 0.7, 1, 1.3, 1.5]) expect(multiplicationFactor(captureForK(k))).toBeCloseTo(k, 12);
  });

  it('forhåndsvalgene gir k = 0,70, 1,00 og 1,30 og finnes igjen fra andelen', () => {
    const ks = PRESETS.map((p) => multiplicationFactor(p.capturePct / 100));
    expect(ks[0]).toBeCloseTo(0.7, 12);
    expect(ks[1]).toBeCloseTo(1, 12);
    expect(ks[2]).toBeCloseTo(1.3, 12);
    for (const p of PRESETS) expect(presetFor(p.capturePct)).toBe(p.id);
    expect(presetFor(55)).toBeNull();
    expect(regime(ks[0]!)).toBe('dor-ut');
    expect(regime(ks[1]!)).toBe('jevn');
    expect(regime(ks[2]!)).toBe('vokser');
  });

  it('startverdien på glidebryteren er jevn drift', () => {
    expect(regime(multiplicationFactor(CAPTURE_PCT.initial / 100))).toBe('jevn');
  });

  it('N₀ · kᵍ og doblings- og halveringstid i generasjoner', () => {
    expect(expectedFissions(1.5, 10)).toBeCloseTo(57.665, 2);
    expect(expectedFissions(1, 10)).toBe(1);
    expect(expectedFissions(0.5, 3, 100)).toBeCloseTo(12.5, 12);
    expect(generationsToDoubleOrHalve(2)).toBeCloseTo(1, 12);
    expect(generationsToDoubleOrHalve(0.5)).toBeCloseTo(1, 12);
    expect(generationsToDoubleOrHalve(1)).toBe(Number.POSITIVE_INFINITY);
  });
});

describe('antall fisjoner per generasjon', () => {
  it('følger kᵍ avrundet', () => {
    expect(fissionCounts(1)).toEqual([1, 1, 1, 1, 1, 1]);
    expect(fissionCounts(1.5)).toEqual([1, 2, 2, 3, 5, 8]);
    expect(fissionCounts(0.7)).toEqual([1, 1, 0, 0, 0, 0]);
    expect(fissionCounts(1.3)).toEqual([1, 1, 2, 2, 3, 4]);
  });

  it('dør aldri ut og starter aldri igjen, og høyst dobles per generasjon, for alle k på glidebryteren', () => {
    for (const p of allPcts()) {
      const k = multiplicationFactor(p / 100);
      const c = fissionCounts(k);
      expect(c).toHaveLength(TREE_GENERATIONS + 1);
      for (let g = 1; g < c.length; g++) {
        expect(c[g]).toBeLessThanOrEqual(2 * c[g - 1]!);
        if (c[g - 1] === 0) expect(c[g]).toBe(0);
        if (k >= 1) expect(c[g]).toBeGreaterThanOrEqual(c[g - 1]!);
        else expect(c[g]).toBeLessThanOrEqual(c[g - 1]!);
      }
    }
  });
});

describe('kjedetreet', () => {
  const check = (tree: ChainTree) => {
    // Nøytronregnskapet: hvert nøytron fra generasjon g spalter en kjerne, fanges eller fortsetter.
    for (const s of tree.stats) {
      expect(s.emitted).toBeGreaterThanOrEqual(2 * s.fissions);
      expect(s.emitted).toBeLessThanOrEqual(3 * s.fissions);
      if (s.gen < tree.generations) expect(s.captured + s.onward).toBe(s.emitted);
      else expect(s.captured + s.onward).toBe(0);
    }
    expect(tree.stats.map((s) => s.fissions)).toEqual(tree.counts);
    for (const f of tree.fissions) {
      const ch = CHANNELS[f.channel];
      expect(f.out).toHaveLength(ch.neutrons);
      expect(tree.neutrons[f.by]!.target).toBe(f.id);
      expect(tree.neutrons[f.by]!.fate).toBe('fisjon');
    }
    for (const a of tree.absorbers) {
      const n = tree.neutrons[a.neutron]!;
      expect(n.fate).toBe('fanget');
      expect(n.target).toBe(a.id);
      expect(n.gen).toBe(a.gen);
    }
    // Alle nøytronene (utenom startnøytronet) kommer fra en fisjon.
    expect(tree.neutrons.length - 1).toBe(tree.fissions.reduce((s, f) => s + f.out.length, 0));
  };

  it('stemmer for alle k på glidebryteren og flere frø', () => {
    for (const p of allPcts()) for (const seed of [1, 2, 3, 17]) check(buildChainTree(multiplicationFactor(p / 100), seed));
  });

  it('er likt for samme frø og ulikt for et annet', () => {
    const a = buildChainTree(1.3, 5);
    const b = buildChainTree(1.3, 5);
    expect(a).toEqual(b);
    const differs = [6, 7, 8, 9, 10].some((s) => {
      const c = buildChainTree(1.3, s);
      return JSON.stringify(c.neutrons.map((n) => n.fate)) !== JSON.stringify(a.neutrons.map((n) => n.fate));
    });
    expect(differs).toBe(true);
  });

  it('gir i gjennomsnitt ca. 2,5 nøytroner per fisjon', () => {
    let fis = 0;
    let neu = 0;
    for (let seed = 1; seed <= 200; seed++) {
      const t = buildChainTree(1.5, seed);
      for (const s of t.stats) {
        fis += s.fissions;
        neu += s.emitted;
      }
    }
    expect(neu / fis).toBeGreaterThan(2.4);
    expect(neu / fis).toBeLessThan(2.6);
  });

  it('andelen som fanges, nærmer seg 1 − k/ν', () => {
    let captured = 0;
    let emitted = 0;
    for (let seed = 1; seed <= 100; seed++) {
      const t = buildChainTree(1, seed);
      for (const s of t.stats.slice(0, -1)) {
        captured += s.captured;
        emitted += s.emitted;
      }
    }
    expect(captured / emitted).toBeGreaterThan(0.55);
    expect(captured / emitted).toBeLessThan(0.65);
  });

  it('energien i treet er summen av fisjonene', () => {
    const t = buildChainTree(1, 3);
    const e = treeEnergyMeV(t);
    expect(e).toBeGreaterThan(6 * 170);
    expect(e).toBeLessThan(6 * 190);
  });

  it('tallgeneratoren er deterministisk og mellom 0 og 1', () => {
    const r1 = seededRandom(42);
    const r2 = seededRandom(42);
    for (let i = 0; i < 50; i++) {
      const v = r1();
      expect(v).toBe(r2());
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
});

describe('kjernekraftverket', () => {
  it('3 000 MW krever ca. 10²⁰ fisjoner i sekundet og noen få kilo U-235 i døgnet', () => {
    const E = fissionEnergy(CHANNELS['ba-kr']).EJ;
    expect(fissionsPerSecond(REACTOR_THERMAL_W, E)).toBeCloseTo(1.08e20, -18);
    const kg = u235KgPerDay(REACTOR_THERMAL_W, E);
    expect(kg).toBeGreaterThan(3);
    expect(kg).toBeLessThan(4);
  });
});

describe('plassering', () => {
  it('spreadPositions holder avstand, grenser og rekkefølge', () => {
    const ys = spreadPositions([100, 101, 102, 300], 20, 0, 400);
    expect(ys[1]! - ys[0]!).toBeGreaterThanOrEqual(20 - 1e-9);
    expect(ys[2]! - ys[1]!).toBeGreaterThanOrEqual(20 - 1e-9);
    expect(ys[3]).toBe(300);
    // Klyngen sentreres rundt gjennomsnittet.
    expect((ys[0]! + ys[2]!) / 2).toBeCloseTo(101, 9);
    // Mot kanten.
    const edge = spreadPositions([0, 0, 0], 10, 5, 100);
    expect(edge).toEqual([5, 15, 25]);
    // For mange: jevnt fordelt.
    const many = spreadPositions([50, 50, 50, 50, 50], 40, 0, 100);
    expect(many).toEqual([0, 25, 50, 75, 100]);
    // Rekkefølgen i inndata beholdes.
    const rev = spreadPositions([300, 100], 20, 0, 400);
    expect(rev).toEqual([300, 100]);
    expect(spreadPositions([], 10, 0, 1)).toEqual([]);
  });

  const box = { x: 300, y: 40, w: 480, h: 360 };
  const opts = { R: 11, rA: 6 };

  it('alt ligger inne i utsnittet, og kjernene i samme generasjon overlapper ikke', () => {
    for (const p of allPcts()) {
      for (const seed of [1, 2, 3]) {
        const tree = buildChainTree(multiplicationFactor(p / 100), seed);
        const L = layoutChainTree(tree, box, opts);
        for (const pt of [...L.fissions, ...L.absorbers]) {
          expect(Number.isFinite(pt.x) && Number.isFinite(pt.y)).toBe(true);
          expect(pt.x).toBeGreaterThanOrEqual(box.x);
          expect(pt.x).toBeLessThanOrEqual(box.x + box.w);
          expect(pt.y).toBeGreaterThanOrEqual(box.y);
          expect(pt.y).toBeLessThanOrEqual(box.y + box.h);
        }
        for (const ids of tree.byGen) {
          const ys = ids.map((id) => L.fissions[id]!.y).sort((a, b) => a - b);
          for (let i = 1; i < ys.length; i++) expect(ys[i]! - ys[i - 1]!).toBeGreaterThanOrEqual(2 * opts.R);
        }
        for (let g = 0; g < tree.generations; g++) {
          const ys = tree.absorbers
            .filter((a) => a.gen === g)
            .map((a) => L.absorbers[a.id]!.y)
            .sort((a, b) => a - b);
          for (let i = 1; i < ys.length; i++) expect(ys[i]! - ys[i - 1]!).toBeGreaterThanOrEqual(2 * opts.rA);
        }
        for (const n of L.neutrons) {
          expect(n.arrive).toBeGreaterThan(n.depart);
          expect(n.arrive).toBeLessThanOrEqual(L.tMax + 1e-9);
          expect(n.to.x).toBeLessThanOrEqual(box.x + box.w);
        }
      }
    }
  });

  it('nøytronet som spalter en kjerne, kommer fram akkurat når kjernen spaltes', () => {
    const tree = buildChainTree(1.3, 4);
    const L = layoutChainTree(tree, box, opts);
    for (const f of tree.fissions) {
      const path = L.neutrons[f.by]!;
      expect(path.arrive).toBeCloseTo(fissionTime(f.gen), 12);
      expect(path.to).toEqual(L.fissions[f.id]);
    }
  });

  it('en jevn kjede (k = 1) går rett fram', () => {
    const tree = buildChainTree(1, 2);
    const L = layoutChainTree(tree, box, opts);
    const ys = tree.byGen.map((ids) => L.fissions[ids[0]!]!.y);
    for (const y of ys) expect(y).toBeCloseTo(box.y + box.h / 2, 9);
  });

  it('framdrift og generasjon ved tida t', () => {
    const path = { from: { x: 0, y: 0 }, to: { x: 1, y: 0 }, depart: 1, arrive: 2 };
    expect(neutronProgress(path, 0.5)).toBe(0);
    expect(neutronProgress(path, 1.5)).toBeCloseTo(0.5, 12);
    expect(neutronProgress(path, 3)).toBe(1);
    expect(generationAt(0)).toBe(-1);
    expect(generationAt(fissionTime(0))).toBe(0);
    expect(generationAt(fissionTime(3) + 0.5)).toBe(3);
    expect(generationAt(100)).toBe(TREE_GENERATIONS);
  });
});

describe('grafen', () => {
  it('niceCeil og graphMax', () => {
    expect(niceCeil(1)).toBe(1);
    expect(niceCeil(1.2)).toBe(1.5);
    expect(niceCeil(57.7)).toBe(60);
    expect(niceCeil(13.8)).toBe(15);
    expect(niceCeil(0)).toBe(1);
    expect(graphMax(1.5, [1, 2, 2, 3, 5, 8])).toBe(60);
    expect(graphMax(1, [1, 1, 1, 1, 1, 1])).toBe(2);
    expect(graphMax(0.5, [1, 1, 0, 0, 0, 0])).toBe(2);
    for (const p of [40, 50, 60, 70, 80]) {
      const k = multiplicationFactor(p / 100);
      const m = graphMax(k, fissionCounts(k));
      expect(m).toBeGreaterThanOrEqual(expectedFissions(k, 10));
      expect(Number.isFinite(m)).toBe(true);
    }
  });
});
