/**
 * Familien «mekanikk», del 2: trinse, tau, snor, fjær og strikk. Eksporteres via mekanikk.tsx.
 */
import {
  LinearGradient,
  RadialGradient,
  SCENE_DIM,
  materialStops,
  shade,
  sphereStops,
  tint,
  useStrokeScale,
  useSvgId,
} from './core';
import { MEK, DEG, clamp, coilPaths, num, pt, r2 } from './mekanikk-felles';
import { SCENE, paint, type PaintName } from './palette';

/* ---------------------------------------------------------------- Trinse */

export interface TrinseProps {
  /** Akselen (sentrum av hjulet). */
  x: number;
  y: number;
  /**
   * Radien der tauet ligger (midt i rillen), så et tau som går over hjulet, går i avstand r fra akselen.
   * Flensen går litt utenfor (1,14 · r). Ekte labtrinse: ca. 2,5 cm.
   */
  r: number;
  /**
   * Hva trinsa henger i:
   * «tak» – stropp opp til en takplate i y − festeLengde (fast trinse);
   * «bordkant» – arm og tvinge på en bordkant: bordplatens øvre ytterkant må være i (x − 1,5 · r, y − r + snorHoyde),
   *   så tauet over hjulet går `snorHoyde` over bordplaten (la snora fra klossen gå i den høyden). Med bordplaten i
   *   høyden yB og kanten i xB blir akselen x = xB + 1,5 · r og y = yB − snorHoyde + r;
   * «krok» – løs trinse: stropp ned til et øye som et lodd kan henge i; innersiden av øyet nederst er i
   *   y + festeLengde, så `<Lodd x={x} y={y + festeLengde} />` henger rett;
   * «ingen» – bare hjulet. Standard «tak».
   */
  feste?: 'tak' | 'bordkant' | 'ingen' | 'krok';
  /** Hvor mye hjulet er dreid (grader med klokka). Gi den s / r i grader når tauet går, så hjulet ruller med. */
  hjulvinkel?: number;
  /** Lengden fra akselen til taket (feste «tak») eller til innersiden nederst i øyet (feste «krok»). Standard 2 · r. */
  festeLengde?: number;
  /** Tykkelsen på bordplaten som tvingen griper (feste «bordkant»). Standard 0,5 · r. */
  bordtykkelse?: number;
  /**
   * Feste «bordkant»: hvor høyt tauet over hjulet går over bordplaten, f.eks. høyden til kroken på klossen
   * (h/2 for `Kloss`). Armen tilpasses. Standard 1,4 · r.
   */
  snorHoyde?: number;
  /** Aluminium, eller plasthjul med metallnav som labtrinsene. Standard «metall». */
  materiale?: 'metall' | 'plast';
  /** Fargen på et plasthjul (navn fra PAINTS eller en CSS-farge). Standard «svart». */
  farge?: PaintName | string;
  dim?: boolean;
  title?: string;
}

/**
 * Trinse med hjul, rille, nav og feste (tak, bordkant eller krok for en løs trinse). Ankerpunkt: akselen. Hullene i
 * hjulet dreies med `hjulvinkel`, så du ser at hjulet går rundt. Tegn tauet etter trinsa, så det ligger i rillen.
 *   // Bordplaten i y = 200 med kanten i x = 560, kroken på klossen 25 over bordet, r = 20:
 *   <Trinse x={560 + 1.5 * 20} y={200 - 25 + 20} r={20} feste="bordkant" snorHoyde={25} hjulvinkel={(s / 20) * (180 / Math.PI)} />
 *   <Snor points={[[klossKrokX, 175], [590, 175]]} />  // pluss punkter langs hjulet og ned til loddet
 */
