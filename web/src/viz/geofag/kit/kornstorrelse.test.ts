import { describe, expect, it } from 'vitest';
import {
  avsetningsfart,
  dFraPhi,
  dPersentil,
  erosjonsfart,
  fraksjonsandeler,
  gjennomgangVed,
  gradering,
  graderingstall,
  HJULSTROM_AVSETNING,
  HJULSTROM_EROSJON,
  klassifiserLosmasse,
  KORNKLASSER,
  kornklasse,
  kornTilstand,
  krumningstall,
  kumulativKurve,
  lognormalKurve,
  phi,
  sortering,
  sorteringsklasse,
  SORTERINGSKLASSER,
  synkefart,
  transportform,
  type KornTilstand,
} from './kornstorrelse';

/** Logaritmisk jevnt fordelte diametre fra 0,001 til 1000 mm. */
const diametre = Array.from({ length: 241 }, (_, i) => 10 ** (-3 + (6 * i) / 240));

describe('kornklasser og φ', () => {
  it('har NGUs grenser uten hull', () => {
    expect(KORNKLASSER.map((k) => k.id)).toEqual(['leire', 'silt', 'sand', 'grus', 'stein', 'blokk']);
    expect(KORNKLASSER.map((k) => k.max)).toEqual([0.002, 0.063, 2, 64, 256, null]);
    for (let i = 1; i < KORNKLASSER.length; i++) expect(KORNKLASSER[i]!.min).toBe(KORNKLASSER[i - 1]!.max);
  });

  it('plasserer korn i riktig klasse på begge sider av grensene', () => {
    expect(kornklasse(0.0019)).toBe('leire');
    expect(kornklasse(0.002)).toBe('silt');
    expect(kornklasse(0.0629)).toBe('silt');
    expect(kornklasse(0.063)).toBe('sand');
    expect(kornklasse(1.99)).toBe('sand');
    expect(kornklasse(2)).toBe('grus');
    expect(kornklasse(64)).toBe('stein');
    expect(kornklasse(300)).toBe('blokk');
    expect(kornklasse(0)).toBeNull();
    expect(kornklasse(-1)).toBeNull();
    expect(kornklasse(Number.NaN)).toBeNull();
  });

  it('regner φ = −log₂ d og tilbake', () => {
    expect(phi(1)).toBe(-0);
    expect(phi(0.25)).toBeCloseTo(2, 12);
    expect(phi(4)).toBeCloseTo(-2, 12);
    expect(phi(0.002)).toBeCloseTo(8.97, 2);
    for (const d of [0.001, 0.063, 2, 256]) expect(dFraPhi(phi(d)!)).toBeCloseTo(d, 10);
    expect(phi(0)).toBeNull();
    expect(dFraPhi(Number.NaN)).toBeNull();
  });
});

