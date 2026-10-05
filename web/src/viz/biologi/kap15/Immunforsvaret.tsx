import { useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  Antistoff,
  Arrow,
  BIO,
  Controls,
  Explain,
  Figure,
  HvittBlodlegeme,
  Legend,
  PlayBar,
  Readout,
  Readouts,
  Segmented,
  Slider,
  Toggle,
  Toolbar,
  Txt,
  VIZ,
  Virus,
  VizLayout,
  fmt,
  linePath,
  mixColor,
  roundedRectPath,
  useContainerTextScale,
  useSimClock,
} from '../kit';
import {
  IMMUNE_DAYS,
  SICK_LEVEL,
  defenseStage,
  immuneRun,
  type DefenseStage,
  type FirstExposure,
  type ImmuneRun,
  type ImmuneScenario,
} from './model';

const AB = BIO.antistoff;
const PATH = BIO.antigen;
const IMM = BIO.immuncelle;

const FIRSTS: { value: FirstExposure; label: string }[] = [
  { value: 'sykdom', label: 'Første møte: sykdom' },
  { value: 'vaksine', label: 'Første møte: vaksine' },
];

export default function Immunforsvaret() {
  const [first, setFirst] = useState<FirstExposure>('sykdom');
  const [second, setSecond] = useState(60);
  const [noMemory, setNoMemory] = useState(false);
  const s: ImmuneScenario = { first, second, memory: !noMemory };
  const run = useMemo(() => immuneRun({ first, second, memory: !noMemory }), [first, second, noMemory]);
  const clock = useSimClock({ tMax: IMMUNE_DAYS, speed: IMMUNE_DAYS / 16 });
  const { setT, pause } = clock;
  // Åpner midt i primærresponsen
  useEffect(() => setT(10), [setT]);
  const t = Math.min(IMMUNE_DAYS, clock.t);
  const stage = defenseStage(s, t);
  const [ref, f] = useContainerTextScale<HTMLDivElement>();
  const [flowRef, ff] = useContainerTextScale<HTMLDivElement>();
  const ratio = run.peaks[1].level / Math.max(1e-9, run.peaks[0].level);

  return (
    <VizLayout>
      <Toolbar>
        <Segmented label="Første møte med antigenet" options={FIRSTS} value={first} onChange={setFirst} />
        <Toggle label="Tenk deg: uten hukommelsesceller" checked={noMemory} onChange={setNoMemory} />
      </Toolbar>
      <Controls>
        <Slider label="Andre møte (smitte)" value={second} onChange={setSecond} min={30} max={140} step={5} format={(v) => `dag ${fmt(v, 0)}`} />
        <Slider
          label="Tid"
          value={Math.round(t)}
          onChange={(v) => {
            pause();
            setT(v);
          }}
          min={0}
          max={IMMUNE_DAYS}
          step={1}
          format={(v) => `dag ${fmt(v, 0)}`}
        />
      </Controls>
      <Toolbar>
        <PlayBar clock={clock} time={`dag ${fmt(t, 0)}`} />
      </Toolbar>

      <div ref={ref}>
        <ResponseFigure run={run} s={s} t={t} f={f} />
      </div>
      <Legend
        items={[
          { color: PATH, label: first === 'vaksine' ? 'Smittestoff (og antigen fra vaksinen)' : 'Smittestoff i kroppen' },
          { color: AB, label: 'Antistoffer i blodet' },
          { color: mixColor(VIZ.surface, PATH, 0.6), label: 'Syk' },
        ]}
      />

      <div ref={flowRef}>
        <FlowFigure stage={stage} vaccine={first === 'vaksine' && t < second} memoryResponse={!noMemory && t >= second} f={ff} />
      </div>

      <Readouts>
        <Readout label="Topp etter 1. møte" value={`dag ${fmt(run.peaks[0].day, 0)}`} tone={AB} />
        <Readout label="Topp etter 2. møte" value={`dag ${fmt(run.peaks[1].day, 0)}`} unit="etter smitten" tone={AB} />
        <Readout label="Antistofftoppen" value={`${fmt(ratio, ratio < 2 ? 1 : 0)} ganger`} unit="så høy andre gang" />
        <Readout
          label="Syk (døgn)"
          value={`${fmt(run.sickDays[0], 0)} og ${fmt(run.sickDays[1], 0)}`}
          unit="første og andre gang"
          tone={run.sickDays[1] > 0 ? PATH : BIO.sir.R}
        />
      </Readouts>

      <Explain>{explanation(s, run, t, stage)}</Explain>
    </VizLayout>
  );
}

