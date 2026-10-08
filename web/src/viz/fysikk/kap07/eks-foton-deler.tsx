/**
 * Gjenstander til eksempeloppgaven «Fotoner fra laserpekere» som bare dette kapittelet trenger: laserpeker,
 * laboratoriestativ med klemmer, en liten hvit skjerm med lysprikker, en DNA-tråd (med skade) og varmestreker.
 * Samme stil som scene-kit-et: toninger fra core.tsx, SCENE- og PAINTS-farger, kontur og myk skygge.
 */
import {
  ContactShadow,
  LinearGradient,
  PAINTS,
  RadialGradient,
  SCENE,
  alpha,
  bolgelengdeFarge,
  materialStops,
  mix,
  shade,
  tint,
  useStrokeScale,
  useSvgId,
} from '../../kit/scene';

const r2 = (v: number) => Math.round(v * 100) / 100;

/* ---------- Laserpeker ---------- */

/**
 * Laserpeker sett fra siden, som peker mot høyre: sylinder i børstet metall med farget ring ved hodet (rød eller
 * grønn, så de to kan skilles), trykknapp og lommeklips. Ankerpunkt: (x, y) er midt i åpningen foran, der strålen
 * kommer ut. `lengde` er hele lengden, `r` radien til røret.
 */
export function Laserpeker({
  x,
  y,
  lengde = 76,
  r = 5.5,
  bolgelengde,
  paa = true,
}: {
  x: number;
  y: number;
  lengde?: number;
  r?: number;
  /** Bølgelengden (nm) gir fargen på ringen og lyset i åpningen. */
  bolgelengde: number;
  paa?: boolean;
}) {
  const ss = useStrokeScale();
  const body = useSvgId('laser-ror');
  const head = useSvgId('laser-hode');
  const glow = useSvgId('laser-glod');
  const color = bolgelengdeFarge(bolgelengde, false);
  const metal = SCENE.metal;
  const back = x - lengde;
  const headL = lengde * 0.2;
  const rh = r * 1.12;
  // Toning for en sylinder sett fra siden: lys stripe litt over midten, mørk underkant.
  const cyl = (c: string) =>
    [
      [0, shade(c, 0.1)],
      [0.22, tint(c, 0.55)],
      [0.45, tint(c, 0.1)],
      [1, shade(c, 0.45)],
    ] as [number, string][];
  return (
    <g>
      <LinearGradient id={body} stops={cyl(shade(metal, 0.15))} />
      <LinearGradient id={head} stops={cyl(metal)} />
      {/* Røret med avrundet bakende */}
      <rect x={back} y={y - r} width={lengde - headL + 2} height={2 * r} rx={r * 0.7} fill={`url(#${body})`} stroke={SCENE.outline} strokeWidth={0.9 * ss} />
      {/* Lommeklips langs oversiden */}
      <path
        d={`M${r2(back + lengde * 0.12)} ${r2(y - r - 1.6)}H${r2(back + lengde * 0.44)}Q${r2(back + lengde * 0.47)} ${r2(y - r - 1.6)} ${r2(back + lengde * 0.47)} ${r2(y - r + 1)}`}
        fill="none"
        stroke={shade(metal, 0.35)}
        strokeWidth={1.8 * ss}
        strokeLinecap="round"
      />
      {/* Trykknapp */}
      <rect x={back + lengde * 0.55} y={y - r - 2.4} width={lengde * 0.11} height={3.4} rx={1.4} fill={shade(PAINTS.svart, 0.1)} stroke={SCENE.outline} strokeWidth={0.6 * ss} />
      {/* Farget ring mellom røret og hodet */}
      <rect x={x - headL - 4} y={y - rh} width={5} height={2 * rh} rx={1} fill={color} stroke={shade(color, 0.4)} strokeWidth={0.7 * ss} />
      {/* Hodet */}
      <rect x={x - headL + 1} y={y - rh} width={headL - 1} height={2 * rh} rx={1.6} fill={`url(#${head})`} stroke={SCENE.outline} strokeWidth={0.9 * ss} />
      <line x1={x - headL * 0.45} y1={y - rh + 1} x2={x - headL * 0.45} y2={y + rh - 1} stroke={shade(metal, 0.3)} strokeWidth={0.8 * ss} opacity={0.7} />
      {/* Åpningen, som lyser når laseren er på */}
      <ellipse cx={x - 0.6} cy={y} rx={1.6} ry={r * 0.55} fill={shade(PAINTS.svart, 0.2)} />
      {paa && (
        <>
          <RadialGradient
            id={glow}
            stops={[
              [0, tint(color, 0.6), 0.95],
              [0.35, color, 0.55],
              [1, color, 0],
            ]}
          />
          <circle cx={x} cy={y} r={r * 2.1} fill={`url(#${glow})`} />
        </>
      )}
    </g>
  );
}

