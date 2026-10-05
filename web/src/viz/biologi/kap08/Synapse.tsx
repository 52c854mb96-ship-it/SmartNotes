import { useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  BIO,
  Baereprotein,
  Cellemembran,
  Controls,
  Explain,
  Figure,
  Kanalprotein,
  Legend,
  Membran,
  PlayBar,
  Plot,
  Readout,
  Readouts,
  Reseptor,
  Slider,
  Toggle,
  Toolbar,
  Txt,
  VIZ,
  VizLayout,
  fmt,
  fmtPct,
  jiggle,
  linePath,
  placeParticles,
  proteinSlot,
  useContainerTextScale,
  useLineScale,
  useSimClock,
  type Box,
} from '../kit';
import {
  FIRST_IMPULSE,
  IMPULSE_INTERVAL,
  RECEPTOR_BLOCK,
  REUPTAKE_BLOCK,
  SYNAPSE_T_MAX,
  SYNAPTIC_DELAY,
  V_REST,
  V_THRESHOLD,
  simulateSynapse,
  type SynapseRun,
} from './model';

const NT = BIO.signal;
const CA = BIO.sukker;
const NA = BIO.natrium;
const BLOCK = VIZ.muted;

export default function Synapse() {
  const [impulses, setImpulses] = useState(3);
  const [inhibitor, setInhibitor] = useState(false);
  const [blocker, setBlocker] = useState(false);
  const run = useMemo(
    () => simulateSynapse({ impulses, reuptakeInhibitor: inhibitor, receptorBlocker: blocker }),
    [impulses, inhibitor, blocker],
  );
  const clock = useSimClock({ tMax: SYNAPSE_T_MAX, speed: 2.5 });
  const { setT, pause } = clock;
  // Vis øyeblikket like etter at signalstoffet fra den første impulsen er frigjort
  useEffect(() => setT(FIRST_IMPULSE + 1.2), [setT]);
  const t = clock.t;
  const ntNow = run.nt(t);
  const recNow = run.receptors(t);
  const vPost = run.post(t);
  const ntPeak = useMemo(() => {
    let m = 0;
    for (let s = 0; s <= SYNAPSE_T_MAX; s += 0.1) m = Math.max(m, run.nt(s));
    return m;
  }, [run]);

  return (
    <VizLayout>
      <Controls>
        <Slider label="Antall nerveimpulser" value={impulses} onChange={setImpulses} min={1} max={5} step={1} />
        <Slider
          label="Tid"
          value={Math.round(t * 10) / 10}
          onChange={(v) => {
            pause();
            setT(v);
          }}
          min={0}
          max={SYNAPSE_T_MAX}
          step={0.1}
          unit="ms"
          decimals={1}
        />
      </Controls>
      <Toolbar>
        <Toggle label="Reopptakshemmer (f.eks. SSRI)" checked={inhibitor} onChange={setInhibitor} />
        <Toggle label="Reseptorblokker" checked={blocker} onChange={setBlocker} />
      </Toolbar>
      <Toolbar>
        <PlayBar clock={clock} time={`t = ${fmt(t, 1)} ms (sakte film)`} />
      </Toolbar>

      <SynapseScene run={run} t={t} inhibitor={inhibitor} blocker={blocker} />
      <Legend
        items={[
          { color: NT, label: 'Signalstoff (nevrotransmitter)' },
          { color: CA, label: 'Kalsiumioner (Ca²⁺)' },
          { color: NA, label: 'Natriumioner (Na⁺)' },
          ...(inhibitor || blocker ? [{ color: BLOCK, label: 'Legemiddel' }] : []),
        ]}
      />

      <SynapsePlots run={run} t={t} />
      <Legend
        items={[
          { color: BIO.dna, label: 'Membranpotensial' },
          { color: NT, label: 'Signalstoff i spalten' },
          { color: BIO.serie[0], label: 'Reseptorer aktivert', dashed: true },
          { color: VIZ.muted, label: 'Terskel −55 mV', dashed: true },
        ]}
      />

      <Readouts>
        <Readout label="Signalstoff i spalten" value={fmt(ntNow, 2)} unit={`(topp ${fmt(ntPeak, 2)})`} tone={NT} />
        <Readout label="Reseptorer aktivert" value={fmtPct(recNow)} />
        <Readout label="Nervecelle 2 nå" value={fmt(vPost, 0)} unit="mV" />
        <Readout
          label="Aksjonspotensialer i nervecelle 2"
          value={String(run.postSpikes.length)}
          tone={run.postSpikes.length ? NA : undefined}
        />
      </Readouts>

      <Explain>{explanation(run, impulses, inhibitor, blocker, ntPeak)}</Explain>
    </VizLayout>
  );
}

