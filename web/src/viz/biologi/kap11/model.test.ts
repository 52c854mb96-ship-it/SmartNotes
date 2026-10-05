import { describe, expect, it } from 'vitest';
import {
  G_MAX,
  NODES,
  ORGANS,
  PSI_WILTING,
  SEASONS,
  airWaterPotential,
  atpSupply,
  boundaryConductance,
  deficiency,
  gramsPerHour,
  growth,
  guttation,
  leafSymptom,
  matchSeason,
  phloem,
  photosynthesisAt,
  plantState,
  rootUptake,
  saturationVaporPressure,
  soilWaterPotential,
  stemDirection,
  transpirationAt,
  vpd,
  type Roles,
  type Weather,
} from './model';

const DAY: Weather = { light: 70, rh: 50, T: 22, wind: 2, soil: 70 };

describe('fysikk for vann', () => {
  it('metningstrykk for vanndamp (Tetens)', () => {
    expect(saturationVaporPressure(20)).toBeCloseTo(2.34, 2);
    expect(saturationVaporPressure(0)).toBeCloseTo(0.611, 3);
    expect(vpd(20, 100)).toBe(0);
    expect(vpd(30, 50)).toBeGreaterThan(vpd(20, 50));
  });

  it('vannpotensialet i lufta er svært negativt', () => {
    expect(airWaterPotential(50)).toBeCloseTo(-93.8, 0);
    expect(airWaterPotential(100)).toBeCloseTo(0, 9);
    expect(airWaterPotential(90)).toBeLessThan(-10);
  });

  it('jordvann: feltkapasitet −0,033 MPa og visnegrensen −1,5 MPa ved 30 %', () => {
    expect(soilWaterPotential(1)).toBeCloseTo(-0.033, 6);
    expect(soilWaterPotential(0.3)).toBeCloseTo(PSI_WILTING, 6);
    expect(soilWaterPotential(0.5)).toBeGreaterThan(soilWaterPotential(0.3));
    expect(soilWaterPotential(0)).toBe(-10);
  });

  it('grenselaget blir tynnere (større konduktans) med vind', () => {
    expect(boundaryConductance(5)).toBeGreaterThan(boundaryConductance(1));
    expect(boundaryConductance(0)).toBe(boundaryConductance(0.1));
  });
});

describe('transpirasjon', () => {
  it('en vanlig sommerdag gir realistiske tall', () => {
    const s = plantState(DAY);
    expect(s.E).toBeGreaterThan(1);
    expect(s.E).toBeLessThan(10);
    expect(s.A).toBeGreaterThan(5);
    expect(s.A).toBeLessThan(30);
    expect(s.opening).toBeGreaterThan(0.3);
    expect(s.turgor).toBeGreaterThan(0.5);
    expect(gramsPerHour(1)).toBeCloseTo(64.8, 6);
  });

  it('vannpotensialet synker hele veien fra jord til luft', () => {
    const p = plantState(DAY).psi;
    expect(p.soil).toBeGreaterThan(p.root);
    expect(p.root).toBeGreaterThan(p.stem);
    expect(p.stem).toBeGreaterThan(p.leaf);
    expect(p.leaf).toBeGreaterThan(p.air);
  });

  it('ingen transpirasjon i mettet luft', () => {
    const s = plantState({ ...DAY, rh: 100 });
    expect(s.E).toBeCloseTo(0, 9);
  });

  it('i mørke er spalteåpningene lukket og bladet frigjør CO₂', () => {
    const s = plantState({ ...DAY, light: 0 });
    expect(s.opening).toBeLessThan(0.01);
    expect(s.A).toBeLessThan(0);
    expect(s.limit).toBe('lys');
  });

  it('planten visner når jorda er for tørr', () => {
    const dry = plantState({ ...DAY, soil: 20 });
    expect(dry.turgor).toBe(0);
    expect(dry.opening).toBeLessThan(0.05);
    expect(dry.limit).toBe('vann');
    expect(plantState({ ...DAY, soil: 100 }).turgor).toBeGreaterThan(0.6);
  });

  it('tørrere og varmere luft og mer vind gir mer transpirasjon', () => {
    expect(plantState({ ...DAY, rh: 30 }).E).toBeGreaterThan(plantState({ ...DAY, rh: 80 }).E);
    expect(transpirationAt(0.2, { ...DAY, wind: 6 })).toBeGreaterThan(transpirationAt(0.2, { ...DAY, wind: 0 }));
    expect(transpirationAt(0.2, { ...DAY, T: 30 })).toBeGreaterThan(transpirationAt(0.2, { ...DAY, T: 15 }));
  });

  it('halvt åpne spalteåpninger gir bedre vannutnyttelse (CO₂ per vann)', () => {
    const wue = (g: number) => photosynthesisAt(g, DAY) / transpirationAt(g, DAY);
    expect(wue(G_MAX / 3)).toBeGreaterThan(wue(G_MAX));
    // … men mindre CO₂-opptak
    expect(photosynthesisAt(G_MAX / 3, DAY)).toBeLessThan(photosynthesisAt(G_MAX, DAY));
  });

  it('alle kombinasjoner gir endelige tall', () => {
    for (const light of [0, 100])
      for (const rh of [20, 100])
        for (const T of [5, 40])
          for (const wind of [0, 10])
            for (const soil of [0, 100]) {
              const s = plantState({ light, rh, T, wind, soil });
              for (const v of [s.E, s.A, s.gs, s.turgor, s.psi.leaf, s.psi.air]) expect(Number.isFinite(v)).toBe(true);
              expect(s.opening).toBeGreaterThanOrEqual(0);
              expect(s.opening).toBeLessThanOrEqual(1);
            }
  });
});

