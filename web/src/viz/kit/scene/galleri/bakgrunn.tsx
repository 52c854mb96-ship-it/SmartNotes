/**
 * Galleri for familien «bakgrunn»: himmel, landskap, trær, underlag, terreng, vei, rom og vann i små scener,
 * med kraftpiler oppå så du ser at de fortsatt synes.
 *   http://localhost:5173/viz-preview.html?galleri=bakgrunn&theme=dark
 */
import { VIZ } from '../../colors';
import { Txt } from '../../txt';
import { Gran, Himmel, Landskap, Lauvtre, Rom, Terreng, UNDERLAG_NAVN, Underlag, Vann, Vei, type LandskapType, type UnderlagType } from '../bakgrunn';
import { ContactShadow, LinearGradient, Place, RadialGradient, materialStops, shade, sphereStops, useStrokeScale, useSvgId } from '../core';
import { ForceArrow, ValueTag } from '../overlay';
import { PAINTS, SCENE } from '../palette';
import { GalleryGrid, GalleryItem } from './felles';

/** Enkel trekasse (bare i galleriet), med ankerpunktet midt på bunnen. */
function Boks({ x, y, w = 70, h = 50, rotate = 0 }: { x: number; y: number; w?: number; h?: number; rotate?: number }) {
  const id = useSvgId('g-kasse');
  const ss = useStrokeScale();
  return (
    <Place x={x} y={y} rotate={rotate}>
      <ContactShadow cx={0} cy={0} rx={w * 0.6} />
      <LinearGradient id={id} stops={materialStops(SCENE.wood)} />
      <rect x={-w / 2} y={-h} width={w} height={h} rx={3} fill={`url(#${id})`} stroke={SCENE.outline} strokeWidth={ss} />
      <path d={`M${-w / 2 + 6},${-h + 6}H${w / 2 - 6}M${-w / 2 + 6},-6H${w / 2 - 6}`} stroke={SCENE.woodDark} strokeWidth={1.2 * ss} opacity={0.6} />
    </Place>
  );
}

/** Enkel bilsilhuett (bare i galleriet) for å se hvor bilen står på veien. Ankerpunkt: midt mellom hjulene på bakken. */
function Bilskisse({ x, y, s = 1 }: { x: number; y: number; s?: number }) {
  const ss = useStrokeScale();
  const id = useSvgId('g-bil');
  return (
    <Place x={x} y={y} scale={s}>
      <ContactShadow cx={0} cy={0} rx={70} />
      <LinearGradient id={id} stops={materialStops(PAINTS.rod)} />
      <path d="M-78,-14 L-76,-34 Q-70,-40 -52,-42 L-34,-60 Q-28,-64 -12,-64 L30,-64 Q40,-64 48,-56 L62,-42 Q78,-40 80,-30 L80,-14 Z" fill={`url(#${id})`} stroke={SCENE.outline} strokeWidth={ss} />
      <path d="M-28,-44 L-16,-58 L10,-58 L10,-44 Z M16,-44 L16,-58 L36,-58 L50,-44 Z" fill={SCENE.glass} stroke={SCENE.outline} strokeWidth={0.8 * ss} />
      {[-50, 50].map((wx) => (
        <g key={wx}>
          <circle cx={wx} cy={-14} r={14} fill={SCENE.rubber} stroke={SCENE.outline} strokeWidth={ss} />
          <circle cx={wx} cy={-14} r={6.5} fill={SCENE.metal} />
        </g>
      ))}
    </Place>
  );
}

function Ball({ x, y, r = 14 }: { x: number; y: number; r?: number }) {
  const id = useSvgId('g-ball');
  const ss = useStrokeScale();
  return (
    <>
      <RadialGradient id={id} stops={sphereStops(PAINTS.blaa)} fx={0.35} fy={0.3} />
      <circle cx={x} cy={y} r={r} fill={`url(#${id})`} stroke={SCENE.outline} strokeWidth={ss} />
    </>
  );
}

