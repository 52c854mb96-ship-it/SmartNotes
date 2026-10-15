/**
 * Stein og mineraler i geofagfigurene: krystaller i 3D med glans og valgfrie isotopprikker (`Krystall`), håndstykker
 * med teksturen til bergarten (`Steinprove`: kornstørrelse, porfyr, glass, blærer, lag, fossiler, foliasjon og bånd) og
 * en lupe som forstørrer et utsnitt (`Lupe`).
 *
 * Samme stil som scene-kit-et: toninger fra core.tsx, kontur, lys fra øvre venstre og myk skygge, ingen filtre og ingen
 * bilder. Mineralfargene kommer fra tonen i `MINERALER` (`mineralFarge`) og bygger på SCENE- og PAINTS-fargene, så de
 * følger lyst og mørkt tema. Krystaller og detaljene i steinprøvene vokser på mobil med `useGeoScale`. De rene
 * hjelperne (`krystallGeometri`, `steinproveGeometri`, `prikkerIPolygon`, `lupeKjegle`) kan testes og
 * brukes uten React.
 */
import { useMemo, type ReactNode } from 'react';
import { useTextScale } from '../../kit/controls';
import { VIZ } from '../../kit/colors';
import { Txt } from '../../kit/txt';
import { ContactShadow, LinearGradient, RadialGradient, alpha, mix, shade, tint, useSvgId } from '../../kit/scene/core';
import { PAINTS, SCENE } from '../../kit/scene/palette';
import { placeParticles, seededRandom } from '../../kjemi/kit/random';
import { GEO, type GeoPaint } from './colors';
import { useGeoScale, useGeoStroke } from './felles';
import { BERGARTER, type BergartId } from './bergarter';
import { MINERALER, type Glans, type Krystallform, type MineralId, type MineralTone } from './mineraler';
import { Malestokk, kornSti, polygonAreal, punktIPolygon, voronoiMosaikk } from './korn';

type P = readonly [number, number];
type V3 = readonly [number, number, number];

const r2 = (v: number) => Math.round(v * 100) / 100;
const fin = (v: number | undefined, d: number) => (v !== undefined && Number.isFinite(v) ? v : d);
const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
const RAD = Math.PI / 180;
const poly = (p: readonly P[], lukket = true) => (p.length < 2 ? '' : `M${p.map(([x, y]) => `${r2(x)} ${r2(y)}`).join('L')}${lukket ? 'Z' : ''}`);
const lerp = (a: P, b: P, t: number): P => [a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1])];

/* ================================================================================================ Mineralfarger */

/** Fargen til en mineraltone: fyll, kant, og om mineralet er gjennomsiktig (glass) eller har metallglans. */
export interface MineralFarge extends GeoPaint {
  gjennomsiktig: boolean;
  metall: boolean;
}

const TONER: Record<MineralTone, MineralFarge> = {
  fargelos: { fill: mix(SCENE.glass, PAINTS.hvit, 0.3), line: shade(SCENE.glassEdge, 0.3), gjennomsiktig: true, metall: false },
  hvit: { fill: mix(PAINTS.hvit, SCENE.stone, 0.08), line: shade(SCENE.stone, 0.25), gjennomsiktig: false, metall: false },
  gra: { fill: mix(SCENE.stone, PAINTS.hvit, 0.15), line: shade(SCENE.stone, 0.45), gjennomsiktig: false, metall: false },
  svart: { fill: mix(PAINTS.svart, SCENE.stone, 0.1), line: shade(PAINTS.svart, 0.55), gjennomsiktig: false, metall: false },
  rosa: { fill: mix(PAINTS.rod, PAINTS.hvit, 0.58), line: shade(PAINTS.rod, 0.35), gjennomsiktig: false, metall: false },
  rod: { fill: mix(shade(PAINTS.rod, 0.25), PAINTS.lilla, 0.28), line: shade(PAINTS.rod, 0.65), gjennomsiktig: false, metall: false },
  brun: { fill: mix(PAINTS.oransje, PAINTS.svart, 0.42), line: shade(PAINTS.oransje, 0.68), gjennomsiktig: false, metall: false },
  gul: { fill: mix(PAINTS.gul, PAINTS.hvit, 0.15), line: shade(PAINTS.gul, 0.5), gjennomsiktig: false, metall: false },
  gronn: { fill: mix(PAINTS.gronn, PAINTS.gul, 0.3), line: shade(PAINTS.gronn, 0.55), gjennomsiktig: false, metall: false },
  fiolett: { fill: mix(PAINTS.lilla, PAINTS.hvit, 0.2), line: shade(PAINTS.lilla, 0.5), gjennomsiktig: true, metall: false },
  messing: { fill: mix(SCENE.gold, SCENE.metalLight, 0.22), line: mix(shade(SCENE.gold, 0.55), PAINTS.gronn, 0.12), gjennomsiktig: false, metall: true },
  solv: { fill: SCENE.metal, line: shade(SCENE.metalDark, 0.35), gjennomsiktig: false, metall: true },
  gull: { fill: SCENE.gold, line: shade(SCENE.gold, 0.5), gjennomsiktig: false, metall: true },
};

/**
 * Fargen til et mineral eller en mineraltone (`MINERALER[id].tone`) i begge temaer: fyll, kant, gjennomsiktig (kvarts,
 * flusspat) og metall (pyritt, blyglans, gull). Til egne mineralkorn i kapitlene:
 *   const c = mineralFarge('biotitt');  <path d={…} fill={c.fill} stroke={c.line} />
 */
export function mineralFarge(mineralEllerTone: MineralId | MineralTone): MineralFarge {
  const tone = (TONER as Record<string, MineralFarge>)[mineralEllerTone] ? (mineralEllerTone as MineralTone) : (MINERALER[mineralEllerTone as MineralId]?.tone ?? 'gra');
  return TONER[tone];
}

/* ================================================================================================ Krystall: geometri */

/** Navnene på krystallformene til knapper og forklaringer. */
export const KRYSTALLFORM_NAVN: Record<Krystallform, string> = {
  prisme: 'Prisme',
  rombeeder: 'Romboeder',
  terning: 'Terning',
  oktaeder: 'Oktaeder',
  tavle: 'Tavle',
  dodekaeder: 'Rombedodekaeder',
};

/** Alle krystallformene i fast rekkefølge. */
export const KRYSTALLFORMER: readonly Krystallform[] = ['prisme', 'rombeeder', 'terning', 'oktaeder', 'tavle', 'dodekaeder'];

/** Én flate i en tegnet krystall (koordinater med midten i (0, 0) og største mål 1). */
export interface KrystallFlate {
  /** Hjørnene i figuren (y nedover). */
  punkter: P[];
  /** Lys fra øvre venstre foran: −1 (helt bort) til 1 (rett mot lyset). */
  lys: number;
  /** Glansen (speilrefleks) 0–1. */
  glans: number;
  /** Om flaten vender mot oss. */
  synlig: boolean;
  /** Hvilken del av krystallen: sideflate, endeflate eller spiss. */
  del: 'side' | 'ende' | 'spiss' | 'flate';
  /** Striper på flaten (kvarts på prismeflatene, pyritt, glimmerflak på sidene av en tavle). */
  striper: [P, P][];
}

/** Resultatet av `krystallGeometri`. */
export interface KrystallGeometri {
  /** Flatene, de bakre (usynlige) først. */
  flater: KrystallFlate[];
  /** Omrisset (konveks innhylling av alle hjørnene). */
  omriss: P[];
  /** Bredde og høyde (den største er 1). */
  bredde: number;
  hoyde: number;
}

/** Valgene til `krystallGeometri` og `Krystall`. */
export interface KrystallFormValg {
  /** Dreiing om den loddrette aksen i grader (standard etter formen). */
  dreiing?: number;
  /** Hvor mye vi ser ovenfra i grader (standard etter formen). */
  helning?: number;
  /** Vipping i bildeplanet i grader (med klokka). */
  vipp?: number;
  /** Prisme: lengden i forhold til bredden (standard 2,2). Tavle: tykkelsen i forhold til bredden (standard 0,3). */
  forlengelse?: number;
  /** Prisme og tavle: antall sider (6 = sekskantet som kvarts og glimmer, 4 = firkantet som zirkon). */
  sider?: 4 | 6;
  /** Prisme: spiss i begge ender (zirkon) i stedet for bare øverst (kvarts). */
  dobbel?: boolean;
}

interface Polyeder {
  v: V3[];
  f: { idx: number[]; del: KrystallFlate['del'] }[];
}

const sub3 = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot3 = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross3 = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm3 = (a: V3): V3 => {
  const l = Math.hypot(a[0], a[1], a[2]) || 1;
  return [a[0] / l, a[1] / l, a[2] / l];
};
const midt3 = (vs: readonly V3[]): V3 => {
  const s = vs.reduce<[number, number, number]>((m, v) => [m[0] + v[0], m[1] + v[1], m[2] + v[2]], [0, 0, 0]);
  return [s[0] / vs.length, s[1] / vs.length, s[2] / vs.length];
};

function terning(): Polyeder {
  const v: V3[] = [];
  for (const x of [-1, 1]) for (const y of [-1, 1]) for (const z of [-1, 1]) v.push([x, y, z]);
  const f: Polyeder['f'] = [];
  for (let a = 0; a < 3; a++)
    for (const s of [-1, 1])
      f.push({
        idx: v.map((p, i) => [p, i] as const).filter(([p]) => p[a] === s).map(([, i]) => i),
        del: a === 1 ? 'ende' : 'side',
      });
  return { v, f };
}

function oktaeder(): Polyeder {
  const v: V3[] = [
    [1, 0, 0],
    [-1, 0, 0],
    [0, 1, 0],
    [0, -1, 0],
    [0, 0, 1],
    [0, 0, -1],
  ];
  const f: Polyeder['f'] = [];
  for (const x of [0, 1]) for (const y of [2, 3]) for (const z of [4, 5]) f.push({ idx: [x, y, z], del: 'flate' });
  return { v, f };
}

function rombedodekaeder(): Polyeder {
  const v: V3[] = [];
  for (const x of [-1, 1]) for (const y of [-1, 1]) for (const z of [-1, 1]) v.push([x, y, z]);
  const akse = (a: number, s: number): V3 => [a === 0 ? 2 * s : 0, a === 1 ? 2 * s : 0, a === 2 ? 2 * s : 0];
  for (let a = 0; a < 3; a++) for (const s of [-1, 1]) v.push(akse(a, s));
  const idx = (p: V3) => v.findIndex((q) => q[0] === p[0] && q[1] === p[1] && q[2] === p[2]);
  const f: Polyeder['f'] = [];
  for (let a = 0; a < 3; a++)
    for (let b = a + 1; b < 3; b++) {
      const c = 3 - a - b;
      for (const sa of [-1, 1])
        for (const sb of [-1, 1]) {
          const kube = (sc: number): V3 => {
            const p = [0, 0, 0];
            p[a] = sa;
            p[b] = sb;
            p[c] = sc;
            return p as unknown as V3;
          };
          f.push({ idx: [idx(akse(a, sa)), idx(kube(1)), idx(akse(b, sb)), idx(kube(-1))], del: 'flate' });
        }
    }
  return { v, f };
}

function rombeeder(): Polyeder {
  // En terning presset sammen langs romdiagonalen (1, 1, 1): den stumpe romboederen kalkspat spaltes i. Litt overdrevet
  // (flatevinkler ca. 69° og 111° mot 78° og 102° i kalkspat), så den ikke ser ut som en terning på skjermen. Så dreid
  // så den ligger på en flate, som et spaltestykke på et bord: toppflaten er en rombe, og sideflatene heller.
  const t = terning();
  const n: V3 = norm3([1, 1, 1]);
  const s = -0.55;
  const v0 = t.v.map((p): V3 => {
    const d = dot3(p, n) * s;
    return [p[0] + d * n[0], p[1] + d * n[1], p[2] + d * n[2]];
  });
  // Normalen til flaten der y = +1 i terningen, dreid opp til (0, 1, 0) (Rodrigues)
  const topp = t.f.find((f) => f.idx.every((i) => t.v[i]![1] === 1))!;
  const tv = topp.idx.map((i) => v0[i]!);
  let nf = norm3(cross3(sub3(tv[1]!, tv[0]!), sub3(tv[2]!, tv[0]!)));
  if (nf[1] < 0) nf = [-nf[0], -nf[1], -nf[2]];
  const opp: V3 = [0, 1, 0];
  const akse = cross3(nf, opp);
  const sinA = Math.hypot(akse[0], akse[1], akse[2]);
  const cosA = dot3(nf, opp);
  const k = sinA > 1e-9 ? norm3(akse) : ([1, 0, 0] as V3);
  const drei = (p: V3): V3 => {
    const kxp = cross3(k, p);
    const kp = dot3(k, p);
    return [p[0] * cosA + kxp[0] * sinA + k[0] * kp * (1 - cosA), p[1] * cosA + kxp[1] * sinA + k[1] * kp * (1 - cosA), p[2] * cosA + kxp[2] * sinA + k[2] * kp * (1 - cosA)];
  };
  return { v: v0.map(drei), f: t.f.map((x) => ({ ...x, del: x === topp ? 'ende' : 'flate' })) };
}

function prisme(sider: number, lengde: number, spiss: number, dobbel: boolean, flate: boolean, sx = 1): Polyeder {
  const v: V3[] = [];
  const off = sider === 4 ? Math.PI / 4 : 0;
  for (let i = 0; i < sider; i++) {
    const a = off + (2 * Math.PI * i) / sider;
    v.push([Math.cos(a) * sx, lengde / 2, Math.sin(a)]);
  }
  for (let i = 0; i < sider; i++) {
    const a = off + (2 * Math.PI * i) / sider;
    v.push([Math.cos(a) * sx, -lengde / 2, Math.sin(a)]);
  }
  const f: Polyeder['f'] = [];
  for (let i = 0; i < sider; i++) {
    const j = (i + 1) % sider;
    f.push({ idx: [sider + i, sider + j, j, i], del: 'side' });
  }
  if (flate) {
    f.push({ idx: Array.from({ length: sider }, (_, i) => i), del: 'ende' });
  } else {
    v.push([0, lengde / 2 + spiss, 0]);
    const top = v.length - 1;
    for (let i = 0; i < sider; i++) f.push({ idx: [i, (i + 1) % sider, top], del: 'spiss' });
  }
  if (dobbel && !flate) {
    v.push([0, -lengde / 2 - spiss, 0]);
    const bunn = v.length - 1;
    for (let i = 0; i < sider; i++) f.push({ idx: [sider + i, sider + ((i + 1) % sider), bunn], del: 'spiss' });
  } else {
    f.push({ idx: Array.from({ length: sider }, (_, i) => sider + i), del: 'ende' });
  }
  return { v, f };
}

