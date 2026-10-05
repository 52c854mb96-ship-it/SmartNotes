/**
 * Biologisk mangfold (Bi 1 kapittel 3, KM10 og KM11): artsmangfold (Simpsons og Shannons indeks), arter og areal
 * (S = c · A^z, øybiogeografi og oppstykking av skog) og et næringsnett fra norsk barskog med enkel kaskadelogikk og
 * energipyramide. Ren modell uten React.
 */
import { seededRandom } from '../kit';

/* ====================================================================== */
/* Artsmangfold                                                             */
/* ====================================================================== */

/** Arter i feltsjiktet og bunnsjiktet i en norsk skog (rekkefølgen er rekkefølgen i figuren). */
export const FOREST_SPECIES: readonly { name: string; sci: string }[] = [
  { name: 'blåbær', sci: 'Vaccinium myrtillus' },
  { name: 'tyttebær', sci: 'Vaccinium vitis-idaea' },
  { name: 'smyle', sci: 'Avenella flexuosa' },
  { name: 'skogstjerne', sci: 'Lysimachia europaea' },
  { name: 'gaukesyre', sci: 'Oxalis acetosella' },
  { name: 'maiblom', sci: 'Maianthemum bifolium' },
  { name: 'linnea', sci: 'Linnaea borealis' },
  { name: 'hvitveis', sci: 'Anemone nemorosa' },
  { name: 'fugletelg', sci: 'Gymnocarpium dryopteris' },
  { name: 'etasjemose', sci: 'Hylocomium splendens' },
  { name: 'røsslyng', sci: 'Calluna vulgaris' },
  { name: 'stri kråkefot', sci: 'Lycopodium annotinum' },
];

export const MAX_SPECIES = FOREST_SPECIES.length;
/** Antall individer (planter) i hver prøveflate. */
export const INDIVIDUALS = 60;

/**
 * Andelene p_i for S arter etter en geometrisk rekke p_i ∝ k^(i−1). Jevnheten (0–1) bestemmer k: 1 gir like mange av
 * hver art, 0 gir k = 0,25, der den vanligste arten har omtrent tre firedeler av individene.
 */
export function shares(S: number, evenness: number): number[] {
  const n = Math.max(1, Math.round(S));
  const k = 0.25 + 0.75 * Math.min(1, Math.max(0, evenness));
  const raw = Array.from({ length: n }, (_, i) => k ** i);
  const sum = raw.reduce((a, b) => a + b, 0);
  return raw.map((r) => r / sum);
}

/**
 * Heltallige antall individer per art (sum = N, minst 1 per art) med størst-rest-metoden, så figuren viser nøyaktig de
 * andelene som telles.
 */
export function counts(S: number, evenness: number, N = INDIVIDUALS): number[] {
  const p = shares(S, evenness);
  const exact = p.map((x) => x * N);
  const c = exact.map((x) => Math.max(1, Math.floor(x)));
  let diff = N - c.reduce((a, b) => a + b, 0);
  const byRemainder = exact.map((x, i) => ({ i, r: x - Math.floor(x) })).sort((a, b) => b.r - a.r || a.i - b.i);
  for (let j = 0; diff > 0; j = (j + 1) % c.length, diff--) c[byRemainder[j]!.i]!++;
  // For mange fordi alle arter skal ha minst én: trekk fra de største
  while (diff < 0) {
    const big = c.indexOf(Math.max(...c));
    c[big]!--;
    diff++;
  }
  return c;
}

/** Simpsons diversitetsindeks D = 1 − Σ p_i²: sannsynligheten for at to tilfeldig valgte individer er av ulik art. */
export function simpson(c: readonly number[]): number {
  const N = c.reduce((a, b) => a + b, 0);
  if (N <= 0) return 0;
  return 1 - c.reduce((a, n) => a + (n / N) ** 2, 0);
}

/** Største mulige Simpson-indeks med S arter (alle like vanlige): 1 − 1/S. */
export const simpsonMax = (S: number): number => (S >= 1 ? 1 - 1 / S : 0);

/** Shannons indeks H = −Σ p_i · ln p_i. */
export function shannon(c: readonly number[]): number {
  const N = c.reduce((a, b) => a + b, 0);
  if (N <= 0) return 0;
  return -c.reduce((a, n) => (n > 0 ? a + (n / N) * Math.log(n / N) : a), 0);
}

