/**
 * Celledeling (Bi 1 kapittel 7, KM6): ren modell uten React.
 *
 * 1. Cellesyklusen og mitosen: fasene med varighet, DNA-mengden per celle (2c → 4c → 2c) og antall kromosomer og
 *    kromatider i hver fase.
 * 2. Meiosen: fasene i meiose I og II, kjønnsceller med kromosomer fra mor og far (uavhengig fordeling og
 *    overkrysning), antall mulige kombinasjoner 2ⁿ og sammenligning med mitosen.
 * 3. Regulering av celledelingen: kontrollpunktene i cellesyklusen (G1, G2, M), proto-onkogener («gasspedal») og
 *    tumorsuppressorgener («bremser»), og en enkel modell av antall celler i et vev når et sår gror, med og uten en
 *    klon av muterte celler.
 *
 * Kilder for tallene: varigheten av fasene i en menneskecelle i kultur som deler seg omtrent én gang i døgnet
 * (G1 ≈ 11 t, S ≈ 8 t, G2 ≈ 4 t, M ≈ 1 t) fra Alberts mfl., «Molecular Biology of the Cell». 23 kromosompar hos
 * mennesket gir 2²³ = 8 388 608 kombinasjoner (lærebøkene skriver «over 8 millioner»).
 */
import { PAIR_SHAPES, solveOde, valueAt, type Fase, type Opphav, type OdeSolution, type Segment } from '../kit';

/* ====================================================================== */
/* 1. Cellesyklusen og mitosen                                              */
/* ====================================================================== */

export type CycleStep = 'G1' | 'S' | 'G2' | 'profase' | 'metafase' | 'anafase' | 'telofase' | 'cytokinese';

export interface CycleStepInfo {
  id: CycleStep;
  /** Navnet slik læreboka skriver det. */
  name: string;
  /** Kort navn til trange etiketter. */
  short: string;
  /** Varighet i timer (typisk menneskecelle som deler seg én gang i døgnet). */
  hours: number;
  /** Interfasen (G1, S, G2) eller mitosefasen (M). */
  group: 'interfase' | 'mitose';
  /** Fasen som tegnes med kromosomfiguren (layoutPhase i kit-et). */
  fase: Fase;
}

/**
 * Fasene i cellesyklusen. Mitosen (M) tar ca. 1 time: profase (med prometafase) 0,3 t, metafase 0,25 t,
 * anafase 0,1 t, telofase 0,2 t og cytokinese 0,15 t. Cytokinesen overlapper i virkeligheten med telofasen.
 */
export const CYCLE: readonly CycleStepInfo[] = [
  { id: 'G1', name: 'G1-fasen (vekst)', short: 'G1', hours: 11, group: 'interfase', fase: 'interfase' },
  { id: 'S', name: 'S-fasen (DNA kopieres)', short: 'S', hours: 8, group: 'interfase', fase: 'interfase' },
  { id: 'G2', name: 'G2-fasen (klar til deling)', short: 'G2', hours: 4, group: 'interfase', fase: 'interfase' },
  { id: 'profase', name: 'Profase', short: 'Pro', hours: 0.3, group: 'mitose', fase: 'profase' },
  { id: 'metafase', name: 'Metafase', short: 'Meta', hours: 0.25, group: 'mitose', fase: 'metafase' },
  { id: 'anafase', name: 'Anafase', short: 'Ana', hours: 0.1, group: 'mitose', fase: 'anafase' },
  { id: 'telofase', name: 'Telofase', short: 'Telo', hours: 0.2, group: 'mitose', fase: 'telofase' },
  { id: 'cytokinese', name: 'Cytokinese', short: 'Cyto', hours: 0.15, group: 'mitose', fase: 'telofase' },
];

/** Hele cellesyklusen i timer (24 t). */
export const CYCLE_HOURS = CYCLE.reduce((s, c) => s + c.hours, 0);

/** Starttidspunktet (timer fra begynnelsen av G1) for steg nr. i. */
export function stepStart(i: number): number {
  let t = 0;
  for (let k = 0; k < Math.min(i, CYCLE.length); k++) t += CYCLE[k]!.hours;
  return t;
}

/** Tidspunktet i syklusen (timer) for steg i, `u` = hvor langt i steget (0–1). */
export function cycleTime(i: number, u: number): number {
  const s = CYCLE[Math.max(0, Math.min(CYCLE.length - 1, i))]!;
  return stepStart(i) + s.hours * Math.min(1, Math.max(0, u));
}

