import { useEffect, useMemo, useState } from 'react';
import {
  Controls,
  Dot,
  Explain,
  Figure,
  Formula,
  FormulaLine,
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
  useSimClock,
  useTextScale,
} from '../../kit';
import { ForceArrow, Himmel, Kasse, Landskap, Person, Rom, Underlag, ValueTag, type PersonPose } from '../../kit/scene';
import { Garasjeport } from './friksjon-deler';
import { FRICTION_FLOORS, friction, pushRamp, pushRampEnd, pushRampFor, type FrictionFloor } from './model';
import { useNarrow } from './useNarrow';

/** Største dytt (N). Med m ≤ 40 kg og μs ≤ 1 er μs·N ≤ 392 N, så kassen kan alltid dyttes i gang. */
const F_MAX = 400;
const M_MIN = 10;
const M_MAX = 40;
/** Hvor langt kassen får gli under avspillingen (m), og hvor lenge den varer høyst (s). */
const S_MAX = 1.1;
const T_MAX = 7;

/* ---------- Scenen: én fast skala for lengder og én for krefter ---------- */

const W = 800;
const H = 440;
/** Piksler per meter i scenen (personen er 1,75 m, kassen 0,80 m × 0,70 m). */
const PX_PER_M = 110;
/** Piksler per newton for alle kreftene. */
const PX_PER_N = 0.4;
/** Piksler per m/s² for akselerasjonspila (egen skala), og den lengste pila. */
const PX_PER_A = 28;
const A_MAX_PX = 150;
const PERSON = 1.75 * PX_PER_M;
const BOX_W = 0.8 * PX_PER_M;
const BOX_H = 0.7 * PX_PER_M;
/** Gulvet der kassen og personen står, og linja der bakveggen (eller horisonten) møter gulvet. */
const FLOOR = 300;
const BACK = 236;
/** Midten av kassen før den har glidd. */
const BOX_X0 = 345;
/** Hendene på kassen: litt under lokket, under lappen med massen. */
const HAND_DY = 30;

const FLOORS: FrictionFloor[] = ['tregulv', 'betong', 'is'];
const FLOOR_NAME: Record<FrictionFloor, string> = { tregulv: 'Tregulv', betong: 'Betong', is: 'Is' };
/** Hva kassen står på, til teksten: «en trekasse på …». */
const FLOOR_PLACE: Record<FrictionFloor, string> = { tregulv: 'tregulvet i stua', betong: 'betonggulvet i garasjen', is: 'isen på vannet' };

interface State {
  F: number;
  m: number;
  muS: number;
  muK: number;
  moving: boolean;
  floor: FrictionFloor;
}