/** Jevnhet (Pielou) J = H / ln S, mellom 0 og 1. Med én art er jevnheten ikke definert; da gir vi 1. */
export function pielou(c: readonly number[]): number {
  const S = c.filter((n) => n > 0).length;
  return S <= 1 ? 1 : shannon(c) / Math.log(S);
}

/**
 * Plasseringen av individene i en prøveflate (i en enhetsboks 0–1) og hvilken art hvert individ er. Plassene er faste
 * for samme frø; artene fordeles på plassene i en fast tilfeldig rekkefølge, så de blandes godt.
 */
export function plotIndividuals(c: readonly number[], seed: number): { x: number; y: number; species: number }[] {
  const N = c.reduce((a, b) => a + b, 0);
  const rnd = seededRandom(seed);
  // Jevnt spredte plasser: rutenett med litt tilfeldig forskyvning (ser naturlig ut, men overlapper ikke)
  const cols = Math.ceil(Math.sqrt(N * 1.4));
  const rows = Math.ceil(N / cols);
  const cells = Array.from({ length: cols * rows }, (_, i) => i);
  for (let i = cells.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [cells[i], cells[j]] = [cells[j]!, cells[i]!];
  }
  const out: { x: number; y: number; species: number }[] = [];
  let s = 0;
  let left = c[0] ?? 0;
  for (let i = 0; i < N; i++) {
    while (left <= 0 && s < c.length - 1) left = c[++s] ?? 0;
    const cell = cells[i]!;
    const cx = cell % cols;
    const cy = Math.floor(cell / cols);
    out.push({ x: (cx + 0.2 + 0.6 * rnd()) / cols, y: (cy + 0.2 + 0.6 * rnd()) / rows, species: s });
    left--;
  }
  return out;
}

export interface Community {
  S: number;
  evenness: number;
}

export const DIVERSITY_PRESETS: readonly { id: string; label: string; a: Community; b: Community }[] = [
  { id: 'jevnhet', label: 'Like mange arter, ulik jevnhet', a: { S: 8, evenness: 0.9 }, b: { S: 8, evenness: 0.1 } },
  { id: 'flere', label: 'Flest arter er ikke alltid mest mangfold', a: { S: 12, evenness: 0 }, b: { S: 5, evenness: 1 } },
  { id: 'plantasje', label: 'Naturskog og granplantasje', a: { S: 12, evenness: 0.8 }, b: { S: 3, evenness: 0.05 } },
];

/* ====================================================================== */
/* Arter og areal                                                           */
/* ====================================================================== */

/** Artsantall S = c · A^z (A i km²). */
export const speciesArea = (c: number, A: number, z: number): number => c * Math.max(0, A) ** z;

/**
 * Øyene: antall karplantearter på en øy med areal 1 km² helt inntil fastlandet. Tenkte, men realistiske tall:
 * med z = 0,25 får en øy på 100 km² ca. 130 arter og en på 10 000 km² ca. 400.
 */
export const ISLAND_C0 = 40;
/** Avstand (km) der innvandringen, og dermed c, har falt til 1/e (ca. 37 %). */
export const ISLAND_D0 = 200;

/** c for en øy i avstanden d (km) fra fastlandet: færre arter når fram jo lenger unna øya ligger. */
export const cOfDistance = (d: number): number => ISLAND_C0 * Math.exp(-Math.max(0, d) / ISLAND_D0);

/** Hvor mange ganger flere arter når arealet blir 10 ganger større: 10^z (Darlingtons tommelfingerregel ≈ 2). */
export const factorPerTenfold = (z: number): number => 10 ** z;

/** Andelen av artene som blir igjen når arealet halveres: 2^(−z). */
export const keptWhenHalved = (z: number): number => 2 ** -z;

/** Skogen før oppstykking: 100 km² (10 × 10 km) med 100 arter av gruppen vi teller. */
export const FOREST_AREA = 100;
export const FOREST_SPECIES_COUNT = 100;
/** Kantsone (km) der forholdene er annerledes (mer lys, vind og tørke) og arter som trenger indre skog, ikke klarer seg. */
export const EDGE_WIDTH = 0.1;

