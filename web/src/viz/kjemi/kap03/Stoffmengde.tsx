import { useState, type ReactNode } from 'react';
import {
  Begerglass,
  Controls,
  Explain,
  Figure,
  Formel,
  FormulaField,
  Formula,
  FormulaLine,
  KJEMI,
  Partikler,
  Readout,
  Readouts,
  Segmented,
  Select,
  Slider,
  Sub,
  TFormel,
  TSub,
  Toggle,
  Toolbar,
  Txt,
  VIZ,
  VizLayout,
  atomColors,
  fmt,
  fmtSig,
  formula,
  formulaText,
  molarMass,
  molarMassTerms,
  parseFormula,
  scaleLinear,
  superscript,
  useContainerTextScale,
  type FormulaResult,
  type ParsedFormula,
  type ParticleGroup,
} from '../kit';
import {
  LADDERS,
  LANDMARKS,
  N_A,
  SUBSTANCES,
  UNIVERSE_AGE_YEARS,
  amounts,
  concentration,
  countingYears,
  dissolve,
  nearestIndex,
  particleWord,
  type Amounts,
  type Known,
  type Substance,
} from './model';

const CUSTOM = 'egen';

const KNOWN_OPTIONS: { value: Known; label: ReactNode }[] = [
  { value: 'm', label: 'Masse m' },
  { value: 'n', label: 'Stoffmengde n' },
  { value: 'N', label: 'Antall N' },
];

const UNIT: Record<Known, string> = { m: 'g', n: 'mol', N: '' };
const SINGULAR: Record<string, string> = { molekyler: 'molekyl', formelenheter: 'formelenhet', atomer: 'atom', ioner: 'ion' };
/** Konsentrasjon per prikk i partikkelbildet (mol/L), og flest prikker per partikkeltype. */
const C_PER_DOT = 0.1;
const MAX_DOTS = 40;

/** Tolker en egen formel, men godtar bare stoffer med masse (ikke et fritt elektron). */
function parseCustom(text: string): FormulaResult {
  const r = parseFormula(text);
  if (r.ok && (r.formula.electron || molarMass(r.formula) === 0)) return { ok: false, error: 'Et fritt elektron har nesten ingen masse. Skriv et stoff.' };
  return r;
}

const fmtQ = (known: Known, v: number) => (UNIT[known] ? `${fmtSig(v)} ${UNIT[known]}` : fmtSig(v));

