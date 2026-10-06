/**
 * Egne gjenstander til «Eksplosjon og rekyl» (kapittel 4), i samme stil som scene-kit-et: toninger fra core,
 * SCENE-farger, kontur og myk skygge.
 *
 * - `Skoyteloper`: en person på skøyter (Person fra scene-kit-et med skøyteskinner under skoene), som står i
 *   skrittstilling med flate såler og enten dytter med håndflatene mot et punkt eller glir med armene fram.
 * - `Jaktrifle`: jaktrifle med kikkertsikte sett fra siden, munningen mot høyre. Løpet er tegnet gjennomskåret, så
 *   patronen, kula og kruttgassen synes inni.
 * - `Gevaerkule`, `Skytepute` (sandsekk som geværet hviler på), `Kruttrøyk` (gass og røyk ved munningen),
 *   `Labbane` (aluminiumsbane med endestopp) og `Skilt` (verdiskilt med senket skrift).
 */
import type { ReactNode } from 'react';
import { Txt, VIZ, useTextScale } from '../../kit';
import {
  ContactShadow,
  LinearGradient,
  PAINTS,
  Person,
  RadialGradient,
  SCENE,
  alpha,
  materialStops,
  mix,
  personPunkter,
  shade,
  tint,
  useStrokeScale,
  useSvgId,
  type Leddvinkler,
  type PaintName,
} from '../../kit/scene';
import { stanceLegs } from './eksplosjon-form';

const r2 = (v: number) => (Number.isFinite(v) ? Math.round(v * 100) / 100 : 0);

/* ================================================================================================
 * Skøyteløper
 * ============================================================================================== */

/** Høyden på skøyteskinna under sålen i personens enheter (100 = hele høyden): ca. 6 cm for en voksen. */
export const BLADE_H = 3.6;

/** Positur under dyttet og når personen glir etterpå (leddvinkler i grader, se `Leddvinkler`). */
const PUSH_STANCE = { rygg: 12, nakke: -9, drop: 49.8, back: -14, front: 8 };
const GLIDE_STANCE = { rygg: 5, nakke: -2, drop: 50.5, back: -9, front: 8 };
/** Armene etter dyttet: strake fram (rett etter) og senket (når personen glir). */
const ARMS_OUT = { venstreSkulder: 84, hoyreSkulder: 78, venstreAlbue: 4, hoyreAlbue: 6 };
const ARMS_GLIDE = { venstreSkulder: 22, hoyreSkulder: 12, venstreAlbue: 26, hoyreAlbue: 24 };

/**
 * Leddvinklene til en skøyteløper. `push` (0–1) blander dyttestillingen (1) og glidestillingen (0) for overkroppen og
 * beina, og `relax` (0–1) senker armene fra strake fram (0) til glidestillingen (1) når hendene ikke er festet.
 */
export function skaterLedd(push: number, relax: number, handsFixed: boolean): Partial<Leddvinkler> {
  const p = Math.min(1, Math.max(0, push));
  const lerp = (a: number, b: number) => b + (a - b) * p;
  const rygg = lerp(PUSH_STANCE.rygg, GLIDE_STANCE.rygg);
  const legs = stanceLegs(
    rygg,
    lerp(PUSH_STANCE.drop, GLIDE_STANCE.drop),
    lerp(PUSH_STANCE.back, GLIDE_STANCE.back),
    lerp(PUSH_STANCE.front, GLIDE_STANCE.front),
  );
  const out: Partial<Leddvinkler> = { rygg, nakke: lerp(PUSH_STANCE.nakke, GLIDE_STANCE.nakke), ...legs };
  if (!handsFixed) {
    const q = Math.min(1, Math.max(0, relax));
    const s = q * q * (3 - 2 * q);
    for (const key of ['venstreSkulder', 'hoyreSkulder', 'venstreAlbue', 'hoyreAlbue'] as const)
      out[key] = ARMS_OUT[key] + (ARMS_GLIDE[key] - ARMS_OUT[key]) * s;
  }
  return out;
}

export interface SkoyteloperProps {
  /** Midt mellom skøyteskinnene, på isen. */
  x: number;
  y: number;
  /** Høyden til personen (figurens enheter). */
  size: number;
  /** Ser mot venstre (personen til høyre). */
  flip?: boolean;
  ledd: Partial<Leddvinkler>;
  /** Håndflatene mot dette punktet (dyttet), ellers styrer `ledd` armene. */
  hands?: { x: number; y: number } | null;
  jakke: PaintName | string;
  bukse?: PaintName | string;
  lue?: PaintName | string;
  har?: 'blond' | 'brun' | 'svart' | 'rod' | 'graa';
  hud?: 'lys' | 'middels' | 'mork';
  frisyre?: 'kort' | 'lang' | 'hestehale';
  title?: string;
}

