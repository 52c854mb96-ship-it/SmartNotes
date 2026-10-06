/**
 * Figuren til eksempeloppgaven «Godsvogner som kobles sammen»: en godsterminal med et rett spor, vogn A med en full
 * container som triller inn i vogn B, og fysikken oppå (fart, bevegelsesmengde, ytre krefter, kraftparet i støtet,
 * akselerasjon). Et innfelt panel viser energistolper, en forstørrelse av koblingen eller F-t-grafen når deloppgaven
 * handler om det. Alt i scenen er i én skala, P piksler per meter.
 */
import { useMemo, type ReactNode } from 'react';
import { TSub, Txt, VIZ, fmt, sample, useTextScale, type FigureState } from '../../kit';
import {
  Callout,
  ForceArrow,
  Himmel,
  Landskap,
  LinearGradient,
  RadialGradient,
  SCENE,
  Underlag,
  ValueTag,
  alpha,
  mix,
  useStrokeScale,
  useSvgId,
} from '../../kit/scene';
import { peakForce, pulseForce, type WagonSolution, type WagonTask } from './model-eks-vognstot';
import {
  EnergiStolper,
  Godsvogn,
  Innfelt,
  Jernbanespor,
  Terminal,
  VOGN,
  energiHoyde,
  fmtPot,
  innfeltTittel,
  sporFot,
  vognTopp,
  vognTyngdepunkt,
} from './vognstot-deler';

/* ---------- Hva figuren viser i hvert steg ---------- */

type Innhold = { type: 'energi'; tapt: boolean } | { type: 'zoom'; energi: boolean } | { type: 'ft' };

export interface VognVisning {
  /** Før støtet (luke mellom vognene), under støtet (bufferne trykt inn) eller like etter (koblet sammen). */
  tilstand: 'for' | 'under' | 'etter';
  /** Fartspilene før støtet, og om verdiene står på dem. */
  vPiler: boolean;
  /** Systemgrensen rundt begge vognene. */
  system: boolean;
  /** Tyngden og normalkraften på hver vogn. */
  ytre: boolean;
  /** Pila for positiv retning. */
  pluss: boolean;
  /** Bevegelsesmengden til A og B før støtet og summen. */
  pPiler: boolean;
  /** Fartspila V like etter støtet. */
  VPil: boolean;
  /** Σp før og etter, like lange. */
  sumP: boolean;
  /** Kraftparet mellom vognene under støtet. */
  krefter: boolean;
  impulser: boolean;
  kraftpar: boolean;
  akselerasjon: boolean;
  innfelt: Innhold | null;
  /** Overskrift øverst til venstre. */
  tag?: string;
}

const BASE: VognVisning = {
  tilstand: 'for',
  vPiler: false,
  system: false,
  ytre: false,
  pluss: false,
  pPiler: false,
  VPil: false,
  sumP: false,
  krefter: false,
  impulser: false,
  kraftpar: false,
  akselerasjon: false,
  innfelt: null,
};

/** Figuren for hvert steg (0 = oppgaven, 1–11 = løsningen). Med «hele løsningen» vises etter-bildet og energistolpene. */
export function visningFor(step: number, showAll: boolean): VognVisning {
  if (showAll) return { ...BASE, tilstand: 'etter', VPil: true, pluss: true, innfelt: { type: 'energi', tapt: true } };
  switch (step) {
    case 0:
      return { ...BASE, vPiler: true, tag: 'Før støtet' };
    case 1:
      return { ...BASE, vPiler: true, system: true, ytre: true, tag: 'Før støtet' };
    case 2:
      return { ...BASE, system: true, pluss: true, pPiler: true, tag: 'Før støtet' };
    case 3:
      return { ...BASE, tilstand: 'etter', VPil: true, sumP: true, pluss: true, tag: 'Like etter støtet' };
    case 4:
      return { ...BASE, tilstand: 'etter', VPil: true, innfelt: { type: 'energi', tapt: false } };
    case 5:
      return { ...BASE, tilstand: 'etter', VPil: true, innfelt: { type: 'energi', tapt: true } };
    case 6:
      return { ...BASE, tilstand: 'etter', innfelt: { type: 'zoom', energi: false } };
    case 7:
      return { ...BASE, tilstand: 'etter', innfelt: { type: 'zoom', energi: true } };
    case 8:
      return { ...BASE, tilstand: 'under', krefter: true, impulser: true, pluss: true, tag: 'Under støtet' };
    case 9:
      return { ...BASE, tilstand: 'under', krefter: true, impulser: true, kraftpar: true, tag: 'Under støtet' };
    case 10:
      return { ...BASE, tilstand: 'under', krefter: true, innfelt: { type: 'ft' } };
    default:
      return { ...BASE, tilstand: 'under', krefter: true, akselerasjon: true, tag: 'Under støtet' };
  }
}