export default function Stoffmengde() {
  const [subst, setSubst] = useState<string>('vann');
  const [custom, setCustom] = useState('H2SO4');
  const [lastValid, setLastValid] = useState('H2SO4');
  const [known, setKnown] = useState<Known>('m');
  const [idx, setIdx] = useState(LADDERS.m.indexOf(100));
  const [solution, setSolution] = useState(false);
  const [V, setV] = useState(0.5);
  const [ref, f] = useContainerTextScale<HTMLDivElement>();

  const preset = SUBSTANCES.find((s) => s.id === subst);
  const customRes = parseCustom(custom);
  const fText = preset ? preset.formula : customRes.ok ? custom : lastValid;
  const pf = formula(fText);
  const name = preset ? preset.name : null;
  const word = particleWord(pf);
  const value = LADDERS[known][idx] ?? 1;
  const a = amounts(pf, known, value);
  const canDissolve = subst !== 'vann';
  const inSolution = solution && canDissolve;
  const sol = dissolve(a.m, V, preset?.solubility);
  const c = concentration(sol.dissolved / a.M, V);

  const changeKnown = (k: Known) => {
    const current = k === 'm' ? a.m : k === 'n' ? a.n : a.N;
    setKnown(k);
    setIdx(nearestIndex(LADDERS[k], current));
  };
  const changeCustom = (text: string) => {
    setCustom(text);
    if (parseCustom(text).ok) setLastValid(text);
  };

  const vertical = f > 1.3;
  const bridge = bridgeLayout(vertical, f, Object.keys(pf.atoms).length);

  return (
    <VizLayout>
      <Toolbar>
        <Select
          label="Stoff"
          value={subst}
          onChange={setSubst}
          options={[...SUBSTANCES.map((s) => ({ value: s.id, label: `${s.name} (${formulaText(s.formula)})` })), { value: CUSTOM, label: 'Egen formel' }]}
        />
        {!preset && <FormulaField label="Formel" value={custom} onChange={changeCustom} result={customRes} />}
      </Toolbar>
      <Toolbar>
        <Segmented label="Hvilken størrelse kjenner du?" options={KNOWN_OPTIONS} value={known} onChange={changeKnown} />
      </Toolbar>
      <Controls>
        <Slider
          label={KNOWN_OPTIONS.find((o) => o.value === known)!.label}
          ariaLabel={known === 'm' ? 'Masse' : known === 'n' ? 'Stoffmengde' : 'Antall partikler'}
          value={idx}
          onChange={setIdx}
          min={0}
          max={LADDERS[known].length - 1}
          step={1}
          format={(i) => fmtQ(known, LADDERS[known][i] ?? 1)}
        />
        {inSolution && <Slider label="Volum V" value={V} onChange={setV} min={0.1} max={2} step={0.05} unit="L" decimals={2} />}
      </Controls>
      {canDissolve && (
        <Toolbar>
          <Toggle label="Løs stoffet i vann" checked={solution} onChange={setSolution} />
        </Toolbar>
      )}

      <div ref={ref}>
        <Figure
          viewBox={`0 0 800 ${bridge.H}`}
          label={`Mol-brua for ${formulaText(pf)}: ${fmtSig(a.m)} g er ${fmtSig(a.n)} mol, som er ${fmtSig(a.N)} ${word}. Molar masse ${fmt(a.M, 2)} g/mol.`}
          maxHeight={bridge.H}
        >
          <Bridge a={a} known={known} word={word} pf={pf} layout={bridge} f={f} />
        </Figure>
      </div>

      {inSolution && (
        <Figure
          viewBox={`0 0 800 ${solutionHeight(f)}`}
          label={`Løsning med volum ${fmt(V, 2)} L og konsentrasjon ${fmtSig(c)} mol/L.`}
          caption={`Utsnittet er like stort uansett volum, så tettheten av prikker viser konsentrasjonen: hver prikk er ${fmt(C_PER_DOT, 1)} mol/L. Vannmolekylene er ikke tegnet.`}
          maxHeight={solutionHeight(f)}
        >
          <SolutionScene pf={pf} preset={preset} V={V} n={sol.dissolved / a.M} c={c} excess={sol.excess} f={f} />
        </Figure>
      )}

      <Figure
        viewBox={`0 0 800 ${scaleHeight(f)}`}
        label={`${fmtSig(a.N)} ${word} sammenlignet med andre store tall på en logaritmisk skala.`}
        caption="Logaritmisk skala: hvert merke er ti ganger så mye som det forrige. Tall merket «ca.» er grove anslag, og en vanndråpe er regnet som 0,05 mL."
        maxHeight={scaleHeight(f)}
      >
        <MagnitudeScale N={a.N} word={word} f={f} />
      </Figure>

      <Readouts>
        <Readout label="Molar masse M" value={fmt(a.M, 2)} unit="g/mol" />
        <Readout label="Stoffmengde n" value={fmtSig(a.n)} unit="mol" tone={VIZ.series[0]} />
        <Readout label={`Antall ${word}`} value={fmtSig(a.N)} />
        {inSolution ? (
          <Readout label="Konsentrasjon c" value={fmtSig(c)} unit="mol/L" />
        ) : (
          <Readout label="Antall atomer i alt" value={fmtSig(a.atoms)} />
        )}
      </Readouts>

      <Formula label="Utregning">
        <FormulaLine>
          M(<Formel f={pf} state={false} />) = {molarMassTerms(pf)
            .map((t) => (t.count === 1 ? fmt(t.M, t.M < 10 ? 3 : 2) : `${t.count} · ${fmt(t.M, t.M < 10 ? 3 : 2)}`))
            .join(' + ')}{' '}
          = {fmt(a.M, 2)} g/mol
        </FormulaLine>
        {steps(known, a, value)}
        {inSolution && (
          <FormulaLine>
            c = n / V = {fmtSig(sol.dissolved / a.M)} mol / {fmt(V, 2)} L = {fmtSig(c)} mol/L{sol.saturated ? ' (mettet)' : ''}
          </FormulaLine>
        )}
      </Formula>

      <Explain>{explanation({ a, known, word, name, pf, preset, inSolution, V, c, sol, invalid: !preset && !customRes.ok, lastValid })}</Explain>
    </VizLayout>
  );
}

