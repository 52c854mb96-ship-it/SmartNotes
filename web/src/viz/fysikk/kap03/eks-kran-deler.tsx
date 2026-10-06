/**
 * Egne deler til eksempeloppgaven «Byggekran løfter en last» (k3-eks-kran). Scene-kit-et har ingen kran, bygg under
 * oppføring eller byggeplass, så de er tegnet her i samme stil: toninger fra core.tsx, SCENE- og PAINTS-farger,
 * kontur og myke skygger. Alle mål er i meter og regnes om med skalaen `ppm` (figurenheter per meter).
 *
 * - `Taarnkran`: tårnkran med fagverkstårn, førerhus, utligger, motutligger med motvekter og vinsj, tårnspiss med
 *   stag og løpekatten.
 * - `KrokOgLast`: wiren fra løpekatten, krokblokka, kroken, kjettingstroppene og lasta (`Last`).
 * - `Last`: pall med murstein, bunt med stålbjelker eller pall med gipsplater.
 * - `Bygg`: boligblokk under oppføring: ferdig murte etasjer med vinduer, en etasje der murerne holder på, en åpen
 *   etasje med søyler og stempler, og dekket med rekkverk.
 * - `Byggeplass`: fundamentet, brakkerigg, byggestrømskap med kabel og en arbeider som gir tegn til kranføreren.
 */
import { memo, useEffect, useRef, useState } from 'react';
import {
  ContactShadow,
  LinearGradient,
  PAINTS,
  Person,
  SCENE,
  alpha,
  materialStops,
  mix,
  shade,
  tint,
  useStrokeScale,
  useSvgId,
} from '../../kit/scene';
import { CRANE, FACADE_X, HOOK, LIFT_X, LOAD_DIMS, PERSON_HEIGHT, hookHeights, jibBottom, type CraneLayout } from './eks-kran-scene';
import type { CraneLoad } from './model-eks-kran';

const r1 = (v: number) => (Number.isFinite(v) ? Math.round(v * 10) / 10 : 0);
const pt = (x: number, y: number) => `${r1(x)},${r1(y)}`;

/** Kranfargen (gul lakk som på de fleste tårnkraner). */
const KRAN = PAINTS.gul;

/* ---------- Skalaen før figuren tegnes ---------- */

/**
 * Tekstskalaen figuren vil få (samme regel som i <Figure>) og om figuren er smal (mobil), målt på beholderen, så
 * utsnittet og høyden på figuren kan velges før den tegnes. Legg `ref` på en <div> rundt figuren.
 */
export function useFigureScale<T extends HTMLElement = HTMLDivElement>(vbWidth = 800) {
  const ref = useRef<T>(null);
  const [f, setF] = useState(1);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const update = () => {
      // Figurens innerkant (viz.css: 8 px på PC, 4 px på mobil) og kantlinje
      const w = el.getBoundingClientRect().width - (window.innerWidth <= 600 ? 10 : 18);
      if (w <= 0) return;
      setF(Math.round(Math.max(1, 12.5 / 17 / (w / vbWidth)) * 20) / 20);
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [vbWidth]);
  return { ref, f, narrow: f > 1.25 };
}

/* ---------- Hjelpere for fagverk ---------- */

type Bar = [number, number, number, number];

function barsPath(bars: Bar[]): string {
  return bars.map(([a, b, c, d]) => `M${pt(a, b)}L${pt(c, d)}`).join('');
}

/** Stenger i et fagverk: kontur under, lakk over (alle konturene først, så kryssene smelter sammen). */
function Bars({ bars, w, color, ss, outline = true }: { bars: Bar[]; w: number; color: string; ss: number; outline?: boolean }) {
  const d = barsPath(bars);
  return (
    <g fill="none" strokeLinecap="round">
      {outline && <path d={d} stroke={SCENE.outline} strokeWidth={w + 1.2 * ss} />}
      <path d={d} stroke={color} strokeWidth={w} />
    </g>
  );
}

/* ---------- Tårnkranen ---------- */

/**
 * Tårnkran (toppsvingt kran med tårnspiss) sett fra siden, med utliggeren mot høyre. Tårnet står midt i (L.X(0),
 * bakken). Løpekatten står `trolleyX` meter fra tårnet. Høyden følger løftehøyden h (se eks-kran-scene.ts).
 */
