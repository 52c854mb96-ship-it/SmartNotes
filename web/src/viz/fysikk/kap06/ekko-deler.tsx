/**
 * Egne gjenstander til «Lyd og ekko» (k6-ekko), i samme stil som scene-kit-et: toninger fra core.tsx, SCENE-farger,
 * kontur og myk glød. Bare denne visualiseringen trenger dem.
 *
 *   <Tordensky x={x} base={y} top={12} w={200} />        bygesky (cumulonimbus) med flat, mørk bunn og ambolt øverst
 *   <Regnbyge x1={x1} x2={x2} top={base} bottom={bakke} /> regnskyll under skya
 *   <Lyn x1 y1 x2 y2 glod={1} />                           lynet fra skya til nedslaget, med greiner og glød
 *   <Fiskebaat x={x} y={vannlinje} size={150} />          sjark sett fra siden; giveren til ekkoloddet sitter under kjølen
 *   <Ekkoloddskjerm x y w h … />                          skjermen i styrhuset med tid, dybde og bunnekko
 *   useContainerScale()                                   tekstskaleringen figuren får, målt før figuren tegnes
 */
import { memo, useEffect, useRef, useState } from 'react';
import { Txt } from '../../kit';
import { LinearGradient, PAINTS, RadialGradient, SCENE, alpha, mix, sceneRandom, shade, tint, useStrokeScale, useSvgId } from '../../kit/scene';

const r1 = (v: number) => Math.round(v * 10) / 10;

/**
 * Tekstskaleringen figuren vil få (samme regel som i <Figure>: 1 på PC, ca. 1,8 på mobil), målt på beholderen før
 * figuren tegnes, så viewBox-høyden kan velges etter den. `s` er gjenstandsskalaen (som useSceneScale).
 */
export function useContainerScale(vbWidth = 800) {
  const ref = useRef<HTMLDivElement>(null);
  const [f, setF] = useState(1);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const update = () => {
      const w = el.getBoundingClientRect().width;
      if (w > 0) {
        const next = Math.round(Math.max(1, 12.5 / 17 / (w / vbWidth)) * 20) / 20;
        setF((old) => (old === next ? old : next));
      }
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [vbWidth]);
  return { ref, f, s: Math.max(1, 0.85 * f) };
}

/* ---------------------------------------------------------------- Tordensky */

type Puff = { cx: number; cy: number; rx: number; ry: number };

/**
 * Skyklumpene i en bygesky, relativt til midt på bunnen (0, 0), bredden 1 og høyden `h` (y opp er negativ):
 * ambolten øverst (flate, brede klumper som brer seg mot høyre), tårnet av runde klumper og en flat bunn.
 * Rekkefølgen er bakfra og fram: ambolten, så tårnet ovenfra og ned, så de nederste klumpene foran.
 */
function cloudPuffs(h: number, seed: number): Puff[] {
  const rand = sceneRandom(seed);
  const out: Puff[] = [];
  // Ambolten
  for (let i = 0; i < 7; i++) {
    const u = -0.62 + (i / 6) * 1.75;
    out.push({ cx: u, cy: -h * (0.86 + 0.04 * Math.sin(i * 1.7)), rx: 0.26 + rand() * 0.06, ry: h * (0.07 + rand() * 0.03) });
  }
  // Tårnet: rader ovenfra og ned, litt smalere oppover
  const rows = 6;
  for (let r = rows - 1; r >= 0; r--) {
    const v = 0.12 + (r / (rows - 1)) * 0.66;
    const half = 0.44 - 0.1 * v;
    const n = r === 0 ? 4 : 3;
    for (let i = 0; i < n; i++) {
      const u = -half + ((i + 0.5) / n) * 2 * half + (rand() - 0.5) * 0.08;
      const rr = 0.15 + rand() * 0.06;
      out.push({ cx: u, cy: -h * v + (rand() - 0.5) * 0.04 * h, rx: rr, ry: rr * 0.95 });
    }
  }
  return out;
}

/**
 * Bygesky (cumulonimbus) sett fra siden: et tårn av bølgende skyklumper med flat, mørk bunn og en ambolt som
 * brer seg mot høyre øverst. (x, base) er midt på bunnen, `w` bredden av tårnet, `top` toppen av ambolten.
 * Lyset kommer ovenfra og fra venstre.
 */
