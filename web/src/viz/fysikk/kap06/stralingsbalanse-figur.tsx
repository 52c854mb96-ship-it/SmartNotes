/**
 * Figurene i k6-stralingsbalanse: snittet gjennom atmosfæren (sola og jorda i rommet, drivhusgasslaget, skyene og
 * kystlandskapet med energistrømmene oppå) og grafen over temperaturen ved bakken som funksjon av ε.
 */
import { useEffect, useRef, useState } from 'react';
import { Figure, Plot, Txt, VIZ, fmt, linePath, sample, useTextScale } from '../../kit';
import { Planet, Sol, ValueTag, alpha, useStrokeScale } from '../../kit/scene';
import { radiationBalance, type Balance } from './model';
import { ColorDot } from './marks';
import { Clouds, FlowArrow, GreenhouseLayer, Landscape, Sky, cloudPlace } from './stralingsbalanse-deler';
import {
  albedoCover,
  albedoTags,
  clampTag,
  cloudCount,
  flowGeometry,
  globePoint,
  highestPeak,
  layerLabel,
  stralingLayout,
  tagWidth,
  textBox,
  type Box,
  type StralingLayout,
} from './stralingsbalanse-scene';

/** Sollys (synlig lys) og varmestråling (infrarødt): samme farger som før og som i solcellepanelet. */
export const SUNLIGHT = VIZ.series[1];
export const HEAT = VIZ.series[4];
/** Middeltemperaturen ved bakken i dag. */
export const T_TODAY = 288;
/** Celsius fra en temperatur som vises avrundet i kelvin, så «255 K = −18 °C» henger sammen. */
export const celsius = (K: number) => Math.round(K) - 273.15;

/**
 * Tekstskaleringen figuren får (som <Figure> regner den ut) og bredden på viewBox-en, målt på beholderen før figuren
 * tegnes. På en smal skjerm er scenen 600 bred i stedet for 800, så gjenstandene blir større. Legg `ref` på en <div>.
 */
export function useSceneMetrics() {
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
  return { ref, f: m.f, W: m.W };
}

const fmt2 = (v: number) => fmt(v, 2);

/* ------------------------------------------------------------------ Scenen */

export function BalanceScene({
  b,
  albedo,
  eps,
  flows,
  f,
  W,
}: {
  b: Balance;
  albedo: number;
  eps: number;
  flows: boolean;
  f: number;
  W: number;
}) {
  const L = stralingLayout(W, f);
  const label = `Snitt gjennom atmosfæren over norskekysten, med sola og jorda i verdensrommet øverst. Albedo ${fmt(albedo, 2)}, atmosfæren tar opp ${fmt(
    eps * 100,
    0,
  )} prosent av varmestrålingen fra bakken. Jorda tar opp ${fmt(b.absorbed, 0)} W/m² sollys, og temperaturen ved bakken blir ${fmt(b.Tsurface, 0)} K.`;
  return (
    <Figure
      viewBox={`0 0 ${W} ${L.H}`}
      label={label}
      maxHeight={600}
      caption={
        flows
          ? 'Tallene er energistrømmer i W/m², i snitt over hele jordoverflaten, og bredden på pilene viser hvor stor strømmen er. Landskapet er et eksempel, og høydene er ikke i målestokk.'
          : 'Albedoen til flatene: andelen av sollyset de reflekterer. Albedoen til hele jorda (α) er et snitt over hav, land, is og skyer.'
      }
    >
      <SceneContent L={L} b={b} albedo={albedo} eps={eps} flows={flows} />
    </Figure>
  );
}

