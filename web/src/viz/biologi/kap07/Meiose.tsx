import { useState, type ReactNode } from 'react';
import {
  Arrow,
  BIO,
  Controls,
  Delingsfigur,
  Explain,
  Figure,
  Formula,
  FormulaLine,
  Kromatide,
  Kromosom,
  Legend,
  PAIR_SHAPES,
  PlayBar,
  Readout,
  Readouts,
  Segmented,
  Slider,
  Sup,
  Toggle,
  Toolbar,
  Txt,
  VIZ,
  VizLayout,
  fmt,
  fmtCount,
  layoutPhase,
  useContainerTextScale,
  useLineScale,
  type DivisionLayout,
  type Opphav,
  type Segment,
} from '../kit';
import { Callouts, sceneFrame, useStepClock, type Callout } from './felles';
import {
  HUMAN_N,
  MEIOSIS,
  allCombinations,
  combinations,
  distinctGametes,
  meiosisGametes,
  randomGametes,
  randomOrientation,
  recombinantSegments,
  zygoteCombinations,
  type GameteChromatid,
  type MeiosisStep,
} from './model';

const STAGE_SECONDS = 2.4;
/** Fasen som vises når siden åpnes (metafase I). */
const INITIAL_STEP = 2;
const DEFAULT_ORIENTATION = [true, false, true] as const;
const RANDOM_COUNT = 10;

export default function Meiose() {
  const [n, setN] = useState<2 | 3>(2);
  const [crossing, setCrossing] = useState(true);
  const [seed, setSeed] = useState(0);
  const { clock, step, goTo } = useStepClock(MEIOSIS.length, STAGE_SECONDS, INITIAL_STEP);
  const info = MEIOSIS[step]!;
  const orientation = seed === 0 ? [...DEFAULT_ORIENTATION].slice(0, n) : randomOrientation(n, seed);
  const gametes = meiosisGametes(n, orientation, crossing);
  const random = randomGametes(n, crossing, RANDOM_COUNT, seed + 1);
  const [ref, f] = useContainerTextScale<HTMLDivElement>();
  const combos = combinations(n);
  const perCell = info.ploidy === '2n' ? 2 * n : n;
  const cellsNow = info.fase === 'telofase' ? info.cells : info.deling === 'meiose2' ? 2 : 1;

  const reshuffle = () => {
    // Ny tilfeldig orientering i metafase I som er forskjellig fra den som vises nå
    let s = seed + 1;
    const now = orientation.join();
    while (s < seed + 40 && randomOrientation(n, s).join() === now) s++;
    setSeed(s);
  };

  return (
    <VizLayout>
      <Toolbar>
        <Segmented
          label="Antall kromosomer"
          options={[
            { value: '2', label: '2n = 4' },
            { value: '3', label: '2n = 6' },
          ]}
          value={String(n) as '2' | '3'}
          onChange={(v) => setN(v === '3' ? 3 : 2)}
        />
        <Toggle label="Overkrysning" checked={crossing} onChange={setCrossing} />
        <button type="button" className="btn btn-sm" onClick={reshuffle}>
          Ny tilfeldig fordeling
        </button>
      </Toolbar>
      <Controls>
        <Slider
          label="Fase"
          value={step}
          onChange={goTo}
          min={0}
          max={MEIOSIS.length - 1}
          step={1}
          format={(v) => MEIOSIS[v]?.name ?? ''}
        />
      </Controls>
      <Toolbar>
        <PlayBar clock={clock} time={info.deling === 'meiose1' ? 'Meiose I' : 'Meiose II'} />
      </Toolbar>

      <div ref={ref}>
        <MeiosisScene id={info.id} n={n} crossing={crossing} orientation={orientation} f={f} />
      </div>
      <Legend
        items={[
          { color: BIO.kromosom.mor[0], label: 'Kromosom fra mor' },
          { color: BIO.kromosom.far[0], label: 'Kromosom fra far (samme farge = homologt par)' },
          { color: BIO.cytoskjelett, label: 'Spoletråder' },
        ]}
      />

      <Readouts>
        <Readout label="Fase" value={info.name} />
        <Readout label="Antall celler" value={String(cellsNow)} />
        <Readout label="Kromosomer per celle" value={String(perCell)} unit={info.ploidy === '2n' ? '(2n, diploid)' : '(n, haploid)'} />
        <Readout
          label={
            <>
              Mulige kombinasjoner 2<Sup>n</Sup>
            </>
          }
          value={String(combos)}
          unit={`(n = ${n})`}
        />
      </Readouts>

      <GameteFigure n={n} crossing={crossing} gametes={gametes} random={random} />
      <ComparisonFigure n={n} crossing={crossing} orientation={orientation} gametes={gametes} />

      <Formula label="Uavhengig fordeling">
        <FormulaLine>
          Med n = {n} kromosompar: 2<Sup>{n}</Sup> = {combos} mulige kjønnsceller (uten overkrysning)
        </FormulaLine>
        <FormulaLine>
          Mennesket, n = {HUMAN_N}: 2<Sup>{HUMAN_N}</Sup> = {fmtCount(combinations(HUMAN_N))} ≈ {fmt(combinations(HUMAN_N) / 1e6, 1)}{' '}
          millioner
        </FormulaLine>
        <FormulaLine>
          Et barn av to foreldre: 2<Sup>{HUMAN_N}</Sup> · 2<Sup>{HUMAN_N}</Sup> ≈ {fmt(zygoteCombinations(HUMAN_N) / 1e12, 0)} billioner
          kombinasjoner (før overkrysning)
        </FormulaLine>
      </Formula>

      <Explain>{explanation(info.id, n, crossing, combos, distinctGametes(random))}</Explain>
    </VizLayout>
  );
}

