/**
 * Scenene til «Eksplosjon og rekyl», felles del og skøyteløperne.
 *
 * Alle tre scenene har samme oppbygning ovenfra: overskrift (før, under eller etter) og Σp øverst, fartsskilt og
 * fartspiler (én skala px per m/s), masse eller kraft rett over hver gjenstand, og gjenstandene tegnet i én fast skala
 * px/m. Med «Vis krefter» vises kraftparet mens dyttet varer: like lange piler (én skala px/N) fra kontaktpunktet og
 * inn i hver gjenstand.
 *
 * Skøyteløperne står på stålis på et skogstjern, dytter håndflatene mot hverandre og glir fra hverandre. Skøytesporene
 * på isen og mållinjene viser hvor langt hver har glidd i samme tid.
 */
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { TSub, Txt, VIZ, fmt, useTextScale } from '../../kit';
import { Dimension, ForceArrow, Himmel, Landskap, SCENE, Underlag, alpha, personPunkter, shade, useStrokeScale } from '../../kit/scene';
import { BLADE_H, Skilt, Skoyteloper, skaterLedd, tagHeight, tagWidth } from './eksplosjon-deler';
import { exitTime, skaterHeight } from './eksplosjon-form';
import { pushAt, type PushPhase, type PushResult, type PushState } from './model';

/** Figuren er 800 bred. */
export const W = 800;
export const TAG_SIZE = 0.9;
export const INFO_SIZE = 0.85;

/* ================================================================================================
 * Felles
 * ============================================================================================== */

/** Tekstskaleringen figuren vil få (samme regel som Figure i kit/controls), målt på beholderen før figuren tegnes. */
export function useSceneFrame<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [frame, setFrame] = useState({ f: 1, narrow: false });
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const update = () => {
      const w = (el.querySelector('svg') ?? el).getBoundingClientRect().width;
      if (!(w > 0)) return;
      const f = Math.round(Math.max(1, 12.5 / 17 / (w / W)) * 20) / 20;
      const narrow = w < 560;
      setFrame((old) => (old.f === f && old.narrow === narrow ? old : { f, narrow }));
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, frame] as const;
}

/** Radene øverst i alle scenene: overskrift og Σp, fartsskilt og fartspiler. */
export interface TopRows {
  info: number;
  tagY: number;
  arrowY: number;
  /** Underkanten av rommet for pilene (masseetikettene kan stå herfra og ned). */
  below: number;
}

export function topRows(f: number): TopRows {
  const ss = Math.max(1, f * 0.75);
  const ti = tagHeight(f, INFO_SIZE);
  const tv = tagHeight(f, TAG_SIZE);
  const info = 8 + ti / 2;
  const tagY = info + ti / 2 + 9 + tv / 2;
  const arrowY = tagY + tv / 2 + 10 + 7 * ss;
  return { info, tagY, arrowY, below: arrowY + 9 * ss + 6 };
}

/** Fart i et skilt: «v₁ = −0,79 m/s», og «v₁ = 0» når gjenstanden står stille. */
export function speedTag(name: '₁' | '₂', v: number, decimals: number): string {
  return Math.abs(v) < 0.5 * 10 ** -decimals ? `v${name} = 0` : `v${name} = ${fmt(v, decimals)} m/s`;
}

/** Plasserer to skilt over hver sin gjenstand, skjøvet fra hverandre så de ikke overlapper, og innenfor figuren. */
export function placeTags(c1: number, c2: number, w1: number, w2: number): [number, number] {
  const gap = 10;
  let a = c1;
  let b = c2;
  const overlap = a + w1 / 2 + gap - (b - w2 / 2);
  if (overlap > 0) {
    a -= overlap / 2;
    b += overlap / 2;
  }
  b = clampX(b, w2);
  a = Math.min(a, b - w2 / 2 - gap - w1 / 2);
  a = clampX(a, w1);
  b = Math.max(b, a + w1 / 2 + gap + w2 / 2);
  return [a, b];
}

export function clampX(x: number, w: number): number {
  return Math.min(W - 6 - w / 2, Math.max(6 + w / 2, x));
}