export const Taarnkran = memo(function Taarnkran({ L, h, trolleyX }: { L: CraneLayout; h: number; trolleyX: number }) {
  const ss = useStrokeScale();
  const id = useSvgId('kran');
  const p = L.ppm;
  const X = L.X;
  const Y = L.Y;
  const half = CRANE.mastW / 2;
  const base = 0.5;
  const top = h + CRANE.aboveRoof;
  const jb = jibBottom(h);
  const jt = jb + CRANE.jibDepth;
  const apex = jb + CRANE.apexH;
  const cw = Math.max(2 * ss, 0.16 * p);
  const bw = Math.max(1.15 * ss, 0.075 * p);

  // Tårnet: seksjoner på ca. 2,4 m med horisontaler og diagonaler i sikksakk (bakre side mørkere og motsatt vei)
  const n = Math.max(3, Math.round((top - base) / 2.4));
  const sh = (top - base) / n;
  const chords: Bar[] = [
    [X(-half), Y(base), X(-half), Y(top)],
    [X(half), Y(base), X(half), Y(top)],
  ];
  const front: Bar[] = [];
  const back: Bar[] = [];
  for (let i = 0; i < n; i++) {
    const y0 = base + i * sh;
    const y1 = y0 + sh;
    front.push([X(-half), Y(y0), X(half), Y(y0)]);
    if (i % 2 === 0) {
      front.push([X(-half), Y(y0), X(half), Y(y1)]);
      back.push([X(half), Y(y0), X(-half), Y(y1)]);
    } else {
      front.push([X(half), Y(y0), X(-half), Y(y1)]);
      back.push([X(-half), Y(y0), X(half), Y(y1)]);
    }
  }

  // Utliggeren: underkant (der løpekatten går), overkant som skrår ned mot spissen, og W-diagonaler
  const jibStart = 1.1;
  const tipStart = CRANE.jibLen - 1.6;
  const jibBars: Bar[] = [
    [X(jibStart), Y(jb), X(CRANE.jibLen), Y(jb)],
    [X(0.6), Y(jt), X(tipStart), Y(jt)],
    [X(tipStart), Y(jt), X(CRANE.jibLen), Y(jb)],
  ];
  const panel = 2.1;
  const jibDiag: Bar[] = [];
  for (let x = jibStart; x + panel / 2 <= tipStart + 0.01; x += panel) {
    jibDiag.push([X(x), Y(jb), X(x + panel / 2), Y(jt)]);
    const xe = Math.min(x + panel, CRANE.jibLen);
    const ye = x + panel > tipStart ? jb + (CRANE.jibDepth * (CRANE.jibLen - (x + panel))) / (CRANE.jibLen - tipStart) : jb;
    jibDiag.push([X(x + panel / 2), Y(jt), X(xe), Y(Math.max(jb, Math.min(jt, ye)))]);
  }

  // Motutliggeren: lavt fagverk med gangbane og rekkverk
  const cl = CRANE.counterLen;
  const cTop = jb + 0.75;
  const counterBars: Bar[] = [
    [X(-1.1), Y(jb), X(-cl), Y(jb)],
    [X(-1.1), Y(cTop), X(-cl), Y(cTop)],
  ];
  const counterDiag: Bar[] = [];
  for (let x = -1.1, i = 0; x > -cl + 0.2; x -= 1.8, i++) {
    const xe = Math.max(-cl, x - 1.8);
    counterDiag.push([X(x), Y(jb), X(x), Y(cTop)]);
    counterDiag.push(i % 2 ? [X(x), Y(jb), X(xe), Y(cTop)] : [X(x), Y(cTop), X(xe), Y(jb)]);
  }
  const rail: Bar[] = [[X(-1.4), Y(cTop + 1), X(-cl + 2.9), Y(cTop + 1)]];
  for (let x = -1.4; x >= -cl + 2.8; x -= 1.9) rail.push([X(x), Y(cTop), X(x), Y(cTop + 1)]);

  // Tårnspissen: to bein som møtes i toppen, med tverrstag
  const apexBars: Bar[] = [
    [X(-0.9), Y(jb + 0.1), X(0), Y(apex)],
    [X(0.9), Y(jb + 0.1), X(0), Y(apex)],
  ];
  const apexCross: Bar[] = [];
  for (const t of [0.3, 0.58, 0.8]) {
    const yy = jb + 0.1 + t * (apex - jb - 0.1);
    const w = 0.9 * (1 - t);
    apexCross.push([X(-w), Y(yy), X(w), Y(yy)]);
  }
  apexCross.push([X(-0.9), Y(jb + 0.1), X(0.9 * 0.7), Y(jb + 0.1 + 0.3 * (apex - jb - 0.1))]);
  apexCross.push([X(0.9 * 0.7), Y(jb + 0.1 + 0.3 * (apex - jb - 0.1)), X(-0.9 * 0.42), Y(jb + 0.1 + 0.58 * (apex - jb - 0.1))]);

  // Stagene fra tårnspissen til utliggeren og motutliggeren
  const ties: Bar[] = [
    [X(0), Y(apex - 0.15), X(0.43 * CRANE.jibLen), Y(jt)],
    [X(0), Y(apex - 0.15), X(0.8 * CRANE.jibLen), Y(jt)],
    [X(0), Y(apex - 0.15), X(-cl + 1.3), Y(cTop)],
  ];

  // Motvektene: tre betongblokker ytterst på motutliggeren
  const wW = 0.82;
  const wTop = cTop + 0.35;
  const wBot = jb - 2.3;
  const weights = [0, 1, 2].map((i) => -cl + 0.12 + i * (wW + 0.04));

  // Vinsjen: motor og trommel på gangbanen
  const drumX = -4.1;
  const drumR = 0.55;
  const drumY = cTop + drumR + 0.05;

  // Løpekatten
  const tx = trolleyX;

  return (
    <g>
      <LinearGradient id={`${id}-hode`} stops={materialStops(KRAN, 0.9)} />
      <LinearGradient id={`${id}-vekt`} x2={1} y2={0} stops={[[0, tint(SCENE.concrete, 0.15)], [0.6, SCENE.concrete], [1, shade(SCENE.concrete, 0.2)]]} />
      <LinearGradient id={`${id}-hus`} x2={1} y2={0} stops={[[0, tint(PAINTS.hvit, 0.2)], [1, shade(PAINTS.hvit, 0.12)]]} />
      <LinearGradient id={`${id}-glass`} x2={1} y2={1} stops={[[0, tint(SCENE.glass, 0.25)], [0.55, SCENE.glass], [1, shade(SCENE.glassEdge, 0.25)]]} />
      <LinearGradient id={`${id}-motor`} stops={materialStops(SCENE.metal, 1)} />

      {/* Tårnet: bakre diagonaler, så stenger og diagonaler foran */}
      <Bars bars={back} w={bw * 0.8} color={shade(KRAN, 0.38)} ss={ss} outline={false} />
      <Bars bars={[...front, ...chords]} w={bw} color={KRAN} ss={ss} />
      <Bars bars={chords} w={cw} color={KRAN} ss={ss} />
      {/* Lys på venstre stang (lyset kommer fra venstre) */}
      <line x1={X(-half) - cw * 0.18} y1={Y(base)} x2={X(-half) - cw * 0.18} y2={Y(top)} stroke={tint(KRAN, 0.45)} strokeWidth={cw * 0.3} opacity={0.8} />

      {/* Motutliggeren, rekkverket og stagene */}
      <Bars bars={rail} w={Math.max(1 * ss, 0.05 * p)} color={shade(KRAN, 0.1)} ss={ss} outline={false} />
      <Bars bars={[...counterDiag]} w={bw} color={KRAN} ss={ss} />
      <Bars bars={counterBars} w={cw} color={KRAN} ss={ss} />
      <Bars bars={ties} w={Math.max(1.2 * ss, 0.07 * p)} color={shade(KRAN, 0.12)} ss={ss} />

      {/* Vinsjen: motor (grå boks) og trommel med wire */}
      <rect
        x={X(drumX - 2.1)}
        y={Y(cTop + 1.0)}
        width={1.5 * p}
        height={1.0 * p}
        rx={0.12 * p}
        fill={`url(#${id}-motor)`}
        stroke={SCENE.outline}
        strokeWidth={0.8 * ss}
      />
      <rect x={X(drumX - 2.0)} y={Y(cTop + 0.85)} width={0.35 * p} height={0.6 * p} fill={shade(SCENE.metal, 0.3)} opacity={0.7} />
      <circle cx={X(drumX)} cy={Y(drumY)} r={drumR * p} fill={shade(SCENE.metalDark, 0.1)} stroke={SCENE.outline} strokeWidth={0.8 * ss} />
      <circle cx={X(drumX)} cy={Y(drumY)} r={drumR * 0.72 * p} fill="none" stroke={tint(SCENE.metalDark, 0.35)} strokeWidth={Math.max(0.6 * ss, 0.08 * p)} />
      <circle cx={X(drumX)} cy={Y(drumY)} r={drumR * 0.22 * p} fill={SCENE.metal} />
      {/* Wiren fra trommelen til tårnspissen og ut langs utliggeren */}
      <path
        d={`M${pt(X(drumX + drumR * 0.3), Y(drumY + drumR))} L${pt(X(-0.25), Y(jt + 0.6))} L${pt(X(0.6), Y(jt - 0.15))}`}
        fill="none"
        stroke={shade(SCENE.metalDark, 0.35)}
        strokeWidth={Math.max(0.9 * ss, 0.045 * p)}
      />

      {/* Motvektene */}
      {weights.map((x0, i) => (
        <g key={i}>
          <rect x={X(x0)} y={Y(wTop)} width={wW * p} height={(wTop - wBot) * p} rx={0.06 * p} fill={`url(#${id}-vekt)`} stroke={SCENE.outline} strokeWidth={0.8 * ss} />
          <line x1={X(x0 + 0.12)} x2={X(x0 + wW - 0.12)} y1={Y(wTop - 0.35)} y2={Y(wTop - 0.35)} stroke={shade(SCENE.concrete, 0.25)} strokeWidth={0.7 * ss} opacity={0.6} />
        </g>
      ))}

      {/* Svingkransen og hodet på toppen av tårnet */}
      <rect x={X(-half - 0.15)} y={Y(top + 0.35)} width={(CRANE.mastW + 0.3) * p} height={0.35 * p} fill={SCENE.metalDark} stroke={SCENE.outline} strokeWidth={0.8 * ss} />
      <rect x={X(-1.25)} y={Y(jb)} width={2.5 * p} height={(jb - top - 0.35) * p} rx={0.1 * p} fill={`url(#${id}-hode)`} stroke={SCENE.outline} strokeWidth={0.9 * ss} />

      {/* Utliggeren */}
      <Bars bars={jibDiag} w={bw} color={KRAN} ss={ss} />
      <Bars bars={jibBars} w={cw} color={KRAN} ss={ss} />

      {/* Tårnspissen med varsellampe */}
      <Bars bars={apexCross} w={bw} color={KRAN} ss={ss} />
      <Bars bars={apexBars} w={cw} color={KRAN} ss={ss} />
      <circle cx={X(0)} cy={Y(apex + 0.25)} r={Math.max(2 * ss, 0.24 * p)} fill={PAINTS.rod} stroke={SCENE.outline} strokeWidth={0.7 * ss} />

      {/* Førerhuset på siden av tårnhodet, med store vinduer mot utliggeren */}
      <g>
        <rect x={X(half + 0.05)} y={Y(jb - 0.15)} width={2.15 * p} height={2.35 * p} rx={0.18 * p} fill={`url(#${id}-hus)`} stroke={SCENE.outline} strokeWidth={0.9 * ss} />
        <path
          d={`M${pt(X(half + 0.75), Y(jb - 0.4))} H${r1(X(half + 2.0))} V${r1(Y(jb - 2.3))} H${r1(X(half + 1.15))} Z`}
          fill={`url(#${id}-glass)`}
          stroke={shade(PAINTS.hvit, 0.35)}
          strokeWidth={0.7 * ss}
        />
        <line x1={X(half + 1.2)} y1={Y(jb - 0.6)} x2={X(half + 1.75)} y2={Y(jb - 1.25)} stroke={SCENE.highlight} strokeWidth={Math.max(0.8 * ss, 0.08 * p)} opacity={0.7} />
        <rect x={X(half + 0.2)} y={Y(jb - 2.5)} width={2.0 * p} height={Math.max(1.5, 0.12 * p)} fill={SCENE.metalDark} />
      </g>

      {/* Løpekatten på underkanten av utliggeren */}
      <g>
        <circle cx={X(tx - 0.5)} cy={Y(jb - 0.05)} r={Math.max(1.2, 0.16 * p)} fill={SCENE.metalDark} />
        <circle cx={X(tx + 0.5)} cy={Y(jb - 0.05)} r={Math.max(1.2, 0.16 * p)} fill={SCENE.metalDark} />
        <rect x={X(tx - 0.85)} y={Y(jb - 0.12)} width={1.7 * p} height={0.55 * p} rx={0.08 * p} fill={`url(#${id}-hode)`} stroke={SCENE.outline} strokeWidth={0.8 * ss} />
      </g>
    </g>
  );
});