/** Hvilket steg et tidspunkt (timer, 0–24) ligger i. */
export function stepAt(hours: number): number {
  let t = 0;
  for (let i = 0; i < CYCLE.length; i++) {
    t += CYCLE[i]!.hours;
    if (hours < t - 1e-9) return i;
  }
  return CYCLE.length - 1;
}

/**
 * DNA-mengden per celle i enheten c (DNA-mengden i ett kromosomsett): 2c i G1, øker jevnt til 4c i S-fasen, 4c i G2
 * og gjennom mitosen, og 2c i hver dattercelle når cellen er delt (etter cytokinesen, t ≥ 24 t).
 */
export function dnaAmount(hours: number): number {
  const sStart = stepStart(1);
  const sEnd = stepStart(2);
  if (hours < sStart) return 2;
  if (hours < sEnd) return 2 + (2 * (hours - sStart)) / (sEnd - sStart);
  if (hours < CYCLE_HOURS) return 4;
  return 2;
}

/** Andelen av mitosen (M-fasen) av hele syklusen. */
export function mitosisShare(): number {
  return CYCLE.filter((c) => c.group === 'mitose').reduce((s, c) => s + c.hours, 0) / CYCLE_HOURS;
}

export interface CycleCounts {
  /** Antall celler (2 etter cytokinesen). */
  cells: number;
  /** Kromosomer i hver celle (søsterkromatider som henger sammen, teller som ett kromosom). */
  chromosomesPerCell: number;
  /** Kromatider per kromosom. */
  chromatidsPerChromosome: 1 | 2;
  /** DNA-mengde per celle (c). */
  dnaPerCell: number;
}

/**
 * Kromosomer, kromatider og DNA i cella i hvert steg, for 2n kromosomer. I anafasen og telofasen er
 * søsterkromatidene skilt og regnes som egne kromosomer, så cella har 4n kromosomer til den deles.
 * `sProgress` = hvor langt S-fasen har kommet (0–1).
 */
export function cycleCounts(step: CycleStep, twoN: number, sProgress = 1): CycleCounts {
  switch (step) {
    case 'G1':
      return { cells: 1, chromosomesPerCell: twoN, chromatidsPerChromosome: 1, dnaPerCell: 2 };
    case 'S':
      return { cells: 1, chromosomesPerCell: twoN, chromatidsPerChromosome: sProgress >= 1 ? 2 : 1, dnaPerCell: 2 + 2 * sProgress };
    case 'G2':
    case 'profase':
    case 'metafase':
      return { cells: 1, chromosomesPerCell: twoN, chromatidsPerChromosome: 2, dnaPerCell: 4 };
    case 'anafase':
    case 'telofase':
      return { cells: 1, chromosomesPerCell: 2 * twoN, chromatidsPerChromosome: 1, dnaPerCell: 4 };
    case 'cytokinese':
      return { cells: 2, chromosomesPerCell: twoN, chromatidsPerChromosome: 1, dnaPerCell: 2 };
  }
}

/** Hvor mange av kromosomene (i rekkefølge) som er kopiert når S-fasen har kommet `u` (0–1) av veien. */
export function replicatedCount(total: number, u: number): number {
  return Math.min(total, Math.max(0, Math.floor(u * total + 1e-9)));
}

/* ====================================================================== */
/* 2. Meiosen                                                               */
/* ====================================================================== */

export type MeiosisStep =
  | 'interfase'
  | 'profase1'
  | 'metafase1'
  | 'anafase1'
  | 'telofase1'
  | 'profase2'
  | 'metafase2'
  | 'anafase2'
  | 'telofase2';

export interface MeiosisStepInfo {
  id: MeiosisStep;
  name: string;
  deling: 'meiose1' | 'meiose2';
  fase: Fase;
  /** Antall celler etter steget (når delingen er fullført). */
  cells: 1 | 2 | 4;
  /** Ploiditet i hver celle: 2n før meiose I er ferdig, n etterpå. */
  ploidy: '2n' | 'n';
}

export const MEIOSIS: readonly MeiosisStepInfo[] = [
  { id: 'interfase', name: 'Interfase', deling: 'meiose1', fase: 'interfase', cells: 1, ploidy: '2n' },
  { id: 'profase1', name: 'Profase I', deling: 'meiose1', fase: 'profase', cells: 1, ploidy: '2n' },
  { id: 'metafase1', name: 'Metafase I', deling: 'meiose1', fase: 'metafase', cells: 1, ploidy: '2n' },
  { id: 'anafase1', name: 'Anafase I', deling: 'meiose1', fase: 'anafase', cells: 1, ploidy: '2n' },
  { id: 'telofase1', name: 'Telofase I', deling: 'meiose1', fase: 'telofase', cells: 2, ploidy: 'n' },
  { id: 'profase2', name: 'Profase II', deling: 'meiose2', fase: 'profase', cells: 2, ploidy: 'n' },
  { id: 'metafase2', name: 'Metafase II', deling: 'meiose2', fase: 'metafase', cells: 2, ploidy: 'n' },
  { id: 'anafase2', name: 'Anafase II', deling: 'meiose2', fase: 'anafase', cells: 2, ploidy: 'n' },
  { id: 'telofase2', name: 'Telofase II', deling: 'meiose2', fase: 'telofase', cells: 4, ploidy: 'n' },
];