/* ---------- Smittestoff og antistoffer over tid ---------- */

function ResponseFigure({ run, s, t, f }: { run: ImmuneRun; s: ImmuneScenario; t: number; f: number }) {
  const X0 = 64 * f;
  const X1 = 776;
  const sx = (d: number) => X0 + (d / IMMUNE_DAYS) * (X1 - X0);
  const title = 26 * f;
  const yPT = 8 + title;
  const pathH = Math.round(110 + 110 * (f - 1));
  const yAT = yPT + pathH + 18 + title;
  const abH = Math.round(200 + 200 * (f - 1));
  const yAxis = yAT + abH;
  const H = Math.round(yAxis + 28 * f + 26 * f);
  const abMax = Math.max(2, ...run.antibodies) * 1.1;
  const nice = [2, 4, 6, 8, 12, 15].find((v) => v >= abMax) ?? 15;
  const abTicks = nice <= 4 ? [0, 1, 2, 3, 4].filter((v) => v <= nice) : nice <= 8 ? [0, 2, 4, 6, 8].filter((v) => v <= nice) : [0, 5, 10, 15].filter((v) => v <= nice);
  const py = (p: number) => yPT + pathH - (Math.min(1, p) / 1.05) * pathH;
  const ay = (a: number) => yAxis - (a / nice) * abH;
  const step = 4;
  const pts = (arr: number[]) => run.t.filter((_, i) => i % step === 0).map((d, i) => [d, arr[i * step]!] as [number, number]);
  const pPts = pts(run.pathogen);
  const aPts = pts(run.antibodies);
  const sickSpans: [number, number][] = [];
  let start: number | null = null;
  run.pathogen.forEach((p, i) => {
    const sick = p >= SICK_LEVEL;
    if (sick && start === null) start = run.t[i]!;
    if (!sick && start !== null) {
      sickSpans.push([start, run.t[i]!]);
      start = null;
    }
  });
  const idx = Math.min(run.t.length - 1, Math.round((t / IMMUNE_DAYS) * (run.t.length - 1)));
  const ticks = f > 1.3 ? [0, 50, 100, 150, 200] : [0, 25, 50, 75, 100, 125, 150, 175, 200];
  const p1 = run.peaks[0];
  const p2 = run.peaks[1];
  const short = f > 1.3 || sx(s.second + p2.day) - sx(p1.day) < 170;
  return (
    <Figure
      viewBox={`0 0 800 ${H}`}
      maxHeight={Math.round(H * 1.25)}
      label={`Smittestoff og antistoffer over ${IMMUNE_DAYS} døgn. Første møte dag 0, andre møte dag ${s.second}. Antistofftoppen er ${fmt(p2.level / Math.max(1e-9, p1.level), 0)} ganger så høy andre gang.`}
      caption="Skjematisk: antistoffnivået er relativt (1 = toppen etter første møte). Hukommelsescellene gir en raskere og sterkere respons."
    >
      {/* Smittestoff */}
      <Txt x={f > 1.3 ? X0 : X1} y={yPT - 8} anchor={f > 1.3 ? 'start' : 'end'} size={0.85} weight={650}>
        Smittestoff i kroppen
      </Txt>
      {sickSpans.map(([a, b], i) => (
        <rect key={i} x={sx(a)} y={yPT} width={Math.max(2, sx(b) - sx(a))} height={pathH} fill={mixColor(VIZ.surface, PATH, 0.16)} />
      ))}
      <rect x={X0} y={yPT} width={X1 - X0} height={pathH} fill="none" stroke={VIZ.grid} strokeWidth={1.2} />
      <line x1={X0} x2={X1} y1={py(SICK_LEVEL)} y2={py(SICK_LEVEL)} stroke={PATH} strokeWidth={1.4} strokeDasharray="4 5" opacity={0.7} />
      <Txt x={X1 - 6} y={py(SICK_LEVEL) - 6} anchor="end" size={0.72} color={PATH}>
        syk over denne linja
      </Txt>
      <path d={`${linePath(pPts, sx, py)} L${sx(IMMUNE_DAYS)},${py(0)} L${sx(0)},${py(0)} Z`} fill={mixColor(VIZ.surface, PATH, 0.3)} />
      <path d={linePath(pPts, sx, py)} fill="none" stroke={PATH} strokeWidth={2.6} />
      {/* Møtene */}
      {[
        { d: 0, label: f > 1.3 ? '1.' : s.first === 'vaksine' ? '1. vaksine' : '1. smitte' },
        { d: s.second, label: f > 1.3 ? '2.' : '2. smitte' },
      ].map((m) => {
        const left = m.d > 110;
        return (
          <g key={m.d}>
            {/* Gjennom begge panelene, men ikke gjennom tittelen «Antistoffer i blodet» mellom dem */}
            <line x1={sx(m.d)} x2={sx(m.d)} y1={f > 1.3 ? yPT : yPT - 22 * f} y2={yPT + pathH} stroke={VIZ.muted} strokeWidth={1.5} strokeDasharray="5 4" />
            <line x1={sx(m.d)} x2={sx(m.d)} y1={yAT} y2={yAxis} stroke={VIZ.muted} strokeWidth={1.5} strokeDasharray="5 4" />
            <Txt x={left ? sx(m.d) - 6 : sx(m.d) + 6} y={f > 1.3 ? yPT + 20 * f : yPT - 8} anchor={left ? 'end' : 'start'} size={0.75} weight={650}>
              {m.label}
            </Txt>
          </g>
        );
      })}

      {/* Antistoffer */}
      <Txt x={X0} y={yAT - 8} anchor="start" size={0.85} weight={650}>
        Antistoffer i blodet
      </Txt>
      {abTicks.map((v) => (
        <g key={v}>
          <line x1={X0} x2={X1} y1={ay(v)} y2={ay(v)} className="viz-gridline" />
          <text x={X0 - 10} y={ay(v) + 5 * f} textAnchor="end" className="viz-tick">
            {fmt(v, 0)}
          </text>
        </g>
      ))}
      <path d={`${linePath(aPts, sx, ay)} L${sx(IMMUNE_DAYS)},${ay(0)} L${sx(0)},${ay(0)} Z`} fill={mixColor(VIZ.surface, AB, 0.22)} />
      <path d={linePath(aPts, sx, ay)} fill="none" stroke={AB} strokeWidth={3.2} />
      {/* Korte etiketter når toppene ligger nær hverandre (tidlig andre møte), så de ikke overlapper */}
      <PeakLabel x={sx(p1.day)} y={ay(p1.level)} text={short ? 'primær' : 'primærrespons'} right={false} f={f} />
      <PeakLabel
        x={sx(s.second + p2.day)}
        y={ay(p2.level)}
        text={s.memory ? (short ? 'sekundær' : 'sekundærrespons') : short ? 'ny primær' : 'ny primærrespons'}
        right={sx(s.second + p2.day) > 600}
        f={f}
      />
      {/* Akse */}
      <line x1={X0} x2={X1} y1={yAxis} y2={yAxis} className="viz-axis" />
      {ticks.map((d) => (
        <g key={d}>
          <line x1={sx(d)} x2={sx(d)} y1={yAxis} y2={yAxis + 6} className="viz-axis" />
          <Txt x={sx(d)} y={yAxis + 24 * f} size={0.8} muted>
            {d}
          </Txt>
        </g>
      ))}
      <Txt x={(X0 + X1) / 2} y={H - 8} size={0.85} muted>
        Tid (døgn)
      </Txt>
      {/* Valgt tid */}
      <line x1={sx(t)} x2={sx(t)} y1={yPT} y2={yPT + pathH} stroke={VIZ.ink} strokeWidth={1.6} strokeDasharray="4 4" />
      <line x1={sx(t)} x2={sx(t)} y1={yAT} y2={yAxis} stroke={VIZ.ink} strokeWidth={1.6} strokeDasharray="4 4" />
      <circle cx={sx(t)} cy={py(run.pathogen[idx] ?? 0)} r={5.5} fill={PATH} stroke={VIZ.surface} strokeWidth={2.2} />
      <circle cx={sx(t)} cy={ay(run.antibodies[idx] ?? 0)} r={6} fill={AB} stroke={VIZ.surface} strokeWidth={2.2} />
    </Figure>
  );
}

