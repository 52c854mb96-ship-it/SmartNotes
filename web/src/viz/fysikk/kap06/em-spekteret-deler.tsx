/**
 * Egne gjenstander til «Det elektromagnetiske spekteret i hverdagen» (k6-em-spekteret), i samme stil som scene-kit-et:
 * toninger fra core.tsx, SCENE- og PAINTS-farger, kontur og myk skygge. Bare denne visualiseringen trenger dem.
 *
 *   <Sendermast x y h />          gittermast for radio med røde og hvite felt; antennen i sendermastTopp(x, y, h)
 *   <Mobilmast x y h />           mast med tre panelantenner og teknikkskap; antennen i mobilmastAntenne(x, y, h)
 *   <Mikrobolgeovn x y w>…</…>    ovn på benken; barna tegnes inne i vinduet (ovnVindu(x, y, w)), f.eks. den stående bølgen
 *   <Wifiruter x y size />        ruter med to antenner og lysdioder
 *   <Kjokkenbenk x1 x2 y depth /> benkeplate i tre med hvite skapdører
 *   <Mobiltelefon x y size rotate />, <Fjernkontroll x y len rotate />
 *   <Tv x y w />                  flatskjerm på TV-benk; mottakeren i tvSensor(x, y, w)
 *   <Varmekamera x y size />      håndholdt varmekamera med pistolgrep, linsen mot venstre
 *   <Varmebilde x y w h />        skjermbildet fra varmekameraet: personen i falske farger og temperaturskala
 *   <Solkrem x y size />          solkremtube som står på korken i snøen
 *   <Rontgenror x y w />          røntgenrør med blender i en arm fra taket; strålen kommer ut i (x, y)
 *   <Underarm x y len />          underarm og hånd som ligger flatt (sett fra siden)
 *   <RontgenHand cx cy size brudd /> knoklene i hånda og håndleddet sett ovenfra, slik de ser ut på røntgenbildet
 *   <Skjerm x y w h>…</Skjerm>    skjerm på fot; barna tegnes på skjermflaten (skjermFlate(x, y, w, h))
 *   <Kildeholder x y size />      blybeholder med strålekilde, merket med strålingssymbolet
 *   <GmRor x y len /> og <Stativ …> GM-rør i klemme på stativ; <Teller x y w visning />
 *   useContainerScale()           tekstskaleringen figuren får, målt før figuren tegnes
 */
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Txt } from '../../kit';
import { ContactShadow, LinearGradient, PAINTS, RadialGradient, SCENE, alpha, materialStops, mix, shade, tint, useStrokeScale, useSvgId } from '../../kit/scene';

const r1 = (v: number) => Math.round(v * 10) / 10;

/**
 * Tekstskaleringen figuren vil få (samme regel som i <Figure>: 1 på PC, ca. 1,8 på mobil), målt på beholderen før
 * figuren tegnes, så viewBox-høyden kan velges etter den. `s` er gjenstandsskalaen (som useSceneScale).
 */
export function useContainerScale(vbWidth = 800) {
  const ref = useRef<HTMLDivElement>(null);
  const [f, setF] = useState(1);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const update = () => {
      const w = el.getBoundingClientRect().width;
      if (w > 0) {
        const next = Math.round(Math.max(1, 12.5 / 17 / (w / vbWidth)) * 20) / 20;
        setF((old) => (old === next ? old : next));
      }
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [vbWidth]);
  return { ref, f, s: Math.max(1, 0.85 * f) };
}

/** Rektangel med avrundede hjørner som sti (til toninger og konturer). */
function rr(x: number, y: number, w: number, h: number, r: number): string {
  const q = Math.min(r, w / 2, h / 2);
  return `M${r1(x + q)},${r1(y)}H${r1(x + w - q)}Q${r1(x + w)},${r1(y)} ${r1(x + w)},${r1(y + q)}V${r1(y + h - q)}Q${r1(x + w)},${r1(y + h)} ${r1(x + w - q)},${r1(y + h)}H${r1(x + q)}Q${r1(x)},${r1(y + h)} ${r1(x)},${r1(y + h - q)}V${r1(y + q)}Q${r1(x)},${r1(y)} ${r1(x + q)},${r1(y)}Z`;
}

/* ---------------------------------------------------------------- Master */

/** Toppen av antennen på sendermasten (der radiobølgene sendes ut). */
export const sendermastTopp = (x: number, y: number, h: number) => ({ x, y: y - h * 1.1 });

/** Gittermast for radio og TV sett langt unna: røde og hvite felt (flymerking), stag på kryss og antenne på toppen. */
export function Sendermast({ x, y, h }: { x: number; y: number; h: number }) {
  const ss = useStrokeScale();
  const wb = 0.12 * h;
  const wt = 0.03 * h;
  const n = 7;
  const half = (t: number) => wb / 2 + (wt / 2 - wb / 2) * t;
  const yAt = (t: number) => y - h * t;
  const segs = Array.from({ length: n }, (_, k) => ({ t0: k / n, t1: (k + 1) / n, c: k % 2 === 0 ? PAINTS.rod : PAINTS.hvit }));
  const brace = segs.map(({ t0, t1 }) => `M${r1(x - half(t0))},${r1(yAt(t0))}L${r1(x + half(t1))},${r1(yAt(t1))}M${r1(x + half(t0))},${r1(yAt(t0))}L${r1(x - half(t1))},${r1(yAt(t1))}`).join('');
  const top = sendermastTopp(x, y, h);
  return (
    <g>
      <path d={brace} stroke={SCENE.metalDark} strokeWidth={0.9 * ss} fill="none" opacity={0.8} />
      {segs.map(({ t0, t1, c }) => (
        <g key={t0}>
          {[-1, 1].map((side) => (
            <g key={side}>
              <line x1={x + side * half(t0)} y1={yAt(t0)} x2={x + side * half(t1)} y2={yAt(t1)} stroke={SCENE.outline} strokeWidth={3.6 * ss} />
              <line x1={x + side * half(t0)} y1={yAt(t0)} x2={x + side * half(t1)} y2={yAt(t1)} stroke={c} strokeWidth={2.2 * ss} />
            </g>
          ))}
          <line x1={x - half(t1)} x2={x + half(t1)} y1={yAt(t1)} y2={yAt(t1)} stroke={SCENE.metalDark} strokeWidth={1.1 * ss} />
        </g>
      ))}
      {/* Antennen på toppen */}
      <rect x={x - 0.012 * h} y={top.y} width={0.024 * h} height={y - h - top.y} fill={SCENE.metalLight} stroke={SCENE.outline} strokeWidth={0.8 * ss} />
      {[0.25, 0.5, 0.75].map((t) => (
        <line key={t} x1={x - 0.035 * h} x2={x + 0.035 * h} y1={top.y + t * (y - h - top.y)} y2={top.y + t * (y - h - top.y)} stroke={SCENE.metalDark} strokeWidth={1.4 * ss} />
      ))}
      <circle cx={top.x} cy={top.y - 2 * ss} r={2.6 * ss} fill={PAINTS.rod} stroke={SCENE.outline} strokeWidth={0.6 * ss} />
    </g>
  );
}

