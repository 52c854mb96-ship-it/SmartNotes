/**
 * Egne scenedeler til «Stjernespekter» (bare denne visualiseringen trenger dem): et lite linsekikkert-teleskop på
 * stativ med gitter og kamera bak, et utsnitt av en stjerne med den kjøligere atmosfæren utenpå, atomer i
 * atmosfæren, en snødekt ås om natta og tekst som kan leses på nattehimmelen. Samme stil som scene-kit-et: toninger
 * fra core.tsx, SCENE-farger, kontur, myke skygger og ingen filtre.
 */
import { useMemo, type CSSProperties, type ReactNode } from 'react';
import { useTextScale } from '../../kit';
import {
  ContactShadow,
  LinearGradient,
  PAINTS,
  RadialGradient,
  SCENE,
  alpha,
  bolgelengdeFarge,
  mix,
  sceneRandom,
  shade,
  stjerneFarge,
  tint,
  useStrokeScale,
  useSvgId,
} from '../../kit/scene';

export type Pt = { x: number; y: number };

const r1 = (v: number) => (Number.isFinite(v) ? Math.round(v * 10) / 10 : 0);

/** Farger om natta: lys tekst med mørk kant, og snø og skog blandet mot nattehimmelen (mørk i begge temaer). */
export const NATT = {
  text: SCENE.star,
  textMuted: mix(SCENE.star, SCENE.space, 0.3),
  halo: SCENE.space,
  snow: mix(SCENE.space, SCENE.snow, 0.44),
  snowLow: mix(SCENE.space, SCENE.snowShade, 0.3),
  snowRim: alpha(SCENE.snow, 0.5),
  forest: mix(SCENE.space, SCENE.foliageDark, 0.2),
  forestTip: mix(SCENE.space, SCENE.snow, 0.2),
  rule: alpha(SCENE.star, 0.75),
} as const;

/* ---------- Tekst ---------- */

/** Tekst på nattehimmelen: lys tekst med mørk kant i begge temaer. Vokser på mobil som annen tekst i figurene. */
export function NattTekst({
  x,
  y,
  children,
  anchor = 'middle',
  size = 0.82,
  weight = 600,
  muted,
  fill,
  halo,
}: {
  x: number;
  y: number;
  children: ReactNode;
  anchor?: 'start' | 'middle' | 'end';
  size?: number;
  weight?: number;
  muted?: boolean;
  /** Egen tekstfarge (f.eks. mørk tekst på den lyse stjerneskiva). */
  fill?: string;
  halo?: string;
}) {
  const style = {
    fill: fill ?? (muted ? NATT.textMuted : NATT.text),
    stroke: halo ?? NATT.halo,
    fontWeight: weight,
    '--kj-fs': size,
  } as CSSProperties;
  return (
    <text x={r1(x)} y={r1(y)} textAnchor={anchor} className="kj-txt" style={style}>
      {children}
    </text>
  );
}

/** Etikett med tynn strek på nattehimmelen (som Callout, men lys strek og tekst med mørk kant). */
export function NattCallout({ x, y, lx, ly, children, anchor }: { x: number; y: number; lx: number; ly: number; children: ReactNode; anchor?: 'start' | 'middle' | 'end' }) {
  const f = useTextScale();
  const ss = useStrokeScale();
  const a = anchor ?? (lx >= x ? 'start' : 'end');
  const ex = a === 'start' ? lx - 5 : a === 'end' ? lx + 5 : lx;
  const ey = a === 'middle' ? (ly > y ? ly - 13 * f : ly + 6) : ly - 5 * f;
  return (
    <g>
      <line x1={r1(x)} y1={r1(y)} x2={r1(ex)} y2={r1(ey)} stroke={NATT.halo} strokeWidth={3.4 * ss} strokeLinecap="round" opacity={0.7} />
      <line x1={r1(x)} y1={r1(y)} x2={r1(ex)} y2={r1(ey)} stroke={NATT.rule} strokeWidth={1.3 * ss} strokeLinecap="round" />
      <circle cx={r1(x)} cy={r1(y)} r={3 * ss} fill={NATT.text} stroke={NATT.halo} strokeWidth={1.2 * ss} />
      <NattTekst x={lx} y={ly} anchor={a}>
        {children}
      </NattTekst>
    </g>
  );
}

/* ---------- Stjernen i snitt ---------- */

