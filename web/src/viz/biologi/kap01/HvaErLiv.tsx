import { useState, type ReactNode } from 'react';
import {
  BIO,
  Explain,
  Figure,
  Forvalg,
  Legend,
  Readout,
  Readouts,
  Select,
  Toggle,
  Toolbar,
  Txt,
  VIZ,
  VizLayout,
  useContainerTextScale,
  useLineScale,
} from '../kit';
import { CandidateGlyph } from './Kandidater';
import {
  ALL_CRITERIA,
  CANDIDATES,
  CRITERIA,
  DEFINITIONS,
  MARK_NAMES,
  VERDICT_NAMES,
  candidate,
  failing,
  fullCount,
  matchingDefinition,
  verdict,
  wrapText,
  type Candidate,
  type CandidateId,
  type CriterionId,
  type Mark,
  type Verdict,
} from './model';

const MARK_COLOR: Record<Mark, string> = { ja: VIZ.series[2]!, delvis: BIO.sukker, hvile: BIO.vann, nei: VIZ.muted };
const VERDICT_COLOR: Record<Verdict, string> = { levende: VIZ.series[2]!, grense: BIO.sukker, ikke: VIZ.muted, ingen: VIZ.muted };

const lower = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);
const list = (items: string[]) => (items.length <= 1 ? items.join('') : `${items.slice(0, -1).join(', ')} og ${items.at(-1)}`);
const shortName = (id: CriterionId) => CRITERIA.find((c) => c.id === id)!.short;

export default function HvaErLiv() {
  const [required, setRequired] = useState<CriterionId[]>([...ALL_CRITERIA]);
  const [sel, setSel] = useState<CandidateId>('virus');
  const toggle = (id: CriterionId, on: boolean) =>
    setRequired((r) => ALL_CRITERIA.filter((c) => (c === id ? on : r.includes(c))));
  const C = candidate(sel);
  const counts = { levende: 0, grense: 0, ikke: 0 };
  for (const c of CANDIDATES) {
    const v = verdict(c, required);
    if (v !== 'ingen') counts[v]++;
  }
  const [ref, f] = useContainerTextScale<HTMLDivElement>();
  const [ref2, f2] = useContainerTextScale<HTMLDivElement>();

  return (
    <VizLayout>
      <Toolbar>
        <Forvalg
          label="Definisjon"
          options={DEFINITIONS.map((d) => ({ value: d.id, label: d.label, detail: d.detail }))}
          value={matchingDefinition(required)}
          onPick={(id) => setRequired([...DEFINITIONS.find((d) => d.id === id)!.criteria])}
        />
      </Toolbar>
      <Toolbar>
        {CRITERIA.map((c) => (
          <Toggle key={c.id} label={c.short} checked={required.includes(c.id)} onChange={(on) => toggle(c.id, on)} />
        ))}
      </Toolbar>
      <Toolbar>
        <Select label="Se nærmere på" value={sel} options={CANDIDATES.map((c) => ({ value: c.id, label: c.name }))} onChange={setSel} />
      </Toolbar>

      <div ref={ref}>
        <Matrix required={required} sel={sel} onSelect={setSel} onToggle={toggle} f={f} />
      </div>
      <Legend
        items={[
          { color: MARK_COLOR.ja, label: 'Ja' },
          { color: MARK_COLOR.delvis, label: 'Delvis eller bare tilsynelatende' },
          { color: MARK_COLOR.hvile, label: 'Ikke nå, men igjen når den våkner (hvile)' },
          { color: MARK_COLOR.nei, label: 'Nei' },
        ]}
      />

      <div ref={ref2}>
        <Detail c={C} required={required} f={f2} />
      </div>

      <Readouts>
        <Readout label="Levende" value={String(counts.levende)} unit="av 8" tone={VERDICT_COLOR.levende} />
        <Readout label="Grensetilfeller" value={String(counts.grense)} unit="av 8" tone={VERDICT_COLOR.grense} />
        <Readout label="Ikke levende" value={String(counts.ikke)} unit="av 8" />
        <Readout label={`${C.name} oppfyller helt`} value={String(fullCount(C))} unit="av 7 kjennetegn" tone={VERDICT_COLOR[verdict(C, ALL_CRITERIA)]} />
      </Readouts>

      <Explain>{explanation(C, required, counts)}</Explain>
    </VizLayout>
  );
}

/* ---------- Merke for ja / delvis / hvile / nei ---------- */