function PeakLabel({ x, y, text, right, f }: { x: number; y: number; text: string; right: boolean; f: number }) {
  return (
    <g>
      <circle cx={x} cy={y} r={4.5} fill={AB} />
      <Txt x={right ? x - 10 : x + 10} y={y - 8 * f} anchor={right ? 'end' : 'start'} size={0.78} color={AB} weight={700}>
        {text}
      </Txt>
    </g>
  );
}

/* ---------- Forsvaret steg for steg ---------- */

type NodeId = 'smitte' | 'fagocytt' | 'thjelper' | 'plasma' | 'drepe' | 'hukommelse';

const ACTIVE: Record<DefenseStage, NodeId[]> = {
  ingen: [],
  uspesifikt: ['smitte', 'fagocytt'],
  aktivering: ['fagocytt', 'thjelper'],
  effekt: ['thjelper', 'plasma', 'drepe'],
  hukommelse: ['hukommelse'],
};

function FlowFigure({ stage, vaccine, memoryResponse, f }: { stage: DefenseStage; vaccine: boolean; memoryResponse: boolean; f: number }) {
  const narrow = f > 1.3;
  const k = Math.max(1, 0.85 * f);
  const size = 54 * k;
  const pos: Record<NodeId, [number, number]> = narrow
    ? {
        smitte: [220, 130],
        fagocytt: [580, 130],
        thjelper: [400, 420],
        plasma: [200, 710],
        drepe: [600, 710],
        hukommelse: [400, 1000],
      }
    : {
        smitte: [80, 150],
        fagocytt: [220, 150],
        thjelper: [385, 150],
        plasma: [555, 80],
        drepe: [555, 225],
        hukommelse: [715, 150],
      };
  const H = narrow ? 1150 : 330;
  // I sekundærresponsen er det hukommelsescellene som kjenner igjen antigenet og raskt blir effektorceller
  const recall = memoryResponse && (stage === 'aktivering' || stage === 'effekt');
  const active: NodeId[] = recall ? [...ACTIVE[stage], 'hukommelse'] : ACTIVE[stage];
  const on = (id: NodeId) => stage === 'ingen' || active.includes(id);
  const nowText = (recall ? RECALL_TEXT[stage] : undefined) ?? STAGE_TEXT[stage];
  const labels: Record<NodeId, [string, string]> = {
    smitte: vaccine ? ['Vaksine', '(antigen)'] : ['Smittestoff', 'kommer inn'],
    fagocytt: ['Fagocytter', narrow ? 'spiser' : 'spiser og viser fram'],
    thjelper: ['T-hjelpecelle', 'aktiveres'],
    plasma: narrow ? ['Plasmaceller', 'lager antistoffer'] : ['B-celler → plasmaceller', 'lager antistoffer'],
    drepe: narrow ? ['Drepe-T-celler', 'dreper inf. celler'] : ['Drepe-T-celler', 'dreper infiserte celler'],
    hukommelse: [narrow ? 'Hukommelses-' : 'Hukommelsesceller', narrow ? 'celler' : '(B og T)'],
  };
  const glyph = (id: NodeId, x: number, y: number) => {
    switch (id) {
      case 'smitte':
        return <Virus x={x} y={y} size={size} type="kappekledd" />;
      case 'fagocytt':
        return <HvittBlodlegeme x={x} y={y} size={size * 1.1} type="makrofag" />;
      case 'thjelper':
        return <HvittBlodlegeme x={x} y={y} size={size} type="lymfocytt" />;
      case 'plasma':
        return (
          <g>
            <HvittBlodlegeme x={x - size * 0.2} y={y} size={size} type="lymfocytt" paint={{ fill: mixColor(VIZ.surface, AB, 0.2), line: AB }} />
            <Antistoff x={x + size * 0.55} y={y - size * 0.25} size={size * 0.45} />
            <Antistoff x={x + size * 0.7} y={y + size * 0.2} size={size * 0.4} rotate={30} />
          </g>
        );
      case 'drepe':
        return (
          <g>
            <HvittBlodlegeme x={x} y={y} size={size} type="lymfocytt" paint={{ fill: mixColor(VIZ.surface, PATH, 0.15), line: PATH }} />
          </g>
        );
      case 'hukommelse':
        return (
          <g>
            <circle cx={x} cy={y} r={size * 0.62} fill="none" stroke={IMM.line} strokeWidth={2} strokeDasharray="5 4" />
            <HvittBlodlegeme x={x} y={y} size={size} type="lymfocytt" />
          </g>
        );
    }
  };
  const arrows: [NodeId, NodeId, string?][] = [
    ['smitte', 'fagocytt'],
    ['fagocytt', 'thjelper', narrow ? undefined : 'antigen'],
    ['thjelper', 'plasma'],
    ['thjelper', 'drepe'],
    ['plasma', 'hukommelse'],
    ['drepe', 'hukommelse'],
  ];
  const gap = size * 0.75;
  return (
    <Figure
      viewBox={`0 0 800 ${H}`}
      maxHeight={Math.round(H * 1.25)}
      label={`Immunforsvaret steg for steg. Nå: ${nowText}.`}
      caption={`Nå: ${nowText}.`}
    >
      {/* Uspesifikt og spesifikt forsvar */}
      {narrow ? (
        <g>
          <path d={roundedRectPath(20, 20, 760, 250, 16)} fill={mixColor(VIZ.surface, VIZ.muted, 0.07)} stroke={VIZ.grid} />
          <path d={roundedRectPath(20, 290, 760, 840, 16)} fill={mixColor(VIZ.surface, IMM.line, 0.06)} stroke={VIZ.grid} />
          <Txt x={36} y={20 + 26 * f} anchor="start" size={0.8} muted weight={650}>
            Uspesifikt forsvar
          </Txt>
          <Txt x={36} y={290 + 26 * f} anchor="start" size={0.8} muted weight={650}>
            Spesifikt forsvar
          </Txt>
        </g>
      ) : (
        <g>
          <path d={roundedRectPath(14, 14, 280, H - 28, 16)} fill={mixColor(VIZ.surface, VIZ.muted, 0.07)} stroke={VIZ.grid} />
          <path d={roundedRectPath(304, 14, 482, H - 28, 16)} fill={mixColor(VIZ.surface, IMM.line, 0.06)} stroke={VIZ.grid} />
          <Txt x={28} y={38} anchor="start" size={0.8} muted weight={650}>
            Uspesifikt forsvar
          </Txt>
          <Txt x={318} y={38} anchor="start" size={0.8} muted weight={650}>
            Spesifikt forsvar
          </Txt>
        </g>
      )}
      {arrows.map(([a, b, label]) => {
        const [x1, y1] = pos[a];
        const [x2, y2] = pos[b];
        const len = Math.hypot(x2 - x1, y2 - y1);
        const ux = (x2 - x1) / len;
        const uy = (y2 - y1) / len;
        const lit = on(a) && on(b) && stage !== 'ingen';
        return (
          <g key={`${a}-${b}`} opacity={lit || stage === 'ingen' ? 1 : 0.35}>
            <Arrow x1={x1 + ux * gap} y1={y1 + uy * gap} x2={x2 - ux * gap} y2={y2 - uy * gap} color={lit ? IMM.line : VIZ.muted} width={lit ? 3.5 : 2.2} head={12} />
            {label && (
              <Txt x={(x1 + x2) / 2} y={(y1 + y2) / 2 - 10} size={0.72} muted>
                {label}
              </Txt>
            )}
          </g>
        );
      })}
      {(Object.keys(pos) as NodeId[]).map((id) => {
        const [x, y] = pos[id];
        const lit = on(id) && stage !== 'ingen';
        return (
          <g key={id} opacity={on(id) ? 1 : 0.35}>
            {lit && <circle cx={x} cy={y} r={size * 0.78} fill={mixColor(VIZ.surface, IMM.line, 0.16)} />}
            {glyph(id, x, y)}
            <Txt x={x} y={y + size * 0.62 + 20 * f} size={0.75} weight={lit ? 700 : 560}>
              {labels[id][0]}
            </Txt>
            <Txt x={x} y={y + size * 0.62 + 40 * f} size={0.72} muted>
              {labels[id][1]}
            </Txt>
          </g>
        );
      })}
    </Figure>
  );
}