export const Tordensky = memo(function Tordensky({ x, base, top, w, seed = 4 }: { x: number; base: number; top: number; w: number; seed?: number }) {
  const id = useSvgId('ekko-sky');
  const ss = useStrokeScale();
  if (!Number.isFinite(x) || !Number.isFinite(base) || !(w > 0) || !(base > top)) return null;
  const H = base - top;
  const puffs = cloudPuffs(H / w, seed).map((p) => ({ cx: x + p.cx * w, cy: base + p.cy * w, rx: p.rx * w, ry: p.ry * w }));
  const shapes = puffs.map((p, i) => <ellipse key={i} cx={r1(p.cx)} cy={r1(p.cy)} rx={r1(p.rx)} ry={r1(p.ry)} />);
  return (
    <g aria-hidden>
      <LinearGradient
        id={`${id}f`}
        userSpace
        x1={0}
        y1={top}
        x2={0}
        y2={base}
        stops={[
          [0, SCENE.cloud],
          [0.3, mix(SCENE.cloud, SCENE.cloudShade, 0.85)],
          [0.7, shade(SCENE.cloudShade, 0.32)],
          [1, shade(SCENE.cloudShade, 0.58)],
        ]}
      />
      <RadialGradient
        id={`${id}p`}
        cx={0.4}
        cy={0.35}
        r={0.62}
        fx={0.32}
        fy={0.24}
        stops={[
          [0, SCENE.highlight, 0.55],
          [0.55, SCENE.highlight, 0.08],
          [1, SCENE.shadow, 0.22],
        ]}
      />
      <LinearGradient
        id={`${id}s`}
        userSpace
        x1={x - 0.6 * w}
        y1={0}
        x2={x + 1.2 * w}
        y2={0}
        stops={[
          [0, SCENE.highlight, 0.25],
          [0.5, SCENE.highlight, 0],
          [1, SCENE.shadow, 0.55],
        ]}
      />
      <LinearGradient
        id={`${id}b`}
        userSpace
        x1={0}
        y1={base - 0.22 * H}
        x2={0}
        y2={base}
        stops={[
          [0, SCENE.shadow, 0],
          [1, SCENE.shadow, 0.85],
        ]}
      />
      <clipPath id={`${id}flat`}>
        <rect x={x - 3 * w} y={top - w} width={6 * w} height={base - top + w} />
      </clipPath>
      <clipPath id={`${id}k`}>{shapes}</clipPath>
      <g clipPath={`url(#${id}flat)`}>
        {puffs.map((p, i) => (
          <g key={i}>
            <ellipse cx={r1(p.cx)} cy={r1(p.cy)} rx={r1(p.rx)} ry={r1(p.ry)} fill={`url(#${id}f)`} stroke={SCENE.outline} strokeWidth={0.8 * ss} strokeOpacity={0.08} />
            <ellipse cx={r1(p.cx)} cy={r1(p.cy)} rx={r1(p.rx)} ry={r1(p.ry)} fill={`url(#${id}p)`} />
          </g>
        ))}
        <g clipPath={`url(#${id}k)`}>
          <rect x={x - 3 * w} y={top - w} width={6 * w} height={base - top + w} fill={`url(#${id}s)`} />
          <rect x={x - 3 * w} y={base - 0.22 * H} width={6 * w} height={0.22 * H} fill={`url(#${id}b)`} />
        </g>
      </g>
    </g>
  );
});

/* ---------------------------------------------------------------- Regnbyge */

/** Regnskyll under en bygesky: blek grå stripe som blekner mot bakken, med skrå regnstriper. */
export const Regnbyge = memo(function Regnbyge({ x1, x2, top, bottom, seed = 7 }: { x1: number; x2: number; top: number; bottom: number; seed?: number }) {
  const id = useSvgId('ekko-regn');
  const ss = useStrokeScale();
  if (!(x2 > x1) || !(bottom > top)) return null;
  const h = bottom - top;
  const slant = 0.18 * h;
  const rand = sceneRandom(seed);
  let streaks = '';
  const n = Math.round((x2 - x1) / 7);
  for (let i = 0; i < n; i++) {
    const sx = x1 + rand() * (x2 - x1);
    const sy = top + rand() * h * 0.85;
    const len = 10 + rand() * 18;
    const k = len / h;
    streaks += `M${r1(sx - slant * ((sy - top) / h))},${r1(sy)}l${r1(-slant * k)},${r1(len)}`;
  }
  const poly = `M${r1(x1)},${r1(top)}L${r1(x2)},${r1(top)}L${r1(x2 - slant)},${r1(bottom)}L${r1(x1 - slant)},${r1(bottom)}Z`;
  return (
    <g aria-hidden>
      <LinearGradient
        id={id}
        userSpace
        x1={x1 - slant}
        y1={0}
        x2={x2}
        y2={0}
        stops={[
          [0, shade(SCENE.cloudShade, 0.3), 0],
          [0.3, shade(SCENE.cloudShade, 0.3), 0.42],
          [0.7, shade(SCENE.cloudShade, 0.25), 0.36],
          [1, shade(SCENE.cloudShade, 0.25), 0],
        ]}
      />
      <path d={poly} fill={`url(#${id})`} />
      <path d={streaks} stroke={tint(SCENE.cloudShade, 0.3)} strokeWidth={1 * ss} strokeLinecap="round" opacity={0.55} />
    </g>
  );
});

