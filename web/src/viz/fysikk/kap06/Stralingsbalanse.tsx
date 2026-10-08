import { useState, type ReactNode } from 'react';
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
  Sup,
  Toggle,
  Toolbar,
  VizLayout,
  fmt,
} from '../../kit';
import { SOLAR_CONSTANT, radiationBalance, type Balance } from './model';
import { BalanceScene, HEAT, SUNLIGHT, TempGraph, T_TODAY, celsius, useSceneMetrics } from './stralingsbalanse-figur';
import { SURFACE_ALBEDO } from './stralingsbalanse-scene';

type Preset = 'uten' | 'idag' | 'mer' | 'sno';

const PRESETS: { value: Preset; label: string; albedo: number; eps: number }[] = [
  { value: 'uten', label: 'Uten atmosfære', albedo: 0.3, eps: 0 },
  { value: 'idag', label: 'Jorda i dag', albedo: 0.3, eps: 0.78 },
  { value: 'mer', label: 'Mer drivhusgasser', albedo: 0.3, eps: 0.82 },
  { value: 'sno', label: 'Mer is og snø', albedo: 0.45, eps: 0.78 },
];

/** Dagens jord i modellen (α = 0,30, ε = 0,78), som de andre tilstandene sammenlignes med. */
const TODAY = PRESETS[1]!;
const TS_TODAY = radiationBalance(TODAY.albedo, TODAY.eps).Tsurface;

export default function Stralingsbalanse() {
  const [albedo, setAlbedo] = useState(0.3);
  const [eps, setEps] = useState(0.78);
  const [flows, setFlows] = useState(true);
  const { ref, f, W } = useSceneMetrics();
  const b = radiationBalance(albedo, eps);
  const preset = PRESETS.find((p) => Math.abs(p.albedo - albedo) < 1e-9 && Math.abs(p.eps - eps) < 1e-9)?.value ?? ('egen' as Preset);
  const graphH = W < 700 ? 440 : 330;
  const choose = (v: Preset) => {
    const p = PRESETS.find((x) => x.value === v);
    if (!p) return;
    setAlbedo(p.albedo);
    setEps(p.eps);
  };

  return (
    <VizLayout>
      <Toolbar>
        <Segmented label="Velg et eksempel" options={PRESETS} value={preset} onChange={choose} />
        <Toggle label="Vis energistrømmer" checked={flows} onChange={setFlows} />
      </Toolbar>
      <Controls>
        <Slider label="Albedo α" value={albedo} onChange={setAlbedo} min={0} max={0.9} step={0.01} decimals={2} />
        <Slider
          label="Varmestråling atmosfæren absorberer, ε"
          value={eps}
          onChange={setEps}
          min={0}
          max={1}
          step={0.01}
          format={(v) => `${fmt(v * 100, 0)} %`}
        />
      </Controls>

      <div ref={ref}>
        <BalanceScene b={b} albedo={albedo} eps={eps} flows={flows} f={f} W={W} />
      </div>
      {flows && (
        <Legend
          items={[
            { color: SUNLIGHT, label: 'Sollys (synlig lys)' },
            { color: HEAT, label: 'Varmestråling (infrarødt)' },
          ]}
        />
      )}

      <Figure
        viewBox={`0 0 800 ${graphH}`}
        label="Graf over temperaturen ved bakken som funksjon av hvor mye varmestråling atmosfæren absorberer"
        caption="Den skraverte flaten er drivhuseffekten: hvor mye varmere bakken blir enn uten atmosfære."
      >
        <TempGraph albedo={albedo} eps={eps} Ts={b.Tsurface} Tbare={b.Tbare} height={graphH} />
      </Figure>

      <Readouts>
        <Readout label="Absorbert sollys (1 − α)·S/4" value={fmt(b.absorbed, 0)} unit="W/m²" tone={SUNLIGHT} />
        <Readout label="Uten atmosfære" value={fmt(b.Tbare, 0)} unit="K" />
        <Readout label={`Ved bakken (${fmt(celsius(b.Tsurface), 0)} °C)`} value={fmt(b.Tsurface, 0)} unit="K" tone={HEAT} />
        <Readout label="Drivhuseffekten gir" value={`+${fmt(b.Tsurface - b.Tbare, 0)}`} unit="K" />
      </Readouts>

      <Formula label="Strålingsbalansen">
        <FormulaLine>
          S/4 = {fmt(SOLAR_CONSTANT, 0)} W/m² / 4 = {fmt(b.incoming, 0)} W/m²
        </FormulaLine>
        <FormulaLine>
          (1 − α) · S/4 = σT<Sub>uten</Sub>
          <Sup>4</Sup> &nbsp;⇒&nbsp; T<Sub>uten</Sub> = ({fmt(b.absorbed, 1)} W/m² / 5,67 · 10<Sup>−8</Sup> W/(m²·K<Sup>4</Sup>))
          <Sup>1/4</Sup> = {fmt(b.Tbare, 0)} K
        </FormulaLine>
        <FormulaLine>
          T<Sub>bakke</Sub> = T<Sub>uten</Sub> · (2 / (2 − ε))<Sup>1/4</Sup> = {fmt(b.Tbare, 0)} K · (2 / (2 − {fmt(eps, 2)}))<Sup>1/4</Sup>{' '}
          = {fmt(b.Tsurface, 0)} K
        </FormulaLine>
      </Formula>

      <Explain>{explanation(b, albedo, eps)}</Explain>
    </VizLayout>
  );
}

