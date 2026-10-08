/**
 * Egne gjenstander til «Bindingsenergi per nukleon»: brenselstaver i reaktorvann, plasma i en fusjonsreaktor, sola,
 * et forstørret utsnitt med lupe, en tykk reaksjonspil, frie nukleoner og en buet pil til grafen. Samme stil som
 * scene-kit-et: toninger fra core.tsx, SCENE-farger, kontur og myke skygger, ingen filtre.
 */
import type { ReactNode } from 'react';
import { Txt, VIZ, useTextScale } from '../../kit';
import {
  LinearGradient,
  Nukleon,
  PAINTS,
  RadialGradient,
  SCENE,
  Sol,
  Stjernehimmel,
  alpha,
  mix,
  shade,
  tint,
  useStrokeScale,
  useSvgId,
} from '../../kit/scene';
import { nucleonCloud } from './model-bindingsenergi';

const r2 = (v: number) => Math.round(v * 100) / 100;

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Rammen rundt et utsnitt: avrundet, med kontur. Barna klippes til rammen. */
export function Ramme({ box, children, rx = 14 }: { box: Box; children: ReactNode; rx?: number }) {
  const clip = useSvgId('be-ramme');
  const ss = useStrokeScale();
  return (
    <g>
      <defs>
        <clipPath id={clip}>
          <rect x={box.x} y={box.y} width={box.w} height={box.h} rx={rx} />
        </clipPath>
      </defs>
      <g clipPath={`url(#${clip})`}>{children}</g>
      <rect x={box.x} y={box.y} width={box.w} height={box.h} rx={rx} fill="none" stroke={SCENE.outline} strokeWidth={1.2 * ss} />
    </g>
  );
}

/** Mørk bakgrunn i det forstørrede utsnittet (kjernene vises på mørk bunn i begge temaene). */
export function KjerneBakgrunn({ box }: { box: Box }) {
  const id = useSvgId('be-kjernebg');
  return (
    <>
      <RadialGradient
        id={id}
        cx={0.5}
        cy={0.45}
        r={0.75}
        stops={[
          [0, SCENE.spaceGlow],
          [1, SCENE.space],
        ]}
      />
      <rect x={box.x} y={box.y} width={box.w} height={box.h} fill={`url(#${id})`} />
    </>
  );
}

/** Lys tekst på den mørke bakgrunnen i utsnittet. */
export function LysTxt(props: { x: number; y: number; children: ReactNode; anchor?: 'start' | 'middle' | 'end'; size?: number; weight?: number }) {
  return <Txt {...props} color={SCENE.star} halo={false} />;
}

/** Geometrien til reaktorkjernen: 4 × 4 brenselelementer uten hjørnene, midt i bildet. */
function reaktorGeom(box: Box) {
  const cs = Math.min(box.w, box.h) * 0.72;
  const a = cs / 4;
  const cx = box.x + box.w / 2;
  const cy = box.y + box.h * 0.56;
  const cells: { x: number; y: number }[] = [];
  for (let j = 0; j < 4; j++)
    for (let i = 0; i < 4; i++) {
      if ((i === 0 || i === 3) && (j === 0 || j === 3)) continue;
      cells.push({ x: cx + (i - 1.5) * a, y: cy + (j - 1.5) * a });
    }
  return { cs, a, cx, cy, cells };
}

/**
 * Kjernereaktor sett ovenfra, ned i bassenget: brenselelementer (bunter av brenselstaver med uran) på bunnen av et
 * basseng med vann, og det blå tsjerenkovlyset rundt kjernen. Lupen står på et av brenselelementene.
 */
