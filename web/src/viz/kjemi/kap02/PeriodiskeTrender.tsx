import { useState, type ReactNode } from 'react';
import {
  Explain,
  Figure,
  Formula,
  FormulaLine,
  KJEMI,
  Plot,
  Readout,
  Readouts,
  Segmented,
  Toolbar,
  Txt,
  VIZ,
  VizLayout,
  capitalize,
  element,
  fmt,
  mixColor,
  useContainerTextScale,
  type Element,
} from '../kit';
import {
  PROPERTIES,
  TREND_ELEMENTS,
  groupSeries,
  ieAnomaly,
  innerElectrons,
  normalizedValue,
  outerShellElectrons,
  periodSeries,
  propertyRange,
  propertyValue,
  shieldedCharge,
  type TrendProperty,
} from './model';

type Direction = 'periode' | 'gruppe';

const COLOR: Record<TrendProperty, string> = { radius: KJEMI.electron, ie: KJEMI.exo, en: KJEMI.bondType.polar };
const AXIS: Record<TrendProperty, { max: number; ticks: number[]; label: string }> = {
  radius: { max: 240, ticks: [0, 50, 100, 150, 200], label: 'Atomradius (pm)' },
  ie: { max: 2500, ticks: [0, 500, 1000, 1500, 2000, 2500], label: 'Ioniseringsenergi (kJ/mol)' },
  en: { max: 4.2, ticks: [0, 1, 2, 3, 4], label: 'Elektronegativitet' },
};

const valueText = (e: Element, p: TrendProperty) => {
  const v = propertyValue(e, p);
  return v === null ? '–' : fmt(v, PROPERTIES[p].decimals);
};

export default function PeriodiskeTrender() {
  const [prop, setProp] = useState<TrendProperty>('ie');
  const [dir, setDir] = useState<Direction>('periode');
  const [sym, setSym] = useState('S');
  const [ref, f] = useContainerTextScale<HTMLDivElement>();
  const el = element(sym);
  const series = dir === 'periode' ? periodSeries(el.period) : groupSeries(el.group ?? 1);
  const table = tableLayout(f);
  const graphH = f <= 1.3 ? 380 : 620;
  const info = PROPERTIES[prop];

  return (
    <VizLayout>
      <Toolbar>
        <Segmented
          label="Velg egenskap"
          options={[
            { value: 'radius', label: 'Atomradius' },
            { value: 'ie', label: 'Ioniseringsenergi' },
            { value: 'en', label: 'Elektronegativitet' },
          ]}
          value={prop}
          onChange={setProp}
        />
        <Segmented
          label="Velg retning"
          options={[
            { value: 'periode', label: 'Bortover perioden' },
            { value: 'gruppe', label: 'Nedover gruppa' },
          ]}
          value={dir}
          onChange={setDir}
        />
      </Toolbar>

      <div ref={ref}>
        <Figure
          viewBox={`0 0 800 ${table.H}`}
          label={`Periodesystemet farget etter ${info.name.toLowerCase()}. Valgt: ${el.name}, ${valueText(el, prop)} ${info.unit}.`}
          caption={`Trykk på et grunnstoff for å velge det. Mørkere farge betyr større verdi.${prop === 'radius' ? ' Edelgassene (stiplet) danner nesten ikke bindinger, så radiusen deres er et anslag.' : prop === 'en' ? ' He, Ne og Ar har ingen elektronegativitet.' : ''}`}
          maxHeight={table.H}
        >
          <HeatTable prop={prop} sel={el} dir={dir} onPick={setSym} layout={table} f={f} />
        </Figure>
      </div>

      <Figure
        viewBox={`0 0 800 ${graphH}`}
        label={`${info.name} ${dir === 'periode' ? `bortover periode ${el.period}` : `nedover gruppe ${el.group}`}.`}
        maxHeight={graphH}
      >
        <TrendGraph prop={prop} dir={dir} series={series} sel={el} onPick={setSym} height={graphH} f={f} />
      </Figure>

      <Readouts>
        <Readout label="Atomradius" value={valueText(el, 'radius')} unit="pm" tone={prop === 'radius' ? COLOR.radius : undefined} />
        <Readout label="Ioniseringsenergi" value={valueText(el, 'ie')} unit="kJ/mol" tone={prop === 'ie' ? COLOR.ie : undefined} />
        <Readout label="Elektronegativitet" value={valueText(el, 'en')} tone={prop === 'en' ? COLOR.en : undefined} />
        <Readout label={`${capitalize(el.name)}: skall og valenselektroner`} value={`${el.shells.length} skall, ${outerShellElectrons(el)} e⁻`} />
      </Readouts>

      <Formula label="Skjerming">
        <FormulaLine>
          Kjerneladning Z = +{el.Z}, indre elektroner = {innerElectrons(el)}
        </FormulaLine>
        <FormulaLine>
          Skjermet kjerneladning ≈ Z − indre elektroner = {el.Z} − {innerElectrons(el)} = +{shieldedCharge(el)}
        </FormulaLine>
      </Formula>

      <Explain>{explanation(prop, dir, el, series)}</Explain>
    </VizLayout>
  );
}

