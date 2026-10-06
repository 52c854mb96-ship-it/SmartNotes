import { memo, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  Controls,
  Explain,
  Figure,
  Formula,
  FormulaLine,
  G_EARTH,
  Legend,
  PlayControls,
  Plot,
  Readout,
  Readouts,
  Segmented,
  Slider,
  Sub,
  TSub,
  Toggle,
  Toolbar,
  Txt,
  VIZ,
  VizLayout,
  fmt,
  linePath,
  sample,
  useSimClock,
  useTextScale,
} from '../../kit';
import { Dimension, ForceArrow, Gran, Himmel, Landskap, SCENE, Terreng, Underlag, ValueTag, alpha, useStrokeScale } from '../../kit/scene';
import { Aker, HalfpipeDetaljer, SKATER_TOP, SLEDDER_TOP, Skater, halfpipeProfile } from './energibevaring-deler';
import {
  SCENE_W,
  barHeight,
  facing,
  framePoint,
  riderFrame,
  boxesOverlap,
  SPEED_ARROW_M,
  sceneLayout,
  segmentHitsBox,
  speedArrow,
  speedLabelPlace,
  textBox,
  textWidth,
  type Box,
  type SceneLayout,
} from './energibevaring-scene';
import {
  humpOutcome,
  liftsOffAtHump,
  makeTrack,
  niceCeil,
  sampleAt,
  simulateTrack,
  type HumpOutcome,
  type Track,
  type TrackKind,
  type TrackSample,
  type TrackSim,
} from './model';
import { useNarrow } from './useNarrow';

/** Friksjon og luftmotstand når de er slått på: R = 0,06 · mg (regnet som konstant langs banen). */
const MU = 0.06;
const T_SIM = 45;

const KINDS: { value: TrackKind; label: string }[] = [
  { value: 'rampe', label: 'Skater i halfpipe' },
  { value: 'bakke', label: 'Akebakke med kul' },
];

const C_EP = VIZ.gravity;
const C_EK = VIZ.velocity;
const C_E = VIZ.ink;
const C_HEAT = VIZ.friction;

/** Ord som skiller de to situasjonene i teksten. */
const WORDS: Record<TrackKind, { Subj: string; subj: string; place: string; heatIn: string }> = {
  rampe: { Subj: 'Skateren', subj: 'skateren', place: 'rampa', heatIn: 'hjulene, lagrene, rampa og lufta' },
  bakke: { Subj: 'Akebrettet', subj: 'akebrettet', place: 'bakken', heatIn: 'brettet, snøen og lufta' },
};

