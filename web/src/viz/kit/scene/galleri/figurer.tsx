/**
 * Galleri for familien «figurer»: personer i alle positurer, farger og størrelser, og fallskjermen fra pakket til
 * åpen. Bakgrunnene er enkle toninger her (familiene lages samtidig), og kraftpilene viser at pilene synes oppå.
 */
import { VIZ } from '../../colors';
import { ContactShadow, LinearGradient, materialStops, shade, useSvgId } from '../core';
import { Fallskjerm, Person, personPunkter, type PersonPose } from '../figurer';
import { ForceArrow, SpeedLines } from '../overlay';
import { PAINTS, SCENE } from '../palette';
import { GalleryGrid, GalleryItem } from './felles';

type Kind = 'gress' | 'sno' | 'gulv' | 'asfalt';

/** Himmel (eller vegg) og bakke for en rute på w × h. */
function Backdrop({ w = 400, h = 240, ground = 200, kind = 'gress' }: { w?: number; h?: number; ground?: number; kind?: Kind }) {
  const sky = useSvgId('g-himmel');
  const g = useSvgId('g-bakke');
  const indoor = kind === 'gulv';
  const fill = kind === 'sno' ? SCENE.snow : kind === 'gulv' ? SCENE.floor : kind === 'asfalt' ? SCENE.asphalt : SCENE.grass;
  return (
    <>
      <LinearGradient id={sky} stops={[[0, indoor ? SCENE.wall : SCENE.skyTop], [1, indoor ? SCENE.wallShade : SCENE.skyBottom]]} />
      <LinearGradient id={g} stops={materialStops(fill, 0.6)} />
      <rect x={0} y={0} width={w} height={ground} fill={`url(#${sky})`} />
      {ground < h && <rect x={0} y={ground} width={w} height={h - ground} fill={`url(#${g})`} />}
      {ground < h && <line x1={0} y1={ground} x2={w} y2={ground} stroke={shade(fill, 0.25)} strokeWidth={1} />}
    </>
  );
}

/** Trekasse med nedre venstre hjørne i (x, y), dreid `rotate` grader om dette hjørnet. */
function Crate({ x, y, w, h, rotate = 0 }: { x: number; y: number; w: number; h: number; rotate?: number }) {
  const id = useSvgId('g-kasse');
  return (
    <g transform={`translate(${x} ${y}) rotate(${rotate})`}>
      <ContactShadow cx={w / 2} cy={0} rx={w * 0.6} />
      <LinearGradient id={id} stops={materialStops(SCENE.wood)} />
      <rect x={0} y={-h} width={w} height={h} rx={2} fill={`url(#${id})`} stroke={SCENE.outline} strokeWidth={1} />
      <rect x={4} y={4 - h} width={w - 8} height={h - 8} rx={1} fill="none" stroke={SCENE.woodDark} strokeWidth={1} opacity={0.6} />
    </g>
  );
}

/** Stol med setet i (x, y); k = size / 100 for personen som sitter på den. */
function Chair({ x, y, k, floor }: { x: number; y: number; k: number; floor: number }) {
  return (
    <g stroke={SCENE.outline} strokeWidth={1}>
      <line x1={x - 10 * k} y1={y} x2={x - 10 * k} y2={floor} strokeWidth={2.6 * k} stroke={SCENE.woodDark} />
      <line x1={x + 9 * k} y1={y} x2={x + 9 * k} y2={floor} strokeWidth={2.6 * k} stroke={SCENE.woodDark} />
      <rect x={x - 13 * k} y={y - 31 * k} width={2.8 * k} height={31 * k} rx={1} fill={SCENE.woodDark} />
      <rect x={x - 13 * k} y={y - 0.5 * k} width={24 * k} height={3.2 * k} rx={1} fill={SCENE.wood} />
    </g>
  );
}

