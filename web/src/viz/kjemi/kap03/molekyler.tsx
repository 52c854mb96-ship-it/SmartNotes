/**
 * Små kalottmodeller (kuler som overlapper litt) av molekylene i kapittel 3, til partikkelbilder.
 * Kit-et har <Atom>/<Bond> for store kule-pinne-figurer og <WaterMolecule> for vann; her trengs mange små
 * molekyler av flere slag (H₂, O₂, N₂, NH₃, CH₄, CO₂, Fe, S, FeS), som kan roteres og plasseres med <Partikler render>.
 */
import { atomColors, formula, polar } from '../kit';

/** Atomradius i figurens enheter ved skala 1 (omtrent etter kovalent radius, H minst). */
const BASE_R: Record<string, number> = { H: 5, C: 7.5, N: 7, O: 7, S: 8.5, Fe: 8.5, Cl: 8.5, Na: 9, Cu: 8.5, Ag: 9 };
const radius = (el: string) => BASE_R[el] ?? 8;
/** Avstand mellom to bundne atomer: kulene overlapper litt (kalottmodell). */
const dist = (a: string, b: string) => 0.8 * (radius(a) + radius(b));

export interface MiniAtom {
  el: string;
  x: number;
  y: number;
  r: number;
}

/** Sentralatom med ligander i gitte retninger (grader, mot klokka). Ligandene tegnes sist, så de synes. */
function star(center: string, ligand: string, angles: number[]): MiniAtom[] {
  const d = dist(center, ligand);
  return [{ el: center, x: 0, y: 0, r: radius(center) }, ...angles.map((a) => ({ el: ligand, ...polar(0, 0, d, a), r: radius(ligand) }))];
}

function diatomic(a: string, b: string): MiniAtom[] {
  const d = dist(a, b);
  return [
    { el: a, x: -d / 2, y: 0, r: radius(a) },
    { el: b, x: d / 2, y: 0, r: radius(b) },
  ];
}

const TEMPLATES: Record<string, () => MiniAtom[]> = {
  H2: () => diatomic('H', 'H'),
  O2: () => diatomic('O', 'O'),
  N2: () => diatomic('N', 'N'),
  Cl2: () => diatomic('Cl', 'Cl'),
  HCl: () => diatomic('H', 'Cl'),
  FeS: () => diatomic('Fe', 'S'),
  H2O: () => star('O', 'H', [270 - 52.25, 270 + 52.25]),
  NH3: () => star('N', 'H', [90, 210, 330]),
  CH4: () => star('C', 'H', [45, 135, 225, 315]),
  CO2: () => star('C', 'O', [0, 180]),
};

/** Formelen uten tilstand: «H2O(l)» → «H2O». */
const bare = (f: string) => f.replace(/\((aq|s|l|g)\)$/i, '').trim();

/** Atomene i et lite molekyl (sentrert i origo, skala 1). Ukjente formler blir en ring av atomer. */
export function miniAtoms(f: string): MiniAtom[] {
  const t = TEMPLATES[bare(f)];
  if (t) return t();
  const atoms = Object.entries(formula(f).atoms).flatMap(([el, n]) => Array.from({ length: n }, () => el));
  if (atoms.length === 1) return [{ el: atoms[0]!, x: 0, y: 0, r: radius(atoms[0]!) }];
  const R = 8 + atoms.length * 1.5;
  return atoms.map((el, i) => ({ el, ...polar(0, 0, R, (360 * i) / atoms.length), r: radius(el) }));
}

/** Radius til en sirkel som rommer hele molekylet (skala 1). */
export function miniRadius(f: string): number {
  return Math.max(...miniAtoms(f).map((a) => Math.hypot(a.x, a.y) + a.r));
}

/** Molekylet tegnet med sentrum i (x, y), skalert og rotert (grader). */
export function MiniMolecule({ f, x, y, scale = 1, angle = 0, ring }: { f: string; x: number; y: number; scale?: number; angle?: number; ring?: string }) {
  const atoms = miniAtoms(f);
  const a = (angle * Math.PI) / 180;
  const cos = Math.cos(a);
  const sin = Math.sin(a);
  // Sentralatomet først, ligandene over (for to like atomer spiller rekkefølgen ingen rolle).
  return (
    <g>
      {ring && <circle cx={x} cy={y} r={(miniRadius(f) + 3) * scale} fill="none" stroke={ring} strokeWidth={1.8} strokeDasharray="4 3" />}
      {atoms.map((p, i) => {
        const c = atomColors(p.el);
        const px = x + (p.x * cos - p.y * sin) * scale;
        const py = y + (p.x * sin + p.y * cos) * scale;
        return <circle key={i} cx={px} cy={py} r={p.r * scale} fill={c.fill} stroke={c.line} strokeWidth={1.3} />;
      })}
    </g>
  );
}