export function Trinse({
  x,
  y,
  r,
  feste = 'tak',
  hjulvinkel = 0,
  festeLengde,
  bordtykkelse,
  snorHoyde,
  materiale = 'metall',
  farge,
  dim,
  title,
}: TrinseProps) {
  const id = useSvgId('sc-trinse');
  const ss = useStrokeScale();
  const R = Math.max(3, num(r, 24));
  const F = R * 1.14;
  const fl = Math.max(F * 1.2, num(festeLengde, R * 2));
  const plast = materiale === 'plast';
  const face = plast ? paint(farge ?? 'svart') : SCENE.metal;
  const strapW = R * 0.36;

  let mount = null;
  if (feste === 'tak') {
    const plateH = Math.max(3, R * 0.18);
    mount = (
      <g stroke={SCENE.outline} strokeWidth={0.9 * ss}>
        <rect x={-strapW / 2} y={-fl + plateH * 0.5} width={strapW} height={fl - plateH * 0.5} rx={strapW * 0.3} fill={`url(#${id}m)`} />
        <rect x={-R * 0.75} y={-fl} width={R * 1.5} height={plateH} rx={plateH * 0.25} fill={SCENE.metalDark} />
        <circle cx={-R * 0.5} cy={-fl + plateH / 2} r={plateH * 0.22} fill={SCENE.metalLight} strokeWidth={0.5 * ss} />
        <circle cx={R * 0.5} cy={-fl + plateH / 2} r={plateH * 0.22} fill={SCENE.metalLight} strokeWidth={0.5 * ss} />
      </g>
    );
  } else if (feste === 'krok') {
    // Stropp ned til et øye (ring) som kroken på et lodd kan henge i
    const wire = Math.max(1.4 * ss, R * 0.12);
    const rho = R * 0.24;
    const cy = fl - rho + wire / 2;
    mount = (
      <g>
        <path d={`M0,${r2(F)} V${r2(cy - rho)}`} stroke={SCENE.outline} strokeWidth={wire + 1.4 * ss} />
        <path d={`M0,${r2(F)} V${r2(cy - rho)}`} stroke={SCENE.metal} strokeWidth={wire} />
        <rect x={-strapW / 2} y={0} width={strapW} height={F + R * 0.32} rx={strapW * 0.3} fill={`url(#${id}m)`} stroke={SCENE.outline} strokeWidth={0.9 * ss} />
        <circle cx={0} cy={cy} r={rho} fill="none" stroke={SCENE.outline} strokeWidth={wire + 1.4 * ss} />
        <circle cx={0} cy={cy} r={rho} fill="none" stroke={SCENE.metal} strokeWidth={wire} />
      </g>
    );
  } else if (feste === 'bordkant') {
    const cx = -R * 1.5;
    const cy = clamp(num(snorHoyde, R * 1.4), R * 0.3, R * 8) - R;
    const tt = Math.max(2, num(bordtykkelse, R * 0.5));
    const jaw = Math.max(2, R * 0.2);
    const cw = Math.max(2.5, R * 0.3);
    const clampPath = `M${pt(cx - R * 0.7, cy - jaw)} H${r2(cx + cw)} V${r2(cy + tt + jaw)} H${r2(cx - R * 0.45)} V${r2(cy + tt)} H${r2(cx)} V${r2(cy)} H${r2(cx - R * 0.7)} Z`;
    const arm = `M${pt(cx + cw / 2, cy - jaw * 0.5)} L0,0`;
    const screwX = cx - R * 0.25;
    mount = (
      <g>
        <path d={arm} stroke={SCENE.outline} strokeWidth={R * 0.24 + 1.4 * ss} strokeLinecap="round" />
        <path d={arm} stroke={SCENE.metalDark} strokeWidth={R * 0.24} strokeLinecap="round" />
        <path
          d={`M${pt(screwX, cy + tt + jaw)} V${r2(cy + tt + jaw + R * 0.55)} M${pt(screwX - R * 0.24, cy + tt + jaw + R * 0.55)} H${r2(screwX + R * 0.24)}`}
          stroke={SCENE.outline}
          strokeWidth={Math.max(1.4, R * 0.1) * ss + 1.2 * ss}
          strokeLinecap="round"
        />
        <path
          d={`M${pt(screwX, cy + tt + jaw)} V${r2(cy + tt + jaw + R * 0.55)} M${pt(screwX - R * 0.24, cy + tt + jaw + R * 0.55)} H${r2(screwX + R * 0.24)}`}
          stroke={SCENE.metal}
          strokeWidth={Math.max(1.4, R * 0.1) * ss}
          strokeLinecap="round"
        />
        <path d={clampPath} fill={`url(#${id}m)`} stroke={SCENE.outline} strokeWidth={0.9 * ss} strokeLinejoin="round" />
      </g>
    );
  }

  const holes = [0, 120, 240].map((a) => {
    const t = (a + num(hjulvinkel, 0)) * DEG;
    return { cx: Math.cos(t) * R * 0.5, cy: Math.sin(t) * R * 0.5 };
  });

  return (
    <g transform={`translate(${r2(num(x, 0))} ${r2(num(y, 0))})`} opacity={dim ? SCENE_DIM : undefined}>
      {title && <title>{title}</title>}
      <LinearGradient
        id={`${id}m`}
        x2={1}
        y2={0}
        stops={[
          [0, tint(SCENE.metal, 0.3)],
          [0.45, SCENE.metal],
          [1, shade(SCENE.metal, 0.3)],
        ]}
      />
      {plast ? (
        <LinearGradient id={`${id}w`} stops={materialStops(face, 1.3)} />
      ) : (
        <RadialGradient id={`${id}w`} fx={0.36} fy={0.32} stops={sphereStops(face)} />
      )}
      <RadialGradient id={`${id}h`} fx={0.35} fy={0.3} stops={sphereStops(SCENE.metal)} />
      {mount}
      {/* Flens, rille og hjulskive. Plast: flat, farget skive med lyse kanter i hullene og et blankt metallnav. */}
      <circle r={F} fill={plast ? tint(face, 0.06) : shade(face, 0.12)} stroke={SCENE.outline} strokeWidth={1 * ss} />
      <circle r={R * 0.93} fill="none" stroke={shade(face, 0.45)} strokeWidth={Math.max(0.8 * ss, R * 0.09)} />
      <circle r={R * 0.86} fill={`url(#${id}w)`} stroke={plast ? tint(face, 0.18) : shade(face, 0.3)} strokeWidth={0.7 * ss} />
      <g fill={shade(face, 0.5)} stroke={plast ? tint(face, 0.3) : shade(face, 0.6)} strokeWidth={0.6 * ss}>
        {holes.map((h, i) => (
          <circle key={i} cx={r2(h.cx)} cy={r2(h.cy)} r={R * 0.17} />
        ))}
      </g>
      {plast && <circle r={R * 0.34} fill={shade(face, 0.25)} stroke={tint(face, 0.2)} strokeWidth={0.6 * ss} />}
      <circle r={R * (plast ? 0.27 : 0.25)} fill={`url(#${id}h)`} stroke={SCENE.outline} strokeWidth={0.8 * ss} />
      <circle r={R * 0.09} fill={SCENE.metalDark} />
      <path
        d={`M${pt(Math.cos(200 * DEG) * F * 0.9, Math.sin(200 * DEG) * F * 0.9)} A${r2(F * 0.9)},${r2(F * 0.9)} 0 0 1 ${pt(Math.cos(255 * DEG) * F * 0.9, Math.sin(255 * DEG) * F * 0.9)}`}
        fill="none"
        stroke={SCENE.highlight}
        strokeWidth={Math.max(0.8 * ss, R * 0.07)}
        strokeLinecap="round"
      />
    </g>
  );
}

