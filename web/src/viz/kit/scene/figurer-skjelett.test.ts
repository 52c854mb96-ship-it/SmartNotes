import { describe, expect, it } from 'vitest';
import { BALL, EYE_POS, armRaised, GAIT_STRIDE, HEEL, NOSE_TIP, PLANTED, POSER, SKI_DROP, TOE, UPPER_R, personPunkter, solve, type Pt, type PersonPose } from './figurer-skjelett';

const dot = (a: Pt, b: Pt) => a.x * b.x + a.y * b.y;

/** Avstanden fra p til linjestykket a–b, og hvor langt langs det (0–1) det nærmeste punktet ligger. */
function segDist(p: Pt, a: Pt, b: Pt): { d: number; t: number } {
  const ab = { x: b.x - a.x, y: b.y - a.y };
  const t = Math.min(1, Math.max(0, dot({ x: p.x - a.x, y: p.y - a.y }, ab) / dot(ab, ab)));
  return { d: Math.hypot(p.x - a.x - ab.x * t, p.y - a.y - ab.y * t), t };
}

const PLANTED_POSES = (Object.keys(PLANTED) as PersonPose[]).filter((p) => PLANTED[p].every((v) => v !== null));

describe('figurer: føtter på bakken', () => {
  it.each([0, 20, -20])('begge kontaktpunktene ligger på bakkelinja (skraaning %i)', (skraaning) => {
    for (const pose of PLANTED_POSES) {
      const sk = solve(pose, 100, undefined, { skraaning });
      const depth = (p: Pt) => dot(p, sk.slopeN);
      const v = sk.contact.venstre!;
      const h = sk.contact.hoyre!;
      expect(v, pose).toBeDefined();
      expect(h, pose).toBeDefined();
      if (pose === 'sitte') {
        // Ankerpunktet er setet: begge sålene står på samme gulv.
        expect(Math.abs(depth(v) - depth(h)), `${pose} ${skraaning}`).toBeLessThan(0.3);
      } else {
        const ground = depth(sk.anchor);
        expect(Math.abs(depth(v) - ground), `${pose} venstre ${skraaning}`).toBeLessThan(0.3);
        expect(Math.abs(depth(h) - ground), `${pose} hoyre ${skraaning}`).toBeLessThan(0.3);
      }
      // Ingen del av foten (eller skia) går gjennom bakken.
      const lowest = Math.max(...sk.ground.map(depth));
      expect(lowest - Math.max(depth(v), depth(h)), pose).toBeLessThan(0.3);
    }
  });

  it('positurene er ferdig utregnet og endelige', () => {
    for (const j of Object.values(POSER)) for (const v of Object.values(j)) expect(Number.isFinite(v)).toBe(true);
  });

  it('personPunkter tar hensyn til ski: false (ankerpunktet under sålene i stedet for under skiene)', () => {
    const med = personPunkter('ski', 100);
    const uten = personPunkter('ski', 100, undefined, { ski: false });
    expect(uten.hofte.y - med.hofte.y).toBeCloseTo(SKI_DROP, 1);
    expect(uten.venstreFot.y).toBeCloseTo(0, 1);
  });
});

describe('figurer: gange og løp', () => {
  it.each(['gaa', 'loepe'] as const)('foten i ståfasen står stille på bakken når personen flyttes GAIT_STRIDE · size per syklus (%s)', (pose) => {
    const size = 120;
    const S = GAIT_STRIDE[pose] * size;
    const n = 400;
    let locked = 0;
    let prevH = NaN;
    for (let i = 0; i < n; i++) {
      const fase = i / n;
      const p1 = personPunkter(pose, size, undefined, { x: S * fase, y: 0, fase });
      const fase2 = fase + 1 / n;
      const p2 = personPunkter(pose, size, undefined, { x: S * fase2, y: 0, fase: fase2 });
      // Fotsålen i bakken: står den på bakken i begge bildene, skal den ikke ha flyttet seg.
      for (const side of ['venstreFot', 'hoyreFot'] as const) {
        expect(p1[side].y, `${pose} ${fase} ${side}`).toBeLessThan(0.05);
        if (p1[side].y > -0.02 && p2[side].y > -0.02) {
          expect(Math.abs(p2[side].x - p1[side].x), `${pose} ${fase} ${side}`).toBeLessThan(0.06);
          locked++;
        }
      }
      // Hofta går jevnt opp og ned (ingen hopp når en fot slipper bakken).
      if (Number.isFinite(prevH)) expect(Math.abs(p1.hofte.y - prevH), `${pose} ${fase}`).toBeLessThan(0.6);
      prevH = p1.hofte.y;
    }
    // Midt i ståfasen ligger foten flatt en god stund.
    expect(locked).toBeGreaterThan(n * (pose === 'gaa' ? 0.3 : 0.08));
  });

  it.each(['gaa', 'loepe'] as const)('ingen del av foten går gjennom bakken (%s)', (pose) => {
    for (let i = 0; i < 200; i++) {
      const sk = solve(pose, 100, undefined, { fase: i / 200 });
      for (const leg of [sk.legs.venstre, sk.legs.hoyre]) {
        for (const q of [HEEL, BALL, TOE]) expect(leg.foot(q.x, q.y).y - sk.anchor.y).toBeLessThan(0.05);
      }
    }
  });
});

describe('figurer: armer opp', () => {
  it('øyet og nesa ligger utenfor den nære overarmen', () => {
    const sk = solve('armer-opp', 100, undefined, {});
    const a = sk.arms.hoyre;
    for (const q of [EYE_POS, NOSE_TIP]) {
      const { d, t } = segDist(sk.head(q.x, q.y), a.s, a.e);
      expect(d).toBeGreaterThan(UPPER_R[0] + (UPPER_R[1] - UPPER_R[0]) * t + 0.8);
    }
  });

  it('med hendene festet rett over hodet tegnes den nære armen bak hodet', () => {
    for (const pose of ['armer-opp', 'falle'] as const) {
      const fest = { hoyreHand: { x: 6, y: -118 }, venstreHand: { x: 2, y: -118 } };
      expect(armRaised(solve(pose, 100, undefined, { fest }).arms.hoyre), pose).toBe(true);
    }
    expect(armRaised(solve('armer-opp', 100, undefined, {}).arms.hoyre)).toBe(true);
    for (const pose of ['staa', 'gaa', 'dra', 'skyve', 'kaste'] as const) expect(armRaised(solve(pose, 100, undefined, {}).arms.hoyre), pose).toBe(false);
  });
});
