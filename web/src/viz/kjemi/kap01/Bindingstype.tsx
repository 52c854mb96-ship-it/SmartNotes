import { useState, type ReactNode } from 'react';
import {
  Atom,
  DipoleArrow,
  ElementPicker,
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
  Sup,
  TFormel,
  Toolbar,
  Txt,
  VIZ,
  VizLayout,
  atomColors,
  atomRadius,
  capitalize,
  chargeText,
  fmt,
  formulaText,
  ionShells,
  isMetal,
  polar,
  scaleLinear,
  seededRandom,
  useContainerTextScale,
  type Element,
} from '../kit';
import { BOND_ELEMENTS, DEN_IONIC, DEN_MAX, DEN_POLAR, KIND_NAMES, KIND_SHORT, analyzeBond, type BondAnalysis, type DenClass } from './model';

type Slot = 'a' | 'b';

/** Atomene tegnes større enn vanlig i bindingsbildet. */
const BIG = 2.1;
const KIND_COLOR = KJEMI.bondType;

export default function Bindingstype() {
  const [a, setA] = useState('H');
  const [b, setB] = useState('Cl');
  const [slot, setSlot] = useState<Slot>('b');
  const r = analyzeBond(a, b);
  const [ref, f] = useContainerTextScale<HTMLDivElement>();
  const k = Math.max(1, f * 0.85);
  const scaleH = scaleLayout(f).H;
  const scene = sceneLayout(r, f, k);

  return (
    <VizLayout>
      <Toolbar>
        <Segmented
          label="Hvilket atom vil du bytte?"
          options={[
            { value: 'a', label: <>Atom A: {a}</> },
            { value: 'b', label: <>Atom B: {b}</> },
          ]}
          value={slot}
          onChange={setSlot}
        />
      </Toolbar>
      <ElementPicker
        label={`Velg grunnstoff for atom ${slot === 'a' ? 'A' : 'B'}`}
        elements={BOND_ELEMENTS}
        selected={[a, b]}
        badges={a === b ? { [a]: 'A B' } : { [a]: 'A', [b]: 'B' }}
        onPick={(s) => (slot === 'a' ? setA(s) : setB(s))}
        detail={(e) => fmt(e.electronegativity ?? Number.NaN, 2)}
        showGroups
      />

      <div ref={ref}>
        <Figure
          viewBox={`0 0 800 ${scaleH}`}
          label={`Elektronegativitet: ${r.a.symbol} ${fmt(r.a.electronegativity ?? 0, 2)} og ${r.b.symbol} ${fmt(r.b.electronegativity ?? 0, 2)}. ΔEN = ${fmt(r.dEN, 2)}, som etter grensene 0,5 og 1,7 gir ${KIND_NAMES[r.byDEN].toLowerCase()} binding.`}
          maxHeight={scaleH}
        >
          <EnScale r={r} f={f} />
        </Figure>
      </div>

      <Figure
        viewBox={`0 0 800 ${scene.H}`}
        label={`${KIND_NAMES[r.kind]} mellom ${r.a.name} og ${r.b.name}.`}
        caption={
          r.kind === 'ionisk'
            ? 'Ionene er tegnet med ioneradius: et positivt ion er mindre enn atomet, et negativt ion større.'
            : r.kind === 'metallisk'
              ? 'Forenklet bilde av et metallgitter.'
              : 'Atomene er tegnet med kovalent radius. Elektronskyen er forenklet.'
        }
        maxHeight={scene.H}
      >
        <BondScene r={r} f={f} k={k} layout={scene} />
      </Figure>
      <Legend
        items={[
          { color: KJEMI.plus, label: 'Positiv ladning (δ+ eller +)' },
          { color: KJEMI.minus, label: 'Negativ ladning (δ− eller −)' },
          { color: KJEMI.electron, label: 'Elektroner' },
        ]}
      />

      <Readouts>
        <Readout label="ΔEN" value={fmt(r.dEN, 2)} tone={KIND_COLOR[r.byDEN]} />
        <Readout label="Bindingstype" value={KIND_SHORT[r.kind]} tone={KIND_COLOR[r.kind]} />
        {r.kind !== 'metallisk' && <Readout label="Ionisk karakter (omtrent)" value={fmt(r.ionicCharacter * 100, 0)} unit="%" />}
        {r.example && <Readout label={`Eksempel: ${r.example.name}`} value={formulaText(r.example.formula)} />}
      </Readouts>

      <Formula label="Elektronegativitetsforskjellen">
        <FormulaLine>
          ΔEN = |EN({r.b.symbol}) − EN({r.a.symbol})| = |{fmt(r.b.electronegativity ?? 0, 2)} − {fmt(r.a.electronegativity ?? 0, 2)}| ={' '}
          {fmt(r.dEN, 2)}
        </FormulaLine>
        {r.kind !== 'metallisk' && (
          <FormulaLine>
            Ionisk karakter ≈ 1 − e<Sup>−ΔEN²/4</Sup> = {fmt(r.ionicCharacter * 100, 0)} % (Paulings tilnærming)
          </FormulaLine>
        )}
      </Formula>

      <Explain>{explanation(r)}</Explain>
    </VizLayout>
  );
}

