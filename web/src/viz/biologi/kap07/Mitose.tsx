import { useState, type ReactNode } from 'react';
import {
  BIO,
  Cellemembran,
  Controls,
  Explain,
  Figure,
  Formula,
  FormulaLine,
  Kromatide,
  Legend,
  PlayBar,
  Plot,
  Readout,
  Readouts,
  Segmented,
  Slider,
  Toolbar,
  Txt,
  VIZ,
  VizLayout,
  cellOutlinePath,
  fmt,
  fmtPct,
  layoutPhase,
  linePath,
  roundedRectPath,
  useContainerTextScale,
  useLineScale,
  type Box,
  type DivisionLayout,
  type Ellipse,
} from '../kit';
import { Callouts, Sentromer, sceneFrame, useStepClock, type Callout } from './felles';
import { CYCLE, CYCLE_HOURS, cycleCounts, cycleTime, dnaAmount, mitosisShare, replicatedCount, stepStart, type CycleStep } from './model';

type CellType = 'dyr' | 'plante';

/** Sekunder avspilling per fase (alle fasene får like lang tid, se forklaringen under grafen). */
const STAGE_SECONDS = 2.4;
/** Fasen som vises når siden åpnes (metafasen). */
const INITIAL_STEP = 4;

export default function Mitose() {
  const [type, setType] = useState<CellType>('dyr');
  const [n, setN] = useState<2 | 3>(2);
  const { clock, step, u, goTo } = useStepClock(CYCLE.length, STAGE_SECONDS, INITIAL_STEP);
  const info = CYCLE[step]!;
  const hours = cycleTime(step, u);
  const sProgress = info.id === 'S' ? u : step > 1 ? 1 : 0;
  const counts = cycleCounts(info.id, 2 * n, sProgress);
  const [ref, f] = useContainerTextScale<HTMLDivElement>();
  const dna = counts.dnaPerCell;

  return (
    <VizLayout>
      <Toolbar>
        <Segmented
          label="Celletype"
          options={[
            { value: 'dyr', label: 'Dyrecelle' },
            { value: 'plante', label: 'Plantecelle' },
          ]}
          value={type}
          onChange={setType}
        />
        <Segmented
          label="Antall kromosomer"
          options={[
            { value: '2', label: '2n = 4' },
            { value: '3', label: '2n = 6' },
          ]}
          value={String(n) as '2' | '3'}
          onChange={(v) => setN(v === '3' ? 3 : 2)}
        />
      </Toolbar>
      <Controls>
        <Slider label="Fase" value={step} onChange={goTo} min={0} max={CYCLE.length - 1} step={1} format={(v) => CYCLE[v]?.name ?? ''} />
      </Controls>
      <Toolbar>
        <PlayBar clock={clock} time={`${fmt(hours, 1)} timer inn i syklusen`} />
      </Toolbar>

      <div ref={ref}>
        <DivisionScene id={info.id} step={step} u={u} n={n} type={type} f={f} />
      </div>
      <Legend
        items={[
          { color: BIO.kromosom.mor[0], label: 'Kromosom fra mor' },
          {
            color: BIO.kromosom.far[0],
            label: 'Kromosom fra far (samme farge = homologt par)',
          },
          { color: BIO.cytoskjelett, label: 'Spoletråder' },
        ]}
      />

      <DnaPlot hours={hours} id={info.id} />

      <Readouts>
        <Readout label="Fase" value={info.name} />
        <Readout
          label={counts.cells === 2 ? 'Kromosomer per dattercelle' : 'Kromosomer i cella'}
          value={String(counts.chromosomesPerCell)}
          unit={info.id === 'anafase' || info.id === 'telofase' ? `(2 · ${2 * n})` : undefined}
        />
        <Readout
          label="Kromatider per kromosom"
          value={info.id === 'S' && sProgress < 1 ? '1 → 2' : String(counts.chromatidsPerChromosome)}
        />
        <Readout label={counts.cells === 2 ? 'DNA per dattercelle' : 'DNA i cella'} value={`${fmt(dna, Number.isInteger(dna) ? 0 : 1)}c`} />
      </Readouts>

      <Formula label="DNA-mengde og tid">
        <FormulaLine>DNA per celle: 2c i G1 → 4c etter S-fasen → 2c i hver dattercelle</FormulaLine>
        <FormulaLine>c = DNA-mengden i ett kromosomsett (n = {n} kromosomer)</FormulaLine>
        <FormulaLine>
          Mitosen tar ca. {fmt(CYCLE_HOURS * mitosisShare(), 0)} time, bare {fmtPct(mitosisShare())} av en cellesyklus på{' '}
          {fmt(CYCLE_HOURS, 0)} timer.
        </FormulaLine>
      </Formula>

      <Explain>{explanation(info.id, type, n, sProgress)}</Explain>
    </VizLayout>
  );
}

