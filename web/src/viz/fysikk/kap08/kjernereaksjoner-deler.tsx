/**
 * Egne gjenstander til «Kjernereaksjoner: α, β og γ» (k8-kjernereaksjoner): nærbilder av hverdagsting med radioaktive
 * kjerner (gammel vekkerklokke med radiumtall, røykvarsler i taket, bjørkeved, bananer, steinsopp og en strålekilde
 * i holder) og omgivelsene rundt (labbenk, kjøkkenbenk med fliser, tregulv med fotlist og himling). Alunskiferen,
 * blybeholderen og medisinglasset er de samme som i «Halveringstid» (halveringstid-deler.tsx).
 *
 * Samme stil som scene-kit-et: toninger fra core.tsx, SCENE-farger, tynn kontur og myk skygge, ingen filtre.
 * Alle mål er i meter og tegnes med skalaen P (px/m), så proporsjonene stemmer med målet i scenen.
 * Ankerpunkt: (x, y) er midt under gjenstanden, på underlaget (røykvarsleren: midt på toppen, i taket).
 */
import { memo, useMemo } from 'react';
import {
  ContactShadow,
  LinearGradient,
  PAINTS,
  RadialGradient,
  SCENE,
  alpha,
  materialStops,
  mix,
  sceneRandom,
  shade,
  tint,
  useStrokeScale,
  useSvgId,
} from '../../kit/scene';
import { Faresymbol, Sample } from './halveringstid-deler';
import type { KildeType, Omgivelse } from './kjernereaksjoner-kilder';

const r2 = (v: number) => Math.round(v * 100) / 100;
const pts = (list: [number, number][]) => list.map(([a, b]) => `${r2(a)},${r2(b)}`).join(' ');

/** Selvlysende maling (radium blandet med sinksulfid): blek gulgrønn. */
const LYSMALING = mix(tint(PAINTS.gronn, 0.45), PAINTS.gul, 0.4);

/* ---------------------------------------------------------------- Geometri */

export interface KildeGeometri {
  /** Punktet lupa forstørrer, relativt til ankerpunktet. */
  spot: { dx: number; dy: number };
  /** Mållinja, relativt til ankerpunktet. */
  maal: { x1: number; y1: number; x2: number; y2: number };
  /** Øverste og nederste punkt og halve bredden, relativt til ankerpunktet (til plassering av etiketter). */
  top: number;
  bottom: number;
  half: number;
}

/** Hvor lupa ser, hvor målet tegnes og hvor stor gjenstanden er, med skalaen P (px/m). */
export function kildeGeometri(type: KildeType, P: number): KildeGeometri {
  const m = (v: number) => v * P;
  switch (type) {
    case 'skifer':
      return { spot: { dx: m(-0.008), dy: m(-0.016) }, maal: { x1: m(-0.039), y1: 0, x2: m(0.039), y2: 0 }, top: m(-0.03), bottom: 0, half: m(0.039) };
    case 'vekkerklokke':
      return {
        spot: { dx: 0, dy: m(-0.057 - 0.045 * 0.82 * 0.76) },
        maal: { x1: m(0.062), y1: m(-0.14), x2: m(0.062), y2: 0 },
        top: m(-0.14),
        bottom: 0,
        half: m(0.055),
      };
    case 'roykvarsler':
      return {
        spot: { dx: 0, dy: m(0.018) },
        maal: { x1: m(-0.055), y1: m(0.035) + m(0.014), x2: m(0.055), y2: m(0.035) + m(0.014) },
        top: 0,
        bottom: m(0.049),
        half: m(0.055),
      };
    case 'ved':
      return { spot: { dx: m(-0.15 + 0.004), dy: m(-0.05) }, maal: { x1: m(-0.15), y1: 0, x2: m(0.15), y2: 0 }, top: m(-0.1), bottom: 0, half: m(0.159) };
    case 'banan':
      return { spot: { dx: m(0.012), dy: m(-0.016) }, maal: { x1: m(-0.095), y1: 0, x2: m(0.095), y2: 0 }, top: m(-0.052), bottom: 0, half: m(0.1) };
    case 'blybeholder':
      return { spot: { dx: 0, dy: m(-0.0385) }, maal: { x1: m(-0.025), y1: 0, x2: m(0.025), y2: 0 }, top: m(-0.043), bottom: 0, half: m(0.026) };
    case 'sopp':
      return { spot: { dx: m(0.02), dy: m(-0.105) }, maal: { x1: m(0.08), y1: m(-0.12), x2: m(0.08), y2: 0 }, top: m(-0.12), bottom: 0, half: m(0.078) };
    case 'kildeskive':
      return {
        spot: { dx: 0, dy: m(-0.0335) },
        maal: { x1: m(0.0125) + 14, y1: m(-0.046), x2: m(0.0125) + 14, y2: m(-0.021) },
        top: m(-0.046),
        bottom: 0,
        half: m(0.02),
      };
    case 'medisinglass':
      return { spot: { dx: 0, dy: m(-0.012) }, maal: { x1: m(0.015) + 12, y1: m(-0.056), x2: m(0.015) + 12, y2: 0 }, top: m(-0.056), bottom: 0, half: m(0.015) };
  }
}

/* ---------------------------------------------------------------- Omgivelsene */

export interface OmgivelseGeo {
  /** Bakkanten av benken/gulvet (der veggen møter flaten). */
  bak: number;
  /** Overflaten der gjenstanden står (ankerpunktet). */
  flate: number;
  /** Forkanten av benkeplata (under den: forsiden). */
  forkant: number;
  /** Underkanten av himlingen (bare «tak»). */
  tak: number;
}

/** Høydene i nærbildet: benkeplata ligger nederst, himlingen øverst. `h` er høyden på utsnittet. */
export function omgivelseGeo(type: Omgivelse, y0: number, h: number): OmgivelseGeo {
  if (type === 'tak') return { bak: y0 + h, flate: y0 + h, forkant: y0 + h, tak: y0 + 0.2 * h };
  if (type === 'gulv') return { bak: y0 + 0.6 * h, flate: y0 + 0.8 * h, forkant: y0 + h, tak: y0 };
  return { bak: y0 + 0.66 * h, flate: y0 + 0.8 * h, forkant: y0 + 0.9 * h, tak: y0 };
}

/**
 * Bakgrunnen i nærbildet: vegg og benkeplate, kjøkkenbenk i tre med hvite fliser, tregulv med fotlist, eller himling
 * med taklist. Fliser, fotlist og gulvbord følger skalaen P, så de viser hvor stort nærbildet er.
 */
