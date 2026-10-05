import { useState, type ReactNode } from 'react';
import {
  AngleArc,
  Arrow,
  Atom,
  Bond,
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
  Select,
  Slider,
  Toolbar,
  Txt,
  VIZ,
  VizLayout,
  atomColors,
  atomRadius,
  capitalize,
  element,
  fmt,
  formulaText,
  polar,
  useContainerTextScale,
} from '../kit';
import {
  DIPOLE_DRAW_MIN,
  MOLECULES,
  SHAPES,
  axeNotation,
  bondPolarities,
  centralElectrons,
  isPolarShape,
  ligandLonePairs,
  moleculeShape,
  netDipole,
  shapeFor,
  shapeLayout,
  vecLength,
  type MoleculePreset,
  type ShapeId,
  type Vec3,
} from './model';

const FREE = 'fri';

/** Molekylet som vises: et av lærebokmolekylene eller AXₙEₘ i fri modus. */
interface Shown {
  preset: MoleculePreset | null;
  center: string;
  ligands: string[];
  orders: (1 | 2 | 3)[];
  lonePairs: number;
  shape: ShapeId;
  angle: number;
}

function shown(id: string, bonds: number, lps: number): Shown {
  const m = MOLECULES.find((x) => x.id === id);
  if (m) return { preset: m, center: m.center, ligands: m.ligands, orders: m.orders, lonePairs: m.lonePairs, shape: moleculeShape(m), angle: m.angle };
  const shape = shapeFor(bonds, lps);
  return { preset: null, center: 'A', ligands: Array.from({ length: bonds }, () => 'X'), orders: Array.from({ length: bonds }, () => 1), lonePairs: lps, shape, angle: SHAPES[shape].angle };
}

const angleText = (a: number) => `${fmt(a, Number.isInteger(a) ? 0 : 1)}°`;

/** Formnavnet slik det står etter «formen er»: «vinklet», men «en trigonal pyramide» og «en vippehuske». */
const shapeAfterIs = (id: ShapeId) => (id === 'trigonal-pyramidal' || id === 'seesaw' ? `en ${SHAPES[id].name}` : SHAPES[id].name);

/** Atomene i romfiguren tegnes større enn vanlig. */
const BIG = 1.45;

/** I fri modus tegnes X som et kloratom og A som et karbonatom. */
const ligEl = (l: string) => (l === 'X' ? 'Cl' : l);

/** Avstand sentrum–sentrum i romfiguren. */
function bondLength(s: Shown, k: number): number {
  const rc = atomRadius(s.preset ? s.center : 'C', { scale: k * BIG });
  const rl = Math.max(...s.ligands.map((l) => atomRadius(ligEl(l), { scale: k * BIG })));
  return (rc + rl) * 1.2 + 34 * k;
}

