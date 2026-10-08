import { describe, expect, it } from 'vitest';
import { dischargeRgb } from './bohr-scene';
import { elementLines, VISIBLE_MAX, VISIBLE_MIN, type SpectrumElement } from './model';
import {
  deviationDeg,
  dispersion,
  exitAngleDeg,
  GEAR,
  hitY,
  labelWidthEm,
  placeBenchLabels,
  PRISM,
  screenAt,
  screenCorners,
  screenPoint,
  spektreScene,
  tubeRgb,
  XPOS,
  type SpectrumMode,
} from './spektre-scene';

const MODES: SpectrumMode[] = ['kontinuerlig', 'emisjon', 'absorpsjon'];
const SCALES = [1, 1.3, 1.78, 2.4];
const ELEMENTS: SpectrumElement[] = ['hydrogen', 'helium', 'natrium', 'kvikksolv'];

describe('prismet', () => {
  it('gulgrønt lys (550 nm) går symmetrisk gjennom: 19° inn og 19° ut, 38° til sammen (n ≈ 1,51)', () => {
    expect(dispersion(550)).toBeCloseTo(0, 12);
    expect(exitAngleDeg(550)).toBeCloseTo(PRISM.inDeg, 12);
    expect(deviationDeg(550)).toBeCloseTo(38, 12);
    // Minste avbøyning i et prisme med toppvinkel 60°: n = sin((A + D)/2) / sin(A/2)
    const n = Math.sin(((60 + 38) / 2) * (Math.PI / 180)) / Math.sin(30 * (Math.PI / 180));
    expect(n).toBeCloseTo(1.51, 2);
  });

  it('fiolett brytes mest og rødt minst, og vinkelen avtar jevnt med bølgelengden', () => {
    for (let nm = VISIBLE_MIN; nm < VISIBLE_MAX; nm += 5) expect(exitAngleDeg(nm)).toBeGreaterThan(exitAngleDeg(nm + 5));
    expect(dispersion(400) - dispersion(700)).toBeCloseTo(1, 12);
    expect(exitAngleDeg(400) - exitAngleDeg(700)).toBeCloseTo(PRISM.spreadDeg, 12);
  });

  it('spredningen er størst i den blå enden (Cauchy: n = A + B/λ²)', () => {
    expect(exitAngleDeg(400) - exitAngleDeg(450)).toBeGreaterThan(exitAngleDeg(650) - exitAngleDeg(700));
  });

  it('strålene går nedover etter prismet, men ikke brattere enn 35°', () => {
    for (const nm of [VISIBLE_MIN, 500, VISIBLE_MAX]) {
      expect(exitAngleDeg(nm)).toBeGreaterThan(5);
      expect(exitAngleDeg(nm)).toBeLessThan(35);
    }
  });
});

describe('fargen i spektralrøret', () => {
  it('hydrogen har samme farge som i «Bohrs atommodell»', () => {
    expect(tubeRgb('hydrogen')).toEqual(dischargeRgb());
  });

  it('hydrogen er rosa-lilla, natrium gulorange, kvikksølv blått og helium laksrosa', () => {
    const [hr, hg, hb] = tubeRgb('hydrogen');
    expect(hr).toBeGreaterThan(hg);
    expect(hb).toBeGreaterThan(hg);
    const [nr, ng, nb] = tubeRgb('natrium');
    expect(nr).toBeGreaterThan(ng);
    expect(ng).toBeGreaterThan(nb);
    const [kr, , kb] = tubeRgb('kvikksolv');
    expect(kb).toBeGreaterThan(kr);
    const [er, eg, eb] = tubeRgb('helium');
    expect(er).toBeGreaterThan(eg);
    expect(er).toBeGreaterThan(eb);
    for (const el of ELEMENTS) for (const c of tubeRgb(el)) expect(c >= 0 && c <= 255 && Number.isInteger(c)).toBe(true);
  });
});

