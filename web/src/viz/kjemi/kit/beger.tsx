/**
 * Laboratorieutstyr i SVG: begerglass, erlenmeyerkolbe og byrette med væske, og partikler (ioner, molekyler) i en
 * boks for partikkelbilder av løsninger. Alle partikkelplasseringer er deterministiske (fast frø).
 *
 * Tegnet i illustrert realisme (se lys.tsx): glass med veggtykkelse, refleks og myk skygge, væske med dybde og menisk,
 * byretten i en stativklemme. Plassering og størrelse er som før, så etiketter og piler i kapitlene treffer.
 *
 *   <Begerglass x={80} y={60} w={200} h={240} level={0.6} liquid={btbColor(pH)}>
 *     {(box) => <Partikler box={box} groups={[{ n: 8, r: 9, fill: KJEMI.plus, label: '+' }, { n: 8, r: 11, fill: KJEMI.minus, label: '−' }]} />}
 *   </Begerglass>
 */
import { useMemo, type ReactNode } from 'react';
import { VIZ, fmt, useSvgId } from '../../kit';
import { LinearGradient, RadialGradient, useStrokeScale } from '../../kit/scene/core';
import { KJEMI } from './colors';
import {
  GlassBodyGradient,
  GlassRoundGradient,
  GlintGradient,
  LiquidDepthGradient,
  LiquidRoundGradient,
  LiquidVolumeGradient,
  SoftShadow,
  SphereGradient,
  alpha,
  ballStops,
  mix,
  shade,
  tint,
} from './lys';
import { useAtomScale } from './molekyl';
import { jiggle, placeParticles, type Box, type PlacedParticle } from './random';
import { Txt } from './txt';

type Inside = ReactNode | ((liquid: Box) => ReactNode);

export interface GlassProps {
  /** Øverste venstre hjørne av glasset. */
  x: number;
  y: number;
  w: number;
  h: number;
  /** Væskehøyde som andel av høyden (0–1). For erlenmeyerkolben: andel av den koniske delen. */
  level: number;
  /** Væskefarge (standard KJEMI.liquid, f.eks. btbColor(pH)). */
  liquid?: string;
  /** Innhold i væsken (klippes til væsken). Som funksjon får du boksen partiklene kan ligge i. */
  children?: Inside;
  /** Merker på glasset, f.eks. [{ level: 0.25, label: '50 mL' }, …]. Etikettene står til høyre for glasset. */
  marks?: { level: number; label?: string }[];
  /** Etikett under glasset. */
  label?: ReactNode;
  /** Myk skygge under glasset, som om det står på et bord (standard true). */
  shadow?: boolean;
}

const clamp01 = (v: number) => (Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : 0);
const r2 = (v: number) => Math.round(v * 100) / 100;

/** Tykkelsen glassveggen tegnes med (bare utseende; boksen til partiklene er uendret). */
function wallThickness(w: number, ss: number): number {
  return Math.min(4, Math.max(2.2, w * 0.018)) * ss;
}

/**
 * Veggen i glasset: et lyst bånd innenfor konturen med en tynn kant på innsiden (glasstykkelse). Klippes til innsiden av
 * glasset (`clip` er id-en til en clipPath med den lukkede konturen), så båndet aldri stikker utenfor.
 */
function GlassWall({ d, clip, t, ss }: { d: string; clip: string; t: number; ss: number }) {
  return (
    <g clipPath={`url(#${clip})`} fill="none" strokeLinejoin="round">
      <path d={d} stroke={alpha(KJEMI.glass, 0.55)} strokeWidth={r2(2 * t + 1.3 * ss)} />
      <path d={d} stroke={KJEMI.glassWall} strokeWidth={r2(2 * t)} />
    </g>
  );
}