export default function Molekylform() {
  const [id, setId] = useState('H2O');
  const [bonds, setBonds] = useState(2);
  const [lps, setLps] = useState(2);
  const [ref, f] = useContainerTextScale<HTMLDivElement>();
  const k = Math.max(1, 0.85 * f);
  const s = shown(id, bonds, lps);
  const info = SHAPES[s.shape];
  const pol = bondPolarities(s.center, s.ligands);
  const net = netDipole(s.shape, pol, s.angle);
  const isPolar = s.preset ? s.preset.dipole > 0 : isPolarShape(s.shape);
  const layout = sceneLayout(f, k, s);
  const sum = sumLayout(f, k);
  const name = s.preset ? `${s.preset.name} (${formulaText(s.preset.formula)})` : `${axeNotation(s.ligands.length, s.lonePairs)}`;

  const pick = (v: string) => {
    setId(v);
    const m = MOLECULES.find((x) => x.id === v);
    if (m) {
      setBonds(m.ligands.length);
      setLps(m.lonePairs);
    }
  };
  const free = (b: number, e: number) => {
    setId(FREE);
    setBonds(b);
    setLps(e);
  };

  return (
    <VizLayout>
      <Toolbar>
        <Select
          label="Molekyl"
          value={id}
          onChange={pick}
          options={[...MOLECULES.map((m) => ({ value: m.id, label: `${m.name} (${formulaText(m.formula)})` })), { value: FREE, label: 'Fri modus (AXₙEₘ)' }]}
        />
      </Toolbar>
      <Controls>
        <Slider label="Bundne atomer (X)" value={s.ligands.length} onChange={(b) => free(b, s.lonePairs)} min={2} max={4} step={1} />
        <Slider label="Frie elektronpar (E) på sentralatomet" value={s.lonePairs} onChange={(e) => free(s.ligands.length, e)} min={0} max={2} step={1} />
      </Controls>

      <div ref={ref}>
        <Figure
          viewBox={`0 0 800 ${layout.H}`}
          label={`${capitalize(name)}: formen er ${shapeAfterIs(s.shape)}, bindingsvinkel ${s.preset ? angleText(s.angle) : info.angleText}, ${isPolar ? 'polart' : 'upolart'} molekyl.`}
          maxHeight={layout.H}
        >
          <Lewis s={s} x={layout.lewis.x} y={layout.lewis.y} title={layout.lewis.title} f={f} k={k} />
          <Spatial s={s} panel={layout.space} k={k} />
        </Figure>
      </div>
      <Figure
        viewBox={`0 0 800 ${sum.H}`}
        label={`Bindingsdipolene lagt etter hverandre. ${vecLength(net) < 1e-3 ? 'Summen er null.' : 'Summen er ikke null.'}`}
        caption="Hver pil er en bindingsdipol fra δ+ til δ−, sett i papirplanet og like lang som ΔEN. Den tykke pila er summen."
        maxHeight={sum.H}
      >
        <DipoleSum s={s} pol={pol} net={net} isPolar={isPolar} layout={sum} f={f} k={k} />
      </Figure>
      <Legend
        items={[
          { color: KJEMI.electron, label: 'Frie elektronpar' },
          { color: KJEMI.bondType.polar, label: 'Bindingsdipol (fra δ+ til δ−)' },
          { color: VIZ.ink, label: 'Summen: dipolen til hele molekylet' },
        ]}
      />

      <Readouts>
        <Readout label="Form" value={capitalize(info.name)} />
        <Readout label={s.preset?.angleBetween ? `Bindingsvinkel ${s.preset.angleBetween}` : 'Bindingsvinkel'} value={s.preset ? angleText(s.angle) : info.angleText} />
        <Readout label="Molekylet er" value={isPolar ? 'Polart' : 'Upolart'} tone={isPolar ? KJEMI.bondType.polar : KJEMI.bondType.upolar} />
        <Readout label="Elektronområder" value={`${s.ligands.length + s.lonePairs} (${axeNotation(s.ligands.length, s.lonePairs)})`} />
      </Readouts>

      <Formula label="Elektronområder og polaritet">
        <FormulaLine>
          {s.ligands.length} bundne atomer + {s.lonePairs === 1 ? '1 fritt par' : `${s.lonePairs} frie par`} = {s.ligands.length + s.lonePairs}{' '}
          elektronområder → ordnet{' '}
          {info.electronGeometry === 'lineær' ? 'lineært' : info.electronGeometry === 'trigonal bipyramide' ? 'som en trigonal bipyramide' : info.electronGeometry} →
          formen er {shapeAfterIs(s.shape)}
        </FormulaLine>
        {s.preset && <BondLine s={s} pol={pol} />}
        {s.preset && (
          <FormulaLine>
            Målt dipolmoment: μ = {fmt(s.preset.dipole, 2)} D{s.preset.dipole === 0 ? ' (upolart)' : ''}
          </FormulaLine>
        )}
      </Formula>

      <Explain>{explanation(s, pol, isPolar)}</Explain>
    </VizLayout>
  );
}

