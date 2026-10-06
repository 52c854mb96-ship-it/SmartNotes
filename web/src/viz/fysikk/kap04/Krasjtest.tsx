import { useEffect, useState, type ReactNode } from 'react';
import {
  Controls,
  Explain,
  Figure,
  Formula,
  FormulaLine,
  Legend,
  PlayControls,
  Plot,
  Readout,
  Readouts,
  Segmented,
  Slider,
  Sub,
  TSub,
  Toolbar,
  Txt,
  VIZ,
  VizLayout,
  fmt,
  linePath,
  useSimClock,
  useSvgId,
  useTextScale,
} from '../../kit';
import { Dimension } from '../../kit/scene';
import { CrashScene, crashLayout, useCrashFrame } from './krasjtest-scene';
import {
  CRUSH,
  RESTRAINTS,
  RESTRAINT_ORDER,
  SPEED_KMH,
  STIFF_CRUSH,
  T_END,
  crash,
  forceAt,
  forceAxisMax,
  forceAxisTicks,
  forceSteps,
  kmh,
  weightEquivalent,
  type CrashResult,
  type Restraint,
} from './model-krasjtest';
import { useNarrow } from './useNarrow';

/** Korte navn på sikringene i grafen. */
const SHORT: Record<Restraint, string> = { ingen: 'uten belte', belte: 'bilbelte', pute: 'belte og pute' };

/** Tall med `n` gjeldende siffer (men aldri desimaler på store tall): 0,1224 · 8,85 · 150. */
function sig(v: number, n = 3): string {
  if (!Number.isFinite(v) || v === 0) return fmt(v, 0);
  const d = Math.max(0, n - 1 - Math.floor(Math.log10(Math.abs(v))));
  return fmt(v, d);
}

/** Kraft i kN med tre gjeldende siffer. */
const kN = (F: number) => `${sig(F / 1000, 3)} kN`;
/** Tid i ms: én desimal under 10 ms. */
const ms = (t: number) => fmt(t * 1000, t < 0.01 ? 1 : 0);

/**
 * Krasjtest (4A, 4B): en bil kjører rett inn i en betongvegg. Knusesonen, bilbeltet og kollisjonsputa forlenger
 * strekningen og tiden passasjeren bremses over, og impulsloven gir gjennomsnittskraften og «g-kreftene».
 */
