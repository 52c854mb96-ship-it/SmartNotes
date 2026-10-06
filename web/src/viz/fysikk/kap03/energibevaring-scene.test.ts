import { describe, expect, it } from 'vitest';
import { barHeight, boxesOverlap, facing, framePoint, riderFrame, sceneLayout, segmentHitsBox, speedArrow, speedLabelPlace, textBox, textWidth } from './energibevaring-scene';
import { TRACK_TOP, makeTrack, simulateTrack } from './model';

const KINDS = ['rampe', 'bakke'] as const;
const G = 9.81;

describe('utformingen av scenen', () => {
  for (const kind of KINDS)
    for (const narrow of [false, true]) {
      const L = sceneLayout(kind, narrow);
      const tr = makeTrack(kind);
      const name = `${kind}, ${narrow ? 'mobil' : 'PC'}`;

      it(`${name}: samme skala vannrett og loddrett, og hele banen innenfor scenen`, () => {
        expect(L.X(1) - L.X(0)).toBeCloseTo(L.ppm, 9);
        expect(L.Y(0) - L.Y(1)).toBeCloseTo(L.ppm, 9);
        expect(L.X(tr.xMin)).toBeGreaterThanOrEqual(0);
        expect(L.X(tr.xMax)).toBeLessThanOrEqual(L.freeRight);
        // Rekkverket (1 m over plattformen) og toppene får plass
        expect(L.Y(TRACK_TOP + 1)).toBeGreaterThan(0);
        expect(L.sceneH).toBeGreaterThan(L.Y(0) + 30);
        expect(L.H).toBeGreaterThanOrEqual(L.sceneH);
        expect(L.groundY).toBeGreaterThanOrEqual(L.Y(0));
        expect(L.horizon).toBeLessThan(L.groundY);
      });

      it(`${name}: stolpene får plass i kortet, og den høyeste starthøyden når ikke over kortet`, () => {
        const B = L.bars;
        const c = B.card;
        expect(c.x).toBeGreaterThanOrEqual(0);
        expect(c.x + c.w).toBeLessThanOrEqual(L.W);
        expect(c.y + c.h).toBeLessThanOrEqual(L.H);
        expect(B.base).toBeLessThan(c.y + c.h);
        const m = 100;
        // E₀ for h₀ = 5,5 m står under overskriften i kortet (og tallet over stolpen får plass)
        expect(B.base - barHeight(B, m * G * 5.5, m, G)).toBeGreaterThan(c.y + 40);
        if (narrow) expect(c.y).toBeGreaterThanOrEqual(L.sceneH);
        else expect(c.x).toBeGreaterThan(L.freeRight);
      });

      it(`${name}: fartspila og etiketten holder seg inne i scenen for alle posisjoner med h₀ = 5,5 m`, () => {
        const f = narrow ? 1.84 : 1;
        for (let x = tr.xMin; x <= tr.xMax; x += 0.05) {
          const h = tr.height(x);
          if (h > 5.5) continue;
          const v = Math.sqrt(2 * G * (5.5 - h));
          const fr = riderFrame(tr, L, x);
          for (const sv of [1, -1]) {
            const a = speedArrow(fr, kind, L.ppm, sv * v);
            expect(a.x2).toBeGreaterThan(0);
            expect(a.x2).toBeLessThan(L.freeRight);
            expect(a.y2).toBeGreaterThan(0);
            expect(a.y2).toBeLessThan(L.sceneH - 4);
            const text = `v = ${v.toFixed(1)} m/s`;
            const lab = speedLabelPlace({ ...a, text, f, right: L.freeRight, top: 0, bottom: L.sceneH - 8 });
            const w = textWidth(text, 0.9, f);
            const left = lab.anchor === 'start' ? lab.x : lab.x - w;
            expect(left).toBeGreaterThanOrEqual(5.9);
            expect(left + w).toBeLessThanOrEqual(L.freeRight + 0.1);
            expect(lab.y).toBeLessThanOrEqual(L.sceneH - 8);
          }
        }
      });
    }

  it('på PC har E_p-stolpen samme høyde som brettet står over nullnivået, og E₀ ligger på linja for h₀', () => {
    for (const kind of KINDS) {
      const L = sceneLayout(kind, false);
      expect(L.bars.beside).toBe(true);
      expect(L.bars.base).toBeCloseTo(L.Y(0), 9);
      for (const [m, h] of [
        [20, 0.5],
        [50, 2.15],
        [100, 5.5],
      ] as const)
        expect(L.bars.base - barHeight(L.bars, m * G * h, m, G)).toBeCloseTo(L.Y(h), 9);
    }
  });

  it('stolpehøyden er aldri negativ eller NaN', () => {
    const B = sceneLayout('rampe', true).bars;
    expect(barHeight(B, -5, 50, G)).toBe(0);
    expect(barHeight(B, 100, 0, G)).toBe(0);
    expect(barHeight(B, Number.NaN, 50, G)).toBe(0);
  });

  it('personene blir større på mobil, men skalaen er lik i begge retninger', () => {
    for (const kind of KINDS) expect(sceneLayout(kind, true).ppm).toBeGreaterThan(sceneLayout(kind, false).ppm);
  });
});

