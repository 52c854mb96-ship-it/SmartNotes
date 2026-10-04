import { useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  BIO,
  Controls,
  Explain,
  Figure,
  Forvalg,
  Formula,
  FormulaLine,
  Legend,
  Menneske,
  PlayBar,
  Plot,
  Readout,
  Readouts,
  Slider,
  Sub,
  Toolbar,
  Txt,
  VIZ,
  VizLayout,
  fmt,
  fmtPct,
  linePath,
  points,
  sample,
  useContainerTextScale,
  useSimClock,
  useTextScale,
} from '../kit';
import { DISEASES, INFECTIOUS_DAYS, POPULATION, countsAt, epidemic, people, personStates, type Epidemic, type PersonState } from './model';

const C = BIO.sir;
const STATE_COLOR: Record<PersonState, string> = { S: C.S, I: C.I, R: C.R, V: C.V };

/** Sekunder en hel epidemi tar å spille av. */
const PLAY_SECONDS = 12;

export default function Flokkimmunitet() {
  const [R0, setR0] = useState(3);
  const [p, setP] = useState(0.4);
  const [e, setE] = useState(1);
  const ep = useMemo(() => epidemic({ R0, p, e }), [R0, p, e]);
  const list = useMemo(() => people({ p, e }), [p, e]);
  const clock = useSimClock({ tMax: ep.tMax, speed: ep.tMax / PLAY_SECONDS });
  const { setT, pause } = clock;
  // Vis slutten av epidemien når siden åpnes og når du endrer noe (trykk «Spill av» for å se forløpet)
  useEffect(() => {
    pause();
    setT(ep.tMax);
  }, [ep, pause, setT]);
  const t = Math.min(clock.t, ep.tMax);
  const counts = countsAt(ep.series, t);
  const states = personStates(list, counts.ever, counts.recovered);
  const [gridRef, f] = useContainerTextScale<HTMLDivElement>();
  const preset = DISEASES.find((d) => Math.abs(d.R0 - R0) < 1e-9)?.id ?? null;
  const nI = states.filter((s) => s === 'I').length;
  const nVaccNotImmune = list.filter((x) => x.vaccinated && !x.immune).length;

  return (
    <VizLayout>
      <Toolbar>
        <Forvalg
          label="Sykdom"
          options={DISEASES.map((d) => ({ value: d.id, label: d.name, detail: `R₀ ≈ ${fmt(d.R0, d.R0 % 1 ? 1 : 0)}` }))}
          value={preset}
          onPick={(id) => setR0(DISEASES.find((d) => d.id === id)!.R0)}
        />
      </Toolbar>
      <Controls>
        <Slider
          label={
            <>
              Basisreproduksjonstall R<Sub>0</Sub>
            </>
          }
          ariaLabel="Basisreproduksjonstall"
          value={R0}
          onChange={setR0}
          min={1}
          max={18}
          step={0.1}
          decimals={1}
        />
        <Slider
          label="Vaksinasjonsdekning p"
          value={Math.round(p * 100)}
          onChange={(v) => setP(v / 100)}
          min={0}
          max={100}
          step={1}
          unit="%"
        />
        <Slider
          label="Vaksinens effekt e"
          value={Math.round(e * 100)}
          onChange={(v) => setE(v / 100)}
          min={50}
          max={100}
          step={1}
          unit="%"
        />
        <Slider
          label="Tid"
          ariaLabel="Tid i døgn"
          value={Math.round(t)}
          onChange={(v) => {
            pause();
            setT(v);
          }}
          min={0}
          max={ep.tMax}
          step={1}
          format={(v) => `dag ${fmt(v, 0)}`}
        />
      </Controls>
      <Toolbar>
        <PlayBar clock={clock} time={`dag ${fmt(t, 0)}`} />
      </Toolbar>

      <div ref={gridRef}>
        <PeopleGrid states={states} vaccinated={list.map((x) => x.vaccinated && !x.immune)} narrow={f > 1.3} day={t} nI={nI} />
      </div>
      <Legend
        items={[
          { color: C.S, label: 'Mottakelig (frisk)' },
          { color: C.I, label: 'Smittet' },
          { color: C.R, label: 'Immun etter sykdom' },
          { color: C.V, label: 'Vaksinert og immun' },
          ...(nVaccNotImmune > 0 ? [{ color: C.V, label: 'Prikk: vaksinert, men ikke beskyttet', dashed: true }] : []),
        ]}
      />

      <SirFigure ep={ep} t={t} p={p} e={e} />
      <Legend
        items={[
          { color: C.S, label: 'Mottakelige S' },
          { color: C.I, label: 'Smittet I' },
          { color: C.R, label: 'Immune etter sykdom R' },
          { color: C.V, label: 'Vaksinert og immun', dashed: true },
        ]}
      />

      <ThresholdFigure R0={R0} p={p} e={e} herd={ep.herd} />
      <Legend
        items={[
          {
            color: VIZ.ink,
            label: (
              <span>
                Flokkimmunitetsgrensen p<Sub>c</Sub> = 1 − 1/R<Sub>0</Sub>
              </span>
            ),
          },
          ...(e < 1 ? [{ color: VIZ.ink, label: `Nødvendig dekning med vaksineeffekt ${fmtPct(e)}`, dashed: true }] : []),
          { color: C.V, label: 'Lilla felt: flokkimmunitet' },
        ]}
      />

      <Readouts>
        <Readout
          label={
            <>
              Grense for flokkimmunitet p<Sub>c</Sub>
            </>
          }
          value={fmtPct(ep.pc)}
          tone={C.V}
        />
        <Readout label="R ved start" value={fmt(ep.Re0, 2)} tone={ep.herd ? C.R : C.I} />
        <Readout
          label="Flest smittet samtidig"
          value={fmtPct(ep.peak, ep.peak < 0.1 ? 1 : 0)}
          unit={ep.herd ? 'ved start' : `dag ${fmt(ep.peakTime, 0)}`}
          tone={C.I}
        />
        <Readout label="Uvaksinerte som ble smittet" value={fmtPct(ep.attackUnvaccinated)} tone={C.I} />
      </Readouts>

      <Formula label="Flokkimmunitet">
        <FormulaLine>
          p<Sub>c</Sub> = 1 − 1/R<Sub>0</Sub> = 1 − 1/{fmt(R0, 1)} = {fmtPct(ep.pc, 1)}
        </FormulaLine>
        {e < 1 && (
          <FormulaLine>
            Nødvendig dekning = p<Sub>c</Sub> / e = {fmtPct(ep.pc, 1)} / {fmtPct(e)} ={' '}
            {Number.isFinite(ep.required) ? fmtPct(ep.required, 1) : '–'}
            {ep.required > 1 ? ' (over 100 %: umulig)' : ''}
          </FormulaLine>
        )}
        <FormulaLine>
          R = R<Sub>0</Sub> · (1 − p · e) = {fmt(R0, 1)} · (1 − {fmt(p, 2)} · {fmt(e, 2)}) = {fmt(ep.Re0, 2)}{' '}
          {ep.herd ? '≤ 1: smitten dør ut' : '> 1: smitten sprer seg'}
        </FormulaLine>
      </Formula>

      <Explain>{explanation(ep, R0, p, e)}</Explain>
    </VizLayout>
  );
}

