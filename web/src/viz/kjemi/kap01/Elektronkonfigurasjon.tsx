import { useState, type ReactNode } from 'react';
import {
  Controls,
  ElectronShells,
  Explain,
  Figure,
  Formula,
  FormulaLine,
  KJEMI,
  Legend,
  Readout,
  Readouts,
  Slider,
  Sup,
  Txt,
  VIZ,
  VizLayout,
  capitalize,
  element,
  getElement,
  mixColor,
  superscript,
  useContainerTextScale,
  type Element,
} from '../kit';
import {
  CONFIG_EXCEPTIONS,
  CONFIG_Z_MAX,
  aufbauFill,
  electronConfiguration,
  newestElectron,
  orbitalBoxes,
  periodicPosition,
  shellCounts,
  shortConfigurationText,
  unpairedElectrons,
  valenceElectronCount,
  type ConfigBlock,
  type FilledSubshell,
} from './model';

/** Energinivået til hvert delskall i diagrammet (bare rekkefølgen og avstanden er ment å være riktig). */
const ENERGY: Record<string, number> = { '1s': 0, '2s': 1.2, '2p': 1.9, '3s': 3.05, '3p': 3.75, '4s': 4.8, '3d': 5.4, '4p': 6.1 };
const E_MAX = 6.1;
/** Skallmodellen: radius til innerste skall og avstand mellom skallene (ganges med atomskalaen k). */
const R0 = 40;
const DR = 26;
const BLOCK_COLOR: Record<ConfigBlock, string> = { s: VIZ.series[0]!, p: VIZ.series[1]!, d: VIZ.series[2]! };
const BLOCK_NAME: Record<ConfigBlock, string> = { s: 's-blokka', p: 'p-blokka', d: 'd-blokka' };

export default function Elektronkonfigurasjon() {
  const [Z, setZ] = useState(26);
  const [ref, f] = useContainerTextScale<HTMLDivElement>();
  const k = Math.max(1, 0.85 * f);
  const el = element(Z);
  const subs = electronConfiguration(Z);
  const pos = periodicPosition(Z);
  const shells = shellCounts(Z);
  const layout = atomLayout(f, k);
  const table = tableLayout(f);

  return (
    <VizLayout>
      <Controls>
        <Slider
          label="Protontall Z"
          value={Z}
          onChange={setZ}
          min={1}
          max={CONFIG_Z_MAX}
          step={1}
          format={(z) => `${z} (${getElement(z)?.symbol ?? ''}, ${getElement(z)?.name ?? ''})`}
        />
      </Controls>

      <div ref={ref}>
        <Figure
          viewBox={`0 0 800 ${layout.H}`}
          label={`${capitalize(el.name)} har ${Z} elektroner: ${shortConfigurationText(Z)}. Skall: ${shells.join(', ')}.`}
          maxHeight={layout.H}
        >
          <AtomFigure Z={Z} el={el} subs={subs} shells={shells} layout={layout} f={f} k={k} />
        </Figure>
      </div>
      <Legend
        items={[
          { color: KJEMI.valence, label: 'Valenselektroner (ytterste skall)' },
          { color: KJEMI.electron, label: 'Indre elektroner' },
        ]}
      />

      <Figure
        viewBox={`0 0 800 ${table.H}`}
        label={`${capitalize(el.name)} står i periode ${pos.period}, gruppe ${pos.group}, i ${BLOCK_NAME[pos.block]}.`}
        caption="Trykk på et grunnstoff for å velge det. Grunnstoffene til og med det valgte er farget sterkere: hvert nytt grunnstoff har ett elektron mer."
        maxHeight={table.H}
      >
        <MiniTable Z={Z} onPick={setZ} layout={table} f={f} />
      </Figure>
      <Legend
        items={[
          { color: BLOCK_COLOR.s, label: 's-blokka (s fylles sist)' },
          { color: BLOCK_COLOR.p, label: 'p-blokka' },
          { color: BLOCK_COLOR.d, label: 'd-blokka (overgangsmetaller)' },
        ]}
      />

      <Readouts>
        <Readout label="Kort skrivemåte" value={shortConfigurationText(Z)} />
        <Readout label="Valenselektroner" value={String(valenceElectronCount(Z))} tone={KJEMI.valence} />
        <Readout label="Plass i periodesystemet" value={`Periode ${pos.period}, gruppe ${pos.group}`} tone={BLOCK_COLOR[pos.block]} />
        <Readout label="Uparede elektroner" value={String(unpairedElectrons(Z))} />
      </Readouts>

      <Formula label="Elektronkonfigurasjonen">
        <FormulaLine>
          {el.symbol}: <ConfigHtml subs={subs} />
        </FormulaLine>
        <FormulaLine>
          Skall: {shells.join(', ')} (til sammen {Z} elektroner)
        </FormulaLine>
      </Formula>

      <Explain>{explanation(Z, el, subs)}</Explain>
    </VizLayout>
  );
}