describe('floemtransport', () => {
  const season = (id: string) => SEASONS.find((s) => s.id === id)!.roles;
  const sum = (r: ReturnType<typeof phloem>) => ORGANS.reduce((s, o) => s + r.net[o.id], 0);

  it('sommer: sukkeret går ned fra bladene til knollene', () => {
    const r = phloem(season('sommer'));
    expect(stemDirection(r)).toBe('ned');
    expect(r.net.blader).toBeGreaterThan(0);
    expect(r.net.knoll).toBeLessThan(0);
    expect(sum(r)).toBeCloseTo(0, 9);
  });

  it('vår: settepoteten er kilde, og sukkeret går opp til skuddene', () => {
    const r = phloem(season('var'));
    expect(stemDirection(r)).toBe('opp');
    expect(r.net.knoll).toBeGreaterThan(0);
    expect(r.net.skudd).toBeLessThan(0);
    expect(sum(r)).toBeCloseTo(0, 9);
  });

  it('trykket er høyest ved kildene og lavest ved slukene', () => {
    const r = phloem(season('host'));
    const max = Math.max(...NODES.map((n) => r.pressure[n]));
    const min = NODES.reduce((a, b) => (r.pressure[b] < r.pressure[a] ? b : a));
    // Skuddet og blomstene er «av» og ligger i en blindgate med samme trykk som bladene
    expect(r.pressure.blader).toBeCloseTo(max, 9);
    expect(['knoll', 'rot']).toContain(min);
    for (const n of NODES) expect(r.pressure[n]).toBeGreaterThanOrEqual(0);
  });

  it('uten kilder eller uten sluk går det ikke noe sukker', () => {
    const none: Roles = { skudd: 'sluk', blomster: 'sluk', blader: 'sluk', knoll: 'sluk', rot: 'sluk' };
    expect(phloem(none).total).toBe(0);
    const onlySrc: Roles = { skudd: 'av', blomster: 'av', blader: 'kilde', knoll: 'kilde', rot: 'av' };
    expect(phloem(onlySrc).total).toBe(0);
    expect(stemDirection(phloem(onlySrc))).toBe('ingen');
  });

  it('ringbarking: knollene og røttene får ikke sukker fra bladene', () => {
    const r = phloem(season('host'), true);
    expect(r.flow.blader).toBe(0);
    expect(r.net.knoll).toBeCloseTo(0, 9);
    expect(r.net.rot).toBeCloseTo(0, 9);
    expect(r.deficit).toBeGreaterThan(0);
    expect(r.surplus).toBeGreaterThan(0);
  });

  it('forhåndsvalgene kjennes igjen', () => {
    for (const s of SEASONS) expect(matchSeason(s.roles)).toBe(s.id);
    expect(matchSeason({ ...season('var'), rot: 'av' })).toBeNull();
  });

  it('mindre lys gir mindre sukker fra bladene', () => {
    expect(phloem(season('host'), false, 0.3).total).toBeLessThan(phloem(season('host')).total);
  });
});