/* ---------------------------------------------------------------- Lyn */

/** Lynkanalen som punkter fra (0, 0) til (0, 1) med fast form (frø), pluss to greiner. Relativt til lengden. */
function boltShape(seed: number) {
  const rand = sceneRandom(seed);
  const main: [number, number][] = [[0, 0]];
  const n = 13;
  let u = 0;
  for (let i = 1; i < n; i++) {
    u += (rand() * 2 - 1) * 0.07;
    u = Math.max(-0.14, Math.min(0.14, u));
    main.push([u * (1 - (i / n) ** 3), i / n + (rand() - 0.5) * 0.02]);
  }
  main.push([0, 1]);
  const branch = (from: number, dir: number, len: number): [number, number][] => {
    const p = main[from]!;
    const out: [number, number][] = [p];
    let bx = p[0];
    let by = p[1];
    for (let i = 0; i < 4; i++) {
      bx += dir * (0.04 + rand() * 0.05);
      by += len / 4 + (rand() - 0.5) * 0.02;
      out.push([bx, by]);
    }
    return out;
  };
  // Begge greinene går mot venstre, bort fra personen som står til høyre for nedslaget
  return { main, branches: [branch(3, -1, 0.22), branch(7, -1, 0.14)] };
}

const BOLT = boltShape(11);

/**
 * Lyn fra (x1, y1) i skya til nedslaget i (x2, y2): sikksakk-kanal med to greiner, hvit kjerne og gul glød.
 * `glod` (0–1) er hvor sterkt det lyser; ved 0 tegnes et svakt etterbilde, så nedslaget fortsatt synes.
 */
export function Lyn({ x1, y1, x2, y2, glod }: { x1: number; y1: number; x2: number; y2: number; glod: number }) {
  const id = useSvgId('ekko-lyn');
  const ss = useStrokeScale();
  const L = y2 - y1;
  if (!(L > 0) || !Number.isFinite(x1) || !Number.isFinite(x2)) return null;
  const g = Math.max(0, Math.min(1, glod));
  const W = 0.9 * L; // sideutslaget skaleres med lengden
  const map = ([u, v]: [number, number]) => `${r1(x1 + (x2 - x1) * v + u * W)},${r1(y1 + v * L)}`;
  const path = (p: [number, number][]) => `M${p.map(map).join('L')}`;
  const main = path(BOLT.main);
  const br = BOLT.branches.map(path).join('');
  const glow = SCENE.glow;
  const core = tint(SCENE.glow, 0.85);
  return (
    <g aria-hidden opacity={0.35 + 0.65 * g}>
      {g > 0 && (
        <>
          <RadialGradient
            id={`${id}g`}
            stops={[
              [0, tint(SCENE.glow, 0.5), 0.75 * g],
              [1, SCENE.glow, 0],
            ]}
          />
          <ellipse cx={x2} cy={y2} rx={0.32 * L} ry={0.07 * L} fill={`url(#${id}g)`} />
        </>
      )}
      <g fill="none" strokeLinejoin="round" strokeLinecap="round">
        <path d={main + br} stroke={alpha(glow, 0.28 * g + 0.1)} strokeWidth={11 * ss} />
        <path d={br} stroke={glow} strokeWidth={2.2 * ss} />
        <path d={main} stroke={glow} strokeWidth={4.4 * ss} />
        <path d={br} stroke={core} strokeWidth={0.9 * ss} />
        <path d={main} stroke={core} strokeWidth={1.8 * ss} />
      </g>
    </g>
  );
}

/* ---------------------------------------------------------------- Fiskebåt */

/** Hvor giveren (lydkilden) til ekkoloddet sitter: midt under kjølen. */
export function fiskebaatGiver(x: number, y: number, size: number) {
  return { x, y: y + 0.088 * size };
}

/**
 * Sjark (liten fiskebåt) sett fra siden med baugen mot høyre: hvitt skrog med blå ripe og rød bunnstoff,
 * styrhus med vinduer, mast og antenne. Giveren til ekkoloddet sitter midt under kjølen (`fiskebaatGiver`).
 * (x, y) er midt på vannlinja, `size` lengden. Delen under vann tones med vannfarge, så den ser ut til å ligge i
 * vannet.
 */