/** Krakk med setet i (x, y) og beina ned til gulvet. */
function Stool({ x, y, floor, w }: { x: number; y: number; floor: number; w: number }) {
  return (
    <g stroke={SCENE.outline} strokeWidth={0.8}>
      <path d={`M${x - w * 0.42},${y + 1} L${x - w * 0.5},${floor} M${x + w * 0.42},${y + 1} L${x + w * 0.5},${floor}`} stroke={SCENE.woodDark} strokeWidth={Math.max(1.6, w * 0.09)} strokeLinecap="round" />
      <rect x={x - w / 2} y={y - 0.5} width={w} height={Math.max(2.4, w * 0.12)} rx={1} fill={SCENE.wood} />
    </g>
  );
}

/** Enkel sykkel som passer standardsykkelen til 'sykle' (setet i x, y; k = size / 100). */
function SimpleBike({ x, y, k, fase }: { x: number; y: number; k: number; fase: number }) {
  const P = (a: number, b: number) => ({ x: x + a * k, y: y + b * k });
  const crank = P(13.4, 38);
  const rear = P(-10.6, 34);
  const front = P(47.4, 34);
  const head = P(37, 6);
  const bar = P(35.3, -2.9);
  const r = 19.4 * k;
  const th = fase * Math.PI * 2;
  const pedal = (a: number) => ({ x: crank.x + Math.cos(a) * 10 * k, y: crank.y + Math.sin(a) * 10 * k });
  const pn = pedal(th);
  const pf = pedal(th + Math.PI);
  return (
    <g fill="none" strokeLinecap="round" strokeLinejoin="round">
      <ContactShadow cx={(rear.x + front.x) / 2} cy={rear.y + r} rx={34 * k} />
      {[rear, front].map((c, i) => (
        <g key={i}>
          <circle cx={c.x} cy={c.y} r={r} stroke={SCENE.rubber} strokeWidth={2.6 * k} />
          <circle cx={c.x} cy={c.y} r={r - 2 * k} stroke={SCENE.metal} strokeWidth={0.6 * k} />
        </g>
      ))}
      <line x1={crank.x} y1={crank.y} x2={pf.x} y2={pf.y} stroke={SCENE.metalDark} strokeWidth={1.6 * k} />
      <path
        d={`M${rear.x},${rear.y}L${crank.x},${crank.y}L${x},${y + 2 * k}M${crank.x},${crank.y}L${head.x},${head.y}L${x + 1 * k},${y + 4 * k}M${rear.x},${rear.y}L${x},${y + 3 * k}M${head.x},${head.y}L${front.x},${front.y}M${head.x},${head.y}L${bar.x},${bar.y}`}
        stroke={SCENE.metalDark}
        strokeWidth={2 * k}
      />
      <rect x={x - 6 * k} y={y - 1 * k} width={12 * k} height={2.4 * k} rx={1 * k} fill={SCENE.rubber} />
      <circle cx={crank.x} cy={crank.y} r={2.6 * k} fill={SCENE.metal} stroke={SCENE.outline} strokeWidth={0.5} />
      <line x1={crank.x} y1={crank.y} x2={pn.x} y2={pn.y} stroke={SCENE.metal} strokeWidth={1.8 * k} />
    </g>
  );
}

const POSES: PersonPose[] = ['staa', 'gaa', 'loepe', 'dra', 'skyve', 'sitte', 'huke', 'armer-opp', 'falle', 'ski', 'sykle', 'kaste'];

