/**
 * Plasserer etiketter langs en akse i opptil `rows` rader så de ikke overlapper. Etikettene med høyest `priority`
 * plasseres først (ellers i rekkefølge etter x), og hver etikett får den første raden der den ikke overlapper noen av
 * etikettene som alt står der. Gir radnummeret for hver etikett, eller −1 hvis den må utelates.
 */
export function placeLabels(items: { x: number; width: number; priority?: number }[], rows: number, gap = 6): number[] {
  const order = items
    .map((_, i) => i)
    .sort((a, b) => (items[b]!.priority ?? 0) - (items[a]!.priority ?? 0) || items[a]!.x - items[b]!.x);
  const placed: [number, number][][] = Array.from({ length: rows }, () => []);
  const out = new Array<number>(items.length).fill(-1);
  for (const i of order) {
    const it = items[i]!;
    const left = it.x - it.width / 2;
    const right = it.x + it.width / 2;
    for (let r = 0; r < rows; r++) {
      const row = placed[r]!;
      if (row.every(([l, rr]) => left >= rr + gap || right + gap <= l)) {
        out[i] = r;
        row.push([left, right]);
        break;
      }
    }
  }
  return out;
}
