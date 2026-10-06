import { describe, expect, it } from 'vitest';
import { collide, elasticityForLossShare } from './model';
import {
  BUMPER_SQUEEZE,
  CONTACT_PLAY_SECONDS,
  PLAY_SECONDS,
  T_AFTER,
  T_BEFORE,
  compressionFactor,
  contactAt,
  contactImpulse,
  contactTime,
  planRun,
  playDuration,
  playTimeAt,
  playback,
  rateAt,
  runAt,
  simTimeAt,
  squeezeFor,
  type Bumper,
  type RunSpec,
} from './model-sentrale-stot';

/** Alle kombinasjoner av støttyper og noen tallsett, også ytterverdiene på glidebryterne. */
const CASES: [number, number, number, number][] = [
  [1, 2, 2, 0],
  [1, 2, 1, 0],
  [2, 3, 1, 0],
  [0.5, 3, 5, -3],
  [5, 3, 0.5, -3],
  [5, -0.5, 1, -2.5],
  [1.5, 0.1, 3, 0],
  [2, 1, 1, -2],
];
const KINDS: [number, Bumper][] = [
  [1, 'fjaer'],
  [elasticityForLossShare(0.5), 'gummi'],
  [elasticityForLossShare(0.95), 'gummi'],
  [0, 'borrelaas'],
];

