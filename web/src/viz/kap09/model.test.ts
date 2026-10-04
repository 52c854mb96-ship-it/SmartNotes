import { describe, expect, it } from 'vitest';
import { fmtPow10, fmtSig, fmtWords, yearsParts } from './format';
import {
  AU,
  C_LIGHT,
  LIGHT_YEAR,
  MAIN_SEQUENCE,
  PARSEC,
  SPACE_OBJECTS,
  STARS,
  SUN_L,
  SUN_R,
  SUN_T,
  WD_RADIUS,
  YEAR,
  alongTrack,
  blackbodyRgb,
  fate,
  lifeStages,
  lightTime,
  lightTravel,
  luminosityFromRT,
  luminosityWatts,
  msLifetime,
  msLuminosity,
  msRadius,
  msTemperature,
  msTemperatureForL,
  nearestObject,
  radiusFromLT,
  scaleModel,
  starLifetime,
  toAU,
  toLightYears,
  wienPeak,
} from './model';

/** Fjerner harde mellomrom fra norsk tallformat, så testene blir lettere å lese. */
const plain = (s: string) => s.replace(/\s/g, ' ');

describe('enheter for avstand', () => {
  it('ett lysår er strekningen lyset går på ett år', () => {
    expect((C_LIGHT * YEAR) / LIGHT_YEAR).toBeCloseTo(1, 2);
  });

  it('1 lysår ≈ 63 200 AE og 1 parsec ≈ 3,26 lysår', () => {
    expect(LIGHT_YEAR / AU).toBeCloseTo(63235, -2);
    expect(PARSEC / LIGHT_YEAR).toBeCloseTo(3.26, 2);
  });

  it('lyset bruker ca. 1,3 s fra månen og 8,3 min fra sola', () => {
    const moon = SPACE_OBJECTS.find((o) => o.id === 'manen')!;
    expect(lightTime(moon.d)).toBeCloseTo(1.28, 2);
    expect(lightTravel(moon.d)).toMatchObject({ unit: 's' });
    const sun = lightTravel(AU);
    expect(sun.unit).toBe('min');
    expect(sun.value).toBeCloseTo(8.31, 2);
  });

  it('avstand i lysår gir tiden lyset bruker, i år', () => {
    const p = lightTravel(4.24 * LIGHT_YEAR);
    expect(p.unit).toBe('år');
    expect(p.value).toBeCloseTo(4.24, 9);
    expect(toLightYears(4.24 * LIGHT_YEAR)).toBeCloseTo(4.24, 9);
  });

  it('velger enhet etter hvor lang tiden er', () => {
    expect(lightTravel(4e5).unit).toBe('ms');
    expect(lightTravel(30 * AU).unit).toBe('timer');
    expect(lightTravel(5e4 * AU).unit).toBe('døgn');
  });

  it('objektene er sortert fra nærmest til fjernest', () => {
    for (let i = 1; i < SPACE_OBJECTS.length; i++) expect(SPACE_OBJECTS[i]!.d).toBeGreaterThan(SPACE_OBJECTS[i - 1]!.d);
  });

  it('finner nærmeste objekt på log-skalaen', () => {
    expect(nearestObject(Math.log10(AU)).obj.id).toBe('sola');
    expect(nearestObject(Math.log10(AU)).decades).toBe(0);
    expect(nearestObject(Math.log10(5 * LIGHT_YEAR)).obj.id).toBe('proxima');
    expect(nearestObject(30).obj.id).toBe('univers');
  });

  it('skalamodell: med jorda–sola = 1 cm er Proxima Centauri ca. 2,7 km unna', () => {
    expect(scaleModel(AU)).toBeCloseTo(0.01, 9);
    expect(scaleModel(4.24 * LIGHT_YEAR)).toBeCloseTo(2681, -1);
    expect(toAU(30 * AU)).toBeCloseTo(30, 9);
  });
});

