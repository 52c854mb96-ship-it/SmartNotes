/**
 * Utformingen av figuren i eksempeloppgaven «Akebrett ned bakken» (ren geometri uten React, så den kan testes):
 * hva figuren viser i hvert steg, hvor bakken, akeren og energipanelet står, og radene i energiregnskapet.
 *
 * Bakken er tegnet i riktig skala (vinkelen og forholdet mellom h, s og d stemmer), men akeren er tegnet to til tre
 * ganger større enn skalaen, ellers ville hun blitt en prikk i en 30 m lang bakke. Pilene for fart og krefter har
 * hver sin faste skala (px per m/s og px per N) i hele figuren.
 *
 * Utsnittet følger deloppgaven: bakken (a, b, c, e) eller flaten (d), og hele turen fra A til C når hele løsningen
 * vises. På PC står energipanelet oppe til høyre i himmelen, på mobil i en egen figur under scenen.
 */
import type { SledSolution, SledTask } from './model-eks-akebakke';

export const SCENE_W = 800;
/** Akebrettet er 0,8 m langt (som i scene-kit-et), og personen 1,75 m høy. */
export const SLED_LENGTH = 0.8;
export const PERSON_HEIGHT = 1.75;
/** Tyngdepunktet til akeren med brett over snøen (m), og toppen av hodet når hun sitter. */
export const COM_HEIGHT = 0.42;
export const RIDER_TOP = 0.98;
/**
 * Akeren på PC (px per m). Bakken har 17–23 px per m i utsnittene av bakken og flaten, så akeren er ca. to ganger
 * forstørret. I oversikten over hele turen har bakken 10–12 px per m, og akeren er mindre (ca. tre ganger).
 */
export const RIDER_PPM = 46;
export const RIDER_PPM_ALT = 32;
/** Fartspilene (px per m/s) og kraftpilene (px per N) på PC. På mobil ganges kraftpilene med kvadratroten av scene-skalaen. */
export const SPEED_PX = 7;
export const FORCE_PX = 1.3;

/** Hvor langt ned i bakken akeren står når kreftene i bakken tegnes (andel av s), litt under midten. */
export const MID_FRACTION = 0.56;

export type Spot = 'A' | 'mid' | 'B' | 'flat' | 'C' | 'Cest';
export type Camera = 'alt' | 'bakke' | 'flate';
export type DimState = 'off' | 'on' | 'strong';
export type LedgerB = 'off' | 'ideal' | 'unknown' | 'heat';

/** Hva figuren viser i ett steg. */
export interface FigureSpec {
  /** Hvor akeren er. */
  rider: Spot;
  /** Nedtonede akere der hun har vært. */
  ghosts: Spot[];
  /** Utsnittet på mobil (PC viser alltid hele turen). */
  camera: Camera;
  /** Fartspil og verdi på toppen. */
  v0: boolean;
  /** Fartspila i B: uten friksjon, målt (med fart uten friksjon stiplet), eller ingen. */
  speedB: 'off' | 'ideal' | 'measured' | 'measured-only';
  /** Kraftpiler midt i bakken: R (gjennomsnittet) eller R delt i μN og L. */
  slopeForces: 'off' | 'R' | 'split';
  /** Friksjonen og farten på flaten. */
  flatForces: boolean;
  /** Termisk energi langs sporet i bakken og på flaten. */
  heatSlope: boolean;
  heatFlat: boolean;
  /** Nullnivået (stiplet linje gjennom B). */
  zero: boolean;
  dims: { h: DimState; s: DimState; d: DimState; dEst: DimState };
  /** Vinkelen α ved B. */
  angle: boolean;
  /** Punktet C (der akeren stopper uten luftmotstand) er kjent. */
  pointC: boolean;
  /** Overslaget C′ med luftmotstand. */
  pointCest: boolean;
  /** Radene i energipanelet (null = ikke vist). */
  ledger: { A: boolean; B: LedgerB; C: boolean } | null;
}

const BASE: FigureSpec = {
  rider: 'A',
  ghosts: [],
  camera: 'bakke',
  v0: false,
  speedB: 'off',
  slopeForces: 'off',
  flatForces: false,
  heatSlope: false,
  heatFlat: false,
  zero: false,
  dims: { h: 'on', s: 'on', d: 'off', dEst: 'off' },
  angle: false,
  pointC: false,
  pointCest: false,
  ledger: null,
};

