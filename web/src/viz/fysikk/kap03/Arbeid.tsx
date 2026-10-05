import { useState, type ReactNode } from 'react';
import {
  Controls,
  Explain,
  Figure,
  Formula,
  FormulaLine,
  Legend,
  Plot,
  Readout,
  Readouts,
  Slider,
  Sub,
  TSub,
  Toggle,
  Toolbar,
  Txt,
  VIZ,
  VizLayout,
  fmt,
  scaleLinear,
  useTextScale,
} from '../../kit';
import {
  ForceArrow,
  Himmel,
  Kjelke,
  Landskap,
  Person,
  SCENE,
  Tau,
  Underlag,
  alpha as fade,
  personPunkter,
  shade,
  useStrokeScale,
  type Leddvinkler,
} from '../../kit/scene';
import { pullLayout, type PullLayout } from './arbeid-scene';
import { SLED_MASS, bestPullAngle, niceCeil, sledWork, type SledResult } from './model';
import { useNarrow } from './useNarrow';

/* ---------- Skala og mål i scenen ---------- */

/** Piksler per meter i scenen (samme for kjelken, barnet og den voksne). */
const P = 110;
/** Piksler per newton for alle kreftene (F, komponentene, R, G og N). */
const KF = 0.7;
/** Høyden på scenen og snøflaten. */
const H = 380;
const YG = 224;
/** Den voksne er 1,75 m, barnet på kjelken 1,05 m. Barnet og kjelken veier til sammen SLED_MASS. */
const ADULT_H = 1.75;
const CHILD_H = 1.05;
const CHILD_MASS = 19;
/**
 * Barnet sitter med sittebeina her på setet (m fra midten av kjelken), og med føttene på setet foran seg. Barnet
 * flytter seg fram på kjelken når den voksne holder igjen bakfra, så tauet og vinkelen bak får plass.
 */
const CHILD_SEAT = {
  front: { seat: -0.12, feet: 0.24 },
  rear: { seat: 0.1, feet: 0.43 },
} as const;
/** Tekst som står rett på snøen (mørk blågrå i begge temaer, siden snøen er lys også i skumringen). */
const SNOW_INK = shade(SCENE.snowShade, 0.6);
/** Største friksjon i modellen (μ = 0,5 og F = 0), så kjelken ikke flytter seg når μ endres. */
const R_MAX = 0.5 * SLED_MASS * 9.81;

interface Frame {
  /** Bredden på scenen (viewBox). */
  W: number;
  /** Lengste vannrette avstand fra festet til hendene før personen havner utenfor bildet (m). */
  dMax: number;
}
const FRAME_WIDE: Frame = { W: 800, dMax: 4.3 };
const FRAME_NARROW: Frame = { W: 560, dMax: 2.2 };