export function Reaktorvann({ box }: { box: Box }) {
  const bg = useSvgId('be-vann');
  const glow = useSvgId('be-tsjerenkov');
  const rodId = useSvgId('be-stavtopp');
  const ss = useStrokeScale();
  const { x, y, w, h } = box;
  const g = reaktorGeom(box);
  const tile = Math.max(18, g.a * 0.62);
  const lines: ReactNode[] = [];
  for (let k = 1; k * tile < w; k++) lines.push(<line key={`v${k}`} x1={x + k * tile} x2={x + k * tile} y1={y} y2={y + h} />);
  for (let k = 1; k * tile < h; k++) lines.push(<line key={`h${k}`} x1={x} x2={x + w} y1={y + k * tile} y2={y + k * tile} />);
  const n = 5;
  const pitch = (g.a * 0.84) / n;
  return (
    <g>
      <LinearGradient
        id={bg}
        stops={[
          [0, shade(SCENE.waterDeep, 0.25)],
          [1, shade(SCENE.waterDeep, 0.55)],
        ]}
      />
      <rect x={x} y={y} width={w} height={h} fill={`url(#${bg})`} />
      {/* Fliser på bunnen av bassenget */}
      <g stroke={tint(SCENE.waterLight, 0.2)} strokeWidth={0.8 * ss} opacity={0.22}>
        {lines}
      </g>
      <RadialGradient
        id={rodId}
        fx={0.36}
        fy={0.32}
        stops={[
          [0, tint(SCENE.metalLight, 0.4)],
          [1, SCENE.metal],
        ]}
      />
      {g.cells.map((c, i) => (
        <g key={i}>
          <rect x={c.x - g.a * 0.46} y={c.y - g.a * 0.46} width={g.a * 0.92} height={g.a * 0.92} rx={2} fill={shade(SCENE.metalDark, 0.35)} stroke={SCENE.outline} strokeWidth={0.8 * ss} />
          {Array.from({ length: n * n }, (_, k) => (
            <circle
              key={k}
              cx={r2(c.x + ((k % n) - (n - 1) / 2) * pitch)}
              cy={r2(c.y + (Math.floor(k / n) - (n - 1) / 2) * pitch)}
              r={r2(pitch * 0.38)}
              fill={`url(#${rodId})`}
            />
          ))}
        </g>
      ))}
      {/* Tsjerenkovlyset: blått lys fra vannet rundt brenselet */}
      <RadialGradient
        id={glow}
        stops={[
          [0, tint(SCENE.waterLight, 0.55), 0.75],
          [0.45, tint(SCENE.waterLight, 0.2), 0.45],
          [1, SCENE.water, 0],
        ]}
      />
      <circle cx={g.cx} cy={g.cy} r={g.cs * 0.85} fill={`url(#${glow})`} />
    </g>
  );
}

/** Der lupen står i reaktorbildet: på et brenselelement nær midten. */
export function reaktorPunkt(box: Box) {
  const g = reaktorGeom(box);
  return { x: g.cx + 0.5 * g.a, y: g.cy - 0.5 * g.a, r: g.a * 0.5 };
}

/**
 * Inni en fusjonsreaktor (tokamak): vegg av fliser i stål og en ring av glødende plasma (rosa-fiolett, som
 * hydrogenplasma lyser) sett skrått ovenfra. Lupen står på plasmaringen.
 */
export function Fusjonsplasma({ box }: { box: Box }) {
  const bg = useSvgId('be-tokamak');
  const glow = useSvgId('be-plasma');
  const ss = useStrokeScale();
  const { x, y, w, h } = box;
  const cx = x + w / 2;
  const cy = y + h * 0.55;
  const rx = w * 0.4;
  const ry = Math.min(h * 0.26, rx * 0.42);
  const plasma = mix(PAINTS.lilla, PAINTS.rod, 0.45);
  const tile = Math.max(16, Math.min(w, h) / 7);
  const tiles: ReactNode[] = [];
  for (let j = 0; j * tile < h + tile; j++)
    for (let i = 0; i * tile < w + tile; i++) {
      const off = j % 2 ? tile / 2 : 0;
      tiles.push(
        <rect
          key={`${i}-${j}`}
          x={r2(x + i * tile - off)}
          y={r2(y + j * tile)}
          width={tile - 2}
          height={tile - 2}
          rx={2}
          fill={(i + j) % 3 === 0 ? shade(SCENE.metalDark, 0.5) : shade(SCENE.metalDark, 0.42)}
        />,
      );
    }
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} fill={shade(SCENE.metalDark, 0.62)} />
      {tiles}
      <RadialGradient
        id={bg}
        cx={0.5}
        cy={0.55}
        r={0.6}
        stops={[
          [0, plasma, 0.35],
          [1, plasma, 0],
        ]}
      />
      <rect x={x} y={y} width={w} height={h} fill={`url(#${bg})`} />
      <RadialGradient
        id={glow}
        stops={[
          [0, tint(plasma, 0.75)],
          [1, plasma],
        ]}
      />
      {/* Plasmaringen: brede, svake strøk ytterst og et smalt, lyst strøk i midten (glød uten filter) */}
      {[
        [ry * 0.9, 0.12],
        [ry * 0.62, 0.22],
        [ry * 0.4, 0.4],
        [ry * 0.22, 0.75],
      ].map(([sw, op], i) => (
        <ellipse key={i} cx={cx} cy={cy} rx={rx} ry={ry} fill="none" stroke={i === 3 ? tint(plasma, 0.6) : plasma} strokeWidth={sw} opacity={op} />
      ))}
      <ellipse cx={cx} cy={cy} rx={rx} ry={ry} fill="none" stroke={tint(plasma, 0.85)} strokeWidth={Math.max(1.5, ry * 0.07) * ss} opacity={0.9} />
      {/* Midtsøylen (sentralspolen) foran den bakre delen av ringen */}
      <rect x={cx - w * 0.06} y={y} width={w * 0.12} height={cy - y + ry * 0.2} fill={shade(SCENE.metalDark, 0.3)} stroke={SCENE.outline} strokeWidth={0.8 * ss} />
      <ellipse cx={cx} cy={cy + ry * 0.2} rx={w * 0.06} ry={w * 0.02} fill={shade(SCENE.metalDark, 0.45)} />
      {/* Den fremre delen av ringen tegnes på nytt, så den ligger foran søylen */}
      <path
        d={`M${r2(cx - rx)} ${r2(cy)} A${r2(rx)} ${r2(ry)} 0 0 0 ${r2(cx + rx)} ${r2(cy)}`}
        fill="none"
        stroke={tint(plasma, 0.6)}
        strokeWidth={ry * 0.22}
        opacity={0.75}
      />
      <path
        d={`M${r2(cx - rx)} ${r2(cy)} A${r2(rx)} ${r2(ry)} 0 0 0 ${r2(cx + rx)} ${r2(cy)}`}
        fill="none"
        stroke={tint(plasma, 0.85)}
        strokeWidth={Math.max(1.5, ry * 0.07) * ss}
      />
    </g>
  );
}