/* ---------------------------------------------------------------- Tau og snor */

export interface TauProps {
  /** Punktene tauet går gjennom (polylinje). Vil du ha en bue rundt en trinse, legg inn punkter langs buen. */
  points: [number, number][];
  /** Tykkelsen i figurens enheter. Standard 6 for tau og 2 for snor (snora blir litt tykkere på mobil). */
  tykkelse?: number;
  /** Hamp (lysebrunt, vridd), nylon (hvitt) eller stålwire. Standard «hamp» for tau og «nylon» for snor. */
  type?: 'hamp' | 'nylon' | 'staal';
  dim?: boolean;
  title?: string;
}

function rope(points: [number, number][], tykkelse: number, type: 'hamp' | 'nylon' | 'staal', thin: boolean, ss: number, dim?: boolean, title?: string) {
  const pts = points.filter((p) => Number.isFinite(p[0]) && Number.isFinite(p[1]));
  if (pts.length < 2) return null;
  const t = Math.max(0.6, tykkelse) * (thin ? ss : 1);
  const color = type === 'staal' ? SCENE.metal : type === 'nylon' ? MEK.nylon : MEK.hamp;
  const d = `M${pts.map((p) => pt(p[0], p[1])).join(' L')}`;

  // Vridd tekstur: korte skrå streker på tvers, med fast avstand langs hele tauet (én path).
  let twist = '';
  if (!thin && t >= 3) {
    let total = 0;
    for (let i = 0; i < pts.length - 1; i++) total += Math.hypot(pts[i + 1]![0] - pts[i]![0], pts[i + 1]![1] - pts[i]![1]);
    const sp = Math.max(t * (type === 'staal' ? 0.7 : 0.95), total / 500);
    const h = t * 0.42;
    const lean = t * 0.3;
    let carry = sp / 2;
    for (let i = 0; i < pts.length - 1; i++) {
      const [ax, ay] = pts[i]!;
      const [bx, by] = pts[i + 1]!;
      const len = Math.hypot(bx - ax, by - ay);
      if (len < 1e-6) continue;
      const ux = (bx - ax) / len;
      const uy = (by - ay) / len;
      const nx = -uy;
      const ny = ux;
      let s = carry;
      for (; s <= len; s += sp) {
        const cx = ax + ux * s;
        const cy = ay + uy * s;
        twist += `M${pt(cx - nx * h - ux * lean, cy - ny * h - uy * lean)} L${pt(cx + nx * h + ux * lean, cy + ny * h + uy * lean)}`;
      }
      carry = s - len;
    }
  }
  const o = t * 0.17;
  return (
    <g opacity={dim ? SCENE_DIM : undefined} fill="none" strokeLinecap="round" strokeLinejoin="round">
      {title && <title>{title}</title>}
      <path d={d} stroke={SCENE.outline} strokeWidth={t + 1.3 * ss} />
      <path d={d} stroke={color} strokeWidth={t} />
      {!thin && <path d={d} stroke={shade(color, 0.22)} strokeWidth={t * 0.5} transform={`translate(${r2(o)} ${r2(o)})`} opacity={0.55} />}
      {twist && <path d={twist} stroke={shade(color, type === 'nylon' ? 0.22 : 0.4)} strokeWidth={Math.max(0.5, t * 0.11)} opacity={0.75} />}
      {t >= 2.4 && <path d={d} stroke={tint(color, 0.55)} strokeWidth={t * 0.26} transform={`translate(${r2(-o)} ${r2(-o)})`} opacity={0.6} />}
    </g>
  );
}

