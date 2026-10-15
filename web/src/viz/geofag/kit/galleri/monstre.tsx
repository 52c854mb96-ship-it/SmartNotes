/**
 * Galleri for fargene og mønstrene i geofag-kit-et (?galleri=geo-monstre): alle 25 mønstrene som lagruter med navn,
 * mønstrene i sammenheng (lagrekke, grunnfjell med intrusjoner, løsmasser i en dal, saltdiapir) og hver fargegruppe i
 * GEO der den brukes (jordas indre, magma og lava, vann og is, kart, prosesser, ressurser, datering, fare og tid).
 */
import { useTextScale } from '../../../kit/controls';
import { VIZ } from '../../../kit/colors';
import { Txt } from '../../../kit/txt';
import { fmt } from '../../../kit/format';
import { ContactShadow, ForceArrow, Himmel, LinearGradient, RadialGradient, SCENE, Terreng, alpha, materialStops, mix, sceneRandom, shade, tint, useSvgId } from '../../../kit/scene';
import { GEO, MAGMA_GLOD, MAGMA_GLOD_STOPP, type GeoPaint } from '../colors';
import { geoHoyde, useGeoScale, useGeoStroke } from '../felles';
import { LagFlate, LagMonstre, MONSTER_NAVN, useLagMonstre } from '../monstre';
import { MONSTER_IDS, type MonsterId } from '../typer';
import { Fargeprover, GalleryGrid, GalleryItem, type Fargeprove } from './felles';

type Fn = (x: number) => number;
const r2 = (v: number) => Math.round(v * 100) / 100;

/** Lukket sti mellom to kurver fra x0 til x1 (øvre kurve mot høyre, nedre tilbake). */
function baand(top: Fn, bunn: Fn, x0: number, x1: number, n = 36): string {
  const xs = Array.from({ length: n + 1 }, (_, i) => x0 + ((x1 - x0) * i) / n);
  const a = xs.map((x, i) => `${i ? 'L' : 'M'}${r2(x)} ${r2(top(x))}`).join('');
  const b = [...xs].reverse().map((x) => `L${r2(x)} ${r2(bunn(x))}`).join('');
  return `${a}${b}Z`;
}

function kurve(f: Fn, x0: number, x1: number, n = 36): string {
  return Array.from({ length: n + 1 }, (_, i) => {
    const x = x0 + ((x1 - x0) * i) / n;
    return `${i ? 'L' : 'M'}${r2(x)} ${r2(f(x))}`;
  }).join('');
}

interface Merke {
  /** Punktet etiketten peker på. */
  tx: number;
  ty: number;
  tekst: string;
}

/** Etiketter i en egen kolonne til høyre (x), med tynne streker til det de peker på; flyttes ned så de ikke overlapper. */
function Merkelapper({ x, items, top = 16, bunn = 254 }: { x: number; items: Merke[]; top?: number; bunn?: number }) {
  const f = useTextScale();
  const gap = 17 * 0.75 * f + 7;
  let prev = top - gap;
  const placed = [...items]
    .sort((a, b) => a.ty - b.ty)
    .map((m) => {
      const y = Math.max(m.ty + 4, prev + gap);
      prev = y;
      return { ...m, y };
    });
  // Går de ut nederst, skyves de opp igjen (men ikke over `top`)
  for (let i = placed.length - 1, limit = bunn; i >= 0; i--, limit -= gap) {
    const m = placed[i]!;
    m.y = Math.max(top, Math.min(m.y, limit, i < placed.length - 1 ? placed[i + 1]!.y - gap : limit));
  }
  return (
    <g>
      {placed.map((m) => (
        <g key={m.tekst}>
          <polyline points={`${m.tx},${m.ty} ${x - 14},${m.y - 4} ${x - 4},${m.y - 4}`} fill="none" stroke={VIZ.muted} strokeWidth={1.1} />
          <circle cx={m.tx} cy={m.ty} r={2.4} fill={VIZ.ink} stroke={VIZ.surface} strokeWidth={1} />
          <Txt x={x} y={m.y} anchor="start" size={0.75} weight={560}>
            {m.tekst}
          </Txt>
        </g>
      ))}
    </g>
  );
}

/* ---------------------------------------------------------------- Alle mønstrene */

function oversiktOppsett(f: number) {
  const cols = f > 1.3 ? 3 : 5;
  const rows = Math.ceil(MONSTER_IDS.length / cols);
  const swH = f > 1.3 ? 96 : 66;
  const font = 17 * 0.85 * f;
  const rowH = swH + font + 24;
  return { cols, rows, swH, rowH, font, h: Math.round(rows * rowH + 10) };
}

function OversiktInnhold({ f }: { f: number }) {
  const lag = useLagMonstre('oversikt');
  const { cols, swH, rowH, font } = oversiktOppsett(f);
  const cellW = 800 / cols;
  return (
    <>
      <LagMonstre id={lag.id} />
      {MONSTER_IDS.map((id, i) => {
        const x = (i % cols) * cellW + 10;
        const y = Math.floor(i / cols) * rowH + 8;
        const w = cellW - 20;
        return (
          <g key={id}>
            <rect x={x} y={y} width={w} height={swH} rx={6} {...lag.fyll(id)} strokeWidth={lag.kontur} />
            <Txt x={x + w / 2} y={y + swH + font + 5} size={0.85} weight={600}>
              {MONSTER_NAVN[id]}
            </Txt>
          </g>
        );
      })}
    </>
  );
}

/* ---------------------------------------------------------------- Mønstrene i sammenheng */

const dip = (c: number) => (x: number) => c - 0.05 * x;