/* ---------- Rutenett med individer ---------- */

function PeopleGrid({
  states,
  vaccinated,
  narrow,
  day,
  nI,
}: {
  states: PersonState[];
  vaccinated: boolean[];
  narrow: boolean;
  day: number;
  nI: number;
}) {
  const cols = narrow ? 20 : 40;
  const rows = Math.ceil(POPULATION / cols);
  const cell = 760 / cols;
  const H = Math.round(rows * cell + 16);
  const size = cell * 0.88;
  const counts = { S: 0, I: 0, R: 0, V: 0 };
  for (const s of states) counts[s]++;
  return (
    <Figure
      viewBox={`0 0 800 ${H}`}
      maxHeight={narrow ? 900 : H}
      label={`${POPULATION} personer på dag ${fmt(day, 0)}: ${counts.S} mottakelige, ${counts.I} smittet, ${counts.R} immune etter sykdom og ${counts.V} vaksinert og immune.`}
      caption={`Hver figur er én av ${POPULATION} personer. ${nI === 0 ? 'Ingen er smittet akkurat nå.' : `${nI} er smittet akkurat nå.`}`}
    >
      {states.map((s, i) => {
        const x = 20 + (i % cols) * cell + cell / 2;
        const y = 8 + Math.floor(i / cols) * cell + cell / 2;
        const col = STATE_COLOR[s];
        return (
          <g key={i}>
            <Menneske x={x} y={y} size={size} paint={{ fill: col, line: col }} />
            {vaccinated[i] && (
              <circle cx={x + size * 0.36} cy={y - size * 0.3} r={size * 0.14} fill={C.V} stroke={VIZ.surface} strokeWidth={1.2} />
            )}
          </g>
        );
      })}
    </Figure>
  );
}

