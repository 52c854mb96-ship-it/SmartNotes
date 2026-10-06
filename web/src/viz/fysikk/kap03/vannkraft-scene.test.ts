import { describe, expect, it } from 'vitest';
import { FLOW_STEPS, HEAD_STEPS } from './model-vannkraft';
import {
  HYDRO_NARROW,
  HYDRO_WIDE,
  ROOF_PITCH,
  STREAM_MAX_Q,
  flowFraction,
  headFraction,
  hydroScene,
  labelBox,
  placeLabel,
  pointAlong,
  polylineLength,
  smoothCorners,
  terrainY,
  intakeKind,
  viewTop,
  type Pt,
} from './vannkraft-scene';
import { PRESETS } from './model-vannkraft';

const LAYOUTS = [HYDRO_WIDE, HYDRO_NARROW];
const H_ENDS = [HEAD_STEPS[0]!, HEAD_STEPS[HEAD_STEPS.length - 1]!];
const Q_ENDS = [FLOW_STEPS[0]!, FLOW_STEPS[FLOW_STEPS.length - 1]!];

describe('skalaen for fallhøyden', () => {
  it('går fra 0 til 1 langs glidebryterne, logaritmisk', () => {
    expect(headFraction(5)).toBe(0);
    expect(headFraction(1000)).toBe(1);
    expect(headFraction(0)).toBe(0);
    expect(headFraction(5000)).toBe(1);
    // Hver dobling flytter like langt
    const d1 = headFraction(20) - headFraction(10);
    const d2 = headFraction(400) - headFraction(200);
    expect(Math.abs(d1 - d2)).toBeLessThan(1e-12);
    expect(flowFraction(0.01)).toBe(0);
    expect(flowFraction(300)).toBe(1);
  });

  it('gir høyere magasin for større fallhøyde', () => {
    for (const lay of LAYOUTS) {
      let prev = Infinity;
      for (const h of HEAD_STEPS) {
        const s = hydroScene(h, 2.5, lay);
        expect(s.surfaceY).toBeLessThan(prev);
        prev = s.surfaceY;
        expect(s.turbine.y - s.surfaceY).toBeCloseTo(s.drop, 9);
      }
    }
  });
});

