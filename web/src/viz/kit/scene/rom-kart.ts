/**
 * Kart og projeksjon for planetene i rom.tsx (internt, eksporteres ikke fra scene-kit-et).
 *
 * Overflaten er grove omriss i lengde- og breddegrad (grader, øst og nord positive), projisert ortografisk på en
 * enhetskule sett fra breddegrad `lat0` med lengdegrad `lon0` midt på. Fylte flater som går bak kanten, legges langs
 * kanten (horisonten), så de klippes riktig uten clipPath per flate. Linjer (skyer, kløfter) brytes bak kanten.
 * Omrissene er forenklet til ca. 2–4 grader: nok til at kontinentene kjennes igjen, men lite nok til 60 bilder/s.
 */

const D2R = Math.PI / 180;

/** Flat liste [lon, lat, lon, lat, …] i grader. */
export type Ring = readonly number[];

/** Legger inn punkter så ingen kant er lengre enn `step` grader (riktig kant mot horisonten). */
function densify(ring: Ring, step: number, closed: boolean): number[] {
  const out: number[] = [];
  const n = ring.length / 2;
  const segs = closed ? n : n - 1;
  for (let i = 0; i < segs; i++) {
    const j = (i + 1) % n;
    const a0 = ring[2 * i]!;
    const b0 = ring[2 * i + 1]!;
    const a1 = ring[2 * j]!;
    const b1 = ring[2 * j + 1]!;
    // Langs polen (lat ±90) er alle punktene det samme punktet: ingen ekstra punkter der.
    const atPole = Math.abs(b0) >= 90 && Math.abs(b1) >= 90;
    const k = atPole ? 1 : Math.max(1, Math.ceil(Math.max(Math.abs(a1 - a0), Math.abs(b1 - b0)) / step));
    for (let s = 0; s < k; s++) out.push(a0 + ((a1 - a0) * s) / k, b0 + ((b1 - b0) * s) / k);
  }
  if (!closed && n > 0) out.push(ring[2 * (n - 1)]!, ring[2 * (n - 1) + 1]!);
  return out;
}

/** Ringene med ekstra punkter (regnes ut én gang per liste). */
const dense = new WeakMap<readonly Ring[], number[][]>();
function densified(rings: readonly Ring[], closed: boolean): number[][] {
  let d = dense.get(rings);
  if (!d) {
    d = rings.map((r) => densify(r, 3, closed));
    dense.set(rings, d);
  }
  return d;
}

const n3 = (v: number) => Math.round(v * 1000) / 1000;

/**
 * Fylte flater på kula som SVG-sti i enhetskoordinater (radius 1, y nedover). Flater som ligger helt bak kula,
 * tas ikke med.
 */
export function projectFill(rings: readonly Ring[], lon0: number, lat0: number): string {
  const s0 = Math.sin(lat0 * D2R);
  const c0 = Math.cos(lat0 * D2R);
  let d = '';
  for (const ring of densified(rings, true)) {
    let front = false;
    let part = '';
    for (let i = 0; i < ring.length; i += 2) {
      const lam = (ring[i]! - lon0) * D2R;
      const phi = ring[i + 1]! * D2R;
      const cp = Math.cos(phi);
      const sp = Math.sin(phi);
      const cl = Math.cos(lam);
      let px = cp * Math.sin(lam);
      let py = -(c0 * sp - s0 * cp * cl);
      const z = s0 * sp + c0 * cp * cl;
      if (z > 0) front = true;
      else {
        const m = Math.hypot(px, py) || 1;
        px /= m;
        py /= m;
      }
      part += `${i === 0 ? 'M' : ' '}${n3(px)} ${n3(py)}`;
    }
    if (front) d += `${part}Z`;
  }
  return d;
}

/** Linjer på kula (åpne, f.eks. skybånd og kløfter) som SVG-sti i enhetskoordinater. Delene bak kula utelates. */
export function projectLines(lines: readonly Ring[], lon0: number, lat0: number): string {
  const s0 = Math.sin(lat0 * D2R);
  const c0 = Math.cos(lat0 * D2R);
  let d = '';
  for (const line of densified(lines, false)) {
    let pen = false;
    for (let i = 0; i < line.length; i += 2) {
      const lam = (line[i]! - lon0) * D2R;
      const phi = line[i + 1]! * D2R;
      const cp = Math.cos(phi);
      const sp = Math.sin(phi);
      const cl = Math.cos(lam);
      const z = s0 * sp + c0 * cp * cl;
      if (z < 0.03) {
        pen = false;
        continue;
      }
      d += `${pen ? ' ' : 'M'}${n3(cp * Math.sin(lam))} ${n3(-(c0 * sp - s0 * cp * cl))}`;
      pen = true;
    }
  }
  return d;
}

