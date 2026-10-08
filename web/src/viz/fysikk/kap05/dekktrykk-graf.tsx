/**
 * Grafen til «Dekktrykk om vinteren»: trykket i dekket som funksjon av temperaturen i dekket (°C). Det absolutte
 * trykket p og manometertrykket p_m er to parallelle rette linjer med lufttrykket p₀ imellom (grått bånd). Fyllingen
 * i garasjen er en åpen ring, tilstanden nå en fylt prikk, og fallet i det måleren viser er en pil. De vanlige feilene
 * vises som stiplede linjer, og «helt ned til 0 K» forlenger aksen til det absolutte nullpunktet.
 */
import { Dot, Figure, Plot, TSub, Txt, VIZ, fmt, useTextScale } from '../../kit';
import { alpha, useStrokeScale, useSvgId } from '../../kit/scene';
import {
  KELVIN,
  P0_BAR,
  absoluteAt,
  celsiusLineAt,
  gaugeLineWrongAt,
  zeroGaugeTemperature,
  type TyreMethod,
  type TyrePrediction,
  type TyreState,
} from './model-dekktrykk';
import { useNarrow } from './dekktrykk-deler';

export interface DekktrykkGrafProps {
  /** Tilstanden nå (t1 = garasjen, t2 = lufta i dekket nå). */
  s: TyreState;
  tOutside: number;
  method: TyreMethod;
  pred: TyrePrediction;
  /** Forleng temperaturaksen helt ned til 0 K. */
  extended: boolean;
}

export function DekktrykkGraf(props: DekktrykkGrafProps) {
  const [ref, narrow] = useNarrow<HTMLDivElement>();
  const h = narrow ? 660 : 370;
  return (
    <div ref={ref}>
      <Figure
        viewBox={`0 0 800 ${h}`}
        label="Graf over trykket i dekket som funksjon av temperaturen: absolutt trykk og manometertrykk er parallelle rette linjer med lufttrykket imellom"
        maxHeight={440}
      >
        <GraphInner {...props} height={h} narrow={narrow} />
      </Figure>
    </div>
  );
}

const Y_MAX = 5;

