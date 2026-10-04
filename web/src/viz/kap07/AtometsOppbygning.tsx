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
  VIZ,
  VizLayout,
  fmt,
  useTextScale,
} from '../kit';
import { elementNameCap, nuclideText } from './elements';
import { atomInfo, chargeSuperscript, electronRange, mostCommonA, neutronRange, STABLE_ISOTOPES, type AtomInfo } from './model';
import { NuclideSymbol, Nucleus, PARTICLE, Txt } from './parts';
import { useNarrow } from './useNarrow';

interface State {
  Z: number;
  N: number;
  e: number;
}

/** Radiene til elektronskallene i figuren. Kjernen er aldri større enn ca. 56 (A ≤ 50). */
const SHELL_R = [84, 120, 156, 192];
const ATOM = { cx: 228, cy: 214 };
/** Mobil: atomet forstørres og står øverst, med symbolet under. */
const NARROW_ATOM_SCALE = 1.5;
const NARROW_ATOM_Y = 306;
const NARROW_TEXT_Y = 730;
const NARROW_H = 830;

export default function AtometsOppbygning() {
  const [s, setS] = useState<State>({ Z: 11, N: 12, e: 11 });
  const [nLo, nHi] = neutronRange(s.Z);
  const [eLo, eHi] = electronRange(s.Z);
  const a = atomInfo(s.Z, s.N, s.e);
  const [ref, narrow] = useNarrow<HTMLDivElement>();

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
          viewBox={`0 0 800 ${narrow ? NARROW_H : 430}`}
          label={`${elementNameCap(a.Z)}-${a.A} med ${a.Z} protoner og ${a.N} nøytroner i kjernen og ${a.electrons} elektroner i skallene ${a.shells.join(', ')}.`}
          caption="Figuren er ikke i målestokk: kjernen er i virkeligheten rundt 100 000 ganger mindre enn atomet."
          maxHeight={narrow ? NARROW_H : 430}
        >
          <AtomScene a={a} narrow={narrow} />
        </Figure>
      </div>
      <Legend
        items={[
          { color: PARTICLE.proton, label: `Protoner: ${a.Z}` },
          { color: PARTICLE.neutron, label: `Nøytroner: ${a.N}` },
          { color: PARTICLE.electron, label: `Elektroner: ${a.electrons}` },
        ]}
      />

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

function AtomScene({ a, narrow }: { a: AtomInfo; narrow: boolean }) {
  const f = useTextScale();
  const k = Math.max(1, f * 0.8);
  // Elektronene fordeles jevnt i hvert skall, med litt forskjøvet start så skallene ikke står på linje.
  const electrons: ReactNode[] = [];
  a.shells.forEach((count, i) => {
    const R = SHELL_R[i] ?? SHELL_R[SHELL_R.length - 1]!;
    for (let j = 0; j < count; j++) {
      const ang = -Math.PI / 2 + (2 * Math.PI * j) / count + i * 0.35;
      const x = ATOM.cx + R * Math.cos(ang);
      const y = ATOM.cy + R * Math.sin(ang);
      electrons.push(
        <g key={`${i}-${j}`}>
          <circle cx={x} cy={y} r={9} fill={PARTICLE.electron} stroke={VIZ.surface} strokeWidth={2} />
          <path d={`M${x - 4.5},${y}h9`} stroke={VIZ.surface} strokeWidth={2} />
        </g>,
      );
    }
  });
  const descriptor = a.electrons === 0 ? 'Bare kjernen' : a.charge === 0 ? 'Nøytralt atom' : a.charge > 0 ? 'Positivt ion' : 'Negativt ion';
  // PC: atomet til venstre og symbolet til høyre. Mobil: atomet forstørret øverst, symbol og tekst under.
  const atomTransform = narrow
    ? `translate(400 ${NARROW_ATOM_Y}) scale(${NARROW_ATOM_SCALE}) translate(${-ATOM.cx} ${-ATOM.cy})`
    : undefined;
  const sym = narrow ? { x: 250, y: NARROW_TEXT_Y, anchor: 'middle' as const } : { x: 600, y: 196, anchor: 'middle' as const };
  const tx = narrow ? 420 : 600;
  const ty = narrow ? NARROW_TEXT_Y - 44 * k : 196 + 58 * k;
  const anchor = narrow ? 'start' : 'middle';
  return (
    <>
      <g transform={atomTransform}>
        {SHELL_R.map((R, i) => (
          <circle
            key={R}
            cx={ATOM.cx}
            cy={ATOM.cy}
            r={R}
            fill="none"
            stroke={i < a.shells.length ? VIZ.muted : VIZ.grid}
            strokeWidth={1.5}
            strokeDasharray={i < a.shells.length ? undefined : '4 6'}
            opacity={i < a.shells.length ? 0.7 : 1}
          />
        ))}
        <Nucleus cx={ATOM.cx} cy={ATOM.cy} Z={a.Z} N={a.N} r={8} />
        {electrons}
      </g>

      <Txt x={tx} y={ty} size={26 * k} weight={650} anchor={anchor}>
        {elementNameCap(a.Z)}-{a.A}
      </Txt>
      <Txt x={tx} y={ty + 34 * k} size={20 * k} muted anchor={anchor}>
        {descriptor}
      </Txt>
      <Txt x={tx} y={ty + 64 * k} size={20 * k} muted anchor={anchor}>
        Skall: {a.shells.length ? a.shells.join(', ') : 'ingen elektroner'}
      </Txt>
      {/* Symbolet tegnes sist, så teksten «Na» ikke havner rett foran «Natrium» i dokumentet (leses som «NaN» av sjekken). */}
      <NuclideSymbol
        x={sym.x}
        y={sym.y}
        A={a.A}
        Z={a.Z}
        symbol={a.symbol}
        suffix={chargeSuperscript(a.charge) || undefined}
        size={narrow ? 120 : 104}
        anchor={sym.anchor}
      />
    </>
  );
}

function chargeText(q: number): string {
  if (q === 0) return '0';
  return q > 0 ? `+${q}` : `−${-q}`;
}

function statusShort(a: AtomInfo): string {
  if (a.status === 'stabil') return 'Stabil';
  if (a.status === 'radioaktiv') return 'Radioaktiv';
  return 'Ustabil';
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
        hverandre. Slike kjerner er radioaktive.
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
      </>
    );
  }

  return (
    <>
      <p>
        Det er antall protoner som bestemmer grunnstoffet: alle atomer med Z = {a.Z} er {name}. {isotope} {charge}
      </p>
      {a.electrons > 0 ? (
        <p>
          Nesten all massen ({fmt(a.nucleusMassFraction * 100, 2)} %) sitter i kjernen, som bare er ca. 10⁻¹⁵ m, mens hele atomet er ca.
          10⁻¹⁰ m. Atomet er altså nesten bare tomrom.
        </p>
      ) : (
        <p>
          Kjernen er bare ca. 10⁻¹⁵ m. Med elektroner rundt seg blir atomet ca. 10⁻¹⁰ m, så et atom er nesten bare tomrom, men nesten all
          massen sitter i kjernen.
        </p>
      )}
    </>
  );
}

function plural(n: number, one: string, many: string): string {
  const word = n === 1 ? 'ett' : n === 2 ? 'to' : n === 3 ? 'tre' : String(n);
  return `${word} ${n === 1 ? one : many}`;
}