function steps(known: Known, a: Amounts, value: number): ReactNode {
  const M = `${fmt(a.M, 2)} g/mol`;
  const NA = `${fmt(N_A / 1e23, 3)} · 10²³ /mol`;
  const nLine = (
    <FormulaLine>
      N = n · N<Sub>A</Sub> = {fmtSig(a.n)} mol · {NA} = {fmtSig(a.N)}
    </FormulaLine>
  );
  if (known === 'm')
    return (
      <>
        <FormulaLine>
          n = m / M = {fmtSig(value)} g / {M} = {fmtSig(a.n)} mol
        </FormulaLine>
        {nLine}
      </>
    );
  if (known === 'n')
    return (
      <>
        <FormulaLine>
          m = n · M = {fmtSig(value)} mol · {M} = {fmtSig(a.m)} g
        </FormulaLine>
        {nLine}
      </>
    );
  return (
    <>
      <FormulaLine>
        n = N / N<Sub>A</Sub> = {fmtSig(value)} / {NA} = {fmtSig(a.n)} mol
      </FormulaLine>
      <FormulaLine>
        m = n · M = {fmtSig(a.n)} mol · {M} = {fmtSig(a.m)} g
      </FormulaLine>
    </>
  );
}

/* ---------- Figur 1: mol-brua og molar masse ---------- */

interface BridgeLayout {
  vertical: boolean;
  boxes: { x: number; y: number; w: number; h: number }[];
  barY: number;
  barTitle: number;
  labelsY: number;
  cols: number;
  rowH: number;
  H: number;
}

function bridgeLayout(vertical: boolean, f: number, nElements: number): BridgeLayout {
  const h = 30 * f + 44 * f + 26 * f;
  const boxes = vertical
    ? [0, 1, 2].map((i) => ({ x: 150, y: 16 + i * (h + 64 * f), w: 500, h }))
    : [0, 1, 2].map((i) => ({ x: 20 + i * 280, y: 16, w: 200, h }));
  const last = boxes[2]!;
  const top = vertical ? last.y + last.h : last.y + last.h + 22 * f;
  const barTitle = top + 34 * f;
  const barY = barTitle + 14 * f;
  const labelsY = barY + 56 * f;
  const cols = Math.min(nElements, vertical ? 2 : 6);
  const rowH = 48 * f;
  const rows = Math.ceil(nElements / cols);
  return { vertical, boxes, barY, barTitle, labelsY, cols, rowH, H: Math.round(labelsY + rows * rowH - 8 * f) };
}

const ACTIVE: Record<Known, { mn: 'right' | 'left'; nN: 'right' | 'left' }> = {
  m: { mn: 'right', nN: 'right' },
  n: { mn: 'left', nN: 'right' },
  N: { mn: 'left', nN: 'left' },
};

