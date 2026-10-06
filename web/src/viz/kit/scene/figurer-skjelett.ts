/**
 * Skjelettet til `Person` i familien «figurer» (ren geometri uten React, så den kan testes): leddvinkler,
 * positurer, invers kinematikk for hender og føtter, flate såler på bakken, ankerpunkt og tyngdepunkt.
 * Tegningen er i figurer.tsx, og de offentlige navnene (PersonPose, Leddvinkler, POSER, personPunkter)
 * eksporteres derfra.
 *
 * Alle mål regnes i en figur som er 100 enheter høy (fra sålene til hodet, ca. 1,75 m: 1 enhet ≈ 1,75 cm).
 * Koordinater: x fram (mot ansiktet), y ned, hofteleddet i origo.
 */
import type { PaintName } from './palette';

export type Pt = { x: number; y: number };

export const D2R = Math.PI / 180;
export const TAU = Math.PI * 2;

/* ================================================================================================
 * Typer og positurer
 * ============================================================================================== */

/**
 * Positurene til `Person`:
 * - `staa` står rett opp, `armer-opp` står med armene rett opp (strekker seg, holder i håndtakene på en fallskjerm).
 * - `gaa` og `loepe` er et skritt i gang/løp. Med `fase` (0–1) går de gjennom hele skrittsyklusen.
 * - `dra` lener seg bakover og drar i et tau med begge hender (se `tauvinkel`), `skyve` lener seg forover med
 *   armene strake fram og håndflatene mot noe.
 * - `sitte` sitter på en stol (ankerpunktet er under setet), `huke` sitter på huk.
 * - `falle` strekker armer og bein ut (fritt fall, strikkhopp – kan dreies opp ned med `rotate`).
 * - `ski` er utforstilling med ski og staver, `sykle` sitter med hendene på styret og føttene på pedalene.
 * - `kaste` har armen bakover før et kast (ballen er i `hoyreHand`).
 */
export type PersonPose = 'staa' | 'gaa' | 'loepe' | 'dra' | 'skyve' | 'sitte' | 'huke' | 'armer-opp' | 'falle' | 'ski' | 'sykle' | 'kaste';

/**
 * Leddvinklene i skjelettet, i grader. Personen ser mot høyre; «hoyre…» er lemmene nærmest betrakteren.
 *   <Person pose="dra" ledd={{ rygg: POSER.dra.rygg - 10 }} />          // lener seg mer bakover
 *   <Person pose="staa" ledd={{ hoyreSkulder: 90, hoyreAlbue: 0 }} />   // peker rett fram
 * Gi bare leddene du vil endre. Ankler som ikke er gitt, legges flatt på bakken av seg selv, og hofte og kne på
 * et bein som står på bakken, rettes litt så begge føttene når bakken (med mindre du gir dem her).
 */
export interface Leddvinkler {
  /** Overkroppens helning fra loddrett. Positiv = forover (mot ansiktet), negativ = bakover. */
  rygg: number;
  /** Hodets bøy i forhold til overkroppen. Positiv = haka ned, negativ = hodet bakover (ser fram når man lener seg forover). */
  nakke: number;
  /** Overarmen mot overkroppen: 0 = rett ned langs siden, 90 = rett fram, 180 = rett opp, negativ = bakover. */
  venstreSkulder: number;
  hoyreSkulder: number;
  /**
   * Bøy i albuen: 0 = strak arm, positiv = underarmen dreies videre fram og opp (90 = rett vinkel), negativ = motsatt
   * vei. Skjelettet ligger i bildeplanet, så en arm som egentlig er dreid ut til siden (kastearmen i 'kaste') får negativ albue.
   */
  venstreAlbue: number;
  hoyreAlbue: number;
  /** Låret mot overkroppen: 0 = i forlengelsen av ryggen, 90 = rett fram (sittende), negativ = bakover. */
  venstreHofte: number;
  hoyreHofte: number;
  /** Bøy i kneet: 0 = strakt bein, 90 = rett vinkel (leggen bakover). */
  venstreKne: number;
  hoyreKne: number;
  /**
   * Foten mot leggen: 0 = rett vinkel, positiv = tærne ned (på tå), negativ = tærne opp. Står personen på bakken,
   * regnes ankelen ut av seg selv så sålen ligger flatt, med mindre du gir den her.
   */
  venstreAnkel: number;
  hoyreAnkel: number;
}

export const KEYS: (keyof Leddvinkler)[] = [
  'rygg',
  'nakke',
  'venstreSkulder',
  'hoyreSkulder',
  'venstreAlbue',
  'hoyreAlbue',
  'venstreHofte',
  'hoyreHofte',
  'venstreKne',
  'hoyreKne',
  'venstreAnkel',
  'hoyreAnkel',
];

export type Side = 'venstre' | 'hoyre';
export const SIDES: Side[] = ['venstre', 'hoyre'];
export type HandMode = 'aapen' | 'knyttet' | 'flat';

/** Mål på kroppen i en figur som er 100 enheter høy (ca. 1,75 m: 1 enhet ≈ 1,75 cm). */
export const THIGH = 24.5;
export const SHIN = 24;
export const UPPER = 18.5;
export const FORE = 14.5;
/** Skulderleddet og nakkeroten i overkroppens koordinater (fram, ned) fra hofteleddet. */
export const SHOULDER_J: Pt = { x: 0.4, y: -27.2 };
export const NECK_BASE: Pt = { x: -0.8, y: -30.6 };
export const NECK_LEN = 4.2;
/** Sittebeina (kontakten med setet) fra hofteleddet. */
export const SEAT: Pt = { x: -1, y: 5.5 };
/** Foten i fotens koordinater (fram, ned) fra ankelen. */
export const SOLE = 4.2;
export const HEEL: Pt = { x: -4.4, y: SOLE };
export const BALL: Pt = { x: 7.4, y: SOLE };
export const TOE: Pt = { x: 10.8, y: SOLE - 0.5 };
export const SOLE_MID: Pt = { x: 3, y: SOLE };
/** Skiene: høyde fra sålen til undersiden av skia, og hvor de begynner og slutter langs foten. */
export const SKI_DROP = 2.6;
export const SKI_BACK = -42;
export const SKI_FRONT = 47;
/**
 * Standardsykkelen for `sykle` uten `fest` (fra sittebeina): kranklager, pedalarm og styre. Samme mål som `Sykkel`
 * i kjoretoy for en rytter på 1,75 m (håndtakene 61,7 cm fram og 5,1 cm over setet).
 */