export default function Galleri() {
  const runner = personPunkter('loepe', 120, undefined, { x: 300, y: 205 });
  const drag = personPunkter('dra', 120, undefined, { x: 110, y: 205 });
  const push = personPunkter('skyve', 120, undefined, { x: 240, y: 205 });
  const throwP = personPunkter('kaste', 120, undefined, { x: 210, y: 205 });
  const diver = personPunkter('falle', 100, undefined, { x: 120, y: 110, anker: 'tyngdepunkt', rotate: 90 });
  const bungeeLedd = { venstreKne: 8, hoyreKne: 4, venstreHofte: 4, hoyreHofte: -2, venstreAlbue: 14, hoyreAlbue: 8, venstreSkulder: 150, hoyreSkulder: 168 };
  const bungee = personPunkter('falle', 100, bungeeLedd, { x: 300, y: 62, rotate: 180 });
  return (
    <GalleryGrid>
      <GalleryItem title="Stå, gå og løpe (fart v på løperen)">
        <Backdrop />
        <Person x={60} y={205} pose="staa" />
        <Person x={170} y={205} pose="gaa" jakke="gronn" har="blond" frisyre="hestehale" />
        <Person x={300} y={205} pose="loepe" jakke="rod" bukse="svart" hud="mork" har="svart" />
        <SpeedLines x={262} y={140} length={30} />
        <ForceArrow x1={runner.hode.x - 30} y1={runner.hode.y - 26} x2={runner.hode.x + 45} y2={runner.hode.y - 26} color={VIZ.velocity} label="v" />
      </GalleryItem>

      <GalleryItem title="Alle positurer (pose)">
        <Backdrop />
        <rect x={0} y={100} width={400} height={6} fill={SCENE.grass} />
        <Stool x={354} y={100 - 0.23 * 62} floor={100} w={15} />
        <SimpleBike x={288} y={212 - 53.4 * 0.62} k={0.62} fase={0} />
        {POSES.map((p, i) => {
          const px = 24 + (i % 6) * 66;
          const ground = i < 6 ? 100 : 212;
          const py = p === 'sitte' ? ground - 0.23 * 62 : p === 'sykle' ? ground - 53.4 * 0.62 : p === 'falle' ? ground - 26 : ground;
          return <Person key={p} x={px} y={py} size={62} pose={p} />;
        })}
      </GalleryItem>

      <GalleryItem title="Gangsyklus og løpesyklus (fase 0 – 0,875)">
        <Backdrop ground={240} />
        <rect x={0} y={112} width={400} height={6} fill={SCENE.grass} />
        <rect x={0} y={228} width={400} height={12} fill={SCENE.grass} />
        {Array.from({ length: 8 }, (_, i) => (
          <g key={i}>
            <Person x={26 + i * 49} y={112} size={84} pose="gaa" fase={i / 8} jakke="gronn" />
            <Person x={26 + i * 49} y={228} size={84} pose="loepe" fase={i / 8} jakke="rod" />
          </g>
        ))}
      </GalleryItem>

      <GalleryItem title="Dra i tau og skyve kasse (S og F)">
        <Backdrop kind="asfalt" />
        <line x1={drag.venstreHand.x - 26} y1={drag.venstreHand.y + 6} x2={192} y2={drag.hoyreHand.y} stroke={SCENE.wood} strokeWidth={2.4} strokeLinecap="round" />
        <Person x={110} y={205} pose="dra" jakke="rod" />
        <ForceArrow x1={drag.hoyreHand.x + 4} y1={drag.hoyreHand.y - 14} x2={drag.hoyreHand.x + 64} y2={drag.hoyreHand.y - 14} color={VIZ.tension} label="S" />
        <Crate x={push.hoyreHand.x} y={205} w={74} h={205 - push.hoyreHand.y + 22} />
        <Person x={240} y={205} pose="skyve" jakke="gul" />
        <ForceArrow x1={push.hoyreHand.x + 6} y1={push.hoyreHand.y} x2={push.hoyreHand.x + 56} y2={push.hoyreHand.y} color={VIZ.applied} label="F" />
      </GalleryItem>

      <GalleryItem title="Sitte, huke og sitte på kjelke (ledd)">
        <Backdrop kind="gulv" ground={205} />
        <Chair x={95} y={180} k={1.2} floor={205} />
        <Person x={95} y={180} pose="sitte" jakke="lilla" har="rod" frisyre="lang" />
        <Person x={215} y={205} pose="huke" jakke="oransje" hud="middels" />
        <rect x={282} y={196} width={100} height={6} rx={3} fill={SCENE.woodDark} stroke={SCENE.outline} />
        <Person
          x={300}
          y={196}
          size={110}
          pose="sitte"
          ledd={{ rygg: -4 }}
          fest={{ hoyreFot: { x: 372, y: 192 }, venstreFot: { x: 368, y: 192 }, hoyreHand: { x: 352, y: 176 }, venstreHand: { x: 348, y: 176 } }}
          jakke="blaa"
          lue="rod"
        />
        <path d="M352,176 L380,194" stroke={SCENE.wood} strokeWidth={1.6} fill="none" />
      </GalleryItem>

      <GalleryItem title="Armer opp, kaste og ryggsekk">
        <Backdrop />
        <Person x={70} y={205} pose="armer-opp" jakke="gronn" />
        <Person x={210} y={205} pose="kaste" jakke="blaa" har="brun" />
        <circle cx={throwP.hoyreHand.x} cy={throwP.hoyreHand.y - 2} r={4.6} fill={PAINTS.rod} stroke={SCENE.outline} />
        <Person x={330} y={205} pose="gaa" fase={0.1} sekk="oransje" jakke="gronn" hud="mork" har="svart" frisyre="lang" />
      </GalleryItem>

      <GalleryItem title="Ski i utforbakke (G og N)">
        <SkiSlope />
      </GalleryItem>

      <GalleryItem title="Sykle: fase 0 og 0,25">
        <Backdrop kind="asfalt" ground={159} />
        <SimpleBike x={90} y={100} k={1.1} fase={0} />
        <Person x={90} y={100} size={110} pose="sykle" fase={0} hjelm="gul" />
        <SimpleBike x={280} y={100} k={1.1} fase={0.25} />
        <Person x={280} y={100} size={110} pose="sykle" fase={0.25} jakke="rod" hjelm="blaa" har="blond" frisyre="hestehale" />
      </GalleryItem>

      <GalleryItem title="Fritt fall (G og L) og strikkhopp">
        <Backdrop ground={240} />
        <Person x={120} y={110} size={100} pose="falle" anker="tyngdepunkt" rotate={90} jakke="oransje" sekk="svart" />
        <ForceArrow x1={diver.tyngdepunkt.x} y1={diver.tyngdepunkt.y} x2={diver.tyngdepunkt.x} y2={diver.tyngdepunkt.y + 90} color={VIZ.gravity} label="G" origin />
        <ForceArrow x1={diver.tyngdepunkt.x} y1={diver.tyngdepunkt.y - 18} x2={diver.tyngdepunkt.x} y2={diver.tyngdepunkt.y - 80} color={VIZ.friction} label="L" />
        <line x1={300} y1={0} x2={bungee.hoyreAnkel.x} y2={bungee.hoyreAnkel.y} stroke="var(--sc-figurer-line)" strokeWidth={2.5} />
        <Person x={300} y={62} size={100} pose="falle" rotate={180} jakke="gul" ledd={bungeeLedd} />
      </GalleryItem>

      <GalleryItem title="Fallskjerm: aapen 0, 0,15, 0,5 og 1" viewBox="0 0 400 260">
        <Backdrop h={260} ground={260} />
        {[0, 0.15, 0.5, 1].map((a, i) => {
          const px = 50 + i * 100;
          const py = 228;
          const sele = personPunkter('armer-opp', 42, undefined, { x: px, y: py }).skulder;
          return (
            <g key={a}>
              <Fallskjerm x={sele.x} y={sele.y} size={96} aapen={a} lakk={i % 2 ? 'oransje' : 'rod'} />
              <Person x={px} y={py} size={42} pose={a === 0 ? 'falle' : 'armer-opp'} skygge={false} sekk="svart" />
            </g>
          );
        })}
      </GalleryItem>

      <GalleryItem title="Hudtoner, hår, lue og hjelm (flip og dim til høyre)">
        <Backdrop kind="sno" />
        <Person x={40} y={205} pose="staa" hud="lys" har="blond" jakke="rod" />
        <Person x={110} y={205} pose="staa" hud="middels" har="svart" frisyre="lang" jakke="lilla" />
        <Person x={180} y={205} pose="staa" hud="mork" har="svart" jakke="gul" lue="blaa" />
        <Person x={250} y={205} pose="staa" har="rod" frisyre="hestehale" jakke="gronn" hjelm="hvit" />
        <Person x={320} y={205} pose="staa" har="graa" jakke="graa" bukse="svart" lue="rod" />
        <Person x={372} y={205} pose="staa" flip dim jakke="oransje" />
      </GalleryItem>

      <GalleryItem title="Liten og stor (size 40, 80 og 170)">
        <Backdrop />
        <Person x={40} y={205} size={40} pose="gaa" />
        <Person x={110} y={205} size={80} pose="gaa" jakke="rod" />
        <Person x={260} y={205} size={170} pose="gaa" jakke="gronn" />
      </GalleryItem>

      <GalleryItem title="Skråning (skraaning) og hender festet til en stang (fest)">
        <Incline />
      </GalleryItem>

      <GalleryItem title="Gå opp og løpe ned en bakke (skraaning og fase)">
        <Hill />
      </GalleryItem>

      <GalleryItem title="Som i et kapittel: tautrekking (viewBox 800 × 360)" viewBox="0 0 800 360">
        <TugOfWar />
      </GalleryItem>
    </GalleryGrid>
  );
}

