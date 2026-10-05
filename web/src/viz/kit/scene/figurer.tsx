/**
 * Scene-kit, familien «figurer»: personer i lærebokstil sett fra siden, og fallskjerm.
 *
 *   <Person x={300} y={bakke} size={120} pose="skyve" jakke="gronn" />
 *   const p = personPunkter('dra', 120, undefined, { x: 300, y: bakke });   // hendene, føttene, hofta …
 *   <Fallskjerm x={sele.x} y={sele.y} size={360} aapen={0.8} />
 *
 * Personen er bygd på et skjelett med leddvinkler (`Leddvinkler`), så positurene i `POSER` bare er tall, og nye
 * positurer er lette å lage: `ledd={{ hoyreAlbue: 90 }}`. Personen ser mot høyre (`flip` mot venstre). «hoyre…»
 * er armen og beinet nærmest betrakteren (tegnes foran kroppen), «venstre…» de bakerste (litt mørkere).
 * Hender og føtter kan festes til punkter i figuren med `fest` (tau, styre, pedaler, en kasse), og skjelettet
 * regner ut albuer og knær selv.
 *
 * Alle mål regnes internt i en figur som er 100 enheter høy (fra sålene til hodet) og skaleres til `size`.
 */
import './figurer.css';
import { ContactShadow, LinearGradient, RadialGradient, SCENE_DIM, shade, tint, useStrokeScale, useSvgId, type GradientStop, type SceneObjectProps } from './core';
import { PAINTS, SCENE, paint, type PaintName } from './palette';

type Pt = { x: number; y: number };

const D2R = Math.PI / 180;
const TAU = Math.PI * 2;

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
 * Gi bare leddene du vil endre: ankler som ikke er gitt, legges flatt på bakken av seg selv.
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

