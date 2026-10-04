import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { ArrowDown, ArrowUp, ChevronLeft, Plus, Trash2 } from 'lucide-react';
import type { Chapter, CompetenceAim, Subject } from '@smartnotes/shared';
import {
  createChapter,
  deleteChapter,
  deleteSubject,
  reorderChapters,
  updateChapter,
  updateSubject,
} from '../actions';
import { errorMessage } from '../api';
import { AimChips } from '../components/AimChips';
import { PageSkeleton } from '../components/EmptyState';
import { chapterStats, useChapters, useSubject, useSubjectNotes } from '../data';
import { useOnline } from '../lib/connectivity';
import { aimMap, sectionsOf } from '../lib/curriculum';
import { chapterHeading, plural } from '../lib/format';
import { PROFILES, SubjectIcon, profileOf } from '../lib/subjects';
import { confirmDialog, toast } from '../lib/ui';
import { useDocumentTitle } from '../lib/useDocumentTitle';
import { useHashScroll } from '../lib/useHashScroll';
import { ChapterImport } from './settings/ChapterImport';
import { NotFoundPage } from './NotFoundPage';

const OFFLINE_HINT = 'Krever nett';

export function SubjectSettingsPage() {
  const { subjectId } = useParams();
  const subject = useSubject(subjectId);
  const chapters = useChapters(subjectId);
  const notes = useSubjectNotes(subjectId);
  const { online } = useOnline();
  useDocumentTitle(subject ? `Innstillinger for ${subject.name}` : null);
  useHashScroll([subject !== undefined && chapters !== undefined]);

  if (subject === undefined || chapters === undefined) return <PageSkeleton />;
  if (subject === null) return <NotFoundPage what="faget" />;

  return (
    <div className="page page-narrow">
      <nav className="breadcrumb" aria-label="Brødsmuler">
        <Link to={`/fag/${subject.id}`}>
          <ChevronLeft size={16} aria-hidden />
          {subject.name}
        </Link>
      </nav>
      <header className="page-header">
        <div className="page-heading">
          <h1 className="page-title">Innstillinger for faget</h1>
          {!online && <p className="page-subtitle">Du er offline – endringer krever nett.</p>}
        </div>
      </header>

      <SubjectForm subject={subject} online={online} />

      <section className="card" aria-labelledby="chapters-h">
        <div className="card-head">
          <h2 id="chapters-h" className="card-title">
            Kapitler
          </h2>
          <p className="card-text">
            Bruk kapitlene fra læreboka, så sorterer Claude hvert notat i riktig kapittel.
          </p>
        </div>
        <ChapterEditor subject={subject} chapters={chapters} noteCounts={chapterStats(notes ?? [])} online={online} />
      </section>

      <ChapterImport subject={subject} existing={chapters} online={online} />

      <DangerZone subject={subject} noteCount={notes?.length ?? 0} online={online} />
    </div>
  );
}