/* ---------- Stativ med klemmer ---------- */

/**
 * Laboratoriestativ: tung fotplate, loddrett stang og en muffe med klemme for hver laserpeker. Ankerpunkt: (x, y) er
 * midt under fotplata, på benken. Stanga står i `x`; hver klemme holder en laserpeker midt på røret i (`tilX`, y).
 */
export function Stativ({ x, y, topp, klemmer }: { x: number; y: number; topp: number; klemmer: { y: number; tilX: number; r: number }[] }) {
  const ss = useStrokeScale();
  const plate = useSvgId('stativ-plate');
  const rod = useSvgId('stativ-stang');
  const pw = 64;
  const ph = 7;
  return (
    <g>
      <ContactShadow cx={x + 10} cy={y} rx={pw * 0.55} ry={3} />
      <LinearGradient id={plate} stops={materialStops(shade(SCENE.metalDark, 0.1), 0.8)} />
      <rect x={x - 18} y={y - ph} width={pw} height={ph} rx={2} fill={`url(#${plate})`} stroke={SCENE.outline} strokeWidth={0.9 * ss} />
      <LinearGradient
        id={rod}
        x2={1}
        y2={0}
        stops={[
          [0, shade(SCENE.metal, 0.2)],
          [0.35, tint(SCENE.metal, 0.5)],
          [1, shade(SCENE.metal, 0.35)],
        ]}
      />
      <rect x={x - 2.6} y={topp} width={5.2} height={y - ph - topp + 1} rx={2} fill={`url(#${rod})`} stroke={SCENE.outline} strokeWidth={0.8 * ss} />
      {klemmer.map((k, i) => {
        const jaw = k.r + 3.2;
        return (
          <g key={i}>
            {/* Arm fra muffen til klemmen */}
            <rect x={x} y={k.y - 1.8} width={k.tilX - x - 4} height={3.6} rx={1.5} fill={`url(#${rod})`} stroke={SCENE.outline} strokeWidth={0.7 * ss} />
            {/* Muffe på stanga, med skrue */}
            <rect x={x - 6} y={k.y - 7} width={12} height={14} rx={2} fill={shade(SCENE.metalDark, 0.05)} stroke={SCENE.outline} strokeWidth={0.8 * ss} />
            <circle cx={x - 8.5} cy={k.y} r={2.4} fill={shade(SCENE.metal, 0.25)} stroke={SCENE.outline} strokeWidth={0.6 * ss} />
            {/* Klemmen rundt røret (bak røret: bare kjeven over og under synes) */}
            <rect x={k.tilX - 6} y={k.y - jaw} width={12} height={2 * jaw} rx={3} fill={shade(SCENE.metalDark, 0.1)} stroke={SCENE.outline} strokeWidth={0.8 * ss} />
          </g>
        );
      })}
    </g>
  );
}

/* ---------- Skjerm ---------- */

/**
 * Liten hvit skjerm på fot, dreid litt mot betrakteren så framsiden synes. Ankerpunkt: (x, y) er midt under foten,
 * på benken. Flaten går fra x − 12 til x + 12; strålene treffer midt på, i x. Tegn lysprikkene (Lysprikk) etter
 * strålene.
 */
