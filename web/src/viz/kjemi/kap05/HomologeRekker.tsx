import { useMemo, useState, type ReactNode } from 'react';
import {
  Controls,
  Explain,
  Figure,
  Formel,
  Formula,
  FormulaLine,
  Legend,
  Plot,
  Readout,
  Readouts,
  Segmented,
  Slider,
  Sub,
  TFormel,
  Toolbar,
  Txt,
  VIZ,
  VizLayout,
  capitalize,
  fmt,
  formulaText,
  linePath,
  molarMass,
  useContainerTextScale,
} from '../kit';
import { SERIES, generalFormula, series as getSeries, seriesMember, seriesSpec, stateAt25, type Series, type SeriesId } from './model';
import { condensed, functionalGroups, molFormula, molecule, subscriptDigits, type View } from './struktur';
import { GROUP, MoleculeView, VIEW_OPTIONS, fitMolecule, fontPx, marginPx, minUnit } from './Struktur';
import { bounds } from './struktur';

/** Fast farge for hver rekke i grafen. */
const COLOR: Record<SeriesId, string> = {
  alkaner: VIZ.series[0]!,
  alkener: VIZ.series[2]!,
  alkyner: VIZ.series[4]!,
  alkoholer: VIZ.series[1]!,
  karboksylsyrer: VIZ.series[3]!,
};

const fmtC = (v: number) => `${fmt(v, 1)} °C`;

export default function HomologeRekker() {
  const [sid, setSid] = useState<SeriesId>('alkoholer');
  const [n, setN] = useState(3);
  const [view, setView] = useState<View>('struktur');
  const [ref, f] = useContainerTextScale<HTMLDivElement>();
  const s = getSeries(sid);
  const nn = Math.max(s.nMin, n);
  const m = seriesMember(sid, nn);
  const mol = useMemo(() => molecule(seriesSpec(sid, nn)), [sid, nn]);
  const fFormula = molFormula(mol);
  const M = molarMass(fFormula);
  const groups = functionalGroups(mol);
  const cond = condensed(mol);
  const alkane = seriesMember('alkaner', nn);
  const H = useMemo(() => sceneHeight(s, view, f), [s, view, f]);
  const plotH = Math.round(340 + 260 * (f - 1));

  const changeSeries = (v: SeriesId) => {
    setSid(v);
    setN((old) => Math.max(getSeries(v).nMin, old));
  };

  return (
    <VizLayout>
      <Toolbar>
        <Segmented label="Velg homolog rekke" options={SERIES.map((x) => ({ value: x.id, label: x.name }))} value={sid} onChange={changeSeries} />
      </Toolbar>
      <Controls>
        <Slider label="Antall karbonatomer n" ariaLabel="Antall karbonatomer" value={nn} onChange={setN} min={s.nMin} max={8} step={1} />
      </Controls>
      <Toolbar>
        <Segmented label="Visning" options={VIEW_OPTIONS} value={view} onChange={setView} />
      </Toolbar>

      <div ref={ref}>
        <Figure
          viewBox={`0 0 800 ${H}`}
          label={`${capitalize(m.name)}, ${formulaText(fFormula)}, i ${VIEW_OPTIONS.find((o) => o.value === view)!.label.toLowerCase()}. Funksjonell gruppe: ${s.group}.`}
          caption={
            view === 'skjelett'
              ? 'Skjelettformel: hvert hjørne og hver ende er et C-atom, og H-atomene på karbon er ikke tegnet.'
              : view === 'kule'
                ? 'Kule-pinne-modell i planet. I virkeligheten står bindingene rundt et enkeltbundet C i 109,5° (tetraeder).'
                : 'Strukturformel: alle atomer og bindinger. Vinklene er tegnet som 90° og 120°, ikke som de er i rommet.'
          }
          maxHeight={H}
        >
          <Scene s={s} n={nn} view={view} f={f} H={H} />
        </Figure>
      </div>
      {groups.length > 0 && <Legend items={[{ color: GROUP, label: `Funksjonell gruppe: ${s.group}` }]} />}

      <Figure
        viewBox={`0 0 800 ${plotH}`}
        label={`Kokepunkt mot antall karbonatomer for ${s.name.toLowerCase()}${sid === 'alkaner' ? '' : ' og alkaner'}. ${capitalize(m.name)} koker ved ${fmtC(m.bp)}.`}
        caption="Kokepunkt ved 1 atm (CRC Handbook). Stiplet linje: romtemperatur 25 °C. Over linja er stoffet flytende ved romtemperatur."
        maxHeight={plotH}
      >
        <BoilingPlot sid={sid} n={nn} height={plotH} f={f} />
      </Figure>
      <Legend
        items={
          sid === 'alkaner'
            ? [{ color: COLOR.alkaner, label: 'Alkaner' }]
            : [
                { color: COLOR[sid], label: s.name },
                { color: COLOR.alkaner, label: 'Alkaner (til sammenligning)', dashed: true },
              ]
        }
      />

      <Readouts>
        <Readout label="Molekylformel" value={formulaText(fFormula)} />
        <Readout label="Molar masse M" value={fmt(M, 2)} unit="g/mol" />
        <Readout label={m.sublimes ? 'Sublimerer ved' : 'Kokepunkt'} value={fmt(m.bp, 1)} unit="°C" tone={COLOR[sid]} />
        <Readout label="Ved 25 °C" value={capitalize(stateAt25(m.bp))} />
      </Readouts>

      <Formula label="Formler">
        <FormulaLine>
          Generell formel: <GeneralFormula s={s} /> med n = {nn} gir <Formel f={fFormula} />
          {sid === 'karboksylsyrer' && <> = {nn === 1 ? 'HCOOH' : <Formel f={`${nn === 2 ? 'C' : `C${nn - 1}`}H${2 * nn - 1}COOH`} />}</>}
          {sid === 'alkoholer' && (
            <>
              {' '}
              = <Formel f={`${nn === 1 ? 'C' : `C${nn}`}H${2 * nn + 1}OH`} />
            </>
          )}
        </FormulaLine>
        {cond && <FormulaLine>Forenklet strukturformel: {subscriptDigits(cond)}</FormulaLine>}
        <FormulaLine>
          Navn: stammen «{stemOf(m.name)}» betyr {nn} C, og endelsen «{s.ending}» viser at stoffet er en {s.singular}.
        </FormulaLine>
      </Formula>

      <Explain>{explanation(s, nn, m.bp, alkane.bp, M)}</Explain>
    </VizLayout>
  );
}

