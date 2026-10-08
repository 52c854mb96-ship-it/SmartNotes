/**
 * Egne gjenstander til «Fisjon og kjedereaksjon» (k8-kjedereaksjon): bassenget i en reaktor sett i snitt (betong,
 * vann, reaktorkjerne med brenselsstaver og kontrollstaver som heves og senkes, og blått skjær når reaksjonen går),
 * og kjernen i kontrollstaven som fanger nøytroner. Samme stil som scene-kit-et: toninger fra core.tsx, SCENE-farger,
 * kontur og myk skygge.
 */
import { memo, useMemo } from 'react';
import {
  Atomkjerne,
  LinearGradient,
  RadialGradient,
  SCENE,
  Vann,
  alpha,
  materialStops,
  mix,
  sceneRandom,
  shade,
  tint,
  useStrokeScale,
  useSvgId,
} from '../../kit/scene';

/** Fargen til nøytronene i scene-kit-et (rom.tsx), til banene deres. Følger temaet. */
export const NEUTRON_COLOR = 'var(--sc-rom-noytron)';
/** Kontrollstavene: borkarbid i stålrør, mørk grå. */
export const ROD_COLOR = mix(SCENE.metalDark, SCENE.rubber, 0.55);

const r1 = (v: number) => Math.round(v * 10) / 10;

export type SlotKind = 'brensel' | 'kontroll';

export interface ReaktorGeo {
  x: number;
  y: number;
  w: number;
  h: number;
  /** Gulvet i reaktorhallen (overkanten av betongen). */
  floorY: number;
  /** Bassenget: innsiden av betongveggene. */
  pool: { x1: number; x2: number; bottom: number };
  waterY: number;
  core: { x1: number; x2: number; top: number; bottom: number; cx: number };
  /** Stavene i kjernen fra venstre: midten og typen. */
  slots: { x: number; kind: SlotKind }[];
  slotW: number;
  /** Underkanten av broa over bassenget. */
  bridgeY: number;
  /** Utsnittet som forstørres. */
  zoom: { x: number; y: number; w: number; h: number };
}

const SLOT_KINDS: SlotKind[] = ['brensel', 'brensel', 'kontroll', 'brensel', 'brensel', 'kontroll', 'brensel', 'brensel', 'kontroll', 'brensel', 'brensel'];

/** Målene i reaktorbassenget (x, y er øverste venstre hjørne av hele scenen; w, h størrelsen). */
export function reaktorGeometri(x: number, y: number, w: number, h: number): ReaktorGeo {
  const floorY = y + 0.22 * h;
  const wall = Math.min(0.13 * w, 60);
  const pool = { x1: x + wall, x2: x + w - wall, bottom: y + h - 0.05 * h };
  const pw = pool.x2 - pool.x1;
  const cw = Math.min(0.62 * pw, 1.15 * 0.3 * h);
  const ch = 0.3 * h;
  const cx = (pool.x1 + pool.x2) / 2;
  const coreBottom = pool.bottom - 0.065 * h;
  const core = { x1: cx - cw / 2, x2: cx + cw / 2, top: coreBottom - ch, bottom: coreBottom, cx };
  const slotW = cw / SLOT_KINDS.length;
  const slots = SLOT_KINDS.map((kind, i) => ({ x: core.x1 + (i + 0.5) * slotW, kind }));
  const zoom = { x: core.x1 + 3.55 * slotW, y: core.top + 0.4 * ch, w: 3.9 * slotW, h: 0.36 * ch };
  return { x, y, w, h, floorY, pool, waterY: floorY + 0.035 * h, core, slots, slotW, bridgeY: floorY - 0.05 * h, zoom };
}

/** Hvor langt kontrollstavene står nede i kjernen (0 = helt oppe, 1 = helt nede) for andelen nøytroner de fanger. */
export function rodInsertion(captureFraction: number): number {
  return Math.min(1, Math.max(0, (captureFraction - 0.3) / 0.55));
}

