/**
 * Mønstre for bergarter, sedimenter og løsmasser, som på geologiske kart og i PDF-malen «Atlas»: prikker for sandstein,
 * murstein for kalkstein, små kryss for granitt, v-er for basalt … Ett SVG-mønster per `MonsterId` (typer.ts), med
 * bakgrunn og strek fra `GEO.bergart[id]`, så mønstrene følger lyst og mørkt tema.
 *
 *   const lag = useLagMonstre();                 // unik id for denne figuren
 *   <LagMonstre id={lag.id} />                   // én gang, først i figuren
 *   <path d={…} {...lag.fyll('sandstein')} strokeWidth={lag.kontur} />
 *   <LagFlate d={…} type="kalkstein" monstre={lag.id} />   // med kontur og lys ovenfra
 *
 * Mønstrene vokser på mobil (`useGeoScale`), og strekene følger `useGeoStroke`, så de synes også når figuren er
 * skalert ned til ca. 330 px.
 */
import { memo, useMemo, type ReactNode } from 'react';
import { LinearGradient, mix, sceneRandom, shade, tint, useSvgId } from '../../kit/scene/core';
import { SCENE } from '../../kit/scene/palette';
import { GEO } from './colors';
import { useGeoScale, useGeoStroke } from './felles';
import { MONSTER_IDS, type MonsterId } from './typer';

/** Navnet på hvert mønster til forklaringer og knapper (bokmål, stor forbokstav bare først). */
export const MONSTER_NAVN: Record<MonsterId, string> = {
  granitt: 'Granitt',
  gneis: 'Gneis',
  basalt: 'Basalt',
  gabbro: 'Gabbro',
  diabas: 'Diabas',
  sandstein: 'Sandstein',
  siltstein: 'Siltstein',
  leirskifer: 'Leirskifer',
  glimmerskifer: 'Glimmerskifer',
  kalkstein: 'Kalkstein',
  marmor: 'Marmor',
  kvartsitt: 'Kvartsitt',
  konglomerat: 'Konglomerat',
  salt: 'Salt',
  kull: 'Kull',
  morene: 'Morene',
  breelv: 'Breelvavsetning',
  leire: 'Leire',
  kvikkleire: 'Kvikkleire',
  silt: 'Silt',
  sand: 'Sand',
  grus: 'Grus',
  torv: 'Torv',
  ur: 'Ur',
  aske: 'Vulkansk aske',
  malmsone: 'Malmsone',
};

/** Standard-id for mønstrene når figuren bare har én `<LagMonstre />` og ingen id. */
export const LAG_MONSTRE_ID = 'geo-lag';

/** Fyll og kontur for et lag: kan spres rett på en form, `<path d={…} {...lagFyll('leire')} />`. */
export interface LagFyll {
  /** `url(#…)` til mønsteret. */
  fill: string;
  /** Konturen rundt laget (mønsterets strekfarge). */
  stroke: string;
}

/**
 * Fyll (`url(#<id>-<type>)`) og strekfarge for et lag med mønsteret `type`. `id` må være den samme som på
 * `<LagMonstre id>` i figuren (standard `LAG_MONSTRE_ID`). Strektykkelsen på konturen: `useLagMonstre().kontur`.
 */
export function lagFyll(type: MonsterId, id: string = LAG_MONSTRE_ID): LagFyll {
  return { fill: `url(#${id}-${type})`, stroke: GEO.bergart[type].line };
}

/** Det `useLagMonstre` gir: id-en til mønstrene, fyll per type og strektykkelsen på konturen. */
export interface LagMonstreSett {
  /** Gi den til `<LagMonstre id>` og `<LagFlate monstre>`. */
  id: string;
  /** Fyll og kontur for ett lag (som `lagFyll(type, id)`). */
  fyll: (type: MonsterId) => LagFyll;
  /** Strektykkelse på konturen rundt et lag (1,3 på PC, tykkere på mobil). */
  kontur: number;
}

/**
 * Unik id for mønstrene i én figur, så flere figurer (eller flere kit-komponenter) på samme side ikke bruker hverandres
 * mønstre. Bruk den i alle gjenbrukbare komponenter; kapitler med én figur kan bruke `<LagMonstre />` og `lagFyll(type)`
 * uten id. Bare inne i en <Figure>.
 */