/** Midten av den høyre panelantennen på mobilmasta. */
export const mobilmastAntenne = (x: number, y: number, h: number) => ({ x: x + 0.075 * h, y: y - 0.88 * h });

/** Mobilmast: stålrør med tre panelantenner øverst og et teknikkskap ved foten. (x, y) er foten. */
export function Mobilmast({ x, y, h }: { x: number; y: number; h: number }) {
  const ss = useStrokeScale();
  const id = useSvgId('em-mobilmast');
  const pw = 0.045 * h;
  const panel = (px: number, w: number) => (
    <path d={rr(px - w / 2, y - h * 0.99, w, 0.22 * h, w * 0.3)} fill={`url(#${id}-p)`} stroke={SCENE.outline} strokeWidth={1 * ss} />
  );
  return (
    <g>
      <LinearGradient id={`${id}-m`} x2={1} y2={0} stops={[[0, tint(SCENE.metal, 0.35)], [0.45, SCENE.metal], [1, shade(SCENE.metal, 0.35)]]} />
      <LinearGradient id={`${id}-p`} x2={1} y2={0} stops={[[0, PAINTS.hvit], [1, shade(PAINTS.hvit, 0.18)]]} />
      <ContactShadow cx={x + 0.04 * h} cy={y} rx={0.16 * h} />
      <rect x={x - pw / 2} y={y - h} width={pw} height={h} fill={`url(#${id}-m)`} stroke={SCENE.outline} strokeWidth={1 * ss} />
      {/* Plattform og antennearmer */}
      <rect x={x - 0.1 * h} y={y - 0.76 * h} width={0.2 * h} height={0.018 * h} fill={SCENE.metalDark} />
      <rect x={x - 0.1 * h} y={y - 0.96 * h} width={0.2 * h} height={0.014 * h} fill={SCENE.metalDark} />
      {panel(x - 0.075 * h, 0.05 * h)}
      {panel(x, 0.06 * h)}
      {panel(x + 0.075 * h, 0.05 * h)}
      {/* Teknikkskap */}
      <path d={rr(x + 0.04 * h, y - 0.17 * h, 0.15 * h, 0.17 * h, 0.01 * h)} fill={`url(#${id}-p)`} stroke={SCENE.outline} strokeWidth={1 * ss} />
      <line x1={x + 0.115 * h} x2={x + 0.115 * h} y1={y - 0.16 * h} y2={y - 0.01 * h} stroke={SCENE.outline} strokeWidth={0.8 * ss} />
    </g>
  );
}

/* ---------------------------------------------------------------- Kjøkkenet */

/** Benkeplate i tre (overflaten i y) med hvite skapdører under. */
export function Kjokkenbenk({ x1, x2, y, depth }: { x1: number; x2: number; y: number; depth: number }) {
  const ss = useStrokeScale();
  const id = useSvgId('em-benk');
  const th = Math.min(16, depth * 0.12);
  const doors = Math.max(2, Math.round((x2 - x1) / 150));
  const dw = (x2 - x1 - 16) / doors;
  return (
    <g>
      <LinearGradient id={`${id}-t`} stops={materialStops(SCENE.wood)} />
      <LinearGradient id={`${id}-d`} stops={[[0, PAINTS.hvit], [1, shade(PAINTS.hvit, 0.12)]]} />
      <rect x={x1 + 6} y={y + th} width={x2 - x1 - 12} height={depth - th} fill={shade(PAINTS.hvit, 0.25)} />
      {Array.from({ length: doors }, (_, i) => (
        <g key={i}>
          <path d={rr(x1 + 8 + i * dw + 2, y + th + 6, dw - 4, depth - th - 6, 3)} fill={`url(#${id}-d)`} stroke={SCENE.outline} strokeWidth={0.9 * ss} />
          <rect x={x1 + 8 + i * dw + dw / 2 - 14} y={y + th + 16} width={28} height={4} rx={2} fill={SCENE.metal} stroke={SCENE.outline} strokeWidth={0.6 * ss} />
        </g>
      ))}
      <rect x={x1} y={y - 2} width={x2 - x1} height={th} rx={2} fill={`url(#${id}-t)`} stroke={SCENE.outline} strokeWidth={1 * ss} />
      <line x1={x1 + 2} x2={x2 - 2} y1={y} y2={y} stroke={tint(SCENE.wood, 0.45)} strokeWidth={1.2 * ss} />
    </g>
  );
}

/** Vinduet i ovnsdøra (der vi ser inn i ovnsrommet). (x, y) er midt under ovnen, w bredden. */
export const ovnVindu = (x: number, y: number, w: number) => {
  const h = 0.58 * w;
  return { x: x - w / 2 + 0.06 * w, y: y - h + 0.1 * w, w: 0.6 * w, h: h - 0.2 * w };
};

