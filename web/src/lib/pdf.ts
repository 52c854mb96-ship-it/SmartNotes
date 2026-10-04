// pdf.js lastes først når en PDF faktisk skal vises (egen chunk).
// Vi bruker «legacy»-bygget: det vanlige bygget krever helt nye nettleser-API-er
// (f.eks. Map.prototype.getOrInsertComputed) som eldre iPad/Safari mangler.
import workerUrl from 'pdfjs-dist/legacy/build/pdf.worker.min.mjs?url';

type PdfJs = typeof import('pdfjs-dist');

let loader: Promise<PdfJs> | null = null;

export function loadPdfJs(): Promise<PdfJs> {
  if (!loader) {
    loader = import('pdfjs-dist/legacy/build/pdf.mjs')
      .then((mod) => {
        const pdfjs = mod as unknown as PdfJs;
        pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
        return pdfjs;
      })
      .catch((err: unknown) => {
        loader = null;
        throw err;
      });
  }
  return loader;
}

export type { PDFDocumentProxy, PDFPageProxy, RenderTask } from 'pdfjs-dist';
