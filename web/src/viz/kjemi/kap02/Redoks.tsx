import { useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  Begerglass,
  Explain,
  Figure,
  Formel,
  Formula,
  FormulaLine,
  KJEMI,
  Legend,
  PlayControls,
  Reaksjon,
  Readout,
  Readouts,
  Select,
  TFormel,
  Toolbar,
  Txt,
  VIZ,
  VizLayout,
  atomColors,
  capitalize,
  formulaText,
  mixColor,
  seededRandom,
  useContainerTextScale,
  useSimClock,
  type AtomColors,
} from '../kit';
import { REDOX_METALS, ionOf, oxNumberText, redox, redoxMetal, type RedoxResult } from './model';

/** Farger for metallene i partikkelbildet: hvert metall får sin egen (lånt fra atomfargene), så to metaller aldri ser like ut. */
const METAL_COLOR: Record<string, string> = { Mg: 'Mg', Al: 'Al', Zn: 'N', Fe: 'C', Pb: 'Si', Cu: 'Br', Ag: 'H' };
const metalColors = (sym: string): AtomColors => atomColors(METAL_COLOR[sym] ?? sym);
/** Farget løsning: Cu²⁺ blå, Fe²⁺ blekgrønn, resten fargeløse. */
const ION_TINT: Record<string, { color: string; strength: number } | undefined> = {
  Cu: { color: KJEMI.indicator.btbBasisk, strength: 0.3 },
  Fe: { color: KJEMI.indicator.btbNoytral, strength: 0.18 },
};

const ROUNDS = 2;
const ROUND_T = 3.2;
const T_END = ROUNDS * ROUND_T + 0.6;
const T_START = 0.5 * ROUND_T;

const ease = (u: number) => (u <= 0 ? 0 : u >= 1 ? 1 : u * u * (3 - 2 * u));
const seg = (u: number, a: number, b: number) => ease((u - a) / (b - a));

