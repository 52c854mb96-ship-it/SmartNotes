/**
 * Galleri for familien «mekanikk»: kasser, klosser, baller, curlingsteiner, trinser, tau, fjær, strikk, kraftmålere,
 * badevekt, bord, ramper, lodd, målebånd og stoppeklokker i små scener, med kraftpiler oppå.
 *   http://localhost:5173/viz-preview.html?galleri=mekanikk&theme=dark
 */
import { VIZ } from '../../colors';
import { Txt } from '../../txt';
import { LinearGradient, materialStops, useSvgId } from '../core';
import {
  Badevekt,
  Ball,
  Bord,
  Curlingstein,
  Fjaer,
  Kasse,
  Kloss,
  Kraftmaaler,
  Lodd,
  Maalebaand,
  Rampe,
  Snor,
  Stoppeklokke,
  Strikk,
  Tau,
  Trinse,
  rampePunkt,
  type KlossMateriale,
} from '../mekanikk';
import { ForceArrow, ValueTag } from '../overlay';
import { SCENE } from '../palette';
import { GalleryGrid, GalleryItem } from './felles';

/* ---------- Enkle bakgrunner (bare toninger og rektangler) ---------- */

function Ute({ ground, w = 400, h = 240, under = SCENE.grass }: { ground: number; w?: number; h?: number; under?: string }) {
  const sky = useSvgId('g-himmel');
  const g = useSvgId('g-bakke');
  return (
    <>
      <LinearGradient id={sky} stops={[[0, SCENE.skyTop], [1, SCENE.skyBottom]]} />
      <LinearGradient id={g} stops={materialStops(under, 0.5)} />
      <rect x={0} y={0} width={w} height={ground} fill={`url(#${sky})`} />
      <rect x={0} y={ground} width={w} height={h - ground} fill={`url(#${g})`} />
      <line x1={0} y1={ground} x2={w} y2={ground} stroke={SCENE.outline} strokeWidth={0.8} opacity={0.5} />
    </>
  );
}

function Inne({ floor, w = 400, h = 240, ceiling }: { floor: number; w?: number; h?: number; ceiling?: number }) {
  const wall = useSvgId('g-vegg');
  return (
    <>
      <LinearGradient id={wall} stops={[[0, SCENE.wall], [1, SCENE.wallShade]]} />
      <rect x={0} y={0} width={w} height={floor} fill={`url(#${wall})`} />
      <rect x={0} y={floor} width={w} height={h - floor} fill={SCENE.floor} />
      <line x1={0} y1={floor} x2={w} y2={floor} stroke={SCENE.floorDark} strokeWidth={2} />
      {ceiling !== undefined && (
        <>
          <rect x={0} y={0} width={w} height={ceiling} fill={SCENE.concrete} />
          <line x1={0} y1={ceiling} x2={w} y2={ceiling} stroke={SCENE.concreteDark} strokeWidth={1.5} />
        </>
      )}
    </>
  );
}

function Is({ ground, w = 400, h = 240 }: { ground: number; w?: number; h?: number }) {
  const sky = useSvgId('g-hall');
  const ice = useSvgId('g-is');
  return (
    <>
      <LinearGradient id={sky} stops={[[0, SCENE.wallShade], [1, SCENE.wall]]} />
      <LinearGradient id={ice} stops={[[0, SCENE.iceShine], [1, SCENE.ice]]} />
      <rect x={0} y={0} width={w} height={ground} fill={`url(#${sky})`} />
      <rect x={0} y={ground} width={w} height={h - ground} fill={`url(#${ice})`} />
      <line x1={0} y1={ground} x2={w} y2={ground} stroke={SCENE.snowShade} strokeWidth={1} />
    </>
  );
}

/** Punkter langs en sirkelbue (grader med klokka fra positiv x-akse), til tau rundt en trinse. */
function bue(cx: number, cy: number, r: number, fra: number, til: number, n = 10): [number, number][] {
  return Array.from({ length: n + 1 }, (_, i) => {
    const a = ((fra + ((til - fra) * i) / n) * Math.PI) / 180;
    return [cx + Math.cos(a) * r, cy + Math.sin(a) * r];
  });
}

