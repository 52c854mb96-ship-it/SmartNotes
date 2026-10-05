import { describe, expect, it } from 'vitest';
import {
  EXPERIMENTS,
  MAX_SHADED_SHARE,
  PHOTO_PLANTS,
  auxinResponse,
  bendAngle,
  dayLength,
  elongationRatio,
  floweringRange,
  flowers,
  getExperiment,
  graviAngle,
  gravitropism,
  hoursText,
  lightResponse,
  longestDark,
  phytochromeAfterFlash,
  runExperiment,
  shadedShare,
  totalDark,
} from './model';

const plant = (id: string) => PHOTO_PLANTS.find((p) => p.id === id)!;

describe('fototropisme', () => {
  it('mer auksin på skyggesiden når lyset kommer fra siden', () => {
    expect(lightResponse(100)).toBeCloseTo(1, 9);
    expect(lightResponse(0)).toBe(0);
    expect(shadedShare(90, 0, 100)).toBeCloseTo(MAX_SHADED_SHARE, 9);
    expect(shadedShare(-90, 0, 100)).toBeCloseTo(MAX_SHADED_SHARE, 9);
    expect(shadedShare(0, 0, 100)).toBeCloseTo(0.5, 9);
    expect(shadedShare(90, 90, 100)).toBeCloseTo(0.5, 9);
    expect(shadedShare(90, 0, 0)).toBeCloseTo(0.5, 9);
    expect(elongationRatio(0.65)).toBeCloseTo(0.65 / 0.35, 9);
  });

  it('skuddet bøyer seg mot lyset og stopper når det peker mot lyset', () => {
    expect(bendAngle(90, 100, 0)).toBe(0);
    expect(bendAngle(90, 100, 120)).toBeCloseTo(48, 0);
    expect(bendAngle(90, 100, 1e5)).toBeCloseTo(90, 6);
    expect(bendAngle(-60, 100, 120)).toBeLessThan(0);
    expect(bendAngle(0, 100, 120)).toBe(0);
    expect(bendAngle(90, 0, 120)).toBe(0);
    // Monoton og aldri forbi lyset
    let prev = 0;
    for (let t = 0; t <= 600; t += 30) {
      const a = bendAngle(70, 60, t);
      expect(a).toBeGreaterThanOrEqual(prev);
      expect(a).toBeLessThanOrEqual(70);
      prev = a;
    }
  });
});

describe('gravitropisme', () => {
  it('rota er mye mer følsom for auksin enn stengelen', () => {
    expect(auxinResponse('rot', -10.5)).toBe(1);
    expect(auxinResponse('stengel', -5.5)).toBe(1);
    expect(auxinResponse('rot', -6)).toBeLessThan(0);
  });

  it('liggende skudd bøyer seg opp, rota ned', () => {
    const s = gravitropism('stengel', 90);
    expect(s.lower).toBeGreaterThan(s.upper);
    expect(s.growthLower).toBeGreaterThan(s.growthUpper);
    expect(s.bend).toBe(1);
    const r = gravitropism('rot', 90);
    expect(r.lower).toBeGreaterThan(r.upper);
    expect(r.growthLower).toBeLessThan(r.growthUpper);
    expect(r.bend).toBe(-1);
    expect(gravitropism('stengel', 0).bend).toBe(0);
  });

  it('vinkelen går tilbake mot loddrett', () => {
    expect(graviAngle(90, 0)).toBeCloseTo(90, 9);
    expect(graviAngle(90, 120)).toBeLessThan(45);
    expect(graviAngle(90, 1e5)).toBeCloseTo(0, 6);
    expect(graviAngle(0, 50)).toBe(0);
  });
});

