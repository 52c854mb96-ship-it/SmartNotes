import { expect, test } from '@playwright/test';
import { inviteLink, loginOwner, register } from './helpers';

/**
 * Personvern og vilkår: lenkene fra innloggingssiden, «[Fylles inn]» når ansvarlig og kontakt mangler (e2e-serveren
 * setter dem ikke), og «Slett kontoen», som sletter alt og logger ut.
 */

test('personvernerklæringen, vilkårene og siden om AI kan leses uten innlogging', async ({ page }) => {
  await page.goto('/logg-inn');
  await page.getByRole('navigation', { name: 'Personvern og vilkår' }).getByRole('link', { name: 'Personvern' }).click();
  await expect(page.getByRole('heading', { name: 'Personvernerklæring', level: 1 })).toBeVisible();
  await expect(page.getByText('[Fylles inn]').first()).toBeVisible();
  await expect(page.getByText(/sendes bildene av sidene til Anthropic/)).toBeVisible();
  // Kortenes tekst, også egne kort, sendes når eleven ber om svaralternativer.
  await expect(page.getByText(/også kort du har skrevet eller endret selv\) når du ber om svaralternativer/)).toBeVisible();
  await page.getByRole('main').getByRole('link', { name: 'Vilkår' }).click();
  await expect(page.getByRole('heading', { name: 'Vilkår', level: 1 })).toBeVisible();
  await expect(page.getByText(/Last bare opp det du har rett til/)).toBeVisible();
  await page.getByRole('main').getByRole('link', { name: 'Trygg og ærlig bruk av AI' }).last().click();
  await expect(page.getByRole('heading', { name: 'Trygg og ærlig bruk av AI', level: 1 })).toBeVisible();
  await page.getByRole('link', { name: 'Til innloggingen' }).click();
  await expect(page).toHaveURL(/logg-inn/);
});

test.describe('ansvarlig, kontakt og tallene fra serveren', () => {
  // Uten service worker går forespørslene rett gjennom `page.route`.
  test.use({ serviceWorkers: 'block' });

  test('viser ikke «[Fylles inn]» før serveren har svart, og husker svaret uten nett', async ({ page }) => {
    let release: () => void = () => {};
    const answered = new Promise<void>((resolve) => (release = resolve));
    await page.route('**/api/legal', async (route) => {
      await answered;
      await route.fulfill({
        json: { controllerName: 'Ola Nordmann', contact: 'ola@example.no', minAge: 16, freePagesPerDay: 10, freeDecksPerDay: 1 },
      });
    });
    await page.goto('/vilkar');
    await expect(page.getByRole('heading', { name: 'Vilkår', level: 1 })).toBeVisible();
    await expect(page.getByText(/Du må være minst … år/)).toBeVisible();
    await expect(page.getByText('[Fylles inn]')).toHaveCount(0);
    release();
    await expect(page.getByText('Ola Nordmann')).toBeVisible();
    await expect(page.getByText(/Du må være minst 16 år/)).toBeVisible();
    await expect(page.getByText(/konvertere 10 sider og lage 1 kortstokker/)).toBeVisible();
    await expect(page.getByRole('link', { name: 'ola@example.no' })).toHaveAttribute('href', /^mailto:ola@example\.no/);

    // Uten svar fra serveren: det siste svaret er husket på enheten.
    await page.unroute('**/api/legal');
    await page.route('**/api/legal', (route) => route.abort());
    await page.goto('/personvern');
    await expect(page.getByRole('heading', { name: 'Personvernerklæring', level: 1 })).toBeVisible();
    await expect(page.getByText('Ola Nordmann')).toBeVisible();

    // En enhet som aldri har fått svar, sier at det krever nett, ikke at verdien mangler.
    await page.evaluate(() => localStorage.removeItem('smartnotes-legal'));
    await page.reload();
    await expect(page.getByText('(krever nett)').first()).toBeVisible();
    await expect(page.getByText('[Fylles inn]')).toHaveCount(0);
  });
});

test('slett konto: alt slettes, og eleven kan ikke logge inn igjen', async ({ page, browser }, info) => {
  const username = `slett-${info.project.name}`;
  await loginOwner(page);
  const link = await inviteLink(page);
  const student = await register(browser, link, username, 'Fysikk 1');
  const s = student.page;
  await s.goto('/innstillinger');
  await s.getByRole('button', { name: 'Slett kontoen …' }).click();
  const dialog = s.getByRole('dialog', { name: 'Slette kontoen?' });
  await expect(dialog).toContainText(`Kontoen «${username}»`);
  await dialog.getByLabel('Passordet ditt').fill('feil-passord');
  await dialog.getByRole('button', { name: 'Slett for godt' }).click();
  await expect(dialog.getByRole('alert')).toHaveText('Feil passord.');
  await dialog.getByLabel('Passordet ditt').fill('elevens-passord');
  await dialog.getByRole('button', { name: 'Slett for godt' }).click();
  await expect(s).toHaveURL(/logg-inn/);
  await expect(s.getByText('Kontoen og alt du hadde i SmartNotes, er slettet.')).toBeVisible();

  await s.getByLabel('Brukernavn').fill(username);
  await s.getByLabel('Passord', { exact: true }).fill('elevens-passord');
  await s.getByRole('button', { name: 'Logg inn' }).click();
  await expect(s.getByRole('alert')).toHaveText('Feil brukernavn eller passord.');

  // Eieren har ingen knapp for å slette sin egen konto.
  await page.goto('/innstillinger');
  await expect(page.getByRole('button', { name: 'Slett kontoen …' })).toHaveCount(0);
  await student.context.close();
});