/** ΔEN for de ulike bindingene i molekylet: «ΔEN(O–H) = 1,24». */
function BondLine({ s, pol }: { s: Shown; pol: number[] }) {
  const seen = new Map<string, number>();
  s.ligands.forEach((l, i) => seen.set(l, Math.abs(pol[i] ?? 0)));
  return (
    <FormulaLine>
      {[...seen.entries()].map(([l, d], i) => (
        <span key={l}>
          {i > 0 ? ' · ' : ''}ΔEN({s.center}–{l}) = |{fmt(element(l).electronegativity ?? 0, 2)} − {fmt(element(s.center).electronegativity ?? 0, 2)}| = {fmt(d, 2)}
        </span>
      ))}
    </FormulaLine>
  );
}

/* ---------- Oppsett ---------- */

interface Panel {
  x: number;
  y: number;
  title: number;
}

type SumLayout = ReturnType<typeof sumLayout>;

const LEWIS_L = 90;
/** Avstanden fra et symbol til de frie elektronparene i Lewisstrukturen (ganges med f). */
const LEWIS_LP = 28;

/** Retningene til de frie parene på et ytre atom i Lewisstrukturen (bindingen peker mot `deg` + 180°). */
function ligandLonePairDirs(el: string, order: number, deg: number): number[] {
  const lp = ligandLonePairs(el, order);
  return lp >= 3 ? [deg, deg + 90, deg - 90] : lp === 2 ? [deg + 90, deg - 90] : lp === 1 ? [deg] : [];
}

/** Øverste og nederste y som tegningen bruker, i forhold til sentrum (SVG-retning: negativ = over sentrum). */
interface Extent {
  top: number;
  bottom: number;
}

function grow(e: Extent, y: number, pad: number) {
  e.top = Math.min(e.top, y - pad);
  e.bottom = Math.max(e.bottom, y + pad);
}

/** Hvor høyt og lavt Lewisstrukturen rekker: symbolene og de frie elektronparene. */
function lewisExtent(s: Shown, f: number, k: number): Extent {
  const L = LEWIS_L * f;
  const sym = 16 * f;
  const e: Extent = { top: -sym, bottom: sym };
  const dir = lewisDirections(s.ligands.length, s.lonePairs);
  s.ligands.forEach((el, i) => {
    const deg = dir.ligands[i] ?? 0;
    const p = polar(0, 0, L, deg);
    grow(e, p.y, sym);
    for (const d of ligandLonePairDirs(el, s.orders[i] ?? 1, deg)) grow(e, polar(p.x, p.y, LEWIS_LP * f, d).y, 9 * k);
  });
  for (const d of dir.lonePairs.slice(0, s.lonePairs)) grow(e, polar(0, 0, LEWIS_LP * f, d).y, 9 * k);
  return e;
}

/** Hvor høyt og lavt romfiguren rekker: atomene, δ-etikettene, de frie parene og vinkeletiketten. */
function spatialExtent(s: Shown, k: number, f: number): Extent {
  const g = spatialGeometry(s, k);
  const lab = 13 * f;
  const e: Extent = { top: -g.rc, bottom: g.rc };
  for (const l of g.ligs) {
    const p = polar(0, 0, l.len, l.deg);
    grow(e, p.y, l.r);
    if (Math.abs(l.p) >= DIPOLE_DRAW_MIN) grow(e, polar(p.x, p.y, l.r + 9 + 9 * f, l.deg).y, lab);
  }
  for (const d of g.lay.lonePairs) grow(e, polar(0, 0, g.rc + 15 * k, d).y, 24 * k);
  grow(e, polar(0, 0, g.rc + 9 + 9 * f, g.free).y, lab);
  if (g.arcMid !== null) grow(e, polar(0, 0, g.rc + 16 * k + 8 + 12 * f, g.arcMid).y, lab);
  return e;
}