export function useLagMonstre(prefiks = 'lag'): LagMonstreSett {
  const id = useSvgId(prefiks);
  const stroke = useGeoStroke();
  return useMemo(() => ({ id, fyll: (type: MonsterId) => lagFyll(type, id), kontur: round(1.3 * stroke) }), [id, stroke]);
}

/** Props til `LagMonstre`. */
export interface LagMonstreProps {
  /** Id-en mønstrene får (`<id>-<type>`). Standard `LAG_MONSTRE_ID`; bruk `useLagMonstre().id` i gjenbrukbare deler. */
  id?: string;
  /** Ekstra skalering av mønsteret (1 = standard). Mindre i smale søyler (borekjerne), større i en lupe. */
  skala?: number;
  /** Bare disse mønstrene (standard alle 25). Gi en fast liste (ikke en ny liste for hver tegning). */
  bare?: readonly MonsterId[];
}

/**
 * Én `<defs>` med et mønster per bergart, sediment og løsmasse (`MonsterId`), som på geologiske kart. Tegnes én gang i
 * figuren, før lagene som bruker den. Mønsteret vokser med `useGeoScale` på mobil, strekene med `useGeoStroke`.
 * Memoisert, så den tegnes ikke på nytt for hver ramme i en animasjon.
 */
export const LagMonstre = memo(function LagMonstre({ id = LAG_MONSTRE_ID, skala = 1, bare }: LagMonstreProps) {
  const k = useGeoScale();
  const stroke = useGeoStroke();
  const s = round(k * (Number.isFinite(skala) && skala > 0 ? skala : 1));
  // Strek i mønsterets egne enheter: patternTransform skalerer strekene med s, så delt på s blir de base · stroke
  const u = stroke / s;
  return (
    <defs>
      {(bare ?? MONSTER_IDS).map((type) => {
        const spec = MONSTRE[type];
        const c = GEO.bergart[type];
        const t = `scale(${s})${spec.rotate ? ` rotate(${spec.rotate})` : ''}`;
        return (
          <pattern key={type} id={`${id}-${type}`} patternUnits="userSpaceOnUse" width={spec.w} height={spec.h} patternTransform={t}>
            <rect width={spec.w} height={spec.h} fill={c.fill} />
            {spec.draw({ fill: c.fill, line: c.line, u })}
          </pattern>
        );
      })}
    </defs>
  );
});

/** Props til `LagFlate`. Formen gis i figurens koordinater (`d` eller `points`); det finnes ikke noe eget ankerpunkt. */
export interface LagFlateProps {
  /** Formen på laget som SVG-sti (bruk `d` eller `points`). */
  d?: string;
  /** Formen som polygon: [[x, y], …]. */
  points?: readonly (readonly [number, number])[];
  type: MonsterId;
  /** Id-en fra `useLagMonstre().id` (standard `LAG_MONSTRE_ID`). */
  monstre?: string;
  /** Lys ovenfra og litt mørkere nederst (illustrert realisme). Standard på; slå av for små ruter i forklaringer. */
  lys?: boolean;
  /** Ingen kontur (f.eks. når lagene deler grense og en egen linje tegnes over). */
  utenKontur?: boolean;
  /** Ton ned laget. */
  dim?: boolean;
  children?: ReactNode;
}

/**
 * Ett lag i et snitt: formen fylt med mønsteret, kontur i mønsterets strekfarge og (standard) svak toning med lys
 * ovenfra, som i en lærebokillustrasjon. Krever `<LagMonstre id={monstre} />` i samme figur. Ankerpunkt: ingen egen
 * plassering; formen (`points` eller stien `d`) er i figurens koordinater.
 *   <LagFlate points={[[0, 200], [800, 180], [800, 260], [0, 260]]} type="sandstein" monstre={lag.id} />
 */
