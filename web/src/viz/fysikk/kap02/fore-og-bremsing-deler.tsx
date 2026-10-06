/**
 * Egne gjenstander til «Friksjon og føre» (k2-fore-og-bremsing) som scene-kit-et ikke har: trafikkjegle, kantstolpe,
 * bremsespor, bevegelsesuskarphet på et hjul som ruller fort, regn og snøfall. Samme stil som scene-kit-et: toninger
 * fra core, SCENE- og PAINTS-farger, tynn kontur og myk skygge. Ingen filtre og ingen bilder.
 */
import { memo } from 'react';
import { Txt, VIZ } from '../../kit';
import { ContactShadow, LinearGradient, PAINTS, RadialGradient, SCENE, alpha, mix, sceneRandom, shade, tint, useStrokeScale, useSvgId } from '../../kit/scene';

const r2 = (v: number) => Math.round(v * 100) / 100;
const mod = (a: number, n: number) => ((a % n) + n) % n;

/**
 * Trafikkjegle (oransje med to hvite refleksbånd og firkantet gummifot), sett fra siden.
 * Ankerpunkt: (x, y) er midt under foten, på bakken. `h` er høyden (en vanlig kjegle er ca. 0,5 m).
 */
export function Trafikkjegle({ x, y, h }: { x: number; y: number; h: number }) {
  const ss = useStrokeScale();
  const body = useSvgId('kjegle');
  const foot = useSvgId('kjeglefot');
  if (!(h > 2) || !Number.isFinite(x) || !Number.isFinite(y)) return null;
  const fh = h * 0.09; // foten
  const bw = h * 0.36; // halv bredde nederst på kjeglen
  const tw = h * 0.07; // halv bredde på toppen
  const top = y - h;
  const base = y - fh;
  const at = (t: number) => bw + (tw - bw) * t; // halv bredde i høyden t (0 = nede, 1 = oppe)
  const yAt = (t: number) => base + (top - base) * t;
  const band = (t0: number, t1: number) =>
    `M${r2(x - at(t0))},${r2(yAt(t0))}L${r2(x + at(t0))},${r2(yAt(t0))}L${r2(x + at(t1))},${r2(yAt(t1))}L${r2(x - at(t1))},${r2(yAt(t1))}Z`;
  const orange = PAINTS.oransje;
  return (
    <g aria-hidden>
      <ContactShadow cx={x + h * 0.06} cy={y} rx={h * 0.6} ry={h * 0.08} />
      <LinearGradient id={body} x2={1} y2={0} stops={[[0, tint(orange, 0.22)], [0.45, orange], [1, shade(orange, 0.3)]]} />
      <LinearGradient id={foot} x2={1} y2={0} stops={[[0, tint(SCENE.rubber, 0.2)], [1, shade(SCENE.rubber, 0.2)]]} />
      <rect x={x - h * 0.5} y={y - fh} width={h} height={fh} rx={fh * 0.35} fill={`url(#${foot})`} stroke={SCENE.outline} strokeWidth={0.7 * ss} />
      <path
        d={`M${r2(x - bw)},${r2(base)}L${r2(x - tw)},${r2(top + h * 0.03)}Q${r2(x)},${r2(top - h * 0.02)} ${r2(x + tw)},${r2(top + h * 0.03)}L${r2(x + bw)},${r2(base)}Z`}
        fill={`url(#${body})`}
        stroke={SCENE.outline}
        strokeWidth={0.8 * ss}
        strokeLinejoin="round"
      />
      <path d={band(0.3, 0.44)} fill={tint(PAINTS.hvit, 0.1)} opacity={0.95} />
      <path d={band(0.58, 0.68)} fill={tint(PAINTS.hvit, 0.1)} opacity={0.95} />
    </g>
  );
}

