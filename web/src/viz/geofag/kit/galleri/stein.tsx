/**
 * Galleri for steinfamilien (?galleri=geo-stein): Korn (rundhet, bergartsfarger, avlange korn, på et underlag),
 * Kornpakning (vann, olje, gass, CO₂, luft, sement og leire i porene, godt og dårlig sortert, med porøsiteten),
 * Kornkurve (sikteanalyse med d₁₀, d₃₀ og d₆₀, og tre lognormale kurver), Krystall (alle formene med mineraler, glans og
 * isotopprikker), Steinprove (alle bergartene, kantet og rundslipt, kornstørrelse) og Lupe (med håndtak og som boble),
 * og til slutt ytterpunkter. Tallene er tenkte.
 */
import { fmt } from '../../../kit/format';
import { Txt } from '../../../kit/txt';
import { Underlag } from '../../../kit/scene/bakgrunn';
import { BERGARTER, METAMORFE, SEDIMENTARE, type BergartId } from '../bergarter';
import { geoHoyde, useGeoScale } from '../felles';
import { kumulativKurve, lognormalKurve } from '../kornstorrelse';
import { MINERALER, type MineralId } from '../mineraler';
import { Korn, Kornkurve, Kornpakning, RUNDHETSKLASSER, kornRamme, kornpakningGeometri, type KornpakningProps } from '../korn';
import { KRYSTALLFORM_NAVN, Krystall, Lupe, Steinprove, steinproveGeometri } from '../stein';
import type { MonsterId } from '../typer';
import { GalleryGrid, GalleryItem } from './felles';

const stor = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** Rutenett i en rute: n elementer i `kol` kolonner over bredden B, med radhøyde `rad`. */
function rute(i: number, kol: number, B: number, rad: number, y0 = 0) {
  const w = B / kol;
  return { x: (i % kol) * w + w / 2, y: y0 + Math.floor(i / kol) * rad, w };
}

/* ---------------------------------------------------------------- Korn */

function RundhetRad({ f }: { f: number }) {
  const smal = f > 1.3;
  const kol = smal ? 3 : 6;
  const rad = smal ? 180 : 170;
  return (
    <g>
      {RUNDHETSKLASSER.map((k, i) => {
        const p = rute(i, kol, 800, rad, 70);
        return (
          <g key={k.id}>
            <Korn x={p.x} y={p.y} d={smal ? 64 : 76} rundhet={k.verdi} seed={i + 3} type="sand" skygge />
            <Txt x={p.x} y={p.y + (smal ? 78 : 72)} size={0.8}>
              {stor(k.navn)}
            </Txt>
          </g>
        );
      })}
    </g>
  );
}

const KORN_TYPER: { type: MonsterId; navn: string; flekker?: number; rundhet: number; avlang?: number }[] = [
  { type: 'granitt', navn: 'Granitt', flekker: 6, rundhet: 0.2 },
  { type: 'kvartsitt', navn: 'Kvartsitt', rundhet: 0.85 },
  { type: 'basalt', navn: 'Basalt', rundhet: 0.5 },
  { type: 'kalkstein', navn: 'Kalkstein', rundhet: 0.7, avlang: 0.5 },
  { type: 'gneis', navn: 'Gneis', flekker: 4, rundhet: 0.35, avlang: 0.6 },
  { type: 'kull', navn: 'Kull', rundhet: 0.1 },
];

function KornTyper({ f }: { f: number }) {
  const smal = f > 1.3;
  const kol = smal ? 3 : 6;
  const rad = smal ? 175 : 160;
  return (
    <g>
      {KORN_TYPER.map((t, i) => {
        const p = rute(i, kol, 800, rad, 66);
        return (
          <g key={t.type}>
            <Korn x={p.x} y={p.y} d={smal ? 62 : 72} rundhet={t.rundhet} avlang={t.avlang} type={t.type} flekker={t.flekker} seed={11 + i} rotate={i * 23} />
            <Txt x={p.x} y={p.y + (smal ? 74 : 70)} size={0.8}>
              {t.navn}
            </Txt>
          </g>
        );
      })}
    </g>
  );
}