/** Σp i skiltet øverst til høyre: avrundingsfeil (10⁻¹⁵) vises som 0. */
export function sumText(p: number, decimals: number): string {
  return `Σp = ${fmt(Math.abs(p) < 0.5 * 10 ** -decimals ? 0 : p, decimals)} kg·m/s`;
}

/** Overskriften øverst til venstre (før, under eller etter) og Σp øverst til høyre. */
export function HeadRow({ rows, title, sum }: { rows: TopRows; title: string; sum: string }) {
  const f = useTextScale();
  return (
    <>
      <Txt x={14} y={rows.info + 6 * f} anchor="start" size={1} weight={700}>
        {title}
      </Txt>
      <Skilt x={W - 10} y={rows.info} anchor="end" measure={sum} size={INFO_SIZE}>
        {sum}
      </Skilt>
    </>
  );
}

/** To fartspiler (tail i c1 og c2) og skilt over dem. `S` er piksler per m/s. */
export function VelocityPair({
  rows,
  c1,
  c2,
  v1,
  v2,
  S,
  d1,
  d2,
}: {
  rows: TopRows;
  c1: number;
  c2: number;
  v1: number;
  v2: number;
  S: number;
  d1: number;
  d2: number;
}) {
  const f = useTextScale();
  const t1 = speedTag('₁', v1, d1);
  const t2 = speedTag('₂', v2, d2);
  const [a, b] = placeTags(c1, c2, tagWidth(t1, f, TAG_SIZE), tagWidth(t2, f, TAG_SIZE));
  return (
    <>
      <ForceArrow x1={c1} y1={rows.arrowY} x2={c1 + v1 * S} y2={rows.arrowY} color={VIZ.velocity} width={6} origin minLength={2} />
      <ForceArrow x1={c2} y1={rows.arrowY} x2={c2 + v2 * S} y2={rows.arrowY} color={VIZ.velocity} width={6} origin minLength={2} />
      <Skilt x={a} y={rows.tagY} measure={t1} color={VIZ.velocity}>
        {t1}
      </Skilt>
      <Skilt x={b} y={rows.tagY} measure={t2} color={VIZ.velocity}>
        {t2}
      </Skilt>
    </>
  );
}

/**
 * En kraft i et skilt eller en utregning: i newton under 1 000 N, ellers i kilonewton med to gjeldende siffer
 * («5,8 kN»), så kraften ikke får flere siffer enn energien den er regnet ut fra.
 */
export function forceText(F: number): string {
  const a = Math.abs(F);
  if (a < 1000) return `${fmt(F, 0)} N`;
  return `${fmt(F / 1000, a < 10000 ? 1 : 0)} kN`;
}

/** Masse (eller kraften under dyttet) rett over en gjenstand. */
export function BodyLabel({ x, y, name, mass, force }: { x: number; y: number; name: '1' | '2'; mass: string; force: number | null }) {
  return (
    <Txt x={x} y={y} size={0.85} weight={force !== null ? 700 : 650} color={force !== null ? VIZ.applied : undefined}>
      {force !== null ? (
        <>
          F<TSub>{name}</TSub> = {forceText(force)}
        </>
      ) : (
        <>
          m<TSub>{name}</TSub> = {mass}
        </>
      )}
    </Txt>
  );
}

/**
 * Massene (eller kreftene under dyttet) over begge gjenstandene. Står de tett, skyves etikettene fra hverandre (som
 * fartsskiltene), så de aldri overlapper.
 */