/* ---------- S, I og R over tid ---------- */

function SirFigure({ ep, t, p, e }: { ep: Epidemic; t: number; p: number; e: number }) {
  const [ref, f] = useContainerTextScale<HTMLDivElement>();
  const H = Math.round(320 + 260 * (f - 1));
  const s = ep.series;
  const V = s.V * 100;
  return (
    <div ref={ref}>
      <Figure
        viewBox={`0 0 800 ${H}`}
        label={`Andel mottakelige, smittede og immune over ${fmt(ep.tMax, 0)} døgn. Toppen er ${fmtPct(ep.peak)} smittet samtidig.`}
      >
        <Plot
          x={{ min: 0, max: ep.tMax, label: 'Tid (døgn)' }}
          y={{ min: 0, max: 100, label: 'Andel (%)', ticks: [0, 25, 50, 75, 100] }}
          width={800}
          height={H}
        >
          {({ sx, sy, y0, y1, x1 }) => <SirLines ep={ep} t={t} sx={sx} sy={sy} y0={y0} y1={y1} x1={x1} V={V} vaccinated={p * e > 0} />}
        </Plot>
      </Figure>
    </div>
  );
}

function SirLines({
  ep,
  t,
  sx,
  sy,
  y0,
  y1,
  x1,
  V,
  vaccinated,
}: {
  ep: Epidemic;
  t: number;
  sx: (v: number) => number;
  sy: (v: number) => number;
  y0: number;
  y1: number;
  x1: number;
  V: number;
  vaccinated: boolean;
}) {
  const f = useTextScale();
  const s = ep.series;
  const at = (arr: number[]) => {
    const i = Math.min(arr.length - 1, Math.max(0, Math.round((t / ep.tMax) * (arr.length - 1))));
    return arr[i] ?? 0;
  };
  const peakX = sx(ep.peakTime);
  const peakY = sy(ep.peak * 100);
  const right = peakX > (sx(0) + x1) / 2;
  return (
    <g>
      {vaccinated && <line x1={sx(0)} x2={x1} y1={sy(V)} y2={sy(V)} stroke={C.V} strokeWidth={2.5} strokeDasharray="7 6" />}
      <path d={linePath(points(s.sol, 0, 100), sx, sy)} fill="none" stroke={C.S} strokeWidth={3} />
      <path d={linePath(points(s.sol, 2, 100), sx, sy)} fill="none" stroke={C.R} strokeWidth={3} />
      <path d={linePath(points(s.sol, 1, 100), sx, sy)} fill="none" stroke={C.I} strokeWidth={3.5} />
      {!ep.herd && ep.peak > 0.01 && (
        <g>
          <circle cx={peakX} cy={peakY} r={5} fill={C.I} />
          <Txt x={right ? peakX - 10 : peakX + 10} y={peakY - 10 * f} anchor={right ? 'end' : 'start'} color={C.I} size={0.85}>
            topp {fmtPct(ep.peak)}
          </Txt>
        </g>
      )}
      <line x1={sx(t)} x2={sx(t)} y1={y0} y2={y1} className="viz-guide" />
      <circle cx={sx(t)} cy={sy(at(s.S) * 100)} r={6} fill={C.S} stroke={VIZ.surface} strokeWidth={2.5} />
      <circle cx={sx(t)} cy={sy(at(s.R) * 100)} r={6} fill={C.R} stroke={VIZ.surface} strokeWidth={2.5} />
      <circle cx={sx(t)} cy={sy(at(s.I) * 100)} r={6} fill={C.I} stroke={VIZ.surface} strokeWidth={2.5} />
    </g>
  );
}

