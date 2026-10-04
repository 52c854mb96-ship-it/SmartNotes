import { useMemo, useRef, useState } from 'react';
import { Camera, ClipboardPaste, Plus, Sparkles, X } from 'lucide-react';
import type { Chapter, ChapterInput, Section, Subject } from '@smartnotes/shared';
import { addChapters, updateChapter } from '../../actions';
import { AimChips } from '../../components/AimChips';
import { api, errorMessage, isAbortError } from '../../api';
import { DropZone, PickedList, usePickedFiles } from '../../components/FilePicker';
import { Spinner } from '../../components/Status';
import { aimMap, sectionsOf } from '../../lib/curriculum';
import { plural } from '../../lib/format';
import { prepareFile } from '../../lib/images';
import { toast } from '../../lib/ui';

type Mode = 'text' | 'image';

interface PreviewRow {
  key: number;
  include: boolean;
  number: string;
  title: string;
  /** Delkapitlene fra innholdsfortegnelsen (kan være tom). */
  sections: Section[];
}

const PLACEHOLDER = `1 Første kapittel
1.1 Første delkapittel
1.2 Andre delkapittel
2 Andre kapittel
…`;

/** Kapittelet som finnes fra før med samme nummer (eller samme tittel når nummeret mangler). */
function findMatch(existing: Chapter[], number: string, title: string): Chapter | null {
  const n = number.trim();
  if (n) return existing.find((c) => (c.number ?? '').trim() === n) ?? null;
  const t = title.trim().toLowerCase();
  return existing.find((c) => c.title.trim().toLowerCase() === t) ?? null;
}

function sameSections(a: Section[], b: Section[]): boolean {
  return a.length === b.length && a.every((s, i) => s.code === b[i]!.code && s.title === b[i]!.title);
}

/** Alle de importerte delkapitlene finnes allerede (f.eks. bare en del av innholdsfortegnelsen er limt inn). */
function isSubset(imported: Section[], stored: Section[]): boolean {
  return imported.every((s) => stored.some((x) => x.code === s.code && x.title === s.title));
}

let rowSeq = 0;

