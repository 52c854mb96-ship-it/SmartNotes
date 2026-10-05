import { describe, expect, it } from 'vitest';
import {
  ABS_REFRACTORY,
  MEAL_PLANS,
  PERSONS,
  TUNING,
  V_AHP,
  V_PEAK,
  V_REST,
  V_THRESHOLD,
  activeNode,
  apTemplate,
  clearanceRate,
  effectiveThreshold,
  glucagonSecretion,
  glucoseStats,
  insulinSecretion,
  internodeLength,
  kOpen,
  mealsFrom,
  membraneAt,
  naOpen,
  repolarisedAt,
  riseTime,
  simulateGlucose,
  simulateNeuron,
  simulateSynapse,
  speedMyelinated,
  speedUnmyelinated,
  thresholdStimulus,
  travelTimeMs,
} from './model';

describe('aksjonspotensialet', () => {
  it('lærebokverdiene: hvile −70, terskel −55, topp +30, hyperpolarisering ned mot −80 mV', () => {
    expect(apTemplate(0)).toBeCloseTo(V_THRESHOLD, 9);
    expect(apTemplate(riseTime())).toBeCloseTo(V_PEAK, 9);
    let min = 0;
    for (let t = 0; t < 10; t += 0.01) min = Math.min(min, apTemplate(t));
    expect(min).toBeCloseTo(V_AHP, 1);
    // Tilbake til hvilepotensialet
    expect(apTemplate(20)).toBeCloseTo(V_REST, 1);
    expect(apTemplate(repolarisedAt())).toBeCloseTo(V_REST, 6);
    expect(thresholdStimulus()).toBe(15);
  });

  it('alt eller ingenting: under terskelen ingen impuls, over terskelen alltid samme topp', () => {
    expect(simulateNeuron([{ t: 1, S: 14 }]).spikes).toHaveLength(0);
    for (const S of [15, 20, 30, 40]) {
      const run = simulateNeuron([{ t: 1, S }]);
      expect(run.spikes).toHaveLength(1);
      let peak = -Infinity;
      for (let t = 0; t < 10; t += 0.005) peak = Math.max(peak, run.V(t));
      expect(peak).toBeCloseTo(V_PEAK, 0);
    }
    // En lokal depolarisering dør ut
    const weak = simulateNeuron([{ t: 1, S: 10 }]);
    expect(weak.V(1.2)).toBeCloseTo(V_REST + 10, 6);
    expect(weak.V(12)).toBeCloseTo(V_REST, 1);
    expect(weak.V(0)).toBe(V_REST);
  });

  it('refraktærperioden: absolutt de første 2 ms, deretter hevet terskel', () => {
    expect(effectiveThreshold(1)).toBe(Number.POSITIVE_INFINITY);
    expect(effectiveThreshold(ABS_REFRACTORY + 0.5)).toBeGreaterThan(V_THRESHOLD);
    expect(effectiveThreshold(30)).toBe(V_THRESHOLD);
    // Selv et svært sterkt stimulus gir ikke nytt aksjonspotensial i den absolutte refraktærperioden
    const abs = simulateNeuron([
      { t: 1, S: 40 },
      { t: 2, S: 40 },
    ]);
    expect(abs.spikes).toHaveLength(1);
    expect(abs.stimuli[1]!.refractory).toBe('absolutt');
    // I den relative trengs sterkere stimulus
    const weak = simulateNeuron([
      { t: 1, S: 20 },
      { t: 5, S: 20 },
    ]);
    const strong = simulateNeuron([
      { t: 1, S: 40 },
      { t: 5, S: 40 },
    ]);
    expect(weak.spikes).toHaveLength(1);
    expect(strong.spikes).toHaveLength(2);
    // Etter refraktærperioden fyrer cella igjen
    expect(
      simulateNeuron([
        { t: 1, S: 20 },
        { t: 12, S: 20 },
      ]).spikes,
    ).toHaveLength(2);
  });

  it('summering: to svake stimuli tett etter hverandre kan nå terskelen', () => {
    expect(
      simulateNeuron([
        { t: 1, S: 10 },
        { t: 2, S: 10 },
      ]).spikes,
    ).toHaveLength(1);
    expect(
      simulateNeuron([
        { t: 1, S: 10 },
        { t: 8, S: 10 },
      ]).spikes,
    ).toHaveLength(0);
  });

  it('kanalene: Na⁺ åpner først, K⁺ senere, og tilstanden følger fasene', () => {
    expect(naOpen(0.28)).toBeCloseTo(1, 6);
    expect(kOpen(1.2)).toBeCloseTo(1, 6);
    expect(naOpen(1.2)).toBeLessThan(0.01);
    expect(kOpen(0.2)).toBeLessThan(0.1);
    const run = simulateNeuron([{ t: 1, S: 20 }]);
    const c = run.spikes[0]!;
    expect(membraneAt(run, 0.5).phase).toBe('hvile');
    expect(membraneAt(run, c + 0.2)).toMatchObject({ phase: 'depolarisering', naState: 'åpen' });
    expect(membraneAt(run, c + 1)).toMatchObject({
      phase: 'repolarisering',
      naState: 'inaktivert',
      kState: 'åpen',
      refractory: 'absolutt',
    });
    expect(membraneAt(run, c + 3)).toMatchObject({ phase: 'hyperpolarisering', refractory: 'relativ' });
  });

  it('ledningshastighet: myelin gjør impulsen mange ganger raskere', () => {
    expect(speedMyelinated(10)).toBe(60);
    expect(speedUnmyelinated(1)).toBeCloseTo(1.1, 9);
    // Blekksprutens kjempeakson (0,5 mm) ca. 25 m/s
    expect(speedUnmyelinated(500)).toBeGreaterThan(20);
    expect(speedUnmyelinated(500)).toBeLessThan(30);
    for (const d of [1, 5, 10, 20]) expect(speedMyelinated(d)).toBeGreaterThan(5 * speedUnmyelinated(d));
    expect(travelTimeMs(1, 100)).toBeCloseTo(10, 9);
    expect(internodeLength(10)).toBe(1000);
    // Saltatorisk: én innsnøring av gangen
    const hop = internodeLength(10) / 1000 / speedMyelinated(10);
    expect(activeNode(0, 10)).toBe(0);
    expect(activeNode(hop * 2.5, 10)).toBe(2);
    expect(activeNode(-1, 10)).toBe(-1);
  });
});