describe('selve støtet', () => {
  it('impulsen gir de samme sluttfartene som collide', () => {
    for (const [m1, v1, m2, v2] of CASES)
      for (const [e] of KINDS) {
        const J = contactImpulse(m1, v1, m2, v2, e);
        const r = collide(m1, v1, m2, v2, e);
        expect(v1 - J / m1).toBeCloseTo(r.u1, 12);
        expect(v2 + J / m2).toBeCloseTo(r.u2, 12);
        const end = contactAt(m1, v1, m2, v2, e, 0.05, 0.05);
        expect(end.v1).toBeCloseTo(r.u1, 12);
        expect(end.v2).toBeCloseTo(r.u2, 12);
      }
  });

  it('Σp er bevart i hvert øyeblikk, også midt i støtet', () => {
    for (const [m1, v1, m2, v2] of CASES)
      for (const [e] of KINDS) {
        const p0 = m1 * v1 + m2 * v2;
        for (let i = -5; i <= 25; i++) {
          const s = contactAt(m1, v1, m2, v2, e, 0.04, i * 0.002);
          expect(m1 * s.v1 + m2 * s.v2).toBeCloseTo(p0, 10);
        }
      }
  });

  it('kraftparet: impulsen er arealet under F-t-grafen, og farten endres som impulsloven sier', () => {
    const [m1, v1, m2, v2, e, tau] = [1, 2, 2, 0, 1, 0.05];
    const J = contactImpulse(m1, v1, m2, v2, e);
    // J = μ(1 + e)(v₁ − v₂) = 2/3 · 2 · 2
    expect(J).toBeCloseTo(8 / 3, 12);
    const n = 2000;
    let area = 0;
    for (let i = 0; i < n; i++) area += contactAt(m1, v1, m2, v2, e, tau, ((i + 0.5) * tau) / n).F * (tau / n);
    expect(area).toBeCloseTo(J, 6);
    const mid = contactAt(m1, v1, m2, v2, e, tau, tau / 2);
    expect(mid.F).toBeCloseTo((Math.PI / 2) * (J / tau), 9);
    expect(mid.I).toBeCloseTo(J / 2, 12);
    expect(m1 * (v1 - mid.v1)).toBeCloseTo(mid.I, 12);
    expect(m2 * (mid.v2 - v2)).toBeCloseTo(mid.I, 12);
    // Ingen kraft før og etter støtet
    expect(contactAt(m1, v1, m2, v2, e, tau, -0.01).F).toBe(0);
    expect(contactAt(m1, v1, m2, v2, e, tau, tau + 0.01).F).toBe(0);
  });

  it('posisjonen henger sammen med farten (ingen hopp ved start og slutt av støtet)', () => {
    for (const [e] of KINDS) {
      const [m1, v1, m2, v2, tau] = [0.5, 3, 5, -3, 0.03];
      const n = 600;
      const dt = (2 * tau) / n;
      let prev = contactAt(m1, v1, m2, v2, e, tau, -tau / 2);
      for (let i = 1; i <= n; i++) {
        const s = contactAt(m1, v1, m2, v2, e, tau, -tau / 2 + i * dt);
        // Trapesmetoden: Δs ≈ (v_forrige + v)/2 · Δt
        expect(s.s1 - prev.s1).toBeCloseTo(((s.v1 + prev.v1) / 2) * dt, 6);
        expect(s.s2 - prev.s2).toBeCloseTo(((s.v2 + prev.v2) / 2) * dt, 6);
        prev = s;
      }
    }
  });

  it('største sammentrykk: 1/π · (v₁ − v₂)τ for elastisk og ½ · (v₁ − v₂)τ for fullstendig uelastisk', () => {
    expect(compressionFactor(1)).toBeCloseTo(1 / Math.PI, 12);
    expect(compressionFactor(0)).toBeCloseTo(0.5, 12);
    for (const [e] of KINDS) {
      const [m1, v1, m2, v2, tau] = [1, 2, 2, -1, 0.04];
      let max = 0;
      for (let i = 0; i <= 4000; i++) {
        const s = contactAt(m1, v1, m2, v2, e, tau, (i * tau) / 4000);
        max = Math.max(max, s.s1 - s.s2);
      }
      expect(max).toBeCloseTo(compressionFactor(e) * (v1 - v2) * tau, 6);
    }
    // Elastisk: støtfangerne er tilbake i full lengde når støtet er over. Fullstendig uelastisk: de blir værende inntil hverandre.
    const el = contactAt(1, 2, 2, 0, 1, 0.04, 0.04);
    expect(el.s1 - el.s2).toBeCloseTo(0, 12);
    const stuck = contactAt(1, 2, 2, 0, 0, 0.04, 0.5);
    expect(stuck.v1).toBeCloseTo(stuck.v2, 12);
    expect(stuck.s1 - stuck.s2).toBeCloseTo(0.5 * 2 * 0.04, 12);
  });

  it('elastisk: den kinetiske energien er lavest midt i støtet (lagret i fjærene) og like stor etterpå', () => {
    const [m1, v1, m2, v2, tau] = [1, 2, 2, 0, 0.04];
    const ek = (s: { v1: number; v2: number }) => 0.5 * m1 * s.v1 ** 2 + 0.5 * m2 * s.v2 ** 2;
    const before = ek({ v1, v2 });
    const mid = ek(contactAt(m1, v1, m2, v2, 1, tau, tau / 2));
    // Midt i støtet har vognene samme fart, og E_k er bare energien til tyngdepunktsbevegelsen: p²/(2M)
    expect(mid).toBeCloseTo(2 ** 2 / (2 * 3), 12);
    expect(mid).toBeLessThan(before);
    expect(ek(contactAt(m1, v1, m2, v2, 1, tau, tau))).toBeCloseTo(before, 12);
  });

  it('støttiden gir det ønskede sammentrykket, og sammentrykket er mindre i rolige støt', () => {
    for (const [e, b] of KINDS) {
      const squeeze = squeezeFor(b, 2);
      expect(squeeze).toBeCloseTo(BUMPER_SQUEEZE[b], 12);
      const tau = contactTime(2, e, squeeze);
      expect(compressionFactor(e) * 2 * tau).toBeCloseTo(squeeze, 12);
    }
    expect(squeezeFor('fjaer', 0.1)).toBeCloseTo(0.3 * BUMPER_SQUEEZE.fjaer, 12);
    expect(squeezeFor('fjaer', 6)).toBeCloseTo(BUMPER_SQUEEZE.fjaer, 12);
    // Realistiske støttider for labvogner: noen hundredels sekunder
    const tau = contactTime(2, 1, squeezeFor('fjaer', 2));
    expect(tau).toBeGreaterThan(0.02);
    expect(tau).toBeLessThan(0.1);
    expect(contactTime(0, 1, 0.03)).toBe(0);
  });

  it('ingen støt: ingen impuls, vognene går med jevn fart', () => {
    expect(contactImpulse(1, 1, 1, 2, 1)).toBe(0);
    expect(contactAt(1, 1, 1, 2, 1, 0.04, 0.5)).toEqual({ s1: 0.5, s2: 1, v1: 1, v2: 2, F: 0, I: 0 });
  });
});

