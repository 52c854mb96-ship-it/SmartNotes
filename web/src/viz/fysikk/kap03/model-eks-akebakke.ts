/**
 * Eksempeloppgaven «Akebrett ned bakken» (k3-eks-akebakke, 3B–3F).
 *
 * En aker på et akebrett passerer toppen A av en bakke med farten v₀. Bakken har jevn helning, er s lang (målt langs
 * bakken) og faller h ned til en vannrett flate. Nederst i bakken (B) er farten målt til v_B. På flaten glir brettet
 * rett fram til det stopper i C. Glidefriksjonstallet mellom brettet og snøen er μ.
 *
 *   Uten friksjon (bare tyngden gjør arbeid):   mgh + ½mv₀² = ½mv²             ⇒ v = √(v₀² + 2gh)
 *   Termisk energi i bakken:                    Q = E_A − E_B = (mgh + ½mv₀²) − ½mv_B²
 *   Arbeidet til motkreftene i bakken:          W_mot = ΔE = −Q = −F_mot · s    ⇒ F_mot = Q / s (gjennomsnitt)
 *   Flaten (N = mg, se bort fra luftmotstand):  −μmg · d = 0 − ½mv_B²            ⇒ d = v_B² / (2μg)
 *
 * F_mot er den samlede motkraften: friksjonen R fra snøen og luftmotstanden L til sammen (som i ERGO er R friksjon og
 * L luftmotstand). Vurderingen i e): med samme friksjonstall i bakken er friksjonen fra snøen μN = μmg cos α
 * (sin α = h/s), og resten av F_mot er luftmotstand: L = F_mot − μN. Snittet av v² langs strekningen er omtrent like stort på flaten (v_B²/2) som i
 * bakken ((v₀² + v_B²)/2), så luftmotstanden er i snitt omtrent like stor der. Et overslag over glidestrekningen
 * blir da d′ = ½mv_B² / (μmg + L), som er kortere enn d.
 */
import { G_EARTH } from '../../kit/format';

export interface SledTask {
  /** Navnet på akeren i oppgaveteksten. */
  name: string;
  /** «hun» eller «han». */
  pronoun: 'hun' | 'han';
  /** Massen til akeren og brettet til sammen (kg). */
  m: number;
  /** Høydeforskjellen fra toppen A til flaten (m). */
  h: number;
  /** Lengden av bakken fra A til B, målt langs bakken (m). */
  s: number;
  /** Farten på toppen A (m/s), etter at akeren har skjøvet fra. */
  v0: number;
  /** Den målte farten nederst i bakken, i B (m/s). */
  vB: number;
  /** Glidefriksjonstallet mellom brettet og snøen (på flaten, og i bakken i e). */
  mu: number;
}

/**
 * Tre tallsett. Bakkene er vanlige akebakker (6–8,5 m høye, 12–15° helning), og de målte fartene er valgt så
 * luftmotstanden i e) svarer til et luftmotstandsareal C·A på 0,45–0,7 m² for en som sitter på et brett (17–20 % av
 * motkraften). Friksjonstallene 0,10–0,12 passer for et plastbrett på hardpakket snø. Fartene uten friksjon i a)
 * ligger godt unna grensen mellom to avrundinger, så «om lag»-verdien er entydig.
 */
export const SLED_TASKS: SledTask[] = [
  { name: 'Ida', pronoun: 'hun', m: 45, h: 7.5, s: 30, v0: 1.5, vB: 8.0, mu: 0.12 },
  { name: 'Jonas', pronoun: 'han', m: 62, h: 6.0, s: 25, v0: 2.0, vB: 7.9, mu: 0.1 },
  { name: 'Sara', pronoun: 'hun', m: 38, h: 8.5, s: 38, v0: 1.0, vB: 7.7, mu: 0.12 },
];