export default function Friksjon() {
  const [s, setS] = useState<State>({ F: 100, m: 30, ...FRICTION_FLOORS.tregulv, moving: false, floor: 'tregulv' });
  const [showForces, setShowForces] = useState(true);

  // Avspilling: dyttet øker jevnt fra null, og kassen glir til den har kommet S_MAX meter.
  const ramp = useMemo(() => pushRampFor({ m: s.m, muS: s.muS }, F_MAX), [s.m, s.muS]);
  const tEnd = useMemo(() => pushRampEnd({ m: s.m, muS: s.muS, muK: s.muK }, ramp, S_MAX, T_MAX), [s.m, s.muS, s.muK, ramp]);
  const clock = useSimClock({ tMax: tEnd });
  const p = clock.t > 0 ? pushRamp({ m: s.m, muS: s.muS, muK: s.muK }, ramp, clock.t) : null;

  // Avspillingen starter fra null dytt, så «Start på nytt» går tilbake til kassen i ro uten dytt.
  useEffect(() => {
    if (clock.playing) setS((prev) => (prev.F === 0 && !prev.moving ? prev : { ...prev, F: 0, moving: false }));
  }, [clock.playing]);

  const F = p ? p.F : s.F;
  const base = friction({ F, m: s.m, muS: s.muS, muK: s.muK, wasMoving: s.moving });
  const r = p ? { ...base, moving: p.moving, R: p.R, a: p.a } : base;

  // En glidebryter (eller et nytt underlag) stopper avspillingen og tar med seg tilstanden derfra.
  const update = (patch: Partial<State>) => {
    const curF = Math.round(F);
    const curMoving = r.moving;
    clock.reset();
    setS((prev) => {
      const from = { ...prev, F: curF, moving: curMoving };
      const next = { ...from, ...patch };
      // μk ≤ μs: den som flyttes, dytter den andre.
      next.muK = Math.min(next.muK, next.muS);
      return { ...next, moving: friction({ ...next, wasMoving: from.moving }).moving };
    });
  };

  const preset = FRICTION_FLOORS[s.floor];
  const custom = Math.abs(preset.muS - s.muS) > 1e-9 || Math.abs(preset.muK - s.muK) > 1e-9;

  return (
    <VizLayout>
      <Controls>
        <Slider label="Dytt F" value={F} onChange={(v) => update({ F: v })} min={0} max={F_MAX} step={1} unit="N" decimals={0} />
        <Slider label="Masse m" value={s.m} onChange={(m) => update({ m })} min={M_MIN} max={M_MAX} step={1} unit="kg" decimals={0} />
        <Slider
          label={
            <>
              Statisk friksjonstall μ<Sub>s</Sub>
            </>
          }
          ariaLabel="Statisk friksjonstall"
          value={s.muS}
          onChange={(muS) => update({ muS })}
          min={0.1}
          max={1}
          step={0.05}
          decimals={2}
        />
        <Slider
          label={
            <>
              Glidefriksjonstall μ<Sub>k</Sub>
            </>
          }
          ariaLabel="Glidefriksjonstall"
          value={s.muK}
          onChange={(muK) => update({ muK })}
          min={0.05}
          max={1}
          step={0.05}
          decimals={2}
        />
      </Controls>
      <Toolbar>
        <Segmented
          label="Velg underlag"
          options={FLOORS.map((fl) => ({ value: fl, label: FLOOR_NAME[fl] }))}
          value={s.floor}
          onChange={(floor) => update({ floor, ...FRICTION_FLOORS[floor] })}
        />
        <PlayControls clock={clock} decimals={1} />
        <Toggle label="Vis krefter" checked={showForces} onChange={setShowForces} />
      </Toolbar>

      <PushScene
        floor={s.floor}
        m={s.m}
        F={F}
        N={r.N}
        R={r.R}
        a={r.a}
        moving={r.moving}
        travel={p ? p.s * PX_PER_M : 0}
        showForces={showForces}
      />

      <FrictionGraph F={F} R={r.R} Rmax={r.Rmax} Rk={r.Rk} moving={r.moving} />
      <Legend
        items={[
          { color: VIZ.friction, label: 'Friksjonen når du øker dyttet fra null' },
          { color: VIZ.friction, label: 'Når kassen allerede glir', dashed: true },
        ]}
      />

      <Readouts>
        <Readout label="Normalkraft N = mg" value={fmt(r.N, 0)} unit="N" tone={VIZ.normal} />
        <Readout
          label={
            r.moving ? (
              <>
                Glidefriksjon R = μ<Sub>k</Sub>N
              </>
            ) : (
              'Statisk friksjon R = F'
            )
          }
          value={fmt(r.R, r.R < 100 ? 1 : 0)}
          unit="N"
          tone={VIZ.friction}
        />
        <Readout label="Akselerasjon a" value={fmt(r.a, 2)} unit="m/s²" tone={VIZ.acceleration} />
      </Readouts>

      <Formula label="Utregning">
        {r.moving ? (
          <>
            <FormulaLine>
              R = μ<Sub>k</Sub>N = {fmt(s.muK, 2)} · {fmt(r.N, 0)} N = {fmt(r.Rk, 1)} N
            </FormulaLine>
            <FormulaLine>
              a = (F − R)/m = ({fmt(F, 0)} N − {fmt(r.Rk, 1)} N)/{fmt(s.m, 0)} kg = {fmt(r.a, 2)} m/s²
            </FormulaLine>
          </>
        ) : (
          <>
            <FormulaLine>
              R = F = {fmt(F, 0)} N ≤ μ<Sub>s</Sub>N = {fmt(s.muS, 2)} · {fmt(r.N, 0)} N = {fmt(r.Rmax, 1)} N
            </FormulaLine>
            <FormulaLine>ΣF = F − R = 0, så a = 0</FormulaLine>
          </>
        )}
      </Formula>

      <Explain>
        {r.moving ? (
          <p>
            <strong>Kassen glir.</strong> Glidefriksjonen er konstant, R = μ<Sub>k</Sub>N = {fmt(r.Rk, 1)} N, uansett hvor hardt du dytter.
            Resten av dyttet gir akselerasjon: a = (F − R)/m = {fmt(r.a, 2)} m/s².{' '}
            {r.Rmax - r.Rk > 0.05 ? (
              <>
                For å holde kassen i gang er det nok å dytte med {fmt(r.Rk, 1)} N, selv om det trengtes {fmt(r.Rmax, 1)} N for å få den løs.
              </>
            ) : (
              <>
                Her er μ<Sub>k</Sub> = μ<Sub>s</Sub>, så det trengs like stort dytt for å holde kassen i gang som for å få den løs.
              </>
            )}{' '}
            Dytter du svakere enn {fmt(r.Rk, 1)} N, bremser friksjonen kassen til den stopper.
          </p>
        ) : F <= 0 ? (
          <p>
            <strong>Ingen dytt, ingen friksjon.</strong> Når ingen dytter, trenger ikke gulvet å holde igjen, så R = 0. Friksjonen virker bare
            når noe prøver å flytte kassen. Dra i glidebryteren for dyttet, eller trykk «Spill av» for å øke dyttet jevnt fra null.
          </p>
        ) : (
          <p>
            <strong>Kassen står i ro.</strong> Den statiske friksjonen fra gulvet blir nøyaktig like stor som dyttet, R = F = {fmt(F, 0)} N, så
            kraftsummen er null. Den kan bli opptil μ<Sub>s</Sub>N = {fmt(r.Rmax, 1)} N. Dytt hardere enn det, så begynner kassen å gli, og
            friksjonen faller til glidefriksjonen μ<Sub>k</Sub>N = {fmt(r.Rk, 1)} N.
            {p === null && <> Trykk «Spill av» for å øke dyttet jevnt fra null og se friksjonen følge med.</>}
          </p>
        )}
        <p>
          {custom ? (
            <>
              Du har endret friksjonstallene. For en trekasse på {FLOOR_PLACE[s.floor]} er typiske verdier μ<Sub>s</Sub> ≈ {fmt(preset.muS, 2)} og
              μ<Sub>k</Sub> ≈ {fmt(preset.muK, 2)}.{' '}
            </>
          ) : (
            <>
              Kassen er av tre og står på {FLOOR_PLACE[s.floor]}: typisk μ<Sub>s</Sub> ≈ {fmt(preset.muS, 2)} og μ<Sub>k</Sub> ≈{' '}
              {fmt(preset.muK, 2)}.{' '}
            </>
          )}
          {s.floor === 'is' ? (
            <>
              Men pass på: kassen dytter like hardt tilbake på deg (Newtons 3. lov), og det er bare friksjonen under skoene som holder deg igjen.
              På blank is er den også liten, så du sklir lett bakover. Det er derfor brodder hjelper.
            </>
          ) : s.floor === 'betong' ? (
            <>
              Ru betong gir større friksjonstall enn tregulv, så den samme kassen trenger et hardere dytt. Det er derfor flyttefolk heller triller
              tunge ting på en tralle: hjul som ruller, gir mye mindre motstand enn en kasse som glir.
            </>
          ) : (
            <>
              Det er derfor det er tyngst å få en tung kasse i gang: den statiske friksjonen kan bli større enn glidefriksjonen. Når kassen først
              glir, holder et mindre dytt den i gang.
            </>
          )}
        </p>
      </Explain>
    </VizLayout>
  );
}