function MarkIcon({ mark, x, y, r, dim }: { mark: Mark; x: number; y: number; r: number; dim?: boolean }) {
  const lw = useLineScale();
  const c = MARK_COLOR[mark];
  return (
    <g opacity={dim ? 0.28 : 1}>
      {mark === 'ja' && (
        <g>
          <circle cx={x} cy={y} r={r} fill={c} />
          <path
            d={`M${x - r * 0.45},${y + r * 0.02} L${x - r * 0.1},${y + r * 0.38} L${x + r * 0.5},${y - r * 0.36}`}
            fill="none"
            stroke={VIZ.surface}
            strokeWidth={2.4 * lw}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </g>
      )}
      {mark === 'delvis' && (
        <g>
          <circle cx={x} cy={y} r={r - 1} fill={VIZ.surface} stroke={c} strokeWidth={2 * lw} />
          <path d={`M${x},${y - r + 1} A${r - 1},${r - 1} 0 0 0 ${x},${y + r - 1} Z`} fill={c} />
        </g>
      )}
      {mark === 'hvile' && (
        <g>
          <circle cx={x} cy={y} r={r - 1} fill={VIZ.surface} stroke={c} strokeWidth={2 * lw} strokeDasharray={`${r * 0.5} ${r * 0.3}`} />
          <line x1={x - r * 0.25} x2={x - r * 0.25} y1={y - r * 0.38} y2={y + r * 0.38} stroke={c} strokeWidth={2.2 * lw} strokeLinecap="round" />
          <line x1={x + r * 0.25} x2={x + r * 0.25} y1={y - r * 0.38} y2={y + r * 0.38} stroke={c} strokeWidth={2.2 * lw} strokeLinecap="round" />
        </g>
      )}
      {mark === 'nei' && (
        <g stroke={c} strokeWidth={2 * lw} strokeLinecap="round">
          <circle cx={x} cy={y} r={r - 1} fill="none" strokeOpacity={0.5} strokeWidth={1.2 * lw} />
          <line x1={x - r * 0.36} y1={y - r * 0.36} x2={x + r * 0.36} y2={y + r * 0.36} />
          <line x1={x - r * 0.36} y1={y + r * 0.36} x2={x + r * 0.36} y2={y - r * 0.36} />
        </g>
      )}
    </g>
  );
}

/* ---------- Tabellen: kandidater × kjennetegn ---------- */

