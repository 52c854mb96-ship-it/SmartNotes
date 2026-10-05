/**
 * Pakking av atomkjerner for Atomkjerne i rom.tsx (internt, eksporteres ikke fra scene-kit-et).
 *
 * Kjernen er A kuler med radius 1 som ligger tett som druer i en klase. Den dreies tilfeldig (med frø), sees forfra,
 * og bare kulene som kan synes, tas med. Protonene deles ut lagvis, så hvert område av kjernen har omtrent Z/A
 * protoner (ingen klynger). Alt er rene tall uten React, så det kan testes.
 */
import { sceneRandom } from './core';

/** Avstand mellom sentrene til to nukleoner som ligger inntil hverandre (radius 1, litt overlapp = tett pakket). */
export const NUCLEON_SPACING = 1.9;

export type Vec3 = [number, number, number];

export interface PackedNucleon {
  x: number;
  y: number;
  /** Mot betrakteren (større z = nærmere). */
  z: number;
  proton: boolean;
  /** 0 = belyst, 1 = halvskygge, 2 = skygge (etter hvor på kula nukleonet sitter). */
  light: 0 | 1 | 2;
  /** Midten er synlig (ingen foran dekker den), så tegnet kan stå der. */
  front: boolean;
}

export interface PackedNucleus {
  /** Nukleonene som kan synes, bakerst først (tegnes i denne rekkefølgen). */
  list: PackedNucleon[];
  /** Største avstand fra midten til et nukleonsentrum. */
  core: number;
  /** Radius til hele kjernen (ytterkanten av de ytterste nukleonene). */
  radius: number;
  /** Antall nukleoner i kjernen (også de som ikke tegnes). */
  A: number;
}

/** Radius (til sentrene) for A kuler pakket med fyllingsgrad ca. 0,6: nesten alle sentrene ligger innenfor. */
export function packedRadius(A: number, d = NUCLEON_SPACING): number {
  return (d / 2) * Math.cbrt(A / 0.6);
}

/**
 * Tilfeldig tett kulepakking: A punkter spredt i en kule, så skjøvet fra hverandre (ingen overlapper mer enn litt) og
 * trukket inn mot midten, til de ligger tett som druer i en klase. Uregelmessig, men alltid rund: til slutt trekkes
 * avvikere inn til kuleflaten, så ingen kuler stikker ut av omrisset.
 */
export function relaxedPacking(A: number, d: number, rnd: () => number): Vec3[] {
  const R0 = (d / 2) * Math.cbrt(A / 0.5);
  const xs = new Float64Array(A);
  const ys = new Float64Array(A);
  const zs = new Float64Array(A);
  for (let i = 0; i < A; i++) {
    let x = 0;
    let y = 0;
    let z = 0;
    do {
      x = rnd() * 2 - 1;
      y = rnd() * 2 - 1;
      z = rnd() * 2 - 1;
    } while (x * x + y * y + z * z > 1);
    xs[i] = x * R0;
    ys[i] = y * R0;
    zs[i] = z * R0;
  }
  const d2 = d * d;
  const iters = A > 150 ? 40 : 50;
  for (let it = 0; it < iters; it++) {
    // Trekk inn mot midten: sterkt først, svakt mot slutten (så overlappene rekker å løses uten at noen driver ut).
    const pull = it < iters - 12 ? 0.965 : 0.992;
    for (let i = 0; i < A; i++) {
      xs[i] = xs[i]! * pull;
      ys[i] = ys[i]! * pull;
      zs[i] = zs[i]! * pull;
    }
    for (let i = 0; i < A; i++) {
      for (let j = i + 1; j < A; j++) {
        const dx = xs[j]! - xs[i]!;
        const dy = ys[j]! - ys[i]!;
        const dz = zs[j]! - zs[i]!;
        const q = dx * dx + dy * dy + dz * dz;
        if (q >= d2) continue;
        const dist = Math.sqrt(q) || 1e-3;
        const push = ((d - dist) / dist) * 0.5;
        xs[i] = xs[i]! - dx * push;
        ys[i] = ys[i]! - dy * push;
        zs[i] = zs[i]! - dz * push;
        xs[j] = xs[j]! + dx * push;
        ys[j] = ys[j]! + dy * push;
        zs[j] = zs[j]! + dz * push;
      }
    }
  }
  // Midtstill, og trekk avvikerne inn til kuleflaten (90-persentilen av avstandene, litt utenfor).
  let mx = 0;
  let my = 0;
  let mz = 0;
  for (let i = 0; i < A; i++) {
    mx += xs[i]!;
    my += ys[i]!;
    mz += zs[i]!;
  }
  mx /= A;
  my /= A;
  mz /= A;
  const dist = new Float64Array(A);
  for (let i = 0; i < A; i++) {
    xs[i] = xs[i]! - mx;
    ys[i] = ys[i]! - my;
    zs[i] = zs[i]! - mz;
    dist[i] = Math.hypot(xs[i]!, ys[i]!, zs[i]!);
  }
  const sorted = Array.from(dist).sort((a, b) => a - b);
  const limit = sorted[Math.floor((A - 1) * 0.9)]! + d * 0.12;
  for (let i = 0; i < A; i++) {
    const m = dist[i]!;
    if (m > limit) {
      const k = limit / m;
      xs[i] = xs[i]! * k;
      ys[i] = ys[i]! * k;
      zs[i] = zs[i]! * k;
    }
  }
  return Array.from({ length: A }, (_, i): Vec3 => [xs[i]!, ys[i]!, zs[i]!]);
}

