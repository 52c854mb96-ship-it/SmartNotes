/**
 * Galleri for familien «kjoretoy»: bil, sykkel, akebrett, kjelke, dynamikkvogn, heis og berg-og-dal-vogn i små
 * scener, med kraftpiler oppå. Bakgrunnene er enkle toninger og rektangler (ikke fra bakgrunn-familien). Person
 * (figurer) og Badevekt (mekanikk) brukes bare for å kontrollere ankerpunktene: rytter på sykkelen, sitte på kjelke
 * og akebrett, og stå på badevekta i heisen.
 *   http://localhost:5173/viz-preview.html?galleri=kjoretoy&theme=dark
 */
import type { ReactNode } from 'react';
import { VIZ } from '../../colors';
import { Txt } from '../../txt';
import { LinearGradient, useSvgId } from '../core';
import { Person, personPunkter } from '../figurer';
import { Akebrett, BIL_MAAL, Bergbanevogn, Bil, Heis, Kjelke, Sykkel, Vogn, hjulvinkelFraStrekning, sykkelPunkter } from '../kjoretoy';
import { Badevekt } from '../mekanikk';
import { Callout, ForceArrow, SpeedLines } from '../overlay';
import { SCENE } from '../palette';
import { GalleryGrid, GalleryItem } from './felles';

const rad = (deg: number) => (deg * Math.PI) / 180;

/** Punktet (lx, ly) i en gjenstand som står i (x, y) dreid `deg` grader, skalert med k og eventuelt speilvendt. */
function at(x: number, y: number, deg: number, k: number, lx: number, ly: number, flip = false) {
  const c = Math.cos(rad(deg));
  const s = Math.sin(rad(deg));
  const fx = flip ? -lx : lx;
  return { x: x + (fx * c - ly * s) * k, y: y + (fx * s + ly * c) * k };
}

/** Sykkel med en rytter på 1,75 m: setet, styret og pedalene fra sykkelPunkter. */
function Rytter({ x, y, size, v, rotate, flip, lakk, jakke }: { x: number; y: number; size: number; v: number; rotate?: number; flip?: boolean; lakk?: string; jakke?: string }) {
  const p = sykkelPunkter(size, { x, y, rotate, flip });
  return (
    <>
      <Sykkel x={x} y={y} size={size} pedalvinkel={v} rotate={rotate} flip={flip} lakk={lakk} />
      <Person
        x={p.sete.x}
        y={p.sete.y}
        size={p.rytterHoyde}
        rotate={rotate}
        flip={flip}
        pose="sykle"
        fase={v / 360}
        jakke={jakke}
        hjelm="hvit"
        fest={{ venstreHand: p.styre, hoyreHand: p.styre, venstreFot: p.venstrePedal(v), hoyreFot: p.hoyrePedal(v) }}
      />
    </>
  );
}

/** Himmel over hele ruta og et underlag fra `ground` og ned. */
function Backdrop({ w = 400, h = 240, ground, floor = SCENE.asphalt, sky = [SCENE.skyTop, SCENE.skyBottom] }: { w?: number; h?: number; ground: number; floor?: string; sky?: [string, string] }) {
  const id = useSvgId('gal-himmel');
  return (
    <>
      <LinearGradient id={id} stops={[[0, sky[0]], [1, sky[1]]]} />
      <rect x={0} y={0} width={w} height={ground} fill={`url(#${id})`} />
      <rect x={0} y={ground} width={w} height={h - ground} fill={floor} />
    </>
  );
}

/** Vei: asfalt med kantlinje og stiplet midtlinje. */
function Road({ w = 400, h = 240, top, line }: { w?: number; h?: number; top: number; line: number }) {
  return (
    <>
      <rect x={0} y={top - 8} width={w} height={8} fill={SCENE.grass} />
      <rect x={0} y={top} width={w} height={h - top} fill={SCENE.asphalt} />
      <line x1={0} y1={top + 3} x2={w} y2={top + 3} stroke={SCENE.roadLine} strokeWidth={2} opacity={0.7} />
      <line x1={0} y1={line} x2={w} y2={line} stroke={SCENE.roadLine} strokeWidth={3} strokeDasharray="26 22" opacity={0.85} />
    </>
  );
}

