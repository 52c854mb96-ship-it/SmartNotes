/**
 * Scenen i «Bygg et atom» (7A): atomet med elektronskall, et forstørret utsnitt av kjernen, nuklidesymbolet og en
 * fotballbane som viser målestokken (atomet som banen, kjernen som en ert på midtpunktet). Egne tegninger i samme stil
 * som scene-kit-et: toninger fra core, SCENE-farger, kontur og myk skygge.
 */
import { useMemo, type ReactNode } from 'react';
import { Txt, VIZ, fmt, fmtSci, useTextScale } from '../../kit';
import {
  Atomkjerne,
  Callout,
  Dimension,
  Elektron,
  Himmel,
  Landskap,
  LinearGradient,
  PAINTS,
  RadialGradient,
  SCENE,
  Underlag,
  alpha,
  mix,
  shade,
  tint,
  useStrokeScale,
  useSvgId,
} from '../../kit/scene';
import { packNucleus } from '../../kit/scene/rom-kjerne';
import { elementNameCap } from './elements';
import { chargeSuperscript, type AtomInfo } from './model';
import { PITCH_LENGTH, nucleusDiameter, scaleObject, scaledNucleus } from './model-atomets-oppbygning';
import { NuclideSymbol, PARTICLE } from './parts';

const r2 = (v: number) => (Number.isFinite(v) ? Math.round(v * 100) / 100 : 0);

/* ---------- Atomet ---------- */

/** Den ytterste radien med elektroner, eller 0 uten elektroner. */
export function occupiedRadius(radii: readonly number[], shells: number): number {
  return shells > 0 ? (radii[Math.min(shells, radii.length) - 1] ?? 0) : 0;
}

/** Elektronskyen og skallene. Skall uten elektroner er stiplet, så man ser hvor neste elektron havner. */
export function AtomBackdrop({ cx, cy, radii, shells }: { cx: number; cy: number; radii: readonly number[]; shells: number }) {
  const ss = useStrokeScale();
  const id = useSvgId('atom-sky');
  const R = occupiedRadius(radii, shells);
  return (
    <g aria-hidden>
      {shells > 0 && (
        <>
          <RadialGradient
            id={id}
            stops={[
              [0, PARTICLE.electron, 0.025],
              [0.55, PARTICLE.electron, 0.07],
              [0.84, PARTICLE.electron, 0.06],
              [1, PARTICLE.electron, 0],
            ]}
          />
          <circle cx={cx} cy={cy} r={R + 26} fill={`url(#${id})`} />
        </>
      )}
      {radii.map((Ri, i) =>
        i < shells ? (
          <g key={i} fill="none">
            <circle cx={cx} cy={cy} r={Ri} stroke={PARTICLE.electron} strokeOpacity={0.16} strokeWidth={6 * ss} />
            <circle cx={cx} cy={cy} r={Ri} stroke={VIZ.muted} strokeWidth={1.3 * ss} opacity={0.8} />
          </g>
        ) : (
          <circle key={i} cx={cx} cy={cy} r={Ri} fill="none" stroke={VIZ.grid} strokeWidth={1.2 * ss} strokeDasharray="4 6" />
        ),
      )}
    </g>
  );
}

/** Elektronene, jevnt fordelt i hvert skall og litt forskjøvet fra skall til skall, så de ikke står på rekke. */
export function AtomElectrons({ cx, cy, radii, shells, r }: { cx: number; cy: number; radii: readonly number[]; shells: number[]; r: number }) {
  const out: ReactNode[] = [];
  shells.forEach((count, i) => {
    const R = radii[i] ?? radii[radii.length - 1] ?? 0;
    for (let j = 0; j < count; j++) {
      const ang = -Math.PI / 2 + (2 * Math.PI * j) / count + i * 0.35;
      out.push(<Elektron key={`${i}-${j}`} x={r2(cx + R * Math.cos(ang))} y={r2(cy + R * Math.sin(ang))} r={r} />);
    }
  });
  return <g>{out}</g>;
}

