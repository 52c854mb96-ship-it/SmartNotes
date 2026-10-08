/**
 * Scenene fra hverdagen i «Det elektromagnetiske spekteret» (k6-em-spekteret): ett bilde per eksempel, valgt etter
 * hvor markøren står i spekteret. Radio, mobil og mikrobølgeovn tegnes med bølgefronter i samme målestokk som
 * gjenstandene (bølgelengden er like lang som den ser ut). Fra infrarødt og oppover er bølgelengden for liten til å
 * tegnes i målestokk, og strålingen vises som fotoner (bølgepakker), med verdien på et skilt.
 */
import { Figure, Txt, VIZ, fmt } from '../../kit';
import {
  BIL_MAAL,
  Bil,
  Callout,
  Dimension,
  Foton,
  Himmel,
  Landskap,
  Lysstraale,
  PAINTS,
  Person,
  Rom,
  SCENE,
  Underlag,
  ValueTag,
  Vei,
  alpha,
  bolgelengdeFarge,
  mix,
  shade,
  useStrokeScale,
  useSvgId,
} from '../../kit/scene';
import {
  Fjernkontroll,
  GmRor,
  Kildeholder,
  Kjokkenbenk,
  Mikrobolgeovn,
  Mobilmast,
  Mobiltelefon,
  RontgenHand,
  Rontgenror,
  Sendermast,
  Skjerm,
  Solkrem,
  Stativ,
  Teller,
  Tv,
  Underarm,
  Varmebilde,
  Varmekamera,
  Wifiruter,
  fjernkontrollLed,
  gmVindu,
  kildeTopp,
  mobilmastAntenne,
  ovnVindu,
  rontgenBrudd,
  ruterAntenne,
  sendermastTopp,
  skjermFlate,
  tellerInngang,
  tvSensor,
  varmekameraLinse,
} from './em-spekteret-deler';
import { waveColor } from './em-spekteret-farger';
import { P_OVN, P_RUTER, VISIBLE_MAX, VISIBLE_MIN, example, fmtFreq, fmtLambda, frequency, hotSpotSpacing, rainbowT, wavelength, type ExampleId } from './model-em-spekteret';

export function sceneHeight(f: number) {
  return Math.round(330 + 130 * (f - 1));
}

interface SceneProps {
  lambda: number;
  f: number;
  s: number;
}

export function HverdagScene({ id, lambda, f, s }: SceneProps & { id: ExampleId }) {
  switch (id) {
    case 'radio':
      return <RadioScene lambda={lambda} f={f} s={s} />;
    case 'mobil':
      return <MobilScene lambda={lambda} f={f} s={s} />;
    case 'mikro':
      return <OvnScene lambda={lambda} f={f} s={s} />;
    case 'varme':
      return <VarmeScene lambda={lambda} f={f} s={s} />;
    case 'fjern':
      return <FjernScene lambda={lambda} f={f} s={s} />;
    case 'synlig':
      return <RegnbueScene lambda={lambda} f={f} s={s} />;
    case 'uv':
      return <UvScene lambda={lambda} f={f} s={s} />;
    case 'rontgen':
      return <RontgenScene lambda={lambda} f={f} s={s} />;
    case 'gamma':
      return <GammaScene lambda={lambda} f={f} s={s} />;
  }
}

/* ---------------------------------------------------------------- Felles */

/** Bølgefronter (buer) rundt en sender med avstanden `spacing` mellom dem, i vinkelen a0–a1 (grader, 0 = mot høyre, positiv nedover). */
function Bolgefronter({ cx, cy, spacing, rMin, rMax, a0, a1, color, phase = 0.3, maxY }: { cx: number; cy: number; spacing: number; rMin: number; rMax: number; a0: number; a1: number; color: string; phase?: number; maxY?: number }) {
  const ss = useStrokeScale();
  const id = useSvgId('em-fronter');
  const arcs: { r: number; op: number }[] = [];
  for (let r = rMin + phase * spacing; r <= rMax; r += spacing) arcs.push({ r, op: 0.95 - 0.4 * ((r - rMin) / Math.max(1, rMax - rMin)) });
  const p = (r: number, a: number) => `${Math.round((cx + r * Math.cos((a * Math.PI) / 180)) * 10) / 10},${Math.round((cy + r * Math.sin((a * Math.PI) / 180)) * 10) / 10}`;
  return (
    <g fill="none" strokeLinecap="round" clipPath={maxY !== undefined ? `url(#${id})` : undefined}>
      {maxY !== undefined && (
        <clipPath id={id}>
          <rect x={-10} y={-10} width={820} height={maxY + 10} />
        </clipPath>
      )}
      {arcs.map(({ r, op }) => (
        <g key={r} opacity={op}>
          <path d={`M${p(r, a0)}A${r},${r} 0 0 1 ${p(r, a1)}`} stroke={VIZ.surface} strokeWidth={4.6 * ss} opacity={0.55} />
          <path d={`M${p(r, a0)}A${r},${r} 0 0 1 ${p(r, a1)}`} stroke={color} strokeWidth={2.3 * ss} />
        </g>
      ))}
    </g>
  );
}

