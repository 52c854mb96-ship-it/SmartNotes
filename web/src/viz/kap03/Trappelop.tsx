import { useEffect, useState, type ReactNode } from 'react';
import {
  Arrow,
  Controls,
  Explain,
  Figure,
  Formula,
  FormulaLine,
  G_EARTH,
  Label,
  PlayControls,
  Readout,
  Readouts,
  Slider,
  Toolbar,
  VIZ,
  VizLayout,
  fmt,
  scaleLinear,
  useTextScale,
  useSimClock,
} from '../kit';
import { POWER_REFS, pace, stairRun, timeForEnergy, type StairResult } from './model';
import { useNarrow } from './useNarrow';

const KETTLE = 2000;
const C_YOU = VIZ.applied;

export default function Trappelop() {
  const [m, setM] = useState(60);
  const [h, setH] = useState(9);
  const [time, setTime] = useState(10);
  const { ref, narrow } = useNarrow();
  const r = stairRun({ m, h, t: time });
  const clock = useSimClock({ tMax: time });
  const { setT } = clock;
  // Start midt i trappa
  useEffect(() => setT(6), [setT]);
  const tau = Math.min(clock.t, time);
  const u = time > 0 ? tau / time : 1;

  return (
    <VizLayout>
      <Controls>
        <Slider label="Masse m" value={m} onChange={setM} min={30} max={120} step={1} unit="kg" decimals={0} />
        <Slider label="Høyde h" value={h} onChange={setH} min={1} max={30} step={0.5} unit="m" decimals={1} />
        <Slider label="Tid t" value={time} onChange={setTime} min={2} max={60} step={0.5} unit="s" decimals={1} />
      </Controls>
      <Toolbar>
        <PlayControls clock={clock} decimals={1} />
      </Toolbar>

      <div ref={ref}>
        <Figure
          viewBox={`0 0 800 ${narrow ? 430 : 360}`}
          label={`Elev på ${fmt(m, 0)} kg som løper ${fmt(h, 1)} m opp en trapp på ${fmt(time, 1)} s.`}
          maxHeight={narrow ? 480 : 400}
        >
          <Stairs h={h} m={m} u={u} narrow={narrow} />
        </Figure>
      </div>

      <Figure viewBox={`0 0 800 ${narrow ? 500 : 330}`} label="Effekten din sammenlignet med vanlige apparater." maxHeight={narrow ? 540 : 360}>
        <PowerBars P={r.P} narrow={narrow} />
      </Figure>

      <Readouts>
        <Readout label="Arbeid W = mgh" value={fmt(r.W, 0)} unit="J" tone={VIZ.gravity} />
        <Readout label="Effekt P = W/t" value={fmt(r.P, 0)} unit="W" tone={C_YOU} />
        <Readout label="Vannkokeren bruker like mye energi på" value={fmt(timeForEnergy(r.W, KETTLE), 1)} unit="s" />
      </Readouts>

      <Formula label="Arbeid og effekt">
        <FormulaLine>
          W = mgh = {fmt(m, 0)} kg · 9,81 m/s² · {fmt(h, 1)} m = {fmt(r.W, 0)} J
        </FormulaLine>
        <FormulaLine>
          P = W / t = {fmt(r.W, 0)} J / {fmt(time, 1)} s = {fmt(r.P, 0)} W
        </FormulaLine>
      </Formula>

      <Explain>{explanation(r, h, time)}</Explain>
    </VizLayout>
  );
}

/* ---------- Trappa ---------- */

function Stairs({ h, m, u, narrow }: { h: number; m: number; u: number; narrow: boolean }) {
  const f = useTextScale();
  const H = narrow ? 430 : 360;
  const groundY = H - 30;
  const topY = 60 + 30 * f;
  const x0 = 200;
  const x1 = 600;
  const n = Math.max(4, Math.min(22, Math.round(h / 0.4)));
  const run = (x1 - x0) / n;
  const rise = (groundY - topY) / n;
  let d = `M${x0},${groundY}`;
  for (let i = 0; i < n; i++) d += ` L${x0 + i * run},${groundY - (i + 1) * rise} L${x0 + (i + 1) * run},${groundY - (i + 1) * rise}`;
  d += ` L760,${topY} L760,${groundY} Z`;
  // Eleven står på trinnet under seg
  const step = Math.min(n, Math.floor(u * n + 1e-9));
  const px = x0 + Math.min(u, 1) * (x1 - x0) + (u >= 1 ? 40 : 0);
  const py = u >= 1 ? topY : groundY - step * rise;
  const k = narrow ? 1.35 : 1;
  const climbed = Math.min(u, 1) * h;
  const W = m * G_EARTH * climbed;
  // Tyngden vokser med massen, men pilen holdes innenfor figuren
  const gLen = (22 + (m / 120) * 40) * k;

  return (
    <g>
      <line x1={20} x2={x0} y1={groundY} y2={groundY} className="viz-ground" />
      <path d={d} fill={VIZ.body} className="viz-block" />
      {/* Høyden */}
      <line x1={60} x2={x1} y1={topY} y2={topY} className="viz-guide" />
      <Arrow x1={70} y1={groundY} x2={70} y2={topY + 2} color={VIZ.ink} width={2} head={10} />
      <Arrow x1={70} y1={topY} x2={70} y2={groundY - 2} color={VIZ.ink} width={2} head={10} />
      <Label x={84} y={(groundY + topY) / 2 + 6} anchor="start">
        h = {fmt(h, 1)} m
      </Label>
      {/* Høyden så langt */}
      {u > 0 && u < 1 && <line x1={px - 30} x2={x1 + 160} y1={py} y2={py} stroke={VIZ.gravity} strokeWidth={1.5} strokeDasharray="4 5" opacity={0.8} />}
      <Runner x={px} y={py} k={k} />
      <Arrow x1={px + 22 * k} y1={py - 34 * k} x2={px + 22 * k} y2={py - 34 * k + gLen} color={VIZ.gravity} width={2.5 * k} head={10 * k} label="G" labelX={px + 30 * k} labelY={py - 34 * k + gLen / 2 + 6} labelAnchor="start" />
      <Label x={24} y={26 * f} anchor="start" muted>
        Løftet så langt: {fmt(climbed, 1)} m
      </Label>
      <Label x={24} y={26 * f + 26 * f} anchor="start" color={VIZ.gravity}>
        Arbeid så langt: {fmt(W, 0)} J
      </Label>
    </g>
  );
}