export function plasmaPunkt(box: Box) {
  const rx = box.w * 0.4;
  const ry = Math.min(box.h * 0.26, rx * 0.42);
  // Fremre del av ringen, litt til høyre for midten
  const t = Math.PI * 0.32;
  return { x: box.x + box.w / 2 + rx * Math.cos(t), y: box.y + box.h * 0.55 + ry * Math.sin(t), r: Math.max(12, ry * 0.45) };
}

/** Sola på stjernehimmel. Lupen står midt i sola (kjernen). */
export function Solbilde({ box }: { box: Box }) {
  const p = solPunkt(box);
  return (
    <g>
      <Stjernehimmel x={box.x} y={box.y} w={box.w} h={box.h} seed={5} melkevei={0.4} />
      <Sol x={p.x} y={p.y} r={p.R} korona={0.8} flekker={2} />
    </g>
  );
}

export function solPunkt(box: Box) {
  const R = Math.min(box.w, box.h) * 0.36;
  return { x: box.x + box.w / 2, y: box.y + box.h * 0.56, R, r: R * 0.32 };
}

/**
 * Lupe: en ring rundt det som forstørres, og to linjer ut til utsnittet. `side` sier hvor utsnittet ligger
 * (til høyre for bildet på PC, under på mobil).
 */
export function Lupe({ x, y, r, to, side }: { x: number; y: number; r: number; to: Box; side: 'right' | 'below' }) {
  const ss = useStrokeScale();
  const lines =
    side === 'right'
      ? [
          [x, y - r, to.x + 4, to.y + 10],
          [x, y + r, to.x + 4, to.y + to.h - 10],
        ]
      : [
          [x - r, y, to.x + 10, to.y + 4],
          [x + r, y, to.x + to.w - 10, to.y + 4],
        ];
  return (
    <g>
      {lines.map(([a, b, c, d], i) => (
        <g key={i}>
          <line x1={a} y1={b} x2={c} y2={d} stroke={VIZ.surface} strokeWidth={4 * ss} opacity={0.7} strokeLinecap="round" />
          <line x1={a} y1={b} x2={c} y2={d} stroke={VIZ.muted} strokeWidth={1.5 * ss} strokeDasharray={`${5 * ss} ${4 * ss}`} />
        </g>
      ))}
      <circle cx={x} cy={y} r={r} fill={alpha(SCENE.star, 0.12)} stroke={SCENE.outline} strokeWidth={4.5 * ss} />
      <circle cx={x} cy={y} r={r} fill="none" stroke={SCENE.star} strokeWidth={2.2 * ss} />
    </g>
  );
}

/**
 * Tykk reaksjonspil (⟶) mellom «før» og «etter», med kontur. Farget som energien: inn ved oppdeling, ut ved
 * fisjon og fusjon.
 */
