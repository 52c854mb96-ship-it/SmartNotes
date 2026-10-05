import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import {
  Atom,
  Bond,
  Controls,
  Explain,
  Figure,
  Formel,
  KJEMI,
  LonePair,
  PlayControls,
  Reaksjon,
  Readout,
  Readouts,
  Select,
  Slider,
  Sub,
  TFormel,
  Toolbar,
  Txt,
  VIZ,
  VizLayout,
  atomRadius,
  fmt,
  fmtSig,
  formulaText,
  polar,
  superscript,
  useContainerTextScale,
  useSimClock,
} from '../kit';
import { PROTOLYSIS_ACIDS, PROTOLYSIS_BASES, protolysis, type ProtolysisResult } from './model';
import { ACID_STRUCTURES, BASE_STRUCTURES, extent, type Structure } from './strukturer';

/** Animasjonen: stille i 0,3 s, så flyttes protonet i løpet av 1,9 s. */
const T0 = 0.3;
const TRANSFER = 1.9;
const T_MAX = T0 + TRANSFER + 0.3;
/** Atomene tegnes litt mindre enn standard, så store molekyler (eddiksyre) får plass. */
const SHRINK = 0.85;

const smooth = (x: number) => {
  const t = Math.min(1, Math.max(0, x));
  return t * t * (3 - 2 * t);
};

const KIND_TEXT: Record<ProtolysisResult['kind'], string> = {
  fullstendig: 'Fullstendig (→)',
  'mot høyre': 'Likevekt mot høyre',
  'mot venstre': 'Likevekt mot venstre',
  'svært lite': 'Svært lite reagerer',
  'ingen endring': 'Ingen endring',
};

export default function Protolyse() {
  const [acidId, setAcidId] = useState('CH3COOH');
  const [baseId, setBaseId] = useState('H2O');
  const clock = useSimClock({ tMax: T_MAX });
  const [ref, f] = useContainerTextScale<HTMLDivElement>();
  const r = protolysis(acidId, baseId);
  const p = smooth((clock.t - T0) / TRANSFER);
  const k = Math.max(1, 0.85 * f);
  const L = layout(r, f, k);

  const choose = (setter: (v: string) => void) => (v: string) => {
    setter(v);
    clock.reset();
  };

  return (
    <VizLayout>
      <Toolbar>
        <Select
          label="Syre"
          value={acidId}
          onChange={choose(setAcidId)}
          options={PROTOLYSIS_ACIDS.map((a) => ({ value: a.id, label: `${formulaText(a.formula)} (${a.name})` }))}
        />
        <Select
          label="Base"
          value={baseId}
          onChange={choose(setBaseId)}
          options={PROTOLYSIS_BASES.map((b) => ({ value: b.id, label: `${formulaText(b.formula)} (${b.name})` }))}
        />
      </Toolbar>
      <Controls>
        <Slider
          label="Protonoverføring"
          value={Math.round(p * 100)}
          onChange={(v) => clock.setT(T0 + (v / 100) * TRANSFER)}
          min={0}
          max={100}
          step={1}
          unit="%"
        />
      </Controls>
      <Toolbar>
        <PlayControls clock={clock} label="tid" decimals={1} />
      </Toolbar>

      <div ref={ref}>
        <Figure
          viewBox={`0 0 800 ${L.H}`}
          label={`${formulaText(r.acid.formula)} gir et proton til ${formulaText(r.base.formula)}: ${formulaText(r.acid.formula)} + ${formulaText(r.base.formula)} ${r.arrow} ${formulaText(r.base.conj.formula)} + ${formulaText(r.acid.conj.formula)}.`}
          caption="Protonet (H⁺) flyttes fra syra til et fritt elektronpar på basen. Elektronparet i bindingen til protonet blir igjen på syra. Ladningene er formelle ladninger på atomene."
          maxHeight={L.H}
        >
          <Scene r={r} p={p} L={L} f={f} k={k} />
          <Equation r={r} y={L.eqY} f={f} />
        </Figure>
      </div>

      <Readouts>
        <Readout
          label={
            <>
              pK<Sub>a</Sub>(<Formel f={r.acid.formula} />)
            </>
          }
          value={r.acid.pKa < 0 ? `≈ ${fmt(r.acid.pKa, 0)}` : fmt(r.acid.pKa, 2)}
          tone={VIZ.series[0]}
        />
        <Readout
          label={
            <>
              pK<Sub>a</Sub>(<Formel f={r.base.conj.formula} />)
            </>
          }
          value={fmt(r.base.conjPKa, 2)}
          tone={VIZ.series[1]}
        />
        <Readout label="Likevektskonstant K" value={r.acid.pKa < 0 ? `≈ 10${superscript(Math.round(r.logK))}` : fmtSig(10 ** r.logK, 2)} />
        <Readout label="Reaksjonen" value={KIND_TEXT[r.kind]} />
      </Readouts>

      <Explain>{explanation(r)}</Explain>
    </VizLayout>
  );
}