/* ====================================================================== */
/* Cellefiguren                                                             */
/* ====================================================================== */

function DivisionScene({ id, step, u, n, type, f }: { id: CycleStep; step: number; u: number; n: 2 | 3; type: CellType; f: number }) {
  const lw = useLineScale();
  const narrow = f > 1.3;
  const frame = sceneFrame(f, { desktopH: 380 });
  const { H, box, inner } = frame;
  const wall = type === 'plante' ? 9 : 0;
  const cellBox: Box = {
    x: inner.x + wall,
    y: inner.y + wall,
    w: inner.w - 2 * wall,
    h: inner.h - 2 * wall,
  };
  const info = CYCLE[step]!;
  const lay = layoutPhase({
    deling: 'mitose',
    fase: info.fase,
    n,
    box: cellBox,
    replikert: step >= 1,
  });
  const mother = layoutPhase({
    deling: 'mitose',
    fase: 'interfase',
    n,
    box: cellBox,
  }).celler[0]!;
  // S-fasen: de første k kromosomene er kopiert; resten har bare én kromatide
  const hidden = new Set<string>();
  if (id === 'S') {
    const k = replicatedCount(lay.sentromerer.length, u);
    for (const s of lay.sentromerer.slice(k)) hidden.add(s.b);
  }
  if (id === 'G1') for (const s of lay.sentromerer) hidden.add(s.b);
  // Cytokinese i dyrecellen: dattercellene glir litt fra hverandre
  const gap = id === 'cytokinese' && type === 'dyr' ? 44 : 0;
  const dx = (celle: number) => (lay.celler.length === 2 ? (celle === 0 ? -gap / 2 : gap / 2) : 0);
  const shiftE = (e: Ellipse, celle: number): Ellipse => ({
    ...e,
    cx: e.cx + dx(celle),
  });
  const twoNuclei = lay.kjerner.length === 2;
  const showNucleolus = id === 'G1' || id === 'S' || id === 'G2';
  const callouts = mitosisCallouts(id, lay, type, mother, dx, hidden).map((c) => ({ ...c, ...frame.map(c) }));
  const label = `${CYCLE[step]!.name} i en ${type === 'dyr' ? 'dyrecelle' : 'plantecelle'} med 2n = ${2 * n} kromosomer.`;

  return (
    <Figure viewBox={`0 0 800 ${H}`} maxHeight={narrow ? 900 : Math.round(H * 1.15)} label={label}>
      <g transform={frame.transform || undefined}>
        {type === 'dyr' ? <AnimalCell id={id} lay={lay} shiftE={shiftE} /> : <PlantCell id={id} mother={mother} wall={wall} />}
        {lay.kjerner.map((k, i) => {
          const e = shiftE(k, twoNuclei ? i : 0);
          return (
            <g key={`k${i}`}>
              <ellipse
                cx={e.cx}
                cy={e.cy}
                rx={e.rx}
                ry={e.ry}
                fill={BIO.kjerne.fill}
                fillOpacity={k.opploses ? 0.4 : 1}
                stroke={BIO.kjerne.line}
                strokeWidth={1.6 * lw}
                strokeDasharray={k.opploses ? '7 7' : undefined}
              />
              {showNucleolus && (
                <circle
                  cx={e.cx + e.rx * 0.42}
                  cy={e.cy - e.ry * 0.45}
                  r={Math.min(e.rx, e.ry) * 0.16}
                  fill={BIO.kjernelegeme}
                  opacity={0.85}
                />
              )}
            </g>
          );
        })}
        {lay.ekvatorplan.map((e, i) => (
          <line
            key={`e${i}`}
            x1={e.x}
            y1={e.y0}
            x2={e.x}
            y2={e.y1}
            stroke={VIZ.muted}
            strokeWidth={1.4 * lw}
            strokeDasharray="5 6"
            opacity={0.8}
          />
        ))}
        {lay.spoler.map((s, i) => (
          <g key={`s${i}`}>
            {s.fibre.map(([a, b], j) => (
              <line key={j} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={BIO.cytoskjelett} strokeWidth={1.2 * lw} />
            ))}
            {s.poler.map((p, j) => (
              <Pole key={j} x={p.x} y={p.y} centrioles={type === 'dyr'} />
            ))}
          </g>
        ))}
        {[...lay.kromatider]
          .sort((a, b) => (a.key < b.key ? -1 : 1))
          .map((k) =>
            hidden.has(k.key) ? null : (
              <Kromatide
                key={k.key}
                x={k.x + dx(k.celle)}
                y={k.y}
                lengde={k.lengde}
                bredde={k.bredde}
                sentromer={k.sentromer}
                rot={k.rot}
                armU={k.armU}
                armL={k.armL}
                par={k.par}
                opphav={k.opphav}
                segmenter={k.segmenter}
                kondensert={k.kondensert}
                sentromerPrikk={!lay.sentromerer.some((s) => s.a === k.key || s.b === k.key)}
              />
            ),
          )}
        {lay.sentromerer.map((s) => {
          const a = lay.kromatider.find((k) => k.key === s.a);
          return a && a.kondensert ? (
            <Sentromer key={`${s.a}+`} x={s.x + dx(a.celle)} y={s.y} rot={a.rot} W={a.bredde} par={s.par} opphav={s.opphav} />
          ) : null;
        })}
        {type === 'dyr' && <AnimalMembrane id={id} lay={lay} shiftE={shiftE} />}
      </g>
      <Callouts items={callouts} box={box} bands={frame.bands} />
    </Figure>
  );
}