/** Staven med sylindertoning (lys fra venstre). */
function Stav({ x, top, bottom, w, id, ss }: { x: number; top: number; bottom: number; w: number; id: string; ss: number }) {
  return (
    <rect
      x={r1(x - w / 2)}
      y={r1(top)}
      width={r1(w)}
      height={r1(Math.max(0, bottom - top))}
      rx={r1(w * 0.45)}
      fill={`url(#${id})`}
      stroke={SCENE.outline}
      strokeWidth={0.7 * ss}
    />
  );
}

const cylinderStops = (c: string): [number, string][] => [
  [0, shade(c, 0.12)],
  [0.32, tint(c, 0.35)],
  [0.55, c],
  [1, shade(c, 0.38)],
];

/** Betong med tilslag (små steiner) i snittflaten, så den ser skåret ut. */
const Betong = memo(function Betong({ geo }: { geo: ReaktorGeo }) {
  const ss = useStrokeScale();
  const id = useSvgId('kj-betong');
  const { x, w, h, floorY, pool } = geo;
  const bottom = geo.y + h;
  const d = `M${r1(x)},${r1(floorY)}H${r1(pool.x1)}V${r1(pool.bottom)}H${r1(pool.x2)}V${r1(floorY)}H${r1(x + w)}V${r1(bottom)}H${r1(x)}Z`;
  const stones = useMemo(() => {
    const rnd = sceneRandom(11);
    const out: { cx: number; cy: number; r: number; dark: boolean }[] = [];
    for (let i = 0; i < 90; i++) {
      const cx = x + rnd() * w;
      const cy = floorY + 6 + rnd() * (bottom - floorY - 8);
      if (cx > pool.x1 - 2 && cx < pool.x2 + 2 && cy < pool.bottom + 2) continue;
      out.push({ cx, cy, r: 0.8 + rnd() * 1.8, dark: rnd() < 0.5 });
    }
    return out;
  }, [x, w, floorY, bottom, pool.x1, pool.x2, pool.bottom]);
  return (
    <g>
      <LinearGradient id={id} stops={materialStops(SCENE.concrete, 0.7)} />
      <path d={d} fill={`url(#${id})`} />
      {stones.map((s, i) => (
        <circle key={i} cx={r1(s.cx)} cy={r1(s.cy)} r={r1(s.r)} fill={s.dark ? SCENE.concreteDark : tint(SCENE.concrete, 0.35)} opacity={0.75} />
      ))}
      {/* Gulvbelegget oppå betongen */}
      <rect x={r1(x)} y={r1(floorY - 2)} width={r1(pool.x1 - x)} height={4} fill={SCENE.floorDark} />
      <rect x={r1(pool.x2)} y={r1(floorY - 2)} width={r1(x + w - pool.x2)} height={4} fill={SCENE.floorDark} />
      <path d={d} fill="none" stroke={SCENE.outline} strokeWidth={0.9 * ss} />
    </g>
  );
});

/** Rekkverk langs kanten av bassenget. */
function Rekkverk({ x, floorY, h, dir, ss }: { x: number; floorY: number; h: number; dir: 1 | -1; ss: number }) {
  const len = 0.07 * h;
  const posts = [0, 1].map((i) => x - dir * (4 + i * 14));
  const top = floorY - len;
  return (
    <g stroke={SCENE.metalDark} strokeLinecap="round">
      {posts.map((px, i) => (
        <line key={i} x1={r1(px)} y1={r1(floorY - 1)} x2={r1(px)} y2={r1(top)} strokeWidth={2 * ss} />
      ))}
      <line x1={r1(posts[1]! - dir * 4)} y1={r1(top)} x2={r1(posts[0]! + dir * 2)} y2={r1(top)} strokeWidth={2.4 * ss} />
      <line x1={r1(posts[1]!)} y1={r1(top + len * 0.5)} x2={r1(posts[0]!)} y2={r1(top + len * 0.5)} strokeWidth={1.4 * ss} />
    </g>
  );
}

export interface ReaktorbassengProps {
  geo: ReaktorGeo;
  /** Kontrollstavene: 0 = helt oppe, 1 = helt nede i kjernen. */
  innsetting: number;
  /** Det blå skjæret rundt kjernen (0–1), følger effekten. */
  glod: number;
}

