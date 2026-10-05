import { useMemo, useState, type ReactNode } from 'react';
import {
  Arrow,
  BIO,
  Controls,
  Explain,
  Figure,
  Formula,
  FormulaLine,
  Legend,
  PlayBar,
  Plot,
  Readout,
  Readouts,
  Segmented,
  Slider,
  Toolbar,
  Txt,
  VIZ,
  VizLayout,
  fmt,
  fmtPct,
  linePath,
  mixColor,
  sample,
  seededRandom,
  useContainerTextScale,
  useSimClock,
  useSvgId,
  useTextScale,
} from '../kit';
import { NTU_PER_MM, concurrentLimit, gillProfile, type Flow, type GillProfile } from './model';
import { GjelleFilament } from './felles';

const FLOWS: { value: Flow; label: string }[] = [
  { value: 'motstrom', label: 'Motstrøm' },
  { value: 'medstrom', label: 'Medstrøm' },
];
const FLOW_NAME: Record<Flow, string> = { motstrom: 'motstrøm', medstrom: 'medstrøm' };

const C_WATER = BIO.vann;
const C_BLOOD = BIO.oksygenrikt;

/** O₂-metning (0–100 %) som blodfarge: fra oksygenfattig (blått) til oksygenrikt (rødt). */
const bloodColor = (pct: number) => mixColor(BIO.oksygenfattig, BIO.oksygenrikt, pct / 100);

/** Snittet av forskjellen vann − blod langs lamellen (drivkraften for diffusjonen). */
function meanDifference(p: GillProfile): number {
  const n = 50;
  let sum = 0;
  for (let i = 0; i <= n; i++) sum += p.water(i / n) - p.blood(i / n);
  return sum / (n + 1);
}

export default function GjellerMotstrom() {
  const [flow, setFlow] = useState<Flow>('motstrom');
  const [length, setLength] = useState(0.6);
  const [bloodIn, setBloodIn] = useState(20);
  const clock = useSimClock({ tMax: 600, loop: true });
  const p = useMemo(() => gillProfile({ flow, length, bloodIn }), [flow, length, bloodIn]);
  const other: Flow = flow === 'motstrom' ? 'medstrom' : 'motstrom';
  const q = useMemo(() => gillProfile({ flow: other, length, bloodIn }), [other, length, bloodIn]);
  const [ref, f] = useContainerTextScale<HTMLDivElement>();
  const ntu = length * NTU_PER_MM;
  const dMean = meanDifference(p);

  return (
    <VizLayout>
      <Toolbar>
        <Segmented label="Velg strømningsretning" options={FLOWS} value={flow} onChange={setFlow} />
      </Toolbar>
      <Controls>
        <Slider label="Lamellens lengde" value={length} onChange={setLength} min={0.1} max={1} step={0.05} unit="mm" decimals={2} />
        <Slider label="O₂-metning i blodet som kommer inn" value={bloodIn} onChange={setBloodIn} min={0} max={60} step={5} unit="%" />
      </Controls>
      <Toolbar>
        <PlayBar clock={clock} time={`${fmt(clock.t, 1)} s`} />
      </Toolbar>

      <div ref={ref}>
        <LamellaScene p={p} flow={flow} f={f} t={clock.t} length={length} />
      </div>
      <Legend
        items={[
          { color: C_WATER, label: 'Vann (strømmer alltid mot høyre)' },
          { color: C_BLOOD, label: 'O₂-molekyler (prikker) og oksygenrikt blod' },
          { color: BIO.oksygenfattig, label: 'Oksygenfattig blod' },
        ]}
      />

      <ProfilePlot p={p} q={q} flow={flow} />
      <Legend
        items={[
          { color: C_WATER, label: 'O₂ i vannet' },
          { color: C_BLOOD, label: 'O₂ i blodet' },
          { color: VIZ.muted, label: `Stiplet: samme lamell med ${FLOW_NAME[other]}`, dashed: true },
        ]}
      />

      <Readouts>
        <Readout label="O₂-metning i blodet ut" value={fmtPct(p.bloodOut / 100)} tone={bloodColor(p.bloodOut)} />
        <Readout label="Andel av O₂-et i vannet som tas opp" value={fmtPct(p.utilization)} tone={C_WATER} />
        <Readout label="Snittforskjell vann − blod" value={fmt(dMean, 0)} unit="prosentpoeng" />
        <Readout label={`Med ${FLOW_NAME[other]} i stedet`} value={fmtPct(q.bloodOut / 100)} unit="i blodet ut" />
      </Readouts>

      <Formula label="O₂ i blodet ut">
        {flow === 'motstrom' ? (
          <>
            <FormulaLine>
              Motstrøm: forskjellen er nesten lik hele veien: Δ = (100 − {fmt(bloodIn, 0)}) / (1 + {fmt(ntu, 1)}) ={' '}
              {fmt((100 - bloodIn) / (1 + ntu), 1)} prosentpoeng
            </FormulaLine>
            <FormulaLine>
              Blodet ut = 100 % − Δ = {fmtPct(p.bloodOut / 100)} (blodet møter hele tida vann med litt mer O₂)
            </FormulaLine>
          </>
        ) : (
          <>
            <FormulaLine>
              Medstrøm: forskjellen forsvinner langs lamellen. Blodet når høyst snittet: (100 + {fmt(bloodIn, 0)}) / 2 ={' '}
              {fmtPct(concurrentLimit(100, bloodIn) / 100)}
            </FormulaLine>
            <FormulaLine>Her: {fmtPct(p.bloodOut / 100)} i blodet ut, og vannet går ut med like mye O₂ som blodet</FormulaLine>
          </>
        )}
        <FormulaLine>
          Utvekslingsevne (NTU) = {fmt(NTU_PER_MM, 0)} per mm · {fmt(length, 2)} mm = {fmt(ntu, 1)}
        </FormulaLine>
      </Formula>

      <Explain>{explanation(flow, p, q, bloodIn, length)}</Explain>
    </VizLayout>
  );
}