/** Spolepol: i dyreceller to sentrioler (vinkelrett på hverandre), i planteceller bare en pol uten sentrioler. */
function Pole({ x, y, centrioles }: { x: number; y: number; centrioles: boolean }) {
  return (
    <g>
      <circle cx={x} cy={y} r={8} fill={BIO.cytoskjelett} opacity={0.35} />
      {centrioles ? (
        <g>
          <rect x={x - 2.5} y={y - 6.5} width={5} height={13} rx={2} fill={VIZ.muted} />
          <rect x={x - 6.5} y={y - 2.5} width={13} height={5} rx={2} fill={VIZ.muted} />
        </g>
      ) : (
        <circle cx={x} cy={y} r={3} fill={VIZ.muted} />
      )}
    </g>
  );
}

function animalOutlines(id: CycleStep, lay: DivisionLayout, shiftE: (e: Ellipse, i: number) => Ellipse): string[] {
  if (lay.celler.length === 2 && id === 'telofase') return [cellOutlinePath(lay.celler[0]!, lay.celler[1]!, 0.42)];
  // Etter delingen runder dattercellene seg litt
  if (lay.celler.length === 2) return lay.celler.map((c, i) => cellOutlinePath({ ...shiftE(c, i), ry: c.ry * 0.86 }));
  return [cellOutlinePath(lay.celler[0]!)];
}

function AnimalCell({ id, lay, shiftE }: { id: CycleStep; lay: DivisionLayout; shiftE: (e: Ellipse, i: number) => Ellipse }) {
  return (
    <g>
      {animalOutlines(id, lay, shiftE).map((d, i) => (
        <path key={i} d={d} fill={BIO.cytoplasma} />
      ))}
    </g>
  );
}

function AnimalMembrane({ id, lay, shiftE }: { id: CycleStep; lay: DivisionLayout; shiftE: (e: Ellipse, i: number) => Ellipse }) {
  return (
    <g>
      {animalOutlines(id, lay, shiftE).map((d, i) => (
        <Cellemembran key={i} d={d} />
      ))}
    </g>
  );
}