/**
 * Reaktorbasseng sett i snitt: hallvegg, betong med bassenget skåret ut, vann, reaktorkjernen med brenselsstaver
 * (lyse) og kontrollstaver (mørke) som henger i et åk og heves og senkes fra drivverket på broa over bassenget.
 */
export function Reaktorbasseng({ geo, innsetting, glod }: ReaktorbassengProps) {
  const ss = useStrokeScale();
  const ids = useSvgId('kj-reaktor');
  const { x, y, w, h, floorY, pool, waterY, core, slots, slotW, bridgeY } = geo;
  const ch = core.bottom - core.top;
  const ins = Math.min(1, Math.max(0, Number.isFinite(innsetting) ? innsetting : 0));
  const tip = core.top + ins * ch;
  const rodTop = tip - ch * 1.02;
  const yokeY = rodTop - 0.012 * h;
  const ctrl = slots.filter((s) => s.kind === 'kontroll');
  const yokeX1 = ctrl[0]!.x - slotW * 0.6;
  const yokeX2 = ctrl[ctrl.length - 1]!.x + slotW * 0.6;
  const motorH = 0.075 * h;
  const motorW = Math.max(26, 2.2 * slotW);
  const g = Math.min(1, Math.max(0, Number.isFinite(glod) ? glod : 0));
  const fuelW = slotW * 0.62;
  const rodW = slotW * 0.7;

  return (
    <g>
      {/* Hallen */}
      <LinearGradient id={`${ids}v`} stops={materialStops(SCENE.wall, 0.6)} />
      <rect x={x} y={y} width={w} height={floorY - y + 2} fill={`url(#${ids}v)`} />
      <rect x={x} y={y} width={w} height={0.04 * h} fill={SCENE.wallShade} opacity={0.5} />

      {/* Bassengveggene over vannflaten og vannet (moderator og kjølevann) */}
      <rect x={pool.x1} y={floorY} width={pool.x2 - pool.x1} height={waterY - floorY + 2} fill={shade(SCENE.concrete, 0.12)} />
      <Vann x={pool.x1} y={waterY} w={pool.x2 - pool.x1} h={pool.bottom - waterY} />

      {/* Kjernen: bunnplate på bein, staver og topplate */}
      <LinearGradient id={`${ids}f`} x2={1} y2={0} stops={cylinderStops(SCENE.metal)} />
      <LinearGradient id={`${ids}k`} x2={1} y2={0} stops={cylinderStops(ROD_COLOR)} />
      <LinearGradient id={`${ids}p`} stops={materialStops(SCENE.metalDark, 0.8)} />
      {[core.x1 + slotW * 0.6, core.x2 - slotW * 0.6].map((lx, i) => (
        <rect key={i} x={r1(lx - 3)} y={r1(core.bottom)} width={6} height={r1(pool.bottom - core.bottom)} fill={SCENE.metalDark} stroke={SCENE.outline} strokeWidth={0.6 * ss} />
      ))}
      {slots
        .filter((s) => s.kind === 'brensel')
        .map((s, i) => (
          <Stav key={i} x={s.x} top={core.top - 0.012 * h} bottom={core.bottom} w={fuelW} id={`${ids}f`} ss={ss} />
        ))}
      {/* Kontrollstavene i åket, med drivstanga opp til broa */}
      <rect x={r1(core.cx - 2)} y={r1(bridgeY)} width={4} height={r1(Math.max(0, yokeY - bridgeY))} fill={SCENE.metal} stroke={SCENE.outline} strokeWidth={0.5 * ss} />
      {ctrl.map((s, i) => (
        <Stav key={i} x={s.x} top={rodTop} bottom={tip} w={rodW} id={`${ids}k`} ss={ss} />
      ))}
      <rect
        x={r1(yokeX1)}
        y={r1(yokeY - 3)}
        width={r1(yokeX2 - yokeX1)}
        height={6}
        rx={2}
        fill={`url(#${ids}p)`}
        stroke={SCENE.outline}
        strokeWidth={0.7 * ss}
      />
      {/* Plater oppe og nede */}
      <rect x={r1(core.x1)} y={r1(core.bottom - 1)} width={r1(core.x2 - core.x1)} height={7} rx={1.5} fill={`url(#${ids}p)`} stroke={SCENE.outline} strokeWidth={0.7 * ss} />
      <rect x={r1(core.x1)} y={r1(core.top - 0.02 * h)} width={r1(core.x2 - core.x1)} height={5} rx={1.5} fill={`url(#${ids}p)`} stroke={SCENE.outline} strokeWidth={0.7 * ss} opacity={0.9} />

      {/* Litt vann foran kjernen, så den ser ut til å stå under vann */}
      <rect x={pool.x1} y={r1(waterY)} width={r1(pool.x2 - pool.x1)} height={r1(pool.bottom - waterY)} fill={alpha(SCENE.water, 0.2)} />

      {/* Blått skjær rundt kjernen når kjedereaksjonen går */}
      {g > 0.01 && (
        <>
          <RadialGradient
            id={`${ids}g`}
            stops={[
              [0, tint(SCENE.cold, 0.55), 0.95],
              [0.45, SCENE.cold, 0.55],
              [1, SCENE.cold, 0],
            ]}
          />
          <clipPath id={`${ids}c`}>
            <rect x={pool.x1} y={waterY} width={pool.x2 - pool.x1} height={pool.bottom - waterY} />
          </clipPath>
          <ellipse
            clipPath={`url(#${ids}c)`}
            cx={r1(core.cx)}
            cy={r1((core.top + core.bottom) / 2)}
            rx={r1((core.x2 - core.x1) * (0.75 + 0.25 * g))}
            ry={r1(ch * (0.78 + 0.3 * g))}
            fill={`url(#${ids}g)`}
            opacity={r1(0.25 + 0.75 * g)}
          />
        </>
      )}

      <Betong geo={geo} />
      <Rekkverk x={pool.x1} floorY={floorY} h={h} dir={1} ss={ss} />
      <Rekkverk x={pool.x2} floorY={floorY} h={h} dir={-1} ss={ss} />

      {/* Broa over bassenget med drivverket til kontrollstavene */}
      <LinearGradient id={`${ids}b`} stops={materialStops(SCENE.metal, 0.9)} />
      <rect
        x={r1(pool.x1 - 0.04 * w)}
        y={r1(bridgeY - 7)}
        width={r1(pool.x2 - pool.x1 + 0.08 * w)}
        height={7}
        rx={1.5}
        fill={`url(#${ids}b)`}
        stroke={SCENE.outline}
        strokeWidth={0.8 * ss}
      />
      {[pool.x1 - 0.03 * w, pool.x2 + 0.03 * w].map((bx, i) => (
        <rect key={i} x={r1(bx - 3)} y={r1(bridgeY)} width={6} height={r1(floorY - bridgeY - 1)} fill={SCENE.metalDark} />
      ))}
      <rect
        x={r1(core.cx - motorW / 2)}
        y={r1(bridgeY - 7 - motorH)}
        width={r1(motorW)}
        height={r1(motorH)}
        rx={3}
        fill={`url(#${ids}p)`}
        stroke={SCENE.outline}
        strokeWidth={0.8 * ss}
      />
      <rect x={r1(core.cx - motorW * 0.3)} y={r1(bridgeY - 7 - motorH * 0.72)} width={r1(motorW * 0.6)} height={r1(motorH * 0.3)} rx={1.5} fill={SCENE.display} />
      <circle cx={r1(core.cx + motorW * 0.18)} cy={r1(bridgeY - 7 - motorH * 0.57)} r={1.6} fill={g > 0.01 ? SCENE.cold : SCENE.metal} />
      {/* Vannflaten over alt som står under vann */}
      <line x1={pool.x1} y1={r1(waterY)} x2={pool.x2} y2={r1(waterY)} stroke={alpha(SCENE.highlight, 0.7)} strokeWidth={1.2 * ss} />
    </g>
  );
}

