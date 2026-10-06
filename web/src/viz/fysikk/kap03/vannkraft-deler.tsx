/**
 * Egne gjenstander til «Vannkraftverk», tegnet i samme stil som scene-kit-et (toninger fra core.tsx, SCENE- og
 * PAINTS-farger, tynn kontur, myk skygge og lys fra øvre venstre): betongdemning, rørgate i snitt med vann som
 * renner, kraftstasjon i snitt med turbin og generator, kraftmast med linjer, og norske trehus.
 * Scene-kit-et har ingen av disse, så de ligger her i kapittelmappa.
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
  tint,
  useStrokeScale,
  useSvgId,
  type PaintName,
} from '../../kit/scene';
import { ROOF_PITCH, polylineLength, pointAlong, terrainY, type Dam, type Pt } from './vannkraft-scene';

const r1 = (v: number) => Math.round(v * 10) / 10;
const pts = (p: Pt[]) => p.map(([x, y], i) => `${i ? 'L' : 'M'}${r1(x)},${r1(y)}`).join('');
const poly = (p: Pt[]) => `${pts(p)}Z`;
const circlePath = (cx: number, cy: number, r: number) => `M${r1(cx - r)},${r1(cy)}a${r},${r} 0 1 0 ${2 * r},0a${r},${r} 0 1 0 ${-2 * r},0`;

/** Betong i demningen, fundamentene og stasjonen. */
const CONCRETE = SCENE.concrete;
/** Lakken på turbinen og generatoren (dempet blå, ikke en VIZ-farge). */
const MACHINE = mix(PAINTS.blaa, SCENE.metal, 0.45);
/** Vinduer: lyseblått glass om dagen, tente vinduer i skumringen (samme variabel som husene i Landskap). */
const WINDOW = 'var(--sc-bakgrunn-vindu)';

/* ---------------------------------------------------------------- Fjellet i snitt */

/** Terrengprofilen flyttet `d` ned (laget under overflaten). */
function offsetDown(p: Pt[], d: number, wobble = 0, seed = 1): Pt[] {
  const rnd = sceneRandom(seed);
  const phase = rnd() * 6;
  return p.map(([x, y]) => [x, y + d + (wobble ? Math.sin(x / 37 + phase) * wobble : 0)]);
}

/**
 * Fjellet i snitt, som kraftstasjonen og rørgata: torv og gress på overflaten (fra Terreng), et tynt lag jord og
 * så fast fjell med lag (sprekker omtrent parallelt med overflaten) og noen loddrette sprekker. Høyt oppe er
 * fjellet lysere (bart fjell), lenger ned mørkere. Klippes til terrenget. Tegnes rett etter Terreng.
 *
 * Det lyse øverst kommer fra himmelen (SCENE.skyBottom), ikke fra snøfargen: om dagen blir fjellet lyst grått som
 * før, og i skumringen (mørkt tema) tar det farge av den mørke kveldshimmelen og blir dempet som resten av scenen,
 * i stedet for å lyse som betong eller snø. Nederst blandes det litt mot skyggen i fjellene i bakgrunnen.
 */
export const FjellSnitt = memo(function FjellSnitt({
  terrain,
  top,
  bottom,
  k = 1,
  seed = 7,
}: {
  terrain: Pt[];
  /** Det høyeste punktet i fjellet (til toningen). */
  top: number;
  bottom: number;
  k?: number;
  seed?: number;
}) {
  const ss = useStrokeScale();
  const id = useSvgId('vk-fjell');
  const first = terrain[0]!;
  const last = terrain[terrain.length - 1]!;
  const close = (p: Pt[]) => `${pts(p)}L${r1(last[0])},${r1(bottom + 30)}L${r1(first[0])},${r1(bottom + 30)}Z`;
  const soil = offsetDown(terrain, 5 * k);
  const rock = offsetDown(terrain, 11.5 * k, 1.5 * k, seed);
  // Lag i fjellet: brutte linjer omtrent parallelt med overflaten
  const strata = [30, 62, 100, 146, 200, 262].map((d, i) => pts(offsetDown(terrain, d * k, 4 * k, seed + i)));
  // Loddrette sprekker
  const rnd = sceneRandom(seed + 50);
  const cracks: string[] = [];
  const minX = first[0];
  const maxX = last[0];
  for (let i = 0; i < 26; i++) {
    const x = minX + rnd() * (maxX - minX);
    const yTop = terrainY(terrain, x) + (16 + rnd() * 120) * k;
    if (yTop > bottom) continue;
    const len = (8 + rnd() * 16) * k;
    cracks.push(`M${r1(x)},${r1(yTop)}l${r1((rnd() - 0.5) * 6)},${r1(len)}`);
  }
  return (
    <g aria-hidden>
      <defs>
        <clipPath id={`${id}c`}>
          <path d={close(terrain)} />
        </clipPath>
      </defs>
      <LinearGradient
        id={`${id}r`}
        userSpace
        x1={0}
        y1={top}
        x2={0}
        y2={bottom}
        stops={[
          [0, mix(SCENE.stone, SCENE.skyBottom, 0.38)],
          [0.45, mix(SCENE.stone, SCENE.skyBottom, 0.15)],
          [1, mix(mix(SCENE.stone, SCENE.stoneDark, 0.35), SCENE.mountainShade, 0.25)],
        ]}
      />
      <g clipPath={`url(#${id}c)`}>
        <path d={close(soil)} fill={mix(SCENE.soil, SCENE.grassDark, 0.25)} />
        <path d={close(rock)} fill={`url(#${id}r)`} />
        <path d={pts(rock)} fill="none" stroke={shade(SCENE.soil, 0.25)} strokeWidth={1 * ss} opacity={0.6} />
        <path
          d={strata.join('')}
          fill="none"
          stroke={shade(SCENE.stoneDark, 0.15)}
          strokeWidth={0.8 * ss}
          strokeDasharray={`${r1(54 * k)} ${r1(16 * k)} ${r1(26 * k)} ${r1(22 * k)}`}
          opacity={0.35}
        />
        <path d={cracks.join('')} fill="none" stroke={shade(SCENE.stoneDark, 0.15)} strokeWidth={0.7 * ss} opacity={0.4} strokeLinecap="round" />
      </g>
    </g>
  );
});

