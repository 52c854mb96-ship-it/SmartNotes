import { describe, expect, it } from 'vitest';
import { G_EARTH } from '../../kit/format';
import { criticalAngleDeg, incline } from './model';
import {
  BLOCK_ASPECT,
  BLOCK_MATERIALS,
  PLANK,
  TILT_RUN,
  blockSize,
  slideRoom,
  tiltEnd,
  tiltState,
  tiltTimes,
  type BlockMaterial,
  type TiltInput,
} from './model-skraplan';

const RAD = Math.PI / 180;
const MATERIALS = Object.keys(BLOCK_MATERIALS) as BlockMaterial[];

describe('klossene', () => {
  it('har μk ≤ μs, rimelige friksjonstall og tettheter', () => {
    for (const k of MATERIALS) {
      const d = BLOCK_MATERIALS[k];
      expect(d.muK).toBeLessThanOrEqual(d.muS);
      expect(d.muS).toBeGreaterThan(0);
      expect(d.muS).toBeLessThanOrEqual(1);
      expect(d.density).toBeGreaterThan(500);
    }
    // Rekkefølgen som i forklaringen: is glatt, gummi mest friksjon
    expect(BLOCK_MATERIALS.is.muS).toBeLessThan(BLOCK_MATERIALS.metall.muS);
    expect(BLOCK_MATERIALS.metall.muS).toBeLessThan(BLOCK_MATERIALS.tre.muS);
    expect(BLOCK_MATERIALS.tre.muS).toBeLessThan(BLOCK_MATERIALS.gummi.muS);
  });

  it('gir grensevinkler som er tydelig forskjellige', () => {
    expect(criticalAngleDeg(BLOCK_MATERIALS.is.muS)).toBeCloseTo(5.71, 2);
    expect(criticalAngleDeg(BLOCK_MATERIALS.metall.muS)).toBeCloseTo(19.29, 2);
    expect(criticalAngleDeg(BLOCK_MATERIALS.tre.muS)).toBeCloseTo(26.57, 2);
    expect(criticalAngleDeg(BLOCK_MATERIALS.gummi.muS)).toBeCloseTo(38.66, 2);
  });

  it('har størrelse etter massen og tettheten: V = m/ρ', () => {
    for (const k of MATERIALS) {
      for (const m of [1, 4, 10]) {
        const { length, height } = blockSize(m, k);
        expect(length / height).toBeCloseTo(BLOCK_ASPECT, 12);
        // Dybden er like stor som høyden
        expect(length * height * height * BLOCK_MATERIALS[k].density).toBeCloseTo(m, 9);
      }
    }
    // Trekloss på 4 kg: h = ∛(4/600/1,5) = 0,1644 m
    expect(blockSize(4, 'tre').height).toBeCloseTo(0.1644, 4);
    // Ti ganger så stor masse gir ∛10 ganger så stor kloss
    expect(blockSize(10, 'is').height / blockSize(1, 'is').height).toBeCloseTo(Math.cbrt(10), 12);
    // Samme masse: aluminium er minst, tre størst
    expect(blockSize(4, 'metall').height).toBeLessThan(blockSize(4, 'gummi').height);
    expect(blockSize(4, 'gummi').height).toBeLessThan(blockSize(4, 'is').height);
    expect(blockSize(4, 'is').height).toBeLessThan(blockSize(4, 'tre').height);
  });

  it('gir null for masse null eller ugyldig masse', () => {
    expect(blockSize(0, 'tre')).toEqual({ length: 0, height: 0 });
    expect(blockSize(Number.NaN, 'tre')).toEqual({ length: 0, height: 0 });
  });
});

/** Numerisk løsning (små steg) av det samme forsøket, til å kontrollere de eksakte uttrykkene. */
function numeric({ m, muS, muK }: TiltInput, t: number, dt = 1e-5) {
  const mu = Math.min(muK, muS);
  const { tSlip, holdDeg } = tiltTimes({ muS }, TILT_RUN);
  let v = 0;
  let s = 0;
  let tau = tSlip;
  const acc = (time: number) => {
    const al = Math.min(TILT_RUN.omegaDeg * time, holdDeg) * RAD;
    return G_EARTH * (Math.sin(al) - mu * Math.cos(al));
  };
  while (tau < t - 1e-12) {
    const h = Math.min(dt, t - tau);
    // RK4 for (s, v)
    const k1v = acc(tau);
    const k1s = v;
    const k2v = acc(tau + h / 2);
    const k2s = v + (h / 2) * k1v;
    const k3v = k2v;
    const k3s = v + (h / 2) * k2v;
    const k4v = acc(tau + h);
    const k4s = v + h * k3v;
    v += (h / 6) * (k1v + 2 * k2v + 2 * k3v + k4v);
    s += (h / 6) * (k1s + 2 * k2s + 2 * k3s + k4s);
    tau += h;
  }
  void m;
  return { v, s };
}