export default function Energibevaring() {
  const [kind, setKind] = useState<TrackKind>('rampe');
  const [h0, setH0] = useState(4);
  const [m, setM] = useState(50);
  const [friction, setFriction] = useState(false);
  const { ref, narrow } = useNarrow();

  const track = useMemo(() => makeTrack(kind), [kind]);
  const sim = useMemo(() => simulateTrack({ track, h0, m, mu: friction ? MU : 0, tMax: T_SIM }), [track, h0, m, friction]);
  const outcome = useMemo(() => humpOutcome(track, sim, m), [track, sim, m]);
  const tMax = sim.stopTime !== null ? Math.min(T_SIM, sim.stopTime + 1) : T_SIM;
  const clock = useSimClock({ tMax });
  const { setT, reset } = clock;
  // Start på vei ned, så både E_p og E_k synes før du trykker på «Spill av».
  const [startT] = useState(() => sim.samples.find((p) => p.h <= 0.55 * h0)?.t ?? 0);
  useEffect(() => setT(startT), [setT, startT]);

  const t = Math.min(clock.t, tMax);
  const p = sampleAt(sim, t);
  const stopped = sim.stopTime !== null && t >= sim.stopTime;
  const L = useMemo(() => sceneLayout(kind, narrow), [kind, narrow]);

  const change = (fn: () => void) => {
    fn();
    reset();
  };

  return (
    <VizLayout>
      <Controls>
        <Slider
          label={
            <>
              Starthøyde h<Sub>0</Sub>
            </>
          }
          ariaLabel="Starthøyde"
          value={h0}
          onChange={(v) => change(() => setH0(v))}
          min={0.5}
          max={5.5}
          step={0.1}
          unit="m"
          decimals={1}
        />
        <Slider label="Masse m" value={m} onChange={setM} min={20} max={100} step={1} unit="kg" decimals={0} />
      </Controls>
      <Toolbar>
        <Segmented label="Velg situasjon" options={KINDS} value={kind} onChange={(k) => change(() => setKind(k))} />
        <Toggle label="Med friksjon (R = 6 % av G)" checked={friction} onChange={(on) => change(() => setFriction(on))} />
      </Toolbar>
      <Toolbar>
        <PlayControls clock={clock} decimals={1} />
      </Toolbar>

      <div ref={ref}>
        <Figure viewBox={`0 0 ${SCENE_W} ${L.H}`} label={sceneLabel(kind, h0, m, friction, p)} maxHeight={narrow ? 600 : 440}>
          <Scene L={L} track={track} sim={sim} p={p} h0={h0} m={m} friction={friction} stopped={stopped} />
        </Figure>
      </div>
      <Legend
        items={[
          { color: C_EP, label: <LegendText text="Potensiell energi Ep = mgh" /> },
          { color: C_EK, label: <LegendText text="Kinetisk energi Ek = ½mv²" /> },
          { color: C_E, label: <LegendText text="Mekanisk energi E = Ep + Ek" /> },
          {
            color: C_E,
            dashed: true,
            label: friction ? (
              'Så høyt energien rekker nå'
            ) : (
              <span>
                Så høyt energien rekker (h<Sub>0</Sub>)
              </span>
            ),
          },
          ...(friction
            ? [
                {
                  color: C_HEAT,
                  label: (
                    <span>
                      Blitt til termisk energi, −W<Sub>R</Sub>
                    </span>
                  ),
                },
              ]
            : []),
        ]}
      />

      <Figure viewBox={`0 0 800 ${narrow ? 470 : 330}`} label={`Energi som funksjon av vannrett posisjon ${kind === 'rampe' ? 'i halfpipen' : 'i akebakken'}.`} maxHeight={narrow ? 520 : 370}>
        <EnergyPlot track={track} sim={sim} p={p} m={m} height={narrow ? 470 : 330} />
      </Figure>

      <Readouts>
        <Readout
          label={
            <>
              Potensiell E<Sub>p</Sub>
            </>
          }
          value={fmt(p.Ep, 0)}
          unit="J"
          tone={C_EP}
        />
        <Readout
          label={
            <>
              Kinetisk E<Sub>k</Sub>
            </>
          }
          value={fmt(p.Ek, 0)}
          unit="J"
          tone={C_EK}
        />
        <Readout label="Mekanisk E" value={fmt(p.E, 0)} unit="J" />
        {friction ? (
          <Readout label="Termisk energi" value={fmt(p.heat, 0)} unit="J" tone={C_HEAT} />
        ) : (
          <Readout label="Fart v" value={fmt(Math.abs(p.v), 1)} unit="m/s" tone={C_EK} />
        )}
      </Readouts>

      <Formula label="Energien akkurat nå">
        <FormulaLine>
          E<Sub>p</Sub> = mgh = {fmt(m, 0)} kg · 9,81 m/s² · {fmt(p.h, 2)} m = {fmt(p.Ep, 0)} J
        </FormulaLine>
        <FormulaLine>
          E<Sub>k</Sub> = ½mv² = ½ · {fmt(m, 0)} kg · ({fmt(Math.abs(p.v), 2)} m/s)² = {fmt(p.Ek, 0)} J
        </FormulaLine>
        <FormulaLine>
          E = E<Sub>p</Sub> + E<Sub>k</Sub> = {fmt(p.E, 0)} J
        </FormulaLine>
        {friction && (
          <>
            <FormulaLine>
              W<Sub>R</Sub> = −R · s = −0,06 · {fmt(m, 0)} kg · 9,81 m/s² · {fmt(p.d, 1)} m = −{fmt(p.heat, 0)} J
            </FormulaLine>
            <FormulaLine>
              E = E<Sub>0</Sub> + W<Sub>R</Sub> = {fmt(sim.E0, 0)} J − {fmt(p.heat, 0)} J = {fmt(sim.E0 - p.heat, 0)} J
            </FormulaLine>
          </>
        )}
      </Formula>

      <Explain>
        <ExplainText kind={kind} track={track} sim={sim} p={p} t={t} h0={h0} friction={friction} stopped={stopped} outcome={outcome} m={m} />
      </Explain>
    </VizLayout>
  );
}

/** «Ep» og «Ek» med senket skrift i fargeforklaringen. */
function LegendText({ text }: { text: string }) {
  const parts = text.split(/(E[pk])/);
  return (
    <span>
      {parts.map((part, i) =>
        part === 'Ep' || part === 'Ek' ? (
          <span key={i}>
            E<Sub>{part[1]}</Sub>
          </span>
        ) : (
          <span key={i}>{part}</span>
        ),
      )}
    </span>
  );
}

function sceneLabel(kind: TrackKind, h0: number, m: number, friction: boolean, p: TrackSample): string {
  const where =
    kind === 'rampe'
      ? `Skater på skateboard i en halfpipe av tre som er 6 m høy og 12 m bred, startet i ro ${fmt(h0, 1)} m over bunnen`
      : `Akebrett i en akebakke med en kul på 3 m i midten og en motbakke på den andre siden, startet i ro ${fmt(h0, 1)} m over bunnen av dalen`;
  return `${where}. Masse ${fmt(m, 0)} kg${friction ? ', med friksjon' : ', uten friksjon'}. Nå ${fmt(p.h, 1)} m over nullnivået med farten ${fmt(Math.abs(p.v), 1)} m/s. Energistolper for potensiell, kinetisk og mekanisk energi${friction ? ' og termisk energi' : ''}.`;
}

