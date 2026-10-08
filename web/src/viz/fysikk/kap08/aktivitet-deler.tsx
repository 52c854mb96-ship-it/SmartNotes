/**
 * Gjenstandene i eksempeloppgaven «Aktivitet og halveringstid i medisin» (k8-eks-aktivitet): aktivitetsmåleren på
 * sykehuslaben (et brønnkammer med sprøyta eller medisinflaska i brønnen, og en avleser med display) og
 * undersøkelsesbenken med pasienten og strålingen som kommer ut av kroppen. De finnes ikke i scene-kit-et, så de er
 * laget her i samme stil: toninger fra core.tsx, SCENE-farger, kontur og myk skygge. Mål i meter, tegnet med skalaen
 * P (px/m). y-aksen peker ned som i SVG.
 */
import { VIZ } from '../../kit';
import {
  ContactShadow,
  Foton,
  LinearGradient,
  PAINTS,
  Person,
  RadialGradient,
  SCENE,
  alpha,
  materialStops,
  mix,
  sceneRandom,
  shade,
  sphereStops,
  tint,
  useStrokeScale,
  useSvgId,
} from '../../kit/scene';
import { Faresymbol } from './halveringstid-deler';

const r2 = (v: number) => Math.round(v * 100) / 100;

/** Fargen til γ-strålingen (samme som fotonene i resten av kapittelet). */
export const GAMMA = VIZ.series[3]!;

/* ---------- Aktivitetsmåleren ---------- */

/** Brønnkammeret (m): bredde og høyde. Brønnen er hullet i toppen der sprøyta eller flaska senkes ned. */
export const KAMMER = { w: 0.2, h: 0.34, well: 0.05 } as const;
/** Avleseren (m). */
export const AVLESER = { w: 0.34, h: 0.2 } as const;

export type Kilde = 'sproyte' | 'flaske';

/**
 * Brønnkammeret i aktivitetsmåleren: en tykk, blyskjermet sylinder med en brønn i toppen. Sprøyta (eller flaska i en
 * holder) står nede i brønnen, så bare toppen stikker opp. (x, y) er midt på bunnen, på benken.
 */