/** Høyden på ruten med korn på et underlag: lav på PC, og plass til steinen og etiketten på mobil. */
const kornBakkeHoyde = (f: number) => (f > 1.3 ? 290 : 215);

/** Korn på et underlag i fast målestokk (1 enhet = 1 mm): stein, grus og sand, med skygge. */
function KornPaaBakken({ f }: { f: number }) {
  const smal = f > 1.3;
  const H = kornBakkeHoyde(f);
  const y = H - 60;
  const alle = [
    { x: 130, xs: 120, d: 150, navn: 'Stein, 15 cm', rundhet: 0.7, type: 'gneis' as MonsterId, seed: 40 },
    { x: 330, xs: 330, d: 60, navn: 'Grus, 6 cm', rundhet: 0.55, type: 'granitt' as MonsterId, seed: 41 },
    { x: 460, xs: 470, d: 30, navn: 'Grus, 3 cm', rundhet: 0.3, type: 'kvartsitt' as MonsterId, seed: 42 },
    { x: 565, xs: 600, d: 10, navn: 'Grus, 1 cm', rundhet: 0.6, type: 'basalt' as MonsterId, seed: 43 },
    { x: 660, xs: null, d: 4, navn: 'Grus, 4 mm', rundhet: 0.5, type: 'granitt' as MonsterId, seed: 44 },
    { x: 750, xs: 730, d: 1.5, navn: 'Sand', rundhet: 0.8, type: 'sand' as MonsterId, seed: 45 },
  ];
  // På mobil er etikettene så brede at grusen på 4 mm må ut, og resten spres litt mer
  const korn = alle.flatMap((k) => (smal ? (k.xs === null ? [] : [{ ...k, x: k.xs }]) : [k]));
  return (
    <g>
      <Underlag x1={0} x2={800} y={y} depth={50} type="labbenk" />
      {korn.map((k) => {
        // kornRamme gir høyden på kornet, så etiketten står rett over det
        const ramme = kornRamme({ rundhet: k.rundhet, avlang: 0.25, seed: k.seed });
        const hoyde = (ramme.bunn - ramme.topp) * (k.d / 2);
        return (
          <g key={k.navn}>
            <Korn x={k.x} y={y} anker="bunn" d={k.d} rundhet={k.rundhet} type={k.type} seed={k.seed} skygge fastStorrelse avlang={0.25} />
            <Txt x={k.x} y={y - Math.max(hoyde, 6) - 12} size={0.75} muted>
              {k.navn}
            </Txt>
          </g>
        );
      })}
    </g>
  );
}

/* ---------------------------------------------------------------- Kornpakning */

const PAKNINGER: { title: string; note: string; props: Omit<KornpakningProps, 'x' | 'y'> }[] = [
  { title: 'Vann i porene, godt sortert sand', note: 'fyll="vann" sortering={0.35} rundhet="rundet"', props: { fyll: 'vann', sortering: 0.35, rundhet: 'rundet', seed: 2 } },
  { title: 'Vann i porene, dårlig sortert (morene)', note: 'sortering={1.8} rundhet="kantet": små korn i hullene gir lavere porøsitet.', props: { fyll: 'vann', sortering: 1.8, rundhet: 'kantet', seed: 3, type: 'morene' } },
  { title: 'Olje med vannhinne (vannfuktet reservoar)', note: 'fyll="olje": vannet ligger rundt kornene og i kontaktene.', props: { fyll: 'olje', sortering: 0.5, seed: 4 } },
  { title: 'Gass i porene', note: 'fyll="gass" (rød som hos Sokkeldirektoratet).', props: { fyll: 'gass', sortering: 0.5, seed: 5, rundhet: 'noe-rundet' } },
  { title: 'CO₂ lagret i porene', note: 'fyll="co2" sortering={0.6}.', props: { fyll: 'co2', sortering: 0.6, seed: 6 } },
  { title: 'Luft (umettet sone)', note: 'fyll="luft": vann bare som hinner og i kontaktene mellom kornene.', props: { fyll: 'luft', sortering: 0.6, seed: 7 } },
  { title: 'Delvis sementert sandstein', note: 'sement={0.45}: kalkspat vokser ut fra kornene og tetter porene.', props: { fyll: 'vann', sement: 0.45, sortering: 0.5, seed: 8 } },
  { title: 'Helt sementert', note: 'fyll="sement": krystallmosaikk i alle porene.', props: { fyll: 'sement', sortering: 0.5, seed: 9 } },
  { title: 'Leirpartikler i porene', note: 'fyll="leire" (leire={0.7}): små flak tetter porehalsene.', props: { fyll: 'leire', sortering: 0.5, seed: 10 } },
];