function SceneContent({ L, b, albedo, eps, flows }: { L: StralingLayout; b: Balance; albedo: number; eps: number; flows: boolean }) {
  const ss = useStrokeScale();
  const cover = albedoCover(albedo);
  const geo = flowGeometry(b, L);
  const color = (k: 'sol' | 'varme') => (k === 'sol' ? SUNLIGHT : HEAT);
  const hasAtm = eps > 0 && geo.arrows.some((a) => a.id === 'atmOpp');
  const name = hasAtm ? 'drivhusgasser' : 'ingen drivhusgasser';
  const lay = layerLabel(b, eps, L, name);
  // Molekylene holder avstand til navnet og temperaturen
  const nameBox = textBox(lay.x, lay.y, 'middle', name, 17 * L.f * lay.size);
  const layBox = {
    ...nameBox,
    b: hasAtm ? lay.y + 22 * L.f * lay.size : nameBox.b,
  };
  // Norge på jordkloden (lengde 10° Ø, bredde 62° N), med samme projeksjon som Planet («jorda» har senter i 15° Ø, 14° N)
  const [nx, ny] = globePoint(10, 62, 15, 14);
  const g = L.globe;
  const tempText = `bakken: ${fmt(b.Tsurface, 0)} K = ${fmt(celsius(b.Tsurface), 0)} °C`;
  const absText = `tas opp: ${fmt(b.absorbed, 0)}`;
  const absW = tagWidth(absText, L.f);
  const tempW = tagWidth(tempText, L.f);
  const peak = highestPeak(L);
  const nClouds = cloudCount(cover.clouds);
  const c0 = nClouds > 0 ? cloudPlace(L, 0, cover.clouds) : undefined;
  const tags = flows ? [] : albedoTags(cover, L, peak, c0 ? { x: c0.x, y: c0.top - L.tagH / 2 - 8 * L.s } : undefined, fmt2);
  return (
    <g>
      <Sky L={L} />
      {/* Sola og jorda i verdensrommet; ringen viser hvor snittet er tatt */}
      <Sol x={L.sun.x} y={L.sun.y} r={L.sun.r} korona={0.6} flekker={1} />
      <Planet x={g.x} y={g.y} r={g.r} type="jorda" lysretning={185} fase={0.72} />
      <circle
        cx={g.x + nx * g.r}
        cy={g.y + ny * g.r}
        r={4.2 * L.s}
        fill="none"
        stroke={VIZ.surface}
        strokeWidth={3.4 * ss}
        opacity={0.85}
      />
      <circle cx={g.x + nx * g.r} cy={g.y + ny * g.r} r={4.2 * L.s} fill="none" stroke={VIZ.ink} strokeWidth={1.5 * ss} />

      <GreenhouseLayer L={L} eps={eps} glow={HEAT} avoid={layBox} />
      <Clouds L={L} clouds={cover.clouds} />
      <Landscape L={L} cover={cover} />

      {/* Navnet på laget og temperaturen der */}
      <Txt x={lay.x} y={lay.y - (hasAtm ? 4 : -6) * L.f} size={lay.size} weight={650}>
        {name}
      </Txt>
      {hasAtm && (
        <Txt x={lay.x} y={lay.y + 18 * L.f * lay.size} size={lay.size * 0.95} color={HEAT} weight={700}>
          {`${fmt(b.Tatm, 0)} K`}
        </Txt>
      )}

      {flows && geo.arrows.map((a) => <FlowArrow key={a.id} x1={a.x1} y1={a.y1} x2={a.x2} y2={a.y2} w={a.w} color={color(a.kind)} />)}
      {flows &&
        geo.labels.map((l) => (
          <Txt key={l.id} x={l.x} y={l.y} anchor={l.anchor} color={color(l.kind)} weight={760}>
            {l.text}
          </Txt>
        ))}

      {/* Skiltene i snittet under bakken */}
      {flows && <ValueTag x={clampTag(L.xV, absW, L.W)} y={L.rows[0]} text={absText} color={SUNLIGHT} />}
      <ValueTag x={clampTag(L.xS, tempW, L.W)} y={L.rows[1]} text={tempText} color={HEAT} />
      {tags.map((t) => (
        <ValueTag key={t.id} x={t.x} y={t.y} text={t.text} pointer={t.pointer} />
      ))}
    </g>
  );
}

/* ------------------------------------------------------------------ Grafen */

const overlaps = (a: Box, b: Box) => a.l < b.r && b.l < a.r && a.t < b.b && b.t < a.b;