/**
 * Utsnitt av en stjerne: lysende skive (fotosfæren, varm og tett gass) med randfordunkling og granulering, og utenpå
 * en gjennomsiktig, kjøligere atmosfære (fargen til en kjøligere stjerne) med stiplet ytterkant og en svak glød.
 * Ankerpunkt: sentrum. Bare det som er innenfor figuren, synes; legg den til venstre med sentrum utenfor kanten.
 */
export function StjerneSnitt({ cx, cy, R, A, T, seed = 5 }: { cx: number; cy: number; R: number; A: number; T: number; seed?: number }) {
  const ss = useStrokeScale();
  const disc = useSvgId('stj-skive');
  const atm = useSvgId('stj-atm');
  const glow = useSvgId('stj-glod');
  const c = stjerneFarge(T, 1.35);
  const cool = stjerneFarge(Math.max(2600, T * 0.55), 1.6);
  const Ro = R + A;
  const G = Ro + 46 * ss;
  const grains = useMemo(() => {
    const rnd = sceneRandom(seed * 131 + 7);
    const out: string[] = [];
    for (let i = 0; i < 140; i++) {
      // Jevnt over skiva, men bare den høyre delen synes
      const ang = (rnd() - 0.5) * Math.PI * 0.9;
      const rr = R * Math.sqrt(0.15 + 0.83 * rnd());
      const x = cx + rr * Math.cos(ang);
      const y = cy + rr * Math.sin(ang);
      if (x < -10) continue;
      const g = (1.8 + 2.6 * rnd()) * Math.max(1, R / 200);
      out.push(`M${r1(x - g)} ${r1(y)}a${r1(g)} ${r1(g * 0.8)} 0 1 0 ${r1(2 * g)} 0a${r1(g)} ${r1(g * 0.8)} 0 1 0 ${r1(-2 * g)} 0Z`);
    }
    return out.join('');
  }, [cx, cy, R, seed]);
  const k = R / Ro;
  return (
    <g>
      <RadialGradient
        id={glow}
        stops={[
          [0, c, 0.5],
          [Ro / G, c, 0.28],
          [Ro / G + (1 - Ro / G) * 0.35, c, 0.08],
          [1, c, 0],
        ]}
      />
      <circle cx={cx} cy={cy} r={G} fill={`url(#${glow})`} aria-hidden />
      {/* Atmosfæren: tynnere og kjøligere gass utenpå den lysende skiva */}
      <RadialGradient
        id={atm}
        stops={[
          [0, cool, 0],
          [k - 0.001, cool, 0],
          [k, cool, 0.55],
          [k + (1 - k) * 0.5, cool, 0.32],
          [1, cool, 0.12],
        ]}
      />
      <circle cx={cx} cy={cy} r={Ro} fill={`url(#${atm})`} />
      <circle cx={cx} cy={cy} r={Ro} fill="none" stroke={alpha(cool, 0.85)} strokeWidth={1.4 * ss} strokeDasharray={`${6 * ss} ${5 * ss}`} />
      {/* Fotosfæren: lysest i midten, mørkere og mer farget mot kanten (randfordunkling) */}
      <RadialGradient
        id={disc}
        stops={[
          [0, tint(c, 0.8)],
          [0.55, tint(c, 0.5)],
          [0.86, tint(c, 0.12)],
          [0.97, c],
          [1, shade(c, 0.12)],
        ]}
      />
      <circle cx={cx} cy={cy} r={R} fill={`url(#${disc})`} />
      <path d={grains} fill={alpha(shade(c, 0.25), 0.09)} aria-hidden />
    </g>
  );
}

/* ---------- Atom i atmosfæren ---------- */

/**
 * Atom i stjerneatmosfæren (forstørret, skjematisk): blank kule med grunnstoffsymbolet når eleven har funnet det,
 * ellers et spørsmålstegn. `ring` gir en glorie i fargen til fotonet atomet tar opp.
 */