/* ====================================================================== */
/* Hovedfiguren                                                             */
/* ====================================================================== */

function MeiosisScene({
  id,
  n,
  crossing,
  orientation,
  f,
}: {
  id: MeiosisStep;
  n: 2 | 3;
  crossing: boolean;
  orientation: boolean[];
  f: number;
}) {
  const info = MEIOSIS.find((m) => m.id === id)!;
  const two = info.deling === 'meiose2';
  const frame = sceneFrame(f, { desktopH: two ? 360 : 380, aspect: two ? 2.1 : 1.35, k: two ? 1.15 : 1.35, bands: two });
  const opts = { deling: info.deling, fase: info.fase, n, box: frame.inner, overkrysning: crossing, orientering: orientation };
  const lay = layoutPhase(opts);
  const callouts = meiosisCallouts(id, lay, crossing).map((c) => ({ ...c, ...frame.map(c) }));
  return (
    <Figure
      viewBox={`0 0 800 ${frame.H}`}
      maxHeight={f > 1.3 ? 900 : Math.round(frame.H * 1.15)}
      label={`${info.name} med 2n = ${2 * n}${crossing ? ', med overkrysning' : ''}.`}
    >
      <g transform={frame.transform || undefined}>
        <Delingsfigur {...opts} />
      </g>
      <Callouts items={callouts} box={frame.box} bands={frame.bands} />
    </Figure>
  );
}

