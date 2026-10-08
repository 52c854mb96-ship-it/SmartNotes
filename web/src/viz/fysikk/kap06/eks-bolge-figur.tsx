/**
 * Figurene i eksempeloppgaven «Bølger ved brygga» (k6-eks-bolge): en scene ved ei brygge der bølgene ruller inn
 * mot land og en måke flyter på vannet, og grafen fra filmen (vannflaten i bilde 1 og bilde 2) som eleven leser av.
 *
 * Scenen og grafen har samme målestokk langs x (samme marger), så en topp i scenen står rett over toppen i grafen.
 * I scenen er bølgene tegnet høyere enn de er (samme høyde i alle tallsettene), ellers ville de nesten ikke synes.
 *
 *   a) A og λ i grafen (λ mellom to daler), λ mellom to topper i scenen
 *   b) bilde 2 i scenen med bilde 1 stiplet, og Δx mellom de to toppene i grafen; farten v
 *   c) λ og v
 *   d) bølgeformen litt senere (tynn linje) og retningen til P; bilde 2 som kontroll
 *   e) toppen som når P først, og avstanden d
 */
import { useEffect, useRef, useState } from 'react';
import { Arrow, Figure, Plot, Txt, VIZ, fmt, linePath, sample, useTextScale } from '../../kit';
import { Dimension, ForceArrow, Himmel, Landskap, SCENE, ValueTag, Vann, mix, useSceneScale, useStrokeScale, useSvgId, LinearGradient } from '../../kit/scene';
import { Baat, Brygge, Maake } from './eks-bolge-deler';
import { POST_SPACING, X_GRID, decimalsFor, surfaceY, type WaveSolution, type WaveTask } from './model-eks-bolge';

const W = 800;
/** Bilde 1 i grafen (heltrukken) og bilde 2 (stiplet). */
const C1 = VIZ.series[0];
const C2 = VIZ.series[1];

/** Hva figuren viser: oppgaven, ett av stegene eller hele løsningen. */
export type WaveView = 'oppgave' | 'a1' | 'a2' | 'b1' | 'b2' | 'c1' | 'c2' | 'd1' | 'd2' | 'e1' | 'e2' | 'alle';

const among = (view: WaveView, list: WaveView[]) => view === 'alle' || list.includes(view);

/** Tall med `sig` gjeldende siffer: 3,33 · 0,417 · 12. */
export const sig = (v: number, n: number) => fmt(v, decimalsFor(v, n));
/** Posisjoner og lengder i grafen: 3,0 m, 11,0 m. */
export const pos = (x: number) => fmt(x, 1);

/** Marger og målestokk langs x, felles for scenen og grafen (f = tekstskaleringen i figuren). */
function xFrame(f: number, xMax: number) {
  const L = 70 * f;
  const R = W - 24 * f;
  const ppm = (R - L) / xMax;
  return { L, R, ppm, px: (m: number) => L + m * ppm, toM: (X: number) => (X - L) / ppm };
}

/** Om figuren er smal (mobil): da får figurene mer høyde til den store teksten. */
function useNarrow(limit = 560) {
  const ref = useRef<HTMLDivElement>(null);
  const [narrow, setNarrow] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const update = () => {
      const w = el.getBoundingClientRect().width;
      if (w > 0) setNarrow(w < limit);
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [limit]);
  return [ref, narrow] as const;
}

