import { describe, expect, it } from 'vitest';
import {
  CAPACITY,
  CHANGE_START,
  CYCLE_DAYS,
  GENERATIONS,
  GRADUAL_GENERATIONS,
  OVULATION_DAY,
  PLOIDY,
  SEX_VARIANCE,
  START_TEMP,
  TRAIT_CLASSES,
  asexualOffspring,
  bleeding,
  discreteNormal,
  endometrium,
  environmentAt,
  extinctionGeneration,
  feedbackAt,
  fuse,
  generationsToCapacity,
  hcgLevel,
  hormonesAt,
  lastDay,
  minimumAfterChange,
  ovaryAt,
  peakDay,
  phaseAt,
  phaseBands,
  ploidyText,
  regulate,
  sexualOffspring,
  sharedWithMother,
  simulateReproduction,
  specimens,
  survival,
  traitQuantile,
  traitStats,
  wellAdaptedLambda,
  type CycleScenario,
} from './model';

const sum = (a: readonly number[]) => a.reduce((x, y) => x + y, 0);

describe('kjønnet og ukjønnet formering: byggesteinene', () => {
  it('miljøet: likt før endringen, brått eller gradvis etterpå', () => {
    expect(environmentAt(0, 5, 'bra')).toBe(START_TEMP);
    expect(environmentAt(CHANGE_START - 1, 5, 'bra')).toBe(START_TEMP);
    expect(environmentAt(CHANGE_START, 5, 'bra')).toBe(START_TEMP + 5);
    expect(environmentAt(CHANGE_START, 5, 'gradvis')).toBe(START_TEMP);
    expect(environmentAt(CHANGE_START + GRADUAL_GENERATIONS / 2, 5, 'gradvis')).toBeCloseTo(START_TEMP + 2.5, 9);
    expect(environmentAt(GENERATIONS, 5, 'gradvis')).toBe(START_TEMP + 5);
  });

  it('overlevelsen er størst ved riktig temperatur og symmetrisk', () => {
    expect(survival(15, 15)).toBe(1);
    expect(survival(13, 15)).toBeCloseTo(survival(17, 15), 12);
    expect(survival(20, 15)).toBeLessThan(survival(17, 15));
  });

  it('kjønnet formering bevarer variasjonen (V₀) og gjennomsnittet uten seleksjon', () => {
    let p = discreteNormal(START_TEMP, SEX_VARIANCE);
    for (let g = 0; g < 40; g++) p = sexualOffspring(p);
    const { mean, sd } = traitStats(p);
    expect(sum(p)).toBeCloseTo(1, 9);
    expect(mean).toBeCloseTo(START_TEMP, 6);
    expect(sd ** 2).toBeGreaterThan(SEX_VARIANCE * 0.95);
    expect(sd ** 2).toBeLessThan(SEX_VARIANCE * 1.05);
    // Selv om alle foreldrene er like, får avkommet variasjon (segregasjon), men bare halve V₀
    const clone = new Array<number>(TRAIT_CLASSES).fill(0);
    clone[18] = 1;
    expect(traitStats(sexualOffspring(clone)).sd ** 2).toBeCloseTo(SEX_VARIANCE / 2, 1);
  });

  it('ukjønnet formering gir kloner', () => {
    const clone = new Array<number>(TRAIT_CLASSES).fill(0);
    clone[18] = 1;
    expect(asexualOffspring(clone)).toEqual(clone);
  });

  it('Beverton–Holt: en godt tilpasset bestand ligger på K, en dårlig tilpasset blir mindre', () => {
    expect(regulate(CAPACITY, 4, 4)).toBeCloseTo(CAPACITY, 9);
    const lmax = wellAdaptedLambda('kjonnet');
    expect(lmax).toBeCloseTo(2 * Math.sqrt(6.25 / 7.69), 9);
    expect(regulate(CAPACITY, lmax, lmax)).toBeCloseTo(CAPACITY, 9);
    expect(regulate(100, 2, 2)).toBeGreaterThan(100);
    expect(regulate(100, 2, 2)).toBeLessThan(200);
    // λ = 1,5 av 4 mulige: likevekten er K · (λ − 1)/(λ_maks − 1)
    let N = CAPACITY;
    for (let i = 0; i < 200; i++) N = regulate(N, 1.5, 4);
    expect(N).toBeCloseTo((CAPACITY * 0.5) / 3, 3);
    expect(regulate(CAPACITY, 0.5, 4)).toBeLessThan(CAPACITY / 2);
    expect(regulate(0, 3, 4)).toBe(0);
  });
});

