/** Plassering av skapdørene i kjøkkenet i «Vannkoker eller kokeplate» (ren funksjon, testes). */

/** Skapdørene langs benken: én dør sentrert under hvert apparat, og resten fylt med dører av omtrent lik bredde. */
export function doorLayout(W: number, doorW: number, centers: number[]): [number, number][] {
  const fixed: [number, number][] = [...centers]
    .sort((a, b) => a - b)
    .map((c) => [Math.max(0, c - doorW / 2), Math.min(W, c + doorW / 2)]);
  for (let i = 1; i < fixed.length; i++) {
    const a = fixed[i - 1]!;
    const b = fixed[i]!;
    if (b[0] < a[1]) {
      const mid = (a[1] + b[0]) / 2;
      a[1] = mid;
      b[0] = mid;
    }
  }
  // Smale rester blir ikke egne dører: ytterst slås de sammen med nabodøra, mellom to dører deles de.
  const narrow = 0.36 * doorW;
  const first = fixed[0];
  if (first && first[0] > 0 && first[0] < narrow) first[0] = 0;
  const last = fixed[fixed.length - 1];
  if (last && last[1] < W && W - last[1] < narrow) last[1] = W;
  for (let i = 1; i < fixed.length; i++) {
    const a = fixed[i - 1]!;
    const b = fixed[i]!;
    if (b[0] > a[1] && b[0] - a[1] < narrow) {
      const mid = (a[1] + b[0]) / 2;
      a[1] = mid;
      b[0] = mid;
    }
  }
  const out: [number, number][] = [];
  let x = 0;
  for (const d of [...fixed, [W, W] as [number, number]]) {
    const gap = d[0] - x;
    if (gap > 1) {
      const n = Math.max(1, Math.round(gap / doorW));
      for (let k = 0; k < n; k++) out.push([x + (gap * k) / n, x + (gap * (k + 1)) / n]);
    }
    if (d[1] > d[0]) out.push(d);
    x = d[1];
  }
  return out;
}