/** Ramme rundt utsnittet som forstørres, med lys kant så den synes oppå vann og staver. */
export function ZoomRamme({ x, y, w, h, color }: { x: number; y: number; w: number; h: number; color: string }) {
  const ss = useStrokeScale();
  return (
    <g fill="none">
      <rect x={r1(x)} y={r1(y)} width={r1(w)} height={r1(h)} rx={3} stroke={alpha(SCENE.highlight, 0.9)} strokeWidth={4 * ss} />
      <rect x={r1(x)} y={r1(y)} width={r1(w)} height={r1(h)} rx={3} stroke={color} strokeWidth={1.7 * ss} />
    </g>
  );
}

/**
 * Kjerne i kontrollstaven som fanger nøytroner: en bor-10-kjerne på en mørk flekk i stavens farge. Ankerpunkt: sentrum.
 * `r` er radien til flekken; kjernen er litt mindre.
 */
export const Kontrollstavkjerne = memo(function Kontrollstavkjerne({ x, y, r, seed = 1 }: { x: number; y: number; r: number; seed?: number }) {
  const ss = useStrokeScale();
  const id = useSvgId('kj-bor');
  // Bor-10 har 5 protoner og 5 nøytroner: kjernen blir ca. 3,4 · nukleonradien.
  const rn = (0.66 * r) / 3.37;
  return (
    <g>
      <RadialGradient
        id={id}
        fx={0.38}
        fy={0.34}
        stops={[
          [0, tint(ROD_COLOR, 0.18)],
          [0.7, ROD_COLOR],
          [1, shade(ROD_COLOR, 0.3)],
        ]}
      />
      <circle cx={r1(x)} cy={r1(y)} r={r1(r)} fill={`url(#${id})`} stroke={SCENE.outline} strokeWidth={0.7 * ss} />
      <Atomkjerne x={x} y={y} Z={5} N={5} r={rn} seed={seed} tegn={false} />
    </g>
  );
});

