import { describe, expect, it } from 'vitest';
import {
  CONTACT_TIME,
  HIT_KINDS,
  LOSS,
  MU_ICE,
  SPEED,
  STONE_DIAMETER,
  STONE_MASS,
  STROBE_STEPS,
  bounceBack,
  curlingHit,
  curlingTimeline,
  frictionImpulse,
  iceFriction,
  kineticRatio,
  lossShareForSpeedShare,
  speedShareForLoss,
  stonesAt,
  strobeInterval,
  strobeTimes,
  type HitKind,
} from './model-curling';

const KINDS: HitKind[] = HIT_KINDS.map((k) => k.value);

/** Alle fartene på glidebryteren. */
const speeds: number[] = [];
for (let v = SPEED.min; v <= SPEED.max + 1e-9; v += SPEED.step) speeds.push(Math.round(v * 10) / 10);
const losses: number[] = [];
for (let l = LOSS.min; l <= LOSS.max + 1e-9; l += LOSS.step) losses.push(Math.round(l * 100) / 100);

describe('curlingHit: kjente verdier', () => {
  it('elastisk: den røde stopper helt, og den gule tar over farten', () => {
    const r = curlingHit(2, 'elastisk');
    expect(r.v1).toBe(0);
    expect(r.v2).toBeCloseTo(2, 12);
    expect(r.p).toBeCloseTo(38, 12);
    expect(r.Ek).toBeCloseTo(38, 12); // ½ · 19 · 2² = 38
    expect(r.EkAfter).toBeCloseTo(38, 12);
    expect(r.lost).toBeCloseTo(0, 12);
  });

  it('fullstendig uelastisk: felles fart v/2, og halvparten av E_k går tapt', () => {
    const r = curlingHit(2, 'fullstendig');
    expect(r.v1).toBeCloseTo(1, 12);
    expect(r.v2).toBeCloseTo(1, 12);
    expect(r.pAfter).toBeCloseTo(38, 12);
    expect(r.EkAfter).toBeCloseTo(19, 12);
    expect(r.lost).toBeCloseTo(19, 12);
    expect(r.lossShare).toBeCloseTo(0.5, 12);
  });

  it('uelastisk med 10 % tap: v₁′ = 0,0528 · v og v₂′ = 0,947 · v', () => {
    const r = curlingHit(2, 'uelastisk', 0.1);
    // a = (1 − √0,8)/2 = 0,052786
    expect(r.a).toBeCloseTo(0.0527864, 6);
    expect(r.v1).toBeCloseTo(0.105573, 5);
    expect(r.v2).toBeCloseTo(1.894427, 5);
    expect(r.lost).toBeCloseTo(3.8, 10);
    expect(r.lossShare).toBeCloseTo(0.1, 12);
  });

  it('bruker massen som gis inn', () => {
    const r = curlingHit(1.5, 'elastisk', 0, 20);
    expect(r.p).toBeCloseTo(30, 12);
    expect(r.Ek).toBeCloseTo(22.5, 12);
  });
});

describe('curlingHit: bevaringslover for alle tallsett', () => {
  it('Σp er bevart i alle støt, og E_k aldri øker', () => {
    for (const v of speeds)
      for (const kind of KINDS)
        for (const loss of kind === 'uelastisk' ? losses : [LOSS.initial]) {
          const r = curlingHit(v, kind, loss);
          expect(r.pAfter).toBeCloseTo(r.p, 10);
          expect(r.p1 + r.p2).toBeCloseTo(r.pAfter, 10);
          expect(r.v1 + r.v2).toBeCloseTo(v, 10);
          expect(r.EkAfter).toBeLessThanOrEqual(r.Ek + 1e-9);
          expect(r.Ek1 + r.Ek2).toBeCloseTo(r.EkAfter, 10);
          expect(r.lost).toBeGreaterThanOrEqual(-1e-9);
          // Den røde kan ikke gå forbi den gule eller sprette tilbake
          expect(r.v1).toBeGreaterThanOrEqual(0);
          expect(r.v1).toBeLessThanOrEqual(r.v2 + 1e-12);
          expect([r.v1, r.v2, r.p, r.Ek, r.EkAfter, r.lost, r.lossShare].every(Number.isFinite)).toBe(true);
        }
  });

  it('E_k er bevart bare i det elastiske støtet', () => {
    for (const v of speeds) {
      expect(curlingHit(v, 'elastisk').lost).toBeCloseTo(0, 10);
      expect(curlingHit(v, 'uelastisk', LOSS.min).lost).toBeGreaterThan(0);
      expect(curlingHit(v, 'fullstendig').lost).toBeGreaterThan(0);
    }
  });

  it('fullstendig uelastisk gir størst tap, og tapet i uelastisk er det som er valgt', () => {
    for (const v of speeds) {
      const full = curlingHit(v, 'fullstendig');
      for (const loss of losses) {
        const r = curlingHit(v, 'uelastisk', loss);
        expect(r.lossShare).toBeCloseTo(loss, 10);
        expect(r.lost).toBeLessThan(full.lost);
        expect(r.v1).toBeGreaterThan(0);
        expect(r.v1).toBeLessThan(full.v1);
      }
    }
  });

  it('mer tap gir likere fart', () => {
    let prev = -1;
    for (const loss of losses) {
      const r = curlingHit(2, 'uelastisk', loss);
      const gap = r.v2 - r.v1;
      if (prev >= 0) expect(gap).toBeLessThan(prev);
      prev = gap;
    }
  });
});

