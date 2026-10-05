/**
 * Symboler for kandidatene i «Hva er liv?»: bakterie og virus fra kit-et, resten tegnet her i samme rolige stil
 * (flate former i en boks på 40 × 40 rundt (0, 0), farget med BIO).
 */
import type { ReactNode } from 'react';
import { BIO, Bakterie, Virus, VIZ, useLineScale } from '../kit';
import type { CandidateId } from './model';

interface GProps {
  x: number;
  y: number;
  size?: number;
  title?: string;
}

/** Flytt og skaler fra 40 × 40, og hold strekene like tykke uansett størrelse. */
function G({ x, y, size = 40, title, children }: GProps & { children: (sw: (w: number) => number) => ReactNode }) {
  const lw = useLineScale();
  const k = size / 40;
  const sw = (w: number) => (w * lw) / k;
  return (
    <g transform={`translate(${x} ${y}) scale(${k})`}>
      {title && <title>{title}</title>}
      {children(sw)}
    </g>
  );
}

/** Gjærcelle med knopp (knoppskyting), cellekjerne og vakuole. */
function Gjaer(g: GProps) {
  const p = BIO.sopp;
  return (
    <G {...g}>
      {(sw) => (
        <g>
          <ellipse cx={-3} cy={3} rx={13} ry={11} fill={p.fill} stroke={p.line} strokeWidth={sw(1.6)} />
          <circle cx={11.5} cy={-8.5} r={6.5} fill={p.fill} stroke={p.line} strokeWidth={sw(1.5)} />
          <ellipse cx={-6} cy={5} rx={4.2} ry={3.6} fill={BIO.kjerne.fill} stroke={BIO.kjerne.line} strokeWidth={sw(1.1)} />
          <circle cx={2} cy={-1} r={3.4} fill={BIO.vakuole.fill} stroke={BIO.vakuole.line} strokeWidth={sw(1)} />
        </g>
      )}
    </G>
  );
}

/** Frø: frøskall med et lite plantefoster (kim) og opplagsnæring. */
function Fro(g: GProps) {
  return (
    <G {...g}>
      {(sw) => (
        <g transform="rotate(-24)">
          <ellipse rx={17} ry={11.5} fill={BIO.sopp.fill} stroke={BIO.sopp.line} strokeWidth={sw(1.6)} />
          <ellipse cx={-1} cy={0} rx={13} ry={8} fill={BIO.golgi.fill} stroke={BIO.sopp.line} strokeWidth={sw(0.8)} strokeOpacity={0.6} />
          <path d="M8,-5 Q13,0 8,5 Q4,2 5,-1 Q3,-3 8,-5 Z" fill={BIO.plante.fill} stroke={BIO.plante.line} strokeWidth={sw(1.2)} />
          <path d="M8,5 Q4,8 0,7" fill="none" stroke={BIO.plante.line} strokeWidth={sw(1.4)} strokeLinecap="round" />
        </g>
      )}
    </G>
  );
}

/** Bjørnedyr (tardigrad) i tørkedvale: inntørket tønneform med bena trukket inn. */
function Bjornedyr(g: GProps) {
  const p = BIO.insekt;
  return (
    <G {...g}>
      {(sw) => (
        <g>
          {[-9, -3, 3, 9].map((x) => (
            <circle key={x} cx={x} cy={10.5} r={2} fill={p.fill} stroke={p.line} strokeWidth={sw(1)} />
          ))}
          <path
            d="M-17,0 Q-17,-10 -8,-11 Q0,-13 8,-11 Q17,-10 17,0 Q17,10 8,11 Q0,12 -8,11 Q-17,10 -17,0 Z"
            fill={p.fill}
            stroke={p.line}
            strokeWidth={sw(1.6)}
          />
          {[-9, -3, 3, 9].map((x) => (
            <path key={x} d={`M${x},-10.5 Q${x + 2},0 ${x},10.5`} fill="none" stroke={p.line} strokeOpacity={0.55} strokeWidth={sw(1)} />
          ))}
          <circle cx={-13} cy={-3} r={1.2} fill={p.line} />
        </g>
      )}
    </G>
  );
}