export const BIKE_CRANK: Pt = { x: 13.4, y: 38 };
export const BIKE_CRANK_LEN = 10;
export const BIKE_BAR: Pt = { x: 35.3, y: -2.9 };
/** Mål for hodet i hodets koordinater (fram, ned) fra toppen av nakken: midten, øyet og nesetippen. */
export const HEAD_MID: Pt = { x: 0.6, y: -6.2 };
export const EYE_POS: Pt = { x: 4.35, y: -6.5 };
export const NOSE_TIP: Pt = { x: 7.5, y: -3.6 };
/** Tykkelsen på overarmen ved skulderen og albuen (radius). */
export const UPPER_R: [number, number] = [3.9, 3.15];


/** Hvordan hendene holdes i hver positur: [venstre, høyre]. */
const HANDS: Record<PersonPose, [HandMode, HandMode]> = {
  staa: ['aapen', 'aapen'],
  gaa: ['aapen', 'aapen'],
  loepe: ['knyttet', 'knyttet'],
  dra: ['knyttet', 'knyttet'],
  skyve: ['flat', 'flat'],
  sitte: ['aapen', 'aapen'],
  huke: ['aapen', 'aapen'],
  'armer-opp': ['knyttet', 'knyttet'],
  falle: ['aapen', 'aapen'],
  ski: ['knyttet', 'knyttet'],
  sykle: ['knyttet', 'knyttet'],
  kaste: ['aapen', 'knyttet'],
};

/** Hvor hånda griper fra håndleddet, langs underarmen. */
const HAND_REACH: Record<HandMode, number> = { aapen: 3.8, knyttet: 2.3, flat: 0 };

/**
 * Føtter som står på bakken: sålen legges flatt (ankelen regnes ut), med en ekstra vinkel for å stå på tå.
 * [venstre, høyre]; null = foten er fri.
 */
export const PLANTED: Record<PersonPose, [number | null, number | null]> = {
  staa: [0, 0],
  gaa: [null, null],
  loepe: [null, null],
  dra: [0, 0],
  skyve: [0, 32],
  sitte: [0, 0],
  huke: [0, 0],
  'armer-opp': [0, 0],
  falle: [null, null],
  ski: [0, 0],
  sykle: [null, null],
  kaste: [0, 14],
};

/** Positurer med ankerpunktet under setet. */
export const SEATED = (pose: PersonPose) => pose === 'sitte' || pose === 'sykle';
/** Positurer med ankerpunktet rett under hofta (så figuren står stille når `fase` endres). */
export const GAIT = (pose: PersonPose): pose is 'gaa' | 'loepe' => pose === 'gaa' || pose === 'loepe';

/* ================================================================================================
 * Geometri
 * ============================================================================================== */

export function num(v: unknown, fallback: number): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : fallback;
}
export function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}
/** Retning med vinkel φ målt fra rett ned, positiv mot fronten (+x): 0 = ned, 90 = fram, 180 = opp. */
export function dir(phi: number): Pt {
  return { x: Math.sin(phi * D2R), y: Math.cos(phi * D2R) };
}
export function add(a: Pt, b: Pt, s = 1): Pt {
  return { x: a.x + b.x * s, y: a.y + b.y * s };
}
export function sub(a: Pt, b: Pt): Pt {
  return { x: a.x - b.x, y: a.y - b.y };
}
function dot(a: Pt, b: Pt): number {
  return a.x * b.x + a.y * b.y;
}
function angleOf(from: Pt, to: Pt): number {
  return Math.atan2(to.x - from.x, to.y - from.y) / D2R;
}
/** Lokalt koordinatsystem (a fram, b ned) dreid `deg` grader med klokka og flyttet til `o`. */
export function frame(o: Pt, deg: number): (a: number, b: number) => Pt {
  const c = Math.cos(deg * D2R);
  const s = Math.sin(deg * D2R);
  return (a, b) => ({ x: o.x + a * c - b * s, y: o.y + a * s + b * c });
}
function wrap01(t: number): number {
  return t - Math.floor(t);
}
export const r2 = (v: number) => Math.round(v * 100) / 100;

/** Punktet P (i fotens koordinater) dreid θ grader (positiv = tærne ned). */
function rot(th: number, p: Pt): Pt {
  const c = Math.cos(th * D2R);
  const s = Math.sin(th * D2R);
  return { x: p.x * c - p.y * s, y: p.x * s + p.y * c };
}

/** Kubisk Hermite-kurve gjennom nøkkelpunkter (s, verdi) med gitte stigninger i endene (Catmull-Rom inni). */
function hermite(keys: [number, number][], m0: number, m1: number, s: number): number {
  const n = keys.length;
  const slope = (i: number) =>
    i === 0 ? m0 : i === n - 1 ? m1 : (keys[i + 1]![1] - keys[i - 1]![1]) / (keys[i + 1]![0] - keys[i - 1]![0]);
  let i = 0;
  while (i < n - 2 && s > keys[i + 1]![0]) i++;
  const [s0, p0] = keys[i]!;
  const [s1, p1] = keys[i + 1]!;
  const h = s1 - s0;
  const u = clamp((s - s0) / h, 0, 1);
  const u2 = u * u;
  const u3 = u2 * u;
  return (2 * u3 - 3 * u2 + 1) * p0 + (u3 - 2 * u2 + u) * h * slope(i) + (-2 * u3 + 3 * u2) * p1 + (u3 - u2) * h * slope(i + 1);
}

/** Foten ruller over hælen, fotballen og tåa (en stiv sko): vinkelen der tåa også når bakken. */
const TH_TOE = Math.atan2(BALL.y - TOE.y, TOE.x - BALL.x) / D2R;
/** Hvilket punkt foten står på ved vinkelen θ, og hvor langt fra hælens punkt på bakken det ligger. */
function rollPivot(th: number): { p: Pt; g: number } {
  if (th < 0) return { p: HEEL, g: 0 };
  if (th <= TH_TOE) return { p: BALL, g: BALL.x - HEEL.x };
  return { p: TOE, g: BALL.x - HEEL.x + Math.hypot(TOE.x - BALL.x, TOE.y - BALL.y) };
}

