import { describe, expect, it } from 'vitest';
import { checkBalance, formula, molarMass, parseReaction } from '../kit/formel';
import {
  ISOMER_SETS,
  NAME_EXAMPLES,
  ORG_REACTIONS,
  SERIES,
  SUB_KINDS,
  bondChanges,
  buildNamed,
  carbonBonds,
  equationText,
  generalFormula,
  highlightedBonds,
  iupacName,
  naiveName,
  seriesMember,
  seriesSpec,
  stateAt25,
  verdict,
  type NameInput,
  type SubKind,
} from './model';
import {
  atomTally,
  bounds,
  collisions,
  condensed,
  customMolecule,
  freeDirections,
  functionalGroups,
  hydrogenCount,
  molFormula,
  molecule,
  subscriptDigits,
  VALENCE,
  type Mol,
} from './struktur';

/** Navnet (eller «ugyldig») for et molekyl satt sammen i byggesettet. */
function nameOf(length: number, subs: [SubKind, number][] = [], double: number | null = null, oh: number | null = null): string {
  const input: NameInput = { length, subs: subs.map(([kind, pos]) => ({ kind, pos })), double, oh };
  const b = buildNamed(input);
  if (!b.valid) return 'ugyldig';
  return iupacName(b.mol)?.name ?? 'ukjent';
}

/** Alle tunge atomer har full valens (summen av bindingsordenene). */
function valenceOk(mol: Mol): boolean {
  return mol.atoms.every((a, i) => {
    const sum = mol.bonds.filter((b) => b.a === i || b.b === i).reduce((s, b) => s + b.order, 0);
    return sum === VALENCE[a.el];
  });
}

describe('struktur: retninger for nye bindinger', () => {
  it('rett kjede gir H opp og ned, kjedeende gir kors', () => {
    expect(freeDirections([0, 180], 2).sort((a, b) => a - b)).toEqual([90, 270]);
    expect(freeDirections([0], 3).sort((a, b) => a - b)).toEqual([90, 180, 270]);
  });
  it('dobbeltbundet C med én binding får 120° mellom H-ene', () => {
    expect(freeDirections([0], 2).sort((a, b) => a - b)).toEqual([120, 240]);
  });
  it('metan uten bindinger får fire H', () => {
    expect(freeDirections([], 4)).toHaveLength(4);
  });
});

