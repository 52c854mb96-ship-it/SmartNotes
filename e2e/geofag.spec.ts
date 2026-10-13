import { expect, test, type Page } from '@playwright/test';

/**
 * Geofag 1 legges ikke inn av seg selv. Brukeren legger det til fra oppsettene etter læreplanen («Legg til fag»), og
 * faget får fargetemaet «Fjell», egne temaer og kompetansemålene fra Udir.
 */

const PASSWORD = 'e2e-passord';

async function login(page: Page): Promise<void> {
  await page.goto('/');
  await expect(page).toHaveURL(/logg-inn/);
  await page.getByLabel('Passord', { exact: true }).fill(PASSWORD);
  await page.getByRole('button', { name: 'Logg inn' }).click();
  await expect(page.getByRole('heading', { name: 'Fagene dine' })).toBeVisible();
}

async function subjects(page: Page): Promise<{ id: string; name: string; profile: string }[]> {
  return page.evaluate(async () => {
    const res = await fetch('/api/sync?since=0');
    return ((await res.json()) as { subjects: { id: string; name: string; profile: string }[] }).subjects;
  });
}

async function openAddSubject(page: Page): Promise<void> {
  const menu = page.getByRole('button', { name: 'Åpne meny' });
  if (await menu.isVisible()) await menu.click();
  await page.getByRole('navigation', { name: 'Fag' }).getByRole('button', { name: 'Legg til fag' }).click();
}

test('geofag: legges til fra læreplanen, med fargetema og egne temaer', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await login(page);

  // Serveren deles mellom prosjektene: den kjøringen som kommer først, legger til faget, den neste ser at det finnes.
  // At faget ikke legges inn av seg selv, testes i server/test/seed.test.ts.
  const first = !(await subjects(page)).some((s) => s.profile === 'geoscience');

  await openAddSubject(page);
  const dialog = page.getByRole('dialog', { name: 'Legg til fag' });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('radio', { name: 'Fra læreplanen' })).toHaveAttribute('aria-checked', 'true');
  // Fagene eleven allerede har, kan ikke legges til en gang til.
  await expect(dialog.getByRole('radio', { name: /Fysikk 1/ })).toBeDisabled();
  const geofag = dialog.getByRole('radio', { name: /Geofag 1/ });
  if (first) {
    await expect(dialog.getByText('9 temaer · 12 kompetansemål')).toBeVisible();
    await geofag.check();
    await dialog.getByRole('button', { name: 'Legg til faget' }).click();
    await expect(dialog).toBeHidden();
    await expect(page.getByText('«Geofag 1» er lagt til.')).toBeVisible();
  } else {
    await expect(geofag).toBeDisabled();
    await dialog.getByRole('button', { name: 'Avbryt' }).click();
    const id = (await subjects(page)).find((s) => s.profile === 'geoscience')!.id;
    await page.goto(`/fag/${id}`);
  }

  await expect(page.getByRole('heading', { name: 'Geofag 1', level: 1 })).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('data-subject', 'geoscience');
  const main = page.locator('main');
  await expect(main.getByText('Jorda som system').first()).toBeVisible();
  await expect(main.getByText(/gjøre rede for bevegelser i jordas indre/).first()).toBeVisible();
  // Geofag har ingen visualiseringer ennå.
  await expect(main.getByRole('link', { name: 'Visualiseringer' })).toHaveCount(0);
  expect((await subjects(page)).filter((s) => s.profile === 'geoscience')).toHaveLength(1);
  expect(errors).toEqual([]);
});
