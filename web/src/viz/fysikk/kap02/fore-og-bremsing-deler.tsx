/**
 * Egne gjenstander til «Friksjon og føre» (k2-fore-og-bremsing) som scene-kit-et ikke har: trafikkjegle, kantstolpe,
 * bremsespor, bevegelsesuskarphet på et hjul som ruller fort, regn og snøfall. Samme stil som scene-kit-et: toninger
 * fra core, SCENE- og PAINTS-farger, tynn kontur og myk skygge. Ingen filtre og ingen bilder.
 */
import { memo } from 'react';
import { ContactShadow, LinearGradient, PAINTS, RadialGradient, SCENE, alpha, mix, sceneRandom, shade, tint, useStrokeScale, useSvgId } from '../../kit/scene';

const r2 = (v: number) => Math.round(v * 100) / 100;
const mod = (a: number, n: number) => ((a % n) + n) % n;

/**
 * Trafikkjegle (oransje med to hvite refleksbånd og firkantet gummifot), sett fra siden.
 * Ankerpunkt: (x, y) er midt under foten, på bakken. `h` er høyden (en vanlig kjegle er ca. 0,5 m).
 */
export function Trafikkjegle({ x, y, h }: { x: number; y: number; h: number }) {
  const ss = useStrokeScale();
  const body = useSvgId('kjegle');
  const foot = useSvgId('kjeglefot');
  if (!(h > 2) || !Number.isFinite(x) || !Number.isFinite(y)) return null;
  const fh = h * 0.09; // foten
  const bw = h * 0.36; // halv bredde nederst på kjeglen
  const tw = h * 0.07; // halv bredde på toppen
  const top = y - h;
  const base = y - fh;
  const at = (t: number) => bw + (tw - bw) * t; // halv bredde i høyden t (0 = nede, 1 = oppe)
  const yAt = (t: number) => base + (top - base) * t;
  const band = (t0: number, t1: number) =>
    `M${r2(x - at(t0))},${r2(yAt(t0))}L${r2(x + at(t0))},${r2(yAt(t0))}L${r2(x + at(t1))},${r2(yAt(t1))}L${r2(x - at(t1))},${r2(yAt(t1))}Z`;
  const orange = PAINTS.oransje;
  return (
    <g aria-hidden>
      <ContactShadow cx={x + h * 0.06} cy={y} rx={h * 0.6} ry={h * 0.08} />
      <LinearGradient id={body} x2={1} y2={0} stops={[[0, tint(orange, 0.22)], [0.45, orange], [1, shade(orange, 0.3)]]} />
      <LinearGradient id={foot} x2={1} y2={0} stops={[[0, tint(SCENE.rubber, 0.2)], [1, shade(SCENE.rubber, 0.2)]]} />
      <rect x={x - h * 0.5} y={y - fh} width={h} height={fh} rx={fh * 0.35} fill={`url(#${foot})`} stroke={SCENE.outline} strokeWidth={0.7 * ss} />
      <path
        d={`M${r2(x - bw)},${r2(base)}L${r2(x - tw)},${r2(top + h * 0.03)}Q${r2(x)},${r2(top - h * 0.02)} ${r2(x + tw)},${r2(top + h * 0.03)}L${r2(x + bw)},${r2(base)}Z`}
        fill={`url(#${body})`}
        stroke={SCENE.outline}
        strokeWidth={0.8 * ss}
        strokeLinejoin="round"
      />
      <path d={band(0.3, 0.44)} fill={tint(PAINTS.hvit, 0.1)} opacity={0.95} />
      <path d={band(0.58, 0.68)} fill={tint(PAINTS.hvit, 0.1)} opacity={0.95} />
    </g>
  );
}

/**
 * Kantstolpe langs norske veier: hvit stolpe med svart topp og en refleks, sett fra siden.
 * Ankerpunkt: (x, y) er foten på bakken. `h` er høyden over bakken (ca. 1 m).
 */
