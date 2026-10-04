import { useState, type ReactNode } from 'react';
import { ArrowRight, RotateCcw } from 'lucide-react';
import {
  Arrow,
  Explain,
  Figure,
  Formula,
  FormulaLine,
  Legend,
  Readout,
  Readouts,
  Segmented,
  Toolbar,
  VIZ,
  VizLayout,
  fmt,
  fmtSci,
  useTextScale,
} from '../kit';
import { elementName, elementSymbol, nuclideWords } from '../kap07/elements';
import { Lepton, NuclideSymbol, nuclideSymbolWidth, Nucleus, PARTICLE, PhotonWave, Txt } from '../kap07/parts';
import { useFigureTextScale } from '../kap07/useNarrow';
import {
  conservation,
  decay,
  decayEnergy,
  EXCITED_INFO,
  gammaPhotons,
  findNuclide,
  isStable,
  nuclideLabel,
  type Decay,
  type DecayEnergy,
  type DecayType,
  type Emitted,
} from './model';

interface Current {
  Z: number;
  A: number;
  excited: boolean;
}

const PRESETS: { value: string; label: string; Z: number; A: number }[] = [
  { value: '92-238', label: 'U-238', Z: 92, A: 238 },
  { value: '88-226', label: 'Ra-226', Z: 88, A: 226 },
  { value: '95-241', label: 'Am-241', Z: 95, A: 241 },
  { value: '6-14', label: 'C-14', Z: 6, A: 14 },
  { value: '19-40', label: 'K-40', Z: 19, A: 40 },
  { value: '27-60', label: 'Co-60', Z: 27, A: 60 },
  { value: '55-137', label: 'Cs-137', Z: 55, A: 137 },
  { value: '11-22', label: 'Na-22', Z: 11, A: 22 },
  { value: '9-18', label: 'F-18', Z: 9, A: 18 },
];

const TYPES: { value: DecayType; label: string }[] = [
  { value: 'alfa', label: 'α' },
  { value: 'beta-', label: 'β⁻' },
  { value: 'beta+', label: 'β⁺' },
  { value: 'gamma', label: 'γ' },
];

const TYPE_TEXT: Record<DecayType, string> = { alfa: 'α', 'beta-': 'β⁻', 'beta+': 'β⁺', gamma: 'γ' };
const COLOR_A = VIZ.series[0]!;
const COLOR_Z = PARTICLE.proton;

/** Den vanlige henfallstypen for kjernen, eller null for stabile og ukjente kjerner. */
function naturalMode(c: Current): DecayType | null {
  if (c.excited) return 'gamma';
  return findNuclide(c.Z, c.A)?.mode ?? null;
}

