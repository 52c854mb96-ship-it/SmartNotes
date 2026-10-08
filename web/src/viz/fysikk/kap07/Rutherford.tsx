import { useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  Controls,
  Explain,
  Figure,
  Formula,
  FormulaLine,
  Legend,
  Readout,
  Readouts,
  Segmented,
  Slider,
  Sub,
  Toolbar,
  VizLayout,
  fmt,
  fmtSci,
  useSimClock,
  useTextScale,
} from '../../kit';
import {
  ALPHA,
  B_MAX,
  ELECTRON_MASS,
  FM,
  GOLD,
  N_TOTAL,
  PLAY_TIME,
  alphaElectronMassRatio,
  alphaSpeed,
  binProbabilities,
  chancePerAtom,
  closestApproach,
  deg,
  electronMaxAngle,
  firedCount,
  foilSetup,
  goldAlphaMassRatio,
  largeAngleIndices,
  nucleusForce,
  rutherfordAngle,
  simulateExperiment,
  tally,
  targetRadiusFromCount,
  thomsonAngle,
  thomsonLog10Above,
  thomsonMaxAngle,
  thomsonSigma,
  type Experiment,
  type ModelId,
} from './model-rutherford';
import { Chamber, Counter, Lattice, NucleusLens, PlayBar, RUTH, ZoomCone, counterHeight, latticeGeometry, modelColor } from './rutherford-deler';
import { useFigureTextScale } from './useNarrow';

const MODELS: { value: ModelId; label: string }[] = [
  { value: 'thomson', label: 'Thomson: rosinbolle' },
  { value: 'rutherford', label: 'Rutherford: liten kjerne' },
];

const SETUP = foilSetup();
const LAYERS = SETUP.layers;

/** Forsøket simuleres én gang (fast frø), og bare når visualiseringen åpnes. */
let cached: { exp: Experiment; large: number[] } | null = null;
function experiment() {
  if (!cached) {
    const exp = simulateExperiment();
    cached = { exp, large: largeAngleIndices(exp, 30) };
  }
  return cached;
}

/** Tall med to gjeldende siffer: 13 793 → 14 000. */
function roundSig(v: number, sig = 2): number {
  if (!(v > 0)) return 0;
  const p = 10 ** (Math.floor(Math.log10(v)) - sig + 1);
  return Math.round(v / p) * p;
}

/** Vinkel i grader til tekst: hele grader, eller standardform når den er bitteliten. */
function angleText(thetaDeg: number): string {
  if (thetaDeg >= 1) return fmt(thetaDeg, 0);
  if (thetaDeg >= 0.01) return fmt(thetaDeg, 2);
  return fmtSci(thetaDeg, 1);
}

