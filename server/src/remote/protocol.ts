/**
 * Protokollen mellom serveren og hjemmemaskinen (hjemmeworkeren). Serveren gjør alt annet selv (sidebilder, LaTeX,
 * PDF, lagring); bare AI-kallene sendes til hjemmemaskinen, som henter dem med `POST /api/worker/claim` og svarer med
 * `POST /api/worker/tasks/:id/result`. Hjemmemaskinen kobler seg bare utover (HTTPS), så hjemmenettet åpnes ikke.
 */
import fsp from 'node:fs/promises';
import path from 'node:path';
import type { ChapterInput, CompetenceAim, SubjectProfile } from '@smartnotes/shared';
import { ConversionError } from '../errors.js';
import type { ChoicesRequest, FlashcardRequest } from '../flashcards/prompt.js';
import type { AiService, ConvertRequest } from '../pipeline/ai.js';
import { getProfile } from '../profiles/index.js';
import type { Usage } from '../usage.js';

/**
 * Versjon av protokollen. Økes når formatet endres, så gamle hjemmemaskiner får beskjed om å oppdatere.
 * 2: svaralternativer (flervalg): `generateChoices`, og `withChoices` og `choices` i kortstokkene.
 */
export const PROTOCOL_VERSION = 2;

/** Et sidebilde som sendes med oppgaven (JPEG i base64). */
export interface WirePage {
  width: number;
  height: number;
  data: string;
}

export type RemoteCall =
  | { method: 'convert'; req: Omit<ConvertRequest, 'profile' | 'pages'> & { profile: SubjectProfile; pages: WirePage[] } }
  | { method: 'fix'; req: { profile: SubjectProfile; body: string; errorReport: string } }
  | { method: 'extractToc'; profile: SubjectProfile; images: { data: string; mediaType: 'image/jpeg' | 'image/png' }[]; aims: CompetenceAim[] }
  | { method: 'mapSectionAims'; profile: SubjectProfile; chapters: ChapterInput[]; aims: CompetenceAim[] }
  | { method: 'generateFlashcards'; req: FlashcardRequest }
  | { method: 'generateChoices'; req: ChoicesRequest };

export type RemoteMethod = RemoteCall['method'];

/** Oppgaven slik hjemmemaskinen får den. */
export interface RemoteTask {
  id: string;
  /** Id for akkurat denne hentingen. Sendes med heartbeat og svar. */
  lease: string;
  call: RemoteCall;
  /** Hvor lenge oppgaven er reservert (ms). Forlenges med heartbeat. */
  leaseMs: number;
}

export interface ClaimRequest {
  /** Navnet på hjemmemaskinen, f.eks. «Eskils PC». Vises i innstillingene. */
  name: string;
  protocol: number;
  /** Modellene maskinen bruker (for visning). */
  models?: string[];
}

export type RemoteOutcome =
  | { ok: true; result: unknown }
  | {
      ok: false;
      error: {
        message: string;
        retryable: boolean;
        usage?: Usage;
        /** Bare fra køen på serveren selv, aldri fra hjemmemaskinen: avbrutt, eller ingen hjemmemaskin (bruk reserven). */
        code?: 'aborted' | 'unavailable';
      };
    };

// ---------- Fra AI-kall til oppgave (serveren) ----------

export async function encodePages(pages: ConvertRequest['pages']): Promise<WirePage[]> {
  return Promise.all(pages.map(async (p) => ({ width: p.width, height: p.height, data: (await fsp.readFile(p.path)).toString('base64') })));
}

// ---------- Fra oppgave til AI-kall (hjemmemaskinen) ----------

/**
 * Kjører oppgaven med den lokale AI-en. Sidebildene skrives til `tmpDir` (og slettes etterpå), fordi AI-tjenestene
 * leser sidene fra fil. Gir svaret eller feilen i protokollens format.
 */
export async function executeRemoteCall(call: RemoteCall, ai: AiService, tmpDir: string): Promise<RemoteOutcome> {
  try {
    return { ok: true, result: await run(call, ai, tmpDir) };
  } catch (err) {
    if (err instanceof ConversionError) return { ok: false, error: { message: err.message, retryable: err.retryable, ...(err.usage ? { usage: err.usage } : {}) } };
    return { ok: false, error: { message: err instanceof Error ? err.message : 'Ukjent feil på hjemmemaskinen.', retryable: false } };
  }
}

async function run(call: RemoteCall, ai: AiService, tmpDir: string): Promise<unknown> {
  switch (call.method) {
    case 'convert': {
      const dir = await fsp.mkdtemp(path.join(tmpDir, 'smartnotes-'));
      try {
        const pages = [];
        for (const [i, p] of call.req.pages.entries()) {
          const file = path.join(dir, `side-${i + 1}.jpg`);
          await fsp.writeFile(file, Buffer.from(p.data, 'base64'));
          pages.push({ path: file, width: p.width, height: p.height });
        }
        return await ai.convert({ ...call.req, profile: getProfile(call.req.profile), pages });
      } finally {
        await fsp.rm(dir, { recursive: true, force: true });
      }
    }
    case 'fix':
      return ai.fix({ ...call.req, profile: getProfile(call.req.profile) });
    case 'extractToc':
      return ai.extractToc(
        getProfile(call.profile),
        call.images.map((img) => ({ data: Buffer.from(img.data, 'base64'), mediaType: img.mediaType })),
        call.aims,
      );
    case 'mapSectionAims':
      return ai.mapSectionAims(getProfile(call.profile), call.chapters, call.aims);
    case 'generateFlashcards':
      return ai.generateFlashcards(call.req);
    case 'generateChoices':
      return ai.generateChoices(call.req);
  }
}
