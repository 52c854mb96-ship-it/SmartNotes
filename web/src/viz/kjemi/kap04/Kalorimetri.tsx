import { useEffect, useId, useState, type ReactNode } from 'react';
import {
  Controls,
  Explain,
  Figure,
  Formel,
  Formula,
  FormulaLine,
  KJEMI,
  Legend,
  PlayControls,
  Plot,
  Readout,
  Readouts,
  Reaksjon,
  Select,
  Slider,
  TFormel,
  Toggle,
  Toolbar,
  Txt,
  VIZ,
  VizLayout,
  fmt,
  fmtSig,
  formula,
  linePath,
  mixColor,
  molarMass,
  niceTicks,
  sample,
  useContainerTextScale,
  useSimClock,
} from '../kit';
import {
  CAL_PROCESSES,
  C_ACID_BASE,
  C_WATER,
  SALT_MAX,
  TAU_MIX,
  T_END,
  T_START,
  calorimetry,
  dHFromMeasurement,
  deltaTAt,
  measuredDeltaT,
  type CalProcess,
  type CalResult,
} from './model';

const signed = (v: number, d = 1) => (v > 0 ? `+${fmt(v, d)}` : fmt(v, d));
/** Termometerets skala (°C). */
const TH_MIN = -10;
const TH_MAX = 100;

