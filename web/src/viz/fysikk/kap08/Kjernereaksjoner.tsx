import { useState, type ReactNode } from 'react';
import { ArrowRight, RotateCcw } from 'lucide-react';
import {
  Explain,
  Figure,
  Formula,
  FormulaLine,
  Legend,
  Readout,
  Readouts,
  Segmented,
  Sub,
  Toggle,
  Toolbar,
  VIZ,
  VizLayout,
  fmt,
  fmtSci,
} from '../../kit';
import { elementName } from '../kap07/elements';
import { PARTICLE } from '../kap07/parts';
import { useFigureTextScale } from '../kap07/useNarrow';
import { kildeFor } from './kjernereaksjoner-kilder';
import { Regnskap, regnskapLayout } from './kjernereaksjoner-regnskap';
import { KjerneScene, qText, sceneLayout } from './kjernereaksjoner-scene';
import {
  alphaKinetics,
  decay,
  decayEnergy,
  EXCITED_INFO,
  gammaPhotons,
  findNuclide,
  isStable,
  MEV,
  nuclideLabel,
  U_KG,
  type AlphaKinetics,
  type Decay,
  type DecayEnergy,
  type DecayType,
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
  const [values, setValues] = useState(true);
  const [ref, f] = useFigureTextScale<HTMLDivElement>();

  const dc = decay(cur.Z, cur.A, type, cur.excited);
  const energy = decayEnergy(dc);
  const kin = alphaKinetics(dc, energy);
  const natural = naturalMode(cur);
  const stable = isStable(cur.Z, cur.A) === true && !cur.excited;
  // Stabile kjerner henfaller ikke, så da vises ingen datterkjerne.
  const shown = dc.possible && !stable;
  // Et henfall som ikke frigjør energi (Q ≤ 0), skjer ikke av seg selv, så det kan ikke følges videre.
  const blocked = !!energy && energy.Q <= 0;
  const canFollow = shown && !blocked;
  const preset = PRESETS.find((p) => p.value === start) ?? PRESETS[0]!;
  const kilde = kildeFor(preset.Z, preset.A);
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
    if (!canFollow) return;
    const next = { ...dc.daughter };
    setCur(next);
    const m = naturalMode(next);
    if (m) setType(m);
    setHistory((h) => [...h, type]);
  };

  const L = sceneLayout(f, kilde);
  const R = regnskapLayout(f);
  const what = stable
    ? `${parentLabel} er stabil og henfaller ikke.`
    : dc.possible
      ? `${TYPE_TEXT[type]}-henfall: ${parentLabel} blir til ${daughterLabel}.`
      : type === 'gamma'
        ? `${parentLabel} er i grunntilstanden og kan ikke sende ut γ-stråling.`
        : `${TYPE_TEXT[type]}-henfall er ikke mulig for ${parentLabel}.`;

  return (
    <VizLayout>
      <Toolbar>
        <Segmented label="Velg startkjerne" options={PRESETS} value={start} onChange={choosePreset} />
      </Toolbar>
      <Toolbar>
        <Segmented label="Velg henfallstype" options={TYPES} value={type} onChange={setType} />
        <button type="button" className="btn btn-sm" onClick={follow} disabled={!canFollow}>
          <ArrowRight size={16} aria-hidden />
          Fortsett med {canFollow ? daughterLabel : 'datterkjernen'}
        </button>
        {history.length > 0 && (
          <button type="button" className="btn btn-sm btn-ghost" onClick={() => choosePreset(start)}>
            <RotateCcw size={16} aria-hidden />
            Tilbake til {nuclideLabel(preset.Z, preset.A)}
          </button>
        )}
        <Toggle label="Vis fart og energi" checked={values} onChange={setValues} />
      </Toolbar>

      <div ref={ref}>
        <Figure viewBox={`0 0 800 ${Math.round(L.H)}`} label={`${kilde.beskrivelse} Forstørret: ${what}`} maxHeight={L.narrow ? 900 : 560}>
          <KjerneScene L={L} kilde={kilde} dc={dc} energy={energy} kin={kin} stable={stable} blocked={blocked} values={values} />
        </Figure>
      </div>
      <Legend
        items={[
          { color: PARTICLE.proton, label: 'Proton' },
          { color: PARTICLE.neutron, label: 'Nøytron' },
          ...(type === 'beta-' && shown ? [{ color: PARTICLE.electron, label: 'Elektron' }] : []),
          ...(type === 'beta+' && shown ? [{ color: PARTICLE.positron, label: 'Positron' }] : []),
          ...((type === 'beta-' || type === 'beta+') && shown ? [{ color: VIZ.muted, label: type === 'beta-' ? 'Antinøytrino' : 'Nøytrino', dashed: true }] : []),
          ...(type === 'gamma' && shown ? [{ color: PARTICLE.photon, label: 'Foton (γ-stråling)' }] : []),
          ...(values && shown && type !== 'gamma' ? [{ color: VIZ.velocity, label: type === 'alfa' ? 'Fart v (i skala)' : 'Fartsretning' }] : []),
        ]}
      />

      <Figure
        viewBox={`0 0 800 ${R.H}`}
        label={shown ? `Reaksjonslikningen. ${what} Nukleontall og ladning er like før og etter.` : `Reaksjonslikningen: ${what}`}
        maxHeight={360}
      >
        <Regnskap
          L={R}
          dc={dc}
          shown={shown}
          note={stable ? 'Stabil kjerne: ingen reaksjon' : dc.type === 'gamma' ? 'Ingen γ fra grunntilstanden' : 'Henfallet er ikke mulig'}
        />
      </Figure>

      <Readouts>
        <Readout label="Datterkjerne" value={shown ? daughterLabel : '–'} />
        <Readout label={`Halveringstid for ${parentLabel}`} value={halfLifeText(cur)} />
        <Readout label="Energi frigjort Q" value={energy && shown ? qText(energy.Q) : '–'} unit={energy && shown ? 'MeV' : undefined} />
        <Readout label="Vanlig henfall" value={natural ? TYPE_TEXT[natural] : isStable(cur.Z, cur.A) ? 'Stabil' : 'Ukjent'} />
      </Readouts>

      {energy && shown && (
        <Formula label="Energien som frigjøres, regnet fra atommassene">
          {energyFormula(dc, energy)}
          {kin && kinFormula(dc, energy, kin)}
        </Formula>
      )}

      <Explain>
        {stable ? stableExplanation(cur, preset, history) : explanation(dc, energy, kin, natural, cur, history.length)}
        {history.length === 0 && !cur.excited && <p>{kilde.derfor}</p>}
      </Explain>
    </VizLayout>
  );
}