function PakningRute({ props }: { props: Omit<KornpakningProps, 'x' | 'y'> }) {
  const aapen = !props.sement && props.fyll !== 'sement' && props.fyll !== 'leire';
  return (
    <g>
      <Kornpakning x={200} y={140} r={125} {...props} />
      {aapen && (
        <Txt x={200} y={296} size={0.8} weight={600}>
          {/* porøsiteten i utsnittet regnes av kornpakningGeometri */}
          <PorositetTekst props={props} />
        </Txt>
      )}
    </g>
  );
}

function PorositetTekst({ props }: { props: Omit<KornpakningProps, 'x' | 'y'> }) {
  const k = useGeoScale();
  const g = kornpakningGeometri({ x: 200, y: 140, r: 125, sortering: props.sortering, rundhet: props.rundhet, seed: props.seed, korn: props.korn }, k);
  return <>{`Porøsitet ca. ${fmt(100 * (g?.porositet ?? 0), 0)} %`}</>;
}

/** Steinprøve av sandstein med en lupe som viser kornene og porene. */
function SandsteinUnderLupa({ f }: { f: number }) {
  const smal = f > 1.3;
  const prove = { x: smal ? 400 : 190, y: smal ? 250 : 270, size: smal ? 330 : 280 };
  const g = steinproveGeometri({ ...prove, bergart: 'sandstein', seed: 4 });
  const lupe = smal ? { x: 400, y: 470, r: 150 } : { x: 600, y: 172, r: 138 };
  return (
    <g>
      <Underlag x1={0} x2={800} y={prove.y} depth={smal ? 30 : 60} type="labbenk" />
      <Steinprove {...prove} bergart="sandstein" seed={4} />
      {g && (
        <Lupe x={lupe.x} y={lupe.y} r={lupe.r} fra={{ x: g.midt[0], y: g.midt[1], r: 12 }} malestokk={{ lengde: 70, tekst: '0,5 mm' }} tekst={smal ? undefined : 'Under lupa: korn og porer'}>
          {({ r }) => <Kornpakning x={0} y={0} r={r} ramme={false} fyll="vann" sement={0.3} sortering={0.45} rundhet="noe-rundet" seed={12} />}
        </Lupe>
      )}
    </g>
  );
}

/** Lupe ved siden av en gneisprøve: fra viser stedet, og forstorr viser det samme stedet tre ganger større. */
function GneisMedFra({ f }: { f: number }) {
  const smal = f > 1.3;
  const prove = { x: smal ? 400 : 230, y: smal ? 265 : 250, size: smal ? 330 : 300 };
  const g = steinproveGeometri({ ...prove, bergart: 'gneis', seed: 6 });
  const stein = <Steinprove {...prove} bergart="gneis" seed={6} />;
  const lupe = smal ? { x: 400, y: 455, r: 125 } : { x: 600, y: 140, r: 115 };
  // Et sted midt på forsiden av steinen, der båndene synes godt
  const fra = g ? { x: g.venstre + 0.42 * g.bredde, y: g.topp + 0.55 * g.hoyde } : undefined;
  return (
    <g>
      <Underlag x1={0} x2={800} y={prove.y} depth={smal ? 30 : 50} type="labbenk" />
      {stein}
      {fra && (
        <Lupe x={lupe.x} y={lupe.y} r={lupe.r} fra={fra} forstorr={{ faktor: 3 }} tekst={smal ? undefined : 'Bånd av lyse og mørke mineraler'}>
          {stein}
        </Lupe>
      )}
    </g>
  );
}