export default function Arbeid() {
  const [F, setF] = useState(150);
  const [alpha, setAlpha] = useState(30);
  const [s, setS] = useState(10);
  const [mu, setMu] = useState(0.1);
  const [forces, setForces] = useState(true);
  const [vertical, setVertical] = useState(false);
  const { ref, narrow } = useNarrow();
  const r = sledWork({ F, alphaDeg: alpha, s, mu });
  const frame = narrow ? FRAME_NARROW : FRAME_WIDE;
  const diagram = narrow ? { W: 560, H: 700 } : { W: 800, H: 320 };

  return (
    <VizLayout>
      <Controls>
        <Slider label="Kraft F" value={F} onChange={setF} min={0} max={200} step={5} unit="N" decimals={0} />
        <Slider label="Vinkel α" value={alpha} onChange={setAlpha} min={0} max={180} step={5} format={(v) => `${fmt(v, 0)}°`} />
        <Slider label="Strekning s" value={s} onChange={setS} min={1} max={20} step={1} unit="m" decimals={0} />
        <Slider label="Friksjonstall μ" value={mu} onChange={setMu} min={0} max={0.5} step={0.01} decimals={2} />
      </Controls>
      <Toolbar>
        <Toggle label="Vis krefter" checked={forces} onChange={setForces} />
        <Toggle label="Vis tyngde og normalkraft" checked={vertical} onChange={setVertical} />
      </Toolbar>

      <div ref={ref}>
        <Figure
          viewBox={`0 0 ${frame.W} ${H}`}
          label={`En voksen drar et barn på kjelke ${fmt(s, 0)} m bortover snøen med kraften ${fmt(F, 0)} N i et tau som danner vinkelen ${fmt(alpha, 0)} grader med bevegelsesretningen.`}
          maxHeight={narrow ? 420 : 470}
        >
          <Scene F={F} alpha={alpha} s={s} r={r} forces={forces} vertical={vertical} frame={frame} />
        </Figure>
      </div>
      {(forces || vertical) && (
        <Legend
          items={[
            ...(forces
              ? [
                  {
                    color: VIZ.applied,
                    label: 'Kraften F i tauet og komponentene',
                  },
                  { color: VIZ.friction, label: 'Friksjon R' },
                ]
              : []),
            ...(vertical
              ? [
                  { color: VIZ.gravity, label: 'Tyngde G' },
                  { color: VIZ.normal, label: 'Normalkraft N' },
                ]
              : []),
          ]}
        />
      )}

      <Figure
        viewBox={`0 0 ${diagram.W} ${diagram.H}`}
        label={`Til venstre: kraftkomponentene langs bevegelsen gjennom strekningen, der arealet er arbeidet. Til høyre: arbeidet hver kraft gjør, med fortegn. W F er ${fmt(r.WF, 0)} J, W R er ${fmt(r.WR, 0)} J, og totalt arbeid er ${fmt(r.W, 0)} J.`}
        maxHeight={narrow ? 680 : 340}
      >
        <WorkDiagram r={r} s={s} narrow={narrow} W={diagram.W} H={diagram.H} />
      </Figure>

      <Readouts>
        <Readout
          label={
            <>
              F<Sub>∥</Sub> = F cos α
            </>
          }
          value={fmt(r.Fpar, 1)}
          unit="N"
          tone={VIZ.applied}
        />
        <Readout
          label={
            <>
              Arbeid fra F, W<Sub>F</Sub>
            </>
          }
          value={fmt(r.WF, 0)}
          unit="J"
          tone={VIZ.applied}
        />
        <Readout
          label={
            <>
              Friksjonsarbeid W<Sub>R</Sub>
            </>
          }
          value={fmt(r.WR, 0)}
          unit="J"
          tone={VIZ.friction}
        />
        <Readout label="Totalt arbeid W" value={fmt(r.W, 0)} unit="J" />
      </Readouts>

      <Formula label="Arbeidet fra hver kraft">
        <FormulaLine>
          W<Sub>F</Sub> = F · s · cos α = {fmt(F, 0)} N · {fmt(s, 0)} m · cos {fmt(alpha, 0)}° = {fmt(r.WF, 0)} J
        </FormulaLine>
        <FormulaLine>
          W<Sub>R</Sub> = −R · s = −μ(mg − F sin α) · s = −{fmt(mu, 2)} · {fmt(r.N, 0)} N · {fmt(s, 0)} m = {fmt(r.WR, 0)} J
        </FormulaLine>
        <FormulaLine>
          W = W<Sub>F</Sub> + W<Sub>R</Sub> = {fmt(r.WF, 0)} J + ({fmt(r.WR, 0)} J) = {fmt(r.W, 0)} J
        </FormulaLine>
      </Formula>

      <Explain>{explanation(F, alpha, mu, r)}</Explain>
    </VizLayout>
  );
}

/* ---------- Scenen ---------- */

interface Pt {
  x: number;
  y: number;
}
type Anchor = 'start' | 'middle' | 'end';
interface LabelPos extends Pt {
  anchor: Anchor;
}

/**
 * Hvor kjelken står (x for midten av meiene), så kjelken, kreftene og personen får plass. Avhenger bare av vinkelen
 * (og bredden), så kjelken står stille når kraften, friksjonstallet eller strekningen endres.
 */
function sledX(L: PullLayout, frame: Frame): number {
  const { W } = frame;
  const margin = 14;
  // Utstrekningen i meter fra midten av kjelken, på siden der kjelken er og der personen er.
  const sledSide = 0.5 + (R_MAX * KF) / P + 0.18;
  const personSide = L.visible ? Math.abs(L.hand.x) + pullerReach(L) : Infinity;
  if (L.side === 1) {
    const left = -sledSide;
    if (!Number.isFinite(personSide)) return margin - left * P;
    const center = (left + personSide) / 2;
    const x = W / 2 - center * P;
    return Math.max(margin - left * P, Math.min(W - margin - personSide * P, x));
  }
  const right = sledSide;
  if (!Number.isFinite(personSide)) return W - margin - right * P;
  const center = (right - personSide) / 2;
  const x = W / 2 - center * P;
  return Math.min(W - margin - right * P, Math.max(margin + personSide * P, x));
}

/**
 * Hvor langt personen rekker bak hendene (m), regnet med største kraft (mest bakoverlent), så kjelken står stille når
 * F endres. Hodet, skuldrene, hofta og føttene, pluss litt for kroppens tykkelse.
 */
function pullerReach(L: PullLayout): number {
  const size = ADULT_H * P;
  const p = personPunkter('dra', size, pullerPose(L, 200), { x: 0, y: 0, tauvinkel: L.alphaEff, flip: L.side === 1 });
  const pts = [p.hode, p.nakke, p.skulder, p.hofte, p.venstreFot, p.hoyreFot, p.venstreAnkel, p.hoyreAnkel];
  const far = Math.max(...pts.map((q) => L.side * (q.x - p.hoyreHand.x)));
  return far / P + 0.16;
}

/** Lårbeinet og leggen i skjelettet til Person (enheter av en figur som er 100 høy, se figurer-skjelett.ts). */
const THIGH = 24.5;
const SHIN = 24;

/**
 * Vinklene (lår fra loddrett, legg fra loddrett, grader, positiv = fram) for et bein fra hofteleddet til ankelen i
 * (x, y) (y ned), med kneet framover. Samme regel som skjelettet bruker for festede føtter.
 */
