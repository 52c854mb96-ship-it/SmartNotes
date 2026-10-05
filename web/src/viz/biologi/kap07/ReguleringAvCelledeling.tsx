import { useMemo, useState, type ReactNode } from 'react';
import {
  Arrow,
  BIO,
  Controls,
  Explain,
  Figure,
  Formula,
  FormulaLine,
  Legend,
  PlayBar,
  Plot,
  Readout,
  Readouts,
  Slider,
  Sub,
  Toggle,
  Toolbar,
  Txt,
  VIZ,
  VizLayout,
  fmt,
  fmtPct,
  linePath,
  mixColor,
  seededRandom,
  useContainerTextScale,
  useLineScale,
  useSimClock,
  useSvgId,
  useTextScale,
} from '../kit';
import {
  CHECKPOINTS,
  CYCLE_HOURS,
  DAMAGE_SLOWDOWN,
  ONCOGENE_DRIVE,
  R0,
  TISSUE_DAYS,
  checkpointStatus,
  divisionRate,
  growthSignal,
  healedTime,
  solveTissue,
  space,
  stepStart,
  maxTotal,
  tissueAt,
  tissueState,
  type CheckpointResult,
  type Mutations,
  type TissueResult,
  type TissueState,
} from './model';

/** Farge på celler med mutasjon. */
const MUTANT = BIO.sir.I;
const NORMAL = BIO.serie[0];
const PASS = BIO.sir.R;
const STOP = BIO.sir.I;

