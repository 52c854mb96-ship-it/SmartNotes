import { describe, expect, it } from 'vitest';
import {
  ARSTIDER,
  ARSTID_IDS,
  JORDAKSE,
  PANEL,
  P_AKSE_MAKS,
  SLIDERS,
  SOLARKONSTANT,
  STEDER,
  STED_IDS,
  airMass,
  beamIrradiance,
  bestTilt,
  dayLength,
  incidenceAngle,
  noonAltitude,
  panelPower,
  powerCurve,
  ratio,
  solarPanel,
} from './model-solcellepanel';

describe('solhøyden midt på dagen', () => {
  it('h = 90° − φ + δ', () => {
    expect(noonAltitude(59.9, JORDAKSE)).toBeCloseTo(53.5, 6);
    expect(noonAltitude(59.9, 0)).toBeCloseTo(30.1, 6);
    expect(noonAltitude(59.9, -JORDAKSE)).toBeCloseTo(6.7, 6);
  });

  it('ved jevndøgn er solhøyden 90° minus breddegraden', () => {
    for (const id of STED_IDS) expect(noonAltitude(STEDER[id].breddegrad, 0)).toBeCloseTo(90 - STEDER[id].breddegrad, 9);
  });

  it('i Tromsø er det mørketid 21. desember, og sola står lavere jo lenger nord', () => {
    expect(noonAltitude(STEDER.tromso.breddegrad, -JORDAKSE)).toBeLessThan(0);
    const hs = STED_IDS.map((id) => noonAltitude(STEDER[id].breddegrad, -JORDAKSE));
    for (let i = 1; i < hs.length; i++) expect(hs[i]!).toBeLessThan(hs[i - 1]!);
  });

  it('forskjellen mellom sommer og vinter er 2 · 23,4° overalt', () => {
    for (const id of STED_IDS) {
      const lat = STEDER[id].breddegrad;
      expect(noonAltitude(lat, ARSTIDER.sommer.deklinasjon) - noonAltitude(lat, ARSTIDER.vinter.deklinasjon)).toBeCloseTo(46.8, 9);
    }
  });
});

describe('luftmassen og innstrålingen', () => {
  it('luftmassen er 1 rett over oss, ca. 2 ved 30° og ca. 38 ved horisonten', () => {
    expect(airMass(90)).toBeCloseTo(1, 2);
    expect(airMass(30)).toBeCloseTo(1.99, 1);
    expect(airMass(0.0001)).toBeGreaterThan(35);
    expect(airMass(0.0001)).toBeLessThan(40);
    expect(airMass(0)).toBe(Infinity);
    expect(airMass(-3)).toBe(Infinity);
    expect(airMass(Number.NaN)).toBe(Infinity);
  });

  it('luftmassen er nær 1 / sin h når sola står høyt', () => {
    for (const h of [30, 45, 60, 75]) expect(airMass(h)).toBeCloseTo(1 / Math.sin((h * Math.PI) / 180), 1);
  });

  it('luftmassen avtar når sola stiger', () => {
    let prev = Infinity;
    for (let h = 0.5; h <= 90; h += 0.5) {
      const m = airMass(h);
      expect(m).toBeLessThan(prev);
      prev = m;
    }
  });

  it('innstrålingen rett over oss er ca. 70 % av solarkonstanten', () => {
    expect(beamIrradiance(90)).toBeCloseTo(0.7 * SOLARKONSTANT, -1);
  });

  it('innstrålingen øker med solhøyden og er alltid mindre enn solarkonstanten', () => {
    let prev = 0;
    for (let h = 0.5; h <= 90; h += 0.5) {
      const I = beamIrradiance(h);
      expect(I).toBeGreaterThan(prev);
      expect(I).toBeLessThan(SOLARKONSTANT);
      prev = I;
    }
  });

  it('gir rimelige verdier for en klar dag (ca. 900 W/m² om sommeren og ca. 300 W/m² i desember i Oslo)', () => {
    expect(beamIrradiance(53.5)).toBeGreaterThan(850);
    expect(beamIrradiance(53.5)).toBeLessThan(950);
    expect(beamIrradiance(6.7)).toBeGreaterThan(250);
    expect(beamIrradiance(6.7)).toBeLessThan(380);
    expect(beamIrradiance(0.01)).toBeLessThan(40);
  });

  it('ingen innstråling når sola er under horisonten', () => {
    expect(beamIrradiance(0)).toBe(0);
    expect(beamIrradiance(-3)).toBe(0);
  });
});