export const Fiskebaat = memo(function Fiskebaat({ x, y, size }: { x: number; y: number; size: number }) {
  const id = useSvgId('ekko-baat');
  const ss = useStrokeScale();
  if (!Number.isFinite(x) || !Number.isFinite(y) || !(size > 0)) return null;
  const L = size;
  const X = (u: number) => r1(x + u * L);
  const Y = (v: number) => r1(y + v * L);
  // Skroget: ripa (dekkskanten) med spring, baugen, kjølen og akterspeilet
  const hull =
    `M${X(-0.47)},${Y(-0.105)}` +
    `Q${X(0.1)},${Y(-0.095)} ${X(0.5)},${Y(-0.165)}` +
    `Q${X(0.47)},${Y(0.03)} ${X(0.33)},${Y(0.075)}` +
    `L${X(-0.38)},${Y(0.08)}` +
    `Q${X(-0.46)},${Y(0.06)} ${X(-0.47)},${Y(-0.105)}Z`;
  const rail = `M${X(-0.47)},${Y(-0.105)}Q${X(0.1)},${Y(-0.095)} ${X(0.5)},${Y(-0.165)}`;
  const giver = fiskebaatGiver(x, y, L);
  const white = PAINTS.hvit;
  return (
    <g aria-hidden>
      <LinearGradient
        id={`${id}h`}
        userSpace
        x1={0}
        y1={y - 0.17 * L}
        x2={0}
        y2={y + 0.08 * L}
        stops={[
          [0, tint(white, 0.3)],
          [0.55, white],
          [0.62, PAINTS.rod],
          [1, shade(PAINTS.rod, 0.35)],
        ]}
      />
      <LinearGradient
        id={`${id}w`}
        x2={1}
        y2={0}
        stops={[
          [0, tint(white, 0.35)],
          [0.7, white],
          [1, shade(white, 0.18)],
        ]}
      />
      <clipPath id={`${id}k`}>
        <path d={hull} />
      </clipPath>
      {/* Mast og antenne bak styrhuset */}
      <path
        d={`M${X(0.17)},${Y(-0.13)}V${Y(-0.55)}M${X(0.17)},${Y(-0.46)}L${X(0.29)},${Y(-0.15)}M${X(-0.12)},${Y(-0.37)}V${Y(-0.47)}`}
        stroke={SCENE.metalDark}
        strokeWidth={Math.max(1.4 * ss, 0.012 * L)}
        strokeLinecap="round"
        fill="none"
      />
      <circle cx={X(0.17)} cy={Y(-0.555)} r={Math.max(1.8, 0.012 * L)} fill={SCENE.glow} stroke={SCENE.outline} strokeWidth={0.6 * ss} />
      {/* Styrhuset */}
      <path
        d={`M${X(-0.2)},${Y(-0.1)}V${Y(-0.33)}H${X(0.02)}L${X(0.08)},${Y(-0.1)}Z`}
        fill={`url(#${id}w)`}
        stroke={SCENE.outline}
        strokeWidth={0.8 * ss}
      />
      <path d={`M${X(-0.23)},${Y(-0.335)}H${X(0.045)}V${Y(-0.355)}H${X(-0.23)}Z`} fill={shade(white, 0.25)} stroke={SCENE.outline} strokeWidth={0.7 * ss} />
      {[-0.17, -0.08].map((u) => (
        <rect key={u} x={X(u)} y={Y(-0.29)} width={r1(0.07 * L)} height={r1(0.075 * L)} rx={r1(0.008 * L)} fill={SCENE.glass} stroke={shade(SCENE.glassEdge, 0.2)} strokeWidth={0.7 * ss} />
      ))}
      <path d={`M${X(0.01)},${Y(-0.29)}L${X(0.04)},${Y(-0.29)}L${X(0.058)},${Y(-0.215)}L${X(0.01)},${Y(-0.215)}Z`} fill={SCENE.glass} stroke={shade(SCENE.glassEdge, 0.2)} strokeWidth={0.7 * ss} />
      {/* Rekkverk på baugen */}
      <path d={`M${X(0.12)},${Y(-0.155)}Q${X(0.3)},${Y(-0.165)} ${X(0.47)},${Y(-0.215)}M${X(0.25)},${Y(-0.13)}V${Y(-0.17)}M${X(0.38)},${Y(-0.145)}V${Y(-0.19)}`} stroke={SCENE.metal} strokeWidth={1.1 * ss} fill="none" />
      {/* Skroget */}
      <path d={hull} fill={`url(#${id}h)`} />
      <g clipPath={`url(#${id}k)`}>
        <path d={rail} stroke={PAINTS.blaa} strokeWidth={0.045 * L} fill="none" />
        <path d={rail} transform={`translate(0 ${r1(-0.018 * L)})`} stroke={SCENE.highlight} strokeWidth={0.012 * L} fill="none" />
        {/* Delen under vann */}
        <rect x={X(-0.6)} y={y} width={r1(1.2 * L)} height={r1(0.2 * L)} fill={alpha(SCENE.water, 0.55)} />
      </g>
      <path d={hull} fill="none" stroke={SCENE.outline} strokeWidth={0.9 * ss} />
      {/* Giveren under kjølen */}
      <path
        d={`M${r1(giver.x - 0.035 * L)},${r1(giver.y - 0.012 * L)}Q${r1(giver.x)},${r1(giver.y + 0.02 * L)} ${r1(giver.x + 0.035 * L)},${r1(giver.y - 0.012 * L)}Z`}
        fill={shade(SCENE.metalDark, 0.3)}
        stroke={SCENE.outline}
        strokeWidth={0.7 * ss}
      />
      {/* Skum langs vannlinja */}
      <path
        d={`M${X(-0.5)},${Y(0.002)}H${X(-0.38)}M${X(0.4)},${Y(0.002)}H${X(0.56)}`}
        stroke={tint(SCENE.waterLight, 0.6)}
        strokeWidth={2 * ss}
        strokeLinecap="round"
        opacity={0.9}
      />
    </g>
  );
});