export default function ReguleringAvCelledeling() {
  const [onkogen, setOnkogen] = useState(false);
  const [tsg, setTsg] = useState(false);
  const [damage, setDamage] = useState(false);
  const [wound, setWound] = useState(0.5);
  const params = { onkogen, tsg, damage, wound };
  const result = useMemo(() => solveTissue({ onkogen, tsg, damage, wound }), [onkogen, tsg, damage, wound]);
  const reference = useMemo(() => solveTissue({ onkogen: false, tsg: false, damage: false, wound }), [wound]);
  const clock = useSimClock({ tMax: TISSUE_DAYS, speed: 3 });
  const t = clock.t;
  const now = tissueAt(result, t);
  const m: Mutations = { onkogen, tsg };
  const hasClone = onkogen || tsg;
  const crowded = now.total >= 0.98;
  const followed: Mutations = hasClone ? m : { onkogen: false, tsg: false };
  const statuses = CHECKPOINTS.map((c) => checkpointStatus(c.id, followed, damage, crowded));
  const rate = divisionRate(now.total, followed, damage);
  const state = tissueState(result, m, t);
  const healed = healedTime(result);
  const reset = clock.reset;
  const change = (fn: () => void) => {
    reset();
    fn();
  };

  return (
    <VizLayout>
      <Toolbar>
        <Toggle label="Mutasjon i proto-onkogen (gasspedal)" checked={onkogen} onChange={(v) => change(() => setOnkogen(v))} />
        <Toggle label="Mutasjon i tumorsuppressorgen (brems)" checked={tsg} onChange={(v) => change(() => setTsg(v))} />
        <Toggle label="DNA-skade (f.eks. UV-stråling)" checked={damage} onChange={(v) => change(() => setDamage(v))} />
      </Toolbar>
      <Controls>
        <Slider
          label="Størrelse på såret"
          value={Math.round(wound * 100)}
          onChange={(v) => change(() => setWound(v / 100))}
          min={0}
          max={80}
          step={5}
          unit="%"
        />
        <Slider
          label="Tid"
          ariaLabel="Tid i døgn"
          value={Math.round(t * 2) / 2}
          onChange={(v) => {
            clock.pause();
            clock.setT(v);
          }}
          min={0}
          max={TISSUE_DAYS}
          step={0.5}
          format={(v) => `dag ${fmt(v, Number.isInteger(v) ? 0 : 1)}`}
        />
      </Controls>
      <Toolbar>
        <PlayBar clock={clock} time={`dag ${fmt(t, 1)}`} />
      </Toolbar>

      <CycleFigure statuses={statuses} m={followed} damage={damage} result={result} t={t} hasClone={hasClone} />
      <Legend
        items={[
          { color: PASS, label: 'Kontrollpunkt: cella får gå videre' },
          { color: STOP, label: 'Kontrollpunkt: stopp' },
          { color: VIZ.muted, label: 'Hvilefase G0 (deler seg ikke)' },
        ]}
      />

      <TissueFigure
        normal={now.normal}
        mutant={now.mutant}
        wound={wound}
        state={state}
        t={t}
        hasClone={hasClone}
        peak={maxTotal(result)}
      />
      <Legend
        items={[
          { color: NORMAL, label: 'Normale celler' },
          ...(hasClone ? [{ color: MUTANT, label: 'Celler med mutasjonen (startet fra én liten gruppe)' }] : []),
        ]}
      />

      <GrowthPlot result={result} reference={reference} t={t} showReference={hasClone || damage} hasClone={hasClone} />
      <Legend
        items={[
          { color: hasClone && onkogen && tsg ? MUTANT : NORMAL, label: 'Alle cellene i vevet' },
          ...(hasClone ? [{ color: MUTANT, label: 'Celler med mutasjonen', dashed: true }] : []),
          ...(hasClone || damage ? [{ color: VIZ.muted, label: 'Friskt vev uten skade (til sammenligning)', dashed: true }] : []),
        ]}
      />

      <Readouts>
        <Readout label="Celler i vevet" value={fmtPct(now.total)} unit="av normalt" tone={state === 'svulst' ? MUTANT : undefined} />
        <Readout
          label="Celler med mutasjon"
          value={hasClone ? fmtPct(now.mutant, now.mutant < 0.1 ? 1 : 0) : 'ingen'}
          tone={hasClone ? MUTANT : undefined}
        />
        <Readout label="Delinger per celle" value={fmt(rate, 2)} unit="per døgn" />
        <Readout label="Vevet" value={STATE_LABEL[state]} tone={state === 'svulst' ? MUTANT : state === 'helt' ? PASS : undefined} />
      </Readouts>

      <Formula label="Delingsraten i modellen">
        <FormulaLine>
          Delinger per celle per døgn = r<Sub>0</Sub> · gass · brems{damage && !followed.tsg ? ' · skade' : ''}
        </FormulaLine>
        <FormulaLine>
          = {fmt(R0, 2)} · {fmt(followed.onkogen ? ONCOGENE_DRIVE : growthSignal(now.total), 2)} ·{' '}
          {fmt(followed.tsg ? 1 : space(now.total), 2)}
          {damage && !followed.tsg ? ` · ${fmt(DAMAGE_SLOWDOWN, 2)}` : ''} = {fmt(rate, 2)} ({hasClone ? 'cellene med mutasjonen' : 'normale celler'}, vevet er{' '}
          {fmtPct(now.total)} fullt)
        </FormulaLine>
      </Formula>

      <Explain>{explanation(params, state, now, healed)}</Explain>
    </VizLayout>
  );
}

const STATE_LABEL: Record<TissueState, string> = {
  gror: 'Såret gror',
  helt: 'Grodd',
  svulst: 'Svulst',
  'vokser-sakte': 'Vokser for mye',
};

/* ====================================================================== */
/* Cellesyklusen med kontrollpunkter                                        */
/* ====================================================================== */

const PHASE_ARCS = [
  { label: 'G1', from: 0, to: stepStart(1), color: BIO.serie[0] },
  { label: 'S', from: stepStart(1), to: stepStart(2), color: BIO.dna },
  { label: 'G2', from: stepStart(2), to: stepStart(3), color: BIO.serie[2] },
  { label: 'M', from: stepStart(3), to: CYCLE_HOURS, color: BIO.kromosom.mor[0] },
];