export const Omgivelser = memo(function Omgivelser({ type, x, y, w, h, P, seed = 3 }: { type: Omgivelse; x: number; y: number; w: number; h: number; P: number; seed?: number }) {
  const id = useSvgId('kr-omg');
  const ss = useStrokeScale();
  const g = omgivelseGeo(type, y, h);
  const wallTop = type === 'tak' ? g.tak : y;
  const x2 = x + w;
  return (
    <g aria-hidden>
      {/* Veggen: lysere oppe, der lyset kommer fra */}
      <LinearGradient
        id={`${id}v`}
        stops={[
          [0, tint(SCENE.wall, 0.12)],
          [1, shade(SCENE.wall, 0.1)],
        ]}
      />
      <rect x={x} y={wallTop} width={w} height={g.bak - wallTop} fill={`url(#${id}v)`} />
      {/* Mykt lys på veggen fra en lampe utenfor bildet */}
      <RadialGradient
        id={`${id}l`}
        cx={0.3}
        cy={0.25}
        r={0.6}
        stops={[
          [0, SCENE.highlight, 0.35],
          [1, SCENE.highlight, 0],
        ]}
      />
      <rect x={x} y={wallTop} width={w} height={g.bak - wallTop} fill={`url(#${id}l)`} />
      {type === 'kjokken' && <Fliser x={x} y={y} w={w} bunn={g.bak} P={P} />}
      {type === 'gulv' && <Fotlist x={x} w={w} bunn={g.bak} P={P} />}
      {type === 'tak' && <Himling x={x} y={y} w={w} tak={g.tak} P={P} />}
      {(type === 'lab' || type === 'kjokken') && <Benkeplate type={type} x={x} x2={x2} g={g} bunn={y + h} seed={seed} />}
      {type === 'gulv' && <Tregulv x={x} x2={x2} g={g} bunn={y + h} P={P} seed={seed} />}
      {/* Myk skygge der veggen møter flaten */}
      {type !== 'tak' && <rect x={x} y={g.bak - 6 * ss} width={w} height={6 * ss} fill={SCENE.shadow} opacity={0.18} />}
    </g>
  );
});

/** Hvite veggfliser (15 × 15 cm) med fuger over kjøkkenbenken. */
function Fliser({ x, y, w, bunn, P }: { x: number; y: number; w: number; bunn: number; P: number }) {
  const ss = useStrokeScale();
  const id = useSvgId('kr-flis');
  const s = Math.max(24, 0.15 * P);
  const flis = mix(PAINTS.hvit, SCENE.wall, 0.35);
  const lines: string[] = [];
  for (let yy = bunn - s; yy > y - 1; yy -= s) lines.push(`M${r2(x)} ${r2(yy)}H${r2(x + w)}`);
  for (let xx = x + ((w / 2) % s); xx < x + w; xx += s) lines.push(`M${r2(xx)} ${r2(y)}V${r2(bunn)}`);
  return (
    <g>
      <LinearGradient
        id={id}
        x2={1}
        y2={1}
        stops={[
          [0, tint(flis, 0.15)],
          [1, flis],
        ]}
      />
      <rect x={x} y={y} width={w} height={bunn - y} fill={`url(#${id})`} />
      <path d={lines.join('')} stroke={shade(SCENE.wall, 0.18)} strokeWidth={1.6 * ss} opacity={0.55} />
      <path d={lines.join('')} stroke={tint(flis, 0.5)} strokeWidth={0.7 * ss} opacity={0.6} transform="translate(1.2 1.2)" />
    </g>
  );
}

/** Hvit fotlist (8 cm) nederst på veggen. */
function Fotlist({ x, w, bunn, P }: { x: number; w: number; bunn: number; P: number }) {
  const ss = useStrokeScale();
  const id = useSvgId('kr-list');
  const hList = Math.max(10, 0.08 * P);
  return (
    <g>
      <LinearGradient id={id} stops={materialStops(PAINTS.hvit, 0.8)} />
      <rect x={x} y={bunn - hList} width={w} height={hList} fill={`url(#${id})`} stroke={SCENE.outline} strokeWidth={0.6 * ss} />
      <rect x={x} y={bunn - hList} width={w} height={Math.max(2, hList * 0.12)} fill={tint(PAINTS.hvit, 0.4)} opacity={0.8} />
    </g>
  );
}

/** Himling sett litt nedenfra, med taklist der den møter veggen. */
function Himling({ x, y, w, tak, P }: { x: number; y: number; w: number; tak: number; P: number }) {
  const ss = useStrokeScale();
  const id = useSvgId('kr-tak');
  const list = Math.max(8, 0.05 * P);
  return (
    <g>
      <LinearGradient
        id={id}
        stops={[
          [0, shade(SCENE.wall, 0.06)],
          [1, tint(SCENE.wall, 0.3)],
        ]}
      />
      <rect x={x} y={y} width={w} height={tak - y} fill={`url(#${id})`} />
      {/* Taklist: hvit profil med skygge under */}
      <rect x={x} y={tak - list * 0.2} width={w} height={list} fill={tint(PAINTS.hvit, 0.1)} stroke={SCENE.outline} strokeWidth={0.6 * ss} />
      <rect x={x} y={tak + list * 0.35} width={w} height={list * 0.12} fill={shade(PAINTS.hvit, 0.12)} />
      <rect x={x} y={tak + list * 0.8} width={w} height={list * 0.5} fill={SCENE.shadow} opacity={0.12} />
    </g>
  );
}