/** Faste, lettleste former for de minste kjernene (alle nukleonene synes). Rekkefølgen = hvor protonene settes først. */
function smallNucleus(A: number, d: number): { pts: Vec3[]; protonOrder: number[] } {
  if (A === 1) return { pts: [[0, 0, 0]], protonOrder: [0] };
  if (A === 2)
    return {
      pts: [
        [-d * 0.48, 0.08, 0.3],
        [d * 0.48, -0.08, -0.3],
      ],
      protonOrder: [0, 1],
    };
  if (A === 3)
    return {
      pts: [
        [0, -d * 0.55, -0.25],
        [-d / 2, d * 0.3, 0.2],
        [d / 2, d * 0.26, 0.05],
      ],
      protonOrder: [2, 0, 1],
    };
  // Firflate med kantlengde d sett langs aksen mellom to motsatte kanter: en rombe av fire nukleoner. Protonene
  // på skrå (ett foran og ett bak), så begge synes og ingen like ligger inntil hverandre foran.
  const t = d / (2 * Math.SQRT2);
  return {
    pts: [
      [-d / 2, 0, t],
      [d / 2, 0, t],
      [0, -d / 2, -t],
      [0, d / 2, -t],
    ],
    protonOrder: [1, 2, 0, 3],
  };
}

/**
 * Hvilke nukleoner som er protoner: posisjonene ordnes langs en slangelinje over kjernen sett forfra (vannrette bånd
 * på én nukleonbredde, annenhver vei), med litt tilfeldig uro fra frøet. Så deles protonene ut systematisk langs
 * linja (hvert A/Z-te), så alle områder får omtrent Z/A protoner og det blir nøyaktig Z til sammen.
 */
function assignProtons(pts: readonly Vec3[], Z: number, d: number, rnd: () => number): boolean[] {
  const A = pts.length;
  const kinds = new Array<boolean>(A).fill(false);
  if (Z <= 0) return kinds;
  if (Z >= A) return kinds.fill(true);
  const band = d * 1.05;
  const keys = pts.map((q, i) => {
    const row = Math.floor(q[1] / band + 100);
    const along = row % 2 === 0 ? q[0] : -q[0];
    // Uro på ca. en halv plass langs linja (frøet), så mønsteret ikke blir rutete.
    return { i, key: row * 1000 + along / d + (rnd() - 0.5) * 1.1 };
  });
  keys.sort((a, b) => a.key - b.key);
  const step = Z / A;
  let acc = rnd();
  for (const { i } of keys) {
    const next = acc + step;
    if (Math.floor(next) > Math.floor(acc)) kinds[i] = true;
    acc = next;
  }
  return kinds;
}

/** Retningen lyset kommer fra (øvre venstre, litt forfra), normalisert. */
const LIGHT: Vec3 = (() => {
  const v: Vec3 = [-0.5, -0.6, 0.62];
  const n = Math.hypot(...v);
  return [v[0] / n, v[1] / n, v[2] / n];
})();

