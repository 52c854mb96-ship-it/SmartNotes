/**
 * Galleri for familien «lab» (varme og elektrisitet): alle gjenstandene i flere varianter, i små scener med
 * enkle bakgrunner og noen kraftpiler oppå.
 *   http://localhost:5173/viz-preview.html?galleri=lab&theme=dark
 */
import { VIZ } from '../../colors';
import { LinearGradient, useSceneScale, useSvgId } from '../core';
import {
  Batteri,
  Bryter,
  Isbit,
  Kasserolle,
  Kokeplate,
  Ledning,
  Lyspaere,
  Motstand,
  Multimeter,
  Panelovn,
  Sikring,
  Sikringsskap,
  Solcellepanel,
  Stikkontakt,
  Termometer,
  Vannkoker,
  batteriPoler,
  bryterPoler,
  lyspaerePoler,
  multimeterPunkter,
} from '../lab';
import { Callout, ForceArrow, ValueTag } from '../overlay';
import { SCENE } from '../palette';
import { GalleryGrid, GalleryItem } from './felles';

/* ---------- Enkle bakgrunner (bare i galleriet) ---------- */

/** Laboratorievegg og benk: benkeplata begynner i `bench`. */
function Lab({ w = 400, h = 240, bench = 200 }: { w?: number; h?: number; bench?: number }) {
  const id = useSvgId('vegg');
  return (
    <>
      <LinearGradient id={id} stops={[[0, SCENE.wall], [1, SCENE.wallShade]]} />
      <rect x={0} y={0} width={w} height={bench} fill={`url(#${id})`} />
      <rect x={0} y={bench} width={w} height={10} fill={SCENE.bench} />
      <rect x={0} y={bench + 10} width={w} height={h - bench - 10} fill={SCENE.benchEdge} />
    </>
  );
}

/** Kjøkkenbenk i tre. */
function Kitchen({ w = 400, h = 240, bench = 200 }: { w?: number; h?: number; bench?: number }) {
  const id = useSvgId('kjokken');
  return (
    <>
      <LinearGradient id={id} stops={[[0, SCENE.wall], [1, SCENE.wallShade]]} />
      <rect x={0} y={0} width={w} height={bench} fill={`url(#${id})`} />
      <rect x={0} y={bench} width={w} height={8} fill={SCENE.woodLight} />
      <rect x={0} y={bench + 8} width={w} height={h - bench - 8} fill={SCENE.wood} />
    </>
  );
}

/** Himmel og gress. */
function Outdoor({ w = 400, h = 240, ground = 200 }: { w?: number; h?: number; ground?: number }) {
  const id = useSvgId('himmel');
  return (
    <>
      <LinearGradient id={id} stops={[[0, SCENE.skyTop], [1, SCENE.skyBottom]]} />
      <rect x={0} y={0} width={w} height={ground} fill={`url(#${id})`} />
      <rect x={0} y={ground} width={w} height={h - ground} fill={SCENE.grass} />
      <rect x={0} y={ground} width={w} height={4} fill={SCENE.grassDark} />
    </>
  );
}

/** Stuevegg og gulv. */
function Room({ w = 400, h = 240, floor = 205 }: { w?: number; h?: number; floor?: number }) {
  const id = useSvgId('stue');
  return (
    <>
      <LinearGradient id={id} stops={[[0, SCENE.wall], [1, SCENE.wallShade]]} />
      <rect x={0} y={0} width={w} height={floor} fill={`url(#${id})`} />
      <rect x={0} y={floor - 7} width={w} height={7} fill={SCENE.plastic} />
      <rect x={0} y={floor} width={w} height={h - floor} fill={SCENE.floor} />
    </>
  );
}

/** Liten prikk som viser hvor en pol eller et festepunkt er (kontroll av hjelpefunksjonene). */
function Pin({ p }: { p: { x: number; y: number } }) {
  return <circle cx={p.x} cy={p.y} r={2.6} fill={VIZ.acceleration} stroke={VIZ.surface} strokeWidth={1} />;
}

/* ---------- Galleriet ---------- */