/** Punktene til personen i figuren (samme plassering som Skoyteloper tegner den). */
export function skoyteloperPunkter(p: Pick<SkoyteloperProps, 'x' | 'y' | 'size' | 'flip' | 'ledd' | 'hands'>) {
  const k = p.size / 100;
  const pose = p.hands ? 'skyve' : 'staa';
  return personPunkter(pose, p.size, p.ledd, { x: p.x, y: p.y - BLADE_H * k, flip: p.flip, fest: handFest(p.hands, k) });
}

function handFest(hands: SkoyteloperProps['hands'], k: number) {
  if (!hands) return undefined;
  // Den bakerste hånda litt høyere, så begge håndflatene synes mot hverandre.
  return { hoyreHand: { x: hands.x, y: hands.y }, venstreHand: { x: hands.x, y: hands.y - 3.2 * k } };
}

/**
 * Person på skøyter: Person fra scene-kit-et (positur 'skyve' med flate hender mens den dytter, ellers 'staa') løftet
 * opp på to skøyteskinner med holder, med skygge på isen. Ankerpunktet (x, y) er midt mellom skinnene, på isen.
 */
export function Skoyteloper({ x, y, size, flip, ledd, hands, jakke, bukse, lue, har, hud, frisyre, title }: SkoyteloperProps) {
  const k = size / 100;
  const py = y - BLADE_H * k;
  const pose = hands ? 'skyve' : 'staa';
  const fest = handFest(hands, k);
  const pts = personPunkter(pose, size, ledd, { x, y: py, flip, fest });
  const dir = flip ? -1 : 1;
  // Den nære foten (høyre) tegnes foran personen, den bortre bak.
  const far = pts.venstreFot;
  const near = pts.hoyreFot;
  return (
    <g>
      {title && <title>{title}</title>}
      <ContactShadow cx={x} cy={y + 0.6 * k} rx={22 * k} ry={Math.max(2.5, 2.4 * k)} />
      <Skoyteskinne x={far.x} y={y} sole={py} k={k} dir={dir} far />
      <Person
        x={x}
        y={py}
        size={size}
        pose={pose}
        ledd={ledd}
        fest={fest}
        flip={flip}
        jakke={jakke}
        bukse={bukse}
        lue={lue}
        har={har}
        hud={hud}
        frisyre={frisyre}
        sko="svart"
        skygge={false}
      />
      <Skoyteskinne x={near.x} y={y} sole={py} k={k} dir={dir} />
    </g>
  );
}

/**
 * Skøyteskinne med holder under én sko: stålskinne som ligger på isen og bøyer seg opp foran, og en mørk holder
 * opp til sålen. (x, y) er midt under sålen på isen, `sole` er sålens høyde, `dir` retningen tåa peker.
 */
function Skoyteskinne({ x, y, sole, k, dir, far }: { x: number; y: number; sole: number; k: number; dir: 1 | -1; far?: boolean }) {
  const id = useSvgId('skinne');
  const ss = useStrokeScale();
  // Langs foten (fra sålens midtpunkt): hælen ved −7,4, tåa ved +7,8 (personens enheter).
  const X = (u: number) => r2(x + dir * u * k);
  const steel = 1.15 * k;
  const top = y - steel;
  const runner = `M${X(-9.4)},${r2(y)}L${X(8.2)},${r2(y)}Q${X(10.6)},${r2(y)} ${X(10.9)},${r2(y - 1.7 * k)}L${X(10.2)},${r2(y - 2.2 * k)}Q${X(9.6)},${r2(top)} ${X(8)},${r2(top)}L${X(-9.4)},${r2(top)}Q${X(-10)},${r2(y - steel / 2)} ${X(-9.4)},${r2(y)}Z`;
  // Holderen: to søyler under hælen og fotballen, forbundet langs skinna, med en bue mellom.
  const holder = `M${X(-7.6)},${r2(sole)}L${X(-6.8)},${r2(top)}L${X(8.4)},${r2(top)}L${X(8.8)},${r2(sole)}L${X(5.8)},${r2(sole)}Q${X(3.8)},${r2(top + 0.9 * k)} ${X(1.4)},${r2(top + 0.9 * k)}L${X(-1.4)},${r2(top + 0.9 * k)}Q${X(-3.6)},${r2(top + 0.9 * k)} ${X(-4.8)},${r2(sole)}Z`;
  const holderColor = far ? shade(PAINTS.svart, 0.15) : PAINTS.svart;
  return (
    <g aria-hidden>
      <LinearGradient
        id={`${id}s`}
        stops={[
          [0, SCENE.metalLight],
          [0.5, SCENE.metal],
          [1, SCENE.metalDark],
        ]}
      />
      <path d={holder} fill={holderColor} stroke={SCENE.outline} strokeWidth={0.6 * ss} strokeLinejoin="round" />
      <path d={runner} fill={`url(#${id}s)`} stroke={SCENE.outline} strokeWidth={0.6 * ss} strokeLinejoin="round" />
      <line
        x1={X(-8.8)}
        y1={r2(top + 0.3 * k)}
        x2={X(7.6)}
        y2={r2(top + 0.3 * k)}
        stroke={SCENE.highlight}
        strokeWidth={0.7 * ss}
        strokeLinecap="round"
      />
    </g>
  );
}

