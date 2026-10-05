import { useState, type CSSProperties, type ReactNode } from 'react';
import { Minus, Plus } from 'lucide-react';
import {
  Explain,
  Figure,
  Formel,
  Formula,
  FormulaLine,
  KJEMI,
  Legend,
  Readout,
  Readouts,
  Reaksjon,
  Select,
  Toolbar,
  Txt,
  VIZ,
  VizLayout,
  atomColors,
  fmt,
  formula,
  formulaText,
  molarMass,
  useContainerTextScale,
} from '../kit';
import {
  BALANCE_REACTIONS,
  COEF_MAX,
  COEF_MIN,
  balanceOrder,
  balanceSolution,
  balanceState,
  hintFor,
  withCoefficients,
  type BalanceReaction,
  type BalanceState,
} from './model';

/** Grønt når et grunnstoff stemmer, oransje når det ikke gjør det. */
const OK = VIZ.series[2]!;
const BAD = VIZ.series[1]!;

const ones = (r: BalanceReaction) => [...r.reactants, ...r.products].map(() => 1);

export default function Balansering() {
  const [id, setId] = useState(BALANCE_REACTIONS[0]!.id);
  const r = BALANCE_REACTIONS.find((x) => x.id === id) ?? BALANCE_REACTIONS[0]!;
  const [coefs, setCoefs] = useState<number[]>(() => ones(r));
  const [revealed, setRevealed] = useState(false);
  const [ref, f] = useContainerTextScale<HTMLDivElement>();

  const sol = balanceSolution(r);
  const st = balanceState(r, coefs);
  // På mobil tegnes tabellen i en smalere viewBox (420 bred) med vanlig tekststørrelse, så kulene blir store nok.
  const narrow = f > 1.3;
  const layout = tableLayout(r, sol, st, narrow ? 1 : f, narrow);

  const choose = (next: string) => {
    const nr = BALANCE_REACTIONS.find((x) => x.id === next) ?? r;
    setId(next);
    setCoefs(ones(nr));
    setRevealed(false);
  };
  const setCoef = (i: number, v: number) => {
    setRevealed(false);
    setCoefs((prev) => prev.map((c, j) => (j === i ? Math.min(COEF_MAX, Math.max(COEF_MIN, v)) : c)));
  };

  return (
    <VizLayout>
      <Toolbar>
        <Select label="Reaksjon" value={id} onChange={choose} options={BALANCE_REACTIONS.map((x) => ({ value: x.id, label: x.name }))} />
        <button
          type="button"
          className="btn btn-sm"
          onClick={() => {
            setCoefs(sol);
            setRevealed(true);
          }}
        >
          Vis løsning
        </button>
        <button
          type="button"
          className="btn btn-sm btn-ghost"
          onClick={() => {
            setCoefs(ones(r));
            setRevealed(false);
          }}
        >
          Start på nytt
        </button>
      </Toolbar>

      <EquationEditor r={r} coefs={coefs} onChange={setCoef} balanced={st.balanced} />

      <div ref={ref}>
        <Figure
          viewBox={`0 0 ${layout.W} ${layout.H}`}
          label={`Atomtelling: ${st.rows.map((x) => `${x.symbol} ${x.left} til venstre og ${x.right} til høyre`).join(', ')}. ${st.balanced ? 'Likningen er balansert.' : 'Likningen er ikke balansert.'}`}
          maxHeight={layout.H}
        >
          <AtomTable st={st} layout={layout} f={narrow ? 1 : f} />
        </Figure>
      </div>
      <Legend
        items={[
          { color: OK, label: 'Like mange atomer på begge sider' },
          { color: BAD, label: 'Stemmer ikke ennå' },
        ]}
      />

      <Readouts>
        <Readout label="Atomer til venstre" value={fmt(st.atomsLeft, 0)} tone={st.atomsLeft === st.atomsRight ? undefined : BAD} />
        <Readout label="Atomer til høyre" value={fmt(st.atomsRight, 0)} tone={st.atomsLeft === st.atomsRight ? undefined : BAD} />
        <Readout label="Masse til venstre" value={fmt(st.massLeft, 2)} unit="g" />
        <Readout label="Masse til høyre" value={fmt(st.massRight, 2)} unit="g" tone={Math.abs(st.massLeft - st.massRight) < 1e-6 ? OK : BAD} />
      </Readouts>

      <Formula label="Likningen og massen på hver side">
        <FormulaLine>
          <Reaksjon r={withCoefficients(r, coefs)} />
        </FormulaLine>
        <FormulaLine>
          m(venstre) = {massTerms(r.reactants, coefs, 0)} = {fmt(st.massLeft, 2)} g
        </FormulaLine>
        <FormulaLine>
          m(høyre) = {massTerms(r.products, coefs, r.reactants.length)} = {fmt(st.massRight, 2)} g
        </FormulaLine>
      </Formula>

      <Explain>{explanation(r, coefs, st, sol, revealed)}</Explain>
    </VizLayout>
  );
}