export default function Kjernereaksjoner() {
  const [start, setStart] = useState('92-238');
  const [cur, setCur] = useState<Current>({ Z: 92, A: 238, excited: false });
  const [type, setType] = useState<DecayType>('alfa');
  /** Henfallene vi har fulgt fra startkjernen. */
  const [history, setHistory] = useState<DecayType[]>([]);
  const [ref, f] = useFigureTextScale<HTMLDivElement>();

  const dc = decay(cur.Z, cur.A, type, cur.excited);
  const energy = decayEnergy(dc);
  const natural = naturalMode(cur);
  const stable = isStable(cur.Z, cur.A) === true && !cur.excited;
  // Stabile kjerner henfaller ikke, så da vises ingen datterkjerne.
  const shown = dc.possible && !stable;
  const preset = PRESETS.find((p) => p.value === start) ?? PRESETS[0]!;
  const parentLabel = nuclideLabel(cur.Z, cur.A, dc.parent.excited);
  const daughterLabel = nuclideLabel(dc.daughter.Z, dc.daughter.A, dc.daughter.excited);

  const choosePreset = (v: string) => {
    const p = PRESETS.find((x) => x.value === v) ?? PRESETS[0]!;
    const next = { Z: p.Z, A: p.A, excited: false };
    setStart(v);
    setCur(next);
    setType(naturalMode(next) ?? 'alfa');
    setHistory([]);
  };
  const follow = () => {
    if (!shown) return;
    const next = { ...dc.daughter };
    setCur(next);
    const m = naturalMode(next);
    if (m) setType(m);
    setHistory((h) => [...h, type]);
  };

  const L = layout(f);

  return (
    <VizLayout>
      <Toolbar>
        <Segmented label="Velg startkjerne" options={PRESETS} value={start} onChange={choosePreset} />
      </Toolbar>
      <Toolbar>
        <Segmented label="Velg henfallstype" options={TYPES} value={type} onChange={setType} />
        <button type="button" className="btn btn-sm" onClick={follow} disabled={!shown}>
          <ArrowRight size={16} aria-hidden />
          Fortsett med {shown ? daughterLabel : 'datterkjernen'}
        </button>
        {history.length > 0 && (
          <button type="button" className="btn btn-sm btn-ghost" onClick={() => choosePreset(start)}>
            <RotateCcw size={16} aria-hidden />
            Tilbake til {nuclideLabel(preset.Z, preset.A)}
          </button>
        )}
      </Toolbar>

      <div ref={ref}>
        <Figure
          viewBox={`0 0 800 ${Math.round(L.height)}`}
          label={
            stable
              ? `${parentLabel} er stabil og henfaller ikke.`
              : dc.possible
                ? `${TYPE_TEXT[type]}-henfall: ${parentLabel} blir til ${daughterLabel}. Nukleontall og ladning er bevart.`
                : `${TYPE_TEXT[type]}-henfall er ikke mulig for ${parentLabel}.`
          }
          maxHeight={620}
        >
          <ReactionScene dc={dc} scale={f} stable={stable} />
        </Figure>
      </div>
      <Legend
        items={[
          { color: PARTICLE.proton, label: 'Proton' },
          { color: PARTICLE.neutron, label: 'Nøytron' },
          ...(type === 'beta-' && shown ? [{ color: PARTICLE.electron, label: 'Elektron' }] : []),
          ...(type === 'beta+' && shown ? [{ color: PARTICLE.positron, label: 'Positron' }] : []),
          ...(type === 'gamma' && shown ? [{ color: PARTICLE.photon, label: 'Foton (γ-stråling)' }] : []),
        ]}
      />

      <Readouts>
        <Readout label="Datterkjerne" value={shown ? daughterLabel : '–'} />
        <Readout label={`Halveringstid for ${parentLabel}`} value={halfLifeText(cur)} />
        <Readout label="Energi frigjort Q" value={energy && shown ? qText(energy.Q) : '–'} unit={energy && shown ? 'MeV' : undefined} />
        <Readout label="Vanlig henfall" value={natural ? TYPE_TEXT[natural] : isStable(cur.Z, cur.A) ? 'Stabil' : 'Ukjent'} />
      </Readouts>

      {energy && shown && <Formula label="Energien som frigjøres, regnet fra atommassene">{energyFormula(dc, energy)}</Formula>}

      <Explain>{stable ? stableExplanation(cur, preset, history) : explanation(dc, energy, natural, cur, history.length)}</Explain>
    </VizLayout>
  );
}

/** Q med tre desimaler under 1 MeV, ellers to. */
function qText(Q: number): string {
  return fmt(Q, Math.abs(Q) < 1 ? 3 : 2);
}

function halfLifeText(c: Current): string {
  if (c.excited) return EXCITED_INFO[`${c.Z}-${c.A}`]?.halfLife ?? 'svært kort';
  const n = findNuclide(c.Z, c.A);
  if (!n) return 'Ukjent';
  return n.halfLife ?? 'Stabil';
}

/** Plass til den største kjernen (A ≈ 240) uansett hvilken kjerne som vises, så figuren ikke hopper. */
const R_SLOT = 72;

