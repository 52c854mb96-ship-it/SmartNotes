import { describe, expect, it } from 'vitest';
import {
  BINDING_EV,
  C,
  E_CHARGE,
  EXAMPLES,
  H,
  LAMBDA_ION,
  LAMBDA_MAX,
  LAMBDA_MIN,
  REGIONS,
  atExample,
  bandPos,
  chirpLength,
  chirpPhase,
  chocolateSpeed,
  clampLambda,
  colorName,
  energyEv,
  energyTicks,
  example,
  fmtEv,
  fmtFreq,
  fmtLambda,
  fmtLambdaTick,
  fmtPow,
  fmtSig,
  freqTicks,
  frequency,
  hotSpotSpacing,
  isIonizing,
  lambdaAtPos,
  lambdaFromEv,
  lambdaTicks,
  nearestExample,
  oneSig,
  photonEnergy,
  photonsPerBond,
  rainbowT,
  regionOf,
  sizeComparison,
  wavelength,
  wienPeak,
} from './model-em-spekteret';

describe('c = λf og E = hf', () => {
  it('kjente verdier', () => {
    expect(wavelength(100e6)).toBeCloseTo(3.0, 10); // FM-radio
    expect(wavelength(2.45e9)).toBeCloseTo(0.1224, 4); // mikrobølgeovn
    expect(frequency(550e-9) / 5.4545e14).toBeCloseTo(1, 4); // grønt lys
    expect(photonEnergy(550e-9) / 3.616e-19).toBeCloseTo(1, 3);
    expect(energyEv(550e-9)).toBeCloseTo(2.26, 2);
    expect(energyEv(1e-6)).toBeCloseTo(1.243, 3); // 1 µm ↔ 1,24 eV
  });

  it('λ · f = c og E · λ = hc for hele spekteret', () => {
    for (let p = 0; p <= 1; p += 0.05) {
      const l = lambdaAtPos(p);
      expect((l * frequency(l)) / C).toBeCloseTo(1, 12);
      expect((photonEnergy(l) * l) / (H * C)).toBeCloseTo(1, 12);
      expect((energyEv(l) * E_CHARGE) / (H * frequency(l))).toBeCloseTo(1, 12);
    }
  });

  it('kort bølgelengde gir høy frekvens og mer energi per foton', () => {
    let lastF = 0;
    let lastE = 0;
    for (let p = 0; p <= 1; p += 0.01) {
      const l = lambdaAtPos(p);
      expect(frequency(l)).toBeGreaterThan(lastF);
      expect(energyEv(l)).toBeGreaterThan(lastE);
      lastF = frequency(l);
      lastE = energyEv(l);
    }
  });

  it('lambdaFromEv er det motsatte av energyEv', () => {
    for (const ev of [1e-6, 0.13, 2.26, 10, 662e3]) expect(energyEv(lambdaFromEv(ev)) / ev).toBeCloseTo(1, 12);
  });

  it('ioniserende fra ca. 124 nm (10 eV)', () => {
    expect(LAMBDA_ION * 1e9).toBeCloseTo(124.3, 1);
    expect(isIonizing(300e-9)).toBe(false); // UV-B
    expect(isIonizing(100e-9)).toBe(true); // UV-C
    expect(isIonizing(0.05e-9)).toBe(true);
    expect(isIonizing(0.1224)).toBe(false);
  });
});

describe('skalaen langs spekteret', () => {
  it('endene og midten', () => {
    expect(bandPos(LAMBDA_MAX)).toBe(0);
    expect(bandPos(LAMBDA_MIN)).toBeCloseTo(1, 12);
    expect(bandPos(1e-5)).toBeCloseTo(0.5, 12);
  });

  it('lambdaAtPos og bandPos er hverandres motsatte', () => {
    for (let p = 0; p <= 1; p += 0.037) expect(bandPos(lambdaAtPos(p))).toBeCloseTo(p, 12);
  });

  it('klemmer ugyldige verdier', () => {
    expect(bandPos(1e9)).toBe(0);
    expect(bandPos(1e-20)).toBeCloseTo(1, 12);
    expect(lambdaAtPos(-1)).toBe(LAMBDA_MAX);
    expect(lambdaAtPos(Number.NaN)).toBe(LAMBDA_MAX);
    expect(clampLambda(Number.NaN)).toBe(1);
  });
});

describe('områdene', () => {
  it('henger sammen uten hull fra 1 km til 0,1 pm', () => {
    expect(REGIONS[0]!.fra).toBe(LAMBDA_MAX);
    expect(REGIONS[REGIONS.length - 1]!.til).toBe(LAMBDA_MIN);
    for (let i = 1; i < REGIONS.length; i++) expect(REGIONS[i]!.fra).toBe(REGIONS[i - 1]!.til);
  });

  it('kjente bølgelengder havner riktig', () => {
    expect(regionOf(3).id).toBe('radio');
    expect(regionOf(0.12).id).toBe('mikro');
    expect(regionOf(10e-6).id).toBe('ir');
    expect(regionOf(550e-9).id).toBe('synlig');
    expect(regionOf(380e-9).id).toBe('synlig');
    expect(regionOf(750e-9).id).toBe('synlig');
    expect(regionOf(300e-9).id).toBe('uv');
    expect(regionOf(0.1e-9).id).toBe('rontgen');
    expect(regionOf(1e-12).id).toBe('gamma');
  });
});