/* ---------- Figur 1: elektronegativitet og ΔEN-skalaen ---------- */

const X0 = 50;
const X1 = 750;

function scaleLayout(f: number) {
  const title = 24 * f;
  const rowA = title + 34 * f;
  const rowB = rowA + 26 * f;
  const axis = rowB + 18 * f;
  const tick = axis + 24 * f;
  const marker = tick + 42 * f;
  const barTop = marker + 24 * f;
  const barH = 28;
  const values = barTop + barH + 20 * f;
  const name1 = values + 26 * f;
  const name2 = name1 + 20 * f;
  return { title, rowA, rowB, axis, tick, marker, barTop, barH, values, name1, name2, H: Math.round(name2 + 14 * f) };
}

/** Plassering av en etikett som skal stå ved x, men ikke gå ut av figuren. */
function anchorFor(x: number): { x: number; anchor: 'start' | 'middle' | 'end' } {
  if (x < X0 + 90) return { x: Math.max(X0 - 10, x - 12), anchor: 'start' };
  if (x > X1 - 90) return { x: Math.min(X1 + 10, x + 12), anchor: 'end' };
  return { x, anchor: 'middle' };
}

function EnScale({ r, f }: { r: BondAnalysis; f: number }) {
  const L = scaleLayout(f);
  const en = scaleLinear([0, 4], [X0, X1]);
  const dx = scaleLinear([0, DEN_MAX], [X0, X1]);
  const ea = r.a.electronegativity ?? 0;
  const eb = r.b.electronegativity ?? 0;
  const xa = en(ea);
  const xb = en(eb);
  const regions: { from: number; to: number; cls: DenClass; lines: string[] }[] = [
    { from: 0, to: DEN_POLAR, cls: 'upolar', lines: ['upolar', 'kovalent'] },
    { from: DEN_POLAR, to: DEN_IONIC, cls: 'polar', lines: ['polar', 'kovalent'] },
    { from: DEN_IONIC, to: DEN_MAX, cls: 'ionisk', lines: ['ionisk'] },
  ];
  const xm = dx(Math.min(DEN_MAX, r.dEN));
  // ΔEN-områdene gjelder ikke for to metaller
  const active = r.kind === 'metallisk' ? null : r.byDEN;
  const ml = anchorFor(xm);
  const marker = (x: number, el: Element, row: number) => {
    const c = atomColors(el.symbol);
    const lab = anchorFor(x);
    return (
      <g>
        <line x1={x} y1={row + 6} x2={x} y2={L.axis} stroke={c.line} strokeWidth={1.5} />
        <circle cx={x} cy={L.axis} r={7} fill={c.fill} stroke={c.line} strokeWidth={2} />
        <Txt x={lab.x} y={row} anchor={lab.anchor} weight={650}>
          {el.symbol}
          <tspan className="is-muted" dx={6} fontWeight={500}>
            {fmt(el.electronegativity ?? 0, 2)}
          </tspan>
        </Txt>
      </g>
    );
  };
  return (
    <g>
      <Txt x={X0 - 10} y={L.title} anchor="start" muted size={0.9}>
        Elektronegativitet (Pauling)
      </Txt>
      <line x1={X0} y1={L.axis} x2={X1} y2={L.axis} className="viz-axis" />
      {Array.from({ length: 9 }, (_, i) => i / 2).map((v) => (
        <g key={v}>
          <line x1={en(v)} y1={L.axis - (Number.isInteger(v) ? 7 : 4)} x2={en(v)} y2={L.axis + (Number.isInteger(v) ? 7 : 4)} className="viz-axis" />
          {Number.isInteger(v) && (
            <text x={en(v)} y={L.tick} textAnchor="middle" className="viz-tick">
              {fmt(v, 0)}
            </text>
          )}
        </g>
      ))}
      {r.dEN > 0 && <line x1={xa} y1={L.axis} x2={xb} y2={L.axis} stroke={KIND_COLOR[r.byDEN]} strokeWidth={7} strokeLinecap="round" opacity={0.55} />}
      {marker(xa, r.a, L.rowA)}
      {marker(xb, r.b, L.rowB)}

      {/* ΔEN-skalaen med de tre områdene */}
      {regions.map((g) => (
        <rect
          key={g.cls}
          x={dx(g.from)}
          y={L.barTop}
          width={dx(g.to) - dx(g.from)}
          height={L.barH}
          fill={KIND_COLOR[g.cls]}
          opacity={g.cls === active ? 0.42 : 0.16}
        />
      ))}
      <rect x={X0} y={L.barTop} width={X1 - X0} height={L.barH} fill="none" stroke={VIZ.grid} strokeWidth={1.5} rx={3} />
      {[DEN_POLAR, DEN_IONIC].map((v) => (
        <line key={v} x1={dx(v)} y1={L.barTop - 4} x2={dx(v)} y2={L.barTop + L.barH + 4} stroke={VIZ.muted} strokeWidth={1.5} strokeDasharray="4 3" />
      ))}
      {[0, DEN_POLAR, DEN_IONIC, DEN_MAX].map((v, i, all) => (
        <text key={v} x={dx(v)} y={L.values} textAnchor={i === 0 ? 'start' : i === all.length - 1 ? 'end' : 'middle'} className="viz-tick">
          {fmt(v, v === 0 ? 0 : 1)}
        </text>
      ))}
      {regions.map((g, i) => {
        const x = i === 0 ? dx(g.from) : (dx(g.from) + dx(g.to)) / 2;
        const on = g.cls === active;
        return (
          <g key={`n${g.cls}`}>
            {g.lines.map((line, j) => (
              <Txt key={line} x={x} y={j === 0 ? L.name1 : L.name2} anchor={i === 0 ? 'start' : 'middle'} color={on ? KIND_COLOR[g.cls] : undefined} muted={!on} weight={on ? 700 : 500} size={0.92}>
                {line}
              </Txt>
            ))}
          </g>
        );
      })}

      {/* Markøren for ΔEN */}
      <line x1={xm} y1={L.barTop - 6} x2={xm} y2={L.barTop + L.barH + 6} stroke={VIZ.ink} strokeWidth={3} />
      <polygon points={`${xm - 8},${L.barTop - 15} ${xm + 8},${L.barTop - 15} ${xm},${L.barTop - 4}`} fill={VIZ.ink} />
      <Txt x={ml.x} y={L.marker} anchor={ml.anchor} weight={700}>
        ΔEN = {fmt(r.dEN, 2)}
      </Txt>
    </g>
  );
}

