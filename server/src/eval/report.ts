/**
 * Rapporten fra måleverktøyet: én HTML-side med oversikt per modell og alle notatene side ved side. Eleven gir selv
 * karakter (1–5) på tekst, matematikk, figurer og helhet; karakterene lagres i nettleseren og kan lastes ned som CSV.
 */
import fsp from 'node:fs/promises';
import path from 'node:path';
import type { EvalResults, ModelRun } from './run.js';

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const nb = (n: number, digits = 1) => n.toLocaleString('nb-NO', { minimumFractionDigits: digits, maximumFractionDigits: digits });
const href = (p: string) => p.split(path.sep).map(encodeURIComponent).join('/');

const SUBJECT_LABELS: Record<EvalResults['subject'], string> = { physics: 'fysikk', chemistry: 'kjemi', biology: 'biologi', geoscience: 'geofag' };

const CRITERIA = [
  ['tekst', 'Tekst'],
  ['matte', 'Matte'],
  ['figurer', 'Figurer'],
  ['helhet', 'Helhet'],
] as const;

interface ModelSummary {
  model: string;
  notes: number;
  ok: number;
  compiled: number;
  fixRounds: number;
  pages: number;
  seconds: number;
  costNok: number | null;
  similarity: number[];
}

export function summarize(results: EvalResults): ModelSummary[] {
  return results.models.map((model) => {
    const s: ModelSummary = { model, notes: 0, ok: 0, compiled: 0, fixRounds: 0, pages: 0, seconds: 0, costNok: 0, similarity: [] };
    for (const note of results.notes) {
      const r = note.runs.find((x) => x.model === model);
      if (!r) continue;
      s.notes += 1;
      if (!r.ok) continue;
      s.ok += 1;
      if (r.compiled) s.compiled += 1;
      s.fixRounds += r.fixRounds;
      s.pages += note.pages.length;
      s.seconds += r.seconds;
      s.costNok = s.costNok === null || r.costNok === null ? null : s.costNok + r.costNok;
      if (r.similarity !== null) s.similarity.push(r.similarity);
    }
    return s;
  });
}

function runCard(results: EvalResults, noteName: string, pages: number, r: ModelRun, body: string | null): string {
  const stats = r.ok
    ? [
        r.compiled ? 'PDF uten feil' : 'Kompilerte ikke',
        `${r.fixRounds} ${r.fixRounds === 1 ? 'retting' : 'rettinger'}`,
        `${nb(r.seconds / Math.max(1, pages))} s per side`,
        r.costNok === null ? 'ukjent pris' : `${nb(r.costNok, 2)} kr`,
        `${r.inputTokens.toLocaleString('nb-NO')} tokens inn, ${r.outputTokens.toLocaleString('nb-NO')} ut`,
        `figurer: ${r.figuresCropped} av ${r.figuresRequested}`,
        r.similarity === null ? (r.model === results.reference ? 'referanse' : '') : `likhet ${nb(r.similarity * 100, 0)} %`,
      ].filter(Boolean)
    : [`Feil: ${r.error ?? 'ukjent'}`];
  const pdf = r.ok && r.compiled ? `${href(r.dir)}/main.pdf` : null;
  const scores = CRITERIA.map(
    ([id, label]) =>
      `<label>${label} <select data-note="${esc(noteName)}" data-model="${esc(r.model)}" data-criterion="${id}"><option value="">–</option>${[1, 2, 3, 4, 5]
        .map((v) => `<option>${v}</option>`)
        .join('')}</select></label>`,
  ).join('');
  const cards = r.cards
    ? `<details><summary>Kort (${r.cards.ok ? `${r.cards.cards.length}, ${nb(r.cards.seconds)} s` : 'feilet'})</summary>${
        r.cards.ok
          ? `<ol class="cards">${r.cards.cards
              .map((c) => `<li><strong>${esc(c.front)}</strong><ul>${c.back.map((b) => `<li>${esc(b)}</li>`).join('')}</ul></li>`)
              .join('')}</ol>`
          : `<p class="bad">${esc(r.cards.error ?? '')}</p>`
      }</details>`
    : '';
  return `<article class="run${r.ok && r.compiled ? '' : ' failed'}">
  <h3>${esc(r.model)}</h3>
  <p class="muted">${stats.map(esc).join(' · ')}</p>
  ${r.title ? `<p>Tittel: ${esc(r.title)}</p>` : ''}
  ${pdf ? `<object data="${pdf}" type="application/pdf" class="pdf"><a href="${pdf}">Åpne PDF-en</a></object><p><a href="${pdf}" target="_blank">Åpne PDF-en i egen fane</a></p>` : '<p class="muted">Ingen PDF.</p>'}
  ${r.remarks.length ? `<details><summary>Merknader (${r.remarks.length})</summary><ul>${r.remarks.map((x) => `<li>${esc(x)}</li>`).join('')}</ul></details>` : ''}
  ${body !== null ? `<details><summary>LaTeX</summary><pre>${esc(body)}</pre></details>` : ''}
  ${cards}
  <div class="scores">${scores}</div>
</article>`;
}

