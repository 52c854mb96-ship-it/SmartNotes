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

  // Kilden står der kompetansemålene vises, med lenke til lisensen og til Udirs data.
  const source = page.locator('main .aims-source');
  await expect(source).toContainText(/norsk lisens for offentlige data \(NLOD\)\s+tilgjengeliggjort av Utdanningsdirektoratet/);
  await expect(source.getByRole('link', { name: 'norsk lisens for offentlige data (NLOD)' })).toHaveAttribute('href', 'https://data.norge.no/nlod/no/2.0');
  await expect(source.getByRole('link', { name: 'data.udir.no' })).toHaveAttribute('href', 'https://data.udir.no');

  await page.goto('/innstillinger');
  const about = page.getByRole('region', { name: 'Om SmartNotes' });
  await expect(about.getByText(/ikke tilknyttet Utdanningsdirektoratet eller noe forlag/)).toBeVisible();
  await expect(about.getByRole('link', { name: 'norsk lisens for offentlige data (NLOD)' })).toHaveAttribute('href', 'https://data.norge.no/nlod/no/2.0');
  await about.getByRole('link', { name: 'Lisenser' }).click();

  await expect(page).toHaveURL(/\/innstillinger\/lisenser$/);
  await expect(page.getByRole('heading', { name: 'Lisenser', level: 1 })).toBeVisible();
  const list = page.getByRole('region', { name: 'Pakker med åpen kildekode' });
  // Sammendraget er navnet rett før versjonen («react19.3.0 · MIT»), så /^react\d/ treffer bare react selv.
  const react = list.locator('details').filter({ has: page.locator('summary', { hasText: /^react\d/ }) });
  await expect(react.locator('summary')).toContainText('MIT');
  await expect(list.locator('summary', { hasText: 'lucide-react' })).toContainText('ISC');
  await expect(list.locator('summary', { hasText: 'pdfjs-dist' })).toContainText('Apache-2.0');
  await expect(list.locator('summary', { hasText: 'KaTeX-fontene' })).toContainText('OFL-1.1');
  await expect(react.locator('pre')).toBeHidden();
  await react.locator('summary').click();
  await expect(react.locator('pre')).toBeVisible();
  await expect(react.locator('pre')).toContainText(/Permission is hereby granted/);

  await page.getByRole('link', { name: 'Innstillinger' }).first().click();
  await expect(page.getByRole('heading', { name: 'Innstillinger', level: 1 })).toBeVisible();
  expect(errors).toEqual([]);
});
