import { expect, test, type Page } from '@playwright/test';
import sharp from 'sharp';

/**
 * Flashcards: kortstokk fra et notat (falsk Claude), øving med vurdering 1–4, angring, øving offline med fremgang som
 * synkes når nettet er tilbake, repetisjon av kortene man ikke kunne, og redigering og sletting av kort.
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

interface SyncData {
  notes: { id: string; title: string; status: string }[];
  decks: { id: string; title: string; status: string }[];
  cards: { id: string; deckId: string; level: number; front: string }[];
}

const syncData = (page: Page) =>
  page.evaluate(async () => (await (await fetch('/api/sync?since=0')).json()) as SyncData);

const main = (page: Page) => page.locator('main');

test('flashcards: lag, øv (også offline), repeter og rediger', async ({ page, context }, info) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await login(page);

  // 1) Et konvertert notat.
  const title = `Krefter ${info.project.name}`;
  await page.getByRole('button', { name: 'Last opp notater' }).first().click();
  const dialog = page.getByRole('dialog');
  await dialog.locator('input[type=file]').first().setInputFiles({ name: 'side1.jpg', mimeType: 'image/jpeg', buffer: await notePage(title) });
  await dialog.getByLabel(/Tittel/).fill(title);
  await dialog.getByRole('button', { name: /^Last opp$/ }).click();
  await expect(dialog).toBeHidden();
  let noteId = '';
  await expect
    .poll(async () => {
      const n = (await syncData(page)).notes.find((x) => x.title === title);
      noteId = n?.id ?? '';
      return n?.status;
    }, SLOW)
    .toBe('done');

  // 2) «Lag flashcards» fra notatet: notatet er valgt på forhånd.
  await page.goto(`/notat/${noteId}`);
  await page.getByRole('button', { name: 'Flere valg' }).click();
  await page.getByRole('menuitem', { name: 'Lag flashcards' }).click();
  await expect(page.getByRole('heading', { name: 'Ny kortstokk', level: 1 })).toBeVisible();
  await expect(main(page).getByText('1 notat valgt')).toBeVisible();
  await expect(main(page).getByRole('checkbox', { name: new RegExp(title) })).toBeChecked();
  await main(page).getByText('Vanskelig', { exact: true }).click();
  await main(page).getByRole('button', { name: 'Lag kortstokk' }).click();

  // 3) Kortene lages i bakgrunnen.
  await expect(page.getByRole('heading', { name: title, level: 1 })).toBeVisible();
  await expect(page.getByRole('tab', { name: 'Øv' })).toBeVisible(SLOW);
  await expect(main(page).getByText('0 av 3 mestret')).toBeVisible();

  const card = main(page).locator('.fc-card');
  const rateButton = (name: string) => main(page).getByRole('button', { name: new RegExp(`^${name}`) });
  await expect(card).toContainText(`Hva handler notatet «${title}» om?`);
  await expect(rateButton('Perfekt')).toBeDisabled();

  // Snu kortet: svaret vises med formel (KaTeX) og detaljert forklaring.
  await card.getByRole('button', { name: 'Trykk for å snu kortet' }).click();
  await expect(card.locator('.fc-answer')).toContainText(title);
  await expect(card.locator('.fc-answer .katex').first()).toBeVisible();
  await card.getByRole('button', { name: 'Detaljert forklaring' }).click();
  await expect(card.locator('.fc-detail')).toContainText('huskelapp');

  // Perfekt → nivå 2, og kortet kommer tilbake etter de to andre.
  await rateButton('Perfekt').click();
  await expect(main(page).getByText('Nivå 2 av 3. Kortet kommer tilbake om 2 kort.')).toBeVisible();
  await expect(card).toContainText('Forklar hovedideen');
  await expect(main(page).getByText('Rekke 1')).toBeVisible();

  // Angre: forrige kort er tilbake, snudd.
  await main(page).getByRole('button', { name: 'Angre forrige' }).click();
  await expect(main(page).getByText('Angret.')).toBeVisible();
  await expect(card).toContainText(`Hva handler notatet «${title}» om?`);
  await expect(card.locator('.fc-answer')).toBeVisible();

  // 4) Offline: øv til alt er mestret. Første kort er «Feil» én gang, resten «Perfekt».
  await context.setOffline(true);
  const first = `Hva handler notatet «${title}» om?`;
  let missed = false;
  for (let i = 0; i < 12; i++) {
    if (await main(page).getByText('Alt i dette utvalget er mestret').isVisible()) break;
    if (!(await card.locator('.fc-answer').isVisible())) await card.getByRole('button', { name: 'Trykk for å snu kortet' }).click();
    const isFirst = (await card.locator('.fc-question').innerText()).includes(first);
    if (isFirst && !missed) {
      missed = true;
      await rateButton('Feil').click();
    } else {
      await rateButton('Perfekt').click();
    }
  }
  await expect(main(page).getByRole('heading', { name: 'Alt i dette utvalget er mestret' })).toBeVisible();
  await expect(main(page).getByText('3 av 3 mestret')).toBeVisible();
  const deckId = page.url().split('/flashcards/')[1]!.split('?')[0]!;

  // 5) Tilbake på nett: fremgangen kommer fram til serveren.
  await context.setOffline(false);
  await expect
    .poll(async () => (await syncData(page)).cards.filter((c) => c.deckId === deckId).map((c) => c.level), SLOW)
    .toEqual([3, 3, 3]);

  // 6) Repeter bare kortet jeg ikke kunne.
  await main(page).getByRole('button', { name: /De du ikke kunne/ }).click();
  await expect(main(page).getByText('Repetisjon av 1 kort')).toBeVisible();
  await expect(main(page).getByText('0 av 1 mestret')).toBeVisible();
  await expect(card).toContainText(first);

  // 7) Alle kort: rediger og slett.
  await page.getByRole('tab', { name: 'Alle kort' }).click();
  const items = main(page).locator('details.fc-item');
  await expect(items).toHaveCount(3);
  await items.nth(1).locator('summary').click();
  await items.nth(1).getByRole('button', { name: 'Rediger' }).click();
  const editor = page.getByRole('dialog', { name: 'Rediger kortet' });
  await editor.getByLabel('Spørsmål').fill('Hva sier Newtons andre lov?');
  await editor.getByLabel('Svar').fill('**Kraftsum** gir akselerasjon\n$\\sum F = m a$');
  await expect(editor.locator('.fc-preview .katex').first()).toBeVisible();
  await editor.getByRole('button', { name: 'Lagre' }).click();
  await expect(editor).toBeHidden();
  await expect(items.nth(1).locator('summary')).toContainText('Hva sier Newtons andre lov?');

  await items.nth(2).locator('summary').click();
  await items.nth(2).getByRole('button', { name: 'Slett' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Slett' }).click();
  await expect(items).toHaveCount(2);
  await expect
    .poll(async () => (await syncData(page)).cards.filter((c) => c.deckId === deckId).map((c) => c.front))
    .toContain('Hva sier Newtons andre lov?');

  // 8) Oversikten viser kortstokken.
  await page.goto(page.url().split('/flashcards/')[0] + '/flashcards');
  await expect(main(page).getByRole('link', { name: new RegExp(title) })).toContainText('2 kort');

  expect(errors).toEqual([]);
});