function layout(f: number) {
  const k = Math.max(1, f * 0.8);
  const cy = 26 + R_SLOT;
  const lab1 = cy + R_SLOT + 28 * f;
  const lab2 = lab1 + 24 * f;
  const S = 46 * k;
  const eqY = lab2 + 30 * f + S * 0.85;
  const cons1 = eqY + S * 0.45 + 28 * f;
  const cons2 = cons1 + 26 * f;
  return { k, cy, lab1, lab2, S, eqY, cons1, cons2, height: cons2 + 16 };
}

/** Kulestørrelse så tunge kjerner får plass, mens lette kjerner ikke blir bittesmå. */
function ballRadius(A: number): number {
  return Math.min(14, R_SLOT / (1.02 * Math.sqrt(Math.max(A, 1)) + 0.6));
}

interface Term {
  A: number | string;
  Z: number | string;
  symbol: string;
  suffix?: string;
}

function emittedTerm(e: Emitted): Term {
  return { A: e.A, Z: e.Z < 0 ? `−${-e.Z}` : e.Z, symbol: e.symbol };
}

function ReactionScene({ dc, scale, stable }: { dc: Decay; scale: number; stable: boolean }) {
  const fReal = useTextScale();
  const L = layout(scale);
  const f = fReal;
  const { parent: p, daughter: d } = dc;
  const r = ballRadius(p.A);
  const R = r * (1.02 * Math.sqrt(p.A) + 0.6);
  const Rd = r * (1.02 * Math.sqrt(Math.max(d.A, 1)) + 0.6);
  const px = 140;
  const dx = 430;
  const ex = 660;
  const cy = L.cy;

  // Reaksjonslikningen: mor → datter + partikler
  const terms: (Term | '→' | '+')[] = [{ A: p.A, Z: p.Z, symbol: elementSymbol(p.Z), suffix: p.excited ? '*' : undefined }];
  if (dc.possible && !stable) {
    terms.push('→', { A: d.A, Z: d.Z, symbol: elementSymbol(d.Z), suffix: d.excited ? '*' : undefined });
    for (const e of dc.emitted) terms.push('+', emittedTerm(e));
  }
  const gap = 0.36;
  const unitWidth = terms.reduce<number>((w, t) => {
    if (t === '→') return w + 1.05 + 2 * gap;
    if (t === '+') return w + 0.62 + 2 * gap;
    return w + nuclideSymbolWidth(t.A, t.Z, t.symbol, 1, t.suffix);
  }, 0);
  const S = Math.min(L.S, 740 / unitWidth);
  let x = 400 - (unitWidth * S) / 2;
  const eq: ReactNode[] = [];
  terms.forEach((t, i) => {
    if (t === '→' || t === '+') {
      const w = (t === '→' ? 1.05 : 0.62) * S;
      x += gap * S;
      eq.push(
        <Txt key={i} x={x + w / 2} y={L.eqY - S * 0.05} size={S * 0.9}>
          {t}
        </Txt>,
      );
      x += w + gap * S;
    } else {
      eq.push(<NuclideSymbol key={i} x={x} y={L.eqY} A={t.A} Z={t.Z} symbol={t.symbol} suffix={t.suffix} size={S} colorA={COLOR_A} colorZ={COLOR_Z} />);
      x += nuclideSymbolWidth(t.A, t.Z, t.symbol, S, t.suffix);
    }
  });
  const c = conservation(dc);
  const sumText = (parts: number[]) => parts.map((v) => (v < 0 ? `(−${-v})` : String(v))).join(' + ');
  const aParts = [d.A, ...dc.emitted.map((e) => e.A)];
  const zParts = [d.Z, ...dc.emitted.map((e) => e.Z)];

  const parentText = nuclideLabel(p.Z, p.A, p.excited);
  return (
    <>
      {/* Morkjernen */}
      <Nucleus cx={px} cy={cy} Z={p.Z} N={p.A - p.Z} r={r} plus={r >= 6} />
      {p.excited && <circle cx={px} cy={cy} r={R + 8} fill="none" stroke={PARTICLE.photon} strokeWidth={2} strokeDasharray="5 5" />}
      <Txt x={px} y={L.lab1} weight={700}>
        {parentText}
      </Txt>
      <Txt x={px} y={L.lab2} muted>
        {nuclideWords(p.Z, p.A)}
        {p.excited ? ', eksitert' : ''}
      </Txt>

      {stable ? (
        <Txt x={520} y={cy + 6} muted>
          Stabil kjerne: henfaller ikke
        </Txt>
      ) : dc.possible ? (
        <>
          <Arrow x1={px + R + 18} y1={cy} x2={dx - Rd - 18} y2={cy} color={VIZ.muted} width={2.5} />
          <Txt x={(px + R + dx - Rd) / 2} y={cy - 14} muted>
            {TYPE_TEXT[dc.type]}
          </Txt>
          <Nucleus cx={dx} cy={cy} Z={d.Z} N={d.A - d.Z} r={r} plus={r >= 6} />
          {d.excited && <circle cx={dx} cy={cy} r={Rd + 8} fill="none" stroke={PARTICLE.photon} strokeWidth={2} strokeDasharray="5 5" />}
          <Txt x={dx} y={L.lab1} weight={700}>
            {nuclideLabel(d.Z, d.A, d.excited)}
          </Txt>
          <Txt x={dx} y={L.lab2} muted>
            {nuclideWords(d.Z, d.A)}
            {d.excited ? ', eksitert' : ''}
          </Txt>
          <EmittedParticles dc={dc} r={r} x={ex} cy={cy} startX={dx + Rd + 14} f={f} lab1={L.lab1} lab2={L.lab2} />
        </>
      ) : (
        <Txt x={520} y={cy + 6} muted>
          {dc.type === 'alfa' ? 'For lite kjerne til α-henfall' : 'Henfallet er ikke mulig'}
        </Txt>
      )}

      {eq}
      {dc.possible && !stable && (
        <>
          <Txt x={400} y={L.cons1} color={COLOR_A} weight={650}>
            Nukleontall: {c.A[0]} = {sumText(aParts)}
          </Txt>
          <Txt x={400} y={L.cons2} color={COLOR_Z} weight={650}>
            Ladning: {c.Z[0]} = {sumText(zParts)}
          </Txt>
        </>
      )}
    </>
  );
}