/** Kjernen i riktig størrelse i forhold til figuren ville vært usynlig: her et lite punkt med en ring rundt (utsnittet). */
export function TinyNucleus({ cx, cy, Z, N, ring }: { cx: number; cy: number; Z: number; N: number; ring: number }) {
  const ss = useStrokeScale();
  const A = Z + N;
  const r = 3.4 / (1 + 1.1 * Math.cbrt(Math.max(1, A)));
  return (
    <g>
      <circle cx={cx} cy={cy} r={ring} fill={VIZ.surface} fillOpacity={0.55} stroke={VIZ.ink} strokeWidth={1.3 * ss} opacity={0.85} />
      <Atomkjerne x={cx} y={cy} Z={Z} N={N} r={A <= 1 ? 3.2 : r} tegn={false} />
    </g>
  );
}

/**
 * Kjeglen fra ringen rundt kjernen til utsnittet: de ytre tangentene mellom to sirkler, med en svak flate mellom.
 * Tegnes før elektronene og utsnittet, så de ligger oppå.
 */
export function ZoomCone({ x1, y1, r1, x2, y2, r2: rb }: { x1: number; y1: number; r1: number; x2: number; y2: number; r2: number }) {
  const ss = useStrokeScale();
  const dx = x2 - x1;
  const dy = y2 - y1;
  const D = Math.hypot(dx, dy);
  if (!(D > Math.abs(rb - r1) + 1)) return null;
  const ux = dx / D;
  const uy = dy / D;
  const s = (rb - r1) / D;
  const c = Math.sqrt(Math.max(0, 1 - s * s));
  const m = (sign: 1 | -1) => [-s * ux - sign * c * uy, -s * uy + sign * c * ux] as const;
  const [ax, ay] = m(1);
  const [bx, by] = m(-1);
  const pa1 = [x1 + r1 * ax, y1 + r1 * ay];
  const pa2 = [x2 + rb * ax, y2 + rb * ay];
  const pb1 = [x1 + r1 * bx, y1 + r1 * by];
  const pb2 = [x2 + rb * bx, y2 + rb * by];
  const pts = [pa1, pa2, pb2, pb1].map(([x, y]) => `${r2(x!)},${r2(y!)}`).join(' ');
  return (
    <g aria-hidden>
      <polygon points={pts} fill={VIZ.ink} fillOpacity={0.05} />
      {[
        [pa1, pa2],
        [pb1, pb2],
      ].map(([p, q], i) => (
        <line key={i} x1={r2(p![0]!)} y1={r2(p![1]!)} x2={r2(q![0]!)} y2={r2(q![1]!)} stroke={VIZ.muted} strokeWidth={1.1 * ss} strokeDasharray="5 4" />
      ))}
    </g>
  );
}

/* ---------- Utsnittet med kjernen ---------- */

/** Radien til kjernen i utsnittet (figurens enheter) når ett nukleon har radius `rn`. */
export function lensNucleusRadius(Z: number, N: number, rn: number): number {
  return packNucleus(Math.max(0, Z), Math.max(0, N), 1).radius * rn;
}

/**
 * Forstørret, rundt utsnitt av kjernen med metallkant og glass: kjernen av protoner og nøytroner, en svak glød og en
 * mållinje under kjernen (diameteren). Teksten over og under tegnes av den som bruker utsnittet.
 */