function SubjectForm({ subject, online }: { subject: Subject; online: boolean }) {
  const [name, setName] = useState(subject.name);
  const [textbook, setTextbook] = useState(subject.textbook ?? '');
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    setName(subject.name);
    setTextbook(subject.textbook ?? '');
  }, [subject.name, subject.textbook]);

  const changed = name.trim() !== subject.name || (textbook.trim() || null) !== (subject.textbook ?? null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!changed || !name.trim()) return;
    setSaving(true);
    try {
      await updateSubject(subject.id, { name: name.trim(), textbook: textbook.trim() || null });
      toast('Faget er lagret.', { kind: 'success' });
    } catch (err) {
      toast(errorMessage(err, 'Kunne ikke lagre faget.'), { kind: 'error' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <form className="card" onSubmit={submit} aria-labelledby="subject-h">
      <div className="card-head">
        <h2 id="subject-h" className="card-title">
          Om faget
        </h2>
      </div>
      <div className="form-grid">
        <label className="field">
          <span className="field-label">Navn</span>
          <input value={name} onChange={(e) => setName(e.target.value)} maxLength={100} disabled={!online} required />
        </label>
        <label className="field">
          <span className="field-label">Lærebok / emne</span>
          <input
            value={textbook}
            onChange={(e) => setTextbook(e.target.value)}
            placeholder="F.eks. ERGO Fysikk 1"
            maxLength={200}
            disabled={!online}
          />
        </label>
        <div className="field field-full">
          <span className="field-label">Fagtype</span>
          <p className="field-static with-icon">
            <SubjectIcon profile={subject.profile} size={16} /> {PROFILES[profileOf(subject.profile)].label}, PDF-mal «
            {PROFILES[profileOf(subject.profile)].template}»
          </p>
        </div>
      </div>
      <div className="card-actions">
        <button
          type="submit"
          className="btn btn-primary"
          disabled={!online || !changed || saving || !name.trim()}
          title={online ? undefined : OFFLINE_HINT}
        >
          {saving ? 'Lagrer …' : 'Lagre'}
        </button>
      </div>
    </form>
  );
}

function ChapterEditor({
  subject,
  chapters,
  noteCounts,
  online,
}: {
  subject: Subject;
  chapters: Chapter[];
  noteCounts: Map<string, { count: number }>;
  online: boolean;
}) {
  const [number, setNumber] = useState('');
  const [title, setTitle] = useState('');
  const [adding, setAdding] = useState(false);
  const aims = aimMap(subject);

  const move = async (index: number, delta: -1 | 1) => {
    const j = index + delta;
    if (j < 0 || j >= chapters.length) return;
    const next = [...chapters];
    [next[index], next[j]] = [next[j]!, next[index]!];
    try {
      await reorderChapters(subject.id, next);
    } catch (err) {
      toast(errorMessage(err, 'Kunne ikke endre rekkefølgen.'), { kind: 'error' });
    }
  };

  const remove = async (c: Chapter) => {
    const count = noteCounts.get(c.id)?.count ?? 0;
    const ok = await confirmDialog({
      title: `Slette «${chapterHeading(c)}»?`,
      body:
        count > 0
          ? `${plural(count, 'notat', 'notater')} i kapittelet blir liggende under «Uten kapittel».`
          : 'Kapittelet har ingen notater.',
      confirmLabel: 'Slett kapittel',
      danger: true,
    });
    if (!ok) return;
    try {
      await deleteChapter(c.id);
      toast('Kapittelet er slettet.', { kind: 'success' });
    } catch (err) {
      toast(errorMessage(err, 'Kunne ikke slette kapittelet.'), { kind: 'error' });
    }
  };

  const add = async (e: FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    setAdding(true);
    try {
      await createChapter(subject.id, { number: number.trim() || null, title: title.trim() });
      setNumber('');
      setTitle('');
    } catch (err) {
      toast(errorMessage(err, 'Kunne ikke legge til kapittelet.'), { kind: 'error' });
    } finally {
      setAdding(false);
    }
  };

  return (
    <div className="chapter-editor">
      {chapters.length === 0 ? (
        <p className="muted">Ingen kapitler ennå. Legg dem til én og én, eller importer innholdsfortegnelsen nedenfor.</p>
      ) : (
        <ol className="chapter-rows" role="list">
          <li className="chapter-row chapter-row-head" aria-hidden>
            <span>Nr.</span>
            <span>Tittel</span>
          </li>
          {chapters.map((c, i) => (
            <ChapterRow
              key={c.id}
              chapter={c}
              online={online}
              first={i === 0}
              last={i === chapters.length - 1}
              noteCount={noteCounts.get(c.id)?.count ?? 0}
              aims={aims}
              onMove={(d) => void move(i, d)}
              onRemove={() => void remove(c)}
            />
          ))}
        </ol>
      )}
      <form className="chapter-row chapter-add" onSubmit={add} aria-label="Nytt kapittel">
        <input
          className="chapter-num-input"
          value={number}
          onChange={(e) => setNumber(e.target.value)}
          placeholder="Nr."
          aria-label="Kapittelnummer (valgfritt)"
          maxLength={12}
          disabled={!online || adding}
          inputMode="decimal"
        />
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Tittel på nytt kapittel"
          aria-label="Tittel på nytt kapittel"
          maxLength={200}
          disabled={!online || adding}
        />
        <button
          type="submit"
          className="btn"
          disabled={!online || adding || !title.trim()}
          title={online ? undefined : OFFLINE_HINT}
        >
          <Plus size={17} aria-hidden /> Legg til
        </button>
      </form>
    </div>
  );
}

function ChapterRow({
  chapter,
  online,
  first,
  last,
  noteCount,
  aims,
  onMove,
  onRemove,
}: {
  chapter: Chapter;
  online: boolean;
  first: boolean;
  last: boolean;
  noteCount: number;
  aims: Map<string, CompetenceAim>;
  onMove: (delta: -1 | 1) => void;
  onRemove: () => void;
}) {
  const [number, setNumber] = useState(chapter.number ?? '');
  const [title, setTitle] = useState(chapter.title);
  useEffect(() => {
    setNumber(chapter.number ?? '');
    setTitle(chapter.title);
  }, [chapter.number, chapter.title]);

  const commit = async () => {
    const n = number.trim() || null;
    const t = title.trim();
    if (!t) {
      setTitle(chapter.title);
      return;
    }
    if (n === chapter.number && t === chapter.title) return;
    try {
      await updateChapter(chapter.id, { number: n, title: t });
    } catch (err) {
      toast(errorMessage(err, 'Kunne ikke lagre kapittelet.'), { kind: 'error' });
      setNumber(chapter.number ?? '');
      setTitle(chapter.title);
    }
  };

  const onKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') e.currentTarget.blur();
    if (e.key === 'Escape') {
      setNumber(chapter.number ?? '');
      setTitle(chapter.title);
    }
  };

  const label = chapter.number ? `kapittel ${chapter.number}` : `«${chapter.title}»`;
  const sections = sectionsOf(chapter);
  return (
    <li className="chapter-row">
      <input
        className="chapter-num-input"
        value={number}
        onChange={(e) => setNumber(e.target.value)}
        onBlur={() => void commit()}
        onKeyDown={onKey}
        aria-label={`Nummer for ${label}`}
        maxLength={12}
        disabled={!online}
        inputMode="decimal"
      />
      <span className="chapter-title-cell">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={() => void commit()}
          onKeyDown={onKey}
          aria-label={`Tittel for ${label}`}
          maxLength={200}
          disabled={!online}
        />
        {noteCount > 0 && <span className="count-badge" title={plural(noteCount, 'notat', 'notater')}>{noteCount}</span>}
      </span>
      <span className="row-actions">
        <button
          type="button"
          className="icon-btn"
          onClick={() => onMove(-1)}
          disabled={!online || first}
          aria-label={`Flytt ${label} opp`}
          title={online ? 'Flytt opp' : OFFLINE_HINT}
        >
          <ArrowUp size={17} aria-hidden />
        </button>
        <button
          type="button"
          className="icon-btn"
          onClick={() => onMove(1)}
          disabled={!online || last}
          aria-label={`Flytt ${label} ned`}
          title={online ? 'Flytt ned' : OFFLINE_HINT}
        >
          <ArrowDown size={17} aria-hidden />
        </button>
        <button
          type="button"
          className="icon-btn icon-btn-danger"
          onClick={onRemove}
          disabled={!online}
          aria-label={`Slett ${label}`}
          title={online ? 'Slett' : OFFLINE_HINT}
        >
          <Trash2 size={17} aria-hidden />
        </button>
      </span>
      {sections.length > 0 && (
        <details className="chapter-sections">
          <summary>{sections.length === 1 ? '1 delkapittel' : `${sections.length} delkapitler`}</summary>
          <ol className="chapter-sections-list" role="list">
            {sections.map((sec) => (
              <li key={sec.code}>
                <span className="group-code">{sec.code}</span>
                <span className="chapter-sections-title">{sec.title}</span>
                <AimChips codes={sec.aims ?? []} aims={aims} size="sm" />
              </li>
            ))}
          </ol>
        </details>
      )}
    </li>
  );
}

