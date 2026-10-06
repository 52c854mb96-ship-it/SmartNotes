/**
 * Figuren til eksempeloppgaven «Vogn og lodd over en trinse» (k2-eks-trinse): et labbord med en dynamikkvogn (eller
 * en trekloss i deloppgave e), en snor over en trinse på bordkanten og et lodd som henger over gulvet.
 *
 * Avstandene (bordhøyden 0,85 m, høyden h og strekningen vogna ruller) er i én fast skala, 340 px/m, og vogna er
 * tegnet i riktig størrelse (0,20 m lang). Trinsa og loddet er tegnet større enn i virkeligheten (ca. 1,6 og 3 ganger),
 * ellers ville de vært for små til å se. Kraftpilene har én skala per tallsett: G₁ er alltid 118 px lang.
 */
import type { ReactNode } from 'react';
import { Figure, TSub, Txt, VIZ, fmt } from '../../kit';
import { Bord, Callout, Dimension, ForceArrow, Kloss, Lodd, Rom, SCENE, Snor, Trinse, ValueTag, Vogn, useStrokeScale } from '../../kit/scene';
import type { PulleySolution, PulleyTask } from './model-eks-trinse';
import { useNarrow } from './useNarrow';

/** Hva figuren viser i hvert steg. Settes på stegene i EksTrinse.tsx. */
export type TrinseFig =
  | 'oppgave'
  | 'vogn'
  | 'lodd'
  | 'system'
  | 'aks'
  | 'S-vogn'
  | 'S-lodd'
  | 'fart'
  | 'friksjon'
  | 'aks-friksjon'
  | 'S-friksjon'
  | 'alle';

const W = 800;
const H = 470;
/** Piksler per meter for avstandene i scenen. */
const K = 340;
const Y_FLOOR = 446;
/** Bordhøyden (m). */
const TABLE_H = 0.85;
const Y_TOP = Y_FLOOR - TABLE_H * K;
const X_EDGE = 560;
/** Vogna er 0,20 m lang. */
const CART = 0.2 * K;
/** Snora går like høyt over bordet som festet midt på enden av vogna (0,2 · lengden). */
const ATT = 0.2 * CART;
const Y_SNOR = Y_TOP - ATT;
/** Trinsa: radius (forstørret) og akselen, med tvingen på bordkanten. */
const R_P = 14;
const X_P = X_EDGE + 1.5 * R_P;
const Y_P = Y_SNOR + R_P;
/** Loddet henger rett under høyre side av trinsa. */
const X_L = X_P + R_P;
/** Fronten av vogna ved start: 0,68 m fra bordkanten, så vogna har plass til å rulle h ≤ 0,5 m. */
const X_FRONT0 = X_EDGE - 0.68 * K;
/** Snora er knyttet i en øyeskrue foran på vogna; her slutter snora. */
const EYE = 5.6;
/** Treklossen i e) er like høy som festet på vogna ganger to, så snora går like høyt. */
const KLOSS_W = 64;
const KLOSS_H = 2 * ATT;
/** Øyeskruen på klossen (se Kloss: rr = min(6, max(2,5, 0,1 · h))). */
const KLOSS_RR = Math.min(6, Math.max(2.5, 0.1 * KLOSS_H));
/** Lengden på G₁-pila; de andre kreftene tegnes i samme skala (px/N). */
const G1_LEN = 118;
/** Akselerasjon og fart har egne skalaer (px per m/s² og px per m/s). */
const A_K = 14;
const V_K = 40;

/** Loddets diameter i figuren: 24 for 200 g, og større eller mindre som massen i tredje rot (samme materiale). */
function loddSize(m2: number): number {
  return 24 * Math.cbrt(Math.max(0.02, m2) / 0.2);
}

