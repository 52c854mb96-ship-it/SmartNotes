import { expect, test } from '@playwright/test';

/** Visualiseringssiden: oversikt per kapittel, én visualisering med glidebryter, og bla videre. */

const PASSWORD = 'e2e-passord';

test('visualiseringer: oversikt, friksjon og neste', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));

  await page.goto('/');
  await expect(page).toHaveURL(/logg-inn/);
  await page.getByLabel('Passord', { exact: true }).fill(PASSWORD);
  await page.getByRole('button', { name: 'Logg inn' }).click();
  await expect(page.getByRole('heading', { name: 'Fysikk', level: 1 })).toBeVisible();

  const main = page.locator('main');
  await main.getByRole('link', { name: 'Visualiseringer' }).click();
  await expect(page.getByRole('heading', { name: 'Visualiseringer', level: 1 })).toBeVisible();
  // Kapittelnavnet kommer fra læreboka (ERGO Fysikk 1).
  await expect(main.getByRole('heading', { name: /Krefter$/ })).toBeVisible();

  // Filteret
  await main.getByRole('searchbox', { name: 'Filtrer visualiseringene' }).fill('friksjon');
  await expect(main.getByRole('link', { name: /Koblede klosser/ })).toHaveCount(0);
  await main.getByRole('link', { name: /Statisk friksjon og glidefriksjon/ }).click();

  await expect(page).toHaveURL(/\/visualiseringer\/k2-friksjon$/);
  await expect(page.getByRole('heading', { name: 'Statisk friksjon og glidefriksjon', level: 1 })).toBeVisible();
  await expect(main.getByText('Kassen står i ro.')).toBeVisible();

  // Dytt hardere enn μs·N (147 N ved 30 kg og μs = 0,50 på tregulv): kassen glir.
  await main.getByRole('slider', { name: 'Dytt F' }).fill('200');
  await expect(main.getByText('Kassen glir.')).toBeVisible();
  await expect(main.getByRole('img', { name: /Kassen glir/ })).toBeVisible();

  // Bla til neste visualisering (rekkefølgen kan endre seg når nye legges til)
  await main.getByRole('navigation', { name: 'Andre visualiseringer' }).getByRole('link').last().click();
  await expect(page).not.toHaveURL(/k2-friksjon$/);
  await expect(main.locator('.viz')).toBeVisible();

  // Kraftparet: velg gravitasjonsparet
  await page.goto(page.url().replace(/\/visualiseringer\/[^/]+$/, '/visualiseringer/k2-kraftpar'));
  await expect(page.getByRole('heading', { name: 'Kraftpar: bok, bord og jord', level: 1 })).toBeVisible();
  await main.getByRole('radio', { name: 'Gravitasjonsparet' }).click();
  await expect(main.getByText(/Jorda trekker boka nedover/)).toBeVisible();

  expect(errors).toEqual([]);
});

test('søket finner visualiseringer', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveURL(/logg-inn/);
  await page.getByLabel('Passord', { exact: true }).fill(PASSWORD);
  await page.getByRole('button', { name: 'Logg inn' }).click();
  await expect(page.getByRole('heading', { name: 'Fysikk', level: 1 })).toBeVisible();

  await page.keyboard.press('Control+k');
  const palette = page.getByRole('dialog', { name: 'Søk' });
  await palette.getByRole('combobox', { name: 'Søk' }).fill('kraftpar');
  await palette.getByRole('option', { name: /Kraftpar: bok, bord og jord/ }).click();
  await expect(page.getByRole('heading', { name: 'Kraftpar: bok, bord og jord', level: 1 })).toBeVisible();
});
