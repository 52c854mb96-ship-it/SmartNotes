import { useState, type ReactNode } from 'react';
import {
  Arrow,
  BIO,
  Controls,
  Explain,
  Figure,
  Formula,
  FormulaLine,
  Legend,
  Plot,
  Readout,
  Readouts,
  Segmented,
  Slider,
  Sup,
  Toggle,
  Toolbar,
  Tre,
  Txt,
  VIZ,
  VizLayout,
  blobPath,
  fmt,
  fmtPct,
  linePath,
  sample,
  useContainerTextScale,
} from '../kit';
import {
  EDGE_WIDTH,
  FOREST_AREA,
  FOREST_SPECIES_COUNT,
  ISLAND_C0,
  ISLAND_D0,
  PATCH_LAYOUTS,
  cOfDistance,
  factorPerTenfold,
  fragmentation,
  keptWhenHalved,
  speciesArea,
  type Fragmentation,
} from './model';

type Mode = 'oyer' | 'oppstykking';

const COL = BIO.serie[0];
const REF = VIZ.muted;
const DOT_COLORS = [BIO.serie[0], BIO.serie[1], BIO.serie[2], BIO.serie[3], BIO.signal, BIO.kalium];

/** Areal i km² med passe mange desimaler: 0,01 · 0,5 · 3,2 · 250 · 10 000. */
export function fmtArea(A: number): string {
  if (A < 0.995) return fmt(A, A < 0.1 ? 2 : 1);
  if (A < 9.95) return fmt(A, 1);
  return fmt(A, 0);
}

export default function ArterOgAreal() {
  const [mode, setMode] = useState<Mode>('oyer');
  const [z, setZ] = useState(0.25);
  return (
    <VizLayout>
      <Toolbar>
        <Segmented
          label="Velg situasjon"
          options={[
            { value: 'oyer', label: 'Øyer' },
            { value: 'oppstykking', label: 'Oppstykking av skog' },
          ]}
          value={mode}
          onChange={setMode}
        />
      </Toolbar>
      {mode === 'oyer' ? <Oyer z={z} setZ={setZ} /> : <Oppstykking z={z} setZ={setZ} />}
    </VizLayout>
  );
}

function ZSlider({ z, setZ }: { z: number; setZ: (z: number) => void }) {
  return <Slider label="Eksponenten z" value={z} onChange={setZ} min={0.2} max={0.35} step={0.01} decimals={2} />;
}

/* ====================================================================== */
/* Øyer                                                                     */
/* ====================================================================== */

function Oyer({ z, setZ }: { z: number; setZ: (z: number) => void }) {
  const [logA, setLogA] = useState(2);
  const [d, setD] = useState(20);
  const A = 10 ** logA;
  const c = cOfDistance(d);
  const S = speciesArea(c, A, z);
  const [ref, f] = useContainerTextScale<HTMLDivElement>();
  const plotH = Math.round(340 + 260 * (f - 1));

  return (
    <>
      <Controls>
        <Slider label="Areal A" value={logA} onChange={setLogA} min={-2} max={4} step={0.1} format={(v) => `${fmtArea(10 ** v)} km²`} />
        <Slider label="Avstand til fastlandet d" value={d} onChange={setD} min={0} max={500} step={10} unit="km" />
        <ZSlider z={z} setZ={setZ} />
      </Controls>

      <div ref={ref}>
        <IslandScene A={A} d={d} S={S} c={c} f={f} />
      </div>
      <Legend
        items={[
          { color: BIO.serie[2], label: 'Hver prikk er omtrent 10 arter' },
          { color: COL, label: 'Innvandring fra fastlandet (tykkere pil = flere nye arter)' },
        ]}
      />

      <Figure
        viewBox={`0 0 800 ${plotH}`}
        label={`Arter mot areal med logaritmiske akser. Øya på ${fmtArea(A)} km² har ca. ${fmt(S, 0)} arter.`}
      >
        <LogLogPlot A={A} S={S} c={c} z={z} d={d} height={plotH} />
      </Figure>
      <Legend
        items={[
          { color: COL, label: `Øyer ${fmt(d, 0)} km fra fastlandet` },
          { color: REF, label: 'Øyer rett ved fastlandet', dashed: true },
        ]}
      />

      <Readouts>
        <Readout label="Arter på øya S" value={fmt(S, 0)} tone={COL} />
        <Readout label="c (arter på 1 km²)" value={fmt(c, 1)} />
        <Readout label="10 × større areal gir" value={`× ${fmt(factorPerTenfold(z), 2)}`} unit="arter" />
        <Readout label="Halvert areal beholder" value={fmtPct(keptWhenHalved(z))} unit="av artene" />
      </Readouts>

      <Formula label="Arter og areal">
        <FormulaLine>
          S = c · A<Sup>z</Sup> = {fmt(c, 1)} · {fmtArea(A)}
          <Sup>{fmt(z, 2)}</Sup> ≈ {fmt(S, 0)} arter
        </FormulaLine>
        <FormulaLine>
          c = {ISLAND_C0} · e<Sup>−d/{ISLAND_D0}</Sup> = {ISLAND_C0} · e<Sup>−{fmt(d, 0)}/{ISLAND_D0}</Sup> = {fmt(c, 1)}: færre arter når
          fram til øyer langt unna
        </FormulaLine>
        <FormulaLine>
          lg S = lg c + z · lg A: en rett linje med stigningstall z = {fmt(z, 2)} når begge aksene er logaritmiske
        </FormulaLine>
      </Formula>

      <Explain>{islandText(A, d, z, S)}</Explain>
    </>
  );
}

