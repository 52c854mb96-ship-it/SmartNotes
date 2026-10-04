# SmartNotes – notes for Claude

Personal app for a Norwegian student: handwritten lecture notes (photos/PDF) → Claude vision → LaTeX → PDF, organised by subject → textbook chapter. Offline-first PWA + one Docker server that syncs devices. UI text, error messages and the PDF template are **Norwegian bokmål**; code identifiers are English.

## Layout
- `shared/src/index.ts` – API contract (types only; import with `import type`).
- `server/` – Fastify + better-sqlite3. `src/app.ts` wires everything; routes in `src/routes/`; `src/db.ts` holds all SQL (`Repo`).
  - Sync: every row change gets a new global `rev` (`Repo.nextRev()`); `GET /api/sync?since=` returns rows with `rev > since` incl. soft-deleted tombstones. Any new mutation MUST bump `rev`.
  - Pipeline (`src/pipeline/`): `worker.ts` (DB-backed queue) → `converter.ts` (pages → Claude → crop figures → sanitize → `latex.ts` compile → fix loop → save). `bundle.ts` = combined chapter/subject PDFs.
  - Claude: `pipeline/claude.ts` (`AnthropicClaude` streaming + adaptive thinking + `fallbacks: 'default'`; `FakeClaude` for dev/tests via `SMARTNOTES_FAKE_CLAUDE=1`). Output format = `<metadata>{json}</metadata><latex>body</latex>` parsed in `parse.ts`.
  - Subject profiles: `src/profiles/<id>.ts` (system prompt – keep it free of dates/ids so it caches) + `latex/<id>/preamble.tex`. Physics is the only profile so far.
  - Textbook presets: `src/textbooks.ts` (ERGO Fysikk 1: chapters → sections 1A–10D → competence aims KM1–KM14), seeded on first start (`SEED_TEXTBOOK`). Sections live as JSON on `chapters.sections`, aims on `subjects.aims`; a note stores only its section code, and its aims are derived from the section. Claude picks chapter + section; the server validates the section against the chapter.
  - `notes.search_text` = `latexToText(body)`, synced to the client for offline search.
  - LaTeX safety: compile with `latexmk -no-shell-escape`, `openin_any=p`, `openout_any=p`; `sanitizeBody` strips file/preamble commands.
- `web/` – React 19 + Vite 8 PWA (vite-plugin-pwa), Dexie as local source of truth, outbox for offline uploads, pdf.js viewer. Three-column layout ≥1180px (sidebar | list pane | content), search palette (Ctrl/Cmd+K), light/dark/system theme via `data-theme`.
- UI conventions (from the user's earlier project Momentum, `/home/user/momentum` if cloned): sentence case everywhere (no ALL CAPS labels), no emojis, calm UI, CSS variables only.

## Commands
- `npm test` (server vitest, needs TeX Live + poppler), `npm run typecheck`, `npm run build`, `npm run test:e2e` (Playwright).
- Dev: `SMARTNOTES_FAKE_CLAUDE=1 npm run dev` (server :8787, web :5173 with /api proxy).
- Mutating API calls require header `X-SmartNotes: 1`; auth is the `sn_session` cookie.
