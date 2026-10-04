import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Maximize2, Minus, Plus } from 'lucide-react';
import { loadPdfJs, type PDFDocumentProxy, type RenderTask } from '../lib/pdf';
import { plural } from '../lib/format';

const ZOOM_STEPS = [0.5, 0.67, 0.8, 1, 1.25, 1.5, 2, 2.5, 3];
/** Største bredde (CSS-px) en side får ved «tilpass bredde» – store skjermer blir ellers slitsomme. */
const MAX_FIT_WIDTH = 980;
/** Maks antall piksler per lerret (iOS Safari tåler ca. 16,7 M). */
const MAX_CANVAS_PIXELS = 16_000_000;

interface PageSize {
  width: number;
  height: number;
}

interface PdfViewerProps {
  blob: Blob;
  /** Dokumentet lastes bare på nytt når nøkkelen endres (Blob-objekter fra Dexie er nye hver gang). */
  docKey: string;
  toolbarExtra?: ReactNode;
  label?: string;
}

export function PdfViewer({ blob, docKey, toolbarExtra, label = 'PDF' }: PdfViewerProps) {
  const [doc, setDoc] = useState<PDFDocumentProxy | null>(null);
  const [firstSize, setFirstSize] = useState<PageSize | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [width, setWidth] = useState(0);
  const [padding, setPadding] = useState(16);
  const rootRef = useRef<HTMLDivElement>(null);
  const blobRef = useRef(blob);
  blobRef.current = blob;

  // Last dokumentet.
  useEffect(() => {
    let cancelled = false;
    let destroy: (() => Promise<void>) | null = null;
    setDoc(null);
    setFirstSize(null);
    setError(null);
    (async () => {
      try {
        const pdfjs = await loadPdfJs();
        const data = new Uint8Array(await blobRef.current.arrayBuffer());
        if (cancelled) return;
        const task = pdfjs.getDocument({ data });
        destroy = () => task.destroy();
        const d = await task.promise;
        const first = await d.getPage(1);
        const vp = first.getViewport({ scale: 1 });
        if (cancelled) return;
        setFirstSize({ width: vp.width, height: vp.height });
        setDoc(d);
      } catch (err) {
        if (cancelled) return;
        console.warn('PDF-feil', err);
        setError(
          err instanceof TypeError || (err instanceof Error && /import|module|fetch/i.test(err.message))
            ? 'Kunne ikke laste PDF-visningen. Last inn siden på nytt.'
            : 'Kunne ikke vise PDF-en. Fila kan være skadet.',
        );
      }
    })();
    return () => {
      cancelled = true;
      void destroy?.();
    };
  }, [docKey]);

  // Mål tilgjengelig bredde.
  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      if (!entry) return;
      const pad = parseFloat(getComputedStyle(el).getPropertyValue('--pdf-pad')) || 16;
      setPadding(pad);
      setWidth(Math.floor(entry.contentRect.width));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const fitWidth = Math.max(200, Math.min(width - padding * 2, MAX_FIT_WIDTH));
  const baseScale = firstSize ? fitWidth / firstSize.width : 1;
  const scale = baseScale * zoom;

  const zoomIndex = ZOOM_STEPS.indexOf(zoom);
  const step = (dir: 1 | -1) => {
    const i = zoomIndex === -1 ? ZOOM_STEPS.indexOf(1) : zoomIndex;
    const next = ZOOM_STEPS[Math.min(ZOOM_STEPS.length - 1, Math.max(0, i + dir))];
    if (next) setZoom(next);
  };

  return (
    <div className="pdf-viewer" ref={rootRef} aria-label={label} role="region">
      <div className="pdf-toolbar" role="toolbar" aria-label="PDF-verktøy">
        <span className="pdf-pages-count">{doc ? plural(doc.numPages, 'side', 'sider') : ' '}</span>
        <div className="pdf-zoom">
          <button
            type="button"
            className="icon-btn"
            onClick={() => step(-1)}
            disabled={!doc || zoom <= ZOOM_STEPS[0]!}
            aria-label="Zoom ut"
            title="Zoom ut"
          >
            <Minus size={18} aria-hidden />
          </button>
          <span className="pdf-zoom-value" aria-live="polite">
            {Math.round(zoom * 100)} %
          </span>
          <button
            type="button"
            className="icon-btn"
            onClick={() => step(1)}
            disabled={!doc || zoom >= ZOOM_STEPS[ZOOM_STEPS.length - 1]!}
            aria-label="Zoom inn"
            title="Zoom inn"
          >
            <Plus size={18} aria-hidden />
          </button>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => setZoom(1)}
            disabled={!doc || zoom === 1}
            title="Tilpass bredde"
          >
            <Maximize2 size={16} aria-hidden />
            <span className="hide-xs">Tilpass bredde</span>
          </button>
        </div>
        <div className="pdf-toolbar-extra">{toolbarExtra}</div>
      </div>

      {error ? (
        <div className="pdf-error" role="alert">
          <p>{error}</p>
          <button type="button" className="btn" onClick={() => window.location.reload()}>
            Last inn på nytt
          </button>
        </div>
      ) : !doc || !firstSize || width === 0 ? (
        <div className="pdf-pages" aria-busy="true">
          <div className="pdf-page-skeleton skeleton" style={{ width: fitWidth, aspectRatio: '210 / 297' }} />
        </div>
      ) : (
        <div className="pdf-scroller">
          <div className="pdf-pages">
            {Array.from({ length: doc.numPages }, (_, i) => (
              <PdfPage key={`${docKey}:${i}`} doc={doc} index={i} scale={scale} initialSize={firstSize} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function PdfPage({
  doc,
  index,
  scale,
  initialSize,
}: {
  doc: PDFDocumentProxy;
  index: number;
  scale: number;
  initialSize: PageSize;
}) {
  const holderRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const renderedScale = useRef(0);
  const [size, setSize] = useState<PageSize>(initialSize);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = holderRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) setVisible(e.isIntersecting);
      },
      { rootMargin: '1500px 0px' },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    const holder = holderRef.current;
    if (!holder) return;
    if (!visible) {
      // Frigjør minne for sider langt unna (viktig på iPad).
      const c = canvasRef.current;
      if (c) {
        c.width = 0;
        c.height = 0;
        c.remove();
        canvasRef.current = null;
        renderedScale.current = 0;
      }
      return;
    }
    if (renderedScale.current === scale) return;

    let cancelled = false;
    let task: RenderTask | null = null;
    // Ved zoom/resize: vent litt så vi ikke rendrer for hvert steg.
    const delay = canvasRef.current ? 140 : 0;
    const timer = setTimeout(async () => {
      try {
        const page = await doc.getPage(index + 1);
        if (cancelled) return;
        const base = page.getViewport({ scale: 1 });
        if (base.width !== size.width || base.height !== size.height) {
          setSize({ width: base.width, height: base.height });
        }
        const dpr = Math.min(window.devicePixelRatio || 1, 3);
        let outputScale = scale * dpr;
        const pixels = base.width * outputScale * base.height * outputScale;
        if (pixels > MAX_CANVAS_PIXELS) outputScale = Math.sqrt(MAX_CANVAS_PIXELS / (base.width * base.height));
        const viewport = page.getViewport({ scale: outputScale });
        const canvas = document.createElement('canvas');
        canvas.width = Math.floor(viewport.width);
        canvas.height = Math.floor(viewport.height);
        canvas.className = 'pdf-canvas';
        task = page.render({ canvas, viewport });
        await task.promise;
        if (cancelled) {
          canvas.width = 0;
          canvas.height = 0;
          return;
        }
        // Bytt lerret først når det nye er ferdig – ingen blanke blink ved zoom.
        const old = canvasRef.current;
        holder.appendChild(canvas);
        if (old) {
          old.remove();
          old.width = 0;
          old.height = 0;
        }
        canvasRef.current = canvas;
        renderedScale.current = scale;
      } catch (err) {
        if (!cancelled && !(err instanceof Error && err.name === 'RenderingCancelledException')) {
          console.warn('Kunne ikke tegne side', index + 1, err);
        }
      }
    }, delay);
    return () => {
      cancelled = true;
      clearTimeout(timer);
      task?.cancel();
    };
    // `size` er bevisst utelatt – den oppdateres fra selve rendringen.
  }, [visible, scale, doc, index]);

  useEffect(
    () => () => {
      const c = canvasRef.current;
      if (c) {
        c.width = 0;
        c.height = 0;
      }
    },
    [],
  );

  return (
    <div
      ref={holderRef}
      className="pdf-page"
      style={{ width: Math.floor(size.width * scale), height: Math.floor(size.height * scale) }}
      aria-label={`Side ${index + 1}`}
      role="img"
    />
  );
}