export default function Rutherford() {
  const [model, setModel] = useState<ModelId>('rutherford');
  const [bFm, setB] = useState(20);
  const clock = useSimClock({ tMax: PLAY_TIME });
  const { exp, large } = experiment();

  // Åpnes med hele forsøket ferdig; «Skyt α-partikler» starter på nytt fra null.
  const { setT } = clock;
  useEffect(() => setT(PLAY_TIME), [setT]);

  const n = firedCount(clock.t);
  const t = useMemo(() => tally(exp, n), [exp, n]);
  const probs = useMemo(() => binProbabilities(model, SETUP), [model]);
  const expected = probs.map((p) => p * n);
  const [c0, c1, c2, c3] = t.bins as [number, number, number, number];
  const over5 = c1 + c2 + c3;

  const b = bFm * FM;
  const thetaDeg = model === 'rutherford' ? deg(rutherfordAngle(b)) : deg(thomsonAngle(b));
  const rMinFm = closestApproach(b) / FM;
  const fMax = nucleusForce(closestApproach(b));

  // Animasjonen i atomgitteret og utsnittet går rundt hvert 2,5 s mens avspillingen går.
  const moving = clock.playing || (clock.t > 0 && clock.t < PLAY_TIME);
  const u = moving ? (clock.t % 2.5) / 2.5 : null;

  const [ref1, f1] = useFigureTextScale<HTMLDivElement>();
  const narrow = f1 > 1.3;
  const L1 = narrow
    ? { cx: 400, cy: 330, R: 276, counter: { x: 24, y: 690, w: 760 } }
    : { cx: 214, cy: 222, R: 160, counter: { x: 448, y: 26, w: 342 } };
  const H1 = narrow ? L1.counter.y + counterHeight(f1) + 12 : 444;

  const L2 = narrow
    ? { lat: { x: 20, y: 54, w: 760, h: 380, cols: 5, rows: 3 }, lens: { cx: 400, cy: 434 + 60 + 290, R: 290 }, H: 434 + 60 + 580 + 24 }
    : { lat: { x: 16, y: 46, w: 372, h: 300, cols: 5, rows: 4 }, lens: { cx: 604, cy: 198, R: 152 }, H: 360 };
  const geo = useMemo(() => latticeGeometry(L2.lat.x, L2.lat.y, L2.lat.w, L2.lat.h, L2.lat.cols, L2.lat.rows), [L2.lat.x, L2.lat.y, L2.lat.w, L2.lat.h, L2.lat.cols, L2.lat.rows]);

  const modelName = model === 'thomson' ? 'Thomsons modell' : 'Rutherfords modell';

  return (
    <VizLayout>
      <Toolbar>
        <Segmented label="Velg atommodell" options={MODELS} value={model} onChange={setModel} />
      </Toolbar>
      <Controls>
        <Slider label="Sikteavstand b fra kjernen" value={bFm} onChange={setB} min={0} max={Math.round(B_MAX / FM)} step={1} unit="fm" />
      </Controls>
      <PlayBar clock={clock} text={`${fmt(n, 0)} av ${fmt(N_TOTAL, 0)} α-partikler skutt`} />

      <div ref={ref1}>
        <Figure
          viewBox={`0 0 800 ${Math.round(H1)}`}
          label={`Vakuumkammer sett ovenfra: α-partikler fra en kilde i en blyblokk treffer en tynn gullfolie, og en skjerm rundt lyser der de treffer. Av ${fmt(n, 0)} α-partikler gikk ${fmt(c0, 0)} nesten rett gjennom, ${fmt(over5, 0)} ble avbøyd mer enn 5° og ${fmt(c3, 0)} kom tilbake. Telleren sammenligner med det ${modelName} forutsier.`}
          caption="Kilden er americium-241, det samme stoffet som i ioniserende røykvarslere. Telleren har logaritmisk skala: hver strek er ti ganger mer. Forsøket er simulert med Rutherfords modell, som stemmer med målingene."
          maxHeight={narrow ? H1 : H1 + 30}
        >
          <Chamber cx={L1.cx} cy={L1.cy} R={L1.R} model={model} exp={exp} tally={t} n={n} t={clock.t} playing={clock.playing} large={large} />
          <Counter x={L1.counter.x} y={L1.counter.y} w={L1.counter.w} model={model} counts={t.bins} expected={expected} />
        </Figure>
      </div>
      <Legend
        items={[
          { color: RUTH.measured, label: 'Målt i forsøket' },
          { color: modelColor(model), label: `Forutsagt av ${modelName}` },
        ]}
      />

      <Figure
        viewBox={`0 0 800 ${L2.H}`}
        label={`Inne i gullfolien etter ${modelName}, og et utsnitt rundt én kjerne. α-partikkelen vi sikter med, passerer ${fmt(bFm, 0)} fm fra midten og bøyes ${angleText(thetaDeg)} grader.`}
        caption={
          model === 'rutherford'
            ? 'Kjernene i gullatomene er tegnet altfor store: i riktig målestokk ville de vært usynlige. I utsnittet rundt én kjerne er kjernen og avstandene riktige, men α-partikkelen er forstørret.'
            : 'I rosinbollen er den positive ladningen spredt i hele atomet, og elektronene sitter i den som rosiner.'
        }
        maxHeight={narrow ? L2.H : L2.H + 30}
      >
        <InsideFoil L2={L2} geo={geo} model={model} bFm={bFm} u={u} />
      </Figure>

      <Readouts>
        <Readout label="α-partikler skutt" value={fmt(n, 0)} />
        <Readout label="Avbøyd mer enn 5°" value={fmt(over5, 0)} />
        <Readout label="Kastet tilbake (over 90°)" value={fmt(c3, 0)} />
        <Readout label="Den du sikter med: θ" value={`${angleText(thetaDeg)}°`} tone={modelColor(model)} />
      </Readouts>

      {model === 'rutherford' ? <SizeFormula back={c3} n={n} /> : <ThomsonFormula />}

      <Explain>{explanation({ model, n, c0, over5, c3, bFm, thetaDeg, rMinFm, fMax })}</Explain>
    </VizLayout>
  );
}

