/**
 * Scenen med ekkoloddet (k6-ekko): en sjark på fjorden sender en kort puls med ultralyd rett ned. Pulsen går med
 * 1500 m/s ned til bunnen, reflekteres og kommer tilbake som ekko. Dybden er i fast målestokk (240 m får plass);
 * båten er tegnet større, så den synes.
 */
import { Figure, Txt, VIZ, fmt } from '../../kit';
import { Dimension, ForceArrow, Himmel, Landskap, LinearGradient, SCENE, Terreng, Vann, alpha, shade, useStrokeScale, useSvgId } from '../../kit/scene';
import { Ekkoloddskjerm, Fiskebaat, fiskebaatGiver } from './ekko-deler';
import { SOUND } from './ekko-torden';
import { SLIDERS, V_VANN, echoDepth, echoPulse } from './model-ekko';

/** Dybdeskalaen (x). */
const RX = 780;
/** Halve åpningsvinkelen til lydstrålen fra giveren (grader). */
const BEAM = 12;
/** Største dybde på glidebryteren (m): avgjør målestokken. */
const MAX_DEPTH = echoDepth(SLIDERS.ekkolodd.t.max);

/** Plassen i scenen for tekstskaleringen f og gjenstandsskalaen s. */
export function loddLayout(f: number, s: number) {
  const H = Math.round(440 + 130 * (f - 1));
  const wy = 112 + 26 * (f - 1); // vannflata
  const L = 150 * s; // båtens lengde i figuren
  const xb = 290 + 30 * (s - 1);
  const giver = fiskebaatGiver(xb, wy, L);
  const yMax = H - 22; // bunnen ved største dybde
  const kPx = (yMax - giver.y) / MAX_DEPTH;
  return { H, wy, L, xb, giver, kPx };
}

/** Bunnprofilen (y for hver x): flat rett under båten, litt kupert ellers. */
function seabed(xb: number, ys: number, H: number, top: number): [number, number][] {
  const pts: [number, number][] = [];
  for (let x = 0; x <= 800; x += 20) {
    const u = Math.abs(x - xb);
    const w = u < 50 ? 0 : u > 170 ? 1 : ((u - 50) / 120) ** 2 * (3 - 2 * ((u - 50) / 120));
    const p = 14 * w * (0.75 * Math.sin((x - xb) / 90) + 0.5 * Math.sin((x - xb) / 37 + 0.8) - 0.5 * Math.sin(0.8));
    pts.push([x, Math.max(top, Math.min(H - 6, ys + p))]);
  }
  return pts;
}