const MATERIALER: KlossMateriale[] = ['tre', 'metall', 'stein', 'gummi', 'is', 'plast'];

export default function Galleri() {
  const rampe = { x: 30, y: 212, lengde: 330, vinkel: 25 };
  const p = rampePunkt(rampe, 165);
  const c = rampePunkt(rampe, 165, 26);
  const th = (25 * Math.PI) / 180;

  const metall = { x: 372, y: 212, vinkel: 16, retning: 'opp-venstre' as const };
  const pb = rampePunkt(metall, 150, 17);
  const steep = { x: 30, y: 212, vinkel: 40 };
  const pk = rampePunkt(steep, 70);
  const metallKloss = rampePunkt({ x: 20, y: 210, vinkel: 32 }, 110);
  const mk = rampePunkt({ x: 20, y: 210, vinkel: 32 }, 110, 14);
  const lavKloss = rampePunkt({ x: 220, y: 210, vinkel: 8 }, 70);
  const lavBall = rampePunkt({ x: 220, y: 210, vinkel: 8 }, 140, 9);
  const rampeBall = { x: lavBall.x, y: lavBall.y };

  return (
    <GalleryGrid>
      <GalleryItem title="Kasser i tre og papp, med G og N">
        <Ute ground={200} />
        <Kasse x={120} y={200} w={120} h={86} label="20 kg" labelPlass="oppe-venstre" />
        <Kasse x={285} y={200} w={86} h={60} materiale="papp" />
        <Kasse x={285} y={140} w={46} h={38} flip label="2 kg" />
        <ForceArrow x1={120} y1={157} x2={120} y2={232} color={VIZ.gravity} label="G" origin />
        <ForceArrow x1={120} y1={200} x2={120} y2={125} color={VIZ.normal} label="N" />
      </GalleryItem>

      <GalleryItem title="Rampe i tre med kasse (rampePunkt)">
        <Ute ground={212} />
        <Rampe {...rampe} />
        <Kasse {...p} w={66} h={52} label="m" labelPlass="oppe-venstre" />
        <ForceArrow x1={c.x} y1={c.y} x2={c.x} y2={c.y + 70} color={VIZ.gravity} label="G" origin />
        <ForceArrow x1={c.x} y1={c.y} x2={c.x - Math.sin(th) * 62} y2={c.y - Math.cos(th) * 62} color={VIZ.normal} label="N" />
        <ForceArrow x1={c.x} y1={c.y} x2={c.x + Math.cos(th) * 30} y2={c.y - Math.sin(th) * 30} color={VIZ.friction} label="R" />
      </GalleryItem>

      <GalleryItem title="Metallrampe mot venstre med stålkule, iskloss på bratt rampe">
        <Ute ground={212} under={SCENE.concrete} />
        <Rampe {...steep} lengde={150} />
        <Kloss {...pk} w={46} h={32} materiale="is" />
        <Rampe {...metall} lengde={250} materiale="metall" />
        <Ball x={pb.x} y={pb.y} r={17} type="staal" />
        <ForceArrow x1={pb.x} y1={pb.y} x2={pb.x} y2={pb.y + 55} color={VIZ.gravity} label="G" origin />
        <ForceArrow x1={pb.x} y1={pb.y} x2={pb.x - 70} y2={pb.y + 20} color={VIZ.velocity} label="v" width={5} />
      </GalleryItem>

      <GalleryItem title="Metallrampe opp mot høyre (32°) og lav trerampe (8°)">
        <Inne floor={210} />
        <Rampe x={20} y={210} lengde={190} vinkel={32} materiale="metall" />
        <Kloss {...metallKloss} w={44} h={28} materiale="metall" label="m" labelPlass="oppe-venstre" />
        <ForceArrow x1={mk.x} y1={mk.y} x2={mk.x} y2={mk.y + 60} color={VIZ.gravity} label="G" origin />
        <Rampe x={220} y={210} lengde={170} vinkel={8} />
        <Kloss {...lavKloss} w={50} h={30} materiale="gummi" />
        <Ball {...rampeBall} r={9} type="golf" />
      </GalleryItem>

      <GalleryItem title="Klosser i seks materialer">
        <Inne floor={150} />
        {MATERIALER.map((m, i) => (
          <g key={m}>
            <Kloss x={40 + i * 64} y={150} w={52} h={38} materiale={m} label={String.fromCharCode(65 + i)} />
            <Txt x={40 + i * 64} y={180} size={0.72} muted>
              {m}
            </Txt>
          </g>
        ))}
        <Kloss x={110} y={232} w={90} h={30} materiale="metall" label="2,0 kg" krok="begge" />
        <Kloss x={240} y={232} w={70} h={44} materiale="plast" farge="rod" label="m" />
        <Kloss x={345} y={232} w={60} h={40} materiale="tre" rotate={-12} />
      </GalleryItem>

      <GalleryItem title="Koblet system: lab-bord, snor, bordtrinse og lodd" viewBox="0 0 400 260">
        <Inne floor={245} h={260} />
        <Bord x={170} y={120} w={300} h={125} type="lab" />
        {/* Kroken på klossen: h = 45 gir rr = 4,5, så snora ender i 150 + 30 + 2,9 · 4,5 og går 22,5 over bordet */}
        <Trinse x={320 + 1.5 * 13} y={120 - 22.5 + 13} r={13} feste="bordkant" snorHoyde={22.5} hjulvinkel={35} bordtykkelse={5} />
        <Snor points={[[193, 97.5], [339.5, 97.5], ...bue(339.5, 110.5, 13, -90, 0, 6), [352.5, 170]]} />
        <Kloss x={150} y={120} w={60} h={45} materiale="tre" krok="hoyre" label="A" />
        <Lodd x={352.5} y={170} size={20} label="200 g" />
        <ForceArrow x1={193} y1={97.5} x2={253} y2={97.5} color={VIZ.tension} label="S" />
        <ForceArrow x1={352.5} y1={197} x2={352.5} y2={247} color={VIZ.gravity} label="G" origin />
      </GalleryItem>

      <GalleryItem title="Baller i ekte størrelsesforhold">
        <Ute ground={200} under={SCENE.grassDark} />
        <Ball x={52} y={164} r={36} type="basket" bakke={200} spinn={15} />
        <Ball x={140} y={167} r={33} type="fotball" bakke={200} />
        <Ball x={212} y={188} r={12} type="gummi" bakke={200} farge="blaa" />
        <Ball x={256} y={190} r={10} type="tennis" bakke={200} spinn={-20} />
        <Ball x={300} y={193.7} r={6.3} type="golf" bakke={200} />
        <Ball x={346} y={192} r={8} type="staal" bakke={200} />
        <Ball x={380} y={192} r={8} type="gummi" bakke={200} />
      </GalleryItem>

      <GalleryItem title="Fotball i lufta: skyggen og spinnet">
        <Ute ground={210} />
        {[
          { x: 60, y: 180, s: 0 },
          { x: 150, y: 90, s: 70 },
          { x: 250, y: 70, s: 140 },
          { x: 345, y: 130, s: 210 },
        ].map((b, i) => (
          <Ball key={i} x={b.x} y={b.y} r={20} type="fotball" spinn={b.s} bakke={210} dim={i < 3} />
        ))}
        <ForceArrow x1={345} y1={130} x2={380} y2={175} color={VIZ.velocity} label="v" width={5} />
        <ForceArrow x1={345} y1={130} x2={345} y2={192} color={VIZ.gravity} label="G" origin />
      </GalleryItem>

      <GalleryItem title="Curlingsteiner på is">
        <Is ground={170} />
        <Curlingstein x={110} y={170} size={92} />
        <Curlingstein x={290} y={170} size={92} lakk="gul" flip />
        <ForceArrow x1={150} y1={150} x2={230} y2={150} color={VIZ.velocity} label="v" width={5} />
        <ForceArrow x1={110} y1={168} x2={60} y2={168} color={VIZ.friction} label="R" />
        <Curlingstein x={200} y={225} size={40} lakk="blaa" />
      </GalleryItem>

      <GalleryItem title="Trinser: fast i taket (metall), løs trinse i plast med krok" viewBox="0 0 400 260">
        <Inne floor={250} h={260} ceiling={12} />
        <Trinse x={100} y={70} r={22} feste="tak" festeLengde={58} hjulvinkel={20} />
        <Tau points={[[78, 196], [78, 70], ...bue(100, 70, 22, 180, 360, 10), [122, 70], [122, 150]]} tykkelse={5} />
        <Kasse x={78} y={240} w={50} h={44} skygge={false} />
        <ForceArrow x1={122} y1={150} x2={122} y2={205} color={VIZ.applied} label="F" />
        <Trinse x={280} y={150} r={18} feste="krok" festeLengde={44} hjulvinkel={-40} materiale="plast" />
        <Tau points={[[262, 12], [262, 150], ...bue(280, 150, 18, 180, 0, 10), [298, 150], [298, 40]]} tykkelse={4} type="nylon" />
        <Lodd x={280} y={194} size={22} label="1 kg" />
        <ForceArrow x1={298} y1={60} x2={298} y2={20} color={VIZ.tension} label="S" />
        <Trinse x={365} y={60} r={14} feste="ingen" materiale="plast" farge="rod" hjulvinkel={60} />
        <Trinse x={365} y={110} r={14} feste="ingen" />
      </GalleryItem>

      <GalleryItem title="Tau i hamp, nylon og stål, og snor">
        <Ute ground={225} />
        <Tau points={[[20, 40], [380, 40]]} tykkelse={9} />
        <Tau points={[[20, 80], [200, 100], [380, 80]]} tykkelse={7} type="nylon" />
        <Tau points={[[20, 130], [380, 130]]} tykkelse={5} type="staal" />
        <Snor points={[[20, 165], [380, 165]]} />
        <Snor points={[[20, 195], [140, 210], [260, 180], [380, 200]]} type="hamp" />
        <ForceArrow x1={380} y1={40} x2={350} y2={40} color={VIZ.tension} label="S" labelY={30} />
      </GalleryItem>

      <GalleryItem title="Fjær: hvilelengde, strukket, presset og helt sammenpresset" viewBox="0 0 400 300">
        <Inne floor={300} h={300} />
        {[
          { y: 60, l: 150 },
          { y: 135, l: 230 },
          { y: 210, l: 95 },
          { y: 285, l: 18 },
        ].map((r) => (
          <g key={r.y}>
            <rect x={0} y={r.y} width={400} height={8} fill={SCENE.bench} />
            <line x1={0} y1={r.y} x2={400} y2={r.y} stroke={SCENE.benchEdge} strokeWidth={1.5} />
            <Fjaer x1={22} y1={r.y - 15} x2={22 + r.l} y2={r.y - 15} vindinger={10} radius={10} />
            <Kloss x={22 + r.l + 26} y={r.y} w={52} h={30} materiale="metall" />
          </g>
        ))}
        <rect x={0} y={0} width={22} height={300} fill={SCENE.concrete} stroke={SCENE.concreteDark} strokeWidth={1} />
        <ForceArrow x1={252} y1={120} x2={200} y2={120} color={VIZ.tension} label="F" labelY={100} />
        <ForceArrow x1={117} y1={195} x2={172} y2={195} color={VIZ.tension} label="F" />
      </GalleryItem>

      <GalleryItem title="Strikk: slakk, stram og strukket" viewBox="0 0 400 260">
        <Ute ground={250} h={260} />
        <rect x={0} y={0} width={400} height={22} fill={SCENE.concrete} />
        <line x1={0} y1={22} x2={400} y2={22} stroke={SCENE.concreteDark} strokeWidth={2} />
        <Strikk x1={70} y1={22} x2={70} y2={110} slakk={0.7} />
        <Strikk x1={130} y1={22} x2={175} y2={95} slakk={0.5} farge="oransje" />
        <Strikk x1={230} y1={22} x2={230} y2={150} hvilelengde={128} />
        <Strikk x1={320} y1={22} x2={320} y2={235} hvilelengde={128} />
        <Txt x={70} y={180} size={0.72} muted>
          slakk
        </Txt>
        <Txt x={230} y={170} size={0.72} muted>
          hvilelengde
        </Txt>
        <Txt x={330} y={130} size={0.72} muted anchor="start">
          strukket
        </Txt>
        <ForceArrow x1={320} y1={235} x2={320} y2={175} color={VIZ.tension} label="S" />
        <Strikk x1={20} y1={215} x2={200} y2={215} slakk={0.25} farge="rod" tykkelse={4} />
      </GalleryItem>

      <GalleryItem title="Kraftmålere: lodd i ro og trekk i en kloss" viewBox="0 0 400 280">
        <Inne floor={250} h={280} ceiling={12} />
        <Kraftmaaler x={80} y={12} lengde={172} kraft={4.9} maks={10} />
        <Lodd x={80} y={184} size={26} label="500 g" />
        <ForceArrow x1={80} y1={218} x2={80} y2={270} color={VIZ.gravity} label="G" origin />
        <Kloss x={170} y={250} w={70} h={40} materiale="tre" krok="hoyre" />
        <Kraftmaaler x={345} y={230} lengde={137.6} kraft={3.2} maks={5} rotate={90} farge="blaa" />
        <ForceArrow x1={345} y1={230} x2={392} y2={230} color={VIZ.applied} label="F" labelY={218} />
        <Kraftmaaler x={200} y={20} lengde={110} kraft={0.35} maks={1} farge="gronn" />
      </GalleryItem>

      <GalleryItem title="Badevekter med N fra vekta" viewBox="0 0 400 200">
        <Inne floor={170} h={200} />
        <Badevekt x={140} y={170} w={170} visning="58,9 kg" />
        <ForceArrow x1={140} y1={143} x2={140} y2={70} color={VIZ.normal} label="N" />
        <ValueTag x={140} y={40} text="577 N" color={VIZ.normal} />
        <Badevekt x={320} y={170} w={110} visning="0,0 kg" />
      </GalleryItem>

      <GalleryItem title="Bord: lab-benk og trebord" viewBox="0 0 400 240">
        <Inne floor={225} />
        <Bord x={120} y={120} w={210} h={105} type="lab" />
        <Kloss x={80} y={120} w={50} h={30} materiale="metall" />
        <Stoppeklokke x={160} y={100} r={20} t={4.27} />
        <Bord x={315} y={150} w={140} h={75} type="tre" />
        <Kasse x={300} y={150} w={60} h={46} materiale="papp" />
        <Ball x={352} y={141} r={9} type="tennis" />
      </GalleryItem>

      <GalleryItem title="Målebånd langs bakken (det nederste går helt ut til kanten)" viewBox="0 0 400 260">
        <Ute ground={80} h={260} under={SCENE.asphalt} />
        <Kasse x={60} y={80} w={50} h={40} />
        <Maalebaand x1={30} x2={350} y={80} til={40} />
        <Maalebaand x1={30} x2={330} y={150} til={1.2} merker={6} />
        <Maalebaand x1={30} x2={396} y={210} fra={10} til={15} enhet="cm" />
      </GalleryItem>

      <GalleryItem title="Stoppeklokker">
        <Inne floor={200} />
        <Stoppeklokke x={70} y={110} r={48} t={0} />
        <Stoppeklokke x={195} y={110} r={48} t={32.15} />
        <Stoppeklokke x={315} y={115} r={40} t={119.996} />
        <Stoppeklokke x={372} y={200} r={16} t={47.5} digital={false} />
      </GalleryItem>

      <GalleryItem title="Lodd fra 50 g til 1 kg (messing og stål)">
        <Inne floor={235} />
        <rect x={10} y={20} width={380} height={7} rx={2} fill={SCENE.metal} stroke={SCENE.outline} strokeWidth={0.8} />
        {[
          { x: 40, s: 13, l: '50 g' },
          { x: 95, s: 17, l: '100 g' },
          { x: 155, s: 22, l: '200 g' },
          { x: 225, s: 30, l: '500 g' },
          { x: 305, s: 38, l: '1 kg' },
        ].map((l) => (
          <g key={l.x}>
            <Snor points={[[l.x, 27], [l.x, 60]]} />
            <Lodd x={l.x} y={60} size={l.s} label={l.l} />
          </g>
        ))}
        <Lodd x={368} y={120} size={24} label="200 g" materiale="staal" rotate={-8} />
        <ForceArrow x1={305} y1={136} x2={305} y2={200} color={VIZ.gravity} label="G" origin />
      </GalleryItem>

      <GalleryItem title="Små størrelser (sjekk på mobil)">
        <Ute ground={190} />
        <Kasse x={30} y={190} w={30} h={24} label="5 kg" />
        <Kloss x={75} y={190} w={26} h={16} materiale="tre" />
        <Ball x={110} y={182} r={8} type="fotball" bakke={190} />
        <Curlingstein x={145} y={190} size={30} />
        <Badevekt x={190} y={190} w={50} visning="72 kg" />
        <Trinse x={240} y={60} r={10} feste="tak" festeLengde={60} />
        <Kraftmaaler x={290} y={20} lengde={90} kraft={2} maks={5} />
        <Lodd x={290} y={110} size={14} />
        <Stoppeklokke x={350} y={60} r={18} t={21.6} />
        <Fjaer x1={230} y1={160} x2={330} y2={160} vindinger={8} radius={6} />
        <Maalebaand x1={20} x2={345} y={190} til={10} />
      </GalleryItem>
      <FullBredde />
    </GalleryGrid>
  );
}