describe('scenen', () => {
  it('holder alt innenfor figuren for alle ytterverdier', () => {
    for (const lay of LAYOUTS) {
      for (const h of H_ENDS) {
        for (const Q of Q_ENDS) {
          const s = hydroScene(h, Q, lay);
          // Plass til himmel og etiketter over demningen
          expect(s.dam.crestY).toBeGreaterThan(50);
          expect(s.station.x + s.station.w).toBeLessThan(lay.W - 40);
          expect(s.river.x2).toBeLessThanOrEqual(lay.W);
          expect(s.dam.x).toBeGreaterThan(80);
          for (const [x, y] of s.pipe) {
            expect(Number.isFinite(x) && Number.isFinite(y)).toBe(true);
            expect(y).toBeLessThan(lay.groundY);
          }
          // Taket på stasjonen (ca. 0,3 · høyden over veggene) er under figurkanten
          expect(s.station.y - s.station.h * 1.4).toBeGreaterThan(0);
        }
      }
    }
  });

  it('har demningen og magasinet i riktig rekkefølge', () => {
    for (const lay of LAYOUTS) {
      for (const h of HEAD_STEPS) {
        const s = hydroScene(h, 1, lay);
        // Kronen over vannflata, foten under
        expect(s.dam.crestY).toBeLessThan(s.surfaceY);
        expect(s.dam.baseY).toBeGreaterThan(s.surfaceY + 10);
        expect(s.dam.toeX).toBeGreaterThan(s.dam.x + s.dam.crestW);
        // Inntaket ligger under vann, over bunnen
        expect(s.intake.y).toBeGreaterThan(s.surfaceY);
        expect(s.intake.y).toBeLessThan(s.dam.baseY);
        expect(s.intake.x).toBeLessThan(s.dam.x);
        // Fjellsida går nedover hele veien, fra foten av demningen til dalbunnen
        for (let i = 1; i < s.slope.length; i++) {
          expect(s.slope[i]![0]).toBeGreaterThan(s.slope[i - 1]![0]);
          expect(s.slope[i]![1]).toBeGreaterThanOrEqual(s.slope[i - 1]![1] - 1e-9);
        }
        expect(s.slope[0]).toEqual([s.dam.toeX, s.dam.baseY]);
        expect(s.slope[s.slope.length - 1]![1]).toBeCloseTo(lay.groundY, 9);
        // Stasjonen står til høyre for lia, elva til høyre for stasjonen
        expect(s.station.x).toBeGreaterThan(s.slope[s.slope.length - 1]![0]);
        expect(s.river.x1).toBeGreaterThan(s.station.x + s.station.w);
      }
    }
  });

  it('legger rørgata over bakken og ender i turbinen', () => {
    for (const lay of LAYOUTS) {
      for (const h of HEAD_STEPS) {
        for (const Q of Q_ENDS) {
          const s = hydroScene(h, Q, lay);
          const last = s.pipe[s.pipe.length - 1]!;
          expect(last[1]).toBeCloseTo(s.turbine.y, 9);
          expect(last[0]).toBeLessThan(s.turbine.x);
          expect(last[0]).toBeGreaterThan(s.station.x);
          // Røret går nedover (eller vannrett) hele veien
          for (let i = 1; i < s.pipe.length; i++) expect(s.pipe[i]![1]).toBeGreaterThanOrEqual(s.pipe[i - 1]![1] - 1e-9);
          // Langs lia ligger undersiden av røret over bakken
          for (const [x, y] of s.pipe) {
            if (x > s.dam.toeX + 2 && x < s.station.x) expect(y + s.pipeW / 2).toBeLessThan(terrainY(s.terrain, x) + 0.5);
          }
        }
      }
    }
  });

  it('gjør rørgata tykkere når vannføringen øker', () => {
    const thin = hydroScene(200, 0.01, HYDRO_WIDE).pipeW;
    const mid = hydroScene(200, 2.5, HYDRO_WIDE).pipeW;
    const thick = hydroScene(200, 300, HYDRO_WIDE).pipeW;
    expect(thin).toBe(HYDRO_WIDE.pipe[0]);
    expect(thick).toBe(HYDRO_WIDE.pipe[1]);
    expect(mid).toBeGreaterThan(thin);
    expect(mid).toBeLessThan(thick);
  });
});

describe('hjelpefunksjoner for polylinjer', () => {
  const pts: Pt[] = [
    [0, 0],
    [30, 40],
    [30, 100],
  ];

  it('måler lengden', () => {
    expect(polylineLength(pts)).toEqual([0, 50, 110]);
  });

  it('finner punktet og retningen langs linja', () => {
    const p = pointAlong(pts, 25);
    expect(p.x).toBeCloseTo(15);
    expect(p.y).toBeCloseTo(20);
    expect(p.dx).toBeCloseTo(0.6);
    expect(p.dy).toBeCloseTo(0.8);
    const q = pointAlong(pts, 80);
    expect(q.x).toBeCloseTo(30);
    expect(q.y).toBeCloseTo(70);
    expect(pointAlong(pts, 999).y).toBeCloseTo(100);
    expect(pointAlong(pts, -5).x).toBeCloseTo(0);
  });

  it('runder hjørner uten å flytte endepunktene', () => {
    const s = smoothCorners(pts, 2);
    expect(s[0]).toEqual([0, 0]);
    expect(s[s.length - 1]).toEqual([30, 100]);
    expect(s.length).toBeGreaterThan(pts.length);
  });

  it('leser høyden på terrenget', () => {
    expect(terrainY(pts, 15)).toBeCloseTo(20);
    expect(terrainY(pts, -10)).toBe(0);
    expect(terrainY(pts, 50)).toBe(100);
  });
});