export function AtmosfaereAtom({ x, y, r, symbol, color, ring }: { x: number; y: number; r: number; symbol: string | null; color: string; ring?: string }) {
  const ss = useStrokeScale();
  const id = useSvgId('stj-atom');
  const base = symbol ? color : SCENE.metal;
  return (
    <g>
      {ring && <circle cx={r1(x)} cy={r1(y)} r={r1(r + 5 * ss)} fill={alpha(ring, 0.28)} stroke={ring} strokeWidth={2 * ss} />}
      <RadialGradient
        id={id}
        fx={0.36}
        fy={0.32}
        stops={[
          [0, tint(base, 0.6)],
          [0.5, base],
          [1, shade(base, 0.4)],
        ]}
      />
      <circle cx={r1(x)} cy={r1(y)} r={r1(r)} fill={`url(#${id})`} stroke={shade(base, 0.55)} strokeWidth={1.1 * ss} />
      <NattTekst x={x} y={y + r * 0.36} size={symbol && symbol.length > 1 ? 0.62 : 0.7} weight={700} fill={SCENE.star} halo={shade(base, 0.5)}>
        {symbol ?? '?'}
      </NattTekst>
    </g>
  );
}

/* ---------- Teleskopet ---------- */

export interface TeleskopProps {
  /** Midt mellom føttene på stativet, på bakken. */
  x: number;
  y: number;
  /** Figurenheter per meter. */
  ppm: number;
  /** Punktet teleskopet peker mot (objektivet vender mot venstre). */
  mot: Pt;
}

/** Målene på teleskopet i meter. */
const TEL = {
  hode: 1.06, // høyden på monteringen over bakken
  foran: 0.5, // fra monteringen til objektivet (uten duggskjerm)
  bak: 0.3, // fra monteringen til bakenden av røret
  skjerm: 0.12, // duggskjermen foran
  d: 0.12, // diameteren på røret
  okular: 0.08, // fokuseringen bak
  gitter: 0.03,
  kamera: 0.13,
} as const;

/** Punktene på teleskopet i figuren: objektivet (der lyset kommer inn), kameraet bak og høyden på monteringen. */
export function teleskopPunkter({ x, y, ppm, mot }: TeleskopProps) {
  const head = { x, y: y - TEL.hode * ppm };
  // Elevasjonen: vinkelen over vannrett mot venstre (grader)
  const e = (Math.atan2(head.y - mot.y, head.x - mot.x) * 180) / Math.PI;
  const rad = (e * Math.PI) / 180;
  const along = (u: number, v = 0): Pt => ({
    // Lokalt: u mot høyre langs røret (objektivet har negativ u), v nedover
    x: head.x + u * Math.cos(rad) - v * Math.sin(rad),
    y: head.y + u * Math.sin(rad) + v * Math.cos(rad),
  });
  const front = -(TEL.foran + TEL.skjerm) * ppm;
  const back = (TEL.bak + TEL.okular + TEL.gitter + TEL.kamera) * ppm;
  return {
    head,
    elevation: e,
    objektiv: along(front),
    kamera: along(back - (TEL.kamera * ppm) / 2, 0),
    kameraBunn: along(back - (TEL.kamera * ppm) / 2, 0.055 * ppm),
    bak: along(back),
  };
}

/**
 * Lite linseteleskop på stativ (sett fra siden), med duggskjerm, søker, prismeskinne og bak: fokuseringen, et gitter
 * (ring med regnbueskjær) og et lite svart kamera. Røret peker mot `mot` (til venstre). Ankerpunkt: midt mellom
 * føttene på bakken.
 */