function meiosisCallouts(id: MeiosisStep, lay: DivisionLayout, crossing: boolean): Callout[] {
  const out: Callout[] = [];
  const push = (c: Callout | null | undefined) => {
    if (c) out.push(c);
  };
  const nuc = lay.kjerner[0];
  const cell0 = lay.celler[0];
  const lastCell = lay.celler[lay.celler.length - 1];
  const spindleFibre = (): Callout | null => {
    const s = lay.spoler[lay.spoler.length - 1];
    if (!s) return null;
    const right = s.poler[1];
    const fb = s.fibre.filter(([a]) => a.x === right.x).sort((p, q) => p[1].y - q[1].y)[0];
    return fb ? { x: (fb[0].x + fb[1].x) / 2, y: (fb[0].y + fb[1].y) / 2, text: 'Spoletråder' } : null;
  };
  // Punktet der overkrysningen skjedde: på en rekombinant kromatide, ved grensen til stykket fra den andre forelderen
  const crossPoint = (): Callout | null => {
    const k = lay.kromatider.find((c) => c.segmenter.length > 0);
    const seg = k?.segmenter[0];
    if (!k || !seg) return null;
    const d = (seg.fra - k.sentromer) * k.lengde;
    const a = (k.rot * Math.PI) / 180;
    return { x: k.x - Math.sin(a) * d, y: k.y + Math.cos(a) * d, text: ['Overkrysning:', 'byttet stykker'], strong: true };
  };
  switch (id) {
    case 'interfase':
      if (nuc) push({ x: nuc.cx - nuc.rx * 0.77, y: nuc.cy - nuc.ry * 0.64, text: 'Kjernemembran' });
      push(
        lay.kromatider[0] && { x: lay.kromatider[0].x, y: lay.kromatider[0].y, text: ['Kromatin', '(ikke kopiert ennå)'], strong: true },
      );
      push(cell0 && { x: cell0.cx + cell0.rx * 0.82, y: cell0.cy - cell0.ry * 0.57, text: 'Cellemembran' });
      break;
    case 'profase1': {
      const s = [...lay.sentromerer].sort((a, b) => a.x - b.x)[0];
      push(s && { x: s.x, y: s.y, text: ['Homologt par:', 'fire kromatider'], strong: !crossing });
      if (crossing) push(crossPoint());
      if (nuc) push({ x: nuc.cx + nuc.rx * 0.8, y: nuc.cy + nuc.ry * 0.6, text: ['Kjernemembranen', 'løses opp'] });
      break;
    }
    case 'metafase1': {
      const e = lay.ekvatorplan[0];
      push(e && { x: e.x, y: e.y0 + 6, text: ['Homologe par', 'i ekvatorplanet'], strong: true });
      push(spindleFibre());
      const s = [...lay.sentromerer].sort((a, b) => b.y - a.y)[0];
      push(s && { x: s.x, y: s.y, text: 'Sentromer' });
      break;
    }
    case 'anafase1': {
      const s = [...lay.sentromerer].sort((a, b) => a.y - b.y)[0];
      push(s && { x: s.x, y: s.y, text: ['Homologe kromosomer', 'skilles'], strong: true });
      const t = [...lay.sentromerer].sort((a, b) => b.y - a.y)[0];
      push(t && { x: t.x, y: t.y, text: ['Søsterkromatidene', 'henger sammen'] });
      push(spindleFibre());
      break;
    }
    case 'telofase1': {
      const k0 = lay.kjerner[0];
      const k1 = lay.kjerner[1];
      push(k0 && { x: k0.cx - k0.rx * 0.7, y: k0.cy + k0.ry * 0.7, text: ['Haploid celle', '(n kromosomer)'], strong: true });
      push(k1 && { x: k1.cx + k1.rx * 0.7, y: k1.cy - k1.ry * 0.7, text: 'Ny kjernemembran' });
      break;
    }
    case 'profase2':
      push(cell0 && { x: cell0.cx - cell0.rx * 0.6, y: cell0.cy - cell0.ry * 0.75, text: ['Ingen ny kopiering', 'av DNA'], strong: true });
      push(lastCell && { x: lastCell.cx + lastCell.rx * 0.5, y: lastCell.cy + lastCell.ry * 0.82, text: 'To haploide celler' });
      break;
    case 'metafase2': {
      const e = lay.ekvatorplan[0];
      push(e && { x: e.x, y: e.y0 + 4, text: 'Ekvatorplanet', strong: true });
      push(spindleFibre());
      break;
    }
    case 'anafase2': {
      const k = [...lay.kromatider].sort((a, b) => a.y - b.y)[0];
      push(k && { x: k.x, y: k.y, text: ['Søsterkromatidene', 'skilles'], strong: true });
      push(spindleFibre());
      break;
    }
    case 'telofase2': {
      push(cell0 && { x: cell0.cx - cell0.rx * 0.6, y: cell0.cy + cell0.ry * 0.8, text: ['Fire haploide', 'kjønnsceller'], strong: true });
      push(
        lastCell && {
          x: lastCell.cx + lastCell.rx * 0.6,
          y: lastCell.cy - lastCell.ry * 0.8,
          text: crossing ? 'Alle er ulike' : 'Like to og to',
        },
      );
      break;
    }
  }
  return out;
}

