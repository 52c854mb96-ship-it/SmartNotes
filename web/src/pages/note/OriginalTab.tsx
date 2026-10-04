import { useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, ImageOff, X, ZoomIn, ZoomOut } from 'lucide-react';
import type { Note, NotePage } from '@smartnotes/shared';
import { api, urls } from '../../api';
import { useOnline } from '../../lib/connectivity';

export function OriginalTab({ note }: { note: Note }) {
  const [pages, setPages] = useState<NotePage[] | null>(null);
  const [open, setOpen] = useState<number | null>(null);

  useEffect(() => {
    const ctrl = new AbortController();
    api
      .getPages(note.id, ctrl.signal)
      .then((res) => setPages(res.pages))
      .catch(() => {
        /* offline: faller tilbake til pageCount */
      });
    return () => ctrl.abort();
  }, [note.id, note.pageCount]);

  const list: NotePage[] =
    pages ?? Array.from({ length: note.pageCount }, (_, index) => ({ index, width: 0, height: 0 }));

  if (list.length === 0) {
    return (
      <div className="panel-message">
        <p>Ingen originalsider å vise.</p>
      </div>
    );
  }

  return (
    <>
      <p className="tab-intro">Sidene slik du lastet dem opp. Trykk på en side for å se den større.</p>
      <ol className="original-grid" role="list">
        {list.map((p, i) => (
          <li key={p.index}>
            <button
              type="button"
              className="original-thumb"
              onClick={() => setOpen(i)}
              aria-label={`Vis side ${i + 1} stort`}
            >
              <PageImage
                noteId={note.id}
                index={p.index}
                alt={`Side ${i + 1}`}
                ratio={p.width && p.height ? p.width / p.height : 0.72}
              />
              <span className="original-num">{i + 1}</span>
            </button>
          </li>
        ))}
      </ol>
      {open !== null && <Lightbox noteId={note.id} pages={list} index={open} onIndex={setOpen} onClose={() => setOpen(null)} />}
    </>
  );
}

function PageImage({ noteId, index, alt, ratio }: { noteId: string; index: number; alt: string; ratio: number }) {
  const [failed, setFailed] = useState(false);
  const { online } = useOnline();
  // Prøv igjen når vi kommer på nett.
  useEffect(() => {
    if (online) setFailed(false);
  }, [online]);
  if (failed) {
    return (
      <span className="original-missing" style={{ aspectRatio: ratio }}>
        <ImageOff size={22} aria-hidden />
        <span>{online ? 'Kunne ikke vise siden' : 'Ikke lagret for offline'}</span>
      </span>
    );
  }
  return (
    <img
      src={urls.notePage(noteId, index)}
      alt={alt}
      loading="lazy"
      decoding="async"
      style={{ aspectRatio: ratio }}
      onError={() => setFailed(true)}
    />
  );
}

function Lightbox({
  noteId,
  pages,
  index,
  onIndex,
  onClose,
}: {
  noteId: string;
  pages: NotePage[];
  index: number;
  onIndex: (i: number) => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [zoomed, setZoomed] = useState(false);
  const page = pages[index];

  useEffect(() => {
    const d = ref.current;
    if (d && !d.open) d.showModal();
    const onCancel = (e: Event) => {
      e.preventDefault();
      onClose();
    };
    d?.addEventListener('cancel', onCancel);
    return () => d?.removeEventListener('cancel', onCancel);
  }, [onClose]);

  useEffect(() => setZoomed(false), [index]);

  const go = (delta: number) => {
    const next = index + delta;
    if (next >= 0 && next < pages.length) onIndex(next);
  };

  return (
    <dialog
      ref={ref}
      className="lightbox"
      aria-label={`Side ${index + 1} av ${pages.length}`}
      onKeyDown={(e) => {
        if (e.key === 'ArrowRight') go(1);
        if (e.key === 'ArrowLeft') go(-1);
      }}
    >
      <div className="lightbox-bar">
        <span>
          Side {index + 1} av {pages.length}
        </span>
        <span className="lightbox-actions">
          <button
            type="button"
            className="icon-btn"
            onClick={() => setZoomed((z) => !z)}
            aria-label={zoomed ? 'Tilpass skjermen' : 'Vis i full størrelse'}
            aria-pressed={zoomed}
          >
            {zoomed ? <ZoomOut size={20} aria-hidden /> : <ZoomIn size={20} aria-hidden />}
          </button>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Lukk" data-autofocus>
            <X size={22} aria-hidden />
          </button>
        </span>
      </div>
      <div className={`lightbox-stage${zoomed ? ' is-zoomed' : ''}`} onClick={() => setZoomed((z) => !z)}>
        {page && <img src={urls.notePage(noteId, page.index)} alt={`Side ${index + 1}`} />}
      </div>
      {pages.length > 1 && (
        <>
          <button
            type="button"
            className="lightbox-nav prev"
            onClick={() => go(-1)}
            disabled={index === 0}
            aria-label="Forrige side"
          >
            <ChevronLeft size={26} aria-hidden />
          </button>
          <button
            type="button"
            className="lightbox-nav next"
            onClick={() => go(1)}
            disabled={index === pages.length - 1}
            aria-label="Neste side"
          >
            <ChevronRight size={26} aria-hidden />
          </button>
        </>
      )}
    </dialog>
  );
}