/* ---------- Scenen ---------- */

/** Bakgrunnen bak banen: himmel, landskap og bakken. Statisk, så den tegnes bare når banen eller bredden endres. */
const Bakgrunn = memo(function Bakgrunn({ L }: { L: SceneLayout }) {
  const W = L.W;
  if (L.kind === 'rampe')
    return (
      <g>
        <Himmel w={W} h={L.horizon + 6} sol={{ x: L.X(9.6), y: 0.52 * L.Y(6), r: 15 }} skyer={2} seed={4} />
        <Landskap x={0} y={L.horizon} w={W} h={2.2 * L.ppm} type="by" seed={2} />
        <Underlag x1={0} x2={W} y={L.groundY} depth={L.sceneH - L.groundY} type="betong" horisont={L.horizon} seed={3} />
      </g>
    );
  return (
    <g>
      <Himmel w={W} h={L.horizon + 6} sol={{ x: L.X(10.8), y: 0.55 * L.Y(6), r: 15 }} skyer={2} seed={8} />
      <Landskap x={0} y={L.horizon} w={W} h={Math.min(L.horizon - L.Y(6) + 0.6 * L.ppm, 4.2 * L.ppm)} type="skog" seed={5} />
      <Underlag x1={0} x2={W} y={L.sceneH - 2} depth={2} type="sno" horisont={L.horizon} seed={6} />
    </g>
  );
});

/** Banen selv: halfpipen med bindingsverk og rekkverk, eller akebakken i snø med graner på toppene. */
const Bane = memo(function Bane({ L, track }: { L: SceneLayout; track: Track }) {
  const { X, Y } = L;
  if (L.kind === 'rampe') {
    const pts = halfpipeProfile(track, L).map(([x, h]): [number, number] => [X(x), Y(h)]);
    return (
      <g>
        <Terreng points={pts} bottom={L.groundY} type="tregulv" seed={3} title="Halfpipe av tre" />
        <HalfpipeDetaljer track={track} L={L} />
      </g>
    );
  }
  const right = L.xLeft + L.W / L.ppm + 0.5;
  const pts: [number, number][] = [[X(L.xLeft - 0.5), Y(track.top)]];
  for (let x = track.xMin; x <= track.xMax + 1e-9; x += 0.1) pts.push([X(x), Y(track.height(Math.min(x, track.xMax)))]);
  pts.push([X(right), Y(track.top)]);
  return (
    <g>
      {/* Graner på toppene, innenfor bildet */}
      <Gran x={X(L.xLeft + 0.3)} y={Y(track.top) + 2} size={2.4 * L.ppm} sno seed={3} />
      <Gran x={X(Math.min(16.75, L.xRight - 0.3))} y={Y(track.top) + 2} size={3.2 * L.ppm} sno seed={4} />
      <Terreng points={pts} bottom={L.sceneH + 2} type="sno" seed={7} title="Akebakke i snø" />
    </g>
  );
});

