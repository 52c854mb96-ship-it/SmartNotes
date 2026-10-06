import { describe, expect, it } from 'vitest';
import {
  AIR_K,
  BALANCE_SPEED,
  GRADE_MAX,
  GRADE_MIN,
  GRADE_STEP,
  HEIGHT_STEPS,
  HILLS,
  MASS_MAX,
  MASS_MIN,
  POWER_MAX,
  POWER_MIN,
  ROLLING_COEFF,
  alongForces,
  climb,
  climbAt,
  clockText,
  durationParts,
  durationText,
  forceScale,
  matchHill,
  nearestIndex,
  pedalRate,
  roadLength,
  scaleBarForce,
  sceneryFor,
  slopeAngle,
  slopeDegrees,
  speedCurve,
  steadySpeed,
  type ClimbInput,
} from './model-sykkel-bakke';

const g = 9.81;
const close = (a: number, b: number, rel = 1e-9) => expect(Math.abs(a - b)).toBeLessThanOrEqual(rel * Math.max(1, Math.abs(b)));

const base: ClimbInput = { m: 75, P: 200, grade: 8, h: 400, air: false };

describe('stigning og vinkel', () => {
  it('stigning i prosent er meter opp per 100 m bortover: θ = arctan(p/100)', () => {
    close(slopeAngle(100), Math.PI / 4);
    close(slopeDegrees(8), 4.573921, 1e-6);
    close(slopeDegrees(10), 5.710593, 1e-6);
    close(Math.tan(slopeAngle(7.5)), 0.075);
  });

  it('veien er s = h / sin θ og alltid litt lengre enn den vannrette avstanden', () => {
    close(roadLength(8, 8), Math.hypot(100, 8));
    const s = roadLength(400, 8);
    expect(s).toBeGreaterThan(400 / 0.08);
    close(s, 5000 * Math.sqrt(1 + 0.08 ** 2));
    close(s, 5015.974, 1e-6);
  });
});

describe('kreftene langs veien', () => {
  it('regner ut et kjent eksempel for hånd (8 %, 75 kg)', () => {
    const f = alongForces(75, 8, 3, false);
    close(f.G, 735.75);
    close(f.Gpar, 735.75 * Math.sin(Math.atan(0.08)));
    close(f.Gpar, 58.6731, 1e-5);
    close(f.N, 733.4069, 1e-5);
    close(f.R, 0.006 * f.N);
    expect(f.L).toBe(0);
    close(f.F, f.Gpar + f.R);
  });

  it('G∥ og N er komponentene av G: G∥² + N² = G²', () => {
    for (const grade of [1, 5, 12.5, 20]) {
      const f = alongForces(80, grade, 4, true);
      close(f.Gpar ** 2 + f.N ** 2, f.G ** 2);
      close(f.L, AIR_K * 16);
      close(f.F, f.Gpar + f.R + f.L);
    }
  });

  it('dobbel stigning gir nesten dobbel G∥ i slake bakker', () => {
    const a = alongForces(75, 5, 0, false).Gpar;
    const b = alongForces(75, 10, 0, false).Gpar;
    expect(b / a).toBeGreaterThan(1.98);
    expect(b / a).toBeLessThan(2);
  });
});

