import { useEffect, useState, type ReactNode } from 'react';
import {
  BIO,
  Cellekjerne,
  Controls,
  EndoplasmatiskNettverk,
  Explain,
  Figure,
  Formula,
  FormulaLine,
  Legend,
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
  Virus,
  VizLayout,
  blobPath,
  fmt,
  fmtCount,
  mixColor,
  roundedRectPath,
  seededRandom,
  useContainerTextScale,
  useSimClock,
  useTextScale,
} from '../kit';
import { CYCLES, antibioticWorks, afterRounds, stepAt, type Agent, type Cycle } from './model';

const AGENTS: { value: Agent; label: string }[] = [
  { value: 'bakteriofag', label: 'Bakteriofag' },
  { value: 'kappekledd', label: 'Kappekledd virus' },
  { value: 'bakterie', label: 'Bakterie (todeling)' },
];

const VDNA = BIO.kromosom.far[1];
const HOST_DNA = BIO.dna;
const WALL = BIO.cellevegg;
const ANTIBIOTIC = BIO.atp;

const ease = (u: number) => {
  const x = Math.min(1, Math.max(0, u));
  return x * x * (3 - 2 * x);
};
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** Tid i syklusen som tekst: «12 min» eller «3,5 timer». */
function timeText(c: Cycle, t: number): string {
  return c.unit === 'min' ? `${fmt(t, 0)} min av ${c.duration}` : `${fmt(t, 1)} timer av ${c.duration}`;
}

export default function Virusformering() {
  const [agent, setAgent] = useState<Agent>('bakteriofag');
  const [antibiotic, setAntibiotic] = useState(false);
  const c = CYCLES[agent];
  // Klokka går fra 0 til 1 (andel av runden), så samme trinn vises når du bytter mellom virus og bakterie
  const clock = useSimClock({ tMax: 1, speed: 1 / 14 });
  const { setT, pause } = clock;
  // Åpner midt i kopieringen
  useEffect(() => setT(0.42), [setT]);
  const q = Math.min(1, Math.max(0, clock.t));
  const t = q * c.duration;
  const { index, u } = stepAt(agent, t);
  const [ref, f] = useContainerTextScale<HTMLDivElement>();
  const abShown = agent !== 'bakteriofag' && antibiotic;
  const hour = agent === 'bakterie' ? 3 : agent === 'bakteriofag' ? 2 : 0;

  return (
    <VizLayout>
      <Toolbar>
        <Segmented label="Hva formerer seg" options={AGENTS} value={agent} onChange={setAgent} />
        {agent !== 'bakteriofag' && <Toggle label="Gi antibiotika (penicillin)" checked={antibiotic} onChange={setAntibiotic} />}
      </Toolbar>
      <Controls>
        <Slider
          label="Tid"
          value={q}
          onChange={(v) => {
            pause();
            setT(v);
          }}
          min={0}
          max={1}
          step={0.01}
          format={(v) => timeText(c, v * c.duration)}
        />
      </Controls>
      <Toolbar>
        <PlayBar clock={clock} time={timeText(c, t)} />
      </Toolbar>

      <div ref={ref}>
        <Scene agent={agent} index={index} u={u} f={f} antibiotic={abShown} />
      </div>
      <Legend
        items={
          agent === 'bakterie'
            ? [
                { color: HOST_DNA, label: 'Bakteriens DNA' },
                { color: WALL.line, label: 'Cellevegg' },
                ...(abShown ? [{ color: ANTIBIOTIC, label: 'Penicillin hindrer at ny cellevegg bygges' }] : []),
              ]
            : [
                { color: VDNA, label: 'Arvestoffet til viruset (DNA eller RNA)' },
                { color: BIO.virus.line, label: 'Viruskappe og proteiner' },
                { color: HOST_DNA, label: 'Vertscellens DNA' },
                ...(abShown ? [{ color: ANTIBIOTIC, label: 'Antibiotika: finner ingenting å angripe', dashed: true }] : []),
              ]
        }
      />

      <Readouts>
        <Readout label="Én runde tar" value={c.unit === 'min' ? `${c.duration} min` : `ca. ${c.duration} timer`} />
        <Readout
          label="Nye etter én runde"
          value={agent === 'bakterie' ? '2' : `ca. ${fmtCount(c.offspring)}`}
          unit={agent === 'bakterie' ? 'bakterier' : agent === 'bakteriofag' ? 'fager' : 'virus'}
        />
        <Readout label="Kan formere seg alene" value={c.independent ? 'Ja' : 'Nei'} unit={c.independent ? 'egen celle' : 'trenger en vertscelle'} />
        <Readout
          label="Antibiotika virker"
          value={antibioticWorks(agent) ? 'Ja' : 'Nei'}
          tone={antibioticWorks(agent) ? BIO.sir.R : BIO.sir.I}
        />
      </Readouts>

      <Formula label="Hvor mange etter noen runder">
        {agent === 'bakterie' ? (
          <FormulaLine>
            Etter 1 time (3 delinger): 2<Sup>3</Sup> = {fmtCount(afterRounds('bakterie', hour))} bakterier fra én
          </FormulaLine>
        ) : agent === 'bakteriofag' ? (
          <FormulaLine>
            Etter ca. 1 time (2 runder): 100<Sup>2</Sup> = {fmtCount(afterRounds('bakteriofag', hour))} fager fra én, hvis det finnes nok
            bakterier å infisere
          </FormulaLine>
        ) : (
          <FormulaLine>
            Etter ett døgn (3 runder): 1 000<Sup>3</Sup> = én milliard virus fra ett, hvis de finner nok celler å infisere
          </FormulaLine>
        )}
      </Formula>

      <Explain>{explanation(agent, index, abShown)}</Explain>
    </VizLayout>
  );
}

