/**
 * Scenen over grafen i «Bindingsenergi per nukleon». Til venstre (over på mobil) stedet der det skjer: brenselstaver
 * i en reaktor, plasma i en fusjonsreaktor eller kjernen i sola. En lupe forstørrer opp til kjernene: før og etter
 * reaksjonen, med massen på hver side og energien på pila i midten. I visningen «Bindingsenergi» deles den valgte
 * kjernen opp i frie protoner og nøytroner, og pila viser energien som må tilføres.
 * Alle kjernene i ett bilde har samme skala (radius per nukleon), og fartspilene har én skala (px per m/s).
 */
import { Fragment, type ReactNode } from 'react';
import { TSub, VIZ, fmt, useTextScale } from '../../kit';
import { Atomkjerne, ForceArrow, Foton, Nukleon, SpeedLines, SCENE, ValueTag, useSceneScale } from '../../kit/scene';
import { nuclideText } from '../kap07/elements';
import {
  Energiglod,
  FrieNukleoner,
  FrittNoytron,
  Fusjonsplasma,
  KjerneBakgrunn,
  LysTxt,
  Lupe,
  Ramme,
  Reaksjonspil,
  Reaktorvann,
  Solbilde,
  plasmaPunkt,
  reaktorPunkt,
  solPunkt,
  type Box,
} from './bindingsenergi-deler';
import { M_H1_U, M_NEUTRON_U, REACTIONS, bindingEnergy, reactionEnergy, type Nuclide, type Reaction } from './model';
import { fissionFragments, fusionFragments } from './model-bindingsenergi';

export type SceneMode = 'kurve' | Reaction['id'];

export const W = 800;

export interface SceneLayout {
  H: number;
  narrow: boolean;
  vignette: Box | null;
  panel: Box;
}

/** Plasseringen av bildet og utsnittet: side om side på PC, over hverandre på mobil. */
export function sceneLayout(mode: SceneMode, narrow: boolean): SceneLayout {
  if (mode === 'kurve') {
    const H = narrow ? 430 : 300;
    return { H, narrow, vignette: null, panel: narrow ? { x: 0, y: 0, w: W, h: H } : { x: 10, y: 10, w: W - 20, h: H - 20 } };
  }
  if (narrow) {
    const H = 680;
    return { H, narrow, vignette: { x: 0, y: 0, w: W, h: 210 }, panel: { x: 0, y: 240, w: W, h: H - 240 } };
  }
  const H = 300;
  return { H, narrow, vignette: { x: 10, y: 10, w: 220, h: H - 20 }, panel: { x: 250, y: 10, w: W - 260, h: H - 20 } };
}

/** Farger: energien som tilføres (oppdeling) og som frigjøres (reaksjonene), samme som i grafen. */
export const CURVE_COLOR = VIZ.series[0]!;
export const REACTION_COLOR = VIZ.series[1]!;

const VIGNETTE_LABEL: Record<Reaction['id'], string> = {
  fisjon: 'Kjernereaktor',
  fusjon: 'Fusjonsreaktor',
  sola: 'Kjernen i sola',
};

export function BindingScene({ mode, sel, layout }: { mode: SceneMode; sel: Nuclide; layout: SceneLayout }) {
  const f = useTextScale();
  const { vignette: V, panel: P, narrow } = layout;
  const zoom = V && mode !== 'kurve' ? zoomPoint(mode, V) : null;
  return (
    <g>
      {V && mode !== 'kurve' && (
        <Ramme box={V}>
          {mode === 'fisjon' && <Reaktorvann box={V} />}
          {mode === 'fusjon' && <Fusjonsplasma box={V} />}
          {mode === 'sola' && <Solbilde box={V} />}
        </Ramme>
      )}
      <Ramme box={P} rx={narrow ? 0 : 14}>
        <KjerneBakgrunn box={P} />
        {mode === 'kurve' ? <SplitPanel sel={sel} P={P} narrow={narrow} /> : <ReactionPanel mode={mode} P={P} narrow={narrow} />}
      </Ramme>
      {V && zoom && <Lupe x={zoom.x} y={zoom.y} r={zoom.r} to={P} side={narrow ? 'below' : 'right'} />}
      {V && mode !== 'kurve' && <ValueTag x={V.x + V.w / 2} y={V.y + 22 * f} text={VIGNETTE_LABEL[mode]} size={0.85} />}
    </g>
  );
}

function zoomPoint(mode: Reaction['id'], V: Box) {
  if (mode === 'fisjon') return reaktorPunkt(V);
  if (mode === 'fusjon') return plasmaPunkt(V);
  return solPunkt(V);
}

