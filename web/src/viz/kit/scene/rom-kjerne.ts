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
  const limit = sorted[Math.floor((A - 1) * 0.9)]! + d * 0.05;
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
 * Deler ut `count` protoner blant nukleonene `group`: de ordnes langs en slangelinje over kjernen sett forfra
 * (vannrette bånd på én nukleonbredde, annenhver vei) med litt uro fra frøet, og så får hvert (A/Z)-te et proton.
 * Da får alle områder omtrent like stor andel protoner, uten klynger og uten et rutete mønster.
 */
function spreadProtons(group: readonly PackedNucleon[], count: number, rnd: () => number): void {
  const n = group.length;
  if (n === 0) return;
  const k = Math.max(0, Math.min(n, count));
  const band = NUCLEON_SPACING * 1.05;
  const keys = group.map((q) => {
    const row = Math.floor(q.y / band + 100);
    const along = row % 2 === 0 ? q.x : -q.x;
    return { q, key: row * 1000 + along / NUCLEON_SPACING + (rnd() - 0.5) * 1.1 };
  });
  keys.sort((a, b) => a.key - b.key);
  const step = k / n;
  let acc = rnd() * Math.min(1, step || 1);
  for (const { q } of keys) {
    const next = acc + step;
    q.proton = Math.floor(next + 1e-9) > Math.floor(acc + 1e-9);
    acc = next;
  }
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
  let small: number[] | null = null;
  if (A <= 4) {
    const s = smallNucleus(A, d);
    rot = s.pts.map((p) => rotate(p, 0.18, 0.32, 0.1));
    small = s.protonOrder;
  } else {
    const pts = relaxedPacking(A, d, rnd);
    const [al, be, ga] = [rnd() * Math.PI * 2, Math.acos(2 * rnd() - 1), rnd() * Math.PI * 2];
    rot = pts.map((p) => rotate(p, al, be, ga));
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
  const all: PackedNucleon[] = rot.map((q) => {
    const m = Math.hypot(q[0], q[1], q[2]);
    const dotL = m < 0.3 ? 1 : (q[0] * LIGHT[0] + q[1] * LIGHT[1] + q[2] * LIGHT[2]) / m;
    const light = m > core * 0.55 ? (dotL > 0.3 ? 0 : dotL > -0.25 ? 1 : 2) : dotL > -0.1 ? 0 : 1;
    return { x: q[0], y: q[1], z: q[2], proton: false, light, front: true };
  });
  // Bare de som kan synes: ytterste lag og litt til (de inne i kjernen dekkes helt av laget foran). Dybden måles fra
  // kuleflaten foran (`core` er robust, for avvikerne er trukket inn).
  const list = all.filter((q) => A <= CULL_FROM || q.z >= Math.sqrt(Math.max(0, core * core - q.x * q.x - q.y * q.y)) - CULL_DEPTH);
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
  if (small) {
    for (let k = 0; k < Math.min(Z, A); k++) all[small[k]!]!.proton = true;
  } else {
    // Protonene fordeles lagvis: like stor andel blant de fremste (der tegnet synes), blant resten av dem som tegnes,
    // og blant dem inne i kjernen. Til sammen nøyaktig Z.
    const share = Z / A;
    const front = list.filter((q) => q.front);
    const behind = list.filter((q) => !q.front);
    const hidden = all.filter((q) => !list.includes(q));
    let qF = Math.round(front.length * share);
    let qB = Math.round(behind.length * share);
    let qH = Z - qF - qB;
    if (qH > hidden.length) {
      qB = Math.min(behind.length, qB + qH - hidden.length);
      qH = hidden.length;
      qF = Math.min(front.length, Z - qB - qH);
    } else if (qH < 0) {
      qB = Math.max(0, qB + qH);
      qH = 0;
      qF = Math.max(0, Z - qB);
    }
    spreadProtons(front, qF, rnd);
    spreadProtons(behind, qB, rnd);
    spreadProtons(hidden, qH, rnd);
  }
  return { list, core, radius: core + 1, A };
}

/** Kjerner med flere nukleoner enn dette tegnes bare med de ytterste lagene. */
const CULL_FROM = 60;
/** Hvor dypt under kuleflaten foran (i nukleonradier) nukleonene fortsatt tegnes. */
const CULL_DEPTH = 2.9;

function rotate([px, py, pz]: Vec3, al: number, be: number, ga: number): Vec3 {
  const [ca, sa, cb, sb, cg, sg] = [Math.cos(al), Math.sin(al), Math.cos(be), Math.sin(be), Math.cos(ga), Math.sin(ga)];
  const x1 = ca * px - sa * py;
  const y1 = sa * px + ca * py;
  const y2 = cb * y1 - sb * pz;
  const z2 = sb * y1 + cb * pz;
  return [cg * x1 - sg * y2, sg * x1 + cg * y2, z2];
}