export function BodyLabels({
  x1,
  y1,
  x2,
  y2,
  mass1,
  mass2,
  force,
}: {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  mass1: string;
  mass2: string;
  /** Kraften på legeme 2 under dyttet (legeme 1 får −F), eller null. */
  force: number | null;
}) {
  const f = useTextScale();
  const text = (name: string, m: string, F: number | null) => (F !== null ? `F${name} = ${forceText(F)}` : `m${name} = ${m}`);
  // Omtrentlig bredde på fet tekst (sifre og mellomrom er ca. 0,62 em)
  const w = (t: string) => t.length * 17 * 0.85 * f * 0.64 + 12;
  const t1 = text('1', mass1, force !== null ? -force : null);
  const t2 = text('2', mass2, force);
  // Skyv fra hverandre når de står tett (også når de står i ulik høyde, så etiketten ikke havner over den andre)
  const [a, b] = placeTags(x1, x2, w(t1), w(t2));
  return (
    <>
      <BodyLabel x={a} y={y1} name="1" mass={mass1} force={force !== null ? -force : null} />
      <BodyLabel x={b} y={y2} name="2" mass={mass2} force={force} />
    </>
  );
}

/** Kraftparet under dyttet: like lange piler fra kontaktpunktet (x, y) og inn i hver gjenstand. */
export function ForcePair({ x, y, len }: { x: number; y: number; len: number }) {
  if (!(len > 1)) return null;
  return (
    <>
      <ForceArrow x1={x} y1={y} x2={x - len} y2={y} color={VIZ.applied} width={6} minLength={2} />
      <ForceArrow x1={x} y1={y} x2={x + len} y2={y} color={VIZ.applied} width={6} minLength={2} origin />
    </>
  );
}

/**
 * Piksler per m/s for fartspilene: den største farten gir en pil på ca. `len` (standard 150, høyst `max` per m/s),
 * litt lengre på mobil, så pilene synes.
 */
export function arrowScale(vmax: number, f: number, max = 60, len = 150): number {
  const k = 1 + 0.4 * (Math.max(1, f) - 1);
  return Math.min(max * k, (len * k) / Math.max(1e-9, Math.abs(vmax)));
}

/** Tidslinja i en scene: dyttet begynner ved `release` (s), og avspillingen slutter ved `end`. */
export interface Timeline {
  release: number;
  end: number;
}

/** Fasen ved tiden t på tidslinja, og tidspunktene «Før», «Under» og «Etter» hopper til. */
export function phaseAt(tl: Timeline, r: PushResult, t: number): PushPhase {
  return t < tl.release ? 'for' : t < tl.release + r.dt ? 'under' : 'etter';
}

export function phaseTime(tl: Timeline, r: PushResult, phase: PushPhase): number {
  return phase === 'for' ? 0 : phase === 'under' ? tl.release + r.dt / 2 : tl.end;
}

/* ================================================================================================
 * Skøyteløpere på isen
 * ============================================================================================== */

/** Hvor mye avstanden mellom skuldrene øker mens armene strekkes i dyttet (m). */
export const ARM_PUSH = 0.4;
/** Når dyttet begynner (s), og lengste avspilling etter dyttet. */
const SKATE_RELEASE = 0.6;
const SKATE_MAX_GLIDE = 4;
/** Hvor lang tid armene bruker på å senke seg etter dyttet, og overkroppen på å rette seg opp (s). */
const RELAX_TIME = 0.55;
/** Armlengden (skulder til håndflate) som andel av høyden. */
const ARM_SHARE = 0.36;

export interface SkaterLayout {
  /** Tekstskaleringen (1 på PC, ca. 1,8 på mobil). */
  f: number;
  P: number;
  /** Lengden på den lengste fartspila (før mobilskaleringen). */
  arrowLen: number;
  H: number;
  rows: TopRows;
  iceY: number;
  horizon: number;
  /** Mållinjene for hvor langt de har glidd (y). */
  dimY: number;
  /** Midten av figuren der hendene møtes. */
  xc: number;
  /** Grensene for midtpunktet til en skøyteløper før avspillingen stopper. */
  lo: number;
  hi: number;
}

/** Plassering i høyden og skalaen px/m: et utsnitt på 11 m (6 m på mobil, med kortere fartspiler). */
export function skaterLayout(f: number, narrow: boolean): SkaterLayout {
  const P = W / (narrow ? 6 : 11);
  const rows = topRows(f);
  const labelRoom = 17 * f * 0.85 + 8;
  // Den høyeste personen (1,88 m) med skøyter skal få plass under etikettraden
  const iceY = Math.round(rows.below + labelRoom + 1.95 * P);
  const dimY = iceY + 14 + 16 * f;
  const H = Math.round(dimY + 22 + 4 * f);
  const margin = 0.55 * P;
  return { f, P, arrowLen: narrow ? 100 : 150, H, rows, iceY, horizon: iceY - 0.55 * P, dimY, xc: W / 2, lo: margin, hi: W - margin };
}