/* ---------- Scenen ---------- */

interface SceneProps {
  floor: FrictionFloor;
  m: number;
  F: number;
  N: number;
  R: number;
  a: number;
  moving: boolean;
  /** Hvor langt kassen har glidd under avspillingen (piksler). */
  travel: number;
  showForces: boolean;
}

/** Utsnittet på mobil (følger kassen når den glir), så personen, kassen og pilene blir store nok. */
const NARROW_VIEW = { x: 104, y: 64, w: 500, h: H - 64 };

function PushScene(props: SceneProps) {
  const { floor, m, F, moving, travel } = props;
  const [ref, narrow] = useNarrow<HTMLDivElement>();
  const view = narrow ? { ...NARROW_VIEW, x: NARROW_VIEW.x + travel } : { x: 0, y: 0, w: W, h: H };
  return (
    <div ref={ref}>
      <Figure
        viewBox={`${view.x} ${view.y} ${view.w} ${view.h}`}
        label={`En person dytter en trekasse på ${fmt(m, 0)} kg over ${FLOOR_PLACE[floor]} med ${fmt(F, 0)} N. ${moving ? 'Kassen glir.' : 'Kassen står i ro.'}`}
        maxHeight={460}
      >
        <Backdrop floor={floor} />
        <SceneContent {...props} view={view} />
      </Figure>
    </div>
  );
}

