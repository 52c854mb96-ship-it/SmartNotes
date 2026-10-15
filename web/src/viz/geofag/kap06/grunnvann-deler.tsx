/**
 * Egne deler til «Grunnvann» (k6-grunnvann) som ikke finnes i kit-ene: den gjødslede åkeren på toppen av snittblokka,
 * matjorda under den, den lekke kloakkledningen, sigevann ned gjennom den umettede sonen, merkene (smittestoff og
 * nitrat) som flytter seg med grunnvannet, sprekker i fjell, utsnittene i lupa for oppsprukket fjell og leire, vann som
 * strømmer gjennom porene, og fartsstigen med porefarten i materialene.
 *
 * Samme stil som scene-kit-et: toninger fra core.tsx, kontur, lys fra øvre venstre, ingen filtre og ingen bilder.
 * Merkene og strømmen har glorie i flatefargen, så de synes oppå mønstrene.
 */
import { memo, useMemo } from 'react';
import { GEO, LagMonstre, Txt, VIZ, lagFyll, seededRandom, placeParticles, snittFordelEtiketter, tekstBredde, useGeoScale, useGeoStroke, useLagMonstre, useTextScale, type KornpakningGeometri } from '../kit';
import { LinearGradient, SCENE, alpha, shade, tint, useSvgId } from '../../kit/scene';

type Fn = (x: number) => number;
type P = readonly [number, number];

const r2 = (v: number) => Math.round(v * 100) / 100;
const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
const sti = (p: readonly P[], lukket = false) =>
  p.length < 2 ? '' : `${p.map(([x, y], i) => `${i ? 'L' : 'M'}${r2(x)} ${r2(y)}`).join('')}${lukket ? 'Z' : ''}`;
const linspace = (a: number, b: number, n: number) => Array.from({ length: n + 1 }, (_, i) => a + ((b - a) * i) / n);

/* ---------------------------------------------------------------------------------------------------------------- */

/**
 * Gjødslet åker på toppflaten av en snittblokk (Grunnvannssnitt eller Snittblokk): brun jord med rader av korn som går
 * innover i blokka. Tegnes i `over` (snittets koordinater). `fra` og `til` er x på forkanten; `overflate` er bakken.
 */
export function AkerFlate({ fra, til, overflate, dx, dy }: { fra: number; til: number; overflate: Fn; dx: number; dy: number }) {
  const s = useGeoStroke();
  const id = useSvgId('aker');
  if (![fra, til, dx, dy].every(Number.isFinite) || til <= fra) return null;
  const xs = linspace(fra, til, 18);
  const inn = 0.96;
  const foran = xs.map((x): P => [x, overflate(x)]);
  const bak = [...xs].reverse().map((x): P => [x + inn * dx, overflate(x) - inn * dy]);
  const rader = linspace(0.1, 0.88, 7);
  return (
    <g>
      <LinearGradient id={id} x2={0.4} y2={1} stops={[[0, shade(SCENE.soil, 0.08)], [1, tint(SCENE.soil, 0.12)]]} />
      <path d={sti([...foran, ...bak], true)} fill={`url(#${id})`} stroke={shade(SCENE.soil, 0.25)} strokeWidth={0.8 * s} strokeLinejoin="round" />
      {rader.map((t, i) => {
        const p = linspace(fra + 3, til - 3, 10).map((x): P => [x + t * dx, overflate(x) - t * dy]);
        return (
          <g key={i} fill="none" strokeLinecap="round">
            <path d={sti(p)} stroke={SCENE.soilDark} strokeWidth={0.9 * s} transform={`translate(0 ${r2(1.6 * s)})`} opacity={0.7} />
            <path d={sti(p)} stroke={i % 2 ? SCENE.grass : tint(SCENE.grass, 0.12)} strokeWidth={(1.6 + 0.9 * t) * s} strokeDasharray={`${r2(2.2 * s)} ${r2(1.4 * s)}`} />
          </g>
        );
      })}
    </g>
  );
}