/* ================================================================================================
 * Jaktrifle, kule og skytepute
 * ============================================================================================== */

/** Målene til rifla i meter, fra munningen (x = 0, på løpets akse) og bakover (negativ x). */
export const RIFLE = {
  /** Hele lengden, fra munningen til kolbeplata. */
  length: 1.12,
  /** Løpet: fra kammeret (der kula ligger i patronen) til munningen. Kula får fart over hele denne lengden. */
  barrel: 0.6,
  /** Patronhylsa i kammeret (bak kula). */
  caseLength: 0.066,
  /** Halve tykkelsen av løpet ved kammeret og ved munningen, og løpets indre radius. */
  rChamber: 0.0145,
  rMuzzle: 0.0095,
  bore: 0.0042,
  /** Hvor den fremre og bakre sandsekken støtter rifla (m fra munningen), og hvor langt under aksen undersiden er. */
  restFront: -0.4,
  restFrontY: 0.042,
  restBack: -1.02,
  restBackY: 0.1,
} as const;

/** Kolben, forskjeftet og pistolgrepet i tre (meter, x fra munningen, y ned fra aksen). */
const STOCK: [number, number][] = [
  [-0.3, 0.011],
  [-0.62, 0.011],
  [-0.84, 0.0],
  [-0.9, -0.012],
  [-0.96, -0.026],
  [-1.115, -0.032],
  [-1.12, 0.0],
  [-1.115, 0.115],
  [-1.06, 0.112],
  [-0.9, 0.075],
  [-0.87, 0.098],
  [-0.84, 0.104],
  [-0.81, 0.07],
  [-0.79, 0.034],
  [-0.62, 0.047],
  [-0.36, 0.036],
  [-0.3, 0.026],
];

/**
 * Jaktrifle med kikkertsikte sett fra siden, munningen mot høyre. Ankerpunktet (x, y) er munningen på løpets akse,
 * `P` er piksler per meter. Løpet er gjennomskåret: `bullet` er hvor langt kula har gått fra kammeret (m; null =
 * kula er ute av løpet), og `gas` (0–1) viser kruttgassen bak kula. `bulletLength` og `bulletDiameter` i meter.
 */