/** Bakgrunnen for hvert underlag: stue med tregulv, garasje med betonggulv, eller et islagt vann ute. */
function Backdrop({ floor }: { floor: FrictionFloor }) {
  if (floor === 'is')
    return (
      <>
        <Himmel w={W} h={BACK + 2} sol={{ x: 660, y: 74, r: 24 }} skyer={2} seed={3} />
        <Landskap x={0} y={BACK} w={W} h={120} type="skog" seed={4} />
        {/* Isen fyller hele bildet ned til kanten (personen og kassen står på toppflaten), så vi ikke ser et snitt av isen. */}
        <Underlag x1={0} x2={W} y={H - 12} depth={12} type="is" horisont={BACK} />
      </>
    );
  if (floor === 'betong')
    return (
      <>
        <Rom x={0} y={0} w={W} h={H} gulvY={BACK} gulv="betong" />
        {/* 2,4 m × 2,0 m i samme skala som personen (bakveggen ligger litt lenger unna, ca. 6 % mindre). */}
        <Garasjeport x={470} y={BACK} w={250} h={205} />
      </>
    );
  return <Rom x={0} y={0} w={W} h={H} gulvY={BACK} gulv="tre" vindu vinduX={560} />;
}

/** Omtrentlig bredde på en etikett i figurens enheter (fet skrift, 17 · f per tegn i høyden). */
function labelWidth(text: string, f: number): number {
  return text.length * 17 * f * 0.6;
}

