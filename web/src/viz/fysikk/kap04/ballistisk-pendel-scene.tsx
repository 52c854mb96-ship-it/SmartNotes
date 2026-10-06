/**
 * Figuren til eksempeloppgaven «Ballistisk pendel»: et luftgevær på en sandpute på labbenken, en trekloss som henger
 * i to parallelle snorer fra et stativ, og fysikken oppå (fartspiler, krefter, bevegelsesmengde, høyden h, banen).
 * Et innfelt panel viser energistolper eller et forstørret snitt av klossen når deloppgaven handler om det.
 * Alt i scenen er i én skala, P piksler per meter (kula er tegnet større, ellers ville den vært 4 px).
 */
import { useMemo, type ReactNode } from 'react';
import { TSub, VIZ, fmt, useTextScale, type FigureState } from '../../kit';
import {
  Callout,
  ContactShadow,
  Dimension,
  ForceArrow,
  Kloss,
  Rom,
  SCENE,
  Snor,
  SpeedLines,
  Underlag,
  ValueTag,
  shade,
  useSceneScale,
  useStrokeScale,
} from '../../kit/scene';
import {
  AIR_RIFLE,
  Diabolokule,
  EnergiStolper,
  Innfelt,
  KlossSnitt,
  Luftgevaer,
  Pendelstativ,
  Ringskrue,
  Gevaerholder,
  Zoomring,
  energiHoyde,
  innfeltTittel,
  type SnittVisning,
} from './ballistisk-pendel-deler';
import { blockLength, swingAt, type PendulumSolution, type PendulumTask } from './model-eks-ballistisk-pendel';

/* ---------- Hva figuren viser i hvert steg ---------- */

type Innhold = { type: 'energi'; tapt: boolean } | { type: 'snitt'; visning: SnittVisning };

export interface PendelVisning {
  /** Hvor klossen er: i ro nederst, midt i svingningen eller i toppen. */
  kloss: 'bunn' | 'midt';
  /** Kula: på vei mot klossen, like foran klossen, eller inne i klossen. */
  kule: 'flukt' | 'naer' | 'inne';
  /** Klossen i toppen (nedtonet), banen og høyden h. */
  topp: boolean;
  /** Bare banen (stiplet bue). */
  bane: boolean;
  hMaal: boolean;
  /** Fartspila på kula («v = ?»). */
  vPil: boolean;
  /** Tyngden, snordraget og farten midt i svingningen. */
  krefter: boolean;
  /** Fartspila V på klossen like etter støtet. */
  VPil: boolean;
  /** E_k nederst og E_p øverst. */
  energi: boolean;
  /** Bevegelsesmengden like før og like etter støtet. */
  p: 'ingen' | 'for' | 'begge';
  /** «Støtet: p bevart» og «Svingningen: E bevart». */
  faser: boolean;
  masser: boolean;
  innfelt: Innhold | null;
  /** Overskrift øverst i scenen. */
  tag?: string;
}

const BASE: PendelVisning = {
  kloss: 'bunn',
  kule: 'inne',
  topp: false,
  bane: false,
  hMaal: false,
  vPil: false,
  krefter: false,
  VPil: false,
  energi: false,
  p: 'ingen',
  faser: false,
  masser: false,
  innfelt: null,
};