export function Jaktrifle({
  x,
  y,
  P,
  bullet,
  gas,
  bulletLength,
  bulletDiameter,
  title,
}: {
  x: number;
  y: number;
  P: number;
  bullet: number | null;
  gas: number;
  bulletLength: number;
  bulletDiameter: number;
  title?: string;
}) {
  const id = useSvgId('rifle');
  const ss = useStrokeScale();
  const X = (m: number) => r2(x + m * P);
  const Y = (m: number) => r2(y + m * P);
  const stockPath = smoothPath(STOCK.map(([a, b]) => [x + a * P, y + b * P]));
  const chamber = -RIFLE.barrel;
  const caseBack = chamber - RIFLE.caseLength;
  // Løpet (stål), smalere mot munningen, med boringen gjennomskåret
  const barrelTop = `M${X(chamber - 0.02)},${Y(-RIFLE.rChamber)}L${X(-0.4)},${Y(-RIFLE.rChamber * 0.86)}L${X(0)},${Y(-RIFLE.rMuzzle)}L${X(0)},${Y(RIFLE.rMuzzle)}L${X(-0.4)},${Y(RIFLE.rChamber * 0.86)}L${X(chamber - 0.02)},${Y(RIFLE.rChamber)}Z`;
  const bore = RIFLE.bore;
  const travel = bullet === null ? null : Math.min(RIFLE.barrel, Math.max(0, bullet));
  const gasEnd = travel === null ? 0 : chamber + travel;
  return (
    <g>
      {title && <title>{title}</title>}
      <LinearGradient
        id={`${id}w`}
        stops={[
          [0, tint(SCENE.wood, 0.18)],
          [0.35, SCENE.wood],
          [1, shade(SCENE.woodDark, 0.25)],
        ]}
      />
      <LinearGradient
        id={`${id}m`}
        stops={[
          [0, tint(SCENE.metalDark, 0.25)],
          [0.3, shade(SCENE.metalDark, 0.15)],
          [1, shade(SCENE.metalDark, 0.55)],
        ]}
      />
      <LinearGradient
        id={`${id}s`}
        stops={[
          [0, shade(SCENE.rubber, 0.0)],
          [0.4, tint(SCENE.rubber, 0.12)],
          [1, shade(SCENE.rubber, 0.3)],
        ]}
      />
      <LinearGradient
        id={`${id}g`}
        x1={0}
        x2={1}
        y1={0}
        y2={0}
        stops={[
          [0, SCENE.hot, 0.25],
          [0.75, SCENE.warm, 0.85],
          [1, SCENE.glow, 0.95],
        ]}
      />

      {/* Kolbe og forskjefte i tre, med gummiplate bak */}
      <path d={stockPath} fill={`url(#${id}w)`} stroke={SCENE.outline} strokeWidth={0.9 * ss} strokeLinejoin="round" />
      <path
        d={`M${X(-1.12)},${Y(-0.03)}L${X(-1.12 - 0.022)},${Y(-0.028)}L${X(-1.12 - 0.022)},${Y(0.114)}L${X(-1.115)},${Y(0.116)}Z`}
        fill={shade(SCENE.rubber, 0.1)}
        stroke={SCENE.outline}
        strokeWidth={0.7 * ss}
      />
      <path
        d={`M${X(-0.95)},${Y(-0.018)}Q${X(-1.04)},${Y(-0.03)} ${X(-1.1)},${Y(-0.024)}`}
        fill="none"
        stroke={SCENE.highlight}
        strokeWidth={1 * ss}
        strokeLinecap="round"
      />
      {/* Rutemønster på grepet */}
      <path
        d={`M${X(-0.885)},${Y(0.04)}L${X(-0.845)},${Y(0.09)}M${X(-0.875)},${Y(0.025)}L${X(-0.83)},${Y(0.08)}M${X(-0.85)},${Y(0.025)}L${X(-0.885)},${Y(0.07)}M${X(-0.83)},${Y(0.035)}L${X(-0.865)},${Y(0.09)}`}
        stroke={shade(SCENE.woodDark, 0.25)}
        strokeWidth={0.8 * ss}
        opacity={0.6}
      />

      {/* Avtrekkerbøyle og avtrekker */}
      <path
        d={`M${X(-0.79)},${Y(0.03)}Q${X(-0.8)},${Y(0.062)} ${X(-0.765)},${Y(0.064)}L${X(-0.71)},${Y(0.062)}Q${X(-0.69)},${Y(0.058)} ${X(-0.69)},${Y(0.036)}`}
        fill="none"
        stroke={shade(SCENE.metalDark, 0.4)}
        strokeWidth={Math.max(1.6 * ss, 0.006 * P)}
        strokeLinecap="round"
      />
      <path
        d={`M${X(-0.745)},${Y(0.024)}Q${X(-0.755)},${Y(0.042)} ${X(-0.748)},${Y(0.052)}`}
        fill="none"
        stroke={shade(SCENE.metalDark, 0.5)}
        strokeWidth={Math.max(1.4 * ss, 0.005 * P)}
        strokeLinecap="round"
      />

      {/* Låskasse (sylinder) med sluttstykke og håndtak */}
      <rect
        x={X(-0.84)}
        y={Y(-0.019)}
        width={r2(0.24 * P)}
        height={r2(0.041 * P)}
        rx={r2(0.01 * P)}
        fill={`url(#${id}m)`}
        stroke={SCENE.outline}
        strokeWidth={0.9 * ss}
      />
      <line
        x1={X(-0.83)}
        y1={Y(-0.013)}
        x2={X(-0.61)}
        y2={Y(-0.013)}
        stroke={SCENE.highlight}
        strokeWidth={0.9 * ss}
        strokeLinecap="round"
        opacity={0.7}
      />
      <path
        d={`M${X(-0.79)},${Y(0.0)}L${X(-0.815)},${Y(0.035)}`}
        stroke={shade(SCENE.metalDark, 0.3)}
        strokeWidth={Math.max(2 * ss, 0.007 * P)}
        strokeLinecap="round"
      />
      <circle
        cx={X(-0.818)}
        cy={Y(0.04)}
        r={Math.max(2.4 * ss, 0.009 * P)}
        fill={shade(SCENE.metalDark, 0.2)}
        stroke={SCENE.outline}
        strokeWidth={0.7 * ss}
      />

      {/* Løpet: stål med boringen gjennomskåret */}
      <path d={barrelTop} fill={`url(#${id}m)`} stroke={SCENE.outline} strokeWidth={0.9 * ss} strokeLinejoin="round" />
      <rect
        x={X(caseBack - 0.004)}
        y={Y(-bore * 2.4)}
        width={r2((-caseBack + 0.004) * P)}
        height={r2(bore * 4.8 * P)}
        fill={shade(SCENE.metalDark, 0.7)}
      />
      <rect x={X(chamber)} y={Y(-bore)} width={r2(RIFLE.barrel * P)} height={r2(2 * bore * P)} fill={shade(SCENE.metalDark, 0.75)} />
      {/* Riller i løpet (som tynne skrå streker) */}
      <path
        d={Array.from({ length: 14 }, (_, i) => {
          const a = chamber + 0.03 + (i * (RIFLE.barrel - 0.05)) / 13;
          return `M${X(a)},${Y(-bore)}L${X(a + 0.012)},${Y(bore)}`;
        }).join('')}
        stroke={shade(SCENE.metalDark, 0.45)}
        strokeWidth={0.6 * ss}
        opacity={0.5}
      />
      {/* Kruttgassen bak kula mens den er i løpet */}
      {travel !== null && gas > 0 && gasEnd > caseBack && (
        <rect
          x={X(caseBack)}
          y={Y(-bore * 0.95)}
          width={r2((gasEnd - caseBack) * P)}
          height={r2(bore * 1.9 * P)}
          fill={`url(#${id}g)`}
          opacity={Math.min(1, gas)}
        />
      )}
      {/* Patronhylsa i kammeret (messing) */}
      <path
        d={`M${X(caseBack)},${Y(-bore * 2.3)}L${X(chamber - 0.012)},${Y(-bore * 2.3)}L${X(chamber - 0.004)},${Y(-bore * 1.05)}L${X(chamber)},${Y(-bore * 1.05)}L${X(chamber)},${Y(bore * 1.05)}L${X(chamber - 0.004)},${Y(bore * 1.05)}L${X(chamber - 0.012)},${Y(bore * 2.3)}L${X(caseBack)},${Y(bore * 2.3)}Z`}
        fill={gas > 0 && travel !== null ? alpha(SCENE.gold, 0.55) : SCENE.gold}
        stroke={shade(SCENE.gold, 0.45)}
        strokeWidth={0.6 * ss}
      />
      {travel !== null && (
        <Gevaerkule x={x + (chamber + travel) * P} y={y} P={P} length={bulletLength} diameter={Math.min(bulletDiameter, 2 * bore)} />
      )}
      {/* Kanten av snittet */}
      <line x1={X(chamber)} y1={Y(-bore)} x2={X(0)} y2={Y(-bore)} stroke={shade(SCENE.metalDark, 0.2)} strokeWidth={0.6 * ss} />
      <line x1={X(chamber)} y1={Y(bore)} x2={X(0)} y2={Y(bore)} stroke={shade(SCENE.metalDark, 0.2)} strokeWidth={0.6 * ss} />
      <line
        x1={X(chamber - 0.02)}
        y1={Y(-RIFLE.rChamber + 0.002)}
        x2={X(-0.01)}
        y2={Y(-RIFLE.rMuzzle + 0.002)}
        stroke={SCENE.highlight}
        strokeWidth={0.9 * ss}
        strokeLinecap="round"
        opacity={0.6}
      />

      {/* Kikkertsikte med feste */}
      {[-0.78, -0.66].map((a) => (
        <rect
          key={a}
          x={X(a - 0.012)}
          y={Y(-0.05)}
          width={r2(0.024 * P)}
          height={r2(0.032 * P)}
          rx={r2(0.004 * P)}
          fill={shade(SCENE.metalDark, 0.45)}
          stroke={SCENE.outline}
          strokeWidth={0.6 * ss}
        />
      ))}
      <path
        d={`M${X(-0.88)},${Y(-0.074)}L${X(-0.82)},${Y(-0.071)}L${X(-0.8)},${Y(-0.066)}L${X(-0.6)},${Y(-0.066)}L${X(-0.56)},${Y(-0.078)}L${X(-0.5)},${Y(-0.08)}L${X(-0.5)},${Y(-0.036)}L${X(-0.56)},${Y(-0.038)}L${X(-0.6)},${Y(-0.05)}L${X(-0.8)},${Y(-0.05)}L${X(-0.82)},${Y(-0.045)}L${X(-0.88)},${Y(-0.042)}Z`}
        fill={`url(#${id}s)`}
        stroke={SCENE.outline}
        strokeWidth={0.8 * ss}
        strokeLinejoin="round"
      />
      <rect
        x={X(-0.72)}
        y={Y(-0.083)}
        width={r2(0.03 * P)}
        height={r2(0.018 * P)}
        rx={r2(0.003 * P)}
        fill={tint(SCENE.rubber, 0.1)}
        stroke={SCENE.outline}
        strokeWidth={0.6 * ss}
      />
      <line
        x1={X(-0.79)}
        y1={Y(-0.0625)}
        x2={X(-0.61)}
        y2={Y(-0.0625)}
        stroke={SCENE.highlight}
        strokeWidth={0.8 * ss}
        strokeLinecap="round"
        opacity={0.6}
      />
      <rect x={X(-0.502)} y={Y(-0.077)} width={r2(Math.max(0.004 * P, 1.2))} height={r2(0.038 * P)} fill={alpha(SCENE.glass, 0.9)} />
    </g>
  );
}