function SceneContent({ floor, m, F, N, R, a, moving, travel, showForces, view }: SceneProps & { view: { x: number; y: number; w: number; h: number } }) {
  const f = useTextScale();
  const k = PX_PER_N;
  const cx = BOX_X0 + travel;
  const left = cx - BOX_W / 2;
  const right = cx + BOX_W / 2;
  const top = FLOOR - BOX_H;
  const cy = FLOOR - BOX_H / 2;
  const viewRight = view.x + view.w;

  // Personen: hviler hendene på lokket uten dytt, presser når kassen står i ro, og går lent framover med kassen når
  // den glir (fasen følger strekningen, så føttene ikke sklir).
  const idle = !moving && F < 0.5;
  const pose: PersonPose = moving ? 'gaa' : idle ? 'staa' : 'skyve';
  const ledd = moving ? { rygg: 40, nakke: -28 } : idle ? { rygg: 14, nakke: 18 } : { rygg: 50, nakke: -30 };
  const px = left - (moving ? 0.45 : idle ? 0.24 : 0.6) * PERSON;
  const fase = moving ? (0.1 + travel / (0.8 * PERSON)) % 1 : undefined;
  const hand = idle ? { x: left + 10, y: top - 2 } : { x: left - 1, y: top + HAND_DY };
  const fest = { hoyreHand: hand, venstreHand: { x: hand.x + (idle ? 8 : 1), y: hand.y - (idle ? 0 : 6) } };
  const look = floor === 'is' ? { jakke: 'rod', lue: 'gul' } : floor === 'betong' ? { jakke: 'graa' } : { jakke: 'gul' };

  // Etikettene viser tallet når det er plass til det, ellers bare symbolet (tallene står også under figuren).
  const fTip = right + F * k;
  const fText = `F = ${fmt(F, 0)} N`;
  const fLabel = fTip + 12 * f + labelWidth(fText, f) < viewRight - 6 ? fText : 'F';
  const rY = FLOOR + 13;
  const rTip = cx - 8 - R * k;
  const rText = `R = ${fmt(R, R < 100 ? 1 : 0)} N`;
  const rLabel = rTip - 12 * f - labelWidth(rText, f) > view.x + 6 ? rText : 'R';
  const aLen = Math.min(A_MAX_PX, a * PX_PER_A);
  const aY = top - 26;
  const aText = `a = ${fmt(a, 2)} m/s²`;
  const aLabel = right + 8 + aLen + 12 * f + labelWidth(aText, f) < viewRight - 6 ? aText : 'a';
  return (
    <g>
      <Person x={px} y={FLOOR} size={PERSON} pose={pose} fase={fase} ledd={ledd} fest={fest} {...look} />
      <Kasse x={cx} y={FLOOR} w={BOX_W} h={BOX_H} label={`${fmt(m, 0)} kg`} labelPlass="oppe-venstre" />

      {showForces && (
        <g>
          <ForceArrow x1={cx} y1={cy} x2={cx} y2={cy - N * k} color={VIZ.normal} label="N" />
          <ForceArrow x1={cx} y1={cy} x2={cx} y2={cy + N * k} color={VIZ.gravity} label="G" origin />
          <ForceArrow x1={right} y1={cy} x2={fTip} y2={cy} color={VIZ.applied} label={fLabel} />
          <ForceArrow x1={cx - 8} y1={rY} x2={rTip} y2={rY} color={VIZ.friction} label={rLabel} labelY={rY + 8 + 12 * f} />
          {moving && <ForceArrow x1={right + 8} y1={aY} x2={right + 8 + aLen} y2={aY} color={VIZ.acceleration} width={5} label={aLabel} />}
        </g>
      )}
      <ValueTag x={view.x + 16} y={view.y + 26 * Math.max(1, f * 0.9)} anchor="start" text={moving ? 'Kassen glir' : 'Kassen står i ro'} />
    </g>
  );
}

/* ---------- Grafen: friksjonen R som funksjon av dyttet F ---------- */

/** Pen øvre grense for aksene (10, 20, 25, 40, 50, 60, 80, 100, 120, 150, 200, 250, 300, 400, 500 …). */
function axisMax(v: number): number {
  const mag = 10 ** Math.floor(Math.log10(Math.max(v, 1e-9)));
  for (const n of [1, 1.2, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10]) if (n * mag >= v - 1e-9) return n * mag;
  return 10 * mag;
}

function FrictionGraph({ F, R, Rmax, Rk, moving }: { F: number; R: number; Rmax: number; Rk: number; moving: boolean }) {
  const [ref, narrow] = useNarrow<HTMLDivElement>();
  const gh = narrow ? 560 : 400;
  // Aksene følger situasjonen (is gir små krefter), men bytter ikke mens dyttet øker under avspillingen.
  const top = axisMax(Math.min(Math.max(1.6 * Rmax, F * 1.04, 10), 1.25 * F_MAX));
  return (
    <div ref={ref}>
      <Figure viewBox={`0 0 800 ${gh}`} label="Graf over friksjonskraften R som funksjon av dyttet F" maxHeight={420}>
        <Plot x={{ min: 0, max: top, label: 'Dytt F (N)' }} y={{ min: 0, max: top, label: 'Friksjon R (N)' }} width={800} height={gh}>
          {(sc) => <GraphContent {...sc} top={top} F={F} R={R} Rmax={Rmax} Rk={Rk} moving={moving} />}
        </Plot>
      </Figure>
    </div>
  );
}