const STANDARD_VINKEL: Record<Krystallform, [number, number]> = {
  terning: [28, 24],
  oktaeder: [22, 16],
  dodekaeder: [18, 20],
  rombeeder: [0, 30],
  prisme: [14, 14],
  tavle: [18, 40],
};

/** Konveks innhylling (monoton kjede), mot klokka i et vanlig koordinatsystem. */
export function konveksInnhylling(punkter: readonly P[]): P[] {
  const p = [...punkter].filter(([x, y]) => Number.isFinite(x) && Number.isFinite(y)).sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  if (p.length < 3) return p;
  const kryss = (o: P, a: P, b: P) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lav: P[] = [];
  for (const q of p) {
    while (lav.length >= 2 && kryss(lav[lav.length - 2]!, lav[lav.length - 1]!, q) <= 0) lav.pop();
    lav.push(q);
  }
  const hoy: P[] = [];
  for (let i = p.length - 1; i >= 0; i--) {
    const q = p[i]!;
    while (hoy.length >= 2 && kryss(hoy[hoy.length - 2]!, hoy[hoy.length - 1]!, q) <= 0) hoy.pop();
    hoy.push(q);
  }
  return [...lav.slice(0, -1), ...hoy.slice(0, -1)];
}

/**
 * Geometrien til en krystall sett skrått ovenfra med lys fra øvre venstre foran: flatene projisert (parallellprojeksjon),
 * lyset og glansen på hver flate, striper (kvarts, pyritt, glimmer) og omrisset. Midten er (0, 0) og det største målet
 * (bredde eller høyde) er 1, så komponenten bare ganger med størrelsen. Ren funksjon.
 */
export function krystallGeometri(form: Krystallform, valg: KrystallFormValg = {}): KrystallGeometri | null {
  const [dStd, hStd] = STANDARD_VINKEL[form] ?? [20, 20];
  const sider = valg.sider === 4 ? 4 : 6;
  let p: Polyeder;
  switch (form) {
    case 'terning':
      p = terning();
      break;
    case 'oktaeder':
      p = oktaeder();
      break;
    case 'dodekaeder':
      p = rombedodekaeder();
      break;
    case 'rombeeder':
      p = rombeeder();
      break;
    case 'tavle':
      p = prisme(sider, clamp(fin(valg.forlengelse, 0.3), 0.05, 2) * 2, 0, false, true, sider === 4 ? 1.5 : 1);
      break;
    case 'prisme':
      p = prisme(sider, clamp(fin(valg.forlengelse, 2.2), 0.2, 8), sider === 4 ? 0.85 : 1.05, Boolean(valg.dobbel), false);
      break;
    default:
      return null;
  }
  const psi = fin(valg.dreiing, dStd) * RAD;
  const phi = fin(valg.helning, hStd) * RAD;
  const vipp = fin(valg.vipp, 0) * RAD;
  const rot = (a: V3): V3 => {
    const x1 = a[0] * Math.cos(psi) + a[2] * Math.sin(psi);
    const z1 = -a[0] * Math.sin(psi) + a[2] * Math.cos(psi);
    const y2 = a[1] * Math.cos(phi) - z1 * Math.sin(phi);
    const z2 = a[1] * Math.sin(phi) + z1 * Math.cos(phi);
    return [x1, y2, z2];
  };
  const skjerm = (a: V3): P => {
    const r = rot(a);
    const x = r[0];
    const y = -r[1];
    return [x * Math.cos(vipp) - y * Math.sin(vipp), x * Math.sin(vipp) + y * Math.cos(vipp)];
  };
  const L = norm3([-0.5, 0.66, 0.56]);
  const Hv = norm3([L[0], L[1], L[2] + 1]);
  const sentrum = midt3(p.v);
  const raa = p.f.map((fl) => {
    const vs = fl.idx.map((i) => p.v[i]!);
    const c = midt3(vs);
    let n = norm3(cross3(sub3(vs[1]!, vs[0]!), sub3(vs[2]!, vs[0]!)));
    if (dot3(n, sub3(c, sentrum)) < 0) n = [-n[0], -n[1], -n[2]];
    // Ordne hjørnene rundt midten av flaten
    const u = norm3(sub3(vs[0]!, c));
    const w = cross3(n, u);
    const ordnet = [...vs].sort((a, b) => Math.atan2(dot3(sub3(a, c), w), dot3(sub3(a, c), u)) - Math.atan2(dot3(sub3(b, c), w), dot3(sub3(b, c), u)));
    // Normalen i bildet: dreid som krystallen og vippet i bildeplanet, så lyset alltid kommer fra øvre venstre
    const nr = rot(n);
    const nv: V3 = [nr[0] * Math.cos(vipp) + nr[1] * Math.sin(vipp), -nr[0] * Math.sin(vipp) + nr[1] * Math.cos(vipp), nr[2]];
    // Striper i modellrommet
    const striper: [V3, V3][] = [];
    if ((form === 'prisme' || form === 'tavle') && fl.del === 'side' && ordnet.length === 4) {
      // Striper på tvers av sideflatene: vannrette riller på kvarts, flak på kanten av glimmer
      const sortert = ordnet.slice().sort((q, r) => q[1] - r[1]);
      const [a, b] = sortert.slice(0, 2) as [V3, V3];
      const hoy = sortert.slice(2, 4);
      const naer = (q: V3) => hoy.slice().sort((m1, m2) => Math.hypot(m1[0] - q[0], m1[2] - q[2]) - Math.hypot(m2[0] - q[0], m2[2] - q[2]))[0]!;
      const da = naer(a);
      const db = naer(b);
      const steg = form === 'prisme' ? 0.11 : 0.2;
      for (let t = form === 'prisme' ? 0.12 : 0.2; t < 0.95; t += steg) {
        striper.push([
          [a[0] + t * (da[0] - a[0]), a[1] + t * (da[1] - a[1]), a[2] + t * (da[2] - a[2])],
          [b[0] + t * (db[0] - b[0]), b[1] + t * (db[1] - b[1]), b[2] + t * (db[2] - b[2])],
        ]);
      }
    }
    if (form === 'terning') {
      // Pyrittstriper: på hver flate parallelt med en akse, ulik akse på nabotflatene
      const akse = [0, 1, 2].reduce((m, i) => (Math.abs(n[i]!) > Math.abs(n[m]!) ? i : m), 0);
      const langs = (akse + 1) % 3;
      const tvers = (akse + 2) % 3;
      for (let t = -0.84; t <= 0.85; t += 0.12) {
        const a = [0, 0, 0];
        const b = [0, 0, 0];
        a[akse] = b[akse] = Math.sign(n[akse]!);
        a[tvers] = b[tvers] = t;
        a[langs] = -1;
        b[langs] = 1;
        striper.push([a as unknown as V3, b as unknown as V3]);
      }
    }
    return {
      punkter: ordnet.map(skjerm),
      lys: dot3(nv, L),
      glans: Math.max(0, dot3(nv, Hv)) ** 18,
      synlig: nv[2] > 0.02,
      del: fl.del,
      striper: striper.map(([a, b]) => [skjerm(a), skjerm(b)] as [P, P]),
    };
  });
  const alle = p.v.map(skjerm);
  const xs = alle.map((q) => q[0]);
  const ys = alle.map((q) => q[1]);
  const x0 = Math.min(...xs);
  const x1 = Math.max(...xs);
  const y0 = Math.min(...ys);
  const y1 = Math.max(...ys);
  const s = 1 / Math.max(x1 - x0, y1 - y0, 1e-9);
  const cx = (x0 + x1) / 2;
  const cy = (y0 + y1) / 2;
  const n = (q: P): P => [(q[0] - cx) * s, (q[1] - cy) * s];
  const flater: KrystallFlate[] = raa
    .map((f) => ({ ...f, punkter: f.punkter.map(n), striper: f.striper.map(([a, b]) => [n(a), n(b)] as [P, P]) }))
    .sort((a, b) => Number(a.synlig) - Number(b.synlig));
  return { flater, omriss: konveksInnhylling(alle.map(n)), bredde: (x1 - x0) * s, hoyde: (y1 - y0) * s };
}

/**
 * Inntil `n` punkter spredt jevnt inne i et (konvekst eller konkavt) polygon, med minst `avstand` mellom punktene og
 * fra kanten. Samme frø gir samme punkter, og rekkefølgen er fast, så de første m punktene kan farges om én etter én
 * (morisotoper som blir datterisotoper). Ren funksjon.
 */
export function prikkerIPolygon(polygon: readonly P[], n: number, avstand: number, seed = 1): P[] {
  const m = clamp(Math.floor(fin(n, 0)), 0, 2000);
  if (m === 0 || polygon.length < 3 || !(avstand > 0)) return [];
  const xs = polygon.map((q) => q[0]);
  const ys = polygon.map((q) => q[1]);
  const x0 = Math.min(...xs);
  const x1 = Math.max(...xs);
  const y0 = Math.min(...ys);
  const y1 = Math.max(...ys);
  const tilKant = (x: number, y: number) => {
    let best = Infinity;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      const a = polygon[j]!;
      const b = polygon[i]!;
      const dx = b[0] - a[0];
      const dy = b[1] - a[1];
      const l2 = dx * dx + dy * dy || 1e-12;
      const t = clamp(((x - a[0]) * dx + (y - a[1]) * dy) / l2, 0, 1);
      best = Math.min(best, Math.hypot(x - a[0] - t * dx, y - a[1] - t * dy));
    }
    return best;
  };
  const rnd = seededRandom(Math.floor(fin(seed, 1)) * 48271 + 3);
  const ut: P[] = [];
  let d = avstand;
  for (let runde = 0; runde < 4 && ut.length < m; runde++) {
    for (let forsok = 0; forsok < m * 60 && ut.length < m; forsok++) {
      const x = x0 + rnd() * (x1 - x0);
      const y = y0 + rnd() * (y1 - y0);
      if (!punktIPolygon(x, y, polygon) || tilKant(x, y) < 0.7 * d) continue;
      if (ut.some((q) => Math.hypot(q[0] - x, q[1] - y) < d)) continue;
      ut.push([x, y]);
    }
    d *= 0.8;
  }
  return ut;
}

/* ================================================================================================ Krystall */

/** Isotopprikker i en krystall: hvor mange og hvor stor andel som er datterisotoper. */
export interface KrystallIsotoper {
  /** Antall atomer (prikker), standard 24. */
  n?: number;
  /** Andelen (0–1) som har blitt til datterisotoper. Samme prikker farges om etter hvert, i fast rekkefølge. */
  datter: number;
  seed?: number;
}

/** Props til `Krystall`. */
export interface KrystallProps extends KrystallFormValg {
  /** Midten av krystallen. */
  x: number;
  y: number;
  /** Formen. Standard: formen til mineralet, ellers 'prisme'. */
  form?: Krystallform;
  /** Mineralet gir form, farge og glans fra `MINERALER` (sider og dobbel spiss for zirkon, firkantet tavle for sanidin og gips). */
  mineral?: MineralId;
  /** Fargetone (overstyrer mineralet). */
  tone?: MineralTone;
  /** Glans (overstyrer mineralet): metall gir sterk kontrast og glans, glass gjennomsiktige flater og blanke kanter. */
  glans?: Glans;
  /** Største mål (bredde eller høyde) i figurens enheter, før `useGeoScale`. Standard 70. */
  size?: number;
  /** Ikke gang størrelsen med `useGeoScale`. */
  fastStorrelse?: boolean;
  /** Isotopprikker (morisotop og datterisotop) oppå krystallen; et tall er andelen datter med 24 prikker. */
  isotoper?: number | KrystallIsotoper;
  /** Myk skygge under krystallen (standard av). */
  skygge?: boolean;
  dim?: boolean;
  /** Tekst for skjermlesere (standard mineralnavnet). */
  title?: string;
}

const MINERAL_SIDER: Partial<Record<MineralId, { sider: 4 | 6; dobbel?: boolean; forlengelse?: number }>> = {
  zirkon: { sider: 4, dobbel: true, forlengelse: 1.6 },
  rutil: { sider: 4, dobbel: false, forlengelse: 3.2 },
  topas: { sider: 4, forlengelse: 1.8 },
  sanidin: { sider: 4, forlengelse: 0.35 },
  gips: { sider: 4, forlengelse: 0.25 },
  kloritt: { sider: 6, forlengelse: 0.22 },
  muskovitt: { sider: 6, forlengelse: 0.28 },
  biotitt: { sider: 6, forlengelse: 0.3 },
  molybdenglans: { sider: 6, forlengelse: 0.12 },
  apatitt: { sider: 6, forlengelse: 2.4 },
  hornblende: { sider: 6, forlengelse: 2.6 },
  augitt: { sider: 4, forlengelse: 1.5 },
  korund: { sider: 6, dobbel: true, forlengelse: 1.4 },
  kvarts: { sider: 6, forlengelse: 2.4 },
};

/**
 * Krystall i 3D med lys fra øvre venstre: prisme (kvarts med sekskantet spiss, zirkon firkantet med spiss i begge ender),
 * romboeder (kalkspat), terning (pyritt med striper, halitt, blyglans), oktaeder (magnetitt, flusspat), tavle
 * (glimmer, biotitt, sanidin) og rombedodekaeder (granat). Fargen kommer fra mineralets tone (`mineralFarge`), og glansen
 * styrer lys og skygge: metallglans gir sterk kontrast og et blankt lysfelt, glassglans gjennomsiktige flater der de
 * bakre kantene synes. Valgfrie isotopprikker viser morisotop (`GEO.morIsotop`) og datterisotop (`GEO.datterIsotop`).
 *   <Krystall x={120} y={90} mineral="zirkon" size={80} isotoper={0.5} />
 * Ankerpunkt: (x, y) er midten av krystallen (midt i omrisset). Størrelsen ganges med `useGeoScale`.
 */