function SkiSlope() {
  const angle = 20;
  const rad = (angle * Math.PI) / 180;
  const x0 = 60;
  const y0 = 90;
  const along = 150;
  const px = x0 + along * Math.cos(rad);
  const py = y0 + along * Math.sin(rad);
  const p = personPunkter('ski', 110, undefined, { x: px, y: py, rotate: angle });
  const g = p.tyngdepunkt;
  return (
    <>
      <Backdrop ground={240} />
      <polygon points={`0,${y0 - x0 * Math.tan(rad)} 400,${y0 + (400 - x0) * Math.tan(rad)} 400,240 0,240`} fill={SCENE.snow} stroke={SCENE.snowShade} />
      <Person x={px} y={py} size={110} pose="ski" rotate={angle} lue="rod" jakke="blaa" />
      <ForceArrow x1={g.x} y1={g.y} x2={g.x} y2={g.y + 80} color={VIZ.gravity} label="G" origin />
      <ForceArrow x1={g.x} y1={g.y} x2={g.x - 75 * Math.sin(rad)} y2={g.y - 75 * Math.cos(rad)} color={VIZ.normal} label="N" />
    </>
  );
}

function Incline() {
  const angle = 15;
  const rad = (angle * Math.PI) / 180;
  const base = 225;
  const yAt = (x: number) => base - x * Math.tan(rad);
  const px = 95;
  const p = personPunkter('skyve', 105, undefined, { x: px, y: yAt(px), skraaning: angle });
  // Kassen står på skråningen med siden mot hendene: hjørnet på bakken der den dreide siden går gjennom hånda.
  const tan = Math.tan(rad);
  const cot = 1 / tan;
  const cx = (base - p.hoyreHand.y + p.hoyreHand.x * cot) / (tan + cot);
  const bar = { x: 335, y: 26 };
  // Personen henger: plasser ankerpunktet så hendene akkurat når stanga med nesten strake armer.
  const hang = { venstreKne: 40, hoyreKne: 62, venstreHofte: 12, hoyreHofte: 24 };
  const hangY = bar.y - personPunkter('armer-opp', 74, hang).hoyreHand.y - 2;
  return (
    <>
      <Backdrop ground={240} />
      <polygon points={`0,${base} 400,${yAt(400)} 400,240 0,240`} fill={SCENE.grass} stroke={SCENE.grassDark} />
      <Person x={px} y={yAt(px)} size={105} pose="skyve" skraaning={angle} jakke="rod" />
      <Crate x={cx} y={yAt(cx)} w={62} h={72} rotate={-angle} />
      <line x1={bar.x - 40} y1={bar.y} x2={bar.x + 40} y2={bar.y} stroke={SCENE.metalDark} strokeWidth={3} strokeLinecap="round" />
      <Person
        x={bar.x}
        y={hangY}
        size={74}
        pose="armer-opp"
        skygge={false}
        fest={{ hoyreHand: { x: bar.x + 2, y: bar.y }, venstreHand: { x: bar.x - 2, y: bar.y } }}
        ledd={hang}
        jakke="gul"
      />
      <ForceArrow x1={bar.x + 34} y1={bar.y + 30} x2={bar.x + 34} y2={bar.y - 22} color={VIZ.tension} label="S" />
    </>
  );
}