/** Mikrobølgeovn på benken med vindu inn til ovnsrommet, glasstallerken og panel med display og bryter. */
export function Mikrobolgeovn({ x, y, w, children, tid = '1:30' }: { x: number; y: number; w: number; children?: ReactNode; tid?: string }) {
  const ss = useStrokeScale();
  const id = useSvgId('em-ovn');
  const h = 0.58 * w;
  const left = x - w / 2;
  const top = y - h;
  const v = ovnVindu(x, y, w);
  const px = left + 0.74 * w;
  const mesh = Array.from({ length: Math.floor(v.h / 7) }, (_, i) => `M${r1(v.x + 3)},${r1(v.y + 4 + i * 7)}H${r1(v.x + v.w - 3)}`).join('');
  return (
    <g>
      <LinearGradient id={`${id}-b`} stops={[[0, tint(SCENE.metalLight, 0.2)], [0.5, SCENE.metalLight], [1, shade(SCENE.metalLight, 0.18)]]} />
      <LinearGradient id={`${id}-i`} stops={[[0, shade(SCENE.metal, 0.55)], [1, shade(SCENE.metal, 0.3)]]} />
      <clipPath id={`${id}-c`}>
        <rect x={v.x} y={v.y} width={v.w} height={v.h} rx={4} />
      </clipPath>
      <ContactShadow cx={x} cy={y} rx={w * 0.52} />
      <rect x={left + 0.06 * w} y={y - 3} width={0.08 * w} height={4} fill={SCENE.rubber} />
      <rect x={left + 0.86 * w} y={y - 3} width={0.08 * w} height={4} fill={SCENE.rubber} />
      <path d={rr(left, top, w, h - 2, 0.03 * w)} fill={`url(#${id}-b)`} stroke={SCENE.outline} strokeWidth={1.2 * ss} />
      {/* Døra */}
      <path d={rr(left + 0.025 * w, top + 0.05 * w, 0.68 * w, h - 0.11 * w, 0.02 * w)} fill={shade(SCENE.metalLight, 0.08)} stroke={SCENE.outline} strokeWidth={0.9 * ss} />
      <g clipPath={`url(#${id}-c)`}>
        <rect x={v.x} y={v.y} width={v.w} height={v.h} fill={`url(#${id}-i)`} />
        <ellipse cx={v.x + v.w / 2} cy={v.y + v.h * 0.9} rx={v.w * 0.42} ry={v.h * 0.07} fill={alpha(SCENE.glass, 0.55)} stroke={alpha(SCENE.glassEdge, 0.8)} strokeWidth={1 * ss} />
        {children}
        <path d={mesh} stroke={alpha(SCENE.space, 0.25)} strokeWidth={1.6 * ss} strokeDasharray={`${1.6 * ss} ${4.4}`} strokeLinecap="round" />
        <path d={`M${v.x},${v.y + v.h * 0.45}L${v.x + v.w * 0.35},${v.y}H${v.x + v.w * 0.5}L${v.x + v.w * 0.08},${v.y + v.h * 0.7}Z`} fill={alpha(SCENE.highlight, 0.12)} />
      </g>
      <rect x={v.x} y={v.y} width={v.w} height={v.h} rx={4} fill="none" stroke={SCENE.outline} strokeWidth={1.1 * ss} />
      {/* Panelet */}
      <rect x={px} y={top + 0.07 * w} width={0.2 * w} height={0.08 * w} rx={3} fill={SCENE.display} stroke={SCENE.outline} strokeWidth={0.8 * ss} />
      <Txt x={px + 0.1 * w} y={top + 0.07 * w + 0.058 * w} px={0.055 * w} color={SCENE.displayText} halo={false} weight={600}>
        {tid}
      </Txt>
      {[0, 1, 2].map((r) =>
        [0, 1, 2].map((c) => (
          <rect key={`${r}${c}`} x={px + 0.012 * w + c * 0.064 * w} y={top + 0.19 * w + r * 0.045 * w} width={0.05 * w} height={0.03 * w} rx={2} fill={shade(SCENE.metalLight, 0.12)} stroke={SCENE.outline} strokeWidth={0.6 * ss} />
        )),
      )}
      <circle cx={px + 0.1 * w} cy={top + 0.45 * w} r={0.055 * w} fill={SCENE.metalLight} stroke={SCENE.outline} strokeWidth={1 * ss} />
      <line x1={px + 0.1 * w} x2={px + 0.1 * w} y1={top + 0.45 * w - 0.045 * w} y2={top + 0.45 * w - 0.015 * w} stroke={SCENE.metalDark} strokeWidth={1.6 * ss} strokeLinecap="round" />
      <rect x={left + 0.69 * w} y={top + 0.12 * w} width={0.022 * w} height={h - 0.26 * w} rx={0.011 * w} fill={SCENE.metal} stroke={SCENE.outline} strokeWidth={0.7 * ss} />
    </g>
  );
}

/** Toppen av den høyre antennen på wifi-ruteren. */
export const ruterAntenne = (x: number, y: number, size: number) => ({ x: x + 0.38 * size, y: y - 0.95 * size });

/** Wifi-ruter: hvit boks med lysdioder foran og to antenner. (x, y) er midt under ruteren, size bredden. */
export function Wifiruter({ x, y, size }: { x: number; y: number; size: number }) {
  const ss = useStrokeScale();
  const id = useSvgId('em-ruter');
  const h = 0.24 * size;
  const tip = ruterAntenne(x, y, size);
  return (
    <g>
      <LinearGradient id={id} stops={[[0, PAINTS.hvit], [1, shade(PAINTS.hvit, 0.16)]]} />
      <ContactShadow cx={x} cy={y} rx={size * 0.55} />
      {[-1, 1].map((sd) => {
        const bx = x + sd * 0.38 * size;
        const ang = sd * 8;
        return (
          <g key={sd} transform={`rotate(${ang} ${bx} ${y - h})`}>
            <rect x={bx - 0.035 * size} y={tip.y + (sd === 1 ? 0 : 0)} width={0.07 * size} height={y - h - tip.y + 2} rx={0.035 * size} fill={PAINTS.svart} stroke={SCENE.outline} strokeWidth={0.8 * ss} />
          </g>
        );
      })}
      <path d={rr(x - size / 2, y - h, size, h, 0.06 * size)} fill={`url(#${id})`} stroke={SCENE.outline} strokeWidth={1 * ss} />
      {[0, 1, 2, 3].map((i) => (
        <circle key={i} cx={x - 0.24 * size + i * 0.1 * size} cy={y - h * 0.45} r={0.022 * size} fill={i === 3 ? PAINTS.oransje : tint(PAINTS.gronn, 0.25)} />
      ))}
    </g>
  );
}

/** Mobiltelefon sett litt fra siden: mørk ramme og skjerm som lyser. (x, y) er midten, size høyden. */
export function Mobiltelefon({ x, y, size, rotate = 0 }: { x: number; y: number; size: number; rotate?: number }) {
  const ss = useStrokeScale();
  const id = useSvgId('em-mobil');
  const w = 0.5 * size;
  return (
    <g transform={`rotate(${rotate} ${x} ${y})`}>
      <LinearGradient id={id} x2={1} y2={1} stops={[[0, tint(SCENE.cold, 0.35)], [1, shade(SCENE.cold, 0.25)]]} />
      <path d={rr(x - w / 2, y - size / 2, w, size, 0.12 * w)} fill={PAINTS.svart} stroke={SCENE.outline} strokeWidth={0.9 * ss} />
      <path d={rr(x - w / 2 + 0.07 * w, y - size / 2 + 0.06 * w, w - 0.14 * w, size - 0.12 * w, 0.08 * w)} fill={`url(#${id})`} />
    </g>
  );
}

/** Fjernkontroll med knapper og lysdioden foran. (x, y) er midten, len lengden; rotate dreier om midten. */
export function Fjernkontroll({ x, y, len, rotate = 0 }: { x: number; y: number; len: number; rotate?: number }) {
  const ss = useStrokeScale();
  const h = 0.2 * len;
  return (
    <g transform={`rotate(${rotate} ${x} ${y})`}>
      <path d={rr(x - len / 2, y - h / 2, len, h, h * 0.4)} fill={PAINTS.svart} stroke={SCENE.outline} strokeWidth={0.9 * ss} />
      <ellipse cx={x + len / 2} cy={y} rx={0.05 * len} ry={0.06 * len} fill={shade(PAINTS.rod, 0.4)} stroke={SCENE.outline} strokeWidth={0.6 * ss} />
      {[-0.25, -0.05, 0.15].map((t) => (
        <circle key={t} cx={x + t * len} cy={y - h * 0.5} r={0.035 * len} fill={PAINTS.graa} />
      ))}
    </g>
  );
}

/** Lysdioden på fjernkontrollen (der IR-lyset kommer ut). */
export const fjernkontrollLed = (x: number, y: number, len: number, rotate = 0) => {
  const a = (rotate * Math.PI) / 180;
  return { x: x + Math.cos(a) * len * 0.55, y: y + Math.sin(a) * len * 0.55 };
};

/** Mottakeren for IR-signalet nede til høyre på TV-en. */
export const tvSensor = (x: number, y: number, w: number) => ({ x: x - 0.4 * w, y: y - 0.3 * w - 0.022 * w });

