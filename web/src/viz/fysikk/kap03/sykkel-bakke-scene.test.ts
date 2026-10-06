import { describe, expect, it } from 'vitest';
import { GRADE_MAX, GRADE_MIN, slopeAngle } from './model-sykkel-bakke';
import { fmt } from '../../kit/format';
import {
  BIKE_NARROW,
  BIKE_WIDE,
  fromRoad,
  gradeLabelLayout,
  gradeTriangle,
  hash01,
  hudLayout,
  labelWidth,
  nearEdge,
  roadLineY,
  roadSpan,
  roadsideItems,
  wrapShift,
} from './sykkel-bakke-scene';

const LAYOUTS = [BIKE_WIDE, BIKE_NARROW];
const GRADES = [GRADE_MIN, 5, 7.5, 12, GRADE_MAX];

describe('veirammen', () => {
  it('fromRoad og roadLineY beskriver samme linje', () => {
    for (const lay of LAYOUTS)
      for (const grade of GRADES) {
        const th = slopeAngle(grade);
        for (const u of [-300, 0, 250])
          for (const e of [0, 10, -20]) {
            const p = fromRoad(lay, th, u, e);
            expect(roadLineY(lay, th, p.x, e)).toBeCloseTo(p.y, 9);
          }
        // Ankerpunktet ligger på kontaktlinja, og veien stiger mot høyre med vinkelen θ
        expect(fromRoad(lay, th, 0)).toEqual({ x: lay.xc, y: lay.yc });
        const a = fromRoad(lay, th, 100);
        expect((lay.yc - a.y) / (a.x - lay.xc)).toBeCloseTo(grade / 100, 9);
      }
  });

  it('veien og lia under dekker hele bredden og bunnen av figuren i alle stigninger', () => {
    for (const lay of LAYOUTS)
      for (const grade of GRADES) {
        const th = slopeAngle(grade);
        const span = roadSpan(lay, th);
        // Endene av veien er utenfor figuren
        expect(fromRoad(lay, th, span.from).x).toBeLessThan(0);
        expect(fromRoad(lay, th, span.to).x).toBeGreaterThan(lay.W);
        // Bunnen av lia er under figuren også der veien ligger høyest (høyre kant)
        const right = fromRoad(lay, th, (lay.W - lay.xc) / Math.cos(th), span.depth);
        expect(right.y).toBeGreaterThan(lay.H);
      }
  });

  it('veien er inne i figuren og under panelet, og muren er under horisonten til venstre', () => {
    for (const lay of LAYOUTS)
      for (const grade of GRADES) {
        const th = slopeAngle(grade);
        expect(roadLineY(lay, th, 0, 0.3 * lay.road)).toBeLessThan(lay.H - 10);
        expect(roadLineY(lay, th, lay.W, -0.78 * lay.road) - lay.wall).toBeGreaterThan(lay.hud.y + lay.hud.h);
        expect(roadLineY(lay, th, 0, -0.78 * lay.road) - lay.wall).toBeGreaterThan(lay.horizon);
      }
  });
});

describe('stigningstrekanten', () => {
  it('har rise = run · stigning og hypotenusen langs veikanten', () => {
    for (const lay of LAYOUTS)
      for (const grade of GRADES) {
        const th = slopeAngle(grade);
        const t = gradeTriangle(lay, th);
        expect(t.rise).toBeCloseTo((t.run * grade) / 100, 12);
        expect(t.x1 - t.x0).toBeCloseTo(t.run * lay.S, 9);
        // Samme skala som syklisten: den loddrette kateten er rise · S
        expect(t.y0 - t.y1).toBeCloseTo(t.rise * lay.S, 9);
        expect(t.y0).toBeCloseTo(roadLineY(lay, th, t.x0, nearEdge(lay)), 9);
      }
  });

  it('får plass med to linjer tekst under seg og ligger til høyre for bakhjulet', () => {
    for (const lay of LAYOUTS)
      for (const grade of GRADES) {
        const t = gradeTriangle(lay, slopeAngle(grade));
        expect(t.x0).toBeGreaterThan(lay.xc - 0.52 * lay.S);
        expect(t.x1).toBeLessThan(lay.W - 60);
        expect(t.y0 + 50).toBeLessThan(lay.H);
      }
  });
});

