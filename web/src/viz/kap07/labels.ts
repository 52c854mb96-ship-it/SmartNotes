/**
 * Plasserer etiketter langs en akse i opptil `rows` rader så de ikke overlapper. Etikettene tas i rekkefølge etter x,
 * og hver etikett får den første raden der den har plass. Gir radnummeret for hver etikett, eller −1 hvis den må utelates.
 */
export function placeLabels(items: { x: number; width: number }[], rows: number, gap = 6): number[] {
  const order = items.map((_, i) => i).sort((a, b) => items[a]!.x - items[b]!.x);
  const end = new Array<number>(rows).fill(-Infinity);
  const out = new Array<number>(items.length).fill(-1);
  for (const i of order) {
    const it = items[i]!;
    const left = it.x - it.width / 2;
    for (let r = 0; r < rows; r++) {
      if (left >= end[r]! + gap) {
        out[i] = r;
        end[r] = it.x + it.width / 2;
        break;
      }
    }
  }
  return out;
}