export default function Kalorimetri() {
  const [id, setId] = useState(CAL_PROCESSES[0]!.id);
  const [mSalt, setMSalt] = useState(4);
  const [Vwater, setVwater] = useState(100);
  const [Vacid, setVacid] = useState(50);
  const [Vbase, setVbase] = useState(50);
  const [loss, setLoss] = useState(false);
  // 300 s måling spilles av på 10 s
  const clock = useSimClock({ tMax: T_END, speed: 30 });
  const [ref, f] = useContainerTextScale<HTMLDivElement>();

  // Vis resultatet av hele målingen når siden åpnes; «Spill av» starter forsøket fra t = 0.
  const { setT } = clock;
  useEffect(() => setT(T_END), [setT]);

  const p = CAL_PROCESSES.find((x) => x.id === id) ?? CAL_PROCESSES[0]!;
  const r = calorimetry(p, { mSalt, Vwater, Vacid, Vbase });
  const meas = measuredDeltaT(r.dT, loss);
  const dHm = dHFromMeasurement(r.m, meas.dT, r.n);
  const tNow = clock.t;
  const dTnow = deltaTAt(tNow, r.dT, loss);
  const Tnow = T_START + dTnow;
  const exo = p.dH < 0;
  const tone = exo ? KJEMI.exo : KJEMI.endo;
  const errPct = ((dHm - p.dH) / p.dH) * 100;

  // På mobil tegnes figurene i en smalere viewBox (460 bred), så kalorimeteret og grafen blir store nok.
  const narrow = f > 1.3;
  const W = narrow ? 460 : 800;
  const sceneH = narrow ? 420 : 330;

  return (
    <VizLayout>
      <Toolbar>
        <Select
          label="Forsøk"
          value={id}
          onChange={(v) => {
            setId(v);
            // Hold massen innenfor det som løses helt (KNO₃ har lavere grense)
            const next = CAL_PROCESSES.find((x) => x.id === v);
            setMSalt((m) => Math.min(m, next?.mMax ?? SALT_MAX));
          }}
          options={CAL_PROCESSES.map((x) => ({ value: x.id, label: x.name }))}
        />
        <Toggle label="Varmetap til omgivelsene" checked={loss} onChange={setLoss} />
      </Toolbar>
      <Controls>
        {p.kind === 'salt' ? (
          <>
            <Slider
              label={
                <>
                  Masse <Formel f={p.salt!} />
                </>
              }
              ariaLabel="Masse salt"
              value={mSalt}
              onChange={setMSalt}
              min={1}
              max={p.mMax ?? SALT_MAX}
              step={0.5}
              unit="g"
              decimals={1}
            />
            <Slider label="Volum vann" value={Vwater} onChange={setVwater} min={50} max={200} step={10} unit="mL" />
          </>
        ) : (
          <>
            <Slider
              label={`Saltsyre (${fmt(C_ACID_BASE, 2)} mol/L)`}
              ariaLabel="Volum saltsyre"
              value={Vacid}
              onChange={setVacid}
              min={10}
              max={100}
              step={5}
              unit="mL"
            />
            <Slider
              label={`Natronlut (${fmt(C_ACID_BASE, 2)} mol/L)`}
              ariaLabel="Volum natronlut"
              value={Vbase}
              onChange={setVbase}
              min={10}
              max={100}
              step={5}
              unit="mL"
            />
          </>
        )}
      </Controls>
      <PlayControls clock={clock} decimals={0} />

      <div ref={ref}>
        <Figure viewBox={`0 0 ${W} ${sceneH}`} label={`Kaffekoppkalorimeter. Temperaturen er ${fmt(Tnow, 1)} °C etter ${fmt(tNow, 0)} s.`} maxHeight={sceneH}>
          <Scene p={p} mSalt={mSalt} Vwater={Vwater} Vacid={Vacid} Vbase={Vbase} T={Tnow} t={tNow} loss={loss} narrow={narrow} />
        </Figure>
      </div>

      <Figure viewBox={`0 0 ${W} ${narrow ? 360 : 380}`} label={`Temperaturen som funksjon av tiden. Største endring ${signed(meas.dT)} °C.`}>
        <TempPlot dT={r.dT} loss={loss} t={tNow} meas={meas} tone={tone} W={W} H={narrow ? 360 : 380} />
      </Figure>
      <Legend
        items={[
          { color: tone, label: loss ? 'Målt temperatur (med varmetap)' : 'Målt temperatur' },
          ...(loss ? [{ color: VIZ.muted, label: 'Uten varmetap', dashed: true }] : []),
        ]}
      />

      <Readouts>
        <Readout label="ΔT målt" value={signed(meas.dT)} unit="°C" tone={tone} />
        <Readout label="Varme q til løsningen" value={signed((r.m * C_WATER * meas.dT) / 1000, 2)} unit="kJ" />
        <Readout
          label={
            p.kind === 'salt' ? (
              <>
                n(<Formel f={p.salt!} />)
              </>
            ) : (
              <>
                n(<Formel f="H2O" />) dannet
              </>
            )
          }
          value={fmtSig(r.n)}
          unit="mol"
        />
        <Readout label="ΔH beregnet" value={signed(dHm, 1)} unit="kJ/mol" tone={tone} />
      </Readouts>

      <Formula label="Utregning">
        <FormulaLine>
          <Reaksjon r={p.equation} /> &nbsp; ΔH = {signed(p.dH, 1)} kJ/mol (tabell)
        </FormulaLine>
        {p.kind === 'salt' ? (
          <FormulaLine>
            n = m / M = {fmt(mSalt, 1)} g / {fmt(molarMass(formula(p.salt!)), 2)} g/mol = {fmtSig(r.n)} mol; &nbsp; m(løsning) = {fmt(Vwater, 0)} g +{' '}
            {fmt(mSalt, 1)} g = {fmt(r.m, 1)} g
          </FormulaLine>
        ) : (
          <FormulaLine>
            n(
            <Formel f="H2O" />) = n(
            <Formel f={Vacid <= Vbase ? 'HCl' : 'NaOH'} />) = {fmt(C_ACID_BASE, 2)} mol/L · {fmt(Math.min(Vacid, Vbase) / 1000, 3)} L = {fmtSig(r.n)} mol; &nbsp; m ={' '}
            {fmt(Vacid + Vbase, 0)} mL · 1,00 g/mL = {fmt(r.m, 0)} g
          </FormulaLine>
        )}
        <FormulaLine>
          q = m · c · ΔT = {fmt(r.m, 1)} g · {fmt(C_WATER, 2)} J/(g · °C) · {signed(meas.dT, 2)} °C = {signed(r.m * C_WATER * meas.dT, 0)} J
        </FormulaLine>
        <FormulaLine>
          ΔH = −q / n = {signed((-r.m * C_WATER * meas.dT) / 1000, 2)} kJ / {fmtSig(r.n)} mol = {signed(dHm, 1)} kJ/mol
        </FormulaLine>
      </Formula>

      <Explain>
        {tNow < meas.t - 1e-6 && (
          <p>
            <strong>{tNow <= 0 ? 'Forsøket har ikke startet.' : `Forsøket pågår: T = ${fmt(Tnow, 1)} °C etter ${fmt(tNow, 0)} s.`}</strong>{' '}
            {tNow <= 0 ? 'Spill av for å se temperaturen endre seg.' : `Temperaturen ${exo ? 'stiger' : 'synker'} fortsatt.`} Resultatet under gjelder når den
            {loss ? ` har nådd ${exo ? 'toppen' : 'bunnen'} etter ${fmt(meas.t, 0)} s.` : ' har flatet ut.'}
          </p>
        )}
        {explanation(p, r, meas.dT, dHm, errPct, loss, Vacid, Vbase)}
      </Explain>
    </VizLayout>
  );
}