/** Glatt lukket form gjennom kontrollpunktene (kvadratiske kurver mellom midtpunktene). */
function smoothPath(pts: [number, number][]): string {
  const n = pts.length;
  const mid = (a: [number, number], b: [number, number]) => `${r2((a[0] + b[0]) / 2)},${r2((a[1] + b[1]) / 2)}`;
  let d = `M${mid(pts[n - 1]!, pts[0]!)}`;
  for (let i = 0; i < n; i++) d += `Q${r2(pts[i]![0])},${r2(pts[i]![1])} ${mid(pts[i]!, pts[(i + 1) % n]!)}`;
  return `${d}Z`;
}

/** Gevaerkule (kobberkappe med spiss) sett fra siden. (x, y) er bakkanten midt på aksen, spissen peker mot høyre. */
export function Gevaerkule({ x, y, P, length, diameter }: { x: number; y: number; P: number; length: number; diameter: number }) {
  const id = useSvgId('kule');
  const ss = useStrokeScale();
  const L = Math.max(4, length * P);
  const r = Math.max(1.4, (diameter * P) / 2);
  const d = `M${r2(x)},${r2(y - r * 0.92)}L${r2(x + L * 0.5)},${r2(y - r)}Q${r2(x + L * 0.86)},${r2(y - r)} ${r2(x + L)},${r2(y)}Q${r2(x + L * 0.86)},${r2(y + r)} ${r2(x + L * 0.5)},${r2(y + r)}L${r2(x)},${r2(y + r * 0.92)}Z`;
  return (
    <g aria-hidden>
      <LinearGradient
        id={id}
        stops={[
          [0, tint(SCENE.copper, 0.45)],
          [0.4, SCENE.copper],
          [1, shade(SCENE.copper, 0.4)],
        ]}
      />
      <path d={d} fill={`url(#${id})`} stroke={shade(SCENE.copper, 0.5)} strokeWidth={0.5 * ss} strokeLinejoin="round" />
    </g>
  );
}

