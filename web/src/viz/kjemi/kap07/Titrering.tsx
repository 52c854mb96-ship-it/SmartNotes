import { useEffect, useState, type ReactNode } from 'react';
import {
  Byrette,
  Controls,
  Dot,
  Erlenmeyerkolbe,
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
  Segmented,
  Select,
  Slider,
  Sub,
  TFormel,
  Reaksjon,
  TReaksjon,
  TSub,
  Toolbar,
  Txt,
  VIZ,
  VizLayout,
  byretteTipLength,
  fmt,
  fmtSig,
  linePath,
  useContainerTextScale,
  useSimClock,
  useTextScale,
} from '../kit';
import { indicatorColor, liquidWithIndicator } from './indikator';
import {
  INDICATORS,
  KA_ACETIC,
  endpoint,
  equivalenceVolume,
  indicatorColorWord,
  indicatorMid,
  pKa,
  titrationCurve,
  titrationPH,
  titrationPhase,
  type EndpointResult,
  type IndicatorId,
  type TitrationAcid,
  type TitrationSetup,
} from './model';

/** Sekunder det tar å tømme hele x-aksen fra byretten når du spiller av. */
const T_RUN = 12;
const CHOICES: IndicatorId[] = ['metyloransje', 'metylrodt', 'bromtymolblatt', 'fenolftalein'];
const PKA = pKa(KA_ACETIC);

const ACID_NAME: Record<TitrationAcid, string> = { HCl: 'saltsyre', CH3COOH: 'eddiksyre' };

/** Største volum på x-aksen: omtrent 2 · V_e, rundet opp til 5 mL, mellom 5 og 50 mL (byretten rommer 50 mL). */
function axisMax(Ve: number): number {
  return Math.min(50, Math.max(5, Math.ceil((2 * Ve) / 5) * 5));
}

