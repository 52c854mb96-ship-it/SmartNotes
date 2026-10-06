import { expect, test, type Page } from '@playwright/test';
import { spawn, type ChildProcess } from 'node:child_process';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * En ny versjon av appen skal tas i bruk også når nettleseren begynte å installere den før siden rakk å starte, slik
 * Safari på Mac kan gjøre når siden lastes på nytt. Da sa Workbox ikke fra, og den gamle versjonen ble stående.
 *
 * Testen kjører sin egen server, først med versjon A og så med B, bak en mellomtjener som kan gjøre installasjonen
 * av B treg. Versjon B er det samme bygget med et annet byggnummer i index.html (som serveren sender med API-svarene)
 * og en ny revisjon av index.html i sw.js.
 */

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = 8797;
const PROXY = 8798;
const PASSWORD = 'e2e-passord';
const BUILD_B = 'e2e-versjon-b';

let work: string;
let server: ChildProcess | undefined;
let proxy: http.Server;
/** Hvor lenge mellomtjeneren holder igjen nedlastingen av den nye index.html når service workeren installerer B. */
let installDelay = 0;

async function startServer(webDist: string): Promise<void> {
  server = spawn(process.execPath, [path.join(ROOT, 'server/dist/index.js')], {
    cwd: ROOT,
    stdio: 'inherit',
    env: {
      ...process.env,
      NODE_ENV: 'production',
      PORT: String(PORT),
      DATA_DIR: path.join(work, 'data'),
      WEB_DIST: webDist,
      APP_PASSWORD: PASSWORD,
      COOKIE_SECURE: 'false',
      SMARTNOTES_FAKE_CLAUDE: '1',
      SEED_TEXTBOOKS: 'none',
      LOG_LEVEL: 'warn',
    },
  });
  for (let i = 0; i < 150; i++) {
    const ok = await fetch(`http://localhost:${PORT}/api/health`).then((r) => r.ok, () => false);
    if (ok) return;
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error('Serveren startet ikke');
}

async function stopServer(): Promise<void> {
  const child = server;
  server = undefined;
  if (!child || child.exitCode !== null) return;
  const exited = new Promise((r) => child.once('exit', r));
  child.kill('SIGTERM');
  await exited;
}

const build = (page: Page) => page.evaluate(() => document.querySelector('meta[name="smartnotes-build"]')?.getAttribute('content'));

test.beforeAll(async () => {
  work = fs.mkdtempSync(path.join(os.tmpdir(), 'smartnotes-oppdatering-'));
  const dist = path.join(ROOT, 'web/dist');
  const a = path.join(work, 'A');
  const b = path.join(work, 'B');
  fs.cpSync(dist, a, { recursive: true });
  fs.cpSync(dist, b, { recursive: true });
  const index = fs.readFileSync(path.join(b, 'index.html'), 'utf8');
  const indexB = index.replace(/(<meta name="smartnotes-build" content=")[^"]+"/, `$1${BUILD_B}"`);
  expect(indexB, 'index.html skal ha byggnummeret').not.toBe(index);
  fs.writeFileSync(path.join(b, 'index.html'), indexB);
  const sw = fs.readFileSync(path.join(b, 'sw.js'), 'utf8');
  const swB = sw.replace(/(\{url:"index\.html",revision:")[^"]+"/, `$1${BUILD_B}"`);
  expect(swB, 'index.html skal stå i precache-lista i sw.js').not.toBe(sw);
  fs.writeFileSync(path.join(b, 'sw.js'), swB);

  // Navigeringer svarer service workeren på selv, så /index.html hentes fra nettet bare når den installeres.
  proxy = http.createServer((req, res) => {
    const forward = () => {
      const upstream = http.request({ host: 'localhost', port: PORT, path: req.url, method: req.method, headers: req.headers }, (r) => {
        res.writeHead(r.statusCode ?? 502, r.headers);
        r.pipe(res);
      });
      upstream.on('error', () => {
        res.writeHead(502);
        res.end();
      });
      req.pipe(upstream);
    };
    if (installDelay > 0 && req.url?.startsWith('/index.html')) setTimeout(forward, installDelay);
    else forward();
  });
  await new Promise<void>((r) => proxy.listen(PROXY, r));
});

test.afterAll(async () => {
  await stopServer();
  await new Promise((r) => proxy?.close(r));
  if (work) fs.rmSync(work, { recursive: true, force: true });
});

for (const [name, delay] of [
  ['stor oppdatering (treg installasjon)', 4000],
  ['liten oppdatering (rask installasjon)', 0],
] as const) {
  test(`ny versjon tas i bruk selv om installasjonen startet før siden: ${name}`, async ({ page }) => {
    test.setTimeout(120_000);
    installDelay = 0;
    await stopServer();
    await startServer(path.join(work, 'A'));
    await page.goto(`http://localhost:${PROXY}/`);
    await expect(page).toHaveURL(/logg-inn/);
    await page.getByLabel('Passord', { exact: true }).fill(PASSWORD);
    await page.getByRole('button', { name: 'Logg inn' }).click();
    await expect(page).not.toHaveURL(/logg-inn/);
    test.skip(!(await page.evaluate(() => 'serviceWorker' in navigator)), 'Nettleseren har ikke service workere');
    await page.waitForFunction(() => navigator.serviceWorker.controller !== null, null, { timeout: 30_000 });
    const buildA = await build(page);
    expect(buildA).toBeTruthy();
    expect(buildA).not.toBe(BUILD_B);

    // Ny versjon på serveren. Nettleseren begynner å installere den, og siden lastes på nytt mens det pågår.
    await stopServer();
    installDelay = delay;
    await startServer(path.join(work, 'B'));
    await page.evaluate(async () => {
      const r = await navigator.serviceWorker.getRegistration();
      (window as unknown as { oldWorker?: ServiceWorker | null }).oldWorker = r?.active;
      void r?.update();
    });
    // Vent til installasjonen er i gang (eller allerede ferdig, hvis nettleseren er rask).
    await page.waitForFunction(
      async () => {
        const r = await navigator.serviceWorker.getRegistration();
        return Boolean(r?.installing || r?.waiting || r?.active !== (window as unknown as { oldWorker?: ServiceWorker | null }).oldWorker);
      },
      null,
      { timeout: 30_000 },
    );
    await page.reload();
    const afterReload = await build(page);
    // Ved rask installasjon kan B allerede ha tatt over før siden lastes på nytt; da er det ingenting å oppdatere.
    if (delay > 0) expect(afterReload).toBe(buildA);
    if (afterReload === BUILD_B) return;
    expect(afterReload).toBe(buildA);

    // Når B har tatt over, skal appen si fra, og «Oppdater» skal gi den nye versjonen.
    const notice = page.getByRole('status').filter({ hasText: 'En ny versjon av SmartNotes er klar.' });
    await expect(notice).toBeVisible();
    await notice.getByRole('button', { name: 'Oppdater' }).click();
    await expect.poll(() => build(page).catch(() => 'laster'), { timeout: 30_000 }).toBe(BUILD_B);
  });
}