/* ====================================================================== */
/* Scenen                                                                  */
/* ====================================================================== */

interface SceneProps {
  agent: Agent;
  index: number;
  u: number;
  f: number;
  antibiotic: boolean;
}

function Scene({ agent, index, u, f, antibiotic }: SceneProps) {
  const narrow = f > 1.3;
  const g = narrow ? 1.25 : 1;
  const c = CYCLES[agent];
  const barH = 34 * f;
  const barY = 8;
  const top = barY + barH + (narrow ? 36 * f : 14);
  const sceneH = Math.round(380 * g);
  const H = Math.round(top + sceneH + 10);
  const cx = 400;
  const cy = top + sceneH / 2;
  const w = 784 / 5;
  return (
    <Figure
      viewBox={`0 0 800 ${H}`}
      maxHeight={Math.round(H * 1.25)}
      label={`${agent === 'bakterie' ? 'En bakterie som deler seg' : agent === 'bakteriofag' ? 'En bakteriofag som formerer seg i en bakterie' : 'Et kappekledd virus som formerer seg i en menneskecelle'}. Trinn ${index + 1} av 5: ${c.steps[index]!.name}.`}
      caption={
        agent === 'kappekledd'
          ? 'Skjematisk tegning, ikke i målestokk: et influensavirus er ca. 100 nm, mens en menneskecelle er 10–30 µm, over hundre ganger større.'
          : 'Skjematisk tegning, ikke i målestokk: de fleste virus er 10–100 ganger mindre enn en bakterie.'
      }
    >
      {/* Trinnene */}
      {c.steps.map((s, i) => {
        const x = 8 + i * w;
        const on = i === index;
        const done = i < index;
        return (
          <g key={s.id}>
            <path
              d={roundedRectPath(x + 2, barY, w - 4, barH, 8)}
              fill={on ? mixColor(VIZ.surface, BIO.virus.line, 0.25) : done ? mixColor(VIZ.surface, VIZ.muted, 0.12) : VIZ.surface}
              stroke={on ? BIO.virus.line : VIZ.grid}
              strokeWidth={on ? 2 : 1.2}
            />
            <Txt x={x + w / 2} y={barY + barH / 2 + 6 * f} size={0.8} weight={on ? 700 : 500} muted={!on && !done}>
              {narrow ? String(i + 1) : `${i + 1} ${s.name}`}
            </Txt>
          </g>
        );
      })}
      {narrow && (
        <Txt x={400} y={barY + barH + 26 * f} size={0.9} weight={700} color={BIO.virus.line}>
          {index + 1}. {c.steps[index]!.name}
        </Txt>
      )}
      <g transform={`translate(${cx} ${cy}) scale(${g})`}>
        {agent === 'bakteriofag' && <PhageScene index={index} u={u} />}
        {agent === 'kappekledd' && <EnvelopedScene index={index} u={u} />}
        {agent === 'bakterie' && <FissionScene index={index} u={u} antibiotic={antibiotic} narrow={narrow} />}
      </g>
      {antibiotic && agent === 'kappekledd' && (
        <g>
          <path d={roundedRectPath(24, top + 6, 190, 34 * f, 17 * f)} fill={mixColor(VIZ.surface, ANTIBIOTIC, 0.15)} stroke={ANTIBIOTIC} strokeWidth={1.8} strokeDasharray="6 4" />
          <Txt x={119} y={top + 6 + 17 * f + 6 * f} size={0.8} weight={650} color={ANTIBIOTIC}>
            {narrow ? 'Antibiotika' : 'Antibiotika: ingen virkning'}
          </Txt>
        </g>
      )}
    </Figure>
  );
}