function legAngles(x: number, y: number): [number, number] {
  const d = Math.min(THIGH + SHIN - 0.01, Math.max(Math.abs(THIGH - SHIN) + 0.01, Math.hypot(x, y)));
  const base = Math.atan2(x, y);
  const cosA = Math.min(1, Math.max(-1, (THIGH * THIGH + d * d - SHIN * SHIN) / (2 * THIGH * d)));
  const t = base + Math.acos(cosA);
  const kx = Math.sin(t) * THIGH;
  const ky = Math.cos(t) * THIGH;
  const ax = (x / Math.hypot(x, y)) * d;
  const ay = (y / Math.hypot(x, y)) * d;
  const sh = Math.atan2(ax - kx, ay - ky);
  return [(t * 180) / Math.PI, (sh * 180) / Math.PI];
}

/**
 * Leddvinklene til den som drar: lener seg mer bakover jo hardere og jo flatere hen drar. Må hendene holde tauet lavt
 * (crouch > 0), senkes hofta: det fremre beinet strekkes fram og tar imot, det bakre bøyes, som i tautrekking.
 */
function pullerPose(L: PullLayout, F: number): Partial<Leddvinkler> {
  const steep = Math.cos((L.alphaEff * Math.PI) / 180);
  const lean = -(5 + 21 * Math.min(1, F / 200)) * Math.pow(Math.max(0, steep), 0.7);
  const c = L.crouch;
  if (c <= 0) return { rygg: lean };
  const lerp = (a: number, b: number) => a + (b - a) * c;
  const rygg = lerp(lean, -30);
  // Hofta over ankelen (y ned), fremre og bakre ankel fram fra hofta.
  const depth = lerp(44, 28);
  const [frontT, frontS] = legAngles(lerp(22, 27), depth);
  const [backT, backS] = legAngles(lerp(-2.6, -3), depth);
  return {
    rygg,
    hoyreHofte: frontT + rygg,
    hoyreKne: frontT - frontS,
    venstreHofte: backT + rygg,
    venstreKne: backT - backS,
  };
}

/** Punkter langs en kvadratisk Bézier-kurve (til et slakt tau og tauenden som henger). */
function bezier(a: Pt, c: Pt, b: Pt, n = 16): [number, number][] {
  const out: [number, number][] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const u = 1 - t;
    out.push([u * u * a.x + 2 * u * t * c.x + t * t * b.x, u * u * a.y + 2 * u * t * c.y + t * t * b.y]);
  }
  return out;
}

