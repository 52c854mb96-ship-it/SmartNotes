import { describe, expect, it } from 'vitest';
import {
  ARROW_GAP,
  FOOT_LIFT,
  FRIEND_HEIGHT,
  HEADROOM,
  LAYOUT_NARROW,
  LAYOUT_WIDE,
  LUPE_RUNNER,
  MAX_MASS,
  RUNNER_HEIGHT,
  STEP_RISE,
  cameraLift,
  friendX,
  hillItems,
  lupeForceScale,
  lupeForces,
  lupeMap,
  outerTangents,
  panelBox,
  runnerOnScreen,
  runnerPlace,
  runnerPose,
  runnerRing,
  stairGeometry,
  stanceFoot,
  stairView,
  toScreen,
  type Circle,
} from './trappelop-scene';

const LAYOUTS = [
  { name: 'bred', lay: LAYOUT_WIDE, f: [1, 1.1] },
  { name: 'smal', lay: LAYOUT_NARROW, f: [1.2, 1.35] },
];
/** Alle høydene på glidebryteren (1–30 m i steg på 0,5 m). */
const HEIGHTS = Array.from({ length: 59 }, (_, i) => 1 + i * 0.5);
const US = Array.from({ length: 101 }, (_, i) => i / 100);
const dist = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y);
/** Avstanden fra kanten av sirkelen til nærmeste punkt i et rektangel (negativ når de overlapper). */
const circleToBox = (c: Circle, b: { x: number; y: number; w: number; h: number }) =>
  Math.hypot(Math.max(b.x, Math.min(c.x, b.x + b.w)) - c.x, Math.max(b.y, Math.min(c.y, b.y + b.h)) - c.y) - c.r;

describe('steintrappa', () => {
  it('har trinn på ca. 19 cm som går opp i høyden', () => {
    const g = stairGeometry(9);
    expect(g.n).toBe(47);
    expect(g.n * g.rise).toBeCloseTo(9, 12);
    expect(g.rise).toBeGreaterThan(0.18);
    expect(g.rise).toBeLessThan(0.2);
    expect(g.L).toBeCloseTo(47 * 0.26, 12);
    expect(g.angle).toBeGreaterThan(34);
    expect(g.angle).toBeLessThan(38);
    for (const h of HEIGHTS) {
      const s = stairGeometry(h);
      expect(s.n * s.rise).toBeCloseTo(h, 9);
      expect(Math.abs(s.rise - STEP_RISE)).toBeLessThan(0.1);
    }
  });

  it('tåler ugyldig høyde', () => {
    for (const h of [0, -3, Number.NaN]) {
      const g = stairGeometry(h);
      expect(g.n).toBe(1);
      expect(Number.isFinite(g.angle)).toBe(true);
    }
  });
});

describe('skala og kamera', () => {
  it('bruker én skala som får plass til hele trappa når den er lav nok', () => {
    for (const { lay } of LAYOUTS) {
      for (const h of HEIGHTS) {
        const g = stairGeometry(h);
        const v = stairView(g, lay);
        expect(v.S).toBeGreaterThanOrEqual(lay.Smin);
        expect(v.S).toBeLessThanOrEqual(lay.Smax);
        if (v.cMax === 0) {
          const top = toScreen(g, lay, v.S, 0, g.L, g.h);
          expect(top.x).toBeLessThanOrEqual(lay.xTopMax + 1e-6);
          expect(top.y - HEADROOM * v.S).toBeGreaterThanOrEqual(lay.yTopMin - 1e-6);
        }
      }
    }
  });

  it('kameraet følger med opp en høy trapp og står stille nederst', () => {
    const g = stairGeometry(30);
    const v = stairView(g, LAYOUT_WIDE);
    expect(v.cMax).toBeGreaterThan(0);
    expect(cameraLift(v, 0)).toBe(0);
    expect(cameraLift(v, 30)).toBeCloseTo(v.cMax, 12);
    // Kameraet flytter seg aldri mer enn løperen.
    for (const c of [5, 10, 20]) expect(cameraLift(v, c)).toBeLessThanOrEqual(c);
    // Toppen av trappa er inne i figuren når kameraet er ved toppen.
    const top = toScreen(g, LAYOUT_WIDE, v.S, v.cMax, g.L, g.h);
    expect(top.y - HEADROOM * v.S).toBeGreaterThanOrEqual(LAYOUT_WIDE.yTopMin - 1e-6);
    expect(top.x).toBeLessThanOrEqual(LAYOUT_WIDE.xTopMax + 1e-6);
  });

  it('flytter kameraet langs trappa, så foten av trappa og toppen ligger på samme linje i figuren', () => {
    const g = stairGeometry(30);
    const lay = LAYOUT_WIDE;
    const v = stairView(g, lay);
    const a = toScreen(g, lay, v.S, 0, 0, 0);
    const b = toScreen(g, lay, v.S, v.cMax, 0, 0);
    expect((a.y - b.y) / (b.x - a.x)).toBeCloseTo(g.rise / g.run, 9);
  });
});

