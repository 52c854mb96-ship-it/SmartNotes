/**
 * Kromosomer i SVG: én kromatide, et kromosom med to søsterkromatider, og en hel celledelingsfigur for en fase av
 * mitosen eller meiosen (`<Delingsfigur>`, plassering fra kromosomer.ts).
 *
 * Fargen sier hvilket homologt par kromosomet hører til og om det kommer fra mor (varme farger) eller far (kalde).
 * Etter overkrysning har kromatiden stykker i den andre forelderens farge.
 *
 * Kromatidene flyttes med CSS-transformasjoner (klassen `bio-anim`), så når fasen byttes, glir de rolig til nye
 * plasser (av når brukeren har redusert bevegelse).
 */
import type { CSSProperties, ReactNode } from 'react';
import { VIZ } from '../../kit';
import { kromosomFarge, BIO, type Opphav } from './colors';
import { DIM_OPACITY, useLineScale, useSvgId } from './felles';
import { cellOutlinePath, layoutPhase, type LayoutOptions, type Segment } from './kromosomer';
import { Cellemembran } from './celle';
import { BoksToning, LYS, lysRetning, lysere, morkere, volumStops } from './lys';
import { mix } from '../../kit/scene/core';

export interface KromatideProps {
  /** Sentromeret. */
  x: number;
  y: number;
  /** Total lengde fra ende til ende (figurenheter). */
  lengde: number;
  /** Tykkelse (standard lengde · 0,16, mellom 6 og 13). */
  bredde?: number;
  /** Sentromerets plass fra øverste ende (0–1), standard 0,5. */
  sentromer?: number;
  /** Rotasjon av hele kromatiden (grader, 0 = loddrett). */
  rot?: number;
  /** Ekstra rotasjon av øvre og nedre arm (grader med klokka), f.eks. V-form i anafasen. */
  armU?: number;
  armL?: number;
  par: number;
  opphav: Opphav;
  /** Stykker med farge fra den andre forelderen (overkrysning). */
  segmenter?: readonly Segment[];
  /** false = utstrakt kromatin (interfasen), tegnet som en tynn, bølgete tråd. */
  kondensert?: boolean;
  /** Mørk prikk ved sentromeret (standard true; skjules når søsterkromatidene tegnes sammen). */
  sentromerPrikk?: boolean;
  highlight?: boolean;
  dim?: boolean;
}

const tf = (x: number, y: number, rot: number): CSSProperties => ({ transform: `translate(${x}px, ${y}px) rotate(${rot}deg)` });
const rotOnly = (deg: number): CSSProperties => ({ transform: `rotate(${deg}deg)` });

/** Standard kromatidebredde for en lengde. */
export function chromatidWidth(lengde: number): number {
  return Math.min(13, Math.max(6, lengde * 0.16));
}