/** Plassen til granittprøven under lupa: bredden, og bunnen så toppen av steinen står 24 enheter ned. */
function granittOppsett(f: number) {
  const smal = f > 1.3;
  const size = smal ? 470 : 380;
  const g0 = steinproveGeometri({ x: 0, y: 0, size, bergart: 'granitt', seed: 2 });
  const bunn = 24 + (g0?.hoyde ?? 200);
  return { stein: { x: smal ? 330 : 290, y: bunn, size }, bunn, H: bunn + (smal ? 50 : 60) };
}

/** Lupe med håndtak rett over en granittprøve: forstorr viser den samme steinen forstørret i linsa. */
function GranittUnderLupa({ f }: { f: number }) {
  const smal = f > 1.3;
  const { stein, bunn } = granittOppsett(f);
  const g = steinproveGeometri({ ...stein, bergart: 'granitt', seed: 2 });
  const scene = (
    <g>
      <Underlag x1={0} x2={800} y={bunn} depth={smal ? 40 : 50} type="tregulv" />
      <Steinprove {...stein} bergart="granitt" seed={2} />
    </g>
  );
  const lx = g ? g.venstre + 0.68 * g.bredde : 450;
  const ly = g ? g.topp + 0.4 * g.hoyde : 160;
  return (
    <g>
      {scene}
      <Lupe x={lx} y={ly} r={smal ? 100 : 88} handtak={35} forstorr={{ faktor: 2.4 }}>
        {scene}
      </Lupe>
    </g>
  );
}

/* ---------------------------------------------------------------- Kornkurve */

const SIKTER = [16, 8, 4, 2, 1, 0.5, 0.25, 0.125, 0.063];

function Sikteanalyse() {
  const kurve = kumulativKurve(SIKTER, [0, 18, 46, 92, 140, 168, 120, 52, 22], 12) ?? [];
  return <Kornkurve kurver={[{ punkter: kurve, navn: 'Prøve A: grusig sand' }]} persentiler={[10, 30, 60]} sikter={SIKTER} dMin={0.01} dMax={100} />;
}

function TreKurver() {
  const ds = Array.from({ length: 81 }, (_, i) => 10 ** (-3 + (5 * i) / 80));
  return (
    <Kornkurve
      kurver={[
        { punkter: lognormalKurve(0.3, 0.35, ds) ?? [], navn: 'Strandsand (godt sortert)' },
        { punkter: lognormalKurve(1.2, 1, ds) ?? [], navn: 'Breelvavsetning' },
        { punkter: lognormalKurve(0.5, 2.6, ds) ?? [], navn: 'Morene (dårlig sortert)', stiplet: true },
      ]}
    />
  );
}

/* ---------------------------------------------------------------- Krystall */

const KRYSTALLER: MineralId[] = ['kvarts', 'zirkon', 'kalkspat', 'pyritt', 'halitt', 'blyglans', 'magnetitt', 'flusspat', 'muskovitt', 'biotitt', 'sanidin', 'granat'];

function Krystaller({ f }: { f: number }) {
  const smal = f > 1.3;
  const k = Math.max(1, 0.85 * f);
  const kol = smal ? 3 : 6;
  const size = smal ? 60 : 86;
  const ned = (size * k) / 2 + 22;
  const rad = ned + 38 * f + (size * k) / 2 + 18;
  return (
    <g>
      {KRYSTALLER.map((m, i) => {
        const p = rute(i, kol, 800, rad, (size * k) / 2 + 22);
        const mm = MINERALER[m];
        return (
          <g key={m}>
            <Krystall x={p.x} y={p.y} mineral={m} size={size} skygge />
            <Txt x={p.x} y={p.y + ned} size={0.8} weight={600}>
              {stor(mm.navn)}
            </Txt>
            <Txt x={p.x} y={p.y + ned + 19 * f} size={0.68} muted>
              {mm.krystallform ? KRYSTALLFORM_NAVN[mm.krystallform] : ''}
            </Txt>
          </g>
        );
      })}
    </g>
  );
}

