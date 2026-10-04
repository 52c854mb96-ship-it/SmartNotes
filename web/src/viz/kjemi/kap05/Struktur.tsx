/**
 * Tegning av organiske molekyler i tre visninger: strukturformel (bokstaver og streker), skjelettformel (sikksakk) og
 * kule-pinne-modell. Brukes av alle visualiseringene i kapittel 5. Geometrien kommer fra struktur.ts.
 */
import type { ReactNode } from 'react';
import { Atom, Bond, KJEMI, Txt, VIZ, atomColors, useTextScale } from '../kit';
import { bounds, dist, freeDirections, dirOf, hydrogenCount, neighbours, step, type FunctionalGroup, type Mol, type P, type View } from './struktur';

export const VIEW_OPTIONS: { value: View; label: string }[] = [
  { value: 'struktur', label: 'Strukturformel' },
  { value: 'skjelett', label: 'Skjelettformel' },
  { value: 'kule', label: 'Kule-pinne-modell' },
];

/** Fargene på bindinger som brytes og dannes (samme som i kapittel 4: energi inn / ut). */
export const BREAK = KJEMI.endo;
export const FORM = KJEMI.exo;
/** Fargen på hovedkjeden og den funksjonelle gruppa. */
export const CHAIN = VIZ.series[0]!;
export const GROUP = VIZ.series[3]!;

/** Størrelsen på bokstavene i strukturformelen (relativ, som Txt). */
const LETTER = 1.05;

/** Skriftstørrelsen i figurens enheter for en relativ størrelse (samme regel som .kj-txt). */
export const fontPx = (f: number, size = LETTER) => 17 * f * size;

/** Minste enhet (px per C–C) som gir lesbare bokstaver og synlige streker i strukturformelen. */
export function minUnit(view: View, f: number): number {
  return view === 'struktur' ? 1.9 * fontPx(f) : view === 'kule' ? 46 * Math.max(1, 0.85 * f) : 34 * f;
}

/** Ekstra plass rundt molekylet (i figurens enheter) til bokstaver og nummer. */
export function marginPx(view: View, f: number): number {
  return view === 'skjelett' ? fontPx(f) * 0.9 : fontPx(f) * 0.75;
}

export interface Fit {
  u: number;
  ox: number;
  oy: number;
  /** Bredde og høyde molekylet tar med marg. */
  w: number;
  h: number;
}

/** Størrelsen molekylet tar med enheten u (inkludert marg). */
export function moleculeSize(mol: Mol, view: View, u: number, f: number): { w: number; h: number } {
  const b = bounds(mol, view);
  const m = marginPx(view, f);
  return { w: (b.maxX - b.minX) * u + 2 * m, h: (b.maxY - b.minY) * u + 2 * m };
}

/**
 * Enhet og origo som får molekylet til å passe i boksen (sentrert), med enheten mellom minUnit og uMax. Er boksen for
 * liten, blir enheten likevel minUnit (boksen bør da gjøres større).
 */
export function fitMolecule(mol: Mol, view: View, box: { x: number; y: number; w: number; h: number }, f: number, uMax = 90): Fit {
  const b = bounds(mol, view);
  const m = marginPx(view, f);
  const bw = Math.max(1e-6, b.maxX - b.minX);
  const bh = Math.max(1e-6, b.maxY - b.minY);
  const fitW = (box.w - 2 * m) / bw;
  const fitH = (box.h - 2 * m) / bh;
  const uu = Math.max(minUnit(view, f), Math.min(fitW, fitH, uMax));
  const cx = box.x + box.w / 2;
  const cy = box.y + box.h / 2;
  const ox = cx - ((b.minX + b.maxX) / 2) * uu;
  const oy = cy + ((b.minY + b.maxY) / 2) * uu;
  return { u: uu, ox, oy, w: bw * uu + 2 * m, h: bh * uu + 2 * m };
}

/** Kuleradius (i enheter av C–C) i kule-pinne-modellen. */
const BALL: Record<string, number> = { C: 0.22, H: 0.15, O: 0.21, N: 0.21, Cl: 0.27, Br: 0.29, I: 0.31 };

export interface MoleculeViewProps {
  mol: Mol;
  view: View;
  /** Enhet og origo (se fitMolecule). */
  fit: Pick<Fit, 'u' | 'ox' | 'oy'>;
  /** Bindinger som brytes eller dannes (indekser i mol.bonds). */
  marks?: { bonds: number[]; kind: 'brytes' | 'dannes' };
  /** Hovedkjeden som fremheves (atomindekser i rekkefølge fra C1). */
  chain?: number[];
  /** Skriv nummer (1, 2, 3 …) ved atomene i hovedkjeden. */
  numbers?: boolean;
  /** Funksjonelle grupper som fremheves. */
  groups?: FunctionalGroup[];
  /** Atomer med rød ring (for mange bindinger). */
  errorAtoms?: number[];
  /** Ton ned hele molekylet. */
  dim?: boolean;
}

