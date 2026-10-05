import { useMemo, useState, type ReactNode } from 'react';
import {
  Controls,
  Explain,
  Figure,
  Formel,
  Formula,
  FormulaLine,
  KJEMI,
  Legend,
  Readout,
  Readouts,
  Segmented,
  Select,
  Slider,
  Toolbar,
  Txt,
  VIZ,
  VizLayout,
  fmt,
  formulaText,
  molarMass,
  useContainerTextScale,
} from '../kit';
import {
  NAME_EXAMPLES,
  SUB_KINDS,
  buildNamed,
  iupacName,
  naiveName,
  stem,
  verdict,
  type BuildError,
  type NameInput,
  type NameResult,
  type NameVerdict,
  type SubKind,
} from './model';
import { bounds, functionalGroups, molFormula, type View } from './struktur';
import { CHAIN, GROUP, MoleculeView, fitMolecule, fontPx, marginPx, minUnit } from './Struktur';

type SlotKind = SubKind | 'ingen';
interface Slot {
  kind: SlotKind;
  pos: number;
}

const KIND_OPTIONS: { value: SlotKind; label: string }[] = [
  { value: 'ingen', label: 'ingen' },
  ...SUB_KINDS.map((k) => ({ value: k, label: `${k} (${k === 'metyl' ? '–CH₃' : k === 'etyl' ? '–CH₂CH₃' : k === 'klor' ? '–Cl' : '–Br'})` })),
];
const CUSTOM = 'egen';

/** Standard: metyl på C4 og etyl på C3 i en kjede på fem, så nummereringen må snus (3-etyl-2-metylpentan). */
const START: { length: number; slots: Slot[]; double: number; oh: number } = {
  length: 5,
  slots: [
    { kind: 'metyl', pos: 4 },
    { kind: 'etyl', pos: 3 },
    { kind: 'ingen', pos: 1 },
  ],
  double: 0,
  oh: 0,
};

function toInput(length: number, slots: Slot[], double: number, oh: number): NameInput {
  return {
    length,
    subs: slots.filter((s): s is { kind: SubKind; pos: number } => s.kind !== 'ingen'),
    double: double > 0 ? double : null,
    oh: oh > 0 ? oh : null,
  };
}

const same = (a: NameInput, b: NameInput) => JSON.stringify(a) === JSON.stringify(b);