/** Punkter langs en sirkelbue (grader, med klokka fra x-aksen fordi y peker ned). */
function arc(cx: number, cy: number, r: number, from: number, to: number, n = 8): [number, number][] {
  return Array.from({ length: n + 1 }, (_, i) => {
    const a = ((from + ((to - from) * i) / n) * Math.PI) / 180;
    return [cx + Math.cos(a) * r, cy + Math.sin(a) * r];
  });
}

export function TrinseFigure({ task, s, fig }: { task: PulleyTask; s: PulleySolution; fig: TrinseFig }) {
  const [ref, narrow] = useNarrow<HTMLDivElement>();
  return (
    <div ref={ref}>
      <TrinseScene task={task} s={s} fig={fig} narrow={narrow} />
    </div>
  );
}

function TrinseScene({ task, s, fig, narrow }: { task: PulleyTask; s: PulleySolution; fig: TrinseFig; narrow: boolean }) {
  const kloss = fig === 'friksjon' || fig === 'aks-friksjon' || fig === 'S-friksjon';
  const moved = fig === 'fart';
  const all = fig === 'alle';
  const travel = moved ? task.h * K : 0;
  const D = loddSize(task.m2);
  const yL0 = Y_FLOOR - task.h * K - 2 * D;
  const yL = yL0 + travel;
  const yCm = yL + 1.36 * D;
  const front = X_FRONT0 + travel;
  const snorX = front + EYE;
  const cx = kloss ? snorX - KLOSS_W / 2 - 2.9 * KLOSS_RR : front - CART / 2;
  // Tyngdepunktet: midt i klossen, eller litt over midten av vognkroppen (ekstraloddene ligger oppå).
  const cy = kloss ? Y_TOP - KLOSS_H / 2 : Y_TOP - 0.24 * CART;
  const k = G1_LEN / s.G1;
  const S = kloss ? s.SF : s.S;
  const a = kloss ? s.aF : s.a;

  const forces = fig !== 'oppgave' && !moved;
  const loddForces = forces && fig !== 'vogn';
  const showA = all || fig === 'aks' || fig === 'aks-friksjon';
  const showH = fig === 'oppgave' || moved || all;
  // Det steget ikke handler om, tones ned.
  const dimCart = fig === 'system' || fig === 'S-lodd';
  const dimLodd = fig === 'S-vogn' || fig === 'friksjon';
  const dimLoddS = fig === 'system';

  const gram = `${fmt(task.m2 * 1000, 0)} g`;
  const label = kloss
    ? `En trekloss på ${fmt(task.m1, 2)} kg på et vannrett labbord, trukket av et lodd på ${gram} i en snor over en trinse på bordkanten.`
    : `En dynamikkvogn på ${fmt(task.m1, 2)} kg på et vannrett labbord, trukket av et lodd på ${gram} i en snor over en trinse på bordkanten. Loddet henger ${fmt(task.h, 2)} m over gulvet.`;

  // På mobil zoomes figuren inn på vogna, trinsa og loddet.
  const vb = narrow ? `225 0 480 ${H}` : `0 0 ${W} ${H}`;
  const sLabel = (v: number) => `S = ${fmt(v, 2)} N`;

  return (
    <Figure viewBox={vb} label={label} maxHeight={500}>
      <Rom x={0} y={0} w={W} h={H} gulvY={396} gulv="betong" vindu vinduX={140} />
      <Bord x={(X_EDGE - 60) / 2} y={Y_TOP} w={X_EDGE + 60} h={TABLE_H * K} type="lab" />
      <Trinse
        x={X_P}
        y={Y_P}
        r={R_P}
        feste="bordkant"
        snorHoyde={ATT}
        bordtykkelse={14}
        hjulvinkel={((travel / R_P) * 180) / Math.PI}
      />

      {/* Startstillingen nedtonet når vogna har rullet */}
      {moved && (
        <>
          <Vogn x={X_FRONT0 - CART / 2} y={Y_TOP} size={CART} lakk="blaa" stotfanger="ingen" lodd={task.bars} dim />
          <Lodd x={X_L} y={yL0} size={D} dim />
        </>
      )}

      <Snor points={[[snorX, Y_SNOR], [X_P, Y_SNOR], ...arc(X_P, Y_P, R_P, -90, 0), [X_L, yL]]} />
      {kloss ? (
        <Kloss x={cx} y={Y_TOP} w={KLOSS_W} h={KLOSS_H} materiale="tre" krok="hoyre" />
      ) : (
        <>
          <Vogn
            x={front - CART / 2}
            y={Y_TOP}
            size={CART}
            lakk="blaa"
            stotfanger="ingen"
            lodd={task.bars}
            hjulvinkel={((travel / (0.07 * CART)) * 180) / Math.PI}
          />
          <Oeye x={front} y={Y_SNOR} />
        </>
      )}
      <Lodd x={X_L} y={yL} size={D} />

      {fig === 'oppgave' && (
        <>
          <Callout x={cx + 14} y={Y_TOP - 24} lx={cx + 44} ly={Y_TOP - 74}>
            m<TSub>1</TSub> = {fmt(task.m1, 2)} kg
          </Callout>
          <Callout x={X_L + D / 2} y={yL + 1.3 * D} lx={X_L + 30} ly={yL + 4}>
            m<TSub>2</TSub> = {fmt(task.m2, 2)} kg
          </Callout>
          <Callout x={X_P + 6} y={Y_P - 12} lx={X_P + 34} ly={Y_P - 58}>
            trinse
          </Callout>
        </>
      )}

      {showH && (
        <Dimension x1={X_L} y1={yL0 + 2 * D} x2={X_L} y2={Y_FLOOR} offset={72} label={`h = ${fmt(task.h, 2)} m`} />
      )}

      {moved && (
        <>
          <Dimension x1={X_FRONT0} y1={Y_TOP - 22} x2={front} y2={Y_TOP - 22} offset={58} label={`s = h = ${fmt(task.h, 2)} m`} />
          <ForceArrow x1={cx + 6} y1={Y_TOP - 50} x2={cx + 6 + s.v * V_K} y2={Y_TOP - 50} color={VIZ.velocity} width={5} label="v" />
          <ForceArrow
            x1={X_L + 32}
            y1={Y_FLOOR - 2 * D - 26}
            x2={X_L + 32}
            y2={Y_FLOOR - 2 * D - 26 + s.v * V_K}
            color={VIZ.velocity}
            width={5}
            label="v"
          />
        </>
      )}

      {fig === 'system' && <PlusPath x1={snorX + 18} />}

      {/* Kreftene på vogna eller klossen */}
      {forces && (
        <g opacity={dimCart ? 0.3 : 1}>
          <ForceArrow x1={cx} y1={cy} x2={cx} y2={cy + s.G1 * k} color={VIZ.gravity} label={<>G<TSub>1</TSub></>} origin />
          <ForceArrow x1={cx} y1={cy} x2={cx} y2={cy - s.N * k} color={VIZ.normal} label="N" />
          {kloss && (
            <ForceArrow
              x1={cx - KLOSS_W / 2}
              y1={Y_TOP - 4}
              x2={cx - KLOSS_W / 2 - s.R * k}
              y2={Y_TOP - 4}
              color={VIZ.friction}
              label={fig === 'friksjon' ? `R = ${fmt(s.R, 3)} N` : 'R'}
            />
          )}
        </g>
      )}
      {forces && (
        <g opacity={dimCart ? 0.3 : 1}>
          <ForceArrow
            x1={snorX}
            y1={Y_SNOR}
            x2={snorX + S * k}
            y2={Y_SNOR}
            color={VIZ.tension}
            label={fig === 'S-vogn' || fig === 'S-friksjon' ? sLabel(S) : 'S'}
          />
        </g>
      )}

      {/* Kreftene på loddet. S-etiketten står til venstre, så høyre side er fri for a, v og h. */}
      {loddForces && (
        <>
          <g opacity={dimLodd || dimLoddS ? 0.3 : 1}>
            <ForceArrow
              x1={X_L}
              y1={yL}
              x2={X_L}
              y2={yL - S * k}
              color={VIZ.tension}
              label={fig === 'S-lodd' || fig === 'S-friksjon' ? sLabel(S) : 'S'}
              labelAnchor="end"
              labelX={X_L - 10}
              labelY={yL - S * k + 12}
            />
          </g>
          <g opacity={dimLodd ? 0.3 : 1}>
            <ForceArrow
              x1={X_L}
              y1={yCm}
              x2={X_L}
              y2={yCm + s.G2 * k}
              color={VIZ.gravity}
              label={fig === 'S-lodd' ? <>G<TSub>2</TSub> = {fmt(s.G2, 2)} N</> : <>G<TSub>2</TSub></>}
              origin
            />
          </g>
        </>
      )}

      {showA && (
        <>
          <ForceArrow x1={cx + 8} y1={Y_TOP - 52} x2={cx + 8 + a * A_K} y2={Y_TOP - 52} color={VIZ.acceleration} width={5} label="a" />
          <ForceArrow x1={X_L + 32} y1={yL + 2} x2={X_L + 32} y2={yL + 2 + a * A_K} color={VIZ.acceleration} width={5} label="a" />
        </>
      )}

      {fig === 'friksjon' && (
        <Callout x={cx + 18} y={Y_TOP - KLOSS_H + 4} lx={cx + 42} ly={Y_TOP - 70}>
          trekloss
        </Callout>
      )}
      {fig === 'aks-friksjon' && (
        <ValueTag x={cx + 150} y={56} text={`a = ${fmt(s.aF, 2)} m/s² (før ${fmt(s.a, 2)} m/s²)`} color={VIZ.acceleration} />
      )}
      {fig === 'S-friksjon' && <ValueTag x={cx + 150} y={56} text={`S = ${fmt(s.SF, 2)} N (før ${fmt(s.S, 2)} N)`} />}
    </Figure>
  );
}