export default function Redoks() {
  const [metal, setMetal] = useState('Zn');
  const [ion, setIon] = useState('Cu');
  const r = redox(metal, ion);
  const clock = useSimClock({ tMax: T_END, speed: 1 });
  const { setT } = clock;
  useEffect(() => setT(T_START), [metal, ion, setT]);
  const [ref, f] = useContainerTextScale<HTMLDivElement>();
  const k = Math.max(1, 0.85 * f);
  const series = seriesLayout(f);
  const scene = sceneLayout(f, k);
  // Uten reaksjon er det bare én linje og en kort forklaring (ingen oksidasjonstall og klammer)
  const eqH = Math.round((r.reacts ? 190 : 120) * f);

  return (
    <VizLayout>
      <Toolbar>
        <Select
          label="Metall"
          value={metal}
          onChange={setMetal}
          options={REDOX_METALS.map((m) => ({ value: m.symbol, label: `${m.name} (${m.symbol})` }))}
        />
        <Select
          label="Løsning"
          value={ion}
          onChange={setIon}
          options={REDOX_METALS.map((m) => ({ value: m.symbol, label: `${m.saltName} (${formulaText(ionOf(m))})` }))}
        />
      </Toolbar>

      <div ref={ref}>
        <Figure
          viewBox={`0 0 800 ${series.H}`}
          label={`Spenningsrekka: ${REDOX_METALS.map((m) => m.symbol).join(', ')}. ${capitalize(r.metal.name)} står ${r.reacts ? 'til venstre for' : r.same ? 'samme sted som' : 'til høyre for'} ${r.ion.name}.`}
          caption="Trykk på et metall (øverst) eller et ion (nederst) for å velge. Et metall reduserer ionene til metallene som står til høyre for det."
          maxHeight={series.H}
        >
          <Series r={r} onMetal={setMetal} onIon={setIon} layout={series} f={f} />
        </Figure>
      </div>

      <Figure
        viewBox={`0 0 800 ${scene.H}`}
        label={`${capitalize(r.metal.name)} i en løsning med ${r.ion.ionName}er. ${r.reacts ? 'Metallatomer går i løsning som ioner, og ionene i løsningen legger seg på metallet.' : 'Ingen reaksjon.'}`}
        caption="Utsnittet viser overflaten av metallet. Nitrationene (små, grå) er tilskuerioner. Vannmolekylene er ikke tegnet."
        maxHeight={scene.H}
      >
        <Scene r={r} t={clock.t} layout={scene} f={f} k={k} />
      </Figure>
      <PlayControls clock={clock} decimals={1} />
      <Legend
        items={[
          { color: KJEMI.oxidation, label: 'Oksidasjon: avgir elektroner' },
          { color: KJEMI.reduction, label: 'Reduksjon: tar opp elektroner' },
          { color: KJEMI.electron, label: 'Elektroner (e⁻)' },
        ]}
      />

      <Figure
        viewBox={`0 0 800 ${eqH}`}
        label={r.reacts ? `Totalreaksjonen ${r.total.replace(/\^/g, '')} med oksidasjonstall.` : 'Ingen reaksjon.'}
        maxHeight={eqH}
      >
        <Equation r={r} f={f} />
      </Figure>

      <Readouts>
        <Readout label="Skjer det en reaksjon?" value={r.reacts ? 'Ja' : 'Nei'} tone={r.reacts ? KJEMI.reduction : VIZ.muted} />
        <Readout label="Reduksjonsmiddel (oksideres)" value={r.reacts ? r.metal.symbol : '–'} tone={r.reacts ? KJEMI.oxidation : undefined} />
        <Readout label="Oksidasjonsmiddel (reduseres)" value={r.reacts ? formulaText(ionOf(r.ion)) : '–'} tone={r.reacts ? KJEMI.reduction : undefined} />
        <Readout label="Elektroner overført" value={r.reacts ? `${r.electrons} e⁻` : '0'} />
      </Readouts>

      <Formula label="Halvreaksjoner og totalreaksjon">
        <FormulaLine>
          Oksidasjon: <Reaksjon r={r.oxidation} />
          {r.reacts && r.a > 1 ? ` (· ${r.a})` : ''}
        </FormulaLine>
        <FormulaLine>
          Reduksjon: <Reaksjon r={r.reduction} />
          {r.reacts && r.b > 1 ? ` (· ${r.b})` : ''}
        </FormulaLine>
        <FormulaLine>{r.reacts ? <>Totalt: <Reaksjon r={r.total} /></> : <>Ingen reaksjon: {r.metal.symbol} er et for svakt reduksjonsmiddel.</>}</FormulaLine>
      </Formula>

      <Explain>{explanation(r)}</Explain>
    </VizLayout>
  );
}

/* ---------- Spenningsrekka ---------- */

function seriesLayout(f: number) {
  const top = 26 * f;
  const box = 44 * f;
  const metalY = top + 42 * f;
  const ionY = metalY + box + 34 * f;
  const arrowY = ionY + 34 * f;
  return { top, box, metalY, ionY, arrowY, H: Math.round(arrowY + 34 * f) };
}