/** Benkeplate: lys labbenk eller kjøkkenbenk i eik, sett litt ovenfra, med forkant. */
function Benkeplate({ type, x, x2, g, bunn, seed }: { type: 'lab' | 'kjokken'; x: number; x2: number; g: OmgivelseGeo; bunn: number; seed: number }) {
  const ss = useStrokeScale();
  const id = useSvgId('kr-benk');
  const tre = type === 'kjokken';
  const top = tre ? mix(SCENE.woodLight, SCENE.wood, 0.25) : SCENE.bench;
  const edge = tre ? SCENE.wood : SCENE.benchEdge;
  const grain = useMemo(() => {
    if (!tre) return '';
    const rnd = sceneRandom(seed * 31 + 7);
    let d = '';
    for (let i = 0; i < 9; i++) {
      const t = (i + 0.3 + 0.4 * rnd()) / 9;
      const yy = g.bak + (g.forkant - g.bak) * t * t * 0.95 + 2;
      const xs = x + rnd() * (x2 - x) * 0.3;
      const xe = x2 - rnd() * (x2 - x) * 0.3;
      d += `M${r2(xs)} ${r2(yy)}C${r2(xs + (xe - xs) * 0.3)} ${r2(yy - 2)} ${r2(xs + (xe - xs) * 0.7)} ${r2(yy + 2)} ${r2(xe)} ${r2(yy)}`;
    }
    return d;
  }, [tre, seed, g.bak, g.forkant, x, x2]);
  return (
    <g>
      <LinearGradient
        id={`${id}t`}
        stops={[
          [0, shade(top, 0.1)],
          [1, tint(top, 0.12)],
        ]}
      />
      <rect x={x} y={g.bak} width={x2 - x} height={g.forkant - g.bak} fill={`url(#${id}t)`} />
      {grain && <path d={grain} fill="none" stroke={shade(top, 0.22)} strokeWidth={1 * ss} opacity={0.5} />}
      {/* Forkanten (snittet) */}
      <LinearGradient id={`${id}f`} stops={materialStops(edge, 1.2)} />
      <rect x={x} y={g.forkant} width={x2 - x} height={Math.max(0, bunn - g.forkant)} fill={`url(#${id}f)`} />
      <line x1={x} y1={g.forkant} x2={x2} y2={g.forkant} stroke={tint(top, 0.35)} strokeWidth={1.4 * ss} />
    </g>
  );
}

/** Tregulv med bord parallelt med veggen; bordene blir bredere jo nærmere de er. */
function Tregulv({ x, x2, g, bunn, P, seed }: { x: number; x2: number; g: OmgivelseGeo; bunn: number; P: number; seed: number }) {
  const ss = useStrokeScale();
  const id = useSvgId('kr-gulv');
  const lines = useMemo(() => {
    const rnd = sceneRandom(seed * 17 + 3);
    let d = '';
    let joints = '';
    // Gulvbord på 14 cm sett skrått ovenfra: radene blir høyere nærmere kameraet.
    const row0 = Math.max(6, 0.035 * P);
    let yy = g.bak;
    let k = 0;
    while (yy < bunn && k < 40) {
      const hRow = row0 * (1 + 0.45 * k);
      yy += hRow;
      if (yy < bunn) d += `M${r2(x)} ${r2(yy)}H${r2(x2)}`;
      // Skjøter i bordene
      const jx = x + rnd() * (x2 - x);
      joints += `M${r2(jx)} ${r2(yy - hRow)}V${r2(Math.min(bunn, yy))}`;
      k++;
    }
    return { d, joints };
  }, [x, x2, g.bak, bunn, P, seed]);
  return (
    <g>
      <LinearGradient
        id={id}
        stops={[
          [0, shade(SCENE.floor, 0.12)],
          [1, tint(SCENE.floor, 0.06)],
        ]}
      />
      <rect x={x} y={g.bak} width={x2 - x} height={bunn - g.bak} fill={`url(#${id})`} />
      <path d={lines.d} stroke={SCENE.floorDark} strokeWidth={1.1 * ss} opacity={0.7} />
      <path d={lines.joints} stroke={SCENE.floorDark} strokeWidth={0.9 * ss} opacity={0.5} />
    </g>
  );
}

/* ---------------------------------------------------------------- Gjenstandene */

/** Gjenstanden av riktig type. */
export function Kildegjenstand({ type, x, y, P }: { type: KildeType; x: number; y: number; P: number }) {
  switch (type) {
    case 'skifer':
    case 'blybeholder':
    case 'medisinglass':
      return <Sample type={type} x={x} y={y} P={P} />;
    case 'vekkerklokke':
      return <Vekkerklokke x={x} y={y} P={P} />;
    case 'roykvarsler':
      return <Roykvarsler x={x} y={y} P={P} />;
    case 'ved':
      return <Bjorkeved x={x} y={y} P={P} />;
    case 'banan':
      return <Bananer x={x} y={y} P={P} />;
    case 'sopp':
      return <Steinsopper x={x} y={y} P={P} />;
    case 'kildeskive':
      return <Kildeskive x={x} y={y} P={P} />;
  }
}

/**
 * Gammel vekkerklokke med rød kasse, kromring, to klokker på toppen og urskive med selvlysende radiumtall og visere.
 * Kassen er 9 cm i diameter, og hele klokka er 14 cm høy.
 */