export function Skjerm({ x, y, hoyde }: { x: number; y: number; hoyde: number }) {
  const ss = useStrokeScale();
  const face = useSvgId('skjerm-flate');
  const foot = 9;
  const bottom = y - foot - 4;
  const top = bottom - hoyde;
  const l = x - 12;
  const r = x + 12;
  const white = PAINTS.hvit;
  // Framsiden er dreid: venstre kant er nærmest, så den er litt lengre (perspektiv).
  const facePts = `${l},${top + 2} ${r},${top - 4} ${r},${bottom - 4} ${l},${bottom + 2}`;
  const edgePts = `${r},${top - 4} ${r + 5},${top - 2} ${r + 5},${bottom - 2} ${r},${bottom - 4}`;
  return (
    <g>
      <ContactShadow cx={x + 2} cy={y} rx={26} ry={3} />
      {/* Fot og stolpe */}
      <rect x={x - 22} y={y - 5} width={44} height={5} rx={2} fill={shade(SCENE.metalDark, 0.1)} stroke={SCENE.outline} strokeWidth={0.8 * ss} />
      <rect x={x - 2} y={bottom - 2} width={4} height={y - bottom - 3} fill={SCENE.metal} stroke={SCENE.outline} strokeWidth={0.7 * ss} />
      <LinearGradient
        id={face}
        x2={1}
        y2={0}
        stops={[
          [0, tint(white, 0.3)],
          [1, shade(white, 0.1)],
        ]}
      />
      <polygon points={edgePts} fill={shade(white, 0.28)} stroke={SCENE.outline} strokeWidth={0.8 * ss} strokeLinejoin="round" />
      <polygon points={facePts} fill={`url(#${face})`} stroke={SCENE.outline} strokeWidth={0.9 * ss} strokeLinejoin="round" />
    </g>
  );
}

/** Lysprikken der en laserstråle treffer skjermen: lys kjerne og glød i lysets farge. Ankerpunkt: midten. */
export function Lysprikk({ x, y, nm }: { x: number; y: number; nm: number }) {
  const glow = useSvgId('skjerm-prikk');
  const c = bolgelengdeFarge(nm, false);
  return (
    <g>
      <RadialGradient
        id={glow}
        stops={[
          [0, tint(c, 0.7), 1],
          [0.3, c, 0.75],
          [1, c, 0],
        ]}
      />
      <ellipse cx={x} cy={y} rx={9} ry={12} fill={`url(#${glow})`} />
      <ellipse cx={x} cy={y} rx={2.6} ry={3.6} fill={tint(c, 0.6)} />
    </g>
  );
}

/* ---------- DNA ---------- */

/**
 * Et stykke av en DNA-tråd (dobbeltspiral) sett fra siden, vannrett fra x1 til x2 rundt høyden y. Basepar som
 * trinn mellom de to trådene. `skade` er x-koordinater der et basepar er brutt (to halve trinn som er vridd fra
 * hverandre, og en liten stjerne).
 */
