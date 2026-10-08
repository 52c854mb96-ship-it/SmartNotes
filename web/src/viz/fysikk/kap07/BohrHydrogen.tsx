import { useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  Controls,
  Explain,
  Figure,
  Formula,
  FormulaLine,
  Legend,
  PlayControls,
  Readout,
  Readouts,
  Segmented,
  Slider,
  Sub,
  Toolbar,
  VIZ,
  VizLayout,
  fmt,
  fmtSci,
  useSimClock,
} from '../../kit';
import { AtomLupe, eVText, lightText, nmText, type Mode } from './bohr-atom';
import { WavelengthAxis } from './bohr-bolgelengder';
import { LabVignett, LupeStreker, SolVignett, labGeometry, sunGeometry, type Box } from './bohr-deler';
import { LevelDiagram, N_TOP, levelsHeight } from './bohr-nivaer';
import { BOHR_ANIM, dischargeRgb, orbitRadius, rgbText, type Circle } from './bohr-scene';
import {
  REGION_NAMES,
  colorName,
  levelEnergyEV,
  nearestLine,
  photonSteps,
  seriesName,
  sigDecimals,
  spectralRegion,
  sunLinesOf,
  transitionPhoton,
  wavelengthColor,
} from './model';
import { useFigureTextScale, useNarrow } from './useNarrow';

const MODES: { value: Mode; label: string }[] = [
  { value: 'emisjon', label: 'Emisjon: elektronet faller ned' },
  { value: 'absorpsjon', label: 'Absorpsjon: elektronet løftes opp' },
];

/** Farge for hver serie (nederste nivå 1–5). */
const SERIES_COLOR = [VIZ.series[3]!, VIZ.series[0]!, VIZ.series[1]!, VIZ.series[2]!, VIZ.series[4]!];
const seriesColor = (nLower: number) => SERIES_COLOR[nLower - 1] ?? VIZ.ink;

/** Fargen hydrogenrøret lyser med (summen av Balmer-linjene) og den røde Hα-fargen i solatmosfæren. */
const TUBE_RGB = rgbText(dischargeRgb());
const H_ALPHA_RGB = wavelengthColor(transitionPhoton(3, 2).lambda * 1e9, 'red');

interface SceneLayout {
  stacked: boolean;
  H: number;
  box: Box;
  lupe: Circle;
  xEnd: number;
}

/** Utsnittet til venstre og lupen til høyre på PC; utsnittet over lupen på mobil, der teksten er større. */
function sceneLayout(f: number): SceneLayout {
  if (f <= 1.3) return { stacked: false, H: 340, box: { x: 8, y: 8, w: 252, h: 324 }, lupe: { x: 440, y: 170, r: 160 }, xEnd: 792 };
  const box = { x: 8, y: 8, w: 784, h: 340 };
  const r = 215;
  const lupe = { x: 262, y: box.y + box.h + 28 + r, r };
  return { stacked: true, H: Math.round(lupe.y + r + 14), box, lupe, xEnd: 792 };
}