describe('løperen', () => {
  it('står klar nederst, løfter seg jevnt og står på toppen til slutt', () => {
    const g = stairGeometry(9);
    expect(runnerPlace(g, 0)).toMatchObject({ phase: 'start', y: 0 });
    expect(runnerPlace(g, 1)).toMatchObject({ phase: 'top', y: 9 });
    const mid = runnerPlace(g, 0.5);
    expect(mid.phase).toBe('climb');
    expect(mid.y - FOOT_LIFT * g.rise).toBeCloseTo(4.5, 12);
    expect(mid.fase).toBeGreaterThanOrEqual(0);
    expect(mid.fase).toBeLessThan(1);
  });

  it('er inne i figuren hele veien', () => {
    for (const { lay } of LAYOUTS) {
      for (const h of HEIGHTS) {
        const g = stairGeometry(h);
        const v = stairView(g, lay);
        for (const u of US) {
          const p = runnerOnScreen(g, lay, v, u);
          expect(p.x - 0.35 * v.S).toBeGreaterThan(0);
          expect(p.x + 0.35 * v.S).toBeLessThan(lay.W);
          expect(p.y).toBeLessThanOrEqual(lay.yBot + 1e-6);
          expect(p.y - RUNNER_HEIGHT * v.S).toBeGreaterThan(0);
        }
      }
    }
  });
});

