import { expect, test, type Page } from '@playwright/test';
import sharp from 'sharp';

/**
 * Safari (WebKit) på Mac og iPad: de viktigste dialogene og opplastingen.
 * Kjøres bare i prosjektene «safari» og «ipad» (se playwright.config.ts), i en egen CI-jobb.
 * Skriver ut målinger av dialogen (DIAG) så feil i WebKit kan forstås fra CI-loggen.
 */

const PASSWORD = 'e2e-passord';
const SLOW = { timeout: 90_000 };

async function login(page: Page): Promise<void> {
  await page.goto('/');
  await expect(page).toHaveURL(/logg-inn/);
  await page.getByLabel('Passord', { exact: true }).fill(PASSWORD);
  await page.getByRole('button', { name: 'Logg inn' }).click();
  await expect(page.getByRole('heading', { name: 'Fysikk', level: 1 })).toBeVisible();
}

/** Målinger av den åpne dialogen: størrelse, stil og hva som faktisk ligger øverst midt i den. */
async function diagnose(page: Page, selector: string): Promise<Record<string, unknown>> {
  return page.evaluate((sel) => {
    const d = document.querySelector(sel) as HTMLDialogElement | null;
    if (!d) return { found: false };
    const cs = getComputedStyle(d);
    const r = d.getBoundingClientRect();
    const inner = d.querySelector('.modal-inner, .search-head') as HTMLElement | null;
    const ir = inner?.getBoundingClientRect();
    const probe = (x: number, y: number) => {
      const el = document.elementFromPoint(x, y);
      return el ? `${el.tagName.toLowerCase()}.${String(el.className).slice(0, 40)}` : null;
    };
    const toaster = document.querySelector('.toaster') as HTMLElement | null;
    const tr = toaster?.getBoundingClientRect();
    return {
      found: true,
      open: d.open,
      modal: d.matches(':modal'),
      rect: [r.x, r.y, r.width, r.height].map(Math.round),
      display: cs.display,
      position: cs.position,
      opacity: cs.opacity,
      visibility: cs.visibility,
      transform: cs.transform,
      animation: cs.animationName,
      innerRect: ir ? [ir.x, ir.y, ir.width, ir.height].map(Math.round) : null,
      atCenter: probe(r.x + r.width / 2, r.y + Math.min(r.height / 2, 60)),
      atViewportCenter: probe(innerWidth / 2, innerHeight / 2),
      toasterOpen: toaster ? toaster.matches(':popover-open') : null,
      toasterRect: tr ? [tr.x, tr.y, tr.width, tr.height].map(Math.round) : null,
      viewport: [innerWidth, innerHeight],
      userAgent: navigator.userAgent,
    };
  }, selector);
}

/** Elementet er synlig og ligger helt innenfor rammen (ikke klippet bort av en for lav forelder). */
async function expectInside(locator: ReturnType<Page['locator']>, outer: { x: number; y: number; width: number; height: number } | null): Promise<void> {
  await expect(locator).toBeVisible();
  const b = await locator.boundingBox();
  expect(b && outer).toBeTruthy();
  if (!b || !outer) return;
  expect(b.height).toBeGreaterThan(10);
  expect(b.y).toBeGreaterThanOrEqual(outer.y - 1);
  expect(b.y + b.height).toBeLessThanOrEqual(outer.y + outer.height + 1);
}

async function notePage(title: string): Promise<Buffer> {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="1600">
    <rect width="100%" height="100%" fill="#fbf8ef"/>
    <text x="80" y="160" font-size="64" font-family="serif">${title}</text></svg>`;
  return sharp(Buffer.from(svg)).jpeg().toBuffer();
}

test('opplastingsdialogen vises og kan brukes', async ({ page }, info) => {
  const logLines: string[] = [];
  page.on('console', (m) => (m.type() === 'error' || m.type() === 'warning') && logLines.push(`${m.type()}: ${m.text()}`));
  page.on('pageerror', (e) => logLines.push(`pageerror: ${e.message}`));
  await login(page);
  await page.getByRole('button', { name: 'Last opp notater' }).first().click();
  await page.waitForTimeout(600); // la åpningsanimasjonen bli ferdig
  const diag = await diagnose(page, 'dialog.modal');
  console.log(`DIAG upload [${info.project.name}]`, JSON.stringify(diag));

  const dialog = page.getByRole('dialog', { name: 'Last opp notater' });
  await expect(dialog.getByRole('heading', { name: 'Last opp notater' })).toBeVisible();
  const box = await dialog.boundingBox();
  expect(box?.height ?? 0).toBeGreaterThan(200);
  expect(box?.width ?? 0).toBeGreaterThan(280);
  // Det som ligger øverst midt i dialogen, skal være innholdet i den (ikke dialogen selv eller noe som dekker den).
  expect(String(diag.atCenter)).not.toMatch(/^(div\.toaster|dialog)/);
  // Filvelgeren og knappene skal ligge innenfor dialogen, ikke klippes bort.
  await expectInside(dialog.getByRole('button', { name: /^Last opp$/ }), box);

  // Hele opplastingen i Safari
  const title = `Safari ${info.project.name}`;
  await dialog.locator('input[type=file]').first().setInputFiles({ name: 'side1.jpg', mimeType: 'image/jpeg', buffer: await notePage(title) });
  await expect(dialog.getByText('side1.jpg')).toBeVisible();
  await dialog.getByLabel(/Tittel/).fill(title);
  await dialog.getByRole('button', { name: /^Last opp$/ }).click();
  try {
    await expect(dialog).toBeHidden();
  } catch (err) {
    const text = (await dialog.innerText().catch(() => '')).replace(/\s+/g, ' ').slice(0, 600);
    console.log(`DIAG upload-error [${info.project.name}]`, JSON.stringify({ text, log: logLines }));
    throw err;
  }
  await expect(page.locator('main').getByText(title).first()).toBeVisible(SLOW);
});

test('søk og visualiseringer i Safari', async ({ page }, info) => {
  await login(page);

  // Søket åpnes fra knappen i sidepanelet på brede skjermer, ellers med tastatur.
  const searchButton = page.getByRole('button', { name: /^Søk/ }).first();
  if (await searchButton.isVisible()) await searchButton.click();
  else await page.keyboard.press('Control+k');
  const palette = page.getByRole('dialog', { name: 'Søk' });
  await expect(palette).toBeVisible();
  console.log(`DIAG search [${info.project.name}]`, JSON.stringify(await diagnose(page, 'dialog.search-palette')));
  await palette.getByRole('combobox', { name: 'Søk' }).fill('friksjon');
  const option = palette.getByRole('option', { name: /Statisk friksjon og glidefriksjon/ });
  await expect(option).toBeVisible();
  await page.waitForTimeout(300);
  console.log(`DIAG search-results [${info.project.name}]`, JSON.stringify(await diagnose(page, 'dialog.search-palette')));
  // Treffene skal få plass i søkevinduet (Safari klemte dem tidligere til 0 px).
  expect((await palette.locator('.search-body').boundingBox())?.height ?? 0).toBeGreaterThan(60);
  await expectInside(option, await palette.boundingBox());
  await option.click();

  await expect(page.getByRole('heading', { name: 'Statisk friksjon og glidefriksjon', level: 1 })).toBeVisible();
  const figure = page.locator('.viz-figure svg').first();
  await expect(figure).toBeVisible();
  expect((await figure.boundingBox())?.height ?? 0).toBeGreaterThan(100);
  await page.locator('main').getByRole('slider', { name: 'Dytt F' }).fill('200');
  await expect(page.locator('main').getByText('Kassen glir.')).toBeVisible();
});