function Scene({
  L,
  track,
  sim,
  p,
  h0,
  m,
  friction,
  stopped,
}: {
  L: SceneLayout;
  track: Track;
  sim: TrackSim;
  p: TrackSample;
  h0: number;
  m: number;
  friction: boolean;
  stopped: boolean;
}) {
  const f = useTextScale();
  const ss = useStrokeScale();
  const { X, Y, ppm, kind } = L;
  const right = L.freeRight;
  const fr = riderFrame(track, L, p.x);
  const slope = track.slope(p.x);
  const dir = kind === 'rampe' ? facing(p.v, slope) : 1;
  const speed = stopped ? 0 : Math.abs(p.v);
  // Pila tegnes når den er lang nok til å synes; ellers står farten på et skilt over hodet (v = 0 i ro)
  const moving = speed * SPEED_ARROW_M * ppm >= 8;
  const sv = p.v >= 0 ? 1 : -1;

  // Så høyt energien rekker: h₀ uten friksjon, E/(mg) med friksjon
  const reach = p.E / (m * G_EARTH);
  const yH0 = Y(h0);
  const yReach = Y(reach);

  // Fartspila langs banen, foran kroppen, fra hoftehøyde
  const arrow = speedArrow(fr, kind, ppm, stopped ? 0 : p.v);
  const a0 = { x: arrow.x1, y: arrow.y1 };
  const tip = { x: arrow.x2, y: arrow.y2 };
  const vText = `v = ${fmt(speed, 1)} m/s`;
  const vLabel = speedLabelPlace({ x1: a0.x, y1: a0.y, x2: tip.x, y2: tip.y, text: vText, f, right, top: 0, bottom: L.sceneH - 8 });
  const head = framePoint(fr, 0, (kind === 'rampe' ? SKATER_TOP : SLEDDER_TOP) * ppm);
  const tagText = speed > 0.05 ? vText : 'v = 0';
  const tagW = textWidth(tagText, 0.85, f) + 20 * f;
  const tagX = Math.min(right - tagW / 2, Math.max(6 + tagW / 2, head.x));

  // Etikettene plasseres der de ikke kolliderer med personen, fartspila eller hverandre: første ledige av noen
  // faste kandidater, ellers den første.
  const vW = textWidth(vText, 0.9, f);
  const obstacles: Box[] = [
    {
      x0: Math.min(fr.x, head.x) - 0.7 * ppm,
      x1: Math.max(fr.x, head.x) + 0.7 * ppm,
      y0: Math.min(fr.y, head.y) - 0.35 * ppm,
      y1: Math.max(fr.y, head.y) + 4,
    },
    moving ? textBox(vLabel.x, vLabel.y, vW, vLabel.anchor, 0.9, f) : { x0: tagX - tagW / 2, x1: tagX + tagW / 2, y0: head.y - 36 * f, y1: head.y - 4 },
  ];
  const arrowHits = (b: Box) => moving && segmentHitsBox(a0, tip, b, 6);
  const free = (b: Box, extra: Box[] = []) => b.x0 >= 4 && b.x1 <= right + 1 && b.y0 >= 0 && ![...obstacles, ...extra].some((o) => boxesOverlap(b, o)) && !arrowHits(b);
  const pick = <T extends { box: Box }>(cands: T[], extra: Box[] = []): T => cands.find((c) => free(c.box, extra)) ?? cands[0]!;
  const pickFree = <T extends { box: Box }>(cands: T[], extra: Box[] = []): T | undefined => cands.find((c) => free(c.box, extra));

  // h₀ over linja: midt i dalen, eller et annet sted langs linja
  const center = kind === 'rampe' ? 6 : 4.5;
  const h0W = textWidth(`h₀ = ${fmt(h0, 1)} m`, 0.92, f);
  const h0y = yH0 - 8 * f;
  const h0Label = pick(
    (kind === 'rampe' ? [6, 3.2, 8.8, 1.6, 10.4] : [4.5, 12.5, 2.4, 8]).map((x) => {
      const cx = Math.min(right - h0W / 2, Math.max(6 + h0W / 2, X(x)));
      return { x: cx, box: textBox(cx, h0y, h0W, 'middle', 0.92, f) };
    }),
  );
  const h0x = h0Label.x;

  // Høyden h fra nullnivået opp til brettet: etiketten på motsatt side av fartspila (i ro: på oppoverbakkesiden),
  // midt på mållinja eller nede ved nullnivået
  const showH = p.h > 0.3;
  const hText = `h = ${fmt(p.h, 1)} m`;
  const hW = textWidth(hText, 0.85, f);
  const prefRight = moving ? sv < 0 : slope > 0;
  const midY = (fr.y + Y(0)) / 2;
  const lowY = Math.max(midY, Y(0) - 14 * f);
  // Får ikke etiketten for h plass noe sted, tegnes mållinja uten tall (høyden står i utregningen under).
  const hLabel = pickFree(
    [
      [prefRight, midY],
      [!prefRight, midY],
      [prefRight, lowY],
      [!prefRight, lowY],
    ].map(([r, y]) => {
      const rightSide = r as boolean;
      const my = y as number;
      const x = fr.x + (rightSide ? 8 : -8) * f;
      return { right: rightSide, my, box: textBox(x, my + 6 * f, hW, rightSide ? 'start' : 'end', 0.85, f) };
    }),
    [h0Label.box],
  );
  const labelRight = hLabel ? hLabel.right : prefRight;
  const hy0 = labelRight ? fr.y : Y(0);
  const hy1 = labelRight ? Y(0) : fr.y;
  // Dimension flytter etiketten langs linja fra punkt 1 mot punkt 2
  const hOffset = hLabel ? (labelRight ? 1 : -1) * (hLabel.my - midY) : 0;
  const hBox = showH && hLabel ? hLabel.box : null;
  const placed = [h0Label.box, ...(hBox ? [hBox] : [])];

  // Kulen i akebakken: over toppen, ved siden av toppen eller inne i snøen
  let hump: { x: number; y: number; anchor: 'middle' | 'start' | 'end'; box: Box } | null = null;
  if (track.hump) {
    const hx = X(track.hump.x);
    const ht = Y(track.hump.h);
    const kw = textWidth(`kul ${fmt(track.hump.h, 1)} m`, 0.85, f);
    // Linjene for h₀ og (med friksjon) så høyt energien rekker
    const lines: Box[] = [yH0, ...(friction ? [yReach] : [])].map((y) => ({ x0: 0, x1: right, y0: y - 2, y1: y + 2 }));
    const cands = [
      { x: hx, y: ht - 12 * f, anchor: 'middle' as const },
      { x: hx - 0.9 * ppm, y: ht - 2 * f, anchor: 'end' as const },
      { x: hx + 0.9 * ppm, y: ht - 2 * f, anchor: 'start' as const },
      { x: hx, y: ht + 28 * f, anchor: 'middle' as const },
    ].map((c) => ({ ...c, box: textBox(c.x, c.y, kw, c.anchor, 0.85, f) }));
    hump = pick(cands, [...placed, ...lines]);
    placed.push(hump.box);
  }

  // Nullnivået: i halfpipen midt under bunnen (der er det aldri noen), i akebakken nede til venstre eller under den
  // andre dalen
  const zeroText = 'nullnivå, h = 0';
  const zeroW = textWidth(zeroText, 0.85, f);
  const zeroY = Y(0) + 22 * f;
  const zeroX = pick(
    (kind === 'rampe' ? [X(center)] : [10 + zeroW / 2, X(12.5), X(8.6)]).map((x) => {
      const cx = Math.min(right - zeroW / 2, Math.max(6 + zeroW / 2, x));
      return { x: cx, box: textBox(cx, zeroY, zeroW, 'middle', 0.85, f) };
    }),
    placed,
  ).x;

  return (
    <g>
      <Bakgrunn L={L} />
      {/* Så høyt energien rekker. Linjene tegnes før banen, så de bare synes i lufta over den. */}
      {friction && reach < h0 - 0.005 && (
        <rect x={0} y={yH0} width={right} height={Math.max(0, yReach - yH0)} fill={alpha(C_HEAT, 0.22)} />
      )}
      <line x1={0} x2={right} y1={yH0} y2={yH0} stroke={VIZ.surface} strokeWidth={4 * ss} opacity={0.55} />
      <line
        x1={0}
        x2={right}
        y1={yH0}
        y2={yH0}
        stroke={friction ? C_HEAT : C_E}
        strokeWidth={(friction ? 1.4 : 1.8) * ss}
        strokeDasharray={`${7 * ss} ${5 * ss}`}
        opacity={friction ? 0.85 : 1}
      />
      {friction && (
        <>
          <line x1={0} x2={right} y1={yReach} y2={yReach} stroke={VIZ.surface} strokeWidth={4 * ss} opacity={0.55} />
          <line x1={0} x2={right} y1={yReach} y2={yReach} stroke={C_E} strokeWidth={1.8 * ss} strokeDasharray={`${7 * ss} ${5 * ss}`} />
        </>
      )}
      <Bane L={L} track={track} />

      {/* Nullnivået gjennom bunnen av banen */}
      <line x1={0} x2={right} y1={Y(0)} y2={Y(0)} stroke={VIZ.ink} strokeWidth={1.2 * ss} strokeDasharray="3 5" opacity={0.5} />

      {/* Høyden over nullnivået: E_p = mgh */}
      {showH && <Dimension x1={fr.x} y1={hy0} x2={fr.x} y2={hy1} label={hLabel ? hText : undefined} labelSize={0.85} labelOffset={hOffset} color={C_EP} />}

      {kind === 'rampe' ? <Skater fr={fr} ppm={ppm} dir={dir} d={p.d} /> : <Aker fr={fr} ppm={ppm} />}

      {moving ? (
        <>
          <ForceArrow x1={a0.x} y1={a0.y} x2={tip.x} y2={tip.y} color={C_EK} width={5} minLength={4} />
          <Txt x={vLabel.x} y={vLabel.y} anchor={vLabel.anchor} color={C_EK} weight={720} size={0.9}>
            {vText}
          </Txt>
        </>
      ) : (
        <ValueTag x={tagX} y={head.y - 20 * f} text={tagText} color={C_EK} size={0.85} pointer={6} />
      )}

      <Txt x={h0x} y={h0y} size={0.92} weight={720} color={friction ? C_HEAT : C_E}>
        h<TSub>0</TSub> = {fmt(h0, 1)} m
      </Txt>
      <Txt x={zeroX} y={zeroY} size={0.85} weight={600} muted>
        {zeroText}
      </Txt>
      {track.hump && hump && (
        <Txt x={hump.x} y={hump.y} anchor={hump.anchor} size={0.85} weight={650} muted>
          kul {fmt(track.hump.h, 1)} m
        </Txt>
      )}

      <EnergyCard L={L} p={p} sim={sim} m={m} friction={friction} />
    </g>
  );
}

