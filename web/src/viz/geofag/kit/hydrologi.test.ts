import { describe, expect, it } from 'vitest';
import { seededRandom } from '../../kjemi/kit/random';
import {
  avrenningFraVannforing,
  boksOppholdstid,
  boksStrommer,
  darcy,
  flomMedGjentaksintervall,
  gjentaksintervall,
  GLOBALE_RESERVOARER,
  GLOBALE_STROMMER,
  grunnmateriale,
  gumbelTilpasning,
  hydrauliskGradient,
  KLIMAPASLAG,
  MATERIALER,
  medKlimapaslag,
  mPerAar,
  mPerDogn,
  oppholdstid,
  paavirkningsradius,
  plotteposisjon,
  plotteposisjoner,
  porefart,
  reisetidDarcy,
  reisetidFraFart,
  sannsynlighetIPerioden,
  SEK_PER_DOGN,
  senkning,
  spesifikkAvrenning,
  transmissivitet,
  VANNDAMP_TIL_LAND,
  vannbalanse,
  vannforingFraAvrenning,
  vannmagasin,
} from './hydrologi';

describe('vannets kretsløp globalt', () => {
  it('har Shiklomanovs volumer: ca. 97 % i havet og ca. 2,5 % ferskvann, det meste is', () => {
    const total = GLOBALE_RESERVOARER.reduce((s, m) => s + m.volum, 0);
    const ferskt = GLOBALE_RESERVOARER.reduce((s, m) => s + m.ferskt, 0);
    expect(total).toBeGreaterThan(1.385e9);
    expect(total).toBeLessThan(1.387e9);
    expect(vannmagasin('hav')!.volum / total).toBeCloseTo(0.9654, 3);
    expect(ferskt / total).toBeGreaterThan(0.024);
    expect(ferskt / total).toBeLessThan(0.026);
    expect(vannmagasin('is')!.ferskt / ferskt).toBeCloseTo(0.687, 2);
    const andeler = GLOBALE_RESERVOARER.map((m) => (100 * m.volum) / total);
    expect(andeler.reduce((s, a) => s + a, 0)).toBeCloseTo(100, 10);
    for (const m of GLOBALE_RESERVOARER) expect(m.ferskt).toBeLessThanOrEqual(m.volum);
  });

  it('er i balanse etter Trenberth mfl. 2007', () => {
    const s = (id: string) => GLOBALE_STROMMER.find((x) => x.id === id)!.mengde;
    expect(s('fordamping-hav') - s('nedbor-hav')).toBe(40_000);
    expect(s('nedbor-land') - s('fordamping-land')).toBe(40_000);
    expect(s('avrenning')).toBe(40_000);
    expect(VANNDAMP_TIL_LAND).toBe(40_000);
    for (const boks of ['hav', 'atmosfaeren', 'land'] as const) {
      const { inn, ut } = boksStrommer(boks);
      expect(inn).toBe(ut);
    }
  });

  it('gir 8–10 døgn i atmosfæren og tusenvis av år i havet', () => {
    const atm = boksOppholdstid('atmosfaeren')! * 365.25;
    expect(atm).toBeGreaterThan(8);
    expect(atm).toBeLessThan(10);
    expect(boksOppholdstid('hav')!).toBeGreaterThan(3000);
    expect(boksOppholdstid('hav')!).toBeLessThan(3500);
    expect(oppholdstid(12_900, 486_000)! * 365.25).toBeCloseTo(9.69, 1);
    expect(vannmagasin('atmosfaeren')!.typiskOppholdstid!.min * 365.25).toBeCloseTo(9, 8);
  });

  it('gir null i stedet for Infinity når strømmen er 0', () => {
    expect(oppholdstid(100, 0)).toBeNull();
    expect(oppholdstid(100, -5)).toBeNull();
    expect(oppholdstid(0, 5)).toBe(0);
    expect(oppholdstid(Number.NaN, 5)).toBeNull();
  });
});