function TugOfWar() {
  const ground = 300;
  const left = personPunkter('dra', 150, undefined, { x: 230, y: ground });
  const right = personPunkter('dra', 150, undefined, { x: 570, y: ground, flip: true });
  const ropeY = (left.hoyreHand.y + right.hoyreHand.y) / 2;
  return (
    <>
      <Backdrop w={800} h={360} ground={ground} />
      <line x1={left.venstreHand.x - 40} y1={ropeY} x2={right.venstreHand.x + 40} y2={ropeY} stroke={SCENE.wood} strokeWidth={4} strokeLinecap="round" />
      <rect x={396} y={ropeY - 11} width={8} height={22} rx={2} fill={PAINTS.rod} stroke={SCENE.outline} />
      <Person x={230} y={ground} size={150} pose="dra" jakke="blaa" />
      <Person x={570} y={ground} size={150} pose="dra" flip jakke="rod" har="blond" frisyre="hestehale" />
      <ForceArrow x1={left.hoyreHand.x + 6} y1={ropeY - 30} x2={left.hoyreHand.x + 96} y2={ropeY - 30} color={VIZ.tension} label="S" />
      <ForceArrow x1={right.hoyreHand.x - 6} y1={ropeY - 30} x2={right.hoyreHand.x - 96} y2={ropeY - 30} color={VIZ.tension} label="S" />
      <ForceArrow x1={left.venstreFot.x} y1={ground} x2={left.venstreFot.x - 90} y2={ground} color={VIZ.friction} label="R" />
      <ForceArrow x1={right.venstreFot.x} y1={ground} x2={right.venstreFot.x + 90} y2={ground} color={VIZ.friction} label="R" />
      <ForceArrow x1={left.tyngdepunkt.x} y1={left.tyngdepunkt.y} x2={left.tyngdepunkt.x} y2={left.tyngdepunkt.y + 70} color={VIZ.gravity} label="G" origin />
    </>
  );
}

