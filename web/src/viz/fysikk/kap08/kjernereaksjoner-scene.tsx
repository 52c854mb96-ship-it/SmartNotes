/**
 * Figur 1 i «Kjernereaksjoner: α, β og γ»: et nærbilde av hverdagsgjenstanden der startkjernen finnes (med mål), og
 * en lupe inn i stoffet der én kjerne henfaller: morkjernen → datterkjernen + partiklene som sendes ut, med fartspil,
 * energien Q og verdier som kan slås av.
 */
import type { ReactNode } from 'react';
import { Txt, VIZ, fmt, fmtSci, useTextScale } from '../../kit';
import { Atomkjerne, Dimension, Elektron, ForceArrow, Foton, SCENE, Callout, ValueTag, alpha, useSceneScale, useStrokeScale, useSvgId, RadialGradient } from '../../kit/scene';
import { nuclideWords } from '../kap07/elements';
import { PARTICLE } from '../kap07/parts';
import { Eksitasjon, Kildegjenstand, Noytrino, Omgivelser, Positron, Zoomlinjer, kildeGeometri, omgivelseGeo } from './kjernereaksjoner-deler';
import { kildeSkala, maalTekst, type Kilde } from './kjernereaksjoner-kilder';
import { gammaPhotons, magnificationExponent, nuclideLabel, type AlphaKinetics, type Decay, type DecayEnergy } from './model';

export const W = 800;

interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface SceneLayout {
  narrow: boolean;
  H: number;
  /** Nærbildet med gjenstanden. */
  scene: Box;
  /** Midten av gjenstanden (vannrett). */
  objX: number;
  /** Lupa inn i stoffet. */
  panel: Box;
  /** Plass til én kjerne (radius), raden med kjernene og tekstlinjene under. */
  Rs: number;
  cy: number;
  tagY: number;
  lab1: number;
  lab2: number;
  valY: number;
  /** Midten av morkjernen, datterkjernen og de utsendte partiklene. */
  px: number;
  dx: number;
  ex: number;
}

/**
 * Plasseringen av alt i figuren. `f` er tekstskaleringen (1 på PC, ca. 1,8 på mobil). På mobil får høye gjenstander
 * (klokke, sopp, glass) et høyere nærbilde, så de ikke blir bittesmå.
 */
export function sceneLayout(f: number, kilde: Kilde): SceneLayout {
  const narrow = f > 1.3;
  const tall = kilde.hoyde / kilde.bredde >= 0.75;
  const sceneH = narrow ? Math.round(300 + 40 * (f - 1) + (tall ? 110 : 0)) : 0;
  const Rs = narrow ? 80 : 50;
  const gap = narrow ? 150 : 110;
  const top = 44 * f;
  // Panelet: overskrift, kjernene, Q-skiltet, to tekstlinjer og en rad med verdier
  const inner = top + 2 * Rs + 18 + 38 * f + 22 * f + 26 * f + 20 * f;
  const panelH = Math.round(inner);
  const panel: Box = narrow ? { x: 16, y: sceneH + 14, w: W - 32, h: panelH } : { x: 276, y: 14, w: W - 276 - 14, h: panelH };
  const H = narrow ? panel.y + panel.h + 14 : panel.h + 28;
  const scene: Box = narrow ? { x: 0, y: 0, w: W, h: sceneH } : { x: 0, y: 0, w: W, h: H };
  const cy = panel.y + top + Rs + 4;
  const tagY = cy + Rs;
  const lab1 = cy + Rs + 38 * f;
  const lab2 = lab1 + 22 * f;
  const valY = lab2 + 26 * f;
  const px = panel.x + 18 + Rs;
  const dx = px + 2 * Rs + gap;
  const ex = (dx + Rs + panel.x + panel.w) / 2;
  return { narrow, H, scene, objX: narrow ? 380 : 138, panel, Rs, cy, tagY, lab1, lab2, valY, px, dx, ex };
}

/** Skalaen (px/m) i nærbildet: gjenstanden blir så stor som plassen tillater. */
export function sceneScale(k: Kilde, L: SceneLayout, f: number): number {
  const g0 = omgivelseGeo(k.omgivelse, L.scene.y, L.scene.h);
  const target = L.narrow ? 330 : 190;
  // Høye gjenstander må gi plass til navnet over seg
  const room = k.omgivelse === 'tak' ? target : g0.flate - L.scene.y - 40 * f;
  const byWidth = (L.narrow ? 560 : 236) / k.bredde;
  return Math.min(kildeSkala(k, target), room / k.hoyde, byWidth);
}

