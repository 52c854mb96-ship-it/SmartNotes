import { createElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import {
  BRONN_NAVN,
  Bronn,
  Grunnvannssnitt,
  Nedbor,
  Skydekke,
  SpeilSymbol,
  Stromlinjer,
  bronnPunkter,
  grunnvannGeometri,
  langsSti,
  senkningstrakt,
  stiLengde,
  stromBredde,
  type BronnType,
  type StromStil,
} from './vann';

const svg = (child: ReactNode) => renderToStaticMarkup(createElement('svg', null, child));
const UGYLDIG = /NaN|Infinity|undefined/;

describe('senkningstrakt', () => {
  it('er lik speilet uten brønner og utenfor influensradien', () => {
    const f = senkningstrakt(100);
    expect(f(0)).toBe(100);
    const g = senkningstrakt(100, { x: 300, senkning: 40, radius: 200 });
    expect(g(300 + 200)).toBeCloseTo(100, 9);
    expect(g(300 - 250)).toBe(100);
  });

  it('senker speilet med hele senkningen ved brønnen og følger Thiem (ln R/r) utover', () => {
    const g = senkningstrakt(100, { x: 300, senkning: 40, radius: 200, rBronn: 5 });
    expect(g(300)).toBeCloseTo(140, 9);
    expect(g(303)).toBeCloseTo(140, 9); // innenfor brønnradien
    // r = 20: s = 40 · ln(200/20) / ln(200/5)
    expect(g(320)).toBeCloseTo(100 + (40 * Math.log(10)) / Math.log(40), 9);
    // Symmetrisk og avtagende utover
    expect(g(280)).toBeCloseTo(g(320), 9);
    expect(g(350)).toBeLessThan(g(320));
  });

  it('legger sammen senkningen fra to brønner der traktene overlapper', () => {
    const a = { x: 200, senkning: 30, radius: 200 };
    const b = { x: 400, senkning: 20, radius: 200 };
    const begge = senkningstrakt(50, a, b);
    expect(begge(300) - 50).toBeCloseTo(senkningstrakt(50, a)(300) - 50 + (senkningstrakt(50, b)(300) - 50), 9);
  });

  it('følger et skrånende speil og hopper over ugyldige brønner', () => {
    const g = senkningstrakt((x) => 100 + 0.1 * x, { x: Number.NaN, senkning: 10, radius: 100 }, { x: 0, senkning: 10, radius: 0 });
    expect(g(100)).toBeCloseTo(110, 9);
    for (const x of [-1e9, 0, 50, Number.NaN, Number.POSITIVE_INFINITY]) expect(Number.isFinite(g(x))).toBe(true);
    const h = senkningstrakt(Number.NaN, { x: 0, senkning: Number.NaN, radius: 50 });
    expect(Number.isFinite(h(0))).toBe(true);
  });
});

describe('grunnvannGeometri', () => {
  it('har standardverdier og finner ingen innsjø når speilet ligger under bakken', () => {
    const g = grunnvannGeometri({ w: 600, h: 300 });
    expect(g.overflate(100)).toBeCloseTo(45, 9);
    expect(g.speil(100)).toBeCloseTo(135, 9);
    expect(g.kapillar).toBeCloseTo(15, 9);
    expect(g.kapillarTopp(100)).toBeCloseTo(120, 9);
    expect(g.innsjoer).toEqual([]);
    expect(g.dybdeTilSpeil(100)).toBeCloseTo(90, 9);
  });

  it('finner en innsjø med vannrett vannflate der speilet står over bakken i en dal', () => {
    const w = 600;
    const overflate = (x: number) => 60 + 60 * Math.exp(-(((x - 300) / 60) ** 2));
    const speil = 90;
    const g = grunnvannGeometri({ w, h: 300, overflate, speil });
    expect(g.innsjoer).toHaveLength(1);
    const s = g.innsjoer[0]!;
    // Bredden: overflate(x) = 90 ⇔ exp(−((x−300)/60)²) = 0,5
    const halv = 60 * Math.sqrt(Math.log(2));
    expect(s.fra).toBeCloseTo(300 - halv, 0);
    expect(s.til).toBeCloseTo(300 + halv, 0);
    expect(s.niva).toBeCloseTo(90, 1);
    expect(g.topp(300)).toBeCloseTo(s.niva, 9);
    expect(g.topp(100)).toBeCloseTo(overflate(100), 9);
    expect(g.dybdeTilSpeil(300)).toBe(0);
  });

  it('begrenser kapillærsonen til bakken og tåler kapillar = false', () => {
    const g = grunnvannGeometri({ w: 400, h: 200, overflate: 50, speil: 55, kapillar: 20 });
    expect(g.kapillarTopp(10)).toBe(50);
    expect(grunnvannGeometri({ w: 400, h: 200, kapillar: false }).kapillar).toBe(0);
  });

  it('gir endelige tall for ugyldige verdier', () => {
    const g = grunnvannGeometri({ w: Number.NaN, h: -5, overflate: () => Number.NaN, speil: Number.POSITIVE_INFINITY, kapillar: Number.NaN });
    for (const x of [0, 1, Number.NaN]) {
      expect(Number.isFinite(g.overflate(x))).toBe(true);
      expect(Number.isFinite(g.speil(x))).toBe(true);
      expect(Number.isFinite(g.kapillarTopp(x))).toBe(true);
      expect(Number.isFinite(g.topp(x))).toBe(true);
    }
    for (const s of g.innsjoer) expect([s.fra, s.til, s.niva].every(Number.isFinite)).toBe(true);
  });
});

describe('stier og strømmer', () => {
  it('måler en rett sti og finner punktet og retningen langs den', () => {
    const p = [
      [0, 0],
      [100, 0],
    ] as const;
    expect(stiLengde(p)).toBeCloseTo(100, 6);
    expect(langsSti(p, 0.25)).toEqual({ x: 25, y: 0, vinkel: 0 });
    const ned = langsSti(
      [
        [10, 0],
        [10, 50],
      ],
      1,
    );
    expect(ned?.y).toBeCloseTo(50, 6);
    expect(ned?.vinkel).toBeCloseTo(90, 6);
  });

  it('går gjennom punktene også når stien glattes, og lukker en sløyfe', () => {
    const p = [
      [0, 0],
      [100, 50],
      [200, 0],
    ] as const;
    const midt = langsSti(p, 0.5);
    expect(midt?.x).toBeCloseTo(100, 0);
    expect(midt?.y).toBeCloseTo(50, 0);
    const kvadrat = [
      [0, 0],
      [100, 0],
      [100, 100],
      [0, 100],
    ] as const;
    expect(stiLengde(kvadrat, { glatt: false, lukket: true })).toBeCloseTo(400, 6);
    expect(stiLengde(kvadrat, { glatt: false })).toBeCloseTo(300, 6);
  });

  it('gir null eller 0 for stier uten lengde', () => {
    expect(langsSti([], 0.5)).toBeNull();
    expect(langsSti([[5, 5]], 0.5)).toBeNull();
    expect(langsSti([[Number.NaN, 0], [Number.NaN, 1]], 0.5)).toBeNull();
    expect(stiLengde([[1, 1], [1, 1]])).toBe(0);
    const p = langsSti([[0, 0], [10, 0]], Number.NaN);
    expect(p?.x).toBe(0);
  });

  it('gjør bredden proporsjonal med mengden, med minste bredde og uten NaN', () => {
    expect(stromBredde(413, 413)).toBe(18);
    expect(stromBredde(206.5, 413, 20)).toBeCloseTo(10, 9);
    expect(stromBredde(1, 413)).toBe(1.5);
    expect(stromBredde(Number.NaN, 413)).toBe(1.5);
    expect(stromBredde(10, 0)).toBe(1.5);
    expect(stromBredde(10, 5, Number.NaN, Number.NaN)).toBe(18);
  });
});

describe('bronnPunkter', () => {
  it('legger pumpen under vannstanden og ledningen under bakken', () => {
    const p = bronnPunkter({ x: 300, y: 100, bunn: 400, vannstand: 180, fjell: 160, type: 'fjell', tilkobling: 'venstre' });
    expect(p.vannstand).toEqual({ x: 300, y: 180 });
    expect(p.pumpe!.y).toBeGreaterThan(180);
    expect(p.pumpe!.y).toBeLessThan(400);
    expect(p.ledningY).toBeGreaterThan(100);
    expect(p.utlop!.x).toBeLessThan(300);
    expect(p.topp.y).toBeLessThan(100);
    expect(p.bunn).toEqual({ x: 300, y: 400 });
  });

  it('har filter i en løsmassebrønn og ingen pumpe i en observasjonsbrønn', () => {
    const l = bronnPunkter({ x: 0, y: 0, bunn: 200, vannstand: 60, type: 'losmasse', filter: [150, 190] });
    expect(l.filter).toEqual({ x: 0, y: 170 });
    const o = bronnPunkter({ x: 0, y: 0, bunn: 200, vannstand: 60, type: 'observasjon' });
    expect(o.pumpe).toBeNull();
    expect(o.filter!.y).toBeGreaterThan(150);
    expect(bronnPunkter({ x: 0, y: 0, bunn: 100, type: 'borehull' }).vannstand).toBeNull();
  });

  it('gir endelige tall for ugyldige verdier', () => {
    const p = bronnPunkter({ x: Number.NaN, y: Number.NaN, bunn: Number.NaN, vannstand: Number.NaN, fjell: Number.NaN, pumpeDybde: Number.NaN, tilkobling: 'hoyre', tilkoblingLengde: Number.NaN, bredde: Number.NaN }, Number.NaN);
    const tall = [p.topp.x, p.topp.y, p.bunn.x, p.bunn.y, p.bredde, p.ledningY, p.utlop!.x, p.utlop!.y, p.pumpe!.x, p.pumpe!.y];
    for (const v of tall) expect(Number.isFinite(v)).toBe(true);
  });
});

describe('komponentene', () => {
  it('tegner grunnvannssnittet med soner, innsjø, etiketter og barn uten NaN', () => {
    for (const etiketter of ['hoyre', 'inne', false] as const) {
      const ut = svg(
        createElement(Grunnvannssnitt, {
          w: 600,
          h: 300,
          overflate: (x: number) => 60 + 60 * Math.exp(-(((x - 300) / 60) ** 2)),
          speil: senkningstrakt(90, { x: 150, senkning: 30, radius: 120 }),
          lag: [{ type: 'granitt', topp: 250, navn: 'Fjell' }, { type: 'leire', topp: 200, tett: true, navn: 'Leire' }, { type: 'sand', navn: 'Sand' }],
          etiketter,
          children: createElement('circle', { cx: 10, cy: 10, r: 2 }),
          over: createElement('rect', { width: 4, height: 4 }),
        }),
      );
      expect(ut).not.toMatch(UGYLDIG);
      expect(ut).toContain('<circle');
    }
    const tekst = svg(createElement(Grunnvannssnitt, { w: 600, h: 300, etiketter: 'hoyre' }));
    expect(tekst).toContain('Mettet sone');
    expect(tekst).toContain('Grunnvannsspeil');
  });

  it('tegner ingenting eller noe gyldig med ugyldige mål', () => {
    expect(svg(createElement(Grunnvannssnitt, { w: Number.NaN, h: 100 }))).toBe('<svg></svg>');
    const ut = svg(
      createElement(Grunnvannssnitt, { w: 300, h: 200, overflate: () => Number.NaN, speil: Number.NaN, kapillar: Number.NaN, dybde: Number.NaN, vinkel: Number.NaN, etikettX: Number.NaN, etiketter: 'hoyre' }),
    );
    expect(ut).not.toMatch(UGYLDIG);
  });

  it('tegner alle brønntypene, også med ytterverdier, uten NaN', () => {
    for (const type of Object.keys(BRONN_NAVN) as BronnType[]) {
      const ut = svg(createElement(Bronn, { x: 100, y: 50, bunn: 300, vannstand: 120, fjell: 100, type, tilkobling: 'hoyre', peilebaand: true, pumpe: true }));
      expect(ut).not.toMatch(UGYLDIG);
      const tom = svg(createElement(Bronn, { x: 100, y: 50, bunn: 40, vannstand: 400, fjell: Number.NaN, type, filter: [Number.NaN, 2] }));
      expect(tom).not.toMatch(UGYLDIG);
    }
    expect(svg(createElement(Bronn, { x: Number.NaN, y: 0, bunn: 10 }))).toBe('<svg></svg>');
  });

  it('tegner nedbør og skydekke med og uten tid, også med ytterverdier', () => {
    for (const type of ['regn', 'sno', 'sludd'] as const) {
      for (const intensitet of [0, 0.5, 1, Number.NaN]) {
        const ut = svg(createElement(Nedbor, { w: 400, h: 200, type, intensitet, vind: 3, t: 12.3, bakke: (x: number) => 180 - 0.1 * x, skydekke: { tetthet: Number.NaN, avrundet: true } }));
        expect(ut).not.toMatch(UGYLDIG);
      }
    }
    expect(svg(createElement(Nedbor, { w: 0, h: 100 }))).toBe('<svg></svg>');
    for (const tetthet of [0, 1, Number.NaN]) {
      expect(svg(createElement(Skydekke, { w: 300, h: 60, tetthet, himmel: 200, toppkant: true }))).not.toMatch(UGYLDIG);
    }
    expect(svg(createElement(SpeilSymbol, { x: Number.NaN, y: 0 }))).toBe('<svg></svg>');
  });

  it('tegner alle strømstilene, åpne og lukkede, uten NaN', () => {
    const punkter = [
      [0, 0],
      [100, 30],
      [200, -10],
    ] as const;
    for (const stil of ['baand', 'linje', 'stiplet', 'prikker', 'front'] as StromStil[]) {
      for (const lukket of [false, true]) {
        const ut = svg(createElement(Stromlinjer, { punkter, stil, lukket, farge: 'red', t: 3.3, bredde: 10, label: 'Strøm' }));
        expect(ut).not.toMatch(UGYLDIG);
      }
    }
    const tom = svg(createElement(Stromlinjer, { linjer: [{ punkter: [[0, 0]] }, { punkter: [[0, 0], [0, 0]] }], farge: 'red', t: Number.NaN, fart: Number.NaN, avstand: Number.NaN }));
    expect(tom).not.toMatch(UGYLDIG);
  });
});

describe('etikettene i vannfigurene holder seg unna', () => {
  const tekster = (html: string, t: string) =>
    [...html.matchAll(/<text x="([-\d.]+)" y="([-\d.]+)" text-anchor="(\w+)"[^>]*>([^<]*)<\/text>/g)].filter((m) => m[4] === t).map((m) => ({ x: Number(m[1]), y: Number(m[2]), anchor: m[3] }));

  it('Stromlinjer holder etiketten inne i rammen og unna pilspissen', () => {
    // En strøm helt ved venstre kant med etiketten til venstre: den må bytte side eller flyttes inn
    const html = svg(createElement(Stromlinjer, { farge: '#000', punkter: [[20, 300], [30, 150], [60, 40]], label: 'Fordamping 73', labelSide: 'venstre', ramme: { x0: 0, y0: 0, x1: 400, y1: 320 } }));
    const [t] = tekster(html, 'Fordamping 73');
    expect(t).toBeDefined();
    const b = 'Fordamping 73'.length * 0.58 * 17 * 0.8;
    const x0 = t!.anchor === 'start' ? t!.x : t!.anchor === 'end' ? t!.x - b : t!.x - b / 2;
    expect(x0).toBeGreaterThanOrEqual(-1);
    // Etiketten står ikke ved enden av en kort pil (der spissen er)
    const kort = svg(createElement(Stromlinjer, { farge: '#000', punkter: [[100, 100], [260, 100]], bredde: 20, label: 'Avrenning 40', labelPos: 1 }));
    const [k] = tekster(kort, 'Avrenning 40');
    expect(k!.x).toBeLessThan(240);
    expect(html).not.toMatch(/NaN|Infinity/);
  });

  it('Grunnvannssnitt setter «Grunnvannsspeil» over speilet, borte fra brønnene i unnga', () => {
    const w = 760;
    const h = 300;
    const speil = senkningstrakt(0.42 * h, { x: 0.34 * w, senkning: 46, radius: 240, rBronn: 8 }, { x: 0.7 * w, senkning: 30, radius: 200, rBronn: 8 });
    const unnga = [0.34 * w, 0.7 * w, 0.52 * w];
    const html = svg(createElement(Grunnvannssnitt, { w, h, dybde: 0, overflate: 0.14 * h, speil, etiketter: 'inne', unnga }));
    const [t] = tekster(html, 'Grunnvannsspeil');
    expect(t).toBeDefined();
    const b = 'Grunnvannsspeil'.length * 0.58 * 17 * 0.74;
    for (const ux of unnga) expect(ux < t!.x - 4 || ux > t!.x + b + 4, `brønn ved ${ux}`).toBe(true);
    // Over speilet: grunnlinja ligger ikke under speilet noe sted under teksten
    for (let i = 0; i <= 10; i++) expect(t!.y).toBeLessThanOrEqual(speil(t!.x + (i / 10) * b) + 0.5);
    expect(html).not.toMatch(/NaN|Infinity/);
  });

  it('Nedbor tegner skyer som standard, og ingen med skydekke={false}', () => {
    const med = svg(createElement(Nedbor, { w: 400, h: 200, intensitet: 0.2 }));
    const uten = svg(createElement(Nedbor, { w: 400, h: 200, intensitet: 0.2, skydekke: false }));
    expect((med.match(/<ellipse/g) ?? []).length).toBeGreaterThan(5);
    expect((uten.match(/<ellipse/g) ?? []).length).toBe(0);
  });
});