export function Krystall(props: KrystallProps) {
  const { x, y, mineral, size = 70, fastStorrelse, isotoper, skygge, dim } = props;
  const k = useGeoScale();
  const ss = useGeoStroke();
  const glansId = useSvgId('krystallglans');
  const perleId = useSvgId('perlemor');
  const m = mineral ? MINERALER[mineral] : undefined;
  const form: Krystallform = props.form ?? m?.krystallform ?? 'prisme';
  const ekstra = mineral ? MINERAL_SIDER[mineral] : undefined;
  const tone = props.tone ?? m?.tone ?? 'fargelos';
  const glans: Glans = props.glans ?? m?.glans[0] ?? (TONER[tone].metall ? 'metall' : 'glass');
  const sider = props.sider ?? ekstra?.sider;
  const dobbel = props.dobbel ?? ekstra?.dobbel;
  const forlengelse = props.forlengelse ?? ekstra?.forlengelse;
  const { dreiing, helning, vipp } = props;
  const g = useMemo(() => krystallGeometri(form, { dreiing, helning, vipp, forlengelse, sider, dobbel }), [form, dreiing, helning, vipp, forlengelse, sider, dobbel]);
  const S = fin(size, 70) * (fastStorrelse ? 1 : k);
  const iso = typeof isotoper === 'number' ? { datter: isotoper } : isotoper;
  const isoN = iso ? clamp(Math.floor(fin(iso.n, 24)), 0, 400) : 0;
  const prikkR = Math.max(2.4 * k, 0.034 * S);
  const prikker = useMemo(() => {
    if (!g || !iso || isoN === 0) return [];
    const omr = g.omriss.map((q): P => [q[0] * S, q[1] * S]);
    return prikkerIPolygon(omr, isoN, 2.9 * prikkR, iso.seed ?? 5);
  }, [g, iso, isoN, S, prikkR]);
  if (!g || !(S > 0) || !Number.isFinite(x) || !Number.isFinite(y)) return null;
  const c = TONER[tone];
  const gjennom = c.gjennomsiktig && glans !== 'metall';
  const kontrast = glans === 'metall' ? 1.6 : glans === 'matt' ? 0.55 : glans === 'diamant' ? 1.1 : 0.9;
  const strek = Math.max(0.9, 1.3 * ss * Math.min(1, S / 60));
  const tilFig = (q: P) => `${r2(x + q[0] * S)} ${r2(y + q[1] * S)}`;
  const sti = (pts: readonly P[]) => `M${pts.map(tilFig).join('L')}Z`;
  const flateFarge = (lys: number) => {
    const t = lys - 0.3;
    // Metall: mørke flater blir mørkere metall (kantfargen), ikke svarte, så fargen (messing, gull) holder seg
    if (glans === 'metall') return t >= 0 ? tint(c.fill, clamp(t * 0.6, 0, 0.4)) : mix(c.fill, c.line, clamp(-t * 0.9, 0, 0.75));
    return t >= 0 ? tint(c.fill, clamp(t * 0.7 * kontrast, 0, 0.65)) : shade(c.fill, clamp(-t * 0.5 * kontrast, 0, 0.7));
  };
  const synlige = g.flater.filter((fl) => fl.synlig);
  const blankest = synlige.reduce<KrystallFlate | null>((b, fl) => (!b || fl.glans > b.glans ? fl : b), null);
  const bunnY = y + (g.hoyde / 2) * S;
  const nDatter = iso ? Math.round(clamp(fin(iso.datter, 0), 0, 1) * prikker.length) : 0;
  const stripeFarge = alpha(glans === 'metall' ? c.line : shade(c.fill, 0.35), glans === 'metall' ? 0.22 : 0.35);
  return (
    <g opacity={dim ? 0.38 : undefined}>
      <title>{props.title ?? (m ? `Krystall av ${m.navn}` : `Krystall (${KRYSTALLFORM_NAVN[form].toLowerCase()})`)}</title>
      {skygge && <ContactShadow cx={x + 0.06 * S} cy={bunnY} rx={0.42 * g.bredde * S} ry={Math.max(3, 0.07 * S)} />}
      <LinearGradient
        id={glansId}
        x1={0}
        y1={0}
        x2={1}
        y2={1}
        stops={[
          [0, SCENE.highlight, 0.95],
          [0.32, SCENE.highlight, 0.2],
          [0.62, SCENE.shadow, 0.05],
          [1, SCENE.shadow, 0.45],
        ]}
      />
      <LinearGradient
        id={perleId}
        x1={0}
        y1={0}
        x2={1}
        y2={0.4}
        stops={[
          [0, SCENE.highlight, 0],
          [0.45, SCENE.highlight, 0.75],
          [0.6, tint(SCENE.glass, 0.4), 0.35],
          [1, SCENE.highlight, 0],
        ]}
      />
      {/* Bakre flater: bare kantene synes gjennom gjennomsiktige krystaller */}
      {gjennom &&
        g.flater
          .filter((fl) => !fl.synlig)
          .map((fl, i) => <path key={`b${i}`} d={sti(fl.punkter)} fill={alpha(shade(c.fill, 0.15), 0.35)} stroke={alpha(c.line, 0.35)} strokeWidth={r2(strek * 0.8)} strokeLinejoin="round" />)}
      {synlige.map((fl, i) => (
        <g key={i}>
          <path d={sti(fl.punkter)} fill={flateFarge(fl.lys)} fillOpacity={gjennom ? 0.78 : 1} />
          {fl.striper.length > 0 && ((form === 'prisme' && (sider ?? 6) === 6) || form === 'tavle' || (form === 'terning' && tone === 'messing')) && (
            <path d={fl.striper.map(([a, b]) => `M${tilFig(lerp(a, b, 0.04))}L${tilFig(lerp(a, b, 0.96))}`).join('')} stroke={stripeFarge} strokeWidth={r2(Math.max(0.5, (form === 'terning' ? 0.55 : 0.8) * ss * Math.min(1, S / 70)))} fill="none" />
          )}
          {glans === 'metall' && <path d={sti(fl.punkter)} fill={`url(#${glansId})`} opacity={r2(clamp(0.35 + 0.5 * Math.max(0, fl.lys) + fl.glans, 0, 0.95))} />}
          {glans === 'perlemor' && fl.del === 'ende' && <path d={sti(fl.punkter)} fill={`url(#${perleId})`} />}
        </g>
      ))}
      {/* Kantene: lyse på gjennomsiktige krystaller, mørke ellers */}
      {synlige.map((fl, i) => (
        <path key={`k${i}`} d={sti(fl.punkter)} fill="none" stroke={gjennom ? mix(c.line, VIZ.surface, 0.25) : c.line} strokeWidth={r2(strek)} strokeLinejoin="round" />
      ))}
      {/* Lysrefleks på den blankeste flaten (glass og diamant) */}
      {blankest && (glans === 'glass' || glans === 'diamant' || glans === 'fett') && blankest.punkter.length >= 3 && (() => {
        const pts = blankest.punkter;
        const cxF = pts.reduce((s, q) => s + q[0], 0) / pts.length;
        const cyF = pts.reduce((s, q) => s + q[1], 0) / pts.length;
        const hj = pts.reduce((b, q) => (q[0] + q[1] < b[0] + b[1] ? q : b), pts[0]!);
        const a = lerp([cxF, cyF], hj, 0.62);
        const b = lerp([cxF, cyF], hj, 0.18);
        return (
          <path
            d={`M${tilFig(a)}L${tilFig(b)}`}
            stroke={alpha(SCENE.highlight, glans === 'fett' ? 0.45 : 0.85)}
            strokeWidth={r2(Math.max(1.5, 0.045 * S))}
            strokeLinecap="round"
            fill="none"
          />
        );
      })()}
      {prikker.map((q, i) => {
        const datter = i < nDatter;
        return (
          <circle
            key={i}
            cx={r2(x + q[0])}
            cy={r2(y + q[1])}
            r={r2(prikkR)}
            fill={datter ? GEO.datterIsotop : GEO.morIsotop}
            stroke={VIZ.surface}
            strokeWidth={r2(Math.max(0.8, 0.9 * ss))}
          />
        );
      })}
    </g>
  );
}

/* ================================================================================================ Steinprove: form */

/** Formen på en steinprøve: kantet (slått løs med hammer) eller rundslipt (rullestein, tromlet). */
export type SteinForm = 'kantet' | 'rundslipt';

/** Én bruddflate på en kantet steinprøve, i figurens koordinater. */
export interface SteinproveFlate {
  punkter: P[];
  /** Lys fra øvre venstre foran: −1 (bort fra lyset) til 1 (rett mot lyset). */
  lys: number;
  /** Hvor mye flaten vender opp (0–1): toppflaten har mest. */
  opp: number;
}

/** Resultatet av `steinproveGeometri`, i figurens koordinater. */
export interface SteinproveGeometri {
  /** Omrisset (silhuetten) som polygon. */
  omriss: P[];
  /** De synlige bruddflatene (kantet), fra den bakerste. Tom for rundslipt. */
  flater: SteinproveFlate[];
  /** Ryggene mellom to synlige bruddflater (der lyset treffer kanten). Tom for rundslipt. */
  kanter: [P, P][];
  /** Midten av flaten som vender mest opp (til en lupe, et prøvemerke eller en etikett). */
  midt: P;
  /** Øverste punkt, og venstre og høyre kant. Bunnen er y. */
  topp: number;
  venstre: number;
  hoyre: number;
  bredde: number;
  hoyde: number;
}

/** Høyde i forhold til bredde for bergarter som flises opp i plater. */
const FLAT: Partial<Record<BergartId, number>> = { takskifer: 0.3, leirskifer: 0.4, fyllitt: 0.42, glimmerskifer: 0.48, kull: 0.5, siltstein: 0.5 };

/** Konveks innhylling i 3D (alle trekanter der de andre punktene ligger på samme side). Bare for få punkter. */
function konveks3d(pts: readonly V3[]): number[][] {
  const flater: number[][] = [];
  const n = pts.length;
  for (let i = 0; i < n; i++)
    for (let j = i + 1; j < n; j++)
      for (let k = j + 1; k < n; k++) {
        const nrm = cross3(sub3(pts[j]!, pts[i]!), sub3(pts[k]!, pts[i]!));
        if (Math.hypot(nrm[0], nrm[1], nrm[2]) < 1e-9) continue;
        let pos = 0;
        let neg = 0;
        for (let m = 0; m < n; m++) {
          if (m === i || m === j || m === k) continue;
          const d = dot3(nrm, sub3(pts[m]!, pts[i]!));
          if (d > 1e-9) pos++;
          else if (d < -1e-9) neg++;
          if (pos && neg) break;
        }
        if (pos && neg) continue;
        flater.push(pos ? [i, k, j] : [i, j, k]);
      }
  return flater;
}

/**
 * Slår sammen nabotrekanter i en konveks innhylling som vender nesten samme vei (under `grense` grader) til større
 * flater, slik en stein som er slått løs har noen få, brede bruddflater og ikke mange små fasetter. Gir hver flate som
 * en lukket løkke av hjørneindekser (mot klokka sett utenfra) med utovervendt normal, og kantene mellom flatene. En
 * trekant vi ser, slås aldri sammen med en vi ikke ser, så de synlige flatene dekker hele silhuetten.
 */
function slaaSammenFlater(pts: readonly V3[], tri: readonly number[][], grense: number, synlig: (n: V3) => boolean): { flater: { lokke: number[]; normal: V3 }[]; kanter: { a: number; b: number; na: V3; nb: V3 }[] } {
  const midt = midt3(pts);
  const T = tri.map((t) => {
    const [a, b, c] = t.map((i) => pts[i]!) as [V3, V3, V3];
    const kr = cross3(sub3(b, a), sub3(c, a));
    const areal = Math.hypot(kr[0], kr[1], kr[2]) / 2;
    let n = norm3(kr);
    let idx = [...t];
    if (dot3(n, sub3(midt3([a, b, c]), midt)) < 0) {
      n = [-n[0], -n[1], -n[2]];
      idx = [t[0]!, t[2]!, t[1]!];
    }
    return { idx, n, areal };
  });
  const forelder = T.map((_, i) => i);
  const sum: V3[] = T.map((t) => [t.n[0] * t.areal, t.n[1] * t.areal, t.n[2] * t.areal]);
  const rot = (i: number): number => (forelder[i] === i ? i : (forelder[i] = rot(forelder[i]!)));
  const kantKey = (a: number, b: number) => (a < b ? `${a}-${b}` : `${b}-${a}`);
  const kantTil = new Map<string, number[]>();
  T.forEach((t, ti) => {
    for (let e = 0; e < 3; e++) {
      const key = kantKey(t.idx[e]!, t.idx[(e + 1) % 3]!);
      const l = kantTil.get(key);
      if (l) l.push(ti);
      else kantTil.set(key, [ti]);
    }
  });
  const par: [number, number, number][] = [];
  for (const l of kantTil.values()) for (let i = 0; i < l.length; i++) for (let j = i + 1; j < l.length; j++) par.push([l[i]!, l[j]!, Math.acos(clamp(dot3(T[l[i]!]!.n, T[l[j]!]!.n), -1, 1))]);
  par.sort((a, b) => a[2] - b[2]);
  const cos = Math.cos(grense * RAD);
  for (const [a, b] of par) {
    if (synlig(T[a]!.n) !== synlig(T[b]!.n)) continue;
    const ra = rot(a);
    const rb = rot(b);
    if (ra === rb) continue;
    if (dot3(norm3(sum[ra]!), norm3(sum[rb]!)) < cos) continue;
    forelder[rb] = ra;
    sum[ra] = [sum[ra]![0] + sum[rb]![0], sum[ra]![1] + sum[rb]![1], sum[ra]![2] + sum[rb]![2]];
  }
  // Løkken rundt hver flate: kantene som bare én trekant i flaten har, kjedet etter retningen
  const grupper = new Map<number, number[]>();
  T.forEach((_, i) => {
    const r = rot(i);
    const g = grupper.get(r);
    if (g) g.push(i);
    else grupper.set(r, [i]);
  });
  const flater: { lokke: number[]; normal: V3 }[] = [];
  for (const [r, ts] of grupper) {
    const teller = new Map<string, number>();
    for (const ti of ts) for (let e = 0; e < 3; e++) {
      const key = kantKey(T[ti]!.idx[e]!, T[ti]!.idx[(e + 1) % 3]!);
      teller.set(key, (teller.get(key) ?? 0) + 1);
    }
    const neste = new Map<number, number>();
    let ok = true;
    for (const ti of ts)
      for (let e = 0; e < 3; e++) {
        const a = T[ti]!.idx[e]!;
        const b = T[ti]!.idx[(e + 1) % 3]!;
        if (teller.get(kantKey(a, b)) !== 1) continue;
        if (neste.has(a)) ok = false;
        neste.set(a, b);
      }
    const start = neste.keys().next().value;
    const lokke: number[] = [];
    if (ok && start !== undefined) {
      let v = start;
      for (let s = 0; s <= neste.size; s++) {
        lokke.push(v);
        const nv = neste.get(v);
        if (nv === undefined) {
          ok = false;
          break;
        }
        v = nv;
        if (v === start) break;
      }
      if (v !== start || lokke.length !== neste.size) ok = false;
    }
    if (ok && lokke.length >= 3) flater.push({ lokke, normal: norm3(sum[r]!) });
    // Ikke en enkel løkke (sjeldent, f.eks. overlappende trekanter i samme plan): hver trekant for seg
    else for (const ti of ts) flater.push({ lokke: T[ti]!.idx, normal: norm3(sum[r]!) });
  }
  // Kantene mellom to flater, med normalene på begge sider
  const kanter: { a: number; b: number; na: V3; nb: V3 }[] = [];
  for (const [key, l] of kantTil) {
    if (l.length !== 2) continue;
    const ra = rot(l[0]!);
    const rb = rot(l[1]!);
    if (ra === rb) continue;
    const [a, b] = key.split('-').map(Number) as [number, number];
    kanter.push({ a, b, na: norm3(sum[ra]!), nb: norm3(sum[rb]!) });
  }
  return { flater, kanter };
}