function Matrix({
  required,
  sel,
  onSelect,
  onToggle,
  f,
}: {
  required: CriterionId[];
  sel: CandidateId;
  onSelect: (id: CandidateId) => void;
  onToggle: (id: CriterionId, on: boolean) => void;
  f: number;
}) {
  const narrow = f > 1.3;
  const k = Math.max(1, 0.85 * f);
  const glyph = 30 * k;
  const nameX = 12 + glyph + 12;
  const nameW = narrow ? 292 : 178;
  const verdictW = narrow ? 0 : 150;
  const gridX0 = nameX + nameW;
  // Kolonneoverskriftene står på skrå (40°, brattere på mobil). Den siste må ikke gå ut av figuren til høyre.
  const angle = narrow ? 58 : 40;
  const rad = (angle * Math.PI) / 180;
  const longest = Math.max(...CRITERIA.map((c) => c.short.length)) * 0.58 * 17 * 0.82 * f;
  const lastLen = CRITERIA.at(-1)!.short.length * 0.58 * 17 * 0.82 * f;
  let gridX1 = 800 - verdictW - 8;
  if (narrow) {
    // cx_siste + 4 + lastLen · cos ≤ 796, der cx_siste = gridX1 − colW/2
    const n = CRITERIA.length;
    gridX1 = Math.min(gridX1, (792 - lastLen * Math.cos(rad) - gridX0 / (2 * n)) / (1 - 1 / (2 * n)));
  }
  const colW = (gridX1 - gridX0) / CRITERIA.length;
  const headH = longest * Math.sin(rad) + 26 * f;
  const rowH = narrow ? 34 * f + 30 : 46;
  const top = headH + 6;
  const H = Math.round(top + CANDIDATES.length * rowH + 8);
  const r = Math.min(colW * 0.32, 13 * k);
  return (
    <Figure
      viewBox={`0 0 800 ${H}`}
      maxHeight={narrow ? 1400 : H}
      label={`Åtte kandidater vurdert mot ${required.length} kjennetegn på liv. ${CANDIDATES.map((c) => `${c.name}: ${VERDICT_NAMES[verdict(c, required)].toLowerCase()}`).join('. ')}.`}
      caption="Trykk på en rad for å se begrunnelsene, eller på en kolonne for å slå kjennetegnet av og på."
    >
      {CRITERIA.map((c, i) => {
        const on = required.includes(c.id);
        const cx = gridX0 + (i + 0.5) * colW;
        return (
          <g key={c.id} style={{ cursor: 'pointer' }} onClick={() => onToggle(c.id, !on)}>
            <rect x={cx - colW / 2 + 2} y={top - 4} width={colW - 4} height={H - top} rx={8} fill={on ? VIZ.grid : 'transparent'} opacity={0.55} />
            <g transform={`translate(${cx + 4} ${headH - 4}) rotate(${-angle})`}>
              <Txt x={0} y={0} anchor="start" size={0.82} weight={on ? 700 : 500} muted={!on}>
                {c.short}
              </Txt>
            </g>
          </g>
        );
      })}
      {!narrow && (
        <Txt x={800 - verdictW / 2 - 4} y={headH - 4} size={0.82} weight={700}>
          Dom
        </Txt>
      )}
      {CANDIDATES.map((c, j) => {
        const y = top + j * rowH;
        const cy = y + rowH / 2;
        const v = verdict(c, required);
        const isSel = c.id === sel;
        return (
          <g key={c.id} style={{ cursor: 'pointer' }} onClick={() => onSelect(c.id)}>
            <rect
              x={4}
              y={y + 2}
              width={792}
              height={rowH - 4}
              rx={10}
              fill={isSel ? VERDICT_COLOR[v] : 'transparent'}
              fillOpacity={isSel ? 0.12 : 0}
              stroke={isSel ? VERDICT_COLOR[v] : 'none'}
              strokeWidth={2}
            />
            <CandidateGlyph id={c.id} x={12 + glyph / 2} y={cy} size={glyph} title={c.name} />
            <Txt x={nameX} y={narrow ? cy - 8 : cy + 6 * f} anchor="start" size={0.9} weight={isSel ? 700 : 600}>
              {c.name}
            </Txt>
            {narrow && (
              <Txt x={nameX} y={cy + 20 * f - 8} anchor="start" size={0.78} weight={700} color={VERDICT_COLOR[v]}>
                {VERDICT_NAMES[v]}
              </Txt>
            )}
            {CRITERIA.map((cr, i) => (
              <MarkIcon key={cr.id} mark={c.marks[cr.id].mark} x={gridX0 + (i + 0.5) * colW} y={cy} r={r} dim={!required.includes(cr.id)} />
            ))}
            {!narrow && (
              <g>
                <rect
                  x={800 - verdictW}
                  y={cy - 15}
                  width={verdictW - 10}
                  height={30}
                  rx={15}
                  fill={VERDICT_COLOR[v]}
                  fillOpacity={v === 'ikke' || v === 'ingen' ? 0.14 : 0.2}
                  stroke={VERDICT_COLOR[v]}
                  strokeWidth={1.5}
                />
                <Txt x={800 - verdictW / 2 - 5} y={cy + 6} size={0.82} weight={700} color={VERDICT_COLOR[v]} halo={false}>
                  {VERDICT_NAMES[v]}
                </Txt>
              </g>
            )}
          </g>
        );
      })}
    </Figure>
  );
}

/* ---------- Den valgte kandidaten: begrunnelsene ---------- */

