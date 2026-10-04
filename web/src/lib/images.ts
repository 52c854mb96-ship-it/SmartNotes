import type { OutboxFile } from '../db';

export const MAX_EDGE = 2576;
export const MAX_FILES = 40;
export const MAX_FILE_BYTES = 30 * 1024 * 1024;

export function isPdf(file: { type: string; name: string }): boolean {
  return file.type === 'application/pdf' || /\.pdf$/i.test(file.name);
}

export function isImage(file: { type: string; name: string }): boolean {
  return file.type.startsWith('image/') || /\.(jpe?g|png|webp|heic|heif|gif|bmp|tiff?)$/i.test(file.name);
}

export function isAcceptedFile(file: { type: string; name: string }): boolean {
  return isPdf(file) || isImage(file);
}

/**
 * Kopierer fila til en frittstående Blob. Filer fra kamera/filvelger kan peke på
 * midlertidige filer som forsvinner – i IndexedDB vil vi ha våre egne bytes.
 */
async function detach(file: File): Promise<OutboxFile> {
  const type = file.type || (isPdf(file) ? 'application/pdf' : 'application/octet-stream');
  const blob = new Blob([await file.arrayBuffer()], { type });
  return { name: file.name || 'fil', type, blob };
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('toBlob feilet'))), type, quality);
  });
}

/**
 * Forbereder en fil for køen: bilder med lengste side over 2576 px skaleres ned og
 * lagres som JPEG (kvalitet 0,9). PDF-er og bilder som ikke kan dekodes (f.eks. HEIC
 * utenfor Safari) beholdes som de er.
 */
export async function prepareFile(file: File): Promise<OutboxFile> {
  if (isPdf(file) || !isImage(file) || typeof createImageBitmap !== 'function') return detach(file);

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    return detach(file);
  }
  try {
    const longEdge = Math.max(bitmap.width, bitmap.height);
    if (longEdge <= MAX_EDGE) return await detach(file);

    const scale = MAX_EDGE / longEdge;
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));

    let blob: Blob;
    if (typeof OffscreenCanvas !== 'undefined') {
      const canvas = new OffscreenCanvas(width, height);
      const ctx = canvas.getContext('2d');
      if (!ctx) return await detach(file);
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(bitmap, 0, 0, width, height);
      blob = await canvas.convertToBlob({ type: 'image/jpeg', quality: 0.9 });
    } else {
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) return await detach(file);
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(bitmap, 0, 0, width, height);
      blob = await canvasToBlob(canvas, 'image/jpeg', 0.9);
    }
    const base = (file.name || 'side').replace(/\.[^.]+$/, '');
    return { name: `${base}.jpg`, type: 'image/jpeg', blob };
  } catch {
    return detach(file);
  } finally {
    bitmap.close();
  }
}