/**
 * Formen på en steinprøve med bunnen midt på (x, y) og bredden `size`, sett skrått ovenfra med lys fra øvre venstre:
 * kantet er en uregelmessig klump med noen få, brede bruddflater (konveks innhylling av tilfeldige punkter på en
 * flattrykt, kantete kule med flat underside, der nesten like flater er slått sammen), rundslipt er en rullestein med
 * jevnt omriss. Ren funksjon; samme frø gir samme stein.
 */
export function steinproveGeometri(v: { x: number; y: number; size?: number; form?: SteinForm; bergart?: BergartId; seed?: number }): SteinproveGeometri | null {
  const W = fin(v.size, 150);
  if (!(W > 0) || !Number.isFinite(v.x) || !Number.isFinite(v.y)) return null;
  const form = v.form ?? 'kantet';
  const rnd = seededRandom(Math.floor(fin(v.seed, 1)) * 2654435 + 97);
  const flat = (v.bergart && FLAT[v.bergart]) ?? (form === 'kantet' ? 0.5 + 0.15 * rnd() : 0.45 + 0.1 * rnd());
  const dyp = 0.6 + 0.25 * rnd();
  const n = form === 'kantet' ? 11 + Math.floor(rnd() * 3) : 30;
  // Punkter på en «kantete kule» (superellipsoide |x|^p + |y|^p + |z|^p = 1): p = 3 gir en klump med hjørner, p = 2,2
  // en rullestein. Så flattrykt, litt tilfeldig, og med flat underside som steinen ligger stødig på.
  const pe = form === 'kantet' ? 3 : 2.2;
  const pts: V3[] = [];
  const gyllen = Math.PI * (3 - Math.sqrt(5));
  const fase = rnd() * 6;
  const psi = (form === 'kantet' ? 18 + 40 * rnd() : 10 + 30 * rnd()) * RAD;
  for (let i = 0; i < n; i++) {
    const yy = 1 - (2 * (i + 0.5)) / n;
    const rr = Math.sqrt(Math.max(0, 1 - yy * yy));
    const ph = fase + i * gyllen + (rnd() - 0.5) * (form === 'kantet' ? 0.9 : 0.3);
    const d: V3 = [rr * Math.cos(ph), yy, rr * Math.sin(ph)];
    const sup = (Math.abs(d[0]) ** pe + Math.abs(d[1]) ** pe + Math.abs(d[2]) ** pe) ** (-1 / pe);
    const f = sup * (form === 'kantet' ? 0.8 + 0.2 * rnd() : 0.94 + 0.06 * rnd());
    let py = d[1] * f * flat;
    if (py < -0.6 * flat) py = -0.6 * flat;
    pts.push([d[0] * f, py, d[2] * f * dyp]);
  }
  if (form === 'kantet') {
    // Flat underside som steinen hviler stødig på, med en forkant som ligger omtrent vannrett i bildet (vinklene er
    // regnet i bildet, 90° rett mot oss, og dreid tilbake med psi). Ellers kan steinen se ut som den balanserer på et hjørne.
    for (const [i, v] of [50, 130, 225, 315].entries()) {
      const a = (v + (rnd() - 0.5) * (i < 2 ? 10 : 30)) * RAD + psi;
      const rr = 0.74 + 0.08 * rnd();
      pts.push([rr * Math.cos(a), -0.6 * flat, rr * Math.sin(a) * dyp]);
    }
  }
  const phi = 22 * RAD;
  const rot = (a: V3): V3 => {
    const x1 = a[0] * Math.cos(psi) + a[2] * Math.sin(psi);
    const z1 = -a[0] * Math.sin(psi) + a[2] * Math.cos(psi);
    return [x1, a[1] * Math.cos(phi) - z1 * Math.sin(phi), a[1] * Math.sin(phi) + z1 * Math.cos(phi)];
  };
  const proj = pts.map((p): P => {
    const q = rot(p);
    return [q[0], -q[1]];
  });
  const xs = proj.map((q) => q[0]);
  const ys = proj.map((q) => q[1]);
  const x0 = Math.min(...xs);
  const x1 = Math.max(...xs);
  const y1 = Math.max(...ys);
  const sk = W / Math.max(1e-9, x1 - x0);
  const cx = (x0 + x1) / 2;
  const tilFig = (q: P): P => [v.x + (q[0] - cx) * sk, v.y + (q[1] - y1) * sk];
  const hull = konveksInnhylling(proj).map(tilFig);
  let omriss: P[] = hull;
  const flater: SteinproveFlate[] = [];
  const kanter: [P, P][] = [];
  const L = norm3([-0.5, 0.7, 0.5]);
  if (form === 'kantet') {
    // Bruddflatene: nabotrekanter som vender nesten samme vei, blir én flate. Bakerst først, så de fremste dekker.
    const synlig = (nrm: V3) => rot(nrm)[2] > 0.01;
    const s = slaaSammenFlater(pts, konveks3d(pts), 26, synlig);
    const synlige = s.flater
      .map((f) => {
        const nv = rot(f.normal);
        return { f, nv, z: midt3(f.lokke.map((i) => rot(pts[i]!)))[2] };
      })
      .filter(({ nv }) => nv[2] > 0.01)
      .sort((a, b) => a.z - b.z);
    for (const { f, nv } of synlige) flater.push({ punkter: f.lokke.map((i) => tilFig(proj[i]!)), lys: dot3(nv, L), opp: Math.max(0, nv[1]) });
    for (const k of s.kanter) if (synlig(k.na) && synlig(k.nb)) kanter.push([tilFig(proj[k.a]!), tilFig(proj[k.b]!)]);
  } else {
    // Rullestein: avrund hjørnene i silhuetten helt
    const m = hull.length;
    omriss = [];
    for (let i = 0; i < m; i++) {
      const V = hull[i]!;
      const A = lerp(V, hull[(i + m - 1) % m]!, 0.5);
      const B = lerp(V, hull[(i + 1) % m]!, 0.5);
      for (let t = 0; t < 4; t++) {
        const u = t / 4;
        omriss.push([(1 - u) ** 2 * A[0] + 2 * u * (1 - u) * V[0] + u * u * B[0], (1 - u) ** 2 * A[1] + 2 * u * (1 - u) * V[1] + u * u * B[1]]);
      }
    }
    // Avrundingen løfter bunnen litt: senk steinen så den ligger på underlaget igjen
    const loft = v.y - Math.max(...omriss.map((q) => q[1]));
    omriss = omriss.map(([px, py]): P => [px, py + loft]);
  }
  const topp = Math.min(...omriss.map((q) => q[1]));
  const venstre = Math.min(...omriss.map((q) => q[0]));
  const hoyre = Math.max(...omriss.map((q) => q[0]));
  const toppflate = flater.reduce<SteinproveFlate | null>((b, f) => (!b || f.opp > b.opp ? f : b), null);
  const midt: P = toppflate
    ? [toppflate.punkter.reduce((s, q) => s + q[0], 0) / toppflate.punkter.length, toppflate.punkter.reduce((s, q) => s + q[1], 0) / toppflate.punkter.length]
    : [(venstre + hoyre) / 2 - 0.05 * (hoyre - venstre), topp + 0.35 * (v.y - topp)];
  return { omriss, flater, kanter, midt, topp, venstre, hoyre, bredde: hoyre - venstre, hoyde: v.y - topp };
}

/* ================================================================================================ Steinprove: tekstur */

type Fossil = 'skall' | 'ortoceratitt' | 'trilobitt' | 'graptolitt';

/** Et mineral i mosaikken: farge, vekt (hvor vanlig) og om kornene er små og spredte (mørke mineraler som biotitt). */
type Mineralkorn = [farge: string, vekt: number, liten?: boolean];

interface Oppskrift {
  grunn: string;
  /**
   * Mosaikk av korn: størrelse (andel av bredden) og mineralfarger med vekt. `strekk` > 1 gir avlange korn (foliasjon),
   * `flett` hvor ofte nabo-celler av samme mineral blir ett korn (0 = like store korn som i marmor, 0,6 = grove korn).
   */
  mosaikk?: { str: number; farger: Mineralkorn[]; strekk?: number; skimmer?: string; kant?: number; flett?: number };
  /** Fine korn i grunnmassen. */
  prikker?: { farger: string[]; tetthet: number; str: number };
  porfyr?: { form: 'lister' | 'romber' | 'oyne'; farger: string[]; n: number; str: number }[];
  glass?: boolean;
  blaerer?: number;
  klaster?: { rundhet: number; farger: string[]; n: number; str: [number, number] };
  lag?: { n: number; kontrast: number; tynne?: boolean; boelge?: number; helning?: number };
  fossiler?: Fossil[];
  foliasjon?: { n: number; farger: [string, string]; boelge: number; glans?: boolean };
  /** Mørke bånd (gneis). Med `farger` får cellene i mosaikken mørke mineraler inne i båndene; ellers tegnes båndene oppå. */
  band?: { farge: string; n: number; farger?: Mineralkorn[] };
  arer?: { farge: string; n: number };
  granater?: number;
  kull?: boolean;
  glitter?: number;
}

const T = (t: MineralTone) => TONER[t].fill;

