import { describe, expect, it } from 'vitest';
import {
  flytvei,
  helning,
  hoydefelt,
  hoydeVed,
  kartavstand,
  koter,
  maalestokkTekst,
  skalastokk,
  terrengavstand,
  terrengprofil,
  vannskille,
  type Hoydefelt,
  type Landform,
} from './kart';

const skraaplan = hoydefelt(1, [{ type: 'plan', z0: 100, helningX: 0.1, helningY: 0 }], { bredde: 1000, lengde: 500, celle: 25 })!;
const kjegle = hoydefelt(1, [{ type: 'kjegle', x: 500, y: 500, hoyde: 400, radius: 400 }], { bredde: 1000, lengde: 1000, celle: 20 })!;

/** En tenkt dal: terrenget heller mot sør, med en V-dal mot utløpet i sørkanten, to topper og en grop. */
const dalFormer: Landform[] = [
  { type: 'plan', z0: 400, helningX: 0, helningY: -0.15 },
  { type: 'dal', punkter: [[300, 0], [800, 600], [1000, 1500]], dybde: 120, bredde: 700 },
  { type: 'topp', x: 1600, y: 400, hoyde: 250, radius: 600 },
  { type: 'topp', x: 300, y: 900, hoyde: 150, radius: 400 },
  { type: 'senkning', x: 950, y: 1000, dybde: 30, radius: 150 },
];
const dal = hoydefelt(7, dalFormer, { ujevnhet: 12 })!;

describe('hoydefelt', () => {
  it('har riktig størrelse og min/maks', () => {
    expect(skraaplan.nx).toBe(41);
    expect(skraaplan.ny).toBe(21);
    expect(skraaplan.bredde).toBe(1000);
    expect(skraaplan.z).toHaveLength(41 * 21);
    expect(skraaplan.min).toBeCloseTo(100, 10);
    expect(skraaplan.max).toBeCloseTo(200, 10);
    expect(kjegle.max).toBeCloseTo(400, 10);
  });

  it('gir samme felt for samme frø og et annet for et annet frø', () => {
    expect(hoydefelt(7, dalFormer, { ujevnhet: 12 })!.z).toEqual(dal.z);
    expect(hoydefelt(8, dalFormer, { ujevnhet: 12 })!.z).not.toEqual(dal.z);
    for (const z of dal.z) expect(Number.isFinite(z)).toBe(true);
  });

  it('interpolerer høyden bilineært og gir null utenfor feltet', () => {
    expect(hoydeVed(skraaplan, 333, 123)).toBeCloseTo(133.3, 9);
    expect(hoydeVed(skraaplan, 1000, 500)).toBeCloseTo(200, 9);
    expect(hoydeVed(skraaplan, -1, 10)).toBeNull();
    expect(hoydeVed(skraaplan, 10, 501)).toBeNull();
    expect(hoydeVed(skraaplan, Number.NaN, 10)).toBeNull();
  });

  it('respekterer gulvet og hopper over ugyldige landformer', () => {
    const f = hoydefelt(1, [{ type: 'plan', z0: -50, helningX: 0.1, helningY: 0 }, { type: 'topp', x: Number.NaN, y: 0, hoyde: 10, radius: 5 }], { bredde: 1000, lengde: 100, gulv: 0 })!;
    expect(f.min).toBe(0);
    expect(hoydeVed(f, 200, 50)).toBe(0);
    expect(hoydeVed(f, 1000, 50)).toBeCloseTo(50, 9);
  });

  it('gir null for ugyldig størrelse eller celle', () => {
    expect(hoydefelt(1, [], { celle: 0 })).toBeNull();
    expect(hoydefelt(1, [], { bredde: -10 })).toBeNull();
    expect(hoydefelt(1, [], { bredde: 1e6, celle: 1 })).toBeNull();
  });
});