/** Rader og kolonner i utsnittet. */
function panelGrid(P: Box, f: number, after = 0.72) {
  const headY = P.y + 28 * f;
  const tagY = P.y + P.h - 24 * f;
  const top = headY + 14;
  const bottom = tagY - 18 * f - 8;
  return {
    headY,
    tagY,
    top,
    bottom,
    cy: (top + bottom) / 2,
    avail: bottom - top,
    bx: P.x + P.w * 0.21,
    ax: P.x + P.w * after,
    a1: P.x + P.w * 0.39,
    a2: P.x + P.w * 0.51,
  };
}

/** Pila i midten med hva som skjer over («tilfør E_b» / «frigjør Q») og energien på et skilt under. */
function EnergyArrow({ g, f, label, value, color, dim }: { g: ReturnType<typeof panelGrid>; f: number; label: ReactNode; value: string; color: string; dim?: boolean }) {
  const mid = (g.a1 + g.a2) / 2;
  return (
    <g>
      <Reaksjonspil x1={g.a1} x2={g.a2} y={g.cy} color={color} dim={dim} />
      <LysTxt x={mid} y={g.cy - 22 * f} weight={700}>
        {label}
      </LysTxt>
      <ValueTag x={mid} y={g.cy + 32 * f} text={value} color={color} size={0.85} />
    </g>
  );
}

/* ---------- Bindingsenergi: del opp den valgte kjernen ---------- */

function SplitPanel({ sel, P, narrow }: { sel: Nuclide; P: Box; narrow: boolean }) {
  const f = useTextScale();
  const g = panelGrid(P, f);
  const N = sel.A - sel.Z;
  const b = bindingEnergy(sel.Z, sel.A, sel.mass);
  const parts = sel.Z * M_H1_U + N * M_NEUTRON_U;
  const rx = P.w * 0.17;
  const ry = g.avail * 0.46;
  // Samme radius per nukleon i kjernen og i skyen, så stor at skyen fyller ca. en tredel av ellipsen
  const r = Math.min(12 * (narrow ? 1.3 : 1), Math.max(3.4, Math.sqrt((0.32 * Math.PI * rx * ry) / (Math.PI * sel.A))));
  const iso = nuclideText(sel.Z, sel.A);
  const one = sel.A === 1;
  const Ed = b.E < 10 ? 2 : b.E < 100 ? 1 : 0;
  return (
    <g>
      <LysTxt x={g.bx} y={g.headY} weight={700}>
        {narrow ? iso : `Kjernen ${iso}`}
      </LysTxt>
      <LysTxt x={g.ax} y={g.headY} weight={700}>
        {narrow ? countText(sel.Z, N, true) : `Delt opp: ${countText(sel.Z, N, false)}`}
      </LysTxt>
      {one ? (
        <Nukleon x={g.bx} y={g.cy} r={r} type="proton" />
      ) : (
        <Atomkjerne x={g.bx} y={g.cy} Z={sel.Z} N={N} r={r} seed={sel.A} title={`Kjernen ${iso}`} />
      )}
      <FrieNukleoner x={g.ax} y={g.cy} Z={sel.Z} N={N} rx={rx} ry={ry} r={r} />
      <EnergyArrow
        g={g}
        f={f}
        label={
          <>
            tilfør E<TSub>b</TSub>
          </>
        }
        value={`${fmt(b.E, Ed)} MeV`}
        color={CURVE_COLOR}
        dim={one}
      />
      <ValueTag x={g.bx} y={g.tagY} text={`m = ${fmt(sel.mass, 4)} u`} size={0.85} />
      <ValueTag x={g.ax} y={g.tagY} text={`m = ${fmt(parts, 4)} u`} size={0.85} />
    </g>
  );
}

function countText(Z: number, N: number, short: boolean): string {
  if (short) return N === 0 ? `${Z} p` : `${Z} p + ${N} n`;
  const p = Z === 1 ? '1 proton' : `${Z} protoner`;
  if (N === 0) return p;
  return `${p} og ${N === 1 ? '1 nøytron' : `${N} nøytroner`}`;
}

/* ---------- Fisjon og fusjon: før og etter ---------- */

function ReactionPanel({ mode, P, narrow }: { mode: Reaction['id']; P: Box; narrow: boolean }) {
  const f = useTextScale();
  const s = useSceneScale();
  const g = panelGrid(P, f, 0.73);
  const re = reactionEnergy(REACTIONS[mode]);
  // Størrelser i figuren: k > 1 på mobil, der utsnittet er bredere i figurens enheter
  const k = narrow ? Math.max(1.3, s) : 1;
  return (
    <g>
      <LysTxt x={g.bx} y={g.headY} weight={700}>
        Før
      </LysTxt>
      <LysTxt x={g.ax} y={g.headY} weight={700}>
        Etter
      </LysTxt>
      <Energiglod x={g.ax} y={g.cy} r={Math.min(g.avail * 0.55, 90 * k)} />
      {mode === 'fisjon' && <Fission g={g} k={k} f={f} />}
      {mode === 'fusjon' && <Fusion g={g} k={k} f={f} />}
      {mode === 'sola' && <SunFusion g={g} k={k} f={f} />}
      <EnergyArrow g={g} f={f} label="frigjør Q" value={`${fmt(re.Q, 1)} MeV`} color={REACTION_COLOR} />
      <ValueTag x={g.bx} y={g.tagY} text={`m = ${fmt(re.mBefore, 4)} u`} size={0.85} />
      <ValueTag x={g.ax} y={g.tagY} text={`m = ${fmt(re.mAfter, 4)} u`} size={0.85} />
    </g>
  );
}