function halfLifeText(c: Current): string {
  if (c.excited) return EXCITED_INFO[`${c.Z}-${c.A}`]?.halfLife ?? 'svært kort';
  const n = findNuclide(c.Z, c.A);
  if (!n) return 'Ukjent';
  return n.halfLife ?? 'Stabil';
}

/** Hvordan Q deles mellom α-partikkelen og datterkjernen, og farten de får. */
function kinFormula(dc: Decay, e: DecayEnergy, k: AlphaKinetics): ReactNode {
  const d = nuclideLabel(dc.daughter.Z, dc.daughter.A);
  return (
    <>
      <FormulaLine>
        Bevegelsesmengden er bevart (kjernen lå i ro): m<Sub>α</Sub>v<Sub>α</Sub> = m<Sub>d</Sub>v<Sub>d</Sub>, så energien deles i
        omvendt forhold til massene
      </FormulaLine>
      <FormulaLine>
        E<Sub>α</Sub> = Q · m<Sub>d</Sub> / (m<Sub>α</Sub> + m<Sub>d</Sub>) = {qText(e.Q)} MeV · {fmt(k.mdaughter, 2)} u /{' '}
        {fmt(k.malpha + k.mdaughter, 2)} u = {qText(k.Ealpha)} MeV
      </FormulaLine>
      <FormulaLine>
        v<Sub>α</Sub> = √(2E<Sub>α</Sub> / m<Sub>α</Sub>) = √(2 · {fmtSci(k.Ealpha * MEV, 2)} J / {fmtSci(k.malpha * U_KG, 2)} kg) ={' '}
        {fmtSci(k.valpha, 2)} m/s
      </FormulaLine>
      <FormulaLine>
        {d} rekylerer motsatt vei: v<Sub>d</Sub> = m<Sub>α</Sub>v<Sub>α</Sub> / m<Sub>d</Sub> = {fmtSci(k.vdaughter, 2)} m/s
      </FormulaLine>
    </>
  );
}

