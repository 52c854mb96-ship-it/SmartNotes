import { createElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { TETTHETER } from './jorda';
import {
  Bekk,
  DALBRE_STANDARD,
  Demning,
  Elveleie,
  Fjellside,
  Isbre,
  TVERRPROFIL_STANDARD,
  demningMaal,
  elveleieGeometri,
  isbreGeometri,
  likevektsFront,
  tverrsnittAreal,
  tverrsnittBredde,
  tverrsnittPaneler,
  type ElveleieGeometri,
  type ElveleieProps,
  type IsbreGeometri,
  type IsbreProps,
} from './landskap';

const svg = (child: ReactNode) => renderToStaticMarkup(createElement('svg', null, child));
const UGYLDIG = /NaN|Infinity|undefined/;

/** Alle tall i en geometri (også i ankerpunktene og funksjonene ved noen x-er) er endelige. */
function alleEndelige(g: IsbreGeometri | ElveleieGeometri): boolean {
  const tall: number[] = [g.x, g.y, g.w, g.h, g.dx, g.dy, g.ramme.x, g.ramme.y, g.ramme.w, g.ramme.h];
  for (const a of Object.values(g.ankere)) if (a) tall.push(a.x, a.y);
  for (const t of [0, 0.25, 0.5, 0.75, 1]) {
    const X = g.x + t * g.w;
    if ('overflate' in g) {
      tall.push(g.bakke(X), g.overflate(X), g.isTykkelse(X), g.nedsynking(X));
      const it = g.isTopp(X);
      if (it !== null) tall.push(it);
    } else {
      tall.push(g.bunn(X), g.yFor(t), g.xFor(t));
      const v = g.vannflate(X);
      if (v !== null) tall.push(v);
    }
  }
  return tall.every(Number.isFinite);
}

describe('tverrsnittAreal, tverrsnittBredde og tverrsnittPaneler', () => {
  it('regner areal og bredde eksakt for et V-profil og et trapes', () => {
    const v = [
      [0, 2],
      [2, 0],
      [4, 2],
    ] as const;
    expect(tverrsnittAreal(v, 1)).toBeCloseTo(1, 9);
    expect(tverrsnittBredde(v, 1)).toBeCloseTo(2, 9);
    const trapes = [
      [0, 3],
      [1, 0],
      [9, 0],
      [10, 3],
    ] as const;
    // Bunn 8 m · 2 m + to trekanter med grunnlinje 2/3 m og høyde 2 m
    expect(tverrsnittAreal(trapes, 2)).toBeCloseTo(16 + 4 / 3, 9);
    expect(tverrsnittBredde(trapes, 2)).toBeCloseTo(9 + 1 / 3, 9);
  });

  it('regner bare med vannet som henger sammen med det dypeste punktet', () => {
    // Et lavt område bak en voll (x 0–2) er ikke en del av elva
    const p = [
      [0, 1],
      [2, 1],
      [3, 3],
      [4, 0],
      [6, 0],
      [7, 3],
    ] as const;
    expect(tverrsnittAreal(p, 2)).toBeCloseTo(4 + 2 * (0.5 * (2 / 3) * 2), 9);
    expect(tverrsnittBredde(p, 2)).toBeCloseTo(7 - 1 / 3 - (3 + 1 / 3), 9);
  });

  it('gir null under bunnen og for ugyldige tall', () => {
    expect(tverrsnittAreal(TVERRPROFIL_STANDARD, -1)).toBeNull();
    expect(tverrsnittAreal(TVERRPROFIL_STANDARD, Number.NaN)).toBeNull();
    expect(tverrsnittBredde(TVERRPROFIL_STANDARD, Number.POSITIVE_INFINITY)).toBeNull();
    expect(tverrsnittPaneler(TVERRPROFIL_STANDARD, 3, [])).toBeNull();
    // Et profil med for få gyldige punkter faller tilbake til standardprofilet
    expect(tverrsnittAreal([[Number.NaN, 1]], 3)).toBeCloseTo(tverrsnittAreal(TVERRPROFIL_STANDARD, 3)!, 9);
  });

  it('deler tverrsnittet etter midtseksjonsmetoden og summerer vannføringen', () => {
    const p = [
      [0, 3],
      [3, 3],
      [4, 0],
      [6, 0],
      [7, 3],
    ] as const;
    const q = tverrsnittPaneler(p, 2, [
      { x: 5.5, fart: 2 },
      { x: 4.5, fart: 1 },
      { x: 20, fart: 9 }, // utenfor vannet
    ]);
    expect(q).not.toBeNull();
    expect(q!.deler.map((d) => d.x)).toEqual([4.5, 5.5]);
    expect(q!.deler[0]!.fra).toBeCloseTo(3 + 1 / 3, 9);
    expect(q!.deler[0]!.til).toBeCloseTo(5, 9);
    expect(q!.deler[0]!.areal).toBeCloseTo(2 + 2 / 3, 9);
    expect(q!.deler[1]!.areal).toBeCloseTo(2 + 2 / 3, 9);
    expect(q!.deler[0]!.dybde).toBeCloseTo(2, 9);
    expect(q!.areal).toBeCloseTo(tverrsnittAreal(p, 2)!, 9);
    expect(q!.vannforing).toBeCloseTo(1 * (2 + 2 / 3) + 2 * (2 + 2 / 3), 9);
    const uten = tverrsnittPaneler(p, 2, [{ x: 4.5, fart: 1 }, { x: 5.5 }]);
    expect(uten!.vannforing).toBeNull();
    expect(uten!.deler[1]!.vannforing).toBeNull();
  });

  it('panelene dekker hele standardprofilet', () => {
    const q = tverrsnittPaneler(TVERRPROFIL_STANDARD, 3.1, [{ x: 50, fart: 0.5 }, { x: 60, fart: 1 }, { x: 70, fart: 0.6 }]);
    expect(q!.areal).toBeCloseTo(tverrsnittAreal(TVERRPROFIL_STANDARD, 3.1)!, 6);
    expect(q!.vannforing!).toBeGreaterThan(0);
  });
});

describe('likevektsFront', () => {
  it('flytter fronten oppover dalen når likevektslinja stiger', () => {
    const lav = likevektsFront(1000);
    const midt = likevektsFront(1200);
    const hoy = likevektsFront(1400);
    expect(lav).not.toBeNull();
    expect(midt).not.toBeNull();
    expect(hoy).not.toBeNull();
    expect(lav!).toBeGreaterThan(midt!);
    expect(midt!).toBeGreaterThan(hoy!);
  });

  it('gir en bre med omtrent 60 % over likevektslinja', () => {
    for (const ela of [1150, 1250, 1350]) {
      const front = likevektsFront(ela)!;
      const g = isbreGeometri({ w: 600, h: 260, front, likevektslinje: ela, endemorene: false, bresjo: false })!;
      expect(g.akkumulasjonsandel!).toBeGreaterThan(0.55);
      expect(g.akkumulasjonsandel!).toBeLessThan(0.65);
    }
    const g = isbreGeometri({ w: 600, h: 260, front: likevektsFront(1200, { akkumulasjonsandel: 0.5 })!, likevektslinje: 1200, endemorene: false })!;
    expect(g.akkumulasjonsandel!).toBeCloseTo(0.5, 1);
  });

  it('gir null uten bre, 1 når breen fyller dalen, og null for ugyldige tall', () => {
    expect(likevektsFront(2600)).toBeNull();
    expect(likevektsFront(-500)).toBe(1);
    expect(likevektsFront(Number.NaN)).toBeNull();
  });
});

describe('isbreGeometri: dalbre', () => {
  const p: IsbreProps = { x: 20, y: 100, w: 600, h: 260 };
  const g = isbreGeometri(p)!;

  it('gir null for ugyldige mål', () => {
    expect(isbreGeometri({ w: 0, h: 100 })).toBeNull();
    expect(isbreGeometri({ w: Number.NaN, h: 100 })).toBeNull();
  });

  it('plasserer likevektslinja og fronten der propsene sier', () => {
    expect(g.type).toBe('dalbre');
    expect(g.likevektslinje).not.toBeNull();
    expect(g.likevektslinje!.hoyde).toBeCloseTo(DALBRE_STANDARD.likevektslinje, 6);
    expect(g.likevektslinje!.y).toBeCloseTo(g.yForHoyde(DALBRE_STANDARD.likevektslinje), 6);
    expect(g.hoydeForY(g.yForHoyde(1500))).toBeCloseTo(1500, 6);
    expect(g.front!.x).toBeCloseTo(20 + DALBRE_STANDARD.front * 600, 6);
    expect(g.xForAndel(0.5)).toBeCloseTo(320, 9);
    expect(g.akkumulasjonsandel!).toBeGreaterThan(0.3);
    expect(g.akkumulasjonsandel!).toBeLessThan(0.8);
  });

  it('har is mellom botnen og fronten, og bakken under isen', () => {
    const X = g.xForAndel(0.4);
    expect(g.isTopp(X)).not.toBeNull();
    expect(g.isTopp(X)!).toBeLessThan(g.bakke(X));
    expect(g.isTykkelse(X)).toBeGreaterThan(100);
    expect(g.isTykkelse(X)).toBeLessThan(600);
    expect(g.isTopp(g.xForAndel(0.9))).toBeNull();
    expect(g.overflate(g.xForAndel(0.9))).toBeCloseTo(g.bakke(g.xForAndel(0.9)), 6);
    // Toppen av snittet er toppen av botnveggen
    expect(g.overflate(20)).toBeCloseTo(100, 6);
    expect(g.ramme.y).toBeLessThan(100 - g.dy);
  });

  it('akkumulasjonsandelen øker når likevektslinja synker', () => {
    const lav = isbreGeometri({ ...p, likevektslinje: 900 })!.akkumulasjonsandel!;
    const hoy = isbreGeometri({ ...p, likevektslinje: 1300 })!.akkumulasjonsandel!;
    expect(lav).toBeGreaterThan(hoy);
    // Over hele breen: ingen likevektslinje på breen, AAR 0
    const over = isbreGeometri({ ...p, likevektslinje: 2500 })!;
    expect(over.akkumulasjonsandel).toBe(0);
    expect(over.likevektslinje).toBeNull();
  });

  it('får bresjø bak den innerste morenen bare når det er plass mellom fronten og morenen', () => {
    expect(g.ankere.bresjo).toBeUndefined();
    expect(g.kyst).toBeNull();
    expect(g.ankere.endemorene).toBeDefined();
    const tilbake = isbreGeometri({ ...p, front: 0.47, endemorene: [0.69, 0.76] })!;
    expect(tilbake.ankere.bresjo).toBeDefined();
    expect(tilbake.kyst).not.toBeNull();
    expect(tilbake.kyst!).toBeGreaterThan(tilbake.front!.x - 1);
    // Morener som fronten har passert, tegnes ikke
    const forbi = isbreGeometri({ ...p, front: 0.8, endemorene: [0.6] })!;
    expect(forbi.ankere.endemorene).toBeUndefined();
  });

  it('uten bre: ingen is, ingen likevektslinje og ingen front', () => {
    const tom = isbreGeometri({ ...p, front: 0 })!;
    expect(tom.front).toBeNull();
    expect(tom.akkumulasjonsandel).toBeNull();
    for (const t of [0.1, 0.3, 0.6]) expect(tom.isTopp(tom.xForAndel(t))).toBeNull();
    expect(isbreGeometri({ ...p, tykkelse: 0 })!.front).toBeNull();
  });
});

describe('isbreGeometri: innlandsis og havis', () => {
  it('trykker skorpa ned omtrent ρ_is/ρ_mantel · tykkelsen i likevekt', () => {
    const g = isbreGeometri({ type: 'innlandsis', w: 600, h: 300, tykkelse: 3000, isostasi: true })!;
    const midt = g.xForAndel(0.42);
    const forventet = (TETTHETER.is / TETTHETER.mantel) * 3000;
    expect(g.nedsynking(midt)).toBeGreaterThan(0.75 * forventet);
    expect(g.nedsynking(midt)).toBeLessThan(forventet);
    expect(g.isTykkelse(midt)).toBeCloseTo(3000, 0);
    expect(g.ankere.mantel).toBeDefined();
    expect(g.ankere.jordskorpe).toBeDefined();
    // Uten isostasi og uten nedsynking ligger landet der det lå
    const uten = isbreGeometri({ type: 'innlandsis', w: 600, h: 300, tykkelse: 3000 })!;
    expect(uten.nedsynking(midt)).toBe(0);
    expect(uten.ankere.berggrunn).toBeDefined();
  });

  it('holder landet nede etter at isen er borte, og havet går lenger inn', () => {
    const fr = isbreGeometri({ type: 'innlandsis', w: 600, h: 300, tykkelse: 0, nedsynking: 0 })!;
    const nede = isbreGeometri({ type: 'innlandsis', w: 600, h: 300, tykkelse: 0, nedsynking: 700 })!;
    expect(nede.nedsynking(nede.xForAndel(0.42))).toBeCloseTo(700, 0);
    for (const t of [0.2, 0.5, 0.8]) expect(nede.isTopp(nede.xForAndel(t))).toBeNull();
    expect(fr.kyst).not.toBeNull();
    expect(nede.kyst).not.toBeNull();
    expect(nede.kyst!).toBeLessThan(fr.kyst!);
  });

  it('havis: flakene har tykkelsen fra propsene og omtrent 10 % over vannet', () => {
    const g = isbreGeometri({ type: 'havis', x: 0, y: 100, w: 500, h: 200, tykkelse: 2, dekning: 1 })!;
    const X = g.xForAndel(0.5);
    const t = g.isTykkelse(X);
    expect(t).toBeGreaterThan(2 * 0.85 - 1e-9);
    expect(t).toBeLessThan(2 * 1.15 + 1e-9);
    const fribord = 100 - g.overflate(X);
    const helTykkelse = g.yForHoyde(0) - g.yForHoyde(t);
    expect(fribord / helTykkelse).toBeCloseTo(1 - TETTHETER.is / TETTHETER.sjovann, 6);
    // Ingen is: bare havflaten
    const tom = isbreGeometri({ type: 'havis', x: 0, y: 100, w: 500, h: 200, dekning: 0 })!;
    expect(tom.overflate(250)).toBe(100);
    expect(tom.isTykkelse(250)).toBe(0);
    expect(tom.isTopp(250)).toBeNull();
  });
});

describe('Isbre og Elveleie tåler ytterpunkter', () => {
  const isbre: IsbreProps[] = [
    { w: 600, h: 260 },
    { w: 600, h: 260, front: 1, likevektslinje: -1000, tykkelse: 2000, endemorene: [Number.NaN, 2, -1] },
    { w: 600, h: 260, front: Number.NaN, likevektslinje: Number.NaN, tykkelse: Number.NaN, hoyder: { topp: 0, bunn: 100 } },
    { w: 600, h: 260, front: 0.05, soner: true, strom: true, etiketter: true, dybde: 0 },
    { w: 600, h: 260, front: 0.47, endemorene: [0.69, 0.76], soner: true, strom: true, etiketter: true },
    { type: 'innlandsis', w: 600, h: 260, tykkelse: Number.NaN, senter: Number.NaN, utbredelse: -2, havniva: Number.NaN, strom: true, etiketter: true },
    { type: 'innlandsis', w: 600, h: 260, tykkelse: 5000, maksTykkelse: 0, isostasi: true, nedsynking: Number.NaN, havniva: 500 },
    { type: 'innlandsis', w: 600, h: 260, tykkelse: 0, isostasi: true, nedsynking: 2000, hav: false, etiketter: true },
    { type: 'havis', w: 600, h: 200, tykkelse: Number.NaN, dekning: Number.NaN, isfjell: Number.NaN, smeltedammer: true, etiketter: true },
    { type: 'havis', w: 600, h: 200, tykkelse: 50, dekning: 1, isfjell: true, smeltedammer: true, etiketter: true },
    { type: 'havis', w: 600, h: 200, tykkelse: 0, dekning: 0, etiketter: true },
  ];
  it.each(isbre.map((p, i) => [i, p] as const))('Isbre %i: endelige tall og ingen NaN i SVG-en', (_, p) => {
    const g = isbreGeometri(p);
    expect(g).not.toBeNull();
    expect(alleEndelige(g!)).toBe(true);
    const markup = svg(createElement(Isbre, { ...p, children: (q: IsbreGeometri) => createElement('circle', { cx: q.ramme.x, cy: q.ramme.y, r: 1 }) }));
    expect(markup).not.toMatch(UGYLDIG);
  });

  const elv: ElveleieProps[] = [
    { w: 600, h: 240 },
    { w: 600, h: 240, klarhet: 'grumsete', soner: 'lop', vannforing: 1, etiketter: true, t: 3.2 },
    { w: 600, h: 240, klarhet: 'slamstrom', vannforing: Number.NaN, munning: Number.NaN, korn: false, fjellvegg: false },
    { w: 600, h: 240, demning: { u: 0.42 }, klarhet: 'grumsete', soner: true, etiketter: true },
    { w: 600, h: 240, demning: { u: Number.NaN }, munning: 5 },
    { w: 600, h: 240, demning: { u: 0.01, hoyde: 1000 }, munning: 0 },
    { visning: 'tverr', w: 500, h: 220, flomlinjer: [{ niva: 4.3, navn: '10-årsflom' }, { niva: Number.NaN }], akser: true, etiketter: true },
    { visning: 'tverr', w: 500, h: 220, vannstand: -5, malepunkter: [{ x: 60, fart: 1 }], forbygning: [{ x: 88, hoyde: 2 }] },
    { visning: 'tverr', w: 500, h: 220, vannstand: 50, profil: [[0, 1]], overhoyde: 0, malepunkter: [{ x: Number.NaN }] },
    { visning: 'tverr', w: 500, h: 220, vannstand: Number.NaN, dybde: 0, overhoyde: 1000, forbygning: [{ x: Number.NaN, hoyde: 2 }] },
    { visning: 'ovenfra', w: 600, h: 300, kroksjo: true, prosesser: true, strom: true, etiketter: true, t: 2 },
    { visning: 'ovenfra', w: 600, h: 300, form: 'rett', klarhet: 'slamstrom' },
    { visning: 'ovenfra', w: 600, h: 300, slyngning: Number.NaN, svinger: Number.NaN, bredde: Number.NaN },
    { visning: 'ovenfra', w: 600, h: 120, slyngning: 1, svinger: 0.1, kroksjo: true },
  ];
  it.each(elv.map((p, i) => [i, p] as const))('Elveleie %i: endelige tall og ingen NaN i SVG-en', (_, p) => {
    const g = elveleieGeometri(p);
    expect(g).not.toBeNull();
    expect(alleEndelige(g!)).toBe(true);
    for (const [px, py] of g!.midtlinje) expect(Number.isFinite(px) && Number.isFinite(py)).toBe(true);
    const markup = svg(createElement(Elveleie, { ...p, children: (q: ElveleieGeometri) => createElement('circle', { cx: q.ramme.x, cy: q.ramme.y, r: 1 }) }));
    expect(markup).not.toMatch(UGYLDIG);
  });

  it('gir null for ugyldige mål', () => {
    expect(elveleieGeometri({ w: -1, h: 100 })).toBeNull();
    expect(svg(createElement(Elveleie, { w: Number.NaN, h: 100 }))).toBe('<svg></svg>');
    expect(svg(createElement(Isbre, { w: 100, h: 0 }))).toBe('<svg></svg>');
  });
});

describe('elveleieGeometri', () => {
  it('lengde: vannet ligger over bunnen, og havflaten er fast', () => {
    const g = elveleieGeometri({ x: 10, y: 50, w: 600, h: 240 })!;
    expect(g.havniva).toBeCloseTo(50 + 0.6 * 240, 9);
    for (const t of [0.05, 0.3, 0.6, 0.74]) {
      const X = g.xFor(t);
      expect(g.vannflate(X)!).toBeLessThan(g.bunn(X));
    }
    // Elva faller hele veien ned til munningen
    let forrige = -Infinity;
    for (const t of [0, 0.1, 0.2, 0.4, 0.6, 0.75]) {
      const v = g.vannflate(g.xFor(t))!;
      expect(v).toBeGreaterThan(forrige);
      forrige = v;
    }
    expect(g.ankere.munning!.y).toBeCloseTo(g.havniva, 9);
    expect(g.ankere.magasin).toBeUndefined();
  });

  it('lengde med demning: vannflaten er flat i magasinet og når ikke over kronen', () => {
    const g = elveleieGeometri({ x: 0, y: 0, w: 600, h: 240, demning: { u: 0.42, hoyde: 30 } })!;
    expect(g.ankere.magasin).toBeDefined();
    const a = g.vannflate(g.xFor(0.4))!;
    const b = g.vannflate(g.xFor(0.36))!;
    expect(a).toBeCloseTo(b, 9);
    // Kronen ligger 30 over foten ved demningen, vannflaten litt under kronen
    expect(a).toBeGreaterThan(g.bunn(g.xFor(0.42)) - 30);
  });

  it('tverr: høyder og avstander i meter, overhøyde og vannstand', () => {
    const g = elveleieGeometri({ visning: 'tverr', x: 40, y: 30, w: 520, h: 220, vannstand: 3 })!;
    expect(g.overhoyde).toBeGreaterThan(1);
    expect(g.xFor(0)).toBeCloseTo(40, 9);
    expect(g.xFor(130)).toBeCloseTo(560, 9);
    expect(g.havniva).toBeCloseTo(g.yFor(3), 9);
    expect(g.bunn(g.xFor(62))).toBeCloseTo(g.yFor(0), 9);
    expect(g.vannflate(g.xFor(62))).toBeCloseTo(g.yFor(3), 9);
    expect(g.vannflate(g.xFor(10))).toBeNull();
    // Med en gitt overhøyde blir den brukt
    const fast = elveleieGeometri({ visning: 'tverr', w: 520, h: 220, overhoyde: 3 })!;
    expect(fast.overhoyde).toBeCloseTo(3, 9);
  });

  it('ovenfra: midtlinja holder seg inne i kartet, og svingene får erosjon og avsetning', () => {
    for (const slyngning of [0, 0.4, 0.7, 1]) {
      const g = elveleieGeometri({ visning: 'ovenfra', x: 0, y: 0, w: 600, h: 300, slyngning })!;
      for (const [, py] of g.midtlinje) {
        expect(py).toBeGreaterThan(0);
        expect(py).toBeLessThan(300);
      }
      expect(g.midtlinje[0]![0]).toBeLessThan(0);
      expect(g.midtlinje[g.midtlinje.length - 1]![0]).toBeGreaterThan(600);
    }
    const g = elveleieGeometri({ visning: 'ovenfra', w: 600, h: 300, kroksjo: true })!;
    expect(g.ankere.yttersving).toBeDefined();
    expect(g.ankere.innersving).toBeDefined();
    expect(g.ankere.kroksjo).toBeDefined();
    expect(elveleieGeometri({ visning: 'ovenfra', w: 600, h: 300, form: 'rett' })!.ankere.yttersving).toBeUndefined();
  });
});

describe('Fjellside, Bekk og Demning', () => {
  it('demningMaal gir kronen og foten nedstrøms', () => {
    const m = demningMaal({ x: 100, y: 200, hoyde: 40 })!;
    expect(m.krone.y).toBe(160);
    expect(m.krone.bredde).toBeCloseTo(5.6, 9);
    expect(m.fot.x).toBeCloseTo(100 + 5.6 + 0.75 * 40, 9);
    const speil = demningMaal({ x: 100, y: 200, hoyde: 40, flip: true, krone: 10, helning: 0.5 })!;
    expect(speil.fot.x).toBeCloseTo(100 - 10 - 20, 9);
    expect(demningMaal({ x: 100, y: 200, hoyde: 0 })).toBeNull();
    expect(demningMaal({ x: Number.NaN, y: 200, hoyde: 10 })).toBeNull();
  });

  it('tegner uten NaN, også med få eller ugyldige punkter', () => {
    const terreng = [
      [0, 40],
      [200, 120],
      [400, 150],
    ] as const;
    const deler = [
      createElement(Fjellside, { terreng, bunn: 220, mark: 'gress', berggrunn: 'granitt', losmasse: { type: 'morene', tykkelse: 12 } }),
      createElement(Fjellside, { terreng, bunn: 220, losmasse: { type: 'morene', tykkelse: Number.NaN } }),
      createElement(Bekk, { leie: terreng, t: 2, klarhet: 'slamstrom', dybde: Number.NaN }),
      createElement(Demning, { x: 100, y: 200, hoyde: 40, flip: true, rekkverk: false }),
    ];
    for (const d of deler) expect(svg(d)).not.toMatch(UGYLDIG);
    expect(svg(createElement(Bekk, { leie: [[0, 0]] }))).toBe('<svg></svg>');
    expect(svg(createElement(Fjellside, { terreng: [[0, 0]], bunn: 100 }))).toBe('<svg></svg>');
    expect(svg(createElement(Demning, { x: 0, y: 0, hoyde: Number.NaN }))).toBe('<svg></svg>');
  });
});