/** Radien til den n-te bølgefronten (samme regel som i Bolgefronter). */
const frontR = (rMin: number, spacing: number, n: number, phase = 0.3) => rMin + phase * spacing + n * spacing;

/** Mållinje for λ mellom to bølgefronter langs retningen fra senderen (ux, uy). */
function LambdaMaal({ cx, cy, ux, uy, r1, r2, label, color, offset }: { cx: number; cy: number; ux: number; uy: number; r1: number; r2: number; label: string; color: string; offset: number }) {
  return <Dimension x1={cx + ux * r1} y1={cy + uy * r1} x2={cx + ux * r2} y2={cy + uy * r2} label={label} offset={offset} color={color} />;
}

/* ---------------------------------------------------------------- Radio */

function RadioScene({ f, s }: SceneProps) {
  const H = sceneHeight(f);
  const hz = Math.round(H * 0.6);
  const roadY = H - 30 * s;
  const ex = example('radio');
  const size = 210 * s;
  const pxPerM = size / BIL_MAAL.lengde;
  const carX = 800 - 0.62 * size;
  const ant = { x: carX - 0.55 * pxPerM, y: roadY - 1.62 * pxPerM };
  const mastH = hz - 48 - 10 * (f - 1);
  const mx = 120;
  const top = sendermastTopp(mx, hz + 4, mastH / 1.1);
  const spacing = ex.lambda * pxPerM;
  const dx = ant.x - top.x;
  const dy = ant.y - top.y;
  const dist = Math.hypot(dx, dy);
  const ux = dx / dist;
  const uy = dy / dist;
  const ang = (Math.atan2(dy, dx) * 180) / Math.PI;
  const n = Math.floor((dist - 0.3 * spacing - 30) / spacing) - 1;
  const color = waveColor('radio', 0);
  return (
    <Figure viewBox={`0 0 800 ${H}`} label="En sendermast for DAB-radio sender radiobølger mot en bil. Bølgefrontene ligger 1,5 m fra hverandre, i samme målestokk som bilen.">
      <Himmel w={800} h={hz + 4} skyer={2} seed={4} />
      <Landskap x={0} y={hz} w={800} h={100} type="aaser" seed={3} />
      <Sendermast x={mx} y={hz + 4} h={mastH / 1.1} />
      <Vei x1={0} x2={800} y={roadY} horisont={hz} bredde={30 * s} />
      <Bolgefronter cx={top.x} cy={top.y} spacing={spacing} rMin={26} rMax={dist + 2.2 * spacing} a0={ang - 17} a1={ang + 15} color={color} maxY={roadY + 6} />
      <Bil x={carX} y={roadY} size={size} lakk="blaa" />
      <line x1={ant.x} y1={ant.y} x2={ant.x - 0.12 * pxPerM} y2={ant.y - 0.45 * pxPerM} stroke={PAINTS.svart} strokeWidth={2.2 * s} strokeLinecap="round" />
      <LambdaMaal cx={top.x} cy={top.y} ux={ux} uy={uy} r1={frontR(26, spacing, n)} r2={frontR(26, spacing, n + 1)} label={`λ = ${fmtLambda(ex.lambda)}`} color={VIZ.ink} offset={26 * s} />
      <Callout x={top.x + 4} y={top.y + 10} lx={top.x + 34 * s} ly={top.y + 12 + 22 * f} anchor="start">
        DAB-sender, {fmtFreq(frequency(ex.lambda))}
      </Callout>
    </Figure>
  );
}

/* ---------------------------------------------------------------- Mobil og wifi */