/** Antall steg i løsningen (a: 2, b: 2, c: 1, d: 2, e: 3). */
export const STEP_COUNT = 10;

/**
 * Figuren i hvert steg (1 … 10; 0 = oppgaveteksten). Figuren bygger seg opp: akeren flytter seg til punktet
 * deloppgaven handler om, pilene kommer når de blir regnet ut, og energipanelet fylles rad for rad.
 */
export function figureSpec(step: number, showAll: boolean): FigureSpec {
  if (showAll) {
    return {
      ...BASE,
      rider: 'C',
      ghosts: ['A', 'B'],
      camera: 'alt',
      v0: true,
      speedB: 'measured-only',
      heatSlope: true,
      heatFlat: true,
      zero: true,
      dims: { h: 'on', s: 'on', d: 'on', dEst: 'off' },
      pointC: true,
      ledger: { A: true, B: 'heat', C: true },
    };
  }
  const ledgerAB = { A: true, B: 'heat' as const, C: false };
  const ledgerAll = { A: true, B: 'heat' as const, C: true };
  switch (step) {
    case 1:
      return { ...BASE, v0: true, zero: true, dims: { ...BASE.dims, h: 'strong' }, ledger: { A: true, B: 'off', C: false } };
    case 2:
      return { ...BASE, rider: 'B', ghosts: ['A'], speedB: 'ideal', zero: true, ledger: { A: true, B: 'ideal', C: false } };
    case 3:
      return { ...BASE, rider: 'B', ghosts: ['A'], speedB: 'measured', zero: true, ledger: { A: true, B: 'unknown', C: false } };
    case 4:
      return { ...BASE, rider: 'B', ghosts: ['A'], speedB: 'measured', zero: true, heatSlope: true, ledger: ledgerAB };
    case 5:
      return { ...BASE, rider: 'mid', slopeForces: 'R', heatSlope: true, dims: { ...BASE.dims, s: 'strong' }, ledger: ledgerAB };
    case 6:
      return { ...BASE, rider: 'flat', ghosts: ['B'], camera: 'flate', flatForces: true, heatSlope: true, dims: { ...BASE.dims, h: 'off', s: 'off' }, ledger: ledgerAB };
    case 7:
      return {
        ...BASE,
        rider: 'C',
        ghosts: ['A', 'B'],
        camera: 'flate',
        heatSlope: true,
        heatFlat: true,
        dims: { h: 'off', s: 'off', d: 'strong', dEst: 'off' },
        pointC: true,
        ledger: ledgerAll,
      };
    case 8:
    case 9:
      return { ...BASE, rider: 'mid', slopeForces: 'split', heatSlope: true, angle: true, dims: { ...BASE.dims, h: 'on', s: 'on' }, pointC: true, ledger: ledgerAll };
    case 10:
      return {
        ...BASE,
        rider: 'Cest',
        ghosts: ['B', 'C'],
        camera: 'flate',
        heatSlope: true,
        heatFlat: true,
        dims: { h: 'off', s: 'off', d: 'off', dEst: 'strong' },
        pointC: true,
        pointCest: true,
        ledger: ledgerAll,
      };
    default:
      return BASE;
  }
}

/* ---------- Utformingen ---------- */

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface SceneLayout {
  narrow: boolean;
  camera: Camera;
  W: number;
  H: number;
  /** Bakken: figurenheter per meter. */
  ppm: number;
  /** Akeren: figurenheter per meter (forstørret). */
  rppm: number;
  /** Fartspilene (enheter per m/s) og kraftpilene (enheter per N). */
  kv: number;
  kF: number;
  /** Tekstskalaen (1 på PC, ca. 1,8 på mobil). */
  f: number;
  /** x (m, fra A og bortover) og høyde over flaten (m) til figurens koordinater. */
  X: (x: number) => number;
  Y: (h: number) => number;
  /** Flaten (nullnivået) og toppen av bakken. */
  groundY: number;
  topY: number;
  /** Horisonten bak flaten. */
  horizon: number;
  /** Vannrett lengde av bakken og punktene B, C og C′ (m fra A). */
  run: number;
  xB: number;
  xC: number;
  xCest: number;
  /** Energipanelet i himmelen (PC), ellers null. */
  panel: Box | null;
}