/** Radius til ett nukleon i lupa, så den største kjernen får plass i Rs. */
export function nucleonRadius(A: number, L: SceneLayout): number {
  return Math.min(L.narrow ? 22 : 14, L.Rs / (1 + 1.1 * Math.cbrt(Math.max(A, 4))));
}

/** Radien til en tegnet kjerne (som i Atomkjerne). */
function drawnRadius(A: number, r: number): number {
  return A <= 4 ? 1.9 * r : r * (1 + 1.1 * Math.cbrt(A));
}

/** Pikselskala for farten til α (px per m/s): ca. 2 Rs for 2 · 10⁷ m/s. */
function speedScale(L: SceneLayout): number {
  return (2 * L.Rs) / 2e7;
}

const TYPE_TEXT = { alfa: 'α', 'beta-': 'β⁻', 'beta+': 'β⁺', gamma: 'γ' } as const;

export interface SceneProps {
  L: SceneLayout;
  kilde: Kilde;
  dc: Decay;
  energy: DecayEnergy | null;
  kin: AlphaKinetics | null;
  stable: boolean;
  blocked: boolean;
  /** Vis fartspiler og verdiskilt. */
  values: boolean;
}

export function KjerneScene({ L, kilde, dc, energy, kin, stable, blocked, values }: SceneProps) {
  const f = useTextScale();
  const ss = useStrokeScale();
  const P = sceneScale(kilde, L, f);
  const g = omgivelseGeo(kilde.omgivelse, L.scene.y, L.scene.h);
  const geo = kildeGeometri(kilde.type, P);
  // Gjenstanden står midt i nærbildet, men flyttes til venstre når et loddrett mål (med tekst) ellers havner under lupa
  const vertical = Math.abs(geo.maal.x2 - geo.maal.x1) < 1;
  const extRight = vertical ? geo.maal.x1 + 10 * f + maalTekst(kilde.maal).length * 0.56 * 17 * f : geo.half;
  const limit = L.narrow ? L.scene.x + L.scene.w - 14 : L.panel.x - 12;
  const ox = Math.max(L.scene.x + 14 + geo.half, Math.min(L.objX, limit - extRight));
  const oy = kilde.omgivelse === 'tak' ? g.tak - 2 : g.flate;
  const spot = { x: ox + geo.spot.dx, y: oy + geo.spot.dy };
  const clip = useSvgId('kr-scene');
  const { panel } = L;
  const corners: [[number, number], [number, number]] = L.narrow
    ? [
        [panel.x + 10, panel.y],
        [panel.x + panel.w - 10, panel.y],
      ]
    : [
        [panel.x, panel.y + 10],
        [panel.x, panel.y + panel.h - 10],
      ];
  const horizontal = Math.abs(geo.maal.y2 - geo.maal.y1) < 1;
  const maalOffset = horizontal ? -(12 + 22 * f) : 0;
  // Navnet rett over gjenstanden (under røykvarsleren, der målet står mellom)
  const tak = kilde.omgivelse === 'tak';
  // (På mobil står navnet på røykvarsleren til høyre for den, der det er plass.)
  const side = tak && L.narrow;
  const pointAt = side
    ? { x: ox + geo.half * 0.92, y: oy + geo.bottom * 0.45 }
    : tak
      ? { x: ox - geo.half * 0.5, y: oy + geo.bottom * 0.8 }
      : { x: ox - geo.half * 0.25, y: oy + geo.top * 0.8 };
  const labelX = side ? ox + geo.half + 24 : pointAt.x;
  const labelY = side ? oy + geo.bottom * 0.45 + 40 * f : tak ? oy + geo.bottom + 34 + 52 * f : oy + geo.top - 16 * f;
  return (
    <>
      <defs>
        <clipPath id={clip}>
          <rect x={L.scene.x} y={L.scene.y} width={L.scene.w} height={L.scene.h} />
        </clipPath>
      </defs>
      <g clipPath={`url(#${clip})`}>
        <Omgivelser type={kilde.omgivelse} x={L.scene.x} y={L.scene.y} w={L.scene.w} h={L.scene.h} P={P} />
        <Kildegjenstand type={kilde.type} x={ox} y={oy} P={P} />
        <Dimension x1={ox + geo.maal.x1} y1={oy + geo.maal.y1} x2={ox + geo.maal.x2} y2={oy + geo.maal.y2} offset={maalOffset} label={maalTekst(kilde.maal)} />
        <Callout x={pointAt.x} y={pointAt.y} lx={labelX} ly={labelY} anchor={side ? 'start' : 'middle'} strong size={0.9}>
          {kilde.navn}
        </Callout>
      </g>
      <Zoomlinjer spot={spot} r={7 * ss} corners={corners} />
      <Lupe L={L} dc={dc} energy={energy} kin={kin} stable={stable} blocked={blocked} values={values} P={P} />
    </>
  );
}