describe('scenen', () => {
  it('har riktige proporsjoner: 500 px per meter', () => {
    const g = spektreScene(1, 'emisjon');
    expect(g.S).toBe(500);
    expect(g.floorY - g.src.y).toBeCloseTo(GEAR.sourceH * 500, 6);
    expect(g.tubeBottom - g.tubeTop).toBeCloseTo(GEAR.tube * 500, 6);
    expect(g.prism.a).toBeCloseTo(GEAR.prismSide * 500, 6);
    expect(g.bulbSize).toBeCloseTo(GEAR.bulb * 500, 6);
    expect(g.screen.bottom - g.screen.top).toBeCloseTo(GEAR.screenH * 500, 6);
  });

  it('lyset går rett fra lyskilden gjennom spalten og kolben og inn i prismet', () => {
    for (const f of SCALES) {
      const g = spektreScene(f, 'absorpsjon');
      const slope = (p: { x: number; y: number }) => (g.src.y - p.y) / (p.x - g.src.x);
      const tan = Math.tan((PRISM.inDeg * Math.PI) / 180);
      expect(slope(g.slit)).toBeCloseTo(tan, 9);
      expect(slope(g.flask)).toBeCloseTo(tan, 9);
      expect(slope(g.prism.inPt)).toBeCloseTo(tan, 9);
      // Inne i glasset går strålen vannrett mellom midtpunktene på sideflatene (minste avbøyning)
      expect(g.prism.outPt.y).toBeCloseTo(g.prism.inPt.y, 9);
      const midL = { x: (g.prism.apex.x + g.prism.baseL.x) / 2, y: (g.prism.apex.y + g.prism.baseL.y) / 2 };
      const midR = { x: (g.prism.apex.x + g.prism.baseR.x) / 2, y: (g.prism.apex.y + g.prism.baseR.y) / 2 };
      expect(g.prism.inPt.x).toBeCloseTo(midL.x, 9);
      expect(g.prism.inPt.y).toBeCloseTo(midL.y, 9);
      expect(g.prism.outPt.x).toBeCloseTo(midR.x, 9);
      expect(g.prism.outPt.y).toBeCloseTo(midR.y, 9);
      // Prismet er likesidet
      expect(Math.hypot(g.prism.apex.x - g.prism.baseL.x, g.prism.apex.y - g.prism.baseL.y)).toBeCloseTo(g.prism.a, 9);
    }
  });

  it('hele spekteret (380–750 nm) treffer skjermen, også på mobil', () => {
    for (const f of SCALES)
      for (const mode of MODES) {
        const g = spektreScene(f, mode);
        const [tl, tr, br, bl] = screenCorners(g);
        for (let nm = VISIBLE_MIN; nm <= VISIBLE_MAX; nm += 5)
          for (const t of [0, 0.1, 0.5, 0.9, 1]) {
            const p = screenPoint(g, nm, t);
            const topY = tl.y + (tr.y - tl.y) * t;
            const botY = bl.y + (br.y - bl.y) * t;
            expect(p.y).toBeGreaterThan(topY + 4);
            expect(p.y).toBeLessThan(botY - 4);
          }
        // Rødt øverst, fiolett nederst (fiolett brytes mest)
        expect(hitY(g, 700)).toBeLessThan(hitY(g, 400));
        // Spekteret er minst 80 enheter høyt på skjermen, så linjene kan skilles
        expect(hitY(g, VISIBLE_MIN) - hitY(g, VISIBLE_MAX)).toBeGreaterThan(80);
      }
  });

  it('midt på skjermen er punktet akkurat der strålen treffer', () => {
    const g = spektreScene(1, 'kontinuerlig');
    for (const nm of [400, 550, 700]) {
      const p = screenPoint(g, nm, 0.5);
      expect(p.x).toBeCloseTo(g.screen.mid, 9);
      expect(p.y).toBeCloseTo(hitY(g, nm), 9);
    }
    // Hjørnene følger samme perspektiv som punktene
    const [, tr, br] = screenCorners(g);
    expect(screenAt(g, (tr.y + br.y) / 2, 1).y).toBeGreaterThan(tr.y);
  });

  it('alt får plass i figuren: ingenting over toppen, skjermen står på benken og foten er over forkanten', () => {
    for (const f of SCALES)
      for (const mode of MODES) {
        const g = spektreScene(f, mode);
        expect(g.prism.apex.y).toBeGreaterThan(8);
        expect(g.columnTop).toBeGreaterThan(8);
        expect(g.tubeTop).toBeGreaterThan(g.columnTop);
        expect(g.tubeBottom).toBeLessThan(g.floorY - GEAR.supplyH * g.S + 1);
        expect(g.prism.baseL.y).toBeLessThan(g.floorY - 40);
        expect(g.jackTop).toBeLessThan(g.floorY - 30);
        expect(g.screen.bottom).toBeLessThan(g.floorY);
        expect(g.benchY).toBeGreaterThan(g.floorY);
        expect(g.height).toBeGreaterThan(g.benchY + g.labelRowH);
        expect(Number.isFinite(g.height)).toBe(true);
        // Kolben står mellom lampa og spalten, og spalten før prismet
        expect(g.flask.x - g.flask.r).toBeGreaterThan(g.src.x + g.bulbSize * (30 / 108));
        expect(g.flask.x + g.flask.r).toBeLessThan(g.slit.x);
        expect(g.slit.x).toBeLessThan(g.prism.baseL.x);
        expect(g.prism.baseR.x).toBeLessThan(g.screen.xL);
        expect(g.screen.xR).toBeLessThan(g.width);
      }
  });

  it('vinduet på veggen ligger over alle strålene og over skjermen', () => {
    for (const f of SCALES) {
      const g = spektreScene(f, 'kontinuerlig');
      const o = g.prism.outPt;
      for (const x of [g.window.x1, g.window.x2])
        for (const nm of [VISIBLE_MIN, VISIBLE_MAX]) {
          const y = o.y + (Math.min(x, g.screen.mid) - o.x) * Math.tan((exitAngleDeg(nm) * Math.PI) / 180);
          expect(y).toBeGreaterThan(g.window.y2 + 8);
        }
      expect(g.window.y2).toBeLessThan(g.screen.top);
      expect(g.window.y2 - g.window.y1).toBeGreaterThan(28);
    }
  });

  it('høyden er den samme i alle modusene (figuren hopper ikke)', () => {
    for (const f of SCALES) {
      const h = MODES.map((m) => spektreScene(f, m).height);
      expect(new Set(h).size).toBe(1);
    }
  });
});