describe('Hjulströms diagram (avleste kurver, med toleranser)', () => {
  it('har tabeller sortert etter diameter med positive farter', () => {
    for (const tabell of [HJULSTROM_EROSJON, HJULSTROM_AVSETNING]) {
      for (let i = 1; i < tabell.length; i++) expect(tabell[i]![0]).toBeGreaterThan(tabell[i - 1]![0]);
      for (const [, v] of tabell) expect(v).toBeGreaterThan(0);
    }
  });

  it('har minimum på erosjonskurven for korn på 0,1–0,5 mm ved 0,15–0,35 m/s', () => {
    let best = { d: 0, v: Infinity };
    for (const d of diametre) {
      const v = erosjonsfart(d)!;
      if (v < best.v) best = { d, v };
    }
    expect(best.d).toBeGreaterThanOrEqual(0.1);
    expect(best.d).toBeLessThanOrEqual(0.5);
    expect(best.v).toBeGreaterThanOrEqual(0.15);
    expect(best.v).toBeLessThanOrEqual(0.35);
  });

  it('stemmer med lærebokverdiene innen 30 %', () => {
    // Earle 2019: erosjon 0,60 m/s ved 0,01 mm, 0,20 ved 1 mm og 1,05 ved 10 mm; avsetning 0,001, 0,10 og 0,80 m/s.
    const innen = (verdi: number | null, fasit: number) => {
      expect(verdi).not.toBeNull();
      expect(verdi!).toBeGreaterThan(fasit * 0.7);
      expect(verdi!).toBeLessThan(fasit * 1.3);
    };
    innen(erosjonsfart(0.01), 0.6);
    innen(erosjonsfart(1), 0.2);
    innen(erosjonsfart(10), 1.05);
    innen(avsetningsfart(0.01), 0.001);
    innen(avsetningsfart(1), 0.1);
    innen(avsetningsfart(10), 0.8);
  });

  it('treffer også mellom radene i tabellen (avlest, omtrentlig) og har minimum på erosjonskurven ved 0,2–0,5 mm', () => {
    // Uavhengig avlest fra Hjulström-diagrammet (Hjulström 1935, slik det gjengis i lærebøkene, f.eks. Earle 2019,
    // figur 13.7): erosjon ca. 0,28 m/s ved 0,05 mm, 0,18 ved 0,3 mm og 0,45 ved 3 mm; avsetning ca. 0,005 m/s ved
    // 0,05 mm, 0,03 ved 0,3 mm og 0,3 ved 3 mm. Avlesningen er grov, så toleransen er 35 %.
    const innen = (verdi: number | null, fasit: number) => {
      expect(verdi).not.toBeNull();
      expect(verdi!).toBeGreaterThan(fasit * 0.65);
      expect(verdi!).toBeLessThan(fasit * 1.35);
    };
    innen(erosjonsfart(0.05), 0.28);
    innen(erosjonsfart(0.3), 0.18);
    innen(erosjonsfart(3), 0.45);
    innen(avsetningsfart(0.05), 0.005);
    innen(avsetningsfart(0.3), 0.03);
    innen(avsetningsfart(3), 0.3);
    // Minimum på erosjonskurven: fin og middels sand er lettest å erodere
    let dMin = 0;
    let vMin = Infinity;
    for (let e = -3; e <= 3; e += 0.01) {
      const d = 10 ** e;
      const v = erosjonsfart(d)!;
      if (v < vMin) {
        vMin = v;
        dMin = d;
      }
    }
    expect(dMin).toBeGreaterThanOrEqual(0.2);
    expect(dMin).toBeLessThanOrEqual(0.5);
  });

  it('krever større fart for å erodere leire enn fin sand', () => {
    expect(erosjonsfart(0.001)!).toBeGreaterThan(erosjonsfart(0.3)!);
    expect(erosjonsfart(0.001)!).toBeGreaterThan(3 * erosjonsfart(0.3)!);
  });

  it('har avsetningsfart lavere enn erosjonsfart overalt', () => {
    for (const d of diametre) expect(avsetningsfart(d)!).toBeLessThan(erosjonsfart(d)!);
  });

  it('lar avsetningsfarten øke med kornstørrelsen', () => {
    for (let i = 1; i < diametre.length; i++) expect(avsetningsfart(diametre[i]!)!).toBeGreaterThanOrEqual(avsetningsfart(diametre[i - 1]!)!);
  });

  it('skiller mellom korn i ro og korn i bevegelse i mellomsonen', () => {
    const d = 0.3;
    const v = (erosjonsfart(d)! + avsetningsfart(d)!) / 2;
    expect(kornTilstand(d, v, false)).toBe('ligger');
    expect(kornTilstand(d, v, true)).toBe('transporteres');
    // Leire: blir liggende ved 0,5 m/s, men fraktes videre hvis den alt er i bevegelse.
    expect(kornTilstand(0.001, 0.5, false)).toBe('ligger');
    expect(kornTilstand(0.001, 0.5, true)).toBe('transporteres');
  });

  it('eroderer over erosjonskurven og avsetter under avsetningskurven', () => {
    expect(kornTilstand(0.3, 0.5, false)).toBe('eroderes');
    expect(kornTilstand(0.3, 0.5, true)).toBe('transporteres');
    expect(kornTilstand(0.3, 0.001, true)).toBe('avsettes');
    expect(kornTilstand(0.3, 0.001, false)).toBe('ligger');
    expect(kornTilstand(0.3, erosjonsfart(0.3)!, false)).toBe('eroderes');
    expect(kornTilstand(0.3, 0, true)).toBe('avsettes');
  });

  it('gir én entydig tilstand for hver kombinasjon av d, v og bevegelse', () => {
    const gyldige: KornTilstand[] = ['ligger', 'eroderes', 'transporteres', 'avsettes'];
    for (const d of diametre.filter((_, i) => i % 8 === 0)) {
      for (const v of [0, 1e-5, 0.001, 0.01, 0.1, 0.2, 0.5, 1, 3, 10, 30]) {
        const ro = kornTilstand(d, v, false);
        const bev = kornTilstand(d, v, true);
        expect(gyldige).toContain(ro);
        expect(gyldige).toContain(bev);
        expect(['ligger', 'eroderes']).toContain(ro);
        expect(['transporteres', 'avsettes']).toContain(bev);
      }
    }
  });

  it('er endelig ved ytterpunktene og gir null for ugyldige tall', () => {
    for (const d of [1e-9, 1e-3, 1e3, 1e9]) {
      expect(Number.isFinite(erosjonsfart(d)!)).toBe(true);
      expect(Number.isFinite(avsetningsfart(d)!)).toBe(true);
    }
    expect(erosjonsfart(0)).toBeNull();
    expect(avsetningsfart(-1)).toBeNull();
    expect(kornTilstand(0, 1, false)).toBeNull();
    expect(kornTilstand(1, -0.1, false)).toBeNull();
    expect(kornTilstand(1, Number.NaN, true)).toBeNull();
  });
});