/* ====================================================================== */
/* Små celler med kromosomer                                                */
/* ====================================================================== */

interface MiniProps {
  x: number;
  y: number;
  r: number;
  /** Én kromatide per kromosom (kjønnsceller og celler i G1). */
  chromatids?: readonly GameteChromatid[];
  /** Kopierte kromosomer med to søsterkromatider (cellene etter meiose I). */
  replicated?: readonly { par: number; opphav: Opphav; segmenter: [Segment[], Segment[]] }[];
  ring?: boolean;
  label?: ReactNode;
}

/** En liten, rund celle med kromosomene på rekke (til oversiktsfigurene). */
function MiniCelle({ x, y, r, chromatids = [], replicated = [], ring, label }: MiniProps) {
  const lw = useLineScale();
  const count = chromatids.length + replicated.length;
  const L = r * 1.08;
  const W = Math.max(5, r * 0.17);
  const step = replicated.length ? W * 3.2 : W * 2;
  return (
    <g>
      {ring && <circle cx={x} cy={y} r={r + 6} fill="none" stroke={VIZ.ink} strokeWidth={2.2 * lw} />}
      <circle cx={x} cy={y} r={r} fill={BIO.cytoplasma} stroke={BIO.membran} strokeWidth={2.4 * lw} />
      {chromatids.map((c, i) => {
        const s = PAIR_SHAPES[c.par]!;
        return (
          <Kromatide
            key={`${c.par}-${c.opphav}-${i}`}
            x={x + (i - (count - 1) / 2) * step}
            y={y + (s.sentromer - 0.5) * s.lengde * L * 0.9}
            lengde={s.lengde * L}
            bredde={W}
            sentromer={s.sentromer}
            par={c.par}
            opphav={c.opphav}
            segmenter={recombinantSegments(c)}
          />
        );
      })}
      {replicated.map((c, i) => {
        const s = PAIR_SHAPES[c.par]!;
        return (
          <Kromosom
            key={`${c.par}-${c.opphav}`}
            x={x + (i - (count - 1) / 2) * step}
            y={y + (s.sentromer - 0.5) * s.lengde * L * 0.9}
            lengde={s.lengde * L}
            bredde={W}
            sentromer={s.sentromer}
            par={c.par}
            opphav={c.opphav}
            segmenter={c.segmenter}
            splay={5}
          />
        );
      })}
      {label !== undefined && (
        <Txt x={x} y={y + r + 22} size={0.75} muted>
          {label}
        </Txt>
      )}
    </g>
  );
}

const fullSet = (n: number): GameteChromatid[] =>
  Array.from({ length: n }, (_, par) => [
    { par, opphav: 'mor' as const, rekombinant: false },
    { par, opphav: 'far' as const, rekombinant: false },
  ]).flat();

/* ====================================================================== */
/* Kjønnscellene: alle kombinasjoner og noen tilfeldige                     */
/* ====================================================================== */