/**
 * Kantstolpe langs norske veier: hvit stolpe med svart topp og en refleks, sett fra siden.
 * Ankerpunkt: (x, y) er foten på bakken. `h` er høyden over bakken (ca. 1 m).
 */
export function Kantstolpe({ x, y, h }: { x: number; y: number; h: number }) {
  const ss = useStrokeScale();
  const id = useSvgId('kantstolpe');
  if (!(h > 4) || !Number.isFinite(x) || !Number.isFinite(y)) return null;
  const w = Math.max(3, h * 0.12);
  const top = y - h;
  const white = mix(PAINTS.hvit, SCENE.wall, 0.15);
  return (
    <g aria-hidden>
      <ContactShadow cx={x + w * 0.4} cy={y} rx={w * 1.4} ry={Math.max(1.5, w * 0.35)} opacity={0.7} />
      <LinearGradient id={id} x2={1} y2={0} stops={[[0, tint(white, 0.3)], [0.5, white], [1, shade(white, 0.18)]]} />
      <rect x={x - w / 2} y={top} width={w} height={h} rx={w * 0.25} fill={`url(#${id})`} stroke={SCENE.outline} strokeWidth={0.6 * ss} />
      {/* Svart topp med skrå overkant, og en gul refleks */}
      <path
        d={`M${r2(x - w / 2)},${r2(top + h * 0.27)}L${r2(x + w / 2)},${r2(top + h * 0.22)}L${r2(x + w / 2)},${r2(top + w * 0.2)}L${r2(x - w / 2)},${r2(top + w * 0.45)}Z`}
        fill={PAINTS.svart}
      />
      <rect x={x - w * 0.28} y={top + h * 0.08} width={w * 0.56} height={h * 0.1} rx={w * 0.12} fill={PAINTS.gul} />
    </g>
  );
}

export type SporType = 'asfalt' | 'vaat-asfalt' | 'sno' | 'is';

/**
 * Bremsespor fra et låst hjul som sklir: et mørkt gummispor på asfalt, nedtråkkede, gråere spor i snø og blankpolerte,
 * lyse striper på is. Sporet tegnes fra x1 (der hjulet låste seg) til x2 (der hjulet er nå), midt på y.
 * `w` er tykkelsen i figurens enheter (dekkbredden i perspektiv).
 */
export function Bremsespor({ x1, x2, y, w, type }: { x1: number; x2: number; y: number; w: number; type: SporType }) {
  const id = useSvgId('bremsespor');
  const left = Math.min(x1, x2);
  const right = Math.max(x1, x2);
  if (!(right - left > 0.5) || !Number.isFinite(y)) return null;
  const color = sporFarge(type);
  const strength = type === 'asfalt' ? 0.72 : type === 'vaat-asfalt' ? 0.55 : 0.85;
  // Sporet er mørkest der hjulet er nå (ferskt) og litt svakere bakover, og blekner helt i starten av sporet.
  const fade = Math.min(1, 14 / (right - left));
  return (
    <g aria-hidden>
      <LinearGradient
        id={id}
        x2={1}
        y2={0}
        stops={[
          [0, color, strength * 0.25],
          [fade, color, strength * 0.8],
          [1, color, strength],
        ]}
      />
      <rect x={left} y={y - w / 2} width={right - left} height={w} rx={w * 0.4} fill={`url(#${id})`} />
      {/* To smale lyse striper midt i sporet: mønsteret i dekket (ikke på is, der sporet er en blank stripe) */}
      {type !== 'is' && (
        <g stroke={type === 'sno' ? alpha(SCENE.snow, 0.45) : alpha(SCENE.asphalt, 0.7)} strokeWidth={Math.max(0.6, w * 0.12)}>
          <line x1={left + 4} x2={right} y1={y - w * 0.18} y2={y - w * 0.18} />
          <line x1={left + 4} x2={right} y1={y + w * 0.2} y2={y + w * 0.2} />
        </g>
      )}
    </g>
  );
}

