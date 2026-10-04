#!/usr/bin/env node
/**
 * Skjermbilder av visualiseringene via forhåndsvisningen (viz-preview.html). Krever en kjørende Vite-server.
 *
 *   npx vite --port 5311 --strictPort &
 *   node scripts/viz-shot.mjs --port 5311 --chapter 2 --out /tmp/shots
 *   node scripts/viz-shot.mjs --port 5311 --ids k2-friksjon,k2-kraftpar --themes dark --widths 390
 *   node scripts/viz-shot.mjs --port 5311 --chapter 2 --extremes     # også med alle glidebrytere på min og på maks
 *   node scripts/viz-shot.mjs --port 5311 --fag kjemi --chapter 3     # kjemi eller biologi (standard: fysikk)
 *
 * Skriver én PNG per visualisering × tema × bredde, og lister konsollfeil. Avslutter med kode 1 ved feil.
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
const out = path.resolve(args.out ?? 'viz-shots');
const themes = (args.themes ?? 'light,dark').split(',');
const widths = (args.widths ?? '1000,390').split(',').map(Number);
const fag = args.fag ?? 'fysikk';
const base = `http://localhost:${port}/viz-preview.html`;

fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {});
let failed = false;
try {
  let ids = args.ids ? args.ids.split(',') : null;
  if (!ids) {
    const page = await browser.newPage();
    await page.goto(`${base}?fag=${fag}${args.chapter ? `&chapter=${args.chapter}` : ''}`);
    await page.waitForSelector('ul a, [data-viz-error], [data-viz-empty]', { timeout: 30_000 });
    ids = await page.$$eval('ul a', (as) => as.map((a) => new URL(a.href).searchParams.get('id')));
    await page.close();
  }
  for (const id of ids) {
    for (const theme of themes) {
      for (const width of widths) {
        const page = await browser.newPage({ viewport: { width, height: 900 }, deviceScaleFactor: width < 600 ? 2 : 1 });
        const errors = [];
        page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
        page.on('pageerror', (e) => errors.push(String(e)));
        await page.goto(`${base}?fag=${fag}&id=${id}&theme=${theme}`);
        try {
          await page.waitForSelector('[data-viz-ready] .viz, [data-viz-error]', { timeout: 30_000 });
        } catch {
          errors.push('Visualiseringen ble ikke vist innen 30 s');
        }
        await page.waitForTimeout(300);
        const variants = args.extremes ? ['', 'min', 'max'] : [''];
        for (const variant of variants) {
          if (variant) {
            // Sett alle glidebryterne til ytterverdien (React lytter på input-hendelsen).
            for (const slider of await page.$$('input[type=range]')) {
              const value = await slider.getAttribute(variant);
              if (value !== null) await slider.fill(value);
            }
            await page.waitForTimeout(200);
          }
          const file = path.join(out, `${id}-${theme}-${width}${variant ? `-${variant}` : ''}.png`);
          await page.screenshot({ path: file, fullPage: true });
          const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
          if (overflow) errors.push(`Siden scroller sidelengs ved ${width} px${variant ? ` (${variant})` : ''}`);
          const bad = await page.evaluate(() => /NaN|Infinity|undefined/.test(document.querySelector('.viz')?.textContent ?? ''));
          if (bad) errors.push(`Teksten inneholder NaN/Infinity/undefined${variant ? ` (${variant})` : ''}`);
          console.log(`${errors.length ? 'FEIL' : 'ok  '} ${file}`);
          for (const e of errors) console.log(`     ${e}`);
          if (errors.length) failed = true;
          errors.length = 0;
        }
        await page.close();
      }
    }
  }
} finally {
  await browser.close();
}
process.exit(failed ? 1 : 0);