function Series({ r, onMetal, onIon, layout, f }: { r: RedoxResult; onMetal: (s: string) => void; onIon: (s: string) => void; layout: ReturnType<typeof seriesLayout>; f: number }) {
  // Sju metaller og H₂ (mellom Pb og Cu)
  const slots = [...REDOX_METALS.slice(0, 5).map((m) => m.symbol), 'H2', ...REDOX_METALS.slice(5).map((m) => m.symbol)];
  const x = (i: number) => 60 + i * (680 / (slots.length - 1));
  const xs = (sym: string) => x(slots.indexOf(sym));
  const xm = xs(r.metal.symbol);
  const xi = xs(r.ion.symbol);
  const { box } = layout;
  return (
    <g>
      <Txt x={20} y={layout.top} anchor="start" muted size={0.85}>
        Spenningsrekka
      </Txt>
      {/* Pil fra metallet til ionet det velges sammen med */}
      {!r.same && (
        <path
          d={`M${xm},${layout.metalY + box / 2 + 4} C${xm},${layout.ionY - 8 * f} ${xi},${layout.metalY + box / 2 + 4} ${xi},${layout.ionY - 22 * f}`}
          fill="none"
          stroke={r.reacts ? KJEMI.reduction : VIZ.muted}
          strokeWidth={2.2}
          strokeDasharray={r.reacts ? undefined : '6 5'}
        />
      )}
      {slots.map((s, i) => {
        if (s === 'H2')
          return (
            <g key={s}>
              <Txt x={x(i)} y={layout.metalY + 6 * f} muted size={0.95}>
                <TFormel f="H2" />
              </Txt>
              <Txt x={x(i)} y={layout.ionY} muted size={0.85}>
                <TFormel f="H^+" />
              </Txt>
            </g>
          );
        const c = metalColors(s);
        const onM = s === r.metal.symbol;
        const onI = s === r.ion.symbol;
        const m = redoxMetal(s);
        return (
          <g key={s}>
            <g onClick={() => onMetal(s)} style={{ cursor: 'pointer' }}>
              <rect x={x(i) - box / 2} y={layout.metalY - box / 2} width={box} height={box} rx={8} fill={c.fill} stroke={onM ? KJEMI.oxidation : c.line} strokeWidth={onM ? 4 : 1.5} />
              <text x={x(i)} y={layout.metalY + box * 0.17} textAnchor="middle" className="kj-atom-symbol" style={{ fill: c.ink, fontSize: box * 0.46 }}>
                {s}
              </text>
            </g>
            <g onClick={() => onIon(s)} style={{ cursor: 'pointer' }}>
              {onI && <rect x={x(i) - box / 2 - 4} y={layout.ionY - 24 * f} width={box + 8} height={34 * f} rx={8} fill="none" stroke={KJEMI.reduction} strokeWidth={3} />}
              <rect x={x(i) - box / 2} y={layout.ionY - 22 * f} width={box} height={30 * f} fill="transparent" />
              <Txt x={x(i)} y={layout.ionY} size={0.9} weight={onI ? 800 : 500} muted={!onI}>
                <TFormel f={ionOf(m)} />
              </Txt>
            </g>
          </g>
        );
      })}
      <line x1={70} x2={730} y1={layout.arrowY - 6 * f} y2={layout.arrowY - 6 * f} stroke={VIZ.muted} strokeWidth={1.5} />
      <polygon points={`${60},${layout.arrowY - 6 * f} ${72},${layout.arrowY - 11 * f} ${72},${layout.arrowY - 1 * f}`} fill={VIZ.muted} />
      <polygon points={`${740},${layout.arrowY - 6 * f} ${728},${layout.arrowY - 11 * f} ${728},${layout.arrowY - 1 * f}`} fill={VIZ.muted} />
      <Txt x={60} y={layout.arrowY + 18 * f} anchor="start" muted size={0.75}>
        avgir lettest elektroner
      </Txt>
      <Txt x={740} y={layout.arrowY + 18 * f} anchor="end" muted size={0.75}>
        edlere metall
      </Txt>
    </g>
  );
}

/* ---------- Begerglass og partikkelbilde ---------- */

function sceneLayout(f: number, k: number) {
  const wide = f <= 1.3;
  if (wide) {
    const zoom = { x: 300, y: 20, w: 480, h: 330 };
    return { wide, beaker: { x: 50, y: 70, w: 170, h: 220 }, zoom, H: Math.round(zoom.y + zoom.h + 34 * f) };
  }
  const beaker = { x: 260, y: 40, w: 260, h: 260 };
  const zoom = { x: 20, y: beaker.y + beaker.h + 70 * f, w: 760, h: 520 * Math.min(1.3, k / 1.3) };
  return { wide, beaker, zoom, H: Math.round(zoom.y + zoom.h + 36 * f) };
}

interface Particle {
  x: number;
  y: number;
  sym: string;
  charge: number;
  /** Ring rundt partikkelen (oksidasjon/reduksjon). */
  ring?: string;
  ghost?: boolean;
}