/** Prion: et feilfoldet protein. Normalt har proteinet spiraler (α-heliks); feilfoldet blir det flate β-flak (piler). */
function Prion(g: GProps) {
  const c = BIO.er.line;
  const helix: string[] = ['M-18,-10'];
  for (let i = 0; i < 4; i++) helix.push(`q2.5,-7 5,0 q-1.2,5 -2.2,0`);
  return (
    <G {...g}>
      {(sw) => (
        <g fill="none" strokeLinecap="round" strokeLinejoin="round">
          <path d={helix.join(' ')} stroke={c} strokeWidth={sw(1.6)} />
          <path d="M-7,-10 Q2,-14 4,-8 Q5,-3 -2,-3" stroke={c} strokeWidth={sw(1.4)} />
          {[-1, 6, 13].map((y, i) => (
            <path
              key={i}
              d={i % 2 ? `M14,${y} H-12 l3,-3.2 M-12,${y} l3,3.2` : `M-14,${y} H12 l-3,-3.2 M12,${y} l-3,3.2`}
              stroke={c}
              strokeWidth={sw(2.2)}
            />
          ))}
          <path d="M12,-1 Q17,2.5 14,6 M-12,6 Q-17,9.5 -14,13" stroke={c} strokeWidth={sw(1.4)} />
        </g>
      )}
    </G>
  );
}

/** Ild: flamme over to vedkubber. */
function Ild(g: GProps) {
  return (
    <G {...g}>
      {(sw) => (
        <g strokeLinejoin="round">
          <path d="M-16,17 L14,10 M-14,10 L16,17" stroke={BIO.ved} strokeWidth={sw(5)} strokeLinecap="round" />
          <path
            d="M0,-19 Q12,-6 11,4 Q10,13 0,13 Q-11,13 -11,3 Q-11,-5 -5,-9 Q-5,-3 -1,-2 Q-2,-11 0,-19 Z"
            fill={BIO.atp}
            fillOpacity={0.35}
            stroke={BIO.atp}
            strokeWidth={sw(1.6)}
          />
          <path d="M1,-5 Q7,2 5,7 Q3,11 -1,11 Q-5,10 -5,6 Q-4,1 1,-5 Z" fill={BIO.golgi.fill} stroke={BIO.sukker} strokeWidth={sw(1.2)} />
        </g>
      )}
    </G>
  );
}

/** Krystall: terning (som saltkrystall) sett skrått ovenfra, med en mindre krystall som vokser på siden. */
function Krystall(g: GProps) {
  const p = BIO.vakuole;
  const cube = (s: number, ox: number, oy: number) => {
    const a = s * 0.5;
    return {
      top: `M${ox},${oy - s} L${ox + s},${oy - s + a} L${ox},${oy - s + 2 * a} L${ox - s},${oy - s + a} Z`,
      left: `M${ox - s},${oy - s + a} L${ox},${oy - s + 2 * a} L${ox},${oy + 2 * a} L${ox - s},${oy + a} Z`,
      right: `M${ox + s},${oy - s + a} L${ox},${oy - s + 2 * a} L${ox},${oy + 2 * a} L${ox + s},${oy + a} Z`,
    };
  };
  const big = cube(13, -3, -2);
  const small = cube(6, 13, 7);
  return (
    <G {...g}>
      {(sw) => (
        <g strokeLinejoin="round" stroke={p.line} strokeWidth={sw(1.4)}>
          {[big, small].map((c, i) => (
            <g key={i}>
              <path d={c.left} fill={p.fill} />
              <path d={c.right} fill={p.line} fillOpacity={0.35} />
              <path d={c.top} fill={VIZ.surface} />
            </g>
          ))}
        </g>
      )}
    </G>
  );
}

export function CandidateGlyph({ id, x, y, size = 40, title }: { id: CandidateId; x: number; y: number; size?: number; title?: string }) {
  const g = { x, y, size, title };
  switch (id) {
    case 'bakterie':
      return <Bakterie {...g} form="stav" />;
    case 'gjaer':
      return <Gjaer {...g} />;
    case 'fro':
      return <Fro {...g} />;
    case 'bjornedyr':
      return <Bjornedyr {...g} />;
    case 'virus':
      return <Virus {...g} type="bakteriofag" />;
    case 'prion':
      return <Prion {...g} />;
    case 'ild':
      return <Ild {...g} />;
    case 'krystall':
      return <Krystall {...g} />;
  }
}
