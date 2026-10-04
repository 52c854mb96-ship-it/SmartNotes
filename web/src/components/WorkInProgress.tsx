import { Link } from 'react-router';
import { FileText, RotateCcw, Trash2 } from 'lucide-react';
import type { Note } from '@smartnotes/shared';
import { retryNote } from '../actions';
import { errorMessage } from '../api';
import type { OutboxEntry } from '../db';
import { useOnline } from '../lib/connectivity';
import { formatTimestamp, plural } from '../lib/format';
import { confirmDialog, toast } from '../lib/ui';
import { deleteOutboxEntry, retryOutboxEntry, useSyncState } from '../sync';
import { NoteStatusBadge, OutboxStatusBadge } from './Status';

/** «Under arbeid»: opplastinger i kø og notater som konverteres eller har feilet. */
export function WorkInProgress({ outbox, notes }: { outbox: OutboxEntry[]; notes: Note[] }) {
  const active = notes.filter((n) => n.status !== 'done');
  if (!outbox.length && !active.length) return null;
  return (
    <section className="wip" aria-labelledby="wip-title">
      <h2 id="wip-title" className="section-title">
        Under arbeid
      </h2>
      <ul className="wip-list" role="list">
        {outbox.map((e) => (
          <OutboxRow key={e.clientId} entry={e} />
        ))}
        {active.map((n) => (
          <NoteRow key={n.id} note={n} />
        ))}
      </ul>
    </section>
  );
}

function OutboxRow({ entry }: { entry: OutboxEntry }) {
  const { online } = useOnline();
  const { uploadProgress } = useSyncState();
  const progress = uploadProgress[entry.clientId];
  const name = entry.title || `Nytt notat (${plural(entry.files.length, 'fil', 'filer')})`;

  const remove = async () => {
    const ok = await confirmDialog({
      title: 'Slette opplastingen?',
      body: 'Filene i denne opplastingen er bare lagret på enheten og blir borte.',
      confirmLabel: 'Slett',
      danger: true,
    });
    if (ok) await deleteOutboxEntry(entry.clientId);
  };

  return (
    <li className="wip-item">
      <span className="wip-icon" aria-hidden>
        <FileText size={18} />
      </span>
      <span className="wip-body">
        <span className="wip-title">{name}</span>
        <span className="wip-meta">
          <OutboxStatusBadge entry={entry} online={online} progress={progress} />
          <span className="muted">Lagt i kø {formatTimestamp(entry.createdAt)}</span>
        </span>
        {entry.state === 'error' && entry.lastError && <span className="wip-error">{entry.lastError}</span>}
        {progress !== undefined && (
          <span className="progress" aria-hidden>
            <span className="progress-bar" style={{ width: `${Math.round(progress * 100)}%` }} />
          </span>
        )}
      </span>
      <span className="wip-actions">
        {entry.state === 'error' && (
          <button type="button" className="btn btn-sm" onClick={() => void retryOutboxEntry(entry.clientId)}>
            <RotateCcw size={15} aria-hidden /> Prøv igjen
          </button>
        )}
        <button
          type="button"
          className="icon-btn"
          onClick={() => void remove()}
          aria-label={`Slett opplastingen «${name}»`}
          title="Slett"
        >
          <Trash2 size={17} aria-hidden />
        </button>
      </span>
    </li>
  );
}

function NoteRow({ note }: { note: Note }) {
  const { online } = useOnline();
  const retry = async () => {
    try {
      await retryNote(note.id, null);
      toast('Konverteringen starter på nytt.', { kind: 'success' });
    } catch (err) {
      toast(errorMessage(err, 'Kunne ikke starte konverteringen på nytt.'), { kind: 'error' });
    }
  };
  return (
    <li className="wip-item">
      <span className="wip-icon" aria-hidden>
        <FileText size={18} />
      </span>
      <span className="wip-body">
        <Link to={`/notat/${note.id}`} className="wip-title wip-link">
          {note.title || 'Nytt notat'}
        </Link>
        <span className="wip-meta">
          <NoteStatusBadge note={note} />
          <span className="muted">{plural(note.pageCount, 'side', 'sider')}</span>
        </span>
        {note.status === 'failed' && note.error && <span className="wip-error">{note.error}</span>}
      </span>
      {note.status === 'failed' && (
        <span className="wip-actions">
          <button
            type="button"
            className="btn btn-sm"
            onClick={() => void retry()}
            disabled={!online}
            title={online ? undefined : 'Krever nett'}
          >
            <RotateCcw size={15} aria-hidden /> Prøv igjen
          </button>
        </span>
      )}
    </li>
  );
}
