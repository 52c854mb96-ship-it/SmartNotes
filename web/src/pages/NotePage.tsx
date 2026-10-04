import { useEffect, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router';
import {
  AlertTriangle,
  ChevronLeft,
  Download,
  FileCode2,
  FileText,
  Images,
  MessageSquareWarning,
  Pencil,
  RotateCcw,
  Sparkles,
  Trash2,
} from 'lucide-react';
import type { Chapter, Note, Subject } from '@smartnotes/shared';
import { deleteNote, retryNote, updateNote } from '../actions';
import { errorMessage, urls } from '../api';
import { AimChips } from '../components/AimChips';
import { VizLinks } from '../components/VizLinks';
import { PageSkeleton } from '../components/EmptyState';
import { Menu } from '../components/Menu';
import { NoteStatusBadge, Spinner } from '../components/Status';
import { useChapters, useNote, useSubject } from '../data';
import { db } from '../db';
import { useOnline } from '../lib/connectivity';
import { aimMap, noteAimCodes, noteSectionCode, sectionLabel, sectionsOf } from '../lib/curriculum';
import { downloadUrl, saveBlob } from '../lib/download';
import { chapterHeading, chapterLabel, formatDay, plural, slugify, stageDescription, stageText } from '../lib/format';
import { confirmDialog, toast } from '../lib/ui';
import { useDocumentTitle } from '../lib/useDocumentTitle';
import { NotFoundPage } from './NotFoundPage';
import { LatexTab } from './note/LatexTab';
import { OriginalTab } from './note/OriginalTab';
import { PdfTab } from './note/PdfTab';
import { RetryDialog } from './note/RetryDialog';
import { hasVisualizations, vizForSection } from '../viz/registry';

type Tab = 'pdf' | 'original' | 'latex';
const TABS: { id: Tab; label: string; icon: typeof FileText }[] = [
  { id: 'pdf', label: 'PDF', icon: FileText },
  { id: 'original', label: 'Original', icon: Images },
  { id: 'latex', label: 'LaTeX', icon: FileCode2 },
];
const OFFLINE_HINT = 'Krever nett';

export function NotePage() {
  const { noteId } = useParams();
  const note = useNote(noteId);
  const subject = useSubject(note?.subjectId);
  const chapters = useChapters(note?.subjectId);
  const [params, setParams] = useSearchParams();
  const [retryOpen, setRetryOpen] = useState(false);
  const [editRequest, setEditRequest] = useState(0);
  const visited = useRef(new Set<Tab>());
  useDocumentTitle(note?.title || (note === null ? 'Fant ikke notatet' : null));

  if (note === undefined) return <PageSkeleton />;
  if (note === null) return <NotFoundPage what="notatet" />;

  const requested = params.get('vis') as Tab | null;
  const tab: Tab =
    requested && TABS.some((t) => t.id === requested) ? requested : note.pdfRev > 0 ? 'pdf' : 'original';
  visited.current.add(tab);
  const setTab = (t: Tab) =>
    setParams(
      (p) => {
        const next = new URLSearchParams(p);
        next.set('vis', t);
        return next;
      },
      { replace: true },
    );

  const chapter = chapters?.find((c) => c.id === note.chapterId) ?? null;

  return (
    <div className="page page-note">
      <nav className="breadcrumb" aria-label="Brødsmuler">
        {subject && (
          <Link to={`/fag/${subject.id}/kapittel/${note.chapterId ?? 'uten'}`}>
            <ChevronLeft size={16} aria-hidden />
            {subject.name} · {chapter ? chapterHeading(chapter) : 'Uten kapittel'}
          </Link>
        )}
      </nav>

      <NoteHeader note={note} subject={subject ?? null} chapters={chapters ?? []} onRetry={() => setRetryOpen(true)} />

      {(note.status === 'queued' || note.status === 'processing') && <ProgressCard note={note} />}
      {note.status === 'failed' && (
        <FailedCard
          note={note}
          onRetryWithInstructions={() => setRetryOpen(true)}
          onEditLatex={() => {
            setTab('latex');
            setEditRequest((n) => n + 1);
          }}
        />
      )}
      {note.remarks.length > 0 && (
        <details className="remarks" open>
          <summary>
            <MessageSquareWarning size={17} aria-hidden />
            Merknader fra Claude ({note.remarks.length})
          </summary>
          <ul>
            {note.remarks.map((r, i) => (
              <li key={i}>{r}</li>
            ))}
          </ul>
        </details>
      )}

      <div className="tabs" role="tablist" aria-label="Visning" onKeyDown={(e) => tabKeys(e, tab, setTab)}>
        {TABS.map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              type="button"
              role="tab"
              id={`tab-${t.id}`}
              aria-selected={tab === t.id}
              aria-controls={`panel-${t.id}`}
              tabIndex={tab === t.id ? 0 : -1}
              className="tab"
              onClick={() => setTab(t.id)}
            >
              <Icon size={16} aria-hidden />
              {t.label}
            </button>
          );
        })}
      </div>

      {TABS.map((t) =>
        visited.current.has(t.id) ? (
          <div
            key={t.id}
            role="tabpanel"
            id={`panel-${t.id}`}
            aria-labelledby={`tab-${t.id}`}
            hidden={tab !== t.id}
            className="tab-panel"
          >
            {t.id === 'pdf' && <PdfTab note={note} onDownload={() => void downloadPdf(note)} />}
            {t.id === 'original' && <OriginalTab note={note} />}
            {t.id === 'latex' && <LatexTab note={note} editRequest={editRequest} />}
          </div>
        ) : null,
      )}

      <RetryDialog note={note} open={retryOpen} onClose={() => setRetryOpen(false)} />
    </div>
  );
}