/* ---------- Figur 2: selve bindingen ---------- */

interface SceneLayout {
  H: number;
  cy: number;
  caption: number;
}

function sceneLayout(r: BondAnalysis, f: number, k: number): SceneLayout {
  const caption = 26 * f;
  if (r.kind === 'ionisk' && r.ionic) {
    const rc = atomRadius(r.ionic.cation.symbol, { charge: r.ionic.cationCharge, scale: k }) * BIG;
    const ra = atomRadius(r.ionic.anion.symbol, { charge: r.ionic.anionCharge, scale: k }) * BIG;
    const R = Math.max(rc, ra);
    const cy = caption + 34 * f + 50 * k + R + 10;
    return { H: Math.round(cy + R + 30 * f + 34 * f + 16), cy, caption };
  }
  if (r.kind === 'metallisk') {
    const { s } = metalGrid(r, k);
    const cy = caption + 24 + 16 * k + s;
    return { H: Math.round(cy + s + 16 * k + 14), cy, caption };
  }
  const R = Math.max(atomRadius(r.a.symbol, { scale: k }), atomRadius(r.b.symbol, { scale: k })) * BIG;
  const cy = caption + 22 + 26 * f + R + 12 * k;
  return { H: Math.round(cy + R + 26 * k + 30 * f + 10), cy, caption };
}