/* ---------- Figur 1: kalorimeteret ---------- */

function Scene({
  p,
  mSalt,
  Vwater,
  Vacid,
  Vbase,
  T,
  t,
  loss,
  narrow,
}: {
  p: CalProcess;
  mSalt: number;
  Vwater: number;
  Vacid: number;
  Vbase: number;
  T: number;
  t: number;
  loss: boolean;
  narrow: boolean;
}) {
  const clipId = `kj-kal${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
  const f = 1;
  const cx = narrow ? 150 : 200;
  const topY = 92;
  const botY = narrow ? 270 : 280;
  const wTop = narrow ? 180 : 200;
  const wBot = narrow ? 136 : 150;
  const vol = p.kind === 'salt' ? Vwater : Vacid + Vbase;
  const level = 0.25 + 0.6 * Math.min(1, vol / 200);
  const surface = botY - level * (botY - topY - 10);
  const halfAt = (y: number) => wBot / 2 + ((wTop - wBot) / 2) * ((botY - y) / (botY - topY));
  const cup = (o: number) =>
    `M${cx - wTop / 2 - o},${topY - o * 0.3} L${cx - wBot / 2 - o * 0.8},${botY + o} L${cx + wBot / 2 + o * 0.8},${botY + o} L${cx + wTop / 2 + o},${topY - o * 0.3}`;
  const exo = p.dH < 0;
  const tone = exo ? KJEMI.exo : KJEMI.endo;
  // Væsken farges svakt etter hvor varm/kald den er.
  const warmth = Math.min(1, Math.abs(T - T_START) / 25);
  const liquid = mixColor(KJEMI.liquid, T >= T_START ? KJEMI.exo : KJEMI.endo, warmth * 0.35);
  const undissolved = p.kind === 'salt' ? Math.exp(-t / TAU_MIX) : 0;
  const heap = Math.sqrt(Math.max(0, undissolved) * Math.min(1, mSalt / 15)) * 40;
  // Termometeret
  const tx = narrow ? 345 : 430;
  const tTop = 40;
  const tBot = botY - 10;
  const ty = (c: number) => tBot - 22 - ((c - TH_MIN) / (TH_MAX - TH_MIN)) * (tBot - 22 - tTop - 10);
  const colY = ty(Math.max(TH_MIN, Math.min(TH_MAX, T)));
  const textX = narrow ? 24 : 540;
  const textY = narrow ? botY + 64 : 70;
  const lines: { text: ReactNode; strong?: boolean; color?: string }[] = [
    { text: <>T = {fmt(T, 1)} °C</>, strong: true, color: Math.abs(T - T_START) > 0.05 ? tone : undefined },
    { text: <>Start: {fmt(T_START, 1)} °C</> },
    {
      text:
        p.kind === 'salt' ? (
          <>
            {fmt(mSalt, 1)} g <TFormel f={p.salt!} /> i {fmt(Vwater, 0)} mL vann
          </>
        ) : (
          <>
            {fmt(Vacid, 0)} mL <TFormel f="HCl" /> + {fmt(Vbase, 0)} mL <TFormel f="NaOH" />
          </>
        ),
    },
  ];
  const lossArrows = loss && Math.abs(T - T_START) > 0.3;
  const out = T > T_START;
  return (
    <g>
      {/* Ytre og indre isoporkopp */}
      <path d={`${cup(12)} Z`} fill={VIZ.body} stroke={VIZ.muted} strokeWidth={2} />
      <path d={`${cup(0)} Z`} fill={KJEMI.glassFill} stroke={VIZ.muted} strokeWidth={2} />
      <clipPath id={clipId}>
        <path d={`${cup(-3)} Z`} />
      </clipPath>
      <g clipPath={`url(#${clipId})`}>
        <rect x={cx - wTop} y={surface} width={2 * wTop} height={botY - surface + 4} fill={liquid} />
        <line x1={cx - wTop} y1={surface} x2={cx + wTop} y2={surface} stroke={KJEMI.liquidLine} strokeWidth={2} />
        {heap > 2 && (
          <path
            d={`M${cx - 10 - heap},${botY - 2} Q${cx - 10},${botY - 2 - heap * 0.9} ${cx - 10 + heap},${botY - 2} Z`}
            fill={VIZ.surface}
            stroke={VIZ.muted}
            strokeWidth={1.2}
          />
        )}
      </g>
      {/* Lokk, rører og lite termometer */}
      <rect x={cx - wTop / 2 - 22} y={topY - 22} width={wTop + 44} height={16} rx={5} fill={VIZ.bodyStrong} stroke={VIZ.muted} strokeWidth={1.5} />
      <line x1={cx - 40} y1={topY - 46} x2={cx - 40} y2={botY - 24} stroke={VIZ.muted} strokeWidth={3} />
      <ellipse cx={cx - 40} cy={botY - 24} rx={22} ry={5} fill="none" stroke={VIZ.muted} strokeWidth={3} />
      <rect x={cx + 30} y={topY - 60} width={10} height={botY - topY + 30} rx={5} fill={KJEMI.glassFill} stroke={KJEMI.glass} strokeWidth={1.5} />
      <circle cx={cx + 35} cy={botY - 26} r={9} fill={KJEMI.minus} />
      <line x1={cx + 40} y1={topY - 40} x2={tx - 24} y2={tTop + 20} stroke={VIZ.muted} strokeWidth={1.2} strokeDasharray="4 4" />
      <Txt x={cx} y={botY + 34} muted size={0.85}>
        kaffekoppkalorimeter
      </Txt>

      {/* Varmetap gjennom veggen */}
      {lossArrows &&
        [0.35, 0.7].map((u) => {
          const y = topY + u * (botY - topY);
          const xw = cx - halfAt(y) - 14;
          const x1 = out ? xw + 6 : xw - 56;
          const x2 = out ? xw - 56 : xw + 6;
          const dir = x2 > x1 ? 1 : -1;
          return (
            <g key={u}>
              <path
                d={`M${x1},${y} q${dir * 12},-8 ${dir * 24},0 q${dir * 12},8 ${dir * 24},0`}
                fill="none"
                stroke={out ? KJEMI.exo : KJEMI.endo}
                strokeWidth={2.5}
              />
              <polygon points={`${x2},${y} ${x2 - dir * 11},${y - 6} ${x2 - dir * 11},${y + 6}`} fill={out ? KJEMI.exo : KJEMI.endo} />
            </g>
          );
        })}

      {/* Stort termometer */}
      <rect x={tx - 11} y={tTop} width={22} height={tBot - tTop - 14} rx={11} fill={KJEMI.glassFill} stroke={KJEMI.glass} strokeWidth={2} />
      <rect x={tx - 5} y={colY} width={10} height={tBot - colY - 10} fill={KJEMI.minus} />
      <circle cx={tx} cy={tBot} r={17} fill={KJEMI.minus} stroke={KJEMI.glass} strokeWidth={2} />
      <line x1={tx - 14} y1={ty(T_START)} x2={tx + 14} y2={ty(T_START)} stroke={VIZ.muted} strokeWidth={1.5} strokeDasharray="3 3" />
      {Array.from({ length: (TH_MAX - TH_MIN) / 10 + 1 }, (_, i) => TH_MIN + i * 10).map((c) => (
        <g key={c}>
          <line x1={tx + 11} y1={ty(c)} x2={tx + 19} y2={ty(c)} stroke={KJEMI.glass} strokeWidth={1.5} />
          {c % 20 === 0 && (
            <Txt x={tx + 24} y={ty(c) + 5} anchor="start" size={0.7} muted>
              {fmt(c, 0)}
            </Txt>
          )}
        </g>
      ))}
      <Txt x={tx} y={tTop - 10} size={0.8} muted>
        °C
      </Txt>

      {lines.map((l, i) => (
        <Txt key={i} x={textX} y={textY + i * 32 * f} anchor="start" size={l.strong ? 1.2 : 0.9} weight={l.strong ? 700 : 550} color={l.color}>
          {l.text}
        </Txt>
      ))}
      {!narrow && (
        <Txt x={textX} y={textY + 3 * 32 * f + 8} anchor="start" size={0.8} muted>
          {loss ? 'Koppen utveksler varme med lufta' : 'Ingen varme slipper ut eller inn'}
        </Txt>
      )}
    </g>
  );
}