type Grid = ReturnType<typeof panelGrid>;

/** Nuklidenavn under (eller over) en kjerne. */
function Name({ x, y, children, size = 0.9 }: { x: number; y: number; children: ReactNode; size?: number }) {
  return (
    <LysTxt x={x} y={y} weight={700} size={size}>
      {children}
    </LysTxt>
  );
}

/** Kjerneradius i figurens enheter (som Atomkjerne tegner den), til å plassere navn og piler. */
function nucRadius(A: number, r: number) {
  return A <= 1 ? r : A <= 4 ? r * 2 : r * (1 + 1.1 * Math.cbrt(A));
}

/** Fartspil fra kanten av en kjerne i retningen (dx, dy). */
function VArrow({ x, y, R, dx, dy, len, f, label = true }: { x: number; y: number; R: number; dx: number; dy: number; len: number; f: number; label?: boolean }) {
  const l = Math.hypot(dx, dy) || 1;
  const ux = dx / l;
  const uy = dy / l;
  const sx = x + ux * (R + 3);
  const sy = y + uy * (R + 3);
  const tx = sx + ux * len;
  const ty = sy + uy * len;
  // Etiketten over spissen når pila er nesten vannrett, ellers like forbi spissen
  const flat = Math.abs(uy) < 0.5;
  return (
    <ForceArrow
      x1={sx}
      y1={sy}
      x2={tx}
      y2={ty}
      color={VIZ.velocity}
      width={4.5}
      label={label ? 'v' : undefined}
      labelSize={0.85}
      labelAnchor="middle"
      labelX={flat ? tx - ux * 6 * f : tx + ux * 13 * f}
      labelY={flat ? ty - 13 * f : ty + uy * 13 * f + 6 * f}
    />
  );
}

function Fission({ g, k, f }: { g: Grid; k: number; f: number }) {
  const r = 5.5 * k;
  const ff = fissionFragments();
  // Én skala for fartspilene: nøytronene (raskest) får 50 enheter (mer på mobil)
  const kv = (50 * k) / ff.n.v;
  const RU = nucRadius(235, r);
  const RBa = nucRadius(141, r);
  const RKr = nucRadius(92, r);
  const ux = g.bx + 22 * k;
  const nx = g.bx - RU - 34 * k;
  const ba = { x: g.ax - 34 * k, y: g.cy - 28 * k };
  const kr = { x: g.ax + 38 * k, y: g.cy + 30 * k };
  const neutrons = [
    { x: g.ax + 50 * k, y: g.cy - 58 * k, dx: 0.6, dy: -0.8 },
    { x: g.ax - 76 * k, y: g.cy + 52 * k, dx: -0.5, dy: 0.87 },
    { x: g.ax + 82 * k, y: g.cy - 8 * k, dx: 0.95, dy: -0.3 },
  ];
  return (
    <g>
      {/* Før: et langsomt nøytron treffer uran-235 */}
      <SpeedLines x={nx - r - 2} y={g.cy} length={16 * k} spread={7 * k} color={SCENE.star} />
      <FrittNoytron x={nx} y={g.cy} r={r} />
      <Name x={nx} y={g.cy + r + 24 * f}>
        n
      </Name>
      <Atomkjerne x={ux} y={g.cy} Z={92} N={143} r={r} seed={3} title="Uran-235" />
      <Name x={ux} y={g.cy + RU + 22 * f}>
        {nuclideText(92, 235)}
      </Name>
      {/* Etter: to bruddstykker og tre nye nøytroner farer av gårde (like stor bevegelsesmengde for bruddstykkene) */}
      <Atomkjerne x={ba.x} y={ba.y} Z={56} N={85} r={r} seed={4} title="Barium-141" />
      <Atomkjerne x={kr.x} y={kr.y} Z={36} N={56} r={r} seed={5} title="Krypton-92" />
      <VArrow x={ba.x} y={ba.y} R={RBa} dx={-0.8} dy={-0.6} len={ff.ba.v * kv} f={f} />
      <VArrow x={kr.x} y={kr.y} R={RKr} dx={0.8} dy={0.6} len={ff.kr.v * kv} f={f} />
      {neutrons.map((n, i) => (
        <Fragment key={i}>
          <FrittNoytron x={n.x} y={n.y} r={r} />
          <VArrow x={n.x} y={n.y} R={r} dx={n.dx} dy={n.dy} len={ff.n.v * kv} f={f} label={false} />
        </Fragment>
      ))}
      <Name x={ba.x} y={ba.y - RBa - 8 * f}>
        {nuclideText(56, 141)}
      </Name>
      <Name x={kr.x - 8 * k} y={kr.y + RKr + 22 * f}>
        {nuclideText(36, 92)}
      </Name>
    </g>
  );
}

