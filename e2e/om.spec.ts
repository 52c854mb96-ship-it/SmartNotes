import { expect, test, type Page } from '@playwright/test';

/**
 * «Om SmartNotes»: kilden til kompetansemålene (NLOD), at appen ikke er tilknyttet Udir eller et forlag, og lisensene til
 * pakkene som følger med appen (lista lages når appen bygges, se web/build/licenses.ts).
 */

const PASSWORD = 'e2e-passord';

async function login(page: Page): Promise<void> {
  await page.goto('/');
  await expect(page).toHaveURL(/logg-inn/);
  await page.getByLabel('Passord', { exact: true }).fill(PASSWORD);
  await page.getByRole('button', { name: 'Logg inn' }).click();
  await expect(page.getByRole('heading', { name: 'Fysikk', level: 1 })).toBeVisible();
}

test('om SmartNotes: kilde for kompetansemålene og lisensene til pakkene', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await login(page);

  // Kilden står der kompetansemålene vises.
  await expect(page.locator('main').getByText(/norsk lisens for offentlige data \(NLOD\) tilgjengeliggjort av\s+Utdanningsdirektoratet/)).toBeVisible();

  await page.goto('/innstillinger');
  const about = page.getByRole('region', { name: 'Om SmartNotes' });
  await expect(about.getByText(/ikke tilknyttet Utdanningsdirektoratet eller noe forlag/)).toBeVisible();
  await expect(about.getByText(/norsk lisens for offentlige data \(NLOD\)/)).toBeVisible();
  await about.getByRole('link', { name: 'Lisenser' }).click();

  await expect(page).toHaveURL(/\/innstillinger\/lisenser$/);
  await expect(page.getByRole('heading', { name: 'Lisenser', level: 1 })).toBeVisible();
  const list = page.getByRole('region', { name: 'Pakker med åpen kildekode' });
  // Sammendraget er navnet rett før versjonen («react19.3.0 · MIT»), så /^react\d/ treffer bare react selv.
  const react = list.locator('details').filter({ has: page.locator('summary', { hasText: /^react\d/ }) });
  await expect(react.locator('summary')).toContainText('MIT');
  await expect(list.locator('summary', { hasText: 'lucide-react' })).toContainText('ISC');
  await expect(list.locator('summary', { hasText: 'pdfjs-dist' })).toContainText('Apache-2.0');
  await expect(react.locator('pre')).toBeHidden();
  await react.locator('summary').click();
  await expect(react.locator('pre')).toBeVisible();
  await expect(react.locator('pre')).toContainText(/Permission is hereby granted/);

  await page.getByRole('link', { name: 'Innstillinger' }).first().click();
  await expect(page.getByRole('heading', { name: 'Innstillinger', level: 1 })).toBeVisible();
  expect(errors).toEqual([]);
});