describe('tekstene ved stigningstrekanten', () => {
  it('høyden står til høyre for kateten uten å overlappe «… m bortover», og alt er inne i figuren', () => {
    for (const lay of LAYOUTS)
      for (const f of [1, 1.15, 1.3])
        for (let grade = GRADE_MIN; grade <= GRADE_MAX; grade += 0.5) {
          const tri = gradeTriangle(lay, slopeAngle(grade));
          const rise = `${fmt(tri.rise, 2)} m opp`;
          const run = `${fmt(tri.run, 1)} m bortover`;
          const ratio = `stigning ${fmt(tri.rise, 2)} / ${fmt(tri.run, 1)} = ${fmt(grade, 1)} %`;
          const l = gradeLabelLayout(tri, lay.W, f, rise.length, rise.length - 4);
          expect(l.right).toBe(true);
          // Høydeteksten er til høyre for kateten og «… m bortover»
          const riseLen = l.long ? rise.length : rise.length - 4;
          expect(l.rise.x).toBeGreaterThan(tri.x1);
          expect(l.rise.x + labelWidth(riseLen, f)).toBeLessThanOrEqual(lay.W - 4);
          expect(l.run.x + labelWidth(run.length, f) / 2).toBeLessThan(l.rise.x);
          // «stigning …» er inne i figuren, under «… m bortover»
          expect(l.ratio.x - labelWidth(ratio.length, f) / 2).toBeGreaterThan(0);
          expect(l.ratio.x + labelWidth(ratio.length, f) / 2).toBeLessThan(lay.W);
          expect(l.ratio.y).toBeGreaterThan(l.run.y + 15 * f);
          expect(l.ratio.y + 6).toBeLessThan(lay.H);
        }
  });

  it('har en reserve med høyden på egen linje når det er for trangt til høyre', () => {
    const tri = gradeTriangle(BIKE_NARROW, slopeAngle(8));
    const l = gradeLabelLayout(tri, tri.x1 + 30, 1.3, 10, 6);
    expect(l.right).toBe(false);
    expect(l.rise.anchor).toBe('middle');
    expect(l.rise.y).toBeGreaterThan(l.run.y);
    expect(l.ratio.y).toBeGreaterThan(l.rise.y);
  });
});

describe('ting langs veien', () => {
  it('står fast i verden og ruller forbi', () => {
    const a = roadsideItems(100, -10, 10, 4, 5);
    const b = roadsideItems(103, -10, 10, 4, 5);
    expect(a.length).toBeGreaterThan(2);
    for (const it of a) {
      expect(it.u).toBeGreaterThanOrEqual(-10);
      expect(it.u).toBeLessThanOrEqual(10);
      const same = b.find((x) => x.key === it.key);
      if (same) expect(same.u).toBeCloseTo(it.u - 3, 9);
    }
    // Samme indeks gir samme tall
    expect(hash01(7, 3)).toBe(hash01(7, 3));
    expect(hash01(7, 3)).not.toBe(hash01(8, 3));
    for (let i = -20; i < 20; i++) {
      expect(hash01(i, 9)).toBeGreaterThanOrEqual(0);
      expect(hash01(i, 9)).toBeLessThan(1);
    }
  });

  it('mønstre som gjentar seg, flyttes mellom −periode og 0', () => {
    expect(wrapShift(0, 100)).toBeCloseTo(0, 12);
    expect(wrapShift(30, 100)).toBe(-30);
    expect(wrapShift(130, 100)).toBe(-30);
    expect(wrapShift(-30, 100)).toBe(-70);
    expect(wrapShift(Number.NaN, 100)).toBe(0);
  });
});

describe('panelet', () => {
  it('har klokka, tre linjer og profilen inne i boksen, også med stor tekst', () => {
    for (const lay of LAYOUTS)
      for (const f of [1, 1.3]) {
        const h = hudLayout(lay.hud, f);
        const box = lay.hud;
        expect(h.clock.x - h.clock.r).toBeGreaterThan(box.x);
        expect(h.clock.y + h.clock.r).toBeLessThan(box.y + box.h);
        expect(h.rows[2]!).toBeLessThan(h.profile.y);
        expect(h.profile.h).toBeGreaterThan(8);
        expect(h.profile.y + h.profile.h).toBeLessThanOrEqual(box.y + box.h);
      }
  });
});