/** Antall skogbiter glidebryteren kan velge, med rutenettet de legges i. */
export const PATCH_LAYOUTS: readonly { n: number; rows: number; cols: number }[] = [
  { n: 1, rows: 1, cols: 1 },
  { n: 2, rows: 1, cols: 2 },
  { n: 4, rows: 2, cols: 2 },
  { n: 6, rows: 2, cols: 3 },
  { n: 9, rows: 3, cols: 3 },
  { n: 12, rows: 3, cols: 4 },
  { n: 16, rows: 4, cols: 4 },
  { n: 20, rows: 4, cols: 5 },
  { n: 25, rows: 5, cols: 5 },
];

export interface Fragmentation {
  /** Konstanten c i S = c · A^z, satt så den hele skogen har 100 arter. */
  c: number;
  /** Arealet som teller for artene i den hele skogen (indre skog med kanteffekt). */
  referenceArea: number;
  /** Skog som er igjen (km²). */
  remaining: number;
  /** Areal per bit (km²) og sidelengden til en kvadratisk bit (km). */
  patchArea: number;
  side: number;
  /** Indre skog per bit når kantsonen trekkes fra (km²). */
  core: number;
  /** Arealet som teller for artene (indre skog med kanteffekt, ellers hele biten). */
  effective: number;
  /** Arter som blir igjen på sikt. */
  species: number;
  /** Arter om den samme skogen var igjen i ett stykke (uten kanteffekt). */
  speciesOnePiece: number;
  /** Arter i hele skogen før inngrepet. */
  before: number;
}

/**
 * Arter som blir igjen når skogen (100 km², 100 arter) mister en andel `loss` og resten deles i n like store biter.
 * Med kanteffekt teller bare indre skog (mer enn EDGE_WIDTH fra kanten), også i den hele skogen. Forenklinger: c bestemmes
 * av den hele skogen; bitene har de samme artene (de som klarer seg på lite areal), så
 * landskapet har like mange arter som én bit; arter som trenger mer areal enn en bit, dør ut på sikt (utdøingsgjeld).
 */
export function fragmentation(n: number, loss: number, z: number, edge: boolean): Fragmentation {
  const coreOf = (area: number) => Math.max(0, Math.sqrt(area) - 2 * EDGE_WIDTH) ** 2;
  const eff = (area: number) => (edge ? coreOf(area) : area);
  // c er satt så den hele skogen (med sin egen ytterkant når kanteffekten er med) har akkurat 100 arter
  const referenceArea = eff(FOREST_AREA);
  const c = FOREST_SPECIES_COUNT / referenceArea ** z;
  const remaining = FOREST_AREA * (1 - Math.min(0.99, Math.max(0, loss)));
  const patchArea = remaining / Math.max(1, n);
  const side = Math.sqrt(patchArea);
  const core = coreOf(patchArea);
  const effective = eff(patchArea);
  return {
    c,
    referenceArea,
    remaining,
    patchArea,
    side,
    core,
    effective,
    species: speciesArea(c, effective, z),
    speciesOnePiece: speciesArea(c, eff(remaining), z),
    before: FOREST_SPECIES_COUNT,
  };
}

/* ====================================================================== */
/* Næringsnett                                                              */
/* ====================================================================== */

export type WebId =
  | 'gras'
  | 'blabaer'
  | 'lauvtraer'
  | 'bartraer'
  | 'smagnagere'
  | 'hare'
  | 'radyr'
  | 'elg'
  | 'insekter'
  | 'storfugl'
  | 'ekorn'
  | 'meis'
  | 'mar'
  | 'rev'
  | 'gaupe'
  | 'ulv'
  | 'kongeorn'
  | 'spurvehauk'
  | 'nedbrytere';

export type WebGlyph = 'plante' | 'tre' | 'bartre' | 'blabaer' | 'pattedyr' | 'smapattedyr' | 'insekt' | 'fugl' | 'rovfugl' | 'sopp';

export interface WebSpecies {
  id: WebId;
  name: string;
  /** Kort navn til figuren på mobil. */
  short: string;
  glyph: WebGlyph;
  /** Hva arten spiser, med omtrentlige andeler av dietten (summerer til 1). Tomt for produsenter og nedbrytere. */
  diet: Partial<Record<WebId, number>>;
  /** Hva den spiser (til forklaringen). */
  food?: string;
}