function CycleFigure({
  statuses,
  m,
  damage,
  result,
  t,
  hasClone,
}: {
  statuses: CheckpointResult[];
  m: Mutations;
  damage: boolean;
  result: TissueResult;
  t: number;
  hasClone: boolean;
}) {
  const [ref, f] = useContainerTextScale<HTMLDivElement>();
  const narrow = f > 1.3;
  const R = narrow ? 205 : 118;
  const thick = narrow ? 62 : 38;
  const cx = narrow ? 400 : 190;
  const cy = R + thick / 2 + 34 * f;
  // Plass til G0-sirkelen under ringen
  const ringBottom = cy + R + thick / 2 + 44;
  const lh = 21 * f;
  const textX = narrow ? 30 : 400;
  const textY0 = narrow ? ringBottom + 30 * f : 40 * f;
  const lines = statusLines(statuses, m, damage, hasClone);
  const textBottom = textY0 + lines.reduce((s, l) => s + (l.gap ? lh * 0.6 : 0) + lh, 0);
  const H = Math.round(Math.max(ringBottom + 10, textBottom + 10));
  const angle = (h: number) => -90 + (h / CYCLE_HOURS) * 360;
  const pt = (deg: number, r: number) => ({ x: cx + r * Math.cos((deg * Math.PI) / 180), y: cy + r * Math.sin((deg * Math.PI) / 180) });
  const arc = (a0: number, a1: number, r0: number, r1: number) => {
    const p0 = pt(a0, r1);
    const p1 = pt(a1, r1);
    const p2 = pt(a1, r0);
    const p3 = pt(a0, r0);
    const large = a1 - a0 > 180 ? 1 : 0;
    return `M${p0.x},${p0.y} A${r1},${r1} 0 ${large} 1 ${p1.x},${p1.y} L${p2.x},${p2.y} A${r0},${r0} 0 ${large} 0 ${p3.x},${p3.y} Z`;
  };
  // Cella vi følger: ett omløp per generasjon, men står ved et kontrollpunkt som stopper den
  const [n0 = 0, m0 = 0] = result.sol.y[0] ?? [];
  const pop = tissueAt(result, t);
  const gens = hasClone ? Math.log2(Math.max(1, pop.mutant / Math.max(1e-9, m0))) : Math.log2(Math.max(1, pop.normal / Math.max(1e-9, n0)));
  const g1 = statuses[0]!;
  const g2 = statuses[1]!;
  const g1At = CHECKPOINTS[0]!.at;
  const g2At = CHECKPOINTS[1]!.at;
  let dotHour = (gens % 1) * CYCLE_HOURS;
  let inG0 = false;
  if (g1.status === 'g0') inG0 = true;
  else if (g1.status === 'stopp') dotHour = g1At - 0.9;
  else if (g2.status === 'stopp' && dotHour > g1At && dotHour < g2At + 0.2) dotHour = g2At - 0.6;
  const g0Pos = pt(angle(g1At), R + thick / 2 + 34);
  const dot = inG0 ? g0Pos : pt(angle(dotHour), R);
  const lw = useLineScale();
  return (
    <div ref={ref}>
      <Figure
        viewBox={`0 0 800 ${H}`}
        maxHeight={narrow ? 1100 : Math.round(H * 1.15)}
        label={`Cellesyklusen med kontrollpunktene G1, G2 og M. ${statuses.map((s, i) => `${CHECKPOINTS[i]!.name}: ${s.status === 'passer' ? 'passerer' : s.status === 'g0' ? 'hvilefase' : 'stopp'}`).join('. ')}.`}
      >
        {PHASE_ARCS.map((p) => {
          const a0 = angle(p.from);
          const a1 = angle(p.to);
          const mid = pt((a0 + a1) / 2, p.label === 'M' ? R + thick / 2 + 18 * f : R);
          return (
            <g key={p.label}>
              <path d={arc(a0, a1, R - thick / 2, R + thick / 2)} fill={p.color} opacity={0.22} stroke={p.color} strokeWidth={1.5 * lw} />
              <Txt x={mid.x} y={mid.y + 6 * f} weight={700} size={p.label === 'M' ? 0.85 : 1} color={p.label === 'M' ? p.color : undefined}>
                {p.label}
              </Txt>
            </g>
          );
        })}
        <Txt x={cx} y={cy - 6 * f} size={0.85} muted>
          Interfase:
        </Txt>
        <Txt x={cx} y={cy + 14 * f} size={0.85} muted>
          G1 + S + G2
        </Txt>
        {/* G0 */}
        <circle cx={g0Pos.x} cy={g0Pos.y} r={20} fill="none" stroke={VIZ.muted} strokeWidth={1.4 * lw} strokeDasharray="4 4" />
        <Txt x={g0Pos.x + 26} y={g0Pos.y + 6 * f} anchor="start" size={0.8} muted>
          G0
        </Txt>
        {CHECKPOINTS.map((c, i) => {
          const s = statuses[i]!;
          const a = angle(c.at);
          const p0 = pt(a, R - thick / 2 - 8);
          const p1 = pt(a, R + thick / 2 + 8);
          const col = s.status === 'passer' ? PASS : s.status === 'stopp' ? STOP : VIZ.muted;
          // G2- og M-kontrollpunktet ligger tett: etikettene skyves litt fra hverandre
          const shift = c.id === 'G2' ? -11 : c.id === 'M' ? 11 : 0;
          const lab = pt(a + shift, R - thick / 2 - 18 * f);
          return (
            <g key={c.id}>
              <line x1={p0.x} y1={p0.y} x2={p1.x} y2={p1.y} stroke={VIZ.surface} strokeWidth={11} strokeLinecap="round" />
              <line x1={p0.x} y1={p0.y} x2={p1.x} y2={p1.y} stroke={col} strokeWidth={6} strokeLinecap="round" />
              <Txt x={lab.x} y={lab.y + 6 * f} size={0.75} weight={700} color={col}>
                {c.id}
              </Txt>
            </g>
          );
        })}
        {/* Retning */}
        <Arrow
          x1={pt(-60, R + thick / 2 + 12).x}
          y1={pt(-60, R + thick / 2 + 12).y}
          x2={pt(-35, R + thick / 2 + 12).x}
          y2={pt(-35, R + thick / 2 + 12).y}
          color={VIZ.muted}
          width={2}
          head={8}
        />
        {/* Cella vi følger */}
        <circle
          cx={dot.x}
          cy={dot.y}
          r={13}
          fill={hasClone ? mixColor(BIO.cytoplasma, MUTANT, 0.35) : BIO.cytoplasma}
          stroke={hasClone ? MUTANT : BIO.membran}
          strokeWidth={2.5 * lw}
        />
        <circle cx={dot.x} cy={dot.y} r={5.5} fill={BIO.kjerne.line} opacity={0.75} />
        {lines.map((l, i) => {
          const y = textY0 + lines.slice(0, i + 1).reduce((s, x) => s + (x.gap ? lh * 0.6 : 0), 0) + i * lh;
          return (
            <Txt key={i} x={textX} y={y} anchor="start" size={l.size ?? 0.85} weight={l.weight ?? 520} color={l.color}>
              {l.text}
            </Txt>
          );
        })}
      </Figure>
    </div>
  );
}

