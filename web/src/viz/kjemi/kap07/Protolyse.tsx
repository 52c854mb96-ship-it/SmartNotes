import { useState, type ReactNode } from 'react';
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
const SHRINK = 0.72;

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
          value={fmt(r.acid.pKa, 2)}
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
        <Readout label="Likevektskonstant K" value={fmtSig(10 ** r.logK, 2)} />
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
  roleY: number;
  nameY: number;
  eqY: number;
}

function layout(r: ProtolysisResult, f: number, k: number): Layout {
  const acid = ACID_STRUCTURES[r.acid.id]!;
  const base = BASE_STRUCTURES[r.base.id]!;
  const ea = extent(acid);
  const eb = extent(base);
  // Bindingslengden krymper hvis molekylene ikke får plass i bredden
  const pad = 26 * k;
  const gapUnits = 3.2;
  const units = ea.left + gapUnits + eb.right;
  const B = Math.min(54 * k, (800 - 2 * pad - 60) / units);
  const total = units * B;
  const dx = 400 - total / 2 + ea.left * B;
  const ax = dx + gapUnits * B;
  const up = Math.max(ea.up, eb.up) * B + 24 * k;
  const down = Math.max(ea.down, eb.down) * B + 24 * k;
  const roleY = 26 * f;
  const cy = roleY + 22 * f + up;
  const nameY = cy + down + 26 * f;
  const eqY = nameY + 96 * f;
  return { H: Math.round(eqY + 78 * f), B, cy, dx, ax, roleY, nameY, eqY };
}

/* ---------- Molekylene ---------- */