/** Begerglass med tut, væske, menisk og eventuelle volummerker. */
export function Begerglass({ x, y, w, h, level, liquid = KJEMI.liquid, children, marks, label, shadow = true }: GlassProps) {
  const k = useAtomScale();
  const ss = useStrokeScale();
  const id = useSvgId('kj-beger');
  const r = Math.min(14, w * 0.08);
  const wall = 2;
  const lv = clamp01(level);
  const surface = y + h - lv * (h - 6);
  const outline = `M${x - 7},${y - 5} Q${x},${y - 1} ${x},${y + 10} L${x},${y + h - r} Q${x},${y + h} ${x + r},${y + h} L${x + w - r},${y + h} Q${x + w},${y + h} ${x + w},${y + h - r} L${x + w},${y + 4} Q${x + w},${y} ${x + w + 3},${y - 2}`;
  const inner = `M${x + wall},${y} L${x + wall},${y + h - r} Q${x + wall},${y + h - wall} ${x + r},${y + h - wall} L${x + w - r},${y + h - wall} Q${x + w - wall},${y + h - wall} ${x + w - wall},${y + h - r} L${x + w - wall},${y} Z`;
  const pad = 4 * k;
  const box: Box = { x: x + wall + pad, y: surface + pad, w: w - 2 * wall - 2 * pad, h: Math.max(0, y + h - wall - surface - 2 * pad) };
  const t = wallThickness(w, ss);
  // Menisken: vannet kryper litt opp langs veggen.
  const L0 = x + wall;
  const R0 = x + w - wall;
  const depth = y + h - surface;
  const m = Math.min(Math.min(5, Math.max(2, w * 0.02)) * k, depth * 0.5);
  const mw = Math.min(3.2 * m, (R0 - L0) / 4);
  const top = `M${r2(L0)},${r2(surface - m)} Q${r2(L0)},${r2(surface)} ${r2(L0 + mw)},${r2(surface)} L${r2(R0 - mw)},${r2(surface)} Q${r2(R0)},${r2(surface)} ${r2(R0)},${r2(surface - m)}`;
  const liq = `${top} L${R0},${y + h} L${L0},${y + h} Z`;
  const gw = Math.max(2.5, w * 0.045);
  return (
    <g>
      {shadow && <SoftShadow id={`${id}-s`} cx={x + w / 2} cy={y + h + 1} rx={w * 0.58} ry={Math.max(3, Math.min(9, w * 0.035)) * k} />}
      <defs>
        <clipPath id={`${id}-in`}>
          <path d={inner} />
        </clipPath>
        <clipPath id={`${id}-out`}>
          <path d={`${outline} Z`} />
        </clipPath>
      </defs>
      <GlassBodyGradient id={`${id}-g`} />
      <GlintGradient id={`${id}-r`} />
      <path d={`${outline} Z`} fill={`url(#${id}-g)`} stroke="none" />
      <g clipPath={`url(#${id}-in)`}>
        {lv > 0 && (
          <g>
            <LiquidDepthGradient id={`${id}-d`} liquid={liquid} band={Math.min(0.35, (7 * k) / Math.max(1, depth))} />
            <LiquidVolumeGradient id={`${id}-v`} />
            <path d={liq} fill={`url(#${id}-d)`} />
            <path d={liq} fill={`url(#${id}-v)`} />
            <path d={top} fill="none" stroke={KJEMI.liquidLine} strokeWidth={r2(1.8 * ss)} strokeLinecap="round" />
          </g>
        )}
        {typeof children === 'function' ? children(box) : children}
      </g>
      <GlassWall d={outline} clip={`${id}-out`} t={t} ss={ss} />
      {/* Refleks: et bredt lysfelt og en tynn stripe til venstre, en svak stripe til høyre */}
      <g clipPath={`url(#${id}-out)`} aria-hidden>
        <rect x={x + w * 0.075} y={y + h * 0.08} width={gw} height={h * 0.8} rx={gw / 2} fill={`url(#${id}-r)`} />
        <rect x={x + w * 0.075 + gw + 2.5 * ss} y={y + h * 0.14} width={Math.max(1, w * 0.008) * ss} height={h * 0.62} fill={`url(#${id}-r)`} opacity={0.6} />
        <rect x={x + w * 0.9 - gw * 0.4} y={y + h * 0.12} width={gw * 0.4} height={h * 0.7} rx={gw * 0.2} fill={`url(#${id}-r)`} opacity={0.45} />
      </g>
      {marks?.map((m) => {
        const my = y + h - clamp01(m.level) * (h - 6);
        return (
          <g key={m.level}>
            <line x1={x + w - t * 0.6} y1={my} x2={x + w - 2 - Math.min(26, w * 0.16)} y2={my} stroke={KJEMI.scaleInk} strokeWidth={r2(1.5 * ss)} strokeLinecap="round" opacity={0.85} />
            {m.label && (
              <Txt x={x + w + 8} y={my + 5} anchor="start" size={0.7} muted>
                {m.label}
              </Txt>
            )}
          </g>
        );
      })}
      <path d={outline} fill="none" stroke={KJEMI.glass} strokeWidth={r2(2.2 * ss)} strokeLinejoin="round" strokeLinecap="round" />
      {/* Kanten øverst er rundet (brent kant) og fanger lyset */}
      <path
        d={`M${x - 6},${y - 4.2} Q${x - 1},${y - 1.5} ${x - 0.2},${y + 6} M${x + w + 2.4},${y - 1.6} Q${x + w + 0.6},${y - 0.6} ${x + w + 0.2},${y + 3}`}
        fill="none"
        stroke={KJEMI.glassGlint}
        strokeWidth={r2(1.1 * ss)}
        strokeLinecap="round"
      />
      {label !== undefined && (
        <Txt x={x + w / 2} y={y + h + 24 * k} muted>
          {label}
        </Txt>
      )}
    </g>
  );
}