describe('vannbalansen i et nedbørfelt', () => {
  it('løser P = E + Q + ΔS for avrenningen', () => {
    const b = vannbalanse({ nedbor: 1450, fordamping: 350 })!;
    expect(b.avrenning).toBe(1100);
    expect(b.avrenningsandel).toBeCloseTo(1100 / 1450, 12);
    expect(vannbalanse({ nedbor: 800, fordamping: 300, lagringsendring: 100 })!.avrenning).toBe(400);
    expect(vannbalanse({ nedbor: 0, fordamping: 0 })!.avrenningsandel).toBeNull();
    expect(vannbalanse({ nedbor: -1, fordamping: 0 })).toBeNull();
  });

  it('gjør 1100 mm over 85 km² om til ca. 2,96 m³/s og tilbake', () => {
    const q = vannforingFraAvrenning(1100, 85)!;
    expect(q).toBeCloseTo(2.96, 2);
    expect(avrenningFraVannforing(q, 85)).toBeCloseTo(1100, 8);
    expect(spesifikkAvrenning(q, 85)).toBeCloseTo((q * 1000) / 85, 10);
    expect(vannforingFraAvrenning(1100, 0)).toBeNull();
    expect(avrenningFraVannforing(1, -2)).toBeNull();
  });
});

describe('grunnvann', () => {
  it('har materialer med K over mange tierpotenser og fornuftige porøsiteter', () => {
    expect(grunnmateriale('grus')!.K).toBeCloseTo(1e-2, 12);
    expect(grunnmateriale('sand')!.K).toBeCloseTo(1e-4, 12);
    expect(grunnmateriale('silt')!.K).toBeCloseTo(1e-6, 12);
    expect(grunnmateriale('leire')!.K).toBeCloseTo(1e-9, 15);
    const fjell = grunnmateriale('oppsprukket-fjell')!;
    expect(fjell.kMin).toBeCloseTo(1e-7, 15);
    expect(fjell.kMax).toBeCloseTo(1e-5, 15);
    for (const m of MATERIALER) {
      expect(m.kMin).toBeLessThanOrEqual(m.K);
      expect(m.K).toBeLessThanOrEqual(m.kMax);
      expect(m.effektivPorositet).toBeGreaterThan(0);
      expect(m.effektivPorositet).toBeLessThanOrEqual(m.porositet);
      expect(m.porositet).toBeLessThan(1);
    }
  });

  it('følger Darcys lov, q = K · i, og porefarten er større enn q', () => {
    expect(darcy(4e-4, 0.006)).toBeCloseTo(2.4e-6, 15);
    const q = darcy(1e-4, 0.01)!;
    const v = porefart(q, 0.25)!;
    expect(v).toBeGreaterThan(q);
    expect(v).toBeCloseTo(q / 0.25, 15);
    expect(darcy(1e-4, -0.01)!).toBeLessThan(0);
  });

  it('gir grunntallsettet i eks-bronn: ca. 0,83 m per døgn og ca. 480 døgn for 400 m', () => {
    const i = hydrauliskGradient(162.4, 160.9, 250)!;
    expect(i).toBeCloseTo(0.006, 12);
    const v = porefart(darcy(4e-4, i)!, 0.25)!;
    expect(mPerDogn(v)!).toBeCloseTo(0.83, 2);
    expect(reisetidFraFart(400, v)! / SEK_PER_DOGN).toBeGreaterThan(470);
    expect(reisetidFraFart(400, v)! / SEK_PER_DOGN).toBeLessThan(490);
    expect(mPerAar(v)! / mPerDogn(v)!).toBeCloseTo(365.25, 10);
  });

  it('gir mye lengre reisetid i leire enn i grus', () => {
    const tid = (id: 'grus' | 'leire') => {
      const m = grunnmateriale(id)!;
      return reisetidFraFart(100, porefart(darcy(m.K, 0.01)!, m.effektivPorositet)!)!;
    };
    expect(tid('leire') / tid('grus')).toBeGreaterThan(1e5);
  });

  it('gir aldri Infinity når avstanden, gradienten eller porøsiteten er 0', () => {
    expect(reisetidFraFart(0, 0)).toBe(0);
    expect(reisetidFraFart(100, 0)).toBeNull();
    expect(reisetidFraFart(100, -1)).toBeNull();
    expect(porefart(1e-6, 0)).toBeNull();
    expect(hydrauliskGradient(10, 9, 0)).toBeNull();
    expect(darcy(-1, 0.01)).toBeNull();
    expect(mPerDogn(Number.NaN)).toBeNull();
  });

  it('har en senkningstrakt som er 0 ved påvirkningsradien og øker inn mot brønnen', () => {
    const T = transmissivitet(1e-4, 20)!;
    expect(T).toBeCloseTo(2e-3, 12);
    const R = 300;
    expect(senkning(R, 0.01, T, R)).toBe(0);
    expect(senkning(R + 50, 0.01, T, R)).toBe(0);
    let forrige = 0;
    for (const r of [250, 150, 80, 30, 10, 1, 0.1]) {
      const s = senkning(r, 0.01, T, R)!;
      expect(s).toBeGreaterThan(forrige);
      forrige = s;
    }
    // Brønnradien er minste avstand, og negativ r er avstand på den andre siden
    expect(senkning(0, 0.01, T, R)).toBeCloseTo(senkning(0.1, 0.01, T, R)!, 12);
    expect(senkning(-80, 0.01, T, R)).toBeCloseTo(senkning(80, 0.01, T, R)!, 12);
    expect(senkning(10, 0.01, 0, R)).toBeNull();
    expect(senkning(10, 0.01, T, 0.05)).toBeNull();
  });

  it('gir en dyp, smal trakt i tette masser og en grunn, vid trakt i grus', () => {
    const t = 30 * SEK_PER_DOGN;
    const sand = { T: 1e-4 * 20, S: 0.25 };
    const grus = { T: 1e-2 * 20, S: 0.25 };
    const rSand = paavirkningsradius(sand.T, sand.S, t)!;
    const rGrus = paavirkningsradius(grus.T, grus.S, t)!;
    expect(rGrus).toBeGreaterThan(rSand);
    expect(senkning(1, 0.005, sand.T, rSand)!).toBeGreaterThan(senkning(1, 0.005, grus.T, rGrus)!);
    expect(paavirkningsradius(1, 0, t)).toBeNull();
  });
});