function Scene({ r, t, layout, f, k }: { r: RedoxResult; t: number; layout: ReturnType<typeof sceneLayout>; f: number; k: number }) {
  const { zoom, beaker } = layout;
  const progress = Math.min(1, t / (ROUNDS * ROUND_T));
  const rA = 15 * k;
  const d = 2 * rA + 4 * k;
  const plateCols = 3;
  const px0 = zoom.x + 10 + rA;
  const rows = Math.max(5, Math.floor((zoom.h - 20) / d));
  const py0 = zoom.y + (zoom.h - (rows - 1) * d) / 2;
  const surfX = px0 + (plateCols - 1) * d;
  const solX0 = surfX + d * 1.6;
  const solX1 = zoom.x + zoom.w - rA - 10;
  const solY0 = zoom.y + rA + 10;
  const solY1 = zoom.y + zoom.h - rA - 10;
  // Plassene der atomer løses (øvre del) og der ioner legger seg (nedre del)
  const perRound = { out: r.a, in: r.b };
  const outRows = Array.from({ length: ROUNDS * perRound.out }, (_, i) => 1 + ((i * 2) % Math.max(2, rows - 2)));
  const inRows = Array.from({ length: ROUNDS * perRound.in }, (_, i) => rows - 1 - (i % Math.max(1, rows - 1)));
  // Faste startplasser i løsningen (fast frø)
  const sol = useMemo(() => {
    const rnd = seededRandom(17 + r.metal.charge * 7 + r.ion.charge);
    const n = ROUNDS * perRound.in + 4;
    return Array.from({ length: n }, () => ({ x: solX0 + 20 + rnd() * (solX1 - solX0 - 20), y: solY0 + rnd() * (solY1 - solY0), ph: rnd() * 6.28 }));
  }, [solX0, solX1, solY0, solY1, perRound.in, r.metal.charge, r.ion.charge]);
  const nitrate = useMemo(() => {
    const rnd = seededRandom(5);
    return Array.from({ length: 7 }, () => ({ x: solX0 + rnd() * (solX1 - solX0), y: solY0 + rnd() * (solY1 - solY0), ph: rnd() * 6.28 }));
  }, [solX0, solX1, solY0, solY1]);
  const wob = (p: { x: number; y: number; ph: number }, amp: number) => ({ x: p.x + amp * Math.sin(1.3 * t + p.ph), y: p.y + amp * Math.cos(1.1 * t + p.ph * 1.7) });

  const particles: Particle[] = [];
  const electrons: { x: number; y: number }[] = [];
  const labels: ReactNode[] = [];
  const round = Math.min(ROUNDS - 1, Math.floor(t / ROUND_T));
  const u = (t - round * ROUND_T) / ROUND_T;
  const roundU = (i: number) => Math.max(0, Math.min(1.2, (t - i * ROUND_T) / ROUND_T));

  // Metallplata: alle atomer unntatt de som allerede er løst
  for (let c = 0; c < plateCols; c++)
    for (let row = 0; row < rows; row++) {
      const outIdx = c === plateCols - 1 ? outRows.indexOf(row) : -1;
      if (outIdx >= 0 && r.reacts) {
        const rr = Math.floor(outIdx / perRound.out);
        const uu = roundU(rr);
        if (uu > 0) {
          // Atomet går ut i løsningen og blir et ion
          // Først ut fra overflaten, så videre ut i løsningen (bort fra stedet der ionene legger seg)
          const m1 = seg(uu, 0, 0.32);
          const m2 = seg(uu, 0.32, 1.15);
          const home = { x: px0 + c * d, y: py0 + row * d };
          const away = { x: surfX + d * 1.7, y: home.y + (outIdx % 2 ? 8 : -8) * k };
          const far = { x: surfX + d * (3.2 + 1.3 * (outIdx % 3)), y: Math.max(solY0, Math.min(solY1, home.y + (outIdx % 2 ? 0.6 : -0.6) * d)) };
          const target = { x: away.x + (far.x - away.x) * m2, y: away.y + (far.y - away.y) * m2 };
          const w = uu > 0.32 ? wob({ ...target, ph: outIdx }, 3 * k * m2) : target;
          const pos = { x: home.x + (w.x - home.x) * m1, y: home.y + (w.y - home.y) * m1 };
          particles.push({ ...pos, sym: r.metal.symbol, charge: uu > 0.14 ? r.metal.charge : 0, ring: uu > 0.04 && uu < 0.62 ? KJEMI.oxidation : undefined });
          if (uu > 0.04 && uu < 0.62 && rr === round && outIdx % perRound.out === 0)
            labels.push(
              <Txt key={`ox${outIdx}`} x={pos.x + rA + 8} y={pos.y - rA - 6} anchor="start" size={0.8} weight={700} color={KJEMI.oxidation}>
                oksidasjon: avgir {r.metal.charge} e⁻
              </Txt>,
            );
          continue;
        }
      }
      particles.push({ x: px0 + c * d, y: py0 + row * d, sym: r.metal.symbol, charge: 0 });
    }

  // Ionene i løsningen: noen legger seg på metallet (reaksjon), noen dytter bare borti det (ingen reaksjon)
  sol.forEach((p, i) => {
    const target = i < inRows.length ? inRows[i]! : null;
    const rr = target === null ? -1 : Math.floor(i / perRound.in);
    const site = target === null ? null : { x: surfX + d, y: py0 + target * d };
    const free = wob(p, 4 * k);
    if (r.reacts && site && rr >= 0) {
      const uu = roundU(rr);
      const m = seg(uu, 0.28, 0.74);
      const pos = { x: free.x + (site.x - free.x) * m, y: free.y + (site.y - free.y) * m };
      const done = uu >= 0.8;
      particles.push({ ...pos, sym: r.ion.symbol, charge: done ? 0 : r.ion.charge, ring: uu > 0.4 && uu < 0.95 ? KJEMI.reduction : undefined });
      if (uu > 0.4 && uu < 0.95 && rr === round && i % perRound.in === 0)
        labels.push(
          <Txt key={`red${i}`} x={site.x + rA + 12} y={site.y + 6 * f} anchor="start" size={0.8} weight={700} color={KJEMI.reduction}>
            reduksjon: tar opp {r.ion.charge} e⁻
          </Txt>,
        );
      return;
    }
    if (!r.reacts && i < 2) {
      // Støter mot overflaten og går tilbake
      const uu = u;
      const m = seg(uu, 0.15, 0.45) - seg(uu, 0.55, 0.85);
      const near = { x: surfX + d * 1.15, y: py0 + (rows - 2 - 2 * i) * d };
      particles.push({ x: free.x + (near.x - free.x) * m, y: free.y + (near.y - free.y) * m, sym: r.ion.symbol, charge: r.ion.charge });
      return;
    }
    particles.push({ ...free, sym: r.ion.symbol, charge: r.ion.charge });
  });

  // Elektronene: fra atomet som løses, gjennom metallet, til ionet som legger seg
  if (r.reacts)
    for (let rr = 0; rr <= round; rr++) {
      const uu = roundU(rr);
      if (uu < 0.1 || uu > 0.8) continue;
      const m = seg(uu, 0.3, 0.72);
      const nE = r.electrons;
      for (let j = 0; j < nE; j++) {
        const from = outRows[rr * perRound.out + Math.floor(j / r.metal.charge)]!;
        const to = inRows[rr * perRound.in + Math.floor(j / r.ion.charge)]!;
        const a = { x: surfX - d * 0.5, y: py0 + from * d + ((j % r.metal.charge) - (r.metal.charge - 1) / 2) * 9 * k };
        const b = { x: surfX + d * 0.55, y: py0 + to * d + ((j % r.ion.charge) - (r.ion.charge - 1) / 2) * 9 * k };
        // Vei: ned langs innsiden av overflaten, så ut til ionet
        const mid = { x: a.x, y: b.y };
        const p = m < 0.75 ? { x: a.x, y: a.y + (mid.y - a.y) * (m / 0.75) } : { x: mid.x + (b.x - mid.x) * ((m - 0.75) / 0.25), y: mid.y };
        electrons.push(p);
      }
    }

  const liquidTint = solutionColor(r, progress);
  return (
    <g>
      <Beaker r={r} progress={progress} box={beaker} liquid={liquidTint} zoom={zoom} wide={layout.wide} f={f} k={k} />
      <rect x={zoom.x} y={zoom.y} width={zoom.w} height={zoom.h} rx={16} fill={liquidTint} stroke={KJEMI.glass} strokeWidth={2} />
      <rect x={zoom.x + 2} y={zoom.y + 2} width={surfX + rA + 4 - zoom.x} height={zoom.h - 4} rx={14} fill={mixColor(VIZ.surface, metalColors(r.metal.symbol).line, 0.12)} />
      {nitrate.map((p, i) => {
        const q = wob(p, 5 * k);
        return <circle key={`n${i}`} cx={q.x} cy={q.y} r={6 * k} fill={VIZ.muted} opacity={0.45} />;
      })}
      {particles.map((p, i) => (
        <MetalParticle key={i} p={p} r={rA} />
      ))}
      {electrons.map((e, i) => (
        <circle key={`e${i}`} cx={e.x} cy={e.y} r={5.5 * k} fill={KJEMI.electron} stroke={VIZ.surface} strokeWidth={2} />
      ))}
      {labels}
      {!r.reacts && (
        <Txt x={(solX0 + solX1) / 2} y={zoom.y + 30 * f} size={0.9} weight={700} muted>
          {r.same ? 'Ingen synlig endring' : 'Ingen elektronoverføring'}
        </Txt>
      )}
      <Txt x={zoom.x + 10} y={zoom.y + zoom.h + 22 * f} anchor="start" size={0.8} muted>
        {r.metal.name} (metall)
      </Txt>
      <Txt x={zoom.x + zoom.w - 10} y={zoom.y + zoom.h + 22 * f} anchor="end" size={0.8} muted>
        løsning
      </Txt>
    </g>
  );
}