describe('synkefart og transportform', () => {
  it('følger Stokes for fine korn', () => {
    const d = 0.004;
    const stokes = (1.65 * 9.81 * (d / 1000) ** 2) / (18 * 1e-6);
    expect(synkefart(d)!).toBeCloseTo(stokes, 7);
    expect(synkefart(d)! / stokes).toBeGreaterThan(0.99);
  });

  it('gir lærebokverdier for sand og øker med kornstørrelsen', () => {
    expect(synkefart(1)!).toBeGreaterThan(0.1);
    expect(synkefart(1)!).toBeLessThan(0.16);
    for (let i = 1; i < diametre.length; i++) expect(synkefart(diametre[i]!)!).toBeGreaterThan(synkefart(diametre[i - 1]!)!);
    expect(Number.isFinite(synkefart(1e6)!)).toBe(true);
    expect(synkefart(0)).toBeNull();
    expect(synkefart(1, { tetthet: 900 })).toBe(0);
  });

  it('lar leire sveve og grus gå langs bunnen', () => {
    expect(transportform(0.002, 0.5)).toBe('svevende');
    expect(transportform(10, 1.5)).toBe('langs-bunnen');
    expect(transportform(0.2, 2)).toBe('svevende');
    expect(transportform(0.2, -1)).toBeNull();
  });
});