function MobilScene({ f, s }: SceneProps) {
  const H = sceneHeight(f);
  const hz = Math.round(H * 0.62);
  const gy = H - 26 * s;
  const ex = example('mobil');
  const size = 150 * s;
  const pxPerM = size / 1.75;
  const px = 800 - 90 * s;
  const mastH = gy - 30 - 40 - 10 * (f - 1);
  const mx = 120;
  const ant = mobilmastAntenne(mx, gy - 10, mastH);
  const phone = { x: px - 0.3 * size, y: gy - 0.66 * size };
  const spacing = ex.lambda * pxPerM;
  const dx = phone.x - ant.x;
  const dy = phone.y - ant.y;
  const dist = Math.hypot(dx, dy);
  const ang = (Math.atan2(dy, dx) * 180) / Math.PI;
  const n = Math.floor((dist - 0.3 * spacing - 20) / spacing) - 2;
  const color = waveColor('mikro', 0);
  return (
    <Figure viewBox={`0 0 800 ${H}`} label="En mobilmast sender mikrobølger på 800 MHz mot en person med mobil. Bølgefrontene ligger 37,5 cm fra hverandre, i samme målestokk som personen.">
      <Himmel w={800} h={hz + 4} skyer={1} seed={7} />
      <Landskap x={0} y={hz} w={800} h={130} type="by" seed={2} />
      <Underlag x1={0} x2={800} y={gy} depth={26 * s} type="betong" horisont={hz} />
      <Mobilmast x={mx} y={gy - 10} h={mastH} />
      <Bolgefronter cx={ant.x} cy={ant.y} spacing={spacing} rMin={18} rMax={dist + 1.2 * spacing} a0={ang - 24} a1={ang + 22} color={color} maxY={gy + 4} />
      <Person x={px} y={gy} size={size} flip jakke="gronn" har="brun" frisyre="hestehale" fest={{ hoyreHand: { x: phone.x + 0.02 * size, y: phone.y + 0.03 * size }, venstreHand: { x: phone.x + 0.03 * size, y: phone.y + 0.05 * size } }} />
      <Mobiltelefon x={phone.x} y={phone.y} size={0.1 * size} rotate={-18} />
      <LambdaMaal cx={ant.x} cy={ant.y} ux={dx / dist} uy={dy / dist} r1={frontR(18, spacing, n)} r2={frontR(18, spacing, n + 1)} label={`λ = ${fmtLambda(ex.lambda)}`} color={VIZ.ink} offset={24 * s} />
      <Callout x={ant.x + 10} y={ant.y - 20} lx={ant.x + 40 * s} ly={ant.y - 34 - 6 * f} anchor="start">
        Mobilmast, 800 MHz
      </Callout>
    </Figure>
  );
}

/* ---------------------------------------------------------------- Mikrobølgeovn */