describe('struktur: molekyler', () => {
  it('molekylformel og forenklet formel', () => {
    expect(molFormula(molecule({ chain: ['C', 'C', 'C'] }))).toBe('C3H8');
    expect(condensed(molecule({ chain: ['C', 'C', 'C'] }))).toBe('CH3–CH2–CH3');
    expect(condensed(molecule({ chain: ['C', 'C', 'C'], branches: [{ at: 1, side: 'up', atoms: ['O'] }] }))).toBe('CH3–CH(OH)–CH3');
    expect(condensed(molecule({ chain: ['C', 'C', 'C'], branches: [{ at: 1, side: 'up', atoms: ['C'] }, { at: 1, side: 'down', atoms: ['C'] }] }))).toBe(
      'CH3–C(CH3)2–CH3',
    );
    expect(condensed(molecule(seriesSpec('karboksylsyrer', 2)))).toBe('CH3–COOH');
    expect(condensed(molecule(seriesSpec('karboksylsyrer', 1)))).toBe('HCOOH');
    expect(condensed(molecule(seriesSpec('alkener', 2)))).toBe('CH2=CH2');
    expect(condensed(molecule(seriesSpec('alkyner', 2)))).toBe('CH≡CH');
    expect(condensed(molecule({ chain: ['C', 'C', 'O', 'C', 'C'], branches: [{ at: 1, side: 'up', atoms: ['O'], orders: [2] }] }))).toBe('CH3–COO–CH2–CH3');
    expect(condensed(molecule({ chain: ['H', 'O', 'C', 'C'] }))).toBe('HO–CH2–CH3');
    expect(condensed(molecule({ chain: ['C', 'C', 'C'], branches: [{ at: 1, side: 'up', atoms: ['Cl'] }] }))).toBe('CH3–CHCl–CH3');
    expect(subscriptDigits('CH3–CH2–OH')).toBe('CH₃–CH₂–OH');
  });

  it('alle atomer får full valens (H fylles på)', () => {
    for (const s of SERIES) for (const m of s.members) expect(valenceOk(molecule(seriesSpec(s.id, m.n)))).toBe(true);
    for (const set of ISOMER_SETS) for (const i of set.isomers) expect(valenceOk(i.build())).toBe(true);
  });

  it('ingen atomer overlapper, heller ikke med grener på naboatomer', () => {
    const crowded = molecule({
      chain: ['C', 'C', 'C', 'C', 'C'],
      branches: [
        { at: 1, side: 'up', atoms: ['C', 'C'] },
        { at: 2, side: 'up', atoms: ['C'] },
        { at: 3, side: 'up', atoms: ['C', 'C'] },
      ],
    });
    expect(collisions(crowded)).toEqual([]);
    for (const set of ISOMER_SETS) for (const i of set.isomers) expect(collisions(i.build())).toEqual([]);
  });

  it('skjelettformelen har plass til alle tunge atomer og ingen H', () => {
    const m = molecule({ chain: ['C', 'C', 'C', 'C'], branches: [{ at: 1, side: 'up', atoms: ['C'] }] });
    expect(m.atoms.filter((a) => a.z).length).toBe(5);
    expect(m.atoms.filter((a) => a.el === 'H' && a.z).length).toBe(0);
    const b = bounds(m, 'skjelett');
    expect(b.maxX - b.minX).toBeGreaterThan(2);
  });

  it('cis/trans-but-2-en: samme formel, ulik form', () => {
    const set = ISOMER_SETS.find((s) => s.id === 'C4H8')!;
    const cis = set.isomers.find((i) => i.id === 'cis-but-2-en')!.build();
    const trans = set.isomers.find((i) => i.id === 'trans-but-2-en')!.build();
    expect(molFormula(cis)).toBe('C4H8');
    expect(molFormula(trans)).toBe('C4H8');
    // CH3-gruppene på samme side (cis) eller hver sin side (trans) av dobbeltbindingen
    expect(Math.sign(cis.atoms[0]!.p.y)).toBe(Math.sign(cis.atoms[3]!.p.y));
    expect(Math.sign(trans.atoms[0]!.p.y)).toBe(-Math.sign(trans.atoms[3]!.p.y));
  });

  it('funksjonelle grupper', () => {
    const kinds = (m: Mol) => functionalGroups(m).map((g) => g.kind);
    expect(kinds(molecule(seriesSpec('alkoholer', 2)))).toEqual(['hydroksyl']);
    expect(kinds(molecule(seriesSpec('karboksylsyrer', 2)))).toEqual(['karboksyl']);
    expect(kinds(molecule(seriesSpec('alkener', 3)))).toEqual(['dobbeltbinding']);
    expect(kinds(molecule(seriesSpec('alkyner', 3)))).toEqual(['trippelbinding']);
    expect(kinds(molecule({ chain: ['C', 'O', 'C'] }))).toEqual(['eter']);
    expect(kinds(molecule(seriesSpec('alkaner', 5)))).toEqual([]);
  });

  it('vann er vinklet og har to H', () => {
    const w = ORG_REACTIONS.find((r) => r.id === 'elim')!.products[1]!.build();
    expect(molFormula(w)).toBe('H2O');
    expect(hydrogenCount(w, 0)).toBe(2);
    expect(customMolecule({ atoms: [{ el: 'O', p: [0, 0] }], bonds: [] }).atoms).toHaveLength(3);
  });
});

