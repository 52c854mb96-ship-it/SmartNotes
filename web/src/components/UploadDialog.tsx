import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { Link } from 'react-router';
import { Info, Sparkles } from 'lucide-react';
import { useChapters, useSubjects } from '../data';
import { useOnline } from '../lib/connectivity';
import { chapterLabel, plural, todayISO } from '../lib/format';
import { MAX_FILE_BYTES, MAX_FILES, isPdf, prepareFile } from '../lib/images';
import { closeUpload, toast, uploadStore, type UploadRequest } from '../lib/ui';
import { uuid } from '../lib/uuid';
import { enqueueUpload } from '../sync';
import type { OutboxFile } from '../db';
import { DropZone, PickedList, acceptFiles, usePickedFiles } from './FilePicker';
import { Modal } from './Modal';

let sessionSeq = 0;

export function UploadDialog() {
  const req = uploadStore.use();
  const [session, setSession] = useState(0);
  const [busy, setBusy] = useState(false);
  const { online } = useOnline();
  const wasOpen = useRef(false);

  // Ny «økt» (blank skjema) hver gang dialogen åpnes.
  useEffect(() => {
    if (req && !wasOpen.current) setSession(++sessionSeq);
    wasOpen.current = !!req;
  }, [req]);

  return (
    <Modal
      open={!!req}
      onClose={closeUpload}
      busy={busy}
      size="lg"
      title="Last opp notater"
      description="Bildene eller PDF-ene blir til en pen LaTeX-PDF, sortert i riktig kapittel."
      footer={
        <>
          <button type="button" className="btn" onClick={closeUpload} disabled={busy}>
            Avbryt
          </button>
          <button type="submit" form="upload-form" className="btn btn-primary" disabled={busy}>
            {busy ? 'Forbereder …' : online ? 'Last opp' : 'Lagre i kø'}
          </button>
        </>
      }
    >
      {req && session > 0 && <UploadForm key={session} req={req} onBusy={setBusy} />}
    </Modal>
  );
}

