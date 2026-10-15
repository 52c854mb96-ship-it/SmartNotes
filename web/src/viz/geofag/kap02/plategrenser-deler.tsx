/**
 * Diagrammene under blokka i «Platene beveger seg» (k2-plategrenser), ett per type:
 * - `HavProfil`: havdypet bort fra ryggen (spredning), med alder, de magnetiske stripene og utsnittet i blokka.
 * - `SubduksjonSnitt`: plata i en subduksjonssone i målestokk, med jordskjelvene etter dyp og vulkanene over.
 * - `KollisjonSnitt`: skorpa som blir tykkere ved en kollisjon, med fjellkjeden og fjellroten (isostasi).
 * - `VulkankjedeDiagram`: alderen på vulkanene over et varmt punkt mot avstanden.
 * - `SmelteDiagram`: temperatur og smeltepunkt mot dypet («Hvor smelter det?»).
 * Bare til denne visualiseringen (lokale deler, ikke i kit-et).
 */
import { useMemo, type CSSProperties, type ReactNode } from 'react';
import {
  GEO,
  LagFlate,
  LagMonstre,
  LogPlot,
  Txt,
  VIZ,
  fmt,
  fmtAlder,
  fmtTall,
  linePath,
  magnetiskeStriper,
  sample,
  tekstBredde,
  useGeoScale,
  useGeoStroke,
  useLagMonstre,
  useSvgId,
  useTextScale,
  type MonsterId,
  type PlategrenseType,
  type SubduksjonVariant,
} from '../kit';
import { Callout, ForceArrow, Himmel, LinearGradient, SCENE, ValueTag, Vann, alpha, mix } from '../../kit/scene';
import {
  GROP_DYP,
  SMELTING,
  SKORPE_NORMAL,
  VULKAN_PLATEDYP,
  adiabat,
  avstandVedDyp,
  geoterm,
  havdybdeVed,
  platePunktVed,
  plateProfil,
  skjelvKatalog,
  smeltesone,
  smeltestart,
  solidus,
  type Fjellkjede,
} from './model-plategrenser';

const r2 = (v: number): number => Math.round(v * 100) / 100;
type P = [number, number];

