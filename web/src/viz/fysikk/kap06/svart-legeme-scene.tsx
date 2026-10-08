/**
 * Scenen i «Stråling fra svarte legemer» (k6-svart-legeme): glødende ting om kvelden, ordnet etter temperatur. På jorda
 * (tre små bilder, hvert i sin egen målestokk): en kokeplate som så vidt gløder, smijern på ambolten og glødetråden i en
 * lyspære. I verdensrommet: Betelgeuse, Sola, Sirius og Rigel. Hver ting står rett over sin temperatur på en
 * logaritmisk temperaturlinjal i glødefargen, og en markør viser temperaturen T som er valgt. Klikk på en ting eller på
 * linjalen for å velge temperatur.
 *
 * På PC står alt i én rad; på mobil (smal) får jorda og verdensrommet hver sin rad med hver sin del av linjalen.
 */
import { useState, type CSSProperties, type KeyboardEvent, type PointerEvent, type ReactNode } from 'react';
import { VIZ, fmt, useTextScale } from '../../kit';
import {
  Kokeplate,
  LinearGradient,
  Lyspaere,
  RadialGradient,
  SCENE,
  Stjerne,
  Stjernehimmel,
  alpha,
  mix,
  shade,
  tint,
  useSceneScale,
  useStrokeScale,
  useSvgId,
} from '../../kit/scene';
import {
  LEGEMER,
  LINJAL_SMAA,
  LINJAL_TALL,
  T_SPLIT,
  glodNivaa,
  glodRgb,
  linjalT,
  linjalX,
  plasserEtiketter,
  snapT,
  type Legeme,
  type LegemeId,
  type Linjal,
} from './model-svart-legeme';
import { Ambolt, Lampeholder, Lysskjaer, Smijern, amboltBane, rgbText } from './svart-legeme-deler';

const W = 800;
/** Høyden på hele scenen: én rad på PC, to rader på mobil. */
export const sceneHeight = (narrow: boolean) => (narrow ? 790 : 304);

interface Panel {
  sted: 'jorda' | 'rommet';
  x0: number;
  x1: number;
}

interface Rad {
  /** Toppen av bildene. */
  y: number;
  /** Høyden på bildene (linjalen kommer under). */
  h: number;
  paneler: Panel[];
  linjal: Linjal;
}

const XA = 34;
const XB = W - 34;

function rader(narrow: boolean): Rad[] {
  if (narrow) {
    return [
      { y: 0, h: 296, paneler: [{ sted: 'jorda', x0: 0, x1: W }], linjal: { Ta: 700, Tb: T_SPLIT, xa: XA, xb: XB } },
      { y: 396, h: 296, paneler: [{ sted: 'rommet', x0: 0, x1: W }], linjal: { Ta: T_SPLIT, Tb: 12000, xa: XA, xb: XB } },
    ];
  }
  const linjal: Linjal = { Ta: 700, Tb: 12000, xa: XA, xb: XB };
  const xs = Math.round(linjalX(T_SPLIT, linjal));
  return [
    {
      y: 0,
      h: 232,
      paneler: [
        { sted: 'jorda', x0: 0, x1: xs },
        { sted: 'rommet', x0: xs, x1: W },
      ],
      linjal,
    },
  ];
}

/** Lys tekst med mørk kant, til navn oppå de mørke bildene (samme i begge temaer). */
function NattTekst({ x, y, children, size = 1, weight = 650, anchor = 'middle', svak }: { x: number; y: number; children: ReactNode; size?: number; weight?: number; anchor?: 'start' | 'middle' | 'end'; svak?: boolean }) {
  const style: CSSProperties & Record<'--kj-fs', number> = {
    fill: svak ? alpha(SCENE.star, 0.78) : SCENE.star,
    stroke: alpha(SCENE.space, 0.7),
    strokeWidth: 3,
    fontWeight: weight,
    '--kj-fs': size,
  };
  return (
    <text x={x} y={y} textAnchor={anchor} className="kj-txt" style={style}>
      {children}
    </text>
  );
}

/** «5 800 K» med hardt mellomrom. */
const kelvin = (T: number) => `${fmt(T, 0)} K`;

