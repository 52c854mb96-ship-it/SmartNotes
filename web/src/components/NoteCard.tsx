import { Link } from 'react-router';
import { MessageSquareWarning } from 'lucide-react';
import type { Note } from '@smartnotes/shared';
import { dayParts, formatDay, noteDay, plural } from '../lib/format';
import { NoteStatusBadge } from './Status';

export function NoteCard({ note }: { note: Note }) {
  const day = noteDay(note);
  const parts = dayParts(day);
  return (
    <Link to={`/notat/${note.id}`} className={`note-card status-${note.status}`}>
      <span className="date-chip" aria-hidden>
        <span className="date-chip-day">{parts?.day ?? '–'}</span>
        <span className="date-chip-month">{parts?.month ?? ''}</span>
      </span>
      <span className="note-card-body">
        <span className="note-card-title">{note.title || 'Uten tittel'}</span>
        <span className="note-card-meta">
          <span>{note.noteDate ? formatDay(note.noteDate) : `Lastet opp ${formatDay(day)}`}</span>
          {note.pageCount > 0 && <span>{plural(note.pageCount, 'side', 'sider')}</span>}
          {note.remarks.length > 0 && (
            <span className="note-card-remarks">
              <MessageSquareWarning size={14} aria-hidden />
              {plural(note.remarks.length, 'merknad', 'merknader')}
            </span>
          )}
        </span>
      </span>
      <span className="note-card-status">
        <NoteStatusBadge note={note} />
      </span>
    </Link>
  );
}