describe('farten fra P = F · v', () => {
  it('uten luftmotstand er v = P / (G∥ + R)', () => {
    const v = steadySpeed(75, 200, 8, false);
    const f = alongForces(75, 8, v, false);
    close(v, 200 / f.F);
    close(v, 3.17091, 1e-5);
    close(f.F * v, 200);
  });

  it('med luftmotstand stemmer P = (G∥ + R + k v²) · v, og farten blir lavere', () => {
    for (const grade of [GRADE_MIN, 3, 8, GRADE_MAX]) {
      for (const P of [POWER_MIN, 200, POWER_MAX]) {
        for (const m of [MASS_MIN, 75, MASS_MAX]) {
          const v = steadySpeed(m, P, grade, true);
          const f = alongForces(m, grade, v, true);
          close(f.F * v, P, 1e-9);
          expect(v).toBeLessThan(steadySpeed(m, P, grade, false));
          expect(v).toBeGreaterThan(0);
        }
      }
    }
  });

  it('flat vei med luftmotstand gir vanlig sykkelfart (ca. 25–30 km/h på 200 W)', () => {
    const kmh = steadySpeed(75, 200, 1, true) * 3.6;
    expect(kmh).toBeGreaterThan(25);
    expect(kmh).toBeLessThan(30);
  });

  it('uten luftmotstand blir farten urealistisk høy i slake bakker', () => {
    expect(steadySpeed(75, 200, 1, false) * 3.6).toBeGreaterThan(50);
  });

  it('farten går ned med stigningen og massen og opp med effekten', () => {
    for (const air of [false, true]) {
      expect(steadySpeed(75, 200, 10, air)).toBeLessThan(steadySpeed(75, 200, 5, air));
      expect(steadySpeed(90, 200, 8, air)).toBeLessThan(steadySpeed(70, 200, 8, air));
      expect(steadySpeed(75, 300, 8, air)).toBeGreaterThan(steadySpeed(75, 200, 8, air));
    }
  });

  it('i en bratt bakke er farten nesten proporsjonal med effekten (luftmotstanden betyr lite)', () => {
    const r = steadySpeed(75, 300, 12, true) / steadySpeed(75, 150, 12, true);
    expect(r).toBeGreaterThan(1.95);
    expect(r).toBeLessThanOrEqual(2);
  });

  it('effekt 0 gir fart 0', () => {
    expect(steadySpeed(75, 0, 8, true)).toBe(0);
    expect(steadySpeed(75, 0, 8, false)).toBe(0);
  });
});

describe('turen opp bakken', () => {
  it('arbeidet er W = F · s = P · t = mgh + (R + L) · s', () => {
    for (const air of [false, true]) {
      const c = climb({ ...base, air });
      close(c.W, c.input.P * c.t);
      close(c.W, c.F * c.s);
      close(c.Wg, 75 * g * 400);
      close(c.W, c.Wg + c.Wr + c.Wl);
      close(c.t, c.s / c.v);
      if (!air) expect(c.Wl).toBe(0);
    }
  });

  it('kjent eksempel: 75 kg, 200 W, 8 %, 400 m uten luftmotstand', () => {
    const c = climb(base);
    close(c.s, 5015.974, 1e-6);
    close(c.v, 3.17091, 1e-5);
    close(c.t, 1581.87, 1e-5);
    close(c.W, 316374, 1e-5);
    // mgh = 294 300 J er det meste, rullefriksjonen tar resten
    expect(c.Wg / c.W).toBeGreaterThan(0.92);
  });

  it('tida er minst mgh / P, og klatrefarten v · sin θ er høyst P / mg', () => {
    for (const grade of [GRADE_MIN, 4, 8, GRADE_MAX]) {
      for (const air of [false, true]) {
        const c = climb({ ...base, grade, air });
        expect(c.t).toBeGreaterThan((75 * g * 400) / 200);
        expect(c.vVert).toBeLessThan(200 / (75 * g));
        close(c.vam, c.vVert * 3600);
      }
    }
  });

  it('slakere vei til samme høyde: mindre kraft, høyere fart, samme mgh, men litt lengre tid', () => {
    const steep = climb({ ...base, grade: 10 });
    const gentle = climb({ ...base, grade: 5 });
    expect(gentle.F).toBeLessThan(steep.F);
    expect(gentle.v).toBeGreaterThan(steep.v);
    close(gentle.Wg, steep.Wg);
    expect(gentle.W).toBeGreaterThan(steep.W);
    expect(gentle.t).toBeGreaterThan(steep.t);
    // Uten luftmotstand er forskjellen i tid liten (bare rullefriksjonen på den lengre veien)
    expect(gentle.t / steep.t).toBeLessThan(1.1);
    // Med luftmotstand blir den slake veien tydelig tregere
    const steepAir = climb({ ...base, grade: 10, air: true });
    const gentleAir = climb({ ...base, grade: 5, air: true });
    expect(gentleAir.t - steepAir.t).toBeGreaterThan(gentle.t - steep.t);
  });

  it('i en bratt bakke går nesten alt arbeidet til potensiell energi', () => {
    const c = climb({ ...base, grade: GRADE_MAX, air: true });
    expect(c.Wg / c.W).toBeGreaterThan(0.95);
    const flat = climb({ ...base, grade: GRADE_MIN, air: true });
    expect(flat.Wg / flat.W).toBeLessThan(0.5);
  });

  it('effekten per kilo og energien fra maten', () => {
    const c = climb(base);
    close(c.wPerKg, 200 / 75);
    close(c.body, 4 * c.W);
    close(c.slices, c.body / 700e3);
  });

  it('tida er proporsjonal med høyden når resten er likt', () => {
    const a = climb({ ...base, h: 100, air: true });
    const b = climb({ ...base, h: 300, air: true });
    close(b.t, 3 * a.t);
    close(b.W, 3 * a.W);
  });

  it('alle hjørner av glidebryterne gir endelige, positive tall', () => {
    const hs = [HEIGHT_STEPS[0]!, HEIGHT_STEPS[HEIGHT_STEPS.length - 1]!];
    for (const m of [MASS_MIN, MASS_MAX])
      for (const P of [POWER_MIN, POWER_MAX])
        for (const grade of [GRADE_MIN, GRADE_MAX])
          for (const h of hs)
            for (const air of [false, true]) {
              const c = climb({ m, P, grade, h, air });
              for (const v of [c.v, c.s, c.t, c.W, c.F, c.Gpar, c.R, c.vam]) {
                expect(Number.isFinite(v)).toBe(true);
                expect(v).toBeGreaterThan(0);
              }
            }
  });

  it('det tyngste og svakeste tilfellet er så sakte at det er vanskelig å holde balansen', () => {
    const c = climb({ m: MASS_MAX, P: POWER_MIN, grade: GRADE_MAX, h: 100, air: true });
    expect(c.v).toBeLessThan(BALANCE_SPEED);
    expect(c.kmh).toBeGreaterThan(0.5);
  });
});