/**
 * Sandsekk (skytepute) som geværet hviler på: en avlang pute i lerret med et søkk på toppen. (x, y) er midt på
 * bunnen, `w` og `h` bredden og høyden.
 */
export function Skytepute({ x, y, w, h }: { x: number; y: number; w: number; h: number }) {
  const id = useSvgId('pute');
  const ss = useStrokeScale();
  const c = mix(SCENE.woodLight, SCENE.grassDark, 0.42);
  const d = `M${r2(x - w / 2)},${r2(y)}Q${r2(x - w / 2 - w * 0.06)},${r2(y - h * 0.55)} ${r2(x - w * 0.42)},${r2(y - h)}Q${r2(x - w * 0.15)},${r2(y - h * 1.04)} ${r2(x)},${r2(y - h * 0.82)}Q${r2(x + w * 0.15)},${r2(y - h * 1.04)} ${r2(x + w * 0.42)},${r2(y - h)}Q${r2(x + w / 2 + w * 0.06)},${r2(y - h * 0.55)} ${r2(x + w / 2)},${r2(y)}Z`;
  return (
    <g aria-hidden>
      <ContactShadow cx={x} cy={y} rx={w * 0.56} ry={Math.max(2, h * 0.12)} />
      <LinearGradient id={id} stops={materialStops(c, 1.2)} />
      <path d={d} fill={`url(#${id})`} stroke={SCENE.outline} strokeWidth={0.8 * ss} strokeLinejoin="round" />
      <path
        d={`M${r2(x - w * 0.36)},${r2(y - h * 0.5)}Q${r2(x)},${r2(y - h * 0.35)} ${r2(x + w * 0.36)},${r2(y - h * 0.5)}`}
        fill="none"
        stroke={shade(c, 0.3)}
        strokeWidth={0.8 * ss}
        strokeDasharray={`${2.5 * ss} ${2 * ss}`}
        opacity={0.7}
      />
    </g>
  );
}