/** Navnestammen slik den står i navnet (met, et, prop, but-, …). */
function stemOf(name: string): string {
  const m = /^(met|et|prop|but|pent|heks|hept|okt)/.exec(name);
  return m ? m[1]! : name;
}

/** CₙH₂ₙ₊₂ osv. med senket skrift. */
function GeneralFormula({ s }: { s: Series }) {
  switch (s.id) {
    case 'alkaner':
      return (
        <>
          C<Sub>n</Sub>H<Sub>2n+2</Sub>
        </>
      );
    case 'alkener':
      return (
        <>
          C<Sub>n</Sub>H<Sub>2n</Sub>
        </>
      );
    case 'alkyner':
      return (
        <>
          C<Sub>n</Sub>H<Sub>2n−2</Sub>
        </>
      );
    case 'alkoholer':
      return (
        <>
          C<Sub>n</Sub>H<Sub>2n+1</Sub>OH
        </>
      );
    case 'karboksylsyrer':
      return (
        <>
          C<Sub>n−1</Sub>H<Sub>2n−1</Sub>COOH = C<Sub>n</Sub>H<Sub>2n</Sub>O<Sub>2</Sub>
        </>
      );
  }
}

/* ---------- Figur 1: molekylet ---------- */

const headerH = (f: number) => 40 * f;
/** Største enhet (px per C–C): større på mobil, så korte molekyler fyller figuren. */
const uMaxFor = (f: number) => 88 * Math.max(1, 0.85 * f);

/** Høyden på molekylfiguren: den største i rekka, så figuren ikke hopper når du endrer n. */
function sceneHeight(s: Series, view: View, f: number): number {
  let h = 0;
  for (const m of s.members) {
    const mol = molecule(seriesSpec(s.id, m.n));
    const b = bounds(mol, view);
    const bw = Math.max(1e-6, b.maxX - b.minX);
    const u = Math.max(minUnit(view, f), Math.min(uMaxFor(f), (760 - 2 * marginPx(view, f)) / bw));
    h = Math.max(h, (b.maxY - b.minY) * u + 2 * marginPx(view, f));
  }
  return Math.round(headerH(f) + h + 16 * f);
}