export function LagFlate({ d, points, type, monstre = LAG_MONSTRE_ID, lys = true, utenKontur, dim, children }: LagFlateProps) {
  const lysId = useSvgId('laglys');
  const stroke = useGeoStroke();
  const path = d ?? (points && points.length > 2 ? polyPath(points) : '');
  if (!path) return null;
  const f = lagFyll(type, monstre);
  return (
    <g opacity={dim ? 0.38 : undefined}>
      <path d={path} fill={f.fill} />
      {lys && (
        <>
          <LinearGradient
            id={lysId}
            stops={[
              [0, SCENE.highlight, 0.55],
              [0.45, SCENE.highlight, 0],
              [1, SCENE.shadow, 0.45],
            ]}
          />
          <path d={path} fill={`url(#${lysId})`} />
        </>
      )}
      {children}
      {!utenKontur && <path d={path} fill="none" stroke={f.stroke} strokeWidth={round(1.3 * stroke)} strokeLinejoin="round" />}
    </g>
  );
}

/* ---------- Mønstrene ---------- */

interface TileColors {
  fill: string;
  line: string;
  /** Én enhet strek i mønsterets egne enheter (base 1 = 1 · useGeoStroke i figuren). */
  u: number;
}

interface TileSpec {
  /** Rutens størrelse i figurens enheter (før skalering på mobil). */
  w: number;
  h: number;
  /** Drei hele mønsteret (grader), f.eks. skrå streker. */
  rotate?: number;
  draw: (c: TileColors) => ReactNode;
}

const plus = (x: number, y: number, a: number) => `M${x - a} ${y}H${x + a}M${x} ${y - a}V${y + a}`;
const kryss = (x: number, y: number, a: number) => `M${x - a} ${y - a}L${x + a} ${y + a}M${x - a} ${y + a}L${x + a} ${y - a}`;
const vee = (x: number, y: number, a: number) => `M${x - a} ${y - a * 0.75}L${x} ${y + a * 0.75}L${x + a} ${y - a * 0.75}`;
/** Bølge fra (0, y) til (w, y) med én topp og én bunn; samme helning i begge ender, så rutene henger sammen. */
const bolge = (y: number, a: number, w: number) => `M0 ${y}C${w / 6} ${y - a} ${w / 3} ${y - a} ${w / 2} ${y}S${(5 * w) / 6} ${y + a} ${w} ${y}`;
/** Den samme bølgen baklengs (fra w til 0), til å lukke et bånd. */
const bolgeTilbake = (y: number, a: number, w: number) => `L${w} ${y}C${(5 * w) / 6} ${y + a} ${(2 * w) / 3} ${y + a} ${w / 2} ${y}S${w / 6} ${y - a} 0 ${y}`;

/** Tilfeldige prikker med fast frø innenfor ruten (med marg), så mønsteret blir likt hver gang. */
function prikker(seed: number, n: number, w: number, h: number, rMin: number, rMax: number): [number, number, number][] {
  const rnd = sceneRandom(seed);
  const out: [number, number, number][] = [];
  let tries = 0;
  while (out.length < n && tries < 400) {
    tries++;
    const r = rMin + (rMax - rMin) * rnd();
    const x = r + 0.6 + (w - 2 * r - 1.2) * rnd();
    const y = r + 0.6 + (h - 2 * r - 1.2) * rnd();
    if (out.every(([px, py, pr]) => Math.hypot(px - x, py - y) > pr + r + 1.6)) out.push([round(x), round(y), round(r)]);
  }
  return out;
}

const SAND = prikker(7, 12, 26, 26, 0.6, 1.25);
const ASKE = prikker(11, 9, 14, 14, 0.55, 1);

const MORENE_STEIN = [
  'M4 12L8 6L15 8L14 13Z',
  'M26 10L31 4L35 11Z',
  'M16 28L19 21L27 22L28 29L21 31Z',
  'M36 28L39 23L42 27L40 30Z',
  'M3 31L6 27L10 30L7 34Z',
];
const MORENE_FIN: [number, number][] = [
  [3, 4],
  [20, 5],
  [38, 16],
  [14, 18],
  [31, 33],
  [42, 4],
  [9, 22],
  [23, 13],
  [33, 20],
  [19, 34],
];

const UR_BLOKKER = [
  'M2 3L15 1L18 12L8 16L1 11Z',
  'M20 2L33 4L31 14L21 13Z',
  'M36 3L46 1L47 12L37 15Z',
  'M3 19L12 18L16 30L5 33Z',
  'M19 16L32 17L35 27L24 31L18 25Z',
  'M38 18L46 17L46 30L36 29Z',
  'M8 35L20 34L22 39L9 39.5Z',
  'M27 33L40 32L42 39L28 39.5Z',
];