function Bridge({ a, known, word, pf, layout, f }: { a: Amounts; known: Known; word: string; pf: ParsedFormula; layout: BridgeLayout; f: number }) {
  const { boxes, vertical } = layout;
  const data: { key: Known; title: ReactNode; value: string; sub?: string }[] = [
    { key: 'm', title: 'Masse m', value: `${fmtSig(a.m)} g` },
    { key: 'n', title: 'Stoffmengde n', value: `${fmtSig(a.n)} mol` },
    { key: 'N', title: 'Antall N', value: fmtSig(a.N), sub: word },
  ];
  const act = ACTIVE[known];
  return (
    <g>
      {boxes.map((b, i) => {
        const d = data[i]!;
        const on = d.key === known;
        return (
          <g key={d.key}>
            <rect x={b.x} y={b.y} width={b.w} height={b.h} rx={14} fill={VIZ.surface} stroke={on ? VIZ.series[0] : VIZ.muted} strokeOpacity={on ? 1 : 0.45} strokeWidth={on ? 3 : 1.5} />
            {on && <rect x={b.x} y={b.y} width={b.w} height={b.h} rx={14} fill={VIZ.series[0]} opacity={0.07} />}
            <Txt x={b.x + b.w / 2} y={b.y + 28 * f} muted size={0.85}>
              {d.title}
              {on ? ' (kjent)' : ''}
            </Txt>
            <Txt
              x={b.x + b.w / 2}
              y={b.y + 28 * f + 40 * f}
              weight={700}
              size={!vertical && d.value.length > 11 ? 1.1 : 1.35}
              color={d.key === 'n' ? VIZ.series[0] : undefined}
            >
              {d.value}
            </Txt>
            {d.sub && (
              <Txt x={b.x + b.w / 2} y={b.y + 28 * f + 40 * f + 24 * f} muted size={0.8}>
                {d.sub}
              </Txt>
            )}
          </g>
        );
      })}
      <Link from={boxes[0]!} to={boxes[1]!} vertical={vertical} f={f} forward={<>÷ M</>} back={<>· M</>} active={act.mn} />
      <Link
        from={boxes[1]!}
        to={boxes[2]!}
        vertical={vertical}
        f={f}
        forward={
          <>
            · N<TSub>A</TSub>
          </>
        }
        back={
          <>
            ÷ N<TSub>A</TSub>
          </>
        }
        active={act.nN}
      />
      <MolarMassBar pf={pf} M={a.M} layout={layout} f={f} />
    </g>
  );
}

/** To piler mellom boksene: fremover (høyre/ned) og tilbake (venstre/opp). Den som brukes nå, er uthevet. */
function Link({
  from,
  to,
  vertical,
  f,
  forward,
  back,
  active,
}: {
  from: { x: number; y: number; w: number; h: number };
  to: { x: number; y: number; w: number; h: number };
  vertical: boolean;
  f: number;
  forward: ReactNode;
  back: ReactNode;
  active: 'right' | 'left';
}) {
  const style = (on: boolean) => ({ stroke: on ? VIZ.ink : VIZ.muted, width: on ? 3 : 1.8, opacity: on ? 1 : 0.55 });
  const head = 10;
  const arrow = (x1: number, y1: number, x2: number, y2: number, on: boolean) => {
    const s = style(on);
    const len = Math.hypot(x2 - x1, y2 - y1);
    const ux = (x2 - x1) / len;
    const uy = (y2 - y1) / len;
    return (
      <g opacity={s.opacity}>
        <line x1={x1} y1={y1} x2={x2 - ux * head} y2={y2 - uy * head} stroke={s.stroke} strokeWidth={s.width} />
        <polygon points={`${x2},${y2} ${x2 - ux * head - uy * 5},${y2 - uy * head + ux * 5} ${x2 - ux * head + uy * 5},${y2 - uy * head - ux * 5}`} fill={s.stroke} />
      </g>
    );
  };
  if (!vertical) {
    const x1 = from.x + from.w + 6;
    const x2 = to.x - 6;
    const yF = from.y + from.h * 0.38;
    const yB = from.y + from.h * 0.66;
    return (
      <g>
        {arrow(x1, yF, x2, yF, active === 'right')}
        {arrow(x2, yB, x1, yB, active === 'left')}
        <Txt x={(x1 + x2) / 2} y={yF - 10} size={0.9} weight={active === 'right' ? 700 : 500} muted={active !== 'right'}>
          {forward}
        </Txt>
        <Txt x={(x1 + x2) / 2} y={yB + 24 * f} size={0.9} weight={active === 'left' ? 700 : 500} muted={active !== 'left'}>
          {back}
        </Txt>
      </g>
    );
  }
  const y1 = from.y + from.h + 6;
  const y2 = to.y - 6;
  const xF = from.x + from.w / 2 - 50;
  const xB = from.x + from.w / 2 + 50;
  return (
    <g>
      {arrow(xF, y1, xF, y2, active === 'right')}
      {arrow(xB, y2, xB, y1, active === 'left')}
      <Txt x={xF - 14} y={(y1 + y2) / 2 + 8 * f} anchor="end" size={0.9} weight={active === 'right' ? 700 : 500} muted={active !== 'right'}>
        {forward}
      </Txt>
      <Txt x={xB + 14} y={(y1 + y2) / 2 + 8 * f} anchor="start" size={0.9} weight={active === 'left' ? 700 : 500} muted={active !== 'left'}>
        {back}
      </Txt>
    </g>
  );
}

