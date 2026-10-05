/** Galleri for familien «rom»: stjernehimmel, stjerner, sola, planeter, tåker, partikler, fotoner, stråler og spektre. */
import type { ReactNode } from 'react';
import { VIZ } from '../../colors';
import { Txt } from '../../txt';
import { LinearGradient, alpha, useSvgId } from '../core';
import { ForceArrow } from '../overlay';
import { SCENE } from '../palette';
import { Atomkjerne, Elektron, Foton, Lysstraale, Nukleon, Planet, Sol, Spektrum, Stjerne, Stjernehimmel, Taake } from '../rom';
import { GalleryGrid, GalleryItem } from './felles';

/** Lys tekst på mørk himmel (uten glorie). */
function SpaceLabel({ x, y, children, anchor = 'middle', size = 0.75 }: { x: number; y: number; children: ReactNode; anchor?: 'start' | 'middle' | 'end'; size?: number }) {
  return (
    <Txt x={x} y={y} anchor={anchor} size={size} color={SCENE.star} halo={false}>
      {children}
    </Txt>
  );
}

/** Enkelt prisme i glass (bare til galleriet). */
function Prisme({ x, y, s }: { x: number; y: number; s: number }) {
  const id = useSvgId('prisme');
  const h = s * 0.866;
  return (
    <g>
      <LinearGradient
        id={id}
        x1={0}
        y1={0}
        x2={1}
        y2={1}
        stops={[
          [0, SCENE.glass, 0.55],
          [1, SCENE.glassEdge, 0.45],
        ]}
      />
      <polygon points={`${x},${y - h / 2} ${x + s / 2},${y + h / 2} ${x - s / 2},${y + h / 2}`} fill={`url(#${id})`} stroke={SCENE.glassEdge} strokeWidth={1.4} />
    </g>
  );
}

const HYDROGEN = [410, 434, 486, 656];
const SOL_LINJER = [
  { nm: 393, styrke: 1 },
  { nm: 397, styrke: 1 },
  { nm: 431, styrke: 0.6 },
  { nm: 486, styrke: 0.8 },
  { nm: 517, styrke: 0.7 },
  { nm: 527, styrke: 0.5 },
  { nm: 589, styrke: 1 },
  { nm: 656, styrke: 0.9 },
  { nm: 687, styrke: 0.6 },
  { nm: 718, styrke: 0.4 },
];