function IslandScene({ A, d, S, c, f }: { A: number; d: number; S: number; c: number; f: number }) {
  const k = Math.max(1, 0.85 * f);
  const H = Math.round(300 + 150 * (f - 1));
  const top = 34 * f;
  const cy = (top + H) / 2 + 6;
  const coast = 120;
  const R = (18 + (72 * (Math.log10(A) + 2)) / 6) * Math.min(k, 1.3);
  const xMin = coast + 60 + R;
  const xMax = 800 - 16 - R;
  const cx = xMin + (Math.min(d, 500) / 500) * (xMax - xMin);
  const island = blobPath(cx, cy, R, R * 0.82, 0.08, 7, 12);
  const nDots = Math.max(1, Math.round(S / 10));
  // Prikkene i et solsikkemønster: jevnt fordelt i en sirkel, alltid like
  const dots = Array.from({ length: nDots }, (_, i) => {
    const rr = R * 0.72 * Math.sqrt((i + 0.5) / nDots);
    const th = i * 2.39996;
    return { x: cx + rr * Math.cos(th), y: cy + rr * Math.sin(th) * 0.82 };
  });
  const dotR = Math.max(2, Math.min(5 * k, (R * 0.72) / Math.sqrt(nDots) / 1.6));
  const strength = c / ISLAND_C0;
  const arrowW = 2 + 7 * strength;
  const gap = Math.max(0, cx - R - coast - 24);
  return (
    <Figure
      viewBox={`0 0 800 ${H}`}
      maxHeight={H}
      label={`Øy på ${fmtArea(A)} km², ${fmt(d, 0)} km fra fastlandet, med ca. ${fmt(S, 0)} arter.`}
      caption="Ikke i målestokk: øya er tegnet større jo større arealet er, og lenger unna jo større avstanden er."
    >
      <rect x={0} y={top - 8} width={800} height={H - top + 8} rx={12} fill={BIO.vannFyll} />
      {/* Fastlandet med skog */}
      <path
        d={`M0,${top - 8} H${coast - 10} Q${coast + 12},${top + (H - top) * 0.25} ${coast - 4},${top + (H - top) * 0.5} Q${coast - 18},${top + (H - top) * 0.75} ${coast + 4},${H} H0 Z`}
        fill={BIO.plante.fill}
        stroke={BIO.plante.line}
        strokeWidth={1.5}
      />
      {[0.22, 0.42, 0.62, 0.82].map((v, i) => (
        <Tre key={v} x={i % 2 ? 72 : 40} y={top + (H - top) * v} size={30 * k} bartre={i % 2 === 0} />
      ))}
      <Txt x={10} y={top - 14} anchor="start" size={0.85} weight={650}>
        Fastland
      </Txt>
      {/* Innvandring */}
      {gap > 30 &&
        [-0.35, 0, 0.35].map((v) => (
          <Arrow
            key={v}
            x1={coast + 14}
            y1={cy + v * R * 1.1}
            x2={cx - R - 8}
            y2={cy + v * R * 0.5}
            color={COL}
            width={arrowW}
            head={10 + arrowW}
          />
        ))}
      {gap > 30 && (
        <Txt x={(coast + cx - R) / 2} y={cy - R * 0.55 - 14} size={0.8} color={COL} weight={650}>
          innvandring
        </Txt>
      )}
      {/* Avstand */}
      <line x1={coast + 4} x2={cx} y1={H - 14} y2={H - 14} stroke={VIZ.muted} strokeWidth={1.5} strokeDasharray="5 4" />
      <Txt x={(coast + cx) / 2} y={H - 22} size={0.8} muted>
        d = {fmt(d, 0)} km
      </Txt>
      {/* Øya */}
      <path d={island} fill={BIO.plante.fill} stroke={BIO.plante.line} strokeWidth={2} />
      {dots.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r={dotR} fill={DOT_COLORS[i % DOT_COLORS.length]} stroke={VIZ.surface} strokeWidth={0.8} />
      ))}
      <Txt x={Math.min(cx, 800 - 90 * f)} y={Math.max(top + 14 * f, cy - R * 0.82 - 10)} weight={700}>
        {fmtArea(A)} km², ca. {fmt(S, 0)} arter
      </Txt>
    </Figure>
  );
}