function InsideFoil({
  L2,
  geo,
  model,
  bFm,
  u,
}: {
  L2: { lat: { x: number; y: number; w: number; h: number }; lens: { cx: number; cy: number; R: number } };
  geo: ReturnType<typeof latticeGeometry>;
  model: ModelId;
  bFm: number;
  u: number | null;
}) {
  const f = useTextScale();
  const { lat, lens } = L2;
  return (
    <>
      <ZoomCone x1={geo.target.cx} y1={geo.target.cy} r1={13} x2={lens.cx} y2={lens.cy} r2={lens.R} />
      <Lattice x={lat.x} y={lat.y} w={lat.w} h={lat.h} geo={geo} model={model} bFm={bFm} u={u} />
      <NucleusLens cx={lens.cx} cy={lens.cy} R={lens.R} model={model} bFm={bFm} u={u} />
      <text x={lat.x + lat.w / 2} y={lat.y - 14 * f} textAnchor="middle" className="viz-label" style={{ fontWeight: 700 }}>
        Inne i gullfolien
      </text>
      <text x={lens.cx} y={lens.cy - lens.R - 12 * f} textAnchor="middle" className="viz-label" style={{ fontWeight: 700 }}>
        {model === 'rutherford' ? 'Rundt én kjerne' : 'Inne i én rosinbolle'}
      </text>
    </>
  );
}

function SizeFormula({ back, n }: { back: number; n: number }) {
  const share = n > 0 ? back / n : 0;
  const perAtom = chancePerAtom(back, n, SETUP);
  const bT = targetRadiusFromCount(back, n, SETUP);
  const layers = fmt(Math.round(LAYERS / 10) * 10, 0);
  return (
    <Formula label="Hvor liten er kjernen? Regnet ut fra telleren">
      {back === 0 ? (
        <FormulaLine>Ingen er kastet tilbake ennå. Skyt flere α-partikler: bare omtrent 1 av 20 000 kommer tilbake.</FormulaLine>
      ) : (
        <>
          <FormulaLine>
            Andel kastet tilbake: {fmt(back, 0)} / {fmt(n, 0)} = {fmtSci(share, 1)} (1 av {fmt(roundSig(1 / share), 0)})
          </FormulaLine>
          <FormulaLine>
            Sjanse per atom (ca. {layers} lag): {fmtSci(share, 1)} / {layers} = {fmtSci(perAtom, 1)}
          </FormulaLine>
          <FormulaLine>
            «Blinken» rundt kjernen: π r² = {fmtSci(perAtom, 1)} · {fmtSci(SETUP.a2, 1)} m² (flaten per atom)
          </FormulaLine>
          <FormulaLine>
            r = {fmtSci(bT, 1)} m, mens atomet har radius {fmtSci(GOLD.atomRadius, 1)} m: ca. {fmt(roundSig(GOLD.atomRadius / bT), 0)} ganger større
          </FormulaLine>
        </>
      )}
    </Formula>
  );
}

function ThomsonFormula() {
  const log = thomsonLog10Above(Math.PI / 2, SETUP);
  return (
    <Formula label="Hvorfor rosinbollen bare gir små vinkler">
      <FormulaLine>
        m<Sub>α</Sub> / m<Sub>e</Sub> = {fmtSci(ALPHA.mass, 2)} kg / {fmtSci(ELECTRON_MASS, 2)} kg = {fmt(roundSig(alphaElectronMassRatio(), 3), 0)}: ett elektron kan bøye α
        høyst {fmt(deg(electronMaxAngle()), 3)}°
      </FormulaLine>
      <FormulaLine>Positiv ladning spredt i hele atomet: høyst {fmt(deg(thomsonMaxAngle()), 3)}° per atom</FormulaLine>
      <FormulaLine>
        Etter ca. {fmt(Math.round(LAYERS / 10) * 10, 0)} atomlag: typisk {fmt(deg(thomsonSigma(SETUP)), 1)}° (de små avbøyningene går hver sin vei)
      </FormulaLine>
      <FormulaLine>
        Sannsynlighet for mer enn 90°: ca. 10<sup>−{Math.round(-log / 100) * 100}</sup>, altså ingen
      </FormulaLine>
    </Formula>
  );
}