/** Matjordlaget under åkeren på forsida av snittet (som barn av Grunnvannssnitt, så det klippes til bakken). */
export function Matjord({ fra, til, overflate, tykkelse }: { fra: number; til: number; overflate: Fn; tykkelse: number }) {
  const s = useGeoStroke();
  if (![fra, til, tykkelse].every(Number.isFinite) || til <= fra || tykkelse <= 0) return null;
  const xs = linspace(fra, til, 14);
  const topp = xs.map((x): P => [x, overflate(x) - 2]);
  const bunn = [...xs].reverse().map((x, i): P => [x, overflate(x) + tykkelse * (0.85 + 0.15 * Math.sin(i * 1.7))]);
  return <path d={sti([...topp, ...bunn], true)} fill={SCENE.soil} stroke={SCENE.soilDark} strokeWidth={0.8 * s} opacity={0.92} />;
}

/* ---------------------------------------------------------------------------------------------------------------- */

/**
 * Kloakkledning i snittet: et rør fra huset (`x1`, ned fra bakken) bortover til en sprukket skjøt i `x2`, der det lekker.
 * `y` er midten av røret, `bakke` er bakken ved huset. Tegnes som barn av Grunnvannssnitt.
 */
export function Kloakkledning({ x1, x2, y, bakke }: { x1: number; x2: number; y: number; bakke: number }) {
  const k = useGeoScale();
  const s = useGeoStroke();
  const id = useSvgId('kloakk');
  if (![x1, x2, y, bakke].every(Number.isFinite)) return null;
  const d = 5.5 * k;
  const a = Math.min(x1, x2);
  const b = Math.max(x1, x2) - 3 * k;
  const ror = SCENE.concrete;
  const skjoter = linspace(a + 14 * k, b - 6 * k, Math.max(1, Math.floor((b - a) / (22 * k))));
  return (
    <g>
      <LinearGradient id={id} stops={[[0, tint(ror, 0.25)], [0.45, ror], [1, shade(ror, 0.3)]]} />
      {/* Våt flekk rundt lekkasjen */}
      <ellipse cx={r2(x2)} cy={r2(y + 2 * k)} rx={r2(9 * k)} ry={r2(6 * k)} fill={alpha(GEO.smitte.line, 0.22)} />
      {/* Fallrøret fra huset */}
      <rect x={r2(x1 - d / 2)} y={r2(bakke - 1)} width={r2(d)} height={r2(Math.max(0, y - bakke + 1))} fill={`url(#${id})`} stroke={SCENE.outline} strokeWidth={0.8 * s} />
      {/* Ledningen */}
      <rect x={r2(a - d / 2)} y={r2(y - d / 2)} width={r2(Math.max(0, b - a + d / 2))} height={r2(d)} rx={r2(d * 0.25)} fill={`url(#${id})`} stroke={SCENE.outline} strokeWidth={0.8 * s} />
      {skjoter.map((x, i) => (
        <rect key={i} x={r2(x - 1.2 * k)} y={r2(y - d / 2 - 0.8 * k)} width={r2(2.4 * k)} height={r2(d + 1.6 * k)} rx={r2(0.6 * k)} fill={shade(ror, 0.15)} stroke={SCENE.outline} strokeWidth={0.6 * s} />
      ))}
      {/* Sprukket ende */}
      <path
        d={`M${r2(b)} ${r2(y - d / 2)}l${r2(2.6 * k)} ${r2(1.2 * k)}l${r2(-1.6 * k)} ${r2(1.4 * k)}l${r2(2.4 * k)} ${r2(1.1 * k)}l${r2(-1.8 * k)} ${r2(1.3 * k)}L${r2(b)} ${r2(y + d / 2)}Z`}
        fill={shade(ror, 0.2)}
        stroke={SCENE.outline}
        strokeWidth={0.7 * s}
        strokeLinejoin="round"
      />
      <path d={`M${r2(b - 4 * k)} ${r2(y - d / 2)}l${r2(1.4 * k)} ${r2(2.2 * k)}l${r2(-0.8 * k)} ${r2(1.6 * k)}`} fill="none" stroke={SCENE.outline} strokeWidth={0.7 * s} />
    </g>
  );
}

/**
 * Sigevann fra en kilde ned gjennom den umettede sonen til grunnvannsspeilet: `n` stiplede striper med dråper fra
 * `topp` til `speil` (snittets koordinater), spredt over bredden `bredde` rundt `x`. Med `t` siger dråpene nedover.
 */