describe('vann og mineraler i rota', () => {
  it('aktivt opptak trenger O₂ (celleånding gir ATP)', () => {
    expect(atpSupply(100)).toBeCloseTo(1, 9);
    expect(atpSupply(0)).toBe(0);
    expect(rootUptake({ ions: 10, o2: 0, salt: 0 }).uptake).toBe(0);
    expect(rootUptake({ ions: 10, o2: 100, salt: 0 }).uptake).toBeGreaterThan(0.8);
  });

  it('opptaket mettes ved høy konsentrasjon (bærer- og pumpeproteiner)', () => {
    const a = rootUptake({ ions: 2, o2: 100, salt: 0 }).uptake;
    const b = rootUptake({ ions: 40, o2: 100, salt: 0 }).uptake;
    expect(a).toBeCloseTo(0.5, 6);
    expect(b).toBeLessThan(1);
    expect(b - a).toBeLessThan(0.5);
  });

  it('vann går inn i rota ved osmose når rota har høyest konsentrasjon', () => {
    const r = rootUptake({ ions: 5, o2: 100, salt: 0 });
    expect(r.osmIn).toBeGreaterThan(r.osmOut);
    expect(r.psiIn).toBeLessThan(r.psiOut);
    expect(r.water).toBeGreaterThan(0);
  });

  it('salt jord trekker vann ut av rota', () => {
    const r = rootUptake({ ions: 5, o2: 100, salt: 200 });
    expect(r.water).toBeLessThan(0);
  });

  it('guttasjon om natta i fuktig luft og fuktig jord, ikke en tørr dag', () => {
    const night = guttation({ night: true, rh: 98, soil: 95 });
    expect(night.rootPressure).toBeGreaterThan(0.1);
    expect(night.xylem).toBeGreaterThan(0);
    expect(night.guttation).toBeGreaterThan(0.5);
    expect(guttation({ night: false, rh: 95, soil: 95 }).guttation).toBe(0);
    const day = guttation({ night: false, rh: 50, soil: 95 });
    expect(day.xylem).toBeLessThan(0);
    expect(day.guttation).toBe(0);
    expect(guttation({ night: true, rh: 98, soil: 25 }).guttation).toBe(0);
  });
});

describe('næringsmangel', () => {
  it('Liebigs minimumslov', () => {
    expect(growth({ N: 40, P: 80, K: 100, Mg: 90 })).toEqual({ growth: 0.4, limiting: 'N' });
    expect(growth({ N: 100, P: 100, K: 100, Mg: 100 })).toEqual({ growth: 1, limiting: null });
    expect(growth({ N: 100, P: 100, K: 100, Mg: 10 }).limiting).toBe('Mg');
  });

  it('mangelen øker under grensen', () => {
    expect(deficiency(100)).toBe(0);
    expect(deficiency(70)).toBe(0);
    expect(deficiency(0)).toBe(1);
    expect(deficiency(35)).toBeCloseTo(0.5, 9);
  });

  it('eldre blader får symptomer først (mobile næringsstoffer)', () => {
    expect(leafSymptom(0.5, 1)).toBeGreaterThan(leafSymptom(0.5, 0));
    expect(leafSymptom(0.3, 0)).toBe(0);
    expect(leafSymptom(0, 1)).toBe(0);
    expect(leafSymptom(1, 1)).toBe(1);
  });
});