/** Figuren for hvert steg (0 = oppgaven, 1–10 = løsningen). Med «hele løsningen» vises oversikten og energistolpene. */
export function visningFor(step: number, showAll: boolean): PendelVisning {
  if (showAll)
    return { ...BASE, kule: 'flukt', topp: true, bane: true, hMaal: true, vPil: true, faser: true, innfelt: { type: 'energi', tapt: true } };
  switch (step) {
    case 0:
      return { ...BASE, kule: 'flukt', topp: true, bane: true, hMaal: true, vPil: true, masser: true };
    case 1:
      return { ...BASE, kloss: 'midt', bane: true, krefter: true };
    case 2:
      return { ...BASE, topp: true, bane: true, hMaal: true, VPil: true, energi: true };
    case 3:
      return { ...BASE, kule: 'naer', p: 'for', tag: 'Like før støtet' };
    case 4:
      return { ...BASE, p: 'begge', tag: 'Like etter støtet' };
    case 5:
      return { ...BASE, VPil: true, innfelt: { type: 'energi', tapt: false } };
    case 6:
      return { ...BASE, VPil: true, innfelt: { type: 'energi', tapt: true } };
    case 7:
      return { ...BASE, innfelt: { type: 'snitt', visning: 'kraft' }, tag: 'Under støtet' };
    case 8:
      return { ...BASE, innfelt: { type: 'snitt', visning: 'kraftpar' }, tag: 'Under støtet' };
    case 9:
      return { ...BASE, innfelt: { type: 'snitt', visning: 'impulser' }, tag: 'Under støtet' };
    default:
      return { ...BASE, topp: true, bane: true, hMaal: true, faser: true, innfelt: { type: 'snitt', visning: 'arbeid' } };
  }
}

/* ---------- Mål og plassering ---------- */

export const W = 800;
/** Piksler per meter i scenen. */
const P = 860;
const BENCH_Y = 392;
/** Høyden fra benken til undersiden av klossen og tykkelsen på klossen (m). */
const GAP = 0.055;
const BLOCK_H = 0.045;
const X_C = 470;
const ROD_X = 782;
/** Fartspilene: piksler per m/s (V er under 1,1 m/s). Kula har sin egen pil (v er ukjent i oppgaven). */
const PX_PER_MS = 100;
/** Kraftpilene i svingningen: piksler per newton (G ≈ 0,7–1,2 N). */
const PX_PER_N = 90;
/** Bevegelsesmengden: like lang pil før og etter. */
const P_ARROW = 110;

export interface PendelLayout {
  narrow: boolean;
  viewBox: string;
  /** Venstre og høyre kant og bunnen av figuren. */
  left: number;
  right: number;
  bottom: number;
  inset: { x: number; y: number; w: number; h: number };
}

/**
 * Desktop: panelet oppe til venstre på veggen. Mobil: smalere utsnitt rundt pendelen, og panelet legges over den
 * øverste delen av scenen (stativarmen og snorene), så figuren ikke blir høyere enn nødvendig.
 */
export function pendelLayout(narrow: boolean): PendelLayout {
  if (!narrow) {
    return { narrow, viewBox: `0 0 ${W} 440`, left: 0, right: W, bottom: 440, inset: { x: 16, y: 16, w: 372, h: 236 } };
  }
  const left = 248;
  const right = 800;
  const top = 6;
  const bottom = 440;
  return {
    narrow,
    viewBox: `${left} ${top} ${right - left} ${bottom - top}`,
    left,
    right,
    bottom,
    inset: { x: left + 8, y: 8, w: right - left - 16, h: 232 },
  };
}