function Lagrekke() {
  const lag = useLagMonstre('lagrekke');
  const gneisTopp: Fn = (x) => 207 + 6 * Math.sin(x / 21) - 0.02 * x;
  const kalkTopp: Fn = (x) => 70 - 0.05 * x + 2 * Math.sin(x / 30);
  const moreneTopp: Fn = (x) => 46 + 4 * Math.sin(x / 19 + 1);
  const torvTopp: Fn = (x) => Math.min(moreneTopp(x), 33 + 0.004 * (x - 232) ** 2);
  const W = 288;
  const overflate: Fn = (x) => (x > 190 && x < 276 ? torvTopp(x) : moreneTopp(x));
  const lagene: { type: MonsterId; top: Fn; bunn: Fn; x0?: number; x1?: number; tx: number }[] = [
    { type: 'gneis', top: gneisTopp, bunn: () => 262, tx: 250 },
    { type: 'konglomerat', top: dip(188), bunn: gneisTopp, tx: 262 },
    { type: 'sandstein', top: dip(158), bunn: dip(188), tx: 270 },
    { type: 'siltstein', top: dip(138), bunn: dip(158), tx: 274 },
    { type: 'leirskifer', top: dip(110), bunn: dip(138), tx: 274 },
    { type: 'kalkstein', top: kalkTopp, bunn: dip(110), tx: 274 },
    { type: 'morene', top: moreneTopp, bunn: kalkTopp, tx: 150 },
    { type: 'torv', top: torvTopp, bunn: moreneTopp, x0: 190, x1: 276, tx: 232 },
  ];
  return (
    <>
      <Himmel w={400} h={150} skyer={1} seed={3} />
      <rect x={W} y={0} width={400 - W} height={260} fill={VIZ.surface} />
      <LagMonstre id={lag.id} />
      {lagene.map((l) => (
        <LagFlate key={l.type} d={baand(l.top, l.bunn, l.x0 ?? 0, l.x1 ?? W)} type={l.type} monstre={lag.id} />
      ))}
      <path d={kurve(overflate, 0, W, 60)} fill="none" stroke={SCENE.grass} strokeWidth={4} strokeLinecap="round" />
      <Merkelapper
        x={304}
        items={lagene.map((l) => ({ tx: l.tx, ty: (l.top(l.tx) + l.bunn(l.tx)) / 2, tekst: MONSTER_NAVN[l.type] }))}
      />
    </>
  );
}

function ellipsePath(cx: number, cy: number, rx: number, ry: number): string {
  return `M${cx - rx} ${cy}A${rx} ${ry} 0 1 0 ${cx + rx} ${cy}A${rx} ${ry} 0 1 0 ${cx - rx} ${cy}Z`;
}

function Grunnfjell() {
  const lag = useLagMonstre('grunnfjell');
  const W = 288;
  const basaltNedreTopp: Fn = (x) => 44 + 2 * Math.sin(x / 25);
  const askeTopp: Fn = (x) => 37 + 1.5 * Math.sin(x / 30 + 1);
  const basaltTopp: Fn = (x) => 20 + 3 * Math.sin(x / 40);
  return (
    <>
      <Himmel w={400} h={60} skyer={0} />
      <rect x={W} y={0} width={400 - W} height={260} fill={VIZ.surface} />
      <LagMonstre id={lag.id} />
      <LagFlate points={[[0, 57], [W, 57], [W, 262], [0, 262]]} type="glimmerskifer" monstre={lag.id} />
      <LagFlate points={[[0, 118], [W, 92], [W, 110], [0, 136]]} type="marmor" monstre={lag.id} />
      <LagFlate points={[[0, 160], [W, 134], [W, 148], [0, 174]]} type="kvartsitt" monstre={lag.id} />
      <LagFlate d="M20 262C25 200 70 170 115 172S190 205 196 262Z" type="granitt" monstre={lag.id} />
      <LagFlate d="M214 262C216 222 240 200 262 204S288 222 288 230L288 262Z" type="gabbro" monstre={lag.id} />
      <g transform="rotate(18 152 182)">
        <LagFlate d={ellipsePath(152, 182, 26, 7)} type="malmsone" monstre={lag.id} lys={false} />
      </g>
      <LagFlate points={[[196, 262], [208, 262], [216, 57], [204, 57]]} type="diabas" monstre={lag.id} />
      <LagFlate d={baand(basaltNedreTopp, () => 57, 0, W)} type="basalt" monstre={lag.id} />
      <LagFlate d={baand(askeTopp, basaltNedreTopp, 0, W)} type="aske" monstre={lag.id} />
      <LagFlate d={baand(basaltTopp, askeTopp, 0, W)} type="basalt" monstre={lag.id} />
      <Merkelapper
        x={304}
        items={[
          { tx: 120, ty: basaltTopp(120) + 9, tekst: 'Basalt' },
          { tx: 60, ty: (askeTopp(60) + basaltNedreTopp(60)) / 2, tekst: 'Vulkansk aske' },
          { tx: 60, ty: 82, tekst: 'Glimmerskifer' },
          { tx: 262, ty: 104, tekst: 'Marmor' },
          { tx: 262, ty: 144, tekst: 'Kvartsitt' },
          { tx: 211, ty: 160, tekst: 'Diabas (gang)' },
          { tx: 152, ty: 182, tekst: 'Malmsone' },
          { tx: 100, ty: 222, tekst: 'Granitt' },
          { tx: 256, ty: 238, tekst: 'Gabbro' },
        ]}
      />
    </>
  );
}