describe('stjerner og strålingslovene', () => {
  it('Stefan–Boltzmann gir solas luminositet fra radius og temperatur', () => {
    expect(luminosityWatts(SUN_R, SUN_T) / SUN_L).toBeCloseTo(1, 2);
    expect(radiusFromLT(1, SUN_T)).toBeCloseTo(1, 9);
    expect(luminosityFromRT(2, SUN_T)).toBeCloseTo(4, 9);
    expect(luminosityFromRT(1, 2 * SUN_T)).toBeCloseTo(16, 9);
  });

  it('Wiens lov: sola har toppen ved ca. 500 nm', () => {
    expect(wienPeak(SUN_T) * 1e9).toBeCloseTo(502, 0);
  });

  it('hvite dverger er omtrent like store som jorda, superkjemper hundrevis av solradier', () => {
    const r = (id: string) => {
      const s = STARS.find((x) => x.id === id)!;
      return radiusFromLT(s.L, s.T);
    };
    const earth = 6.37e6 / SUN_R;
    // Sirius B: R ≈ 0,0084 R☉ fra målinger, altså omtrent jordas radius. L og T i tabellen må gi det samme.
    expect(r('siriusb')).toBeCloseTo(0.0086, 3);
    expect(r('siriusb') / earth).toBeGreaterThan(0.8);
    expect(r('siriusb') / earth).toBeLessThan(1.2);
    expect(r('betelgeuse')).toBeGreaterThan(500);
    expect(r('sola')).toBeCloseTo(1, 9);
  });

  it('dataene stemmer med typene: hovedseriestjerner ligger på hovedserien, kjemper til høyre for den', () => {
    for (const s of STARS) {
      const dT = Math.log10(msTemperatureForL(s.L)) - Math.log10(s.T);
      const R = radiusFromLT(s.L, s.T);
      if (s.cls === 'hovedserie') expect(Math.abs(dT), s.name).toBeLessThan(0.18);
      if (s.cls === 'kjempe' || s.cls === 'superkjempe') expect(dT, s.name).toBeGreaterThan(0.2);
      if (s.cls === 'hvit-dverg') expect(R, s.name).toBeLessThan(0.02);
    }
    expect(STARS.length).toBeGreaterThanOrEqual(25);
    expect(new Set(STARS.map((s) => s.id)).size).toBe(STARS.length);
  });

  it('hovedserietabellen er monoton: varmere stjerner er lyssterkere', () => {
    for (let i = 1; i < MAIN_SEQUENCE.length; i++) {
      expect(MAIN_SEQUENCE[i]![0]).toBeLessThan(MAIN_SEQUENCE[i - 1]![0]);
      expect(MAIN_SEQUENCE[i]![1]).toBeLessThan(MAIN_SEQUENCE[i - 1]![1]);
    }
    expect(msTemperatureForL(1)).toBeCloseTo(SUN_T, 6);
    expect(msTemperatureForL(1e9)).toBe(45000);
  });
});

describe('hovedserien: masse, luminositet og levetid', () => {
  it('L = M^3,5: to solmasser gir ca. 11 L☉, sola gir 1', () => {
    expect(msLuminosity(1)).toBe(1);
    expect(msLuminosity(2)).toBeCloseTo(11.31, 2);
    expect(msTemperature(1)).toBeCloseTo(SUN_T, 6);
    expect(msRadius(1)).toBeCloseTo(1, 6);
  });

  it('levetiden er 10¹⁰ år for sola og faller som M^−2,5', () => {
    expect(msLifetime(1)).toBeCloseTo(1e10, 0);
    expect(msLifetime(10)).toBeCloseTo(3.16e7, -5);
    // t ∝ M/L: drivstoff delt på forbruk
    for (const M of [0.3, 2, 7, 20]) expect(msLifetime(M) / 1e10).toBeCloseTo(M / msLuminosity(M), 9);
  });

  it('tyngre stjerner er varmere, større og lever kortere', () => {
    const masses = [0.2, 0.5, 1, 2, 5, 10, 25];
    for (let i = 1; i < masses.length; i++) {
      const a = masses[i - 1]!;
      const b = masses[i]!;
      expect(msTemperature(b)).toBeGreaterThan(msTemperature(a));
      expect(msRadius(b)).toBeGreaterThan(msRadius(a));
      expect(msLifetime(b)).toBeLessThan(msLifetime(a));
    }
  });

  it('kjente verdier: 10 M☉ er en varm B-stjerne, 0,2 M☉ en kald rød dverg', () => {
    expect(msTemperature(10)).toBeGreaterThan(20000);
    expect(msTemperature(10)).toBeLessThan(26000);
    expect(msTemperature(0.2)).toBeGreaterThan(2900);
    expect(msTemperature(0.2)).toBeLessThan(3400);
  });
});