/** Fargen på bremsesporet: svart gummi på asfalt, sammenpresset og skitten snø, og en matt, grå stripe i blank is. */
function sporFarge(type: SporType): string {
  return type === 'asfalt'
    ? shade(SCENE.rubber, 0.2)
    : type === 'vaat-asfalt'
      ? SCENE.rubber
      : type === 'sno'
        ? mix(SCENE.snowShade, SCENE.soilDark, 0.72)
        : mix(SCENE.ice, SCENE.asphalt, 0.78);
}

/**
 * Bevegelsesuskarphet på felgen når hjulet ruller fort: en halvgjennomsiktig skive med lyse buer over eikene, så
 * hjulet ser ut til å snurre også på et stillbilde. `amount` 0–1 (0 = ingenting, 1 = full fart).
 * (cx, cy) er midten av hjulet og r radiusen til felgen.
 */
export function HjulSpinn({ cx, cy, r, amount }: { cx: number; cy: number; r: number; amount: number }) {
  const ss = useStrokeScale();
  const id = useSvgId('hjulspinn');
  const k = Math.min(1, Math.max(0, Number.isFinite(amount) ? amount : 0));
  if (!(k > 0.02) || !(r > 1)) return null;
  const arc = (rr: number, a0: number, a1: number) => {
    const p = (a: number) => `${r2(cx + rr * Math.cos((a * Math.PI) / 180))},${r2(cy + rr * Math.sin((a * Math.PI) / 180))}`;
    return `M${p(a0)}A${r2(rr)},${r2(rr)} 0 0 1 ${p(a1)}`;
  };
  return (
    <g aria-hidden>
      <RadialGradient
        id={id}
        stops={[
          [0, SCENE.metalLight, 0.9 * k],
          [0.35, SCENE.metal, 0.75 * k],
          [1, SCENE.metalDark, 0.85 * k],
        ]}
      />
      <circle cx={cx} cy={cy} r={r} fill={`url(#${id})`} />
      <g fill="none" stroke={SCENE.highlight} strokeLinecap="round" opacity={0.75 * k}>
        <path d={arc(r * 0.72, 200, 290)} strokeWidth={1.3 * ss} />
        <path d={arc(r * 0.72, 20, 110)} strokeWidth={1.3 * ss} />
        <path d={arc(r * 0.45, 240, 320)} strokeWidth={1 * ss} />
        <path d={arc(r * 0.45, 60, 140)} strokeWidth={1 * ss} />
      </g>
      <circle cx={cx} cy={cy} r={r * 0.22} fill={SCENE.metalLight} stroke={SCENE.metalDark} strokeWidth={0.6 * ss} />
    </g>
  );
}

interface NedborProps {
  /** Området nedbøren fyller (øverste venstre hjørne, bredde og høyde). */
  x: number;
  y: number;
  w: number;
  h: number;
  /** Antall dråper eller fnugg. */
  n?: number;
  seed?: number;
  /** Hvor langt «kameraet» har flyttet seg (figurens enheter): nedbøren driver bakover når bilen kjører. */
  forskyvning?: number;
}

/** Lett regn: korte, skrå striper (vinden og farten gjør at de heller bakover). Deterministisk med fast frø. */
export const Regn = memo(function Regn({ x, y, w, h, n = 70, seed = 7, forskyvning = 0 }: NedborProps) {
  const ss = useStrokeScale();
  if (!(w > 0) || !(h > 0)) return null;
  const rand = sceneRandom(seed);
  const shift = Number.isFinite(forskyvning) ? forskyvning * 0.35 : 0;
  let d = '';
  for (let i = 0; i < n; i++) {
    const px = x + mod(rand() * w - shift, w);
    const py = y + rand() * h;
    const len = 10 + rand() * 9;
    d += `M${r2(px)},${r2(py)}l${r2(-len * 0.3)},${r2(len)}`;
  }
  return <path d={d} fill="none" stroke={mix(SCENE.cloudShade, SCENE.water, 0.45)} strokeWidth={1.2 * ss} strokeLinecap="round" opacity={0.55} aria-hidden />;
});