function GraphInner({ s, tOutside, method, pred, extended, height, narrow }: DekktrykkGrafProps & { height: number; narrow: boolean }) {
  const f = useTextScale();
  const ss = useStrokeScale();
  const clipId = useSvgId('dekk-graf');
  const xMin = extended ? -KELVIN : -30;
  const xMax = 40;
  const yMin = method === 'celsius' ? -4 : extended ? -1.5 : 0;
  const xTicks = extended ? (narrow ? [-200, -100, 0] : [-250, -200, -150, -100, -50, 0]) : narrow ? [-20, 0, 20, 40] : [-30, -20, -10, 0, 10, 20, 30, 40];
  const yTicks: number[] = [];
  for (let v = Math.ceil(yMin); v <= Y_MAX; v++) yTicks.push(v);
  const margin = { top: 34 * f, right: 22 * f, bottom: 58 * f, left: 66 * f };
  const t1 = s.t1;
  const tNow = s.t2;
  const gaugeAt = (t: number) => absoluteAt(s, t) - P0_BAR;
  const wrong = method !== 'riktig';
  return (
    <Plot
      x={{ min: xMin, max: xMax, label: 'Temperaturen i dekket t (°C)', ticks: xTicks }}
      y={{ min: yMin, max: Y_MAX, label: 'Trykk (bar)', ticks: yTicks }}
      width={800}
      height={height}
      margin={margin}
    >
      {({ sx, sy, x0, x1, y0, y1 }) => {
        const line = (fn: (t: number) => number) => `M${sx(xMin)},${sy(fn(xMin))} L${sx(xMax)},${sy(fn(xMax))}`;
        const band = `M${sx(xMin)},${sy(absoluteAt(s, xMin))} L${sx(xMax)},${sy(absoluteAt(s, xMax))} L${sx(xMax)},${sy(gaugeAt(xMax))} L${sx(xMin)},${sy(gaugeAt(xMin))} Z`;
        const xg = sx(t1);
        const xn = sx(tNow);
        const xo = sx(tOutside);
        const cooling = tNow < t1 - 1e-9;
        const dropPx = sy(s.pm2) - sy(s.pm1);
        const showDrop = Math.abs(dropPx) > 6;
        // p₀-klammen står mellom linjene der ingen av de loddrette linjene krysser etiketten: helst ytterst til høyre,
        // ellers ytterst til venstre. Med 0 K-aksen er båndet for smalt til etiketten, og forklaringen under grafen holder.
        const p0Text = narrow ? 'p₀' : `p₀ = ${fmt(P0_BAR, 2)} bar`;
        const p0W = p0Text.length * 17 * 0.8 * f * 0.6 + 6;
        const guides = [xg, xo, xn];
        const free = (l: number, r: number) => guides.every((x) => x < l - 6 || x > r + 6);
        const candidates = [
          { bx: x1 - 30 * f, right: true },
          { bx: x0 + 30 * f, right: false },
        ];
        const pick =
          candidates.find((c) => (c.right ? free(c.bx - 9 - p0W, c.bx + 6) : free(c.bx - 6, c.bx + 9 + p0W))) ?? candidates[0]!;
        const rightSide = pick.right;
        const bx = pick.bx;
        const tB = xMin + ((bx - x0) / (x1 - x0)) * (xMax - xMin);
        const bTop = sy(absoluteAt(s, tB));
        const bBot = sy(gaugeAt(tB));
        // Med manometerfeilen går den stiplede linja inne i båndet: etiketten står i den største delen
        const wB = sy(gaugeLineWrongAt(s, tB));
        const p0Y =
          method === 'manometer' && wB > bTop && wB < bBot ? (wB - bTop > bBot - wB ? (bTop + wB) / 2 : (wB + bBot) / 2) : (bTop + bBot) / 2;
        // Etikettene for garasjen og ute står over plottet, den høyre til høyre for linja og den venstre til venstre.
        // Får de ikke plass ved siden av hverandre (smal skjerm, 0 K-aksen), flyttes den venstre ned i plottet.
        const same = Math.abs(xg - xo) < 2;
        const gw = (text: string) => text.length * 17 * 0.78 * f * 0.6;
        const guideLabels: { key: string; x: number; lx: number; y: number; text: string }[] = [];
        if (same) {
          const text = 'Garasjen = ute';
          guideLabels.push({ key: 'g', x: xg, text, y: y1 - 12 * f, lx: Math.min(796 - gw(text), Math.max(4, xg - gw(text) / 2)) });
        } else {
          const [r, l] = xg > xo ? [{ x: xg, text: 'Garasjen' }, { x: xo, text: 'Ute' }] : [{ x: xo, text: 'Ute' }, { x: xg, text: 'Garasjen' }];
          let lr = r.x + 5;
          if (lr + gw(r.text) > 796) lr = r.x - 5 - gw(r.text);
          let ll = l.x - 5 - gw(l.text);
          if (ll < 4) ll = l.x + 5;
          const clash = ll + gw(l.text) + 6 > lr && lr + gw(r.text) + 6 > ll;
          guideLabels.push({ key: r.text, x: r.x, lx: lr, y: y1 - 12 * f, text: r.text });
          guideLabels.push({ key: l.text, x: l.x, lx: clash ? l.x + 5 : ll, y: clash ? y1 + 20 * f : y1 - 12 * f, text: l.text });
        }
        // Etiketten for fallet: under og til høyre for prikken, der linja ikke går (eller til venstre når det ikke er plass)
        const dropText = `${s.drop > 0 ? '−' : '+'}${fmt(Math.abs(s.drop), 2)} bar`;
        const dropW = dropText.length * 17 * 0.85 * f * 0.6;
        const dropRight = xn + 10 + dropW <= x1 - 4;
        // Den feilaktige utregningen
        const wrongY = method === 'celsius' ? pred.p2 : pred.pm2;
        const wrongIn = Number.isFinite(wrongY) && wrongY >= yMin && wrongY <= Y_MAX;
        const wrongYc = Number.isFinite(wrongY) ? sy(Math.min(Y_MAX, Math.max(yMin, wrongY))) : y0;
        const wrongText = `${method === 'celsius' ? 'Celsius' : 'Feil'}: ${fmt(wrongY, 2)} bar`;
        const wrongRight = xn < (x0 + x1) / 2;
        // «Umulig»-etiketten i det rosa feltet: der verken de loddrette linjene eller den stiplede celsius-linja går
        const impText = 'Umulig: p < 0';
        const impW = impText.length * 17 * 0.78 * f * 0.6;
        const celsiusX = (p: number) => sx((p * t1) / s.p1);
        const impSpots = [
          { y: y0 - 12, right: true },
          { y: y0 - 12, right: false },
          { y: sy(0) + 24 * f, right: true },
          { y: sy(0) + 24 * f, right: false },
        ].map((c) => {
          const l = c.right ? x1 - 10 - impW : x0 + 10;
          const r = l + impW;
          const p = yMin + ((y0 - c.y) / (y0 - y1)) * (Y_MAX - yMin);
          const lineX = [celsiusX(p), celsiusX(p + (16 * f * (Y_MAX - yMin)) / (y0 - y1))];
          const hitsLine = lineX.some((x) => x > l - 6 && x < r + 6);
          return { ...c, l, ok: free(l, r) && !hitsLine };
        });
        const imp = impSpots.find((c) => c.ok) ?? impSpots[0]!;
        // 0 K og der måleren viser 0
        const tZero = zeroGaugeTemperature(s);
        return (
          <g>
            <defs>
              <clipPath id={clipId}>
                <rect x={x0} y={y1} width={x1 - x0} height={y0 - y1} />
              </clipPath>
            </defs>

            {method === 'celsius' && (
              <g>
                <rect x={x0} y={sy(0)} width={x1 - x0} height={y0 - sy(0)} fill={alpha(VIZ.series[4], 0.08)} />
                <Txt x={imp.l} y={imp.y} anchor="start" size={0.78} color={VIZ.series[4]} weight={600}>
                  {impText}
                </Txt>
              </g>
            )}

            <g clipPath={`url(#${clipId})`}>
              {/* Lufttrykket p₀ mellom linjene */}
              <path d={band} fill={alpha(VIZ.muted, 0.16)} />
              {/* Feilene */}
              {method === 'celsius' && (
                <path d={line((t) => celsiusLineAt(s, t))} stroke={VIZ.series[4]} strokeWidth={2.6 * ss} strokeDasharray={`${9 * ss} ${6 * ss}`} fill="none" />
              )}
              {method === 'manometer' && (
                <path d={line((t) => gaugeLineWrongAt(s, t))} stroke={VIZ.series[4]} strokeWidth={2.6 * ss} strokeDasharray={`${9 * ss} ${6 * ss}`} fill="none" />
              )}
              {/* Absolutt trykk og manometertrykk */}
              {[
                { fn: (t: number) => absoluteAt(s, t), c: VIZ.series[0] },
                { fn: gaugeAt, c: VIZ.series[2] },
              ].map((l, i) => (
                <g key={i}>
                  <path d={line(l.fn)} stroke={VIZ.surface} strokeWidth={8 * ss} fill="none" opacity={0.85} />
                  <path d={line(l.fn)} stroke={l.c} strokeWidth={3.4 * ss} fill="none" strokeLinecap="round" />
                </g>
              ))}
            </g>

            {/* Garasjen og ute */}
            {[xg, ...(same ? [] : [xo])].map((x) => (
              <line key={x} x1={x} y1={y0} x2={x} y2={y1 - 8 * f} className="viz-guide" />
            ))}
            {guideLabels.map((g) => (
              <Txt key={g.key} x={g.lx} y={g.y} anchor="start" size={0.78} muted weight={600}>
                {g.text}
              </Txt>
            ))}

            {/* p₀-klammen */}
            {!extended && bBot - bTop > 14 && (
              <g>
                <line x1={bx} y1={bTop + 3} x2={bx} y2={bBot - 3} stroke={VIZ.muted} strokeWidth={1.6 * ss} />
                <line x1={bx - 5} y1={bTop + 3} x2={bx + 5} y2={bTop + 3} stroke={VIZ.muted} strokeWidth={1.6 * ss} />
                <line x1={bx - 5} y1={bBot - 3} x2={bx + 5} y2={bBot - 3} stroke={VIZ.muted} strokeWidth={1.6 * ss} />
                <Txt x={rightSide ? bx - 9 : bx + 9} y={p0Y + 6 * f} anchor={rightSide ? 'end' : 'start'} size={0.8} weight={650} muted>
                  p<TSub>0</TSub>
                  {narrow ? '' : ` = ${fmt(P0_BAR, 2)} bar`}
                </Txt>
              </g>
            )}
            {/* Navn på linjene ytterst til høyre */}
            <Txt x={x1 - 8} y={sy(absoluteAt(s, xMax)) - 10} anchor="end" size={0.85} weight={700} color={VIZ.series[0]}>
              p
            </Txt>
            <Txt x={x1 - 8} y={sy(gaugeAt(xMax)) + 24 * f} anchor="end" size={0.85} weight={700} color={VIZ.series[2]}>
              p<TSub>m</TSub>
            </Txt>

            {/* 0 K: det absolutte trykket er null; måleren viser 0 når p = p₀ */}
            {extended && (
              <g>
                <Dot x={sx(-KELVIN)} y={sy(0)} r={6} color={VIZ.series[0]} />
                <Txt x={sx(-KELVIN) + 12} y={sy(0) - 30 * f} anchor="start" size={0.8} weight={650} color={VIZ.series[0]}>
                  0 K: p = 0
                </Txt>
                <circle cx={sx(tZero)} cy={sy(0)} r={5} fill={VIZ.surface} stroke={VIZ.series[2]} strokeWidth={2 * ss} />
                <Txt x={sx(tZero) + 10} y={sy(0) + 22 * f} anchor="start" size={0.78} color={VIZ.series[2]} weight={600}>
                  Måleren viser 0 ved {fmt(tZero, 0)} °C
                </Txt>
              </g>
            )}

            {/* Fallet i det måleren viser */}
            {showDrop && (
              <g>
                <line x1={xg} y1={sy(s.pm1)} x2={xn} y2={sy(s.pm1)} stroke={VIZ.ink} strokeWidth={1.4 * ss} strokeDasharray={`${3 * ss} ${4 * ss}`} />
                <ArrowV x={xn} ya={sy(s.pm1)} yb={sy(s.pm2)} color={VIZ.ink} />
                <Txt
                  x={cooling && !dropRight ? xn - 10 : xn + 10}
                  y={cooling ? sy(s.pm2) + 28 * f : (sy(s.pm1) + sy(s.pm2)) / 2 + 6 * f}
                  anchor={cooling && !dropRight ? 'end' : 'start'}
                  size={0.85}
                  weight={700}
                >
                  {dropText}
                </Txt>
              </g>
            )}

            {/* Fyllingen (ring) og nå (prikk) */}
            {[absoluteAt(s, t1), s.pm1].map((p, i) => (
              <circle key={i} cx={xg} cy={sy(p)} r={6.5} fill={VIZ.surface} stroke={i === 0 ? VIZ.series[0] : VIZ.series[2]} strokeWidth={2.4 * ss} />
            ))}
            <Dot x={xn} y={sy(s.p2)} r={7.5} color={VIZ.series[0]} />
            <Dot x={xn} y={sy(s.pm2)} r={7.5} color={VIZ.series[2]} />

            {/* Det den feilaktige utregningen gir */}
            {wrong && Number.isFinite(wrongY) && (
              <g>
                {wrongIn ? (
                  <rect
                    x={xn - 6.5}
                    y={wrongYc - 6.5}
                    width={13}
                    height={13}
                    transform={`rotate(45 ${xn} ${wrongYc})`}
                    fill={VIZ.surface}
                    stroke={VIZ.series[4]}
                    strokeWidth={2.4 * ss}
                  />
                ) : (
                  <ArrowV x={xn} ya={wrongYc + (wrongY < yMin ? -34 : 34) * f} yb={wrongYc} color={VIZ.series[4]} />
                )}
                <Txt
                  x={wrongRight ? xn + 14 : xn - 14}
                  y={wrongIn ? wrongYc + 6 * f : wrongYc + (wrongY < yMin ? -14 : 24) * f}
                  anchor={wrongRight ? 'start' : 'end'}
                  size={0.85}
                  weight={700}
                  color={VIZ.series[4]}
                >
                  {wrongText}
                </Txt>
              </g>
            )}
          </g>
        );
      }}
    </Plot>
  );
}

/** Loddrett pil fra ya til yb (spissen i yb) med glorie. */
function ArrowV({ x, ya, yb, color }: { x: number; ya: number; yb: number; color: string }) {
  const ss = useStrokeScale();
  const dir = yb > ya ? 1 : -1;
  const head = Math.min(11 * ss, Math.abs(yb - ya) * 0.5);
  const w = head * 0.6;
  return (
    <g>
      <line x1={x} y1={ya} x2={x} y2={yb - dir * head * 0.8} stroke={VIZ.surface} strokeWidth={6 * ss} opacity={0.8} strokeLinecap="round" />
      <line x1={x} y1={ya} x2={x} y2={yb - dir * head * 0.8} stroke={color} strokeWidth={2.4 * ss} strokeLinecap="round" />
      <polygon points={`${x - w},${yb - dir * head} ${x + w},${yb - dir * head} ${x},${yb}`} fill={color} stroke={VIZ.surface} strokeWidth={1 * ss} />
    </g>
  );
}