describe('framdriften under avspillingen', () => {
  it('går jevnt fra bunnen til toppen og stopper der', () => {
    const c = climb(base);
    const mid = climbAt(c, c.t / 2);
    close(mid.frac, 0.5);
    close(mid.s, c.s / 2);
    close(mid.height, 200);
    close(mid.W, c.W / 2);
    // arbeidet så langt er P · τ
    close(climbAt(c, 100).W, 200 * 100);
    expect(climbAt(c, -5).frac).toBe(0);
    expect(climbAt(c, c.t * 3).frac).toBe(1);
    close(climbAt(c, c.t * 3).height, 400);
  });
});

describe('pedalene i animasjonen', () => {
  it('går med ca. 80 omdreininger i minuttet, men saktere når farten er for lav for laveste gir', () => {
    expect(pedalRate(3)).toBeCloseTo(80 / 60, 9);
    expect(pedalRate(0.5)).toBeCloseTo(0.5 / 1.6, 9);
    expect(pedalRate(30)).toBeCloseTo(30 / 9, 9);
    expect(pedalRate(0)).toBe(0);
  });
});

describe('grafen', () => {
  it('går fra minste til største stigning og faller hele veien', () => {
    const pts = speedCurve(75, 200, true);
    expect(pts[0]![0]).toBe(GRADE_MIN);
    expect(pts[pts.length - 1]![0]).toBeCloseTo(GRADE_MAX, 9);
    for (let i = 1; i < pts.length; i++) expect(pts[i]![1]).toBeLessThan(pts[i - 1]![1]);
  });
});