/** Én kromatide: to armer fra sentromeret, tegnet som tykke, avrundede streker. */
export function Kromatide({
  x,
  y,
  lengde,
  bredde,
  sentromer = 0.5,
  rot = 0,
  armU = 0,
  armL = 0,
  par,
  opphav,
  segmenter = [],
  kondensert = true,
  sentromerPrikk = true,
  highlight,
  dim,
}: KromatideProps) {
  const lw = useLineScale();
  const uid = useSvgId('bio-kromatide');
  const W = bredde ?? chromatidWidth(lengde);
  const color = kromosomFarge(par, opphav);
  // Utstrakt kromatin (interfasen) er lengre og tynnere enn et kondensert kromosom
  const stretch = kondensert ? 1 : 1.7;
  const up = Math.max(0, sentromer * lengde * stretch - W / 2);
  const down = Math.max(0, (1 - sentromer) * lengde * stretch - W / 2);
  const arm = (len: number, dir: -1 | 1, from: number, to: number, armRot: number) => {
    // Stykker av denne armen: [fra, til] langs kromatiden (0 øverst, 1 nederst) → avstand fra sentromeret
    const segs = segmenter.flatMap((s) => {
      const a = Math.max(s.fra, from);
      const b = Math.min(s.til, to);
      if (b <= a) return [];
      const d0 = Math.abs((dir === -1 ? b : a) - sentromer) * lengde * stretch;
      const d1 = Math.abs((dir === -1 ? a : b) - sentromer) * lengde * stretch;
      const end = dir === -1 ? a === 0 : b === 1;
      return [{ d0, d1: end ? len : Math.min(len, d1), end, c: kromosomFarge(par, s.opphav) }];
    });
    if (!kondensert) {
      // Utstrakt kromatin: en bølgete tråd; stykker etter overkrysning følger tråden
      const amp = W * 0.6;
      const wave = (d0: number, d1: number) => {
        const n = Math.max(2, Math.ceil((d1 - d0) / 2));
        const pts: string[] = [];
        for (let i = 0; i <= n; i++) {
          const d = d0 + ((d1 - d0) * i) / n;
          pts.push(
            `${(amp * Math.sin((d / (W * 1.6)) * Math.PI) + amp * 0.8 * Math.sin((d / (W * 5.3)) * Math.PI)).toFixed(2)},${(dir * d).toFixed(2)}`,
          );
        }
        return `M${pts.join(' L')}`;
      };
      return (
        <g className="bio-anim" style={rotOnly(armRot)}>
          <path d={wave(0, len + W / 2)} fill="none" stroke={color} strokeWidth={2.2 * lw} strokeLinecap="round" strokeLinejoin="round" />
          {segs.map((s, i) => (
            <path
              key={i}
              d={wave(s.d0, s.end ? len + W / 2 : s.d1)}
              fill="none"
              stroke={s.c}
              strokeWidth={2.2 * lw}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ))}
        </g>
      );
    }
    // Kromatiden er et rør: lys stripe på siden mot lyset (øvre venstre i figuren) og skygge på motsatt side. Glans og
    // skygge er gjennomsiktige, så de går uavbrutt over stykker med den andre forelderens farge.
    const toLight = lysRetning(rot + armRot).x >= 0 ? 1 : -1;
    const tip = dir * len;
    const gid = `${uid}${dir < 0 ? 'u' : 'l'}`;
    return (
      <g className="bio-anim" style={rotOnly(armRot)}>
        <line x1={0} y1={0} x2={0} y2={tip} stroke={VIZ.surface} strokeWidth={W + 3} strokeLinecap="round" />
        {highlight && (
          <line x1={0} y1={0} x2={0} y2={tip} stroke={color} strokeOpacity={0.3} strokeWidth={W + 10 * lw} strokeLinecap="round" />
        )}
        <line x1={0} y1={0} x2={0} y2={tip} stroke={color} strokeWidth={W} strokeLinecap="round" />
        {segs.map((s, i) => (
          <g key={i}>
            <line x1={0} y1={dir * s.d0} x2={0} y2={dir * s.d1} stroke={s.c} strokeWidth={W} strokeLinecap="butt" />
            {s.end && <circle cx={0} cy={dir * s.d1} r={W / 2} fill={s.c} />}
          </g>
        ))}
        <defs>
          <linearGradient id={gid} gradientUnits="userSpaceOnUse" x1={(toLight * W) / 2} y1={0} x2={(-toLight * W) / 2} y2={0}>
            <stop offset={0} style={{ stopColor: LYS.glans, stopOpacity: 0.3 }} />
            <stop offset={0.27} style={{ stopColor: LYS.glans, stopOpacity: 0.85 }} />
            <stop offset={0.52} style={{ stopColor: LYS.glans, stopOpacity: 0 }} />
            <stop offset={0.6} style={{ stopColor: LYS.mork, stopOpacity: 0 }} />
            <stop offset={1} style={{ stopColor: LYS.mork, stopOpacity: 1 }} />
          </linearGradient>
        </defs>
        <line x1={0} y1={0} x2={0} y2={tip} stroke={`url(#${gid})`} strokeWidth={W} strokeLinecap="round" />
      </g>
    );
  };
  return (
    <g className="bio-anim" style={tf(x, y, rot)} opacity={dim ? DIM_OPACITY : undefined}>
      {arm(up, -1, 0, sentromer, armU)}
      {arm(down, 1, sentromer, 1, armL)}
      {kondensert && sentromerPrikk && <circle r={W * 0.3} fill={VIZ.ink} opacity={0.45} />}
    </g>
  );
}