/** Stolpe som viser hvor mye hvert grunnstoff bidrar til den molare massen. */
function MolarMassBar({ pf, M, layout, f }: { pf: ParsedFormula; M: number; layout: BridgeLayout; f: number }) {
  const terms = molarMassTerms(pf);
  const x0 = 20;
  const x1 = 780;
  const sx = scaleLinear([0, 1], [x0, x1]);
  let acc = 0;
  const colW = (x1 - x0) / layout.cols;
  return (
    <g>
      <Txt x={x0} y={layout.barTitle} anchor="start" size={0.95}>
        {layout.vertical ? '' : 'Molar masse atom for atom: '}M(<TFormel f={pf} state={false} />) = {fmt(M, 2)} g/mol
      </Txt>
      {terms.map((t) => {
        const from = acc;
        acc += t.fraction;
        const c = atomColors(t.symbol);
        const w = sx(acc) - sx(from);
        return (
          <g key={t.symbol}>
            <rect x={sx(from)} y={layout.barY} width={Math.max(0, w)} height={30 * f} fill={c.fill} stroke={c.line} strokeWidth={1.5} />
            {w > 34 * f && (
              <text x={sx(from) + w / 2} y={layout.barY + 21 * f} textAnchor="middle" className="kj-atom-symbol" style={{ fill: c.ink, fontSize: 16 * f }}>
                {t.symbol}
              </text>
            )}
          </g>
        );
      })}
      {terms.map((t, i) => {
        const c = atomColors(t.symbol);
        const col = i % layout.cols;
        const row = Math.floor(i / layout.cols);
        const x = x0 + col * colW + 4;
        const y = layout.labelsY + row * layout.rowH;
        return (
          <g key={`l${t.symbol}`}>
            <circle cx={x + 7 * f} cy={y - 6 * f} r={7 * f} fill={c.fill} stroke={c.line} strokeWidth={1.5} />
            <Txt x={x + 20 * f} y={y} anchor="start" size={0.85} weight={650}>
              {t.symbol}:{' '}
              <tspan fontWeight={500}>
                {t.count === 1 ? '' : `${t.count} · `}
                {fmt(t.M, t.M < 10 ? 3 : 2)}
              </tspan>
            </Txt>
            <Txt x={x + 20 * f} y={y + 22 * f} anchor="start" size={0.8} muted>
              {fmt(t.mass, 2)} g/mol ({fmt(Math.round(t.fraction * 100), 0)} %)
            </Txt>
          </g>
        );
      })}
    </g>
  );
}

/* ---------- Figur 2: løsningen ---------- */

/** Høyden på løsningsfiguren: på mobil står teksten under begeret og utsnittet. */
function solutionHeight(f: number): number {
  return f > 1.3 ? Math.round(30 + 300 + 40 * f + 4 * 36 * f) : 320;
}