function Scene({ s, n, view, f, H }: { s: Series; n: number; view: View; f: number; H: number }) {
  const mol = molecule(seriesSpec(s.id, n));
  const m = seriesMember(s.id, n);
  const fit = fitMolecule(mol, view, { x: 20, y: headerH(f), w: 760, h: H - headerH(f) - 8 }, f, uMaxFor(f));
  const groups = functionalGroups(mol);
  const methane = view === 'skjelett' && mol.atoms.filter((a) => a.z).length === 1 && mol.atoms[0]!.el === 'C';
  return (
    <g>
      <Txt x={20} y={26 * f} anchor="start" size={1.15} weight={700}>
        {capitalize(m.name)}
        {m.trivial && (
          <tspan className="is-muted" fontWeight={500}>
            {' '}
            ({m.trivial})
          </tspan>
        )}
      </Txt>
      <Txt x={780} y={26 * f} anchor="end" size={1.1} weight={600} color={COLOR[s.id]}>
        <TFormel f={molFormula(mol)} />
      </Txt>
      {methane ? (
        <Txt x={400} y={headerH(f) + (H - headerH(f)) / 2 + fontPx(f) * 0.3} size={1.3} weight={650}>
          <TFormel f="CH4" />
          <tspan className="is-muted" fontWeight={500} fontSize="0.7em">
            {'  '}(for lite til en skjelettformel)
          </tspan>
        </Txt>
      ) : (
        <MoleculeView mol={mol} view={view} fit={fit} groups={groups} />
      )}
    </g>
  );
}

/* ---------- Figur 2: kokepunkt mot n ---------- */

function BoilingPlot({ sid, n, height, f }: { sid: SeriesId; n: number; height: number; f: number }) {
  const s = getSeries(sid);
  const alk = getSeries('alkaner');
  const pts = (x: Series) => x.members.map((m) => [m.n, m.bp] as [number, number]);
  const m = seriesMember(sid, n);
  // Ved n = 1 er det ikke plass til venstre for punktet: tallet står til høyre, på samme høyde når kurven stiger bratt
  // (alkanene), ellers litt over kurven
  const next = s.members.find((x) => x.n === n + 1);
  const labelY = (sy: (v: number) => number) =>
    n >= 2 ? sy(m.bp) - 18 * f : next && next.bp - m.bp > 40 ? sy(m.bp) + 6 * f : sy(m.bp) - 14 * f;
  return (
    <Plot
      x={{ min: 1, max: 8, label: 'Antall karbonatomer n', ticks: [1, 2, 3, 4, 5, 6, 7, 8] }}
      y={{ min: -180, max: 260, label: 'Kokepunkt (°C)', ticks: [-150, -100, -50, 0, 50, 100, 150, 200, 250] }}
      width={800}
      height={height}
    >
      {({ sx, sy, x0, x1 }) => (
        <g>
          <line x1={x0} x2={x1} y1={sy(25)} y2={sy(25)} stroke={VIZ.muted} strokeWidth={1.5} strokeDasharray="6 5" />
          <Txt x={x1 - 8} y={sy(25) - 8} anchor="end" size={0.75} muted>
            25 °C
          </Txt>
          {sid !== 'alkaner' && (
            <g opacity={0.75}>
              <path d={linePath(pts(alk), sx, sy)} fill="none" stroke={COLOR.alkaner} strokeWidth={2} strokeDasharray="7 5" />
              {alk.members.map((a) => (
                <circle key={a.n} cx={sx(a.n)} cy={sy(a.bp)} r={4} fill={COLOR.alkaner} />
              ))}
            </g>
          )}
          <path d={linePath(pts(s), sx, sy)} fill="none" stroke={COLOR[sid]} strokeWidth={3} />
          {s.members.map((a) => (
            <circle key={a.n} cx={sx(a.n)} cy={sy(a.bp)} r={a.n === n ? 0 : 5} fill={COLOR[sid]} />
          ))}
          {sid !== 'alkaner' && (
            <line x1={sx(n)} x2={sx(n)} y1={sy(seriesMember('alkaner', n).bp)} y2={sy(m.bp)} stroke={VIZ.muted} strokeWidth={1.5} strokeDasharray="3 4" />
          )}
          <circle cx={sx(n)} cy={sy(m.bp)} r={8} fill={COLOR[sid]} stroke={VIZ.surface} strokeWidth={2} />
          <Txt
            x={n > 6 ? sx(n) - 12 : n < 2 ? sx(n) + 14 : sx(n) - 4}
            y={labelY(sy)}
            anchor={n > 6 ? 'end' : n < 2 ? 'start' : 'middle'}
            size={0.85}
            weight={700}
            color={COLOR[sid]}
          >
            {fmtC(m.bp)}
          </Txt>
        </g>
      )}
    </Plot>
  );
}

/* ---------- Forklaring ---------- */