/* ====================================================================== */
/* Synapsen                                                                 */
/* ====================================================================== */

const CA_X = [200, 600];
const RE_X = [320, 480];
const REC_X = [250, 350, 450, 550];

function SynapseScene({ run, t, inhibitor, blocker }: { run: SynapseRun; t: number; inhibitor: boolean; blocker: boolean }) {
  const [ref, f] = useContainerTextScale<HTMLDivElement>();
  const lw = useLineScale();
  const narrow = f > 1.3;
  const k = Math.max(1, f * 0.85);
  const T = Math.round(40 * Math.min(1.4, k));
  const top = 24 * f;
  const yPre = top + 190 + 60 * (f - 1);
  const gap = 96 + 40 * (f - 1);
  const yPost = yPre + T + gap;
  const H = Math.round(yPost + T / 2 + 110 + 40 * (f - 1));
  const left = narrow ? 70 : 130;
  const right = 800 - left;
  // Endeknappen: en avrundet «knapp» med aksonet ovenfra
  const neckL = 340;
  const neckR = 460;
  const preOutline = `M${neckL},0 L${neckL},${top + 30} C${neckL},${top + 60} ${left},${top + 40} ${left},${top + 110} L${left},${yPre - T / 2} L${right},${yPre - T / 2} L${right},${top + 110} C${right},${top + 40} ${neckR},${top + 60} ${neckR},${top + 30} L${neckR},0`;
  const postTop = yPost + T / 2;
  const cleft: Box = { x: left + 10, y: yPre + T / 2 + 10, w: right - left - 20, h: gap - 20 };
  const unit = useMemo(() => placeParticles({ x: 0, y: 0, w: 1000, h: 300 }, [{ n: 40, r: 26 }], 5, 6), []);
  const nCleft = Math.min(unit.length, Math.round(run.nt(t) * 14));
  const r = 5.5 * k;
  // Nerveimpulsen i endeknappen
  const vPre = run.pre(t);
  const ca = Math.min(1, run.calcium(t));
  const released = run.arrivals.filter((a) => t >= a + SYNAPTIC_DELAY).length;
  const vesicles = [
    { x: 300, y: yPre - T / 2 - 34 },
    { x: 400, y: yPre - T / 2 - 30 },
    { x: 500, y: yPre - T / 2 - 34 },
    { x: 350, y: yPre - T / 2 - 84 },
    { x: 450, y: yPre - T / 2 - 84 },
  ];
  const recBound = Math.round(run.receptors(t) * REC_X.length + 0.2);
  const blockedCount = blocker ? Math.round(RECEPTOR_BLOCK * REC_X.length) : 0;
  const slotsPre = [...CA_X.map((x) => proteinSlot(x, 'kanal', T)), ...RE_X.map((x) => proteinSlot(x, 'baerer', T))];
  const slotsPost = REC_X.map((x) => proteinSlot(x, 'reseptor', T));
  const phase = (t * 0.9) % 1;
  const firing = vPre > -40;
  const vPost = run.post(t);
  return (
    <div ref={ref}>
      <Figure
        viewBox={`0 0 800 ${H}`}
        maxHeight={narrow ? 900 : 560}
        label={`Kjemisk synapse ved ${fmt(t, 1)} ms. Signalstoff i spalten: ${fmt(run.nt(t), 2)}. Nervecelle 2: ${fmt(vPost, 0)} mV.`}
        caption="Synapsespalten er i virkeligheten bare 20–40 nanometer bred. Hver prikk er mange molekyler."
      >
        {/* Endeknappen */}
        <path d={`${preOutline} Z`} fill={BIO.cytoplasma} />
        {firing && <path d={`${preOutline} Z`} fill={NA} opacity={0.12} />}
        <Cellemembran d={preOutline} />
        <Txt x={neckL - 12} y={top + 4} anchor="end" size={0.8} muted>
          {firing ? 'Aksjonspotensial kommer' : 'Akson fra nervecelle 1'}
        </Txt>
        <Txt x={left + 14} y={top + 100 + 10 * (f - 1)} anchor="start" size={0.85} weight={650}>
          Endeknapp
        </Txt>
        {/* Vesikler: de første `released` har tømt seg */}
        {vesicles.map((v, i) => {
          const done = i < released;
          return done ? null : (
            <g key={`v${i}`}>
              <circle cx={v.x} cy={v.y} r={20 * Math.min(1.3, k)} fill={BIO.golgi.fill} stroke={BIO.golgi.line} strokeWidth={1.5 * lw} />
              {[-7, 0, 7].map((dx, j) => (
                <circle key={j} cx={v.x + dx * Math.min(1.3, k)} cy={v.y + (j === 1 ? -5 : 4)} r={3.5 * Math.min(1.3, k)} fill={NT} />
              ))}
            </g>
          );
        })}
        {!narrow && (
          <g>
            <line x1={vesicles[2]!.x + 14} y1={vesicles[2]!.y - 14} x2={neckR + 46} y2={top + 46} stroke={VIZ.muted} strokeWidth={1.3} />
            <Txt x={neckR + 52} y={top + 44} anchor="start" size={0.8} muted>
              Vesikler med signalstoff
            </Txt>
          </g>
        )}
        <Membran x={400} y={yPre} length={right - left} thickness={T} skip={slotsPre} />
        {CA_X.map((x) => (
          <Kanalprotein key={`ca${x}`} x={x} y={yPre} thickness={T} open={ca > 0.1} />
        ))}
        {RE_X.map((x) => (
          <g key={`re${x}`}>
            <Baereprotein x={x} y={yPre} thickness={T} state={(t * 0.5) % 1 < 0.5 ? 0.15 : 0.85} />
            {inhibitor && (
              <path
                d={`M${x},${yPre + T * 0.55} l${T * 0.2},${T * 0.25} l${-T * 0.2},${T * 0.25} l${-T * 0.2},${-T * 0.25} Z`}
                fill={BLOCK}
                stroke={VIZ.surface}
                strokeWidth={1.2 * lw}
              />
            )}
          </g>
        ))}
        {/* Ca²⁺ strømmer inn */}
        {ca > 0.1 &&
          CA_X.map((x) =>
            [0, 1].map((i) => {
              const u = (phase + i / 2) % 1;
              return (
                <circle
                  key={`cai${x}${i}`}
                  cx={x}
                  cy={yPre + T / 2 + 26 - (T + 70) * u}
                  r={r}
                  fill={CA}
                  stroke={VIZ.surface}
                  strokeWidth={1.2 * lw}
                  opacity={ca}
                />
              );
            }),
          )}
        {/* Signalstoff i spalten */}
        {unit.slice(0, nCleft).map((p, i) => {
          const j = jiggle(p, t * 0.8, 14);
          return (
            <circle
              key={`nt${i}`}
              cx={cleft.x + (cleft.w * Math.min(1000, Math.max(0, j.x))) / 1000}
              cy={cleft.y + (cleft.h * Math.min(300, Math.max(0, j.y))) / 300}
              r={r}
              fill={NT}
              stroke={VIZ.surface}
              strokeWidth={1.2 * lw}
            />
          );
        })}
        <Txt x={right + (narrow ? -10 : 14)} y={yPre + T / 2 + gap / 2 + 5} anchor={narrow ? 'end' : 'start'} size={0.8} muted>
          {narrow ? 'Spalt' : 'Synapsespalt'}
        </Txt>
        {/* Neste celle */}
        <rect x={left - 40} y={postTop} width={right - left + 80} height={H - postTop - 8} rx={14} fill={BIO.cytoplasma} />
        <Membran x={400} y={yPost} length={right - left + 80} thickness={T} skip={slotsPost} />
        {REC_X.map((x, i) => {
          const blocked = i < blockedCount;
          const bound = !blocked && i >= blockedCount && i - blockedCount < recBound;
          return (
            <g key={`rec${x}`}>
              <Reseptor x={x} y={yPost} thickness={T} bound={bound} />
              {blocked && (
                <path
                  d={`M${x},${yPost - T * 0.95} l${T * 0.18},${-T * 0.22} l${-T * 0.18},${-T * 0.22} l${-T * 0.18},${T * 0.22} Z`}
                  fill={BLOCK}
                  stroke={VIZ.surface}
                  strokeWidth={1.2 * lw}
                />
              )}
              {bound &&
                [0, 1].map((j) => {
                  const u = (phase + j / 2) % 1;
                  return (
                    <circle
                      key={j}
                      cx={x}
                      cy={yPost - T / 2 + (T + 50) * u}
                      r={r * 0.9}
                      fill={NA}
                      stroke={VIZ.surface}
                      strokeWidth={1.2 * lw}
                    />
                  );
                })}
            </g>
          );
        })}
        <Txt x={left - 30} y={H - 18} anchor="start" size={0.85} weight={650}>
          Nervecelle 2
        </Txt>
        <Txt x={right + 30} y={H - 18} anchor="end" size={0.95} weight={700} color={vPost >= V_THRESHOLD ? NA : undefined}>
          {`${fmt(vPost, 0)} mV`}
        </Txt>
        {/* Navn på proteinene */}
        <Txt x={CA_X[0]!} y={yPre + T + 18 * f} size={0.75} weight={650} color={CA}>
          Ca²⁺-kanal
        </Txt>
        {!narrow && (
          <Txt x={(RE_X[0]! + RE_X[1]!) / 2} y={yPre + T + 18 * f} size={0.75} weight={650} muted>
            {inhibitor ? 'Reopptak (blokkert)' : 'Reopptak'}
          </Txt>
        )}
        <Txt x={REC_X[3]! + (narrow ? 0 : 40)} y={yPost + T + 22 * f} size={0.75} weight={650} muted>
          {blocker ? 'Reseptorer (blokkert)' : 'Reseptorer'}
        </Txt>
      </Figure>
    </div>
  );
}

