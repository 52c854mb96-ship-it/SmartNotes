/**
 * Gjenstander som bare «Termofysikkens første lov» trenger, i samme stil som scene-kit-et (toninger fra core,
 * SCENE-farger, kontur og myk skygge): en isblokk og en isoporplate som sylinderen kan stå på.
 * Glassylinderen, stempelet, bunnplata og termometeret er de samme som i «Gassmodell» (gassmodell-deler.tsx).
 */
import { useMemo } from 'react';
import {
  ContactShadow,
  LinearGradient,
  PAINTS,
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

const r2 = (v: number) => Math.round(v * 100) / 100;

export type UnderplateType = 'is' | 'torris' | 'isopor';

/**
 * Lav, bred blokk sett litt ovenfra: en isblokk (blank og gjennomskinnelig, med sprekker, luftbobler og en liten
 * smeltevannspytt), en tørrisblokk (matt, kritthvit og porøs, med kald damp som renner ned langs sidene og ut på
 * benken) eller en isoporplate (matt hvit med kuler i overflaten). Ankerpunkt: (x, y) er midt på
 * forkanten av bunnen, på benken. Oversiden er en flate fra y − h (forkant) til y − h − d (bakkant), så midten av
 * oversiden er i y − h − d/2 (der en gjenstand settes).
 */
export function Underplate({ x, y, w, h, d, type, title }: { x: number; y: number; w: number; h: number; d: number; type: UnderplateType; title?: string }) {
  const ss = useStrokeScale();
  const id = useSvgId(`underplate-${type}`);
  const is = type === 'is';
  const L = x - w / 2;
  const R = x + w / 2;
  const top = y - h;
  const back = top - d;
  const inset = w * 0.035;
  const rc = Math.min(6, h * 0.12);
  const front = `M${r2(L)},${r2(top + rc)}Q${r2(L)},${r2(top)} ${r2(L + rc)},${r2(top)}L${r2(R - rc)},${r2(top)}Q${r2(R)},${r2(top)} ${r2(R)},${r2(top + rc)}L${r2(R)},${r2(y - rc)}Q${r2(R)},${r2(y)} ${r2(R - rc)},${r2(y)}L${r2(L + rc)},${r2(y)}Q${r2(L)},${r2(y)} ${r2(L)},${r2(y - rc)}Z`;
  const topFace = `M${r2(L + rc * 0.4)},${r2(top)}L${r2(L + inset)},${r2(back + 2)}Q${r2(L + inset + 1)},${r2(back)} ${r2(L + inset + 4)},${r2(back)}L${r2(R - inset - 4)},${r2(back)}Q${r2(R - inset - 1)},${r2(back)} ${r2(R - inset)},${r2(back + 2)}L${r2(R - rc * 0.4)},${r2(top)}Z`;

  // Tekstur med fast frø: sprekker og bobler i isen, kuler i isoporen
  const texture = useMemo(() => {
    const rnd = sceneRandom(is ? 517 : 233);
    if (is) {
      const cracks = Array.from({ length: 5 }, () => {
        const x0 = 0.08 + rnd() * 0.84;
        const y0 = 0.15 + rnd() * 0.6;
        const pts: [number, number][] = [[x0, y0]];
        let a = -0.6 + rnd() * 1.2;
        for (let i = 0; i < 3; i++) {
          const prev = pts[pts.length - 1]!;
          a += -0.7 + rnd() * 1.4;
          pts.push([prev[0] + Math.cos(a) * (0.04 + rnd() * 0.05), prev[1] + Math.sin(a) * (0.1 + rnd() * 0.12)]);
        }
        return pts;
      });
      const bubbles = Array.from({ length: 26 }, () => ({ u: 0.05 + rnd() * 0.9, v: 0.12 + rnd() * 0.78, r: 0.6 + rnd() * 1.6 }));
      return { cracks, bubbles, beads: [] as { u: number; v: number; r: number; top: boolean }[] };
    }
    const beads = Array.from({ length: 150 }, () => ({ u: rnd(), v: rnd(), r: 1.6 + rnd() * 1.6, top: rnd() < 0.3 }));
    return { cracks: [] as [number, number][][], bubbles: [] as { u: number; v: number; r: number }[], beads };
  }, [is]);

  const fx = (u: number) => L + 4 + u * (w - 8);
  const fy = (v: number) => top + 3 + v * (h - 6);

  if (type === 'torris') return <Torris x={x} y={y} w={w} h={h} front={front} topFace={topFace} L={L} R={R} top={top} back={back} rc={rc} title={title} />;

  if (is) {
    return (
      <g>
        {title && <title>{title}</title>}
        <LinearGradient
          id={`${id}f`}
          stops={[
            [0, SCENE.iceShine, 0.95],
            [0.25, SCENE.ice, 0.85],
            [1, shade(SCENE.ice, 0.18), 0.92],
          ]}
        />
        <LinearGradient id={`${id}t`} stops={[[0, tint(SCENE.ice, 0.35)], [1, SCENE.iceShine]]} />
        <LinearGradient id={`${id}k`} x2={1} y2={0} stops={[[0, SCENE.iceShine, 0], [0.3, SCENE.iceShine, 0.55], [0.7, SCENE.iceShine, 0.55], [1, SCENE.iceShine, 0]]} />
        {/* Smeltevann på benken rundt isblokka */}
        <ellipse cx={x + w * 0.04} cy={y + 1} rx={w * 0.6} ry={Math.max(4, d * 0.32)} fill={alpha(SCENE.water, 0.35)} stroke={alpha(SCENE.waterLight, 0.8)} strokeWidth={0.8 * ss} />
        <ellipse cx={x - w * 0.22} cy={y + 2} rx={w * 0.12} ry={Math.max(1.5, d * 0.08)} fill={alpha(SCENE.iceShine, 0.6)} />
        <ContactShadow cx={x} cy={y} rx={w * 0.5} ry={3} opacity={0.5} />
        <path d={front} fill={`url(#${id}f)`} stroke={SCENE.glassEdge} strokeWidth={1 * ss} />
        {/* Melkehvit kjerne der frosne luftbobler samler seg */}
        <rect x={L + w * 0.18} y={top + h * 0.28} width={w * 0.64} height={h * 0.44} rx={h * 0.2} fill={`url(#${id}k)`} />
        <g fill="none" stroke={alpha(SCENE.iceShine, 0.95)} strokeWidth={0.9 * ss} strokeLinecap="round" strokeLinejoin="round">
          {texture.cracks.map((c, i) => (
            <polyline key={i} points={c.map(([u, v]) => `${r2(fx(u))},${r2(fy(Math.min(0.95, v)))}`).join(' ')} />
          ))}
        </g>
        <g fill={alpha(SCENE.iceShine, 0.9)} stroke={alpha(SCENE.glassEdge, 0.6)} strokeWidth={0.4 * ss}>
          {texture.bubbles.map((b, i) => (
            <circle key={i} cx={r2(fx(b.u))} cy={r2(fy(b.v))} r={r2(b.r * ss)} />
          ))}
        </g>
        <path d={topFace} fill={`url(#${id}t)`} stroke={SCENE.glassEdge} strokeWidth={1 * ss} strokeLinejoin="round" />
        {/* Blank kant og glans */}
        <line x1={L + rc} y1={top + 1.2 * ss} x2={R - rc} y2={top + 1.2 * ss} stroke={SCENE.iceShine} strokeWidth={1.6 * ss} strokeLinecap="round" />
        <path d={`M${r2(L + w * 0.06)},${r2(top + h * 0.2)}L${r2(L + w * 0.06)},${r2(y - h * 0.18)}`} stroke={SCENE.iceShine} strokeWidth={2.4 * ss} strokeLinecap="round" opacity={0.85} />
        <path d={`M${r2(L + w * 0.1)},${r2(top + h * 0.22)}L${r2(L + w * 0.1)},${r2(top + h * 0.5)}`} stroke={SCENE.iceShine} strokeWidth={1.2 * ss} strokeLinecap="round" opacity={0.7} />
        {/* Dråper som renner ned forsiden */}
        {[0.34, 0.71].map((u) => (
          <path key={u} d={`M${r2(fx(u))},${r2(top + 2)}q1.2,${r2(h * 0.3)} 0,${r2(h * 0.42)}`} stroke={alpha(SCENE.water, 0.55)} strokeWidth={2 * ss} fill="none" strokeLinecap="round" />
        ))}
      </g>
    );
  }

  const white = SCENE.plastic;
  return (
    <g>
      {title && <title>{title}</title>}
      <LinearGradient id={`${id}f`} stops={[[0, tint(white, 0.3)], [0.6, white], [1, shade(white, 0.12)]]} />
      <LinearGradient id={`${id}t`} stops={[[0, shade(white, 0.04)], [1, tint(white, 0.5)]]} />
      <ContactShadow cx={x} cy={y} rx={w * 0.54} ry={3.5} />
      <path d={front} fill={`url(#${id}f)`} stroke={SCENE.outline} strokeWidth={0.9 * ss} />
      <g fill="none" stroke={alpha(SCENE.plasticShade, 0.9)} strokeWidth={0.6 * ss}>
        {texture.beads
          .filter((b) => !b.top)
          .map((b, i) => (
            <circle key={i} cx={r2(fx(b.u))} cy={r2(fy(b.v))} r={r2(b.r)} />
          ))}
      </g>
      <path d={topFace} fill={`url(#${id}t)`} stroke={SCENE.outline} strokeWidth={0.9 * ss} strokeLinejoin="round" />
      <g fill="none" stroke={alpha(SCENE.plasticShade, 0.8)} strokeWidth={0.5 * ss}>
        {texture.beads
          .filter((b) => b.top)
          .map((b, i) => (
            <ellipse key={i} cx={r2(L + inset + 6 + b.u * (w - 2 * inset - 12))} cy={r2(back + 2 + b.v * (d - 4))} rx={r2(b.r)} ry={r2(b.r * 0.5)} />
          ))}
      </g>
      <line x1={L + rc} y1={top + 1} x2={R - rc} y2={top + 1} stroke={SCENE.highlight} strokeWidth={1.2 * ss} opacity={0.9} />
    </g>
  );
}

/**
 * Låsebom: et flatt stålbeslag som ligger over åpningen på glasset, med en klemme og vingeskrue rundt
 * stempelstanga. Holder stempelet fast (fast volum, W = 0). (cx, y) er midt på undersiden, der den ligger på kanten
 * av glasset; `half` er halve lengden.
 */
export function Laasebom({ cx, y, half, rodW }: { cx: number; y: number; half: number; rodW: number }) {
  const ss = useStrokeScale();
  const id = useSvgId('laasebom');
  const barH = 8;
  const jawW = rodW + 16;
  const jawH = 18;
  const paint = shade(PAINTS.blaa, 0.3);
  return (
    <g aria-hidden>
      <LinearGradient id={`${id}b`} stops={[[0, tint(SCENE.metalLight, 0.25)], [0.45, SCENE.metal], [1, shade(SCENE.metal, 0.35)]]} />
      <LinearGradient id={`${id}j`} stops={materialStops(paint, 1)} />
      <RadialGradient id={`${id}k`} fx={0.35} fy={0.3} stops={sphereStops(SCENE.rubberLight)} />
      {/* Bommen over åpningen, med en liten fot i hver ende som ligger på glasskanten */}
      {[-1, 1].map((sd) => (
        <rect key={sd} x={cx + sd * (half - 9) - 5} y={y - 3} width={10} height={6} rx={1.5} fill={SCENE.rubber} stroke={SCENE.outline} strokeWidth={0.6 * ss} />
      ))}
      <rect x={cx - half} y={y - 3 - barH} width={2 * half} height={barH} rx={2.5} fill={`url(#${id}b)`} stroke={SCENE.outline} strokeWidth={0.9 * ss} />
      <line x1={cx - half + 4} y1={y - 3 - barH + 1.6 * ss} x2={cx + half - 4} y2={y - 3 - barH + 1.6 * ss} stroke={SCENE.highlight} strokeWidth={1 * ss} opacity={0.6} />
      {/* Klemmen rundt stanga med vingeskrue */}
      <rect x={cx - jawW / 2} y={y - 3 - barH / 2 - jawH / 2} width={jawW} height={jawH} rx={3.5} fill={`url(#${id}j)`} stroke={SCENE.outline} strokeWidth={0.9 * ss} />
      <rect x={cx - rodW / 2} y={y - 3 - barH / 2 - jawH / 2 - 1} width={rodW} height={jawH + 2} fill={shade(SCENE.metal, 0.05)} opacity={0.85} />
      <rect x={cx + jawW / 2} y={y - 3 - barH / 2 - 2.5} width={7} height={5} fill={shade(SCENE.metal, 0.1)} stroke={SCENE.outline} strokeWidth={0.6 * ss} />
      <ellipse cx={cx + jawW / 2 + 10} cy={y - 3 - barH / 2} rx={3.5} ry={7.5} fill={`url(#${id}k)`} stroke={SCENE.outline} strokeWidth={0.8 * ss} />
    </g>
  );
}

/** Tørrisblokk (fast karbondioksid, −78,5 °C): kritthvit og porøs, med damp som renner ned og ut på benken. */
function Torris({
  x,
  y,
  w,
  h,
  front,
  topFace,
  L,
  R,
  top,
  back,
  rc,
  title,
}: {
  x: number;
  y: number;
  w: number;
  h: number;
  front: string;
  topFace: string;
  L: number;
  R: number;
  top: number;
  back: number;
  rc: number;
  title?: string;
}) {
  const ss = useStrokeScale();
  const id = useSvgId('torris');
  const base = mix(SCENE.snowShade, SCENE.ice, 0.35);
  const specks = useMemo(() => {
    const rnd = sceneRandom(907);
    return Array.from({ length: 120 }, () => ({ u: rnd(), v: rnd(), r: 0.5 + rnd() * 1.3, dark: rnd() < 0.55 }));
  }, []);
  // Dampen: myke, flate skyer langs foten og et par som renner over kanten
  const fog = useMemo(() => {
    const rnd = sceneRandom(311);
    const along = Array.from({ length: 9 }, (_, i) => ({ u: -0.12 + (i / 8) * 1.24 + (rnd() - 0.5) * 0.06, rx: 0.1 + rnd() * 0.07, ry: 0.22 + rnd() * 0.18, a: 0.5 + rnd() * 0.3 }));
    return along;
  }, []);
  return (
    <g>
      {title && <title>{title}</title>}
      <LinearGradient id={`${id}f`} stops={[[0, tint(base, 0.55)], [0.5, tint(base, 0.3)], [1, base]]} />
      <LinearGradient id={`${id}t`} stops={[[0, tint(base, 0.4)], [1, tint(base, 0.75)]]} />
      <RadialGradient id={`${id}d`} stops={[[0, SCENE.snow, 0.85], [0.55, SCENE.snow, 0.45], [1, SCENE.snow, 0]]} />
      <ContactShadow cx={x} cy={y} rx={w * 0.54} ry={3.5} />
      <path d={front} fill={`url(#${id}f)`} stroke={SCENE.outline} strokeWidth={0.9 * ss} />
      <g>
        {specks.map((p, i) => (
          <circle
            key={i}
            cx={r2(L + 4 + p.u * (w - 8))}
            cy={r2(top + 3 + p.v * (h - 6))}
            r={r2(p.r * ss)}
            fill={p.dark ? alpha(SCENE.outline, 0.12) : alpha(SCENE.snow, 0.9)}
          />
        ))}
      </g>
      <path d={topFace} fill={`url(#${id}t)`} stroke={SCENE.outline} strokeWidth={0.9 * ss} strokeLinejoin="round" />
      <line x1={L + rc} y1={top + 1} x2={R - rc} y2={top + 1} stroke={SCENE.snow} strokeWidth={1.4 * ss} opacity={0.9} />
      {/* Kald damp (CO₂ og kondensert vanndamp) som er tyngre enn lufta og legger seg på benken */}
      <g aria-hidden>
        {/* Et flatt teppe av damp på benken rundt blokka */}
        <ellipse cx={r2(x)} cy={r2(y - 1)} rx={r2(w * 0.68)} ry={r2(Math.max(6, h * 0.16))} fill={`url(#${id}d)`} opacity={0.75} />
        <ellipse cx={r2(x)} cy={r2(y - 1)} rx={r2(w * 0.68)} ry={r2(Math.max(6, h * 0.16))} fill="none" stroke={alpha(SCENE.snowShade, 0.5)} strokeWidth={0.6 * ss} strokeDasharray={`${2 * ss} ${5 * ss}`} />
        {fog.map((b, i) => (
          <ellipse key={i} cx={r2(L + b.u * w)} cy={r2(y - h * 0.12)} rx={r2(b.rx * w)} ry={r2(b.ry * h)} fill={`url(#${id}d)`} opacity={b.a} />
        ))}
        <ellipse cx={r2(L - w * 0.02)} cy={r2(top + h * 0.35)} rx={r2(w * 0.05)} ry={r2(h * 0.4)} fill={`url(#${id}d)`} opacity={0.6} />
        <ellipse cx={r2(R + w * 0.02)} cy={r2(top + h * 0.4)} rx={r2(w * 0.05)} ry={r2(h * 0.38)} fill={`url(#${id}d)`} opacity={0.55} />
        <ellipse cx={r2(x)} cy={r2(back + 2)} rx={r2(w * 0.42)} ry={r2(Math.max(4, (top - back) * 0.45))} fill={`url(#${id}d)`} opacity={0.35} />
      </g>
    </g>
  );
}