/* ---------- Plassering ---------- */

interface Layout {
  H: number;
  B: number;
  cy: number;
  /** Nøkkelatomene (donor og akseptor) i figurens koordinater. */
  dx: number;
  ax: number;
  /** Midten av hvert molekyl (der etikettene står). */
  acidX: number;
  baseX: number;
  roleY: number;
  nameY: number;
  eqY: number;
}

/** Atomenes radius i bindingslengder (omtrent), så molekylene ikke går ut av sin halvdel. */
const PAD_UNITS = 0.5;

function layout(r: ProtolysisResult, f: number, k: number): Layout {
  const acid = ACID_STRUCTURES[r.acid.id]!;
  const base = BASE_STRUCTURES[r.base.id]!;
  const ea = extent(acid);
  // Basen får plass til protonet som kommer inn fra venstre (én bindingslengde til venstre for akseptoratomet).
  const eb0 = extent(base);
  const eb = { ...eb0, left: Math.max(eb0.left, 1) };
  // Hvert molekyl får sin halvdel av figuren; bindingslengden krymper hvis det største ikke får plass.
  const widest = Math.max(ea.left + ea.right, eb.left + eb.right) + 2 * PAD_UNITS;
  const B = Math.min(62 * k, 330 / widest);
  const acidX = 200;
  const baseX = 600;
  const dx = acidX - ((ea.right - ea.left) / 2) * B;
  const ax = baseX - ((eb.right - eb.left) / 2) * B;
  const up = Math.max(ea.up, eb.up) * B + 26 * k;
  const down = Math.max(ea.down, eb.down) * B + 22 * k;
  const roleY = 26 * f;
  const cy = roleY + 20 * f + up;
  const nameY = cy + down + 28 * f;
  // Navnet under formelen (22 · f), luft, etiketten til par 1 og klammen over likningen
  const eqY = nameY + 22 * f + 34 * f + 66 * f;
  return { H: Math.round(eqY + 82 * f), B, cy, dx, ax, acidX, baseX, roleY, nameY, eqY };
}

/* ---------- Molekylene ---------- */

