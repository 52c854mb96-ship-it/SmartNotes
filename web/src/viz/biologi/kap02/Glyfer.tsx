/**
 * Symboler for de 18 organismene i systematikk-visualiseringene. Bruker kit-ets symboler der de passer (menneske,
 * fisk, fugl, pattedyr, trær, bakterie) og tegner resten her i samme rolige stil: flate former i en boks på 40 × 40
 * rundt (0, 0), farget med BIO (fyll + kant).
 */
import type { ReactNode } from 'react';
import { BIO, Bakterie, DIM_OPACITY, Fisk, Fugl, Menneske, Pattedyr, Tre, VIZ, useLineScale, type BioPaint } from '../kit';
import { organism, type GlyphKind, type OrganismId } from './model';

interface GProps {
  x: number;
  y: number;
  size?: number;
  dim?: boolean;
  title?: string;
}

/** Samme innpakning som kit-ets symboler: flytt, skaler fra 40 × 40 og hold strekene like tykke. */
function G({ x, y, size = 40, dim, title, children }: GProps & { children: (sw: (w: number) => number) => ReactNode }) {
  const lw = useLineScale();
  const k = size / 40;
  const sw = (w: number) => (w * lw) / k;
  return (
    <g transform={`translate(${x} ${y}) scale(${k})`} opacity={dim ? DIM_OPACITY : undefined}>
      {title && <title>{title}</title>}
      {children(sw)}
    </g>
  );
}

/** Blåhval sett fra siden (hodet mot venstre, som fisken i kit-et): lang kropp, liten ryggfinne, vannrett halefinne. */
function Hval({ paint = BIO.fisk, ...g }: GProps & { paint?: BioPaint }) {
  return (
    <G {...g}>
      {(sw) => (
        <g strokeLinejoin="round" strokeLinecap="round">
          <path d="M13,-1.5 Q17,-2.5 21,-5.5 Q19.5,-1 21,2.5 Q17,0.5 13,0.5 Z" fill={paint.fill} stroke={paint.line} strokeWidth={sw(1.4)} />
          <path
            d="M-21,1 Q-20,-6 -9,-6.5 Q3,-7 13.5,-1.5 L14,0.5 Q5,5 -6,6.2 Q-17,7 -21,1 Z"
            fill={paint.fill}
            stroke={paint.line}
            strokeWidth={sw(1.6)}
          />
          <path d="M5,-4.6 L8.5,-8 L9.5,-3.6" fill={paint.fill} stroke={paint.line} strokeWidth={sw(1.3)} />
          <path d="M-9,4.5 L-3,10 L-4,4.8" fill={paint.fill} stroke={paint.line} strokeWidth={sw(1.3)} />
          {[2.6, 4.4].map((y) => (
            <path key={y} d={`M-19,${y} Q-14,${y + 1.4} -8,${y + 0.8}`} fill="none" stroke={paint.line} strokeWidth={sw(0.9)} strokeOpacity={0.6} />
          ))}
          <circle cx={-14.5} cy={-0.5} r={1.3} fill={paint.line} />
        </g>
      )}
    </G>
  );
}

/** Sjimpanse forfra: hode med lysere ansikt og ører, kropp og lange armer. */
function Ape({ paint = BIO.pattedyr, ...g }: GProps & { paint?: BioPaint }) {
  return (
    <G {...g}>
      {(sw) => (
        <g strokeLinejoin="round" strokeLinecap="round">
          <path d="M-7,0 L-13,17 M7,0 L13,17" stroke={paint.line} strokeWidth={sw(4.2)} fill="none" />
          <path d="M-9,19 Q-11,3 -6,-1.5 H6 Q11,3 9,19 Z" fill={paint.fill} stroke={paint.line} strokeWidth={sw(1.5)} />
          <circle cx={-8.2} cy={-10} r={3.2} fill={paint.fill} stroke={paint.line} strokeWidth={sw(1.3)} />
          <circle cx={8.2} cy={-10} r={3.2} fill={paint.fill} stroke={paint.line} strokeWidth={sw(1.3)} />
          <circle cx={0} cy={-11} r={7.8} fill={paint.fill} stroke={paint.line} strokeWidth={sw(1.5)} />
          <ellipse cx={0} cy={-8.6} rx={5.3} ry={4.8} fill={VIZ.surface} opacity={0.55} />
          <circle cx={-2.6} cy={-11.6} r={1.1} fill={paint.line} />
          <circle cx={2.6} cy={-11.6} r={1.1} fill={paint.line} />
          <path d="M-2.2,-6.6 Q0,-5.4 2.2,-6.6" fill="none" stroke={paint.line} strokeWidth={sw(1)} />
        </g>
      )}
    </G>
  );
}