export function ChapterImport({ subject, existing, online }: { subject: Subject; existing: Chapter[]; online: boolean }) {
  // Fra forslaget på fagsiden («Ta bilde av innholdsfortegnelsen») åpnes bildeimporten med en gang.
  const [mode, setMode] = useState<Mode>(() => (location.hash === '#innholdsfortegnelse' ? 'image' : 'text'));
  const [text, setText] = useState('');
  const picked = usePickedFiles();
  const [busy, setBusy] = useState<null | 'parse' | 'extract' | 'save'>(null);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<PreviewRow[] | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const aims = useMemo(() => aimMap(subject), [subject]);

  /**
   * Nye kapitler er valgt med en gang. Et kapittel som finnes fra før, er bare valgt når innholdsfortegnelsen har
   * andre delkapitler enn det som er lagret, og da oppdateres delkapitlene (og tittelen) i stedet for å lage et nytt.
   */
  const toRows = (chapters: ChapterInput[]): PreviewRow[] =>
    chapters.map((c) => {
      const sections = c.sections ?? [];
      const match = findMatch(existing, c.number ?? '', c.title);
      const stored = sectionsOf(match);
      const include = !match || (sections.length > 0 && !sameSections(stored, sections) && !isSubset(sections, stored));
      return { key: ++rowSeq, include, number: c.number ?? '', title: c.title, sections };
    });

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
    const chosen = rows.filter((r) => r.include && r.title.trim());
    const fresh = chosen.filter((r) => !findMatch(existing, r.number, r.title));
    const updates = chosen.flatMap((r) => {
      const match = findMatch(existing, r.number, r.title);
      return match ? [{ row: r, match }] : [];
    });
    if (!fresh.length && !updates.length) return;
    setBusy('save');
    setError(null);
    try {
      if (fresh.length)
        await addChapters(
          subject.id,
          fresh.map((r) => ({
            number: r.number.trim() || null,
            title: r.title.trim(),
            ...(r.sections.length ? { sections: r.sections } : {}),
          })),
        );
      for (const { row, match } of updates)
        await updateChapter(match.id, { title: row.title.trim(), ...(row.sections.length ? { sections: row.sections } : {}) });
      const parts = [
        fresh.length ? `${plural(fresh.length, 'kapittel', 'kapitler')} er lagt til` : '',
        updates.length ? `${plural(updates.length, 'kapittel', 'kapitler')} er oppdatert` : '',
      ].filter(Boolean);
      toast(`${parts.join(', og ')}.`.replace(/^./, (c) => c.toUpperCase()), { kind: 'success' });
      setRows(null);
      setText('');
      picked.clear();
    } catch (err) {
      setError(errorMessage(err, 'Kunne ikke lagre kapitlene.'));
    } finally {
      setBusy(null);
    }
  };

  const update = (key: number, patch: Partial<PreviewRow>) =>
    setRows((rs) => rs?.map((r) => (r.key === key ? { ...r, ...patch } : r)) ?? null);

  const chosen = rows?.filter((r) => r.include && r.title.trim()) ?? [];
  const updateCount = chosen.filter((r) => findMatch(existing, r.number, r.title)).length;
  const newCount = chosen.length - updateCount;
  const skippedCount = rows?.filter((r) => !r.include && findMatch(existing, r.number, r.title)).length ?? 0;
  const sectionCount = rows?.reduce((n, r) => n + r.sections.length, 0) ?? 0;
  const disabled = !online || busy !== null;
  /** Hvor mange lagrede delkapitler som byttes ut når raden lagres. */
  const replaced = (r: PreviewRow) => {
    const match = r.include ? findMatch(existing, r.number, r.title) : null;
    return match ? sectionsOf(match).length : 0;
  };
  const saveLabel = !chosen.length
    ? 'Ingen endringer'
    : newCount && updateCount
      ? `Legg til ${newCount} og oppdater ${updateCount}`
      : updateCount
        ? `Oppdater ${plural(updateCount, 'kapittel', 'kapitler')}`
        : `Legg til ${plural(newCount, 'kapittel', 'kapitler')}`;

  return (
    <section className="card" aria-labelledby="import-h" id="innholdsfortegnelse">
      <div className="card-head">
        <h2 id="import-h" className="card-title">
          Importer innholdsfortegnelse
        </h2>
        <p className="card-text">
          Lim inn innholdsfortegnelsen fra læreboka, eller ta bilde av den, så lager vi kapitlene og delkapitlene for
          deg{aims.size > 0 ? ' og kobler delkapitlene til kompetansemålene' : ''}. Du ser over listen før noe lagres.
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
            Se over og rett opp før du lagrer. Nye kapitler legges til etter de som finnes fra før
            {sectionCount > 0 ? `, med ${plural(sectionCount, 'delkapittel', 'delkapitler')} i alt` : ''}.
            {updateCount > 0 &&
              ` ${plural(updateCount, 'kapittel', 'kapitler')} finnes allerede og får tittelen og delkapitlene herfra.`}
            {skippedCount > 0 &&
              ` ${plural(skippedCount, 'kapittel', 'kapitler')} finnes allerede og er ikke valgt. Velg ${skippedCount === 1 ? 'det' : 'dem'} hvis tittelen og delkapitlene skal byttes ut.`}
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
                  {findMatch(existing, r.number, r.title) &&
                    (r.include ? (
                      <span className="badge badge-accent">Oppdateres</span>
                    ) : (
                      <span className="badge badge-neutral">Finnes</span>
                    ))}
                </span>
                <button
                  type="button"
                  className="icon-btn"
                  onClick={() => setRows((rs) => rs?.filter((x) => x.key !== r.key) ?? null)}
                  aria-label={`Fjern rad ${i + 1}`}
                >
                  <X size={17} aria-hidden />
                </button>
                {r.sections.length > 0 && (
                  <details className="chapter-sections">
                    <summary>
                      {plural(r.sections.length, 'delkapittel', 'delkapitler')}
                      {replaced(r) > 0 && `, erstatter ${replaced(r)}`}
                    </summary>
                    <ol className="chapter-sections-list" role="list">
                      {r.sections.map((sec) => (
                        <li key={sec.code}>
                          <span className="group-code">{sec.code}</span>
                          <span className="chapter-sections-title">{sec.title}</span>
                          <AimChips codes={sec.aims} aims={aims} size="sm" />
                        </li>
                      ))}
                    </ol>
                  </details>
                )}
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
                  { key: ++rowSeq, include: true, number: '', title: '', sections: [] },
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
              disabled={!online || busy !== null || chosen.length === 0}
              title={online ? undefined : 'Krever nett'}
            >
              {busy === 'save' && <Spinner size={14} />}
              {saveLabel}
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