/** Lupa: mørk ramme med én kjerne som henfaller. */
function Lupe({ L, dc, energy, kin, stable, blocked, values, P }: Omit<SceneProps, 'kilde'> & { P: number }) {
  const f = useTextScale();
  const ss = useStrokeScale();
  const sc = useSceneScale();
  const bg = useSvgId('kr-lupe');
  const clip = useSvgId('kr-lupe-klipp');
  const { panel: b, cy, px, dx } = L;
  const p = dc.parent;
  const d = dc.daughter;
  const r = nucleonRadius(p.A, L);
  const Rp = drawnRadius(p.A, r);
  const Rd = drawnRadius(d.A, r);
  const exp = magnificationExponent(Rp, p.A, P);
  const shown = dc.possible && !stable;
  const light = SCENE.star;
  const rx = 14;
  return (
    <g>
      <RadialGradient
        id={bg}
        cx={0.4}
        cy={0.42}
        r={0.8}
        stops={[
          [0, SCENE.spaceGlow],
          [1, SCENE.space],
        ]}
      />
      <defs>
        <clipPath id={clip}>
          <rect x={b.x} y={b.y} width={b.w} height={b.h} rx={rx} />
        </clipPath>
      </defs>
      <rect x={b.x + 2} y={b.y + 4} width={b.w} height={b.h} rx={rx} fill={SCENE.shadow} opacity={0.35} />
      <rect x={b.x} y={b.y} width={b.w} height={b.h} rx={rx} fill={`url(#${bg})`} />
      <g clipPath={`url(#${clip})`}>
        <Txt x={b.x + 18} y={b.y + 26 * f} anchor="start" size={0.78} color={alpha(light, 0.8)} halo={false}>
          Én kjerne, forstørret ca. 10{superscript(exp)} ganger
        </Txt>

        {/* Morkjernen */}
        {p.excited && <Eksitasjon x={px} y={cy} R={Rp} color={PARTICLE.photon} />}
        <Atomkjerne x={px} y={cy} Z={p.Z} N={p.A - p.Z} r={r} seed={3} />
        <LysTekst x={px} y={L.lab1} weight={700}>
          {nuclideLabel(p.Z, p.A, p.excited)}
        </LysTekst>
        <LysTekst x={px} y={L.lab2} muted within={[b.x + 10, b.x + b.w - 10]}>
          {`${nuclideWords(p.Z, p.A)}${p.excited ? ', eksitert' : ''}`}
        </LysTekst>

        {!shown ? (
          <LysTekst x={(dx + b.x + b.w) / 2 - L.Rs * 0.4} y={cy + 6 * f} muted>
            {stable ? 'Stabil kjerne: henfaller ikke' : dc.type === 'gamma' ? 'Ingen γ fra grunntilstanden' : dc.type === 'alfa' && p.Z < 3 ? 'For lett til α-henfall' : 'Henfallet er ikke mulig'}
          </LysTekst>
        ) : (
          <>
            <Reaksjonspil x1={px + Rp + 10 * sc} x2={dx - Rd - 10 * sc} y={cy} dashed={blocked} />
            <LysTekst x={(px + Rp + dx - Rd) / 2} y={cy - 14 * f} weight={700}>
              {TYPE_TEXT[dc.type]}
            </LysTekst>
            {values && energy && <ValueTag x={(px + dx) / 2} y={L.tagY} size={0.75} text={`Q = ${qText(energy.Q)} MeV`} color={energy.Q > 0 ? VIZ.ink : VIZ.muted} />}
            <g opacity={blocked ? 0.4 : 1}>
              {d.excited && <Eksitasjon x={dx} y={cy} R={Rd} color={PARTICLE.photon} />}
              <Atomkjerne x={dx} y={cy} Z={d.Z} N={d.A - d.Z} r={r} seed={5} />
              <LysTekst x={dx} y={L.lab1} weight={700}>
                {nuclideLabel(d.Z, d.A, d.excited)}
              </LysTekst>
              <LysTekst x={dx} y={L.lab2} muted within={[b.x + 10, b.x + b.w - 10]}>
                {`${nuclideWords(d.Z, d.A)}${d.excited ? ', eksitert' : ''}`}
              </LysTekst>
              <Utsendt L={L} dc={dc} r={r} Rd={Rd} kin={kin} values={values && !blocked} energy={energy} />
            </g>
            {values && kin && (
              <ValueTag x={dx - 8} y={L.valY} size={0.7} text={`${L.narrow ? '' : 'v = '}${fmtSci(kin.vdaughter, 1)} m/s`} color={VIZ.velocity} />
            )}
          </>
        )}
      </g>
      <rect x={b.x} y={b.y} width={b.w} height={b.h} rx={rx} fill="none" stroke={SCENE.outline} strokeWidth={1.2 * ss} />
      <rect x={b.x + 1.5 * ss} y={b.y + 1.5 * ss} width={b.w - 3 * ss} height={b.h - 3 * ss} rx={rx - 1} fill="none" stroke={alpha(light, 0.18)} strokeWidth={1 * ss} />
    </g>
  );
}