export function PendelScene({
  task,
  s,
  state,
  layout,
}: {
  task: PendulumTask;
  s: PendulumSolution;
  state: FigureState;
  layout: PendelLayout;
}) {
  const f = useTextScale();
  const k = useSceneScale();
  const ss = useStrokeScale();
  const vis = visningFor(state.step, state.showAll);
  const { L } = task;
  const len = blockLength(task.M);
  const bw = len * P;
  const bh = BLOCK_H * P;
  const a = (len / 2 - 0.012) * P; // ringskruene fra midten
  const pivotY = BENCH_Y - (GAP + BLOCK_H + L) * P;
  const restBottom = BENCH_Y - GAP * P;
  const axis = restBottom - bh / 2;
  const blockLeft = X_C - bw / 2;
  const muzzle = blockLeft - 0.15 * P;
  const ringR = Math.max(2.4, 0.004 * P);
  const holderX = muzzle - 0.1 * P;
  const armLeft = X_C - a - 0.03 * P;
  const armR = Math.max(2.2, 0.0055 * P);

  const top = swingAt(task, s, s.thetaMax);
  const mid = swingAt(task, s, 0.55 * s.thetaMax);
  const at = vis.kloss === 'midt' ? mid : swingAt(task, s, 0);

  // Midten av banen til klossens sentrum: sirkel med radius L rundt et punkt L over sentrum i ro
  const R = L * P;
  const pathCy = axis - R;
  const posOf = (st: { dx: number; dy: number }) => ({ cx: X_C + st.dx * P, cy: axis - st.dy * P });

  const backdrop = useMemo(
    () => (
      <>
        <Rom x={layout.left} y={0} w={layout.right - layout.left} h={layout.bottom} gulvY={BENCH_Y + (layout.bottom - BENCH_Y) * 0.8} gulv="betong" />
        <Underlag x1={layout.left - 10} x2={layout.right + 10} y={BENCH_Y} depth={layout.bottom - BENCH_Y + 4} type="labbenk" />
      </>
    ),
    [layout.left, layout.right, layout.bottom, layout.narrow],
  );

  /** Klossen med ringskruer og snorer når den er flyttet (dx, dy) fra bunnen. */
  const pendel = (st: { dx: number; dy: number }, dim: boolean, key: string, label?: string, labelPlass?: 'midt' | 'oppe-venstre') => {
    const bx = X_C + st.dx * P;
    const bottom = restBottom - st.dy * P;
    const topY = bottom - bh;
    return (
      <g key={key} opacity={dim ? 0.42 : undefined}>
        {[-1, 1].map((side) => (
          <Snor key={side} points={[[X_C + side * a, pivotY + armR * 0.6], [bx + side * a, topY - ringR * 1.9]]} />
        ))}
        {[-1, 1].map((side) => (
          <Ringskrue key={side} x={bx + side * a} y={topY} r={ringR} />
        ))}
        <Kloss x={bx} y={bottom} w={bw} h={bh} materiale="tre" skygge={false} label={label} labelPlass={labelPlass} title={dim ? undefined : `Trekloss, ${fmt(task.M * 1000, 0)} g`} />
        {dim && <rect x={bx - bw / 2} y={topY} width={bw} height={bh} rx={2} fill="none" stroke={VIZ.ink} strokeWidth={1.4 * ss} strokeDasharray="5 4" />}
      </g>
    );
  };

  const real = posOf(at);
  const ghost = posOf(top);
  const ghostBottom = restBottom - top.dy * P;
  const ghostTop = ghostBottom - bh;
  /** Hvor den høyre snora til klossen i toppen er i høyden y, så tekst kan settes til høyre for den. */
  const stringX = (y: number) => X_C + a + ((ghost.cx - X_C) * (y - pivotY)) / Math.max(1, ghostTop - ringR * 1.9 - pivotY);
  const epY = ghostTop - 44;
  /** Et punkt midt på banen, som «Svingningen: E bevart» peker på. */
  const swingMid = { x: X_C + R * Math.sin(0.5 * s.thetaMax), y: pathCy + R * Math.cos(0.5 * s.thetaMax) };
  const blockMass = `${fmt(task.M * 1000, 0)} g`;

  // Kula
  const pelletLen = 14 * k;
  const pelletX = vis.kule === 'flukt' ? (muzzle + blockLeft) / 2 - 6 : blockLeft - 24 - pelletLen / 2;

  // Bevegelsesmengden: én skala, like lang før og etter. Pila som gjelder nå, er nærmest; «før» flyttes opp etter støtet.
  const pNow = axis - 44;
  const pPrev = axis - 78;

  const inset = layout.inset;
  const titleH = innfeltTittel(f);
  const body = { x: inset.x + 12, y: inset.y + titleH, w: inset.w - 24, h: inset.h - titleH - 10 };

  let insetNode: ReactNode = null;
  if (vis.innfelt?.type === 'energi') {
    insetNode = (
      <Innfelt x={inset.x} y={inset.y} w={inset.w} h={titleH + energiHoyde(f) + 14} title="Kinetisk energi i støtet">
        <EnergiStolper x={body.x} y={body.y + 4} w={body.w} before={s.EkBefore} after={s.EkAfter} tapt={vis.innfelt.tapt} />
      </Innfelt>
    );
  } else if (vis.innfelt?.type === 'snitt') {
    insetNode = (
      <Innfelt x={inset.x} y={inset.y} w={inset.w} h={inset.h} title={vis.innfelt.visning === 'arbeid' ? 'Forstørret: kula har stoppet' : 'Forstørret snitt: kula bremses i klossen'}>
        <KlossSnitt
          x={body.x}
          y={body.y}
          w={body.w}
          h={body.h}
          depth={s.depth}
          caliber={caliberOf(task.m)}
          visning={vis.innfelt.visning}
          F={s.F}
          dp={s.dpBlock}
          sBlock={s.sBlock}
          Wbullet={s.Wbullet}
          Wblock={s.Wblock}
        />
      </Innfelt>
    );
  }
  /** Ringen rundt det som er forstørret (ikke i steget med fasene, der det blir for mange streker). */
  const zoom = vis.innfelt?.type === 'snitt' && !vis.faser;
  const zoomTarget = layout.narrow ? { x: blockLeft + 5, y: inset.y + inset.h } : { x: inset.x + inset.w, y: inset.y + inset.h - 30 };

  return (
    <>
      {backdrop}

      {/* Stativet og geværet på benken */}
      <Pendelstativ rodX={ROD_X} footY={BENCH_Y} topY={pivotY - 0.03 * P} armY={pivotY} armLeft={armLeft} P={P} />
      <Gevaerholder x={holderX} footY={BENCH_Y} axisY={axis} rBarrel={AIR_RIFLE.rBarrel} P={P} lag="bak" />
      <Luftgevaer x={muzzle} y={axis} P={P} clipX={layout.left - 10} title="Luftgevær, spent fast i et stativ" />
      <Gevaerholder x={holderX} footY={BENCH_Y} axisY={axis} rBarrel={AIR_RIFLE.rBarrel} P={P} lag="foran" />

      {/* Skyggen av klossen på benken */}
      <ContactShadow cx={real.cx} cy={BENCH_Y} rx={bw * 0.55} opacity={0.5} />

      {/* Banen og klossen i toppen (nedtonet) */}
      {vis.bane && (
        <path
          d={`M${X_C},${axis} A${R},${R} 0 0 0 ${X_C + R * Math.sin(s.thetaMax)},${pathCy + R * Math.cos(s.thetaMax)}`}
          fill="none"
          stroke={VIZ.muted}
          strokeWidth={1.6 * ss}
          strokeDasharray={`${6 * ss} ${5 * ss}`}
        />
      )}
      {vis.topp && pendel(top, true, 'topp')}
      {pendel(at, false, 'kloss', vis.krefter || zoom || vis.VPil || vis.energi ? undefined : blockMass)}
      {vis.kule === 'inne' && vis.kloss === 'bunn' && <ellipse cx={blockLeft + 1.2} cy={axis} rx={1.4 * k} ry={2.2 * k} fill={shade(SCENE.woodDark, 0.5)} />}

      {/* Kula */}
      {vis.kule !== 'inne' && (
        <>
          {vis.kule === 'flukt' && <SpeedLines x={pelletX - pelletLen / 2} y={axis} length={28} spread={7 * k} />}
          <Diabolokule x={pelletX} y={axis} len={pelletLen} title={`Luftgeværkule, ${fmt(task.m * 1000, 2)} g`} />
        </>
      )}
      {vis.vPil && (
        <ForceArrow
          x1={pelletX - 6}
          y1={axis - 22}
          x2={pelletX + 50}
          y2={axis - 22}
          color={VIZ.velocity}
          width={5}
          label={state.showAll ? `v = ${fmt(s.v, 0)} m/s` : 'v = ?'}
          labelX={pelletX + 22}
          labelY={axis - 36 - 4 * f}
          labelAnchor="middle"
        />
      )}
      {vis.masser && (
        <>
          <Callout x={pelletX - pelletLen * 0.1} y={axis + pelletLen * 0.45} lx={layout.narrow ? pelletX + 8 : pelletX - 14} ly={axis + 38 + 4 * f} anchor={layout.narrow ? 'start' : 'end'}>
            m = {fmt(task.m * 1000, 2)} g
          </Callout>
          <Callout
            x={layout.narrow ? layout.left + 26 : muzzle - 0.135 * P}
            y={axis - AIR_RIFLE.rBarrel * P}
            lx={layout.narrow ? layout.left + 10 : muzzle - 0.135 * P}
            ly={axis - (layout.narrow ? 74 : 70)}
            anchor={layout.narrow ? 'start' : 'middle'}
          >
            luftgevær
          </Callout>
        </>
      )}

      {/* Høyden h: fra undersiden i ro til undersiden i toppen, rett under klossen i toppen */}
      {vis.hMaal && (
        <g>
          <line
            x1={X_C + bw / 2 + 3}
            y1={restBottom}
            x2={ghost.cx + 8}
            y2={restBottom}
            stroke={VIZ.ink}
            strokeWidth={1 * ss}
            strokeDasharray="3 3"
            opacity={0.6}
          />
          <Dimension x1={ghost.cx} y1={ghostBottom} x2={ghost.cx} y2={restBottom} label={`h = ${fmt(task.h * 100, 1)} cm`} />
        </g>
      )}

      {/* a) Krefter og fart midt i svingningen */}
      {vis.krefter && <SwingForces cx={real.cx} cy={real.cy} st={mid} />}

      {vis.VPil && (
        <ForceArrow
          x1={X_C}
          y1={axis}
          x2={X_C + s.V * PX_PER_MS}
          y2={axis}
          color={VIZ.velocity}
          width={5}
          label="V"
          labelX={X_C + bw / 2 + 5}
          labelY={axis - 8 - 3 * f}
          labelAnchor="start"
          origin
        />
      )}

      {vis.energi && (
        <>
          {layout.narrow ? (
            // Mobil: ikke plass til venstre for klossen, så teksten står på benken
            <Callout x={blockLeft + 8} y={restBottom - 4} lx={blockLeft - 10} ly={BENCH_Y + 30} anchor="start">
              E<TSub>k</TSub> = ½(m + M)V²
            </Callout>
          ) : (
            <Callout x={blockLeft + 6} y={axis - bh / 2 + 4} lx={blockLeft - 30} ly={axis - 40} anchor="end">
              E<TSub>k</TSub> = ½(m + M)V²
            </Callout>
          )}
          <Callout x={ghost.cx + bw / 2 - 6} y={ghostTop + 4} lx={stringX(epY - 12 * f) + 12} ly={epY} anchor="start">
            E<TSub>p</TSub> = (m + M)gh
          </Callout>
        </>
      )}

      {/* b) Bevegelsesmengden like før og like etter støtet: like lange piler */}
      {vis.p === 'for' && (
        <ForceArrow x1={pelletX} y1={pNow} x2={pelletX + P_ARROW} y2={pNow} color={VIZ.velocity} width={6} label="p = m·v" origin />
      )}
      {vis.p === 'begge' && (
        <>
          <ForceArrow
            x1={blockLeft - 24 - pelletLen / 2}
            y1={pPrev}
            x2={blockLeft - 24 - pelletLen / 2 + P_ARROW}
            y2={pPrev}
            color={VIZ.velocity}
            width={6}
            dashed
            label={layout.narrow ? 'm·v' : 'før: m·v'}
          />
          <ForceArrow x1={X_C} y1={pNow} x2={X_C + P_ARROW} y2={pNow} color={VIZ.velocity} width={6} label={layout.narrow ? '(m + M)·V' : 'etter: (m + M)·V'} origin />
        </>
      )}

      {vis.faser && (
        <>
          {layout.narrow ? (
            // Mobil: panelet dekker den øverste delen av scenen, så tekstene står på benken
            <>
              <Callout x={blockLeft + 2} y={axis + 6} lx={blockLeft + 8} ly={BENCH_Y + 30} anchor="end" strong size={0.8}>
                Støtet: p bevart
              </Callout>
              <Callout
                x={X_C + R * Math.sin(0.45 * s.thetaMax)}
                y={pathCy + R * Math.cos(0.45 * s.thetaMax)}
                lx={X_C + R * Math.sin(0.45 * s.thetaMax) - 8}
                ly={BENCH_Y + 30}
                anchor="start"
                strong
                size={0.8}
              >
                Svingningen: E bevart
              </Callout>
            </>
          ) : (
            <>
              <Callout x={blockLeft + 2} y={axis + 6} lx={blockLeft - 34} ly={BENCH_Y - 18} anchor="end" strong size={0.8}>
                Støtet: p bevart
              </Callout>
              <Callout x={swingMid.x} y={swingMid.y} lx={swingMid.x + 16} ly={BENCH_Y - 18} anchor="start" strong size={0.8}>
                Svingningen: E bevart
              </Callout>
            </>
          )}
        </>
      )}

      {vis.tag && !(layout.narrow && vis.innfelt) && <ValueTag x={600} y={24} text={vis.tag} size={0.88} />}

      {/* Panelet: energistolper eller forstørret snitt */}
      {zoom && <Zoomring cx={blockLeft + 5} cy={axis} r={16 * k} tx={zoomTarget.x} ty={zoomTarget.y} />}
      {insetNode}
    </>
  );
}