function Losmasser() {
  const lag = useLagMonstre('losmasser');
  const W = 268;
  const R: Fn = (x) => (x < 120 ? 60 + 1.25 * x : 210 + 4 * Math.sin((x - 120) / 25));
  const M: Fn = (x) => R(x) - 12;
  const fra = (y: number) => (y + 12 - 60) / 1.25; // der morenen når høyden y på dalsida
  const torvTopp: Fn = (x) => Math.min(127, 116 + 0.006 * (x - 228) ** 2);
  const overflate: Fn = (x) => (x < 63.2 ? M(x) : x > 186 && x < 268 ? torvTopp(x) : 127);
  const ur: [number, number][] = [[8, M(8)], [100, 127], [63.2, 127]];
  for (let x = 63.2; x >= 8; x -= 5) ur.push([x, M(x)]);
  return (
    <>
      <Himmel w={400} h={150} skyer={1} seed={8} />
      <rect x={W} y={0} width={400 - W} height={260} fill={VIZ.surface} />
      <LagMonstre id={lag.id} />
      <LagFlate d={baand(R, () => 262, 0, W, 60)} type="gneis" monstre={lag.id} />
      <LagFlate d={baand(M, R, 0, W, 60)} type="morene" monstre={lag.id} />
      <LagFlate d={baand(() => 172, M, fra(172), W)} type="leire" monstre={lag.id} />
      <LagFlate d={ellipsePath(205, 186, 50, 8)} type="kvikkleire" monstre={lag.id} />
      <LagFlate d={baand(() => 150, (x) => Math.min(172, M(x)), fra(150), W)} type="breelv" monstre={lag.id} />
      <LagFlate d={baand(() => 140, (x) => Math.min(150, M(x)), fra(140), W)} type="grus" monstre={lag.id} />
      <LagFlate d={baand(() => 127, (x) => Math.min(140, M(x)), fra(127), W)} type="sand" monstre={lag.id} />
      <LagFlate d={baand(torvTopp, () => 127, 186, 268)} type="torv" monstre={lag.id} />
      <LagFlate points={ur} type="ur" monstre={lag.id} />
      <path d={kurve(overflate, 60, W, 60)} fill="none" stroke={SCENE.grass} strokeWidth={4} strokeLinecap="round" />
      <polyline points={`36,86 26,52 18,52`} fill="none" stroke={VIZ.muted} strokeWidth={1.1} />
      <circle cx={36} cy={86} r={2.4} fill={VIZ.ink} stroke={VIZ.surface} strokeWidth={1} />
      <Txt x={10} y={47} anchor="start" size={0.75} weight={560}>
        Ur
      </Txt>
      <Merkelapper
        x={282}
        items={[
          { tx: 230, ty: 122, tekst: 'Torv' },
          { tx: 150, ty: 133, tekst: 'Sand' },
          { tx: 150, ty: 145, tekst: 'Grus' },
          { tx: 140, ty: 161, tekst: 'Breelvavsetning' },
          { tx: 140, ty: 180, tekst: 'Leire (marin)' },
          { tx: 220, ty: 186, tekst: 'Kvikkleire' },
          { tx: 160, ty: R(160) - 6, tekst: 'Morene' },
          { tx: 150, ty: 238, tekst: 'Gneis (berggrunn)' },
        ]}
      />
    </>
  );
}

function Saltdiapir() {
  const lag = useLagMonstre('salt');
  const W = 288;
  const b: Fn = (x) => 30 * Math.exp(-(((x - 150) / 60) ** 2));
  const y = (c: number, k = 1) => (x: number) => c - k * b(x);
  const moreneTopp: Fn = (x) => 30 + 3 * Math.sin(x / 22);
  return (
    <>
      <Himmel w={400} h={60} skyer={0} />
      <rect x={W} y={0} width={400 - W} height={260} fill={VIZ.surface} />
      <LagMonstre id={lag.id} />
      <LagFlate d={baand(y(236, 0.4), () => 262, 0, W)} type="salt" monstre={lag.id} />
      <LagFlate d={baand(y(206), y(236, 0.4), 0, W)} type="sandstein" monstre={lag.id} />
      <LagFlate d={baand(y(160), y(206), 0, W)} type="siltstein" monstre={lag.id} />
      <LagFlate d={baand(y(172), y(179), 0, W)} type="kull" monstre={lag.id} lys={false} />
      <LagFlate d={baand(y(190), y(197), 0, W)} type="kull" monstre={lag.id} lys={false} />
      <LagFlate d={baand(y(120, 0.8), y(160), 0, W)} type="kalkstein" monstre={lag.id} />
      <LagFlate d={baand(y(40, 0.3), y(120, 0.8), 0, W)} type="leirskifer" monstre={lag.id} />
      <LagFlate d={baand(moreneTopp, y(40, 0.3), 0, W)} type="morene" monstre={lag.id} />
      <LagFlate d="M102 240C120 200 112 150 118 110C122 76 178 76 182 110C188 150 180 200 198 240Z" type="salt" monstre={lag.id} />
      <path d={kurve(moreneTopp, 0, W)} fill="none" stroke={SCENE.grass} strokeWidth={4} strokeLinecap="round" />
      <Merkelapper
        x={304}
        items={[
          { tx: 60, ty: 36, tekst: 'Morene' },
          { tx: 250, ty: 70, tekst: 'Leirskifer' },
          { tx: 250, ty: 130, tekst: 'Kalkstein' },
          { tx: 250, ty: 166, tekst: 'Siltstein' },
          { tx: 250, ty: 175, tekst: 'Kull' },
          { tx: 250, ty: 216, tekst: 'Sandstein' },
          { tx: 150, ty: 150, tekst: 'Salt (diapir)' },
        ]}
      />
    </>
  );
}

/* ---------------------------------------------------------------- Fargene i bruk */

function sektor(cx: number, cy: number, r: number, a0: number, a1: number): string {
  const p = (a: number) => `${r2(cx + r * Math.cos((a * Math.PI) / 180))} ${r2(cy - r * Math.sin((a * Math.PI) / 180))}`;
  return `M${cx} ${cy}L${p(a0)}A${r} ${r} 0 0 0 ${p(a1)}Z`;
}

function JordasIndre() {
  const glans = useSvgId('glans');
  const cx = 16;
  const cy = 252;
  const lagene: { paint: GeoPaint; r: number; a0?: number; a1?: number; navn: string; a: number }[] = [
    { paint: GEO.skorpeKontinent, r: 226, a0: 0, a1: 45, navn: 'Skorpe (kontinent)', a: 20 },
    { paint: GEO.skorpeHav, r: 220, a0: 45, a1: 90, navn: 'Skorpe (hav)', a: 70 },
    { paint: GEO.litosfare, r: 211, navn: 'Litosfære (mantel)', a: 45 },
    { paint: GEO.astenosfare, r: 196, navn: 'Astenosfære', a: 45 },
    { paint: GEO.nedreMantel, r: 165, navn: 'Nedre mantel', a: 45 },
    { paint: GEO.ytreKjerne, r: 110, navn: 'Ytre kjerne', a: 45 },
    { paint: GEO.indreKjerne, r: 58, navn: 'Indre kjerne', a: 45 },
  ];
  const mid = (i: number) => {
    const l = lagene[i]!;
    const inner = i < 2 ? 211 : (lagene[i + 1]?.r ?? 0);
    return (l.r + inner) / 2;
  };
  return (
    <>
      <RadialGradient id={glans} cx={0.05} cy={0.95} r={1} stops={[[0, SCENE.highlight, 0], [0.8, SCENE.highlight, 0], [0.96, SCENE.highlight, 0.7], [1, SCENE.shadow, 0.8]]} />
      {lagene.map((l) => (
        <path key={l.navn} d={sektor(cx, cy, l.r, l.a0 ?? 0, l.a1 ?? 90)} fill={l.paint.fill} stroke={l.paint.line} strokeWidth={1.3} strokeLinejoin="round" />
      ))}
      <path d={sektor(cx, cy, 226, 0, 90)} fill={`url(#${glans})`} opacity={0.6} />
      <Merkelapper
        x={262}
        items={lagene.map((l, i) => {
          const rr = mid(i);
          return { tx: cx + rr * Math.cos((l.a * Math.PI) / 180), ty: cy - rr * Math.sin((l.a * Math.PI) / 180), tekst: l.navn };
        })}
      />
    </>
  );
}