function Runner({ x, y, k }: { x: number; y: number; k: number }) {
  const s = (v: number) => v * k;
  return (
    <g stroke={VIZ.ink} strokeWidth={3.5 * k} strokeLinecap="round" fill="none">
      <circle cx={x} cy={y - s(62)} r={s(9)} fill={VIZ.bodyStrong} strokeWidth={2.5 * k} />
      <line x1={x} y1={y - s(52)} x2={x - s(3)} y2={y - s(26)} />
      <line x1={x - s(3)} y1={y - s(26)} x2={x + s(10)} y2={y - s(14)} />
      <line x1={x + s(10)} y1={y - s(14)} x2={x + s(8)} y2={y} />
      <line x1={x - s(3)} y1={y - s(26)} x2={x - s(14)} y2={y - s(12)} />
      <line x1={x - s(14)} y1={y - s(12)} x2={x - s(20)} y2={y - s(2)} />
      <line x1={x - s(1)} y1={y - s(46)} x2={x + s(12)} y2={y - s(36)} />
      <line x1={x - s(1)} y1={y - s(46)} x2={x - s(14)} y2={y - s(38)} />
    </g>
  );
}

/* ---------- Effekt sammenlignet med apparater ---------- */

function PowerBars({ P, narrow }: { P: number; narrow: boolean }) {
  const f = useTextScale();
  const H = narrow ? 500 : 330;
  const rows = [...POWER_REFS.map((r) => ({ ...r, you: false })), { label: 'Du i trappa', P, you: true }].sort((a, b) => a.P - b.P);
  const top = 40 * f;
  const rowH = (H - top - 10) / rows.length;
  const labelW = 150 * f;
  const valueW = 92 * f;
  // Ingen akseverdier her, så skalaen trenger ikke være rund
  const max = Math.max(KETTLE, P) * 1.04;
  const xs = scaleLinear([0, max], [24 + labelW, 800 - valueW - 12]);
  const bar = Math.min(26 * f, rowH * 0.6);
  return (
    <g>
      <Label x={24} y={24 * f} anchor="start" muted>
        Effekt (W)
      </Label>
      <line x1={xs(0)} x2={xs(0)} y1={top - 8} y2={H - 6} className="viz-axis" />
      {rows.map((row, i) => {
        const yc = top + rowH * (i + 0.5);
        return (
          <g key={row.label}>
            <Label x={24} y={yc + 6} anchor="start" color={row.you ? C_YOU : undefined} weight={row.you ? 700 : 500}>
              {row.label}
            </Label>
            <rect x={xs(0)} y={yc - bar / 2} width={Math.max(2, xs(row.P) - xs(0))} height={bar} rx={3} fill={row.you ? C_YOU : VIZ.tension} opacity={row.you ? 0.9 : 0.55} />
            <text x={800 - 12} y={yc + 6} textAnchor="end" className="viz-label" fill={row.you ? C_YOU : VIZ.ink}>
              {fmt(row.P, 0)} W
            </text>
          </g>
        );
      })}
    </g>
  );
}

/* ---------- Forklaring ---------- */

function explanation(r: StairResult, h: number, time: number): ReactNode {
  const level = pace(r.vertical);
  const bulbs = r.P / 60;
  const levelText: Record<typeof level, string> = {
    rolig: 'Det er en rolig tur opp trappa.',
    gange: `Det tilsvarer vanlig gange i trappa, omtrent like mye som ${fmt(bulbs, 0)} glødepærer.`,
    løping: `Det er løping i trappa, like mye som ${fmt(bulbs, 0)} glødepærer, og det klarer du bare en stund.`,
    sprint: 'Det er spurt på toppidrettsnivå, og kan bare holdes i noen få sekunder.',
    urealistisk: `Det er urealistisk: ingen mennesker løfter seg ${fmt(r.vertical, 1)} m per sekund opp en trapp.`,
  };
  return (
    <>
      <p>
        <strong>Arbeidet avhenger ikke av tiden.</strong> Du løfter deg selv {fmt(h, 1)} m, så W = mgh = {fmt(r.W, 0)} J enten du går eller
        løper. Effekten forteller hvor fort arbeidet gjøres: P = W/t = {fmt(r.P, 0)} W. {levelText[level]}
      </p>
      <p>
        Bruker du dobbelt så lang tid ({fmt(2 * time, 1)} s), blir arbeidet det samme, men effekten halvparten ({fmt(r.P / 2, 0)} W). Kroppen
        bruker egentlig omtrent fire ganger så mye energi, fordi musklene har en virkningsgrad på rundt 25 %.
      </p>
    </>
  );
}