export interface SkaterSpec {
  m1: number;
  m2: number;
  r: PushResult;
}

/** Høyden og armlengden til hver skøyteløper (m), og hvor langt armene er strukket ut før og etter dyttet. */
export function skaterGeometry(m1: number, m2: number) {
  const h1 = skaterHeight(m1);
  const h2 = skaterHeight(m2);
  const a1 = ARM_SHARE * h1;
  const a2 = ARM_SHARE * h2;
  // Armene er strake (96 %) når dyttet slutter; hver tar sin del av ARM_PUSH etter armlengden.
  const share1 = a1 / (a1 + a2);
  const r1 = Math.max(0.3 * a1, 0.96 * a1 - ARM_PUSH * share1);
  const r2 = Math.max(0.3 * a2, 0.96 * a2 - ARM_PUSH * (1 - share1));
  return { h1, h2, a1, a2, share1, r1, r2 };
}

/** Plasseringen av skøyteløperne ved tiden ts etter at dyttet begynner (figurens enheter). */
export function skaterFrame(spec: SkaterSpec, layout: SkaterLayout, ts: number) {
  const { m1, m2, r } = spec;
  const { P, iceY, xc } = layout;
  const g = skaterGeometry(m1, m2);
  const st: PushState = pushAt(m1, m2, r, ts);
  const size1 = g.h1 * P;
  const size2 = g.h2 * P;
  // Overkroppen og armene: dyttestilling til dyttet er over, så retter de seg opp og senker armene.
  const after = st.phase === 'etter' ? ts - r.dt : 0;
  const push = st.phase === 'etter' ? Math.max(0, 1 - after / RELAX_TIME) : 1;
  const relax = st.phase === 'etter' ? after / RELAX_TIME : 0;
  const contact = st.phase !== 'etter';
  const ledd = skaterLedd(push, relax, contact);
  const pose = contact ? 'skyve' : 'staa';
  // Skulderen og hodet i forhold til ankerpunktet (personen lener seg fram). Personen står BLADE_H over isen.
  const rel1 = personPunkter(pose, size1, ledd, { x: 0, y: -BLADE_H * (size1 / 100) });
  const rel2 = personPunkter(pose, size2, ledd, { x: 0, y: -BLADE_H * (size2 / 100) });
  // Ankerpunktene ved start (hendene møtes i xc i dyttestillingen), flyttet med bevegelsen fra modellen. De regnes fra
  // startstillingen, ikke fra stillingen nå, så skinnene står der personen sto og flytter seg nøyaktig st.x · P: sporene
  // og mållinjene begynner der, også mens personen retter seg opp etter dyttet.
  const start1 = contact ? rel1 : personPunkter('skyve', size1, skaterLedd(1, 0, true), { x: 0, y: -BLADE_H * (size1 / 100) });
  const start2 = contact ? rel2 : personPunkter('skyve', size2, skaterLedd(1, 0, true), { x: 0, y: -BLADE_H * (size2 / 100) });
  const base1 = xc - g.r1 * P - start1.skulder.x;
  const base2 = xc + g.r2 * P + start2.skulder.x;
  const x1 = base1 + st.x1 * P;
  const x2 = base2 + st.x2 * P;
  // Kontaktpunktet: skulder 1 pluss armen til person 1, som strekkes med sin del av økningen i avstand
  const spread = st.x2 - st.x1;
  const cx = x1 + rel1.skulder.x + (g.r1 + spread * g.share1) * P;
  const cy = iceY + (rel1.skulder.y + rel2.skulder.y) / 2 + 0.04 * P;
  // Toppen av hodet (til masseetiketten)
  const head1 = iceY + rel1.hode.y - 0.075 * size1;
  const head2 = iceY + rel2.hode.y - 0.075 * size2;
  return { st, g, size1, size2, ledd, contact, base1, base2, x1, x2, cx, cy, head1, head2 };
}