/* ====================================================================== */
/* Lamellen                                                                 */
/* ====================================================================== */

/** Faste tilfeldige startplasser (0–1) for O₂-prikker og blodceller. */
const O2_DOTS = (() => {
  const r = seededRandom(17);
  return Array.from({ length: 70 }, () => ({ u: r(), v: r(), keep: r() }));
})();
const CELLS = (() => {
  const r = seededRandom(5);
  return Array.from({ length: 16 }, (_, i) => ({ u: (i + r() * 0.5) / 16, v: r() }));
})();

function LamellaScene({ p, flow, f, t, length }: { p: GillProfile; flow: Flow; f: number; t: number; length: number }) {
  const narrow = f > 1.3;
  const k = Math.max(1, f * 0.85);
  const gradId = useSvgId('lamell');
  // Til venstre (PC) eller øverst (mobil): gjellefilamentet med lamellene, så eleven ser hvor lamellen sitter
  const ctx = narrow ? { x: 20, y: 6, w: 760, h: 330 } : { x: 14, y: 14, w: 250, h: 250 };
  const x0 = narrow ? 30 : 300;
  const x1 = narrow ? 770 : 780;
  const W = x1 - x0;
  const top = narrow ? ctx.y + ctx.h + 24 : 0;
  const head = top + 30 * f;
  const wh = Math.round(84 + 70 * (f - 1));
  const bh = Math.round(64 + 60 * (f - 1));
  const wall = 10;
  const wTop = head + 18 * f;
  const bTop = wTop + wh + wall;
  const bBot = bTop + bh;
  const H = Math.round(Math.max(bBot + 40 * f + 18, narrow ? 0 : ctx.y + ctx.h + 10));
  const xs = narrow ? [0.14, 0.5, 0.86] : [0.1, 0.37, 0.63, 0.9];
  const blood = (u: number) => p.blood(u);
  const water = (u: number) => p.water(u);
  const bloodRight = flow === 'medstrom';
  // Vannet flytter seg like fort som blodet i figuren (bare retningen er forskjellig)
  const vw = 0.06;
  const stops = Array.from({ length: 11 }, (_, i) => i / 10);
  const bloodInX = bloodRight ? x0 : x1;
  const bloodOutX = bloodRight ? x1 : x0;
  const bloodInValue = blood(bloodRight ? 0 : 1);
  const label = `Gjellelamell med ${FLOW_NAME[flow]}. Vannet går inn med 100 % O₂ og ut med ${fmt(p.waterOut, 0)} %. Blodet går inn med ${fmt(
    bloodInValue,
    0,
  )} % og ut med ${fmt(p.bloodOut, 0)} %.`;

  return (
    <Figure
      viewBox={`0 0 800 ${H}`}
      maxHeight={narrow ? 1100 : H}
      label={label}
      caption={`${narrow ? 'Øverst' : 'Til venstre'}: et gjellefilament med lameller; vannet strømmer mellom lamellene. ${
        narrow ? 'Under' : 'Til høyre'
      }: den markerte lamellen forstørret (${fmt(length, 2)} mm lang). Tallene viser O₂-metningen i vannet og i blodet.`}
    >
      <defs>
        <linearGradient id={`${gradId}-b`} x1="0" x2="1" y1="0" y2="0">
          {stops.map((u) => (
            <stop key={u} offset={u} style={{ stopColor: bloodColor(blood(u)) }} />
          ))}
        </linearGradient>
      </defs>

      <GjelleFilament box={ctx} flow={flow} highlight />
      {!narrow && <line x1={284} x2={284} y1={20} y2={H - 20} stroke={VIZ.grid} strokeWidth={1.5} />}

      {/* Overskrifter: vann inn til venstre, vann ut til høyre */}
      <Txt x={x0} y={head} anchor="start" weight={700} color={C_WATER}>
        Vann inn 100 %
      </Txt>
      <Txt x={x1} y={head} anchor="end" weight={700} color={C_WATER}>
        Vann ut {fmt(p.waterOut, 0)} %
      </Txt>
      {!narrow && <Arrow x1={(x0 + x1) / 2 - 50} y1={head - 6 * f} x2={(x0 + x1) / 2 + 50} y2={head - 6 * f} color={C_WATER} width={3} head={11} />}

      {/* Vannet */}
      <rect x={x0} y={wTop} width={W} height={wh} rx={10} fill={BIO.vannFyll} />
      {O2_DOTS.map((d, i) => {
        const u = (d.u + vw * t) % 1;
        // Prikken er der bare hvis O₂ i vannet her er høyere enn «terskelen» dens: tettheten følger O₂-innholdet
        if (d.keep * 100 > water(u)) return null;
        // Prikkene holder seg i nedre del av vannet, så tallene øverst kan leses
        return <circle key={i} cx={x0 + 8 + (W - 16) * u} cy={wTop + wh * 0.46 + (wh * 0.54 - 10) * d.v} r={3.6 * k} fill={C_BLOOD} opacity={0.85} />;
      })}
      {/* Lamelleveggen (tynt epitel) */}
      <rect x={x0} y={wTop + wh} width={W} height={wall} fill={VIZ.bodyStrong} />
      {/* Blodet */}
      <rect x={x0} y={bTop} width={W} height={bh} rx={10} fill={`url(#${gradId}-b)`} opacity={0.35} />
      {CELLS.map((c, i) => {
        const dir = bloodRight ? 1 : -1;
        const u = (((c.u + dir * vw * t) % 1) + 1) % 1;
        const cx = x0 + 14 + (W - 28) * u;
        const cy = bTop + 6 + 6 * k + (bh * 0.5 - 12 * k) * c.v;
        return (
          <ellipse key={i} cx={cx} cy={cy} rx={9 * k} ry={5.5 * k} style={{ fill: bloodColor(blood(u)) }} stroke={VIZ.surface} strokeWidth={1.4} />
        );
      })}
      <rect x={x0} y={bTop} width={W} height={bh} rx={10} fill="none" stroke={VIZ.muted} strokeWidth={1.5} />
      <rect x={x0} y={wTop} width={W} height={wh} rx={10} fill="none" stroke={VIZ.muted} strokeWidth={1.5} />

      {/* Tall langs lamellen og diffusjonspiler (lengden følger forskjellen) */}
      {xs.map((u) => {
        const x = x0 + W * u;
        const w = water(u);
        const b = blood(u);
        const len = Math.max(0, Math.min(1, (w - b) / 50)) * (wh * 0.5);
        return (
          <g key={u}>
            <Txt x={x} y={wTop + 26 * f} weight={700} size={0.9} color={C_WATER}>
              {fmt(w, 0)} %
            </Txt>
            {len > 3 && (
              <Arrow x1={x} y1={wTop + wh - len - 2} x2={x} y2={wTop + wh + wall + 8} color={VIZ.ink} width={2.2} head={8} />
            )}
            <Txt x={x} y={bBot - 12 * f} weight={700} size={0.9}>
              {fmt(b, 0)} %
            </Txt>
          </g>
        );
      })}

      {/* Blodets retning og inn/ut */}
      {!narrow && (
        <Arrow
          x1={(x0 + x1) / 2 - (bloodRight ? 50 : -50)}
          y1={bBot + 22 * f}
          x2={(x0 + x1) / 2 + (bloodRight ? 50 : -50)}
          y2={bBot + 22 * f}
          color={bloodColor(70)}
          width={3}
          head={11}
        />
      )}
      <Txt x={bloodInX} y={bBot + 28 * f} anchor={bloodRight ? 'start' : 'end'} weight={700}>
        Blod inn {fmt(bloodInValue, 0)} %
      </Txt>
      <Txt x={bloodOutX} y={bBot + 28 * f} anchor={bloodRight ? 'end' : 'start'} weight={700} color={bloodColor(p.bloodOut)}>
        Blod ut {fmt(p.bloodOut, 0)} %
      </Txt>
    </Figure>
  );
}