export function NucleusLens({ cx, cy, R, Z, N, rn }: { cx: number; cy: number; R: number; Z: number; N: number; rn: number }) {
  const ss = useStrokeScale();
  const glass = useSvgId('lupe-glass');
  const rim = useSvgId('lupe-kant');
  const glow = useSvgId('lupe-glod');
  const drop = useSvgId('lupe-skygge');
  const nucR = useMemo(() => lensNucleusRadius(Z, N, rn), [Z, N, rn]);
  const dimY = cy + nucR + 10 * ss;
  const hl = (deg: number) => [cx + (R - 11 * ss) * Math.cos((deg * Math.PI) / 180), cy + (R - 11 * ss) * Math.sin((deg * Math.PI) / 180)];
  const [h1x, h1y] = hl(198);
  const [h2x, h2y] = hl(248);
  return (
    <g>
      <RadialGradient
        id={drop}
        stops={[
          [0.82, SCENE.shadow, 0.5],
          [1, SCENE.shadow, 0],
        ]}
      />
      <RadialGradient
        id={glass}
        fx={0.38}
        fy={0.32}
        stops={[
          [0, mix(VIZ.surface, PARTICLE.electron, 0.02)],
          [1, mix(VIZ.surface, PARTICLE.electron, 0.12)],
        ]}
      />
      <RadialGradient
        id={glow}
        stops={[
          [0, PARTICLE.proton, 0.2],
          [0.6, PARTICLE.proton, 0.07],
          [1, PARTICLE.proton, 0],
        ]}
      />
      <LinearGradient
        id={rim}
        x2={1}
        stops={[
          [0, tint(SCENE.metalLight, 0.2)],
          [0.45, SCENE.metal],
          [1, shade(SCENE.metalDark, 0.1)],
        ]}
      />
      <circle cx={cx + 3} cy={cy + 7} r={R + 12} fill={`url(#${drop})`} aria-hidden />
      <circle cx={cx} cy={cy} r={R} fill={`url(#${glass})`} />
      <circle cx={cx} cy={cy} r={Math.min(R - 8, nucR * 1.9 + 8)} fill={`url(#${glow})`} aria-hidden />
      <Atomkjerne x={cx} y={cy} Z={Z} N={N} r={rn} seed={1} />
      <Dimension x1={cx - nucR} y1={dimY} x2={cx + nucR} y2={dimY} color={VIZ.ink} />
      <path
        d={`M${r2(h1x!)},${r2(h1y!)}A${r2(R - 11 * ss)},${r2(R - 11 * ss)} 0 0 1 ${r2(h2x!)},${r2(h2y!)}`}
        fill="none"
        stroke={SCENE.highlight}
        strokeWidth={3.2 * ss}
        strokeLinecap="round"
        opacity={0.75}
        aria-hidden
      />
      <circle cx={cx} cy={cy} r={R} fill="none" stroke={`url(#${rim})`} strokeWidth={7 * ss} />
      <circle cx={cx} cy={cy} r={R + 3.5 * ss} fill="none" stroke={SCENE.outline} strokeWidth={0.9 * ss} />
      <circle cx={cx} cy={cy} r={R - 3.5 * ss} fill="none" stroke={SCENE.outline} strokeWidth={0.7 * ss} opacity={0.6} />
    </g>
  );
}

/** Diameteren til kjernen som tekst med ett gjeldende siffer: «7 · 10⁻¹⁵ m». */
export function nucleusSizeText(A: number): string {
  return `${fmtSci(nucleusDiameter(A), 0)} m`;
}

/* ---------- Navn og nuklidesymbol ---------- */

export function descriptor(a: AtomInfo): string {
  if (a.electrons === 0) return 'Bare kjernen';
  if (a.charge === 0) return 'Nøytralt atom';
  return a.charge > 0 ? 'Positivt ion' : 'Negativt ion';
}

/**
 * Navnet, hva det er (atom eller ion), skallene og nuklidesymbolet ᴬ_Z X med ladningen. Symbolet tegnes sist, så
 * teksten «Na» ikke havner rett foran «Natrium» i dokumentet (leses som «NaN» av sjekken i skjermbildene).
 */
export function NuclideCard({ a, x, symbolY, size }: { a: AtomInfo; x: number; symbolY: number; size: number }) {
  const f = useTextScale();
  const nameY = symbolY + size * 0.42 + 26 * f;
  return (
    <g>
      <Txt x={x} y={nameY} size={1.35} weight={700}>
        {elementNameCap(a.Z)}-{a.A}
      </Txt>
      <Txt x={x} y={nameY + 27 * f} muted>
        {descriptor(a)}
      </Txt>
      <Txt x={x} y={nameY + 51 * f} muted>
        Skall: {a.shells.length ? a.shells.join(', ') : 'ingen elektroner'}
      </Txt>
      <NuclideSymbol x={x} y={symbolY} A={a.A} Z={a.Z} symbol={a.symbol} suffix={chargeSuperscript(a.charge) || undefined} size={size} anchor="middle" />
    </g>
  );
}