describe('flomfrekvens', () => {
  it('gir kjente sannsynligheter i en periode', () => {
    expect(sannsynlighetIPerioden(100, 100)).toBeCloseTo(0.634, 3);
    expect(sannsynlighetIPerioden(200, 50)).toBeCloseTo(0.222, 3);
    expect(sannsynlighetIPerioden(200, 1)).toBeCloseTo(0.005, 12);
    expect(sannsynlighetIPerioden(200, 0)).toBe(0);
    expect(sannsynlighetIPerioden(1, 5)).toBe(1);
    expect(sannsynlighetIPerioden(0.5, 5)).toBeNull();
    expect(sannsynlighetIPerioden(0, 5)).toBeNull();
    expect(sannsynlighetIPerioden(200, -1)).toBeNull();
  });

  it('har plotteposisjoner etter Weibull og Gringorten', () => {
    expect(plotteposisjon(1, 60)!.gjentaksintervall).toBeCloseTo(61, 10);
    expect(plotteposisjon(1, 60, 'gringorten')!.gjentaksintervall).toBeCloseTo(60.12 / 0.56, 8);
    expect(plotteposisjon(0, 60)).toBeNull();
    expect(plotteposisjon(61, 60)).toBeNull();
    const p = plotteposisjoner([120, 300, 180])!;
    expect(p.map((x) => x.verdi)).toEqual([300, 180, 120]);
    expect(p.map((x) => x.rang)).toEqual([1, 2, 3]);
    expect(p[0]!.gjentaksintervall).toBeCloseTo(4, 12);
    expect(plotteposisjoner([])).toBeNull();
  });

  it('finner Gumbel-parameterne igjen fra en lang syntetisk serie', () => {
    const rand = seededRandom(42);
    const u = 250;
    const alfa = 60;
    const serie = Array.from({ length: 20_000 }, () => u - alfa * Math.log(-Math.log(Math.max(1e-12, rand()))));
    const g = gumbelTilpasning(serie)!;
    expect(Math.abs(g.u - u) / u).toBeLessThan(0.02);
    expect(Math.abs(g.alfa - alfa) / alfa).toBeLessThan(0.03);
  });

  it('gir større flom for lengre gjentaksintervall, og null for T ≤ 1', () => {
    const g = { u: 250, alfa: 60 };
    let forrige = -Infinity;
    for (const T of [1.01, 2, 10, 50, 200, 1000, 10_000]) {
      const q = flomMedGjentaksintervall(g, T)!;
      expect(q).toBeGreaterThan(forrige);
      forrige = q;
    }
    expect(flomMedGjentaksintervall(g, 2)).toBeCloseTo(250 - 60 * Math.log(Math.LN2), 10);
    expect(flomMedGjentaksintervall(g, 1)).toBeNull();
    expect(flomMedGjentaksintervall(g, 0.5)).toBeNull();
    expect(flomMedGjentaksintervall(g, Number.NaN)).toBeNull();
  });

  it('har gjentaksintervall som den omvendte, og klimapåslag gjør flommen vanligere', () => {
    const g = { u: 250, alfa: 60 };
    const q200 = flomMedGjentaksintervall(g, 200)!;
    expect(gjentaksintervall(g, q200)).toBeCloseTo(200, 6);
    expect(KLIMAPASLAG).toEqual([0, 20, 40]);
    const medPaslag = { u: medKlimapaslag(g.u, 20)!, alfa: medKlimapaslag(g.alfa, 20)! };
    expect(gjentaksintervall(medPaslag, q200)!).toBeLessThan(200);
    expect(gjentaksintervall(g, 1e9)).toBeNull();
    expect(gjentaksintervall({ u: 1, alfa: 0 }, 2)).toBeNull();
  });

  it('gir null for for korte serier', () => {
    expect(gumbelTilpasning([100])).toBeNull();
    expect(gumbelTilpasning([])).toBeNull();
    const like = gumbelTilpasning([100, 100, 100])!;
    expect(like.alfa).toBe(0);
    expect(flomMedGjentaksintervall(like, 200)).toBe(100);
  });
});