/** Høyden på energipanelet med tekstskalaen f (tre rader, tittel og fargeforklaring). */
export function ledgerHeight(f: number): number {
  return Math.round(34 * f + 3 * 32 * f + 26 * f + 6);
}

/** Bredden på energipanelet på PC. */
export const PANEL_W = 310;

/**
 * Utformingen av scenen for ett tallsett og ett utsnitt. `f` er tekstskalaen og `k` scene-skalaen (1 på PC, ca. 1,5
 * på mobil), som akeren og pilene ganges med.
 */
export function sceneLayout(task: SledTask, sol: SledSolution, opts: { narrow: boolean; camera: Camera; f: number; k: number }): SceneLayout {
  const { narrow, camera, f, k } = opts;
  const W = SCENE_W;
  const run = sol.run;
  const xC = run + sol.d;
  const xCest = run + sol.dEst;
  // Akeren er mindre i oversikten over hele turen, der bakken har halve skalaen.
  const rppm = (camera === 'alt' ? RIDER_PPM_ALT : RIDER_PPM) * k;
  const sled = SLED_LENGTH * rppm;
  // Synlig del av verden (m) og marger (figurenheter). Til venstre for A står h-målet og «nullnivå», og til høyre
  // for B er det plass til fartspila.
  const padHill = narrow ? 30 + 85 * f : 140;
  const kv = SPEED_PX;
  let x0m = 0;
  let x1m = xC;
  let padL = padHill;
  // Til høyre for C: nesa på brettet og skiltet «v = 0»
  let padR = Math.max(30 + 0.5 * sled, 60 * f);
  if (camera === 'bakke') {
    // Til høyre for B: akeren og fartspila uten friksjon med etiketten
    const needB = 1.11 * sled + 4 * f + sol.vIdeal * kv + 30 * f;
    padR = 16;
    x1m = run + needB / ((W - padL - padR - needB) / run);
  } else if (camera === 'flate') {
    x0m = run - 4;
    padL = 24;
  }
  const ppm = (W - padL - padR) / (x1m - x0m);
  // Over toppen: akeren, verdiskiltet og litt himmel. Under energipanelet (PC): akeren og skiltet på flaten.
  const headroom = RIDER_TOP * rppm + tagHeight(f) + 26 * f;
  const hillTop = camera === 'flate' ? (task.h * Math.max(0, run - x0m)) / run : task.h;
  const panelW = PANEL_W * f;
  const panelH = ledgerHeight(f);
  const flatClear = narrow ? 0 : 8 + panelH + headroom + 6;
  const groundY = Math.round(Math.max(hillTop * ppm + headroom + 10, flatClear, 150 * f));
  const H = Math.round(groundY + 50 * f);
  const X = (x: number) => padL + (x - x0m) * ppm;
  const Y = (h: number) => groundY - h * ppm;
  return {
    narrow,
    camera,
    W,
    H,
    ppm,
    rppm,
    kv,
    kF: FORCE_PX * Math.sqrt(k),
    f,
    X,
    Y,
    groundY,
    topY: Y(task.h),
    horizon: groundY - 2,
    run,
    xB: run,
    xC,
    xCest,
    panel: narrow ? null : { x: W - 8 - panelW, y: 8, w: panelW, h: panelH },
  };
}

/* ---------- Bakken ---------- */

/**
 * Overflaten (figurens koordinater): toppen, bakken med jevn helning og flaten, med avrundet overgang ved A og B
 * (radius `round` i figurenheter), fra x = −20 (eller lenger til venstre når toppen er utenfor utsnittet) til W + 20.
 */