function EmittedParticles({
  dc,
  r,
  x,
  cy,
  startX,
  f,
  lab1,
  lab2,
}: {
  dc: Decay;
  /** Kulestørrelsen i kjernene. */
  r: number;
  x: number;
  cy: number;
  startX: number;
  f: number;
  lab1: number;
  lab2: number;
}) {
  if (dc.type === 'gamma')
    return (
      <>
        {dc.emitted.map((_, i) => {
          const dy = dc.emitted.length > 1 ? (i === 0 ? -34 : 26) : -20;
          return (
            <PhotonWave key={i} x1={startX} y1={cy + dy * 0.3} x2={x + 80} y2={cy + dy} color={PARTICLE.photon} amplitude={9} wavelength={20} width={3} />
          );
        })}
        <Txt x={x + 10} y={lab1} weight={700} color={PARTICLE.photon}>
          γ
        </Txt>
        <Txt x={x + 10} y={lab2} muted>
          {dc.emitted.length > 1 ? 'to fotoner' : 'foton'}
        </Txt>
      </>
    );
  if (dc.type === 'alfa')
    return (
      <>
        <Nucleus cx={x} cy={cy - 10} Z={2} N={2} r={Math.max(6, r)} />
        <Arrow x1={x + 30} y1={cy - 10} x2={x + 90} y2={cy - 10} color={VIZ.velocity} width={2.5} />
        <Txt x={x + 10} y={lab1} weight={700}>
          ⁴He
        </Txt>
        <Txt x={x + 10} y={lab2} muted>
          alfapartikkel
        </Txt>
      </>
    );
  const positron = dc.type === 'beta+';
  const nuY = cy + 38;
  return (
    <>
      <Lepton x={x} y={cy - 26} r={11} positron={positron} />
      <Arrow x1={x + 20} y1={cy - 26} x2={x + 86} y2={cy - 44} color={VIZ.velocity} width={2.5} />
      <circle cx={x} cy={nuY} r={7} fill="none" stroke={VIZ.muted} strokeWidth={2} />
      <Arrow x1={x + 16} y1={nuY} x2={x + 76} y2={nuY + 14} color={VIZ.muted} width={2} dashed />
      <Txt x={x - 18} y={nuY + 6} anchor="end" muted>
        {positron ? 'ν' : 'ν̄'}
      </Txt>
      <Txt x={x + 10} y={lab1} weight={700} color={positron ? PARTICLE.positron : PARTICLE.electron}>
        {positron ? 'e⁺' : 'e⁻'}
      </Txt>
      <Txt x={x + 10} y={lab2} muted>
        {positron ? 'positron' : 'elektron'}
        {f > 1.4 ? '' : positron ? ' + nøytrino' : ' + antinøytrino'}
      </Txt>
    </>
  );
}