/** Bakgrunn for én rute i oversikten over underlagene: himmel ute og vegg inne. */
function CellBackdrop({ x, y, w, h, inside }: { x: number; y: number; w: number; h: number; inside: boolean }) {
  const id = useSvgId('g-celle');
  return (
    <>
      <LinearGradient
        id={id}
        stops={
          inside
            ? [
                [0, SCENE.wallShade],
                [1, SCENE.wall],
              ]
            : [
                [0, SCENE.skyTop],
                [1, SCENE.skyBottom],
              ]
        }
      />
      <rect x={x} y={y} width={w} height={h} fill={`url(#${id})`} />
    </>
  );
}

const ALLE: UnderlagType[] = ['asfalt', 'vaat-asfalt', 'sno', 'is', 'gress', 'grus', 'betong', 'tregulv', 'jord', 'labbenk'];
const LANDSKAP: { type: LandskapType; tittel: string; underlag: UnderlagType; sol?: boolean }[] = [
  { type: 'fjell', tittel: 'Landskap: fjell (med snø og granskog i liene)', underlag: 'gress', sol: true },
  { type: 'aaser', tittel: 'Landskap: åser med granholt og gård', underlag: 'jord' },
  { type: 'skog', tittel: 'Landskap: skog i tre lag', underlag: 'grus' },
  { type: 'by', tittel: 'Landskap: by (tente vinduer i mørkt tema)', underlag: 'asfalt' },
  { type: 'kyst', tittel: 'Landskap: kyst og fjord med speilbilde', underlag: 'betong', sol: true },
];

/** Overflaten i berg-og-dal-banen (y for x mellom 0 og 520). */
function bakke(x: number): number {
  return 190 - 60 * Math.cos((x / 520) * Math.PI * 2.2) * (1 - x / 900);
}

/** Bakkeprofil for berg-og-dal-banen: mange punkter og en bratt kant. */
function bergOgDal(): [number, number][] {
  const pts: [number, number][] = [];
  for (let i = 0; i <= 60; i++) {
    const x = (i / 60) * 520;
    pts.push([x, bakke(x)]);
  }
  pts.push([540, 150], [548, 240], [600, 252], [680, 238], [800, 230]);
  return pts;
}

/** Midten av en kule med radius r som ligger på bakken i x (langs normalen), og retningen langs bakken. */
function paaBakken(x: number, r: number) {
  const d = bakke(x + 0.5) - bakke(x - 0.5);
  const n = Math.hypot(d, 1);
  return { cx: x + (r * d) / n, cy: bakke(x) - r / n, tx: 1 / n, ty: d / n };
}