function tabKeys(e: KeyboardEvent, current: Tab, setTab: (t: Tab) => void) {
  const i = TABS.findIndex((t) => t.id === current);
  let next = -1;
  if (e.key === 'ArrowRight') next = (i + 1) % TABS.length;
  else if (e.key === 'ArrowLeft') next = (i - 1 + TABS.length) % TABS.length;
  else if (e.key === 'Home') next = 0;
  else if (e.key === 'End') next = TABS.length - 1;
  if (next < 0) return;
  e.preventDefault();
  const t = TABS[next]!;
  setTab(t.id);
  document.getElementById(`tab-${t.id}`)?.focus();
}

async function downloadPdf(note: Note) {
  const cached = await db.pdfs.get(note.id);
  const filename = `${slugify(note.title)}.pdf`;
  if (cached && cached.rev >= note.pdfRev) {
    saveBlob(cached.blob, filename);
  } else if (navigator.onLine && note.pdfRev > 0) {
    downloadUrl(urls.notePdfDownload(note.id, note.pdfRev), filename);
  } else if (cached) {
    saveBlob(cached.blob, filename);
  } else {
    toast('PDF-en er ikke lagret på denne enheten ennå.', { kind: 'error' });
  }
}

function NoteHeader({
  note,
  subject,
  chapters,
  onRetry,
}: {
  note: Note;
  subject: Subject | null;
  chapters: Chapter[];
  onRetry: () => void;
}) {
  const navigate = useNavigate();
  const { online } = useOnline();
  const busyOnServer = note.status === 'queued' || note.status === 'processing';
  const refreshing = note.status === 'done' && note.stage != null;

  const chapter = chapters.find((c) => c.id === note.chapterId) ?? null;
  const sections = sectionsOf(chapter);
  const sectionCode = noteSectionCode(note);
  const aimCodes = noteAimCodes(note, chapter);
  const aims = useMemo(() => aimMap(subject), [subject]);
  const vizEntries = hasVisualizations(subject) && chapter ? vizForSection(sectionCode).filter((e) => e.chapter === chapter.number) : [];

  const patch = async (req: Parameters<typeof updateNote>[1], success?: string) => {
    try {
      await updateNote(note.id, req);
      if (success) toast(success, { kind: 'success' });
    } catch (err) {
      toast(errorMessage(err, 'Kunne ikke lagre endringen.'), { kind: 'error' });
    }
  };

  const remove = async () => {
    const ok = await confirmDialog({
      title: 'Slette notatet?',
      body: `«${note.title || 'Uten tittel'}» med PDF og originalsider slettes fra alle enhetene dine. Dette kan ikke angres.`,
      confirmLabel: 'Slett notatet',
      danger: true,
    });
    if (!ok) return;
    try {
      const back = `/fag/${note.subjectId}/kapittel/${note.chapterId ?? 'uten'}`;
      await deleteNote(note.id);
      navigate(back, { replace: true });
      toast('Notatet er slettet.', { kind: 'success' });
    } catch (err) {
      toast(errorMessage(err, 'Kunne ikke slette notatet.'), { kind: 'error' });
    }
  };

  return (
    <header className="note-header">
      <div className="note-title-row">
        <TitleEditor note={note} online={online} onSave={(title) => patch({ title })} />
        <Menu
          label="Flere valg"
          items={[
            {
              label: 'Last ned PDF',
              icon: <Download size={17} />,
              onSelect: () => void downloadPdf(note),
              disabled: note.pdfRev === 0,
              hint: 'PDF-en er ikke klar ennå',
            },
            {
              label: 'Last ned .tex',
              icon: <FileCode2 size={17} />,
              onSelect: () => downloadUrl(urls.noteTex(note.id), `${slugify(note.title)}.tex`),
              disabled: !online,
              hint: OFFLINE_HINT,
            },
            {
              label: 'Konverter på nytt …',
              icon: <RotateCcw size={17} />,
              onSelect: onRetry,
              disabled: !online || busyOnServer,
              hint: !online ? OFFLINE_HINT : 'Konverteres allerede',
            },
            {
              label: 'Slett notat …',
              icon: <Trash2 size={17} />,
              onSelect: () => void remove(),
              disabled: !online,
              hint: OFFLINE_HINT,
              danger: true,
            },
          ]}
        />
      </div>

      <div className="note-meta">
        <label className="meta-field">
          <span className="meta-label">Dato</span>
          {online ? (
            <input
              type="date"
              className="inline-input"
              value={note.noteDate ?? ''}
              onChange={(e) => void patch({ noteDate: e.target.value || null })}
            />
          ) : (
            <span className="meta-value" title={OFFLINE_HINT}>
              {note.noteDate ? formatDay(note.noteDate) : 'Ingen dato'}
            </span>
          )}
        </label>
        <label className="meta-field">
          <span className="meta-label">
            Kapittel
            {note.chapterAuto && note.chapterId && (
              <span className="meta-hint" title="Claude valgte kapittelet ut fra innholdet">
                <Sparkles size={12} aria-hidden /> valgt av Claude
              </span>
            )}
          </span>
          <select
            className="inline-input"
            value={note.chapterId ?? ''}
            disabled={!online}
            title={online ? 'Flytt notatet til et annet kapittel' : OFFLINE_HINT}
            onChange={(e) => {
              const id = e.target.value || null;
              const target = chapters.find((c) => c.id === id);
              void patch(
                { chapterId: id },
                target ? `Flyttet til ${chapterHeading(target)}.` : 'Flyttet til «Uten kapittel».',
              );
            }}
          >
            {chapters.map((c) => (
              <option key={c.id} value={c.id}>
                {chapterLabel(c)}
              </option>
            ))}
            <option value="">Uten kapittel</option>
          </select>
        </label>
        <label className="meta-field">
          <span className="meta-label">Delkapittel</span>
          <select
            className="inline-input inline-input-section"
            value={sectionCode ?? ''}
            disabled={!online || !chapter || (sections.length === 0 && !sectionCode)}
            title={
              !online
                ? OFFLINE_HINT
                : !chapter
                  ? 'Velg kapittel først'
                  : sections.length === 0
                    ? 'Kapittelet har ingen delkapitler'
                    : 'Velg delkapittel'
            }
            onChange={(e) => {
              const code = e.target.value || null;
              const target = sections.find((x) => x.code === code);
              void patch({ section: code }, target ? `Flyttet til ${sectionLabel(target)}.` : 'Delkapittelet er fjernet.');
            }}
          >
            <option value="">Ingen</option>
            {sections.map((x) => (
              <option key={x.code} value={x.code}>
                {sectionLabel(x)}
              </option>
            ))}
            {sectionCode && !sections.some((x) => x.code === sectionCode) && (
              <option value={sectionCode}>{sectionCode}</option>
            )}
          </select>
        </label>
        {aimCodes.length > 0 && (
          <div className="meta-field meta-status-field">
            <span className="meta-label">Kompetansemål</span>
            <span className="meta-status">
              <AimChips codes={aimCodes} aims={aims} />
            </span>
          </div>
        )}
        {subject && vizEntries.length > 0 && (
          <div className="meta-field meta-status-field">
            <span className="meta-label">Visualiseringer</span>
            <VizLinks subjectId={subject.id} entries={vizEntries} />
          </div>
        )}
        <div className="meta-field meta-status-field">
          <span className="meta-label">Status</span>
          <span className="meta-status">
            <NoteStatusBadge note={note} showDone={!refreshing} />
            {refreshing && (
              <span className="badge badge-accent" role="status">
                <Spinner size={11} /> Oppdaterer PDF …
              </span>
            )}
            {note.pageCount > 0 && <span className="muted">{plural(note.pageCount, 'side', 'sider')}</span>}
          </span>
        </div>
      </div>
    </header>
  );
}