export function Reaksjonspil({ x1, x2, y, color, dim }: { x1: number; x2: number; y: number; color: string; dim?: boolean }) {
  const ss = useStrokeScale();
  const f = useTextScale();
  const t = 7 * Math.max(1, f * 0.8);
  const head = t * 2.6;
  const hl = Math.min(head * 1.1, (x2 - x1) * 0.5);
  const d = `M${r2(x1)} ${r2(y - t / 2)}H${r2(x2 - hl)}V${r2(y - head / 2)}L${r2(x2)} ${r2(y)}L${r2(x2 - hl)} ${r2(y + head / 2)}V${r2(y + t / 2)}H${r2(x1)}Z`;
  return (
    <g opacity={dim ? 0.5 : undefined}>
      <path d={d} fill={color} stroke={VIZ.surface} strokeWidth={5 * ss} strokeLinejoin="round" opacity={0.85} />
      <path d={d} fill={color} stroke={SCENE.outline} strokeWidth={1.2 * ss} strokeLinejoin="round" />
    </g>
  );
}

/** Glød der energien frigjøres (radiell toning, ikke filter). */
export function Energiglod({ x, y, r }: { x: number; y: number; r: number }) {
  const id = useSvgId('be-glod');
  return (
    <>
      <RadialGradient
        id={id}
        stops={[
          [0, tint(SCENE.glow, 0.5), 0.95],
          [0.35, SCENE.glow, 0.55],
          [1, SCENE.hot, 0],
        ]}
      />
      <circle cx={x} cy={y} r={r} fill={`url(#${id})`} />
    </>
  );
}

/** Fritt nøytron på mørk bunn: en svak lys ring rundt, så det grå nøytronet synes. */
export function FrittNoytron({ x, y, r }: { x: number; y: number; r: number }) {
  const ss = useStrokeScale();
  return (
    <g>
      <circle cx={x} cy={y} r={r + 2 * ss} fill={alpha(SCENE.star, 0.18)} stroke={alpha(SCENE.star, 0.7)} strokeWidth={1.2 * ss} />
      <Nukleon x={x} y={y} r={r} type="noytron" />
    </g>
  );
}

/** Frie protoner og nøytroner spredt i en ellipse rundt (x, y): kjernen etter at den er delt opp. */
export function FrieNukleoner({ x, y, Z, N, rx, ry, r }: { x: number; y: number; Z: number; N: number; rx: number; ry: number; r: number }) {
  const pts = nucleonCloud(Z, N, rx, ry, r);
  return (
    <g>
      {pts.map((p, i) => (
        <Nukleon key={i} x={r2(x + p.x)} y={r2(y + p.y)} r={r} type={p.proton ? 'proton' : 'noytron'} tegn={r >= 7} />
      ))}
    </g>
  );
}

/**
 * Buet pil i grafen (kvadratisk bézierkurve fra (x1, y1) via (cx, cy) til (x2, y2)) med glorie og pilspiss,
 * for retningene som frigjør energi (fusjon og fisjon mot jern).
 */
export function BuePil({ x1, y1, cx, cy, x2, y2, color, width = 5 }: { x1: number; y1: number; cx: number; cy: number; x2: number; y2: number; color: string; width?: number }) {
  const ss = useStrokeScale();
  const w = width * ss;
  const head = w * 3.2;
  // Retningen ved spissen er fra kontrollpunktet til sluttpunktet
  const dx = x2 - cx;
  const dy = y2 - cy;
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len;
  const uy = dy / len;
  const bx = x2 - ux * head;
  const by = y2 - uy * head;
  const d = `M${r2(x1)} ${r2(y1)}Q${r2(cx)} ${r2(cy)} ${r2(bx + ux * 2)} ${r2(by + uy * 2)}`;
  const tip = `${r2(x2)},${r2(y2)} ${r2(bx - uy * head * 0.55)},${r2(by + ux * head * 0.55)} ${r2(bx + uy * head * 0.55)},${r2(by - ux * head * 0.55)}`;
  return (
    <g>
      <path d={d} fill="none" stroke={VIZ.surface} strokeWidth={w + 5 * ss} strokeLinecap="round" opacity={0.9} />
      <polygon points={tip} fill={VIZ.surface} stroke={VIZ.surface} strokeWidth={5 * ss} strokeLinejoin="round" opacity={0.9} />
      <path d={d} fill="none" stroke={color} strokeWidth={w} strokeLinecap="round" />
      <polygon points={tip} fill={color} stroke={color} strokeWidth={1 * ss} strokeLinejoin="round" />
    </g>
  );
}