/** Om punktet (lon, lat) er på forsiden, og hvor på skiva det havner: [x, y, z] (z > 0 = synlig). */
export function projectPoint(lon: number, lat: number, lon0: number, lat0: number): [number, number, number] {
  const s0 = Math.sin(lat0 * D2R);
  const c0 = Math.cos(lat0 * D2R);
  const lam = (lon - lon0) * D2R;
  const phi = lat * D2R;
  const cp = Math.cos(phi);
  const sp = Math.sin(phi);
  const cl = Math.cos(lam);
  return [cp * Math.sin(lam), -(c0 * sp - s0 * cp * cl), s0 * sp + c0 * cp * cl];
}

/** Sirkel (eller ellipse) på kula rundt (lon, lat) med halvakser a og b i grader. `wobble` gir ujevn kant. */
export function sphereEllipse(lon: number, lat: number, a: number, b: number, n = 14, rotDeg = 0, wobble = 0, seed = 1): number[] {
  const out: number[] = [];
  const cr = Math.cos(rotDeg * D2R);
  const sr = Math.sin(rotDeg * D2R);
  const cl = Math.max(0.2, Math.cos(lat * D2R));
  for (let i = 0; i < n; i++) {
    const t = (2 * Math.PI * i) / n;
    // Fast, glatt ujevnhet fra frøet (ingen tilfeldige tall i render).
    const w = 1 + wobble * (0.6 * Math.sin(3 * t + seed) + 0.4 * Math.sin(5 * t + seed * 2.3));
    const u = a * Math.cos(t) * w;
    const v = b * Math.sin(t) * w;
    out.push(lon + (u * cr - v * sr) / cl, lat + (u * sr + v * cr));
  }
  return out;
}

/** Linje langs en breddegrad fra lon1 til lon2 med svak bølge (skybånd). */
function latBand(lon1: number, lon2: number, lat: number, amp: number, waves: number): number[] {
  const out: number[] = [];
  const n = Math.max(2, Math.ceil(Math.abs(lon2 - lon1) / 4));
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    out.push(lon1 + (lon2 - lon1) * t, lat + amp * Math.sin(t * Math.PI * waves));
  }
  return out;
}

/** Ring rundt en pol: breddegrad `lat` med litt variasjon, lukket over polen. */
function polarCap(lat: number, amp: number, seed: number): number[] {
  const out: number[] = [];
  for (let lon = -180; lon <= 180; lon += 10) out.push(lon, lat + amp * Math.sin((lon * D2R) * 3 + seed) * Math.cos((lon * D2R) * 2));
  const pole = lat > 0 ? 90 : -90;
  out.push(180, pole, -180, pole);
  return out;
}

/* ---------- Jorda ---------- */

const AFRICA = [
  -5.8, 35.8, -2, 35.1, 3, 36.8, 10.2, 37.2, 10.5, 34.2, 11.3, 33.2, 15.2, 32.3, 19.5, 30.3, 20, 32, 23, 32.6, 25.2, 31.6, 29.9, 31.2,
  32.3, 31.3, 32.5, 29.9, 33.6, 27.3, 35.6, 23.9, 37.2, 19.6, 38.6, 17.5, 39.5, 15.6, 41.7, 13.5, 43.1, 11.6, 44.5, 10.4, 51.2, 11.8,
  51, 10.4, 49.5, 6, 47.5, 4, 45.3, 2, 42, -0.5, 40.2, -3, 39.3, -6.8, 40.4, -10.5, 40.7, -15, 36.9, -17.9, 34.8, -19.8, 35.5, -23.7,
  32.6, -25.9, 32.4, -28.6, 31, -29.9, 28, -32.8, 25.6, -34, 20, -34.8, 18.4, -34.3, 18, -32.5, 16.5, -28.6, 15.2, -26.6, 14.5, -22.9,
  13.1, -20, 11.8, -17.2, 12, -13.4, 13.2, -8.8, 12.2, -6, 11.8, -4.8, 9.3, -1.5, 9.5, 2.5, 9.7, 4, 8.5, 4.6, 6, 4.3, 3.4, 6.4, 1, 5.9,
  -2, 4.8, -4, 5.2, -7.5, 4.4, -10.8, 6.3, -13.2, 8.5, -15, 10.8, -16.8, 12.6, -17.5, 14.7, -16.5, 16.5, -16, 19, -17, 21, -16, 24,
  -14.5, 26, -12, 28, -9.6, 30.4, -9.3, 32.5, -7.6, 33.6, -6.8, 34,
];

const MADAGASCAR = [49.3, -12, 50.5, -15.5, 49.5, -17.5, 48, -22.5, 47.1, -25, 44, -24.5, 43.3, -22, 44.4, -16.5, 46.4, -15.8, 48, -13.5];

