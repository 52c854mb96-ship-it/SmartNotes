/**
 * Figurene i k6-solcellepanel: scenen (sola i sør, lysbuntet som treffer panelet ved hytta, normalen og vinklene h og
 * θ) og grafen over effekten P som funksjon av panelvinkelen β for sommer, vår og høst og vinter.
 */
import { useEffect, useRef, useState } from 'react';
import { Figure, Plot, Txt, VIZ, fmt, linePath, useTextScale } from '../../kit';
import {
  Callout,
  Dimension,
  Gran,
  Himmel,
  Landskap,
  Lauvtre,
  LinearGradient,
  RadialGradient,
  SCENE,
  Solcellepanel,
  Underlag,
  ValueTag,
  alpha,
  useStrokeScale,
  useSvgId,
} from '../../kit/scene';
import { ARSTIDER, ARSTID_IDS, P_AKSE_MAKS, STEDER, powerCurve, type Arstid, type SolarPanelState, type StedId } from './model-solcellepanel';
import { Hytte } from './solcellepanel-deler';
import {
  arcPath,
  beamPolygon,
  beamWindow,
  besideBeam,
  labelClear,
  normalDirAngle,
  panelFace,
  polar,
  solcelleLayout,
  sunDirAngle,
  sunPosition,
  sunRay,
  towardSun,
  type Pt,
} from './solcellepanel-scene';

/** Sollyset (samme farge som i strålingsbalansen), den elektriske effekten (nyttig energi, som i vannkraftverket). */
export const SUNLIGHT = VIZ.series[1];
export const POWER = VIZ.applied;
/** Fargene på årstidene i grafen. */
export const SEASON_COLOR: Record<Arstid, string> = {
  sommer: VIZ.series[1],
  jevndogn: VIZ.series[2],
  vinter: VIZ.series[0],
};

/**
 * Tekstskaleringen figuren får (som <Figure> regner den ut), gjenstandsskalaen og bredden på viewBox-en, målt på
 * beholderen før figuren tegnes, så viewBox-en kan velges etter den. På en smal skjerm er viewBox-en 600 bred i
 * stedet for 800, så gjenstandene blir større. Legg `ref` på en <div> rundt figurene.
 */