export function terrainPoints(L: SceneLayout, h: number, round = 70): [number, number][] {
  const xA = L.X(0);
  const yA = L.Y(h);
  const xB = L.X(L.run);
  const yB = L.groundY;
  const ang = Math.atan2(yB - yA, xB - xA);
  const t = round * Math.tan(ang / 2);
  const pts: [number, number][] = [[Math.min(-20, xA - t - 20), yA]];
  // Toppen: bue fra (xA − t, yA) til (xA + t·ux, yA + t·uy). Sentrum under toppen.
  arc(pts, xA - t, yA + round, round, -Math.PI / 2, -Math.PI / 2 + ang);
  // Bunnen: bue fra (xB − t·ux, yB − t·uy) til (xB + t, yB). Sentrum over bunnen.
  arc(pts, xB + t, yB - round, round, Math.PI / 2 + ang, Math.PI / 2);
  pts.push([L.W + 20, yB]);
  return pts.map(([x, y]) => [Math.round(x * 10) / 10, Math.round(y * 10) / 10]);
}

/** Punkter langs en sirkelbue med sentrum (cx, cy) fra vinkelen a0 til a1 (radianer, med klokka i SVG). */
function arc(pts: [number, number][], cx: number, cy: number, r: number, a0: number, a1: number) {
  const n = 8;
  for (let i = 0; i <= n; i++) {
    const a = a0 + ((a1 - a0) * i) / n;
    pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
  }
}

/** Et sted på sporet: punktet på snøen, dreiningen (grader med klokka) og enhetsvektorene langs og ut fra sporet. */
export interface Frame {
  x: number;
  y: number;
  rotate: number;
  tx: number;
  ty: number;
  nx: number;
  ny: number;
}

/** Hvor akeren står i hvert punkt (ankerpunktet til akebrettet, midt under bunnen). */
export function spotFrame(L: SceneLayout, task: SledTask, sol: SledSolution, spot: Spot): Frame {
  const sled = SLED_LENGTH * L.rppm;
  const flat = (x: number): Frame => ({ x, y: L.groundY, rotate: 0, tx: 1, ty: 0, nx: 0, ny: -1 });
  switch (spot) {
    case 'A':
      return { ...flat(L.X(0) - 0.62 * sled), y: L.Y(task.h) };
    case 'mid': {
      const u = MID_FRACTION * task.s;
      const x = L.X(u * sol.cosA);
      const y = L.Y(task.h - u * sol.sinA);
      // Retningen langs bakken i figuren (samme skala vannrett og loddrett, så vinkelen er α)
      const a = Math.atan2(L.Y(0) - L.Y(task.h), L.X(sol.run) - L.X(0));
      return { x, y, rotate: (a * 180) / Math.PI, tx: Math.cos(a), ty: Math.sin(a), nx: Math.sin(a), ny: -Math.cos(a) };
    }
    case 'B':
      return flat(L.X(L.run) + 0.45 * sled);
    case 'flat':
      return flat(L.X(L.run + 0.42 * sol.d));
    case 'C':
      return flat(L.X(L.xC));
    case 'Cest':
      return flat(L.X(L.xCest));
  }
}

/** Et punkt `along` langs sporet og `up` ut fra det, fra punktet i rammen (figurens enheter). */
export function framePoint(fr: Frame, along: number, up: number): { x: number; y: number } {
  return { x: fr.x + fr.tx * along + fr.nx * up, y: fr.y + fr.ty * along + fr.ny * up };
}

/**
 * Farten (m/s) der akeren står i bakken (MID_FRACTION av s) med den gjennomsnittlige motkraften R: akselerasjonen er
 * da konstant, så v² øker jevnt med strekningen fra v₀² til v_B².
 */
export function speedMid(task: SledTask): number {
  return Math.sqrt(task.v0 * task.v0 + MID_FRACTION * (task.vB * task.vB - task.v0 * task.v0));
}

/** Farten (m/s) på flaten i avstanden x fra B, uten luftmotstand: v² = v_B² − 2μg · x. */
export function speedOnFlat(task: SledTask, sol: SledSolution, x: number): number {
  return Math.sqrt(Math.max(0, task.vB * task.vB - 2 * sol.aFlat * x));
}

/** Fartspila fra fronten av akeren, i hoftehøyde, langs sporet (figurens enheter). */
export function speedArrow(L: SceneLayout, fr: Frame, v: number): { x1: number; y1: number; x2: number; y2: number } {
  const sled = SLED_LENGTH * L.rppm;
  const p = framePoint(fr, 0.66 * sled + 4 * L.f, COM_HEIGHT * L.rppm);
  const len = v * L.kv;
  return { x1: p.x, y1: p.y, x2: p.x + fr.tx * len, y2: p.y + fr.ty * len };
}