export default function BohrHydrogen() {
  const [mode, setMode] = useState<Mode>('emisjon');
  const [upper, setUpper] = useState(3);
  const [lower, setLower] = useState(2);
  const [ref, narrow] = useNarrow<HTMLDivElement>();
  const [sceneRef, f] = useFigureTextScale<HTMLDivElement>();
  const clock = useSimClock({ tMax: BOHR_ANIM.total });
  const { reset } = clock;
  // Ny overgang eller ny modus: avspillingen starter forfra.
  useEffect(() => reset(), [mode, upper, lower, reset]);

  // Nederste nivå er alltid under øverste: den som flyttes, dytter den andre.
  const changeUpper = (n: number) => {
    setUpper(n);
    if (lower >= n) setLower(n - 1);
  };
  const changeLower = (n: number) => {
    setLower(n);
    if (upper <= n) setUpper(n + 1);
  };

  const p = transitionPhoton(upper, lower);
  const steps = photonSteps(upper, lower);
  const nm = p.lambda * 1e9;
  const region = spectralRegion(nm);
  const [from, to] = mode === 'emisjon' ? [upper, lower] : [lower, upper];
  const levelsH = levelsHeight(narrow);
  const lay = sceneLayout(f);
  const k = Math.max(1, f * 0.85);
  const lab = useMemo(() => labGeometry(lay.box, k), [lay.box, k]);
  const sun = useMemo(() => sunGeometry(lay.box, k), [lay.box, k]);
  const ring = mode === 'emisjon' ? lab.ring : sun.ring;
  const animating = clock.playing || (clock.t > 0 && clock.t < BOHR_ANIM.total);
  const color = seriesColor(lower);

  const sceneLabel =
    mode === 'emisjon'
      ? `Et spektralrør med hydrogen lyser rosa i et mørkt klasserom. Lupen viser ett hydrogenatom med banene i riktig forhold: elektronet hopper fra bane n = ${upper} til n = ${lower} og sender ut et foton med bølgelengde ${nmText(nm)} nm (${lightText(nm)}).`
      : `Sollys går gjennom den kaldere gassen i solatmosfæren. Lupen viser ett hydrogenatom som tar opp et foton med bølgelengde ${nmText(nm)} nm, så elektronet hopper fra bane n = ${lower} til n = ${upper}. Fotoner med litt mer og litt mindre energi går rett gjennom.`;

  return (
    <VizLayout>
      <Toolbar>
        <Segmented label="Velg emisjon eller absorpsjon" options={MODES} value={mode} onChange={setMode} />
        <PlayControls clock={clock} decimals={1} />
      </Toolbar>
      <Controls>
        <Slider label="Øverste nivå" value={upper} onChange={changeUpper} min={2} max={N_TOP} step={1} format={(v) => `n = ${v}`} />
        <Slider label="Nederste nivå" value={lower} onChange={changeLower} min={1} max={N_TOP - 1} step={1} format={(v) => `n = ${v}`} />
      </Controls>

      <div ref={sceneRef}>
        <Figure viewBox={`0 0 800 ${lay.H}`} label={sceneLabel} maxHeight={lay.stacked ? 820 : 400}>
          {mode === 'emisjon' ? <LabVignett box={lay.box} g={lab} glowRgb={TUBE_RGB} k={k} /> : <SolVignett box={lay.box} g={sun} layerRgb={H_ALPHA_RGB} k={k} />}
          <LupeStreker ring={ring} lupe={lay.lupe} />
          <AtomLupe c={lay.lupe} mode={mode} upper={upper} lower={lower} t={animating ? clock.t : null} xEnd={lay.xEnd} color={color} />
        </Figure>
      </div>

      <div ref={ref}>
        <Figure
          viewBox={`0 0 800 ${levelsH}`}
          label={`Energinivåene i hydrogen. ${mode === 'emisjon' ? 'Emisjon' : 'Absorpsjon'}: elektronet går fra n = ${from} til n = ${to}, og fotonet har bølgelengde ${nmText(nm)} nm.`}
          maxHeight={levelsH}
        >
          <LevelDiagram upper={upper} lower={lower} mode={mode} narrow={narrow} height={levelsH} color={color} />
        </Figure>
      </div>

      <Figure
        viewBox={`0 0 800 ${narrow ? 430 : 270}`}
        label={`Bølgelengdene til alle overgangene opp til n = 6 på en logaritmisk akse. Det valgte fotonet har ${nmText(nm)} nm (${REGION_NAMES[region]}).`}
      >
        <WavelengthAxis upper={upper} lower={lower} height={narrow ? 430 : 270} seriesColor={seriesColor} />
      </Figure>
      <Legend
        items={[1, 2, 3, 4, 5].map((n) => ({
          color: seriesColor(n),
          label: `${seriesName(n)} (${mode === 'emisjon' ? 'ned til' : 'opp fra'} n = ${n})`,
        }))}
      />

      <Readouts>
        <Readout label="Fotonenergi" value={fmt(p.eV, sigDecimals(p.eV))} unit="eV" />
        <Readout label="Fotonenergi i joule" value={fmtSci(p.E, 2)} unit="J" />
        <Readout label="Frekvens f" value={fmtSci(p.f, 2)} unit="Hz" />
        <Readout label="Bølgelengde λ" value={nmText(nm)} unit="nm" />
      </Readouts>

      <Formula label="Fotonenergi, frekvens og bølgelengde">
        <FormulaLine>
          E<Sub>n</Sub> = −2,18 · 10⁻¹⁸ J / n²
        </FormulaLine>
        {/* Mellomsvarene har fire gjeldende siffer (ett ekstra), så tallene som står, gir svaret med tre (photonSteps) */}
        <FormulaLine>
          E<Sub>foton</Sub> = E<Sub>{upper}</Sub> − E<Sub>{lower}</Sub> = ({fmtSci(steps.Eupper, 3)} J) − ({fmtSci(steps.Elower, 3)} J) ={' '}
          {fmtSci(steps.E, 3)} J
        </FormulaLine>
        <FormulaLine>
          E<Sub>foton</Sub> = {fmtSci(steps.E, 3)} J / (1,60 · 10⁻¹⁹ J/eV) = {eVText(steps.eV)} eV
        </FormulaLine>
        <FormulaLine>
          f = E/h = {fmtSci(steps.E, 3)} J / 6,63 · 10⁻³⁴ J·s = {fmtSci(steps.f, 3)} Hz
        </FormulaLine>
        <FormulaLine>
          λ = c/f = 3,00 · 10⁸ m/s / {fmtSci(steps.f, 3)} Hz = {nmText(steps.nm)} nm
        </FormulaLine>
      </Formula>

      <Explain>{explanation(mode, upper, lower, p.eV, nm)}</Explain>
    </VizLayout>
  );
}

/** Radien til bane n som tekst: «0,053 nm», «1,9 nm». */
function radiusText(n: number): string {
  const r = orbitRadius(n) * 1e9;
  return `${fmt(r, sigDecimals(r, 2))} nm`;
}

