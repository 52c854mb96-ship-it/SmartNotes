/**
 * Scenen til «Kloss på skråplan» (2A, 2C, 2E): et vippbart skråplan på labbenken i fysikkrommet, med en kloss av tre,
 * aluminium, gummi eller is. Alle lengder i én skala (PX_PER_M), alle krefter i én skala (G-pila har fast lengde, så
 * skalaen px/N følger massen). Pilene går ut fra tyngdepunktet, som i eksempeloppgaven.
 */
import { memo } from 'react';
import { Figure, Txt, VIZ, fmt, useTextScale } from '../../kit';
import { ForceArrow, Kloss, Rom, Underlag, ValueTag, type KlossMateriale } from '../../kit/scene';
import type { BlockMaterial } from './model-skraplan';
import { PLANK } from './model-skraplan';
import { Vippeplan } from './skraplan-deler';
import { useNarrow } from './useNarrow';

const RAD = Math.PI / 180;

const W = 800;
const H = 470;
/** Piksler per meter for alle lengder i scenen (planken er 0,90 m). */
const PX_PER_M = 400;
/** Benkeplata, og hengselet (oppå bunnplata) der planken dreies. */
const BENCH = 349;
const BASE_T = 0.025 * PX_PER_M;
const HX = 205;
const HY = BENCH - BASE_T;
const PLANK_PX = PLANK.length * PX_PER_M;
const PLANK_T = 0.025 * PX_PER_M;
const SKIVE_R = 0.25 * PX_PER_M;
const STOP = { bredde: PLANK.stop * PX_PER_M, hoyde: 0.035 * PX_PER_M };
/** Lengden på G-pila (piksler). De andre kreftene tegnes i samme skala. */
const G_LEN = 145;
/** Piksler per m/s² for akselerasjonspila (egen skala). Den største akselerasjonen er g · sin 60° = 8,5 m/s². */
const PX_PER_A = 18;

/** Utsnittet på mobil: bare skråplanet, så klossen og pilene blir store nok. */
const NARROW_VIEW = { x: HX - 48, y: 0, w: 448, h: H };
const FULL_VIEW = { x: 0, y: 0, w: W, h: H };

/** Klossens materiale i scene-kit-et. */
const KLOSS: Record<BlockMaterial, KlossMateriale> = { tre: 'tre', metall: 'metall', gummi: 'gummi', is: 'is' };

/** Kreftene i scenen (N). */
export interface SceneForces {
  G: number;
  Gpar: number;
  Gperp: number;
  N: number;
  R: number;
  a: number;
  moving: boolean;
}

export interface SkraplanSceneProps {
  alphaDeg: number;
  material: BlockMaterial;
  m: number;
  /** Klossens lengde og høyde (m). */
  size: { length: number; height: number };
  /** Hvor langt klossen har glidd ned planken (m). */
  slide: number;
  f: SceneForces;
  showForces: boolean;
  parts: boolean;
  status: string;
  /** Tekst for skjermlesere. */
  label: string;
}

export function SkraplanScene(props: SkraplanSceneProps) {
  const [ref, narrow] = useNarrow<HTMLDivElement>();
  const view = narrow ? NARROW_VIEW : FULL_VIEW;
  return (
    <div ref={ref}>
      <Figure viewBox={`${view.x} ${view.y} ${view.w} ${view.h}`} label={props.label} maxHeight={480}>
        <Backdrop material={props.material} />
        <SceneContent {...props} view={view} />
      </Figure>
    </div>
  );
}

/** Fysikkrommet: vegg, labbenk og klossene som ikke er i bruk, på benken til høyre. */
const Backdrop = memo(function Backdrop({ material }: { material: BlockMaterial }) {
  const spare = (Object.keys(KLOSS) as BlockMaterial[]).filter((k) => k !== material);
  // Reserveklossene er 1,5 kg hver, i samme skala som resten (samme mål som blockSize gir).
  const sizes: Record<BlockMaterial, [number, number]> = { tre: [0.142, 0.095], metall: [0.087, 0.058], gummi: [0.113, 0.075], is: [0.122, 0.081] };
  let x = 628;
  return (
    <g>
      <Rom x={-20} y={0} w={W + 40} h={H} gulvY={H - 4} gulv="betong" vindu vinduX={690} />
      <Underlag x1={-20} x2={W + 20} y={BENCH} depth={H - BENCH + 4} type="labbenk" />
      {spare.map((k) => {
        const [l, h] = sizes[k];
        const w = l * PX_PER_M;
        const cx = x + w / 2;
        x += w + 16;
        return <Kloss key={k} x={cx} y={BENCH} w={w} h={h * PX_PER_M} materiale={KLOSS[k]} />;
      })}
    </g>
  );
});