function sceneLayout(f: number, k: number, s: Shown) {
  const wide = f <= 1.3;
  const le = lewisExtent(s, f, k);
  const se = spatialExtent(s, k, f);
  const title = 26 * f;
  if (wide) {
    const top = title + 20 * f;
    const content = Math.max(-le.top, -se.top) + Math.max(le.bottom, se.bottom);
    // Litt fast minstehøyde, så figuren ikke hopper mye når du bytter molekyl
    const H = Math.round(Math.max(top + content + 18 * f, 270));
    const cy = top + (H - 18 * f - top - content) / 2 + Math.max(-le.top, -se.top);
    return { lewis: { x: 200, y: cy, title }, space: { x: 590, y: cy, title }, H };
  }
  const ly = title + 18 * f - le.top;
  const t2 = ly + le.bottom + 38 * f;
  const sy = t2 + 18 * f - se.top;
  return {
    lewis: { x: 400, y: ly, title },
    space: { x: 400, y: sy, title: t2 },
    H: Math.round(sy + se.bottom + 18 * f),
  };
}

/** Figuren med summen av bindingsdipolene: pilene til venstre og teksten til høyre (under på mobil). */
function sumLayout(f: number, k: number) {
  const wide = f <= 1.3;
  if (wide) return { wide, box: { x: 30, y: 16, w: 330, h: 190 }, text: { x: 400, y: 70 }, H: 222 };
  const h = 150 * k;
  return { wide, box: { x: 150, y: 16, w: 500, h }, text: { x: 40, y: 16 + h + 44 * f }, H: Math.round(16 + h + 44 * f + 3 * 30 * f + 10) };
}

/* ---------- Lewisstrukturen ---------- */

/** Retninger (grader) for de ytre atomene og de frie parene på sentralatomet i Lewisstrukturen. */
function lewisDirections(n: number, lps: number): { ligands: number[]; lonePairs: number[] } {
  if (n === 2) return { ligands: [180, 0], lonePairs: [[], [90], [90, 270]][lps] ?? [] };
  if (n === 3 && lps === 0) return { ligands: [90, 180, 0], lonePairs: [] };
  if (n === 3) return { ligands: [180, 0, 270], lonePairs: lps === 1 ? [90] : [60, 120] };
  return { ligands: [90, 180, 0, 270], lonePairs: [[], [45], [45, 225]][lps] ?? [] };
}

function DotPair({ x, y, deg, d, k }: { x: number; y: number; deg: number; d: number; k: number }) {
  const c = polar(x, y, d, deg);
  const t = polar(0, 0, 5.5 * k, deg + 90);
  return (
    <g>
      <circle cx={c.x + t.x} cy={c.y + t.y} r={3.2 * k} fill={KJEMI.electron} />
      <circle cx={c.x - t.x} cy={c.y - t.y} r={3.2 * k} fill={KJEMI.electron} />
    </g>
  );
}

function Lewis({ s, x, y, title, f, k }: { s: Shown; x: number; y: number; title: number; f: number; k: number }) {
  const L = LEWIS_L * f;
  const dir = lewisDirections(s.ligands.length, s.lonePairs);
  const symR = 18 * f;
  const lpD = LEWIS_LP * f;
  const symbol = (sx: number, sy: number, el: string) => (
    <Txt x={sx} y={sy + 11 * f} size={1.8} weight={700} color={el === 'A' || el === 'X' || el === 'H' || el === 'C' ? VIZ.ink : atomColors(el).line}>
      {el}
    </Txt>
  );
  return (
    <g>
      <Txt x={x} y={title} muted size={0.9}>
        Lewisstruktur
      </Txt>
      {s.ligands.map((el, i) => {
        const deg = dir.ligands[i] ?? 0;
        const p = polar(x, y, L, deg);
        const order = s.orders[i] ?? 1;
        const offs = order === 1 ? [0] : order === 2 ? [-4.5 * k, 4.5 * k] : [-7 * k, 0, 7 * k];
        const a = polar(x, y, symR + 3, deg);
        const b = polar(x, y, L - symR - 3, deg);
        const n = polar(0, 0, 1, deg + 90);
        const lpDirs = ligandLonePairDirs(el, order, deg);
        return (
          <g key={i}>
            {offs.map((o) => (
              <line key={o} x1={a.x + n.x * o} y1={a.y + n.y * o} x2={b.x + n.x * o} y2={b.y + n.y * o} stroke={KJEMI.bond} strokeWidth={2.4 * k} strokeLinecap="round" />
            ))}
            {symbol(p.x, p.y, el)}
            {lpDirs.map((d) => (
              <DotPair key={d} x={p.x} y={p.y} deg={d} d={lpD} k={k} />
            ))}
          </g>
        );
      })}
      {symbol(x, y, s.center)}
      {dir.lonePairs.slice(0, s.lonePairs).map((d) => (
        <DotPair key={d} x={x} y={y} deg={d} d={lpD} k={k} />
      ))}
    </g>
  );
}

