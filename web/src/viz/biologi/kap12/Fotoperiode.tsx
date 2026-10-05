import { useState, type ReactNode } from 'react';
import {
  BIO,
  Controls,
  Explain,
  Figure,
  Forvalg,
  Formula,
  FormulaLine,
  Legend,
  Readout,
  Readouts,
  Segmented,
  Slider,
  Toolbar,
  Txt,
  VIZ,
  VizLayout,
  mixColor,
  useContainerTextScale,
  useTextScale,
} from '../kit';
import {
  DARK_BREAK_HOURS,
  FLASH_HOURS,
  PHOTO_PLANTS,
  dayLength,
  floweringRange,
  flowers,
  hoursText,
  longestDark,
  phytochromeAfterFlash,
  totalDark,
  type Flash,
  type Interruption,
  type PhotoPlant,
  type Schedule,
} from './model';

const round = (h: number) => Math.round(h * 4) / 4;
const PRESETS = [
  { id: 'sankthans', label: 'Oslo, sankthans', h: round(dayLength(59.9, 175)) },
  { id: 'jevndogn', label: 'Oslo, høstjevndøgn', h: round(dayLength(59.9, 266)) },
  { id: 'oktober', label: 'Oslo, oktober', h: round(dayLength(59.9, 288)) },
  { id: 'jul', label: 'Oslo, jul', h: round(dayLength(59.9, 358)) },
  { id: 'tromso', label: 'Tromsø, midnattssol', h: 24 },
  { id: 'ekvator', label: 'Ekvator', h: 12 },
] as const;

/** Høyden på stolpene i plantefiguren. */
const BAR_H = 28;

const TYPE_NAME: Record<PhotoPlant['type'], string> = { langdag: 'langdagsplante', kortdag: 'kortdagsplante', dagnoytral: 'dagnøytral' };

/** Rødt og langrødt lys i glimtet. */
const C_RED = BIO.sir.I;
const C_FARRED = BIO.rovdyr;
const C_DAY = BIO.sukker;
const C_FLOWER = BIO.plante.line;
/** Natt: blå i begge temaer (mørk farge ville blitt lys i mørkt tema). */
const C_NIGHT = BIO.oksygenfattig;

export default function Fotoperiode() {
  const [day, setDay] = useState(14);
  const [interruption, setInterruption] = useState<Interruption>('ingen');
  const [flash, setFlash] = useState<Flash>('rod');
  const s: Schedule = { day, interruption, flash };
  const dark = longestDark(s);
  const [ref, f] = useContainerTextScale<HTMLDivElement>();
  const [ref2, f2] = useContainerTextScale<HTMLDivElement>();
  const preset = PRESETS.find((p) => p.h === day)?.id ?? null;
  const blooming = PHOTO_PLANTS.filter((p) => flowers(p, dark));
  const xmas = PHOTO_PLANTS.find((p) => p.id === 'julestjerne')!;
  const henbane = PHOTO_PLANTS.find((p) => p.id === 'bulmeurt')!;

  return (
    <VizLayout>
      <Toolbar>
        <Forvalg
          label="Daglengde"
          options={PRESETS.map((p) => ({ value: p.id, label: p.label, detail: hoursText(p.h) }))}
          value={preset}
          onPick={(id) => setDay(PRESETS.find((p) => p.id === id)!.h)}
        />
      </Toolbar>
      <Controls>
        <Slider label="Daglengde (lys)" value={day} onChange={setDay} min={0} max={24} step={0.25} format={hoursText} />
      </Controls>
      <Toolbar>
        <Segmented
          label="Avbrudd"
          options={[
            { value: 'ingen', label: 'Ingen avbrudd' },
            { value: 'glimt', label: 'Lysglimt midt i natta' },
            { value: 'morkt', label: 'Mørkt avbrudd om dagen' },
          ]}
          value={interruption}
          onChange={setInterruption}
        />
        {interruption === 'glimt' && (
          <Segmented
            label="Farge på lysglimtet"
            options={[
              { value: 'rod', label: 'Rødt lys' },
              { value: 'rod-langrod', label: 'Rødt, så langrødt' },
            ]}
            value={flash}
            onChange={setFlash}
          />
        )}
      </Toolbar>

      <div ref={ref}>
        <DayFigure s={s} f={f} />
      </div>
      <Legend
        items={[
          { color: C_DAY, label: 'Lys (dag)' },
          { color: C_NIGHT, label: 'Mørke (natt)' },
          ...(interruption === 'glimt' ? [{ color: C_RED, label: 'Rødt lysglimt' }] : []),
          ...(interruption === 'glimt' && flash === 'rod-langrod' ? [{ color: C_FARRED, label: 'Langrødt lys rett etter' }] : []),
        ]}
      />

      <div ref={ref2}>
        <PlantsFigure s={s} f={f2} />
      </div>
      <Legend
        items={[
          { color: C_FLOWER, label: 'Nattlengder der planten blomstrer' },
          { color: VIZ.ink, label: 'Lengste mørkeperiode nå' },
          ...(interruption === 'glimt' && dark < 24 - day - 0.01 ? [{ color: VIZ.muted, label: 'Natta uten lysglimtet', dashed: true }] : []),
        ]}
      />

      <Readouts>
        <Readout label="Dag / natt" value={`${hoursText(day)} / ${hoursText(24 - day)}`} />
        <Readout label="Lengste mørkeperiode" value={hoursText(dark)} />
        <Readout label="Blomstrer" value={`${blooming.length} av ${PHOTO_PLANTS.length}`} unit="planter" tone={C_FLOWER} />
        {interruption === 'glimt' && <Readout label="Fytokrom etter glimtet" value={phytochromeAfterFlash(flash)} unit={flash === 'rod' ? '(aktiv form)' : '(inaktiv form)'} />}
      </Readouts>

      <Formula label="Kritisk nattlengde">
        <FormulaLine>
          Julestjerne (kortdag): {hoursText(dark)} {dark >= xmas.critical! ? '≥' : '<'} {hoursText(xmas.critical!)} →{' '}
          {flowers(xmas, dark) ? 'blomstrer' : 'blomstrer ikke'}
        </FormulaLine>
        <FormulaLine>
          Bulmeurt (langdag): {hoursText(dark)} {dark <= henbane.critical! ? '≤' : '>'} {hoursText(henbane.critical!)} →{' '}
          {flowers(henbane, dark) ? 'blomstrer' : 'blomstrer ikke'}
        </FormulaLine>
      </Formula>

      <Explain>{explanation(s, dark, blooming)}</Explain>
    </VizLayout>
  );
}