describe('lupen', () => {
  it('ligger ved siden av skiltet og over trappa, og ringen rundt løperen kommer aldri borti den', () => {
    for (const { lay, f } of LAYOUTS) {
      const L = lay.lupe;
      expect(L.x - L.r).toBeGreaterThan(4);
      expect(L.y - L.r).toBeGreaterThan(4);
      for (const ff of f) {
        const panel = panelBox(ff, Math.max(1, ff * 0.85), lay);
        expect(circleToBox(L, panel)).toBeGreaterThan(8);
        expect(panel.x).toBeGreaterThan(0);
        expect(panel.x + panel.w).toBeLessThan(lay.W);
      }
      for (const h of HEIGHTS) {
        const g = stairGeometry(h);
        const v = stairView(g, lay);
        for (const u of US) {
          const place = runnerPlace(g, u);
          const ring = runnerRing(runnerOnScreen(g, lay, v, u), v.S, runnerPose(g, place, true), place.fase);
          expect(dist(ring, L), `${lay.W}: h = ${h}, u = ${u}`).toBeGreaterThan(ring.r + L.r + 6);
        }
      }
    }
  });

  it('viser det samme punktet på løperen (tyngdepunktet) midt i lupen som midt i ringen', () => {
    const lay = LAYOUT_WIDE;
    const g = stairGeometry(9);
    const v = stairView(g, lay);
    const place = runnerPlace(g, 0.4);
    const rp = runnerPose(g, place, true);
    const p = toScreen(g, lay, v.S, 0, place.x, place.y);
    const ring = runnerRing(p, v.S, rp, place.fase);
    // Punktet i midten av ringen, tilbake til verden (m) …
    const wx = (ring.x - lay.xs) / v.S;
    const wy = (lay.yBot - ring.y) / v.S;
    // … havner midt i lupen.
    const m = lupeMap(lay.lupe, place, rp);
    expect(m.ox + wx * m.Z).toBeCloseTo(lay.lupe.x, 9);
    expect(m.oy - wy * m.Z).toBeCloseTo(lay.lupe.y, 9);
    expect(m.Z * RUNNER_HEIGHT).toBeCloseTo(LUPE_RUNNER * lay.lupe.r, 9);
    // Ankerpunktet i lupen er der løperen står.
    expect(m.ox + place.x * m.Z).toBeCloseTo(m.anchor.x, 9);
    expect(m.oy - place.y * m.Z).toBeCloseTo(m.anchor.y, 9);
  });

  it('har en fast kraftskala, så G er proporsjonal med massen og lang nok til å leses også ved 30 kg', () => {
    for (const { lay } of LAYOUTS) {
      const L = lay.lupe;
      const k = lupeForceScale(L);
      expect(MAX_MASS * 9.81 * k).toBeCloseTo(L.force * L.r, 9);
      expect(60 * 9.81 * k).toBeCloseTo(30 * 9.81 * k * 2, 9);
    }
    // Ca. 25 CSS-px ved 30 kg på mobil (figuren er ca. 330 px bred for 560 enheter) og ca. 28 px på PC (ca. 880 px for 800).
    expect(30 * 9.81 * lupeForceScale(LAYOUT_NARROW.lupe)).toBeGreaterThan(42);
    expect(30 * 9.81 * lupeForceScale(LAYOUT_WIDE.lupe)).toBeGreaterThan(25);
  });

  it('skiltet står aldri over løperen (heller ikke med armene i været på toppen)', () => {
    for (const { lay, f } of LAYOUTS) {
      for (const ff of f) {
        const panel = panelBox(ff, Math.max(1, ff * 0.85), lay);
        for (const h of HEIGHTS) {
          const g = stairGeometry(h);
          const v = stairView(g, lay);
          for (const u of US) {
            const p = runnerOnScreen(g, lay, v, u);
            const under = p.x + 0.4 * v.S > panel.x && p.x - 0.4 * v.S < panel.x + panel.w;
            if (under) expect(p.y - 1.27 * RUNNER_HEIGHT * v.S, `${lay.W}: h = ${h}, u = ${u}`).toBeGreaterThan(panel.y + panel.h + 4);
          }
        }
      }
    }
  });
});

describe('løperens positur', () => {
  it('står nederst, går eller løper i trappa og jubler på toppen', () => {
    const g = stairGeometry(9);
    expect(runnerPose(g, runnerPlace(g, 0), true)).toMatchObject({ pose: 'staa', skraaning: 0 });
    expect(runnerPose(g, runnerPlace(g, 1), true)).toMatchObject({ pose: 'armer-opp', skraaning: 0 });
    const walk = runnerPose(g, runnerPlace(g, 0.5), false);
    const run = runnerPose(g, runnerPlace(g, 0.5), true);
    expect(walk.skraaning).toBeCloseTo(g.angle, 12);
    // Løper hun, lener hun seg mer forover og svinger armene.
    expect(run.ledd?.rygg).toBeGreaterThan(walk.ledd?.rygg ?? 0);
    expect(run.ledd?.hoyreSkulder).toBeDefined();
  });
});

