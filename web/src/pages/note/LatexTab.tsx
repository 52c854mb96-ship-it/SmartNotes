import { useEffect, useRef, useState } from 'react';
import { useBlocker } from 'react-router';
import { Copy, Pencil, Save, X } from 'lucide-react';
import type { Note } from '@smartnotes/shared';
import { saveLatex } from '../../actions';
import { api, errorMessage } from '../../api';
import { Spinner } from '../../components/Status';
import { useOnline } from '../../lib/connectivity';
import { confirmDialog, toast } from '../../lib/ui';

/** Sist hentede LaTeX per notat (så faneskifte ikke henter på nytt). */
const bodyCache = new Map<string, { key: string; body: string }>();

export function LatexTab({ note, editRequest }: { note: Note; editRequest: number }) {
  const { online } = useOnline();
  const cacheKey = `${note.pdfRev}:${note.status}:${note.updatedAt}`;
  const cached = bodyCache.get(note.id);
  const [body, setBody] = useState<string | null>(cached?.body ?? null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [saving, setSaving] = useState(false);
  const [compileError, setCompileError] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const busyOnServer = note.status === 'queued' || note.status === 'processing';
  const dirty = editing && body !== null && draft !== body;

  // Hent koden (på nytt når notatet endrer seg), men ikke midt i redigering.
  useEffect(() => {
    if (!online || editing) return;
    const c = bodyCache.get(note.id);
    if (c && c.key === cacheKey) {
      setBody(c.body);
      return;
    }
    const ctrl = new AbortController();
    setLoadError(null);
    api
      .getLatex(note.id, ctrl.signal)
      .then((res) => {
        bodyCache.set(note.id, { key: cacheKey, body: res.body });
        setBody(res.body);
      })
      .catch((err: unknown) => {
        if (!ctrl.signal.aborted) setLoadError(errorMessage(err, 'Kunne ikke hente LaTeX-koden.'));
      });
    return () => ctrl.abort();
  }, [note.id, cacheKey, online, editing]);

  const startEditing = () => {
    if (body === null) return;
    setDraft(body);
    setCompileError(null);
    setEditing(true);
    requestAnimationFrame(() => textareaRef.current?.focus());
  };

  // «Rediger LaTeX» fra feilkortet.
  const lastRequest = useRef(editRequest);
  useEffect(() => {
    if (editRequest !== lastRequest.current && body !== null && online) {
      lastRequest.current = editRequest;
      startEditing();
    }
  }, [editRequest, body, online]);

  // Advar før vi forlater siden med ulagrede endringer.
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) => dirty && currentLocation.pathname !== nextLocation.pathname,
  );
  useEffect(() => {
    if (blocker.state !== 'blocked') return;
    void confirmDialog({
      title: 'Forkaste endringene?',
      body: 'Du har endringer i LaTeX-koden som ikke er lagret.',
      confirmLabel: 'Forkast',
      cancelLabel: 'Fortsett å redigere',
      danger: true,
    }).then((ok) => (ok ? blocker.proceed() : blocker.reset()));
  }, [blocker]);
  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [dirty]);

  const copy = async () => {
    const text = editing ? draft : body;
    if (text === null) return;
    try {
      await navigator.clipboard.writeText(text);
      toast('LaTeX-koden er kopiert.', { kind: 'success' });
    } catch {
      toast('Kunne ikke kopiere. Marker teksten og kopier manuelt.', { kind: 'error' });
    }
  };

  const save = async () => {
    if (saving) return;
    setSaving(true);
    setCompileError(null);
    try {
      const res = await saveLatex(note.id, draft);
      if (res.ok) {
        bodyCache.set(note.id, { key: '', body: draft });
        setBody(draft);
        setEditing(false);
        toast('PDF-en er kompilert på nytt.', { kind: 'success' });
      } else {
        setCompileError(res.error ?? 'Kompileringen feilet.');
      }
    } catch (err) {
      setCompileError(errorMessage(err, 'Kunne ikke lagre LaTeX-koden.'));
    } finally {
      setSaving(false);
    }
  };

  if (body === null) {
    if (!online) {
      return (
        <div className="panel-message">
          <p>LaTeX-koden er bare tilgjengelig når du er på nett.</p>
        </div>
      );
    }
    if (loadError) {
      return (
        <div className="panel-message" role="alert">
          <p>{loadError}</p>
        </div>
      );
    }
    return <div className="skeleton latex-skeleton" aria-busy="true" aria-label="Henter LaTeX-koden" />;
  }

  return (
    <div className="latex-tab">
      <div className="latex-toolbar">
        <span className="muted latex-hint">
          {editing ? 'Rediger dokumentkroppen. Preamble og mal legges til automatisk.' : 'Dokumentkroppen Claude skrev.'}
        </span>
        <span className="latex-actions">
          <button type="button" className="btn btn-sm" onClick={() => void copy()}>
            <Copy size={15} aria-hidden /> Kopier
          </button>
          {editing ? (
            <>
              <button
                type="button"
                className="btn btn-sm"
                onClick={() => {
                  setEditing(false);
                  setCompileError(null);
                }}
                disabled={saving}
              >
                <X size={15} aria-hidden /> Avbryt
              </button>
              <button
                type="button"
                className="btn btn-sm btn-primary"
                onClick={() => void save()}
                disabled={saving || !online || busyOnServer || !draft.trim()}
                title={!online ? 'Krever nett' : busyOnServer ? 'Vent til konverteringen er ferdig' : undefined}
              >
                {saving ? <Spinner size={13} /> : <Save size={15} aria-hidden />}
                {saving ? 'Kompilerer …' : 'Lagre og kompiler'}
              </button>
            </>
          ) : (
            <button
              type="button"
              className="btn btn-sm"
              onClick={startEditing}
              disabled={!online || busyOnServer}
              title={!online ? 'Krever nett' : busyOnServer ? 'Vent til konverteringen er ferdig' : undefined}
            >
              <Pencil size={15} aria-hidden /> Rediger
            </button>
          )}
        </span>
      </div>

      {compileError && (
        <div className="compile-error" role="alert">
          <p className="compile-error-title">LaTeX-koden kompilerte ikke. Endringene dine er ikke lagret ennå.</p>
          <pre>{compileError}</pre>
        </div>
      )}

      {editing ? (
        <textarea
          ref={textareaRef}
          className="latex-editor"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          spellCheck={false}
          autoCapitalize="off"
          autoCorrect="off"
          aria-label="LaTeX-kode"
          disabled={saving}
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 's') {
              e.preventDefault();
              void save();
            }
          }}
        />
      ) : (
        <pre className="latex-code" tabIndex={0} aria-label="LaTeX-kode">
          {body}
        </pre>
      )}
    </div>
  );
}