/**
 * Næringsnett i norsk barskog. Diettandelene er grove, avrundede anslag fra norsk naturforvaltning og lærebøker
 * (f.eks. at elgen beiter mest på lauvtrær som rogn, osp og selje, at ulven i Skandinavia lever mest av elg, og at
 * gaupa tar mest rådyr), og er bare ment å vise hvilke koblinger som er sterke og svake.
 */
export const WEB: readonly WebSpecies[] = [
  { id: 'gras', name: 'gras og urter', short: 'gras/urter', glyph: 'plante', diet: {} },
  { id: 'blabaer', name: 'blåbærlyng', short: 'blåbær', glyph: 'blabaer', diet: {} },
  { id: 'lauvtraer', name: 'lauvtrær (rogn, osp, selje, bjørk)', short: 'lauvtrær', glyph: 'tre', diet: {} },
  { id: 'bartraer', name: 'gran og furu', short: 'gran/furu', glyph: 'bartre', diet: {} },
  { id: 'smagnagere', name: 'smågnagere', short: 'smågnagere', glyph: 'smapattedyr', diet: { blabaer: 0.35, gras: 0.35, bartraer: 0.3 }, food: 'frø, bær og gras' },
  { id: 'hare', name: 'hare', short: 'hare', glyph: 'smapattedyr', diet: { gras: 0.35, blabaer: 0.25, lauvtraer: 0.4 }, food: 'gras, lyng og kvister' },
  { id: 'radyr', name: 'rådyr', short: 'rådyr', glyph: 'pattedyr', diet: { gras: 0.4, lauvtraer: 0.35, blabaer: 0.25 }, food: 'urter, skudd og lyng' },
  { id: 'elg', name: 'elg', short: 'elg', glyph: 'pattedyr', diet: { lauvtraer: 0.45, bartraer: 0.25, blabaer: 0.3 }, food: 'kvister av lauvtrær og furu, og blåbærlyng' },
  { id: 'insekter', name: 'insekter og larver', short: 'insekter', glyph: 'insekt', diet: { bartraer: 0.4, blabaer: 0.3, lauvtraer: 0.3 }, food: 'blader, nåler og ved' },
  { id: 'storfugl', name: 'storfugl', short: 'storfugl', glyph: 'fugl', diet: { bartraer: 0.5, blabaer: 0.4, insekter: 0.1 }, food: 'furunåler, blåbærlyng og insekter' },
  { id: 'ekorn', name: 'ekorn', short: 'ekorn', glyph: 'smapattedyr', diet: { bartraer: 0.85, lauvtraer: 0.15 }, food: 'frø fra kongler og knopper' },
  { id: 'meis', name: 'meiser', short: 'meiser', glyph: 'fugl', diet: { insekter: 0.75, bartraer: 0.25 }, food: 'insekter og frø' },
  { id: 'mar', name: 'mår', short: 'mår', glyph: 'pattedyr', diet: { smagnagere: 0.5, ekorn: 0.25, meis: 0.1, blabaer: 0.15 }, food: 'smågnagere, ekorn, fugler og bær' },
  { id: 'rev', name: 'rødrev', short: 'rev', glyph: 'pattedyr', diet: { smagnagere: 0.55, hare: 0.2, storfugl: 0.15, blabaer: 0.1 }, food: 'smågnagere, hare, fugl og bær' },
  { id: 'gaupe', name: 'gaupe', short: 'gaupe', glyph: 'pattedyr', diet: { radyr: 0.6, hare: 0.25, storfugl: 0.1, rev: 0.05 }, food: 'rådyr, hare og skogsfugl' },
  { id: 'ulv', name: 'ulv', short: 'ulv', glyph: 'pattedyr', diet: { elg: 0.8, radyr: 0.2 }, food: 'elg og rådyr' },
  { id: 'kongeorn', name: 'kongeørn', short: 'kongeørn', glyph: 'rovfugl', diet: { hare: 0.45, storfugl: 0.35, rev: 0.2 }, food: 'hare, skogsfugl og revunger' },
  { id: 'spurvehauk', name: 'spurvehauk', short: 'spurvehauk', glyph: 'rovfugl', diet: { meis: 1 }, food: 'småfugler' },
  { id: 'nedbrytere', name: 'nedbrytere (sopp, bakterier, meitemark)', short: 'nedbrytere', glyph: 'sopp', diet: {} },
];