/** Høyden på et verdiskilt (ValueTag med size 0,9) med tekstskalaen f. */
export function tagHeight(f: number): number {
  return 17 * f * 0.9 * 1.55;
}

/** Midten av verdiskiltet over hodet til akeren. */
export function tagCenter(L: SceneLayout, fr: Frame): { x: number; y: number } {
  const top = framePoint(fr, -0.05 * L.rppm, RIDER_TOP * L.rppm);
  return { x: top.x, y: Math.min(top.y, fr.y - RIDER_TOP * L.rppm) - 10 * L.f - tagHeight(L.f) / 2 };
}

/* ---------- Energipanelet ---------- */

export type LedgerKind = 'Ep' | 'Ek' | 'heat' | 'heatFlat' | 'unknown';

export interface LedgerSegment {
  kind: LedgerKind;
  /** Energien (J). */
  E: number;
}

export interface LedgerRow {
  id: 'A' | 'B' | 'C';
  /** Ordet etter bokstaven: «toppen», «nederst», «stopp». */
  label: string;
  segments: LedgerSegment[];
}

/**
 * Radene i energipanelet. Alle radene er like lange (E_A), fordi energien er bevart: den skifter bare form.
 *   A: E_p + E_k på toppen
 *   B: E_k uten friksjon, eller E_k med den målte farten + termisk energi (først et tomt felt med «?»)
 *   C: termisk energi fra flaten (der E_k var i B) + termisk energi fra bakken
 */
export function ledgerRows(sol: SledSolution, ledger: NonNullable<FigureSpec['ledger']>): LedgerRow[] {
  const rows: LedgerRow[] = [];
  if (ledger.A)
    rows.push({
      id: 'A',
      label: 'toppen',
      segments: [
        { kind: 'Ep', E: sol.EpA },
        { kind: 'Ek', E: sol.EkA },
      ],
    });
  if (ledger.B === 'ideal') rows.push({ id: 'B', label: 'nederst', segments: [{ kind: 'Ek', E: sol.EA }] });
  else if (ledger.B === 'unknown' || ledger.B === 'heat')
    rows.push({
      id: 'B',
      label: 'nederst',
      segments: [
        { kind: 'Ek', E: sol.EkB },
        { kind: ledger.B === 'heat' ? 'heat' : 'unknown', E: sol.Q },
      ],
    });
  if (ledger.C)
    rows.push({
      id: 'C',
      label: 'stopp',
      // Den kinetiske energien i B (venstre del av raden over) er blitt termisk energi på flaten
      segments: [
        { kind: 'heatFlat', E: sol.EkB },
        { kind: 'heat', E: sol.Q },
      ],
    });
  return rows;
}

/* ---------- Kontroll av plassen (brukes i testene) ---------- */

/** Omtrentlig boks rundt akeren med brett (figurens enheter), også når hun står på skrå. */
export function riderBox(L: SceneLayout, fr: Frame): Box {
  const sled = SLED_LENGTH * L.rppm;
  const pts = [
    framePoint(fr, -0.4 * sled, 0),
    framePoint(fr, 0.64 * sled, 0),
    framePoint(fr, -0.4 * sled, RIDER_TOP * L.rppm),
    framePoint(fr, 0.64 * sled, RIDER_TOP * L.rppm),
  ];
  const xs = pts.map((p) => p.x);
  const ys = pts.map((p) => p.y);
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y };
}

/** Boksen til et verdiskilt over akeren (samme mål som ValueTag med size 0,9). */
export function tagBox(L: SceneLayout, fr: Frame, text: string): Box {
  const c = tagCenter(L, fr);
  const fs = 17 * L.f * 0.9;
  const w = Math.max(fs * 1.6, text.length * fs * 0.6 + 16 * L.f);
  const h = tagHeight(L.f);
  return { x: c.x - w / 2, y: c.y - h / 2, w, h };
}

/** Om to bokser overlapper (med en luft `pad` rundt). */
export function boxesOverlap(a: Box, b: Box, pad = 0): boolean {
  return a.x < b.x + b.w + pad && b.x < a.x + a.w + pad && a.y < b.y + b.h + pad && b.y < a.y + a.h + pad;
}