export function WaveFigures({ task, s, view, sourceKind }: { task: WaveTask; s: WaveSolution; view: WaveView; sourceKind: 'ferje' | 'motorbaat' | null }) {
  const [ref, narrow] = useNarrow();
  const frame2 = view === 'b1' || view === 'b2';
  const graphH = narrow ? 450 : 340;
  // I hele løsningen står både Δx og d over toppene, så grafen får litt mer plass øverst.
  const extraTop = view === 'alle' ? (narrow ? 64 : 36) : 0;
  const sceneLabel =
    `Ei brygge på pæler sett fra siden, med bølger som går mot høyre under den. En måke ligger på vannet i punktet P. ` +
    (frame2 ? `Bilde 2, ${sig(task.dt, 2)} s etter bilde 1. Bilde 1 er stiplet.` : 'Bilde 1, t = 0.');
  const graphLabel =
    `Graf over vannflaten langs brygga: høyden y fra −${fmt(task.yMax, task.yDecimals)} til ${fmt(task.yMax, task.yDecimals)} m ` +
    `som funksjon av x fra 0 til ${fmt(task.xMax, 0)} m, i bilde 1 (heltrukken) og bilde 2 (stiplet, ${sig(task.dt, 2)} s senere). ` +
    `Toppene i bilde 1 ligger ved x = ${s.crests0.map(pos).join(' m og ')} m, i bilde 2 ved x = ${s.crests1.map(pos).join(' m og ')} m. ` +
    `Punktet P er ved x = ${pos(task.xP)} m.`;
  return (
    <div ref={ref} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <Figure
        viewBox={`0 0 ${W} ${narrow ? 390 : 300}`}
        label={sceneLabel}
        maxHeight={narrow ? 520 : 400}
        caption={`Bølgene er tegnet høyere enn de er. Pælene under brygga står med ${fmt(POST_SPACING, 1)} m mellomrom.`}
      >
        <HarbourScene task={task} s={s} view={view} H={narrow ? 390 : 300} sourceKind={sourceKind} />
      </Figure>
      <Figure viewBox={`0 0 ${W} ${graphH + extraTop}`} label={graphLabel} maxHeight={narrow ? 640 : 480}>
        <WaveGraph task={task} s={s} view={view} H={graphH + extraTop} extraTop={extraTop} />
      </Figure>
    </div>
  );
}

/* ------------------------------------------------------------------ Scenen */

