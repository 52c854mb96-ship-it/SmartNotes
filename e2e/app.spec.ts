import { expect, test, type Page } from '@playwright/test';
import sharp from 'sharp';

/**
 * Hele flyten i en ekte nettleser mot den ferdigbygde appen og serveren (med falsk Claude og ekte LaTeX):
 * innlogging → opplasting → konvertering → PDF, deretter offline-lesing og opplastingskø uten nett.
 */

const PASSWORD = 'e2e-passord';
/** Serveren legger inn ERGO Fysikk 1 ved første oppstart; falsk Claude velger første kapittel. */
const CHAPTER = /Rettlinjet bevegelse/;
/** Konvertering + synk kan ta litt tid på en treg CI-maskin. */
const SLOW = { timeout: 90_000 };

async function notePage(title: string): Promise<Buffer> {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="1600">
    <rect width="100%" height="100%" fill="#fbf8ef"/>
    <text x="80" y="160" font-size="64" font-family="serif">${title}</text>
    <text x="80" y="300" font-size="48" font-family="serif">F = m · a</text>
    <circle cx="600" cy="800" r="220" stroke="#223" stroke-width="10" fill="none"/></svg>`;
  return sharp(Buffer.from(svg)).jpeg().toBuffer();
}

const main = (page: Page) => page.locator('main');
/** Notatlenker ligger i hovedinnholdet, eller i notatlisten (midtkolonnen) på brede skjermer. */
const noteLinks = (page: Page) => main(page).or(page.getByRole('complementary', { name: 'Notatliste' }));

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

/** Går fra faget til kapittelet og venter (med live-oppdatering fra synken) til notatet dukker opp der. */
async function openConvertedNote(page: Page, title: string): Promise<void> {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Fysikk', level: 1 })).toBeVisible();
  await main(page).getByRole('link', { name: CHAPTER }).first().click(SLOW);
  await noteLinks(page).getByRole('link', { name: new RegExp(title) }).first().click(SLOW);
  await expect(page).toHaveURL(/\/notat\//);
  // Tittelen er et redigerbart felt i overskriften når vi er på nett, ren tekst offline.
  await expect(page.getByRole('heading', { name: title, level: 1 })).toBeVisible();
  await expect(main(page).getByText('Ferdig').first()).toBeVisible(SLOW);
  await expect(page.locator('canvas').first()).toBeVisible(SLOW);
}

test('logg inn, last opp, les PDF – også uten nett', async ({ page, context }, info) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));

  await login(page);

  // 1) Last opp et notat; det vises under arbeid og havner i et kapittel når det er konvertert.
  const title = `E2E ${info.project.name}`;
  await upload(page, title, /^Last opp$/);
  await expect(main(page).getByText(title).first()).toBeVisible();
  await openConvertedNote(page, title);

  // Vent til service workeren styrer siden, slik at appen kan lastes uten nett.
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.reload();
  await expect(page.locator('canvas').first()).toBeVisible(SLOW);

  // 2) Offline: last siden på nytt – notatet og PDF-en skal vises fra lokal lagring.
  const noteUrl = page.url();
  await context.setOffline(true);
  await page.goto(noteUrl);
  await expect(page.getByRole('heading', { name: title, level: 1 })).toBeVisible();
  await expect(page.locator('canvas').first()).toBeVisible(SLOW);
  await expect(page.getByText(/Du er offline/).first()).toBeVisible();

  // 3) Offline-opplasting havner i køen …
  const offlineTitle = `Offline ${info.project.name}`;
  await upload(page, offlineTitle, /Lagre i kø/);
  await page.goto('/');
  await expect(main(page).getByText(offlineTitle).first()).toBeVisible();
  await expect(main(page).getByText('Venter på nett').first()).toBeVisible();

  // … og lastes opp og konverteres automatisk når nettet er tilbake.
  await context.setOffline(false);
  await expect(main(page).getByText('Venter på nett')).toHaveCount(0, SLOW);
  await openConvertedNote(page, offlineTitle);

  expect(errors).toEqual([]);
});