function OvnScene({ f, s }: SceneProps) {
  const H = sceneHeight(f);
  const ss = useStrokeScale();
  const benkY = Math.round(H * 0.76);
  const ex = example('mikro');
  const w = Math.min(450, (benkY - 52 - 26 * (f - 1)) / 0.58);
  const ox = 30 + w / 2;
  const v = ovnVindu(ox, benkY, w);
  const top = benkY - 0.58 * w;
  const pxPerM = w / 0.5; // ovnen er 50 cm bred
  const lam = ex.lambda * pxPerM;
  const d = hotSpotSpacing(ex.lambda) * pxPerM;
  // Den stående bølgen: knutepunkter fast, bukene (varmest) midt mellom
  const x0 = v.x + 0.18 * lam; // et knutepunkt
  const cy = v.y + v.h * 0.36;
  const A = v.h * 0.2;
  let env = '';
  for (let x = v.x; x <= v.x + v.w + 0.5; x += 2) env += `${env ? 'L' : 'M'}${x.toFixed(1)},${(cy - A * Math.abs(Math.sin((2 * Math.PI * (x - x0)) / lam))).toFixed(1)}`;
  let env2 = '';
  for (let x = v.x + v.w; x >= v.x - 0.5; x -= 2) env2 += `L${x.toFixed(1)},${(cy + A * Math.abs(Math.sin((2 * Math.PI * (x - x0)) / lam))).toFixed(1)}`;
  const spots: number[] = [];
  for (let x = x0 + lam / 4; x < v.x + v.w; x += d) if (x > v.x + 8) spots.push(x);
  const nodes: number[] = [];
  for (let x = x0; x < v.x + v.w; x += d) if (x >= v.x) nodes.push(x);
  const plateY = v.y + v.h * 0.86;
  const choc = { x: v.x + 0.08 * v.w, w: 0.84 * v.w, y: plateY - 6 * s, h: 7 * s };
  const color = waveColor('mikro', 0);
  const rw = 90 * s;
  const rx = 800 - 30 - rw / 2 - 10 * (s - 1);
  const ant = ruterAntenne(rx, benkY, rw);
  const lamWifi = wavelength(2.4e9) * pxPerM;
  const brown = mix(SCENE.woodDark, PAINTS.svart, 0.35);
  return (
    <Figure viewBox={`0 0 800 ${H}`} label="Mikrobølgeovn med en stående bølge inne i ovnsrommet. Sjokoladen smelter der bølgen svinger mest, 6,1 cm fra hverandre. En wifi-ruter på benken bruker nesten samme frekvens.">
      <Rom x={0} y={0} w={800} h={H} gulvY={H - 6} gulv="fliser" vindu vinduX={ox + w / 2 + (800 - ox - w / 2) * 0.42} />
      {/* Fliser over benken */}
      <rect x={0} y={benkY - 96 * s} width={800} height={96 * s} fill={alpha(PAINTS.hvit, 0.35)} />
      <path
        d={`${Array.from({ length: 4 }, (_, i) => `M0,${(benkY - 96 * s + i * 24 * s).toFixed(1)}H800`).join('')}${Array.from({ length: 34 }, (_, i) => `M${i * 24 * s},${(benkY - 96 * s).toFixed(1)}V${benkY}`).join('')}`}
        stroke={alpha(SCENE.outline, 0.18)}
        strokeWidth={1 * ss}
      />
      <Kjokkenbenk x1={0} x2={800} y={benkY} depth={H - benkY} />
      <Mikrobolgeovn x={ox} y={benkY} w={w}>
        <path d={`${env}${env2}Z`} fill={alpha(color, 0.3)} stroke={VIZ.surface} strokeWidth={3.6 * ss} strokeLinejoin="round" opacity={0.5} />
        <path d={`${env}${env2}Z`} fill="none" stroke={color} strokeWidth={2.2 * ss} strokeLinejoin="round" />
        {nodes.map((x) => (
          <circle key={x} cx={x} cy={cy} r={2.4 * ss} fill={color} />
        ))}
        <rect x={choc.x} y={choc.y} width={choc.w} height={choc.h} rx={2} fill={brown} stroke={SCENE.outline} strokeWidth={0.8 * ss} />
        {spots.map((x) => (
          <g key={x}>
            <ellipse cx={x} cy={choc.y + choc.h / 2} rx={0.16 * d} ry={choc.h * 0.7} fill={mix(brown, SCENE.hot, 0.35)} />
            <ellipse cx={x} cy={choc.y + choc.h / 2} rx={0.16 * d} ry={choc.h * 1.6} fill={alpha(SCENE.hot, 0.25)} />
          </g>
        ))}
      </Mikrobolgeovn>
      {spots.length >= 2 && (
        <Dimension x1={spots[0]!} y1={choc.y - 7 * s} x2={spots[1]!} y2={choc.y - 7 * s} label={`λ/2 = ${fmtLambda(hotSpotSpacing(ex.lambda), 2)}`} labelSize={0.78} />
      )}
      {nodes.length >= 3 && <Dimension x1={nodes[0]!} y1={v.y} x2={nodes[2]!} y2={v.y} offset={v.y - top + 14 * s} label={`λ = ${fmtLambda(ex.lambda)}`} />}
      <ValueTag x={ox + 0.3 * w} y={top - 18 - 8 * (f - 1)} text={`2,45 GHz, ${P_OVN} W`} />
      <Bolgefronter cx={ant.x} cy={ant.y} spacing={lamWifi} rMin={10} rMax={1.5 * lamWifi} a0={-155} a1={-25} color={color} phase={0.15} />
      <Wifiruter x={rx} y={benkY} size={rw} />
      <Callout x={rx} y={benkY - 0.2 * rw} lx={790} ly={benkY + 30 + 20 * f} anchor="end">
        Wifi: 2,4 GHz, {fmt(P_RUTER, 1)} W
      </Callout>
    </Figure>
  );
}

/* ---------------------------------------------------------------- Varmekamera */