/* ---------- Bakteriecelle ---------- */

function BacteriumCell({
  x,
  y,
  w,
  h,
  dna = 1,
  dnaSpread = 0,
  broken = false,
  ribosomes = true,
  pinch = 0,
  wallGap = false,
}: {
  x: number;
  y: number;
  w: number;
  h: number;
  /** Antall kopier av kromosomet (0 = brutt ned). */
  dna?: number;
  /** Hvor langt fra hverandre to kopier er (0–1). */
  dnaSpread?: number;
  broken?: boolean;
  ribosomes?: boolean;
  /** Innsnøring på midten (0–1) mens skilleveggen bygges. */
  pinch?: number;
  /** Celleveggen mangler på midten (penicillin). */
  wallGap?: boolean;
}) {
  const d = pinch > 0.01 ? pinchedPath(x, y, w, h, pinch) : roundedRectPath(x - w / 2, y - h / 2, w, h, h / 2);
  const rnd = seededRandom(5);
  const ribs = Array.from({ length: 26 }, () => [x + (rnd() - 0.5) * (w - h * 0.6), y + (rnd() - 0.5) * (h - 26)] as const);
  return (
    <g>
      <path d={d} fill={broken ? mixColor(VIZ.surface, BIO.cytoplasma, 0.5) : BIO.cytoplasma} stroke={WALL.line} strokeWidth={7} strokeDasharray={broken ? '16 14' : undefined} opacity={broken ? 0.75 : 1} />
      <path d={d} fill="none" stroke={BIO.membran} strokeWidth={2} strokeDasharray={broken ? '10 12' : undefined} transform={`translate(${x} ${y}) scale(${1 - 10 / w} ${1 - 10 / h}) translate(${-x} ${-y})`} opacity={broken ? 0.5 : 1} />
      {wallGap && <rect x={x - 14} y={y - h / 2 - 8} width={28} height={h + 16} fill={BIO.cytoplasma} opacity={0.9} />}
      {ribosomes && !broken && ribs.map(([rx, ry], i) => <circle key={i} cx={rx} cy={ry} r={2.6} fill={BIO.ribosom} />)}
      {dna >= 1 &&
        Array.from({ length: Math.min(2, dna) }, (_, i) => {
          const off = dna >= 2 ? (i === 0 ? -1 : 1) * lerp(14, w * 0.27, dnaSpread) : 0;
          return <DnaLoop key={i} x={x + off} y={y} r={Math.min(30, h * 0.22)} color={HOST_DNA} />;
        })}
    </g>
  );
}

/** Kapselform med innsnøring på midten (to celler som skilles). */
function pinchedPath(x: number, y: number, w: number, h: number, pinch: number): string {
  const r = h / 2;
  const neck = r * (1 - 0.95 * pinch);
  const xl = x - w / 2;
  const xr = x + w / 2;
  return `M${xl + r},${y - r} C${x - w * 0.15},${y - r} ${x - 10},${y - neck} ${x},${y - neck} C${x + 10},${y - neck} ${x + w * 0.15},${y - r} ${xr - r},${y - r} A${r},${r} 0 0 1 ${xr - r},${y + r} C${x + w * 0.15},${y + r} ${x + 10},${y + neck} ${x},${y + neck} C${x - 10},${y + neck} ${x - w * 0.15},${y + r} ${xl + r},${y + r} A${r},${r} 0 0 1 ${xl + r},${y - r} Z`;
}

