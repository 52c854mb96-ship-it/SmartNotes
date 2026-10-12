import { expect, test, type Page } from '@playwright/test';
import sharp from 'sharp';

/**
 * «Prøv med Haiku»: et ferdig notat lages på nytt med Haiku (falsk Claude), eleven vurderer Haiku-versjonen mot den
 * vanlige, og vurderingen vises i Innstillinger. Begge prosjektene (desktop og mobil) deler én server, så tellingene
 * sjekkes med regulære uttrykk.
 */

const PASSWORD = 'e2e-passord';
const SLOW = { timeout: 90_000 };

async function notePage(title: string): Promise<Buffer> {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="1600">
    <rect width="100%" height="100%" fill="#fbf8ef"/>
    <text x="80" y="160" font-size="64" font-family="serif">${title}</text>
    <text x="80" y="300" font-size="48" font-family="serif">F = m · a</text></svg>`;
  return sharp(Buffer.from(svg)).jpeg().toBuffer();
}

async function login(page: Page): Promise<void> {
  await page.goto('/');
  await expect(page).toHaveURL(/logg-inn/);
  await page.getByLabel('Passord', { exact: true }).fill(PASSWORD);
  await page.getByRole('button', { name: 'Logg inn' }).click();
  await expect(page.getByRole('heading', { name: 'Fysikk', level: 1 })).toBeVisible();
}

const syncNotes = (page: Page) =>
  page.evaluate(
    async () => ((await (await fetch('/api/sync?since=0')).json()) as { notes: { id: string; title: string; status: string }[] }).notes,
  );

const main = (page: Page) => page.locator('main');

test('prøv med Haiku: lag Haiku-versjon, vurder den og se oppsummeringen', async ({ page }, info) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await login(page);

  // 1) Et konvertert notat.
  const title = `Haiku ${info.project.name}`;
  await page.getByRole('button', { name: 'Last opp notater' }).first().click();
  const dialog = page.getByRole('dialog');
  await dialog.locator('input[type=file]').first().setInputFiles({ name: 'side1.jpg', mimeType: 'image/jpeg', buffer: await notePage(title) });
  await dialog.getByLabel(/Tittel/).fill(title);
  await dialog.getByRole('button', { name: /^Last opp$/ }).click();
  await expect(dialog).toBeHidden();
  let noteId = '';
  await expect
    .poll(async () => {
      const n = (await syncNotes(page)).find((x) => x.title === title);
      noteId = n?.id ?? '';
      return n?.status;
    }, SLOW)
    .toBe('done');

  // 2) «Prøv med Haiku …» i menyen på notatet åpner sammenligningen.
  await page.goto(`/notat/${noteId}`);
  await expect(page.getByRole('heading', { name: title, level: 1 })).toBeVisible();
  await expect(main(page).getByText('Ferdig').first()).toBeVisible(SLOW);
  await page.getByRole('button', { name: 'Flere valg' }).click();
  await page.getByRole('menuitem', { name: /^Prøv med Haiku/ }).click();
  await expect(page).toHaveURL(new RegExp(`/notat/${noteId}/sammenlign$`));
  await expect(page.getByRole('heading', { name: 'Sammenlign med Haiku', level: 1 })).toBeVisible();
  await expect(main(page).getByRole('link', { name: title })).toBeVisible();

  // 3) Lag Haiku-versjonen (falsk Claude er rask), og vurder den med en kommentar.
  await main(page).getByRole('button', { name: 'Lag Haiku-versjon' }).click();
  const haikuOk = main(page).getByRole('button', { name: 'Haiku er god nok' });
  await expect(haikuOk).toBeVisible(SLOW);
  await expect(haikuOk).toHaveAttribute('aria-pressed', 'false');
  // Haiku-PDF-en vises (på smale skjermer er fanen «Haiku» valgt).
  await expect(main(page).getByRole('region', { name: /^Haiku-PDF/ }).locator('canvas').first()).toBeVisible(SLOW);

  const comment = `Like bra som Sonnet (${info.project.name})`;
  await main(page).getByLabel(/Kommentar/).fill(comment);
  await haikuOk.click();
  await expect(page.getByText('Vurderingen er lagret.')).toBeVisible();
  await expect(haikuOk).toHaveAttribute('aria-pressed', 'true');
  await expect(main(page).getByRole('button', { name: 'Sonnet er bedre' })).toHaveAttribute('aria-pressed', 'false');

  // Vurderingen og kommentaren ligger på serveren.
  await page.reload();
  await expect(main(page).getByRole('button', { name: 'Haiku er god nok' })).toHaveAttribute('aria-pressed', 'true', SLOW);
  await expect(main(page).getByLabel(/Kommentar/)).toHaveValue(comment);

  // 4) Oppsummeringen i Innstillinger, med lenke tilbake til sammenligningen.
  await page.goto('/innstillinger');
  const card = page.getByRole('region', { name: 'Haiku eller Sonnet' });
  await expect(card.getByText(/Haiku god nok på \d+ av \d+/)).toBeVisible();
  await card.getByText(/^Vurderte notater/).click();
  await expect(card.getByText(comment)).toBeVisible();
  await card.getByRole('link', { name: title }).first().click();
  await expect(page).toHaveURL(new RegExp(`/notat/${noteId}/sammenlign$`));

  expect(errors).toEqual([]);
});