function Detail({ c, required, f }: { c: Candidate; required: CriterionId[]; f: number }) {
  const narrow = f > 1.3;
  const k = Math.max(1, 0.85 * f);
  const v = verdict(c, required);
  const glyph = 76 * k;
  const lineH = 20 * f;
  // Kolonner: symbol | kjennetegn | begrunnelse (på mobil står begrunnelsen under kjennetegnet)
  const headH = narrow ? glyph + 34 : 0;
  const textX = narrow ? 16 : 180;
  const nameColW = narrow ? 0 : 186;
  const reasonX = textX + nameColW;
  const chars = Math.floor((800 - reasonX - 14) / (0.8 * 17 * f * 0.58));
  let y = (narrow ? headH : 8) + 4;
  const rows = CRITERIA.map((cr) => {
    const lines = wrapText(c.marks[cr.id].why, chars);
    const top = y;
    const h = narrow ? 24 * f + lines.length * lineH + 10 : Math.max(1, lines.length) * lineH + 12;
    y += h;
    return { cr, lines, top, h };
  });
  const H = Math.round(Math.max(y + 6, narrow ? 0 : glyph + 90 * f));
  const icon = 9 * k;
  const head = (
    <g>
      <CandidateGlyph id={c.id} x={narrow ? 16 + glyph / 2 : 86} y={narrow ? glyph / 2 + 10 : glyph / 2 + 16} size={glyph} title={c.name} />
      <Txt x={narrow ? 32 + glyph : 86} y={narrow ? glyph / 2 + 4 : glyph + 46 * f} anchor={narrow ? 'start' : 'middle'} size={1.05} weight={700}>
        {c.name}
      </Txt>
      {c.sci && (
        <Txt x={narrow ? 32 + glyph : 86} y={narrow ? glyph / 2 + 4 + 22 * f : glyph + 46 * f + 22 * f} anchor={narrow ? 'start' : 'middle'} size={0.8} muted>
          <tspan fontStyle="italic">{c.sci}</tspan>
        </Txt>
      )}
      <Txt
        x={narrow ? 32 + glyph : 86}
        y={narrow ? glyph / 2 + 4 + (c.sci ? 44 : 22) * f : glyph + 46 * f + (c.sci ? 44 : 22) * f}
        anchor={narrow ? 'start' : 'middle'}
        size={0.85}
        weight={700}
        color={VERDICT_COLOR[v]}
      >
        {VERDICT_NAMES[v]}
      </Txt>
    </g>
  );
  return (
    <Figure
      viewBox={`0 0 800 ${H}`}
      maxHeight={narrow ? 1600 : H}
      label={`${c.name}: ${CRITERIA.map((cr) => `${cr.short} ${MARK_NAMES[c.marks[cr.id].mark].toLowerCase()}`).join(', ')}.`}
    >
      {head}
      {rows.map(({ cr, lines, top }, i) => {
        const on = required.includes(cr.id);
        const mark = c.marks[cr.id].mark;
        const firstY = top + 6 + 14 * f;
        return (
          <g key={cr.id} opacity={on ? 1 : 0.5}>
            {i > 0 && <line x1={textX} x2={790} y1={top} y2={top} stroke={VIZ.grid} strokeWidth={1.2} />}
            <MarkIcon mark={mark} x={textX + icon} y={firstY - 5 * f} r={icon} />
            <Txt x={textX + 2 * icon + 8} y={firstY} anchor="start" size={0.82} weight={700} color={on ? undefined : VIZ.muted}>
              {cr.short}
            </Txt>
            {lines.map((l, j) => (
              <Txt
                key={j}
                x={narrow ? textX : reasonX}
                y={narrow ? firstY + (j + 1) * lineH + 4 : firstY + j * lineH}
                anchor="start"
                size={0.8}
                muted
              >
                {l}
              </Txt>
            ))}
          </g>
        );
      })}
    </Figure>
  );
}

/* ---------- Forklaring ---------- */

function explanation(c: Candidate, required: CriterionId[], counts: { levende: number; grense: number; ikke: number }): ReactNode {
  const v = verdict(c, required);
  if (v === 'ingen')
    return (
      <p>
        Du har ikke valgt noen kjennetegn, så alt og ingenting er levende. Slå på kjennetegnene du mener må være med i en definisjon av
        liv.
      </p>
    );
  const no = failing(c, required, 'nei').map((id) => lower(shortName(id)));
  const partly = failing(c, required, 'delvis').map((id) => lower(shortName(id)));
  const resting = failing(c, required, 'hvile').map((id) => lower(shortName(id)));
  let main: ReactNode;
  if (v === 'levende')
    main = (
      <>
        <strong>{c.name} er levende etter din definisjon:</strong> den oppfyller alle de {required.length} kjennetegnene du har valgt.
      </>
    );
  else if (v === 'ikke')
    main = (
      <>
        <strong>{c.name} er ikke levende etter din definisjon.</strong> Den mangler {list(no)}
        {partly.length ? <>, og oppfyller {list(partly)} bare delvis</> : null}.
      </>
    );
  else
    main = (
      <>
        <strong>{c.name} er et grensetilfelle.</strong>{' '}
        {partly.length ? <>Den oppfyller {list(partly)} bare delvis. </> : null}
        {resting.length ? <>Den har {list(resting)} bare når den ikke er i hvile (latent liv). </> : null}
      </>
    );
  const all = required.length === ALL_CRITERIA.length;
  return (
    <>
      <p>
        {main} {c.consensus}
      </p>
      <p>
        {all ? (
          <>
            Med alle sju kjennetegnene er bare bakterien og gjærcellen helt levende, og frø og tardigrad er levende i hvile. Ingen enkelt
            egenskap er nok: ild vokser og sprer seg, og krystaller vokser, men det er <strong>kombinasjonen</strong> av kjennetegn som
            skiller liv fra ikke-liv. Velg definisjonen «Formering og arv» og se hva som skjer med viruset.
          </>
        ) : (
          <>
            Med {required.length} kjennetegn regnes {counts.levende} av 8 kandidater som
            levende og {counts.grense} som grensetilfeller. Jo færre kjennetegn definisjonen har, jo flere ting slipper inn. Derfor er
            virus omdiskutert: de mangler celler og eget stoffskifte, men har arvestoff og utvikler seg.
          </>
        )}
      </p>
    </>
  );
}
