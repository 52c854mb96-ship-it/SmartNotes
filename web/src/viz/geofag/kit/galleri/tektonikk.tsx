/**
 * Galleri for tektonikkfamilien (?galleri=geo-tektonikk): JordasIndre (kile og helt snitt, kjemisk og mekanisk
 * inndeling, dybdemarkør, markert lag, riktige forhold), Plategrense (spredning med magnetiske striper og tid,
 * subduksjon hav–kontinent og hav–hav med kraftpiler ved ankerpunktene, kollisjon, varmt punkt med vulkankjede,
 * transform ovenfra, flatt snitt og ytterpunkter) og Vulkan (strato og skjold, utbrudd, erodert, i snitt med etiketter).
 */
import { useTextScale } from '../../../kit/controls';
import { VIZ } from '../../../kit/colors';
import { ForceArrow } from '../../../kit/scene/overlay';
import { Txt } from '../../../kit/txt';
import { JordasIndre, Plategrense, Vulkan, plategrenseGeometri, vulkanGeometri, type PlategrenseGeometri, type PlategrenseProps, type VulkanProps } from '../tektonikk';
import { GalleryGrid, GalleryItem } from './felles';

const r2 = (v: number) => Math.round(v * 100) / 100;

/* ---------------------------------------------------------------- Plategrense i en rute */

type PlateOppsett = Omit<PlategrenseProps, 'x' | 'y' | 'w' | 'h' | 'children'> & { hAndel?: number };

/** Plasserer en Plategrense i en rute som er `B` bred: blokka fyller bredden, og høyden følger rammen. */
function plateOppsett(o: PlateOppsett, B: number, f: number) {
  const marg = 14;
  // Høyere blokk på mobil, så etikettene får plass i lagene
  const hAndel = (o.hAndel ?? 0.4) * (1 + 0.22 * Math.max(0, f - 1));
  let w = B - 2 * marg;
  let g = plategrenseGeometri({ ...o, x: marg, y: 0, w, h: w * hAndel }, f);
  if (g && g.dx > 0) {
    w = B - 2 * marg - g.dx;
    g = plategrenseGeometri({ ...o, x: marg, y: 0, w, h: w * hAndel }, f);
  }
  const h = w * hAndel;
  const y = g ? 10 - g.ramme.y0 : 10;
  const H = g ? r2(g.ramme.y1 - g.ramme.y0 + 20) : h + 20;
  return { props: { ...o, x: marg, y, w, h } as PlategrenseProps, H };
}

function PlateRute({ title, note, oppsett, wide = true, extra }: { title: string; note?: string; oppsett: PlateOppsett; wide?: boolean; extra?: PlategrenseProps['children'] }) {
  const B = wide ? 800 : 400;
  return (
    <GalleryItem title={title} note={note} wide={wide} viewBox={(f) => `0 0 ${B} ${plateOppsett(oppsett, B, f).H}`}>
      {(f) => {
        const { props } = plateOppsett(oppsett, B, f);
        return <Plategrense {...props}>{extra}</Plategrense>;
      }}
    </GalleryItem>
  );
}

/** Kraftpiler ved ankerpunktene: ryggskyv (VIZ.applied) og platetrekk (VIZ.gravity), som kapitlene kan tegne dem. */
function Krefter({ g }: { g: PlategrenseGeometri }) {
  const f = useTextScale();
  const L = 0.09 * g.w;
  const smal = f > 1.4;
  return (
    <g>
      {(['ryggskyvVenstre', 'ryggskyvHoyre'] as const).map((n) => {
        const a = g.ankere[n];
        if (!a?.retning) return null;
        return (
          <ForceArrow
            key={n}
            x1={a.x}
            y1={a.y}
            x2={a.x + L * a.retning[0]}
            y2={a.y + L * a.retning[1]}
            color={VIZ.applied}
            width={6}
            label={smal ? undefined : 'Ryggskyv'}
            labelSize={0.7}
            origin
          />
        );
      })}
      {g.ankere.platetrekk?.retning && (
        <ForceArrow
          x1={g.ankere.platetrekk.x}
          y1={g.ankere.platetrekk.y}
          x2={g.ankere.platetrekk.x + 1.3 * L * g.ankere.platetrekk.retning[0]}
          y2={g.ankere.platetrekk.y + 1.3 * L * g.ankere.platetrekk.retning[1]}
          color={VIZ.gravity}
          width={7}
          label="Platetrekk"
          labelSize={0.7}
          origin
        />
      )}
    </g>
  );
}