describe('eksemplene fra hverdagen', () => {
  it('har riktige tall', () => {
    expect(example('radio').lambda).toBeCloseTo(1.5, 10);
    expect(example('mobil').lambda).toBeCloseTo(0.375, 10);
    expect(example('mikro').lambda * 100).toBeCloseTo(12.24, 2);
    expect(example('varme').lambda * 1e6).toBeCloseTo(9.35, 2); // Wiens lov for 310 K
    expect(energyEv(example('rontgen').lambda) / 1e3).toBeCloseTo(24.9, 1);
    expect(example('gamma').lambda * 1e12).toBeCloseTo(1.878, 3);
    expect(wienPeak(310)).toBeCloseTo(9.35e-6, 8);
  });

  it('ligger i området sitt, i rekkefølge fra lang til kort bølgelengde', () => {
    const regionFor = { radio: 'radio', mobil: 'mikro', mikro: 'mikro', varme: 'ir', fjern: 'ir', synlig: 'synlig', uv: 'uv', rontgen: 'rontgen', gamma: 'gamma' };
    for (let i = 0; i < EXAMPLES.length; i++) {
      const e = EXAMPLES[i]!;
      expect(regionOf(e.lambda).id).toBe(regionFor[e.id]);
      expect(e.lambda).toBeLessThan(LAMBDA_MAX);
      expect(e.lambda).toBeGreaterThan(LAMBDA_MIN);
      if (i > 0) expect(e.lambda).toBeLessThan(EXAMPLES[i - 1]!.lambda);
    }
  });

  it('nærmeste eksempel er seg selv, og alltid fra samme område', () => {
    for (const e of EXAMPLES) {
      expect(nearestExample(e.lambda).id).toBe(e.id);
      expect(atExample(e.lambda, e)).toBe(true);
    }
    for (let p = 0; p <= 1; p += 0.003) {
      const l = lambdaAtPos(p);
      expect(regionOf(nearestExample(l).lambda).id).toBe(regionOf(l).id);
    }
  });

  it('velger mellom to eksempler i samme område', () => {
    expect(nearestExample(0.5).id).toBe('mobil');
    expect(nearestExample(0.01).id).toBe('mikro');
    expect(nearestExample(2e-6).id).toBe('fjern');
    expect(nearestExample(50e-6).id).toBe('varme');
    expect(nearestExample(390e-9).id).toBe('synlig'); // synlig fiolett, ikke UV
    expect(atExample(0.13, example('mikro'))).toBe(false);
  });
});

describe('sammenligning og hverdagsfysikk', () => {
  it('størrelser', () => {
    expect(sizeComparison(1.5)).toBe('omtrent like stor som høyden til en voksen person');
    expect(sizeComparison(0.1224)).toBe('omtrent like stor som bredden av en hånd');
    expect(sizeComparison(550e-9)).toBe('omtrent like stor som en bakterie');
    expect(sizeComparison(1e-7)).toBe('omtrent like stor som et virus');
    expect(sizeComparison(example('gamma').lambda)).toBe('ca. 50 ganger mindre enn et atom');
    expect(sizeComparison(LAMBDA_MAX)).toBe('ca. 10 ganger større enn lengden av en fotballbane');
    for (let p = 0; p <= 1; p += 0.01) expect(sizeComparison(lambdaAtPos(p))).not.toMatch(/NaN|undefined|Infinity/);
  });

  it('oneSig', () => {
    expect(oneSig(53)).toBe(50);
    expect(oneSig(9.5)).toBe(10);
    expect(oneSig(0)).toBe(0);
  });

  it('sjokoladeforsøket i mikrobølgeovnen gir lysfarten', () => {
    const l = example('mikro').lambda;
    expect(hotSpotSpacing(l) * 100).toBeCloseTo(6.12, 2);
    expect(chocolateSpeed(hotSpotSpacing(l), 2.45e9)).toBeCloseTo(C, 0);
  });

  it('fotoner per kjemisk binding', () => {
    expect(photonsPerBond(lambdaFromEv(BINDING_EV))).toBeCloseTo(1, 12);
    expect(photonsPerBond(example('mobil').lambda)).toBeGreaterThan(1e6);
    expect(photonsPerBond(example('uv').lambda)).toBeLessThan(1);
  });

  it('fargenavn og regnbuen', () => {
    expect(colorName(420)).toBe('fiolett');
    expect(colorName(470)).toBe('blått');
    expect(colorName(550)).toBe('grønt');
    expect(colorName(580)).toBe('gult');
    expect(colorName(600)).toBe('oransje');
    expect(colorName(700)).toBe('rødt');
    expect(rainbowT(380)).toBe(0);
    expect(rainbowT(550)).toBeCloseTo(0.5, 12);
    expect(rainbowT(750)).toBe(1);
  });
});