export function Bronnkammer({ x, y, P, kilde }: { x: number; y: number; P: number; kilde: Kilde }) {
  const id = useSvgId('ak-kammer');
  const ss = useStrokeScale();
  const w = KAMMER.w * P;
  const h = KAMMER.h * P;
  const left = x - w / 2;
  const top = y - h;
  const ry = 0.024 * P;
  const body = mix(PAINTS.hvit, PAINTS.blaa, 0.16);
  const wr = KAMMER.well * P;
  const wry = wr * (ry / (w / 2));
  const band = { y: y - 0.085 * P, h: 0.05 * P };
  return (
    <g>
      <title>Aktivitetsmåler: brønnkammer</title>
      <ContactShadow cx={x} cy={y} rx={w * 0.62} />
      <LinearGradient
        id={`${id}b`}
        x1={0}
        y1={0}
        x2={1}
        y2={0}
        stops={[
          [0, shade(body, 0.14)],
          [0.26, tint(body, 0.4)],
          [0.6, body],
          [1, shade(body, 0.34)],
        ]}
      />
      <LinearGradient
        id={`${id}r`}
        x1={0}
        y1={0}
        x2={1}
        y2={0}
        stops={[
          [0, shade(PAINTS.graa, 0.25)],
          [0.26, tint(PAINTS.graa, 0.15)],
          [0.6, PAINTS.graa],
          [1, shade(PAINTS.graa, 0.45)],
        ]}
      />
      <clipPath id={`${id}c`}>
        <path
          d={`M${r2(x - wr)},${r2(top - 0.2 * P)} L${r2(x + wr)},${r2(top - 0.2 * P)} L${r2(x + wr)},${r2(top)} A${r2(wr)} ${r2(wry)} 0 0 1 ${r2(x - wr)},${r2(top)} Z`}
        />
      </clipPath>
      {/* Sylinderen */}
      <path
        d={`M${r2(left)},${r2(top)} L${r2(left)},${r2(y - ry * 0.5)} A${r2(w / 2)} ${r2(ry * 0.5)} 0 0 0 ${r2(left + w)},${r2(y - ry * 0.5)} L${r2(left + w)},${r2(top)} Z`}
        fill={`url(#${id}b)`}
        stroke={SCENE.outline}
        strokeWidth={1.1 * ss}
      />
      {/* Grått bånd nederst (blyskjermingen) med et lite skilt */}
      <path
        d={`M${r2(left)},${r2(band.y)} A${r2(w / 2)} ${r2(ry * 0.5)} 0 0 0 ${r2(left + w)},${r2(band.y)} L${r2(left + w)},${r2(band.y + band.h)} A${r2(w / 2)} ${r2(ry * 0.5)} 0 0 1 ${r2(left)},${r2(band.y + band.h)} Z`}
        fill={`url(#${id}r)`}
        stroke={alpha(SCENE.outline, 0.7)}
        strokeWidth={0.8 * ss}
      />
      <rect x={x - 0.035 * P} y={top + 0.07 * P} width={0.07 * P} height={0.05 * P} rx={0.004 * P} fill={PAINTS.hvit} stroke={alpha(SCENE.outline, 0.6)} strokeWidth={0.7 * ss} />
      <Faresymbol x={x} y={top + 0.095 * P} r={0.017 * P} />
      {/* Toppen med brønnen */}
      <ellipse cx={x} cy={top} rx={w / 2} ry={ry} fill={tint(body, 0.3)} stroke={SCENE.outline} strokeWidth={1.1 * ss} />
      <ellipse cx={x} cy={top + 0.002 * P} rx={wr * 1.4} ry={wry * 1.4} fill={shade(body, 0.12)} />
      <ellipse cx={x} cy={top} rx={wr} ry={wry} fill={shade(SCENE.plastic, 0.78)} stroke={alpha(SCENE.outline, 0.8)} strokeWidth={0.8 * ss} />
      <g clipPath={`url(#${id}c)`}>{kilde === 'sproyte' ? <Sproyte x={x} y={top} P={P} /> : <FlaskeIHolder x={x} y={top} P={P} />}</g>
      {/* Forkanten av brønnen foran det som står i den */}
      <path d={`M${r2(x + wr)},${r2(top)} A${r2(wr)} ${r2(wry)} 0 0 1 ${r2(x - wr)},${r2(top)}`} fill="none" stroke={shade(body, 0.2)} strokeWidth={1.6 * ss} />
    </g>
  );
}

/** Sprøyte i brønnen: sylinder i klar plast med væske, fingergrep og stempel. (x, y) er der den går ned i brønnen. */
function Sproyte({ x, y, P }: { x: number; y: number; P: number }) {
  const id = useSvgId('ak-sproyte');
  const ss = useStrokeScale();
  const bw = 0.022 * P;
  const barrelTop = y - 0.045 * P;
  const flange = { w: 0.042 * P, h: 0.006 * P };
  const rodTop = y - 0.09 * P;
  const rw = 0.01 * P;
  const liquidTop = y - 0.012 * P;
  return (
    <g>
      <LinearGradient
        id={`${id}g`}
        x1={0}
        y1={0}
        x2={1}
        y2={0}
        stops={[
          [0, alpha(SCENE.glassEdge, 0.55)],
          [0.3, alpha(SCENE.glass, 0.25)],
          [0.7, alpha(SCENE.glass, 0.15)],
          [1, alpha(SCENE.glassEdge, 0.6)],
        ]}
      />
      {/* Stempelstang og trykkplate */}
      <rect x={x - rw / 2} y={rodTop} width={rw} height={barrelTop - rodTop + 0.01 * P} fill={tint(SCENE.plastic, 0.55)} stroke={SCENE.outline} strokeWidth={0.8 * ss} />
      <rect x={x - 0.016 * P} y={rodTop - 0.005 * P} width={0.032 * P} height={0.006 * P} rx={0.002 * P} fill={tint(SCENE.plastic, 0.6)} stroke={SCENE.outline} strokeWidth={0.8 * ss} />
      {/* Sylinderen med væske */}
      <rect x={x - bw / 2} y={liquidTop} width={bw} height={y + 0.05 * P - liquidTop} fill={alpha(tint(SCENE.water, 0.35), 0.75)} />
      <rect x={x - bw / 2} y={barrelTop} width={bw} height={y + 0.05 * P - barrelTop} fill={`url(#${id}g)`} stroke={SCENE.outline} strokeWidth={0.8 * ss} />
      {/* Gummistempelet inne i sylinderen */}
      <rect x={x - bw / 2 + 0.5} y={liquidTop - 0.006 * P} width={bw - 1} height={0.006 * P} fill={SCENE.rubber} />
      {/* Fingergrep */}
      <rect x={x - flange.w / 2} y={barrelTop - flange.h / 2} width={flange.w} height={flange.h} rx={flange.h / 2} fill={tint(SCENE.plastic, 0.5)} stroke={SCENE.outline} strokeWidth={0.8 * ss} />
      {/* Gul etikett */}
      <rect x={x - bw / 2 + 0.5} y={y - 0.03 * P} width={bw - 1} height={0.014 * P} fill={PAINTS.gul} opacity={0.9} />
    </g>
  );
}