export function TempGraph({ albedo, eps, Ts, Tbare, height }: { albedo: number; eps: number; Ts: number; Tbare: number; height: number }) {
  const f = useTextScale();
  const curve = sample((e) => radiationBalance(albedo, e).Tsurface, 0, 1, 100);
  return (
    <Plot
      x={{ min: 0, max: 100, label: 'Varmestråling atmosfæren absorberer (%)' }}
      y={{
        min: 140,
        max: 340,
        label: f > 1.3 ? 'T ved bakken (K)' : 'Temperatur ved bakken (K)',
        ticks: [150, 200, 250, 300],
      }}
      width={800}
      height={height}
    >
      {({ sx, sy, x0, x1, y0, y1 }) => {
        // Etikettene plasseres der de ikke treffer kurven eller hverandre (omtrentlig tekstboks i piksler)
        const font = 17 * f;
        const box = (x: number, y: number, anchor: 'start' | 'end', text: string): Box => {
          const w = text.length * 0.56 * font;
          const l = anchor === 'start' ? x : x - w;
          return { l, r: l + w, t: y - 0.8 * font, b: y + 0.25 * font };
        };
        const pts = curve.map(([e, T]) => [sx(e * 100), sy(T)] as const);
        const hitsCurve = (bx: Box) => pts.some(([px, py]) => px > bx.l - 3 && px < bx.r + 3 && py > bx.t - 3 && py < bx.b + 3);
        const inside = (bx: Box) => bx.l >= x0 && bx.r <= x1 && bx.t >= y1 - 4 && bx.b <= y0;
        const refPlaces = (T: number, text: string) =>
          (['start', 'end'] as const).flatMap((anchor) =>
            [sy(T) - 8, sy(T) + 22 * f].map((y) => ({
              x: anchor === 'start' ? x0 + 8 : x1 - 8,
              y,
              anchor,
              text,
              box: box(anchor === 'start' ? x0 + 8 : x1 - 8, y, anchor, text),
            })),
          );
        const a288 = refPlaces(T_TODAY, 'målt i dag: 288 K');
        const a255 = refPlaces(Tbare, `uten atmosfære: ${fmt(Tbare, 0)} K`);
        const gx = sx(eps * 100);
        const gy = sy(Ts);
        const crossesGuide = (bx: Box) => bx.l - 4 < gx && bx.r + 4 > gx && bx.b > gy;
        let best = { score: Infinity, p: a288[0]!, q: a255[0]! };
        a288.forEach((p, i) =>
          a255.forEach((q, j) => {
            const score =
              10 * (Number(hitsCurve(p.box)) + Number(hitsCurve(q.box)) + Number(overlaps(p.box, q.box))) +
              3 * (Number(crossesGuide(p.box)) + Number(crossesGuide(q.box))) +
              10 * (Number(!inside(p.box)) + Number(!inside(q.box))) +
              (i < 2 ? 0 : 1) +
              (j >= 2 ? 0 : 1) +
              (i % 2) * 0.1 +
              (j % 2) * 0.1;
            if (score < best.score) best = { score, p, q };
          }),
        );
        const dx = gx;
        const dy = gy;
        const valueText = `${fmt(Ts, 0)} K`;
        const dotPlaces = [
          { x: dx + 14, y: dy - 14, anchor: 'start' as const },
          { x: dx - 14, y: dy - 14, anchor: 'end' as const },
          { x: dx + 14, y: dy + 26 * f, anchor: 'start' as const },
          { x: dx - 14, y: dy + 26 * f, anchor: 'end' as const },
        ].map((d) => ({ ...d, box: box(d.x, d.y, d.anchor, valueText) }));
        const dot = dotPlaces
          .map((d) => ({
            d,
            score:
              10 * (Number(overlaps(d.box, best.p.box)) + Number(overlaps(d.box, best.q.box)) + Number(!inside(d.box))) +
              3 * Number(hitsCurve(d.box)),
          }))
          .sort((u, v) => u.score - v.score)[0];
        // Drivhuseffekten som mål ved den valgte ε: «+33 K» midt mellom linjene, til høyre (eller venstre) for den stiplede linja
        const gain = Ts - Tbare;
        const gainText = `+${fmt(gain, 0)} K`;
        const gy0 = (sy(Tbare) + dy) / 2 + 0.3 * font;
        const gainPlaces = [
          { x: dx + 10, anchor: 'start' as const },
          { x: dx - 10, anchor: 'end' as const },
        ].map((g) => ({ ...g, box: box(g.x, gy0, g.anchor, gainText) }));
        const taken = [best.p.box, best.q.box, ...(dot && dot.score < 10 ? [dot.d.box] : [])];
        const gainAt =
          sy(Tbare) - dy > 1.3 * font
            ? gainPlaces.find((g) => inside(g.box) && !hitsCurve(g.box) && !taken.some((t) => overlaps(t, g.box)))
            : undefined;
        // Drivhuseffekten: flaten mellom linja for «uten atmosfære» og kurven, fram til den valgte ε
        const upto = curve.filter(([e]) => e <= eps + 1e-9);
        const area =
          upto.length > 1
            ? `M${sx(0)},${sy(Tbare)} ${upto.map(([e, T]) => `L${sx(e * 100)},${sy(T)}`).join(' ')} L${dx},${dy} L${dx},${sy(Tbare)} Z`
            : '';
        return (
          <g>
            {area && <path d={area} fill={alpha(HEAT, 0.16)} />}
            <line x1={x0} x2={x1} y1={sy(T_TODAY)} y2={sy(T_TODAY)} className="viz-guide" />
            <line x1={x0} x2={x1} y1={sy(Tbare)} y2={sy(Tbare)} className="viz-guide" />
            <line x1={dx} x2={dx} y1={y0} y2={dy} stroke={HEAT} strokeWidth={1.4} strokeDasharray="4 4" opacity={0.7} />
            {/* En etikett som ikke får plass uten å treffe kurven, sløyfes (tallet står også under grafen) */}
            {[best.p, best.q]
              .filter((l) => inside(l.box) && !hitsCurve(l.box))
              .map((l) => (
                <Txt key={l.text} x={l.x} y={l.y} anchor={l.anchor} muted>
                  {l.text}
                </Txt>
              ))}
            <path
              d={linePath(
                curve.map(([e, T]) => [e * 100, T]),
                sx,
                sy,
              )}
              fill="none"
              stroke={HEAT}
              strokeWidth={3.5}
              strokeLinecap="round"
            />
            {gainAt && (
              <Txt x={gainAt.x} y={gy0} anchor={gainAt.anchor} color={HEAT} size={0.9} weight={700}>
                {gainText}
              </Txt>
            )}
            <ColorDot x={dx} y={dy} r={8} color={HEAT} />
            {dot && dot.score < 10 && (
              <Txt x={dot.d.x} y={dot.d.y} anchor={dot.d.anchor} color={HEAT} weight={760}>
                {valueText}
              </Txt>
            )}
          </g>
        );
      }}
    </Plot>
  );
}