export default function Krasjtest() {
  const [speed, setSpeed] = useState<number>(SPEED_KMH.initial);
  const [crush, setCrush] = useState<number>(CRUSH.initial);
  const [restraint, setRestraint] = useState<Restraint>('pute');
  // Sakte film: 0,25 s krasj tar 5 s å spille av. Figuren starter når alt har stoppet.
  const clock = useSimClock({ tMax: T_END, speed: 0.05 });
  const { setT } = clock;
  useEffect(() => setT(T_END), [setT]);
  const t = clock.t;

  const v0 = kmh(speed);
  const r = crash(v0, crush, restraint);
  const others = RESTRAINT_ORDER.filter((x) => x !== restraint).map((x) => crash(v0, crush, x));
  const [sceneRef, frame] = useCrashFrame<HTMLDivElement>();
  const layout = crashLayout(frame.f, frame.crop);
  const [graphRef, narrow] = useNarrow<HTMLDivElement>();
  const graphH = narrow ? 470 : 320;
  const spec = RESTRAINTS[restraint];
  const belted = restraint !== 'ingen';
  const showCursor = clock.playing || t < T_END - 1e-6;

  const sceneLabel =
    `Krasjtest: en bil i ${speed} kilometer i timen kjører inn i en betongvegg, og fronten presses sammen ${fmt(crush, 2)} meter. ` +
    (belted
      ? `Passasjeren har ${restraint === 'pute' ? 'belte og kollisjonspute' : 'bilbelte'} og bremses over ${fmt(r.sBrake, 2)} meter på ${ms(r.dt)} millisekunder.`
      : `Passasjeren har verken belte eller kollisjonspute, flyr fram i bilen og stoppes mot frontruta og dashbordet på ${fmt(r.sBrake * 100, 0)} centimeter.`);

  return (
    <VizLayout>
      <Controls>
        <Slider label="Fart før treffet" value={speed} onChange={setSpeed} min={SPEED_KMH.min} max={SPEED_KMH.max} step={SPEED_KMH.step} unit="km/h" />
        <Slider label="Knusesone d" value={crush} onChange={setCrush} min={CRUSH.min} max={CRUSH.max} step={CRUSH.step} unit="m" decimals={2} />
      </Controls>
      <Toolbar>
        <Segmented
          label="Sikring for passasjeren"
          options={RESTRAINT_ORDER.map((x) => ({ value: x, label: RESTRAINTS[x].label }))}
          value={restraint}
          onChange={setRestraint}
        />
        <PlayControls clock={clock} decimals={3} />
      </Toolbar>

      <div ref={sceneRef}>
        <Figure viewBox={layout.viewBox} label={sceneLabel} maxHeight={480}>
          <CrashScene r={r} t={t} f={frame.f} crop={frame.crop} />
        </Figure>
      </div>

      <div ref={graphRef}>
        <Figure viewBox={`0 0 800 ${graphH}`} label="Graf over kraften på passasjeren mot tiden etter treffet. Arealet under grafen er endringen i bevegelsesmengde.">
          <ForceGraph r={r} others={others} t={t} height={graphH} showCursor={showCursor} />
        </Figure>
      </div>
      <Legend
        items={[
          { color: VIZ.velocity, label: 'Fart v' },
          { color: VIZ.applied, label: 'Kraft på passasjeren F (arealet under grafen er Δp)' },
          { color: VIZ.muted, dashed: true, label: 'Samme krasj med de andre sikringene' },
          { color: VIZ.velocity, dashed: true, label: 'Bilen står stille (v = 0)' },
        ]}
      />

      <Readouts>
        <Readout label="Bremsestrekning s" value={fmt(r.sBrake, 2)} unit="m" />
        <Readout label="Stoppetid Δt" value={ms(r.dt)} unit="ms" />
        <Readout
          label={
            <span>
              Gjennomsnittskraft F<Sub>gj</Sub>
            </span>
          }
          value={sig(r.F / 1000, 3)}
          unit="kN"
          tone={VIZ.applied}
        />
        <Readout label="«g-krefter» a/g" value={sig(r.g, 3)} unit="g" />
      </Readouts>

      <Formula label="Impulsloven med levende tall">
        <FormulaLine>
          Δp = m · v = {fmt(r.m, 0)} kg · {fmt(v0, 2)} m/s = {fmt(r.dp, 0)} N·s
        </FormulaLine>
        <FormulaLine>
          {belted ? (
            <>
              s = d + Δx = {fmt(crush, 2)} m + {fmt(spec.stroke, 2)} m = {fmt(r.sBrake, 2)} m
            </>
          ) : (
            <>s = {fmt(r.sBrake, 2)} m (bare hodet, ruta og dashbordet gir etter)</>
          )}
        </FormulaLine>
        <FormulaLine>
          Δt = 2s / v = 2 · {fmt(r.sBrake, 2)} m / {fmt(v0, 2)} m/s = {sig(r.dt, 3)} s
        </FormulaLine>
        <FormulaLine>
          F<Sub>gj</Sub> = Δp / Δt = {fmt(r.dp, 0)} N·s / {sig(r.dt, 3)} s = {kN(r.F)}
        </FormulaLine>
        <FormulaLine>
          a / g = F<Sub>gj</Sub> / (m · g) = {fmt(r.F, 0)} N / ({fmt(r.m, 0)} kg · 9,81 m/s²) = {sig(r.g, 3)}
        </FormulaLine>
      </Formula>

      <Explain>{explanation(r, speed)}</Explain>
    </VizLayout>
  );
}

/* ---------- Grafen ---------- */