/* ---------- Figur 2: temperatur–tid ---------- */

function TempPlot({
  dT,
  loss,
  t,
  meas,
  tone,
  W,
  H,
}: {
  dT: number;
  loss: boolean;
  t: number;
  meas: { dT: number; t: number };
  tone: string;
  W: number;
  H: number;
}) {
  const lo = Math.min(T_START, T_START + dT);
  const hi = Math.max(T_START, T_START + dT);
  const pad = Math.max(1, (hi - lo) * 0.15);
  const ticks = niceTicks(lo - pad, hi + pad, 5);
  const yMin = Math.min(ticks[0]!, lo - pad);
  const yMax = Math.max(ticks[ticks.length - 1]!, hi + pad);
  const dec = yMax - yMin < 4 ? 1 : 0;
  const full = sample((x) => T_START + deltaTAt(x, dT, loss), 0, T_END, 300);
  const done = full.filter(([x]) => x <= t + 1e-9);
  const ideal = sample((x) => T_START + deltaTAt(x, dT, false), 0, T_END, 300);
  return (
    <Plot
      x={{ min: 0, max: T_END, label: 'Tid t (s)', ticks: [0, 60, 120, 180, 240, 300] }}
      y={{ min: yMin, max: yMax, label: 'Temperatur T (°C)', ticks: niceTicks(yMin, yMax, 5), decimals: dec }}
      width={W}
      height={H}
    >
      {({ sx, sy, x0, x1 }) => (
        <g>
          <line x1={x0} x2={x1} y1={sy(T_START)} y2={sy(T_START)} stroke={VIZ.muted} strokeWidth={1.2} strokeDasharray="4 4" />
          {loss && <path d={linePath(ideal, sx, sy)} fill="none" stroke={VIZ.muted} strokeWidth={2} strokeDasharray="7 6" />}
          <path d={linePath(full, sx, sy)} fill="none" stroke={tone} strokeWidth={2} opacity={0.3} />
          <path d={linePath(done, sx, sy)} fill="none" stroke={tone} strokeWidth={3.5} />
          {t >= meas.t && (
            <g>
              <line x1={sx(meas.t)} x2={sx(meas.t)} y1={sy(T_START)} y2={sy(T_START + meas.dT)} stroke={tone} strokeWidth={2} strokeDasharray="3 3" />
              <circle cx={sx(meas.t)} cy={sy(T_START + meas.dT)} r={6} fill={tone} />
              <Txt
                x={sx(meas.t) + (meas.t > 200 ? -10 : 10)}
                y={sy(T_START + meas.dT / 2) + 5}
                anchor={meas.t > 200 ? 'end' : 'start'}
                color={tone}
                weight={700}
                size={0.9}
              >
                ΔT = {signed(meas.dT, 1)} °C
              </Txt>
            </g>
          )}
          <line x1={sx(t)} x2={sx(t)} y1={sy(yMin)} y2={sy(yMax)} stroke={VIZ.ink} strokeWidth={1.2} opacity={0.5} />
          <circle cx={sx(t)} cy={sy(T_START + deltaTAt(t, dT, loss))} r={7} fill={VIZ.ink} stroke={VIZ.surface} strokeWidth={2} />
        </g>
      )}
    </Plot>
  );
}

