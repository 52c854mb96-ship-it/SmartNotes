import { expect, test, type Page } from '@playwright/test';
import sharp from 'sharp';

/**
 * Hele flyten i en ekte nettleser mot den ferdigbygde appen og serveren (med falsk Claude og ekte LaTeX):
 * innlogging → opplasting → konvertering → PDF, deretter offline-lesing og opplastingskø uten nett.
 */

const PASSWORD = 'e2e-passord';

async function notePage(title: string): Promise<Buffer> {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="1600">
    <rect width="100%" height="100%" fill="#fbf8ef"/>
    <text x="80" y="160" font-size="64" font-family="serif">${title}</text>
    <text x="80" y="300" font-size="48" font-family="serif">F = m · a</text>
    <circle cx="600" cy="800" r="220" stroke="#223" stroke-width="10" fill="none"/></svg>`;
  return sharp(Buffer.from(svg)).jpeg().toBuffer();
}

async function login(page: Page): Promise<void> {
  await page.goto('/');
  await expect(page).toHaveURL(/logg-inn/);
  await page.getByLabel('Passord', { exact: true }).fill(PASSWORD);
  await page.getByRole('button', { name: 'Logg inn' }).click();
  await expect(page.getByRole('heading', { name: 'Fysikk', level: 1 })).toBeVisible();
}

async function upload(page: Page, title: string, buttonName: RegExp): Promise<void> {
  await page.getByRole('button', { name: 'Last opp notater' }).first().click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await dialog.locator('input[type=file]').first().setInputFiles({ name: 'side1.jpg', mimeType: 'image/jpeg', buffer: await notePage(title) });
  await expect(dialog.getByText('side1.jpg')).toBeVisible();
  await dialog.getByLabel(/Tittel/).fill(title);
  await dialog.getByRole('button', { name: buttonName }).click();
  await expect(dialog).toBeHidden();
}

async function openNote(page: Page, title: string): Promise<void> {
  // Notatet havner i et kapittel som falsk Claude velger; finn det via faget.
  await page.goto('/');
  const card = page.getByRole('link', { name: new RegExp(title) }).first();
  if (!(await card.isVisible().catch(() => false))) {
    await page.getByRole('link', { name: /Fysikk og måling/ }).last().click();
  }
  await page.getByRole('link', { name: new RegExp(title) }).first().click();
  await expectNoteTitle(page, title);
}

/** Tittelen er et redigerbart felt når vi er på nett, og en vanlig overskrift offline. */
async function expectNoteTitle(page: Page, title: string): Promise<void> {
  await expect(page).toHaveURL(/\/notat\//);
  await expect(page.getByRole('heading', { name: title, level: 1 })).toBeVisible();
}

test('logg inn, last opp, les PDF – også uten nett', async ({ page, context }, info) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));

  await login(page);

  // 1) Last opp et notat og vent på konverteringen.
  const title = `E2E ${info.project.name}`;
  await upload(page, title, /^Last opp$/);
  await expect(page.getByText(title).first()).toBeVisible();
  await expect
    .poll(
      async () => {
        await page.goto('/');
        return page.getByRole('link', { name: /Fysikk og måling/ }).count();
      },
      { timeout: 60_000 },
    )
    .toBeGreaterThan(0);
  await openNote(page, title);
  await expect(page.getByText('Ferdig').first()).toBeVisible({ timeout: 60_000 });
  await expect(page.locator('canvas').first()).toBeVisible({ timeout: 30_000 });

  // Vent til service workeren styrer siden, slik at appen kan lastes uten nett.
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.reload();
  await expect(page.locator('canvas').first()).toBeVisible({ timeout: 30_000 });

  // 2) Offline: last siden på nytt – notatet og PDF-en skal vises fra lokal lagring.
  const noteUrl = page.url();
  await context.setOffline(true);
  await page.goto(noteUrl);
  await expectNoteTitle(page, title);
  await expect(page.locator('canvas').first()).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText(/Du er offline/).first()).toBeVisible();

  // 3) Offline-opplasting havner i køen …
  const offlineTitle = `Offline ${info.project.name}`;
  await upload(page, offlineTitle, /Lagre i kø/);
  await page.goto('/');
  await expect(page.getByText(offlineTitle).first()).toBeVisible();
  await expect(page.getByText('Venter på nett').first()).toBeVisible();

  // … og konverteres automatisk når nettet er tilbake.
  await context.setOffline(false);
  await expect
    .poll(
      async () => {
        await page.goto('/');
        await page.getByRole('link', { name: /Fysikk og måling/ }).last().click();
        return page.getByRole('link', { name: new RegExp(offlineTitle) }).count();
      },
      { timeout: 60_000, intervals: [2_000] },
    )
    .toBeGreaterThan(0);
  await page.getByRole('link', { name: new RegExp(offlineTitle) }).first().click();
  await expect(page.getByText('Ferdig').first()).toBeVisible({ timeout: 60_000 });
  await expect(page.locator('canvas').first()).toBeVisible({ timeout: 30_000 });

  expect(errors).toEqual([]);
});