function Scene({ r, p, L, f, k }: { r: ProtolysisResult; p: number; L: Layout; f: number; k: number }) {
  const acid = ACID_STRUCTURES[r.acid.id]!;
  const base = BASE_STRUCTURES[r.base.id]!;
  const ak = acid.atoms[acid.key]!;
  const bk = base.atoms[base.key]!;
  const toA = (x: number, y: number) => ({ x: L.dx + (x - ak.x) * L.B, y: L.cy - (y - ak.y) * L.B });
  const toB = (x: number, y: number) => ({ x: L.ax + (x - bk.x) * L.B, y: L.cy - (y - bk.y) * L.B });
  const rOf = (el: string) => Math.min(L.B * 0.42, atomRadius(el, { scale: k }) * SHRINK);
  const after = p > 0.5;
  const hFrom = toA(acid.atoms[acid.h!]!.x, acid.atoms[acid.h!]!.y);
  const hTo = { x: L.ax - L.B, y: L.cy };
  const lift = Math.min(36 * k, Math.abs(hTo.x - hFrom.x) * 0.2);
  const hx = hFrom.x + (hTo.x - hFrom.x) * p;
  const hy = hFrom.y + (hTo.y - hFrom.y) * p - Math.sin(Math.PI * p) * lift;
  const H = { x: hx, y: hy, r: rOf('H') };
  const D = { ...toA(ak.x, ak.y), r: rOf(ak.el) };
  const Acc = { ...toB(bk.x, bk.y), r: rOf(bk.el) };
  const moving = p > 0.02 && p < 0.98;

  const charge = (q: number, at: { x: number; y: number; r: number }, angle: number, key: string) => {
    if (q === 0) return null;
    const c = polar(at.x, at.y, at.r + 10 * k, angle);
    const color = q > 0 ? KJEMI.plus : KJEMI.minus;
    return (
      <g key={key}>
        <circle cx={c.x} cy={c.y} r={8 * k} fill={VIZ.surface} stroke={color} strokeWidth={1.8} />
        <text x={c.x} y={c.y + 5 * k} textAnchor="middle" style={{ fill: color, fontSize: 15 * k, fontWeight: 700 }}>
          {q > 0 ? '+' : '−'}
        </text>
      </g>
    );
  };

  const molecule = (s: Structure, to: (x: number, y: number) => { x: number; y: number }, isAcid: boolean) => {
    const skip = isAcid ? s.h : undefined;
    const pos = s.atoms.map((a) => ({ ...to(a.x, a.y), r: rOf(a.el) }));
    return (
      <g>
        {s.bonds.map(([i, j, o], n) => {
          if (i === skip || j === skip) return null;
          return <Bond key={n} a={pos[i]!} b={pos[j]!} order={o ?? 1} />;
        })}
        {s.atoms.map((a, i) => (i === skip ? null : <Atom key={i} x={pos[i]!.x} y={pos[i]!.y} el={a.el} r={pos[i]!.r} />))}
        {s.atoms.map((a, i) => {
          if (i === skip) return null;
          const shift = i === s.key && after ? (isAcid ? -1 : 1) : 0;
          return charge((a.q ?? 0) + shift, pos[i]!, a.qa ?? 90, `q${i}`);
        })}
      </g>
    );
  };

  const role = (isAcid: boolean) =>
    isAcid ? (after ? 'korresponderende base' : 'syre (protondonor)') : after ? 'korresponderende syre' : 'base (protonakseptor)';
  const acidName = after ? r.acid.conj : r.acid;
  const baseName = after ? r.base.conj : r.base;
  const midX = (hFrom.x + hTo.x) / 2;
  const arcTop = Math.min(hFrom.y, hTo.y) - H.r - lift - 18 * k;
  // Bindingen til protonet blir svakere og forsvinner mens protonet flyttes; den nye bindingen dannes mot slutten.
  const oldBond = Math.max(0, 1 - p * 1.6);
  const newBond = Math.max(0, (p - 0.4) / 0.6);
  return (
    <g>
      {oldBond > 0 && (
        <g opacity={oldBond}>
          <Bond a={D} b={H} />
        </g>
      )}
      {newBond > 0 && (
        <g opacity={newBond}>
          <Bond a={H} b={Acc} />
        </g>
      )}
      {molecule(acid, toA, true)}
      {molecule(base, toB, false)}
      {/* Det frie elektronparet på basen tar protonet; bindingselektronene blir igjen på syra */}
      <g opacity={1 - newBond}>
        <LonePair at={Acc} angle={180} color={KJEMI.electron} />
      </g>
      <g opacity={1 - oldBond}>
        <LonePair at={D} angle={0} color={KJEMI.electron} />
      </g>
      <Atom x={H.x} y={H.y} el="H" r={H.r} ring={moving ? KJEMI.plus : undefined} />
      {moving && (
        <Txt x={H.x} y={H.y - H.r - 12 * k} size={0.85} weight={700} color={KJEMI.plus}>
          H⁺
        </Txt>
      )}
      {p <= 0.02 && (
        <g>
          <path
            d={`M${hFrom.x + H.r * 0.6},${hFrom.y - H.r - 4} Q${midX},${arcTop - 20 * k} ${hTo.x},${hTo.y - H.r - 10}`}
            fill="none"
            stroke={KJEMI.plus}
            strokeWidth={2}
            strokeDasharray="5 4"
          />
          <polygon points={`${hTo.x},${hTo.y - H.r - 4} ${hTo.x - 6 * k},${hTo.y - H.r - 15 * k} ${hTo.x + 6 * k},${hTo.y - H.r - 13 * k}`} fill={KJEMI.plus} />
          <Txt x={midX} y={arcTop - 2 * k} size={0.85} weight={700} color={KJEMI.plus}>
            H⁺
          </Txt>
        </g>
      )}

      <Txt x={L.acidX} y={L.roleY} size={0.85} weight={650} color={VIZ.series[0]}>
        {role(true)}
      </Txt>
      <Txt x={L.baseX} y={L.roleY} size={0.85} weight={650} color={VIZ.series[1]}>
        {role(false)}
      </Txt>
      <Txt x={L.acidX} y={L.nameY} size={1.05} weight={700} color={VIZ.series[0]}>
        <TFormel f={acidName.formula} state={false} />
      </Txt>
      <Txt x={L.baseX} y={L.nameY} size={1.05} weight={700} color={VIZ.series[1]}>
        <TFormel f={baseName.formula} state={false} />
      </Txt>
      <Txt x={L.acidX} y={L.nameY + 22 * f} size={0.78} muted>
        {acidName.name}
      </Txt>
      <Txt x={L.baseX} y={L.nameY + 22 * f} size={0.78} muted>
        {baseName.name}
      </Txt>
    </g>
  );
}

