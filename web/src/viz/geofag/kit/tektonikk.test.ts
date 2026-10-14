import { createElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { JORDRADIUS } from './jorda';
import {
  JordasIndre,
  MAGNETISK_POLARITET,
  PLATE_BREDDE_KM,
  PLATE_FART,
  Plategrense,
  STRIPER_START,
  Vulkan,
  jordasIndreGeometri,
  jordasIndreRadier,
  jordasIndreRadius,
  magnetiskeStriper,
  plategrenseGeometri,
  polaritetVed,
  vulkanGeometri,
  type PlategrenseGeometri,
  type PlategrenseType,
} from './tektonikk';

const svg = (child: ReactNode) => renderToStaticMarkup(createElement('svg', null, child));
const UGYLDIG = /NaN|Infinity|undefined/;
const TYPER: PlategrenseType[] = ['spredning', 'subduksjon', 'kollisjon', 'transform', 'varmt-punkt'];

describe('MAGNETISK_POLARITET', () => {
  it('er sammenhengende fra i dag til forbi 5 millioner år, med vekslende polaritet', () => {
    expect(MAGNETISK_POLARITET[0]!.fra).toBe(0);
    for (let i = 1; i < MAGNETISK_POLARITET.length; i++) {
      const a = MAGNETISK_POLARITET[i - 1]!;
      const b = MAGNETISK_POLARITET[i]!;
      expect(b.fra).toBe(a.til);
      expect(b.til).toBeGreaterThan(b.fra);
      expect(b.normal).not.toBe(a.normal);
    }
    expect(MAGNETISK_POLARITET[MAGNETISK_POLARITET.length - 1]!.til).toBeGreaterThan(STRIPER_START);
  });

  it('har kronene og episodene på kjente aldre (ATNTS2004)', () => {
    expect(polaritetVed(0.5)).toBe(true); // Brunhes
    expect(polaritetVed(0.9)).toBe(false); // Matuyama
    expect(polaritetVed(1.03)).toBe(true); // Jaramillo
    expect(polaritetVed(1.85)).toBe(true); // Olduvai
    expect(polaritetVed(2.3)).toBe(false); // Matuyama
    expect(polaritetVed(2.8)).toBe(true); // Gauss
    expect(polaritetVed(3.07)).toBe(false); // Kaena
    expect(polaritetVed(3.27)).toBe(false); // Mammoth
    expect(polaritetVed(3.9)).toBe(false); // Gilbert
    expect(polaritetVed(5.1)).toBe(true); // Thvera
    // Brunhes–Matuyama-grensen og begynnelsen av Gauss og Gilbert
    expect(MAGNETISK_POLARITET.find((p) => p.navn === 'Brunhes')!.til).toBeCloseTo(0.781, 3);
    expect(MAGNETISK_POLARITET.find((p) => p.navn === 'Gauss')!.fra).toBeCloseTo(2.581, 3);
    expect(MAGNETISK_POLARITET.find((p) => p.navn === 'Gilbert')!.fra).toBeCloseTo(3.596, 3);
  });

  it('legger en alder på en grense i det yngre intervallet og gir null utenfor tabellen', () => {
    expect(polaritetVed(0)).toBe(true);
    expect(polaritetVed(0.781)).toBe(false);
    expect(polaritetVed(-1)).toBeNull();
    expect(polaritetVed(100)).toBeNull();
    expect(polaritetVed(Number.NaN)).toBeNull();
    expect(polaritetVed(Number.POSITIVE_INFINITY)).toBeNull();
  });
});

describe('magnetiskeStriper', () => {
  it('er tom uten fart eller tid, og for ugyldige tall', () => {
    expect(magnetiskeStriper(0, 5)).toEqual([]);
    expect(magnetiskeStriper(4, 0)).toEqual([]);
    expect(magnetiskeStriper(-2, 3)).toEqual([]);
    expect(magnetiskeStriper(Number.NaN, 3)).toEqual([]);
    expect(magnetiskeStriper(4, Number.POSITIVE_INFINITY)).toEqual([]);
  });

  it('går fra ryggen og ut uten hull, og den ytterste stripa ligger 5 · fart · t km ut', () => {
    const st = magnetiskeStriper(4, 5); // 20 km per million år på hver side
    expect(st[0]).toMatchObject({ fra: 0, normal: true, navn: 'Brunhes' });
    expect(st[0]!.til).toBeCloseTo(15.62, 6);
    for (let i = 1; i < st.length; i++) {
      expect(st[i]!.fra).toBeCloseTo(st[i - 1]!.til, 9);
      expect(st[i]!.normal).not.toBe(st[i - 1]!.normal);
    }
    expect(st[st.length - 1]!.til).toBeCloseTo(100, 6);
    // Jaramillo ligger 0,988–1,072 millioner år ut: 19,76–21,44 km
    const jaramillo = st.find((p) => p.navn === 'Jaramillo')!;
    expect(jaramillo.fra).toBeCloseTo(19.76, 6);
    expect(jaramillo.til).toBeCloseTo(21.44, 6);
  });

  it('viser havbunnen som er dannet siden start: ved t = 2 har ryggen polariteten fra 3 millioner år siden', () => {
    const st = magnetiskeStriper(4, 2);
    expect(st[0]!.dannetFra).toBeCloseTo(3, 9);
    expect(st[0]!.normal).toBe(polaritetVed(3));
    expect(st[st.length - 1]!.til).toBeCloseTo(40, 6);
    expect(st[st.length - 1]!.dannetTil).toBeCloseTo(STRIPER_START, 9);
  });

  it('regner tid over start som start', () => {
    expect(magnetiskeStriper(3, 12)).toEqual(magnetiskeStriper(3, STRIPER_START));
  });
});

describe('jordasIndreRadius', () => {
  it('står riktig i kjernen og overdriver skorpa så den synes', () => {
    const r = 200;
    expect(jordasIndreRadius(0, r)).toBe(r);
    expect(jordasIndreRadius(JORDRADIUS, r)).toBe(0);
    expect(jordasIndreRadius(2891, r)).toBeCloseTo(r * (1 - 2891 / JORDRADIUS), 9);
    expect(jordasIndreRadius(5150, r)).toBeCloseTo(r * (1 - 5150 / JORDRADIUS), 9);
    // 35 km er 0,55 % av radien, men tegnes minst 3 %
    expect(r - jordasIndreRadius(35, r)!).toBeGreaterThanOrEqual(0.03 * r - 1e-9);
    // En mindre kule får skorpa minst 4 enheter tykk (men høyst 6 % av radien)
    expect(100 - jordasIndreRadius(35, 100)!).toBeCloseTo(4, 9);
    expect(40 - jordasIndreRadius(35, 40)!).toBeCloseTo(0.06 * 40, 9);
  });

  it('er i målestokk med riktigeForhold', () => {
    expect(jordasIndreRadius(35, 200, true)).toBeCloseTo(200 * (1 - 35 / JORDRADIUS), 9);
    expect(jordasIndreRadius(660, 200, true)).toBeCloseTo(200 * (1 - 660 / JORDRADIUS), 9);
  });

  it('minker innover og gir null utenfor jorda eller for ugyldig r', () => {
    for (const r of [24, 90, 300]) {
      let forrige = Infinity;
      for (let d = 0; d <= JORDRADIUS; d += 25) {
        const rho = jordasIndreRadius(d, r)!;
        expect(rho).toBeLessThanOrEqual(forrige + 1e-9);
        forrige = rho;
      }
    }
    expect(jordasIndreRadius(-1, 100)).toBeNull();
    expect(jordasIndreRadius(7000, 100)).toBeNull();
    expect(jordasIndreRadius(100, 0)).toBeNull();
    expect(jordasIndreRadius(Number.NaN, 100)).toBeNull();
  });
});

describe('jordasIndreRadier og jordasIndreGeometri', () => {
  it('gir fem lag i hver inndeling, utenfra og inn uten hull', () => {
    for (const inndeling of ['kjemisk', 'mekanisk'] as const) {
      const lag = jordasIndreRadier(150, inndeling);
      expect(lag).toHaveLength(5);
      expect(lag[0]!.rYtre).toBe(150);
      expect(lag[lag.length - 1]!.rIndre).toBe(0);
      for (let i = 1; i < lag.length; i++) expect(lag[i]!.rYtre).toBeCloseTo(lag[i - 1]!.rIndre, 9);
      for (const l of lag) expect(l.navn.charAt(0)).toBe(l.navn.charAt(0).toUpperCase());
    }
    expect(jordasIndreRadier(150, 'mekanisk').map((l) => l.id)).toEqual(['litosfare', 'astenosfare', 'nedreMantel', 'ytreKjerne', 'indreKjerne']);
    expect(jordasIndreRadier(0)).toEqual([]);
    expect(jordasIndreRadier(Number.NaN)).toEqual([]);
  });

  it('legger ankerpunktene inne i kula og punktene for et dyp på samme stråle', () => {
    for (const form of ['kile', 'snitt'] as const) {
      const g = jordasIndreGeometri({ x: 200, y: 180, r: 150, form })!;
      for (const l of g.lag) {
        const d = Math.hypot(l.anker.x - 200, l.anker.y - 180);
        expect(d).toBeLessThan(150);
        expect(Number.isFinite(l.anker.x) && Number.isFinite(l.anker.y)).toBe(true);
      }
      const p = g.punkt(2891)!;
      expect(Math.hypot(p.x - 200, p.y - 180)).toBeLessThan(150);
      expect(g.punkt(-5)).toBeNull();
    }
    expect(jordasIndreGeometri({ x: 0, y: 0, r: -3 })).toBeNull();
  });
});

const endelig = (g: PlategrenseGeometri) => {
  for (const a of Object.values(g.ankere)) {
    expect(Number.isFinite(a!.x) && Number.isFinite(a!.y)).toBe(true);
    if (a!.retning) expect(Math.hypot(a!.retning[0], a!.retning[1])).toBeCloseTo(1, 1);
  }
  for (const v of Object.values(g.ramme)) expect(Number.isFinite(v)).toBe(true);
  for (let x = g.x; x <= g.x + g.w; x += g.w / 20) expect(Number.isFinite(g.profil(x))).toBe(true);
};

describe('plategrenseGeometri', () => {
  it('gir endelige ankerpunkter, profil og ramme for alle typer og ytterpunkter', () => {
    for (const type of TYPER)
      for (const fart of [0, 4, 30])
        for (const t of [0, 2.5, 5, 100])
          for (const variant of ['hav-kontinent', 'hav-hav'] as const)
            for (const w of [120, 700]) {
              const g = plategrenseGeometri({ type, variant, x: 10, y: 20, w, h: w * 0.42, fart, t, striper: true, etiketter: true });
              expect(g).not.toBeNull();
              endelig(g!);
              expect(g!.ramme.x1).toBeGreaterThan(g!.ramme.x0);
              expect(g!.ramme.y1).toBeGreaterThan(g!.ramme.y0);
            }
  });

  it('gir målestokken fra breddeKm og standardfarten etter typen', () => {
    const g = plategrenseGeometri({ type: 'spredning', w: 800, h: 300 })!;
    expect(g.fart).toBe(PLATE_FART.spredning);
    expect(g.kmPerPx).toBeCloseTo(PLATE_BREDDE_KM.spredning / 800, 9);
    expect(g.pxPerMa).toBeCloseTo((10 * 4 * 800) / 400, 9); // 4 cm/år = 40 km per million år
    expect(plategrenseGeometri({ type: 'subduksjon', w: 800, h: 300, fart: 99 })!.fart).toBe(30);
  });

  it('spredning: ryggen står midt på, og ryggskyvet peker bort fra ryggen og nedover', () => {
    const g = plategrenseGeometri({ type: 'spredning', x: 0, y: 0, w: 800, h: 300 })!;
    expect(g.ankere.rygg!.x).toBeCloseTo(400, 6);
    expect(g.havniva).toBeLessThan(g.ankere.rygg!.y);
    expect(g.ankere.ryggskyvVenstre!.retning![0]).toBeLessThan(0);
    expect(g.ankere.ryggskyvHoyre!.retning![0]).toBeGreaterThan(0);
    expect(g.ankere.ryggskyvHoyre!.retning![1]).toBeGreaterThan(0);
  });

  it('subduksjon: grøfta ligger mellom havet og vulkanen, og platetrekket peker ned langs plata', () => {
    for (const variant of ['hav-kontinent', 'hav-hav'] as const) {
      const g = plategrenseGeometri({ type: 'subduksjon', variant, x: 0, y: 0, w: 800, h: 320 })!;
      const { grop, vulkan, platetrekk, smeltesone } = g.ankere;
      expect(grop!.x).toBeLessThan(vulkan!.x);
      expect(vulkan!.y).toBeLessThan(g.havniva!);
      expect(grop!.y).toBeGreaterThan(g.havniva!);
      expect(platetrekk!.retning![0]).toBeGreaterThan(0);
      expect(platetrekk!.retning![1]).toBeGreaterThan(0);
      // Smeltingen skjer under vulkanen, dypere enn grøfta
      expect(Math.abs(smeltesone!.x - vulkan!.x)).toBeLessThan(0.05 * 800);
      expect(smeltesone!.y).toBeGreaterThan(grop!.y);
    }
  });

  it('kollisjon: fjellrota ligger under fjellkjeden, og det er ikke noe hav', () => {
    const g = plategrenseGeometri({ type: 'kollisjon', x: 0, y: 0, w: 800, h: 320 })!;
    expect(g.havniva).toBeNull();
    expect(g.ankere.fjellrot!.y).toBeGreaterThan(g.ankere.fjelltopp!.y);
    expect(Math.abs(g.ankere.fjellrot!.x - g.ankere.fjelltopp!.x)).toBeLessThan(0.15 * 800);
  });

  it('varmt punkt: den aktive vulkanen står over plumen, og eldre vulkaner ligger lenger mot venstre', () => {
    const g = plategrenseGeometri({ type: 'varmt-punkt', x: 0, y: 0, w: 800, h: 320, t: 5 })!;
    expect(Math.abs(g.ankere.vulkan!.x - g.ankere.varmtPunkt!.x)).toBeLessThan(0.25 * 800);
    expect(g.ankere.eldreVulkan!.x).toBeLessThan(g.ankere.vulkan!.x);
    // Uten bevegelse står én vulkan over det varme punktet
    const stille = plategrenseGeometri({ type: 'varmt-punkt', x: 0, y: 0, w: 800, h: 320, fart: 0 })!;
    expect(stille.ankere.vulkan!.x).toBeCloseTo(0.72 * 800, 6);
    expect(stille.ankere.eldreVulkan).toBeUndefined();
  });

  it('transform: forkastningen ligger mellom ryggsegmentene', () => {
    const g = plategrenseGeometri({ type: 'transform', x: 0, y: 0, w: 400, h: 260 })!;
    expect(g.dx).toBe(0);
    expect(g.ankere.ryggNord!.x).toBeLessThan(g.ankere.forkastning!.x);
    expect(g.ankere.ryggSor!.x).toBeGreaterThan(g.ankere.forkastning!.x);
  });

  it('gir null for ugyldige mål', () => {
    expect(plategrenseGeometri({ type: 'spredning', w: Number.NaN, h: 300 })).toBeNull();
  });
});

describe('vulkanGeometri', () => {
  it('gir endelige punkter for ytterpunkter', () => {
    for (const type of ['strato', 'skjold'] as const)
      for (const snitt of [false, true])
        for (const utbrudd of [0, 0.4, 1])
          for (const erosjon of [0, 1])
            for (const bredde of [6, 300]) {
              const g = vulkanGeometri({ x: 100, y: 200, bredde, type, snitt, utbrudd, erosjon, vind: 1 })!;
              for (const p of [g.topp, g.krater, g.fot.venstre, g.fot.hoyre, g.lavastrom, g.askesky, g.lavafontene, g.kanal]) {
                if (p) expect(Number.isFinite(p.x) && Number.isFinite(p.y)).toBe(true);
              }
              for (const v of Object.values(g.ramme)) expect(Number.isFinite(v)).toBe(true);
              expect(g.profil(100)).toBeLessThanOrEqual(200);
              expect(g.profil(100 + bredde)).toBe(Infinity);
            }
  });

  it('stratovulkanen er brattere enn skjoldvulkanen, og erosjon gjør den lavere', () => {
    const strato = vulkanGeometri({ x: 0, y: 0, bredde: 300, type: 'strato' })!;
    const skjold = vulkanGeometri({ x: 0, y: 0, bredde: 300, type: 'skjold' })!;
    const erodert = vulkanGeometri({ x: 0, y: 0, bredde: 300, type: 'strato', erosjon: 1 })!;
    expect(strato.hoyde).toBeGreaterThan(2 * skjold.hoyde);
    expect(erodert.hoyde).toBeLessThan(strato.hoyde);
  });

  it('askeskya og lavafontenen vokser med utbruddet og finnes bare ved utbrudd', () => {
    const rolig = vulkanGeometri({ x: 0, y: 0, bredde: 300, type: 'strato' })!;
    const svak = vulkanGeometri({ x: 0, y: 0, bredde: 300, type: 'strato', utbrudd: 0.2 })!;
    const sterk = vulkanGeometri({ x: 0, y: 0, bredde: 300, type: 'strato', utbrudd: 1 })!;
    expect(rolig.askesky).toBeNull();
    expect(sterk.askesky!.y).toBeLessThan(svak.askesky!.y);
    const fontene = vulkanGeometri({ x: 0, y: 0, bredde: 300, type: 'skjold', utbrudd: 0.8 })!;
    expect(fontene.lavafontene!.y).toBeLessThan(fontene.krater.y);
    expect(fontene.lavastrom).not.toBeNull();
    // I snitt finnes magmakammeret under bakken
    const snitt = vulkanGeometri({ x: 0, y: 0, bredde: 300, snitt: true })!;
    expect(snitt.magmakammer!.y).toBeGreaterThan(0);
    expect(snitt.blokk!.dx).toBeGreaterThan(0);
  });

  it('gir null for ugyldige tall', () => {
    expect(vulkanGeometri({ x: Number.NaN, y: 0, bredde: 100 })).toBeNull();
    expect(vulkanGeometri({ x: 0, y: 0, bredde: 0 })).toBeNull();
  });
});

describe('komponentene', () => {
  it('tegner JordasIndre uten NaN, Infinity eller undefined', () => {
    for (const form of ['kile', 'snitt'] as const)
      for (const inndeling of ['kjemisk', 'mekanisk'] as const) {
        const html = svg(createElement(JordasIndre, { x: 150, y: 150, r: 120, form, inndeling, dybde: 2891, markert: 'ytreKjerne', etiketter: true, overflate: 'stein' }));
        expect(html).not.toMatch(UGYLDIG);
        expect(html).toContain('Ytre kjerne');
      }
    expect(svg(createElement(JordasIndre, { x: 0, y: 0, r: 0 }))).toBe('<svg></svg>');
  });

  it('tegner alle plategrensene uten NaN, Infinity eller undefined, også i ytterpunktene', () => {
    for (const type of TYPER)
      for (const [fart, t] of [
        [0, 0],
        [4, 5],
        [30, 100],
      ] as const) {
        let fikk: PlategrenseGeometri | null = null;
        const html = svg(
          createElement(Plategrense, {
            type,
            variant: 'hav-hav',
            x: 10,
            y: 80,
            w: 600,
            h: 260,
            fart,
            t,
            striper: true,
            etiketter: true,
            children: (g: PlategrenseGeometri) => {
              fikk = g;
              return null;
            },
          }),
        );
        expect(html).not.toMatch(UGYLDIG);
        expect(fikk).not.toBeNull();
      }
    const flat = svg(createElement(Plategrense, { type: 'subduksjon', w: 500, h: 220, dybde: 0, etiketter: true }));
    expect(flat).not.toMatch(UGYLDIG);
    expect(flat).toContain('Havgrop');
  });

  it('tegner vulkanene uten NaN, Infinity eller undefined', () => {
    for (const type of ['strato', 'skjold'] as const)
      for (const snitt of [false, true])
        for (const utbrudd of [0, 0.6, 1]) {
          const html = svg(createElement(Vulkan, { x: 200, y: 200, bredde: 260, type, snitt, utbrudd, erosjon: utbrudd === 0 ? 0.9 : 0, etiketter: true, sno: true }));
          expect(html).not.toMatch(UGYLDIG);
        }
    expect(svg(createElement(Vulkan, { x: 0, y: 0, bredde: -4 }))).toBe('<svg></svg>');
  });
});
