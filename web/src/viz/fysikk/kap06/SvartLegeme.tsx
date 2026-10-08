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
  fmtSci,
} from '../../kit';
import { planck, stefanBoltzmann, wienPeak } from './model';
import { LEGEMER, T_MAX, T_MIN, T_STEP, T_SUN, andeler, glodTrinn, legemeVed, type Andeler } from './model-svart-legeme';
import { useNarrow } from './marks';
import { CURVE, SUN, SUN_PEAK, SpekterGraf, fordelingHoyde, prosent } from './svart-legeme-graf';
import { TemperaturScene, sceneHeight } from './svart-legeme-scene';

const nm = (v: number) => v * 1e9;

/** Hardt mellomrom, så «2,1 · 10⁻⁴» ikke brytes over to linjer i tallboksene. */
const nb = (t: string) => t.replace(/ /g, '\u00a0');

/** Tall med tre gjeldende sifre, på standardform når de er store: 13 600, 6,42 · 10⁷. */
function fmtI(I: number): string {
  if (I >= 1e5) return fmtSci(I, 2);
  return fmt(sig3(I), 0);
}

/** Rundet til tre gjeldende sifre. */
function sig3(v: number): number {
  if (!(v > 0)) return 0;
  const mag = 10 ** (Math.floor(Math.log10(v)) - 2);
  return Math.round(v / mag) * mag;
}

/**
 * Intensiteten i tallboksen med passende prefiks (W, kW eller MW per m²) og tre gjeldende sifre, så tallet er kort
 * nok til en smal skjerm: 13 600 W/m², 287 kW/m², 64,2 MW/m². Utregningen under viser samme tall på standardform.
 */
function intensitetVerdi(I: number): { value: string; unit: string } {
  const [k, unit] = I < 1e5 ? [1, 'W/m²'] : I < 1e7 ? [1e3, 'kW/m²'] : [1e6, 'MW/m²'];
  const v = sig3(I / k);
  return { value: fmt(v, v >= 100 ? 0 : v >= 10 ? 1 : 2), unit };
}

/** Små forholdstall og prosenter: vanlige desimaler når det går, ellers standardform. */
function fmtSmall(v: number): string {
  if (!(v > 0)) return '0';
  if (v >= 10) return fmt(v, 0);
  if (v >= 1) return fmt(v, 1);
  if (v >= 0.01) return fmt(v, v >= 0.1 ? 2 : 3);
  return fmtSci(v, 1);
}

export default function SvartLegeme() {
  const [T, setT] = useState(T_SUN);
  const [showSun, setShowSun] = useState(true);
  const [sceneRef, narrowScene] = useNarrow<HTMLDivElement>();
  const [graphRef, narrow] = useNarrow<HTMLDivElement>();
  const peak = wienPeak(T);
  const I = stefanBoltzmann(T);
  const andel = andeler(T);
  const ratioSun = (T / T_SUN) ** 4;
  const preset = legemeVed(T)?.id ?? 'egen';
  const extra = fordelingHoyde(narrow);
  const height = (narrow ? 580 : 384) + extra;
  // Er Sola mye sterkere, går kurven dens langt over grafen. Da står forholdet i fargeforklaringen i stedet.
  const sunRatio = SUN_PEAK / planck(peak, T);
  const sunOnScale = sunRatio < 2.5;
  const sunVisible = showSun && T !== T_SUN;
  const sceneH = sceneHeight(narrowScene);

  return (
    <VizLayout>
      <Controls>
        <Slider label="Temperatur T" value={T} onChange={setT} min={T_MIN} max={T_MAX} step={T_STEP} unit="K" />
      </Controls>
      <Toolbar>
        <Segmented<string>
          label="Velg et legeme"
          options={LEGEMER.map((l) => ({ value: l.id, label: l.navn }))}
          value={preset}
          onChange={(v) => setT(LEGEMER.find((l) => l.id === v)?.T ?? T)}
        />
        <Toggle label="Vis Sola til sammenligning" checked={showSun} onChange={setShowSun} />
      </Toolbar>

      <div ref={sceneRef}>
        <Figure
          viewBox={`0 0 800 ${sceneH}`}
          label={`Glødende ting om kvelden, ordnet etter temperatur på en temperaturlinjal i glødefargen: ${LEGEMER.map((l) => `${l.navn.toLowerCase()} ${fmt(l.T, 0)} K`).join(', ')}. Markøren står på ${fmt(T, 0)} K.`}
          maxHeight={narrowScene ? 760 : 420}
          caption="Klikk på en ting eller på temperaturlinjalen for å velge temperaturen."
        >
          <TemperaturScene T={T} narrow={narrowScene} onPick={setT} />
        </Figure>
      </div>

      <div ref={graphRef}>
        <Figure
          viewBox={`0 0 800 ${height}`}
          label={`Plancks strålingskurve for et svart legeme på ${fmt(T, 0)} K. Toppen ligger ved ${fmt(nm(peak), 0)} nanometer. ${prosent(andel.uv)} av strålingen er ultrafiolett, ${prosent(andel.synlig)} synlig lys og ${prosent(andel.ir)} infrarød.`}
          maxHeight={narrow ? 720 : 520}
        >
          <SpekterGraf T={T} showSun={sunVisible && sunOnScale} height={height} extra={extra} andel={andel} />
        </Figure>
      </div>
      <Legend
        items={[
          { color: CURVE, label: `Svart legeme, ${fmt(T, 0)} K` },
          ...(sunVisible
            ? [
                {
                  color: SUN,
                  label: sunOnScale
                    ? `Sola, ${fmt(T_SUN, 0)} K`
                    : `Sola, ${fmt(T_SUN, 0)} K: toppen er ${fmtI(sunRatio)} ganger høyere og går utenfor grafen`,
                  dashed: true,
                },
              ]
            : []),
        ]}
      />

      <Readouts>
        <Readout
          label={
            <>
              Toppen λ<Sub>maks</Sub>
            </>
          }
          value={fmt(nm(peak), 0)}
          unit="nm"
        />
        <Readout label="Intensitet I = σT⁴" {...intensitetVerdi(I)} />
        <Readout label="I forhold til Sola" value={nb(fmtSmall(ratioSun))} unit={ratioSun < 0.01 ? undefined : 'ganger'} />
        <Readout label="Andel synlig lys" value={nb(fmtSmall(andel.synlig * 100))} unit="%" />
      </Readouts>

      <Formula label="Wiens forskyvningslov og Stefan–Boltzmanns lov">
        <FormulaLine>
          λ<Sub>maks</Sub> = b / T = 2,90 · 10<Sup>−3</Sup> m·K / {fmt(T, 0)} K = {fmtSci(peak, 2)} m = {fmt(nm(peak), 0)} nm
        </FormulaLine>
        <FormulaLine>
          I = σT<Sup>4</Sup> = 5,67 · 10<Sup>−8</Sup> W/(m²·K<Sup>4</Sup>) · ({fmt(T, 0)} K)<Sup>4</Sup> = {fmtI(I)} W/m²
        </FormulaLine>
      </Formula>

      <Explain>{explanation(T, peak, andel)}</Explain>
    </VizLayout>
  );
}