export interface SledSolution {
  /** Tyngden G = mg (N). */
  G: number;
  /** Potensiell energi på toppen A med nullnivå på flaten (J). */
  EpA: number;
  /** Kinetisk energi på toppen A (J). */
  EkA: number;
  /** Mekanisk energi på toppen A (J): E_A = E_pA + E_kA. */
  EA: number;
  /** Farten nederst uten friksjon og luftmotstand (m/s): √(v₀² + 2gh). */
  vIdeal: number;
  /** vIdeal avrundet til to gjeldende siffer, til «Vis at …» i a). */
  vIdealShown: number;
  /** Farten etter fallet h fra ro: √(2gh) (m/s). */
  vDrop: number;
  /** Den gale farten v₀ + √(2gh) (fartene lagt sammen), til den vanlige feilen i a). */
  vWrongSum: number;
  /** Kinetisk (og mekanisk) energi nederst i B med den målte farten (J). */
  EkB: number;
  /** Mekanisk energi som er blitt termisk energi i bakken (J): Q = E_A − E_B. */
  Q: number;
  /** Andelen av den mekaniske energien på toppen som er blitt termisk energi i bakken. */
  QShare: number;
  /** Arbeidet til motkreftene (friksjon og luftmotstand) i bakken (J): W_mot = ΔE = −Q. */
  Wmot: number;
  /** Den gjennomsnittlige samlede motkraften (friksjon og luftmotstand til sammen) i bakken (N): F_mot = Q/s. */
  Fmot: number;
  /** Normalkraften på flaten (N): N = G. */
  Nflat: number;
  /** Friksjonen på flaten (N): μmg. */
  Rflat: number;
  /** Glidestrekningen på flaten uten luftmotstand (m): d = v_B²/(2μg). */
  d: number;
  /** Retardasjonen på flaten (m/s²): μg. Til kontrollen med bevegelseslikningen. */
  aFlat: number;
  /** Hvor lenge brettet glir på flaten (s): v_B/(μg). */
  tFlat: number;
  /** sin α = h/s. */
  sinA: number;
  /** Helningsvinkelen til bakken (grader). */
  alphaDeg: number;
  /** cos α. */
  cosA: number;
  /** Den vannrette lengden av bakken (m): s · cos α. */
  run: number;
  /** Normalkraften i bakken (N): mg cos α. */
  Nslope: number;
  /** Friksjonen fra snøen i bakken med samme friksjonstall (N): μmg cos α. */
  muN: number;
  /** Luftmotstanden i bakken i gjennomsnitt (N): L = F_mot − μN. */
  L: number;
  /** Andelen av den samlede motkraften F_mot som er luftmotstand. */
  airShare: number;
  /** Overslag over glidestrekningen med luftmotstand (m): ½mv_B² / (μmg + L). */
  dEst: number;
}

/** Avrunder til `sig` gjeldende siffer: 12,22 → 12 (sig = 2). */
export function roundSig(x: number, sig: number): number {
  if (!Number.isFinite(x) || x === 0) return x;
  const e = Math.floor(Math.log10(Math.abs(x))) - sig + 1;
  const f = 10 ** e;
  return Math.round(x / f) * f;
}

/** Hvor mange desimaler et tall avrundet til `sig` gjeldende siffer trenger: 12 → 0, 9,6 → 1, 0,45 → 2. */
export function sigDecimals(x: number, sig: number): number {
  if (!Number.isFinite(x) || x === 0) return 0;
  return Math.max(0, sig - 1 - Math.floor(Math.log10(Math.abs(roundSig(x, sig)))));
}

/** Løser hele oppgaven for ett tallsett. Alle tall i teksten, utregningen og figuren kommer herfra. */
export function solveSledTask({ m, h, s, v0, vB, mu }: SledTask, g = G_EARTH): SledSolution {
  const G = m * g;
  const EpA = m * g * h;
  const EkA = 0.5 * m * v0 * v0;
  const EA = EpA + EkA;
  const vIdeal = Math.sqrt(v0 * v0 + 2 * g * Math.max(0, h));
  const vDrop = Math.sqrt(2 * g * Math.max(0, h));
  const EkB = 0.5 * m * vB * vB;
  const Q = EA - EkB;
  const Fmot = s > 0 ? Q / s : 0;
  const Nflat = G;
  const Rflat = mu * Nflat;
  const aFlat = mu * g;
  const d = aFlat > 0 ? (vB * vB) / (2 * aFlat) : Infinity;
  const tFlat = aFlat > 0 ? vB / aFlat : Infinity;
  const sinA = s > 0 ? Math.min(1, Math.max(0, h / s)) : 0;
  const cosA = Math.sqrt(1 - sinA * sinA);
  const Nslope = G * cosA;
  const muN = mu * Nslope;
  const L = Fmot - muN;
  return {
    G,
    EpA,
    EkA,
    EA,
    vIdeal,
    vIdealShown: roundSig(vIdeal, 2),
    vDrop,
    vWrongSum: v0 + vDrop,
    EkB,
    Q,
    QShare: EA > 0 ? Q / EA : 0,
    Wmot: -Q,
    Fmot,
    Nflat,
    Rflat,
    d,
    aFlat,
    tFlat,
    sinA,
    alphaDeg: (Math.asin(sinA) * 180) / Math.PI,
    cosA,
    run: s * cosA,
    Nslope,
    muN,
    L,
    airShare: Fmot > 0 ? L / Fmot : 0,
    dEst: Rflat + L > 0 ? EkB / (Rflat + L) : Infinity,
  };
}