function MetalParticle({ p, r }: { p: Particle; r: number }) {
  const c = metalColors(p.sym);
  const charge = p.charge === 0 ? '' : p.charge === 1 ? '+' : `${p.charge}+`;
  return (
    <g>
      {p.ring && <circle cx={p.x} cy={p.y} r={r + 4} fill="none" stroke={p.ring} strokeWidth={3} />}
      <circle cx={p.x} cy={p.y} r={r} fill={c.fill} stroke={c.line} strokeWidth={p.charge ? 2.4 : 1.6} strokeDasharray={p.charge ? '4 2' : undefined} />
      <text x={p.x - (charge ? r * 0.12 : 0)} y={p.y + r * 0.32} textAnchor="middle" className="kj-atom-symbol" style={{ fill: c.ink, fontSize: r * 0.82 }}>
        {p.sym}
        {charge && (
          <tspan dy={-r * 0.38} fontSize={r * 0.55}>
            {charge}
          </tspan>
        )}
      </text>
    </g>
  );
}

/** Løsningens farge: fargen fra ionene som forsvinner blekner, fargen fra ionene som dannes kommer til. */
function solutionColor(r: RedoxResult, p: number): string {
  let c = KJEMI.liquid;
  const from = ION_TINT[r.ion.symbol];
  const to = ION_TINT[r.metal.symbol];
  if (from) c = mixColor(c, from.color, from.strength * (r.reacts ? 1 - 0.55 * p : 1));
  if (to && r.reacts) c = mixColor(c, to.color, to.strength * 0.8 * p);
  return c;
}

