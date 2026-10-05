import { useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  BIO,
  Controls,
  Explain,
  Figure,
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
  Toggle,
  Toolbar,
  Txt,
  VIZ,
  VizLayout,
  fmt,
  fmtCount,
  fmtPct,
  linePath,
  mixColor,
  useContainerTextScale,
  useSimClock,
  useTextScale,
  valueAt,
} from '../kit';
import {
  CARE_CAPACITY,
  HOSPITAL_BEDS,
  HOSPITAL_SHARE,
  NO_MEASURES,
  SYMPTOM_DAY,
  TOWN,
  basicR0,
  contactDays,
  contactGrid,
  currentR,
  effectiveP,
  outbreak,
  reproductionNumber,
  type Measures,
  type Outbreak,
  type SpreadParams,
} from './model';

const C = BIO.sir;
const CAP = BIO.baereevne;

export default function Smittespredning() {
  const [contacts, setContacts] = useState(10);
  const [pPct, setPPct] = useState(5);
  const [days, setDays] = useState(6);
  const [m, setM] = useState<Measures>(NO_MEASURES);
  const s: SpreadParams = { contacts, p: pPct / 100, days };
  const R0 = basicR0(s);
  const R = reproductionNumber(s, m);
  const anyMeasure = m.handvask || m.munnbind || m.isolasjon;
  const base = useMemo(() => outbreak(R0, days), [R0, days]);
  const tMax = base.tMax;
  const ob = useMemo(() => outbreak(R, days, tMax), [R, days, tMax]);
  const clock = useSimClock({ tMax, speed: tMax / 12 });
  const { setT, pause } = clock;
  // Åpner på toppen av utbruddet
  useEffect(() => setT(Math.round(outbreak(3, 6).peakDay)), [setT]);
  const t = Math.min(clock.t, tMax);
  const [, I = 0, Rr = 0] = valueAt(ob.series.sol, t);
  const S = Math.max(0, 1 - I - Rr);
  const [gridRef, fg] = useContainerTextScale<HTMLDivElement>();
  const [plotRef, fp] = useContainerTextScale<HTMLDivElement>();
  const plotH = Math.round(340 + 260 * (fp - 1));
  const toggle = (key: keyof Measures) => (v: boolean) => setM((prev) => ({ ...prev, [key]: v }));

  return (
    <VizLayout>
      <Controls>
        <Slider label="Kontakter per dag" value={contacts} onChange={setContacts} min={1} max={20} step={1} />
        <Slider label="Smitterisiko per kontakt" value={pPct} onChange={setPPct} min={1} max={20} step={1} unit="%" />
        <Slider label="Dager smittsom" value={days} onChange={setDays} min={2} max={12} step={1} unit="døgn" />
      </Controls>
      <Toolbar>
        <Toggle label="Håndvask" checked={m.handvask} onChange={toggle('handvask')} />
        <Toggle label="Munnbind" checked={m.munnbind} onChange={toggle('munnbind')} />
        <Toggle label="Syke isolerer seg" checked={m.isolasjon} onChange={toggle('isolasjon')} />
      </Toolbar>

      <div ref={gridRef}>
        <ContactFigure contacts={contacts} p={s.p} days={days} m={m} R={R} f={fg} />
      </div>
      <Legend
        items={[
          { color: C.I, label: 'Kontakt som blir smittet' },
          { color: C.S, label: 'Kontakt som ikke blir smittet' },
          ...(m.isolasjon ? [{ color: VIZ.muted, label: 'Kontakt som unngås (isolasjon)', dashed: true }] : []),
        ]}
      />

      <Controls>
        <Slider
          label="Tid"
          value={Math.round(t)}
          onChange={(v) => {
            pause();
            setT(v);
          }}
          min={0}
          max={tMax}
          step={1}
          format={(v) => `dag ${fmt(v, 0)}`}
        />
      </Controls>
      <Toolbar>
        <PlayBar clock={clock} time={`dag ${fmt(t, 0)}`} />
      </Toolbar>
      <div ref={plotRef}>
        <Figure
          viewBox={`0 0 800 ${plotH}`}
          label={`Antall smittet samtidig i en by med ${fmtCount(TOWN)} innbyggere over ${tMax} døgn. Toppen er ${fmtCount(ob.peak)} smittet.`}
        >
          <EpidemicPlot base={base} ob={ob} t={t} measures={anyMeasure} height={plotH} R={R} />
        </Figure>
      </div>
      <Legend
        items={[
          { color: C.I, label: anyMeasure ? 'Smittet nå, med tiltak' : 'Smittet nå' },
          ...(anyMeasure ? [{ color: VIZ.muted, label: 'Uten tiltak', dashed: true }] : []),
          { color: CAP, label: `Helsevesenet klarer ${fmtCount(CARE_CAPACITY)} smittet samtidig`, dashed: true },
        ]}
      />

      <Readouts>
        <Readout
          label={
            <>
              R<Sub>0</Sub> uten tiltak
            </>
          }
          value={fmt(R0, 1)}
          tone={R0 > 1 ? C.I : C.R}
        />
        <Readout label="R med tiltak" value={fmt(R, R < 10 ? 2 : 1)} tone={R > 1 ? C.I : C.R} />
        <Readout label="Flest smittet samtidig" value={fmtCount(ob.peak)} unit={ob.peak >= 2 ? `dag ${fmt(ob.peakDay, 0)}` : undefined} tone={ob.peak > CARE_CAPACITY ? C.I : undefined} />
        <Readout label="Smittet til sammen" value={fmtPct(ob.total / TOWN)} unit={`av ${fmtCount(TOWN)}`} />
      </Readouts>

      <Formula label="Basisreproduksjonstallet">
        <FormulaLine>
          R<Sub>0</Sub> = c · p · D = {contacts} · {fmt(s.p, 2)} · {days} = {fmt(R0, 2)}
        </FormulaLine>
        {anyMeasure && (
          <FormulaLine>
            Med tiltak: R = {contacts} · {fmt(effectiveP(s.p, m), 3)} · {fmt(contactDays(days, m), 1)} kontaktdøgn = {fmt(R, 2)}
          </FormulaLine>
        )}
        <FormulaLine>
          Dag {fmt(t, 0)}: R<Sub>t</Sub> = R · S = {fmt(R, 2)} · {fmt(S, 2)} = {fmt(currentR(R, S), 2)}{' '}
          {currentR(R, S) > 1 ? '> 1: flere blir smittet' : '≤ 1: færre blir smittet'}
        </FormulaLine>
      </Formula>

      <Explain>{explanation({ R0, R, ob, base, t, S, m })}</Explain>
    </VizLayout>
  );
}

