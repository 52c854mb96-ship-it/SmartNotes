import { useEffect, useRef, useState } from 'react';
import { Figure, Txt, VIZ, fmt, useTextScale } from '../../kit';
import {
  BIL_MAAL,
  Bil,
  ForceArrow,
  Himmel,
  Landskap,
  Maalebaand,
  RadialGradient,
  SCENE,
  SpeedLines,
  ValueTag,
  Vei,
  LinearGradient,
  hjulvinkelFraStrekning,
  mix,
  sceneRandom,
  shade,
  tint,
  useSceneScale,
  useStrokeScale,
  useSvgId,
} from '../../kit/scene';
import { facingDirection, groupMarks, isReversing, sceneCamera, secondMarks, speedTrend, position, velocity, type Motion } from './model';

/*
 * Scenen over bevegelsesgrafene: en bil på en rett vei med et målebånd langs veikanten (s-aksen), merker på
 * veien hvert hele sekund og fart- og akselerasjonspiler over bilen. Alt står i én skala (px per meter):
 * veien, bilen (4,4 m) og målebåndet. Får ikke hele strekningen plass, følger kameraet bilen.
 */

const W = 800;
/** Taket på skalaen (figurenheter per meter), så en kort strekning ikke gir en kjempestor bil. */
const P_MAX = 40;
/** Minste skala på PC; på mobil ganges den med useSceneScale, så bilen ikke blir for liten. */
const P_MIN = 16;

