import type { Note } from '@smartnotes/shared';
import { urls } from '../../api';
import { asBlob, db } from '../../db';
import { downloadUrl, saveBlob } from '../../lib/download';
import { slugify } from '../../lib/format';
import { toast } from '../../lib/ui';

/** Laster ned notatets PDF: fra enheten når den lagrede er fersk, ellers fra serveren (eller en eldre lagret uten nett). */
export async function downloadNotePdf(note: Note): Promise<void> {
  const cached = await db.pdfs.get(note.id);
  const filename = `${slugify(note.title)}.pdf`;
  if (cached && cached.rev >= note.pdfRev) {
    saveBlob(asBlob(cached.blob, 'application/pdf'), filename);
  } else if (navigator.onLine && note.pdfRev > 0) {
    downloadUrl(urls.notePdfDownload(note.id, note.pdfRev), filename);
  } else if (cached) {
    saveBlob(asBlob(cached.blob, 'application/pdf'), filename);
  } else {
    toast('PDF-en er ikke lagret på denne enheten ennå.', { kind: 'error' });
  }
}