function Vekkerklokke({ x, y, P }: { x: number; y: number; P: number }) {
  const id = useSvgId('kr-klokke');
  const ss = useStrokeScale();
  const R = 0.045 * P;
  const cy = y - 0.012 * P - R;
  const rb = 0.022 * P;
  const lakk = mix(PAINTS.rod, SCENE.woodDark, 0.12);
  const bell = (side: -1 | 1) => {
    const a = (side * 42 * Math.PI) / 180;
    const d = R + 0.002 * P;
    const bx = x + d * Math.sin(a);
    const by = cy - d * Math.cos(a);
    const rot = side * 42;
    return (
      <g key={`b${side}`} transform={`rotate(${rot} ${r2(bx)} ${r2(by)})`}>
        <path
          d={`M${r2(bx - rb)} ${r2(by + rb * 0.15)}A${r2(rb)} ${r2(rb)} 0 0 1 ${r2(bx + rb)} ${r2(by + rb * 0.15)}Z`}
          fill={`url(#${id}m)`}
          stroke={SCENE.outline}
          strokeWidth={0.9 * ss}
        />
        <ellipse cx={bx - rb * 0.38} cy={by - rb * 0.45} rx={rb * 0.22} ry={rb * 0.12} fill={SCENE.highlight} opacity={0.7} transform={`rotate(-35 ${r2(bx - rb * 0.38)} ${r2(by - rb * 0.45)})`} />
        <rect x={bx - rb * 0.1} y={by - rb * 1.25} width={rb * 0.2} height={rb * 0.3} rx={rb * 0.05} fill={SCENE.metalDark} />
      </g>
    );
  };
  const leg = (side: -1 | 1) => {
    const a = (side * 38 * Math.PI) / 180;
    const lx = x + R * 0.92 * Math.sin(a);
    const ly = cy + R * 0.92 * Math.cos(a);
    const fx = x + side * R * 0.95;
    return (
      <path
        key={`l${side}`}
        d={`M${r2(lx - 0.006 * P)} ${r2(ly)}L${r2(fx - side * 0.004 * P)} ${r2(y)}H${r2(fx + side * 0.006 * P)}L${r2(lx + 0.006 * P)} ${r2(ly - 0.004 * P)}Z`}
        fill={SCENE.metal}
        stroke={SCENE.outline}
        strokeWidth={0.8 * ss}
        strokeLinejoin="round"
      />
    );
  };
  const hand = (deg: number, len: number, wid: number) => {
    const a = (deg * Math.PI) / 180;
    const ux = Math.sin(a);
    const uy = -Math.cos(a);
    const tx = x + ux * len;
    const ty = cy + uy * len;
    const bx = x - ux * len * 0.15;
    const by = cy - uy * len * 0.15;
    const nx = -uy * wid;
    const ny = ux * wid;
    const mx = x + ux * len * 0.55;
    const my = cy + uy * len * 0.55;
    return (
      <g>
        <polygon points={pts([[bx, by], [mx + nx, my + ny], [tx, ty], [mx - nx, my - ny]])} fill={PAINTS.svart} stroke={PAINTS.svart} strokeWidth={0.6 * ss} strokeLinejoin="round" />
        <polygon
          points={pts([
            [x + ux * len * 0.25, cy + uy * len * 0.25],
            [mx + nx * 0.55, my + ny * 0.55],
            [x + ux * len * 0.88, cy + uy * len * 0.88],
            [mx - nx * 0.55, my - ny * 0.55],
          ])}
          fill={LYSMALING}
        />
      </g>
    );
  };
  const dial = R * 0.82;
  const numbers: [string, number][] = [
    ['12', 0],
    ['3', 90],
    ['6', 180],
    ['9', 270],
  ];
  return (
    <g>
      <title>Gammel vekkerklokke med selvlysende radiumtall</title>
      <LinearGradient
        id={`${id}m`}
        x2={1}
        y2={1}
        stops={[
          [0, tint(SCENE.metalLight, 0.3)],
          [0.5, SCENE.metal],
          [1, shade(SCENE.metal, 0.3)],
        ]}
      />
      <RadialGradient
        id={`${id}k`}
        fx={0.35}
        fy={0.3}
        stops={[
          [0, tint(lakk, 0.3)],
          [0.6, lakk],
          [1, shade(lakk, 0.35)],
        ]}
      />
      <RadialGradient
        id={`${id}s`}
        fx={0.4}
        fy={0.35}
        stops={[
          [0, tint(mix(PAINTS.hvit, SCENE.woodLight, 0.28), 0.25)],
          [1, mix(PAINTS.hvit, SCENE.woodLight, 0.4)],
        ]}
      />
      <RadialGradient
        id={`${id}g`}
        stops={[
          [0, LYSMALING, 0.32],
          [1, LYSMALING, 0],
        ]}
      />
      <ContactShadow cx={x} cy={y} rx={R * 1.15} />
      {leg(-1)}
      {leg(1)}
      {/* Hammeren mellom klokkene og bøylen over */}
      <path
        d={`M${r2(x - R * 0.62)} ${r2(cy - R * 0.98)}Q${r2(x)} ${r2(cy - R * 1.95)} ${r2(x + R * 0.62)} ${r2(cy - R * 0.98)}`}
        fill="none"
        stroke={SCENE.outline}
        strokeWidth={0.009 * P + 1.2 * ss}
        strokeLinecap="round"
      />
      <path
        d={`M${r2(x - R * 0.62)} ${r2(cy - R * 0.98)}Q${r2(x)} ${r2(cy - R * 1.95)} ${r2(x + R * 0.62)} ${r2(cy - R * 0.98)}`}
        fill="none"
        stroke={`url(#${id}m)`}
        strokeWidth={0.009 * P}
        strokeLinecap="round"
      />
      {bell(-1)}
      {bell(1)}
      <line x1={x} y1={cy - R} x2={x} y2={cy - R - 0.016 * P} stroke={SCENE.metalDark} strokeWidth={0.004 * P} strokeLinecap="round" />
      <circle cx={x} cy={cy - R - 0.017 * P} r={0.004 * P} fill={SCENE.metalDark} />
      {/* Kassen, kromringen og urskiva */}
      <circle cx={x} cy={cy} r={R} fill={`url(#${id}k)`} stroke={SCENE.outline} strokeWidth={1 * ss} />
      <circle cx={x} cy={cy} r={R * 0.9} fill="none" stroke={`url(#${id}m)`} strokeWidth={R * 0.1} />
      <circle cx={x} cy={cy} r={dial} fill={`url(#${id}s)`} stroke={SCENE.outline} strokeWidth={0.7 * ss} />
      <circle cx={x} cy={cy} r={dial} fill={`url(#${id}g)`} />
      {Array.from({ length: 60 }, (_, i) => {
        const a = (i * 6 * Math.PI) / 180;
        const big = i % 5 === 0;
        const r0 = dial * (big ? 0.86 : 0.91);
        return (
          <line
            key={i}
            x1={r2(x + Math.sin(a) * r0)}
            y1={r2(cy - Math.cos(a) * r0)}
            x2={r2(x + Math.sin(a) * dial * 0.96)}
            y2={r2(cy - Math.cos(a) * dial * 0.96)}
            stroke={PAINTS.svart}
            strokeWidth={(big ? 1.4 : 0.6) * ss}
            opacity={big ? 0.85 : 0.5}
          />
        );
      })}
      {/* Selvlysende prikker ved hver time */}
      {Array.from({ length: 12 }, (_, i) => {
        const a = (i * 30 * Math.PI) / 180;
        return (
          <circle
            key={i}
            cx={r2(x + Math.sin(a) * dial * 0.76)}
            cy={r2(cy - Math.cos(a) * dial * 0.76)}
            r={dial * 0.055}
            fill={LYSMALING}
            stroke={shade(LYSMALING, 0.45)}
            strokeWidth={0.6 * ss}
          />
        );
      })}
      {numbers.map(([t, deg]) => {
        const a = (deg * Math.PI) / 180;
        const fs = dial * 0.22;
        return (
          <text
            key={t}
            x={r2(x + Math.sin(a) * dial * 0.56)}
            y={r2(cy - Math.cos(a) * dial * 0.56 + fs * 0.36)}
            textAnchor="middle"
            style={{ fill: PAINTS.svart, fontSize: fs, fontWeight: 700 }}
          >
            {t}
          </text>
        );
      })}
      {hand(300, dial * 0.5, dial * 0.07)}
      {hand(60, dial * 0.74, dial * 0.055)}
      <circle cx={x} cy={cy} r={dial * 0.06} fill={SCENE.metalDark} stroke={PAINTS.svart} strokeWidth={0.6 * ss} />
      {/* Refleks i glasset */}
      <path
        d={`M${r2(x - dial * 0.78)} ${r2(cy - dial * 0.2)}A${r2(dial * 0.82)} ${r2(dial * 0.82)} 0 0 1 ${r2(x - dial * 0.25)} ${r2(cy - dial * 0.78)}`}
        fill="none"
        stroke={SCENE.highlight}
        strokeWidth={dial * 0.06}
        strokeLinecap="round"
        opacity={0.45}
      />
    </g>
  );
}