export default function Titrering() {
  const [acid, setAcid] = useState<TitrationAcid>('CH3COOH');
  const [ca, setCa] = useState(0.1);
  const [Va, setVa] = useState(20);
  const [cb, setCb] = useState(0.1);
  const [ind, setInd] = useState<IndicatorId>('fenolftalein');
  const clock = useSimClock({ tMax: T_RUN, speed: 1 });
  const [ref, f] = useContainerTextScale<HTMLDivElement>();

  const setup: TitrationSetup = { acid, ca, Va, cb };
  const Ve = equivalenceVolume(setup);
  const xMax = axisMax(Ve);
  const Vb = Math.min(xMax, (clock.t / T_RUN) * xMax);
  const pH = titrationPH(setup, Vb);
  const indicator = INDICATORS[ind];
  const ep = endpoint(setup, indicator);
  const phase = titrationPhase(setup, Vb);

  // Start ved halvtitrerpunktet, der pH = pK_a for eddiksyre.
  const { setT } = clock;
  useEffect(() => setT(T_RUN / 4), [setT]);

  const scene = sceneLayout(f);
  const plotH = Math.round(360 + 400 * (f - 1));

  return (
    <VizLayout>
      <Toolbar>
        <Segmented
          label="Syre i kolben"
          options={[
            { value: 'HCl', label: <>Saltsyre, HCl</> },
            {
              value: 'CH3COOH',
              label: (
                <>
                  Eddiksyre, <Formel f="CH3COOH" />
                </>
              ),
            },
          ]}
          value={acid}
          onChange={setAcid}
        />
        <Select label="Indikator" value={ind} onChange={setInd} options={CHOICES.map((id) => ({ value: id, label: `${INDICATORS[id].name} (${fmt(INDICATORS[id].low, 1)}–${fmt(INDICATORS[id].high, 1)})` }))} />
      </Toolbar>
      <Controls>
        <Slider label="Tilsatt NaOH" value={Math.round(Vb * 100) / 100} onChange={(v) => setT((v / xMax) * T_RUN)} min={0} max={xMax} step={0.05} unit="mL" decimals={2} />
        <Slider label="Syrens konsentrasjon (ukjent)" value={ca} onChange={setCa} min={0.02} max={0.15} step={0.01} unit="mol/L" decimals={2} />
        <Slider label="Volum syre i kolben" value={Va} onChange={setVa} min={10} max={25} step={1} unit="mL" decimals={0} />
        <Slider label="Konsentrasjon NaOH" value={cb} onChange={setCb} min={0.1} max={0.2} step={0.01} unit="mol/L" decimals={2} />
      </Controls>
      <Toolbar>
        <PlayControls clock={clock} label="tid" decimals={1} />
      </Toolbar>

      <div ref={ref}>
        <Figure
          viewBox={`0 0 800 ${scene.H}`}
          label={`Titrering: ${fmt(Vb, 2)} mL NaOH er tilsatt ${fmt(Va, 0)} mL ${ACID_NAME[acid]}. pH-meteret viser ${fmt(pH, 2)}, og ${indicator.name} er ${indicatorColorWord(indicator, pH)}.`}
          maxHeight={scene.H}
        >
          <Scene setup={setup} Vb={Vb} pH={pH} ind={ind} dripping={clock.playing && Vb < xMax} layout={scene} f={f} />
        </Figure>
      </div>

      <Figure viewBox={`0 0 800 ${plotH}`} label={`Titrerkurve for ${ACID_NAME[acid]} med NaOH. Ekvivalenspunktet er ved ${fmt(Ve, 2)} mL.`} maxHeight={plotH}>
        <Curve setup={setup} xMax={xMax} Vb={Vb} pH={pH} ind={ind} ep={ep} H={plotH} />
      </Figure>
      <Legend
        items={[
          { color: VIZ.series[0]!, label: 'Titrerkurve (pH-meter)' },
          { color: indicatorColor(ind, indicatorMid(indicator)), label: `Omslagsområdet til ${indicator.name}` },
          { color: VIZ.muted, label: 'Ekvivalenspunkt', dashed: true },
        ]}
      />

      <Readouts>
        <Readout label="Tilsatt NaOH" value={fmt(Vb, 2)} unit="mL" />
        <Readout label="pH" value={fmt(pH, 2)} tone={VIZ.series[0]} />
        <Readout label="Endepunkt (indikatoren slår om)" value={fmt(ep.Vend, 2)} unit="mL" tone={ep.verdict === 'dårlig' ? KJEMI.minus : undefined} />
        <Readout label="Beregnet konsentrasjon av syra" value={fmtSig(ep.cFound, 3)} unit="mol/L" tone={ep.verdict === 'dårlig' ? KJEMI.minus : undefined} />
      </Readouts>

      <Formula label="Titreranalyse">
        <FormulaLine>
          n(NaOH) = c · V = {fmt(cb, 3)} mol/L · {fmt(ep.Vend / 1000, 5)} L = {fmtSig((cb * ep.Vend) / 1000, 3)} mol (ved endepunktet)
        </FormulaLine>
        <FormulaLine>
          n(<Formel f={acid} />) = n(NaOH) = {fmtSig((cb * ep.Vend) / 1000, 3)} mol (molforhold 1 : 1)
        </FormulaLine>
        <FormulaLine>
          c(<Formel f={acid} />) = n / V = {fmtSig((cb * ep.Vend) / 1000, 3)} mol / {fmt(Va / 1000, 4)} L = {fmtSig(ep.cFound, 3)} mol/L
        </FormulaLine>
        <FormulaLine>
          Riktig verdi: {fmtSig(ca, 3)} mol/L, avvik {fmt(ep.relError * 100, 1)} %
        </FormulaLine>
      </Formula>

      <Explain>{explanation(setup, Vb, pH, phase, ep, ind)}</Explain>
    </VizLayout>
  );
}

/* ---------- Figur 1: byrette, kolbe og pH-meter ---------- */

function sceneLayout(f: number) {
  const k = Math.max(1, 0.85 * f);
  const narrow = f > 1.3;
  const bx = narrow ? 210 : 230;
  const by = 30 * f;
  const bh = narrow ? 300 : 230;
  const tip = by + bh + byretteTipLength(k);
  const flask = { w: narrow ? 230 : 180, h: narrow ? 210 : 160 };
  const fy = tip - 26 * k;
  const meter = narrow ? { x: 440, y: by + 60, w: 330, h: 110 * f } : { x: 470, y: 70, w: 270, h: 120 };
  return { k, narrow, bx, by, bh, tip, flask, fy, meter, H: Math.round(fy + flask.h + 40 * f) };
}