/* ---------- Målestokken: fotballbanen ---------- */

/** Banen: 68 m bred. Mål på linjene etter fotballreglene (m). */
const PITCH_W = 68;
const PERSPECTIVE = 0.16;

/** Loddrette mål i stripen med fotballbanen (figurens enheter, regnet fra toppen av stripen). */
function stripRows(f: number) {
  const narrow = f > 1.3;
  const yLine = 30 * f;
  const yText2 = yLine + 27 * f;
  const hL = narrow ? 34 : 24;
  const yH = yText2 + 8 + hL;
  const yF = yH + 4;
  const D = narrow ? 96 : 54;
  const yN = yF + D;
  const yEdge = yN + 8;
  return { yLine, yText2, hL, yH, yF, D, yN, yEdge, height: yEdge + 14 + 4 };
}

/** Høyden stripen med fotballbanen trenger med tekstskaleringen f. */
export function pitchStripHeight(f: number): number {
  return stripRows(f).height;
}

/**
 * Hvis atomet var en fotballbane: banen sett skrått fra langsiden, med gresstriper, oppmerking og mål, en mållinje over
 * hele lengden («atomet») og en strek til midtpunktet der kjernen ville ligget. y0 er toppen av stripen.
 */
export function PitchStrip({ y0, A }: { y0: number; A: number }) {
  const f = useTextScale();
  const ss = useStrokeScale();
  const rows = stripRows(f);
  const D = rows.D;
  const yLine = y0 + rows.yLine;
  const yText2 = y0 + rows.yText2;
  const yH = y0 + rows.yH;
  const yN = y0 + rows.yN;
  const yEdge = y0 + rows.yEdge;
  const cx = 400;
  const s = f > 1.3 ? 7.2 : 6.2;
  const P = (u: number, v: number): [number, number] => [cx + (u - 50) * s * (1 - (PERSPECTIVE * v) / PITCH_W), yN - (v * D) / PITCH_W];
  const pt = (u: number, v: number) => P(u, v).map(r2).join(',');
  const poly = (corners: [number, number][]) => corners.map(([u, v]) => pt(u, v)).join(' ');

  const mm = scaledNucleus(A) * 1000;
  const thing = scaleObject(mm).name;

  // Gresstriper på tvers av banen (litt utenfor linjene)
  const stripes: ReactNode[] = [];
  const n = 14;
  for (let i = 0; i < n; i++) {
    const u0 = -4 + (108 * i) / n;
    const u1 = -4 + (108 * (i + 1)) / n;
    stripes.push(
      <polygon
        key={i}
        points={poly([
          [u0, -2.5],
          [u1, -2.5],
          [u1, PITCH_W + 2.5],
          [u0, PITCH_W + 2.5],
        ])}
        fill={i % 2 === 0 ? tint(SCENE.grass, 0.07) : shade(SCENE.grass, 0.07)}
      />,
    );
  }
  // Midtsirkelen (radius 9,15 m)
  const circle: string[] = [];
  for (let i = 0; i <= 48; i++) {
    const t = (2 * Math.PI * i) / 48;
    circle.push(pt(50 + 9.15 * Math.cos(t), 34 + 9.15 * Math.sin(t)));
  }
  const box = (u0: number, du: number, halfW: number) =>
    poly([
      [u0, 34 - halfW],
      [u0 + du, 34 - halfW],
      [u0 + du, 34 + halfW],
      [u0, 34 + halfW],
    ]);
  const lines = PAINTS.hvit;
  const [scx, scy] = P(50, 34);
  const [g0x] = P(0, 0);
  const [g1x] = P(100, 0);
  return (
    <g>
      <Himmel x={0} y={y0} w={800} h={yH - y0 + 2} skyer={1} seed={7} />
      <Landskap x={0} y={yH} w={800} h={rows.hL} type="by" seed={2} />
      <Underlag x1={0} x2={800} y={yEdge} depth={14} type="gress" horisont={yH} />
      <g aria-hidden>
        {stripes}
        <g fill="none" stroke={lines} strokeWidth={1.5 * ss} strokeLinejoin="round" opacity={0.95}>
          <polygon
            points={poly([
              [0, 0],
              [100, 0],
              [100, PITCH_W],
              [0, PITCH_W],
            ])}
          />
          <polyline points={`${pt(50, 0)} ${pt(50, PITCH_W)}`} />
          <polyline points={circle.join(' ')} />
          <polygon points={box(0, 16.5, 20.16)} />
          <polygon points={box(100, -16.5, 20.16)} />
          <polygon points={box(0, 5.5, 9.16)} />
          <polygon points={box(100, -5.5, 9.16)} />
        </g>
        <g fill={lines}>
          {[
            [50, 34],
            [11, 34],
            [89, 34],
          ].map(([u, v]) => {
            const [x, y] = P(u!, v!);
            return <ellipse key={u} cx={r2(x)} cy={r2(y)} rx={2 * ss} ry={1.2 * ss} />;
          })}
        </g>
        <Goal P={P} u0={0} back={-2.2} s={s} />
        <Goal P={P} u0={100} back={2.2} s={s} />
      </g>
      <Dimension x1={g0x} y1={yN} x2={g1x} y2={yN} offset={yN - yLine} label={`Hvis atomet var en fotballbane på ${PITCH_LENGTH} m,`} labelSize={0.85} />
      <Callout x={scx} y={scy} lx={400} ly={yText2} anchor="middle" strong size={0.85}>
        ville kjernen vært {thing} på {fmt(mm, 1)} mm
      </Callout>
    </g>
  );
}