function Scene({
  F,
  alpha,
  s,
  r,
  forces,
  vertical,
  frame,
}: {
  F: number;
  alpha: number;
  s: number;
  r: SledResult;
  forces: boolean;
  vertical: boolean;
  frame: Frame;
}) {
  const f = useTextScale();
  const ss = useStrokeScale();
  const { W } = frame;
  const L = pullLayout(alpha, frame.dMax);
  const xs = sledX(L, frame);
  /** Fra meter (x fram, y opp, origo midt under meiene) til figuren. */
  const at = (p: Pt): Pt => ({ x: xs + p.x * P, y: YG - p.y * P });
  const A = at(L.attach);
  /** Retningen til tauet og kraften i figuren (y ned). */
  const u = { x: L.dir.x, y: -L.dir.y };
  const hand = at(L.hand);

  // Barnet på kjelken.
  const childSize = CHILD_H * P;
  const cs = L.side === 1 ? CHILD_SEAT.front : CHILD_SEAT.rear;
  const seat = at({ x: cs.seat, y: 0.32 });
  const childFeet = {
    hoyreFot: at({ x: cs.feet, y: 0.32 }),
    venstreFot: at({ x: cs.feet - 0.03, y: 0.325 }),
  };
  const childHands = {
    hoyreHand: at({ x: cs.seat + 0.18, y: 0.36 }),
    venstreHand: at({ x: cs.seat + 0.15, y: 0.37 }),
  };
  const child = personPunkter('sitte', childSize, undefined, {
    x: seat.x,
    y: seat.y,
    fest: { ...childFeet, ...childHands },
  });
  // Tyngdepunktet til kjelke og barn: kjelken (6 kg) har tyngdepunktet midt i, ca. 18 cm over snøen.
  const sledCom = at({ x: 0, y: 0.18 });
  const mc = CHILD_MASS / SLED_MASS;
  const com = {
    x: sledCom.x + (child.tyngdepunkt.x - sledCom.x) * mc,
    y: sledCom.y + (child.tyngdepunkt.y - sledCom.y) * mc,
  };

  // Den som drar.
  const adultSize = ADULT_H * P;
  const flip = L.side === 1;
  const ledd = pullerPose(L, F);
  const grip0 = personPunkter('dra', adultSize, ledd, {
    x: 0,
    y: 0,
    tauvinkel: L.alphaEff,
    flip,
  });
  const anchorX = hand.x - grip0.hoyreHand.x;
  const backHand = { x: hand.x + u.x * 0.075 * P, y: hand.y + u.y * 0.075 * P };
  const slack = F === 0;

  // Tauet: stramt langs kraften, slakt når F = 0, og en ende som henger ned bak hendene.
  let rope: [number, number][];
  let tail: [number, number][] = [];
  if (!L.visible && slack) {
    // Slakt tau til en person utenfor bildet: det ligger på snøen.
    const ground = YG - 2;
    rope = [
      ...bezier(A, { x: A.x + L.side * 12, y: ground }, { x: A.x + L.side * 34, y: ground }, 8),
      [L.side === 1 ? W + 10 : -10, ground],
    ];
  } else if (!L.visible) {
    // Personen står utenfor bildet: tauet går ut av figuren langs kraften.
    const tx = u.x > 0 ? (W + 10 - A.x) / u.x : (-10 - A.x) / u.x;
    rope = [
      [A.x, A.y],
      [A.x + u.x * tx, A.y + u.y * tx],
    ];
  } else if (slack) {
    const len = Math.hypot(backHand.x - A.x, backHand.y - A.y);
    const mid = {
      x: (A.x + backHand.x) / 2,
      y: Math.min(YG - 4, (A.y + backHand.y) / 2 + 0.35 * len),
    };
    rope = bezier(A, mid, backHand);
  } else {
    rope = [
      [A.x, A.y],
      [backHand.x, backHand.y],
    ];
  }
  if (L.visible) {
    // Tauenden fortsetter litt forbi hånda og henger så rett ned.
    const t0 = { x: backHand.x + u.x * 4, y: backHand.y + u.y * 4 };
    const drop = Math.max(8, Math.min(0.36 * P, YG - 8 - t0.y));
    tail = bezier(t0, { x: t0.x + u.x * 9, y: t0.y + u.y * 9 + 2 }, { x: t0.x + u.x * 8, y: t0.y + drop }, 10);
  }

  // Kreftene.
  const tip = { x: A.x + u.x * F * KF, y: A.y + u.y * F * KF };
  const parTip = { x: A.x + r.Fpar * KF, y: A.y };
  const perpTip = { x: A.x, y: A.y - r.Fperp * KF };
  const showComp = forces && F > 0 && L.alphaEff > 0 && L.alphaEff < 90;
  // Komponenter som er kortere enn en pilspiss, tegnes ikke (verdiene står under figuren).
  const showPar = showComp && Math.abs(r.Fpar) * KF >= 14;
  const showPerp = showComp && r.Fperp * KF >= 14;
  // Friksjonen virker langs snøen mot bevegelsen; pila starter bakerst på meien.
  const rearContact = at({ x: -0.37, y: 0 });
  const rY = YG - 3;
  // Etikettene til F og F⊥ på siden der det er plass: «out» peker bort fra personen (mot kjelken).
  const out = -L.side;
  const ae = L.alphaEff;
  const nF = L.side === 1 ? { x: u.y, y: -u.x } : { x: -u.y, y: u.x };
  const outAnchor: Anchor = out < 0 ? 'end' : 'start';
  // F: nesten loddrett → ved siden av spissen, mot kjelken; ellers vinkelrett på pila, på siden mot F⊥.
  const fLabel: LabelPos =
    ae >= 75
      ? { x: (out < 0 ? Math.min(A.x, tip.x) : Math.max(A.x, tip.x)) + out * 10 * f, y: tip.y + 6 * f, anchor: outAnchor }
      : { x: tip.x + nF.x * 15 * f + u.x * 4, y: tip.y + nF.y * 15 * f + 6 * f, anchor: 'middle' };
  // F⊥: bratt → midt på pila, mot kjelken; ellers over spissen.
  const perpLabel: LabelPos =
    ae >= 50
      ? { x: A.x + out * 10 * f, y: A.y - (r.Fperp * KF) / 2 + 6 * f, anchor: outAnchor }
      : { x: A.x, y: perpTip.y - 10 * f, anchor: 'middle' };
  // F∥: under pila ved spissen. Bak kjelken er friksjonen R der, så da står etiketten inne i parallellogrammet,
  // eller (når det er for lavt) like forbi spissen.
  const parLabel: LabelPos =
    L.side === 1
      ? { x: parTip.x, y: A.y + 22 * f, anchor: r.Fpar >= 0 ? 'end' : 'start' }
      : r.Fperp * KF >= 30
        ? { x: parTip.x + 6 * f, y: A.y - 9 * f, anchor: 'start' }
        : { x: parTip.x - 8 * f, y: A.y + 6 * f, anchor: 'end' };
  // N ved siden av G, på siden bort fra tauet og personen, med etiketten på yttersiden.
  const nX = com.x - L.side * 15;

  // Vinkelen α mellom kraften og bevegelsesretningen (mot høyre), ved festet.
  const arcR = 30 + 4 * f;
  const a = (alpha * Math.PI) / 180;
  const arcEnd = { x: A.x + arcR * Math.cos(a), y: A.y - arcR * Math.sin(a) };
  // Etiketten α inne i vinkelen der det er plass, ellers like utenfor F.
  const labelDeg = L.side === 1 ? (ae < 25 || ae >= 80 ? alpha + 20 : alpha / 2) : alpha <= 110 ? alpha + 20 : (90 + alpha) / 2;
  const mid = (labelDeg * Math.PI) / 180;
  const showArc = F > 0 && alpha > 0;

  // Forflytningen: en pil i bevegelsesretningen på snøen, på siden der personen er.
  const sLen = 120;
  const sX0 = L.side === 1 ? xs + 0.75 * P : xs - 0.75 * P - sLen;
  const sY = YG + 66 + 6 * f;

  return (
    <g>
      <Himmel w={W} h={YG - 30} skyer={2} seed={11} />
      <Landskap x={0} y={YG - 30} w={W} h={70} type="skog" seed={3} />
      {/* Snøflaten fyller hele forgrunnen (kjelken står midt ute på et jorde) */}
      <Underlag x1={0} x2={W} y={H - 2} depth={2} type="sno" horisont={YG - 30} seed={5} />

      {/* Sporet etter meiene bak kjelken */}
      <g stroke={SCENE.snowShade} strokeLinecap="round" fill="none" opacity={0.9} aria-hidden>
        <line x1={-10} x2={xs - 0.3 * P} y1={YG - 2.5} y2={YG - 2.5} strokeWidth={1.6 * ss} />
        <line x1={-10} x2={xs - 0.3 * P} y1={YG + 2} y2={YG + 2} strokeWidth={2.2 * ss} />
      </g>

      <Kjelke x={xs} y={YG} size={0.9 * P} tau={false} />
      <Person
        x={seat.x}
        y={seat.y}
        size={childSize}
        pose="sitte"
        jakke="gronn"
        lue="gul"
        har="blond"
        bukse="blaa"
        sko="graa"
        fest={{ ...childFeet, ...childHands }}
      />

      <Tau points={rope} tykkelse={3.2 * ss} />
      {tail.length > 0 && <Tau points={tail} tykkelse={3.2 * ss} />}
      {L.visible && (
        <Person
          x={anchorX}
          y={YG}
          size={adultSize}
          pose="dra"
          flip={flip}
          tauvinkel={L.alphaEff}
          ledd={ledd}
          jakke="rod"
          lue="blaa"
          bukse={SCENE.denim}
          fest={{ hoyreHand: hand, venstreHand: backHand }}
        />
      )}
      {!L.visible && (
        <Txt
          x={L.side === 1 ? W - 14 : 14}
          y={sY + 30 * f}
          anchor={L.side === 1 ? 'end' : 'start'}
          size={0.8}
          color={SNOW_INK}
          halo={false}
        >
          {L.side === 1 ? 'Den som drar, står langt foran' : 'Den som holder igjen, står langt bak'}
        </Txt>
      )}

      {/* Vinkelen α */}
      {showArc && (
        <g>
          <line
            x1={A.x}
            y1={A.y}
            x2={A.x + arcR + 18}
            y2={A.y}
            stroke={VIZ.ink}
            strokeWidth={1.2 * ss}
            strokeDasharray="4 3"
            opacity={0.7}
          />
          <path
            d={`M${A.x + arcR},${A.y} A${arcR},${arcR} 0 0 0 ${arcEnd.x},${arcEnd.y}`}
            fill="none"
            stroke={VIZ.surface}
            strokeWidth={3.6 * ss}
            opacity={0.85}
          />
          <path
            d={`M${A.x + arcR},${A.y} A${arcR},${arcR} 0 0 0 ${arcEnd.x},${arcEnd.y}`}
            fill="none"
            stroke={VIZ.ink}
            strokeWidth={1.5 * ss}
          />
          <Txt x={A.x + (arcR + 13 * f) * Math.cos(mid)} y={A.y - (arcR + 13 * f) * Math.sin(mid) + 6 * f} size={0.95} weight={700}>
            α
          </Txt>
        </g>
      )}

      {/* Tyngde og normalkraft på kjelken med barnet */}
      {vertical && (
        <g>
          <ForceArrow
            x1={nX}
            y1={YG}
            x2={nX}
            y2={YG - r.N * KF}
            color={VIZ.normal}
            label="N"
            labelX={nX - L.side * 10 * f}
            labelAnchor={L.side === 1 ? 'end' : 'start'}
          />
          <ForceArrow
            x1={com.x}
            y1={com.y}
            x2={com.x}
            y2={com.y + r.G * KF}
            color={VIZ.gravity}
            label="G"
            labelX={com.x - 10 * f}
            labelAnchor="end"
            origin
          />
        </g>
      )}

      {forces && (
        <g>
          {showComp && (
            <g stroke={VIZ.muted} strokeWidth={1.2 * ss} strokeDasharray="4 4" opacity={0.85}>
              <line x1={tip.x} y1={tip.y} x2={parTip.x} y2={parTip.y} />
              <line x1={tip.x} y1={tip.y} x2={perpTip.x} y2={perpTip.y} />
            </g>
          )}
          {showPar && (
            <ForceArrow
              x1={A.x}
              y1={A.y}
              x2={parTip.x}
              y2={parTip.y}
              color={VIZ.applied}
              dashed
              label={
                <>
                  F<TSub>∥</TSub>
                </>
              }
              labelY={parLabel.y}
              labelX={parLabel.x}
              labelAnchor={parLabel.anchor}
            />
          )}
          {showPerp && (
            <ForceArrow
              x1={A.x}
              y1={A.y}
              x2={perpTip.x}
              y2={perpTip.y}
              color={VIZ.applied}
              dashed
              label={
                <>
                  F<TSub>⊥</TSub>
                </>
              }
              labelX={perpLabel.x}
              labelY={perpLabel.y}
              labelAnchor={perpLabel.anchor}
            />
          )}
          {F > 0 && (
            <ForceArrow
              x1={A.x}
              y1={A.y}
              x2={tip.x}
              y2={tip.y}
              color={VIZ.applied}
              label="F"
              labelX={fLabel.x}
              labelY={fLabel.y}
              labelAnchor={fLabel.anchor}
              origin
            />
          )}
          <ForceArrow x1={rearContact.x} y1={rY} x2={rearContact.x - r.R * KF} y2={rY} color={VIZ.friction} label="R" />
        </g>
      )}

      {/* Forflytningen s */}
      <ForceArrow
        x1={sX0}
        y1={sY}
        x2={sX0 + sLen}
        y2={sY}
        color={VIZ.ink}
        width={3.2}
        label={`s = ${fmt(s, 0)} m`}
        labelX={sX0 + sLen / 2}
        labelY={sY - 12 * f}
        labelAnchor="middle"
        labelSize={0.9}
      />
      <Txt x={L.side === 1 ? 14 : W - 14} y={H - 14} anchor={L.side === 1 ? 'start' : 'end'} size={0.8} color={SNOW_INK} halo={false}>
        Kjelke og barn: {SLED_MASS} kg
      </Txt>
    </g>
  );
}

