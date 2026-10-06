/**
 * Geometrien i scenen «Sykle opp bakken» (ren matematikk uten React, så den kan testes): nærbildet av syklisten på
 * veien, veien som går gjennom figuren med den ekte vinkelen θ, stigningstrekanten under veien, panelet med klokka og
 * profilen av hele bakken, og hvor trær og murstein står langs veien når veien ruller forbi.
 *
 * Nærbildet har én fast skala S (px/m), så syklisten, sykkelen og stigningstrekanten står i riktig forhold. Veien er
 * en rett linje gjennom ankerpunktet til sykkelen (xc, yc) med vinkelen θ. Den tegnes i en gruppe som er dreid −θ om
 * (xc, yc): i den gruppen («veirammen») går veien vannrett, x langs veien og y ned. Trær, tekst og stigningstrekanten
 * står i figurens egne koordinater (loddrett er loddrett).
 */

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface BikeLayout {
  W: number;
  H: number;
  /** Skala i nærbildet (px/m). */
  S: number;
  /** Ankerpunktet til sykkelen: på veien midt mellom hjulene. */
  xc: number;
  yc: number;
  /** Veibanen i perspektiv (px): fra 0,7 · road bak kontaktlinja til 0,3 · road foran (som Vei i scene-kit-et). */
  road: number;
  /** Høyden på steinmuren langs bakkanten av veien (px). */
  wall: number;
  /** Horisonten (foten av fjellene langt borte). */
  horizon: number;
  /** Panelet med klokka, høyden, arbeidet og profilen av bakken. */
  hud: Box;
  /** Den lengste kraftpila (px). */
  maxArrow: number;
  /**
   * Stigningstrekanten: venstre hjørne (px), lengden bortover (m) og hvor langt under veikanten den står (px, på
   * tvers av veien). Med `drop` = 0 er veikanten hypotenusen; ellers står trekanten nede i lia med hypotenusen
   * parallell med veien, så den ikke kommer i veien for kraftpila F (mobil). Lengden bortover er 2 m, så høyden
   * run · p/100 er et eksakt tall med to desimaler for alle stigningene på glidebryteren (steg på 0,5 %).
   */
  tri: { x: number; run: number; drop: number };
  /** Målestokken for kreftene: høyre ende (px) og høyden. */
  scaleBar: { x: number; y: number };
  narrow: boolean;
}

export const BIKE_WIDE: BikeLayout = {
  W: 800,
  H: 440,
  S: 80,
  xc: 392,
  yc: 322,
  road: 34,
  wall: 30,
  horizon: 236,
  hud: { x: 12, y: 12, w: 316, h: 128 },
  maxArrow: 186,
  tri: { x: 566, run: 2, drop: 0 },
  scaleBar: { x: 784, y: 30 },
  narrow: false,
};

export const BIKE_NARROW: BikeLayout = {
  W: 520,
  H: 600,
  S: 92,
  xc: 262,
  yc: 482,
  road: 34,
  wall: 30,
  horizon: 382,
  hud: { x: 10, y: 10, w: 500, h: 150 },
  maxArrow: 136,
  tri: { x: 236, run: 2, drop: 30 },
  scaleBar: { x: 506, y: 190 },
  narrow: true,
};

export interface Pt {
  x: number;
  y: number;
}

/**
 * Fra veirammen til figuren: punktet `u` px langs veien fra ankerpunktet (positiv = framover, opp bakken) og `e` px
 * på tvers (positiv = ned/fram mot betrakteren), når veien har vinkelen θ.
 */
export function fromRoad(lay: BikeLayout, theta: number, u: number, e = 0): Pt {
  const c = Math.cos(theta);
  const s = Math.sin(theta);
  return { x: lay.xc + u * c + e * s, y: lay.yc - u * s + e * c };
}