function UploadForm({ req, onBusy }: { req: UploadRequest; onBusy: (busy: boolean) => void }) {
  const subjects = useSubjects();
  const { online } = useOnline();
  const [subjectId, setSubjectId] = useState<string>(req.subjectId ?? '');
  const effectiveSubjectId = subjectId || subjects?.[0]?.id || '';
  const chapters = useChapters(effectiveSubjectId);
  const [chapterId, setChapterId] = useState<string>(
    req.chapterId && req.chapterId !== 'uten' ? req.chapterId : 'auto',
  );
  const [title, setTitle] = useState('');
  const [noteDate, setNoteDate] = useState('');
  const [instructions, setInstructions] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<string | null>(null);
  const picked = usePickedFiles(req.files ?? []);

  // Ugyldig kapittelvalg (f.eks. etter bytte av fag) → la Claude velge.
  useEffect(() => {
    if (chapterId !== 'auto' && chapters && !chapters.some((c) => c.id === chapterId)) setChapterId('auto');
  }, [chapters, chapterId]);

  const totalSize = useMemo(() => picked.items.reduce((sum, it) => sum + it.file.size, 0), [picked.items]);
  const busy = progress !== null;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!effectiveSubjectId) {
      setError('Opprett et fag først.');
      return;
    }
    if (!picked.items.length) {
      setError('Velg minst ett bilde eller én PDF.');
      return;
    }
    if (picked.items.length > MAX_FILES) {
      setError(`Du kan laste opp maks ${MAX_FILES} filer om gangen.`);
      return;
    }
    const bigPdf = picked.items.find((it) => isPdf(it.file) && it.file.size > MAX_FILE_BYTES);
    if (bigPdf) {
      setError(`«${bigPdf.file.name}» er større enn 30 MB.`);
      return;
    }

    onBusy(true);
    try {
      const files: OutboxFile[] = [];
      for (const [i, it] of picked.items.entries()) {
        setProgress(`Forbereder ${i + 1} av ${picked.items.length} …`);
        files.push(await prepareFile(it.file));
      }
      const tooBig = files.find((f) => f.blob.size > MAX_FILE_BYTES);
      if (tooBig) {
        setError(`«${tooBig.name}» er større enn 30 MB.`);
        return;
      }
      setProgress('Lagrer …');
      await enqueueUpload({
        clientId: uuid(),
        subjectId: effectiveSubjectId,
        chapterId,
        title: title.trim(),
        noteDate,
        instructions: instructions.trim(),
        files,
      });
      closeUpload();
      toast(online ? 'Lagt i kø – konverteringen starter straks.' : 'Lagret – lastes opp når du er på nett.', {
        kind: 'success',
      });
    } catch (err) {
      const quota = err instanceof DOMException && err.name === 'QuotaExceededError';
      setError(
        quota
          ? 'Det er ikke nok lagringsplass på enheten til å lagre opplastingen.'
          : 'Kunne ikke lagre opplastingen på enheten. Prøv igjen.',
      );
    } finally {
      setProgress(null);
      onBusy(false);
    }
  };

  const hasChapters = (chapters?.length ?? 0) > 0;

  return (
    <form
      id="upload-form"
      className="upload-form"
      onSubmit={submit}
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        if (busy) return;
        const files = acceptFiles(Array.from(e.dataTransfer.files));
        if (files.length) picked.add(files);
      }}
      onPaste={(e) => {
        const files = Array.from(e.clipboardData.files).filter((f) => f.type.startsWith('image/'));
        if (files.length) {
          e.preventDefault();
          picked.add(files);
        }
      }}
    >
      {!online && (
        <p className="callout callout-info">
          <Info size={16} aria-hidden />
          Du er offline. Notatene lagres på enheten og lastes opp automatisk når du er på nett igjen.
        </p>
      )}

      <DropZone
        onFiles={picked.add}
        accept="image/*,application/pdf"
        compact={picked.items.length > 0}
        disabled={busy}
        hint="Én fil per side, i riktig rekkefølge. Maks 40 filer."
      />

      {picked.items.length > 0 && (
        <div className="picked-wrap">
          <div className="picked-summary">
            {plural(picked.items.length, 'fil', 'filer')} · {Math.round(totalSize / 1024 / 1024) || '<1'} MB
          </div>
          <PickedList items={picked.items} onMove={picked.move} onRemove={picked.remove} disabled={busy} />
        </div>
      )}

      <div className="form-grid">
        {(subjects?.length ?? 0) > 1 && (
          <label className="field">
            <span className="field-label">Fag</span>
            <select value={effectiveSubjectId} onChange={(e) => setSubjectId(e.target.value)} disabled={busy}>
              {subjects?.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>
        )}

        {hasChapters ? (
          <label className="field">
            <span className="field-label">Kapittel</span>
            <select value={chapterId} onChange={(e) => setChapterId(e.target.value)} disabled={busy}>
              <option value="auto">La Claude velge kapittel</option>
              {chapters?.map((c) => (
                <option key={c.id} value={c.id}>
                  {chapterLabel(c)}
                </option>
              ))}
            </select>
          </label>
        ) : (
          <div className="field field-full">
            <span className="field-label">Kapittel</span>
            <p className="field-note">
              <Sparkles size={16} aria-hidden />
              <span>
                Faget har ingen kapitler ennå, så Claude foreslår et passende kapittel ut fra innholdet.{' '}
                {effectiveSubjectId && (
                  <Link to={`/fag/${effectiveSubjectId}/innstillinger`} onClick={closeUpload}>
                    Legg inn lærebokas kapitler
                  </Link>
                )}{' '}
                for mer presis sortering.
              </span>
            </p>
          </div>
        )}

        <label className="field">
          <span className="field-label">
            Dato <span className="optional">(valgfri)</span>
          </span>
          <span className="input-with-action">
            <input type="date" value={noteDate} onChange={(e) => setNoteDate(e.target.value)} disabled={busy} />
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setNoteDate(todayISO())} disabled={busy}>
              I dag
            </button>
          </span>
        </label>

        <label className="field field-full">
          <span className="field-label">
            Tittel <span className="optional">(valgfri)</span>
          </span>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Claude lager en tittel hvis du lar feltet stå tomt"
            maxLength={200}
            disabled={busy}
            enterKeyHint="done"
          />
        </label>

        <label className="field field-full">
          <span className="field-label">
            Ekstra instruksjoner til Claude <span className="optional">(valgfri)</span>
          </span>
          <textarea
            value={instructions}
            onChange={(e) => setInstructions(e.target.value)}
            placeholder="F.eks. «Side 3 er en fortsettelse av forrige forelesning»"
            rows={3}
            maxLength={2000}
            disabled={busy}
          />
        </label>
      </div>

      {progress && (
        <p className="form-progress" role="status">
          <span className="spinner" aria-hidden /> {progress}
        </p>
      )}
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
    </form>
  );
}