/* ---------- Likningen med de korresponderende parene ---------- */

/** Omtrentlig bredde av en formel per størrelsesenhet (før den er målt i nettleseren). */
function estimateWidth(f: string, fs: number): number {
  const t = formulaText(f);
  let w = 0;
  for (const ch of t) w += /[₀-₉⁰-⁹⁺⁻]/.test(ch) ? 0.45 : /[A-Z]/.test(ch) ? 0.76 : 0.6;
  return w * 17 * fs;
}

/**
 * Bredden av hvert ledd i likningen per størrelsesenhet, målt i nettleseren etter første tegning (getBBox), så
 * leddene aldri overlapper. Første tegning bruker et anslag.
 */
function useMeasured(n: number, size: number, estimate: number[]) {
  const refs = useRef<(SVGGElement | null)[]>([]);
  const [measured, setMeasured] = useState<number[] | null>(null);
  useLayoutEffect(() => {
    const ws = refs.current.slice(0, n).map((el) => {
      try {
        return (el?.getBBox().width ?? 0) / size;
      } catch {
        return 0;
      }
    });
    if (ws.length !== n || ws.some((w) => !(w > 0))) return;
    setMeasured((old) => (old && old.length === n && old.every((v, i) => Math.abs(v - ws[i]!) < 0.5) ? old : ws));
  });
  const widths = measured && measured.length === n ? measured : estimate;
  return [refs, widths] as const;
}

function Equation({ r, y, f }: { r: ProtolysisResult; y: number; f: number }) {
  const terms = [r.acid.formula, r.base.formula, r.base.conj.formula, r.acid.conj.formula];
  const seps = ['+', r.arrow, '+'];
  const parts = [terms[0]!, seps[0]!, terms[1]!, seps[1]!, terms[2]!, seps[2]!, terms[3]!];
  const base = 1.15;
  const estimate = parts.map((t, i) => (i % 2 === 0 ? estimateWidth(t, f) : 0.75 * 17 * f));
  const [refs, unit] = useMeasured(parts.length, base, estimate);
  const gap = 0.32 * 17 * f;
  const natural = unit.reduce((a, w) => a + w * base, 0) + gap * 2 * seps.length;
  const size = natural > 750 ? (base * 750) / natural : base;
  const scale = size / base;
  const xs: number[] = [];
  let x = 400 - (natural * scale) / 2;
  parts.forEach((_, i) => {
    const w = unit[i]! * size;
    const pad = i % 2 === 1 ? gap * scale : 0;
    x += pad;
    xs.push(x + w / 2);
    x += w + pad;
  });
  const centers = [xs[0]!, xs[2]!, xs[4]!, xs[6]!];
  const colors = [VIZ.series[0]!, VIZ.series[1]!, VIZ.series[1]!, VIZ.series[0]!];
  const roles = ['syre 1', 'base 2', 'syre 2', 'base 1'];
  const topY = y - 52 * f;
  const botY = y + 48 * f;
  return (
    <g>
      {/* Par 1 (over) og par 2 (under) */}
      <path d={`M${centers[0]},${y - 38 * f} V${topY} H${centers[3]} V${y - 38 * f}`} fill="none" stroke={VIZ.series[0]} strokeWidth={2} />
      <path d={`M${centers[1]},${y + 34 * f} V${botY} H${centers[2]} V${y + 34 * f}`} fill="none" stroke={VIZ.series[1]} strokeWidth={2} />
      {parts.map((t, i) => (
        <g key={i} ref={(el) => void (refs.current[i] = el)}>
          <Txt x={xs[i]!} y={y} size={size} weight={i % 2 === 0 || i === 3 ? 700 : 500} color={i % 2 === 0 ? colors[i / 2] : undefined}>
            {i % 2 === 0 ? <TFormel f={t} state={false} /> : t}
          </Txt>
        </g>
      ))}
      {centers.map((cx, i) => (
        <Txt key={`r${i}`} x={cx} y={i === 0 || i === 3 ? y - 26 * f : y + 24 * f} size={0.75} color={colors[i]}>
          {roles[i]}
        </Txt>
      ))}
      <Txt x={(centers[0]! + centers[3]!) / 2} y={topY - 9} size={0.75} muted>
        korresponderende syre-base-par 1
      </Txt>
      <Txt x={(centers[1]! + centers[2]!) / 2} y={botY + 21 * f} size={0.75} muted>
        korresponderende syre-base-par 2
      </Txt>
    </g>
  );
}