interface GaitModel {
  /** Ankelen i ståfasen (lokal tid x i [0, beta]): u fram fra hofta, c over bakken, og fotens vinkel mot bakken. */
  stance: (x: number) => { u: number; c: number; th: number };
  /** Dybden fra hofta ned til bakken ved fase t, og hvor fort den endrer seg (per syklus). */
  H: (t: number) => number;
  dH: (t: number) => number;
  /** Gjennomsnittlig dybde (referanse for svingfasen). */
  Hmean: number;
}

const GAIT_N = 360;
const gaitModels: Partial<Record<'gaa' | 'loepe', GaitModel>> = {};

/**
 * Modellen for gange eller løp (regnes én gang): foten i ståfasen er låst til bakken mens bakken glir bakover med
 * S per syklus, og hofta ligger så høyt beina rekker. Høyden glattes (nedre omhylling av parabler), så hofta ikke
 * hopper når en fot slipper bakken: da bøyer heller knærne seg litt, som i ekte gange.
 */
function gaitModel(kind: 'gaa' | 'loepe'): GaitModel {
  const cached = gaitModels[kind];
  if (cached) return cached;
  const sp = GAIT_SPEC[kind];
  const { S, beta } = sp;
  const a = sp.t1 * beta;
  const b = sp.t2 * beta;
  const rel = (x: number) => {
    const th = x < a ? sp.thHs * (1 - x / a) ** 2 : x > b ? sp.thTo * ((x - b) / (beta - b)) ** 2 : 0;
    const { p, g } = rollPivot(th);
    const rp = rot(th, p);
    return { u: -S * x + g - rp.x, c: rp.y, th };
  };
  // Midten av ståfasen ligger ved `bias` (gange: symmetrisk om hofta i dobbeltstøtten).
  const X0 = kind === 'gaa' ? -(rel(0).u + rel(0.5).u) / 2 : sp.bias - (rel(0).u + rel(beta).u) / 2;
  const stance = (x: number) => {
    const r = rel(x);
    return { u: X0 + r.u, c: r.c, th: r.th };
  };
  const reach = (x: number) => {
    const f = stance(x);
    const L = LEG_STANCE * (1 - sp.comp * Math.sin((Math.PI * x) / beta));
    return f.c + Math.sqrt(Math.max(0, L * L - f.u * f.u));
  };
  const raw = new Float64Array(GAIT_N);
  for (let i = 0; i < GAIT_N; i++) {
    const t = i / GAIT_N;
    let H = Infinity;
    for (const x of [t, wrap01(t + 0.5)]) if (x < beta) H = Math.min(H, reach(x));
    if (H === Infinity) {
      // Svev (løp): fra der den ene foten slipper til den andre lander, med en liten bue.
      const s = ((t % 0.5) - beta) / (0.5 - beta);
      H = reach(beta) + (reach(0) - reach(beta)) * s + sp.hop * 4 * s * (1 - s);
    }
    raw[i] = H;
  }
  const table = new Float64Array(GAIT_N);
  let sum = 0;
  for (let i = 0; i < GAIT_N; i++) {
    let H = Infinity;
    for (let jx = 0; jx < GAIT_N; jx++) {
      const d = Math.abs(i - jx) / GAIT_N;
      const dd = Math.min(d, 1 - d);
      H = Math.min(H, raw[jx]! + sp.smooth * dd * dd);
    }
    table[i] = H;
    sum += H;
  }
  const H = (t: number) => {
    const q = wrap01(t) * GAIT_N;
    const i = Math.floor(q);
    const f = q - i;
    return table[i % GAIT_N]! * (1 - f) + table[(i + 1) % GAIT_N]! * f;
  };
  const model: GaitModel = { stance, H, dH: (t) => (H(t + 0.002) - H(t - 0.002)) / 0.004, Hmean: sum / GAIT_N };
  gaitModels[kind] = model;
  return model;
}

/**
 * Gange og løp ved fase t (0–1): 0 = den nære hælen treffer bakken, det bortre beinet er en halv syklus etter.
 * Foten i ståfasen er låst til bakken (ruller på hælen, står flatt, ruller over fotballen og tåa), så føttene ikke
 * glir når personen flyttes S · size / 100 per syklus. Beina regnes ut med invers kinematikk, og hofta går opp og
 * ned av seg selv. Returnerer leddvinklene og dybden H fra hofta ned til bakken (langs normalen til skråningen).
 */
function gaitPose(kind: 'gaa' | 'loepe', fase: number, slope: number, ryggIn?: number): { j: Leddvinkler; H: number } {
  const sp = GAIT_SPEC[kind];
  const rygg = ryggIn ?? sp.rygg;
  const m = gaitModel(kind);
  const { S, beta } = sp;
  const t = wrap01(num(fase, 0));
  const H = m.H(t);
  const sr = slope * D2R;
  const T = { x: Math.cos(sr), y: -Math.sin(sr) };
  const N = { x: Math.sin(sr), y: Math.cos(sr) };
  const eps = 1e-3;
  const k = 1 - beta;

  const leg = (x: number, tNow: number) => {
    let u: number;
    let v: number;
    let th: number;
    if (x < beta) {
      const f = m.stance(x);
      u = f.u;
      v = H - f.c;
      th = f.th;
    } else {
      // Svingfasen i hoftas koordinater: fra tåa slipper til hælen treffer, med samme fart som bakken i endene.
      const s = (x - beta) / k;
      const tTo = tNow - (x - beta);
      const tHs = tTo + k;
      const to = m.stance(beta);
      const toPrev = m.stance(beta - eps);
      const hs = m.stance(0);
      const ends = (i: 1 | 2 | 3, v0: number, v1: number): [number, number][] => [[0, v0], ...sp.keys.map((q) => [q[0], i === 2 ? m.Hmean - q[2] : q[i]] as [number, number]), [1, v1]];
      u = hermite(ends(1, to.u, hs.u), ((to.u - toPrev.u) / eps) * k, -S * k, s);
      v = hermite(ends(2, m.H(tTo) - to.c, m.H(tHs) - hs.c), (m.dH(tTo) - (to.c - toPrev.c) / eps) * k, m.dH(tHs) * k, s);
      th = hermite(ends(3, to.th, sp.thHs), ((to.th - toPrev.th) / eps) * k, 0, s);
      // Foten går aldri gjennom bakken.
      const low = Math.max(rot(th, HEEL).y, rot(th, BALL).y, rot(th, TOE).y);
      v = Math.min(v, H - low - 0.8 * Math.sin(Math.PI * s));
    }
    const ankle = add({ x: T.x * u, y: T.y * u }, N, v);
    const [pt, ps] = ik({ x: 0, y: 0 }, ankle, THIGH, SHIN, 1);
    return { hofte: pt + rygg, kne: pt - ps, ankel: th - slope + ps };
  };
  const walk = kind === 'gaa';
  const arm = (x: number) =>
    walk
      ? { skulder: 4 - 17 * Math.cos(TAU * x), albue: 14 + 14 * Math.max(0, -Math.cos(TAU * x)) }
      : { skulder: 8 - 36 * Math.cos(TAU * (x - 0.86)), albue: 86 + 12 * Math.max(0, -Math.cos(TAU * (x - 0.86))) };
  const u = wrap01(t + 0.5);
  const nl = leg(t, t);
  const fl = leg(u, t);
  const na = arm(t);
  const fa = arm(u);
  return {
    H,
    j: {
      rygg,
      nakke: sp.nakke,
      venstreSkulder: fa.skulder,
      hoyreSkulder: na.skulder,
      venstreAlbue: fa.albue,
      hoyreAlbue: na.albue,
      venstreHofte: fl.hofte,
      hoyreHofte: nl.hofte,
      venstreKne: fl.kne,
      hoyreKne: nl.kne,
      venstreAnkel: fl.ankel,
      hoyreAnkel: nl.ankel,
    },
  };
}