interface Line {
  text: string;
  color?: string;
  weight?: number;
  size?: number;
  gap?: boolean;
}

function statusLines(statuses: CheckpointResult[], m: Mutations, damage: boolean, hasClone: boolean): Line[] {
  const who = !hasClone
    ? 'En normal celle'
    : m.onkogen && m.tsg
      ? 'En celle med begge mutasjonene'
      : m.onkogen
        ? 'En celle med onkogen'
        : 'En celle uten virkende brems';
  const out: Line[] = [
    { text: `${who}${damage ? ', med DNA-skade' : ''}`, weight: 700, size: 0.95 },
    { text: `Gasspedal (proto-onkogen): ${m.onkogen ? 'henger fast (onkogen)' : 'virker normalt'}`, color: m.onkogen ? STOP : undefined },
    { text: `Brems (tumorsuppressorgen): ${m.tsg ? 'virker ikke' : 'virker'}`, color: m.tsg ? STOP : undefined },
  ];
  CHECKPOINTS.forEach((c, i) => {
    const s = statuses[i]!;
    const col = s.status === 'passer' ? PASS : s.status === 'stopp' ? STOP : VIZ.muted;
    out.push({ text: c.name, weight: 700, gap: i === 0, color: col });
    out.push({ text: s.reason, size: 0.8 });
  });
  return out;
}

/* ====================================================================== */
/* Vevet: et lag med celler (epitel) og et sår                              */
/* ====================================================================== */