function Scene({
  setup,
  Vb,
  pH,
  ind,
  dripping,
  layout: L,
  f,
}: {
  setup: TitrationSetup;
  Vb: number;
  pH: number;
  ind: IndicatorId;
  dripping: boolean;
  layout: ReturnType<typeof sceneLayout>;
  f: number;
}) {
  const fx = L.bx - L.flask.w / 2;
  const level = Math.min(0.9, 0.3 + (0.6 * (setup.Va + Vb)) / 75);
  const cx = L.bx;
  const ex = cx + L.flask.w * 0.09;
  const eTop = L.fy - 8 * L.k;
  const eBot = L.fy + L.flask.h - 22 * L.k;
  const M = L.meter;
  const Ve = equivalenceVolume(setup);
  const lines: ReactNode[] = [
    <>
      Tilsatt: {fmt(Vb, 2)} mL NaOH
    </>,
    <>
      n(<TFormel f="OH^-" />) = {fmtSig((setup.cb * Vb) / 1000, 3)} mol
    </>,
    <>
      n<TSub>0</TSub>(syre) = {fmtSig((setup.ca * setup.Va) / 1000, 3)} mol
    </>,
    Vb < Ve - 1e-9 ? <>Syre i overskudd</> : Math.abs(Vb - Ve) < 0.02 ? <>Ekvivalens</> : <>NaOH i overskudd</>,
  ];
  return (
    <g>
      <Txt x={L.bx} y={L.by - 12 * f} size={0.85} weight={600}>
        NaOH(aq), {fmt(setup.cb, 3)} mol/L
      </Txt>
      {/* Elektroden og ledningen til pH-meteret tegnes bak kolben */}
      <path
        d={`M${ex},${eTop} C${ex},${eTop - 50} ${M.x - 60},${M.y + M.h / 2} ${M.x},${M.y + M.h / 2}`}
        fill="none"
        stroke={VIZ.muted}
        strokeWidth={2.5}
      />
      <Erlenmeyerkolbe x={fx} y={L.fy} w={L.flask.w} h={L.flask.h} level={level} liquid={liquidWithIndicator(ind, pH, 0.85)}>
        <rect x={ex - 5 * L.k} y={eTop} width={10 * L.k} height={eBot - eTop} rx={4} fill={VIZ.body} stroke={VIZ.bodyStrong} strokeWidth={1.5} />
        <circle cx={ex} cy={eBot} r={7 * L.k} fill={VIZ.bodyStrong} />
      </Erlenmeyerkolbe>
      <rect x={ex - 5 * L.k} y={eTop} width={10 * L.k} height={L.fy + L.flask.h * 0.3 - eTop} rx={4} fill={VIZ.body} stroke={VIZ.bodyStrong} strokeWidth={1.5} />
      <Byrette x={L.bx} y={L.by} h={L.bh} reading={Vb} showReading dripping={dripping} />
      <Txt x={L.bx} y={L.fy + L.flask.h + 30 * f} size={0.85} muted>
        <TFormel f={setup.acid} />
        (aq), {fmt(setup.Va, 0)} mL
      </Txt>

      {/* pH-meter */}
      <rect x={M.x} y={M.y} width={M.w} height={M.h} rx={12} fill={VIZ.surface} stroke={VIZ.bodyStrong} strokeWidth={2} />
      <rect x={M.x + 14} y={M.y + 14} width={M.w - 28} height={M.h - 40 * (L.narrow ? f * 0.6 : 1)} rx={6} fill={VIZ.body} />
      <Txt x={M.x + M.w / 2} y={M.y + 14 + (M.h - 40 * (L.narrow ? f * 0.6 : 1)) / 2 + 14 * f} size={1.7} weight={700} halo={false}>
        pH {fmt(pH, 2)}
      </Txt>
      <Txt x={M.x + M.w / 2} y={M.y + M.h - 10 * f} size={0.7} muted halo={false}>
        pH-meter
      </Txt>
      {lines.map((l, i) => (
        <Txt key={i} x={M.x} y={M.y + M.h + (34 + 30 * i) * f} anchor="start" size={i === 3 ? 0.95 : 0.85} weight={i === 3 ? 700 : 500} muted={i === 2}>
          {l}
        </Txt>
      ))}
      {!L.narrow && (
        <Txt x={M.x} y={M.y + M.h + 34 + 4 * 30 + 26} anchor="start" size={0.8} muted>
          <TReaksjon r={setup.acid === 'CH3COOH' ? 'CH3COOH(aq) + OH^-(aq) → CH3COO^-(aq) + H2O(l)' : 'H3O^+(aq) + OH^-(aq) → 2 H2O(l)'} />
        </Txt>
      )}
    </g>
  );
}

