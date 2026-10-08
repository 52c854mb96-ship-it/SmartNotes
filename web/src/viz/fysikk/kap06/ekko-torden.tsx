/**
 * Scenen med lyn og torden (k6-ekko): et uvær over åsene, lynet slår ned, lyset er fram nesten med en gang, og
 * lydbølgen brer seg ut som en halvkule med 340 m/s til den når personen som har startet stoppeklokka.
 * Avstanden vannrett er i fast målestokk (hele glidebryteren får plass); høyden er ikke i samme målestokk.
 */
import { Figure, Txt, VIZ, fmt } from '../../kit';
import { Dimension, ForceArrow, Himmel, Landskap, LinearGradient, Person, SCENE, Stoppeklokke, Underlag, ValueTag, alpha, shade, tint, useStrokeScale, useSvgId } from '../../kit/scene';
import { Lyn, Regnbyge, Tordensky } from './ekko-deler';
import { SLIDERS, V_LUFT, flashStrength, lightTime, lightningDistance } from './model-ekko';

/** Fargen på lydbølgene (samme i scenene og i figuren med bølgelengdene). */
export const SOUND = VIZ.series[4];

/** «680 m» under 1 km, ellers «2,04 km». */
export function fmtDistance(d: number): string {
  return d < 1000 ? `${fmt(d, 0)} m` : `${fmt(d / 1000, 2)} km`;
}

/** Plassen i scenen for tekstskaleringen f og gjenstandsskalaen s. */
export function tordenLayout(f: number, s: number) {
  const H = Math.round(400 + 130 * (f - 1));
  const gy = H - 64 - 46 * (f - 1); // forkanten av jordet
  const yb = gy - 10; // der personen står og lynet slår ned
  const hz = gy - 50; // horisonten
  const xp = 800 - 72 * s; // personen
  const x0 = 46; // lengst unna (glidebryteren på maks)
  const pxPerM = (xp - x0) / lightningDistance(SLIDERS.torden.t.max);
  const base = gy - 132 - 28 * (f - 1); // bunnen av skya
  return { H, gy, yb, hz, xp, pxPerM, base };
}