export function LoddScene({ T, tau, f, s, speed }: { T: number; tau: number; f: number; s: number; speed: number }) {
  const ss = useStrokeScale();
  const id = useSvgId('ekko-lodd');
  const { H, wy, L, xb, giver, kPx } = loddLayout(f, s);
  const d = echoDepth(T);
  const ys = giver.y + d * kPx;
  const bed = seabed(xb, ys, H, wy + 10);
  const bedPoly = `M${bed.map(([x, y]) => `${x},${Math.round(y * 10) / 10}`).join('L')}L800,${H}L0,${H}Z`;
  const tan = Math.tan((BEAM * Math.PI) / 180);
  const halfAt = (y: number) => tan * (y - giver.y);
  const back = tau >= T;

  // Pulsen er noen få svingninger lang: fronten og to buer bak, hver med sin egen tid (de kan være på vei ned
  // og opp samtidig like etter at fronten har truffet bunnen).
  const lagM = (7 * s) / kPx;
  const arcs = [0, 1, 2]
    .map((k) => {
      const tk = tau - (k * lagM) / V_VANN;
      if (tk <= 0) return null;
      const p = echoPulse(tk, d);
      if (p.phase === 'tilbake') return null;
      const r = p.travelled * kPx;
      const down = p.phase === 'ned';
      const cy = down ? giver.y : 2 * ys - giver.y; // ekkoet kommer fra speilbildet av giveren i bunnen
      const a0 = ((down ? 90 - BEAM : -90 - BEAM) * Math.PI) / 180;
      const a1 = ((down ? 90 + BEAM : -90 + BEAM) * Math.PI) / 180;
      const P = (a: number) => `${Math.round((giver.x + r * Math.cos(a)) * 10) / 10},${Math.round((cy + r * Math.sin(a)) * 10) / 10}`;
      return { d: `M${P(a0)}A${r},${r} 0 0 1 ${P(a1)}`, op: [1, 0.55, 0.3][k]!, front: k === 0, phase: p.phase, depth: p.depth };
    })
    .filter((a): a is NonNullable<typeof a> => a !== null && a.d.length > 0);
  const front = arcs.find((a) => a.front);
  const yFront = front ? giver.y + front.depth * kPx : null;
  const aLen = 40 * s;
  const arrow =
    front && yFront !== null && ys - giver.y > aLen + 30
      ? (() => {
          const yc = Math.min(Math.max(yFront, giver.y + aLen / 2 + 8), ys - aLen / 2 - 6);
          const x = giver.x + halfAt(Math.max(yc, giver.y)) + 22 * s;
          const dir = front.phase === 'ned' ? 1 : -1;
          return { x, y1: yc - (dir * aLen) / 2, y2: yc + (dir * aLen) / 2 };
        })()
      : null;

  const screenW = 196 * Math.min(s, 1.5);
  const screenH = 96 * Math.min(s, 1.5);
  const speedNote = `Avspillingen går i sakte film, ${fmt(1 / speed, 0)} ganger saktere enn i virkeligheten.`;
  const label = `Fiskebåt på fjorden med ekkolodd. En lydpuls går rett ned til bunnen ${fmt(d, 1)} m under båten og kommer tilbake som ekko etter ${fmt(T, 3)} s.`;

  return (
    <Figure viewBox={`0 0 800 ${H}`} label={label} maxHeight={600} caption={speedNote}>
      <Himmel w={800} h={wy + 2} sol={{ x: 470, y: 46 }} skyer={2} seed={8} />
      <Landskap x={0} y={wy} w={800} h={66 + 16 * (f - 1)} type="fjell" seed={2} />
      <Vann x={0} y={wy} w={800} h={H - wy} />
      <Terreng points={bed} bottom={H} type="grus" glatt seed={6} />
      <LinearGradient
        id={`${id}b`}
        userSpace
        x1={0}
        y1={ys - 16}
        x2={0}
        y2={H}
        stops={[
          [0, SCENE.waterDeep, 0.3],
          [1, shade(SCENE.waterDeep, 0.35), 0.8],
        ]}
      />
      <path d={bedPoly} fill={`url(#${id}b)`} />
      {/* Dybdeskala til høyre: meter under giveren */}
      <g aria-hidden>
        <line x1={RX} y1={giver.y} x2={RX} y2={giver.y + MAX_DEPTH * kPx} stroke={alpha(VIZ.ink, 0.5)} strokeWidth={1.2 * ss} />
        {Array.from({ length: Math.floor(MAX_DEPTH / 25) + 1 }, (_, i) => {
          const m = i * 25;
          const y = giver.y + m * kPx;
          return (
            <g key={m}>
              <line x1={RX - (m % 50 ? 4 : 8)} y1={y} x2={RX} y2={y} stroke={alpha(VIZ.ink, 0.65)} strokeWidth={1.2 * ss} />
              {m % 50 === 0 && m > 0 && (
                <Txt x={RX - 12} y={y + 5 * f} size={0.74} weight={600} anchor="end">
                  {`${m} m`}
                </Txt>
              )}
            </g>
          );
        })}
      </g>

      {/* Lydstrålen fra giveren */}
      <path
        d={`M${giver.x},${giver.y}L${giver.x - halfAt(ys)},${ys}L${giver.x + halfAt(ys)},${ys}Z`}
        fill={alpha(SOUND, 0.1)}
        stroke={alpha(SOUND, 0.45)}
        strokeWidth={1.1 * ss}
        strokeDasharray={`${5 * ss} ${4 * ss}`}
      />

      <Fiskebaat x={xb} y={wy} size={L} />

      <clipPath id={`${id}k`}>
        <rect x={0} y={giver.y - 2} width={800} height={Math.max(0, ys - giver.y + 3)} />
      </clipPath>
      <g clipPath={`url(#${id}k)`} fill="none" strokeLinecap="round">
        {arcs.map((a, i) => (
          <g key={i} opacity={a.op}>
            <path d={a.d} stroke={VIZ.surface} strokeWidth={(a.front ? 6.5 : 5) * ss} opacity={0.6} />
            <path d={a.d} stroke={SOUND} strokeWidth={(a.front ? 3.4 : 2.4) * ss} />
          </g>
        ))}
      </g>
      {arrow && <ForceArrow x1={arrow.x} y1={arrow.y1} x2={arrow.x} y2={arrow.y2} color={VIZ.velocity} width={5.5} label="v" labelX={arrow.x + 12 * f} labelY={(arrow.y1 + arrow.y2) / 2 + 6 * f} labelAnchor="start" />}

      <Dimension x1={giver.x} y1={giver.y} x2={giver.x} y2={ys} offset={-(halfAt(ys) + 30 * s)} label={`d = ${fmt(d, 1)} m`} />

      <Ekkoloddskjerm
        x={800 - 14 - screenW}
        y={12}
        w={screenW}
        h={screenH}
        tid={`${fmt(Math.min(Math.max(0, tau), T), 3)} s`}
        dybde={back ? `${fmt(d, 1)} m` : null}
        bunn={back ? d / 250 : null}
      />
    </Figure>
  );
}