function BondScene({ r, f, k, layout }: { r: BondAnalysis; f: number; k: number; layout: SceneLayout }) {
  if (r.kind === 'ionisk' && r.ionic) return <IonicScene r={r} f={f} k={k} layout={layout} />;
  if (r.kind === 'metallisk') return <MetallicScene r={r} k={k} layout={layout} />;
  return <CovalentScene r={r} f={f} k={k} layout={layout} />;
}

function CovalentScene({ r, f, k, layout }: { r: BondAnalysis; f: number; k: number; layout: SceneLayout }) {
  const { cy } = layout;
  const rA = atomRadius(r.a.symbol, { scale: k }) * BIG;
  const rB = atomRadius(r.b.symbol, { scale: k }) * BIG;
  const d = rA + rB + 8 * k;
  const xA = 400 - (d + rA + rB) / 2 + rA;
  const xB = xA + d;
  const polarBond = r.kind === 'polar';
  // P = positiv ende (eller A når ΔEN = 0), N = negativ ende
  const negIsB = r.negative ? r.negative.symbol === r.b.symbol && r.a.symbol !== r.b.symbol : true;
  const P = negIsB ? { x: xA, r: rA } : { x: xB, r: rB };
  const N = negIsB ? { x: xB, r: rB } : { x: xA, r: rA };
  const ic = polarBond || r.dEN > 0 ? r.ionicCharacter : 0;
  const t = 0.5 + 0.45 * ic;
  const ex = P.x + (N.x - P.x) * t;
  const pad = 13 * k;
  const yArrow = cy + Math.max(rA, rB) + 24 * k;
  const caption =
    r.dEN === 0
      ? 'Elektronparet deles helt likt'
      : polarBond
        ? `Elektronparet er forskjøvet mot ${r.negative!.symbol}`
        : 'Elektronparet deles nesten likt';
  return (
    <g>
      <Txt x={24} y={layout.caption} anchor="start" muted>
        {caption}
      </Txt>
      {/* Elektronskyen: større rundt atomet som trekker hardest */}
      <g opacity={0.2}>
        <circle cx={P.x} cy={cy} r={P.r + pad * (1 - 0.6 * ic)} fill={KJEMI.electron} />
        <circle cx={N.x} cy={cy} r={N.r + pad * (1 + 1.4 * ic)} fill={KJEMI.electron} />
      </g>
      <Atom x={xA} y={cy} el={r.a.symbol} r={rA} partial={polarBond ? (negIsB ? 'plus' : 'minus') : null} />
      <Atom x={xB} y={cy} el={r.b.symbol} r={rB} partial={polarBond ? (negIsB ? 'minus' : 'plus') : null} />
      {[-1, 1].map((s) => (
        <circle key={s} cx={ex} cy={cy + s * 7 * k} r={4.8 * k} fill={KJEMI.electron} stroke={VIZ.surface} strokeWidth={1.5} />
      ))}
      {polarBond && (
        <>
          <DipoleArrow from={{ x: P.x - (N.x - P.x) * 0.25, y: yArrow }} to={{ x: N.x + (N.x - P.x) * 0.25, y: yArrow }} />
          <Txt x={(P.x + N.x) / 2} y={yArrow + 28 * f} muted size={0.85}>
            dipol
          </Txt>
        </>
      )}
    </g>
  );
}

