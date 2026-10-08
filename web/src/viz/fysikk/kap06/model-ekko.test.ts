import { describe, expect, it } from 'vitest';
import {
  C_LYS,
  LYDFART,
  SLIDERS,
  STOFF,
  V_LUFT,
  V_VANN,
  echoDepth,
  echoPulse,
  echoTime,
  exactLightningDistance,
  flashStrength,
  frequencyHz,
  lightTime,
  lightningDistance,
  playback,
  ruleOfThumbKm,
  rumbleDelay,
  stripLength,
  wavelength,
  type Situasjon,
} from './model-ekko';

/** Alle verdiene en glidebryter kan stå på. */
function values(s: { min: number; max: number; step: number }): number[] {
  const n = Math.round((s.max - s.min) / s.step);
  return Array.from({ length: n + 1 }, (_, i) => s.min + i * s.step);
}

describe('konstanter', () => {
  it('bruker verdiene i læreboka', () => {
    expect(V_LUFT).toBe(340);
    expect(V_VANN).toBe(1500);
    expect(C_LYS).toBe(3.0e8);
    expect(LYDFART[STOFF.torden]).toBe(340);
    expect(LYDFART[STOFF.ekkolodd]).toBe(1500);
  });

  it('startverdiene ligger på glidebryterne', () => {
    for (const sit of ['torden', 'ekkolodd'] as Situasjon[]) {
      for (const key of ['t', 'f'] as const) {
        const s = SLIDERS[sit][key];
        expect(s.start).toBeGreaterThanOrEqual(s.min);
        expect(s.start).toBeLessThanOrEqual(s.max);
        const k = (s.start - s.min) / s.step;
        expect(Math.abs(k - Math.round(k))).toBeLessThan(1e-9);
      }
    }
  });
});

describe('lyn og torden', () => {
  it('d = v · t med kjente verdier', () => {
    expect(lightningDistance(6)).toBeCloseTo(2040, 9);
    expect(lightningDistance(3)).toBeCloseTo(1020, 9);
    expect(lightningDistance(0)).toBe(0);
    expect(lightningDistance(10, 343)).toBeCloseTo(3430, 9);
  });

  it('lyset bruker bare mikrosekunder', () => {
    expect(lightTime(3000)).toBeCloseTo(1e-5, 15);
    expect(lightTime(lightningDistance(6))).toBeCloseTo(6.8e-6, 12);
    // Over hele glidebryteren er lystiden under 40 μs, altså helt umerkelig
    for (const t of values(SLIDERS.torden.t)) expect(lightTime(lightningDistance(t))).toBeLessThan(4e-5);
  });

  it('å ta med lystiden endrer avstanden med under en milliondel', () => {
    for (const t of values(SLIDERS.torden.t)) {
      const exact = exactLightningDistance(t);
      const approx = lightningDistance(t);
      expect(exact).toBeGreaterThan(approx);
      expect((exact - approx) / approx).toBeLessThan(1.2e-6);
      // Den eksakte avstanden gir tilbake målt tid: d/v − d/c = t
      expect(exact / V_LUFT - exact / C_LYS).toBeCloseTo(t, 9);
    }
  });

  it('tommelfingerregelen «sekunder delt på 3» gir km med ca. 2 % feil', () => {
    expect(ruleOfThumbKm(3)).toBe(1);
    expect(ruleOfThumbKm(6)).toBe(2);
    for (const t of values(SLIDERS.torden.t)) {
      const exactKm = lightningDistance(t) / 1000;
      expect(Math.abs(ruleOfThumbKm(t) - exactKm) / exactKm).toBeCloseTo(1 - 1 / 1.02, 9);
    }
  });

  it('avstandene på glidebryteren går fra 680 m til 10,2 km', () => {
    expect(lightningDistance(SLIDERS.torden.t.min)).toBeCloseTo(680, 9);
    expect(lightningDistance(SLIDERS.torden.t.max)).toBeCloseTo(10200, 9);
  });

  it('tordenen ruller: lyden fra høyere opp kommer senere', () => {
    // d = 2040 m, h = 3000 m: √(2040² + 3000²) = 3627,8 m, (3627,8 − 2040) / 340 = 4,67 s
    expect(rumbleDelay(2040)).toBeCloseTo((Math.hypot(2040, 3000) - 2040) / 340, 9);
    expect(rumbleDelay(2040)).toBeCloseTo(4.67, 2);
    expect(rumbleDelay(1000, 0)).toBe(0);
    // Rett under lynet kommer toppen h / v senere; langt unna nesten samtidig
    expect(rumbleDelay(0)).toBeCloseTo(3000 / 340, 9);
    let prev = Infinity;
    for (const t of values(SLIDERS.torden.t)) {
      const r = rumbleDelay(lightningDistance(t));
      expect(r).toBeGreaterThan(0);
      expect(r).toBeLessThan(prev);
      prev = r;
    }
  });
});

