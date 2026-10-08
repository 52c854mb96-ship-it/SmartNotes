import { describe, expect, it } from 'vitest';
import { radiationBalance } from './model';
import {
  CLOUD_SLOTS,
  MOLECULE_MAX,
  SURFACE_ALBEDO,
  albedoCover,
  albedoTags,
  arrowPolygon,
  cloudCount,
  flowGeometry,
  globePoint,
  highestPeak,
  layerLabel,
  moleculeCount,
  molecules,
  mountainProfile,
  snowLine,
  stralingLayout,
  tagWidth,
  textBox,
  type Box,
  type Pt,
  type StralingLayout,
} from './stralingsbalanse-scene';

/** PC, nettbrett og telefon (viewBox 800 eller 600 og tekstskaleringen <Figure> gir). */
const LAYOUTS: [number, number][] = [
  [800, 1],
  [800, 1.25],
  [600, 1.2],
  [600, 1.3],
];
const ALBEDOS = [0, 0.1, 0.2, 0.3, 0.45, 0.6, 0.75, 0.9];
const EPSES = [0, 0.01, 0.1, 0.3, 0.5, 0.78, 0.82, 0.95, 1];

const fmt2 = (v: number) => v.toFixed(2).replace('.', ',');

function inside(p: Pt, poly: Pt[]): boolean {
  let c = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i]!;
    const b = poly[j]!;
    if (a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) c = !c;
  }
  return c;
}

const boxPoly = (b: Box): Pt[] => [
  { x: b.l, y: b.t },
  { x: b.r, y: b.t },
  { x: b.r, y: b.b },
  { x: b.l, y: b.b },
];

function segmentsCross(p1: Pt, p2: Pt, q1: Pt, q2: Pt): boolean {
  const o = (a: Pt, b: Pt, c: Pt) => Math.sign((b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x));
  return o(p1, p2, q1) * o(p1, p2, q2) < 0 && o(q1, q2, p1) * o(q1, q2, p2) < 0;
}

/** Om to polygoner overlapper (et hjørne inni den andre, eller kanter som krysser). */
function polysOverlap(a: Pt[], b: Pt[]): boolean {
  if (a.length === 0 || b.length === 0) return false;
  if (a.some((p) => inside(p, b)) || b.some((p) => inside(p, a))) return true;
  for (let i = 0; i < a.length; i++)
    for (let j = 0; j < b.length; j++) if (segmentsCross(a[i]!, a[(i + 1) % a.length]!, b[j]!, b[(j + 1) % b.length]!)) return true;
  return false;
}

const grow = (b: Box, m: number): Box => ({
  l: b.l - m,
  r: b.r + m,
  t: b.t - m,
  b: b.b + m,
});
const boxesOverlap = (a: Box, b: Box) => a.l < b.r && b.l < a.r && a.t < b.b && b.t < a.b;
const circleHitsBox = (c: { x: number; y: number; r: number }, b: Box) => {
  const x = Math.min(b.r, Math.max(b.l, c.x));
  const y = Math.min(b.b, Math.max(b.t, c.y));
  return Math.hypot(c.x - x, c.y - y) < c.r;
};

function scene(L: StralingLayout, albedo: number, eps: number) {
  const b = radiationBalance(albedo, eps);
  const geo = flowGeometry(b, L);
  const fs = 17 * L.f;
  const polys = geo.arrows.map((a) => ({
    id: a.id,
    poly: arrowPolygon(a.x1, a.y1, a.x2, a.y2, a.w, L.ss),
  }));
  const boxes = geo.labels.map((l) => ({
    id: l.id,
    box: textBox(l.x, l.y, l.anchor, l.text, fs),
  }));
  return { b, geo, polys, boxes };
}

