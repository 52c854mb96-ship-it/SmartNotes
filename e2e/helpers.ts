import { expect, type Browser, type Page } from '@playwright/test';

/**
 * Forsiden viser fagene som kort og åpner ikke et fag av seg selv. Går til forsiden (om vi ikke er der), trykker på
 * fagkortet og venter på fagsiden.
 */
export async function openSubjectFromHome(page: Page, name: string): Promise<void> {
  // Rett etter «Logg inn» er innloggingen kanskje ikke ferdig; en ny lasting da kunne avbryte den.
  await expect(page).not.toHaveURL(/logg-inn/);
  if (new URL(page.url()).pathname !== '/') await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Fagene dine' })).toBeVisible();
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  await page.locator('main').getByRole('link', { name: new RegExp(`^${escaped}\\b`) }).first().click();
  await expect(page.getByRole('heading', { name, level: 1 })).toBeVisible();
}

// ---------- Kontoer (konto.spec.ts og personvern.spec.ts) ----------

const OWNER_PASSWORD = 'e2e-passord';

export async function loginOwner(page: Page): Promise<void> {
  await page.goto('/');
  await expect(page).toHaveURL(/logg-inn/);
  // Eieren kan la brukernavnet stå tomt, som før kontoene.
  await page.getByLabel('Passord', { exact: true }).fill(OWNER_PASSWORD);
  await page.getByRole('button', { name: 'Logg inn' }).click();
  await expect(page.getByRole('heading', { name: 'Fagene dine' })).toBeVisible();
}

export async function openSettings(page: Page): Promise<void> {
  await page.goto('/innstillinger');
  await expect(page.getByRole('heading', { name: 'Innstillinger', level: 1 })).toBeVisible();
}

/** En invitasjonslenke laget i Innstillinger, slik eieren gjør det. */
export async function inviteLink(page: Page): Promise<string> {
  await openSettings(page);
  const card = page.locator('section').filter({ has: page.getByRole('heading', { name: 'Inviter en elev' }) });
  await card.getByRole('button', { name: 'Lag invitasjon' }).click();
  const link = await card.getByLabel('Lenke til eleven').inputValue();
  expect(link).toMatch(/\/registrer#kode=[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/);
  return link;
}

export async function register(browser: Browser, link: string, username: string, subject: string) {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto(link);
  // Nye elever ser hva de registrerer seg til: den korte presentasjonen fra forsiden.
  await expect(page.getByRole('heading', { name: 'SmartNotes – Realfag VGS', level: 1 })).toBeVisible();
  await expect(page.getByRole('list', { name: 'Dette er SmartNotes' }).getByRole('listitem')).toHaveCount(3);
  // Koden står i skjemaet, men ikke lenger i adressefeltet.
  await expect(page.getByLabel('Invitasjonskode')).toHaveValue(/^[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/);
  await expect(page).toHaveURL(/\/registrer$/);
  await page.getByLabel('Brukernavn').fill(username);
  await page.getByLabel('Passord', { exact: true }).fill('elevens-passord');
  await page.getByRole('checkbox', { name: subject }).check();
  await page.getByRole('checkbox', { name: /Jeg er minst 15 år/ }).check();
  // Kontoen kan ikke lages før vilkårene er godtatt.
  await expect(page.getByRole('button', { name: 'Lag konto' })).toBeDisabled();
  await page.getByRole('checkbox', { name: /godtar vilkårene/ }).check();
  await page.getByRole('button', { name: 'Lag konto' }).click();
  await expect(page.getByRole('heading', { name: 'Fagene dine' })).toBeVisible();
  return { context, page };
}