/* ---------------------------------------------------------------- Demningen */

/**
 * Betongdemning sett fra siden (i snitt): loddrett side mot magasinet, skrå side nedstrøms, gangbane med rekkverk
 * på kronen og støpeskjøter. Tegnes etter vannet i magasinet og rørgata (røret går gjennom foten). Uten `rekkverk`
 * blir den en lav terskel i et bekkeinntak.
 */
export const Demning = memo(function Demning({ dam, rekkverk = true }: { dam: Dam; rekkverk?: boolean }) {
  const ss = useStrokeScale();
  const id = useSvgId('vk-dam');
  const { x, crestY, baseY, crestW, toeX, face } = dam;
  const H = baseY - crestY;
  const outline: Pt[] = [
    [x - 2, baseY + 3],
    [x - 1, crestY + 2],
    [x, crestY],
    [x + crestW, crestY],
    [toeX, baseY],
    [toeX + 4, baseY + 3],
  ];
  // Støpeskjøter: vannrette linjer hver 8. px, fra den loddrette siden til den skrå
  const joints: string[] = [];
  for (let y = crestY + 8; y < baseY - 3; y += 8) {
    const xr = x + crestW + face * (y - crestY);
    joints.push(`M${r1(x + 1)},${r1(y)}L${r1(xr - 1)},${r1(y)}`);
  }
  // Rekkverket på kronen
  const railH = 5;
  const posts: string[] = [];
  for (let px = x + 1.5; px <= x + crestW - 1; px += Math.max(3, (crestW - 3) / 2)) posts.push(`M${r1(px)},${r1(crestY)}V${r1(crestY - railH)}`);
  return (
    <g aria-hidden>
      <LinearGradient
        id={`${id}a`}
        x2={1}
        y2={0}
        stops={[
          [0, tint(CONCRETE, 0.18)],
          [0.4, CONCRETE],
          [1, shade(CONCRETE, 0.22)],
        ]}
      />
      <LinearGradient
        id={`${id}b`}
        stops={[
          [0, SCENE.shadow, 0],
          [0.7, SCENE.shadow, 0.12],
          [1, SCENE.shadow, 0.3],
        ]}
      />
      <path d={poly(outline)} fill={`url(#${id}a)`} />
      <path d={poly(outline)} fill={`url(#${id}b)`} />
      <path d={joints.join('')} stroke={shade(CONCRETE, 0.3)} strokeWidth={0.7 * ss} opacity={0.55} />
      {/* Våte striper nedover den skrå siden */}
      <path
        d={`M${r1(x + crestW + face * H * 0.25)},${r1(crestY + H * 0.25)}l${r1(face * H * 0.5)},${r1(H * 0.5)}`}
        stroke={shade(CONCRETE, 0.35)}
        strokeWidth={2.4 * ss}
        opacity={0.25}
        strokeLinecap="round"
      />
      <path d={poly(outline)} fill="none" stroke={SCENE.outline} strokeWidth={0.9 * ss} strokeLinejoin="round" />
      {/* Kronen: lys kant og rekkverk */}
      <path d={`M${r1(x)},${r1(crestY + 0.8)}H${r1(x + crestW)}`} stroke={tint(CONCRETE, 0.5)} strokeWidth={1.4 * ss} />
      {rekkverk && <path d={posts.join('')} stroke={SCENE.metalDark} strokeWidth={0.9 * ss} />}
      {rekkverk && <path d={`M${r1(x)},${r1(crestY - railH)}H${r1(x + crestW)}`} stroke={SCENE.metalDark} strokeWidth={1.1 * ss} strokeLinecap="round" />}
    </g>
  );
});

/* ---------------------------------------------------------------- Bekken */

/** Høyden på vannet i bekken over bunnen (px) langs bekken: jevn, men tynnere helt nederst der den møter dammen. */
function streamDepth(s: number, k: number): number {
  return (s < 0.85 ? 4 : 4 - 2.6 * ((s - 0.85) / 0.15)) * k;
}

/**
 * Bekken som renner ned mot inntaksdammen, i snitt: et tynt lag vann oppå bekkeleiet (`bed`, fra venstre kant ned
 * til dammen), med lys overflate, krusninger som renner nedover (med `t`) og noen runde steiner i og ved bekken.
 * Tegnes etter terrenget og fjellsnittet.
 */