export function TemperaturScene({ T, narrow, onPick }: { T: number; narrow: boolean; onPick: (T: number) => void }) {
  const f = useTextScale();
  const s = useSceneScale();
  const ss = useStrokeScale();
  const clip = useSvgId('sl-klipp');
  const [fokus, setFokus] = useState<LegemeId | null>(null);
  const rows = rader(narrow);
  const valgt = LEGEMER.find((l) => l.T === T)?.id ?? null;

  // Navnene: én etikett per ting, innenfor sitt bilde, og stablet i rader der de ellers ville overlappe.
  const nameFs = 17 * f * 0.92;
  const tempFs = 17 * f * 0.78;
  const blockH = nameFs + tempFs + 6;

  return (
    <g>
      <defs>
        {rows.map((r, i) => (
          <clipPath key={i} id={`${clip}-${i}`}>
            <rect x={0} y={r.y} width={W} height={r.h} rx={12} />
          </clipPath>
        ))}
      </defs>
      {rows.map((row, ri) => {
        const ting = LEGEMER.filter((l) => row.paneler.some((p) => p.sted === l.sted));
        const xOf = (l: Legeme) => linjalX(l.T, row.linjal);
        // Hvert bilde på jorda går midt mellom tingene; verdensrommet er ett stort bilde.
        const bilde = (l: Legeme) => {
          const p = row.paneler.find((pp) => pp.sted === l.sted)!;
          if (l.sted === 'rommet') return { x0: p.x0, x1: p.x1 };
          const jord = ting.filter((t) => t.sted === 'jorda');
          const i = jord.indexOf(l);
          const prev = jord[i - 1];
          const next = jord[i + 1];
          return { x0: prev ? (xOf(prev) + xOf(l)) / 2 : p.x0, x1: next ? (xOf(l) + xOf(next)) / 2 : p.x1 };
        };
        const labelW = (l: Legeme) => Math.max(l.navn.length * nameFs * 0.6, kelvin(l.T).length * tempFs * 0.58) + 14 * f;
        const lab = plasserEtiketter(
          ting.map((l) => {
            const b = bilde(l);
            return { x: xOf(l), w: labelW(l), min: b.x0 + 4, max: b.x1 - 4 };
          }),
          8 * f,
        );
        const labelBase = row.y + row.h - 10 - tempFs;
        return (
          <g key={ri}>
            <g clipPath={`url(#${clip}-${ri})`}>
              {row.paneler.map((p) =>
                p.sted === 'jorda' ? (
                  <Jorda key={p.sted} row={row} ting={ting.filter((t) => t.sted === 'jorda')} bilde={bilde} xOf={xOf} s={s} />
                ) : (
                  <Rommet key={p.sted} row={row} panel={p} ting={ting.filter((t) => t.sted === 'rommet')} xOf={xOf} s={s} narrow={narrow} />
                ),
              )}
              {/* Overskrifter */}
              {row.paneler.map((p) => (
                <NattTekst key={`o${p.sted}`} x={p.x0 + 12} y={row.y + 12 + nameFs * 0.8} size={0.78} weight={560} anchor="start" svak>
                  {p.sted === 'jorda' ? 'På jorda' : 'I verdensrommet'}
                </NattTekst>
              ))}
              {/* Navn og temperatur */}
              {ting.map((l, i) => {
                const pl = lab[i]!;
                const y = labelBase - pl.rad * (blockH + 4);
                const on = l.id === valgt;
                const w = labelW(l);
                return (
                  <g key={`n${l.id}`} aria-hidden>
                    {on && (
                      <rect
                        x={pl.x - w / 2}
                        y={y - nameFs * 0.95}
                        width={w}
                        height={blockH + 4}
                        rx={8 * f}
                        fill={VIZ.surface}
                        stroke={VIZ.ink}
                        strokeWidth={1.4 * ss}
                        opacity={0.96}
                      />
                    )}
                    {on ? (
                      <>
                        <text x={pl.x} y={y} textAnchor="middle" className="kj-txt no-halo" style={{ fontWeight: 700, ['--kj-fs' as string]: 0.92 }}>
                          {l.navn}
                        </text>
                        <text x={pl.x} y={y + tempFs + 4} textAnchor="middle" className="kj-txt no-halo is-muted" style={{ ['--kj-fs' as string]: 0.78 }}>
                          {kelvin(l.T)}
                        </text>
                      </>
                    ) : (
                      <>
                        <NattTekst x={pl.x} y={y} size={0.92}>
                          {l.navn}
                        </NattTekst>
                        <NattTekst x={pl.x} y={y + tempFs + 4} size={0.78} weight={520} svak>
                          {kelvin(l.T)}
                        </NattTekst>
                      </>
                    )}
                  </g>
                );
              })}
              {/* Skillelinjer mellom bildene */}
              {ting
                .filter((l) => l.sted === 'jorda')
                .map((l) => bilde(l).x1)
                .map((x, i) => (
                  <line key={`s${i}`} x1={x} y1={row.y} x2={x} y2={row.y + row.h} stroke={VIZ.surface} strokeWidth={3 * ss} />
                ))}
            </g>
            <rect x={0.75} y={row.y + 0.75} width={W - 1.5} height={row.h - 1.5} rx={12} fill="none" stroke={SCENE.outline} strokeWidth={1.2} opacity={0.6} />

            {/* Knapper: hele bildet (jorda) eller en stripe rundt stjerna (verdensrommet) */}
            {ting.map((l, i) => {
              const b = bilde(l);
              const prev = ting[i - 1];
              const next = ting[i + 1];
              const x0 = l.sted === 'rommet' && prev?.sted === 'rommet' ? (xOf(prev) + xOf(l)) / 2 : b.x0;
              const x1 = l.sted === 'rommet' && next?.sted === 'rommet' ? (xOf(l) + xOf(next)) / 2 : b.x1;
              const pick = () => onPick(l.T);
              return (
                <g
                  key={`k${l.id}`}
                  role="button"
                  tabIndex={0}
                  aria-label={`Velg ${l.navn.toLowerCase()}, ${kelvin(l.T)}`}
                  onClick={pick}
                  onKeyDown={(e: KeyboardEvent) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      pick();
                    }
                  }}
                  onFocus={() => setFokus(l.id)}
                  onBlur={() => setFokus(null)}
                  style={{ cursor: 'pointer', outline: 'none' }}
                >
                  <rect x={x0} y={row.y} width={x1 - x0} height={row.h} fill="transparent" />
                  {fokus === l.id && (
                    <rect x={x0 + 3} y={row.y + 3} width={x1 - x0 - 6} height={row.h - 6} rx={10} fill="none" stroke={VIZ.ink} strokeWidth={2.5 * ss} strokeDasharray="6 4" />
                  )}
                </g>
              );
            })}

            <Temperaturlinjal row={row} T={T} ting={ting} onPick={onPick} />
          </g>
        );
      })}
    </g>
  );
}