/** Tall på logaritmiske akser: 0,01 · 0,1 · 1 · 10 · 100 · 1 000 · 10 000. */
const logLabel = (e: number) => fmt(10 ** e, e < 0 ? -e : 0);

function LogLogPlot({ A, S, c, z, d, height }: { A: number; S: number; c: number; z: number; d: number; height: number }) {
  return (
    <Plot
      x={{ min: -2, max: 4, label: 'Areal A (km²), logaritmisk akse', ticks: [] }}
      y={{ min: 0, max: 3, label: 'Antall arter S, logaritmisk', ticks: [] }}
      width={800}
      height={height}
    >
      {({ sx, sy, x0, x1, y0, y1 }) => (
        <LogLogContent A={A} S={S} c={c} z={z} d={d} sx={sx} sy={sy} x0={x0} x1={x1} y0={y0} y1={y1} />
      )}
    </Plot>
  );
}

function LogLogContent({
  A,
  S,
  c,
  z,
  d,
  sx,
  sy,
  x0,
  x1,
  y0,
  y1,
}: {
  A: number;
  S: number;
  c: number;
  z: number;
  d: number;
  sx: (v: number) => number;
  sy: (v: number) => number;
  x0: number;
  x1: number;
  y0: number;
  y1: number;
}) {
  const [, f] = [0, 1];
  const lg = Math.log10;
  const line = (cc: number) => sample((e) => lg(Math.max(1e-9, speciesArea(cc, 10 ** e, z))), -2, 4, 60).filter(([, v]) => v >= 0 && v <= 3);
  const px = sx(lg(A));
  const py = sy(lg(Math.max(1, S)));
  // Trekant som viser 10 × areal → 10^z × arter
  const right = lg(A) + 1 <= 4;
  const ax = sx(lg(A) + (right ? 1 : -1));
  const ay = sy(lg(Math.max(1, S)) + (right ? z : -z));
  return (
    <g>
      {[-2, -1, 0, 1, 2, 3, 4].map((e) => (
        <g key={`x${e}`}>
          <line x1={sx(e)} x2={sx(e)} y1={y0} y2={y1} className="viz-gridline" />
          <text x={sx(e)} y={y0 + 22} textAnchor="middle" className="viz-tick">
            {logLabel(e)}
          </text>
        </g>
      ))}
      {[0, 1, 2, 3].map((e) => (
        <g key={`y${e}`}>
          <line x1={x0} x2={x1} y1={sy(e)} y2={sy(e)} className="viz-gridline" />
          <text x={x0 - 10} y={sy(e) + 5} textAnchor="end" className="viz-tick">
            {logLabel(e)}
          </text>
        </g>
      ))}
      <path d={linePath(line(ISLAND_C0), sx, sy)} fill="none" stroke={REF} strokeWidth={2} strokeDasharray="7 6" />
      <path d={linePath(line(c), sx, sy)} fill="none" stroke={COL} strokeWidth={3.5} />
      {S >= 1 && (
        <g>
          <path d={`M${px},${py} H${ax} V${ay}`} fill="none" stroke={VIZ.ink} strokeWidth={1.8} strokeDasharray="4 4" />
          <Txt x={(px + ax) / 2} y={py + (right ? 22 : -10) * f} size={0.75} muted>
            × 10 areal
          </Txt>
          <Txt x={ax + (right ? 8 : -8)} y={(py + ay) / 2 + 5} anchor={right ? 'start' : 'end'} size={0.75} muted>
            × {fmt(factorPerTenfold(z), 2)} arter
          </Txt>
          <circle cx={px} cy={py} r={8} fill={COL} stroke={VIZ.surface} strokeWidth={3} />
        </g>
      )}
      {d > 0 && (
        <Txt x={x1 - 8} y={sy(Math.min(3, lg(speciesArea(ISLAND_C0, 10 ** 4, z)))) + 22} anchor="end" size={0.75} muted>
          ved fastlandet
        </Txt>
      )}
    </g>
  );
}