function explanation(s: Series, n: number, bp: number, alkaneBp: number, M: number): ReactNode {
  const prev = s.members.find((x) => x.n === n - 1);
  const m = seriesMember(s.id, n);
  const step = prev ? (
    <>
      Fra {prev.name} til {m.name} stiger kokepunktet med {fmt(bp - prev.bp, 0)} °C.
    </>
  ) : null;
  const diff = bp - alkaneBp;
  // Alkanen med omtrent samme molare masse (like mange elektroner): da er det bare hydrogenbindingene som skiller
  const twin = getSeries('alkaner').members.find((a) => Math.abs(molarMass(generalFormula('alkaner', a.n)) - M) < 3);
  const sameMass = twin ? (
    <>
      {' '}
      Også sammenlignet med {twin.name}, som er omtrent like tung (M = {fmt(molarMass(generalFormula('alkaner', twin.n)), 2)} g/mol), koker {m.name}{' '}
      {fmt(bp - twin.bp, 0)} °C høyere. Det er altså ikke massen, men hydrogenbindingene som gir det høye kokepunktet.
    </>
  ) : null;
  const miscible = s.id === 'karboksylsyrer' ? 4 : 3;
  const solubility =
    n <= miscible ? (
      <>Med så kort karbonkjede blander stoffet seg godt med vann, fordi den polare gruppa danner hydrogenbindinger til vannmolekylene.</>
    ) : n <= miscible + 1 ? (
      <>Den upolare karbonkjeden begynner å bli lang, så stoffet er bare delvis løselig i vann.</>
    ) : (
      <>Den lange, upolare karbonkjeden gjør at stoffet er lite løselig i vann, selv om den polare gruppa er der.</>
    );
  let main: ReactNode;
  switch (s.id) {
    case 'alkaner':
      main = (
        <p>
          <strong>Alkaner er upolare</strong>, så bare London-krefter holder molekylene sammen. Hvert nytt CH<Sub>2</Sub>-ledd gir flere
          elektroner og større kontaktflate mellom molekylene, så London-kreftene blir sterkere og kokepunktet stiger. {step}{' '}
          {n <= 4 ? 'Alkaner med 1–4 C er gasser ved romtemperatur.' : 'Fra pentan og oppover er alkanene væsker ved romtemperatur.'}
        </p>
      );
      break;
    case 'alkener':
    case 'alkyner':
      main = (
        <p>
          <strong>
            {capitalize(s.name)} er nesten upolare, akkurat som alkanene.
          </strong>{' '}
          Dobbelt- eller trippelbindingen endrer ikke kreftene mellom molekylene mye, så kokepunktet ligger nær alkanen med like mange C (
          {fmt(diff, 0)} °C forskjell for n = {n}). Det er antallet elektroner og formen på molekylet som teller. {step}
          {m.sublimes ? ' Etyn har ikke noe kokepunkt ved vanlig trykk: det sublimerer.' : ''}
        </p>
      );
      break;
    case 'alkoholer':
      main = (
        <>
          <p>
            <strong>OH-gruppa gir hydrogenbindinger.</strong> H-atomet i –OH er bundet til det svært elektronegative O-atomet, så det
            dannes hydrogenbindinger mellom molekylene i tillegg til London-kreftene. Derfor koker {m.name} hele {fmt(diff, 0)} °C høyere
            enn {seriesMember('alkaner', n).name}.{sameMass} Forskjellen blir mindre for lange kjeder, fordi London-kreftene langs den upolare
            kjeden da betyr mer.
          </p>
          <p>{solubility}</p>
        </>
      );
      break;
    case 'karboksylsyrer':
      main = (
        <>
          <p>
            <strong>Karboksylgruppa –COOH gir sterke hydrogenbindinger.</strong> To syremolekyler kan binde seg til hverandre med to
            hydrogenbindinger (en dimer), så karboksylsyrene koker enda høyere enn alkoholene: {m.name} koker {fmt(diff, 0)} °C høyere enn{' '}
            {seriesMember('alkaner', n).name}, og {fmt(bp - seriesMember('alkoholer', n).bp, 0)} °C høyere enn {seriesMember('alkoholer', n).name}.
            {sameMass}
          </p>
          <p>{solubility}</p>
        </>
      );
      break;
  }
  return (
    <>
      {main}
      <p>
        I en homolog rekke skiller hvert stoff seg fra det neste med en CH<Sub>2</Sub>-gruppe ({fmt(molarMass('CH2'), 2)} g/mol). Alle har
        samme funksjonelle gruppe og samme generelle formel, så de har liknende kjemiske egenskaper, mens fysiske egenskaper som kokepunkt
        endrer seg jevnt med kjedelengden. Her er M = {fmt(M, 2)} g/mol.
      </p>
    </>
  );
}