function explanation(s: {
  model: ModelId;
  n: number;
  c0: number;
  over5: number;
  c3: number;
  bFm: number;
  thetaDeg: number;
  rMinFm: number;
  fMax: number;
}): ReactNode {
  const { model, n, c0, over5, c3, bFm, thetaDeg, rMinFm, fMax } = s;
  const layers = fmt(Math.round(LAYERS / 100) * 100, 0);
  const parts: string[] = [];

  // Det forsøket viser så langt.
  if (n === 0) {
    parts.push(
      `Trykk «Skyt α-partikler». α-partiklene er heliumkjerner med farten ${fmtSci(alphaSpeed(), 1)} m/s, og gullfolien er bare 0,6 µm tykk: ca. ${layers} atomlag.`,
    );
  } else if (over5 === 0) {
    parts.push(`Så langt har alle de ${fmt(n, 0)} α-partiklene gått nesten rett gjennom. De store vinklene er så sjeldne at du må skyte tusenvis.`);
  } else {
    const pct = (100 * c0) / n;
    const back = c3 > 0 ? `og ${fmt(c3, 0)} kom tilbake` : 'men ingen er kastet tilbake ennå';
    parts.push(
      `Av ${fmt(n, 0)} α-partikler gikk ${fmt(pct, pct > 99.5 ? 2 : 1)} % nesten rett gjennom de ca. ${layers} atomlagene i folien, ${fmt(over5, 0)} ble bøyd av mer enn 5°, ${back}.`,
    );
  }

  if (model === 'thomson') {
    parts.push(
      `Rosinbollen forutsier at alle går rett gjennom, under 2°: den positive ladningen er spredt i hele atomet, så kraften blir aldri stor, og elektronene er ${fmt(roundSig(alphaElectronMassRatio(), 2), 0)} ganger lettere enn α. Å snu α med et elektron er som å stoppe en bowlingkule med en rosin.`,
    );
    if (over5 > 0) parts.push('Men noen ble bøyd kraftig av, og noen kom tilbake. Det kan ikke rosinbollen forklare.');
    parts.push(`Den du sikter med, bøyes bare ${angleText(thetaDeg)}°.`);
  } else {
    parts.push(
      `Det passer med Rutherfords modell: atomet er nesten bare tomt rom, mens den positive ladningen og nesten all massen sitter i en bitteliten kjerne, ${fmt(goldAlphaMassRatio(), 0)} ganger tyngre enn α.`,
    );
    let spot = `Den du sikter med, kommer ${fmt(rMinFm, 0)} fm nær kjernen og bøyes ${fmt(thetaDeg, 0)}°, fordi kraften fra kjernen der er ca. ${fmt(fMax, fMax < 10 ? 1 : 0)} N, enormt mye på én partikkel.`;
    if (thetaDeg > 90) spot += ' Den kastes tilbake: Rutherford sammenlignet det med en granat som spretter tilbake fra silkepapir.';
    parts.push(spot);
    if (bFm <= 12) {
      parts.push(
        `Den treffer aldri kjernen: like ladninger frastøter hverandre, så den snur ${fmt(rMinFm, 0)} fm unna, mens kjernen har radius ca. ${fmt(GOLD.nucleusRadius / FM, 0)} fm.`,
      );
    } else if (bFm >= 70) {
      parts.push(
        `Allerede ${fmt(bFm, 0)} fm fra kjernen, under en tusendel av atomets radius, blir avbøyningen bare ${fmt(thetaDeg, 0)}°. Derfor er store vinkler så sjeldne.`,
      );
    }
  }
  return parts.join(' ');
}