/** Plantecelle: kantete celle med cellevegg; celleplate i telofasen og ny cellevegg etter cytokinesen. */
function PlantCell({ id, mother, wall }: { id: CycleStep; mother: Ellipse; wall: number }) {
  const lw = useLineScale();
  const r = {
    x: mother.cx - mother.rx,
    y: mother.cy - mother.ry,
    w: 2 * mother.rx,
    h: 2 * mother.ry,
  };
  const outer = roundedRectPath(r.x - wall, r.y - wall, r.w + 2 * wall, r.h + 2 * wall, 16);
  const cx = mother.cx;
  const split = id === 'cytokinese';
  const halves = split
    ? [roundedRectPath(r.x, r.y, cx - wall / 2 - r.x, r.h, 9), roundedRectPath(cx + wall / 2, r.y, r.x + r.w - cx - wall / 2, r.h, 9)]
    : [roundedRectPath(r.x, r.y, r.w, r.h, 9)];
  // Celleplate: vesikler fra golgiapparatet på rekke i ekvatorplanet, som vokser utover fra midten
  const plate = id === 'telofase';
  const nV = 11;
  const plateH = r.h * 0.66;
  return (
    <g>
      <path d={outer} fill={BIO.cellevegg.fill} stroke={BIO.cellevegg.line} strokeWidth={1.8 * lw} />
      {halves.map((d, i) => (
        <path key={i} d={d} fill={BIO.cytoplasma} />
      ))}
      {split && <rect x={cx - wall / 2} y={r.y - wall} width={wall} height={r.h + 2 * wall} fill={BIO.cellevegg.fill} />}
      {split && (
        <g stroke={BIO.cellevegg.line} strokeWidth={1.6 * lw}>
          <line x1={cx - wall / 2} y1={r.y} x2={cx - wall / 2} y2={r.y + r.h} />
          <line x1={cx + wall / 2} y1={r.y} x2={cx + wall / 2} y2={r.y + r.h} />
        </g>
      )}
      {halves.map((d, i) => (
        <Cellemembran key={`m${i}`} d={d} />
      ))}
      {plate && (
        <g>
          <line
            x1={cx}
            y1={mother.cy - plateH * 0.22}
            x2={cx}
            y2={mother.cy + plateH * 0.22}
            stroke={BIO.golgi.line}
            strokeWidth={6}
            strokeLinecap="round"
            opacity={0.85}
          />
          {Array.from({ length: nV }, (_, i) => {
            const y = mother.cy - plateH / 2 + (plateH * i) / (nV - 1);
            return <circle key={i} cx={cx} cy={y} r={5.5} fill={BIO.golgi.fill} stroke={BIO.golgi.line} strokeWidth={1.3 * lw} />;
          })}
        </g>
      )}
    </g>
  );
}

/** Punkt på en ellipse ved vinkelen `deg` (0 = høyre, 90 = ned). */
function onEllipse(e: Ellipse, deg: number): { x: number; y: number } {
  const a = (deg * Math.PI) / 180;
  return { x: e.cx + e.rx * Math.cos(a), y: e.cy + e.ry * Math.sin(a) };
}