// Beina står symmetrisk, så begge sålene når bakken uten at knærne må bøyes.
const STAND = { venstreHofte: 6, hoyreHofte: -4, venstreKne: 2, hoyreKne: 2, venstreAnkel: 0, hoyreAnkel: 0 };

interface GaitSpec {
  /** Lengden på én syklus (to skritt) i personens enheter. */
  S: number;
  /** Andelen av syklusen hver fot står på bakken. */
  beta: number;
  /** Fotens vinkel mot bakken når hælen treffer (negativ = tærne opp) og når tærne slipper. */
  thHs: number;
  thTo: number;
  /** Hælen ruller til foten ligger flatt innen t1 · beta, og hælen løftes fra t2 · beta. */
  t1: number;
  t2: number;
  /** Hvor mye beinet i ståfasen bøyes midt i steget (løp), og hvor mye hofta løftes i svevet. */
  comp: number;
  hop: number;
  /** Hvor midten av ståfasen ligger fra hofta (negativ = bak). */
  bias: number;
  /** Hvor mye hoftehøyden glattes (krumningen på parablene, enheter per syklus²). */
  smooth: number;
  /** Svingfasen: [s, ankelen fram fra hofta, ankelen over bakken, fotens vinkel mot bakken] for s mellom 0 og 1. */
  keys: [number, number, number, number][];
  rygg: number;
  nakke: number;
}

/**
 * Lengden på én syklus (to skritt) som andel av høyden: gange 0,8 (ca. 1,4 m for en person på 1,75 m) og løp 1,5
 * (ca. 2,6 m, med svev mellom stegene). Flytt personen GAIT_STRIDE · size per syklus, så glir ikke føttene.
 */
export const GAIT_STRIDE = { gaa: 0.8, loepe: 1.5 } as const;

const GAIT_SPEC: Record<'gaa' | 'loepe', GaitSpec> = {
  gaa: {
    S: 100 * GAIT_STRIDE.gaa,
    beta: 0.6,
    thHs: -16,
    thTo: 36,
    t1: 0.14,
    t2: 0.6,
    comp: 0,
    hop: 0,
    bias: 0,
    smooth: 500,
    keys: [
      [0.3, -12, 9, 14],
      [0.62, 6, 6.4, -4],
    ],
    rygg: 3,
    nakke: -3,
  },
  loepe: {
    S: 100 * GAIT_STRIDE.loepe,
    beta: 0.3,
    thHs: -6,
    thTo: 48,
    t1: 0.12,
    t2: 0.4,
    comp: 0.06,
    hop: 1.6,
    bias: -6,
    smooth: 300,
    keys: [
      [0.3, -15, 23, 92],
      [0.68, 12, 15, 26],
    ],
    rygg: 11,
    nakke: -9,
  },
};
/** Fasen som brukes når `fase` ikke er gitt: et skritt med begge føttene i bakken. */
const GAIT_REST: Record<'gaa' | 'loepe', number> = { gaa: 0.04, loepe: 0.8 };
/** Beinets lengde i ståfasen (et lite bøyd kne, ikke låst). */
const LEG_STANCE = (THIGH + SHIN) * 0.998;

