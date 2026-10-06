/**
 * Egne gjenstander til «Arbeid og effekt i trappa», tegnet i samme stil som scene-kit-et (toninger fra core.tsx,
 * SCENE-farger, tynn kontur, myk skygge og lys fra øvre venstre): steintrappa, rekkverket, varden på toppen, og
 * små apparater til effektdiagrammet (LED-pære, mikrobølgeovn og en stol).
 */
import { memo } from 'react';
import {
  ContactShadow,
  LinearGradient,
  PAINTS,
  RadialGradient,
  SCENE,
  materialStops,
  mix,
  sceneRandom,
  shade,
  sphereStops,
  tint,
  useStrokeScale,
  useSvgId,
} from '../../kit/scene';
import type { StairGeom, StairLayout } from './trappelop-scene';

const r2 = (v: number) => Math.round(v * 100) / 100;

/**
 * Steintrapp (sherpatrapp) bygd inn i lia: én kantet steinblokk per trinn, med litt ulik farge og en lys kant der
 * foten treffer. Tegnes med kameraet nederst (figurens koordinater for c = 0); kameraet flytter hele gruppen.
 * Trinn i har forkanten i x = xs + i · run · S og toppen i y = yBot − (i + 1) · rise · S.
 */
export const Steintrapp = memo(function Steintrapp({ g, lay, S }: { g: StairGeom; lay: StairLayout; S: number }) {
  const ss = useStrokeScale();
  const shadeId = useSvgId('tr-stein');
  const { xs, yBot } = lay;
  const rise = g.rise * S;
  const run = g.run * S;
  const rnd = sceneRandom(17);
  const blocks: { d: string; fill: string; top: string }[] = [];
  for (let i = 0; i < g.n; i++) {
    const v = rnd();
    const w = rnd();
    const x0 = xs + i * run - 0.5;
    const x1 = xs + (i + 1) * run + 0.9;
    const yTop = yBot - (i + 1) * rise;
    const y1 = yBot - i * rise + 2.5;
    // Blokka er litt avrundet på forkanten (slitt stein) og nesten rett bak, der neste blokk ligger oppå.
    const rr = Math.min(1.6, rise * 0.3);
    const d = `M${r2(x0)},${r2(y1)} L${r2(x0)},${r2(yTop + rr)} Q${r2(x0)},${r2(yTop)} ${r2(x0 + rr)},${r2(yTop)} L${r2(x1)},${r2(yTop)} L${r2(x1)},${r2(y1)} Z`;
    const base = w < 0.3 ? mix(SCENE.stone, SCENE.gravel, 0.35) : SCENE.stone;
    blocks.push({ d, fill: mix(base, SCENE.stoneDark, 0.08 + v * 0.42), top: `M${r2(x0 + rr)},${r2(yTop + 0.6)} L${r2(x1 - 0.6)},${r2(yTop + 0.6)}` });
  }
  // Skyggen fra hvert trinn faller litt ned på forsiden av trinnet under (lys fra øvre venstre).
  return (
    <g aria-hidden>
      <LinearGradient
        id={shadeId}
        x2={1}
        y2={0}
        stops={[
          [0, SCENE.highlight, 0.32],
          [0.35, SCENE.highlight, 0],
          [1, SCENE.shadow, 0.35],
        ]}
      />
      {blocks.map((b, i) => (
        <g key={i}>
          <path d={b.d} fill={b.fill} />
          <path d={b.d} fill={`url(#${shadeId})`} stroke={SCENE.outline} strokeWidth={0.7 * ss} strokeLinejoin="round" />
          <path d={b.top} stroke={tint(SCENE.stone, 0.55)} strokeWidth={Math.max(0.8, rise * 0.16) * ss} strokeLinecap="round" opacity={0.85} />
        </g>
      ))}
    </g>
  );
});

/**
 * Rekkverk i galvanisert stål langs trappa og et stykke inn på toppen: stolper (ca. hver 1,6 m) og en rund
 * håndlist 0,9 m over trinnene. Står på den andre siden av trappa, så det tegnes før løperen.
 */