export function Sigevann({ x, topp, speil, farge, bredde = 0, n = 1, t, seed = 3 }: { x: number; topp: number; speil: Fn; farge: string; bredde?: number; n?: number; t?: number; seed?: number }) {
  const k = useGeoScale();
  const s = useGeoStroke();
  const striper = useMemo(() => {
    const rnd = seededRandom(seed);
    return Array.from({ length: Math.max(1, n) }, (_, i) => ({ dx: n > 1 ? (i / (n - 1) - 0.5) * bredde : 0, slingr: (rnd() - 0.5) * 4, fase: rnd() }));
  }, [n, bredde, seed]);
  if (![x, topp].every(Number.isFinite)) return null;
  const forskyv = t !== undefined && Number.isFinite(t) ? t * 14 * k : 0;
  return (
    <g strokeLinecap="round" fill="none">
      {striper.map((st, i) => {
        const xx = x + st.dx;
        const y1 = speil(xx) - 1;
        if (!(y1 - topp > 2)) return null;
        const d = `M${r2(xx)} ${r2(topp)}Q${r2(xx + st.slingr * k)} ${r2((topp + y1) / 2)} ${r2(xx)} ${r2(y1)}`;
        return (
          <g key={i}>
            <path d={d} stroke={VIZ.surface} strokeWidth={3.6 * s} opacity={0.55} />
            <path d={d} stroke={farge} strokeWidth={1.8 * s} strokeDasharray={`${r2(2.6 * k)} ${r2(4.2 * k)}`} strokeDashoffset={r2(-forskyv - st.fase * 6 * k)} />
            <circle cx={r2(xx)} cy={r2(y1 - 1.5 * k)} r={r2(1.9 * k)} fill={farge} stroke={VIZ.surface} strokeWidth={0.7 * s} />
          </g>
        );
      })}
    </g>
  );
}

/** Ett merke langs veien: plassen og hvor synlig det er (0–1). */
export interface Merke {
  x: number;
  y: number;
  a: number;
}

/** Merkene (smittestoff eller nitrat) som runde prikker med glorie. Tegnes som barn av Grunnvannssnitt. */
export const Merker = memo(function Merker({ merker, farge, r = 2.6 }: { merker: readonly Merke[]; farge: string; r?: number }) {
  const k = useGeoScale();
  const s = useGeoStroke();
  return (
    <g>
      {merker.map((m, i) =>
        m.a > 0.02 && Number.isFinite(m.x) && Number.isFinite(m.y) ? (
          <circle key={i} cx={r2(m.x)} cy={r2(m.y)} r={r2(r * k)} fill={farge} stroke={VIZ.surface} strokeWidth={r2(0.9 * s)} opacity={r2(clamp(m.a, 0, 1))} />
        ) : null,
      )}
    </g>
  );
});

/** Stiplet linje langs veien merkene tar, med en ring ved kilden (så figuren gir mening før avspillingen). */
export function MerkeVei({ punkter, farge }: { punkter: readonly P[]; farge: string }) {
  const k = useGeoScale();
  const s = useGeoStroke();
  const start = punkter[0];
  if (!start) return null;
  return (
    <g fill="none" strokeLinecap="round">
      <path d={sti(punkter)} stroke={VIZ.surface} strokeWidth={3.4 * s} opacity={0.5} />
      <path d={sti(punkter)} stroke={farge} strokeWidth={1.5 * s} strokeDasharray={`${r2(5 * s)} ${r2(4 * s)}`} opacity={0.85} />
      <circle cx={r2(start[0])} cy={r2(start[1])} r={r2(3.4 * k)} fill={alpha(farge, 0.35)} stroke={farge} strokeWidth={1.2 * s} />
    </g>
  );
}

/* ---------------------------------------------------------------------------------------------------------------- */

/**
 * Sprekker i fjellet (snittets koordinater): mørke linjer, og under grunnvannsspeilet en blå kjerne, så det synes at
 * vannet står i sprekkene. Tegnes som barn av Grunnvannssnitt.
 */