const MALM_FLEKKER = [
  'M5 6C7 3 11 3 12 6S9 11 6 10S3 8 5 6Z',
  'M20 16C23 13 28 14 28 18S24 23 21 21S18 18 20 16Z',
  'M26 4C28 2.5 31 3.5 30.5 6S27 8.5 26 4Z',
  'M6 21C8 19 11 20 10.5 23S6 25.5 6 21Z',
];

/** Ett mønster per type. Alle tall er i figurens enheter på PC. */
const MONSTRE: Record<MonsterId, TileSpec> = {
  // Magmatiske bergarter
  granitt: {
    w: 24,
    h: 24,
    draw: ({ line, u }) => <path d={plus(6, 6, 2.6) + plus(18, 18, 2.6)} stroke={line} strokeWidth={1.3 * u} strokeLinecap="round" />,
  },
  gabbro: {
    w: 26,
    h: 26,
    draw: ({ line, u }) => (
      <>
        <path d={kryss(6.5, 6.5, 2.6) + kryss(19.5, 19.5, 2.6)} stroke={line} strokeWidth={1.5 * u} strokeLinecap="round" />
        <ellipse cx={19.5} cy={6.5} rx={2.3} ry={1.5} transform="rotate(30 19.5 6.5)" fill={line} opacity={0.85} />
        <ellipse cx={6.5} cy={19.5} rx={2.1} ry={1.5} transform="rotate(-25 6.5 19.5)" fill={line} opacity={0.85} />
      </>
    ),
  },
  basalt: {
    w: 20,
    h: 16,
    draw: ({ line, u }) => (
      <path d={vee(5, 4.5, 2.5) + vee(15, 12.5, 2.5)} stroke={line} strokeWidth={1.3 * u} fill="none" strokeLinecap="round" strokeLinejoin="round" />
    ),
  },
  diabas: {
    w: 14,
    h: 12,
    draw: ({ line, u }) => (
      <>
        <path d={vee(3.5, 3.2, 1.9) + vee(10.5, 9.2, 1.9)} stroke={line} strokeWidth={1.2 * u} fill="none" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx={10.5} cy={3} r={0.75} fill={line} />
        <circle cx={3.5} cy={9} r={0.75} fill={line} />
      </>
    ),
  },
  // Sedimentære bergarter
  sandstein: {
    w: 16,
    h: 16,
    draw: ({ line }) => (
      <>
        <circle cx={4} cy={4} r={1.25} fill={line} />
        <circle cx={12} cy={12} r={1.25} fill={line} />
      </>
    ),
  },
  siltstein: {
    w: 24,
    h: 12,
    draw: ({ line, u }) => (
      <>
        <path d="M2 3H8M14 9H20" stroke={line} strokeWidth={1.2 * u} strokeLinecap="round" />
        <circle cx={14} cy={3} r={0.95} fill={line} />
        <circle cx={2} cy={9} r={0.95} fill={line} />
      </>
    ),
  },
  leirskifer: {
    w: 7,
    h: 7,
    rotate: -45,
    draw: ({ line, u }) => <path d="M0 3.5H7" stroke={line} strokeWidth={1.05 * u} />,
  },
  kalkstein: {
    w: 24,
    h: 14,
    draw: ({ line, u }) => <path d="M0 0.5H24M0 7.5H24M0.5 0.5V7.5M12.5 7.5V14" stroke={line} strokeWidth={1.05 * u} fill="none" />,
  },
  konglomerat: {
    w: 36,
    h: 28,
    draw: ({ fill, line, u }) => (
      <>
        {(
          [
            [8, 8, 4.2],
            [25, 6.5, 3.2],
            [18, 19.5, 5],
            [31, 21, 2.6],
            [5, 22, 2.2],
          ] as const
        ).map(([x, y, r]) => (
          <circle key={`${x}-${y}`} cx={x} cy={y} r={r} fill={tint(fill, 0.2)} stroke={line} strokeWidth={1.15 * u} />
        ))}
        {(
          [
            [14, 3.5],
            [2, 14],
            [28, 13.5],
            [11, 26],
            [33, 3],
          ] as const
        ).map(([x, y]) => (
          <circle key={`p${x}-${y}`} cx={x} cy={y} r={0.7} fill={line} />
        ))}
      </>
    ),
  },
  salt: {
    w: 8,
    h: 8,
    rotate: 45,
    draw: ({ line, u }) => <path d="M0 0.5H8M0.5 0V8" stroke={line} strokeWidth={0.95 * u} />,
  },
  kull: {
    w: 18,
    h: 6,
    draw: ({ line, u }) => <path d="M0 1.5H11M9 4.5H18M0 4.5H2" stroke={line} strokeWidth={0.85 * u} />,
  },
  // Metamorfe bergarter
  gneis: {
    w: 44,
    h: 18,
    draw: ({ line, u }) => (
      <>
        <path d={`${bolge(2.5, 1.8, 44)}${bolgeTilbake(7.5, 1.8, 44)}Z`} fill={line} fillOpacity={0.24} />
        <path d={bolge(2.5, 1.8, 44) + bolge(7.5, 1.8, 44)} stroke={line} strokeWidth={0.95 * u} fill="none" />
        <path d={bolge(13, 1.8, 44)} stroke={line} strokeWidth={0.8 * u} fill="none" strokeDasharray="9 4" />
      </>
    ),
  },
  glimmerskifer: {
    w: 30,
    h: 9,
    draw: ({ line, u }) => (
      <>
        <path d={bolge(3, 1.4, 30)} stroke={line} strokeWidth={0.9 * u} fill="none" />
        <path d="M17 7H23" stroke={line} strokeWidth={1.6 * u} strokeLinecap="round" opacity={0.75} />
      </>
    ),
  },
  marmor: {
    w: 48,
    h: 32,
    draw: ({ line, u }) => (
      <>
        <path
          d="M0 0.5H48M0 8.5H48M0 16.5H48M0 24.5H48M0.5 0.5V8.5M24.5 0.5V8.5M12.5 8.5V16.5M36.5 8.5V16.5M0.5 16.5V24.5M24.5 16.5V24.5M12.5 24.5V32M36.5 24.5V32"
          stroke={line}
          strokeWidth={0.85 * u}
          opacity={0.7}
          fill="none"
        />
        <path d="M3 29C12 24 16 26 22 19S34 12 45 4M22 19C26 21 30 22 33 27" stroke={line} strokeWidth={1.1 * u} fill="none" opacity={0.6} strokeLinecap="round" />
      </>
    ),
  },
  kvartsitt: {
    w: 8,
    h: 8,
    draw: ({ line }) => (
      <>
        <circle cx={2} cy={2} r={1.05} fill={line} />
        <circle cx={6} cy={6} r={1.05} fill={line} />
      </>
    ),
  },
  // Løsmasser
  morene: {
    w: 44,
    h: 36,
    draw: ({ fill, line, u }) => (
      <>
        {MORENE_FIN.map(([x, y]) => (
          <circle key={`${x}-${y}`} cx={x} cy={y} r={0.65} fill={line} />
        ))}
        {MORENE_STEIN.map((d) => (
          <path key={d} d={d} fill={mix(fill, line, 0.28)} stroke={line} strokeWidth={1 * u} strokeLinejoin="round" />
        ))}
      </>
    ),
  },
  breelv: {
    w: 36,
    h: 22,
    draw: ({ line, u }) => {
      const dots: [number, number][] = [];
      for (const y of [4.5, 10.5, 16.5]) {
        for (const dx of [-12, 0, 12, 24]) {
          const x = 10 + (12 * y) / 21 + dx;
          if (x > 1.2 && x < 34.8) dots.push([round(x), y]);
        }
      }
      return (
        <>
          <path d="M0 21.5H36" stroke={line} strokeWidth={1.1 * u} />
          <path d="M4 0.5L16 21.5M16 0.5L28 21.5M28 0.5L40 21.5M-8 0.5L4 21.5" stroke={line} strokeWidth={0.8 * u} opacity={0.75} />
          {dots.map(([x, y]) => (
            <circle key={`${x}-${y}`} cx={x} cy={y} r={0.95} fill={line} />
          ))}
        </>
      );
    },
  },
  leire: {
    w: 12,
    h: 6,
    draw: ({ line, u }) => <path d="M0 3H12" stroke={line} strokeWidth={0.95 * u} />,
  },
  kvikkleire: {
    w: 12,
    h: 6,
    draw: ({ line, u }) => <path d="M1 1.5H5M7 4.5H11" stroke={line} strokeWidth={1.15 * u} strokeLinecap="round" />,
  },
  // Løs silt: fine prikker og korte, tynne streker hulter til bulter (siltstein har dem i faste rader)
  silt: {
    w: 22,
    h: 14,
    draw: ({ line, u }) => (
      <>
        <path d="M1.5 3.2H5.5M12 7.4H15.5M5 11.4H8.5" stroke={line} strokeWidth={0.85 * u} strokeLinecap="round" />
        <circle cx={9} cy={2.6} r={0.62} fill={line} />
        <circle cx={18.5} cy={4} r={0.62} fill={line} />
        <circle cx={3.2} cy={8} r={0.62} fill={line} />
        <circle cx={20} cy={11} r={0.62} fill={line} />
        <circle cx={13.5} cy={12.2} r={0.62} fill={line} />
      </>
    ),
  },
  sand: {
    w: 26,
    h: 26,
    draw: ({ line }) => (
      <>
        {SAND.map(([x, y, r]) => (
          <circle key={`${x}-${y}`} cx={x} cy={y} r={r} fill={line} />
        ))}
      </>
    ),
  },
  grus: {
    w: 30,
    h: 24,
    draw: ({ fill, line, u }) => (
      <>
        {(
          [
            [6, 6, 3, 2.2, 20],
            [17, 4.5, 2.4, 1.8, -15],
            [25, 10, 3.2, 2.3, 35],
            [10, 15, 2.6, 2, -30],
            [21, 18.5, 3, 2.1, 10],
            [4, 21, 2, 1.5, 0],
          ] as const
        ).map(([x, y, rx, ry, a]) => (
          <ellipse key={`${x}-${y}`} cx={x} cy={y} rx={rx} ry={ry} transform={`rotate(${a} ${x} ${y})`} fill={tint(fill, 0.25)} stroke={line} strokeWidth={0.95 * u} />
        ))}
        <circle cx={14} cy={9.5} r={0.6} fill={line} />
        <circle cx={28} cy={21} r={0.6} fill={line} />
        <circle cx={2.5} cy={11} r={0.6} fill={line} />
      </>
    ),
  },
  torv: {
    w: 20,
    h: 16,
    draw: ({ line, u }) => (
      <path
        d="M2 7.5H8M5 7.5V3.4M5 7.5L3 4.2M5 7.5L7 4.2M12 15.5H18M15 15.5V11.4M15 15.5L13 12.2M15 15.5L17 12.2"
        stroke={line}
        strokeWidth={1.1 * u}
        strokeLinecap="round"
        fill="none"
      />
    ),
  },
  ur: {
    w: 48,
    h: 40,
    draw: ({ fill, line, u }) => (
      <>
        <rect width={48} height={40} fill={shade(fill, 0.3)} />
        {UR_BLOKKER.map((d) => (
          <path key={d} d={d} fill={tint(fill, 0.18)} stroke={line} strokeWidth={0.95 * u} strokeLinejoin="round" />
        ))}
      </>
    ),
  },
  aske: {
    w: 14,
    h: 14,
    draw: ({ line }) => (
      <>
        {ASKE.map(([x, y, r]) => (
          <circle key={`${x}-${y}`} cx={x} cy={y} r={r} fill={line} />
        ))}
      </>
    ),
  },
  malmsone: {
    w: 34,
    h: 28,
    draw: ({ line, u }) => (
      <>
        {MALM_FLEKKER.map((d) => (
          <path key={d} d={d} fill={line} stroke={shade(line, 0.25)} strokeWidth={0.6 * u} />
        ))}
        {(
          [
            [15, 5],
            [14, 25],
            [30, 25.5],
            [2, 15],
            [24, 9.5],
          ] as const
        ).map(([x, y]) => (
          <circle key={`${x}-${y}`} cx={x} cy={y} r={0.75} fill={line} />
        ))}
      </>
    ),
  },
};

function polyPath(points: readonly (readonly [number, number])[]): string {
  return `${points.map(([x, y], i) => `${i ? 'L' : 'M'}${round(x)} ${round(y)}`).join('')}Z`;
}

function round(v: number): number {
  return Number.isFinite(v) ? Math.round(v * 100) / 100 : 0;
}