/** Medisinflaske i en holder av plast: aluminiumshette øverst og et håndtak til å senke den ned i brønnen. */
function FlaskeIHolder({ x, y, P }: { x: number; y: number; P: number }) {
  const id = useSvgId('ak-flaske');
  const ss = useStrokeScale();
  const bw = 0.034 * P;
  const neckTop = y - 0.022 * P;
  const cap = { w: 0.026 * P, h: 0.012 * P };
  const handleX = x + 0.03 * P;
  const handleTop = y - 0.1 * P;
  return (
    <g>
      <LinearGradient
        id={`${id}g`}
        x1={0}
        y1={0}
        x2={1}
        y2={0}
        stops={[
          [0, alpha(SCENE.glassEdge, 0.6)],
          [0.3, alpha(SCENE.glass, 0.3)],
          [1, alpha(SCENE.glassEdge, 0.65)],
        ]}
      />
      <LinearGradient id={`${id}a`} x1={0} y1={0} x2={1} y2={0} stops={materialStops(SCENE.metalLight, 1.2)} />
      {/* Holderen: stang og ring til å løfte i */}
      <rect x={handleX - 0.004 * P} y={handleTop} width={0.008 * P} height={y + 0.04 * P - handleTop} fill={alpha(tint(SCENE.plastic, 0.4), 0.9)} stroke={SCENE.outline} strokeWidth={0.7 * ss} />
      <circle cx={handleX} cy={handleTop - 0.008 * P} r={0.011 * P} fill="none" stroke={tint(SCENE.plastic, 0.35)} strokeWidth={0.006 * P} />
      <circle cx={handleX} cy={handleTop - 0.008 * P} r={0.011 * P} fill="none" stroke={SCENE.outline} strokeWidth={0.6 * ss} opacity={0.6} />
      {/* Flaska */}
      <rect x={x - bw / 2} y={neckTop + 0.012 * P} width={bw} height={0.05 * P} rx={0.004 * P} fill={`url(#${id}g)`} stroke={SCENE.outline} strokeWidth={0.8 * ss} />
      <rect x={x - bw / 2 + 1} y={neckTop + 0.03 * P} width={bw - 2} height={0.04 * P} fill={alpha(tint(SCENE.water, 0.3), 0.7)} />
      <rect x={x - cap.w / 2} y={neckTop - cap.h + 0.012 * P} width={cap.w} height={cap.h} rx={0.002 * P} fill={`url(#${id}a)`} stroke={SCENE.outline} strokeWidth={0.8 * ss} />
      <rect x={x - cap.w * 0.3} y={neckTop - cap.h + 0.009 * P} width={cap.w * 0.6} height={0.004 * P} rx={0.002 * P} fill={SCENE.rubber} />
    </g>
  );
}

/**
 * Avleseren til aktivitetsmåleren: kasse med stort display som viser stoffet og aktiviteten i MBq, og en rad med
 * knapper. (x, y) er midt på bunnen.
 */