describe('koter', () => {
  it('gir rette, parallelle koter med lik avstand på et skråplan', () => {
    const k = koter(skraaplan, 10);
    const indre = k.filter((x) => x.hoyde > 100 && x.hoyde < 200);
    expect(indre).toHaveLength(9);
    for (const kote of indre) {
      expect(kote.linjer).toHaveLength(1);
      const linje = kote.linjer[0]!;
      expect(linje.lukket).toBe(false);
      const xForventet = (kote.hoyde - 100) / 0.1;
      for (const [x] of linje.punkter) expect(x).toBeCloseTo(xForventet, 6);
      const ys = linje.punkter.map(([, y]) => y);
      expect(Math.min(...ys)).toBeCloseTo(0, 9);
      expect(Math.max(...ys)).toBeCloseTo(500, 9);
    }
  });

  it('gir sirkler rundt en kjegle', () => {
    for (const h of [100, 200, 300]) {
      const kote = koter(kjegle, 100).find((k) => k.hoyde === h)!;
      expect(kote.linjer).toHaveLength(1);
      const linje = kote.linjer[0]!;
      expect(linje.lukket).toBe(true);
      const r = 400 - h;
      for (const [x, y] of linje.punkter) expect(Math.abs(Math.hypot(x - 500, y - 500) - r)).toBeLessThan(1);
      // Sammenhengende: naboene ligger høyst litt over én rute fra hverandre
      for (let i = 1; i < linje.punkter.length; i++) {
        const [ax, ay] = linje.punkter[i - 1]!;
        const [bx, by] = linje.punkter[i]!;
        expect(Math.hypot(bx - ax, by - ay)).toBeLessThan(kjegle.celle * 1.5);
      }
      const [fx, fy] = linje.punkter[0]!;
      const [sx, sy] = linje.punkter[linje.punkter.length - 1]!;
      expect(Math.hypot(sx - fx, sy - fy)).toBeLessThan(1e-9);
    }
  });

  it('gjør hver femte kote tykk', () => {
    for (const k of koter(kjegle, 20)) expect(k.tykk).toBe(k.hoyde % 100 === 0);
    for (const k of koter(kjegle, 20, { hovedkoteHver: 2 })) expect(k.tykk).toBe(k.hoyde % 40 === 0);
  });

  it('gir ingen uendelig løkke for ekvidistanse 0, negativ eller altfor liten', () => {
    expect(koter(kjegle, 0)).toEqual([]);
    expect(koter(kjegle, -10)).toEqual([]);
    expect(koter(kjegle, Number.NaN)).toEqual([]);
    expect(koter(kjegle, 0.001)).toEqual([]);
  });

  it('dropper koter som bare berører ett gitterpunkt', () => {
    const k = koter(kjegle, 100);
    expect(k.find((x) => x.hoyde === 400)).toBeUndefined();
    for (const kote of koter(dal, 10)) for (const l of kote.linjer) expect(l.punkter.length).toBeGreaterThanOrEqual(2);
  });
});

describe('profil og helning', () => {
  it('starter og slutter i høyden til A og B', () => {
    const A: [number, number] = [120, 340];
    const B: [number, number] = [1700, 1100];
    const p = terrengprofil(dal, A, B, 50);
    expect(p).toHaveLength(50);
    expect(p[0]!.z).toBeCloseTo(hoydeVed(dal, ...A)!, 9);
    expect(p[49]!.z).toBeCloseTo(hoydeVed(dal, ...B)!, 9);
    expect(p[0]!.s).toBe(0);
    expect(p[49]!.s).toBeCloseTo(Math.hypot(1580, 760), 9);
    for (let i = 1; i < p.length; i++) expect(p[i]!.s).toBeGreaterThan(p[i - 1]!.s);
  });

  it('flytter punkter utenfor feltet inn til kanten, og n < 2 gir en tom liste', () => {
    const p = terrengprofil(skraaplan, [-100, 50], [2000, 50], 3);
    expect(p[0]!.x).toBe(0);
    expect(p[2]!.x).toBe(1000);
    expect(p[2]!.z).toBeCloseTo(200, 9);
    expect(terrengprofil(skraaplan, [0, 0], [10, 10], 1)).toEqual([]);
    expect(terrengprofil(skraaplan, [0, Number.NaN], [10, 10])).toEqual([]);
  });

  it('gir riktig helning på et skråplan', () => {
    const h = helning(skraaplan, 410, 260)!;
    expect(h.prosent).toBeCloseTo(10, 9);
    expect(h.grader).toBeCloseTo((Math.atan(0.1) * 180) / Math.PI, 9);
    expect(h.retning).toBeCloseTo(270, 9); // høyere mot øst, så det heller mot vest
    expect(helning(skraaplan, 0, 0)!.prosent).toBeCloseTo(10, 9);
    const sor = hoydefelt(1, [{ type: 'plan', z0: 500, helningX: 0, helningY: -0.2 }], { bredde: 500, lengde: 500 })!;
    expect(helning(sor, 250, 250)!.retning).toBeCloseTo(180, 9);
  });

  it('gir 45° på kjeglens side, hellende bort fra toppen', () => {
    const ost = helning(kjegle, 650, 500)!;
    expect(ost.grader).toBeGreaterThan(43);
    expect(ost.grader).toBeLessThan(47);
    expect(ost.retning!).toBeCloseTo(90, 0);
    expect(helning(kjegle, 500, 650)!.retning!).toBeCloseTo(180, 0);
    expect(helning(kjegle, 350, 500)!.retning!).toBeCloseTo(270, 0);
    expect(helning(kjegle, 500, 350)!.retning!).toBeCloseTo(0, 0);
  });

  it('gir null retning på flatt terreng og null utenfor feltet', () => {
    const flatt = hoydefelt(1, [], { grunnhoyde: 50, bredde: 200, lengde: 200 })!;
    expect(helning(flatt, 100, 100)).toMatchObject({ grader: 0, retning: null });
    expect(helning(skraaplan, -5, 10)).toBeNull();
  });
});