/* ---------- Forklaring ---------- */

function explanation(p: CalProcess, r: CalResult, dTm: number, dHm: number, errPct: number, loss: boolean, Vacid: number, Vbase: number): ReactNode {
  const exo = p.dH < 0;
  return (
    <>
      <p>
        <strong>
          Temperaturen {exo ? 'stiger' : 'synker'} med {fmt(Math.abs(dTm), 1)} °C, så prosessen er {exo ? 'eksoterm' : 'endoterm'}.
        </strong>{' '}
        {exo
          ? 'Systemet (stoffene som reagerer) avgir varme til vannet. Vannet er omgivelsene: det tar opp q = m · c · ΔT, og derfor er ΔH = −q/n negativ.'
          : 'Systemet tar varme fra vannet. Vannet blir kaldere, q for vannet er negativ, og derfor er ΔH = −q/n positiv.'}{' '}
        Termometeret måler omgivelsene, ikke systemet.
      </p>
      <p>
        {loss ? (
          <>
            <strong>Feilkilde: varmetap.</strong> Koppen utveksler varme med lufta, så temperaturen når ikke helt {fmt(T_START + r.dT, 1)} °C før den{' '}
            {exo ? 'synker' : 'stiger'} tilbake mot romtemperatur. Den målte |ΔT| blir for liten, og dermed blir også |ΔH| for liten: {signed(dHm, 1)} kJ/mol i
            stedet for {signed(p.dH, 1)} kJ/mol ({fmt(Math.abs(errPct), 0)} % for lite). Det er en systematisk feil, som blir mindre med lokk og isopor, rask
            måling, eller ved å forlenge avkjølingskurven tilbake til blandetidspunktet.
          </>
        ) : (
          <>
            Uten varmetap tar løsningen opp all varmen, og beregningen gir tabellverdien {signed(p.dH, 1)} kJ/mol. Modellen antar at løsningen har samme
            varmekapasitet som vann (4,18 J/(g · °C)) og at koppen selv ikke tar opp varme. Slå på varmetap for å se hvordan en vanlig feilkilde påvirker
            resultatet.
          </>
        )}
      </p>
      <p>
        {p.kind === 'salt' ? (
          <>
            Massen i q = m · c · ΔT er massen av hele løsningen ({fmt(r.m, 1)} g), både vannet og saltet, fordi alt får samme temperatur. Dobler du saltmengden,
            dobles både q og n, så ΔH per mol er den samme.
          </>
        ) : r.excess ? (
          <>
            Det er overskudd av {r.excess === 'base' ? 'natronlut' : 'saltsyre'}. Det dannes bare like mye vann som den begrensende reaktanten gir,{' '}
            {fmtSig(r.n)} mol, men hele {fmt(Vacid + Vbase, 0)} g løsning varmes opp. Derfor blir ΔT mindre enn med like store volum.
          </>
        ) : (
          <>
            Saltsyre og natronlut reagerer i forholdet 1 : 1, og egentlig er det <Formel f="H3O^+" state="aq" /> og <Formel f="OH^-" state="aq" /> som reagerer
            og danner vann. Derfor gir alle sterke syrer og baser omtrent den samme nøytralisasjonsentalpien, −57 kJ per mol vann.
          </>
        )}
      </p>
    </>
  );
}