export function Avleser({ x, y, P, nuklide, verdi }: { x: number; y: number; P: number; nuklide: string; verdi: string }) {
  const id = useSvgId('ak-avleser');
  const ss = useStrokeScale();
  const W = AVLESER.w * P;
  const H = AVLESER.h * P;
  const left = x - W / 2;
  const top = y - H;
  const housing = mix(PAINTS.hvit, PAINTS.graa, 0.3);
  const disp = { x: left + 0.022 * P, y: top + 0.024 * P, w: W - 0.044 * P, h: 0.105 * P };
  const mono = 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';
  return (
    <g>
      <title>Avleser: {verdi} MBq</title>
      <ContactShadow cx={x} cy={y} rx={W * 0.56} />
      <LinearGradient id={`${id}h`} stops={materialStops(housing, 1)} />
      {[-0.4, 0.4].map((k) => (
        <rect key={k} x={x + k * W - 0.012 * P} y={y - 0.006 * P} width={0.024 * P} height={0.006 * P} rx={1} fill={SCENE.rubber} />
      ))}
      <rect x={left} y={top} width={W} height={H - 0.005 * P} rx={0.012 * P} fill={`url(#${id}h)`} stroke={SCENE.outline} strokeWidth={1.1 * ss} />
      <rect x={left + 0.006 * P} y={top + 0.003 * P} width={W - 0.012 * P} height={0.004 * P} rx={1} fill={tint(housing, 0.5)} opacity={0.8} />
      {/* Displayet */}
      <rect x={disp.x - 0.004 * P} y={disp.y - 0.004 * P} width={disp.w + 0.008 * P} height={disp.h + 0.008 * P} rx={0.006 * P} fill={shade(SCENE.plastic, 0.5)} />
      <rect x={disp.x} y={disp.y} width={disp.w} height={disp.h} rx={0.004 * P} fill={SCENE.display} />
      <text x={disp.x + 0.01 * P} y={disp.y + 0.026 * P} style={{ fill: alpha(SCENE.displayText, 0.8), fontSize: 0.022 * P, fontWeight: 600, fontFamily: mono }}>
        {nuklide}
      </text>
      <text
        x={disp.x + disp.w - 0.01 * P}
        y={disp.y + disp.h - 0.016 * P}
        textAnchor="end"
        style={{ fill: SCENE.displayText, fontSize: 0.052 * P, fontWeight: 600, fontFamily: mono, letterSpacing: 0.001 * P }}
      >
        {verdi}
        <tspan style={{ fontSize: 0.026 * P }} dx={0.008 * P}>
          MBq
        </tspan>
      </text>
      {/* Knapper og lampe */}
      {[0, 1, 2, 3].map((i) => (
        <rect
          key={i}
          x={disp.x + i * 0.05 * P}
          y={top + 0.152 * P}
          width={0.038 * P}
          height={0.018 * P}
          rx={0.004 * P}
          fill={tint(SCENE.plastic, 0.25)}
          stroke={alpha(SCENE.outline, 0.7)}
          strokeWidth={0.7 * ss}
        />
      ))}
      <RadialGradient id={`${id}l`} fx={0.35} fy={0.35} stops={sphereStops(PAINTS.gronn)} />
      <circle cx={disp.x + disp.w - 0.01 * P} cy={top + 0.161 * P} r={0.007 * P} fill={`url(#${id}l)`} stroke={SCENE.outline} strokeWidth={0.6 * ss} />
    </g>
  );
}

/** Kabel som ligger på benken mellom to punkter. */
export function Kabel({ x1, y1, x2, y2, bench, P }: { x1: number; y1: number; x2: number; y2: number; bench: number; P: number }) {
  const ss = useStrokeScale();
  const d = `M${r2(x1)},${r2(y1)} C${r2(x1 + 0.04 * P)},${r2(bench + 0.004 * P)} ${r2(x2 - 0.05 * P)},${r2(bench + 0.004 * P)} ${r2(x2)},${r2(y2)}`;
  return (
    <g aria-hidden>
      <path d={d} fill="none" stroke={SCENE.outline} strokeWidth={0.011 * P + 1.6 * ss} strokeLinecap="round" opacity={0.7} />
      <path d={d} fill="none" stroke={shade(SCENE.rubber, 0.1)} strokeWidth={0.011 * P} strokeLinecap="round" />
    </g>
  );
}

/* ---------- Pasienten ---------- */

/** Undersøkelsesbenken (m): lengde, høyde til toppen av madrassen og tykkelsen på madrassen. */
export const BENK = { L: 1.95, h: 0.72, madrass: 0.08 } as const;