/* ====================================================================== */
/* Døgnet: lys og mørke fra kl. 12 til kl. 12 neste dag                     */
/* ====================================================================== */

function DayFigure({ s, f }: { s: Schedule; f: number }) {
  const x0 = 50;
  const x1 = 750;
  const barY = 50 * f + 8;
  const barH = 46 + 12 * (f - 1);
  const H = Math.round(barY + barH + 74 * f);
  // Tida går fra kl. 12 (venstre) gjennom midnatt (midten) til kl. 12 neste dag (høyre)
  const X = (hFromNoon: number) => x0 + ((x1 - x0) * hFromNoon) / 24;
  const half = s.day / 2;
  const night = 24 - s.day;
  const dark = longestDark(s);
  const ticks = [0, 6, 12, 18, 24];
  const clock = (h: number) => `kl. ${((h + 12) % 24).toString().padStart(2, '0')}`;
  const breakAt = Math.max(0.5, half / 2);
  const flashW = Math.max(4, ((x1 - x0) * FLASH_HOURS) / 24);
  // Klammer under den lengste mørkeperioden
  let br: [number, number] = [half, 24 - half];
  if (s.interruption === 'glimt' && s.flash === 'rod' && night > FLASH_HOURS) br = [half, 12 - FLASH_HOURS / 2];
  const bracketY = barY + barH + 14;
  return (
    <Figure
      viewBox={`0 0 800 ${H}`}
      label={`Døgnet med ${hoursText(s.day)} lys og ${hoursText(night)} mørke. Lengste sammenhengende mørkeperiode er ${hoursText(dark)}.`}
    >
      <Txt x={x0} y={22 * f} anchor="start" weight={700} size={0.9}>
        Døgnet
      </Txt>
      {/* Dag i begge ender, natt i midten */}
      <rect x={x0} y={barY} width={x1 - x0} height={barH} rx={10} fill={C_NIGHT} opacity={0.8} />
      {half > 0 && <rect x={x0} y={barY} width={X(half) - x0} height={barH} rx={10} fill={C_DAY} opacity={0.85} />}
      {half > 0 && <rect x={X(24 - half)} y={barY} width={x1 - X(24 - half)} height={barH} rx={10} fill={C_DAY} opacity={0.85} />}
      {/* Mørkt avbrudd om ettermiddagen */}
      {s.interruption === 'morkt' && s.day > 2 * DARK_BREAK_HOURS + 1 && (
        <g>
          <rect x={X(breakAt - 0.5)} y={barY} width={X(DARK_BREAK_HOURS) - x0} height={barH} fill={C_NIGHT} opacity={0.9} />
        </g>
      )}
      {/* Lysglimt ved midnatt */}
      {s.interruption === 'glimt' && night > FLASH_HOURS && (
        <g>
          <rect x={X(12) - flashW} y={barY - 6} width={flashW} height={barH + 12} rx={2} fill={C_RED} />
          {s.flash === 'rod-langrod' && <rect x={X(12)} y={barY - 6} width={flashW} height={barH + 12} rx={2} fill={C_FARRED} />}
        </g>
      )}
      {ticks.map((h) => (
        <Txt key={h} x={X(h)} y={barY - 8} anchor={h === 0 ? 'start' : h === 24 ? 'end' : 'middle'} size={0.72} muted>
          {clock(h)}
        </Txt>
      ))}
      {/* Den lengste mørkeperioden */}
      {dark > 0.01 && (
        <g>
          <path
            d={`M${X(br[0])},${bracketY - 6} V${bracketY} H${X(br[1])} V${bracketY - 6}`}
            fill="none"
            stroke={VIZ.ink}
            strokeWidth={2}
          />
          <Txt x={(X(br[0]) + X(br[1])) / 2} y={bracketY + 22 * f} size={0.78} weight={700}>
            lengste mørkeperiode {hoursText(dark)}
          </Txt>
        </g>
      )}
      {dark <= 0.01 && (
        <Txt x={400} y={bracketY + 22 * f} size={0.78} weight={700}>
          ingen mørkeperiode
        </Txt>
      )}
    </Figure>
  );
}