/* ---------- Forklaring ---------- */

/** HCl har ingen nøyaktig pK_a i vann (den er fullstendig protolysert); tabellene oppgir ca. −6. */
const pkaText = (v: number) => (v < 0 ? `ca. ${fmt(v, 0)}` : fmt(v, 2));

function explanation(r: ProtolysisResult): ReactNode {
  const A = <Formel f={r.acid.formula} />;
  const B = <Formel f={r.base.formula} />;
  const cA = <Formel f={r.base.conj.formula} />;
  const cB = <Formel f={r.acid.conj.formula} />;
  const water = r.acid.id === 'H2O' || r.base.id === 'H2O';
  const noOH = ['NH3', 'CO3', 'CH3COO'].includes(r.base.id);
  const stronger = r.acid.pKa < r.base.conjPKa;
  let direction: ReactNode;
  if (r.identity)
    direction = (
      <>
        Her er syra og den korresponderende syra like ({A} og {cA}), så protonet bare bytter plass mellom to like partikler. Netto skjer det ingenting.
      </>
    );
  else if (r.kind === 'fullstendig')
    direction = (
      <>
        {A} (pK<Sub>a</Sub> {pkaText(r.acid.pKa)}) er en mye sterkere syre enn {cA} (pK<Sub>a</Sub> {fmt(r.base.conjPKa, 2)}), så K{' '}
        {r.acid.pKa < 0 ? `≈ 10${superscript(Math.round(r.logK))}` : `= ${fmtSig(10 ** r.logK, 2)}`}.
        Reaksjonen går praktisk talt fullstendig, og vi skriver enkel pil (→).
      </>
    );
  else
    direction = (
      <>
        {A} (pK<Sub>a</Sub> {pkaText(r.acid.pKa)}) er en {stronger ? 'sterkere' : 'svakere'} syre enn {cA} (pK<Sub>a</Sub> {fmt(r.base.conjPKa, 2)}), så K ={' '}
        {fmtSig(10 ** r.logK, 2)}. Reaksjonen er en likevekt (⇌){' '}
        {r.kind === 'mot høyre'
          ? 'som ligger mot høyre, men med merkbare mengder av alle fire.'
          : r.kind === 'mot venstre'
            ? 'som ligger mot venstre: de fleste partiklene forblir som de var.'
            : 'som ligger langt mot venstre: bare en svært liten andel reagerer.'}{' '}
        Likevekten ligger alltid mot den svakeste syra og den svakeste basen.
      </>
    );
  return (
    <>
      <p>
        <strong>Protolyse er overføring av et proton (H⁺).</strong> {A} gir fra seg et proton og er syra (protondonor), mens {B} tar det opp med et fritt
        elektronpar og er basen (protonakseptor). Etterpå er {cB} den korresponderende basen til {A}, og {cA} den korresponderende syra til {B}. Parene{' '}
        {A}/{cB} og {cA}/{B} skiller seg med nøyaktig ett proton.
      </p>
      <p>
        {direction} Hele likningen: <Reaksjon r={r.equation} />
      </p>
      {(water || noOH) && (
        <p>
          {water ? (
            <>
              Vann er en amfolytt: det kan både gi fra seg et proton (og bli <Formel f="OH^-" />) og ta opp et proton (og bli <Formel f="H3O^+" />). Velg vann
              både som syre og base for å se autoprotolysen, der K = K<Sub>w</Sub> = 1,0 · 10⁻¹⁴.
            </>
          ) : (
            <>
              Legg merke til at {B} er en base uten å inneholde <Formel f="OH^-" />. Etter Brønsted er en base alt som kan ta opp et proton.
            </>
          )}
        </p>
      )}
    </>
  );
}
