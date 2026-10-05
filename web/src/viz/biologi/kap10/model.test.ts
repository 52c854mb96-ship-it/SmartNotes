import { describe, expect, it } from 'vitest';
import {
  ANIMALS,
  D_AIR,
  D_TISSUE,
  GAS_STRATEGIES,
  MIN_VENOUS_SAT,
  O2_AIR,
  O2_WATER,
  RC_SKIN,
  RC_TRACHEA,
  SIZE_MAX_EXP,
  SIZE_MIN_EXP,
  SIZE_REFERENCES,
  anoxicCore,
  chamberText,
  circuit,
  concurrentLimit,
  diffusionTime,
  extraction,
  formatDuration,
  formatMeters,
  getAnimal,
  getStrategy,
  gillProfile,
  locate,
  maxDiameter,
  maxPressure,
  o2At,
  o2Coverage,
  oxygenDelivery,
  pointAlong,
  polylineLength,
  pressureProfile,
  saturations,
  segmentSpans,
  surfacePerVolume,
  HUMAN_LUNG_AREA,
  HUMAN_SKIN_AREA,
} from './model';

describe('geometri', () => {
  it('lengde og punkt langs en brutt linje', () => {
    const pts = [
      [0, 0],
      [3, 0],
      [3, 4],
    ] as const;
    expect(polylineLength(pts)).toBe(7);
    expect(pointAlong(pts, 0)).toEqual([0, 0]);
    expect(pointAlong(pts, 3 / 7)).toEqual([3, 0]);
    const [x, y] = pointAlong(pts, 5 / 7);
    expect(x).toBeCloseTo(3);
    expect(y).toBeCloseTo(2);
    expect(pointAlong(pts, 1)).toEqual([3, 4]);
  });

  it('finner riktig del av kretsløpet og går rundt', () => {
    expect(locate([1, 1, 2], 0.1).index).toBe(0);
    expect(locate([1, 1, 2], 0.1).local).toBeCloseTo(0.4, 9);
    expect(locate([1, 1, 2], 0.6).index).toBe(2);
    expect(locate([1, 1, 2], 1.1).local).toBeCloseTo(locate([1, 1, 2], 0.1).local, 9);
    expect(locate([1, 1, 2], -0.9).index).toBe(0);
  });
});