export function Teleskop(props: TeleskopProps) {
  const { x, y, ppm } = props;
  const ss = useStrokeScale();
  const tubeId = useSvgId('tel-ror');
  const shieldId = useSvgId('tel-skjerm');
  const camId = useSvgId('tel-kamera');
  const legId = useSvgId('tel-bein');
  const grId = useSvgId('tel-gitter');
  const p = teleskopPunkter(props);
  const u = ppm;
  const D = TEL.d * u;
  const ink = SCENE.outline;
  const white = PAINTS.hvit;
  const black = mix(SCENE.rubber, PAINTS.svart, 0.4);
  const legW = Math.max(2.2 * ss, 0.03 * u);
  const head = p.head;
  const feet: Pt[] = [
    { x: x - 0.4 * u, y },
    { x: x + 0.42 * u, y },
  ];
  const backFoot = { x: x + 0.06 * u, y: y - 0.05 * u };
  const tray = 0.45;
  const at = (a: Pt, b: Pt, t: number): Pt => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
  const top = { x: head.x, y: head.y + 0.1 * u };
  const f0 = -TEL.foran * u;
  const fS = f0 - TEL.skjerm * u;
  const b0 = TEL.bak * u;
  const bO = b0 + TEL.okular * u;
  const bG = bO + TEL.gitter * u;
  const bK = bG + TEL.kamera * u;
  const cyl = (c: string, s = 1): [number, string][] => [
    [0, shade(c, 0.32 * s)],
    [0.28, tint(c, 0.35 * s)],
    [0.55, c],
    [1, shade(c, 0.45 * s)],
  ];
  return (
    <g>
      <ContactShadow cx={x + 0.02 * u} cy={y} rx={0.55 * u} ry={0.06 * u} opacity={0.7} />
      <LinearGradient id={legId} x1={0} y1={0} x2={1} y2={0} stops={[[0, shade(SCENE.metal, 0.25)], [0.45, tint(SCENE.metal, 0.3)], [1, shade(SCENE.metal, 0.35)]]} />
      {/* Bakre bein (bak røret, mørkere) */}
      <line x1={top.x} y1={top.y} x2={backFoot.x} y2={backFoot.y} stroke={shade(SCENE.metal, 0.45)} strokeWidth={legW} strokeLinecap="round" />
      {/* Brett mellom beina */}
      <path
        d={`M${r1(at(top, feet[0]!, tray).x)} ${r1(at(top, feet[0]!, tray).y)}L${r1(at(top, backFoot, tray).x)} ${r1(at(top, backFoot, tray).y)}L${r1(at(top, feet[1]!, tray).x)} ${r1(at(top, feet[1]!, tray).y)}`}
        fill="none"
        stroke={shade(SCENE.metal, 0.3)}
        strokeWidth={1.6 * ss}
        strokeLinejoin="round"
      />
      {feet.map((ft, i) => (
        <g key={i}>
          <line x1={top.x} y1={top.y} x2={ft.x} y2={ft.y} stroke={ink} strokeWidth={legW + 1.6 * ss} strokeLinecap="round" />
          <line x1={top.x} y1={top.y} x2={ft.x} y2={ft.y} stroke={tint(SCENE.metal, 0.1)} strokeWidth={legW} strokeLinecap="round" />
          {/* Klemme midt på beinet og gummifot */}
          <circle cx={r1(at(top, ft, 0.55).x)} cy={r1(at(top, ft, 0.55).y)} r={r1(legW * 0.9)} fill={black} />
          <rect x={r1(ft.x - legW)} y={r1(ft.y - legW * 0.9)} width={r1(legW * 2)} height={r1(legW * 0.9)} rx={r1(legW * 0.3)} fill={black} />
        </g>
      ))}
      {/* Montering: hode på stativet */}
      <rect x={r1(head.x - 0.06 * u)} y={r1(head.y + 0.02 * u)} width={r1(0.12 * u)} height={r1(0.1 * u)} rx={r1(0.015 * u)} fill={black} stroke={ink} strokeWidth={1 * ss} />
      <rect x={r1(head.x - 0.035 * u)} y={r1(head.y + 0.035 * u)} width={r1(0.07 * u)} height={r1(0.018 * u)} rx={1} fill={alpha(SCENE.star, 0.18)} />
      {/* Røret, dreid mot stjernen */}
      <g transform={`translate(${r1(head.x)} ${r1(head.y)}) rotate(${r1(p.elevation)})`}>
        <LinearGradient id={tubeId} stops={cyl(white, 0.8)} />
        <LinearGradient id={shieldId} stops={cyl(black, 0.6)} />
        <LinearGradient id={camId} stops={cyl(black, 0.5)} />
        <LinearGradient
          id={grId}
          x1={0}
          y1={0}
          x2={0}
          y2={1}
          stops={[410, 460, 520, 580, 640].map((nm, i): [number, string] => [i / 4, bolgelengdeFarge(nm, false)])}
        />
        {/* Prismeskinne og rørklemme */}
        <rect x={r1(-0.2 * u)} y={r1(D / 2 - 0.004 * u)} width={r1(0.4 * u)} height={r1(0.028 * u)} rx={1.5} fill={shade(SCENE.metal, 0.35)} stroke={ink} strokeWidth={0.8 * ss} />
        {/* Hovedrøret */}
        <rect x={r1(f0)} y={r1(-D / 2)} width={r1(b0 - f0)} height={r1(D)} rx={r1(D * 0.12)} fill={`url(#${tubeId})`} stroke={ink} strokeWidth={1.1 * ss} />
        <rect x={r1(-0.06 * u)} y={r1(-D / 2 - 0.006 * u)} width={r1(0.035 * u)} height={r1(D + 0.012 * u)} rx={1.5} fill={black} />
        <rect x={r1(0.05 * u)} y={r1(-D / 2 - 0.006 * u)} width={r1(0.035 * u)} height={r1(D + 0.012 * u)} rx={1.5} fill={black} />
        {/* Søker oppå */}
        <rect x={r1(-0.2 * u)} y={r1(-D / 2 - 0.05 * u)} width={r1(0.22 * u)} height={r1(0.032 * u)} rx={r1(0.01 * u)} fill={`url(#${tubeId})`} stroke={ink} strokeWidth={0.9 * ss} />
        <rect x={r1(-0.13 * u)} y={r1(-D / 2 - 0.02 * u)} width={r1(0.05 * u)} height={r1(0.022 * u)} fill={black} />
        {/* Duggskjerm og objektivet (glass med refleks) */}
        <rect x={r1(fS)} y={r1(-D / 2 - 0.008 * u)} width={r1(f0 - fS + 0.01 * u)} height={r1(D + 0.016 * u)} rx={r1(0.01 * u)} fill={`url(#${shieldId})`} stroke={ink} strokeWidth={1.1 * ss} />
        <ellipse cx={r1(fS + 0.006 * u)} cy={0} rx={r1(0.012 * u)} ry={r1(D / 2)} fill={mix(SCENE.glass, SCENE.space, 0.5)} stroke={ink} strokeWidth={0.8 * ss} />
        <path d={`M${r1(fS + 0.004 * u)} ${r1(-D * 0.32)}q${r1(-0.006 * u)} ${r1(D * 0.2)} 0 ${r1(D * 0.36)}`} fill="none" stroke={alpha(SCENE.star, 0.7)} strokeWidth={1.2 * ss} strokeLinecap="round" />
        {/* Fokusering, gitter og kamera bak */}
        <rect x={r1(b0)} y={r1(-D * 0.3)} width={r1(bO - b0)} height={r1(D * 0.6)} fill={`url(#${shieldId})`} stroke={ink} strokeWidth={1 * ss} />
        <rect x={r1(b0 + 0.02 * u)} y={r1(D * 0.3)} width={r1(0.035 * u)} height={r1(0.03 * u)} rx={1.5} fill={black} stroke={ink} strokeWidth={0.8 * ss} />
        <rect x={r1(bO)} y={r1(-D * 0.36)} width={r1(bG - bO)} height={r1(D * 0.72)} fill={`url(#${grId})`} stroke={ink} strokeWidth={1 * ss} />
        <rect x={r1(bG)} y={r1(-0.055 * u)} width={r1(bK - bG)} height={r1(0.11 * u)} rx={r1(0.014 * u)} fill={`url(#${camId})`} stroke={ink} strokeWidth={1.1 * ss} />
        <rect x={r1(bG + 0.025 * u)} y={r1(-0.035 * u)} width={r1(0.07 * u)} height={r1(0.012 * u)} rx={1} fill={alpha(SCENE.star, 0.25)} />
        <circle cx={r1(bK - 0.03 * u)} cy={r1(-0.03 * u)} r={r1(0.008 * u)} fill={bolgelengdeFarge(630, false)} />
      </g>
    </g>
  );
}

