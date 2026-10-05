import { describe, expect, it } from 'vitest';
import {
  ORGANISMS,
  PAIRS,
  QUESTIONS,
  RANKS,
  TREES,
  abbreviateSpecies,
  closer,
  depthOf,
  isClade,
  layoutTree,
  leaves,
  lowestSharedRankIndex,
  mrca,
  organism,
  type OrganismId,
  type TreeMode,
} from './model';

const shared = (a: OrganismId, b: OrganismId) => {
  const i = lowestSharedRankIndex(organism(a), organism(b));
  return i < 0 ? null : RANKS[i];
};

describe('klassifiseringen', () => {
  it('har 18 organismer med unike id-er og alle åtte nivåene', () => {
    expect(ORGANISMS).toHaveLength(18);
    expect(new Set(ORGANISMS.map((o) => o.id)).size).toBe(18);
    for (const o of ORGANISMS) for (const r of RANKS) expect(o.lineage[r].sci.length).toBeGreaterThan(0);
  });

  it('artsnavnet er slektsnavnet + et artsepitet, og slekta stemmer', () => {
    for (const o of ORGANISMS) {
      const [genus, epithet] = o.lineage.art.sci.split(' ');
      expect(genus).toBe(o.lineage.slekt.sci);
      expect(epithet).toMatch(/^[a-z]+$/);
      // Det vitenskapelige navnet starter med artsnavnet (hunden har i tillegg underarten familiaris)
      expect(o.sci.startsWith(o.lineage.art.sci)).toBe(true);
    }
  });

  it('kjente par har riktig laveste felles nivå', () => {
    expect(shared('hund', 'ulv')).toBe('art');
    expect(shared('menneske', 'sjimpanse')).toBe('familie');
    expect(shared('hund', 'katt')).toBe('orden');
    expect(shared('menneske', 'blahval')).toBe('klasse');
    expect(shared('laks', 'torsk')).toBe('klasse');
    expect(shared('blahval', 'laks')).toBe('rekke');
    expect(shared('krokodille', 'firfisle')).toBe('klasse');
    expect(shared('kongeorn', 'krokodille')).toBe('rekke');
    expect(shared('eik', 'gran')).toBe('rekke');
    expect(shared('fluesopp', 'bakegjaer')).toBe('rike');
    expect(shared('fluesopp', 'menneske')).toBe('domene');
    expect(shared('ecoli', 'arke')).toBeNull();
    expect(shared('menneske', 'menneske')).toBe('art');
  });

  it('nivåene er nestet: samme takson på et nivå betyr samme takson på alle nivåene over', () => {
    for (const a of ORGANISMS)
      for (const b of ORGANISMS)
        for (let i = 1; i < RANKS.length; i++)
          if (a.lineage[RANKS[i]!].sci === b.lineage[RANKS[i]!].sci)
            expect(a.lineage[RANKS[i - 1]!].sci).toBe(b.lineage[RANKS[i - 1]!].sci);
  });

  it('eksempelparene finnes og forkortede artsnavn', () => {
    for (const p of PAIRS) expect(() => [organism(p.a), organism(p.b)]).not.toThrow();
    expect(abbreviateSpecies('Methanobrevibacter smithii')).toBe('M. smithii');
    expect(abbreviateSpecies('Homo')).toBe('Homo');
  });
});

describe('slektskapstrærne', () => {
  const modes: TreeMode[] = ['utseende', 'anatomi', 'dna'];

  it('hvert tre har alle 18 organismene nøyaktig én gang', () => {
    for (const m of modes) {
      const l = leaves(TREES[m]);
      expect(l).toHaveLength(18);
      expect(new Set(l)).toEqual(new Set(ORGANISMS.map((o) => o.id)));
    }
  });

  it('DNA-treet stemmer med klassifiseringen: alle taksa er klader, bortsett fra krypdyr uten fugler', () => {
    const tree = TREES.dna;
    for (const r of RANKS) {
      const groups = new Map<string, OrganismId[]>();
      for (const o of ORGANISMS) groups.set(o.lineage[r].sci + r, [...(groups.get(o.lineage[r].sci + r) ?? []), o.id]);
      for (const [key, g] of groups) {
        if (key === 'Reptiliaklasse') expect(isClade(tree, g)).toBe(false);
        else expect(isClade(tree, g), key).toBe(true);
      }
    }
    // Med fuglene er krypdyrene en ekte gruppe
    expect(isClade(tree, ['krokodille', 'firfisle', 'kongeorn'])).toBe(true);
  });

  it('de klassiske spørsmålene får ulike svar med ulike kriterier', () => {
    const answer = (m: TreeMode, id: string) => {
      const q = QUESTIONS.find((x) => x.id === id)!;
      return closer(TREES[m], q.x, q.y, q.z);
    };
    // Hvalen: fisk etter utseende, pattedyr etter anatomi og DNA
    expect(answer('utseende', 'hval')).toBe('y');
    expect(answer('anatomi', 'hval')).toBe('z');
    expect(answer('dna', 'hval')).toBe('z');
    // Fugler: en egen klasse (uavklart slektskap) etter anatomi, nær krokodiller etter DNA
    expect(answer('anatomi', 'fugl')).toBe('lik');
    expect(answer('dna', 'fugl')).toBe('y');
    // Sopp: plante etter utseende, uavklart etter anatomi, nærmere dyr etter DNA
    expect(answer('utseende', 'sopp')).toBe('y');
    expect(answer('anatomi', 'sopp')).toBe('lik');
    expect(answer('dna', 'sopp')).toBe('z');
    // Arker: sammen med bakteriene uten DNA, nærmere eukaryotene med DNA
    expect(answer('anatomi', 'arke')).toBe('y');
    expect(answer('dna', 'arke')).toBe('z');
  });

  it('hvalen er nærmere i slekt med hunden enn med mennesket i DNA-treet', () => {
    expect(closer(TREES.dna, 'blahval', 'hund', 'menneske')).toBe('y');
    expect(closer(TREES.anatomi, 'blahval', 'hund', 'menneske')).toBe('lik');
  });

  it('nærmeste felles stamform og dybde', () => {
    const t = TREES.dna;
    expect(mrca(t, 'menneske', 'sjimpanse')).toMatchObject({ name: 'Primater' });
    expect(mrca(t, 'ecoli', 'menneske')).toBe(t);
    expect(depthOf(t, t)).toBe(0);
    expect(depthOf(t, mrca(t, 'hund', 'ulv'))).toBeGreaterThan(depthOf(t, mrca(t, 'hund', 'katt')));
  });

  it('plasseringen: én rad per blad, indre knutepunkt mellom barna', () => {
    for (const m of modes) {
      const { nodes, rows, maxDepth } = layoutTree(TREES[m]);
      expect(rows).toBe(18);
      expect(maxDepth).toBeGreaterThan(1);
      for (const n of nodes) {
        if (n.children.length) {
          expect(n.row).toBeGreaterThanOrEqual(n.children[0]!.row);
          expect(n.row).toBeLessThanOrEqual(n.children.at(-1)!.row);
        }
        if (n.parent) expect(n.depth).toBe(n.parent.depth + 1);
      }
    }
  });
});

describe('myke bindestreker', () => {
  it('deler lange sammensatte ord, men lar korte ord være', async () => {
    const { softHyphens } = await import('./model');
    expect(softHyphens('Ryggstrengdyr')).toBe('Rygg\u00ADstreng\u00ADdyr');
    expect(softHyphens('Strålefinnefisker')).toBe('Stråle\u00ADfinne\u00ADfisker');
    expect(softHyphens('Sopper og dyr')).toBe('Sopper og dyr');
  });
});
