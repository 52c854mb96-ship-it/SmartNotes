import { useState, type ReactNode } from 'react';
import {
  Controls,
  Explain,
  Figure,
  Formula,
  FormulaLine,
  Plot,
  Readout,
  Readouts,
  Slider,
  Toolbar,
  VizLayout,
  fmt,
  fmtSci,
  niceTicks,
  useTextScale,
} from '../kit';
import { APPLIANCES, DAYS_PER_MONTH, KWH, MAINS_U, currentFromPower, energyKWh, monthly, resistanceFromPower } from './model';
import { EL, Select, Tag, textWidth, useNarrow } from './parts';

const CUSTOM = 'egen';
/** En vanlig kurs i en bolig er sikret med 16 A. */
const FUSE = 16;

/** 2 gjeldende sifre, så effekten fra glidebryteren blir et «pent» tall (1 000 W, 1 100 W, 8,0 W …). */
function niceRound(P: number): number {
  const p = Number(P.toPrecision(2));
  return p >= 10 ? Math.round(p) : p;
}

const fmtW = (P: number) => (P >= 1000 ? `${fmt(P / 1000, P % 1000 === 0 ? 1 : 2)} kW` : `${fmt(P, P < 10 ? 1 : 0)} W`);
const fmtHours = (h: number) => (h === 0 ? '0 h' : h < 1 ? `${fmt(h * 60, 0)} min` : `${fmt(h, Number.isInteger(h) ? 0 : 2)} h`);
const fmtKWh = (e: number) => fmt(e, e >= 100 ? 0 : e >= 10 ? 1 : e >= 1 ? 2 : 3);
const fmtKr = (k: number) => fmt(k, k >= 100 ? 0 : 2);
const fmtI = (I: number) => fmt(I, I >= 10 ? 1 : I >= 0.1 ? 2 : 4);
const fmtR = (R: number) => fmt(R, R >= 100 ? 0 : 1);

export default function EffektOgEnergi() {
  const [preset, setPreset] = useState('panelovn');
  const [P, setP] = useState(1000);
  const [hours, setHours] = useState(10);
  const [price, setPrice] = useState(1.5);
  const app = APPLIANCES.find((a) => a.id === preset);
  const name = app?.name ?? 'Egendefinert apparat';
  const I = currentFromPower(P);
  const R = resistanceFromPower(P);
  const perDay = energyKWh(P, hours);
  const m = monthly(P, hours, price);
  const [wrapRef, narrow] = useNarrow<HTMLDivElement>();
  const W = narrow ? 480 : 800;

  const choose = (id: string) => {
    setPreset(id);
    const a = APPLIANCES.find((x) => x.id === id);
    if (a) {
      setP(a.P);
      setHours(a.hours);
    }
  };

  return (
    <VizLayout>
      <Toolbar>
        <Select
          label="Apparat"
          value={preset}
          options={[...APPLIANCES.map((a) => ({ value: a.id, label: `${a.name}, ${fmtW(a.P)}` })), { value: CUSTOM, label: 'Egendefinert' }]}
          onChange={choose}
        />
      </Toolbar>
      <Controls>
        <Slider
          label="Effekt P"
          value={Math.log10(P)}
          onChange={(v) => {
            const p = niceRound(10 ** v);
            setP(p);
            if (!app || app.P !== p) setPreset(CUSTOM);
          }}
          min={0}
          max={4}
          step={0.01}
          format={() => fmtW(P)}
          ariaLabel="Effekt i watt"
        />
        <Slider label="Bruk per døgn" value={hours} onChange={setHours} min={0} max={24} step={0.25} format={fmtHours} />
        <Slider label="Strømpris" value={price} onChange={setPrice} min={0} max={5} step={0.05} format={(v) => `${fmt(v, 2)} kr/kWh`} />
      </Controls>

      <div ref={wrapRef}>
        <Figure
          viewBox={`0 0 800 ${narrow ? 420 : 320}`}
          label={`Effekt som funksjon av tid gjennom ett døgn. Arealet er energien: ${fmtKWh(perDay)} kWh per døgn.`}
          maxHeight={380}
        >
          <DayGraph P={P} hours={hours} H={narrow ? 420 : 320} />
        </Figure>
      </div>

      <Figure
        viewBox={`0 0 ${W} ${barsHeight(narrow, preset === CUSTOM)}`}
        label="Energibruk og kostnad per måned for vanlige apparater"
        caption={`Per måned (${DAYS_PER_MONTH} dager) med typisk bruk og ${fmt(price, 2)} kr/kWh. Det valgte apparatet bruker innstillingene dine.`}
        maxHeight={560}
      >
        <MonthBars preset={preset} P={P} hours={hours} price={price} narrow={narrow} W={W} />
      </Figure>

      <Readouts>
        <Readout label="Strøm I = P/U" value={fmtI(I)} unit="A" tone={EL.current} />
        <Readout label="Resistans R = U²/P" value={fmtR(R)} unit="Ω" />
        <Readout label="Energi per måned" value={fmtKWh(m.kWh)} unit="kWh" tone={EL.energy} />
        <Readout label="Kostnad per måned" value={fmtKr(m.cost)} unit="kr" />
      </Readouts>

      <Formula label="Effekt, strøm, resistans og energi">
        <FormulaLine>
          P = U·I gir I = P/U = {fmt(P, P < 10 ? 1 : 0)} W / {MAINS_U} V = {fmtI(I)} A
        </FormulaLine>
        <FormulaLine>
          P = R·I² gir R = P/I² = {fmt(P, P < 10 ? 1 : 0)} W / ({fmtI(I)} A)² = {fmtR(R)} Ω
        </FormulaLine>
        <FormulaLine>
          W = P·t = {fmt(P / 1000, P < 100 ? 3 : 2)} kW · {fmt(hours, Number.isInteger(hours) ? 0 : 2)} h · {DAYS_PER_MONTH} = {fmtKWh(m.kWh)} kWh = {fmtSci(m.kWh * KWH, 2)} J
        </FormulaLine>
        <FormulaLine>
          Kostnad = {fmtKWh(m.kWh)} kWh · {fmt(price, 2)} kr/kWh = {fmtKr(m.cost)} kr
        </FormulaLine>
      </Formula>

      <Explain>{explanation(name, P, hours, perDay, m.kWh, I)}</Explain>
    </VizLayout>
  );
}