/* ---------- Kroken og lasta ---------- */

/** Der kjettingstroppene er festet på lasta (m fra midten, langs oversiden). */
const SLING_X: Record<CraneLoad, number> = { murstein: 0.5, stalbjelker: 1.75, gips: 1.0 };

/**
 * Wiren fra løpekatten (to parter), krokblokka, kroken, stroppene og lasta, med midten av lasta i x (figurenheter) og
 * underkanten i høyden `bottom` (m). `Xm`/`Ym` gjør om meter til figurenheter (scenen eller lupen), `p` er px/m.
 * `wireTop` er høyden (m) der wiren kommer fra (underkanten av løpekatten); uten den tegnes bare et stykke wire.
 */
export function KrokOgLast({
  load,
  x,
  bottom,
  p,
  Ym,
  wireTop,
  ghost,
  shadow,
}: {
  load: CraneLoad;
  x: number;
  bottom: number;
  p: number;
  Ym: (m: number) => number;
  wireTop?: number;
  ghost?: boolean;
  /** Skygge på bakken (når lasta står på bakken). */
  shadow?: boolean;
}) {
  const ss = useStrokeScale();
  const id = useSvgId('krok');
  const hh = hookHeights(load, bottom);
  const yLoadTop = Ym(hh.loadTop);
  const yHook = Ym(hh.hookPoint);
  const yBB = Ym(hh.blockBottom);
  const yBT = Ym(hh.blockTop);
  const bw = HOOK.blockW * p;
  const wireW = Math.max(0.9 * ss, 0.04 * p);
  const wTop = wireTop !== undefined ? Ym(wireTop) : yBT - 1.8 * p;
  const sx = SLING_X[load] * p;
  const chainW = Math.max(1.1 * ss, 0.045 * p);
  const links = `${r1(Math.max(1.6, 0.07 * p))} ${r1(Math.max(1, 0.035 * p))}`;
  if (ghost) {
    return (
      <g opacity={0.32}>
        <Last load={load} x={x} y={Ym(bottom)} p={p} />
      </g>
    );
  }
  return (
    <g>
      <LinearGradient id={`${id}-blokk`} x2={1} y2={0} stops={[[0, tint(KRAN, 0.25)], [0.5, KRAN], [1, shade(KRAN, 0.25)]]} />
      {/* Wiren: to parter fra løpekatten ned til trinsa i krokblokka */}
      {/* Mørk kant og lys stålkjerne, så wiren synes både mot lys himmel og i skumringen */}
      <g strokeLinecap="butt">
        <path d={`M${pt(x - 0.22 * p, wTop)}V${r1(yBT + 0.1 * p)}M${pt(x + 0.22 * p, wTop)}V${r1(yBT + 0.1 * p)}`} stroke={SCENE.outline} strokeWidth={wireW + 0.9 * ss} />
        <path d={`M${pt(x - 0.22 * p, wTop)}V${r1(yBT + 0.1 * p)}M${pt(x + 0.22 * p, wTop)}V${r1(yBT + 0.1 * p)}`} stroke={SCENE.metal} strokeWidth={wireW} />
      </g>
      {/* Krokblokka: gul med svarte varselstriper */}
      <defs>
        <clipPath id={`${id}-klipp`}>
          <rect x={x - bw / 2} y={yBT} width={bw} height={yBB - yBT} rx={0.1 * p} />
        </clipPath>
      </defs>
      <rect x={x - bw / 2} y={yBT} width={bw} height={yBB - yBT} rx={0.1 * p} fill={`url(#${id}-blokk)`} />
      <g clipPath={`url(#${id}-klipp)`} opacity={0.85}>
        {[-0.5, 0.05, 0.6].map((t, i) => (
          <path
            key={i}
            d={`M${pt(x - bw / 2, yBT + (t + 0.3) * (yBB - yBT))} L${pt(x + bw / 2, yBT + t * (yBB - yBT))} L${pt(x + bw / 2, yBT + (t + 0.16) * (yBB - yBT))} L${pt(x - bw / 2, yBT + (t + 0.46) * (yBB - yBT))} Z`}
            fill={PAINTS.svart}
          />
        ))}
      </g>
      <rect x={x - bw / 2} y={yBT} width={bw} height={yBB - yBT} rx={0.1 * p} fill="none" stroke={SCENE.outline} strokeWidth={0.8 * ss} />
      <circle cx={x} cy={yBT + 0.22 * p} r={Math.max(1, 0.1 * p)} fill={SCENE.metalDark} />
      {/* Kroken: skaft og bøyd krok med sikringsklaff */}
      <g fill="none" strokeLinecap="round">
        <path
          d={`M${pt(x, yBB)} V${r1(yHook - 0.2 * p)} A${r1(0.17 * p)},${r1(0.17 * p)} 0 1 1 ${pt(x + 0.3 * p, yHook - 0.2 * p)}`}
          stroke={SCENE.outline}
          strokeWidth={Math.max(2.4 * ss, 0.13 * p) + 1.1 * ss}
        />
        <path
          d={`M${pt(x, yBB)} V${r1(yHook - 0.2 * p)} A${r1(0.17 * p)},${r1(0.17 * p)} 0 1 1 ${pt(x + 0.3 * p, yHook - 0.2 * p)}`}
          stroke={SCENE.metal}
          strokeWidth={Math.max(2.4 * ss, 0.13 * p)}
        />
      </g>
      {/* Kjettingstroppene fra kroken ned til lasta */}
      <g fill="none" strokeLinecap="round">
        <path d={`M${pt(x - sx, yLoadTop)} L${pt(x + 0.13 * p, yHook)} L${pt(x + sx, yLoadTop)}`} stroke={SCENE.outline} strokeWidth={chainW + 1 * ss} strokeLinejoin="round" />
        <path
          d={`M${pt(x - sx, yLoadTop)} L${pt(x + 0.13 * p, yHook)} L${pt(x + sx, yLoadTop)}`}
          stroke={SCENE.metalLight}
          strokeWidth={chainW}
          strokeDasharray={links}
          strokeLinejoin="round"
        />
      </g>
      {shadow && <ContactShadow cx={x} cy={Ym(bottom) + 1} rx={(LOAD_DIMS[load].w * p) / 2 + 4} />}
      <Last load={load} x={x} y={Ym(bottom)} p={p} />
    </g>
  );
}

