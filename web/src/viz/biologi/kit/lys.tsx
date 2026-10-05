/**
 * Lys og skygge for biologifigurene («illustrert realisme»): myke toninger som gir celler, organeller og organismer
 * volum, med lyset fra øvre venstre i hele figuren (også når en del er dreid). Fargene følger temaet (--bio-lys,
 * --bio-skygge, --bio-glans og --bio-mork i styles/viz.css), og toningene bygger på BIO-fargene, så betydningen beholdes.
 *
 *   const id = useSvgId('min-del');
 *   <VolumToning id={id} color={BIO.mitokondrie.fill} rx={30} ry={14} rotate={rotate} />
 *   <ellipse rx={30} ry={14} fill={`url(#${id})`} stroke={BIO.mitokondrie.line} />
 *
 * Ingen SVG-filtre: alt er toninger (én <radialGradient>/<linearGradient> per del) og vanlige former.
 */
import { mix } from '../../kit/scene/core';

/** Lys- og skyggefargene i temaet. `glans` og `mork` er gjennomsiktige og legges oppå en fylt form. */
export const LYS = {
  /** Fargen lyse partier tones mot (hvit i lyst tema, dempet lys i mørkt). */
  lys: 'var(--bio-lys)',
  /** Fargen skyggesiden tones mot. */
  skygge: 'var(--bio-skygge)',
  /** Gjennomsiktig glans (refleks) oppå en form. */
  glans: 'var(--bio-glans)',
  /** Gjennomsiktig skygge oppå en form. */
  mork: 'var(--bio-mork)',
} as const;

/**
 * Lysere utgave av en farge, mot lysfargen i temaet (0 = uendret, 1 = helt lys). Med `hue` (f.eks. kantfargen) tar lyset
 * farge fra den i mørkt tema, så lyse partier blir fargerike og ikke grå. I mørkt tema er lyset også svakere.
 */
export function lysere(color: string, k: number, hue?: string): string {
  const target = hue ? `color-mix(in oklab, ${LYS.lys}, ${hue} var(--bio-lys-farge, 0%))` : LYS.lys;
  const p = Math.round(Math.min(1, Math.max(0, Number.isFinite(k) ? k : 0)) * 1000) / 10;
  return `color-mix(in oklab, ${color}, ${target} calc(${p}% * var(--bio-lys-styrke, 1)))`;
}

/** Mørkere utgave av en farge, mot skyggefargen i temaet (0 = uendret, 1 = helt mørk). */
export function morkere(color: string, k: number): string {
  return mix(color, LYS.skygge, k);
}

/** Retningen mot lyset (fra øvre venstre i figuren) i det lokale koordinatsystemet til en del dreid `rotate` grader. */
export function lysRetning(rotate = 0): { x: number; y: number } {
  const a = (-(Number.isFinite(rotate) ? rotate : 0) * Math.PI) / 180;
  const gx = -0.6;
  const gy = -0.8;
  return { x: gx * Math.cos(a) - gy * Math.sin(a), y: gx * Math.sin(a) + gy * Math.cos(a) };
}

type Stop = [offset: number, color: string, opacity?: number];

function Stops({ stops }: { stops: Stop[] }) {
  return (
    <>
      {stops.map(([o, c, a], i) => (
        <stop key={i} offset={o} style={{ stopColor: c, stopOpacity: a ?? 1 }} />
      ))}
    </>
  );
}

const r2 = (v: number) => (Number.isFinite(v) ? Math.round(v * 100) / 100 : 0);

/** Fargetrinnene for en form med volum: lys topp mot øvre venstre, grunnfargen, og litt mørkere kant. */
export function volumStops(color: string, glans = 1, skygge = 1, kant?: string, hue?: string): Stop[] {
  return [
    [0, lysere(color, 0.62 * glans, hue)],
    [0.32, lysere(color, 0.24 * glans, hue)],
    [0.7, color],
    [1, kant ?? morkere(color, 0.2 * skygge)],
  ];
}

/** Fargetrinn for en liten kule (vesikkel, lipidhode, partikkel) i en `BoksToning`. */
export function kuleStops(color: string, hue?: string): Stop[] {
  return [
    [0, lysere(color, 0.7, hue)],
    [0.35, lysere(color, 0.25, hue)],
    [0.75, color],
    [1, morkere(color, 0.24)],
  ];
}

/**
 * Radiell toning for en avrundet form (ellipse, kapsel, blære) med halvaksene `rx`, `ry` rundt (cx, cy) i delens egne
 * koordinater. `rotate` er hvor mye delen er dreid, så lyset fortsatt kommer fra øvre venstre i figuren.
 */