/**
 * Kruttgass og røyk som strømmer ut av munningen etter at kula har forlatt løpet. (x, y) er munningen, `age` er
 * tiden siden kula kom ut (0–1 av hvor lenge skyen vises), `size` den største radien.
 */
export function Kruttroyk({ x, y, age, size }: { x: number; y: number; age: number; size: number }) {
  const id = useSvgId('royk');
  if (!(age >= 0) || age > 1) return null;
  const r = size * (0.35 + 0.65 * Math.sqrt(age));
  const flash = Math.max(0, 1 - age * 4);
  return (
    <g aria-hidden>
      <RadialGradient
        id={`${id}r`}
        stops={[
          [0, tint(SCENE.cloudShade, 0.2), 0.85],
          [0.6, SCENE.cloudShade, 0.45],
          [1, SCENE.cloudShade, 0],
        ]}
      />
      <RadialGradient
        id={`${id}f`}
        stops={[
          [0, SCENE.glow, 0.95],
          [0.45, SCENE.warm, 0.7],
          [1, SCENE.hot, 0],
        ]}
      />
      <ellipse cx={x + r * 0.75} cy={y - r * 0.08} rx={r} ry={r * 0.62} fill={`url(#${id}r)`} opacity={1 - age * 0.6} />
      {flash > 0 && <ellipse cx={x + size * 0.22} cy={y} rx={size * 0.34} ry={size * 0.17} fill={`url(#${id}f)`} opacity={flash} />}
    </g>
  );
}

/* ================================================================================================
 * Labbane
 * ============================================================================================== */

/**
 * Aluminiumsbane for dynamikkvogner sett fra siden: profil med lys overkant, justerbare føtter og et endestopp i hver
 * ende. (x1, x2) er endene, y overkanten der hjulene ruller, h høyden på profilen, `foot` benkeplata.
 */