function SolutionScene({
  pf,
  preset,
  V,
  n,
  c,
  excess,
  f,
}: {
  pf: ParsedFormula;
  preset: Substance | undefined;
  V: number;
  n: number;
  c: number;
  excess: number;
  f: number;
}) {
  const narrow = f > 1.3;
  const beaker = narrow ? { x: 40, y: 30, w: 240, h: 300 } : { x: 40, y: 34, w: 190, h: 250 };
  const zoom = narrow ? { x: 420, y: 30, w: 330, h: 300 } : { x: 330, y: 44, w: 220, h: 220 };
  const level = (V / 2) * 0.9;
  const surface = beaker.y + beaker.h - level * (beaker.h - 6);
  const dots = Math.min(MAX_DOTS, Math.round(c / C_PER_DOT));
  const groups: ParticleGroup[] = preset?.ions
    ? preset.ions.map((ion) => {
        const q = formula(ion.formula).charge;
        return { n: dots * ion.count, r: q > 0 ? 6 : 7.5, fill: q > 0 ? KJEMI.plus : KJEMI.minus, label: q > 0 ? '+' : '−' };
      })
    : [{ n: dots, r: 6.5, fill: KJEMI.molecule }];
  const solid = atomColors(Object.keys(pf.atoms)[0] ?? 'C');
  const solidH = excess > 0 ? Math.min(0.3, 0.12 + 0.18 * Math.min(1, excess / 50)) * (beaker.y + beaker.h - surface) : 0;
  // Lupa: en liten sirkel i væsken, koblet til utsnittet
  const lens = { x: beaker.x + beaker.w * 0.55, y: (surface + beaker.y + beaker.h - solidH) / 2, r: Math.min(18, (beaker.y + beaker.h - surface - solidH) / 2 - 2) };
  const tx = narrow ? 40 : 580;
  const ty = narrow ? beaker.y + beaker.h + 40 * f : 80;
  const lines: { text: ReactNode; strong?: boolean; muted?: boolean }[] = [
    { text: <>V = {fmt(V, 2)} L</> },
    { text: <>n{excess > 0 ? ' (løst)' : ''} = {fmtSig(n)} mol</> },
    { text: <>c = {fmtSig(c)} mol/L</>, strong: true },
  ];
  if (excess > 0) lines.push({ text: <>{fmtSig(excess)} g bunnfall</>, muted: true });
  else if (dots === 0) lines.push({ text: <>For fortynnet til én prikk</>, muted: true });
  else if (Math.round(c / C_PER_DOT) > MAX_DOTS) lines.push({ text: <>Viser bare {MAX_DOTS} prikker</>, muted: true });
  return (
    <g>
      <Begerglass x={beaker.x} y={beaker.y} w={beaker.w} h={beaker.h} level={level} marks={[0.5, 1, 1.5, 2].map((v) => ({ level: (v / 2) * 0.9, label: `${fmt(v, 1)} L` }))}>
        {solidH > 0 && (
          <rect x={beaker.x} y={beaker.y + beaker.h - 2 - solidH} width={beaker.w} height={solidH} fill={solid.fill} stroke={solid.line} strokeWidth={1.5} />
        )}
      </Begerglass>
      {solidH > 0 && (
        <Txt x={beaker.x + beaker.w / 2} y={beaker.y + beaker.h - solidH / 2 + 5} size={0.75} halo={false}>
          bunnfall
        </Txt>
      )}
      {lens.r > 4 && (
        <g>
          <line x1={lens.x} y1={lens.y - lens.r} x2={zoom.x} y2={zoom.y} stroke={KJEMI.glass} strokeWidth={1.2} strokeDasharray="4 4" />
          <line x1={lens.x} y1={lens.y + lens.r} x2={zoom.x} y2={zoom.y + zoom.h} stroke={KJEMI.glass} strokeWidth={1.2} strokeDasharray="4 4" />
          <circle cx={lens.x} cy={lens.y} r={lens.r} fill="none" stroke={VIZ.ink} strokeWidth={2} />
        </g>
      )}
      <rect x={zoom.x} y={zoom.y} width={zoom.w} height={zoom.h} rx={18} fill={KJEMI.liquid} stroke={KJEMI.glass} strokeWidth={2} />
      <Partikler box={{ x: zoom.x + 8, y: zoom.y + 8, w: zoom.w - 16, h: zoom.h - 16 }} groups={groups} seed={5} />
      <Txt x={tx} y={ty} anchor="start" muted>
        <TFormel f={pf} state={false} /> løst i vann
      </Txt>
      {lines.map((l, i) => (
        <Txt key={i} x={tx} y={ty + (i + 1) * 36 * f} anchor="start" weight={l.strong ? 700 : 600} muted={l.muted} size={l.muted ? 0.85 : 1}>
          {l.text}
        </Txt>
      ))}
    </g>
  );
}