/* ------------------------------------------------------------------ Jorda */

function Jorda({
  row,
  ting,
  bilde,
  xOf,
  s,
}: {
  row: Rad;
  ting: Legeme[];
  bilde: (l: Legeme) => { x0: number; x1: number };
  xOf: (l: Legeme) => number;
  s: number;
}) {
  return (
    <g>
      {ting.map((l) => {
        const b = bilde(l);
        const x = xOf(l);
        if (l.id === 'kokeplate') return <Kjokken key={l.id} x={x} b={b} row={row} T={l.T} s={s} />;
        if (l.id === 'smijern') return <Smie key={l.id} x={x} b={b} row={row} T={l.T} s={s} />;
        return <Taklampe key={l.id} x={x} b={b} row={row} T={l.T} s={s} />;
      })}
    </g>
  );
}

interface BildeProps {
  /** Midt på tingen (rett over temperaturen på linjalen). */
  x: number;
  b: { x0: number; x1: number };
  row: Rad;
  T: number;
  s: number;
}

/** Kjøkkenbenk om kvelden med en kokeplate som så vidt gløder mørkerødt. */
function Kjokken({ x, b, row, T, s }: BildeProps) {
  const id = useSvgId('sl-kjokken');
  const ss = useStrokeScale();
  const top = row.y + row.h * 0.6;
  const wall = mix(SCENE.wall, SCENE.space, 0.78);
  const tile = mix(SCENE.wall, SCENE.space, 0.7);
  const bench = mix(SCENE.bench, SCENE.space, 0.55);
  const door = mix(SCENE.plastic, SCENE.space, 0.7);
  const w = Math.min(112 * s, (b.x1 - b.x0) * 0.78);
  const glod = rgbText(glodRgb(T));
  const tiles: ReactNode[] = [];
  const tw = 22 * s;
  for (let yy = top - 4 * tw; yy < top; yy += tw) tiles.push(<line key={`h${yy}`} x1={b.x0} x2={b.x1} y1={yy} y2={yy} />);
  for (let xx = b.x0 + 6; xx < b.x1; xx += tw) tiles.push(<line key={`v${xx}`} x1={xx} x2={xx} y1={top - 4 * tw} y2={top} />);
  const doorW = (b.x1 - b.x0 - 12) / 2;
  return (
    <g aria-hidden>
      <LinearGradient id={`${id}-v`} stops={[[0, shade(wall, 0.3)], [1, wall]]} />
      <rect x={b.x0} y={row.y} width={b.x1 - b.x0} height={top - row.y} fill={`url(#${id}-v)`} />
      {/* Fliser bak benken */}
      <rect x={b.x0} y={top - 4 * tw} width={b.x1 - b.x0} height={4 * tw} fill={tile} />
      <g stroke={shade(tile, 0.45)} strokeWidth={1.1 * ss}>
        {tiles}
      </g>
      <Lysskjaer x={x} y={top - 26 * s} rx={70 * s} ry={34 * s} farge={glod} styrke={0.9} />
      {/* Benkeplate og skapdører */}
      <rect x={b.x0} y={top} width={b.x1 - b.x0} height={row.h - (top - row.y)} fill={door} />
      <rect x={b.x0} y={top} width={b.x1 - b.x0} height={7 * s} fill={bench} />
      <line x1={b.x0} x2={b.x1} y1={top + 0.6} y2={top + 0.6} stroke={tint(bench, 0.35)} strokeWidth={1.2 * ss} />
      {[0, 1].map((i) => (
        <g key={i}>
          <rect
            x={b.x0 + 4 + i * (doorW + 4)}
            y={top + 11 * s}
            width={doorW}
            height={row.h}
            rx={3}
            fill={tint(door, 0.06)}
            stroke={shade(door, 0.5)}
            strokeWidth={1.2 * ss}
          />
          <rect x={b.x0 + 4 + i * (doorW + 4) + (i === 0 ? doorW - 12 * s : 6 * s)} y={top + 18 * s} width={6 * s} height={2.4 * s} rx={1} fill={tint(door, 0.35)} />
        </g>
      ))}
      <Kokeplate x={x} y={top} w={w} effekt={0.35 + 0.5 * glodNivaa(T)} />
      {/* Plata gløder i fargen temperaturen gir */}
      <Lysskjaer x={x} y={top - 0.33 * w} rx={0.42 * w} ry={0.16 * w} farge={glod} styrke={1.4} />
    </g>
  );
}