/**
 * Tau langs en polylinje, med vridd tekstur (hamp, nylon eller stålwire). Tegn tauet etter Trinse (så det ligger i
 * rillen), men før kasser og lodd det er festet i (så enden skjules).
 *   <Tau points={[[120, 200], [560, 200], [600, 240]]} tykkelse={7} />
 */
export function Tau({ points, tykkelse = 6, type = 'hamp', dim, title }: TauProps) {
  const ss = useStrokeScale();
  return rope(points, num(tykkelse, 6), type, false, ss, dim, title);
}

/**
 * Snor: tynn variant av tauet (samme props), f.eks. mellom to klosser eller over en trinse. Blir litt tykkere på mobil.
 * Tegn snora etter Trinse (så den ligger i rillen), men før klosser og lodd den er festet i (så enden skjules).
 *   <Snor points={[[300, 230], [600, 230]]} />
 */
export function Snor({ points, tykkelse = 2, type = 'nylon', dim, title }: TauProps) {
  const ss = useStrokeScale();
  return rope(points, num(tykkelse, 2), type, true, ss, dim, title);
}

/* ---------------------------------------------------------------- Fjær */

export interface FjaerProps {
  /** Første ende (f.eks. veggen). */
  x1: number;
  y1: number;
  /** Andre ende (f.eks. klossen). Fjæra strekkes og presses sammen mellom endene. */
  x2: number;
  y2: number;
  /** Antall vindinger. Standard 10. */
  vindinger?: number;
  /** Radius på vindingene (halve bredden av fjæra). Standard 9. */
  radius?: number;
  dim?: boolean;
  title?: string;
}