describe('vannets vei og vannskillet', () => {
  const indeks = (f: Hoydefelt, [x, y]: [number, number]) => Math.round(y / f.celle) * f.nx + Math.round(x / f.celle);

  it('lar alle punktene i nedbørfeltet renne til utløpet', () => {
    const nf = vannskille(dal, [1000, 1500])!;
    expect(nf.antall).toBeGreaterThan(200);
    expect(nf.areal).toBe(nf.antall * dal.celle ** 2);
    expect(nf.maske.filter(Boolean)).toHaveLength(nf.antall);
    const ut = indeks(dal, nf.utlop);
    nf.maske.forEach((med, k) => {
      if (!med) return;
      const i = k % dal.nx;
      const vei = flytvei(dal, [i * dal.celle, ((k - i) / dal.nx) * dal.celle]);
      expect(vei.some((p) => indeks(dal, p) === ut)).toBe(true);
    });
  });

  it('lar punkter utenfor nedbørfeltet renne et annet sted', () => {
    const nf = vannskille(dal, [1000, 1500])!;
    const ut = indeks(dal, nf.utlop);
    let utenfor = 0;
    nf.maske.forEach((med, k) => {
      if (med || k % 37 !== 0) return;
      const i = k % dal.nx;
      const vei = flytvei(dal, [i * dal.celle, ((k - i) / dal.nx) * dal.celle]);
      expect(vei.some((p) => indeks(dal, p) === ut)).toBe(false);
      utenfor++;
    });
    expect(utenfor).toBeGreaterThan(0);
  });

  it('flytter utløpet inn i elva og tegner en lukket grense', () => {
    const nf = vannskille(dal, [1000 + dal.celle, 1500])!;
    expect(nf.utlop[0]).toBeGreaterThanOrEqual(1000 - 2 * dal.celle);
    expect(nf.utlop[0]).toBeLessThanOrEqual(1000 + 2 * dal.celle);
    expect(nf.grense.length).toBeGreaterThan(0);
    for (const l of nf.grense) for (const [x, y] of l.punkter) expect(Number.isFinite(x) && Number.isFinite(y)).toBe(true);
    // Omrisset er lukket og holder seg innenfor kartet
    expect(nf.omriss.length).toBeGreaterThan(0);
    for (const l of nf.omriss) {
      expect(l.lukket).toBe(true);
      for (const [x, y] of l.punkter) {
        expect(x).toBeGreaterThanOrEqual(0);
        expect(x).toBeLessThanOrEqual(dal.bredde);
        expect(y).toBeGreaterThanOrEqual(0);
        expect(y).toBeLessThanOrEqual(dal.lengde);
      }
    }
  });

  it('renner nedover til kanten av kartet, også gjennom en grop', () => {
    const vei = flytvei(dal, [950, 1000]);
    expect(vei.length).toBeGreaterThan(1);
    const [sx, sy] = vei[vei.length - 1]!;
    expect(sx === 0 || sy === 0 || sx === dal.bredde || sy === dal.lengde).toBe(true);
    expect(flytvei(dal, [-10, 0])).toEqual([]);
    expect(vannskille(dal, [5000, 0])).toBeNull();
  });
});

describe('målestokk', () => {
  it('regner mellom kart og terreng', () => {
    expect(kartavstand(1000, 50_000)).toBeCloseTo(2, 12);
    expect(terrengavstand(1, 50_000)).toBeCloseTo(500, 12);
    expect(terrengavstand(kartavstand(3456, 25_000)!, 25_000)).toBeCloseTo(3456, 9);
    expect(kartavstand(100, 0)).toBeNull();
    expect(terrengavstand(1, -5)).toBeNull();
  });

  it('skriver målestokken på norsk', () => {
    expect(maalestokkTekst(50_000)).toBe('1 : 50 000');
    expect(maalestokkTekst(5000)).toBe('1 : 5000');
    expect(maalestokkTekst(0)).toBe('–');
  });

  it('velger en rund målestokklinje som får plass', () => {
    expect(skalastokk(5, 150)).toEqual({ meter: 500, enheter: 100, tekst: '500 m' });
    expect(skalastokk(20, 120)).toEqual({ meter: 2000, enheter: 100, tekst: '2 km' });
    expect(skalastokk(1, 1)!.meter).toBe(1);
    expect(skalastokk(0.1, 3)!.tekst).toBe('0,2 m');
    expect(skalastokk(0, 100)).toBeNull();
  });
});