function IonicScene({ r, f, k, layout }: { r: BondAnalysis; f: number; k: number; layout: SceneLayout }) {
  const ion = r.ionic!;
  const { cy } = layout;
  const left = r.a;
  const right = r.b;
  const chargeOf = (e: Element) => (e.symbol === ion.cation.symbol ? ion.cationCharge : ion.anionCharge);
  const rL = atomRadius(left.symbol, { charge: chargeOf(left), scale: k }) * BIG;
  const rR = atomRadius(right.symbol, { charge: chargeOf(right), scale: k }) * BIG;
  const gap = 96 * k;
  const total = 2 * rL + gap + 2 * rR;
  const xL = 400 - total / 2 + rL;
  const xR = xL + rL + gap + rR;
  const catLeft = left.symbol === ion.cation.symbol;
  const cat = catLeft ? { x: xL, r: rL } : { x: xR, r: rR };
  const an = catLeft ? { x: xR, r: rR } : { x: xL, r: rL };
  // Buet pil for elektronene fra kationet til anionet
  const y0 = cy - cat.r - 8 * k;
  const y1 = cy - an.r - 8 * k;
  const ctrlY = Math.min(y0, y1) - 70 * k;
  const midX = (cat.x + an.x) / 2;
  const apexY = (y0 + 2 * ctrlY + y1) / 4;
  const endX = an.x - (an.x - cat.x) * 0.12;
  const ux = endX - midX;
  const uy = y1 - ctrlY;
  const ul = Math.hypot(ux, uy);
  const hx = ux / ul;
  const hy = uy / ul;
  const head = 12 * k;
  const nE = ion.cationCharge;
  const gained = -ion.anionCharge;
  const dotsAt = Array.from({ length: gained }, (_, i) => (catLeft ? 180 : 0) + (i - (gained - 1) / 2) * 24);
  const shellsText = (e: Element) => {
    const q = chargeOf(e);
    const after = ionShells(e, q);
    if (!e.bohrShells || !after) return null;
    return `${e.bohrShells.join(', ')} → ${after.join(', ')}`;
  };
  const sL = shellsText(left);
  const sR = shellsText(right);
  const yShell = cy + Math.max(rL, rR) + 30 * f;
  const ratio = `${ion.nCation} : ${ion.nAnion}`;
  return (
    <g>
      <Txt x={24} y={layout.caption} anchor="start" muted>
        {ion.cation.symbol} gir fra seg {nE === 1 ? 'ett elektron' : `${nE} elektroner`}, {ion.anion.symbol} tar opp{' '}
        {gained === 1 ? 'ett' : gained}
      </Txt>
      <path
        d={`M${cat.x + (an.x - cat.x) * 0.12},${y0} Q${midX},${ctrlY} ${endX - hx * head},${y1 - hy * head}`}
        fill="none"
        stroke={KJEMI.electron}
        strokeWidth={2.4 * k}
        strokeDasharray={`${7 * k} ${5 * k}`}
      />
      <polygon
        points={`${endX},${y1} ${endX - hx * head - hy * head * 0.5},${y1 - hy * head + hx * head * 0.5} ${endX - hx * head + hy * head * 0.5},${y1 - hy * head - hx * head * 0.5}`}
        fill={KJEMI.electron}
      />
      <Txt x={midX} y={apexY - 10 * f} color={KJEMI.electron} weight={700}>
        {nE === 1 ? '' : `${nE} `}e⁻
      </Txt>
      <Atom x={xL} y={cy} el={left.symbol} r={rL} charge={chargeOf(left)} />
      <Atom x={xR} y={cy} el={right.symbol} r={rR} charge={chargeOf(right)} />
      {dotsAt.map((deg) => {
        const p = polar(an.x, cy, an.r - 2 * k, deg);
        return <circle key={deg} cx={p.x} cy={p.y} r={4.8 * k} fill={KJEMI.electron} stroke={KJEMI.minus} strokeWidth={2 * k} />;
      })}
      {sL && (
        <Txt x={xL} y={yShell} muted size={0.85}>
          {sL}
        </Txt>
      )}
      {sR && (
        <Txt x={xR} y={yShell} muted size={0.85}>
          {sR}
        </Txt>
      )}
      <Txt x={400} y={yShell + 34 * f} size={0.95} weight={500}>
        <TFormel f={`${ion.cation.symbol}^${chargeText(ion.cationCharge).replace('−', '-')}`} /> og{' '}
        <TFormel f={`${ion.anion.symbol}^${chargeText(ion.anionCharge).replace('−', '-')}`} /> i forholdet {ratio} gir{' '}
        <tspan fontWeight={700}>
          <TFormel f={ion.formula} />
        </tspan>
      </Txt>
    </g>
  );
}