export interface KromosomProps extends Omit<KromatideProps, 'armU' | 'armL' | 'segmenter' | 'sentromerPrikk'> {
  /** 1 = ett kromosom med én kromatide, 2 = to søsterkromatider holdt sammen i sentromeret (etter S-fasen). */
  kromatider?: 1 | 2;
  /** Stykker etter overkrysning for hver søsterkromatide ([a, b]). */
  segmenter?: readonly [readonly Segment[], readonly Segment[]];
  /** Hvor mye armene spriker (grader), standard 7 (X-form). */
  splay?: number;
}

/** Et kromosom: én kromatide eller to søsterkromatider med felles sentromer (X-form). */
export function Kromosom({ kromatider = 2, segmenter, splay = 7, x, y, rot = 0, ...rest }: KromosomProps) {
  const W = rest.bredde ?? chromatidWidth(rest.lengde);
  if (kromatider === 1) return <Kromatide x={x} y={y} rot={rot} segmenter={segmenter?.[0]} {...rest} />;
  const off = W / 2 + 0.6;
  const rad = (rot * Math.PI) / 180;
  const nx = Math.cos(rad);
  const ny = Math.sin(rad);
  return (
    <g>
      <Kromatide
        x={x - nx * off}
        y={y - ny * off}
        rot={rot}
        armU={-splay}
        armL={splay}
        segmenter={segmenter?.[0]}
        sentromerPrikk={false}
        {...rest}
      />
      <Kromatide
        x={x + nx * off}
        y={y + ny * off}
        rot={rot}
        armU={splay}
        armL={-splay}
        segmenter={segmenter?.[1]}
        sentromerPrikk={false}
        {...rest}
      />
      <Sentromer x={x} y={y} rot={rot} W={W} par={rest.par} opphav={rest.opphav} dim={rest.dim} />
    </g>
  );
}

/** Sentromeret som holder to søsterkromatider sammen. */
function Sentromer({
  x,
  y,
  rot,
  W,
  par,
  opphav,
  dim,
}: {
  x: number;
  y: number;
  rot: number;
  W: number;
  par: number;
  opphav: Opphav;
  dim?: boolean;
}) {
  return (
    <g className="bio-anim" style={tf(x, y, rot)} opacity={dim ? DIM_OPACITY : undefined}>
      <ellipse rx={W + 0.9} ry={W * 0.42} fill={kromosomFarge(par, opphav)} />
      <ellipse rx={W * 0.55} ry={W * 0.3} fill={morkere(kromosomFarge(par, opphav), 0.55)} opacity={0.85} />
    </g>
  );
}

export interface DelingsfigurProps extends LayoutOptions {
  /** Vis spoletrådene (standard true). */
  spole?: boolean;
  /** Ekstra innhold oppå figuren (etiketter). */
  children?: ReactNode;
}

/**
 * Hele cella (eller cellene) i én fase av mitose, meiose I eller meiose II: cellemembran, kjerne, spole,
 * ekvatorplan og kromosomer. Bytt `fase`, så glir kromatidene til nye plasser.
 *
 *   <Delingsfigur deling="meiose1" fase="metafase" n={2} box={{ x: 20, y: 20, w: 760, h: 320 }} overkrysning />
 */