export const Rekkverk = memo(function Rekkverk({ g, lay, S, topLength = 2.2 }: { g: StairGeom; lay: StairLayout; S: number; topLength?: number }) {
  const ss = useStrokeScale();
  const { xs, yBot } = lay;
  const tan = g.rise / g.run;
  const railH = 0.9;
  /** Trinnflaten (forkanten av trinnet) under x (m). */
  const tread = (x: number) => (x >= g.L ? g.h : Math.min(g.h, (Math.floor(x / g.run) + 1) * g.rise));
  const X = (x: number) => xs + x * S;
  const Y = (y: number) => yBot - y * S;
  const count = Math.max(1, Math.round(g.L / 1.6));
  const posts: number[] = [];
  for (let i = 0; i <= count; i++) posts.push(0.12 + ((g.L - 0.24) * i) / count);
  posts.push(g.L + topLength);
  // Håndlista følger linja gjennom forkantene av trinnene, 0,9 m over, og går vannrett inn på toppen.
  const railY = (x: number) => (x >= g.L ? g.h + railH : x * tan + g.rise + railH);
  const pts = [
    [X(0.12), Y(railY(0.12))],
    [X(g.L - 0.05), Y(railY(g.L - 0.05))],
    [X(g.L + 0.35), Y(g.h + railH)],
    [X(g.L + topLength), Y(g.h + railH)],
  ];
  const rail = pts.map(([x, y], i) => `${i ? 'L' : 'M'}${r2(x!)},${r2(y!)}`).join(' ');
  const w = Math.max(1.4, 0.045 * S) * ss;
  return (
    <g aria-hidden>
      {posts.map((x, i) => (
        <g key={i}>
          <line x1={X(x)} y1={Y(tread(x))} x2={X(x)} y2={Y(railY(x))} stroke={SCENE.outline} strokeWidth={w + 1.2 * ss} strokeLinecap="round" />
          <line x1={X(x)} y1={Y(tread(x))} x2={X(x)} y2={Y(railY(x))} stroke={SCENE.metal} strokeWidth={w} strokeLinecap="round" />
        </g>
      ))}
      <path d={rail} fill="none" stroke={SCENE.outline} strokeWidth={w * 1.25 + 1.2 * ss} strokeLinecap="round" strokeLinejoin="round" />
      <path d={rail} fill="none" stroke={SCENE.metal} strokeWidth={w * 1.25} strokeLinecap="round" strokeLinejoin="round" />
      <path d={rail} fill="none" stroke={SCENE.metalLight} strokeWidth={w * 0.4} strokeLinecap="round" strokeLinejoin="round" opacity={0.8} transform="translate(0 -0.6)" />
      {/* Mellomlist halvveis */}
      <path
        d={pts.map(([x, y], i) => `${i ? 'L' : 'M'}${r2(x!)},${r2(y! + railH * 0.5 * S)}`).join(' ')}
        fill="none"
        stroke={SCENE.metalDark}
        strokeWidth={w * 0.7}
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity={0.85}
      />
    </g>
  );
});

/**
 * Varde: stein lagt i en smal haug, som på en fjelltopp. (x, y) er midt på bakken, `size` er høyden.
 */
export const Varde = memo(function Varde({ x, y, size }: { x: number; y: number; size: number }) {
  const ss = useStrokeScale();
  const id = useSvgId('tr-varde');
  const rnd = sceneRandom(5);
  const stones: { cx: number; cy: number; rx: number; ry: number; c: string }[] = [];
  const rows = 6;
  for (let r = 0; r < rows; r++) {
    const t = r / (rows - 1);
    const width = size * (0.62 - 0.4 * t);
    const ry = size * (0.095 - 0.025 * t);
    const cy = y - size * 0.07 - (size * 0.86 * r) / (rows - 1);
    const n = r < 2 ? 3 : r < 4 ? 2 : 1;
    for (let i = 0; i < n; i++) {
      const cx = x + (n === 1 ? 0 : (i / (n - 1) - 0.5) * width * 0.62) + (rnd() - 0.5) * size * 0.05;
      const rx = (width / n) * (0.55 + rnd() * 0.12);
      stones.push({ cx, cy: cy + (rnd() - 0.5) * size * 0.03, rx, ry: ry * (0.9 + rnd() * 0.25), c: mix(SCENE.stone, SCENE.stoneDark, 0.1 + rnd() * 0.45) });
    }
  }
  return (
    <g aria-hidden>
      <RadialGradient
        id={id}
        fx={0.32}
        fy={0.28}
        stops={[
          [0, SCENE.highlight, 0.4],
          [0.5, SCENE.highlight, 0],
          [1, SCENE.shadow, 0.5],
        ]}
      />
      <ContactShadow cx={x + size * 0.05} cy={y} rx={size * 0.42} />
      {stones.map((s, i) => (
        <g key={i}>
          <ellipse cx={s.cx} cy={s.cy} rx={s.rx} ry={s.ry} fill={s.c} stroke={SCENE.outline} strokeWidth={0.7 * ss} />
          <ellipse cx={s.cx} cy={s.cy} rx={s.rx} ry={s.ry} fill={`url(#${id})`} />
          <path
            d={`M${r2(s.cx - s.rx * 0.6)},${r2(s.cy - s.ry * 0.45)} Q${r2(s.cx - s.rx * 0.1)},${r2(s.cy - s.ry * 0.95)} ${r2(s.cx + s.rx * 0.45)},${r2(s.cy - s.ry * 0.6)}`}
            fill="none"
            stroke={tint(SCENE.stone, 0.5)}
            strokeWidth={0.9 * ss}
            strokeLinecap="round"
            opacity={0.8}
          />
        </g>
      ))}
    </g>
  );
});

