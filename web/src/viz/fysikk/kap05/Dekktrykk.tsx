import { useEffect, useState, type ReactNode } from 'react';
import { Pause, Play, RotateCcw } from 'lucide-react';
import {
  Controls,
  Explain,
  Formula,
  FormulaLine,
  Legend,
  Readout,
  Readouts,
  Segmented,
  Slider,
  Sub,
  Toggle,
  Toolbar,
  VIZ,
  VizLayout,
  fmt,
  useSimClock,
  type SimClock,
} from '../../kit';
import {
  DEKK,
  P0_BAR,
  driveProgress,
  predictTyre,
  solveTyre,
  tyreAirTemperature,
  zeroGaugeTemperature,
  type TyreMethod,
  type TyrePrediction,
  type TyreState,
} from './model-dekktrykk';
import { DekktrykkScene } from './dekktrykk-scene';
import { DekktrykkGraf } from './dekktrykk-graf';

const METHODS: { value: TyreMethod; label: string }[] = [
  { value: 'riktig', label: 'Riktig: kelvin' },
  { value: 'celsius', label: 'Feil: celsius' },
  { value: 'manometer', label: 'Feil: glemt lufttrykket' },
];

/** Avspillingen: hele tiden ute (5 timer) går på ca. 8 sekunder. */
const PLAY_SPEED = DEKK.hours.max / 8;

const bar = (v: number) => `${fmt(v, 2)} bar`;
/** Temperatur med én desimal bare når den trengs (midt i avkjølingen). */
const fmtT = (v: number) => fmt(v, Math.abs(v - Math.round(v)) < 0.05 ? 0 : 1);
const deg = (v: number) => `${fmtT(v)} °C`;
const kelvin = (v: number) => `${fmt(v, 2)} K`;

export default function Dekktrykk() {
  const [fill, setFill] = useState<number>(DEKK.fill.start);
  const [tGarage, setTGarage] = useState<number>(DEKK.garage.start);
  const [tOutside, setTOutside] = useState<number>(DEKK.outside.start);
  const [method, setMethod] = useState<TyreMethod>('riktig');
  const [extended, setExtended] = useState(false);
  const clock = useSimClock({ tMax: DEKK.hours.max, speed: PLAY_SPEED });
  const { setT } = clock;
  useEffect(() => setT(DEKK.hours.start), [setT]);

  const hours = clock.t;
  // Lufta i dekket avrundet til 0,1 °C, så tallene i formelen, avlesningene og forklaringen stemmer med hverandre
  const tTyre = Math.round(tyreAirTemperature(tGarage, tOutside, hours) * 10) / 10;
  const s = solveTyre(fill, tGarage, tTyre);
  const pred = predictTyre(method, fill, tGarage, tTyre);
  const drive = driveProgress(hours);
  const where = drive <= 0 ? 'står i garasjen' : drive < 1 ? 'ruller ut av garasjen' : `har stått ute i ${fmtHours(hours)}`;

  return (
    <VizLayout>
      <Controls>
        <Slider
          label="Fylt til i garasjen (det måleren viser)"
          value={fill}
          onChange={setFill}
          min={DEKK.fill.min}
          max={DEKK.fill.max}
          step={DEKK.fill.step}
          unit="bar"
          decimals={1}
        />
        <Slider
          label="Temperatur i garasjen"
          value={tGarage}
          onChange={setTGarage}
          min={DEKK.garage.min}
          max={DEKK.garage.max}
          step={DEKK.garage.step}
          unit="°C"
        />
        <Slider
          label="Temperatur ute"
          value={tOutside}
          onChange={setTOutside}
          min={DEKK.outside.min}
          max={DEKK.outside.max}
          step={DEKK.outside.step}
          unit="°C"
        />
        <Slider
          label="Tid ute"
          value={hours}
          onChange={(v) => {
            clock.pause();
            setT(v);
          }}
          min={DEKK.hours.min}
          max={DEKK.hours.max}
          step={DEKK.hours.step}
          format={fmtHours}
        />
      </Controls>
      <Toolbar>
        <PlayButtons clock={clock} />
        <Toggle label="Vis helt ned til 0 K" checked={extended} onChange={setExtended} />
      </Toolbar>

      <DekktrykkScene
        tGarage={tGarage}
        tOutside={tOutside}
        tTyre={tTyre}
        gauge={s.pm2}
        filled={fill}
        drive={drive}
        label={`Bilen ${where}. I garasjen er det ${deg(tGarage)}, ute ${deg(tOutside)}, og lufta i dekket er ${deg(
          tTyre,
        )}. Dekket ble fylt til ${bar(fill)}, og dekktrykkmåleren viser nå ${bar(s.pm2)}.`}
      />

      <Toolbar>
        <Segmented label="Velg regnemåte" options={METHODS} value={method} onChange={setMethod} />
      </Toolbar>
      <DekktrykkGraf s={s} tOutside={tOutside} method={method} pred={pred} extended={extended} />
      <Legend
        items={[
          { color: VIZ.series[0], label: 'Absolutt trykk p i dekket' },
          { color: VIZ.series[2], label: <span>Manometertrykk p<Sub>m</Sub>: det måleren viser</span> },
          { color: VIZ.muted, label: <span>Lufttrykket p<Sub>0</Sub> utenfor (forskjellen)</span> },
          ...(method !== 'riktig' ? [{ color: VIZ.series[4], label: METHOD_LEGEND[method], dashed: true }] : []),
        ]}
      />

      <Readouts>
        <Readout label="Lufta i dekket" value={fmtT(tTyre)} unit={`°C = ${fmt(s.T2, 0)} K`} tone={VIZ.series[1]} />
        <Readout label={<>Måleren viser p<Sub>m</Sub></>} value={fmt(s.pm2, 2)} unit="bar" tone={VIZ.series[2]} />
        <Readout label="Absolutt trykk p" value={fmt(s.p2, 2)} unit="bar" tone={VIZ.series[0]} />
        <Readout
          label={s.drop >= -1e-9 ? 'Trykkfall siden fyllingen' : 'Trykkøkning siden fyllingen'}
          value={fmt(Math.abs(s.drop), 2)}
          unit={`bar (${fmt(Math.abs(s.dropShareGauge) * 100, 0)} %)`}
        />
      </Readouts>

      <Formula label={FORMULA_LABEL[method]}>{formulaLines(method, s, pred)}</Formula>

      <Explain>{explanation({ method, s, pred, hours, drive, tOutside, extended })}</Explain>
    </VizLayout>
  );
}