/** Tekstskaleringen figuren vil få (samme regel som i <Figure>), målt på beholderen før figuren tegnes. */
function useContainerTextScale() {
  const ref = useRef<HTMLDivElement>(null);
  const [f, setF] = useState(1);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const update = () => {
      const w = el.getBoundingClientRect().width;
      if (w > 0) setF(Math.round(Math.max(1, 12.5 / 17 / (w / W)) * 20) / 20);
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return { ref, f };
}

/** Plassen i figuren, regnet ut fra tekstskaleringen (mobil har større tekst, tykkere piler og større bil). */
function sceneLayout(f: number) {
  const k = Math.max(1, f * 0.85);
  const ss = Math.max(1, f * 0.75);
  const hud = 40 * f;
  const vArrowMax = 100 * Math.min(k, 1.15);
  const aScale = 20 * Math.min(k, 1.15);
  // Bilens midtpunkt holder seg så langt fra kanten at den lengste pila og etiketten får plass.
  const margin = vArrowMax + 26 * f + 10;
  const inner = W - 2 * margin;
  const gapCar = 22 * ss + 8;
  const gapArrows = 26 * f + 8;
  const roadY = hud + 12 * f + gapArrows + gapCar + BIL_MAAL.hoyde * P_MAX;
  const B = 46 * k;
  const roadTop = roadY - 0.7 * B;
  const nearEdge = roadY + 0.3 * B;
  /** Merkene ligger i det nære feltet, rett foran hjulene. */
  const markY = roadY + 0.07 * B;
  /** Gresskanten foran veien (Vei tegner en smal stripe, resten tegnes her). */
  const vergeY = roadY + 0.48 * B;
  const horizon = roadTop - 12 * k;
  const labelY = vergeY + 15 * f;
  const tapeY = vergeY + 22 * f;
  const tapeH = 11.5 * f * 1.75;
  const tagH = 17 * f * 0.9 * 1.55;
  const tagY = tapeY + tapeH + 8 * ss + 5 + tagH / 2;
  const H = Math.round(tagY + tagH / 2 + 10);
  return { k, ss, hud, vArrowMax, aScale, inner, gapCar, gapArrows, roadY, B, roadTop, nearEdge, markY, vergeY, horizon, labelY, tapeY, tapeH, tagY, H, pMin: P_MIN * k };
}

type Layout = ReturnType<typeof sceneLayout>;

export interface VeiSceneProps {
  m: Motion;
  t: number;
  /** Slutten av tidsaksen (s), for skalaen til fartspilen. */
  tEnd: number;
  /** Posisjonsaksen i s-t-grafen; scenen viser samme strekning. */
  sAxis: { min: number; max: number };
  showArrows: boolean;
}

export function VeiScene(props: VeiSceneProps) {
  const { ref, f } = useContainerTextScale();
  const L = sceneLayout(f);
  const { m, t } = props;
  return (
    <div ref={ref}>
      <Figure
        viewBox={`0 0 ${W} ${L.H}`}
        label={`Bil på en rett vei med målebånd langs veikanten. Ved t = ${fmt(t, 2)} s er posisjonen ${fmt(position(m, t), 1)} m og farten ${fmt(velocity(m, t), 1)} m/s.`}
        maxHeight={440}
      >
        <SceneContent {...props} L={L} />
      </Figure>
    </div>
  );
}

function SceneContent({ m, t, tEnd, sAxis, showArrows, L }: VeiSceneProps & { L: Layout }) {
  const f = useTextScale();
  const ss = useStrokeScale();
  const clip = useSvgId('bevegelse-klipp');
  const glow = useSvgId('ryggelys');

  const s = position(m, t);
  const v = velocity(m, t);
  const cam = sceneCamera(sAxis.min, sAxis.max, s, L.inner, L.pMin, P_MAX);
  const p = cam.pxPerM;
  const X = (u: number) => W / 2 + (u - cam.center) * p;
  const sAt = (x: number) => cam.center + (x - W / 2) / p;
  const shift = cam.center * p;

  const facing = facingDirection(m);
  const trend = speedTrend(m, t);
  const reversing = isReversing(m, t);
  const carLen = BIL_MAAL.lengde * p;
  const carH = BIL_MAAL.hoyde * p;
  const kc = carLen / 440; // bilen er tegnet i centimeter
  const cx = X(s);

  // Pilene: én skala for farten (den største farten i bevegelsen får den lengste pila) og én for akselerasjonen.
  const vMax = Math.max(1, Math.abs(m.v0), Math.abs(velocity(m, tEnd)));
  const vLen = (v / vMax) * L.vArrowMax;
  const aLen = m.a * L.aScale;
  const yV = L.roadY - carH - L.gapCar;
  const yA = yV - L.gapArrows;

  // Merkene hvert hele sekund, med etiketter som slås sammen når de ligger tett (rundt et vendepunkt).
  const marks = secondMarks(m, t).map((q) => ({ t: q.t, x: X(q.s) }));
  const labelPx = 17 * 0.78 * f;
  const labelText = (times: number[]) => `${times.join(', ')} s`;
  const labelWidth = (times: number[]) => labelText(times).length * labelPx * 0.56 + 4;
  const groups = groupMarks(marks, labelWidth, 6 * f);

  // Fartsstreker bak bilen (i motsatt retning av farten), lengre jo fortere det går.
  const dir: 1 | -1 = v >= 0 ? 1 : -1;
  const tail = cx - dir * (dir === facing ? BIL_MAAL.bak : BIL_MAAL.foran) * p;
  const lines = Math.abs(v) > 0.6 ? Math.min(70 * L.k, (10 + 5 * Math.abs(v)) * L.k) : 0;

  const tri = 6.5 * ss;
  const tagText = `s = ${fmt(s, 1)} m`;
  const tagW = Math.max(17 * f * 0.9 * 1.6, tagText.length * 17 * f * 0.9 * 0.6 + 16 * f);
  const tagX = Math.min(W - tagW / 2 - 8, Math.max(tagW / 2 + 8, cx));

  return (
    <>
      <defs>
        <clipPath id={clip}>
          <rect x={0} y={0} width={W} height={L.H} />
        </clipPath>
      </defs>
      <g clipPath={`url(#${clip})`}>
        <Himmel w={W} h={L.horizon + 4} skyer={2} seed={3} forskyvning={shift} />
        <Landskap x={0} y={L.horizon} w={W} h={70 * L.k} type="aaser" seed={5} forskyvning={shift} />
        <Vei x1={0} x2={W} y={L.roadY} bredde={L.B} horisont={L.horizon} depth={0.48 * L.B + 1} forskyvning={shift} seed={2} />
        <Veikant y={L.vergeY} h={L.H - L.vergeY} shift={shift} />

        {/* Merker på veien der bilen var hvert hele sekund */}
        {marks.map((q) =>
          q.x > -10 && q.x < W + 10 ? (
            <circle key={q.t} cx={q.x} cy={L.markY} r={4.6 * ss} fill={VIZ.series[0]} stroke={VIZ.surface} strokeWidth={2 * ss} />
          ) : null,
        )}

        {/* Bilen, med bremselys når farten avtar og ryggelys når den rygger */}
        {lines > 0 && <SpeedLines x={tail} y={L.roadY - carH * 0.45} length={lines} spread={carH * 0.5} dir={dir} />}
        <Bil
          x={cx}
          y={L.roadY}
          size={carLen}
          lakk="rod"
          flip={facing < 0}
          hjulvinkel={hjulvinkelFraStrekning(facing * (s - m.s0))}
          bremselys={trend === 'avtar'}
          title={reversing ? 'Bilen rygger' : trend === 'avtar' ? 'Bilen bremser' : 'Bil'}
        />
        {reversing && (
          <g aria-hidden>
            <RadialGradient
              id={glow}
              stops={[
                [0, tint(SCENE.glow, 0.75), 0.95],
                [0.4, tint(SCENE.glow, 0.6), 0.5],
                [1, tint(SCENE.glow, 0.6), 0],
              ]}
            />
            <ellipse cx={cx - facing * 197 * kc} cy={L.roadY - 110 * kc} rx={26 * kc} ry={18 * kc} fill={`url(#${glow})`} />
          </g>
        )}

        {/* Målebåndet langs veikanten er s-aksen. Det går ut over begge kantene av bildet. */}
        <Maalebaand x1={-40} x2={W + 37} y={L.tapeY} fra={sAt(-40)} til={sAt(W + 37)} enhet="" />

        {/* Avlesning: fra midten av bilen ned på målebåndet, med en spiss over og under båndet (tallene synes) */}
        <line x1={cx} x2={cx} y1={L.roadY + 3} y2={L.tapeY - tri} stroke={VIZ.series[0]} strokeWidth={1.8 * ss} strokeDasharray={`${5 * ss} ${4 * ss}`} />
        <polygon
          points={`${cx - tri},${L.tapeY - tri * 1.15} ${cx + tri},${L.tapeY - tri * 1.15} ${cx},${L.tapeY + 1.5}`}
          fill={VIZ.series[0]}
          stroke={VIZ.surface}
          strokeWidth={1.4 * ss}
          strokeLinejoin="round"
        />
        <polygon
          points={`${cx - tri},${L.tapeY + L.tapeH + tri * 1.15} ${cx + tri},${L.tapeY + L.tapeH + tri * 1.15} ${cx},${L.tapeY + L.tapeH - 1.5}`}
          fill={VIZ.series[0]}
          stroke={VIZ.surface}
          strokeWidth={1.4 * ss}
          strokeLinejoin="round"
        />

        {/* Etikettene til merkene (med glorie oppå avlesningsstreken) */}
        {groups.map((g) =>
          Math.abs(g.x - W / 2) + labelWidth(g.times) / 2 < W / 2 - 2 ? (
            <Txt key={g.times.join('-')} x={g.x} y={L.labelY} size={0.78} color={VIZ.series[0]} weight={680}>
              {labelText(g.times)}
            </Txt>
          ) : null,
        )}
        <ValueTag x={tagX} y={L.tagY} text={tagText} color={VIZ.series[0]} />

        {showArrows && (
          <g>
            <ForceArrow x1={cx} y1={yV} x2={cx + vLen} y2={yV} color={VIZ.velocity} width={6} label="v" />
            {Math.abs(v) < 0.05 && (
              <Txt x={cx} y={yV + 6 * f} color={VIZ.velocity} weight={700}>
                v = 0
              </Txt>
            )}
            <ForceArrow x1={cx} y1={yA} x2={cx + aLen} y2={yA} color={VIZ.acceleration} width={5} label="a" />
            {m.a === 0 && (
              <Txt x={cx} y={yA + 6 * f} color={VIZ.acceleration} weight={700}>
                a = 0
              </Txt>
            )}
          </g>
        )}

        {/* Positiv retning og kameraet */}
        <Txt x={16} y={L.hud * 0.62} anchor="start" size={0.85} weight={650}>
          Positiv retning →
        </Txt>
        {cam.follows && (
          <Txt x={W - 16} y={L.hud * 0.62} anchor="end" size={0.8} muted>
            Kameraet følger bilen
          </Txt>
        )}
      </g>
    </>
  );
}

/**
 * Gresskanten foran veien, sett litt ovenfra: toning og små gresstuster som ruller med kameraet (`shift`), så
 * kanten følger veien når kameraet følger bilen.
 */
function Veikant({ y, h, shift }: { y: number; h: number; shift: number }) {
  const id = useSvgId('veikant');
  const ss = useStrokeScale();
  const k = useSceneScale();
  const period = W + 80;
  const rand = sceneRandom(41);
  let tufts = '';
  let light = '';
  for (let i = 0; i < 70; i++) {
    const u = rand();
    const v = rand();
    const x = (((u * period - shift) % period) + period) % period - 40;
    const yy = y + 4 + v * (h - 6);
    const s = (2.2 + 2.2 * v) * k;
    const d = `M${r2(x - s * 0.7)},${r2(yy - s)}L${r2(x)},${r2(yy)}L${r2(x + 0.2 * s)},${r2(yy - s * 1.3)}M${r2(x)},${r2(yy)}L${r2(x + s * 0.8)},${r2(yy - s * 0.9)}`;
    if (i % 3 === 0) light += d;
    else tufts += d;
  }
  return (
    <g aria-hidden>
      <LinearGradient
        id={id}
        stops={[
          [0, shade(SCENE.grass, 0.04)],
          [0.4, SCENE.grass],
          [1, mix(SCENE.grass, SCENE.grassDark, 0.55)],
        ]}
      />
      <rect x={0} y={y} width={W} height={h} fill={`url(#${id})`} />
      <path d={tufts} fill="none" stroke={SCENE.grassDark} strokeWidth={1.1 * ss} strokeLinecap="round" strokeLinejoin="round" opacity={0.55} />
      <path d={light} fill="none" stroke={tint(SCENE.grass, 0.35)} strokeWidth={1 * ss} strokeLinecap="round" strokeLinejoin="round" opacity={0.6} />
    </g>
  );
}

const r2 = (v: number) => Math.round(v * 100) / 100;
