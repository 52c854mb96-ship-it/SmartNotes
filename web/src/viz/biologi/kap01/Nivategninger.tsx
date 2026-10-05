/**
 * Skjematiske tegninger av eksemplene på hvert organisasjonsnivå: ett fra menneskekroppen og ett fra en norsk granskog.
 * Hver tegning lages i et eget koordinatsystem på 360 × 220 og skaleres inn i panelet av komponenten. Tekst (etiketter,
 * størrelse og «enheten fra nivået under») leveres som koordinater og tegnes utenfor skaleringen, så den vokser riktig
 * på mobil. Tegningene er ikke i målestokk innbyrdes; den ekte størrelsen står ved hakeparentesen.
 */
import type { ReactNode } from 'react';
import {
  BIO,
  Bakterie,
  Celle,
  Cellekjerne,
  Fugl,
  Insekt,
  Kloroplast,
  Mitokondrie,
  Pattedyr,
  Plante,
  Sopp,
  VIZ,
  blobPath,
  seededRandom,
  useSvgId,
  type BioPaint,
} from '../kit';
import type { LevelId } from './model';

export const ART_W = 360;
export const ART_H = 220;

export interface ArtLabel {
  /** Punktet etiketten peker på (null = ingen strek). */
  at?: [number, number];
  /** Grunnlinjen til teksten. */
  x: number;
  y: number;
  text: string;
  anchor?: 'start' | 'middle' | 'end';
}

export interface Drawing {
  art: ReactNode;
  /** Hakeparentes som viser den ekte størrelsen: fra (x1, y1) til (x2, y2), etiketten på siden `side`. */
  bracket: { x1: number; y1: number; x2: number; y2: number; side: 'above' | 'below' | 'left' | 'right' };
  /** En enhet fra nivået under, markert med en stiplet ring. */
  unit?: { x: number; y: number; r: number; label: string; side: 'left' | 'right' | 'above' | 'below' };
  labels?: ArtLabel[];
}

export type Column = 'human' | 'forest';

/* ====================================================================== */
/* Hjelpere                                                                 */
/* ====================================================================== */

const pts = (list: [number, number][]) => list.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ');

/** Menneskesilhuett (forfra) med midtlinje x = cx, fra hodet (top) til føttene (top + 200). */
function bodyOutline(cx: number, top: number): { body: string; head: [number, number, number] } {
  // Høyre halvdel ovenfra og ned (dx, dy fra toppen), speiles til venstre halvdel
  const right: [number, number][] = [
    [7, 33],
    [7, 41],
    [28, 45],
    [38, 53],
    [44, 108],
    [45, 127],
    [40, 132],
    [35, 126],
    [31, 72],
    [28, 86],
    [29, 116],
    [25, 194],
    [24, 200],
    [9, 200],
    [7, 140],
    [0, 128],
  ];
  const r = right.map(([dx, dy]) => [cx + dx, top + dy] as [number, number]);
  const l = right
    .slice(0, -1)
    .reverse()
    .map(([dx, dy]) => [cx - dx, top + dy] as [number, number]);
  const all = [...r, ...l];
  return { body: `M${pts(all).replace(/ /g, ' L')} Z`, head: [cx, top + 16, 15] };
}

/** Gran med stamme og krone i lag, rundt midtlinjen cx med bakken i y = ground. */
function SpruceTree({ cx, ground, h, paint = BIO.plante, dim }: { cx: number; ground: number; h: number; paint?: BioPaint; dim?: boolean }) {
  const w = h * 0.42;
  const tiers = 5;
  const crownTop = ground - h;
  const crownBottom = ground - h * 0.12;
  const d: string[] = [];
  // Krone med fem lag (sagtakket kant), bredest nederst
  const left: [number, number][] = [[cx, crownTop]];
  const right: [number, number][] = [[cx, crownTop]];
  for (let i = 1; i <= tiers; i++) {
    const yOut = crownTop + ((crownBottom - crownTop) * i) / tiers;
    const half = (w / 2) * (0.35 + (0.65 * i) / tiers);
    const yIn = yOut - (crownBottom - crownTop) / tiers / 2.6;
    const halfIn = half * 0.62;
    right.push([cx + half, yOut], ...(i < tiers ? ([[cx + halfIn, yIn + (crownBottom - crownTop) / tiers / 2.6]] as [number, number][]) : []));
    left.push([cx - half, yOut], ...(i < tiers ? ([[cx - halfIn, yIn + (crownBottom - crownTop) / tiers / 2.6]] as [number, number][]) : []));
  }
  const outline = [...right, ...left.slice(1).reverse()];
  d.push(`M${pts(outline).replace(/ /g, ' L')} Z`);
  const trunkW = Math.max(3, h * 0.05);
  return (
    <g opacity={dim ? 0.35 : undefined}>
      <rect x={cx - trunkW / 2} y={crownBottom - 4} width={trunkW} height={ground - crownBottom + 4} fill={BIO.ved} />
      <path d={d[0]} fill={paint.fill} stroke={paint.line} strokeWidth={1.6} strokeLinejoin="round" />
    </g>
  );
}