/** «1s² 2s² 2p⁶» med ekte hevet skrift i HTML. */
function ConfigHtml({ subs }: { subs: readonly FilledSubshell[] }) {
  const filled = subs.filter((s) => s.electrons > 0);
  return (
    <>
      {filled.map((s, i) => (
        <span key={s.key}>
          {i > 0 ? ' ' : ''}
          {s.key}
          <Sup>{s.electrons}</Sup>
        </span>
      ))}
    </>
  );
}

/* ---------- Figur 1: skallmodell og orbitaldiagram ---------- */

interface AtomLayout {
  wide: boolean;
  bohr: { x: number; y: number; title: number; caption: number };
  diagram: { x0: number; top: number; title: number; titleX: number; u: number; b: number; bh: number; labW: number; gap: number };
  H: number;
}

function atomLayout(f: number, k: number): AtomLayout {
  const wide = f <= 1.3;
  const R = R0 * k + 3 * DR * k + 6 * k;
  const labW = 34 * f;
  const gap = 22 * k;
  // Boksene krymper hvis diagrammet ellers ikke får plass ved siden av energiaksen (smal skjerm).
  const b = Math.min(34 * k, (800 - 44 * f - 16 - 3 * labW - 2 * gap) / 9);
  const bh = 34 * k;
  const u = Math.max(42 * k, (bh + 10) / 1.15);
  const dW = 3 * labW + 9 * b + 2 * gap;
  const dH = E_MAX * u + bh;
  if (wide) {
    const title = 24 * f;
    const by = title + 22 * f + R;
    const top = title + 26 * f;
    const x0 = 800 - 16 - dW;
    const caption = by + R + 30 * f;
    return {
      wide,
      bohr: { x: 175, y: by, title, caption },
      diagram: { x0, top, title, titleX: x0 + dW / 2, u, b, bh, labW, gap },
      H: Math.round(Math.max(caption + 12 * f, top + dH + 30 * f)),
    };
  }
  const title = 24 * f;
  const by = title + 18 * f + R;
  const caption = by + R + 32 * f;
  const dTitle = caption + 52 * f;
  const top = dTitle + 22 * f;
  const x0 = Math.min(800 - 8 - dW, Math.max(44 * f, (800 - dW) / 2 + 20 * f));
  return {
    wide,
    bohr: { x: 400, y: by, title, caption },
    diagram: { x0, top, title: dTitle, titleX: 400, u, b, bh, labW, gap },
    H: Math.round(top + dH + 34 * f),
  };
}

function AtomFigure({
  Z,
  el,
  subs,
  shells,
  layout,
  f,
  k,
}: {
  Z: number;
  el: Element;
  subs: FilledSubshell[];
  shells: number[];
  layout: AtomLayout;
  f: number;
  k: number;
}) {
  const { bohr } = layout;
  return (
    <g>
      <Txt x={bohr.x} y={bohr.title} muted size={0.9}>
        Skallmodell
      </Txt>
      <ElectronShells x={bohr.x} y={bohr.y} el={el.symbol} shells={shells} r0={R0 * k} dr={DR * k} />
      <Txt x={bohr.x} y={bohr.caption} size={0.9}>
        Skall: {shells.join(', ')}
      </Txt>
      <OrbitalDiagram Z={Z} subs={subs} layout={layout} f={f} k={k} />
    </g>
  );
}