/** Flatskjerm på TV-benk. (x, y) er midt under benken på gulvet, w bredden på skjermen. Skjermen viser et rolig bilde. */
export function Tv({ x, y, w }: { x: number; y: number; w: number }) {
  const ss = useStrokeScale();
  const id = useSvgId('em-tv');
  const bh = 0.24 * w; // benken
  const sh = 0.58 * w;
  const sy = y - bh - 0.06 * w - sh; // overkanten av skjermen
  const s = tvSensor(x, y, w);
  return (
    <g>
      <LinearGradient id={`${id}-b`} stops={materialStops(SCENE.woodDark)} />
      <LinearGradient id={`${id}-s`} stops={[[0, shade(SCENE.skyTop, 0.35)], [0.6, shade(SCENE.skyBottom, 0.3)], [0.61, shade(SCENE.hillFar, 0.3)], [1, shade(SCENE.grass, 0.45)]]} />
      <ContactShadow cx={x} cy={y} rx={0.62 * w} />
      <path d={rr(x - 0.6 * w, y - bh, 1.2 * w, bh, 4)} fill={`url(#${id}-b)`} stroke={SCENE.outline} strokeWidth={1 * ss} />
      <line x1={x} x2={x} y1={y - bh + 4} y2={y - 4} stroke={SCENE.outline} strokeWidth={0.9 * ss} />
      <rect x={x - 0.12 * w} y={y - bh - 0.025 * w} width={0.24 * w} height={0.025 * w} rx={2} fill={SCENE.metalDark} />
      <rect x={x - 0.025 * w} y={y - bh - 0.07 * w} width={0.05 * w} height={0.05 * w} fill={SCENE.metalDark} />
      <path d={rr(x - w / 2, sy, w, sh, 4)} fill={PAINTS.svart} stroke={SCENE.outline} strokeWidth={1.1 * ss} />
      <rect x={x - w / 2 + 0.02 * w} y={sy + 0.02 * w} width={w - 0.04 * w} height={sh - 0.065 * w} fill={`url(#${id}-s)`} />
      <path d={`M${x - w / 2 + 0.02 * w},${sy + 0.02 * w + sh * 0.5}L${x - w * 0.1},${sy + 0.02 * w}H${x + w * 0.05}L${x - w / 2 + 0.02 * w},${sy + sh * 0.8}Z`} fill={alpha(SCENE.highlight, 0.1)} />
      <circle cx={s.x} cy={s.y} r={0.011 * w} fill={shade(PAINTS.graa, 0.5)} stroke={alpha(PAINTS.hvit, 0.4)} strokeWidth={0.6 * ss} />
      <circle cx={s.x + 0.03 * w} cy={s.y} r={0.005 * w} fill={PAINTS.rod} />
    </g>
  );
}

/* ---------------------------------------------------------------- Varmekameraet */

/** Linsen på varmekameraet (foran, mot venstre). (x, y) er grepet. */
export const varmekameraLinse = (x: number, y: number, size: number) => ({ x: x - 0.62 * size, y: y - 0.42 * size });

/** Håndholdt varmekamera med pistolgrep, sett fra siden med linsen mot venstre. (x, y) er midt i grepet, size lengden. */
export function Varmekamera({ x, y, size }: { x: number; y: number; size: number }) {
  const ss = useStrokeScale();
  const id = useSvgId('em-vk');
  const bodyY = y - 0.6 * size;
  const l = varmekameraLinse(x, y, size);
  return (
    <g>
      <LinearGradient id={`${id}-b`} stops={materialStops(shade(PAINTS.graa, 0.35))} />
      <LinearGradient id={`${id}-l`} stops={[[0, shade(PAINTS.svart, 0.1)], [1, PAINTS.svart]]} />
      <path d={`M${x - 0.1 * size},${bodyY + 0.3 * size}L${x - 0.14 * size},${y + 0.25 * size}H${x + 0.14 * size}L${x + 0.18 * size},${bodyY + 0.3 * size}Z`} fill={`url(#${id}-b)`} stroke={SCENE.outline} strokeWidth={1 * ss} />
      <path d={rr(x - 0.5 * size, bodyY, 0.9 * size, 0.36 * size, 0.06 * size)} fill={`url(#${id}-b)`} stroke={SCENE.outline} strokeWidth={1 * ss} />
      <path d={rr(l.x - 0.02 * size, l.y - 0.14 * size, 0.16 * size, 0.28 * size, 0.04 * size)} fill={`url(#${id}-l)`} stroke={SCENE.outline} strokeWidth={1 * ss} />
      <ellipse cx={l.x - 0.02 * size} cy={l.y} rx={0.035 * size} ry={0.12 * size} fill={mix(PAINTS.lilla, PAINTS.svart, 0.55)} stroke={SCENE.outline} strokeWidth={0.8 * ss} />
      <rect x={x + 0.28 * size} y={bodyY + 0.06 * size} width={0.1 * size} height={0.24 * size} rx={3} fill={SCENE.display} />
      <rect x={x - 0.06 * size} y={bodyY + 0.36 * size} width={0.07 * size} height={0.08 * size} rx={2} fill={PAINTS.oransje} />
    </g>
  );
}

