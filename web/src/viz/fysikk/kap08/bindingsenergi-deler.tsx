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

/**
 * Reaktorkjerne sett ovenfra og fra siden: brenselstaver (rør av zirkonium) står i vann som lyser blått
 * (tsjerenkovlys). Den midterste staven er skåret opp, så brenselstablettene av urandioksid synes.
 * Gir tilbake punktet lupen skal stå på (midt på en tablett).
 */
export function Reaktorvann({ box }: { box: Box }) {
  const bg = useSvgId('be-vann');
  const glow = useSvgId('be-tsjerenkov');
  const rod = useSvgId('be-stav');
  const pellet = useSvgId('be-tablett');
  const ss = useStrokeScale();
  const { x, y, w, h } = box;
  const p = reaktorPunkt(box);
  const rw = Math.min(26, Math.max(14, w * 0.075));
  const gap = rw * 1.05;
  const n = Math.max(3, Math.floor((w - 20) / (rw + gap)));
  const left = x + (w - (n * rw + (n - 1) * gap)) / 2;
  const top = y + h * 0.2;
  const mid = Math.floor(n / 2);
  const winTop = p.y - rw * 1.9;
  const winBot = p.y + rw * 1.9;
  const pelletH = rw * 0.95;
  return (
    <g>
      <LinearGradient
        id={bg}
        stops={[
          [0, shade(SCENE.waterDeep, 0.35)],
          [1, shade(SCENE.waterDeep, 0.6)],
        ]}
      />
      <rect x={x} y={y} width={w} height={h} fill={`url(#${bg})`} />
      <RadialGradient
        id={glow}
        cx={0.5}
        cy={0.62}
        r={0.6}
        stops={[
          [0, tint(SCENE.waterLight, 0.35), 0.85],
          [0.55, SCENE.water, 0.35],
          [1, SCENE.waterDeep, 0],
        ]}
      />
      <rect x={x} y={y} width={w} height={h} fill={`url(#${glow})`} />
      <LinearGradient
        id={rod}
        x1={0}
        y1={0}
        x2={1}
        y2={0}
        stops={[
          [0, shade(SCENE.metal, 0.15)],
          [0.3, tint(SCENE.metalLight, 0.25)],
          [0.7, SCENE.metal],
          [1, shade(SCENE.metalDark, 0.2)],
        ]}
      />
      <LinearGradient
        id={pellet}
        stops={[
          [0, tint(SCENE.stoneDark, 0.18)],
          [0.5, SCENE.stoneDark],
          [1, shade(SCENE.stoneDark, 0.35)],
        ]}
      />
      {Array.from({ length: n }, (_, i) => {
        const rx = left + i * (rw + gap);
        const cut = i === mid;
        return (
          <g key={i}>
            <rect x={rx} y={top} width={rw} height={y + h - top + 4} rx={rw / 2} fill={`url(#${rod})`} stroke={SCENE.outline} strokeWidth={0.8 * ss} />
            {/* Toppen (endepropp) og en tynn skygge der staven møter avstandsgitteret */}
            <rect x={rx + rw * 0.18} y={top - rw * 0.25} width={rw * 0.64} height={rw * 0.5} rx={rw * 0.2} fill={SCENE.metalDark} stroke={SCENE.outline} strokeWidth={0.6 * ss} />
            {cut && (
              <g>
                <rect x={rx + rw * 0.14} y={winTop} width={rw * 0.72} height={winBot - winTop} fill={shade(SCENE.metalDark, 0.4)} />
                {Array.from({ length: Math.ceil((winBot - winTop) / pelletH) }, (_, k) => {
                  const py = winTop + k * pelletH;
                  const ph = Math.min(pelletH - 1.2, winBot - py);
                  if (ph <= 1) return null;
                  return (
                    <rect key={k} x={rx + rw * 0.18} y={py + 0.6} width={rw * 0.64} height={ph} rx={1.5} fill={`url(#${pellet})`} stroke={SCENE.outline} strokeWidth={0.5 * ss} />
                  );
                })}
                <rect x={rx + rw * 0.14} y={winTop} width={rw * 0.72} height={winBot - winTop} fill="none" stroke={SCENE.outline} strokeWidth={0.8 * ss} />
              </g>
            )}
          </g>
        );
      })}
      {/* Avstandsgitter som holder stavene */}
      {[0.42, 0.82].map((k) => (
        <rect key={k} x={left - gap * 0.5} y={top + (y + h - top) * k} width={n * rw + (n - 1) * gap + gap} height={Math.max(3, rw * 0.28)} fill={alpha(SCENE.metalLight, 0.7)} stroke={SCENE.outline} strokeWidth={0.5 * ss} />
      ))}
    </g>
  );
}

/** Der lupen står i reaktorbildet: midt i vinduet på den midterste staven. */
export function reaktorPunkt(box: Box) {
  const rw = Math.min(26, Math.max(14, box.w * 0.075));
  const gap = rw * 1.05;
  const n = Math.max(3, Math.floor((box.w - 20) / (rw + gap)));
  const left = box.x + (box.w - (n * rw + (n - 1) * gap)) / 2;
  const mid = Math.floor(n / 2);
  return { x: left + mid * (rw + gap) + rw / 2, y: box.y + box.h * 0.62, r: rw * 0.95 };
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