/** Sti gjennom punktene (åpen eller lukket). */
function sti(p: readonly P[], lukket = false): string {
  if (p.length === 0) return '';
  return p.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${r2(x)},${r2(y)}`).join('') + (lukket ? 'Z' : '');
}

/** Femtakket stjerne (jordskjelv), som i kit-ets blokkdiagram. */
function stjerneSti(x: number, y: number, r: number): string {
  const p: P[] = [];
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const rr = i % 2 === 0 ? r : r * 0.45;
    p.push([x + rr * Math.cos(a), y + rr * Math.sin(a)]);
  }
  return sti(p, true);
}

/** Jordskjelv som små stjerner (samme stil som i blokka). */
export function SkjelvStjerne({ x, y, r, nytt }: { x: number; y: number; r: number; nytt?: boolean }) {
  const s = useGeoStroke();
  return (
    <path
      d={stjerneSti(x, y, r)}
      fill={nytt ? GEO.fare[3] : GEO.fare[1]}
      stroke={VIZ.ink}
      strokeWidth={0.8 * s}
      strokeLinejoin="round"
    />
  );
}

/** Ett punkt i `Fargeforklaring`: en strek (standard), en flate med kant (som stripene) eller en stjerne (jordskjelv). */
export interface ForklaringPunkt {
  color: string;
  label: ReactNode;
  form?: 'linje' | 'flate' | 'stjerne';
  dashed?: boolean;
}

/**
 * Fargeforklaring under en figur, som kit-ets `Legend`, men med flater med kant (så en mørk stripe synes i mørkt tema)
 * og stjerner for jordskjelv.
 */
export function Fargeforklaring({ items }: { items: readonly ForklaringPunkt[] }) {
  return (
    <ul className="viz-legend" role="list">
      {items.map((it, i) => (
        <li key={i}>
          {it.form === 'flate' ? (
            <span
              aria-hidden
              style={{ display: 'inline-block', width: 18, height: 12, borderRadius: 3, background: it.color, border: `1px solid ${VIZ.muted}` }}
            />
          ) : it.form === 'stjerne' ? (
            <svg aria-hidden width={18} height={18} viewBox="-9 -9 18 18" style={{ overflow: 'visible' }}>
              <path d={stjerneSti(0, 0.6, 7.5)} fill={it.color} stroke={VIZ.ink} strokeWidth={0.9} strokeLinejoin="round" />
            </svg>
          ) : (
            <span className={`viz-legend-swatch${it.dashed ? ' is-dashed' : ''}`} style={{ '--c': it.color } as CSSProperties} aria-hidden />
          )}
          {it.label}
        </li>
      ))}
    </ul>
  );
}

/** Margene til et plott med tittel på begge akser (samme regler som LogPlot), så snittene kan tegnes i målestokk. */
function plottMarg(f: number, yTall: string, topp = 20) {
  const tickPx = 15 * f;
  const titlePx = 15.6 * f;
  return {
    top: topp * f,
    bottom: 22 * f + 10 + titlePx * 1.1,
    left: titlePx * 1.25 + 14 + tekstBredde(yTall, tickPx) + 10,
    right: 24 * f,
  };
}

/* =====================================================================================================================
 * Havdypet bort fra ryggen
 * ================================================================================================================== */

const PROFIL_KM = 1000;
const PROFIL_DYP = 7000;
/** Halve bredden på blokka over (km): `PLATE_BREDDE_KM.spredning` / 2. */
const BLOKK_HALV_KM = 200;
/** Aldrene som merkes på profilen, de viktigste først (millioner år). */
const ALDRE_MERKER = [10, 50, 100, 20, 150, 5, 30, 75, 2] as const;
const HAVPROFIL_MONSTRE: readonly MonsterId[] = ['basalt'];

/**
 * Havdypet mot avstanden fra ryggen for en spredningsfart (cm/år, begge platene til sammen): vannet over, havbunnen
 * av basalt under, alderen på havbunnen som merker, de magnetiske stripene ved tiden `t` (som i blokka) og utsnittet
 * blokka viser. Rask spredning gir et bredt, slakt profil; langsom et smalt og bratt, fordi dypet bare avhenger av
 * alderen.
 */
export function HavProfil({ fart, t, height }: { fart: number; t: number; height: number }) {
  const f = useTextScale();
  const k = useGeoScale();
  const s = useGeoStroke();
  const monstre = useLagMonstre('havprofil');
  const halv = fart / 2;
  const striper = useMemo(() => magnetiskeStriper(fart, t), [fart, t]);
  const dyp = (x: number): number => havdybdeVed(x, halv) ?? PROFIL_DYP;
  return (
    <LogPlot
      x={{ min: -PROFIL_KM, max: PROFIL_KM, label: 'Avstand fra ryggen (km)', ticks: [-1000, -500, 0, 500, 1000], format: (v) => fmtTall(Math.abs(v)) }}
      y={{ min: 0, max: PROFIL_DYP, reverse: true, label: 'Dyp (m)', ticks: [0, 2000, 4000, 6000], format: (v) => fmtTall(v) }}
      width={800}
      height={height}
      margin={{ top: 30 * f }}
      grid={false}
    >
      {({ sx, sy, x0, x1, y0, y1 }) => {
        const bunn = sample(dyp, -PROFIL_KM, PROFIL_KM, 241);
        const bunnPx: P[] = bunn.map(([x, d]) => [sx(x), sy(d)]);
        const skorpe: P[] = [...bunnPx, [x1, y0], [x0, y0]];
        const bandH = 8 * k;
        // Merker for alderen på høyre side: de viktigste først, uten at tekstene overlapper
        const fs = 17 * 0.72 * f;
        const valgt: { x: number; y: number; tekst: string; a: number; v: number; h: number }[] = [];
        for (const a of ALDRE_MERKER) {
          const km = a * halv * 10;
          if (km > PROFIL_KM * 0.96) continue;
          const px = sx(km);
          const tekst = fmtAlder(a, { kort: true });
          const b = tekstBredde(tekst, fs);
          const v = px - b / 2 - 4;
          const h = px + b / 2 + 4;
          if (v < sx(0) + 6 || h > x1) continue;
          if (valgt.some((m) => v < m.h && h > m.v)) continue;
          valgt.push({ x: px, y: sy(dyp(km)), tekst, a, v, h });
        }
        const merker = valgt.sort((p, q) => p.x - q.x);
        const bx0 = sx(-BLOKK_HALV_KM);
        const bx1 = sx(BLOKK_HALV_KM);
        return (
          <g>
            <LagMonstre id={monstre.id} bare={HAVPROFIL_MONSTRE} />
            <Vann x={x0} y={y1} w={x1 - x0} h={y0 - y1} />
            <LagFlate points={skorpe} type="basalt" monstre={monstre.id} />
            {/* De magnetiske stripene fra de siste 5 millioner årene, speilet om ryggen */}
            {striper.map((st, i) =>
              [1, -1].map((side) => {
                const a = side * st.fra;
                const b = side * st.til;
                const lo = Math.min(a, b);
                const hi = Math.max(a, b);
                const n = Math.max(2, Math.ceil(((hi - lo) / PROFIL_KM) * 60));
                const topp: P[] = sample(dyp, lo, hi, n).map(([x, d]) => [sx(x), sy(d)]);
                const pol: P[] = [...topp, ...topp.slice().reverse().map(([x, y]): P => [x, y + bandH])];
                return (
                  <path
                    key={`${i}-${side}`}
                    d={sti(pol, true)}
                    fill={st.normal ? GEO.polaritet.normal : GEO.polaritet.omvendt}
                    stroke={GEO.skorpeHav.line}
                    strokeWidth={0.5 * s}
                  />
                );
              }),
            )}
            <path d={sti(bunnPx)} fill="none" stroke={GEO.skorpeHav.line} strokeWidth={1.8 * s} />
            {/* Utsnittet i blokka over */}
            <rect x={bx0} y={y1} width={bx1 - bx0} height={y0 - y1} fill={alpha(SCENE.highlight, 0.16)} />
            <path d={`M${r2(bx0)},${r2(y1)}V${r2(y0)}M${r2(bx1)},${r2(y1)}V${r2(y0)}`} stroke={VIZ.muted} strokeWidth={1.2 * s} strokeDasharray={`${r2(5 * s)} ${r2(4 * s)}`} />
            <Txt x={(bx0 + bx1) / 2} y={y1 - 9 * f} size={0.72} weight={600}>
              Utsnittet i blokka
            </Txt>
            {merker.map((m) => (
              <g key={m.tekst}>
                <circle cx={m.x} cy={m.y} r={3.6 * k} fill={VIZ.ink} stroke={VIZ.surface} strokeWidth={1.4 * s} />
                <Txt x={m.x} y={m.y - 9 * k} size={0.72} weight={600}>
                  {m.tekst}
                </Txt>
              </g>
            ))}
          </g>
        );
      }}
    </LogPlot>
  );
}

/** Høyden HavProfil trenger (viewBox), høyere på mobil. */
export const havProfilHoyde = (f: number): number => Math.round(300 + 230 * (f - 1));

/* =====================================================================================================================
 * Subduksjon i målestokk
 * ================================================================================================================== */

const SNITT_X: readonly [number, number] = [-150, 1350];
const SNITT_Z = 750;
const PLATE_TYKK = 90;
const HAVSKORPE = 7;
const SUBDUKSJON_MONSTRE: readonly MonsterId[] = ['basalt'];

/**
 * Hvor mye dypet er overdrevet i `SubduksjonSnitt`: 1 (i målestokk) på PC, opptil 1,6 på mobil, der figuren ellers
 * blir for lav til å lese.
 */
export function subduksjonOverdrivelse(f: number): number {
  return Math.round(Math.min(1.6, Math.max(1, 1 + 0.75 * (f - 1))) * 10) / 10;
}

/** Viewbox-høyden til `SubduksjonSnitt` (i målestokk på PC, 1 km vannrett = 1 km loddrett). */
export function subduksjonHoyde(f: number): number {
  const m = plottMarg(f, '700', 34);
  const plotW = 800 - m.left - m.right;
  return Math.round((plotW * SNITT_Z * subduksjonOverdrivelse(f)) / (SNITT_X[1] - SNITT_X[0]) + m.top + m.bottom);
}

/** Forskyver en kurve en avstand `d` langs normalen (inn i plata: nedover og bakover). */
function forskjov(p: readonly P[], d: number): P[] {
  return p.map((q, i) => {
    const a = p[Math.max(0, i - 1)]!;
    const b = p[Math.min(p.length - 1, i + 1)]!;
    const tx = b[0] - a[0];
    const ty = b[1] - a[1];
    const n = Math.hypot(tx, ty) || 1;
    return [q[0] - (ty / n) * d, q[1] + (tx / n) * d];
  });
}

/**
 * Snitt gjennom en subduksjonssone i målestokk: havbunnsplata som går ned under et kontinent (eller en øybue),
 * jordskjelvene i plata etter dyp (grunne, middels dype og dype), grensen mot den nedre mantelen ved 660 km, vulkanene
 * over der plata er ca. 100 km dyp, og et merke for havbunnen som var i havgropa da avspillingen startet (`s` km
 * langs plata). `andel` (0–1) er hvor langt avspillingen er kommet: skjelvene kommer til etter hvert.
 */
export function SubduksjonSnitt({ variant, s, andel, height }: { variant: SubduksjonVariant; s: number; andel: number; height: number }) {
  const f = useTextScale();
  const k = useGeoScale();
  const st = useGeoStroke();
  const monstre = useLagMonstre('subduksjon');
  const profil = useMemo(() => plateProfil(variant), [variant]);
  const katalog = useMemo(() => skjelvKatalog(variant), [variant]);
  const xv = avstandVedDyp(variant, VULKAN_PLATEDYP) ?? 250;
  const kont = variant === 'hav-kontinent';
  const merke = platePunktVed(variant, s);
  const m = plottMarg(f, '700', 34);
  return (
    <LogPlot
      x={{ min: SNITT_X[0], max: SNITT_X[1], label: 'Avstand fra havgropa (km)', ticks: [0, 300, 600, 900, 1200] }}
      y={{ min: 0, max: SNITT_Z, reverse: true, label: 'Dyp (km)', ticks: [0, 100, 200, 300, 400, 500, 600, 700] }}
      width={800}
      height={height}
      margin={m}
      grid={false}
    >
      {({ sx, sy, x0, x1, y0, y1, clip }) => {
        const topp: P[] = profil.map((p) => [p.x, p.z]);
        const havbunn: P[] = [
          [SNITT_X[0], GROP_DYP - 3],
          [-30, GROP_DYP - 2],
        ];
        const ovre: P[] = [...havbunn, ...topp];
        const under = forskjov(ovre, PLATE_TYKK);
        const skorpeUnder = forskjov(ovre, HAVSKORPE);
        const px = (p: readonly P[]): P[] => p.map(([x, z]) => [sx(x), sy(z)]);
        const plate = [...px(ovre), ...px(under).reverse()];
        const havskorpe = [...px(ovre), ...px(skorpeUnder).reverse()];
        // Overplata: skorpe (kontinent eller øybue) og stiv mantel ned til litosfærens underside, over plata
        const slabZ = (x: number): number => {
          if (x <= 0) return Infinity;
          for (let i = 1; i < profil.length; i++) if (profil[i]!.x >= x) return profil[i]!.z;
          return Infinity;
        };
        const moho = kont ? SKORPE_NORMAL : 15;
        const lito = kont ? 90 : 60;
        const xs = sample(() => 0, 0, SNITT_X[1], 120).map(([x]) => x);
        const overskorpe: P[] = [...xs.map((x): P => [sx(x), sy(0)]), ...xs.slice().reverse().map((x): P => [sx(x), sy(Math.min(moho, slabZ(x)))])];
        const overlito: P[] = [
          ...xs.map((x): P => [sx(x), sy(Math.min(moho, slabZ(x)))]),
          ...xs.slice().reverse().map((x): P => [sx(x), sy(Math.min(lito, slabZ(x)))]),
        ];
        const synlige = katalog.filter((q) => q.tid <= andel + 1e-9);
        const nyeste = andel > 0 && andel < 1 ? andel - 0.04 : 2;
        const vx = sx(xv);
        const yOver = y1;
        const tri = 12 * k;
        return (
          <g>
            <LagMonstre id={monstre.id} bare={SUBDUKSJON_MONSTRE} />
            <rect x={x0} y={y1} width={x1 - x0} height={y0 - y1} fill={GEO.astenosfare.fill} />
            <rect x={x0} y={sy(660)} width={x1 - x0} height={y0 - sy(660)} fill={GEO.nedreMantel.fill} opacity={0.55} />
            <line x1={x0} x2={x1} y1={sy(660)} y2={sy(660)} stroke={GEO.nedreMantel.line} strokeWidth={1.4 * st} />
            <g clipPath={clip}>
              <path d={sti(plate, true)} fill={GEO.litosfare.fill} stroke={GEO.litosfare.line} strokeWidth={1.2 * st} />
              <LagFlate points={havskorpe} type="basalt" monstre={monstre.id} lys={false} />
              {kont ? (
                <path d={sti(overskorpe, true)} fill={GEO.skorpeKontinent.fill} stroke={GEO.skorpeKontinent.line} strokeWidth={1.1 * st} />
              ) : (
                <LagFlate points={overskorpe} type="basalt" monstre={monstre.id} lys={false} />
              )}
              <path d={sti(overlito, true)} fill={GEO.litosfare.fill} stroke={GEO.litosfare.line} strokeWidth={1.1 * st} />
              {/* Smelting i mantelkilen over plata der den slipper vann */}
              <ellipse cx={sx(xv + 10)} cy={sy(VULKAN_PLATEDYP - 22)} rx={22 * k} ry={10 * k} fill={alpha(GEO.magma.fill, 0.45)} stroke={GEO.magma.line} strokeWidth={1 * st} strokeDasharray={`${r2(3 * st)} ${r2(2.5 * st)}`} />
              <line x1={vx} x2={vx} y1={sy(0)} y2={sy(VULKAN_PLATEDYP)} stroke={GEO.magma.line} strokeWidth={1.3 * st} strokeDasharray={`${r2(4 * st)} ${r2(3 * st)}`} />
              {/* Dybdeklassene for jordskjelv: grunne, middels dype og dype */}
              {[70, 300].map((z) => (
                <line key={z} x1={x0} x2={x1} y1={sy(z)} y2={sy(z)} stroke={VIZ.ink} strokeWidth={1.1 * st} strokeDasharray={`${r2(6 * st)} ${r2(5 * st)}`} opacity={0.55} />
              ))}
              {synlige.map((q, i) => (
                <SkjelvStjerne key={i} x={sx(q.x)} y={sy(q.z)} r={(3.2 + 2.2 * q.styrke) * k * (q.tid > nyeste ? 1.35 : 1)} nytt={q.tid > nyeste} />
              ))}
            </g>
            {/* Vulkanen på overflaten */}
            <path
              d={`M${r2(vx - tri)},${r2(yOver)}L${r2(vx - tri * 0.18)},${r2(yOver - tri * 1.05)}L${r2(vx + tri * 0.18)},${r2(yOver - tri * 1.05)}L${r2(vx + tri)},${r2(yOver)}Z`}
              fill={mix(GEO.aske.fill, SCENE.stoneDark, 0.4)}
              stroke={SCENE.outline}
              strokeWidth={1 * st}
            />
            <Txt x={vx + tri + 6} y={yOver - 6 * k} anchor="start" size={0.72} weight={600}>
              {`Vulkaner der plata er ca. ${VULKAN_PLATEDYP} km dyp`}
            </Txt>
            <Txt x={sx(0)} y={yOver - 6 * k} size={0.72} weight={600}>
              Havgrop
            </Txt>
            {/* Dybdeklassene til høyre */}
            {(
              [
                [35, 'grunne'],
                [185, 'middels dype'],
                [480, 'dype'],
              ] as const
            ).map(([z, tekst]) => (
              <Txt key={tekst} x={x1 - 8} y={sy(z) + 5} anchor="end" size={0.7} weight={600} muted>
                {tekst}
              </Txt>
            ))}
            <Txt x={x1 - 8} y={sy(660) + 17 * f} anchor="end" size={0.66} muted>
              nedre mantel
            </Txt>
            {merke && (
              <g>
                <circle cx={sx(merke.x)} cy={sy(merke.z)} r={6 * k} fill={VIZ.velocity} stroke={VIZ.surface} strokeWidth={2 * st} />
                <ValueTag
                  x={sx(merke.x) + 12 * k}
                  y={sy(merke.z) + 20 * f}
                  anchor="start"
                  text={merke.z >= 699 ? 'nådd 700 km' : `${fmt(Math.round(merke.z / 5) * 5, 0)} km dyp`}
                  color={VIZ.velocity}
                  size={0.7}
                />
              </g>
            )}
          </g>
        );
      }}
    </LogPlot>
  );
}

/* =====================================================================================================================
 * Kollisjon: fjellkjeden og fjellroten
 * ================================================================================================================== */

const KOLL_X = 800;
const KOLL_Z: readonly [number, number] = [-10, 75];

/** Viewbox-høyden til `KollisjonSnitt`, høyere på mobil. */
export const kollisjonHoyde = (f: number): number => Math.round(440 + 250 * (f - 1));

/** Formen på fjellkjeden: 1 i midten, et flatt platå når den er bred, og myke kanter (avstand x km, bredde b km). */
function fjellForm(x: number, b: number): number {
  const halv = Math.max(60, b / 2);
  const kant = Math.min(160, 0.45 * halv);
  const a = Math.abs(x);
  if (a <= halv - kant) return 1;
  if (a >= halv + kant) return 0;
  const u = (a - (halv - kant)) / (2 * kant);
  return 0.5 * (1 + Math.cos(Math.PI * u));
}

/** Toppene rundt middelhøyden: et fast mønster av tinder og daler (andel av middelhøyden, ca. ±40 %). */
function tinder(x: number): number {
  return 0.3 * Math.sin(x / 31 + 0.6) + 0.15 * Math.sin(x / 13.7 + 1.9) + 0.07 * Math.sin(x / 5.3 + 0.3);
}

/** Kontinentalskorpe med små kryss, som i blokka over (to kontinenter med litt ulik farge). */
function SkorpeKryss({ id, fill }: { id: string; fill: string }) {
  const k = useGeoScale();
  const s = useGeoStroke();
  const u = (1.1 * s) / k;
  return (
    <defs>
      <pattern id={id} patternUnits="userSpaceOnUse" width={26} height={20} patternTransform={`scale(${r2(k)})`}>
        <rect width={26} height={20} fill={fill} />
        <path d="M4 5h5M6.5 2.5v5M17 14h5M19.5 11.5v5" stroke={GEO.skorpeKontinent.line} strokeWidth={u} strokeLinecap="round" opacity={0.5} />
      </pattern>
    </defs>
  );
}

/**
 * Snitt gjennom to kontinenter som kolliderer (høyden overdrevet): skorpa presses sammen og blir tykkere, og som et
 * isfjell flyter den tykke skorpa høyere: fjellkjeden over og en mye større fjellrot under (isostasi). Tallene kommer
 * fra `fjellkjede`.
 */
export function KollisjonSnitt({ kjede, fart, height }: { kjede: Fjellkjede; fart: number; height: number }) {
  const f = useTextScale();
  const k = useGeoScale();
  const st = useGeoStroke();
  const idV = useSvgId('kollisjon-v');
  const idH = useSvgId('kollisjon-h');
  const lysId = useSvgId('kollisjon-lys');
  const E = kjede.hoyde / 1000;
  const R = kjede.rot;
  const b = kjede.bredde;
  const topper = (x: number): number => {
    const g = fjellForm(x, b);
    return g <= 0 ? 0 : E * g * (1 + tinder(x) * Math.min(1, g * 1.4));
  };
  const kontB = mix(GEO.skorpeKontinent.fill, GEO.bergart.gneis.fill, 0.45);
  return (
    <LogPlot
      x={{ min: -KOLL_X, max: KOLL_X, label: 'Avstand fra suturen (km)', ticks: [-800, -400, 0, 400, 800], format: (v) => fmtTall(Math.abs(v)) }}
      y={{ min: KOLL_Z[0], max: KOLL_Z[1], reverse: true, label: 'Dyp (km)', ticks: [0, 35, 70] }}
      width={800}
      height={height}
      margin={{ top: 34 * f }}
      grid={false}
    >
      {({ sx, sy, x0, x1, y0, y1, clip }) => {
        const xs = sample(() => 0, -KOLL_X, KOLL_X, 401).map(([x]) => x);
        const overflate: P[] = xs.map((x) => [sx(x), sy(-topper(x))]);
        const mohoZ = (x: number): number => SKORPE_NORMAL + R * fjellForm(x, b);
        const moho: P[] = xs.map((x) => [sx(x), sy(mohoZ(x))]);
        const skorpe: P[] = [...overflate, ...moho.slice().reverse()];
        // Suturen heller mot høyre: det venstre kontinentet skyves inn under det høyre
        const suturTopp: P = [sx(0), sy(-topper(0))];
        const suturBunn: P = [sx(70), sy(mohoZ(70))];
        const hoyreDel: P[] = [suturTopp, ...overflate.filter(([px]) => px > suturTopp[0]), ...moho.filter(([px]) => px > suturBunn[0]).reverse(), suturBunn];
        const mantel: P[] = [...moho, [x1, y0], [x0, y0]];
        const iTopp = xs.reduce((best, x) => (topper(x) > topper(best) ? x : best), 0);
        const sno = 1.08 * E;
        const rotY = sy(SKORPE_NORMAL + R);
        const pilL = Math.min(0.2 * (x1 - x0), 14 * fart * k);
        const pilX = sx(-300);
        const pilY = sy(SKORPE_NORMAL * 0.3);
        return (
          <g>
            <SkorpeKryss id={idV} fill={GEO.skorpeKontinent.fill} />
            <SkorpeKryss id={idH} fill={kontB} />
            <LinearGradient
              id={lysId}
              userSpace
              x1={0}
              y1={sy(-E * 1.3)}
              x2={0}
              y2={sy(SKORPE_NORMAL + R)}
              stops={[
                [0, SCENE.highlight, 0.4],
                [0.5, SCENE.highlight, 0],
                [1, SCENE.shadow, 0.3],
              ]}
            />
            <Himmel x={x0} y={y1} w={x1 - x0} h={sy(0) - y1} />
            <g clipPath={clip}>
              <path d={sti(mantel, true)} fill={GEO.litosfare.fill} stroke={GEO.litosfare.line} strokeWidth={1.2 * st} />
              <path d={sti(skorpe, true)} fill={`url(#${idV})`} />
              <path d={sti(hoyreDel, true)} fill={`url(#${idH})`} />
              <path d={sti(skorpe, true)} fill={`url(#${lysId})`} />
              {/* Fjell og snø på de høyeste toppene */}
              {E > 0.2 && (
                <path
                  d={sti([...overflate.filter(([, y]) => y < sy(0)), ...overflate.filter(([, y]) => y < sy(0)).reverse().map(([x]): P => [x, sy(0)])], true)}
                  fill={mix(SCENE.stone, GEO.skorpeKontinent.fill, 0.35)}
                />
              )}
              {E > 2 && (
                <path
                  d={sti([...overflate.map(([x, y]): P => [x, Math.min(y, sy(-sno))]), [x1, sy(-sno)], [x0, sy(-sno)]], true)}
                  fill={SCENE.snow}
                />
              )}
              <path d={sti(skorpe, true)} fill="none" stroke={GEO.skorpeKontinent.line} strokeWidth={1.3 * st} />
              <path d={sti(overflate)} fill="none" stroke={mix(GEO.skorpeKontinent.line, VIZ.ink, 0.35)} strokeWidth={1.5 * st} />
              {/* Suturen: der de to kontinentene møtes */}
              <path
                d={`M${r2(suturTopp[0])},${r2(suturTopp[1])}L${r2(suturBunn[0])},${r2(suturBunn[1])}`}
                stroke={mix(GEO.skorpeKontinent.line, VIZ.ink, 0.55)}
                strokeWidth={2.2 * st}
                strokeDasharray={`${r2(7 * st)} ${r2(4 * st)}`}
              />
            </g>
            <line x1={x0} x2={x1} y1={sy(0)} y2={sy(0)} stroke={VIZ.muted} strokeWidth={1 * st} strokeDasharray={`${r2(3 * st)} ${r2(4 * st)}`} />
            <Txt x={x0 + 6} y={sy(0) - 6} anchor="start" size={0.66} muted>
              havnivå
            </Txt>
            <Txt x={x0 + 10} y={sy(SKORPE_NORMAL * 0.72) + 5} anchor="start" size={0.72} weight={620}>
              Kontinentalskorpe
            </Txt>
            <Txt x={sx(-KOLL_X * 0.72)} y={sy(SKORPE_NORMAL) + 18 * f} size={0.7} weight={600}>
              Moho
            </Txt>
            <Txt x={sx(KOLL_X * 0.97)} y={sy(KOLL_Z[1]) - 8} anchor="end" size={0.7} weight={600}>
              Mantel (litosfære)
            </Txt>
            {E > 0.3 && <ValueTag x={sx(iTopp)} y={sy(-topper(iTopp)) - 16 * f} text={`middelhøyde ${fmtTall(Math.round(kjede.hoyde / 100) * 100)} m`} size={0.7} pointer={6} />}
            {R > 3 && (
              <Callout x={sx(-b / 5)} y={rotY - 2 * st} lx={sx(-b / 5) - 40 * k} ly={Math.min(y0 - 6, rotY + 22 * f)} anchor="end" size={0.72}>
                {`Fjellrot ${fmt(R, 0)} km`}
              </Callout>
            )}
            {fart > 0 && (
              <ForceArrow
                x1={pilX - pilL / 2}
                y1={pilY + 10 * f}
                x2={pilX + pilL / 2}
                y2={pilY + 10 * f}
                color={VIZ.velocity}
                width={5}
                label={`${fmt(fart, fart % 1 ? 1 : 0)} cm/år`}
                labelX={pilX}
                labelY={pilY - 2 * f}
                labelAnchor="middle"
                labelSize={0.68}
              />
            )}
          </g>
        );
      }}
    </LogPlot>
  );
}

