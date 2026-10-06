/**
 * Lupen til «Gevær og kule» i «Eksplosjon og rekyl»: løpet gjennomskåret og forstørret, med sluttstykket, patronhylsa,
 * kruttet eller kruttgassen og kula. Kraftparet fra kruttgassen er tegnet der det virker: på bunnen av kula (framover)
 * og på sluttstykket (bakover). Når kula er langt fram i løpet, er et stykke av løpet tatt ut (brudd), så kula alltid
 * synes. Egen gjenstand i samme stil som scene-kit-et (toninger fra core, SCENE-farger, kontur).
 */
import type { ReactNode } from 'react';
import { TSub, Txt, VIZ, fmt, useTextScale } from '../../kit';
import { ForceArrow, LinearGradient, SCENE, alpha, sceneRandom, shade, tint, useStrokeScale, useSvgId } from '../../kit/scene';
import { Gevaerkule, RIFLE } from './eksplosjon-deler';
import { barrelCut } from './eksplosjon-form';
import { forceText } from './eksplosjon-scene';

const r2 = (v: number) => (Number.isFinite(v) ? Math.round(v * 100) / 100 : 0);

/** Halve høyden av vinduet i lupen (m): boringen, patronen og litt av stålet rundt. */
const HW = 0.0095;
/** Hvor langt kula sitter inne i halsen på patronhylsa før skuddet (m). */
const SEAT = 0.006;
/** Patronhylsa: lengde (som i RIFLE), skulder og hals (m fra bunnen). */
const LC = RIFLE.caseLength;
const U_SHOULDER = LC - 0.0115;
const U_NECK = LC - 0.0075;
/** Overgangen fra halsen til boringen i løpet. */
const U_THROAT = LC + 0.004;
/** Munningen, målt fra sluttstykket: kula går RIFLE.barrel fra der den sitter til munningen. */
export const U_MUZZLE = LC - SEAT + RIFLE.barrel;
/** Hvor mye av løpet som vises foran kulespissen og etter munningen (m), og bredden på bruddet (figurens enheter). */
const AHEAD = 0.014;
const AFTER = 0.03;
const GAP = 28;

/** Høyden lupen trenger (figurens enheter) med tekstskaleringen f og forstørrelsen M (px/m). */
export function lupeHeight(f: number, M: number): number {
  return windowTop(f) + 2 * HW * M + 10;
}

/** Overskriften, raden med etiketter og toppen av vinduet, målt fra toppen av lupen. */
function titleBase(f: number) {
  return 6 + 15 * f;
}
function labelBase(f: number) {
  return titleBase(f) + 10 + 14.5 * f;
}
function windowTop(f: number) {
  return labelBase(f) + 5 + 5 * f;
}

/** Hvor langt bak sluttstykket lupen begynner (m), så pila for kraften på geværet får plass: pila + litt luft. */
export function lupeBack(maxArrow: number, M: number): number {
  return (maxArrow + 16) / M;
}

export interface LupeProps {
  x: number;
  y: number;
  w: number;
  h: number;
  /** Piksler per meter i lupen, og forstørrelsen i forhold til geværet i scenen. */
  M: number;
  zoom: number;
  /** Hvor langt kula har gått i løpet (m, fra der den satt), også etter at den har forlatt munningen. */
  travel: number;
  /** Før skuddet: kruttet ligger i hylsa. */
  powder: boolean;
  /** Kruttgassen (0–1): full mens kula er i løpet, og den blekner etterpå. */
  gas: number;
  /** Kraften fra kruttgassen mens kula er i løpet (N), eller null. `kF` er piksler per newton, `maxArrow` den lengste pila. */
  force: number | null;
  kF: number;
  maxArrow: number;
  bulletLength: number;
  bulletDiameter: number;
}