/** Et molekyl i valgt visning. */
export function MoleculeView({ mol, view, fit, marks, chain, numbers, groups, errorAtoms, dim }: MoleculeViewProps) {
  const f = useTextScale();
  const k = Math.max(1, 0.85 * f);
  const { u, ox, oy } = fit;
  const fs = fontPx(f);
  const pos = (i: number): P | null => {
    const a = mol.atoms[i]!;
    const p = view === 'skjelett' ? a.z : a.p;
    return p ? { x: ox + p.x * u, y: oy - p.y * u } : null;
  };
  const shown = (i: number) => pos(i) !== null;
  const marked = new Set(marks?.bonds ?? []);
  const markColor = marks?.kind === 'brytes' ? BREAK : FORM;

  /** Radius bindingene stopper ved (bokstav, kule eller ingenting for C i skjelettformelen). */
  const radius = (i: number): number => {
    const a = mol.atoms[i]!;
    if (view === 'kule') return BALL[a.el]! * u;
    if (view === 'skjelett') return a.el === 'C' ? 0 : a.el.length > 1 ? fs * 0.66 : fs * 0.5;
    return a.el.length > 1 ? fs * 0.58 : fs * 0.42;
  };

  /** Bokstavene ved et atom i skjelettformelen: «OH», «HO», «Cl». */
  const labelText = (i: number): string => {
    const a = mol.atoms[i]!;
    if (view !== 'skjelett' || a.el === 'C') return a.el;
    const h = hydrogenCount(mol, i);
    if (!h) return a.el;
    const nb = neighbours(mol, i).find(({ j }) => mol.atoms[j]!.z);
    const left = nb ? mol.atoms[nb.j]!.z!.x > mol.atoms[i]!.z!.x + 0.1 : false;
    const hs = `H${h > 1 ? h : ''}`;
    return left ? `${hs}${a.el}` : `${a.el}${hs}`;
  };

  const layers: ReactNode[] = [];

  // Hovedkjeden som et bredt, gjennomsiktig bånd under alt annet
  if (chain && chain.length > 0) {
    const pts = chain.map(pos).filter((p): p is P => p !== null);
    const w = view === 'skjelett' ? 0.34 * u : 0.42 * u;
    layers.push(
      <g key="chain" opacity={0.22}>
        {pts.length === 1 ? (
          <circle cx={pts[0]!.x} cy={pts[0]!.y} r={w / 2} fill={CHAIN} />
        ) : (
          <polyline points={pts.map((p) => `${p.x},${p.y}`).join(' ')} fill="none" stroke={CHAIN} strokeWidth={w} strokeLinecap="round" strokeLinejoin="round" />
        )}
      </g>,
    );
  }

  // Funksjonelle grupper
  if (groups && groups.length > 0) {
    layers.push(
      <g key="groups" opacity={0.2}>
        {groups.map((g, gi) => (
          <g key={gi}>
            {g.atoms.filter(shown).map((i) => {
              const p = pos(i)!;
              return <circle key={i} cx={p.x} cy={p.y} r={Math.max(0.3 * u, fs * 0.75)} fill={GROUP} />;
            })}
            {mol.bonds
              .filter((b) => g.atoms.includes(b.a) && g.atoms.includes(b.b) && shown(b.a) && shown(b.b))
              .map((b, bi) => {
                const p = pos(b.a)!;
                const q = pos(b.b)!;
                return <line key={bi} x1={p.x} y1={p.y} x2={q.x} y2={q.y} stroke={GROUP} strokeWidth={Math.max(0.6 * u, fs * 1.5)} strokeLinecap="round" />;
              })}
          </g>
        ))}
      </g>,
    );
  }

  // Glorie rundt bindinger som brytes/dannes
  mol.bonds.forEach((b, bi) => {
    if (!marked.has(bi)) return;
    const p = pos(b.a);
    const q = pos(b.b);
    if (!p || !q) return;
    layers.push(<line key={`halo${bi}`} x1={p.x} y1={p.y} x2={q.x} y2={q.y} stroke={markColor} strokeWidth={10 * k} strokeLinecap="round" opacity={0.25} />);
  });

  // Bindinger
  mol.bonds.forEach((b, bi) => {
    const p = pos(b.a);
    const q = pos(b.b);
    if (!p || !q) return;
    const on = marked.has(bi);
    layers.push(
      <g key={`b${bi}`} strokeDasharray={on && marks?.kind === 'brytes' ? `${6 * k} ${4 * k}` : undefined}>
        <Bond
          a={{ x: p.x, y: p.y, r: radius(b.a) }}
          b={{ x: q.x, y: q.y, r: radius(b.b) }}
          order={b.order}
          color={on ? markColor : KJEMI.bond}
          width={(on ? 3.4 : view === 'skjelett' ? 2.6 : 2.2) * k}
        />
      </g>,
    );
  });

  // Atomer
  mol.atoms.forEach((a, i) => {
    const p = pos(i);
    if (!p) return;
    if (view === 'kule') {
      layers.push(<Atom key={`a${i}`} x={p.x} y={p.y} el={a.el} r={BALL[a.el]! * u} label={a.el === 'H' && BALL.H! * u < 9 ? '' : a.el} />);
      return;
    }
    if (view === 'skjelett' && a.el === 'C') return;
    const text = labelText(i);
    const color = a.el === 'C' || a.el === 'H' ? VIZ.ink : atomColors(a.el).line;
    // I skjelettformelen står selve grunnstoffbokstaven på hjørnet, og H-ene på siden bort fra bindingen (OH, HO).
    const half = (a.el.length > 1 ? 0.62 : 0.4) * fs;
    const hFirst = view === 'skjelett' && text.startsWith('H') && a.el !== 'H';
    const hLast = view === 'skjelett' && text.length > a.el.length && !hFirst;
    const anchor = hFirst ? 'end' : hLast ? 'start' : 'middle';
    const x = hFirst ? p.x + half : hLast ? p.x - half : p.x;
    layers.push(
      <Txt key={`a${i}`} x={x} y={p.y + fs * 0.36} anchor={anchor} size={LETTER} color={color} weight={a.el === 'H' ? 500 : 650} halo={view === 'skjelett'}>
        {subscriptH(text)}
      </Txt>,
    );
  });

  // Feil: rød ring
  for (const i of errorAtoms ?? []) {
    const p = pos(i);
    if (!p) continue;
    layers.push(<circle key={`err${i}`} cx={p.x} cy={p.y} r={Math.max(fs * 0.85, 0.3 * u)} fill="none" stroke={KJEMI.minus} strokeWidth={3 * k} />);
  }

  // Nummer i hovedkjeden
  if (numbers && chain) {
    chain.forEach((i, n) => {
      const p = pos(i);
      if (!p) return;
      const a = mol.atoms[i]!;
      const src = view === 'skjelett' ? a.z! : a.p;
      const dirs = neighbours(mol, i)
        .map(({ j }) => (view === 'skjelett' ? mol.atoms[j]!.z : mol.atoms[j]!.p))
        .filter((x): x is P => !!x)
        .map((x) => dirOf(src, x));
      // Diagonalen med mest plass (bindingene står i 0°, 90° … i strukturformelen)
      const cand = view === 'skjelett' ? freeDirections(dirs, 1) : [315, 225, 45, 135];
      const best = cand.reduce((b, d) => (minGap(d, dirs) > minGap(b, dirs) + 1 ? d : b), cand[0]!);
      const r = view === 'skjelett' ? 0.42 * u : 0.42 * u;
      const lp = step({ x: 0, y: 0 }, Math.max(r, fs * 0.95), best);
      layers.push(
        <Txt key={`n${i}`} x={p.x + lp.x} y={p.y - lp.y + fs * 0.3} size={0.72} color={CHAIN} weight={700}>
          {n + 1}
        </Txt>,
      );
    });
  }

  return <g opacity={dim ? 0.35 : undefined}>{layers}</g>;
}

function minGap(d: number, dirs: number[]): number {
  if (dirs.length === 0) return 180;
  return Math.min(
    ...dirs.map((x) => {
      const a = Math.abs((((d - x) % 360) + 360) % 360);
      return a > 180 ? 360 - a : a;
    }),
  );
}

/** «OH2» → O, H, ₂ med senket tall. */
function subscriptH(text: string): ReactNode {
  const m = /^(.*?)(\d+)(.*)$/.exec(text);
  if (!m) return text;
  return (
    <>
      {m[1]}
      <tspan dy="0.32em" fontSize="0.72em">
        {m[2]}
      </tspan>
      <tspan dy="-0.32em">{m[3]}</tspan>
    </>
  );
}

/** Avstand mellom to punkter i figuren (til layout). */
export const figDist = dist;