const krefter: PlategrenseProps['children'] = (g) => <Krefter g={g} />;

/* ---------------------------------------------------------------- Vulkan i en rute */

function vulkanOppsett(v: Omit<VulkanProps, 'x' | 'y'>, B: number, f: number, kolonne = 0) {
  const g0 = vulkanGeometri({ ...v, x: 0, y: 0 });
  if (!g0) return { props: { ...v, x: B / 2, y: 100 } as VulkanProps, H: 200 };
  const bredde = g0.ramme.x1 - g0.ramme.x0;
  const plass = B - 24 - kolonne * f;
  const skala = Math.min(1, plass / bredde);
  const v2 = { ...v, bredde: v.bredde * skala, ...(v.dyp ? { dyp: v.dyp * skala } : {}), ...(v.askeHoyde ? { askeHoyde: v.askeHoyde * skala } : {}) };
  const g = vulkanGeometri({ ...v2, x: 0, y: 0 })!;
  const x = 12 - g.ramme.x0 + Math.max(0, (plass - (g.ramme.x1 - g.ramme.x0)) / 2);
  const y = 12 - g.ramme.y0;
  return { props: { ...v2, x, y } as VulkanProps, H: r2(g.ramme.y1 - g.ramme.y0 + 24) };
}

function VulkanRute({ title, note, vulkan, wide = false, kolonne = 0 }: { title: string; note?: string; vulkan: Omit<VulkanProps, 'x' | 'y'>; wide?: boolean; kolonne?: number }) {
  const B = wide ? 800 : 400;
  return (
    <GalleryItem title={title} note={note} wide={wide} viewBox={(f) => `0 0 ${B} ${vulkanOppsett(vulkan, B, f, kolonne).H}`}>
      {(f) => <Vulkan {...vulkanOppsett(vulkan, B, f, kolonne).props} />}
    </GalleryItem>
  );
}

/* ---------------------------------------------------------------- Galleriet */