/** Halvbredden til erlenmeyerkolben i høyden yy. */
function flaskHalfWidth(yy: number, y: number, h: number, w: number, neckW: number, neckH: number): number {
  if (yy <= y + neckH) return neckW / 2;
  const t = (yy - (y + neckH)) / (h - neckH);
  return neckW / 2 + (w / 2 - neckW / 2) * Math.min(1, Math.max(0, t));
}

/** Erlenmeyerkolbe (titrerkolbe) med væske. `level` er andel av den koniske delen (0–1). */
export function Erlenmeyerkolbe({ x, y, w, h, level, liquid = KJEMI.liquid, children, marks, label, shadow = true }: GlassProps) {
  const k = useAtomScale();
  const ss = useStrokeScale();
  const id = useSvgId('kj-erlen');
  const cx = x + w / 2;
  const neckW = w * 0.3;
  const neckH = h * 0.3;
  const r = Math.min(12, w * 0.07);
  const body = h - neckH;
  const lv = clamp01(level);
  const surface = y + h - lv * body;
  const L = cx - neckW / 2;
  const R = cx + neckW / 2;
  const outline = `M${L - 4},${y} L${L},${y + 3} L${L},${y + neckH} L${x + r * 0.6},${y + h - r} Q${x},${y + h} ${x + r * 1.4},${y + h} L${x + w - r * 1.4},${y + h} Q${x + w},${y + h} ${x + w - r * 0.6},${y + h - r} L${R},${y + neckH} L${R},${y + 3} L${R + 4},${y}`;
  const hw = flaskHalfWidth(surface, y, h, w, neckW, neckH);
  const pad = 4 * k;
  const box: Box = { x: cx - hw + pad + 2, y: surface + pad, w: Math.max(0, 2 * hw - 2 * pad - 4), h: Math.max(0, y + h - surface - 2 * pad - 2) };
  const t = wallThickness(w, ss);
  const depth = y + h - surface;
  const m = Math.min(Math.min(5, Math.max(2, w * 0.02)) * k, depth * 0.4);
  const hwTop = flaskHalfWidth(surface - m, y, h, w, neckW, neckH);
  const mw = Math.min(3.2 * m, hw * 0.4);
  const top = `M${r2(cx - hwTop)},${r2(surface - m)} Q${r2(cx - hw + mw * 0.25)},${r2(surface)} ${r2(cx - hw + mw)},${r2(surface)} L${r2(cx + hw - mw)},${r2(surface)} Q${r2(cx + hw - mw * 0.25)},${r2(surface)} ${r2(cx + hwTop)},${r2(surface - m)}`;
  const liq = `${top} L${x + w + 4},${y + h + 4} L${x - 4},${y + h + 4} Z`;
  // Refleksene følger den venstre (og svakt den høyre) skråveggen.
  const slope = (w / 2 - neckW / 2) / (h - neckH);
  const gw = Math.max(2.4, w * 0.035);
  const a0 = y + neckH + h * 0.06;
  const a1 = y + h * 0.84;
  const inset = (yy: number) => cx - flaskHalfWidth(yy, y, h, w, neckW, neckH) + t + 3 * ss;
  const leftGlint = `M${r2(inset(a0))},${r2(a0)} L${r2(inset(a1))},${r2(a1)} L${r2(inset(a1) + gw * (1 + slope * 0.2))},${r2(a1)} L${r2(inset(a0) + gw * 0.7)},${r2(a0)} Z`;
  const rin = (yy: number) => cx + flaskHalfWidth(yy, y, h, w, neckW, neckH) - t - 3 * ss;
  const b0 = y + neckH + h * 0.16;
  const b1 = y + h * 0.78;
  const rightGlint = `M${r2(rin(b0))},${r2(b0)} L${r2(rin(b1))},${r2(b1)} L${r2(rin(b1) - gw * 0.5)},${r2(b1)} L${r2(rin(b0) - gw * 0.35)},${r2(b0)} Z`;
  const rimH = Math.max(4, 3.4 * k);
  return (
    <g>
      {shadow && <SoftShadow id={`${id}-s`} cx={cx} cy={y + h + 1} rx={w * 0.56} ry={Math.max(3, Math.min(9, w * 0.035)) * k} />}
      <defs>
        <clipPath id={`${id}-out`}>
          <path d={`${outline} Z`} />
        </clipPath>
      </defs>
      <GlassRoundGradient id={`${id}-g`} />
      <GlintGradient id={`${id}-r`} />
      <path d={`${outline} Z`} fill={`url(#${id}-g)`} stroke="none" />
      <g clipPath={`url(#${id}-out)`}>
        {lv > 0 && (
          <g>
            <LiquidDepthGradient id={`${id}-d`} liquid={liquid} band={Math.min(0.35, (7 * k) / Math.max(1, depth))} />
            <LiquidRoundGradient id={`${id}-v`} />
            <path d={liq} fill={`url(#${id}-d)`} />
            <path d={liq} fill={`url(#${id}-v)`} />
            <path d={top} fill="none" stroke={KJEMI.liquidLine} strokeWidth={r2(1.8 * ss)} strokeLinecap="round" />
          </g>
        )}
        {typeof children === 'function' ? children(box) : children}
      </g>
      <GlassWall d={outline} clip={`${id}-out`} t={t} ss={ss} />
      <g clipPath={`url(#${id}-out)`} aria-hidden>
        <rect x={L + t + neckW * 0.1} y={y + rimH + 4} width={Math.max(2, neckW * 0.12)} height={Math.max(0, neckH - rimH - 2)} rx={neckW * 0.06} fill={`url(#${id}-r)`} />
        <path d={leftGlint} fill={`url(#${id}-r)`} />
        <path d={rightGlint} fill={`url(#${id}-r)`} opacity={0.45} />
      </g>
      {marks?.map((mk) => {
        const my = y + h - clamp01(mk.level) * body;
        const mhw = flaskHalfWidth(my, y, h, w, neckW, neckH);
        return (
          <g key={mk.level}>
            <line x1={cx + mhw - 6} y1={my} x2={cx + mhw - 6 - Math.min(22, mhw * 0.3)} y2={my} stroke={KJEMI.scaleInk} strokeWidth={r2(1.5 * ss)} strokeLinecap="round" opacity={0.85} />
            {mk.label && (
              <Txt x={cx + mhw + 8} y={my + 5} anchor="start" size={0.7} muted>
                {mk.label}
              </Txt>
            )}
          </g>
        );
      })}
      <path d={outline} fill="none" stroke={KJEMI.glass} strokeWidth={r2(2.2 * ss)} strokeLinejoin="round" strokeLinecap="round" />
      {/* Den tykke, rundede kanten øverst på halsen */}
      <rect
        x={L - 4.5}
        y={y - 1.2}
        width={neckW + 9}
        height={rimH}
        rx={rimH / 2}
        fill={mix(alpha(KJEMI.glassTint, 0.85), alpha(KJEMI.glassGlint, 0.8), 0.3)}
        stroke={KJEMI.glass}
        strokeWidth={r2(1.6 * ss)}
      />
      <line x1={L - 1.5} y1={y - 1.2 + rimH * 0.36} x2={L + neckW * 0.45} y2={y - 1.2 + rimH * 0.36} stroke={KJEMI.glassGlint} strokeWidth={r2(Math.max(0.8, rimH * 0.22))} strokeLinecap="round" />
      {label !== undefined && (
        <Txt x={cx} y={y + h + 24 * k} muted>
          {label}
        </Txt>
      )}
    </g>
  );
}