/** Mørk smie: ambolt på en stubbe og glødende smijern i tanga. */
function Smie({ x, b, row, T, s }: BildeProps) {
  const id = useSvgId('sl-smie');
  const ss = useStrokeScale();
  const brick = mix(SCENE.brick, SCENE.space, 0.72);
  const size = Math.min(112 * s, (b.x1 - b.x0) * 0.7);
  const k = size / 100;
  const floor = row.y + row.h * 0.8;
  // Banen omtrent midt i bildet, stubben ned til gulvet
  const stubbe = Math.max(30 * k, floor - (row.y + row.h * 0.5) - 45 * k);
  // Ambolten står slik at den glødende enden av jernet er rett over temperaturen
  const ax = x + 10 * k;
  const bane = amboltBane({ x: ax, y: floor, size, stubbe });
  const glod = rgbText(glodRgb(T));
  const bricks: ReactNode[] = [];
  const bh = 13 * s;
  const bw = 34 * s;
  for (let yy = row.y, j = 0; yy < floor; yy += bh, j++) {
    bricks.push(<line key={`h${j}`} x1={b.x0} x2={b.x1} y1={yy} y2={yy} />);
    for (let xx = b.x0 + (j % 2 ? bw / 2 : 0); xx < b.x1; xx += bw) bricks.push(<line key={`v${j}-${xx}`} x1={xx} x2={xx} y1={yy} y2={Math.min(floor, yy + bh)} />);
  }
  return (
    <g aria-hidden>
      <LinearGradient id={`${id}-v`} stops={[[0, shade(brick, 0.35)], [1, brick]]} />
      <rect x={b.x0} y={row.y} width={b.x1 - b.x0} height={floor - row.y} fill={`url(#${id}-v)`} />
      <g stroke={shade(brick, 0.5)} strokeWidth={1.1 * ss} opacity={0.8}>
        {bricks}
      </g>
      <rect x={b.x0} y={floor} width={b.x1 - b.x0} height={row.y + row.h - floor} fill={mix(SCENE.concreteDark, SCENE.space, 0.62)} />
      <line x1={b.x0} x2={b.x1} y1={floor} y2={floor} stroke={mix(SCENE.concrete, SCENE.space, 0.5)} strokeWidth={1.2 * ss} />
      <Lysskjaer x={bane.x - 10 * k} y={bane.y - 8 * k} rx={110 * k} ry={80 * k} farge={glod} styrke={1.4 * glodNivaa(T)} />
      <Ambolt x={ax} y={floor} size={size} stubbe={stubbe} />
      <Smijern x={bane.x - 42 * k} y={bane.y} size={0.82 * size} glod={glod} styrke={glodNivaa(T)} />
    </g>
  );
}