function mitosisCallouts(
  id: CycleStep,
  lay: DivisionLayout,
  type: CellType,
  mother: Ellipse,
  dx: (celle: number) => number,
  hidden: Set<string>,
): Callout[] {
  const out: Callout[] = [];
  const nuc = lay.kjerner[0];
  const spindle = lay.spoler[0];
  const boundary = (): Callout =>
    type === 'dyr'
      ? { ...onEllipse(mother, -35), text: 'Cellemembran' }
      : {
          x: mother.cx + mother.rx + 4,
          y: mother.cy - mother.ry * 0.55,
          text: 'Cellevegg',
        };
  const fibre = (): Callout | null => {
    if (!spindle) return null;
    const right = spindle.poler[1];
    const list = spindle.fibre.filter(([a]) => a.x === right.x).sort((p, q) => p[1].y - q[1].y);
    const fb = list[0];
    if (!fb) return null;
    return {
      x: (fb[0].x + fb[1].x) / 2,
      y: (fb[0].y + fb[1].y) / 2,
      text: 'Spoletråder',
    };
  };
  const pole = (): Callout | null => {
    const p = spindle?.poler[0];
    return p
      ? {
          x: p.x,
          y: p.y,
          text: type === 'dyr' ? 'Sentrioler' : ['Spolepol', '(uten sentrioler)'],
        }
      : null;
  };
  const push = (c: Callout | null) => {
    if (c) out.push(c);
  };
  const firstVisible = lay.kromatider.find((k) => !hidden.has(k.key));
  switch (id) {
    case 'G1':
    case 'S':
    case 'G2': {
      if (nuc) push({ ...onEllipse(nuc, 215), text: 'Kjernemembran' });
      if (nuc)
        push({
          x: nuc.cx + nuc.rx * 0.42,
          y: nuc.cy - nuc.ry * 0.45,
          text: 'Kjernelegeme',
        });
      if (id === 'S') {
        const done = lay.kromatider.find((k) => k.sister === 'b' && !hidden.has(k.key));
        const notYet = lay.sentromerer.find((s) => hidden.has(s.b));
        if (done)
          push({
            x: done.x,
            y: done.y,
            text: ['Kopiert: to', 'søsterkromatider'],
            strong: true,
          });
        if (notYet) push({ x: notYet.x, y: notYet.y, text: ['Ikke kopiert', 'ennå'] });
      } else if (firstVisible)
        push({
          x: firstVisible.x,
          y: firstVisible.y,
          text: ['Kromatin', id === 'G2' ? '(kopiert DNA)' : '(utstrakt DNA)'],
          strong: true,
        });
      if (id !== 'S') push(boundary());
      break;
    }
    case 'profase': {
      if (nuc)
        push({
          ...onEllipse(nuc, 205),
          text: ['Kjernemembranen', 'løses opp'],
        });
      const s = lay.sentromerer[0];
      if (s)
        push({
          x: s.x,
          y: s.y,
          text: ['Kromosom med to', 'søsterkromatider'],
          strong: true,
        });
      push(pole());
      push(fibre());
      break;
    }
    case 'metafase': {
      const e = lay.ekvatorplan[0];
      if (e) push({ x: e.x, y: e.y0 + 6, text: 'Ekvatorplanet', strong: true });
      const s = lay.sentromerer[lay.sentromerer.length - 1];
      if (s) push({ x: s.x, y: s.y, text: 'Sentromer' });
      push(pole());
      push(fibre());
      break;
    }
    case 'anafase': {
      const k = [...lay.kromatider].sort((a, b) => a.y - b.y)[0];
      if (k)
        push({
          x: k.x,
          y: k.y,
          text: ['Søsterkromatidene', 'trekkes fra hverandre'],
          strong: true,
        });
      push(pole());
      push(fibre());
      break;
    }
    case 'telofase': {
      const k1 = lay.kjerner[1];
      if (k1) push({ ...onEllipse(k1, -40), text: 'Ny kjernemembran', strong: true });
      const k0 = lay.kjerner[0];
      if (k0)
        push({
          ...onEllipse(k0, 140),
          text: ['Kromosomene', 'strekker seg ut'],
        });
      if (type === 'dyr') {
        const [a, b] = lay.celler;
        if (a && b)
          push({
            x: (a.cx + a.rx + b.cx - b.rx) / 2,
            y: a.cy - a.ry * 0.5,
            text: 'Innsnøring',
            strong: true,
          });
      } else
        push({
          x: mother.cx,
          y: mother.cy + mother.ry * 0.3,
          text: ['Celleplate', '(vesikler)'],
          strong: true,
        });
      break;
    }
    case 'cytokinese': {
      const [a, b] = lay.celler;
      if (type === 'plante')
        push({
          x: mother.cx,
          y: mother.cy - mother.ry * 0.6,
          text: 'Ny cellevegg',
          strong: true,
        });
      if (a)
        push({
          ...onEllipse({ ...a, cx: a.cx + dx(0) }, 150),
          text: 'Dattercelle 1',
        });
      if (b)
        push({
          ...onEllipse({ ...b, cx: b.cx + dx(1) }, 30),
          text: 'Dattercelle 2',
        });
      if (type === 'dyr' && a)
        push({
          ...onEllipse({ ...a, cx: a.cx + dx(0) }, -30),
          text: 'Cellemembran',
        });
      break;
    }
  }
  return out;
}