const EURASIA = [
  // Middelhavet (nordsida) østover
  -5.6, 36, -2.1, 36.7, -0.3, 39.5, 0.2, 38.8, 3.2, 41.9, 4.6, 43.4, 7.4, 43.7, 8.9, 44.4, 10.3, 43.5, 12.2, 41.7, 14.2, 40.8, 15.6, 40,
  15.7, 38, 17.1, 39, 18.5, 40.1, 16.9, 41.1, 14.2, 42.5, 12.3, 44.4, 12.4, 45.4, 13.7, 45.7, 15, 44.6, 16.4, 43.5, 18.5, 42.4,
  19.4, 40.4, 20.7, 38.8, 21.7, 37, 22.5, 36.4, 23.7, 37.9, 22.9, 40.6, 24.4, 40.9, 26, 40.8, 26.2, 40, 27.1, 38.4, 27.4, 37, 28.5, 36.6,
  30.6, 36.8, 32.5, 36.1, 34.6, 36.8, 36.2, 36.6, 35.8, 35.5, 35.5, 33.9, 35, 32.8, 34.4, 31.5,
  // Sinai, Rødehavet og Arabia
  32.4, 31.2, 32.6, 29.9, 34.2, 27.8, 34.9, 29.5, 35, 29.5, 36.5, 26, 38, 24.1, 39.2, 21.5, 41.5, 17.5, 42.7, 15, 43.4, 12.7, 45, 12.8,
  48.7, 14, 52.2, 15.6, 54.1, 17, 56.8, 18.5, 58.6, 20.4, 59.8, 22.4, 58.5, 23.6, 56.6, 24.5, 56.3, 26.3, 55.3, 25.2, 54, 24.1, 52, 23.9,
  51.5, 26.1, 50.8, 24.7, 50.1, 26.4, 48.6, 27.9, 48, 29.4, 48.6, 30, 50.8, 28.9, 52.5, 27.5, 54.8, 26.5, 56.3, 27.2, 57.3, 25.8,
  // Iran, Pakistan, India
  62.3, 25.1, 67, 24.8, 68.3, 23.6, 69, 22.3, 70.9, 20.7, 72.6, 21.1, 72.8, 19, 73.8, 15.5, 74.8, 12.9, 76.2, 9.9, 77.5, 8.1, 78.2, 9,
  79.8, 10.3, 80.3, 13.1, 80.2, 15.5, 82.3, 16.6, 83.3, 17.7, 85.8, 19.8, 87, 21.5, 88.3, 21.6, 90.5, 22, 91.8, 22.3, 92.3, 20.7, 94, 19,
  // Sørøst-Asia
  94.2, 16, 95.3, 15.8, 97.6, 16.5, 98.6, 13, 98.4, 8, 100.3, 5.4, 101.3, 2.8, 103.5, 1.4, 104.2, 1.6, 103.3, 3.8, 102.3, 6.1,
  100.4, 7.2, 99.3, 9.3, 100, 12.5, 100.9, 13.4, 101.5, 12.6, 102.6, 12, 103.6, 10.6, 104.8, 8.6, 107.1, 10.3, 109.2, 11.6, 109.3, 13.8,
  108.2, 16.1, 107.1, 17, 105.7, 18.7, 106.7, 20.8, 108, 21.5, 109.1, 21.5, 110.3, 20.3, 111, 21.5, 113.4, 22.2,
  // Kina, Korea og Øst-Russland
  116.7, 23.4, 118.1, 24.5, 119.3, 26.1, 121.5, 28.5, 122, 29.9, 121, 30.6, 121.8, 31.3, 120.9, 32.6, 119.4, 34.6, 120.3, 36, 122.5, 37.4,
  121.4, 37.5, 119, 37.2, 117.7, 39, 119.6, 39.9, 121.1, 40.8, 122.2, 40.5, 121.2, 38.8, 122.8, 39.6, 124.4, 39.9, 125.2, 38, 126.6, 37.5,
  126.4, 34.8, 127.7, 34.7, 129.1, 35.1, 129.5, 36.5, 128.6, 38.3, 127.5, 39.2, 128.6, 40.3, 129.8, 41.8, 130.7, 42.3, 132, 43.1,
  133.2, 42.8, 135.5, 43.9, 138, 46.5, 140.3, 49, 141.4, 52.3, 141, 53, 139.5, 54.1, 137, 54, 135.3, 54.6, 137.8, 56.3, 141, 58.8,
  143.2, 59.4, 148.5, 59.4, 150.8, 59.6, 154.2, 59.1, 156.7, 61.6, 160, 61.9, 160.5, 60.5, 156.5, 57.5, 155.6, 54.5, 156.7, 51,
  158.6, 53, 160, 54.5, 162.6, 56.1, 163.5, 58, 164.8, 59.9, 170.3, 59.9, 174.5, 61.8, 177.5, 62.6, 179.9, 64.6,
  // Nordkysten vestover
  179.9, 69, 170.3, 69.7, 161.5, 69.5, 152, 70.9, 147, 72.3, 140, 72.5, 131, 71.5, 127, 73.5, 122, 73, 113.5, 73.7, 113, 76, 104.3, 77.7,
  98, 76.2, 94, 75.9, 87, 74.5, 80.5, 73.5, 75, 72.8, 70, 73.4, 68.5, 70.5, 66.8, 69.5, 60.7, 69.7, 58.5, 68.8, 54, 68.3, 48, 67.7,
  43.3, 68.6, 44.2, 66, 40.5, 64.6, 37, 64, 34.8, 64.5, 32.4, 67.1, 36, 66.2, 41.2, 66.7, 41, 67.8, 36, 69.1, 33.1, 69, 30, 69.8,
  // Norge
  27.7, 71.1, 25.8, 71.1, 23.7, 70.7, 18.9, 69.6, 16, 69.3, 13, 68.1, 14.4, 67.3, 12.5, 66, 11.2, 64.9, 9.8, 63.6, 8.5, 63.4, 7.2, 62.7,
  5.1, 62.2, 4.9, 61, 5.1, 60.4, 5.3, 59.2, 5.6, 58.8, 7, 58, 8, 58.1, 9.5, 59, 10.6, 59.6, 11, 59,
  // Sverige og Finland rundt Østersjøen
  11.9, 57.7, 12.9, 56.7, 13, 55.6, 14.2, 55.4, 14.6, 56.1, 16.4, 56.7, 16.6, 57.9, 16.9, 58.6, 18.1, 59.3, 18.8, 60.1, 17.2, 60.7,
  17.4, 61.7, 17.9, 62.6, 19, 63.5, 20.3, 63.8, 21.2, 64.7, 22.2, 65.6, 24.2, 65.8, 25.4, 65, 24.6, 64.2, 23.1, 63.8, 21.6, 63.1,
  21.5, 61.5, 21.6, 60.4, 22.3, 60.4, 23, 59.85, 25, 60.2, 26.9, 60.5, 28.7, 60.7, 30.2, 59.9, 28, 59.4, 24.8, 59.4, 23.5, 59.2,
  23.5, 58.4, 24.5, 58.4, 24.1, 57, 22.6, 57.75, 21.6, 57.4, 21, 56.5, 21.1, 55.7, 20, 54.9, 18.6, 54.4, 17, 54.7, 14.3, 53.9,
  12.1, 54.2, 10.9, 53.95, 10.2, 54.4, 9.9, 55, 10.2, 56, 10.6, 57.7, 8.6, 57.1, 8.1, 56.3, 8.4, 55.5, 8.6, 54.9, 8.7, 53.9,
  // Atlanterhavskysten sørover
  7.2, 53.5, 4.7, 52.9, 4.2, 52, 3.4, 51.4, 2.4, 51.1, 1.6, 50.9, 1.6, 50.2, 0.1, 49.5, -1.3, 49.7, -1.6, 48.6, -3, 48.8, -4.7, 48.4,
  -4.2, 47.8, -2.5, 47.3, -1.2, 46.2, -1.2, 44.7, -1.6, 43.4, -3.8, 43.5, -6, 43.6, -8.3, 43.4, -9.3, 43, -8.9, 42, -8.7, 41.1,
  -9.4, 39.4, -9.5, 38.7, -8.8, 38, -8.9, 37, -7.4, 37.2, -6.3, 36.5,
];