const COLS: { l: number; boxes: number }[] = [
  { l: 0, boxes: 1 },
  { l: 1, boxes: 3 },
  { l: 2, boxes: 5 },
];

function OrbitalDiagram({ Z, subs, layout, f, k }: { Z: number; subs: FilledSubshell[]; layout: AtomLayout; f: number; k: number }) {
  const d = layout.diagram;
  const period = shellCounts(Z).length;
  const newest = newestElectron(Z);
  const exception = CONFIG_EXCEPTIONS[Z];
  const bottom = d.top + E_MAX * d.u;
  // Venstre kant for hver kolonne (s, p, d)
  const colX: number[] = [];
  let cursor = d.x0;
  for (const c of COLS) {
    colX.push(cursor + d.labW);
    cursor += d.labW + c.boxes * d.b + d.gap;
  }
  const yOf = (key: string) => bottom - (ENERGY[key] ?? 0) * d.u;
  const geo = (s: FilledSubshell) => ({ x: colX[s.l]!, y: yOf(s.key) });
  const arrowX = d.x0 - 14 * k;
  const s4 = subs.find((s) => s.key === '4s')!;
  const d3 = subs.find((s) => s.key === '3d')!;
  return (
    <g>
      <Txt x={d.titleX} y={d.title} muted size={0.9}>
        Orbitaler ordnet etter energi
      </Txt>
      {/* Energiakse */}
      <line x1={arrowX} y1={bottom + d.bh} x2={arrowX} y2={d.top - 4} stroke={VIZ.muted} strokeWidth={1.6} />
      <polygon points={`${arrowX},${d.top - 12} ${arrowX - 5},${d.top - 1} ${arrowX + 5},${d.top - 1}`} fill={VIZ.muted} />
      <Txt x={arrowX - 8} y={d.top + 4 * f} anchor="end" muted size={0.75}>
        E
      </Txt>
      {subs.map((s, i) => {
        const g = geo(s);
        const boxes = orbitalBoxes(s.electrons, s.orbitals);
        const empty = s.electrons === 0;
        const valence = s.n === period;
        const color = valence ? KJEMI.valence : KJEMI.electron;
        return (
          <g key={s.key} opacity={empty ? 0.45 : 1}>
            <Txt x={g.x - 8} y={g.y + d.bh / 2 + 6 * f} anchor="end" size={0.9} weight={empty ? 500 : 700} muted={empty}>
              {s.key}
            </Txt>
            {boxes.map((b, j) => {
              const x = g.x + j * d.b;
              const isNew = newest.subshell === i && newest.box === j;
              return (
                <g key={j}>
                  <rect
                    x={x}
                    y={g.y}
                    width={d.b}
                    height={d.bh}
                    fill={isNew ? mixColor(VIZ.surface, KJEMI.valence, 0.22) : VIZ.surface}
                    stroke={empty ? VIZ.muted : VIZ.ink}
                    strokeWidth={1.4}
                    strokeDasharray={empty ? '4 3' : undefined}
                  />
                  {b >= 1 && <SpinArrow x={x + d.b * 0.32} y={g.y} h={d.bh} up color={color} k={k} />}
                  {b === 2 && <SpinArrow x={x + d.b * 0.68} y={g.y} h={d.bh} up={false} color={color} k={k} />}
                </g>
              );
            })}
          </g>
        );
      })}
      {exception && (
        <ExceptionMark from={geo(s4)} to={{ x: geo(d3).x + (d3.orbitals - 1) * d.b, y: geo(d3).y }} b={d.b} bh={d.bh} f={f} k={k} label={layout.wide ? 'unntak: ett elektron 4s → 3d' : 'unntak: 4s → 3d'} />
      )}
      {Z >= 19 && !exception && Z <= 20 && (
        <Txt x={geo(d3).x + 2.5 * d.b} y={geo(d3).y - 8 * f} muted size={0.75}>
          3d fylles etter 4s
        </Txt>
      )}
    </g>
  );
}