function Beaker({
  r,
  progress,
  box,
  liquid,
  zoom,
  wide,
  f,
  k,
}: {
  r: RedoxResult;
  progress: number;
  box: { x: number; y: number; w: number; h: number };
  liquid: string;
  zoom: { x: number; y: number; w: number; h: number };
  wide: boolean;
  f: number;
  k: number;
}) {
  const level = 0.72;
  const surface = box.y + box.h - level * (box.h - 6);
  const strip = { x: box.x + box.w / 2 - 14 * k, y: box.y - 40, w: 28 * k, h: box.h + 40 - 18 };
  const mc = metalColors(r.metal.symbol);
  const dc = metalColors(r.ion.symbol);
  const rnd = seededRandom(3);
  const crystals = r.reacts
    ? Array.from({ length: 26 }, () => ({ side: rnd() > 0.5 ? 1 : -1, y: surface + 10 + rnd() * (strip.y + strip.h - surface - 14), s: 3 + rnd() * 4 }))
    : [];
  const shown = Math.round(crystals.length * progress);
  const lens = { x: strip.x + strip.w, y: (surface + strip.y + strip.h) / 2, r: 14 * k };
  return (
    <g>
      <Begerglass x={box.x} y={box.y} w={box.w} h={box.h} level={level} liquid={liquid} />
      <rect x={strip.x} y={strip.y} width={strip.w} height={strip.h} rx={4} fill={mc.fill} stroke={mc.line} strokeWidth={2} />
      {crystals.slice(0, shown).map((c, i) => (
        <circle key={i} cx={c.side > 0 ? strip.x + strip.w + c.s * 0.4 : strip.x - c.s * 0.4} cy={c.y} r={c.s * k * 0.8} fill={dc.fill} stroke={dc.line} strokeWidth={1} />
      ))}
      <circle cx={lens.x} cy={lens.y} r={lens.r} fill="none" stroke={VIZ.ink} strokeWidth={2} />
      {wide ? (
        <>
          <line x1={lens.x} y1={lens.y - lens.r} x2={zoom.x} y2={zoom.y + 10} stroke={KJEMI.glass} strokeWidth={1.2} strokeDasharray="4 4" />
          <line x1={lens.x} y1={lens.y + lens.r} x2={zoom.x} y2={zoom.y + zoom.h - 10} stroke={KJEMI.glass} strokeWidth={1.2} strokeDasharray="4 4" />
        </>
      ) : (
        <>
          <line x1={lens.x - lens.r} y1={lens.y} x2={zoom.x + 20} y2={zoom.y} stroke={KJEMI.glass} strokeWidth={1.2} strokeDasharray="4 4" />
          <line x1={lens.x + lens.r} y1={lens.y} x2={zoom.x + zoom.w - 20} y2={zoom.y} stroke={KJEMI.glass} strokeWidth={1.2} strokeDasharray="4 4" />
        </>
      )}
      <Txt x={box.x + box.w / 2} y={box.y + box.h + 28 * f} size={0.85}>
        <TFormel f={r.metal.symbol} state="s" /> i <TFormel f={r.ion.salt} state="aq" />
      </Txt>
    </g>
  );
}