/**
 * Lasta sett fra siden. (x, y) er midt på underkanten (figurenheter), `p` er px/m. Pallen med murstein er 1,2 m
 * bred og 1,05 m høy, bunten med stålbjelker 6 m lang og 0,5 m høy, pallen med gipsplater 2,4 m lang og 0,62 m høy.
 */
export function Last({ load, x, y, p }: { load: CraneLoad; x: number; y: number; p: number }) {
  const ss = useStrokeScale();
  const id = useSvgId('last');
  const { w, h } = LOAD_DIMS[load];
  const L = x - (w / 2) * p;
  const R = x + (w / 2) * p;
  const at = (m: number) => y - m * p;
  const line = Math.max(0.5 * ss, 0.02 * p);

  if (load === 'stalbjelker') {
    // To lag med bjelker på strøbord, sett fra siden: flens oppe og nede, steget i midten
    const rows = [0.1, 0.3];
    const steel = mix(SCENE.metalDark, PAINTS.rod, 0.18);
    return (
      <g>
        <LinearGradient id={`${id}-st`} stops={[[0, tint(steel, 0.3)], [0.18, steel], [0.82, shade(steel, 0.15)], [1, shade(steel, 0.4)]]} />
        {[-2.2, 2.2].map((bx, i) => (
          <rect key={i} x={x + (bx - 0.1) * p} y={at(0.1)} width={0.2 * p} height={0.1 * p} fill={SCENE.wood} stroke={SCENE.outline} strokeWidth={0.6 * ss} />
        ))}
        {rows.map((r0, i) => (
          <g key={i}>
            <rect x={L + i * 0.06 * p} y={at(r0 + 0.2)} width={(w - 0.12 * i) * p} height={0.2 * p} fill={`url(#${id}-st)`} stroke={SCENE.outline} strokeWidth={0.7 * ss} />
            <line x1={L + i * 0.06 * p} x2={R - i * 0.06 * p} y1={at(r0 + 0.17)} y2={at(r0 + 0.17)} stroke={shade(steel, 0.35)} strokeWidth={line} opacity={0.7} />
            <line x1={L + i * 0.06 * p} x2={R - i * 0.06 * p} y1={at(r0 + 0.03)} y2={at(r0 + 0.03)} stroke={shade(steel, 0.35)} strokeWidth={line} opacity={0.7} />
          </g>
        ))}
        {/* Endene: I-profilet på bjelken nærmest */}
        <path
          d={`M${pt(R - 0.02 * p, at(0.3))} v${r1(-0.2 * p)} M${pt(R - 0.08 * p, at(0.5))} v${r1(-0.2 * p)}`}
          stroke={tint(steel, 0.4)}
          strokeWidth={line}
          opacity={0.8}
        />
      </g>
    );
  }

  // Pall (murstein og gips): bunnbord, klosser og toppbord
  const blocks = load === 'gips' ? [-1.1, -0.37, 0.37, 1.1] : [-0.54, 0, 0.54];
  const palletH = 0.144;
  const pallet = (
    <g>
      <rect x={L} y={at(0.022)} width={w * p} height={0.022 * p} fill={shade(SCENE.wood, 0.1)} stroke={SCENE.outline} strokeWidth={0.5 * ss} />
      {blocks.map((bx, i) => (
        <rect key={i} x={x + (bx - 0.05) * p} y={at(0.122)} width={0.1 * p} height={0.1 * p} fill={shade(SCENE.wood, 0.2)} stroke={SCENE.outline} strokeWidth={0.5 * ss} />
      ))}
      <rect x={L} y={at(palletH)} width={w * p} height={0.022 * p} fill={SCENE.woodLight} stroke={SCENE.outline} strokeWidth={0.5 * ss} />
    </g>
  );

  if (load === 'gips') {
    const board = PAINTS.hvit;
    const stackTop = h;
    const lines: number[] = [];
    const stepM = Math.max(0.05, 4 / p);
    for (let m = palletH + stepM; m < stackTop - 0.05; m += stepM) lines.push(m);
    return (
      <g>
        <LinearGradient id={`${id}-g`} stops={materialStops(board, 0.8)} />
        {pallet}
        <rect x={L} y={at(stackTop)} width={w * p} height={(stackTop - palletH) * p} fill={`url(#${id}-g)`} stroke={SCENE.outline} strokeWidth={0.7 * ss} />
        {lines.map((m, i) => (
          <line key={i} x1={L + 1} x2={R - 1} y1={at(m)} y2={at(m)} stroke={shade(board, 0.3)} strokeWidth={line} opacity={0.45} />
        ))}
        {/* Beskyttelsesplate øverst, stålbånd og en etikett */}
        <rect x={L} y={at(stackTop)} width={w * p} height={0.04 * p} fill={SCENE.woodLight} opacity={0.85} />
        {[-0.75, 0.75].map((bx, i) => (
          <line key={i} x1={x + bx * p} x2={x + bx * p} y1={at(stackTop)} y2={at(palletH)} stroke={shade(SCENE.metal, 0.25)} strokeWidth={Math.max(0.8 * ss, 0.035 * p)} />
        ))}
        <rect x={x - 0.18 * p} y={at(0.45)} width={0.36 * p} height={0.16 * p} fill={PAINTS.blaa} opacity={0.85} />
      </g>
    );
  }

  // Murstein: stablet i lag med forskjøvne fuger, plast over og stålbånd rundt
  const brick = SCENE.brick;
  const course = p * 0.13 >= 5 ? 0.13 : 0.26;
  const courses: number[] = [];
  for (let m = palletH + course; m < h - 0.04; m += course) courses.push(m);
  const joints: string[] = [];
  const brickL = course === 0.13 ? 0.25 : 0.4;
  for (let i = 0; i <= courses.length; i++) {
    const y0 = palletH + i * course;
    const y1 = Math.min(h, y0 + course);
    for (let bx = -w / 2 + (i % 2 ? brickL / 2 : brickL); bx < w / 2 - 0.05; bx += brickL) {
      joints.push(`M${pt(x + bx * p, at(y0))}V${r1(at(y1))}`);
    }
  }
  return (
    <g>
      <LinearGradient id={`${id}-m`} stops={materialStops(brick, 1)} />
      <LinearGradient id={`${id}-plast`} x2={1} y2={0} stops={[[0, SCENE.highlight, 0.35], [0.4, SCENE.highlight, 0], [1, SCENE.highlight, 0.12]]} />
      {pallet}
      <rect x={L} y={at(h)} width={w * p} height={(h - palletH) * p} fill={`url(#${id}-m)`} stroke={SCENE.outline} strokeWidth={0.7 * ss} />
      <g stroke={shade(brick, 0.42)} strokeWidth={line} opacity={0.55}>
        {courses.map((m, i) => (
          <line key={i} x1={L} x2={R} y1={at(m)} y2={at(m)} />
        ))}
        <path d={joints.join('')} fill="none" />
      </g>
      <rect x={L} y={at(h)} width={w * p} height={(h - palletH) * p} fill={`url(#${id}-plast)`} />
      <rect x={L} y={at(h)} width={w * p} height={0.05 * p} fill={tint(brick, 0.35)} opacity={0.7} />
      {[-0.32, 0.32].map((bx, i) => (
        <line key={i} x1={x + bx * p} x2={x + bx * p} y1={at(h)} y2={at(palletH)} stroke={SCENE.metalLight} strokeWidth={Math.max(0.8 * ss, 0.03 * p)} opacity={0.85} />
      ))}
    </g>
  );
}