/** Elektron som pil opp (spinn opp) eller ned. */
function SpinArrow({ x, y, h, up, color, k }: { x: number; y: number; h: number; up: boolean; color: string; k: number }) {
  const y1 = y + h * 0.18;
  const y2 = y + h * 0.82;
  const head = 6 * k;
  const tip = up ? y1 : y2;
  const base = up ? y1 + head : y2 - head;
  return (
    <g>
      <line x1={x} y1={up ? y2 : y1} x2={x} y2={base} stroke={color} strokeWidth={2.2 * k} strokeLinecap="round" />
      <polygon points={`${x},${tip} ${x - 4 * k},${base + (up ? 1 : -1)} ${x + 4 * k},${base + (up ? 1 : -1)}`} fill={color} />
    </g>
  );
}

/** Unntaket (Cr, Cu): stiplet pil fra den tomme plassen i 4s til det nye elektronet i 3d, under 3d-raden. */
function ExceptionMark({
  from,
  to,
  b,
  bh,
  f,
  k,
  label,
}: {
  from: { x: number; y: number };
  to: { x: number; y: number };
  b: number;
  bh: number;
  f: number;
  k: number;
  label: string;
}) {
  const gx = from.x + b * 0.68;
  const gy = from.y + bh * 0.5;
  const sx = from.x + b + 3 * k;
  const ex = to.x + b * 0.5;
  const ey = to.y + bh + 3 * k;
  const cx = (sx + ex) / 2;
  const cy = Math.max(gy, ey) + 16 * k;
  const head = 9 * k;
  // Retningen inn mot spissen
  const ux = ex - cx;
  const uy = ey - cy;
  const ul = Math.hypot(ux, uy) || 1;
  const hx = ux / ul;
  const hy = uy / ul;
  return (
    <g>
      <circle cx={gx} cy={gy} r={7 * k} fill="none" stroke={KJEMI.valence} strokeWidth={1.6} strokeDasharray="3 3" />
      <path d={`M${sx},${gy} Q${cx},${cy} ${ex - hx * head},${ey - hy * head}`} fill="none" stroke={KJEMI.valence} strokeWidth={2 * k} strokeDasharray={`${6 * k} ${4 * k}`} />
      <polygon
        points={`${ex},${ey} ${ex - hx * head - hy * head * 0.5},${ey - hy * head + hx * head * 0.5} ${ex - hx * head + hy * head * 0.5},${ey - hy * head - hx * head * 0.5}`}
        fill={KJEMI.valence}
      />
      <Txt x={to.x + b} y={ey + 36 * f} anchor="end" color={KJEMI.valence} size={0.8} weight={700}>
        {label}
      </Txt>
    </g>
  );
}

/* ---------- Figur 2: lite periodesystem ---------- */

interface TableLayout {
  x0: number;
  cell: number;
  cellH: number;
  head: number;
  top: number;
  note1: number;
  note2: number;
  H: number;
}

function tableLayout(f: number): TableLayout {
  const x0 = 26 * f;
  const cell = (800 - x0 - 4) / 18;
  const cellH = Math.max(cell * 1.05, 40);
  const head = 18 * f;
  const top = head + 10 * f;
  const note1 = top + 4 * cellH + 34 * f;
  const note2 = note1 + 26 * f;
  return { x0, cell, cellH, head, top, note1, note2, H: Math.round(note2 + 14 * f) };
}