/** Katt fra siden (mot høyre): rundt hode med spisse ører, hale som bøyer seg opp. */
function Katt({ paint = BIO.fugl, ...g }: GProps & { paint?: BioPaint }) {
  return (
    <G {...g}>
      {(sw) => (
        <g strokeLinejoin="round" strokeLinecap="round">
          <path d="M-13,0 Q-21,-2 -19,-12 Q-18.5,-15 -16,-14" fill="none" stroke={paint.line} strokeWidth={sw(2.6)} />
          {[-9, -5, 5, 9].map((x, i) => (
            <line key={i} x1={x} y1={3} x2={x + (i % 2 ? 0.8 : -0.8)} y2={16} stroke={paint.line} strokeWidth={sw(2.4)} />
          ))}
          <ellipse cx={-2} cy={0} rx={13} ry={6.5} fill={paint.fill} stroke={paint.line} strokeWidth={sw(1.6)} />
          <path d="M9.5,-11 L10.5,-17.5 L14,-12.5 Z M15,-12.5 L18.5,-17.5 L19,-11 Z" fill={paint.fill} stroke={paint.line} strokeWidth={sw(1.2)} />
          <circle cx={14.3} cy={-7.6} r={6.3} fill={paint.fill} stroke={paint.line} strokeWidth={sw(1.5)} />
          <circle cx={16.6} cy={-8.6} r={1.1} fill={paint.line} />
        </g>
      )}
    </G>
  );
}

/** Krokodille fra siden (mot høyre): lav, lang kropp med lang snute og hale og korte bein. */
function Krokodille({ paint = BIO.plante, ...g }: GProps & { paint?: BioPaint }) {
  return (
    <G {...g}>
      {(sw) => (
        <g strokeLinejoin="round" strokeLinecap="round">
          <path d="M-7,3 L-9.5,8.5 L-6.5,8.5 M7,3.5 L9,8.5 L12,8.5" fill="none" stroke={paint.line} strokeWidth={sw(2)} />
          <path
            d="M-21,1.5 Q-14,-1.5 -6,-2.6 L7,-3.4 Q10.5,-5.6 13,-3.6 L21.5,-2.2 Q22.5,0.4 20,1.4 L13,2 Q6,4.6 -4,4 Q-14,3.6 -21,1.5 Z"
            fill={paint.fill}
            stroke={paint.line}
            strokeWidth={sw(1.5)}
          />
          {[-14, -10, -6, -2, 2, 6].map((x) => (
            <path key={x} d={`M${x},${-2.2 + (x < -8 ? 1 : 0)} l1.6,-1.8 l1.6,1.6`} fill="none" stroke={paint.line} strokeWidth={sw(0.9)} />
          ))}
          <circle cx={11.2} cy={-4} r={1.2} fill={paint.line} />
          <path d="M14,0 L20.5,-0.6" stroke={paint.line} strokeWidth={sw(0.8)} strokeOpacity={0.7} />
        </g>
      )}
    </G>
  );
}

/** Firfisle ovenfra: smal kropp, fire bein ut til sidene og lang hale. */
function Firfisle({ paint = BIO.fugl, ...g }: GProps & { paint?: BioPaint }) {
  return (
    <G {...g}>
      {(sw) => (
        <g strokeLinejoin="round" strokeLinecap="round" fill="none">
          {[-1, 1].map((s) => (
            <g key={s} stroke={paint.line} strokeWidth={sw(1.6)}>
              <path d={`M${s * 3},-7 L${s * 9},-9.5 L${s * 10.5},-6`} />
              <path d={`M${s * 3},4 L${s * 9},6.5 L${s * 10.5},3`} />
            </g>
          ))}
          <path d="M0,6 Q1,13 -3,16 Q-6,18.5 -3,20" stroke={paint.line} strokeWidth={sw(2.4)} />
          <ellipse cx={0} cy={-1.5} rx={4.2} ry={9} fill={paint.fill} stroke={paint.line} strokeWidth={sw(1.5)} />
          <ellipse cx={0} cy={-13} rx={3.6} ry={4.6} fill={paint.fill} stroke={paint.line} strokeWidth={sw(1.4)} />
          <circle cx={-1.6} cy={-14} r={0.8} fill={paint.line} />
          <circle cx={1.6} cy={-14} r={0.8} fill={paint.line} />
        </g>
      )}
    </G>
  );
}