/** Kromosomet som en sammenfiltret ring. */
function DnaLoop({ x, y, r, color }: { x: number; y: number; r: number; color: string }) {
  const pts: string[] = [];
  for (let i = 0; i <= 48; i++) {
    const a = (i / 48) * Math.PI * 2;
    const rr = r * (0.86 + 0.1 * Math.sin(a * 3 + 0.6) + 0.07 * Math.sin(a * 7 + 1.3));
    pts.push(`${(x + rr * Math.cos(a) * 1.3).toFixed(1)},${(y + rr * Math.sin(a)).toFixed(1)}`);
  }
  return <polyline points={pts.join(' ')} fill="none" stroke={color} strokeWidth={2.4} strokeLinejoin="round" />;
}

/** Kort, bølgete tråd med arvestoff. */
function Strand({ x, y, len = 34, color = VDNA, rotate = 0, width = 2.6 }: { x: number; y: number; len?: number; color?: string; rotate?: number; width?: number }) {
  const n = 4;
  const seg = len / n;
  let d = `M${-len / 2},0`;
  for (let i = 0; i < n; i++) d += ` q${seg / 2},${i % 2 ? 6 : -6} ${seg},0`;
  return <path d={d} transform={`translate(${x} ${y}) rotate(${rotate})`} fill="none" stroke={color} strokeWidth={width} strokeLinecap="round" />;
}

/** Faste, tilfeldige plasser i et rektangel (samme hver gang). */
function spots(n: number, w: number, h: number, seed: number): [number, number][] {
  const rnd = seededRandom(seed);
  return Array.from({ length: n }, () => [(rnd() - 0.5) * w, (rnd() - 0.5) * h]);
}

/* ---------- Bakteriofag (lytisk syklus) ---------- */

const PHAGE_SIZE = 70;

function PhageScene({ index, u }: { index: number; u: number }) {
  const cell = { x: 0, y: 36, w: 470, h: 170 };
  const wallTop = cell.y - cell.h / 2;
  const attachedY = wallTop - (18 / 40) * PHAGE_SIZE - 2;
  const phageY = index === 0 ? lerp(-118, attachedY, ease(u)) : attachedY;
  const emptied = index === 1 ? ease(u) : index > 1 ? 1 : 0;
  const lysed = index === 4;
  const copies = index === 2 ? 1 + Math.floor(u * 9) : index === 3 ? Math.round(10 * (1 - u)) + 2 : index === 4 ? 0 : 0;
  const parts = index === 2 ? Math.floor(Math.max(0, u - 0.35) * 14) : index === 3 ? Math.round(9 * (1 - u)) : 0;
  const built = index === 3 ? 2 + Math.floor(u * 8) : index === 4 ? 10 : 0;
  const inside = spots(12, cell.w - 120, cell.h - 60, 3);
  const partSpots = spots(12, cell.w - 100, cell.h - 50, 9);
  const out = Array.from({ length: 10 }, (_, i) => {
    const a = -Math.PI * 0.95 + (i / 9) * Math.PI * 1.9;
    return [Math.cos(a) * 300, cell.y + Math.sin(a) * 128] as const;
  });
  return (
    <g>
      <BacteriumCell
        x={cell.x}
        y={cell.y}
        w={cell.w}
        h={cell.h}
        dna={index >= 2 ? 0 : 1}
        broken={lysed && u > 0.25}
        ribosomes={!lysed}
      />
      {/* Bakteriens DNA brytes ned */}
      {index === 2 &&
        spots(7, 160, 60, 4).map(([x, y], i) => (
          <Strand key={i} x={x} y={cell.y + y} len={16} color={HOST_DNA} rotate={i * 47} width={2} />
        ))}
      {/* Virusets DNA på vei inn */}
      {index === 1 && <path d={`M0,${wallTop + 4} q10,${20 * u} -4,${40 * u} t4,${36 * u}`} fill="none" stroke={VDNA} strokeWidth={3} strokeLinecap="round" />}
      {index >= 2 &&
        inside.slice(0, copies).map(([x, y], i) => <Strand key={i} x={x} y={cell.y + y} rotate={(i * 61) % 180} />)}
      {/* Proteiner: hoder og haler */}
      {partSpots.slice(0, parts).map(([x, y], i) =>
        i % 2 === 0 ? (
          <polygon key={i} points={hexPoints(x, cell.y + y, 8)} fill={BIO.virus.fill} stroke={BIO.virus.line} strokeWidth={1.6} />
        ) : (
          <rect key={i} x={x - 2.5} y={cell.y + y - 8} width={5} height={16} rx={1.5} fill={BIO.virus.fill} stroke={BIO.virus.line} strokeWidth={1.3} />
        ),
      )}
      {/* Ferdige fager inne i bakterien, og så ut når den sprekker */}
      {Array.from({ length: built }, (_, i) => {
        const [ix, iy] = inside[i]!;
        const [ox, oy] = out[i]!;
        const k = lysed ? ease((u - 0.2) / 0.8) : 0;
        return <Virus key={i} type="bakteriofag" x={lerp(ix, ox, k)} y={lerp(cell.y + iy, oy, k)} size={30} rotate={lysed ? (i * 37) % 360 * k : 0} />;
      })}
      {/* Fagen som infiserer (tomt hode etter inntrengningen) */}
      <g opacity={1 - 0.55 * emptied}>
        <Virus type="bakteriofag" x={0} y={phageY} size={PHAGE_SIZE} />
      </g>
      {index === 0 && <Virus type="bakteriofag" x={-260} y={-120} size={44} rotate={-25} dim />}
    </g>
  );
}

