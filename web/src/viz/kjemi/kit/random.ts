/**
 * Tilfeldige tall med fast frø, så partikkelbilder, tester og skjermbilder blir like hver gang. Bruk aldri Math.random.
 */

/** Enkel tallgenerator med fast frø (mulberry32). Gir tall i [0, 1). */
export function seededRandom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface PlacedParticle {
  x: number;
  y: number;
  r: number;
  /** Indeks i lista med grupper. */
  group: number;
  /** Nummer innen gruppa. */
  index: number;
  /** Fast fase (0–2π) til bevegelse, se `jiggle`. */
  phase: number;
}

/**
 * Sprer partikler tilfeldig (men alltid likt for samme frø) i et rektangel uten at de overlapper, så langt det er
 * plass. Partiklene holder seg helt inne i boksen. Gruppene blandes, så ioner av ulik type ikke klumper seg.
 *
 *   placeParticles({ x: 0, y: 0, w: 200, h: 100 }, [{ n: 6, r: 8 }, { n: 6, r: 11 }], 7)
 */
export function placeParticles(box: Box, groups: { n: number; r: number }[], seed = 1, gap = 3): PlacedParticle[] {
  const rnd = seededRandom(seed);
  // Én liste med alle partiklene, i tilfeldig rekkefølge, så de største ikke alltid plasseres først.
  const order: { group: number; index: number; r: number }[] = [];
  groups.forEach((g, gi) => {
    for (let i = 0; i < Math.max(0, Math.floor(g.n)); i++) order.push({ group: gi, index: i, r: g.r });
  });
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [order[i], order[j]] = [order[j]!, order[i]!];
  }
  const placed: PlacedParticle[] = [];
  for (const p of order) {
    const minX = box.x + p.r;
    const maxX = box.x + box.w - p.r;
    const minY = box.y + p.r;
    const maxY = box.y + box.h - p.r;
    let best: { x: number; y: number } | null = null;
    let bestOverlap = Infinity;
    for (let tries = 0; tries < 60; tries++) {
      const x = maxX > minX ? minX + rnd() * (maxX - minX) : box.x + box.w / 2;
      const y = maxY > minY ? minY + rnd() * (maxY - minY) : box.y + box.h / 2;
      let overlap = 0;
      for (const q of placed) overlap = Math.max(overlap, p.r + q.r + gap - Math.hypot(x - q.x, y - q.y));
      if (overlap <= 0) {
        best = { x, y };
        break;
      }
      if (overlap < bestOverlap) {
        bestOverlap = overlap;
        best = { x, y };
      }
    }
    placed.push({ ...best!, r: p.r, group: p.group, index: p.index, phase: rnd() * Math.PI * 2 });
  }
  return placed;
}

/**
 * Liten, jevn «varmebevegelse» for en partikkel ved tiden t (sekunder): forskyvning på høyst `amplitude` i hver
 * retning. Deterministisk, så samme t alltid gir samme bilde. Bruk med `useSimClock`.
 */
export function jiggle(p: PlacedParticle, t: number, amplitude: number): { x: number; y: number } {
  const w1 = 1.3 + (p.phase % 0.7);
  const w2 = 1.1 + ((p.phase * 3.1) % 0.9);
  return { x: p.x + amplitude * Math.sin(w1 * t + p.phase), y: p.y + amplitude * Math.cos(w2 * t + p.phase * 1.7) };
}