export interface ByretteProps {
  /** Midten av røret. */
  x: number;
  /** Toppen av røret. */
  y: number;
  /** Lengden av det graderte røret (kranen og tuppen kommer under). */
  h: number;
  /** Rørbredde (standard 22 · skala). */
  w?: number;
  /** Volumet byretten rommer (mL), standard 50. */
  capacity?: number;
  /** Avlesning i mL: 0 er full byrette, `capacity` er tom ned til nederste merke. */
  reading: number;
  liquid?: string;
  /** Tall på skalaen hver `labelEvery` mL (standard 10). */
  labelEvery?: number;
  /** Vis avlesningen ved menisken, f.eks. «12,40 mL». */
  showReading?: boolean;
  /** Tegn en dråpe under tuppen (når kranen er åpen). */
  dripping?: boolean;
  /**
   * Stativklemmen som holder byretten (standard true): klemme rundt røret mellom 0 og første tall, arm og muffe på en
   * stativstang til venstre for tallene. Stanga blekner nedover, eller går ned til `standBase` (y for bordet) med fot.
   */
  clamp?: boolean;
  /** Y-koordinaten til bordet stativet står på. Uten den blekner stanga ut litt under tuppen. */
  standBase?: number;
}

/** Høyden byretten tar under røret (kran og tupp), for å plassere en kolbe under. */
export function byretteTipLength(k = 1): number {
  return 52 * k;
}

/**
 * Stativstang, muffe og byretteklemme (tegnes bak røret). Gummibakkene foran røret tegnes for seg (`ClampJaws`).
 */