/* ---------- Likningen med oksidasjonstall ---------- */

function Equation({ r, f }: { r: RedoxResult; f: number }) {
  const wide = f <= 1.3;
  const xs = [110, 300, 500, 690];
  const labelTop = 26 * f;
  const topY = labelTop + 16 * f;
  const oxY = topY + 34 * f;
  const eqY = oxY + 36 * f;
  const botY = eqY + 26 * f;
  const st = wide;
  const c = (n: number) => (n === 1 ? undefined : n);
  if (!r.reacts)
    return (
      <g>
        <Txt x={400} y={50 * f} size={1.15} weight={700}>
          <TFormel f={r.metal.symbol} state={st ? 's' : false} /> + <TFormel f={ionOf(r.ion)} state={st ? 'aq' : false} /> → ingen reaksjon
        </Txt>
        <Txt x={400} y={88 * f} size={0.85} muted>
          {r.same ? 'Atomer og ioner av samme metall bytter ikke netto elektroner.' : `${r.metal.symbol} er edlere enn ${r.ion.symbol}: ${formulaText(ionOf(r.ion))} kan ikke ta elektroner fra ${r.metal.symbol}.`}
        </Txt>
      </g>
    );
  const terms: { f: string; coef?: number; state: 's' | 'aq'; ox: number; color: string }[] = [
    { f: r.metal.symbol, coef: c(r.a), state: 's', ox: 0, color: KJEMI.oxidation },
    { f: ionOf(r.ion), coef: c(r.b), state: 'aq', ox: r.ion.charge, color: KJEMI.reduction },
    { f: ionOf(r.metal), coef: c(r.a), state: 'aq', ox: r.metal.charge, color: KJEMI.oxidation },
    { f: r.ion.symbol, coef: c(r.b), state: 's', ox: 0, color: KJEMI.reduction },
  ];
  const bracket = (x1: number, x2: number, y: number, dir: 1 | -1, color: string, label: ReactNode) => (
    <g>
      <path d={`M${x1},${y + dir * 10} L${x1},${y} L${x2},${y} L${x2},${y + dir * 10}`} fill="none" stroke={color} strokeWidth={2.2} />
      <polygon points={`${x2},${y + dir * 16} ${x2 - 6},${y + dir * 6} ${x2 + 6},${y + dir * 6}`} fill={color} />
      <Txt x={(x1 + x2) / 2} y={dir > 0 ? y - 10 : y + 26 * f} size={0.8} weight={700} color={color}>
        {label}
      </Txt>
    </g>
  );
  return (
    <g>
      {bracket(xs[0]!, xs[2]!, topY, 1, KJEMI.oxidation, <>oksidasjon: {oxNumberText(0)} → {oxNumberText(r.metal.charge)}, avgir {r.electrons} e⁻</>)}
      {bracket(xs[1]!, xs[3]!, botY, -1, KJEMI.reduction, <>reduksjon: {oxNumberText(r.ion.charge)} → {oxNumberText(0)}, tar opp {r.electrons} e⁻</>)}
      {terms.map((tm, i) => (
        <g key={i}>
          <Txt x={xs[i]!} y={oxY} size={0.8} weight={700} color={tm.color}>
            {oxNumberText(tm.ox)}
          </Txt>
          <Txt x={xs[i]!} y={eqY} size={wide ? 1.2 : 1.05} weight={650}>
            <TFormel f={tm.f} coef={tm.coef} state={st ? tm.state : false} />
          </Txt>
        </g>
      ))}
      <Txt x={(xs[0]! + xs[1]!) / 2} y={eqY} size={1.1}>
        +
      </Txt>
      <Txt x={(xs[1]! + xs[2]!) / 2} y={eqY} size={1.1}>
        →
      </Txt>
      <Txt x={(xs[2]! + xs[3]!) / 2} y={eqY} size={1.1}>
        +
      </Txt>
    </g>
  );
}