/* ---------- Mål og plassering ---------- */

/** Fargen på containeren på A i hvert tallsett, og på den lille containeren på B. */
const LAKK_A = ['blaa', 'rod', 'gronn'];
const LAKK_B = 'gul';
/** Luka mellom bufferne før støtet (m). */
const GAP = 2.0;

export interface VognLayout {
  narrow: boolean;
  viewBox: string;
  left: number;
  right: number;
  top: number;
  bottom: number;
  /** Piksler per meter. */
  P: number;
  /** Skinnetoppen. */
  railY: number;
  /** Der bufferne møtes. */
  xc: number;
  /** Horisonten. */
  horizon: number;
}

/**
 * PC: hele scenen (begge vognene). Mobil: et utsnitt rundt koblingen uten den øverste delen av himmelen, så vognene ikke
 * blir for små. Panelene legges da over himmelen.
 */
export function vognLayout(narrow: boolean): VognLayout {
  const base = { narrow, P: 24, railY: 372, xc: 424, horizon: 300, bottom: 440 };
  if (!narrow) return { ...base, viewBox: '0 0 800 440', left: 0, right: 800, top: 0 };
  const left = 174;
  const right = 654;
  const top = 70;
  return { ...base, viewBox: `${left} ${top} ${right - left} ${base.bottom - top}`, left, right, top };
}

/** Omtrent hvor bred en etikett blir (figurens enheter), til å holde den inne i figuren. */
function textWidth(chars: number, f: number, size = 1): number {
  return chars * 9.6 * f * size;
}