/** Røtter under bakken (rotsystemet). */
function Roots({ cx, ground, size, dim }: { cx: number; ground: number; size: number; dim?: boolean }) {
  const rnd = seededRandom(5);
  const lines: string[] = [];
  for (let i = 0; i < 7; i++) {
    const a = (-0.9 + (1.8 * i) / 6) * (Math.PI / 2.2);
    const len = size * (0.7 + 0.3 * rnd());
    const x2 = cx + Math.sin(a) * len;
    const y2 = ground + Math.cos(a) * len * 0.45;
    const mx = cx + Math.sin(a) * len * 0.5;
    const my = ground + Math.cos(a) * len * 0.3;
    lines.push(`M${cx},${ground} Q${mx},${my + 4} ${x2},${y2}`);
    lines.push(`M${mx},${my} l${(rnd() - 0.5) * 18},${8 + rnd() * 8}`);
  }
  return <path d={lines.join(' ')} fill="none" stroke={BIO.ved} strokeWidth={2.2} strokeLinecap="round" opacity={dim ? 0.35 : 0.9} />;
}

/** Tverrsnitt av et stykke tykktarm: vegg med utposninger øverst og nederst, innhold i midten. */
function ColonSegment({ children, mucus }: { children?: ReactNode; mucus?: boolean }) {
  const n = 5;
  const seg = 340 / n;
  let lumen = 'M10,40';
  for (let i = 0; i < n; i++) lumen += ` Q${10 + seg * (i + 0.5)},16 ${10 + seg * (i + 1)},40`;
  lumen += ' L350,180';
  for (let i = 0; i < n; i++) lumen += ` Q${350 - seg * (i + 0.5)},204 ${350 - seg * (i + 1)},180`;
  lumen += ' Z';
  return (
    <g>
      {/* Tarmveggen */}
      <rect x={2} y={8} width={356} height={204} rx={26} fill={BIO.rodtBlodlegeme.fill} stroke={BIO.rodtBlodlegeme.line} strokeWidth={1.6} />
      <path d={lumen} fill={BIO.sopp.fill} stroke={BIO.rodtBlodlegeme.line} strokeWidth={1.4} />
      {mucus && <path d={lumen} fill="none" stroke={BIO.vakuole.line} strokeOpacity={0.45} strokeWidth={9} />}
      {children}
    </g>
  );
}

type Microbe = { x: number; y: number; rot: number; kind: number };

/** Mikrober spredt i tarminnholdet (fast frø). kinds = antall ulike arter. */
function microbes(n: number, kinds: number, seed: number): Microbe[] {
  const rnd = seededRandom(seed);
  const out: Microbe[] = [];
  const cols = Math.ceil(Math.sqrt(n * 2.6));
  const rows = Math.ceil(n / cols);
  for (let i = 0; i < n; i++) {
    const c = i % cols;
    const r = Math.floor(i / cols);
    out.push({
      x: 40 + ((c + 0.2 + 0.6 * rnd()) / cols) * 280,
      y: 58 + ((r + 0.2 + 0.6 * rnd()) / rows) * 104,
      rot: rnd() * 180,
      kind: Math.floor(rnd() * kinds),
    });
  }
  return out;
}

const MICROBE_KINDS: { form: 'stav' | 'kokk' | 'spiril'; paint: BioPaint }[] = [
  { form: 'stav', paint: BIO.bakterie },
  { form: 'kokk', paint: BIO.lysosom },
  { form: 'spiril', paint: BIO.fisk },
  { form: 'stav', paint: BIO.mitokondrie },
  { form: 'kokk', paint: BIO.golgi },
];

/** Planteceller i et fotosyntesevev (eller én celle når n = 1). */
function PlantCells({ cells }: { cells: { x: number; y: number; w: number; h: number; seed: number }[] }) {
  return (
    <g>
      {cells.map((c, i) => {
        const rnd = seededRandom(c.seed);
        const inner = { x: c.x + 4, y: c.y + 4, w: c.w - 8, h: c.h - 8 };
        const chl: [number, number, number][] = [];
        const per = 7;
        for (let k = 0; k < per; k++) {
          const t = (k + rnd() * 0.5) / per;
          // Kloroplastene ligger langs kanten (vakuolen tar midten)
          const perim = 2 * (inner.w + inner.h);
          let d = t * perim;
          let x: number;
          let y: number;
          let rot = 0;
          if (d < inner.w) {
            x = inner.x + d;
            y = inner.y + 5;
          } else if ((d -= inner.w) < inner.h) {
            x = inner.x + inner.w - 5;
            y = inner.y + d;
            rot = 90;
          } else if ((d -= inner.h) < inner.w) {
            x = inner.x + inner.w - d;
            y = inner.y + inner.h - 5;
          } else {
            d -= inner.w;
            x = inner.x + 5;
            y = inner.y + inner.h - d;
            rot = 90;
          }
          chl.push([x, y, rot]);
        }
        return (
          <g key={i}>
            <rect x={c.x} y={c.y} width={c.w} height={c.h} rx={7} fill={BIO.cellevegg.fill} stroke={BIO.cellevegg.line} strokeWidth={1.6} />
            <rect x={inner.x} y={inner.y} width={inner.w} height={inner.h} rx={5} fill={BIO.cytoplasma} stroke={BIO.membran} strokeWidth={1} />
            <rect
              x={inner.x + inner.w * 0.2}
              y={inner.y + inner.h * 0.24}
              width={inner.w * 0.6}
              height={inner.h * 0.52}
              rx={6}
              fill={BIO.vakuole.fill}
              stroke={BIO.vakuole.line}
              strokeWidth={0.8}
            />
            {chl.map(([x, y, rot], k) => (
              <ellipse
                key={k}
                cx={x}
                cy={y}
                rx={4.6}
                ry={2.6}
                transform={rot ? `rotate(${rot} ${x} ${y})` : undefined}
                fill={BIO.kloroplast.fill}
                stroke={BIO.kloroplast.line}
                strokeWidth={0.9}
              />
            ))}
          </g>
        );
      })}
    </g>
  );
}