function StandAndClamp({ id, L, R, cy, rodX, top, bottom, base, k, ss }: { id: string; L: number; R: number; cy: number; rodX: number; top: number; bottom: number; base?: number; k: number; ss: number }) {
  const rw = 5.2 * k;
  const arm = 4.6 * k;
  const metal = KJEMI.stand;
  const fade = base === undefined;
  const footW = 64 * k;
  const footH = 7 * k;
  return (
    <g aria-hidden>
      <LinearGradient
        id={`${id}-rod`}
        x2={1}
        y2={0}
        stops={[
          [0, shade(metal, 0.3)],
          [0.28, tint(metal, 0.55)],
          [0.55, metal],
          [1, shade(metal, 0.38)],
        ]}
      />
      <LinearGradient
        id={`${id}-arm`}
        stops={[
          [0, tint(metal, 0.5)],
          [0.45, metal],
          [1, shade(metal, 0.4)],
        ]}
      />
      {fade && (
        <>
          <LinearGradient
            id={`${id}-fade`}
            userSpace
            x1={0}
            y1={bottom - 70 * k}
            x2={0}
            y2={bottom}
            stops={[
              [0, 'white', 1],
              [1, 'white', 0],
            ]}
          />
          <defs>
            <mask id={`${id}-m`} maskUnits="userSpaceOnUse" x={rodX - rw * 2} y={top - rw} width={rw * 4} height={bottom - top + 2 * rw}>
              <rect x={rodX - rw * 2} y={top - rw} width={rw * 4} height={bottom - top + 2 * rw} fill={`url(#${id}-fade)`} />
            </mask>
          </defs>
        </>
      )}
      {/* Fot med stang (bare når bordet er kjent) */}
      {base !== undefined && (
        <g>
          <SoftShadow id={`${id}-fs`} cx={rodX + footW * 0.25} cy={base + 1} rx={footW * 0.62} ry={4 * k} />
          <rect x={rodX - footW * 0.35} y={base - footH} width={footW} height={footH} rx={2.5 * k} fill={`url(#${id}-arm)`} stroke={KJEMI.outline} strokeWidth={r2(0.9 * ss)} />
        </g>
      )}
      {/* Stanga */}
      <rect
        x={rodX - rw / 2}
        y={top}
        width={rw}
        height={(base ?? bottom) - top - (base !== undefined ? footH : 0)}
        rx={rw / 2}
        fill={`url(#${id}-rod)`}
        stroke={KJEMI.outline}
        strokeWidth={r2(0.8 * ss)}
        mask={fade ? `url(#${id}-m)` : undefined}
      />
      {/* Arm fra muffa til røret, og bøylen bak røret */}
      <rect x={rodX} y={cy - arm / 2} width={L - rodX} height={arm} rx={arm / 2} fill={`url(#${id}-arm)`} stroke={KJEMI.outline} strokeWidth={r2(0.8 * ss)} />
      <rect x={L - 3 * k} y={cy - arm * 0.4} width={R - L + 6 * k} height={arm * 0.8} rx={arm * 0.4} fill={shade(metal, 0.25)} />
      {/* Muffe (dobbeltmuffe) med skrue */}
      <rect x={rodX - 8 * k} y={cy - 9 * k} width={16 * k} height={18 * k} rx={2.5 * k} fill={`url(#${id}-arm)`} stroke={KJEMI.outline} strokeWidth={r2(0.9 * ss)} />
      <rect x={rodX - 8 * k} y={cy - 9 * k} width={16 * k} height={18 * k} rx={2.5 * k} fill={shade(metal, 0.35)} opacity={0.35} />
      <rect x={rodX - 17 * k} y={cy - 1.6 * k} width={10 * k} height={3.2 * k} rx={1.2 * k} fill={shade(metal, 0.2)} stroke={KJEMI.outline} strokeWidth={r2(0.7 * ss)} />
      <rect x={rodX - 21 * k} y={cy - 5 * k} width={5 * k} height={10 * k} rx={2 * k} fill={`url(#${id}-arm)`} stroke={KJEMI.outline} strokeWidth={r2(0.8 * ss)} />
      <line x1={rodX - 5 * k} y1={cy - 6 * k} x2={rodX + 5 * k} y2={cy - 6 * k} stroke={tint(metal, 0.6)} strokeWidth={r2(1 * ss)} strokeLinecap="round" />
    </g>
  );
}