describe('sammenhengen mellom fartsandel og energitap', () => {
  it('speedShareForLoss er den omvendte av lossShareForSpeedShare på [0, ½]', () => {
    for (let a = 0; a <= 0.5; a += 0.01) expect(speedShareForLoss(lossShareForSpeedShare(a))).toBeCloseTo(a, 6);
    for (const L of losses) expect(lossShareForSpeedShare(speedShareForLoss(L))).toBeCloseTo(L, 10);
  });

  it('grensetilfeller: 0 tap gir a = 0, ½ tap gir a = ½, og ugyldige verdier avgrenses', () => {
    expect(speedShareForLoss(0)).toBe(0);
    expect(speedShareForLoss(0.5)).toBeCloseTo(0.5, 12);
    expect(speedShareForLoss(-1)).toBe(0);
    expect(speedShareForLoss(2)).toBeCloseTo(0.5, 12);
    expect(speedShareForLoss(Number.NaN)).toBe(0);
  });

  it('kineticRatio: 1 i elastisk, ½ i fullstendig uelastisk og over 1 hvis den røde spretter tilbake', () => {
    expect(kineticRatio(0)).toBe(1);
    expect(kineticRatio(0.5)).toBe(0.5);
    expect(kineticRatio(-0.1)).toBeGreaterThan(1);
    for (let a = 0; a <= 0.5; a += 0.05) expect(kineticRatio(a)).toBeCloseTo(1 - lossShareForSpeedShare(a), 12);
  });
});

describe('bounceBack: den røde kan ikke sprette tilbake', () => {
  it('Σp stemmer, men E_k ville blitt større enn før', () => {
    const b = bounceBack(2, 0.2);
    expect(b.v1).toBeCloseTo(-0.2, 12);
    expect(b.v2).toBeCloseTo(2.2, 12);
    expect(STONE_MASS * b.v1 + STONE_MASS * b.v2).toBeCloseTo(38, 10);
    expect(b.Ek).toBeCloseTo(38, 10);
    expect(b.EkAfter).toBeCloseTo(46.36, 10); // ½ · 19 · (0,04 + 4,84)
    for (const v of speeds) {
      const bb = bounceBack(v, 0.1 * v);
      expect(bb.EkAfter).toBeGreaterThan(bb.Ek);
    }
  });
});

describe('friksjonen i støtet', () => {
  it('R = μmg og impulsen R · Δt er bitteliten mot p', () => {
    expect(iceFriction()).toBeCloseTo(MU_ICE * STONE_MASS * 9.81, 12);
    expect(iceFriction()).toBeCloseTo(1.864, 3);
    expect(frictionImpulse()).toBeCloseTo(iceFriction() * CONTACT_TIME, 15);
    for (const v of speeds) expect(frictionImpulse() / curlingHit(v, 'elastisk').p).toBeLessThan(1e-3);
  });
});

