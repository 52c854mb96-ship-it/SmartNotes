import type { ChapterInput, CompetenceAim, Section } from '@smartnotes/shared';

const NUMBER_RE = /^(\d+(?:\.\d+)*|[IVXLC]+)[.):]?\s+(?:[-–—:]\s*)?(.+)$/;
/** Delkapittel med bokstavkode som i ERGO Fysikk 1: «2A Krefter», «10D Elektrisk effekt». */
const LETTER_SECTION_RE = /^(\d+)([A-Z])[.):]?\s+(?:[-–—:]\s*)?(.+)$/;

/** Høyst så mange delkapitler per kapittel (samme grense som API-et). */
export const MAX_SECTIONS = 60;

/**
 * Tolker en innlimt innholdsfortegnelse, én linje per kapittel eller delkapittel. Tåler varianter som
 *   «1 Fysikk og måling», «Kapittel 3: Newtons lover», «3.2 Krefter ........ 45», «Kap. 4 – Energi  78»
 * Sidetall og prikkelinjer fjernes. Linjer uten nummer får number = null.
 *
 * Delkapitler: «2.1 …» eller «2A …» rett under kapittel 2 blir delkapitler i kapittel 2. Står «3.2 …» uten et
 * kapittel 3 foran seg, regnes det som et kapittel (noen bøker nummererer kapitlene slik). Dypere nivåer
 * («2.1.3 …») inne i et kapittel hoppes over.
 */
export function parseTocText(text: string): ChapterInput[] {
  const out: ChapterInput[] = [];
  let current = null as ChapterInput | null;
  const addSection = (chapter: ChapterInput, code: string, title: string) => {
    const sections = (chapter.sections ??= []);
    if (sections.length < MAX_SECTIONS && !sections.some((s) => s.code === code)) sections.push({ code, title, aims: [] });
  };
  for (const raw of text.split(/\r?\n/)) {
    let line = raw.replace(/\t/g, '  ').replace(/ /g, ' ').trim();
    if (!line || /^\d+$/.test(line)) continue;
    line = line.replace(/^[-–•*·]\s+/, ''); // punkttegn
    line = line.replace(/^(?:kapittel|kap\.?|chapter|del)\s+/i, ''); // «Kapittel 3 …»
    // Prikkelinjer eller stor avstand før sidetall
    line = line.replace(/\s*(?:\.{2,}|…+|\s{2,})\s*\d{1,4}\s*$/, '').replace(/\s*\.{2,}\s*$/, '');

    const letter = LETTER_SECTION_RE.exec(line);
    if (letter) {
      const title = cleanTitle(letter[3]!);
      if (current && current.number === letter[1] && title) addSection(current, `${letter[1]}${letter[2]}`, title);
      else if (title) out.push((current = { number: `${letter[1]}${letter[2]}`, title }));
      continue;
    }
    const m = NUMBER_RE.exec(line);
    if (m) {
      // «3 Newtons lover 45»: et nummerert kapittel med sidetall til slutt
      const number = m[1]!;
      const title = cleanTitle(m[2]!);
      if (!title) continue;
      const parts = number.split('.');
      if (parts.length > 1 && current?.number && number.startsWith(`${current.number}.`)) {
        // Delkapittel i kapittelet over (eller et dypere nivå, som hoppes over)
        if (parts.length === current.number.split('.').length + 1) addSection(current, number, title);
        continue;
      }
      out.push((current = { number, title }));
    } else {
      out.push((current = { number: null, title: line }));
    }
  }
  return out.filter((c) => c.title.length > 0 && c.title.length <= 200).slice(0, 200);
}

function cleanTitle(title: string): string {
  return title.replace(/\s+\d{1,4}$/, '').trim();
}

/**
 * Rydder i kapitler fra Claude eller klienten: tomme titler bort, unike delkapittelkoder per kapittel, og bare
 * kompetansemål som faktisk finnes i faget (og høyst tre per delkapittel).
 */
export function cleanChapterInputs(chapters: ChapterInput[], aims: CompetenceAim[]): ChapterInput[] {
  const known = new Set(aims.map((a) => a.code));
  return chapters
    .map((c) => {
      const title = c.title.trim();
      const seen = new Set<string>();
      const sections: Section[] = [];
      for (const s of c.sections ?? []) {
        const code = s.code.trim();
        const sTitle = s.title.trim();
        if (!code || !sTitle || code.length > 12 || sTitle.length > 200 || seen.has(code.toUpperCase())) continue;
        seen.add(code.toUpperCase());
        sections.push({ code, title: sTitle, aims: [...new Set(s.aims.map((a) => a.trim()))].filter((a) => known.has(a)).slice(0, 3) });
        if (sections.length >= MAX_SECTIONS) break;
      }
      const out: ChapterInput = { number: c.number?.trim() || null, title };
      if (sections.length) out.sections = sections;
      return out;
    })
    .filter((c) => c.title.length > 0 && c.title.length <= 200)
    .slice(0, 200);
}

/** Kompetansemålene som en kort liste til Claude: «KM3: forklare …». Tverrgående mål merkes. */
export function aimsForPrompt(aims: CompetenceAim[]): string {
  return aims.map((a) => `${a.code}: ${a.text}${a.cross ? ' (går på tvers av kapitlene)' : ''}`).join('\n');
}