export function DnaTraad({
  x1,
  x2,
  y,
  amp = 13,
  bolge = 74,
  skade = [],
}: {
  x1: number;
  x2: number;
  y: number;
  amp?: number;
  /** Lengden på én vinding (figurens enheter). */
  bolge?: number;
  skade?: number[];
}) {
  const ss = useStrokeScale();
  const k = (2 * Math.PI) / bolge;
  const strandA = PAINTS.blaa;
  const strandB = mix(PAINTS.blaa, PAINTS.lilla, 0.55);
  const n = Math.ceil((x2 - x1) / 2);
  const pathFor = (phase: number) => {
    let d = '';
    for (let i = 0; i <= n; i++) {
      const xx = x1 + ((x2 - x1) * i) / n;
      d += `${i === 0 ? 'M' : 'L'}${r2(xx)} ${r2(y + amp * Math.sin(k * (xx - x1) + phase))}`;
    }
    return d;
  };
  // Trinnene (basepar) sitter med fast avstand; fargene veksler som A–T og G–C.
  const step = bolge / 7;
  const rungs: { x: number; ya: number; yb: number; i: number }[] = [];
  for (let xx = x1 + step / 2, i = 0; xx < x2; xx += step, i++) {
    rungs.push({ x: xx, ya: y + amp * Math.sin(k * (xx - x1)), yb: y + amp * Math.sin(k * (xx - x1) + Math.PI), i });
  }
  const broken = new Set(skade.map((sx) => rungs.reduce((best, r) => (Math.abs(r.x - sx) < Math.abs(best.x - sx) ? r : best), rungs[0]!).i));
  const baseColors = [PAINTS.oransje, PAINTS.gronn, PAINTS.gul, PAINTS.rod];
  const strand = (phase: number, color: string) => (
    <>
      <path d={pathFor(phase)} fill="none" stroke={shade(color, 0.45)} strokeWidth={5.2 * ss} strokeLinecap="round" />
      <path d={pathFor(phase)} fill="none" stroke={color} strokeWidth={3.4 * ss} strokeLinecap="round" />
      <path d={pathFor(phase)} fill="none" stroke={tint(color, 0.55)} strokeWidth={1 * ss} strokeLinecap="round" opacity={0.7} transform="translate(0 -1)" />
    </>
  );
  return (
    <g>
      {rungs.map((r) => {
        const c = baseColors[r.i % 4]!;
        const c2 = baseColors[(r.i + 1) % 4 === 0 ? 3 : r.i % 2 === 0 ? 1 : 0]!;
        const mid = (r.ya + r.yb) / 2;
        if (broken.has(r.i)) {
          // To halve basepar som er dratt fra hverandre, og en stjerne der bindingen brøt.
          const gap = 4;
          return (
            <g key={r.i}>
              <line x1={r.x} y1={r.ya} x2={r.x - 4} y2={mid - gap * Math.sign(r.yb - r.ya)} stroke={shade(c, 0.1)} strokeWidth={3 * ss} strokeLinecap="round" />
              <line x1={r.x} y1={r.yb} x2={r.x + 4} y2={mid + gap * Math.sign(r.yb - r.ya)} stroke={shade(c2, 0.1)} strokeWidth={3 * ss} strokeLinecap="round" />
              <Burst x={r.x} y={mid} r={9} />
            </g>
          );
        }
        return (
          <g key={r.i}>
            <line x1={r.x} y1={r.ya} x2={r.x} y2={mid} stroke={c} strokeWidth={2.6 * ss} strokeLinecap="round" />
            <line x1={r.x} y1={mid} x2={r.x} y2={r.yb} stroke={c2} strokeWidth={2.6 * ss} strokeLinecap="round" />
          </g>
        );
      })}
      {strand(Math.PI, strandB)}
      {strand(0, strandA)}
    </g>
  );
}

/** Liten stjerne der en binding brytes (skade). */
export function Burst({ x, y, r }: { x: number; y: number; r: number }) {
  const ss = useStrokeScale();
  const pts: string[] = [];
  for (let i = 0; i < 16; i++) {
    const a = (i * Math.PI) / 8 + 0.2;
    const rr = i % 2 === 0 ? r : r * 0.45;
    pts.push(`${r2(x + rr * Math.cos(a))},${r2(y + rr * Math.sin(a))}`);
  }
  return <polygon points={pts.join(' ')} fill={tint(SCENE.hot, 0.25)} stroke={shade(SCENE.hot, 0.35)} strokeWidth={0.9 * ss} strokeLinejoin="round" />;
}

/* ---------- Varme ---------- */

/** Tre små bølgete streker som stiger opp fra (x, y): energien blir til varme. */
export function Varme({ x, y, h = 18 }: { x: number; y: number; h?: number }) {
  const ss = useStrokeScale();
  const line = (dx: number, hh: number) => {
    const x0 = x + dx;
    return `M${r2(x0)} ${r2(y)}C${r2(x0 - 4)} ${r2(y - hh * 0.3)} ${r2(x0 + 4)} ${r2(y - hh * 0.6)} ${r2(x0)} ${r2(y - hh)}`;
  };
  return (
    <g fill="none" strokeLinecap="round">
      {[
        [-6, h * 0.8],
        [0, h],
        [6, h * 0.8],
      ].map(([dx, hh], i) => (
        <g key={i}>
          <path d={line(dx!, hh!)} stroke={alpha(SCENE.outline, 0.35)} strokeWidth={3.2 * ss} />
          <path d={line(dx!, hh!)} stroke={SCENE.warm} strokeWidth={1.8 * ss} />
        </g>
      ))}
    </g>
  );
}