function TissueFigure({
  normal,
  mutant,
  wound,
  state,
  t,
  hasClone,
  peak,
}: {
  normal: number;
  mutant: number;
  wound: number;
  state: TissueState;
  t: number;
  hasClone: boolean;
  /** Største antall celler i løpet av modelltida (andel av fullt vev): bestemmer plassen til haugen over laget. */
  peak: number;
}) {
  const [ref, f] = useContainerTextScale<HTMLDivElement>();
  const narrow = f > 1.3;
  // Færre og større celler på mobil
  const SLOTS = narrow ? 12 : 24;
  const x0 = 30;
  const x1 = 770;
  const cw = (x1 - x0) / SLOTS;
  const ch = narrow ? 110 : 66;
  const widths = useMemo(() => (narrow ? [6, 5, 4, 3, 2] : [11, 9, 7, 5, 3]), [narrow]);
  const maxMound = widths.reduce((x, y) => x + y, 0);
  // Plass til en haug med celler over laget bare så høy som haugen blir i løpet av modelltida (samme høyde hele tida)
  const peakExtra = Math.min(maxMound, Math.max(0, Math.round((peak - 1) * SLOTS)));
  const moundRows = hasClone ? moundLayout(peakExtra, widths).reduce((s, c) => Math.max(s, c.row + 1), 0) : 0;
  const top = 34 * f;
  const yLayerTop = top + moundRows * ch * 0.62 + 10;
  const yBase = yLayerTop + ch;
  const H = Math.round(yBase + 30 * f + 16);
  const total = normal + mutant;
  const inLayer = Math.min(1, total);
  const occupied = Math.round(inLayer * SLOTS);
  // Cellene fyller såret fra begge kanter mot midten
  const order: number[] = [];
  for (let i = 0; i < SLOTS / 2; i++) order.push(i, SLOTS - 1 - i);
  const filled = new Set(order.slice(0, occupied));
  // Celler med mutasjon: gruppen i venstre kant av såret (de innerste cellene på venstre side)
  const leftFilled = [...filled].filter((i) => i < SLOTS / 2).sort((a, b) => b - a);
  const mutantInLayer = Math.min(leftFilled.length, Math.round(Math.min(mutant, inLayer) * SLOTS));
  const mutantSlots = new Set(leftFilled.slice(0, mutantInLayer));
  const extra = Math.max(0, Math.round((total - 1) * SLOTS));
  const moundCells = useMemo(() => moundLayout(Math.min(extra, maxMound), widths), [extra, maxMound, widths]);
  const woundSlots = order.slice(Math.round((1 - wound) * SLOTS));
  const lw = useLineScale();
  const fs = useTextScale();
  const gapFrom = Math.min(...[...Array(SLOTS).keys()].filter((i) => !filled.has(i)), SLOTS);
  const gapTo = Math.max(...[...Array(SLOTS).keys()].filter((i) => !filled.has(i)), -1);
  const centre = leftFilled[0] ?? SLOTS / 2 - 1;
  const moundX = x0 + (Math.min(centre, SLOTS / 2 - 1) + 0.5) * cw;
  return (
    <div ref={ref}>
      <Figure
        viewBox={`0 0 800 ${H}`}
        maxHeight={narrow ? 800 : Math.round(H * 1.15)}
        label={`Et lag med celler etter ${fmt(t, 0)} døgn: ${fmtPct(total)} av normalt antall celler, ${fmtPct(mutant)} med mutasjon.`}
        caption="Snitt gjennom et lag med celler (epitel) på en basalmembran. Hver figur er mange celler."
      >
        {/* Basalmembranen */}
        <line x1={x0 - 10} x2={x1 + 10} y1={yBase + 4} y2={yBase + 4} stroke={VIZ.muted} strokeWidth={3 * lw} />
        <Txt x={x0} y={yBase + 30 * fs} anchor="start" size={0.75} muted>
          Basalmembran
        </Txt>
        {/* Plassen der såret var */}
        {woundSlots.length > 0 && (
          <rect
            x={x0 + Math.min(...woundSlots) * cw}
            y={yLayerTop - 4}
            width={(Math.max(...woundSlots) - Math.min(...woundSlots) + 1) * cw}
            height={ch + 8}
            rx={8}
            fill={STOP}
            opacity={0.06}
          />
        )}
        {Array.from({ length: SLOTS }, (_, i) =>
          filled.has(i) ? <TissueCell key={i} x={x0 + i * cw + 1.5} y={yLayerTop} w={cw - 3} h={ch} mutant={mutantSlots.has(i)} /> : null,
        )}
        {moundCells.map((c, i) => (
          <TissueCell
            key={`m${i}`}
            x={moundX + c.dx * cw - cw * 0.5}
            y={yLayerTop - (c.row + 1) * ch * 0.62}
            w={cw * 1.05}
            h={ch * 0.66}
            mutant
            round
          />
        ))}
        {/* Tekst om hva som skjer */}
        {gapTo >= gapFrom && (
          <g>
            <Arrow
              x1={x0 + gapFrom * cw - 34}
              y1={yLayerTop + ch / 2}
              x2={x0 + gapFrom * cw + 6}
              y2={yLayerTop + ch / 2}
              color={PASS}
              width={3}
              head={10}
            />
            <Arrow
              x1={x0 + (gapTo + 1) * cw + 34}
              y1={yLayerTop + ch / 2}
              x2={x0 + (gapTo + 1) * cw - 6}
              y2={yLayerTop + ch / 2}
              color={PASS}
              width={3}
              head={10}
            />
            <Txt x={x0 + ((gapFrom + gapTo + 1) / 2) * cw} y={yLayerTop - 12} size={0.85} weight={650}>
              sår
            </Txt>
          </g>
        )}
        {state === 'helt' && (
          <Txt x={400} y={yLayerTop - 14} size={0.85} weight={650} color={PASS}>
            Fullt lag: kontakthemming
          </Txt>
        )}
        {extra > 0 && (
          <Txt
            x={Math.max(130, moundX)}
            y={
              top -
              8 +
              (moundRows -
                Math.min(
                  moundRows,
                  moundCells.reduce((s, c) => Math.max(s, c.row + 1), 0),
                )) *
                ch *
                0.62
            }
            size={0.85}
            weight={700}
            color={MUTANT}
          >
            {state === 'svulst' ? (extra > maxMound ? 'Svulst (vokser videre)' : 'Svulst') : 'For mange celler'}
          </Txt>
        )}
      </Figure>
    </div>
  );
}