export const Sprekker = memo(function Sprekker({ linjer, speil, bredde, hoyde }: { linjer: readonly (readonly P[])[]; speil: Fn; bredde: number; hoyde: number }) {
  const s = useGeoStroke();
  const id = useSvgId('sprekk');
  const mettet = useMemo(() => {
    const xs = linspace(0, bredde, 60);
    return sti([...xs.map((x): P => [x, speil(x)]), [bredde, hoyde + 10], [0, hoyde + 10]], true);
  }, [speil, bredde, hoyde]);
  const d = linjer.map((l) => sti(l)).join('');
  return (
    <g fill="none" strokeLinecap="round" strokeLinejoin="round">
      <defs>
        <clipPath id={id}>
          <path d={mettet} />
        </clipPath>
      </defs>
      <path d={d} stroke={alpha(VIZ.surface, 0.5)} strokeWidth={3 * s} />
      <path d={d} stroke={shade(GEO.bergart.gneis.line, 0.25)} strokeWidth={1.6 * s} />
      <path d={d} stroke={GEO.grunnvann.line} strokeWidth={1.1 * s} clipPath={`url(#${id})`} />
    </g>
  );
});

/**
 * Utsnittet i lupa for oppsprukket fjell: gneis med tre sprekker, fylt med vann (mettet sone) eller med luft og en
 * vannhinne langs veggene (umettet sone). Midten er (0, 0) og radiusen r (som barn av `Lupe`). Med `t` beveger vannet
 * seg langs sprekkene.
 */
export function SprekkeUtsnitt({ r, fyll, t = 0, fart = 10 }: { r: number; fyll: 'vann' | 'luft'; t?: number; fart?: number }) {
  const k = useGeoScale();
  const s = useGeoStroke();
  const monstre = useLagMonstre('lupe-fjell');
  const sprekker = useMemo(() => {
    const rnd = seededRandom(11);
    return [
      { a: -0.95, b: 0.75, y: -0.42, w: 0.07 },
      { a: -0.9, b: 0.95, y: 0.12, w: 0.1 },
      { a: -0.6, b: 0.9, y: 0.55, w: 0.055 },
    ].map((sp) => {
      const xs = linspace(sp.a * r, sp.b * r, 12);
      const midt = xs.map((x, i): P => [x, sp.y * r + 0.12 * r * Math.sin(x / (0.32 * r) + i * 0.15) + (rnd() - 0.5) * 0.03 * r]);
      const w = sp.w * r;
      const over = midt.map(([x, y], i): P => [x, y - w * (0.7 + 0.5 * Math.sin(i * 1.9))]);
      const under = [...midt].reverse().map(([x, y], i): P => [x, y + w * (0.7 + 0.5 * Math.cos(i * 1.3))]);
      return { midt, form: sti([...over, ...under], true), w };
    });
  }, [r]);
  if (!(r > 4)) return null;
  const film = Math.max(1.4 * s, 0.018 * r);
  return (
    <g>
      <LagMonstre id={monstre.id} bare={['gneis']} skala={2.2} />
      <rect x={-r} y={-r} width={2 * r} height={2 * r} fill={lagFyll('gneis', monstre.id).fill} />
      {sprekker.map((sp, i) => (
        <g key={i}>
          <path d={sp.form} fill={fyll === 'vann' ? GEO.grunnvann.fill : GEO.luft.fill} stroke={shade(GEO.bergart.gneis.line, 0.2)} strokeWidth={1.4 * s} strokeLinejoin="round" />
          {fyll === 'luft' && <path d={sp.form} fill="none" stroke={GEO.grunnvann.fill} strokeWidth={r2(2 * film)} strokeLinejoin="round" opacity={0.9} />}
          {fyll === 'vann' &&
            [0, 1, 2, 3].map((j) => {
              const lengde = sp.midt.length - 1;
              const u = (((t * fart) / (2 * r) + j / 4 + i * 0.13) % 1 + 1) % 1;
              const pos = u * lengde;
              const a = sp.midt[Math.floor(pos)]!;
              const b = sp.midt[Math.min(lengde, Math.floor(pos) + 1)]!;
              const f = pos - Math.floor(pos);
              return <circle key={j} cx={r2(a[0] + f * (b[0] - a[0]))} cy={r2(a[1] + f * (b[1] - a[1]))} r={r2(Math.min(2.2 * k, 0.7 * sp.w))} fill={VIZ.velocity} stroke={VIZ.surface} strokeWidth={0.6 * s} />;
            })}
        </g>
      ))}
    </g>
  );
}

/**
 * Utsnittet i lupa for leire: små, flate leirpartikler hulter til bulter med bitte små porer imellom, fylt med vann
 * (mettet sone) eller med vannhinner rundt partiklene og luft (umettet sone). Midten er (0, 0) og radiusen r.
 */