describe('homologe rekker', () => {
  it('molekylformelen fra strukturen stemmer med den generelle formelen', () => {
    for (const s of SERIES) for (const m of s.members) expect(molFormula(molecule(seriesSpec(s.id, m.n)))).toBe(generalFormula(s.id, m.n));
  });

  it('kjente formler og molare masser', () => {
    expect(generalFormula('alkaner', 8)).toBe('C8H18');
    expect(generalFormula('alkener', 2)).toBe('C2H4');
    expect(generalFormula('alkyner', 2)).toBe('C2H2');
    expect(generalFormula('alkoholer', 2)).toBe('C2H6O');
    expect(generalFormula('karboksylsyrer', 2)).toBe('C2H4O2');
    expect(molarMass('C2H6O')).toBeCloseTo(46.07, 2);
    expect(molarMass('C2H4O2')).toBeCloseTo(60.05, 2);
  });

  it('navnene i tabellen er de samme som navngiveren gir', () => {
    for (const s of SERIES) {
      if (s.id === 'karboksylsyrer') continue;
      for (const m of s.members) expect(iupacName(molecule(seriesSpec(s.id, m.n)))?.name).toBe(m.name);
    }
  });

  it('kokepunktet stiger med kjedelengden i hver rekke', () => {
    for (const s of SERIES) for (let i = 1; i < s.members.length; i++) expect(s.members[i]!.bp).toBeGreaterThan(s.members[i - 1]!.bp);
  });

  it('hydrogenbindinger: alkoholer og syrer koker mye høyere enn alkanen med like mange C', () => {
    for (let n = 1; n <= 8; n++) {
      const alkan = seriesMember('alkaner', n).bp;
      expect(seriesMember('alkoholer', n).bp - alkan).toBeGreaterThan(60);
      expect(seriesMember('karboksylsyrer', n).bp).toBeGreaterThan(seriesMember('alkoholer', n).bp);
    }
    // Forskjellen alkohol − alkan blir mindre når kjeden blir lengre
    expect(seriesMember('alkoholer', 1).bp - seriesMember('alkaner', 1).bp).toBeGreaterThan(seriesMember('alkoholer', 8).bp - seriesMember('alkaner', 8).bp);
  });

  it('lærebokverdier', () => {
    expect(seriesMember('alkaner', 1).bp).toBeCloseTo(-161.5, 1);
    expect(seriesMember('alkoholer', 2).bp).toBeCloseTo(78.3, 1);
    expect(seriesMember('karboksylsyrer', 2).bp).toBeCloseTo(117.9, 1);
    expect(seriesMember('alkyner', 2).sublimes).toBe(true);
    expect(stateAt25(seriesMember('alkaner', 4).bp)).toBe('gass');
    expect(stateAt25(seriesMember('alkaner', 5).bp)).toBe('væske');
  });
});