/** Jorda med hav, kontinenter og et tynt lag (biosfæren). */
function Earth() {
  const clip = useSvgId('sn-earth');
  const cx = 180;
  const cy = 112;
  const r = 96;
  const lands = [
    blobPath(cx - 30, cy - 34, 40, 30, 0.25, 3, 9),
    blobPath(cx + 34, cy + 6, 26, 46, 0.22, 7, 9),
    blobPath(cx - 44, cy + 44, 26, 20, 0.25, 11, 8),
  ];
  return (
    <g>
      <circle cx={cx} cy={cy} r={r + 6} fill="none" stroke={BIO.plante.line} strokeOpacity={0.45} strokeWidth={5} />
      <circle cx={cx} cy={cy} r={r} fill={BIO.vannFyll} stroke={BIO.vann} strokeWidth={1.8} />
      <clipPath id={clip}>
        <circle cx={cx} cy={cy} r={r - 1} />
      </clipPath>
      <g clipPath={`url(#${clip})`}>
        {lands.map((d, i) => (
          <path key={i} d={d} fill={BIO.plante.fill} stroke={BIO.plante.line} strokeWidth={1.4} />
        ))}
        <ellipse cx={cx} cy={cy - r + 6} rx={46} ry={12} fill={VIZ.surface} opacity={0.8} />
      </g>
    </g>
  );
}

/** Utsnitt: innholdet klippes til et avrundet rektangel med tynn ramme. */
function ClippedBox({ x, y, w, h, children }: { x: number; y: number; w: number; h: number; children: ReactNode }) {
  const clip = useSvgId('sn-box');
  return (
    <g>
      <clipPath id={clip}>
        <rect x={x} y={y} width={w} height={h} rx={12} />
      </clipPath>
      <rect x={x} y={y} width={w} height={h} rx={12} fill={BIO.cytoplasma} />
      <g clipPath={`url(#${clip})`}>{children}</g>
      <rect x={x} y={y} width={w} height={h} rx={12} fill="none" stroke={VIZ.muted} strokeWidth={1.2} />
    </g>
  );
}

/** Sola med stråler. */
function Sun({ x, y, r }: { x: number; y: number; r: number }) {
  return (
    <g>
      {Array.from({ length: 10 }, (_, i) => {
        const a = (i / 10) * Math.PI * 2;
        return (
          <line
            key={i}
            x1={x + Math.cos(a) * (r + 4)}
            y1={y + Math.sin(a) * (r + 4)}
            x2={x + Math.cos(a) * (r + 11)}
            y2={y + Math.sin(a) * (r + 11)}
            stroke={BIO.sukker}
            strokeWidth={2}
            strokeLinecap="round"
          />
        );
      })}
      <circle cx={x} cy={y} r={r} fill={BIO.golgi.fill} stroke={BIO.sukker} strokeWidth={2} />
    </g>
  );
}

/** Sky med regn. */
function RainCloud({ x, y }: { x: number; y: number }) {
  return (
    <g>
      {[0, 1, 2, 3].map((i) => (
        <line
          key={i}
          x1={x - 18 + i * 12}
          y1={y + 14}
          x2={x - 22 + i * 12}
          y2={y + 26}
          stroke={BIO.vann}
          strokeWidth={2}
          strokeLinecap="round"
        />
      ))}
      <path
        d={`M${x - 28},${y + 8} Q${x - 34},${y - 6} ${x - 18},${y - 8} Q${x - 12},${y - 22} ${x + 4},${y - 14} Q${x + 22},${y - 20} ${x + 24},${y - 4} Q${x + 36},${y} ${x + 28},${y + 8} Z`}
        fill={VIZ.surface}
        stroke={VIZ.muted}
        strokeWidth={1.6}
      />
    </g>
  );
}

/* ====================================================================== */
/* Mennesket                                                                */
/* ====================================================================== */