function MagmaOgLava() {
  const kjegle = useSvgId('kjegle');
  const kammer = useSvgId('kammer');
  const lava = useSvgId('lava');
  const grunn = useSvgId('grunn');
  return (
    <>
      <Himmel w={400} h={150} skyer={1} seed={5} />
      <LinearGradient id={grunn} stops={materialStops(GEO.skorpeKontinent.fill)} />
      <rect x={0} y={150} width={400} height={110} fill={`url(#${grunn})`} />
      <LinearGradient id={kjegle} x1={0} y1={0} x2={1} y2={0} stops={[[0, tint(GEO.bergart.basalt.fill, 0.15)], [0.55, GEO.bergart.basalt.fill], [1, shade(GEO.bergart.basalt.fill, 0.25)]]} />
      <path d="M50 151L168 56C176 50 182 58 190 58C198 58 204 50 212 56L340 151Z" fill={`url(#${kjegle})`} stroke={SCENE.outline} strokeWidth={1} />
      {/* Samme kanal og glød som Plategrense, Vulkan og SnittMagmakammer bruker (MAGMA_GLOD) */}
      <RadialGradient id={kammer} fx={0.45} fy={0.4} stops={MAGMA_GLOD_STOPP} />
      <path d="M184 205L196 205L195 58L186 58Z" fill={MAGMA_GLOD.kanal} stroke={GEO.magma.line} strokeWidth={1} />
      <ellipse cx={190} cy={222} rx={74} ry={24} fill={`url(#${kammer})`} stroke={GEO.magma.line} strokeWidth={1.4} />
      <RadialGradient id={lava} cx={0.3} cy={0.2} r={0.9} stops={[[0, tint(GEO.lava.fill, 0.45)], [0.5, GEO.lava.fill], [1, mix(GEO.lava.fill, GEO.lava.line, 0.5)]]} />
      <path d="M200 58C215 72 238 94 260 112S300 138 322 150L304 151C288 142 262 128 244 114S208 80 192 62Z" fill={`url(#${lava})`} stroke={GEO.lava.line} strokeWidth={1.4} strokeLinejoin="round" />
      {(
        [
          [190, 38, 15],
          [171, 26, 13],
          [211, 25, 14],
          [194, 12, 12],
          [228, 12, 10],
        ] as const
      ).map(([x, y, r]) => (
        <circle key={`${x}-${y}`} cx={x} cy={y} r={r} fill={GEO.aske.fill} stroke={GEO.aske.line} strokeWidth={1} />
      ))}
      <ForceArrow x1={110} y1={92} x2={110} y2={142} color={VIZ.gravity} label="G" />
      {/* G-pila rett ved en kanal og et kammer, som platetrekket ved kanalen i subduksjonsblokka */}
      <ForceArrow x1={150} y1={196} x2={176} y2={226} color={VIZ.gravity} label="F" labelX={148} labelY={190} />
      <rect x={300} y={176} width={84} height={24} rx={5} fill="var(--accent)" />
      <Txt x={342} y={193} size={0.7} weight={650} color="var(--on-accent)" halo={false}>
        Aksent
      </Txt>
      <Txt x={250} y={18} anchor="start" size={0.75}>
        Aske
      </Txt>
      <Txt x={286} y={112} anchor="start" size={0.75}>
        Lava
      </Txt>
      <Txt x={100} y={236} anchor="end" size={0.75}>
        Magma
      </Txt>
    </>
  );
}

function VannOgIs() {
  const grunnvann = useSvgId('gv');
  const bre = useSvgId('bre');
  const speil: Fn = (x) => 128 + 6 * Math.sin(x / 40);
  return (
    <>
      <Himmel w={400} h={200} skyer={1} seed={12} />
      {/* Jordsnitt: umettet sone over grunnvannsspeilet */}
      <rect x={0} y={70} width={190} height={190} fill={GEO.umettet.fill} />
      <LinearGradient id={grunnvann} stops={materialStops(GEO.grunnvann.fill, 0.8)} />
      <path d={baand(speil, () => 262, 0, 190)} fill={`url(#${grunnvann})`} />
      <path d={kurve(speil, 0, 190)} fill="none" stroke={GEO.grunnvann.line} strokeWidth={2.4} />
      <path d="M0 70H190V262" fill="none" stroke={GEO.umettet.line} strokeWidth={1.2} />
      <path d="M0 70H190" stroke={SCENE.grass} strokeWidth={5} strokeLinecap="round" />
      <Txt x={14} y={104} anchor="start" size={0.75}>
        Umettet sone
      </Txt>
      <Txt x={14} y={speil(14) - 8} anchor="start" size={0.7} color={GEO.grunnvann.line}>
        Grunnvannsspeil
      </Txt>
      <Txt x={14} y={200} anchor="start" size={0.75}>
        Mettet sone
      </Txt>
      {/* Bre som kalver i havet, med firn øverst og havis på sjøen */}
      <rect x={200} y={196} width={200} height={66} fill={SCENE.water} />
      <path d="M200 196H400" stroke={SCENE.waterLight} strokeWidth={2} />
      <path d="M200 58C242 68 292 124 322 200L314 262H200Z" fill={SCENE.stoneDark} stroke={SCENE.outline} strokeWidth={1} />
      <LinearGradient id={bre} x1={0} y1={0} x2={1} y2={1} stops={[[0, tint(GEO.bre.fill, 0.35)], [1, shade(GEO.bre.fill, 0.1)]]} />
      <path d="M200 34C250 38 304 92 340 162L342 199L321 199C292 124 242 68 200 58Z" fill={`url(#${bre})`} stroke={GEO.bre.line} strokeWidth={1.4} strokeLinejoin="round" />
      <path d="M200 34C224 35 250 46 274 66C248 58 224 52 200 50Z" fill={GEO.firn.fill} stroke={GEO.firn.line} strokeWidth={1.2} strokeLinejoin="round" />
      <path d="M292 100l9 -5M304 117l10 -5M315 134l10 -4M326 152l10 -3" stroke={GEO.bre.line} strokeWidth={1.4} strokeLinecap="round" />
      {(
        [
          [346, 22],
          [374, 14],
        ] as const
      ).map(([x, w]) => (
        <path key={x} d={`M${x} 194L${x + w} 193L${x + w - 2} 199L${x + 2} 199Z`} fill={GEO.havis.fill} stroke={GEO.havis.line} strokeWidth={1.1} />
      ))}
      <Txt x={212} y={26} anchor="start" size={0.75}>
        Firn
      </Txt>
      <Txt x={268} y={108} anchor="middle" size={0.75}>
        Bre
      </Txt>
      <Txt x={392} y={224} anchor="end" size={0.75}>
        Havis
      </Txt>
    </>
  );
}