const BRITAIN = [-5.5, 50, -3, 50.6, 1.4, 51.2, 1.7, 52.7, 0.3, 53.4, -0.1, 54.5, -1.5, 55.5, -2, 57, -1.8, 57.6, -3.5, 58.6, -5, 58.6, -6.2, 57.5, -5.6, 56.3, -5.2, 55.4, -3.2, 54.8, -3.5, 54.2, -3, 53.3, -4.5, 53.3, -4.2, 52.3, -5.2, 51.8, -3, 51.4, -4.5, 51.1];
const IRELAND = [-6, 52.2, -6, 54, -7.3, 55.3, -8.5, 54.8, -10, 54, -9.6, 53, -10.4, 51.9, -8.5, 51.6];
const ICELAND = [-24, 65.5, -22, 66.4, -16, 66.5, -13.6, 65.2, -15, 64.3, -18.5, 63.4, -22.7, 63.8];
const SICILY = [12.4, 38, 15.6, 38.3, 15.1, 36.7, 12.6, 37.6];
const SARDINIA = [8.2, 40.9, 9.8, 41.2, 9.6, 39.2, 8.6, 38.9, 8.4, 39.8];
const SRI_LANKA = [79.9, 6.2, 80.6, 5.9, 81.9, 7.5, 80.2, 9.8, 79.8, 8.2];
const TAIWAN = [120.1, 23, 121, 25.2, 121.9, 24.6, 120.8, 21.9];
const JAPAN = [
  130.2, 31.3, 131.4, 31.4, 132, 33.8, 134.6, 33.8, 135.6, 33.5, 136.9, 34.3, 138.8, 34.6, 140, 35, 140.8, 35.7, 141, 37.5, 142, 39.5,
  141.5, 41.4, 140, 40.8, 139.8, 39, 139, 37.9, 137.3, 37.5, 136, 36, 133, 35.5, 131, 34.4, 129.8, 33.5,
];
const HOKKAIDO = [140, 41.5, 141.2, 41.8, 143.2, 42, 145.5, 43.3, 144, 44.1, 141.9, 45.5, 141.5, 43.5, 140, 42.5];
const SAKHALIN = [142, 46, 143.5, 46.5, 143.2, 49.5, 144.2, 49.1, 142.7, 54.3, 142.2, 51, 141.8, 48];
const BORNEO = [109.5, 1.5, 111, 2.2, 113, 3.2, 115.5, 5.3, 117, 7, 119.2, 5.3, 118, 4.3, 118.5, 1, 117.5, 0.5, 116.5, -2.5, 116, -4, 113, -3.2, 110.3, -2.9, 109, -0.5];
const SUMATRA = [95.3, 5.6, 97.5, 5.2, 100, 2.5, 103.8, -1, 106, -3, 105.9, -5.8, 104.5, -5.9, 102.3, -4, 100.4, -0.9, 98.7, 1.7, 96.5, 3.5];
const JAVA = [105.2, -6.8, 106.8, -6.1, 110.5, -6.8, 112.7, -7.2, 114.5, -7.8, 114.4, -8.7, 111, -8.2, 106.5, -7.4];
const SULAWESI = [119.5, -5.5, 120.5, -2.5, 120.8, 1.2, 124.8, 1.5, 121.5, 0.5, 123.3, -0.9, 121.3, -1.8, 122.8, -4.6, 121, -3.5];
const LUZON = [120.5, 18.5, 122.2, 18.5, 121.5, 15.5, 124, 13, 120.6, 13.8, 120, 16.2];
const MINDANAO = [122, 8.1, 125.4, 9.8, 126.6, 7.3, 125.4, 5.6, 124, 6.5, 122.1, 6.9];
const NEW_GUINEA = [131, -1, 135, -3.5, 138, -1.5, 141, -2.6, 145.5, -4.5, 147.5, -6, 150.5, -10.6, 147, -8.5, 144, -7.8, 141, -9.1, 138, -8.4, 137.5, -5, 133, -4, 131.5, -2.5];
const AUSTRALIA = [
  113, -22, 114, -26, 115, -34, 118, -35, 124, -34, 131, -31.5, 135.5, -34.8, 138, -35, 140, -38, 146, -39, 150, -37.5, 153, -32,
  153.5, -28, 152, -25, 149, -21, 146, -19, 145.5, -15, 142.5, -10.7, 141.5, -13, 141.5, -17, 139.5, -17.5, 136, -15, 136, -12, 132, -11.5,
  130, -13, 129, -15, 126, -14, 122, -17, 120, -20,
];
const TASMANIA = [144.6, -40.7, 148.3, -40.9, 148, -43.2, 146.5, -43.6, 145.2, -42.2];
const NZ_NORTH = [172.7, -34.4, 174.8, -36.8, 178.5, -37.7, 177.9, -39.2, 176.8, -40, 174.8, -41.3, 174, -39.3, 174.6, -38, 173, -35.5];
const NZ_SOUTH = [172.7, -40.5, 174.3, -41.7, 173, -43.5, 171.2, -44.4, 169, -46.6, 166.5, -46, 168, -44, 170.5, -42.8, 172, -41];