function dna(): Drawing {
  const x0 = 24;
  const x1 = 336;
  const cy = 112;
  const A = 46;
  const period = 104;
  const strand = (phase: number) => {
    const p: [number, number][] = [];
    for (let x = x0; x <= x1; x += 3) p.push([x, cy + A * Math.sin(((x - x0) / period) * 2 * Math.PI + phase)]);
    return `M${pts(p).replace(/ /g, ' L')}`;
  };
  const rungs: ReactNode[] = [];
  for (let x = x0 + 6; x < x1; x += 11) {
    const a = ((x - x0) / period) * 2 * Math.PI;
    const y1 = cy + A * Math.sin(a);
    const y2 = cy + A * Math.sin(a + Math.PI);
    rungs.push(<line key={x} x1={x} y1={y1} x2={x} y2={y2} stroke={VIZ.muted} strokeWidth={2.4} strokeOpacity={0.55} />);
  }
  return {
    art: (
      <g>
        {rungs}
        <path d={strand(Math.PI)} fill="none" stroke={BIO.dna} strokeOpacity={0.55} strokeWidth={6} strokeLinecap="round" />
        <path d={strand(0)} fill="none" stroke={BIO.dna} strokeWidth={6} strokeLinecap="round" />
      </g>
    ),
    bracket: { x1: 12, y1: cy - A - 3, x2: 12, y2: cy + A + 3, side: 'left' },
    labels: [{ at: [x0 + period * 1.75, cy - 4], x: x0 + period * 1.75, y: 28, text: 'basepar', anchor: 'middle' }],
  };
}

function mitochondrion(): Drawing {
  return {
    art: <Mitokondrie x={180} y={112} w={270} h={118} rotate={-6} />,
    bracket: { x1: 48, y1: 196, x2: 312, y2: 196, side: 'below' },
    labels: [{ at: [150, 112], x: 150, y: 30, text: 'cristae (foldet indre membran)', anchor: 'middle' }],
  };
}

/** Hjertemuskelcelle: avlang, forgreinet i den ene enden, tverrstripet, med kjerne og rader av mitokondrier. */
function muscleCellPath(x: number, y: number, w: number, h: number): string {
  const r = h * 0.35;
  return [
    `M${x + r},${y}`,
    `L${x + w * 0.8},${y}`,
    // Enden deler seg i to korte greiner (hjertemuskelceller er forgreinet)
    `L${x + w},${y - h * 0.22}`,
    `L${x + w + 3},${y + h * 0.12}`,
    `L${x + w * 0.88},${y + h * 0.42}`,
    `L${x + w},${y + h * 0.6}`,
    `L${x + w - 1},${y + h}`,
    `L${x + r},${y + h}`,
    `Q${x},${y + h} ${x},${y + h - r}`,
    `L${x},${y + r}`,
    `Q${x},${y} ${x + r},${y}`,
    'Z',
  ].join(' ');
}

function MuscleCell({ x, y, w, h, detail }: { x: number; y: number; w: number; h: number; detail: boolean }) {
  const d = muscleCellPath(x, y, w, h);
  const stripes: ReactNode[] = [];
  for (let sx = x + 10; sx < x + w * 0.76; sx += detail ? 9 : 7)
    stripes.push(<line key={sx} x1={sx} y1={y + 3} x2={sx} y2={y + h - 3} stroke={BIO.rodtBlodlegeme.line} strokeOpacity={0.3} strokeWidth={detail ? 1.4 : 1} />);
  return (
    <g>
      <path d={d} fill={BIO.rodtBlodlegeme.fill} stroke={BIO.membran} strokeWidth={detail ? 2.4 : 1.6} strokeLinejoin="round" />
      {stripes}
      {detail && (
        <g>
          {[0.18, 0.32, 0.62, 0.72].map((u, i) =>
            [0.22, 0.78].map((v) => <Mitokondrie key={`${i}-${v}`} x={x + w * u} y={y + h * v} w={30} h={13} />),
          )}
          <Cellekjerne x={x + w * 0.47} y={y + h / 2} r={24} ry={15} />
        </g>
      )}
      {!detail && <ellipse cx={x + w * 0.42} cy={y + h / 2} rx={w * 0.09} ry={h * 0.22} fill={BIO.kjerne.fill} stroke={BIO.kjerne.line} strokeWidth={1.2} />}
    </g>
  );
}

function muscleCell(): Drawing {
  return {
    art: <MuscleCell x={22} y={70} w={300} h={84} detail />,
    bracket: { x1: 22, y1: 186, x2: 328, y2: 186, side: 'below' },
    unit: { x: 22 + 300 * 0.18, y: 70 + 84 * 0.22, r: 22, label: 'mitokondrie', side: 'above' },
  };
}