function GameteFigure({
  n,
  crossing,
  gametes,
  random,
}: {
  n: number;
  crossing: boolean;
  gametes: GameteChromatid[][];
  random: GameteChromatid[][];
}) {
  const [ref, f] = useContainerTextScale<HTMLDivElement>();
  const narrow = f > 1.3;
  const k = Math.max(1, f * 0.85);
  const all = allCombinations(n);
  const made = new Set(gametes.map((g) => g.map((c) => c.opphav).join()));
  const perRowA = narrow ? 4 : 8;
  const perRowB = narrow ? 5 : 10;
  const r = (narrow ? 30 : 28) * (narrow ? k / 1.25 : 1);
  const cellH = 2 * r + 34;
  const head = 30 * f;
  const rowsA = Math.ceil(all.length / perRowA);
  const rowsB = Math.ceil(random.length / perRowB);
  const yA = head + 12;
  const yB = yA + rowsA * cellH + head + 16;
  const H = Math.round(yB + rowsB * cellH + 8);
  const place = (i: number, perRow: number, total: number, y0: number) => {
    const row = Math.floor(i / perRow);
    const inRow = Math.min(perRow, total - row * perRow);
    const span = 760 / perRow;
    return { x: 400 + (i - row * perRow - (inRow - 1) / 2) * span, y: y0 + row * cellH + r + 8 };
  };
  const distinct = distinctGametes(random);
  return (
    <div ref={ref}>
      <Figure
        viewBox={`0 0 800 ${H}`}
        maxHeight={narrow ? 1000 : Math.round(H * 1.15)}
        label={`De ${all.length} mulige kombinasjonene av kromosomer i en kjønnscelle, og ${random.length} tilfeldige kjønnsceller.`}
        caption={
          crossing
            ? 'Kromatider med to farger har fått et stykke fra det andre kromosomet i paret ved overkrysning. I virkeligheten kan overkrysningen skje mange steder, så variasjonen blir enda større.'
            : 'Uten overkrysning finnes bare disse kombinasjonene.'
        }
      >
        <Txt x={20} y={head - 4} anchor="start" weight={650} size={0.95}>
          {`Alle 2${n === 2 ? '²' : '³'} = ${all.length} kombinasjoner (uten overkrysning)`}
        </Txt>
        {all.map((g, i) => {
          const p = place(i, perRowA, all.length, yA);
          return <MiniCelle key={i} x={p.x} y={p.y} r={r} chromatids={g} ring={made.has(g.map((c) => c.opphav).join())} />;
        })}
        <Txt x={20} y={yB - 14} anchor="start" weight={650} size={0.95}>
          {`${random.length} tilfeldige kjønnsceller: ${distinct} ulike`}
        </Txt>
        {random.map((g, i) => {
          const p = place(i, perRowB, random.length, yB);
          return <MiniCelle key={i} x={p.x} y={p.y} r={r} chromatids={g} />;
        })}
      </Figure>
      <Legend items={[{ color: VIZ.ink, label: 'Ring: dannes i meiosen over (med denne fordelingen)' }]} />
    </div>
  );
}

/* ====================================================================== */
/* Sammenligning med mitosen                                                */
/* ====================================================================== */