/** Lysglimt der en kjerne spaltes: energien som frigjøres. `styrke` 0–1 (avtar etter spaltingen). */
export function Fisjonsglimt({ x, y, r, styrke }: { x: number; y: number; r: number; styrke: number }) {
  const id = useSvgId('kj-glimt');
  if (!(styrke > 0.01)) return null;
  return (
    <g pointerEvents="none">
      <RadialGradient
        id={id}
        stops={[
          [0, tint(SCENE.glow, 0.6), 1],
          [0.35, SCENE.glow, 0.75],
          [1, SCENE.hot, 0],
        ]}
      />
      <circle cx={r1(x)} cy={r1(y)} r={r1(r * (0.7 + 0.5 * (1 - styrke)))} fill={`url(#${id})`} opacity={r1(styrke)} />
    </g>
  );
}

/** Fargen til urankjerner som ikke er i fokus (blanding av proton- og nøytronfargen i scene-kit-et). */
export const URAN_COLOR = mix('var(--sc-rom-noytron)', 'var(--sc-rom-proton)', 0.4);

/**
 * Urankjerner i bakgrunnen av utsnittet (de fleste er U-238): enkle, uskarpe kuler, så treet står fram. Memoisert, så
 * de tegnes bare når treet eller størrelsen endres.
 */
export const Bakgrunnskjerner = memo(function Bakgrunnskjerner({ points, r }: { points: { x: number; y: number }[]; r: number }) {
  const id = useSvgId('kj-bakgrunn');
  return (
    <g opacity={0.36} aria-hidden>
      <RadialGradient
        id={id}
        fx={0.38}
        fy={0.34}
        stops={[
          [0, tint(URAN_COLOR, 0.35)],
          [0.65, URAN_COLOR],
          [0.92, shade(URAN_COLOR, 0.2)],
          [1, shade(URAN_COLOR, 0.2), 0],
        ]}
      />
      {points.map((p, i) => (
        <circle key={i} cx={r1(p.x)} cy={r1(p.y)} r={r1(r)} fill={`url(#${id})`} />
      ))}
    </g>
  );
});