const hexPoints = (x: number, y: number, r: number) =>
  Array.from({ length: 6 }, (_, i) => {
    const a = (Math.PI / 3) * i + Math.PI / 6;
    return `${(x + r * Math.cos(a)).toFixed(1)},${(y + r * Math.sin(a)).toFixed(1)}`;
  }).join(' ');

/* ---------- Kappekledd virus i en menneskecelle ---------- */

function EnvelopedScene({ index, u }: { index: number; u: number }) {
  const cell = { x: 0, y: 40, rx: 280, ry: 130 };
  const d = blobPath(cell.x, cell.y, cell.rx, cell.ry, 0.03, 6, 12);
  const memTop = cell.y - cell.ry;
  // Viruset fester seg til reseptoren i midten, og den blir med inn i cella (endocytose)
  const receptorXs = index === 0 ? [-130, -55, 0, 55, 130] : [-130, -55, 55, 130];
  // Feste og inntrengning
  const vy0 = memTop - 120;
  const vAttach = memTop - 26;
  const vInside = memTop + 70;
  const vy = index === 0 ? lerp(vy0, vAttach, ease(u)) : index === 1 ? lerp(vAttach, vInside, ease(Math.min(1, u * 1.6))) : vInside;
  const uncoated = index === 1 ? ease((u - 0.6) / 0.4) : index > 1 ? 1 : 0;
  const rnaCopies = index === 2 ? 1 + Math.floor(u * 8) : index === 3 ? Math.round(8 * (1 - u)) + 1 : 0;
  const spikes = index === 2 ? Math.floor(u * 10) : index >= 3 ? 10 : 0;
  const assembled = index === 3 ? 1 + Math.floor(u * 3) : index === 4 ? 3 : 0;
  const nucleus = { x: -90, y: 60 };
  const rnaSpots = spots(10, 180, 90, 12);
  const budX = [-185, 0, 185];
  return (
    <g>
      <path d={d} fill={BIO.cytoplasma} stroke={BIO.membran} strokeWidth={4.5} />
      <path d={d} fill="none" stroke={BIO.cytoplasma} strokeWidth={1.5} />
      <Cellekjerne x={nucleus.x} y={nucleus.y} r={62} ry={52} />
      <EndoplasmatiskNettverk x={130} y={70} w={120} h={70} kornet />
      {/* Reseptorer i cellemembranen: et protein med en «skål» ytterst (ikke Y-formet, så de ikke forveksles med antistoffer) */}
      {receptorXs.map((x) => (
        <path
          key={x}
          d={`M${x},${memTop + 4} L${x},${memTop - 8} M${x - 8},${memTop - 20} Q${x - 8},${memTop - 8} ${x},${memTop - 8} Q${x + 8},${memTop - 8} ${x + 8},${memTop - 20}`}
          stroke={BIO.protein.line}
          strokeWidth={3}
          strokeLinecap="round"
          fill="none"
        />
      ))}
      {/* Piggproteiner fra viruset settes inn i membranen */}
      {Array.from({ length: spikes }, (_, i) => {
        const x = -230 + i * 50 + 10;
        const yy = cell.y - cell.ry * Math.sqrt(Math.max(0, 1 - (x / cell.rx) ** 2)) + 2;
        return <circle key={i} cx={x} cy={yy - 3} r={3.6} fill={BIO.antigen} />;
      })}
      {/* Vesikkel rundt viruset under inntrengningen */}
      {index === 1 && u < 0.8 && <circle cx={0} cy={vy} r={34} fill="none" stroke={BIO.membran} strokeWidth={3} opacity={u < 0.25 ? u * 4 : 1} />}
      {(index <= 1 || (index === 1 && uncoated < 1)) && (
        <g opacity={1 - uncoated}>
          <Virus type="kappekledd" x={0} y={vy} size={56} />
        </g>
      )}
      {/* Arvestoffet: løses ut og kopieres i kjernen */}
      {index === 1 && uncoated > 0 && <Strand x={0} y={vInside} rotate={20} />}
      {index >= 2 &&
        rnaSpots.slice(0, rnaCopies).map(([x, y], i) => <Strand key={i} x={nucleus.x + x * 0.55} y={nucleus.y + y * 0.6} len={26} rotate={(i * 53) % 180} />)}
      {/* Proteiner fra ribosomene på ER */}
      {index >= 2 &&
        spots(index === 2 ? Math.floor(u * 10) : 10, 120, 60, 21).map(([x, y], i) => (
          <circle key={i} cx={130 + x} cy={70 + y - 60} r={3.4} fill={BIO.virus.line} opacity={0.8} />
        ))}
      {/* Montering under membranen og knoppskyting */}
      {Array.from({ length: assembled }, (_, i) => {
        const bx = budX[i]!;
        const yMem = cell.y - cell.ry * Math.sqrt(Math.max(0, 1 - (bx / cell.rx) ** 2));
        const bud = index === 4 ? ease((u - i * 0.15) / 0.55) : 0;
        const y = lerp(yMem + 34, yMem - 70, bud);
        return (
          <g key={i}>
            {bud > 0.05 && bud < 0.95 && (
              <path d={`M${bx - 30},${yMem} Q${bx - 30},${y - 34} ${bx},${y - 34} Q${bx + 30},${y - 34} ${bx + 30},${yMem}`} fill="none" stroke={BIO.membran} strokeWidth={3} />
            )}
            {bud >= 0.95 ? (
              <Virus type="kappekledd" x={bx} y={y} size={52} />
            ) : (
              <g>
                <polygon points={hexPoints(bx, y, 14)} fill={BIO.virus.fill} stroke={BIO.virus.line} strokeWidth={2} />
                <Strand x={bx} y={y} len={14} width={2} />
              </g>
            )}
          </g>
        );
      })}
    </g>
  );
}