export default function Navnsetting() {
  const [length, setLength] = useState(START.length);
  const [slots, setSlots] = useState<Slot[]>(START.slots);
  const [double, setDouble] = useState(START.double);
  const [oh, setOh] = useState(START.oh);
  const [view, setView] = useState<View>('struktur');
  const [ref, f] = useContainerTextScale<HTMLDivElement>();
  const input = toInput(length, slots, double, oh);
  const built = useMemo(() => buildNamed(input), [JSON.stringify(input)]);
  const result = built.valid ? iupacName(built.mol) : null;
  const v = result ? verdict(built, input, result) : null;
  const naive = naiveName(built, input);
  const example = NAME_EXAMPLES.find((e) => same(e.input, input))?.id ?? CUSTOM;
  const subLines = wrapText(subtitle(built, result, v, naive), Math.floor(740 / (fontPx(f, 0.85) * 0.56)));
  const scene = sceneLayout(built.mol, view, f, subLines.length);
  const formulaStr = molFormula(built.mol);

  const pick = (id: string) => {
    const e = NAME_EXAMPLES.find((x) => x.id === id);
    if (!e) return;
    setLength(e.input.length);
    setSlots([0, 1, 2].map((i) => (e.input.subs[i] ? { ...e.input.subs[i]! } : { kind: 'ingen', pos: 1 })));
    setDouble(e.input.double ?? 0);
    setOh(e.input.oh ?? 0);
  };
  const setSlot = (i: number, patch: Partial<Slot>) => setSlots((old) => old.map((s, j) => (j === i ? { ...s, ...patch } : s)));

  return (
    <VizLayout>
      <Toolbar>
        <Select
          label="Eksempel"
          value={example}
          onChange={pick}
          options={[...NAME_EXAMPLES.map((e) => ({ value: e.id, label: e.label })), ...(example === CUSTOM ? [{ value: CUSTOM, label: 'Eget molekyl' }] : [])]}
        />
        <Segmented
          label="Visning"
          options={[
            { value: 'struktur', label: 'Strukturformel' },
            { value: 'skjelett', label: 'Skjelettformel' },
          ]}
          value={view}
          onChange={setView}
        />
      </Toolbar>
      <Controls>
        <Slider
          label="Kjede du tegner"
          ariaLabel="Antall karbonatomer i kjeden"
          value={length}
          onChange={setLength}
          min={1}
          max={8}
          step={1}
          format={(x) => `${x} C`}
        />
        <Slider label="Dobbeltbinding" value={double} onChange={setDouble} min={0} max={7} step={1} format={(x) => (x === 0 ? 'ingen' : `C${x}=C${x + 1}`)} />
        <Slider
          label="OH-gruppe på"
          ariaLabel="OH-gruppe på karbonatom"
          value={oh}
          onChange={setOh}
          min={0}
          max={8}
          step={1}
          format={(x) => (x === 0 ? 'ingen' : `C${x}`)}
        />
      </Controls>
      <Toolbar>
        {slots.map((s, i) => (
          <Select key={i} label={`Gruppe ${i + 1}`} value={s.kind} onChange={(kind) => setSlot(i, { kind })} options={KIND_OPTIONS} />
        ))}
      </Toolbar>
      <Controls>
        {slots.map((s, i) =>
          s.kind === 'ingen' ? null : (
            <Slider
              key={i}
              label={`${capitalize(s.kind)} (gruppe ${i + 1}) på`}
              value={s.pos}
              onChange={(pos) => setSlot(i, { pos })}
              min={1}
              max={8}
              step={1}
              format={(x) => `C${x}`}
            />
          ),
        )}
      </Controls>

      <div ref={ref}>
        <Figure
          viewBox={`0 0 800 ${scene.H}`}
          label={
            result
              ? `Molekylet heter ${result.name}. Hovedkjeden har ${result.chain.length} karbonatomer og er markert med nummer.`
              : 'Molekylet er ugyldig: se forklaringen under.'
          }
          caption={
            result
              ? 'Det blå båndet er hovedkjeden etter IUPAC-reglene, nummerert fra den riktige enden. Du nummererer selv fra venstre.'
              : 'Det som ikke får plass eller har for mange bindinger, er markert med rødt eller ikke tegnet.'
          }
          maxHeight={scene.H}
        >
          <NameScene built={built} result={result} v={v} subLines={subLines} view={view} f={f} scene={scene} />
        </Figure>
      </div>
      <Legend
        items={[
          { color: CHAIN, label: 'Hovedkjeden med riktig nummerering' },
          { color: GROUP, label: 'Dobbeltbinding og OH-gruppe' },
          ...(built.valid ? [] : [{ color: KJEMI.minus, label: 'For mange bindinger' }]),
        ]}
      />

      <Readouts>
        <Readout label="Molekylformel" value={result ? formulaText(formulaStr) : '–'} />
        <Readout label="Molar masse M" value={result ? fmt(molarMass(formulaStr), 2) : '–'} unit={result ? 'g/mol' : undefined} />
        <Readout label="Hovedkjede" value={result ? String(result.chain.length) : '–'} unit={result ? 'C' : undefined} tone={CHAIN} />
        <Readout
          label="Ditt forslag"
          value={v ? (v.kind === 'riktig' ? 'Riktig' : 'Må rettes') : 'Ugyldig'}
          tone={v ? (v.kind === 'riktig' ? VIZ.series[2] : VIZ.series[1]) : KJEMI.minus}
        />
      </Readouts>

      {result && (
        <Formula label="Navnet steg for steg">
          <FormulaLine>
            1. Hovedkjede: {result.chain.length} C gir stammen «{stem(result.chain.length)}»
            {result.multiple || result.ohLocant ? ' (kjeden må ha med dobbeltbindingen og OH-gruppa)' : ''}
          </FormulaLine>
          <FormulaLine>
            2. Endelse: {result.multiple ? `dobbeltbinding gir «-en»` : 'bare enkeltbindinger gir «-an»'}
            {result.ohLocant !== null ? ', OH-gruppe gir «-ol»' : ''} → {result.parent}
          </FormulaLine>
          <FormulaLine>3. Substituenter: {result.prefix ? `${substituentList(result)} → ${result.prefix}` : 'ingen'}</FormulaLine>
          <FormulaLine>
            Navn: <strong>{result.name}</strong>
            {naive && naive !== result.name ? <> (ikke «{naive}»)</> : null}
          </FormulaLine>
        </Formula>
      )}

      <Explain>{explanation(built.errors, result, v, naive, input, formulaStr)}</Explain>
    </VizLayout>
  );
}

