import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { useNavigate } from 'react-router';
import { useLiveQuery } from 'dexie-react-hooks';
import { BookOpen, FileText, Hash, Search, Shapes, X } from 'lucide-react';
import type { Subject, SubjectProfile } from '@smartnotes/shared';
import { db } from '../db';
import { noteSearchText, sectionAnchor } from '../lib/curriculum';
import { chapterHeading, formatDayShort, noteDay } from '../lib/format';
import {
  buildIndex,
  highlightSegments,
  parseTerms,
  search,
  snippetSegments,
  type NoteHit,
  type PlaceHit,
  type Segment,
} from '../lib/search';
import { searchStore } from '../lib/ui';
import { matchesViz, vizEntries } from '../viz/registry';
import type { VizEntry } from '../viz/types';

const DEBOUNCE_MS = 80;

/** Søkepaletten (Ctrl/Cmd+K eller «/»). Monteres bare mens den er åpen. */
export function SearchPalette() {
  const open = searchStore.use();
  return open ? <PaletteDialog onClose={() => searchStore.set(false)} /> : null;
}

type Item =
  | { kind: 'note'; id: string; href: string; hit: NoteHit }
  | { kind: 'place'; id: string; href: string; hit: PlaceHit }
  | { kind: 'viz'; id: string; href: string; viz: VizEntry; subjectName: string | null };

const MAX_VIZ = 4;

/** Faget visualiseringene for en fagtype lenkes under: det første faget av hver type som har visualiseringer. */
interface VizSource {
  subjectId: string;
  subjectName: string;
  profile: SubjectProfile;
}

function vizSources(subjects: Subject[]): VizSource[] {
  const seen = new Set<SubjectProfile>();
  const out: VizSource[] = [];
  for (const sub of [...subjects].sort((a, b) => a.position - b.position)) {
    if (seen.has(sub.profile) || vizEntries(sub.profile).length === 0) continue;
    seen.add(sub.profile);
    out.push({ subjectId: sub.id, subjectName: sub.name, profile: sub.profile });
  }
  return out;
}

/** Visualiseringene som passer med søket (alle ordene må finnes), i fagrekkefølge. */
function vizItems(query: string, sources: VizSource[]): Item[] {
  if (!query.trim()) return [];
  return sources
    .flatMap((src) =>
      vizEntries(src.profile)
        .filter((e) => matchesViz(e, query))
        .map((viz): Item => ({
          kind: 'viz',
          id: `sr-viz-${src.profile}-${viz.key}`,
          href: `/fag/${src.subjectId}/visualiseringer/${viz.key}`,
          viz,
          subjectName: sources.length > 1 ? src.subjectName : null,
        })),
    )
    .slice(0, MAX_VIZ);
}

function Marked({ segments }: { segments: Segment[] }) {
  return (
    <>
      {segments.map((s, i) => (s.mark ? <mark key={i}>{s.text}</mark> : <span key={i}>{s.text}</span>))}
    </>
  );
}

