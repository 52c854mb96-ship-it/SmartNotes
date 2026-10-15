import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import {
  Flagg,
  FlateForklaring,
  GeoTidslinje,
  Klimadiagram,
  LogPlot,
  brytTekst,
  flaggEtiketter,
  klimaAkser,
  tekstBredde,
  tidslinjeGeometri,
  type FlaggInn,
} from './diagram';
import { GEO_HENDELSER, JORDAS_ALDER } from './geotid';
import { fmtTall } from './akser';
import { GEO } from './colors';
import { seededRandom } from '../../kjemi/kit/random';

const svg = (child: ReturnType<typeof createElement>) => renderToStaticMarkup(createElement('svg', null, child));
const utenNaN = (html: string) => expect(html).not.toMatch(/NaN|Infinity/);

describe('tekst', () => {
  it('tekstBredde vokser med teksten og gir 0 for ugyldig størrelse', () => {
    expect(tekstBredde('Kambrium', 14)).toBeGreaterThan(tekstBredde('Kam', 14));
    expect(tekstBredde('1000', 10)).toBeCloseTo(4 * 0.57 * 10, 6);
    expect(tekstBredde('abc', NaN)).toBe(0);
    expect(tekstBredde('abc', 0)).toBe(0);
  });

  it('brytTekst bryter ved mellomrom og samler resten på siste linje', () => {
    const linjer = brytTekst('Masseutdøing ved slutten av ordovicium', 160, 13);
    expect(linjer.length).toBeGreaterThan(1);
    expect(linjer.join(' ')).toBe('Masseutdøing ved slutten av ordovicium');
    for (const l of linjer.slice(0, -1)) expect(tekstBredde(l, 13)).toBeLessThanOrEqual(160);
    expect(brytTekst('a b c d e f g h', 1, 13, 3)).toHaveLength(3);
    expect(brytTekst('', 100, 13)).toEqual([]);
  });

  it('fmtTall skriver tusenskille fra fem sifre, ekte minus og «–» for ugyldige tall', () => {
    expect(fmtTall(1000)).toBe('1000');
    expect(fmtTall(2500)).toBe('2500');
    expect(fmtTall(10000)).toMatch(/^10\s000$/u);
    expect(fmtTall(-5)).toBe('−5');
    expect(fmtTall(0.5, 1)).toBe('0,5');
    expect(fmtTall(NaN)).toBe('–');
  });
});

describe('klimaAkser', () => {
  it('gir −10 til 20 °C og like mange intervaller på begge aksene', () => {
    const a = klimaAkser([2, 2, 3, 6, 10, 12, 14, 15, 12, 9, 5, 3], [210, 160, 175, 110, 95, 115, 135, 175, 245, 250, 245, 230]);
    expect([a.tMin, a.tMaks, a.tSteg, a.intervaller]).toEqual([-10, 20, 5, 6]);
    expect(a.nSteg).toBe(50);
    expect(a.nMaks).toBe(300);
  });

  it('utvider temperaturaksen i steg på 5 °C og velger et pent nedbørsteg', () => {
    const a = klimaAkser([-11.2, -10.1, -6, -0.8, 5.6, 10.1, 12.4, 11.1, 6.5, 0.9, -5.3, -9.4], [35, 28, 26, 30, 45, 65, 85, 75, 55, 45, 38, 36]);
    expect([a.tMin, a.tMaks, a.intervaller]).toEqual([-15, 20, 7]);
    expect(a.nMaks).toBe(140);
  });

  it('bruker faste grenser, hopper over ugyldige tall og gir aldri NaN', () => {
    const a = klimaAkser([NaN, 5, Infinity], [NaN, -3, 40], [-20, 30], 140);
    expect([a.tMin, a.tMaks, a.tSteg]).toEqual([-20, 30, 10]);
    expect(a.nMaks).toBeCloseTo(140, 9);
    const tom = klimaAkser([], []);
    for (const v of Object.values(tom)) expect(Number.isFinite(v)).toBe(true);
  });
});