/* ====================================================================== */
/* DNA-mengden gjennom syklusen                                             */
/* ====================================================================== */

const X_MAX = 27;
const BANDS: { from: number; to: number; label: string }[] = [
  { from: 0, to: stepStart(1), label: 'G1' },
  { from: stepStart(1), to: stepStart(2), label: 'S' },
  { from: stepStart(2), to: stepStart(3), label: 'G2' },
  { from: stepStart(3), to: CYCLE_HOURS, label: 'M' },
  { from: CYCLE_HOURS, to: X_MAX, label: 'G1' },
];

function DnaPlot({ hours, id }: { hours: number; id: CycleStep }) {
  const [ref, f] = useContainerTextScale<HTMLDivElement>();
  const H = Math.round(300 + 240 * (f - 1));
  // Etter cytokinesen gjelder punktet hver dattercelle (2c); da står punktet like etter delingen
  const shown = id === 'cytokinese' ? Math.max(hours, CYCLE_HOURS - 0.001) : hours;
  const dna = id === 'cytokinese' ? 2 : dnaAmount(hours);
  const pts: [number, number][] = [
    [0, 2],
    [stepStart(1), 2],
    [stepStart(2), 4],
    [CYCLE_HOURS, 4],
    [CYCLE_HOURS, 2],
    [X_MAX, 2],
  ];
  return (
    <div ref={ref}>
      <Figure
        viewBox={`0 0 800 ${H}`}
        label={`DNA-mengden per celle gjennom cellesyklusen. Nå: ${fmt(dna, 1)}c etter ${fmt(hours, 1)} timer.`}
        caption="Avspillingen bruker like lang tid på hver fase. Grafen viser den virkelige tida: mitosen er det smale feltet M."
      >
        <Plot
          x={{
            min: 0,
            max: X_MAX,
            label: 'Tid i cellesyklusen (timer)',
            ticks: [0, 6, 12, 18, 24],
          }}
          y={{
            min: 0,
            max: 5,
            label: 'DNA per celle (c)',
            ticks: [0, 1, 2, 3, 4, 5],
          }}
          width={800}
          height={H}
        >
          {({ sx, sy, y0, y1 }) => (
            <g>
              {BANDS.map((b, i) => (
                <g key={i}>
                  <rect
                    x={sx(b.from)}
                    y={y1}
                    width={sx(b.to) - sx(b.from)}
                    height={y0 - y1}
                    fill={b.label === 'M' ? BIO.kromosom.mor[0] : i % 2 ? BIO.dna : VIZ.muted}
                    opacity={b.label === 'M' ? 0.22 : i === 4 ? 0.04 : 0.08}
                  />
                  {(b.label !== 'M' || f <= 1.3) && (
                    <Txt x={(sx(b.from) + sx(b.to)) / 2} y={y1 + 20 * f} size={0.8} muted weight={650}>
                      {b.label}
                    </Txt>
                  )}
                </g>
              ))}
              <path d={linePath(pts, sx, sy)} fill="none" stroke={BIO.dna} strokeWidth={3.2} strokeLinejoin="round" />
              <line x1={sx(shown)} x2={sx(shown)} y1={y0} y2={y1} className="viz-guide" />
              <circle cx={sx(shown)} cy={sy(dna)} r={7} fill={BIO.dna} stroke={VIZ.surface} strokeWidth={2.5} />
              <Txt x={sx(CYCLE_HOURS) + 8} y={sy(2) - 10} anchor="start" size={0.8} muted>
                deling
              </Txt>
            </g>
          )}
        </Plot>
      </Figure>
    </div>
  );
}

/* ====================================================================== */
/* Forklaring                                                               */
/* ====================================================================== */