/* ---------- Figur 3: hvor stort er tallet? ---------- */

const E0 = 8;
const E1 = 27;

function scaleHeight(f: number): number {
  return Math.round(54 * f + (LANDMARKS.length + 2) * 30 * f + 10);
}

function MagnitudeScale({ N, word, f }: { N: number; word: string; f: number }) {
  const X0 = 30;
  const X1 = 770;
  const sx = scaleLinear([E0, E1], [X0, X1]);
  const lx = (v: number) => sx(Math.min(E1, Math.max(E0, Math.log10(v))));
  const axisY = 40 * f;
  const rowH = 30 * f;
  const step = f > 1.3 ? 3 : 2;
  const ticks: number[] = [];
  for (let e = E0 + 1; e <= E1; e++) ticks.push(e);
  const youText = `Ditt stoff: ${fmtSig(N)} ${word}`;
  const rows: { label: ReactNode; chars: number; value: number; range?: [number, number]; kind: 'mark' | 'mol' | 'you' }[] = [
    ...LANDMARKS.map((l) => ({ label: l.label as ReactNode, chars: l.label.length, value: l.value, range: l.range, kind: 'mark' as const })),
    {
      label: (
        <>
          1 mol: N<TSub>A</TSub> = {fmtSig(N_A, 4)}
        </>
      ),
      chars: 24,
      value: N_A,
      kind: 'mol' as const,
    },
    { label: youText, chars: youText.length, value: N, kind: 'you' as const },
  ].sort((p, q) => p.value - q.value);
  const youX = lx(N);
  const top = axisY + 22 * f;
  return (
    <g>
      <line x1={X0} y1={axisY} x2={X1} y2={axisY} className="viz-axis" />
      {ticks.map((e) => (
        <g key={e}>
          <line x1={sx(e)} y1={axisY - (e % step === 0 ? 7 : 4)} x2={sx(e)} y2={axisY} className="viz-axis" />
          {e % step === 0 && (
            <text x={sx(e)} y={axisY - 14} textAnchor="middle" className="viz-tick">
              10{superscript(e)}
            </text>
          )}
        </g>
      ))}
      <line x1={youX} y1={axisY} x2={youX} y2={top + rows.length * rowH} stroke={VIZ.series[0]} strokeWidth={1.5} strokeDasharray="5 5" />
      {rows.map((r, i) => {
        const y = top + i * rowH + rowH / 2;
        const x = lx(r.value);
        // Etiketten står til høyre for punktet til venstre i figuren, ellers til venstre, men bytter side hvis den ikke får plass.
        const size = r.kind === 'mark' ? 0.82 : 0.9;
        const w = r.chars * 0.55 * 17 * f * size;
        const xr = (r.range ? lx(r.range[1]) : x) + 14;
        const xl = (r.range ? lx(r.range[0]) : x) - 14;
        const fitsR = xr + w < 795;
        const fitsL = xl - w > 5;
        const right = x < 430 ? fitsR || !fitsL : !fitsL && fitsR;
        const color = r.kind === 'you' ? VIZ.series[0] : r.kind === 'mol' ? VIZ.ink : VIZ.muted;
        return (
          <g key={i}>
            <line x1={X0} y1={y} x2={X1} y2={y} stroke={VIZ.grid} strokeWidth={1} />
            {r.range && <line x1={lx(r.range[0])} y1={y} x2={lx(r.range[1])} y2={y} stroke={VIZ.muted} strokeWidth={6} strokeLinecap="round" opacity={0.45} />}
            <circle cx={x} cy={y} r={r.kind === 'mark' ? 5 : 7} fill={color} stroke={VIZ.surface} strokeWidth={2} />
            <Txt x={right ? xr : xl} y={y + 6 * f} anchor={right ? 'start' : 'end'} size={size} weight={r.kind === 'mark' ? 500 : 700} color={r.kind === 'mark' ? undefined : color}>
              {r.label}
            </Txt>
          </g>
        );
      })}
    </g>
  );
}