function Scene({ r, p, L, f, k }: { r: ProtolysisResult; p: number; L: Layout; f: number; k: number }) {
  const acid = ACID_STRUCTURES[r.acid.id]!;
  const base = BASE_STRUCTURES[r.base.id]!;
  const ak = acid.atoms[acid.key]!;
  const bk = base.atoms[base.key]!;
  const toA = (x: number, y: number) => ({ x: L.dx + (x - ak.x) * L.B, y: L.cy - (y - ak.y) * L.B });
  const toB = (x: number, y: number) => ({ x: L.ax + (x - bk.x) * L.B, y: L.cy - (y - bk.y) * L.B });
  const rOf = (el: string) => atomRadius(el, { scale: k }) * SHRINK;
  const after = p > 0.5;
  const hFrom = toA(acid.atoms[acid.h!]!.x, acid.atoms[acid.h!]!.y);
  const hTo = { x: L.ax - L.B, y: L.cy };
  const hx = hFrom.x + (hTo.x - hFrom.x) * p;
  const hy = hFrom.y + (hTo.y - hFrom.y) * p - Math.sin(Math.PI * p) * 26 * k;
  const H = { x: hx, y: hy, r: rOf('H') };
  const D = { ...toA(ak.x, ak.y), r: rOf(ak.el) };
  const Acc = { ...toB(bk.x, bk.y), r: rOf(bk.el) };

  const charge = (q: number, at: { x: number; y: number; r: number }, angle: number, key: string) => {
    if (q === 0) return null;
    const c = polar(at.x, at.y, at.r + 9 * k, angle);
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
  const midX = (L.dx + L.ax) / 2;
  const arrowY = L.cy - 46 * k;
  return (
    <g>
      {/* Bindingen til protonet: forsvinner fra syra, dannes til basen */}
      {p < 0.98 && <Bond a={D} b={H} color={KJEMI.bond} />}
      {p > 0.02 && (
        <g opacity={p}>
          <Bond a={H} b={Acc} />
        </g>
      )}
      {molecule(acid, toA, true)}
      {molecule(base, toB, false)}
      {/* Det frie elektronparet på basen tar protonet; bindingselektronene blir igjen på syra */}
      <g opacity={1 - p}>
        <LonePair at={Acc} angle={180} color={KJEMI.electron} />
      </g>
      <g opacity={p}>
        <LonePair at={D} angle={0} color={KJEMI.electron} />
      </g>
      <Atom x={H.x} y={H.y} el="H" r={H.r} ring={p > 0.02 && p < 0.98 ? KJEMI.plus : undefined} />
      {p > 0.02 && p < 0.98 && (
        <Txt x={H.x} y={H.y - H.r - 12 * k} size={0.85} weight={700} color={KJEMI.plus}>
          H⁺
        </Txt>
      )}
      {p <= 0.02 && (
        <g>
          <path
            d={`M${hFrom.x},${hFrom.y - H.r - 6} Q${midX + L.B * 0.6},${arrowY - 30 * k} ${hTo.x},${hTo.y - H.r - 8}`}
            fill="none"
            stroke={KJEMI.plus}
            strokeWidth={2}
            strokeDasharray="5 4"
          />
          <polygon points={`${hTo.x},${hTo.y - H.r - 4} ${hTo.x - 6},${hTo.y - H.r - 14} ${hTo.x + 6},${hTo.y - H.r - 14}`} fill={KJEMI.plus} />
          <Txt x={midX + L.B * 0.6} y={arrowY - 22 * k} size={0.8} weight={700} color={KJEMI.plus}>
            H⁺
          </Txt>
        </g>
      )}

      <Txt x={L.dx} y={L.roleY} size={0.85} weight={650} color={VIZ.series[0]}>
        {role(true)}
      </Txt>
      <Txt x={L.ax} y={L.roleY} size={0.85} weight={650} color={VIZ.series[1]}>
        {role(false)}
      </Txt>
      <Txt x={L.dx} y={L.nameY} size={1.05} weight={700} color={VIZ.series[0]}>
        <TFormel f={acidName.formula} state={false} />
      </Txt>
      <Txt x={L.ax} y={L.nameY} size={1.05} weight={700} color={VIZ.series[1]}>
        <TFormel f={baseName.formula} state={false} />
      </Txt>
      <Txt x={L.dx} y={L.nameY + 22 * f} size={0.78} muted>
        {acidName.name}
      </Txt>
      <Txt x={L.ax} y={L.nameY + 22 * f} size={0.78} muted>
        {baseName.name}
      </Txt>
    </g>
  );
}

/* ---------- Likningen med de korresponderende parene ---------- */

/** Omtrentlig bredde av en formel i figuren (senket og hevet skrift er smalere). */
function formulaWidth(f: string, size: number, fs: number): number {
  const t = formulaText(f);
  let w = 0;
  for (const ch of t) w += /[₀-₉⁰-⁹⁺⁻]/.test(ch) ? 0.42 : 0.62;
  return w * 17 * fs * size;
}

function Equation({ r, y, f }: { r: ProtolysisResult; y: number; f: number }) {
  const terms = [r.acid.formula, r.base.formula, r.base.conj.formula, r.acid.conj.formula];
  const seps = [' + ', ` ${r.arrow} `, ' + '];
  let size = 1.15;
  const widthAt = (s: number) => terms.reduce((a, t) => a + formulaWidth(t, s, f), 0) + 3 * 2.4 * 17 * f * s * 0.62;
  if (widthAt(size) > 740) size = (size * 740) / widthAt(size);
  const sepW = 2.4 * 17 * f * size * 0.62;
  const total = widthAt(size);
  let x = 400 - total / 2;
  const centers: number[] = [];
  const sepX: number[] = [];
  terms.forEach((t, i) => {
    const w = formulaWidth(t, size, f);
    centers.push(x + w / 2);
    x += w;
    if (i < 3) {
      sepX.push(x + sepW / 2);
      x += sepW;
    }
  });
  const colors = [VIZ.series[0]!, VIZ.series[1]!, VIZ.series[1]!, VIZ.series[0]!];
  const roles = ['syre 1', 'base 2', 'syre 2', 'base 1'];
  const topY = y - 58 * f;
  const botY = y + 52 * f;
  return (
    <g>
      {/* Par 1 (over) og par 2 (under) */}
      <path d={`M${centers[0]},${y - 42 * f} V${topY} H${centers[3]} V${y - 42 * f}`} fill="none" stroke={VIZ.series[0]} strokeWidth={2} />
      <path d={`M${centers[1]},${y + 36 * f} V${botY} H${centers[2]} V${y + 36 * f}`} fill="none" stroke={VIZ.series[1]} strokeWidth={2} />
      {terms.map((t, i) => (
        <g key={i}>
          <Txt x={centers[i]!} y={y} size={size} weight={700} color={colors[i]}>
            <TFormel f={t} state={false} />
          </Txt>
          <Txt x={centers[i]!} y={i === 0 || i === 3 ? y - 26 * f : y + 26 * f} size={0.75} color={colors[i]}>
            {roles[i]}
          </Txt>
        </g>
      ))}
      {seps.map((s, i) => (
        <Txt key={i} x={sepX[i]!} y={y} size={size} weight={i === 1 ? 700 : 500}>
          {s.trim()}
        </Txt>
      ))}
      <Txt x={(centers[0]! + centers[3]!) / 2} y={topY - 8} size={0.75} muted>
        korresponderende syre-base-par 1
      </Txt>
      <Txt x={(centers[1]! + centers[2]!) / 2} y={botY + 20 * f} size={0.75} muted>
        korresponderende syre-base-par 2
      </Txt>
    </g>
  );
}

/* ---------- Forklaring ---------- */

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
        {A} (pK<Sub>a</Sub> {fmt(r.acid.pKa, 2)}) er en mye sterkere syre enn {cA} (pK<Sub>a</Sub> {fmt(r.base.conjPKa, 2)}), så K = {fmtSig(10 ** r.logK, 2)}.
        Reaksjonen går praktisk talt fullstendig, og vi skriver enkel pil (→).
      </>
    );
  else
    direction = (
      <>
        {A} (pK<Sub>a</Sub> {fmt(r.acid.pKa, 2)}) er en {stronger ? 'sterkere' : 'svakere'} syre enn {cA} (pK<Sub>a</Sub> {fmt(r.base.conjPKa, 2)}), så K ={' '}
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