/**
 * Røykvarsler (ioniserende type) i taket, sett litt nedenfra: hvit plastboks, 11 cm i diameter og 3,5 cm høy, med
 * luftspalter i sida og testknapp og lampe i bunnen. Ankerpunkt: midt på toppen, i taket.
 */
function Roykvarsler({ x, y, P }: { x: number; y: number; P: number }) {
  const id = useSvgId('kr-royk');
  const ss = useStrokeScale();
  const rTop = 0.055 * P;
  const rBot = 0.05 * P;
  const H = 0.035 * P;
  const ry = 0.014 * P;
  const plast = mix(PAINTS.hvit, SCENE.woodLight, 0.08);
  const yb = y + H;
  const slits = useMemo(() => {
    let d = '';
    const n = 15;
    for (let i = 1; i < n; i++) {
      const u = -1 + (2 * i) / n;
      // Spaltene sitter på en sylinder: tettere mot kantene
      const sx = Math.sin((u * Math.PI) / 2);
      const xx = x + sx * rBot * 0.97;
      d += `M${r2(xx)} ${r2(y + H * 0.42 + ry * 0.3 * Math.cos((u * Math.PI) / 2))}V${r2(y + H * 0.82 + ry * 0.75 * Math.cos((u * Math.PI) / 2))}`;
    }
    return d;
  }, [x, y, H, rBot, ry]);
  return (
    <g>
      <title>Røykvarsler i taket</title>
      <LinearGradient
        id={`${id}s`}
        x2={1}
        y2={0}
        stops={[
          [0, shade(plast, 0.08)],
          [0.3, tint(plast, 0.4)],
          [0.75, plast],
          [1, shade(plast, 0.2)],
        ]}
      />
      <RadialGradient
        id={`${id}b`}
        fx={0.4}
        fy={0.4}
        stops={[
          [0, tint(plast, 0.25)],
          [1, shade(plast, 0.12)],
        ]}
      />
      {/* Myk skygge i taket rundt sokkelen */}
      <ellipse cx={x + 0.004 * P} cy={y + 2} rx={rTop * 1.12} ry={Math.max(3, 0.006 * P)} fill={SCENE.shadow} opacity={0.22} />
      {/* Sokkel og sida */}
      <path
        d={`M${r2(x - rTop)} ${r2(y)}L${r2(x - rBot)} ${r2(yb)}A${r2(rBot)} ${r2(ry)} 0 0 0 ${r2(x + rBot)} ${r2(yb)}L${r2(x + rTop)} ${r2(y)}Z`}
        fill={`url(#${id}s)`}
        stroke={SCENE.outline}
        strokeWidth={1 * ss}
        strokeLinejoin="round"
      />
      <path d={slits} stroke={shade(plast, 0.42)} strokeWidth={Math.max(1.2 * ss, 0.0022 * P)} strokeLinecap="round" />
      <line x1={x - rTop} y1={y + H * 0.22} x2={x + rTop * 0.98} y2={y + H * 0.22} stroke={shade(plast, 0.15)} strokeWidth={0.8 * ss} />
      {/* Bunnen med testknapp og lampe */}
      <ellipse cx={x} cy={yb} rx={rBot} ry={ry} fill={`url(#${id}b)`} stroke={SCENE.outline} strokeWidth={1 * ss} />
      <ellipse cx={x} cy={yb + ry * 0.05} rx={rBot * 0.42} ry={ry * 0.42} fill={shade(plast, 0.06)} stroke={shade(plast, 0.3)} strokeWidth={0.8 * ss} />
      <ellipse cx={x - rBot * 0.08} cy={yb - ry * 0.08} rx={rBot * 0.2} ry={ry * 0.16} fill={tint(plast, 0.5)} opacity={0.7} />
      <circle cx={x + rBot * 0.66} cy={yb + ry * 0.2} r={Math.max(1.6, 0.0026 * P)} fill={PAINTS.rod} stroke={shade(PAINTS.rod, 0.4)} strokeWidth={0.5 * ss} />
    </g>
  );
}

/**
 * Vedkubbe av bjørk, 30 cm lang og 10 cm tykk, liggende på gulvet: hvit never med mørke korkporer og svarte flekker,
 * og endeveden med årringer og en tørkesprekk ut mot oss. Ankerpunkt: midt under kubben.
 */
