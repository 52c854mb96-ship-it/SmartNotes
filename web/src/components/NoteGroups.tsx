import type { ReactNode } from 'react';
import { Link } from 'react-router';
import type { Note } from '@smartnotes/shared';
import type { NoteGroup } from '../lib/curriculum';
import { formatDayShort, noteDay, plural } from '../lib/format';
import { SectionCode } from './AimChips';
import { NoteCard } from './NoteCard';
import { NoteStatusBadge, Spinner } from './Status';

function GroupHeading({ group, as: Tag, className }: { group: NoteGroup; as: 'h2' | 'h3'; className: string }) {
  return (
    <Tag className={className}>
      {group.code && <span className="group-code">{group.code}</span>}
      <span className="group-title">{group.title}</span>
      <span className="group-count">
        <span aria-hidden>{group.notes.length}</span>
        <span className="sr-only">, {plural(group.notes.length, 'notat', 'notater')}</span>
      </span>
    </Tag>
  );
}

/** Notatkort gruppert (kapittelside / smale skjermer). */
export function NoteCardGroups({
  groups,
  withAnchors = true,
  showSection = true,
}: {
  groups: NoteGroup[];
  withAnchors?: boolean;
  /** Skjul delkapittel-koden på kortene når gruppene allerede er delkapitler. */
  showSection?: boolean;
}) {
  return (
    <div className="note-groups">
      {groups.map((g) => (
        <section key={g.key} className="note-group" id={withAnchors ? g.anchor : undefined} aria-label={g.title}>
          <GroupHeading group={g} as="h2" className="note-group-head" />
          <ul className="note-list" role="list">
            {g.notes.map((n) => (
              <li key={n.id}>
                <NoteCard note={n} showSection={showSection} />
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

/** Kompakt notatliste gruppert (midtkolonnen). */
export function NoteListGroups({
  groups,
  currentNoteId,
  showSection,
}: {
  groups: NoteGroup[];
  currentNoteId?: string;
  /** Vis delkapittel-kode på hvert notat (overflødig når gruppene allerede er delkapitler). */
  showSection: boolean;
}) {
  return (
    <>
      {groups.map((g) => (
        <section key={g.key} className="list-group" id={g.anchor} aria-label={g.title}>
          <GroupHeading group={g} as="h3" className="list-group-head" />
          <ul className="list-notes" role="list">
            {g.notes.map((n) => (
              <li key={n.id}>
                <NoteListItem note={n} current={n.id === currentNoteId} showSection={showSection} />
              </li>
            ))}
          </ul>
        </section>
      ))}
    </>
  );
}

export function NoteListItem({
  note,
  current,
  showSection,
  extra,
}: {
  note: Note;
  current: boolean;
  showSection: boolean;
  extra?: ReactNode;
}) {
  const refreshing = note.status === 'done' && note.stage !== null && note.stage !== undefined;
  return (
    <Link
      to={`/notat/${note.id}`}
      className={`list-note status-${note.status}${current ? ' is-current' : ''}`}
      aria-current={current ? 'page' : undefined}
    >
      <span className="list-note-title">{note.title || 'Uten tittel'}</span>
      <span className="list-note-meta">
        {showSection && note.section && <SectionCode code={note.section} />}
        <span>{formatDayShort(noteDay(note))}</span>
        <NoteStatusBadge note={note} />
        {refreshing && (
          <span className="list-note-refresh" title="Oppdaterer PDF">
            <Spinner size={10} />
          </span>
        )}
        {extra}
      </span>
    </Link>
  );
}
