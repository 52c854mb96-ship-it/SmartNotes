import { useMemo, useState } from 'react';
import {
  Controls,
  Explain,
  Figure,
  Formula,
  FormulaLine,
  Legend,
  Readout,
  Readouts,
  Segmented,
  Slider,
  Sub,
  Toggle,
  Toolbar,
  VIZ,
  VizLayout,
  fmt,
  fmtSci,
} from '../../kit';
import {
  BOHR_B,
  ELEMENT_ORDER,
  STARS,
  STAR_ORDER,
  analyse,
  balmer,
  defaultLineIndex,
  elementNameCap,
  photon,
  spectrumCurve,
  starLines,
  type ElementId,
  type StarId,
} from './model-stjernespekter';
import { SpektrumPanel, panelLayout } from './stjernespekter-graf';
import { StjerneScene, sceneHeight } from './stjernespekter-scene';
import { darkLineText, labMatchText, progressText, temperatureText } from './stjernespekter-tekst';
import { useFigureTextScale } from './useNarrow';

const STAR_OPTIONS = STAR_ORDER.map((id) => ({ value: id, label: STARS[id].name }));

export default function Stjernespekter() {
  const [star, setStar] = useState<StarId>('capella');
  const [on, setOn] = useState<ElementId[]>(['H']);
  const [lineIdx, setLineIdx] = useState(() => defaultLineIndex(starLines('capella')));
  const [sceneRef, fs] = useFigureTextScale<HTMLDivElement>();
  const [panelRef, fp] = useFigureTextScale<HTMLDivElement>();

  const lines = useMemo(() => starLines(star), [star]);
  const curve = useMemo(() => spectrumCurve(star, 0.1), [star]);
  const a = useMemo(() => analyse(star, on), [star, on]);
  const idx = Math.min(lines.length - 1, Math.max(0, lineIdx));
  const status = a.lines[idx];
  const line = status?.line;
  const by = status?.explainedBy ?? null;
  const p = photon(line?.nm ?? 500);
  const info = STARS[star];
  const H = sceneHeight(fs);
  const PH = panelLayout(fp).H;

  const changeStar = (s: StarId) => {
    setStar(s);
    setLineIdx(defaultLineIndex(starLines(s)));
  };
  const toggle = (id: ElementId, value?: boolean) =>
    setOn((cur) => {
      const want = value ?? !cur.includes(id);
      const next = want ? [...cur, id] : cur.filter((x) => x !== id);
      return ELEMENT_ORDER.filter((x) => next.includes(x));
    });

  const foundText = a.found.length > 0 ? a.found.join(', ') : 'Ingen ennå';

  return (
    <VizLayout>
      <Toolbar>
        <Segmented label="Velg stjerne" options={STAR_OPTIONS} value={star} onChange={changeStar} />
      </Toolbar>
      <Toolbar>
        {ELEMENT_ORDER.map((id) => (
          <Toggle key={id} label={`${elementNameCap(id)} (${id})`} checked={on.includes(id)} onChange={(v) => toggle(id, v)} />
        ))}
      </Toolbar>
      <Controls>
        <Slider
          label="Velg mørk linje i stjernen"
          value={idx}
          onChange={setLineIdx}
          min={0}
          max={Math.max(0, lines.length - 1)}
          step={1}
          format={(v) => `${fmt(lines[v]?.nm ?? 0, 1)} nm`}
        />
      </Controls>

      <div ref={sceneRef}>
        <Figure
          viewBox={`0 0 800 ${H}`}
          maxHeight={Math.round(H * 1.1)}
          label={`Ikke i målestokk: utsnitt av stjernen ${info.name} med varm, tett gass innerst og en kjøligere atmosfære utenpå. Lyset går ${info.distanceLy} lysår til et teleskop med gitter og kamera på en snødekt ås. Et atom i atmosfæren tar opp et foton med bølgelengde ${fmt(line?.nm ?? 0, 1)} nm og sender det ut igjen i en annen retning.`}
        >
          <StjerneScene star={star} analysis={a} selected={idx} H={H} />
        </Figure>
      </div>

      <div ref={panelRef}>
        <Figure
          viewBox={`0 0 800 ${PH}`}
          maxHeight={Math.max(460, Math.round(PH * 1.05))}
          caption="Gitteret foran kameraet sprer stjernelyset i farger. Øverst lysstyrken, så spekteret fra stjernen, og under det de lyse linjene fra fem grunnstoffer målt i laboratoriet. Klikk i grafen for å velge en linje."
          label={`Spekteret til ${info.name}: graf over lysstyrken og absorpsjonsspekteret med ${a.total} mørke linjer, sammenlignet med emisjonsspektrene til hydrogen, helium, natrium, kalsium og jern fra laboratoriet. ${a.explained} av ${a.total} linjer er forklart${
            a.found.length > 0 ? ` av ${a.found.map((id) => elementNameCap(id).toLowerCase()).join(', ')}` : ''
          }.`}
        >
          <SpektrumPanel star={star} analysis={a} curve={curve} selected={idx} onSelect={setLineIdx} onToggle={(id) => toggle(id)} />
        </Figure>
      </div>
      <Legend
        items={[
          { color: VIZ.ink, label: 'Lysstyrke fra stjernen' },
          { color: VIZ.muted, dashed: true, label: 'Uten atmosfæren (bare det varme indre)' },
        ]}
      />

      <Readouts>
        <Readout label="Mørke linjer forklart" value={`${a.explained} av ${a.total}`} />
        <Readout label="Grunnstoffer som passer" value={foundText} />
        <Readout label="Valgt linje λ" value={fmt(line?.nm ?? 0, 1)} unit="nm" />
        <Readout label="Fotonenergi E" value={fmt(p.eV, 2)} unit="eV" />
      </Readouts>

      <Formula label="Fotonet i den valgte linja">
        <FormulaLine>
          f = c/λ = 3,00 · 10⁸ m/s / ({fmt(line?.nm ?? 0, 1)} · 10⁻⁹ m) = {fmtSci(p.f, 2)} Hz
        </FormulaLine>
        <FormulaLine>
          E = hf = 6,63 · 10⁻³⁴ J s · {fmtSci(p.f, 2)} Hz = {fmtSci(p.E, 2)} J = {fmt(p.eV, 2)} eV
        </FormulaLine>
        {line && by === 'H' && line.lab.n ? (
          <FormulaLine>
            Bohr: E = E<Sub>{line.lab.n}</Sub> − E<Sub>2</Sub> = {fmtSci(BOHR_B, 2)} J · (1/2² − 1/{line.lab.n}²) = {fmtSci(balmer(line.lab.n).E, 2)} J, samme
            foton
          </FormulaLine>
        ) : (
          line && <FormulaLine>{labMatchText(line, by, on)}</FormulaLine>
        )}
      </Formula>

      <Explain>
        <p>{progressText(star, a, on)}</p>
        <p>{darkLineText(line, by)}</p>
        <p>{temperatureText(star, a)}</p>
      </Explain>
    </VizLayout>
  );
}