function explanation(T: number, peak: number, andel: Andeler): ReactNode {
  const p = <>λ<Sub>maks</Sub> = {fmt(nm(peak), 0)} nm</>;
  const vis = prosent(andel.synlig);
  let first: ReactNode;
  switch (glodTrinn(T)) {
    case 'ingen':
      first = (
        <p>
          <strong>Ingen synlig glød.</strong> Toppen ligger langt inne i infrarødt ({p}), og nesten all strålingen er usynlig
          varmestråling. Under omtrent 800 K ser du ikke at et legeme gløder, men du kjenner varmen på huden. Det er derfor en
          kokeplate kan brenne deg selv om den ser svart ut.
        </p>
      );
      break;
    case 'morkerod':
      first = (
        <p>
          <strong>Svak, mørkerød glød.</strong> Toppen ligger i infrarødt ({p}), og bare {vis} av strålingen er synlig lys, nesten
          bare den røde enden av spekteret. Slik gløder en kokeplate på full styrke: du kjenner varmen godt, men ser gløden best når
          det er mørkt i rommet.
        </p>
      );
      break;
    case 'oransje':
      first = (
        <p>
          <strong>Oransje til gul glød.</strong> Toppen ligger fortsatt i infrarødt ({p}), men nå er {vis} av strålingen synlig
          lys, med både rødt, oransje og gult. Det er derfor smeden jobber i halvmørke: fargen på jernet viser hvor varmt det er, og rundt
          1 500 K er det mykt nok til å smis.
        </p>
      );
      break;
    case 'gulhvit':
      first = (
        <p>
          <strong>Gulhvitt lys, men toppen er fortsatt i infrarødt</strong> ({p}). Bare {vis} av strålingen er synlig lys. Det er
          derfor en glødelampe (2 800 K) blir så varm: over 90 % av strålingen er usynlig varmestråling. Stjerna Betelgeuse
          (3 500 K) ser oransjerød ut på himmelen.
        </p>
      );
      break;
    case 'hvit':
      first = (
        <p>
          <strong>Toppen ligger i det synlige området</strong> ({p}). Alle fargene er med, så lyset ser hvitt ut, og {vis} av
          strålingen er synlig lys. Sola (5 800 K) er et slikt legeme: sett fra verdensrommet er den hvit.
        </p>
      );
      break;
    default:
      first = (
        <p>
          <strong>Toppen ligger i ultrafiolett</strong> ({p}). I det synlige området er det mer blått enn rødt, så legemet ser
          blåhvitt ut, og hele {prosent(andel.uv)} av strålingen er UV. Sirius og Rigel er slike stjerner. Se på stjernebildet Orion
          en vinterkveld: Rigel er blåhvit, mens Betelgeuse er oransjerød fordi den er mye kaldere.
        </p>
      );
  }
  return (
    <>
      {first}
      <p>
        Dobler du temperaturen, blir λ<Sub>maks</Sub> halvparten så stor (Wiens lov), og intensiteten, som er arealet under kurven, blir 2
        <Sup>4</Sup> = 16 ganger så stor (Stefan–Boltzmanns lov). T må alltid være i kelvin. Alle legemer stråler, også du: ved 310 K ligger
        toppen på omtrent {fmt(Math.round(nm(wienPeak(310)) / 100) * 100, 0)} nm, langt inne i infrarødt.
      </p>
    </>
  );
}
