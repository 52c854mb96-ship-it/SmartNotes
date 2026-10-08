/**
 * Scenen i «Stjernespekter» (ikke i målestokk): til venstre et utsnitt av stjernen med det varme indre og den
 * kjøligere atmosfæren, der et atom tar opp et foton med akkurat den energien som trengs og sender det ut igjen i en
 * annen retning. Lyset går mange lysår gjennom rommet til et lite teleskop med gitter og kamera på en snødekt ås.
 */
import { useTextScale } from '../../kit';
import { Foton, Lysstraale, Person, SCENE, Stjernehimmel, alpha, bolgelengdeFarge, useSceneScale } from '../../kit/scene';
import { fmtThousands } from './stjernespekter-tekst';
import { ELEMENT_COLOR } from './stjernespekter-graf';
import { AtmosfaereAtom, AvstandsBrudd, NattCallout, NattTekst, SnoAas, StjerneSnitt, Teleskop, teleskopPunkter, type Pt } from './stjernespekter-deler';
import { STARS, atomAngles, presentElements, type Analysis, type StarId } from './model-stjernespekter';

/** Tekst på den lyse stjerneskiva: mørk med lys kant i begge temaer (skiva er like lys i mørkt tema). */
const DISK_INK = SCENE.space;
const DISK_HALO = alpha(SCENE.star, 0.85);

/** Høyden på scenen: høyere på mobil, så teksten og gjenstandene får plass. */
export const sceneHeight = (f: number) => Math.round(330 + 210 * (f - 1));

/** Der strålen fra P (retning d, enhetsvektor) krysser sirkelen med sentrum C og radius r (første kryssing utover). */
function exitPoint(P: Pt, d: Pt, C: Pt, r: number): Pt {
  const ox = P.x - C.x;
  const oy = P.y - C.y;
  const b = ox * d.x + oy * d.y;
  const c = ox * ox + oy * oy - r * r;
  const t = -b + Math.sqrt(Math.max(0, b * b - c));
  return { x: P.x + d.x * t, y: P.y + d.y * t };
}