function HarbourScene({ task, s, view, H, sourceKind }: { task: WaveTask; s: WaveSolution; view: WaveView; H: number; sourceKind: 'ferje' | 'motorbaat' | null }) {
  const f = useTextScale();
  const k = useSceneScale();
  const ss = useStrokeScale();
  const seaId = useSvgId('hav');
  const fr = xFrame(f, task.xMax);
  const big = f > 1.2;
  const frame2 = view === 'b1' || view === 'b2';
  const t = frame2 ? task.dt : 0;

  // Høyder i figuren: vannet nederst, horisonten litt over vannet (kameraet står lavt), brygga over det.
  const waterY = H - (big ? 96 : 82);
  const amp = big ? 34 : 28;
  const horizonY = waterY - (big ? 58 : 46);
  const deckY = waterY - (big ? 166 : 114);
  const postW = 9 * k;
  const railH = big ? 50 : 40;
  const crestTop = waterY - amp;
  const lamPx = task.lambda * fr.ppm;
  // Vann-komponenten: η = amp · sin(2π (X − x0) / λ − fase). Vi vil ha η = amp · cos(2π (x − x_topp − v t) / λ).
  const x0 = -2;
  const fase = (2 * Math.PI * (fr.L - x0)) / lamPx + (2 * Math.PI * (task.crest0 + s.v * t)) / task.lambda - Math.PI / 2;
  const yScene = (xm: number, tt: number) => waterY - amp * (surfaceY(task, xm, tt) / task.A);

  // Pælene: hver POST_SPACING meter fra x = 0, også litt utenfor grafen så brygga fyller bredden.
  const posts: number[] = [];
  for (let m = Math.ceil(fr.toM(0) / POST_SPACING) * POST_SPACING; fr.px(m) < W + postW; m += POST_SPACING) posts.push(fr.px(m));

  // Måken i P vipper med vannflaten.
  const gx = fr.px(task.xP);
  const gy = yScene(task.xP, t);
  const h = 0.01;
  const slope = (yScene(task.xP + h, t) - yScene(task.xP - h, t)) / (2 * h * fr.ppm);
  const gullL = 44 * k;
  const gullAngle = (Math.atan(slope) * 180) / Math.PI;

  // Bilde 1 stiplet oppå bilde 2.
  const ghost = frame2 ? linePath(sample((X) => yScene(fr.toM(X), 0), 0, W, 160), (X) => X, (Y) => Y) : null;

  // I hele løsningen viser scenen bare farten og retningen til måken (λ står i grafen), så det ikke blir trangt.
  const showLambda = view === 'a2' || view === 'c1' || view === 'c2';
  const showDx = frame2;
  const showV = among(view, ['b2', 'c1', 'c2', 'e1', 'e2']);
  const showDir = among(view, ['d1', 'd2']);
  const showD = view === 'e1' || view === 'e2';
  const rowY = crestTop - (big ? 40 : 32);

  const vScale = 30; // px per m/s
  const vY = big ? 42 : 34;
  const tagText = frame2 ? `Bilde 2: t = ${sig(task.dt, 2)} s` : 'Bilde 1: t = 0 s';

  return (
    <g>
      <Himmel w={W} h={horizonY + 2} sol={{ x: W * 0.6, y: big ? 46 : 38, r: big ? 20 : 17 }} skyer={2} seed={7} />
      <Landskap x={0} y={horizonY} w={W} h={big ? 90 : 80} type="kyst" seed={3} />
      {/* Havet bak snittet: blekt ved horisonten, mørkere nærmere */}
      <LinearGradient
        id={seaId}
        stops={[
          [0, mix(SCENE.waterLight, SCENE.skyBottom, 0.55)],
          [1, mix(SCENE.waterLight, SCENE.skyBottom, 0.2)],
        ]}
      />
      <rect x={0} y={horizonY} width={W} height={waterY + amp + 4 - horizonY} fill={`url(#${seaId})`} />
      {/* Bak den nederste delen av snittet (under dalene) er det dypt vann, så det gjennomsiktige vannet ikke blir blekt der */}
      <rect x={0} y={waterY + amp + 2} width={W} height={H - waterY - amp - 2} fill={SCENE.waterDeep} />
      {sourceKind && (
        <Baat x={fr.px(task.xMax * 0.12)} y={horizonY + (big ? 10 : 8)} size={(sourceKind === 'ferje' ? 46 : 26) * k} type={sourceKind} />
      )}
      <Brygge x1={-4} x2={W + 4} deckY={deckY} waterY={waterY} bottom={H} posts={posts} postW={postW} railH={railH} />
      <Vann x={x0} y={waterY} w={W + 4} h={H - waterY + 2} bolge={{ amplitude: amp, bolgelengde: lamPx, fase }} gjennomsiktig />
      {ghost && <path d={ghost} fill="none" stroke={C1} strokeWidth={2.4 * ss} strokeDasharray={`${8 * ss} ${6 * ss}`} opacity={0.95} />}
      <Maake x={gx} y={gy + 1} size={gullL} angle={gullAngle} />
      <Txt x={gx + 0.42 * gullL} y={gy - 0.5 * gullL} anchor="start" size={1} weight={700}>
        P
      </Txt>

      {/* Tidsstempel nederst i hjørnet, som på et bilde fra en film */}
      <ValueTag x={W - 12} y={H - (big ? 22 : 18)} text={tagText} anchor="end" size={0.85} />

      {showLambda && (
        <Dimension x1={fr.px(s.lambdaFrom)} y1={crestTop} x2={fr.px(s.lambdaTo)} y2={crestTop} offset={crestTop - rowY} label={`λ = ${sig(task.lambda, 2)} m`} />
      )}
      {showDx && (
        <Dimension x1={fr.px(task.crest0)} y1={crestTop} x2={fr.px(s.crestMoved)} y2={crestTop} offset={crestTop - rowY} label={`Δx = ${sig(task.dx, 2)} m`} />
      )}
      {showD && (
        <>
          <circle cx={fr.px(s.crestLeftOfP)} cy={crestTop} r={5 * k} fill={C1} stroke={VIZ.surface} strokeWidth={2 * ss} />
          <Dimension x1={fr.px(s.crestLeftOfP)} y1={crestTop} x2={gx} y2={crestTop} offset={crestTop - rowY} label={`d = ${sig(s.d, 2)} m`} />
        </>
      )}
      {showV && (
        <ForceArrow
          x1={fr.L}
          y1={vY}
          x2={fr.L + s.v * vScale}
          y2={vY}
          color={VIZ.velocity}
          width={6}
          label={`v = ${sig(s.vShown, 2)} m/s`}
          labelX={fr.L + s.v * vScale + 12}
          labelY={vY + 6 * f}
          labelAnchor="start"
        />
      )}
      {showDir && <DirectionArrow x={gx + 0.1 * gullL} y={gy - 0.62 * gullL} up={s.direction === 'opp'} len={(big ? 40 : 34) * k} />}
    </g>
  );
}

/** Pil for retningen til måken: opp fra måken, eller ned mot måken. (x, y) er like over måken. */
function DirectionArrow({ x, y, up, len }: { x: number; y: number; up: boolean; len: number }) {
  return up ? (
    <ForceArrow x1={x} y1={y} x2={x} y2={y - len} color={VIZ.velocity} width={5} />
  ) : (
    <ForceArrow x1={x} y1={y - len - 4} x2={x} y2={y - 4} color={VIZ.velocity} width={5} />
  );
}

/* ------------------------------------------------------------------ Grafen */