/** Frosk som sitter (mot høyre): kort kropp, sammenbrettet bakbein og øye på toppen av hodet. */
function Frosk({ paint = BIO.plante, ...g }: GProps & { paint?: BioPaint }) {
  return (
    <G {...g}>
      {(sw) => (
        <g strokeLinejoin="round" strokeLinecap="round">
          <path d="M6,5 L8,13 L11,13" fill="none" stroke={paint.line} strokeWidth={sw(1.8)} />
          <path d="M-15,9 Q-17,-3 -5,-6 Q6,-9 12,-4 Q16.5,-1 15.5,3 Q12,8 3,9.5 Z" fill={paint.fill} stroke={paint.line} strokeWidth={sw(1.6)} />
          <ellipse cx={-7} cy={6.5} rx={8.5} ry={5} transform="rotate(-18 -7 6.5)" fill={paint.fill} stroke={paint.line} strokeWidth={sw(1.4)} />
          <path d="M-2,11.5 L9,13" fill="none" stroke={paint.line} strokeWidth={sw(1.8)} />
          <circle cx={7.5} cy={-7} r={3.4} fill={paint.fill} stroke={paint.line} strokeWidth={sw(1.4)} />
          <circle cx={8.2} cy={-7.3} r={1.3} fill={paint.line} />
          <path d="M15,1.5 Q11,2.6 7,1.6" fill="none" stroke={paint.line} strokeWidth={sw(1)} />
        </g>
      )}
    </G>
  );
}

/** Bakegjær: en gjærcelle med en knopp (knoppskyting), cellekjerne og vakuole. */
function Gjaer({ paint = BIO.sopp, ...g }: GProps & { paint?: BioPaint }) {
  return (
    <G {...g}>
      {(sw) => (
        <g>
          <ellipse cx={-3} cy={3} rx={13} ry={11} fill={paint.fill} stroke={paint.line} strokeWidth={sw(1.6)} />
          <circle cx={11.5} cy={-8.5} r={6.5} fill={paint.fill} stroke={paint.line} strokeWidth={sw(1.5)} />
          <ellipse cx={-6} cy={5} rx={4.2} ry={3.6} fill={BIO.kjerne.fill} stroke={BIO.kjerne.line} strokeWidth={sw(1.1)} />
          <circle cx={2} cy={-1} r={3.4} fill={BIO.vakuole.fill} stroke={BIO.vakuole.line} strokeWidth={sw(1)} />
        </g>
      )}
    </G>
  );
}

/** Rød fluesopp: rød hatt med hvite flekker, hvit stilk med ring og knoll. */
function Fluesopp(g: GProps) {
  const cap = BIO.rodtBlodlegeme;
  return (
    <G {...g}>
      {(sw) => (
        <g strokeLinejoin="round">
          <path d="M-4,-1 L-5,15 Q-7,19 0,19.5 Q7,19 5,15 L4,-1 Z" fill={VIZ.surface} stroke={BIO.sopp.line} strokeWidth={sw(1.4)} />
          <path d="M-6.5,5 Q0,8 6.5,5" fill="none" stroke={BIO.sopp.line} strokeWidth={sw(1.3)} />
          <path d="M-18,1 Q-18,-17 0,-17 Q18,-17 18,1 Z" fill={cap.fill} stroke={cap.line} strokeWidth={sw(1.6)} />
          {[
            [-10, -7, 1.9],
            [-3, -12, 1.7],
            [5, -8, 2],
            [11, -3, 1.6],
            [-12, -1, 1.4],
            [1, -3.5, 1.5],
          ].map(([cx, cy, r], i) => (
            <circle key={i} cx={cx} cy={cy} r={r} fill={VIZ.surface} stroke={cap.line} strokeWidth={sw(0.6)} />
          ))}
        </g>
      )}
    </G>
  );
}

const ULV: BioPaint = BIO.menneske;

/** Symbolet til en organisme etter id. `size` ≈ bredden. */
export function OrganismGlyph({ id, x, y, size = 40, dim }: { id: OrganismId; x: number; y: number; size?: number; dim?: boolean }) {
  const o = organism(id);
  const common = { x, y, size, dim, title: o.name };
  const kind: GlyphKind = o.glyph;
  switch (kind) {
    case 'menneske':
      return <Menneske {...common} />;
    case 'ape':
      return <Ape {...common} />;
    case 'hund':
      return <Pattedyr {...common} paint={id === 'ulv' ? ULV : BIO.pattedyr} />;
    case 'katt':
      return <Katt {...common} />;
    case 'hval':
      return <Hval {...common} />;
    case 'fugl':
      return <Fugl {...common} />;
    case 'krokodille':
      return <Krokodille {...common} />;
    case 'firfisle':
      return <Firfisle {...common} />;
    case 'frosk':
      return <Frosk {...common} />;
    case 'fisk':
      return <Fisk {...common} paint={id === 'torsk' ? BIO.sopp : BIO.fisk} />;
    case 'eik':
      return <Tre {...common} />;
    case 'gran':
      return <Tre {...common} bartre />;
    case 'fluesopp':
      return <Fluesopp {...common} />;
    case 'gjaer':
      return <Gjaer {...common} />;
    case 'bakterie':
      return <Bakterie {...common} form="stav" flagell />;
    case 'arke':
      return <Bakterie {...common} form="stav" paint={BIO.lysosom} />;
  }
}