function DangerZone({ subject, noteCount, online }: { subject: Subject; noteCount: number; online: boolean }) {
  const navigate = useNavigate();
  const remove = async () => {
    const ok = await confirmDialog({
      title: `Slette faget «${subject.name}»?`,
      body:
        noteCount > 0
          ? `Alle kapitlene og ${plural(noteCount, 'notat', 'notater')} med PDF-er slettes fra alle enhetene dine. Dette kan ikke angres.`
          : 'Faget og kapitlene slettes. Dette kan ikke angres.',
      confirmLabel: 'Slett faget',
      danger: true,
    });
    if (!ok) return;
    try {
      await deleteSubject(subject.id);
      toast('Faget er slettet.', { kind: 'success' });
      navigate('/', { replace: true });
    } catch (err) {
      toast(errorMessage(err, 'Kunne ikke slette faget.'), { kind: 'error' });
    }
  };
  return (
    <section className="card card-danger" aria-labelledby="danger-h">
      <div className="card-head">
        <h2 id="danger-h" className="card-title">
          Slett faget
        </h2>
        <p className="card-text">Sletter faget med alle kapitler og notater.</p>
      </div>
      <div className="card-actions">
        <button
          type="button"
          className="btn btn-danger-outline"
          onClick={() => void remove()}
          disabled={!online}
          title={online ? undefined : OFFLINE_HINT}
        >
          <Trash2 size={17} aria-hidden /> Slett faget …
        </button>
      </div>
    </section>
  );
}