/* ---------- Formen i rommet ---------- */

/** Fritt elektronpar som en «ballong» (elektronsky) ut fra sentralatomet, med to elektroner. */
function Lobe({ x, y, deg, rc, k }: { x: number; y: number; deg: number; rc: number; k: number }) {
  const c = polar(x, y, rc + 15 * k, deg);
  const e = polar(x, y, rc + 19 * k, deg);
  const t = polar(0, 0, 5 * k, deg + 90);
  return (
    <g>
      <ellipse cx={c.x} cy={c.y} rx={24 * k} ry={14 * k} transform={`rotate(${-deg} ${c.x} ${c.y})`} fill={KJEMI.cloud} stroke={KJEMI.electron} strokeWidth={1.2} strokeOpacity={0.6} />
      <circle cx={e.x + t.x} cy={e.y + t.y} r={3.3 * k} fill={KJEMI.electron} />
      <circle cx={e.x - t.x} cy={e.y - t.y} r={3.3 * k} fill={KJEMI.electron} />
    </g>
  );
}

const norm = (d: number) => ((d % 360) + 360) % 360;

/** Midtretningen til den minste buen mellom to retninger (der AngleArc tegner vinkelen). */
function arcMid(from: number, to: number): number {
  let span = norm(to - from);
  let start = from;
  if (span > 180) {
    start = to;
    span = 360 - span;
  }
  return norm(start + span / 2);
}

/** Midten av den største ledige vinkelen rundt sentralatomet (for δ-etiketten), utenom vinkelen med buen (`avoid`). */
function freeDirection(dirs: number[], avoid: number | null): number {
  const ds = dirs.map(norm).sort((a, b) => a - b);
  if (ds.length === 0) return 90;
  let best = 90;
  let gap = -1;
  ds.forEach((a, i) => {
    const b = i + 1 < ds.length ? ds[i + 1]! : ds[0]! + 360;
    const inside = avoid !== null && norm(avoid - a) < b - a;
    if (!inside && b - a > gap) {
      gap = b - a;
      best = norm(a + (b - a) / 2);
    }
  });
  return best;
}

/** Geometrien i romfiguren rundt (0, 0): sentralatomet, de ytre atomene, retningen til δ-etiketten og vinkelbuen. */
function spatialGeometry(s: Shown, k: number) {
  const centerEl = s.preset ? s.center : 'C';
  const rc = atomRadius(centerEl, { scale: k * BIG });
  const lay = shapeLayout(s.shape, s.angle);
  const L = bondLength(s, k);
  const pol = bondPolarities(s.center, s.ligands);
  const ligs = lay.ligands.map((slot, i) => {
    const el = s.ligands[i] ?? 'X';
    return { deg: slot.deg, stereo: slot.stereo, len: L * slot.len, el, r: atomRadius(ligEl(el), { scale: k * BIG }), p: pol[i] ?? 0, order: s.orders[i] ?? 1 };
  });
  const arcMidDeg = lay.arc ? arcMid(lay.ligands[lay.arc[0]]!.deg, lay.ligands[lay.arc[1]]!.deg) : null;
  const free = freeDirection([...lay.ligands.map((l) => l.deg), ...lay.lonePairs], arcMidDeg);
  return { centerEl, rc, lay, ligs, free, arcMid: arcMidDeg };
}