describe('kornfordelingskurve fra sikteanalyse', () => {
  const sikter = [16, 8, 4, 2, 1, 0.5, 0.25, 0.125, 0.063];
  // Breelvsand: mest på 0,25–1 mm
  const masser = [0, 5, 12, 30, 120, 260, 310, 150, 40];
  const bunn = 23;

  it('er monoton, sortert fra fin til grov og ender på 100 %', () => {
    const k = kumulativKurve(sikter, masser, bunn)!;
    expect(k.map((p) => p.d)).toEqual([...sikter].reverse());
    for (let i = 1; i < k.length; i++) expect(k[i]!.gjennomgang).toBeGreaterThanOrEqual(k[i - 1]!.gjennomgang);
    expect(k[k.length - 1]!.gjennomgang).toBe(100);
    const total = masser.reduce((s, m) => s + m, 0) + bunn;
    expect(k[0]!.gjennomgang).toBeCloseTo((100 * bunn) / total, 10);
  });

  it('når ikke 100 % når noe ble liggende på den groveste sikten', () => {
    const k = kumulativKurve([4, 2, 1], [10, 30, 60])!;
    expect(k[k.length - 1]!.gjennomgang).toBeCloseTo(90, 10);
    expect(k[0]!.gjennomgang).toBe(0);
  });

  it('godtar siktene i vilkårlig rekkefølge', () => {
    const a = kumulativKurve(sikter, masser, bunn)!;
    const b = kumulativKurve([...sikter].reverse(), [...masser].reverse(), bunn)!;
    expect(b).toEqual(a);
  });

  it('gir null for ugyldige data', () => {
    expect(kumulativKurve([], [])).toBeNull();
    expect(kumulativKurve([2, 1], [5])).toBeNull();
    expect(kumulativKurve([2, 0], [5, 5])).toBeNull();
    expect(kumulativKurve([2, 2], [5, 5])).toBeNull();
    expect(kumulativKurve([2, 1], [5, -1])).toBeNull();
    expect(kumulativKurve([2, 1], [0, 0], 0)).toBeNull();
    expect(kumulativKurve([2, 1], [1, 1], Number.NaN)).toBeNull();
  });

  it('leser d50 mellom siktene der kurven krysser 50 %', () => {
    const k = kumulativKurve(sikter, masser, bunn)!;
    const d50 = dPersentil(k, 50)!;
    const under = k.filter((p) => p.gjennomgang < 50);
    const over = k.filter((p) => p.gjennomgang >= 50);
    expect(d50).toBeGreaterThan(under[under.length - 1]!.d);
    expect(d50).toBeLessThanOrEqual(over[0]!.d);
    expect(gjennomgangVed(k, d50)).toBeCloseTo(50, 8);
  });

  it('gir null for d10 når mer enn 10 % går gjennom den minste sikten', () => {
    const k = kumulativKurve([2, 0.5, 0.063], [10, 40, 30], 20)!;
    expect(dPersentil(k, 10)).toBeNull();
    expect(graderingstall(k)).toBeNull();
    expect(krumningstall(k)).toBeNull();
    expect(dPersentil(k, 50)).not.toBeNull();
    expect(dPersentil(k, 101)).toBeNull();
    expect(dPersentil(k, Number.NaN)).toBeNull();
  });
});