/* ---------- Periodesystemet som fargekart ---------- */

function tableLayout(f: number) {
  const wide = f <= 1.3;
  const x0 = 26 * f;
  const cell = (800 - x0 - 4) / 18;
  const cellH = wide ? 50 : Math.max(cell * 1.1, 44);
  const head = 18 * f;
  const top = head + 10 * f;
  const scaleY = top + 5 * cellH + 26 * f;
  const scaleH = 16 * f;
  return { wide, x0, cell, cellH, head, top, scaleY, scaleH, H: Math.round(scaleY + scaleH + 30 * f) };
}

function cellFill(t: number | null, color: string): string {
  if (t === null) return VIZ.surface;
  return mixColor(VIZ.surface, color, 0.1 + 0.8 * t);
}

function HeatTable({
  prop,
  sel,
  dir,
  onPick,
  layout,
  f,
}: {
  prop: TrendProperty;
  sel: Element;
  dir: Direction;
  onPick: (s: string) => void;
  layout: ReturnType<typeof tableLayout>;
  f: number;
}) {
  const { x0, cell, cellH, top } = layout;
  const color = COLOR[prop];
  const [lo, hi] = propertyRange(prop);
  const info = PROPERTIES[prop];
  const gx = (g: number) => x0 + (g - 1) * cell;
  const py = (p: number) => top + (p - 1) * cellH;
  const steps = 12;
  return (
    <g>
      {[1, 2, 13, 14, 15, 16, 17, 18, 3, 12].map((g) => (
        <Txt key={g} x={gx(g) + cell / 2} y={layout.head} muted size={0.65} weight={sel.group === g ? 700 : 500}>
          {g}
        </Txt>
      ))}
      {[1, 2, 3, 4, 5].map((p) => (
        <Txt key={p} x={x0 - 8} y={py(p) + cellH / 2 + 6 * f} anchor="end" muted size={0.75} weight={sel.period === p ? 700 : 500}>
          {p}
        </Txt>
      ))}
      {/* Raden eller kolonnen grafen viser */}
      {dir === 'periode' ? (
        <rect x={x0 - 2} y={py(sel.period) - 2} width={18 * cell + 4} height={cellH + 4} rx={7} fill="none" stroke={VIZ.ink} strokeWidth={1.5} strokeDasharray="6 4" />
      ) : (
        <rect
          x={gx(sel.group ?? 1) - 2}
          y={top - 2}
          width={cell + 4}
          height={5 * cellH + 4}
          rx={7}
          fill="none"
          stroke={VIZ.ink}
          strokeWidth={1.5}
          strokeDasharray="6 4"
        />
      )}
      {TREND_ELEMENTS.map((e) => {
        const t = normalizedValue(e, prop);
        const x = gx(e.group ?? 1);
        const y = py(e.period);
        const on = e.symbol === sel.symbol;
        const dark = t !== null && t > 0.55;
        const ink = dark ? VIZ.surface : VIZ.ink;
        const noble = prop === 'radius' && e.group === 18;
        return (
          <g key={e.Z} onClick={() => onPick(e.symbol)} style={{ cursor: 'pointer' }}>
            <rect
              x={x + 1.5}
              y={y + 1.5}
              width={cell - 3}
              height={cellH - 3}
              rx={4}
              fill={cellFill(t, color)}
              stroke={on ? VIZ.ink : noble || t === null ? VIZ.muted : VIZ.grid}
              strokeWidth={on ? 3 : 1}
              strokeDasharray={noble || t === null ? '3 3' : undefined}
            />
            <text
              x={x + cell / 2}
              y={layout.wide ? y + cellH * 0.46 : y + cellH / 2 + cell * 0.16}
              textAnchor="middle"
              style={{ fill: ink, fontSize: layout.wide ? 16 : cell * 0.44, fontWeight: on ? 800 : 650 }}
            >
              {e.symbol}
            </text>
            {layout.wide && (
              <text x={x + cell / 2} y={y + cellH * 0.8} textAnchor="middle" style={{ fill: ink, fontSize: 10.5, opacity: 0.85 }}>
                {valueText(e, prop)}
              </text>
            )}
          </g>
        );
      })}
      {/* Fargeskala */}
      {Array.from({ length: steps }, (_, i) => (
        <rect
          key={i}
          x={200 + (i * 400) / steps}
          y={layout.scaleY}
          width={400 / steps + 0.5}
          height={layout.scaleH}
          fill={cellFill(i / (steps - 1), color)}
        />
      ))}
      <rect x={200} y={layout.scaleY} width={400} height={layout.scaleH} fill="none" stroke={VIZ.grid} />
      <Txt x={192} y={layout.scaleY + layout.scaleH - 2} anchor="end" size={0.75} muted>
        {fmt(lo, info.decimals)}
        {info.unit ? ` ${info.unit}` : ''}
      </Txt>
      <Txt x={608} y={layout.scaleY + layout.scaleH - 2} anchor="start" size={0.75} muted>
        {fmt(hi, info.decimals)}
        {info.unit ? ` ${info.unit}` : ''}
      </Txt>
    </g>
  );
}