function Spatial({ s, panel, k }: { s: Shown; panel: Panel; k: number }) {
  const { x, y } = panel;
  const g = spatialGeometry(s, k);
  const { centerEl, rc, lay, free } = g;
  const ligs = g.ligs.map((l) => ({ ...l, ...polar(x, y, l.len, l.deg) }));
  const drawn = (p: number) => Math.abs(p) >= DIPOLE_DRAW_MIN;
  const signs = ligs.filter((l) => drawn(l.p)).map((l) => Math.sign(l.p));
  const centerPartial = signs.length > 0 && signs.every((v) => v === signs[0]) ? (signs[0]! > 0 ? 'plus' : 'minus') : null;
  const order = ligs.map((_, i) => i).sort((a, b) => (ligs[a]!.stereo === 'hash' ? -1 : 0) - (ligs[b]!.stereo === 'hash' ? -1 : 0));
  const arc = lay.arc ? [ligs[lay.arc[0]]!, ligs[lay.arc[1]]!] : null;
  const label = s.preset ? angleText(s.angle) : SHAPES[s.shape].angleText.replace('ca. ', '');
  return (
    <g>
      <Txt x={x} y={panel.title} muted size={0.9}>
        Form i rommet
      </Txt>
      {lay.lonePairs.map((d) => (
        <Lobe key={d} x={x} y={y} deg={d} rc={rc} k={k} />
      ))}
      {arc && <AngleArc x={x} y={y} from={arc[0]!.deg} to={arc[1]!.deg} r={rc + 16 * k} label={label} />}
      {order.map((i) => {
        const l = ligs[i]!;
        return <Bond key={`b${i}`} a={{ x, y, r: rc }} b={{ x: l.x, y: l.y, r: l.r }} order={l.order} stereo={l.stereo} />;
      })}
      {order.map((i) => {
        const l = ligs[i]!;
        const partial = drawn(l.p) ? (l.p > 0 ? 'minus' : 'plus') : null;
        return <Atom key={`a${i}`} x={l.x} y={l.y} r={l.r} el={ligEl(l.el)} label={l.el === 'X' ? 'X' : undefined} partial={partial} partialAngle={l.deg} />;
      })}
      <Atom x={x} y={y} r={rc} el={centerEl} label={s.preset ? undefined : 'A'} partial={centerPartial} partialAngle={free} />
    </g>
  );
}

/**
 * Bindingsdipolene lagt etter hverandre (hode mot hale), sett i papirplanet. Summen er pila fra start til slutt:
 * lukker pilene seg til en figur, er summen null og molekylet upolart.
 */