function krystallHoyde(f: number) {
  const smal = f > 1.3;
  const k = Math.max(1, 0.85 * f);
  const size = smal ? 60 : 86;
  const rad = (size * k) / 2 + 22 + 38 * f + (size * k) / 2 + 18;
  return Math.ceil(KRYSTALLER.length / (smal ? 3 : 6)) * rad + 10;
}

function Isotoper({ f }: { f: number }) {
  const smal = f > 1.3;
  const k = Math.max(1, 0.85 * f);
  const kol = smal ? 2 : 4;
  const size = smal ? 96 : 130;
  const ned = (size * k) / 2 + 22;
  const rad = ned + 40 * f + (size * k) / 2 + 20;
  return (
    <g>
      {[0, 1, 2, 3].map((n, i) => {
        const p = rute(i, kol, 800, rad, (size * k) / 2 + 16);
        const datter = 1 - 2 ** -n;
        return (
          <g key={n}>
            <Krystall x={p.x} y={p.y} mineral="zirkon" size={size} isotoper={{ n: 28, datter }} dreiing={30} helning={10} vipp={-8} />
            <Txt x={p.x} y={p.y + ned} size={0.8} weight={600}>
              {n === 0 ? 'Nydannet' : `${n} halveringstid${n > 1 ? 'er' : ''}`}
            </Txt>
            <Txt x={p.x} y={p.y + ned + 20 * f} size={0.7} muted>
              {`${fmt(100 * datter, Number.isInteger(100 * datter) ? 0 : 1)} % datterisotop`}
            </Txt>
          </g>
        );
      })}
    </g>
  );
}

function isotopHoyde(f: number) {
  const smal = f > 1.3;
  const k = Math.max(1, 0.85 * f);
  const size = smal ? 96 : 130;
  const rad = (size * k) / 2 + 22 + 40 * f + (size * k) / 2 + 20;
  return (smal ? 2 : 1) * rad + 6;
}

const VINKLER: { form: 'terning' | 'oktaeder' | 'prisme' | 'tavle' | 'romboeder' | 'dodekaeder'; tekst: string; dreiing?: number; helning?: number; vipp?: number; tone?: 'gra' | 'gronn' | 'brun' | 'gull' | 'fiolett' | 'rosa' }[] = [
  { form: 'terning', tekst: 'rett forfra, litt ovenfra (dreiing 0, helning 14)', dreiing: 0, helning: 14, tone: 'gra' },
  { form: 'terning', tekst: 'dreiing 45, helning 35', dreiing: 45, helning: 35, tone: 'gull' },
  { form: 'prisme', tekst: 'vipp −25 (lener seg)', vipp: -25, tone: 'fiolett' },
  { form: 'oktaeder', tekst: 'tone «gronn»', tone: 'gronn' },
  { form: 'romboeder', tekst: 'tone «brun»', tone: 'brun' },
  { form: 'tavle', tekst: 'tavle, helning 70', helning: 70, tone: 'rosa' },
];

function Vinkler({ f }: { f: number }) {
  const smal = f > 1.3;
  const k = Math.max(1, 0.85 * f);
  const kol = smal ? 3 : 6;
  const size = smal ? 56 : 78;
  const ned = (size * k) / 2 + 22;
  const rad = ned + 20 * f + (size * k) / 2 + 22;
  return (
    <g>
      {VINKLER.map((s, i) => {
        const p = rute(i, kol, 800, rad, (size * k) / 2 + 16);
        return (
          <g key={i}>
            <Krystall x={p.x} y={p.y} form={s.form} tone={s.tone} dreiing={s.dreiing} helning={s.helning} vipp={s.vipp} size={size} />
            <Txt x={p.x} y={p.y + ned} size={0.66} muted>
              {s.tekst}
            </Txt>
          </g>
        );
      })}
    </g>
  );
}