describe('forsøket: planken løftes til klossen glir', () => {
  const tre: TiltInput = { m: 4, ...BLOCK_MATERIALS.tre };

  it('ligger i ro med R = G∥ til grensevinkelen', () => {
    const { tSlip } = tiltTimes(tre, TILT_RUN);
    expect(tSlip).toBeCloseTo(26.565 / 6, 3);
    for (const t of [0, 1, 2.5, tSlip * 0.99, tSlip]) {
      const st = tiltState(tre, TILT_RUN, t);
      const ref = incline({ alphaDeg: st.alphaDeg, ...tre });
      expect(st.moving).toBe(false);
      expect(st.alphaDeg).toBeCloseTo(6 * t, 9);
      expect(st.R).toBeCloseTo(ref.Gpar, 9);
      expect(st.N).toBeCloseTo(ref.N, 9);
      expect(st.R).toBeLessThanOrEqual(ref.Rmax + 1e-9);
      expect(st.v).toBe(0);
      expect(st.s).toBe(0);
    }
  });

  it('glir etter grensevinkelen, med glidefriksjon og a = g(sin α − μk cos α)', () => {
    const { tSlip, tHold, holdDeg } = tiltTimes(tre, TILT_RUN);
    expect(holdDeg).toBeCloseTo(criticalAngleDeg(0.5) + 1, 9);
    for (const t of [tSlip + 0.01, (tSlip + tHold) / 2, tHold, tHold + 0.3, tHold + 1]) {
      const st = tiltState(tre, TILT_RUN, t);
      const ref = incline({ alphaDeg: st.alphaDeg, ...tre });
      expect(st.moving).toBe(true);
      expect(ref.moving).toBe(true);
      expect(st.R).toBeCloseTo(ref.Rk, 9);
      expect(st.a).toBeCloseTo(ref.a, 9);
      expect(st.a).toBeGreaterThan(0);
    }
    // Etter at du har stoppet, står planken stille på holdevinkelen
    expect(tiltState(tre, TILT_RUN, tHold + 2).alphaDeg).toBeCloseTo(holdDeg, 12);
  });

  it('stemmer med en numerisk løsning, både mens planken løftes og etterpå', () => {
    const cases: TiltInput[] = [tre, { m: 1, ...BLOCK_MATERIALS.is }, { m: 7, ...BLOCK_MATERIALS.gummi }, { m: 2, muS: 0, muK: 0 }, { m: 3, muS: 0.6, muK: 0.6 }];
    for (const c of cases) {
      const { tSlip, tHold } = tiltTimes(c, TILT_RUN);
      for (const t of [(tSlip + tHold) / 2, tHold, tHold + 0.4, tHold + 1.5]) {
        const ex = tiltState(c, TILT_RUN, t);
        const nu = numeric(c, t);
        expect(ex.v).toBeCloseTo(nu.v, 6);
        expect(ex.s).toBeCloseTo(nu.s, 6);
      }
    }
  });

  it('har sammenhengende fart og strekning når du slutter å løfte', () => {
    const { tHold } = tiltTimes(tre, TILT_RUN);
    const before = tiltState(tre, TILT_RUN, tHold - 1e-7);
    const after = tiltState(tre, TILT_RUN, tHold + 1e-7);
    expect(after.v).toBeCloseTo(before.v, 5);
    expect(after.s).toBeCloseTo(before.s, 6);
    // Etter stoppet: v og s som for konstant akselerasjon
    const h = tiltState(tre, TILT_RUN, tHold);
    const later = tiltState(tre, TILT_RUN, tHold + 0.5);
    expect(later.v).toBeCloseTo(h.v + h.a * 0.5, 9);
    expect(later.s).toBeCloseTo(h.s + h.v * 0.5 + 0.5 * h.a * 0.25, 9);
  });

  it('kommer i gang også når μk = μs og uten friksjon, fordi du stopper litt etter grensevinkelen', () => {
    for (const c of [
      { m: 3, muS: 0.6, muK: 0.6 },
      { m: 3, muS: 1, muK: 1 },
      { m: 3, muS: 0, muK: 0 },
    ]) {
      const { tHold } = tiltTimes(c, TILT_RUN);
      const st = tiltState(c, TILT_RUN, tHold + 1);
      expect(st.a).toBeGreaterThan(0.1);
      expect(st.v).toBeGreaterThan(0);
    }
  });

  it('bruker aldri større glidefriksjonstall enn μs', () => {
    const c = { m: 2, muS: 0.3, muK: 0.7 };
    const { tHold } = tiltTimes(c, TILT_RUN);
    const st = tiltState(c, TILT_RUN, tHold + 0.5);
    expect(st.R).toBeCloseTo(0.3 * st.N, 9);
  });

  it('massen forkortes bort: samme bevegelse for en lett og en tung kloss', () => {
    const t = 6;
    const a = tiltState({ m: 1, muS: 0.5, muK: 0.3 }, TILT_RUN, t);
    const b = tiltState({ m: 10, muS: 0.5, muK: 0.3 }, TILT_RUN, t);
    expect(a.s).toBeCloseTo(b.s, 12);
    expect(a.v).toBeCloseTo(b.v, 12);
    expect(b.R / a.R).toBeCloseTo(10, 9);
  });

  it('glir aldri hvis grensevinkelen er den største vinkelen eller ω = 0', () => {
    const steep = { omegaDeg: 6, reactionDeg: 1, alphaMaxDeg: 30 };
    const st = tiltState({ m: 2, muS: Math.tan(30 * RAD), muK: 0.3 }, steep, 100);
    expect(st.moving).toBe(false);
    expect(st.alphaDeg).toBeCloseTo(30, 12);
    expect(st.tSlip).toBe(Infinity);
    const still = tiltState(tre, { omegaDeg: 0, reactionDeg: 1, alphaMaxDeg: 60 }, 5);
    expect(still.alphaDeg).toBe(0);
    expect(still.moving).toBe(false);
    expect(still.R).toBe(0);
  });

  it('gir endelige tall for alle innstillingene på glidebryterne', () => {
    for (const m of [1, 10]) {
      for (const muS of [0, 0.05, 0.5, 1]) {
        for (const muK of [0, 0.3, 1]) {
          for (const t of [0, 3, 8, 30]) {
            const st = tiltState({ m, muS, muK }, TILT_RUN, t);
            for (const v of [st.alphaDeg, st.N, st.R, st.a, st.v, st.s]) expect(Number.isFinite(v)).toBe(true);
            expect(st.alphaDeg).toBeLessThanOrEqual(TILT_RUN.alphaMaxDeg);
            expect(st.a).toBeGreaterThanOrEqual(0);
          }
        }
      }
    }
  });
});