function DipoleSum({ s, pol, net, isPolar, layout, f, k }: { s: Shown; pol: number[]; net: Vec3; isPolar: boolean; layout: SumLayout; f: number; k: number }) {
  const { box } = layout;
  const lay = shapeLayout(s.shape, s.angle);
  const vecs = lay.ligands.map((l, i) => ({ x: (pol[i] ?? 0) * l.v[0], y: (pol[i] ?? 0) * l.v[1] })).filter((v) => Math.hypot(v.x, v.y) > 0.02);
  // Punktene i kjeden (i ΔEN-enheter, y opp)
  const pts: { x: number; y: number }[] = [{ x: 0, y: 0 }];
  for (const v of vecs) {
    const last = pts[pts.length - 1]!;
    pts.push({ x: last.x + v.x, y: last.y + v.y });
  }
  const xs = pts.map((p) => p.x);
  const ys = pts.map((p) => p.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const top = box.y + 16 * k;
  const bottom = box.y + box.h - 16 * k;
  const availW = box.w - 40 * k;
  const availH = Math.max(40, bottom - top);
  const scale = Math.min(120 * k, availW / Math.max(0.3, maxX - minX), availH / Math.max(0.3, maxY - minY));
  const cx = box.x + box.w / 2 - ((minX + maxX) / 2) * scale;
  const cy = (top + bottom) / 2 + ((minY + maxY) / 2) * scale;
  const X = (v: number) => cx + v * scale;
  const Y = (v: number) => cy - v * scale;
  const zero = vecLength(net) < 1e-3;
  return (
    <g>
      <rect x={box.x} y={box.y} width={box.w} height={box.h} rx={12} fill="none" stroke={VIZ.grid} strokeWidth={1.2} />
      {vecs.length === 0 ? (
        <Txt x={box.x + box.w / 2} y={(top + bottom) / 2} muted size={0.8}>
          ingen polare bindinger
        </Txt>
      ) : (
        vecs.map((v, i) => {
          const a = pts[i]!;
          const b = pts[i + 1]!;
          // Piler som går rett tilbake, flyttes litt til siden så begge synes
          const back = i > 0 && (vecs[i - 1]!.x * v.x + vecs[i - 1]!.y * v.y) / (Math.hypot(vecs[i - 1]!.x, vecs[i - 1]!.y) * Math.hypot(v.x, v.y)) < -0.95;
          const off = back ? 9 * k : 0;
          const len = Math.hypot(v.x, v.y);
          const ox = (-v.y / len) * off;
          const oy = (v.x / len) * off;
          return <Arrow key={i} x1={X(a.x) + ox} y1={Y(a.y) - oy} x2={X(b.x) + ox} y2={Y(b.y) - oy} color={KJEMI.bondType.polar} width={2.6 * k} head={11 * k} />;
        })
      )}
      {vecs.length > 0 && !zero && <Arrow x1={X(0)} y1={Y(0)} x2={X(net[0])} y2={Y(net[1])} color={VIZ.ink} width={3.4 * k} head={13 * k} />}
      {vecs.length > 0 && <circle cx={X(0)} cy={Y(0)} r={4 * k} fill={VIZ.ink} />}
      <Txt x={layout.text.x} y={layout.text.y} anchor="start" muted size={0.9}>
        Bindingsdipolene lagt etter hverandre:
      </Txt>
      <Txt x={layout.text.x} y={layout.text.y + 34 * f} anchor="start" size={1.1} weight={700} color={isPolar ? KJEMI.bondType.polar : KJEMI.bondType.upolar}>
        {zero ? (vecs.length ? 'Summen er null' : 'Ingen polare bindinger') : 'Summen er ikke null'}
      </Txt>
      <Txt x={layout.text.x} y={layout.text.y + 68 * f} anchor="start" size={0.9}>
        {isPolar ? 'Molekylet er polart (en dipol).' : 'Molekylet er upolart.'}
      </Txt>
    </g>
  );
}

/* ---------- Forklaring ---------- */

function explanation(s: Shown, pol: number[], isPolar: boolean): ReactNode {
  const info = SHAPES[s.shape];
  const n = s.ligands.length + s.lonePairs;
  const m = s.preset;
  const what = m ? <Formel f={m.formula} /> : axeNotation(s.ligands.length, s.lonePairs);
  const centerName = m ? element(m.center).name : 'sentralatomet';
  const lpText = s.lonePairs === 0 ? 'ingen frie elektronpar' : s.lonePairs === 1 ? 'ett fritt elektronpar' : `${s.lonePairs} frie elektronpar`;
  const geometry = (
    <p>
      <strong>
        {capitalize(info.name)}{m ? '' : ` (eksempel: ${formulaText(info.example)})`}.
      </strong>{' '}
      {m ? <>Rundt {centerName} i {what}</> : 'Rundt sentralatomet A'} er det {n} elektronområder: {s.ligands.length} bindinger og {lpText}. Elektronparene
      frastøter hverandre og ordner seg så langt fra hverandre som mulig ({info.electronGeometry}), men formen beskrives bare ut fra
      atomene.{' '}
      {s.lonePairs > 0 && n === 4
        ? 'Frie elektronpar tar mer plass enn bindende par og presser bindingene sammen: 109,5° uten frie par, ca. 107° med ett og ca. 104,5° med to.'
        : ''}
      {n > 4 ? ' Med mer enn fire elektronområder får sentralatomet over åtte elektroner rundt seg. Det går bare for større atomer fra periode 3 og nedover, og er ikke vanlig pensum i Kjemi 1.' : ''}
      {s.orders.some((o) => o > 1) ? ' En dobbelt- eller trippelbinding teller som ett elektronområde.' : ''}
    </p>
  );
  let polarity: ReactNode;
  const maxDen = Math.max(...pol.map(Math.abs));
  if (!m) {
    polarity = isPolar ? (
      <p>
        Når X trekker hardere i elektronene enn A, er hver binding en dipol. I denne formen peker dipolene ikke likt i alle retninger, så de
        opphever ikke hverandre: molekylet er <strong>polart</strong>.
      </p>
    ) : (
      <p>
        Selv om hver A–X-binding er polar, er formen helt symmetrisk, så bindingsdipolene opphever hverandre: molekylet er{' '}
        <strong>upolart</strong>.
      </p>
    );
  } else if (m.id === 'CH4') {
    polarity = (
      <p>
        C–H-bindingene er nesten upolare (ΔEN = {fmt(maxDen, 2)}), og den tetraedriske formen er symmetrisk. Metan er derfor et upolart molekyl.
      </p>
    );
  } else if (!isPolar) {
    polarity = (
      <p>
        Bindingene er polare (ΔEN = {fmt(maxDen, 2)}), men formen er symmetrisk, så bindingsdipolene opphever hverandre. {what} er derfor
        et <strong>upolart</strong> molekyl. Polare bindinger gir altså ikke alltid et polart molekyl.
        {m.id === 'BF3' ? ' (B har bare seks elektroner rundt seg i BF₃, et unntak fra oktettregelen.)' : ''}
      </p>
    );
  } else if (m.id === 'CHCl3') {
    polarity = (
      <p>
        CHCl₃ har samme tetraedriske form som CCl₄, men ett av kloratomene er byttet med H. Da er ikke alle bindingene like, dipolene opphever
        ikke hverandre, og molekylet blir <strong>polart</strong> med den negative enden mot kloratomene.
      </p>
    );
  } else if (m.id === 'H2S') {
    polarity = (
      <p>
        S–H-bindingene er nesten upolare (ΔEN = {fmt(maxDen, 2)}), men molekylet er vinklet med to frie par på S, så det blir{' '}
        <strong>svakt polart</strong> (μ = 0,97 D mot 1,85 D for vann). Vinkelen er bare 92°: VSEPR forutsier formen, men ikke den nøyaktige
        vinkelen.
      </p>
    );
  } else if (m.id === 'CH2O') {
    polarity = (
      <p>
        CH₂O har samme form som BF₃ (trigonal plan), men bindingene er ikke like: C=O er polar (ΔEN = {fmt(maxDen, 2)}), mens C–H er nesten upolare. Dipolene
        opphever ikke hverandre, og molekylet er <strong>polart</strong> med den negative enden mot oksygen. Dobbeltbindingen har flere
        elektroner og frastøter C–H-bindingene mer, så vinkelen H–C–H blir litt mindre enn 120°.
      </p>
    );
  } else if (m.id === 'HCN') {
    polarity = (
      <p>
        HCN er lineært, men de to endene er forskjellige: N trekker hardest i elektronene og H minst. Dipolene peker samme vei, og molekylet er{' '}
        <strong>polart</strong>, selv om formen er den samme som for det upolare CO₂.
      </p>
    );
  } else {
    polarity = (
      <p>
        Bindingene er polare (ΔEN = {fmt(maxDen, 2)}), og fordi formen er {shapeAfterIs(s.shape)}, peker
        bindingsdipolene til samme side. De legges sammen til en dipol for hele molekylet: {what} er <strong>polart</strong>.
        {m.id === 'SO2' ? ` Begge S–O-bindingene er like lange, og S har ${centralElectrons(m)} elektroner rundt seg (utvidet oktett).` : ''}
        {m.id === 'PCl3' ? ' Vinkelen er 100°, litt mindre enn i NH₃, fordi P er større enn N.' : ''}
      </p>
    );
  }
  return (
    <>
      {geometry}
      {polarity}
    </>
  );
}