function vinkelHoyde(f: number) {
  const smal = f > 1.3;
  const k = Math.max(1, 0.85 * f);
  const size = smal ? 56 : 78;
  const rad = (size * k) / 2 + 22 + 20 * f + (size * k) / 2 + 22;
  return (smal ? 2 : 1) * rad + 4;
}

/* ---------------------------------------------------------------- Steinprove */

const MAGMATISKE_ALLE: BergartId[] = ['granitt', 'kvartsporfyr', 'ryolitt', 'dioritt', 'porfyritt', 'andesitt', 'gabbro', 'diabas', 'basalt', 'larvikitt', 'rombeporfyr', 'anortositt', 'peridotitt', 'obsidian', 'tuff'];

function Prover({ ider, f }: { ider: readonly BergartId[]; f: number }) {
  const smal = f > 1.3;
  const kol = smal ? 2 : 5;
  const rad = smal ? 280 : 172;
  return (
    <g>
      {ider.map((id, i) => {
        const p = rute(i, kol, 800, rad, smal ? 225 : 134);
        return (
          <g key={id}>
            <Steinprove x={p.x} y={p.y} bergart={id} size={smal ? 250 : 138} seed={i + 1} />
            <Txt x={p.x} y={p.y + 22 * f} size={0.8} weight={600}>
              {stor(BERGARTER[id].navn)}
            </Txt>
          </g>
        );
      })}
    </g>
  );
}

function proveHoyde(n: number, f: number) {
  const smal = f > 1.3;
  const kol = smal ? 2 : 5;
  const rad = smal ? 280 : 172;
  return Math.ceil(n / kol) * rad + (smal ? 40 : 30);
}

function Varianter({ f }: { f: number }) {
  const smal = f > 1.3;
  const v: { bergart: BergartId; tekst: string; form?: 'kantet' | 'rundslipt'; kornstorrelse?: number; fossiler?: boolean; blaerer?: boolean; seed?: number }[] = [
    { bergart: 'granitt', tekst: 'kornstorrelse 0,5', kornstorrelse: 0.5 },
    { bergart: 'granitt', tekst: 'kornstorrelse 1,8', kornstorrelse: 1.8 },
    { bergart: 'granitt', tekst: 'rundslipt', form: 'rundslipt', seed: 3 },
    { bergart: 'gneis', tekst: 'rundslipt gneis', form: 'rundslipt', seed: 5 },
    { bergart: 'basalt', tekst: 'uten blærer', blaerer: false },
    { bergart: 'kalkstein', tekst: 'uten fossiler', fossiler: false, seed: 2 },
  ];
  const kol = smal ? 2 : 3;
  const rad = smal ? 280 : 190;
  return (
    <g>
      {v.map((s, i) => {
        const p = rute(i, kol, 800, rad, smal ? 215 : 150);
        return (
          <g key={i}>
            <Steinprove x={p.x} y={p.y} bergart={s.bergart} form={s.form} kornstorrelse={s.kornstorrelse} fossiler={s.fossiler} blaerer={s.blaerer} size={smal ? 250 : 200} seed={s.seed ?? 1} />
            <Txt x={p.x} y={p.y + 22 * f} size={0.75} muted>
              {s.tekst}
            </Txt>
          </g>
        );
      })}
    </g>
  );
}

/* ---------------------------------------------------------------- Ytterpunkter */