function explanation(b: Balance, albedo: number, eps: number): ReactNode {
  const first = (
    <p>
      <strong>Inn = ut.</strong> Sollyset gir {fmt(SOLAR_CONSTANT, 0)} W/m² på en flate som vender rett mot sola, men jorda er en kule som
      snurrer, så i snitt over hele overflaten blir det S/4 = {fmt(b.incoming, 0)} W/m². Jorda reflekterer {fmt(b.reflected, 0)} W/m² og tar
      opp {fmt(b.absorbed, 0)} W/m², og i likevekt må den stråle ut like mye som varmestråling. Uten atmosfære gir det σT
      <Sup>4</Sup> = {fmt(b.absorbed, 0)} W/m², altså T = {fmt(b.Tbare, 0)} K = {fmt(celsius(b.Tbare), 0)} °C.
    </p>
  );
  const second =
    eps > 0 ? (
      <p>
        Atmosfæren slipper sollyset gjennom, men drivhusgassene (vanndamp, CO₂ og metan) tar opp {fmt(eps * 100, 0)} % av varmestrålingen
        fra bakken. Laget blir {fmt(b.Tatm, 0)} K og stråler like mye opp som ned, så {fmt(b.atmDown, 0)} W/m² kommer tilbake til bakken.
        Bakken må da bli varmere, {fmt(b.Tsurface, 0)} K, for å bli kvitt energien. {greenhouse(b, albedo, eps)}
      </p>
    ) : (
      <p>
        Uten drivhusgasser slipper all varmestrålingen rett ut, og bakken får bare {fmt(b.Tsurface, 0)} K. Den naturlige drivhuseffekten
        gjør altså jorda beboelig. Øk andelen atmosfæren absorberer, og se temperaturen stige.
      </p>
    );
  const pct = (a: number) => fmt(a * 100, 0);
  const third =
    Math.abs(albedo - 0.3) > 0.005 ? (
      <p>
        Med albedo {fmt(albedo, 2)} reflekteres {pct(albedo)} % av sollyset. Nysnø reflekterer omtrent {pct(SURFACE_ALBEDO.sno)} %, mens
        åpent hav bare reflekterer {pct(SURFACE_ALBEDO.hav)} %. Mer is, snø og skyer gir derfor høyere albedo og kaldere jord.{' '}
        {albedo > 0.3
          ? 'Det virker motsatt også: det er derfor smeltende havis i Arktis forsterker oppvarmingen, fordi mørkt hav tar opp mye mer sollys enn den hvite isen.'
          : 'Med mindre is og snø blir jorda mørkere og tar opp mer sollys. Det er derfor smeltende havis i Arktis forsterker oppvarmingen.'}
      </p>
    ) : (
      <p>
        Det er derfor klare vinternetter er kaldest: uten skyer og med lite vanndamp i lufta slipper mer av varmestrålingen fra bakken rett
        ut i verdensrommet, og lite stråles tilbake ned.
      </p>
    );
  return (
    <>
      {first}
      {second}
      {third}
    </>
  );
}

/** Naturlig eller forsterket drivhuseffekt, sammenlignet med dagens jord (ε = 0,78). */
function greenhouse(b: Balance, albedo: number, eps: number): string {
  if (Math.abs(albedo - TODAY.albedo) > 0.005)
    return `Drivhuseffekten gjør bakken ${fmt(b.Tsurface - b.Tbare, 0)} K varmere enn uten atmosfære.`;
  const diff = b.Tsurface - TS_TODAY;
  if (Math.abs(eps - TODAY.eps) < 0.005)
    return `Dette er den naturlige drivhuseffekten, og den er nødvendig: uten den ville middeltemperaturen vært ${fmt(celsius(b.Tbare), 0)} °C i stedet for ${fmt(celsius(T_TODAY), 0)} °C.`;
  if (eps > TODAY.eps)
    return `Atmosfæren tar opp mer varmestråling enn i dag, og bakken blir ${fmt(diff, 1)} K varmere. Slik virker den menneskeskapte (forsterkede) drivhuseffekten: utslipp av CO₂ og andre drivhusgasser kommer i tillegg til den naturlige drivhuseffekten, som vi trenger.`;
  return `Atmosfæren tar opp mindre varmestråling enn i dag, og bakken blir ${fmt(-diff, 1)} K kaldere. Uten noen drivhuseffekt ville middeltemperaturen vært ${fmt(celsius(b.Tbare), 0)} °C.`;
}