/** Gummibakkene på klemmen, foran kantene av røret. */
function ClampJaws({ L, R, cy, k, ss }: { L: number; R: number; cy: number; k: number; ss: number }) {
  const jh = 13 * k;
  const jw = 4.4 * k;
  const pad = (x0: number) => (
    <rect x={x0} y={cy - jh / 2} width={jw} height={jh} rx={jw * 0.45} fill={KJEMI.rubber} stroke={KJEMI.outline} strokeWidth={r2(0.7 * ss)} />
  );
  return (
    <g aria-hidden>
      {pad(L - jw + 1.2 * k)}
      {pad(R - 1.2 * k)}
      <line x1={L - jw * 0.55 + 1.2 * k} y1={cy - jh * 0.3} x2={L - jw * 0.55 + 1.2 * k} y2={cy + jh * 0.25} stroke={alpha(KJEMI.glassGlint, 0.45)} strokeWidth={r2(0.9 * ss)} strokeLinecap="round" />
      <line x1={R + jw * 0.45 - 1.2 * k} y1={cy - jh * 0.3} x2={R + jw * 0.45 - 1.2 * k} y2={cy + jh * 0.25} stroke={alpha(KJEMI.glassGlint, 0.3)} strokeWidth={r2(0.9 * ss)} strokeLinecap="round" />
    </g>
  );
}