function Ytterpunkter({ f }: { f: number }) {
  const smal = f > 1.3;
  return (
    <g>
      <Kornpakning x={smal ? 200 : 110} y={110} r={95} sortering={0} rundhet={1} seed={1} />
      <Txt x={smal ? 200 : 110} y={226} size={0.7} muted>
        sortering 0, rundhet 1
      </Txt>
      <Kornpakning x={smal ? 600 : 320} y={110} r={95} sortering={3} rundhet={0} seed={2} type="morene" />
      <Txt x={smal ? 600 : 320} y={226} size={0.7} muted>
        sortering 3, rundhet 0
      </Txt>
      <g transform={smal ? 'translate(-380 270)' : undefined}>
        <Kornpakning x={530} y={110} w={150} h={150} korn={5} fyll="olje" seed={3} />
        <Txt x={530} y={226} size={0.7} muted>
          rute, korn 5
        </Txt>
        <Krystall x={650} y={70} mineral="pyritt" size={14} />
        <Krystall x={700} y={70} mineral="kvarts" size={14} />
        <Korn x={750} y={70} d={6} rundhet={0} />
        <Steinprove x={700} y={180} bergart="gneis" size={70} />
        <Lupe x={760} y={140} r={18} handtak={null}>
          <Korn x={0} y={0} d={20} fastStorrelse />
        </Lupe>
      </g>
    </g>
  );
}

/* ---------------------------------------------------------------- Galleriet */