const KEYS: (keyof Leddvinkler)[] = [
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

type Side = 'venstre' | 'hoyre';
const SIDES: Side[] = ['venstre', 'hoyre'];
type HandMode = 'aapen' | 'knyttet' | 'flat';

/** Mål på kroppen i en figur som er 100 enheter høy (ca. 1,75 m: 1 enhet ≈ 1,75 cm). */
const THIGH = 24.5;
const SHIN = 24;
const UPPER = 18.5;
const FORE = 14.5;
/** Skulderleddet og nakkeroten i overkroppens koordinater (fram, ned) fra hofteleddet. */
const SHOULDER_J: Pt = { x: 0.4, y: -27.2 };
const NECK_BASE: Pt = { x: -0.8, y: -30.6 };
const NECK_LEN = 4.2;
/** Sittebeina (kontakten med setet) fra hofteleddet. */
const SEAT: Pt = { x: -1, y: 5.5 };
/** Foten i fotens koordinater (fram, ned) fra ankelen. */
const SOLE = 4.2;
const HEEL: Pt = { x: -4.4, y: SOLE };
const BALL: Pt = { x: 7.4, y: SOLE };
const TOE: Pt = { x: 10.8, y: SOLE - 0.5 };
const SOLE_MID: Pt = { x: 3, y: SOLE };
/** Skiene: høyde fra sålen til undersiden av skia, og hvor de begynner og slutter langs foten. */
const SKI_DROP = 2.6;
const SKI_BACK = -42;
const SKI_FRONT = 47;
/** Standardsykkelen for `sykle` uten `fest` (fra sittebeina): kranklager, pedalarm og styre. */
const BIKE_CRANK: Pt = { x: 13.4, y: 38 };
const BIKE_CRANK_LEN = 10;
const BIKE_BAR: Pt = { x: 41, y: -3 };

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
const PLANTED: Record<PersonPose, [number | null, number | null]> = {
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
const SEATED = (pose: PersonPose) => pose === 'sitte' || pose === 'sykle';
/** Positurer med ankerpunktet rett under hofta (så figuren står stille når `fase` endres). */
const GAIT = (pose: PersonPose): pose is 'gaa' | 'loepe' => pose === 'gaa' || pose === 'loepe';

const STAND = { venstreHofte: 6, hoyreHofte: -5, venstreKne: 3, hoyreKne: 4, venstreAnkel: 0, hoyreAnkel: 0 };

/** Grunnvinklene før mål og flate såler er regnet inn (se POSER for de ferdige). */
const RAW: Record<PersonPose, Leddvinkler> = {
  staa: { rygg: 0, nakke: 0, venstreSkulder: 6, hoyreSkulder: -4, venstreAlbue: 10, hoyreAlbue: 12, ...STAND },
  gaa: gait('gaa', 0.04),
  loepe: gait('loepe', 0.78),
  dra: {
    rygg: -26,
    nakke: 16,
    venstreSkulder: 40,
    hoyreSkulder: 52,
    venstreAlbue: 30,
    hoyreAlbue: 10,
    venstreHofte: -14,
    hoyreHofte: 20,
    venstreKne: 36,
    hoyreKne: 14,
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
  'armer-opp': { rygg: 0, nakke: -10, venstreSkulder: 164, hoyreSkulder: 186, venstreAlbue: 12, hoyreAlbue: 4, ...STAND },
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

/* ================================================================================================
 * Geometri
 * ============================================================================================== */

function num(v: unknown, fallback: number): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : fallback;
}
function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}
/** Retning med vinkel φ målt fra rett ned, positiv mot fronten (+x): 0 = ned, 90 = fram, 180 = opp. */
function dir(phi: number): Pt {
  return { x: Math.sin(phi * D2R), y: Math.cos(phi * D2R) };
}
function add(a: Pt, b: Pt, s = 1): Pt {
  return { x: a.x + b.x * s, y: a.y + b.y * s };
}
function sub(a: Pt, b: Pt): Pt {
  return { x: a.x - b.x, y: a.y - b.y };
}
function angleOf(from: Pt, to: Pt): number {
  return Math.atan2(to.x - from.x, to.y - from.y) / D2R;
}
/** Lokalt koordinatsystem (a fram, b ned) dreid `deg` grader med klokka og flyttet til `o`. */
function frame(o: Pt, deg: number): (a: number, b: number) => Pt {
  const c = Math.cos(deg * D2R);
  const s = Math.sin(deg * D2R);
  return (a, b) => ({ x: o.x + a * c - b * s, y: o.y + a * s + b * c });
}
function wrap01(t: number): number {
  return t - Math.floor(t);
}
/** Periodisk «pukkel» rundt c med bredde w (for gangsyklusen). */
function bump(t: number, c: number, w: number): number {
  const d = wrap01(t - c + 0.5) - 0.5;
  return Math.exp(-((d / w) ** 2));
}

/**
 * Leddvinkler i gang og løp ved fase t (0–1) for det nære beinet; det bortre er en halv syklus etter.
 * Fase 0 = den nære hælen treffer bakken.
 */
function gait(kind: 'gaa' | 'loepe', fase: number): Leddvinkler {
  const walk = kind === 'gaa';
  const rygg = walk ? 3 : 11;
  const leg = (t: number) => {
    const hofte = walk ? 9 + 19 * Math.cos(TAU * t) : 20 + 38 * Math.cos(TAU * (t - 0.86));
    const kne = walk
      ? 4 + 13 * bump(t, 0.13, 0.09) + 56 * bump(t, 0.7, 0.12)
      : 16 + 24 * bump(t, 0.16, 0.09) + 98 * bump(t, 0.66, 0.15);
    const table = walk
      ? 5 * bump(t, 0.05, 0.05) - 8 * bump(t, 0.42, 0.12) + 22 * bump(t, 0.6, 0.07) - 2
      : -12 * bump(t, 0.18, 0.08) + 30 * bump(t, 0.4, 0.07) - 2;
    // Midt i ståfasen ligger foten flatt på bakken.
    const flat = -rygg + hofte - kne;
    const w = walk ? bump(t, 0.28, 0.14) : bump(t, 0.17, 0.07);
    return { hofte, kne, ankel: table * (1 - w) + flat * w };
  };
  const arm = (t: number) =>
    walk
      ? { skulder: 4 - 17 * Math.cos(TAU * t), albue: 14 + 14 * Math.max(0, -Math.cos(TAU * t)) }
      : { skulder: 8 - 36 * Math.cos(TAU * (t - 0.86)), albue: 86 + 12 * Math.max(0, -Math.cos(TAU * (t - 0.86))) };
  const t = wrap01(num(fase, 0));
  const u = wrap01(t + 0.5);
  const nl = leg(t);
  const fl = leg(u);
  const na = arm(t);
  const fa = arm(u);
  return {
    rygg,
    nakke: walk ? -3 : -9,
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
  };
}

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

interface Arm {
  s: Pt;
  e: Pt;
  w: Pt;
  phiU: number;
  phiF: number;
  mode: HandMode;
  /** Gripepunktet (midt i hånda, eller håndflata for en flat hånd). */
  grip: Pt;
}
interface Leg {
  k: Pt;
  a: Pt;
  phiT: number;
  phiS: number;
  phiFoot: number;
  foot: (a: number, b: number) => Pt;
  sole: Pt;
}
interface Skeleton {
  j: Leddvinkler;
  trunk: (a: number, b: number) => Pt;
  head: (a: number, b: number) => Pt;
  neckBase: Pt;
  pivot: Pt;
  shoulder: Pt;
  arms: Record<Side, Arm>;
  legs: Record<Side, Leg>;
  /** Punkter som kan berøre bakken (såler, eller undersiden av skiene). */
  ground: Pt[];
  anchor: Pt;
  com: Pt;
  ski: boolean;
}

/** Feste for hender og føtter, i figurens koordinater (samme system som x og y). */
interface PersonFeste {
  venstreHand?: Pt;
  hoyreHand?: Pt;
  /** Føttene kan bare festes når personen sitter (`sitte`, `sykle`): punktet er under fotballen (pedalen). */
  venstreFot?: Pt;
  hoyreFot?: Pt;
}

type Anker = 'bakke' | 'tyngdepunkt';

/** Alt som bestemmer formen og plasseringen til personen (props på Person, valg til personPunkter). */
interface GeoOpts {
  x?: number;
  y?: number;
  rotate?: number;
  flip?: boolean;
  anker?: Anker;
  fase?: number;
  tauvinkel?: number;
  fest?: PersonFeste;
  skraaning?: number;
  ski?: boolean;
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
function toLocal(p: Pt, o: GeoOpts, k: number, anchor: Pt): Pt {
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
function toFigure(p: Pt, o: GeoOpts, k: number, anchor: Pt): Pt {
  const lx = (p.x - anchor.x) * k * (o.flip ? -1 : 1);
  const ly = (p.y - anchor.y) * k;
  const r = num(o.rotate, 0) * D2R;
  const c = Math.cos(r);
  const s = Math.sin(r);
  return { x: r2(num(o.x, 0) + lx * c - ly * s), y: r2(num(o.y, 0) + lx * s + ly * c) };
}

const r2 = (v: number) => Math.round(v * 100) / 100;

/** Regner ut hele skjelettet: vinkler, mål for hender og føtter, flate såler, ankerpunkt og tyngdepunkt. */
function solve(poseIn: PersonPose, size: number, ledd: Partial<Leddvinkler> | undefined, o: GeoOpts): Skeleton {
  const pose: PersonPose = Object.hasOwn(RAW, poseIn) ? poseIn : 'staa';
  const k = Math.max(1e-6, size) / 100;
  const given = (key: keyof Leddvinkler) => ledd !== undefined && Number.isFinite(ledd[key] as number);
  const j: Leddvinkler = { ...(GAIT(pose) && o.fase !== undefined && Number.isFinite(o.fase) ? gait(pose, o.fase) : RAW[pose]) };
  for (const key of KEYS) if (given(key)) j[key] = ledd![key]!;
  const trunk = frame({ x: 0, y: 0 }, j.rygg);
  const shoulder = trunk(SHOULDER_J.x, SHOULDER_J.y);
  const slope = clamp(num(o.skraaning, 0), -50, 50);
  const modes = HANDS[pose];
  const ski = pose === 'ski' && o.ski !== false;

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

  // Flate såler for føtter som står på bakken (langs skråningen).
  const planted = PLANTED[pose];
  SIDES.forEach((side, i) => {
    const off = planted[i];
    if (off === null || off === undefined || given(`${side}Ankel`)) return;
    if (seated && fest[`${side}Fot`]) return;
    const phiS = -j.rygg + j[`${side}Hofte`] - j[`${side}Kne`];
    j[`${side}Ankel`] = clamp(phiS - slope + off, -40, 60);
  });

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

  // Ankerpunktet.
  const sr = slope * D2R;
  const t = { x: Math.cos(sr), y: -Math.sin(sr) };
  const nDown = { x: Math.sin(sr), y: Math.cos(sr) };
  const groundAnchor = (): Pt => {
    let dep = -Infinity;
    for (const p of ground) dep = Math.max(dep, p.x * nDown.x + p.y * nDown.y);
    const along = GAIT(pose) ? 0 : ((legs.venstre.sole.x + legs.hoyre.sole.x) / 2) * t.x + ((legs.venstre.sole.y + legs.hoyre.sole.y) / 2) * t.y;
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
      anchor: o.anker === 'tyngdepunkt' ? com : seated ? SEAT : groundAnchor(),
      com,
      ski,
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
    [head(0.6, -6.2), 0.081],
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
 * Leddvinklene i hver positur (ferdig utregnet, med flate såler og hendene på tauet, veggen og styret).
 * Bruk dem som utgangspunkt for egne positurer:
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
 * Uten `plass` er punktene relative til ankerpunktet (som når Person står i x = 0, y = 0). Med `plass` (de samme
 * x, y, rotate, flip, anker, fase, tauvinkel, fest og skraaning som på Person) er de i figurens koordinater.
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
  plass?: Partial<Pick<PersonProps, 'x' | 'y' | 'rotate' | 'flip' | 'anker' | 'fase' | 'tauvinkel' | 'fest' | 'skraaning'>>,
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
  const o: GeoOpts = { ...plass };
  const s = Math.max(1e-6, num(size, 120));
  const k = s / 100;
  const sk = solve(pose, s, ledd, o);
  const f = (p: Pt) => toFigure(p, o, k, sk.anchor);
  return {
    hode: f(sk.head(0.6, -6.2)),
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

/* ================================================================================================
 * Tegning
 * ============================================================================================== */

const fmt = (p: Pt) => `${r2(p.x)},${r2(p.y)}`;

/**
 * Kapsel (avrundet lem) fra a (radius ra) til b (radius rb), alltid mot klokka, så flere kapsler i samme sti
 * smelter sammen til én form (nonzero).
 */
function capsule(a: Pt, ra: number, b: Pt, rb: number): string {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const L = Math.hypot(dx, dy);
  if (!(L > Math.abs(ra - rb) + 1e-3)) {
    const c = ra >= rb ? a : b;
    const r = Math.max(ra, rb);
    return `M${fmt({ x: c.x, y: c.y + r })}A${r2(r)},${r2(r)} 0 0 0 ${fmt({ x: c.x + r, y: c.y })}A${r2(r)},${r2(r)} 0 0 0 ${fmt({
      x: c.x,
      y: c.y - r,
    })}A${r2(r)},${r2(r)} 0 0 0 ${fmt({ x: c.x - r, y: c.y })}A${r2(r)},${r2(r)} 0 0 0 ${fmt({ x: c.x, y: c.y + r })}Z`;
  }
  const ux = dx / L;
  const uy = dy / L;
  const nx = -uy;
  const ny = ux;
  const s = (ra - rb) / L;
  const c = Math.sqrt(1 - s * s);
  const u1 = { x: nx * c - ux * s, y: ny * c - uy * s };
  const u2 = { x: -nx * c - ux * s, y: -ny * c - uy * s };
  const p1 = add(a, u1, ra);
  const p2 = add(b, u1, rb);
  const p3 = add(b, u2, rb);
  const p4 = add(a, u2, ra);
  const tb = add(b, { x: ux, y: uy }, rb);
  const ta = add(a, { x: ux, y: uy }, -ra);
  const R = (r: number) => `${r2(r)},${r2(r)}`;
  return `M${fmt(p1)}L${fmt(p2)}A${R(rb)} 0 0 0 ${fmt(tb)}A${R(rb)} 0 0 0 ${fmt(p3)}L${fmt(p4)}A${R(ra)} 0 0 0 ${fmt(ta)}A${R(ra)} 0 0 0 ${fmt(p1)}Z`;
}

/** Glatt lukket form der punktene er kontrollpunkter (et punkt to ganger gir et skarpt hjørne). */
function smooth(pts: Pt[]): string {
  const n = pts.length;
  const mid = (a: Pt, b: Pt) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
  let d = `M${fmt(mid(pts[n - 1]!, pts[0]!))}`;
  for (let i = 0; i < n; i++) d += `Q${fmt(pts[i]!)} ${fmt(mid(pts[i]!, pts[(i + 1) % n]!))}`;
  return `${d}Z`;
}

function shape(f: (a: number, b: number) => Pt, pts: [number, number][]): string {
  return smooth(pts.map(([a, b]) => f(a, b)));
}

/** Skoen i fotens koordinater: sålen ligger på b = SOLE. */
function shoePaths(f: (a: number, b: number) => Pt, boot: boolean): { body: string; sole: string; shine: string } {
  const P = (a: number, b: number) => fmt(f(a, b));
  const top = boot ? -3.2 : -2.6;
  const body =
    `M${P(-3.8, top + 1.2)}Q${P(-5.4, 0.6)} ${P(-4.8, 2.8)}Q${P(-4.6, SOLE)} ${P(-2.8, SOLE)}L${P(9.4, SOLE)}` +
    `Q${P(11.9, SOLE)} ${P(11.6, 2.4)}Q${P(11.2, 0.9)} ${P(8.8, 0.2)}Q${P(5.8, -0.5)} ${P(3.4, top + 0.6)}Q${P(1.6, top - 0.4)} ${P(-0.6, top)}Z`;
  const sole = `M${P(-4.7, 3)}Q${P(-4.6, SOLE)} ${P(-2.8, SOLE)}L${P(9.4, SOLE)}Q${P(11.8, SOLE)} ${P(11.7, 3)}Z`;
  const shine = `M${P(5.2, -0.1)}Q${P(8.4, 0.3)} ${P(10.2, 1.5)}`;
  return { body, sole, shine };
}

type Hudtone = 'lys' | 'middels' | 'mork';
type Harfarge = 'blond' | 'brun' | 'svart' | 'rod' | 'graa';
const HUD: Record<Hudtone, string> = {
  lys: 'var(--sc-figurer-hud-lys)',
  middels: 'var(--sc-figurer-hud-middels)',
  mork: 'var(--sc-figurer-hud-mork)',
};
const HAR: Record<Harfarge, string> = {
  blond: 'var(--sc-figurer-har-blond)',
  brun: 'var(--sc-figurer-har-brun)',
  svart: 'var(--sc-figurer-har-svart)',
  rod: 'var(--sc-figurer-har-rod)',
  graa: 'var(--sc-figurer-har-graa)',
};
const EYE = 'var(--sc-figurer-oye)';
const LINE = 'var(--sc-figurer-line)';

function clothStops(c: string): GradientStop[] {
  return [
    [0, tint(c, 0.2)],
    [0.5, c],
    [1, shade(c, 0.22)],
  ];
}

export interface PersonProps extends SceneObjectProps {
  /**
   * Ankerpunktet: midt mellom føttene, på bakken (for 'gaa' og 'loepe' rett under hofta, så figuren står stille
   * når `fase` endres). For 'sitte' og 'sykle': under setet (sittebeina). `rotate` dreier om dette punktet.
   */
  x: number;
  y: number;
  /** Høyden stående (fra sålene til toppen av hodet) i figurens enheter, også når personen sitter eller bøyer seg. Standard 120. */
  size?: number;
  /** Positur (standard 'staa'). Se PersonPose. */
  pose?: PersonPose;
  /** Jakkefarge (navn fra PAINTS eller en CSS-farge, f.eks. SCENE.denim). Standard 'blaa'. */
  jakke?: PaintName | string;
  /** Buksefarge. Standard SCENE.denim (olabukse). */
  bukse?: PaintName | string;
  /** Hudfarge: 'lys', 'middels', 'mork' eller en CSS-farge. Standard SCENE.skin. */
  hud?: Hudtone | string;
  /** Hårfarge: 'blond', 'brun', 'svart', 'rod', 'graa' eller en CSS-farge. Standard SCENE.hair. */
  har?: Harfarge | string;
  /** Frisyre: 'kort' (standard), 'lang' (til skuldrene) eller 'hestehale'. */
  frisyre?: 'kort' | 'lang' | 'hestehale';
  /** Strikkelue i denne fargen (vinter, ski). */
  lue?: PaintName | string;
  /** Hjelm i denne fargen (sykkel, ski). Går foran `lue`. */
  hjelm?: PaintName | string;
  /** Sekk på ryggen i denne fargen (ryggsekk, eller fallskjermsekken til en hopper). */
  sekk?: PaintName | string;
  /** Skofarge (standard 'svart'). */
  sko?: PaintName | string;
  /** Skifarge for 'ski' (standard 'rod'). `false` tegner personen uten ski og staver. */
  ski?: PaintName | string | false;
  /** Overstyr enkeltledd i posituren, f.eks. `{ rygg: -35 }` eller `{ hoyreSkulder: 90, hoyreAlbue: 0 }`. */
  ledd?: Partial<Leddvinkler>;
  /**
   * Fase 0–1 i en syklus: to skritt for 'gaa' og 'loepe' (0 = den nære hælen treffer bakken), én omdreining av kranken
   * for 'sykle' (0 = den nære pedalen rett fram, 0,25 = nederst). Gange: fase = (strekning / 1,4 m) % 1, løp ca. 2,8 m.
   */
  fase?: number;
  /** Vinkelen på tauet for 'dra' i grader: 0 = vannrett fram, positiv = skrått nedover mot det som dras. */
  tauvinkel?: number;
  /**
   * Fest hender (alle positurer) og føtter ('sitte', 'sykle') til punkter i figuren, f.eks. styret og pedalene fra
   * sykkelPunkter eller kanten på en kasse. Hånda griper midt i punktet (håndflata for 'skyve'), foten har punktet
   * under fotballen ('sykle') eller midt under sålen ('sitte'). Albuer og knær regnes ut selv; når punktet er for
   * langt unna, strekkes armen eller beinet mot det. Ledd du gir i `ledd`, går foran.
   */
  fest?: PersonFeste;
  /** Bakken heller (grader, positiv = oppover i retningen personen ser): personen står loddrett med flate såler langs bakken. */
  skraaning?: number;
  /** Ankerpunktet: 'bakke' (standard, se x og y) eller 'tyngdepunkt' (fritt fall: dreier om tyngdepunktet). */
  anker?: Anker;
  /** Myk skygge på bakken (standard: når personen står på bakken). */
  skygge?: boolean;
}

/**
 * Person i lærebokstil sett fra siden: hode med hår og ansiktsprofil, jakke, bukse, sko og avrundede lemmer med ledd.
 * Ankerpunktet (x, y) er midt mellom føttene på bakken (under setet for 'sitte' og 'sykle'), og `size` er høyden
 * stående i figurens enheter. Skjelettet styres av positurene i POSER, som kan overstyres med `ledd`.
 *
 *   <Person x={260} y={300} size={130} pose="dra" tauvinkel={8} jakke="rod" />
 *   <Person x={p.sete.x} y={p.sete.y} pose="sykle" fest={{ hoyreHand: p.styre, hoyreFot: p.hoyrePedal(v), venstreFot: p.venstrePedal(v) }} />
 *   <Person x={x} y={bakke} pose="gaa" fase={(s / 1.4) % 1} />                    // går: én syklus = to skritt ≈ 1,4 m
 *   <Person x={x} y={y} pose="falle" anker="tyngdepunkt" rotate={90} />         // fallskjermhopper med magen ned
 *
 * For 'sitte' står føttene ca. 0,22 · size under setet (stolhøyden). Skyggen på bakken tegnes bare når personen står.
 */
export function Person({
  x,
  y,
  size = 120,
  pose = 'staa',
  rotate,
  flip,
  dim,
  title,
  jakke = 'blaa',
  bukse = SCENE.denim,
  hud,
  har,
  frisyre = 'kort',
  lue,
  hjelm,
  sko = 'svart',
  sekk,
  ski = 'rod',
  ledd,
  fase,
  tauvinkel,
  fest,
  skraaning,
  anker,
  skygge,
}: PersonProps) {
  const ss = useStrokeScale();
  const gJ = useSvgId('sc-jakke');
  const gB = useSvgId('sc-bukse');
  const gH = useSvgId('sc-hud');
  const s = Math.max(4, num(size, 120));
  const k = s / 100;
  const o: GeoOpts = { x, y, rotate, flip, anker, fase, tauvinkel, fest, skraaning, ski: ski !== false };
  const sk = solve(pose, s, ledd, o);
  const A = sk.anchor;

  const cJ = paint(jakke);
  const cB = paint(bukse);
  const cS = hud ? (Object.hasOwn(HUD, hud) ? HUD[hud as Hudtone] : hud) : SCENE.skin;
  const cH = har ? (Object.hasOwn(HAR, har) ? HAR[har as Harfarge] : har) : SCENE.hair;
  const cShoe = paint(sko);
  // Strektykkelse: ca. 0,9 px på PC (litt tynnere for små figurer), regnet om til personens enheter.
  const ow = (0.9 * ss * clamp(s / 120, 0.55, 1.15)) / k;
  const outline = SCENE.outline;
  const far = (c: string) => shade(c, 0.2);
  const grad = (id: string, c: string) => <LinearGradient id={id} stops={clothStops(c)} x1={flip ? 1 : 0} x2={flip ? 0 : 1} y1={0} y2={1} />;

  const { arms, legs, trunk, head, j } = sk;
  const fx = Number.isFinite(x) ? x : 0;
  const fy = Number.isFinite(y) ? y : 0;
  const transform = `translate(${r2(fx)} ${r2(fy)})${rotate ? ` rotate(${r2(rotate)})` : ''} scale(${r2(flip ? -k : k)} ${r2(k)}) translate(${r2(-A.x)} ${r2(-A.y)})`;

  // Skygge på bakken (langs skråningen).
  const onGround = skygge ?? (!SEATED(pose) && pose !== 'falle' && anker !== 'tyngdepunkt');
  const xs = sk.ski ? [legs.venstre.foot(SKI_BACK, 0).x, legs.hoyre.foot(SKI_FRONT, 0).x] : [legs.venstre.sole.x, legs.hoyre.sole.x];
  const shadowCx = sk.ski ? (xs[0]! + xs[1]!) / 2 : (Math.min(...xs) + Math.max(...xs)) / 2;
  const shadowRx = sk.ski ? Math.abs(xs[1]! - xs[0]!) / 2 : Math.abs(xs[1]! - xs[0]!) / 2 + 9;

  const limbs = (side: Side) => {
    const a = arms[side];
    const l = legs[side];
    return {
      arm: capsule(a.s, 3.9, a.e, 3.15) + capsule(a.e, 3.15, a.w, 2.6),
      leg: capsule({ x: 0, y: 0 }, 6.4, l.k, 4.3) + capsule(l.k, 4.3, l.a, 3.1),
    };
  };
  const near = limbs('hoyre');
  const back = limbs('venstre');

  const hand = (a: Arm, fill: string) => {
    const d = dir(a.phiF);
    let path: string;
    if (a.mode === 'knyttet') path = capsule(add(a.w, d, 0.9), 2.45, add(a.w, d, 3.2), 2.35);
    else if (a.mode === 'aapen') path = capsule(add(a.w, d, 0.8), 2.25, add(a.w, d, 6.4), 1.75);
    else {
      const up = dir(a.phiF + 80);
      path = capsule(add(a.w, up, 0.6), 2.3, add(a.w, up, 6), 1.8);
    }
    const thumb =
      a.mode === 'aapen' ? capsule(add(add(a.w, d, 1.6), dir(a.phiF + 90), 1.45), 0.95, add(add(a.w, d, 4.1), dir(a.phiF + 90), 1.9), 0.82) : null;
    return (
      <>
        <path d={path} fill={fill} stroke={outline} strokeWidth={ow} strokeLinejoin="round" />
        {thumb && <path d={thumb} fill={fill} stroke={outline} strokeWidth={ow * 0.8} />}
      </>
    );
  };
  const cuff = (a: Arm, fill: string) => {
    const d = dir(a.phiF);
    return <path d={capsule(add(a.w, d, -2.6), 2.75, add(a.w, d, -0.3), 2.7)} fill={fill} />;
  };

  const shoe = (l: Leg, fill: string, isNear: boolean) => {
    const boot = sk.ski;
    const p = shoePaths(l.foot, boot);
    const shaftDir = dir(l.phiS + 180);
    return (
      <g>
        {boot && <path d={capsule(add(l.a, shaftDir, -0.5), 3.9, add(l.a, shaftDir, 8.5), 4.15)} fill={fill} stroke={outline} strokeWidth={ow} />}
        <path d={p.body} fill={fill} stroke={outline} strokeWidth={ow} strokeLinejoin="round" />
        <path d={p.sole} fill={shade(fill, 0.35)} />
        {isNear && <path d={p.shine} fill="none" stroke={SCENE.highlight} strokeWidth={0.9} strokeLinecap="round" />}
      </g>
    );
  };

  // Ski og staver for 'ski'.
  const skiColor = paint(typeof ski === 'string' ? ski : 'rod');
  const skiPath = (l: Leg, shift: number) => {
    const f = l.foot;
    const P = (a: number, b: number) => fmt(f(a + shift, b));
    const top = SOLE + SKI_DROP - 1.2;
    const bot = SOLE + SKI_DROP;
    return {
      ski:
        `M${P(SKI_BACK, top)}L${P(SKI_FRONT - 6, top)}Q${P(SKI_FRONT - 0.5, top - 0.2)} ${P(SKI_FRONT + 2.6, top - 4.4)}` +
        `L${P(SKI_FRONT + 3.6, top - 3.9)}Q${P(SKI_FRONT + 1, bot)} ${P(SKI_FRONT - 6, bot)}L${P(SKI_BACK + 1, bot)}Q${P(SKI_BACK - 0.6, bot - 0.6)} ${P(SKI_BACK, top)}Z`,
      binding: `M${P(-3.8, SOLE - 0.2)}L${P(9.6, SOLE - 0.2)}L${P(9.2, top)}L${P(-3.4, top)}Z`,
    };
  };
  const groundY = Math.max(...sk.ground.map((p) => p.y));
  const pole = (a: Arm) => {
    // Staven peker bakover og ned, med trinsen like over snøen bak personen.
    const len = 66;
    const cosPhi = clamp((groundY - 15 - a.grip.y) / (len - 4), -0.95, 0.95);
    const d = dir(-Math.acos(cosPhi) / D2R);
    const top = add(a.grip, d, -4.5);
    const tip = add(a.grip, d, len - 4);
    const basket = add(a.grip, d, len - 9);
    const n = { x: -d.y, y: d.x };
    return (
      <g>
        <line x1={top.x} y1={top.y} x2={tip.x} y2={tip.y} stroke={SCENE.metalDark} strokeWidth={1.25} strokeLinecap="round" />
        <path d={capsule(add(basket, n, -2.6), 0.75, add(basket, n, 2.6), 0.75)} fill={SCENE.rubber} />
        <path d={capsule(top, 1.35, add(a.grip, d, 3.6), 1.25)} fill={SCENE.rubber} stroke={outline} strokeWidth={ow * 0.8} />
      </g>
    );
  };

  // Overkroppen (jakka) i overkroppens koordinater (fram, ned) fra hofteleddet.
  const T = trunk;
  const jacket = shape(T, [
    [-7.2, 3.2],
    [-7.2, 3.2],
    [-6.7, -4],
    [-5.3, -11],
    [-6.9, -20],
    [-5.8, -29.4],
    [-2.6, -32.2],
    [2.6, -31.6],
    [5.8, -26.6],
    [7.6, -19.2],
    [6.2, -9.2],
    [6.8, 3.2],
    [6.8, 3.2],
  ]);
  const hem = `M${fmt(T(-7.1, 3.25))}L${fmt(T(6.75, 3.25))}L${fmt(T(6.6, 0.6))}L${fmt(T(-6.95, 0.6))}Z`;
  const collar = shape(T, [
    [-4, -29.4],
    [-3.6, -32.8],
    [2.9, -32.4],
    [3.4, -29.2],
  ]);
  const backShine = `M${fmt(T(-4.6, -27.6))}Q${fmt(T(-6.2, -22))} ${fmt(T(-5.6, -15))}`;
  const pack =
    sekk === undefined
      ? null
      : {
          color: paint(sekk),
          body: shape(T, [
            [-5.6, -28.2],
            [-12.6, -27.6],
            [-14.6, -21],
            [-14.4, -11],
            [-12.4, -6.6],
            [-5.8, -6.8],
          ]),
          pocket: shape(T, [
            [-13.6, -16.2],
            [-9.2, -16.4],
            [-9, -8.6],
            [-13.2, -8.8],
          ]),
          strap: `M${fmt(T(-6.2, -27.6))}Q${fmt(T(0.6, -32))} ${fmt(T(5.6, -24.4))}L${fmt(T(5.8, -13.6))}`,
        };

  // Hodet i hodets koordinater (fram, ned) fra toppen av nakken.
  const H = head;
  const P = (a: number, b: number) => fmt(H(a, b));
  const headPath =
    `M${P(0.4, -12.7)}C${P(-3.6, -12.8)} ${P(-6, -10.4)} ${P(-5.7, -7.2)}C${P(-5.5, -4.6)} ${P(-4.9, -2.8)} ${P(-3.3, -0.6)}` +
    `Q${P(-1, 0.1)} ${P(1.4, 0.9)}Q${P(3.6, 2)} ${P(5.2, 1.2)}Q${P(6.1, 0.5)} ${P(5.9, -0.7)}L${P(6.2, -1.8)}L${P(5.95, -2.7)}` +
    `Q${P(6.3, -3.1)} ${P(6.8, -3.1)}L${P(7.5, -3.6)}Q${P(7.75, -4.1)} ${P(7.3, -4.7)}L${P(6.2, -6.7)}Q${P(6.7, -7.6)} ${P(6.45, -8.4)}` +
    `Q${P(6.1, -11.4)} ${P(3.6, -12.4)}Q${P(2.2, -12.8)} ${P(0.4, -12.7)}Z`;
  const ear = capsule(H(-0.7, -6.6), 1.45, H(-0.5, -4.6), 1.25);
  const brow = capsule(H(3.4, -8.15), 0.45, H(5.5, -8.25), 0.4);
  const hairCap = shape(H, [
    [5.9, -9.6],
    [5.6, -13.4],
    [1, -14.6],
    [-4.4, -13.9],
    [-7.1, -10.2],
    [-6.6, -5],
    [-5.2, -1.6],
    [-3.6, -3.4],
    [-2.6, -5.8],
    [-1.6, -8.8],
    [1.6, -9.9],
    [4.2, -9.4],
  ]);
  const hairBack =
    frisyre === 'lang'
      ? shape(H, [
          [-1, -14.2],
          [-7.4, -12],
          [-8, -4.4],
          [-7.6, 2],
          [-6.8, 6.6],
          [-3.2, 7],
          [-2.2, 2.4],
          [-2.6, -5],
        ])
      : frisyre === 'hestehale'
        ? shape(H, [
            [-4.8, -12],
            [-8.4, -11.4],
            [-10.2, -6.8],
            [-10.4, -1],
            [-9, 3.6],
            [-8, -1.4],
            [-6.8, -6.8],
            [-5.4, -9],
          ])
        : null;
  const hairShine = `M${P(3.2, -12.6)}Q${P(-0.6, -13.6)} ${P(-3.6, -12.2)}`;
  const hat = hjelm ?? lue;
  const hatColor = hat !== undefined ? paint(hat) : undefined;
  const helmet = hjelm !== undefined;
  const hatPath = helmet
    ? shape(H, [
        [7.9, -9.2],
        [7.9, -9.2],
        [7.4, -14.2],
        [1.4, -17.4],
        [-5.6, -16.2],
        [-10.4, -11.6],
        [-10.4, -11.6],
        [-7.6, -8.4],
        [-4.2, -9.6],
        [0.4, -10.6],
        [5.6, -10.4],
      ])
    : shape(H, [
        [6.5, -8.4],
        [6.6, -13.8],
        [1.2, -16.2],
        [-5, -15.4],
        [-7.6, -11.6],
        [-7.2, -6.8],
        [-7.2, -6.8],
        [6.5, -8.4],
      ]);
  const hatBand = helmet ? '' : `M${P(-7.3, -6.7)}L${P(6.55, -8.35)}L${P(6.6, -10.6)}L${P(-7.45, -9)}Z`;
  const vents = helmet ? [capsule(H(-6.2, -13.2), 0.55, H(-3.4, -14.9), 0.55), capsule(H(-1.6, -15.5), 0.55, H(1.6, -15.6), 0.55), capsule(H(3.4, -15), 0.55, H(5.6, -13.4), 0.5)].join('') : '';
  const pompom = H(-1.4, -16.8);
  const strap = `M${P(-0.6, -8.4)}L${P(2.6, 0.6)}`;

  const neck = capsule(add(sk.neckBase, dir(-j.rygg), 1.6), 2.55, add(sk.pivot, dir(-j.rygg - j.nakke), -1.2), 2.45);
  const jacketFar = far(cJ);
  const pantsFar = far(cB);
  const skinFar = shade(cS, 0.14);
  const shoeFar = shade(cShoe, 0.15);

  return (
    <g transform={transform} opacity={dim ? SCENE_DIM : undefined}>
      {title && <title>{title}</title>}
      {grad(gJ, cJ)}
      {grad(gB, cB)}
      <RadialGradient id={gH} stops={[[0, tint(cS, 0.18)], [0.6, cS], [1, shade(cS, 0.16)]]} cx={flip ? 0.6 : 0.4} cy={0.4} r={0.7} />
      {onGround && (
        <g transform={skraaning ? `rotate(${r2(-clamp(num(skraaning, 0), -50, 50))} ${r2(A.x)} ${r2(A.y)})` : undefined}>
          <ContactShadow cx={shadowCx} cy={A.y} rx={shadowRx} ry={Math.max(2.2, shadowRx * 0.14)} />
        </g>
      )}

      {/* Bakerste stav, ski, arm og bein (mørkere) */}
      {sk.ski && pole(arms.venstre)}
      {sk.ski && (
        <g fill={shade(skiColor, 0.2)} stroke={outline} strokeWidth={ow} strokeLinejoin="round">
          <path d={skiPath(legs.venstre, 2.5).ski} />
          <path d={skiPath(legs.venstre, 0).binding} fill={SCENE.metalDark} />
        </g>
      )}
      <path d={back.arm} fill="none" stroke={outline} strokeWidth={ow * 2} strokeLinejoin="round" />
      <path d={back.arm} fill={jacketFar} />
      {hand(arms.venstre, skinFar)}
      <path d={back.leg} fill="none" stroke={outline} strokeWidth={ow * 2} strokeLinejoin="round" />
      <path d={back.leg} fill={pantsFar} />
      {shoe(legs.venstre, shoeFar, false)}

      {/* Nærmeste ski og bein */}
      {sk.ski && (
        <g stroke={outline} strokeWidth={ow} strokeLinejoin="round">
          <path d={skiPath(legs.hoyre, 0).ski} fill={skiColor} />
          <path d={skiPath(legs.hoyre, 0).binding} fill={SCENE.metal} />
        </g>
      )}
      <path d={near.leg} fill="none" stroke={outline} strokeWidth={ow * 2} strokeLinejoin="round" />
      <path d={near.leg} fill={`url(#${gB})`} />
      {shoe(legs.hoyre, cShoe, true)}

      {/* Nakke, sekk, jakke og hode */}
      <path d={neck} fill={shade(cS, 0.12)} stroke={outline} strokeWidth={ow} />
      {pack && (
        <>
          <path d={pack.body} fill={pack.color} stroke={outline} strokeWidth={ow} strokeLinejoin="round" />
          <path d={pack.pocket} fill={shade(pack.color, 0.16)} stroke={outline} strokeWidth={ow * 0.7} />
        </>
      )}
      <path d={jacket} fill={`url(#${gJ})`} />
      <path d={hem} fill={shade(cJ, 0.14)} />
      <path d={collar} fill={shade(cJ, 0.1)} stroke={outline} strokeWidth={ow * 0.8} />
      <path d={jacket} fill="none" stroke={outline} strokeWidth={ow} strokeLinejoin="round" />
      {pack ? (
        <path d={pack.strap} fill="none" stroke={shade(pack.color, 0.3)} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
      ) : (
        <path d={backShine} fill="none" stroke={SCENE.highlight} strokeWidth={1.3} strokeLinecap="round" />
      )}
      {hairBack && <path d={hairBack} fill={shade(cH, 0.08)} stroke={outline} strokeWidth={ow} strokeLinejoin="round" />}
      <path d={headPath} fill={`url(#${gH})`} stroke={outline} strokeWidth={ow} strokeLinejoin="round" />
      <path d={ear} fill={shade(cS, 0.08)} stroke={outline} strokeWidth={ow * 0.8} />
      <circle cx={H(4.35, -6.5).x} cy={H(4.35, -6.5).y} r={0.68} fill={EYE} />
      <path d={brow} fill={shade(cH, 0.15)} />
      {hat === undefined && (
        <>
          <path d={hairCap} fill={cH} stroke={outline} strokeWidth={ow} strokeLinejoin="round" />
          <path d={hairShine} fill="none" stroke={SCENE.highlight} strokeWidth={0.9} strokeLinecap="round" />
        </>
      )}
      {hatColor && (
        <>
          {helmet && <path d={strap} stroke={shade(hatColor, 0.45)} strokeWidth={0.7} strokeLinecap="round" />}
          <path d={hatPath} fill={hatColor} stroke={outline} strokeWidth={ow} strokeLinejoin="round" />
          {helmet ? (
            <>
              <path d={vents} fill={shade(hatColor, 0.5)} />
              <path d={`M${P(-8.2, -11.2)}Q${P(-5.2, -9.4)} ${P(0, -10.4)}Q${P(4, -10.8)} ${P(6.8, -9.8)}`} fill="none" stroke={shade(hatColor, 0.3)} strokeWidth={0.8} />
            </>
          ) : (
            <>
              <path d={hatBand} fill={shade(hatColor, 0.16)} />
              <circle cx={pompom.x} cy={pompom.y} r={2.3} fill={tint(hatColor, 0.12)} stroke={outline} strokeWidth={ow * 0.8} />
            </>
          )}
        </>
      )}

      {/* Nærmeste stav og arm */}
      {sk.ski && pole(arms.hoyre)}
      <path d={near.arm} fill="none" stroke={outline} strokeWidth={ow * 2} strokeLinejoin="round" />
      <path d={near.arm} fill={`url(#${gJ})`} />
      {cuff(arms.hoyre, shade(cJ, 0.14))}
      {hand(arms.hoyre, cS)}
    </g>
  );
}

/* ================================================================================================
 * Fallskjerm
 * ============================================================================================== */

export interface FallskjermProps extends Omit<SceneObjectProps, 'flip'> {
  /** Festepunktet: selen (ved skuldrene til hopperen). Linene samles her, og `rotate` dreier om dette punktet. */
  x: number;
  y: number;
  /** Bredden på skjermen når den er helt åpen, i figurens enheter (standard 240; ca. 4 ganger høyden på en person). */
  size?: number;
  /** 0 = pakket i sekken, ca. 0,3 = linene er strukket ut, 1 = helt åpen. */
  aapen?: number;
  /** Fargen på annenhver duk (de andre er hvite). Standard 'rod'. */
  lakk?: PaintName | string;
}

/**
 * Rund fallskjerm sett fra siden: kuppel med duker i to farger, liner ned til selen og innsiden av kanten.
 * `aapen` går fra 0 (pakket sekk ved festepunktet) via en smal pølse på strake liner til en helt åpen kuppel,
 * så utløsningen kan animeres. Ankerpunktet (x, y) er selen; skjermen er over den (dreies med `rotate`).
 *
 *   const sele = personPunkter('armer-opp', 110, undefined, { x: 400, y: 330 }).skulder;
 *   <Fallskjerm x={sele.x} y={sele.y} size={420} aapen={0.9} lakk="oransje" />
 *   <Person x={400} y={330} size={110} pose="armer-opp" skygge={false} />
 */
export function Fallskjerm({ x, y, size = 240, aapen = 1, lakk = 'rod', rotate, dim, title }: FallskjermProps) {
  const ss = useStrokeScale();
  const gDome = useSvgId('sc-skjerm');
  const gShade = useSvgId('sc-skjerm-lys');
  const s = Math.max(4, num(size, 240));
  const k = s / 100;
  const a = clamp(num(aapen, 1), 0, 1);
  const color = paint(lakk);
  const white = PAINTS.hvit;
  const ow = (0.9 * ss) / k;
  const smoothstep = (e0: number, e1: number, v: number) => {
    const t = clamp((v - e0) / (e1 - e0), 0, 1);
    return t * t * (3 - 2 * t);
  };
  const ext = smoothstep(0.03, 0.3, a);
  const inf = smoothstep(0.28, 1, a);
  // Mål i en skjerm som er 100 enheter bred når den er åpen.
  const L = 84 * (0.14 + 0.86 * ext) - 6 * inf;
  const w = 50 * (0.05 + 0.95 * Math.pow(inf, 0.85));
  const h = 30 + 12 * inf;
  const sy = -L;
  const n = inf > 0.35 ? 7 : 3;
  const xsPts = Array.from({ length: n }, (_, i) => -w * Math.cos((i / (n - 1)) * Math.PI));
  const fx = Number.isFinite(x) ? x : 0;
  const fy = Number.isFinite(y) ? y : 0;
  const transform = `translate(${r2(fx)} ${r2(fy)})${rotate ? ` rotate(${r2(rotate)})` : ''} scale(${r2(k)})`;
  const R = (rx: number, ry: number) => `${r2(Math.max(0.01, Math.abs(rx)))},${r2(ry)}`;
  const apex = { x: 0, y: sy - h };
  const scallop = (from: number, to: number) => `Q${r2((from + to) / 2)},${r2(sy + Math.abs(to - from) * 0.12)} ${r2(to)},${r2(sy)}`;
  const skirtBack = xsPts
    .slice()
    .reverse()
    .slice(1)
    .map((xv, i) => scallop(xsPts[n - 1 - i]!, xv))
    .join('');
  const dome = `M${r2(-w)},${r2(sy)}A${R(w, h)} 0 0 1 ${r2(w)},${r2(sy)}${skirtBack}Z`;
  const gores: string[] = [];
  for (let i = 0; i < n - 1; i += 2) {
    const x0 = xsPts[i]!;
    const x1 = xsPts[i + 1]!;
    const up = x0 < 0 ? 1 : 0;
    const down = x1 > 0 ? 1 : 0;
    gores.push(`M${r2(x0)},${r2(sy)}A${R(x0, h)} 0 0 ${up} ${fmt(apex)}A${R(x1, h)} 0 0 ${down} ${r2(x1)},${r2(sy)}${scallop(x1, x0)}Z`);
  }
  const mouth = `M${r2(-w)},${r2(sy)}A${R(w, w * 0.13)} 0 0 0 ${r2(w)},${r2(sy)}${skirtBack}Z`;
  const riserL = { x: -1.8, y: -9 };
  const riserR = { x: 1.8, y: -9 };
  const lines = xsPts.map((xv) => `M${r2(xv)},${r2(sy)}L${fmt(xv < 0 ? riserL : xv > 0 ? riserR : { x: 0, y: -9 })}`).join('');
  const risers = `M${fmt(riserL)}L-1.2,0M${fmt(riserR)}L1.2,0`;
  const packed = a < 0.03;
  return (
    <g transform={transform} opacity={dim ? SCENE_DIM : undefined}>
      {title && <title>{title}</title>}
      <RadialGradient id={gDome} stops={[[0, tint(color, 0.25)], [0.55, color], [1, shade(color, 0.25)]]} cx={0.4} cy={0.3} r={0.75} />
      <RadialGradient id={gShade} stops={[[0, SCENE.highlight], [0.4, SCENE.highlight, 0], [0.75, SCENE.shadow, 0], [1, SCENE.shadow, 0.9]]} cx={0.38} cy={0.25} r={0.85} />
      {!packed && (
        <>
          <path d={lines} fill="none" stroke={LINE} strokeWidth={(0.7 * ss) / k} strokeLinecap="round" opacity={0.85} />
          <path d={risers} fill="none" stroke={LINE} strokeWidth={(1.4 * ss) / k} strokeLinecap="round" />
          <path d={mouth} fill={shade(color, 0.45)} stroke={SCENE.outline} strokeWidth={ow} strokeLinejoin="round" />
          <path d={dome} fill={`url(#${gDome})`} />
          {gores.map((d, i) => (
            <path key={i} d={d} fill={white} />
          ))}
          <path d={dome} fill={`url(#${gShade})`} />
          <path d={dome} fill="none" stroke={SCENE.outline} strokeWidth={ow} strokeLinejoin="round" />
        </>
      )}
      <rect x={-2.6} y={-6.4} width={5.2} height={7} rx={1.4} fill={PAINTS.svart} stroke={SCENE.outline} strokeWidth={ow * 0.8} />
      {packed && <rect x={-1.8} y={-5.6} width={3.6} height={1.4} rx={0.6} fill={color} />}
    </g>
  );
}