const NORTH_AMERICA = [
  -77.4, 8.7, -79.6, 9.6, -81.5, 9, -83, 10, -83.4, 15, -86, 16, -88.2, 15.8, -88.3, 18.5, -87, 21.5, -89.7, 21.3, -90.5, 19.8, -92.5, 18.6,
  -94.4, 18.2, -96.1, 19.2, -97.4, 21, -97.8, 22.3, -97.2, 25.9, -97.4, 27.8, -94.8, 29.3, -93, 29.7, -89.4, 29, -88, 30.7, -85, 29.7,
  -83, 29, -82.6, 27.8, -81.8, 26.1, -80.9, 25.2, -80.1, 26.5, -80.6, 28.4, -81.4, 30.4, -79.9, 32.8, -77.9, 34.2, -75.5, 35.2, -76.3, 36.9,
  -74.9, 38.9, -74, 40.6, -72, 41, -70, 41.7, -70.8, 42.5, -70.2, 43.7, -67, 44.8, -66.1, 43.8, -63.5, 44.6, -60, 46.2, -61.5, 45.9,
  -64.5, 46.3, -65.5, 47.5, -64.2, 48.8, -66.5, 49.2, -68, 49, -66.5, 50.2, -62, 50.2, -57.2, 51.4, -55.7, 52.1, -56.2, 53.6, -58, 54.3,
  -60.5, 55.5, -61.6, 56.5, -64.5, 60.3, -70, 62.5, -78, 64, -85, 66.5, -90, 68.5, -95, 68, -100, 67.8, -108, 68.2, -115, 68, -121, 69.5,
  -128, 70, -135, 69.3, -141, 69.7, -148, 70.4, -156.8, 71.3, -162, 70.2, -166, 68.9, -163, 67, -165.5, 65.6, -161, 64.5, -165, 62.5,
  -162, 60, -158, 58.7, -162, 55.5, -157, 56.8, -153, 58.5, -151.5, 59.2, -148, 60.6, -146, 61, -141, 60, -137, 58.5, -135, 57, -131.5, 54.5,
  -128, 51.5, -124, 49.2, -124.7, 48.4, -124, 46.2, -124.2, 43, -124.2, 40.4, -122.5, 37.8, -121, 35.5, -118.5, 34, -117.1, 32.5,
  -116, 30, -114.5, 28, -112.5, 25.5, -109.9, 22.9, -110.5, 24.5, -112.5, 28, -114.6, 31.5, -113, 31, -110.9, 27.9, -109, 25.6, -106.5, 23.2,
  -105.3, 20.6, -104.3, 19.1, -101.5, 17.6, -99.9, 16.8, -96.5, 15.7, -95.2, 16.2, -92.2, 14.5, -89.5, 13.4, -87.6, 13, -86, 11.5,
  -85.7, 10, -84, 9, -82.9, 8, -80, 7.4, -79.5, 8.9, -78, 8.3,
];
const HUDSON_BAY = [-79.5, 51.5, -82, 53, -85, 55.3, -88.5, 56.8, -92.5, 57.2, -94.3, 59, -94.5, 61, -91.5, 63, -86.5, 64, -82, 63.5, -78.5, 62, -77.3, 59, -77, 56, -79, 54];
const BAFFIN = [-65, 62.2, -70, 62.8, -75, 64.5, -80, 68.5, -85, 70.5, -90, 73, -80, 73.6, -75, 72.3, -70, 70.5, -66, 68.5, -61.5, 66.6];
const CUBA = [-85, 21.9, -81.5, 23.1, -77.5, 22.5, -74.2, 20.2, -77.5, 19.8, -80, 21.7, -82.5, 21.6];
const HISPANIOLA = [-74.4, 19.9, -71, 19.9, -68.4, 18.6, -71.4, 17.6, -74.4, 18.4];
const SOUTH_AMERICA = [
  -77.4, 8.7, -75.5, 10.5, -72, 12, -71.3, 11, -68, 10.5, -62, 10.5, -60.5, 8.5, -57, 6, -52, 5, -50, 1.5, -50, 0, -48.5, -1.4, -44, -2.5,
  -40, -3, -35, -5.5, -35.1, -9, -37.5, -12.5, -39, -13.5, -39.3, -17.5, -40.5, -20, -42, -23, -44.5, -23.4, -48, -26, -48.7, -28.5,
  -50.5, -31, -53, -34, -54.5, -34.8, -57.5, -35.3, -58, -38, -62, -38.8, -62.5, -40.5, -65, -41, -64.5, -42.5, -65.5, -45, -67.5, -46.5,
  -65.8, -47.8, -68.3, -50.5, -68.5, -52.3, -69, -54.5, -66.5, -55, -71, -55.5, -74.5, -52.5, -75.5, -48, -74, -44, -73.5, -41.5, -73.6, -37,
  -71.6, -33, -71.4, -28.5, -70.5, -23.5, -70.2, -18.5, -72.5, -16.8, -76.2, -14, -77.2, -12, -79.5, -7.5, -81.3, -5.2, -80.3, -3.4,
  -80.9, -1.5, -80, 0.8, -78.8, 1.8, -77.5, 4, -77.4, 6.8,
];

