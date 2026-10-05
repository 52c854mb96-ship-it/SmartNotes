/**
 * Felles tegning for kapittel 10: et gjellefilament med lameller, sett skrått forfra (som i lærebøkene), brukt i
 * «Motstrøm i gjellene» og i «Gassutveksling og kroppsstørrelse».
 *
 * Anatomien: gjellebuen bærer mange gjellefilamenter; hvert filament har tettpakkede, tynne lameller på over- og
 * undersiden. Lamellene står på tvers av filamentet, og vannet strømmer mellom dem fra den ene kanten av filamentet til
 * den andre. Inne i lamellene strømmer blodet motsatt vei (motstrøm): det kommer oksygenfattig inn ved kanten der vannet
 * går ut, og går oksygenrikt ut ved kanten der det friske vannet kommer inn.
 */
import type { ReactNode } from 'react';
import { BIO, VIZ, Txt, mixColor, useSvgId, useTextScale } from '../kit';

export interface GillBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

type P = readonly [number, number];
const pts = (list: readonly P[]) => list.map((p) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ');

/** Pil fra a til b med spiss (strektykkelse `sw`). */
function FlowArrow({ a, b, color, sw }: { a: P; b: P; color: string; sw: number }) {
  const ang = Math.atan2(b[1] - a[1], b[0] - a[0]);
  const hd = 10 * sw;
  const c: P = [b[0] - Math.cos(ang) * hd, b[1] - Math.sin(ang) * hd];
  const n: P = [-Math.sin(ang) * hd * 0.55, Math.cos(ang) * hd * 0.55];
  return (
    <g>
      <line x1={a[0]} y1={a[1]} x2={c[0]} y2={c[1]} stroke={color} strokeWidth={3.2 * sw} strokeLinecap="round" />
      <polygon points={pts([b, [c[0] + n[0], c[1] + n[1]], [c[0] - n[0], c[1] - n[1]]])} fill={color} />
    </g>
  );
}

/**
 * Gjellefilament med lameller i en boks. `flow` velger blodets retning i lamellene (motstrøm er det fisken har; medstrøm
 * er et tankeeksperiment). `highlight` fremhever lamellen som er forstørret i en annen figur. `labels` slår av etikettene.
 */
export function GjelleFilament({
  box,
  flow = 'motstrom',
  highlight = false,
  labels = true,
}: {
  box: GillBox;
  flow?: 'motstrom' | 'medstrom';
  highlight?: boolean;
  labels?: boolean;
}) {
  const f = useTextScale();
  const gid = useSvgId('lamell');
  const sw = Math.max(1, f * 0.75);
  // Tegneflaten holder seg omtrent 5:4, midt i boksen (resten er luft)
  const w = Math.min(box.w, box.h * 1.3);
  const h = Math.min(box.h, w / 1.05);
  const ox = box.x + (box.w - w) / 2;
  const oy = box.y + (box.h - h) / 2;
  const X = (u: number) => ox + u * w;
  const Y = (v: number) => oy + v * h;
  // Filamentet går mot høyre; dybden (på tvers av filamentet, vannets retning) går skrått opp mot høyre
  const u0 = 0.1;
  const u1 = 0.86;
  const vTop = 0.56;
  const tk = 0.07;
  const du = 0.13;
  const dv = -0.16;
  const hL = 0.2;
  const n = 6;
  const plateU = Array.from({ length: n }, (_, i) => 0.17 + (i * (u1 - du - 0.2)) / (n - 1));
  const hi = n - 2;
  const front = (u: number, v: number): P => [X(u), Y(v)];
  const back = (u: number, v: number): P => [X(u + du), Y(v + dv)];
  const fil = BIO.rodtBlodlegeme;
  const lamFill = mixColor(fil.fill, VIZ.surface, 0.3);
  const plateTop = (u: number) => [front(u, vTop), back(u, vTop), back(u, vTop - hL), front(u, vTop - hL)] as const;
  const plateBottom = (u: number) => [front(u, vTop + tk), back(u, vTop + tk), back(u, vTop + tk + hL * 0.75), front(u, vTop + tk + hL * 0.75)] as const;
  // Motstrøm: blodet kommer inn bak (oksygenfattig) og går ut foran (oksygenrikt), der vannet kommer inn
  const counter = flow === 'motstrom';
  const inEdge = (u: number, v: number) => (counter ? back(u, v) : front(u, v));
  const outEdge = (u: number, v: number) => (counter ? front(u, v) : back(u, v));
  const water = BIO.vann;
  // Vann mellom lamell i og i + 1, fra forkanten til bakkanten
  const waterArrow = (i: number): ReactNode => {
    const um = (plateU[i]! + plateU[i + 1]!) / 2;
    const v = vTop - hL * 0.55;
    const a: P = [X(um - du * 0.7), Y(v - dv * 0.7)];
    const b: P = [X(um + du * 1.6), Y(v + dv * 1.6)];
    return <FlowArrow key={`w${i}`} a={a} b={b} color={water} sw={sw} />;
  };
  const hu = plateU[hi]!;
  const bv = vTop - hL * 0.5;
  const bA = inEdge(hu, bv);
  const bB = outEdge(hu, bv);
  const bS: P = [bA[0] + (bB[0] - bA[0]) * 0.12, bA[1] + (bB[1] - bA[1]) * 0.12];
  const bE: P = [bA[0] + (bB[0] - bA[0]) * 0.88, bA[1] + (bB[1] - bA[1]) * 0.88];
  // Spissen av den første vannpila (etiketten «vann» står ved den)
  const wEnd: P = [X((plateU[0]! + plateU[1]!) / 2 + du * 1.6), Y(vTop - hL * 0.55 + dv * 1.6)];
  return (
    <g>
      <defs>
        {/* Blodet i lamellene: oksygenfattig der det kommer inn, oksygenrikt der det går ut */}
        <linearGradient id={gid} x1={counter ? 1 : 0} y1={counter ? 0 : 1} x2={counter ? 0 : 1} y2={counter ? 1 : 0}>
          <stop offset="0" style={{ stopColor: mixColor(BIO.oksygenfattig, VIZ.surface, 0.45) }} />
          <stop offset="1" style={{ stopColor: mixColor(BIO.oksygenrikt, VIZ.surface, 0.45) }} />
        </linearGradient>
      </defs>
      {/* Gjellebuen (bein) til venstre */}
      <path
        d={`M${X(0.06)},${Y(0.14)} Q${X(0.0)},${Y(0.6)} ${X(0.06)},${Y(0.98)}`}
        fill="none"
        stroke={BIO.fisk.line}
        strokeOpacity={0.4}
        strokeWidth={14 * sw}
        strokeLinecap="round"
      />
      {/* Lameller under filamentet */}
      {plateU.map((u) => (
        <polygon key={`b${u}`} points={pts(plateBottom(u))} fill={lamFill} stroke={fil.line} strokeWidth={1.1 * sw} strokeLinejoin="round" />
      ))}
      {/* Filamentet: forsiden, oversiden og enden */}
      <polygon points={pts([front(u0, vTop), front(u1, vTop), front(u1, vTop + tk), front(u0, vTop + tk)])} fill={fil.fill} stroke={fil.line} strokeWidth={1.3 * sw} strokeLinejoin="round" />
      <polygon points={pts([front(u0, vTop), front(u1, vTop), back(u1, vTop), back(u0, vTop)])} fill={mixColor(fil.fill, VIZ.surface, 0.15)} stroke={fil.line} strokeWidth={1.3 * sw} strokeLinejoin="round" />
      <polygon points={pts([front(u1, vTop), back(u1, vTop), back(u1, vTop + tk), front(u1, vTop + tk)])} fill={mixColor(fil.fill, fil.line, 0.3)} stroke={fil.line} strokeWidth={1.3 * sw} strokeLinejoin="round" />
      {/* Lameller på oversiden, bakerst (til venstre) først, med vannet mellom */}
      {plateU.map((u, i) => (
        <g key={`t${u}`}>
          <polygon
            points={pts(plateTop(u))}
            style={{ fill: `url(#${gid})` }}
            fillOpacity={0.9}
            stroke={i === hi && highlight ? VIZ.ink : fil.line}
            strokeWidth={(i === hi && highlight ? 2.6 : 1.1) * sw}
            strokeLinejoin="round"
          />
          {(i === 0 || i === 2) && waterArrow(i)}
        </g>
      ))}
      {/* Blodet i den fremhevede lamellen */}
      <FlowArrow a={bS} b={bE} color={BIO.oksygenrikt} sw={sw * 0.85} />
      {labels && (
        <g>
          <Txt x={X(0.02)} y={Y(0.08)} anchor="start" size={0.75} weight={650} muted>
            gjellebue
          </Txt>
          <Txt x={X((u0 + u1) / 2 + 0.04)} y={Y(vTop + tk + hL * 0.75) + 20 * f} size={0.75} weight={650} muted>
            gjellefilament med lameller
          </Txt>
          <Txt x={wEnd[0] + 4} y={wEnd[1] - 8} anchor="start" size={0.8} weight={700} color={water}>
            vann
          </Txt>
          <Txt x={X(hu + du * 0.5 + 0.05)} y={Y(vTop - hL + dv) - 6 - 18 * f} anchor="start" size={0.8} weight={700} color={BIO.oksygenrikt}>
            blod
          </Txt>
        </g>
      )}
    </g>
  );
}