function energyFormula(dc: Decay, e: DecayEnergy | null): ReactNode {
  if (dc.type === 'gamma') {
    const photons = gammaPhotons(dc.parent.Z, dc.parent.A);
    if (!e || !photons)
      return <FormulaLine>Energien til γ-fotonet er ikke kjent for {nuclideLabel(dc.parent.Z, dc.parent.A, true)} i tabellen.</FormulaLine>;
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
  const exc = e.daughterExcitation;
  const pExc = e.parentExcitation;
  return (
    <>
      <FormulaLine>Δm = {names}</FormulaLine>
      <FormulaLine>
        Δm = {values} = {fmt(e.dm, 6)} u
      </FormulaLine>
      <FormulaLine>
        Q = Δm · c² = {fmt(e.dm, 6)} · 1,66 · 10⁻²⁷ kg · (3,00 · 10⁸ m/s)² = {fmtSci(massJ(e.dm), 2)} J = {qText(e.Qmass)} MeV
      </FormulaLine>
      {pExc > 0 && (
        <FormulaLine>
          {nuclideLabel(dc.parent.Z, dc.parent.A, true)} har {fmt(pExc, 3)} MeV ekstra eksitasjonsenergi, så Q = {fmt(e.Qmass, 3)} MeV +{' '}
          {fmt(pExc, 3)} MeV = {fmt(e.Q, 3)} MeV
        </FormulaLine>
      )}
      {exc > 0 && (
        <FormulaLine>
          {fmt(exc, 3)} MeV blir igjen i den eksiterte {nuclideLabel(dc.daughter.Z, dc.daughter.A, true)}, så henfallet gir{' '}
          {fmt(e.Qmass, 3)} MeV − {fmt(exc, 3)} MeV = {fmt(e.Q, 3)} MeV
        </FormulaLine>
      )}
    </>
  );
}

function massJ(dm: number): number {
  return dm * 1.66e-27 * 9e16;
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
  if (nBp) parts.push(parts.length ? `− ${nBp}` : `−${nBp}`);
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
  const nG = history.filter((t) => t === 'gamma').length;
  const count = (n: number, what: string) => (n === 1 ? `ett ${what}` : `${n} ${what}`);
  const parts = [
    nA ? count(nA, 'α-henfall') : '',
    nBm ? count(nBm, 'β⁻-henfall') : '',
    nBp ? count(nBp, 'β⁺-henfall') : '',
    nG ? 'γ-stråling' : '',
  ].filter(Boolean);
  const list = parts.length > 1 ? `${parts.slice(0, -1).join(', ')} og ${parts[parts.length - 1]}` : (parts[0] ?? '');
  // Bare regelene for henfallene som faktisk skjedde
  const rules = [
    nA ? 'hvert α-henfall senker Z med 2' : '',
    nBm ? 'hvert β⁻-henfall øker Z med 1' : '',
    nBp ? 'hvert β⁺-henfall senker Z med 1' : '',
  ].filter(Boolean);
  const steps = nA + nBm + nBp;
  const rulesText = rules.length > 1 ? `${rules.slice(0, -1).join(', ')} og ${rules[rules.length - 1]}` : (rules[0] ?? '');
  return (
    <p>
      {me} er <strong>stabil</strong>, så serien slutter her. Fra {nuclideLabel(preset.Z, preset.A)} har kjernen gått gjennom {list}.
      {nA > 0 ? (
        <>
          {' '}
          Bare α-henfallene endrer nukleontallet: A har sunket med {nA} · 4 = {4 * nA}, fra {preset.A} til {cur.A}.
        </>
      ) : (
        <> Nukleontallet er det samme, A = {cur.A}.</>
      )}
      {steps > 1 ? (
        <>
          {' '}
          {capitalize(rulesText)}, så Z har endret seg med {zChange(nA, nBm, nBp)} = {signed(cur.Z - preset.Z)}, fra {preset.Z} til{' '}
          {cur.Z}.
        </>
      ) : steps === 1 ? (
        <>
          {' '}
          Protontallet Z har endret seg med {signed(cur.Z - preset.Z)}, fra {preset.Z} til {cur.Z}
          {nG ? ', mens γ-strålingen bare tok med seg energi' : ''}.
        </>
      ) : null}
    </p>
  );
}

function explanation(dc: Decay, e: DecayEnergy | null, kin: AlphaKinetics | null, natural: DecayType | null, cur: Current, steps: number): ReactNode {
  const parent = nuclideLabel(cur.Z, cur.A, dc.parent.excited);
  const daughter = nuclideLabel(dc.daughter.Z, dc.daughter.A, dc.daughter.excited);
  const newElement = dc.daughter.Z !== cur.Z ? `, et nytt grunnstoff (${elementName(dc.daughter.Z)})` : '';
  let what: ReactNode;
  switch (dc.type) {
    case 'alfa':
      what = (
        <>
          Ved <strong>α-henfall</strong> sender kjernen ut en alfapartikkel, ⁴₂He: to protoner og to nøytroner. Nukleontallet synker med 4
          og protontallet med 2, så {parent} blir til {daughter}
          {newElement}.
          {kin && (
            <>
              {' '}
              Kjernen lå i ro, så den samlede bevegelsesmengden er null også etterpå: α-partikkelen skytes ut med{' '}
              {fmtSci(kin.valpha, 1)} m/s, mens den tunge datterkjernen rekylerer motsatt vei med bare {fmtSci(kin.vdaughter, 1)} m/s.
            </>
          )}
        </>
      );
      break;
    case 'beta-':
      what = (
        <>
          Ved <strong>β⁻-henfall</strong> blir et nøytron i kjernen til et proton, og det sendes ut et elektron og et antinøytrino. A er
          uendret, men Z øker med 1, så {parent} blir til {daughter}
          {newElement}. Elektronet og antinøytrinoet deler energien, så elektronet kan få alt fra nesten ingenting opp til nesten hele Q.
        </>
      );
      break;
    case 'beta+':
      what = (
        <>
          Ved <strong>β⁺-henfall</strong> blir et proton i kjernen til et nøytron, og det sendes ut et positron (et antielektron) og et
          nøytrino. A er uendret, men Z synker med 1, så {parent} blir til {daughter}
          {newElement}. Positronet og nøytrinoet deler energien, akkurat som elektronet og antinøytrinoet ved β⁻.
        </>
      );
      break;
    case 'gamma':
      what = (
        <>
          Ved <strong>γ-stråling</strong> kvitter en eksitert kjerne (*) seg med energi som {dc.emitted.length > 1 ? 'fotoner' : 'et foton'}
          , ofte rett etter et α- eller β-henfall. Verken A eller Z endres, så det er fortsatt {elementName(cur.Z)}.
        </>
      );
      break;
  }
  if (!dc.possible && dc.type === 'gamma')
    return (
      <p>
        <strong>γ-stråling</strong> kommer bare fra en <strong>eksitert</strong> kjerne (merket med *), som har mer energi enn i
        grunntilstanden. {parent} er i grunntilstanden og har ingen ekstra energi å sende ut. Eksiterte kjerner dannes ofte rett etter et α-
        eller β-henfall: prøv ⁶⁰Co, ¹³⁷Cs eller ²²Na og trykk «Fortsett».
        {natural ? ` ${parent} henfaller selv ved ${TYPE_TEXT[natural]}-henfall.` : ''}
      </p>
    );
  if (!dc.possible)
    return dc.daughter.Z > 100 ? (
      <p>Grunnstofftabellen i denne figuren stopper ved Z = 100. Velg en annen henfallstype, eller start på nytt.</p>
    ) : (
      <p>
        {parent} har bare {cur.Z} {cur.Z === 1 ? 'proton' : 'protoner'}, så dette henfallet ville gitt en kjerne uten protoner. Det kan ikke
        skje. Velg en annen henfallstype.
      </p>
    );
  const sums = <>Nukleontall og ladning er bevart, men massen er ikke:</>;
  let energyText: ReactNode;
  const exc = dc.type !== 'gamma' && e ? e.daughterExcitation : 0;
  if (e && e.Q > 0 && exc > 0)
    energyText = (
      <>
        {sums} produktene er {fmt(e.dm, 6)} u lettere, som tilsvarer {fmt(e.Qmass, 3)} MeV. Av dette blir {fmt(e.Q, 3)} MeV
        bevegelsesenergi, mens {fmt(exc, 3)} MeV blir igjen i den eksiterte {daughter} og sendes ut som γ-stråling etterpå.
      </>
    );
  else if (e && e.Q > 0)
    energyText = (
      <>
        {sums} produktene er {fmt(e.dm, 6)} u lettere. Energien som svarer til massetapet, {qText(e.Q)} MeV (E = mc²),{' '}
        {dc.type === 'gamma'
          ? `tas med av ${dc.emitted.length > 1 ? 'fotonene' : 'fotonet'}`
          : 'blir bevegelsesenergi, nesten alt til partiklene som sendes ut'}
        .
      </>
    );
  else if (e && e.Q <= 0)
    energyText = (
      <>
        Bevaringslovene stemmer, men produktene ville hatt <strong>større</strong> masse enn {parent} (Q &lt; 0). Henfallet frigjør ikke
        energi og kan derfor ikke skje av seg selv, så det kan heller ikke følges videre.
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
  else if (natural === dc.type && steps === 0 && !cur.excited) reality = <> Trykk «Fortsett» for å følge datterkjernen videre.</>;
  if (dc.type === 'beta+' && e) reality = <>{reality} Med atommasser må vi trekke fra to elektronmasser, 2m(e), i Δm.</>;
  return (
    <p>
      {what} {energyText}
      {reality}
    </p>
  );
}