describe('synapsen', () => {
  it('reopptakshemmeren gjør at signalstoffet blir lenger i spalten', () => {
    expect(clearanceRate(true)).toBeLessThan(clearanceRate(false));
    const normal = simulateSynapse({ impulses: 1, reuptakeInhibitor: false, receptorBlocker: false });
    const inhib = simulateSynapse({ impulses: 1, reuptakeInhibitor: true, receptorBlocker: false });
    expect(inhib.nt(10)).toBeGreaterThan(3 * normal.nt(10));
    expect(normal.nt(0)).toBe(0);
    expect(normal.nt(30)).toBeLessThan(0.001);
  });

  it('én impuls gir en depolarisering under terskelen; flere legges sammen til et aksjonspotensial', () => {
    const one = simulateSynapse({ impulses: 1, reuptakeInhibitor: false, receptorBlocker: false });
    expect(one.postSpikes).toHaveLength(0);
    expect(one.epspPeak).toBeGreaterThan(V_REST + 3);
    expect(one.epspPeak).toBeLessThan(V_THRESHOLD);
    const three = simulateSynapse({ impulses: 3, reuptakeInhibitor: false, receptorBlocker: false });
    expect(three.postSpikes.length).toBeGreaterThanOrEqual(1);
    // Med reopptakshemmer holder én impuls
    expect(simulateSynapse({ impulses: 1, reuptakeInhibitor: true, receptorBlocker: false }).postSpikes.length).toBeGreaterThanOrEqual(1);
  });

  it('reseptorblokkeren stopper signalet', () => {
    for (const n of [1, 3, 5]) {
      const r = simulateSynapse({ impulses: n, reuptakeInhibitor: false, receptorBlocker: true });
      expect(r.postSpikes).toHaveLength(0);
      expect(r.receptors(5)).toBeLessThan(0.15);
    }
    // Signalstoffet frigjøres likevel
    expect(simulateSynapse({ impulses: 1, reuptakeInhibitor: false, receptorBlocker: true }).nt(3)).toBeGreaterThan(0.5);
  });
});