function MiniTable({ Z, onPick, layout, f }: { Z: number; onPick: (z: number) => void; layout: TableLayout; f: number }) {
  const { x0, cell, cellH, top } = layout;
  const pos = periodicPosition(Z);
  const el = element(Z);
  const cells: ReactNode[] = [];
  for (let z = 1; z <= CONFIG_Z_MAX; z++) {
    const e = element(z);
    const p = periodicPosition(z);
    const x = x0 + (p.group - 1) * cell;
    const y = top + (p.period - 1) * cellH;
    const on = z === Z;
    const done = z <= Z;
    cells.push(
      <g key={z} onClick={() => onPick(z)} style={{ cursor: 'pointer' }}>
        <rect
          x={x + 1.5}
          y={y + 1.5}
          width={cell - 3}
          height={cellH - 3}
          rx={4}
          fill={mixColor(VIZ.surface, BLOCK_COLOR[p.block], done ? 0.42 : 0.12)}
          stroke={on ? VIZ.ink : VIZ.grid}
          strokeWidth={on ? 3 : 1}
        />
        <text
          x={x + cell / 2}
          y={y + cellH / 2 + cell * 0.16}
          textAnchor="middle"
          style={{ fill: VIZ.ink, fontSize: cell * 0.44, fontWeight: on ? 800 : 600, opacity: done ? 1 : 0.6 }}
        >
          {e.symbol}
        </text>
      </g>,
    );
  }
  const groupNo = [1, 2, 13, 14, 15, 16, 17, 18, 3, 8, 12];
  const s = subsText(Z);
  return (
    <g>
      {groupNo.map((g) => (
        <Txt key={g} x={x0 + (g - 0.5) * cell} y={layout.head} muted size={0.65}>
          {g}
        </Txt>
      ))}
      {[1, 2, 3, 4].map((p) => (
        <Txt key={p} x={x0 - 8} y={top + (p - 0.5) * cellH + 6 * f} anchor="end" muted size={0.75} weight={p === pos.period ? 700 : 500} color={p === pos.period ? VIZ.ink : undefined}>
          {p}
        </Txt>
      ))}
      {/* Raden og kolonnen til det valgte grunnstoffet */}
      <rect x={x0 + 0.5} y={top + (pos.period - 1) * cellH + 0.5} width={18 * cell - 1} height={cellH - 1} rx={6} fill="none" stroke={VIZ.muted} strokeWidth={1.2} strokeDasharray="5 4" />
      {cells}
      <Txt x={x0} y={layout.note1} anchor="start" size={0.85}>
        <tspan fontWeight={700}>Periode {pos.period}</tspan>: {el.name} har elektroner i {pos.period === 1 ? 'ett skall' : `${pos.period} skall`}.
      </Txt>
      <Txt x={x0} y={layout.note2} anchor="start" size={0.85}>
        <tspan fontWeight={700}>Gruppe {pos.group}</tspan>: {s}
      </Txt>
    </g>
  );
}

/** Hvordan gruppa følger av konfigurasjonen, som kort tekst. */
function subsText(Z: number): string {
  const pos = periodicPosition(Z);
  const subs = electronConfiguration(Z);
  const outerS = subs.find((s) => s.n === pos.period && s.l === 0)!;
  if (Z === 2) return 'fullt skall (1s²), som de andre edelgassene.';
  if (pos.block === 's') return `${outerS.key}${superscript(outerS.electrons)} gir ${outerS.electrons === 1 ? 'ett valenselektron' : 'to valenselektroner'}.`;
  if (pos.block === 'p') {
    const p = subs.find((s) => s.n === pos.period && s.l === 1)!;
    return `${outerS.electrons} + ${p.electrons} valenselektroner, gruppe 10 + ${outerS.electrons + p.electrons} = ${pos.group}.`;
  }
  const d = subs.find((s) => s.n === pos.period - 1 && s.l === 2)!;
  return `${outerS.electrons} s-elektroner + ${d.electrons} d-elektroner = ${pos.group}.`;
}

/* ---------- Forklaring ---------- */