/* ---------- Kontaktene til én smittet ---------- */

function ContactFigure({ contacts, p, days, m, R, f }: { contacts: number; p: number; days: number; m: Measures; R: number; f: number }) {
  const narrow = f > 1.3;
  const k = Math.max(1, 0.85 * f);
  const cells = useMemo(() => contactGrid({ contacts, p, days }, m), [contacts, p, days, m]);
  const D = Math.round(days);
  const c = Math.round(contacts);
  const infected = cells.filter((x) => x.kind === 'smittet').length;
  const avoided = cells.filter((x) => x.kind === 'unngått').length;
  const head = 30 * f;
  const gx0 = narrow ? 30 : 170;
  const gx1 = 780;
  const gridH = Math.round(200 + 260 * (k - 1));
  const gy0 = head + 16 + (narrow ? 0 : 0);
  const gy1 = gy0 + gridH;
  const H = Math.round(gy1 + 30 * f + 12);
  const dx = (gx1 - gx0) / D;
  const dy = (gy1 - gy0) / c;
  const r = Math.min(dx, dy) * 0.36;
  const rr = Math.min(r, 11 * k);
  const tickEvery = D > 8 && narrow ? 2 : 1;
  return (
    <Figure
      viewBox={`0 0 800 ${H}`}
      maxHeight={Math.round(H * 1.25)}
      label={`Kontaktene til én smittet person: ${c} kontakter per dag i ${D} dager. ${infected} av dem blir smittet.`}
      caption={`Hver prikk er én kontakt. Med disse tallene smitter én syk i snitt R = ${fmt(R, 1)} andre; tilfeldighetene gjør at akkurat denne personen smittet ${infected}.`}
    >
      <Txt x={narrow ? 30 : 30} y={head - 6} anchor="start" size={0.9} weight={700}>
        {narrow ? `${c * D} kontakter, ${infected} smittet` : `Én smittet person: ${c} kontakter per dag i ${D} døgn = ${c * D} kontakter, ${infected} blir smittet`}
      </Txt>
      {!narrow && (
        <g>
          <Menneske x={90} y={(gy0 + gy1) / 2 - 10} size={70} paint={{ fill: mixColor(VIZ.surface, C.I, 0.35), line: C.I }} />
          <Txt x={90} y={(gy0 + gy1) / 2 + 52} size={0.8} color={C.I} weight={650}>
            smittet
          </Txt>
        </g>
      )}
      {m.isolasjon && D > SYMPTOM_DAY && (
        <g>
          <rect x={gx0 + SYMPTOM_DAY * dx} y={gy0} width={gx1 - gx0 - SYMPTOM_DAY * dx} height={gy1 - gy0} fill={mixColor(VIZ.surface, VIZ.muted, 0.1)} />
          <line x1={gx0 + SYMPTOM_DAY * dx} x2={gx0 + SYMPTOM_DAY * dx} y1={gy0 - 4} y2={gy1 + 4} stroke={VIZ.muted} strokeWidth={2} strokeDasharray="5 4" />
          {!narrow && (
            <Txt x={gx0 + SYMPTOM_DAY * dx + 8} y={gy0 + 16} anchor="start" size={0.75} muted>
              symptomer: holder seg hjemme
            </Txt>
          )}
        </g>
      )}
      {cells.map((cell) => {
        const x = gx0 + (cell.day + 0.5) * dx;
        const y = gy0 + (cell.index + 0.5) * dy;
        if (cell.kind === 'unngått')
          return <circle key={`${cell.day}-${cell.index}`} cx={x} cy={y} r={rr * 0.8} fill="none" stroke={VIZ.muted} strokeWidth={1.2} strokeDasharray="2 2" />;
        const on = cell.kind === 'smittet';
        return (
          <circle
            key={`${cell.day}-${cell.index}`}
            cx={x}
            cy={y}
            r={on ? rr * 1.15 : rr * 0.8}
            fill={on ? C.I : mixColor(VIZ.surface, C.S, 0.55)}
            stroke={on ? VIZ.surface : 'none'}
            strokeWidth={1.5}
          />
        );
      })}
      {Array.from({ length: D }, (_, d) =>
        d % tickEvery === 0 ? (
          <Txt key={d} x={gx0 + (d + 0.5) * dx} y={gy1 + 24 * f} size={0.75} muted>
            {narrow ? String(d + 1) : `dag ${d + 1}`}
          </Txt>
        ) : null,
      )}
      {avoided > 0 && narrow && (
        <Txt x={780} y={head - 6} anchor="end" size={0.75} muted>
          {avoided} unngått
        </Txt>
      )}
    </Figure>
  );
}