export default function Galleri() {
  return (
    <GalleryGrid>
      <GalleryItem title="Stjernehimmel med melkevei (frø 1 og 4)">
        <Stjernehimmel x={0} y={0} w={400} h={240} seed={1} />
        <Stjernehimmel x={250} y={140} w={140} h={90} seed={4} melkevei={1} />
      </GalleryItem>

      <GalleryItem title="Stjerner etter temperatur">
        <Stjernehimmel x={0} y={0} w={400} h={240} seed={2} melkevei={0.3} antall={40} />
        {[
          [3000, 13],
          [4500, 11],
          [5800, 10],
          [10000, 9],
          [25000, 8],
        ].map(([T, r], i) => (
          <g key={T}>
            <Stjerne x={52 + i * 74} y={80} r={r!} temperatur={T!} />
            <SpaceLabel x={52 + i * 74} y={135}>
              {`${T!.toLocaleString('nb-NO')} K`}
            </SpaceLabel>
          </g>
        ))}
        {[3000, 4500, 5800, 10000, 25000].map((T, i) => (
          <Stjerne key={T} x={52 + i * 74} y={190} r={6} temperatur={T} metning={2} glod={0.9} glimt />
        ))}
        <SpaceLabel x={200} y={228} size={0.65}>
          Lærebokfarger (metning 2) med glimt
        </SpaceLabel>
      </GalleryItem>

      <GalleryItem title="Sola med korona, granulering og solflekker">
        <Stjernehimmel x={0} y={0} w={400} h={240} seed={5} melkevei={0.4} antall={50} />
        <Sol x={150} y={120} r={82} flekker={3} />
        <Sol x={330} y={60} r={22} korona={0.4} flekker={0} />
        <Planet x={340} y={175} r={14} type="jorda" lysretning={200} />
      </GalleryItem>

      <GalleryItem title="Planetene og Månen (lys fra venstre)">
        <Stjernehimmel x={0} y={0} w={400} h={240} seed={6} melkevei={0.5} />
        <Planet x={70} y={80} r={46} type="jorda" />
        <Planet x={185} y={70} r={26} type="mars" />
        <Planet x={305} y={95} r={62} type="jupiter" />
        <Planet x={70} y={190} r={22} type="maanen" />
        <Planet x={190} y={180} r={34} type="neptun" />
        <SpaceLabel x={70} y={140}>
          Jorda
        </SpaceLabel>
        <SpaceLabel x={185} y={112}>
          Mars
        </SpaceLabel>
        <SpaceLabel x={305} y={180}>
          Jupiter
        </SpaceLabel>
        <SpaceLabel x={70} y={230}>
          Månen
        </SpaceLabel>
        <SpaceLabel x={190} y={230}>
          Neptun
        </SpaceLabel>
      </GalleryItem>

      <GalleryItem title="Jorda og Månen med kraftpiler (G og v)">
        <Stjernehimmel x={0} y={0} w={400} h={240} seed={8} melkevei={0.4} />
        <Planet x={140} y={135} r={78} type="jorda" rotate={23.4} />
        <Planet x={330} y={60} r={20} type="maanen" />
        <ForceArrow x1={330} y1={60} x2={262} y2={92} color={VIZ.gravity} label="G" origin />
        <ForceArrow x1={330} y1={60} x2={365} y2={135} color={VIZ.velocity} label="v" width={6} />
      </GalleryItem>

      <GalleryItem title="Jorda dreid 0°, 90°, 180° og 270°">
        <Stjernehimmel x={0} y={0} w={400} h={240} seed={9} melkevei={0} antall={60} />
        {[0, 90, 180, 270].map((d, i) => (
          <g key={d}>
            <Planet x={52 + i * 98} y={105} r={42} type="jorda" dreining={d} natt={0.6} />
            <SpaceLabel x={52 + i * 98} y={175}>
              {`${d}°`}
            </SpaceLabel>
          </g>
        ))}
        <SpaceLabel x={200} y={220} size={0.65}>
          dreining = døgnrotasjon (østover)
        </SpaceLabel>
      </GalleryItem>

      <GalleryItem title="Månefaser (fase 0,05–1) og halv jord (fase 0,5)">
        <Stjernehimmel x={0} y={0} w={400} h={240} seed={16} melkevei={0} antall={50} />
        {[0.05, 0.25, 0.5, 0.75, 1].map((f, i) => (
          <g key={f}>
            <Planet x={45 + i * 77} y={60} r={28} type="maanen" fase={f} />
            <SpaceLabel x={45 + i * 77} y={112} size={0.65}>
              {String(f).replace('.', ',')}
            </SpaceLabel>
          </g>
        ))}
        <Planet x={110} y={185} r={46} type="jorda" fase={0.5} />
        <Planet x={290} y={185} r={46} type="jorda" fase={0.5} lysretning={0} dreining={-60} />
      </GalleryItem>

      <GalleryItem title="Lysretning, aksehelning og nedtonet">
        <Stjernehimmel x={0} y={0} w={400} h={240} seed={10} melkevei={0} antall={50} />
        <Planet x={55} y={70} r={34} type="maanen" lysretning={0} />
        <Planet x={150} y={70} r={34} type="maanen" lysretning={-90} />
        <Planet x={245} y={70} r={34} type="maanen" natt={0} />
        <Planet x={340} y={70} r={34} type="maanen" dim />
        <Planet x={80} y={175} r={44} type="mars" rotate={25} dreining={120} />
        <Planet x={200} y={175} r={44} type="jupiter" rotate={-20} dreining={60} lysretning={150} />
        <Planet x={320} y={175} r={44} type="neptun" rotate={28} lysretning={210} />
      </GalleryItem>

      <GalleryItem title="Tåker: stjernedannelse (rød, blå, fiolett)">
        <Stjernehimmel x={0} y={0} w={400} h={240} seed={11} melkevei={0.5} />
        <Taake x={10} y={20} w={200} h={150} farge="rod" seed={2} />
        <Taake x={200} y={10} w={190} h={120} farge="blaa" seed={5} />
        <Taake x={200} y={120} w={180} h={115} farge="fiolett" seed={8} />
      </GalleryItem>

      <GalleryItem title="Planetariske tåker rundt hvite dverger">
        <Stjernehimmel x={0} y={0} w={400} h={240} seed={12} melkevei={0.3} />
        <Taake x={20} y={30} w={190} h={170} form="ring" farge="rod" seed={1} />
        <Taake x={230} y={40} w={140} h={110} form="ring" farge="blaa" seed={3} />
        <Taake x={250} y={160} w={90} h={70} form="ring" farge="fiolett" seed={4} />
      </GalleryItem>

      <GalleryItem title="Nukleoner og elektroner i tre størrelser">
        {[6, 12, 22].map((r, i) => (
          <g key={r}>
            <Nukleon x={60 + i * 18 + [0, 30, 80][i]!} y={70} r={r} type="proton" />
            <Nukleon x={60 + i * 18 + [0, 30, 80][i]! + r * 2.3} y={70} r={r} type="noytron" />
          </g>
        ))}
        <Elektron x={80} y={170} r={4} />
        <Elektron x={150} y={170} r={7} />
        <Elektron x={240} y={170} r={11} />
        <Nukleon x={330} y={170} r={14} type="proton" dim />
        <Txt x={60} y={120} size={0.75} anchor="start">
          Proton og nøytron
        </Txt>
        <Txt x={60} y={215} size={0.75} anchor="start">
          Elektron (og nedtonet proton)
        </Txt>
      </GalleryItem>

      <GalleryItem title="Atomkjerner: radius ∝ A^(1/3)" viewBox="0 0 400 240">
        <Atomkjerne x={40} y={78} Z={2} N={2} r={8} />
        <Atomkjerne x={105} y={78} Z={6} N={6} r={8} />
        <Atomkjerne x={190} y={78} Z={26} N={30} r={6} />
        <Atomkjerne x={315} y={78} Z={92} N={146} r={6} />
        {[
          [40, '⁴He'],
          [105, '¹²C'],
          [190, '⁵⁶Fe'],
          [315, '²³⁸U'],
        ].map(([x, t]) => (
          <Txt key={t} x={x as number} y={152} size={0.7}>
            {t}
          </Txt>
        ))}
        <Atomkjerne x={40} y={200} Z={1} N={0} r={7} />
        <Atomkjerne x={80} y={200} Z={1} N={1} r={7} />
        <Atomkjerne x={130} y={200} Z={1} N={2} r={7} />
        <Atomkjerne x={205} y={200} Z={8} N={8} r={4.5} seed={2} />
        <Atomkjerne x={255} y={200} Z={8} N={8} r={4.5} seed={3} />
        <Txt x={85} y={234} size={0.6}>
          ¹H, ²H, ³H
        </Txt>
        <Txt x={230} y={234} size={0.6}>
          ¹⁶O med frø 2 og 3
        </Txt>
      </GalleryItem>

      <GalleryItem title="Alfahenfall med fart og γ-foton">
        <Stjernehimmel x={0} y={0} w={400} h={240} seed={13} melkevei={0.2} antall={40} />
        <Atomkjerne x={120} y={130} Z={90} N={144} r={5.5} />
        <Atomkjerne x={265} y={95} Z={2} N={2} r={8} />
        <ForceArrow x1={265} y1={95} x2={360} y2={60} color={VIZ.velocity} label="v" width={6} />
        <Foton x1={150} y1={180} x2={330} y2={205} bolgelengde={0.002} farge={VIZ.series[3]} label="γ" />
        <SpaceLabel x={120} y={60}>
          Th-234
        </SpaceLabel>
      </GalleryItem>

      <GalleryItem title="Fotoner fra UV til IR (like lange)">
        <Stjernehimmel x={0} y={0} w={400} h={240} seed={14} melkevei={0} antall={30} />
        {[300, 410, 486, 550, 589, 656, 900].map((nm, i) => (
          <g key={nm}>
            <Foton x1={80} y1={22 + i * 31} x2={330} y2={22 + i * 31} bolgelengde={nm} amplitude={8} />
            <SpaceLabel x={70} y={27 + i * 31} anchor="end" size={0.65}>
              {`${nm} nm`}
            </SpaceLabel>
          </g>
        ))}
      </GalleryItem>

      <GalleryItem title="Fotoner på lys flate, skrått og med etikett">
        <Foton x1={30} y1={60} x2={190} y2={60} bolgelengde={580} label="hf" />
        <Foton x1={220} y1={190} x2={360} y2={60} bolgelengde={450} label="hf" amplitude={10} />
        <Foton x1={40} y1={130} x2={150} y2={210} bolgelengde={656} />
        <Foton x1={200} y1={20} x2={200} y2={120} bolgelengde={520} label="E = hf" svingninger={4} />
      </GalleryItem>

      <GalleryItem title="Lysstråler: hvitt lys gjennom et prisme">
        <rect x={0} y={0} width={400} height={240} fill={alpha(SCENE.wall, 0.7)} />
        <Lysstraale x1={10} y1={150} x2={160} y2={118} hvit />
        <Prisme x={190} y={120} s={110} />
        {[700, 620, 580, 530, 470, 420].map((nm, i) => (
          <Lysstraale key={nm} x1={218} y1={122 + i * 1.5} x2={390} y2={104 + i * 22} bolgelengde={nm} bredde={2.5} pil={false} />
        ))}
        <Lysstraale x1={20} y1={40} x2={170} y2={40} bolgelengde={532} bredde={3} />
        <Lysstraale x1={20} y1={70} x2={170} y2={70} bolgelengde={650} bredde={3} styrke={0.4} />
      </GalleryItem>

      <GalleryItem title="Lysstråler i mørket" viewBox="0 0 400 200">
        <Stjernehimmel x={0} y={0} w={400} h={200} seed={15} melkevei={0} antall={25} />
        <Sol x={30} y={100} r={40} korona={0.5} flekker={0} />
        <Lysstraale x1={70} y1={100} x2={300} y2={60} hvit bredde={5} />
        <Lysstraale x1={70} y1={110} x2={300} y2={150} bolgelengde={450} bredde={3} />
        <Planet x={340} y={60} r={26} type="jorda" />
      </GalleryItem>

      <GalleryItem title="Spektre: kontinuerlig, emisjon (H) og absorpsjon (sola)" viewBox="0 0 400 290">
        <Spektrum x={20} y={10} w={360} h={34} skala />
        <Spektrum x={20} y={80} w={360} h={34} type="emisjon" linjer={HYDROGEN} skala />
        <Spektrum x={20} y={150} w={360} h={34} type="absorpsjon" linjer={SOL_LINJER} skala />
        <Spektrum x={20} y={222} w={360} h={26} fra={250} til={1000} skala />
      </GalleryItem>

      <GalleryItem title="Grensetilfeller: små, store og rare verdier">
        <Stjernehimmel x={0} y={0} w={400} h={120} seed={30} antall={0} melkevei={1} />
        <Planet x={30} y={40} r={4} type="jorda" />
        <Planet x={60} y={40} r={8} type="jupiter" fase={0} />
        <Planet x={95} y={40} r={14} type="mars" fase={1} natt={1} />
        <Sol x={140} y={40} r={6} />
        <Stjerne x={180} y={40} r={3} temperatur={1000} />
        <Stjerne x={210} y={40} r={3} temperatur={90000} glod={1} />
        <Stjerne x={240} y={40} r={0} temperatur={Number.NaN} />
        <Atomkjerne x={270} y={40} Z={0} N={0} />
        <Atomkjerne x={300} y={40} Z={300} N={500} r={1.5} />
        <Foton x1={330} y1={40} x2={340} y2={40} />
        <Foton x1={330} y1={80} x2={390} y2={80} bolgelengde={-5} />
        <Lysstraale x1={20} y1={90} x2={20} y2={90} hvit />
        <Taake x={150} y={70} w={0} h={0} />
        <Spektrum x={20} y={140} w={360} h={20} type="emisjon" fra={500} til={520} linjer={[505, 515, 600]} skala />
        <Spektrum x={20} y={200} w={360} h={20} type="absorpsjon" fra={750} til={380} linjer={[{ nm: 589, styrke: 3 }]} skala />
      </GalleryItem>

      <GalleryItem title="Full bredde (800): sola, jorda og månen" viewBox="0 0 800 400">
        <Stjernehimmel x={0} y={0} w={800} h={400} seed={21} />
        <Sol x={-40} y={200} r={150} flekker={3} />
        <Planet x={460} y={210} r={92} type="jorda" rotate={23.4} />
        <Planet x={700} y={110} r={25} type="maanen" />
        <Taake x={560} y={250} w={220} h={140} farge="fiolett" seed={3} />
        <ForceArrow x1={700} y1={110} x2={610} y2={150} color={VIZ.gravity} label="G" origin />
        <ForceArrow x1={700} y1={110} x2={745} y2={200} color={VIZ.velocity} label="v" />
        <Foton x1={170} y1={90} x2={360} y2={120} bolgelengde={520} label="hf" />
      </GalleryItem>

      <GalleryItem title="Full bredde (800): kjerne, elektroner og spekter" viewBox="0 0 800 360">
        <Atomkjerne x={150} y={120} Z={6} N={6} r={11} />
        <circle cx={150} cy={120} r={95} fill="none" stroke={VIZ.muted} strokeWidth={1.2} strokeDasharray="4 5" />
        <Elektron x={245} y={120} r={8} />
        <Elektron x={55} y={120} r={8} />
        <Foton x1={260} y1={110} x2={460} y2={70} bolgelengde={486} label="hf" />
        <Nukleon x={520} y={80} r={14} type="proton" />
        <Nukleon x={560} y={80} r={14} type="noytron" />
        <Elektron x={600} y={80} r={8} />
        <Spektrum x={40} y={250} w={720} h={50} type="emisjon" linjer={HYDROGEN} skala />
      </GalleryItem>
    </GalleryGrid>
  );
}