function TitleEditor({ note, online, onSave }: { note: Note; online: boolean; onSave: (title: string) => Promise<void> }) {
  const [value, setValue] = useState(note.title);
  const [saving, setSaving] = useState(false);
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => setValue(note.title), [note.title]);

  // Tekstfeltet vokser med tittelen, så lange titler brytes over flere linjer i stedet for å kuttes.
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const fit = () => {
      el.style.height = 'auto';
      el.style.height = `${el.scrollHeight}px`;
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, [value, online]);

  if (!online) {
    return (
      <h1 className="page-title note-title" title={`${OFFLINE_HINT} for å endre tittelen`}>
        {note.title || 'Uten tittel'}
      </h1>
    );
  }

  const commit = async () => {
    const t = value.trim();
    if (!t || t === note.title) {
      setValue(note.title);
      return;
    }
    setSaving(true);
    await onSave(t);
    setSaving(false);
  };

  return (
    <h1 className="page-title note-title">
      <textarea
        ref={ref}
        className="title-input"
        rows={1}
        value={value}
        onChange={(e) => setValue(e.target.value.replace(/\s*\n+\s*/g, ' '))}
        onBlur={() => void commit()}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            e.currentTarget.blur();
          }
          if (e.key === 'Escape') {
            setValue(note.title);
            const target = e.currentTarget;
            requestAnimationFrame(() => target.blur());
          }
        }}
        aria-label="Tittel (trykk for å endre)"
        placeholder="Uten tittel"
        maxLength={200}
        disabled={saving}
        enterKeyHint="done"
        spellCheck={false}
      />
      <Pencil size={16} aria-hidden className="title-edit-icon" />
    </h1>
  );
}