/**
 * Undersøkelsesbenk med madrass, papirlaken, pute og stålstell på hjul. (x, y): venstre ende (hodeenden) og gulvet.
 * Toppen av madrassen er i y − BENK.h · P.
 */
export function Undersokelsesbenk({ x, y, P }: { x: number; y: number; P: number }) {
  const id = useSvgId('ak-benk');
  const ss = useStrokeScale();
  const L = BENK.L * P;
  const top = y - BENK.h * P;
  const m = BENK.madrass * P;
  const vinyl = mix(PAINTS.blaa, PAINTS.graa, 0.55);
  const frameY = top + m;
  const legs = [x + 0.14 * L, x + 0.86 * L];
  const wheel = 0.035 * P;
  return (
    <g>
      <title>Undersøkelsesbenk</title>
      <ContactShadow cx={x + L / 2} cy={y} rx={L * 0.5} ry={0.03 * P} />
      <LinearGradient id={`${id}m`} stops={materialStops(vinyl, 1.2)} />
      <LinearGradient id={`${id}s`} x1={0} y1={0} x2={1} y2={0} stops={materialStops(SCENE.metal, 1.4)} />
      {/* Stellet: to bein med hjul og en stang mellom */}
      <rect x={legs[0]!} y={y - 0.2 * P} width={legs[1]! - legs[0]!} height={0.025 * P} fill={SCENE.metal} stroke={SCENE.outline} strokeWidth={0.8 * ss} />
      {legs.map((lx) => (
        <g key={lx}>
          <rect x={lx - 0.02 * P} y={frameY} width={0.04 * P} height={y - wheel * 2 - frameY} fill={`url(#${id}s)`} stroke={SCENE.outline} strokeWidth={0.8 * ss} />
          <rect x={lx - 0.07 * P} y={y - wheel * 2 - 0.01 * P} width={0.14 * P} height={0.016 * P} rx={0.006 * P} fill={SCENE.metalDark} stroke={SCENE.outline} strokeWidth={0.7 * ss} />
          {[-0.05, 0.05].map((k) => (
            <circle key={k} cx={lx + k * P} cy={y - wheel} r={wheel} fill={SCENE.rubber} stroke={SCENE.outline} strokeWidth={0.7 * ss} />
          ))}
        </g>
      ))}
      {/* Rammen under madrassen */}
      <rect x={x + 0.02 * L} y={frameY} width={0.96 * L} height={0.035 * P} rx={0.008 * P} fill={SCENE.metal} stroke={SCENE.outline} strokeWidth={0.8 * ss} />
      {/* Madrassen og papirlakenet */}
      <rect x={x} y={top} width={L} height={m} rx={m * 0.35} fill={`url(#${id}m)`} stroke={SCENE.outline} strokeWidth={1 * ss} />
      <rect x={x + 0.04 * L} y={top - 0.004 * P} width={0.9 * L} height={0.012 * P} rx={0.004 * P} fill={tint(PAINTS.hvit, 0.2)} stroke={alpha(SCENE.outline, 0.4)} strokeWidth={0.6 * ss} />
    </g>
  );
}

/** Puta ved hodeenden. (x, y) er midt på undersiden. */
function Pute({ x, y, P }: { x: number; y: number; P: number }) {
  const ss = useStrokeScale();
  const w = 0.42 * P;
  const h = 0.09 * P;
  return (
    <path
      d={`M${r2(x - w / 2)},${r2(y)} Q${r2(x - w / 2 - 0.02 * P)},${r2(y - h)} ${r2(x - w / 4)},${r2(y - h)} L${r2(x + w / 4)},${r2(y - h * 0.92)} Q${r2(x + w / 2 + 0.02 * P)},${r2(y - h * 0.85)} ${r2(x + w / 2)},${r2(y)} Z`}
      fill={tint(PAINTS.hvit, 0.1)}
      stroke={SCENE.outline}
      strokeWidth={0.9 * ss}
    />
  );
}

/** Hvor i kroppen stoffet samler seg: hele skjelettet (Tc-99m), skjoldbruskkjertelen (I-131) eller hele kroppen (F-18). */
export type Opptak = 'skjelett' | 'skjoldbrusk' | 'kropp';

