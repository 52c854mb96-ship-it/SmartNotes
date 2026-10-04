import { useRef, useState } from 'react';
import { Camera, ClipboardPaste, Plus, Sparkles, X } from 'lucide-react';
import type { Chapter, ChapterInput, Subject } from '@smartnotes/shared';
import { addChapters } from '../../actions';
import { api, errorMessage, isAbortError } from '../../api';
import { DropZone, PickedList, usePickedFiles } from '../../components/FilePicker';
import { Spinner } from '../../components/Status';
import { plural } from '../../lib/format';
import { prepareFile } from '../../lib/images';
import { toast } from '../../lib/ui';

type Mode = 'text' | 'image';

interface PreviewRow {
  key: number;
  include: boolean;
  number: string;
  title: string;
  duplicate: boolean;
}

const PLACEHOLDER = `1 Fysikk og måling
2 Rettlinjet bevegelse
3 Newtons lover
4 Arbeid, energi og effekt
…`;

let rowSeq = 0;

export function ChapterImport({ subject, existing, online }: { subject: Subject; existing: Chapter[]; online: boolean }) {
  const [mode, setMode] = useState<Mode>('text');
  const [text, setText] = useState('');
  const picked = usePickedFiles();
  const [busy, setBusy] = useState<null | 'parse' | 'extract' | 'save'>(null);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<PreviewRow[] | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const toRows = (chapters: ChapterInput[]): PreviewRow[] => {
    const numbers = new Set(existing.map((c) => (c.number ?? '').trim()).filter(Boolean));
    const titles = new Set(existing.map((c) => c.title.trim().toLowerCase()));
    return chapters.map((c) => {
      const duplicate =
        (!!c.number && numbers.has(c.number.trim())) || titles.has(c.title.trim().toLowerCase());
      return { key: ++rowSeq, include: !duplicate, number: c.number ?? '', title: c.title, duplicate };
    });
  };

  const parse = async () => {
    if (!text.trim()) return;
    setBusy('parse');
    setError(null);
    try {
      const res = await api.parseChapters(subject.id, text);
      if (!res.chapters.length) setError('Fant ingen kapitler i teksten. Skriv ett kapittel per linje, gjerne med nummer først.');
      else setRows(toRows(res.chapters));
    } catch (err) {
      setError(errorMessage(err, 'Kunne ikke tolke teksten.'));
    } finally {
      setBusy(null);
    }
  };

  const extract = async () => {
    if (!picked.items.length) return;
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setBusy('extract');
    setError(null);
    try {
      const files = [];
      for (const it of picked.items) files.push(await prepareFile(it.file));
      const res = await api.extractChapters(subject.id, files, ctrl.signal);
      if (!res.chapters.length) setError('Claude fant ingen kapitler på bildet. Prøv et skarpere bilde, eller lim inn teksten.');
      else setRows(toRows(res.chapters));
    } catch (err) {
      if (!isAbortError(err)) setError(errorMessage(err, 'Kunne ikke lese innholdsfortegnelsen.'));
    } finally {
      abortRef.current = null;
      setBusy(null);
    }
  };

  const save = async () => {
    if (!rows) return;
    const chosen = rows
      .filter((r) => r.include && r.title.trim())
      .map((r) => ({ number: r.number.trim() || null, title: r.title.trim() }));
    if (!chosen.length) return;
    setBusy('save');
    setError(null);
    try {
      await addChapters(subject.id, chosen);
      toast(`${plural(chosen.length, 'kapittel', 'kapitler')} er lagt til.`, { kind: 'success' });
      setRows(null);
      setText('');
      picked.clear();
    } catch (err) {
      setError(errorMessage(err, 'Kunne ikke legge til kapitlene.'));
    } finally {
      setBusy(null);
    }
  };

  const update = (key: number, patch: Partial<PreviewRow>) =>
    setRows((rs) => rs?.map((r) => (r.key === key ? { ...r, ...patch } : r)) ?? null);

  const includedCount = rows?.filter((r) => r.include && r.title.trim()).length ?? 0;
  const duplicateCount = rows?.filter((r) => r.duplicate).length ?? 0;
  const disabled = !online || busy !== null;

  return (
    <section className="card" aria-labelledby="import-h">
      <div className="card-head">
        <h2 id="import-h" className="card-title">
          Importer innholdsfortegnelse
        </h2>
        <p className="card-text">
          Lim inn innholdsfortegnelsen fra læreboka, eller ta bilde av den, så lager vi kapitlene for deg. Du ser over
          listen før noe lagres.
        </p>
      </div>

      {!rows && (
        <>
          <div className="segmented" role="tablist" aria-label="Importmåte">
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'text'}
              className="segment"
              onClick={() => setMode('text')}
            >
              <ClipboardPaste size={16} aria-hidden /> Lim inn tekst
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'image'}
              className="segment"
              onClick={() => setMode('image')}
            >
              <Camera size={16} aria-hidden /> Ta bilde<span className="hide-xs">&nbsp;av innholdsfortegnelsen</span>
            </button>
          </div>

          {mode === 'text' ? (
            <div className="stack">
              <label className="field">
                <span className="field-label sr-only">Innholdsfortegnelse</span>
                <textarea
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  rows={7}
                  placeholder={PLACEHOLDER}
                  disabled={disabled}
                  className="mono-input"
                />
              </label>
              <div className="card-actions">
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => void parse()}
                  disabled={disabled || !text.trim()}
                  title={online ? undefined : 'Krever nett'}
                >
                  {busy === 'parse' ? <Spinner size={14} /> : <Sparkles size={17} aria-hidden />}
                  Tolk teksten
                </button>
              </div>
            </div>
          ) : (
            <div className="stack">
              <DropZone
                onFiles={picked.add}
                accept="image/*"
                imagesOnly
                compact={picked.items.length > 0}
                disabled={disabled}
                hint="Ett bilde per side av innholdsfortegnelsen."
              />
              {picked.items.length > 0 && (
                <PickedList items={picked.items} onMove={picked.move} onRemove={picked.remove} disabled={disabled} />
              )}
              {busy === 'extract' ? (
                <div className="assembling assembling-inline" role="status">
                  <Spinner size={22} />
                  <div>
                    <strong>Claude leser innholdsfortegnelsen …</strong>
                    <p>Dette tar gjerne 30–60 sekunder.</p>
                  </div>
                  <button type="button" className="btn btn-sm" onClick={() => abortRef.current?.abort()}>
                    Avbryt
                  </button>
                </div>
              ) : (
                <div className="card-actions">
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={() => void extract()}
                    disabled={disabled || picked.items.length === 0}
                    title={online ? undefined : 'Krever nett'}
                  >
                    <Sparkles size={17} aria-hidden /> Les innholdsfortegnelsen
                  </button>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {rows && (
        <div className="stack">
          <p className="muted">
            Se over og rett opp før du lagrer. Kapitlene legges til etter de som finnes fra før.
            {duplicateCount > 0 &&
              ` ${plural(duplicateCount, 'kapittel', 'kapitler')} ser ut til å finnes allerede og er ikke valgt.`}
          </p>
          <ol className="chapter-rows preview-rows" role="list">
            <li className="chapter-row preview-row chapter-row-head" aria-hidden>
              <span />
              <span>Nr.</span>
              <span>Tittel</span>
            </li>
            {rows.map((r, i) => (
              <li key={r.key} className={`chapter-row preview-row${r.include ? '' : ' is-excluded'}`}>
                <input
                  type="checkbox"
                  checked={r.include}
                  onChange={(e) => update(r.key, { include: e.target.checked })}
                  aria-label={`Ta med rad ${i + 1}`}
                  className="checkbox"
                />
                <input
                  className="chapter-num-input"
                  value={r.number}
                  onChange={(e) => update(r.key, { number: e.target.value })}
                  aria-label={`Nummer, rad ${i + 1}`}
                  maxLength={12}
                />
                <span className="chapter-title-cell">
                  <input
                    value={r.title}
                    onChange={(e) => update(r.key, { title: e.target.value })}
                    aria-label={`Tittel, rad ${i + 1}`}
                    maxLength={200}
                  />
                  {r.duplicate && <span className="badge badge-neutral">Finnes</span>}
                </span>
                <button
                  type="button"
                  className="icon-btn"
                  onClick={() => setRows((rs) => rs?.filter((x) => x.key !== r.key) ?? null)}
                  aria-label={`Fjern rad ${i + 1}`}
                >
                  <X size={17} aria-hidden />
                </button>
              </li>
            ))}
          </ol>
          <div className="card-actions">
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() =>
                setRows((rs) => [
                  ...(rs ?? []),
                  { key: ++rowSeq, include: true, number: '', title: '', duplicate: false },
                ])
              }
              disabled={busy !== null}
            >
              <Plus size={17} aria-hidden /> Ny rad
            </button>
            <span className="spacer" />
            <button type="button" className="btn" onClick={() => setRows(null)} disabled={busy !== null}>
              Avbryt
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => void save()}
              disabled={!online || busy !== null || includedCount === 0}
              title={online ? undefined : 'Krever nett'}
            >
              {busy === 'save' && <Spinner size={14} />}
              Legg til {plural(includedCount, 'kapittel', 'kapitler')}
            </button>
          </div>
        </div>
      )}

      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}