describe('tall og enheter', () => {
  it('fmtSig', () => {
    expect(fmtSig(0.1224)).toBe('0,122');
    expect(fmtSig(37.5)).toBe('37,5');
    expect(fmtSig(940)).toBe('940');
    expect(fmtSig(9.996)).toBe('10,0');
  });

  it('fmtLambda', () => {
    expect(fmtLambda(1.5)).toBe('1,50 m');
    expect(fmtLambda(0.375)).toBe('37,5 cm');
    expect(fmtLambda(0.1224)).toBe('12,2 cm');
    expect(fmtLambda(9.355e-6)).toBe('9,35 µm');
    expect(fmtLambda(940e-9)).toBe('940 nm');
    expect(fmtLambda(0.05e-9)).toBe('0,0500 nm');
    expect(fmtLambda(1.878e-12)).toBe('1,88 pm');
    expect(fmtLambda(1000)).toBe('1,00 km');
    expect(fmtLambda(9.9999e-4)).toBe('1,00 mm');
    expect(fmtLambda(1e-13)).toBe('0,100 pm');
  });

  it('fmtFreq og fmtEv', () => {
    expect(fmtFreq(200e6)).toBe('200 MHz');
    expect(fmtFreq(2.45e9)).toBe('2,45 GHz');
    expect(fmtFreq(5.45e14)).toBe('5,45 · 10¹⁴ Hz');
    expect(fmtEv(8.29e-7)).toBe('8,29 · 10⁻⁷ eV');
    expect(fmtEv(2.26)).toBe('2,26 eV');
    expect(fmtEv(24900)).toBe('24,9 keV');
    expect(fmtEv(662e3)).toBe('662 keV');
    expect(fmtEv(1.24e6)).toBe('1,24 MeV');
  });

  it('akseetiketter', () => {
    expect([3, 0, -1, -3, -4, -6, -7, -9, -10, -11, -12, -13].map(fmtLambdaTick)).toEqual([
      '1 km',
      '1 m',
      '10 cm',
      '1 mm',
      '100 µm',
      '1 µm',
      '100 nm',
      '1 nm',
      '0,1 nm',
      '10 pm',
      '1 pm',
      '0,1 pm',
    ]);
    expect(fmtPow(9, 'Hz')).toBe('10⁹ Hz');
    expect(fmtPow(-6, 'eV')).toBe('10⁻⁶ eV');
    expect(fmtPow(0, 'eV')).toBe('1 eV');
  });

  it('aksestrekene ligger innenfor spekteret, og hver tredje er stor', () => {
    const l = lambdaTicks();
    expect(l).toHaveLength(17);
    expect(l.filter((t) => t.major).map((t) => t.k)).toEqual([-12, -9, -6, -3, 0, 3]);
    const f = freqTicks();
    expect(f[0]!.k).toBe(6);
    expect(f[f.length - 1]!.k).toBe(21);
    for (let i = 1; i < f.length; i++) expect(f[i]!.p).toBeGreaterThan(f[i - 1]!.p);
    // 10⁹ Hz ligger ved λ = 30 cm, ikke rett under en λ-strek
    expect(f.find((t) => t.k === 9)!.p).toBeCloseTo(bandPos(0.3), 12);
    const e = energyTicks();
    expect(e[0]!.k).toBe(-8);
    expect(e[e.length - 1]!.k).toBe(7);
    for (const t of [...l, ...f, ...e]) {
      expect(t.p).toBeGreaterThanOrEqual(-1e-9);
      expect(t.p).toBeLessThanOrEqual(1 + 1e-9);
    }
  });
});

describe('den skjematiske bølgen langs spekteret', () => {
  it('bølgelengden avtar fra lMax til lMin, og fasen øker', () => {
    expect(chirpLength(0, 700, 160, 4)).toBe(160);
    expect(chirpLength(700, 700, 160, 4)).toBeCloseTo(4, 10);
    let last = -1;
    for (let u = 0; u <= 700; u += 10) {
      const ph = chirpPhase(u, 700, 160, 4);
      expect(ph).toBeGreaterThan(last);
      last = ph;
    }
  });

  it('dφ/du = 2π / L(u)', () => {
    for (const u of [0, 200, 650]) {
      const d = (chirpPhase(u + 0.001, 700, 160, 4) - chirpPhase(u, 700, 160, 4)) / 0.001;
      expect(d).toBeCloseTo((2 * Math.PI) / chirpLength(u, 700, 160, 4), 4);
    }
    expect(chirpPhase(100, 700, 50, 50)).toBeCloseTo(4 * Math.PI, 10);
  });
});