function muscleTissue(): Drawing {
  const cells: ReactNode[] = [];
  const rows = [18, 62, 106, 150];
  rows.forEach((y, r) => {
    for (let c = -1; c < 4; c++) {
      const x = c * 112 + (r % 2 ? 56 : 0) + 8;
      cells.push(<MuscleCell key={`${r}-${c}`} x={x} y={y} w={100} h={36} detail={false} />);
    }
  });
  return {
    art: <ClippedBox x={4} y={10} w={352} h={186}>{cells}</ClippedBox>,
    bracket: { x1: 4, y1: 212, x2: 356, y2: 212, side: 'below' },
    unit: { x: 8 + 112 + 50, y: 62 + 18, r: 50, label: 'én celle', side: 'right' },
  };
}

/**
 * Hjertet sett forfra (personens venstre side er til høyre i bildet): spissen peker ned mot høyre, øvre hulvene (blå)
 * kommer inn på høyre side av hjertet (til venstre i bildet), aortabuen (rød) bøyer seg over mot venstre side (til høyre
 * i bildet), og lungepulsåren (blå, oksygenfattig blod) går opp foran og under aortabuen.
 */
function heart(): Drawing {
  const body = 'M118,88 C96,118 122,178 206,212 C248,180 270,138 258,98 C250,70 214,62 190,76 C164,62 134,66 118,88 Z';
  return {
    art: (
      <g strokeLinecap="round" fill="none">
        <path d="M126,94 L122,22" stroke={BIO.oksygenfattig} strokeWidth={15} />
        <path d="M192,28 L186,8 M210,23 L210,4 M228,27 L236,9" stroke={BIO.oksygenrikt} strokeWidth={7} />
        <path d="M182,88 C178,40 192,21 214,22 C238,23 250,40 250,84" stroke={BIO.oksygenrikt} strokeWidth={14} />
        <path d="M204,92 Q204,60 230,54 Q246,50 264,54" stroke={BIO.oksygenfattig} strokeWidth={13} />
        <path d={body} fill={BIO.rodtBlodlegeme.fill} stroke={BIO.rodtBlodlegeme.line} strokeWidth={2.2} strokeLinejoin="round" />
        {/* Skillet mellom hjertekamrene og en kransarterie */}
        <path d="M214,82 Q220,150 206,208" stroke={BIO.rodtBlodlegeme.line} strokeWidth={1.4} strokeDasharray="5 4" />
        <path d="M130,108 Q172,130 244,116" stroke={BIO.oksygenrikt} strokeWidth={2.4} />
      </g>
    ),
    bracket: { x1: 300, y1: 64, x2: 300, y2: 212, side: 'right' },
    unit: { x: 146, y: 150, r: 20, label: 'muskelvev', side: 'left' },
  };
}

function Body({ cx, top, paint, vessels }: { cx: number; top: number; paint: BioPaint; vessels?: boolean }) {
  const { body, head } = bodyOutline(cx, top);
  const v = (dx: number, side: 1 | -1) => {
    const x = (d: number) => cx + side * (d + dx);
    // Fra hjertet (litt til venstre i kroppen, altså til høyre i bildet) ut til armene, hodet og beina
    const h = cx + 5 + dx;
    return `M${h},${top + 78} L${x(4)},${top + 52} L${x(38)},${top + 64} L${x(41)},${top + 122} M${x(4)},${top + 52} L${cx + dx},${top + 18} M${h},${top + 78} L${x(10)},${top + 126} L${x(16)},${top + 196}`;
  };
  return (
    <g>
      <path d={body} fill={paint.fill} stroke={paint.line} strokeWidth={1.8} strokeLinejoin="round" />
      <circle cx={head[0]} cy={head[1]} r={head[2]} fill={paint.fill} stroke={paint.line} strokeWidth={1.8} />
      {vessels && (
        <g fill="none" strokeLinejoin="round" strokeLinecap="round">
          <path d={`${v(-2, 1)} ${v(-2, -1)}`} stroke={BIO.oksygenfattig} strokeWidth={2.4} />
          <path d={`${v(2, 1)} ${v(2, -1)}`} stroke={BIO.oksygenrikt} strokeWidth={2.4} />
          <path
            d={`M${cx - 2},${top + 72} Q${cx - 4},${top + 86} ${cx + 8},${top + 94} Q${cx + 16},${top + 84} ${cx + 12},${top + 71} Q${cx + 5},${top + 64} ${cx - 2},${top + 72} Z`}
            fill={BIO.rodtBlodlegeme.fill}
            stroke={BIO.oksygenrikt}
            strokeWidth={2}
          />
        </g>
      )}
    </g>
  );
}

function circulatory(): Drawing {
  return {
    art: <Body cx={180} top={12} paint={{ fill: VIZ.surface, line: VIZ.muted }} vessels />,
    bracket: { x1: 250, y1: 12, x2: 250, y2: 212, side: 'right' },
    unit: { x: 185, y: 95, r: 17, label: 'hjertet', side: 'left' },
    labels: [
      { at: [222, 76], x: 300, y: 70, text: 'arterier', anchor: 'start' },
      { at: [169, 172], x: 120, y: 186, text: 'vener', anchor: 'end' },
    ],
  };
}

function human(): Drawing {
  return {
    art: <Body cx={180} top={12} paint={BIO.menneske} />,
    bracket: { x1: 250, y1: 12, x2: 250, y2: 212, side: 'right' },
    unit: { x: 180, y: 92, r: 30, label: 'organsystemer', side: 'left' },
  };
}