export const LeirUtsnitt = memo(function LeirUtsnitt({ r, fyll }: { r: number; fyll: 'vann' | 'luft' }) {
  const k = useGeoScale();
  const s = useGeoStroke();
  const flak = useMemo(() => {
    const pr = Math.max(4.5, 0.06 * r);
    const n = Math.round((Math.PI * r * r) / (pr * pr * 3.2));
    return placeParticles({ x: -r, y: -r, w: 2 * r, h: 2 * r }, [{ n, r: pr }], 21, 0.8).map((p) => ({ ...p, vinkel: ((p.phase * 180) / Math.PI) % 180 }));
  }, [r]);
  if (!(r > 4)) return null;
  const vann = GEO.grunnvann;
  const leire = GEO.bergart.leire;
  return (
    <g>
      <rect x={-r} y={-r} width={2 * r} height={2 * r} fill={fyll === 'vann' ? vann.fill : GEO.luft.fill} />
      {flak.map((p, i) => {
        const L = 2.1 * p.r;
        const T = 0.5 * p.r;
        const tr = `rotate(${r2(p.vinkel)} ${r2(p.x)} ${r2(p.y)})`;
        return (
          <g key={i} transform={tr}>
            {fyll === 'luft' && <rect x={r2(p.x - L / 2 - 1.6 * k)} y={r2(p.y - T / 2 - 1.6 * k)} width={r2(L + 3.2 * k)} height={r2(T + 3.2 * k)} rx={r2(T / 2 + 1.6 * k)} fill={vann.fill} />}
            <rect x={r2(p.x - L / 2)} y={r2(p.y - T / 2)} width={r2(L)} height={r2(T)} rx={r2(T * 0.4)} fill={i % 3 ? leire.fill : tint(leire.fill, 0.12)} stroke={leire.line} strokeWidth={r2(0.8 * s)} />
          </g>
        );
      })}
    </g>
  );
});

/**
 * Vann som strømmer gjennom porene i en `Kornpakning`: små prikker som går mot høyre med farten `fart` (figurens
 * enheter per sekund) og bare synes i porene (ikke oppå kornene). Gi den geometrien fra Kornpakning sine barn.
 */
export function PoreStrom({ g, t, fart, n = 160, seed = 5 }: { g: KornpakningGeometri; t: number; fart: number; n?: number; seed?: number }) {
  const k = useGeoScale();
  const s = useGeoStroke();
  const start = useMemo(() => {
    const rnd = seededRandom(seed);
    return Array.from({ length: n }, () => ({ u: rnd(), v: rnd() }));
  }, [n, seed]);
  const u = g.utsnitt;
  const bw = 'r' in u ? 2 * u.r : u.w;
  const bh = 'r' in u ? 2 * u.r : u.h;
  const x0 = u.x - bw / 2;
  const y0 = u.y - bh / 2;
  return (
    <g>
      {start.map((p, i) => {
        const x = x0 + ((((p.u * bw + t * fart) % bw) + bw) % bw);
        const y = y0 + p.v * bh;
        const rd = 2.3 * k;
        const iKorn = g.korn.some((q) => Math.hypot(x - q.x, y - q.y) < q.r * 1.06 + 0.6 * rd);
        if (iKorn) return null;
        return <circle key={i} cx={r2(x)} cy={r2(y)} r={r2(rd)} fill={VIZ.velocity} stroke={VIZ.surface} strokeWidth={r2(0.7 * s)} />;
      })}
    </g>
  );
}

/* ---------------------------------------------------------------------------------------------------------------- */

/** Ett materiale på fartsstigen. */
export interface StigeMerke {
  id: string;
  navn: string;
  /** Porefarten i m/s. */
  v: number;
  /** Teksten med farten («0,17 m/døgn»). */
  tekst: string;
}

/** Hjelpestrekene på fartsstigen (m/s) med tekst. */
const STIGE_MERKER: readonly { v: number; tekst: string }[] = [
  { v: 100 / 86_400, tekst: '100 m/døgn' },
  { v: 1 / 86_400, tekst: '1 m/døgn' },
  { v: 1 / 31_557_600, tekst: '1 m/år' },
  { v: 0.01 / 31_557_600, tekst: '1 cm/år' },
  { v: 0.001 / 31_557_600, tekst: '1 mm/år' },
];
const V_MAKS = 300 / 86_400;
const V_MIN = 0.0006 / 31_557_600;