/** Grunnvinklene før mål og flate såler er regnet inn (se POSER for de ferdige). */
const RAW: Record<PersonPose, Leddvinkler> = {
  staa: { rygg: 0, nakke: 0, venstreSkulder: 6, hoyreSkulder: -4, venstreAlbue: 10, hoyreAlbue: 12, ...STAND },
  gaa: gaitPose('gaa', GAIT_REST.gaa, 0).j,
  loepe: gaitPose('loepe', GAIT_REST.loepe, 0).j,
  dra: {
    rygg: -26,
    nakke: 16,
    venstreSkulder: 40,
    hoyreSkulder: 52,
    venstreAlbue: 30,
    hoyreAlbue: 10,
    venstreHofte: -10,
    hoyreHofte: -1,
    venstreKne: 47,
    hoyreKne: 4,
    venstreAnkel: 0,
    hoyreAnkel: 0,
  },
  skyve: {
    rygg: 38,
    nakke: -32,
    venstreSkulder: 120,
    hoyreSkulder: 125,
    venstreAlbue: 15,
    hoyreAlbue: 10,
    venstreHofte: 64,
    hoyreHofte: 14,
    venstreKne: 52,
    hoyreKne: 4,
    venstreAnkel: 0,
    hoyreAnkel: 0,
  },
  sitte: {
    rygg: -3,
    nakke: 3,
    venstreSkulder: 26,
    hoyreSkulder: 20,
    venstreAlbue: 62,
    hoyreAlbue: 58,
    venstreHofte: 86,
    hoyreHofte: 92,
    venstreKne: 82,
    hoyreKne: 90,
    venstreAnkel: 0,
    hoyreAnkel: 0,
  },
  huke: {
    rygg: 34,
    nakke: -22,
    venstreSkulder: 62,
    hoyreSkulder: 52,
    venstreAlbue: 34,
    hoyreAlbue: 30,
    venstreHofte: 122,
    hoyreHofte: 128,
    venstreKne: 120,
    hoyreKne: 128,
    venstreAnkel: 0,
    hoyreAnkel: 0,
  },
  // Den nære armen litt bak øret, så ansiktsprofilen alltid synes foran den.
  'armer-opp': { rygg: 0, nakke: 2, venstreSkulder: 174, hoyreSkulder: 196, venstreAlbue: 12, hoyreAlbue: 4, ...STAND },
  falle: {
    rygg: -12,
    nakke: -28,
    venstreSkulder: 142,
    hoyreSkulder: 154,
    venstreAlbue: 50,
    hoyreAlbue: 60,
    venstreHofte: 6,
    hoyreHofte: -6,
    venstreKne: 58,
    hoyreKne: 70,
    venstreAnkel: 34,
    hoyreAnkel: 28,
  },
  ski: {
    rygg: 40,
    nakke: -36,
    venstreSkulder: 94,
    hoyreSkulder: 100,
    venstreAlbue: 44,
    hoyreAlbue: 38,
    venstreHofte: 88,
    hoyreHofte: 92,
    venstreKne: 70,
    hoyreKne: 74,
    venstreAnkel: 0,
    hoyreAnkel: 0,
  },
  sykle: {
    rygg: 36,
    nakke: -30,
    venstreSkulder: 75,
    hoyreSkulder: 75,
    venstreAlbue: 30,
    hoyreAlbue: 30,
    venstreHofte: 80,
    hoyreHofte: 80,
    venstreKne: 70,
    hoyreKne: 70,
    venstreAnkel: 10,
    hoyreAnkel: 10,
  },
  kaste: {
    rygg: -8,
    nakke: 8,
    venstreSkulder: 82,
    hoyreSkulder: -112,
    venstreAlbue: 14,
    hoyreAlbue: -72,
    venstreHofte: 24,
    hoyreHofte: -20,
    venstreKne: 8,
    hoyreKne: 18,
    venstreAnkel: 0,
    hoyreAnkel: 0,
  },
};

/** Totrinns invers kinematikk: vinklene (φ) for to ledd fra `from` mot `to`. bend +1 bøyer leddet fram (kne), −1 bakover (albue). */
function ik(from: Pt, to: Pt, a: number, b: number, bend: 1 | -1): [number, number] {
  const base = angleOf(from, to);
  const d = clamp(Math.hypot(to.x - from.x, to.y - from.y), Math.abs(a - b) + 0.01, a + b - 0.01);
  const cosA = clamp((a * a + d * d - b * b) / (2 * a * d), -1, 1);
  const phi1 = base + (bend * Math.acos(cosA)) / D2R;
  const mid = add(from, dir(phi1), a);
  return [phi1, angleOf(mid, add(from, dir(base), d))];
}

/** Håndas kontaktpunkt for en flat hånd (håndflata vender fram, fingrene opp) fra håndleddet. */
function flatHandOffset(phiFore: number): Pt {
  const up = dir(phiFore + 80);
  const fwd = dir(phiFore - 10);
  return { x: 3.2 * up.x + 2.2 * fwd.x, y: 3.2 * up.y + 2.2 * fwd.y };
}

export interface Arm {
  s: Pt;
  e: Pt;
  w: Pt;
  phiU: number;
  phiF: number;
  mode: HandMode;
  /** Gripepunktet (midt i hånda, eller håndflata for en flat hånd). */
  grip: Pt;
}
export interface Leg {
  k: Pt;
  a: Pt;
  phiT: number;
  phiS: number;
  phiFoot: number;
  foot: (a: number, b: number) => Pt;
  sole: Pt;
}
export interface Skeleton {
  j: Leddvinkler;
  trunk: (a: number, b: number) => Pt;
  head: (a: number, b: number) => Pt;
  neckBase: Pt;
  pivot: Pt;
  shoulder: Pt;
  arms: Record<Side, Arm>;
  legs: Record<Side, Leg>;
  /** Punkter som kan berøre bakken (såler, eller undersiden av skiene): [hæl, fotball, tå] eller [skihale, skitupp] per side. */
  ground: Pt[];
  /** Kontaktpunktet mot bakken for hver fot som står på bakken (det laveste punktet på sålen eller skia). */
  contact: Partial<Record<Side, Pt>>;
  anchor: Pt;
  com: Pt;
  ski: boolean;
  /** Bakkelinjas retning (fram langs skråningen) og normal (ned i bakken). */
  slopeT: Pt;
  slopeN: Pt;
}

/**
 * Peker armen opp (armer opp, henger i en stang, fritt fall)? Da tegnes den nære armen bak hodet, så ansiktsprofilen
 * alltid synes, også når hendene er festet rett over hodet.
 */
export function armRaised(a: Arm): boolean {
  const phi = ((((a.phiU + 180) % 360) + 360) % 360) - 180;
  return Math.abs(phi) > 140;
}

/** Feste for hender og føtter, i figurens koordinater (samme system som x og y). */
export interface PersonFeste {
  venstreHand?: Pt;
  hoyreHand?: Pt;
  /** Føttene kan bare festes når personen sitter (`sitte`, `sykle`): punktet er under fotballen (pedalen). */
  venstreFot?: Pt;
  hoyreFot?: Pt;
}

export type Anker = 'bakke' | 'tyngdepunkt';

/** Plassering og valg som bestemmer formen til personen (de samme props som på Person). */
export interface PersonPlass {
  x?: number;
  y?: number;
  rotate?: number;
  flip?: boolean;
  anker?: Anker;
  fase?: number;
  tauvinkel?: number;
  fest?: PersonFeste;
  skraaning?: number;
  /** For 'ski': `false` = uten ski (ankerpunktet er da under sålene), ellers med ski (skifargen spiller ingen rolle her). */
  ski?: PaintName | string | boolean;
}

