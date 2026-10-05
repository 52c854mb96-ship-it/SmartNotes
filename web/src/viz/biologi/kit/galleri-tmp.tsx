/**
 * MIDLERTIDIG galleri over biologi-kit-et (kun for skjermbilder under finpussen; slettes etterpå).
 * Monteres fra Playwright: import('/src/viz/biologi/kit/galleri-tmp.tsx').then((m) => m.mount(section)).
 */
import { StrictMode, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { Figure } from '../../kit';
import { BIO } from './colors';
import {
  Celle,
  Cellemodell,
  Cellekjerne,
  Mitokondrie,
  Kloroplast,
  EndoplasmatiskNettverk,
  Golgiapparat,
  Ribosomer,
  Lysosom,
  Vakuole,
  Vesikkel,
  Cytoskjelett,
} from './celle';
import { Membran, Kanalprotein, Akvaporin, Baereprotein, NaKPumpe, Reseptor, proteinSlot } from './membran';
import { Kromosom, Delingsfigur } from './kromosom';
import {
  Bakterie,
  Virus,
  Sopp,
  Plante,
  Tre,
  Fisk,
  Fugl,
  Pattedyr,
  Insekt,
  Menneske,
  RodtBlodlegeme,
  HvittBlodlegeme,
  Antistoff,
} from './organismer';

function Sec({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="viz" style={{ marginBottom: 20 }} data-sec={title}>
      <h3 style={{ margin: '0 0 6px' }}>{title}</h3>
      {children}
    </section>
  );
}

function Celler() {
  return (
    <Figure viewBox="0 0 800 640" label="celler" maxHeight={900}>
      <Cellemodell type="dyr" x={10} y={10} w={390} h={290} />
      <Cellemodell type="plante" x={410} y={10} w={380} h={290} />
      <Cellemodell type="bakterie" x={10} y={330} w={380} h={150} />
      <Celle type="plante" x={410} y={320} w={250} h={180} protoplast={0.72}>
        <Kloroplast x={480} y={380} w={40} h={18} />
      </Celle>
      <Celle type="dyr" x={680} y={330} w={110} h={100} />
      <Cellemodell type="dyr" x={10} y={490} w={190} h={140} highlight="mitokondrie" dimOthers />
      <Cellemodell type="plante" x={220} y={490} w={190} h={140} highlight="vakuole" />
      <Cellemodell type="bakterie" x={430} y={510} w={200} h={100} highlight="plasmid" />
    </Figure>
  );
}

function Organeller() {
  return (
    <Figure viewBox="0 0 800 330" label="organeller" maxHeight={900}>
      <Cellekjerne x={70} y={70} r={56} />
      <Mitokondrie x={210} y={50} w={110} h={48} />
      <Mitokondrie x={210} y={120} w={80} h={34} rotate={70} highlight />
      <Kloroplast x={360} y={60} w={120} h={54} />
      <Kloroplast x={360} y={130} w={60} h={28} rotate={90} />
      <EndoplasmatiskNettverk x={530} y={60} w={130} h={70} />
      <EndoplasmatiskNettverk x={530} y={140} w={100} h={46} kornet={false} sekker={2} />
      <Golgiapparat x={700} y={70} w={100} h={70} />
      <Ribosomer x={80} y={190} w={90} h={60} n={20} />
      <Lysosom x={180} y={190} r={22} />
      <Lysosom x={230} y={190} r={12} dim />
      <Vakuole x={320} y={200} w={90} h={60} />
      <Vesikkel x={400} y={190} r={10} />
      <Vesikkel x={430} y={200} r={6} paint={BIO.lysosom} highlight />
      <Cytoskjelett x={560} y={220} w={160} h={90} />
      <Cellekjerne x={720} y={210} r={36} highlight />
      <Golgiapparat x={90} y={280} w={70} h={46} rotate={-18} />
      <EndoplasmatiskNettverk x={260} y={280} w={110} h={40} bue={60} />
      <Mitokondrie x={420} y={285} w={50} h={22} rotate={-12} dim />
      <Kloroplast x={500} y={285} w={46} h={22} grana={2} />
    </Figure>
  );
}

function Membraner() {
  const T = 44;
  const xs = [140, 240, 340, 450, 570, 680];
  const skip = [proteinSlot(140, 'kanal'), proteinSlot(240, 'kanal'), proteinSlot(340, 'akvaporin'), proteinSlot(450, 'baerer'), proteinSlot(570, 'pumpe'), proteinSlot(680, 'reseptor')];
  return (
    <Figure viewBox="0 0 800 330" label="membran" maxHeight={900}>
      <rect x={20} y={20} width={760} height={90} fill={BIO.vannFyll} />
      <rect x={20} y={110} width={760} height={80} fill={BIO.cytoplasma} />
      <Membran x={400} y={110} length={760} thickness={T} skip={skip} />
      <Kanalprotein x={xs[0]!} y={110} />
      <Kanalprotein x={xs[1]!} y={110} open={false} />
      <Akvaporin x={xs[2]!} y={110} />
      <Baereprotein x={xs[3]!} y={110} state={0.3} />
      <NaKPumpe x={xs[4]!} y={110} state={0.8} fosfat />
      <Reseptor x={xs[5]!} y={110} bound />
      <circle cx={240} cy={60} r={6} fill={BIO.opplost} />
      <rect x={20} y={210} width={300} height={110} fill={BIO.vannFyll} />
      <Membran x={170} y={265} length={110} vertical skip={[proteinSlot(265, 'kanal')]} />
      <Kanalprotein x={170} y={265} vertical highlight />
      <Membran x={500} y={265} length={300} highlight />
      <Membran x={500} y={300} length={300} dim thickness={30} />
      <Baereprotein x={720} y={265} vertical state={1} />
    </Figure>
  );
}

function Kromosomer() {
  return (
    <Figure viewBox="0 0 800 560" label="kromosomer" maxHeight={1100}>
      <Kromosom x={60} y={90} lengde={110} par={0} opphav="mor" />
      <Kromosom x={130} y={90} lengde={110} par={0} opphav="far" segmenter={[[], [{ fra: 0.7, til: 1, opphav: 'mor' }]]} />
      <Kromosom x={200} y={90} lengde={80} par={1} opphav="mor" kromatider={1} />
      <Kromosom x={260} y={90} lengde={60} par={2} opphav="far" rot={30} highlight />
      <Kromosom x={330} y={90} lengde={70} par={1} opphav="far" kondensert={false} kromatider={1} />
      <Kromosom x={390} y={90} lengde={30} par={2} opphav="mor" />
      <Delingsfigur deling="mitose" fase="metafase" n={2} box={{ x: 420, y: 10, w: 370, h: 200 }} />
      <Delingsfigur deling="meiose1" fase="profase" n={2} box={{ x: 10, y: 220, w: 380, h: 200 }} overkrysning />
      <Delingsfigur deling="mitose" fase="anafase" n={3} box={{ x: 410, y: 220, w: 380, h: 200 }} />
      <Delingsfigur deling="mitose" fase="interfase" n={2} box={{ x: 10, y: 430, w: 250, h: 125 }} />
      <Delingsfigur deling="mitose" fase="telofase" n={2} box={{ x: 270, y: 430, w: 260, h: 125 }} />
      <Delingsfigur deling="meiose2" fase="metafase" n={2} box={{ x: 540, y: 430, w: 250, h: 125 }} />
    </Figure>
  );
}

const ORG = (s: number, y: number, extra?: Partial<{ dim: boolean; highlight: boolean }>) => (
  <g>
    <Bakterie x={s} y={y} size={s} form="stav" {...extra} />
    <Bakterie x={2.1 * s} y={y} size={s} form="kokk" flagell {...extra} />
    <Bakterie x={3.2 * s} y={y} size={s} form="spiril" {...extra} />
    <Bakterie x={4.3 * s} y={y} size={s} form="stav" flagell rotate={20} {...extra} />
    <Virus x={5.4 * s} y={y} size={s} {...extra} />
    <Virus x={6.5 * s} y={y} size={s} type="bakteriofag" {...extra} />
    <Sopp x={7.6 * s} y={y} size={s} {...extra} />
    <Plante x={8.7 * s} y={y} size={s} {...extra} />
    <Tre x={9.8 * s} y={y} size={s} {...extra} />
    <Tre x={10.9 * s} y={y} size={s} bartre {...extra} />
    <Fisk x={12 * s} y={y} size={s} {...extra} />
    <Fugl x={13.1 * s} y={y} size={s} {...extra} />
    <Pattedyr x={14.2 * s} y={y} size={s} {...extra} />
    <Insekt x={15.3 * s} y={y} size={s} {...extra} />
    <Menneske x={16.4 * s} y={y} size={s} {...extra} />
  </g>
);

function Organismer() {
  const col = [BIO.sir.S, BIO.sir.I, BIO.sir.R, BIO.sir.V];
  return (
    <Figure viewBox="0 0 800 520" label="organismer" maxHeight={1100}>
      {ORG(44, 40)}
      {ORG(24, 100)}
      {ORG(17, 140)}
      {ORG(24, 175, { highlight: true })}
      <RodtBlodlegeme x={50} y={240} size={70} />
      <RodtBlodlegeme x={130} y={240} size={70} swelling={0.5} />
      <RodtBlodlegeme x={210} y={240} size={70} swelling={1} />
      <RodtBlodlegeme x={290} y={240} size={70} crenation={0.5} />
      <RodtBlodlegeme x={370} y={240} size={70} crenation={1} />
      <RodtBlodlegeme x={450} y={240} size={70} burst />
      <HvittBlodlegeme x={540} y={240} size={70} />
      <HvittBlodlegeme x={620} y={240} size={70} type="lymfocytt" />
      <HvittBlodlegeme x={710} y={240} size={70} type="makrofag" />
      <Antistoff x={50} y={320} size={50} />
      <Antistoff x={100} y={320} size={30} rotate={30} />
      <RodtBlodlegeme x={150} y={320} size={30} paint={{ fill: BIO.oksygenfattig, line: BIO.oksygenfattig }} />
      <RodtBlodlegeme x={190} y={320} size={30} />
      <Fisk x={290} y={320} size={130} dim />
      <Menneske x={420} y={320} size={70} paint={{ fill: BIO.sir.I, line: BIO.sir.I }} />
      <Pattedyr x={520} y={320} size={70} />
      <Fugl x={610} y={320} size={70} />
      <Insekt x={700} y={320} size={70} rotate={90} />
      {Array.from({ length: 80 }, (_, i) => {
        const x = 20 + (i % 40) * 19 + 9.5;
        const y = 400 + Math.floor(i / 40) * 19 + 9.5;
        const c = col[i % 4]!;
        return <Menneske key={i} x={x} y={y} size={16.7} paint={{ fill: c, line: c }} />;
      })}
      {Array.from({ length: 16 }, (_, i) => (
        <Bakterie key={i} x={30 + i * 26} y={470} size={22} rotate={i * 23} paint={i % 2 ? BIO.lysosom : BIO.bakterie} />
      ))}
      <Virus x={520} y={480} size={56} />
      <Virus x={600} y={480} size={30} type="bakteriofag" />
      <Sopp x={660} y={480} size={30} />
      <Plante x={720} y={480} size={30} />
    </Figure>
  );
}

export function Galleri() {
  return (
    <div data-viz-ready>
      <Sec title="Celler">
        <Celler />
      </Sec>
      <Sec title="Organeller">
        <Organeller />
      </Sec>
      <Sec title="Membran">
        <Membraner />
      </Sec>
      <Sec title="Kromosomer">
        <Kromosomer />
      </Sec>
      <Sec title="Organismer">
        <Organismer />
      </Sec>
    </div>
  );
}

export function mount(el: HTMLElement) {
  el.innerHTML = '';
  createRoot(el).render(
    <StrictMode>
      <Galleri />
    </StrictMode>,
  );
}