function VarmeScene({ f, s }: SceneProps) {
  const H = sceneHeight(f);
  const ss = useStrokeScale();
  const gy = H - 22 * s;
  const size = 165 * (1 + 0.5 * (s - 1)); // litt mindre personer på mobil, så skjermbildet får plass over
  const ax = 150 + 20 * (s - 1);
  const bx = 800 - 70 * s;
  const camSize = 0.27 * size;
  const cam = { x: bx - 0.25 * size, y: gy - 0.68 * size };
  const lens = varmekameraLinse(cam.x, cam.y, camSize);
  const color = waveColor('ir', 0);
  const sources = [
    { x: ax + 0.1 * size, y: gy - 0.9 * size },
    { x: ax + 0.11 * size, y: gy - 0.68 * size },
    { x: ax + 0.1 * size, y: gy - 0.5 * size },
  ];
  const insetY = 12 + 4 * (f - 1);
  const ih = Math.min(128 * s, sources[0]!.y - 26 - insetY);
  const inset = { w: 1.42 * ih, h: ih };
  const insetX = Math.max(ax + 0.2 * size, Math.min(800 - inset.w - 14, cam.x - inset.w - 20 * s));
  return (
    <Figure viewBox={`0 0 800 ${H}`} label="Et varmekamera ser den infrarøde strålingen fra en person. Skjermbildet viser ansiktet og hendene lysest, fordi de er varmest.">
      <Rom x={0} y={0} w={800} h={H} gulvY={gy - 40 * s} gulv="tre" />
      <Person x={ax} y={gy} size={size} jakke="rod" har="svart" />
      <Person x={bx} y={gy} size={size} flip jakke="blaa" har="blond" fest={{ hoyreHand: cam, venstreHand: { x: cam.x - 0.05 * size, y: cam.y - 0.07 * size } }} />
      <Varmekamera x={cam.x} y={cam.y} size={camSize} />
      {sources.map((p, i) => (
        <Foton key={i} x1={p.x + 6} y1={p.y} x2={lens.x - 6} y2={lens.y + (i - 1) * 3} bolgelengde={9350} farge={color} svingninger={4} amplitude={6 * s} />
      ))}
      <path d={`M${cam.x + 0.2 * camSize},${cam.y - 0.62 * camSize}L${insetX + inset.w},${insetY + inset.h}`} stroke={VIZ.muted} strokeWidth={1.2 * ss} strokeDasharray={`${4 * ss} ${3 * ss}`} />
      <Varmebilde x={insetX} y={insetY} w={inset.w} h={inset.h} />
      <ValueTag x={(ax + lens.x) / 2} y={gy - 0.32 * size} text={`IR, λ ≈ ${fmtLambda(example('varme').lambda, 2)}`} color={color} />
    </Figure>
  );
}

/* ---------------------------------------------------------------- Fjernkontroll */

function FjernScene({ f, s }: SceneProps) {
  const H = sceneHeight(f);
  const gy = H - 22 * s;
  const size = 165 * s;
  const px = 170 + 20 * (s - 1);
  const tw = 175 * s;
  const tx = 800 - 30 - tw * 0.6;
  const hand = { x: px + 0.42 * size, y: gy - 0.68 * size };
  const len = 30 * s;
  const rot = -6;
  const led = fjernkontrollLed(hand.x + 0.1 * len, hand.y, len, rot);
  const sensor = tvSensor(tx, gy, tw);
  const color = waveColor('ir', 0);
  return (
    <Figure viewBox={`0 0 800 ${H}`} label="En person peker med fjernkontrollen mot TV-en. Lysdioden sender infrarødt lys på 940 nm til mottakeren nederst på TV-en.">
      <Rom x={0} y={0} w={800} h={H} gulvY={gy - 40 * s} gulv="tre" vindu vinduX={(px + tx) / 2 + 20} />
      <Tv x={tx} y={gy} w={tw} />
      <Person x={px} y={gy} size={size} jakke="oransje" har="brun" fest={{ hoyreHand: hand }} />
      <Fjernkontroll x={hand.x + 0.1 * len} y={hand.y} len={len} rotate={rot} />
      <path d={`M${led.x},${led.y}L${sensor.x - 4},${sensor.y - 24 * s}L${sensor.x - 4},${sensor.y + 16 * s}Z`} fill={alpha(color, 0.1)} />
      <Foton x1={led.x + 6} y1={led.y} x2={sensor.x - 5} y2={sensor.y} bolgelengde={940} farge={color} svingninger={7} amplitude={6 * s} />
      <ValueTag x={led.x + 0.38 * (sensor.x - led.x)} y={led.y + 44 * s} text={`IR, λ = ${fmtLambda(example('fjern').lambda)}`} color={color} />
      <Callout x={sensor.x} y={sensor.y} lx={sensor.x - 6} ly={gy - 0.2 * size} anchor="end">
        Mottaker
      </Callout>
    </Figure>
  );
}

/* ---------------------------------------------------------------- Synlig lys */