/* ---------- Snødekt ås og skog om natta ---------- */

/**
 * Snødekt ås i forgrunnen (fra `x0` til høyre kant) med granskog som silhuett bak, lys kant mot himmelen og litt
 * glitter. `gy` er bakken der teleskopet står (ved `xTop`).
 */
export function SnoAas({ W, H, x0, xTop, gy, seed = 3 }: { W: number; H: number; x0: number; xTop: number; gy: number; seed?: number }) {
  const ss = useStrokeScale();
  const snowId = useSvgId('stj-sno');
  const geo = useMemo(() => {
    const rnd = sceneRandom(seed * 911 + 5);
    // Overflaten: stiger fra x0 til en flate rundt teleskopet og heller litt mot høyre
    const top = `M${r1(x0)} ${r1(H + 2)}C${r1(x0 + (xTop - x0) * 0.35)} ${r1(gy + (H - gy) * 0.2)} ${r1(xTop - (xTop - x0) * 0.35)} ${r1(gy + 2)} ${r1(xTop)} ${r1(gy)}C${r1(xTop + (W - xTop) * 0.4)} ${r1(gy - 2)} ${r1(W - 40)} ${r1(gy + 6)} ${r1(W + 2)} ${r1(gy + 10)}`;
    const fill = `${top}L${r1(W + 2)} ${r1(H + 2)}Z`;
    // Granskog bak åsen: silhuetter langs en linje litt over bakken
    const fy = gy - 6;
    const trees: string[] = [];
    const tips: string[] = [];
    let x = x0 + (xTop - x0) * 0.25;
    while (x < W + 20) {
      const h = (16 + rnd() * 26) * Math.max(1, (gy - fy + 30) / 36);
      const w = h * (0.32 + rnd() * 0.08);
      const by = fy + 10 + rnd() * 8;
      trees.push(`M${r1(x - w / 2)} ${r1(by)}L${r1(x - w * 0.18)} ${r1(by - h * 0.55)}L${r1(x - w * 0.3)} ${r1(by - h * 0.55)}L${r1(x)} ${r1(by - h)}L${r1(x + w * 0.3)} ${r1(by - h * 0.55)}L${r1(x + w * 0.18)} ${r1(by - h * 0.55)}L${r1(x + w / 2)} ${r1(by)}Z`);
      tips.push(`M${r1(x - w * 0.12)} ${r1(by - h * 0.8)}L${r1(x)} ${r1(by - h)}L${r1(x + w * 0.12)} ${r1(by - h * 0.8)}`);
      x += w * (0.55 + rnd() * 0.6);
    }
    const sparkles: string[] = [];
    for (let i = 0; i < 40; i++) {
      const sx = xTop - (xTop - x0) * 0.5 + rnd() * (W - xTop + (xTop - x0) * 0.5);
      const sy = gy + 8 + rnd() * (H - gy - 8);
      sparkles.push(`M${r1(sx)} ${r1(sy)}h0.1`);
    }
    return { top, fill, trees: trees.join(''), tips: tips.join(''), sparkles: sparkles.join('') };
  }, [W, H, x0, xTop, gy, seed]);
  return (
    <g>
      <path d={geo.trees} fill={NATT.forest} />
      <path d={geo.tips} fill="none" stroke={NATT.forestTip} strokeWidth={1.2 * ss} strokeLinecap="round" strokeLinejoin="round" />
      <LinearGradient id={snowId} stops={[[0, NATT.snow], [1, NATT.snowLow]]} />
      <path d={geo.fill} fill={`url(#${snowId})`} />
      <path d={geo.top} fill="none" stroke={NATT.snowRim} strokeWidth={1.4 * ss} />
      <path d={geo.sparkles} stroke={alpha(SCENE.star, 0.7)} strokeWidth={1.6 * ss} strokeLinecap="round" />
    </g>
  );
}

