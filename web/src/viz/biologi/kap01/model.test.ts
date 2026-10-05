import { describe, expect, it } from 'vitest';
import {
  ALL_CRITERIA,
  CANDIDATES,
  CRITERIA,
  DEFINITIONS,
  LEVELS,
  LEVEL_COUNT,
  candidate,
  failing,
  fmtLength,
  fullCount,
  italicSegments,
  level,
  levelAt,
  matchingDefinition,
  ordersOfMagnitude,
  plain,
  ratioToPrevious,
  scalePos,
  verdict,
  wrapText,
  type CandidateId,
  type Verdict,
} from './model';

/** Intl bruker hardt mellomrom som tusenskille; sammenlign med vanlige mellomrom. */
const len = (m: number) => fmtLength(m).replace(/\s/g, ' ');

describe('organisasjonsnivåene', () => {
  it('har elleve nivåer fra molekyl til biosfære i riktig rekkefølge', () => {
    expect(LEVEL_COUNT).toBe(11);
    expect(LEVELS.map((l) => l.id)).toEqual([
      'molekyl',
      'organell',
      'celle',
      'vev',
      'organ',
      'organsystem',
      'organisme',
      'populasjon',
      'samfunn',
      'okosystem',
      'biosfaere',
    ]);
  });

  it('DNA er ca. 2 nm bredt og jorda ca. 12 700 km', () => {
    expect(level('molekyl').human.size).toBeCloseTo(2e-9, 15);
    expect(len(level('molekyl').human.size)).toBe('2 nm');
    expect(len(level('biosfaere').forest.size)).toBe('12 700 km');
  });

  it('skogeksemplene blir aldri mindre oppover nivåene, og spenner over 16 tierpotenser', () => {
    for (let i = 1; i < LEVEL_COUNT; i++) expect(LEVELS[i]!.forest.size).toBeGreaterThanOrEqual(LEVELS[i - 1]!.forest.size);
    expect(ordersOfMagnitude(LEVELS[0]!.forest.size, LEVELS[LEVEL_COUNT - 1]!.forest.size)).toBeGreaterThan(15);
  });

  it('menneskekroppen: større opp til organismen, men tarmens økosystem er mindre enn mennesket', () => {
    const i = LEVELS.findIndex((l) => l.id === 'organisme');
    for (let k = 1; k <= i; k++) expect(LEVELS[k]!.human.size).toBeGreaterThanOrEqual(LEVELS[k - 1]!.human.size);
    expect(level('okosystem').human.size).toBeLessThan(level('organisme').human.size);
  });

  it('cellen er det laveste levende nivået, og de økologiske nivåene starter med populasjonen', () => {
    const firstLiving = LEVELS.findIndex((l) => l.living);
    expect(LEVELS[firstLiving]!.id).toBe('celle');
    expect(LEVELS.slice(firstLiving).every((l) => l.living)).toBe(true);
    expect(LEVELS.filter((l) => l.ecological).map((l) => l.id)).toEqual(['populasjon', 'samfunn', 'okosystem', 'biosfaere']);
  });

  it('levelAt begrenser indeksen og ratioToPrevious gir forholdet mellom nabonivåer', () => {
    expect(levelAt(-3).id).toBe('molekyl');
    expect(levelAt(99).id).toBe('biosfaere');
    expect(levelAt(2.4).id).toBe('celle');
    expect(ratioToPrevious(0, 'human')).toBeNull();
    expect(ratioToPrevious(2, 'human')).toBeCloseTo(50, 9); // 0,1 mm / 2 µm
    expect(ratioToPrevious(8, 'forest')).toBe(1);
  });
});

describe('lengder og skala', () => {
  it('velger enhet og desimaler', () => {
    expect(len(1.5e-9)).toBe('1,5 nm');
    expect(len(2e-6)).toBe('2 µm');
    expect(len(5e-5)).toBe('50 µm');
    expect(len(1e-4)).toBe('100 µm');
    expect(len(1e-3)).toBe('1 mm');
    expect(len(1e-2)).toBe('1 cm');
    expect(len(0.12)).toBe('12 cm');
    expect(len(1.7)).toBe('1,7 m');
    expect(len(25)).toBe('25 m');
    expect(len(1000)).toBe('1 km');
    expect(len(0)).toBe('–');
    expect(len(Number.NaN)).toBe('–');
  });

  it('scalePos er logaritmisk og holder seg mellom 0 og 1', () => {
    expect(scalePos(1e-9)).toBe(0);
    expect(scalePos(1e8)).toBe(1);
    expect(scalePos(1e-12)).toBe(0);
    expect(scalePos(1e12)).toBe(1);
    // Like store sprang for hver tierpotens
    expect(scalePos(1e-3) - scalePos(1e-4)).toBeCloseTo(scalePos(1e3) - scalePos(1e2), 12);
    for (const l of LEVELS) for (const x of [l.human.size, l.forest.size]) expect(scalePos(x)).toBeGreaterThan(0);
  });
});