/* ---------- Grafen langs perioden eller gruppa ---------- */

function TrendGraph({
  prop,
  dir,
  series,
  sel,
  onPick,
  height,
  f,
}: {
  prop: TrendProperty;
  dir: Direction;
  series: Element[];
  sel: Element;
  onPick: (s: string) => void;
  height: number;
  f: number;
}) {
  const ax = AXIS[prop];
  const color = COLOR[prop];
  // Periode 1–3 har ingen d-blokk: da står gruppe 13–18 rett etter gruppe 2 (x = 3–8).
  const compact = dir === 'periode' && sel.period <= 3;
  const groupX = (g: number) => (compact && g >= 13 ? g - 10 : g);
  const xOf = (e: Element) => (dir === 'periode' ? groupX(e.group ?? 1) : e.period);
  const groupTicks = compact ? [1, 2, 13, 14, 15, 16, 17, 18] : [1, 2, 3, 12, 13, 18];
  const xAxis =
    dir === 'periode'
      ? { min: 0.4, max: compact ? 8.6 : 18.6, label: `Gruppe (periode ${sel.period})`, ticks: [] as number[] }
      : { min: 0.6, max: 5.4, label: `Periode (gruppe ${sel.group})`, ticks: [1, 2, 3, 4, 5] };
  const pts = series.map((e) => ({ e, v: propertyValue(e, prop) }));
  return (
    <Plot
      x={xAxis}
      y={{ min: 0, max: ax.max, label: ax.label, ticks: ax.ticks, decimals: 0 }}
      width={800}
      height={height}
      margin={{ top: 30 * f, right: 24 * f, bottom: 56 * f, left: 80 * f }}
    >
      {({ sx, sy, y0 }) => {
        // Linje i rekkefølge etter Z; brudd der verdien mangler
        const segs: string[] = [];
        let cur = '';
        for (const p of pts) {
          if (p.v === null) {
            if (cur) segs.push(cur);
            cur = '';
            continue;
          }
          cur += `${cur ? 'L' : 'M'}${sx(xOf(p.e))},${sy(p.v)}`;
        }
        if (cur) segs.push(cur);
        return (
          <g>
            {dir === 'periode' &&
              groupTicks.map((g) => (
                <g key={`gt${g}`}>
                  <line x1={sx(groupX(g))} x2={sx(groupX(g))} y1={y0} y2={y0 + 5} stroke={VIZ.muted} />
                  <text x={sx(groupX(g))} y={y0 + 22 * f} textAnchor="middle" className="viz-tick">
                    {g}
                  </text>
                </g>
              ))}
            {segs.map((d, i) => (
              <path key={i} d={d} fill="none" stroke={color} strokeWidth={3} strokeLinejoin="round" />
            ))}
            {pts.map(({ e, v }) => {
              if (v === null) return null;
              const x = sx(xOf(e));
              const y = sy(v);
              const on = e.symbol === sel.symbol;
              const anomaly = prop === 'ie' && dir === 'periode' && ieAnomaly(e) !== null;
              const hollow = prop === 'radius' && e.group === 18;
              const below = anomaly;
              return (
                <g key={e.Z} onClick={() => onPick(e.symbol)} style={{ cursor: 'pointer' }}>
                  {anomaly && <circle cx={x} cy={y} r={13} fill="none" stroke={KJEMI.valence} strokeWidth={2.5} />}
                  {on && <circle cx={x} cy={y} r={anomaly ? 17 : 11} fill="none" stroke={VIZ.ink} strokeWidth={2} />}
                  <circle cx={x} cy={y} r={6.5} fill={hollow ? VIZ.surface : color} stroke={hollow ? color : VIZ.surface} strokeWidth={hollow ? 2.5 : 1.5} />
                  <circle cx={x} cy={y} r={16} fill="transparent" />
                  <Txt x={x} y={below ? y + 34 * f : y - 16} size={0.8} weight={on ? 800 : 600} color={anomaly ? KJEMI.valence : undefined}>
                    {e.symbol}
                  </Txt>
                </g>
              );
            })}
          </g>
        );
      }}
    </Plot>
  );
}