describe('blodkretsløp', () => {
  it('hjerterom som i læreboka', () => {
    expect(chamberText(getAnimal('fisk'))).toBe('1 forkammer og 1 hjertekammer');
    expect(chamberText(getAnimal('amfibie'))).toBe('2 forkamre og 1 hjertekammer');
    expect(chamberText(getAnimal('pattedyr'))).toBe('2 forkamre og 2 hjertekamre');
    expect(getAnimal('insekt').system).toBe('åpent');
    expect(getAnimal('fisk').system).toBe('enkelt');
  });

  it('bare fugler og pattedyr er endoterme og har helt atskilt blod', () => {
    for (const a of ANIMALS) {
      expect(a.endotherm).toBe(a.id === 'pattedyr');
      if (a.id === 'pattedyr' || a.system !== 'dobbelt') expect(a.mixing).toBe(0);
    }
    // Mer blanding hos amfibier enn hos krypdyr (delvis skillevegg)
    expect(getAnimal('amfibie').mixing).toBeGreaterThan(getAnimal('krypdyr').mixing);
  });

  it('ekstraksjonen øker med aktivitet', () => {
    expect(extraction(0)).toBeCloseTo(0.25);
    expect(extraction(1)).toBeCloseTo(0.7);
    expect(extraction(2)).toBeCloseTo(0.7);
  });

  it('uten blanding får kroppen blod rett fra lungene', () => {
    const s = saturations(getAnimal('pattedyr'), 0);
    expect(s.arterial).toBeCloseTo(0.97);
    expect(s.venous).toBeCloseTo(0.72);
    expect(s.toGas).toBeCloseTo(s.venous);
  });

  it('blanding gir lavere metning til kroppen: a = L − mE/(1 − m)', () => {
    const frog = getAnimal('amfibie');
    const s = saturations(frog, 0);
    expect(s.arterial).toBeCloseTo(0.9 - (0.35 * 0.25) / 0.65, 6);
    // Likevekt: arterieblodet er en blanding av blod fra lungene og fra kroppen
    expect(s.arterial).toBeCloseTo((1 - frog.mixing) * s.gasOut + frog.mixing * s.venous, 9);
    expect(s.toGas).toBeGreaterThan(s.venous);
    const lizard = saturations(getAnimal('krypdyr'), 0);
    expect(lizard.arterial).toBeGreaterThan(s.arterial);
    expect(lizard.arterial).toBeLessThan(saturations(getAnimal('pattedyr'), 0).arterial);
  });

  it('metningen holder seg mellom 0 og 1, også ved hardt arbeid', () => {
    for (const a of ANIMALS)
      for (const act of [0, 0.5, 1]) {
        const s = saturations(a, act);
        for (const v of [s.arterial, s.venous, s.toGas, s.gasOut]) {
          expect(v).toBeGreaterThanOrEqual(0);
          expect(v).toBeLessThanOrEqual(1);
        }
        if (a.system !== 'åpent') {
          expect(s.venous).toBeGreaterThanOrEqual(MIN_VENOUS_SAT - 1e-12);
          expect(s.arterial).toBeGreaterThan(s.venous);
        }
      }
  });

  it('fisk: hjertet pumper bare oksygenfattig blod', () => {
    const fish = circuit(getAnimal('fisk'), 0);
    const heart = fish.find((g) => g.id === 'kammer')!;
    expect(heart.s0).toBeLessThan(0.8);
    expect(heart.s1).toBe(heart.s0);
  });

  it('kretsløpet henger sammen: trykk og metning er kontinuerlige og går rundt', () => {
    for (const a of ANIMALS) {
      const c = circuit(a, 0.3);
      for (let i = 0; i < c.length; i++) {
        const cur = c[i]!;
        const next = c[(i + 1) % c.length]!;
        expect(next.p0).toBeCloseTo(cur.p1, 6);
        expect(next.s0).toBeCloseTo(cur.s1, 6);
      }
    }
  });

  it('trykket stiger bare i pumpene', () => {
    for (const a of ANIMALS)
      for (const g of circuit(a, 0)) if (g.kind !== 'pumpe' && g.kind !== 'vene') expect(g.p1).toBeLessThanOrEqual(g.p0 + 1e-9);
  });

  it('dobbelt kretsløp med to hjertekamre: høyt trykk til kroppen, lavt til lungene', () => {
    const c = circuit(getAnimal('pattedyr'), 0);
    expect(c.find((g) => g.id === 'aorta')!.p0).toBeGreaterThan(80);
    expect(c.find((g) => g.id === 'lungearterie')!.p0).toBeLessThan(20);
    expect(maxPressure(c)).toBe(95);
    // Enkelt kretsløp: trykket til kroppen er lavere enn ut fra hjertet (fall i gjellene)
    const f = circuit(getAnimal('fisk'), 0);
    expect(f.find((g) => g.id === 'ryggaorta')!.p0).toBeLessThan(f.find((g) => g.id === 'bukaorta')!.p0);
  });

  it('trykkprofilen går fra 0 til 1 og er sammenhengende', () => {
    for (const a of ANIMALS) {
      const c = circuit(a, 0);
      const p = pressureProfile(c);
      expect(p[0]![0]).toBe(0);
      expect(p[p.length - 1]![0]).toBeCloseTo(1, 9);
      for (let i = 1; i < p.length; i++) expect(p[i]![0]).toBeGreaterThanOrEqual(p[i - 1]![0]);
      const spans = segmentSpans(c);
      expect(spans[spans.length - 1]!.end).toBeCloseTo(1, 9);
    }
  });

  it('pattedyret leverer mest O₂ til kroppen', () => {
    const best = oxygenDelivery(getAnimal('pattedyr'), 1);
    for (const a of ANIMALS) expect(oxygenDelivery(a, 1)).toBeLessThanOrEqual(best + 1e-9);
    expect(oxygenDelivery(getAnimal('insekt'), 0)).toBe(0);
  });
});