function buildArm(shoulder: Pt, rygg: number, skulder: number, albue: number, mode: HandMode): Arm {
  const phiU = -rygg + skulder;
  const phiF = phiU + albue;
  const e = add(shoulder, dir(phiU), UPPER);
  const w = add(e, dir(phiF), FORE);
  const grip = mode === 'flat' ? add(w, flatHandOffset(phiF)) : add(w, dir(phiF), HAND_REACH[mode]);
  return { s: shoulder, e, w, phiU, phiF, mode, grip };
}

function buildLeg(rygg: number, hofte: number, kne: number, ankel: number): Leg {
  const phiT = -rygg + hofte;
  const phiS = phiT - kne;
  const phiFoot = phiS + 90 - ankel;
  const k = dir(phiT);
  const kk = { x: k.x * THIGH, y: k.y * THIGH };
  const a = add(kk, dir(phiS), SHIN);
  const foot = frame(a, 90 - phiFoot);
  return { k: kk, a, phiT, phiS, phiFoot, foot, sole: foot(SOLE_MID.x, SOLE_MID.y) };
}

/** Gjør om et punkt i figuren til personens egne koordinater (hofteleddet i origo) når ankerpunktet er kjent. */
function toLocal(p: Pt, o: PersonPlass, k: number, anchor: Pt): Pt {
  const dx = p.x - num(o.x, 0);
  const dy = p.y - num(o.y, 0);
  const r = num(o.rotate, 0) * D2R;
  const c = Math.cos(r);
  const s = Math.sin(r);
  const qx = dx * c + dy * s;
  const qy = -dx * s + dy * c;
  return { x: (qx / k) * (o.flip ? -1 : 1) + anchor.x, y: qy / k + anchor.y };
}

/** Fra personens koordinater til figurens (motsatt av toLocal). */
export function toFigure(p: Pt, o: PersonPlass, k: number, anchor: Pt): Pt {
  const lx = (p.x - anchor.x) * k * (o.flip ? -1 : 1);
  const ly = (p.y - anchor.y) * k;
  const r = num(o.rotate, 0) * D2R;
  const c = Math.cos(r);
  const s = Math.sin(r);
  return { x: r2(num(o.x, 0) + lx * c - ly * s), y: r2(num(o.y, 0) + lx * s + ly * c) };
}

/** Et bein som står på bakken: hvilken side, tåvinkelen og om hofte og kne kan rettes. */
interface Plant {
  side: Side;
  off: number;
  free: boolean;
}