/* ---------- Arbeid som areal og som stolper ---------- */

function WorkDiagram({ r, s, narrow, W, H: HD }: { r: SledResult; s: number; narrow: boolean; W: number; H: number }) {
  // PC: arealet til venstre og stolpene til høyre. Mobil: under hverandre.
  const area = narrow ? { x: 0, y: 0, w: W, h: 400 } : { x: 0, y: 0, w: 470, h: HD };
  const bars = narrow ? { x: 0, y: 414, w: W, h: HD - 414 } : { x: 480, y: 0, w: W - 480, h: HD };
  return (
    <g>
      <g transform={`translate(${area.x} ${area.y})`}>
        <AreaPlot r={r} s={s} w={area.w} h={area.h} />
      </g>
      {!narrow && <line x1={474} x2={474} y1={20} y2={HD - 20} stroke={VIZ.grid} strokeWidth={1} />}
      <g transform={`translate(${bars.x} ${bars.y})`}>
        <WorkBars r={r} w={bars.w} h={bars.h} />
      </g>
    </g>
  );
}

/** Stablede rektangler: positive verdier stables oppover fra null, negative nedover (som i et stolpediagram med fortegn). */
function stack(Fpar: number, R: number): { F: [number, number]; R: [number, number] } {
  if (Fpar >= 0) return { F: [0, Fpar], R: [-R, 0] };
  return { F: [Fpar, 0], R: [Fpar - R, Fpar] };
}