/* =====================================================================================================================
 * Varmt punkt: alderen på vulkanene
 * ================================================================================================================== */

const KJEDE_KM = 1000;
const KJEDE_ALDER = 40;
/** Avstanden mellom vulkanene i blokka (km): 0,21 av bredden på 1200 km, som i kit-ets `Plategrense`. */
export const KJEDE_AVSTAND = 252;

/** Viewbox-høyden til `VulkankjedeDiagram`, høyere på mobil. */
export const kjedeHoyde = (f: number): number => Math.round(280 + 230 * (f - 1));

/**
 * Alderen på vulkanene mot avstanden fra det varme punktet: alle ligger på en rett linje, alder = avstand / fart.
 * Punktene er vulkanene i blokka over ved tiden `t`.
 */
export function VulkankjedeDiagram({ fart, t, height }: { fart: number; t: number; height: number }) {
  const f = useTextScale();
  const smal = f > 1.35;
  const k = useGeoScale();
  const st = useGeoStroke();
  const kmPerMa = fart * 10;
  const punkter: { x: number; alder: number }[] = [];
  if (kmPerMa > 0) {
    const forst = (t * kmPerMa) % KJEDE_AVSTAND;
    for (let x = forst; x <= KJEDE_KM; x += KJEDE_AVSTAND) punkter.push({ x, alder: x / kmPerMa });
  }
  return (
    <LogPlot
      x={{ min: 0, max: KJEDE_KM, label: 'Avstand fra det varme punktet (km)', format: (v) => fmtTall(v) }}
      y={{ min: 0, max: KJEDE_ALDER, label: 'Alder (millioner år)' }}
      width={800}
      height={height}
      clip
    >
      {({ sx, sy }) => {
        const linje = kmPerMa > 0 ? sample((x) => x / kmPerMa, 0, KJEDE_KM, 2) : [];
        return (
          <g>
            {linje.length > 0 && <path d={linePath(linje, sx, sy)} fill="none" stroke={VIZ.series[0]} strokeWidth={3 * st} />}
            {punkter
              .filter((p) => p.alder <= KJEDE_ALDER)
              .map((p, i) => (
                <g key={i}>
                  <path
                    d={`M${r2(sx(p.x) - 9 * k)},${r2(sy(p.alder) + 5 * k)}L${r2(sx(p.x))},${r2(sy(p.alder) - 9 * k)}L${r2(sx(p.x) + 9 * k)},${r2(sy(p.alder) + 5 * k)}Z`}
                    fill={i === 0 ? GEO.magma.fill : mix(GEO.bergart.basalt.fill, SCENE.grass, 0.3)}
                    stroke={VIZ.ink}
                    strokeWidth={1 * st}
                  />
                  {(!smal || i === 0) && (
                    <Txt x={sx(p.x) + (i === 0 ? 14 : 10) * k} y={i === 0 ? sy(p.alder) - 10 * k : sy(p.alder) + 20 * f} anchor="start" size={0.7} weight={600} muted={i > 0}>
                      {i === 0 ? 'aktiv' : fmtAlder(p.alder, { kort: true, desimaler: p.alder < 10 ? 1 : 0, enhet: 'millioner' })}
                    </Txt>
                  )}
                </g>
              ))}
          </g>
        );
      }}
    </LogPlot>
  );
}