/** Et fotballmål (7,32 m bredt og 2,44 m høyt) med nett bak, stående på mållinja i u0. */
function Goal({ P, u0, back, s }: { P: (u: number, v: number) => [number, number]; u0: number; back: number; s: number }) {
  const ss = useStrokeScale();
  const v1 = 34 - 3.66;
  const v2 = 34 + 3.66;
  const h = (v: number) => 2.44 * s * (1 - (PERSPECTIVE * v) / PITCH_W);
  const [b1x, b1y] = P(u0, v1);
  const [b2x, b2y] = P(u0, v2);
  const [n1x, n1y] = P(u0 + back, v1);
  const [n2x, n2y] = P(u0 + back, v2);
  const t1 = [b1x, b1y - h(v1)];
  const t2 = [b2x, b2y - h(v2)];
  const nt1 = [n1x, n1y - 0.75 * h(v1)];
  const nt2 = [n2x, n2y - 0.75 * h(v2)];
  const net = [t1, t2, nt2, [n2x, n2y], [n1x, n1y], nt1].map(([x, y]) => `${r2(x!)},${r2(y!)}`).join(' ');
  const post = (x1: number, y1: number, x2: number, y2: number, key: string) => (
    <g key={key}>
      <line x1={r2(x1)} y1={r2(y1)} x2={r2(x2)} y2={r2(y2)} stroke={SCENE.outline} strokeWidth={3.4 * ss} strokeLinecap="round" />
      <line x1={r2(x1)} y1={r2(y1)} x2={r2(x2)} y2={r2(y2)} stroke={PAINTS.hvit} strokeWidth={2 * ss} strokeLinecap="round" />
    </g>
  );
  return (
    <g>
      <polygon points={net} fill={alpha(PAINTS.hvit, 0.28)} stroke={alpha(PAINTS.hvit, 0.7)} strokeWidth={0.8 * ss} strokeLinejoin="round" />
      {post(b2x, b2y, t2[0]!, t2[1]!, 'far')}
      {post(t1[0]!, t1[1]!, t2[0]!, t2[1]!, 'bar')}
      {post(b1x, b1y, t1[0]!, t1[1]!, 'near')}
    </g>
  );
}