export const Bekk = memo(function Bekk({ bed, t, k = 1, seed = 3 }: { bed: Pt[]; t: number; k?: number; seed?: number }) {
  const ss = useStrokeScale();
  const id = useSvgId('vk-bekk');
  if (bed.length < 2) return null;
  const L = polylineLength(bed);
  const total = L[L.length - 1] ?? 1;
  const top: Pt[] = bed.map(([x, y], i) => [x, y - streamDepth((L[i] ?? 0) / total, k)]);
  const bottom = bed.map(([x, y]): Pt => [x, y + 1.2]).reverse();
  const water = poly([...top, ...bottom]);
  // Steiner i bekken: delvis under vann, med lys fra øvre venstre
  const rnd = sceneRandom(seed);
  const stones = [0.16, 0.47, 0.74].map((f, i) => {
    const a = pointAlong(bed, f * total);
    const r = (i === 1 ? 6.5 : 4.8 + rnd() * 1.4) * k;
    return { x: a.x + (rnd() - 0.5) * 6, y: a.y + 0.6, r };
  });
  const dash = 7 * k;
  const period = 19 * k;
  const offset = -((t * 22) % period);
  return (
    <g aria-hidden>
      <LinearGradient
        id={`${id}s`}
        x2={0.6}
        y2={1}
        stops={[
          [0, tint(SCENE.stone, 0.22)],
          [0.55, SCENE.stone],
          [1, shade(SCENE.stoneDark, 0.2)],
        ]}
      />
      <LinearGradient
        id={`${id}v`}
        stops={[
          [0, SCENE.waterLight],
          [0.45, SCENE.water],
          [1, SCENE.waterDeep],
        ]}
      />
      {stones.map((st, i) => (
        <path
          key={i}
          d={`M${r1(st.x - st.r)},${r1(st.y)}C${r1(st.x - st.r)},${r1(st.y - st.r * 1.25)} ${r1(st.x + st.r * 0.9)},${r1(st.y - st.r * 1.35)} ${r1(st.x + st.r)},${r1(st.y)}Z`}
          fill={`url(#${id}s)`}
          stroke={SCENE.outline}
          strokeWidth={0.7 * ss}
          strokeLinejoin="round"
        />
      ))}
      <path d={water} fill={`url(#${id}v)`} opacity={0.92} />
      <path d={pts(top)} fill="none" stroke={tint(SCENE.waterLight, 0.35)} strokeWidth={1.1 * ss} strokeLinecap="round" opacity={0.9} />
      {/* Krusninger som renner nedover */}
      <path
        d={pts(top.map(([x, y]): Pt => [x, y + 1.6 * k]))}
        fill="none"
        stroke={tint(SCENE.waterLight, 0.5)}
        strokeWidth={0.9 * ss}
        strokeLinecap="round"
        strokeDasharray={`${r1(dash)} ${r1(period - dash)}`}
        strokeDashoffset={r1(offset)}
        opacity={0.8}
      />
      {/* Små virvler bak steinene */}
      {stones.map((st, i) => (
        <path
          key={i}
          d={`M${r1(st.x + st.r * 0.7)},${r1(st.y - streamDepth(0.5, k) + 0.6)}q${r1(st.r * 0.6)},${r1(-1.2 * k)} ${r1(st.r * 1.3)},0`}
          fill="none"
          stroke={tint(SCENE.waterLight, 0.55)}
          strokeWidth={0.8 * ss}
          strokeLinecap="round"
          opacity={0.85}
        />
      ))}
    </g>
  );
});

/** Inntaket i magasinet: en betongramme med varegrind (rister som stopper kvister og is) foran munningen av røret. */
export function Inntak({ x, y, w }: { x: number; y: number; w: number }) {
  const ss = useStrokeScale();
  const hh = w + 8;
  const bars: string[] = [];
  for (let i = 1; i < 5; i++) {
    const yy = y - hh / 2 + (i * hh) / 5;
    bars.push(`M${r1(x - 4)},${r1(yy)}h3.5`);
  }
  return (
    <g aria-hidden opacity={0.75}>
      <rect x={x - 5} y={y - hh / 2} width={6} height={hh} rx={1} fill={shade(CONCRETE, 0.1)} stroke={SCENE.outline} strokeWidth={0.7 * ss} />
      <path d={bars.join('')} stroke={SCENE.metalDark} strokeWidth={0.8 * ss} />
    </g>
  );
}

/* ---------------------------------------------------------------- Rørgata */

/**
 * Rørgate i stål, tegnet i snitt så vannet inni synes: stålveggene oppe og nede, vann i midten med lyse striper som
 * renner nedover (med `t`), flenser med fast avstand og betongsadler som bærer røret over bakken. `from` er lengden
 * (px) langs røret der sadlene begynner (etter demningen), og `to` der de slutter (ved stasjonen).
 */
export const Rorgate = memo(function Rorgate({
  path: p,
  w,
  t,
  ground,
  supportsFrom,
  supportsTo,
  speed = 34,
}: {
  path: Pt[];
  /** Den indre diameteren (vannet), figurens enheter. */
  w: number;
  /** Tiden (s) for strømmen av vann. */
  t: number;
  /** Terrenget, så sadlene når ned til bakken. */
  ground: Pt[];
  supportsFrom: number;
  supportsTo: number;
  /** Farten på stripene (px/s). */
  speed?: number;
}) {
  const ss = useStrokeScale();
  const d = pts(p);
  const wall = Math.max(1.6, w * 0.13) * ss;
  const outer = w + 2 * wall;
  const L = polylineLength(p);
  const total = L[L.length - 1] ?? 0;

  // Sadler og flenser
  const saddles: string[] = [];
  const flanges: string[] = [];
  const gap = Math.max(26, outer * 2.2);
  for (let s = supportsFrom + gap * 0.5; s < Math.min(total, supportsTo) - 4; s += gap) {
    const a = pointAlong(p, s);
    const by = a.y + outer / 2;
    const gy = terrainY(ground, a.x);
    if (gy - by < 1) continue;
    const sw = Math.max(5, outer * 0.75);
    saddles.push(poly([
      [a.x - sw * 0.42, by - 1],
      [a.x + sw * 0.42, by - 1],
      [a.x + sw * 0.6, gy + 3],
      [a.x - sw * 0.6, gy + 3],
    ]));
  }
  for (let s = gap * 0.25; s < total - 6; s += gap / 2) {
    const a = pointAlong(p, s);
    const nx = -a.dy;
    const ny = a.dx;
    const half = outer / 2 + 1.2 * ss;
    flanges.push(`M${r1(a.x + nx * half)},${r1(a.y + ny * half)}L${r1(a.x - nx * half)},${r1(a.y - ny * half)}`);
  }
  const dash = Math.max(6, w * 0.9);
  const period = dash * 2.6;
  const offset = -((t * speed) % period);
  return (
    <g aria-hidden>
      <path d={saddles.join('')} fill={CONCRETE} stroke={SCENE.outline} strokeWidth={0.7 * ss} strokeLinejoin="round" />
      <path d={d} fill="none" stroke={SCENE.outline} strokeWidth={outer + 1.6 * ss} strokeLinejoin="round" />
      <path d={d} fill="none" stroke={SCENE.metal} strokeWidth={outer} strokeLinejoin="round" />
      {/* Vannet i snittet: mørkt i midten, lysere mot veggene */}
      <path d={d} fill="none" stroke={SCENE.waterDeep} strokeWidth={w} strokeLinejoin="round" />
      <path d={d} fill="none" stroke={SCENE.water} strokeWidth={w * 0.62} strokeLinejoin="round" />
      <path
        d={d}
        fill="none"
        stroke={tint(SCENE.waterLight, 0.35)}
        strokeWidth={Math.max(1.2, w * 0.2)}
        strokeLinecap="round"
        strokeDasharray={`${r1(dash)} ${r1(period - dash)}`}
        strokeDashoffset={r1(offset)}
        opacity={0.85}
      />
      {/* Høylys på stålet øverst */}
      <path d={d} fill="none" stroke={SCENE.metalLight} strokeWidth={Math.max(0.8, wall * 0.45)} strokeLinejoin="round" transform={`translate(0 ${r1(-(w / 2 + wall / 2))})`} opacity={0.9} />
      <path d={flanges.join('')} stroke={SCENE.metalDark} strokeWidth={Math.max(1.4, wall * 0.9)} strokeLinecap="round" />
    </g>
  );
});