/**
 * Fartsstige: en loddrett logaritmisk akse for porefarten fra ca. 300 m per døgn (øverst) til under 1 mm per år, med
 * hjelpestreker til venstre og materialene til høyre (det valgte uthevet, med farten). Ankerpunkt: (x, y) er toppen av
 * aksen; den går ned til y + h.
 */
export function Fartsstige({ x, y, h, merker, valgt }: { x: number; y: number; h: number; merker: readonly StigeMerke[]; valgt: string }) {
  const f = useTextScale();
  const k = useGeoScale();
  const s = useGeoStroke();
  const lo = Math.log10(V_MIN);
  const hi = Math.log10(V_MAKS);
  const sy = (v: number) => y + ((hi - Math.log10(clamp(v, V_MIN, V_MAKS))) / (hi - lo)) * h;
  const fs = 17 * 0.74 * f;
  const lh = fs * 1.25;
  // Etikettene til høyre fordeles så de ikke overlapper (det valgte får to linjer)
  const hoyder = merker.map((m) => (m.id === valgt ? 2 * lh : lh));
  const plass = snittFordelEtiketter(
    merker.map((m) => sy(m.v)),
    hoyder,
    y,
    y + h,
  );
  return (
    <g>
      <line x1={r2(x)} x2={r2(x)} y1={r2(y)} y2={r2(y + h)} stroke={VIZ.muted} strokeWidth={1.4 * s} />
      <path d={`M${r2(x - 5 * k)} ${r2(y + 7 * k)}L${r2(x)} ${r2(y - 2)}L${r2(x + 5 * k)} ${r2(y + 7 * k)}`} fill="none" stroke={VIZ.muted} strokeWidth={1.4 * s} strokeLinejoin="round" />
      {STIGE_MERKER.map((m) => (
        <g key={m.tekst}>
          <line x1={r2(x - 6 * k)} x2={r2(x)} y1={r2(sy(m.v))} y2={r2(sy(m.v))} stroke={VIZ.muted} strokeWidth={1.2 * s} />
          <Txt x={r2(x - 10 * k)} y={r2(sy(m.v) + fs * 0.35)} anchor="end" size={0.7} color={VIZ.muted}>
            {m.tekst}
          </Txt>
        </g>
      ))}
      {merker.map((m, i) => {
        const yy = sy(m.v);
        const ly = plass[i] ?? yy;
        const er = m.id === valgt;
        const tx = x + 22 * k;
        const forste = er ? ly - lh * 0.5 : ly;
        return (
          <g key={m.id}>
            <path d={`M${r2(x)} ${r2(yy)}L${r2(x + 10 * k)} ${r2(yy)}L${r2(tx - 4)} ${r2(ly)}`} fill="none" stroke={er ? VIZ.velocity : alpha(VIZ.muted, 0.7)} strokeWidth={(er ? 1.6 : 1) * s} />
            <circle cx={r2(x)} cy={r2(yy)} r={r2((er ? 5.2 : 3.4) * k)} fill={er ? VIZ.velocity : VIZ.surface} stroke={er ? VIZ.surface : VIZ.muted} strokeWidth={1.3 * s} />
            <Txt x={r2(tx)} y={r2(forste + fs * 0.35)} anchor="start" size={0.74} weight={er ? 700 : 500} color={er ? VIZ.ink : VIZ.muted}>
              {m.navn}
            </Txt>
            {er && (
              <Txt x={r2(tx)} y={r2(forste + lh + fs * 0.35)} anchor="start" size={0.74} weight={700} color={VIZ.velocity}>
                {m.tekst}
              </Txt>
            )}
          </g>
        );
      })}
    </g>
  );
}

/** Bredden fartsstigen trenger til høyre for aksen (figurens enheter) for de lengste navnene og farten. */
export function fartsstigeBredde(merker: readonly StigeMerke[], f: number, k: number): number {
  const fs = 17 * 0.74 * f;
  return 22 * k + Math.max(...merker.map((m) => Math.max(tekstBredde(m.navn, fs), tekstBredde(m.tekst, fs))), 0);
}