/** Varmekameraets bilde: personen sett forfra i falske farger (lyst = varmt) med temperaturskala. (x, y) er øverste venstre hjørne. */
export function Varmebilde({ x, y, w, h, tMaks = 36, tMin = 12 }: { x: number; y: number; w: number; h: number; tMaks?: number; tMin?: number }) {
  const ss = useStrokeScale();
  const id = useSvgId('em-vb');
  const hot = tint(PAINTS.gul, 0.55);
  const warm = mix(PAINTS.oransje, PAINTS.gul, 0.35);
  const mid = mix(PAINTS.rod, PAINTS.oransje, 0.3);
  const cool = mix(PAINTS.lilla, PAINTS.rod, 0.45);
  const bg = mix(PAINTS.lilla, PAINTS.svart, 0.62);
  const ix = x + 6;
  const iy = y + 6;
  const iw = w - 12 - 0.13 * w;
  const ih = h - 12;
  const cx = ix + iw / 2;
  const u = ih / 10; // enhet for personen
  const head = { x: cx, y: iy + 1.6 * u };
  return (
    <g>
      <LinearGradient id={`${id}-s`} stops={[[0, hot], [0.3, warm], [0.6, mid], [0.85, cool], [1, bg]]} />
      <RadialGradient id={`${id}-h`} stops={[[0, tint(hot, 0.4)], [1, warm]]} />
      <path d={rr(x, y, w, h, 8)} fill={PAINTS.svart} stroke={SCENE.outline} strokeWidth={1.2 * ss} />
      <rect x={ix} y={iy} width={iw} height={ih} rx={3} fill={bg} />
      <clipPath id={`${id}-c`}>
        <rect x={ix} y={iy} width={iw} height={ih} rx={3} />
      </clipPath>
      <g clipPath={`url(#${id}-c)`}>
        {/* Bein, kropp, armer, hals og hode */}
        <path d={`M${cx - 1.1 * u},${iy + 5.6 * u}L${cx - 1.2 * u},${iy + ih + 2}H${cx - 0.15 * u}L${cx},${iy + 6.4 * u}L${cx + 0.15 * u},${iy + ih + 2}H${cx + 1.2 * u}L${cx + 1.1 * u},${iy + 5.6 * u}Z`} fill={cool} />
        <path d={rr(cx - 1.55 * u, iy + 2.9 * u, 3.1 * u, 3.4 * u, 0.8 * u)} fill={mid} />
        <path d={rr(cx - 0.6 * u, iy + 3.2 * u, 1.2 * u, 2.4 * u, 0.4 * u)} fill={alpha(warm, 0.6)} />
        {[-1, 1].map((sd) => (
          <g key={sd}>
            <path d={`M${cx + sd * 1.45 * u},${iy + 3.2 * u}L${cx + sd * 2.05 * u},${iy + 5.9 * u}`} stroke={mid} strokeWidth={0.75 * u} strokeLinecap="round" />
            <circle cx={cx + sd * 2.1 * u} cy={iy + 6.2 * u} r={0.42 * u} fill={hot} />
          </g>
        ))}
        <rect x={cx - 0.35 * u} y={iy + 2.3 * u} width={0.7 * u} height={0.8 * u} fill={warm} />
        <ellipse cx={head.x} cy={head.y} rx={0.95 * u} ry={1.15 * u} fill={`url(#${id}-h)`} />
        <path d={`M${head.x - 1 * u},${head.y - 0.2 * u}Q${head.x},${head.y - 1.9 * u} ${head.x + 1 * u},${head.y - 0.2 * u}Q${head.x},${head.y - 1 * u} ${head.x - 1 * u},${head.y - 0.2 * u}Z`} fill={mid} />
        {/* Sikte på ansiktet */}
        <g stroke={PAINTS.hvit} strokeWidth={1.2 * ss} fill="none">
          <circle cx={head.x} cy={head.y + 0.2 * u} r={0.35 * u} />
          <path d={`M${head.x - 0.7 * u},${head.y + 0.2 * u}h${0.25 * u}M${head.x + 0.45 * u},${head.y + 0.2 * u}h${0.25 * u}`} />
        </g>
      </g>
      <Txt x={ix + 4} y={iy + 0.95 * u} anchor="start" px={Math.max(10, 0.85 * u)} color={PAINTS.hvit} halo={false} weight={650}>
        {`${tMaks} °C`}
      </Txt>
      {/* Temperaturskala */}
      <rect x={x + w - 0.11 * w - 4} y={iy + 0.9 * u} width={0.05 * w} height={ih - 1.8 * u} fill={`url(#${id}-s)`} stroke={alpha(PAINTS.hvit, 0.5)} strokeWidth={0.8 * ss} />
      <Txt x={x + w - 0.085 * w - 4} y={iy + 0.7 * u} px={Math.max(9, 0.6 * u)} color={PAINTS.hvit} halo={false}>
        {String(tMaks)}
      </Txt>
      <Txt x={x + w - 0.085 * w - 4} y={iy + ih - 0.05 * u} px={Math.max(9, 0.6 * u)} color={PAINTS.hvit} halo={false}>
        {String(tMin)}
      </Txt>
    </g>
  );
}

/* ---------------------------------------------------------------- Solkrem */

/** Solkremtube som står på korken (nede) i snøen. (x, y) er midt under korken, size høyden. */
export function Solkrem({ x, y, size }: { x: number; y: number; size: number }) {
  const ss = useStrokeScale();
  const id = useSvgId('em-solkrem');
  const w = 0.42 * size;
  const capH = 0.18 * size;
  return (
    <g>
      <LinearGradient id={`${id}-t`} x2={1} y2={0} stops={[[0, tint(PAINTS.hvit, 0.2)], [0.5, PAINTS.hvit], [1, shade(PAINTS.hvit, 0.2)]]} />
      <LinearGradient id={`${id}-k`} x2={1} y2={0} stops={materialStops(PAINTS.oransje)} />
      <ContactShadow cx={x} cy={y} rx={w * 0.7} />
      <path d={rr(x - 0.32 * w, y - capH, 0.64 * w, capH, 3)} fill={`url(#${id}-k)`} stroke={SCENE.outline} strokeWidth={0.9 * ss} />
      <path
        d={`M${x - 0.34 * w},${y - capH}C${x - 0.5 * w},${y - 0.5 * size} ${x - 0.52 * w},${y - 0.8 * size} ${x - 0.5 * w},${y - size}H${x + 0.5 * w}C${x + 0.52 * w},${y - 0.8 * size} ${x + 0.5 * w},${y - 0.5 * size} ${x + 0.34 * w},${y - capH}Z`}
        fill={`url(#${id}-t)`}
        stroke={SCENE.outline}
        strokeWidth={0.9 * ss}
      />
      <rect x={x - 0.52 * w} y={y - size - 0.04 * size} width={1.04 * w} height={0.06 * size} rx={1.5} fill={shade(PAINTS.hvit, 0.15)} stroke={SCENE.outline} strokeWidth={0.8 * ss} />
      <circle cx={x} cy={y - 0.68 * size} r={0.13 * w + 0.03 * size} fill={PAINTS.oransje} />
      <Txt x={x} y={y - 0.38 * size} px={Math.max(9, 0.11 * size)} color={shade(PAINTS.oransje, 0.35)} halo={false} weight={750}>
        SPF 30
      </Txt>
    </g>
  );
}

/* ---------------------------------------------------------------- Røntgen */

/** Røntgenrør med blender, hengt i en arm fra taket. (x, y) er åpningen i blenderen der strålen kommer ut; w bredden på røret. */
export function Rontgenror({ x, y, w, top }: { x: number; y: number; w: number; top: number }) {
  const ss = useStrokeScale();
  const id = useSvgId('em-ror');
  const tubeH = 0.42 * w;
  const tubeY = y - 0.34 * w - tubeH;
  return (
    <g>
      <LinearGradient id={`${id}-m`} x2={1} y2={0} stops={[[0, tint(SCENE.metal, 0.3)], [0.5, SCENE.metal], [1, shade(SCENE.metal, 0.3)]]} />
      <LinearGradient id={`${id}-r`} stops={[[0, tint(SCENE.plastic, 0.3)], [0.5, SCENE.plastic], [1, shade(SCENE.plastic, 0.25)]]} />
      <rect x={x + 0.18 * w} y={top} width={0.12 * w} height={tubeY - top + 4} fill={`url(#${id}-m)`} stroke={SCENE.outline} strokeWidth={0.9 * ss} />
      <path d={rr(x - w / 2, tubeY, w, tubeH, tubeH * 0.45)} fill={`url(#${id}-r)`} stroke={SCENE.outline} strokeWidth={1.1 * ss} />
      <ellipse cx={x - w / 2 + 0.06 * w} cy={tubeY + tubeH / 2} rx={0.05 * w} ry={tubeH * 0.42} fill={shade(SCENE.plastic, 0.12)} stroke={SCENE.outline} strokeWidth={0.8 * ss} />
      <ellipse cx={x + w / 2 - 0.06 * w} cy={tubeY + tubeH / 2} rx={0.05 * w} ry={tubeH * 0.42} fill={shade(SCENE.plastic, 0.12)} stroke={SCENE.outline} strokeWidth={0.8 * ss} />
      {/* Blenderen */}
      <path d={rr(x - 0.24 * w, y - 0.34 * w, 0.48 * w, 0.32 * w, 0.04 * w)} fill={`url(#${id}-r)`} stroke={SCENE.outline} strokeWidth={1 * ss} />
      <rect x={x - 0.15 * w} y={y - 0.04 * w} width={0.3 * w} height={0.04 * w} rx={2} fill={SCENE.glow} stroke={SCENE.outline} strokeWidth={0.8 * ss} />
      <rect x={x + 0.25 * w} y={y - 0.26 * w} width={0.12 * w} height={0.06 * w} rx={2} fill={SCENE.metalDark} />
    </g>
  );
}