/* ====================================================================== */
/* Graf langs lamellen                                                      */
/* ====================================================================== */

function ProfilePlot({ p, q, flow }: { p: GillProfile; q: GillProfile; flow: Flow }) {
  const [ref, f] = useContainerTextScale<HTMLDivElement>();
  const H = Math.round(320 + 260 * (f - 1));
  return (
    <div ref={ref}>
      <Figure
        viewBox={`0 0 800 ${H}`}
        label={`O₂ i vann og blod langs lamellen med ${FLOW_NAME[flow]}. Blodet ut har ${fmt(p.bloodOut, 0)} % O₂-metning.`}
      >
        <Plot
          x={{ min: 0, max: 1, label: f > 1.3 ? 'Langs lamellen →' : 'Langs lamellen (vannet kommer inn til venstre)', ticks: [] }}
          y={{ min: 0, max: 100, label: 'O₂-metning (%)', ticks: [0, 25, 50, 75, 100] }}
          width={800}
          height={H}
        >
          {({ sx, sy }) => <ProfileLines p={p} q={q} flow={flow} sx={sx} sy={sy} />}
        </Plot>
      </Figure>
    </div>
  );
}

function ProfileLines({ p, q, flow, sx, sy }: { p: GillProfile; q: GillProfile; flow: Flow; sx: (v: number) => number; sy: (v: number) => number }) {
  const f = useTextScale();
  const wPts = sample(p.water, 0, 1, 80);
  const bPts = sample(p.blood, 0, 1, 80);
  const area = `${linePath(wPts, sx, sy)} L${[...bPts]
    .reverse()
    .map(([x, y]) => `${sx(x).toFixed(1)},${sy(y).toFixed(1)}`)
    .join(' L')} Z`;
  const bloodRight = flow === 'medstrom';
  const outX = bloodRight ? 1 : 0;
  // Pilspisser midt på linjene viser strømningsretningen
  const tri = (fn: (x: number) => number, dir: 1 | -1, color: string) => {
    const xa = 0.5 - 0.02 * dir;
    const xb = 0.5 + 0.02 * dir;
    const ang = (Math.atan2(sy(fn(xb)) - sy(fn(xa)), sx(xb) - sx(xa)) * 180) / Math.PI;
    return (
      <polygon
        points="9,0 -6,-7 -6,7"
        transform={`translate(${sx(0.5).toFixed(1)} ${sy(fn(0.5)).toFixed(1)}) rotate(${ang.toFixed(1)})`}
        fill={color}
      />
    );
  };
  return (
    <g>
      <path d={area} fill={C_BLOOD} opacity={0.08} />
      <path d={linePath(sample(q.water, 0, 1, 80), sx, sy)} fill="none" stroke={C_WATER} strokeWidth={2} strokeDasharray="7 6" opacity={0.6} />
      <path d={linePath(sample(q.blood, 0, 1, 80), sx, sy)} fill="none" stroke={C_BLOOD} strokeWidth={2} strokeDasharray="7 6" opacity={0.6} />
      <path d={linePath(wPts, sx, sy)} fill="none" stroke={C_WATER} strokeWidth={3.5} />
      <path d={linePath(bPts, sx, sy)} fill="none" stroke={C_BLOOD} strokeWidth={3.5} />
      {tri(p.water, 1, C_WATER)}
      {tri(p.blood, bloodRight ? 1 : -1, C_BLOOD)}
      <circle cx={sx(outX)} cy={sy(p.bloodOut)} r={7} fill={C_BLOOD} stroke={VIZ.surface} strokeWidth={2.5} />
      <Txt
        x={sx(outX) + (bloodRight ? -12 : 12)}
        y={sy(p.bloodOut) + (bloodRight ? -14 : 30 * f)}
        anchor={bloodRight ? 'end' : 'start'}
        weight={700}
        color={C_BLOOD}
        size={0.9}
      >
        blodet ut: {fmt(p.bloodOut, 0)} %
      </Txt>
    </g>
  );
}