/* ---------------------------------------------------------------- Ekkoloddskjerm */

/**
 * Skjermen til ekkoloddet (som i styrhuset): mørk skjerm i en ramme med tiden siden pulsen ble sendt, dybden når
 * ekkoet er tilbake, og bunnen tegnet som et bånd på riktig dybde (`bunn` = andel av skjermhøyden, null = ikke målt).
 * (x, y) er øverste venstre hjørne.
 */
export function Ekkoloddskjerm({
  x,
  y,
  w,
  h,
  tid,
  dybde,
  bunn,
}: {
  x: number;
  y: number;
  w: number;
  h: number;
  tid: string;
  dybde: string | null;
  bunn: number | null;
}) {
  const id = useSvgId('ekko-skjerm');
  const ss = useStrokeScale();
  const pad = 0.05 * w;
  const sx = x + pad;
  const sy = y + pad;
  const sw = w - 2 * pad;
  const sh = h - 2 * pad;
  // Ekkogrammet i høyre del av skjermen, teksten til venstre
  const gx = sx + sw * 0.62;
  const gw = sw * 0.34;
  const gy = sy + sh * 0.14;
  const gh = sh * 0.78;
  const by = bunn === null ? null : gy + Math.max(0.08, Math.min(0.92, bunn)) * gh;
  const txt = SCENE.displayText;
  return (
    <g aria-hidden>
      <LinearGradient
        id={id}
        stops={[
          [0, tint(PAINTS.svart, 0.25)],
          [1, shade(PAINTS.svart, 0.2)],
        ]}
      />
      <rect x={x} y={y} width={w} height={h} rx={0.06 * w} fill={`url(#${id})`} stroke={SCENE.outline} strokeWidth={1 * ss} />
      <rect x={sx} y={sy} width={sw} height={sh} rx={0.025 * w} fill={SCENE.display} />
      {/* Ekkogram: vannsøyla og bunnen */}
      <rect x={gx} y={gy} width={gw} height={gh} fill={alpha(txt, 0.06)} stroke={alpha(txt, 0.35)} strokeWidth={0.8 * ss} />
      {by !== null && (
        <>
          <rect x={gx} y={by} width={gw} height={gy + gh - by} fill={alpha(txt, 0.28)} />
          <line x1={gx} y1={by} x2={gx + gw} y2={by} stroke={txt} strokeWidth={2.4 * ss} />
        </>
      )}
      <Txt x={sx + sw * 0.05} y={sy + sh * 0.3} anchor="start" color={alpha(txt, 0.8)} size={0.72} halo={false}>
        Ekkolodd
      </Txt>
      <Txt x={sx + sw * 0.05} y={sy + sh * 0.6} anchor="start" color={txt} size={0.88} weight={650} halo={false}>
        {tid}
      </Txt>
      <Txt x={sx + sw * 0.05} y={sy + sh * 0.9} anchor="start" color={txt} size={0.88} weight={650} halo={false}>
        {dybde ?? '– m'}
      </Txt>
    </g>
  );
}