/**
 * Skruefjær i stål sett fra siden: vindingene har forside (lys) og bakside (mørk), så den ser ut som en ekte spiral.
 * Endene er (x1, y1) og (x2, y2); den strekkes og presses sammen når endene flyttes. Den kan ikke presses kortere
 * enn blokklengden (vindingene inntil hverandre, ca. vindinger · 1,1 · trådtykkelsen, der tråden er
 * max(1,3; 0,2 · radius)): da tegnes den som blokklengde fra (x1, y1).
 *   <Fjaer x1={60} y1={200} x2={60 + l0 + dx} y2={200} vindinger={12} radius={12} />
 */
export function Fjaer({ x1, y1, x2, y2, vindinger = 10, radius = 9, dim, title }: FjaerProps) {
  const ss = useStrokeScale();
  const R = Math.max(1.5, num(radius, 9));
  const N = clamp(Math.round(num(vindinger, 10)), 1, 60);
  const wire = Math.max(1.3 * ss, R * 0.2);
  const { front, back } = coilPaths(num(x1, 0), num(y1, 0), num(x2, 0), num(y2, 0), R, N, Math.max(R * 0.8, 3), 0.12, wire * 1.1);
  if (!front) return null;
  const o = wire * 0.22;
  return (
    <g opacity={dim ? SCENE_DIM : undefined} fill="none" strokeLinecap="round" strokeLinejoin="round">
      {title && <title>{title}</title>}
      <path d={back} stroke={SCENE.outline} strokeWidth={wire * 0.85 + 1.1 * ss} opacity={0.45} />
      <path d={back} stroke={MEK.coilBack} strokeWidth={wire * 0.85} />
      <path d={front} stroke={SCENE.outline} strokeWidth={wire + 1.4 * ss} />
      <path d={front} stroke={SCENE.metal} strokeWidth={wire} />
      <path d={front} stroke={SCENE.metalLight} strokeWidth={wire * 0.38} transform={`translate(${r2(-o)} ${r2(-o)})`} />
    </g>
  );
}

/* ---------------------------------------------------------------- Strikk */

type Pt = [number, number];

/** 0 → 0, 1 → 1, myk overgang mellom (verdier utenfor klemmes). */
function smooth(v: number): number {
  const a = clamp(v, 0, 1);
  return a * a * (3 - 2 * a);
}

/** Deler en kubisk Bézier i tre like deler (de Casteljau): 10 punkter, M + tre C-segmenter. */
function split3(p: Pt[]): Pt[] {
  const cut = (q: Pt[], t: number): [Pt[], Pt[]] => {
    const l = (a: Pt, b: Pt): Pt => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
    const a = l(q[0]!, q[1]!);
    const b = l(q[1]!, q[2]!);
    const c = l(q[2]!, q[3]!);
    const d = l(a, b);
    const e = l(b, c);
    const f = l(d, e);
    return [
      [q[0]!, a, d, f],
      [f, e, c, q[3]!],
    ];
  };
  const [c1, rest] = cut(p, 1 / 3);
  const [c2, c3] = cut(rest, 1 / 2);
  return [...c1, c2[1]!, c2[2]!, c2[3]!, c3[1]!, c3[2]!, c3[3]!];
}

export interface StrikkProps {
  /** Festet (f.eks. brua). */
  x1: number;
  y1: number;
  /** Den andre enden (f.eks. føttene til hopperen). */
  x2: number;
  y2: number;
  /** Tykkelsen i figurens enheter. Standard 5. */
  tykkelse?: number;
  /**
   * 0–1: hvor mye strikken henger ned når den ikke er stram (0 = stram og rett). Er endene loddrett over hverandre,
   * henger den i en U under den nederste enden, som når en strikkhopper faller før strikken strammes.
   */
  slakk?: number;
  /** Lengden uten strekk. Er strikken strammere enn dette, blir den tynnere og stripene lengre. */
  hvilelengde?: number;
  /** Fargen på stripene (navn fra PAINTS eller CSS-farge). Standard «gul». */
  farge?: PaintName | string;
  dim?: boolean;
  title?: string;
}

/**
 * Strikk til strikkhopp: tykk gummistrikk med stripet trekk og en ring i hver ende. Med `slakk` henger den ned, med
 * `hvilelengde` blir den tynnere når den strekkes.
 *   <Strikk x1={400} y1={40} x2={400} y2={hopperY} slakk={stram ? 0 : 0.6} hvilelengde={180} />
 */