describe('pilene i lupen', () => {
  it('er like lange (F = G med jevn fart), står side om side og begynner inne i lupen', () => {
    for (const { lay } of LAYOUTS) {
      const L = lay.lupe;
      for (const h of [1, 9, 30]) {
        const g = stairGeometry(h);
        for (const u of US) {
          const place = runnerPlace(g, u);
          for (const running of [false, true]) {
            const rp = runnerPose(g, place, running);
            const size = RUNNER_HEIGHT * lupeMap(L, place, rp).Z;
            for (const m of [30, 60, MAX_MASS]) {
              const { G, up, com } = lupeForces(L, place, rp, m);
              const lenG = G.y2 - G.y1;
              const lenUp = up.y1 - up.y2;
              expect(lenG).toBeCloseTo(m * 9.81 * lupeForceScale(L), 9);
              expect(lenUp).toBeCloseTo(lenG, 9);
              expect(G.x1).toBe(com.x);
              // Ikke oppå hverandre: pilspissene (ca. 2 · 10 px brede) får plass ved siden av hverandre.
              expect(up.x1 - G.x1).toBeGreaterThanOrEqual(ARROW_GAP * size - 1e-9);
              expect(up.x1 - G.x1).toBeGreaterThan(21);
              // Begge pilene begynner inne i lupen (G midt i den).
              for (const [x, y] of [
                [G.x1, G.y1],
                [up.x1, up.y1],
              ] as const) {
                expect(dist({ x, y }, L), `h = ${h}, u = ${u}, m = ${m}`).toBeLessThan(L.r - 6);
              }
              // For 60 kg er begge pilene inne i lupen. For større masser kan G gå ut under lupen, og spissen på F kan
              // så vidt nå ut over kanten, men begge er inne i figuren.
              if (m <= 60) {
                expect(dist({ x: G.x2, y: G.y2 }, L)).toBeLessThan(L.r - 6);
                expect(dist({ x: up.x2, y: up.y2 }, L)).toBeLessThan(L.r - 6);
              }
              expect(dist({ x: up.x2, y: up.y2 }, L)).toBeLessThan(1.1 * L.r);
              expect(up.y2).toBeGreaterThan(L.y - L.r);
              expect(G.y2 + 20).toBeLessThan(lay.H);
            }
          }
        }
      }
    }
  });

  it('G går aldri inn i ringen rundt løperen i scenen, heller ikke for den største massen', () => {
    for (const { lay } of LAYOUTS) {
      for (const h of HEIGHTS) {
        const g = stairGeometry(h);
        const v = stairView(g, lay);
        for (const u of US) {
          const place = runnerPlace(g, u);
          const rp = runnerPose(g, place, true);
          const ring = runnerRing(runnerOnScreen(g, lay, v, u), v.S, rp, place.fase);
          const { G } = lupeForces(lay.lupe, place, rp, MAX_MASS);
          expect(dist({ x: G.x2, y: G.y2 }, ring), `${lay.W}: h = ${h}, u = ${u}`).toBeGreaterThan(ring.r + 4);
        }
      }
    }
  });

  it('G og etiketten (til venstre for spissen) kommer ikke borti hodet til venninnen', () => {
    for (const { lay } of LAYOUTS) {
      for (const h of HEIGHTS) {
        const g = stairGeometry(h);
        const v = stairView(g, lay);
        const fx = lay.xs + friendX(lay, v.S) * v.S;
        const head = lay.yBot - FRIEND_HEIGHT * v.S;
        for (const u of [0, 0.3, 0.7, 1]) {
          const place = runnerPlace(g, u);
          const { G } = lupeForces(lay.lupe, place, runnerPose(g, place, true), MAX_MASS);
          // Hodet er ca. 0,25 m bredt; etiketten «G» står ca. 30 px til venstre for spissen.
          if (G.x2 - 34 < fx + 0.2 * v.S && G.x2 + 12 > fx - 0.2 * v.S) expect(head - G.y2, `${lay.W}: h = ${h}`).toBeGreaterThan(12);
        }
      }
    }
  });

  it('har kraften oppover fra foten som står på trinnet og G fra tyngdepunktet midt i lupen', () => {
    const L = LAYOUT_WIDE.lupe;
    const g = stairGeometry(9);
    const start = runnerPlace(g, 0);
    const f0 = lupeForces(L, start, runnerPose(g, start, false), 60);
    const m0 = lupeMap(L, start, runnerPose(g, start, false));
    // Nederst står hun på flat bakke: N begynner på bakken.
    expect(f0.up.y1).toBeCloseTo(m0.anchor.y, 1);
    // Tyngdepunktet er midt i lupen.
    expect(f0.com.x).toBeCloseTo(L.x, 1);
    expect(f0.com.y).toBeCloseTo(L.y, 1);
    // I trappa begynner F under sålen til foten som står på trinnet (den andre foten er i lufta), eller like foran
    // den når foten står nesten rett under tyngdepunktet.
    let atFoot = 0;
    for (const u of US.filter((x) => x > 0 && x < 1)) {
      const place = runnerPlace(g, u);
      for (const running of [false, true]) {
        const rp = runnerPose(g, place, running);
        const m1 = lupeMap(L, place, rp);
        const size = RUNNER_HEIGHT * m1.Z;
        const plass = { x: m1.anchor.x, y: m1.anchor.y, skraaning: rp.skraaning, fase: place.fase };
        const foot = stanceFoot(rp, size, plass);
        // Foten står på linja langs trinnene (innenfor 2,5 % av høyden, ca. 4 cm, også når begge føttene er i ferd med å
        // skifte), mens den andre foten er i lufta
        expect(Math.abs(foot.above)).toBeLessThan(0.025 * size);
        const f1 = lupeForces(L, place, rp, 60);
        expect(f1.up.y1).toBeCloseTo(foot.y, 9);
        expect(f1.up.x1).toBeGreaterThanOrEqual(foot.x - 1e-9);
        expect(f1.up.x1 - foot.x).toBeLessThan(0.16 * size);
        if (f1.up.x1 === foot.x) atFoot++;
      }
    }
    // Som regel står pila rett under foten
    expect(atFoot).toBeGreaterThan(US.length * 0.6);
  });
});