/** Byrette med skala (0 øverst), menisk, kran og tupp, holdt av en stativklemme. */
export function Byrette({ x, y, h, w, capacity = 50, reading, liquid = KJEMI.liquid, labelEvery = 10, showReading, dripping, clamp = true, standBase }: ByretteProps) {
  const k = useAtomScale();
  const ss = useStrokeScale();
  const id = useSvgId('kj-byrette');
  const W = w ?? 22 * k;
  const top = y + 14;
  const bottom = y + h - 20;
  const v = Math.min(capacity, Math.max(0, Number.isFinite(reading) ? reading : 0));
  const yv = top + ((bottom - top) * v) / capacity;
  const L = x - W / 2;
  const R = x + W / 2;
  const ticks: ReactNode[] = [];
  const perMl = (bottom - top) / capacity;
  const minorStep = perMl >= 3 ? 1 : perMl * 2 >= 3 ? 2 : 5;
  let dMajor = '';
  let dMid = '';
  let dMinor = '';
  for (let ml = 0; ml <= capacity + 1e-9; ml += minorStep) {
    const ty = r2(top + perMl * ml);
    const major = Math.abs(ml % labelEvery) < 1e-9;
    const mid = !major && Math.abs(ml % 5) < 1e-9;
    const seg = `M${r2(R - 1)},${ty}H${r2(R - (major ? W * 0.55 : mid ? W * 0.4 : W * 0.25))}`;
    if (major) dMajor += seg;
    else if (mid) dMid += seg;
    else dMinor += seg;
    if (major)
      ticks.push(
        <Txt key={`t${ml}`} x={L - 6} y={ty + 5} anchor="end" size={0.7} muted>
          {fmt(ml, 0)}
        </Txt>,
      );
  }
  const cock = y + h;
  const tipTop = cock + 18 * k;
  const tipEnd = tipTop + 30 * k;
  // Væskerøret: veggtykkelse og menisk (laveste punkt midt i røret ved avlesningen)
  const t = Math.max(1.6, W * 0.11);
  const m = Math.min(4.5 * k, W * 0.22);
  const lw = L + t * 0.6;
  const rw = R - t * 0.6;
  const meniscus = `M${r2(lw)},${r2(yv - m)} Q${r2(x)},${r2(yv + m)} ${r2(rw)},${r2(yv - m)}`;
  const column = `${meniscus} L${r2(rw)},${r2(cock)} L${r2(lw)},${r2(cock)} Z`;
  // Klemmen sitter mellom 0-merket og første tall, så den ikke dekker tallene; stanga står til venstre for tallene.
  const clampY = top + Math.max(10, (perMl * Math.min(labelEvery, capacity)) / 2);
  const rodX = L - 44 * k;
  const stem = 3.6 * k;
  const barrelY = cock + 9 * k;
  return (
    <g>
      {clamp && <StandAndClamp id={id} L={L} R={R} cy={clampY} rodX={rodX} top={clampY - 26 * k} bottom={tipEnd + 40 * k} base={standBase} k={k} ss={ss} />}
      <GlassBodyGradient id={`${id}-g`} />
      <LiquidVolumeGradient id={`${id}-v`} />
      <GlintGradient id={`${id}-r`} />
      <LinearGradient
        id={`${id}-key`}
        stops={[
          [0, tint(KJEMI.stopcock, 0.5)],
          [0.5, KJEMI.stopcock],
          [1, shade(KJEMI.stopcock, 0.22)],
        ]}
      />
      <RadialGradient id={`${id}-drop`} cx={0.5} cy={0.6} r={0.55} fx={0.38} fy={0.55} stops={[[0, tint(liquid, 0.55)], [0.55, liquid], [1, shade(liquid, 0.2)]]} />
      {/* Røret: glass, væskesøylen med menisk, veggene */}
      <rect x={L} y={y} width={W} height={h} fill={`url(#${id}-g)`} />
      <path d={column} fill={liquid} />
      <path d={column} fill={`url(#${id}-v)`} />
      <path d={meniscus} fill="none" stroke={KJEMI.liquidLine} strokeWidth={r2(2 * ss)} strokeLinecap="round" />
      <path d={`M${r2(lw + 1)},${r2(yv - m + 2.2 * ss)} Q${r2(x)},${r2(yv + m + 2.2 * ss)} ${r2(rw - 1)},${r2(yv - m + 2.2 * ss)}`} fill="none" stroke={alpha(KJEMI.glassGlint, 0.55)} strokeWidth={r2(1.2 * ss)} />
      <rect x={L} y={y} width={t} height={h} fill={KJEMI.glassWall} />
      <rect x={R - t} y={y} width={t} height={h} fill={KJEMI.glassWall} />
      <rect x={R - W * 0.22} y={y + 6} width={Math.max(1, W * 0.06)} height={h - 12} fill={`url(#${id}-r)`} opacity={0.4} />
      {/* Skalaen er trykt på glasset */}
      <path d={dMinor} stroke={KJEMI.scaleInk} strokeWidth={r2(0.9 * ss)} opacity={0.75} />
      <path d={dMid} stroke={KJEMI.scaleInk} strokeWidth={r2(1.15 * ss)} opacity={0.85} />
      <path d={dMajor} stroke={KJEMI.scaleInk} strokeWidth={r2(1.5 * ss)} />
      {ticks}
      <rect x={L + W * 0.17} y={y + 5} width={Math.max(1.8, W * 0.13)} height={h - 10} rx={W * 0.06} fill={`url(#${id}-r)`} />
      <line x1={L} y1={y} x2={L} y2={cock} stroke={KJEMI.glass} strokeWidth={r2(2 * ss)} />
      <line x1={R} y1={y} x2={R} y2={cock} stroke={KJEMI.glass} strokeWidth={r2(2 * ss)} />
      <rect x={L - 1.4 * ss} y={y - 1.5 * ss} width={W + 2.8 * ss} height={Math.max(3.2, 2.6 * k)} rx={1.6 * k} fill={mix(alpha(KJEMI.glassTint, 0.85), alpha(KJEMI.glassGlint, 0.8), 0.3)} stroke={KJEMI.glass} strokeWidth={r2(1.4 * ss)} />
      {clamp && <ClampJaws L={L} R={R} cy={clampY} k={k} ss={ss} />}
      {/* Nederst smalner røret inn mot kranen; væska fortsetter gjennom kranen og tuppen */}
      <path
        d={`M${L},${cock} Q${L},${cock + 4 * k} ${x - stem},${cock + 5 * k} L${x - stem},${tipTop} L${x + stem},${tipTop} L${x + stem},${cock + 5 * k} Q${R},${cock + 4 * k} ${R},${cock} Z`}
        fill={alpha(KJEMI.glassTint, 0.45)}
        stroke={KJEMI.glass}
        strokeWidth={r2(1.6 * ss)}
        strokeLinejoin="round"
      />
      <path d={`M${lw},${cock - 0.5} Q${lw},${cock + 3 * k} ${x - stem * 0.55},${cock + 4.4 * k} L${x - stem * 0.55},${tipTop} L${x + stem * 0.55},${tipTop} L${x + stem * 0.55},${cock + 4.4 * k} Q${rw},${cock + 3 * k} ${rw},${cock - 0.5} Z`} fill={liquid} />
      {/* Tuppen */}
      <path
        d={`M${x - 4 * k},${tipTop} L${x - 1.8 * k},${tipEnd} L${x + 1.8 * k},${tipEnd} L${x + 4 * k},${tipTop} Z`}
        fill={alpha(KJEMI.glassTint, 0.45)}
        stroke={KJEMI.glass}
        strokeWidth={r2(1.6 * ss)}
        strokeLinejoin="round"
      />
      <polygon points={`${x - 2.4 * k},${tipTop} ${x + 2.4 * k},${tipTop} ${x + 1 * k},${tipEnd - 0.6} ${x - 1 * k},${tipEnd - 0.6}`} fill={liquid} />
      <line x1={x - 2.6 * k} y1={tipTop + 3 * k} x2={x - 1.4 * k} y2={tipEnd - 4 * k} stroke={KJEMI.glassGlint} strokeWidth={r2(0.9 * ss)} strokeLinecap="round" />
      {/* Kran: glasshuset sett fra enden, med PTFE-nøkkel og håndtak på tvers (lukket) */}
      <circle cx={x} cy={barrelY} r={7.6 * k} fill={mix(alpha(KJEMI.glassTint, 0.85), alpha(KJEMI.glassGlint, 0.8), 0.25)} stroke={KJEMI.glass} strokeWidth={r2(1.5 * ss)} />
      <rect x={x - 20 * k} y={cock + 6 * k} width={40 * k} height={6 * k} rx={3 * k} fill={`url(#${id}-key)`} stroke={KJEMI.outline} strokeWidth={r2(1 * ss)} />
      <line x1={x - 17.5 * k} y1={cock + 7.7 * k} x2={x - 6 * k} y2={cock + 7.7 * k} stroke={KJEMI.glassGlint} strokeWidth={r2(1 * ss)} strokeLinecap="round" opacity={0.8} />
      <circle cx={x} cy={barrelY} r={3.4 * k} fill={`url(#${id}-key)`} stroke={KJEMI.outline} strokeWidth={r2(0.9 * ss)} />
      {dripping && (
        <g>
          <path d={`M${x},${tipEnd + 6 * k} q${4 * k},${7 * k} 0,${10 * k} q${-4 * k},${-3 * k} 0,${-10 * k} Z`} fill={`url(#${id}-drop)`} stroke={KJEMI.liquidLine} strokeWidth={r2(1 * ss)} />
          <ellipse cx={x - 1.1 * k} cy={tipEnd + 12.2 * k} rx={0.8 * k} ry={1.5 * k} fill={KJEMI.glassGlint} />
        </g>
      )}
      {showReading && (
        <g>
          <line x1={R + 4} y1={yv} x2={R + 16 * k} y2={yv} stroke={VIZ.ink} strokeWidth={1.5} />
          <Txt x={R + 20 * k} y={yv + 6} anchor="start" size={0.85}>
            {fmt(v, 2)} mL
          </Txt>
        </g>
      )}
    </g>
  );
}