describe('tidslinja og posisjonene i animasjonen', () => {
  it('støtet skjer når den røde har glidd approach meter, og steinene berører hverandre da', () => {
    const r = curlingHit(2, 'elastisk');
    const tl = curlingTimeline(2, 1.2, 1.2);
    expect(tl.tHit).toBeCloseTo(0.6, 12);
    expect(tl.tEnd).toBeCloseTo(1.2, 12);
    const start = stonesAt(r, tl, 0);
    expect(start.x2 - start.x1).toBeCloseTo(STONE_DIAMETER + 1.2, 12);
    const hit = stonesAt(r, tl, tl.tHit);
    expect(hit.x2 - hit.x1).toBeCloseTo(STONE_DIAMETER, 12);
    const justBefore = stonesAt(r, tl, tl.tHit - 1e-9);
    expect(justBefore.after).toBe(false);
    expect(justBefore.x1).toBeCloseTo(hit.x1, 6);
  });

  it('elastisk: den røde blir liggende der den traff, og den gule glir like langt som den røde kom', () => {
    const r = curlingHit(1.5, 'elastisk');
    const tl = curlingTimeline(1.5, 1, 1);
    const end = stonesAt(r, tl, tl.tEnd);
    expect(end.x1).toBeCloseTo(-STONE_DIAMETER, 12);
    expect(end.x2).toBeCloseTo(1, 12);
    expect(end.u1).toBe(0);
    expect(end.u2).toBeCloseTo(1.5, 12);
  });

  it('steinene overlapper aldri, og alt holder seg innenfor approach og after for alle tallsett', () => {
    for (const v of speeds)
      for (const kind of KINDS) {
        const r = curlingHit(v, kind, 0.25);
        const tl = curlingTimeline(v, 1.2, 1.2);
        for (let i = 0; i <= 60; i++) {
          const s = stonesAt(r, tl, (tl.tEnd * i) / 60);
          expect(s.x2 - s.x1).toBeGreaterThanOrEqual(STONE_DIAMETER - 1e-9);
          expect(s.x1).toBeGreaterThanOrEqual(-STONE_DIAMETER - 1.2 - 1e-9);
          expect(s.x2).toBeLessThanOrEqual(1.2 + 1e-9);
          expect(s.x2).toBeGreaterThanOrEqual(0);
        }
      }
  });

  it('avgrenser tiden til animasjonen', () => {
    const r = curlingHit(2, 'fullstendig');
    const tl = curlingTimeline(2, 1, 1);
    expect(stonesAt(r, tl, -5).x1).toBeCloseTo(stonesAt(r, tl, 0).x1, 12);
    expect(stonesAt(r, tl, 99).x2).toBeCloseTo(stonesAt(r, tl, tl.tEnd).x2, 12);
    expect(Number.isFinite(stonesAt(r, tl, Number.NaN).x1)).toBe(true);
  });
});

describe('stroboskopbildet', () => {
  it('velger et fint tidsintervall som gir omtrent ønsket avstand', () => {
    expect(strobeInterval(2, 0.2)).toBe(0.1);
    expect(strobeInterval(0.5, 0.2)).toBe(0.4);
    expect(strobeInterval(3, 0.2)).toBe(0.05);
    for (const v of speeds) {
      const dt = strobeInterval(v, 0.2);
      expect(STROBE_STEPS).toContain(dt);
      expect(v * dt).toBeGreaterThan(0.12);
      expect(v * dt).toBeLessThan(0.3);
    }
  });

  it('ett bilde tas akkurat i støtet, med like lang tid mellom bildene', () => {
    const tl = curlingTimeline(2, 1.2, 1.2);
    const ts = strobeTimes(tl, 0.1, tl.tEnd);
    expect(ts.some((t) => Math.abs(t - tl.tHit) < 1e-12)).toBe(true);
    expect(ts[0]).toBeGreaterThanOrEqual(0);
    expect(ts[0]).toBeLessThan(0.1);
    expect(ts[ts.length - 1]).toBeLessThanOrEqual(tl.tEnd + 1e-9);
    for (let i = 1; i < ts.length; i++) expect(ts[i]! - ts[i - 1]!).toBeCloseTo(0.1, 12);
    expect(ts.length).toBe(13); // 0, 0,1 … 1,2 s
  });

  it('viser bare bildene fram til nå, og ingenting med ugyldig intervall', () => {
    const tl = curlingTimeline(2, 1.2, 1.2);
    expect(strobeTimes(tl, 0.1, 0.35).every((t) => t <= 0.35 + 1e-9)).toBe(true);
    expect(strobeTimes(tl, 0, 1)).toEqual([]);
    expect(strobeTimes(tl, Number.NaN, 1)).toEqual([]);
  });
});