/** Kaliberet til kula (m): 4,5 mm for de lette kulene, 5,5 mm for de tyngre. Bare til tegningen. */
function caliberOf(m: number): number {
  return m >= 0.6e-3 ? 5.5e-3 : 4.5e-3;
}

/** Tyngden, snordraget og farten midt i svingningen, med en rett vinkel mellom snordraget og farten. */
function SwingForces({ cx, cy, st }: { cx: number; cy: number; st: ReturnType<typeof swingAt> }) {
  const ss = useStrokeScale();
  const f = useTextScale();
  const s = Math.sin(st.phi);
  const c = Math.cos(st.phi);
  const uS = { x: -s, y: -c }; // mot festet
  const uV = { x: c, y: -s }; // langs banen
  const m = 15;
  const corner = `M${cx + uS.x * m},${cy + uS.y * m} L${cx + uS.x * m + uV.x * m},${cy + uS.y * m + uV.y * m} L${cx + uV.x * m},${cy + uV.y * m}`;
  return (
    <g>
      <ForceArrow x1={cx} y1={cy} x2={cx} y2={cy + st.G * PX_PER_N} color={VIZ.gravity} label="G" origin />
      <ForceArrow x1={cx} y1={cy} x2={cx + uS.x * st.S * PX_PER_N} y2={cy + uS.y * st.S * PX_PER_N} color={VIZ.tension} label="S" labelAnchor="end" />
      <ForceArrow x1={cx} y1={cy} x2={cx + uV.x * st.u * PX_PER_MS} y2={cy + uV.y * st.u * PX_PER_MS} color={VIZ.velocity} width={5} label="fart" />
      <path d={corner} fill="none" stroke={VIZ.surface} strokeWidth={4 * ss} opacity={0.85} />
      <path d={corner} fill="none" stroke={VIZ.ink} strokeWidth={1.5 * ss} />
      <Callout x={cx + (uS.x + uV.x) * m * 0.75} y={cy + (uS.y + uV.y) * m * 0.75} lx={cx + 44} ly={cy - 64 - 4 * f} anchor="start" size={0.8}>
        S ⊥ farten
      </Callout>
    </g>
  );
}