export default function TektonikkGalleri() {
  return (
    <GalleryGrid>
      {/* ---------- Jordas indre ---------- */}
      <GalleryItem title="Jordas indre: kile, kjemisk inndeling" note="form='kile', etiketter, undertekst med dypet" viewBox={(f) => `0 0 400 ${f > 1.3 ? 470 : 280}`}>
        {(f) =>
          f > 1.3 ? (
            <JordasIndre x={200} y={135} r={120} etiketter etikettX={20} />
          ) : (
            <JordasIndre x={135} y={140} r={118} etiketter />
          )
        }
      </GalleryItem>
      <GalleryItem title="Mekanisk inndeling med dybdemarkør" note="inndeling='mekanisk', dybde={2891}, etiketter uten undertekst" viewBox={(f) => `0 0 400 ${f > 1.3 ? 430 : 280}`}>
        {(f) =>
          f > 1.3 ? (
            <JordasIndre x={200} y={135} r={120} inndeling="mekanisk" dybde={2891} etiketter undertekst={false} etikettX={20} />
          ) : (
            <JordasIndre x={135} y={140} r={118} inndeling="mekanisk" dybde={2891} etiketter undertekst={false} />
          )
        }
      </GalleryItem>
      <GalleryItem title="Helt snitt og markert lag" note="form='snitt' med markert='ytreKjerne', og overflate='stein' med dybde={660}" viewBox="0 0 400 240">
        <JordasIndre x={105} y={120} r={95} form="snitt" markert="ytreKjerne" />
        <JordasIndre x={300} y={120} r={88} overflate="stein" dybde={660} dybdeTekst="660 km" />
      </GalleryItem>
      <GalleryItem title="Riktige forhold og en liten kule" note="riktigeForhold (skorpa blir en hårfin strek), r = 40 og r = 24 (skorpa høyst 6 % av radien)" viewBox="0 0 400 220">
        <JordasIndre x={95} y={110} r={88} form="snitt" riktigeForhold />
        <JordasIndre x={250} y={110} r={40} />
        <JordasIndre x={340} y={110} r={24} form="snitt" inndeling="mekanisk" />
        <Txt x={95} y={212} size={0.7} muted>
          riktige forhold
        </Txt>
      </GalleryItem>

      {/* ---------- Spredning ---------- */}
      <PlateRute
        title="Spredning med magnetiske striper (t = 5)"
        note="type='spredning', striper, fart 4 cm/år (langsom rygg med riftdal), etiketter og kraftpiler ved ankerpunktene ryggskyvVenstre/ryggskyvHoyre"
        oppsett={{ type: 'spredning', striper: true, t: 5, fart: 4, etiketter: true }}
        extra={krefter}
      />
      <PlateRute title="Spredning etter 1,5 millioner år" note="t = 1,5: stripene vokser ut fra ryggen" oppsett={{ type: 'spredning', striper: true, t: 1.5, fart: 4 }} wide={false} />
      <PlateRute title="Rask rygg uten riftdal" note="fart 12 cm/år, uten striper, strøm og skjelv" oppsett={{ type: 'spredning', fart: 12, strom: false, skjelv: false }} wide={false} />

      {/* ---------- Subduksjon ---------- */}
      <PlateRute
        title="Subduksjon: hav mot kontinent"
        note="havgrop, akkresjonskile, skjelvsone, smelting i mantelkilen, diapirer, magmakammer og vulkan; platetrekk ved ankerpunktet"
        oppsett={{ type: 'subduksjon', etiketter: true, hAndel: 0.42 }}
        extra={krefter}
      />
      <PlateRute title="Subduksjon: hav mot hav (øybue)" note="variant='hav-hav', etiketter" oppsett={{ type: 'subduksjon', variant: 'hav-hav', etiketter: true, hAndel: 0.42 }} />

      {/* ---------- Kollisjon ---------- */}
      <PlateRute title="Kollisjon mellom to kontinenter" note="foldede lag, skyveforkastninger, sutur, fjellrot og grunne skjelv" oppsett={{ type: 'kollisjon', etiketter: true, hAndel: 0.42 }} />

      {/* ---------- Varmt punkt ---------- */}
      <PlateRute title="Varmt punkt inne på en plate" note="mantelplume, aktiv vulkan og eldre øyer som eroderes og synker (guyot), alder over vulkanene" oppsett={{ type: 'varmt-punkt', etiketter: true, hAndel: 0.42 }} />
      <PlateRute title="Varmt punkt, langsom plate" note="fart 3 cm/år, t = 2" oppsett={{ type: 'varmt-punkt', fart: 3, t: 2 }} wide={false} />
      <PlateRute title="Varmt punkt uten magma" note="magma={false}, aldre={false}, dybde 40" oppsett={{ type: 'varmt-punkt', magma: false, aldre: false, dybde: 40 }} wide={false} />

      {/* ---------- Transform ---------- */}
      <PlateRute title="Transformforkastning ovenfra" note="type='transform' med striper og etiketter: aktiv forkastning mellom ryggene, bruddsoner utenfor" oppsett={{ type: 'transform', striper: true, etiketter: true, hAndel: 0.62 }} wide={false} />
      <PlateRute title="Transform uten striper" note="fart 10 cm/år, t = 3 (åsryggene flytter seg utover)" oppsett={{ type: 'transform', fart: 10, t: 3, hAndel: 0.62 }} wide={false} />

      {/* ---------- Ytterpunkter ---------- */}
      <PlateRute title="Flatt snitt" note="dybde={0}: bare snittet foran" oppsett={{ type: 'subduksjon', dybde: 0 }} wide={false} />
      <PlateRute title="Ytterpunkter: fart 0 og t 0" note="spredning med striper uten bevegelse (ingen striper, ingen piler)" oppsett={{ type: 'spredning', fart: 0, t: 0, striper: true }} wide={false} />
      <PlateRute title="Ytterpunkter: fart 30, t 100" note="kollisjon med lange piler (taket 0,35 · w) og varmt punkt" oppsett={{ type: 'kollisjon', fart: 30, t: 100 }} wide={false} />
      <PlateRute title="Ytterpunkter: varmt punkt, fart 30" note="tett kjede og mange gamle guyoter" oppsett={{ type: 'varmt-punkt', fart: 30, t: 100 }} wide={false} />

      {/* ---------- Vulkaner ---------- */}
      <VulkanRute title="Stratovulkan i utbrudd" note="type='strato', utbrudd 0,8, vind 0,4: askesky med askeregn, glød og lavastrøm" vulkan={{ type: 'strato', bredde: 300, utbrudd: 0.8, vind: 0.4 }} />
      <VulkanRute title="Skjoldvulkan med lavafontene" note="type='skjold', utbrudd 0,7: lavafontene og lang lavastrøm" vulkan={{ type: 'skjold', bredde: 340, utbrudd: 0.7 }} />
      <VulkanRute title="Stratovulkan i ro, med snø" note="utbrudd 0, sno" vulkan={{ type: 'strato', bredde: 300, sno: true }} />
      <VulkanRute title="Erodert stratovulkan" note="erosjon 0,85: lavere, bredt krater og dype raviner" vulkan={{ type: 'strato', bredde: 300, erosjon: 0.85 }} />
      <VulkanRute
        title="Stratovulkan i snitt"
        note="snitt, utbrudd 0,5, etiketter: lag av lava og aske, hovedkanal, sidekanal, lagergang og magmakammer"
        vulkan={{ type: 'strato', bredde: 300, snitt: true, utbrudd: 0.5, etiketter: true, vind: -0.3 }}
        wide
        kolonne={190}
      />
      <VulkanRute title="Skjoldvulkan i snitt" note="snitt, utbrudd 0,6 med lavafontene og lavastrøm, etiketter" vulkan={{ type: 'skjold', bredde: 380, snitt: true, utbrudd: 0.6, etiketter: true }} wide kolonne={170} />
      <VulkanRute title="Utdødd vulkan i snitt" note="erosjon 0,8 uten utbrudd: kammeret og kanalene er størknet" vulkan={{ type: 'strato', bredde: 260, snitt: true, erosjon: 0.8 }} />
      <VulkanRute title="Ytterpunkter: liten og svak" note="bredde 90, utbrudd 0,1" vulkan={{ type: 'strato', bredde: 90, utbrudd: 0.1 }} />
      <VulkanRute title="Ytterpunkter: fullt utbrudd uten krater" note="krater={false}, utbrudd 1, vind −1, askeHoyde 1,6 · høyden" vulkan={{ type: 'strato', bredde: 200, utbrudd: 1, vind: -1, krater: false, askeHoyde: 115 }} />
      <VulkanRute title="Ytterpunkter: skjold i snitt, fullt utbrudd" note="erosjon 1 og utbrudd 1 (kammeret glør, lavastrømmen når foten)" vulkan={{ type: 'skjold', bredde: 260, snitt: true, utbrudd: 1, erosjon: 1 }} />
    </GalleryGrid>
  );
}