/** Glødelampe som henger fra taket i et mørkt rom. */
function Taklampe({ x, b, row, s }: BildeProps) {
  const id = useSvgId('sl-lampe');
  const wall = mix(SCENE.wall, SCENE.space, 0.8);
  const size = Math.min(78 * s, (b.x1 - b.x0) * 0.62);
  const holderY = row.y + row.h * 0.2;
  return (
    <g aria-hidden>
      <LinearGradient id={`${id}-v`} stops={[[0, shade(wall, 0.25)], [1, wall]]} />
      <rect x={b.x0} y={row.y} width={b.x1 - b.x0} height={row.h} fill={`url(#${id}-v)`} />
      <RadialGradient id={`${id}-l`} stops={[[0, SCENE.glow, 0.28], [0.5, SCENE.warm, 0.1], [1, SCENE.warm, 0]]} />
      <ellipse cx={x} cy={holderY + size * 0.6} rx={(b.x1 - b.x0) * 0.75} ry={row.h * 0.55} fill={`url(#${id}-l)`} />
      <Lampeholder x={x} y1={row.y} y2={holderY} size={size} />
      <Lyspaere x={x} y={holderY} size={size} lysstyrke={1} rotate={180} />
    </g>
  );
}

/* ------------------------------------------------------------------ Verdensrommet */

/** Høyden på stjernene i bildet (0 = toppen, 1 = bunnen), valgt så navnene under får plass. */
const STJERNE_Y: Partial<Record<LegemeId, number>> = { betelgeuse: 0.3, sola: 0.4, sirius: 0.26, rigel: 0.48 };

function Rommet({ row, panel, ting, xOf, s, narrow }: { row: Rad; panel: Panel; ting: Legeme[]; xOf: (l: Legeme) => number; s: number; narrow: boolean }) {
  return (
    <g>
      <Stjernehimmel x={panel.x0} y={row.y} w={panel.x1 - panel.x0} h={row.h} seed={narrow ? 5 : 3} melkevei={0.55} />
      {ting.map((l) => {
        const x = Math.min(panel.x1 - 20 * s, Math.max(panel.x0 + 20 * s, xOf(l)));
        const y = row.y + row.h * (STJERNE_Y[l.id] ?? 0.4);
        if (l.id === 'sola') return <Stjerne key={l.id} x={x} y={y} r={24 * s} temperatur={l.T} glod={0.75} metning={1.3} />;
        if (l.id === 'betelgeuse') return <Stjerne key={l.id} x={x} y={y} r={11 * s} temperatur={l.T} glod={0.9} metning={1.3} />;
        return <Stjerne key={l.id} x={x} y={y} r={7 * s} temperatur={l.T} glod={0.8} metning={1.3} glimt />;
      })}
    </g>
  );
}

/* ------------------------------------------------------------------ Linjalen */

/**
 * Logaritmisk temperaturlinjal i glødefargen under bildene: svart der ingenting gløder, så mørkerødt, oransje, hvitt og
 * blåhvitt. Strekene viser tingene i bildet over, og markøren temperaturen T. Klikk (eller dra med musa) for å velge T.
 */
