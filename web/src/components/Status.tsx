import { AlertTriangle, CheckCircle2, Clock, CloudOff, UploadCloud } from 'lucide-react';
import type { Note } from '@smartnotes/shared';
import type { OutboxEntry } from '../db';
import { statusText } from '../lib/format';

export function Spinner({ size = 14, label }: { size?: number; label?: string }) {
  return (
    <span
      className="spinner"
      style={{ width: size, height: size }}
      role={label ? 'status' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    />
  );
}

export function NoteStatusBadge({ note, showDone = false }: { note: Pick<Note, 'status' | 'stage'>; showDone?: boolean }) {
  const text = statusText(note.status, note.stage);
  switch (note.status) {
    case 'queued':
      return (
        <span className="badge badge-neutral">
          <Clock size={13} aria-hidden /> {text}
        </span>
      );
    case 'processing':
      return (
        <span className="badge badge-accent">
          <Spinner size={11} /> {text}
        </span>
      );
    case 'failed':
      return (
        <span className="badge badge-danger">
          <AlertTriangle size={13} aria-hidden /> {text}
        </span>
      );
    case 'done':
      return showDone ? (
        <span className="badge badge-success">
          <CheckCircle2 size={13} aria-hidden /> {text}
        </span>
      ) : null;
  }
}

export function outboxStatusText(entry: OutboxEntry, online: boolean, progress: number | undefined): string {
  if (entry.state === 'error') return 'Opplasting feilet';
  if (entry.state === 'uploading' || progress !== undefined) {
    return progress !== undefined && progress > 0 ? `Laster opp … ${Math.round(progress * 100)} %` : 'Laster opp …';
  }
  return online ? 'Venter på opplasting' : 'Venter på nett';
}

export function OutboxStatusBadge({
  entry,
  online,
  progress,
}: {
  entry: OutboxEntry;
  online: boolean;
  progress: number | undefined;
}) {
  const text = outboxStatusText(entry, online, progress);
  if (entry.state === 'error') {
    return (
      <span className="badge badge-danger">
        <AlertTriangle size={13} aria-hidden /> {text}
      </span>
    );
  }
  if (entry.state === 'uploading' || progress !== undefined) {
    return (
      <span className="badge badge-accent">
        <UploadCloud size={13} aria-hidden /> {text}
      </span>
    );
  }
  return (
    <span className="badge badge-neutral">
      {online ? <Clock size={13} aria-hidden /> : <CloudOff size={13} aria-hidden />} {text}
    </span>
  );
}
