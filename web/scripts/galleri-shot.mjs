#!/usr/bin/env node
/**
 * Skjermbilder av galleriet over scene-kit-et (viz-preview.html?galleri=…). Krever en kjørende Vite-server.
 *
 *   node scripts/galleri-shot.mjs --port 5173 --galleri kjoretoy --out /tmp/galleri
 *   node scripts/galleri-shot.mjs --port 5173 --galleri alle --themes dark --widths 390
 *
 * Skriver én PNG per tema × bredde (hele siden), og lister konsollfeil. Avslutter med kode 1 ved feil eller
 * når teksten på siden inneholder «NaN», «Infinity» eller «undefined».
 */
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from '@playwright/test';

const args = Object.fromEntries(
  process.argv
    .slice(2)
    .join(' ')
    .split(/\s*--/)
    .filter(Boolean)
    .map((a) => {
      const [k, ...v] = a.trim().split(/\s+/);
      return [k, v.join(' ') || 'true'];
    }),
);
const port = Number(args.port ?? 5173);
const out = path.resolve(args.out ?? 'galleri-shots');
const themes = (args.themes ?? 'light,dark').split(',');
const widths = (args.widths ?? '1000,390').split(',').map(Number);
const name = args.galleri ?? 'alle';
const base = `http://localhost:${port}/viz-preview.html`;

fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {});
let failed = false;
try {
  for (const theme of themes) {
    for (const width of widths) {
      const page = await browser.newPage({ viewport: { width, height: 900 }, deviceScaleFactor: width < 600 ? 2 : 1 });
      const errors = [];
      page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
      page.on('pageerror', (e) => errors.push(String(e)));
      await page.goto(`${base}?galleri=${name}&theme=${theme}${width < 600 ? `&width=${width}` : ''}`);
      try {
        await page.waitForSelector('[data-viz-ready], [data-viz-error]', { timeout: 30_000 });
      } catch {
        errors.push('Galleriet ble ikke vist innen 30 s');
      }
      await page.waitForTimeout(400);
      const text = await page.evaluate(() => document.body.innerText);
      if (/\bNaN\b|Infinity|undefined/.test(text)) errors.push('Teksten inneholder NaN, Infinity eller undefined');
      if (await page.$('[data-viz-error]')) errors.push(await page.evaluate(() => document.body.innerText));
      const file = path.join(out, `galleri-${name}-${theme}-${width}.png`);
      await page.screenshot({ path: file, fullPage: true });
      console.log(`${errors.length ? 'FEIL' : 'ok  '} ${file}`);
      for (const e of errors) console.log(`     ${e}`);
      if (errors.length) failed = true;
      await page.close();
    }
  }
} finally {
  await browser.close();
}
process.exit(failed ? 1 : 0);