/* ---------- Forklaring ---------- */

function explanation(r: RedoxResult): ReactNode {
  const M = r.metal;
  const X = r.ion;
  const ionM = <Formel f={ionOf(M)} />;
  const ionX = <Formel f={ionOf(X)} />;
  const el = (n: number) => (n === 1 ? 'ett elektron' : `${n} elektroner`);
  if (r.same)
    return (
      <p>
        <strong>
          {capitalize(M.name)} i en løsning med {ionX}:
        </strong>{' '}
        metallet og ionene er av samme grunnstoff, så det skjer ingen netto reaksjon. Velg et annet metall eller en annen løsning.
      </p>
    );
  if (!r.reacts)
    return (
      <>
        <p>
          <strong>Ingen reaksjon.</strong> {capitalize(M.name)} står til høyre for {X.name} i spenningsrekka. {ionX} trekker ikke hardt nok i
          elektroner til å ta dem fra {M.symbol}-atomene: {M.name} er et svakere reduksjonsmiddel enn {X.name}.
        </p>
        <p>
          Den motsatte kombinasjonen reagerer: {X.name} i en løsning med {ionM} gir metallisk {M.name}.
        </p>
      </>
    );
  return (
    <>
      <p>
        <strong>Oksidasjon er avgivelse av elektroner:</strong> hvert {M.symbol}-atom gir fra seg {el(M.charge)} og går i løsning som {ionM}.
        Oksidasjonstallet øker fra 0 til {oxNumberText(M.charge)}. <strong>Reduksjon er opptak av elektroner:</strong> hvert {ionX}-ion tar
        opp {el(X.charge)} og legger seg på metallet som {X.symbol}. Elektronene går direkte gjennom metallet, fra atomene som løses til ionene
        som felles ut.
      </p>
      <p>
        {capitalize(M.name)} står til venstre for {X.name} i spenningsrekka, så {M.symbol} er reduksjonsmidlet og {ionX} oksidasjonsmidlet.
        {r.a !== r.b
          ? ` Elektronene som avgis, må være like mange som de som tas opp: ${r.a} ${M.symbol} avgir ${r.electrons} elektroner, og ${r.b} ${formulaText(ionOf(X))} tar opp like mange.`
          : ''}
        {X.symbol === 'Cu' ? ' Den blå fargen fra kobber(II)ionene blir svakere, og metallet blir dekket av rødbrunt kobber.' : ''}
        {X.symbol === 'Ag' ? ' Metallet blir dekket av grå sølvkrystaller.' : ''}
        {M.symbol === 'Cu' ? ' Løsningen blir blå av kobber(II)ionene som dannes.' : ''}
        {M.symbol === 'Al' ? ' I praksis går reaksjonen tregt med aluminium, fordi metallet er dekket av et tynt, tett oksidlag.' : ''}
      </p>
    </>
  );
}

