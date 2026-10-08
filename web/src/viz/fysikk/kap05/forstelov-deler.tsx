/**
 * Gjenstander som bare «Termofysikkens første lov» trenger, i samme stil som scene-kit-et (toninger fra core,
 * SCENE-farger, kontur og myk skygge): en isblokk og en isoporplate som sylinderen kan stå på.
 * Glassylinderen, stempelet, bunnplata og termometeret er de samme som i «Gassmodell» (gassmodell-deler.tsx).
 */
import { useMemo } from 'react';
import { ContactShadow, LinearGradient, SCENE, alpha, sceneRandom, shade, tint, useStrokeScale, useSvgId } from '../../kit/scene';

const r2 = (v: number) => Math.round(v * 100) / 100;

export type UnderplateType = 'is' | 'isopor';

/**
 * Lav, bred blokk sett litt ovenfra: en isblokk (blank og gjennomskinnelig, med sprekker, luftbobler og en liten
 * smeltevannspytt) eller en isoporplate (matt hvit med kuler i overflaten). Ankerpunkt: (x, y) er midt på
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