export function Delingsfigur({ spole = true, children, ...opts }: DelingsfigurProps) {
  const lw = useLineScale();
  const lay = layoutPhase(opts);
  const paired = new Set(lay.innsnoring.flat());
  const outlines = [
    ...lay.innsnoring.map(([a, b]) => cellOutlinePath(lay.celler[a]!, lay.celler[b]!, 0.42)),
    ...lay.celler.flatMap((c, i) => (paired.has(i) ? [] : [cellOutlinePath(c)])),
  ];
  const sorted = [...lay.kromatider].sort((a, b) => (a.key < b.key ? -1 : 1));
  const id = useSvgId('bio-deling');
  return (
    <g>
      <BoksToning
        id={`${id}c`}
        stops={[
          [0, lysere(BIO.cytoplasma, 0.5, BIO.lipidHode)],
          [0.42, lysere(BIO.cytoplasma, 0.12, BIO.lipidHode)],
          [0.8, BIO.cytoplasma],
          [1, mix(BIO.cytoplasma, BIO.membran, 0.14)],
        ]}
      />
      <BoksToning id={`${id}k`} stops={volumStops(BIO.kjerne.fill, 0.8, 1, undefined, BIO.kjerne.line)} />
      {outlines.map((d, i) => (
        <path key={`c${i}`} d={d} fill={`url(#${id}c)`} />
      ))}
      {lay.kjerner.map((k, i) => (
        <ellipse
          key={`k${i}`}
          cx={k.cx}
          cy={k.cy}
          rx={k.rx}
          ry={k.ry}
          fill={`url(#${id}k)`}
          fillOpacity={k.opploses ? 0.45 : 1}
          stroke={BIO.kjerne.line}
          strokeWidth={1.6 * lw}
          strokeDasharray={k.opploses ? '7 7' : undefined}
        />
      ))}
      {lay.ekvatorplan.map((e, i) => (
        <line
          key={`e${i}`}
          x1={e.x}
          y1={e.y0}
          x2={e.x}
          y2={e.y1}
          stroke={VIZ.muted}
          strokeWidth={1.4 * lw}
          strokeDasharray="5 6"
          opacity={0.8}
        />
      ))}
      {spole &&
        lay.spoler.map((s, i) => (
          <g key={`s${i}`}>
            {s.fibre.map(([a, b], j) => (
              <line key={j} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={BIO.cytoskjelett} strokeWidth={1.2 * lw} />
            ))}
            {s.poler.map((p, j) => (
              <g key={`p${j}`}>
                {/* Sentrosom: to sentrioler (små sylindre på tvers av hverandre) i en lys sky */}
                <circle cx={p.x} cy={p.y} r={7} fill={BIO.cytoskjelett} opacity={0.35} />
                <rect x={p.x - 2.5} y={p.y - 6} width={5} height={12} rx={2} fill={VIZ.muted} stroke={CENTRIOLE_EDGE} strokeWidth={0.6 * lw} />
                <rect x={p.x - 6} y={p.y - 2.5} width={12} height={5} rx={2} fill={VIZ.muted} stroke={CENTRIOLE_EDGE} strokeWidth={0.6 * lw} />
                <line x1={p.x - 4.4} y1={p.y - 1.1} x2={p.x + 4.4} y2={p.y - 1.1} stroke={LYS.glans} strokeWidth={1.1} strokeLinecap="round" />
              </g>
            ))}
          </g>
        ))}
      {sorted.map((k) => (
        <Kromatide
          key={k.key}
          x={k.x}
          y={k.y}
          lengde={k.lengde}
          bredde={k.bredde}
          sentromer={k.sentromer}
          rot={k.rot}
          armU={k.armU}
          armL={k.armL}
          par={k.par}
          opphav={k.opphav}
          segmenter={k.segmenter}
          kondensert={k.kondensert}
          sentromerPrikk={!lay.sentromerer.some((s) => s.a === k.key || s.b === k.key)}
        />
      ))}
      {lay.sentromerer.map((s) => {
        const a = lay.kromatider.find((k) => k.key === s.a)!;
        return a.kondensert ? <Sentromer key={`${s.a}+`} x={s.x} y={s.y} rot={a.rot} W={a.bredde} par={s.par} opphav={s.opphav} /> : null;
      })}
      {outlines.map((d, i) => (
        <Cellemembran key={`m${i}`} d={d} />
      ))}
      {children}
    </g>
  );
}

const CENTRIOLE_EDGE = morkere(VIZ.muted, 0.35);