/* ---------- Små apparater til effektdiagrammet ---------- */

/**
 * LED-pære (E27) sett fra siden: matt, melkehvit kuppel, hvit hals med kjøleribber og sokkel i messing.
 * (x, y) er bunnen av sokkelen, `size` er høyden. `paa` gir et svakt, kaldt skjær rundt kuppelen.
 */
export function LedPaere({ x, y, size, paa = true }: { x: number; y: number; size: number; paa?: boolean }) {
  const ss = useStrokeScale();
  const id = useSvgId('tr-led');
  const k = size / 100;
  const P = (a: number, b: number) => `${r2(x + a * k)},${r2(y - b * k)}`;
  const dome = `M${P(-17, 58)} C${P(-34, 62)} ${P(-36, 98)} ${P(0, 100)} C${P(36, 98)} ${P(34, 62)} ${P(17, 58)} Z`;
  const neck = `M${P(-17, 58)} L${P(17, 58)} L${P(13, 30)} L${P(-13, 30)} Z`;
  return (
    <g aria-hidden>
      <RadialGradient id={`${id}g`} fx={0.35} fy={0.3} stops={sphereStops(PAINTS.hvit)} />
      <LinearGradient id={`${id}n`} x2={1} y2={0} stops={materialStops(tint(SCENE.metalLight, 0.3))} />
      <LinearGradient id={`${id}s`} x2={1} y2={0} stops={materialStops(SCENE.gold)} />
      {paa && <circle cx={x} cy={y - 80 * k} r={34 * k} fill={SCENE.glow} opacity={0.35} />}
      <path d={dome} fill={`url(#${id}g)`} stroke={SCENE.outline} strokeWidth={0.8 * ss} />
      <path d={neck} fill={`url(#${id}n)`} stroke={SCENE.outline} strokeWidth={0.8 * ss} strokeLinejoin="round" />
      {[38, 46, 53].map((b) => (
        <path key={b} d={`M${P(-15 + (58 - b) * 0.14, b)} L${P(15 - (58 - b) * 0.14, b)}`} stroke={shade(SCENE.metalLight, 0.25)} strokeWidth={0.8 * ss} />
      ))}
      <rect x={x - 11 * k} y={y - 30 * k} width={22 * k} height={24 * k} rx={2 * k} fill={`url(#${id}s)`} stroke={SCENE.outline} strokeWidth={0.7 * ss} />
      {[24, 17, 10].map((b) => (
        <path key={b} d={`M${P(-11, b)} L${P(11, b - 3)}`} stroke={shade(SCENE.gold, 0.35)} strokeWidth={0.9 * ss} />
      ))}
      <path d={`M${P(-6, 6)} L${P(6, 6)} L${P(3, 0)} L${P(-3, 0)} Z`} fill={SCENE.metalDark} />
    </g>
  );
}

/**
 * Mikrobølgeovn sett forfra: hvitt kabinett, mørk glassdør med hank og et kontrollpanel med display og to knapper.
 * (x, y) er midt på bunnen, `w` er bredden (høyden er ca. 0,58 · w).
 */