interface Pt {
  x: number;
  y: number;
}
const add = (p: Pt, v: Pt, k = 1): Pt => ({ x: p.x + v.x * k, y: p.y + v.y * k });

/** Omtrentlig bredde på en etikett i figurens enheter (fet skrift, 17 · f per tegn i høyden). */
function labelWidth(text: string, f: number): number {
  return text.length * 17 * f * 0.6;
}

function SceneContent({
  alphaDeg,
  material,
  m,
  size,
  slide,
  f: r,
  showForces,
  parts,
  status,
  view,
}: SkraplanSceneProps & { view: { x: number; y: number; w: number; h: number } }) {
  const fs = useTextScale();
  const deg = Math.min(90, Math.max(0, Number.isFinite(alphaDeg) ? alphaDeg : 0));
  const th = deg * RAD;
  const c = Math.cos(th);
  const sn = Math.sin(th);
  /** Oppover langs planken (mot høyre) og normalen ut fra plankeflaten. */
  const u: Pt = { x: c, y: -sn };
  const n: Pt = { x: -sn, y: -c };
  const hinge: Pt = { x: HX, y: HY };

  const bl = size.length * PX_PER_M;
  const bh = size.height * PX_PER_M;
  const along = (PLANK.start - Math.max(0, slide)) * PX_PER_M;
  /** Midt på kontaktflaten (ankerpunktet til klossen) og tyngdepunktet. */
  const P = add(add(hinge, n, PLANK_T), u, along);
  const C = add(P, n, bh / 2);

  const k = r.G > 0 ? G_LEN / r.G : 0;
  const gTip = add(C, { x: 0, y: 1 }, G_LEN);
  const nTip = add(C, n, r.N * k);
  const rTip = add(C, u, r.R * k);
  const parTip = add(C, u, -r.Gpar * k);
  const perpTip = add(C, n, -r.Gperp * k);

  // Akselerasjonen foran klossen (nedover langs planken), litt over plankeflaten, så den ikke dekker G∥.
  const aLen = Math.max(0, r.a) * PX_PER_A;
  const aFrom = add(add(C, u, -(bl / 2 + 10)), n, bh / 2 + 12);
  const aTo = add(aFrom, u, -aLen);
  const aText = `a = ${fmt(r.a, 2)} m/s²`;
  // Etiketten over midten av pila (ut fra planken) og mot venstre, bort fra klossen, G∥ og gradskiva.
  const aMid = add(add(aFrom, u, -aLen / 2), n, 15 * fs);
  const aLabelFits = aMid.x - labelWidth(aText, fs) > view.x + 6;

  // Etiketter like forbi spissen, i pilas retning.
  const beyond = (tip: Pt, dir: Pt, d = 15) => ({ x: tip.x + dir.x * d * fs, y: tip.y + dir.y * d * fs + 6 * fs });

  // Vinkelen mellom G og G⊥ er også α (vises når den er stor nok til å se).
  const smallR = 44;
  const smallEnd = add(C, n, -smallR);
  const smallLabel = add(C, { x: Math.sin(th / 2), y: Math.cos(th / 2) }, smallR + 15 * fs);

  // α mellom bunnplata og planken, ved hengselet
  const arcR = 44;
  const arcEnd = add(hinge, u, arcR);
  const arcLabel = deg >= 14 ? add(hinge, { x: Math.cos(th / 2), y: -Math.sin(th / 2) }, arcR + 14 * fs) : { x: HX + arcR + 10 * fs, y: HY - 4 };

  // Statusskiltet oppe til venstre, men nede på benkefronten på mobil (der utsnittet er smalt og klossen kan nå toppen).
  const narrow = view.w < W;
  const tagY = narrow ? view.y + view.h - 20 * Math.max(1, fs * 0.95) : view.y + 24 * Math.max(1, fs * 0.95);

  return (
    <g>
      <Vippeplan x={HX} y={HY} lengde={PLANK_PX} tykkelse={PLANK_T} vinkel={deg} skive={SKIVE_R} bunn={BASE_T} stopp={STOP} />
      <Kloss
        x={P.x}
        y={P.y}
        w={bl}
        h={bh}
        rotate={-deg}
        materiale={KLOSS[material]}
        label={bl >= 64 ? `${fmt(m, 1)} kg` : undefined}
        labelPlass="oppe-venstre"
        skygge={deg < 1}
      />

      {deg >= 1 && (
        <g>
          <path d={`M${HX + arcR},${HY} A${arcR},${arcR} 0 0 0 ${arcEnd.x},${arcEnd.y}`} fill="none" stroke={VIZ.ink} strokeWidth={1.6} opacity={0.8} />
          <Txt x={arcLabel.x} y={arcLabel.y + 6} anchor={deg >= 14 ? 'middle' : 'start'} weight={700}>
            α
          </Txt>
        </g>
      )}

      {showForces && (
        <g>
          {parts && deg > 0.5 && (
            <g>
              <line x1={parTip.x} y1={parTip.y} x2={gTip.x} y2={gTip.y} className="viz-guide" />
              <line x1={perpTip.x} y1={perpTip.y} x2={gTip.x} y2={gTip.y} className="viz-guide" />
              {deg >= 25 && (
                <>
                  <path d={`M${C.x},${C.y + smallR} A${smallR},${smallR} 0 0 0 ${smallEnd.x},${smallEnd.y}`} className="viz-guide" />
                  <Txt x={smallLabel.x} y={smallLabel.y + 6} size={0.9} muted weight={650}>
                    α
                  </Txt>
                </>
              )}
              <ForceArrow
                x1={C.x}
                y1={C.y}
                x2={parTip.x}
                y2={parTip.y}
                color={VIZ.gravity}
                dashed
                label={<>G∥</>}
                labelAnchor="end"
                labelX={parTip.x - 8 * fs}
                labelY={parTip.y + 18 * fs}
              />
              <ForceArrow
                x1={C.x}
                y1={C.y}
                x2={perpTip.x}
                y2={perpTip.y}
                color={VIZ.gravity}
                dashed
                label={<>G⊥</>}
                labelAnchor="start"
                labelX={perpTip.x + 10 * fs}
                labelY={perpTip.y + 2 * fs}
              />
            </g>
          )}
          <ForceArrow x1={C.x} y1={C.y} x2={gTip.x} y2={gTip.y} color={VIZ.gravity} label="G" labelAnchor="end" labelX={gTip.x - 10 * fs} labelY={gTip.y - 2} />
          <ForceArrow x1={C.x} y1={C.y} x2={nTip.x} y2={nTip.y} color={VIZ.normal} label="N" labelAnchor="middle" {...pos(beyond(nTip, n))} />
          <ForceArrow x1={C.x} y1={C.y} x2={rTip.x} y2={rTip.y} color={VIZ.friction} label="R" labelAnchor="middle" {...pos(beyond(rTip, u, 13))} minLength={4} />
          {r.moving && aLen > 4 && (
            <ForceArrow
              x1={aFrom.x}
              y1={aFrom.y}
              x2={aTo.x}
              y2={aTo.y}
              color={VIZ.acceleration}
              width={5}
              label={aLabelFits ? aText : 'a'}
              labelAnchor={aLabelFits ? 'end' : 'middle'}
              labelX={aMid.x}
              labelY={aMid.y + 5 * fs}
            />
          )}
          <circle cx={C.x} cy={C.y} r={3.6} fill={VIZ.ink} stroke={VIZ.surface} strokeWidth={1.6} />
        </g>
      )}

      <ValueTag x={view.x + 14} y={tagY} anchor="start" text={status} />
    </g>
  );
}

const pos = (p: Pt) => ({ labelX: p.x, labelY: p.y });