export function TordenScene({ T, tau, f, s, speed }: { T: number; tau: number; f: number; s: number; speed: number }) {
  const ss = useStrokeScale();
  const id = useSvgId('ekko-torden');
  const { H, gy, yb, hz, xp, pxPerM, base } = tordenLayout(f, s);
  const d = lightningDistance(T);
  const xs = xp - d * pxPerM;
  const glod = flashStrength(tau);
  const heard = tau >= T;
  const R = V_LUFT * Math.max(0, tau) * pxPerM;
  const cloudW = 200;
  const personSize = 76 * s;
  const eye = { x: xp - 0.06 * personSize, y: yb - 0.93 * personSize };
  const boltTop = { x: xs + 0.06 * cloudW, y: base - 2 };
  const lightMid = { x: (xs + eye.x) / 2, y: (yb - 0.45 * (yb - base) + eye.y) / 2 };
  // Er lynet nær personen, står teksten om lyset til venstre for lynet i stedet for over strålen
  const lightShort = eye.x - xs < 125 * f;
  const us = lightTime(d) * 1e6;

  // Lydbølgen: fronten og to svakere buer bak (rumlingen fra lenger opp i lynet)
  const arcs = [0, 1, 2]
    .map((k) => ({ r: R - k * 11 * s, op: [1, 0.5, 0.25][k]! }))
    .filter((a) => a.r > 1);
  const arcPath = (r: number) => `M${xs - r},${yb}A${r},${r} 0 0 1 ${xs + r},${yb}`;
  // Fartspila sitter på fronten, 32° over bakken, så den ikke treffer personen
  const ang = (32 * Math.PI) / 180;
  const ux = Math.cos(ang);
  const uy = -Math.sin(ang);
  const aLen = 46 * s;
  const a1 = { x: xs + (R + 6) * ux, y: yb + (R + 6) * uy };
  const a2 = { x: a1.x + aLen * ux, y: a1.y + aLen * uy };
  // Ikke når pila når fram til personen (hånda peker mot lynet)
  const showArrow = tau > 0 && !heard && R > 24 && a2.x < xp - 0.75 * personSize && a2.y > 14;

  const speedNote = speed > 1.05 ? `Avspillingen går ${fmt(speed, 1)} ganger raskere enn i virkeligheten.` : 'Avspillingen går i sanntid: tell sekundene selv.';
  const label = `Uvær over åsene. Lynet slår ned ${fmtDistance(d)} unna en person som ser lynet og starter stoppeklokka. Lydbølgen brer seg ut med 340 m/s og når personen etter ${fmt(T, 1)} s.`;

  return (
    <Figure viewBox={`0 0 800 ${H}`} label={label} maxHeight={560} caption={speedNote}>
      <Himmel w={800} h={gy} seed={5} />
      <LinearGradient
        id={`${id}o`}
        userSpace
        x1={0}
        y1={0}
        x2={0}
        y2={gy}
        stops={[
          [0, shade(SCENE.cloudShade, 0.3), 0.8],
          [1, shade(SCENE.cloudShade, 0.1), 0.25],
        ]}
      />
      <rect x={0} y={0} width={800} height={gy} fill={`url(#${id}o)`} />
      <Landskap x={0} y={hz} w={800} h={64} type="aaser" seed={3} />
      <Underlag x1={0} x2={800} y={gy} depth={H - gy} type="gress" horisont={hz} seed={4} />
      {/* Lynglimtet lyser opp hele himmelen et øyeblikk */}
      {glod > 0 && <rect x={0} y={0} width={800} height={gy} fill={tint(SCENE.glow, 0.7)} opacity={0.22 * glod} />}

      <Regnbyge x1={xs - 0.3 * cloudW} x2={xs + 0.02 * cloudW} top={base - 6} bottom={yb + 4} />
      <Tordensky x={xs + 0.1 * cloudW} base={base} top={12 + 6 * (f - 1)} w={cloudW} />
      <Lyn x1={boltTop.x} y1={boltTop.y} x2={xs} y2={yb} glod={glod} />

      {/* Lyset fra lynet til øyet: fram etter noen mikrosekunder */}
      {glod > 0 && (
        <g opacity={0.4 + 0.6 * glod}>
          <line x1={xs + 6} y1={yb - 0.45 * (yb - base)} x2={eye.x} y2={eye.y} stroke={alpha(SCENE.glow, 0.35)} strokeWidth={8 * ss} strokeLinecap="round" />
          <line x1={xs + 6} y1={yb - 0.45 * (yb - base)} x2={eye.x} y2={eye.y} stroke={tint(SCENE.glow, 0.6)} strokeWidth={2.2 * ss} strokeLinecap="round" />
          <Txt x={lightShort ? xs - 16 : lightMid.x} y={lightShort ? yb - 0.45 * (yb - base) : lightMid.y - 12 * f} anchor={lightShort ? 'end' : 'middle'} size={0.85} weight={650}>
            Lyset: {fmt(us, 1)} μs
          </Txt>
        </g>
      )}

      <Person x={xp} y={yb} size={personSize} flip jakke="gul" har="brun" ledd={heard ? undefined : { hoyreSkulder: 75, hoyreAlbue: 12 }} />

      {/* Lydbølgen */}
      <clipPath id={`${id}k`}>
        <rect x={0} y={0} width={800} height={yb + 1} />
      </clipPath>
      <g clipPath={`url(#${id}k)`} fill="none" strokeLinecap="round">
        {arcs.map((a, i) => (
          <g key={i} opacity={a.op}>
            <path d={arcPath(a.r)} stroke={VIZ.surface} strokeWidth={(i === 0 ? 6.5 : 5) * ss} opacity={0.65} />
            <path d={arcPath(a.r)} stroke={SOUND} strokeWidth={(i === 0 ? 3.4 : 2.4) * ss} />
          </g>
        ))}
      </g>
      {showArrow && <ForceArrow x1={a1.x} y1={a1.y} x2={a2.x} y2={a2.y} color={VIZ.velocity} width={5.5} label="v" />}

      {/* Målestokk langs bakken: kilometer fra personen */}
      <g aria-hidden>
        <line x1={xp - 10.5 * 1000 * pxPerM} y1={gy} x2={xp} y2={gy} stroke={alpha(VIZ.ink, 0.55)} strokeWidth={1.2 * ss} />
        {Array.from({ length: 11 }, (_, km) => {
          const x = xp - km * 1000 * pxPerM;
          return (
            <g key={km}>
              <line x1={x} y1={gy - (km % 2 ? 4 : 7)} x2={x} y2={gy + (km % 2 ? 4 : 7)} stroke={alpha(VIZ.ink, 0.7)} strokeWidth={1.2 * ss} />
              {km % 2 === 0 && (
                <Txt x={x} y={gy + 8 + 13 * f} size={0.74} weight={600} anchor={km === 0 ? 'end' : 'middle'}>
                  {km === 0 ? '0' : `${km} km`}
                </Txt>
              )}
            </g>
          );
        })}
      </g>
      <Dimension x1={xs} y1={gy + 8 + 39 * f + 4 * (f - 1)} x2={xp} y2={gy + 8 + 39 * f + 4 * (f - 1)} label={`d = ${fmtDistance(d)}`} />

      {heard && <ValueTag x={xp - 0.3 * personSize} y={yb - 0.88 * personSize} text="Nå hører du tordenen" anchor="end" color={SOUND} />}

      <Stoppeklokke x={800 - 46 * s} y={64 * s} r={30 * s} t={Math.min(Math.max(0, tau), T)} desimaler={1} />
    </Figure>
  );
}

/** Fargen på lyset i forklaringen (lynglimtet). */
export const LIGHT = SCENE.glow;