function oppskrift(id: BergartId): Oppskrift {
  // Kvarts er gjennomskinnelig og ser røykgrå ut i en bergart; plagioklas er hvit, kalifeltspat rosa
  const kvarts = mix(T('gra'), T('fargelos'), 0.32);
  const feltspat = T('rosa');
  const plag = T('hvit');
  const mork = T('svart');
  const gronnMork = mix(T('svart'), T('gronn'), 0.3);
  const sandFarge = mix(GEO.bergart.sandstein.fill, T('gul'), 0.15);
  switch (id) {
    case 'granitt':
      return { grunn: feltspat, mosaikk: { str: 0.045, farger: [[feltspat, 3.5], [kvarts, 3], [plag, 2], [mork, 2.6, true], [T('solv'), 0.5, true]], flett: 0.5 } };
    case 'kvartsporfyr':
      return {
        grunn: mix(T('rosa'), T('brun'), 0.45),
        prikker: { farger: [shade(T('rosa'), 0.3), tint(T('rosa'), 0.2)], tetthet: 0.5, str: 0.012 },
        porfyr: [
          { form: 'lister', farger: [tint(T('rosa'), 0.25)], n: 10, str: 0.08 },
          { form: 'oyne', farger: [kvarts], n: 9, str: 0.05 },
        ],
      };
    case 'ryolitt':
      return {
        grunn: mix(T('rosa'), T('gra'), 0.45),
        prikker: { farger: [shade(T('rosa'), 0.25), tint(T('gra'), 0.3)], tetthet: 0.6, str: 0.01 },
        porfyr: [{ form: 'lister', farger: [tint(T('rosa'), 0.35)], n: 7, str: 0.05 }],
        lag: { n: 6, kontrast: 0.06, tynne: true, boelge: 0.03 },
      };
    case 'dioritt':
      return { grunn: plag, mosaikk: { str: 0.035, farger: [[plag, 5], [mix(T('svart'), T('gronn'), 0.15), 3.6], [mix(T('hvit'), T('gra'), 0.35), 1.5]], kant: 0.35, flett: 0.35 } };
    case 'porfyritt':
      return {
        grunn: mix(T('gra'), T('gronn'), 0.3),
        prikker: { farger: [shade(T('gra'), 0.3), tint(T('gra'), 0.2)], tetthet: 0.6, str: 0.01 },
        porfyr: [{ form: 'lister', farger: [plag], n: 14, str: 0.07 }],
      };
    case 'andesitt':
      return {
        grunn: mix(T('gra'), T('svart'), 0.3),
        prikker: { farger: [shade(T('gra'), 0.35), tint(T('gra'), 0.15)], tetthet: 0.7, str: 0.01 },
        porfyr: [{ form: 'lister', farger: [plag], n: 9, str: 0.045 }],
      };
    case 'gabbro':
      return { grunn: gronnMork, mosaikk: { str: 0.05, farger: [[mix(T('gra'), T('svart'), 0.35), 4], [gronnMork, 4.5], [mix(T('gra'), T('hvit'), 0.25), 2], [mix(T('gronn'), T('svart'), 0.35), 0.8, true]], kant: 0.4, flett: 0.45 } };
    case 'diabas':
      return {
        grunn: mix(T('svart'), T('gra'), 0.3),
        mosaikk: { str: 0.03, farger: [[mix(T('svart'), T('gra'), 0.2), 4], [gronnMork, 2.5], [mix(T('gra'), T('svart'), 0.1), 2.5]], kant: 0.35, flett: 0.3 },
        porfyr: [{ form: 'lister', farger: [mix(T('hvit'), T('gra'), 0.3)], n: 26, str: 0.035 }],
      };
    case 'basalt':
      return { grunn: mix(T('svart'), T('gra'), 0.35), prikker: { farger: [shade(T('gra'), 0.5), tint(T('svart'), 0.15)], tetthet: 0.8, str: 0.009 }, blaerer: 12 };
    case 'larvikitt':
      return {
        grunn: mix(T('gra'), T('svart'), 0.35),
        mosaikk: { str: 0.07, farger: [[mix(mix(T('gra'), T('svart'), 0.3), PAINTS.blaa, 0.12), 5], [mix(T('gra'), T('svart'), 0.15), 2], [mork, 1, true]], skimmer: mix(PAINTS.blaa, SCENE.skyBottom, 0.3), kant: 0.4, flett: 0.55 },
      };
    case 'rombeporfyr':
      return {
        grunn: mix(T('brun'), T('gra'), 0.45),
        prikker: { farger: [shade(T('brun'), 0.25), tint(T('gra'), 0.15)], tetthet: 0.6, str: 0.01 },
        porfyr: [{ form: 'romber', farger: [mix(T('hvit'), T('rosa'), 0.25), mix(T('hvit'), T('gra'), 0.25)], n: 11, str: 0.13 }],
      };
    case 'anortositt':
      return { grunn: plag, mosaikk: { str: 0.07, farger: [[mix(T('hvit'), T('gra'), 0.2), 6], [mix(T('hvit'), T('gra'), 0.45), 3], [mork, 0.4, true]], kant: 0.4, flett: 0.5 } };
    case 'peridotitt':
      return { grunn: mix(T('gronn'), T('gra'), 0.5), mosaikk: { str: 0.045, farger: [[mix(T('gronn'), T('gra'), 0.45), 6], [mix(mix(T('gronn'), T('gul'), 0.2), T('gra'), 0.3), 2], [gronnMork, 1.4, true], [mork, 0.3, true]], kant: 0.45, flett: 0.35 } };
    case 'obsidian':
      return { grunn: mix(T('svart'), PAINTS.svart, 0.5), glass: true };
    case 'tuff':
      return {
        grunn: mix(T('gra'), T('gul'), 0.18),
        prikker: { farger: [shade(T('gra'), 0.25), tint(T('gra'), 0.35), T('brun')], tetthet: 0.9, str: 0.014 },
        lag: { n: 5, kontrast: 0.08, boelge: 0.02 },
        klaster: { rundhet: 0.1, farger: [mix(T('svart'), T('gra'), 0.4), T('brun')], n: 9, str: [0.02, 0.045] },
      };
    case 'konglomerat':
      return {
        grunn: sandFarge,
        prikker: { farger: [shade(sandFarge, 0.2), tint(sandFarge, 0.25)], tetthet: 0.8, str: 0.009 },
        klaster: { rundhet: 0.85, farger: [T('rosa'), mix(T('hvit'), T('gra'), 0.15), mix(T('gra'), T('svart'), 0.35), mix(T('gronn'), T('svart'), 0.45), T('gra'), mix(T('brun'), T('rosa'), 0.4)], n: 15, str: [0.06, 0.16] },
      };
    case 'breksje':
      return {
        grunn: mix(T('brun'), T('rosa'), 0.4),
        prikker: { farger: [shade(T('brun'), 0.2)], tetthet: 0.5, str: 0.009 },
        klaster: { rundhet: 0.05, farger: [mix(T('gra'), T('hvit'), 0.3), mix(T('gra'), T('svart'), 0.25), mix(T('rosa'), T('hvit'), 0.3)], n: 16, str: [0.05, 0.13] },
      };
    case 'sandstein':
      return { grunn: sandFarge, prikker: { farger: [shade(sandFarge, 0.18), tint(sandFarge, 0.3), shade(sandFarge, 0.32)], tetthet: 1.4, str: 0.0045 }, lag: { n: 5, kontrast: 0.07, boelge: 0.01, helning: 0.04 } };
    case 'siltstein':
      return {
        grunn: mix(GEO.bergart.siltstein.fill, T('gra'), 0.3),
        prikker: { farger: [shade(T('gra'), 0.2), tint(T('gra'), 0.2)], tetthet: 0.9, str: 0.006 },
        lag: { n: 11, kontrast: 0.07, tynne: true, boelge: 0.008 },
      };
    case 'leirskifer':
      return { grunn: mix(T('svart'), T('gra'), 0.3), lag: { n: 16, kontrast: 0.05, tynne: true, boelge: 0.004 }, fossiler: ['graptolitt', 'graptolitt'] };
    case 'salt':
      return { grunn: mix(T('hvit'), T('rosa'), 0.25), mosaikk: { str: 0.07, farger: [[mix(T('hvit'), T('rosa'), 0.3), 4], [mix(T('fargelos'), T('hvit'), 0.4), 3], [T('hvit'), 2]], kant: 0.35, flett: 0.4 } };
    case 'kalkstein':
      return {
        grunn: mix(GEO.bergart.kalkstein.fill, T('gra'), 0.45),
        prikker: { farger: [shade(T('gra'), 0.15), tint(T('gra'), 0.2)], tetthet: 0.5, str: 0.008 },
        lag: { n: 4, kontrast: 0.06, boelge: 0.015 },
        fossiler: ['ortoceratitt', 'skall', 'trilobitt'],
      };
    case 'kull':
      return { grunn: mix(T('svart'), PAINTS.svart, 0.6), kull: true };
    case 'takskifer':
      return { grunn: mix(T('svart'), PAINTS.blaa, 0.12), foliasjon: { n: 22, farger: [tint(T('svart'), 0.12), shade(T('svart'), 0.2)], boelge: 0.004, glans: true } };
    case 'fyllitt':
      return { grunn: mix(T('gra'), T('gronn'), 0.2), foliasjon: { n: 18, farger: [tint(T('gra'), 0.2), shade(T('gra'), 0.2)], boelge: 0.025, glans: true }, glitter: 18 };
    case 'glimmerskifer':
      return {
        grunn: mix(T('solv'), T('brun'), 0.3),
        foliasjon: { n: 30, farger: [tint(T('solv'), 0.3), mix(T('svart'), T('brun'), 0.35)], boelge: 0.03, glans: true },
        granater: 7,
        glitter: 30,
      };
    case 'gneis':
      return {
        grunn: mix(T('rosa'), T('hvit'), 0.4),
        mosaikk: { str: 0.016, farger: [[feltspat, 3], [plag, 3], [kvarts, 2.4]], kant: 0.3, strekk: 3.2, flett: 0.3 },
        band: { farge: mix(T('svart'), T('gra'), 0.15), n: 4, farger: [[mix(T('svart'), T('gra'), 0.12), 4], [gronnMork, 2.2], [plag, 0.15]] },
      };
    case 'kvartsitt':
      return { grunn: mix(T('hvit'), T('rosa'), 0.15), mosaikk: { str: 0.035, farger: [[mix(T('hvit'), T('rosa'), 0.2), 4], [T('hvit'), 3], [mix(kvarts, T('hvit'), 0.5), 2]], kant: 0.22, flett: 0.15 }, glitter: 12 };
    case 'marmor':
      return { grunn: T('hvit'), mosaikk: { str: 0.045, farger: [[T('hvit'), 5], [mix(T('hvit'), T('gra'), 0.18), 2.5], [tint(T('hvit'), 0.4), 2]], kant: 0.2, flett: 0.15 }, arer: { farge: mix(T('gra'), T('svart'), 0.3), n: 3 } };
    case 'amfibolitt':
      return { grunn: gronnMork, mosaikk: { str: 0.035, farger: [[gronnMork, 5], [mork, 2.5], [mix(T('hvit'), T('gra'), 0.3), 1.4, true]], strekk: 2.6, kant: 0.4, flett: 0.3 } };
    case 'eklogitt':
      return { grunn: mix(T('gronn'), T('gra'), 0.25), mosaikk: { str: 0.045, farger: [[mix(T('gronn'), T('gra'), 0.2), 5], [mix(T('gronn'), T('svart'), 0.2), 2]], kant: 0.3, flett: 0.3 }, granater: 26 };
    default:
      return { grunn: T('gra'), prikker: { farger: [shade(T('gra'), 0.3)], tetthet: 0.6, str: 0.01 } };
  }
}

interface Strok {
  d: string;
  fill?: string;
  stroke?: string;
  sw?: number;
  op?: number;
  cap?: 'round';
}

/** Bølget linje over boksen: y(x) = y0 + helning · x + amplitude · sin(...). */
function bolgeY(x: number, y0: number, A: number, lam: number, fase: number, helning: number) {
  return y0 + helning * x + A * Math.sin((2 * Math.PI * x) / lam + fase) + 0.4 * A * Math.sin((2 * Math.PI * x) / (0.47 * lam) + 1.7 * fase);
}

/**
 * De mørke båndene i en gneis som en funksjon (x, y) → om punktet ligger i et mørkt bånd: `n` bølgede bånd med ulik
 * tykkelse som heller litt, så cellene i mosaikken kan farges etter dem (lyse bånd av feltspat og kvarts, mørke av
 * biotitt og hornblende).
 */
function gneisBand(band: { n: number }, b: { x0: number; y0: number; x1: number; y1: number }, W: number, seed: number): (x: number, y: number) => boolean {
  const rnd = seededRandom(seed * 911 + 17);
  const bh = b.y1 - b.y0;
  const n = Math.max(1, Math.round(band.n));
  const baand = Array.from({ length: n }, (_, i) => ({
    yc: b.y0 + ((i + 0.25 + 0.5 * rnd()) / n) * bh,
    t: (0.36 + 0.2 * rnd()) * (bh / n),
    fase: rnd() * 6,
    fase2: rnd() * 6,
  }));
  const A = 0.035 * W;
  return (x, y) =>
    baand.some((bd) => {
      const midt = bolgeY(x - b.x0, bd.yc, A, 0.9 * W, bd.fase, -0.12);
      const halv = 0.5 * bd.t * (0.8 + 0.2 * Math.sin((x - b.x0) / (0.2 * W) + bd.fase2));
      return Math.abs(y - midt) < halv;
    });
}