/* =====================================================================================================================
 * Hvor smelter det? Temperatur og smeltepunkt mot dypet
 * ================================================================================================================== */

const SMELTE_Z = 200;
const SMELTE_T = 1800;

/** Viewbox-høyden til `SmelteDiagram`, høyere på mobil. */
export const smelteHoyde = (f: number): number => Math.round(340 + 260 * (f - 1));

/** Fargene i smeltediagrammet (til forklaringen under). */
export const SMELTE_FARGER = {
  torr: GEO.magma.line,
  vaat: GEO.grunnvann.line,
  temperatur: VIZ.ink,
  smelte: GEO.magma.fill,
} as const;

/**
 * Temperaturen i mantelen og smeltepunktet (solidus) mot dypet under en type plategrense. Der temperaturen er
 * høyere enn smeltepunktet, smelter mantelen delvis (rødt felt). Under ryggen og et varmt punkt stiger mantelen, og
 * den krysser smeltepunktet fordi trykket faller; i en subduksjonssone gjør vann fra plata at smeltepunktet synker
 * under temperaturen i mantelkilen.
 */
export function SmelteDiagram({ type, height }: { type: PlategrenseType; height: number }) {
  const f = useTextScale();
  const k = useGeoScale();
  const st = useGeoStroke();
  const o = SMELTING[type];
  const sone = smeltesone(o, SMELTE_Z);
  const start = o.stiger ? smeltestart(o.tp, false, SMELTE_Z) : null;
  const zs = sample(() => 0, 0, SMELTE_Z, 161).map(([z]) => z);
  return (
    <LogPlot
      x={{ min: 0, max: SMELTE_T, label: 'Temperatur (°C)', ticks: [0, 400, 800, 1200, 1600], format: (v) => fmtTall(v) }}
      y={{ min: 0, max: SMELTE_Z, reverse: true, label: 'Dyp (km)', ticks: [0, 50, 100, 150, 200] }}
      width={800}
      height={height}
      clip
    >
      {({ sx, sy, x0, x1, y1, clip }) => {
        const kurve = (fn: (z: number) => number | null): P[] =>
          zs.flatMap((z): P[] => {
            const T = fn(z);
            return T === null ? [] : [[sx(T), sy(z)]];
          });
        const torr = kurve((z) => solidus(z));
        const vaat = kurve((z) => solidus(z, true));
        const temp = kurve((z) => geoterm(z, o.litosfaere, o.tp));
        const normal = type === 'varmt-punkt' ? kurve((z) => geoterm(z, o.litosfaere)) : [];
        let felt: P[] = [];
        if (sone) {
          const zz = sample(() => 0, sone.fra, sone.til, 60).map(([z]) => z);
          const venstre = zz.map((z): P => [sx(solidus(z, o.vann) ?? 0), sy(z)]);
          const hoyre = zz.map((z): P => [sx(geoterm(z, o.litosfaere, o.tp) ?? 0), sy(z)]);
          felt = [...venstre, ...hoyre.reverse()];
        }
        const pilZ0 = 190;
        const pilZ1 = Math.max(130, (start ?? 120) + 25);
        const pilDx = -26 * k;
        const tekstX = x0 + 10;
        const vannZ = 118;
        const tTorr = solidus(vannZ) ?? 0;
        const tVaat = solidus(vannZ, true) ?? 0;
        return (
          <g>
            {/* Den kalde, stive litosfæren øverst */}
            <rect x={x0} y={y1} width={x1 - x0} height={sy(o.litosfaere) - y1} fill={alpha(GEO.litosfare.fill, 0.55)} />
            {o.litosfaere >= 25 && (
              <Txt x={x0 + 8} y={sy(o.litosfaere) - 7} anchor="start" size={0.68} weight={600} muted>
                Litosfære (kald og stiv)
              </Txt>
            )}
            {o.vann && (
              <Txt x={x0 + 8} y={sy(o.vannTil ?? 0) - 7} anchor="start" size={0.68} weight={600} color={SMELTE_FARGER.vaat}>
                Plata slipper vann her
              </Txt>
            )}
            <g clipPath={clip}>
              {felt.length > 2 && <path d={sti(felt, true)} fill={alpha(SMELTE_FARGER.smelte, 0.4)} stroke={GEO.magma.line} strokeWidth={0.8 * st} />}
              {o.vann && (
                <rect
                  x={x0}
                  y={sy(o.vannFra ?? 0)}
                  width={x1 - x0}
                  height={sy(o.vannTil ?? 0) - sy(o.vannFra ?? 0)}
                  fill={alpha(GEO.grunnvann.fill, 0.28)}
                />
              )}
              <path d={sti(vaat)} fill="none" stroke={SMELTE_FARGER.vaat} strokeWidth={2.6 * st} strokeDasharray={`${r2(8 * st)} ${r2(5 * st)}`} opacity={o.vann ? 1 : 0.55} />
              <path d={sti(torr)} fill="none" stroke={SMELTE_FARGER.torr} strokeWidth={3 * st} />
              {normal.length > 0 && <path d={sti(normal)} fill="none" stroke={VIZ.muted} strokeWidth={1.8 * st} strokeDasharray={`${r2(4 * st)} ${r2(4 * st)}`} />}
              <path d={sti(temp)} fill="none" stroke={SMELTE_FARGER.temperatur} strokeWidth={3.4 * st} />
            </g>
            {o.stiger && (
              <ForceArrow
                x1={sx(adiabat(pilZ0, o.tp) ?? 0) + pilDx}
                y1={sy(pilZ0)}
                x2={sx(adiabat(pilZ1, o.tp) ?? 0) + pilDx}
                y2={sy(pilZ1)}
                color={VIZ.velocity}
                width={5}
              />
            )}
            {o.stiger && (
              <Txt x={sx(adiabat(pilZ0, o.tp) ?? 0) + pilDx - 12 * k} y={sy((pilZ0 + pilZ1) / 2) + 5} anchor="end" size={0.72} weight={650} color={VIZ.velocity}>
                {type === 'varmt-punkt' ? 'Plumen stiger' : 'Mantelen stiger'}
              </Txt>
            )}
            {o.vann && (
              <>
                <ForceArrow x1={sx(tTorr) - 4} y1={sy(vannZ)} x2={sx(tVaat) + 8} y2={sy(vannZ)} color={SMELTE_FARGER.vaat} width={4.5} />
                <Txt x={sx((tTorr + tVaat) / 2)} y={sy(vannZ) - 11 * k} size={0.72} weight={650} color={SMELTE_FARGER.vaat}>
                  Vann senker smeltepunktet
                </Txt>
              </>
            )}
            {sone && start !== null && (
              <g>
                <circle cx={sx(adiabat(start, o.tp) ?? 0)} cy={sy(start)} r={4.5 * k} fill={GEO.magma.fill} stroke={VIZ.surface} strokeWidth={1.5 * st} />
                {start > 100 ? (
                  <Callout x={sx(adiabat(start, o.tp) ?? 0)} y={sy(start)} lx={sx(adiabat(start, o.tp) ?? 0) - 70 * k} ly={sy(start) - 26 * f} anchor="end" size={0.72} dot={false}>
                    {`Smeltingen starter ca. ${fmt(Math.round(start / 5) * 5, 0)} km`}
                  </Callout>
                ) : (
                  <Txt x={sx(adiabat(start, o.tp) ?? 0) - 12 * k} y={sy(start) + 18 * f} anchor="end" size={0.72} weight={650}>
                    <tspan x={sx(adiabat(start, o.tp) ?? 0) - 12 * k}>Smeltingen starter</tspan>
                    <tspan x={sx(adiabat(start, o.tp) ?? 0) - 12 * k} dy="1.25em">{`ca. ${fmt(Math.round(start / 5) * 5, 0)} km dyp`}</tspan>
                  </Txt>
                )}
              </g>
            )}
            {!sone && (
              <Txt x={tekstX} y={sy(o.litosfaere >= 140 ? 172 : 150)} anchor="start" size={0.74} weight={600}>
                <tspan x={tekstX}>Temperaturen når ikke smeltepunktet:</tspan>
                <tspan x={tekstX} dy="1.3em">
                  mantelen smelter ikke her.
                </tspan>
              </Txt>
            )}
          </g>
        );
      }}
    </LogPlot>
  );
}

/** Kort forklaring av fargene i smeltediagrammet (til `<Legend>`). */
export function smelteForklaring(type: PlategrenseType): ForklaringPunkt[] {
  const o = SMELTING[type];
  const temp =
    type === 'spredning'
      ? 'Temperaturen i mantelen som stiger'
      : type === 'varmt-punkt'
        ? 'Temperaturen i plumen (grå: vanlig mantel)'
        : type === 'subduksjon'
          ? 'Temperaturen i mantelkilen'
          : 'Temperaturen under plata';
  return [
    { color: SMELTE_FARGER.temperatur, label: temp },
    { color: SMELTE_FARGER.torr, label: 'Smeltepunkt uten vann' },
    { color: SMELTE_FARGER.vaat, label: 'Smeltepunkt med vann', dashed: true },
    ...(smeltesone(o, SMELTE_Z) ? [{ color: alpha(SMELTE_FARGER.smelte, 0.45), label: 'Delvis smeltet mantel', form: 'flate' as const }] : []),
  ];
}
