import type { ChapterInput } from '@smartnotes/shared';

const NUMBER_RE = /^(\d+(?:\.\d+)*|[IVXLC]+)[.):]?\s+(?:[-–—:]\s*)?(.+)$/;

/**
 * Tolker en innlimt innholdsfortegnelse, én linje per kapittel. Tåler varianter som
 *   «1 Fysikk og måling», «Kapittel 3: Newtons lover», «3.2 Krefter ........ 45», «Kap. 4 – Energi  78»
 * Sidetall og prikkelinjer fjernes. Linjer uten nummer får number = null.
 */
export function parseTocText(text: string): ChapterInput[] {
  const out: ChapterInput[] = [];
  for (const raw of text.split(/\r?\n/)) {
    let line = raw.replace(/\t/g, '  ').replace(/ /g, ' ').trim();
    if (!line || /^\d+$/.test(line)) continue;
    line = line.replace(/^[-–•*·]\s+/, ''); // punkttegn
    line = line.replace(/^(?:kapittel|kap\.?|chapter|del)\s+/i, ''); // «Kapittel 3 …»
    // Prikkelinjer eller stor avstand før sidetall
    line = line.replace(/\s*(?:\.{2,}|…+|\s{2,})\s*\d{1,4}\s*$/, '').replace(/\s*\.{2,}\s*$/, '');
    const m = NUMBER_RE.exec(line);
    if (m) {
      // «3 Newtons lover 45»: et nummerert kapittel med sidetall til slutt
      const title = m[2]!.replace(/\s+\d{1,4}$/, '').trim();
      if (title) out.push({ number: m[1]!, title });
    } else {
      out.push({ number: null, title: line });
    }
  }
  return out.filter((c) => c.title.length > 0 && c.title.length <= 200).slice(0, 200);
}