/** Lager tegnestrøkene for teksturen til en bergart innenfor boksen (figurens koordinater). */
function lagTekstur(o: Oppskrift, b: { x0: number; y0: number; x1: number; y1: number }, W: number, k: number, ss: number, kornFaktor: number, seed: number): Strok[] {
  const ut: Strok[] = [];
  const rnd = seededRandom(seed * 7717 + 31);
  const bw = b.x1 - b.x0;
  const bh = b.y1 - b.y0;
  const kf = Math.max(0.2, kornFaktor);
  // Lag (bånd) i grunnmassen
  if (o.lag) {
    const n = Math.max(2, Math.round(o.lag.n));
    const dh = bh / n;
    const A = (o.lag.boelge ?? 0.01) * W;
    for (let i = 0; i < n; i++) {
      const lys = rnd() > 0.5;
      const fase = rnd() * 6;
      const fase2 = rnd() * 6;
      const ya = b.y0 + i * dh;
      const yb = ya + dh * (o.lag.tynne ? 0.35 + 0.4 * rnd() : 0.5 + 0.4 * rnd());
      const steg = bw / 24;
      let d = '';
      for (let s = 0; s <= 24; s++) {
        const x = b.x0 + s * steg;
        d += `${s ? 'L' : 'M'}${r2(x)} ${r2(bolgeY(x - b.x0, ya, A, 0.8 * W, fase, o.lag.helning ?? 0))}`;
      }
      for (let s = 24; s >= 0; s--) {
        const x = b.x0 + s * steg;
        d += `L${r2(x)} ${r2(bolgeY(x - b.x0, yb, A, 0.8 * W, fase2, o.lag.helning ?? 0))}`;
      }
      ut.push({ d: `${d}Z`, fill: lys ? tint(o.grunn, o.lag.kontrast * 2.2) : shade(o.grunn, o.lag.kontrast * 2), op: 0.9 });
    }
  }
  // Mosaikk av korn: tilfeldige punkter med en minsteavstand gir celler (Voronoi). Nabo-celler av samme mineral slås
  // sammen til større, uregelmessige korn, og bare korngrensene tegnes, så det ser ut som sammenvokste krystaller og
  // ikke som glassmosaikk. Små, mørke mineraler (biotitt) blir aldri slått sammen.
  if (o.mosaikk) {
    const m = o.mosaikk;
    const c = Math.max(3.2 * k, m.str * W * kf * Math.sqrt(k));
    const strekk = m.strekk ?? 1;
    const sw = bw / strekk;
    const maal = Math.min(900, Math.round(((sw * bh) / (c * c)) * 1.05));
    const pts: P[] = [];
    const minD = 0.55 * c;
    for (let t = 0; t < maal * 14 && pts.length < maal; t++) {
      const px = b.x0 + rnd() * sw;
      const py = b.y0 + rnd() * bh;
      if (pts.some((q) => Math.abs(q[0] - px) < minD && Math.abs(q[1] - py) < minD && Math.hypot(q[0] - px, q[1] - py) < minD)) continue;
      pts.push([px, py]);
    }
    const sum = m.farger.reduce((acc, f) => acc + f[1], 0);
    const velg = (u: number, farger: readonly Mineralkorn[], total: number): Mineralkorn => {
      let acc = 0;
      for (const f of farger) {
        acc += f[1] / total;
        if (u <= acc) return f;
      }
      return farger[farger.length - 1]!;
    };
    const mos = voronoiMosaikk(pts, { x0: b.x0, y0: b.y0, x1: b.x0 + sw, y1: b.y1 }, 3 * c);
    const celler = mos.celler.map((cell) => cell.map((q): P => [b.x0 + (q[0] - b.x0) * strekk, q[1]]));
    const arealer = celler.map((cell) => polygonAreal(cell));
    const medianAreal = [...arealer].sort((x, y) => x - y)[Math.floor(arealer.length / 2)] ?? 0;
    const store = m.farger.filter((f) => !f[2]);
    const midter = celler.map((cell): P => (cell.length ? [cell.reduce((acc, q) => acc + q[0], 0) / cell.length, cell.reduce((acc, q) => acc + q[1], 0) / cell.length] : [0, 0]));
    // Mineral per celle. I gneis bestemmer båndene om cellen er lys (feltspat og kvarts) eller mørk (biotitt, hornblende).
    const iMorktBand = o.band ? gneisBand(o.band, b, W, seed) : null;
    const valgt: Mineralkorn[] = celler.map((cell, ci) => {
      if (cell.length < 3) return m.farger[0]!;
      const mork = iMorktBand?.(midter[ci]![0], midter[ci]![1]) ?? false;
      const farger = mork && o.band?.farger ? o.band.farger : m.farger;
      const total = mork && o.band?.farger ? o.band.farger.reduce((acc, f) => acc + f[1], 0) : sum;
      let v = velg(rnd(), farger, total);
      if (v[2] && arealer[ci]! > 0.75 * medianAreal && !mork && store.length) v = store[Math.floor(rnd() * store.length)]!;
      return v;
    });
    // Små, mørke mineraler (biotitt) tegnes som flak inne i cellen, oppå et av de vanlige mineralene
    const grunnFarge = valgt.map((v) => (v[2] && store.length ? store[Math.floor(rnd() * store.length)]![0] : v[0]));
    // Korn: celler av samme mineral slås sammen med sannsynligheten `flett`
    const forelder = celler.map((_, i) => i);
    const rotAv = (i: number): number => (forelder[i] === i ? i : (forelder[i] = rotAv(forelder[i]!)));
    const flett = m.flett ?? 0.45;
    mos.naboer.forEach((nb, i) => {
      nb.forEach((j) => {
        if (j <= i || valgt[i] !== valgt[j] || valgt[i]![2]) return;
        if (rnd() < flett) {
          const ri = rotAv(i);
          const rj = rotAv(j);
          if (ri !== rj) forelder[rj] = ri;
        }
      });
    });
    // Fyll: alle cellene i et korn i én sti (ingen sømmer mellom cellene), med en litt ulik tone per korn
    const korn = new Map<number, { farge: string; celler: number[] }>();
    celler.forEach((cell, ci) => {
      if (cell.length < 3) return;
      const r = rotAv(ci);
      const kk = korn.get(r);
      if (kk) kk.celler.push(ci);
      else {
        const j = (rnd() - 0.5) * 0.16;
        const farge = grunnFarge[r]!;
        korn.set(r, { farge: j > 0 ? tint(farge, j) : shade(farge, -j), celler: [ci] });
      }
    });
    for (const kk of korn.values()) ut.push({ d: kk.celler.map((ci) => poly(celler[ci]!)).join(''), fill: kk.farge });
    // Korngrensene: kanter mellom celler i ulike korn, samlet per mineral
    const grenser = new Map<string, string>();
    celler.forEach((cell, ci) => {
      const nb = mos.naboer[ci] ?? [];
      for (let e = 0; e < cell.length; e++) {
        const j = nb[e] ?? -1;
        if (j < 0 || (j < ci && (celler[j]?.length ?? 0) >= 3) || rotAv(j) === rotAv(ci)) continue;
        const p0 = cell[e]!;
        const p1 = cell[(e + 1) % cell.length]!;
        const farge = grunnFarge[ci]!;
        grenser.set(farge, `${grenser.get(farge) ?? ''}M${r2(p0[0])} ${r2(p0[1])}L${r2(p1[0])} ${r2(p1[1])}`);
      }
    });
    for (const [farge, d] of grenser) ut.push({ d, stroke: alpha(shade(farge, 0.4), m.kant ?? 0.5), sw: 0.7 * ss });
    // Flakene av de små mineralene, litt mindre enn cellen og med en lys kant mot lyset
    celler.forEach((cell, ci) => {
      const v = valgt[ci]!;
      if (!v[2] || cell.length < 3) return;
      const midt = midter[ci]!;
      const flak = cell.map((q) => lerp(midt, q, 0.5 + 0.25 * rnd()));
      ut.push({ d: poly(flak), fill: v[0], stroke: shade(v[0], 0.3), sw: 0.5 * ss });
      const topp = flak.reduce((best, q) => (q[0] + q[1] < best[0] + best[1] ? q : best), flak[0]!);
      const a2 = lerp(midt, topp, 0.75);
      ut.push({ d: `M${r2(a2[0])} ${r2(a2[1])}L${r2(lerp(a2, midt, 0.5)[0])} ${r2(lerp(a2, midt, 0.5)[1])}`, stroke: alpha(SCENE.highlight, 0.5), sw: 0.9 * ss, cap: 'round' });
    });
    // Lys på kornene: glimt langs kanten som vender mot lyset (øvre venstre), og blått skimmer (labradorisering) i larvikitt
    for (const [r, kk] of korn) {
      const v = valgt[r]!;
      const u = rnd();
      // Den største cellen i kornet bærer glimtet
      const ci = kk.celler.reduce((best, x) => (arealer[x]! > arealer[best]! ? x : best), kk.celler[0]!);
      const cell = celler[ci]!;
      const midt = midter[ci]!;
      if (m.skimmer && !v[2] && u < 0.3) {
        ut.push({ d: kk.celler.map((x) => poly(celler[x]!.map((q) => lerp(midter[x]!, q, 0.86)))).join(''), fill: m.skimmer, op: 0.32 });
        ut.push({ d: poly(cell.map((q) => lerp(lerp(midt, cell[0]!, 0.2), q, 0.5))), fill: m.skimmer, op: 0.55 });
      } else if (u < 0.4) {
        let best = -Infinity;
        let kant: [P, P] | null = null;
        for (let i = 0; i < cell.length; i++) {
          const a2 = cell[i]!;
          const b2 = cell[(i + 1) % cell.length]!;
          const mx = (a2[0] + b2[0]) / 2 - midt[0];
          const my = (a2[1] + b2[1]) / 2 - midt[1];
          const score = (-mx - my) / (Math.hypot(mx, my) || 1);
          if (score > best) {
            best = score;
            kant = [a2, b2];
          }
        }
        if (kant) {
          const a2 = lerp(lerp(kant[0], kant[1], 0.18), midt, 0.18);
          const b2 = lerp(lerp(kant[0], kant[1], 0.82), midt, 0.18);
          ut.push({ d: `M${r2(a2[0])} ${r2(a2[1])}L${r2(b2[0])} ${r2(b2[1])}`, stroke: alpha(SCENE.highlight, v[2] ? 0.45 : 0.75), sw: 1.1 * ss, cap: 'round' });
        }
      }
    }
  }
  // Fine korn i grunnmassen
  if (o.prikker) {
    const r = Math.max(0.6 * k, o.prikker.str * W * kf * Math.sqrt(k));
    const n = Math.min(900, Math.round((o.prikker.tetthet * bw * bh) / (r * r * 14)));
    for (let i = 0; i < n; i++) {
      const farge = o.prikker.farger[Math.floor(rnd() * o.prikker.farger.length)]!;
      const x = b.x0 + rnd() * bw;
      const y = b.y0 + rnd() * bh;
      const rr = r * (0.6 + 0.8 * rnd());
      ut.push({ d: `M${r2(x - rr)} ${r2(y)}a${r2(rr)} ${r2(rr)} 0 1 0 ${r2(2 * rr)} 0a${r2(rr)} ${r2(rr)} 0 1 0 ${r2(-2 * rr)} 0`, fill: farge, op: 0.7 });
    }
  }
  // Fragmenter og rullestein
  if (o.klaster) {
    const [smin, smax] = o.klaster.str;
    const grupper = [0, 1, 2].map((i) => ({ n: Math.round(o.klaster!.n / 3), r: (smin + ((smax - smin) * i) / 2) * W * 0.5 * Math.max(1, Math.sqrt(k)) }));
    placeParticles({ x: b.x0, y: b.y0, w: bw, h: bh }, grupper, seed * 3 + 1, 2).forEach((p, i) => {
      const farge = o.klaster!.farger[Math.floor(rnd() * o.klaster!.farger.length)]!;
      const rot = rnd() * 360;
      const d = kornSti(p.x, p.y, p.r, { rundhet: o.klaster!.rundhet, seed: seed * 100 + i, avlang: 0.3 * rnd() }, rot);
      ut.push({ d, fill: farge, stroke: shade(farge, 0.45), sw: 0.9 * ss });
      ut.push({ d: kornSti(p.x + 0.16 * p.r, p.y + 0.18 * p.r, 0.78 * p.r, { rundhet: 1, seed: i + 7 }, 0), fill: alpha(SCENE.shadow, 0.28) });
      ut.push({ d: kornSti(p.x - 0.12 * p.r, p.y - 0.14 * p.r, 0.72 * p.r, { rundhet: 1, seed: i + 7 }, 0), fill: farge });
      ut.push({ d: kornSti(p.x - 0.3 * p.r, p.y - 0.32 * p.r, 0.3 * p.r, { rundhet: 1, seed: i }, 0), fill: alpha(SCENE.highlight, o.klaster!.rundhet > 0.5 ? 0.55 : 0.3) });
    });
  }
  // Store krystaller i fin grunnmasse
  o.porfyr?.forEach((pf, pi) => {
    const L = Math.max(4 * k, pf.str * W * kf * Math.sqrt(k));
    const steder = placeParticles({ x: b.x0, y: b.y0, w: bw, h: bh }, [{ n: pf.n, r: 0.55 * L }], seed * 5 + pi * 17 + 2, 0.2 * L);
    steder.forEach((p) => {
      const farge = pf.farger[Math.floor(rnd() * pf.farger.length)]!;
      const rot = (rnd() - 0.5) * (pf.form === 'romber' ? 40 : 180);
      const c = Math.cos(rot * RAD);
      const s = Math.sin(rot * RAD);
      const til = (u: number, v: number): P => [p.x + u * c - v * s, p.y + u * s + v * c];
      let pts: P[];
      if (pf.form === 'lister') {
        const l = L * (0.6 + 0.6 * rnd());
        const w = l * (0.22 + 0.12 * rnd());
        pts = [til(-l / 2, -w / 2), til(l / 2, -w / 2), til(l / 2, w / 2), til(-l / 2, w / 2)];
      } else if (pf.form === 'romber') {
        const a = L * (0.4 + 0.25 * rnd());
        pts = [til(-a, 0), til(0, -0.62 * a), til(a, 0), til(0, 0.62 * a)];
      } else {
        const a = 0.5 * L * (0.7 + 0.5 * rnd());
        ut.push({ d: `M${r2(p.x - a)} ${r2(p.y)}a${r2(a)} ${r2(0.85 * a)} 0 1 0 ${r2(2 * a)} 0a${r2(a)} ${r2(0.85 * a)} 0 1 0 ${r2(-2 * a)} 0`, fill: farge, stroke: shade(farge, 0.35), sw: 0.7 * ss });
        ut.push({ d: `M${r2(p.x - 0.45 * a)} ${r2(p.y - 0.3 * a)}l${r2(0.4 * a)} ${r2(-0.15 * a)}`, stroke: alpha(SCENE.highlight, 0.85), sw: 1 * ss, cap: 'round' });
        return;
      }
      ut.push({ d: poly(pts), fill: farge, stroke: shade(farge, 0.4), sw: 0.8 * ss });
      if (pf.form === 'romber') {
        const midt: P = [p.x, p.y];
        ut.push({ d: poly(pts.map((q) => lerp(midt, q, 0.55))), stroke: alpha(shade(farge, 0.3), 0.6), sw: 0.6 * ss });
      } else {
        ut.push({ d: `M${poly([lerp(pts[0]!, pts[3]!, 0.5), lerp(pts[1]!, pts[2]!, 0.5)], false).slice(1)}`, stroke: alpha(shade(farge, 0.25), 0.55), sw: 0.6 * ss });
      }
    });
  });
  // Foliasjon: tette, bølgede striper
  if (o.foliasjon) {
    const n = Math.max(4, Math.round(o.foliasjon.n / Math.sqrt(k)));
    const dh = bh / n;
    const A = o.foliasjon.boelge * W;
    for (let i = 0; i <= n; i++) {
      const y0 = b.y0 + i * dh + (rnd() - 0.5) * 0.3 * dh;
      const fase = rnd() * 6;
      let d = '';
      for (let s = 0; s <= 30; s++) {
        const x = b.x0 + (s / 30) * bw;
        d += `${s ? 'L' : 'M'}${r2(x)} ${r2(bolgeY(x - b.x0, y0, A, 0.55 * W, fase + i * 0.3, -0.06))}`;
      }
      ut.push({ d, stroke: o.foliasjon.farger[i % 2]!, sw: (0.25 + 0.35 * rnd()) * dh, op: 0.7 });
    }
  }
  // Bånd tegnet oppå (når båndet ikke er bygd av mørke korn i mosaikken)
  if (o.band && !(o.band.farger && o.mosaikk)) {
    const n = o.band.n;
    for (let i = 0; i < n; i++) {
      const yc = b.y0 + ((i + 0.3 + 0.4 * rnd()) / n) * bh;
      const t1 = (0.08 + 0.1 * rnd()) * bh;
      const fase = rnd() * 6;
      const A = 0.06 * W;
      let d = '';
      for (let s = 0; s <= 30; s++) {
        const x = b.x0 + (s / 30) * bw;
        d += `${s ? 'L' : 'M'}${r2(x)} ${r2(bolgeY(x - b.x0, yc - t1 / 2, A, 0.9 * W, fase, -0.1))}`;
      }
      for (let s = 30; s >= 0; s--) {
        const x = b.x0 + (s / 30) * bw;
        const tykk = t1 * (0.6 + 0.4 * Math.sin(s * 0.5 + fase));
        d += `L${r2(x)} ${r2(bolgeY(x - b.x0, yc - t1 / 2, A, 0.9 * W, fase, -0.1) + tykk)}`;
      }
      ut.push({ d: `${d}Z`, fill: o.band.farge, stroke: shade(o.band.farge, 0.3), sw: 0.6 * ss });
    }
  }
  // Årer i marmor
  if (o.arer) {
    for (let i = 0; i < o.arer.n; i++) {
      let x = b.x0 + rnd() * bw;
      let y = b.y0;
      let d = `M${r2(x)} ${r2(y)}`;
      const retning = (rnd() - 0.5) * 0.9;
      while (y < b.y1) {
        y += (0.06 + 0.05 * rnd()) * bh;
        x += (retning + (rnd() - 0.5) * 0.6) * 0.1 * bw;
        d += `L${r2(x)} ${r2(y)}`;
      }
      ut.push({ d, stroke: alpha(o.arer.farge, 0.55), sw: (0.8 + 1.4 * rnd()) * ss });
      ut.push({ d, stroke: alpha(o.arer.farge, 0.15), sw: (5 + 4 * rnd()) * ss });
    }
  }
  // Glass: skjellformet (muslig) brudd med lyse og mørke ringer
  if (o.glass) {
    const cx = b.x0 + 0.18 * bw;
    const cy = b.y0 + 0.35 * bh;
    for (let i = 1; i <= 7; i++) {
      const rr = (i / 7) * 0.95 * bw;
      const a0 = -0.9;
      const a1 = 1.1;
      const bue = (r: number) => `M${r2(cx + r * Math.cos(a0))} ${r2(cy + r * Math.sin(a0) * 0.75)}A${r2(r)} ${r2(0.75 * r)} 0 0 1 ${r2(cx + r * Math.cos(a1))} ${r2(cy + r * Math.sin(a1) * 0.75)}`;
      ut.push({ d: bue(rr), stroke: alpha(SCENE.highlight, 0.32), sw: 1.2 * ss });
      ut.push({ d: bue(rr + 2.2 * ss), stroke: alpha(SCENE.shadow, 0.5), sw: 1.4 * ss });
    }
  }
  // Blærer (gasshull) i basalt: mørke hull med lys nedre kant
  if (o.blaerer) {
    const r = Math.max(2.2 * k, 0.03 * W * Math.sqrt(k));
    placeParticles({ x: b.x0, y: b.y0, w: bw, h: bh }, [{ n: o.blaerer, r }], seed * 11 + 4, 0.6 * r).forEach((p) => {
      const rx = p.r * (0.6 + 0.5 * ((p.phase * 7) % 1));
      const ry = rx * 0.7;
      ut.push({ d: `M${r2(p.x - rx)} ${r2(p.y)}a${r2(rx)} ${r2(ry)} 0 1 0 ${r2(2 * rx)} 0a${r2(rx)} ${r2(ry)} 0 1 0 ${r2(-2 * rx)} 0`, fill: shade(o.grunn, 0.6), stroke: shade(o.grunn, 0.7), sw: 0.6 * ss });
      ut.push({ d: `M${r2(p.x + rx * 0.85)} ${r2(p.y + ry * 0.2)}A${r2(rx * 0.92)} ${r2(ry * 0.88)} 0 0 1 ${r2(p.x - rx * 0.3)} ${r2(p.y + ry * 0.85)}`, stroke: tint(o.grunn, 0.35), sw: 1.1 * ss, cap: 'round' });
    });
  }
  // Kull: blanke og matte bånd og sprekker på tvers
  if (o.kull) {
    const n = 7;
    for (let i = 0; i < n; i++) {
      const y = b.y0 + ((i + rnd()) / n) * bh;
      const h = (0.03 + 0.05 * rnd()) * bh;
      ut.push({ d: `M${r2(b.x0)} ${r2(y)}H${r2(b.x1)}v${r2(h)}H${r2(b.x0)}Z`, fill: tint(o.grunn, 0.12 + 0.1 * rnd()), op: 0.9 });
      ut.push({ d: `M${r2(b.x0)} ${r2(y + 0.3 * h)}H${r2(b.x1)}`, stroke: alpha(SCENE.highlight, 0.4), sw: 0.8 * ss });
    }
    for (let i = 0; i < 9; i++) {
      const x = b.x0 + ((i + rnd()) / 9) * bw;
      ut.push({ d: `M${r2(x)} ${r2(b.y0)}l${r2(0.02 * bw)} ${r2(bh)}`, stroke: alpha(SCENE.shadow, 0.6), sw: 1 * ss });
    }
  }
  // Fossiler
  o.fossiler?.forEach((fo, i) => {
    const px = b.x0 + (0.22 + 0.56 * ((i + 0.3 + 0.4 * rnd()) / Math.max(1, o.fossiler!.length))) * bw;
    const py = b.y0 + (0.3 + 0.35 * rnd()) * bh;
    const s = 0.16 * W * Math.max(1, Math.sqrt(k) * 0.9);
    const lys = tint(o.grunn, 0.3);
    const mork = shade(o.grunn, 0.4);
    const rot = (rnd() - 0.5) * 50;
    const c = Math.cos(rot * RAD);
    const sn = Math.sin(rot * RAD);
    const til = (u: number, v: number): string => `${r2(px + u * c - v * sn)} ${r2(py + u * sn + v * c)}`;
    if (fo === 'skall') {
      // Armfoting: vifteformet skall med ribber
      let d = `M${til(-0.5 * s, 0)}`;
      for (let a = 180; a >= 0; a -= 10) d += `L${til(0.5 * s * Math.cos(a * RAD), -0.55 * s * Math.sin(a * RAD))}`;
      ut.push({ d: `${d}Z`, fill: lys, stroke: mork, sw: 1 * ss });
      let ribber = '';
      for (let a = 20; a <= 160; a += 14) ribber += `M${til(0, -0.02 * s)}L${til(0.47 * s * Math.cos(a * RAD), -0.52 * s * Math.sin(a * RAD))}`;
      ut.push({ d: ribber, stroke: alpha(mork, 0.7), sw: 0.8 * ss });
    } else if (fo === 'ortoceratitt') {
      // Rettskallet blekksprut: lang kjegle med skillevegger
      const l = 1.4 * s;
      const w0 = 0.2 * s;
      const w1 = 0.06 * s;
      ut.push({ d: `M${til(-l / 2, -w0 / 2)}L${til(l / 2, -w1 / 2)}Q${til(l / 2 + w1, 0)} ${til(l / 2, w1 / 2)}L${til(-l / 2, w0 / 2)}Z`, fill: lys, stroke: mork, sw: 1 * ss });
      let skille = '';
      for (let t = 0.08; t < 0.95; t += 0.09) {
        const u = -l / 2 + t * l;
        const w = w0 + (w1 - w0) * t;
        skille += `M${til(u, -w / 2)}Q${til(u + 0.25 * w, 0)} ${til(u, w / 2)}`;
      }
      ut.push({ d: skille, stroke: alpha(mork, 0.7), sw: 0.8 * ss, op: 1 });
    } else if (fo === 'trilobitt') {
      // Trilobitt: hodeskjold, ledd og haleskjold, med tre lober på langs
      const l = 0.9 * s;
      const w = 0.6 * s;
      let d = `M${til(-0.5 * w, -0.25 * l)}`;
      d += `Q${til(-0.55 * w, -0.55 * l)} ${til(0, -0.55 * l)}Q${til(0.55 * w, -0.55 * l)} ${til(0.5 * w, -0.25 * l)}`;
      d += `L${til(0.38 * w, 0.3 * l)}Q${til(0.2 * w, 0.5 * l)} ${til(0, 0.5 * l)}Q${til(-0.2 * w, 0.5 * l)} ${til(-0.38 * w, 0.3 * l)}Z`;
      ut.push({ d, fill: lys, stroke: mork, sw: 1 * ss });
      let ledd = `M${til(-0.17 * w, -0.5 * l)}L${til(-0.12 * w, 0.42 * l)}M${til(0.17 * w, -0.5 * l)}L${til(0.12 * w, 0.42 * l)}`;
      for (let t = -0.2; t < 0.35; t += 0.08) {
        const ww = 0.5 * w - 0.12 * w * ((t + 0.25) / 0.6);
        ledd += `M${til(-ww, t * l)}L${til(ww, t * l)}`;
      }
      ut.push({ d: ledd, stroke: alpha(mork, 0.75), sw: 0.75 * ss });
    } else {
      // Graptolitt: tynn gren med små tenner, lys på mørk skifer
      const l = 1.3 * s;
      let d = '';
      const tenner = 14;
      for (let t = 0; t <= tenner; t++) {
        const u = -l / 2 + (t / tenner) * l;
        const v = 0.04 * s * Math.sin(t * 0.4);
        d += `${t ? 'L' : 'M'}${til(u, v)}`;
        if (t < tenner) d += `L${til(u + 0.25 * (l / tenner), v - 0.06 * s)}L${til(u + 0.5 * (l / tenner), v)}`;
      }
      ut.push({ d, stroke: tint(o.grunn, 0.55), sw: 1.2 * ss, cap: 'round' });
    }
  });
  // Granater: små rødbrune korn med en lys fasett
  if (o.granater) {
    const r = Math.max(2.4 * k, 0.026 * W * Math.sqrt(k));
    placeParticles({ x: b.x0, y: b.y0, w: bw, h: bh }, [{ n: o.granater, r }], seed * 13 + 6, 0.8 * r).forEach((p) => {
      const pts: P[] = Array.from({ length: 6 }, (_, i) => [p.x + p.r * Math.cos((i * 60 + 15) * RAD), p.y + p.r * Math.sin((i * 60 + 15) * RAD)] as P);
      ut.push({ d: poly(pts), fill: T('rod'), stroke: shade(T('rod'), 0.5), sw: 0.8 * ss });
      ut.push({ d: poly([pts[3]!, pts[4]!, [p.x, p.y]]), fill: alpha(SCENE.highlight, 0.55) });
    });
  }
  // Glitter: små glimmerflak som blinker
  if (o.glitter) {
    const r = Math.max(1.4 * k, 0.012 * W);
    for (let i = 0; i < o.glitter; i++) {
      const x = b.x0 + rnd() * bw;
      const y = b.y0 + rnd() * bh;
      ut.push({ d: `M${r2(x - r)} ${r2(y + 0.3 * r)}l${r2(2 * r)} ${r2(-0.6 * r)}`, stroke: tint(T('solv'), 0.6), sw: 0.9 * r, cap: 'round', op: 0.9 });
    }
  }
  return ut;
}