/** «1 · 16,04 + 2 · 32,00» (koeffisienten lest som mol, ganget med molar masse). */
function massTerms(list: string[], coefs: number[], offset: number): string {
  return list.map((fx, i) => `${coefs[offset + i] ?? 1} · ${fmt(molarMass(formula(fx)), 2)}`).join(' + ');
}

/* ---------- Likningen med steppere (HTML) ---------- */

const WRAP: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '6px 8px',
  padding: '10px 12px',
  background: 'var(--surface-2)',
  borderRadius: 'var(--radius)',
};
const TERM: CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 2 };
const STEPPER: CSSProperties = { display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: 3 };
const STEP_BTN: CSSProperties = { minHeight: 28, height: 28, width: 36, padding: 0 };
const SIGN: CSSProperties = { fontSize: 22, fontWeight: 600, color: 'var(--text-2)', padding: '0 2px' };

function EquationEditor({
  r,
  coefs,
  onChange,
  balanced,
}: {
  r: BalanceReaction;
  coefs: number[];
  onChange: (i: number, v: number) => void;
  balanced: boolean;
}) {
  const n = r.reactants.length;
  const items: ReactNode[] = [];
  [...r.reactants, ...r.products].forEach((fx, i) => {
    if (i === n)
      items.push(
        <span key="pil" style={SIGN} aria-hidden>
          →
        </span>,
      );
    else if (i > 0)
      items.push(
        <span key={`pluss${i}`} style={SIGN} aria-hidden>
          +
        </span>,
      );
    const coef = coefs[i] ?? 1;
    const name = formulaText(fx, true);
    items.push(
      <span key={fx} style={TERM}>
        <span style={STEPPER}>
          <button
            type="button"
            className="btn btn-sm"
            style={STEP_BTN}
            aria-label={`Øk koeffisienten foran ${name}`}
            disabled={coef >= COEF_MAX}
            onClick={() => onChange(i, coef + 1)}
          >
            <Plus size={16} aria-hidden />
          </button>
          <output
            aria-label={`Koeffisient foran ${name}`}
            style={{
              fontSize: 22,
              fontWeight: 700,
              minWidth: '1.6em',
              textAlign: 'center',
              fontVariantNumeric: 'tabular-nums',
              color: coef === 1 ? 'var(--text-3)' : 'var(--text)',
            }}
          >
            {coef}
          </output>
          <button
            type="button"
            className="btn btn-sm"
            style={STEP_BTN}
            aria-label={`Minsk koeffisienten foran ${name}`}
            disabled={coef <= COEF_MIN}
            onClick={() => onChange(i, coef - 1)}
          >
            <Minus size={16} aria-hidden />
          </button>
        </span>
        <span style={{ fontSize: 21, fontWeight: 600, color: 'var(--text)' }}>
          <Formel f={fx} />
        </span>
      </span>,
    );
  });
  return (
    <div
      role="group"
      aria-label={balanced ? 'Reaksjonslikningen, balansert' : 'Reaksjonslikningen med koeffisienter'}
      style={{ ...WRAP, boxShadow: balanced ? `inset 0 0 0 2px var(--success)` : undefined }}
    >
      {items}
    </div>
  );
}

/* ---------- Figur: atomregnskapet ---------- */

