/**
 * Ren geometri for molekylfigurer (ingen React, testes): atomstørrelser, bindingsstreker som stopper ved kanten av
 * atomkulene, og plasseringer for VSEPR-formene.
 *
 * Vinkler er i grader og måles mot klokka fra positiv x-akse, med y oppover (som i matematikk). I SVG går y nedover,
 * så et punkt i vinkel θ fra (x, y) er (x + L·cos θ, y − L·sin θ). Bruk `polar()`.
 */
import { getElement } from './grunnstoffer';

export interface Pt {
  x: number;
  y: number;
}

/** Punktet i avstand `len` og vinkel `deg` (grader, mot klokka, y opp) fra (x, y), i SVG-koordinater. */
export function polar(x: number, y: number, len: number, deg: number): Pt {
  const a = (deg * Math.PI) / 180;
  return { x: x + len * Math.cos(a), y: y - len * Math.sin(a) };
}

/** Vinkelen (grader, mot klokka, y opp) fra a til b i SVG-koordinater. */
export function angleOf(a: Pt, b: Pt): number {
  return (Math.atan2(-(b.y - a.y), b.x - a.x) * 180) / Math.PI;
}

/** Radius for karbon (76 pm) i figurens enheter når skalaen er 1. */
export const ATOM_R_CARBON = 24;

/**
 * Radius til en atomkule i figurens enheter: vokser med kvadratroten av den kovalente radiusen, så H blir liten og
 * Na stor uten at forskjellene blir ekstreme (begrenset til 0,72–1,6 ganger karbon). Med `charge` brukes
 * ioneradiusen (Na⁺ blir mindre enn Na, Cl⁻ større enn Cl) når den er kjent.
 */
export function atomRadius(symbol: string, opts: { charge?: number; scale?: number } = {}): number {
  const e = getElement(symbol);
  const scale = opts.scale ?? 1;
  if (!e) return ATOM_R_CARBON * scale;
  const pm = (opts.charge ? e.ionicRadius[opts.charge] : undefined) ?? e.covalentRadius;
  const k = Math.min(1.6, Math.max(0.72, Math.sqrt(pm / 76)));
  return ATOM_R_CARBON * k * scale;
}

/**
 * Linjestykket mellom to sirkler (sentrum a og b, radius ra og rb), forkortet så det starter og slutter på
 * kanten pluss `gap`. `offset` flytter linja sidelengs (for dobbelt- og trippelbindinger), og da kuttes den der den
 * krysser sirkelen. Gir null når sirklene overlapper så mye at det ikke er noe igjen å tegne.
 */
export function trimSegment(a: Pt, b: Pt, ra: number, rb: number, gap = 0, offset = 0): { x1: number; y1: number; x2: number; y2: number } | null {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy);
  if (!(len > 0)) return null;
  const ux = dx / len;
  const uy = dy / len;
  // Normalvektor (90° på linja)
  const nx = -uy;
  const ny = ux;
  const cut = (r: number) => (r > 0 ? Math.sqrt(Math.max(0, r * r - offset * offset)) + gap : 0);
  const t1 = cut(ra);
  const t2 = len - cut(rb);
  if (t2 - t1 < 1) return null;
  return {
    x1: a.x + ux * t1 + nx * offset,
    y1: a.y + uy * t1 + ny * offset,
    x2: a.x + ux * t2 + nx * offset,
    y2: a.y + uy * t2 + ny * offset,
  };
}

/* ---------- VSEPR ---------- */

export type Geometry = 'linear' | 'trigonal-planar' | 'tetrahedral' | 'trigonal-pyramidal' | 'bent' | 'bent-120';

/** Hvordan en binding tegnes: i papirplanet, kile (mot deg) eller stiplet kile (bort fra deg). */
export type Stereo = 'plane' | 'wedge' | 'hash';

export interface GeometryInfo {
  /** Norsk navn på formen. */
  name: string;
  /** Ideell bindingsvinkel i grader (H₂O 104,5°, NH₃ 107°, CH₄ 109,5°). */
  angle: number;
  /** Bindende elektronpar (bindinger) og frie elektronpar rundt sentralatomet. */
  bonds: number;
  lonePairs: number;
  /** Eksempel fra lærebøkene. */
  example: string;
}

