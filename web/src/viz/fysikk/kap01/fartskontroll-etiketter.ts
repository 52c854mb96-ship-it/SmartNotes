/**
 * Plassering av etiketter i grafene til «Streknings-ATK» (k1-fartskontroll): etiketten til en linje (sekant,
 * fartsgrense, snittfart) settes der det er mest ledig plass langs linja, så den ikke havner oppå en graf eller en
 * annen etikett når linjene ligger tett (f.eks. snittfart 78 km/h og fartsgrense 80 km/h). Ren geometri uten React.
 */

export interface Pt {
  x: number;
  y: number;
}

/** Etikett som rektangel: midtpunkt, bredde og høyde (skjermkoordinater). */
export interface LabelBox {
  cx: number;
  cy: number;
  w: number;
  h: number;
}

export interface Area {
  x0: number;
  x1: number;
  /** Øverst (minste y) og nederst (største y). */
  top: number;
  bottom: number;
}

/** Avstanden fra et punkt til et rektangel (0 når punktet ligger inne i det). */
export function distToBox(p: Pt, b: LabelBox): number {
  const dx = Math.max(b.cx - b.w / 2 - p.x, 0, p.x - (b.cx + b.w / 2));
  const dy = Math.max(b.cy - b.h / 2 - p.y, 0, p.y - (b.cy + b.h / 2));
  return Math.hypot(dx, dy);
}

/** n + 1 punkter jevnt fordelt langs linjestykket fra a til b. */
export function segmentPoints(a: Pt, b: Pt, n = 24): Pt[] {
  return Array.from({ length: n + 1 }, (_, i) => ({ x: a.x + ((b.x - a.x) * i) / n, y: a.y + ((b.y - a.y) * i) / n }));
}

/** Punkter langs kanten av en etikett som allerede er plassert, så neste etikett holder avstand til den. */
export function boxPoints(b: LabelBox, n = 6): Pt[] {
  const l = b.cx - b.w / 2;
  const r = b.cx + b.w / 2;
  const t = b.cy - b.h / 2;
  const u = b.cy + b.h / 2;
  return [
    ...segmentPoints({ x: l, y: t }, { x: r, y: t }, n),
    ...segmentPoints({ x: l, y: u }, { x: r, y: u }, n),
    { x: l, y: b.cy },
    { x: r, y: b.cy },
  ];
}

/** Hvor mye boksen stikker utenfor området (0 når den er helt inne). */
function overflow(b: LabelBox, area: Area): number {
  return (
    Math.max(0, area.x0 - (b.cx - b.w / 2)) +
    Math.max(0, b.cx + b.w / 2 - area.x1) +
    Math.max(0, area.top - (b.cy - b.h / 2)) +
    Math.max(0, b.cy + b.h / 2 - area.bottom)
  );
}

/**
 * Plasserer en etikett (w × h) ved siden av linjestykket a → b: prøver flere steder langs linja (`fractions`) på
 * begge sider, med avstanden `gap` fra linja, og velger plassen med størst klaring til hindringene (punkter på
 * grafer, linjer og andre etiketter). Plasser som stikker utenfor `area`, velges bare når ingen andre finnes.
 * `prefer` er den plassen langs linja som foretrekkes når flere er like ledige.
 */
export function placeAlongSegment(
  a: Pt,
  b: Pt,
  w: number,
  h: number,
  gap: number,
  obstacles: Pt[],
  area: Area,
  { fractions = [0.25, 0.35, 0.45, 0.55, 0.65, 0.75, 0.85], prefer = 0.55 }: { fractions?: number[]; prefer?: number } = {},
): LabelBox {
  const len = Math.hypot(b.x - a.x, b.y - a.y);
  const ux = len > 0 ? (b.x - a.x) / len : 1;
  const uy = len > 0 ? (b.y - a.y) / len : 0;
  // Normalen; avstanden fra linja til midten av boksen avhenger av hvordan boksen står i forhold til linja.
  const nx = -uy;
  const ny = ux;
  const reach = (Math.abs(nx) * w) / 2 + (Math.abs(ny) * h) / 2;
  let best: LabelBox | null = null;
  let bestScore = -Infinity;
  for (const fr of fractions) {
    for (const side of [1, -1]) {
      const px = a.x + (b.x - a.x) * fr;
      const py = a.y + (b.y - a.y) * fr;
      const box = { cx: px + side * nx * (gap + reach), cy: py + side * ny * (gap + reach), w, h };
      let clear = Infinity;
      for (const p of obstacles) clear = Math.min(clear, distToBox(p, box));
      if (!Number.isFinite(clear)) clear = 1000;
      const out = overflow(box, area);
      const score = (out > 0 ? -1000 - out : Math.min(clear, 40)) - Math.abs(fr - prefer) * 6;
      if (score > bestScore) {
        bestScore = score;
        best = box;
      }
    }
  }
  return best ?? { cx: (a.x + b.x) / 2, cy: (a.y + b.y) / 2, w, h };
}

/** Bredden og høyden på en etikett med `chars` tegn og skriftstørrelsen `fs` (omtrent, for vanlig skrift). */
export function textBox(chars: number, fs: number): { w: number; h: number } {
  return { w: chars * fs * 0.58 + 4, h: fs * 0.9 };
}