describe('tangentene fra ringen til lupen', () => {
  it('står vinkelrett på radiene i begge sirklene', () => {
    const a: Circle = { x: 500, y: 300, r: 40 };
    const b: Circle = { x: 120, y: 200, r: 90 };
    const t = outerTangents(a, b);
    expect(t).not.toBeNull();
    for (const [p, q] of t!) {
      expect(dist(p, a)).toBeCloseTo(a.r, 9);
      expect(dist(q, b)).toBeCloseTo(b.r, 9);
      const dx = q.x - p.x;
      const dy = q.y - p.y;
      expect(dx * (p.x - a.x) + dy * (p.y - a.y)).toBeCloseTo(0, 6);
      expect(dx * (q.x - b.x) + dy * (q.y - b.y)).toBeCloseTo(0, 6);
    }
  });

  it('er tomme når sirklene overlapper', () => {
    expect(outerTangents({ x: 0, y: 0, r: 50 }, { x: 60, y: 0, r: 20 })).toBeNull();
  });
});

describe('skiltet', () => {
  it('blir større med teksten på mobil og står fast, oppe til venstre på PC og oppe til høyre på mobil', () => {
    const pc = panelBox(1, 1, LAYOUT_WIDE);
    const mob = panelBox(1.3, 1.1, LAYOUT_NARROW);
    expect(mob.w).toBeGreaterThan(pc.w);
    expect(mob.h).toBeGreaterThan(pc.h);
    for (const p of [pc, mob]) {
      expect(p.clockX - p.clockR).toBeGreaterThan(p.x);
      expect(p.textX).toBeGreaterThan(p.clockX + p.clockR);
    }
    expect(pc.x).toBe(12);
    expect(mob.x + mob.w).toBeCloseTo(LAYOUT_NARROW.W - 12, 9);
  });
});

describe('detaljene i lia', () => {
  it('står under trappa, ikke ved mållinja og ikke ved foten av trappa', () => {
    for (const h of [1, 3, 9, 15, 30]) {
      const g = stairGeometry(h);
      const tan = g.rise / g.run;
      for (const it of hillItems(g)) {
        const surface = Math.min(it.x * tan, g.h);
        expect(it.y + it.w * 0.6).toBeLessThan(surface - 0.65);
        expect(Math.abs(it.x - g.L)).toBeGreaterThan(0.7);
        expect(it.x - it.w / 2).toBeGreaterThan(1.9);
        expect(it.y).toBeGreaterThanOrEqual(-0.35);
      }
    }
  });

  it('er like for samme trapp og blir ikke tettere i en kort trapp', () => {
    const g = stairGeometry(9);
    expect(hillItems(g)).toEqual(hillItems(g));
    const perMetre = (h: number) => {
      const s = stairGeometry(h);
      return hillItems(s, 23, 400).length / (s.L + 6);
    };
    expect(perMetre(3)).toBeLessThan(perMetre(9) * 1.6);
  });
});