/** Kasse dratt opp en rampe med kraftmåler, i en figur som er 800 bred som i kapitlene (mobilskaleringen blir ekte). */
function FullBredde() {
  const rampe = { x: 80, y: 300, lengde: 520, vinkel: 22 };
  const a = (22 * Math.PI) / 180;
  const ux = Math.cos(a);
  const uy = -Math.sin(a);
  const p = rampePunkt(rampe, 200);
  const c = rampePunkt(rampe, 200, 30);
  const side = rampePunkt(rampe, 240, 30);
  const len = 150;
  return (
    <GalleryItem title="Full bredde (800): kasse dratt opp en rampe" viewBox="0 0 800 380">
      <Ute ground={300} w={800} h={380} />
      <Rampe {...rampe} />
      <Kasse {...p} w={80} h={60} label="12 kg" labelPlass="oppe-venstre" />
      <Kraftmaaler x={side.x + ux * len} y={side.y + uy * len} lengde={len} kraft={62} maks={100} rotate={68} />
      <Maalebaand x1={80} x2={562} y={300} til={4.8} />
      <ForceArrow x1={c.x} y1={c.y} x2={c.x} y2={c.y + 118} color={VIZ.gravity} label="G" origin />
      <ForceArrow x1={c.x} y1={c.y} x2={c.x - Math.sin(a) * 109} y2={c.y - Math.cos(a) * 109} color={VIZ.normal} label="N" />
      <ForceArrow x1={side.x + ux * len} y1={side.y + uy * len} x2={side.x + ux * (len + 70)} y2={side.y + uy * (len + 70)} color={VIZ.applied} label="F" />
      <Stoppeklokke x={720} y={80} r={46} t={3.6} />
      <Ball x={700} y={276} r={24} type="fotball" bakke={300} spinn={30} />
    </GalleryItem>
  );
}