function Hill() {
  // Bakken stiger 14° fram til toppen i x = 200 og faller like mye etterpå.
  const top = { x: 200, y: 140 };
  const tan = Math.tan((14 * Math.PI) / 180);
  const yAt = (x: number) => top.y + Math.abs(x - top.x) * tan;
  const walkers = [
    { x: 60, pose: 'gaa' as const, fase: 0.02, skraaning: 14, jakke: 'gronn' },
    { x: 140, pose: 'gaa' as const, fase: 0.55, skraaning: 14, jakke: 'blaa' },
    { x: 300, pose: 'loepe' as const, fase: 0.8, skraaning: -14, jakke: 'rod' },
  ];
  const v = personPunkter('loepe', 100, undefined, { x: 300, y: yAt(300), fase: 0.8, skraaning: -14 }).hode;
  return (
    <>
      <Backdrop ground={240} />
      <polygon points={`0,${yAt(0)} ${top.x},${top.y} 400,${yAt(400)} 400,240 0,240`} fill={SCENE.grass} stroke={SCENE.grassDark} />
      {walkers.map((w) => (
        <Person key={w.x} x={w.x} y={yAt(w.x)} size={100} pose={w.pose} fase={w.fase} skraaning={w.skraaning} jakke={w.jakke} />
      ))}
      <ForceArrow x1={v.x - 20} y1={v.y - 22} x2={v.x - 20 + 60 * Math.cos(0.244)} y2={v.y - 22 + 60 * Math.sin(0.244)} color={VIZ.velocity} label="v" />
    </>
  );
}