function ComparisonFigure({
  n,
  crossing,
  orientation,
  gametes,
}: {
  n: number;
  crossing: boolean;
  orientation: boolean[];
  gametes: GameteChromatid[][];
}) {
  const [ref, f] = useContainerTextScale<HTMLDivElement>();
  const narrow = f > 1.3;
  const k = Math.max(1, f * 0.85);
  const r = narrow ? 30 * Math.min(1.4, k) : 32;
  const lh = 21 * f;
  const rowGap = 2 * r + 40;
  // Én kolonne per deling på PC, under hverandre på mobil
  const colW = narrow ? 800 : 400;
  const blockH = 34 * f + 3 * rowGap + 3 * lh + 10;
  const H = Math.round(narrow ? 2 * blockH : blockH);
  const set = fullSet(n);
  // Cellene etter meiose I: kopierte kromosomer, med overkrysning på mors kromatide b og fars kromatide a
  const afterMI = [0, 1].map((side) =>
    Array.from({ length: n }, (_, par) => {
      const morLeft = orientation[par] ?? par % 2 === 0;
      const opphav: Opphav = (side === 0) === morLeft ? 'mor' : 'far';
      const other: Opphav = opphav === 'mor' ? 'far' : 'mor';
      const at = PAIR_SHAPES[par]!.overkrysning;
      const seg: Segment[] = crossing ? [{ fra: at, til: 1, opphav: other }] : [];
      const segmenter: [Segment[], Segment[]] = opphav === 'mor' ? [[], seg] : [seg, []];
      return { par, opphav, segmenter };
    }),
  );
  const column = (kind: 'mitose' | 'meiose', x0: number, y0: number) => {
    const cx = x0 + colW / 2;
    const y1 = y0 + 34 * f + r + 6;
    const y2 = y1 + rowGap;
    const y3 = y2 + rowGap;
    const dxs = narrow ? 170 : 95;
    const arrow = (xa: number, ya: number, xb: number, yb: number) => {
      const len = Math.hypot(xb - xa, yb - ya);
      const ux = (xb - xa) / len;
      const uy = (yb - ya) / len;
      return (
        <Arrow
          x1={xa + ux * (r + 6)}
          y1={ya + uy * (r + 6)}
          x2={xb - ux * (r + 10)}
          y2={yb - uy * (r + 10)}
          color={VIZ.muted}
          width={2}
          head={8}
        />
      );
    };
    const textY = (kind === 'mitose' ? y2 : y3) + r + 26 * f;
    const rows =
      kind === 'mitose'
        ? ['1 deling', `2 datterceller med 2n = ${2 * n}`, 'Genetisk like morcella']
        : ['2 delinger', `4 kjønnsceller med n = ${n}`, crossing ? 'Alle genetisk ulike' : 'Genetisk ulike morcella'];
    return (
      <g>
        <Txt x={cx} y={y0 + 24 * f} weight={700} size={1.05}>
          {kind === 'mitose' ? 'Mitose' : 'Meiose'}
        </Txt>
        <MiniCelle x={cx} y={y1} r={r} chromatids={set} />
        {kind === 'mitose' ? (
          <g>
            {arrow(cx, y1, cx - dxs * 0.8, y2)}
            {arrow(cx, y1, cx + dxs * 0.8, y2)}
            <MiniCelle x={cx - dxs * 0.8} y={y2} r={r} chromatids={set} />
            <MiniCelle x={cx + dxs * 0.8} y={y2} r={r} chromatids={set} />
          </g>
        ) : (
          <g>
            {arrow(cx, y1, cx - dxs, y2)}
            {arrow(cx, y1, cx + dxs, y2)}
            <MiniCelle x={cx - dxs} y={y2} r={r} replicated={afterMI[0]} />
            <MiniCelle x={cx + dxs} y={y2} r={r} replicated={afterMI[1]} />
            {gametes.map((g, i) => {
              const parent = i < 2 ? cx - dxs : cx + dxs;
              const gx = parent + (i % 2 === 0 ? -1 : 1) * dxs * 0.48;
              return (
                <g key={i}>
                  {arrow(parent, y2, gx, y3)}
                  <MiniCelle x={gx} y={y3} r={r * 0.85} chromatids={g} />
                </g>
              );
            })}
            <Txt x={cx} y={(y1 + y2) / 2 + 6} size={0.75} muted>
              meiose I
            </Txt>
            <Txt x={cx} y={(y2 + y3) / 2 + 6} size={0.75} muted>
              meiose II
            </Txt>
          </g>
        )}
        {rows.map((t, i) => (
          <Txt key={i} x={cx} y={textY + i * lh} size={0.85} weight={i === 2 ? 650 : 520}>
            {t}
          </Txt>
        ))}
      </g>
    );
  };
  return (
    <div ref={ref}>
      <Figure
        viewBox={`0 0 800 ${H}`}
        maxHeight={narrow ? 1400 : Math.round(H * 1.15)}
        label="Sammenligning av mitose og meiose: antall delinger, celler, kromosomtall og om cellene er like."
      >
        {column('mitose', 0, 0)}
        {!narrow && <line x1={400} x2={400} y1={10} y2={H - 10} stroke={VIZ.grid} strokeWidth={1.5} />}
        {column('meiose', narrow ? 0 : 400, narrow ? blockH : 0)}
      </Figure>
    </div>
  );
}

/* ====================================================================== */
/* Forklaring                                                               */
/* ====================================================================== */