/** Regner ut hele skjelettet: vinkler, mål for hender og føtter, flate såler, ankerpunkt og tyngdepunkt. */
export function solve(poseIn: PersonPose, size: number, ledd: Partial<Leddvinkler> | undefined, o: PersonPlass): Skeleton {
  const pose: PersonPose = Object.hasOwn(RAW, poseIn) ? poseIn : 'staa';
  const k = Math.max(1e-6, size) / 100;
  const given = (key: keyof Leddvinkler) => ledd !== undefined && Number.isFinite(ledd[key] as number);
  const slope = clamp(num(o.skraaning, 0), -50, 50);
  // Gange og løp: beina regnes ut for fasen (og skråningen), og bakken ligger H under hofta.
  const g = GAIT(pose) ? gaitPose(pose, Number.isFinite(o.fase) ? o.fase! : GAIT_REST[pose], slope, given('rygg') ? ledd!.rygg : undefined) : null;
  const j: Leddvinkler = { ...(g ? g.j : RAW[pose]) };
  for (const key of KEYS) if (given(key)) j[key] = ledd![key]!;
  const gaitH = g && !(['Hofte', 'Kne', 'Ankel'] as const).some((n) => given(`venstre${n}`) || given(`hoyre${n}`)) ? g.H : null;
  const trunk = frame({ x: 0, y: 0 }, j.rygg);
  const shoulder = trunk(SHOULDER_J.x, SHOULDER_J.y);
  const modes = HANDS[pose];
  const ski = pose === 'ski' && o.ski !== false;
  const sr = slope * D2R;
  const t = { x: Math.cos(sr), y: -Math.sin(sr) };
  const nDown = { x: Math.sin(sr), y: Math.cos(sr) };

  const armTo = (side: Side, target: Pt) => {
    if (given(`${side}Skulder`) || given(`${side}Albue`)) return;
    const mode = modes[side === 'venstre' ? 0 : 1];
    let wristTarget = target;
    let phiF = 90;
    for (let i = 0; i < (mode === 'flat' ? 3 : 1); i++) {
      if (mode === 'flat') wristTarget = sub(target, flatHandOffset(phiF));
      const [pu, pf] = ik(shoulder, wristTarget, UPPER, FORE + HAND_REACH[mode], -1);
      j[`${side}Skulder`] = pu + j.rygg;
      j[`${side}Albue`] = pf - pu;
      phiF = pf;
    }
  };
  const legTo = (side: Side, target: Pt, phiFoot0: number, ref: Pt) => {
    if (given(`${side}Hofte`) || given(`${side}Kne`)) return;
    // Rekker ikke foten fram, peker tærne mer ned (som på en pedal i bunnen), opptil 50° ekstra.
    let phiFoot = phiFoot0;
    let ankle = sub(target, frame({ x: 0, y: 0 }, 90 - phiFoot)(ref.x, ref.y));
    for (let extra = 10; extra <= 50 && Math.hypot(ankle.x, ankle.y) > THIGH + SHIN - 1.2; extra += 10) {
      phiFoot = phiFoot0 + extra;
      ankle = sub(target, frame({ x: 0, y: 0 }, 90 - phiFoot)(ref.x, ref.y));
    }
    const [pt, ps] = ik({ x: 0, y: 0 }, ankle, THIGH, SHIN, 1);
    j[`${side}Hofte`] = pt + j.rygg;
    j[`${side}Kne`] = pt - ps;
    if (!given(`${side}Ankel`)) j[`${side}Ankel`] = ps + 90 - phiFoot;
  };

  // Innebygde mål: tauet i 'dra', veggen i 'skyve', styret og pedalene i 'sykle'.
  if (pose === 'dra') {
    const v = clamp(num(o.tauvinkel, 0), -60, 70) * D2R;
    const d = { x: Math.cos(v), y: Math.sin(v) };
    const q = { x: 18.5, y: -9 };
    armTo('hoyre', add(q, d, 3.2));
    armTo('venstre', add(q, d, -3.2));
  } else if (pose === 'skyve') {
    armTo('hoyre', { x: 51.5, y: -22 });
    armTo('venstre', { x: 51.5, y: -25.5 });
  } else if (pose === 'sykle') {
    const bar = add(BIKE_BAR, SEAT);
    armTo('hoyre', bar);
    armTo('venstre', add(bar, { x: -1.2, y: -0.8 }));
    const crank = add(BIKE_CRANK, SEAT);
    const th = num(o.fase, 0) * TAU;
    for (const side of SIDES) {
      const a = th + (side === 'venstre' ? Math.PI : 0);
      const pedal = add(crank, { x: Math.cos(a), y: Math.sin(a) }, BIKE_CRANK_LEN);
      legTo(side, pedal, 100 - 9 * Math.cos(a), BALL);
    }
  }

  // Føtter festet i figuren (bare når ankerpunktet er setet, som ikke avhenger av beina).
  const seated = SEATED(pose);
  const fest = o.fest ?? {};
  if (seated && o.anker !== 'tyngdepunkt') {
    const seatAnchor = SEAT;
    for (const side of SIDES) {
      const p = fest[`${side}Fot`];
      if (p && Number.isFinite(p.x) && Number.isFinite(p.y)) {
        const local = toLocal(p, o, k, seatAnchor);
        legTo(side, local, pose === 'sykle' ? 100 : 90, pose === 'sykle' ? BALL : SOLE_MID);
      }
    }
  }

  // Føtter som står på bakken: sålen legges flatt langs skråningen (eller på tå), og deretter rettes eller bøyes
  // beina så begge kontaktpunktene havner på samme bakkelinje (samme dybde langs normalen til skråningen).
  const planted = PLANTED[pose];
  const plants: Plant[] = [];
  const flatAnkle = (side: Side, off: number) => {
    const phiS = -j.rygg + j[`${side}Hofte`] - j[`${side}Kne`];
    j[`${side}Ankel`] = clamp(phiS - slope + off, -65, 75);
  };
  SIDES.forEach((side, i) => {
    const off = planted[i];
    if (off === null || off === undefined || given(`${side}Ankel`)) return;
    if (seated && fest[`${side}Fot`]) return;
    flatAnkle(side, off);
    plants.push({ side, off, free: !given(`${side}Hofte`) && !given(`${side}Kne`) });
  });
  /** Det laveste punktet på foten (eller skia) og hvor det ligger fra ankelen. */
  const contactOf = (side: Side): { c: Pt; rel: Pt } => {
    const leg = buildLeg(j.rygg, j[`${side}Hofte`], j[`${side}Kne`], j[`${side}Ankel`]);
    const refs = ski ? [{ x: SOLE_MID.x, y: SOLE + SKI_DROP }] : [HEEL, BALL, TOE];
    let c = leg.foot(refs[0]!.x, refs[0]!.y);
    for (const r of refs.slice(1)) {
      const p = leg.foot(r.x, r.y);
      if (dot(p, nDown) > dot(c, nDown) + 1e-9) c = p;
    }
    return { c, rel: sub(c, leg.a) };
  };
  if (plants.length > 0) {
    const info = plants.map((p) => {
      const { c, rel } = contactOf(p.side);
      return { ...p, rel, u: dot(c, t), d: dot(c, nDown) };
    });
    const fixed = info.filter((p) => !p.free);
    let D: number;
    if (fixed.length > 0) D = Math.max(...fixed.map((p) => p.d));
    else {
      // Bakkelinja er der den laveste foten står, men ikke lenger ned enn et (nesten) strakt bein rekker.
      D = Math.max(...info.map((p) => p.d));
      const L = THIGH + SHIN - 0.02;
      for (const p of info) {
        const a = p.u - dot(p.rel, t);
        if (Math.abs(a) < L - 1) D = Math.min(D, dot(p.rel, nDown) + Math.sqrt(L * L - a * a));
      }
    }
    for (const p of info) {
      if (!p.free || Math.abs(p.d - D) < 1e-6) continue;
      const target = sub(add({ x: t.x * p.u, y: t.y * p.u }, nDown, D), p.rel);
      const [pt, ps] = ik({ x: 0, y: 0 }, target, THIGH, SHIN, 1);
      j[`${p.side}Hofte`] = pt + j.rygg;
      j[`${p.side}Kne`] = pt - ps;
      flatAnkle(p.side, p.off);
    }
  }

  const legs = {
    venstre: buildLeg(j.rygg, j.venstreHofte, j.venstreKne, j.venstreAnkel),
    hoyre: buildLeg(j.rygg, j.hoyreHofte, j.hoyreKne, j.hoyreAnkel),
  };
  const ground: Pt[] = [];
  for (const side of SIDES) {
    const f = legs[side].foot;
    if (ski) ground.push(f(SKI_BACK, SOLE + SKI_DROP), f(SKI_FRONT - 6, SOLE + SKI_DROP));
    else ground.push(f(HEEL.x, HEEL.y), f(BALL.x, BALL.y), f(TOE.x, TOE.y));
  }
  const contact: Partial<Record<Side, Pt>> = {};
  for (const p of plants) contact[p.side] = contactOf(p.side).c;

  // Ankerpunktet.
  const groundAnchor = (): Pt => {
    if (gaitH !== null) return { x: gaitH * nDown.x, y: gaitH * nDown.y };
    let dep = -Infinity;
    for (const p of ground) dep = Math.max(dep, dot(p, nDown));
    const along = GAIT(pose) ? 0 : dot(t, { x: (legs.venstre.sole.x + legs.hoyre.sole.x) / 2, y: (legs.venstre.sole.y + legs.hoyre.sole.y) / 2 });
    return { x: along * t.x + dep * nDown.x, y: along * t.y + dep * nDown.y };
  };

  const build = (): Skeleton => {
    const head = frame(add(trunk(NECK_BASE.x, NECK_BASE.y), dir(180 - j.rygg - j.nakke / 2), NECK_LEN), j.rygg + j.nakke);
    const arms = {
      venstre: buildArm(shoulder, j.rygg, j.venstreSkulder, j.venstreAlbue, modes[0]),
      hoyre: buildArm(shoulder, j.rygg, j.hoyreSkulder, j.hoyreAlbue, modes[1]),
    };
    const com = centerOfMass(trunk, head, arms, legs);
    return {
      j,
      trunk,
      head,
      neckBase: trunk(NECK_BASE.x, NECK_BASE.y),
      pivot: head(0, 0),
      shoulder,
      arms,
      legs,
      ground,
      contact,
      anchor: o.anker === 'tyngdepunkt' ? com : seated ? SEAT : groundAnchor(),
      com,
      ski,
      slopeT: t,
      slopeN: nDown,
    };
  };

  let sk = build();
  // Hender festet i figuren: ankerpunktet er kjent nå (det avhenger bare av beina).
  let moved = false;
  for (const side of SIDES) {
    const p = fest[`${side}Hand`];
    if (p && Number.isFinite(p.x) && Number.isFinite(p.y)) {
      armTo(side, toLocal(p, o, k, sk.anchor));
      moved = true;
    }
  }
  if (moved) {
    const anchor = sk.anchor;
    sk = build();
    sk.anchor = anchor;
  }
  return sk;
}

