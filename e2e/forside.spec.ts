import { expect, test } from '@playwright/test';

/**
 * Forsiden: appen åpner ikke lenger et fag av seg selv. Den viser en kort presentasjon og fagene som kort; et trykk på
 * et fag åpner fagsiden, og logoen fører tilbake til forsiden. Innloggingen har en kort versjon av presentasjonen.
 */

const PASSWORD = 'e2e-passord';
const APP_TITLE = 'SmartNotes – Realfag VGS';

test('forsiden: presentasjon, fagene som kort og ingen automatisk videresending', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/');
  await expect(page).toHaveURL(/logg-inn/);

  // Innloggingen: den korte presentasjonen, og skjemaet er likevel synlig uten å rulle (også på mobil).
  await expect(page).toHaveTitle('Logg inn – SmartNotes');
  await expect(page.getByRole('heading', { name: APP_TITLE, level: 1 })).toBeVisible();
  const pitch = page.getByRole('list', { name: 'Dette er SmartNotes' });
  const lines = [/notater blir pene PDF-er/, /Visualiseringer der du styrer tallene selv/, /Flashcards fra dine egne notater/];
  for (const line of lines) {
    await expect(pitch.getByRole('listitem').filter({ hasText: line })).toBeVisible();
  }
  await expect(page.getByRole('button', { name: 'Logg inn' })).toBeInViewport();

  await page.getByLabel('Passord', { exact: true }).fill(PASSWORD);
  await page.getByRole('button', { name: 'Logg inn' }).click();

  // Åpne appen → forsiden, og den blir stående.
  await expect(page.getByRole('heading', { name: APP_TITLE, level: 1 })).toBeVisible();
  await expect(page).toHaveTitle(APP_TITLE);
  const main = page.locator('main');
  // Presentasjonen: notater, visualiseringer og flashcards, hvert med hvorfor det hjelper, og hvordan de henger sammen.
  const features = main.getByRole('list', { name: 'Dette er SmartNotes' });
  for (const title of ['Notatene dine, pene og samlet', 'Visualiseringer', 'Flashcards']) {
    await expect(features.getByRole('heading', { name: title, exact: true })).toBeVisible();
  }
  await expect(features.getByText(/Ta bilde av de håndskrevne notatene/)).toBeVisible();
  await expect(features.getByRole('listitem').filter({ hasText: /Hvorfor:/ })).toHaveCount(3);
  await expect(main.getByText(/Slik henger det sammen:/)).toBeVisible();
  // Uten et fag som sist var åpent, er presentasjonen bare tekst.
  await expect(features.getByRole('link')).toHaveCount(0);
  const cards = main.getByRole('list').filter({ has: page.locator('.subject-card') });
  // Geofag kan være lagt til av et annet prosjekt (serveren deles), så det er minst de tre fagene.
  await expect.poll(() => cards.getByRole('link').count()).toBeGreaterThanOrEqual(3);
  for (const name of ['Fysikk 1', 'Kjemi 1', 'Biologi 1']) {
    await expect(cards.getByRole('link', { name: new RegExp(`^${name}`) })).toBeVisible();
  }
  await expect(main.getByRole('button', { name: 'Legg til fag' })).toBeVisible();
  await page.waitForTimeout(1500);
  expect(new URL(page.url()).pathname).toBe('/');
  await expect(page.locator('html')).not.toHaveAttribute('data-subject', /.+/);

  // Et trykk på et fag → fagsiden, med fagets farger.
  await cards.getByRole('link', { name: /^Kjemi 1/ }).click();
  await expect(page).toHaveURL(/\/fag\//);
  await expect(page.getByRole('heading', { name: 'Kjemi 1', level: 1 })).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('data-subject', 'chemistry');
  // Indre sider beholder den korte fanetittelen.
  await expect(page).toHaveTitle('Kjemi 1 – SmartNotes');

  // Logoen fører tilbake til forsiden (i sidepanelet på store skjermer, i topplinjen på mobil).
  const topbar = page.getByRole('link', { name: 'SmartNotes, til forsiden' });
  if (await topbar.isVisible()) await topbar.click();
  else await page.locator('.sidebar .brand').click();
  await expect(page.getByRole('heading', { name: 'Fagene dine' })).toBeVisible();
  expect(new URL(page.url()).pathname).toBe('/');
  // Snarveien til faget som sist var åpent, uten at siden sender brukeren videre, også etter en ny lasting.
  await expect(main.getByRole('link', { name: 'Fortsett i Kjemi 1' })).toBeVisible();
  // Presentasjonen lenker til visualiseringene og flashcards i det samme faget.
  const vizLink = features.getByRole('link', { name: 'Visualiseringer i Kjemi 1' });
  await expect(vizLink).toHaveAttribute('href', /^\/fag\/[^/]+\/visualiseringer$/);
  await features.getByRole('link', { name: 'Flashcards i Kjemi 1' }).click();
  await expect(page).toHaveURL(/\/fag\/[^/]+\/flashcards$/);
  await page.goBack();
  await expect(main.getByRole('link', { name: 'Fortsett i Kjemi 1' })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Fagene dine' })).toBeVisible();
  await page.waitForTimeout(1000);
  expect(new URL(page.url()).pathname).toBe('/');

  // «Fortsett i …» gjelder også et fag som ble åpnet fra et kapittel (sidepanelet, søket), ikke bare fra fagsiden.
  const biology = await page.evaluate(async () => {
    const res = await fetch('/api/sync?since=0');
    const body = (await res.json()) as { subjects: { id: string; name: string }[]; chapters: { id: string; subjectId: string; title: string }[] };
    const subject = body.subjects.find((s) => s.name === 'Biologi 1')!;
    return { subjectId: subject.id, chapter: body.chapters.find((c) => c.subjectId === subject.id)! };
  });
  await page.goto(`/fag/${biology.subjectId}/kapittel/${biology.chapter.id}`);
  await expect(page.locator('html')).toHaveAttribute('data-subject', 'biology');
  if (await topbar.isVisible()) await topbar.click();
  else await page.locator('.sidebar .brand').click();
  await expect(main.getByRole('link', { name: 'Fortsett i Biologi 1' })).toBeVisible();
  expect(errors).toEqual([]);
});