const METHOD_LEGEND: Record<Exclude<TyreMethod, 'riktig'>, string> = {
  celsius: 'Feil: p = p₁ · t/t₁ med celsius',
  manometer: 'Feil: pₘ = pₘ₁ · T/T₁ uten lufttrykket',
};

const FORMULA_LABEL: Record<TyreMethod, string> = {
  riktig: 'Utregning med absolutt trykk og kelvin',
  celsius: 'Den vanlige feilen: celsius i stedet for kelvin',
  manometer: 'Den vanlige feilen: manometertrykket i stedet for absolutt trykk',
};

function fmtHours(h: number): string {
  const total = Math.round(h * 60);
  const hh = Math.floor(total / 60);
  const mm = total % 60;
  if (hh === 0) return `${mm} min`;
  return mm === 0 ? `${hh} h` : `${hh} h ${mm} min`;
}

function PlayButtons({ clock }: { clock: SimClock }) {
  return (
    <div className="viz-play">
      <button type="button" className="btn btn-sm" onClick={clock.toggle} aria-pressed={clock.playing}>
        {clock.playing ? <Pause size={16} aria-hidden /> : <Play size={16} aria-hidden />}
        {clock.playing ? 'Pause' : 'Spill av'}
      </button>
      <button type="button" className="btn btn-sm btn-ghost" onClick={clock.reset}>
        <RotateCcw size={16} aria-hidden />
        Tilbake til garasjen
      </button>
    </div>
  );
}