function Fusion({ g, k, f }: { g: Grid; k: number; f: number }) {
  const r = 10 * k;
  const ff = fusionFragments();
  const kv = (80 * k) / ff.n.v;
  const d = { x: g.bx - 40 * k, y: g.cy };
  const t = { x: g.bx + 42 * k, y: g.cy };
  const he = { x: g.ax - 20 * k, y: g.cy };
  const n = { x: g.ax + 36 * k, y: g.cy };
  const R2 = nucRadius(2, r);
  const R4 = nucRadius(4, r);
  return (
    <g>
      <SpeedLines x={d.x - R2} y={d.y} length={18 * k} spread={14 * k} color={SCENE.star} />
      <SpeedLines x={t.x + R2} y={t.y} length={18 * k} spread={14 * k} dir={-1} color={SCENE.star} />
      <Atomkjerne x={d.x} y={d.y} Z={1} N={1} r={r} title="Deuterium" />
      <Atomkjerne x={t.x} y={t.y} Z={1} N={2} r={r} title="Tritium" />
      <Name x={d.x} y={d.y + R2 + 24 * f}>
        {nuclideText(1, 2)}
      </Name>
      <Name x={t.x} y={t.y + R2 + 24 * f}>
        {nuclideText(1, 3)}
      </Name>
      <Atomkjerne x={he.x} y={he.y} Z={2} N={2} r={r} title="Helium-4" />
      <FrittNoytron x={n.x} y={n.y} r={r} />
      <VArrow x={he.x} y={he.y} R={R4} dx={-1} dy={0} len={ff.he.v * kv} f={f} />
      <VArrow x={n.x} y={n.y} R={r} dx={1} dy={0} len={ff.n.v * kv} f={f} />
      <Name x={he.x} y={he.y + R4 + 24 * f}>
        {nuclideText(2, 4)}
      </Name>
      <Name x={n.x} y={n.y + r + 24 * f}>
        n
      </Name>
      {/* Bevegelsesenergien til hver: det lette nøytronet får mest */}
      <ValueTag x={he.x - 20 * k} y={g.cy - R4 - 24 * f} text={`${fmt(ff.he.K, 1)} MeV`} size={0.75} />
      <ValueTag x={n.x + 24 * k} y={g.cy - R4 - 24 * f} text={`${fmt(ff.n.K, 1)} MeV`} size={0.75} />
    </g>
  );
}

function SunFusion({ g, k, f }: { g: Grid; k: number; f: number }) {
  const r = 11 * k;
  const R4 = nucRadius(4, r);
  const sp = 30 * k;
  const he = { x: g.ax - 26 * k, y: g.cy };
  return (
    <g>
      {[
        [-1, -1],
        [1, -1],
        [-1, 1],
        [1, 1],
      ].map(([dx, dy], i) => (
        <Nukleon key={i} x={g.bx + dx! * sp} y={g.cy + dy! * sp * 0.8} r={r} type="proton" />
      ))}
      <Name x={g.bx} y={g.cy + sp * 0.8 + r + 24 * f}>
        4 · {nuclideText(1, 1)}
      </Name>
      <Atomkjerne x={he.x} y={he.y} Z={2} N={2} r={r} title="Helium-4" />
      <Foton x1={he.x + R4 + 6} y1={he.y - 10 * k} x2={he.x + R4 + 96 * k} y2={he.y - 54 * k} bolgelengde={0.002} farge={VIZ.series[3]} label="γ" amplitude={6 * k} />
      <Foton x1={he.x + R4 + 6} y1={he.y + 10 * k} x2={he.x + R4 + 96 * k} y2={he.y + 54 * k} bolgelengde={0.002} farge={VIZ.series[3]} amplitude={6 * k} />
      <Name x={he.x} y={he.y + R4 + 24 * f}>
        {nuclideText(2, 4)}
      </Name>
      <LysTxt x={he.x} y={he.y + R4 + 48 * f} size={0.8}>
        + 2 e⁺ + 2 ν
      </LysTxt>
    </g>
  );
}
