import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router';
import { ChevronLeft, Sparkles } from 'lucide-react';
import type { Chapter, FlashcardDifficulty, Note } from '@smartnotes/shared';
import { errorMessage } from '../api';
import { EmptyState, PageSkeleton } from '../components/EmptyState';
import { useChapters, useSubject, useSubjectNotes } from '../data';
import { createDeck } from '../flashcards/actions';
import { COUNT_CHOICES, DIFFICULTIES, DIFFICULTY_HINT, DIFFICULTY_LABEL } from '../flashcards/labels';
import { useOnline } from '../lib/connectivity';
import { groupByChapter, groupBySection, type NoteGroup } from '../lib/curriculum';
import { chapterHeading, chapterLabel, formatDayShort, noteDay, plural } from '../lib/format';
import { useDocumentTitle } from '../lib/useDocumentTitle';
import { NotFoundPage } from './NotFoundPage';

/** Samme grense som serveren. */
const MAX_NOTES = 40;

interface ChapterTree {
  group: NoteGroup;
  sections: NoteGroup[];
}

/** Ny kortstokk: velg notater (hele kapitler eller delkapitler med ett trykk), vanskelighetsgrad og antall kort. */
export function NewDeckPage() {
  const { subjectId } = useParams();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const subject = useSubject(subjectId);
  const chapters = useChapters(subjectId);
  const notes = useSubjectNotes(subjectId);
  const { online } = useOnline();
  useDocumentTitle(subject ? `Ny kortstokk · ${subject.name}` : null);

  const done = useMemo(() => (notes ?? []).filter((n) => n.status === 'done'), [notes]);
  const tree = useMemo<ChapterTree[]>(() => {
    const byId = new Map((chapters ?? []).map((c) => [c.id, c]));
    return groupByChapter(chapters ?? [], done).map((g) => ({
      group: g,
      sections: groupBySection(g.chapterId ? byId.get(g.chapterId) : null, g.notes),
    }));
  }, [chapters, done]);
  const ordered = useMemo(() => tree.flatMap((t) => t.sections.flatMap((s) => s.notes)), [tree]);

  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [difficulty, setDifficulty] = useState<FlashcardDifficulty>('mixed');
  const [count, setCount] = useState<number | null>(null);
  const [title, setTitle] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Forhåndsvalg fra lenker: ?notat=<id>, ?kapittel=<id> (og eventuelt &delkapittel=<kode>).
  const preselected = useRef(false);
  useEffect(() => {
    if (preselected.current || notes === undefined || chapters === undefined) return;
    preselected.current = true;
    const noteId = params.get('notat');
    const chapterId = params.get('kapittel');
    const section = params.get('delkapittel');
    const ids = done
      .filter((n) =>
        noteId ? n.id === noteId : chapterId ? (chapterId === 'uten' ? n.chapterId === null : n.chapterId === chapterId) && (!section || n.section === section) : false,
      )
      .map((n) => n.id);
    if (ids.length) setSelected(new Set(ids));
  }, [notes, chapters, done, params]);

  if (subject === undefined || chapters === undefined || notes === undefined) return <PageSkeleton />;
  if (subject === null) return <NotFoundPage what="faget" />;

  const back = (
    <nav className="breadcrumb" aria-label="Brødsmuler">
      <Link to={`/fag/${subject.id}/flashcards`}>
        <ChevronLeft size={16} aria-hidden />
        Flashcards
      </Link>
    </nav>
  );

  if (done.length === 0) {
    return (
      <div className="page">
        {back}
        <EmptyState title="Ingen ferdige notater ennå">
          <p>Kortene lages fra notatene dine. Last opp notater, og kom tilbake når de er konvertert.</p>
        </EmptyState>
      </div>
    );
  }

  const toggle = (ids: string[], on: boolean) =>
    setSelected((s) => {
      const next = new Set(s);
      for (const id of ids) (on ? next.add(id) : next.delete(id));
      return next;
    });
  const picked = ordered.filter((n) => selected.has(n.id));
  const pending = notes.length - done.length;
  const byId = new Map(chapters.map((c) => [c.id, c]));
  const suggestion = suggestTitle(picked, byId);

  const submit = async () => {
    if (!picked.length) return setError('Velg minst ett notat.');
    if (picked.length > MAX_NOTES) return setError(`Velg høyst ${MAX_NOTES} notater i én kortstokk.`);
    setBusy(true);
    setError(null);
    try {
      const deck = await createDeck({
        subjectId: subject.id,
        noteIds: picked.map((n) => n.id),
        difficulty,
        count,
        title: title.trim() || null,
      });
      navigate(`/fag/${subject.id}/flashcards/${deck.id}`, { replace: true });
    } catch (err) {
      setError(errorMessage(err, 'Kunne ikke lage kortstokken.'));
      setBusy(false);
    }
  };

  return (
    <div className="page page-narrow">
      {back}
      <header className="page-header">
        <div className="page-heading">
          <p className="eyebrow">{subject.name}</p>
          <h1 className="page-title">Ny kortstokk</h1>
          <p className="page-subtitle">Marker notatene som skal være med. Trykk på et kapittel eller delkapittel for å ta med alt i det.</p>
        </div>
      </header>

      <form
        className="stack fc-new"
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <fieldset className="fc-pick">
          <legend className="section-title">Notater</legend>
          <div className="fc-pick-head">
            <span className="muted">{picked.length ? `${plural(picked.length, 'notat', 'notater')} valgt` : 'Ingen valgt'}</span>
            <button
              type="button"
              className="link-btn"
              onClick={() => toggle(ordered.map((n) => n.id), picked.length !== ordered.length)}
            >
              {picked.length === ordered.length ? 'Fjern alle' : 'Velg alle'}
            </button>
          </div>
          <div className="fc-pick-tree">
            {tree.map(({ group, sections }) => {
              const ids = group.notes.map((n) => n.id);
              const chapter = group.chapterId ? byId.get(group.chapterId) : null;
              return (
                <div key={group.key} className="fc-pick-chapter">
                  <PickRow
                    level="chapter"
                    label={chapter ? chapterHeading(chapter) : group.title}
                    meta={plural(ids.length, 'notat', 'notater')}
                    ids={ids}
                    selected={selected}
                    onToggle={toggle}
                  />
                  {sections.map((s) => {
                    const sIds = s.notes.map((n) => n.id);
                    const showSection = sections.length > 1 || s.code !== null;
                    return (
                      <div key={s.key} className={showSection ? 'fc-pick-section' : undefined}>
                        {showSection && (
                          <PickRow
                            level="section"
                            label={s.code ? `${s.code} ${s.title}` : s.title}
                            ids={sIds}
                            selected={selected}
                            onToggle={toggle}
                          />
                        )}
                        {s.notes.map((n) => (
                          <PickRow
                            key={n.id}
                            level="note"
                            label={n.title || 'Notat uten tittel'}
                            meta={formatDayShort(noteDay(n))}
                            ids={[n.id]}
                            selected={selected}
                            onToggle={toggle}
                          />
                        ))}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
          {pending > 0 && (
            <p className="field-note">
              {pending === 1 ? 'Ett notat' : `${pending} notater`} er ikke ferdig konvertert og kan ikke velges ennå.
            </p>
          )}
        </fieldset>

        <fieldset className="field profile-choice">
          <legend className="section-title">Vanskelighetsgrad</legend>
          <div className="profile-options fc-difficulty">
            {DIFFICULTIES.map((d) => (
              <label key={d} className={`profile-option${difficulty === d ? ' is-on' : ''}`}>
                <input type="radio" name="fc-difficulty" value={d} checked={difficulty === d} onChange={() => setDifficulty(d)} />
                <span className="profile-option-text">
                  <span className="profile-option-label">{DIFFICULTY_LABEL[d]}</span>
                  <span className="profile-option-meta">{DIFFICULTY_HINT[d]}</span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        <fieldset className="field profile-choice">
          <legend className="section-title">Antall kort</legend>
          <div className="segmented" role="radiogroup" aria-label="Antall kort">
            {COUNT_CHOICES.map((c) => (
              <button
                key={c ?? 'auto'}
                type="button"
                role="radio"
                aria-checked={count === c}
                className="segment"
                onClick={() => setCount(c)}
              >
                {c === null ? 'Automatisk' : `Omtrent ${c}`}
              </button>
            ))}
          </div>
          {count === null && <span className="field-note">Claude velger ut fra hvor mye stoff notatene har.</span>}
        </fieldset>

        <label className="field">
          <span className="field-label">
            Navn <span className="optional">(valgfritt)</span>
          </span>
          <input type="text" value={title} maxLength={120} placeholder={suggestion} onChange={(e) => setTitle(e.currentTarget.value)} />
        </label>

        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <div className="fc-new-actions">
          <button type="submit" className="btn btn-primary btn-lg" disabled={busy || !online || picked.length === 0}>
            <Sparkles size={18} aria-hidden /> {busy ? 'Starter …' : 'Lag kortstokk'}
          </button>
          {!online && <span className="muted small">Krever nett: Claude lager kortene på serveren.</span>}
        </div>
      </form>
    </div>
  );
}

/** Samme navneforslag som serveren bruker når feltet står tomt. */
function suggestTitle(picked: Note[], chapters: Map<string, Chapter>): string {
  if (picked.length === 0) return 'Navn på kortstokken';
  if (picked.length === 1) return picked[0]!.title || 'Notat uten tittel';
  const ids = new Set(picked.map((n) => n.chapterId ?? ''));
  const only = picked[0]!.chapterId ? chapters.get(picked[0]!.chapterId) : undefined;
  if (ids.size === 1 && only) return chapterLabel(only);
  return `${picked.length} notater`;
}

function PickRow({
  level,
  label,
  meta,
  ids,
  selected,
  onToggle,
}: {
  level: 'chapter' | 'section' | 'note';
  label: string;
  meta?: string;
  ids: string[];
  selected: Set<string>;
  onToggle: (ids: string[], on: boolean) => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const count = ids.filter((id) => selected.has(id)).length;
  const all = count === ids.length && ids.length > 0;
  const some = count > 0 && !all;
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = some;
  }, [some]);
  return (
    <label className={`fc-pick-row is-${level}${all ? ' is-on' : ''}`}>
      <input ref={ref} type="checkbox" className="checkbox" checked={all} onChange={() => onToggle(ids, !all)} />
      <span className="fc-pick-label">{label}</span>
      {meta && <span className="fc-pick-meta">{meta}</span>}
    </label>
  );
}