function GraphContent({
  sx,
  sy,
  x0,
  x1,
  y0,
  y1,
  top,
  F,
  R,
  Rmax,
  Rk,
  moving,
}: {
  sx: (v: number) => number;
  sy: (v: number) => number;
  x0: number;
  x1: number;
  y0: number;
  y1: number;
  top: number;
  F: number;
  R: number;
  Rmax: number;
  Rk: number;
  moving: boolean;
}) {
  const f = useTextScale();
  const peak = Math.min(Rmax, top);
  const px = sx(peak);
  const halo = { stroke: VIZ.surface, strokeWidth: 8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, fill: 'none' };
  // Plass til «Står i ro» og «Glir» øverst i hver sone (ca. 9 px per tegn).
  const zone = 15 * f;
  const fitsRest = px - x0 > 90 * f;
  const fitsSlide = x1 - px > 50 * f;
  const peakRight = peak > top * 0.55;
  const close = Rmax - Rk < top * 0.12;
  return (
    <g>
      {/* Grensen mellom de to sonene: der kassen begynner å gli */}
      <line x1={px} y1={y1} x2={px} y2={y0} stroke={VIZ.muted} strokeWidth={1.4} strokeDasharray="5 5" opacity={0.7} />
      {fitsRest && (
        <Txt x={(x0 + px) / 2} y={y1 + zone} size={0.85} muted weight={650}>
          Står i ro
        </Txt>
      )}
      {fitsSlide && (
        <Txt x={(px + x1) / 2} y={y1 + zone} size={0.85} muted weight={650}>
          Glir
        </Txt>
      )}

      {/* Gren for en kasse som allerede glir (mellom μk·N og μs·N) */}
      <line x1={sx(Rk)} y1={sy(Rk)} x2={px} y2={sy(Rk)} stroke={VIZ.friction} strokeWidth={2.5} strokeDasharray="7 6" opacity={0.75} />
      {/* Statisk friksjon: R = F opp til μs·N, så fall til μk·N og flat linje */}
      <path d={`M${sx(0)},${sy(0)} L${px},${sy(peak)}`} {...halo} />
      <path d={`M${px},${sy(Rk)} L${x1},${sy(Rk)}`} {...halo} />
      <path d={`M${sx(0)},${sy(0)} L${px},${sy(peak)}`} fill="none" stroke={VIZ.friction} strokeWidth={4} strokeLinecap="round" />
      <line x1={px} y1={sy(peak)} x2={px} y2={sy(Rk)} stroke={VIZ.friction} strokeWidth={2} strokeDasharray="3 4" />
      <path d={`M${px},${sy(Rk)} L${x1},${sy(Rk)}`} fill="none" stroke={VIZ.friction} strokeWidth={4} strokeLinecap="round" />

      <Txt x={peakRight ? px - 10 : px + 10} y={sy(peak) - 12} anchor={peakRight ? 'end' : 'start'} color={VIZ.friction} weight={700} size={0.95}>
        μ<TSub>s</TSub>N = {fmt(Rmax, 1)} N
      </Txt>
      <Txt x={x1 - 4} y={close && Rk > top * 0.18 ? sy(Rk) + 30 * f : sy(Rk) - 12} anchor="end" color={VIZ.friction} weight={700} size={0.95}>
        μ<TSub>k</TSub>N = {fmt(Rk, 1)} N
      </Txt>

      {/* Tilstanden nå, med hjelpelinjer ned til aksene */}
      <line x1={sx(F)} y1={sy(R)} x2={sx(F)} y2={y0} stroke={VIZ.ink} strokeWidth={1.2} strokeDasharray="3 4" opacity={0.55} />
      {/* Den vannrette hjelpelinja bare når kassen står i ro (når den glir, ligger punktet på den flate linja). */}
      {!moving && <line x1={x0} y1={sy(R)} x2={sx(F)} y2={sy(R)} stroke={VIZ.ink} strokeWidth={1.2} strokeDasharray="3 4" opacity={0.55} />}
      <circle cx={sx(F)} cy={sy(R)} r={11} fill={VIZ.surface} opacity={0.9} />
      <Dot x={sx(F)} y={sy(R)} r={7.5} color={VIZ.ink} />
    </g>
  );
}