describe('kjennetegn på liv', () => {
  it('alle kandidater har en vurdering og en begrunnelse for alle sju kjennetegnene', () => {
    expect(CRITERIA).toHaveLength(7);
    expect(CANDIDATES).toHaveLength(8);
    for (const c of CANDIDATES)
      for (const r of ALL_CRITERIA) {
        expect(c.marks[r].why.length).toBeGreaterThan(10);
        expect(['ja', 'delvis', 'hvile', 'nei']).toContain(c.marks[r].mark);
      }
  });

  it('med alle sju kjennetegnene: bakterie og gjær er levende, frø og tardigrad grensetilfeller, resten ikke levende', () => {
    const v = (id: CandidateId) => verdict(candidate(id), ALL_CRITERIA);
    const expected: Record<CandidateId, Verdict> = {
      bakterie: 'levende',
      gjaer: 'levende',
      fro: 'grense',
      tardigrad: 'grense',
      virus: 'ikke',
      prion: 'ikke',
      ild: 'ikke',
      krystall: 'ikke',
    };
    for (const c of CANDIDATES) expect(v(c.id), c.id).toBe(expected[c.id]);
    expect(fullCount(candidate('bakterie'))).toBe(7);
    expect(fullCount(candidate('prion'))).toBe(0);
  });

  it('ett kjennetegn alene er ikke nok: med bare vekst og formering blir ild og krystall grensetilfeller', () => {
    const def = DEFINITIONS.find((d) => d.id === 'vekst')!.criteria;
    expect(verdict(candidate('ild'), def)).toBe('grense');
    expect(verdict(candidate('krystall'), def)).toBe('grense');
    expect(verdict(candidate('bakterie'), def)).toBe('levende');
  });

  it('virus: grensetilfelle uten krav om celler, ikke levende med krav om stoffskifte', () => {
    expect(verdict(candidate('virus'), ['formering', 'arv'])).toBe('grense');
    expect(verdict(candidate('virus'), ['stoffskifte', 'arv'])).toBe('ikke');
    expect(verdict(candidate('virus'), ['arv'])).toBe('levende');
    expect(failing(candidate('virus'), ALL_CRITERIA, 'nei')).toEqual(['celler', 'stoffskifte', 'vekst', 'reagerer', 'homeostase']);
    expect(failing(candidate('virus'), ALL_CRITERIA, 'delvis')).toEqual(['formering']);
  });

  it('ingen kjennetegn valgt gir ingen dom, og alle levende i læreboka har arvestoff og celler', () => {
    for (const c of CANDIDATES) expect(verdict(c, [])).toBe('ingen');
    for (const c of CANDIDATES)
      if (verdict(c, ALL_CRITERIA) !== 'ikke') {
        expect(c.marks.celler.mark).toBe('ja');
        expect(c.marks.arv.mark).toBe('ja');
      }
  });

  it('forhåndsdefinerte definisjoner kjennes igjen uansett rekkefølge', () => {
    expect(matchingDefinition(ALL_CRITERIA)).toBe('alle');
    expect(matchingDefinition(['arv', 'stoffskifte'])).toBe('nasa');
    expect(matchingDefinition(['arv'])).toBeNull();
  });
});

describe('kursiv', () => {
  it('deler tekst med stjerner i kursive og vanlige biter, også over linjeskift', () => {
    expect(italicSegments('*E. coli* i tarmen').segments).toEqual([
      { text: 'E. coli', italic: true },
      { text: ' i tarmen', italic: false },
    ]);
    const first = italicSegments('arten *Escherichia');
    expect(first.endItalic).toBe(true);
    expect(italicSegments('coli* i tarmen', first.endItalic).segments[0]).toEqual({ text: 'coli', italic: true });
    expect(plain('*E. coli* i tarmen')).toBe('E. coli i tarmen');
  });
});

describe('tekstbryting', () => {
  it('bryter mellom ord og holder linjene innenfor grensen', () => {
    const lines = wrapText('Formerer seg bare inne i en levende vertscelle, ved å bruke cellens maskineri.', 24);
    for (const l of lines) expect(l.length).toBeLessThanOrEqual(24);
    expect(lines.join(' ')).toBe('Formerer seg bare inne i en levende vertscelle, ved å bruke cellens maskineri.');
    expect(wrapText('', 10)).toEqual([]);
    expect(wrapText('kort', 10)).toEqual(['kort']);
    expect(wrapText('Ryggstrengdyrene', 5)).toEqual(['Ryggstrengdyrene']);
  });
});