/* ---------- Bygget ---------- */

/**
 * Boligblokk under oppføring, med veggen i FACADE_X og dekket i høyden h. Etasjene er like høye (ca. 3 m): de
 * nederste er ferdig murt med vinduer, i den nest øverste holder murerne på (muren er halvveis), den øverste er åpen
 * med søyler og stempler under dekket, og dekket har rekkverk.
 */
export const Bygg = memo(function Bygg({ L, h }: { L: CraneLayout; h: number }) {
  const ss = useStrokeScale();
  const id = useSvgId('bygg');
  const p = L.ppm;
  const X = L.X;
  const Y = L.Y;
  const x0 = X(FACADE_X);
  const x1 = L.W + 4;
  const n = Math.max(3, Math.round(h / 3));
  const fh = h / n;
  const slab = 0.3;
  const wallW = x1 - x0;
  const windows: number[] = [];
  for (let m = FACADE_X + 1.6; X(m + 1.3) < x1 + 20; m += 3.4) windows.push(m);
  const columns: number[] = [];
  for (let m = FACADE_X + 0.2; X(m) < x1 + 10; m += 4.2) columns.push(m);
  const brickLines: number[] = [];
  const brickStep = Math.max(0.3, 6 / p);
  for (let m = brickStep; m < (n - 2) * fh; m += brickStep) brickLines.push(m);
  const lastBrick = (n - 2) * fh + 1.15;
  const interior = shade(SCENE.concrete, 0.38);

  return (
    <g>
      <LinearGradient id={`${id}-tegl`} x2={1} y2={0} stops={[[0, tint(SCENE.brick, 0.12)], [0.15, SCENE.brick], [1, shade(SCENE.brick, 0.1)]]} />
      <LinearGradient id={`${id}-glass`} x2={1} y2={1} stops={[[0, tint(SCENE.glass, 0.3)], [0.5, SCENE.glass], [1, shade(SCENE.glassEdge, 0.2)]]} />
      <LinearGradient id={`${id}-inne`} stops={[[0, shade(interior, 0.3)], [0.35, interior], [1, tint(interior, 0.08)]]} />

      {/* Den åpne toppetasjen: mørkt innvendig, søyler og stempler under dekket */}
      <rect x={x0} y={Y(h)} width={wallW} height={fh * p} fill={`url(#${id}-inne)`} />
      <g stroke={SCENE.metal} strokeWidth={Math.max(0.8 * ss, 0.05 * p)} opacity={0.75}>
        {columns.map((m, i) =>
          [0.9, 1.9, 2.9].map((d, j) => <line key={`${i}-${j}`} x1={X(m + d)} x2={X(m + d)} y1={Y(h - slab)} y2={Y(h - fh + slab)} />),
        )}
      </g>
      {columns.map((m, i) => (
        <rect key={i} x={X(m)} y={Y(h)} width={0.4 * p} height={fh * p} fill={SCENE.concrete} stroke={SCENE.outline} strokeWidth={0.6 * ss} />
      ))}

      {/* Etasjen der murerne holder på: muren er kommet ca. 1,15 m opp */}
      <rect x={x0} y={Y(h - fh)} width={wallW} height={fh * p} fill={`url(#${id}-inne)`} />
      <rect x={x0} y={Y(lastBrick)} width={wallW} height={(lastBrick - (n - 2) * fh) * p} fill={`url(#${id}-tegl)`} />
      {columns.map((m, i) => (
        <rect key={i} x={X(m)} y={Y(h - fh)} width={0.4 * p} height={(fh - 1.15) * p} fill={SCENE.concrete} stroke={SCENE.outline} strokeWidth={0.6 * ss} />
      ))}

      {/* De ferdige etasjene: murt fasade med vinduer */}
      <rect x={x0} y={Y((n - 2) * fh)} width={wallW} height={(n - 2) * fh * p} fill={`url(#${id}-tegl)`} />
      <g stroke={shade(SCENE.brick, 0.35)} strokeWidth={Math.max(0.5, 0.03 * p)} opacity={0.4}>
        {brickLines.map((m, i) => (
          <line key={i} x1={x0} x2={x1} y1={Y(m)} y2={Y(m)} />
        ))}
      </g>
      {Array.from({ length: n - 2 }, (_, f) =>
        windows.map((m, i) => {
          const yb = f * fh + 0.9;
          return (
            <g key={`${f}-${i}`}>
              <rect x={X(m) - 0.08 * p} y={Y(yb + 1.45) - 0.08 * p} width={1.46 * p} height={1.61 * p} fill={tint(PAINTS.hvit, 0.1)} stroke={SCENE.outline} strokeWidth={0.5 * ss} />
              <rect x={X(m)} y={Y(yb + 1.45)} width={1.3 * p} height={1.45 * p} fill={`url(#${id}-glass)`} />
              <line x1={X(m + 0.65)} x2={X(m + 0.65)} y1={Y(yb + 1.45)} y2={Y(yb)} stroke={tint(PAINTS.hvit, 0.1)} strokeWidth={Math.max(0.6, 0.06 * p)} />
              <line x1={X(m + 0.15)} y1={Y(yb + 0.35)} x2={X(m + 0.5)} y2={Y(yb + 1.2)} stroke={SCENE.highlight} strokeWidth={Math.max(0.6, 0.07 * p)} opacity={0.55} />
              <rect x={X(m) - 0.12 * p} y={Y(yb) - 0.02 * p} width={1.54 * p} height={Math.max(1.2, 0.08 * p)} fill={shade(SCENE.concrete, 0.1)} />
            </g>
          );
        }),
      )}

      {/* Dekkene (betong) i hver etasje */}
      {Array.from({ length: n }, (_, f) => (
        <rect key={f} x={x0 - 0.15 * p} y={Y((f + 1) * fh)} width={wallW + 0.15 * p} height={slab * p} fill={SCENE.concrete} stroke={SCENE.outline} strokeWidth={0.6 * ss} />
      ))}
      {/* Hjørnet av bygget */}
      <rect x={x0} y={Y(h - fh + slab)} width={0.42 * p} height={(h - fh + slab - 0) * p} fill={tint(SCENE.brick, 0.08)} opacity={0.5} />
      <line x1={x0} x2={x0} y1={Y(h)} y2={Y(0)} stroke={SCENE.outline} strokeWidth={0.9 * ss} />

      {/* Rekkverket på dekket */}
      <g>
        <Bars
          bars={[
            [x0 + 0.6 * p, Y(h + 1.1), x1, Y(h + 1.1)],
            [x0 + 0.6 * p, Y(h + 0.55), x1, Y(h + 0.55)],
            ...columns.map((m): Bar => [X(m + 0.4), Y(h), X(m + 0.4), Y(h + 1.1)]),
            [x0 + 0.6 * p, Y(h), x0 + 0.6 * p, Y(h + 1.1)],
          ]}
          w={Math.max(1.1 * ss, 0.06 * p)}
          color={PAINTS.gul}
          ss={ss}
        />
        <rect x={x0 + 0.6 * p} y={Y(h + 0.2)} width={wallW} height={0.2 * p} fill={shade(SCENE.wood, 0.05)} stroke={SCENE.outline} strokeWidth={0.5 * ss} />
      </g>
    </g>
  );
});