function energyFormula(dc: Decay, e: DecayEnergy | null): ReactNode {
  if (dc.type === 'gamma') {
    const photons = gammaPhotons(dc.parent.Z, dc.parent.A);
    if (!e || !photons)
      return (
        <FormulaLine>
          Energien til γ-fotonet er ikke kjent for {nuclideLabel(dc.parent.Z, dc.parent.A, true)} i tabellen.
        </FormulaLine>
      );
    const top = Math.max(...photons);
    return (
      <>
        <FormulaLine>
          E<sub>γ</sub> = {photons.map((E) => `${qText(E)} MeV`).join(' + ')}
          {photons.length > 1 ? ` = ${qText(e.Q)} MeV` : ''}
        </FormulaLine>
        <FormulaLine>
          {photons.length > 1 ? `Fotonet på ${qText(top)} MeV: ` : ''}f = E/h = {fmtSci(top * 1.6e-13, 2)} J / 6,63 · 10⁻³⁴ J·s ={' '}
          {fmtSci((top * 1.6e-13) / 6.63e-34, 2)} Hz
        </FormulaLine>
      </>
    );
  }
  if (!dc.possible) return <FormulaLine>Ingen datterkjerne, så ingen energi å regne ut.</FormulaLine>;
  if (!e)
    return (
      <FormulaLine>
        Atommassen til {nuclideLabel(dc.daughter.Z, dc.daughter.A)} er ikke i tabellen, så Q kan ikke regnes ut her.
      </FormulaLine>
    );
  const names = e.terms.map((t, i) => `${i === 0 ? '' : ' − '}${t.label}`).join('');
  const values = e.terms.map((t, i) => `${i === 0 ? '' : ' − '}${fmt(t.mass, 6)} u`).join('');
  const exc = dc.daughter.excited ? decayExcitation(dc) : 0;
  const Qmass = e.Q + exc;
  return (
    <>
      <FormulaLine>Δm = {names}</FormulaLine>
      <FormulaLine>
        Δm = {values} = {fmt(e.dm, 6)} u
      </FormulaLine>
      <FormulaLine>
        Q = Δm · c² = {fmt(e.dm, 6)} · 1,66 · 10⁻²⁷ kg · (3,00 · 10⁸ m/s)² = {fmtSci(massJ(e.dm), 2)} J = {qText(Qmass)} MeV
      </FormulaLine>
      {exc > 0 && (
        <FormulaLine>
          {qText(exc)} MeV blir igjen i den eksiterte {nuclideLabel(dc.daughter.Z, dc.daughter.A, true)}, så henfallet gir {qText(Qmass)} MeV −{' '}
          {qText(exc)} MeV = {qText(e.Q)} MeV
        </FormulaLine>
      )}
    </>
  );
}