function Bjorkeved({ x, y, P }: { x: number; y: number; P: number }) {
  const id = useSvgId('kr-ved');
  const ss = useStrokeScale();
  const L = 0.3 * P;
  const D = 0.1 * P;
  const er = 0.18 * D;
  const xl = x - L / 2;
  const xr = x + L / 2;
  const cy = y - D / 2;
  const never = mix(PAINTS.hvit, SCENE.woodLight, 0.18);
  const ved = mix(SCENE.woodLight, PAINTS.gul, 0.12);
  const marks = useMemo(() => {
    const rnd = sceneRandom(41);
    let pores = '';
    for (let i = 0; i < 46; i++) {
      const px = xl + er * 0.8 + rnd() * (L - er * 1.6);
      const py = y - D * (0.12 + rnd() * 0.8);
      const len = (0.012 + rnd() * 0.02) * P;
      pores += `M${r2(px)} ${r2(py)}h${r2(len)}`;
    }
    const blobs: { cx: number; cy: number; rx: number; ry: number }[] = [];
    for (let i = 0; i < 5; i++) blobs.push({ cx: xl + L * (0.18 + 0.17 * i + 0.05 * rnd()), cy: y - D * (0.3 + 0.45 * rnd()), rx: (0.006 + 0.01 * rnd()) * P, ry: (0.004 + 0.006 * rnd()) * P });
    return { pores, blobs };
  }, [xl, y, D, L, er, P]);
  const rings = [0.82, 0.64, 0.47, 0.31, 0.16];
  return (
    <g>
      <title>Vedkubbe av bjørk</title>
      <LinearGradient
        id={`${id}n`}
        stops={[
          [0, tint(never, 0.3)],
          [0.35, never],
          [1, shade(never, 0.3)],
        ]}
      />
      <RadialGradient
        id={`${id}e`}
        fx={0.45}
        fy={0.45}
        stops={[
          [0, shade(ved, 0.1)],
          [0.5, ved],
          [1, tint(ved, 0.1)],
        ]}
      />
      <ContactShadow cx={x} cy={y} rx={L * 0.55} />
      {/* Neveren langs kubben, med den bortre enden avrundet */}
      <path
        d={`M${r2(xl)} ${r2(y - D)}H${r2(xr - er)}A${r2(er)} ${r2(D / 2)} 0 0 1 ${r2(xr - er)} ${r2(y)}H${r2(xl)}Z`}
        fill={`url(#${id}n)`}
        stroke={SCENE.outline}
        strokeWidth={1 * ss}
        strokeLinejoin="round"
      />
      <path d={marks.pores} stroke={shade(SCENE.woodDark, 0.25)} strokeWidth={Math.max(1, 0.0028 * P)} strokeLinecap="round" opacity={0.75} />
      {marks.blobs.map((b, i) => (
        <ellipse key={i} cx={b.cx} cy={b.cy} rx={b.rx} ry={b.ry} fill={shade(SCENE.woodDark, 0.45)} opacity={0.85} />
      ))}
      {/* Endeveden mot oss */}
      <ellipse cx={xl} cy={cy} rx={er} ry={D / 2} fill={shade(never, 0.35)} stroke={SCENE.outline} strokeWidth={1 * ss} />
      <ellipse cx={xl} cy={cy} rx={er * 0.88} ry={D * 0.45} fill={`url(#${id}e)`} />
      {rings.map((k) => (
        <ellipse key={k} cx={xl + er * 0.06} cy={cy} rx={er * 0.88 * k} ry={D * 0.45 * k} fill="none" stroke={shade(ved, 0.25)} strokeWidth={0.7 * ss} opacity={0.75} />
      ))}
      <path d={`M${r2(xl + er * 0.05)} ${r2(cy)}L${r2(xl - er * 0.55)} ${r2(cy - D * 0.36)}`} stroke={shade(SCENE.woodDark, 0.2)} strokeWidth={1.1 * ss} strokeLinecap="round" />
    </g>
  );
}

/**
 * To bananer (19 cm) på benken, sett fra siden: gul skall med kanter langs frukta, brune sukkerprikker, grønnbrun
 * stilk og mørk spiss. Ankerpunkt: midt under den nærmeste bananen.
 */
function Bananer({ x, y, P }: { x: number; y: number; P: number }) {
  const id = useSvgId('kr-banan');
  const ss = useStrokeScale();
  const shape = (cx: number, by: number, L: number, T: number, sag: number) => {
    const n = 26;
    const top: [number, number][] = [];
    const bot: [number, number][] = [];
    const ridge: [number, number][] = [];
    for (let i = 0; i <= n; i++) {
      const u = i / n;
      const xx = cx - L / 2 + L * u;
      const yc = by - T / 2 - sag * (2 * u - 1) ** 2;
      const t = T * Math.pow(Math.sin(Math.PI * (0.04 + 0.92 * u)), 0.55);
      top.push([xx, yc - t / 2]);
      bot.push([xx, yc + t / 2]);
      ridge.push([xx, yc - t * 0.08]);
    }
    const d = `M${pts(top)} L${pts(bot.slice().reverse())}Z`;
    return { d, ridge: `M${pts(ridge.slice(3, n - 2))}`, top, bot };
  };
  const L = 0.19 * P;
  const T = 0.036 * P;
  const sag = 0.016 * P;
  const back = shape(x - 0.012 * P, y - 0.012 * P, L * 0.96, T * 0.95, sag);
  const front = shape(x, y, L, T, sag);
  const gul = mix(PAINTS.gul, SCENE.woodLight, 0.12);
  const spots = useMemo(() => {
    const rnd = sceneRandom(9);
    return Array.from({ length: 9 }, () => ({ u: 0.15 + 0.7 * rnd(), v: 0.2 + 0.6 * rnd(), r: (0.0015 + 0.002 * rnd()) * P }));
  }, [P]);
  const stalk = (b: ReturnType<typeof shape>, k: number) => {
    const p0 = b.top[0]!;
    const p1 = b.bot[0]!;
    const mx = (p0[0] + p1[0]) / 2;
    const my = (p0[1] + p1[1]) / 2;
    const sw = 0.009 * P * k;
    return (
      <path
        d={`M${r2(mx + 0.004 * P)} ${r2(my - sw * 0.6)}L${r2(mx - 0.022 * P * k)} ${r2(my - 0.012 * P * k - sw * 0.4)}L${r2(mx - 0.024 * P * k)} ${r2(my - 0.012 * P * k + sw * 0.6)}L${r2(mx + 0.004 * P)} ${r2(my + sw * 0.6)}Z`}
        fill={mix(PAINTS.gronn, SCENE.woodDark, 0.45)}
        stroke={SCENE.outline}
        strokeWidth={0.8 * ss}
        strokeLinejoin="round"
      />
    );
  };
  const tip = (b: ReturnType<typeof shape>) => {
    const p = b.top[b.top.length - 1]!;
    const q = b.bot[b.bot.length - 1]!;
    return <ellipse cx={(p[0] + q[0]) / 2} cy={(p[1] + q[1]) / 2} rx={0.004 * P} ry={0.0035 * P} fill={shade(SCENE.woodDark, 0.4)} />;
  };
  return (
    <g>
      <title>Bananer</title>
      <LinearGradient
        id={`${id}g`}
        stops={[
          [0, tint(gul, 0.3)],
          [0.45, gul],
          [1, shade(gul, 0.28)],
        ]}
      />
      <ContactShadow cx={x} cy={y} rx={L * 0.42} />
      <path d={back.d} fill={shade(gul, 0.12)} stroke={SCENE.outline} strokeWidth={0.9 * ss} strokeLinejoin="round" />
      {stalk(back, 0.9)}
      {tip(back)}
      <path d={front.d} fill={`url(#${id}g)`} stroke={SCENE.outline} strokeWidth={1 * ss} strokeLinejoin="round" />
      <path d={front.ridge} fill="none" stroke={tint(gul, 0.55)} strokeWidth={1.4 * ss} opacity={0.8} />
      <path d={front.ridge} fill="none" stroke={shade(gul, 0.25)} strokeWidth={0.8 * ss} opacity={0.6} transform={`translate(0 ${r2(0.004 * P)})`} />
      {spots.map((s, i) => {
        const k = Math.round(s.u * (front.top.length - 1));
        const a = front.top[k]!;
        const b = front.bot[k]!;
        return <circle key={i} cx={a[0]} cy={a[1] + (b[1] - a[1]) * s.v} r={s.r} fill={shade(SCENE.woodDark, 0.15)} opacity={0.55} />;
      })}
      {stalk(front, 1)}
      {tip(front)}
    </g>
  );
}