/** Lett snøfall: små, runde fnugg med en svak kant, så de synes mot lys himmel. Deterministisk med fast frø. */
export const Snofall = memo(function Snofall({ x, y, w, h, n = 60, seed = 11, forskyvning = 0 }: NedborProps) {
  const ss = useStrokeScale();
  if (!(w > 0) || !(h > 0)) return null;
  const rand = sceneRandom(seed);
  const shift = Number.isFinite(forskyvning) ? forskyvning * 0.3 : 0;
  const flakes: { cx: number; cy: number; r: number }[] = [];
  for (let i = 0; i < n; i++) {
    flakes.push({ cx: x + mod(rand() * w - shift, w), cy: y + rand() * h, r: (1.3 + rand() * 1.7) * ss });
  }
  return (
    <g fill={SCENE.snow} stroke={alpha(SCENE.snowShade, 0.9)} strokeWidth={0.5 * ss} opacity={0.9} aria-hidden>
      {flakes.map((f, i) => (
        <circle key={i} cx={r2(f.cx)} cy={r2(f.cy)} r={r2(f.r)} />
      ))}
    </g>
  );
});

export interface DekkLupeProps {
  /** Midten og radiusen til lupen. */
  cx: number;
  cy: number;
  r: number;
  /** Punktet lupen forstørrer (der forhjulet treffer veien), og radiusen på ringen rundt det. */
  tx: number;
  ty: number;
  tr: number;
  type: SporType;
  dekk: 'sommer' | 'vinter';
  /** Hjulet ruller (ABS) eller er låst og sklir. */
  ruller: boolean;
  /** Bilen står stille (ingen rotasjonspil og ingen sprut). */
  stille: boolean;
  /** Hvor langt hjulet har rotert (grader, med klokka), så mønsteret i dekket ruller med. */
  vinkel: number;
  /** Teksten nederst i lupen, f.eks. «Ruller» eller «Sklir» (kort, den må få plass). */
  tekst: string;
}

/**
 * Lupe som forstørrer der forhjulet møter veien: dekket med mønster (sommerdekk: få, brede spor; vinterdekk: tette
 * spor med små lameller), felgen, en flat kontaktflate og veien under. Når hjulet ruller, viser en buet pil
 * rotasjonen. Når hjulet er låst, ligger det et bremsespor bak kontaktflaten og litt sprut fra dekket.
 * En ring rundt kontaktflaten i scenen og en strek viser hva lupen forstørrer.
 * Ankerpunkt: (cx, cy) er midten av lupen.
 */