function PaletteDialog({ onClose }: { onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const returnFocus = useRef<Element | null>(document.activeElement);
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [debounced, setDebounced] = useState('');
  const [active, setActive] = useState(0);

  const data = useLiveQuery(async () => {
    const [subjects, chapters, notes] = await Promise.all([
      db.subjects.toArray(),
      db.chapters.toArray(),
      db.notes.toArray(),
    ]);
    return { index: buildIndex(subjects, chapters, notes), vizSources: vizSources(subjects) };
  }, []);
  const index = data?.index;
  const sources = useMemo(() => data?.vizSources ?? [], [data]);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(query), DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [query]);

  const terms = useMemo(() => parseTerms(debounced), [debounced]);
  const result = useMemo(() => (index ? search(index, terms) : null), [index, terms]);

  const items: Item[] = useMemo(() => {
    if (!result) return [];
    const notes: Item[] = result.notes.map((hit) => ({
      kind: 'note',
      id: `sr-note-${hit.note.id}`,
      href: `/notat/${hit.note.id}`,
      hit,
    }));
    const places: Item[] = result.places.map((hit) => ({
      kind: 'place',
      id: `sr-${hit.kind}-${hit.chapter.id}-${hit.section?.code ?? ''}`,
      href: `/fag/${hit.chapter.subjectId}/kapittel/${hit.chapter.id}${hit.section ? `#${sectionAnchor(hit.section.code)}` : ''}`,
      hit,
    }));
    return [...notes, ...places, ...vizItems(debounced, sources)];
  }, [result, debounced, sources]);

  useEffect(() => setActive(0), [items]);

  // Åpne som modal dialog; Esc (cancel) lukker. Fokus tilbake dit det var ved lukking.
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (!dialog.open) dialog.showModal();
    inputRef.current?.focus();
    const onCancel = (e: Event) => {
      e.preventDefault();
      onCloseRef.current();
    };
    dialog.addEventListener('cancel', onCancel);
    return () => {
      dialog.removeEventListener('cancel', onCancel);
      if (dialog.open) dialog.close();
      const restore = returnFocus.current;
      if (restore instanceof HTMLElement && restore.isConnected) restore.focus();
    };
  }, []);

  useEffect(() => {
    const id = items[active]?.id;
    if (id) document.getElementById(id)?.scrollIntoView({ block: 'nearest' });
  }, [active, items]);

  const go = (item: Item | undefined) => {
    if (!item) return;
    returnFocus.current = null;
    onClose();
    navigate(item.href);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (items.length) setActive((a) => (a + 1) % items.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (items.length) setActive((a) => (a - 1 + items.length) % items.length);
    } else if (e.key === 'Home' && e.ctrlKey) {
      setActive(0);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      // Søk med en gang ved Enter, også om debouncen ikke har rukket å kjøre.
      if (query !== debounced && index) {
        const now = search(index, parseTerms(query));
        const first = now.notes[0] ?? null;
        if (first) return go({ kind: 'note', id: '', href: `/notat/${first.note.id}`, hit: first });
        const place = now.places[0];
        if (place) {
          return go({
            kind: 'place',
            id: '',
            href: `/fag/${place.chapter.subjectId}/kapittel/${place.chapter.id}${place.section ? `#${sectionAnchor(place.section.code)}` : ''}`,
            hit: place,
          });
        }
        const viz = vizItems(query, sources)[0];
        if (viz) return go(viz);
        return;
      }
      go(items[active]);
    }
  };

  const noteItems = items.filter((i) => i.kind === 'note');
  const placeItems = items.filter((i) => i.kind === 'place');
  const vizResults = items.filter((i) => i.kind === 'viz');
  const activeId = items[active]?.id;
  const hasQuery = terms.length > 0;

  const option = (item: Item, children: ReactNode) => {
    const i = items.indexOf(item);
    return (
      <li
        key={item.id}
        id={item.id}
        role="option"
        aria-selected={i === active}
        className={`search-option${i === active ? ' is-active' : ''}`}
        onMouseMove={() => i !== active && setActive(i)}
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => go(item)}
      >
        {children}
      </li>
    );
  };

  return (
    <dialog ref={ref} className="search-palette" aria-label="Søk">
      <div className="search-head">
        <Search size={19} aria-hidden className="search-head-icon" />
        <input
          ref={inputRef}
          type="search"
          className="search-input"
          placeholder="Søk i notater, kapitler og delkapitler"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={onKeyDown}
          role="combobox"
          aria-label="Søk"
          aria-expanded={items.length > 0}
          aria-controls="search-results"
          aria-activedescendant={activeId}
          aria-autocomplete="list"
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
          enterKeyHint="go"
        />
        <button type="button" className="icon-btn" onClick={onClose} aria-label="Lukk søket">
          <X size={19} aria-hidden />
        </button>
      </div>

      <div className="search-body">
        <ul id="search-results" role="listbox" aria-label="Søkeresultater" className="search-results">
          {noteItems.length > 0 && (
            <li role="presentation">
              <div id="sr-group-notes" className="search-group-label" role="presentation">
                Notater
              </div>
              <ul role="group" aria-labelledby="sr-group-notes" className="search-group">
                {noteItems.map((item) => {
                  if (item.kind !== 'note') return null;
                  const { note, chapter, section } = item.hit;
                  const snippet = snippetSegments(noteSearchText(note), terms);
                  return option(
                    item,
                    <>
                      <FileText size={17} aria-hidden className="search-option-icon" />
                      <span className="search-option-body">
                        <span className="search-option-title">
                          <Marked segments={highlightSegments(note.title || 'Uten tittel', terms)} />
                        </span>
                        <span className="search-option-meta">
                          {section && <span className="section-code">{section.code}</span>}
                          <span>{chapter ? chapterHeading(chapter) : 'Uten kapittel'}</span>
                          <span>{formatDayShort(noteDay(note))}</span>
                        </span>
                        {snippet && (
                          <span className="search-option-snippet">
                            <Marked segments={snippet} />
                          </span>
                        )}
                      </span>
                    </>,
                  );
                })}
              </ul>
            </li>
          )}
          {placeItems.length > 0 && (
            <li role="presentation">
              <div id="sr-group-places" className="search-group-label" role="presentation">
                Kapitler og delkapitler
              </div>
              <ul role="group" aria-labelledby="sr-group-places" className="search-group">
                {placeItems.map((item) => {
                  if (item.kind !== 'place') return null;
                  const { hit } = item;
                  const Icon = hit.kind === 'section' ? Hash : BookOpen;
                  return option(
                    item,
                    <>
                      <Icon size={17} aria-hidden className="search-option-icon" />
                      <span className="search-option-body">
                        <span className="search-option-title">
                          <Marked segments={highlightSegments(hit.label, terms)} />
                        </span>
                        {hit.sub && <span className="search-option-meta">{hit.sub}</span>}
                      </span>
                    </>,
                  );
                })}
              </ul>
            </li>
          )}
          {vizResults.length > 0 && (
            <li role="presentation">
              <div id="sr-group-viz" className="search-group-label" role="presentation">
                Visualiseringer
              </div>
              <ul role="group" aria-labelledby="sr-group-viz" className="search-group">
                {vizResults.map((item) => {
                  if (item.kind !== 'viz') return null;
                  const { viz } = item;
                  return option(
                    item,
                    <>
                      <Shapes size={17} aria-hidden className="search-option-icon" />
                      <span className="search-option-body">
                        <span className="search-option-title">
                          <Marked segments={highlightSegments(viz.title, terms)} />
                        </span>
                        <span className="search-option-meta">
                          {viz.sections.map((code) => (
                            <span key={code} className="section-code">
                              {code}
                            </span>
                          ))}
                          <span>
                            {item.subjectName ? `${item.subjectName} · ` : ''}Kapittel {viz.chapter}
                          </span>
                        </span>
                        <span className="search-option-snippet">{viz.summary}</span>
                      </span>
                    </>,
                  );
                })}
              </ul>
            </li>
          )}
        </ul>

        {!hasQuery && (
          <p className="search-empty">
            Søk etter ord fra notatene, en tittel, et kapittel, en visualisering eller en kode som «2E». Søket virker også uten nett.
          </p>
        )}
        {hasQuery && result && items.length === 0 && (
          <p className="search-empty" role="status">
            Ingen treff for «{debounced.trim()}».
          </p>
        )}
        {result && result.totalNotes > noteItems.length && (
          <p className="search-more">
            Viser {noteItems.length} av {result.totalNotes} notater. Skriv flere ord for å snevre inn.
          </p>
        )}
      </div>

      <div className="search-foot" aria-hidden>
        <span>
          <kbd>↑</kbd>
          <kbd>↓</kbd> flytt
        </span>
        <span>
          <kbd>Enter</kbd> åpne
        </span>
        <span>
          <kbd>Esc</kbd> lukk
        </span>
      </div>
    </dialog>
  );
}