/** Antall mulige kombinasjoner av kromosomer i en kjønnscelle ved uavhengig fordeling: 2ⁿ. */
export function combinations(n: number): number {
  return 2 ** n;
}

/** Antall kromosompar hos mennesket. */
export const HUMAN_N = 23;

/** Mulige kombinasjoner av kromosomer i ett befruktet egg fra to foreldre (uten overkrysning): (2ⁿ)². */
export function zygoteCombinations(n: number): number {
  return combinations(n) ** 2;
}

/** Én kromatide i en kjønnscelle: hvilket kromosom (fra mor eller far) og om den har et stykke fra det andre. */
export interface GameteChromatid {
  par: number;
  opphav: Opphav;
  /** Har fått et stykke fra det homologe kromosomet ved overkrysning. */
  rekombinant: boolean;
}

/** Stykket fra den andre forelderen som en rekombinant kromatide har fått (enden av den lange armen). */
export function recombinantSegments(c: GameteChromatid): Segment[] {
  if (!c.rekombinant) return [];
  const at = PAIR_SHAPES[c.par]?.overkrysning ?? 0.7;
  return [{ fra: at, til: 1, opphav: c.opphav === 'mor' ? 'far' : 'mor' }];
}

/**
 * De fire kjønnscellene fra én meiose. `orientering[p]` = true betyr at kromosomet fra mor i par p går til den
 * venstre cella i meiose I (som i kit-et). Cellene 0 og 1 kommer fra den venstre cella, 2 og 3 fra den høyre.
 * Med overkrysning er mors søsterkromatide b og fars søsterkromatide a rekombinante (de lå inntil hverandre).
 */
export function meiosisGametes(n: number, orientering: readonly boolean[], overkrysning: boolean): GameteChromatid[][] {
  const gametes: GameteChromatid[][] = [[], [], [], []];
  for (let par = 0; par < n; par++) {
    const morLeft = orientering[par] ?? par % 2 === 0;
    const left: Opphav = morLeft ? 'mor' : 'far';
    const right: Opphav = morLeft ? 'far' : 'mor';
    // Søsterkromatidene a og b skilles i meiose II: a til den første, b til den andre dattercella
    const sisters = (opphav: Opphav): [GameteChromatid, GameteChromatid] => [
      { par, opphav, rekombinant: overkrysning && opphav === 'far' },
      { par, opphav, rekombinant: overkrysning && opphav === 'mor' },
    ];
    const [la, lb] = sisters(left);
    const [ra, rb] = sisters(right);
    gametes[0]!.push(la);
    gametes[1]!.push(lb);
    gametes[2]!.push(ra);
    gametes[3]!.push(rb);
  }
  return gametes;
}

/** Enkel tallgenerator med fast frø (mulberry32), så de tilfeldige kjønnscellene blir like hver gang. */
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Tilfeldig orientering av parene i metafase I (uavhengig fordeling), med fast frø. */
export function randomOrientation(n: number, seed: number): boolean[] {
  const r = rng(seed * 7919 + 13);
  return Array.from({ length: n }, () => r() < 0.5);
}

/**
 * `count` tilfeldige kjønnsceller (hver fra sin egen meiose): for hvert par velges kromosomet fra mor eller far
 * (uavhengig fordeling), og med overkrysning en av de to søsterkromatidene, der den ene er rekombinant.
 */
export function randomGametes(n: number, overkrysning: boolean, count: number, seed: number): GameteChromatid[][] {
  const r = rng(seed * 104729 + 7);
  return Array.from({ length: count }, () =>
    Array.from({ length: n }, (_, par) => {
      const opphav: Opphav = r() < 0.5 ? 'mor' : 'far';
      return { par, opphav, rekombinant: overkrysning && r() < 0.5 };
    }),
  );
}

/** Nøkkel som beskriver hvilke kromatider en kjønnscelle har, f.eks. «M F m*» (stjerne = rekombinant). */
export function gameteKey(g: readonly GameteChromatid[]): string {
  return g.map((c) => `${c.opphav === 'mor' ? 'M' : 'F'}${c.rekombinant ? '*' : ''}`).join(' ');
}