/** Partiklene som sendes ut, med fartspil og verdier. */
function Utsendt({ L, dc, r, Rd, kin, values, energy }: { L: SceneLayout; dc: Decay; r: number; Rd: number; kin: AlphaKinetics | null; values: boolean; energy: DecayEnergy | null }) {
  const f = useTextScale();
  const sc = useSceneScale();
  const { cy, dx, ex, panel: b } = L;
  const right = b.x + b.w - 16;
  const startX = dx + Rd + 18 * sc;
  if (dc.type === 'alfa') {
    const ra = 1.9 * r;
    const ax = startX + ra;
    const ay = cy - L.Rs * 0.42;
    const ang = (-16 * Math.PI) / 180;
    const len = kin ? kin.valpha * speedScale(L) : 0;
    const s0 = ra + 6 * sc;
    const x1 = ax + Math.cos(ang) * s0;
    const y1 = ay + Math.sin(ang) * s0;
    const maxLen = (right - x1) / Math.cos(ang);
    const l = Math.min(len, maxLen);
    return (
      <>
        <Atomkjerne x={ax} y={ay} Z={2} N={2} r={r} seed={1} />
        {values && kin && <ForceArrow x1={x1} y1={y1} x2={x1 + Math.cos(ang) * l} y2={y1 + Math.sin(ang) * l} color={VIZ.velocity} width={6} label="v" />}
        <LysTekst x={ex} y={L.lab1} weight={700}>
          ⁴He
        </LysTekst>
        <LysTekst x={ex} y={L.lab2} muted>
          alfapartikkel
        </LysTekst>
        {values && kin && <ValueTag x={ex + 4} y={L.valY} size={0.7} text={`${L.narrow ? '' : 'v = '}${fmtSci(kin.valpha, 2)} m/s`} color={VIZ.velocity} />}
      </>
    );
  }
  if (dc.type === 'gamma') {
    const photons = gammaPhotons(dc.parent.Z, dc.parent.A) ?? [0];
    const two = photons.length > 1;
    const len = Math.min(right - startX, L.Rs * 2.6);
    return (
      <>
        {photons.map((_, i) => {
          const dy = two ? (i === 0 ? -0.55 : 0.5) * L.Rs : -0.25 * L.Rs;
          return (
            <Foton
              key={i}
              x1={startX}
              y1={cy + dy * 0.25}
              x2={startX + len}
              y2={cy + dy}
              bolgelengde={0.001}
              farge={PARTICLE.photon}
              amplitude={Math.max(6, 0.55 * r) * sc}
              svingninger={9}
            />
          );
        })}
        <LysTekst x={ex} y={L.lab1} weight={700}>
          γ
        </LysTekst>
        <LysTekst x={ex} y={L.lab2} muted>
          {two ? 'to fotoner' : 'foton'}
        </LysTekst>
        {values && energy && (
          <ValueTag x={ex} y={L.valY} size={0.7} text={two ? `E = ${photons.map((E) => qText(E)).join(' + ')} MeV` : `E = ${qText(photons[0] ?? energy.Q)} MeV`} />
        )}
      </>
    );
  }
  const positron = dc.type === 'beta+';
  const re = Math.max(8, 0.6 * r) * sc;
  const ey = cy - L.Rs * 0.48;
  const ny = cy + L.Rs * 0.5;
  const exX = startX + re;
  const len = Math.min(L.Rs * 1.5, right - exX - re - 40 * f);
  const ang1 = (-14 * Math.PI) / 180;
  const ang2 = (12 * Math.PI) / 180;
  const color = positron ? PARTICLE.positron : PARTICLE.electron;
  return (
    <>
      {positron ? <Positron x={exX} y={ey} r={re} color={color} /> : <Elektron x={exX} y={ey} r={re} />}
      {values && (
        <ForceArrow
          x1={exX + Math.cos(ang1) * (re + 5)}
          y1={ey + Math.sin(ang1) * (re + 5)}
          x2={exX + Math.cos(ang1) * (re + 5 + len)}
          y2={ey + Math.sin(ang1) * (re + 5 + len)}
          color={VIZ.velocity}
          width={6}
          label="v"
        />
      )}
      <Noytrino x={exX} y={ny} r={re * 0.75} color={alpha(SCENE.star, 0.85)} />
      {values && (
        <ForceArrow
          x1={exX + Math.cos(ang2) * (re + 4)}
          y1={ny + Math.sin(ang2) * (re + 4)}
          x2={exX + Math.cos(ang2) * (re + 4 + len * 0.85)}
          y2={ny + Math.sin(ang2) * (re + 4 + len * 0.85)}
          color={VIZ.velocity}
          width={6}
          dashed
        />
      )}
      <LysTekst x={exX} y={ny + re * 0.75 + 20 * f} muted>
        {positron ? 'ν' : 'ν̄'}
      </LysTekst>
      <LysTekst x={ex} y={L.lab1} weight={700}>
        {positron ? 'e⁺' : 'e⁻'}
      </LysTekst>
      <LysTekst x={ex} y={L.lab2} muted>
        {positron ? 'positron' : 'elektron'}
      </LysTekst>
      {values && energy && energy.Q > 0 && <ValueTag x={ex} y={L.valY} size={0.7} text={`opptil ${qText(energy.Q)} MeV`} />}
    </>
  );
}