export function RifleLupe({ x, y, w, h, M, zoom, travel, powder, gas, force, kF, maxArrow, bulletLength, bulletDiameter }: LupeProps) {
  const f = useTextScale();
  const ss = useStrokeScale();
  const id = useSvgId('lupe');
  const rb = Math.min(bulletDiameter, 2 * RIFLE.bore) / 2;
  const RN = rb + 0.0004;
  const RC = Math.max(0.006, RN + 0.0013);
  const RS = RC - 0.0004;

  const x0 = x + 10;
  const x1 = x + w - 10;
  const top = y + windowTop(f);
  const iy = top + HW * M;
  const bottom = top + 2 * HW * M;
  const back = lupeBack(maxArrow, M);
  const uA = LC + 0.012;
  const ub = LC - SEAT + Math.max(0, travel);
  const uEnd = Math.min(ub + bulletLength + AHEAD, U_MUZZLE + AFTER);
  const cut = barrelCut({ x0, x1, M, back, uA, gap: GAP, uEnd });
  const xA = (u: number) => cut.offA + u * M;
  const xBullet = (cut.broken ? cut.offB : cut.offA) + ub * M;
  const inBarrel = ub < U_MUZZLE;
  const gasEnd = inBarrel ? ub : U_MUZZLE;
  const gasLevel = Math.max(0, Math.min(1, gas));

  // Bruddet: siksakkanter på hver side av mellomrommet (også klippekanten for avsnittene)
  const zig = (xe: number, dir: 1 | -1) => {
    const n = 6;
    const amp = 4 * ss;
    const pts: string[] = [];
    for (let i = 0; i <= n; i++) pts.push(`${r2(xe + (i % 2 === 0 ? 0 : dir * amp))},${r2(top - 2 + ((bottom - top + 4) * i) / n)}`);
    return pts;
  };
  const clipA = cut.broken
    ? `M${r2(x0)},${r2(top - 2)}L${zig(cut.xA1, -1).join('L')}L${r2(x0)},${r2(bottom + 2)}Z`
    : `M${r2(x0)},${r2(top)}H${r2(x1)}V${r2(bottom)}H${r2(x0)}Z`;
  const clipB = `M${zig(cut.xB0, 1).join('L')}L${r2(x1)},${r2(bottom + 2)}L${r2(x1)},${r2(top - 2)}Z`;

  // Hva som er synlig av løpet i hvert avsnitt (m), så rillene bare tegnes der
  const rangeA: [number, number] = [-back, cut.broken ? uA : (x1 - cut.offA) / M];
  const rangeB: [number, number] = [(cut.xB0 - cut.offB) / M, (x1 - cut.offB) / M];

  const content = (off: number, range: [number, number]) => (
    <g transform={`translate(${r2(off)} ${r2(iy)})`}>
      <Barrel M={M} rb={rb} RN={RN} RC={RC} RS={RS} range={range} id={id} />
      <CaseAndGas M={M} rb={rb} RN={RN} RC={RC} RS={RS} powder={powder} gas={gasLevel} gasEnd={gasEnd} id={id} />
      {ub * M + off < x1 + 4 && <Gevaerkule x={ub * M} y={0} P={M} length={bulletLength} diameter={2 * rb} />}
    </g>
  );

  const label = (lx: number, width: number, node: ReactNode, color?: string, muted?: boolean) => {
    const cx = Math.min(x1 - width / 2, Math.max(x0 + width / 2, lx));
    return (
      <Txt x={cx} y={y + labelBase(f)} size={muted ? 0.75 : 0.85} weight={muted ? 600 : 700} color={color} muted={muted}>
        {node}
      </Txt>
    );
  };
  const wBold = (t: string) => t.length * 17 * 0.85 * f * 0.62 + 6;
  const wMuted = (t: string) => t.length * 17 * 0.75 * f * 0.56 + 6;

  const forcesNow = force !== null && force > 0;
  const len = forcesNow ? force * kF : 0;
  const caseMid = xA((0.005 + U_SHOULDER) / 2);
  const gasText = powder ? 'krutt' : gasLevel > 0.25 ? 'kruttgass' : null;
  const hiddenText = cut.broken ? `${fmt(cut.hidden * 100, 0)} cm ikke vist` : '';
  const bulletMid = xBullet + (bulletLength * M) / 2;

  return (
    <g>
      <LinearGradient
        id={`${id}st`}
        stops={[
          [0, tint(SCENE.metalDark, 0.3)],
          [0.45, SCENE.metalDark],
          [1, shade(SCENE.metalDark, 0.35)],
        ]}
      />
      <LinearGradient
        id={`${id}bo`}
        stops={[
          [0, tint(SCENE.metal, 0.1)],
          [0.5, SCENE.metal],
          [1, shade(SCENE.metal, 0.25)],
        ]}
      />
      <LinearGradient
        id={`${id}br`}
        stops={[
          [0, tint(SCENE.gold, 0.35)],
          [0.4, SCENE.gold],
          [1, shade(SCENE.gold, 0.35)],
        ]}
      />
      <LinearGradient
        id={`${id}gas`}
        stops={[
          [0, SCENE.hot, 0.8],
          [0.5, SCENE.glow, 0.95],
          [1, SCENE.hot, 0.8],
        ]}
      />
      <defs>
        <clipPath id={`${id}a`}>
          <path d={clipA} />
        </clipPath>
        <clipPath id={`${id}b`}>
          <path d={clipB} />
        </clipPath>
      </defs>
      {/* Kortet */}
      <rect x={x + 3} y={y + 4} width={w} height={h} rx={10} fill={alpha(SCENE.shadow, 0.35)} />
      <rect x={x} y={y} width={w} height={h} rx={10} fill={VIZ.surface} opacity={0.97} stroke={SCENE.outline} strokeWidth={1 * ss} />
      <Txt x={x + 12} y={y + titleBase(f)} anchor="start" size={0.85} weight={700}>
        Inni løpet, forstørret {fmt(zoom, 0)} ganger
      </Txt>

      {/* Avsnitt A (sluttstykket og patronen), og avsnitt B rundt kula når løpet er brutt */}
      <g clipPath={`url(#${id}a)`}>{content(cut.offA, rangeA)}</g>
      {cut.broken && <g clipPath={`url(#${id}b)`}>{content(cut.offB, rangeB)}</g>}
      {cut.broken && (
        <g fill="none" stroke={VIZ.ink} strokeWidth={1.1 * ss} strokeLinejoin="round" opacity={0.8}>
          <polyline points={zig(cut.xA1, -1).join(' ')} />
          <polyline points={zig(cut.xB0, 1).join(' ')} />
        </g>
      )}

      {/* Krutt eller kruttgass i hylsa */}
      {gasText && (
        <Txt x={caseMid} y={iy + 5 * f} size={0.72} weight={650}>
          {gasText}
        </Txt>
      )}

      {/* Kraftparet fra kruttgassen: på sluttstykket (bakover) og på bunnen av kula (framover) */}
      {forcesNow && len > 1 && (
        <>
          <ForceArrow x1={xA(0)} y1={iy} x2={xA(0) - len} y2={iy} color={VIZ.applied} width={5} minLength={2} origin />
          <ForceArrow x1={xBullet} y1={iy} x2={xBullet + len} y2={iy} color={VIZ.applied} width={5} minLength={2} origin />
        </>
      )}

      {/* Raden over vinduet: kreftene mens de virker, ellers navnene */}
      {forcesNow
        ? (() => {
            const t1 = `F1 = ${forceText(-force)}`;
            const t2 = `F2 = ${forceText(force)}`;
            return (
              <>
                {label(
                  xA(0) - len / 2,
                  wBold(t1),
                  <>
                    F<TSub>1</TSub> = {forceText(-force)}
                  </>,
                  VIZ.applied,
                )}
                {label(
                  xBullet + len / 2,
                  wBold(t2),
                  <>
                    F<TSub>2</TSub> = {forceText(force)}
                  </>,
                  VIZ.applied,
                )}
              </>
            );
          })()
        : (
            <>
              {label(xA(-back / 2), wMuted('sluttstykket'), 'sluttstykket', undefined, true)}
              {bulletMid < x1 - 10 && label(bulletMid, wMuted('kula'), 'kula', undefined, true)}
            </>
          )}
      {cut.broken && label((cut.xA1 + cut.xB0) / 2, wMuted(hiddenText), hiddenText, undefined, true)}

      {/* Kanten av vinduet (åpen mot bruddet) */}
      <path
        d={
          cut.broken
            ? `M${r2(cut.xA1)},${r2(top)}H${r2(x0)}V${r2(bottom)}H${r2(cut.xA1)}M${r2(cut.xB0)},${r2(top)}H${r2(x1)}V${r2(bottom)}H${r2(cut.xB0)}`
            : `M${r2(x0)},${r2(top)}H${r2(x1)}V${r2(bottom)}H${r2(x0)}Z`
        }
        fill="none"
        stroke={SCENE.outline}
        strokeWidth={0.9 * ss}
      />
    </g>
  );
}