/** Rutenett av metallioner: størrelse og antall kolonner som får plass i figuren. */
function metalGrid(r: BondAnalysis, k: number) {
  const q = (e: Element) => e.ions.find((v) => v > 0) ?? 1;
  const rIon = Math.max(atomRadius(r.a.symbol, { charge: q(r.a), scale: k }), atomRadius(r.b.symbol, { charge: q(r.b), scale: k })) * 1.25;
  const s = 2 * rIon + 26 * k;
  const cols = Math.max(3, Math.min(7, Math.floor(700 / s)));
  return { rIon, s, cols, q };
}

function MetallicScene({ r, k, layout }: { r: BondAnalysis; k: number; layout: SceneLayout }) {
  const { s, cols, q } = metalGrid(r, k);
  const rows = 2;
  const w = cols * s;
  const x0 = 400 - w / 2;
  const y0 = layout.cy - s;
  const rnd = seededRandom(11);
  // Elektronene ligger i mellomrommene i gitteret (hjørner og kantmidtpunkter i rutene), litt tilfeldig forskjøvet.
  const electrons: { x: number; y: number }[] = [];
  for (let i = 0; i <= rows; i++)
    for (let j = 0; j <= cols; j++) {
      electrons.push({ x: x0 + j * s + (rnd() - 0.5) * 8 * k, y: y0 + i * s + (rnd() - 0.5) * 8 * k });
      if (j < cols && i > 0 && i < rows) electrons.push({ x: x0 + (j + 0.5) * s + (rnd() - 0.5) * 10 * k, y: y0 + i * s + (rnd() - 0.5) * 6 * k });
    }
  return (
    <g>
      <Txt x={24} y={layout.caption} anchor="start" muted>
        Positive metallioner i et «hav» av frie elektroner
      </Txt>
      <rect x={x0 - 14 * k} y={y0 - 14 * k} width={w + 28 * k} height={rows * s + 28 * k} rx={22 * k} fill={KJEMI.electron} opacity={0.13} />
      {Array.from({ length: rows * cols }, (_, i) => {
        const row = Math.floor(i / cols);
        const col = i % cols;
        const el = (row + col) % 2 === 0 ? r.a : r.b;
        const x = x0 + s / 2 + col * s;
        const y = y0 + s / 2 + row * s;
        const charge = q(el);
        return (
          <Atom
            key={i}
            x={x}
            y={y}
            el={el.symbol}
            r={atomRadius(el.symbol, { charge, scale: k }) * 1.25}
            label={
              <>
                {el.symbol}
                <tspan fontSize="0.55em" dy="-0.7em">
                  {chargeText(charge)}
                </tspan>
              </>
            }
          />
        );
      })}
      {electrons.map((e, i) => (
        <circle key={i} cx={e.x} cy={e.y} r={4.4 * k} fill={KJEMI.electron} stroke={VIZ.surface} strokeWidth={1.2} />
      ))}
    </g>
  );
}

/* ---------- Forklaring ---------- */

const name = (e: Element) => e.name;
const elektroner = (n: number) => (n === 1 ? 'ett elektron' : `${n} elektroner`);