function gut(level: 'populasjon' | 'samfunn' | 'okosystem'): Drawing {
  const kinds = level === 'populasjon' ? 1 : 5;
  const list = microbes(level === 'okosystem' ? 26 : 32, kinds, level === 'populasjon' ? 4 : 9);
  const food: ReactNode[] = [];
  if (level === 'okosystem') {
    const rnd = seededRandom(13);
    for (let i = 0; i < 9; i++) {
      const x = 44 + rnd() * 270;
      const y = 62 + rnd() * 96;
      food.push(
        <path
          key={i}
          d={`M${x},${y} q8,-6 16,0 t14,2`}
          fill="none"
          stroke={BIO.plante.line}
          strokeWidth={3.2}
          strokeLinecap="round"
          opacity={0.75}
        />,
      );
    }
  }
  const pick = list.find((b) => b.x > 120 && b.x < 240 && b.y < 110) ?? list[0]!;
  const unit = level === 'populasjon' ? { x: pick.x, y: pick.y, r: 16, label: 'ett individ', side: 'above' as const } : undefined;
  // Mikroben av hver art som ligger nærmest etiketten, så strekene ikke krysser hverandre
  const of = (kind: number, lx: number) =>
    list
      .filter((b) => b.kind === kind)
      .sort((a, b) => Math.abs(a.x - lx) + 0.4 * a.y - (Math.abs(b.x - lx) + 0.4 * b.y))[0] ?? list[0]!;
  return {
    art: (
      <ColonSegment mucus={level === 'okosystem'}>
        {food}
        {list.map((b, i) => {
          const k = MICROBE_KINDS[b.kind]!;
          return <Bakterie key={i} x={b.x} y={b.y} size={22} rotate={b.rot} form={k.form} paint={k.paint} />;
        })}
      </ColonSegment>
    ),
    bracket: { x1: 4, y1: 214, x2: 356, y2: 214, side: 'below' },
    unit,
    labels:
      level === 'okosystem'
        ? [
            { at: [70, 46], x: 60, y: -4, text: 'slim', anchor: 'middle' },
            { at: [300, 120], x: 290, y: -4, text: 'fiber fra maten', anchor: 'middle' },
          ]
        : level === 'samfunn'
          ? [
              { at: [of(0, 60).x, of(0, 60).y], x: 60, y: -4, text: 'stavbakterier', anchor: 'middle' },
              { at: [of(1, 180).x, of(1, 180).y], x: 180, y: -4, text: 'kokker', anchor: 'middle' },
              { at: [of(2, 300).x, of(2, 300).y], x: 300, y: -4, text: 'spiriller', anchor: 'middle' },
            ]
          : undefined,
  };
}

function earth(): Drawing {
  return {
    art: <Earth />,
    bracket: { x1: 84, y1: 214, x2: 276, y2: 214, side: 'below' },
    unit: { x: 148, y: 78, r: 26, label: 'ett økosystem', side: 'left' },
    labels: [{ at: [262, 50], x: 356, y: 18, text: 'tynt lag med liv', anchor: 'end' }],
  };
}

/* ====================================================================== */
/* Skogen                                                                   */
/* ====================================================================== */

function chlorophyll(): Drawing {
  const cx = 130;
  const cy = 92;
  const R = 46;
  const pent = (a: number) => {
    const px = cx + Math.cos(a) * R;
    const py = cy + Math.sin(a) * R;
    const list: [number, number][] = [];
    for (let i = 0; i < 5; i++) {
      const b = a + Math.PI + (i / 5) * Math.PI * 2;
      list.push([px + Math.cos(b) * 19, py + Math.sin(b) * 19]);
    }
    return `M${pts(list).replace(/ /g, ' L')} Z`;
  };
  const tail: [number, number][] = [];
  for (let i = 0; i <= 14; i++) tail.push([cx + 40 + i * 14, cy + 56 + i * 4 + (i % 2 ? -7 : 7)]);
  return {
    art: (
      <g strokeLinejoin="round">
        <circle cx={cx} cy={cy} r={R} fill="none" stroke={BIO.kloroplast.line} strokeWidth={2} />
        {[0, 1, 2, 3].map((i) => (
          <path key={i} d={pent(-Math.PI / 4 + (i * Math.PI) / 2)} fill={BIO.kloroplast.fill} stroke={BIO.kloroplast.line} strokeWidth={2} />
        ))}
        {[0, 1, 2, 3].map((i) => {
          const a = -Math.PI / 4 + (i * Math.PI) / 2;
          return <line key={i} x1={cx} y1={cy} x2={cx + Math.cos(a) * (R - 19)} y2={cy + Math.sin(a) * (R - 19)} stroke={BIO.kloroplast.line} strokeWidth={1.6} />;
        })}
        <circle cx={cx} cy={cy} r={11} fill={BIO.klorofyll} stroke={BIO.kloroplast.line} strokeWidth={1.6} />
        <path d={`M${cx + R * 0.7},${cy + R * 0.7} L${pts(tail).replace(/ /g, ' L')}`} fill="none" stroke={BIO.kloroplast.line} strokeWidth={2.4} strokeLinecap="round" />
      </g>
    ),
    bracket: { x1: cx - R - 19, y1: 14, x2: cx + R + 19, y2: 14, side: 'above' },
    labels: [
      { at: [cx, cy], x: 250, y: 60, text: 'magnesium (Mg)', anchor: 'start' },
      { at: [300, cy + 104], x: 300, y: 214, text: 'lang hale (fytol)', anchor: 'middle' },
    ],
  };
}