/** y for linja i veirammen som ligger `e` px på tvers av kontaktlinja (e = 0 er der hjulene står), i x. */
export function roadLineY(lay: BikeLayout, theta: number, x: number, e = 0): number {
  const c = Math.cos(theta);
  const s = Math.sin(theta);
  const u = (x - lay.xc - e * s) / c;
  return lay.yc - u * s + e * c;
}

/** Hvor langt veirammen må gå til begge sider (px) for å dekke hele figuren når den er dreid. */
export function roadSpan(lay: BikeLayout, theta: number): { from: number; to: number; depth: number } {
  const c = Math.cos(theta);
  const pad = 40;
  const from = -(lay.xc + pad) / c - lay.H * Math.tan(theta);
  const to = (lay.W - lay.xc + pad) / c + lay.H * Math.tan(theta);
  // Fronten av veien må nå ned under bunnen av figuren også der veien ligger høyest (til høyre).
  const depth = (lay.H - lay.yc + (lay.W - lay.xc) * Math.tan(theta)) / c + pad;
  return { from, to, depth };
}

/** Kanten der veibanen og den nære veikanten slutter (der stigningstrekanten starter), i veirammen. */
export function nearEdge(lay: BikeLayout): number {
  return 0.48 * lay.road;
}

export interface GradeTriangle {
  /** Hjørnet med vinkelen θ (på kanten av veien). */
  x0: number;
  y0: number;
  /** Hjørnet under den høyre enden (rett vinkel) og toppen av den loddrette kateten. */
  x1: number;
  y1: number;
  /** Lengden bortover (m) og høyden opp (m). */
  run: number;
  rise: number;
}

/**
 * Stigningstrekanten under veien: vannrett katet `run` meter bortover fra kanten av veien, loddrett katet opp til
 * kanten igjen (`rise` = run · p/100 meter), og veikanten som hypotenus (eller en linje parallell med veikanten,
 * `lay.tri.drop` px lenger ned i lia). Samme skala som syklisten.
 */
export function gradeTriangle(lay: BikeLayout, theta: number): GradeTriangle {
  const e = nearEdge(lay) + lay.tri.drop;
  const run = lay.tri.run;
  const x0 = lay.tri.x;
  const y0 = roadLineY(lay, theta, x0, e);
  const x1 = x0 + run * lay.S;
  const y1 = roadLineY(lay, theta, x1, e);
  return { x0, y0, x1, y1, run, rise: run * Math.tan(theta) };
}

export interface GradeLabels {
  /** «0,19 m opp» står til høyre for den loddrette kateten (ellers på en egen linje under «… m bortover»). */
  right: boolean;
  /** Plass til hele «0,19 m opp» (ellers bare «0,19 m»). */
  long: boolean;
  /** Grunnlinjene til «2,5 m bortover», høyden og «stigning … = 7,5 %». */
  run: { x: number; y: number };
  rise: { x: number; y: number; anchor: 'start' | 'middle' };
  ratio: { x: number; y: number };
}

/** Omtrentlig (romslig) bredde av en etikett med `chars` tegn og relativ størrelse `size` (Txt) ved tekstskaleringen f. */
export function labelWidth(chars: number, f: number, size = 0.82): number {
  return chars * 17 * size * 0.6 * f;
}

/**
 * Hvor tekstene ved stigningstrekanten står: «… m bortover» midt under den vannrette kateten, høyden til høyre for den
 * loddrette kateten (som «0,19 m opp», eller «0,19 m» når det er trangt) og «stigning … = 7,5 %» under. Får ikke
 * høyden plass til høyre, står den på en egen linje. `longLen` og `shortLen` er antall tegn i de to utgavene av
 * høydeteksten.
 */