export function VognScene({
  task,
  s,
  state,
  layout,
  variant,
}: {
  task: WagonTask;
  s: WagonSolution;
  state: FigureState;
  layout: VognLayout;
  variant: number;
}) {
  const f = useTextScale();
  const ss = useStrokeScale();
  const vis = visningFor(state.step, state.showAll);
  const { P, railY, xc, left, right, top, narrow } = layout;
  const viewW = right - left;
  const half = VOGN.lengde / 2;

  // Vognene: midten mellom hjulene. Under støtet er begge bufferne trykt helt inn.
  const squeeze = vis.tilstand === 'under' ? 1 : 0;
  const xA = vis.tilstand === 'for' ? xc - (GAP + half) * P : xc - (half - VOGN.bufferslag * squeeze) * P;
  const xB = xc + (half - VOGN.bufferslag * squeeze) * P;
  const topA = railY - vognTopp(task.loadA) * P;
  const topB = railY - vognTopp(task.loadB) * P;
  const topMin = Math.min(topA, topB);
  const bufY = railY - VOGN.buffer * P;

  /** Hvor en vannrett pil med lengden `len` (med fortegn) til vogn A eller B starter: midt på vogna, men innenfor figuren. */
  const anchor = (who: 'A' | 'B', len: number) =>
    who === 'A' ? Math.max(xA, left + 30, left + 16 - len) : Math.min(xB, right - 30, right - 16 - len);
  /** Etikett midt over en vannrett pil, holdt innenfor figuren. */
  const labelX = (mid: number, chars: number, size = 1) => {
    const hw = textWidth(chars, f, size) / 2;
    return Math.min(right - hw - 8, Math.max(left + hw + 8, mid));
  };

  // Skalaer (én per størrelse i hele figuren, avhengig av tallsettet og utsnittet)
  const vMax = Math.max(Math.abs(task.vA), Math.abs(task.vB), Math.abs(s.V));
  const S_V = vMax > 0 ? (0.14 * viewW) / vMax : 0;
  const pMax = Math.max(Math.abs(s.pA), Math.abs(s.pB), Math.abs(s.p));
  const S_P = pMax > 0 ? (0.26 * viewW) / pMax : 0;
  const S_G = (narrow ? 64 : 76) / Math.max(s.GA, s.GB);
  const aMax = Math.max(s.aA, s.aB);
  const S_A = aMax > 0 ? (0.17 * viewW) / aMax : 0;
  const LF = 0.14 * viewW;

  const backdrop = useMemo(
    () => (
      <>
        <Himmel x={0} y={0} w={800} h={layout.horizon} skyer={2} seed={7} />
        <Landskap x={0} y={layout.horizon} w={800} h={92} type="fjell" seed={4} />
        <Terminal x1={0} x2={800} y={layout.horizon} />
        <Underlag x1={-10} x2={810} y={railY + sporFot(P) + 2} depth={layout.bottom - railY - sporFot(P)} type="grus" horisont={layout.horizon} seed={3} />
        <Jernbanespor x1={-10} x2={810} y={railY} P={P} />
      </>
    ),
    [layout.horizon, layout.bottom, railY, P],
  );

  const lakkA = LAKK_A[variant] ?? 'blaa';
  const after = vis.tilstand !== 'for';

  /* ----- Innfelt panel ----- */
  const titleH = innfeltTittel(f);
  const insetY = top + (narrow ? 6 : 14);
  let inset: { x: number; y: number; w: number; h: number } | null = null;
  let insetNode: ReactNode = null;
  if (vis.innfelt?.type === 'energi') {
    const w = narrow ? viewW - 16 : 360;
    const h = titleH + energiHoyde(f) + 12;
    inset = { x: left + (narrow ? 8 : 16), y: insetY, w, h };
    insetNode = (
      <Innfelt {...inset} title="Kinetisk energi i støtet">
        <EnergiStolper x={inset.x + 12} y={inset.y + titleH} w={w - 24} before={s.EkBefore} after={s.EkAfter} tapt={vis.innfelt.tapt} />
      </Innfelt>
    );
  } else if (vis.innfelt?.type === 'zoom') {
    const w = narrow ? viewW - 16 : 408;
    inset = { x: narrow ? left + 8 : xc - w / 2, y: insetY, w, h: narrow ? 200 : 216 };
    insetNode = (
      <Innfelt {...inset} title={vis.innfelt.energi ? 'Forstørret: hvor blir energien av?' : 'Forstørret: bufferne og koblingen'}>
        <KoblingZoom
          x={inset.x + 10}
          y={inset.y + titleH}
          w={w - 20}
          h={inset.h - titleH - 10}
          task={task}
          lakkA={lakkA}
          energi={vis.innfelt.energi}
        />
      </Innfelt>
    );
  } else if (vis.innfelt?.type === 'ft') {
    const w = narrow ? viewW - 16 : 360;
    inset = { x: narrow ? left + 8 : right - w - 16, y: insetY, w, h: narrow ? 196 : 212 };
    insetNode = (
      <Innfelt {...inset} title="Kraften mellom vognene under støtet">
        <FtGraf x={inset.x + 10} y={inset.y + titleH} w={w - 20} h={inset.h - titleH - 8} F={s.F} dt={task.dt} I={s.IB} />
      </Innfelt>
    );
  }
  /** På mobil dekker panelet himmelen, så pilene og skiltene der vises ikke samtidig. */
  const skyFree = !(narrow && inset);

  /* ----- Etiketter under vognene ----- */
  const groundLabelY = railY + sporFot(P) + 26 * f;
  const massLabel = (who: 'A' | 'B', x: number) => {
    const m = who === 'A' ? task.mA : task.mB;
    const text = `Vogn ${who} · ${fmt(m / 1000, 0)} t`;
    const hw = textWidth(text.length, f, 0.95) / 2;
    const lx = Math.min(right - hw - 8, Math.max(left + hw + 8, x));
    return (
      <Txt x={lx} y={groundLabelY} size={0.95} weight={700}>
        {text}
      </Txt>
    );
  };

  /* ----- Pilene ----- */
  const vY = (t: number) => t - 22;
  const arrowLabelY = (y: number) => y - 13 * f;
  /** Avstand mellom to rader med vannrette piler over vognene. */
  const row = 46 * f;

  const horizontal = (
    key: string,
    x0: number,
    y: number,
    len: number,
    color: string,
    label: ReactNode,
    chars: number,
    opts?: { dashed?: boolean; width?: number },
  ) => (
    <ForceArrow
      key={key}
      x1={x0}
      y1={y}
      x2={x0 + len}
      y2={y}
      color={color}
      width={opts?.width ?? 6}
      dashed={opts?.dashed}
      label={label}
      labelX={labelX(x0 + len / 2, chars, 0.95)}
      labelY={arrowLabelY(y)}
      labelAnchor="middle"
      labelSize={0.95}
      origin
    />
  );
  /** Pil til vogn A eller B, med start midt på vogna. */
  const wagonArrow = (key: string, who: 'A' | 'B', y: number, len: number, color: string, label: ReactNode, chars: number, width?: number) =>
    horizontal(key, anchor(who, len), y, len, color, label, chars, { width });

  const restText = (key: string, x: number, y: number, text: ReactNode, chars: number) => (
    <Txt key={key} x={labelX(x, chars, 0.95)} y={y} size={0.95} weight={700} color={VIZ.velocity}>
      {text}
    </Txt>
  );

  const vB = task.vB;

  // Systemgrensen
  const sysTop = topMin - 62 - 6 * f;
  const sysLeft = xA - half * P - 8;
  const sysRight = xB + half * P + 8;

  // Positiv retning øverst til høyre
  const plus = vis.pluss && skyFree && (
    <g>
      <ForceArrow x1={right - 74} y1={top + 30} x2={right - 20} y2={top + 30} color={VIZ.ink} width={3.2} />
      <Txt x={right - 82} y={top + 30 + 6 * f} anchor="end" size={0.85} weight={650}>
        positiv retning
      </Txt>
    </g>
  );

  const zoom = vis.innfelt?.type === 'zoom' && inset;
  const sumLen = s.p * S_P;

  return (
    <>
      {backdrop}

      {/* Vognene */}
      <Godsvogn
        x={xA}
        y={railY}
        P={P}
        last={task.loadA}
        lakk={lakkA}
        bufferInn={{ hoyre: squeeze }}
        laast={{ hoyre: vis.tilstand === 'etter' }}
        title={`Vogn A med en full container, ${fmt(task.mA / 1000, 0)} tonn`}
      />
      <Godsvogn
        x={xB}
        y={railY}
        P={P}
        last={task.loadB}
        lakk={LAKK_B}
        bufferInn={{ venstre: squeeze }}
        laast={{ venstre: vis.tilstand === 'etter' }}
        title={`Vogn B, ${fmt(task.mB / 1000, 0)} tonn`}
      />
      {massLabel('A', xA)}
      {massLabel('B', xB)}

      {/* Systemgrensen rundt begge vognene */}
      {vis.system && (
        <g>
          <rect
            x={sysLeft}
            y={sysTop}
            width={sysRight - sysLeft}
            height={railY + 10 - sysTop}
            rx={14}
            fill={alpha(VIZ.surface, 0.12)}
            stroke={VIZ.ink}
            strokeWidth={1.6 * ss}
            strokeDasharray={`${8 * ss} ${6 * ss}`}
          />
          <Txt x={Math.max(sysLeft, left) + 14} y={sysTop - 8} anchor="start" size={0.9} weight={700}>
            Systemet: vogn A og vogn B
          </Txt>
        </g>
      )}

      {/* a) Ytre krefter: tyngden og normalkraften på hver vogn */}
      {vis.ytre && (
        <g>
          {(
            [
              ['A', xA, s.GA, vognTyngdepunkt(task.loadA)],
              ['B', xB, s.GB, vognTyngdepunkt(task.loadB)],
            ] as const
          ).map(([who, x, G, h]) => {
            const ax = who === 'A' ? Math.max(x, left + 40) : Math.min(x, right - 40);
            const com = railY - h * P;
            const L = G * S_G;
            return (
              <g key={who}>
                <ForceArrow x1={ax - 9} y1={com} x2={ax - 9} y2={com + L} color={VIZ.gravity} label="G" labelAnchor="end" labelX={ax - 18} origin />
                <ForceArrow x1={ax + 9} y1={railY} x2={ax + 9} y2={railY - L} color={VIZ.normal} label="N" />
              </g>
            );
          })}
        </g>
      )}

      {/* Fart før støtet */}
      {vis.vPiler && (
        <g>
          {wagonArrow('vA', 'A', vY(topA), task.vA * S_V, VIZ.velocity, <>v<TSub>A</TSub> = {fmt(task.vA, 1)} m/s</>, 14)}
          {vB === 0
            ? restText('vB', anchor('B', 0), vY(topB) + 4, <>v<TSub>B</TSub> = 0 (i ro)</>, 14)
            : wagonArrow('vB', 'B', vY(topB), vB * S_V, VIZ.velocity, <>v<TSub>B</TSub> = {fmt(vB, 1)} m/s</>, 15)}
        </g>
      )}

      {/* Bevegelsesmengden før støtet */}
      {vis.pPiler && (
        <g>
          {wagonArrow('pA', 'A', vY(topA), s.pA * S_P, VIZ.velocity, <>p<TSub>A</TSub> = {fmt(s.pA, 0)} kg·m/s</>, 20)}
          {s.pB === 0
            ? restText('pB', anchor('B', 0), vY(topB) + 4, <>p<TSub>B</TSub> = 0</>, 7)
            : wagonArrow('pB', 'B', vY(topB), s.pB * S_P, VIZ.velocity, <>p<TSub>B</TSub> = {fmt(s.pB, 0)} kg·m/s</>, 20)}
          {horizontal('sum', xc - sumLen / 2, sysTop - row, sumLen, VIZ.velocity, <>Σp = {fmt(s.p, 0)} kg·m/s</>, 18, { width: 7 })}
        </g>
      )}

      {/* Like etter støtet: felles fart og Σp før og etter */}
      {vis.VPil && after && skyFree && horizontal('V', xc - (s.V * S_V) / 2, vY(topMin), s.V * S_V, VIZ.velocity, <>V = {fmt(s.V, 2)} m/s</>, 11)}
      {vis.sumP && (
        <g>
          {horizontal('sumFor', xc - sumLen / 2, vY(topMin) - 2 * row, sumLen, VIZ.velocity, <>før: Σp = {fmt(s.p, 0)} kg·m/s</>, 24, { dashed: true, width: 8 })}
          {horizontal('sumEtter', xc - sumLen / 2, vY(topMin) - row, sumLen, VIZ.velocity, <>etter: Σp = (m<TSub>A</TSub> + m<TSub>B</TSub>)·V</>, 26, { width: 7 })}
        </g>
      )}

      {/* Under støtet: kraftparet ved bufferne */}
      {vis.krefter && (
        <g>
          <ForceArrow x1={xc} y1={bufY} x2={xc - LF} y2={bufY} color={VIZ.applied} label={<>F<TSub>A</TSub></>} labelX={xc - LF + 4} labelY={bufY - 13 * f} labelAnchor="middle" />
          <ForceArrow x1={xc} y1={bufY} x2={xc + LF} y2={bufY} color={VIZ.applied} label={<>F<TSub>B</TSub></>} labelX={xc + LF - 4} labelY={bufY - 13 * f} labelAnchor="middle" origin />
        </g>
      )}
      {vis.impulser && (
        <g>
          <Txt x={labelX(anchor('A', 0), 20, 0.95)} y={topMin - 26} size={0.95} weight={700} color={VIZ.applied}>
            I<TSub>A</TSub> = {fmtPot(s.IA, 2)} N·s
          </Txt>
          <Txt x={labelX(anchor('B', 0), 20, 0.95)} y={topMin - 26} size={0.95} weight={700} color={VIZ.applied}>
            I<TSub>B</TSub> = +{fmtPot(s.IB, 2)} N·s
          </Txt>
        </g>
      )}
      {vis.kraftpar && (
        <g>
          <Callout x={xc} y={bufY - 14} lx={labelX(xc, 32, 0.85)} ly={topMin - 26 - row - 20 * f} anchor="middle" strong>
            Kraftpar (Newtons 3. lov): F<TSub>A</TSub> = −F<TSub>B</TSub>
          </Callout>
          <Txt x={labelX(xc, 32, 0.85)} y={topMin - 26 - row} size={0.85} weight={580}>
            like store, motsatt rettet, like lenge
          </Txt>
        </g>
      )}
      {vis.akselerasjon && (
        <g>
          {wagonArrow('aA', 'A', vY(topMin), -s.aA * S_A, VIZ.acceleration, <>a<TSub>A</TSub> = {fmt(s.aA, 2)} m/s²</>, 15, 5)}
          {wagonArrow('aB', 'B', vY(topMin), s.aB * S_A, VIZ.acceleration, <>a<TSub>B</TSub> = {fmt(s.aB, 2)} m/s²</>, 15, 5)}
        </g>
      )}

      {plus}
      {vis.tag && skyFree && <ValueTag x={left + (narrow ? 12 : 16)} y={top + 30} text={vis.tag} anchor="start" size={0.88} />}

      {/* Ringen rundt koblingen og streken opp til forstørrelsen */}
      {zoom && inset && <ZoomRing cx={xc} cy={bufY + 6} r={1.05 * P} tx={xc} ty={inset.y + inset.h} />}
      {insetNode}
    </>
  );
}