/* ---------- Byggeplassen ---------- */

/**
 * Det som står på bakken: betongfundamentet til kranen, brakkerigg (to brakker oppå hverandre) under motutliggeren,
 * byggestrømskapet med kabel bort til tårnet, og en arbeider med hjelm og refleksjakke som gir tegn til kranføreren.
 */
export const Byggeplass = memo(function Byggeplass({ L, load }: { L: CraneLayout; load: CraneLoad }) {
  const ss = useStrokeScale();
  const id = useSvgId('plass');
  const p = L.ppm;
  const X = L.X;
  const Y = L.Y;
  const g = L.groundY;
  // Brakkene: 6 m lange og 2,6 m høye, to i høyden
  const hutX = -CRANE.counterLen - 0.6;
  const hutW = 6;
  const hutH = 2.6;
  // Byggestrømskapet ved foten av tårnet
  const boxX = -3.4;
  const boxW = 1.1;
  const boxH = 1.6;
  // Arbeideren til venstre for lasta
  const personX = LIFT_X - LOAD_DIMS[load].w / 2 - 2.2;
  const cableD = `M${pt(X(boxX + boxW / 2), Y(0.5))} Q${pt(X(boxX + boxW / 2), g + 2)} ${pt(X(boxX + boxW + 0.6), g + 2)} L${pt(X(-CRANE.footW / 2 - 0.1), g + 2)}`;
  return (
    <g>
      <LinearGradient id={`${id}-brakke`} stops={materialStops(PAINTS.hvit, 0.7)} />
      <LinearGradient id={`${id}-skap`} stops={materialStops(PAINTS.graa, 0.8)} />
      <LinearGradient id={`${id}-fund`} stops={materialStops(SCENE.concrete, 0.8)} />
      <LinearGradient id={`${id}-glass`} x2={1} y2={1} stops={[[0, tint(SCENE.glass, 0.3)], [1, shade(SCENE.glassEdge, 0.2)]]} />

      {/* Brakkerigg */}
      {[0, 1].map((lvl) => {
        const yb = lvl * hutH;
        return (
          <g key={lvl}>
            <rect x={X(hutX)} y={Y(yb + hutH)} width={hutW * p} height={hutH * p} rx={0.08 * p} fill={`url(#${id}-brakke)`} stroke={SCENE.outline} strokeWidth={0.8 * ss} />
            <g stroke={shade(PAINTS.hvit, 0.2)} strokeWidth={Math.max(0.5, 0.03 * p)} opacity={0.7}>
              {Array.from({ length: 11 }, (_, i) => (
                <line key={i} x1={X(hutX + 0.5 * (i + 1))} x2={X(hutX + 0.5 * (i + 1))} y1={Y(yb + hutH - 0.15)} y2={Y(yb + 0.15)} />
              ))}
            </g>
            {[0.8, 3.6].map((wx, i) => (
              <rect key={i} x={X(hutX + wx)} y={Y(yb + 2.0)} width={1.3 * p} height={0.9 * p} fill={`url(#${id}-glass)`} stroke={shade(PAINTS.hvit, 0.35)} strokeWidth={0.6 * ss} />
            ))}
            <rect x={X(hutX + 2.55)} y={Y(yb + 2.15)} width={0.85 * p} height={2.0 * p} fill={shade(PAINTS.hvit, 0.15)} stroke={SCENE.outline} strokeWidth={0.6 * ss} />
          </g>
        );
      })}
      <ContactShadow cx={X(hutX + hutW / 2)} cy={g} rx={(hutW / 2) * p + 4} opacity={0.7} />

      {/* Fundamentet til kranen */}
      <ContactShadow cx={X(0)} cy={g} rx={(CRANE.footW / 2) * p + 6} />
      <rect
        x={X(-CRANE.footW / 2)}
        y={Y(0.5)}
        width={CRANE.footW * p}
        height={0.5 * p + 3}
        rx={0.06 * p}
        fill={`url(#${id}-fund)`}
        stroke={SCENE.outline}
        strokeWidth={0.8 * ss}
      />

      {/* Byggestrømskapet og kabelen bort til tårnet */}
      <path d={cableD} fill="none" stroke={PAINTS.svart} strokeWidth={Math.max(1.6 * ss, 0.08 * p)} strokeLinecap="round" />
      <ContactShadow cx={X(boxX + boxW / 2)} cy={g} rx={(boxW / 2) * p + 3} />
      <rect x={X(boxX)} y={Y(boxH)} width={boxW * p} height={boxH * p} rx={0.06 * p} fill={`url(#${id}-skap)`} stroke={SCENE.outline} strokeWidth={0.8 * ss} />
      <rect x={X(boxX + 0.12)} y={Y(boxH - 0.12)} width={(boxW - 0.24) * p} height={(boxH - 0.5) * p} fill="none" stroke={shade(PAINTS.graa, 0.35)} strokeWidth={0.6 * ss} />
      <path d={`M${pt(X(boxX + boxW / 2 - 0.12), Y(boxH - 0.35))} l${r1(0.14 * p)},${r1(0.2 * p)} h${r1(-0.1 * p)} l${r1(0.12 * p)},${r1(0.22 * p)}`} fill="none" stroke={PAINTS.gul} strokeWidth={Math.max(0.8 * ss, 0.05 * p)} />

      {/* Arbeideren gir tegn til kranføreren med armen */}
      <Person
        x={X(personX)}
        y={g}
        size={PERSON_HEIGHT * p}
        pose="staa"
        jakke="gul"
        bukse={SCENE.denim}
        hjelm="hvit"
        ledd={{ hoyreSkulder: 165, hoyreAlbue: 15 }}
      />
    </g>
  );
});