export default function Galleri() {
  const batt = { x: 70, y: 177, size: 70, type: 'flat' as const };
  const bp = batteriPoler(batt);
  const sw = { x: 200, y: 220, size: 100, lukket: true };
  const sp = bryterPoler(sw);
  const lamp = { x: 322, y: 220, size: 96, fatning: true };
  const lp = lyspaerePoler(lamp);
  const sw2 = { x: 200, y: 220, size: 100, lukket: false };
  const mmA = { x: 300, y: 128, size: 160, visning: '0,52 A', modus: 'A' as const };
  const mmV = { x: 100, y: 128, size: 160, visning: '12,0 V', modus: 'V' as const };
  const pA = multimeterPunkter(mmA);
  const pV = multimeterPunkter(mmV);
  return (
    <GalleryGrid>
      <GalleryItem title="Termometre: kaldt, romtemperatur, kokende og skrått" viewBox="0 0 400 280">
        <Lab h={280} bench={256} />
        <Termometer x={52} y={254} h={200} temp={-8} min={-20} max={40} skala="venstre" />
        <Termometer x={130} y={254} h={200} temp={21.5} min={0} max={50} />
        <Termometer x={235} y={254} h={200} temp={100} min={0} max={110} />
        <Termometer x={340} y={254} h={150} temp={37} min={30} max={42} steg={2} rotate={12} />
        <ValueTag x={235} y={24} text="100 °C" color={VIZ.series[3]} pointer={8} />
      </GalleryItem>

      <GalleryItem title="Vannkoker: av, på og kokende (stål, hvit, speilvendt)" viewBox="0 0 400 240">
        <Kitchen />
        <Vannkoker x={70} y={200} size={110} vann={0.25} />
        <Vannkoker x={195} y={200} size={130} paa vann={0.7} damp={0.5} lakk="hvit" tid={0.6} />
        <Vannkoker x={325} y={200} size={130} paa vann={0.85} damp={1} tid={1.4} flip />
      </GalleryItem>

      <GalleryItem title="Kokeplate og kasserolle: kald, varm, kokende med lokk (G og N oppå)" viewBox="0 0 400 240">
        <Kitchen />
        <Kokeplate x={70} y={210} w={110} effekt={0} />
        <Kokeplate x={200} y={210} w={110} effekt={0.55} />
        <Kokeplate x={330} y={210} w={110} effekt={1} />
        <Kasserolle x={325} y={210 - 0.3 * 110 + 0.08 * 66} w={66} lokk damp={0.9} tid={0.8} />
        <Kasserolle x={195} y={210 - 0.3 * 110 + 0.08 * 66} w={66} vann={0.9} damp={0.3} tid={0.3} />
        <ForceArrow x1={325} y1={150} x2={325} y2={205} color={VIZ.gravity} label="G" origin />
        <ForceArrow x1={325} y1={177} x2={325} y2={124} color={VIZ.normal} label="N" />
      </GalleryItem>

      <GalleryItem title="Kasserolle i snitt: lite vann og koking" viewBox="0 0 400 200">
        <Lab h={200} bench={166} />
        <Kasserolle x={62} y={176} w={80} vann={0.3} snitt />
        <Kasserolle x={250} y={176} w={110} vann={0.75} damp={0.9} snitt tid={0.5} />
      </GalleryItem>

      <GalleryItem title="Kasserolle med lokk: i snitt og hel" viewBox="0 0 400 200">
        <Kitchen h={200} bench={166} />
        <Kasserolle x={130} y={176} w={100} vann={0.6} damp={0.7} lokk snitt flip tid={1.1} />
        <Kasserolle x={290} y={176} w={100} vann={0.6} lokk />
      </GalleryItem>

      <GalleryItem title="Isbit som smelter: 0, 30, 70 og 95 %" viewBox="0 0 400 200">
        <Lab h={200} bench={150} />
        <Isbit x={55} y={168} size={50} />
        <Isbit x={150} y={168} size={50} smeltet={0.3} />
        <Isbit x={250} y={168} size={50} smeltet={0.7} />
        <Isbit x={345} y={168} size={50} smeltet={0.95} />
        <Isbit x={350} y={60} size={18} />
        <Callout x={70} y={135} lx={110} ly={60}>
          Is, 0 °C
        </Callout>
      </GalleryItem>

      <GalleryItem title="Batterier: AA (liggende, loddrett, oppladbar), 9 V, flatbatteri (4,5 V) og bilbatteri" viewBox="0 0 400 230">
        <Lab h={230} bench={196} />
        {(
          [
            { x: 62, y: 184, size: 84 },
            { x: 34, y: 92, size: 84, rotate: -90 },
            { x: 100, y: 58, size: 46, spenning: '1,2 V' },
            { x: 144, y: 160, size: 72, type: '9v' },
            { x: 216, y: 161, size: 64, type: 'flat' },
            { x: 324, y: 150, size: 140, type: 'bil' },
          ] as const
        ).map((b, i) => {
          const p = batteriPoler(b);
          return (
            <g key={i}>
              <Batteri {...b} />
              <Pin p={p.pluss} />
              <Pin p={p.minus} />
            </g>
          );
        })}
      </GalleryItem>

      <GalleryItem title="Strømkrets: flatbatteri (4,5 V), lukket bryter, lab-pære i fatning og strømprikker" viewBox="0 0 400 240">
        <Lab />
        <Ledning points={[[bp.pluss.x, bp.pluss.y], [144, bp.pluss.y], [144, sp.a.y], [sp.a.x, sp.a.y]]} farge="rod" strom={{ fase: 0.3 }} />
        <Ledning points={[[sp.b.x, sp.b.y], [270, sp.b.y], [270, lp.a.y], [lp.a.x, lp.a.y]]} farge="rod" strom={{ fase: 0.3 }} />
        <Ledning points={[[lp.b.x, lp.b.y], [372, lp.b.y], [372, 40], [bp.minus.x, 40], [bp.minus.x, bp.minus.y]]} farge="svart" strom={{ fase: 0.3 }} />
        <Batteri {...batt} />
        <Bryter {...sw} />
        <Lyspaere {...lamp} lysstyrke={0.8} />
        <Callout x={322} y={150} lx={250} ly={96}>
          Glødetråd
        </Callout>
      </GalleryItem>

      <GalleryItem title="Samme krets med åpen bryter: lyspæra er mørk" viewBox="0 0 400 240">
        <Lab />
        <Ledning points={[[bp.pluss.x, bp.pluss.y], [144, bp.pluss.y], [144, sp.a.y], [sp.a.x, sp.a.y]]} farge="rod" />
        <Ledning points={[[sp.b.x, sp.b.y], [270, sp.b.y], [270, lp.a.y], [lp.a.x, lp.a.y]]} farge="rod" />
        <Ledning points={[[lp.b.x, lp.b.y], [372, lp.b.y], [372, 40], [bp.minus.x, 40], [bp.minus.x, bp.minus.y]]} farge="svart" />
        <Batteri {...batt} />
        <Bryter {...sw2} />
        <Lyspaere {...lamp} lysstyrke={0} />
        {[sp, lp, bp].flatMap((p) => Object.values(p)).map((p, i) => (
          <Pin key={i} p={p} />
        ))}
      </GalleryItem>

      <GalleryItem title="Lyspærer: av, svak, middels og full lysstyrke (og skrå)" viewBox="0 0 400 220">
        <Room h={220} floor={196} />
        <Lyspaere x={55} y={190} size={100} />
        <Lyspaere x={150} y={190} size={100} lysstyrke={0.2} />
        <Lyspaere x={245} y={190} size={100} lysstyrke={0.55} />
        <Lyspaere x={340} y={190} size={100} lysstyrke={1} rotate={-14} />
      </GalleryItem>

      <GalleryItem title="Lab-pære (E10) uten og med fatning, svak og full, og E27 i fatning" viewBox="0 0 400 200">
        <Lab h={200} bench={176} />
        <Lyspaere x={48} y={180} size={70} modell="liten" lysstyrke={0.5} />
        <Lyspaere x={130} y={182} size={80} fatning />
        <Lyspaere x={220} y={182} size={80} fatning lysstyrke={0.35} />
        <Lyspaere x={310} y={182} size={80} fatning lysstyrke={1} />
        <Lyspaere x={372} y={182} size={58} fatning modell="e27" lysstyrke={0.6} />
        {[lyspaerePoler({ x: 48, y: 180, size: 70, modell: 'liten' }), lyspaerePoler({ x: 130, y: 182, size: 80, fatning: true })].flatMap((p) => [p.a, p.b]).map((p, i) => (
          <Pin key={i} p={p} />
        ))}
      </GalleryItem>

      <GalleryItem title="Motstander med fargekode: 220 Ω, 4,7 kΩ, 10 Ω og 1 MΩ" viewBox="0 0 400 220">
        <Lab h={220} bench={190} />
        <Motstand x1={30} y1={60} x2={190} y2={60} label="R₁ = 220 Ω" />
        <Motstand x1={220} y1={60} x2={380} y2={60} label="4,7 kΩ" />
        <Motstand x1={60} y1={100} x2={60} y2={200} label="10 Ω" />
        <Motstand x1={150} y1={180} x2={300} y2={110} ohm={1e6} label="1 MΩ" />
        <Motstand x1={372} y1={100} x2={372} y2={190} ohm={330} label="330 Ω" labelSide="below" />
      </GalleryItem>

      <GalleryItem title="Multimeter som voltmeter og amperemeter (ledningene bak og foran)" viewBox="0 0 400 260">
        <Lab h={260} bench={238} />
        <Ledning points={[[pV.inn.x, pV.inn.y], [pV.inn.x, 236], [190, 236], [190, 30]]} farge="rod" />
        <Ledning points={[[pV.com.x, pV.com.y], [pV.com.x, 248], [12, 248], [12, 30]]} farge="svart" />
        <Multimeter {...mmV} />
        <Multimeter {...mmA} />
        <Ledning points={[[pA.inn.x, pA.inn.y], [pA.inn.x, 240], [380, 240], [380, 30]]} farge="rod" />
        <Ledning points={[[pA.com.x, pA.com.y], [pA.com.x, 250], [392, 250], [392, 30]]} farge="svart" />
        <Multimeter x={200} y={190} size={84} visning="220 Ω" modus="Ω" lakk="oransje" />
      </GalleryItem>

      <GalleryItem title="Ledninger: farger, hjørner, prikker, piler og lukket sløyfe" viewBox="0 0 400 230">
        <Lab h={230} bench={210} />
        <Ledning points={[[20, 30], [180, 30], [180, 90]]} farge="rod" strom={{ fase: 0.2 }} />
        <Ledning points={[[20, 60], [150, 60], [150, 110], [60, 110]]} farge="svart" hjornerradius={22} strom={{ fase: 0.2, retning: -1 }} />
        <Ledning points={[[20, 140], [100, 140], [140, 190], [190, 190]]} farge="blaa" strom={{ fase: 0.5, form: 'pil' }} />
        <Ledning points={[[20, 175], [80, 175]]} farge="gul" strom={{ fase: 0 }} />
        <Ledning points={[[230, 40], [380, 40], [380, 190], [230, 190], [230, 40]]} farge="rod" hjornerradius={30} strom={{ fase: 0.6, form: 'pil' }} />
        <Ledning points={[[260, 70], [350, 70], [350, 160], [260, 160], [260, 70]]} farge="gul" bredde={7} strom={{ fase: 0.6 }} />
      </GalleryItem>

      <GalleryItem title="Stikkontakt (med og uten støpsel) og automatsikring (på og gått)" viewBox="0 0 400 230">
        <Room h={230} floor={218} />
        <Stikkontakt x={70} y={70} size={74} />
        <Stikkontakt x={70} y={160} size={64} stopsel />
        <Ledning points={[[70, 208], [70, 214], [150, 214]]} farge="svart" />
        <Sikring x={220} y={110} size={150} merking="16 A" />
        <Sikring x={300} y={110} size={150} gaatt merking="10 A" />
        <Sikring x={365} y={110} size={60} merking="16 A" />
      </GalleryItem>

      <GalleryItem title="Sikringsskap med seks kurser, én har gått" viewBox="0 0 400 240">
        <Room h={240} floor={232} />
        <Sikringsskap
          x={200}
          y={118}
          w={360}
          h={200}
          kurser={[
            { navn: 'Kjøkken', merking: '16 A' },
            { navn: 'Stue', merking: '16 A' },
            { navn: 'Bad', merking: '16 A', gaatt: true },
            { navn: 'Soverom', merking: '10 A' },
            { navn: 'Vaskerom', merking: '16 A' },
            { navn: 'Lys', merking: '10 A' },
          ]}
        />
      </GalleryItem>

      <GalleryItem title="Sikringsskap med tolv kurser (to rader, lange navn på to linjer) og et lite skap (langt navn forkortet)" viewBox="0 0 400 260">
        <Room h={260} floor={252} />
        <Sikringsskap
          x={140}
          y={128}
          w={260}
          h={230}
          kurser={['Kjøkken', 'Stue', 'Bad', 'Soverom 1', 'Soverom 2', 'Gang', 'Vaske\u00adrom', 'Bod', 'Garasje', 'Lys', 'Varme\u00adkabler', 'Elbil'].map((navn, i) => ({
            navn,
            merking: i === 11 ? '32 A' : i % 3 === 0 ? '16 A' : '10 A',
            gaatt: i === 4,
          }))}
        />
        <Sikringsskap x={340} y={110} w={90} h={110} kurser={[{ navn: 'Ovn', merking: '10 A' }, { navn: 'Utebelysning', merking: '10 A', gaatt: true }]} />
      </GalleryItem>

      <GalleryItem title="Solcellepanel: 15°, 40° og 60° på stolpe, 90° på en fasade og 30° på taket" viewBox="0 0 400 240">
        <Outdoor />
        <path d="M262,200L262,118L327,80L392,118L392,200Z" fill={SCENE.brick} stroke={SCENE.outline} strokeWidth={1} />
        <path d="M256,121.5L327,80L398,121.5" fill="none" stroke={SCENE.stoneDark} strokeWidth={5} strokeLinejoin="round" />
        <Solcellepanel x={52} y={200} w={80} vinkel={15} />
        <Solcellepanel x={140} y={200} w={80} vinkel={40} />
        <Solcellepanel x={214} y={200} w={64} vinkel={60} />
        <Solcellepanel x={262} y={192} w={62} vinkel={90} montering="tak" />
        <Solcellepanel x={274} y={108.5} w={52} vinkel={30.3} montering="tak" />
        <ForceArrow x1={104} y1={36} x2={130} y2={120} color={VIZ.series[3]} width={5} label="lys" />
      </GalleryItem>

      <GalleryItem title="Solcellepanel fra 0° til 90° på stolpe (steg på 30°), og speilvendt" viewBox="0 0 400 200">
        <Outdoor h={200} ground={170} />
        <Solcellepanel x={50} y={170} w={70} vinkel={0} />
        <Solcellepanel x={140} y={170} w={70} vinkel={30} />
        <Solcellepanel x={225} y={170} w={70} vinkel={60} />
        <Solcellepanel x={295} y={170} w={70} vinkel={90} />
        <Solcellepanel x={360} y={170} w={56} vinkel={45} flip />
      </GalleryItem>

      <GalleryItem title="Panelovn: av, på (varm luft) og på veggen" viewBox="0 0 400 230">
        <Room h={230} floor={210} />
        <Stikkontakt x={30} y={186} size={26} />
        <Panelovn x={120} y={210} w={150} />
        <Panelovn x={300} y={210} w={150} paa tid={0.4} />
        <Panelovn x={300} y={70} w={110} h={34} fotter={false} paa />
      </GalleryItem>

      <GalleryItem title="Små utgaver (tynne detaljer) og dimmet med piler oppå" viewBox="0 0 400 200">
        <Lab h={200} bench={170} />
        <Termometer x={22} y={166} h={80} temp={60} min={0} max={100} skala="ingen" />
        <Vannkoker x={65} y={170} size={50} paa damp={0.6} />
        <Kokeplate x={120} y={170} w={56} effekt={0.8} />
        <Lyspaere x={170} y={170} size={44} lysstyrke={0.7} fatning />
        <Batteri x={210} y={160} size={34} />
        <Multimeter x={250} y={130} size={70} visning="1,5 V" modus="V" />
        <Bryter x={300} y={170} size={50} lukket={false} />
        <Sikring x={340} y={130} size={56} gaatt merking="16 A" />
        <Isbit x={378} y={170} size={22} smeltet={0.2} />
        <Kasserolle x={300} y={100} w={60} dim />
        <Vannkoker x={360} y={80} size={60} dim />
        <ForceArrow x1={300} y1={74} x2={300} y2={118} color={VIZ.gravity} label="G" origin />
        <ForceArrow x1={360} y1={56} x2={395} y2={56} color={VIZ.applied} label="F" />
      </GalleryItem>
      <KapittelKrets />
      <KapittelVarme />
    </GalleryGrid>
  );
}