/** Sluttstykket og løpet i stål, med kammeret og boringen gjennomskåret. Tegnet med u = 0 i origo, M px/m. */
function Barrel({ M, rb, RN, RC, RS, range, id }: { M: number; rb: number; RN: number; RC: number; RS: number; range: [number, number]; id: string }) {
  const ss = useStrokeScale();
  const X = (u: number) => r2(u * M);
  const Y = (v: number) => r2(v * M);
  const H = HW + 0.002;
  // Hulrommet: kammeret (formet som hylsa), halsen og boringen fram til munningen
  const cavity = `M${X(0)},${Y(-RC)}L${X(U_SHOULDER)},${Y(-RS)}L${X(U_NECK)},${Y(-RN)}L${X(LC)},${Y(-RN)}L${X(U_THROAT)},${Y(-rb)}L${X(U_MUZZLE)},${Y(-rb)}L${X(U_MUZZLE)},${Y(rb)}L${X(U_THROAT)},${Y(rb)}L${X(LC)},${Y(RN)}L${X(U_NECK)},${Y(RN)}L${X(U_SHOULDER)},${Y(RS)}L${X(0)},${Y(RC)}Z`;
  // Riller (skrå streker i boringen), bare der avsnittet viser løpet
  const step = 0.009;
  const from = Math.max(U_THROAT + 0.003, Math.ceil(range[0] / step) * step);
  const to = Math.min(U_MUZZLE - 0.005, range[1]);
  let rifling = '';
  for (let u = from; u <= to; u += step) rifling += `M${X(u)},${Y(-rb)}L${X(u + 0.005)},${Y(rb)}`;
  return (
    <g>
      {/* Sluttstykket (lysere stål) med tennstempelet i midten */}
      <rect x={X(-0.4)} y={Y(-H)} width={r2(0.4 * M)} height={r2(2 * H * M)} fill={`url(#${id}bo)`} />
      <line x1={X(-0.4)} y1={Y(-0.0085)} x2={X(0)} y2={Y(-0.0085)} stroke={shade(SCENE.metal, 0.4)} strokeWidth={0.8 * ss} />
      <line x1={X(-0.4)} y1={Y(0.0085)} x2={X(0)} y2={Y(0.0085)} stroke={shade(SCENE.metal, 0.4)} strokeWidth={0.8 * ss} />
      <rect x={X(-0.4)} y={Y(-0.0009)} width={r2((0.4 - 0.0006) * M)} height={r2(0.0018 * M)} fill={shade(SCENE.metal, 0.45)} />
      {/* Løpet */}
      <rect x={X(0)} y={Y(-H)} width={r2(U_MUZZLE * M)} height={r2(2 * H * M)} fill={`url(#${id}st)`} />
      <path d={cavity} fill={shade(SCENE.metalDark, 0.72)} />
      {rifling && <path d={rifling} stroke={tint(SCENE.metalDark, 0.15)} strokeWidth={0.8 * ss} opacity={0.55} />}
      <path d={cavity} fill="none" stroke={shade(SCENE.metalDark, 0.5)} strokeWidth={0.7 * ss} />
      {/* Sluttstykkets front (der hylsa ligger an) */}
      <line x1={X(0)} y1={Y(-H)} x2={X(0)} y2={Y(H)} stroke={SCENE.outline} strokeWidth={0.9 * ss} />
      {/* Munningen */}
      <line x1={X(U_MUZZLE)} y1={Y(-H)} x2={X(U_MUZZLE)} y2={Y(H)} stroke={SCENE.outline} strokeWidth={0.9 * ss} />
    </g>
  );
}