describe('kjønnet og ukjønnet formering: bestandene', () => {
  it('stabilt miljø: begge når bæreevnen, den ukjønnede mye raskere', () => {
    const run = simulateReproduction(0, 'bra');
    const a = generationsToCapacity(run.asex);
    const s = generationsToCapacity(run.sex);
    expect(a).not.toBeNull();
    expect(s).not.toBeNull();
    expect(a!).toBeLessThan(s!);
    expect(a!).toBeLessThanOrEqual(5);
    expect(run.asex[GENERATIONS]!.N).toBeCloseTo(CAPACITY, 0);
    expect(run.sex[GENERATIONS]!.N).toBeGreaterThan(0.99 * CAPACITY);
    // Variasjonen har en pris: lavere gjennomsnittlig overlevelse i stabilt miljø
    expect(run.sex[20]!.wbar).toBeLessThan(run.asex[20]!.wbar);
    expect(run.asex[20]!.sd).toBeLessThan(0.2);
    expect(run.sex[20]!.sd).toBeGreaterThan(1);
  });

  it('brå endring på 5 °C: klonene dør ut, den kjønnede bestanden tilpasser seg', () => {
    const run = simulateReproduction(5, 'bra');
    expect(extinctionGeneration(run.asex)).not.toBeNull();
    expect(extinctionGeneration(run.asex)!).toBeLessThan(CHANGE_START + 10);
    expect(extinctionGeneration(run.sex)).toBeNull();
    const end = run.sex[GENERATIONS]!;
    expect(end.N).toBeGreaterThan(0.9 * CAPACITY);
    expect(end.mean).toBeGreaterThan(START_TEMP + 4);
    // Den kjønnede bestanden fikk en kraftig nedgang før den tok seg opp igjen
    expect(minimumAfterChange(run.sex)).toBeLessThan(0.5 * CAPACITY);
  });

  it('liten endring (2 °C): begge overlever, men klonene blir varig færre', () => {
    const run = simulateReproduction(2, 'bra');
    expect(extinctionGeneration(run.asex)).toBeNull();
    expect(extinctionGeneration(run.sex)).toBeNull();
    expect(run.asex[GENERATIONS]!.N).toBeLessThan(0.8 * CAPACITY);
    expect(run.sex[GENERATIONS]!.N).toBeGreaterThan(0.99 * CAPACITY);
    // Klonene kan ikke endre seg: gjennomsnittet er det samme som før
    expect(run.asex[GENERATIONS]!.mean).toBeCloseTo(START_TEMP, 9);
  });

  it('gradvis endring på 8 °C: klonene dør ut, den kjønnede bestanden følger med', () => {
    const run = simulateReproduction(8, 'gradvis');
    expect(extinctionGeneration(run.asex)).not.toBeNull();
    expect(extinctionGeneration(run.sex)).toBeNull();
    expect(run.sex[GENERATIONS]!.mean).toBeGreaterThan(START_TEMP + 7);
  });

  it('brå endring på 8 °C er for mye for begge', () => {
    const run = simulateReproduction(8, 'bra');
    expect(extinctionGeneration(run.asex)).not.toBeNull();
    expect(extinctionGeneration(run.sex)).not.toBeNull();
  });

  it('bestandene er aldri negative eller over K, og fordelingene summerer til N', () => {
    for (const dT of [0, 3, 4.5, 6, 8])
      for (const kind of ['bra', 'gradvis'] as const) {
        const run = simulateReproduction(dT, kind);
        for (const st of [...run.asex, ...run.sex]) {
          expect(st.N).toBeGreaterThanOrEqual(0);
          expect(st.N).toBeLessThanOrEqual(CAPACITY + 1e-6);
          expect(sum(st.n)).toBeCloseTo(st.N, 6);
          expect(Number.isFinite(st.wbar)).toBe(true);
          expect(Number.isFinite(st.lambda)).toBe(true);
        }
      }
  });

  it('individene i figuren: kvantiler og faste plasser', () => {
    const p = discreteNormal(START_TEMP, SEX_VARIANCE);
    expect(traitQuantile(p, 0.5)).toBeCloseTo(START_TEMP, 0);
    expect(traitQuantile(p, 0.1)).toBeLessThan(traitQuantile(p, 0.9));
    expect(Number.isNaN(traitQuantile(new Array(TRAIT_CLASSES).fill(0), 0.5))).toBe(true);
    const sp = specimens(30, 5);
    expect(sp).toHaveLength(30);
    expect(specimens(30, 5)).toEqual(sp);
    // De ti første er spredt over hele fordelingen
    const first = sp.slice(0, 10).map((s) => s.u);
    expect(Math.min(...first)).toBeLessThan(0.35);
    expect(Math.max(...first)).toBeGreaterThan(0.65);
  });
});