export function Labbane({
  x1,
  x2,
  y,
  h,
  foot,
  feet,
  stop,
}: {
  x1: number;
  x2: number;
  y: number;
  h: number;
  foot: number;
  feet: number[];
  stop: number;
}) {
  const id = useSvgId('bane');
  const ss = useStrokeScale();
  const lip = Math.max(2.5, h * 0.12);
  return (
    <g aria-hidden>
      <LinearGradient
        id={`${id}p`}
        stops={[
          [0, tint(SCENE.metalLight, 0.2)],
          [0.18, SCENE.metalLight],
          [0.6, SCENE.metal],
          [1, SCENE.metalDark],
        ]}
      />
      <LinearGradient
        id={`${id}f`}
        x2={1}
        y2={0}
        stops={[
          [0, tint(SCENE.rubber, 0.25)],
          [0.5, SCENE.rubber],
          [1, shade(SCENE.rubber, 0.25)],
        ]}
      />
      <LinearGradient id={`${id}e`} stops={materialStops(SCENE.rubber, 1.6)} />
      <ContactShadow cx={(x1 + x2) / 2} cy={foot} rx={(x2 - x1) * 0.52} ry={4} opacity={0.55} />
      {feet.map((fx) => {
        const fw = Math.max(10, h * 0.9);
        return (
          <g key={fx}>
            <ContactShadow cx={fx} cy={foot} rx={fw * 0.8} ry={2.5} />
            <rect x={fx - 1.6 * ss} y={y + h - 1} width={3.2 * ss} height={foot - y - h} fill={SCENE.metalDark} />
            <path
              d={`M${r2(fx - fw / 2)},${r2(foot)}L${r2(fx - fw * 0.36)},${r2(foot - (foot - y - h) * 0.55)}L${r2(fx + fw * 0.36)},${r2(foot - (foot - y - h) * 0.55)}L${r2(fx + fw / 2)},${r2(foot)}Z`}
              fill={`url(#${id}f)`}
              stroke={SCENE.outline}
              strokeWidth={0.8 * ss}
            />
          </g>
        );
      })}
      <rect x={x1} y={y} width={x2 - x1} height={h} fill={`url(#${id}p)`} stroke={SCENE.outline} strokeWidth={1 * ss} />
      <rect x={x1} y={y} width={x2 - x1} height={lip} fill={tint(SCENE.metalLight, 0.35)} />
      <line x1={x1} y1={y + lip} x2={x2} y2={y + lip} stroke={shade(SCENE.metal, 0.3)} strokeWidth={0.9 * ss} />
      <line
        x1={x1}
        y1={y + h - 1.6 * ss}
        x2={x2}
        y2={y + h - 1.6 * ss}
        stroke={shade(SCENE.metal, 0.35)}
        strokeWidth={1.1 * ss}
        opacity={0.7}
      />
      <line x1={x1} y1={y + 0.6 * ss} x2={x2} y2={y + 0.6 * ss} stroke={SCENE.highlight} strokeWidth={1.1 * ss} />
      {/* Endestopp med gummiklosser */}
      {[x1, x2].map((ex, i) => {
        const dirIn = i === 0 ? 1 : -1;
        const bw = Math.max(8, h * 0.55);
        const left = i === 0 ? ex : ex - bw;
        return (
          <g key={ex}>
            <rect
              x={left}
              y={y - stop}
              width={bw}
              height={stop + 1}
              rx={2}
              fill={`url(#${id}p)`}
              stroke={SCENE.outline}
              strokeWidth={0.9 * ss}
            />
            <rect
              x={dirIn > 0 ? left + bw : left - bw * 0.45}
              y={y - stop * 0.72}
              width={bw * 0.45}
              height={stop * 0.44}
              rx={2}
              fill={`url(#${id}e)`}
              stroke={SCENE.outline}
              strokeWidth={0.7 * ss}
            />
          </g>
        );
      })}
    </g>
  );
}

/* ================================================================================================
 * Skilt
 * ============================================================================================== */

/** Høyden på et skilt med relativ tekststørrelse `size`. */
export const tagHeight = (f: number, size: number) => 17 * f * size * 1.55;

/** Bredden på et skilt med teksten `text` (samme regel som ValueTag). */
export function tagWidth(text: string, f: number, size: number): number {
  const fs = 17 * f * size;
  return Math.max(fs * 1.6, text.length * fs * 0.6 + 16 * f);
}

/** Skilt med en verdi (som ValueTag), men med vanlig SVG-innhold (senket skrift). `measure` er teksten som gir bredden. */
export function Skilt({
  x,
  y,
  children,
  measure,
  color,
  anchor = 'middle',
  size = 0.9,
}: {
  x: number;
  y: number;
  children: ReactNode;
  measure: string;
  color?: string;
  anchor?: 'start' | 'middle' | 'end';
  size?: number;
}) {
  const f = useTextScale();
  const ss = useStrokeScale();
  const fs = 17 * f * size;
  const w = tagWidth(measure, f, size);
  const h = fs * 1.55;
  const left = anchor === 'middle' ? x - w / 2 : anchor === 'start' ? x : x - w;
  return (
    <g>
      <rect
        x={left}
        y={y - h / 2}
        width={w}
        height={h}
        rx={h * 0.32}
        fill={VIZ.surface}
        stroke={SCENE.outline}
        strokeWidth={1 * ss}
        opacity={0.96}
      />
      <Txt x={left + w / 2} y={y + fs * 0.34} anchor="middle" size={size} color={color} weight={700} halo={false}>
        {children}
      </Txt>
    </g>
  );
}