/**
 * Underarm og hånd som ligger flatt på en plate med håndflata ned, sett fra siden (albuen til venstre, fingrene mot
 * høyre). (x, y) er albuen på plata; len er lengden fra albuen til fingertuppene.
 */
export function Underarm({ x, y, len, jakke = PAINTS.blaa }: { x: number; y: number; len: number; jakke?: string }) {
  const ss = useStrokeScale();
  const id = useSvgId('em-arm');
  const L = len;
  const wr = x + 0.6 * L; // håndleddet
  const kn = x + 0.83 * L; // knokene
  const tip = x + L;
  // Underarmen smalner av mot håndleddet; hånda er flat, med knokene litt opp og fingrene ned mot plata
  const arm = `M${x},${y}V${y - 0.12 * L}C${x + 0.22 * L},${y - 0.125 * L} ${wr - 0.14 * L},${y - 0.085 * L} ${wr},${y - 0.068 * L}C${wr + 0.08 * L},${y - 0.07 * L} ${kn - 0.06 * L},${y - 0.07 * L} ${kn},${y - 0.058 * L}C${kn + 0.07 * L},${y - 0.05 * L} ${tip - 0.03 * L},${y - 0.03 * L} ${tip},${y - 0.012 * L}Q${tip + 0.004 * L},${y} ${tip - 0.02 * L},${y}Z`;
  // Tommelen ligger langs siden av hånda, nærmest oss
  const thumb = `M${wr + 0.04 * L},${y - 0.04 * L}C${wr + 0.09 * L},${y - 0.05 * L} ${wr + 0.15 * L},${y - 0.035 * L} ${wr + 0.19 * L},${y - 0.012 * L}Q${wr + 0.2 * L},${y} ${wr + 0.17 * L},${y}H${wr + 0.06 * L}Z`;
  return (
    <g>
      <LinearGradient id={id} stops={[[0, tint(SCENE.skin, 0.18)], [0.6, SCENE.skin], [1, shade(SCENE.skin, 0.2)]]} />
      <ContactShadow cx={x + L / 2} cy={y} rx={L * 0.5} />
      <path d={arm} fill={`url(#${id})`} stroke={SCENE.outline} strokeWidth={1 * ss} />
      <path d={thumb} fill={SCENE.skin} stroke={SCENE.outline} strokeWidth={0.9 * ss} />
      {/* Knoker og fingerledd */}
      <path d={`M${kn - 0.01 * L},${y - 0.055 * L}q${0.01 * L},${0.012 * L} ${0.004 * L},${0.03 * L}M${kn + 0.07 * L},${y - 0.042 * L}q${0.008 * L},${0.01 * L} ${0.003 * L},${0.022 * L}`} stroke={shade(SCENE.skin, 0.32)} strokeWidth={0.9 * ss} fill="none" />
      <path d={`M${tip - 0.035 * L},${y - 0.022 * L}q${0.02 * L},${-0.002 * L} ${0.03 * L},${0.008 * L}`} stroke={tint(SCENE.skin, 0.45)} strokeWidth={1.2 * ss} fill="none" />
      <path d={rr(x - 0.14 * L, y - 0.14 * L, 0.2 * L, 0.14 * L, 0.03 * L)} fill={jakke} stroke={SCENE.outline} strokeWidth={1 * ss} />
      <line x1={x + 0.055 * L} x2={x + 0.055 * L} y1={y - 0.135 * L} y2={y - 0.005 * L} stroke={shade(jakke, 0.3)} strokeWidth={1.4 * ss} />
    </g>
  );
}

/** Skjermflaten (barna tegnes her) for en skjerm med fot i (x, y), bredde w og høyde h. */
export const skjermFlate = (x: number, y: number, w: number, h: number) => ({ x: x - w / 2 + 6, y: y - 0.12 * h - h + 6, w: w - 12, h: h - 12 });

/** Dataskjerm på fot. (x, y) er midt under foten. Barna tegnes på skjermflaten og klippes til den. */
export function Skjerm({ x, y, w, h, children }: { x: number; y: number; w: number; h: number; children?: ReactNode }) {
  const ss = useStrokeScale();
  const id = useSvgId('em-skjerm');
  const f = skjermFlate(x, y, w, h);
  return (
    <g>
      <clipPath id={id}>
        <rect x={f.x} y={f.y} width={f.w} height={f.h} rx={2} />
      </clipPath>
      <ContactShadow cx={x} cy={y} rx={0.3 * w} />
      <path d={rr(x - 0.2 * w, y - 0.03 * h, 0.4 * w, 0.03 * h + 2, 2)} fill={SCENE.metalDark} stroke={SCENE.outline} strokeWidth={0.8 * ss} />
      <rect x={x - 0.03 * w} y={y - 0.14 * h} width={0.06 * w} height={0.12 * h} fill={SCENE.metal} stroke={SCENE.outline} strokeWidth={0.8 * ss} />
      <path d={rr(x - w / 2, y - 0.12 * h - h, w, h, 5)} fill={PAINTS.svart} stroke={SCENE.outline} strokeWidth={1.1 * ss} />
      <rect x={f.x} y={f.y} width={f.w} height={f.h} rx={2} fill={SCENE.space} />
      <g clipPath={`url(#${id})`}>{children}</g>
    </g>
  );
}

/**
 * Knoklene i en hånd og nederst i underarmen sett ovenfra, slik de ser ut på et røntgenbilde: lyse knokler i svakt
 * bløtvev på mørk bunn (mørk i begge temaer). (cx, cy) er midt i håndleddet, size lengden fra håndleddet til tuppen
 * av langfingeren. `brudd` tegner et brudd i spolebeinet (radius) like over håndleddet. Gir tilbake ingenting; bruk
 * rontgenBrudd(cx, cy, size) for å peke på bruddet.
 */