/* ---------- Ring rundt det som er forstørret ---------- */

function ZoomRing({ cx, cy, r, tx, ty }: { cx: number; cy: number; r: number; tx: number; ty: number }) {
  const ss = useStrokeScale();
  const dx = tx - cx;
  const dy = ty - cy;
  const len = Math.hypot(dx, dy) || 1;
  const sx = cx + (dx / len) * r;
  const sy = cy + (dy / len) * r;
  return (
    <g aria-hidden>
      <line x1={sx} y1={sy} x2={tx} y2={ty} stroke={VIZ.surface} strokeWidth={4 * ss} opacity={0.8} />
      <line x1={sx} y1={sy} x2={tx} y2={ty} stroke={VIZ.ink} strokeWidth={1.5 * ss} />
      <circle cx={cx} cy={cy} r={r} fill="none" stroke={VIZ.surface} strokeWidth={4.5 * ss} opacity={0.85} />
      <circle cx={cx} cy={cy} r={r} fill="none" stroke={VIZ.ink} strokeWidth={1.8 * ss} />
    </g>
  );
}

/* ---------- Forstørrelsen av koblingen ---------- */

/**
 * Bufferne og koblingene forstørret (2,7 m bredt utsnitt fra 0,47 m over skinnetoppen), like etter støtet:
 * koblingene har låst seg, og bufferne er fortsatt litt inntrykt. Med `energi` gløder bufferne (indre energi), og
 * buer viser lyden fra smellet.
 */