const BY_ID = new Map(WEB.map((s) => [s.id, s]));
export const webSpecies = (id: WebId): WebSpecies => BY_ID.get(id)!;

export const isProducer = (s: WebSpecies) => s.id !== 'nedbrytere' && Object.keys(s.diet).length === 0;
export const preyOf = (id: WebId): WebId[] => Object.keys(webSpecies(id).diet) as WebId[];
export const predatorsOf = (id: WebId): WebId[] => WEB.filter((s) => s.diet[id] !== undefined).map((s) => s.id);

/** Trofisk nivå: produsenter = 1, andre = 1 + vektet snitt av nivåene til maten. Nedbrytere får ikke noe nivå. */
export function trophicLevels(): Map<WebId, number> {
  const tl = new Map<WebId, number>();
  for (const s of WEB) if (s.id !== 'nedbrytere') tl.set(s.id, 1);
  for (let it = 0; it < 50; it++)
    for (const s of WEB) {
      if (s.id === 'nedbrytere' || isProducer(s)) continue;
      let v = 1;
      for (const [p, w] of Object.entries(s.diet) as [WebId, number][]) v += w * (tl.get(p) ?? 1);
      tl.set(s.id, v);
    }
  return tl;
}

/** Rad i figuren (1 = produsenter … 4 = tertiærkonsumenter), etter avrundet trofisk nivå. */
export function webRow(id: WebId, tl = trophicLevels()): number {
  return id === 'nedbrytere' ? 0 : Math.round(tl.get(id) ?? 1);
}

export type EffectKind = 'fjernet' | 'dor-ut' | 'oker' | 'minker' | 'usikker';

export interface Effect {
  kind: EffectKind;
  /** Netto endring (−1 … 1), grovt mål på hvor sterk virkningen er. */
  value: number;
  /** 0 = arten som er fjernet, 1 = direkte virkning (nabo i nettet), 2 = indirekte. */
  round: number;
}

/**
 * Andre dødsårsaker enn artene i nettet (jakt, sykdom, sult, vær, andre planteetere), i samme mål som diettandelene.
 * Uten dette ville en art med bare én fiende i nettet (som reven) blitt helt sluppet fri når fienden fjernes.
 */
export const OTHER_MORTALITY = 0.5;

/** Virkninger mindre enn dette regnes som ubetydelige. */
export const EFFECT_THRESHOLD = 0.08;
const ROUNDS = 2;

/**
 * Enkel kaskadelogikk når én art fjernes. Runde 1 (direkte): de som spiste arten, mister mat (andelen den utgjorde av
 * dietten; mister de all maten, dør de ut), og det arten spiste, slipper beitetrykk eller predasjon (andelen arten sto
 * for av dødeligheten, der også jakt, sykdom og andre årsaker teller med). Runde 2 (indirekte): endringene sprer seg ett ledd videre etter samme regler. Uten nedbrytere resirkuleres ikke
 * næringsstoffer, så produsentene minker. Virkningene summeres; får en art både sterk økning og sterk nedgang, er
 * utfallet usikkert. Ingen tilbakekobling og ingen tid: modellen viser retning, ikke tall.
 */