describe('albedoen i tegningen', () => {
  it('ingen skyer, snø eller is ved α = 0, alt hvitt ved α = 0,9', () => {
    expect(albedoCover(0)).toEqual({ clouds: 0, snow: 0, land: 0, seaIce: 0 });
    const c = albedoCover(0.9);
    for (const v of Object.values(c)) expect(v).toBeCloseTo(1, 9);
  });

  it('jorda i dag: noen skyer og snø på fjelltoppene, men ikke snø i lavlandet eller is på havet', () => {
    const c = albedoCover(0.3);
    expect(cloudCount(c.clouds)).toBeGreaterThanOrEqual(2);
    expect(cloudCount(c.clouds)).toBeLessThanOrEqual(4);
    expect(c.snow).toBeGreaterThan(0.2);
    expect(c.snow).toBeLessThan(0.6);
    expect(c.land).toBe(0);
    expect(c.seaIce).toBe(0);
  });

  it('mer is og snø (α = 0,45): snø i lavlandet og is langs land', () => {
    const c = albedoCover(0.45);
    expect(c.land).toBeGreaterThan(0.2);
    expect(c.seaIce).toBeGreaterThan(0.2);
    expect(cloudCount(c.clouds)).toBeGreaterThan(cloudCount(albedoCover(0.3).clouds));
  });

  it('alt øker med albedoen og holder seg mellom 0 og 1', () => {
    let prev = albedoCover(-0.1);
    for (let a = 0; a <= 1.0001; a += 0.01) {
      const c = albedoCover(a);
      for (const k of ['clouds', 'snow', 'land', 'seaIce'] as const) {
        expect(c[k]).toBeGreaterThanOrEqual(prev[k] - 1e-12);
        expect(c[k]).toBeGreaterThanOrEqual(0);
        expect(c[k]).toBeLessThanOrEqual(1);
      }
      prev = c;
    }
    expect(albedoCover(NaN)).toEqual(albedoCover(0));
  });

  it('flatene: snø og is reflekterer mye, hav og skog lite, og jordas albedo ligger mellom', () => {
    expect(SURFACE_ALBEDO.sno).toBeGreaterThan(SURFACE_ALBEDO.sjois);
    expect(SURFACE_ALBEDO.sjois).toBeGreaterThan(SURFACE_ALBEDO.skyer);
    expect(SURFACE_ALBEDO.skyer).toBeGreaterThan(0.3);
    expect(SURFACE_ALBEDO.hav).toBeLessThan(SURFACE_ALBEDO.skog);
    expect(SURFACE_ALBEDO.skog).toBeLessThan(0.3);
  });
});

describe('molekylene', () => {
  it('antallet følger ε, og nye kommer til uten at de andre flytter seg', () => {
    expect(moleculeCount(0)).toBe(0);
    expect(moleculeCount(1)).toBe(MOLECULE_MAX);
    expect(moleculeCount(0.78)).toBeGreaterThan(moleculeCount(0.3));
    const a = molecules();
    expect(a).toHaveLength(MOLECULE_MAX);
    expect(molecules()).toEqual(a);
    for (const m of a) {
      expect(m.u).toBeGreaterThanOrEqual(0);
      expect(m.u).toBeLessThanOrEqual(1);
      expect(m.v).toBeGreaterThanOrEqual(0);
      expect(m.v).toBeLessThanOrEqual(1);
    }
  });

  it('de første molekylene er spredt over hele laget', () => {
    const first = molecules().slice(0, moleculeCount(0.3));
    const us = first.map((m) => m.u);
    expect(Math.min(...us)).toBeLessThan(0.2);
    expect(Math.max(...us)).toBeGreaterThan(0.8);
    expect(first.some((m) => m.kind === 'co2')).toBe(true);
    expect(first.some((m) => m.kind === 'h2o')).toBe(true);
  });
});

describe('oppsettet', () => {
  it.each(LAYOUTS)('lagene ligger i riktig rekkefølge ovenfra (W = %d, f = %d)', (W, f) => {
    const L = stralingLayout(W, f);
    const order = [L.yTop, L.yToa, L.yL1, L.yL2, L.cloudTop, L.cloudBot, L.yG, L.rows[0], L.rows[1], L.H];
    for (let i = 1; i < order.length; i++) expect(order[i]!).toBeGreaterThan(order[i - 1]!);
    // Skiltene under bakken får plass i snittet og overlapper ikke hverandre
    expect(L.rows[0] - L.tagH / 2).toBeGreaterThan(L.yG + 4);
    expect(L.rows[1] - L.rows[0]).toBeGreaterThanOrEqual(L.tagH + 4);
    expect(L.rows[1] + L.tagH / 2).toBeLessThan(L.H);
    // Sola og jorda står i verdensrommet over himmelen, og sollyset kommer på skrå ned mot høyre
    expect(L.globe.y + L.globe.r).toBeLessThan(L.yToa);
    expect(L.globe.x + L.globe.r).toBeLessThan(W);
    expect(L.sunDir.x).toBeGreaterThan(0.2);
    expect(L.sunDir.y).toBeGreaterThan(0.85);
    // Fjellene står under skyene, og snøgrensen går fra over toppene (0) til foten (1)
    for (const p of mountainProfile(L)) expect(p.y).toBeGreaterThan(L.cloudTop);
    expect(snowLine(L, 0)).toBeLessThanOrEqual(highestPeak(L).y);
    expect(snowLine(L, 1)).toBeGreaterThan(L.yG - 10);
  });

  it('skyene står i skybeltet og innenfor figuren', () => {
    expect(cloudCount(1)).toBe(CLOUD_SLOTS.length);
    expect(cloudCount(0)).toBe(0);
    for (const s of CLOUD_SLOTS) {
      expect(s.x).toBeGreaterThan(0);
      expect(s.x).toBeLessThan(1);
    }
  });

  it('Norge ligger på den synlige, øvre delen av jordkloden', () => {
    const [x, y, z] = globePoint(10, 62, 15, 14);
    expect(z).toBeGreaterThan(0.3);
    expect(y).toBeLessThan(-0.5);
    expect(Math.abs(x)).toBeLessThan(0.2);
    expect(x * x + y * y).toBeLessThan(1);
  });
});