export async function writeReport(outDir: string, results: EvalResults): Promise<string> {
  const bodies = new Map<string, string | null>();
  for (const note of results.notes) {
    for (const r of note.runs) bodies.set(r.dir, r.ok ? await fsp.readFile(path.join(outDir, r.dir, 'body.tex'), 'utf8').catch(() => null) : null);
  }
  const html = renderReport(results, bodies);
  const file = path.join(outDir, 'rapport.html');
  await fsp.writeFile(file, html);
  return file;
}

export function renderReport(results: EvalResults, bodies: Map<string, string | null>): string {
  const summary = summarize(results)
    .map((s) => {
      const sim = s.similarity.length ? `${nb((s.similarity.reduce((a, b) => a + b, 0) / s.similarity.length) * 100, 0)} %` : '–';
      const perPage = (n: number) => (s.pages ? nb(n / s.pages, 2) : '–');
      return `<tr data-model="${esc(s.model)}"><th scope="row">${esc(s.model)}${s.model === results.reference ? ' <span class="muted">(referanse)</span>' : ''}</th>
<td>${s.ok} av ${s.notes}</td><td>${s.compiled} av ${s.notes}</td><td>${s.fixRounds}</td>
<td>${s.pages ? nb(s.seconds / s.pages) : '–'}</td><td>${s.costNok === null ? 'ukjent' : perPage(s.costNok)}</td><td>${s.costNok === null ? 'ukjent' : nb(s.costNok, 2)}</td>
<td>${sim}</td><td class="avg">–</td></tr>`;
    })
    .join('\n');

  const notes = results.notes
    .map(
      (note) => `<section class="note">
<h2>${esc(note.name)}</h2>
<div class="originals">${note.pages.map((p, i) => `<a href="${href(p.file)}" target="_blank"><img src="${href(p.file)}" alt="Side ${i + 1}" loading="lazy"></a>`).join('')}</div>
<div class="runs">${note.runs.map((r) => runCard(results, note.name, note.pages.length, r, bodies.get(r.dir) ?? null)).join('\n')}</div>
</section>`,
    )
    .join('\n');

  return `<!doctype html>
<html lang="nb">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Måling av modeller</title>
<style>
:root { --bg: #fbfaf7; --card: #ffffff; --text: #1d2330; --muted: #5d6573; --line: #dcdfe5; --accent: #2f5fb3; --bad: #b3261e; color-scheme: light dark; }
@media (prefers-color-scheme: dark) { :root { --bg: #14171c; --card: #1c2027; --text: #e6e8ec; --muted: #9aa2ae; --line: #2e343e; --accent: #8fb3ff; --bad: #ff8a80; } }
* { box-sizing: border-box; }
body { margin: 0; padding: 24px 16px 64px; background: var(--bg); color: var(--text); font: 15px/1.5 system-ui, -apple-system, "Segoe UI", sans-serif; }
main { max-width: 1400px; margin: 0 auto; }
h1 { font-size: 1.6rem; margin: 0 0 4px; } h2 { font-size: 1.25rem; margin: 32px 0 12px; } h3 { font-size: 1.05rem; margin: 0 0 4px; }
.muted { color: var(--muted); } .bad { color: var(--bad); }
.table-wrap { overflow-x: auto; }
table { border-collapse: collapse; width: 100%; background: var(--card); border: 1px solid var(--line); border-radius: 8px; }
th, td { text-align: left; padding: 8px 10px; border-bottom: 1px solid var(--line); white-space: nowrap; }
thead th { font-weight: 600; color: var(--muted); }
.note { border-top: 1px solid var(--line); }
.originals { display: flex; gap: 8px; overflow-x: auto; margin-bottom: 12px; }
.originals img { height: 160px; border: 1px solid var(--line); border-radius: 4px; background: #fff; }
.runs { display: grid; grid-template-columns: repeat(auto-fit, minmax(340px, 1fr)); gap: 16px; }
.run { background: var(--card); border: 1px solid var(--line); border-radius: 8px; padding: 14px; min-width: 0; }
.run.failed { border-color: var(--bad); }
.pdf { width: 100%; height: 520px; border: 1px solid var(--line); border-radius: 4px; }
pre { white-space: pre-wrap; word-break: break-word; font-size: 12px; max-height: 360px; overflow: auto; background: var(--bg); padding: 8px; border-radius: 4px; }
.scores { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 10px; }
.scores label { font-size: 0.9rem; }
select, button { font: inherit; color: inherit; background: var(--card); border: 1px solid var(--line); border-radius: 6px; padding: 3px 6px; }
button { cursor: pointer; padding: 6px 12px; }
.cards li { margin-bottom: 6px; }
a { color: var(--accent); }
</style>
</head>
<body>
<main>
<h1>Måling av modeller</h1>
<p class="muted">${esc(new Date(results.createdAt).toLocaleString('nb-NO'))} · fag: ${SUBJECT_LABELS[results.subject]} · ${results.notes.length} ${results.notes.length === 1 ? 'notat' : 'notater'} · kurs: 1 dollar = ${nb(results.usdNok, 2)} kr</p>
<p>Likhet viser hvor likt en modell har lest notatet som referansen (${esc(results.reference ?? 'ingen')}), regnet i ord. Det sier ikke hvem som har rett. Gi derfor også din egen karakter fra 1 til 5 under hver PDF: tekst (lest riktig), matte (formler og utregninger), figurer (riktig klippet eller tegnet) og helhet. Karakterene lagres i denne nettleseren.</p>
<div class="table-wrap"><table>
<thead><tr><th scope="col">Modell</th><th scope="col">Svarte</th><th scope="col">PDF uten feil</th><th scope="col">Rettinger</th><th scope="col">Sekunder per side</th><th scope="col">Kr per side</th><th scope="col">Kr totalt</th><th scope="col">Likhet</th><th scope="col">Din karakter</th></tr></thead>
<tbody>
${summary}
</tbody></table></div>
<p><button type="button" id="csv">Last ned karakterene (CSV)</button></p>
${notes}
</main>
<script>
(() => {
  const prefix = 'smartnotes-eval:' + ${JSON.stringify(results.createdAt)} + ':';
  const store = {
    get(k) { try { return localStorage.getItem(prefix + k) || ''; } catch { return ''; } },
    set(k, v) { try { v ? localStorage.setItem(prefix + k, v) : localStorage.removeItem(prefix + k); } catch {} },
  };
  const selects = [...document.querySelectorAll('select[data-note]')];
  const keyOf = (s) => JSON.stringify([s.dataset.note, s.dataset.model, s.dataset.criterion]);
  const update = () => {
    for (const row of document.querySelectorAll('tr[data-model]')) {
      const model = row.dataset.model;
      const values = selects.filter((s) => s.dataset.model === model && s.dataset.criterion === 'helhet' && s.value).map((s) => Number(s.value));
      row.querySelector('.avg').textContent = values.length ? (values.reduce((a, b) => a + b, 0) / values.length).toLocaleString('nb-NO', { maximumFractionDigits: 1 }) + ' (' + values.length + ')' : '–';
    }
  };
  for (const s of selects) {
    s.value = store.get(keyOf(s));
    s.addEventListener('change', () => { store.set(keyOf(s), s.value); update(); });
  }
  update();
  document.getElementById('csv').addEventListener('click', () => {
    const rows = [['notat', 'modell', 'kriterium', 'karakter']];
    for (const s of selects) if (s.value) rows.push([s.dataset.note, s.dataset.model, s.dataset.criterion, s.value]);
    const csv = rows.map((r) => r.map((c) => '"' + String(c).replace(/"/g, '""') + '"').join(';')).join('\\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob(['\\ufeff' + csv], { type: 'text/csv' }));
    a.download = 'karakterer.csv';
    a.click();
  });
})();
</script>
</body>
</html>
`;
}