export function cascade(removed: WebId | null): Map<WebId, Effect> {
  const out = new Map<WebId, Effect>();
  if (!removed) return out;
  const gone = new Set<WebId>([removed]);
  out.set(removed, { kind: 'fjernet', value: -1, round: 0 });
  const pos = new Map<WebId, number>();
  const neg = new Map<WebId, number>();
  const first = new Map<WebId, number>();
  const add = (id: WebId, v: number, round: number, inc: Map<WebId, number>) => {
    if (gone.has(id) || Math.abs(v) < 1e-9) return;
    (v > 0 ? pos : neg).set(id, ((v > 0 ? pos : neg).get(id) ?? 0) + v);
    inc.set(id, (inc.get(id) ?? 0) + v);
    if (!first.has(id)) first.set(id, round);
  };
  // Hvor stor del av dødeligheten (beiting/predasjon) til `prey` som kommer fra `pred`, blant dem som er igjen og
  // andre dødsårsaker (OTHER_MORTALITY)
  const predationShare = (prey: WebId, pred: WebId) => {
    const total = predatorsOf(prey)
      .filter((p) => !gone.has(p) || p === pred)
      .reduce((a, p) => a + (webSpecies(p).diet[prey] ?? 0), OTHER_MORTALITY);
    return (webSpecies(pred).diet[prey] ?? 0) / total;
  };
  let frontier = new Map<WebId, number>([[removed, -1]]);
  for (let round = 1; round <= ROUNDS; round++) {
    const inc = new Map<WebId, number>();
    for (const [m, dm] of frontier) {
      for (const p of predatorsOf(m)) add(p, (webSpecies(p).diet[m] ?? 0) * dm, round, inc);
      for (const q of preyOf(m)) add(q, -predationShare(q, m) * dm, round, inc);
      if (m === 'nedbrytere') for (const s of WEB) if (isProducer(s)) add(s.id, 0.5 * dm, round, inc);
    }
    // Dør ut: all maten er borte
    const next = new Map<WebId, number>();
    for (const [id, v] of inc) {
      const prey = preyOf(id);
      if (prey.length && prey.every((p) => gone.has(p))) {
        gone.add(id);
        out.set(id, { kind: 'dor-ut', value: -1, round });
        next.set(id, -1);
      } else if (Math.abs(v) >= EFFECT_THRESHOLD) next.set(id, v);
    }
    frontier = next;
  }
  for (const [id, r] of first) {
    if (out.has(id)) continue;
    const p = pos.get(id) ?? 0;
    const n = neg.get(id) ?? 0;
    const total = Math.max(-1, Math.min(1, p + n));
    const both = p >= EFFECT_THRESHOLD && -n >= EFFECT_THRESHOLD;
    if (both && Math.min(p, -n) > 0.5 * Math.max(p, -n)) out.set(id, { kind: 'usikker', value: total, round: r });
    else if (Math.abs(total) >= EFFECT_THRESHOLD) out.set(id, { kind: total > 0 ? 'oker' : 'minker', value: total, round: r });
  }
  return out;
}

export interface EffectSummary {
  /** Runde 1: arter som spiser eller blir spist av arten som er fjernet. */
  direct: Record<Exclude<EffectKind, 'fjernet'>, WebId[]>;
  /** Runde 2: virkninger som har gått via en annen art. */
  indirect: Record<Exclude<EffectKind, 'fjernet'>, WebId[]>;
}

/** Virkningene sortert etter runde og type, i rekkefølgen artene står i nettet. */
export function summarizeEffects(effects: Map<WebId, Effect>): EffectSummary {
  const empty = () => ({ 'dor-ut': [] as WebId[], oker: [] as WebId[], minker: [] as WebId[], usikker: [] as WebId[] });
  const out: EffectSummary = { direct: empty(), indirect: empty() };
  for (const s of WEB) {
    const e = effects.get(s.id);
    if (!e || e.kind === 'fjernet') continue;
    (e.round <= 1 ? out.direct : out.indirect)[e.kind].push(s.id);
  }
  return out;
}

/** Forhåndsvalg: arter som viser typiske kaskader. */
export const REMOVAL_PRESETS: readonly { id: WebId; label: string }[] = [
  { id: 'ulv', label: 'Ulv' },
  { id: 'smagnagere', label: 'Smågnagere' },
  { id: 'meis', label: 'Meiser' },
  { id: 'lauvtraer', label: 'Lauvtrær' },
  { id: 'nedbrytere', label: 'Nedbrytere' },
];

/* ---------- Energipyramiden ---------- */

/**
 * Netto primærproduksjon i boreal barskog: ca. 800 g tørrstoff per m² per år (Whittaker og Likens), og ca. 20 kJ per
 * gram, altså ca. 16 000 kJ per m² per år som planteeterne kan leve av.
 */
export const PRIMARY_ENERGY = 16000;

export const LEVEL_NAMES = ['Produsenter', 'Primærkonsumenter', 'Sekundærkonsumenter', 'Tertiærkonsumenter'] as const;

/** Energien på hvert trofisk nivå når en andel `efficiency` går videre til neste nivå (kJ per m² per år). */
export function energyPyramid(efficiency: number, levels = 4, E1 = PRIMARY_ENERGY): number[] {
  return Array.from({ length: levels }, (_, i) => E1 * efficiency ** i);
}
