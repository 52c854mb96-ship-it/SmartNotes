import { it } from 'vitest';
import { simulateNeuron, simulateSynapse, simulateGlucose, glucoseStats, mealsFrom, MEAL_PLANS, PERSONS } from './model';
import { solveTissue, healedTime, tissueAt } from '../kap07/model';
import { gasExchange, TISSUE_PRESETS } from '../kap09/model';
it('probe', () => {
  const r = simulateNeuron([{ t: 2, S: 40 }, { t: 3, S: 40 }]);
  let mx = -999; for (let t = 3; t < 6; t += 0.01) mx = Math.max(mx, r.V(t));
  console.log('abs40 max after s2', mx.toFixed(1), r.stimuli.map(s=>s.refractory));
  for (const iv of [1, 1.5, 2, 2.5, 3]) { const q = simulateNeuron([{ t: 2, S: 40 }, { t: 2 + iv, S: 40 }]); let m=-999; for (let t = 2+iv; t < 2+iv+3; t += 0.01) m = Math.max(m, q.V(t)); console.log('iv', iv, m.toFixed(1), q.spikes.length); }
  for (const inh of [false, true]) for (const bl of [false, true]) for (const n of [1, 3, 5]) {
    const s = simulateSynapse({ impulses: n, reuptakeInhibitor: inh, receptorBlocker: bl });
    console.log('syn', n, inh, bl, s.epspPeak.toFixed(1), s.postSpikes.length);
  }
  for (const w of [0, 0.2, 0.5, 0.8]) for (const d of [false, true]) {
    const t = solveTissue({ onkogen: false, tsg: false, damage: d, wound: w });
    console.log('heal', w, d, healedTime(t));
  }
  for (const [o, ts] of [[true, false], [false, true], [true, true]] as const) for (const d of [false, true]) {
    const t = solveTissue({ onkogen: o, tsg: ts, damage: d, wound: 0.5 });
    let mx2 = 0; for (let i = 0; i < t.sol.t.length; i++) mx2 = Math.max(mx2, (t.sol.y[i]![0] ?? 0) + (t.sol.y[i]![1] ?? 0));
    console.log('clone', o, ts, d, 'max', mx2.toFixed(3), 'mut30', tissueAt(t, 30).mutant.toFixed(3));
  }
  for (const p of ['frisk', 'type1', 'type2'] as const) for (const plan of ['vanlig', 'sukkerrik', 'glukosebelastning', 'faste'] as const) {
    const run = simulateGlucose({ meals: mealsFrom(MEAL_PLANS[plan].grams), production: PERSONS[p].production, sensitivity: PERSONS[p].sensitivity, exercise: false, insulinTherapy: false });
    const s = glucoseStats(run);
    let insMax = 0; for (let t = 0; t <= 6; t += 0.25) insMax = Math.max(insMax, run.insulin(t));
    console.log('gl', p, plan, s.fasting.toFixed(1), s.max.toFixed(1), s.min.toFixed(1), 'G10', run.G(10).toFixed(1), 'ins night max', insMax.toFixed(2));
  }
  for (const ex of [false, true]) { const run = simulateGlucose({ meals: mealsFrom([50,50,80]), production: 0, sensitivity: 1, exercise: ex, insulinTherapy: true }); const s = glucoseStats(run); console.log('t1 ther', ex, s.fasting.toFixed(1), s.max.toFixed(1), s.min.toFixed(1)); }
  for (const h of [0, 2469, 5000, 8849]) for (const k of ['hvile', 'arbeid'] as const) { const g = gasExchange(h, TISSUE_PRESETS[k]); console.log('gas', h, k, g.PAO2.toFixed(2), g.PACO2.toFixed(2), g.PaO2.toFixed(2), g.SaO2.toFixed(3), g.PvO2.toFixed(2), g.SvO2.toFixed(3), g.released.toFixed(1), g.releasedNoBohr.toFixed(1)); }
});