/* ---------- Grensen p_c mot R₀ ---------- */

const R_MIN = 1;
const R_MAX = 18;

function ThresholdFigure({ R0, p, e, herd }: { R0: number; p: number; e: number; herd: boolean }) {
  const [ref, f] = useContainerTextScale<HTMLDivElement>();
  const H = Math.round(340 + 260 * (f - 1));
  return (
    <div ref={ref}>
      <Figure
        viewBox={`0 0 800 ${H}`}
        label={`Flokkimmunitetsgrensen som funksjon av R₀. Med R₀ = ${fmt(R0, 1)} trengs ${fmtPct(1 - 1 / Math.max(1, R0))}. Dekningen er ${fmtPct(p)}.`}
      >
        <Plot
          x={{ min: R_MIN, max: R_MAX, label: 'Basisreproduksjonstall R₀', ticks: [1, 3, 6, 9, 12, 15, 18] }}
          y={{ min: 0, max: 100, label: 'Andel immune (%)', ticks: [0, 25, 50, 75, 100] }}
          width={800}
          height={H}
        >
          {({ sx, sy, x0, x1, y0, y1 }) => {
            const curve = sample((r) => 100 * (1 - 1 / r), R_MIN, R_MAX, 120);
            const region = `${linePath(curve, sx, sy)} L${x1},${y1} L${x0},${y1} Z`;
            const needed = sample((r) => (100 * (1 - 1 / r)) / e, R_MIN, R_MAX, 160).filter(([, v]) => v <= 100);
            const cx = sx(Math.min(R_MAX, Math.max(R_MIN, R0)));
            const cy = sy(p * 100);
            const pc = 100 * (1 - 1 / Math.max(1, R0));
            return (
              <g>
                <path d={region} fill={C.V} opacity={0.12} />
                {/* Med e < 1 går den stiplede kurven gjennom hjørnet; da står forklaringen bare i fargeforklaringen */}
                {e >= 0.999 && (
                  <Txt x={x0 + 14} y={y1 + 26 * f} anchor="start" color={C.V} weight={650} size={0.9}>
                    flokkimmunitet
                  </Txt>
                )}
                <Txt x={x1 - 10} y={y0 - 14} anchor="end" color={C.I} weight={650} size={0.9}>
                  smitten kan spre seg
                </Txt>
                <path d={linePath(curve, sx, sy)} fill="none" stroke={VIZ.ink} strokeWidth={3} />
                {e < 1 && needed.length > 1 && (
                  <path d={linePath(needed, sx, sy)} fill="none" stroke={VIZ.ink} strokeWidth={2.2} strokeDasharray="7 6" />
                )}
                {/* Avstanden fra valgt dekning til grensen (under etikettene, som har lys kant) */}
                <line x1={cx} x2={cx} y1={sy(pc)} y2={cy} stroke={herd ? C.R : C.I} strokeWidth={2} strokeDasharray="4 4" />
                {DISEASES.map((d) => {
                  const x = sx(d.R0);
                  const y = sy(100 * (1 - 1 / d.R0));
                  const end = d.R0 > 9;
                  return (
                    <g key={d.id}>
                      <circle cx={x} cy={y} r={5} fill={VIZ.surface} stroke={VIZ.ink} strokeWidth={2} />
                      <Txt x={end ? x - 10 : x + 12} y={y + (end ? 26 * f : 22 * f)} anchor={end ? 'end' : 'start'} size={0.8} muted>
                        {d.short}
                      </Txt>
                    </g>
                  );
                })}
                {/* Valgt sykdom og dekning */}
                <circle cx={cx} cy={cy} r={9} fill={herd ? C.R : C.I} stroke={VIZ.surface} strokeWidth={3} />
              </g>
            );
          }}
        </Plot>
      </Figure>
    </div>
  );
}