/** Sjekker at ingen strek går gjennom en tekst og at tekster i samme rad ikke overlapper. */
function sjekkFlagg(inn: readonly FlaggInn[], p0: number, p1: number) {
  const plan = flaggEtiketter(inn, p0, p1);
  if (!plan) return null;
  const { flagg } = plan;
  for (let i = 0; i < inn.length; i++) {
    for (let j = 0; j < inn.length; j++) {
      if (i === j) continue;
      const a = flagg[i]!;
      const b = flagg[j]!;
      // Streken til i går fra aksen opp til rad i; teksten til j står i rad j
      if (b.rad < a.rad) expect(inn[i]!.pos < b.a - 3 || inn[i]!.pos > b.b + 3).toBe(true);
      if (a.rad === b.rad) expect(a.b <= b.a || b.b <= a.a).toBe(true);
    }
  }
  expect(plan.rader).toBe(Math.max(...flagg.map((f) => f.rad)) + 1);
  // Teksten står innenfor aksen (med litt slingring) og spennet dekker både tekst og strek
  flagg.forEach((fl, i) => {
    const e = inn[i]!;
    if (e.bredde <= p1 - p0) {
      expect(fl.x).toBeGreaterThanOrEqual(p0 - 7);
      expect(fl.x + e.bredde).toBeLessThanOrEqual(p1 + 7);
    }
    expect(fl.a).toBeLessThanOrEqual(Math.min(fl.x, e.pos));
    expect(fl.b).toBeGreaterThanOrEqual(Math.max(fl.x + e.bredde, e.pos));
  });
  return plan;
}

describe('flaggEtiketter', () => {
  it('gir én rad når tekstene ikke er i veien for hverandre', () => {
    const plan = sjekkFlagg(
      [
        { pos: 0, bredde: 80 },
        { pos: 200, bredde: 80 },
        { pos: 400, bredde: 80 },
      ],
      0,
      600,
    );
    expect(plan?.rader).toBe(1);
    expect(plan?.flagg.every((f) => f.start)).toBe(true);
  });

  it('lager en trapp når tekstene er lange, og snur teksten ved høyre kant', () => {
    const plan = sjekkFlagg(
      [
        { pos: 10, bredde: 300 },
        { pos: 100, bredde: 300 },
        { pos: 200, bredde: 300 },
        { pos: 590, bredde: 120 },
      ],
      0,
      600,
    );
    expect(plan).not.toBeNull();
    expect(plan!.flagg[3]!.start).toBe(false);
    expect(plan!.rader).toBeGreaterThanOrEqual(3);
  });

  it('flytter en tekst som ikke får plass på noen side, inn over streken', () => {
    const plan = sjekkFlagg([{ pos: 300, bredde: 500 }], 0, 600);
    expect(plan!.flagg[0]!.x).toBeCloseTo(50, 9);
    expect(plan!.flagg[0]!.start).toBe(false);
  });

  it('holder reglene for tilfeldige hendelser, og gir null for ugyldige tall', () => {
    const rnd = seededRandom(7);
    for (let n = 0; n < 40; n++) {
      const inn = Array.from({ length: 2 + Math.floor(rnd() * 7) }, () => ({ pos: rnd() * 760, bredde: 40 + rnd() * 260 }));
      sjekkFlagg(inn, 0, 760);
    }
    expect(flaggEtiketter([{ pos: NaN, bredde: 10 }], 0, 100)).toBeNull();
    expect(flaggEtiketter([], 0, 100)).toEqual({ flagg: [], rader: 0 });
  });
});

describe('tidslinjeGeometri', () => {
  it('vannrett: eldst til venstre, yngst til høyre, og inv er den omvendte', () => {
    const g = tidslinjeGeometri({ x: 20, y: 10, width: 760, height: 260 });
    expect(g.s(JORDAS_ALDER)).toBeCloseTo(20, 6);
    expect(g.s(0)).toBeCloseTo(780, 6);
    expect(g.inv(g.s(541))).toBeCloseTo(541, 6);
    expect(g.rader.map((r) => r.niva)).toEqual(['eon', 'era', 'periode']);
    expect(g.tittel).toBe('millioner år siden');
  });

  it('loddrett: eldst nederst, og enheten følger zoomen', () => {
    const g = tidslinjeGeometri({ x: 0, y: 0, width: 400, height: 500, retning: 'loddrett', fra: 66 });
    expect(g.s(66)).toBeCloseTo(500, 6);
    expect(g.s(0)).toBeCloseTo(0, 6);
    expect(tidslinjeGeometri({ width: 400, height: 100, fra: 0.1 }).tittel).toBe('tusen år siden');
    expect(tidslinjeGeometri({ width: 400, height: 100, fra: 0.001 }).tittel).toBe('år siden');
  });

  it('log-akse uten 0, og ugyldige tall gir ingen NaN', () => {
    const g = tidslinjeGeometri({ width: 760, height: 200, skala: 'log', fra: 4567, til: 0 });
    expect(g.til).toBeGreaterThan(0);
    expect(Number.isFinite(g.s(0))).toBe(true);
    const h = tidslinjeGeometri({ x: NaN, y: NaN, width: NaN, height: NaN, fra: NaN, til: NaN });
    for (const v of [h.p0, h.p1, h.q0, h.q1, h.s(100), h.inv(0)]) expect(Number.isFinite(v)).toBe(true);
  });
});