function Kart() {
  const k = useGeoStroke();
  const f = useTextScale();
  const kart = useSvgId('kart');
  const hills = [
    { cx: 120, cy: 110, rx: 125, ry: 92 },
    { cx: 238, cy: 172, rx: 74, ry: 58 },
  ];
  const levels = [0, 1, 2, 3, 4, 5];
  const legendRow = 17 * 0.72 * f + 8;
  return (
    <>
      <defs>
        <clipPath id={kart}>
          <rect x={0} y={0} width={292} height={260} />
        </clipPath>
      </defs>
      <g clipPath={`url(#${kart})`}>
        <rect x={0} y={0} width={292} height={260} fill={GEO.hoydelag[0]} />
        <path d="M0 200C40 210 70 240 80 262L0 262Z" fill={SCENE.water} stroke={shade(SCENE.water, 0.25)} strokeWidth={1} />
        {levels.slice(1).map((i) =>
          hills.map((h, j) => (
            <ellipse
              key={`${i}-${j}`}
              cx={h.cx}
              cy={h.cy}
              rx={h.rx * (1 - i / 6.5)}
              ry={h.ry * (1 - i / 6.5)}
              fill={GEO.hoydelag[i]}
              stroke={GEO.kote}
              strokeWidth={1.5 * k}
            />
          )),
        )}
        {hills.map((h, j) =>
          Array.from({ length: 24 }, (_, n) => n).map((n) =>
            n % 5 === 4 ? null : (
              <ellipse
                key={`t${j}-${n}`}
                cx={h.cx}
                cy={h.cy}
                rx={h.rx * (1 - (n + 1) / 32.5)}
                ry={h.ry * (1 - (n + 1) / 32.5)}
                fill="none"
                stroke={GEO.kote}
                strokeWidth={0.6 * k}
                opacity={0.55}
              />
            ),
          ),
        )}
        <path d="M14 30L120 110L178 142L238 172L292 214" fill="none" stroke={GEO.vannskille} strokeWidth={2.4 * k} strokeDasharray="10 5 2 5" />
      </g>
      <rect x={0.5} y={0.5} width={291} height={259} fill="none" stroke={VIZ.muted} strokeWidth={1} />
      <Txt x={300} y={18} anchor="start" size={0.72} weight={650}>
        m o.h.
      </Txt>
      {levels.map((i) => {
        const y = 26 + (5 - i) * legendRow;
        return (
          <g key={i}>
            <rect x={300} y={y} width={16} height={legendRow - 6} fill={GEO.hoydelag[i]} stroke={GEO.kote} strokeWidth={1} />
            <Txt x={322} y={y + legendRow - 9} anchor="start" size={0.68}>
              {i === 5 ? 'over 1000' : `${i * 200}–${(i + 1) * 200}`}
            </Txt>
          </g>
        );
      })}
      <path d={`M300 ${32 + 6 * legendRow}H318`} stroke={GEO.kote} strokeWidth={1.5 * k} />
      <Txt x={322} y={36 + 6 * legendRow} anchor="start" size={0.68}>
        Kote
      </Txt>
      <path d={`M300 ${32 + 7 * legendRow}H318`} stroke={GEO.vannskille} strokeWidth={2.4 * k} strokeDasharray="6 3" />
      <Txt x={322} y={36 + 7 * legendRow} anchor="start" size={0.68}>
        Vannskille
      </Txt>
    </>
  );
}

function Prosesser() {
  const sky = (x: number, y: number, s: number) => (
    <g fill={SCENE.cloud} stroke={SCENE.cloudShade} strokeWidth={1}>
      <ellipse cx={x} cy={y} rx={36 * s} ry={14 * s} />
      <circle cx={x - 12 * s} cy={y - 8 * s} r={13 * s} />
      <circle cx={x + 10 * s} cy={y - 12 * s} r={16 * s} />
    </g>
  );
  return (
    <>
      <Himmel w={400} h={240} skyer={0} />
      <rect x={240} y={190} width={160} height={50} fill={SCENE.water} />
      <path d="M240 190H400" stroke={SCENE.waterLight} strokeWidth={2} />
      <Terreng points={[[0, 104], [70, 100], [150, 140], [215, 182], [252, 196]]} bottom={240} type="gress" glatt />
      {sky(110, 44, 1)}
      {sky(310, 40, 0.8)}
      <ForceArrow x1={110} y1={64} x2={110} y2={108} color={GEO.nedbor} label="Nedbør" labelX={118} labelY={92} labelAnchor="start" />
      <ForceArrow x1={352} y1={186} x2={352} y2={92} color={GEO.fordamping} label="Fordamping" labelX={342} labelY={124} labelAnchor="end" />
      <ForceArrow x1={128} y1={126} x2={196} y2={162} color={GEO.avrenning} label="Avrenning" labelX={146} labelY={172} labelAnchor="start" />
      <ForceArrow x1={18} y1={92} x2={62} y2={92} color={GEO.erosjon} label="Erosjon" labelX={18} labelY={78} labelAnchor="start" />
      <ForceArrow x1={232} y1={170} x2={244} y2={204} color={GEO.avsetning} label="Avsetning" labelX={226} labelY={222} labelAnchor="end" />
      <ForceArrow x1={262} y1={222} x2={318} y2={222} color={VIZ.velocity} label="v" labelX={324} labelY={227} labelAnchor="start" width={5} />
    </>
  );
}