describe('motstrøm og medstrøm i gjellene', () => {
  it('medstrøm: blodet når høyst snittet (50 % med blod uten O₂)', () => {
    const p = gillProfile({ flow: 'medstrom', length: 5, bloodIn: 0 });
    expect(p.bloodOut).toBeCloseTo(50, 3);
    expect(p.waterOut).toBeCloseTo(50, 3);
    expect(p.utilization).toBeCloseTo(0.5, 3);
    expect(concurrentLimit(100, 20)).toBe(60);
    // Blodet kan aldri bli mer mettet enn vannet ved samme punkt
    for (let x = 0; x <= 1; x += 0.1) expect(p.blood(x)).toBeLessThanOrEqual(p.water(x) + 1e-9);
  });

  it('motstrøm med like kapasiteter: konstant forskjell (W − B)/(1 + NTU)', () => {
    const p = gillProfile({ flow: 'motstrom', length: 0.625, bloodIn: 20 }); // NTU = 5
    const delta = 80 / 6;
    for (const x of [0, 0.3, 0.7, 1]) expect(p.water(x) - p.blood(x)).toBeCloseTo(delta, 6);
    expect(p.bloodOut).toBeCloseTo(100 - delta, 6);
    expect(p.blood(1)).toBeCloseTo(20, 6);
  });

  it('motstrøm gir mye mer O₂ i blodet enn medstrøm', () => {
    for (const length of [0.2, 0.5, 1])
      for (const bloodIn of [0, 20, 50]) {
        const mot = gillProfile({ flow: 'motstrom', length, bloodIn });
        const med = gillProfile({ flow: 'medstrom', length, bloodIn });
        expect(mot.bloodOut).toBeGreaterThan(med.bloodOut);
        expect(mot.utilization).toBeGreaterThan(med.utilization);
      }
    const long = gillProfile({ flow: 'motstrom', length: 1, bloodIn: 10 });
    expect(long.bloodOut).toBeGreaterThan(88);
  });

  it('bevaring: O₂ vannet gir fra seg, tar blodet opp (også med ulike kapasiteter)', () => {
    for (const flow of ['motstrom', 'medstrom'] as const)
      for (const ratio of [0.5, 1, 2]) {
        const p = gillProfile({ flow, length: 0.6, bloodIn: 25, ratio });
        // C_v · (W_inn − W_ut) = C_b · (B_ut − B_inn), med C_v/C_b = ratio
        expect(ratio * (100 - p.waterOut)).toBeCloseTo(p.bloodOut - 25, 6);
      }
  });

  it('kort lamell: nesten ingen utveksling; ingen lamell: ingen', () => {
    const p = gillProfile({ flow: 'motstrom', length: 0, bloodIn: 30 });
    expect(p.bloodOut).toBeCloseTo(30, 9);
    expect(p.waterOut).toBeCloseTo(100, 9);
  });
});