/* ====================================================================== */
/* Plantene: hvilke nattlengder de blomstrer ved                            */
/* ====================================================================== */

function PlantsFigure({ s, f }: { s: Schedule; f: number }) {
  const narrow = f > 1.3;
  const dark = longestDark(s);
  const night = 24 - s.day;
  const nameW = narrow ? 0 : 210;
  const glyphW = narrow ? 150 : 140;
  const bx0 = 20 + nameW + (narrow ? 0 : 10);
  const bx1 = 780 - glyphW;
  const head = 34 * f;
  const nameH = narrow ? 40 * f : 0;
  const rowH = narrow ? nameH + 64 : 74;
  const H = Math.round(head + PHOTO_PLANTS.length * rowH + 30 * f + 10);
  const X = (h: number) => bx0 + ((bx1 - bx0) * Math.min(24, Math.max(0, h))) / 24;
  return (
    <Figure
      viewBox={`0 0 800 ${H}`}
      maxHeight={narrow ? 1400 : H}
      label={`Plantene og nattlengdene de blomstrer ved. Med ${hoursText(dark)} sammenhengende mørke blomstrer ${PHOTO_PLANTS.filter((p) => flowers(p, dark))
        .map((p) => p.name.toLowerCase())
        .join(', ') || 'ingen'}.`}
    >
      <Txt x={bx0} y={22 * f} anchor="start" weight={700} size={0.9}>
        Blomstrer ved nattlengde
      </Txt>
      {[0, 6, 12, 18, 24].map((h) => (
        <g key={h}>
          <line x1={X(h)} x2={X(h)} y1={head} y2={head + PHOTO_PLANTS.length * rowH} stroke={VIZ.grid} strokeWidth={1} />
          <Txt x={X(h)} y={head + PHOTO_PLANTS.length * rowH + 22 * f} size={0.72} muted>
            {h} t
          </Txt>
        </g>
      ))}
      {/* Først stolpene, så strekene for natta, og til slutt tekstene (med lys kant) oppå */}
      {PHOTO_PLANTS.map((p, i) => {
        const barTop = head + i * rowH + nameH + 18;
        const [a, b] = floweringRange(p);
        return (
          <g key={p.id}>
            <rect x={X(0)} y={barTop} width={X(24) - X(0)} height={BAR_H} rx={6} fill={VIZ.grid} opacity={0.5} />
            <rect x={X(a)} y={barTop} width={X(b) - X(a)} height={BAR_H} rx={6} fill={C_FLOWER} opacity={0.75} />
          </g>
        );
      })}
      {s.interruption === 'glimt' && dark < night - 0.01 && (
        <line x1={X(night)} x2={X(night)} y1={head - 4} y2={head + PHOTO_PLANTS.length * rowH} stroke={VIZ.muted} strokeWidth={2} strokeDasharray="6 5" />
      )}
      <line x1={X(dark)} x2={X(dark)} y1={head - 4} y2={head + PHOTO_PLANTS.length * rowH} stroke={VIZ.ink} strokeWidth={3} />
      <circle cx={X(dark)} cy={head - 4} r={6} fill={VIZ.ink} />
      {PHOTO_PLANTS.map((p, i) => {
        const y = head + i * rowH;
        const barTop = y + nameH + 18;
        const on = flowers(p, dark);
        // Grensen står inne i stolpen, i enden bort fra den kritiske nattlengden
        const range = p.critical === null ? 'alle nattlengder' : p.type === 'langdag' ? `≤ ${hoursText(p.critical)}` : `≥ ${hoursText(p.critical)}`;
        const atEnd = p.type === 'kortdag';
        return (
          <g key={p.id}>
            {narrow ? (
              <Txt x={20} y={y + 26 * f} anchor="start" size={0.85} weight={700}>
                {p.name}{' '}
                <tspan fontStyle="italic" fontWeight={500}>
                  {p.latin}
                </tspan>
              </Txt>
            ) : (
              <g>
                <Txt x={20} y={y + 34} anchor="start" size={0.85} weight={700}>
                  {p.name}
                </Txt>
                <Txt x={20} y={y + 34 + 19 * f * 0.75} anchor="start" size={0.72} muted>
                  {TYPE_NAME[p.type]}
                </Txt>
              </g>
            )}
            <Txt x={atEnd ? X(24) - 8 : X(0) + 8} y={barTop + BAR_H / 2 + 5 * f} anchor={atEnd ? 'end' : 'start'} size={0.68} weight={700}>
              {range}
            </Txt>
            <PlantGlyph id={p.id} x={bx1 + 40} y={barTop + BAR_H} on={on} />
            <Txt x={bx1 + 76} y={barTop + BAR_H / 2 + 5 * f} anchor="start" size={0.72} weight={700} color={on ? C_FLOWER : VIZ.muted}>
              {on ? (narrow ? 'ja' : 'blomstrer') : 'nei'}
            </Txt>
          </g>
        );
      })}
    </Figure>
  );
}