/** Landområdene på jorda (fylles grønne). */
export const EARTH_LAND: readonly Ring[] = [
  AFRICA, MADAGASCAR, EURASIA, BRITAIN, IRELAND, ICELAND, SICILY, SARDINIA, SRI_LANKA, TAIWAN, JAPAN, HOKKAIDO, SAKHALIN, BORNEO,
  SUMATRA, JAVA, SULAWESI, LUZON, MINDANAO, NEW_GUINEA, AUSTRALIA, TASMANIA, NZ_NORTH, NZ_SOUTH, NORTH_AMERICA, BAFFIN, CUBA,
  HISPANIOLA, SOUTH_AMERICA,
];

/** Innsjøer og innhav som skjæres ut av landet (fyllregel evenodd). */
export const EARTH_WATER: readonly Ring[] = [
  HUDSON_BAY,
  // Svartehavet og Kaspihavet
  [28, 41.2, 28, 44, 30, 46, 33, 46, 36, 45.3, 39, 47, 38, 45, 41.5, 41.5, 37, 41, 32, 41.8],
  [47.5, 42.5, 47, 44.5, 50, 47, 53, 46.8, 53, 42, 54, 38, 52, 36.8, 49, 37.5, 49.5, 40.5],
];

/** Ørken og tørt land (fylles sandfarget oppå landet). */
export const EARTH_DESERT: readonly Ring[] = [
  // Sahara
  [-14, 18, -12, 25, -8, 29, -2, 31, 5, 31.5, 10, 31, 15, 30, 20, 29.5, 26, 30.2, 30, 29.5, 32, 26, 33.5, 22, 35, 18, 33, 15.5, 26, 14.5,
    18, 15, 12, 15.5, 5, 16, -2, 15.5, -8, 15.5, -13, 15.5],
  // Arabia, Iran og Afghanistan
  [37.5, 28, 41, 31.5, 46, 31, 47.5, 28.5, 50, 25.5, 55, 22.5, 57, 19.5, 52, 17, 46, 15.5, 43, 17, 40, 21, 38, 25],
  [50.5, 31, 54, 34.5, 60, 35, 65, 34, 66, 30, 62, 27.5, 56, 28.5, 52, 29.5],
  // Sentral-Asia og Gobi
  [55, 40.5, 58, 44, 64, 45, 70, 43.5, 66, 39, 60, 38],
  [90, 40, 96, 42.5, 104, 43.5, 112, 44, 116, 43, 110, 39.5, 103, 38, 96, 37.5],
  // Kalahari og Namib
  [13.5, -18, 17, -18.5, 22, -20, 25, -24, 24, -28, 19, -29.5, 16, -27, 14.5, -23],
  // Australia
  [115, -22, 120, -20.5, 126, -19, 133, -19, 137, -21, 140, -25.5, 139, -30, 134, -31, 128, -30, 122, -28.5, 116, -26],
  // Sørvest i Nord-Amerika og Atacama
  [-117, 33.5, -114, 36.5, -110, 37, -106, 33, -103.5, 29, -106, 27, -109.5, 29, -112.5, 31],
  [-70.6, -18.5, -69, -18.5, -68.5, -24, -69.5, -28, -70.8, -27, -70.3, -22],
];