function islandText(A: number, d: number, z: number, S: number): ReactNode {
  const small = A < 1;
  const far = d >= 200;
  return (
    <>
      <p>
        <strong>Større øyer har flere arter.</strong> Arts–areal-sammenhengen S = c · A<Sup>z</Sup> sier at artsantallet øker med arealet,
        men stadig langsommere: med z = {fmt(z, 2)} gir ti ganger større areal bare {fmt(factorPerTenfold(z), 2)} ganger så mange arter.
        Store øyer har flere leveområder (nisjer) og større bestander, som sjeldnere dør ut tilfeldig.{' '}
        {small ? `Øya på ${fmtArea(A)} km² har plass til få og små bestander, så mange arter dør ut igjen etter at de har kommet dit.` : ''}
      </p>
      <p>
        <strong>Øyer langt fra fastlandet har færre arter</strong>, fordi færre frø, sporer og dyr når fram (lavere innvandring).{' '}
        {d === 0
          ? 'Denne øya ligger rett ved fastlandet, så innvandringen er størst mulig.'
          : far
            ? `${fmt(d, 0)} km er langt: bare ${fmtPct(Math.exp(-d / ISLAND_D0))} så mange arter som ved fastlandet når fram, og øya har ca. ${fmt(S, 0)} arter.`
            : `Med ${fmt(d, 0)} km til fastlandet når ${fmtPct(Math.exp(-d / ISLAND_D0))} så mange arter fram som til en øy rett ved land.`}{' '}
        Dette er kjernen i øybiogeografien (MacArthur og Wilson, 1967): artsantallet på en øy er en balanse mellom innvandring og utdøing.
      </p>
      <p>
        Tallene er tenkte, men realistiske for karplanter. Målte verdier for z er ofte 0,2–0,35 for øyer og lavere for områder på
        fastlandet. Øyer trenger ikke være omgitt av vann: et skogholt i et jordbrukslandskap eller en fjelltopp er også en «øy».
      </p>
    </>
  );
}

/* ====================================================================== */
/* Oppstykking                                                              */
/* ====================================================================== */