/** Antall ulike kjønnsceller i en liste. */
export function distinctGametes(list: readonly (readonly GameteChromatid[])[]): number {
  return new Set(list.map(gameteKey)).size;
}

/** Alle 2ⁿ kombinasjoner uten overkrysning, sortert fra «bare fra mor» til «bare fra far». */
export function allCombinations(n: number): GameteChromatid[][] {
  return Array.from({ length: combinations(n) }, (_, k) =>
    Array.from({ length: n }, (_, par) => ({
      par,
      opphav: (k >> (n - 1 - par)) & 1 ? ('far' as const) : ('mor' as const),
      rekombinant: false,
    })),
  );
}

/* ====================================================================== */
/* 3. Regulering av celledelingen                                           */
/* ====================================================================== */

export interface Mutations {
  /** Proto-onkogen mutert til onkogen: «gasspedalen henger». */
  onkogen: boolean;
  /** Tumorsuppressorgen (f.eks. p53) virker ikke: «bremsen svikter». */
  tsg: boolean;
}

export interface TissueParams extends Mutations {
  /** Andel av cellene som mangler i såret ved start (0–0,9). */
  wound: number;
  /** DNA-skade i cellene (f.eks. etter UV-stråling): celler med virkende kontrollpunkter stopper og reparerer. */
  damage: boolean;
}

/** Delingsrate for en celle med vekstsignal og plass (per døgn): én deling omtrent hvert tredje døgn. */
export const R0 = 0.2;
/** Svakt vekstsignal i fullt, friskt vev (bakgrunn). */
export const SIGMA = 0.2;
/** «Gasspedalen henger»: delingssignalet er alltid på, og sterkere enn et vanlig vekstsignal. */
export const ONCOGENE_DRIVE = 1.3;
/** Celler med DNA-skade og virkende kontrollpunkter bruker tid på reparasjon (eller dør): lavere netto vekst. */
export const DAMAGE_SLOWDOWN = 0.6;
/** Andelen celler (av et fullt vev) i den muterte klonen ved start: én liten gruppe celler i kanten av såret. */
export const CLONE_START = 0.01;
/** Hvor lenge modellen går (døgn). */
export const TISSUE_DAYS = 30;

/**
 * Kontakthemming: hvor mye plass det er (1 = tomt, 0 = fullt). Celler deler seg nesten fritt til vevet er nesten
 * fullt, og stopper når de møter naboer på alle kanter (derfor fjerde potens).
 */
export function space(x: number): number {
  return Math.max(0, 1 - Math.max(0, x) ** 4);
}

/** Vekstsignal (vekstfaktorer fra såret og omgivelsene): sterkt når det er plass, svakt i fullt vev. */
export function growthSignal(x: number): number {
  return SIGMA + (1 - SIGMA) * space(x);
}

/**
 * Netto delingsrate per celle per døgn (per capita) ved fyllingsgraden x (andel av et fullt vev):
 *   rate = R0 · gass · brems · skade
 * gass = vekstsignalet (normalt) eller ONCOGENE_DRIVE (onkogen); brems = plassen (kontakthemming) eller 1 når
 * tumorsuppressorgenet ikke virker; skade = DAMAGE_SLOWDOWN når DNA-en er skadet og bremsen virker.
 */
export function divisionRate(x: number, m: Mutations, damage = false): number {
  const gas = m.onkogen ? ONCOGENE_DRIVE : growthSignal(x);
  const brake = m.tsg ? 1 : space(x);
  const dmg = damage && !m.tsg ? DAMAGE_SLOWDOWN : 1;
  return R0 * gas * brake * dmg;
}

export interface TissueResult {
  sol: OdeSolution;
  /** Har den muterte klonen noen mutasjon i det hele tatt. */
  hasClone: boolean;
}

/**
 * Antall celler i vevet over tid (andel av et fullt, friskt vev). Kolonne 0 = normale celler, kolonne 1 = en klon
 * av muterte celler (startet fra 1 % i kanten av såret). Kontakthemmingen avhenger av alle cellene til sammen.
 */
export function solveTissue(p: TissueParams): TissueResult {
  const hasClone = p.onkogen || p.tsg;
  const w = Math.min(0.9, Math.max(0, p.wound));
  const n0 = hasClone ? Math.max(0, 1 - w - CLONE_START) : 1 - w;
  const m0 = hasClone ? CLONE_START : 0;
  const normal: Mutations = { onkogen: false, tsg: false };
  const sol = solveOde(
    (_t, [n = 0, m = 0]) => {
      const x = n + m;
      return [divisionRate(x, normal, p.damage) * n, divisionRate(x, p, p.damage) * m];
    },
    [n0, m0],
    { tMax: TISSUE_DAYS, dt: 0.02, nonNegative: true },
  );
  return { sol, hasClone };
}