/* ====================================================================== */
/* Grafer                                                                   */
/* ====================================================================== */

function SynapsePlots({ run, t }: { run: SynapseRun; t: number }) {
  const [ref, f] = useContainerTextScale<HTMLDivElement>();
  const H1 = Math.round(170 + 120 * (f - 1));
  const H2 = Math.round(190 + 130 * (f - 1));
  const H3 = Math.round(280 + 200 * (f - 1));
  const data = useMemo(() => {
    const pre: [number, number][] = [];
    const nt: [number, number][] = [];
    const rec: [number, number][] = [];
    const post: [number, number][] = [];
    for (let s = 0; s <= SYNAPSE_T_MAX + 1e-9; s += 0.05) {
      pre.push([s, run.pre(s)]);
      nt.push([s, run.nt(s)]);
      rec.push([s, run.receptors(s) * 2]);
      post.push([s, run.post(s)]);
    }
    return { pre, nt, rec, post };
  }, [run]);
  const ntMax = 2;
  const x = { min: 0, max: SYNAPSE_T_MAX, label: 'Tid (ms)', ticks: [0, 6, 12, 18, 24, 30, 36] };
  const head = 22 * f;
  return (
    <div ref={ref}>
      <Figure
        viewBox={`0 0 800 ${H1 + H2 + H3 + 3 * head}`}
        maxHeight={f > 1.3 ? 1800 : Math.round((H1 + H2 + H3 + 3 * head) * 1.15)}
        label={`Nervecelle 1, signalstoffet i spalten og nervecelle 2 over ${SYNAPSE_T_MAX} ms. ${run.postSpikes.length} aksjonspotensialer i nervecelle 2.`}
      >
        <Txt x={20} y={head - 4} anchor="start" weight={650} size={0.9}>
          Nervecelle 1 (endeknappen)
        </Txt>
        <g transform={`translate(0 ${head})`}>
          <Plot x={x} y={{ min: -90, max: 40, label: 'mV', ticks: [-80, -40, 0, 40] }} width={800} height={H1}>
            {({ sx, sy, y0, y1 }) => (
              <g>
                <path d={linePath(data.pre, sx, sy)} fill="none" stroke={BIO.dna} strokeWidth={2.4} />
                <line x1={sx(t)} x2={sx(t)} y1={y0} y2={y1} className="viz-guide" />
              </g>
            )}
          </Plot>
        </g>
        <Txt x={20} y={H1 + 2 * head - 4} anchor="start" weight={650} size={0.9}>
          Signalstoff i synapsespalten
        </Txt>
        <g transform={`translate(0 ${H1 + 2 * head})`}>
          <Plot x={x} y={{ min: 0, max: ntMax, label: 'Mengde', ticks: [0, 1, 2] }} width={800} height={H2}>
            {({ sx, sy, y0, y1 }) => (
              <g>
                <path d={linePath(data.rec, sx, sy)} fill="none" stroke={BIO.serie[0]} strokeWidth={2.2} strokeDasharray="7 5" />
                <path
                  d={linePath(
                    data.nt.map(([a, b]) => [a, Math.min(ntMax, b)] as [number, number]),
                    sx,
                    sy,
                  )}
                  fill="none"
                  stroke={NT}
                  strokeWidth={3}
                />
                <line x1={sx(t)} x2={sx(t)} y1={y0} y2={y1} className="viz-guide" />
                <circle cx={sx(t)} cy={sy(Math.min(ntMax, run.nt(t)))} r={6} fill={NT} stroke={VIZ.surface} strokeWidth={2} />
              </g>
            )}
          </Plot>
        </g>
        <Txt x={20} y={H1 + H2 + 3 * head - 4} anchor="start" weight={650} size={0.9}>
          Nervecelle 2
        </Txt>
        <g transform={`translate(0 ${H1 + H2 + 3 * head})`}>
          <Plot x={x} y={{ min: -80, max: 40, label: 'mV', ticks: [-80, -60, -40, -20, 0, 20, 40] }} width={800} height={H3}>
            {({ sx, sy, x0, x1, y0, y1 }) => (
              <g>
                <line
                  x1={x0}
                  x2={x1}
                  y1={sy(V_THRESHOLD)}
                  y2={sy(V_THRESHOLD)}
                  stroke={VIZ.muted}
                  strokeWidth={1.6}
                  strokeDasharray="7 6"
                />
                <line x1={x0} x2={x1} y1={sy(V_REST)} y2={sy(V_REST)} stroke={VIZ.muted} strokeWidth={1.2} strokeDasharray="3 5" />
                <Txt x={x1 - 6} y={sy(V_THRESHOLD) - 8} anchor="end" size={0.8} muted>
                  terskel
                </Txt>
                <path d={linePath(data.post, sx, sy)} fill="none" stroke={BIO.dna} strokeWidth={3.2} />
                <line x1={sx(t)} x2={sx(t)} y1={y0} y2={y1} className="viz-guide" />
                <circle cx={sx(t)} cy={sy(run.post(t))} r={7} fill={BIO.dna} stroke={VIZ.surface} strokeWidth={2.5} />
              </g>
            )}
          </Plot>
        </g>
      </Figure>
    </div>
  );
}

