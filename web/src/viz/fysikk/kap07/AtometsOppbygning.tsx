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
  Slider,
  Txt,
  VizLayout,
  fmt,
  useTextScale,
} from '../../kit';
import { Dimension, useSceneScale } from '../../kit/scene';
import {
  AtomBackdrop,
  AtomElectrons,
  NuclideCard,
  NucleusLens,
  PitchStrip,
  TinyNucleus,
  ZoomCone,
  nucleusSizeText,
  occupiedRadius,
  pitchStripHeight,
} from './atomets-oppbygning-scene';
import { PeriodicExcerpt, tableLayout } from './atomets-oppbygning-tabell';
import { elementNameCap, nuclideText } from './elements';
import { atomInfo, chargeSuperscript, electronRange, mostCommonA, neutronRange, STABLE_ISOTOPES, type AtomInfo } from './model';
import {
  EVERYDAY,
  atomToNucleusRatio,
  groupOfColumn,
  outerElectrons,
  roundSig,
  scaleObject,
  scaledNucleus,
  tablePosition,
} from './model-atomets-oppbygning';
import { PARTICLE } from './parts';
import { useFigureTextScale } from './useNarrow';

interface State {
  Z: number;
  N: number;
  e: number;
}

/**
 * Plasseringen av atomet, utsnittet med kjernen, navnekortet og fotballbanen. PC: atomet til venstre, utsnittet i
 * midten og navnet til høyre, fotballbanen under. Mobil: atomet forstørret øverst, utsnittet og navnet under hverandre
 * i to kolonner, fotballbanen nederst.
 */
interface SceneLayout {
  atom: { cx: number; cy: number; radii: number[] };
  lens: { cx: number; cy: number; R: number };
  card: { x: number; symbolY: number; size: number };
  stripY: number;
}

const DESKTOP: SceneLayout = {
  atom: { cx: 180, cy: 200, radii: [50, 80, 110, 140] },
  lens: { cx: 430, cy: 152, R: 90 },
  card: { x: 668, symbolY: 150, size: 86 },
  stripY: 366,
};

const MOBILE: SceneLayout = {
  atom: { cx: 400, cy: 310, radii: [84, 130, 176, 222] },
  lens: { cx: 205, cy: 726, R: 138 },
  card: { x: 594, symbolY: 694, size: 118 },
  stripY: 946,
};

export default function AtometsOppbygning() {
  const [s, setS] = useState<State>({ Z: 11, N: 12, e: 11 });
  const [nLo, nHi] = neutronRange(s.Z);
  const [eLo, eHi] = electronRange(s.Z);
  const a = atomInfo(s.Z, s.N, s.e);
  const [ref, f] = useFigureTextScale<HTMLDivElement>();
  const narrow = f > 1.3;
  const L = narrow ? MOBILE : DESKTOP;
  const H1 = L.stripY + pitchStripHeight(f);
  const H2 = tableLayout(f).H;

  // Nytt grunnstoff: start med den vanligste stabile isotopen som nøytralt atom.
  const setZ = (Z: number) => setS({ Z, N: mostCommonA(Z) - Z, e: Z });

  return (
    <VizLayout>
      <Controls>
        <Slider label="Antall protoner Z" value={s.Z} onChange={setZ} min={1} max={20} step={1} />
        <Slider label="Antall nøytroner N" value={s.N} onChange={(N) => setS((p) => ({ ...p, N }))} min={nLo} max={nHi} step={1} />
        <Slider label="Antall elektroner" value={s.e} onChange={(e) => setS((p) => ({ ...p, e }))} min={eLo} max={eHi} step={1} />
      </Controls>

      <div ref={ref}>
        <Figure
          viewBox={`0 0 800 ${Math.round(H1)}`}
          label={`${elementNameCap(a.Z)}-${a.A} med ${a.Z} protoner og ${a.N} nøytroner i kjernen og ${a.electrons} elektroner i skallene ${a.shells.join(', ')}. Kjernen er vist forstørret i et utsnitt. Under: hvis atomet var en fotballbane, ville kjernen vært ${scaleObject(scaledNucleus(a.A) * 1000).name} på midtpunktet.`}
          caption="Kjernen er tegnet forstørret i utsnittet. I riktig målestokk ville den vært et usynlig punkt midt i atomet."
          maxHeight={narrow ? H1 : H1 + 40}
        >
          <AtomScene a={a} L={L} />
        </Figure>
      </div>
      <Legend
        items={[
          { color: PARTICLE.proton, label: `Protoner: ${a.Z}` },
          { color: PARTICLE.neutron, label: `Nøytroner: ${a.N}` },
          { color: PARTICLE.electron, label: `Elektroner: ${a.electrons}` },
        ]}
      />
      <Figure
        viewBox={`0 0 800 ${Math.round(H2)}`}
        label={`Utsnitt av periodesystemet med grunnstoffene Z = 1–20. ${elementNameCap(a.Z)} er valgt. Klikk på et grunnstoff for å velge det.`}
        maxHeight={narrow ? H2 : H2 + 30}
      >
        <PeriodicExcerpt Z={a.Z} onPick={setZ} />
      </Figure>

      <Readouts>
        <Readout label="Nukleontall A" value={String(a.A)} />
        <Readout label="Ladning" value={chargeText(a.charge)} unit={a.charge === 0 ? undefined : 'e'} />
        <Readout label="Kjernen er" value={statusShort(a)} />
        <Readout label="Andel av massen i kjernen" value={fmt(a.nucleusMassFraction * 100, 2)} unit="%" />
      </Readouts>

      <Formula label="Nukleontall og ladning">
        <FormulaLine>
          A = Z + N = {a.Z} + {a.N} = {a.A}
        </FormulaLine>
        <FormulaLine>q = (Z − antall elektroner) · e</FormulaLine>
        <FormulaLine>
          q = ({a.Z} − {a.electrons}) · e = {a.charge === 0 ? '0' : `${chargeText(a.charge)} e`}
        </FormulaLine>
      </Formula>

      <Explain>{explanation(a)}</Explain>
    </VizLayout>
  );
}