export function RontgenHand({ cx, cy, size, brudd = true }: { cx: number; cy: number; size: number; brudd?: boolean }) {
  const ss = useStrokeScale();
  const bone = mix(SCENE.star, SCENE.space, 0.1);
  const boneEdge = mix(SCENE.star, SCENE.space, 0.45);
  const soft = alpha(SCENE.star, 0.14);
  const s = size;
  // Fingrene: festepunkt på håndroten (relativt), vinkel (grader fra loddrett), lengdene (mellomhåndsben først), bredde
  const fingers = [
    { x: -0.15, y: -0.075, a: -40, l: [0.25, 0.17, 0.13], w: 0.075 }, // tommelen
    { x: -0.095, y: -0.17, a: -10, l: [0.36, 0.22, 0.13, 0.09], w: 0.068 },
    { x: -0.02, y: -0.175, a: -2, l: [0.35, 0.24, 0.15, 0.1], w: 0.07 },
    { x: 0.055, y: -0.17, a: 6, l: [0.33, 0.22, 0.14, 0.095], w: 0.064 },
    { x: 0.12, y: -0.155, a: 14, l: [0.3, 0.17, 0.1, 0.085], w: 0.058 },
  ];
  const bones: { x1: number; y1: number; x2: number; y2: number; w: number }[] = [];
  const softs: string[] = [];
  for (const fg of fingers) {
    let px = cx + fg.x * s;
    let py = cy + fg.y * s;
    const sx = px;
    const sy = py;
    fg.l.forEach((l, i) => {
      // Fingrene bøyer litt innover mot langfingeren lenger ut
      const a = ((fg.a * (i === 0 ? 1 : 0.7)) * Math.PI) / 180;
      const ux = Math.sin(a);
      const uy = -Math.cos(a);
      const gap = 0.022 * s;
      const L = l * s - gap;
      bones.push({ x1: px, y1: py, x2: px + ux * L, y2: py + uy * L, w: fg.w * s * (i === 0 ? 0.8 : 0.82 - 0.1 * i) });
      px += ux * (L + gap);
      py += uy * (L + gap);
    });
    softs.push(`M${r1(sx)},${r1(sy)}L${r1(px)},${r1(py)}`);
  }
  // Håndrotsknoklene: åtte små knoller i to rader
  const carpals = [
    [-0.12, -0.05, 0.048],
    [-0.045, -0.055, 0.045],
    [0.03, -0.055, 0.044],
    [0.1, -0.05, 0.042],
    [-0.14, -0.12, 0.045],
    [-0.065, -0.128, 0.05],
    [0.015, -0.132, 0.05],
    [0.09, -0.122, 0.046],
  ] as const;
  const bw = Math.max(0.8, 0.006 * s);
  return (
    <g>
      {/* Bløtvev */}
      <path d={softs.join('')} stroke={soft} strokeWidth={0.13 * s} strokeLinecap="round" fill="none" />
      <path d={`M${cx - 0.25 * s},${cy + 1 * s}L${cx - 0.23 * s},${cy - 0.02 * s}Q${cx - 0.27 * s},${cy - 0.16 * s} ${cx - 0.15 * s},${cy - 0.22 * s}L${cx + 0.18 * s},${cy - 0.21 * s}Q${cx + 0.23 * s},${cy - 0.05 * s} ${cx + 0.21 * s},${cy + 0.02 * s}L${cx + 0.23 * s},${cy + 1 * s}Z`} fill={soft} />
      {/* Spolebeinet (radius, på tommelsida) og albuebeinet (ulna) */}
      <path
        d={`M${cx - 0.18 * s},${cy + 1 * s}L${cx - 0.16 * s},${cy + 0.15 * s}Q${cx - 0.22 * s},${cy + 0.03 * s} ${cx - 0.17 * s},${cy - 0.005 * s}H${cx - 0.01 * s}Q${cx + 0.025 * s},${cy + 0.05 * s} ${cx - 0.045 * s},${cy + 0.16 * s}L${cx - 0.07 * s},${cy + 1 * s}Z`}
        fill={bone}
        stroke={boneEdge}
        strokeWidth={bw}
      />
      <path
        d={`M${cx + 0.03 * s},${cy + 1 * s}L${cx + 0.055 * s},${cy + 0.12 * s}Q${cx + 0.045 * s},${cy + 0.015 * s} ${cx + 0.1 * s},${cy + 0.005 * s}Q${cx + 0.165 * s},${cy + 0.03 * s} ${cx + 0.135 * s},${cy + 0.13 * s}L${cx + 0.12 * s},${cy + 1 * s}Z`}
        fill={bone}
        stroke={boneEdge}
        strokeWidth={bw}
      />
      {carpals.map(([dx, dy, r], i) => (
        <ellipse key={i} cx={cx + dx * s} cy={cy + dy * s} rx={r * s} ry={r * s * 0.8} fill={bone} stroke={boneEdge} strokeWidth={bw} />
      ))}
      {bones.map((b, k) => (
        <g key={k}>
          <line x1={b.x1} y1={b.y1} x2={b.x2} y2={b.y2} stroke={boneEdge} strokeWidth={b.w + 2 * bw} strokeLinecap="round" />
          <line x1={b.x1} y1={b.y1} x2={b.x2} y2={b.y2} stroke={bone} strokeWidth={b.w} strokeLinecap="round" />
          <line x1={(b.x1 * 2 + b.x2) / 3} y1={(b.y1 * 2 + b.y2) / 3} x2={(b.x1 + b.x2 * 2) / 3} y2={(b.y1 + b.y2 * 2) / 3} stroke={boneEdge} strokeWidth={b.w * 0.25} strokeLinecap="round" opacity={0.35} />
        </g>
      ))}
      {brudd && <path d={rontgenBruddSti(cx, cy, s)} stroke={SCENE.space} strokeWidth={Math.max(1.6 * ss, 0.014 * s)} fill="none" strokeLinejoin="round" />}
    </g>
  );
}

/** Bruddet i spolebeinet (radius) like over håndleddet. */
function rontgenBruddSti(cx: number, cy: number, s: number): string {
  return `M${cx - 0.205 * s},${cy + 0.17 * s}l${0.035 * s},${0.02 * s}l${0.03 * s},${-0.018 * s}l${0.035 * s},${0.026 * s}l${0.035 * s},${-0.012 * s}l${0.03 * s},${0.016 * s}`;
}

/** Midten av bruddet (til en etikett). */
export const rontgenBrudd = (cx: number, cy: number, size: number) => ({ x: cx - 0.07 * size, y: cy + 0.18 * size });

/* ---------------------------------------------------------------- Fysikklaben */

/** Toppen av strålekilden i blybeholderen (der gammastrålingen kommer ut). */
export const kildeTopp = (x: number, y: number, size: number) => ({ x: x + 0.3 * size, y: y - 0.62 * size });

/**
 * Blybeholder (sylinder) med strålekilden i en holder på toppen, sett litt ovenfra, med strålingssymbolet på et gult
 * merke og navnet på kilden. (x, y) er midt under beholderen, size bredden.
 */