function explanation(Z: number, el: Element, subs: FilledSubshell[]): ReactNode {
  const pos = periodicPosition(Z);
  const v = valenceElectronCount(Z);
  const name = capitalize(el.name);
  const short = shortConfigurationText(Z);
  const exception = CONFIG_EXCEPTIONS[Z];
  const p = subs.find((s) => s.n === pos.period && s.l === 1);
  const vText = v === 1 ? 'ett valenselektron' : `${v} valenselektroner`;
  const main: ReactNode = (() => {
    if (Z <= 2)
      return (
        <p>
          <strong>{name} ({short}).</strong> Det første skallet har bare én orbital, 1s, med plass til to elektroner med motsatt spinn.{' '}
          {Z === 1
            ? 'Hydrogen har ett elektron og står i gruppe 1, men er et ikke-metall.'
            : 'Helium har fullt skall og står derfor i gruppe 18 sammen med de andre edelgassene, selv om det bare har to valenselektroner.'}
        </p>
      );
    if (exception)
      return (
        <p>
          <strong>
            {name} er et unntak: {short}.
          </strong>{' '}
          Etter oppbyggingsprinsippet skulle {el.name} hatt {shortConfigurationText(Z, aufbauFill(Z))}, men ett elektron fra 4s går over i 3d.
          Da blir 3d {exception === 'halvfullt' ? 'halvfullt, med fem uparede elektroner' : 'helt fullt'}, og et{' '}
          {exception === 'halvfullt' ? 'halvfullt' : 'fullt'} d-delskall gir lavere energi enn det 4s-elektronet «koster».
        </p>
      );
    if (pos.block === 'd')
      return (
        <p>
          <strong>
            {name} er et overgangsmetall ({short}).
          </strong>{' '}
          4s har litt lavere energi enn 3d, så 4s fylles først. I overgangsmetallene fylles 3d, som hører til det nest ytterste skallet: det
          ytterste skallet beholder {v === 1 ? 'ett elektron' : 'to elektroner'} mens skall 3 vokser fra 8 mot 18. Gruppa er summen av
          s- og d-elektronene, {pos.group}.
        </p>
      );
    if (pos.group === 18)
      return (
        <p>
          <strong>
            {name} er en edelgass ({short}).
          </strong>{' '}
          Det ytterste skallet har åtte elektroner (s² p⁶), og alle orbitalene er fylt med elektronpar. Det gir et stabilt atom som nesten ikke
          reagerer. Neste elektron må inn i et nytt skall, og da starter en ny periode.
        </p>
      );
    return (
      <p>
        <strong>
          {name} har {vText} ({short}).
        </strong>{' '}
        Det ytterste skallet er skall {pos.period}, så {el.name} står i periode {pos.period}.{' '}
        {pos.block === 's'
          ? `Antall valenselektroner gir gruppe ${pos.group}.`
          : `I p-blokka er gruppa 10 + antall valenselektroner, altså ${pos.group}.`}{' '}
        Grunnstoffer i samme gruppe har like mange valenselektroner og derfor lignende kjemiske egenskaper.
      </p>
    );
  })();
  let note: ReactNode = null;
  if (Z === 19 || Z === 20)
    note = (
      <p>
        Etter 3p kommer 4s, ikke 3d: 4s har lavere energi. Derfor får {el.name} skallene {shellCounts(Z).join(', ')} og ikke 2, 8, 9
        {Z === 20 ? ' eller 2, 8, 10' : ''}. Skall 3 kan egentlig romme 18 elektroner, men fylles helt først i overgangsmetallene.
      </p>
    );
  else if (p && p.electrons >= 2 && p.electrons <= 4)
    note = (
      <p>
        Hunds regel: elektronene i {p.key} fordeler seg i hver sin orbital før de danner par, fordi elektroner frastøter hverandre. Derfor har{' '}
        {el.name} {unpairedElectrons(Z) === 1 ? 'ett uparet elektron' : `${unpairedElectrons(Z)} uparede elektroner`}.
      </p>
    );
  else if (pos.block === 'd' && !exception)
    note = (
      <p>
        Hunds regel gjelder også i 3d: de fem orbitalene får ett elektron hver før noen pares. {capitalize(el.name)} har{' '}
        {unpairedElectrons(Z) === 0 ? 'ingen uparede elektroner' : unpairedElectrons(Z) === 1 ? 'ett uparet elektron' : `${unpairedElectrons(Z)} uparede elektroner`}.
      </p>
    );
  return (
    <>
      {main}
      {note}
    </>
  );
}