describe('komponentene', () => {
  it('LogPlot tåler verdier ≤ 0 på log-aksene og tom høyreakse', () => {
    utenNaN(
      svg(
        createElement(LogPlot, {
          width: 800,
          height: 400,
          x: { min: 0.001, max: 1000, log: true, label: 'Kornstørrelse (mm)' },
          y: { min: 0, max: 10, log: true },
          y2: { min: 5, max: 5 },
          children: ({ sx, sy }) => createElement('circle', { cx: sx(0), cy: sy(-1), r: 3 }),
        }),
      ),
    );
  });

  it('Klimadiagram tåler manglende og ugyldige verdier', () => {
    utenNaN(svg(createElement(Klimadiagram, { temperatur: [NaN, 3], nedbor: [-5, NaN, 40], markert: 0, visSnitt: true, sted: 'Tenkt', nullLinje: true })));
    utenNaN(svg(createElement(Klimadiagram, { temperatur: [], nedbor: [], markert: null })));
  });

  it('GeoTidslinje tegner flagg eller nummererte merker uten NaN', () => {
    utenNaN(svg(createElement(GeoTidslinje, { width: 760, height: 300, hendelser: GEO_HENDELSER, markor: 150 })));
    utenNaN(svg(createElement(GeoTidslinje, { width: 300, height: 160, hendelser: GEO_HENDELSER, markor: NaN })));
    utenNaN(svg(createElement(GeoTidslinje, { width: 400, height: 600, retning: 'loddrett', hendelser: GEO_HENDELSER, skala: 'log', til: 0 })));
  });
});

describe('tidslinjeGeometri, Flagg og FlateForklaring', () => {
  it('tidslinjeGeometri tåler ugyldig tekstskalering', () => {
    for (const f of [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY, 0, -2]) {
      const g = tidslinjeGeometri({ width: 760, height: 260, hendelser: GEO_HENDELSER }, f);
      const tall = [g.p0, g.p1, g.q0, g.q1, g.akseLinje, g.hendelser.q0, g.hendelser.q1, ...g.rader.flatMap((r) => [r.q0, r.q1]), g.s(66), g.inv(300)];
      expect(tall.every(Number.isFinite), `f = ${f}`).toBe(true);
    }
  });

  it('Flagg tegner tekster med strek ned til punktene, og bare prikkene for ugyldige', () => {
    const html = svg(
      createElement(Flagg, {
        basis: 40,
        x0: 0,
        x1: 400,
        flagg: [
          { x: 100, y: 120, tekst: 'Bolig' },
          { x: 120, y: 130, tekst: 'Brønn' },
          { x: Number.NaN, y: 10, tekst: 'Feil' },
        ],
      }),
    );
    utenNaN(html);
    expect(html).toContain('Bolig');
    expect(html).toContain('Brønn');
    expect(html).not.toContain('Feil');
    expect((html.match(/<line/g) ?? []).length).toBe(4);
  });

  it('FlateForklaring tegner ruter med kant, mønster, stjerner og streker', () => {
    const html = renderToStaticMarkup(
      createElement(FlateForklaring, {
        items: [
          { label: 'Omvendt polaritet', farge: GEO.polaritet.omvendt },
          { label: '0–200 m', farge: GEO.hoydelag[0]! },
          { label: 'Sand', farge: GEO.bergart.sand, form: 'monster', monster: 'sand' },
          { label: 'Jordskjelv', farge: GEO.fare[1]!, form: 'stjerne' },
          { label: 'Vannskille', farge: GEO.vannskille, form: 'linje', stiplet: true },
        ],
      }),
    );
    expect(html).toContain('viz-legend');
    expect(html).toContain('var(--geo-pol-omvendt-line)');
    expect(html).toContain('var(--viz-muted)');
    expect(html).toContain('<pattern');
    expect((html.match(/<li/g) ?? []).length).toBe(5);
  });
});