function KoblingZoom({ x, y, w, h, task, lakkA, energi }: { x: number; y: number; w: number; h: number; task: WagonTask; lakkA: string; energi: boolean }) {
  const clip = useSvgId('vognstot-zoom');
  const glow = useSvgId('vognstot-varme');
  const bg = useSvgId('vognstot-bakgrunn');
  const ss = useStrokeScale();
  const f = useTextScale();
  const Pz = w / 2.7;
  const cx = x + w / 2;
  const railZ = y + h + 0.47 * Pz;
  const bufY = railZ - VOGN.buffer * Pz;
  const half = VOGN.lengde / 2;
  const inn = 0.3;
  const xA = cx - (half - VOGN.bufferslag * inn) * Pz;
  const xB = cx + (half - VOGN.bufferslag * inn) * Pz;
  /** Midten av bufferhylsa (0,53 m fra der bufferne møtes). */
  const housing = (dir: 1 | -1) => cx + dir * 0.53 * Pz;
  const couplerY = railZ - 0.745 * Pz;
  const labY = y + h - 10;
  return (
    <g>
      <defs>
        <clipPath id={clip}>
          <rect x={x} y={y} width={w} height={h} rx={6} />
        </clipPath>
      </defs>
      <LinearGradient id={bg} stops={[[0, mix(SCENE.gravel, SCENE.skyBottom, 0.55)], [1, mix(SCENE.gravel, SCENE.skyBottom, 0.25)]]} />
      <g clipPath={`url(#${clip})`}>
        <rect x={x} y={y} width={w} height={h} fill={`url(#${bg})`} />
        <Godsvogn x={xA} y={railZ} P={Pz} last={task.loadA} lakk={lakkA} bufferInn={{ hoyre: inn }} laast={{ hoyre: true }} />
        <Godsvogn x={xB} y={railZ} P={Pz} last={task.loadB} lakk={LAKK_B} bufferInn={{ venstre: inn }} laast={{ venstre: true }} />
        {energi && (
          <g>
            <RadialGradient id={glow} stops={[[0, SCENE.hot, 0.8], [0.45, SCENE.warm, 0.45], [1, SCENE.warm, 0]]} />
            {([-1, 1] as const).map((dir) => (
              <ellipse key={dir} cx={housing(dir)} cy={bufY} rx={0.34 * Pz} ry={0.22 * Pz} fill={`url(#${glow})`} />
            ))}
            {/* Lyden fra smellet: buer ut fra der bufferne møtes */}
            {[0.17, 0.25, 0.33].map((r, i) => {
              const a0 = (-78 * Math.PI) / 180;
              const a1 = (-12 * Math.PI) / 180;
              const R = r * Pz;
              return (
                <path
                  key={i}
                  d={`M${(cx + R * Math.cos(a0)).toFixed(1)},${(bufY + R * Math.sin(a0)).toFixed(1)} A${R.toFixed(1)},${R.toFixed(1)} 0 0 1 ${(cx + R * Math.cos(a1)).toFixed(1)},${(bufY + R * Math.sin(a1)).toFixed(1)}`}
                  fill="none"
                  stroke={VIZ.ink}
                  strokeWidth={2 * ss}
                  strokeLinecap="round"
                  opacity={0.75 - i * 0.18}
                />
              );
            })}
          </g>
        )}
      </g>
      {/* Etikettene nederst, der det bare er skiftetrinnene */}
      {energi ? (
        <>
          <Callout x={housing(-1)} y={bufY + 0.08 * Pz} lx={x + 12} ly={labY} anchor="start" size={0.8}>
            varme i bufferne
          </Callout>
          <Txt x={cx + 0.36 * Pz} y={bufY - 0.3 * Pz + 5 * f} anchor="start" size={0.8} weight={650}>
            lyd
          </Txt>
          <Callout x={cx + 0.1 * Pz} y={couplerY + 0.06 * Pz} lx={x + w - 12} ly={labY} anchor="end" size={0.8}>
            deformasjon
          </Callout>
        </>
      ) : (
        <>
          <Callout x={cx - 0.06 * Pz} y={bufY + 0.1 * Pz} lx={x + 12} ly={labY} anchor="start" size={0.8}>
            bufferne
          </Callout>
          <Callout x={cx + 0.12 * Pz} y={couplerY + 0.05 * Pz} lx={x + w - 12} ly={labY} anchor="end" size={0.8}>
            koblingen har låst seg
          </Callout>
        </>
      )}
      <rect x={x} y={y} width={w} height={h} rx={6} fill="none" stroke={SCENE.outline} strokeWidth={1 * ss} opacity={0.6} />
    </g>
  );
}