describe('plassering av etiketter', () => {
  const frame = { x1: 0, y1: 0, x2: 400, y2: 300 };

  it('lager en boks rundt teksten etter ankeret', () => {
    const b = labelBox({ lx: 100, ly: 50, anchor: 'start' }, 10, 10, 1, 0);
    expect(b.x1).toBe(100);
    expect(b.x2).toBeCloseTo(168);
    const m = labelBox({ lx: 100, ly: 50, anchor: 'middle' }, 10, 10, 1, 0);
    expect((m.x1 + m.x2) / 2).toBeCloseTo(100);
    const e = labelBox({ lx: 100, ly: 50, anchor: 'end' }, 10, 10, 2, 0);
    expect(e.x2).toBe(100);
    // To linjer er høyere enn én
    expect(e.y2 - e.y1).toBeGreaterThan(b.y2 - b.y1);
  });

  it('velger første ledige plass', () => {
    const obstacle = { x1: 90, y1: 30, x2: 200, y2: 60 };
    const spots = [
      { lx: 100, ly: 50, anchor: 'start' as const },
      { lx: 100, ly: 120, anchor: 'start' as const },
    ];
    expect(placeLabel(spots, 8, 14, [obstacle], frame).ly).toBe(120);
    expect(placeLabel(spots, 8, 14, [], frame).ly).toBe(50);
  });

  it('unngår kanten av figuren og velger minst overlapp når alt er opptatt', () => {
    const spots = [
      { lx: 390, ly: 50, anchor: 'start' as const },
      { lx: 390, ly: 50, anchor: 'end' as const },
    ];
    expect(placeLabel(spots, 8, 14, [], frame).anchor).toBe('end');
    const wall = { x1: 0, y1: 0, x2: 400, y2: 300 };
    const p = placeLabel(spots, 8, 14, [wall], frame);
    expect(p.anchor).toBe('end');
  });
});