/* ================================================================================================ Steinprove */

/** Props til `Steinprove`. */
export interface SteinproveProps {
  /** Midt under prøven, der den ligger på underlaget. */
  x: number;
  y: number;
  /** Bergarten: farge og tekstur (kornstørrelse, porfyr, glass, blærer, lag, fossiler, foliasjon, bånd). */
  bergart: BergartId;
  /** Bredden i figurens enheter (standard 150). Prøven vokser ikke på mobil, men kornene i den gjør det. */
  size?: number;
  /** Kantet (slått løs med hammer, standard) eller rundslipt (rullestein). */
  form?: SteinForm;
  /** Ganger kornstørrelsen (mosaikk, grunnmasse, porfyr), f.eks. 0,4 for et finere korn. Standard 1. */
  kornstorrelse?: number;
  /** Vis eller skjul fossilavtrykk (standard etter bergarten). */
  fossiler?: boolean;
  /** Vis eller skjul blærer (standard etter bergarten). */
  blaerer?: boolean;
  /** Vis eller skjul lag (standard etter bergarten). */
  lag?: boolean;
  /** Frø til formen og teksturen (standard 1). */
  seed?: number;
  /** Myk skygge under prøven (standard på). */
  skygge?: boolean;
  /** Speilvend. */
  flip?: boolean;
  dim?: boolean;
  /** Tekst for skjermlesere (standard «Håndstykke av granitt»). */
  title?: string;
}

/**
 * Håndstykke av en bergart sett skrått ovenfra, med teksturen til bergarten: grove, sammenvokste krystaller (granitt,
 * gabbro, larvikitt med blått skimmer), fin grunnmasse med store krystaller (porfyr, rombeporfyr med romber), glass med
 * skjellformet brudd (obsidian), blærer (basalt), rullestein i sand (konglomerat), lag og fossiler (kalkstein med
 * ortoceratitt, leirskifer med graptolitter), foliasjon med glimmerglans og granater (glimmerskifer) og lyse og mørke
 * bånd (gneis). Kantet har bruddflater med lys toppflate og mørkere forside; rundslipt er en blank rullestein.
 *   <Steinprove x={200} y={240} bergart="rombeporfyr" size={160} />
 * Ankerpunkt: (x, y) er midt under prøven, på underlaget. Bruk `steinproveGeometri` for midten av toppflaten.
 */
export function Steinprove({ x, y, bergart, size = 150, form = 'kantet', kornstorrelse = 1, fossiler, blaerer, lag, seed = 1, skygge = true, flip, dim, title }: SteinproveProps) {
  const k = useGeoScale();
  const ss = useGeoStroke();
  const clipId = useSvgId('steinprove');
  const lysId = useSvgId('steinlys');
  const kantlysId = useSvgId('steinkantlys');
  const forId = useSvgId('steinforside');
  const g = useMemo(() => steinproveGeometri({ x: 0, y: 0, size, form, bergart, seed }), [size, form, bergart, seed]);
  const o = useMemo(() => {
    const op = oppskrift(bergart);
    if (fossiler === false) delete op.fossiler;
    if (fossiler === true && !op.fossiler) op.fossiler = ['skall', 'skall'];
    if (blaerer === false) delete op.blaerer;
    if (blaerer === true && !op.blaerer) op.blaerer = 12;
    if (lag === false) delete op.lag;
    if (lag === true && !op.lag) op.lag = { n: 6, kontrast: 0.07, boelge: 0.01 };
    return op;
  }, [bergart, fossiler, blaerer, lag]);
  const strok = useMemo(() => {
    if (!g) return [];
    const marg = 4;
    return lagTekstur(o, { x0: g.venstre - marg, y0: g.topp - marg, x1: g.hoyre + marg, y1: marg }, fin(size, 150), k, ss, fin(kornstorrelse, 1), Math.floor(fin(seed, 1)));
  }, [g, o, size, k, ss, kornstorrelse, seed]);
  if (!g || !Number.isFinite(x) || !Number.isFinite(y)) return null;
  const navn = BERGARTER[bergart]?.navn ?? bergart;
  const rund = form === 'rundslipt';
  const kant = shade(o.grunn, 0.55);
  // Skyggen på steinen er en mørk utgave av steinfargen (SCENE.shadow er for svak i lyst tema til å gi form)
  const formSkygge = shade(o.grunn, 0.7);
  return (
    <g opacity={dim ? 0.38 : undefined} transform={`translate(${r2(x)} ${r2(y)})${flip ? ' scale(-1 1)' : ''}`}>
      <title>{title ?? `Håndstykke av ${navn}`}</title>
      {skygge && <ContactShadow cx={0.04 * g.bredde} cy={0} rx={0.5 * g.bredde} ry={Math.max(3, 0.06 * g.bredde)} />}
      <defs>
        <clipPath id={clipId}>
          <path d={poly(g.omriss)} />
        </clipPath>
      </defs>
      <RadialGradient
        id={lysId}
        cx={0.42}
        cy={0.38}
        r={rund ? 0.62 : 0.72}
        fx={0.3}
        fy={0.22}
        stops={
          rund
            ? [
                [0, SCENE.highlight, 0.6],
                [0.35, SCENE.highlight, 0],
                [0.58, formSkygge, 0],
                [0.82, formSkygge, 0.28],
                [1, formSkygge, 0.55],
              ]
            : [
                [0, SCENE.highlight, 0.25],
                [0.45, SCENE.highlight, 0],
                [0.75, formSkygge, 0],
                [1, formSkygge, 0.18],
              ]
        }
      />
      <LinearGradient
        id={forId}
        stops={[
          [0, formSkygge, 0],
          [0.7, formSkygge, 0],
          [1, formSkygge, rund ? 0.25 : 0.3],
        ]}
      />
      <LinearGradient
        id={kantlysId}
        x1={0}
        y1={0}
        x2={1}
        y2={1}
        stops={[
          [0, SCENE.highlight, 0.9],
          [0.45, SCENE.highlight, 0.25],
          [0.6, SCENE.highlight, 0],
        ]}
      />
      <g clipPath={`url(#${clipId})`}>
        <path d={poly(g.omriss)} fill={o.grunn} />
        {strok.map((s, i) => (
          <path key={i} d={s.d} fill={s.fill ?? 'none'} stroke={s.stroke} strokeWidth={s.sw !== undefined ? r2(s.sw) : undefined} opacity={s.op} strokeLinecap={s.cap} strokeLinejoin="round" />
        ))}
        {o.foliasjon?.glans && <path d={poly(g.omriss)} fill={alpha(SCENE.highlight, 0.12)} />}
        {/* Bruddflatene: lyse mot lyset (toppen), nøytrale mot oss og mørke bort fra lyset */}
        {g.flater.map((fl, i) => {
          const t = fl.lys - 0.5;
          const fyll = t >= 0 ? alpha(SCENE.highlight, Math.min(0.62, 1.4 * t)) : alpha(formSkygge, Math.min(0.5, 0.62 * -t));
          return <path key={i} d={poly(fl.punkter)} fill={fyll} />;
        })}
        {/* Ryggene mellom flatene fanger lyset */}
        {g.kanter.length > 0 && (
          <path
            d={g.kanter.map(([a, b2]) => `M${r2(a[0])} ${r2(a[1])}L${r2(b2[0])} ${r2(b2[1])}`).join('')}
            fill="none"
            stroke={alpha(SCENE.highlight, 0.38)}
            strokeWidth={r2(1.1 * ss)}
            strokeLinecap="round"
          />
        )}
        <path d={poly(g.omriss)} fill={`url(#${lysId})`} />
        <path d={poly(g.omriss)} fill={`url(#${forId})`} />
        {rund && (
          <ellipse
            cx={r2(g.venstre + 0.3 * g.bredde)}
            cy={r2(g.topp + 0.2 * g.hoyde)}
            rx={r2(0.13 * g.bredde)}
            ry={r2(0.06 * g.hoyde + 2)}
            transform={`rotate(-12 ${r2(g.venstre + 0.3 * g.bredde)} ${r2(g.topp + 0.2 * g.hoyde)})`}
            fill={alpha(SCENE.highlight, 0.6)}
          />
        )}
        {/* Kantlys øverst til venstre, så også mørke steiner (obsidian, kull) har en kant mot en mørk bakgrunn */}
        <path d={poly(g.omriss)} fill="none" stroke={`url(#${kantlysId})`} strokeWidth={r2(2.6 * ss)} strokeLinejoin="round" />
      </g>
      <path d={poly(g.omriss)} fill="none" stroke={kant} strokeWidth={r2(1.4 * ss)} strokeLinejoin="round" />
    </g>
  );
}