describe('innfallsvinkelen og effekten', () => {
  it('θ = |90° − h − β|', () => {
    expect(incidenceAngle(53.5, 36.5)).toBeCloseTo(0, 9);
    expect(incidenceAngle(53.5, 0)).toBeCloseTo(36.5, 9);
    expect(incidenceAngle(53.5, 90)).toBeCloseTo(53.5, 9);
    expect(incidenceAngle(6.7, 40)).toBeCloseTo(43.3, 9);
  });

  it('flatt panel: θ = 90° − h; loddrett panel: θ = h', () => {
    for (const h of [5, 20, 45, 70]) {
      expect(incidenceAngle(h, 0)).toBeCloseTo(90 - h, 9);
      expect(incidenceAngle(h, 90)).toBeCloseTo(h, 9);
    }
  });

  it('P = η · I · A · cos θ', () => {
    expect(panelPower(0.2, 1000, 1.7, 0)).toBeCloseTo(340, 9);
    expect(panelPower(0.2, 1000, 1.7, 60)).toBeCloseTo(170, 9);
    expect(panelPower(0.25, 800, 2, 0)).toBeCloseTo(400, 9);
  });

  it('ingen effekt når lyset streifer eller kommer bakfra, og ingen negative tall', () => {
    expect(panelPower(0.2, 1000, 1.7, 90)).toBe(0);
    expect(panelPower(0.2, 1000, 1.7, 120)).toBe(0);
    expect(panelPower(0.2, 0, 1.7, 0)).toBe(0);
    expect(panelPower(0.2, 1000, 1.7, Number.NaN)).toBe(0);
  });

  it('effekten er proporsjonal med virkningsgraden og arealet', () => {
    const a = panelPower(0.1, 700, 1.7, 25);
    expect(panelPower(0.2, 700, 1.7, 25)).toBeCloseTo(2 * a, 9);
    expect(panelPower(0.1, 700, 3.4, 25)).toBeCloseTo(2 * a, 9);
  });
});

describe('den beste vinkelen', () => {
  it('β = 90° − h, og ingen når sola er under horisonten', () => {
    expect(bestTilt(53.5)).toBeCloseTo(36.5, 9);
    expect(bestTilt(6.7)).toBeCloseTo(83.3, 9);
    expect(bestTilt(-3)).toBeNull();
    expect(bestTilt(0)).toBeNull();
  });

  it('ved jevndøgn er den beste vinkelen lik breddegraden', () => {
    for (const id of STED_IDS) expect(solarPanel(id, 'jevndogn', 30, 20).best).toBeCloseTo(STEDER[id].breddegrad, 9);
  });

  it('gir den største effekten på grafen (numerisk sjekk)', () => {
    for (const id of STED_IDS) {
      for (const a of ARSTID_IDS) {
        const s = solarPanel(id, a, 0, 20);
        if (!s.sunUp) continue;
        const pts = powerCurve(id, a, 20, 901);
        let bestBeta = 0;
        let bestP = -1;
        for (const [b, P] of pts) {
          if (P > bestP) {
            bestP = P;
            bestBeta = b;
          }
        }
        expect(Math.abs(bestBeta - s.best!)).toBeLessThanOrEqual(0.1 + 1e-9);
        expect(bestP).toBeLessThanOrEqual(s.Pbest + 1e-9);
        expect(s.Pbest).toBeCloseTo(0.2 * s.I * PANEL.areal, 9);
      }
    }
  });
});

describe('dagens lengde', () => {
  it('midnattssol og mørketid i Tromsø', () => {
    expect(dayLength(STEDER.tromso.breddegrad, JORDAKSE)).toBe(24);
    expect(dayLength(STEDER.tromso.breddegrad, -JORDAKSE)).toBe(0);
  });

  it('Oslo: ca. 19 timer i juni, ca. 6 timer i desember og litt over 12 timer ved jevndøgn', () => {
    expect(dayLength(59.9, JORDAKSE)).toBeCloseTo(18.8, 0);
    expect(dayLength(59.9, -JORDAKSE)).toBeCloseTo(5.9, 0);
    const eq = dayLength(59.9, 0);
    expect(eq).toBeGreaterThan(12);
    expect(eq).toBeLessThan(12.5);
  });

  it('sommer og vinter er nesten speilbilder om 12 timer (lysbrytningen gir litt ekstra dag)', () => {
    for (const id of ['kristiansand', 'oslo', 'trondheim'] as const) {
      const lat = STEDER[id].breddegrad;
      const sum = dayLength(lat, JORDAKSE) + dayLength(lat, -JORDAKSE);
      expect(sum).toBeGreaterThan(24);
      expect(sum).toBeLessThan(25.5);
    }
  });
});

