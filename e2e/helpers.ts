import { expect, type Page } from '@playwright/test';

/**
 * Forsiden viser fagene som kort og åpner ikke et fag av seg selv. Går til forsiden (om vi ikke er der), trykker på
 * fagkortet og venter på fagsiden.
 */
export async function openSubjectFromHome(page: Page, name: string): Promise<void> {
  if (new URL(page.url()).pathname !== '/') await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Fagene dine' })).toBeVisible();
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  await page.locator('main').getByRole('link', { name: new RegExp(`^${escaped}\\b`) }).first().click();
  await expect(page.getByRole('heading', { name, level: 1 })).toBeVisible();
}