export default function GalleriStein() {
  const sed = SEDIMENTARE;
  return (
    <GalleryGrid>
      <GalleryItem wide title="Korn: rundhet fra svært kantet til godt rundet" note="RUNDHETSKLASSER (Powers 1953). Kantete korn har fasetter med lys og skygge, runde korn glans. skygge gir kontaktskygge." viewBox={(f) => `0 0 800 ${f > 1.3 ? 370 : 170}`}>
        {(f) => <RundhetRad f={f} />}
      </GalleryItem>
      <GalleryItem wide title="Korn: bergartsfarger, avlange korn og flekker" note="type gir GEO.bergart-fargen, avlang={0.5–0.6}, flekker={4–6} (mørke mineraler i granitt og gneis)." viewBox={(f) => `0 0 800 ${f > 1.3 ? 360 : 160}`}>
        {(f) => <KornTyper f={f} />}
      </GalleryItem>
      <GalleryItem wide title="Korn på et underlag i fast målestokk" note="1 enhet = 1 mm. anker='bunn' (kornet ligger på y), fastStorrelse (vokser ikke på mobil) og skygge. Sand er under 2 mm og nesten usynlig i denne målestokken." viewBox={(f) => `0 0 800 ${kornBakkeHoyde(f)}`}>
        {(f) => <KornPaaBakken f={f} />}
      </GalleryItem>
      {PAKNINGER.map((p) => (
        <GalleryItem key={p.title} viewBox="0 0 400 308" title={`Kornpakning: ${/^[A-ZÆØÅ][a-zæøå]/.test(p.title) ? p.title.charAt(0).toLowerCase() + p.title.slice(1) : p.title}`} note={p.note}>
          <PakningRute props={p.props} />
        </GalleryItem>
      ))}
      <GalleryItem
        wide
        title="Lupe over en steinprøve: sandstein med korn, porer og sement"
        note="Lupe med fra (ring og streker ut til linsa), malestokk og en Kornpakning (ramme={false}) i linsas koordinater. steinproveGeometri(…).midt gir midten av toppflaten."
        viewBox={(f) => `0 0 800 ${f > 1.3 ? 640 : 330}`}
      >
        {(f) => <SandsteinUnderLupa f={f} />}
      </GalleryItem>
      <GalleryItem
        wide
        title="Lupe med fra og forstorr: gneis forstørret tre ganger"
        note="forstorr={{ faktor: 3 }} med fra: punktet er midten av fra, og ringen får radiusen r / 3 og viser nøyaktig utsnittet. children er den samme steinprøven."
        viewBox={(f) => `0 0 800 ${f > 1.3 ? 600 : 300}`}
      >
        {(f) => <GneisMedFra f={f} />}
      </GalleryItem>
      <GalleryItem wide title="Lupe med håndtak over granitt" note="stil='lupe' (standard uten fra), handtak={35} grader og forstorr={{ faktor: 2.4 }}: children er den samme scenen i figurens koordinater, forstørret rundt midten av lupa." viewBox={(f) => `0 0 800 ${granittOppsett(f).H}`}>
        {(f) => <GranittUnderLupa f={f} />}
      </GalleryItem>
      <GalleryItem wide title="Kornkurve: sikteanalyse med d₁₀, d₃₀ og d₆₀" note="kumulativKurve(sikter, masser, bunn), persentiler={[10, 30, 60]} og sikter (stiplede streker). Båndene har fargene til mønstrene." viewBox={(f) => `0 0 800 ${geoHoyde(f, 340)}`}>
        <Sikteanalyse />
      </GalleryItem>
      <GalleryItem wide title="Kornkurve: tre lognormale kurver med forklaring" note="lognormalKurve(d50, σ): strandsand σ = 0,35, breelvavsetning σ = 1, morene σ = 2,6 (stiplet)." viewBox={(f) => `0 0 800 ${geoHoyde(f, 340)}`}>
        <TreKurver />
      </GalleryItem>
      <GalleryItem wide title="Krystall: formene med mineralfarge og glans" note="mineral gir form, tone og glans fra MINERALER: kvarts og zirkon (prisme), kalkspat (romboeder), pyritt med striper, halitt og blyglans (terning), magnetitt og flusspat (oktaeder), glimmer og sanidin (tavle), granat (rombedodekaeder)." viewBox={(f) => `0 0 800 ${krystallHoyde(f)}`}>
        {(f) => <Krystaller f={f} />}
      </GalleryItem>
      <GalleryItem wide title="Krystall med isotopprikker: zirkon etter 0 til 3 halveringstider" note="isotoper={{ n: 28, datter }}: de samme prikkene farges om i fast rekkefølge (GEO.morIsotop og GEO.datterIsotop)." viewBox={(f) => `0 0 800 ${isotopHoyde(f)}`}>
        {(f) => <Isotoper f={f} />}
      </GalleryItem>
      <GalleryItem wide title="Krystall: dreiing, helning, vipp og tone" viewBox={(f) => `0 0 800 ${vinkelHoyde(f)}`}>
        {(f) => <Vinkler f={f} />}
      </GalleryItem>
      <GalleryItem wide title="Steinprove: magmatiske bergarter" note="Grovkornet mosaikk (dypbergarter), porfyr (rombeporfyr med romber), glass (obsidian), blærer (basalt) og blått skimmer (larvikitt)." viewBox={(f) => `0 0 800 ${proveHoyde(MAGMATISKE_ALLE.length, f)}`}>
        {(f) => <Prover ider={MAGMATISKE_ALLE} f={f} />}
      </GalleryItem>
      <GalleryItem wide title="Steinprove: sedimentære bergarter" note="Klaster (konglomerat, breksje), lag, fossiler (ortoceratitt, armfoting og trilobitt i kalkstein, graptolitter i leirskifer) og kull." viewBox={(f) => `0 0 800 ${proveHoyde(sed.length, f)}`}>
        {(f) => <Prover ider={sed} f={f} />}
      </GalleryItem>
      <GalleryItem wide title="Steinprove: metamorfe bergarter" note="Foliasjon med glimmerglans og granater (glimmerskifer), bånd (gneis), sukkerkornet mosaikk (kvartsitt, marmor med årer)." viewBox={(f) => `0 0 800 ${proveHoyde(METAMORFE.length, f)}`}>
        {(f) => <Prover ider={METAMORFE} f={f} />}
      </GalleryItem>
      <GalleryItem wide title="Steinprove: kornstørrelse, rundslipt og uten fossiler eller blærer" viewBox={(f) => `0 0 800 ${f > 1.3 ? 3 * 280 + 20 : 2 * 190 + 10}`}>
        {(f) => <Varianter f={f} />}
      </GalleryItem>
      <GalleryItem wide title="Ytterpunkter" note="sortering 0 og 3, rundhet 0 og 1, rektangulært utsnitt med små korn, krystaller på 14 enheter (vokser på mobil), liten steinprøve og en lupe med r = 18." viewBox={(f) => `0 0 800 ${f > 1.3 ? 520 : 250}`}>
        {(f) => <Ytterpunkter f={f} />}
      </GalleryItem>
    </GalleryGrid>
  );
}
