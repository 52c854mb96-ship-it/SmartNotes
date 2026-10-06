import { describe, expect, it } from 'vitest';
import { ballPose, hitterPose, type Shot, type Swing } from './ballspark-anim';
import { SPORTS, SPORT_IDS, kick, maxSpeed, squashMax } from './model-ballspark';

const K = 620;
const x0 = 320;
const R = SPORTS.fotball.r * K;
/** Kneet over og litt foran treffpunktet (fotball) og skulderen under (tennis). */
const knee: Swing = { contact: { x: x0 - R, y: 228 }, pivot: { x: 252, y: -109 } };
const shoulder: Swing = { contact: { x: x0 - R, y: 175 }, pivot: { x: 140, y: 900 } };

function shot(id: keyof typeof SPORTS, Fmax?: number, dtMs?: number): Shot {
  const s = SPORTS[id];
  return { sport: s, Fmax: Fmax ?? s.F.def, dtMs: dtMs ?? s.dtMs.def, shape: 'bue' };
}

describe('ballen i scenen', () => {
  it('ligger rund og i ro før treffet', () => {
    const p = ballPose(shot('fotball'), K, x0, R, -3);
    expect(p).toEqual({ cx: x0, sx: 1, sy: 1, back: x0 - R, q: 0 });
  });

  it('er mest presset sammen midt i treffet og rund igjen etterpå', () => {
    const s = shot('fotball');
    const mid = ballPose(s, K, x0, R, 5);
    expect(mid.q).toBeCloseTo(squashMax(s.sport, s.Fmax, s.dtMs), 12);
    expect(mid.sx).toBeLessThan(1);
    expect(mid.sy).toBeGreaterThan(1);
    expect(ballPose(s, K, x0, R, 2).q).toBeLessThan(mid.q);
    const after = ballPose(s, K, x0, R, 12);
    expect(after.q).toBe(0);
    expect(after.sx).toBe(1);
  });

  it('flytter seg v · Δt/2 i treffet og deretter med farten v', () => {
    const s = shot('fotball');
    const v = kick(s.sport.m, s.Fmax, s.dtMs / 1000, 'bue').v;
    const end = ballPose(s, K, x0, R, 10);
    expect(end.cx - x0).toBeCloseTo(((v * 0.01) / 2) * K, 6);
    const later = ballPose(s, K, x0, R, 14);
    expect(later.cx - end.cx).toBeCloseTo(v * 0.004 * K, 6);
  });
});

describe('foten, racketen og kølla', () => {
  it('treffer baksiden av ballen akkurat når treffet begynner', () => {
    const s = shot('fotball');
    const v = kick(s.sport.m, s.Fmax, s.dtMs / 1000, 'bue').v;
    const h = hitterPose(s, K, x0, R, knee, v, 0);
    expect(h.contact.x).toBeCloseTo(x0 - R, 9);
    expect(h.contact.y).toBeCloseTo(228, 9);
    expect(h.angle).toBeCloseTo(0, 12);
    expect(h.dx).toBe(0);
  });

  it('kommer bakfra før treffet, følger ballen under treffet og blir hengende etter', () => {
    for (const [id, swing] of [
      ['fotball', knee],
      ['tennis', shoulder],
      ['golf', knee],
    ] as const) {
      const s = shot(id);
      const v = kick(s.sport.m, s.Fmax, s.dtMs / 1000, 'bue').v;
      const dt = s.dtMs;
      // Før: til venstre for ballen, nærmere jo nærmere treffet
      const b1 = hitterPose(s, K, x0, R, swing, v, -0.6 * dt).contact.x;
      const b2 = hitterPose(s, K, x0, R, swing, v, -0.2 * dt).contact.x;
      expect(b1).toBeLessThan(b2);
      expect(b2).toBeLessThan(x0 - R);
      // Under: treffpunktet er der baksiden av ballen er
      for (const f of [0.1, 0.3, 0.5, 0.8, 1]) {
        const t = f * dt;
        expect(hitterPose(s, K, x0, R, swing, v, t).contact.x).toBeCloseTo(ballPose(s, K, x0, R, t).back, 6);
      }
      // Etter: ballen er raskere, så avstanden vokser
      let gap = 0;
      for (const f of [1.2, 1.5, 2]) {
        const t = f * dt;
        const g = ballPose(s, K, x0, R, t).back - hitterPose(s, K, x0, R, swing, v, t).contact.x;
        expect(g).toBeGreaterThan(gap);
        gap = g;
      }
    }
  });

  it('dreier mot klokka rundt et kne over treffpunktet og med klokka rundt en skulder under', () => {
    const s = shot('fotball');
    const v = kick(s.sport.m, s.Fmax, s.dtMs / 1000, 'bue').v;
    expect(hitterPose(s, K, x0, R, knee, v, 5).angle).toBeLessThan(0);
    expect(hitterPose(s, K, x0, R, shoulder, v, 5).angle).toBeGreaterThan(0);
  });

  it('dreier aldri mer enn 75° og gir endelige tall i alle ytterpunkter', () => {
    for (const id of SPORT_IDS) {
      const sp = SPORTS[id];
      for (const F of [sp.F.min, sp.F.max])
        for (const dtMs of [sp.dtMs.min, sp.dtMs.max]) {
          const s = shot(id, F, dtMs);
          const v = kick(sp.m, F, dtMs / 1000, 'bue').v;
          for (const t of [-sp.slowmo * 1000, 0, dtMs / 2, dtMs, sp.tAxisMs]) {
            const h = hitterPose(s, K, x0, R, knee, v, t);
            expect(Math.abs(h.angle)).toBeLessThanOrEqual(75 + 1e-9);
            for (const n of [h.angle, h.dx, h.contact.x, h.contact.y]) expect(Number.isFinite(n)).toBe(true);
            const b = ballPose(s, K, x0, R, t);
            for (const n of [b.cx, b.sx, b.sy, b.back]) expect(Number.isFinite(n)).toBe(true);
          }
        }
      expect(maxSpeed(sp)).toBeGreaterThan(kick(sp.m, sp.F.def, sp.dtMs.def / 1000, 'bue').v);
    }
  });
});