/* ---------------------------------------------------------------- Kraftstasjonen */

export interface StationGeom {
  /** Venstre vegg og bakken. */
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Hvor ting sitter i stasjonen (figurens koordinater), så scenen kan sette etiketter og linjer. */
export function stationPoints(s: StationGeom, turbineX: number, turbineY: number) {
  const { x, y, w, h } = s;
  const genW = 0.4 * w;
  return {
    turbine: { x: turbineX, y: turbineY },
    casingW: 0.42 * w,
    casingH: 0.27 * h,
    generator: { x: turbineX, top: y - 0.76 * h, bottom: y - 0.44 * h, w: genW },
    /** Snittet i veggen (høyre kant av åpningen). */
    cutX: x + 0.66 * w,
    roof: { left: x - 6, right: x + w + 6, eaveY: y - h, ridgeY: y - h - ROOF_PITCH * h },
    /** Gjennomføringene på taket der kraftlinja starter. */
    bushings: [0, 1, 2].map((i) => ({ x: x + w * (0.6 + 0.1 * i), y: y - h - ROOF_PITCH * h - 9 })),
    /** Utløpet i høyre vegg (der vannet renner ut i elva). */
    outlet: { x: x + w + 1, y: y + 9 },
  };
}

/**
 * Kraftstasjon i snitt: maskinsalen er åpen foran, så turbinen (spiralhus med løpehjul som går rundt) og generatoren
 * over den synes, med akselen mellom. En gul traverskran går langs taket. Under gulvet renner vannet fra turbinen ut
 * gjennom avløpstunnelen til elva. Høyre del av fasaden er hel, med høye vinduer. (x, y) er venstre vegg ved bakken.
 */
export const Kraftstasjon = memo(function Kraftstasjon({
  s,
  turbineX,
  turbineY,
  pipeW,
  t,
  spin,
}: {
  s: StationGeom;
  turbineX: number;
  turbineY: number;
  /** Tykkelsen på røret som kommer inn (vannet). */
  pipeW: number;
  t: number;
  /** Omdreininger per sekund i tegningen (0 = står stille). */
  spin: number;
}) {
  const ss = useStrokeScale();
  const id = useSvgId('vk-stasjon');
  const { x, y, w, h } = s;
  const P = stationPoints(s, turbineX, turbineY);
  const cut = P.cutX;
  const wallT = Math.max(3, w * 0.025);
  const floorY = y;
  const ceilY = y - h;
  const facade = tint(mix(CONCRETE, SCENE.stone, 0.25), 0.28);
  const roof = mix(SCENE.stoneDark, SCENE.metalDark, 0.4);
  const { roof: R } = P;

  // Vinduer i den hele delen av fasaden: høye med rundbue
  const winW = Math.min(16, (x + w - cut - 14) / 2.4);
  const winTop = ceilY + h * 0.18;
  const winBot = y - h * 0.22;
  const wins = [cut + (x + w - cut) * 0.32, cut + (x + w - cut) * 0.72].map((cx) => cx - winW / 2);

  // Løpehjulet: skovlene går rundt (sett fra siden blir de streker som glir fram og tilbake)
  const cw = P.casingW;
  const ch = P.casingH;
  const cTop = turbineY - ch / 2;
  const cBot = turbineY + ch / 2;
  const phase = 2 * Math.PI * spin * t;
  const N = 9;
  const blades: { x: number; k: number; light: number }[] = [];
  for (let i = 0; i < N; i++) {
    const a = phase + (2 * Math.PI * i) / N;
    const sn = Math.sin(a);
    if (sn <= 0.05) continue;
    blades.push({ x: turbineX + Math.cos(a) * cw * 0.3, k: sn, light: 0.5 + 0.5 * Math.cos(a + 0.8) });
  }
  // Generatoren
  const G = P.generator;
  const gL = G.x - G.w / 2;
  const ell = G.w * 0.09;
  const ribs: string[] = [];
  for (let i = 1; i < 9; i++) {
    const rx = gL + (G.w * i) / 9;
    ribs.push(`M${r1(rx)},${r1(G.top + 5)}V${r1(G.bottom - 4)}`);
  }
  // Magnetiseringen på toppen har en stripe som går rundt med akselen
  const exW = G.w * 0.38;
  const exH = h * 0.08;
  const stripe = G.x + Math.cos(phase) * exW * 0.4;
  const stripeVis = Math.sin(phase) > 0;

  // Avløpet under gulvet: sugerøret vider seg ut ned i tunnelen, som går til høyre vegg
  const tunnelTop = floorY + 8;
  const tunnelBot = floorY + 19;
  const draftWall = Math.max(1.6, cw * 0.035);
  const draftOuter: Pt[] = [
    [turbineX - cw * 0.17, cBot - 1],
    [turbineX + cw * 0.17, cBot - 1],
    [turbineX + cw * 0.3, tunnelTop + 2],
    [turbineX - cw * 0.3, tunnelTop + 2],
  ];
  const draftInner: Pt[] = [
    [turbineX - cw * 0.17 + draftWall, cBot],
    [turbineX + cw * 0.17 - draftWall, cBot],
    [turbineX + cw * 0.3 - draftWall, tunnelTop + 3],
    [turbineX - cw * 0.3 + draftWall, tunnelTop + 3],
  ];
  const flow = -((t * 30) % 16);
  // Innløpet: røret fra rørgata (i snitt, med vann) inn til spiralhuset
  const inW = Math.min(pipeW, ch * 0.78);
  const inWall = Math.max(1.6, inW * 0.13);
  const inX1 = x + wallT - 1;
  const inX2 = turbineX - cw / 2 + 2;
  // Bolter i flensene øverst og nederst på spiralhuset
  const bolts: string[] = [];
  for (let i = 0; i < 7; i++) {
    const bx = turbineX - cw * 0.4 + (cw * 0.8 * i) / 6;
    bolts.push(circlePath(bx, cTop + ch * 0.08, 0.9), circlePath(bx, cBot - ch * 0.08, 0.9));
  }

  return (
    <g aria-hidden>
      <LinearGradient id={`${id}f`} stops={materialStops(facade, 0.6)} />
      <LinearGradient id={`${id}r`} stops={materialStops(roof, 0.9)} />
      <LinearGradient
        id={`${id}i`}
        stops={[
          [0, shade(SCENE.wall, 0.28)],
          [0.5, shade(SCENE.wall, 0.12)],
          [1, shade(SCENE.wall, 0.2)],
        ]}
      />
      <LinearGradient
        id={`${id}g`}
        x2={1}
        y2={0}
        stops={[
          [0, shade(MACHINE, 0.3)],
          [0.22, tint(MACHINE, 0.35)],
          [0.5, MACHINE],
          [1, shade(MACHINE, 0.45)],
        ]}
      />
      <LinearGradient
        id={`${id}s`}
        x2={1}
        y2={0}
        stops={[
          [0, SCENE.metalDark],
          [0.35, SCENE.metalLight],
          [1, SCENE.metalDark],
        ]}
      />
      <RadialGradient
        id={`${id}w`}
        cx={0.5}
        cy={0.45}
        r={0.6}
        stops={[
          [0, shade(SCENE.waterDeep, 0.35)],
          [1, shade(SCENE.waterDeep, 0.6)],
        ]}
      />
      <ContactShadow cx={x + w / 2} cy={y + 1} rx={w * 0.62} ry={5} opacity={0.6} />

      {/* Fundamentet under gulvet (i snitt) med avløpstunnelen */}
      <rect x={x - 3} y={floorY} width={w + 6} height={26} fill={shade(CONCRETE, 0.08)} stroke={SCENE.outline} strokeWidth={0.8 * ss} />
      <rect x={turbineX - cw * 0.34} y={tunnelTop} width={x + w + 4 - (turbineX - cw * 0.34)} height={tunnelBot - tunnelTop} rx={2} fill={SCENE.waterDeep} />
      <path
        d={`M${r1(turbineX - cw * 0.1)},${r1((tunnelTop + tunnelBot) / 2)}H${r1(x + w + 4)}`}
        stroke={tint(SCENE.waterLight, 0.3)}
        strokeWidth={1.6 * ss}
        strokeDasharray="6 10"
        strokeDashoffset={r1(flow)}
        strokeLinecap="round"
        opacity={0.8}
      />

      {/* Veggene og taket */}
      <rect x={x} y={ceilY} width={w} height={h} fill={`url(#${id}f)`} />
      <path
        d={poly([
          [R.left, R.eaveY + 1],
          [x + w * 0.16, R.ridgeY],
          [x + w * 0.84, R.ridgeY],
          [R.right, R.eaveY + 1],
        ])}
        fill={`url(#${id}r)`}
        stroke={SCENE.outline}
        strokeWidth={0.9 * ss}
        strokeLinejoin="round"
      />
      <path d={`M${r1(R.left)},${r1(R.eaveY + 1)}H${r1(R.right)}`} stroke={shade(roof, 0.35)} strokeWidth={2 * ss} />
      {/* Sokkel i naturstein nederst på fasaden */}
      <rect x={x} y={y - 9} width={w} height={9} fill={mix(SCENE.stone, SCENE.stoneDark, 0.3)} />
      {/* Vinduene i den hele delen */}
      {wins.map((wx, i) => (
        <g key={i}>
          <path
            d={`M${r1(wx)},${r1(winBot)}V${r1(winTop + winW / 2)}A${r1(winW / 2)},${r1(winW / 2)} 0 0 1 ${r1(wx + winW)},${r1(winTop + winW / 2)}V${r1(winBot)}Z`}
            fill={WINDOW}
            stroke={tint(SCENE.stone, 0.5)}
            strokeWidth={1.6 * ss}
          />
          <path
            d={`M${r1(wx + winW / 2)},${r1(winTop)}V${r1(winBot)}M${r1(wx)},${r1((winTop + winBot) / 2)}H${r1(wx + winW)}`}
            stroke={tint(SCENE.stone, 0.5)}
            strokeWidth={1 * ss}
          />
        </g>
      ))}

      {/* Maskinsalen i snitt */}
      <rect x={x + wallT} y={ceilY + wallT} width={cut - x - wallT} height={h - wallT} fill={`url(#${id}i)`} />
      {/* Traverskranen: skinne og gul bjelke med løpekatt */}
      <path d={`M${r1(x + wallT)},${r1(ceilY + h * 0.13)}H${r1(cut)}`} stroke={SCENE.metalDark} strokeWidth={1.4 * ss} />
      <rect x={x + wallT + 2} y={ceilY + h * 0.13 + 1} width={cut - x - wallT - 4} height={Math.max(3, h * 0.05)} fill={PAINTS.gul} stroke={SCENE.outline} strokeWidth={0.6 * ss} />
      <rect x={turbineX - 5} y={ceilY + h * 0.13 + 1 + Math.max(3, h * 0.05)} width={10} height={4} fill={SCENE.metalDark} />
      <path d={`M${r1(turbineX)},${r1(ceilY + h * 0.13 + 8 + Math.max(3, h * 0.05))}v${r1(h * 0.06)}`} stroke={SCENE.metalDark} strokeWidth={0.8 * ss} />

      {/* Akselen fra turbinen opp til generatoren */}
      <rect x={turbineX - Math.max(2, w * 0.018)} y={G.bottom - 2} width={2 * Math.max(2, w * 0.018)} height={cTop - G.bottom + 3} fill={`url(#${id}s)`} stroke={SCENE.outline} strokeWidth={0.5 * ss} />

      {/* Generatoren: sylinder med kjøleribber og magnetisering på toppen */}
      <rect x={gL} y={G.top} width={G.w} height={G.bottom - G.top} rx={2} fill={`url(#${id}g)`} />
      <path d={ribs.join('')} stroke={shade(MACHINE, 0.4)} strokeWidth={0.8 * ss} opacity={0.6} />
      <rect x={gL - 1.5} y={G.bottom - 5} width={G.w + 3} height={5} rx={1} fill={`url(#${id}g)`} stroke={SCENE.outline} strokeWidth={0.6 * ss} />
      <rect x={gL} y={G.top} width={G.w} height={G.bottom - G.top} rx={2} fill="none" stroke={SCENE.outline} strokeWidth={0.8 * ss} />
      <ellipse cx={G.x} cy={G.top} rx={G.w / 2} ry={ell} fill={tint(MACHINE, 0.25)} stroke={SCENE.outline} strokeWidth={0.7 * ss} />
      <rect x={G.x - exW / 2} y={G.top - exH} width={exW} height={exH} fill={`url(#${id}s)`} stroke={SCENE.outline} strokeWidth={0.6 * ss} />
      <ellipse cx={G.x} cy={G.top - exH} rx={exW / 2} ry={ell * 0.45} fill={SCENE.metalLight} stroke={SCENE.outline} strokeWidth={0.5 * ss} />
      {stripeVis && <path d={`M${r1(stripe)},${r1(G.top - exH + 1)}V${r1(G.top - 1)}`} stroke={SCENE.metalDark} strokeWidth={1.6 * ss} />}
      {/* Kabel fra generatoren ut gjennom veggen */}
      <path d={`M${r1(gL + G.w)},${r1(G.top + 8)}H${r1(cut)}`} stroke={SCENE.rubber} strokeWidth={2.2 * ss} strokeLinecap="round" />

      {/* Turbinen: spiralhuset med løpehjulet synlig i snittet, og sugerøret ned i avløpet */}
      <path d={poly(draftOuter)} fill={`url(#${id}g)`} stroke={SCENE.outline} strokeWidth={0.7 * ss} />
      <path d={poly(draftInner)} fill={SCENE.waterDeep} />
      <path
        d={`M${r1(turbineX)},${r1(cBot + 1)}V${r1(tunnelTop + 1)}`}
        stroke={tint(SCENE.waterLight, 0.3)}
        strokeWidth={1.4 * ss}
        strokeDasharray="4 6"
        strokeDashoffset={r1(flow)}
        strokeLinecap="round"
        opacity={0.8}
      />
      <rect x={turbineX - cw / 2} y={cTop} width={cw} height={ch} rx={ch * 0.42} fill={`url(#${id}g)`} stroke={SCENE.outline} strokeWidth={0.8 * ss} />
      <path
        d={`M${r1(turbineX - cw * 0.44)},${r1(cTop + ch * 0.16)}H${r1(turbineX + cw * 0.44)}M${r1(turbineX - cw * 0.44)},${r1(cBot - ch * 0.16)}H${r1(turbineX + cw * 0.44)}`}
        stroke={shade(MACHINE, 0.45)}
        strokeWidth={0.8 * ss}
        opacity={0.8}
      />
      <path d={bolts.join('')} fill={tint(MACHINE, 0.5)} />
      <rect x={turbineX - cw * 0.36} y={cTop + ch * 0.2} width={cw * 0.72} height={ch * 0.6} rx={ch * 0.22} fill={`url(#${id}w)`} />
      {blades.map((b, i) => (
        <path
          key={i}
          d={`M${r1(b.x - 1.2 * b.k)},${r1(cTop + ch * 0.24)}Q${r1(b.x + 2.4 * b.k)},${r1(turbineY)} ${r1(b.x - 1.2 * b.k)},${r1(cBot - ch * 0.24)}`}
          fill="none"
          stroke={mix(SCENE.metalLight, SCENE.metalDark, 1 - b.light)}
          strokeWidth={(0.8 + 1.6 * b.k) * ss}
          strokeLinecap="round"
        />
      ))}
      <rect x={turbineX - cw * 0.36} y={cTop + ch * 0.2} width={cw * 0.72} height={ch * 0.6} rx={ch * 0.22} fill="none" stroke={shade(MACHINE, 0.5)} strokeWidth={0.8 * ss} />
      {/* Innløpet fra rørgata, i snitt med vannet */}
      <rect x={inX1} y={turbineY - inW / 2 - inWall} width={inX2 - inX1} height={inW + 2 * inWall} fill={SCENE.metal} stroke={SCENE.outline} strokeWidth={0.7 * ss} />
      <rect x={inX1} y={turbineY - inW / 2} width={inX2 - inX1} height={inW} fill={SCENE.waterDeep} />
      <rect x={inX1} y={turbineY - inW * 0.31} width={inX2 - inX1} height={inW * 0.62} fill={SCENE.water} />
      <path
        d={`M${r1(inX1)},${r1(turbineY)}H${r1(inX2)}`}
        stroke={tint(SCENE.waterLight, 0.35)}
        strokeWidth={Math.max(1.2, inW * 0.2)}
        strokeDasharray="6 10"
        strokeDashoffset={r1(-((t * 34) % 16))}
        strokeLinecap="round"
        opacity={0.85}
      />

      {/* Snittflatene i veggen, taket og gulvet (tykkelsen, mørkere) */}
      <g fill={shade(facade, 0.35)} stroke={SCENE.outline} strokeWidth={0.6 * ss}>
        <rect x={x} y={ceilY} width={wallT} height={h} />
        <rect x={x} y={ceilY} width={cut - x} height={wallT} />
        <rect x={cut - wallT * 0.5} y={ceilY} width={wallT} height={h} />
      </g>
      <path d={`M${r1(x)},${r1(floorY)}H${r1(cut)}`} stroke={shade(CONCRETE, 0.35)} strokeWidth={1.6 * ss} />
      <rect x={x} y={ceilY} width={w} height={h} fill="none" stroke={SCENE.outline} strokeWidth={0.9 * ss} />
      {/* Gjennomføringer på taket (der linja starter) */}
      {P.bushings.map((b, i) => (
        <g key={i}>
          <path d={`M${r1(b.x)},${r1(b.y + 9)}V${r1(b.y)}`} stroke={SCENE.outline} strokeWidth={3.4 * ss} strokeLinecap="round" />
          <path d={`M${r1(b.x)},${r1(b.y + 9)}V${r1(b.y)}`} stroke={tint(SCENE.stone, 0.4)} strokeWidth={2.2 * ss} strokeLinecap="round" />
        </g>
      ))}
    </g>
  );
});

/** Vannet som renner ut av avløpet og ut i elva. */
export function Utlop({ x, y, t, w = 22 }: { x: number; y: number; t: number; w?: number }) {
  const ss = useStrokeScale();
  const k = (t * 1.6) % 1;
  return (
    <g aria-hidden>
      <path d={`M${r1(x)},${r1(y - 4)}q${r1(w * 0.45)},0 ${r1(w * 0.75)},${r1(6)}`} fill="none" stroke={SCENE.water} strokeWidth={6 * ss} strokeLinecap="round" />
      <path d={`M${r1(x)},${r1(y - 5)}q${r1(w * 0.45)},0 ${r1(w * 0.75)},${r1(6)}`} fill="none" stroke={tint(SCENE.waterLight, 0.4)} strokeWidth={1.4 * ss} strokeLinecap="round" opacity={0.8} />
      {[0, 0.5].map((o) => {
        const q = (k + o) % 1;
        return <ellipse key={o} cx={x + w * (0.6 + 0.6 * q)} cy={y + 3} rx={2 + 6 * q} ry={1 + 1.5 * q} fill="none" stroke={tint(SCENE.waterLight, 0.4)} strokeWidth={0.9 * ss} opacity={0.9 * (1 - q)} />;
      })}
    </g>
  );
}

/* ---------------------------------------------------------------- Kraftlinja */

/**
 * Kraftmast i stål (fagverk) med travers og tre isolatorer. (x, y) er foten midt på bakken, `size` er høyden.
 * `mastPunkter` gir festepunktene for linjene.
 */
export function mastPunkter(x: number, y: number, size: number): { x: number; y: number }[] {
  return [-0.32, 0, 0.32].map((f) => ({ x: x + f * size, y: y - size * 0.9 + size * 0.1 }));
}

export const Kraftmast = memo(function Kraftmast({ x, y, size }: { x: number; y: number; size: number }) {
  const ss = useStrokeScale();
  const top = y - size * 0.9;
  const bw = size * 0.18;
  const tw = size * 0.05;
  const legs = `M${r1(x - bw)},${r1(y)}L${r1(x - tw)},${r1(top)}M${r1(x + bw)},${r1(y)}L${r1(x + tw)},${r1(top)}`;
  const brace: string[] = [];
  const n = 5;
  for (let i = 0; i < n; i++) {
    const y0 = y - (i * (y - top)) / n;
    const y1 = y - ((i + 1) * (y - top)) / n;
    const half = (yy: number) => bw + ((tw - bw) * (y - yy)) / (y - top);
    brace.push(`M${r1(x - half(y0))},${r1(y0)}L${r1(x + half(y1))},${r1(y1)}M${r1(x + half(y0))},${r1(y0)}L${r1(x - half(y1))},${r1(y1)}`);
  }
  const arm = size * 0.36;
  const att = mastPunkter(x, y, size);
  return (
    <g aria-hidden>
      <path d={legs} stroke={SCENE.metalDark} strokeWidth={1.5 * ss} strokeLinecap="round" />
      <path d={brace.join('')} stroke={SCENE.metal} strokeWidth={0.8 * ss} />
      <path d={`M${r1(x - arm)},${r1(top)}H${r1(x + arm)}M${r1(x - arm * 0.6)},${r1(top - size * 0.08)}L${r1(x)},${r1(top - size * 0.1)}L${r1(x + arm * 0.6)},${r1(top - size * 0.08)}`} stroke={SCENE.metalDark} strokeWidth={1.4 * ss} strokeLinecap="round" />
      {att.map((a, i) => (
        <path key={i} d={`M${r1(a.x)},${r1(top)}V${r1(a.y)}`} stroke={tint(SCENE.stone, 0.35)} strokeWidth={2 * ss} strokeLinecap="round" />
      ))}
      <ContactShadow cx={x} cy={y} rx={bw * 1.4} ry={2.5} opacity={0.5} />
    </g>
  );
});

/** Linjer som henger i en bue (parabel) mellom festepunkter: én linje per par av punkter. */
export function Linjer({ spans, sag = 0.06 }: { spans: [{ x: number; y: number }, { x: number; y: number }][]; sag?: number }) {
  const ss = useStrokeScale();
  const d = spans
    .map(([a, b]) => {
      const mx = (a.x + b.x) / 2;
      const my = (a.y + b.y) / 2 + Math.abs(b.x - a.x) * sag * 2;
      return `M${r1(a.x)},${r1(a.y)}Q${r1(mx)},${r1(my)} ${r1(b.x)},${r1(b.y)}`;
    })
    .join('');
  return <path d={d} fill="none" stroke={shade(SCENE.metalDark, 0.2)} strokeWidth={0.9 * ss} opacity={0.85} aria-hidden />;
}

/* ---------------------------------------------------------------- Husene */

export const HUS_FARGER: PaintName[] = ['rod', 'hvit', 'gul', 'rod', 'hvit'];

/**
 * Norsk trehus sett med gavlen mot oss: stående kledning i lakk, hvite hjørnekasser og vindu med sprosser (tent i
 * skumringen), dør, mørkt tak og pipe. (x, y) er midt på bakken, `size` er bredden. Huset er ca. 1,15 · size høyt.
 */
export const Hus = memo(function Hus({
  x,
  y,
  size,
  farge = 'rod',
  pipe = true,
  dempet,
  skygge = true,
}: {
  x: number;
  y: number;
  size: number;
  farge?: PaintName;
  pipe?: boolean;
  /** Tegn huset blekt (f.eks. den tomme delen av et hus i bildediagrammet). */
  dempet?: boolean;
  skygge?: boolean;
}) {
  const ss = useStrokeScale();
  const id = useSvgId('vk-hus');
  const W = size;
  const wallH = W * 0.62;
  const roofH = W * 0.52;
  const L = x - W / 2;
  const T = y - wallH;
  const paint = PAINTS[farge];
  const trim = PAINTS.hvit;
  const roof = mix(SCENE.stoneDark, PAINTS.svart, 0.35);
  const cladding: string[] = [];
  const step = Math.max(2.2, W / 11);
  for (let cx = L + step; cx < L + W - 1; cx += step) cladding.push(`M${r1(cx)},${r1(T + 1)}V${r1(y - 1)}`);
  const winW = W * 0.26;
  const winH = W * 0.22;
  const winX = x - W * 0.3;
  const winY = T + wallH * 0.24;
  const doorW = W * 0.2;
  const doorH = wallH * 0.62;
  const doorX = x + W * 0.1;
  const thin = Math.max(0.5, W * 0.02) * ss;
  return (
    <g aria-hidden opacity={dempet ? 0.3 : undefined}>
      <LinearGradient id={`${id}a`} x2={1} y2={0} stops={[[0, tint(paint, 0.08)], [1, shade(paint, 0.14)]]} />
      {skygge && <ContactShadow cx={x} cy={y} rx={W * 0.62} ry={Math.max(1.5, W * 0.06)} opacity={0.7} />}
      {pipe && <rect x={x + W * 0.18} y={T - roofH * 0.82} width={W * 0.12} height={roofH * 0.6} fill={SCENE.brick} stroke={SCENE.outline} strokeWidth={thin} />}
      <rect x={L} y={T} width={W} height={wallH} fill={`url(#${id}a)`} />
      <path d={cladding.join('')} stroke={shade(paint, 0.3)} strokeWidth={thin} opacity={0.55} />
      {/* Gavlen med kledning og tak */}
      <path d={poly([[L, T], [x, T - roofH * 0.8], [L + W, T]])} fill={`url(#${id}a)`} />
      <path
        d={poly([
          [L - W * 0.08, T + W * 0.03],
          [x, T - roofH],
          [L + W * 1.08, T + W * 0.03],
          [L + W * 0.96, T + W * 0.06],
          [x, T - roofH * 0.8],
          [L + W * 0.04, T + W * 0.06],
        ])}
        fill={roof}
        stroke={SCENE.outline}
        strokeWidth={thin}
        strokeLinejoin="round"
      />
      {/* Hjørnekasser */}
      <path d={`M${r1(L + thin)},${r1(T + W * 0.06)}V${r1(y)}M${r1(L + W - thin)},${r1(T + W * 0.06)}V${r1(y)}`} stroke={trim} strokeWidth={Math.max(0.8, W * 0.045)} />
      {/* Vindu med sprosser */}
      <rect x={winX - winW / 2} y={winY} width={winW} height={winH} fill={WINDOW} stroke={trim} strokeWidth={Math.max(0.7, W * 0.035)} />
      <path d={`M${r1(winX)},${r1(winY)}V${r1(winY + winH)}M${r1(winX - winW / 2)},${r1(winY + winH / 2)}H${r1(winX + winW / 2)}`} stroke={trim} strokeWidth={Math.max(0.5, W * 0.02)} />
      {/* Dør */}
      <rect x={doorX} y={y - doorH} width={doorW} height={doorH} fill={shade(paint, 0.35)} stroke={trim} strokeWidth={Math.max(0.5, W * 0.025)} />
      <rect x={L} y={T} width={W} height={wallH} fill="none" stroke={SCENE.outline} strokeWidth={thin} />
    </g>
  );
});

/** Hus i en liten bygd: plasser `n` hus mellom x1 og x2 med litt ulik størrelse og farge (fast frø). */
export function bygdPlasser(x1: number, x2: number, n: number, size: number, seed = 4): { x: number; size: number; farge: PaintName }[] {
  const rnd = sceneRandom(seed);
  const out: { x: number; size: number; farge: PaintName }[] = [];
  if (n <= 0 || x2 - x1 < size * 0.6) return out;
  const step = (x2 - x1) / n;
  for (let i = 0; i < n; i++) {
    const s = size * (0.85 + rnd() * 0.3);
    out.push({ x: x1 + step * (i + 0.5) + (rnd() - 0.5) * step * 0.25, size: s, farge: HUS_FARGER[(i + seed) % HUS_FARGER.length]! });
  }
  return out;
}