describe('navnsetting: lærebokeksempler', () => {
  it('eksemplene i oppgaven', () => {
    expect(nameOf(4, [['metyl', 2]])).toBe('2-metylbutan');
    expect(nameOf(3, [['metyl', 2], ['metyl', 2]])).toBe('2,2-dimetylpropan');
    expect(nameOf(4, [], 2)).toBe('but-2-en');
    expect(nameOf(3, [], null, 2)).toBe('propan-2-ol');
    expect(nameOf(3, [['klor', 2], ['metyl', 2]])).toBe('2-klor-2-metylpropan');
  });

  it('alkaner, enkle', () => {
    expect(nameOf(1)).toBe('metan');
    expect(nameOf(2)).toBe('etan');
    expect(nameOf(8)).toBe('oktan');
    expect(nameOf(5, [['metyl', 2], ['metyl', 3]])).toBe('2,3-dimetylpentan');
    expect(nameOf(5, [['metyl', 2], ['metyl', 2], ['metyl', 3]])).toBe('2,2,3-trimetylpentan');
    expect(nameOf(5, [['etyl', 3], ['metyl', 2]])).toBe('3-etyl-2-metylpentan');
    expect(nameOf(6, [['etyl', 3], ['etyl', 4]])).toBe('3,4-dietylheksan');
  });

  it('laveste nummer: nummerer fra den enden som gir lavest tall', () => {
    expect(nameOf(4, [['metyl', 3]])).toBe('2-metylbutan');
    expect(nameOf(5, [['metyl', 3], ['metyl', 4]])).toBe('2,3-dimetylpentan');
    expect(nameOf(6, [['metyl', 2], ['metyl', 5], ['metyl', 5]])).toBe('2,2,5-trimetylheksan');
    expect(nameOf(4, [], 3)).toBe('but-1-en');
    expect(nameOf(5, [], null, 4)).toBe('pentan-2-ol');
  });

  it('alfabetisk rekkefølge (brom, etyl, klor, metyl) og di-/tri- teller ikke', () => {
    expect(nameOf(6, [['brom', 2], ['klor', 5]])).toBe('2-brom-5-klorheksan');
    expect(nameOf(6, [['brom', 5], ['klor', 2]])).toBe('2-brom-5-klorheksan');
    expect(nameOf(5, [['metyl', 2], ['metyl', 2], ['etyl', 3]])).toBe('3-etyl-2,2-dimetylpentan');
    expect(nameOf(4, [['klor', 2], ['klor', 3], ['brom', 2]])).toBe('2-brom-2,3-diklorbutan');
  });

  it('halogenerte metaner og etaner uten unødvendige tall', () => {
    expect(nameOf(1, [['klor', 1]])).toBe('klormetan');
    expect(nameOf(1, [['klor', 1], ['klor', 1]])).toBe('diklormetan');
    expect(nameOf(1, [['klor', 1], ['klor', 1], ['klor', 1]])).toBe('triklormetan');
    expect(nameOf(1, [['brom', 1], ['klor', 1]])).toBe('bromklormetan');
    expect(nameOf(2, [['klor', 1]])).toBe('kloretan');
    expect(nameOf(2, [['klor', 1], ['klor', 2]])).toBe('1,2-dikloretan');
    expect(nameOf(2, [['klor', 1], ['klor', 1]])).toBe('1,1-dikloretan');
  });

  it('alkener', () => {
    expect(nameOf(2, [], 1)).toBe('eten');
    expect(nameOf(3, [], 1)).toBe('propen');
    expect(nameOf(3, [], 2)).toBe('propen');
    expect(nameOf(3, [['metyl', 2]], 1)).toBe('2-metylpropen');
    expect(nameOf(2, [['klor', 1]], 1)).toBe('kloreten');
    expect(nameOf(5, [], 2)).toBe('pent-2-en');
    expect(nameOf(5, [], 3)).toBe('pent-2-en');
    expect(nameOf(5, [['metyl', 2]], 2)).toBe('2-metylpent-2-en');
    expect(nameOf(5, [['metyl', 4]], 2)).toBe('4-metylpent-2-en');
  });

  it('dobbeltbindingen får lavere nummer enn substituentene', () => {
    // CH2=CH–CH2–CH(CH3)–CH3: dobbeltbindingen bestemmer retningen
    expect(nameOf(5, [['metyl', 4]], 1)).toBe('4-metylpent-1-en');
    expect(nameOf(5, [['metyl', 2]], 4)).toBe('4-metylpent-1-en');
  });

  it('alkoholer', () => {
    expect(nameOf(1, [], null, 1)).toBe('metanol');
    expect(nameOf(2, [], null, 2)).toBe('etanol');
    expect(nameOf(3, [], null, 1)).toBe('propan-1-ol');
    expect(nameOf(3, [], null, 3)).toBe('propan-1-ol');
    expect(nameOf(4, [['metyl', 2]], null, 2)).toBe('2-metylbutan-2-ol');
    expect(nameOf(4, [['metyl', 3]], null, 2)).toBe('3-metylbutan-2-ol');
    expect(nameOf(4, [['metyl', 2]], null, 4)).toBe('3-metylbutan-1-ol');
    expect(nameOf(2, [['klor', 2]], null, 1)).toBe('2-kloretan-1-ol');
  });

  it('OH-gruppa bestemmer nummereringen foran dobbeltbindingen', () => {
    expect(nameOf(4, [], 3, 2)).toBe('but-3-en-2-ol');
    expect(nameOf(3, [], 1, 3)).toBe('prop-2-en-1-ol');
  });

  it('hovedkjeden må inneholde dobbeltbindingen og OH-gruppa (skolebøkenes regel)', () => {
    expect(nameOf(4, [['etyl', 2]], 1)).toBe('2-etylbut-1-en');
    expect(nameOf(4, [['etyl', 2]], null, 1)).toBe('2-etylbutan-1-ol');
  });
});