export function Kantstolpe({ x, y, h }: { x: number; y: number; h: number }) {
  const ss = useStrokeScale();
  const id = useSvgId('kantstolpe');
  if (!(h > 4) || !Number.isFinite(x) || !Number.isFinite(y)) return null;
  const w = Math.max(3, h * 0.12);
  const top = y - h;
  const white = mix(PAINTS.hvit, SCENE.wall, 0.15);
  return (
    <g aria-hidden>
      <ContactShadow cx={x + w * 0.4} cy={y} rx={w * 1.4} ry={Math.max(1.5, w * 0.35)} opacity={0.7} />
      <LinearGradient id={id} x2={1} y2={0} stops={[[0, tint(white, 0.3)], [0.5, white], [1, shade(white, 0.18)]]} />
      <rect x={x - w / 2} y={top} width={w} height={h} rx={w * 0.25} fill={`url(#${id})`} stroke={SCENE.outline} strokeWidth={0.6 * ss} />
      {/* Svart topp med skrå overkant, og en gul refleks */}
      <path
        d={`M${r2(x - w / 2)},${r2(top + h * 0.27)}L${r2(x + w / 2)},${r2(top + h * 0.22)}L${r2(x + w / 2)},${r2(top + w * 0.2)}L${r2(x - w / 2)},${r2(top + w * 0.45)}Z`}
        fill={PAINTS.svart}
      />
      <rect x={x - w * 0.28} y={top + h * 0.08} width={w * 0.56} height={h * 0.1} rx={w * 0.12} fill={PAINTS.gul} />
    </g>
  );
}

export type SporType = 'asfalt' | 'vaat-asfalt' | 'sno' | 'is';

/**
 * Bremsespor fra et låst hjul som sklir: et mørkt gummispor på asfalt, nedtråkkede, gråere spor i snø og blankpolerte,
 * lyse striper på is. Sporet tegnes fra x1 (der hjulet låste seg) til x2 (der hjulet er nå), midt på y.
 * `w` er tykkelsen i figurens enheter (dekkbredden i perspektiv).
 */
export function Bremsespor({ x1, x2, y, w, type }: { x1: number; x2: number; y: number; w: number; type: SporType }) {
  const id = useSvgId('bremsespor');
  const left = Math.min(x1, x2);
  const right = Math.max(x1, x2);
  if (!(right - left > 0.5) || !Number.isFinite(y)) return null;
  const color =
    type === 'asfalt' ? shade(SCENE.rubber, 0.2) : type === 'vaat-asfalt' ? SCENE.rubber : type === 'sno' ? mix(SCENE.snowShade, SCENE.asphalt, 0.38) : SCENE.iceShine;
  const strength = type === 'asfalt' ? 0.62 : type === 'vaat-asfalt' ? 0.42 : type === 'sno' ? 0.75 : 0.85;
  // Sporet er mørkest der hjulet er nå (ferskt) og litt svakere bakover, og blekner helt i starten av sporet.
  const fade = Math.min(1, 14 / (right - left));
  return (
    <g aria-hidden>
      <LinearGradient
        id={id}
        x2={1}
        y2={0}
        stops={[
          [0, color, strength * 0.25],
          [fade, color, strength * 0.8],
          [1, color, strength],
        ]}
      />
      <rect x={left} y={y - w / 2} width={right - left} height={w} rx={w * 0.4} fill={`url(#${id})`} />
      {/* To smale lyse striper midt i sporet: mønsteret i dekket (ikke på is, der sporet er en blank stripe) */}
      {type !== 'is' && (
        <g stroke={type === 'sno' ? alpha(SCENE.snow, 0.6) : alpha(SCENE.asphalt, 0.7)} strokeWidth={Math.max(0.6, w * 0.12)}>
          <line x1={left + 4} x2={right} y1={y - w * 0.18} y2={y - w * 0.18} />
          <line x1={left + 4} x2={right} y1={y + w * 0.2} y2={y + w * 0.2} />
        </g>
      )}
    </g>
  );
}

/**
 * Bevegelsesuskarphet på felgen når hjulet ruller fort: en halvgjennomsiktig skive med lyse buer over eikene, så
 * hjulet ser ut til å snurre også på et stillbilde. `amount` 0–1 (0 = ingenting, 1 = full fart).
 * (cx, cy) er midten av hjulet og r radiusen til felgen.
 */