/**
 * To steinsopper fra skogen: brun, blank hatt med lysere kant, blek gul underside (rør) og en tykk, lys stilk med
 * nett øverst og litt jord nederst. Den store er 12 cm høy. Ankerpunkt: midt mellom soppene, på benken.
 */
function Steinsopper({ x, y, P }: { x: number; y: number; P: number }) {
  const id = useSvgId('kr-sopp');
  const ss = useStrokeScale();
  const brun = mix(SCENE.wood, SCENE.woodDark, 0.45);
  const stilk = mix(PAINTS.hvit, SCENE.woodLight, 0.45);
  const ror = mix(PAINTS.gul, PAINTS.hvit, 0.45);
  const one = (cx: number, H: number, cw: number, key: string) => {
    const capH = H * 0.36;
    const capBot = y - H + capH;
    const sTop = cw * 0.17;
    const sMid = cw * 0.27;
    const sBot = cw * 0.22;
    const stem = `M${r2(cx - sTop)} ${r2(capBot)}C${r2(cx - sTop)} ${r2(capBot + H * 0.25)} ${r2(cx - sMid * 1.15)} ${r2(y - H * 0.25)} ${r2(cx - sBot)} ${r2(y)}H${r2(cx + sBot)}C${r2(cx + sMid * 1.15)} ${r2(y - H * 0.25)} ${r2(cx + sTop)} ${r2(capBot + H * 0.25)} ${r2(cx + sTop)} ${r2(capBot)}Z`;
    const cap = `M${r2(cx - cw / 2)} ${r2(capBot)}C${r2(cx - cw / 2)} ${r2(capBot - capH * 1.25)} ${r2(cx + cw / 2)} ${r2(capBot - capH * 1.25)} ${r2(cx + cw / 2)} ${r2(capBot)}Q${r2(cx)} ${r2(capBot + capH * 0.22)} ${r2(cx - cw / 2)} ${r2(capBot)}Z`;
    const under = `M${r2(cx - cw / 2)} ${r2(capBot)}Q${r2(cx)} ${r2(capBot + capH * 0.42)} ${r2(cx + cw / 2)} ${r2(capBot)}Q${r2(cx)} ${r2(capBot + capH * 0.18)} ${r2(cx - cw / 2)} ${r2(capBot)}Z`;
    // Nett øverst på stilken
    let net = '';
    for (let i = 0; i < 5; i++) {
      const yy = capBot + H * (0.05 + 0.055 * i);
      net += `M${r2(cx - sTop * 0.9)} ${r2(yy)}Q${r2(cx)} ${r2(yy + H * 0.025)} ${r2(cx + sTop * 0.9)} ${r2(yy)}`;
    }
    return (
      <g key={key}>
        <path d={stem} fill={`url(#${id}s)`} stroke={SCENE.outline} strokeWidth={0.9 * ss} strokeLinejoin="round" />
        <path d={net} fill="none" stroke={shade(stilk, 0.25)} strokeWidth={0.7 * ss} opacity={0.7} />
        <ellipse cx={cx} cy={y - H * 0.02} rx={sBot * 1.05} ry={H * 0.035} fill={SCENE.soil} opacity={0.7} />
        <path d={under} fill={ror} stroke={shade(ror, 0.35)} strokeWidth={0.7 * ss} />
        <path d={cap} fill={`url(#${id}h)`} stroke={SCENE.outline} strokeWidth={1 * ss} strokeLinejoin="round" />
        <path
          d={`M${r2(cx - cw / 2 + cw * 0.04)} ${r2(capBot - capH * 0.08)}Q${r2(cx)} ${r2(capBot + capH * 0.1)} ${r2(cx + cw / 2 - cw * 0.04)} ${r2(capBot - capH * 0.08)}`}
          fill="none"
          stroke={tint(brun, 0.45)}
          strokeWidth={1.3 * ss}
          opacity={0.75}
        />
        <ellipse cx={cx - cw * 0.18} cy={capBot - capH * 0.68} rx={cw * 0.14} ry={capH * 0.12} fill={SCENE.highlight} opacity={0.35} transform={`rotate(-15 ${r2(cx - cw * 0.18)} ${r2(capBot - capH * 0.68)})`} />
      </g>
    );
  };
  return (
    <g>
      <title>Steinsopper</title>
      <LinearGradient
        id={`${id}s`}
        x2={1}
        y2={0}
        stops={[
          [0, tint(stilk, 0.25)],
          [0.5, stilk],
          [1, shade(stilk, 0.2)],
        ]}
      />
      <RadialGradient
        id={`${id}h`}
        fx={0.35}
        fy={0.25}
        r={0.65}
        stops={[
          [0, tint(brun, 0.28)],
          [0.65, brun],
          [1, shade(brun, 0.25)],
        ]}
      />
      <ContactShadow cx={x} cy={y} rx={0.085 * P} />
      {one(x - 0.045 * P, 0.075 * P, 0.065 * P, 'liten')}
      {one(x + 0.02 * P, 0.12 * P, 0.1 * P, 'stor')}
    </g>
  );
}

/**
 * Lukket strålekilde fra skolelaben: en plastskive (2,5 cm) med kilden som en liten metallflekk i midten, gul etikett
 * med faresymbolet og navnet, festet på en stang i en holder. Ankerpunkt: midt under foten.
 */
