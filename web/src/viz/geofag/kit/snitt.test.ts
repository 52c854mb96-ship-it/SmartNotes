import { createElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import {
  Borekjerne,
  Lagpakke,
  SnittEtiketter,
  SnittGang,
  SnittMagmakammer,
  Snittblokk,
  lagflate,
  lagpakkeDybder,
  lagpakkeOppsett,
  snittFordelEtiketter,
  snittGeologi,
  snittblokkPerspektiv,
  useSnittblokk,
  type LagpakkeLag,
  type SnittLag,
} from './snitt';

const svg = (child: ReactNode) => renderToStaticMarkup(createElement('svg', null, child));
const UGYLDIG = /NaN|Infinity|undefined/;

/** Tre flate lag: gneis under 200, sandstein 120–200, leirskifer 60–120 og luft over 60. */
const flate: SnittLag[] = [
  { type: 'gneis', topp: 200 },
  { type: 'sandstein', topp: 120 },
  { type: 'leirskifer', topp: 60 },
];

describe('snittFordelEtiketter', () => {
  it('lar etiketter som får plass, stå der de vil', () => {
    expect(snittFordelEtiketter([10, 50, 90], [10, 10, 10], 0, 100)).toEqual([10, 50, 90]);
  });

  it('skyver tette etiketter fra hverandre i samme rekkefølge', () => {
    expect(snittFordelEtiketter([10, 12, 14], [10, 10, 10], 0, 100)).toEqual([10, 20, 30]);
    // Usortert inn: rekkefølgen på plassene følger ønsket, og svaret har samme rekkefølge som inn
    expect(snittFordelEtiketter([14, 10, 12], [10, 10, 10], 0, 100)).toEqual([30, 10, 20]);
  });

  it('skyver etiketter som går ut nederst, tilbake opp', () => {
    expect(snittFordelEtiketter([95, 96, 97], [10, 10, 10], 0, 100)).toEqual([75, 85, 95]);
  });

  it('gir bare endelige tall, også med ugyldige verdier', () => {
    const c = snittFordelEtiketter([Number.NaN, 20, Number.POSITIVE_INFINITY], [10, Number.NaN, -4], Number.NaN, Number.NaN);
    expect(c).toHaveLength(3);
    for (const v of c) expect(Number.isFinite(v)).toBe(true);
    expect(snittFordelEtiketter([], [], 0, 100)).toEqual([]);
  });
});

describe('lagflate', () => {
  it('er vannrett uten valg', () => {
    const f = lagflate(120);
    expect(f(-500)).toBe(120);
    expect(f(800)).toBe(120);
  });

  it('heller ned mot høyre med positivt fall (y øker mot høyre)', () => {
    const f = lagflate(100, { fall: 45, midt: 200 });
    expect(f(200)).toBeCloseTo(100, 9);
    expect(f(300)).toBeCloseTo(200, 9);
    expect(f(100)).toBeCloseTo(0, 9);
  });

  it('har toppen av antiklinalen i midt (minst y) og bunnen av synklinalen en halv bølgelengde unna', () => {
    const f = lagflate(100, { amplitude: 30, bolgelengde: 400, midt: 250 });
    expect(f(250)).toBeCloseTo(70, 9);
    expect(f(450)).toBeCloseTo(130, 9);
    const syn = lagflate(100, { amplitude: -30, bolgelengde: 400, midt: 250 });
    expect(syn(250)).toBeCloseTo(130, 9);
  });

  it('hever lagene rundt midt med en kuppel', () => {
    const f = lagflate(200, { kuppel: { hoyde: 50, bredde: 60 }, midt: 300 });
    expect(f(300)).toBeCloseTo(150, 9);
    expect(f(300 + 60)).toBeCloseTo(200 - 50 * Math.exp(-0.5), 9);
    expect(f(1000)).toBeCloseTo(200, 6);
  });

  it('gir endelige tall også med ugyldige valg', () => {
    const f = lagflate(Number.NaN, { fall: Number.NaN, amplitude: Number.NaN, bolgelengde: 0, midt: Number.NaN, kuppel: { hoyde: 10, bredde: 0 } });
    for (const x of [-100, 0, 100, Number.NaN]) expect(Number.isFinite(f(x))).toBe(true);
    // Fall over 85° kappes, så flaten aldri blir loddrett
    expect(Number.isFinite(lagflate(0, { fall: 90 })(10))).toBe(true);
  });
});

describe('snittblokkPerspektiv', () => {
  it('forskyver bakkanten dybde · cos og dybde · sin av vinkelen', () => {
    const p = snittblokkPerspektiv(100, 30);
    expect(p.dx).toBeCloseTo(86.6, 1);
    expect(p.dy).toBeCloseTo(50, 1);
  });

  it('bruker standardverdier (70 og 34°) for manglende eller ugyldige tall og kapper vinkelen ved 80°', () => {
    expect(snittblokkPerspektiv()).toEqual(snittblokkPerspektiv(70, 34));
    expect(snittblokkPerspektiv(Number.NaN, Number.NaN)).toEqual(snittblokkPerspektiv(70, 34));
    expect(snittblokkPerspektiv(0)).toEqual({ dx: 0, dy: 0 });
    expect(snittblokkPerspektiv(-20)).toEqual({ dx: 0, dy: 0 });
    expect(snittblokkPerspektiv(100, 120)).toEqual(snittblokkPerspektiv(100, 80));
  });
});

describe('snittGeologi', () => {
  it('finner laget i et punkt for flate lag, og −1 i lufta', () => {
    const g = snittGeologi(flate, [], 300);
    expect(g.lagVed(50, 250)).toBe(0);
    expect(g.lagVed(50, 150)).toBe(1);
    expect(g.lagVed(50, 90)).toBe(2);
    expect(g.lagVed(50, 30)).toBe(-1);
    // Det eldste laget fortsetter under bunnen av snittet
    expect(g.lagVed(50, 5000)).toBe(0);
  });

  it('senker hengblokka langs en normalforkastning, så yngre lag ligger dypere der', () => {
    const g = snittGeologi(flate, [{ x: 300, fall: 60, sprang: 40 }], 300);
    // Liggblokka (til venstre) er urørt
    expect(g.lagVed(100, 130)).toBe(1);
    // I hengblokka (til høyre) ligger leirskiferen nå på 130 m (forskyvning 40 · sin 60° ≈ 34,6 nedover)
    expect(g.lagVed(500, 130)).toBe(2);
    expect(g.lagVed(500, 160)).toBe(1);
    expect(g.lagVed(500, 70)).toBe(-1);
    expect(g.forkastninger[0]!.vx).toBeCloseTo(20, 1);
    expect(g.forkastninger[0]!.vy).toBeCloseTo(34.64, 1);
    expect(g.forkastninger[0]!.hengblokk(500, 100)).toBe(true);
    expect(g.forkastninger[0]!.hengblokk(100, 100)).toBe(false);
    expect(g.margin).toBeCloseTo(24 + 20, 1);
  });

  it('løfter hengblokka langs en reversforkastning (negativt sprang)', () => {
    const g = snittGeologi(flate, [{ x: 300, fall: 45, heller: 'venstre', sprang: -40 }], 300);
    // Hengblokka er til venstre og er løftet: sandsteinen når høyere opp der
    const loft = 40 * Math.sin(Math.PI / 4);
    expect(g.lagVed(50, 120 - loft + 3)).toBe(1);
    expect(g.lagVed(600, 120 - loft + 3)).toBe(2);
  });

  it('lar yngre lag over en erosjonsflate ligge urørt når forkastningen bare skjærer de eldste lagene', () => {
    const lag: SnittLag[] = [...flate, { type: 'morene', topp: 30, bunn: 80, erosjon: true }];
    const g = snittGeologi(lag, [{ x: 300, fall: 60, sprang: 40, lag: 3 }], 300);
    // Morenen ligger likt på begge sider
    expect(g.lagVed(100, 50)).toBe(3);
    expect(g.lagVed(500, 50)).toBe(3);
    // Under erosjonsflaten er lagene forskjøvet
    expect(g.lagVed(500, 130)).toBe(2);
    expect(g.lagVed(100, 130)).toBe(1);
    // Over morenen er det luft
    expect(g.lagVed(500, 20)).toBe(-1);
  });

  it('fjerner det eldre som lå over en erosjonsflate', () => {
    const lag: SnittLag[] = [
      { type: 'kalkstein', topp: lagflate(150, { fall: 30, midt: 200 }) },
      { type: 'leirskifer', topp: -500 },
      { type: 'sandstein', topp: 40, bunn: 100, erosjon: true },
    ];
    const g = snittGeologi(lag, [], 300);
    // Over flaten (y < 100) er det bare sandstein, under er de skrå lagene
    expect(g.lagVed(50, 90)).toBe(2);
    expect(g.lagVed(350, 90)).toBe(2);
    expect(g.lagVed(50, 110)).toBe(0);
    expect(g.lagVed(350, 110)).toBe(1);
  });

  it('finner polygoner (intrusjoner) og hopper over ugyldige lag', () => {
    const lag: SnittLag[] = [
      { type: 'gneis', topp: 0 },
      { type: 'granitt', punkter: [[100, 300], [150, 100], [250, 100], [300, 300]] },
      { type: 'sandstein', topp: Number.NaN },
      { type: 'leire', punkter: [[0, 0], [Number.NaN, 4]] },
    ];
    const g = snittGeologi(lag, [], 300);
    expect(g.lagVed(200, 200)).toBe(1);
    expect(g.lagVed(50, 200)).toBe(0);
    expect(g.topp[2]).toBeNull();
    expect(g.polygoner[3]).toBeNull();
    expect(g.lagVed(Number.NaN, 10)).toBe(-1);
    expect(g.lagVed(10, Number.POSITIVE_INFINITY)).toBe(-1);
  });

  it('gir en tom geologi for en tom liste', () => {
    const g = snittGeologi([], [], 300);
    expect(g.lagVed(10, 10)).toBe(-1);
    expect(g.margin).toBe(24);
  });
});

describe('lagpakkeDybder', () => {
  it('gir lagene ovenfra og ned med dybden fra toppen av pakka, og hopper over tomme lag', () => {
    const lag: LagpakkeLag[] = [
      { type: 'gneis', tykkelse: 2 },
      { type: 'sand', tykkelse: 0 },
      { type: 'leire', tykkelse: Number.NaN },
      { type: 'torv', tykkelse: 3 },
    ];
    const { intervaller, total } = lagpakkeDybder(lag);
    expect(total).toBe(5);
    expect(intervaller).toEqual([
      { indeks: 3, topp: 0, bunn: 3, tykkelse: 3 },
      { indeks: 0, topp: 3, bunn: 5, tykkelse: 2 },
    ]);
    expect(lagpakkeDybder([])).toEqual({ intervaller: [], total: 0 });
  });
});

describe('lagpakkeOppsett', () => {
  const lag: LagpakkeLag[] = [
    { type: 'gneis', tykkelse: 6, navn: 'Grunnfjell (gneis)' },
    { type: 'sandstein', tykkelse: 10, tekst: 'skråsjikt' },
    { type: 'leirskifer', tykkelse: 7 },
  ];

  it('setter etikettene til høyre når de får plass, ellers i en forklaring under', () => {
    const bred = lagpakkeOppsett({ bredde: 600, hoyde: 240, lag });
    expect(bred.plassering).toBe('hoyre');
    expect(bred.forklaring).toBeNull();
    const smal = lagpakkeOppsett({ bredde: 200, hoyde: 240, lag }, 1.8);
    expect(smal.plassering).toBe('under');
    expect(smal.forklaring).not.toBeNull();
    // Forklaringen gjør komponenten høyere enn kolonnen
    expect(smal.hoyde).toBeGreaterThan(smal.kolonneY + smal.kolonneHoyde);
  });

  it('har dybdeakse i målestokk med pene merker fra 0 til samlet tykkelse', () => {
    const o = lagpakkeOppsett({ bredde: 600, hoyde: 230, lag });
    expect(o.skala).toBeCloseTo(230 / 23, 9);
    expect(o.merker[0]).toBe(0);
    expect(o.merker[o.merker.length - 1]!).toBeLessThanOrEqual(23);
    expect(o.desimaler).toBe(0);
    expect(lagpakkeOppsett({ bredde: 600, hoyde: 230, lag: [{ type: 'salt', tykkelse: 0.004 }] }).desimaler).toBe(3);
  });

  it('respekterer valgene for akse, pil og etiketter', () => {
    const o = lagpakkeOppsett({ bredde: 300, hoyde: 200, lag, dybdeakse: false, yngre: false, etiketter: 'ingen' });
    expect(o.aksX).toBeNull();
    expect(o.pilX).toBeNull();
    expect(o.merker).toEqual([]);
    expect(o.plassering).toBe('ingen');
    expect(o.kolonneX).toBe(0);
  });

  it('gir bare endelige tall, også med ugyldige mål, ugyldig f og tom liste', () => {
    for (const o of [
      lagpakkeOppsett({ bredde: Number.NaN, hoyde: Number.NaN, lag }, Number.NaN),
      lagpakkeOppsett({ bredde: 300, hoyde: 200, lag: [] }),
      lagpakkeOppsett({ bredde: -10, hoyde: 0, lag, kolonne: Number.NaN }, 0),
    ]) {
      for (const v of [o.hoyde, o.kolonneX, o.kolonneY, o.kolonneBredde, o.kolonneHoyde, o.etikettX, o.skala, ...o.merker]) {
        expect(Number.isFinite(v)).toBe(true);
      }
    }
  });
});

describe('rendring', () => {
  const skra: SnittLag[] = [
    { type: 'kalkstein', topp: lagflate(200, { fall: 20, midt: 200 }) },
    { type: 'leirskifer', topp: lagflate(140, { fall: 20, midt: 200 }) },
    { type: 'siltstein', topp: -300 },
    { type: 'konglomerat', topp: 60, bunn: 100, erosjon: true, navn: 'Konglomerat', undertekst: 'på erosjonsflate' },
  ];

  it('tegner en Snittblokk med vann, is, forkastning, barn og etiketter uten ugyldige tall', () => {
    const html = svg(
      createElement(
        Snittblokk,
        {
          x: 10,
          y: 60,
          w: 400,
          h: 240,
          lag: skra,
          forkastninger: [{ x: 260, y: 100, sprang: 30, lag: 3 }],
          vann: [{ niva: 70, fra: 300, type: 'fjord' }],
          is: { topp: 40, til: 120 },
          mark: (_x: number, y: number) => (y < 62 ? 'sno' : 'gress'),
          etiketter: true,
        },
        createElement(SnittGang, { fra: [100, 240], til: [140, 0] }),
        createElement(SnittMagmakammer, { x: 200, y: 230, rx: 60, ry: 20, kanal: 230 }),
      ),
    );
    expect(html).not.toMatch(UGYLDIG);
    expect(html).toContain('clipPath');
    expect(html).toContain('Konglomerat');
    expect(html).toContain('på erosjonsflate');
  });

  it('tegner berggrunnskart på toppen og blokker uten perspektiv', () => {
    for (const props of [
      { w: 300, h: 200, lag: skra, mark: 'kart' as const, overflate: 80 },
      { w: 300, h: 200, lag: skra, dybde: 0 },
      { w: 300, h: 200, lag: skra, dybde: 200, vinkel: 80 },
    ]) {
      expect(svg(createElement(Snittblokk, props))).not.toMatch(UGYLDIG);
    }
  });

  it('tåler ugyldige mål og lag', () => {
    const html = svg(
      createElement(Snittblokk, {
        x: Number.NaN,
        y: Number.NaN,
        w: Number.NaN,
        h: Number.NaN,
        lag: [{ type: 'sandstein', topp: Number.NaN }, { type: 'kalkstein', topp: () => Number.NaN }],
        forkastninger: [{ x: Number.NaN, sprang: Number.NaN, fall: Number.NaN }],
        vann: { niva: Number.NaN },
        dybde: Number.NaN,
      }),
    );
    expect(html).not.toMatch(UGYLDIG);
    expect(svg(createElement(Snittblokk, { w: 300, h: 200, lag: [] }))).not.toMatch(UGYLDIG);
  });

  it('gir barna mønster-id, mål og overflate gjennom useSnittblokk', () => {
    let funnet: ReturnType<typeof useSnittblokk> = null;
    function Barn() {
      funnet = useSnittblokk();
      return null;
    }
    svg(createElement(Snittblokk, { w: 300, h: 200, lag: flate, dybde: 40 }, createElement(Barn)));
    expect(funnet).not.toBeNull();
    const info = funnet as unknown as NonNullable<ReturnType<typeof useSnittblokk>>;
    expect(info.w).toBe(300);
    expect(info.h).toBe(200);
    expect(info.overflate(150)).toBeCloseTo(60, 0);
    expect(info.geologi.lagVed(150, 150)).toBe(1);
    expect(info.monstre).toMatch(/^snitt/);
    // Utenfor en Snittblokk er det ingen
    let utenfor: ReturnType<typeof useSnittblokk> = null;
    function Utenfor() {
      utenfor = useSnittblokk();
      return null;
    }
    svg(createElement(Utenfor));
    expect(utenfor).toBeNull();
  });

  it('tegner gang og magmakammer også utenfor en Snittblokk, og ingenting for ugyldige mål', () => {
    expect(svg(createElement(SnittGang, { fra: [0, 100], til: [40, 0], type: 'basalt' }))).toContain('<pattern');
    expect(svg(createElement(SnittMagmakammer, { x: 50, y: 50, rx: 30, ry: 12, stivnet: true }))).toContain('<pattern');
    expect(svg(createElement(SnittGang, { fra: [0, 0], til: [0, 0] }))).toBe('<svg></svg>');
    expect(svg(createElement(SnittMagmakammer, { x: 50, y: 50, rx: 0, ry: 12 }))).toBe('<svg></svg>');
  });

  it('tegner Lagpakke med etiketter til høyre og under, og ingenting for en tom liste', () => {
    const lag: LagpakkeLag[] = [
      { type: 'gneis', tykkelse: 2, navn: 'Berggrunn' },
      { type: 'morene', tykkelse: 3, erosjon: true },
      { type: 'kvikkleire', tykkelse: 2, uthevet: true, tekst: 'omrørt under 0,5 kPa' },
      { type: 'torv', tykkelse: 0.5 },
    ];
    const hoyre = svg(createElement(Lagpakke, { x: 0, y: 0, bredde: 500, hoyde: 220, lag }));
    expect(hoyre).not.toMatch(UGYLDIG);
    expect(hoyre).toContain('Berggrunn');
    expect(hoyre).toContain('yngre');
    expect(hoyre).toContain('Dyp (m)');
    const under = svg(createElement(Lagpakke, { x: 0, y: 0, bredde: 300, hoyde: 220, lag, etiketter: 'under', profil: 'korn', gress: true }));
    expect(under).not.toMatch(UGYLDIG);
    expect(under).toContain('Kvikkleire');
    expect(svg(createElement(Lagpakke, { x: 0, y: 0, bredde: 300, hoyde: 220, lag: [] }))).toBe('<svg></svg>');
  });

  it('tegner Borekjerne med varv, prøver og brudd, og hopper over prøver utenfor kjernen', () => {
    const html = svg(
      createElement(Borekjerne, {
        x: 100,
        y: 20,
        bredde: 50,
        hoyde: 240,
        lag: [
          { type: 'morene', tykkelse: 1 },
          { type: 'leire', tykkelse: 2, varv: 30 },
        ],
        prover: [
          { dybde: 0.5, navn: 'Prøve A', tekst: '9 800 år' },
          { dybde: 9, navn: 'Utenfor' },
          { dybde: Number.NaN, navn: 'Ugyldig' },
        ],
        etiketter: true,
        dybdeakse: true,
        brudd: 3,
      }),
    );
    expect(html).not.toMatch(UGYLDIG);
    expect(html).toContain('Prøve A');
    expect(html).not.toContain('Utenfor');
    expect(html).not.toContain('Ugyldig');
    expect(svg(createElement(Borekjerne, { x: 0, y: 0, bredde: 40, lag: [] }))).toBe('<svg></svg>');
    expect(svg(createElement(Borekjerne, { x: 0, y: 0, bredde: 40, pxPerEnhet: 20, lag: [{ type: 'sand', tykkelse: 2 }] }))).not.toMatch(UGYLDIG);
  });

  it('tegner SnittEtiketter uten å la etikettene overlappe', () => {
    const html = svg(
      createElement(SnittEtiketter, {
        x: 300,
        topp: 0,
        bunn: 200,
        etiketter: [
          { x: 100, y: 50, tekst: 'A' },
          { x: 100, y: 52, tekst: 'B', undertekst: 'under' },
          { x: Number.NaN, y: 52, tekst: 'Borte' },
        ],
      }),
    );
    expect(html).not.toMatch(UGYLDIG);
    expect(html).not.toContain('Borte');
  });
});
