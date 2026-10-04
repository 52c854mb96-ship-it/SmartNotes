/**
 * 2D-strukturer for protolysefiguren (ingen React, testes i model.test.ts). Koordinater i bindingslengder med y opp.
 *
 * En syre er tegnet med protonet den gir fra seg (`h`) rett til høyre for donoratomet (`key`). En base er tegnet med
 * akseptoratomet (`key`) slik at det nye protonet kommer inn fra venstre, i (x − 1, y). Formelle ladninger står på
 * atomene: donoratomet får én negativ ladning mer når protonet går, akseptoratomet én positiv mer når det tar det.
 */

export interface SAtom {
  el: string;
  x: number;
  y: number;
  /** Formell ladning på atomet før protolysen. */
  q?: number;
  /** Retning (grader, mot klokka) der ladningen skrives, en ledig plass ved atomet. */
  qa?: number;
}

export interface Structure {
  atoms: SAtom[];
  /** Bindinger [a, b, orden]. */
  bonds: [number, number, (1 | 2)?][];
  /** Donoratomet (syre) eller akseptoratomet (base). */
  key: number;
  /** Protonet som gis fra seg (bare for syrer). */
  h?: number;
}

const rad = (d: number) => (d * Math.PI) / 180;
const P = (deg: number, x0 = 0, y0 = 0): { x: number; y: number } => ({ x: x0 + Math.cos(rad(deg)), y: y0 + Math.sin(rad(deg)) });
const A = (el: string, p: { x: number; y: number }, extra: Partial<SAtom> = {}): SAtom => ({ el, x: p.x, y: p.y, ...extra });

const C2 = P(30);
const C2m = P(150);

/** Syrene, med protonet som gis fra seg til høyre. */
export const ACID_STRUCTURES: Record<string, Structure> = {
  HCl: { atoms: [A('Cl', { x: 0, y: 0 }, { qa: 90 }), A('H', { x: 1, y: 0 })], bonds: [[0, 1]], key: 0, h: 1 },
  HSO4: {
    atoms: [
      A('S', { x: 0, y: 0 }),
      A('O', { x: 0, y: 1 }),
      A('O', { x: 0, y: -1 }),
      A('O', { x: -1, y: 0 }, { q: -1, qa: 135 }),
      A('O', { x: 1, y: 0 }, { qa: 300 }),
      A('H', { x: 2, y: 0 }),
    ],
    bonds: [
      [0, 1, 2],
      [0, 2, 2],
      [0, 3],
      [0, 4],
      [4, 5],
    ],
    key: 4,
    h: 5,
  },
  CH3COOH: {
    atoms: [
      A('C', { x: 0, y: 0 }),
      A('C', C2),
      A('O', { x: C2.x, y: C2.y + 1 }),
      A('O', P(-30, C2.x, C2.y), { qa: 300 }),
      A('H', P(150)),
      A('H', P(210)),
      A('H', P(270)),
      A('H', { x: P(-30, C2.x, C2.y).x + 1, y: P(-30, C2.x, C2.y).y }),
    ],
    bonds: [[0, 1], [1, 2, 2], [1, 3], [0, 4], [0, 5], [0, 6], [3, 7]],
    key: 3,
    h: 7,
  },
  NH4: {
    atoms: [A('N', { x: 0, y: 0 }, { q: 1, qa: 135 }), A('H', P(90)), A('H', P(180)), A('H', P(270)), A('H', P(0))],
    bonds: [[0, 1], [0, 2], [0, 3], [0, 4]],
    key: 0,
    h: 4,
  },
  H2O: { atoms: [A('O', { x: 0, y: 0 }, { qa: 300 }), A('H', P(104.5)), A('H', P(0))], bonds: [[0, 1], [0, 2]], key: 0, h: 2 },
};

/** Basene, med akseptoratomet til venstre (protonet kommer inn fra venstre). */
export const BASE_STRUCTURES: Record<string, Structure> = {
  H2O: { atoms: [A('O', { x: 0, y: 0 }, { qa: 116 }), A('H', P(52.25)), A('H', P(-52.25))], bonds: [[0, 1], [0, 2]], key: 0 },
  NH3: { atoms: [A('N', { x: 0, y: 0 }, { qa: 120 }), A('H', P(60)), A('H', P(0)), A('H', P(300))], bonds: [[0, 1], [0, 2], [0, 3]], key: 0 },
  OH: { atoms: [A('O', { x: 0, y: 0 }, { q: -1, qa: 90 }), A('H', P(0))], bonds: [[0, 1]], key: 0 },
  CO3: {
    atoms: [A('C', { x: 0, y: 0 }), A('O', { x: -1, y: 0 }, { q: -1, qa: 90 }), A('O', P(60)), A('O', P(300), { q: -1, qa: 330 })],
    bonds: [[0, 1], [0, 2, 2], [0, 3]],
    key: 1,
  },
  CH3COO: {
    atoms: [
      A('C', { x: 0, y: 0 }),
      A('C', C2m),
      A('O', { x: C2m.x, y: C2m.y + 1 }),
      A('O', P(210, C2m.x, C2m.y), { q: -1, qa: 240 }),
      A('H', P(30)),
      A('H', P(330)),
      A('H', P(270)),
    ],
    bonds: [[0, 1], [1, 2, 2], [1, 3], [0, 4], [0, 5], [0, 6]],
    key: 3,
  },
};

/** Atomene og ladningen i en struktur (før protolysen), for å sjekke mot formelen. */
export function structureComposition(s: Structure): { atoms: Record<string, number>; charge: number } {
  const atoms: Record<string, number> = {};
  let charge = 0;
  for (const a of s.atoms) {
    atoms[a.el] = (atoms[a.el] ?? 0) + 1;
    charge += a.q ?? 0;
  }
  return { atoms, charge };
}

/** Utstrekningen (i bindingslengder) rundt nøkkelatomet: venstre, høyre, opp og ned. */
export function extent(s: Structure): { left: number; right: number; up: number; down: number } {
  const k = s.atoms[s.key]!;
  const xs = s.atoms.map((a) => a.x - k.x);
  const ys = s.atoms.map((a) => a.y - k.y);
  return { left: -Math.min(...xs), right: Math.max(...xs), up: Math.max(...ys), down: -Math.min(...ys) };
}