describe('bekkeinntak ved liten vannføring', () => {
  it('tegner bekk opp til 0,2 m³/s og magasin over', () => {
    expect(intakeKind(FLOW_STEPS[0]!)).toBe('bekk');
    expect(intakeKind(STREAM_MAX_Q)).toBe('bekk');
    expect(intakeKind(0.25)).toBe('magasin');
    expect(intakeKind(FLOW_STEPS[FLOW_STEPS.length - 1]!)).toBe('magasin');
    // Forhåndsvalgene: bare bekken ved hytta har bekkeinntak
    const kinds = Object.fromEntries(PRESETS.map((p) => [p.id, intakeKind(p.Q)]));
    expect(kinds).toEqual({ hytte: 'bekk', smaa: 'magasin', elv: 'magasin', fjell: 'magasin' });
  });

  it('har en lav terskel og en grunn inntaksdam med røret under vann', () => {
    for (const lay of LAYOUTS) {
      for (const h of HEAD_STEPS) {
        for (const Q of [0.01, 0.05, STREAM_MAX_Q]) {
          const s = hydroScene(h, Q, lay);
          const lake = hydroScene(h, 1, lay);
          expect(s.kind).toBe('bekk');
          const height = s.dam.baseY - s.dam.crestY;
          expect(height).toBeLessThan(0.6 * (lake.dam.baseY - lake.dam.crestY));
          expect(s.dam.crestY).toBeLessThan(s.surfaceY);
          // Røret (med veggen) ligger helt under vannflata og over bunnen
          expect(s.intake.y - s.pipeW / 2).toBeGreaterThan(s.surfaceY + 2);
          expect(s.intake.y + s.pipeW / 2).toBeLessThan(s.dam.baseY);
          expect(s.intake.x).toBeGreaterThan(s.pool.x1);
          expect(s.intake.x).toBeLessThan(s.dam.x);
          // Fallhøyden måles fra vannflata i dammen, som før
          expect(s.turbine.y - s.surfaceY).toBeCloseTo(s.drop, 9);
          expect(s.surfaceY).toBeCloseTo(lake.surfaceY, 9);
        }
      }
    }
  });

  it('lar bekken renne nedover fra venstre kant og ut i dammen', () => {
    for (const lay of LAYOUTS) {
      for (const h of H_ENDS) {
        const s = hydroScene(h, 0.02, lay);
        const bed = s.streamBed;
        expect(bed.length).toBeGreaterThan(5);
        expect(bed[0]![0]).toBeLessThanOrEqual(0);
        for (let i = 1; i < bed.length; i++) {
          expect(bed[i]![0]).toBeGreaterThan(bed[i - 1]![0]);
          expect(bed[i]![1]).toBeGreaterThanOrEqual(bed[i - 1]![1]);
          // Bekkeleiet er en del av terrenget
          expect(bed[i]![1]).toBeCloseTo(terrainY(s.terrain, bed[i]![0]), 6);
        }
        // Ved venstre kant ligger bekken høyere enn dammen, og den munner ut i dammen
        expect(bed[0]![1]).toBeLessThan(s.surfaceY - 10);
        expect(Math.abs(bed[bed.length - 1]![1] - s.surfaceY)).toBeLessThan(2);
        expect(bed[bed.length - 1]![0]).toBeGreaterThanOrEqual(s.pool.x1);
        // Bunnen i terrenget slutter ved foten av terskelen
        expect(s.terrain[s.bedPoints - 1]).toEqual([s.dam.x, s.dam.baseY]);
      }
    }
  });

  it('har ingen bekk når vannet kommer fra et magasin', () => {
    const s = hydroScene(200, 2.5, HYDRO_WIDE);
    expect(s.kind).toBe('magasin');
    expect(s.streamBed).toEqual([]);
    expect(s.pool.x1).toBeLessThan(0);
    expect(s.terrain[s.bedPoints - 1]).toEqual([s.dam.x, s.dam.baseY]);
  });
});

describe('utsnittet', () => {
  const room = { sky: 90, roof: 124 };

  it('beskjærer himmelen ved liten fallhøyde og viser nesten hele figuren ved stor', () => {
    for (const lay of LAYOUTS) {
      const low = viewTop(hydroScene(HEAD_STEPS[0]!, 0.01, lay), room);
      const high = viewTop(hydroScene(HEAD_STEPS[HEAD_STEPS.length - 1]!, 300, lay), room);
      // Ved 1 000 m fall vises (nesten) hele figuren
      expect(high).toBeLessThan(0.1 * lay.H);
      // Ved 5 m fall blir figuren minst en firedel lavere
      expect(low).toBeGreaterThan(0.25 * lay.H);
      expect(Number.isInteger(low)).toBe(true);
    }
  });

  it('beholder plassen over demningen og over taket på stasjonen', () => {
    for (const lay of LAYOUTS) {
      let prev = Infinity;
      for (const h of HEAD_STEPS) {
        for (const Q of Q_ENDS) {
          const s = hydroScene(h, Q, lay);
          const top = viewTop(s, room);
          expect(top).toBeGreaterThanOrEqual(0);
          if (top > 0) {
            expect(s.dam.crestY - top).toBeGreaterThanOrEqual(room.sky);
            expect(s.station.y - (1 + ROOF_PITCH) * s.station.h - top).toBeGreaterThanOrEqual(room.roof);
          }
          // Det høyeste punktet på bekkeleiet er også med
          for (const [, y] of s.streamBed) expect(y).toBeGreaterThan(top + 20);
        }
        // Større fallhøyde gir aldri mindre utsnitt
        const t = viewTop(hydroScene(h, 2.5, lay), room);
        expect(t).toBeLessThanOrEqual(prev);
        prev = t;
      }
    }
  });
});