export function HjulSpinn({ cx, cy, r, amount }: { cx: number; cy: number; r: number; amount: number }) {
  const ss = useStrokeScale();
  const id = useSvgId('hjulspinn');
  const k = Math.min(1, Math.max(0, Number.isFinite(amount) ? amount : 0));
  if (!(k > 0.02) || !(r > 1)) return null;
  const arc = (rr: number, a0: number, a1: number) => {
    const p = (a: number) => `${r2(cx + rr * Math.cos((a * Math.PI) / 180))},${r2(cy + rr * Math.sin((a * Math.PI) / 180))}`;
    return `M${p(a0)}A${r2(rr)},${r2(rr)} 0 0 1 ${p(a1)}`;
  };
  return (
    <g aria-hidden>
      <RadialGradient
        id={id}
        stops={[
          [0, SCENE.metalLight, 0.9 * k],
          [0.35, SCENE.metal, 0.75 * k],
          [1, SCENE.metalDark, 0.85 * k],
        ]}
      />
      <circle cx={cx} cy={cy} r={r} fill={`url(#${id})`} />
      <g fill="none" stroke={SCENE.highlight} strokeLinecap="round" opacity={0.75 * k}>
        <path d={arc(r * 0.72, 200, 290)} strokeWidth={1.3 * ss} />
        <path d={arc(r * 0.72, 20, 110)} strokeWidth={1.3 * ss} />
        <path d={arc(r * 0.45, 240, 320)} strokeWidth={1 * ss} />
        <path d={arc(r * 0.45, 60, 140)} strokeWidth={1 * ss} />
      </g>
      <circle cx={cx} cy={cy} r={r * 0.22} fill={SCENE.metalLight} stroke={SCENE.metalDark} strokeWidth={0.6 * ss} />
    </g>
  );
}

interface NedborProps {
  /** Området nedbøren fyller (øverste venstre hjørne, bredde og høyde). */
  x: number;
  y: number;
  w: number;
  h: number;
  /** Antall dråper eller fnugg. */
  n?: number;
  seed?: number;
  /** Hvor langt «kameraet» har flyttet seg (figurens enheter): nedbøren driver bakover når bilen kjører. */
  forskyvning?: number;
}

/** Lett regn: korte, skrå striper (vinden og farten gjør at de heller bakover). Deterministisk med fast frø. */
export const Regn = memo(function Regn({ x, y, w, h, n = 70, seed = 7, forskyvning = 0 }: NedborProps) {
  const ss = useStrokeScale();
  if (!(w > 0) || !(h > 0)) return null;
  const rand = sceneRandom(seed);
  const shift = Number.isFinite(forskyvning) ? forskyvning * 0.35 : 0;
  let d = '';
  for (let i = 0; i < n; i++) {
    const px = x + mod(rand() * w - shift, w);
    const py = y + rand() * h;
    const len = 10 + rand() * 9;
    d += `M${r2(px)},${r2(py)}l${r2(-len * 0.3)},${r2(len)}`;
  }
  return <path d={d} fill="none" stroke={mix(SCENE.cloudShade, SCENE.water, 0.45)} strokeWidth={1.2 * ss} strokeLinecap="round" opacity={0.55} aria-hidden />;
});

/** Lett snøfall: små, runde fnugg med en svak kant, så de synes mot lys himmel. Deterministisk med fast frø. */
export const Snofall = memo(function Snofall({ x, y, w, h, n = 60, seed = 11, forskyvning = 0 }: NedborProps) {
  const ss = useStrokeScale();
  if (!(w > 0) || !(h > 0)) return null;
  const rand = sceneRandom(seed);
  const shift = Number.isFinite(forskyvning) ? forskyvning * 0.3 : 0;
  const flakes: { cx: number; cy: number; r: number }[] = [];
  for (let i = 0; i < n; i++) {
    flakes.push({ cx: x + mod(rand() * w - shift, w), cy: y + rand() * h, r: (1.3 + rand() * 1.7) * ss });
  }
  return (
    <g fill={SCENE.snow} stroke={alpha(SCENE.snowShade, 0.9)} strokeWidth={0.5 * ss} opacity={0.9} aria-hidden>
      {flakes.map((f, i) => (
        <circle key={i} cx={r2(f.cx)} cy={r2(f.cy)} r={r2(f.r)} />
      ))}
    </g>
  );
});