export function VolumToning({
  id,
  color,
  rx,
  ry,
  cx = 0,
  cy = 0,
  rotate = 0,
  glans = 1,
  skygge = 1,
  kant,
  hue,
  stops,
}: {
  id: string;
  color: string;
  /** Fargen lyset tar i mørkt tema (vanligvis kantfargen). */
  hue?: string;
  rx: number;
  ry: number;
  cx?: number;
  cy?: number;
  rotate?: number;
  /** Hvor sterkt det lyse partiet er (1 = standard). */
  glans?: number;
  /** Hvor mørk kanten er (1 = standard). */
  skygge?: number;
  /** Egen farge ytterst i stedet for en mørkere grunnfarge. */
  kant?: string;
  /** Egne fargetrinn (overstyrer color/glans/skygge/kant). */
  stops?: Stop[];
}) {
  const RX = Math.max(0.5, Math.abs(rx) || 1);
  const RY = Math.max(0.5, Math.abs(ry) || 1);
  const k = RY / RX;
  const L = lysRetning(rotate);
  return (
    <defs>
      <radialGradient
        id={id}
        gradientUnits="userSpaceOnUse"
        cx={0}
        cy={0}
        r={r2(RX * 1.04)}
        fx={r2(L.x * RX * 0.44)}
        fy={r2(L.y * RX * 0.44)}
        gradientTransform={`translate(${r2(cx)} ${r2(cy)}) scale(1 ${r2(k * 1000) / 1000})`}
      >
        <Stops stops={stops ?? volumStops(color, glans, skygge, kant, hue)} />
      </radialGradient>
    </defs>
  );
}

/**
 * Radiell toning i formens egen boks (objectBoundingBox), for frie former der midtpunkt og størrelse ikke er kjent.
 * Lyset kommer fra øvre venstre i figuren når `rotate` er hvor mye formen er dreid.
 */
export function BoksToning({ id, rotate = 0, stops }: { id: string; rotate?: number; stops: Stop[] }) {
  const L = lysRetning(rotate);
  return (
    <defs>
      <radialGradient id={id} cx={0.5} cy={0.5} r={0.62} fx={r2(0.5 + L.x * 0.24)} fy={r2(0.5 + L.y * 0.24)}>
        <Stops stops={stops} />
      </radialGradient>
    </defs>
  );
}

/**
 * Fargeuavhengig glans og skygge som legges oppå en fylt form (samme form med `fill="url(#id)"`): lys flekk mot øvre
 * venstre, gjennomsiktig midt på og mørkere kant nede til høyre. Én toning holder for alle delene av en figur, uansett
 * farge (f.eks. smittestatus i en modell).
 */
export function GlansToning({ id, rotate = 0, styrke = 1 }: { id: string; rotate?: number; styrke?: number }) {
  const s = Math.max(0, Math.min(1.5, styrke));
  return (
    <BoksToning
      id={id}
      rotate={rotate}
      stops={[
        [0, LYS.glans, 0.95 * Math.min(1, s)],
        [0.4, LYS.glans, 0],
        [0.62, LYS.mork, 0],
        [1, LYS.mork, Math.min(1, s)],
      ]}
    />
  );
}

/**
 * Lineær toning på tvers av en sylinder eller et rør (kapsel, kanalprotein, granum): lys side, grunnfarge, skyggeside.
 * Retningen følger lyset (øvre venstre i figuren) for en del dreid `rotate` grader.
 */
export function SylinderToning({
  id,
  color,
  rotate = 0,
  akse = 'loddrett',
  glans = 1,
  skygge = 1,
  hue,
}: {
  id: string;
  color: string;
  /** Fargen lyset tar i mørkt tema (vanligvis kantfargen). */
  hue?: string;
  rotate?: number;
  /** Hvilken vei sylinderen ligger (i delens egne koordinater); toningen går på tvers av den. */
  akse?: 'loddrett' | 'vannrett' | 'fri';
  glans?: number;
  skygge?: number;
}) {
  const L = lysRetning(rotate);
  // På tvers av aksen: bare den delen av lysretningen som står vinkelrett på sylinderen
  let dx = akse === 'loddrett' ? Math.sign(L.x) || -1 : akse === 'vannrett' ? 0 : L.x;
  let dy = akse === 'vannrett' ? Math.sign(L.y) || -1 : akse === 'loddrett' ? 0 : L.y;
  const l = Math.hypot(dx, dy) || 1;
  dx /= l;
  dy /= l;
  return (
    <defs>
      <linearGradient id={id} x1={r2(0.5 + dx * 0.5)} y1={r2(0.5 + dy * 0.5)} x2={r2(0.5 - dx * 0.5)} y2={r2(0.5 - dy * 0.5)}>
        <Stops
          stops={[
            [0, lysere(color, 0.2 * glans, hue)],
            [0.22, lysere(color, 0.5 * glans, hue)],
            [0.5, color],
            [1, morkere(color, 0.26 * skygge)],
          ]}
        />
      </linearGradient>
    </defs>
  );
}