export function Strikk({ x1, y1, x2, y2, tykkelse = 5, slakk = 0, hvilelengde, farge = 'gul', dim, title }: StrikkProps) {
  const ss = useStrokeScale();
  const ax = num(x1, 0);
  const ay = num(y1, 0);
  const bx = num(x2, 0);
  const by = num(y2, 0);
  const L = Math.hypot(bx - ax, by - ay);
  const k = clamp(num(slakk, 0), 0, 1);
  let t = Math.max(1, num(tykkelse, 5));
  let stretch = 1;
  const rest = num(hvilelengde, 0);
  if (rest > 0 && k === 0 && L > rest) {
    t *= Math.sqrt(rest / L);
    stretch = L / rest;
  }
  let d: string;
  if (k > 0.001) {
    const span = Math.max(L, 30);
    const vert = L > 0 ? Math.abs(by - ay) / L : 1;
    const drop = k * span * 0.55;
    // Vannrett: én kubisk bue som henger `drop` under midten av korden, delt i tre deler.
    const h = drop / 0.75;
    let pts = split3([
      [ax, ay],
      [ax + (bx - ax) / 3, ay + (by - ay) / 3 + h],
      [ax + (2 * (bx - ax)) / 3, ay + (2 * (by - ay)) / 3 + h],
      [bx, by],
    ]);
    // Loddrett: fra den øverste enden ned forbi den nederste, rundt en bøy (U) og opp igjen til den nederste enden.
    // Strengen fra toppen går ved siden av den nederste enden, så begge strengene og ringen synes.
    const w = smooth((vert - 0.6) / 0.3);
    if (w > 0) {
      const u = Math.min(Math.max(14, t * 4, drop * 0.55), drop * 1.2);
      const rho = u / 2;
      const topIsA = ay <= by;
      const [px, py] = topIsA ? [ax, ay] : [bx, by];
      const [qx, qy] = topIsA ? [bx, by] : [ax, ay];
      const side = px <= qx ? -1 : 1;
      const xc = qx + side * 0.3 * u;
      const xP = xc + side * rho;
      const xQ = xc - side * rho;
      const yc = qy + drop - rho;
      const kk = (4 / 3) * rho;
      const U: Pt[] = [
        [px, py],
        [px, py + (yc - py) * 0.45],
        [xP, yc - (yc - py) * 0.35],
        [xP, yc],
        [xP, yc + kk],
        [xQ, yc + kk],
        [xQ, yc],
        [xQ, yc - (yc - qy) * 0.45],
        [qx, qy + (yc - qy) * 0.45],
        [qx, qy],
      ];
      if (!topIsA) U.reverse();
      pts = pts.map((p, i) => [p[0] + (U[i]![0] - p[0]) * w, p[1] + (U[i]![1] - p[1]) * w]);
    }
    const P = (i: number) => pt(pts[i]![0], pts[i]![1]);
    d = `M${P(0)} C${P(1)} ${P(2)} ${P(3)} C${P(4)} ${P(5)} ${P(6)} C${P(7)} ${P(8)} ${P(9)}`;
  } else {
    d = `M${pt(ax, ay)} L${pt(bx, by)}`;
  }
  const ring = Math.max(2.2, t * 0.85);
  const o = t * 0.18;
  return (
    <g opacity={dim ? SCENE_DIM : undefined} fill="none" strokeLinecap="round">
      {title && <title>{title}</title>}
      <path d={d} stroke={SCENE.outline} strokeWidth={t + 1.4 * ss} />
      <path d={d} stroke={MEK.strikk} strokeWidth={t} />
      <path d={d} stroke={paint(farge)} strokeWidth={t * 0.8} strokeDasharray={`${r2(t * 0.9 * stretch)} ${r2(t * 1.5 * stretch)}`} opacity={0.85} strokeLinecap="butt" />
      <path d={d} stroke={SCENE.highlight} strokeWidth={t * 0.22} transform={`translate(${r2(-o)} ${r2(-o)})`} />
      <g stroke={SCENE.metal} strokeWidth={Math.max(1.2, ring * 0.38) * ss}>
        <circle cx={ax} cy={ay} r={ring} />
        <circle cx={bx} cy={by} r={ring} />
      </g>
    </g>
  );
}