/** Plasser ekstra celler i en haug over laget: bredest nederst, med litt tilfeldig forskyvning (fast frø). */
function moundLayout(count: number, widths: readonly number[]): { dx: number; row: number }[] {
  const rnd = seededRandom(11);
  const out: { dx: number; row: number }[] = [];
  let row = 0;
  let left = count;
  while (left > 0 && row < widths.length) {
    const w = Math.min(widths[row]!, left);
    for (let i = 0; i < w; i++) out.push({ dx: i - (w - 1) / 2 + (rnd() - 0.5) * 0.3, row });
    left -= w;
    row++;
  }
  return out;
}

function TissueCell({ x, y, w, h, mutant, round }: { x: number; y: number; w: number; h: number; mutant: boolean; round?: boolean }) {
  const lw = useLineScale();
  const fill = mutant ? mixColor(BIO.cytoplasma, MUTANT, 0.3) : BIO.cytoplasma;
  const line = mutant ? MUTANT : BIO.membran;
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} rx={round ? Math.min(w, h) / 2.2 : 6} fill={fill} stroke={line} strokeWidth={1.6 * lw} />
      <ellipse
        cx={x + w / 2}
        cy={y + h * (round ? 0.5 : 0.62)}
        rx={w * 0.26}
        ry={Math.min(h * 0.16, w * 0.3)}
        fill={mutant ? MUTANT : BIO.kjerne.line}
        opacity={mutant ? 0.7 : 0.55}
      />
    </g>
  );
}

/* ====================================================================== */
/* Antall celler over tid                                                   */
/* ====================================================================== */