interface TableLayout {
  W: number;
  narrow: boolean;
  k: number;
  headerY: number;
  rowTop: number;
  rowH: number;
  gap: number;
  lines: number;
  perLine: number;
  ballR: number;
  pitch: number;
  /** Første kule til venstre/høyre for midten. */
  inner: number;
  badgeX: number;
  rows: number;
  H: number;
}

const hasChargeRow = (st: BalanceState) => st.hasCharge;

function tableLayout(r: BalanceReaction, sol: number[], st: BalanceState, f: number, narrow: boolean): TableLayout {
  const W = narrow ? 420 : 800;
  const k = Math.max(1, 0.85 * f);
  const ballR = narrow ? 7.5 : 9;
  const pitch = 2 * ballR + 3;
  const badgeX = (narrow ? 20 : 26) * k;
  const inner = (narrow ? (hasChargeRow(st) ? 96 : 64) : hasChargeRow(st) ? 118 : 108) * k;
  const outer = badgeX + (narrow ? 18 : 22) * k;
  const perLine = Math.max(4, Math.floor((W / 2 - inner - outer) / pitch));
  // Plass til løsningens atomtall (og ladningen i ionelikninger); mer enn det vises som «+n».
  const solSt = balanceState(r, sol);
  const most = Math.max(...solSt.rows.flatMap((x) => [x.left, x.right]), solSt.hasCharge ? Math.abs(solSt.chargeLeft) : 0);
  const lines = Math.min(3, Math.max(1, Math.ceil(most / perLine)));
  const rowH = Math.max(46 * k, lines * pitch + 16 * k);
  const gap = 8 * k;
  const headerY = 24 * f;
  const rowTop = headerY + 16 * f;
  const rows = st.rows.length + (st.hasCharge ? 1 : 0);
  return { W, narrow, k, headerY, rowTop, rowH, gap, lines, perLine, ballR, pitch, inner, badgeX, rows, H: Math.round(rowTop + rows * (rowH + gap) + 4) };
}

function AtomTable({ st, layout, f }: { st: BalanceState; layout: TableLayout; f: number }) {
  const { k, rowTop, rowH, gap, narrow } = layout;
  const cx = layout.W / 2;
  const order = st.rows.map((x) => x.symbol);
  return (
    <g>
      <Txt x={cx - layout.inner} y={layout.headerY} anchor="end" muted size={0.85}>
        {narrow ? 'Venstre' : 'Venstre side (reaktanter)'}
      </Txt>
      <Txt x={cx + layout.inner} y={layout.headerY} anchor="start" muted size={0.85}>
        {narrow ? 'Høyre' : 'Høyre side (produkter)'}
      </Txt>
      {st.rows.map((row, i) => {
        const y = rowTop + i * (rowH + gap);
        const c = atomColors(row.symbol);
        return (
          <Row
            key={row.symbol}
            y={y}
            layout={layout}
            ok={row.ok}
            index={order.indexOf(row.symbol) + 1}
            left={row.left}
            right={row.right}
            colors={{ fill: c.fill, line: c.line }}
            center={(cy) => (
              <g>
                <circle cx={cx} cy={cy} r={19 * k} fill={c.fill} stroke={c.line} strokeWidth={2} />
                <text
                  x={cx}
                  y={cy + 6.5 * k}
                  textAnchor="middle"
                  className="kj-atom-symbol"
                  style={{ fill: c.ink, fontSize: (row.symbol.length > 1 ? 15 : 18) * k }}
                >
                  {row.symbol}
                </text>
              </g>
            )}
          />
        );
      })}
      {st.hasCharge && (
        <Row
          y={rowTop + st.rows.length * (rowH + gap)}
          layout={layout}
          ok={st.chargeOk}
          index={st.rows.length + 1}
          left={st.chargeLeft}
          right={st.chargeRight}
          signed
          colors={{ fill: KJEMI.plus, line: KJEMI.plus, label: '+' }}
          center={(cy) => (
            <Txt x={cx} y={cy + 5 * f} size={0.75} weight={700}>
              ladning
            </Txt>
          )}
        />
      )}
    </g>
  );
}

