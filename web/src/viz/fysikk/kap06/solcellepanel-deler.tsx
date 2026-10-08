/**
 * Egne gjenstander til k6-solcellepanel: en rødmalt hytte med torvtak, sett skrått forfra (langveggen mot oss og
 * gavlen til høyre i skygge), i samme stil som scene-kit-et (toninger fra core.tsx, SCENE-farger, kontur, myk skygge).
 */
import { ContactShadow, LinearGradient, PAINTS, SCENE, alpha, materialStops, mix, shade, tint, useStrokeScale, useSvgId } from '../../kit/scene';

export type HytteSesong = 'sommer' | 'host' | 'vinter';

type P = [number, number];
const r1 = (v: number) => Math.round(v * 10) / 10;
const pts = (list: P[]) => list.map(([x, y]) => `${r1(x)},${r1(y)}`).join(' ');

/**
 * Rødmalt hytte med torvtak (snø om vinteren), hvite vindskier og hjørnebord, to vinduer, dør og pipe.
 * Ankerpunkt: (x, y) er midt under hele hytta på bakken. `w` er hele bredden (langvegg + gavl); høyden til mønet er
 * ca. 0,55 · w.
 *   <Hytte x={680} y={300} w={170} sesong="vinter" />
 */
export function Hytte({ x, y, w = 170, sesong = 'sommer', title }: { x: number; y: number; w?: number; sesong?: HytteSesong; title?: string }) {
  const ss = useStrokeScale();
  const id = useSvgId('hytte');
  const L = 0.7 * w; // langveggen
  const Dx = 0.3 * w; // gavlen i perspektiv
  const Dy = -0.07 * w;
  const hw = 0.27 * w; // vegghøyden
  const hr = 0.24 * w; // fra veggtopp til møne
  const x0 = x - w / 2;
  const A: P = [x0, y];
  const B: P = [x0 + L, y];
  const C: P = [x0 + L + Dx, y + Dy];
  const At: P = [A[0], y - hw];
  const Bt: P = [B[0], y - hw];
  const Ct: P = [C[0], C[1] - hw];
  const G: P = [x0 + L + Dx / 2, y + Dy / 2 - hw - hr]; // mønet over gavlen
  const ridgeL: P = [x0 + Dx / 2, G[1]]; // mønet i venstre ende
  const ov = 0.035 * w; // takutstikk
  const drop = 0.02 * w;
  // Takflaten mot oss: fra raftet (litt utenfor veggen) opp til mønet
  const eaveL: P = [At[0] - ov, At[1] + drop];
  const eaveR: P = [Bt[0] + ov * 0.35, Bt[1] + drop];
  const ridgeLo: P = [ridgeL[0] - ov, ridgeL[1] - 1];
  const Go: P = [G[0] + ov * 0.25, G[1] - 1];
  const thick = 0.035 * w; // torvlaget sett fra raftet
  const red = mix(PAINTS.rod, SCENE.woodDark, 0.22);
  const roofTop =
    sesong === 'vinter' ? SCENE.snow : sesong === 'host' ? mix(SCENE.grass, SCENE.soil, 0.4) : mix(SCENE.grass, SCENE.foliageDark, 0.25);
  const roofEdge = sesong === 'vinter' ? SCENE.snowShade : SCENE.soilDark;
  const white = PAINTS.hvit;
  const glassStops: [number, string][] = [
    [0, tint(SCENE.glass, 0.25)],
    [0.5, SCENE.glass],
    [1, shade(SCENE.glass, 0.25)],
  ];

  // Vinduer og dør på langveggen
  const winW = 0.13 * w;
  const winH = 0.12 * w;
  const winY = y - hw * 0.72;
  const wins = [x0 + L * 0.2, x0 + L * 0.74];
  const doorX = x0 + L * 0.47;
  const doorW = 0.1 * w;
  const doorH = hw * 0.8;
  // Lite vindu på gavlen (skjevt, følger perspektivet)
  const gw = (p: number, q: number): P => [B[0] + Dx * p, y + Dy * p - hw * q];
  const gableWin = [gw(0.33, 0.45), gw(0.67, 0.45), gw(0.67, 0.82), gw(0.33, 0.82)];
  // Pipe på takflaten
  const chX = x0 + L * 0.66;
  const chBase = y - hw - hr * 0.62;
  const chW = 0.06 * w;
  const chH = 0.12 * w;
  const lineW = r1(1.1 * ss);
  const boards = [];
  for (let k = 1; k * 0.045 * w < hw - 1; k++) boards.push(y - k * 0.045 * w);
  return (
    <g aria-label={title} role={title ? 'img' : undefined}>
      {title && <title>{title}</title>}
      <LinearGradient id={`${id}-v`} stops={materialStops(red, 0.8)} />
      <LinearGradient id={`${id}-t`} x2={1} y2={0.4} stops={materialStops(roofTop, 0.6)} />
      <LinearGradient id={`${id}-g`} x2={1} y2={1} stops={glassStops} />
      <ContactShadow cx={x + 0.04 * w} cy={y + 1} rx={w * 0.58} ry={w * 0.05} />
      {/* Gavlen i skygge */}
      <polygon points={pts([B, C, Ct, G, Bt])} fill={shade(red, 0.3)} stroke={SCENE.outline} strokeWidth={lineW} strokeLinejoin="round" />
      {boards.map((by, i) => (
        <line key={`g${i}`} x1={B[0]} y1={by} x2={C[0]} y2={by + Dy} stroke={shade(red, 0.5)} strokeWidth={r1(0.7 * ss)} opacity={0.45} />
      ))}
      <polygon points={pts(gableWin)} fill={shade(SCENE.glass, 0.2)} stroke={tint(white, 0.1)} strokeWidth={r1(1.6 * ss)} strokeLinejoin="round" />
      {/* Langveggen */}
      <rect x={A[0]} y={At[1]} width={L} height={hw} fill={`url(#${id}-v)`} stroke={SCENE.outline} strokeWidth={lineW} />
      {boards.map((by, i) => (
        <line key={`f${i}`} x1={A[0]} y1={by} x2={B[0]} y2={by} stroke={shade(red, 0.35)} strokeWidth={r1(0.7 * ss)} opacity={0.45} />
      ))}
      {/* Hjørnebord */}
      {[A[0], B[0] - 0.035 * w].map((cx, i) => (
        <rect key={i} x={cx} y={At[1]} width={0.035 * w} height={hw} fill={i === 0 ? white : shade(white, 0.08)} stroke={SCENE.outline} strokeWidth={r1(0.7 * ss)} />
      ))}
      <polygon points={pts([C, Ct, [Ct[0] - 0.025 * w, Ct[1] - Dy * 0.08], [C[0] - 0.025 * w, C[1] - Dy * 0.08]])} fill={shade(white, 0.25)} />
      {/* Vinduer med sprosser */}
      {wins.map((wx, i) => (
        <g key={i}>
          <rect x={wx - winW / 2 - 2 * ss} y={winY - winH / 2 - 2 * ss} width={winW + 4 * ss} height={winH + 4 * ss} fill={white} stroke={SCENE.outline} strokeWidth={r1(0.8 * ss)} />
          <rect x={wx - winW / 2} y={winY - winH / 2} width={winW} height={winH} fill={`url(#${id}-g)`} />
          <path d={`M${r1(wx - winW / 2)},${r1(winY + winH * 0.1)}L${r1(wx - winW * 0.05)},${r1(winY - winH / 2)}`} stroke={alpha(white, 0.55)} strokeWidth={r1(1.4 * ss)} />
          <path d={`M${r1(wx)},${r1(winY - winH / 2)}V${r1(winY + winH / 2)}M${r1(wx - winW / 2)},${r1(winY)}H${r1(wx + winW / 2)}`} stroke={white} strokeWidth={r1(1.5 * ss)} />
        </g>
      ))}
      {/* Dør */}
      <rect x={doorX - doorW / 2} y={y - doorH} width={doorW} height={doorH} fill={shade(SCENE.wood, 0.15)} stroke={SCENE.outline} strokeWidth={r1(0.8 * ss)} />
      <rect x={doorX - doorW / 2 - 1.5 * ss} y={y - doorH - 2.5 * ss} width={doorW + 3 * ss} height={2.5 * ss} fill={white} />
      <circle cx={doorX + doorW * 0.28} cy={y - doorH * 0.48} r={1.4 * ss} fill={SCENE.metalLight} />
      {/* Pipe (tegnes før taket, så foten skjules av takflaten) */}
      <rect x={chX - chW / 2} y={chBase - chH} width={chW} height={chH + 0.05 * w} fill={SCENE.stone} stroke={SCENE.outline} strokeWidth={lineW} />
      <rect x={chX - chW / 2 - 1.5 * ss} y={chBase - chH - 2.5 * ss} width={chW + 3 * ss} height={3 * ss} fill={shade(SCENE.stone, 0.3)} />
      {sesong === 'vinter' && <ellipse cx={chX} cy={chBase - chH - 2.5 * ss} rx={chW * 0.62} ry={1.8 * ss} fill={SCENE.snow} />}
      {/* Takflaten: torv (eller snø) med et tykt lag ved raftet */}
      <polygon points={pts([eaveL, eaveR, [eaveR[0], eaveR[1] + thick], [eaveL[0], eaveL[1] + thick]])} fill={roofEdge} stroke={SCENE.outline} strokeWidth={lineW} />
      <polygon points={pts([eaveL, eaveR, Go, ridgeLo])} fill={`url(#${id}-t)`} stroke={SCENE.outline} strokeWidth={lineW} strokeLinejoin="round" />
      {sesong !== 'vinter' &&
        Array.from({ length: 9 }, (_, i) => {
          const t = (i + 0.5) / 9;
          const bx = eaveL[0] + (eaveR[0] - eaveL[0]) * t;
          return (
            <path
              key={i}
              d={`M${r1(bx)},${r1(eaveL[1] + 0.5)}l${r1(-1.5 * ss)},${r1(-4 * ss)}M${r1(bx + 3 * ss)},${r1(eaveL[1] + 0.5)}l${r1(1 * ss)},${r1(-3.5 * ss)}`}
              stroke={shade(roofTop, 0.3)}
              strokeWidth={r1(0.9 * ss)}
              strokeLinecap="round"
            />
          );
        })}
      {sesong === 'vinter' && (
        <path
          d={`M${r1(eaveL[0])},${r1(eaveL[1] + thick)}q${r1(L * 0.12)},${r1(thick * 0.9)} ${r1(L * 0.3)},0t${r1(L * 0.32)},0t${r1(eaveR[0] - eaveL[0] - L * 0.62)},0`}
          fill="none"
          stroke={SCENE.snow}
          strokeWidth={r1(2.4 * ss)}
          strokeLinecap="round"
        />
      )}
      {/* Vindskier langs gavlen */}
      <polyline points={pts([[Bt[0] + 0.5, Bt[1] + drop], G, [Ct[0] + 0.5, Ct[1] + drop]])} fill="none" stroke={SCENE.outline} strokeWidth={r1(4.6 * ss)} strokeLinejoin="round" strokeLinecap="round" />
      <polyline points={pts([[Bt[0] + 0.5, Bt[1] + drop], G, [Ct[0] + 0.5, Ct[1] + drop]])} fill="none" stroke={white} strokeWidth={r1(2.8 * ss)} strokeLinejoin="round" strokeLinecap="round" />
    </g>
  );
}