function DayGraph({ P, hours, H }: { P: number; hours: number; H: number }) {
  const f = useTextScale();
  const kw = P >= 1000;
  const val = kw ? P / 1000 : P;
  const ticks = niceTicks(0, val * 1.25, 4);
  const yMax = Math.max(val * 1.25, ticks[ticks.length - 1] ?? 1);
  const step = (ticks[1] ?? yMax) - (ticks[0] ?? 0);
  const decimals = Math.max(0, -Math.floor(Math.log10(step) + 1e-9));
  const E = energyKWh(P, hours);
  return (
    <Plot
      x={{ min: 0, max: 24, label: 'Tid i bruk per døgn (h)', ticks: [0, 4, 8, 12, 16, 20, 24] }}
      y={{ min: 0, max: yMax, label: `Effekt P (${kw ? 'kW' : 'W'})`, ticks, decimals }}
      width={800}
      height={H}
    >
      {({ sx, sy, y0 }) => {
        const wRect = sx(hours) - sx(0);
        const text = `W = P·t = ${fmtW(P)} · ${fmtHours(hours)} = ${fmtKWh(E)} kWh`;
        const tw = textWidth(text.length, f);
        const inside = wRect > tw + 24;
        return (
          <g>
            {hours > 0 && (
              <rect x={sx(0)} y={sy(val)} width={wRect} height={y0 - sy(val)} fill={EL.energy} fillOpacity={0.28} stroke={EL.energy} strokeWidth={2} />
            )}
            <line x1={sx(0)} x2={sx(hours)} y1={sy(val)} y2={sy(val)} stroke={EL.power} strokeWidth={3.5} />
            <line x1={sx(hours)} x2={sx(24)} y1={y0} y2={y0} stroke={EL.power} strokeWidth={3.5} />
            {hours > 0 && hours < 24 && <line x1={sx(hours)} x2={sx(hours)} y1={sy(val)} y2={y0} stroke={EL.power} strokeWidth={2} strokeDasharray="5 4" />}
            <Tag
              x={inside ? sx(hours / 2) : Math.min(sx(hours) + 12, sx(24) - tw)}
              y={inside ? (sy(val) + y0) / 2 + 6 * f : sy(val) - 12}
              anchor={inside ? 'middle' : 'start'}
              weight={700}
            >
              {hours > 0 ? text : 'Apparatet er ikke i bruk: W = 0'}
            </Tag>
            <Tag x={sx(24) - 6} y={sy(val) - 12} anchor="end" color={EL.power} weight={650}>
              {hours > 0 && inside ? `P = ${fmtW(P)}` : ''}
            </Tag>
          </g>
        );
      }}
    </Plot>
  );
}