describe('forsøket på banen', () => {
  const spec = (m1: number, v1: number, m2: number, v2: number, e: number, bumper: Bumper, length = 1.4): RunSpec => ({
    m1,
    v1,
    m2,
    v2,
    e,
    bumper,
    length,
    w1: 0.232,
    w2: 0.232,
    margin: 0.03,
  });

  it('vognene holder seg på banebiten hele tiden, for alle tallsett og støttyper', () => {
    for (const length of [1.4, 0.8])
      for (const [m1, v1, m2, v2] of [...CASES, [1, 1, 1, 2] as [number, number, number, number], [3, 0, 2, 0] as [number, number, number, number]])
        for (const [e, b] of KINDS) {
          const sp = spec(m1, v1, m2, v2, e, b, length);
          const run = planRun(sp);
          expect(run.lambda).toBeGreaterThan(0.01);
          expect(run.lambda).toBeLessThanOrEqual(1);
          for (let i = 0; i <= 400; i++) {
            const st = runAt(sp, run, (i * run.tEnd) / 400);
            expect(st.tip1 - sp.w1).toBeGreaterThanOrEqual(sp.margin - 1e-9);
            expect(st.tip2 + sp.w2).toBeLessThanOrEqual(length - sp.margin + 1e-9);
            // Vognene går aldri gjennom hverandre: overlappet er høyst det støtfangerne kan presses inn.
            expect(st.squeeze).toBeLessThanOrEqual(BUMPER_SQUEEZE[b] + 1e-9);
            expect(Number.isFinite(st.tip1) && Number.isFinite(st.tip2)).toBe(true);
          }
        }
  });

  it('standardforsøket: 1,0 kg med 2,0 m/s mot 2,0 kg i ro, elastisk', () => {
    const sp = spec(1, 2, 2, 0, 1, 'fjaer');
    const run = planRun(sp);
    expect(run.collides).toBe(true);
    // Banen er for kort til 1,5 s før støtet i 2,0 m/s, så tidene kortes ned
    expect(run.lambda).toBeLessThan(1);
    expect(run.tHit).toBeCloseTo(T_BEFORE * run.lambda, 12);
    expect(run.tEnd).toBeCloseTo(run.tHit + run.tau + T_AFTER * run.lambda, 12);
    // Tuppene møtes akkurat ved tHit
    const hit = runAt(sp, run, run.tHit);
    expect(hit.tip1).toBeCloseTo(hit.tip2, 12);
    expect(hit.phase).toBe('under');
    expect(runAt(sp, run, 0).phase).toBe('for');
    expect(runAt(sp, run, run.tEnd).phase).toBe('etter');
    // Før støtet er det luke mellom vognene
    expect(runAt(sp, run, 0).tip2 - runAt(sp, run, 0).tip1).toBeGreaterThan(0.2);
    const end = runAt(sp, run, run.tEnd);
    expect(end.v1).toBeCloseTo(-2 / 3, 12);
    expect(end.v2).toBeCloseTo(4 / 3, 12);
  });

  it('langsomme vogner får hele tiden (λ = 1)', () => {
    const run = planRun(spec(1, 0.2, 1, 0, 1, 'fjaer'));
    expect(run.lambda).toBe(1);
    expect(run.tHit).toBe(T_BEFORE);
  });

  it('ingen støt: luka mellom vognene vokser, og forsøket varer T_BEFORE + T_AFTER når det er plass', () => {
    const sp = spec(1, -0.05, 1, 0.05, 1, 'fjaer');
    const run = planRun(sp);
    expect(run.collides).toBe(false);
    expect(run.tEnd).toBeCloseTo(T_BEFORE + T_AFTER, 12);
    const a = runAt(sp, run, 0);
    const b = runAt(sp, run, run.tEnd);
    expect(b.tip2 - b.tip1).toBeGreaterThan(a.tip2 - a.tip1);
    expect(a.phase).toBe('ingen');
  });
});

