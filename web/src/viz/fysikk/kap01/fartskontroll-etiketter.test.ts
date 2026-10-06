import { describe, expect, it } from 'vitest';
import { boxPoints, distToBox, placeAlongSegment, segmentPoints, textBox } from './fartskontroll-etiketter';

const area = { x0: 0, x1: 400, top: 0, bottom: 300 };

describe('etikettplassering', () => {
  it('måler avstand fra punkt til boks', () => {
    const b = { cx: 100, cy: 100, w: 40, h: 20 };
    expect(distToBox({ x: 100, y: 100 }, b)).toBe(0);
    expect(distToBox({ x: 130, y: 100 }, b)).toBe(10);
    expect(distToBox({ x: 100, y: 125 }, b)).toBe(15);
    expect(distToBox({ x: 123, y: 114 }, b)).toBeCloseTo(5, 9);
  });

  it('lager punkter langs en linje og rundt en boks', () => {
    const pts = segmentPoints({ x: 0, y: 0 }, { x: 10, y: 20 }, 4);
    expect(pts).toHaveLength(5);
    expect(pts[2]).toEqual({ x: 5, y: 10 });
    expect(boxPoints({ cx: 0, cy: 0, w: 10, h: 4 }, 2)).toHaveLength(8);
  });

  it('legger etiketten på den ledige siden av linja og holder avstand', () => {
    // Vannrett linje med en annen graf like over: etiketten skal under linja
    const a = { x: 50, y: 150 };
    const b = { x: 350, y: 150 };
    const above = segmentPoints({ x: 0, y: 140 }, { x: 400, y: 140 }, 80);
    const { w, h } = textBox(10, 17);
    const box = placeAlongSegment(a, b, w, h, 5, above, area);
    expect(box.cy).toBeGreaterThan(150);
    expect(box.cy - h / 2).toBeGreaterThanOrEqual(150 + 5 - 1e-9);
    for (const p of above) expect(distToBox(p, box)).toBeGreaterThan(5);
  });

  it('holder etiketten inne i området når det går', () => {
    // Linja langs nederste kant: etiketten må over
    const box = placeAlongSegment({ x: 20, y: 296 }, { x: 380, y: 296 }, 60, 16, 4, [], area);
    expect(box.cy + 8).toBeLessThanOrEqual(300);
    expect(box.cx - 30).toBeGreaterThanOrEqual(0);
  });

  it('finner et ledig sted langs linja når en del av den er opptatt', () => {
    const a = { x: 0, y: 100 };
    const b = { x: 400, y: 100 };
    // Hindringer på begge sider av linja i midten
    const busy = [...segmentPoints({ x: 120, y: 80 }, { x: 280, y: 80 }, 40), ...segmentPoints({ x: 120, y: 120 }, { x: 280, y: 120 }, 40)];
    const box = placeAlongSegment(a, b, 50, 14, 4, busy, area);
    expect(box.cx < 120 - 20 || box.cx > 280 + 20).toBe(true);
  });
});