function Oppstykking({ z, setZ }: { z: number; setZ: (z: number) => void }) {
  const [idx, setIdx] = useState(3);
  const [loss, setLoss] = useState(0.3);
  const [edge, setEdge] = useState(true);
  const layout = PATCH_LAYOUTS[idx]!;
  const r = fragmentation(layout.n, loss, z, edge);
  const [ref, f] = useContainerTextScale<HTMLDivElement>();
  const lost = r.before - r.species;
  const lostByLoss = r.before - r.speciesOnePiece;

  return (
    <>
      <Controls>
        <Slider
          label="Skogen deles i"
          value={idx}
          onChange={setIdx}
          min={0}
          max={PATCH_LAYOUTS.length - 1}
          step={1}
          format={(v) => {
            const n = PATCH_LAYOUTS[Math.round(v)]?.n ?? 1;
            return n === 1 ? 'ett stykke' : `${n} biter`;
          }}
        />
        <Slider
          label="Skog som hogges eller bygges ned"
          value={Math.round(loss * 100)}
          onChange={(v) => setLoss(v / 100)}
          min={0}
          max={80}
          step={5}
          unit="%"
        />
        <ZSlider z={z} setZ={setZ} />
      </Controls>
      <Toolbar>
        <Toggle label={`Kanteffekt (${fmt(EDGE_WIDTH * 1000, 0)} m inn i skogen)`} checked={edge} onChange={setEdge} />
      </Toolbar>

      <div ref={ref}>
        <FragmentScene r={r} rows={layout.rows} cols={layout.cols} edge={edge} f={f} z={z} loss={loss} />
      </div>
      <Legend
        items={[
          { color: BIO.plante.line, label: 'Indre skog' },
          ...(edge ? [{ color: BIO.sukker, label: 'Kantsone: mer lys, vind og tørke' }] : []),
          { color: BIO.ved, label: 'Hogstflate, vei eller bebyggelse' },
          { color: COL, label: 'Arter på sikt' },
          { color: REF, label: 'Samme skog i ett stykke', dashed: true },
        ]}
      />

      <Readouts>
        <Readout label="Arter før" value={fmt(r.before, 0)} />
        <Readout label="Arter på sikt" value={fmt(r.species, 0)} tone={COL} />
        <Readout label="Tapt" value={fmtPct(lost / r.before)} unit="av artene" />
        <Readout label="Areal per bit" value={fmtArea(r.patchArea)} unit="km²" />
      </Readouts>

      <Formula label="Arter i hver skogbit">
        <FormulaLine>
          Hele skogen: {FOREST_AREA} km² og {FOREST_SPECIES_COUNT} arter, så c = {FOREST_SPECIES_COUNT} / {FOREST_AREA}
          <Sup>{fmt(z, 2)}</Sup> = {fmt(FOREST_SPECIES_COUNT / FOREST_AREA ** z, 1)}
        </FormulaLine>
        <FormulaLine>
          Hver bit: {fmt(r.remaining, 0)} km² / {layout.n} = {fmtArea(r.patchArea)} km²
          {edge ? (
            <>
              , indre skog ({fmt(r.side, 2)} − 2 · {fmt(EDGE_WIDTH, 1)} km)<Sup>2</Sup> = {fmtArea(r.core)} km²
            </>
          ) : null}
        </FormulaLine>
        <FormulaLine>
          S = {fmt(FOREST_SPECIES_COUNT / FOREST_AREA ** z, 1)} · {fmtArea(r.effective)}
          <Sup>{fmt(z, 2)}</Sup> ≈ {fmt(r.species, 0)} arter
        </FormulaLine>
      </Formula>

      <Explain>{fragmentText(r, layout.n, loss, edge, lost, lostByLoss)}</Explain>
    </>
  );
}