/** Is: Grønland, Antarktis og havisen rundt Nordpolen. */
export const EARTH_ICE: readonly Ring[] = [
  [-44, 60, -42, 61, -40, 64, -37, 65.5, -32, 68, -22, 70.5, -24, 73, -19, 75, -18, 79, -12, 81.5, -30, 83.5, -50, 82.5, -60, 82, -65, 80,
    -72, 78, -66, 76, -58, 75.5, -55, 72, -54, 69, -52, 66, -50, 63, -48, 61],
  polarCap(-70, 3.5, 1),
  polarCap(80, 2.5, 4),
];

/** Skyfelt: [lon, lat, halvakse øst–vest, halvakse nord–sør, dreining] i grader. */
const CLOUD_FIELDS: readonly (readonly [number, number, number, number, number])[] = [
  // Nord-Atlanteren og Europa (lavtrykksbanen)
  [-48, 50, 10, 3.5, -18],
  [-30, 56, 9, 3, -12],
  [-12, 60, 8, 2.8, -8],
  [6, 63, 9, 2.6, -5],
  [-40, 42, 6, 2.2, -25],
  [28, 58, 7, 2.4, 0],
  // Det indre tropiske konvergensbeltet
  [-28, 6, 5, 2, 0],
  [-8, 4, 4, 1.6, 0],
  [14, 3, 5, 2.4, 0],
  [26, -1, 4, 2.2, 0],
  [98, 4, 6, 2, 0],
  [125, 6, 5, 2, 0],
  [160, 7, 6, 1.8, 0],
  [-150, 8, 6, 1.8, 0],
  [-110, 7, 5, 1.6, 0],
  [-65, -3, 5, 2.2, 0],
  // Sørhavet
  [-35, -46, 11, 3, 14],
  [-5, -50, 10, 3, 10],
  [25, -47, 11, 3.2, 12],
  [55, -52, 10, 3, 8],
  [90, -48, 12, 3, 14],
  [130, -53, 10, 2.8, 10],
  [170, -47, 11, 3, 12],
  [-140, -50, 10, 3, 10],
  [-95, -46, 11, 3, 14],
  [-62, -55, 9, 2.6, 8],
  // Nord-Stillehavet og Asia
  [160, 46, 10, 3, -14],
  [-170, 52, 9, 3, -10],
  [-140, 46, 9, 2.8, -16],
  [120, 42, 7, 2.4, -14],
  [80, 55, 8, 2.4, -6],
  // Passatskyer over havet
  [-30, 20, 4, 1.6, 20],
  [-120, -18, 4.5, 1.6, -20],
  [70, -16, 4, 1.5, -20],
];

/** Skyfeltene som myke flater (ytre, svak del) og den tettere kjernen. */
export const EARTH_CLOUDS_SOFT: readonly Ring[] = CLOUD_FIELDS.map(([lon, lat, a, b, rot], i) => sphereEllipse(lon, lat, a, b, 14, rot, 0.2, i + 1));
export const EARTH_CLOUDS_CORE: readonly Ring[] = CLOUD_FIELDS.map(([lon, lat, a, b, rot], i) =>
  sphereEllipse(lon + a * 0.12, lat, a * 0.55, b * 0.5, 12, rot, 0.25, i + 9),
);

/* ---------- Mars ---------- */

/** Mørke områder på Mars (Syrtis Major, Meridiani, Mare Erythraeum, Acidalium og det sørlige mørke beltet). */
export const MARS_DARK: readonly Ring[] = [
  [58, -2, 76, -2, 74, 10, 69, 22, 63, 14],
  [-12, -3, 8, -1, 22, -7, 44, -4, 52, -12, 30, -19, 6, -14, -8, -10],
  [-62, -14, -36, -17, -18, -24, -16, -36, -40, -42, -66, -34],
  [-54, 38, -24, 40, -12, 52, -32, 61, -56, 52],
  [84, -6, 110, -12, 140, -16, 172, -20, 176, -30, 140, -30, 108, -26, 86, -16],
  [-178, -20, -150, -24, -130, -28, -140, -36, -170, -32],
  sphereEllipse(-92, -26, 7, 4, 10, 15, 0.15, 3),
];