function AreaPlot({ r, s, w, h }: { r: SledResult; s: number; w: number; h: number }) {
  const f = useTextScale();
  const st = stack(r.Fpar, r.R);
  const lowest = Math.min(st.F[0], st.R[0]);
  const lo = lowest < -200 ? -Math.ceil(-lowest / 100) * 100 : -200;
  const ticks = [];
  for (let v = lo; v <= 200; v += 100) ticks.push(v);
  const top = 34 * f;
  return (
    <g>
      <Txt x={8} y={20 * f} anchor="start" size={0.9} weight={650}>
        Arbeidet er arealet under grafen
      </Txt>
      <g transform={`translate(0 ${top})`}>
        <Plot
          x={{
            min: 0,
            max: 20,
            label: 'Strekning (m)',
            ticks: [0, 5, 10, 15, 20],
          }}
          y={{ min: lo, max: 200, label: 'Kraft langs bevegelsen (N)', ticks }}
          width={w}
          height={h - top}
          margin={{ top: 10 * f, right: 14 * f, bottom: 50 * f, left: 74 * f }}
        >
          {({ sx, sy, x0, x1, y1 }) => {
            const x1s = sx(s);
            const rect = (span: [number, number]) => ({
              y: sy(span[1]),
              h: Math.abs(sy(span[0]) - sy(span[1])),
            });
            const rf = rect(st.F);
            const rr = rect(st.R);
            const fEdge = sy(r.Fpar);
            const label = (box: { y: number; h: number }, text: ReactNode, color: string, key: string, below: boolean) => {
              const fits = box.h > 24 * f && x1s - x0 > 150 * f;
              const cy = fits ? box.y + box.h / 2 + 6 * f : below ? box.y + box.h + 18 * f : box.y - 8 * f;
              return (
                <Txt
                  key={key}
                  x={fits ? (x0 + x1s) / 2 : Math.max(x0 + 8, Math.min(x1s, x0 + 8))}
                  y={cy}
                  anchor={fits ? 'middle' : 'start'}
                  size={0.85}
                  color={color}
                  weight={700}
                >
                  {text}
                </Txt>
              );
            };
            return (
              <g>
                {rf.h > 0.5 && (
                  <>
                    <rect x={x0} y={rf.y} width={x1s - x0} height={rf.h} fill={fade(VIZ.applied, 0.26)} />
                    <line x1={x0} x2={x1s} y1={fEdge} y2={fEdge} stroke={VIZ.applied} strokeWidth={3} />
                    <line x1={x1s} x2={x1s} y1={rf.y} y2={rf.y + rf.h} stroke={VIZ.applied} strokeWidth={1.5} />
                  </>
                )}
                {rr.h > 0.5 && (
                  <>
                    <rect x={x0} y={rr.y} width={x1s - x0} height={rr.h} fill={fade(VIZ.friction, 0.26)} />
                    <line x1={x0} x2={x1s} y1={sy(st.R[0])} y2={sy(st.R[0])} stroke={VIZ.friction} strokeWidth={3} />
                    <line x1={x1s} x2={x1s} y1={rr.y} y2={rr.y + rr.h} stroke={VIZ.friction} strokeWidth={1.5} />
                  </>
                )}
                {/* Høyden på rektangelet er kraftkomponenten F∥ (samme som den stiplede pila i scenen) */}
                {rf.h > 0.5 &&
                  (() => {
                    const roomRight = x1 - x1s > 96 * f;
                    // Til høyre for linja (men under «s» øverst), ellers inne ved enden av linja.
                    const y = roomRight ? Math.max(fEdge + 5 * f, y1 + 32 * f) : r.Fpar >= 0 ? fEdge - 7 * f : fEdge + 18 * f;
                    return (
                      <Txt
                        x={roomRight ? x1s + 7 : x1s - 6}
                        y={y}
                        anchor={roomRight ? 'start' : 'end'}
                        size={0.75}
                        color={VIZ.applied}
                        weight={650}
                      >
                        F<TSub>∥</TSub> = {fmt(r.Fpar, 0)} N
                      </Txt>
                    );
                  })()}
                {/* Strekningen s */}
                <line x1={x1s} x2={x1s} y1={y1} y2={sy(0)} stroke={VIZ.ink} strokeWidth={1.2} strokeDasharray="4 4" opacity={0.6} />
                <Txt x={x1s + 6} y={y1 + 14 * f} anchor="start" size={0.85} weight={650}>
                  s
                </Txt>
                {rf.h > 0.5 &&
                  label(
                    rf,
                    <>
                      W<TSub>F</TSub> = {fmt(r.WF, 0)} J
                    </>,
                    VIZ.applied,
                    'lf',
                    r.Fpar < 0,
                  )}
                {rr.h > 0.5 &&
                  label(
                    rr,
                    <>
                      W<TSub>R</TSub> = {fmt(r.WR, 0)} J
                    </>,
                    VIZ.friction,
                    'lr',
                    true,
                  )}
              </g>
            );
          }}
        </Plot>
      </g>
    </g>
  );
}

