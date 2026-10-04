import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

/**
 * Filstruktur under DATA_DIR:
 *   smartnotes.db
 *   notes/<noteId>/source/<fil>     – originalopplastinger
 *   notes/<noteId>/pages/page-001.jpg – normaliserte sidebilder (det Claude ser)
 *   notes/<noteId>/pages.json
 *   notes/<noteId>/figures/fig1.png – figurer klippet ut fra originalen
 *   notes/<noteId>/note.tex         – dokumentkroppen (siste vellykkede)
 *   notes/<noteId>/draft.tex        – siste mislykkede forsøk (for feilsøking/redigering)
 *   notes/<noteId>/note.pdf
 *   notes/<noteId>/meta.json        – metadata fra Claude
 *   notes/<noteId>/build.log
 *   bundles/<nøkkel>.pdf            – samle-PDF-er for kapitler/fag (cache)
 *   tmp/                            – byggemapper og opplastinger under arbeid
 */
export class Storage {
  constructor(readonly root: string) {
    for (const d of [root, this.notesRoot, this.bundlesRoot, this.tmpRoot]) fs.mkdirSync(d, { recursive: true });
  }

  get dbFile(): string {
    return path.join(this.root, 'smartnotes.db');
  }
  get notesRoot(): string {
    return path.join(this.root, 'notes');
  }
  get bundlesRoot(): string {
    return path.join(this.root, 'bundles');
  }
  get tmpRoot(): string {
    return path.join(this.root, 'tmp');
  }

  noteDir(noteId: string): string {
    assertId(noteId);
    return path.join(this.notesRoot, noteId);
  }
  sourceDir(noteId: string): string {
    return path.join(this.noteDir(noteId), 'source');
  }
  pagesDir(noteId: string): string {
    return path.join(this.noteDir(noteId), 'pages');
  }
  figuresDir(noteId: string): string {
    return path.join(this.noteDir(noteId), 'figures');
  }
  noteFile(noteId: string, name: 'note.tex' | 'draft.tex' | 'note.pdf' | 'meta.json' | 'build.log' | 'pages.json'): string {
    return path.join(this.noteDir(noteId), name);
  }

  async makeTmpDir(prefix: string): Promise<string> {
    const dir = path.join(this.tmpRoot, `${prefix}-${randomUUID()}`);
    await fsp.mkdir(dir, { recursive: true });
    return dir;
  }

  async removeNote(noteId: string): Promise<void> {
    await fsp.rm(this.noteDir(noteId), { recursive: true, force: true });
  }

  /** Rydder bort gamle midlertidige mapper (f.eks. etter krasj). */
  async cleanTmp(maxAgeMs = 6 * 3600_000): Promise<void> {
    const entries = await fsp.readdir(this.tmpRoot, { withFileTypes: true }).catch(() => []);
    const cutoff = Date.now() - maxAgeMs;
    for (const e of entries) {
      const p = path.join(this.tmpRoot, e.name);
      const st = await fsp.stat(p).catch(() => null);
      if (st && st.mtimeMs < cutoff) await fsp.rm(p, { recursive: true, force: true });
    }
  }
}

const ID_RE = /^[0-9a-f-]{36}$/i;

/** Beskytter mot path traversal: id-er er alltid UUID-er. */
export function assertId(id: string): void {
  if (!ID_RE.test(id)) throw new Error(`Ugyldig id: ${id}`);
}

export function isId(id: string): boolean {
  return ID_RE.test(id);
}

export async function exists(p: string): Promise<boolean> {
  try {
    await fsp.access(p);
    return true;
  } catch {
    return false;
  }
}