describe('skråplanet', () => {
  it('har plass til den største klossen, og klossen kan alltid gli et stykke', () => {
    for (const k of MATERIALS) {
      for (const m of [1, 4, 10]) {
        const { length } = blockSize(m, k);
        // Bakkanten er innenfor planken, og forkanten er over stoppeklossen før forsøket.
        expect(PLANK.start + length / 2).toBeLessThanOrEqual(PLANK.length);
        expect(PLANK.start - length / 2).toBeGreaterThan(PLANK.stop);
        expect(slideRoom(length)).toBeGreaterThan(0.2);
        // Etter glidingen ligger forkanten akkurat inntil stoppeklossen.
        expect(PLANK.start - slideRoom(length) - length / 2).toBeCloseTo(PLANK.stop, 12);
      }
    }
  });

  it('gir aldri negativ glidelengde', () => {
    expect(slideRoom(10)).toBe(0);
    expect(slideRoom(Number.NaN)).toBeCloseTo(PLANK.start - PLANK.stop, 12);
  });
});

describe('slutten på avspillingen', () => {
  it('stopper når klossen har glidd sMax', () => {
    const c = { m: 4, ...BLOCK_MATERIALS.tre };
    const tEnd = tiltEnd(c, TILT_RUN, 0.6, 30);
    expect(tEnd).toBeLessThan(30);
    expect(tiltState(c, TILT_RUN, tEnd).s).toBeCloseTo(0.6, 6);
  });

  it('stopper ved tMax når klossen aldri glir langt nok', () => {
    const steep = { omegaDeg: 6, reactionDeg: 1, alphaMaxDeg: 20 };
    expect(tiltEnd({ m: 4, ...BLOCK_MATERIALS.tre }, steep, 0.6, 12)).toBe(12);
  });

  it('er kort nok for alle klossene', () => {
    for (const k of MATERIALS) {
      const tEnd = tiltEnd({ m: 4, ...BLOCK_MATERIALS[k] }, TILT_RUN, 0.6, 30);
      expect(tEnd).toBeGreaterThan(1);
      expect(tEnd).toBeLessThan(12);
    }
  });
});