function WaveGraph({ task, s, view, H, extraTop }: { task: WaveTask; s: WaveSolution; view: WaveView; H: number; extraTop: number }) {
  const f = useTextScale();
  const ss = useStrokeScale();
  const fr = xFrame(f, task.xMax);
  const big = f > 1.2;
  const top = 44 * f + extraTop;
  const bottom = 50 * f;
  const margin = { top, bottom, left: fr.L, right: W - fr.R };
  const xTicks: number[] = [];
  for (let x = 0; x <= task.xMax + 1e-9; x += task.xTick) xTicks.push(x);
  const yTicks: number[] = [];
  for (let y = -task.yMax; y <= task.yMax + 1e-9; y += task.yTick) yTicks.push(Math.round(y * 1000) / 1000);

  const pts1 = sample((x) => surfaceY(task, x, 0), 0, task.xMax, 320);
  const pts2 = sample((x) => surfaceY(task, x, task.dt), 0, task.xMax, 320);
  const shift = task.lambda / 10;
  const ptsGhost = sample((x) => surfaceY(task, x - shift, 0), shift, task.xMax, 300);

  const legendY = 24 * f;
  const t2 = `t = ${sig(task.dt, 2)} s`;
  const leg1 = big ? 't = 0' : 'Bilde 1: t = 0';
  const leg2 = big ? t2 : `Bilde 2: ${t2}`;
  const leg1W = leg1.length * 17 * 0.55 * f;

  return (
    <Plot
      x={{ min: 0, max: task.xMax, label: 'Avstand x langs brygga (m)', ticks: xTicks }}
      y={{ min: -task.yMax, max: task.yMax, label: 'Høyde y (m)', ticks: yTicks, decimals: task.yDecimals }}
      width={W}
      height={H}
      margin={margin}
    >
      {({ sx, sy, x0, x1, y0, y1 }) => {
        const minorX: number[] = [];
        for (let x = 0; x <= task.xMax + 1e-9; x += X_GRID) if (!xTicks.some((v) => Math.abs(v - x) < 1e-9)) minorX.push(x);
        const minorY: number[] = [];
        for (let y = -task.yMax; y <= task.yMax + 1e-9; y += task.yGrid) {
          const r = Math.round(y * 1000) / 1000;
          if (!yTicks.some((v) => Math.abs(v - r) < 1e-9)) minorY.push(r);
        }
        const yA = sy(task.A);
        const row1 = yA - 18 * f;
        const row2 = row1 - 34 * f;
        const P = { x: sx(task.xP), y: sy(s.yP0) };
        const P2 = { x: sx(task.xP), y: sy(s.yP1) };
        const slopeUp = s.uP < 0; // vannet stiger mot høyre i P når P er på vei ned (bølgen går mot høyre)
        const showA = among(view, ['a1', 'a2']);
        const showLambda = among(view, ['a2', 'c1', 'c2']);
        const showDx = among(view, ['b1', 'b2']);
        const showGhost = view === 'd1';
        const showDir = view === 'd1';
        const showP2 = view === 'd2';
        const showD = among(view, ['e1', 'e2']);
        const xA = s.crests0[1] ?? s.crests0[0] ?? task.crest0;
        const ext = s.leftExtreme;
        const extY = sy(ext.kind === 'topp' ? task.A : -task.A);

        return (
          <g>
            {/* Fint rutenett for avlesning */}
            <g opacity={0.55}>
              {minorX.map((x) => (
                <line key={`mx${x}`} x1={sx(x)} x2={sx(x)} y1={y0} y2={y1} className="viz-gridline" />
              ))}
              {minorY.map((y) => (
                <line key={`my${y}`} x1={x0} x2={x1} y1={sy(y)} y2={sy(y)} className="viz-gridline" />
              ))}
            </g>

            {/* Tegnforklaring over grafen */}
            <g>
              <line x1={x0} x2={x0 + 34} y1={legendY - 5 * f} y2={legendY - 5 * f} stroke={C1} strokeWidth={3.2} strokeLinecap="round" />
              <Txt x={x0 + 42} y={legendY} anchor="start" size={0.9}>
                {leg1}
              </Txt>
              <line
                x1={x0 + 42 + leg1W + 26}
                x2={x0 + 42 + leg1W + 60}
                y1={legendY - 5 * f}
                y2={legendY - 5 * f}
                stroke={C2}
                strokeWidth={3.2}
                strokeDasharray="9 6"
              />
              <Txt x={x0 + 42 + leg1W + 68} y={legendY} anchor="start" size={0.9}>
                {leg2}
              </Txt>
            </g>

            {showGhost && <path d={linePath(ptsGhost, sx, sy)} fill="none" stroke={C1} strokeWidth={1.8} opacity={0.45} />}
            <path d={linePath(pts2, sx, sy)} fill="none" stroke={C2} strokeWidth={3.2} strokeDasharray="10 7" strokeLinejoin="round" />
            <path d={linePath(pts1, sx, sy)} fill="none" stroke={C1} strokeWidth={3.4} strokeLinejoin="round" />

            {showA && (
              <g>
                <Dimension x1={sx(xA)} y1={yA} x2={sx(xA)} y2={sy(0)} />
                {/* Etiketten over toppen (der er det ledig), ikke ved siden av pila der den stiplede linja går */}
                <Txt x={sx(xA) + 8} y={yA - 9 * f} anchor="start" size={0.9} weight={650}>
                  A = {sig(task.A, 2)} m
                </Txt>
              </g>
            )}
            {showLambda && (
              <Dimension
                x1={sx(s.troughs0[0] ?? 0)}
                y1={sy(-task.A)}
                x2={sx(s.troughs0[1] ?? 0)}
                y2={sy(-task.A)}
                offset={-(big ? 30 : 20)}
                label={`λ = ${sig(task.lambda, 2)} m`}
              />
            )}
            {showDx && (
              <g>
                <Dimension x1={sx(task.crest0)} y1={yA} x2={sx(s.crestMoved)} y2={yA} offset={yA - row1} label={`Δx = ${sig(task.dx, 2)} m`} />
                <circle cx={sx(task.crest0)} cy={yA} r={5} fill={C1} stroke={VIZ.surface} strokeWidth={2} />
                <circle cx={sx(s.crestMoved)} cy={yA} r={5} fill={C2} stroke={VIZ.surface} strokeWidth={2} />
              </g>
            )}
            {showD && (
              <g>
                <line x1={P.x} x2={P.x} y1={P.y - 8} y2={yA} stroke={VIZ.ink} strokeWidth={1 * ss} strokeDasharray="3 3" opacity={0.55} />
                <Dimension
                  x1={sx(s.crestLeftOfP)}
                  y1={yA}
                  x2={P.x}
                  y2={yA}
                  offset={yA - (view === 'alle' ? row2 : row1)}
                  label={`d = ${sig(s.d, 2)} m`}
                />
                <circle cx={sx(s.crestLeftOfP)} cy={yA} r={5} fill={C1} stroke={VIZ.surface} strokeWidth={2} />
              </g>
            )}
            {showDir && (
              <g>
                <Arrow
                  x1={sx(ext.x) - 18 * f}
                  y1={extY + (ext.kind === 'topp' ? -16 : 16) * f}
                  x2={sx(ext.x) + 18 * f}
                  y2={extY + (ext.kind === 'topp' ? -16 : 16) * f}
                  color={C1}
                  width={2.4}
                  head={9}
                />
                <Txt x={sx(ext.x)} y={extY + (ext.kind === 'topp' ? -26 : 40) * f} anchor="middle" size={0.85} color={C1} weight={650}>
                  {ext.kind}
                </Txt>
              </g>
            )}
            {(showDir || view === 'alle') && (
              <ForceArrow
                x1={P.x}
                y1={P.y + (s.direction === 'opp' ? -9 : 9)}
                x2={P.x}
                y2={P.y + (s.direction === 'opp' ? -1 : 1) * (big ? 40 : 34)}
                color={VIZ.velocity}
                width={5}
              />
            )}
            {showP2 && (
              <g>
                <Arrow x1={P.x} y1={P.y} x2={P2.x} y2={P2.y + (P2.y > P.y ? -8 : 8)} color={VIZ.velocity} width={2.6} head={10} dashed />
                <circle cx={P2.x} cy={P2.y} r={6} fill={VIZ.surface} stroke={C2} strokeWidth={3} />
                <Txt x={P2.x + 12} y={P2.y + (P2.y > P.y ? 20 : -10) * f} anchor="start" size={0.85} weight={650}>
                  P i bilde 2
                </Txt>
              </g>
            )}
            <circle cx={P.x} cy={P.y} r={6.5} fill={VIZ.ink} stroke={VIZ.surface} strokeWidth={2.5} />
            <Txt x={P.x + (slopeUp ? -12 : 12)} y={P.y - 12 * f} anchor={slopeUp ? 'end' : 'start'} size={1} weight={700}>
              P
            </Txt>
          </g>
        );
      }}
    </Plot>
  );
}