describe('livsløpet til en stjerne', () => {
  const ids = (M: number) => lifeStages(M).map((s) => s.id);

  it('massen bestemmer sluttproduktet (grenser ca. 0,5, 8 og 20 M☉)', () => {
    expect(fate(0.3)).toBe('hvit-dverg-helium');
    expect(fate(1)).toBe('hvit-dverg');
    expect(fate(7.9)).toBe('hvit-dverg');
    expect(fate(8)).toBe('noytronstjerne');
    expect(fate(19)).toBe('noytronstjerne');
    expect(fate(25)).toBe('svart-hull');
  });

  it('sola: protostjerne → hovedserie → rød kjempe → planetarisk tåke → hvit dverg', () => {
    expect(ids(1)).toEqual(['protostjerne', 'hovedserie', 'rod-kjempe', 'planetarisk-take', 'hvit-dverg']);
    expect(ids(15)).toEqual(['protostjerne', 'hovedserie', 'rod-superkjempe', 'supernova', 'noytronstjerne']);
    expect(ids(30)).toEqual(['protostjerne', 'hovedserie', 'rod-superkjempe', 'supernova', 'svart-hull']);
    expect(ids(0.3)).toEqual(['protostjerne', 'hovedserie', 'hvit-dverg']);
    expect(lifeStages(0.3)[2]!.future).toBe(true);
  });

  it('veien i HR-diagrammet henger sammen fra stadium til stadium', () => {
    for (const M of [0.3, 0.7, 1, 3, 7.5, 9, 15, 25, 31]) {
      const tracks = lifeStages(M)
        .map((s) => s.track)
        .filter((t) => t.length > 0);
      for (let k = 1; k < tracks.length; k++) expect(tracks[k]![0]).toEqual(tracks[k - 1]!.at(-1));
      for (const t of tracks) for (const [a, b] of t) expect(Number.isFinite(a) && Number.isFinite(b)).toBe(true);
    }
  });

  it('hovedserien i livsløpet ligger der massen sier, og den hvite dvergen følger linjen R ≈ 0,012 R☉', () => {
    const ms = lifeStages(2)[1]!;
    const [logT, logL] = ms.track[0]!;
    expect(Math.abs(logL - Math.log10(msLuminosity(2)))).toBeLessThan(0.2);
    expect(Math.abs(logT - Math.log10(msTemperature(2)))).toBeLessThan(0.02);
    const wd = lifeStages(1).at(-1)!;
    for (const [lt, ll] of wd.track) expect(radiusFromLT(10 ** ll, 10 ** lt)).toBeCloseTo(WD_RADIUS, 6);
  });

  it('varighetene: sola er 10 milliarder år på hovedserien, og tunge stjerner lever kort', () => {
    const sun = lifeStages(1);
    expect(sun[1]!.years).toBeCloseTo(1e10, 0);
    expect(sun[0]!.years).toBeCloseTo(5e7, 0);
    expect(starLifetime(1)).toBeGreaterThan(1e10);
    expect(starLifetime(1)).toBeLessThan(1.2e10);
    expect(starLifetime(20)).toBeLessThan(1e7);
    expect(lifeStages(15).at(-1)!.years).toBe(Infinity);
  });

  it('tunge stjerner: protostjernens vei ligger under superkjempens, så de ikke tegnes oppå hverandre', () => {
    for (const M of [8, 12, 20, 31]) {
      const [proto, , rsg] = lifeStages(M);
      const protoMax = Math.max(...proto!.track.map(([, l]) => l));
      const rsgMin = Math.min(...rsg!.track.slice(1).map(([, l]) => l));
      expect(rsgMin - protoMax, `M = ${M}`).toBeGreaterThan(0.2);
    }
    // Sola trekker seg sammen ovenfra: protostjerna er lyssterkere enn sola blir på hovedserien.
    expect(lifeStages(1)[0]!.track[0]![1]).toBeGreaterThan(0.5);
  });

  it('massive stjerner fusjonerer helt til jern, sola stopper ved karbon og oksygen', () => {
    expect(lifeStages(15)[2]!.layers.at(-1)).toBe('Fe');
    expect(lifeStages(15)[2]!.fusion.at(-1)).toBe('Si → Fe');
    // Helium gir karbon og oksygen, karbonbrenning gir neon og magnesium (ikke oksygen).
    expect(lifeStages(15)[2]!.fusion).toContain('He → C og O');
    expect(lifeStages(15)[2]!.fusion).toContain('C → Ne og Mg');
    expect(lifeStages(1)[2]!.layers.at(-1)).toBe('CO');
    expect(lifeStages(1).at(-1)!.fusion).toEqual([]);
  });

  it('punkt langs en vei', () => {
    const track: [number, number][] = [
      [0, 0],
      [1, 0],
      [1, 4],
    ];
    expect(alongTrack(track, 0)).toEqual([0, 0]);
    expect(alongTrack(track, 1)).toEqual([1, 4]);
    expect(alongTrack(track, 0.25)).toEqual([0.5, 0]);
    expect(alongTrack([], 0.5)).toBeNull();
    expect(alongTrack([[2, 3]], 0.5)).toEqual([2, 3]);
  });

  it('stjernefarge: varme stjerner er blå, kalde røde', () => {
    const [r1, , b1] = blackbodyRgb(25000);
    const [r2, , b2] = blackbodyRgb(3000);
    expect(b1).toBeGreaterThan(r1);
    expect(r2).toBeGreaterThan(b2);
  });
});

describe('tallformat', () => {
  it('gjeldende sifre og standardform', () => {
    expect(plain(fmtSig(384400))).toBe('384 000');
    expect(plain(fmtSig(384400, 4))).toBe('384 400');
    expect(fmtSig(4.2366)).toBe('4,24');
    expect(fmtSig(0.0123)).toBe('0,0123');
    expect(fmtSig(2.37e22)).toBe('2,37 · 10²²');
    expect(fmtSig(9.996)).toBe('10,0');
    expect(fmtSig(Number.NaN)).toBe('–');
  });

  it('store tall med ord', () => {
    expect(fmtWords(2.5e6)).toBe('2,50 millioner');
    expect(fmtWords(4.65e10)).toBe('46,5 milliarder');
    expect(plain(fmtWords(26000))).toBe('26 000');
    expect(yearsParts(1.8e9)).toEqual({ value: '1,8', unit: 'milliarder år' });
  });

  it('tierpotenser', () => {
    expect(fmtPow10(0)).toBe('1');
    expect(fmtPow10(-2)).toBe('0,01');
    expect(fmtPow10(13)).toBe('10¹³');
    expect(fmtPow10(-5)).toBe('10⁻⁵');
  });
});