/* ---------- Epidemikurven ---------- */

function EpidemicPlot({ base, ob, t, measures, height, R }: { base: Outbreak; ob: Outbreak; t: number; measures: boolean; height: number; R: number }) {
  const f = useTextScale();
  const top = Math.max(base.peak, CARE_CAPACITY * 1.4, 10);
  const nice = [1500, 2000, 2500, 3000, 4000, 5000, 6000, 8000, 10000].find((v) => v >= top * 1.08) ?? 10000;
  const ticks = Array.from({ length: 5 }, (_, i) => (nice / 4) * i);
  const pts = (o: Outbreak) => o.series.t.map((d, i): [number, number] => [d, o.series.I[i]! * TOWN]);
  const now = (valueAt(ob.series.sol, t)[1] ?? 0) * TOWN;
  return (
    <Plot
      x={{ min: 0, max: ob.tMax, label: 'Tid (døgn)' }}
      y={{ min: 0, max: nice, label: 'Smittet samtidig', ticks }}
      width={800}
      height={height}
    >
      {({ sx, sy, x0, x1, y0, y1 }) => {
        const over = pts(ob).map(([d, v]): [number, number] => [d, Math.max(v, CARE_CAPACITY)]);
        const overPath = `${linePath(over, sx, sy)} L${sx(ob.tMax)},${sy(CARE_CAPACITY)} L${sx(0)},${sy(CARE_CAPACITY)} Z`;
        const peakX = sx(ob.peakDay);
        const right = peakX > (x0 + x1) / 2;
        return (
          <g>
            <path d={overPath} fill={mixColor(VIZ.surface, C.I, 0.22)} />
            <line x1={x0} x2={x1} y1={sy(CARE_CAPACITY)} y2={sy(CARE_CAPACITY)} stroke={CAP} strokeWidth={2.2} strokeDasharray="8 6" />
            <Txt x={x1 - 6} y={sy(CARE_CAPACITY) + 22 * f} anchor="end" size={0.78} color={CAP} weight={650}>
              {f > 1.3 ? 'kapasitet' : `kapasiteten i helsevesenet (${HOSPITAL_BEDS} sykehusplasser)`}
            </Txt>
            {measures && <path d={linePath(pts(base), sx, sy)} fill="none" stroke={VIZ.muted} strokeWidth={2.2} strokeDasharray="7 6" />}
            <path d={linePath(pts(ob), sx, sy)} fill="none" stroke={C.I} strokeWidth={3.5} />
            {ob.peak >= 20 && (
              <g>
                <circle cx={peakX} cy={sy(ob.peak)} r={5} fill={C.I} />
                <Txt x={right ? peakX - 10 : peakX + 10} y={sy(ob.peak) - 12} anchor={right ? 'end' : 'start'} size={0.78} color={C.I} weight={650}>
                  {f > 1.3 ? `topp: R · S = 1` : `toppen: her er R · S = 1`}
                </Txt>
              </g>
            )}
            {R <= 1 && (
              <Txt x={(x0 + x1) / 2} y={sy(nice * 0.78)} size={0.9} color={C.R} weight={650}>
                {f > 1.3 ? 'R ≤ 1: smitten dør ut' : 'R ≤ 1: hver syk smitter færre enn én, så smitten dør ut'}
              </Txt>
            )}
            <line x1={sx(t)} x2={sx(t)} y1={y0} y2={y1} className="viz-guide" />
            <circle cx={sx(t)} cy={sy(now)} r={6.5} fill={C.I} stroke={VIZ.surface} strokeWidth={2.5} />
          </g>
        );
      }}
    </Plot>
  );
}