/* ---------- Energistolper ---------- */

function EnergyCard({ L, p, sim, m, friction }: { L: SceneLayout; p: TrackSample; sim: TrackSim; m: number; friction: boolean }) {
  const f = useTextScale();
  const ss = useStrokeScale();
  const { bars: B } = L;
  const hgt = (E: number) => barHeight(B, E, m, G_EARTH);
  const items: { key: string; label: ReactNode; value: number; color: string; stack?: boolean }[] = [
    {
      key: 'p',
      label: (
        <>
          E<TSub>p</TSub>
        </>
      ),
      value: p.Ep,
      color: C_EP,
    },
    {
      key: 'k',
      label: (
        <>
          E<TSub>k</TSub>
        </>
      ),
      value: p.Ek,
      color: C_EK,
    },
    { key: 'e', label: 'E', value: p.E, color: C_E, stack: true },
    ...(friction
      ? [
          {
            key: 'r',
            label: (
              <>
                −W<TSub>R</TSub>
              </>
            ),
            value: p.heat,
            color: C_HEAT,
          },
        ]
      : []),
  ];
  const labelSpace = 30 * f;
  const x1 = B.x1 - labelSpace;
  const slot = (x1 - B.x0) / items.length;
  const bw = B.beside ? Math.min(40, slot * 0.6) : Math.min(92, slot * 0.5);
  const yE0 = B.base - hgt(sim.E0);
  const c = B.card;
  return (
    <g>
      <rect x={c.x} y={c.y} width={c.w} height={c.h} rx={10} fill={VIZ.surface} opacity={0.93} />
      <rect x={c.x} y={c.y} width={c.w} height={c.h} rx={10} fill="none" stroke={SCENE.outline} strokeWidth={1 * ss} opacity={0.35} />
      <Txt x={c.x + 12} y={c.y + 20 * f} anchor="start" size={0.8} weight={700} muted halo={false}>
        Energi (J)
      </Txt>
      <line x1={B.x0 - 8} x2={x1 + 4} y1={B.base} y2={B.base} stroke={VIZ.ink} strokeWidth={1.4 * ss} />
      {/* E₀ under stolpene og tallene, så tallene kan leses også når de står på linja */}
      {sim.E0 > 0 && (
        <line x1={B.x0 - 8} x2={x1 + 4} y1={yE0} y2={yE0} stroke={friction ? C_HEAT : C_E} strokeWidth={1.4 * ss} strokeDasharray={`${6 * ss} ${4 * ss}`} />
      )}
      {items.map((b, i) => {
        const cx = B.x0 + slot * (i + 0.5);
        const top = B.base - hgt(b.value);
        const yp = B.base - hgt(p.Ep);
        return (
          <g key={b.key}>
            {b.stack ? (
              <>
                <rect x={cx - bw / 2} y={yp} width={bw} height={Math.max(0, B.base - yp)} fill={C_EP} opacity={0.9} />
                <rect x={cx - bw / 2} y={top} width={bw} height={Math.max(0, yp - top)} fill={C_EK} opacity={0.9} />
                <rect x={cx - bw / 2} y={top} width={bw} height={Math.max(0, B.base - top)} fill="none" stroke={C_E} strokeWidth={2 * ss} />
              </>
            ) : (
              <rect x={cx - bw / 2} y={top} width={bw} height={Math.max(0, B.base - top)} fill={b.color} opacity={0.9} />
            )}
            <Txt x={cx} y={top - 7 * f} size={0.74} weight={680} color={b.color}>
              {fmt(b.value, 0)}
            </Txt>
            <Txt x={cx} y={B.base + 24 * f} size={0.95} weight={720} color={b.color} halo={false}>
              {b.label}
            </Txt>
          </g>
        );
      })}
      {sim.E0 > 0 && (
        <Txt x={x1 + 8} y={yE0 + 5 * f} anchor="start" size={0.8} weight={700} halo={false} color={friction ? C_HEAT : C_E}>
          E<TSub>0</TSub>
        </Txt>
      )}
    </g>
  );
}