/**
 * Lys tekst på den mørke bunnen i lupa (samme i begge temaene). Med `within` flyttes sentrert tekst inn så den ikke
 * går ut over kanten (bredden anslås fra antall tegn).
 */
function LysTekst({
  x,
  y,
  children,
  anchor = 'middle',
  weight,
  muted,
  within,
}: {
  x: number;
  y: number;
  children: ReactNode;
  anchor?: 'start' | 'middle' | 'end';
  weight?: number;
  muted?: boolean;
  within?: [number, number];
}) {
  const f = useTextScale();
  const size = muted ? 0.85 : 1;
  let xx = x;
  if (within && anchor === 'middle') {
    const text = Array.isArray(children) ? children.join('') : String(children);
    const half = (text.length * 0.56 * 17 * size * f) / 2;
    xx = Math.min(Math.max(x, within[0] + half), within[1] - half);
  }
  return (
    <Txt x={xx} y={y} anchor={anchor} weight={weight} color={muted ? alpha(SCENE.star, 0.72) : SCENE.star} halo={false} size={size}>
      {children}
    </Txt>
  );
}

/** Lys, tykk pil fra morkjernen til datterkjernen (stiplet når henfallet ikke kan skje). */
function Reaksjonspil({ x1, x2, y, dashed }: { x1: number; x2: number; y: number; dashed?: boolean }) {
  const ss = useStrokeScale();
  if (!(x2 - x1 > 12)) return null;
  const hl = Math.min(16 * ss, (x2 - x1) * 0.4);
  const hw = 8 * ss;
  const c = alpha(SCENE.star, 0.85);
  return (
    <g aria-hidden>
      <line x1={x1} y1={y} x2={x2 - hl + 1} y2={y} stroke={c} strokeWidth={4 * ss} strokeLinecap="round" strokeDasharray={dashed ? `${6 * ss} ${5 * ss}` : undefined} />
      <polygon points={`${x2},${y} ${x2 - hl},${y - hw} ${x2 - hl},${y + hw}`} fill={c} />
    </g>
  );
}

/** Q med tre desimaler under 1 MeV, ellers to. */
export function qText(Q: number): string {
  return fmt(Q, Math.abs(Q) < 1 ? 3 : 2);
}

const SUP: Record<string, string> = { '-': '⁻', '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹' };
function superscript(n: number): string {
  return String(n)
    .split('')
    .map((c) => SUP[c] ?? c)
    .join('');
}