function RegnbueScene({ lambda, f, s }: SceneProps) {
  const H = sceneHeight(f);
  const ss = useStrokeScale();
  const id = useSvgId('em-regnbue');
  const hz = Math.round(H * 0.66);
  const gy = H - 24 * s;
  const nm = Math.min(VISIBLE_MAX, Math.max(VISIBLE_MIN, lambda)) * 1e9;
  const size = 150 * s;
  const px = 150;
  const eye = { x: px + 0.07 * size, y: gy - 0.93 * size };
  const sun = { x: 40, y: 46 + 10 * (f - 1) };
  const c = { x: 560, y: hz + 70 };
  const rOut = Math.min(300, hz + 40);
  const rIn = rOut * 0.88;
  const rOf = (n: number) => rIn + (rOut - rIn) * rainbowT(n);
  const bands = Array.from({ length: 31 }, (_, i) => 400 + i * 10);
  const arc = (r: number) => `M${c.x - r},${c.y}A${r},${r} 0 0 1 ${c.x + r},${c.y}`;
  const rSel = rOf(nm);
  const dropAng = (-150 * Math.PI) / 180;
  const drop = { x: c.x + rSel * Math.cos(dropAng), y: c.y + rSel * Math.sin(dropAng) };
  const col = bolgelengdeFarge(nm, false);
  return (
    <Figure viewBox={`0 0 800 ${H}`} label="Regnbue etter en regnbyge med sola i ryggen. Fargen i regnbuen som markøren står på, er fremhevet, og lyset fra den går til øyet.">
      <clipPath id={id}>
        <rect x={0} y={0} width={800} height={hz + 2} />
      </clipPath>
      <Himmel w={800} h={hz + 4} sol={{ x: sun.x, y: sun.y, r: 26 }} skyer={0} />
      {[0, 1, 2, 3, 4].map((i) => (
        <ellipse key={i} cx={470 + i * 80} cy={30 + (i % 2) * 14} rx={92} ry={42} fill={mix(SCENE.cloud, SCENE.cloudShade, 0.7 + 0.12 * (i % 2))} />
      ))}
      <Landskap x={0} y={hz} w={800} h={110} type="fjell" seed={5} />
      {/* Regnbygen og regnbuen ligger foran fjellene */}
      <g clipPath={`url(#${id})`}>
        <rect x={430} y={40} width={370} height={hz - 40} fill={alpha(SCENE.cloudShade, 0.22)} />
        {Array.from({ length: 34 }, (_, i) => {
          const x = 440 + i * 11;
          return <line key={i} x1={x} y1={60 + (i % 3) * 8} x2={x - 18} y2={hz} stroke={alpha(SCENE.cloudShade, 0.4)} strokeWidth={1 * ss} />;
        })}
        {bands.map((n) => (
          <path key={n} d={arc(rOf(n))} fill="none" stroke={bolgelengdeFarge(n)} strokeWidth={(rOut - rIn) / 30 + 1.2} opacity={0.6} />
        ))}
        <path d={arc(rSel)} fill="none" stroke={VIZ.surface} strokeWidth={7 * ss} opacity={0.8} />
        <path d={arc(rSel)} fill="none" stroke={col} strokeWidth={4 * ss} />
      </g>
      <Underlag x1={0} x2={800} y={gy} depth={24 * s} type="gress" horisont={hz} />
      <Lysstraale x1={sun.x + 20} y1={sun.y + 10} x2={drop.x - 4} y2={drop.y - 2} hvit bredde={2.4} />
      <Person x={px} y={gy} size={size} jakke="gul" har="rod" />
      <Foton x1={drop.x - 4} y1={drop.y + 4} x2={eye.x + 8} y2={eye.y} bolgelengde={nm} farge={col} amplitude={6 * s} />
      <circle cx={drop.x} cy={drop.y} r={5 * s} fill={alpha(SCENE.glass, 0.7)} stroke={SCENE.glassEdge} strokeWidth={1.2 * ss} />
      <Callout x={drop.x + 2} y={drop.y - 4} lx={drop.x + 26 * s} ly={drop.y - 36 - 8 * f} anchor="start">
        Regndråpe
      </Callout>
      <ValueTag x={(drop.x + eye.x) / 2 + 30} y={(drop.y + eye.y) / 2 + 34 * s} text={`${fmt(nm, 0)} nm`} color={col} />
    </Figure>
  );
}

/* ---------------------------------------------------------------- UV og solkrem */

/** Stråle som en tynn strek, med et foton (bølgepakke) på den siste delen. */
function Straale({ x1, y1, x2, y2, color, nm, s, packet = 0.38, n = 9, label }: { x1: number; y1: number; x2: number; y2: number; color: string; nm: number; s: number; packet?: number; n?: number; label?: string }) {
  const ss = useStrokeScale();
  const xm = x2 - (x2 - x1) * packet;
  const ym = y2 - (y2 - y1) * packet;
  return (
    <g>
      <line x1={x1} y1={y1} x2={xm} y2={ym} stroke={VIZ.surface} strokeWidth={4 * ss} opacity={0.6} strokeLinecap="round" />
      <line x1={x1} y1={y1} x2={xm} y2={ym} stroke={color} strokeWidth={1.8 * ss} strokeDasharray={`${6 * ss} ${4 * ss}`} strokeLinecap="round" />
      <Foton x1={xm} y1={ym} x2={x2} y2={y2} bolgelengde={nm} farge={color} amplitude={5.5 * s} svingninger={n} label={label} />
    </g>
  );
}

