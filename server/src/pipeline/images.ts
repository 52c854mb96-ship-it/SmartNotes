import { execFile } from 'node:child_process';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';
import sharp, { type Sharp } from 'sharp';
import { ConversionError } from '../errors.js';

const execFileAsync = promisify(execFile);

/**
 * Bildestørrelse sendt til Claude. Sonnet 5.5 og Opus 5.5 leser bilder i høy oppløsning opp til 2576 px på langsiden
 * og ca. 3,75 MP totalt; holder vi oss under begge grensene, blir koordinatene Claude oppgir for figurer
 * 1:1 med pikslene i sidebildet vårt.
 */
export const MAX_EDGE = 2576;
export const MAX_PIXELS = 3_600_000;

export type FileKind = 'pdf' | 'jpeg' | 'png' | 'webp' | 'heic' | 'gif' | 'tiff';

export interface PageImage {
  index: number;
  file: string;
  width: number;
  height: number;
}

/** Gjenkjenner filtypen fra de første bytene (stoler ikke på filnavn/MIME fra klienten). */
export function sniffKind(head: Buffer): FileKind | null {
  if (head.length >= 4 && head.subarray(0, 4).toString('latin1') === '%PDF') return 'pdf';
  if (head.length >= 3 && head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff) return 'jpeg';
  if (head.length >= 8 && head.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'png';
  if (head.length >= 12 && head.subarray(0, 4).toString('latin1') === 'RIFF' && head.subarray(8, 12).toString('latin1') === 'WEBP') return 'webp';
  if (head.length >= 6 && head.subarray(0, 3).toString('latin1') === 'GIF') return 'gif';
  if (head.length >= 4 && (head.subarray(0, 4).equals(Buffer.from([0x49, 0x49, 0x2a, 0x00])) || head.subarray(0, 4).equals(Buffer.from([0x4d, 0x4d, 0x00, 0x2a]))))
    return 'tiff';
  if (head.length >= 12 && head.subarray(4, 8).toString('latin1') === 'ftyp') {
    const brand = head.subarray(8, 12).toString('latin1');
    if (['heic', 'heix', 'hevc', 'hevx', 'heim', 'heis', 'mif1', 'msf1', 'avif'].includes(brand)) return 'heic';
  }
  return null;
}

export const MIME_BY_KIND: Record<FileKind, string> = {
  pdf: 'application/pdf',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  heic: 'image/heic',
  gif: 'image/gif',
  tiff: 'image/tiff',
};

/** Skalering som holder bildet innenfor både kant- og pikselgrensen. */
export function fitScale(width: number, height: number): number {
  return Math.min(1, MAX_EDGE / Math.max(width, height), Math.sqrt(MAX_PIXELS / (width * height)));
}

async function decodeToSharp(file: string, kind: FileKind): Promise<Sharp> {
  if (kind === 'heic') {
    try {
      const img = sharp(file, { failOn: 'none' });
      await img.metadata();
      // libvips i sharp mangler ofte HEVC-dekoder; test at vi faktisk kan lese pikslene.
      await img.clone().resize(8).raw().toBuffer();
      return sharp(file, { failOn: 'none' });
    } catch {
      const { default: convert } = await import('heic-convert');
      const out = await convert({ buffer: await fsp.readFile(file), format: 'JPEG', quality: 0.92 });
      return sharp(Buffer.from(out), { failOn: 'none' });
    }
  }
  return sharp(file, { failOn: 'none', animated: false, limitInputPixels: 200_000_000 });
}

/** Lagrer ett sidebilde normalisert: riktig vei opp (EXIF), hvit bakgrunn, JPEG, innenfor størrelsesgrensene. */
async function writePage(img: Sharp, outFile: string): Promise<{ width: number; height: number }> {
  const rotated = await img.rotate().flatten({ background: '#ffffff' }).toBuffer({ resolveWithObject: true });
  const { width, height } = rotated.info;
  const s = fitScale(width, height);
  const w = Math.max(1, Math.round(width * s));
  const h = Math.max(1, Math.round(height * s));
  const info = await sharp(rotated.data)
    .resize(w, h, { fit: 'fill' })
    .jpeg({ quality: 88, mozjpeg: true })
    .toFile(outFile);
  return { width: info.width, height: info.height };
}

export async function pdfPageCount(file: string): Promise<number> {
  const { stdout } = await execFileAsync('pdfinfo', [file], { timeout: 30_000 });
  const m = /^Pages:\s+(\d+)/m.exec(stdout);
  if (!m) throw new ConversionError('Klarte ikke å lese PDF-filen.');
  return Number(m[1]);
}

/**
 * Gjør originalfilene (bilder og PDF-er, i rekkefølge) om til nummererte sidebilder.
 * PDF-sider rendres med poppler (pdftoppm).
 */
export async function preparePages(sources: { file: string; kind: FileKind }[], pagesDir: string, maxPages: number): Promise<PageImage[]> {
  await fsp.rm(pagesDir, { recursive: true, force: true });
  await fsp.mkdir(pagesDir, { recursive: true });
  const pages: PageImage[] = [];
  const nextFile = () => path.join(pagesDir, `page-${String(pages.length + 1).padStart(3, '0')}.jpg`);

  for (const src of sources) {
    if (src.kind === 'pdf') {
      let count: number;
      try {
        count = await pdfPageCount(src.file);
      } catch (err) {
        if (err instanceof ConversionError) throw err;
        throw new ConversionError('Klarte ikke å lese PDF-filen. Er den skadet eller passordbeskyttet?');
      }
      if (pages.length + count > maxPages) {
        throw new ConversionError(`Notatet har for mange sider (maks ${maxPages}). Del det opp i flere opplastinger.`);
      }
      const tmpPrefix = path.join(pagesDir, `pdf-${pages.length}`);
      try {
        // Render i god oppløsning; skaleres ned til grensene i writePage.
        await execFileAsync('pdftoppm', ['-r', '200', '-png', src.file, tmpPrefix], { timeout: 300_000, maxBuffer: 10 * 1024 * 1024 });
      } catch {
        throw new ConversionError('Klarte ikke å gjøre PDF-sidene om til bilder.');
      }
      const rendered = (await fsp.readdir(pagesDir))
        .filter((f) => f.startsWith(path.basename(tmpPrefix) + '-') && f.endsWith('.png'))
        .sort((a, b) => pageNum(a) - pageNum(b));
      for (const f of rendered) {
        const full = path.join(pagesDir, f);
        const out = nextFile();
        const size = await writePage(sharp(full), out);
        await fsp.rm(full, { force: true });
        pages.push({ index: pages.length, file: path.basename(out), ...size });
      }
    } else {
      if (pages.length + 1 > maxPages) {
        throw new ConversionError(`Notatet har for mange sider (maks ${maxPages}). Del det opp i flere opplastinger.`);
      }
      let img: Sharp;
      try {
        img = await decodeToSharp(src.file, src.kind);
      } catch {
        throw new ConversionError('Et av bildene kunne ikke leses. Prøv å lagre det som JPEG eller PNG.');
      }
      const out = nextFile();
      try {
        const size = await writePage(img, out);
        pages.push({ index: pages.length, file: path.basename(out), ...size });
      } catch {
        throw new ConversionError('Et av bildene kunne ikke leses. Prøv å lagre det som JPEG eller PNG.');
      }
    }
  }
  if (pages.length === 0) throw new ConversionError('Fant ingen sider i opplastingen.');
  return pages;
}

function pageNum(f: string): number {
  const m = /-(\d+)\.png$/.exec(f);
  return m ? Number(m[1]) : 0;
}

export interface FigureBox {
  id: string;
  /** 1-basert sidenummer. */
  page: number;
  box: [number, number, number, number];
}

/**
 * Klipper ut en figur fra et sidebilde. Boksen er i piksler (x0, y0, x1, y1).
 * Legger på litt marg og bleker bakgrunnen lett, slik at papirfargen ikke blir grå i PDF-en.
 * Returnerer false hvis boksen er ugyldig.
 */
export async function cropFigure(pageFile: string, page: { width: number; height: number }, box: FigureBox['box'], outFile: string): Promise<boolean> {
  let [x0, y0, x1, y1] = box.map((v) => Number(v)) as [number, number, number, number];
  if (![x0, y0, x1, y1].every(Number.isFinite)) return false;
  // Godta også normaliserte koordinater (0–1).
  if (Math.max(x0, y0, x1, y1) <= 1.0001) {
    x0 *= page.width;
    x1 *= page.width;
    y0 *= page.height;
    y1 *= page.height;
  }
  if (x1 < x0) [x0, x1] = [x1, x0];
  if (y1 < y0) [y0, y1] = [y1, y0];
  const padX = page.width * 0.015;
  const padY = page.height * 0.015;
  const left = Math.max(0, Math.floor(x0 - padX));
  const top = Math.max(0, Math.floor(y0 - padY));
  const right = Math.min(page.width, Math.ceil(x1 + padX));
  const bottom = Math.min(page.height, Math.ceil(y1 + padY));
  const width = right - left;
  const height = bottom - top;
  if (width < 16 || height < 16) return false;
  await sharp(pageFile)
    .extract({ left, top, width, height })
    .normalise({ lower: 1, upper: 92 })
    .png({ compressionLevel: 9 })
    .toFile(outFile);
  return true;
}