describe('gassutveksling og kroppsstørrelse', () => {
  it('luft har ca. 30 ganger mer O₂ enn vann, og O₂ diffunderer 10 000 ganger raskere', () => {
    expect(O2_AIR / O2_WATER).toBeGreaterThan(25);
    expect(O2_AIR / O2_WATER).toBeLessThan(35);
    expect(D_AIR / D_TISSUE).toBe(10000);
  });

  it('bare diffusjon gjennom huden: høyst ca. 1,5 mm tykk kropp', () => {
    expect(RC_SKIN * 1000).toBeGreaterThan(0.6);
    expect(RC_SKIN * 1000).toBeLessThan(0.9);
    expect(maxDiameter(getStrategy('hud')) * 1000).toBeCloseTo(1.47, 1);
  });

  it('trakeer: noen få cm', () => {
    expect(RC_TRACHEA * 100).toBeGreaterThan(2);
    expect(RC_TRACHEA * 100).toBeLessThan(4);
  });

  it('kjernen uten O₂ vokser med størrelsen', () => {
    expect(anoxicCore(RC_SKIN, RC_SKIN)).toBe(0);
    expect(anoxicCore(RC_SKIN * 0.5, RC_SKIN)).toBe(0);
    const a = anoxicCore(RC_SKIN * 2, RC_SKIN);
    const b = anoxicCore(RC_SKIN * 10, RC_SKIN);
    expect(a).toBeGreaterThan(0);
    expect(b).toBeGreaterThan(a);
    expect(b).toBeLessThan(1);
    // 3s² − 2s³ = 1 − (R_c/R)²
    expect(3 * a * a - 2 * a ** 3).toBeCloseTo(1 - 1 / 4, 6);
  });

  it('O₂-profilen er 1 ved overflaten, 0 i kjernen og jevn ved kanten av kjernen', () => {
    const R = RC_SKIN * 3;
    expect(o2At(R, RC_SKIN, 1)).toBeCloseTo(1, 9);
    expect(o2At(R, RC_SKIN, 0)).toBe(0);
    const s = anoxicCore(R, RC_SKIN);
    expect(o2At(R, RC_SKIN, s + 1e-4)).toBeLessThan(1e-4);
    // Liten kropp: O₂ i midten 1 − R²/R_c²
    expect(o2At(RC_SKIN / 2, RC_SKIN, 0)).toBeCloseTo(0.75, 9);
  });

  it('dekning: diffusjon alene svikter med størrelsen, blodkretsløp gjør det ikke', () => {
    const hud = getStrategy('hud');
    expect(o2Coverage(hud, 1e-3)).toBe(1);
    expect(o2Coverage(hud, 1e-2)).toBeLessThan(0.5);
    expect(o2Coverage(hud, 1)).toBeLessThan(0.01);
    expect(o2Coverage(getStrategy('trakeer'), 1e-2)).toBe(1);
    expect(o2Coverage(getStrategy('trakeer'), 0.3)).toBeLessThan(0.5);
    for (const id of ['gjeller', 'lunger', 'fuglelunger'] as const) expect(o2Coverage(getStrategy(id), 1)).toBe(1);
    for (const s of GAS_STRATEGIES) expect(s.needsBlood).toBe(!Number.isFinite(s.Rc));
  });

  it('fuglelunger har tynnest diffusjonsbarriere', () => {
    expect(getStrategy('fuglelunger').barrier!).toBeLessThan(getStrategy('lunger').barrier!);
    expect(getStrategy('lunger').barrier!).toBeLessThan(getStrategy('gjeller').barrier!);
  });

  it('diffusjonstid: dobbel avstand gir fire ganger så lang tid', () => {
    expect(diffusionTime(2e-3) / diffusionTime(1e-3)).toBeCloseTo(4, 9);
    expect(diffusionTime(1e-3)).toBeCloseTo(250, 6); // 1 mm: ca. 4 min
  });

  it('overflate per volum: 6/d, og ti ganger tykkere gir ti ganger mindre', () => {
    expect(surfacePerVolume(1e-3)).toBeCloseTo(6, 9); // 1 mm: 6 mm² per mm³
    expect(surfacePerVolume(3e-3)).toBeCloseTo(2, 9);
    expect(surfacePerVolume(1e-3) / surfacePerVolume(1e-2)).toBeCloseTo(10, 9);
    expect(surfacePerVolume(0)).toBe(Infinity);
    // Lungene gir mennesket rundt 40 ganger så stor flate som huden
    expect(HUMAN_LUNG_AREA / HUMAN_SKIN_AREA).toBeGreaterThan(30);
  });

  it('forhåndsvalgene er tykkelser, ikke lengder: humla trenger trakeer, ikke laksen', () => {
    const d = (name: string) => SIZE_REFERENCES.find((r) => r.name === name)!.d;
    // Et insekt på noen millimeter er for tykt for hudånding, men greit med trakeer
    expect(o2Coverage(getStrategy('hud'), d('humle'))).toBeLessThan(1);
    expect(o2Coverage(getStrategy('trakeer'), d('humle'))).toBe(1);
    // De største billene ligger rundt grensen for trakeer; en laks er langt over
    expect(d('stor bille')).toBeLessThan(maxDiameter(getStrategy('trakeer')));
    expect(o2Coverage(getStrategy('trakeer'), d('laks'))).toBeLessThan(1);
    for (const r of SIZE_REFERENCES) {
      expect(Math.log10(r.d)).toBeGreaterThanOrEqual(SIZE_MIN_EXP);
      expect(Math.log10(r.d)).toBeLessThanOrEqual(SIZE_MAX_EXP);
    }
  });

  it('formater lengder og tider', () => {
    expect(formatMeters(0.0005)).toBe('500 µm');
    expect(formatMeters(0.0015)).toBe('1,5 mm');
    expect(formatMeters(0.03)).toBe('3 cm');
    expect(formatMeters(0.3)).toBe('30 cm');
    expect(formatMeters(1)).toBe('1 m');
    expect(formatDuration(250)).toBe('4,2 min');
    expect(formatDuration(0.0625)).toBe('63 ms');
    expect(formatDuration(6.25e7)).toBe('2 år');
    expect(formatDuration(Infinity)).toBe('–');
  });
});