/** Lyse områder på Mars: Hellas-bassenget og vulkanene på Tharsis. */
export const MARS_LIGHT: readonly Ring[] = [
  sphereEllipse(70, -42, 14, 9, 14, 0, 0.12, 2),
  sphereEllipse(-134, 18, 4, 4, 10),
  sphereEllipse(-113, -1, 2.5, 2.5, 8),
  sphereEllipse(-120, 9, 2.5, 2.5, 8),
  sphereEllipse(-104, 12, 2.5, 2.5, 8),
];

/** Polkappene på Mars. */
export const MARS_CAPS: readonly Ring[] = [polarCap(77, 2, 2), polarCap(-82, 1.5, 5)];

/** Valles Marineris (kløft). */
export const MARS_CANYON: readonly Ring[] = [[-95, -7, -80, -9, -66, -11, -52, -13, -40, -12]];

/* ---------- Månen ---------- */

/** Månens hav (maria) på forsiden. */
export const MOON_MARIA: readonly Ring[] = [
  sphereEllipse(-57, 18, 18, 24, 18, 10, 0.12, 1), // Oceanus Procellarum
  sphereEllipse(-16, 33, 13, 10, 16, 0, 0.08, 2), // Imbrium
  sphereEllipse(17, 28, 8, 8, 14, 0, 0.06, 3), // Serenitatis
  sphereEllipse(31, 8, 11, 8, 14, 20, 0.12, 4), // Tranquillitatis
  sphereEllipse(59, 17, 6, 5, 12, 0, 0.05, 5), // Crisium
  sphereEllipse(-17, -21, 9, 7, 12, 0, 0.1, 6), // Nubium
  sphereEllipse(51, -8, 7, 8, 12, 0, 0.1, 7), // Fecunditatis
  sphereEllipse(35, -15, 4.5, 4.5, 10, 0, 0.05, 8), // Nectaris
  sphereEllipse(-39, -24, 4.5, 4.5, 10, 0, 0.05, 9), // Humorum
  sphereEllipse(2, 56, 32, 3.5, 18, 0, 0.1, 10), // Frigoris
  sphereEllipse(-1, 0, 6, 4, 10, 0, 0.05, 11), // Sinus Medii
];

/** Kratere på Månen: [lon, lat, radius i grader]. */
export const MOON_CRATERS: readonly (readonly [number, number, number])[] = [
  [-11, -43, 3.5], // Tycho
  [-20, 10, 3.2], // Copernicus
  [-38, 8, 2], // Kepler
  [-9, 51.5, 2.6], // Plato
  [-47, 24, 1.8], // Aristarchus
  [26, -26, 2.2], // Theophilus
  [6, -36, 2.4],
  [61, -9, 2.4], // Langrenus
];

/** Lyse stråler fra Tycho. */
export const MOON_RAYS: readonly Ring[] = [
  [-11, -43, 10, -20],
  [-11, -43, -32, -18],
  [-11, -43, -2, -8],
  [-11, -43, 18, -48],
  [-11, -43, -40, -52],
  [-11, -43, -18, -4],
];

/* ---------- Jupiter og Neptun ---------- */

/** Bånd på Jupiter: [sør, nord, tone] der tone 0 = belte, 1 = mørkt belte. */
export const JUPITER_BELTS: readonly (readonly [number, number, 0 | 1])[] = [
  [7, 18, 1], // nordlige ekvatorbelte
  [24, 31, 0], // nordlige tempererte belte
  [36, 41, 0],
  [-20, -7, 1], // sørlige ekvatorbelte
  [-33, -27, 0], // sørlige tempererte belte
  [-42, -38, 0],
];

/** Bånd på Neptun: [sør, nord, tone] der tone 0 = mørkt, 1 = lyst. */
export const NEPTUNE_BANDS: readonly (readonly [number, number, 0 | 1])[] = [
  [-62, -48, 0],
  [-12, 8, 1],
  [40, 55, 0],
];

/** Flate mellom to breddegrader, sett fra (lon0, lat0) – bare forsida. */
export function bandRing(latS: number, latN: number, lon0: number, wobble = 0, seed = 0): number[] {
  const out: number[] = [];
  for (let d = -92; d <= 92; d += 4) out.push(lon0 + d, latN + wobble * Math.sin((d + seed * 37) * 0.09));
  for (let d = 92; d >= -92; d -= 4) out.push(lon0 + d, latS + wobble * Math.sin((d + seed * 53) * 0.11));
  return out;
}

/** Stripe langs en breddegrad (skyer på Neptun). */
export function latStripe(lon1: number, lon2: number, lat: number): number[] {
  return latBand(lon1, lon2, lat, 0.8, 1);
}