function centerOfMass(trunk: (a: number, b: number) => Pt, head: (a: number, b: number) => Pt, arms: Record<Side, Arm>, legs: Record<Side, Leg>): Pt {
  // Massefordeling etter Winter (2009): hode 8,1 %, overkropp 49,7 %, overarm 2,8 %, underarm 1,6 %, hånd 0,6 %,
  // lår 10 %, legg 4,65 %, fot 1,45 %.
  const parts: [Pt, number][] = [
    [head(HEAD_MID.x, HEAD_MID.y), 0.081],
    [trunk(0.3, -14), 0.497],
  ];
  for (const side of SIDES) {
    const a = arms[side];
    const l = legs[side];
    parts.push([mixPt(a.s, a.e, 0.44), 0.028], [mixPt(a.e, a.w, 0.43), 0.016], [a.grip, 0.006]);
    parts.push([mixPt({ x: 0, y: 0 }, l.k, 0.43), 0.1], [mixPt(l.k, l.a, 0.43), 0.0465], [l.sole, 0.0145]);
  }
  let x = 0;
  let y = 0;
  for (const [p, m] of parts) {
    x += p.x * m;
    y += p.y * m;
  }
  return { x, y };
}

function mixPt(a: Pt, b: Pt, t: number): Pt {
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
}

/* ================================================================================================
 * Ferdige positurer og punkter
 * ============================================================================================== */

/**
 * Leddvinklene i hver positur (ferdig utregnet, med flate såler, begge føttene på bakken og hendene på tauet,
 * veggen og styret). Bruk dem som utgangspunkt for egne positurer:
 *   <Person pose="staa" ledd={{ hoyreSkulder: POSER['armer-opp'].hoyreSkulder }} />   // løfter én arm
 *   <Person pose="dra" ledd={{ rygg: POSER.dra.rygg - 10 }} />                         // lener seg mer bakover
 */
export const POSER: Record<PersonPose, Leddvinkler> = Object.fromEntries(
  (Object.keys(RAW) as PersonPose[]).map((pose) => {
    const j = solve(pose, 100, undefined, {}).j;
    const rounded = Object.fromEntries(KEYS.map((key) => [key, Math.round(j[key] * 10) / 10])) as unknown as Leddvinkler;
    return [pose, rounded];
  }),
) as Record<PersonPose, Leddvinkler>;

/**
 * Punktene på personen som kapitlene fester ting til (tau, staver, kjelke, sykkel, kraftpiler).
 * Ankerpunktet er det samme som på Person: midt mellom føttene på bakken; for 'gaa' og 'loepe' rett under hofta
 * (så figuren står stille når `fase` endres); for 'sitte' og 'sykle' under setet (sittebeina).
 * Uten `plass` er punktene relative til ankerpunktet (som når Person står i x = 0, y = 0). Med `plass` (de samme
 * x, y, rotate, flip, anker, fase, tauvinkel, fest, skraaning og ski som på Person) er de i figurens koordinater.
 *
 *   const p = personPunkter('dra', 120, undefined, { x: 420, y: 300, tauvinkel: 10 });
 *   <line x1={p.hoyreHand.x} y1={p.hoyreHand.y} x2={kasse.x} y2={kasse.y} />            // tauet
 *   <ForceArrow x1={p.tyngdepunkt.x} y1={p.tyngdepunkt.y} x2={p.tyngdepunkt.x} y2={p.tyngdepunkt.y + 60} … />
 *
 * - `hode`: midt i hodet. `nakke`: nakkeroten mellom skuldrene. `skulder`: skulderleddet (der selen på en fallskjerm sitter).
 * - `hofte`: hofteleddet. `sete`: sittebeina (der personen sitter på et sete).
 * - `venstreHand`, `hoyreHand`: midt i grepet (en knyttet hånd rundt et tau), eller håndflata når hånda er flat (`skyve`).
 * - `venstreFot`, `hoyreFot`: midt under sålen. `venstreAnkel`, `hoyreAnkel`: ankelleddet (fest et strikk her).
 * - `tyngdepunkt`: kroppens massesenter (der G angriper).
 */
export function personPunkter(
  pose: PersonPose,
  size: number,
  ledd?: Partial<Leddvinkler>,
  plass?: PersonPlass,
): {
  hode: Pt;
  nakke: Pt;
  skulder: Pt;
  hofte: Pt;
  sete: Pt;
  venstreHand: Pt;
  hoyreHand: Pt;
  venstreFot: Pt;
  hoyreFot: Pt;
  venstreAnkel: Pt;
  hoyreAnkel: Pt;
  tyngdepunkt: Pt;
} {
  const o: PersonPlass = { ...plass };
  const s = Math.max(1e-6, num(size, 120));
  const k = s / 100;
  const sk = solve(pose, s, ledd, o);
  const f = (p: Pt) => toFigure(p, o, k, sk.anchor);
  return {
    hode: f(sk.head(HEAD_MID.x, HEAD_MID.y)),
    nakke: f(sk.neckBase),
    skulder: f(sk.shoulder),
    hofte: f({ x: 0, y: 0 }),
    sete: f(SEAT),
    venstreHand: f(sk.arms.venstre.grip),
    hoyreHand: f(sk.arms.hoyre.grip),
    venstreFot: f(sk.legs.venstre.sole),
    hoyreFot: f(sk.legs.hoyre.sole),
    venstreAnkel: f(sk.legs.venstre.a),
    hoyreAnkel: f(sk.legs.hoyre.a),
    tyngdepunkt: f(sk.com),
  };
}