/** Teksten i sekundærresponsen, når hukommelsescellene er med fra starten. */
const RECALL_TEXT: Partial<Record<DefenseStage, string>> = {
  aktivering: 'hukommelsescellene kjenner igjen antigenet og aktiveres med en gang',
  effekt: 'hukommelsescellene blir raskt til plasmaceller og drepe-T-celler, og det lages mange antistoffer',
};

const STAGE_TEXT: Record<DefenseStage, string> = {
  ingen: 'ingen infeksjon',
  uspesifikt: 'det uspesifikke forsvaret (fagocytter) tar imot smittestoffet',
  aktivering: 'T-hjelpeceller som passer til antigenet, blir aktivert',
  effekt: 'plasmaceller lager antistoffer, og drepe-T-celler dreper infiserte celler',
  hukommelse: 'hukommelsescellene blir værende i kroppen',
};

/* ---------- Forklaring ---------- */

function explanation(s: ImmuneScenario, run: ImmuneRun, t: number, stage: DefenseStage): ReactNode {
  const afterSecond = t >= s.second;
  const vaccine = s.first === 'vaksine';
  const antibodies = (
    <p>
      Antistoffer dreper ikke smittestoffet selv. De binder seg til antigenene, så viruset ikke kan feste seg til cellene våre, og så
      fagocyttene lettere kan spise det. Antistoffene og hukommelsescellene passer bare til ett bestemt antigen, derfor gir meslinger ikke
      beskyttelse mot vannkopper, og influensavaksinen må fornyes når viruset endrer seg.
    </p>
  );
  if (!afterSecond) {
    const stageText: Record<DefenseStage, ReactNode> = {
      ingen: null,
      uspesifikt: (
        <>
          Først møter smittestoffet hud og slimhinner og det <strong>uspesifikke forsvaret</strong>: fagocytter (makrofager og granulocytter)
          spiser alt som er fremmed, og det kan bli betennelse og feber. Dette forsvaret er likt for alle smittestoffer.
        </>
      ),
      aktivering: (
        <>
          Makrofagene viser fram biter av smittestoffet (antigener) til <strong>T-hjelpecellene</strong>. Bare de få T-hjelpecellene som
          passer til akkurat dette antigenet, blir aktivert og deler seg. Det tar tid, og derfor kommer primærresponsen sent.
        </>
      ),
      effekt: (
        <>
          T-hjelpecellene aktiverer B-celler som deler seg og blir <strong>plasmaceller</strong> som lager antistoffer, og{' '}
          <strong>drepe-T-celler</strong> som dreper celler som er infisert.
          {vaccine
            ? ' Med vaksinen skjer dette uten at du blir syk: vaksinen inneholder drepte eller svekkede smittestoffer, eller bare deler av dem (antigenene).'
            : ` Primærresponsen er på topp ca. ${fmt(run.peaks[0].day, 0)} døgn etter smitten, og du har vært syk i ca. ${fmt(run.sickDays[0], 0)} døgn.`}
        </>
      ),
      hukommelse: (
        <>
          Smittestoffet er borte, og antistoffnivået synker. Men noen B- og T-celler blir værende som <strong>hukommelsesceller</strong>
          {s.memory ? ', i mange år, og de kjenner igjen antigenet neste gang.' : '. I dette tenkte tilfellet mangler de, så kroppen husker ingenting.'}
        </>
      ),
    };
    return (
      <>
        <p>
          <strong>{vaccine ? 'Vaksinen: første møte med antigenet.' : 'Første møte: primærrespons.'}</strong> {stageText[stage]}
        </p>
        {antibodies}
      </>
    );
  }
  if (!s.memory)
    return (
      <>
        <p>
          <strong>Uten hukommelsesceller.</strong> Kroppen må starte helt på nytt: en ny primærrespons som kommer etter ca. en uke.{' '}
          {run.sickDays[1] > 0
            ? `Du er syk i ca. ${fmt(run.sickDays[1], 0)} døgn igjen.`
            : 'Denne gangen var det fortsatt nok antistoffer igjen fra første møte til å holde smittestoffet nede, men de forsvinner etter hvert. Flytt det andre møtet senere, så blir du syk igjen.'}{' '}
          Det er hukommelsescellene som gjør at vi blir immune i mange år etter sykdom og etter vaksinasjon.
        </p>
        {antibodies}
      </>
    );
  return (
    <>
      <p>
        <strong>Andre møte: sekundærrespons.</strong> {vaccine ? 'Vaksinen' : 'Den første sykdommen'} ga hukommelsesceller. Når det samme
        smittestoffet kommer igjen, kjenner de det igjen med en gang: antistoffene stiger etter 1–2 døgn i stedet for en uke, blir ca.{' '}
        {fmt(run.peaks[1].level / Math.max(1e-9, run.peaks[0].level), 0)} ganger så høye og varer lenger. Smittestoffet fjernes før det rekker
        å formere seg mye, så du blir {run.sickDays[1] > 0 ? `bare syk i ca. ${fmt(run.sickDays[1], 0)} døgn` : 'ikke syk'}: du er{' '}
        <strong>immun</strong>.
        {vaccine ? ' Slik beskytter vaksiner: de gir hukommelsesceller uten at du må bli syk først.' : ''}
      </p>
      {antibodies}
    </>
  );
}