/** Skråning som en flate: linja går fra (0, y0) til (w, y1), alt under er `fill`. */
function Slope({ y0, y1, fill, w = 400, h = 240, edge }: { y0: number; y1: number; fill: string; w?: number; h?: number; edge?: string }) {
  return (
    <>
      <polygon points={`0,${y0} ${w},${y1} ${w},${h} 0,${h}`} fill={fill} />
      {edge && <line x1={0} y1={y0} x2={w} y2={y1} stroke={edge} strokeWidth={2.5} />}
    </>
  );
}

function Label({ x, y, children }: { x: number; y: number; children: ReactNode }) {
  return (
    <Txt x={x} y={y} size={0.72} muted>
      {children}
    </Txt>
  );
}

export default function Galleri() {
  // Bil i bakken: 15° stigning mot høyre
  const hill = 15;
  const hillY = (x: number) => 228 - Math.tan(rad(hill)) * x;
  const carX = 200;
  const carSize = 220;
  const pxPerM = carSize / BIL_MAAL.lengde;
  const nx = Math.sin(rad(-hill));
  const ny = -Math.cos(rad(-hill));
  const cm = { x: carX + nx * BIL_MAAL.tyngdepunkt * pxPerM, y: hillY(carX) + ny * BIL_MAAL.tyngdepunkt * pxPerM };
  const G = 82;

  // Akebakke: 20° ned mot høyre
  const sled = 20;
  const sledY = (x: number) => 64 + Math.tan(rad(sled)) * x;
  const snx = Math.sin(rad(sled));
  const sny = -Math.cos(rad(sled));
  const tx = Math.cos(rad(sled));
  const ty = Math.sin(rad(sled));
  const kj = { x: 290, y: sledY(290) };
  const kjc = { x: kj.x + snx * 20, y: kj.y + sny * 20 };

  // Sykkel med punkter
  const bike = { x: 200, y: 214, size: 230 };
  const pv = 35;
  const bp = sykkelPunkter(bike.size, bike);

  // Sykkel i motbakke (speilvendt, 10°)
  const climbY = (x: number) => 150 + Math.tan(rad(10)) * x;

  // Sitte på kjelke (flat snø) og akebrett (speilvendt, i en bakke som stiger 20° mot høyre). Samme skala for person og gjenstand.
  const kjelke = { x: 92, y: 204, size: 80 };
  const kjK = kjelke.size / 90;
  const kjM = kjelke.size / 0.9;
  const sitSlope = 20;
  const sitY = (x: number) => (x < 190 ? kjelke.y : kjelke.y - Math.tan(rad(sitSlope)) * (x - 190));
  const brett = { x: 300, y: sitY(300), size: 72 };
  const brK = brett.size / 80;
  const brM = brett.size / 0.8;

  // Heis med badevekt: innvendig høyde 2,2 m
  const lift = { x: 200, y: 232, w: 150, h: 176 };
  const liftM = lift.h / 2.2;
  const scaleW = 0.3 * liftM;
  const scaleTop = lift.y - 0.16 * scaleW;
  const pp = personPunkter('staa', 1.75 * liftM, undefined, { x: lift.x, y: scaleTop });

  // Berg-og-dal-bane: dal med bunn i x = 200
  const dip = 0.0032;
  const track = (x: number) => 206 - dip * (x - 200) ** 2;
  const slopeAt = (x: number) => -2 * dip * (x - 200);
  const rail = 8;
  const trackPath = Array.from({ length: 41 }, (_, i) => {
    const x = i * 10;
    return `${i === 0 ? 'M' : 'L'}${x},${track(x).toFixed(1)}`;
  }).join('');
  const onTrack = (x: number) => {
    const a = Math.atan(slopeAt(x));
    // Krumningen til midtlinja (−y″ / (1 + y′²)^1,5) og til oversiden av skinna, som ligger rail / 2 nærmere sentrum.
    const kc = (2 * dip) / (1 + slopeAt(x) ** 2) ** 1.5;
    return { x: x + Math.sin(a) * (rail / 2), y: track(x) - Math.cos(a) * (rail / 2), rotate: (a * 180) / Math.PI, krumning: kc / (1 - (kc * rail) / 2) };
  };

  return (
    <GalleryGrid>
      <GalleryItem title="Personbil på vei: bremser (bremselys, v og a)">
        <Backdrop ground={176} floor={SCENE.asphalt} />
        <rect x={0} y={150} width={400} height={26} fill={SCENE.hillFar} />
        <Road top={176} line={222} />
        <Bil x={196} y={206} size={260} lakk="rod" bremselys hjulvinkel={20} title="Rød personbil som bremser" />
        <ForceArrow x1={150} y1={48} x2={270} y2={48} color={VIZ.velocity} label="v" width={6} />
        <ForceArrow x1={240} y1={78} x2={170} y2={78} color={VIZ.acceleration} label="a" width={5} />
      </GalleryItem>

      <GalleryItem title="Stasjonsvogn og personbil i flere farger">
        <Backdrop ground={30} floor={SCENE.concrete} />
        <rect x={0} y={118} width={400} height={6} fill={SCENE.concreteDark} />
        <Bil x={96} y={108} size={170} lakk="blaa" type="stasjonsvogn" />
        <Bil x={300} y={108} size={170} lakk="hvit" />
        <Bil x={96} y={222} size={170} lakk="svart" />
        <Bil x={300} y={222} size={170} lakk="gronn" type="stasjonsvogn" hjulvinkel={36} />
      </GalleryItem>

      <GalleryItem title="Om kvelden: frontlys og bremselys">
        <Backdrop ground={160} sky={[SCENE.space, SCENE.spaceGlow]} floor={SCENE.grassDark} />
        {/* Et fjernt kjørefelt bak gresskanten, og veien foran */}
        <rect x={0} y={163} width={400} height={13} fill={SCENE.asphaltDark} />
        <rect x={0} y={176} width={400} height={6} fill={SCENE.grassDark} />
        <rect x={0} y={182} width={400} height={58} fill={SCENE.asphaltDark} />
        <line x1={0} y1={224} x2={400} y2={224} stroke={SCENE.roadLine} strokeWidth={3} strokeDasharray="26 22" opacity={0.6} />
        <Bil x={340} y={172} size={100} lakk="oransje" frontlys flip />
        <Bil x={150} y={212} size={230} lakk="graa" type="stasjonsvogn" frontlys bremselys />
      </GalleryItem>

      <GalleryItem title="Parkert i bakken (15°): G, N og R fra tyngdepunktet">
        <Backdrop ground={240} />
        <Slope y0={hillY(0)} y1={hillY(400)} fill={SCENE.asphalt} edge={SCENE.asphaltDark} />
        <Bil x={carX} y={hillY(carX)} size={carSize} lakk="blaa" rotate={-hill} />
        <ForceArrow x1={cm.x} y1={cm.y} x2={cm.x} y2={cm.y + G} color={VIZ.gravity} label="G" origin />
        <ForceArrow x1={cm.x} y1={cm.y} x2={cm.x + nx * G * Math.cos(rad(hill))} y2={cm.y + ny * G * Math.cos(rad(hill))} color={VIZ.normal} label="N" />
        <ForceArrow
          x1={cm.x}
          y1={cm.y}
          x2={cm.x + Math.cos(rad(hill)) * G * Math.sin(rad(hill)) * 1.8}
          y2={cm.y - Math.sin(rad(hill)) * G * Math.sin(rad(hill)) * 1.8}
          color={VIZ.friction}
          label="R"
        />
      </GalleryItem>

      <GalleryItem title="Hjulvinkel fra strekning (s = 0; 0,25; 0,5 m)">
        <Backdrop ground={150} />
        <Road top={150} line={226} />
        {[0, 0.25, 0.5].map((s, i) => (
          <g key={s}>
            <Bil x={70 + i * 132} y={194} size={120} lakk="gul" hjulvinkel={hjulvinkelFraStrekning(s)} dim={i < 2} />
            <Label x={70 + i * 132} y={128}>
              {`s = ${String(s).replace('.', ',')} m`}
            </Label>
          </g>
        ))}
      </GalleryItem>

      <GalleryItem title="Sykkel med punktene til rytteren (sykkelPunkter)">
        <Backdrop ground={214} floor={SCENE.gravel} />
        <Sykkel x={bike.x} y={bike.y} size={bike.size} pedalvinkel={pv} hjulvinkel={15} lakk="rod" />
        <Callout x={bp.sete.x} y={bp.sete.y} lx={70} ly={50}>
          Sete
        </Callout>
        <Callout x={bp.styre.x} y={bp.styre.y} lx={320} ly={50}>
          Styre
        </Callout>
        <Callout x={bp.hoyrePedal(pv).x} y={bp.hoyrePedal(pv).y} lx={262} ly={232} anchor="start">
          Høyre pedal
        </Callout>
        <Callout x={bp.venstrePedal(pv).x} y={bp.venstrePedal(pv).y} lx={14} ly={232} anchor="start">
          Venstre pedal
        </Callout>
      </GalleryItem>

      <GalleryItem title="Rytter på 1,75 m: pedalvinkel 0°, 90°, 180° og 270°" viewBox="0 0 400 300">
        <Backdrop w={400} h={300} ground={285} floor={SCENE.asphalt} />
        <rect x={0} y={140} width={400} height={9} fill={SCENE.asphalt} />
        <rect x={0} y={149} width={400} height={4} fill={SCENE.grass} />
        {[0, 90, 180, 270].map((v, i) => {
          const x = i % 2 === 0 ? 105 : 300;
          const y = i < 2 ? 140 : 285;
          return (
            <g key={v}>
              <Rytter x={x} y={y} size={112} v={v} lakk={i % 2 ? 'gronn' : 'blaa'} jakke={i < 2 ? 'rod' : 'oransje'} />
              <Label x={x - 66} y={y - 96}>{`${v}°`}</Label>
            </g>
          );
        })}
      </GalleryItem>

      <GalleryItem title="Syklist i motbakke (speilvendt, 10°) og sykkel på flat vei">
        <Backdrop ground={240} />
        <Slope y0={150} y1={climbY(220)} w={220} fill={SCENE.grass} edge={SCENE.grassDark} />
        <polygon points={`220,${climbY(220)} 400,${climbY(220)} 400,240 220,240`} fill={SCENE.asphalt} />
        <Rytter x={120} y={climbY(120)} size={150} v={110} rotate={10} flip lakk="gronn" jakke="gul" />
        <ForceArrow x1={44} y1={climbY(120) - 40} x2={44 - Math.cos(rad(10)) * 40} y2={climbY(120) - 40 - Math.sin(rad(10)) * 40} color={VIZ.velocity} label="v" width={5} />
        <Sykkel x={318} y={climbY(220)} size={150} lakk="gul" pedalvinkel={-60} hjulvinkel={40} />
        <SpeedLines x={234} y={climbY(220) - 40} length={26} spread={24} />
      </GalleryItem>

      <GalleryItem title="Akebrett og kjelke i akebakken (20°)">
        <Backdrop ground={240} />
        <Slope y0={sledY(0)} y1={sledY(400)} fill={SCENE.snow} edge={SCENE.snowShade} />
        <Akebrett x={110} y={sledY(110)} size={90} rotate={sled} />
        <ForceArrow x1={110 + tx * 10} y1={sledY(110) + ty * 10 - 46} x2={110 + tx * 90} y2={sledY(110) + ty * 90 - 46} color={VIZ.velocity} label="v" width={5} />
        <Kjelke x={kj.x} y={kj.y} size={100} rotate={sled} />
        <ForceArrow x1={kjc.x} y1={kjc.y} x2={kjc.x} y2={kjc.y + 70} color={VIZ.gravity} label="G" origin />
        <ForceArrow x1={kjc.x} y1={kjc.y} x2={kjc.x + snx * 66} y2={kjc.y + sny * 66} color={VIZ.normal} label="N" />
        <ForceArrow x1={kjc.x} y1={kjc.y} x2={kjc.x - tx * 46} y2={kjc.y - ty * 46} color={VIZ.friction} label="R" />
      </GalleryItem>

      <GalleryItem title="Sitter på kjelken (flat snø) og akebrettet (speilvendt, 20°), samme skala">
        <Backdrop ground={240} />
        <polygon points={`0,${kjelke.y} 190,${kjelke.y} 400,${sitY(400)} 400,240 0,240`} fill={SCENE.snow} />
        <polyline points={`0,${kjelke.y} 190,${kjelke.y} 400,${sitY(400)}`} fill="none" stroke={SCENE.snowShade} strokeWidth={2.5} />
        <Kjelke x={kjelke.x} y={kjelke.y} size={kjelke.size} />
        <Person
          x={kjelke.x - 16 * kjK}
          y={kjelke.y - 32 * kjK}
          size={1.75 * kjM}
          pose="sitte"
          jakke="gronn"
          lue="rod"
          fest={{ hoyreFot: at(kjelke.x, kjelke.y, 0, kjK, 47, -27), venstreFot: at(kjelke.x, kjelke.y, 0, kjK, 45, -28) }}
        />
        <Akebrett x={brett.x} y={brett.y} size={brett.size} rotate={-sitSlope} flip lakk="blaa" />
        <Person
          {...at(brett.x, brett.y, -sitSlope, brK, -10, -3.5, true)}
          size={1.75 * brM}
          rotate={-sitSlope}
          flip
          pose="sitte"
          jakke="oransje"
          lue="blaa"
          fest={{ hoyreFot: at(brett.x, brett.y, -sitSlope, brK, 38, -16, true), venstreFot: at(brett.x, brett.y, -sitSlope, brK, 36, -17, true) }}
        />
        <ForceArrow
          x1={brett.x - 40}
          y1={brett.y - 74}
          x2={brett.x - 40 - Math.cos(rad(sitSlope)) * 70}
          y2={brett.y - 74 + Math.sin(rad(sitSlope)) * 70}
          color={VIZ.velocity}
          label="v"
          width={5}
        />
      </GalleryItem>

      <GalleryItem title="Akebrett og kjelke store, på flat snø (blått brett nedtonet)">
        <Backdrop ground={96} floor={SCENE.snow} />
        <rect x={0} y={96} width={400} height={4} fill={SCENE.snowShade} />
        <Akebrett x={86} y={140} size={110} lakk="gul" tau={false} />
        <Kjelke x={290} y={140} size={70} flip tau={false} />
        <Akebrett x={84} y={222} size={150} lakk="blaa" dim />
        <Kjelke x={282} y={222} size={170} />
      </GalleryItem>

      <GalleryItem title="Støtforsøk: to vogner med fjær mot hverandre">
        <Backdrop ground={176} floor={SCENE.bench} sky={[SCENE.wall, SCENE.wallShade]} />
        <rect x={0} y={176} width={400} height={6} fill={SCENE.benchEdge} />
        <rect x={10} y={168} width={380} height={8} rx={2} fill={SCENE.metal} stroke={SCENE.outline} strokeWidth={1} />
        <Vogn x={100} y={168} size={140} lakk="rod" stotfanger="fjaer" lodd={1} hjulvinkel={30} />
        <Vogn x={306} y={168} size={140} lakk="blaa" stotfanger="fjaer" side="venstre" />
        <ForceArrow x1={60} y1={78} x2={150} y2={78} color={VIZ.velocity} label="v₁" width={5} />
        <ForceArrow x1={340} y1={100} x2={290} y2={100} color={VIZ.velocity} label="v₂" width={5} />
      </GalleryItem>

      <GalleryItem title="Støtfangere og lodd: ingen, fjær (sammentrykt), borrelås, begge">
        <Backdrop ground={10} floor={SCENE.bench} sky={[SCENE.wall, SCENE.wallShade]} />
        <Vogn x={95} y={100} size={130} stotfanger="ingen" lakk="graa" />
        <Vogn x={290} y={100} size={130} stotfanger="fjaer" sammentrykk={0.8} lodd={1} lakk="gronn" />
        <Vogn x={95} y={214} size={130} stotfanger="borrelaas" lodd={2} lakk="rod" />
        <Vogn x={290} y={214} size={130} stotfanger="fjaer" side="begge" lodd={3} hjulvinkel={50} />
      </GalleryItem>

      <GalleryItem title="Heis: dørene lukket, halvåpne og åpne">
        <rect x={0} y={0} width={400} height={240} fill={SCENE.concrete} />
        <rect x={0} y={0} width={400} height={240} fill={SCENE.concreteDark} opacity={0.35} />
        {[0, 0.5, 1].map((d, i) => (
          <Heis key={d} x={70 + i * 130} y={216} w={98} h={150} dorer={d}>
            <Person x={70 + i * 130} y={216} size={120} jakke={['rod', 'gronn', 'blaa'][i]} />
          </Heis>
        ))}
      </GalleryItem>

      <GalleryItem title="Heis med person på badevekt: S, G, N og a" viewBox="0 0 400 260">
        <rect x={0} y={0} width={400} height={260} fill={SCENE.concrete} />
        <rect x={150} y={0} width={4} height={260} fill={SCENE.metalDark} />
        <rect x={246} y={0} width={4} height={260} fill={SCENE.metalDark} />
        <Heis x={lift.x} y={lift.y} w={lift.w} h={lift.h} title="Heis med en person på badevekt">
          <Badevekt x={lift.x} y={lift.y} w={scaleW} visning="72,4 kg" />
          <Person x={lift.x} y={scaleTop} size={1.75 * liftM} jakke="gronn" />
        </Heis>
        <ForceArrow x1={lift.x} y1={lift.y - lift.h - 0.08 * lift.w} x2={lift.x} y2={4} color={VIZ.tension} label="S" />
        <ForceArrow x1={pp.tyngdepunkt.x - 4} y1={pp.tyngdepunkt.y} x2={pp.tyngdepunkt.x - 4} y2={pp.tyngdepunkt.y + 56} color={VIZ.gravity} label="G" origin labelX={pp.tyngdepunkt.x - 18} labelAnchor="end" />
        <ForceArrow x1={lift.x + 16} y1={scaleTop} x2={lift.x + 16} y2={scaleTop - 62} color={VIZ.normal} label="N" />
        <ForceArrow x1={316} y1={180} x2={316} y2={120} color={VIZ.acceleration} label="a" width={5} />
      </GalleryItem>

      <GalleryItem title="Berg-og-dal-bane: vogner med krumning langs banen, N og G i bunnen">
        <Backdrop ground={240} />
        {[60, 130, 270, 340].map((x) => (
          <rect key={x} x={x - 3} y={track(x)} width={6} height={240 - track(x)} fill={SCENE.metalDark} />
        ))}
        <path d={trackPath} fill="none" stroke={SCENE.outline} strokeWidth={rail + 2} />
        <path d={trackPath} fill="none" stroke={SCENE.metal} strokeWidth={rail} />
        {[84, 200, 316].map((x, i) => {
          const p = onTrack(x);
          return <Bergbanevogn key={x} x={p.x} y={p.y} rotate={p.rotate} krumning={p.krumning} size={88} skinne={rail} lakk={i === 1 ? 'rod' : 'gul'} hjulvinkel={x} />;
        })}
        <ForceArrow x1={200} y1={170} x2={200} y2={86} color={VIZ.normal} label="N" />
        <ForceArrow x1={200} y1={170} x2={200} y2={222} color={VIZ.gravity} label="G" origin />
      </GalleryItem>

      <GalleryItem title="Liten og stor">
        <Backdrop ground={96} floor={SCENE.grass} />
        <Bil x={52} y={92} size={80} lakk="blaa" />
        <Sykkel x={140} y={92} size={60} />
        <Vogn x={202} y={92} size={44} />
        <Kjelke x={252} y={92} size={36} />
        <Akebrett x={296} y={92} size={34} />
        <rect x={318} y={86} width={76} height={4} fill={SCENE.metal} stroke={SCENE.outline} strokeWidth={0.6} />
        <Bergbanevogn x={356} y={86} size={60} skinne={4} />
        <rect x={0} y={170} width={400} height={70} fill={SCENE.asphalt} />
        <Bil x={210} y={226} size={330} lakk="hvit" hjulvinkel={10} />
      </GalleryItem>

      <GalleryItem title="Kapittelfigur 800 bred: bil og sykkel med krefter" viewBox="0 0 800 340">
        <Backdrop w={800} h={340} ground={250} />
        <rect x={0} y={222} width={800} height={28} fill={SCENE.hillNear} />
        <Road w={800} h={340} top={250} line={312} />
        <Bil x={260} y={296} size={300} lakk="rod" hjulvinkel={64} />
        <Rytter x={620} y={296} size={190} v={70} lakk="blaa" jakke="gul" />
        <ForceArrow x1={260} y1={296 - (BIL_MAAL.tyngdepunkt * 300) / BIL_MAAL.lengde} x2={260} y2={336} color={VIZ.gravity} label="G" origin />
        <ForceArrow x1={420} y1={230} x2={520} y2={230} color={VIZ.applied} label="F" />
        <ForceArrow x1={110} y1={230} x2={40} y2={230} color={VIZ.friction} label="L" />
        <ForceArrow x1={560} y1={60} x2={700} y2={60} color={VIZ.velocity} label="v" width={6} />
      </GalleryItem>
    </GalleryGrid>
  );
}