/** Patronhylsa i messing med krutt eller kruttgass, og gassen i boringen bak kula. */
function CaseAndGas({
  M,
  rb,
  RN,
  RC,
  RS,
  powder,
  gas,
  gasEnd,
  id,
}: {
  M: number;
  rb: number;
  RN: number;
  RC: number;
  RS: number;
  powder: boolean;
  gas: number;
  gasEnd: number;
  id: string;
}) {
  const ss = useStrokeScale();
  const X = (u: number) => r2(u * M);
  const Y = (v: number) => r2(v * M);
  const wall = 0.0006;
  const head = 0.005;
  const outer = `M${X(0)},${Y(-RC)}L${X(U_SHOULDER)},${Y(-RS)}L${X(U_NECK)},${Y(-RN)}L${X(LC)},${Y(-RN)}L${X(LC)},${Y(RN)}L${X(U_NECK)},${Y(RN)}L${X(U_SHOULDER)},${Y(RS)}L${X(0)},${Y(RC)}Z`;
  const inner = `M${X(head)},${Y(-(RC - wall))}L${X(U_SHOULDER)},${Y(-(RS - wall))}L${X(U_NECK)},${Y(-rb)}L${X(LC)},${Y(-rb)}L${X(LC)},${Y(rb)}L${X(U_NECK)},${Y(rb)}L${X(U_SHOULDER)},${Y(RS - wall)}L${X(head)},${Y(RC - wall)}Z`;
  // Kruttkorn: små avlange korn med fast frø
  let grains = '';
  if (powder) {
    const rand = sceneRandom(41);
    const n = Math.round((U_SHOULDER - head) * M * 0.5);
    for (let i = 0; i < n; i++) {
      const u = head + 0.001 + rand() * (U_SHOULDER - head - 0.002);
      const v = (rand() * 2 - 1) * (RS - wall - 0.0008);
      const l = 0.0011 * M;
      grains += `M${X(u)},${Y(v)}h${r2(l)}`;
    }
  }
  return (
    <g>
      <path d={outer} fill={`url(#${id}br)`} stroke={shade(SCENE.gold, 0.5)} strokeWidth={0.7 * ss} strokeLinejoin="round" />
      {/* Tennhetta i bunnen av hylsa */}
      <rect x={X(0)} y={Y(-0.0022)} width={r2(0.0032 * M)} height={r2(0.0044 * M)} fill={tint(SCENE.metal, 0.2)} stroke={shade(SCENE.gold, 0.5)} strokeWidth={0.6 * ss} />
      <path d={inner} fill={powder ? shade(SCENE.rubber, 0.1) : shade(SCENE.metalDark, 0.72)} />
      {powder && grains && <path d={grains} stroke={tint(SCENE.rubber, 0.35)} strokeWidth={Math.max(1.4 * ss, 0.0007 * M)} strokeLinecap="round" />}
      {/* Kruttgassen i hylsa og i boringen bak kula */}
      {gas > 0 && (
        <g opacity={gas}>
          <path d={inner} fill={`url(#${id}gas)`} />
          {gasEnd > LC && <rect x={X(LC - 0.0002)} y={Y(-rb)} width={r2((gasEnd - LC + 0.0002) * M)} height={r2(2 * rb * M)} fill={`url(#${id}gas)`} />}
        </g>
      )}
      <path d={outer} fill="none" stroke={shade(SCENE.gold, 0.55)} strokeWidth={0.7 * ss} strokeLinejoin="round" />
    </g>
  );
}