function Kildeskive({ x, y, P }: { x: number; y: number; P: number }) {
  const id = useSvgId('kr-skive');
  const ss = useStrokeScale();
  const r = 0.0125 * P;
  const cy = y - 0.0335 * P;
  const foot = 0.028 * P;
  const plast = mix(PAINTS.blaa, SCENE.metalDark, 0.35);
  return (
    <g>
      <title>Strålekilde med natrium-22</title>
      <LinearGradient
        id={`${id}m`}
        x2={1}
        y2={0}
        stops={[
          [0, shade(SCENE.metal, 0.2)],
          [0.35, tint(SCENE.metalLight, 0.3)],
          [1, shade(SCENE.metal, 0.3)],
        ]}
      />
      <RadialGradient
        id={`${id}p`}
        fx={0.35}
        fy={0.3}
        stops={[
          [0, tint(plast, 0.3)],
          [1, shade(plast, 0.25)],
        ]}
      />
      <ContactShadow cx={x} cy={y} rx={foot * 0.6} />
      {/* Fot og stang */}
      <rect x={x - foot / 2} y={y - 0.006 * P} width={foot} height={0.006 * P} rx={0.0015 * P} fill={SCENE.rubber} stroke={SCENE.outline} strokeWidth={0.8 * ss} />
      <rect x={x - 0.0018 * P} y={cy + r * 0.8} width={0.0036 * P} height={y - 0.006 * P - cy - r * 0.8} fill={`url(#${id}m)`} stroke={SCENE.outline} strokeWidth={0.6 * ss} />
      {/* Skiva */}
      <circle cx={x + 0.0012 * P} cy={cy + 0.0015 * P} r={r} fill={SCENE.shadow} opacity={0.3} />
      <circle cx={x} cy={cy} r={r} fill={`url(#${id}p)`} stroke={SCENE.outline} strokeWidth={1 * ss} />
      <circle cx={x} cy={cy} r={r * 0.78} fill={PAINTS.gul} stroke={shade(PAINTS.gul, 0.4)} strokeWidth={0.6 * ss} />
      <Faresymbol x={x} y={cy - r * 0.38} r={r * 0.3} bunn={false} />
      <circle cx={x} cy={cy + r * 0.05} r={r * 0.13} fill={SCENE.metalDark} stroke={PAINTS.svart} strokeWidth={0.5 * ss} />
      <circle cx={x - r * 0.04} cy={cy} r={r * 0.05} fill={tint(SCENE.metalLight, 0.5)} />
      <text x={x} y={cy + r * 0.52} textAnchor="middle" style={{ fill: PAINTS.svart, fontSize: r * 0.26, fontWeight: 700 }}>
        Na-22
      </text>
      <path
        d={`M${r2(x - r * 0.72)} ${r2(cy - r * 0.35)}A${r2(r * 0.8)} ${r2(r * 0.8)} 0 0 1 ${r2(x - r * 0.3)} ${r2(cy - r * 0.74)}`}
        fill="none"
        stroke={SCENE.highlight}
        strokeWidth={r * 0.08}
        strokeLinecap="round"
        opacity={0.5}
      />
    </g>
  );
}

/* ---------------------------------------------------------------- Lupa og partikler */

/**
 * Forstørrelsen: en avrundet ramme med mørk bunn (innsiden av stoffet), en liten ring på gjenstanden og stiplete
 * linjer fra ringen til rammen. `corners` er de to hjørnene på rammen linjene går til.
 */
export function Zoomlinjer({ spot, r, corners }: { spot: { x: number; y: number }; r: number; corners: [[number, number], [number, number]] }) {
  const ss = useStrokeScale();
  const [a, b] = corners;
  return (
    <g aria-hidden>
      <polygon points={pts([[spot.x, spot.y], a, b])} fill={alpha(SCENE.spaceGlow, 0.1)} />
      {[a, b].map((c, i) => (
        <g key={i}>
          <line x1={spot.x} y1={spot.y} x2={c[0]} y2={c[1]} stroke={SCENE.highlight} strokeWidth={3 * ss} opacity={0.5} />
          <line x1={spot.x} y1={spot.y} x2={c[0]} y2={c[1]} stroke={SCENE.outline} strokeWidth={1.2 * ss} strokeDasharray="5 4" opacity={0.75} />
        </g>
      ))}
      <circle cx={spot.x} cy={spot.y} r={r + 1.5 * ss} fill="none" stroke={SCENE.highlight} strokeWidth={3 * ss} opacity={0.7} />
      <circle cx={spot.x} cy={spot.y} r={r} fill={alpha(SCENE.spaceGlow, 0.25)} stroke={SCENE.outline} strokeWidth={1.6 * ss} />
    </g>
  );
}

/** Positron: liten kule i positronfargen med plusstegn (samme stil som Elektron i scene-kit-et). */
export function Positron({ x, y, r, color }: { x: number; y: number; r: number; color: string }) {
  const id = useSvgId('kr-pos');
  const ss = useStrokeScale();
  const s = r * 0.5;
  return (
    <g>
      <RadialGradient
        id={id}
        fx={0.36}
        fy={0.32}
        stops={[
          [0, tint(color, 0.45)],
          [0.55, color],
          [1, shade(color, 0.35)],
        ]}
      />
      <circle cx={x} cy={y} r={r} fill={`url(#${id})`} stroke={SCENE.outline} strokeWidth={0.8 * ss} />
      <path d={`M${r2(x - s)} ${r2(y)}h${r2(2 * s)}M${r2(x)} ${r2(y - s)}v${r2(2 * s)}`} stroke={SCENE.star} strokeWidth={Math.max(1.4 * ss, r * 0.2)} strokeLinecap="round" />
    </g>
  );
}

/** Nøytrino eller antinøytrino: nesten usynlig, så en liten, hul og stiplet ring. */
export function Noytrino({ x, y, r, color }: { x: number; y: number; r: number; color: string }) {
  const ss = useStrokeScale();
  return (
    <g>
      <circle cx={x} cy={y} r={r} fill={alpha(color, 0.12)} stroke={color} strokeWidth={1.6 * ss} strokeDasharray={`${r2(r * 0.5)} ${r2(r * 0.35)}`} />
    </g>
  );
}

/** Svak glød rundt en eksitert kjerne (har ekstra energi som sendes ut som γ). */
export function Eksitasjon({ x, y, R, color }: { x: number; y: number; R: number; color: string }) {
  const id = useSvgId('kr-eks');
  const ss = useStrokeScale();
  return (
    <g aria-hidden>
      <RadialGradient
        id={id}
        stops={[
          [0.55, color, 0.35],
          [1, color, 0],
        ]}
      />
      <circle cx={x} cy={y} r={R * 1.45} fill={`url(#${id})`} />
      <circle cx={x} cy={y} r={R + 7 * ss} fill="none" stroke={color} strokeWidth={1.8 * ss} strokeDasharray="5 5" />
    </g>
  );
}