function AtomScene({ a, L }: { a: AtomInfo; L: SceneLayout }) {
  const f = useTextScale();
  const k = useSceneScale();
  const { cx, cy, radii } = L.atom;
  const { lens, card } = L;
  const shells = a.shells.length;
  const Rocc = occupiedRadius(radii, shells);
  const ring = 9 * k;
  const dimY = cy - Rocc - 20 * k;
  return (
    <>
      <AtomBackdrop cx={cx} cy={cy} radii={radii} shells={shells} />
      <ZoomCone x1={cx} y1={cy} r1={ring} x2={lens.cx} y2={lens.cy} r2={lens.R} />
      <AtomElectrons cx={cx} cy={cy} radii={radii} shells={a.shells} r={9.5 * k} />
      <TinyNucleus cx={cx} cy={cy} Z={a.Z} N={a.N} ring={ring} />
      {shells > 0 && <AtomSize cx={cx} y={dimY} R={Rocc} />}

      <NucleusLens cx={lens.cx} cy={lens.cy} R={lens.R} Z={a.Z} N={a.N} rn={12 * k} />
      <Txt x={lens.cx} y={lens.cy - lens.R - 12 * f} weight={700}>
        Kjernen, forstørret
      </Txt>
      <Txt x={lens.cx} y={lens.cy + lens.R + 26 * f} weight={650}>
        d ≈ {nucleusSizeText(a.A)}
      </Txt>

      <NuclideCard a={a} x={card.x} symbolY={card.symbolY} size={card.size} />
      <PitchStrip y0={L.stripY} A={a.A} />
    </>
  );
}

/** Mållinje over atomet: «Atomet: ca. 10⁻¹⁰ m». */
function AtomSize({ cx, y, R }: { cx: number; y: number; R: number }) {
  return <Dimension x1={cx - R} y1={y} x2={cx + R} y2={y} label="Atomet: ca. 10⁻¹⁰ m" labelSize={0.85} />;
}

function chargeText(q: number): string {
  if (q === 0) return '0';
  return q > 0 ? `+${q}` : `−${-q}`;
}

/** Alle kjerner som ikke er stabile, er radioaktive (ustabil og radioaktiv betyr det samme). */
function statusShort(a: AtomInfo): string {
  return a.status === 'stabil' ? 'Stabil' : 'Radioaktiv';
}