describe('energistrømmene', () => {
  it('bredden på pilene er proporsjonal med strømmen, med samme skala for alle', () => {
    const L = stralingLayout(800, 1);
    const { b, geo } = scene(L, 0.3, 0.78);
    const w = Object.fromEntries(geo.arrows.map((a) => [a.id, a.w]));
    expect(w.inn).toBeCloseTo(b.incoming * L.pxPerW, 9);
    expect(w.reflektert! + b.absorbed * L.pxPerW).toBeCloseTo(w.inn!, 9);
    expect(w.bakkeAtm! + w.gjennom!).toBeCloseTo(b.surfaceEmit * L.pxPerW, 9);
    expect(w.atmOpp).toBeCloseTo(w.atmNed!, 9);
    expect(w.atmOpp! + w.atmNed!).toBeCloseTo(w.bakkeAtm!, 9);
    // Like mye ut som inn på toppen: reflektert + gjennom + atmosfæren opp = inn
    expect(w.reflektert! + w.gjennom! + w.atmOpp!).toBeCloseTo(w.inn!, 9);
  });

  it('uten atmosfære er det ingen piler fra laget, og med ε = 1 slipper ingenting rett ut', () => {
    const L = stralingLayout(800, 1);
    const none = scene(L, 0.3, 0).geo.arrows.map((a) => a.id);
    expect(none).not.toContain('atmOpp');
    expect(none).not.toContain('bakkeAtm');
    expect(none).toContain('gjennom');
    const full = scene(L, 0.3, 1).geo.arrows.map((a) => a.id);
    expect(full).not.toContain('gjennom');
    expect(full).toContain('atmNed');
    const black = scene(L, 0, 0.78).geo.arrows.map((a) => a.id);
    expect(black).not.toContain('reflektert');
  });

  it('sollyset treffer bakken, og det reflekterte går opp igjen med samme vinkel', () => {
    const L = stralingLayout(800, 1);
    const { geo } = scene(L, 0.3, 0.78);
    const inn = geo.arrows.find((a) => a.id === 'inn')!;
    const ut = geo.arrows.find((a) => a.id === 'reflektert')!;
    expect(inn.y2).toBe(L.yG);
    expect(inn.x2).toBe(L.xV);
    expect(ut.y1).toBeLessThanOrEqual(L.yG);
    expect(ut.y1).toBeGreaterThan(L.yG - ut.w / 2);
    const slopeIn = (inn.x2 - inn.x1) / (inn.y2 - inn.y1);
    const slopeOut = (ut.x2 - ut.x1) / (ut.y1 - ut.y2);
    expect(slopeOut).toBeCloseTo(slopeIn, 9);
    // Halen starter like utenfor sola
    expect(Math.hypot(inn.x1 - L.sun.x, inn.y1 - L.sun.y)).toBeGreaterThan(L.sun.r);
  });

  for (const [W, f] of LAYOUTS) {
    it(`alle tallsett gir piler og tall som ikke overlapper og holder seg i figuren (W = ${W}, f = ${f})`, () => {
      const L = stralingLayout(W, f);
      for (const albedo of ALBEDOS)
        for (const eps of EPSES) {
          const { b, polys, boxes } = scene(L, albedo, eps);
          const where = `α = ${albedo}, ε = ${eps}`;
          // Pilene: innenfor figuren, utenom sola og jorda, og ikke oppå hverandre (unntatt der sollyset snur ved bakken)
          for (const { id, poly } of polys) {
            for (const p of poly) {
              expect(p.x, `${id} ${where}`).toBeGreaterThan(0);
              expect(p.x, `${id} ${where}`).toBeLessThan(W);
              expect(p.y, `${id} ${where}`).toBeGreaterThan(0);
              expect(p.y, `${id} ${where}`).toBeLessThanOrEqual(L.yG + 0.01);
            }
            const xs = poly.map((p) => p.x);
            const ys = poly.map((p) => p.y);
            const bb = {
              l: Math.min(...xs),
              r: Math.max(...xs),
              t: Math.min(...ys),
              b: Math.max(...ys),
            };
            expect(circleHitsBox(L.globe, bb), `${id} treffer jorda ${where}`).toBe(false);
          }
          for (let i = 0; i < polys.length; i++)
            for (let j = i + 1; j < polys.length; j++) {
              const pair = [polys[i]!.id, polys[j]!.id].sort().join('+');
              if (pair === 'inn+reflektert') continue;
              expect(polysOverlap(polys[i]!.poly, polys[j]!.poly), `${pair} ${where}`).toBe(false);
            }
          // Tallene: innenfor figuren, ikke oppå pilene, sola, jorda eller hverandre
          for (const { id, box } of boxes) {
            expect(box.l, `${id} ${where}`).toBeGreaterThan(2);
            expect(box.r, `${id} ${where}`).toBeLessThan(W - 2);
            expect(circleHitsBox(L.globe, box), `${id} på jorda ${where}`).toBe(false);
            expect(circleHitsBox(L.sun, box), `${id} på sola ${where}`).toBe(false);
            for (const { id: aid, poly } of polys)
              expect(polysOverlap(boxPoly(grow(box, 2)), poly), `tallet ${id} på pila ${aid} ${where}`).toBe(false);
          }
          for (let i = 0; i < boxes.length; i++)
            for (let j = i + 1; j < boxes.length; j++)
              expect(boxesOverlap(boxes[i]!.box, boxes[j]!.box), `${boxes[i]!.id}+${boxes[j]!.id} ${where}`).toBe(false);
          // Navnet på laget får plass mellom pilene og treffer ingen av dem
          const name = eps > 0 && b.atmUp * L.pxPerW >= 0.5 ? 'drivhusgasser' : 'ingen drivhusgasser';
          const lay = layerLabel(b, eps, L, name);
          expect(lay.fits, `navnet på laget ${where}`).toBe(true);
          const lb = textBox(lay.x, lay.y, 'middle', name, 17 * L.f * lay.size);
          for (const { id: aid, poly } of polys) expect(polysOverlap(boxPoly(lb), poly), `laget og ${aid} ${where}`).toBe(false);
        }
    });

    it(`skiltene med albedo og temperatur overlapper ikke (W = ${W}, f = ${f})`, () => {
      const L = stralingLayout(W, f);
      const peak = highestPeak(L);
      for (const albedo of ALBEDOS) {
        const cover = albedoCover(albedo);
        const cloud = cloudCount(cover.clouds) > 0 ? { x: CLOUD_SLOTS[0]!.x * W, y: L.cloudTop - 20 } : undefined;
        const tags = albedoTags(cover, L, peak, cloud, fmt2);
        const temp = 'bakken: 288 K = 15 °C';
        const tw = tagWidth(temp, L.f);
        const all = [
          ...tags.map((t) => ({
            id: t.id,
            box: {
              l: t.x - tagWidth(t.text, L.f) / 2,
              r: t.x + tagWidth(t.text, L.f) / 2,
              t: t.y - L.tagH / 2,
              b: t.y + L.tagH / 2,
            },
          })),
          {
            id: 'temp',
            box: {
              l: L.xS - tw / 2,
              r: L.xS + tw / 2,
              t: L.rows[1] - L.tagH / 2,
              b: L.rows[1] + L.tagH / 2,
            },
          },
        ];
        for (const { id, box } of all) {
          expect(box.l, `${id} α = ${albedo}`).toBeGreaterThan(0);
          expect(box.r, `${id} α = ${albedo}`).toBeLessThan(W);
          expect(box.b, `${id} α = ${albedo}`).toBeLessThan(L.H);
        }
        for (let i = 0; i < all.length; i++)
          for (let j = i + 1; j < all.length; j++)
            expect(boxesOverlap(all[i]!.box, all[j]!.box), `${all[i]!.id}+${all[j]!.id} α = ${albedo}`).toBe(false);
        expect(tags.some((t) => t.id === 'hav' || t.id === 'sjois')).toBe(true);
        if (albedo === 0) expect(tags.map((t) => t.id)).toEqual(['hav', 'skog']);
        if (albedo === 0.9) expect(tags.map((t) => t.id)).toEqual(['sjois', 'land-sno', 'fjell-sno', 'skyer']);
      }
    });
  }
});