describe('hele tilstanden', () => {
  it('Oslo om sommeren med 40°: nesten vinkelrett på sollyset', () => {
    const s = solarPanel('oslo', 'sommer', 40, 20);
    expect(s.h).toBeCloseTo(53.5, 9);
    expect(s.theta).toBeCloseTo(3.5, 9);
    expect(s.cosTheta).toBeCloseTo(Math.cos((3.5 * Math.PI) / 180), 9);
    expect(s.P).toBeCloseTo(0.2 * s.I * 1.7 * s.cosTheta, 9);
    expect(s.P).toBeGreaterThan(280);
    expect(s.P).toBeLessThan(320);
    expect(s.effectiveArea).toBeCloseTo(1.7 * s.cosTheta, 9);
    expect(s.incident * s.eta).toBeCloseTo(s.P, 9);
  });

  it('om vinteren er et flatt panel nesten verdiløst, men et bratt panel gir mye', () => {
    const flat = solarPanel('oslo', 'vinter', 0, 20);
    const steep = solarPanel('oslo', 'vinter', 83, 20);
    expect(flat.P).toBeLessThan(15);
    expect(steep.P).toBeGreaterThan(7 * flat.P);
    expect(flat.Pflat).toBeCloseTo(flat.P, 9);
  });

  it('sommer gir mer enn vinter på alle steder og alle vinkler', () => {
    for (const id of STED_IDS) {
      for (let b = 0; b <= 90; b += 5) {
        expect(solarPanel(id, 'sommer', b, 20).P).toBeGreaterThan(solarPanel(id, 'vinter', b, 20).P);
      }
    }
  });

  it('mørketid i Tromsø: ingen effekt, uansett vinkel', () => {
    for (let b = 0; b <= 90; b += 10) {
      const s = solarPanel('tromso', 'vinter', b, 25);
      expect(s.sunUp).toBe(false);
      expect(s.P).toBe(0);
      expect(s.Pbest).toBe(0);
      expect(s.incident).toBe(0);
      expect(s.best).toBeNull();
    }
  });

  it('energien bevares: elektrisk effekt er en del av strålingen som treffer, og aldri mer enn den', () => {
    for (const id of STED_IDS) {
      for (const a of ARSTID_IDS) {
        for (let b = 0; b <= 90; b += 15) {
          const s = solarPanel(id, a, b, 25);
          expect(s.P).toBeLessThanOrEqual(s.incident + 1e-9);
          expect(s.incident).toBeLessThanOrEqual(SOLARKONSTANT * PANEL.areal);
        }
      }
    }
  });

  it('alle kombinasjoner av glidebryterne gir endelige tall innenfor grafen', () => {
    for (const id of STED_IDS) {
      for (const a of ARSTID_IDS) {
        for (let b = SLIDERS.vinkel.min; b <= SLIDERS.vinkel.max; b += 1) {
          for (const e of [SLIDERS.virkningsgrad.min, SLIDERS.virkningsgrad.start, SLIDERS.virkningsgrad.max]) {
            const s = solarPanel(id, a, b, e);
            for (const v of [s.h, s.I, s.theta, s.cosTheta, s.P, s.Pbest, s.Pflat, s.groundI, s.dayLength, s.effectiveArea]) {
              expect(Number.isFinite(v)).toBe(true);
            }
            expect(s.P).toBeGreaterThanOrEqual(0);
            expect(s.Pbest).toBeLessThan(P_AKSE_MAKS);
            if (s.sunUp) expect(s.theta).toBeLessThanOrEqual(90);
          }
        }
      }
    }
  });

  it('klemmer ugyldige tall til glidebryterne', () => {
    const s = solarPanel('oslo', 'sommer', Number.NaN, Number.NaN);
    expect(s.beta).toBe(SLIDERS.vinkel.start);
    expect(s.eta).toBeCloseTo(SLIDERS.virkningsgrad.start / 100, 9);
    expect(solarPanel('oslo', 'sommer', 200, 20).beta).toBe(90);
  });

  it('vannrett mark får I · sin h, og et flatt panel får det samme per kvadratmeter', () => {
    const s = solarPanel('trondheim', 'jevndogn', 0, 20);
    expect(s.groundI).toBeCloseTo(s.I * Math.sin((s.h * Math.PI) / 180), 9);
    expect(s.P).toBeCloseTo(0.2 * s.groundI * PANEL.areal, 9);
  });
});

describe('grafen og hjelpere', () => {
  it('powerCurve går fra 0° til 90° og stemmer med solarPanel', () => {
    const pts = powerCurve('oslo', 'jevndogn', 20, 91);
    expect(pts).toHaveLength(91);
    expect(pts[0]![0]).toBe(0);
    expect(pts[90]![0]).toBe(90);
    expect(pts[40]![1]).toBeCloseTo(solarPanel('oslo', 'jevndogn', 40, 20).P, 9);
  });

  it('ratio gir null når nevneren er 0', () => {
    expect(ratio(10, 2)).toBe(5);
    expect(ratio(10, 0)).toBeNull();
    expect(ratio(Number.NaN, 2)).toBeNull();
  });
});