export const GEOMETRIES: Record<Geometry, GeometryInfo> = {
  linear: { name: 'lineær', angle: 180, bonds: 2, lonePairs: 0, example: 'CO2' },
  'trigonal-planar': { name: 'plan trigonal', angle: 120, bonds: 3, lonePairs: 0, example: 'BF3' },
  tetrahedral: { name: 'tetraedrisk', angle: 109.5, bonds: 4, lonePairs: 0, example: 'CH4' },
  'trigonal-pyramidal': { name: 'trigonal pyramide', angle: 107, bonds: 3, lonePairs: 1, example: 'NH3' },
  bent: { name: 'vinklet', angle: 104.5, bonds: 2, lonePairs: 2, example: 'H2O' },
  'bent-120': { name: 'vinklet', angle: 119, bonds: 2, lonePairs: 1, example: 'SO2' },
};

/**
 * Formen ut fra antall bindingsretninger (en dobbelt- eller trippelbinding teller som én) og frie elektronpar på
 * sentralatomet (VSEPR). Gir null for kombinasjoner som ikke er med (f.eks. fem eller seks elektronpar).
 */
export function vseprGeometry(bonds: number, lonePairs: number): Geometry | null {
  const key = `${bonds}-${lonePairs}`;
  const map: Record<string, Geometry> = {
    '2-0': 'linear',
    '3-0': 'trigonal-planar',
    '4-0': 'tetrahedral',
    '3-1': 'trigonal-pyramidal',
    '2-2': 'bent',
    '2-1': 'bent-120',
  };
  return map[key] ?? null;
}

export interface VseprLayout {
  geometry: Geometry;
  center: Pt;
  /** Endene av bindingene (der nabotomene står), med tegnemåte. */
  ligands: (Pt & { angle: number; stereo: Stereo })[];
  /** Retningene (grader) til de frie elektronparene. */
  lonePairs: number[];
  /** Bindingsvinkelen som vises, og de to bindingene (indekser i `ligands`) den står mellom. */
  angle: { value: number; between: [number, number] };
}

/** Retninger (grader) og tegnemåte for hver form, før rotasjon. */
function directions(g: Geometry, angle: number): { ligands: [number, Stereo, number][]; lonePairs: number[]; between: [number, number] } {
  const half = angle / 2;
  switch (g) {
    case 'linear':
      return { ligands: [[180, 'plane', 1], [0, 'plane', 1]], lonePairs: [], between: [0, 1] };
    case 'trigonal-planar':
      return { ligands: [[90, 'plane', 1], [210, 'plane', 1], [330, 'plane', 1]], lonePairs: [], between: [1, 2] };
    case 'tetrahedral':
      // To bindinger i papirplanet (opp og ned til venstre, 109,5° imellom), én kile og én stiplet kile mot høyre.
      return {
        ligands: [[90, 'plane', 1], [90 + angle, 'plane', 1], [305, 'wedge', 0.9], [345, 'hash', 0.9]],
        lonePairs: [],
        between: [0, 1],
      };
    case 'trigonal-pyramidal':
      // Som tetraederet, men det frie elektronparet står der den øverste bindingen var.
      return {
        ligands: [[90 + 109.5, 'plane', 1], [305, 'wedge', 0.9], [345, 'hash', 0.9]],
        lonePairs: [90],
        between: [0, 1],
      };
    case 'bent':
      // Begge bindingene i papirplanet med den ekte vinkelen mellom seg; de frie parene peker opp.
      return { ligands: [[270 - half, 'plane', 1], [270 + half, 'plane', 1]], lonePairs: [90 + 38, 90 - 38], between: [0, 1] };
    case 'bent-120':
      return { ligands: [[270 - half, 'plane', 1], [270 + half, 'plane', 1]], lonePairs: [90], between: [0, 1] };
  }
}

/**
 * Plasseringer for en VSEPR-form med sentralatomet i (x, y) og bindingslengde `bond` (fra sentrum til sentrum).
 * `rotate` dreier hele figuren (grader, mot klokka). `angle` overstyrer bindingsvinkelen for vinklede molekyler.
 * Kilene og de stiplede kilene er litt kortere (90 %), fordi de peker skrått ut av papirplanet.
 */
export function vsepr(geometry: Geometry, opts: { x: number; y: number; bond: number; rotate?: number; angle?: number }): VseprLayout {
  const info = GEOMETRIES[geometry];
  const angle = opts.angle ?? info.angle;
  const rot = opts.rotate ?? 0;
  const d = directions(geometry, angle);
  return {
    geometry,
    center: { x: opts.x, y: opts.y },
    ligands: d.ligands.map(([deg, stereo, f]) => ({ ...polar(opts.x, opts.y, opts.bond * f, deg + rot), angle: deg + rot, stereo })),
    lonePairs: d.lonePairs.map((deg) => deg + rot),
    angle: { value: angle, between: d.between },
  };
}