describe('navnsetting: feil kjede', () => {
  it('metyl på enden forlenger kjeden', () => {
    expect(nameOf(4, [['metyl', 1]])).toBe('pentan');
    expect(nameOf(1, [['metyl', 1]])).toBe('etan');
    expect(nameOf(3, [['metyl', 3]])).toBe('butan');
  });
  it('etyl på C2 forlenger kjeden', () => {
    expect(nameOf(4, [['etyl', 2]])).toBe('3-metylpentan');
    expect(nameOf(3, [['etyl', 2]])).toBe('2-metylbutan');
    expect(nameOf(8, [['etyl', 1], ['etyl', 8]])).toBe('dodekan');
  });
  it('flest substituenter når to kjeder er like lange', () => {
    expect(nameOf(6, [['etyl', 3], ['metyl', 2]])).toBe('3-etyl-2-metylheksan');
    expect(nameOf(3, [['klor', 1], ['etyl', 2]])).toBe('1-klor-2-metylbutan');
  });
});

describe('navnsetting: ugyldige valg', () => {
  it('for mange bindinger på ett C', () => {
    expect(nameOf(3, [['metyl', 2], ['metyl', 2], ['klor', 2]])).toBe('ugyldig');
    expect(nameOf(4, [['metyl', 2], ['metyl', 2]], 2)).toBe('ugyldig');
    const b = buildNamed({ length: 3, subs: [{ kind: 'metyl', pos: 2 }, { kind: 'metyl', pos: 2 }], double: null, oh: 2 });
    expect(b.errors).toEqual([{ kind: 'valens', carbon: 2, bonds: 5 }]);
  });
  it('plass utenfor kjeden', () => {
    const b = buildNamed({ length: 3, subs: [{ kind: 'metyl', pos: 5 }], double: null, oh: null });
    expect(b.valid).toBe(false);
    expect(b.errors[0]).toEqual({ kind: 'posisjon', what: 'metyl', pos: 5, length: 3 });
    expect(buildNamed({ length: 3, subs: [], double: 3, oh: null }).errors[0]?.kind).toBe('dobbeltbinding');
    expect(buildNamed({ length: 3, subs: [], double: null, oh: 4 }).errors[0]?.kind).toBe('posisjon');
  });
  it('carbonBonds teller kjede, dobbeltbinding, grener og OH', () => {
    expect(carbonBonds({ length: 4, subs: [{ kind: 'metyl', pos: 2 }], double: 2, oh: null }, 2)).toBe(4);
    expect(carbonBonds({ length: 1, subs: [], double: null, oh: 1 }, 1)).toBe(1);
  });
});

describe('navnsetting: dom over elevens forslag', () => {
  const judge = (input: NameInput) => {
    const b = buildNamed(input);
    return verdict(b, input, iupacName(b.mol)!);
  };
  it('riktig, lengre kjede, nummerering', () => {
    expect(judge({ length: 4, subs: [{ kind: 'metyl', pos: 2 }], double: null, oh: null })).toEqual({ kind: 'riktig' });
    expect(judge({ length: 4, subs: [{ kind: 'metyl', pos: 1 }], double: null, oh: null })).toEqual({ kind: 'lengre-kjede', length: 5 });
    expect(judge({ length: 4, subs: [{ kind: 'metyl', pos: 3 }], double: null, oh: null })).toEqual({ kind: 'nummerering', rule: 'substituenter' });
    expect(judge({ length: 6, subs: [{ kind: 'brom', pos: 5 }, { kind: 'klor', pos: 2 }], double: null, oh: null })).toEqual({ kind: 'nummerering', rule: 'alfabetisk' });
    expect(judge({ length: 3, subs: [], double: 1, oh: 3 })).toEqual({ kind: 'nummerering', rule: 'oh' });
    expect(judge({ length: 4, subs: [], double: 3, oh: null })).toEqual({ kind: 'nummerering', rule: 'dobbeltbinding' });
  });
  it('elevens eget navn med nummerering fra venstre', () => {
    const input: NameInput = { length: 4, subs: [{ kind: 'etyl', pos: 2 }], double: null, oh: null };
    expect(naiveName(buildNamed(input), input)).toBe('2-etylbutan');
  });
  it('alle eksemplene kan bygges, og feil-eksemplene er feil', () => {
    for (const e of NAME_EXAMPLES) {
      const b = buildNamed(e.input);
      expect(b.valid).toBe(true);
      const v = verdict(b, e.input, iupacName(b.mol)!);
      expect(v.kind === 'riktig').toBe(!e.id.startsWith('feil'));
    }
  });
});