/* ====================================================================== */
/* Forklaring                                                               */
/* ====================================================================== */

function explanation(run: SynapseRun, n: number, inhibitor: boolean, blocker: boolean, ntPeak: number): ReactNode {
  const fired = run.postSpikes.length;
  const chain = (
    <p>
      <strong>Slik virker en kjemisk synapse.</strong> Når aksjonspotensialet når endeknappen, åpner kalsiumkanaler seg, og Ca²⁺ strømmer
      inn. Det får vesikler med signalstoff (nevrotransmitter) til å smelte sammen med membranen og tømme seg ut i synapsespalten
      (eksocytose). Signalstoffet diffunderer over spalten og binder seg til reseptorer på neste celle. Signalstoffet går ikke inn i cella:
      reseptorene er ionekanaler som åpner seg, så Na⁺ strømmer inn og cella depolariseres. Til slutt fjernes signalstoffet ved reopptak til
      endeknappen eller ved at enzymer bryter det ned, og signalet stopper.
    </p>
  );
  let effect: ReactNode;
  if (blocker)
    effect = (
      <p>
        <strong>Reseptorblokker.</strong> Et stoff som ligner signalstoffet, sitter i {fmtPct(RECEPTOR_BLOCK)} av reseptorene uten å åpne
        dem. Signalstoffet frigjøres som før (topp {fmt(ntPeak, 2)}), men finner få ledige reseptorer, så nervecelle 2 blir knapt
        depolarisert ({fmt(run.epspPeak, 0)} mV) {fired ? '' : 'og fyrer ikke'}. Pilgiften curare blokkerer reseptorene for acetylkolin
        mellom nerve og muskel, og gir lammelser.
        {inhibitor
          ? ' Reopptakshemmeren gjør at signalstoffet blir lenger i spalten, men det hjelper lite når reseptorene er blokkert.'
          : ''}
      </p>
    );
  else if (inhibitor)
    effect = (
      <p>
        <strong>Reopptakshemmer.</strong> {fmtPct(REUPTAKE_BLOCK)} av transportproteinene for reopptak er blokkert, så signalstoffet blir
        liggende lenger i spalten (topp {fmt(ntPeak, 2)}) og fortsetter å aktivere reseptorene. Nervecelle 2 blir depolarisert mer og
        lenger, og {fired ? `fyrer ${fired} ${fired === 1 ? 'aksjonspotensial' : 'aksjonspotensialer'}` : 'kommer nærmere terskelen'}.
        Legemidler mot depresjon (SSRI) hemmer reopptaket av serotonin, og kokain hemmer reopptaket av dopamin.
      </p>
    );
  else
    effect = (
      <p>
        {n === 1 ? 'Én nerveimpuls' : `${n} nerveimpulser`} med {IMPULSE_INTERVAL} ms mellomrom gir{' '}
        {fired ? (
          <>
            nok signalstoff til at nervecelle 2 når terskelen og fyrer {fired === 1 ? 'et aksjonspotensial' : `${fired} aksjonspotensialer`}
            . Depolariseringene fra hver impuls legges sammen (summering) fordi den neste kommer før den forrige har dødd ut.
          </>
        ) : (
          <>
            en depolarisering i nervecelle 2 til {fmt(run.epspPeak, 0)} mV, under terskelen −55 mV, så det blir ikke noe aksjonspotensial.
            Øk antall impulser: depolariseringene legges sammen (summering).
          </>
        )}{' '}
        Slik kan nervesystemet regulere hvor sterkt et signal blir sendt videre.
      </p>
    );
  return (
    <>
      {effect}
      {chain}
    </>
  );
}