export default function Galleri() {
  return (
    <GalleryGrid>
      <GalleryItem title="Sommerdag: himmel, fjell, gress, trær og kraftpiler" viewBox="0 0 800 340">
        <Himmel w={800} h={340} sol={{ x: 120, y: 64 }} skyer={3} />
        <Landskap x={0} y={210} w={800} h={160} type="fjell" />
        <Underlag x1={0} x2={800} y={272} depth={68} type="gress" horisont={210} />
        <Gran x={690} y={236} size={95} seed={2} />
        <Gran x={735} y={244} size={120} seed={3} />
        <Lauvtre x={110} y={268} size={160} epler />
        <Boks x={420} y={272} w={90} h={64} />
        <ForceArrow x1={420} y1={240} x2={420} y2={320} color={VIZ.gravity} label="G" origin />
        <ForceArrow x1={420} y1={272} x2={420} y2={192} color={VIZ.normal} label="N" />
        <ForceArrow x1={465} y1={245} x2={560} y2={245} color={VIZ.applied} label="F" />
      </GalleryItem>

      {LANDSKAP.map((l) => (
        <GalleryItem key={l.type} title={l.tittel} viewBox="0 0 800 230">
          <Himmel w={800} h={230} sol={l.sol ? { x: 640, y: 50 } : undefined} skyer={2} seed={3} />
          <Landskap x={0} y={172} w={800} h={150} type={l.type} />
          <Underlag x1={0} x2={800} y={198} depth={32} type={l.underlag} horisont={172} />
        </GalleryItem>
      ))}

      <GalleryItem title="Underlag: alle ti typer (UNDERLAG_NAVN)" viewBox="0 0 800 620">
        {ALLE.map((type, i) => {
          const cx = (i % 2) * 400;
          const cy = Math.floor(i / 2) * 124;
          const inside = type === 'tregulv' || type === 'labbenk';
          return (
            <g key={type}>
              <CellBackdrop x={cx} y={cy} w={400} h={124} inside={inside} />
              <Underlag x1={cx + 8} x2={cx + 392} y={cy + 84} depth={32} type={type} seed={i + 1} />
              <Boks x={cx + 300} y={cy + 84} w={56} h={40} />
              <Txt x={cx + 16} y={cy + 30} anchor="start" size={0.9}>
                {UNDERLAG_NAVN[type]}
              </Txt>
            </g>
          );
        })}
      </GalleryItem>

      <GalleryItem title="Kasse på is (horisont: underlaget fyller opp til åsene)" viewBox="0 0 800 280">
        <Himmel w={800} h={280} skyer={2} seed={7} />
        {/* Frøet legger gården til venstre, så den ikke titter fram bak kassa og pilene. */}
        <Landskap x={0} y={168} w={800} h={110} type="aaser" seed={13} />
        <Underlag x1={0} x2={800} y={222} depth={58} type="is" horisont={168} />
        <Boks x={360} y={222} w={96} h={70} />
        <ForceArrow x1={360} y1={187} x2={360} y2={262} color={VIZ.gravity} label="G" origin />
        <ForceArrow x1={360} y1={222} x2={360} y2={147} color={VIZ.normal} label="N" />
        <ForceArrow x1={408} y1={190} x2={540} y2={190} color={VIZ.applied} label="F" />
        <ForceArrow x1={312} y1={217} x2={290} y2={217} color={VIZ.friction} label="R" />
      </GalleryItem>

      <GalleryItem title="Terreng: akebakke i snø (glatt, 8 punkter) med kraftpiler langs bakken" viewBox="0 0 800 320">
        <Himmel w={800} h={320} skyer={2} seed={4} />
        <Landskap x={0} y={170} w={800} h={120} type="skog" seed={2} />
        <Underlag x1={0} x2={800} y={300} depth={20} type="sno" horisont={170} />
        <Terreng
          points={[
            [0, 112],
            [130, 116],
            [260, 150],
            [340, 186],
            [420, 222],
            [560, 268],
            [680, 284],
            [800, 286],
          ]}
          bottom={320}
          type="sno"
          glatt
        />
        <Gran x={60} y={118} size={92} sno seed={5} />
        <Gran x={112} y={120} size={70} sno seed={6} />
        <Boks x={340} y={186} w={64} h={34} rotate={24.2} />
        <ForceArrow x1={334} y1={169} x2={334} y2={249} color={VIZ.gravity} label="G" origin />
        <ForceArrow x1={340} y1={186} x2={310} y2={119} color={VIZ.normal} label="N" />
        <ForceArrow x1={312} y1={173} x2={276} y2={157} color={VIZ.friction} label="R" />
      </GalleryItem>

      <GalleryItem title="Terreng: berg-og-dal-bane i gress med bratt kant (66 punkter)" viewBox="0 0 800 300">
        <Himmel w={800} h={300} sol={{ x: 700, y: 60 }} skyer={1} seed={2} />
        <Landskap x={0} y={262} w={800} h={170} type="aaser" seed={4} />
        <Terreng points={bergOgDal()} bottom={300} type="gress" />
        <Lauvtre x={640} y={250} size={120} sesong="host" />
        {(() => {
          const b = paaBakken(130, 15);
          return (
            <>
              <ContactShadow cx={130} cy={bakke(130)} rx={12} ry={2.5} />
              <Ball x={b.cx} y={b.cy} r={15} />
              <ForceArrow x1={b.cx} y1={b.cy} x2={b.cx + 85 * b.tx} y2={b.cy + 85 * b.ty} color={VIZ.velocity} label="v" width={6} />
            </>
          );
        })()}
      </GalleryItem>

      <GalleryItem title="Terreng som skråplan: tre, grus, asfalt, våt asfalt, jord og labbenk" viewBox="0 0 800 380">
        {(['tregulv', 'grus', 'asfalt', 'vaat-asfalt', 'jord', 'labbenk'] as UnderlagType[]).map((type, i) => {
          const cx = (i % 3) * 267;
          const cy = Math.floor(i / 3) * 190;
          const inside = type === 'tregulv' || type === 'labbenk';
          const ang = (Math.atan2(110, 230) * 180) / Math.PI;
          return (
            <g key={type}>
              <CellBackdrop x={cx} y={cy} w={267} h={190} inside={inside} />
              <Terreng
                points={[
                  [cx + 18, cy + 172],
                  [cx + 248, cy + 62],
                ]}
                bottom={cy + 190}
                type={type}
                seed={i + 2}
              />
              <Boks x={cx + 133} y={cy + 117} w={44} h={30} rotate={-ang} />
              <Txt x={cx + 12} y={cy + 26} anchor="start" size={0.8}>
                {UNDERLAG_NAVN[type]}
              </Txt>
            </g>
          );
        })}
      </GalleryItem>

      <GalleryItem title="Vei: tørr asfalt, våt asfalt, snø og is" viewBox="0 0 800 440">
        {(['asfalt', 'vaat-asfalt', 'sno', 'is'] as const).map((type, i) => {
          const cy = i * 110;
          return (
            <g key={type}>
              <Himmel y={cy} w={800} h={110} skyer={1} seed={i + 2} />
              <Landskap x={0} y={cy + 62} w={800} h={56} type={(['by', 'aaser', 'skog', 'fjell'] as const)[i]!} seed={i + 1} />
              <Vei x1={0} x2={800} y={cy + 86} type={type} horisont={cy + 62} depth={24} seed={i + 1} />
              <Bilskisse x={300} y={cy + 86} s={0.62} />
              <Txt x={14} y={cy + 24} anchor="start" size={0.8}>
                {UNDERLAG_NAVN[type]}
              </Txt>
            </g>
          );
        })}
        <ForceArrow x1={360} y1={110 + 60} x2={470} y2={110 + 60} color={VIZ.velocity} label="v" width={6} />
      </GalleryItem>

      <GalleryItem title="Forskyvning: veien og landskapet ruller (0, 300 og 600)" viewBox="0 0 800 390">
        {[0, 300, 600].map((s, i) => {
          const cy = i * 130;
          return (
            <g key={s}>
              <Himmel y={cy} w={800} h={130} skyer={2} seed={5} forskyvning={s} />
              <Landskap x={0} y={cy + 70} w={800} h={70} type="kyst" seed={2} forskyvning={s} />
              <Vei x1={0} x2={800} y={cy + 100} type="asfalt" bredde={30} horisont={cy + 70} depth={30} forskyvning={s} />
              <Bilskisse x={400} y={cy + 100} s={0.7} />
              <ValueTag x={400} y={cy + 26} text={`forskyvning ${s}`} />
            </g>
          );
        })}
      </GalleryItem>

      <GalleryItem title="Rom med tregulv og vindu" viewBox="0 0 800 320">
        <Rom x={0} y={0} w={800} h={320} gulvY={220} gulv="tre" vindu />
        <Boks x={300} y={276} w={110} h={80} />
        <ForceArrow x1={355} y1={236} x2={470} y2={236} color={VIZ.applied} label="F" />
        <ForceArrow x1={245} y1={270} x2={190} y2={270} color={VIZ.friction} label="R" />
      </GalleryItem>

      <GalleryItem title="Rom med fliser" viewBox="0 0 800 320">
        <Rom x={0} y={0} w={800} h={320} gulvY={200} gulv="fliser" vindu vinduX={180} />
        <Boks x={520} y={280} w={90} h={66} />
        <ForceArrow x1={520} y1={246} x2={520} y2={316} color={VIZ.gravity} label="G" origin />
      </GalleryItem>

      <GalleryItem title="Laboratorium: betonggulv og labbenk foran" viewBox="0 0 800 320">
        {/* Benkeplata ligger godt over gulvlinja, så overgangen mellom vegg og gulv skjules bak benken. */}
        <Rom x={0} y={0} w={800} h={320} gulvY={296} gulv="betong" />
        <Underlag x1={60} x2={740} y={190} depth={130} type="labbenk" />
        <Boks x={300} y={190} w={70} h={56} />
        <ContactShadow cx={480} cy={190} rx={11} ry={2.5} />
        <Ball x={480} y={176} r={14} />
        <ForceArrow x1={480} y1={176} x2={480} y2={120} color={VIZ.normal} label="N" />
      </GalleryItem>

      <GalleryItem title="Vann: stille basseng med kasse under vann (gjennomsiktig)" viewBox="0 0 800 300">
        <Himmel w={800} h={130} skyer={1} seed={9} />
        <Rom x={0} y={110} w={800} h={190} gulvY={130} gulv="fliser" />
        <rect x={80} y={120} width={640} height={180} fill={shade(SCENE.concrete, 0.1)} />
        <Boks x={300} y={290} w={90} h={70} />
        <Vann x={90} y={150} w={620} h={145} gjennomsiktig />
        <ForceArrow x1={300} y1={255} x2={300} y2={190} color={VIZ.normal} label="Oppdrift" labelSize={0.8} />
      </GalleryItem>

      <GalleryItem title="Vann: bølger med fase 0, π/2 og π" viewBox="0 0 800 360">
        {[0, Math.PI / 2, Math.PI].map((fase, i) => {
          const cy = i * 120;
          return (
            <g key={i}>
              {/* Himmelen går ned under bølgedalene (likevektslinja + amplituden). */}
              <Himmel y={cy} w={800} h={60 + 12} />
              <Vann x={0} y={cy + 60} w={800} h={60} bolge={{ amplitude: 12, bolgelengde: 260, fase }} />
              <path d={`M0,${cy + 60}H800`} stroke={VIZ.muted} strokeDasharray="5 5" strokeWidth={1} />
              <Txt x={14} y={cy + 26} anchor="start" size={0.8}>
                {['fase 0', 'fase π/2', 'fase π'][i]}
              </Txt>
            </g>
          );
        })}
      </GalleryItem>

      <GalleryItem title="Trær: størrelser og årstider" viewBox="0 0 800 300">
        <Himmel w={800} h={300} sol={{ x: 740, y: 50 }} />
        <Underlag x1={0} x2={800} y={262} depth={38} type="gress" horisont={230} />
        <Gran x={40} y={260} size={44} />
        <Gran x={100} y={262} size={90} seed={4} />
        <Gran x={190} y={264} size={160} seed={5} />
        <Gran x={280} y={262} size={120} sno seed={6} />
        <Lauvtre x={380} y={262} size={80} seed={2} />
        <Lauvtre x={490} y={262} size={150} epler seed={3} />
        <Lauvtre x={620} y={262} size={130} sesong="host" seed={4} />
        <Lauvtre x={740} y={262} size={130} sesong="vinter" seed={5} />
      </GalleryItem>

      <GalleryItem title="Liten figur (400 × 240): kyst, betong og trær">
        <Himmel w={400} h={240} sol={{ x: 330, y: 40, r: 14 }} skyer={2} seed={8} />
        <Landskap x={0} y={150} w={400} h={110} type="kyst" seed={5} />
        <Underlag x1={0} x2={400} y={190} depth={50} type="betong" horisont={150} />
        <Gran x={40} y={188} size={70} />
        <Lauvtre x={350} y={190} size={80} />
        <Boks x={200} y={190} w={56} h={40} />
        <ForceArrow x1={200} y1={170} x2={200} y2={230} color={VIZ.gravity} label="G" origin />
      </GalleryItem>
    </GalleryGrid>
  );
}