describe('navnsetting: egenskaper for alle kombinasjoner', () => {
  const combos: NameInput[] = [];
  for (let L = 1; L <= 8; L++)
    for (const k1 of SUB_KINDS)
      for (let p1 = 1; p1 <= L; p1++)
        for (const k2 of [null, ...SUB_KINDS])
          for (let p2 = 1; p2 <= (k2 ? L : 1); p2++)
            combos.push({ length: L, subs: k2 ? [{ kind: k1, pos: p1 }, { kind: k2, pos: p2 }] : [{ kind: k1, pos: p1 }], double: null, oh: null });

  it('speilvendt molekyl (tall fra den andre enden) får samme navn', () => {
    for (const c of combos) {
      const mirror: NameInput = { ...c, subs: c.subs.map((s) => ({ ...s, pos: c.length + 1 - s.pos })) };
      const a = buildNamed(c);
      const b = buildNamed(mirror);
      expect(a.valid).toBe(b.valid);
      if (a.valid) expect(iupacName(b.mol)!.name).toBe(iupacName(a.mol)!.name);
    }
  });

  it('alkaner får aldri «1-metyl», «1-etyl» eller «2-etyl» (da er kjeden for kort)', () => {
    for (const c of combos) {
      if (c.subs.some((s) => s.kind === 'klor' || s.kind === 'brom')) continue;
      const b = buildNamed(c);
      if (!b.valid) continue;
      const name = iupacName(b.mol)!.name;
      expect(name).not.toMatch(/(^|[-,])1-(di|tri)?(metyl|etyl)|(^|-)2-(di)?etyl|,2-(di)?etyl/);
    }
  });

  it('hovedkjeden er minst like lang som elevens kjede, og atomene stemmer', () => {
    for (const c of combos) {
      const b = buildNamed(c);
      if (!b.valid) continue;
      const r = iupacName(b.mol)!;
      if (c.subs.every((s) => s.kind === 'klor' || s.kind === 'brom')) expect(r.chain.length).toBe(c.length);
      expect(r.chain.length).toBeGreaterThanOrEqual(c.length);
      const tally = atomTally(b.mol);
      expect(tally.C).toBe(c.length + c.subs.reduce((s, x) => s + (x.kind === 'metyl' ? 1 : x.kind === 'etyl' ? 2 : 0), 0));
    }
  });
});