const rowH = (narrow: boolean) => (narrow ? 58 : 38);
function barsHeight(narrow: boolean, custom: boolean): number {
  return 12 + (APPLIANCES.length + (custom ? 1 : 0)) * rowH(narrow);
}

function MonthBars({ preset, P, hours, price, narrow, W }: { preset: string; P: number; hours: number; price: number; narrow: boolean; W: number }) {
  const f = useTextScale();
  const rows = APPLIANCES.map((a) => ({
    id: a.id,
    name: a.name,
    on: a.id === preset,
    ...monthly(a.id === preset ? P : a.P, a.id === preset ? hours : a.hours, price),
  }));
  if (preset === CUSTOM) rows.push({ id: CUSTOM, name: 'Egendefinert', on: true, ...monthly(P, hours, price) });
  const max = Math.max(1e-9, ...rows.map((r) => r.kWh));
  const nameW = narrow ? 0 : textWidth(19, f) + 16;
  const valueW = narrow ? 0 : textWidth(19, f);
  const x0 = 12 + nameW;
  const x1 = W - 12 - valueW;
  const h = rowH(narrow);
  return (
    <g>
      {rows.map((r, k) => {
        const y = 10 + k * h;
        const barY = narrow ? y + 20 * f : y + 4;
        const w = Math.max(2, (r.kWh / max) * (x1 - x0));
        const value = `${fmtKWh(r.kWh)} kWh · ${fmtKr(r.cost)} kr`;
        return (
          <g key={r.id}>
            <Tag x={narrow ? 12 : x0 - 12} y={narrow ? y + 14 * f : barY + 15} anchor={narrow ? 'start' : 'end'} weight={r.on ? 750 : 560} muted={!r.on}>
              {r.name}
            </Tag>
            <rect x={x0} y={barY} width={w} height={narrow ? 16 : 22} rx={4} fill={EL.energy} fillOpacity={r.on ? 0.85 : 0.3} />
            <Tag
              x={narrow ? W - 12 : x0 + w + 10}
              y={narrow ? y + 14 * f : barY + 15}
              anchor={narrow ? 'end' : 'start'}
              weight={r.on ? 750 : 560}
              muted={!r.on}
            >
              {value}
            </Tag>
          </g>
        );
      })}
      <line x1={x0} x2={x0} y1={6} y2={10 + rows.length * h} className="viz-axis" />
    </g>
  );
}

function explanation(name: string, P: number, hours: number, perDay: number, perMonth: number, I: number): ReactNode {
  let compare: ReactNode;
  if (hours === 0) compare = 'Står apparatet av, bruker det ingen energi uansett hvor stor effekten er.';
  else if (P >= 1500 && hours <= 0.5)
    compare = 'Effekten er stor, men tiden er så kort at energien blir liten. Det er energien, P·t, du betaler for, ikke effekten.';
  else if (P <= 50 && hours >= 4)
    compare = 'Effekten er liten, men selv lang brukstid gir lite energi sammenlignet med apparater som varmer.';
  else compare = 'Apparater som lager varme (ovner, bereder, vannkoker) har stor effekt, og de som står på lenge, dominerer strømregningen.';
  return (
    <>
      <p>
        <strong>Effekt er hvor fort energien brukes, energi er effekt ganger tid.</strong> {name} har P = {fmtW(P)} og står på{' '}
        {fmtHours(hours)} per døgn, så den bruker W = P·t = {fmtKWh(perDay)} kWh per døgn og {fmtKWh(perMonth)} kWh per måned. Arealet
        under grafen er energien. {compare}
      </p>
      <p>
        Med U = {MAINS_U} V gir P = U·I en strøm på {fmtI(I)} A.{' '}
        {I > FUSE
          ? `Det er mer enn en vanlig kurs på ${FUSE} A tåler, så slike apparater må ha egen kurs.`
          : Math.floor(FUSE / I) <= 10
            ? `En vanlig kurs i en bolig er sikret med ${FUSE} A, så bare ${Math.floor(FUSE / I)} slike apparater kan stå på samtidig på samme kurs.`
            : `Det er lite: en vanlig kurs i en bolig tåler ${FUSE} A.`}
      </p>
    </>
  );
}
