import { expect, test, type Page } from '@playwright/test';

/**
 * Flere fag: Kjemi 1 og Biologi 1 legges inn ved oppstart med eget fargetema. Delkapitlene som mangler, kan legges inn
 * fra innholdsfortegnelsen, og falsk Claude kobler dem til kompetansemålene.
 */

const PASSWORD = 'e2e-passord';

async function login(page: Page): Promise<void> {
  await page.goto('/');
  await expect(page).toHaveURL(/logg-inn/);
  await page.getByLabel('Passord', { exact: true }).fill(PASSWORD);
  await page.getByRole('button', { name: 'Logg inn' }).click();
  await expect(page.getByRole('heading', { name: 'Fysikk', level: 1 })).toBeVisible();
}

async function subjectId(page: Page, name: string): Promise<string> {
  const subjects = await page.evaluate(async () => {
    const res = await fetch('/api/sync?since=0');
    return ((await res.json()) as { subjects: { id: string; name: string }[] }).subjects;
  });
  const s = subjects.find((x) => x.name === name);
  expect(s, `faget ${name}`).toBeTruthy();
  return s!.id;
}

test('kjemi og biologi: fargetema, forslag om delkapitler og import av innholdsfortegnelsen', async ({ page }, info) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await login(page);
  await expect(page.locator('html')).not.toHaveAttribute('data-subject', /.+/);

  const kjemi = await subjectId(page, 'Kjemi 1');
  await page.goto(`/fag/${kjemi}`);
  await expect(page.getByRole('heading', { name: 'Kjemi 1', level: 1 })).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('data-subject', 'chemistry');
  await expect(page.locator('main').getByText('Kjemi 1 (Aschehoug)', { exact: true })).toBeVisible();

  // Kapittel 2–8 har ingen delkapitler, så fagsiden foreslår å importere innholdsfortegnelsen.
  const hint = page.getByRole('complementary', { name: 'Delkapitler mangler' });
  await expect(hint).toBeVisible();
  await hint.getByRole('link', { name: 'Importer innholdsfortegnelsen' }).click();
  await expect(page).toHaveURL(/innstillinger#innholdsfortegnelse$/);
  const card = page.locator('#innholdsfortegnelse');
  await expect(card.getByRole('tab', { name: /Ta bilde/ })).toHaveAttribute('aria-selected', 'true');

  // Hvert prosjekt oppdaterer sitt eget kapittel (serveren deles mellom prosjektene).
  const ch = info.project.name === 'desktop' ? '2' : '3';
  await card.getByRole('tab', { name: /Lim inn tekst/ }).click();
  await card.locator('textarea').fill(`${ch} Nytt navn fra boka\n${ch}.1 Første del\n${ch}.2 Andre del`);
  await card.getByRole('button', { name: 'Tolk teksten' }).click();
  await expect(card.getByText('Oppdateres')).toBeVisible();
  await card.locator('summary', { hasText: '2 delkapitler' }).click();
  // Falsk Claude kobler delkapitlene til det første målet som ikke går på tvers av kapitlene (KM6 i Kjemi 1).
  await expect(card.getByText('KM6').first()).toBeVisible();
  await card.getByRole('button', { name: 'Oppdater 1 kapittel' }).click();
  await expect(page.getByText('1 kapittel er oppdatert.')).toBeVisible();
  await expect
    .poll(async () =>
      page.evaluate(async (no) => {
        const res = await fetch('/api/sync?since=0');
        const data = (await res.json()) as { chapters: { number: string | null; title: string; sections: { code: string; aims: string[] }[]; subjectId: string }[] };
        return data.chapters
          .filter((c) => c.number === no && c.title.startsWith('Nytt navn'))
          .map((c) => `${c.title}: ${c.sections.map((x) => `${x.code}/${x.aims.join('+')}`).join(', ')}`);
      }, ch),
    )
    .toEqual([`Nytt navn fra boka: ${ch}.1/KM6, ${ch}.2/KM6`]);

  const bio = await subjectId(page, 'Biologi 1');
  await page.goto(`/fag/${bio}`);
  await expect(page.getByRole('heading', { name: 'Biologi 1', level: 1 })).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('data-subject', 'biology');
  await expect(page.getByRole('complementary', { name: 'Delkapitler mangler' })).toContainText('Kapitlene har ingen delkapitler ennå.');

  expect(errors).toEqual([]);
});