/* ---------- Brudd i strålen (lang avstand) ---------- */

/** To skrå streker over strålen som viser at avstanden er mye lenger enn tegnet, med avstanden over. */
export function AvstandsBrudd({ x, y, angle, label }: { x: number; y: number; angle: number; label: string }) {
  const ss = useStrokeScale();
  const f = useTextScale();
  const gap = 7 * ss;
  const len = 12 * ss;
  const rad = (angle * Math.PI) / 180;
  const ux = Math.cos(rad);
  const uy = Math.sin(rad);
  const stroke = (o: number) => {
    const cx = x + ux * o;
    const cy = y + uy * o;
    // Skrå strek: 60° på strålen
    const a = rad - Math.PI / 3;
    return `M${r1(cx - Math.cos(a) * len)} ${r1(cy - Math.sin(a) * len)}L${r1(cx + Math.cos(a) * len)} ${r1(cy + Math.sin(a) * len)}`;
  };
  return (
    <g>
      <path d={`M${r1(x - ux * gap)} ${r1(y - uy * gap)}L${r1(x + ux * gap)} ${r1(y + uy * gap)}`} stroke={SCENE.space} strokeWidth={14 * ss} />
      <path d={`${stroke(-gap)}${stroke(gap)}`} stroke={NATT.text} strokeWidth={1.8 * ss} strokeLinecap="round" fill="none" />
      <NattTekst x={x} y={y - len - 6 * f} size={0.78}>
        {label}
      </NattTekst>
    </g>
  );
}