describe('menstruasjonssyklusen', () => {
  const scenarios: CycleScenario[] = ['vanlig', 'graviditet', 'p-piller'];

  it('LH-toppen kommer rett før eggløsningen, etter østrogentoppen', () => {
    const lh = peakDay('lh', 'vanlig');
    expect(lh).toBeGreaterThan(OVULATION_DAY - 1.5);
    expect(lh).toBeLessThan(OVULATION_DAY);
    expect(peakDay('ostrogen', 'vanlig', 1, 16)).toBeLessThan(lh);
    expect(hormonesAt(lh, 'vanlig').lh).toBeGreaterThan(0.9);
    // FSH har også en topp midt i syklusen
    expect(peakDay('fsh', 'vanlig', 8, 20)).toBeCloseTo(lh, 0);
  });

  it('progesteron er høyest i gulelegemefasen og lavt før eggløsningen', () => {
    const p = peakDay('progesteron', 'vanlig');
    expect(p).toBeGreaterThan(19);
    expect(p).toBeLessThan(24);
    expect(hormonesAt(8, 'vanlig').progesteron).toBeLessThan(0.1);
    expect(hormonesAt(21, 'vanlig').progesteron).toBeGreaterThan(0.85);
  });

  it('syklusen henger sammen fra dag 28 til dag 1', () => {
    const a = hormonesAt(CYCLE_DAYS + 0.999, 'vanlig');
    const b = hormonesAt(1, 'vanlig');
    expect(a.fsh).toBeCloseTo(b.fsh, 2);
    expect(a.progesteron).toBeCloseTo(b.progesteron, 2);
    expect(endometrium(CYCLE_DAYS + 0.999, 'vanlig')).toBeCloseTo(endometrium(1, 'vanlig'), 1);
  });

  it('livmorslimhinnen: tynnest etter menstruasjonen, tykkest i gulelegemefasen', () => {
    expect(endometrium(5, 'vanlig')).toBeCloseTo(2, 5);
    expect(endometrium(22, 'vanlig')).toBeGreaterThan(10);
    expect(bleeding(3, 'vanlig')).toBe(true);
    expect(bleeding(10, 'vanlig')).toBe(false);
    for (const s of scenarios)
      for (let d = 1; d <= lastDay(s); d += 0.25) {
        const e = endometrium(d, s);
        expect(e).toBeGreaterThanOrEqual(1.9);
        expect(e).toBeLessThanOrEqual(14.01);
      }
  });

  it('follikkel, eggløsning og gulelegeme', () => {
    expect(ovaryAt(8, 'vanlig').stage).toBe('follikkel');
    expect(ovaryAt(13, 'vanlig').size).toBeGreaterThan(ovaryAt(8, 'vanlig').size);
    expect(ovaryAt(14, 'vanlig').stage).toBe('eggløsning');
    expect(ovaryAt(20, 'vanlig').stage).toBe('gulelegeme');
    expect(ovaryAt(27, 'vanlig').stage).toBe('tilbakedannes');
    expect(phaseAt(3, 'vanlig')).toBe('menstruasjon');
    expect(phaseAt(10, 'vanlig')).toBe('follikkelfase');
    expect(phaseAt(14, 'vanlig')).toBe('eggløsning');
    expect(phaseAt(20, 'vanlig')).toBe('gulelegemefase');
  });

  it('tilbakekoblingen: negativ, så positiv før eggløsningen, så negativ igjen', () => {
    expect(feedbackAt(5, 'vanlig')).toBe('negativ-ostrogen');
    expect(feedbackAt(12.5, 'vanlig')).toBe('positiv');
    expect(feedbackAt(20, 'vanlig')).toBe('negativ-progesteron');
    expect(feedbackAt(27, 'vanlig')).toBe('svekkes');
    expect(feedbackAt(30, 'graviditet')).toBe('hcg');
    expect(feedbackAt(10, 'p-piller')).toBe('pille');
  });

  it('graviditet: hCG holder progesteronet høyt, ingen menstruasjon', () => {
    expect(hormonesAt(18, 'graviditet').hcg).toBe(0);
    expect(hormonesAt(28, 'graviditet').hcg).toBeGreaterThan(hormonesAt(24, 'graviditet').hcg);
    // hCG dobles omtrent annenhver dag og stiger fortsatt på dag 42 (toppen kommer først i uke 8–10)
    expect(hcgLevel(30) / hcgLevel(28)).toBeCloseTo(2, 6);
    expect(hcgLevel(42)).toBeCloseTo(1, 9);
    expect(hcgLevel(42)).toBeGreaterThan(1.3 * hcgLevel(41));
    for (let d = 20; d <= 42; d += 1) {
      expect(hormonesAt(d, 'graviditet').progesteron).toBeGreaterThan(0.8);
      expect(hormonesAt(d, 'graviditet').lh).toBeLessThan(0.2);
      expect(bleeding(d, 'graviditet')).toBe(false);
    }
    expect(endometrium(35, 'graviditet')).toBeGreaterThan(12);
    expect(ovaryAt(35, 'graviditet').stage).toBe('gulelegeme');
  });

  it('p-piller: ingen LH-topp og ingen eggløsning, bortfallsblødning i den pillefrie uka', () => {
    for (let d = 1; d <= CYCLE_DAYS; d += 0.25) {
      expect(hormonesAt(d, 'p-piller').lh).toBeLessThan(0.2);
      expect(ovaryAt(d, 'p-piller').stage).toBe('hvilende');
      expect(endometrium(d, 'p-piller')).toBeLessThan(5);
    }
    expect(hormonesAt(10, 'p-piller').pille).toBeGreaterThan(0);
    expect(hormonesAt(25, 'p-piller').pille).toBe(0);
    expect(bleeding(25, 'p-piller')).toBe(true);
    expect(bleeding(10, 'p-piller')).toBe(false);
    expect(phaseAt(25, 'p-piller')).toBe('pillefri');
  });

  it('fasefeltene dekker hele tidsaksen uten hull', () => {
    for (const s of scenarios) {
      const b = phaseBands(s);
      expect(b[0]![0]).toBe(1);
      for (let i = 1; i < b.length; i++) expect(b[i]![0]).toBe(b[i - 1]![1]);
      expect(b[b.length - 1]![1]).toBeGreaterThanOrEqual(lastDay(s));
    }
  });

  it('alle verdier er endelige og mellom 0 og 1,1', () => {
    for (const s of scenarios)
      for (let d = 1; d <= lastDay(s); d += 0.1) {
        const h = hormonesAt(d, s);
        for (const v of Object.values(h)) {
          expect(Number.isFinite(v)).toBe(true);
          expect(v).toBeGreaterThanOrEqual(0);
          expect(v).toBeLessThanOrEqual(1.1);
        }
      }
  });
});

describe('planters formering', () => {
  it('dobbel befruktning: zygoten blir 2n og frøhviten 3n', () => {
    expect(fuse('eggcelle', 'saedcelle')).toBe(PLOIDY.zygote);
    expect(fuse('polkjerne', 'polkjerne', 'saedcelle')).toBe(PLOIDY.frohvite);
    expect(ploidyText(fuse('eggcelle', 'saedcelle'))).toBe('2n');
    expect(ploidyText(PLOIDY.pollenkorn)).toBe('n');
    expect(ploidyText(PLOIDY.frohvite)).toBe('3n');
    // Kimen har like mange kromosomsett som morplanta
    expect(PLOIDY.kim).toBe(PLOIDY.morplante);
  });

  it('kloner har alle genene fra morplanta, frø halvparten', () => {
    expect(sharedWithMother('klon')).toBe(1);
    expect(sharedWithMother('fro')).toBe(0.5);
    expect(PLOIDY.klon).toBe(PLOIDY.morplante);
  });
});
