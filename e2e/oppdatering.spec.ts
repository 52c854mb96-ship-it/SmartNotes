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

/** Tilstanden til service workerne, til feilsøking når testen feiler. */
const swState = (page: Page) =>
  page.evaluate(async () => {
    const r = await navigator.serviceWorker.getRegistration();
    return {
      installing: r?.installing?.state ?? null,
      waiting: r?.waiting?.state ?? null,
      active: r?.active?.state ?? null,
      controlled: navigator.serviceWorker.controller !== null,
    };
  });

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

// «underveis»: siden lastes på nytt mens den nye versjonen installeres (nedlastingen holdes igjen i 4 s).
// «ferdig»: den nye versjonen er installert før siden lastes på nytt. Safari lar den gjerne stå og vente.
for (const [name, delay] of [
  ['installasjonen er underveis når siden lastes', 4000],
  ['ny versjon er ferdig installert når siden lastes', 0],
] as const) {
  test(`ny versjon tas i bruk: ${name}`, async ({ page }) => {
    test.setTimeout(120_000);
    const log: string[] = [];
    const t0 = Date.now();
    page.on('console', (m) => log.push(`${Date.now() - t0} ms konsoll: ${m.text()}`));
    page.on('response', (r) => {
      const header = r.headers()['x-smartnotes-build'];
      if (r.url().includes('/api/')) log.push(`${Date.now() - t0} ms ${r.status()} ${new URL(r.url()).pathname} build=${header ?? '–'}`);
    });
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

    // Ny versjon på serveren. Nettleseren begynner å installere den, og siden lastes på nytt.
    await stopServer();
    installDelay = delay;
    await startServer(path.join(work, 'B'));
    await page.evaluate(async () => {
      const r = await navigator.serviceWorker.getRegistration();
      (window as unknown as { oldWorker?: ServiceWorker | null }).oldWorker = r?.active;
      void r?.update();
    });
    // «underveis»: vent til installasjonen er i gang. «ferdig»: vent til den er ferdig (venter eller har tatt over).
    await page.waitForFunction(
      async (underway) => {
        const r = await navigator.serviceWorker.getRegistration();
        const replaced = r?.active !== (window as unknown as { oldWorker?: ServiceWorker | null }).oldWorker;
        return Boolean((underway && r?.installing) || r?.waiting || replaced);
      },
      delay > 0,
      { timeout: 30_000 },
    );
    log.push(`${Date.now() - t0} ms før omlasting: ${JSON.stringify(await swState(page))}`);
    await page.reload();
    const afterReload = await build(page);
    log.push(`${Date.now() - t0} ms etter omlasting (${afterReload}): ${JSON.stringify(await swState(page))}`);
    // Har B allerede tatt over før siden lastes på nytt (vanlig i Chromium), er det ingenting å oppdatere.
    if (delay > 0) expect(afterReload).toBe(buildA);
    if (afterReload === BUILD_B) return;
    expect(afterReload).toBe(buildA);

    // Når B har tatt over, skal appen si fra, og «Oppdater» skal gi den nye versjonen.
    const notice = page.getByRole('status').filter({ hasText: 'En ny versjon av SmartNotes er klar.' });
    try {
      await expect(notice).toBeVisible();
    } catch (err) {
      // Skriv ut hva som skjedde, så feilen kan forstås fra CI-loggen (WebKit kan ikke kjøres lokalt overalt).
      for (let i = 0; i < 3; i++) {
        log.push(`${Date.now() - t0} ms tilstand: ${JSON.stringify(await swState(page))}`);
        await page.waitForTimeout(1000);
      }
      console.log(`Feilsøking (${test.info().project.name}, ${name}):\n${log.join('\n')}`);
      throw err;
    }
    await notice.getByRole('button', { name: 'Oppdater' }).click();
    await expect.poll(() => build(page).catch(() => 'laster'), { timeout: 30_000 }).toBe(BUILD_B);
  });
}