export function gradeLabelLayout(tri: GradeTriangle, W: number, f: number, longLen: number, shortLen: number): GradeLabels {
  const room = W - 4 - (tri.x1 + 8);
  const long = labelWidth(longLen, f) <= room;
  const right = long || labelWidth(shortLen, f) <= room;
  const mid = (tri.x0 + tri.x1) / 2;
  const run = { x: mid, y: tri.y0 + 20 * f };
  if (right)
    return { right, long, run, rise: { x: tri.x1 + 8, y: (tri.y0 + tri.y1) / 2 + 5 * f, anchor: 'start' }, ratio: { x: mid, y: tri.y0 + 42 * f } };
  return { right, long: true, run, rise: { x: mid, y: tri.y0 + 42 * f, anchor: 'middle' }, ratio: { x: mid, y: tri.y0 + 64 * f } };
}

/**
 * Forskyvningen (px) til et mønster som gjentar seg hver `period` px når veien har rullet `shift` px:
 * alltid i [−period, 0), så mønsteret tegnes fra litt utenfor venstre kant.
 */
export function wrapShift(shift: number, period: number): number {
  if (!(period > 0) || !Number.isFinite(shift)) return 0;
  const r = shift % period;
  return r < 0 ? -(r + period) : -r;
}

/** Et tall i [0, 1) som bare avhenger av heltallet i og frøet (samme tre på samme sted hver gang). */
export function hash01(i: number, seed = 1): number {
  let a = (Math.imul(i | 0, 0x9e3779b1) ^ Math.imul(seed | 0, 0x85ebca6b)) >>> 0;
  a = Math.imul(a ^ (a >>> 16), 0x7feb352d) >>> 0;
  a = Math.imul(a ^ (a >>> 15), 0x846ca68b) >>> 0;
  a = (a ^ (a >>> 16)) >>> 0;
  return a / 4294967296;
}

export interface Roadside {
  /** Hvor langt fra syklisten langs veien (m), positiv framover. */
  u: number;
  /** Fast tall 0–1 for størrelse og type. */
  r: number;
  key: number;
}

/**
 * Ting langs veien (trær bak muren) omtrent hver `spacing` meter, når syklisten har kommet `d` meter. Bare de som
 * ligger mellom `u0` og `u1` meter fra syklisten tas med. Plasseringen avhenger bare av indeksen, så et tre står fast
 * i verden og ruller forbi når d øker.
 */
export function roadsideItems(d: number, u0: number, u1: number, spacing: number, seed: number): Roadside[] {
  const out: Roadside[] = [];
  if (!(spacing > 0) || !Number.isFinite(d)) return out;
  const i0 = Math.floor((d + u0) / spacing) - 1;
  const i1 = Math.ceil((d + u1) / spacing) + 1;
  for (let i = i0; i <= i1; i++) {
    const pos = (i + 0.15 + 0.7 * hash01(i, seed)) * spacing;
    const u = pos - d;
    if (u >= u0 && u <= u1) out.push({ u, r: hash01(i, seed + 101), key: i });
  }
  return out;
}

/**
 * Plassen i panelet (figurens koordinater): stoppeklokka til venstre, tre linjer tekst og profilen av hele bakken
 * nederst. `f` er tekstskaleringen (useTextScale).
 */
export function hudLayout(hud: Box, f: number): {
  clock: { x: number; y: number; r: number };
  textX: number;
  valueX: number;
  rows: number[];
  profile: Box;
} {
  const pad = 12;
  const rowH = 22 * f;
  const r = Math.min(30, (hud.h - 2 * pad - 30) / 2.1);
  const clock = { x: hud.x + pad + r + 4, y: hud.y + pad + r + 10, r };
  const textX = clock.x + r + 18;
  const rows = [0, 1, 2].map((i) => hud.y + pad + 14 * f + i * rowH);
  const profileY = hud.y + pad + 14 * f + 2 * rowH + 14;
  const profile = { x: hud.x + pad, y: profileY, w: hud.w - 2 * pad, h: hud.y + hud.h - pad - profileY };
  return { clock, textX, valueX: hud.x + hud.w - pad, rows, profile };
}