/**
 * Strømmen til heisemotoren: kabelen fra byggestrømskapet langs bakken, opp gjennom tårnet og ut langs motutliggeren
 * til motoren. Tegnes bare når den skal fremheves (i d), i fargen til elektrisk energi, med en myk glorie.
 */
export function Stromvei({ L, h, color }: { L: CraneLayout; h: number; color: string }) {
  const ss = useStrokeScale();
  const p = L.ppm;
  const X = L.X;
  const Y = L.Y;
  const jb = jibBottom(h);
  const top = h + CRANE.aboveRoof;
  const cTop = jb + 0.75;
  const xin = -CRANE.mastW / 2 + 0.3;
  const d = [
    `M${pt(X(-2.85), Y(0.55))}`,
    `Q${pt(X(-2.85), L.groundY + 2)} ${pt(X(-2.2), L.groundY + 2)}`,
    `L${pt(X(xin), L.groundY + 2)}`,
    `L${pt(X(xin), Y(top))}`,
    `L${pt(X(-1.3), Y(cTop + 0.25))}`,
    `L${pt(X(-5.4), Y(cTop + 0.25))}`,
  ].join(' ');
  return (
    <g aria-hidden fill="none" strokeLinecap="round" strokeLinejoin="round">
      <path d={d} stroke={alpha(color, 0.3)} strokeWidth={Math.max(6 * ss, 0.35 * p)} />
      <path d={d} stroke={color} strokeWidth={Math.max(1.8 * ss, 0.09 * p)} />
    </g>
  );
}
