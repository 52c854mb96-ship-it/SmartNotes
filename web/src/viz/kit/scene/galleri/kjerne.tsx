/** Galleri for kjernen i scene-kit-et: kraftpiler, mållinjer, etiketter, skilt, fartsstreker, skygger og toninger. */
import { VIZ } from '../../colors';
import { ContactShadow, LinearGradient, RadialGradient, materialStops, sphereStops, useSvgId } from '../core';
import { Callout, Dimension, ForceArrow, SpeedLines, ValueTag } from '../overlay';
import { SCENE } from '../palette';
import { GalleryGrid, GalleryItem } from './felles';

function Backdrop() {
  const sky = useSvgId('himmel');
  return (
    <>
      <LinearGradient id={sky} stops={[[0, SCENE.skyTop], [1, SCENE.skyBottom]]} />
      <rect x={0} y={0} width={400} height={180} fill={`url(#${sky})`} />
      <rect x={0} y={180} width={400} height={60} fill={SCENE.asphalt} />
    </>
  );
}

function Crate({ x, y, w, h }: { x: number; y: number; w: number; h: number }) {
  const id = useSvgId('kasse');
  return (
    <g>
      <ContactShadow cx={x + w / 2} cy={y + h} rx={w * 0.62} />
      <LinearGradient id={id} stops={materialStops(SCENE.wood)} />
      <rect x={x} y={y} width={w} height={h} rx={4} fill={`url(#${id})`} stroke={SCENE.outline} strokeWidth={1} />
    </g>
  );
}

function Sphere() {
  const id = useSvgId('kule');
  return (
    <>
      <RadialGradient id={id} stops={sphereStops(SCENE.metal)} fx={0.35} fy={0.32} />
      <ContactShadow cx={200} cy={200} rx={46} />
      <circle cx={200} cy={150} r={50} fill={`url(#${id})`} stroke={SCENE.outline} strokeWidth={1} />
    </>
  );
}

export default function Galleri() {
  return (
    <GalleryGrid>
      <GalleryItem title="Kraftpiler oppå en scene (G, N, R, F)">
        <Backdrop />
        <Crate x={150} y={110} w={100} h={70} />
        <ForceArrow x1={200} y1={145} x2={200} y2={225} color={VIZ.gravity} label="G" origin />
        <ForceArrow x1={200} y1={180} x2={200} y2={100} color={VIZ.normal} label="N" />
        <ForceArrow x1={250} y1={150} x2={340} y2={150} color={VIZ.applied} label="F" />
        <ForceArrow x1={150} y1={176} x2={95} y2={176} color={VIZ.friction} label="R" />
      </GalleryItem>
      <GalleryItem title="Komponenter (stiplet) og fart">
        <Backdrop />
        <ForceArrow x1={120} y1={60} x2={120} y2={170} color={VIZ.gravity} label="G" origin />
        <ForceArrow x1={120} y1={60} x2={175} y2={140} color={VIZ.gravity} dashed label="G∥" />
        <ForceArrow x1={240} y1={110} x2={360} y2={110} color={VIZ.velocity} label="v" width={6} />
        <ForceArrow x1={240} y1={150} x2={300} y2={150} color={VIZ.acceleration} label="a" width={5} />
      </GalleryItem>
      <GalleryItem title="Mållinjer, etiketter og skilt">
        <Backdrop />
        <Crate x={60} y={120} w={80} h={60} />
        <Dimension x1={60} y1={180} x2={330} y2={180} offset={-26} label="s = 25 m" />
        <Dimension x1={360} y1={180} x2={360} y2={60} offset={-14} label="h = 4,0 m" />
        <Callout x={100} y={130} lx={170} ly={70}>
          Trekasse, 20 kg
        </Callout>
        <ValueTag x={100} y={95} text="12 m/s" color={VIZ.velocity} pointer={10} />
        <SpeedLines x={60} y={150} length={50} />
      </GalleryItem>
      <GalleryItem title="Toning og skygge: kule i metall">
        <Backdrop />
        <Sphere />
      </GalleryItem>
    </GalleryGrid>
  );
}