export function useContainerScale() {
  const ref = useRef<HTMLDivElement>(null);
  const [m, setM] = useState({ f: 1, W: 800 });
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const update = () => {
      const w = el.getBoundingClientRect().width;
      if (w > 0) {
        const W = w < 560 ? 600 : 800;
        const f = Math.round(Math.max(1, 12.5 / 17 / (w / W)) * 20) / 20;
        setM((old) => (old.f === f && old.W === W ? old : { f, W }));
      }
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return { ref, f: m.f, W: m.W, s: Math.max(1, 0.85 * m.f) };
}

const fmtDeg = (v: number) => `${fmt(v, Math.abs(v) < 9.95 ? 1 : 0)}°`;

/* ------------------------------------------------------------------ Scenen */

interface SceneProps {
  st: SolarPanelState;
  sted: StedId;
  arstid: Arstid;
  f: number;
  s: number;
  W: number;
}

export function SolScene({ st, sted, arstid, f, s, W }: SceneProps) {
  const L = solcelleLayout(f, s, W);
  const sun = st.sunUp ? `Sola står ${fmt(st.h, 1)}° over horisonten i sør` : 'Sola er under horisonten (mørketid)';
  const label = `Solcellepanel på en stolpe ved en hytte i ${STEDER[sted].navn}, midt på dagen ${ARSTIDER[arstid].dato}. ${sun}. Panelet står ${fmt(st.beta, 0)}° mot vannrett${
    st.sunUp ? `, og sollyset treffer ${fmt(st.theta, 1)}° fra normalen. Effekten er ${fmt(st.P, 0)} W.` : '.'
  }`;
  return (
    <Figure viewBox={`0 0 ${W} ${L.H}`} label={label} maxHeight={560} caption="Midt på dagen en klar dag. Sola står i sør, og strålene er parallelle.">
      <SceneContent st={st} sted={sted} arstid={arstid} L={L} s={s} />
    </Figure>
  );
}

const RAD = Math.PI / 180;

function SceneContent({ st, sted, arstid, L, s }: { st: SolarPanelState; sted: StedId; arstid: Arstid; L: ReturnType<typeof solcelleLayout>; s: number }) {
  const ss = useStrokeScale();
  const f = useTextScale();
  const id = useSvgId('solcelle-scene');
  const { W, H, gy, hz, pw, px } = L;
  const vinter = arstid === 'vinter';
  const sesong = vinter ? 'vinter' : arstid === 'jevndogn' ? 'host' : 'sommer';
  const face = panelFace(px, gy, pw, st.beta, ss);
  const c = face.center;
  const h = st.h;
  const sunPos = st.sunUp ? sunPosition(c, h, L.sunXMin, L.sunYMin) : undefined;
  const u = sunRay(h);

  // Tre parallelle stråler: én til midten (den ene armen i vinkelen θ) og én nær hver kant. Kortere enn normalen,
  // så teksten ved enden av normalen ikke krysser dem.
  const rays = [
    { t: 0.1, len: 84 },
    { t: 0.5, len: 98 },
    { t: 0.9, len: 84 },
  ].map(({ t, len }) => {
    const end = { x: face.e1.x + (face.e2.x - face.e1.x) * t, y: face.e1.y + (face.e2.y - face.e1.y) * t };
    return { start: towardSun(end, h, len * s), end };
  });
  const head = 10 * ss;
  const arrowHead = (p: Pt) => {
    const b = { x: p.x - u.x * head, y: p.y - u.y * head };
    const n = { x: -u.y * head * 0.45, y: u.x * head * 0.45 };
    return `${p.x},${p.y} ${b.x + n.x},${b.y + n.y} ${b.x - n.x},${b.y - n.y}`;
  };

  // Normalen og vinkelen θ mellom normalen og retningen mot sola
  const nLen = 120 * s;
  const nEnd = { x: c.x + face.normal.x * nLen, y: c.y + face.normal.y * nLen };
  const nLabelAnchor = face.normal.x < -0.4 ? 'end' : 'middle';
  const nLabel = nLabelAnchor === 'end' ? { x: nEnd.x - 5, y: nEnd.y + 2 } : { x: nEnd.x, y: nEnd.y - 9 * f };
  const aSun = sunDirAngle(h);
  const aNorm = normalDirAngle(st.beta);
  const rTheta = 46 * s;
  const thetaBis = (aSun + aNorm) / 2;
  const thetaText = `θ = ${fmtDeg(st.theta)}`;
  const bisPos = polar(c, rTheta + 16 * f, thetaBis);
  const bisCos = Math.cos(thetaBis * RAD);
  const bisAnchor = bisCos < -0.35 ? 'end' : bisCos > 0.35 ? 'start' : 'middle';
  // Står etiketten ved buen fritt (ikke oppå strålene, normalen eller panelet)? Ellers står den utenfor lysbuntet med
  // en strek til buen.
  const textW = thetaText.length * 8.2 * f;
  const bx0 = bisAnchor === 'end' ? bisPos.x - textW : bisAnchor === 'start' ? bisPos.x : bisPos.x - textW / 2;
  const segments: [Pt, Pt][] = [...rays.map((r): [Pt, Pt] => [r.start, r.end]), [c, nEnd], [face.e1, face.e2]];
  const thetaCallout = st.theta < 12 || !labelClear(bx0, bx0 + textW, bisPos.y, segments, 12 * f);
  const sideA = { x: u.y, y: -u.x }; // ut fra lysbuntet på siden der panelet stiger
  const calloutAnchor = sideA.x > 0.3 ? 'start' : 'middle';
  const calloutPos = besideBeam(c, h, pw, st.beta, 16 * s + (calloutAnchor === 'middle' ? 14 * f : 6));
  const arcMid = polar(c, rTheta, st.theta < 1 ? aNorm : thetaBis);

  // Solhøyden h ved den nedre enden av panelet: mellom vannrett (mot sør) og strålen
  const e1 = face.e1;
  const rH = 62 * s;
  const hRef = 96 * s;
  const hLow = h < 14;
  const hLabelPos = hLow ? { x: e1.x - rH - 6, y: e1.y + 20 * f } : polar(e1, rH + 10 * f, 180 + h / 2);

  // Tverrsnittet av lysbuntet: A · cos θ
  // Så langt ut at det ikke krysser strålene, men innenfor figuren (med plass til etiketten ved siden av)
  const winD = Math.max(130 * s, Math.min((hLow ? 230 : 180) * s, (c.x - 96 * f) / Math.max(0.2, u.x), (c.y - 24 * f) / Math.max(0.2, u.y)));
  const [w1, w2] = beamWindow(c, h, pw, st.beta, winD);

  // Lysbuntet tones inn mot panelet
  const fadeFrom = towardSun(c, h, 520 * s);

  return (
    <>
      <Himmel w={W} h={hz + 2} sol={sunPos ? { x: sunPos.x, y: sunPos.y, r: 21 * s } : undefined} skyer={vinter ? 1 : 2} seed={7} />
      {!st.sunUp && (
        <g aria-hidden>
          <rect x={0} y={0} width={W} height={hz + 2} fill={SCENE.space} opacity={0.4} />
          <RadialGradient
            id={`${id}-tw`}
            stops={[
              [0, SCENE.sunGlow, 0.85],
              [1, SCENE.sunGlow, 0],
            ]}
          />
          <ellipse cx={0.15 * W} cy={hz} rx={0.38 * W} ry={90} fill={`url(#${id}-tw)`} />
        </g>
      )}
      <Landskap x={0} y={hz} w={W} h={44} type={STEDER[sted].landskap} seed={3} />
      <Underlag x1={0} x2={W} y={gy} depth={H - gy} type={vinter ? 'sno' : 'gress'} horisont={hz} seed={4} />

      {/* Hytta med to graner og et lauvtre foran til høyre */}
      <Gran x={L.hytteX + 0.56 * L.hytteW} y={L.hytteY - 4} size={104} sno={vinter} seed={2} />
      <Gran x={L.hytteX - 0.7 * L.hytteW} y={L.hytteY - 6} size={70} sno={vinter} seed={5} />
      <Hytte x={L.hytteX} y={L.hytteY} w={L.hytteW} sesong={sesong} title="Hytte" />
      {/* Kabelen fra panelet inn i hytta */}
      <path
        d={`M${px + 3 * ss},${gy - 1}Q${px + 70},${gy - 6} ${L.hytteX - L.hytteW / 2 + 16},${L.hytteY - 3}`}
        fill="none"
        stroke={SCENE.rubber}
        strokeWidth={2.2 * ss}
        strokeLinecap="round"
        opacity={0.85}
      />
      <Lauvtre x={W - 14} y={gy + 26} size={170} sesong={sesong} seed={3} />

      {/* Lysbuntet som treffer panelet */}
      {st.sunUp && (
        <g aria-hidden>
          <LinearGradient
            id={`${id}-b`}
            userSpace
            x1={fadeFrom.x}
            y1={fadeFrom.y}
            x2={c.x}
            y2={c.y}
            stops={[
              [0, SCENE.glow, 0],
              [0.55, SCENE.glow, 0.28],
              [1, SCENE.glow, 0.5],
            ]}
          />
          <clipPath id={`${id}-k`}>
            <rect x={0} y={0} width={W} height={H} />
          </clipPath>
          <polygon
            points={beamPolygon(face.e1, face.e2, h, 1400)
              .map((p) => `${p.x},${p.y}`)
              .join(' ')}
            fill={`url(#${id}-b)`}
            clipPath={`url(#${id}-k)`}
          />
        </g>
      )}

      <Solcellepanel x={px} y={gy} w={pw} vinkel={st.beta} title="Solcellepanel" />

      {st.sunUp && (
        <g aria-hidden>
          {/* Kantene av lysbuntet */}
          {[face.e1, face.e2].map((p, i) => {
            const q = towardSun(p, h, 1400);
            return <line key={i} x1={p.x} y1={p.y} x2={q.x} y2={q.y} stroke={alpha(SUNLIGHT, 0.55)} strokeWidth={1.2 * ss} strokeDasharray={`${6 * ss} ${5 * ss}`} clipPath={`url(#${id}-k)`} />;
          })}
          {/* Strålene */}
          {rays.map((r, i) => (
            <g key={i}>
              <line x1={r.start.x} y1={r.start.y} x2={r.end.x - u.x * head * 0.8} y2={r.end.y - u.y * head * 0.8} stroke={VIZ.surface} strokeWidth={5.4 * ss} strokeLinecap="round" opacity={0.7} />
              <line x1={r.start.x} y1={r.start.y} x2={r.end.x - u.x * head * 0.8} y2={r.end.y - u.y * head * 0.8} stroke={SUNLIGHT} strokeWidth={2.6 * ss} strokeLinecap="round" />
              <polygon points={arrowHead(r.end)} fill={SUNLIGHT} stroke={VIZ.surface} strokeWidth={1 * ss} strokeLinejoin="round" />
            </g>
          ))}

          {/* Tverrsnittet av lysbuntet */}
          {Math.hypot(w2.x - w1.x, w2.y - w1.y) > 22 * s && <Dimension x1={w1.x} y1={w1.y} x2={w2.x} y2={w2.y} label="A · cos θ" labelSize={0.8} color={SUNLIGHT} />}

          {/* Solhøyden h */}
          <line x1={e1.x} y1={e1.y} x2={e1.x - hRef} y2={e1.y} stroke={VIZ.surface} strokeWidth={3.6 * ss} opacity={0.75} />
          <line x1={e1.x} y1={e1.y} x2={e1.x - hRef} y2={e1.y} stroke={VIZ.ink} strokeWidth={1.3 * ss} strokeDasharray={`${5 * ss} ${4 * ss}`} />
          <path d={arcPath(e1, rH, 180, aSun)} fill="none" stroke={VIZ.ink} strokeWidth={1.6 * ss} />
          <Txt x={hLabelPos.x} y={hLabelPos.y + 5 * f} anchor="end" size={0.85} weight={680}>
            h = {fmtDeg(h)}
          </Txt>

          {/* Normalen og θ */}
          <line x1={c.x} y1={c.y} x2={nEnd.x} y2={nEnd.y} stroke={VIZ.surface} strokeWidth={4 * ss} opacity={0.75} />
          <line x1={c.x} y1={c.y} x2={nEnd.x} y2={nEnd.y} stroke={VIZ.ink} strokeWidth={1.5 * ss} strokeDasharray={`${6 * ss} ${4 * ss}`} />
          <circle cx={c.x} cy={c.y} r={3 * ss} fill={VIZ.ink} stroke={VIZ.surface} strokeWidth={1.2 * ss} />
          <Txt x={nLabel.x} y={nLabel.y} anchor={nLabelAnchor} size={0.78} weight={600} muted>
            normal
          </Txt>
          <path d={arcPath(c, rTheta, aSun, aNorm)} fill="none" stroke={VIZ.ink} strokeWidth={1.6 * ss} />
          {thetaCallout ? (
            <Callout x={arcMid.x} y={arcMid.y} lx={calloutPos.x} ly={calloutPos.y + (calloutAnchor === 'middle' ? 0 : 5 * f)} anchor={calloutAnchor} size={0.85} strong dot={false}>
              {thetaText}
            </Callout>
          ) : (
            <Txt x={bisPos.x} y={bisPos.y + 5 * f} anchor={bisAnchor} size={0.85} weight={680}>
              {thetaText}
            </Txt>
          )}
        </g>
      )}

      {!st.sunUp && <ValueTag x={0.3 * W} y={hz - 70 * s} text="Mørketid: sola er under horisonten" color={VIZ.ink} />}

      {/* Effekten */}
      <ValueTag x={px + 14 * s} y={gy - face.postH * 0.42} text={`P = ${fmt(st.P, 0)} W`} anchor="start" color={POWER} />

      {/* Himmelretningene */}
      <Txt x={16} y={H - 14 * f} anchor="start" size={0.8} weight={650}>
        ← Sør
      </Txt>
      <Txt x={W - 16} y={H - 14 * f} anchor="end" size={0.8} weight={650}>
        Nord →
      </Txt>
    </>
  );
}

/* ------------------------------------------------------------------ Grafen */

interface GraphProps {
  sted: StedId;
  arstid: Arstid;
  etaPct: number;
  st: SolarPanelState;
  f: number;
  W: number;
}

export function EffektGraf({ sted, arstid, etaPct, st, f, W }: GraphProps) {
  const H = Math.round(300 + 170 * (f - 1));
  const label = `Graf over effekten P som funksjon av panelvinkelen β i ${STEDER[sted].navn} for sommer, vår og høst og vinter. ${
    st.best === null ? 'Det er mørketid, så panelet gir ingen effekt.' : `Den beste vinkelen ${ARSTIDER[arstid].dato} er ${fmt(st.best, 0)}°, og der er effekten ${fmt(st.Pbest, 0)} W.`
  }`;
  return (
    <Figure viewBox={`0 0 ${W} ${H}`} label={label} maxHeight={440}>
      <GraphContent sted={sted} arstid={arstid} etaPct={etaPct} st={st} H={H} W={W} />
    </Figure>
  );
}

function GraphContent({ sted, arstid, etaPct, st, H, W }: Omit<GraphProps, 'f'> & { H: number }) {
  const f = useTextScale();
  const curves = ARSTID_IDS.map((a) => ({ a, pts: powerCurve(sted, a, etaPct, 91) }));
  // Den valgte årstiden tegnes sist (øverst)
  curves.sort((p, q) => (p.a === arstid ? 1 : 0) - (q.a === arstid ? 1 : 0));
  return (
    <Plot
      x={{ min: 0, max: 90, label: 'Panelvinkel β (°)', ticks: [0, 15, 30, 45, 60, 75, 90] }}
      y={{ min: 0, max: P_AKSE_MAKS, label: 'Effekt P (W)', ticks: [0, 100, 200, 300, 400] }}
      width={W}
      height={H}
    >
      {({ sx, sy, y0, y1, x1 }) => {
        const bx = sx(st.beta);
        const peak = st.best !== null ? { x: sx(st.best), y: sy(st.Pbest) } : null;
        const dotY = sy(st.P);
        const tagRight = st.beta < 62;
        const nearPeak = peak !== null && Math.abs(bx - peak.x) < 110 * f && Math.abs(dotY - peak.y) < 36 * f;
        return (
          <g>
            <line x1={bx} y1={y0} x2={bx} y2={y1} stroke={VIZ.muted} strokeWidth={1.3} strokeDasharray="5 4" />
            {curves.map(({ a, pts }) => {
              const on = a === arstid;
              return (
                <path
                  key={a}
                  d={linePath(pts, sx, sy)}
                  fill="none"
                  stroke={SEASON_COLOR[a]}
                  strokeWidth={on ? 3.6 : 2.2}
                  opacity={on ? 1 : 0.6}
                  strokeLinejoin="round"
                />
              );
            })}
            {peak && (
              <g>
                <line x1={peak.x} y1={peak.y} x2={peak.x} y2={y0} stroke={SEASON_COLOR[arstid]} strokeWidth={1.4} strokeDasharray="2 4" opacity={0.9} />
                <circle cx={peak.x} cy={peak.y} r={6.5} fill="none" stroke={SEASON_COLOR[arstid]} strokeWidth={2} />
                <Txt x={Math.min(peak.x, x1 - 40 * f)} y={peak.y - (nearPeak && st.P <= P_AKSE_MAKS * 0.85 ? 34 : 14) * f} anchor="middle" size={0.8} weight={650} color={SEASON_COLOR[arstid]}>
                  beste {fmt(st.best ?? 0, 0)}°
                </Txt>
              </g>
            )}
            {curves.map(({ a, pts }) => {
              if (a === arstid) return null;
              const P = pts[Math.round(st.beta)]?.[1] ?? 0;
              return <circle key={a} cx={bx} cy={sy(P)} r={5} fill={SEASON_COLOR[a]} stroke={VIZ.surface} strokeWidth={1.6} opacity={0.85} />;
            })}
            <circle cx={bx} cy={dotY} r={8} fill={SEASON_COLOR[arstid]} stroke={VIZ.surface} strokeWidth={2.2} />
            {st.sunUp ? (
              <ValueTag x={tagRight ? bx + 14 : bx - 14} y={dotY + (st.P > P_AKSE_MAKS * 0.85 ? 18 * f : -2)} text={`${fmt(st.P, 0)} W`} anchor={tagRight ? 'start' : 'end'} color={SEASON_COLOR[arstid]} size={0.85} />
            ) : (
              <Txt x={sx(45)} y={sy(P_AKSE_MAKS * 0.14)} size={0.85} weight={650}>
                Mørketid: ingen direkte sol midt på dagen
              </Txt>
            )}
          </g>
        );
      }}
    </Plot>
  );
}