/** Normale og muterte celler ved tiden t (andel av fullt vev). */
export function tissueAt(r: TissueResult, t: number): { normal: number; mutant: number; total: number } {
  const [n = 0, m = 0] = valueAt(r.sol, t);
  return { normal: n, mutant: m, total: n + m };
}

/** Største antall celler i vevet i løpet av modelltida (andel av fullt vev). */
export function maxTotal(r: TissueResult): number {
  let max = 0;
  for (const row of r.sol.y) max = Math.max(max, (row[0] ?? 0) + (row[1] ?? 0));
  return max;
}

/** Første tidspunkt der vevet er (nesten) helt igjen (≥ 98 %), eller null om det ikke skjer innen modelltida. */
export function healedTime(r: TissueResult, level = 0.98): number | null {
  const { t, y } = r.sol;
  for (let i = 0; i < t.length; i++) {
    const row = y[i]!;
    if ((row[0] ?? 0) + (row[1] ?? 0) >= level) return t[i]!;
  }
  return null;
}

export type TissueState = 'gror' | 'helt' | 'svulst' | 'vokser-sakte';

/** Hva som skjer i vevet ved tiden t. */
export function tissueState(r: TissueResult, p: Mutations, t: number): TissueState {
  const { total } = tissueAt(r, t);
  if (total > 1.5 && p.onkogen && p.tsg) return 'svulst';
  if (total > 1.02) return p.onkogen && p.tsg ? 'svulst' : 'vokser-sakte';
  if (total < 0.98) return 'gror';
  return 'helt';
}

/* ---------- Kontrollpunktene ---------- */

export type CheckpointId = 'G1' | 'G2' | 'M';
export type CheckpointStatus = 'passer' | 'stopp' | 'g0';

export interface Checkpoint {
  id: CheckpointId;
  name: string;
  /** Plass i syklusen (timer fra begynnelsen av G1). */
  at: number;
  /** Hva som kontrolleres (lærebokformulering). */
  checks: string;
}

export const CHECKPOINTS: readonly Checkpoint[] = [
  {
    id: 'G1',
    name: 'G1-kontrollpunktet',
    at: stepStart(1) - 0.6,
    checks: 'Er cella stor nok, er det vekstsignaler, og er DNA-et uskadet?',
  },
  { id: 'G2', name: 'G2-kontrollpunktet', at: stepStart(3) - 0.3, checks: 'Er DNA-et kopiert helt og riktig?' },
  {
    id: 'M',
    name: 'M-kontrollpunktet',
    at: stepStart(4) + 0.12,
    checks: 'Er alle kromosomene festet til spoletrådene i metafasen?',
  },
];

export interface CheckpointResult {
  status: CheckpointStatus;
  /** Kort grunn som vises i figuren. */
  reason: string;
}

/**
 * Hva kontrollpunktene gjør med en celle. `crowded` = vevet er fullt (kontakthemming, ingen vekstsignaler).
 * Tumorsuppressorgener (f.eks. p53) stopper cella ved DNA-skade; uten dem slipper skadde celler gjennom.
 * Et onkogen gir delingssignal selv uten vekstfaktorer.
 */
export function checkpointStatus(id: CheckpointId, m: Mutations, damage: boolean, crowded: boolean): CheckpointResult {
  if (id === 'G1') {
    if (damage && !m.tsg) return { status: 'stopp', reason: 'DNA-skade: stopp til den er reparert' };
    if (crowded && !m.tsg)
      return m.onkogen
        ? { status: 'stopp', reason: 'Fullt vev: bremsen stopper cella' }
        : { status: 'g0', reason: 'Fullt vev: hvilefase (G0)' };
    if (m.onkogen) return { status: 'passer', reason: 'Onkogen: delingssignal hele tida' };
    if (m.tsg && crowded) return { status: 'passer', reason: 'Bremsen virker ikke' };
    return { status: 'passer', reason: damage ? 'Skaden blir ikke oppdaget' : 'Vekstsignal og plass' };
  }
  if (id === 'G2') {
    if (damage && !m.tsg) return { status: 'stopp', reason: 'Feil i DNA-et: stopp' };
    return { status: 'passer', reason: damage ? 'Feilen blir ikke oppdaget' : 'DNA-et er kopiert' };
  }
  return { status: 'passer', reason: 'Kromosomene er festet' };
}