/* ---------- Energi som funksjon av posisjon ---------- */

function EnergyPlot({ track, sim, p, m, height }: { track: Track; sim: TrackSim; p: TrackSample; m: number; height: number }) {
  const f = useTextScale();
  const yMax = niceCeil(m * G_EARTH * track.top * 1.02, 4);
  const Ep = (x: number) => m * G_EARTH * track.height(x);
  const pts = useMemo(() => sample((x) => m * G_EARTH * track.height(x), track.xMin, track.xMax, 200), [track, m]);
  const E = p.E;
  const fric = sim.R > 0;
  return (
    <Plot
      x={{ min: track.xMin, max: track.xMax, label: 'Vannrett posisjon x (m)' }}
      y={{ min: 0, max: yMax, label: 'Energi (J)' }}
      width={800}
      height={height}
      margin={{ top: 46 * f, right: 30 * f, bottom: 56 * f, left: 84 * f }}
    >
      {({ sx, sy, x0, x1, y1 }) => {
        // E_k-området: mellom E_p-kurven og E-linja der E_p < E (de delene av banen energien rekker til nå)
        const ekArea =
          pts.map(([x, e], i) => `${i ? 'L' : 'M'}${sx(x).toFixed(1)},${sy(Math.min(e, E)).toFixed(1)}`).join('') +
          `L${sx(track.xMax).toFixed(1)},${sy(E).toFixed(1)}L${sx(track.xMin).toFixed(1)},${sy(E).toFixed(1)}Z`;
        const epArea = `${linePath(pts, sx, sy)}L${sx(track.xMax).toFixed(1)},${sy(0).toFixed(1)}L${sx(track.xMin).toFixed(1)},${sy(0).toFixed(1)}Z`;
        // Etiketten på E-linja: over linja i en dal der kurven ligger godt under, og unna søylen for posisjonen nå
        const eText = fric ? 'E nå' : 'E = E0';
        const eW = textWidth(eText, 0.85, f);
        const free = (cx: number) => {
          const left = cx - eW / 2 - 6;
          const rightX = cx + eW / 2 + 6;
          if (left < x0 || rightX > x1) return false;
          if (Math.abs(sx(p.x) - cx) < eW / 2 + 16) return false;
          for (let px = left; px <= rightX; px += 4) {
            const x = track.xMin + ((px - x0) / (x1 - x0)) * (track.xMax - track.xMin);
            if (sy(Ep(x)) < sy(E) + 4) return false;
          }
          return true;
        };
        const cands = (track.kind === 'rampe' ? [6, 3.6, 8.4] : [4.5, 12.5, 3.2, 13.8]).map(sx);
        const eX = cands.find(free) ?? cands[0]!;
        const barW = 10;
        return (
          <g>
            <Txt x={x0 - 76 * f} y={y1 - 22 * f} anchor="start" size={0.9} muted>
              Fra E<TSub>p</TSub>-kurven opp til E-linja: E<TSub>k</TSub>
            </Txt>
            <path d={epArea} fill={alpha(C_EP, 0.12)} />
            {fric && E < sim.E0 && <rect x={x0} y={sy(sim.E0)} width={x1 - x0} height={Math.max(0, sy(E) - sy(sim.E0))} fill={alpha(C_HEAT, 0.16)} />}
            <path d={ekArea} fill={alpha(C_EK, 0.2)} />
            <path d={linePath(pts, sx, sy)} fill="none" stroke={C_EP} strokeWidth={3} />
            {fric && (
              <>
                <line x1={x0} x2={x1} y1={sy(sim.E0)} y2={sy(sim.E0)} stroke={C_HEAT} strokeWidth={1.5} strokeDasharray="6 6" />
                <Txt x={x1 - 6} y={sy(sim.E0) - 7 * f} anchor="end" size={0.8} weight={700} color={C_HEAT}>
                  E<TSub>0</TSub>
                </Txt>
              </>
            )}
            <line x1={x0} x2={x1} y1={sy(E)} y2={sy(E)} stroke={C_E} strokeWidth={1.8} strokeDasharray={fric ? '7 5' : undefined} />
            <Txt x={eX} y={sy(E) - 8 * f} size={0.85} weight={700}>
              {fric ? (
                'E nå'
              ) : (
                <>
                  E = E<TSub>0</TSub>
                </>
              )}
            </Txt>
            <Txt x={sx(track.xMin) + 10 * f} y={sy(Ep(track.xMin)) - 9 * f} anchor="start" size={0.85} weight={700} color={C_EP}>
              E<TSub>p</TSub> = mgh
            </Txt>
            {/* Søyle i posisjonen: E_p nederst, E_k oppå */}
            <rect x={sx(p.x) - barW / 2} y={sy(p.Ep)} width={barW} height={Math.max(0, sy(0) - sy(p.Ep))} fill={C_EP} />
            <rect x={sx(p.x) - barW / 2} y={sy(p.E)} width={barW} height={Math.max(0, sy(p.Ep) - sy(p.E))} fill={C_EK} />
            <circle cx={sx(p.x)} cy={sy(p.E)} r={6.5} fill={C_E} stroke={VIZ.surface} strokeWidth={2.5} />
            {track.hump && (
              <Txt x={sx(track.hump.x)} y={sy(Ep(track.hump.x)) - 10 * f} size={0.8} weight={650} muted>
                kul
              </Txt>
            )}
          </g>
        );
      }}
    </Plot>
  );
}