const capitalize = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);

/** «metyl på C2, etyl på C3» i rekkefølgen de står i hovedkjeden. */
function substituentList(r: NameResult): string {
  return [...r.substituents]
    .sort((a, b) => a.locant - b.locant)
    .map((s) => `${s.name} på C${s.locant}`)
    .join(', ');
}

/* ---------- Figuren ---------- */

interface SceneLayout {
  H: number;
  header: number;
  box: { x: number; y: number; w: number; h: number };
}

/** Linja under navnet: om forslaget stemmer, og hva som er galt. */
function subtitle(built: ReturnType<typeof buildNamed>, result: NameResult | null, v: NameVerdict | null, naive: string | null): string {
  if (!result) return 'Rett opp valgene (se forklaringen)';
  if (v?.kind === 'riktig') return 'Kjeden og nummereringen din stemmer';
  if (v?.kind === 'lengre-kjede') return `Den lengste kjeden har ${v.length} C, ikke ${built.mol.chain.length}. Ikke «${naive}»`;
  return `Ikke «${naive}»`;
}

/** Deler teksten i linjer på høyst `max` tegn (ved mellomrom). */
function wrapText(text: string, max: number): string[] {
  const lines: string[] = [];
  let cur = '';
  for (const w of text.split(' ')) {
    if (cur && `${cur} ${w}`.length > max) {
      lines.push(cur);
      cur = w;
    } else cur = cur ? `${cur} ${w}` : w;
  }
  if (cur) lines.push(cur);
  return lines;
}

function sceneLayout(mol: ReturnType<typeof buildNamed>['mol'], view: View, f: number, subLines: number): SceneLayout {
  const header = (50 + 24 * Math.max(1, subLines)) * f;
  const b = bounds(mol, view);
  const m = marginPx(view, f);
  const uMax = 84 * Math.max(1, 0.85 * f);
  const bw = Math.max(1e-6, b.maxX - b.minX);
  const u = Math.max(minUnit(view, f), Math.min(uMax, (760 - 2 * m) / bw));
  const h = Math.max((b.maxY - b.minY) * u + 2 * m, 2.6 * u);
  return { H: Math.round(header + h + 10), header, box: { x: 20, y: header, w: 760, h } };
}

function NameScene({
  built,
  result,
  v,
  subLines,
  view,
  f,
  scene,
}: {
  built: ReturnType<typeof buildNamed>;
  result: NameResult | null;
  v: NameVerdict | null;
  subLines: string[];
  view: View;
  f: number;
  scene: SceneLayout;
}) {
  const fit = fitMolecule(built.mol, view, scene.box, f, 84 * Math.max(1, 0.85 * f));
  const title = result ? result.name : 'Ugyldig molekyl';
  // Lange navn får mindre skrift, så de holder seg inne i figuren
  const size = Math.min(1.35, 740 / Math.max(1, title.length * 0.58 * fontPx(f, 1)));
  const errorAtoms = built.errors.flatMap((e) => (e.kind === 'valens' ? [e.carbon - 1] : []));
  const groups = functionalGroups(built.mol).filter((g) => g.kind === 'dobbeltbinding' || g.kind === 'hydroksyl');
  return (
    <g>
      <Txt x={20} y={34 * f} anchor="start" size={size} weight={700} color={result ? VIZ.ink : KJEMI.minus}>
        {title}
      </Txt>
      {subLines.map((line, i) => (
        <Txt
          key={i}
          x={20}
          y={(62 + 24 * i) * f}
          anchor="start"
          size={0.85}
          muted={v?.kind === 'riktig'}
          color={v?.kind === 'riktig' ? undefined : result ? VIZ.series[1] : KJEMI.minus}
          weight={600}
        >
          {line}
        </Txt>
      ))}
      <MoleculeView mol={built.mol} view={view} fit={fit} chain={result?.chain} numbers={!!result} groups={groups} errorAtoms={errorAtoms} />
    </g>
  );
}

/* ---------- Forklaring ---------- */

const KIND_TEXT: Record<string, string> = { metyl: 'Metylgruppa', etyl: 'Etylgruppa', klor: 'Kloratomet', brom: 'Bromatomet', OH: 'OH-gruppa' };