/** Øyeskrue foran på vogna, der snora er knyttet. (x, y) er enden av vogna midt på. */
function Oeye({ x, y }: { x: number; y: number }) {
  const ss = useStrokeScale();
  return (
    <g fill="none">
      <line x1={x - 0.5} y1={y} x2={x + 1.4} y2={y} stroke={SCENE.metalDark} strokeWidth={1.6 * ss} />
      <circle cx={x + 3.3} cy={y} r={2.2} stroke={SCENE.outline} strokeWidth={2.3 * ss} />
      <circle cx={x + 3.3} cy={y} r={2.2} stroke={SCENE.metal} strokeWidth={1.2 * ss} />
    </g>
  );
}

/**
 * Positiv retning langs snora: en stiplet linje litt utenfor snora, fra vogna, rundt trinsa og ned ved siden av
 * loddet, med pilspiss og tekst.
 */
function PlusPath({ x1 }: { x1: number }): ReactNode {
  const ss = useStrokeScale();
  const d = 24;
  const r = R_P + d;
  const yTop = Y_SNOR - d;
  const xDown = X_P + r;
  const yEnd = Y_P + 40;
  const path = `M${x1},${yTop} H${X_P} A${r},${r} 0 0 1 ${xDown},${Y_P} V${yEnd}`;
  const hw = 6 * ss;
  return (
    <g>
      <path d={path} fill="none" stroke={VIZ.surface} strokeWidth={4 * ss} opacity={0.8} />
      <path d={path} fill="none" stroke={VIZ.ink} strokeWidth={1.6 * ss} strokeDasharray={`${6 * ss} ${4 * ss}`} />
      <polygon points={`${xDown - hw},${yEnd - 2} ${xDown + hw},${yEnd - 2} ${xDown},${yEnd + 11 * ss}`} fill={VIZ.ink} />
      <Txt x={x1} y={yTop - 9} anchor="start" size={0.85} weight={650}>
        positiv retning
      </Txt>
    </g>
  );
}