export function DekkLupe({ cx, cy, r, tx, ty, tr, type, dekk, ruller, stille, vinkel, tekst }: DekkLupeProps) {
  const ss = useStrokeScale();
  const clip = useSvgId('lupe');
  const above = useSvgId('lupeover');
  const tyreId = useSvgId('lupedekk');
  const rimId = useSvgId('lupefelg');
  const groundId = useSvgId('lupevei');
  if (!(r > 8) || ![cx, cy, tx, ty, tr].every(Number.isFinite)) return null;

  const gy = cy + 0.3 * r; // veien
  const RT = 1.2 * r; // dekkets radius i lupen
  const flat = 0.04 * r; // dekket er litt flatt mot veien
  const ty0 = gy - RT + flat; // midten av dekket
  const patch = Math.sqrt(Math.max(0, RT * RT - (RT - flat) ** 2)); // halve lengden av kontaktflaten
  const spin = Number.isFinite(vinkel) ? vinkel : 0;

  // Mønsteret: tverrspor i slitebanen. Sommerdekk har få og brede spor, vinterdekk tette spor og lameller mellom.
  const step = dekk === 'vinter' ? 6 : 10;
  let grooves = '';
  let sipes = '';
  for (let a = 0; a < 360; a += step) {
    const ang = ((a + spin) * Math.PI) / 180;
    const ux = Math.cos(ang);
    const uy = Math.sin(ang);
    if (ty0 + uy * RT < cy - r - 4) continue; // utenfor lupen
    const pIn = (rr: number) => `${r2(cx + ux * rr)},${r2(ty0 + uy * rr)}`;
    grooves += `M${pIn(RT * (dekk === 'vinter' ? 0.9 : 0.885))}L${pIn(RT + 2)}`;
    if (dekk === 'vinter') {
      const half = ((a + step / 2 + spin) * Math.PI) / 180;
      const vx = Math.cos(half);
      const vy = Math.sin(half);
      const q = (rr: number, off: number) => `${r2(cx + vx * rr - vy * off)},${r2(ty0 + vy * rr + vx * off)}`;
      sipes += `M${q(RT * 0.935, 0)}L${q(RT * 0.955, 1 * ss)}L${q(RT * 0.975, -1 * ss)}L${q(RT * 0.995, 0)}`;
    }
  }

  // Fem eiker som kiler fra navet ut til felgen (som på bilen), dreid med hjulet
  let spokes = '';
  for (let i = 0; i < 5; i++) {
    const a = ((spin - 90 + i * 72) * Math.PI) / 180;
    const ux = Math.cos(a);
    const uy = Math.sin(a);
    const p = (rr: number, w: number) => `${r2(cx + ux * rr - uy * w)},${r2(ty0 + uy * rr + ux * w)}`;
    const r0 = RT * 0.14;
    const r1 = RT * 0.57;
    spokes += `M${p(r0, RT * 0.05)}L${p(r1, RT * 0.1)}L${p(r1, -RT * 0.1)}L${p(r0, -RT * 0.05)}Z`;
  }

  // Veien i lupen: farge og korn etter typen
  const ground: Record<SporType, [string, string]> = {
    asfalt: [tint(SCENE.asphalt, 0.08), shade(SCENE.asphalt, 0.12)],
    'vaat-asfalt': [mix(SCENE.asphaltWet, SCENE.skyBottom, 0.3), shade(SCENE.asphaltWet, 0.12)],
    sno: [tint(SCENE.snow, 0.2), SCENE.snowShade],
    is: [mix(SCENE.ice, SCENE.iceShine, 0.35), shade(SCENE.ice, 0.15)],
  };
  const [g0, g1] = ground[type];
  const rand = sceneRandom(17);
  let grains = '';
  for (let i = 0; i < 28; i++) {
    const gx = cx - r + rand() * 2 * r;
    const gyy = gy + 0.06 * r + rand() * 0.6 * r;
    const gr = (0.6 + rand() * 1.1) * ss;
    grains += `M${r2(gx - gr)},${r2(gyy)}a${r2(gr)},${r2(gr)} 0 1,0 ${r2(2 * gr)},0a${r2(gr)},${r2(gr)} 0 1,0 ${r2(-2 * gr)},0`;
  }
  const grainColor = type === 'asfalt' ? tint(SCENE.asphalt, 0.35) : type === 'sno' ? SCENE.snowShade : type === 'is' ? SCENE.iceShine : SCENE.skyBottom;

  // Sprut bak dekket når det sklir: gummistøv på asfalt, snø og isflis ellers
  let spray = '';
  if (!ruller && !stille) {
    for (let i = 0; i < 9; i++) {
      const sx = cx - patch - 0.06 * r - rand() * 0.42 * r;
      const sy = gy - 0.03 * r - rand() * 0.2 * r;
      const sr = (0.8 + rand() * 1.4) * ss;
      spray += `M${r2(sx - sr)},${r2(sy)}a${r2(sr)},${r2(sr)} 0 1,0 ${r2(2 * sr)},0a${r2(sr)},${r2(sr)} 0 1,0 ${r2(-2 * sr)},0`;
    }
  }

  // Streken fra ringen rundt hjulet ut til lupen
  const dx = cx - tx;
  const dy = cy - ty;
  const d = Math.hypot(dx, dy) || 1;
  const lx1 = tx + (dx / d) * tr;
  const ly1 = ty + (dy / d) * tr;
  const lx2 = cx - (dx / d) * (r + 2);
  const ly2 = cy - (dy / d) * (r + 2);

  // Rotasjonspil langs sideveggen, med klokka (bunnen av dekket går bakover i forhold til navet)
  const ra = RT * 0.79;
  const a0 = (60 * Math.PI) / 180;
  const a1 = (116 * Math.PI) / 180;
  const ax0 = cx + ra * Math.cos(a0);
  const ay0 = ty0 + ra * Math.sin(a0);
  const ax1 = cx + ra * Math.cos(a1);
  const ay1 = ty0 + ra * Math.sin(a1);
  const tx1 = -Math.sin(a1); // retningen pila går i spissen
  const ty1 = Math.cos(a1);
  const hl = 0.2 * r;
  const hw = 0.1 * r;
  const nx = Math.cos(a1);
  const ny = Math.sin(a1);
  const tipX = ax1 + tx1 * hl * 0.6;
  const tipY = ay1 + ty1 * hl * 0.6;
  const head = `M${r2(tipX)},${r2(tipY)}L${r2(ax1 - tx1 * hl * 0.4 + nx * hw)},${r2(ay1 - ty1 * hl * 0.4 + ny * hw)}L${r2(ax1 - tx1 * hl * 0.4 - nx * hw)},${r2(ay1 - ty1 * hl * 0.4 - ny * hw)}Z`;
  const arc = `M${r2(ax0)},${r2(ay0)}A${r2(ra)},${r2(ra)} 0 0 1 ${r2(ax1)},${r2(ay1)}`;

  return (
    <g aria-hidden>
      {/* Ring rundt kontaktflaten i scenen og streken ut til lupen */}
      <g fill="none" strokeLinecap="round">
        <circle cx={tx} cy={ty} r={tr} stroke={VIZ.surface} strokeWidth={3.6 * ss} opacity={0.85} />
        <line x1={lx1} y1={ly1} x2={lx2} y2={ly2} stroke={VIZ.surface} strokeWidth={3.6 * ss} opacity={0.85} />
        <circle cx={tx} cy={ty} r={tr} stroke={VIZ.ink} strokeWidth={1.4 * ss} />
        <line x1={lx1} y1={ly1} x2={lx2} y2={ly2} stroke={VIZ.ink} strokeWidth={1.4 * ss} />
      </g>

      <defs>
        <clipPath id={clip}>
          <circle cx={cx} cy={cy} r={r} />
        </clipPath>
        <clipPath id={above}>
          <rect x={cx - r} y={cy - r} width={2 * r} height={gy - (cy - r) + 0.5} />
        </clipPath>
      </defs>
      <RadialGradient id={tyreId} stops={[[0.6, SCENE.rubber], [0.88, tint(SCENE.rubber, 0.14)], [1, shade(SCENE.rubber, 0.25)]]} />
      <LinearGradient id={rimId} x2={1} y2={1} stops={[[0, SCENE.metalLight], [0.55, SCENE.metal], [1, SCENE.metalDark]]} />
      <LinearGradient id={groundId} stops={[[0, g0], [1, g1]]} />
      {/* Myk skygge under lupen */}
      <circle cx={cx + 2} cy={cy + 3} r={r + 1} fill={alpha(SCENE.shadow, 0.35)} />
      <g clipPath={`url(#${clip})`}>
        {/* Bak dekket: veien som fortsetter innover (litt lysere), og veien foran */}
        <rect x={cx - r} y={cy - r} width={2 * r} height={2 * r} fill={mix(g0, SCENE.skyBottom, 0.18)} />
        <rect x={cx - r} y={gy} width={2 * r} height={cy + r - gy} fill={`url(#${groundId})`} />
        <path d={grains} fill={grainColor} opacity={type === 'asfalt' ? 0.8 : 0.7} />
        {/* Bremsespor bak kontaktflaten når hjulet er låst */}
        {!ruller && <rect x={cx - r} y={gy - 0.5} width={r - patch * 0.3} height={0.11 * r} fill={sporFarge(type)} opacity={0.85} />}
        {/* Dekket, klippet flatt mot veien */}
        <g clipPath={`url(#${above})`}>
          <circle cx={cx} cy={ty0} r={RT} fill={`url(#${tyreId})`} stroke={SCENE.outline} strokeWidth={1 * ss} />
          <path d={grooves} stroke={shade(SCENE.rubber, 0.55)} strokeWidth={(dekk === 'vinter' ? 2.2 : 3.6) * ss} />
          {sipes && <path d={sipes} fill="none" stroke={shade(SCENE.rubber, 0.45)} strokeWidth={0.7 * ss} opacity={0.8} />}
          <circle cx={cx} cy={ty0} r={RT * 0.86} fill="none" stroke={tint(SCENE.rubber, 0.2)} strokeWidth={1.2 * ss} />
          <circle cx={cx} cy={ty0} r={RT * 0.64} fill={`url(#${rimId})`} stroke={shade(SCENE.metalDark, 0.3)} strokeWidth={1 * ss} />
          <circle cx={cx} cy={ty0} r={RT * 0.56} fill={shade(SCENE.metalDark, 0.4)} />
          {/* Eikene i felgen dreier med hjulet */}
          <path d={spokes} fill={tint(SCENE.metal, 0.15)} stroke={shade(SCENE.metalDark, 0.25)} strokeWidth={0.6 * ss} strokeLinejoin="round" />
        </g>
        <line x1={cx - r} x2={cx + r} y1={gy} y2={gy} stroke={type === 'sno' || type === 'is' ? SCENE.iceShine : tint(g0, 0.25)} strokeWidth={1 * ss} opacity={0.8} />
        {spray && <path d={spray} fill={type === 'asfalt' || type === 'vaat-asfalt' ? shade(SCENE.rubber, 0.1) : SCENE.snow} stroke={SCENE.outline} strokeWidth={0.4 * ss} opacity={0.85} />}
        {ruller && !stille && (
          <g>
            <path d={arc} fill="none" stroke={VIZ.surface} strokeWidth={5 * ss} strokeLinecap="round" />
            <path d={head} fill={VIZ.surface} stroke={VIZ.surface} strokeWidth={2.6 * ss} strokeLinejoin="round" />
            <path d={arc} fill="none" stroke={VIZ.ink} strokeWidth={2.2 * ss} strokeLinecap="round" />
            <path d={head} fill={VIZ.ink} />
          </g>
        )}
        {/* Kontaktflaten */}
        <line x1={cx - patch} x2={cx + patch} y1={gy} y2={gy} stroke={VIZ.ink} strokeWidth={2.2 * ss} strokeLinecap="round" opacity={0.85} />
      </g>
      {/* Rammen */}
      <circle cx={cx} cy={cy} r={r} fill="none" stroke={VIZ.surface} strokeWidth={4 * ss} />
      <circle cx={cx} cy={cy} r={r} fill="none" stroke={SCENE.outline} strokeWidth={1.6 * ss} />
      <circle cx={cx} cy={cy} r={r - 2.6 * ss} fill="none" stroke={SCENE.highlight} strokeWidth={1 * ss} opacity={0.5} />
      <Txt x={cx} y={cy + 0.82 * r} size={0.8} weight={720}>
        {tekst}
      </Txt>
    </g>
  );
}