/* ---------- Forklaring ---------- */

/** Små tall i forklaringen: 0,8 · 0,05 · < 0,01. */
function small(v: number): string {
  if (v >= 0.1) return fmt(v, 1);
  if (v >= 0.01) return fmt(v, 2);
  return '< 0,01';
}

function explanation({
  R0,
  R,
  ob,
  base,
  t,
  S,
  m,
}: {
  R0: number;
  R: number;
  ob: Outbreak;
  base: Outbreak;
  t: number;
  S: number;
  m: Measures;
}): ReactNode {
  const anyMeasure = m.handvask || m.munnbind || m.isolasjon;
  const model = (
    <p>
      Modellen er forenklet: én smittet i en by på {fmtCount(TOWN)}, alle møter alle like ofte, og den som har vært syk, er immun etterpå.
      Vi antar at {fmtPct(HOSPITAL_SHARE)} av de smittede trenger sykehus, så {HOSPITAL_BEDS} plasser holder til {fmtCount(CARE_CAPACITY)}{' '}
      smittet samtidig. Effekten av tiltakene er anslag.
    </p>
  );
  if (R <= 1)
    return (
      <>
        <p>
          <strong>R = {fmt(R, 2)} ≤ 1: utbruddet dør ut.</strong> Hver smittet smitter i snitt færre enn én ny, så hver «smittegenerasjon»
          blir mindre enn den forrige: 1, {small(R)}, {small(R * R)} … Det er dette som er målet med smittevern.
          {anyMeasure && R0 > 1 ? ` Uten tiltakene ville R₀ vært ${fmt(R0, 1)}, og ${fmtPct(base.total / TOWN)} av byen ville blitt smittet.` : ''}
        </p>
        {model}
      </>
    );
  const Rt = currentR(R, S);
  const flattened = anyMeasure && base.peak > ob.peak;
  const extreme =
    R0 > 18 ? (
      <p>
        Så høy R<Sub>0</Sub> ({fmt(R0, 0)}) finnes nesten ikke i virkeligheten. Meslinger, en av de mest smittsomme sykdommene vi kjenner, har
        R<Sub>0</Sub> på 12–18, og covid-19 hadde ca. 3 i starten.
      </p>
    ) : null;
  return (
    <>
      <p>
        <strong>R = {fmt(R, 1)} &gt; 1: utbruddet vokser.</strong> Hver smittet smitter i snitt flere enn én, så tallet på smittede øker
        raskt i starten. På dag {fmt(t, 0)} kan {fmtPct(S)} av byen fortsatt smittes, så hver syk smitter nå R · S = {fmt(Rt, 2)}.{' '}
        {Rt > 1
          ? 'Det er over 1, så kurven stiger fortsatt.'
          : 'Det er under 1, så kurven synker. Smitten stopper ikke fordi viruset forsvinner, men fordi så mange er blitt immune at hver syk møter for få som kan smittes.'}
      </p>
      {flattened ? (
        <p>
          <strong>Flate ut kurven.</strong> Tiltakene senker R fra {fmt(R0, 1)} til {fmt(R, 1)}. Toppen blir {fmtCount(ob.peak)} smittet samtidig i
          stedet for {fmtCount(base.peak)}, og den kommer senere (dag {fmt(ob.peakDay, 0)}).{' '}
          {ob.daysOverCapacity > 0
            ? `Helsevesenet er likevel overbelastet i ca. ${fmt(ob.daysOverCapacity, 0)} døgn.`
            : 'Da får alle som blir alvorlig syke, plass på sykehuset.'}{' '}
          Færre blir også smittet til sammen: {fmtPct(ob.total / TOWN)} mot {fmtPct(base.total / TOWN)}.
        </p>
      ) : (
        <p>
          {ob.daysOverCapacity > 0
            ? `På det meste er ${fmtCount(ob.peak)} smittet samtidig, og i ca. ${fmt(ob.daysOverCapacity, 0)} døgn er det flere syke enn helsevesenet klarer. `
            : `På det meste er ${fmtCount(ob.peak)} smittet samtidig. `}
          Slå på tiltak: håndvask og munnbind gjør hver kontakt mindre smittsom, og isolasjon fjerner kontakter etter at symptomene kommer.
        </p>
      )}
      {extreme}
      {model}
    </>
  );
}