export function StjerneScene({ star, analysis, selected, H }: { star: StarId; analysis: Analysis; selected: number; H: number }) {
  const f = useTextScale();
  const s = useSceneScale();
  const W = 800;
  const info = STARS[star];
  const narrow = f > 1.35;
  const gy = H - 34 - 30 * (f - 1);
  const ppm = 62 * s;
  const R = Math.min(0.62 * H, 300);
  const xe = 168 + 52 * (f - 1);
  const C = { x: xe - R, y: H * 0.44 };
  const A = 30 * s;
  const Rm = R + A / 2;

  // Teleskopet sikter mot et punkt inne i stjernen, og strålen går derfra til objektivet.
  const P0 = { x: xe - 70 * s, y: C.y + 0.04 * H };
  const tx = W - 1.45 * ppm - 40;
  const tel = { x: tx, y: gy, ppm, mot: P0 };
  const tp = teleskopPunkter(tel);
  const O = tp.objektiv;
  const len = Math.hypot(O.x - P0.x, O.y - P0.y);
  const d = { x: (O.x - P0.x) / len, y: (O.y - P0.y) / len };
  const beamAngle = (Math.atan2(d.y, d.x) * 180) / Math.PI;
  const X = exitPoint(P0, d, C, Rm);
  const phiX = Math.atan2(X.y - C.y, X.x - C.x);

  // Atomene i atmosfæren: ett per grunnstoff i stjernen; atomet som tar opp den valgte linja, står like over strålen.
  const present = presentElements(star);
  const sel = analysis.lines[selected]?.line;
  const absorber = sel ? present.indexOf(sel.element) : -1;
  const r = 11 * s;
  const delta = (r + 5 * s) / Rm;
  const spacing = (2 * delta * 180) / Math.PI;
  const angles = atomAngles(present.length, Math.max(0, absorber), spacing);
  const atoms = present.map((id, i) => {
    const phi = phiX - delta + ((angles[i] ?? 0) * Math.PI) / 180;
    return { id, x: C.x + Rm * Math.cos(phi), y: C.y + Rm * Math.sin(phi), phi, found: analysis.found.includes(id) };
  });
  const abs = absorber >= 0 ? atoms[absorber] : undefined;
  const nm = sel?.nm ?? 486;
  const photonColor = bolgelengdeFarge(nm, false);

  // Fotonet som tas opp kommer innenfra; det som sendes ut igjen, går skrått opp (bort fra teleskopet).
  const inStart = abs ? { x: C.x + (R - 52 * s) * Math.cos(abs.phi + 0.05), y: C.y + (R - 52 * s) * Math.sin(abs.phi + 0.05) } : null;
  const outDir = abs ? abs.phi - (46 * Math.PI) / 180 : 0;
  const outLen = 66 * s;
  const outA = abs ? { x: abs.x + (r + 5 * s) * Math.cos(outDir), y: abs.y + (r + 5 * s) * Math.sin(outDir) } : null;
  const outB = abs && outA ? { x: outA.x + outLen * Math.cos(outDir), y: outA.y + outLen * Math.sin(outDir) } : null;

  // Bruddet i strålen midt mellom atmosfæren og teleskopet
  const xb = X.x + (O.x - X.x) * 0.4;
  const tb = (xb - P0.x) / d.x;
  const B = { x: P0.x + d.x * tb, y: P0.y + d.y * tb };
  const gapIn = { x: B.x - d.x * 9 * s, y: B.y - d.y * 9 * s };
  const gapOut = { x: B.x + d.x * 9 * s, y: B.y + d.y * 9 * s };

  // Personen står bak kameraet og holder i det
  const personX = tp.bak.x + 0.36 * ppm;
  const fs = 17 * f;
  const nameY = Math.max(fs * 1.1, C.y - R * 0.62);
  const atmP = { x: C.x + (R + 0.6 * A) * Math.cos(-0.36), y: C.y + (R + 0.6 * A) * Math.sin(-0.36) };

  return (
    <g>
      <Stjernehimmel x={0} y={0} w={W} h={H} seed={6} melkevei={0.3} />
      <StjerneSnitt cx={C.x} cy={C.y} R={R} A={A} T={info.T} />
      <SnoAas W={W} H={H} x0={W * 0.44} xTop={tx} gy={gy} />

      {/* Lyset fra det varme indre gjennom atmosfæren og rommet til teleskopet */}
      <Lysstraale x1={P0.x} y1={P0.y} x2={gapIn.x} y2={gapIn.y} hvit bredde={5 * s} />
      <Lysstraale x1={gapOut.x} y1={gapOut.y} x2={O.x} y2={O.y} hvit bredde={5 * s} pil={false} />
      <AvstandsBrudd x={B.x} y={B.y} angle={beamAngle} label={distanceText(info.distanceLy)} />

      {abs && inStart && (
        <Foton x1={inStart.x} y1={inStart.y} x2={abs.x - (r + 3 * s) * Math.cos(abs.phi + 0.05)} y2={abs.y - (r + 3 * s) * Math.sin(abs.phi + 0.05)} bolgelengde={nm} amplitude={4.5 * s} />
      )}
      {atoms.map((a, i) => (
        <AtmosfaereAtom
          key={a.id}
          x={a.x}
          y={a.y}
          r={r}
          symbol={a.found ? a.id : null}
          color={ELEMENT_COLOR[a.id]}
          ring={i === absorber ? photonColor : undefined}
        />
      ))}
      {outA && outB && (
        <>
          <Foton x1={outA.x} y1={outA.y} x2={outB.x} y2={outB.y} bolgelengde={nm} amplitude={4.5 * s} />
          <NattTekst x={outB.x + 6 * s} y={outB.y + 4 * f} anchor="start" size={0.74} muted>
            {narrow ? 'tilfeldig retning' : 'sendes ut igjen i en tilfeldig retning'}
          </NattTekst>
        </>
      )}

      {/* Tekst på stjerneskiva (mørk tekst på lys bunn) */}
      <NattTekst x={14} y={nameY} anchor="start" size={0.9} weight={700} fill={DISK_INK} halo={DISK_HALO}>
        {info.name}
      </NattTekst>
      <NattTekst x={14} y={nameY + fs * 0.95} anchor="start" size={0.74} fill={DISK_INK} halo={DISK_HALO}>
        {`ca. ${fmtThousands(info.T)} K`}
      </NattTekst>
      <NattTekst x={14} y={C.y + 0.2 * H} anchor="start" size={0.74} fill={DISK_INK} halo={DISK_HALO}>
        Varm, tett gass:
      </NattTekst>
      <NattTekst x={14} y={C.y + 0.2 * H + fs * 0.9} anchor="start" size={0.74} fill={DISK_INK} halo={DISK_HALO}>
        alle farger
      </NattTekst>
      <NattCallout x={atmP.x} y={atmP.y} lx={atmP.x + 34 * f} ly={atmP.y - 12 * f}>
        {narrow ? 'Kjøligere atmosfære' : 'Kjøligere gass i atmosfæren'}
      </NattCallout>

      <NattTekst x={W - 10} y={H - 8 * f} anchor="end" size={0.62} weight={500} muted>
        Ikke i målestokk
      </NattTekst>
      <Teleskop {...tel} />
      <Person x={personX} y={gy} size={1.75 * ppm} flip lue="rod" jakke="gronn" fest={{ hoyreHand: tp.kameraBunn }} />
      <NattCallout x={tp.kamera.x} y={tp.kamera.y - 0.06 * ppm} lx={tp.head.x} ly={gy - 1.75 * ppm - 30 * f} anchor="end">
        {narrow ? 'Teleskop med gitter' : 'Teleskop med gitter og kamera'}
      </NattCallout>
    </g>
  );
}

function distanceText(ly: number): string {
  return ly >= 100 ? `ca. ${fmtThousands(ly)} lysår` : `${fmtThousands(ly)} lysår`;
}