/** Én rad i atomregnskapet: merke (rekkefølge eller hake), kuler og tall på hver side, symbol i midten. */
function Row({
  y,
  layout,
  ok,
  index,
  left,
  right,
  signed,
  center,
  colors,
}: {
  y: number;
  layout: TableLayout;
  ok: boolean;
  index: number;
  left: number;
  right: number;
  signed?: boolean;
  center: (cy: number) => ReactNode;
  colors: { fill: string; line: string; label?: string };
}) {
  const { k, rowH, badgeX } = layout;
  const cx = layout.W / 2;
  const cy = y + rowH / 2;
  const tone = ok ? OK : BAD;
  const num = (v: number) => (signed ? (v > 0 ? `+${fmt(v, 0)}` : fmt(v, 0)) : fmt(v, 0));
  return (
    <g>
      <rect
        x={6}
        y={y}
        width={layout.W - 12}
        height={rowH}
        rx={12}
        fill={ok ? OK : 'none'}
        fillOpacity={ok ? 0.12 : 0}
        stroke={tone}
        strokeOpacity={ok ? 0.9 : 0.45}
        strokeWidth={ok ? 2 : 1.5}
      />
      {ok ? (
        <g>
          <circle cx={badgeX} cy={cy} r={13 * k} fill={OK} />
          <path
            d={`M${badgeX - 6 * k},${cy} l${4.5 * k},${4.5 * k} l${8 * k},${-9 * k}`}
            fill="none"
            stroke={VIZ.surface}
            strokeWidth={2.8 * k}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </g>
      ) : (
        <g>
          <circle cx={badgeX} cy={cy} r={13 * k} fill="none" stroke={BAD} strokeWidth={1.8} />
          <text x={badgeX} y={cy + 5.5 * k} textAnchor="middle" style={{ fill: BAD, fontSize: 15 * k, fontWeight: 700 }}>
            {index}
          </text>
        </g>
      )}
      {center(cy)}
      <Txt x={cx - (signed ? 48 : 30) * k} y={cy + 7 * k} anchor="end" size={1.15} weight={700} color={tone}>
        {num(left)}
      </Txt>
      <Txt x={cx + (signed ? 48 : 30) * k} y={cy + 7 * k} anchor="start" size={1.15} weight={700} color={tone}>
        {num(right)}
      </Txt>
      <Balls n={Math.abs(left)} dir={-1} cy={cy} layout={layout} colors={colors} />
      <Balls n={Math.abs(right)} dir={1} cy={cy} layout={layout} colors={colors} />
    </g>
  );
}

function Balls({
  n,
  dir,
  cy,
  layout,
  colors,
}: {
  n: number;
  dir: 1 | -1;
  cy: number;
  layout: TableLayout;
  colors: { fill: string; line: string; label?: string };
}) {
  const { perLine, lines, pitch, ballR, inner } = layout;
  const cap = perLine * lines;
  const count = Math.max(0, Math.round(n));
  const shown = count > cap ? cap - 1 : count;
  const usedLines = Math.min(lines, Math.max(1, Math.ceil((count > cap ? cap : count) / perLine)));
  const y0 = cy - ((usedLines - 1) * pitch) / 2;
  const pos = (i: number) => ({ x: layout.W / 2 + dir * (inner + (i % perLine) * pitch + ballR), y: y0 + Math.floor(i / perLine) * pitch });
  const balls: ReactNode[] = [];
  for (let i = 0; i < shown; i++) {
    const p = pos(i);
    balls.push(
      <g key={i}>
        <circle cx={p.x} cy={p.y} r={ballR} fill={colors.fill} stroke={colors.line} strokeWidth={1.4} />
        {colors.label && (
          <text x={p.x} y={p.y + ballR * 0.45} textAnchor="middle" style={{ fill: VIZ.surface, fontSize: ballR * 1.5, fontWeight: 700 }}>
            {colors.label}
          </text>
        )}
      </g>,
    );
  }
  if (count > cap) {
    const p = pos(cap - 1);
    balls.push(
      <Txt key="mer" x={p.x} y={p.y + 5 * layout.k} size={0.7} weight={700} muted>
        +{count - shown}
      </Txt>,
    );
  }
  return <g>{balls}</g>;
}

/* ---------- Forklaring ---------- */