function Temperaturlinjal({ row, T, ting, onPick }: { row: Rad; T: number; ting: Legeme[]; onPick: (T: number) => void }) {
  const f = useTextScale();
  const ss = useStrokeScale();
  const id = useSvgId('sl-linjal');
  const l = row.linjal;
  const y0 = row.y + row.h + 12;
  const h = 12 + 3 * f;
  const y1 = y0 + h;
  const tickFs = 17 * f * 0.78;
  const tagFs = 17 * f * 0.88;
  const inside = T >= l.Ta - 1e-9 && T <= l.Tb + 1e-9;
  const xT = linjalX(T, l);
  const stops: [number, string][] = [];
  for (let i = 0; i <= 40; i++) {
    const t = l.Ta * (l.Tb / l.Ta) ** (i / 40);
    stops.push([i / 40, rgbText(glodRgb(t))]);
  }
  const tag = `T = ${fmt(T, 0)} K`;
  const tagW = tag.length * tagFs * 0.58 + 18 * f;
  const tagH = tagFs * 1.5;
  const tagX = Math.min(XB + 30 - tagW / 2, Math.max(XA - 30 + tagW / 2, xT));
  const tagY = y1 + 8 + tagH / 2;
  const labels = LINJAL_TALL.filter((t) => t >= l.Ta && t <= l.Tb);
  const labelText = (t: number) => `${fmt(t, 0)} K`;
  const hidden = (t: number) => {
    if (!inside) return false;
    const x = linjalX(t, l);
    const w = labelText(t).length * tickFs * 0.58;
    return Math.abs(x - tagX) < (w + tagW) / 2 + 4;
  };
  const pick = (e: PointerEvent<SVGRectElement>) => {
    const svg = e.currentTarget.ownerSVGElement;
    const m = svg?.getScreenCTM();
    if (!svg || !m) return;
    const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(m.inverse());
    onPick(snapT(linjalT(p.x, l)));
  };
  return (
    <g>
      <LinearGradient id={id} x2={1} y2={0} stops={stops} />
      <rect x={l.xa} y={y0} width={l.xb - l.xa} height={h} rx={h / 2} fill={`url(#${id})`} stroke={SCENE.outline} strokeWidth={1.2 * ss} />
      {/* Små streker og tall */}
      {LINJAL_SMAA.filter((t) => t > l.Ta && t < l.Tb).map((t) => (
        <line key={`m${t}`} x1={linjalX(t, l)} x2={linjalX(t, l)} y1={y1} y2={y1 + 4} stroke={VIZ.muted} strokeWidth={1.2 * ss} />
      ))}
      {labels.map((t) => (
        <g key={`t${t}`}>
          <line x1={linjalX(t, l)} x2={linjalX(t, l)} y1={y1} y2={y1 + 7} stroke={VIZ.muted} strokeWidth={1.4 * ss} />
          {!hidden(t) && (
            <text x={linjalX(t, l)} y={y1 + 8 + tickFs} textAnchor="middle" className="kj-txt is-muted" style={{ ['--kj-fs' as string]: 0.78 }}>
              {labelText(t)}
            </text>
          )}
        </g>
      ))}
      {/* Tingene i bildet over: små hakk i overkanten */}
      {ting.map((t) => {
        const x = linjalX(t.T, l);
        return <path key={t.id} d={`M${x - 5 * ss},${y0 - 7 * ss}L${x + 5 * ss},${y0 - 7 * ss}L${x},${y0 - 0.5}Z`} fill={VIZ.muted} />;
      })}
      {/* Klikkflate */}
      <rect
        x={l.xa - 10}
        y={y0 - 10}
        width={l.xb - l.xa + 20}
        height={h + 20}
        fill="transparent"
        style={{ cursor: 'pointer', touchAction: 'pan-y' }}
        aria-hidden
        onPointerDown={(e) => {
          pick(e);
          if (e.pointerType === 'mouse') e.currentTarget.setPointerCapture(e.pointerId);
        }}
        onPointerMove={(e) => {
          if (e.currentTarget.hasPointerCapture(e.pointerId)) pick(e);
        }}
      />
      {/* Markøren for T */}
      {inside && (
        <g pointerEvents="none">
          <line x1={xT} x2={xT} y1={y0 - 6} y2={y1 + 6} stroke={VIZ.surface} strokeWidth={6 * ss} strokeLinecap="round" />
          <line x1={xT} x2={xT} y1={y0 - 6} y2={y1 + 6} stroke={VIZ.ink} strokeWidth={2.6 * ss} strokeLinecap="round" />
          <circle cx={xT} cy={(y0 + y1) / 2} r={h / 2 + 4 * ss} fill={rgbText(glodRgb(T))} stroke={VIZ.ink} strokeWidth={2.2 * ss} />
          <rect x={tagX - tagW / 2} y={tagY - tagH / 2} width={tagW} height={tagH} rx={tagH * 0.32} fill={VIZ.surface} stroke={VIZ.ink} strokeWidth={1.4 * ss} />
          <text x={tagX} y={tagY + tagFs * 0.35} textAnchor="middle" className="kj-txt no-halo" style={{ fontWeight: 700, ['--kj-fs' as string]: 0.88 }}>
            {tag}
          </text>
        </g>
      )}
    </g>
  );
}