/* ====================================================================== */
/* Forklaring                                                               */
/* ====================================================================== */

function explanation(flow: Flow, p: GillProfile, q: GillProfile, bloodIn: number, length: number): ReactNode {
  const general = (
    <p>
      O₂ diffunderer alltid fra høy til lav konsentrasjon, og jo større forskjellen er, jo raskere går det. Vann har omtrent 30 ganger mindre
      O₂ enn luft, så fisken må få mest mulig ut av vannet som strømmer over gjellene. Samme motstrømsprinsipp finnes også andre steder, for
      eksempel i beina til fugler, der varmt blod på vei ut varmer opp kaldt blod på vei tilbake. Modellen er forenklet: blodets O₂-metning
      følger O₂-innholdet i vannet som en rett linje, og vann og blod frakter like mye O₂ per tid.
    </p>
  );
  if (flow === 'motstrom')
    return (
      <>
        <p>
          <strong>Motstrøm: blodet og vannet strømmer hver sin vei.</strong> Blodet som nettopp har kommet inn ({fmt(bloodIn, 0)} %), møter
          vann som allerede har gitt fra seg mye O₂, men som likevel har mer O₂ enn blodet. Lenger fram møter blodet stadig friskere vann. Derfor
          er det en forskjell som driver diffusjonen <strong>langs hele lamellen</strong>, og blodet går ut med {fmtPct(p.bloodOut / 100)}{' '}
          O₂-metning, nær de 100 % i vannet som kommer inn.
        </p>
        <p>
          Med medstrøm ville den samme lamellen bare gitt {fmtPct(q.bloodOut / 100)}. Fisken tar på denne måten opp {fmtPct(p.utilization)} av
          O₂-et i vannet{p.utilization > 0.6 ? ', langt mer enn vi klarer med lungene (ca. 25 % av O₂-et i lufta)' : ''}.
          {length < 0.3 ? ' Lamellen er svært kort nå, så det er lite tid og overflate til diffusjon uansett retning.' : ''}
        </p>
        {general}
      </>
    );
  return (
    <>
      <p>
        <strong>Medstrøm: blodet og vannet strømmer samme vei.</strong> Ved inngangen er forskjellen stor, og O₂ diffunderer raskt inn i blodet.
        Men vannet tømmes og blodet fylles samtidig, så forskjellen forsvinner. Når vann og blod har like mye O₂, stopper diffusjonen: blodet kan
        aldri bli mer mettet enn snittet av vannet og blodet som kom inn, her {fmtPct(concurrentLimit(100, bloodIn) / 100)}
        {bloodIn > 0 ? ' (med helt oksygenfattig blod inn ville grensen vært 50 %)' : ''}.
      </p>
      <p>
        Blodet går ut med {fmtPct(p.bloodOut / 100)}, og bare {fmtPct(p.utilization)} av O₂-et i vannet blir tatt opp. Med motstrøm ville den
        samme lamellen gitt {fmtPct(q.bloodOut / 100)}. {length > 0.4 ? 'En lengre lamell hjelper nesten ikke: grensen er nådd.' : ''}
      </p>
      {general}
    </>
  );
}