function explanation(a: AtomInfo): ReactNode {
  const iso = nuclideText(a.Z, a.A);
  const stable = STABLE_ISOTOPES[a.Z] ?? [];
  const common = stable[0];
  const ion = `${a.symbol}${chargeSuperscript(a.charge)}`;
  const name = a.name;

  let isotope: ReactNode;
  if (a.status === 'stabil') {
    isotope =
      stable.length === 1 ? (
        <>
          {iso} er den eneste stabile isotopen av {name}.
        </>
      ) : a.A === common ? (
        <>
          {iso} er den vanligste av de stabile isotopene ({stable.map((A) => nuclideText(a.Z, A)).join(', ')}).
        </>
      ) : (
        <>
          {iso} er en stabil isotop: samme protontall som {nuclideText(a.Z, common ?? a.A)}, men{' '}
          {plural(Math.abs(a.A - (common ?? a.A)), 'nøytron', 'nøytroner')} {a.A > (common ?? a.A) ? 'mer' : 'mindre'}, så nukleontallet A
          blir {a.A}.
        </>
      );
  } else if (a.status === 'radioaktiv') {
    isotope = (
      <>
        {iso} er en <strong>radioaktiv isotop</strong> med halveringstid {a.halfLife}. Isotoper har samme protontall Z, men ulikt
        nukleontall A.
      </>
    );
  } else if (a.status === 'for-mange-noytroner') {
    isotope = (
      <>
        {iso} har <strong>for mange nøytroner</strong> til å være stabil. Slike kjerner er radioaktive og henfaller, typisk ved β⁻-stråling
        der et nøytron blir til et proton.
      </>
    );
  } else if (a.status === 'for-faa-noytroner') {
    isotope = (
      <>
        {iso} har <strong>for få nøytroner</strong> til å være stabil. Nøytronene trengs som «lim» mellom protonene, som frastøter
        hverandre. Slike kjerner er radioaktive og henfaller, typisk ved β⁺-stråling der et proton blir til et nøytron.
      </>
    );
  } else {
    isotope = <>{iso} er ingen stabil kombinasjon av protoner og nøytroner, så kjernen er radioaktiv.</>;
  }

  let charge: ReactNode;
  if (a.electrons === 0) {
    charge =
      a.Z === 2 && a.N === 2 ? (
        <>Alle elektronene er fjernet, og bare kjernen er igjen. En heliumkjerne er det samme som en alfapartikkel.</>
      ) : a.Z === 1 && a.N === 0 ? (
        <>Uten elektronet er hydrogenatomet bare ett proton, H⁺.</>
      ) : (
        <>Alle elektronene er fjernet, og bare kjernen er igjen, med ladning +{a.Z} e.</>
      );
  } else if (a.charge === 0) {
    charge = <>Atomet er nøytralt fordi det har like mange elektroner som protoner.</>;
  } else if (a.charge > 0) {
    charge = (
      <>
        Med {a.electrons} elektroner og {a.Z} protoner er det et <strong>positivt ion</strong>, {ion}: atomet har mistet{' '}
        {plural(a.charge, 'elektron', 'elektroner')}.
      </>
    );
  } else {
    charge = (
      <>
        Med {a.electrons} elektroner og {a.Z} protoner er det et <strong>negativt ion</strong>, {ion}: atomet har tatt opp{' '}
        {plural(-a.charge, 'elektron', 'elektroner')}.
        {NOBLE_GASES.includes(a.Z)
          ? ` I virkeligheten holder ikke ${a.name} på ekstra elektroner, fordi det ytterste skallet allerede er fullt.`
          : ''}
      </>
    );
  }

  const pos = tablePosition(a.Z);
  const outer = outerElectrons(a.Z);
  const shellsNeutral = pos?.period ?? 0;
  let table: ReactNode = null;
  if (pos) {
    table =
      a.Z === 2 ? (
        <>
          I periodesystemet står helium i periode 1 (ett skall) og i gruppe 18 sammen med de andre edelgassene. Det har bare to
          elektroner, men det ytterste (og eneste) skallet er fullt med to.
        </>
      ) : (
        <>
          I periodesystemet står {name} i periode {pos.period} og gruppe {groupOfColumn(pos.col)}: det nøytrale atomet har{' '}
          {count(shellsNeutral)} skall, og {plural(outer, 'elektron', 'elektroner')} i det ytterste. Klikk på et annet grunnstoff i
          periodesystemet for å bytte.
        </>
      );
  }

  const ratio = roundSig(atomToNucleusRatio(a.A), 2);
  const mm = scaledNucleus(a.A) * 1000;
  const thing = scaleObject(mm).name;
  const everyday = EVERYDAY[a.Z];

  return (
    <>
      <p>
        Det er antall protoner som bestemmer grunnstoffet: alle atomer med Z = {a.Z} er {name}. {isotope} {charge}
      </p>
      {table && <p>{table}</p>}
      <p>
        Kjernen er bare ca. {nucleusSizeText(a.A)} bred, mens et atom er ca. 10⁻¹⁰ m, altså rundt {fmt(ratio, 0)} ganger bredere. Hvis
        atomet var en fotballbane, ville kjernen vært {thing} på midtpunktet, og likevel sitter {fmt(a.nucleusMassFraction * 100, 2)} %
        av massen der{a.electrons === 0 ? ' (her er alle elektronene fjernet, så hele massen er i kjernen)' : ''}. Det er derfor vi sier at
        atomet nesten bare er tomrom.
      </p>
      {everyday && (
        <p>
          <strong>I hverdagen:</strong> {everyday}
        </p>
      )}
    </>
  );
}

/** Tallord for små tall (antall skall). */
function count(n: number): string {
  return ['null', 'ett', 'to', 'tre', 'fire'][n] ?? String(n);
}

/** Edelgassene i figuren (helium, neon og argon) har fullt ytterste skall. */
const NOBLE_GASES = [2, 10, 18];

function plural(n: number, one: string, many: string): string {
  const word = n === 1 ? 'ett' : n === 2 ? 'to' : n === 3 ? 'tre' : String(n);
  return `${word} ${n === 1 ? one : many}`;
}