export function Kildeholder({ x, y, size, navn = 'Cs-137' }: { x: number; y: number; size: number; navn?: string }) {
  const ss = useStrokeScale();
  const id = useSvgId('em-kilde');
  const w = size;
  const h = 0.48 * size;
  const ry = 0.1 * w;
  const t = kildeTopp(x, y, size);
  const topY = y - h;
  // Strålingssymbolet: tre blader rundt en liten sirkel
  const sx = x - 0.2 * w;
  const sy = y - 0.24 * w;
  const R = 0.11 * w;
  const blade = (deg: number) => {
    const a0 = ((deg - 30) * Math.PI) / 180;
    const a1 = ((deg + 30) * Math.PI) / 180;
    const ri = 0.32 * R;
    const ro = R;
    const p = (r: number, a: number) => `${r1(sx + r * Math.cos(a))},${r1(sy + r * Math.sin(a))}`;
    return `M${p(ri, a0)}L${p(ro, a0)}A${ro},${ro} 0 0 1 ${p(ro, a1)}L${p(ri, a1)}A${ri},${ri} 0 0 0 ${p(ri, a0)}Z`;
  };
  return (
    <g>
      <LinearGradient id={`${id}-b`} x2={1} y2={0} stops={[[0, tint(SCENE.metalDark, 0.3)], [0.4, SCENE.metalDark], [1, shade(SCENE.metalDark, 0.4)]]} />
      <ContactShadow cx={x} cy={y} rx={0.6 * w} />
      <path d={`M${x - w / 2},${topY}V${y - ry * 0.4}A${w / 2},${ry} 0 0 0 ${x + w / 2},${y - ry * 0.4}V${topY}Z`} fill={`url(#${id}-b)`} stroke={SCENE.outline} strokeWidth={1.1 * ss} />
      <ellipse cx={x} cy={topY} rx={w / 2} ry={ry} fill={tint(SCENE.metalDark, 0.18)} stroke={SCENE.outline} strokeWidth={1 * ss} />
      <ellipse cx={x} cy={topY} rx={w * 0.3} ry={ry * 0.55} fill={shade(SCENE.metalDark, 0.3)} />
      {/* Kilden: en stav i holderen med en liten skive øverst */}
      <path d={`M${x},${topY}L${t.x},${t.y + 0.03 * w}`} stroke={SCENE.metal} strokeWidth={0.05 * w} strokeLinecap="round" />
      <ellipse cx={t.x} cy={t.y + 0.02 * w} rx={0.07 * w} ry={0.03 * w} fill={SCENE.metalLight} stroke={SCENE.outline} strokeWidth={0.8 * ss} />
      <rect x={sx - 1.35 * R} y={sy - 1.35 * R} width={2.7 * R} height={2.7 * R} rx={3} fill={PAINTS.gul} stroke={SCENE.outline} strokeWidth={0.8 * ss} />
      <g fill={PAINTS.svart}>
        <circle cx={sx} cy={sy} r={0.2 * R} />
        <path d={blade(-90) + blade(30) + blade(150)} />
      </g>
      <Txt x={x + 0.16 * w} y={sy + 0.045 * w} px={Math.max(10, 0.12 * w)} color={PAINTS.hvit} halo={false} weight={700}>
        {navn}
      </Txt>
    </g>
  );
}

/** Vinduet foran på GM-røret (mot venstre). (x, y) er midten av røret. */
export const gmVindu = (x: number, y: number, len: number) => ({ x: x - len / 2, y });

/** GM-rør (geigerrør) som ligger vannrett med vinduet mot venstre og kabelen bak. (x, y) er midten. */
export function GmRor({ x, y, len }: { x: number; y: number; len: number }) {
  const ss = useStrokeScale();
  const id = useSvgId('em-gm');
  const h = 0.2 * len;
  return (
    <g>
      <LinearGradient id={id} stops={[[0, tint(SCENE.metal, 0.4)], [0.4, SCENE.metal], [1, shade(SCENE.metal, 0.35)]]} />
      <path d={rr(x - len / 2, y - h / 2, len, h, 0.25 * h)} fill={`url(#${id})`} stroke={SCENE.outline} strokeWidth={1 * ss} />
      <rect x={x - len / 2 - 2} y={y - h * 0.42} width={0.05 * len} height={h * 0.84} rx={2} fill={shade(SCENE.metal, 0.55)} stroke={SCENE.outline} strokeWidth={0.8 * ss} />
      <rect x={x + len / 2 - 1} y={y - h * 0.22} width={0.08 * len} height={h * 0.44} fill={SCENE.metalDark} stroke={SCENE.outline} strokeWidth={0.8 * ss} />
      <line x1={x - len * 0.2} x2={x - len * 0.2} y1={y - h / 2} y2={y + h / 2} stroke={SCENE.outline} strokeWidth={0.8 * ss} />
    </g>
  );
}

/** Stativ med fotplate, stang og klemme som holder noe i (hx, hy). (x, y) er midt under fotplata. */
export function Stativ({ x, y, hx, hy, size }: { x: number; y: number; hx: number; hy: number; size: number }) {
  const ss = useStrokeScale();
  const top = hy - 0.25 * size;
  return (
    <g>
      <ContactShadow cx={x} cy={y} rx={0.5 * size} />
      <path d={rr(x - 0.45 * size, y - 0.07 * size, 0.9 * size, 0.07 * size, 3)} fill={SCENE.metalDark} stroke={SCENE.outline} strokeWidth={0.9 * ss} />
      <rect x={x - 0.025 * size} y={top} width={0.05 * size} height={y - top - 0.06 * size} fill={SCENE.metalLight} stroke={SCENE.outline} strokeWidth={0.8 * ss} />
      <rect x={x - 0.07 * size} y={hy - 0.06 * size} width={0.14 * size} height={0.12 * size} rx={2} fill={SCENE.metalDark} />
      <rect x={Math.min(x, hx)} y={hy - 0.02 * size} width={Math.abs(hx - x)} height={0.04 * size} fill={SCENE.metal} stroke={SCENE.outline} strokeWidth={0.7 * ss} />
      <path d={rr(hx - 0.06 * size, hy - 0.12 * size, 0.12 * size, 0.24 * size, 4)} fill="none" stroke={SCENE.metalDark} strokeWidth={2.4 * ss} />
    </g>
  );
}

/** Inngangen bak på telleren (der kabelen fra GM-røret går inn). */
export const tellerInngang = (x: number, y: number, w: number) => ({ x: x - w / 2, y: y - 0.25 * w });

/** Teller for GM-røret: boks med display som viser antall tellinger. (x, y) er midt under. */
export function Teller({ x, y, w, visning }: { x: number; y: number; w: number; visning: string }) {
  const ss = useStrokeScale();
  const id = useSvgId('em-teller');
  const h = 0.56 * w;
  return (
    <g>
      <LinearGradient id={id} stops={materialStops(SCENE.plastic)} />
      <ContactShadow cx={x} cy={y} rx={0.55 * w} />
      <path d={rr(x - w / 2, y - h, w, h, 0.05 * w)} fill={`url(#${id})`} stroke={SCENE.outline} strokeWidth={1.1 * ss} />
      <rect x={x - 0.4 * w} y={y - h + 0.1 * w} width={0.8 * w} height={0.24 * w} rx={3} fill={SCENE.display} stroke={SCENE.outline} strokeWidth={0.8 * ss} />
      <Txt x={x} y={y - h + 0.28 * w} px={0.17 * w} color={SCENE.displayText} halo={false} weight={600}>
        {visning}
      </Txt>
      <circle cx={x - 0.25 * w} cy={y - 0.11 * w} r={0.06 * w} fill={SCENE.metalDark} />
      <circle cx={x + 0.05 * w} cy={y - 0.11 * w} r={0.035 * w} fill={PAINTS.rod} />
      <rect x={x + 0.18 * w} y={y - 0.15 * w} width={0.2 * w} height={0.07 * w} rx={2} fill={shade(SCENE.plastic, 0.25)} />
    </g>
  );
}