function ForceGraph({ r, others, t, height, showCursor }: { r: CrashResult; others: CrashResult[]; t: number; height: number; showCursor: boolean }) {
  const f = useTextScale();
  const clipId = useSvgId('krasj-graf');
  const yMax = forceAxisMax(r.v0);
  const ticks = forceAxisTicks(yMax);
  const steps = (c: CrashResult): [number, number][] => forceSteps(c).map(([tt, F]) => [tt * 1000, F / 1000]);
  return (
    <Plot
      x={{ min: 0, max: T_END * 1000, label: 'Tid etter treffet t (ms)', ticks: [0, 50, 100, 150, 200, 250] }}
      y={{ min: 0, max: yMax, label: 'Kraft F (kN)', ticks }}
      width={800}
      height={height}
    >
      {({ sx, sy, x0, x1, y0, y1 }) => {
        const top = y1 - 4;
        const over = (c: CrashResult) => c.Fmax / 1000 > yMax;
        const fy = (c: CrashResult) => Math.max(top, sy(c.F / 1000));
        const all = [r, ...others];
        const inside = all.filter((c) => !over(c));
        /** Omtrentlig bredde av en tekst med `chars` tegn. */
        const textW = (chars: number, size = 1) => chars * 17 * size * f * 0.56;
        const lineH = 22 * f;
        const areaText = `areal = Δp = ${fmt(r.dp, 0)} N·s`;
        const fChars = 6 + kN(r.F).length;

        // F_gj og arealet: ved siden av støtet uten belte, i en kolonne til høyre for grafene, eller over dem.
        let lx: number;
        let ly: number;
        let anchor: 'start' | 'middle' = 'start';
        let areaY: number;
        let leader = false;
        if (over(r)) {
          lx = sx(r.tStop * 1000) + 10;
          ly = y1 + 18 * f;
          areaY = ly + lineH;
        } else {
          const right = Math.max(...inside.map((c) => sx(c.tStop * 1000)));
          const colX = right + 12;
          if (colX + Math.max(textW(fChars), textW(areaText.length, 0.85)) <= x1) {
            lx = colX;
            ly = clamp(fy(r) + 6 * f, y1 + 16 * f, y0 - 2 * lineH - 8);
            areaY = ly + lineH;
            leader = colX - sx(r.tStop * 1000) > 24;
          } else {
            const highest = Math.min(...inside.map(fy));
            lx = sx(((r.tStart + r.tStop) / 2) * 1000);
            anchor = 'middle';
            ly = highest - 10;
            areaY = ly - lineH;
          }
        }

        // Navn på de andre sikringene: første plass som ikke kolliderer med de andre etikettene eller toppen uten belte.
        type Box = { x0: number; x1: number; y0: number; y1: number };
        const box = (x: number, y: number, w: number, a: 'start' | 'middle'): Box => ({
          x0: a === 'start' ? x - 2 : x - w / 2 - 2,
          x1: a === 'start' ? x + w + 2 : x + w / 2 + 2,
          y0: y - 14 * f,
          y1: y + 5 * f,
        });
        const hits = (p: Box, q: Box) => p.x0 < q.x1 && q.x0 < p.x1 && p.y0 < q.y1 && q.y0 < p.y1;
        const taken: Box[] = [box(lx, ly, textW(fChars), anchor), box(lx, areaY, textW(areaText.length, 0.85), anchor)];
        const spike = (c: CrashResult): Box => ({ x0: sx(c.tStart * 1000) - 5, x1: sx(c.tStop * 1000) + 5, y0: y1, y1: y0 });
        if (over(r)) taken.push(spike(r));
        const spikes = new Map(others.filter(over).map((c) => [c, spike(c)] as const));
        taken.push(...spikes.values());
        const otherLabels = others.map((c) => {
          const text = over(c) ? `${SHORT[c.restraint]}: ${kN(c.F)} ↑` : SHORT[c.restraint];
          const w = textW(text.length, 0.8);
          const right = sx(c.tStop * 1000) + 6;
          const left = sx(c.tStart * 1000) + 10;
          const yTop = fy(c);
          // Til høyre for alle toppene uten belte, hvis de står i veien
          const clear = Math.max(right, ...[...spikes.values(), ...(over(r) ? [spike(r)] : [])].map((b) => b.x1 + 4));
          const candidates: [number, number][] = over(c)
            ? [0, 1, 2, 3].map((i) => [right, y1 + 16 * f + i * lineH])
            : [
                [left, yTop - 7],
                [right, yTop - 7],
                [left, yTop + 17 * f],
                [right, yTop + 17 * f],
                [clear, yTop - 7],
                [clear, yTop + 17 * f],
                [clear, yTop + 17 * f + lineH],
              ];
          const own = spikes.get(c);
          const ok = (x: number, y: number) =>
            x + w <= x1 && y - 14 * f >= y1 - 6 && y <= y0 - 4 && !taken.some((t) => t !== own && hits(box(x, y, w, 'start'), t));
          const [x, y] = candidates.find(([cx, cy]) => ok(cx, cy)) ?? candidates[0]!;
          // Spissen uten belte er smal, så navnet kan stå ved siden av den selv om det krysser andre streker.
          if (!over(c)) taken.push(box(x, y, w, 'start'));
          return { c, x, y, text };
        });

        const dtX0 = sx(r.tStart * 1000);
        const dtX1 = sx(r.tStop * 1000);
        const dtLabel = `Δt = ${ms(r.dt)} ms`;
        const dtFits = dtX1 - dtX0 > textW(dtLabel.length, 0.8) + 12;
        const dtY = y0 - 12 * f;
        const tCar = sx(r.car.t * 1000);
        const cursorF = forceAt(r, t) / 1000;
        return (
          <g>
            <defs>
              <clipPath id={clipId}>
                <rect x={x0} y={top} width={x1 - x0} height={y0 - top + 2} />
              </clipPath>
            </defs>
            {/* Når bilen står stille */}
            <line x1={tCar} y1={y0} x2={tCar} y2={y1} stroke={VIZ.velocity} strokeWidth={2} strokeDasharray="4 4" opacity={0.85} />
            <g clipPath={`url(#${clipId})`}>
              {others.map((c) => (
                <path key={c.restraint} d={linePath(steps(c), sx, sy)} fill="none" stroke={VIZ.muted} strokeWidth={1.8} strokeDasharray="6 5" />
              ))}
              <path d={`${linePath(steps(r), sx, sy)} L ${sx(T_END * 1000)} ${sy(0)} L ${sx(0)} ${sy(0)} Z`} fill={VIZ.applied} opacity={0.17} />
              <path d={linePath(steps(r), sx, sy)} fill="none" stroke={VIZ.applied} strokeWidth={3.5} strokeLinejoin="round" />
            </g>
            {over(r) && <Break x={(dtX0 + dtX1) / 2} y={top + 18} w={Math.max(18, dtX1 - dtX0 + 12)} />}
            {otherLabels.map(({ c, x, y, text }) => (
              <Txt key={c.restraint} x={x} y={y} anchor="start" size={0.8} muted>
                {text}
              </Txt>
            ))}
            {leader && <line x1={sx(r.tStop * 1000) + 3} y1={fy(r)} x2={lx - 4} y2={fy(r)} stroke={VIZ.applied} strokeWidth={1.3} strokeDasharray="2 3" />}
            <Txt x={lx} y={ly} anchor={anchor} color={VIZ.applied} weight={720}>
              F<TSub>gj</TSub> = {kN(r.F)}
              {over(r) ? ' ↑' : ''}
            </Txt>
            <Txt x={lx} y={areaY} anchor={anchor} size={0.85} weight={600}>
              {areaText}
            </Txt>
            <Dimension x1={dtX0} y1={dtY} x2={dtX1} y2={dtY} label={dtFits ? dtLabel : undefined} color={VIZ.ink} labelSize={0.8} />
            {!dtFits && (
              <Txt x={dtX1 + 6} y={dtY + 5 * f} anchor="start" size={0.8} weight={650}>
                {dtLabel}
              </Txt>
            )}
            {showCursor && (
              <g>
                <line x1={sx(t * 1000)} y1={y0} x2={sx(t * 1000)} y2={y1} stroke={VIZ.ink} strokeWidth={1.5} opacity={0.7} />
                <circle cx={sx(t * 1000)} cy={Math.max(top, sy(cursorF))} r={6} fill={VIZ.applied} stroke={VIZ.surface} strokeWidth={2} />
              </g>
            )}
          </g>
        );
      }}
    </Plot>
  );
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** Brudd i en søyle som går over grafen: to skrå streker i bakgrunnsfargen. */
function Break({ x, y, w }: { x: number; y: number; w: number }) {
  const d = `M${x - w / 2},${y + 4}L${x + w / 2},${y - 4}M${x - w / 2},${y + 11}L${x + w / 2},${y + 3}`;
  return (
    <g>
      <path d={d} stroke={VIZ.surface} strokeWidth={5} />
      <path d={d} stroke={VIZ.applied} strokeWidth={1.4} />
    </g>
  );
}

/* ---------- Forklaringen ---------- */

function explanation(r: CrashResult, speed: number): ReactNode {
  const spec = RESTRAINTS[r.restraint];
  const stiff = crash(r.v0, CRUSH.min, r.restraint);
  const modern = crash(r.v0, CRUSH.initial, r.restraint);
  const kg = weightEquivalent(r.F);
  const tonn = kg >= 1000;
  const weight = tonn ? `${sig(kg / 1000, 2)} tonn` : `${fmt(Math.round(kg / 10) * 10, 0)} kg`;
  const g = sig(r.g, 3);

  const main =
    r.restraint === 'ingen' ? (
      <p>
        <strong>Uten belte følger ikke passasjeren med når bilen bremser.</strong> Ingenting holder igjen, så hen fortsetter med {speed} km/h
        (Newtons 1. lov) mens fronten presses sammen. Etter {ms(r.tStart)} ms treffer hen frontruta og dashbordet. Da har bilen allerede stått
        stille i {ms(r.tStart - r.car.t)} ms, så knusesonen har ikke hjulpet passasjeren i det hele tatt. Hen stoppes på bare{' '}
        {fmt(r.sBrake * 100, 0)} cm og {ms(r.dt)} ms, og kraften blir {kN(r.F)}: {g} g, like mye som tyngden av {weight}.
      </p>
    ) : (
      <p>
        <strong>
          {r.restraint === 'pute' ? 'Med belte og kollisjonspute' : 'Med bilbelte'} bremses passasjeren over {fmt(r.sBrake, 2)} m:
        </strong>{' '}
        {fmt(r.d, 2)} m fordi fronten på bilen presses sammen, og {fmt(spec.stroke, 2)} m fordi beltet strekkes
        {r.restraint === 'pute' ? ' og puta presses sammen' : ''} (den stiplede sirkelen viser hvor hodet hadde vært om passasjeren hadde fulgt
        bilen). Det tar {ms(r.dt)} ms, og
        gjennomsnittskraften blir {kN(r.F)}, like mye som tyngden av {weight}. «{g} g» betyr at bremsingen er {g} ganger
        tyngdeakselerasjonen, så beltet må dra i deg med {g} ganger tyngden din. En «g-kraft» er altså ikke en egen kraft.
      </p>
    );

  const [gIngen, gBelte, gPute] = RESTRAINT_ORDER.map((x) => sig(crash(r.v0, r.d, x).g, 3));
  const impulse = (
    <p>
      Δp = m · v = {fmt(r.dp, 0)} N·s er den samme uansett bil og sikring, for farten skal fra {speed} km/h til null. Arealet under F–t-grafen
      er derfor like stort for alle tre. Det eneste vi kan påvirke, er stoppetiden: F<Sub>gj</Sub> = Δp/Δt, så lang tid gir liten kraft. I
      denne bilen og farten gir det {gIngen} g uten belte og pute, {gBelte} g med bilbelte og {gPute} g med belte og pute.
      {r.restraint === 'belte'
        ? ' Kollisjonsputa gir noen centimeter til å bremse på, og den fordeler kraften på hodet og brystet.'
        : r.restraint === 'ingen'
          ? ' Kollisjonsputa er laget for å virke sammen med beltet: uten belte kan du treffe den mens den blåses opp.'
          : ''}
    </p>
  );

  const car =
    r.restraint === 'ingen' ? null : r.d <= STIFF_CRUSH ? (
      <p>
        <strong>Stiv bil:</strong> fronten gir bare etter {fmt(r.d, 2)} m, så bilen stopper på {ms(r.car.t)} ms. Selv med{' '}
        {r.restraint === 'pute' ? 'belte og pute' : 'belte'} blir det {g} g, mot {sig(modern.g, 3)} g med en knusesone på {fmt(CRUSH.initial, 2)} m.
        En bil som knapt blir bulkete, er altså farligere for dem som sitter i den: knusesonen skal ødelegges, så du ikke blir det. Kupeen
        skal derimot være stiv, så den ikke klemmes inn mot passasjerene.
      </p>
    ) : (
      <p>
        I en stiv bil som bare gir etter {fmt(CRUSH.min, 2)} m, ville det samme krasjet gitt {sig(stiff.g, 3)} g i stedet for {g} g. Knusesonen er
        laget for å ødelegges, så passasjerene ikke blir det.
      </p>
    );

  const ratio = (speed / 50) ** 2;
  const fast =
    speed !== 50 ? (
      <p>
        Kraften øker med kvadratet av farten (F<Sub>gj</Sub> = mv²/2s): {speed} km/h gir ({speed}/50)² = {fmt(ratio, 2)} ganger så stor kraft
        som 50 km/h med samme bremsestrekning.
      </p>
    ) : null;

  return (
    <>
      {main}
      {impulse}
      {car}
      {fast}
      <p>Modellen antar jevn oppbremsing. I et ekte krasj varierer kraften, og toppen blir høyere enn gjennomsnittet.</p>
    </>
  );
}