export interface ParticleGroup {
  /** Antall partikler. */
  n: number;
  /** Radius i figurens enheter (ganges med useAtomScale). */
  r: number;
  fill?: string;
  /** Kantfarge (standard: en mørkere utgave av fyllfargen, tynn). */
  line?: string;
  /** Kort tekst midt i partikkelen, f.eks. «+», «−» eller «Na». */
  label?: string;
  /** Egen tegning i stedet for en sirkel, f.eks. <WaterMolecule>. */
  render?: (p: { x: number; y: number; r: number; index: number; angle: number }) => ReactNode;
}

/**
 * Mange små partikler spredt i en boks uten å overlappe (så langt det er plass), alltid likt for samme frø.
 * Med `t` (sekunder, fra useSimClock) beveger de seg litt, som varmebevegelse.
 * Partiklene er små kuler med lys fra øvre venstre: én toning per gruppe, så det holder med mange partikler.
 */
export function Partikler({ box, groups, seed = 1, t, amplitude, gap = 3 }: { box: Box; groups: ParticleGroup[]; seed?: number; t?: number; amplitude?: number; gap?: number }) {
  const k = useAtomScale();
  const ss = useStrokeScale();
  const id = useSvgId('kj-part');
  const spec = groups.map((g) => ({ n: g.n, r: g.r * k }));
  const key = JSON.stringify([box, spec, seed, gap]);
  // Plasseringen regnes bare ut på nytt når boksen, gruppene eller frøet endres (ikke for hver ramme med t).
  const placed = useMemo<PlacedParticle[]>(() => placeParticles(box, spec, seed, gap), [key]);
  const amp = amplitude ?? 3 * k;
  const fills = groups.map((g) => g.fill ?? KJEMI.molecule);
  return (
    <g>
      {groups.map((g, i) => (g.render ? null : <SphereGradient key={i} id={`${id}-${i}`} stops={ballStops(fills[i]!)} />))}
      {placed.map((p) => {
        const g = groups[p.group]!;
        const pos = t === undefined ? p : jiggle(p, t, amp);
        const x = Math.min(box.x + box.w - p.r, Math.max(box.x + p.r, pos.x));
        const y = Math.min(box.y + box.h - p.r, Math.max(box.y + p.r, pos.y));
        if (g.render) return <g key={`${p.group}-${p.index}`}>{g.render({ x, y, r: p.r, index: p.index, angle: (p.phase * 180) / Math.PI })}</g>;
        return (
          <g key={`${p.group}-${p.index}`}>
            <circle
              cx={x}
              cy={y}
              r={p.r}
              fill={`url(#${id}-${p.group})`}
              stroke={g.line ?? shade(fills[p.group]!, 0.35)}
              strokeWidth={g.line ? 1.5 : r2(Math.min(1, p.r * 0.12) * ss)}
            />
            {g.label && (
              <text x={x} y={y + p.r * 0.38} textAnchor="middle" style={{ fill: VIZ.surface, fontSize: p.r * (g.label.length > 1 ? 0.95 : 1.3), fontWeight: 700 }}>
                {g.label}
              </text>
            )}
          </g>
        );
      })}
    </g>
  );
}