function explanation(r: BondAnalysis): ReactNode {
  const ex = r.example ? <Formel f={r.example.formula} /> : 'forbindelsen';
  let main: ReactNode;
  switch (r.kind) {
    case 'upolar':
      main =
        r.dEN === 0 ? (
          <p>
            <strong>Upolar kovalent binding.</strong> To like atomer trekker like hardt i elektronene, så det felles elektronparet deles
            helt likt. Bindingen har ingen positiv eller negativ ende.
          </p>
        ) : (
          <p>
            <strong>Upolar kovalent binding.</strong> {capitalize(name(r.a))} og {name(r.b)} har nesten samme elektronegativitet (ΔEN ={' '}
            {fmt(r.dEN, 2)}, under 0,5), så elektronparet deles nesten likt. Bindingen regnes som upolar.
          </p>
        );
      break;
    case 'polar':
      main = (
        <p>
          <strong>Polar kovalent binding.</strong> {capitalize(name(r.negative!))} har høyere elektronegativitet (
          {fmt(r.negative!.electronegativity ?? 0, 2)}) enn {name(r.positive!)} ({fmt(r.positive!.electronegativity ?? 0, 2)}) og trekker det
          felles elektronparet mot seg. {r.negative!.symbol} får en negativ delladning δ− og {r.positive!.symbol} en positiv delladning δ+.
          Bindingen er en dipol, og pila peker mot den negative enden.
        </p>
      );
      break;
    case 'ionisk': {
      const ion = r.ionic!;
      main = (
        <p>
          <strong>Ionebinding.</strong> {capitalize(name(ion.cation))} gir fra seg {elektroner(ion.cationCharge)}, og {name(ion.anion)} tar
          opp {elektroner(-ion.anionCharge)}. Da får begge edelgasstruktur: <Formel f={`${ion.cation.symbol}^${ion.cationCharge}+`} /> og{' '}
          <Formel f={`${ion.anion.symbol}^${-ion.anionCharge}-`} />. De motsatt ladde ionene tiltrekker hverandre og bygger et ionegitter.
          Formelen <Formel f={ion.formula} /> viser forholdet mellom ionene, {ion.nCation} : {ion.nAnion}, så ladningene til sammen blir null.
        </p>
      );
      break;
    }
    case 'metallisk':
      main = (
        <p>
          <strong>Metallbinding.</strong>{' '}
          {r.a.symbol === r.b.symbol ? `${capitalize(name(r.a))} er et metall` : `Både ${name(r.a)} og ${name(r.b)} er metaller`} med lav
          elektronegativitet. Valenselektronene blir verken delt mellom to bestemte atomer eller gitt bort, men beveger seg fritt mellom
          positive metallioner. Derfor leder metaller strøm.{r.a.symbol !== r.b.symbol ? ' En blanding av to metaller kalles en legering.' : ''}
        </p>
      );
      break;
  }

  const metal = isMetal(r.a) ? r.a : r.b;
  const other = metal === r.a ? r.b : r.a;
  let note: ReactNode;
  switch (r.caveat) {
    case 'metall-ikke-metall':
      note = (
        <p>
          Etter tallet alene (ΔEN = {fmt(r.dEN, 2)}, ikke over 1,7) skulle bindingen vært polar kovalent. Men et metall og et ikke-metall gir
          som regel ionebinding, og {ex} er en ionisk forbindelse. Grensene på skalaen er retningslinjer, ikke skarpe skiller.
        </p>
      );
      break;
    case 'polariserende':
      note = (
        <p>
          {capitalize(name(metal))} er et metall, men {metal.symbol}-ionet er lite og har stor ladning, så det trekker elektronene til{' '}
          {name(other)} tilbake mot seg. Derfor er {ex} mer kovalent enn ionisk, slik ΔEN = {fmt(r.dEN, 2)} tilsier. Bindinger går gradvis
          fra kovalente til ioniske.
        </p>
      );
      break;
    case 'ikke-metaller':
      note = (
        <p>
          ΔEN = {fmt(r.dEN, 2)} er litt over 1,7, men {name(r.a)} og {name(r.b)} er ikke metaller, og de deler elektroner i stedet for å
          danne ioner. {ex} består av polare molekyler, ikke et ionegitter. Grensen 1,7 er en retningslinje.
        </p>
      );
      break;
    case 'halvmetall':
      note = (
        <p>
          {capitalize(name(metal))} er et metall, og {name(other)} står på grensen mellom metaller og ikke-metaller. Slike par danner
          legeringer eller spesielle forbindelser (karbider, silisider), og ΔEN-regelen gir bare en grov pekepinn.
        </p>
      );
      break;
    default:
      note =
        r.kind === 'metallisk' ? (
          <p>ΔEN-skalaen gjelder bindinger der minst ett av atomene er et ikke-metall. To metaller gir metallbinding uansett ΔEN.</p>
        ) : (
          <p>
            Grensene 0,5 og 1,7 er retningslinjer, ikke skarpe skiller: bindinger går gradvis fra upolare via polare til ioniske. En god
            tommelfingerregel er at metall + ikke-metall gir ionebinding, og ikke-metall + ikke-metall gir kovalent binding.
          </p>
        );
  }
  return (
    <>
      {main}
      {note}
    </>
  );
}