function Ressurser() {
  const lag = useLagMonstre('ressurser');
  const res = useSvgId('reservoar');
  const W = 288;
  const a: Fn = (x) => 40 * Math.exp(-(((x - 140) / 90) ** 2));
  const y = (c: number) => (x: number) => c - a(x);
  const reservoar = baand(y(140), y(200), 0, W);
  return (
    <>
      <rect x={0} y={0} width={W} height={30} fill={SCENE.waterDeep} />
      <rect x={W} y={0} width={400 - W} height={260} fill={VIZ.surface} />
      <LagMonstre id={lag.id} />
      <LagFlate d={baand(() => 30, y(100), 0, W)} type="siltstein" monstre={lag.id} />
      <LagFlate d={baand(y(100), y(140), 0, W)} type="leirskifer" monstre={lag.id} />
      <LagFlate d={reservoar} type="sandstein" monstre={lag.id} />
      <LagFlate d={baand(y(200), () => 262, 0, W)} type="leirskifer" monstre={lag.id} />
      <defs>
        <clipPath id={res}>
          <path d={reservoar} />
        </clipPath>
      </defs>
      <g clipPath={`url(#${res})`}>
        <rect x={0} y={90} width={W} height={22} fill={alpha(GEO.gass.fill, 0.82)} />
        <rect x={0} y={112} width={W} height={16} fill={alpha(GEO.olje.fill, 0.85)} />
        <rect x={0} y={128} width={W} height={80} fill={alpha(GEO.grunnvann.fill, 0.55)} />
        <path d="M236 150C246 136 270 134 288 140V200H236Z" fill={alpha(GEO.co2.fill, 0.85)} stroke={GEO.co2.line} strokeWidth={1.2} />
        <path d="M0 112H288M0 128H288" stroke={VIZ.ink} strokeWidth={1} strokeDasharray="4 3" opacity={0.6} />
      </g>
      <path d={reservoar} fill="none" stroke={GEO.bergart.sandstein.line} strokeWidth={1.4} />
      <Merkelapper
        x={304}
        top={14}
        items={[
          { tx: 140, ty: 80, tekst: 'Takbergart' },
          { tx: 140, ty: 106, tekst: 'Gass' },
          { tx: 140, ty: 120, tekst: 'Olje' },
          { tx: 60, ty: 160, tekst: 'Vann' },
          { tx: 262, ty: 160, tekst: 'CO₂ (lagret)' },
          { tx: 30, ty: 200, tekst: 'Reservoar' },
          { tx: 100, ty: 230, tekst: 'Kildebergart' },
        ]}
      />
    </>
  );
}

const POLARITET = [16, 9, 7, 20, 6, 13, 18, 11, 10, 22];

function Datering() {
  const k = useGeoScale();
  const krystall = useSvgId('zirkon');
  const stripes: { x: number; w: number; normal: boolean }[] = [];
  let x = 200;
  POLARITET.forEach((w, i) => {
    stripes.push({ x, w, normal: i % 2 === 0 });
    stripes.push({ x: 400 - x - w, w, normal: i % 2 === 0 });
    x += w;
  });
  const dots = (() => {
    const rnd = sceneRandom(4);
    const out: { x: number; y: number; mor: boolean }[] = [];
    while (out.length < 26) {
      const px = 70 + 80 * rnd();
      const py = 160 + 86 * rnd();
      if (((px - 110) / 36) ** 2 + ((py - 203) / 40) ** 2 > 1) continue;
      if (out.some((d) => Math.hypot(d.x - px, d.y - py) < 9 * k)) continue;
      out.push({ x: px, y: py, mor: out.length % 3 !== 0 });
    }
    return out;
  })();
  return (
    <>
      <rect x={10} y={16} width={380} height={96} fill={GEO.skorpeHav.fill} />
      {stripes.map((s) => (
        <rect key={`${s.x}-${s.w}`} x={s.x} y={16} width={s.w} height={96} fill={s.normal ? GEO.polaritet.normal.fill : GEO.polaritet.omvendt.fill} stroke={s.normal ? GEO.polaritet.normal.line : GEO.polaritet.omvendt.line} strokeWidth={0.6} />
      ))}
      <rect x={10} y={16} width={380} height={96} fill="none" stroke={VIZ.muted} />
      <path d="M200 10V118" stroke={GEO.magma.fill} strokeWidth={3} />
      <Txt x={200} y={134} size={0.7}>
        Spredningsrygg
      </Txt>
      <rect x={28} y={124} width={14} height={12} fill={GEO.polaritet.normal.fill} stroke={GEO.polaritet.normal.line} />
      <Txt x={46} y={134} anchor="start" size={0.68}>
        Normal
      </Txt>
      <rect x={306} y={124} width={14} height={12} fill={GEO.polaritet.omvendt.fill} stroke={GEO.polaritet.omvendt.line} />
      <Txt x={324} y={134} anchor="start" size={0.68}>
        Omvendt
      </Txt>
      <LinearGradient id={krystall} x1={0} y1={0} x2={1} y2={0} stops={[[0, tint(GEO.bergart.granitt.fill, 0.2)], [0.5, GEO.bergart.granitt.fill], [1, shade(GEO.bergart.granitt.fill, 0.2)]]} />
      <ContactShadow cx={110} cy={252} rx={46} />
      <path d="M110 152L146 172L146 234L110 252L74 234L74 172Z" fill={`url(#${krystall})`} stroke={SCENE.outline} strokeWidth={1.2} />
      <path d="M74 172L110 186L146 172M110 186V252" fill="none" stroke={SCENE.outline} strokeWidth={0.8} opacity={0.6} />
      {dots.map((d) => (
        <circle key={`${d.x}-${d.y}`} cx={d.x} cy={d.y} r={3.2 * k} fill={d.mor ? GEO.morIsotop : GEO.datterIsotop} stroke={VIZ.surface} strokeWidth={1} />
      ))}
      <circle cx={196} cy={190} r={4 * k} fill={GEO.morIsotop} stroke={VIZ.surface} />
      <Txt x={206} y={195} anchor="start" size={0.72}>
        Morisotop (²³⁸U)
      </Txt>
      <circle cx={196} cy={222} r={4 * k} fill={GEO.datterIsotop} stroke={VIZ.surface} />
      <Txt x={206} y={227} anchor="start" size={0.72}>
        Datterisotop (²⁰⁶Pb)
      </Txt>
    </>
  );
}

