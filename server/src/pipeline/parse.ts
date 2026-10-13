import { ConversionError } from '../errors.js';
import type { FigureBox } from './images.js';

export interface NoteMeta {
  title: string | null;
  /** Kapittel-alias fra listen i forespørselen, f.eks. «k3». */
  chapter: string | null;
  /** Kode for delkapittelet, f.eks. «2E». */
  section: string | null;
  newChapter: { number: string | null; title: string } | null;
  date: string | null;
  figures: FigureBox[];
  remarks: string[];
}

export const EMPTY_META: NoteMeta = { title: null, chapter: null, section: null, newChapter: null, date: null, figures: [], remarks: [] };

const str = (v: unknown, max = 200): string | null => (typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : null);

function isValidDate(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().startsWith(s);
}

/** Matematikk i korttekst: `$…$` og `$$…$$`. */
const MATH = /\$\$[\s\S]*?\$\$|\$[^$]*\$/g;

/**
 * Retter LaTeX som en liten modell har skrevet feil i JSON. Skriver den `\frac` i stedet for `\\frac`, leser JSON det som
 * sideskift + «rac», og `\theta` blir tabulator + «heta». Ollama tillater disse escape-tegnene, så ingenting feiler,
 * men kortene blir feil. Sideskift og backspace hører aldri hjemme i teksten og gjøres alltid om. Linjeskift,
 * tabulator og vognretur gjøres om bare inne i `$…$` og foran bokstaver (`\nu`, `\neq`, `\rho`), siden et ekte
 * linjeskift foran et ord er vanlig i vanlig tekst.
 */
export function repairLatexEscapes<T>(value: T): T {
  if (typeof value === 'string') {
    return value
      .replace(/\f/g, '\\f')
      .replace(/\x08/g, '\\b')
      .replace(MATH, (math) =>
        math
          .replace(/\n(?=[A-Za-z])/g, '\\n')
          .replace(/\t(?=[A-Za-z])/g, '\\t')
          .replace(/\r(?=[A-Za-z])/g, '\\r'),
      ) as T;
  }
  if (Array.isArray(value)) return value.map((v) => repairLatexEscapes(v)) as T;
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, repairLatexEscapes(v)])) as T;
  return value;
}

/**
 * Gjør ugyldige escape-tegn i JSON gyldige: en modell som skriver LaTeX i en streng («$\vec{F}$», «\Delta v»), lager
 * escape-tegn JSON ikke kjenner. Gyldige par (`\\`, `\"`, `\n`, `\u00e6` …) beholdes; et ensomt `\` foran noe annet
 * (også `\u` uten fire sifre, som i `\uleselig`) dobles.
 */
function escapeLoneBackslashes(json: string): string {
  return json.replace(/\\(u[0-9a-fA-F]{4}|["\\/bfnrt])?/g, (m, c?: string) => (c ? m : '\\\\'));
}

/** Tolker metadata-JSON fra Claude tolerant: ugyldige felter blir ignorert i stedet for å feile. */
export function parseMeta(raw: string): NoteMeta {
  let json = raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  const start = json.indexOf('{');
  const end = json.lastIndexOf('}');
  if (start === -1 || end === -1) return { ...EMPTY_META };
  json = json.slice(start, end + 1);
  let obj: Record<string, unknown>;
  try {
    obj = JSON.parse(json) as Record<string, unknown>;
  } catch {
    // Én LaTeX-kommando i en merknad skal ikke slette tittelen, kapittelet og alle figurene.
    try {
      obj = JSON.parse(escapeLoneBackslashes(json)) as Record<string, unknown>;
    } catch {
      return { ...EMPTY_META };
    }
  }
  // `\frac` blir sideskift + «rac» i JSON; gjør slike tegn om til LaTeX igjen.
  obj = repairLatexEscapes(obj);

  const date = str(obj.date, 10);
  const nc = obj.new_chapter ?? obj.newChapter;
  let newChapter: NoteMeta['newChapter'] = null;
  if (nc && typeof nc === 'object') {
    const title = str((nc as Record<string, unknown>).title, 120);
    const number = (nc as Record<string, unknown>).number;
    if (title) newChapter = { title, number: typeof number === 'number' ? String(number) : str(number, 20) };
  }

  const figures: FigureBox[] = [];
  if (Array.isArray(obj.figures)) {
    for (const f of obj.figures) {
      if (!f || typeof f !== 'object') continue;
      const r = f as Record<string, unknown>;
      const id = str(r.id, 40);
      const page = Number(r.page);
      // «bbox_2d» er navnet Qwen-modellene bruker selv.
      const box = r.box ?? r.bbox ?? r.bbox_2d;
      if (!id || !/^[A-Za-z0-9_-]+$/.test(id) || !Number.isInteger(page) || page < 1) continue;
      if (!Array.isArray(box) || box.length !== 4 || !box.every((v) => Number.isFinite(Number(v)))) continue;
      figures.push({ id, page, box: box.map(Number) as FigureBox['box'] });
    }
  }

  const remarks = Array.isArray(obj.remarks)
    ? obj.remarks.map((r) => str(r, 400)).filter((r): r is string => r !== null).slice(0, 20)
    : [];

  return {
    title: str(obj.title, 120),
    chapter: str(obj.chapter, 20),
    section: str(obj.section, 12),
    newChapter,
    date: date && isValidDate(date) ? date : null,
    figures,
    remarks,
  };
}

/** Henter <metadata> og <latex> fra svaret til Claude. */
export function parseConversion(text: string): { meta: NoteMeta; body: string } {
  const metaMatch = /<metadata>\s*([\s\S]*?)\s*<\/metadata>/i.exec(text);
  const meta = metaMatch ? parseMeta(metaMatch[1]!) : { ...EMPTY_META };
  const body = extractLatex(text);
  if (body === null) {
    throw new ConversionError('Claude svarte i et uventet format. Prøv å konvertere på nytt.');
  }
  return { meta, body };
}

/** Innholdet i <latex>…</latex>. Kaster hvis blokken er åpnet men ikke lukket (avkortet svar). */
export function extractLatex(text: string): string | null {
  const m = /<latex>\s*([\s\S]*?)\s*<\/latex>/i.exec(text);
  if (m) return m[1]!;
  if (/<latex>/i.test(text)) {
    throw new ConversionError('Svaret fra Claude ble avkortet. Del notatet opp i færre sider og prøv igjen.');
  }
  return null;
}