function chloroplast(): Drawing {
  return {
    art: <Kloroplast x={180} y={110} w={290} h={128} grana={5} rotate={-4} />,
    bracket: { x1: 36, y1: 200, x2: 324, y2: 200, side: 'below' },
    labels: [{ at: [180, 108], x: 180, y: 26, text: 'grana med klorofyll', anchor: 'middle' }],
  };
}

function needleCell(): Drawing {
  const box = { x: 40, y: 22, w: 280, h: 172 };
  const chl: [number, number, number][] = [
    [80, 52, 20],
    [140, 46, 0],
    [205, 48, -10],
    [262, 56, 25],
    [290, 110, 90],
    [262, 166, -25],
    [200, 172, 0],
    [130, 170, 10],
    [74, 160, -30],
  ];
  return {
    art: (
      <Celle type="plante" x={box.x} y={box.y} w={box.w} h={box.h} vakuole={0.5}>
        {chl.map(([x, y, r], i) => (
          <Kloroplast key={i} x={x} y={y} w={36} h={17} grana={2} rotate={r} />
        ))}
        <Cellekjerne x={88} y={108} r={22} />
      </Celle>
    ),
    bracket: { x1: box.x, y1: 210, x2: box.x + box.w, y2: 210, side: 'below' },
    unit: { x: 262, y: 56, r: 22, label: 'kloroplast', side: 'right' },
  };
}

function photosynthesisTissue(): Drawing {
  const cells: { x: number; y: number; w: number; h: number; seed: number }[] = [];
  const rnd = seededRandom(21);
  for (let r = 0; r < 3; r++)
    for (let c = 0; c < 5; c++) {
      const w = 58 + rnd() * 8;
      const h = 54 + rnd() * 8;
      cells.push({ x: 14 + c * 68 + (r % 2 ? 6 : 0) + rnd() * 3, y: 10 + r * 66 + rnd() * 4, w, h, seed: 30 + r * 5 + c });
    }
  const u = cells[6]!;
  return {
    art: (
      <g>
        <rect x={6} y={4} width={348} height={204} rx={12} fill={BIO.vannFyll} opacity={0.5} />
        <PlantCells cells={cells} />
      </g>
    ),
    bracket: { x1: 6, y1: 214, x2: 354, y2: 214, side: 'below' },
    unit: { x: u.x + u.w / 2, y: u.y + u.h / 2, r: 40, label: 'én celle', side: 'right' },
  };
}

function needle(): Drawing {
  // Nål med firkantet tverrsnitt (antydet av en midtlinje) fra kvisten til spissen
  const x0 = 40;
  const x1 = 336;
  const cy = 112;
  const half = (t: number) => (t < 0.05 ? 6 + t * 160 : t > 0.84 ? 14 * (1 - (t - 0.84) / 0.16) : 14);
  const upper: [number, number][] = [];
  const lower: [number, number][] = [];
  for (let i = 0; i <= 40; i++) {
    const t = i / 40;
    const x = x0 + (x1 - x0) * t;
    upper.push([x, cy - half(t)]);
    lower.push([x, cy + half(t)]);
  }
  const outline = `M${pts([...upper, ...lower.reverse()]).replace(/ /g, ' L')} Z`;
  const stomata: ReactNode[] = [];
  for (let i = 3; i < 33; i++) {
    const x = x0 + ((x1 - x0) * i) / 40;
    stomata.push(<circle key={i} cx={x} cy={cy + 6} r={1.6} fill={VIZ.surface} stroke={BIO.plante.line} strokeWidth={0.7} />);
  }
  return {
    art: (
      <g>
        <path d={`M${x0 - 30},${cy + 50} Q${x0 - 12},${cy + 20} ${x0 + 4},${cy + 2}`} fill="none" stroke={BIO.ved} strokeWidth={10} strokeLinecap="round" />
        <path d={outline} fill={BIO.plante.fill} stroke={BIO.plante.line} strokeWidth={2} strokeLinejoin="round" />
        <path d={`M${x0 + 4},${cy} L${x1 - 30},${cy}`} stroke={BIO.plante.line} strokeOpacity={0.5} strokeWidth={1.2} />
        {stomata}
      </g>
    ),
    bracket: { x1: x0, y1: 66, x2: x1, y2: 66, side: 'above' },
    unit: { x: x0 + 110, y: cy, r: 24, label: 'vev', side: 'below' },
    labels: [{ at: [x0 + 220, cy + 6], x: x0 + 236, y: 176, text: 'spalteåpninger', anchor: 'middle' }],
  };
}