function WorkBars({ r, w, h }: { r: SledResult; w: number; h: number }) {
  const f = useTextScale();
  const cols: { label: ReactNode; value: number; color: string }[] = [
    {
      label: (
        <>
          W<TSub>F</TSub>
        </>
      ),
      value: r.WF,
      color: VIZ.applied,
    },
    {
      label: (
        <>
          W<TSub>R</TSub>
        </>
      ),
      value: r.WR,
      color: VIZ.friction,
    },
    {
      label: (
        <>
          W<TSub>G</TSub>
        </>
      ),
      value: r.WG,
      color: VIZ.gravity,
    },
    {
      label: (
        <>
          W<TSub>N</TSub>
        </>
      ),
      value: r.WN,
      color: VIZ.normal,
    },
    { label: 'Totalt', value: r.W, color: VIZ.ink },
  ];
  const lo = Math.min(0, r.WF, r.WR, r.W);
  const hi = Math.max(0, r.WF, r.W);
  const lo2 = lo < 0 ? -niceCeil(-lo, 4) : 0;
  let hi2 = hi > 0 ? niceCeil(hi, 4) : 0;
  if (hi2 - lo2 < 1) hi2 = 100;
  const top = 34 * f + 20 * f;
  const bottom = h - 34 * f - 18 * f;
  const ys = scaleLinear([lo2, hi2], [bottom, top]);
  const y0 = ys(0);
  const left = 10;
  const colW = (w - left - 10) / cols.length;
  const barW = Math.min(36, colW * 0.5);
  return (
    <g>
      <Txt x={left} y={20 * f} anchor="start" size={0.9} weight={650}>
        Arbeid fra hver kraft (J)
      </Txt>
      <line x1={left} x2={w - 10} y1={y0} y2={y0} className="viz-axis" />
      {cols.map((c, i) => {
        const cx = left + colW * (i + 0.5);
        const yv = ys(c.value);
        const zero = Math.abs(c.value) < 0.5;
        const up = c.value >= 0;
        return (
          <g key={i}>
            {!zero && (
              <rect
                x={cx - barW / 2}
                y={Math.min(y0, yv)}
                width={barW}
                height={Math.abs(yv - y0)}
                rx={3}
                fill={c.color}
                opacity={i === cols.length - 1 ? 0.88 : 0.8}
              />
            )}
            <Txt x={cx} y={zero ? y0 - 8 * f : up ? yv - 8 * f : yv + 18 * f} size={0.78} weight={700} color={c.color}>
              {fmt(c.value, 0)}
            </Txt>
            <Txt x={cx} y={h - 14 * f} size={0.9} weight={700} color={c.color}>
              {c.label}
            </Txt>
          </g>
        );
      })}
    </g>
  );
}