function UvScene({ f, s }: SceneProps) {
  const H = sceneHeight(f);
  const hz = Math.round(H * 0.56);
  const gy = H - 24 * s;
  const size = 160 * s;
  const px = 800 - 120 * s;
  const sun = { x: 110, y: 64 + 10 * (f - 1) };
  const face = { x: px - 0.09 * size, y: gy - 0.92 * size };
  const color = waveColor('uv', 300);
  const snowP = { x: px - 250 * s, y: gy - 8 };
  return (
    <Figure viewBox={`0 0 800 ${H}`} label="Påskefjellet: UV-stråling fra sola treffer ansiktet direkte og etter refleksjon i snøen. En solkremtube står i snøen.">
      <Himmel w={800} h={hz + 4} sol={{ x: sun.x, y: sun.y, r: 32 }} skyer={1} seed={9} />
      <Landskap x={0} y={hz} w={800} h={120} type="fjell" seed={2} />
      <Underlag x1={0} x2={800} y={gy} depth={24 * s} type="sno" horisont={hz} />
      <Solkrem x={px + 0.3 * size} y={gy + 2} size={56 * s} />
      <Person x={px} y={gy} size={size} flip jakke="rod" lue="blaa" har="brun" />
      <Straale x1={sun.x + 36} y1={sun.y + 14} x2={face.x - 8} y2={face.y} color={color} nm={300} s={s} packet={0.3} n={10} label="UV" />
      <Straale x1={sun.x + 24} y1={sun.y + 34} x2={snowP.x} y2={snowP.y} color={color} nm={300} s={s} packet={0.45} n={10} />
      <Foton x1={snowP.x + 6} y1={snowP.y - 6} x2={face.x - 8} y2={face.y + 20 * s} bolgelengde={300} farge={color} amplitude={5 * s} svingninger={10} />
      <ValueTag x={snowP.x - 40 * s} y={hz - 26 * s} text={`UV-B, λ = ${fmtLambda(example('uv').lambda)}`} color={color} />
      <Callout x={snowP.x} y={snowP.y} lx={snowP.x + 30 * s} ly={gy + 15 * s} anchor="start">
        Snøen reflekterer UV
      </Callout>
    </Figure>
  );
}

/* ---------------------------------------------------------------- Røntgen */

function RontgenScene({ f, s }: SceneProps) {
  const H = sceneHeight(f);
  const ss = useStrokeScale();
  const gy = H - 10;
  const tableY = Math.round(H * 0.72);
  const plate = { x1: 40, x2: 410 + 40 * (s - 1), y: tableY - 8 };
  const len = 340 + 70 * (s - 1);
  const elbow = { x: 0, y: plate.y };
  const wrist = elbow.x + 0.6 * len;
  const tube = { x: wrist + 0.08 * len, y: Math.round(H * 0.32) };
  const tw = 120 * s;
  const color = waveColor('rontgen', 0);
  const sw = Math.min(330, 240 * s);
  const sh = Math.min(tableY + 30 - 30, 0.8 * sw);
  const sxm = 800 - 20 - sw / 2;
  const fl = skjermFlate(sxm, tableY + 30, sw, sh);
  const hand = { cx: fl.x + fl.w * 0.5, cy: fl.y + fl.h * 0.64, size: fl.h * 0.6 };
  const br = rontgenBrudd(hand.cx, hand.cy, hand.size);
  const fs = 17 * f * 0.85;
  return (
    <Figure viewBox={`0 0 800 ${H}`} label="Røntgen av håndleddet på legevakta: røntgenrøret sender stråling gjennom hånda ned på en detektorplate, og skjermen viser knoklene med et brudd.">
      <Rom x={0} y={0} w={800} h={H} gulvY={gy - 30} gulv="fliser" />
      {/* Bordet med detektorplata */}
      <rect x={plate.x1 - 50} y={tableY} width={plate.x2 - plate.x1 + 80} height={14} rx={3} fill={SCENE.metalLight} stroke={SCENE.outline} strokeWidth={1 * ss} />
      <rect x={plate.x2 - 10} y={tableY + 14} width={14} height={gy - tableY - 14} fill={SCENE.metal} stroke={SCENE.outline} strokeWidth={0.8 * ss} />
      <rect x={plate.x1 + 60} y={plate.y} width={plate.x2 - plate.x1 - 70} height={8} rx={2} fill={shade(SCENE.metal, 0.45)} stroke={SCENE.outline} strokeWidth={0.8 * ss} />
      <path d={`M${tube.x - 26 * s},${tube.y}L${tube.x - 100 * s},${plate.y}H${tube.x + 100 * s}L${tube.x + 26 * s},${tube.y}Z`} fill={alpha(color, 0.1)} />
      <Underarm x={elbow.x} y={plate.y} len={len} jakke={PAINTS.gronn} />
      <Rontgenror x={tube.x} y={tube.y} w={tw} top={0} />
      {[-0.65, 0, 0.7].map((t, i) => {
        const x2 = tube.x + t * 78 * s;
        const stop = i === 1 ? plate.y - 0.075 * len : plate.y + 2;
        return <Foton key={t} x1={tube.x + t * 18 * s} y1={tube.y + 6} x2={x2} y2={stop} bolgelengde={0.05} farge={color} svingninger={11} amplitude={5 * s} />;
      })}
      <rect x={sxm - 0.28 * sw} y={tableY + 30} width={0.56 * sw} height={gy - tableY - 30} fill={mix(PAINTS.hvit, SCENE.metal, 0.3)} stroke={SCENE.outline} strokeWidth={0.9 * ss} />
      <Skjerm x={sxm} y={tableY + 30} w={sw} h={sh}>
        <RontgenHand cx={hand.cx} cy={hand.cy} size={hand.size} />
        <line x1={br.x + 0.04 * hand.size} y1={br.y} x2={fl.x + fl.w - 6 - 3.2 * fs} y2={br.y} stroke={SCENE.star} strokeWidth={1.2 * ss} />
        <Txt x={fl.x + fl.w - 8} y={br.y + 0.35 * fs} anchor="end" px={fs} color={SCENE.star} halo={false} weight={650}>
          Brudd
        </Txt>
      </Skjerm>
      <ValueTag x={20} anchor="start" y={tableY + 36 * s} text={`Røntgen, λ = ${fmtLambda(example('rontgen').lambda)}`} color={color} />
    </Figure>
  );
}