/* ---------- Bakterie som deler seg ---------- */

/** Tekst under bakterien: én linje på PC, to linjer på mobil (ellers klippes den i kantene). */
function NoteLines({ y, lines, narrow, ...rest }: { y: number; lines: [string, string]; narrow: boolean; size: number; weight?: number; color?: string; muted?: boolean }) {
  const f = useTextScale();
  if (!narrow)
    return (
      <Txt x={0} y={y} {...rest}>
        {lines.join(' ')}
      </Txt>
    );
  return (
    <g>
      {lines.map((l, i) => (
        <Txt key={i} x={0} y={y + i * 22 * f} {...rest}>
          {l}
        </Txt>
      ))}
    </g>
  );
}

function FissionScene({ index, u, antibiotic, narrow }: { index: number; u: number; antibiotic: boolean; narrow: boolean }) {
  const h = 150;
  const w = index === 0 ? lerp(300, 440, ease(u)) : 440;
  const copies = index === 0 ? 1 : index === 1 ? (u > 0.15 ? 2 : 1) : 2;
  const spread = index === 1 ? 0.15 * ease(u) : index === 2 ? lerp(0.15, 1, ease(u)) : 1;
  const burst = antibiotic && index >= 3 && (index > 3 || u > 0.55);
  if (burst) {
    const k = index === 3 ? ease((u - 0.55) / 0.45) : 1;
    const leak = spots(16, 120, 90, 31);
    return (
      <g>
        <BacteriumCell x={0} y={40} w={w} h={h} dna={2} dnaSpread={1} broken pinch={0.25} />
        {leak.map(([x, y], i) => (
          <circle key={i} cx={x * (0.6 + k)} cy={40 - h / 2 - 10 - Math.abs(y) * k} r={3} fill={BIO.ribosom} opacity={0.7 * k} />
        ))}
        <NoteLines y={40 + h / 2 + (narrow ? 32 : 46)} lines={['Celleveggen ble ikke ferdig:', 'bakterien sprekker']} narrow={narrow} size={0.9} weight={700} color={ANTIBIOTIC} />
      </g>
    );
  }
  if (index < 4) {
    const pinch = index === 3 ? ease(u) * (antibiotic ? 0.25 : 1) : 0;
    return (
      <g>
        <BacteriumCell x={0} y={40} w={w} h={h} dna={copies} dnaSpread={spread} pinch={pinch} wallGap={antibiotic && index === 3} />
        {index === 3 && !antibiotic && (
          <line x1={0} x2={0} y1={40 - (h / 2) * (1 - 0.95 * pinch)} y2={40 + (h / 2) * (1 - 0.95 * pinch)} stroke={WALL.line} strokeWidth={6 * ease(u)} />
        )}
        {antibiotic && index === 3 && <AntibioticDots x={0} y={40} />}
        {antibiotic && index < 3 && (
          <NoteLines y={40 + h / 2 + (narrow ? 32 : 46)} lines={['Penicillin virker når bakterien', 'skal bygge ny cellevegg']} narrow={narrow} size={0.85} muted />
        )}
      </g>
    );
  }
  // To nye celler skilles
  const gap = ease(u) * 40;
  return (
    <g>
      <BacteriumCell x={-110 - gap} y={40} w={220} h={h} dna={1} />
      <BacteriumCell x={110 + gap} y={40} w={220} h={h} dna={1} />
    </g>
  );
}