function Fare() {
  const f = useTextScale();
  const bands: Fn[] = [(x) => 40 + 0.3 * x, (x) => 70 + 0.32 * x, (x) => 100 + 0.34 * x, (x) => 130 + 0.36 * x];
  const navn = ['Lav', 'Moderat', 'Høy', 'Svært høy'];
  const zones = [
    'M20 140C60 120 150 130 230 178C250 196 240 232 200 238C120 244 40 220 20 196Z',
    'M30 140C70 126 140 136 200 172C216 190 204 220 170 224C110 228 50 210 34 190Z',
    'M40 138C76 130 126 140 170 168C180 184 168 204 140 206C100 208 60 196 46 180Z',
    'M50 136C80 132 108 142 136 162C142 176 130 188 110 188C84 188 64 178 54 168Z',
  ];
  const row = 17 * 0.72 * f + 10;
  return (
    <>
      <rect x={0} y={0} width={290} height={240} fill={GEO.hoydelag[0]} />
      {bands
        .map((b, i) => (
          <path key={i} d={`${kurve(b, 0, 290)}L290 0L0 0Z`} fill={GEO.hoydelag[i + 1]} stroke={GEO.kote} strokeWidth={1} />
        ))
        .reverse()}
      {zones.map((d, i) => (
        <path key={i} d={d} fill={alpha(GEO.fare[i]!, 0.6)} stroke={GEO.fare[i]} strokeWidth={1.6} />
      ))}
      {(
        [
          [120, 214],
          [178, 206],
          [210, 222],
          [96, 172],
        ] as const
      ).map(([x, y]) => (
        <g key={`${x}-${y}`}>
          <rect x={x - 6} y={y - 6} width={12} height={9} fill={SCENE.wall} stroke={SCENE.outline} strokeWidth={0.8} />
          <path d={`M${x - 8} ${y - 5}L${x} ${y - 12}L${x + 8} ${y - 5}Z`} fill={SCENE.brick} stroke={SCENE.outline} strokeWidth={0.8} />
        </g>
      ))}
      <rect x={0.5} y={0.5} width={289} height={239} fill="none" stroke={VIZ.muted} />
      {navn.map((n, i) => {
        const y = 24 + (3 - i) * row;
        return (
          <g key={n}>
            <rect x={300} y={y} width={16} height={row - 8} fill={alpha(GEO.fare[i]!, 0.6)} stroke={GEO.fare[i]} strokeWidth={1.4} />
            <Txt x={322} y={y + row - 11} anchor="start" size={0.7}>
              {n}
            </Txt>
          </g>
        );
      })}
    </>
  );
}

const PERIODER: { id: keyof typeof GEO.tid; kort: string }[] = [
  { id: 'kambrium', kort: 'Kam' },
  { id: 'ordovicium', kort: 'Ord' },
  { id: 'silur', kort: 'Sil' },
  { id: 'devon', kort: 'Dev' },
  { id: 'karbon', kort: 'Kar' },
  { id: 'perm', kort: 'Perm' },
  { id: 'trias', kort: 'Trias' },
  { id: 'jura', kort: 'Jura' },
  { id: 'kritt', kort: 'Kritt' },
  { id: 'paleogen', kort: 'Pg' },
  { id: 'neogen', kort: 'Ng' },
  { id: 'kvartaer', kort: 'Kv' },
];

function tidRad(f: number) {
  return Math.round(17 * 0.75 * f + 18);
}

function Tid({ f }: { f: number }) {
  const rad = tidRad(f);
  const w = 800 / PERIODER.length;
  const eraer: { id: keyof typeof GEO.tid; navn: string; fra: number; til: number }[] = [
    { id: 'paleozoikum', navn: 'Paleozoikum', fra: 0, til: 6 },
    { id: 'mesozoikum', navn: 'Mesozoikum', fra: 6, til: 9 },
    { id: 'kenozoikum', navn: 'Kenozoikum', fra: 9, til: 12 },
  ];
  const tekstY = (y: number) => y + rad / 2 + 17 * 0.75 * f * 0.35;
  return (
    <>
      <rect x={0} y={4} width={800} height={rad} fill={GEO.tid.fanerozoikum} stroke={VIZ.muted} strokeWidth={0.8} />
      <Txt x={400} y={tekstY(4)} size={0.75} halo={false}>
        Fanerozoikum
      </Txt>
      {eraer.map((e) => (
        <g key={e.id}>
          <rect x={e.fra * w} y={4 + rad} width={(e.til - e.fra) * w} height={rad} fill={GEO.tid[e.id]} stroke={VIZ.muted} strokeWidth={0.8} />
          <Txt x={((e.fra + e.til) / 2) * w} y={tekstY(4 + rad)} size={0.75} halo={false}>
            {e.navn}
          </Txt>
        </g>
      ))}
      {PERIODER.map((p, i) => (
        <g key={p.id}>
          <rect x={i * w} y={4 + 2 * rad} width={w} height={rad} fill={GEO.tid[p.id]} stroke={VIZ.muted} strokeWidth={0.8} />
          <Txt x={(i + 0.5) * w} y={tekstY(4 + 2 * rad)} size={0.72} halo={false}>
            {p.kort}
          </Txt>
        </g>
      ))}
    </>
  );
}

/* ---------------------------------------------------------------- Fargeprøvene */

const paint = (navn: string, p: GeoPaint): Fargeprove => ({ navn, fill: p.fill, line: p.line });

const INDRE: Fargeprove[] = (
  ['skorpeKontinent', 'skorpeHav', 'litosfare', 'astenosfare', 'mantel', 'nedreMantel', 'ytreKjerne', 'indreKjerne', 'magma', 'lava', 'aske'] as const
).map((k) => paint(`GEO.${k}`, GEO[k]));

const BERGARTER: Fargeprove[] = MONSTER_IDS.map((id) => paint(`bergart.${id}`, GEO.bergart[id]));

const VANN: Fargeprove[] = (['grunnvann', 'umettet', 'bre', 'firn', 'havis'] as const).map((k) => paint(`GEO.${k}`, GEO[k]));