function massJ(dm: number): number {
  return dm * 1.66e-27 * 9e16;
}

function decayExcitation(dc: Decay): number {
  const n = findNuclide(dc.parent.Z, dc.parent.A);
  return n?.daughterExcitation ?? 0;
}

function capitalize(s: string): string {
  return s.charAt(0).toLocaleUpperCase('nb') + s.slice(1);
}

function signed(n: number): string {
  return n > 0 ? `+${n}` : n < 0 ? `−${-n}` : '0';
}

/** «−2 · 8 + 6» for åtte α og seks β⁻. */
function zChange(nA: number, nBm: number, nBp: number): string {
  const parts: string[] = [];
  if (nA) parts.push(`−2 · ${nA}`);
  if (nBm) parts.push(parts.length ? `+ ${nBm}` : `+${nBm}`);
  if (nBp) parts.push(`− ${nBp}`);
  return parts.join(' ') || '0';
}

function stableExplanation(cur: Current, preset: { Z: number; A: number }, history: DecayType[]): ReactNode {
  const me = nuclideLabel(cur.Z, cur.A);
  if (history.length === 0)
    return (
      <p>
        {me} er en <strong>stabil kjerne</strong> og henfaller ikke. Velg en radioaktiv startkjerne for å se et henfall.
      </p>
    );
  const nA = history.filter((t) => t === 'alfa').length;
  const nBm = history.filter((t) => t === 'beta-').length;
  const nBp = history.filter((t) => t === 'beta+').length;
  const parts = [nA ? `${nA} α-henfall` : '', nBm ? `${nBm} β⁻-henfall` : '', nBp ? `${nBp} β⁺-henfall` : ''].filter(Boolean);
  const list = parts.length > 1 ? `${parts.slice(0, -1).join(', ')} og ${parts[parts.length - 1]}` : (parts[0] ?? 'γ-stråling');
  return (
    <p>
      {me} er <strong>stabil</strong>, så serien slutter her. Fra {nuclideLabel(preset.Z, preset.A)} har kjernen gått gjennom {list}.
      {nA > 0 ? (
        <>
          {' '}
          Bare α-henfallene endrer nukleontallet: A har sunket med {nA} · 4 = {4 * nA}, fra {preset.A} til {cur.A}.
        </>
      ) : null}{' '}
      Hvert α-henfall senker Z med 2, hvert β⁻-henfall øker Z med 1{nBp ? ' og hvert β⁺-henfall senker Z med 1' : ''}, så Z har endret
      seg med {zChange(nA, nBm, nBp)} = {signed(cur.Z - preset.Z)}.
    </p>
  );
}

