import { useState, type FormEvent } from 'react';
import type { Note } from '@smartnotes/shared';
import { retryNote } from '../../actions';
import { errorMessage } from '../../api';
import { Modal } from '../../components/Modal';
import { toast } from '../../lib/ui';

export function RetryDialog({ note, open, onClose }: { note: Note; open: boolean; onClose: () => void }) {
  const [busy, setBusy] = useState(false);
  return (
    <Modal
      open={open}
      onClose={onClose}
      busy={busy}
      title="Konverter på nytt"
      description="Claude leser originalsidene på nytt og lager en ny PDF. Den gamle PDF-en erstattes når den nye er klar."
      footer={
        <>
          <button type="button" className="btn" onClick={onClose} disabled={busy}>
            Avbryt
          </button>
          <button type="submit" form="retry-form" className="btn btn-primary" disabled={busy}>
            {busy ? 'Starter …' : 'Konverter på nytt'}
          </button>
        </>
      }
    >
      {open && <RetryForm note={note} onBusy={setBusy} onDone={onClose} />}
    </Modal>
  );
}

function RetryForm({ note, onBusy, onDone }: { note: Note; onBusy: (b: boolean) => void; onDone: () => void }) {
  const [instructions, setInstructions] = useState(note.instructions ?? '');
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    onBusy(true);
    setError(null);
    try {
      await retryNote(note.id, instructions.trim() || null);
      toast('Konverteringen starter på nytt.', { kind: 'success' });
      onDone();
    } catch (err) {
      setError(errorMessage(err, 'Kunne ikke starte konverteringen.'));
    } finally {
      onBusy(false);
    }
  };

  return (
    <form id="retry-form" onSubmit={submit} className="stack">
      <label className="field">
        <span className="field-label">
          Ekstra instruksjoner til Claude <span className="optional">(valgfri)</span>
        </span>
        <textarea
          value={instructions}
          onChange={(e) => setInstructions(e.target.value)}
          rows={4}
          maxLength={2000}
          placeholder="F.eks. «Formelen nederst på side 2 er F = ma, ikke F = mv»"
          data-autofocus
        />
      </label>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
    </form>
  );
}