/** Liten plante med eller uten blomst. Fargen på blomsten følger arten. */
function PlantGlyph({ id, x, y, on }: { id: string; x: number; y: number; on: boolean }) {
  const f = useTextScale();
  const k = Math.max(1, f * 0.85);
  const h = 44;
  const color =
    id === 'julestjerne'
      ? BIO.sir.I
      : id === 'krysantemum'
        ? BIO.golgi.line
        : id === 'jordbaer'
          ? VIZ.surface
          : id === 'bulmeurt'
            ? BIO.golgi.fill
            : id === 'tomat'
              ? BIO.sukker
              : BIO.plante.line;
  const top = y - h;
  return (
    <g>
      <line x1={x} x2={x} y1={y} y2={top + 6} stroke={BIO.plante.line} strokeWidth={3} strokeLinecap="round" />
      <path d={`M${x},${y - 12} q-14,-6 -20,-16 q12,0 20,12 Z`} fill={BIO.plante.fill} stroke={BIO.plante.line} strokeWidth={1.3} />
      <path d={`M${x},${y - 20} q14,-6 20,-16 q-12,0 -20,12 Z`} fill={BIO.plante.fill} stroke={BIO.plante.line} strokeWidth={1.3} />
      {on ? (
        id === 'timotei' ? (
          <ellipse cx={x} cy={top} rx={4 * k} ry={11 * k} fill={mixColor(BIO.plante.fill, BIO.ved, 0.5)} stroke={BIO.plante.line} strokeWidth={1.2} />
        ) : (
          <g>
            {Array.from({ length: 5 }, (_, i) => {
              const a = (i / 5) * Math.PI * 2;
              return (
                <ellipse
                  key={i}
                  cx={x + Math.cos(a) * 6 * k}
                  cy={top + Math.sin(a) * 6 * k}
                  rx={5 * k}
                  ry={3.5 * k}
                  transform={`rotate(${(a * 180) / Math.PI} ${x + Math.cos(a) * 6 * k} ${top + Math.sin(a) * 6 * k})`}
                  fill={color}
                  stroke={mixColor(color, VIZ.ink, 0.4)}
                  strokeWidth={1}
                />
              );
            })}
            <circle cx={x} cy={top} r={3 * k} fill={id === 'bulmeurt' ? BIO.sir.V : BIO.sukker} />
          </g>
        )
      ) : (
        <circle cx={x} cy={top + 2} r={4 * k} fill={BIO.plante.fill} stroke={BIO.plante.line} strokeWidth={1.3} />
      )}
    </g>
  );
}