function explanation(id: MeiosisStep, n: number, crossing: boolean, combos: number, distinct: number): ReactNode {
  const twoN = 2 * n;
  const variation = (
    <p>
      Med {n} kromosompar kan en kjønnscelle få 2<Sup>{n}</Sup> = {combos} ulike kombinasjoner av kromosomer fra mor og far (uavhengig
      fordeling). Mennesket har 23 par, som gir 2<Sup>23</Sup> ≈ 8,4 millioner kombinasjoner
      {crossing ? ', og overkrysningen gir langt flere' : ''}. Av de {RANDOM_COUNT} tilfeldige kjønnscellene over er {distinct} ulike.
      Derfor er søsken genetisk forskjellige (unntatt eneggede tvillinger).
    </p>
  );
  let main: ReactNode;
  switch (id) {
    case 'interfase':
      main = (
        <p>
          <strong>Interfase.</strong> Meiosen starter med en diploid celle (2n = {twoN}). Hvert kromosom har en partner med de samme genene,
          det homologe kromosomet: ett fra mor (varme farger) og ett fra far (kalde farger). Før meiosen kopieres DNA-et i S-fasen, akkurat
          som før mitosen.
        </p>
      );
      break;
    case 'profase1':
      main = (
        <p>
          <strong>Profase I.</strong> Kromosomene kondenserer, og de homologe kromosomene legger seg tett inntil hverandre i par, med fire
          kromatider i hvert par. Dette skjer ikke i mitosen.{' '}
          {crossing
            ? 'Her skjer overkrysningen: en kromatide fra mor og en fra far brekker på samme sted og bytter stykker, så de får gener fra begge foreldrene.'
            : 'Slå på overkrysning for å se kromatidene bytte stykker.'}
        </p>
      );
      break;
    case 'metafase1':
      main = (
        <p>
          <strong>Metafase I.</strong> De homologe parene stiller seg i ekvatorplanet to og to, ikke ett og ett som i mitosen. Om mors eller
          fars kromosom havner på venstre side, er tilfeldig og uavhengig for hvert par: <strong>uavhengig fordeling</strong>. Trykk «Ny
          tilfeldig fordeling» for å se en annen fordeling.
        </p>
      );
      break;
    case 'anafase1':
      main = (
        <p>
          <strong>Anafase I.</strong> De homologe kromosomene trekkes fra hverandre mot hver sin pol, men søsterkromatidene henger fortsatt
          sammen i sentromeret. Hver pol får ett kromosom fra hvert par, altså {n} kromosomer.
        </p>
      );
      break;
    case 'telofase1':
      main = (
        <p>
          <strong>Telofase I.</strong> Cella deles i to. Hver dattercelle har bare ett kromosom fra hvert par (n = {n}) og er{' '}
          <strong>haploid</strong>, selv om hvert kromosom fortsatt har to kromatider. Det er i meiose I at kromosomtallet halveres.
        </p>
      );
      break;
    case 'profase2':
      main = (
        <p>
          <strong>Profase II.</strong> Mellom meiose I og meiose II blir DNA-et ikke kopiert på nytt. Kromosomene kondenserer igjen, og nye
          spoletråder dannes i begge cellene.
        </p>
      );
      break;
    case 'metafase2':
      main = (
        <p>
          <strong>Metafase II.</strong> I hver celle stiller kromosomene seg på rekke i ekvatorplanet, ett og ett, slik som i mitosen.
        </p>
      );
      break;
    case 'anafase2':
      main = (
        <p>
          <strong>Anafase II.</strong> Sentromerene deler seg, og søsterkromatidene trekkes mot hver sin pol.{' '}
          {crossing
            ? 'Etter overkrysningen er søsterkromatidene ikke lenger helt like, så de fire cellene blir forskjellige.'
            : 'Uten overkrysning er søsterkromatidene like, så cellene fra samme celle i meiose I blir like.'}
        </p>
      );
      break;
    case 'telofase2':
      main = (
        <p>
          <strong>Telofase II.</strong> Resultatet er fire haploide celler med {n} kromosomer hver. Hos dyr blir de til kjønnsceller (egg
          eller sædceller), og ved befruktningen får det befruktede egget igjen 2n = {twoN}.{' '}
          {crossing ? 'Alle fire er genetisk ulike.' : 'Cellene er like to og to, men ulike morcella.'}
        </p>
      );
      break;
  }
  return (
    <>
      {main}
      {variation}
    </>
  );
}