const atomWord = (n: number, sym: string) => `${fmt(n, 0)} ${sym}-atom${n === 1 ? '' : 'er'}`;

function list(items: ReactNode[]): ReactNode {
  return items.map((it, i) => (
    <span key={i}>
      {i > 0 && (i === items.length - 1 ? ' og ' : ', ')}
      {it}
    </span>
  ));
}

function explanation(r: BalanceReaction, coefs: number[], st: BalanceState, sol: number[], revealed: boolean): ReactNode {
  const order = balanceOrder(r);
  const all = [...r.reactants, ...r.products];
  let status: ReactNode;
  if (st.balanced && st.divisor === 1) {
    const n = r.reactants.length;
    const mol = (i: number) => (
      <span key={i}>
        {coefs[i] ?? 1} mol <Formel f={all[i]!} state={false} />
      </span>
    );
    status = (
      <p>
        <strong>{revealed ? 'Slik blir likningen balansert.' : 'Likningen er balansert.'}</strong> Det er like mange atomer av hvert grunnstoff på begge sider
        {st.hasCharge ? ', og ladningen er den samme' : ''}. Atomer blir verken borte eller laget i en kjemisk reaksjon, de bare bytter partner, og derfor er
        massen bevart: {fmt(st.massLeft, 2)} g reaktanter gir {fmt(st.massRight, 2)} g produkter når koeffisientene leses som mol. Koeffisientene gir forholdet
        mellom stoffmengdene: {mol(0)} reagerer med {list(r.reactants.slice(1).map((_, j) => mol(j + 1)))} og gir {list(r.products.map((_, j) => mol(n + j)))}.
      </p>
    );
  } else if (st.balanced) {
    status = (
      <p>
        <strong>Balansert, men ikke forkortet.</strong> Alle koeffisientene kan deles på {st.divisor}. Vi skriver alltid de minste hele tallene:{' '}
        <Reaksjon r={withCoefficients(r, sol)} states={false} />.
      </p>
    );
  } else if (st.next === 'ladning') {
    status = (
      <p>
        <strong>Atomene stemmer, men ladningen gjør ikke det.</strong> Summen av ladningene er {signed(st.chargeLeft)} til venstre og {signed(st.chargeRight)}{' '}
        til høyre. Hvert kobberatom gir fra seg to elektroner, men hvert sølvion tar bare imot ett, så det trengs to sølvioner per kobberatom.
      </p>
    );
  } else {
    const row = st.rows.find((x) => x.symbol === st.next)!;
    const hint = hintFor(r, coefs, row.symbol);
    status = (
      <p>
        <strong>Ikke balansert ennå.</strong> Det er {atomWord(row.left, row.symbol)} til venstre og {atomWord(row.right, row.symbol)} til høyre.
        {hint && (
          <>
            {' '}
            Det mangler {row.symbol} på {hint.side === 'left' ? 'venstre' : 'høyre'} side, så øk koeffisienten foran{' '}
            {list(hint.species.map((s) => <Formel key={s} f={s} state={false} />))}
            {hint.species.length > 1 ? ' (ett av stoffene)' : ''}.
          </>
        )}
      </p>
    );
  }
  return (
    <>
      {status}
      <p>
        Metoden: Ta ett grunnstoff om gangen, i rekkefølgen i tabellen (her{' '}
        {order.map((s, i) => (
          <span key={s}>
            {i > 0 && ' → '}
            <strong>{s}</strong>
          </span>
        ))}
        ). Begynn med grunnstoffene som er bundet i forbindelser og finnes i færrest stoffer, og ta H og O etter dem fordi de ofte finnes i flere stoffer.
        Grunnstoffer som står alene, som <Formel f="O2" /> eller <Formel f="Fe" />, venter du med til slutt: koeffisienten foran dem endrer ikke noe annet
        grunnstoff. Du kan bare endre koeffisientene, aldri de små tallene i formlene: <Formel f="H2O2" /> er et helt annet stoff enn <Formel f="H2O" />.
      </p>
      <p>{r.about}</p>
    </>
  );
}

const signed = (v: number) => (v > 0 ? `+${fmt(v, 0)}` : fmt(v, 0));