function formulaLines(method: TyreMethod, s: TyreState, pred: TyrePrediction): ReactNode {
  const p1 = (
    <FormulaLine>
      p<Sub>1</Sub> = p<Sub>m1</Sub> + p<Sub>0</Sub> = {bar(s.pm1)} + {bar(P0_BAR)} = {bar(s.p1)}
    </FormulaLine>
  );
  const temps = (
    <FormulaLine>
      T<Sub>1</Sub> = {fmt(s.t1, 0)} + 273,15 = {kelvin(s.T1)} og T<Sub>2</Sub> = {fmtT(s.t2)} + 273,15 = {kelvin(s.T2)}
    </FormulaLine>
  );
  if (method === 'celsius')
    return (
      <>
        {p1}
        <FormulaLine>
          Feil: p<Sub>2</Sub> = p<Sub>1</Sub> · t<Sub>2</Sub> / t<Sub>1</Sub> = {bar(s.p1)} · ({fmtT(s.t2)} °C) / ({fmt(s.t1, 0)} °C) ={' '}
          {bar(pred.p2)}
          {pred.impossible ? ' (umulig)' : ''}
        </FormulaLine>
        {temps}
        <FormulaLine>
          Riktig: p<Sub>2</Sub> = p<Sub>1</Sub> · T<Sub>2</Sub> / T<Sub>1</Sub> = {bar(s.p1)} · {kelvin(s.T2)} / {kelvin(s.T1)} = {bar(s.p2)}, så
          måleren viser {bar(s.pm2)}
        </FormulaLine>
      </>
    );
  if (method === 'manometer')
    return (
      <>
        {temps}
        <FormulaLine>
          Feil: p<Sub>m2</Sub> = p<Sub>m1</Sub> · T<Sub>2</Sub> / T<Sub>1</Sub> = {bar(s.pm1)} · {kelvin(s.T2)} / {kelvin(s.T1)} = {bar(pred.pm2)}
        </FormulaLine>
        {p1}
        <FormulaLine>
          Riktig: p<Sub>2</Sub> = {bar(s.p1)} · {kelvin(s.T2)} / {kelvin(s.T1)} = {bar(s.p2)}, og p<Sub>m2</Sub> = p<Sub>2</Sub> − p<Sub>0</Sub> ={' '}
          {bar(s.pm2)}
        </FormulaLine>
      </>
    );
  return (
    <>
      {temps}
      {p1}
      <FormulaLine>
        p<Sub>2</Sub> = p<Sub>1</Sub> · T<Sub>2</Sub> / T<Sub>1</Sub> = {bar(s.p1)} · {kelvin(s.T2)} / {kelvin(s.T1)} = {bar(s.p2)}
      </FormulaLine>
      <FormulaLine>
        p<Sub>m2</Sub> = p<Sub>2</Sub> − p<Sub>0</Sub> = {bar(s.p2)} − {bar(P0_BAR)} = {bar(s.pm2)}
      </FormulaLine>
    </>
  );
}