/* ================================================================================================ Lupe */

/**
 * De to ytre tangentene mellom en liten sirkel (stedet som forstørres) og en stor (lupen): [[punkt på liten, punkt på
 * stor], …], til strekene fra stedet ut til lupen. Null når den ene sirkelen ligger inni den andre. Ren funksjon.
 */
export function lupeKjegle(fra: { x: number; y: number; r: number }, lupe: { x: number; y: number; r: number }): [[P, P], [P, P]] | null {
  const dx = lupe.x - fra.x;
  const dy = lupe.y - fra.y;
  const d = Math.hypot(dx, dy);
  if (![d, fra.r, lupe.r].every(Number.isFinite) || d <= Math.abs(lupe.r - fra.r) + 1e-6) return null;
  const th = Math.atan2(dy, dx);
  const ps = Math.acos(clamp((fra.r - lupe.r) / d, -1, 1));
  const linje = (a: number): [P, P] => [
    [fra.x + fra.r * Math.cos(a), fra.y + fra.r * Math.sin(a)],
    [lupe.x + lupe.r * Math.cos(a), lupe.y + lupe.r * Math.sin(a)],
  ];
  return [linje(th + ps), linje(th - ps)];
}

/** Props til `Lupe`. */
export interface LupeProps {
  /** Midten og radiusen til lupen (linsa). */
  x: number;
  y: number;
  r: number;
  /**
   * Stedet som forstørres: en liten ring med streker ut til lupen. `r` er radiusen til ringen (standard 12, og med
   * `forstorr` lupas radius delt på faktoren, så ringen viser nøyaktig det som er i lupa).
   */
  fra?: { x: number; y: number; r?: number };
  /**
   * 'lupe': forstørrelsesglass med ramme og håndtak. 'boble': tynn ring, som et utsnitt i en lærebok. Standard 'boble'
   * når `fra` er gitt, ellers 'lupe'.
   */
  stil?: 'lupe' | 'boble';
  /** Retningen til håndtaket i grader (0 = mot høyre, 90 = rett ned). Standard 45. `null` gir lupe uten håndtak. */
  handtak?: number | null;
  /** Fargen bak innholdet (standard `VIZ.surface`). */
  bakgrunn?: string;
  /** Kort tekst over lupen, f.eks. «Forstørret 20 ganger». */
  tekst?: string;
  /** Målestokk nederst i linsa i linsas koordinater: `{ lengde, tekst }`. */
  malestokk?: { lengde: number; tekst: string };
  /**
   * Forstørrer figuren under lupa i stedet for å vise noe annet: children tegnes da i figurens koordinater, og punktet
   * (x, y) havner midt i linsa, `faktor` ganger større. Standardpunktet er midten av `fra`, ellers midten av lupa (lupa
   * holdes rett over tingen). Gi samme elementer som utenfor lupa:
   *   <Lupe x={520} y={150} r={80} forstorr={{ faktor: 2.5 }}>{stein}</Lupe>
   */
  forstorr?: { faktor: number; x?: number; y?: number };
  /**
   * Innholdet i linsa, tegnet med (0, 0) midt i linsa og klippet til en sirkel med radius r. En funksjon får
   * `{ r, k }` (k = useGeoScale), f.eks. `{({ r }) => <Kornpakning x={0} y={0} r={r} ramme={false} />}`. Med `forstorr`
   * tegnes innholdet i figurens koordinater, og `r` er radiusen til området som vises (r / faktor).
   */
  children?: ReactNode | ((l: { r: number; k: number }) => ReactNode);
  dim?: boolean;
}

/**
 * Lupe som forstørrer et utsnitt: innholdet (children) tegnes i linsa, klippet til sirkelen, med glassrefleks og en
 * mørkere kant. Med `fra` viser en ring og to streker hvor utsnittet er hentet fra (som i lærebøker). Stilen 'lupe'
 * har ramme og håndtak, 'boble' bare en tynn ring. Innholdet er enten noe nytt i linsas koordinater (korn og porer i en
 * steinprøve, leirpartikler i kvikkleire) eller, med `forstorr`, den samme figuren forstørret (krystallene i granitt).
 *   <Lupe x={560} y={130} r={100} fra={{ x: 240, y: 200, r: 14 }}>{({ r }) => <Kornpakning x={0} y={0} r={r} ramme={false} />}</Lupe>
 *   <Lupe x={300} y={150} r={70} handtak={130} forstorr={{ faktor: 2.5 }}>{stein}</Lupe>   // rett over steinen
 * Ankerpunkt: (x, y) er midten av linsa.
 */
export function Lupe({ x, y, r, fra, stil, handtak = 45, bakgrunn, tekst, malestokk, forstorr, children, dim }: LupeProps) {
  const k = useGeoScale();
  const ss = useGeoStroke();
  const f = useTextScale();
  const clipId = useSvgId('lupe');
  const glassId = useSvgId('lupeglass');
  const rammeId = useSvgId('luperamme');
  const skaftId = useSvgId('lupeskaft');
  if (![x, y, r].every(Number.isFinite) || !(r > 4)) return null;
  const type = stil ?? (fra ? 'boble' : 'lupe');
  const faktor = forstorr && Number.isFinite(forstorr.faktor) && forstorr.faktor > 0 ? forstorr.faktor : null;
  const fr = fra ? Math.max(3, fin(fra.r, faktor ? r / faktor : 12)) : 0;
  const kjegle = fra && Number.isFinite(fra.x) && Number.isFinite(fra.y) ? lupeKjegle({ x: fra.x, y: fra.y, r: fr }, { x, y, r }) : null;
  const linjefarge = alpha(VIZ.ink, 0.5);
  const rw = type === 'lupe' ? Math.max(6, 0.09 * r) : 0;
  const fx = fin(forstorr?.x, fin(fra?.x, x));
  const fy = fin(forstorr?.y, fin(fra?.y, y));
  const innhold = typeof children === 'function' ? children({ r: faktor ? r / faktor : r, k }) : children;
  const innholdTransform = faktor ? `translate(${r2(x)} ${r2(y)}) scale(${r2(faktor)}) translate(${r2(-fx)} ${r2(-fy)})` : `translate(${r2(x)} ${r2(y)})`;
  const hv = handtak === null ? null : fin(handtak, 45) * RAD;
  // Håndtaket: hylse og skaft langs retningen hv, fra utsiden av rammen
  const handtakSti = (() => {
    if (type !== 'lupe' || hv === null) return null;
    const ux = Math.cos(hv);
    const uy = Math.sin(hv);
    const vx = -uy;
    const vy = ux;
    const r0 = r + rw * 0.5;
    const hl = 0.22 * r;
    const sl = 0.95 * r;
    const bw = 0.11 * r;
    const sw = 0.13 * r;
    const p = (s: number, t: number) => `${r2(x + ux * s + vx * t)} ${r2(y + uy * s + vy * t)}`;
    return {
      hylse: `M${p(r0 - 2, -bw)}L${p(r0 + hl, -bw * 0.85)}L${p(r0 + hl, bw * 0.85)}L${p(r0 - 2, bw)}Z`,
      skaft: `M${p(r0 + hl, -sw * 0.9)}L${p(r0 + hl + sl, -sw)}Q${p(r0 + hl + sl + sw * 1.1, 0)} ${p(r0 + hl + sl, sw)}L${p(r0 + hl, sw * 0.9)}Z`,
      glans: `M${p(r0 + hl + 0.1 * sl, -sw * 0.45)}L${p(r0 + hl + 0.9 * sl, -sw * 0.5)}`,
    };
  })();
  return (
    <g opacity={dim ? 0.38 : undefined}>
      <defs>
        <clipPath id={clipId}>
          <circle cx={r2(x)} cy={r2(y)} r={r2(r)} />
        </clipPath>
      </defs>
      <RadialGradient
        id={glassId}
        stops={[
          [0, SCENE.shadow, 0],
          [0.78, SCENE.shadow, 0],
          [1, SCENE.shadow, 0.45],
        ]}
      />
      <LinearGradient
        id={rammeId}
        x1={0}
        y1={0}
        x2={1}
        y2={1}
        stops={[
          [0, tint(SCENE.metal, 0.35)],
          [0.5, SCENE.metal],
          [1, shade(SCENE.metalDark, 0.2)],
        ]}
      />
      <LinearGradient
        id={skaftId}
        x1={0}
        y1={0}
        x2={1}
        y2={1}
        stops={[
          [0, tint(PAINTS.svart, 0.25)],
          [1, shade(PAINTS.svart, 0.2)],
        ]}
      />
      {/* Strekene fra stedet som forstørres */}
      {kjegle && fra && (
        <g>
          <path d={poly([kjegle[0][0], kjegle[0][1], kjegle[1][1], kjegle[1][0]])} fill={alpha(VIZ.ink, 0.05)} />
          {kjegle.map(([a, b], i) => (
            <path key={i} d={`M${r2(a[0])} ${r2(a[1])}L${r2(b[0])} ${r2(b[1])}`} stroke={linjefarge} strokeWidth={r2(1.4 * ss)} fill="none" />
          ))}
          <circle cx={r2(fra.x)} cy={r2(fra.y)} r={r2(fr)} fill="none" stroke={VIZ.surface} strokeWidth={r2(4.5 * ss)} opacity={0.8} />
          <circle cx={r2(fra.x)} cy={r2(fra.y)} r={r2(fr)} fill="none" stroke={VIZ.ink} strokeWidth={r2(2 * ss)} />
        </g>
      )}
      {handtakSti && (
        <g>
          <ContactShadow cx={x + Math.cos(hv!) * r * 1.6} cy={y + Math.sin(hv!) * r * 1.6 + 6} rx={0.25 * r} opacity={0.4} />
          <path d={handtakSti.skaft} fill={`url(#${skaftId})`} stroke={SCENE.outline} strokeWidth={r2(1.2 * ss)} strokeLinejoin="round" />
          <path d={handtakSti.glans} stroke={alpha(SCENE.highlight, 0.6)} strokeWidth={r2(Math.max(1.5, 0.03 * r))} strokeLinecap="round" fill="none" />
          <path d={handtakSti.hylse} fill={`url(#${rammeId})`} stroke={SCENE.outline} strokeWidth={r2(1.1 * ss)} strokeLinejoin="round" />
        </g>
      )}
      <circle cx={r2(x)} cy={r2(y)} r={r2(r)} fill={bakgrunn ?? VIZ.surface} />
      <g clipPath={`url(#${clipId})`}>
        <g transform={innholdTransform}>{innhold}</g>
        <circle cx={r2(x)} cy={r2(y)} r={r2(r)} fill={`url(#${glassId})`} />
        {/* Glassrefleks øverst til venstre */}
        <path
          d={`M${r2(x + 0.84 * r * Math.cos(200 * RAD))} ${r2(y + 0.84 * r * Math.sin(200 * RAD))}A${r2(0.84 * r)} ${r2(0.84 * r)} 0 0 1 ${r2(x + 0.84 * r * Math.cos(265 * RAD))} ${r2(y + 0.84 * r * Math.sin(265 * RAD))}A${r2(0.72 * r)} ${r2(0.72 * r)} 0 0 0 ${r2(x + 0.84 * r * Math.cos(200 * RAD))} ${r2(y + 0.84 * r * Math.sin(200 * RAD))}Z`}
          fill={alpha(SCENE.highlight, 0.55)}
        />
      </g>
      {malestokk && malestokk.lengde > 0 && <Malestokk x={x} y={y + r - (14 + rw * 0.3) * f} lengde={malestokk.lengde} tekst={malestokk.tekst} />}
      {type === 'lupe' ? (
        <g>
          <circle cx={r2(x)} cy={r2(y)} r={r2(r + rw / 2)} fill="none" stroke={`url(#${rammeId})`} strokeWidth={r2(rw)} />
          <circle cx={r2(x)} cy={r2(y)} r={r2(r + rw)} fill="none" stroke={SCENE.outline} strokeWidth={r2(1.2 * ss)} />
          <circle cx={r2(x)} cy={r2(y)} r={r2(r)} fill="none" stroke={SCENE.outline} strokeWidth={r2(1 * ss)} />
        </g>
      ) : (
        <g>
          <circle cx={r2(x)} cy={r2(y)} r={r2(r)} fill="none" stroke={VIZ.surface} strokeWidth={r2(5 * ss)} opacity={0.8} />
          <circle cx={r2(x)} cy={r2(y)} r={r2(r)} fill="none" stroke={VIZ.ink} strokeWidth={r2(2 * ss)} />
        </g>
      )}
      {tekst && (
        <Txt x={x} y={y - r - rw - 10} size={0.85} weight={600}>
          {tekst}
        </Txt>
      )}
    </g>
  );
}