describe('navnelappene på benken', () => {
  it('overlapper ikke og står innenfor figuren', () => {
    for (const f of SCALES)
      for (const mode of MODES) {
        const size = 17 * f * 0.8;
        const labels = placeBenchLabels(mode, f);
        for (const row of [0, 1]) {
          const spans = labels
            .filter((l) => l.row === row)
            .map((l) => [l.x - (labelWidthEm(l.text) * size) / 2, l.x + (labelWidthEm(l.text) * size) / 2] as const)
            .sort((a, b) => a[0] - b[0]);
          for (const [l, r] of spans) {
            expect(l).toBeGreaterThanOrEqual(9.99);
            expect(r).toBeLessThanOrEqual(790.01);
          }
          for (let i = 1; i < spans.length; i++) expect(spans[i]![0]).toBeGreaterThanOrEqual(spans[i - 1]![1]);
        }
      }
  });

  it('lyskilden, prismet og skjermen har alltid navn; kald gass bare ved absorpsjon', () => {
    for (const f of SCALES) {
      const em = placeBenchLabels('emisjon', f).map((l) => l.text);
      expect(em).toEqual(expect.arrayContaining(['Spektralrør', 'Prisme', 'Skjerm']));
      expect(em).not.toContain('Kald gass');
      const ab = placeBenchLabels('absorpsjon', f).map((l) => l.text);
      expect(ab).toEqual(expect.arrayContaining(['Glødelampe', 'Kald gass', 'Prisme', 'Skjerm']));
      expect(placeBenchLabels('kontinuerlig', f).map((l) => l.text)).toContain('Glødelampe');
    }
  });

  it('på PC får alle navnene plass i én rad, og spalten har navn når det er plass', () => {
    for (const mode of MODES) {
      const labels = placeBenchLabels(mode, 1);
      expect(labels.every((l) => l.row === 0)).toBe(true);
    }
    expect(placeBenchLabels('emisjon', 1).map((l) => l.text)).toContain('Spalte');
    expect(XPOS.slit).toBeGreaterThan(XPOS.cell);
  });
});

describe('linjene i spektrene', () => {
  it('alle linjene til grunnstoffene ligger i det synlige området og treffer skjermen', () => {
    const g = spektreScene(1, 'emisjon');
    for (const el of ELEMENTS)
      for (const l of elementLines(el)) {
        expect(l.nm).toBeGreaterThanOrEqual(VISIBLE_MIN);
        expect(l.nm).toBeLessThanOrEqual(VISIBLE_MAX);
        expect(Number.isFinite(hitY(g, l.nm))).toBe(true);
      }
  });
});