/**
 * Slik en strømkrets kan se ut i et kapittel (viewBox 800 bred, så teksten vokser på mobil som i kapitlene).
 * Tallene henger sammen: 9 V-batteri, I = 0,30 A, R = 10 Ω gir 3,0 V over motstanden og 6,0 V over lab-pæra.
 * Multimeterne er ganget med useSceneScale(), så avlesningen kan leses på mobil, og strømmen står også i et skilt.
 */
function KapittelKrets() {
  const s = useSceneScale();
  const batt = { x: 120, y: 322, size: 100, type: '9v' as const };
  const b = batteriPoler(batt);
  const brt = { x: 300, y: 372, size: 130, lukket: true };
  const sw = bryterPoler(brt);
  const lamp = { x: 660, y: 372, size: 110, fatning: true, lysstyrke: 0.8 };
  const l = lyspaerePoler(lamp);
  // Amperemeteret står på benken, voltmeteret henger øverst; begge vokser på mobil.
  const amSize = 120 * s;
  const am = { x: 470, y: 368 - amSize / 2, size: amSize, visning: '0,30 A', modus: 'A' as const };
  const a = multimeterPunkter(am);
  const vmSize = 110 * s;
  const vm = { x: 270, y: 10 + vmSize / 2, size: vmSize, visning: '3,0 V', modus: 'V' as const };
  const v = multimeterPunkter(vm);
  const vBottom = 10 + vmSize;
  const bus = a.com.y + 14;
  const top = 200;
  const strom = { fase: 0.35 };
  return (
    <GalleryItem title="I et kapittel: amperemeter i serie, voltmeter over motstanden" viewBox="0 0 800 400">
      <Lab w={800} h={400} bench={370} />
      <Ledning points={[[b.pluss.x, b.pluss.y], [b.pluss.x, 240], [sw.a.x, 240], [sw.a.x, sw.a.y]]} strom={strom} />
      <Ledning points={[[sw.b.x, sw.b.y], [400, sw.b.y], [400, bus], [a.inn.x, bus], [a.inn.x, a.inn.y]]} strom={strom} />
      <Ledning points={[[a.com.x, a.com.y], [a.com.x, bus], [600, bus], [600, l.a.y], [l.a.x, l.a.y]]} farge="svart" strom={strom} />
      <Ledning points={[[l.b.x, l.b.y], [745, l.b.y], [745, top], [340, top]]} farge="svart" strom={strom} />
      <Ledning points={[[200, top], [b.minus.x, top], [b.minus.x, b.minus.y]]} farge="svart" strom={strom} />
      <Motstand x1={200} y1={top} x2={340} y2={top} label="R = 10 Ω" labelSide="below" />
      <Batteri {...batt} />
      <Bryter {...brt} />
      <Lyspaere {...lamp} />
      <Multimeter {...am} />
      <Multimeter {...vm} />
      <Ledning points={[[v.inn.x, v.inn.y], [v.inn.x, vBottom + 10], [326, vBottom + 10], [326, top]]} farge="rod" bredde={4} />
      <Ledning points={[[v.com.x, v.com.y], [v.com.x, vBottom + 18], [214, vBottom + 18], [214, top]]} farge="svart" bredde={4} />
      <ValueTag x={am.x - am.size * 0.28 - 12} y={am.y} text="0,30 A" color={VIZ.series[0]} anchor="end" />
      <ForceArrow x1={700} y1={172} x2={600} y2={172} color={VIZ.series[0]} width={5} label="I" />
    </GalleryItem>
  );
}

/** Slik en varmescene kan se ut i et kapittel (viewBox 800 bred). */
function KapittelVarme() {
  const plate = { x: 250, y: 290, w: 220 };
  const potW = 150;
  const potY = plate.y - 0.3 * plate.w + 0.08 * potW;
  return (
    <GalleryItem title="I et kapittel: vann som varmes på kokeplate, vannkoker og is" viewBox="0 0 800 330">
      <Kitchen w={800} h={330} bench={290} />
      <Kokeplate {...plate} effekt={0.7} />
      <Kasserolle x={plate.x} y={potY} w={potW} vann={0.65} damp={0.4} snitt tid={0.7} />
      <Termometer x={262} y={potY - 18} h={190} temp={78} min={0} max={100} rotate={9} />
      <Vannkoker x={570} y={290} size={170} paa vann={0.75} damp={0.8} tid={0.9} />
      <Isbit x={720} y={300} size={44} smeltet={0.4} />
      <ValueTag x={570} y={58} text="P = 2,0 kW" color={VIZ.series[4]} />
      <Callout x={720} y={276} lx={700} ly={210} anchor="middle">
        Is
      </Callout>
    </GalleryItem>
  );
}