function explanation(dc: Decay, e: DecayEnergy | null, natural: DecayType | null, cur: Current, steps: number): ReactNode {
  const parent = nuclideLabel(cur.Z, cur.A, dc.parent.excited);
  const daughter = nuclideLabel(dc.daughter.Z, dc.daughter.A, dc.daughter.excited);
  const newElement = dc.daughter.Z !== cur.Z ? `, et nytt grunnstoff (${elementName(dc.daughter.Z)})` : '';
  let what: ReactNode;
  switch (dc.type) {
    case 'alfa':
      what = (
        <>
          Ved <strong>α-henfall</strong> sender kjernen ut en alfapartikkel, ⁴₂He: to protoner og to nøytroner. Nukleontallet synker med
          4 og protontallet med 2, så {parent} blir til {daughter}
          {newElement}.
        </>
      );
      break;
    case 'beta-':
      what = (
        <>
          Ved <strong>β⁻-henfall</strong> blir et nøytron i kjernen til et proton, og det sendes ut et elektron og et antinøytrino. A er
          uendret, men Z øker med 1, så {parent} blir til {daughter}
          {newElement}.
        </>
      );
      break;
    case 'beta+':
      what = (
        <>
          Ved <strong>β⁺-henfall</strong> blir et proton i kjernen til et nøytron, og det sendes ut et positron (et antielektron) og et
          nøytrino. A er uendret, men Z synker med 1, så {parent} blir til {daughter}
          {newElement}.
        </>
      );
      break;
    case 'gamma':
      what = (
        <>
          Ved <strong>γ-stråling</strong> kvitter en eksitert kjerne (*) seg med energi som {dc.emitted.length > 1 ? 'fotoner' : 'et foton'},
          ofte rett etter et α- eller β-henfall. Verken A eller Z endres, så det er fortsatt {elementName(cur.Z)}.
        </>
      );
      break;
  }
  if (!dc.possible)
    return dc.daughter.Z > 100 ? (
      <p>Grunnstofftabellen i denne figuren stopper ved Z = 100. Velg en annen henfallstype, eller start på nytt.</p>
    ) : (
      <p>
        {parent} har bare {cur.Z} {cur.Z === 1 ? 'proton' : 'protoner'}, så dette henfallet ville gitt en kjerne uten protoner. Det kan
        ikke skje. Velg en annen henfallstype.
      </p>
    );
  const sums = <>Nukleontall og ladning er bevart, men massen er ikke:</>;
  let energyText: ReactNode;
  const exc = dc.type !== 'gamma' && dc.daughter.excited ? decayExcitation(dc) : 0;
  if (e && e.Q > 0 && exc > 0)
    energyText = (
      <>
        {sums} produktene er {fmt(e.dm, 6)} u lettere, som tilsvarer {qText(e.Q + exc)} MeV. Av dette blir {qText(e.Q)} MeV
        bevegelsesenergi, mens {qText(exc)} MeV blir igjen i den eksiterte {daughter} og sendes ut som γ-stråling etterpå.
      </>
    );
  else if (e && e.Q > 0)
    energyText = (
      <>
        {sums} produktene er {fmt(e.dm, 6)} u lettere, og forskjellen er blitt {qText(e.Q)} MeV{dc.type === 'gamma' ? (dc.emitted.length > 1 ? ' i fotonene' : ' i fotonet') : ' bevegelsesenergi'} (E = mc²).
      </>
    );
  else if (e && e.Q <= 0)
    energyText = (
      <>
        Bevaringslovene stemmer, men produktene ville hatt <strong>større</strong> masse enn {parent} (Q &lt; 0). Henfallet frigjør ikke
        energi og kan derfor ikke skje av seg selv.
      </>
    );
  else
    energyText = (
      <>
        Nukleontall og ladning er bevart.{' '}
        {dc.type === 'gamma'
          ? 'Energien til fotonet er ikke kjent for denne kjernen her.'
          : `Atommassen til ${nuclideLabel(dc.daughter.Z, dc.daughter.A)} er ikke med i tabellen her, så Q kan ikke regnes ut.`}
      </>
    );

  const note = cur.excited ? undefined : findNuclide(cur.Z, cur.A)?.note;
  let reality: ReactNode = null;
  if (!natural && isStable(cur.Z, cur.A) === undefined)
    reality = <> {parent} er ikke med i tabellen her, så vi vet ikke om den faktisk henfaller på denne måten.</>;
  else if (natural && natural !== dc.type && !(e && e.Q <= 0))
    reality = (
      <>
        {' '}
        I virkeligheten henfaller {parent} ved {TYPE_TEXT[natural]}-henfall{note ? ` (${note})` : ''}.
      </>
    );
  else if (natural === dc.type && note) reality = <> {capitalize(note)}.</>;
  else if (natural === dc.type && steps === 0 && !cur.excited)
    reality = <> Trykk «Fortsett» for å følge datterkjernen videre.</>;
  if (dc.type === 'beta+' && e) reality = <>{reality} Med atommasser må vi trekke fra to elektronmasser, 2m(e), i Δm.</>;
  return (
    <p>
      {what} {energyText}
      {reality}
    </p>
  );
}
