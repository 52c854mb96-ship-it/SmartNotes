import { useMemo, useState } from 'react';
import { Target, X } from 'lucide-react';
import type { Chapter, CompetenceAim, Note, Subject } from '@smartnotes/shared';
import { aimCounts, aimsOf, groupByChapter, notesForAim } from '../lib/curriculum';
import { plural } from '../lib/format';
import { useListPaneShown } from '../lib/layout';
import { aimFilterStore, setListCollapsed } from '../lib/ui';
import { NoteCardGroups } from './NoteGroups';

/**
 * Kompetansemålene i faget med antall notater. Et klikk filtrerer notatlisten i midtkolonnen;
 * uten midtkolonne (smale skjermer) vises de aktuelle notatene rett under.
 */
export function AimsBlock({ subject, chapters, notes }: { subject: Subject; chapters: Chapter[]; notes: Note[] }) {
  const aims = aimsOf(subject);
  const paneShown = useListPaneShown();
  const filterState = aimFilterStore.use();
  const [inline, setInline] = useState<string | null>(null);
  const counts = useMemo(() => aimCounts(chapters, notes), [chapters, notes]);
  const selected = paneShown ? (filterState?.subjectId === subject.id ? filterState.aim : null) : inline;
  const inlineGroups = useMemo(
    () => (!paneShown && inline ? groupByChapter(chapters, notesForAim(chapters, notes, inline)) : []),
    [paneShown, inline, chapters, notes],
  );

  if (!aims.length) return null;

  const choose = (code: string) => {
    if (paneShown) {
      const same = filterState?.subjectId === subject.id && filterState.aim === code;
      aimFilterStore.set(same ? null : { subjectId: subject.id, aim: code });
      setListCollapsed(false);
    } else {
      setInline((cur) => (cur === code ? null : code));
    }
  };

  const regular = aims.filter((a) => !a.cross);
  const cross = aims.filter((a) => a.cross);

  const list = (items: CompetenceAim[]) => (
    <ul className="aim-list" role="list">
      {items.map((a) => {
        const count = counts.get(a.code) ?? 0;
        const on = selected === a.code;
        return (
          <li key={a.code}>
            <button
              type="button"
              className={`aim-row${on ? ' is-selected' : ''}${count === 0 ? ' is-empty' : ''}`}
              aria-pressed={on}
              onClick={() => choose(a.code)}
            >
              <span className="aim-code">{a.code}</span>
              <span className="aim-text">{a.text}</span>
              <span className="aim-count">{count > 0 ? plural(count, 'notat', 'notater') : 'Ingen notater'}</span>
            </button>
          </li>
        );
      })}
    </ul>
  );

  return (
    <section className="aims-block" aria-labelledby="aims-h">
      <div className="aims-head">
        <h2 id="aims-h" className="section-title">
          <Target size={17} aria-hidden /> Kompetansemål
        </h2>
        <p className="section-intro">
          {paneShown
            ? 'Velg et mål for å se notatene som dekker det i listen.'
            : 'Velg et mål for å se notatene som dekker det.'}
        </p>
      </div>
      {list(regular)}
      {cross.length > 0 && (
        <>
          <h3 className="aims-subhead">Går på tvers av kapitlene</h3>
          {list(cross)}
        </>
      )}
      {!paneShown && inline && (
        <div className="aims-inline" role="region" aria-label={`Notater som dekker ${inline}`}>
          <div className="aims-inline-head">
            <span>
              Notater som dekker <strong>{inline}</strong>
            </span>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setInline(null)}>
              <X size={15} aria-hidden /> Fjern filter
            </button>
          </div>
          {inlineGroups.length ? (
            <NoteCardGroups groups={inlineGroups} withAnchors={false} />
          ) : (
            <p className="muted">Ingen notater dekker {inline} ennå.</p>
          )}
        </div>
      )}
    </section>
  );
}