/**
 * Tett pakket kjerne med Z protoner og N nøytroner (A ≤ 4: faste former, ellers relaxedPacking), dreid tilfeldig (med
 * frø) og sett forfra. Radien blir ∝ A^(1/3). Bare nukleonene som kan synes, tas med (for store kjerner er det ca.
 * ytterste lag), bakerst først.
 */
export function packNucleus(Z: number, N: number, seed: number): PackedNucleus {
  const A = Z + N;
  if (!(A > 0)) return { list: [], core: 0, radius: 0, A: 0 };
  const rnd = sceneRandom(seed * 1013 + A * 31 + Z * 7);
  const d = NUCLEON_SPACING;
  let rot: Vec3[];
  let kinds: boolean[];
  if (A <= 4) {
    const s = smallNucleus(A, d);
    const [al, be, ga] = [0.18, 0.32, 0.1];
    rot = s.pts.map((p) => rotate(p, al, be, ga));
    kinds = new Array<boolean>(A).fill(false);
    for (let k = 0; k < Math.min(Z, A); k++) kinds[s.protonOrder[k]!] = true;
  } else {
    const pts = relaxedPacking(A, d, rnd);
    const [al, be, ga] = [rnd() * Math.PI * 2, Math.acos(2 * rnd() - 1), rnd() * Math.PI * 2];
    rot = pts.map((p) => rotate(p, al, be, ga));
    kinds = assignProtons(rot, Z, d, rnd);
  }
  // Midtstill (dreiningen flytter ikke midtpunktet, men de små formene er ikke midtstilt).
  let mx = 0;
  let my = 0;
  let mz = 0;
  for (const q of rot) {
    mx += q[0];
    my += q[1];
    mz += q[2];
  }
  mx /= A;
  my /= A;
  mz /= A;
  let core = 0;
  for (const q of rot) {
    q[0] -= mx;
    q[1] -= my;
    q[2] -= mz;
    core = Math.max(core, Math.hypot(q[0], q[1], q[2]));
  }
  const list: PackedNucleon[] = [];
  rot.forEach((q, i) => {
    const m = Math.hypot(q[0], q[1], q[2]);
    // Bare de som kan synes: ytterste lag og litt til (de inne i kjernen dekkes helt av laget foran).
    const zf = Math.sqrt(Math.max(0, core * core - q[0] * q[0] - q[1] * q[1]));
    if (A > 30 && q[2] < zf - 3.4) return;
    const dotL = m < 0.3 ? 1 : (q[0] * LIGHT[0] + q[1] * LIGHT[1] + q[2] * LIGHT[2]) / m;
    const light = m > core * 0.55 ? (dotL > 0.3 ? 0 : dotL > -0.25 ? 1 : 2) : dotL > -0.1 ? 0 : 1;
    list.push({ x: q[0], y: q[1], z: q[2], proton: kinds[i]!, light, front: true });
  });
  list.sort((u, v) => u.z - v.z);
  // Tegnet (+) bare der ingen nukleon foran dekker midten av kula (sentrum nærmere enn 1 + tegnets halve lengde).
  for (let i = 0; i < list.length; i++) {
    const p = list[i]!;
    for (let j = i + 1; j < list.length; j++) {
      const o = list[j]!;
      if (o.z > p.z && (o.x - p.x) ** 2 + (o.y - p.y) ** 2 < 1.46 * 1.46) {
        p.front = false;
        break;
      }
    }
  }
  return { list, core, radius: core + 1, A };
}

function rotate([px, py, pz]: Vec3, al: number, be: number, ga: number): Vec3 {
  const [ca, sa, cb, sb, cg, sg] = [Math.cos(al), Math.sin(al), Math.cos(be), Math.sin(be), Math.cos(ga), Math.sin(ga)];
  const x1 = ca * px - sa * py;
  const y1 = sa * px + ca * py;
  const y2 = cb * y1 - sb * pz;
  const z2 = sb * y1 + cb * pz;
  return [cg * x1 - sg * y2, sg * x1 + cg * y2, z2];
}