/**
 * Pasienten som ligger på ryggen på benken (hodet til venstre), med strålingen fra stoffet i kroppen: en svak glød der
 * stoffet er, og γ-fotoner ut av kroppen. Antall fotoner og styrken på gløden følger `niva` (aktiviteten i forhold til
 * aktiviteten ved innsprøytingen, 0–1), så eleven ser at strålingen avtar. Fotonene er de samme hele tida (fast frø),
 * så de forsvinner ett og ett når aktiviteten synker.
 *
 * (x, y) er venstre ende av benken og gulvet, som for Undersokelsesbenk.
 */
export function PasientPaaBenk({ x, y, P, niva, opptak, maxFotoner = 9, seed = 5 }: { x: number; y: number; P: number; niva: number; opptak: Opptak; maxFotoner?: number; seed?: number }) {
  const id = useSvgId('ak-pasient');
  const L = BENK.L * P;
  const top = y - BENK.h * P;
  const size = 1.72 * P;
  const headX = x + 0.09 * L;
  const feetX = headX + size;
  const midY = top - 0.07 * size;
  const surf = top - 0.12 * size;
  // Området i kroppen (andel av lengden fra toppen av hodet).
  const span = opptak === 'skjoldbrusk' ? [0.135, 0.165] : [0.04, 0.96];
  const x1 = headX + span[0]! * size;
  const x2 = headX + span[1]! * size;
  const lvl = Math.max(0, Math.min(1, Number.isFinite(niva) ? niva : 0));
  const n = lvl <= 0 ? 0 : Math.max(1, Math.round(maxFotoner * lvl));
  const rnd = sceneRandom(seed);
  // Fotonene går ut som en vifte: de til venstre heller mot venstre, de til høyre mot høyre.
  const photons = Array.from({ length: maxFotoner }, (_, i) => {
    const u = (i + 0.25 + 0.5 * rnd()) / maxFotoner;
    const ang = (-90 + (u - 0.5) * 80 + (rnd() - 0.5) * 16) * (Math.PI / 180);
    return { u, ang, len: (0.23 + 0.05 * rnd()) * size * (opptak === 'skjoldbrusk' ? 0.85 : 1) };
  });
  // De første fotonene i lista er de som blir igjen lengst: spredt over hele kroppen.
  const order = [4, 1, 7, 2, 6, 0, 8, 3, 5].filter((k) => k < maxFotoner);
  for (let k = 0; k < maxFotoner; k++) if (!order.includes(k)) order.push(k);
  const shown = order.slice(0, n).map((k) => photons[k]!);
  const glowRx = (x2 - x1) / 2 + 0.06 * size;
  const glowRy = 0.1 * size;
  return (
    <g>
      <Undersokelsesbenk x={x} y={y} P={P} />
      <Pute x={headX + 0.05 * size} y={top} P={P} />
      <Person
        x={feetX}
        y={midY}
        size={size}
        rotate={-90}
        skygge={false}
        jakke={mix(PAINTS.blaa, PAINTS.hvit, 0.55)}
        bukse={mix(PAINTS.blaa, PAINTS.hvit, 0.45)}
        sko={mix(PAINTS.hvit, PAINTS.graa, 0.3)}
        title="Pasient som ligger på benken"
      />
      {lvl > 0 && (
        <>
          <RadialGradient
            id={`${id}g`}
            stops={[
              [0, GAMMA, 0.55 * Math.sqrt(lvl)],
              [0.6, GAMMA, 0.22 * Math.sqrt(lvl)],
              [1, GAMMA, 0],
            ]}
          />
          <ellipse cx={(x1 + x2) / 2} cy={midY} rx={glowRx} ry={glowRy} fill={`url(#${id}g)`} />
        </>
      )}
      {shown.map((ph, i) => {
        const sx = x1 + (x2 - x1) * ph.u;
        const sy = surf + 0.02 * size;
        return (
          <Foton
            key={i}
            x1={sx}
            y1={sy}
            x2={sx + Math.cos(ph.ang) * ph.len}
            y2={sy + Math.sin(ph.ang) * ph.len}
            bolgelengde={0.002}
            farge={GAMMA}
            amplitude={0.022 * size}
            svingninger={4}
          />
        );
      })}
    </g>
  );
}