describe('isomeri', () => {
  it('alle isomerene i et sett har samme molekylformel, men ulike navn', () => {
    for (const set of ISOMER_SETS) {
      const names = new Set<string>();
      for (const i of set.isomers) {
        expect(molFormula(i.build())).toBe(set.formula);
        names.add(i.name);
      }
      expect(names.size).toBe(set.isomers.length);
    }
  });
  it('navngiveren gir samme navn som tabellen (der den kan)', () => {
    for (const set of ISOMER_SETS)
      for (const i of set.isomers) {
        const r = iupacName(i.build());
        if (r && !i.name.startsWith('cis') && !i.name.startsWith('trans')) expect(r.name).toBe(i.name);
      }
  });
  it('forgreining senker kokepunktet for alkanene', () => {
    for (const id of ['C4H10', 'C5H12', 'C6H14']) {
      const set = ISOMER_SETS.find((s) => s.id === id)!;
      const straight = set.isomers[0]!;
      for (const i of set.isomers.slice(1)) expect(i.bp).toBeLessThan(straight.bp);
    }
    const c5 = ISOMER_SETS.find((s) => s.id === 'C5H12')!.isomers;
    expect(c5.map((i) => i.bp)).toEqual([...c5.map((i) => i.bp)].sort((a, b) => b - a));
  });
  it('alkoholen koker høyere enn eteren (hydrogenbindinger)', () => {
    const c2 = ISOMER_SETS.find((s) => s.id === 'C2H6O')!.isomers;
    expect(c2[0]!.bp - c2[1]!.bp).toBeGreaterThan(100);
  });
  it('cis-but-2-en (polar) koker høyere enn trans-but-2-en', () => {
    const c4 = ISOMER_SETS.find((s) => s.id === 'C4H8')!.isomers;
    expect(c4.find((i) => i.id === 'cis-but-2-en')!.bp).toBeGreaterThan(c4.find((i) => i.id === 'trans-but-2-en')!.bp);
  });
});

describe('organiske reaksjoner', () => {
  it('likningene er balanserte', () => {
    for (const r of ORG_REACTIONS) {
      const p = parseReaction(equationText(r));
      expect(p.ok).toBe(true);
      if (p.ok) expect(checkBalance(p.reaction).balanced).toBe(true);
    }
  });
  it('strukturene har formelen i likningen, og atomene er bevart', () => {
    for (const r of ORG_REACTIONS) {
      const count = (list: typeof r.reactants) => {
        const t: Record<string, number> = {};
        for (const s of list) {
          const mol = s.build();
          expect(atomTally(mol)).toEqual({ ...formula(s.formula).atoms });
          expect(molarMass(molFormula(mol))).toBeCloseTo(molarMass(s.formula), 6);
          for (const [el, n] of Object.entries(atomTally(mol))) t[el] = (t[el] ?? 0) + n * s.coef;
        }
        return t;
      };
      expect(count(r.reactants)).toEqual(count(r.products));
    }
  });
  it('alle bindingene som brytes eller dannes finnes i strukturene', () => {
    for (const r of ORG_REACTIONS)
      for (const s of [...r.reactants, ...r.products]) {
        if (!s.bonds || s.bonds === 'alle') continue;
        const mol = s.build();
        expect(highlightedBonds(s, mol)).toHaveLength(s.bonds.length);
      }
  });
  it('addisjon: dobbeltbinding åpnes, to nye bindinger; substitusjon: én brytes og én dannes per molekyl', () => {
    expect(bondChanges(ORG_REACTIONS.find((r) => r.id === 'add-br2')!)).toEqual({ broken: 2, formed: 2 });
    expect(bondChanges(ORG_REACTIONS.find((r) => r.id === 'sub-cl2')!)).toEqual({ broken: 2, formed: 2 });
    expect(bondChanges(ORG_REACTIONS.find((r) => r.id === 'elim')!)).toEqual({ broken: 2, formed: 2 });
    expect(bondChanges(ORG_REACTIONS.find((r) => r.id === 'ester')!)).toEqual({ broken: 2, formed: 2 });
    // Forbrenning av metan: 4 C–H + 2 · (O=O) brytes = 4 + 2 · 2; 2 C=O (= 4) + 2 · 2 O–H dannes
    expect(bondChanges(ORG_REACTIONS.find((r) => r.id === 'forbr-metan')!)).toEqual({ broken: 8, formed: 8 });
  });
  it('addisjon gir ett produkt, eliminasjon gir to', () => {
    for (const r of ORG_REACTIONS) {
      if (r.type === 'addisjon') expect(r.products).toHaveLength(1);
      if (r.type === 'eliminasjon') expect(r.reactants).toHaveLength(1);
      if (r.type === 'kondensasjon') expect(r.products.some((p) => p.formula === 'H2O')).toBe(true);
      if (r.type === 'forbrenning') expect(r.products.map((p) => p.formula).sort()).toEqual(['CO2', 'H2O']);
    }
  });
});