describe('reisetidDarcy', () => {
  it('gir døgn fra K, gradienten og porøsiteten, som reisetidFraFart med porefarten', () => {
    const sand = MATERIALER.find((m) => m.id === 'sand')!;
    const v = porefart(darcy(sand.K, 0.01)!, sand.effektivPorositet)!;
    expect(reisetidDarcy(60, 0.01, sand.K, sand.effektivPorositet)).toBeCloseTo(reisetidFraFart(60, v)! / SEK_PER_DOGN, 6);
    expect(reisetidDarcy(60, 0.01, 1e-4, 0.25)).toBeCloseTo(173.6, 0);
  });
  it('gir 0 for L = 0 og null der vannet aldri kommer fram', () => {
    expect(reisetidDarcy(0, 0.01, 1e-4, 0.25)).toBe(0);
    expect(reisetidDarcy(60, 0, 1e-4, 0.25)).toBeNull();
    expect(reisetidDarcy(60, 0.01, 0, 0.25)).toBeNull();
    expect(reisetidDarcy(60, 0.01, 1e-4, 0)).toBeNull();
    expect(reisetidDarcy(Number.NaN, 0.01, 1e-4, 0.25)).toBeNull();
    expect(reisetidDarcy(-5, 0.01, 1e-4, 0.25)).toBeNull();
  });
  it('har et eget løsmassemønster for silt', () => {
    expect(MATERIALER.find((m) => m.id === 'silt')!.monster).toBe('silt');
  });
});