/* ---------- Forklaring ---------- */

function ExplainText({
  kind,
  track,
  sim,
  p,
  t,
  h0,
  friction,
  stopped,
  outcome,
  m,
}: {
  kind: TrackKind;
  track: Track;
  sim: TrackSim;
  p: TrackSample;
  t: number;
  h0: number;
  friction: boolean;
  stopped: boolean;
  outcome: HumpOutcome | null;
  m: number;
}) {
  const w = WORDS[kind];
  const speed = Math.abs(p.v);
  // dh/dt = h′(x) · dx/dt, og dx/dt har samme fortegn som v
  const goingDown = track.slope(p.x) * p.v < 0;
  let phase: ReactNode;
  if (stopped)
    phase = (
      <>
        <strong>{w.Subj} har stoppet.</strong> Nå er E<Sub>k</Sub> = 0, og E = E<Sub>p</Sub> = {fmt(p.E, 0)} J er det som er igjen av den
        mekaniske energien.
      </>
    );
  else if (t === 0)
    phase = (
      <>
        <strong>
          {w.Subj} står i ro {fmt(h0, 1)} m over nullnivået.
        </strong>{' '}
        All energien er potensiell: E<Sub>p</Sub> = mgh<Sub>0</Sub> = {fmt(sim.E0, 0)} J. Nullnivået er lagt i bunnen av {w.place}; et annet
        nullnivå ville endret E<Sub>p</Sub>, men ikke endringene i energi.
      </>
    );
  else if (speed < 0.3)
    phase = (
      <>
        <strong>Vendepunkt:</strong> farten er null et øyeblikk, så all den mekaniske energien er potensiell.
        {friction && p.h < h0 - 0.05 ? ' Vendepunktet ligger lavere enn startpunktet, fordi en del av energien er blitt termisk energi.' : ''}
      </>
    );
  else
    phase = goingDown ? (
      <>
        <strong>På vei ned</strong> blir potensiell energi til kinetisk energi, og farten øker (nå {fmt(speed, 1)} m/s).
      </>
    ) : (
      <>
        <strong>På vei opp</strong> blir kinetisk energi til potensiell energi, og farten avtar (nå {fmt(speed, 1)} m/s).
      </>
    );

  const balance = friction ? (
    <>
      Friksjonen og luftmotstanden gjør negativt arbeid, W<Sub>R</Sub> = −R · s = −{fmt(p.heat, 0)} J, så den mekaniske energien har minket
      like mye: ΔE = W<Sub>R</Sub>. Energien forsvinner ikke, men blir termisk energi (varme) i {w.heatIn}.
    </>
  ) : (
    <>
      Bare tyngden gjør arbeid. Normalkraften fra {w.place} står vinkelrett på farten og gjør ikke arbeid, så den mekaniske energien er
      bevart: E = E<Sub>p</Sub> + E<Sub>k</Sub> = {fmt(sim.E0, 0)} J hele tiden.
    </>
  );

  let extra: ReactNode = null;
  if (track.hump && outcome) {
    const hh = fmt(track.hump.h, 1);
    const need = fmt(outcome.need, 0);
    if (outcome.result === 'akkurat')
      extra = (
        <>
          {' '}
          Starthøyden er akkurat like høy som kulen, så i teorien stopper akebrettet akkurat på toppen. Den minste ekstra fart får det over, og i
          simuleringen tipper det over.
        </>
      );
    else if (outcome.result === 'over')
      extra = (
        <>
          {' '}
          Akebrettet kommer over kulen fordi E på toppen ({fmt(outcome.Etop ?? 0, 0)} J) er større enn mg · {hh} m = {need} J.
          {liftsOffAtHump(track, outcome.Etop ?? 0, m) &&
            ' Her følger akebrettet bakken, men i virkeligheten ville du lettet fra kulen og fått et lite hopp: farten er så stor at bakken bøyer av raskere enn du faller.'}
        </>
      );
    else if (friction && sim.E0 > outcome.need)
      extra = (
        <>
          {' '}
          Akebrettet kommer ikke over kulen, selv om E<Sub>0</Sub> = {fmt(sim.E0, 0)} J er mer enn de {need} J som trengs på toppen:
          friksjonen tar for mye på veien.
        </>
      );
    else
      extra = (
        <>
          {' '}
          Akebrettet kommer ikke over kulen: for å komme opp dit måtte E vært minst mg · {hh} m = {need} J, og E kan aldri bli større enn E
          <Sub>0</Sub> = {fmt(sim.E0, 0)} J.
        </>
      );
  } else if (!friction) {
    extra = (
      <>
        {' '}
        Farten er uavhengig av massen, fordi både E<Sub>p</Sub> og E<Sub>k</Sub> er proporsjonale med m.
      </>
    );
  }

  const practical =
    kind === 'rampe' ? (
      friction ? (
        <>
          Det er derfor en skater må «pumpe» i rampa: ved å bøye og strekke beina i takt med rampa gjør hun selv arbeid og erstatter energien
          friksjonen tar. Uten pumping kommer hun litt lavere for hver tur, til hun blir stående i bunnen.
        </>
      ) : (
        <>
          Uten friksjon kommer skateren like høyt hver gang, akkurat opp til h<Sub>0</Sub>. I en ekte rampe er det alltid litt friksjon i hjulene
          og luftmotstand: slå på «Med friksjon» og se hvor energien blir av.
        </>
      )
    ) : friction ? (
      <>
        Det er derfor kulen i en akebakke må være godt lavere enn der du starter: friksjonen mot snøen tar litt energi hele veien, så du kommer
        ikke engang så høyt som du startet.
      </>
    ) : (
      <>
        Det er derfor kulen i en akebakke må være lavere enn der du starter: du kommer aldri høyere enn startpunktet, verken over kulen eller opp
        motbakken på den andre siden.
      </>
    );

  // Ved start holder det med starttilstanden og nullnivået (og eventuelt kulen i midten)
  if (t === 0 && !stopped)
    return (
      <>
        <p>
          {phase}
          {track.hump ? extra : null}
        </p>
        <p>{practical}</p>
      </>
    );
  return (
    <>
      <p>
        {phase} {balance}
        {extra}
      </p>
      <p>{practical}</p>
    </>
  );
}