describe('ekkolodd', () => {
  it('d = v · t / 2 med kjente verdier', () => {
    expect(echoDepth(0.12)).toBeCloseTo(90, 9);
    expect(echoDepth(0.2)).toBeCloseTo(150, 9);
    expect(echoDepth(1)).toBeCloseTo(750, 9);
    expect(echoDepth(0)).toBe(0);
  });

  it('tid og dybde er omvendte funksjoner', () => {
    for (const t of values(SLIDERS.ekkolodd.t)) {
      expect(echoTime(echoDepth(t))).toBeCloseTo(t, 12);
    }
    expect(echoTime(90)).toBeCloseTo(0.12, 12);
  });

  it('dybdene på glidebryteren går fra 22,5 m til 240 m', () => {
    expect(echoDepth(SLIDERS.ekkolodd.t.min)).toBeCloseTo(22.5, 9);
    expect(echoDepth(SLIDERS.ekkolodd.t.max)).toBeCloseTo(240, 9);
  });

  it('å glemme å dele på 2 gir dobbelt så stor dybde', () => {
    const t = 0.12;
    expect(V_VANN * t).toBeCloseTo(2 * echoDepth(t), 9);
  });

  it('lydpulsen går ned til bunnen og opp igjen', () => {
    const d = 90;
    const T = echoTime(d);
    expect(echoPulse(0, d)).toEqual({ phase: 'ned', depth: 0, travelled: 0 });
    const q = echoPulse(T / 4, d);
    expect(q.phase).toBe('ned');
    expect(q.depth).toBeCloseTo(45, 9);
    expect(echoPulse(T / 2, d).depth).toBeCloseTo(90, 9);
    const u = echoPulse((3 * T) / 4, d);
    expect(u.phase).toBe('opp');
    expect(u.depth).toBeCloseTo(45, 9);
    expect(u.travelled).toBeCloseTo(135, 9);
    expect(echoPulse(T, d)).toEqual({ phase: 'tilbake', depth: 0, travelled: 180 });
    expect(echoPulse(2 * T, d).phase).toBe('tilbake');
    expect(echoPulse(-1, d).depth).toBe(0);
  });

  it('pulsen går hele tiden med lydfarten og aldri under bunnen', () => {
    for (const t of values(SLIDERS.ekkolodd.t)) {
      const d = echoDepth(t);
      for (let i = 0; i <= 40; i++) {
        const tau = (i / 40) * t;
        const p = echoPulse(tau, d);
        expect(p.depth).toBeGreaterThanOrEqual(0);
        expect(p.depth).toBeLessThanOrEqual(d + 1e-9);
        expect(p.travelled).toBeCloseTo(Math.min(V_VANN * tau, 2 * d), 9);
      }
    }
  });
});

describe('bølgelengde λ = v / f', () => {
  it('kjente verdier', () => {
    expect(wavelength(340, 170)).toBeCloseTo(2, 12);
    expect(wavelength(340, 50)).toBeCloseTo(6.8, 12);
    expect(wavelength(1500, 50)).toBeCloseTo(30, 12);
    expect(wavelength(1500, 50e3)).toBeCloseTo(0.03, 12);
    expect(wavelength(340, 20e3)).toBeCloseTo(0.017, 12);
    expect(wavelength(340, 0)).toBeNaN();
  });

  it('samme frekvens gir 4,4 ganger lengre bølgelengde i vann', () => {
    for (const sit of ['torden', 'ekkolodd'] as Situasjon[]) {
      for (const fv of values(SLIDERS[sit].f)) {
        const f = frequencyHz(sit, fv);
        const lAir = wavelength(V_LUFT, f);
        const lWater = wavelength(V_VANN, f);
        expect(lWater / lAir).toBeCloseTo(1500 / 340, 9);
        expect(lAir * f).toBeCloseTo(V_LUFT, 6);
        expect(lWater * f).toBeCloseTo(V_VANN, 6);
      }
    }
  });

  it('frekvensen er i Hz for tordenen og kHz for ekkoloddet', () => {
    expect(frequencyHz('torden', 50)).toBe(50);
    expect(frequencyHz('ekkolodd', 50)).toBe(50000);
    // Ekkoloddet sender ultralyd (over 20 kHz), tordenen dyp lyd vi hører
    expect(frequencyHz('ekkolodd', SLIDERS.ekkolodd.f.min)).toBeGreaterThanOrEqual(20000);
    expect(frequencyHz('torden', SLIDERS.torden.f.max)).toBeLessThan(20000);
  });

  it('utsnittet i figuren rommer mellom 1 og 50 bølgelengder for alle frekvenser', () => {
    for (const sit of ['torden', 'ekkolodd'] as Situasjon[]) {
      const S = stripLength(sit);
      for (const fv of values(SLIDERS[sit].f)) {
        const f = frequencyHz(sit, fv);
        for (const v of [V_LUFT, V_VANN]) {
          const n = S / wavelength(v, f);
          expect(n).toBeGreaterThanOrEqual(1);
          expect(n).toBeLessThanOrEqual(50);
        }
      }
    }
  });
});

describe('avspilling', () => {
  it('tordenen går i sanntid når den er kort, og varer aldri over 8 s', () => {
    expect(playback('torden', 3).speed).toBe(1);
    expect(playback('torden', 6).speed).toBe(1);
    for (const t of values(SLIDERS.torden.t)) {
      const p = playback('torden', t);
      expect(p.tEnd).toBeGreaterThan(t);
      expect(p.tEnd / p.speed).toBeLessThanOrEqual(8 + 1e-9);
      expect(p.speed).toBeGreaterThanOrEqual(1);
    }
  });

  it('ekkoloddet går i sakte film i ca. 4 s', () => {
    for (const t of values(SLIDERS.ekkolodd.t)) {
      const p = playback('ekkolodd', t);
      expect(p.tEnd).toBeGreaterThan(t);
      expect(p.speed).toBeLessThan(0.1);
      expect(p.tEnd / p.speed).toBeCloseTo(4, 9);
    }
  });

  it('lynglimtet er sterkest i nedslaget og borte etter 0,3 s', () => {
    expect(flashStrength(0)).toBe(1);
    expect(flashStrength(0.15)).toBeCloseTo(0.5, 9);
    expect(flashStrength(0.3)).toBe(0);
    expect(flashStrength(5)).toBe(0);
    expect(flashStrength(-1)).toBe(0);
    expect(flashStrength(NaN)).toBe(0);
  });
});