const KART: Fargeprove[] = [
  ...GEO.hoydelag.map((c, i) => ({ navn: `hoydelag[${i}]`, fill: c })),
  { navn: 'GEO.kote', fill: VIZ.surface, line: GEO.kote },
  { navn: 'GEO.vannskille', fill: VIZ.surface, line: GEO.vannskille },
];

const PROSESSER: Fargeprove[] = (['nedbor', 'fordamping', 'avrenning', 'erosjon', 'avsetning'] as const).map((k) => ({ navn: `GEO.${k}`, fill: GEO[k] }));

const RESSURSER: Fargeprove[] = [
  paint('GEO.olje', GEO.olje),
  paint('GEO.gass', GEO.gass),
  paint('GEO.co2', GEO.co2),
  paint('GEO.smitte', GEO.smitte),
  paint('GEO.forurensning', GEO.forurensning),
  paint('GEO.nitrat', GEO.nitrat),
  ...GEO.gehalt.map((c, i) => ({ navn: `gehalt[${i}]`, fill: c })),
];

const DATERING: Fargeprove[] = [
  { navn: 'GEO.morIsotop', fill: GEO.morIsotop },
  { navn: 'GEO.datterIsotop', fill: GEO.datterIsotop },
  paint('polaritet.normal', GEO.polaritet.normal),
  paint('polaritet.omvendt', GEO.polaritet.omvendt),
  ...GEO.fare.map((c, i) => ({ navn: `fare[${i}]`, fill: c })),
];

const TID: Fargeprove[] = Object.entries(GEO.tid).map(([k, c]) => ({ navn: `tid.${k}`, fill: c }));

export default function Galleri() {
  return (
    <GalleryGrid>
      <GalleryItem
        wide
        title="Alle mønstrene (LagMonstre, lagFyll og MONSTER_NAVN)"
        note="Mønsteret vokser med useGeoScale på mobil, og strekene følger useGeoStroke. Konturen er mønsterets strekfarge."
        viewBox={(f) => `0 0 800 ${oversiktOppsett(f).h}`}
      >
        {(f) => <OversiktInnhold f={f} />}
      </GalleryItem>
      <GalleryItem title="Sedimentær lagrekke over grunnfjell (LagFlate med lys ovenfra)" viewBox="0 0 400 260">
        <Lagrekke />
      </GalleryItem>
      <GalleryItem title="Grunnfjell med intrusjoner og lavastrømmer" viewBox="0 0 400 260">
        <Grunnfjell />
      </GalleryItem>
      <GalleryItem title="Løsmasser i en dal" viewBox="0 0 400 260">
        <Losmasser />
      </GalleryItem>
      <GalleryItem title="Saltdiapir og kullag i et sedimentbasseng" viewBox="0 0 400 260">
        <Saltdiapir />
      </GalleryItem>
      <GalleryItem title="Jordas indre (GEO.skorpeKontinent … indreKjerne)" viewBox="0 0 400 260">
        <JordasIndre />
      </GalleryItem>
      <GalleryItem title="Magma, lava og aske ved G-pila og aksenten" viewBox="0 0 400 260">
        <MagmaOgLava />
      </GalleryItem>
      <GalleryItem title="Vann og is (grunnvann, umettet, bre, firn, havis)" viewBox="0 0 400 260">
        <VannOgIs />
      </GalleryItem>
      <GalleryItem title="Kart: høydelag, koter og vannskille" viewBox="0 0 400 260">
        <Kart />
      </GalleryItem>
      <GalleryItem title="Prosesser i kretsløp (og VIZ.velocity til sammenligning)" viewBox="0 0 400 240">
        <Prosesser />
      </GalleryItem>
      <GalleryItem title="Ressurser: gass, olje, vann og CO₂ i en felle" viewBox="0 0 400 260">
        <Ressurser />
      </GalleryItem>
      <GalleryItem title="Datering og polaritet" viewBox="0 0 400 260">
        <Datering />
      </GalleryItem>
      <GalleryItem title="Faresoner (GEO.fare[0..3] halvgjennomsiktig over kartet)" viewBox="0 0 400 240">
        <Fare />
      </GalleryItem>
      <GalleryItem wide title="Geologisk tid (GEO.tid, dempede ICS-farger)" viewBox={(f) => `0 0 800 ${3 * tidRad(f) + 8}`}>
        {(f) => <Tid f={f} />}
      </GalleryItem>
      <Fargeprover title="Jordas indre, magma, lava og aske" farger={INDRE} note="Fyll med kantfargen som strek oppå." />
      <Fargeprover title="Bergarter, sedimenter og løsmasser (GEO.bergart)" farger={BERGARTER} />
      <Fargeprover title="Vann og is" farger={VANN} />
      <Fargeprover title="Kart" farger={KART} />
      <Fargeprover title="Prosesser" farger={PROSESSER} />
      <Fargeprover title="Ressurser" farger={RESSURSER} />
      <Fargeprover title="Datering og fare" farger={DATERING} />
      <Fargeprover title="Geologisk tid" farger={TID} />
      <GeoHoydeDemo />
    </GalleryGrid>
  );
}

/** Viser at geoHoyde og useGeoScale gir det de skal (tallene står i figuren). */
function GeoHoydeDemo() {
  return (
    <GalleryItem title="geoHoyde og useGeoScale" viewBox={(f) => `0 0 800 ${geoHoyde(f, 120)}`}>
      {(f) => <SkalaInnhold f={f} />}
    </GalleryItem>
  );
}

function SkalaInnhold({ f }: { f: number }) {
  const k = useGeoScale();
  const s = useGeoStroke();
  return (
    <>
      <Txt x={20} y={40} anchor="start" size={1}>
        {`f = ${fmt(f, 2)}   useGeoScale = ${fmt(k, 2)}   useGeoStroke = ${fmt(s, 2)}`}
      </Txt>
      <Txt x={20} y={40 + 34 * f} anchor="start" size={1} muted>
        {`geoHoyde(f, 120) = ${geoHoyde(f, 120)}`}
      </Txt>
      {[0, 1, 2, 3, 4].map((i) => (
        <circle key={i} cx={40 + i * 40 * k} cy={geoHoyde(f, 120) - 24 * k} r={8 * k} fill={i % 2 ? GEO.morIsotop : GEO.datterIsotop} stroke={VIZ.surface} />
      ))}
    </>
  );
}