function explanation(id: CycleStep, type: CellType, n: number, s: number): ReactNode {
  const twoN = 2 * n;
  const plant = type === 'plante';
  switch (id) {
    case 'G1':
      return (
        <>
          <p>
            <strong>Interfase, G1-fasen.</strong> Cella vokser, lager proteiner og nye organeller og gjør det arbeidet den er spesialisert
            for. Kromosomene er lange, tynne DNA-tråder (kromatin) som ikke kan ses hver for seg i mikroskopet. Hvert av de {twoN}{' '}
            kromosomene består nå av én kromatide.
          </p>
          <p>
            Det er lett å tro at celler deler seg hele tida, men de fleste bruker nesten hele syklusen i interfasen. Celler som ikke skal
            dele seg mer, går over i en hvilefase (G0), slik de fleste nerveceller og muskelceller gjør.
          </p>
        </>
      );
    case 'S':
      return (
        <p>
          <strong>Interfase, S-fasen: DNA-et kopieres (replikasjon).</strong> {s >= 1 ? 'Alle' : `${Math.round(s * 100)} % av`} kromosomene
          er kopiert. Hvert kopierte kromosom består av to like søsterkromatider som henger sammen i sentromeret. Legg merke til at cella
          fortsatt har {twoN} kromosomer: det er DNA-mengden som dobles (fra 2c til 4c), ikke kromosomtallet.
        </p>
      );
    case 'G2':
      return (
        <p>
          <strong>Interfase, G2-fasen.</strong> DNA-et er kopiert (4c), og cella lager proteinene den trenger til delingen, blant annet til
          spoletrådene. Ved G2-kontrollpunktet sjekkes det at DNA-et er kopiert helt og uten feil før mitosen kan starte.
        </p>
      );
    case 'profase':
      return (
        <p>
          <strong>Profase.</strong> Kromosomene kveiler seg sammen (kondenserer) og blir korte og tykke, så de kan ses i mikroskopet. Hvert
          kromosom består av to søsterkromatider. Kjernemembranen og kjernelegemet løses opp, og spoletrådene vokser ut fra{' '}
          {plant ? 'de to polene. Planteceller har ikke sentrioler, men lager spolen likevel.' : 'sentriolene ved de to polene.'} De
          homologe kromosomene (samme farge) legger seg ikke sammen i mitosen; det skjer bare i meiosen.
        </p>
      );
    case 'metafase':
      return (
        <p>
          <strong>Metafase.</strong> Kromosomene stiller seg på rekke i ekvatorplanet midt i cella. Spoletråder fra hver sin pol er festet
          til sentromeret på hvert kromosom, én fra hver side. Ved M-kontrollpunktet sjekkes det at alle {twoN} kromosomene er festet før
          søsterkromatidene skilles. I metafasen er kromosomene lettest å se og telle i mikroskopet.
        </p>
      );
    case 'anafase':
      return (
        <p>
          <strong>Anafase.</strong> Sentromerene deler seg, og spoletrådene trekker søsterkromatidene fra hverandre mot hver sin pol, med
          sentromeret først. Nå regnes hver kromatide som et eget kromosom: cella har {2 * twoN} kromosomer et kort øyeblikk, {twoN} på vei
          mot hver pol. Fordi søsterkromatidene er kopier av hverandre, får begge polene et helt og likt sett.
        </p>
      );
    case 'telofase':
      return (
        <p>
          <strong>Telofase.</strong> Kromosomene er kommet fram til polene og strekker seg ut igjen. Det dannes en ny kjernemembran rundt
          hvert sett, så cella har to like kjerner. Spolen brytes ned.{' '}
          {plant
            ? 'I plantecella samler vesikler fra golgiapparatet seg i midten og begynner å danne en celleplate.'
            : 'I dyrecella begynner cellemembranen å snøres inn på midten.'}
        </p>
      );
    case 'cytokinese':
      return (
        <>
          <p>
            <strong>Cytokinese: cytoplasmaet deles.</strong>{' '}
            {plant
              ? 'En plantecelle kan ikke snøres av, fordi den har en stiv cellevegg. I stedet smelter vesiklene sammen til en celleplate som blir ny cellemembran og ny cellevegg mellom de to dattercellene.'
              : 'I dyreceller trekker en ring av proteintråder (aktin) seg sammen og snører cellemembranen inn til cella er delt i to.'}
          </p>
          <p>
            Resultatet er to datterceller med {twoN} kromosomer hver (2n), genetisk like hverandre og morcella. Slik vokser vi, og slik
            erstattes celler som dør eller blir skadet. Etterpå starter dattercellene i G1-fasen.
          </p>
        </>
      );
  }
}