describe('kjente bakker', () => {
  it('ligger på stegene i glidebryterne og kjennes igjen', () => {
    for (const b of HILLS) {
      expect(b.grade).toBeGreaterThanOrEqual(GRADE_MIN);
      expect(b.grade).toBeLessThanOrEqual(GRADE_MAX);
      expect(Math.abs((b.grade - GRADE_MIN) / GRADE_STEP - Math.round((b.grade - GRADE_MIN) / GRADE_STEP))).toBeLessThan(1e-9);
      expect(HEIGHT_STEPS).toContain(b.h);
      expect(matchHill(b.grade, b.h)).toBe(b.id);
    }
    expect(matchHill(8, 400)).toBeNull();
  });

  it('har riktig lengde: Trollstigen ca. 11 km, Alpe d’Huez ca. 13,8 km, skolebakken ca. 300 m', () => {
    const len = (id: string) => {
      const b = HILLS.find((x) => x.id === id)!;
      return roadLength(b.h, b.grade);
    };
    expect(len('trollstigen')).toBeGreaterThan(10500);
    expect(len('trollstigen')).toBeLessThan(11500);
    expect(len('alpe')).toBeGreaterThan(13500);
    expect(len('alpe')).toBeLessThan(14100);
    expect(len('skole')).toBeGreaterThan(290);
    expect(len('skole')).toBeLessThan(310);
  });

  it('en proff på 65 kg med 380 W kommer opp Alpe d’Huez på rundt 37–40 minutter', () => {
    const c = climb({ m: 65, P: 380, grade: 8, h: 1100, air: true });
    expect(c.t / 60).toBeGreaterThan(35);
    expect(c.t / 60).toBeLessThan(41);
  });

  it('en vanlig syklist (75 kg, 200 W) bruker omtrent en time opp Trollstigen', () => {
    const c = climb({ m: 75, P: 200, grade: 7.5, h: 850, air: true });
    expect(c.t / 60).toBeGreaterThan(50);
    expect(c.t / 60).toBeLessThan(65);
    expect(c.kmh).toBeGreaterThan(10);
    expect(c.kmh).toBeLessThan(14);
  });

  it('bakgrunnen følger høyden', () => {
    expect(sceneryFor(30)).toBe('by');
    expect(sceneryFor(150)).toBe('aaser');
    expect(sceneryFor(850)).toBe('fjell');
  });
});

describe('glidebryteren for høyden', () => {
  it('er stigende uten like verdier, fra 10 m til 1 200 m', () => {
    expect(HEIGHT_STEPS[0]).toBe(10);
    expect(HEIGHT_STEPS[HEIGHT_STEPS.length - 1]).toBe(1200);
    for (let i = 1; i < HEIGHT_STEPS.length; i++) expect(HEIGHT_STEPS[i]!).toBeGreaterThan(HEIGHT_STEPS[i - 1]!);
    expect(HEIGHT_STEPS[nearestIndex(HEIGHT_STEPS, 849)]).toBe(850);
    expect(HEIGHT_STEPS[nearestIndex(HEIGHT_STEPS, 31)]).toBe(30);
  });
});

describe('tekst og skalaer', () => {
  it('skriver tida som sekunder, minutter og timer', () => {
    expect(durationText(42.2)).toBe('42 s');
    expect(durationText(59.4)).toBe('59 s');
    expect(durationText(59.6)).toBe('1 min 0 s');
    expect(durationText(192)).toBe('3 min 12 s');
    expect(durationText(3485)).toBe('58 min');
    expect(durationText(3590)).toBe('1 t');
    expect(durationParts(3590)).toEqual({ value: '1', unit: 't' });
    expect(durationText(4330)).toBe('1 t 12 min');
    expect(durationText(Number.NaN)).toBe('–');
    expect(durationParts(4330)).toEqual({ value: '1 t 12', unit: 'min' });
    expect(durationParts(192)).toEqual({ value: '3 min 12', unit: 's' });
    expect(durationParts(3485)).toEqual({ value: '58', unit: 'min' });
    expect(clockText(42.9)).toBe('42 s');
    expect(clockText(1471.4)).toBe('24 min 31 s');
    expect(clockText(605)).toBe('10 min 05 s');
    expect(clockText(3725)).toBe('1 t 02 min');
  });

  it('velger en pen kraftskala som gir lange nok piler', () => {
    for (const F of [6, 12, 40, 63, 150, 260]) {
      const k = forceScale(F, 190);
      expect(F * k).toBeLessThanOrEqual(190);
      expect(F * k).toBeGreaterThan(190 * 0.6);
    }
    const bar = scaleBarForce(3, 70);
    expect(bar).toBe(20);
    expect(scaleBarForce(0.5, 70)).toBe(100);
  });

  it('rullefriksjonstallet og luftmotstandstallet er rimelige for en sykkel', () => {
    expect(ROLLING_COEFF).toBeGreaterThan(0.003);
    expect(ROLLING_COEFF).toBeLessThan(0.012);
    expect(AIR_K).toBeGreaterThan(0.15);
    expect(AIR_K).toBeLessThan(0.4);
  });
});