function FragmentScene({
  r,
  rows,
  cols,
  edge,
  f,
  z,
  loss,
}: {
  r: Fragmentation;
  rows: number;
  cols: number;
  edge: boolean;
  f: number;
  z: number;
  loss: number;
}) {
  const narrow = f > 1.3;
  const titleH = 28 * f;
  const L = narrow ? 560 : 340;
  const lx = narrow ? (800 - L) / 2 : 20;
  const ly = titleH + 6;
  const plotX = narrow ? 0 : 380;
  const plotY = narrow ? ly + L + 24 : 0;
  const plotW = narrow ? 800 : 420;
  const plotH = narrow ? Math.round(320 + 220 * (f - 1)) : ly + L + 8;
  const H = Math.round(narrow ? plotY + plotH : Math.max(ly + L + 12, plotH));
  const cw = L / cols;
  const ch = L / rows;
  // Kvadratiske biter med riktig andel av rutearealet; kantsonen i samme målestokk (10 km = L)
  const s = Math.sqrt(1 - loss);
  const kmToPx = L / 10;
  const k = Math.max(1, 0.85 * f);
  const patches: ReactNode[] = [];
  for (let i = 0; i < rows; i++)
    for (let j = 0; j < cols; j++) {
      const w = cw * s;
      const h = ch * s;
      const x = lx + j * cw + (cw - w) / 2;
      const y = ly + i * ch + (ch - h) / 2;
      const e = edge ? EDGE_WIDTH * kmToPx : 0;
      patches.push(
        <g key={`${i}-${j}`}>
          <rect x={x} y={y} width={w} height={h} rx={3} fill={edge ? BIO.sukker : BIO.plante.fill} fillOpacity={edge ? 0.55 : 1} />
          <rect
            x={x + e}
            y={y + e}
            width={Math.max(0, w - 2 * e)}
            height={Math.max(0, h - 2 * e)}
            rx={2}
            fill={BIO.plante.fill}
            stroke={BIO.plante.line}
            strokeWidth={1.2}
          />
          {w > 60 * k && <Tre x={x + w / 2} y={y + h / 2} size={Math.min(w, h) * 0.32} bartre />}
        </g>,
      );
    }
  return (
    <Figure
      viewBox={`0 0 800 ${H}`}
      maxHeight={narrow ? 1400 : H}
      label={`Skog på ${FOREST_AREA} km² der ${fmtPct(loss)} er borte og resten er delt i ${rows * cols} biter. Ca. ${fmt(r.species, 0)} av ${FOREST_SPECIES_COUNT} arter blir igjen på sikt.`}
    >
      <Txt x={lx} y={titleH - 6} anchor="start" size={0.85} weight={650}>
        Skogen sett ovenfra (10 × 10 km)
      </Txt>
      <rect x={lx} y={ly} width={L} height={L} rx={6} fill={BIO.ved} fillOpacity={0.35} stroke={VIZ.muted} strokeWidth={1.5} />
      {patches}
      <g transform={`translate(${plotX} ${plotY})`}>
        <Plot
          x={{ min: 0, max: 25, label: 'Antall skogbiter', ticks: [1, 5, 10, 15, 20, 25] }}
          y={{ min: 0, max: 100, label: 'Arter på sikt', ticks: [0, 25, 50, 75, 100] }}
          width={plotW}
          height={plotH}
        >
          {({ sx, sy, x0, x1 }) => {
            const pts = PATCH_LAYOUTS.map((p) => [p.n, fragmentation(p.n, loss, z, edge).species] as [number, number]);
            return (
              <g>
                <line x1={x0} x2={x1} y1={sy(r.speciesOnePiece)} y2={sy(r.speciesOnePiece)} stroke={REF} strokeWidth={2} strokeDasharray="7 6" />
                <path d={linePath(pts, sx, sy)} fill="none" stroke={COL} strokeWidth={3} />
                {pts.map(([n, v]) => (
                  <circle key={n} cx={sx(n)} cy={sy(v)} r={3.5} fill={COL} />
                ))}
                <circle cx={sx(rows * cols)} cy={sy(r.species)} r={8} fill={COL} stroke={VIZ.surface} strokeWidth={3} />
              </g>
            );
          }}
        </Plot>
      </g>
    </Figure>
  );
}

function fragmentText(r: Fragmentation, n: number, loss: number, edge: boolean, lost: number, lostByLoss: number): ReactNode {
  const byFragmentation = lost - lostByLoss;
  return (
    <>
      <p>
        {n === 1 && loss === 0 ? (
          <>
            <strong>Skogen er hel</strong>, med alle {FOREST_SPECIES_COUNT} artene. Del den opp eller hogg en del av den, og se hvor mange
            arter som blir igjen.
          </>
        ) : (
          <>
            <strong>
              Ca. {fmt(lost, 0)} av {FOREST_SPECIES_COUNT} arter forsvinner på sikt.
            </strong>{' '}
            {loss > 0 ? `Omtrent ${fmt(lostByLoss, 0)} fordi ${fmtPct(loss)} av skogen er borte` : 'Ingen skog er borte'}
            {n > 1 ? `, og omtrent ${fmt(byFragmentation, 0)} fordi resten er delt i ${n} biter på ${fmtArea(r.patchArea)} km²` : ''}.
            {n > 1
              ? ' Hver bit er en «øy» i landskapet: små bestander dør lettere ut, og det er vanskelig å spre seg til neste bit over hogstflater, veier og jorder.'
              : ''}
          </>
        )}
      </p>
      {edge && (
        <p>
          <strong>Kanteffekt:</strong> langs kanten slipper det inn mer lys, vind og tørke, så arter som trenger fuktig, skyggefull indre
          skog (mange lav, moser og sopp i gammel skog), mister også kantsonen. Jo mindre biten er, jo større andel er kant: nå er bare{' '}
          {fmtPct(r.core / r.patchArea)} av hver bit indre skog.
        </p>
      )}
      <p>
        Artene forsvinner ikke med en gang. Bestander kan leve en stund i for små områder før de dør ut (utdøingsgjeld). Modellen er
        forenklet: den antar at alle bitene har de samme artene, og bruker S = c · A<Sup>z</Sup> fra den hele skogen. Endret arealbruk er
        den viktigste trusselen mot det biologiske mangfoldet i Norge, og tiltak er å verne store, sammenhengende områder og lage korridorer
        mellom dem.
      </p>
    </>
  );
}