describe('lognormale kurver, graderingstall og sortering', () => {
  it('gir et graderingstall nær 1 for et ensgradert materiale', () => {
    const k = lognormalKurve(0.3, 0.1)!;
    const cu = graderingstall(k)!;
    expect(cu).toBeGreaterThanOrEqual(1);
    expect(cu).toBeLessThan(1.2);
    expect(gradering(cu)).toBe('ensgradert');
    expect(krumningstall(k)!).toBeCloseTo(1, 1);
  });

  it('gir velgradert morene og ensgradert breelvsand', () => {
    const morene = lognormalKurve(0.5, 3)!;
    const breelvsand = lognormalKurve(0.4, 0.6)!;
    expect(graderingstall(morene)!).toBeGreaterThan(15);
    expect(gradering(graderingstall(morene)!)).toBe('velgradert');
    expect(graderingstall(breelvsand)!).toBeLessThan(6);
    expect(sortering(morene)!.klasse).toBe('svaert-darlig');
    expect(['moderat-godt', 'godt']).toContain(sortering(breelvsand)!.klasse);
  });

  it('finner σ igjen med Folk og Ward', () => {
    for (const s of [0.3, 0.6, 1, 2]) {
      const sort = sortering(lognormalKurve(0.25, s)!)!;
      expect(sort.metode).toBe('inklusiv');
      expect(sort.sigma).toBeCloseTo(s, 1);
      expect(Math.abs(sort.sigma - s) / s).toBeLessThan(0.03);
      expect(sort.middelD).toBeCloseTo(0.25, 2);
    }
  });

  it('har sortering uavhengig av middelkornstørrelsen', () => {
    const a = sortering(lognormalKurve(0.05, 1.2)!)!;
    const b = sortering(lognormalKurve(20, 1.2)!)!;
    expect(a.sigma).toBeCloseTo(b.sigma, 6);
    expect(a.klasse).toBe(b.klasse);
  });

  it('bruker den enkle formelen når 5 % eller 95 % ligger utenfor siktene', () => {
    const k = lognormalKurve(0.3, 1, [0.125, 0.25, 0.5, 1])!;
    const s = sortering(k)!;
    expect(s.metode).toBe('enkel');
    expect(s.sigma).toBeGreaterThan(0.8);
    expect(s.sigma).toBeLessThan(1.2);
  });

  it('har Folk og Wards klassegrenser', () => {
    expect(SORTERINGSKLASSER.map((k) => k.max)).toEqual([0.35, 0.5, 0.71, 1, 2, 4, null]);
    expect(sorteringsklasse(0.34)!.navn).toBe('svært godt sortert');
    expect(sorteringsklasse(0.35)!.id).toBe('godt');
    expect(sorteringsklasse(1)!.navn).toBe('dårlig sortert');
    expect(sorteringsklasse(5)!.id).toBe('ekstremt-darlig');
    expect(sorteringsklasse(-1)).toBeNull();
    expect(gradering(0.5)).toBeNull();
    expect(gradering(10)).toBe('mellomgradert');
  });

  it('gir null for ugyldige kurver', () => {
    expect(lognormalKurve(0, 1)).toBeNull();
    expect(lognormalKurve(1, 0)).toBeNull();
    expect(lognormalKurve(1, 1, [1, -2])).toBeNull();
    expect(sortering([])).toBeNull();
    expect(dPersentil([], 50)).toBeNull();
  });
});

describe('fraksjoner og navn på løsmassen', () => {
  it('summerer klassene til 100 % når kurven dekker alt', () => {
    const k = lognormalKurve(0.3, 1.5, [0.0005, 0.002, 0.063, 2, 64, 256, 1000])!;
    // Gjør endene til 0 og 100, så alle klassene er kjent
    k[0] = { d: k[0]!.d, gjennomgang: 0 };
    k[k.length - 1] = { d: k[k.length - 1]!.d, gjennomgang: 100 };
    const a = fraksjonsandeler(k)!;
    const sum = Object.values(a.klasser).reduce<number>((s, v) => s + (v ?? Number.NaN), 0);
    expect(sum).toBeCloseTo(100, 8);
    expect(a.klasser.sand!).toBeGreaterThan(50);
    expect(a.finstoff).toBeCloseTo(a.klasser.leire! + a.klasser.silt!, 8);
  });

  it('kan ikke dele finstoffet uten slemmeanalyse', () => {
    const k = kumulativKurve([16, 8, 4, 2, 1, 0.5, 0.25, 0.125, 0.063], [0, 5, 12, 30, 120, 260, 310, 150, 40], 23)!;
    const a = fraksjonsandeler(k)!;
    expect(a.klasser.leire).toBeNull();
    expect(a.klasser.silt).toBeNull();
    expect(a.finstoff!).toBeGreaterThan(0);
    const navn = klassifiserLosmasse(k)!;
    expect(navn.hoved).toBe('sand');
    expect(navn.navn).toBe('sand');
    expect(navn.merknad).toMatch(/slemmeanalyse/);
  });

  it('setter tilleggsordene foran hovedordet, den største nærmest', () => {
    // 50 % grus, 30 % sand, 20 % finstoff
    const k = kumulativKurve([64, 2, 0.063], [0, 50, 30], 20)!;
    expect(klassifiserLosmasse(k)!.navn).toBe('sandig grus med mye finstoff');
    const k2 = lognormalKurve(0.3, 0.3, [0.0001, 0.002, 0.063, 2, 64, 300])!;
    expect(klassifiserLosmasse(k2)!.navn).toBe('sand');
  });
});