/* ---------- Figur 2: titrerkurven ---------- */

function Curve({ setup, xMax, Vb, pH, ind, ep, H }: { setup: TitrationSetup; xMax: number; Vb: number; pH: number; ind: IndicatorId; ep: EndpointResult; H: number }) {
  const f = useTextScale();
  const Ve = equivalenceVolume(setup);
  const pts = titrationCurve(setup, xMax);
  const indicator = INDICATORS[ind];
  const pHe = titrationPH(setup, Ve);
  const pHhalf = titrationPH(setup, Ve / 2);
  const weak = setup.acid === 'CH3COOH';
  const mid = indicatorMid(indicator);
  const badgeColor = indicatorColor(ind, mid);
  return (
    <Plot x={{ min: 0, max: xMax, label: 'Tilsatt NaOH V (mL)' }} y={{ min: 0, max: 14, label: 'pH', ticks: [0, 2, 4, 6, 8, 10, 12, 14] }} width={800} height={H}>
      {({ sx, sy, x0, x1, y0, y1 }) => {
        const eqLabelX = sx(Ve) + 12;
        // «halvtitrerpunkt» (ca. 15 tegn) sentreres over punktet, men holdes inne i plottet og til venstre for V_e
        const halfW = 15 * 0.56 * 17 * f * 0.85;
        const halfAbove = sx(Ve) - x0 >= halfW + 20;
        const halfX = halfAbove ? Math.max(x0 + 8, Math.min(sx(Ve) - halfW - 10, sx(Ve / 2) - halfW / 2)) : sx(Ve / 2) - 6;
        const eqRight = eqLabelX + 15 * 0.56 * 17 * f * 0.85 < x1;
        return (
          <g>
            {/* Omslagsområdet */}
            <rect x={x0} y={sy(indicator.high)} width={x1 - x0} height={sy(indicator.low) - sy(indicator.high)} fill={badgeColor} opacity={0.28} />
            <Txt x={x1 - 6} y={sy(indicator.high) - 6} anchor="end" size={0.78} muted>
              {indicator.name} {fmt(indicator.low, 1)}–{fmt(indicator.high, 1)}
            </Txt>

            {/* Ekvivalens- og halvtitrerpunktet */}
            <line x1={sx(Ve)} y1={y0} x2={sx(Ve)} y2={y1} stroke={VIZ.muted} strokeWidth={1.5} strokeDasharray="6 5" />
            <circle cx={sx(Ve)} cy={sy(pHe)} r={6} fill={VIZ.surface} stroke={VIZ.ink} strokeWidth={2.5} />
            <Txt x={eqRight ? eqLabelX : sx(Ve) - 12} y={sy(pHe) + 26 * f} anchor={eqRight ? 'start' : 'end'} size={0.85} weight={650}>
              ekvivalenspunkt
            </Txt>
            <Txt x={eqRight ? eqLabelX : sx(Ve) - 12} y={sy(pHe) + 48 * f} anchor={eqRight ? 'start' : 'end'} size={0.8} muted>
              V = {fmt(Ve, 2)} mL, pH {fmt(pHe, 2)}
            </Txt>
            {weak && (
              <g>
                <line x1={x0} y1={sy(pHhalf)} x2={sx(Ve / 2)} y2={sy(pHhalf)} stroke={VIZ.muted} strokeWidth={1.2} strokeDasharray="4 4" />
                <line x1={sx(Ve / 2)} y1={sy(pHhalf)} x2={sx(Ve / 2)} y2={y0} stroke={VIZ.muted} strokeWidth={1.2} strokeDasharray="4 4" />
                <circle cx={sx(Ve / 2)} cy={sy(pHhalf)} r={6} fill={VIZ.surface} stroke={VIZ.ink} strokeWidth={2.5} />
                {/* Etiketten står over punktet (der kurven er lav), eller under kurven til høyre når det er for trangt til venstre for V_e */}
                {halfAbove ? (
                  <line x1={sx(Ve / 2)} y1={sy(pHhalf) - 34 * f} x2={sx(Ve / 2)} y2={sy(pHhalf) - 9} stroke={VIZ.ink} strokeWidth={1.2} />
                ) : (
                  <line x1={sx(Ve / 2)} y1={sy(pHhalf) + 9} x2={sx(Ve / 2)} y2={sy(pHhalf) + 26 * f} stroke={VIZ.ink} strokeWidth={1.2} />
                )}
                <Txt x={halfX} y={halfAbove ? sy(pHhalf) - 64 * f : sy(pHhalf) + 44 * f} anchor="start" size={0.85} weight={650}>
                  halvtitrerpunkt
                </Txt>
                <Txt x={halfX} y={halfAbove ? sy(pHhalf) - 42 * f : sy(pHhalf) + 66 * f} anchor="start" size={0.8} muted>
                  pH ≈ pK<TSub>a</TSub> = {fmt(PKA, 2)}
                </Txt>
              </g>
            )}

            <path d={linePath(pts, sx, sy)} fill="none" stroke={VIZ.series[0]} strokeWidth={3} strokeLinejoin="round" />

            {/* Endepunktet: der indikatoren slår om */}
            {ep.verdict !== 'god' && (
              <g>
                <line x1={sx(ep.Vend)} y1={sy(mid)} x2={sx(ep.Vend)} y2={y0} stroke={KJEMI.minus} strokeWidth={1.5} strokeDasharray="3 3" />
                <polygon
                  points={`${sx(ep.Vend)},${sy(mid) - 9} ${sx(ep.Vend) + 9},${sy(mid)} ${sx(ep.Vend)},${sy(mid) + 9} ${sx(ep.Vend) - 9},${sy(mid)}`}
                  fill={badgeColor}
                  stroke={KJEMI.minus}
                  strokeWidth={2}
                />
              </g>
            )}
            {ep.verdict === 'dårlig' &&
              (f > 1.3 && !ep.alreadyShifted ? (
                <>
                  <Txt x={x0 + 10} y={y1 + 22 * f} anchor="start" size={0.85} weight={700} color={KJEMI.minus}>
                    Dårlig indikator:
                  </Txt>
                  <Txt x={x0 + 10} y={y1 + 44 * f} anchor="start" size={0.85} weight={700} color={KJEMI.minus}>
                    slår om ved {fmt(ep.Vend, 2)} mL
                  </Txt>
                </>
              ) : (
                <Txt x={x0 + 10} y={y1 + 22 * f} anchor="start" size={0.85} weight={700} color={KJEMI.minus}>
                  {ep.alreadyShifted ? 'Indikatoren har slått om før du starter' : `Dårlig indikator: slår om ved ${fmt(ep.Vend, 2)} mL, ikke ${fmt(Ve, 2)} mL`}
                </Txt>
              ))}

            {/* Nå */}
            <line x1={sx(Vb)} y1={y0} x2={sx(Vb)} y2={sy(pH)} stroke={VIZ.ink} strokeWidth={1.2} strokeDasharray="2 4" />
            <Dot x={sx(Vb)} y={sy(pH)} color={VIZ.ink} />
          </g>
        );
      }}
    </Plot>
  );
}