function shoot(organism: boolean): Drawing {
  const ground = 166;
  return {
    art: (
      <g>
        <rect x={4} y={ground} width={352} height={52} rx={6} fill={BIO.ved} opacity={0.16} />
        <line x1={4} x2={356} y1={ground} y2={ground} stroke={BIO.ved} strokeWidth={2} />
        <Roots cx={180} ground={ground} size={92} dim={!organism} />
        <SpruceTree cx={180} ground={ground} h={156} />
      </g>
    ),
    bracket: { x1: 290, y1: ground - 156, x2: 290, y2: ground, side: 'right' },
    unit: organism
      ? { x: 180, y: ground - 70, r: 46, label: 'skuddsystemet', side: 'left' }
      : { x: 204, y: ground - 60, r: 15, label: 'organ: barnål', side: 'left' },
    labels: [{ at: [214, ground + 26], x: 260, y: ground + 44, text: 'rotsystemet', anchor: 'start' }],
  };
}

function forestScene(level: 'populasjon' | 'samfunn' | 'okosystem'): Drawing {
  const ground = 178;
  const rnd = seededRandom(level === 'populasjon' ? 2 : 6);
  const nTrees = level === 'populasjon' ? 9 : 6;
  const trees = Array.from({ length: nTrees }, (_, i) => ({
    x: 26 + (i + 0.5) * (308 / nTrees) + (rnd() - 0.5) * 12,
    h: 70 + rnd() * 70,
  }));
  const others =
    level === 'populasjon' ? null : (
      <g>
        <Plante x={58} y={ground - 10} size={22} />
        <Plante x={250} y={ground - 10} size={22} />
        <Sopp x={120} y={ground - 9} size={20} />
        <Pattedyr x={292} y={ground - 22} size={50} />
        <Insekt x={196} y={ground - 8} size={14} rotate={90} />
        <Fugl x={trees[2]!.x + 6} y={ground - trees[2]!.h * 0.62} size={20} />
        <Bakterie x={154} y={ground + 18} size={16} rotate={20} />
        <Sopp x={330} y={ground - 9} size={16} />
      </g>
    );
  const t0 = trees[1]!;
  const unit =
    level === 'populasjon' ? { x: t0.x, y: ground - t0.h / 2, r: Math.max(28, t0.h * 0.42), label: 'ett individ', side: 'above' as const } : undefined;
  return {
    art: (
      <g>
        {level === 'okosystem' && <rect x={4} y={ground} width={352} height={30} rx={6} fill={BIO.ved} opacity={0.22} />}
        {level === 'okosystem' && <Sun x={330} y={30} r={14} />}
        {level === 'okosystem' && <RainCloud x={60} y={26} />}
        <line x1={4} x2={356} y1={ground} y2={ground} stroke={BIO.ved} strokeWidth={2} />
        {trees.map((t, i) => (
          <SpruceTree key={i} cx={t.x} ground={ground} h={t.h} />
        ))}
        {others}
      </g>
    ),
    bracket: { x1: 4, y1: 212, x2: 356, y2: 212, side: 'below' },
    unit,
    labels:
      level === 'okosystem'
        ? [
            { at: [318, 42], x: 270, y: 30, text: 'lys', anchor: 'end' },
            { at: [72, 50], x: 112, y: 28, text: 'nedbør', anchor: 'start' },
            { x: 14, y: ground + 21, text: 'jord og næringsstoffer', anchor: 'start' },
          ]
        : level === 'samfunn'
          ? [
              { at: [292, ground - 22], x: 300, y: 70, text: 'elg', anchor: 'middle' },
              { at: [120, ground - 12], x: 110, y: 70, text: 'sopp', anchor: 'middle' },
              { at: [58, ground - 12], x: 40, y: 110, text: 'blåbær', anchor: 'middle' },
            ]
          : undefined,
  };
}

/* ====================================================================== */

export function drawing(id: LevelId, column: Column): Drawing {
  if (column === 'human') {
    switch (id) {
      case 'molekyl':
        return dna();
      case 'organell':
        return mitochondrion();
      case 'celle':
        return muscleCell();
      case 'vev':
        return muscleTissue();
      case 'organ':
        return heart();
      case 'organsystem':
        return circulatory();
      case 'organisme':
        return human();
      case 'populasjon':
      case 'samfunn':
      case 'okosystem':
        return gut(id);
      case 'biosfaere':
        return earth();
    }
  }
  switch (id) {
    case 'molekyl':
      return chlorophyll();
    case 'organell':
      return chloroplast();
    case 'celle':
      return needleCell();
    case 'vev':
      return photosynthesisTissue();
    case 'organ':
      return needle();
    case 'organsystem':
      return shoot(false);
    case 'organisme':
      return shoot(true);
    case 'populasjon':
    case 'samfunn':
    case 'okosystem':
      return forestScene(id);
    case 'biosfaere':
      return earth();
  }
}