/* ---------- Forklaring ---------- */

function explanation(prop: TrendProperty, dir: Direction, el: Element, series: Element[]): ReactNode {
  const first = series.find((e) => propertyValue(e, prop) !== null)!;
  const last = [...series].reverse().find((e) => propertyValue(e, prop) !== null)!;
  const unit = PROPERTIES[prop].unit ? ` ${PROPERTIES[prop].unit}` : '';
  const span = (
    <>
      fra {first.symbol} ({valueText(first, prop)}
      {unit}) til {last.symbol} ({valueText(last, prop)}
      {unit})
    </>
  );
  const dBlock = dir === 'periode' && el.period >= 4;
  let main: ReactNode;
  if (prop === 'radius')
    main =
      dir === 'periode' ? (
        <p>
          <strong>Atomene blir mindre bortover perioden</strong>, {span}. Alle har {el.period === 1 ? 'ett skall' : `${el.period} skall`}, men
          kjerneladningen øker med én for hvert grunnstoff, mens de nye elektronene havner i det samme ytterste skallet og skjermer dårlig for
          hverandre. Da trekkes valenselektronene nærmere kjernen. Flere elektroner gir altså ikke større atom her.
          {dBlock ? ' Blant overgangsmetallene endrer radiusen seg lite: de nye d-elektronene havner innenfor det ytterste skallet og skjermer godt.' : ''}
        </p>
      ) : (
        <p>
          <strong>Atomene blir større nedover gruppa</strong>, {span}. For hver periode får atomet ett skall til. Kjerneladningen øker også, men
          de indre elektronene skjermer for den, så det ytterste skallet ligger stadig lenger fra kjernen.
        </p>
      );
  else if (prop === 'ie')
    main =
      dir === 'periode' ? (
        <p>
          <strong>Ioniseringsenergien øker bortover perioden</strong>, {span}. Den er energien som trengs for å fjerne det ytterste elektronet
          fra ett mol atomer i gassform. Større kjerneladning og mindre radius holder elektronet hardere fast, og edelgassen til slutt har
          høyest. Men trenden har to unntak (markert): gruppe 13 og gruppe 16 ligger lavere enn grunnstoffet foran.
        </p>
      ) : (
        <p>
          <strong>Ioniseringsenergien synker nedover gruppa</strong>, {span}. Det ytterste elektronet er lenger fra kjernen og bedre skjermet av
          de indre skallene, så det er lettere å fjerne. Derfor er metallene nederst i gruppe 1 og 2 de mest reaktive.
        </p>
      );
  else
    main =
      dir === 'periode' ? (
        <p>
          <strong>Elektronegativiteten øker bortover perioden</strong>, {span}. Med større kjerneladning og mindre radius trekker atomet
          hardere i elektronene i en binding. Fluor har høyest elektronegativitet av alle. He, Ne og Ar danner ikke bindinger og har ingen
          verdi.
        </p>
      ) : (
        <p>
          <strong>Elektronegativiteten synker nedover gruppa</strong>, {span}. Bindingselektronene ligger lenger fra kjernen og er bedre
          skjermet, så atomet trekker svakere i dem.
        </p>
      );
  const anomaly = ieAnomaly(el);
  const prev = TREND_ELEMENTS.find((x) => x.Z === el.Z - 1);
  let note: ReactNode = null;
  if (prop === 'ie' && anomaly && prev)
    note =
      anomaly === 'p-elektron' ? (
        <p>
          <strong>Unntak: {el.symbol} har lavere ioniseringsenergi enn {prev.symbol}.</strong> Det ytterste elektronet i {el.name} er alene i et
          p-delskall, som har høyere energi enn s og er skjermet av s-elektronene. Det er derfor lettere å fjerne.
        </p>
      ) : (
        <p>
          <strong>Unntak: {el.symbol} har lavere ioniseringsenergi enn {prev.symbol}.</strong> I {el.name} (p⁴) må ett av p-elektronene dele
          orbital med et annet. De frastøter hverandre, og da er det ene lettere å fjerne enn et uparet elektron i {prev.symbol} (p³).
        </p>
      );
  else
    note = (
      <p>
        {capitalize(el.name)} har {el.shells.length === 1 ? 'ett skall' : `${el.shells.length} skall`} og {outerShellElectrons(el)} elektroner i
        det ytterste. De {innerElectrons(el)} indre elektronene skjermer, så valenselektronene merker en kjerneladning på omtrent +
        {shieldedCharge(el)}, ikke +{el.Z}.
      </p>
    );
  return (
    <>
      {main}
      {note}
    </>
  );
}