describe('personen på banen', () => {
  it('rammen har enhetsvektorer der normalen står vinkelrett på tangenten og peker opp', () => {
    for (const kind of KINDS) {
      const tr = makeTrack(kind);
      const L = sceneLayout(kind, false);
      for (let x = tr.xMin; x <= tr.xMax; x += 0.37) {
        const fr = riderFrame(tr, L, x);
        expect(Math.hypot(fr.tx, fr.ty)).toBeCloseTo(1, 12);
        expect(Math.hypot(fr.nx, fr.ny)).toBeCloseTo(1, 12);
        expect(fr.tx * fr.nx + fr.ty * fr.ny).toBeCloseTo(0, 12);
        expect(fr.ny).toBeLessThan(0);
        expect(fr.x).toBeCloseTo(L.X(x), 9);
        expect(fr.y).toBeCloseTo(L.Y(tr.height(x)), 9);
        // Dreiningen følger tangenten (grader med klokka i SVG)
        expect(Math.tan((fr.rotate * Math.PI) / 180)).toBeCloseTo(fr.ty / fr.tx, 9);
      }
      // På bunnen er brettet vannrett, og et punkt 1 m ut fra banen står rett over
      const bottom = riderFrame(tr, L, tr.xBottom);
      expect(bottom.rotate).toBeCloseTo(0, 9);
      const up = framePoint(bottom, 0, L.ppm);
      expect(up.x).toBeCloseTo(bottom.x, 9);
      expect(up.y).toBeCloseTo(L.Y(1), 9);
    }
  });

  it('skateren ser i fartsretningen, og i ro dit tyngden vil dra den', () => {
    expect(facing(3, 0)).toBe(1);
    expect(facing(-3, 0)).toBe(-1);
    // I ro på venstre vegg (banen stiger mot venstre, h′ < 0): ruller mot høyre
    expect(facing(0, -1.2)).toBe(1);
    expect(facing(0, 1.2)).toBe(-1);
    expect(facing(0, 0)).toBe(1);
  });

  it('fartspila er proporsjonal med farten og peker langs banen', () => {
    const tr = makeTrack('rampe');
    const L = sceneLayout('rampe', false);
    const fr = riderFrame(tr, L, 3);
    const a = speedArrow(fr, 'rampe', L.ppm, 4);
    const b = speedArrow(fr, 'rampe', L.ppm, 8);
    const len = (q: typeof a) => Math.hypot(q.x2 - q.x1, q.y2 - q.y1);
    expect(len(b) / len(a)).toBeCloseTo(2, 9);
    expect(((a.x2 - a.x1) * fr.ty - (a.y2 - a.y1) * fr.tx) / len(a)).toBeCloseTo(0, 9);
    const back = speedArrow(fr, 'rampe', L.ppm, -4);
    expect(Math.sign(back.x2 - back.x1)).toBe(-1);
    expect(len(speedArrow(fr, 'rampe', L.ppm, 0))).toBe(0);
  });

  it('simuleringen holder personen innenfor den synlige delen av banen', () => {
    for (const kind of KINDS)
      for (const narrow of [false, true]) {
        const L = sceneLayout(kind, narrow);
        const sim = simulateTrack({ track: makeTrack(kind), h0: 5.5, m: 50, mu: 0, tMax: 20 });
        for (const s of sim.samples) {
          expect(s.x).toBeGreaterThan(L.xLeft + 0.5);
          expect(s.x).toBeLessThan(L.xRight - 0.5);
        }
      }
  });
});

describe('plassering av etiketter', () => {
  it('tekstboksen følger ankeret, og bokser som bare berører hverandre, overlapper ikke', () => {
    const a = textBox(100, 50, 60, 'start', 1, 1);
    expect(a.x0).toBeLessThan(100);
    expect(a.x1).toBeGreaterThan(160);
    expect(a.y0).toBeLessThan(50);
    const m = textBox(100, 50, 60, 'middle', 1, 1);
    expect((m.x0 + m.x1) / 2).toBeCloseTo(100, 9);
    const e = textBox(100, 50, 60, 'end', 1, 1);
    expect(e.x1).toBeGreaterThan(100);
    expect(e.x1).toBeLessThan(106);
    expect(boxesOverlap(a, m)).toBe(true);
    expect(boxesOverlap({ x0: 0, x1: 10, y0: 0, y1: 10 }, { x0: 10, x1: 20, y0: 0, y1: 10 })).toBe(false);
    // Større tekst på mobil gir høyere boks
    expect(textBox(0, 0, 10, 'start', 1, 1.84).y0).toBeLessThan(a.y0 - 50);
  });

  it('et linjestykke treffer boksen bare når det går gjennom den', () => {
    const box = { x0: 40, x1: 60, y0: 40, y1: 60 };
    expect(segmentHitsBox({ x: 0, y: 0 }, { x: 100, y: 100 }, box)).toBe(true);
    expect(segmentHitsBox({ x: 0, y: 100 }, { x: 30, y: 70 }, box)).toBe(false);
    expect(segmentHitsBox({ x: 0, y: 100 }, { x: 30, y: 70 }, box, 15)).toBe(true);
  });
});
