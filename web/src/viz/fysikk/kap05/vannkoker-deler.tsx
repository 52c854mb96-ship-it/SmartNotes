/**
 * Egne deler til «Vannkoker eller kokeplate» (scene-kit-et har dem ikke): et kjøkken med flislagt vegg, benkeplate i
 * eik og hvite skapdører, og en bølgete pil for varmetap. Samme stil som kit-et: toninger fra core.tsx, SCENE-farger,
 * kontur og myk skygge. Ingen filtre og ingen bilder.
 */
import { memo, useEffect, useRef, useState } from 'react';
import { VIZ } from '../../kit';
import { doorLayout } from './vannkoker-layout';
import { ContactShadow, LinearGradient, PAINTS, SCENE, alpha, mix, shade, tint, useStrokeScale, useSvgId } from '../../kit/scene';

const r1 = (v: number) => Math.round(v * 10) / 10;

/** Om elementet er smalere enn `limit` piksler (mobil eller smal kolonne): da brukes de smale oppsettene. */
export function useNarrow<T extends HTMLElement>(limit = 560) {
  const ref = useRef<T>(null);
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

export interface KjokkenGeo {
  W: number;
  H: number;
  /** Øverste rad med fliser (fliseveggen går herfra ned til benken). */
  tileTop: number;
  /** Bakkanten av benkeplata (møter veggen). */
  backY: number;
  /** Der ting står på benken (ankerpunktet til apparatene). */
  counterY: number;
  /** Forkanten av benkeplata (overkanten av kanten vi ser forfra). */
  frontY: number;
  /** Underkanten av benkeplata (skapdørene begynner litt under). */
  edgeBot: number;
  /** Bredden på én skapdør. */
  doorW: number;
  /** Midten av skapdørene som skal stå rett under apparatene (så navnene ikke krysser en dørsprekk). */
  doorCenters?: number[];
}


/**
 * Kjøkkenbenk foran en flislagt vegg: hvite metrofliser med fuger i forband, benkeplate i eik sett litt ovenfra
 * (toppflate og forkant), skygge under plata og hvite skapdører med håndtak i børstet stål. Tegnes over Rom.
 */
export const Kjokken = memo(function Kjokken({ W, H, tileTop, backY, frontY, edgeBot, doorW, doorCenters = [] }: KjokkenGeo) {
  const ss = useStrokeScale();
  const id = useSvgId('vk-kjokken');
  const tileW = 46;
  const tileH = 23;
  const rows = Math.ceil((backY - tileTop) / tileH);
  // Fugene: vannrette linjer og loddrette i forband (annenhver rad forskjøvet en halv flis).
  let grout = '';
  let shine = '';
  for (let r = 0; r <= rows; r++) {
    const y = backY - r * tileH;
    if (y < tileTop - 0.5) break;
    grout += `M0,${r1(y)}H${W}`;
    const top = Math.max(tileTop, y - tileH);
    const off = r % 2 === 0 ? 0 : tileW / 2;
    for (let x = off - tileW; x < W + tileW; x += tileW) {
      if (x > 0 && x < W) grout += `M${r1(x)},${r1(y)}V${r1(top)}`;
      // Glasuren: en svak lys strek øverst på hver flis
      if (y - top > 6) shine += `M${r1(x + 4)},${r1(top + 3)}H${r1(x + tileW - 6)}`;
    }
  }
  const doors = doorLayout(W, doorW, doorCenters);
  const doorTop = edgeBot + 5;
  const door = SCENE.bench;
  return (
    <g aria-hidden>
      <defs>
        <LinearGradient id={`${id}-fl`} stops={[[0, tint(SCENE.wall, 0.12)], [1, mix(SCENE.wall, SCENE.wallShade, 0.6)]]} />
        <LinearGradient id={`${id}-top`} stops={[[0, shade(SCENE.woodLight, 0.1)], [1, tint(SCENE.woodLight, 0.12)]]} />
        <LinearGradient id={`${id}-kant`} stops={[[0, tint(SCENE.wood, 0.08)], [1, shade(SCENE.wood, 0.18)]]} />
        <LinearGradient id={`${id}-dor`} stops={[[0, tint(door, 0.12)], [1, shade(door, 0.05)]]} />
        <LinearGradient id={`${id}-skygge`} stops={[[0, SCENE.shadow], [1, SCENE.shadow, 0]]} />
      </defs>
      {/* Fliseveggen */}
      <rect x={0} y={tileTop} width={W} height={backY - tileTop} fill={`url(#${id}-fl)`} />
      <path d={grout} stroke={SCENE.wallShade} strokeWidth={1.6 * ss} fill="none" />
      <path d={grout} stroke={shade(SCENE.wallShade, 0.12)} strokeWidth={0.6 * ss} fill="none" opacity={0.6} />
      <path d={shine} stroke={SCENE.highlight} strokeWidth={1.4 * ss} fill="none" strokeLinecap="round" opacity={0.7} />
      <line x1={0} x2={W} y1={tileTop} y2={tileTop} stroke={SCENE.wallShade} strokeWidth={2 * ss} />
      {/* Myk skygge der flisene møter benken */}
      <rect x={0} y={backY - 10} width={W} height={10} fill={alpha(SCENE.shadow, 0.35)} opacity={0.5} />

      {/* Skapene under benken */}
      <rect x={0} y={edgeBot} width={W} height={H - edgeBot} fill={shade(door, 0.3)} />
      {doors.map(([a, b]) => {
        const x = a + 3;
        const w = b - a - 6;
        const handleW = Math.min(46, w * 0.3);
        const hx = x + (w - handleW) / 2;
        return (
          <g key={a}>
            <rect x={x} y={doorTop} width={w} height={H - doorTop + 4} rx={3} fill={`url(#${id}-dor)`} stroke={SCENE.outline} strokeWidth={0.7 * ss} />
            <rect x={x + 3} y={doorTop + 2} width={w - 6} height={2} rx={1} fill={SCENE.highlight} opacity={0.8} />
            <rect x={hx} y={doorTop + 14} width={handleW} height={6} rx={3} fill={SCENE.metal} stroke={SCENE.outline} strokeWidth={0.6 * ss} />
            <rect x={hx + 2} y={doorTop + 15} width={handleW - 4} height={1.6} rx={0.8} fill={SCENE.metalLight} />
          </g>
        );
      })}
      {/* Skygge fra benkeplata ned på dørene */}
      <rect x={0} y={edgeBot} width={W} height={18} fill={`url(#${id}-skygge)`} opacity={0.75} />

      {/* Benkeplata: toppflate og forkant */}
      <rect x={0} y={backY} width={W} height={frontY - backY} fill={`url(#${id}-top)`} />
      <line x1={0} x2={W} y1={backY + 0.5} y2={backY + 0.5} stroke={shade(SCENE.woodLight, 0.25)} strokeWidth={1 * ss} opacity={0.7} />
      <path
        d={`M0,${r1(backY + (frontY - backY) * 0.35)}C${W * 0.3},${r1(backY + (frontY - backY) * 0.3)} ${W * 0.6},${r1(backY + (frontY - backY) * 0.45)} ${W},${r1(backY + (frontY - backY) * 0.38)}M0,${r1(backY + (frontY - backY) * 0.7)}C${W * 0.25},${r1(backY + (frontY - backY) * 0.75)} ${W * 0.7},${r1(backY + (frontY - backY) * 0.62)} ${W},${r1(backY + (frontY - backY) * 0.72)}`}
        stroke={shade(SCENE.woodLight, 0.12)}
        strokeWidth={0.8 * ss}
        fill="none"
        opacity={0.6}
      />
      <rect x={0} y={frontY} width={W} height={edgeBot - frontY} fill={`url(#${id}-kant)`} />
      <line x1={0} x2={W} y1={frontY} y2={frontY} stroke={SCENE.highlight} strokeWidth={1.4 * ss} />
      <line x1={0} x2={W} y1={edgeBot} y2={edgeBot} stroke={SCENE.outline} strokeWidth={0.8 * ss} />
    </g>
  );
});

/**
 * Bølgete pil for varme som strømmer ut i lufta (varmetap), med glorie så den synes oppå veggen og fliser.
 * (x, y) er starten; `angle` er retningen i grader fra loddrett opp (positiv = mot høyre). Lengden skal være
 * proporsjonal med den tapte effekten (fast skala px/W i hele figuren). For korte piler tegnes ikke.
 */
export function VarmetapPil({ x, y, angle, length, color = VIZ.series[1], width = 3 }: { x: number; y: number; angle: number; length: number; color?: string; width?: number }) {
  const ss = useStrokeScale();
  if (!(length >= 8) || !Number.isFinite(x) || !Number.isFinite(y)) return null;
  const a = (angle * Math.PI) / 180;
  const dx = Math.sin(a);
  const dy = -Math.cos(a);
  const nx = -dy;
  const ny = dx;
  const head = Math.min(11 * ss, 0.45 * length);
  const body = length - head * 0.8;
  const amp = Math.min(5 * ss, 0.12 * length);
  const waves = Math.max(1, Math.round(body / 22));
  const n = 28;
  let d = '';
  for (let i = 0; i <= n; i++) {
    const s = (i / n) * body;
    // Bølgen dør ut mot spissen, så pilhodet sitter rett på linja.
    const w = amp * Math.sin((2 * Math.PI * waves * i) / n) * (1 - 0.5 * (i / n));
    const px = x + dx * s + nx * w;
    const py = y + dy * s + ny * w;
    d += `${i === 0 ? 'M' : 'L'}${r1(px)},${r1(py)}`;
  }
  const tipX = x + dx * length;
  const tipY = y + dy * length;
  const bx = x + dx * (length - head);
  const by = y + dy * (length - head);
  const hw = head * 0.62;
  const tri = `${r1(tipX)},${r1(tipY)} ${r1(bx + nx * hw)},${r1(by + ny * hw)} ${r1(bx - nx * hw)},${r1(by - ny * hw)}`;
  const sw = width * ss;
  return (
    <g aria-hidden>
      <path d={d} fill="none" stroke={VIZ.surface} strokeWidth={sw + 3.6 * ss} strokeLinecap="round" strokeLinejoin="round" opacity={0.85} />
      <polygon points={tri} fill={VIZ.surface} stroke={VIZ.surface} strokeWidth={3.2 * ss} strokeLinejoin="round" opacity={0.85} />
      <path d={d} fill="none" stroke={color} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" />
      <polygon points={tri} fill={color} />
    </g>
  );
}

/**
 * Kaffekrus i glasert keramikk med hank og en tepose som henger over kanten, sett litt ovenfra.
 * (x, y) er midt på bunnen; `size` er høyden (en ekte krus er ca. 9 cm, vannkokeren ca. 25 cm).
 */
export function Kopp({ x, y, size, farge = PAINTS.blaa }: { x: number; y: number; size: number; farge?: string }) {
  const ss = useStrokeScale();
  const id = useSvgId('vk-kopp');
  const h = size;
  const w = 0.86 * h;
  const ry = 0.13 * w;
  const top = y - h;
  const l = x - w / 2;
  const r = x + w / 2;
  const body = `M${r1(l)},${r1(top)}L${r1(l + 0.03 * w)},${r1(y - ry * 0.6)}Q${r1(x)},${r1(y + ry * 0.7)} ${r1(r - 0.03 * w)},${r1(y - ry * 0.6)}L${r1(r)},${r1(top)}Z`;
  const handle = `M${r1(r - 0.02 * w)},${r1(top + 0.22 * h)}C${r1(r + 0.42 * w)},${r1(top + 0.14 * h)} ${r1(r + 0.42 * w)},${r1(top + 0.78 * h)} ${r1(r - 0.01 * w)},${r1(top + 0.7 * h)}`;
  return (
    <g aria-hidden>
      <defs>
        <LinearGradient id={`${id}-k`} x2={1} y2={0} stops={[[0, tint(farge, 0.25)], [0.35, farge], [1, shade(farge, 0.3)]]} />
      </defs>
      <ContactShadow cx={x + 0.08 * w} cy={y} rx={0.62 * w} ry={0.1 * w} />
      <path d={handle} fill="none" stroke={SCENE.outline} strokeWidth={0.2 * w + 1.6 * ss} strokeLinecap="round" />
      <path d={handle} fill="none" stroke={shade(farge, 0.12)} strokeWidth={0.2 * w} strokeLinecap="round" />
      <path d={body} fill={`url(#${id}-k)`} stroke={SCENE.outline} strokeWidth={0.9 * ss} strokeLinejoin="round" />
      {/* Åpningen: lys glasur inni og en tynn kant */}
      <ellipse cx={x} cy={top} rx={w / 2} ry={ry} fill={tint(farge, 0.55)} stroke={SCENE.outline} strokeWidth={0.8 * ss} />
      <ellipse cx={x} cy={top + 0.25 * ry} rx={w / 2 - 0.06 * w} ry={ry * 0.72} fill={shade(tint(farge, 0.5), 0.18)} />
      <path d={`M${r1(l + 0.12 * w)},${r1(top + 0.18 * h)}L${r1(l + 0.14 * w)},${r1(y - 0.2 * h)}`} stroke={SCENE.highlight} strokeWidth={0.07 * w} strokeLinecap="round" />
      {/* Teposen: tråd over kanten og en lapp på utsiden */}
      <path d={`M${r1(x - 0.12 * w)},${r1(top + 0.3 * ry)}Q${r1(l + 0.02 * w)},${r1(top - 0.5 * ry)} ${r1(l - 0.02 * w)},${r1(top + 0.32 * h)}`} fill="none" stroke={SCENE.woodLight} strokeWidth={0.9 * ss} />
      <rect x={l - 0.12 * w} y={top + 0.32 * h} width={0.2 * w} height={0.17 * h} rx={1.2} fill={mix(SCENE.gold, PAINTS.hvit, 0.35)} stroke={SCENE.outline} strokeWidth={0.6 * ss} />
    </g>
  );
}