/* ---------- Forklaring ---------- */

function explanation(ep: Epidemic, R0: number, p: number, e: number): ReactNode {
  const model = (
    <p>
      Modellen er forenklet: alle møter alle like ofte, en smittet er smittsom i {INFECTIOUS_DAYS} døgn, og den som har vært syk eller er
      vaksinert, er immun resten av perioden. Tallene for R<Sub>0</Sub> er typiske verdier; de varierer med samfunn og smittevernstiltak.
    </p>
  );
  const measles =
    R0 >= 10 ? (
      <p>
        <strong>Hvorfor trenger meslinger så høy dekning?</strong> Meslinger er blant de mest smittsomme sykdommene vi kjenner: én syk kan
        smitte 12–18 andre i en befolkning uten immunitet. Da må minst 1 − 1/{fmt(R0, 0)} = {fmtPct(ep.pc)} være immune, og fordi ingen
        vaksine virker på alle, må nesten alle vaksineres. Derfor anbefaler Verdens helseorganisasjon (WHO) at minst 95 % får to doser
        meslingvaksine, og selv små lommer av uvaksinerte kan gi utbrudd.
      </p>
    ) : null;
  if (R0 <= 1)
    return (
      <>
        <p>
          <strong>
            R<Sub>0</Sub> ≤ 1.
          </strong>{' '}
          Hver smittet smitter i snitt én eller færre, så sykdommen sprer seg ikke, selv uten vaksine.
        </p>
        {model}
      </>
    );
  if (ep.herd)
    return (
      <>
        <p>
          <strong>Flokkimmunitet.</strong> {fmtPct(p * e)} av befolkningen er immune etter vaksinasjon, som er mer enn grensen p<Sub>c</Sub>{' '}
          = {fmtPct(ep.pc)}. Da smitter hver syk i snitt bare R = {fmt(ep.Re0, 2)} andre, færre enn én, og smitten dør ut. De uvaksinerte
          blir også beskyttet: de møter nesten aldri noen som er smittet, og bare {fmtPct(ep.attackUnvaccinated)} av dem ble smittet.
          Vaksinasjon beskytter altså både den enkelte og hele befolkningen, også dem som ikke kan ta vaksinen (spedbarn, syke).
        </p>
        {measles}
        {model}
      </>
    );
  const impossible = ep.required > 1;
  return (
    <>
      <p>
        <strong>Ikke flokkimmunitet.</strong> Bare {fmtPct(p * e)} er immune etter vaksinasjon, mindre enn grensen p<Sub>c</Sub> ={' '}
        {fmtPct(ep.pc)}. Ved start smitter hver syk i snitt R = {fmt(ep.Re0, 2)} andre, så smitten sprer seg. På det meste er{' '}
        {fmtPct(ep.peak)} smittet samtidig, og til sammen blir {fmtPct(ep.totalInfected)} av befolkningen smittet, også{' '}
        {fmtPct(ep.attackUnvaccinated)} av de uvaksinerte. Epidemien stopper ikke fordi smittestoffet forsvinner, men fordi så mange er
        blitt immune at R faller under 1.
      </p>
      {impossible ? (
        <p>
          Med en vaksine som beskytter {fmtPct(e)} av de vaksinerte, måtte {fmtPct(ep.required)} vært vaksinert, altså mer enn alle.
          Flokkimmunitet er da umulig med vaksine alene, men vaksinen gir likevel en mindre epidemi og beskytter dem som er vaksinert.
        </p>
      ) : (
        <p>
          Øk dekningen til over {fmtPct(ep.required)} for å oppnå flokkimmunitet
          {e < 1 ? (
            <>
              {' '}
              (p<Sub>c</Sub> / e, fordi vaksinen virker på {fmtPct(e)})
            </>
          ) : null}
          .
        </p>
      )}
      {measles}
      {model}
    </>
  );
}