/* ---------- Forklaring ---------- */

function explanation(F: number, alpha: number, mu: number, r: SledResult): ReactNode {
  let first: ReactNode;
  if (F === 0)
    first = (
      <>
        <strong>Ingen kraft, ikke noe arbeid fra F.</strong> Tauet henger slakt.{' '}
        {mu > 0
          ? 'Kjelken glir bare hvis den har fart fra før, og da bremser friksjonen den.'
          : 'Uten friksjon glir kjelken videre med konstant fart hvis den har fart fra før.'}
      </>
    );
  else if (alpha === 0)
    first = (
      <>
        <strong>Positivt arbeid.</strong> Tauet er vannrett, langs bevegelsen. Da er cos 0° = 1, så hele kraften gjør arbeid: W<Sub>F</Sub>{' '}
        = F · s = {fmt(r.WF, 0)} J. I virkeligheten er det vanskelig, for hendene må være like lavt som festet på kjelken.
      </>
    );
  else if (alpha < 90)
    first = (
      <>
        <strong>Positivt arbeid.</strong> Bare komponenten langs bevegelsen, F<Sub>∥</Sub> = F cos α = {fmt(r.Fpar, 1)} N, gjør arbeid. F
        <Sub>⊥</Sub> står vinkelrett på bevegelsen og gjør ikke arbeid
        {mu > 0 ? ', men den løfter litt i kjelken, så normalkraften og friksjonen blir mindre.' : '.'}
      </>
    );
  else if (alpha === 90)
    first = (
      <>
        <strong>Null arbeid.</strong> Du drar rett opp, vinkelrett på bevegelsen. Siden cos 90° = 0, gjør F ikke arbeid, selv om kraften er{' '}
        {fmt(F, 0)} N. Den løfter bare litt i kjelken
        {mu > 0 ? ', så friksjonen blir mindre' : ''}.
      </>
    );
  else
    first = (
      <>
        <strong>Negativt arbeid.</strong> Nå står du bak kjelken og holder igjen. F<Sub>∥</Sub> peker mot bevegelsesretningen, og cos α er
        negativ når α er større enn 90°. Da bremser kraften kjelken og tar energi fra den: W<Sub>F</Sub> = {fmt(r.WF, 0)} J.
      </>
    );
  const dEk =
    Math.abs(r.W) < 0.5
      ? 'farten er den samme'
      : r.W > 0
        ? 'kjelken får mer fart'
        : F > 0
          ? 'kjelken mister fart. Det går bare hvis den hadde nok fart fra før til å komme hele strekningen'
          : 'kjelken mister fart';

  let practical: ReactNode = null;
  if (F > 0 && alpha < 90) {
    const best = bestPullAngle(mu);
    const share = Math.cos((alpha * Math.PI) / 180);
    practical = (
      <p>
        {alpha === 0
          ? 'Det er derfor det lønner seg å dra med tauet så flatt som mulig: da går hele kraften med til å dra kjelken framover.'
          : `Det er derfor det lønner seg å dra med tauet ganske flatt: med α = ${fmt(alpha, 0)}° er det bare F cos α, ${fmt(100 * share, 0)} % av kraften, som drar kjelken framover.`}
        {mu > 0 ? (
          <>
            {' '}
            Litt på skrå er likevel best når det er friksjon, fordi F<Sub>⊥</Sub> letter på kjelken. For samme kraft blir det totale
            arbeidet størst når tan α = μ, her α ≈ {fmt(best, best < 10 ? 1 : 0)}°.
          </>
        ) : null}
      </p>
    );
  } else if (F > 0 && alpha === 90) {
    practical = <p>Det er derfor det ikke hjelper å dra rett opp i tauet: kjelken blir lettere, men ikke raskere.</p>;
  } else if (F > 0 && alpha > 90) {
    practical = (
      <p>Det er derfor du går bak og holder igjen kjelken i en bratt bakke: kraften din gjør negativt arbeid og tar fart fra kjelken.</p>
    );
  }

  return (
    <>
      <p>{first}</p>
      <p>
        {mu > 0
          ? 'Friksjonsarbeidet er alltid negativt fordi R peker mot bevegelsen. '
          : F > 0
            ? 'Uten friksjon er F den eneste kraften som gjør arbeid. '
            : ''}
        G og N står vinkelrett på bevegelsen og gjør ikke arbeid. Totalt arbeid er W = {fmt(r.W, 0)} J, og det er lik endringen i kinetisk
        energi, ΔE
        <Sub>k</Sub>: {dEk}. I diagrammet er arbeidet arealet mellom grafen og strekningsaksen: over aksen positivt, under aksen negativt.
      </p>
      {practical}
    </>
  );
}