function errorText(e: BuildError): ReactNode {
  switch (e.kind) {
    case 'posisjon':
      return (
        <>
          {KIND_TEXT[e.what] ?? capitalize(e.what)} står på C{e.pos}, men kjeden har bare {e.length} karbonatom{e.length === 1 ? '' : 'er'}. Flytt den eller
          gjør kjeden lengre.
        </>
      );
    case 'dobbeltbinding':
      return (
        <>
          Dobbeltbindingen C{e.pos}=C{e.pos + 1} må ligge mellom to karbonatomer i kjeden, og kjeden har bare {e.length} C.
        </>
      );
    case 'valens':
      return (
        <>
          C{e.carbon} får {e.bonds} bindinger, men et karbonatom har bare fire (fire valenselektroner). En dobbeltbinding teller som to.
        </>
      );
  }
}

function explanation(errors: BuildError[], r: NameResult | null, v: NameVerdict | null, naive: string | null, input: NameInput, formula: string): ReactNode {
  if (!r || !v) {
    return (
      <>
        <p>
          <strong>Dette molekylet kan ikke finnes.</strong>
        </p>
        <ul>
          {errors.map((e, i) => (
            <li key={i}>{errorText(e)}</li>
          ))}
        </ul>
      </>
    );
  }
  let main: ReactNode;
  switch (v.kind) {
    case 'riktig':
      main = (
        <p>
          <strong>Riktig: {r.name}.</strong> Kjeden du har tegnet, er hovedkjeden, og nummereringen fra venstre gir de laveste tallene.{' '}
          {r.substituents.length > 1
            ? 'Substituentene står i alfabetisk rekkefølge (brom, etyl, klor, metyl), og di- og tri- teller ikke med i alfabetiseringen.'
            : r.substituents.length === 1
              ? 'Tallet foran substituenten viser hvilket C-atom den sitter på.'
              : ''}
        </p>
      );
      break;
    case 'lengre-kjede': {
      const ends = input.subs.filter(
        (s) =>
          (s.kind === 'metyl' || s.kind === 'etyl') &&
          (s.pos === 1 || s.pos === input.length || (s.kind === 'etyl' && (s.pos === 2 || s.pos === input.length - 1))),
      );
      main = (
        <p>
          <strong>Kjeden er ikke den lengste.</strong> Du har tegnet {input.length} C i kjeden, men følger du bindingene inn i{' '}
          {ends.length ? `${ends[0]!.kind}gruppa på C${ends[0]!.pos}` : 'en av grenene'}, får du en kjede på {v.length} C (det blå båndet). Hovedkjeden er
          alltid den lengste sammenhengende kjeden, uansett hvordan den er tegnet. Derfor heter stoffet <strong>{r.name}</strong>
          {naive ? <>, ikke «{naive}»</> : null}. En metylgruppe på C1 eller en etylgruppe på C2 er alltid et tegn på at kjeden kan forlenges.
        </p>
      );
      break;
    }
    case 'annen-kjede':
      main = (
        <p>
          <strong>Velg kjeden med flest substituenter.</strong> Flere kjeder er like lange. Da er hovedkjeden den som har flest grener og halogenatomer (det blå
          båndet). Navnet blir <strong>{r.name}</strong>
          {naive ? <>, ikke «{naive}»</> : null}.
        </p>
      );
      break;
    case 'nummerering':
      main = (
        <p>
          <strong>Nummerer fra den andre enden.</strong>{' '}
          {v.rule === 'oh'
            ? `OH-gruppa bestemmer endelsen (-ol) og skal ha lavest mulig nummer: C${r.ohLocant} i stedet for C${input.length + 1 - r.ohLocant!}.`
            : v.rule === 'dobbeltbinding'
              ? `Dobbeltbindingen skal ha lavest mulig nummer: ${r.multipleLocant} i stedet for ${input.length - r.multipleLocant!}.`
              : v.rule === 'alfabetisk'
                ? 'Begge retninger gir de samme tallene. Da får gruppa som kommer først i alfabetet, det laveste tallet.'
                : 'Substituentene skal få så lave tall som mulig. Sammenlign tallene fra hver ende: den første forskjellen avgjør.'}{' '}
          Riktig navn er <strong>{r.name}</strong>
          {naive ? <>, ikke «{naive}»</> : null}.
        </p>
      );
      break;
  }
  return (
    <>
      {main}
      <p>
        Reglene i kortform: finn den lengste kjeden (som må ha med dobbeltbindingen og C-atomet med OH), nummerer så OH, dobbeltbinding og substituenter får
        lavest mulig tall, og sett substituentene alfabetisk foran stammen med di-, tri- når samme gruppe kommer flere ganger. Formelen er{' '}
        <Formel f={formula} />.
      </p>
    </>
  );
}