/* ---------------------------------------------------------------- Gamma */

function GammaScene({ f, s }: SceneProps) {
  const H = sceneHeight(f);
  const ss = useStrokeScale();
  const benkY = Math.round(H * 0.62);
  const ks = 120 * s;
  const kx = 40 + ks / 2;
  const src = kildeTopp(kx, benkY, ks);
  const len = 140 * s;
  const tubeY = src.y + 2 * s;
  const tubeX = src.x + 130 * s + len / 2;
  const win = gmVindu(tubeX, tubeY, len);
  const standX = tubeX + 0.15 * len;
  const tw = 165 * s;
  const tx = 800 - 24 - tw / 2;
  const inn = tellerInngang(tx, benkY, tw);
  const color = waveColor('gamma', 0);
  return (
    <Figure viewBox={`0 0 800 ${H}`} label="Fysikklaben: en strålekilde med cesium-137 i en blybeholder sender gammastråling mot et GM-rør som er koblet til en teller.">
      <Rom x={0} y={0} w={800} h={H} gulvY={H - 4} gulv="betong" />
      <Underlag x1={0} x2={800} y={benkY} depth={H - benkY} type="labbenk" />
      <Kildeholder x={kx} y={benkY} size={ks} />
      <Stativ x={standX} y={benkY} hx={tubeX + 0.15 * len} hy={tubeY} size={120 * s} />
      <path
        d={`M${tubeX + len / 2 + 0.08 * len},${tubeY}C${tubeX + len / 2 + 60 * s},${tubeY} ${inn.x - 60 * s},${inn.y + 30 * s} ${inn.x},${inn.y}`}
        fill="none"
        stroke={PAINTS.svart}
        strokeWidth={3 * ss}
        strokeLinecap="round"
      />
      <GmRor x={tubeX} y={tubeY} len={len} />
      <Teller x={tx} y={benkY} w={tw} visning="0347" />
      <Foton x1={src.x + 10} y1={src.y} x2={win.x - 4} y2={win.y} bolgelengde={0.002} farge={color} svingninger={14} amplitude={5 * s} label="γ" />
      <Foton x1={src.x} y1={src.y - 10} x2={src.x + 20 * s} y2={src.y - 125 * s} bolgelengde={0.002} farge={color} svingninger={14} amplitude={5 * s} />
      <Foton x1={src.x - 8} y1={src.y - 8} x2={src.x - 90 * s} y2={src.y - 100 * s} bolgelengde={0.002} farge={color} svingninger={14} amplitude={5 * s} />
      <ValueTag x={tubeX + 30 * s} y={tubeY - 64 * s} text={`662 keV, λ = ${fmtLambda(example('gamma').lambda)}`} color={color} />
      <Callout x={tubeX - 0.25 * len} y={tubeY + 0.1 * len} lx={tubeX - 0.45 * len} ly={benkY - 10 * s} anchor="end">
        GM-rør
      </Callout>
    </Figure>
  );
}