describe('de klassiske forsøkene', () => {
  const expected: Record<string, string> = {
    intakt: 'hoyre',
    kuttet: 'rett',
    hette: 'rett',
    glasshette: 'hoyre',
    ror: 'hoyre',
    gelatin: 'hoyre',
    'glimmer-skygge': 'rett',
    'glimmer-lys': 'hoyre',
    went: 'hoyre',
    'went-tom': 'rett',
  };
  for (const e of EXPERIMENTS)
    it(`${e.who}: ${e.name}`, () => {
      expect(runExperiment(e).outcome).toBe(expected[e.id]);
    });

  it('uten spiss (eller med tom agar) vokser ikke koleoptilen', () => {
    expect(runExperiment(getExperiment('kuttet')).grows).toBe(false);
    expect(runExperiment(getExperiment('went-tom')).grows).toBe(false);
    expect(runExperiment(getExperiment('hette')).grows).toBe(true);
    expect(runExperiment(getExperiment('hette')).tipSeesLight).toBe(false);
    expect(getExperiment('finnes-ikke').id).toBe('intakt');
  });

  it('auksinet er bevart når ingenting stoppes', () => {
    for (const id of ['intakt', 'glasshette', 'ror', 'gelatin']) {
      const r = runExperiment(getExperiment(id));
      expect(r.left + r.right).toBeCloseTo(1, 9);
    }
  });
});

describe('fotoperiodisme', () => {
  it('den lengste mørkeperioden', () => {
    expect(longestDark({ day: 14, interruption: 'ingen', flash: 'rod' })).toBe(10);
    expect(longestDark({ day: 14, interruption: 'glimt', flash: 'rod' })).toBeCloseTo(4.875, 9);
    expect(longestDark({ day: 14, interruption: 'glimt', flash: 'rod-langrod' })).toBe(10);
    expect(longestDark({ day: 14, interruption: 'morkt', flash: 'rod' })).toBe(10);
    expect(totalDark({ day: 14, interruption: 'morkt', flash: 'rod' })).toBe(11);
    expect(longestDark({ day: 24, interruption: 'glimt', flash: 'rod' })).toBe(0);
    expect(phytochromeAfterFlash('rod')).toBe('Pfr');
    expect(phytochromeAfterFlash('rod-langrod')).toBe('Pr');
  });

  it('kritisk nattlengde avgjør', () => {
    expect(flowers(plant('julestjerne'), 12)).toBe(true);
    expect(flowers(plant('julestjerne'), 11)).toBe(false);
    expect(flowers(plant('bulmeurt'), 11)).toBe(true);
    expect(flowers(plant('bulmeurt'), 14)).toBe(false);
    expect(flowers(plant('tomat'), 0)).toBe(true);
    expect(flowers(plant('tomat'), 24)).toBe(true);
  });

  it('en langdagsplante og en kortdagsplante kan blomstre ved samme daglengde', () => {
    const night = 24 - 13;
    expect(flowers(plant('bulmeurt'), night)).toBe(true);
    expect(flowers(plant('krysantemum'), night)).toBe(true);
  });

  it('et rødt lysglimt midt i natta snur resultatet', () => {
    const s = { day: 10, interruption: 'glimt' as const, flash: 'rod' as const };
    expect(flowers(plant('julestjerne'), 14)).toBe(true);
    expect(flowers(plant('julestjerne'), longestDark(s))).toBe(false);
    expect(flowers(plant('bulmeurt'), 14)).toBe(false);
    expect(flowers(plant('bulmeurt'), longestDark(s))).toBe(true);
    // Langrødt etter rødt opphever virkningen
    expect(flowers(plant('julestjerne'), longestDark({ ...s, flash: 'rod-langrod' }))).toBe(true);
  });

  it('blomstringsområdene', () => {
    expect(floweringRange(plant('bulmeurt'))).toEqual([0, 13]);
    expect(floweringRange(plant('julestjerne'))).toEqual([11.7, 24]);
    expect(floweringRange(plant('tomat'))).toEqual([0, 24]);
  });

  it('daglengde i Norge', () => {
    expect(dayLength(59.9, 172)).toBeCloseTo(18.8, 0); // Oslo, sankthans
    expect(dayLength(59.9, 355)).toBeCloseTo(6, 0); // Oslo, vintersolverv
    expect(dayLength(59.9, 80)).toBeGreaterThan(11.9);
    expect(dayLength(59.9, 80)).toBeLessThan(12.6);
    expect(dayLength(69.65, 172)).toBe(24); // Tromsø, midnattssol
    expect(dayLength(69.65, 355)).toBe(0); // Tromsø, mørketid
    expect(dayLength(0, 172)).toBeCloseTo(12.1, 0); // ekvator
  });

  it('timer som tekst', () => {
    expect(hoursText(14.5)).toBe('14 t 30 min');
    expect(hoursText(24)).toBe('24 t');
    expect(hoursText(11.7)).toBe('11 t 42 min');
    expect(hoursText(NaN)).toBe('–');
  });
});