/* ---------- Forklaring ---------- */

function explanation({
  a,
  known,
  word,
  name,
  pf,
  preset,
  inSolution,
  V,
  c,
  sol,
  invalid,
  lastValid,
}: {
  a: Amounts;
  known: Known;
  word: string;
  name: string | null;
  pf: ParsedFormula;
  preset: Substance | undefined;
  inSolution: boolean;
  V: number;
  c: number;
  sol: { dissolved: number; excess: number; saturated: boolean };
  invalid: boolean;
  lastValid: string;
}): ReactNode {
  const what = name ? (
    <>
      {name} (<Formel f={pf} state={false} />)
    </>
  ) : (
    <Formel f={pf} state={false} />
  );
  const NA = (
    <>
      N<Sub>A</Sub>
    </>
  );
  const how =
    known === 'm' ? (
      <>
        Du kjenner massen. Del på den molare massen for å få stoffmengden (n = m/M), og gang stoffmengden med Avogadros tall for å få
        antallet (N = n · {NA}).
      </>
    ) : known === 'n' ? (
      <>
        Du kjenner stoffmengden. Gang med den molare massen for å få massen (m = n · M), og med Avogadros tall for å få antallet (N = n ·{' '}
        {NA}).
      </>
    ) : (
      <>
        Du kjenner antallet. Del på Avogadros tall for å få stoffmengden (n = N/{NA}), og gang med den molare massen for å få massen (m = n
        · M).
      </>
    );
  const years = countingYears(a.N);
  const singular = SINGULAR[word] ?? word;
  return (
    <>
      {invalid && (
        <p>
          Formelen kan ikke tolkes ennå, så figuren viser fortsatt <Formel f={lastValid} />.
        </p>
      )}
      <p>
        <strong>
          {fmtSig(a.m)} g {what} er {fmtSig(a.n)} mol
        </strong>
        , altså {fmtSig(a.N)} {word}. Én mol er alltid {fmtSig(N_A, 4)} partikler, og den veier like mange gram som den molare massen,{' '}
        {fmt(a.M, 2)} g. {how}
      </p>
      <p>
        Avogadros tall er enormt. Teller du én {singular} i sekundet, tar det {fmtSig(years, 2)} år å telle {fmtSig(a.N)} {word}, rundt{' '}
        {fmtSig(years / UNIVERSE_AGE_YEARS, 2)} ganger så lenge som universet har eksistert. Derfor teller kjemikere i mol.
      </p>
      {inSolution && (
        <p>
          {sol.saturated && preset?.solubility !== undefined ? (
            <>
              <strong>Løsningen er mettet.</strong> Bare omtrent {fmtSig(preset.solubility, 2)} g {preset.name} løses per liter vann ved 25 °C, så
              i {fmt(V, 2)} L kan det løses {fmtSig(sol.dissolved)} g. Resten, {fmtSig(sol.excess)} g, blir liggende som bunnfall, og
              konsentrasjonen blir c = {fmtSig(c)} mol/L.
            </>
          ) : (
            <>
              Når stoffet løses i {fmt(V, 2)} L vann, blir konsentrasjonen c = n/V = {fmtSig(c)} mol/L. Halverer du volumet, dobles
              konsentrasjonen, fordi den samme stoffmengden fordeles på mindre væske.
              {preset?.ions ? ' Ioneforbindelsen deler seg i ioner når den løses, som du ser i begeret.' : ''}
            </>
          )}
        </p>
      )}
    </>
  );
}