function explanation(mode: Mode, upper: number, lower: number, eV: number, nm: number): ReactNode {
  const region = spectralRegion(nm);
  const series = seriesName(lower);
  const visibleBalmer = lower === 2 && region === 'synlig';
  const where =
    region === 'uv' ? (
      <>ultrafiolett, fordi spranget ned til n = 1 er så stort</>
    ) : region === 'ir' ? (
      <>infrarødt, fordi nivåene ligger tett og fotonet får lite energi</>
    ) : (
      <>synlig lys med {colorName(nm)} farge</>
    );
  const seriesText = visibleBalmer ? (
    <>Overgangene ned til n = 2 kalles Balmer-serien, og de fire første er synlige.</>
  ) : (
    <>
      Overgangene ned til n = {lower} kalles {series}-serien.
    </>
  );
  const ionize =
    lower === 1 ? (
      <> Fra grunntilstanden n = 1 trengs {fmt(-levelEnergyEV(1), 1)} eV for å rive løs elektronet helt (ionisering, E = 0).</>
    ) : null;
  const ionizeAbs =
    lower === 1 ? (
      <>
        {' '}
        Unntaket er fotoner med mer enn {fmt(-levelEnergyEV(1), 1)} eV: de kan alltid tas opp, for de river løs elektronet helt
        (ionisering, E = 0).
      </>
    ) : null;
  const orbits = (
    <>
      {' '}
      I lupen ser du at banene ligger lenger og lenger fra hverandre utover (r = n² · 0,053 nm, så bane {upper} har radius{' '}
      {radiusText(upper)}), mens energinivåene i diagrammet ligger tettere og tettere.
    </>
  );
  if (mode === 'emisjon') {
    const why = visibleBalmer ? (
      <>
        Det er derfor spektralrøret lyser rosa: lyset er en blanding av rødt fra n = 3 til 2, som er sterkest, og blågrønt og fiolett
        fra de andre Balmer-overgangene. Ser du på røret gjennom et gitter, får du fire skarpe linjer.
      </>
    ) : region === 'uv' ? (
      <>Det er derfor du ikke ser denne overgangen i spektralrøret: fotonet er ultrafiolett og usynlig for øyet.</>
    ) : (
      <>Det er derfor du ikke ser denne overgangen i spektralrøret: fotonet er infrarødt, men et IR-kamera kan fange det opp.</>
    );
    return (
      <>
        <p>
          <strong>Emisjon.</strong> Elektronet faller fra n = {upper} til n = {lower} og sender ut ett foton med energi lik forskjellen mellom
          nivåene: E = hf = E<Sub>{upper}</Sub> − E<Sub>{lower}</Sub> = {fmt(eV, sigDecimals(eV))} eV. Det gir λ = {nmText(nm)} nm, som er{' '}
          {where}. {seriesText}
          {ionize} Bohrs modell gir riktige nivåer for hydrogen, men virker ikke for atomer med flere elektroner.
        </p>
        <p>
          {why}
          {orbits}
        </p>
      </>
    );
  }
  const sunLine = visibleBalmer ? nearestLine(sunLinesOf('hydrogen'), nm, 2) : null;
  const sunNm = sunLine ? nmText(sunLine.nm) : null;
  const why = visibleBalmer ? (
    <>
      Det er derfor sollyset har en mørk linje ved {sunNm && sunNm !== nmText(nm) ? `ca. ${sunNm} nm (Bohrs modell gir ${nmText(nm)} nm med avrundede konstanter)` : `${nmText(nm)} nm`}:
      hydrogen i solatmosfæren tar opp akkurat disse fotonene, mens resten av lyset går gjennom. Atomene må da være i n = 2 fra før.
      Solatmosfæren er så varm (ca. {'5\u00a0000–6\u00a0000\u00a0K'}) at en liten andel av hydrogenatomene er det, og det er så mye hydrogen at linjene
      likevel synes.
    </>
  ) : lower === 1 ? (
    <>Det er derfor kald hydrogengass bare tar opp ultrafiolett lys: nesten alle atomene er i grunntilstanden n = 1.</>
  ) : (
    <>
      Nesten ingen atomer er i n = {lower} uten at gassen er svært varm, så slike linjer er svake. Fotonet er{' '}
      {region === 'synlig' ? 'synlig lys' : REGION_NAMES[region]}.
    </>
  );
  return (
    <>
      <p>
        <strong>Absorpsjon.</strong> Atomet tar bare opp et foton som har nøyaktig energien E<Sub>{upper}</Sub> − E<Sub>{lower}</Sub> ={' '}
        {fmt(eV, sigDecimals(eV))} eV (λ = {nmText(nm)} nm, {region === 'synlig' ? `synlig lys med ${colorName(nm)} farge` : REGION_NAMES[region]}). Da
        løftes elektronet fra n = {lower} til n = {upper}. Fotoner med litt mer eller litt mindre energi går rett gjennom, fordi elektronet ikke kan
        være mellom nivåene.{ionizeAbs}
      </p>
      <p>
        {why}
        {orbits}
      </p>
    </>
  );
}