describe('avspilling', () => {
  it('før og etter støtet går klokka like fort, og hele forsøket tar ca. PLAY_SECONDS', () => {
    const sp: RunSpec = { m1: 1, v1: 2, m2: 2, v2: 0, e: 1, bumper: 'fjaer', length: 1.4, w1: 0.232, w2: 0.232, margin: 0.03 };
    const run = planRun(sp);
    const p = playback(run);
    expect(p.rate).toBeCloseTo((run.tEnd - run.tau) / PLAY_SECONDS, 12);
    expect(rateAt(p, 0)).toBe(p.rate);
    expect(rateAt(p, run.tEnd - 0.001)).toBe(p.rate);
    // Rundt støtet: saktere, og hele støttiden er inne i det langsomme tidsrommet
    expect(rateAt(p, run.tHit + run.tau / 2)).toBe(p.contactRate);
    expect(p.contactRate).toBeLessThan(p.rate);
    expect(p.slowFrom).toBeLessThan(run.tHit);
    expect(p.slowTo).toBeGreaterThan(run.tHit + run.tau);
    // To bilder på høyst 0,05 s ekte tid kan ikke hoppe over starten av støtet
    expect(run.tHit - p.slowFrom).toBeGreaterThanOrEqual(0.1 * p.rate - 1e-12);
  });

  it('ekte avspillingstid og simulert tid passer sammen, uten hopp, også i sakte film rundt støtet', () => {
    const specs: RunSpec[] = [
      { m1: 1, v1: 2, m2: 2, v2: 0, e: 1, bumper: 'fjaer', length: 1.2, w1: 0.232, w2: 0.232, margin: 0.03 },
      { m1: 5, v1: 3, m2: 0.5, v2: -3, e: 0, bumper: 'borrelaas', length: 0.8, w1: 0.21, w2: 0.21, margin: 0.03 },
      { m1: 1, v1: 0.1, m2: 1, v2: 0, e: 0.7, bumper: 'gummi', length: 1.2, w1: 0.213, w2: 0.213, margin: 0.03 },
      { m1: 1, v1: -1, m2: 1, v2: 1, e: 1, bumper: 'fjaer', length: 1.2, w1: 0.232, w2: 0.232, margin: 0.03 },
    ];
    for (const sp of specs) {
      const run = planRun(sp);
      const p = playback(run);
      const D = playDuration(p, run);
      expect(D).toBeGreaterThan(0);
      expect(simTimeAt(p, run, 0)).toBe(0);
      expect(simTimeAt(p, run, D)).toBeCloseTo(run.tEnd, 12);
      expect(simTimeAt(p, run, D + 5)).toBeCloseTo(run.tEnd, 12);
      let prev = 0;
      const n = 2000;
      for (let i = 1; i <= n; i++) {
        const real = (i / n) * D;
        const t = simTimeAt(p, run, real);
        // Stigende, og aldri raskere enn avspillingsfarten der vi er (ingen hopp)
        expect(t).toBeGreaterThanOrEqual(prev);
        expect(t - prev).toBeLessThanOrEqual((D / n) * p.rate + 1e-12);
        expect(playTimeAt(p, run, t)).toBeCloseTo(real, 9);
        prev = t;
      }
    }
  });

  it('sakte film: støttiden tar ca. CONTACT_PLAY_SECONDS av avspillingen, resten ca. PLAY_SECONDS', () => {
    const sp: RunSpec = { m1: 1, v1: 2, m2: 2, v2: 0, e: 1, bumper: 'fjaer', length: 1.2, w1: 0.232, w2: 0.232, margin: 0.03 };
    const run = planRun(sp);
    const p = playback(run);
    const slow = playTimeAt(p, run, p.slowTo) - playTimeAt(p, run, p.slowFrom);
    expect(slow).toBeCloseTo(CONTACT_PLAY_SECONDS, 9);
    expect(playDuration(p, run) - slow).toBeLessThanOrEqual(PLAY_SECONDS + 1e-9);
    // Rundt støtet går klokka saktere enn (eller like sakte som) før og etter
    expect(p.contactRate).toBeLessThanOrEqual(p.rate);
    expect(rateAt(p, run.tHit + run.tau / 2)).toBe(p.contactRate);
  });

  it('aldri fortere enn sanntid', () => {
    const run = planRun({ m1: 1, v1: 0.1, m2: 1, v2: 0, e: 1, bumper: 'fjaer', length: 1.4, w1: 0.232, w2: 0.232, margin: 0.03 });
    const p = playback(run);
    expect(p.rate).toBe(1);
    expect(p.contactRate).toBeLessThanOrEqual(1);
  });
});