function AntibioticDots({ x, y }: { x: number; y: number }) {
  return (
    <g>
      {spots(8, 60, 200, 41).map(([dx, dy], i) => (
        <circle key={i} cx={x + dx} cy={y + dy} r={4} fill={ANTIBIOTIC} opacity={0.85} />
      ))}
    </g>
  );
}

/* ====================================================================== */
/* Forklaring                                                              */
/* ====================================================================== */

function explanation(agent: Agent, index: number, antibiotic: boolean): ReactNode {
  const phage: ReactNode[] = [
    <>
      <strong>Feste.</strong> Bakteriofagen (et virus som angriper bakterier) fester halefibrene til bestemte molekyler på overflaten av
      bakterien. Et virus kan bare infisere celler som har «riktig» molekyl å feste seg til, derfor angriper hvert virus bare noen få
      celletyper.
    </>,
    <>
      <strong>Inntrengning.</strong> Fagen sprøyter arvestoffet sitt (DNA) inn i bakterien gjennom halen, som en sprøyte. Selve
      proteinkappa blir igjen utenpå.
    </>,
    <>
      <strong>Kopiering.</strong> Virusets gener tar over cella: bakteriens eget DNA brytes ned, og bakteriens enzymer, ribosomer og ATP
      brukes til å kopiere virus-DNA og lage nye virusproteiner (hoder og haler). Viruset har ikke noe stoffskifte selv.
    </>,
    <>
      <strong>Montering.</strong> Proteinene setter seg sammen til nye hoder og haler, og hvert hode fylles med en kopi av virus-DNA.
    </>,
    <>
      <strong>Frigjøring.</strong> Et virusenzym bryter ned celleveggen, bakterien sprekker (lyse), og ca. 100 nye fager slippes ut. Hele
      den lytiske syklusen tar bare ca. 25 minutter, og hver ny fag kan infisere en ny bakterie.
    </>,
  ];
  const env: ReactNode[] = [
    <>
      <strong>Feste.</strong> Piggproteinene på viruskappa passer til reseptorer på cellemembranen, som en nøkkel i en lås. Influensavirus
      fester seg til celler i luftveiene, og derfor er det luftveiene som blir infisert.
    </>,
    <>
      <strong>Inntrengning.</strong> Cella tar viruset inn i en blære (endocytose). Kappa smelter sammen med blæremembranen, og arvestoffet
      (RNA hos influensa) slippes løs i cella.
    </>,
    <>
      <strong>Kopiering.</strong> Cella blir lurt til å kopiere virusets arvestoff (influensa gjør det i cellekjernen) og til å lage
      virusproteiner på ribosomene. Piggproteiner settes inn i cellemembranen.
    </>,
    <>
      <strong>Montering.</strong> Nye kapsider med arvestoff samles under de delene av membranen som har fått virusets piggproteiner.
    </>,
    <>
      <strong>Frigjøring ved knoppskyting.</strong> Virusene presses ut gjennom membranen og tar med seg en bit av den som kappe. Cella
      sprekker ikke med en gang, men kan slippe ut hundrevis til tusenvis av virus før den dør. Immunforsvaret dreper også infiserte
      celler, og det er en del av grunnen til at vi blir syke.
    </>,
  ];
  const bact: ReactNode[] = [
    <>
      <strong>Vekst.</strong> En bakterie er en levende celle med eget stoffskifte. Den tar opp næring, lager proteiner på sine egne
      ribosomer og vokser.
    </>,
    <>
      <strong>DNA kopieres.</strong> Det ringformede kromosomet kopieres, så det blir to like kopier.
    </>,
    <>
      <strong>Kopiene skilles.</strong> Cella blir lengre, og de to kopiene av kromosomet flyttes til hver sin ende.
    </>,
    <>
      <strong>Skillevegg.</strong> Cellemembranen snøres inn, og bakterien bygger en ny cellevegg tvers over midten.
    </>,
    <>
      <strong>To celler.</strong> Resultatet er to like datterceller (todeling). Under gode forhold tar dette ca. 20 minutter, men det blir
      bare 2 nye celler, mens en virusinfisert celle kan gi 100 eller flere nye virus.
    </>,
  ];
  const ab =
    agent === 'bakterie' ? (
      antibiotic ? (
        <p>
          <strong>Antibiotika:</strong> penicillin hindrer bakterien i å bygge cellevegg. Når den skal dele seg, blir veggen svak, og
          bakterien sprekker. Andre antibiotika angriper bakterienes ribosomer, som er annerledes enn våre. Menneskeceller har ikke
          cellevegg, så penicillin skader ikke cellene våre.
        </p>
      ) : (
        <p>Slå på antibiotika for å se hvorfor penicillin dreper bakterier.</p>
      )
    ) : (
      <p>
        <strong>Hvorfor virker ikke antibiotika på virus?</strong> Antibiotika angriper deler som bare bakterier har: cellevegg, bakteriens
        ribosomer og enzymer i stoffskiftet. Et virus har ingen av disse; det bruker vertscellens ribosomer og stoffskifte. Derfor hjelper
        ikke antibiotika mot forkjølelse og influensa{antibiotic ? ': som du ser, går formeringen helt uforstyrret videre' : ''}. Mot virus
        brukes vaksiner og noen få antivirale medisiner, som f.eks. hindrer at nye virus slipper ut av cella.
      </p>
    );
  const text = agent === 'bakteriofag' ? phage : agent === 'kappekledd' ? env : bact;
  return (
    <>
      <p>{text[index]}</p>
      {agent === 'bakteriofag' && index === 4 && (
        <p>Virus regnes ikke som levende: de har ikke celler og ikke eget stoffskifte, og de kan bare formere seg inne i en vertscelle.</p>
      )}
      {ab}
    </>
  );
}