function explanation({
  method,
  s,
  pred,
  hours,
  drive,
  tOutside,
  extended,
}: {
  method: TyreMethod;
  s: TyreState;
  pred: TyrePrediction;
  hours: number;
  drive: number;
  tOutside: number;
  extended: boolean;
}): ReactNode {
  const same = Math.abs(s.T2 - s.T1) < 0.05;
  const cooling = s.T2 < s.T1;
  const sameOutside = Math.abs(tOutside - s.t1) < 0.5;
  const done = Math.abs(s.t2 - tOutside) < 0.05;
  const pctT = Math.abs(s.dropShareAbsolute) * 100;
  const pctG = Math.abs(s.dropShareGauge) * 100;
  const perBar = 0.1 / s.perKelvin;
  const parts: ReactNode[] = [];

  // 1. Hva som skjer i dekket
  if (hours <= 0 || same) {
    parts.push(
      sameOutside ? (
        <p key="a">
          <strong>Like varmt ute som i garasjen.</strong> Lufta i dekket holder {fmt(s.t1, 0)} °C, så trykket endrer seg ikke: måleren viser
          fortsatt {bar(s.pm1)}. Dra ned temperaturen ute for å se hva vinteren gjør.
        </p>
      ) : (
        <p key="a">
          <strong>Dekket er nettopp fylt til {bar(s.pm1)} i garasjen ({fmt(s.t1, 0)} °C).</strong> Det er det måleren viser:{' '}
          <em>manometertrykket</em>, altså hvor mye større trykket i dekket er enn lufttrykket utenfor. Det absolutte trykket i dekket er{' '}
          {bar(s.pm1)} + {bar(P0_BAR)} = {bar(s.p1)}. Trykk «Spill av» for å se hva som skjer når bilen står ute i {fmt(tOutside, 0)} °C.
        </p>
      ),
    );
  } else {
    const head = done ? (
      <strong>
        Lufta i dekket har fått utetemperaturen, {deg(s.t2)}{drive >= 1 ? ` (etter ${fmtHours(hours)} ute)` : ''}.
      </strong>
    ) : (
      <strong>
        Bilen har stått ute i {fmtHours(hours)}. Lufta i dekket er {deg(s.t2)}, ennå ikke like {cooling ? 'kald' : 'varm'} som lufta ute.
      </strong>
    );
    parts.push(
      <p key="a">
        {head} Volumet i dekket og mengden luft er nesten de samme, så det absolutte trykket er proporsjonalt med temperaturen i kelvin:
        p/T er konstant. T {cooling ? 'falt' : 'steg'} fra {fmt(s.T1, 0)} K til {fmt(s.T2, 0)} K, altså med {fmt(pctT, 1)} %, og det
        absolutte trykket {cooling ? 'falt' : 'steg'} like mange prosent, fra {bar(s.p1)} til {bar(s.p2)}. Måleren viser{' '}
        {fmt(Math.abs(s.drop), 2)} bar {cooling ? 'mindre' : 'mer'}: {bar(s.pm2)}. Det er {fmt(pctG, 0)} % av det den viste, fordi måleren
        ikke tar med de {bar(P0_BAR)} som lufta utenfor presser med.
      </p>,
    );
    if (!done)
      parts.push(
        <p key="b">
          Trykket følger temperaturen i <em>dekket</em>, ikke i lufta rundt. Felgen og gummien bruker et par timer på å få samme
          temperatur som lufta ute. Mål derfor dekktrykket når dekkene har samme temperatur som lufta der bilen skal stå.
        </p>,
      );
  }

  // 2. Vanlige feil
  if (method === 'celsius') {
    let what: ReactNode;
    if (!Number.isFinite(pred.p2)) what = <>Med celsius må du dele på null, og det gir ingen mening.</>;
    else if (pred.impossible)
      what = (
        <>
          Med celsius blir p<Sub>2</Sub> = {bar(pred.p2)}, et negativt absolutt trykk. Det er umulig: det absolutte trykket kan aldri bli
          mindre enn null.
        </>
      );
    else if (Math.abs(s.t2) < 0.5)
      what = <>Med celsius blir p<Sub>2</Sub> = 0 ved 0 °C, som om dekket skulle være helt tomt for luft.</>;
    else
      what = (
        <>
          Med celsius blir p<Sub>2</Sub> = {bar(pred.p2)} i stedet for {bar(s.p2)}, fordi {deg(s.t2)} / {fmt(s.t1, 0)} °C ={' '}
          {fmt(s.t2 / s.t1, 2)} er et helt annet forhold enn {fmt(s.T2, 0)} K / {fmt(s.T1, 0)} K = {fmt(s.T2 / s.T1, 3)}.
        </>
      );
    parts.push(
      <p key="c">
        <strong>Feil: regne i celsius.</strong> {what} Celsius-skalaen har nullpunktet ved frysepunktet til vann, ikke der trykket blir null.
        Forholdet p/T er bare konstant når T er i kelvin, som starter i det absolutte nullpunktet (0 K = −273,15 °C). Den stiplede linja går
        derfor gjennom 0 °C, mens trykket egentlig går mot null først ved −273 °C.
      </p>,
    );
  } else if (method === 'manometer') {
    parts.push(
      <p key="c">
        <strong>Feil: regne med det måleren viser.</strong> p<Sub>m1</Sub> · T<Sub>2</Sub>/T<Sub>1</Sub> gir {bar(pred.pm2)}, men måleren viser{' '}
        {bar(s.pm2)}. Utregningen gir {fmt(Math.abs(pred.error), 2)} bar for {pred.error > 0 ? 'høyt' : 'lavt'} trykk og for lite{' '}
        {cooling ? 'fall' : 'økning'}. Det er all lufta i dekket som blir {cooling ? 'kaldere' : 'varmere'}, også den delen av trykket (
        {bar(P0_BAR)}) som bare holder igjen lufttrykket utenfor. Legg derfor alltid til p<Sub>0</Sub> først, regn med p/T, og trekk fra p
        <Sub>0</Sub> til slutt.
      </p>,
    );
  } else if (!same) {
    parts.push(
      <p key="c">
        Regner du i celsius eller bare med det måleren viser, blir svaret feil. Velg en av feilene over grafen for å se hvor feil.
      </p>,
    );
  }

  // 3. Grafen helt ned til 0 K
  if (extended)
    parts.push(
      <p key="d">
        <strong>Helt ned til 0 K.</strong> Forlenger du linja for absolutt trykk, treffer den p = 0 ved −273,15 °C, det absolutte nullpunktet.
        Linja for måleren treffer null allerede ved {fmt(zeroGaugeTemperature(s), 0)} °C: der er trykket i dekket like stort som lufttrykket
        utenfor, og måleren viser 0 selv om det fortsatt er luft i dekket. (Ekte luft blir flytende lenge før 0 K, så linjen er en modell.)
      </p>,
    );

  // 4. Tommelfingerregel og hverdagsråd
  if (method === 'riktig' && !same && hours > 0)
    parts.push(
      <p key="e">
        Tommelfingerregel: med disse tallene endrer trykket seg med {fmt(s.perKelvin, 3)} bar per grad, omtrent 0,1 bar for hver{' '}
        {fmt(perBar, 0)}. grad.{' '}
        {cooling
          ? 'Fyller du dekkene i en varm garasje om vinteren, bør du derfor fylle litt over det anbefalte trykket, eller sjekke trykket igjen når dekkene er kalde. For lavt dekktrykk gir lengre bremselengde, dårligere veigrep og høyere forbruk.'
          : 'Om sommeren går det motsatt vei: dekkene blir varmere enn i garasjen, og måleren viser mer enn det du fylte. Slipp ikke ut luft av varme dekk, for da blir trykket for lavt når de er kalde igjen.'}
      </p>,
    );
  return <>{parts}</>;
}