function GrowthPlot({
  result,
  reference,
  t,
  showReference,
  hasClone,
}: {
  result: TissueResult;
  reference: TissueResult;
  t: number;
  showReference: boolean;
  hasClone: boolean;
}) {
  const [ref, f] = useContainerTextScale<HTMLDivElement>();
  const clipId = useSvgId('reg-clip');
  const H = Math.round(320 + 260 * (f - 1));
  // Aksen tilpasses: 0–125 % når vevet bare gror, opptil 300 % for en svulst (som vokser videre ut av grafen)
  const peak = maxTotal(result);
  const Y_MAX = peak < 1.2 ? 1.25 : peak < 1.9 ? 2 : 3;
  const yTicks = Y_MAX === 1.25 ? [0, 25, 50, 75, 100, 125] : Y_MAX === 2 ? [0, 50, 100, 150, 200] : [0, 50, 100, 150, 200, 250, 300];
  const series = (r: TissueResult, which: 'total' | 'mutant') =>
    r.sol.t
      .filter((_, i) => i % 5 === 0)
      .map((tt) => {
        const v = tissueAt(r, tt);
        return [tt, Math.min(Y_MAX * 1.05, which === 'total' ? v.total : v.mutant) * 100] as [number, number];
      });
  const tot = series(result, 'total');
  const mut = series(result, 'mutant');
  const refPts = series(reference, 'total');
  const now = tissueAt(result, t);
  const tumour = tot[tot.length - 1]![1] >= Y_MAX * 100;
  const color = tumour ? MUTANT : NORMAL;
  const exitT = tumour ? (tot.find(([, v]) => v >= Y_MAX * 100)?.[0] ?? TISSUE_DAYS) : null;
  return (
    <div ref={ref}>
      <Figure
        viewBox={`0 0 800 ${H}`}
        label={`Antall celler i vevet over ${TISSUE_DAYS} døgn. Etter ${fmt(t, 0)} døgn: ${fmtPct(now.total)} av normalt.`}
      >
        <Plot
          x={{ min: 0, max: TISSUE_DAYS, label: 'Tid (døgn)', ticks: [0, 5, 10, 15, 20, 25, 30] }}
          y={{ min: 0, max: Y_MAX * 100, label: 'Celler (% av normalt vev)', ticks: yTicks }}
          width={800}
          height={H}
        >
          {({ sx, sy, x0, x1, y0, y1 }) => (
            <g>
              <defs>
                <clipPath id={clipId}>
                  <rect x={x0} y={y1} width={x1 - x0} height={y0 - y1} />
                </clipPath>
              </defs>
              <line x1={x0} x2={x1} y1={sy(100)} y2={sy(100)} stroke={VIZ.muted} strokeWidth={1.5} strokeDasharray="3 5" />
              <Txt x={x1 - 6} y={sy(100) - 8} anchor="end" size={0.8} muted>
                fullt vev
              </Txt>
              <g clipPath={`url(#${clipId})`}>
                {showReference && (
                  <path d={linePath(refPts, sx, sy)} fill="none" stroke={VIZ.muted} strokeWidth={2} strokeDasharray="7 6" />
                )}
                {hasClone && <path d={linePath(mut, sx, sy)} fill="none" stroke={MUTANT} strokeWidth={2.4} strokeDasharray="6 5" />}
                <path d={linePath(tot, sx, sy)} fill="none" stroke={color} strokeWidth={3.4} />
              </g>
              {exitT !== null && (
                <Txt
                  x={Math.min(x1 - 10, sx(exitT) + 10)}
                  y={y1 + 22 * f}
                  anchor={sx(exitT) > (x0 + x1) / 2 ? 'end' : 'start'}
                  size={0.85}
                  weight={650}
                  color={MUTANT}
                >
                  vokser videre ut av grafen
                </Txt>
              )}
              <line x1={sx(t)} x2={sx(t)} y1={y0} y2={y1} className="viz-guide" />
              {now.total <= Y_MAX && (
                <circle cx={sx(t)} cy={sy(now.total * 100)} r={7} fill={color} stroke={VIZ.surface} strokeWidth={2.5} />
              )}
              {hasClone && now.mutant <= Y_MAX && (
                <circle cx={sx(t)} cy={sy(now.mutant * 100)} r={5.5} fill={MUTANT} stroke={VIZ.surface} strokeWidth={2} />
              )}
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

function explanation(
  p: { onkogen: boolean; tsg: boolean; damage: boolean; wound: number },
  state: TissueState,
  now: { total: number; mutant: number },
  healed: number | null,
): ReactNode {
  const model = (
    <p>
      Modellen er forenklet: cellene deler seg med en fast rate når de har vekstsignal og plass
      {p.onkogen || p.tsg ? ', og én liten gruppe celler i kanten av såret har mutasjonen' : ''}. I virkeligheten trengs det som regel
      mutasjoner i flere gener, ofte over mange år, før en celle blir en kreftcelle.
    </p>
  );
  const heal = healed === null ? `Laget er ikke grodd innen ${TISSUE_DAYS} døgn.` : `Laget er grodd etter ca. ${fmt(healed, 0)} døgn.`;
  let main: ReactNode;
  if (!p.onkogen && !p.tsg) {
    main =
      p.wound === 0 ? (
        <p>
          <strong>Friskt vev i likevekt.</strong> Laget er fullt, og cellene er i hvilefasen G0: de får ingen vekstsignaler og møter naboer
          på alle kanter (kontakthemming). Lag et sår med glidebryteren for å se cellene dele seg.
        </p>
      ) : (
        <p>
          <strong>Såret gror ved mitose.</strong> Cellene i kanten av såret får vekstsignaler og plass, går forbi G1-kontrollpunktet og
          deler seg. Når laget er fullt, stopper delingene av seg selv: cellene møter naboer på alle kanter (<strong>kontakthemming</strong>
          ) og går over i G0. {heal}
          {p.damage
            ? ' Med DNA-skade stopper kontrollpunktene cellene til skaden er reparert, og celler med for mye skade dør (apoptose). Derfor tar det lengre tid, men mutasjonene føres ikke videre.'
            : ''}
        </p>
      );
  } else if (p.onkogen && !p.tsg) {
    main = (
      <p>
        <strong>Onkogen: gasspedalen henger.</strong> Proto-onkogener gir signal om å dele seg. Mutasjonen gjør at cellene får delingssignal
        hele tida, så de muterte cellene deler seg raskere mens det er plass. Men bremsene virker: når laget er fullt, stopper
        kontakthemmingen og kontrollpunktene også disse cellene. Nå har {fmtPct(now.mutant, 1)} av cellene mutasjonen. Én mutasjon er
        sjelden nok, men flere celler med mutasjonen gir større sjanse for at én av dem får en ny mutasjon.
      </p>
    );
  } else if (!p.onkogen && p.tsg) {
    main = (
      <p>
        <strong>Tumorsuppressorgenet virker ikke: bremsen svikter.</strong> Tumorsuppressorgener (f.eks. p53) stopper cella ved
        kontrollpunktene når noe er galt, og sørger for kontakthemming. Uten bremsen fortsetter de muterte cellene å dele seg sakte også
        etter at såret har grodd, så vevet får for mange celler ({fmtPct(now.total)}).
        {p.damage ? ' DNA-skaden blir ikke oppdaget, så cellene deler seg med skadet DNA og samler opp flere mutasjoner.' : ''}
      </p>
    );
  } else {
    main = (
      <p>
        <strong>Både gasspedal og brems er ødelagt: en svulst.</strong> De muterte cellene får delingssignal hele tida, og ingenting stopper
        dem: ikke kontakthemmingen og ikke kontrollpunktene. Etter at såret har grodd, fortsetter de å dele seg og hoper seg opp til en
        svulst som vokser eksponentielt. Nå er antall celler {fmtPct(now.total)} av normalt. En svulst som vokser inn i vevet rundt og sprer
        seg med blodet eller lymfen (metastaser), er ondartet: kreft.
      </p>
    );
  }
  const why =
    state !== 'svulst' && !p.onkogen && !p.tsg && p.wound > 0 ? (
      <p>
        Reguleringen gjør at vi kan vokse og reparere skader uten å få for mange celler: delingene starter når det trengs, og stopper når
        jobben er gjort.
      </p>
    ) : null;
  return (
    <>
      {main}
      {why}
      {model}
    </>
  );
}