/* ---------- F-t-grafen ---------- */

function FtGraf({ x, y, w, h, F, dt, I }: { x: number; y: number; w: number; h: number; F: number; dt: number; I: number }) {
  const f = useTextScale();
  const ss = useStrokeScale();
  const x0 = x + 22 * f;
  const x1 = x + w - 14;
  const y0 = y + h - 26 * f;
  const y1 = y + 12 * f;
  const tMax = dt * 1.22;
  const Fmax = peakForce(F) * 1.1;
  const sx = (t: number) => x0 + (t / tMax) * (x1 - x0);
  const sy = (v: number) => y0 - (v / Fmax) * (y0 - y1);
  const pts = sample((t) => pulseForce(t, F, dt), 0, dt, 64);
  const curve = pts.map(([t, v], i) => `${i === 0 ? 'M' : 'L'}${sx(t).toFixed(1)},${sy(v).toFixed(1)}`).join('');
  const area = `${curve}L${sx(dt).toFixed(1)},${y0}L${sx(0).toFixed(1)},${y0}Z`;
  const yF = sy(F);
  const kN = `${fmt(F / 1000, 1)} kN`;
  return (
    <g>
      {/* Arealet under grafen er impulsen */}
      <path d={area} fill={alpha(VIZ.applied, 0.2)} />
      <rect x={sx(0)} y={yF} width={sx(dt) - sx(0)} height={y0 - yF} fill="none" stroke={VIZ.applied} strokeWidth={1.6 * ss} strokeDasharray={`${6 * ss} ${4 * ss}`} />
      <path d={curve} fill="none" stroke={VIZ.applied} strokeWidth={2.6 * ss} strokeLinejoin="round" />
      {/* Aksene */}
      <line x1={x0} y1={y0} x2={x1} y2={y0} stroke={VIZ.ink} strokeWidth={1.4 * ss} />
      <line x1={x0} y1={y0} x2={x0} y2={y1 - 4} stroke={VIZ.ink} strokeWidth={1.4 * ss} />
      <path d={`M${x1},${y0} l-8,-4 v8 Z M${x0},${y1 - 6} l-4,8 h8 Z`} fill={VIZ.ink} />
      <Txt x={x0 - 6} y={y1 + 6 * f} anchor="end" size={0.85} weight={700}>
        F
      </Txt>
      <Txt x={x1} y={y0 + 20 * f} anchor="end" size={0.85} weight={700}>
        t
      </Txt>
      <line x1={sx(dt)} y1={y0} x2={sx(dt)} y2={y0 + 5} stroke={VIZ.ink} strokeWidth={1.4 * ss} />
      <Txt x={sx(0)} y={y0 + 18 * f} size={0.78} muted>
        0
      </Txt>
      <Txt x={sx(dt)} y={y0 + 18 * f} size={0.78} weight={650}>
        Δt = {fmt(dt, 2)} s
      </Txt>
      {/* Gjennomsnittskraften og arealet */}
      <Txt x={(sx(0) + sx(dt)) / 2} y={yF + 20 * f} size={0.8} weight={700} color={VIZ.applied}>
        gjennomsnitt: F = {kN}
      </Txt>
      <Txt x={(sx(0) + sx(dt)) / 2} y={yF + 40 * f} size={0.78} weight={650}>
        areal = I = {fmtPot(Math.abs(I), 2)} N·s
      </Txt>
      <Txt x={sx(dt * 0.62) + 8} y={sy(peakForce(F) * 0.93)} anchor="start" size={0.78} muted>
        F(t)
      </Txt>
    </g>
  );
}