describe('blodsukkeret', () => {
  const day = (person: keyof typeof PERSONS, plan: keyof typeof MEAL_PLANS, extra: { exercise?: boolean; insulinTherapy?: boolean } = {}) =>
    simulateGlucose({
      meals: mealsFrom(MEAL_PLANS[plan].grams),
      production: PERSONS[person].production,
      sensitivity: PERSONS[person].sensitivity,
      exercise: extra.exercise ?? false,
      insulinTherapy: extra.insulinTherapy ?? false,
    });

  it('hormonene: insulin øker og glukagon faller når blodsukkeret stiger', () => {
    expect(insulinSecretion(5, 1)).toBeCloseTo(1, 9);
    expect(insulinSecretion(8, 1)).toBeGreaterThan(2);
    expect(insulinSecretion(8, 0)).toBe(0);
    expect(glucagonSecretion(5, 1)).toBeCloseTo(1, 9);
    expect(glucagonSecretion(3.5, 1)).toBeGreaterThan(1.2);
    expect(glucagonSecretion(9, 1)).toBeLessThan(0.3);
    // Uten betaceller blir ikke glukagon dempet
    expect(glucagonSecretion(15, 0)).toBeCloseTo(1, 9);
  });

  it('frisk person: fastende ca. 5 og under 9 mmol/L etter måltider', () => {
    const r = day('frisk', 'vanlig');
    const s = glucoseStats(r);
    expect(s.fasting).toBeGreaterThan(4.5);
    expect(s.fasting).toBeLessThan(5.5);
    expect(s.max).toBeGreaterThan(6.5);
    expect(s.max).toBeLessThan(9);
    expect(s.min).toBeGreaterThan(4);
    // Faste: glukagon og leveren holder blodsukkeret oppe
    const faste = glucoseStats(day('frisk', 'faste'));
    expect(faste.min).toBeGreaterThan(4.5);
  });

  it('glukosebelastning: normal hos friske, diabetes ved insulinresistens', () => {
    const healthy = day('frisk', 'glukosebelastning');
    expect(healthy.G(10)).toBeLessThan(7.8);
    const t2 = day('type2', 'glukosebelastning');
    expect(t2.G(10)).toBeGreaterThan(11.1);
    expect(glucoseStats(t2).fasting).toBeGreaterThanOrEqual(6.9);
  });

  it('type 1-diabetes: svært høyt blodsukker og glukose i urinen uten insulin, nær normalt med insulin', () => {
    const untreated = day('type1', 'vanlig');
    expect(glucoseStats(untreated).fasting).toBeGreaterThan(12);
    expect(untreated.fluxes(18).urine).toBeGreaterThan(0);
    expect(untreated.insulin(9)).toBeLessThan(0.01);
    const treated = day('type1', 'vanlig', { insulinTherapy: true });
    const s = glucoseStats(treated);
    expect(s.max).toBeLessThan(11);
    expect(s.min).toBeGreaterThan(4);
    expect(TUNING.basalTherapy).toBeGreaterThan(0);
  });

  it('fysisk aktivitet senker blodsukkeret etter middag, særlig ved insulinresistens', () => {
    const t2 = day('type2', 'vanlig');
    const t2ex = day('type2', 'vanlig', { exercise: true });
    expect(t2ex.G(19)).toBeLessThan(t2.G(19) - 2);
    const h = day('frisk', 'vanlig');
    const hex = day('frisk', 'vanlig', { exercise: true });
    expect(hex.G(19)).toBeLessThanOrEqual(h.G(19));
  });

  it('massebalanse ved faste: produksjon = forbruk i likevekt', () => {
    const r = day('frisk', 'faste');
    const f = r.fluxes(12);
    expect(f.gut).toBeCloseTo(0, 6);
    expect(f.liver - f.brain - f.muscle - f.urine).toBeCloseTo(0, 1);
  });
});
