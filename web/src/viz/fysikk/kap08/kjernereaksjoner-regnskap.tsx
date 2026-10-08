/**
 * Figur 2 i «Kjernereaksjoner: α, β og γ»: reaksjonslikningen med nukleontall (blått) og ladning (oransje), og et
 * regnskap under der hvert tall står i en brikke rett under leddet sitt, så eleven ser at summene er like på begge
 * sider av pila.
 */
import type { ReactNode } from 'react';
import { Txt, VIZ, useTextScale } from '../../kit';
import { alpha, useStrokeScale } from '../../kit/scene';
import { elementSymbol } from '../kap07/elements';
import { NuclideSymbol, nuclideSymbolWidth, PARTICLE, Txt as FixedTxt } from '../kap07/parts';
import type { Decay } from './model';

export const COLOR_A = VIZ.series[0]!;
export const COLOR_Z = PARTICLE.proton;

interface Term {
  A: number;
  Z: number;
  symbol: string;
  suffix?: string;
}
type Item = Term | '→' | '+';

const GAP = 0.36;
const MAX_S = 46;

function terms(dc: Decay, shown: boolean): Item[] {
  const p = dc.parent;
  const list: Item[] = [{ A: p.A, Z: p.Z, symbol: elementSymbol(p.Z), suffix: p.excited ? '*' : undefined }];
  if (!shown) return list;
  const d = dc.daughter;
  list.push('→', { A: d.A, Z: d.Z, symbol: elementSymbol(d.Z), suffix: d.excited ? '*' : undefined });
  for (const e of dc.emitted) list.push('+', { A: e.A, Z: e.Z, symbol: e.symbol });
  return list;
}

const zText = (z: number) => (z < 0 ? `−${-z}` : String(z));

function itemWidth(t: Item, S: number): number {
  if (t === '→') return (1.05 + 2 * GAP) * S;
  if (t === '+') return (0.62 + 2 * GAP) * S;
  return nuclideSymbolWidth(t.A, zText(t.Z), t.symbol, S, t.suffix);
}

export interface RegnskapLayout {
  narrow: boolean;
  H: number;
  /** Største skriftstørrelse for likningen, grunnlinja og midten av de to radene med brikker. */
  S: number;
  eqY: number;
  labA: number;
  rowA: number;
  labZ: number;
  rowZ: number;
  chipH: number;
  /** Venstre og høyre kant av plassen til likningen. */
  left: number;
  right: number;
}

export function regnskapLayout(f: number): RegnskapLayout {
  const narrow = f > 1.3;
  const k = Math.max(1, f * 0.8);
  const S = MAX_S * k;
  const chipH = 28 * f;
  const eqY = 16 + S * 0.95;
  const below = eqY + S * 0.3;
  if (narrow) {
    const labA = below + 26 * f;
    const rowA = labA + 8 * f + chipH / 2;
    const labZ = rowA + chipH / 2 + 26 * f;
    const rowZ = labZ + 8 * f + chipH / 2;
    return { narrow, H: Math.round(rowZ + chipH / 2 + 16), S, eqY, labA, rowA, labZ, rowZ, chipH, left: 16, right: 784 };
  }
  const rowA = below + 18 * f + chipH / 2;
  const rowZ = rowA + chipH + 12 * f;
  return { narrow, H: Math.round(rowZ + chipH / 2 + 16), S, eqY, labA: rowA, rowA, labZ: rowZ, rowZ, chipH, left: 196, right: 784 };
}

export function Regnskap({ L, dc, shown, note }: { L: RegnskapLayout; dc: Decay; shown: boolean; note?: string }) {
  const f = useTextScale();
  const list = terms(dc, shown);
  const unit = list.reduce((w, t) => w + itemWidth(t, 1), 0);
  const avail = L.right - L.left;
  const S = Math.min(L.S, avail / unit);
  let x = (L.left + L.right) / 2 - (unit * S) / 2;
  const eq: ReactNode[] = [];
  const centers: { x: number; t: Item }[] = [];
  list.forEach((t, i) => {
    const w = itemWidth(t, S);
    if (t === '→' || t === '+') {
      eq.push(
        <FixedTxt key={i} x={x + w / 2} y={L.eqY - S * 0.05} size={S * 0.9}>
          {t}
        </FixedTxt>,
      );
    } else {
      eq.push(<NuclideSymbol key={i} x={x} y={L.eqY} A={t.A} Z={zText(t.Z)} symbol={t.symbol} suffix={t.suffix} size={S} colorA={COLOR_A} colorZ={COLOR_Z} />);
    }
    centers.push({ x: x + w / 2, t });
    x += w;
  });
  const row = (y: number, which: 'A' | 'Z') => {
    const color = which === 'A' ? COLOR_A : COLOR_Z;
    return centers.map((c, i) => {
      if (c.t === '→' || c.t === '+')
        return (
          <Txt key={i} x={c.x} y={y + 6 * f} size={1.1} weight={650}>
            {c.t === '→' ? '=' : '+'}
          </Txt>
        );
      const text = which === 'A' ? String(c.t.A) : zText(c.t.Z);
      return <Chip key={i} x={c.x} y={y} h={L.chipH} text={text} color={color} />;
    });
  };
  return (
    <>
      {eq}
      {shown ? (
        <>
          <RowLabel L={L} y={L.labA} color={COLOR_A}>
            Nukleontall A
          </RowLabel>
          {row(L.rowA, 'A')}
          <RowLabel L={L} y={L.labZ} color={COLOR_Z}>
            Ladning Z
          </RowLabel>
          {row(L.rowZ, 'Z')}
        </>
      ) : (
        <Txt x={(L.left + L.right) / 2} y={(L.rowA + L.rowZ) / 2 + 6 * f} muted>
          {note}
        </Txt>
      )}
    </>
  );
}

function RowLabel({ L, y, color, children }: { L: RegnskapLayout; y: number; color: string; children: ReactNode }) {
  const f = useTextScale();
  return L.narrow ? (
    <Txt x={400} y={y} size={0.85} color={color} weight={650}>
      {children}
    </Txt>
  ) : (
    <Txt x={24} y={y + 6 * f} anchor="start" size={0.9} color={color} weight={650}>
      {children}
    </Txt>
  );
}

/** Tall i en avrundet brikke med svak fyll i fargen. */
function Chip({ x, y, h, text, color }: { x: number; y: number; h: number; text: string; color: string }) {
  const f = useTextScale();
  const ss = useStrokeScale();
  const fs = 17 * f * 0.95;
  const w = Math.max(h * 1.4, text.length * fs * 0.62 + 18 * f);
  return (
    <g>
      <rect x={x - w / 2} y={y - h / 2} width={w} height={h} rx={h * 0.32} fill={alpha(color, 0.12)} stroke={alpha(color, 0.65)} strokeWidth={1.2 * ss} />
      <Txt x={x} y={y + fs * 0.35} size={0.95} weight={700} color={color} halo={false}>
        {text}
      </Txt>
    </g>
  );
}