/**
 * Tidslinja for skøyteløperne: avspillingen stopper når den første når kanten av utsnittet, med plass til fartspila
 * foran seg (høyst 4 s glid).
 */
export function skaterTimeline(spec: SkaterSpec, layout: SkaterLayout): Timeline {
  const { r } = spec;
  const fr = skaterFrame(spec, layout, r.dt + RELAX_TIME);
  const S = arrowScale(Math.max(Math.abs(r.v1), Math.abs(r.v2)), layout.f, 60, layout.arrowLen);
  const lo = Math.max(layout.lo, 12 + Math.abs(r.v1) * S);
  const hi = Math.min(layout.hi, W - 12 - Math.abs(r.v2) * S);
  const glide = Math.min(
    exitTime([fr.x1], [r.v1 * layout.P], lo, Infinity, SKATE_MAX_GLIDE),
    exitTime([fr.x2], [r.v2 * layout.P], -Infinity, hi, SKATE_MAX_GLIDE),
  );
  return { release: SKATE_RELEASE, end: SKATE_RELEASE + r.dt + RELAX_TIME + glide };
}

export function SkaterScene({
  spec,
  layout,
  tl,
  t,
  showForces,
}: {
  spec: SkaterSpec;
  layout: SkaterLayout;
  tl: Timeline;
  t: number;
  showForces: boolean;
}) {
  const f = useTextScale();
  const ss = useStrokeScale();
  const { m1, m2, r } = spec;
  const { P, iceY, rows, H } = layout;
  const fr = skaterFrame(spec, layout, t - tl.release);
  const { st, size1, size2, ledd, contact, base1, base2, x1, x2, cx, cy } = fr;

  // Fartspilene: én skala for begge. Kreftene: én skala px/N (300 N gir ca. 1,4 m i figuren).
  const S = arrowScale(Math.max(Math.abs(r.v1), Math.abs(r.v2)), f, 60, layout.arrowLen);
  const kF = 0.0047 * P;
  const forcesNow = showForces && st.phase === 'under';
  const labelGap = 6 + 4 * f;

  const p = m1 * st.v1 + m2 * st.v2;
  const title = st.phase === 'for' ? 'Før dyttet' : st.phase === 'under' ? 'Under dyttet' : 'Etter dyttet';

  const backdrop = useMemo(
    () => (
      <>
        <Himmel w={W} h={layout.horizon + 4} skyer={2} seed={4} />
        <Landskap x={0} y={layout.horizon} w={W} h={Math.min(0.9 * P, layout.horizon * 0.62)} type="skog" seed={3} />
        <Underlag x1={0} x2={W} y={iceY} depth={H - iceY} type="is" horisont={layout.horizon} seed={2} />
      </>
    ),
    [layout.horizon, P, iceY, H],
  );

  // Skøytesporene: fra der skinnene sto før dyttet til der de er nå (to spor per person, litt forskjøvet i dybden)
  const tracks = (base: number, x: number) =>
    Math.abs(x - base) > 2 && (
      <g strokeLinecap="round" fill="none" aria-hidden>
        <line x1={base} y1={iceY + 1.5} x2={x} y2={iceY + 1.5} stroke={shade(SCENE.ice, 0.3)} strokeWidth={1.1 * ss} opacity={0.75} />
        <line x1={base} y1={iceY + 2.6} x2={x} y2={iceY + 2.6} stroke={SCENE.iceShine} strokeWidth={0.9 * ss} />
        <line x1={base} y1={iceY + 5} x2={x} y2={iceY + 5} stroke={shade(SCENE.ice, 0.3)} strokeWidth={0.9 * ss} opacity={0.55} />
      </g>
    );

  const showDims = st.phase === 'etter' && Math.min(Math.abs(x1 - base1), Math.abs(x2 - base2)) > 4;
  const s1 = Math.abs(x1 - base1) / P;
  const s2 = Math.abs(x2 - base2) / P;
  // Etiketten midt på mållinja når den får plass, ellers utenfor enden (på yttersiden)
  const dimText = (s: number) => `s₁ = ${fmt(s, 2)} m`;
  const labelW = (s: number) => dimText(s).length * 17 * 0.8 * f * 0.58 + 10;
  const dimLabel = (name: '1' | '2', a: number, b: number, s: number) => {
    const fits = Math.abs(b - a) > labelW(s);
    const x = fits ? (a + b) / 2 : name === '1' ? Math.min(a, b) - 6 : Math.max(a, b) + 6;
    return (
      <Txt x={x} y={layout.dimY - 9 * f} anchor={fits ? 'middle' : name === '1' ? 'end' : 'start'} size={0.8} weight={650}>
        <DimLabel name={name} s={s} />
      </Txt>
    );
  };

  return (
    <>
      {backdrop}

      {/* Der hver skøyteløper sto (en kort strek på isen), og sporene derfra */}
      {[
        [base1, x1],
        [base2, x2],
      ].map(([base, x]) =>
        Math.abs(x! - base!) > 4 ? (
          <line
            key={base}
            x1={base}
            y1={iceY - 7}
            x2={base}
            y2={iceY + 11}
            stroke={alpha(VIZ.ink, 0.55)}
            strokeWidth={1.5 * ss}
            strokeDasharray={`${4 * ss} ${3 * ss}`}
            aria-hidden
          />
        ) : null,
      )}
      {tracks(base1, x1)}
      {tracks(base2, x2)}

      <Skoyteloper
        x={x1}
        y={iceY}
        size={size1}
        ledd={ledd}
        hands={contact ? { x: cx, y: cy } : null}
        jakke="blaa"
        bukse={SCENE.denim}
        lue="rod"
        har="brun"
        title={`Skøyteløper 1, ${fmt(m1, 0)} kg`}
      />
      <Skoyteloper
        x={x2}
        y={iceY}
        size={size2}
        flip
        ledd={ledd}
        hands={contact ? { x: cx, y: cy } : null}
        jakke="oransje"
        bukse={SCENE.rubberLight}
        lue="gronn"
        har="blond"
        frisyre="hestehale"
        title={`Skøyteløper 2, ${fmt(m2, 0)} kg`}
      />

      {/* Kraftparet mens de dytter */}
      {forcesNow && <ForcePair x={cx} y={cy} len={st.F * kF} />}

      {/* Massene (eller kreftene under dyttet) rett over hodene */}
      <BodyLabels
        x1={x1}
        y1={forcesNow ? Math.min(fr.head1 - labelGap, cy - 12 - 6 * f) : fr.head1 - labelGap}
        x2={x2}
        y2={forcesNow ? Math.min(fr.head2 - labelGap, cy - 12 - 6 * f) : fr.head2 - labelGap}
        mass1={`${fmt(m1, 0)} kg`}
        mass2={`${fmt(m2, 0)} kg`}
        force={forcesNow ? st.F : null}
      />

      <VelocityPair rows={rows} c1={x1} c2={x2} v1={st.v1} v2={st.v2} S={S} d1={2} d2={2} />

      {/* Hvor langt hver har glidd fra der den selv sto (startstreken og begynnelsen av sporene), med hjelpelinjer
          opp til isen ved startstedet og ved skøyteløperen nå */}
      {showDims && (
        <>
          <Dimension x1={x1} y1={iceY} x2={base1} y2={iceY} offset={iceY - layout.dimY} />
          <Dimension x1={base2} y1={iceY} x2={x2} y2={iceY} offset={iceY - layout.dimY} />
          {dimLabel('1', x1, base1, s1)}
          {dimLabel('2', base2, x2, s2)}
        </>
      )}

      <HeadRow rows={rows} title={title} sum={sumText(p, 1)} />
    </>
  );
}

function DimLabel({ name, s }: { name: '1' | '2'; s: number }): ReactNode {
  return (
    <>
      s<TSub>{name}</TSub> = {fmt(s, 2)} m
    </>
  );
}