const STEPS: { stage: string; label: string }[] = [
  { stage: 'preparing', label: 'Forbereder' },
  { stage: 'reading', label: 'Leser' },
  { stage: 'compiling', label: 'Lager PDF' },
];

function ProgressCard({ note }: { note: Note }) {
  const queued = note.status === 'queued';
  const stage = note.stage === 'fixing' ? 'compiling' : note.stage;
  const current = queued ? -1 : STEPS.findIndex((s) => s.stage === stage);
  return (
    <section className="progress-card" role="status" aria-live="polite">
      <Spinner size={22} />
      <div className="progress-card-body">
        <strong>{queued ? 'I kø' : stageText(note.stage)}</strong>
        <p>
          {queued
            ? 'Notatet venter på tur – konverteringen starter straks. Du kan trygt lukke appen.'
            : `${stageDescription(note.stage)} Du kan trygt lukke appen.`}
        </p>
        <ol className="steps" aria-label="Fremdrift">
          {STEPS.map((s, i) => (
            <li key={s.stage} className={i < current ? 'is-done' : i === current ? 'is-current' : undefined}>
              {s.label}
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

function FailedCard({
  note,
  onRetryWithInstructions,
  onEditLatex,
}: {
  note: Note;
  onRetryWithInstructions: () => void;
  onEditLatex: () => void;
}) {
  const { online } = useOnline();
  const [busy, setBusy] = useState(false);
  const retry = async () => {
    setBusy(true);
    try {
      await retryNote(note.id, null);
      toast('Konverteringen starter på nytt.', { kind: 'success' });
    } catch (err) {
      toast(errorMessage(err, 'Kunne ikke starte konverteringen på nytt.'), { kind: 'error' });
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="error-card" role="alert">
      <AlertTriangle size={22} aria-hidden className="error-card-icon" />
      <div className="error-card-body">
        <strong>Konverteringen feilet</strong>
        <p>{note.error ?? 'Noe gikk galt under konverteringen.'}</p>
        <div className="error-card-actions">
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={() => void retry()}
            disabled={!online || busy}
            title={online ? undefined : OFFLINE_HINT}
          >
            <RotateCcw size={15} aria-hidden /> Prøv igjen
          </button>
          <button
            type="button"
            className="btn btn-sm"
            onClick={onEditLatex}
            disabled={!online}
            title={online ? undefined : OFFLINE_HINT}
          >
            <Pencil size={15} aria-hidden /> Rediger LaTeX
          </button>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={onRetryWithInstructions}
            disabled={!online}
            title={online ? undefined : OFFLINE_HINT}
          >
            Prøv igjen med instruksjoner …
          </button>
        </div>
        {!online && <p className="muted small">Du må være på nett for å prøve igjen.</p>}
      </div>
    </section>
  );
}