/* ====================================================================== */
/* Forklaring                                                               */
/* ====================================================================== */

function explanation(s: Schedule, dark: number, blooming: PhotoPlant[]): ReactNode {
  const night = 24 - s.day;
  const names = (list: PhotoPlant[]) => (list.length ? list.map((p) => p.name.toLowerCase()).join(', ') : 'ingen');
  const ldp = blooming.filter((p) => p.type === 'langdag');
  const sdp = blooming.filter((p) => p.type === 'kortdag');
  const basics = (
    <p>
      <strong>Det er natta som teller.</strong> Plantene måler lengden på den sammenhengende mørkeperioden med fytokrom i bladene. Kortdagsplanter
      blomstrer når natta er <em>lengre</em> enn en kritisk nattlengde, langdagsplanter når den er <em>kortere</em>. Den kritiske nattlengden er
      forskjellig fra art til art, så «kort dag» betyr ikke «under 12 timer»: ved ca. 13 timers dag blomstrer både bulmeurt (langdag) og
      krysantemum (kortdag).
    </p>
  );
  let now: ReactNode;
  if (s.interruption === 'glimt' && night > FLASH_HOURS) {
    now =
      s.flash === 'rod' ? (
        <p>
          <strong>Et rødt lysglimt deler natta i to.</strong> Natta er {hoursText(night)}, men et glimt på bare noen minutter midt i natta gjør
          den lengste mørkeperioden til {hoursText(dark)}. Rødt lys gjør fytokrom om til den aktive formen Pfr, og plantene reagerer som om
          natta var kort. Kortdagsplanter som blomstrer: {names(sdp)}. Langdagsplanter som blomstrer: {names(ldp)}. Derfor kan gatelys og
          drivhuslys forstyrre blomstringen.
        </p>
      ) : (
        <p>
          <strong>Langrødt lys opphever det røde glimtet.</strong> Langrødt lys rett etter det røde gjør Pfr om til Pr igjen. Det er det siste
          lyset som avgjør, så plantene «merker» ikke glimtet, og natta regnes som {hoursText(dark)} sammenhengende mørke. Slik fant forskerne ut
          at fytokrom er lysreseptoren.
        </p>
      );
  } else if (s.interruption === 'morkt')
    now = (
      <p>
        <strong>Et mørkt avbrudd om dagen gjør ingenting.</strong> Plantene har til sammen {hoursText(totalDark(s))} mørke i døgnet, men den lengste
        sammenhengende mørkeperioden er fortsatt natta på {hoursText(dark)}. Det viser at det er nattlengden, ikke daglengden, plantene måler.
      </p>
    );
  else if (s.day >= 23.99)
    now = (
      <p>
        <strong>Midnattssol.</strong> Uten mørke blomstrer langdagsplantene ({names(ldp)}), men ingen kortdagsplanter. Mange planter i Nord-Norge er
        langdagsplanter som rekker å blomstre i den korte, lyse sommeren.
      </p>
    );
  else
    now = (
      <p>
        Med {hoursText(s.day)} lys er natta {hoursText(dark)}. Langdagsplanter som blomstrer: {names(ldp)}. Kortdagsplanter som blomstrer:{' '}
        {names(sdp)}. Tomat er dagnøytral og blomstrer uansett.
        {s.day <= 12.5 && s.day >= 8
          ? ' Julestjerne blomstrer når nettene er lengre enn ca. 11 t 40 min. I Sør-Norge blir nettene så lange fra slutten av september, og etter omtrent åtte uker med lange netter er de røde høybladene klare til jul.'
          : ''}
        {s.day >= 17 ? ' Slik er det i Sør-Norge rundt sankthans: nettene er så korte at bare langdagsplantene blomstrer.' : ''}
      </p>
    );
  return (
    <>
      {now}
      {basics}
    </>
  );
}