export function Mikrobolgeovn({ x, y, w, paa = true }: { x: number; y: number; w: number; paa?: boolean }) {
  const ss = useStrokeScale();
  const id = useSvgId('tr-mikro');
  const h = w * 0.58;
  const left = x - w / 2;
  const top = y - h;
  const door = { x: left + w * 0.06, y: top + h * 0.1, w: w * 0.62, h: h * 0.8 };
  const panelX = left + w * 0.75;
  return (
    <g aria-hidden>
      <LinearGradient id={`${id}k`} stops={materialStops(PAINTS.hvit, 0.8)} />
      <LinearGradient
        id={`${id}d`}
        x2={1}
        y2={1}
        stops={[
          [0, shade(SCENE.glassEdge, 0.55)],
          [1, shade(SCENE.glassEdge, 0.8)],
        ]}
      />
      <ContactShadow cx={x} cy={y} rx={w * 0.55} />
      {/* Føtter */}
      <rect x={left + w * 0.08} y={y - 2} width={w * 0.1} height={2.5} rx={1} fill={SCENE.rubber} />
      <rect x={left + w * 0.82} y={y - 2} width={w * 0.1} height={2.5} rx={1} fill={SCENE.rubber} />
      <rect x={left} y={top} width={w} height={h - 1.5} rx={w * 0.05} fill={`url(#${id}k)`} stroke={SCENE.outline} strokeWidth={0.9 * ss} />
      <rect x={door.x} y={door.y} width={door.w} height={door.h} rx={w * 0.025} fill={`url(#${id}d)`} stroke={SCENE.outline} strokeWidth={0.7 * ss} />
      {paa && <rect x={door.x + door.w * 0.12} y={door.y + door.h * 0.16} width={door.w * 0.76} height={door.h * 0.68} rx={w * 0.02} fill={SCENE.glow} opacity={0.42} />}
      {/* Glans på glasset */}
      <path
        d={`M${r2(door.x + door.w * 0.1)},${r2(door.y + door.h * 0.75)} L${r2(door.x + door.w * 0.35)},${r2(door.y + door.h * 0.12)}`}
        stroke={SCENE.highlight}
        strokeWidth={1.2 * ss}
        strokeLinecap="round"
        opacity={0.5}
      />
      <line x1={door.x + door.w - w * 0.035} y1={door.y + door.h * 0.2} x2={door.x + door.w - w * 0.035} y2={door.y + door.h * 0.8} stroke={SCENE.metalLight} strokeWidth={Math.max(1.4, w * 0.035) * ss} strokeLinecap="round" />
      {/* Kontrollpanel */}
      <rect x={panelX} y={top + h * 0.14} width={w * 0.17} height={h * 0.18} rx={w * 0.015} fill={SCENE.display} />
      <rect x={panelX + w * 0.025} y={top + h * 0.19} width={w * 0.12} height={h * 0.08} rx={w * 0.01} fill={SCENE.displayText} opacity={0.75} />
      <circle cx={panelX + w * 0.085} cy={top + h * 0.5} r={w * 0.055} fill={tint(SCENE.metal, 0.3)} stroke={SCENE.outline} strokeWidth={0.6 * ss} />
      <circle cx={panelX + w * 0.085} cy={top + h * 0.73} r={w * 0.055} fill={tint(SCENE.metal, 0.3)} stroke={SCENE.outline} strokeWidth={0.6 * ss} />
    </g>
  );
}

/** Enkel trestol sett fra siden med setet i (x, y) og beina ned til `floor`; `k` = størrelsen på personen / 100. */
export function Stol({ x, y, k, floor }: { x: number; y: number; k: number; floor: number }) {
  const ss = useStrokeScale();
  return (
    <g stroke={SCENE.outline} strokeWidth={0.8 * ss} aria-hidden>
      <line x1={x - 10 * k} y1={y} x2={x - 10 * k} y2={floor} strokeWidth={2.6 * k} stroke={SCENE.woodDark} />
      <line x1={x + 9 * k} y1={y} x2={x + 9 * k} y2={floor} strokeWidth={2.6 * k} stroke={SCENE.woodDark} />
      <rect x={x - 13 * k} y={y - 31 * k} width={2.8 * k} height={31 * k} rx={1} fill={SCENE.woodDark} />
      <rect x={x - 13 * k} y={y - 0.5 * k} width={24 * k} height={3.2 * k} rx={1} fill={SCENE.wood} />
    </g>
  );
}