/* ---------- Forklaring ---------- */

function explanation(s: TitrationSetup, Vb: number, pH: number, phase: ReturnType<typeof titrationPhase>, ep: EndpointResult, ind: IndicatorId): ReactNode {
  const Ve = equivalenceVolume(s);
  const weak = s.acid === 'CH3COOH';
  const A = <Formel f={s.acid} />;
  const reaction = weak ? 'CH3COOH(aq) + OH^-(aq) → CH3COO^-(aq) + H2O(l)' : 'H3O^+(aq) + OH^-(aq) → 2 H2O(l)';
  const indicator = INDICATORS[ind];
  let now: ReactNode;
  if (phase === 'start')
    now = (
      <>
        Før du tilsetter NaOH, er pH {fmt(pH, 2)}.{' '}
        {weak ? 'Eddiksyre er en svak syre, så startpH er mye høyere enn for saltsyre med samme konsentrasjon.' : 'Saltsyre er fullstendig protolysert, så pH = −lg c.'}
      </>
    );
  else if (phase === 'halv')
    now = (
      <>
        <strong>Halvtitrerpunktet:</strong> halvparten av eddiksyra er gjort om til acetat, så [<Formel f="CH3COOH" />] = [<Formel f="CH3COO^-" />] og
        pH ≈ pK<Sub>a</Sub> = {fmt(PKA, 2)} (pH-meteret viser {fmt(pH, 2)}). Her er løsningen en buffer, og pH endrer seg lite når du tilsetter litt mer base.
      </>
    );
  else if (phase === 'før')
    now = (
      <>
        Hver dråpe NaOH reagerer med syra: <Reaksjon r={reaction} />. Det er fortsatt syre i overskudd, så pH
        stiger {weak ? 'langsomt (blandingen av eddiksyre og acetat er en buffer)' : 'langsomt'}.
      </>
    );
  else if (phase === 'ekvivalens')
    now = (
      <>
        <strong>Ekvivalenspunktet:</strong> n(<Formel f="OH^-" />) = n({A}), og pH er {fmt(pH, 2)}.{' '}
        {weak ? (
          <>
            pH er over 7 fordi acetationet <Formel f="CH3COO^-" /> er en svak base. Ekvivalenspunktet er altså ikke det samme som et nøytralt punkt.
          </>
        ) : (
          <>Saltløsningen NaCl er nøytral, så pH er 7,00.</>
        )}
      </>
    );
  else
    now = (
      <>
        Nå er all syra brukt opp, og {fmt(Vb - Ve, 2)} mL NaOH er i overskudd. pH bestemmes av overskuddet av <Formel f="OH^-" /> og flater ut mot pH i
        selve NaOH-løsningen.
      </>
    );
  const verdict =
    ep.verdict === 'god' ? (
      <>
        <strong>{capital(indicator.name)} er et godt valg:</strong> den slår om ved {fmt(ep.Vend, 2)} mL, så nær ekvivalenspunktet ({fmt(Ve, 2)} mL) at
        konsentrasjonen blir riktig ({fmtSig(ep.cFound, 3)} mol/L). Omslagsområdet ligger i det bratte spranget på kurven.
      </>
    ) : ep.verdict === 'brukbar' ? (
      <>
        <strong>{capital(indicator.name)} er brukbar, men ikke best:</strong> den slår om ved {fmt(ep.Vend, 2)} mL i stedet for {fmt(Ve, 2)} mL, en feil på{' '}
        {fmt(Math.abs(ep.relError) * 100, 1)} %. Velg en indikator med omslagsområde rundt pH {fmt(titrationPH(s, Ve), 1)}.
      </>
    ) : (
      <>
        <strong>{capital(indicator.name)} er et dårlig valg her.</strong>{' '}
        {ep.alreadyShifted
          ? 'Den har basefargen allerede før titreringen starter.'
          : `Den slår om ved ${fmt(ep.Vend, 2)} mL, lenge før ekvivalenspunktet (${fmt(Ve, 2)} mL), så analysen gir ${fmtSig(ep.cFound, 3)} mol/L i stedet for ${fmtSig(s.ca, 3)} mol/L.`}{' '}
        Omslagsområdet må ligge i det bratte spranget, og for en svak syre ligger spranget over pH 7.
      </>
    );
  return (
    <>
      <p>{now}</p>
      <p>{verdict}</p>
      <p>
        I en ekte titreranalyse kjenner du ikke konsentrasjonen av syra. Du leser av volumet NaOH ved endepunktet og regner baklengs: n(NaOH) = c · V, n(syre) =
        n(NaOH) fordi syra og <Formel f="OH^-" /> reagerer i forholdet 1 : 1, og c = n/V.
      </p>
    </>
  );
}

const capital = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
