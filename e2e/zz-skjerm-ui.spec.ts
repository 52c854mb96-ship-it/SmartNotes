import { expect, test, type Page } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import sharp from 'sharp';
import { openSubjectFromHome } from './helpers';

// Midlertidig: skjermbilder til kontrollen av flervalg (UI, tilgjengelighet og mobil). Slettes etterpå.
const OUT = '/tmp/claude-0/-home-user-SmartNotes/8582f768-388f-54b0-88a3-154112c5f1d0/scratchpad/a2-skjerm/ui';
mkdirSync(OUT, { recursive: true });
const SLOW = { timeout: 90_000 };

async function notePage(title: string): Promise<Buffer> {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="1600">
    <rect width="100%" height="100%" fill="#fbf8ef"/>
    <text x="80" y="160" font-size="64" font-family="serif">${title}</text>
    <text x="80" y="300" font-size="48" font-family="serif">F = m · a</text></svg>`;
  return sharp(Buffer.from(svg)).jpeg().toBuffer();
}

const syncData = (page: Page) =>
  page.evaluate(async () => (await (await fetch('/api/sync?since=0')).json()) as { notes: { id: string; title: string; status: string }[] });

const main = (page: Page) => page.locator('main');
const card = (page: Page) => main(page).locator('.fc-card');
const mode = (page: Page, name: string) => main(page).getByRole('radio', { name, exact: true });
const options = (page: Page) => main(page).getByRole('group', { name: 'Svaralternativer' }).getByRole('button');
const nextButton = (page: Page) => main(page).getByRole('button', { name: 'Neste', exact: true });
const WRONG = ['Feil svar', '5{,}0', '1{,}5', '\\text{kg}'];
const correctIndex = (page: Page) =>
  main(page)
    .locator('.fc-option')
    .evaluateAll((els, wrong) => els.findIndex((el) => !wrong.some((w) => (el.textContent ?? '').includes(w))), WRONG);

let project = '';
async function shot(page: Page, name: string, opts: { full?: boolean } = {}) {
  for (const scheme of ['light', 'dark'] as const) {
    await page.emulateMedia({ colorScheme: scheme });
    await page.waitForTimeout(250);
    await page.screenshot({ path: `${OUT}/${project}-${name}-${scheme === 'light' ? 'lys' : 'mork'}.png`, fullPage: !!opts.full });
  }
  await page.emulateMedia({ colorScheme: 'light' });
}

async function log(page: Page, label: string, fn: () => Promise<unknown>) {
  console.log(`[${project}] ${label}:`, JSON.stringify(await fn()));
}

async function setup(page: Page, title: string) {
  await page.goto('/');
  await page.getByLabel('Passord', { exact: true }).fill('e2e-passord');
  await page.getByRole('button', { name: 'Logg inn' }).click();
  await openSubjectFromHome(page, 'Fysikk 1');
  const subjectId = new URL(page.url()).pathname.split('/')[2]!;
  let note = (await syncData(page)).notes.find((n) => n.title === title);
  if (!note) {
    await page.getByRole('button', { name: 'Last opp notater' }).first().click();
    const dialog = page.getByRole('dialog');
    await dialog.locator('input[type=file]').first().setInputFiles({ name: 'side1.jpg', mimeType: 'image/jpeg', buffer: await notePage(title) });
    await dialog.getByLabel(/Tittel/).fill(title);
    await dialog.getByRole('button', { name: /^Last opp$/ }).click();
    await expect(dialog).toBeHidden();
  }
  await expect
    .poll(async () => {
      note = (await syncData(page)).notes.find((n) => n.title === title);
      return note?.status;
    }, SLOW)
    .toBe('done');
  return { subjectId, noteId: note!.id };
}

async function makeDeck(page: Page, subjectId: string, noteId: string, title: string, withChoices: boolean, snap = false) {
  await page.goto(`/fag/${subjectId}/flashcards/ny?notat=${noteId}`);
  await expect(page.getByRole('heading', { name: 'Ny kortstokk', level: 1 })).toBeVisible();
  await main(page).getByRole('checkbox', { name: new RegExp(`^${title}\\b`) }).check();
  const choices = main(page).getByRole('checkbox', { name: 'Lag også svaralternativer (flervalg)' });
  if (snap) {
    await choices.scrollIntoViewIfNeeded();
    await log(page, 'avkrysning boks', async () => main(page).locator('.fc-new-choices').boundingBox());
    await log(page, 'avkrysning label', async () => main(page).locator('.fc-new-choices .check-row').boundingBox());
    await log(page, 'avkrysning describedby', async () =>
      choices.evaluate((el) => document.getElementById(el.getAttribute('aria-describedby') ?? '')?.textContent),
    );
    await shot(page, '01-ny-kortstokk');
    await choices.check();
    await shot(page, '01b-ny-kortstokk-avkrysset');
    if (!withChoices) await choices.uncheck();
    await shot(page, '01c-ny-kortstokk-hel', { full: true });
  } else if (withChoices) await choices.check();
  await main(page).getByRole('button', { name: 'Lag kortstokk' }).click();
  await expect(page.getByRole('tab', { name: 'Øv' })).toBeVisible(SLOW);
  await expect(card(page)).toBeVisible();
  return page.url().split('/flashcards/')[1]!.split('?')[0]!;
}

test('skjermbilder: flervalg, runde 2', async ({ page }, info) => {
  test.setTimeout(400_000);
  project = info.project.name;
  const desktop = project === 'desktop';
  if (!desktop) await page.setViewportSize({ width: 390, height: 844 });
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const title = `Skjerm2 ${project}`;
  const { subjectId, noteId } = await setup(page, title);
  const deckId = await makeDeck(page, subjectId, noteId, title, true);
  await mode(page, 'Flervalg').click();
  await expect(options(page)).toHaveCount(4);
  await page.waitForTimeout(400);

  const overlap = async (target: ReturnType<typeof options>) =>
    page.evaluate(
      ([o, n]) => {
        if (!o || !n) return null;
        const top = Math.max(o.y, n.y);
        const bottom = Math.min(o.y + o.height, n.y + n.height);
        return { optionTop: Math.round(o.y), optionBottom: Math.round(o.y + o.height), nextTop: Math.round(n.y), covered: Math.max(0, Math.round(bottom - top)), of: Math.round(o.height) };
      },
      [await target.boundingBox(), await nextButton(page).boundingBox()] as const,
    );
  const resultInView = () =>
    main(page).locator('.fc-choice-result').evaluate((e) => {
      const r = e.getBoundingClientRect();
      const bar = document.querySelector('.fc-choice-actions')?.getBoundingClientRect();
      return { top: Math.round(r.top), vh: innerHeight, barTop: bar ? Math.round(bar.top) : null, visible: r.top < (bar?.top ?? innerHeight) };
    });

  // Default rulling (toppen av siden): eleven trykker på det nederste synlige alternativet.
  const last = desktop ? options(page).nth(2) : options(page).nth(0);
  const scrollBefore = await page.evaluate(() => scrollY);
  await last.click();
  console.log(`[${project}] scroll før/etter`, scrollBefore, await page.evaluate(() => scrollY));
  console.log(`[${project}] dekket (standard):`, JSON.stringify(await overlap(last)), JSON.stringify(await resultInView()));
  await shot(page, '30-standard-etter-valg');
  await nextButton(page).click();

  // Angre: kortet uvalgt igjen, fokus på spørsmålet.
  await main(page).getByRole('button', { name: 'Angre forrige' }).click();
  await expect(main(page).locator('.fc-option.is-right')).toHaveCount(0);
  console.log(`[${project}] fokus etter angre:`, await page.evaluate(() => document.activeElement?.className));

  // Mobil: eleven ruller så alle fire alternativene synes nederst i bildet, og trykker på det siste.
  await main(page).getByRole('group', { name: 'Svaralternativer' }).evaluate((e) => e.scrollIntoView({ block: 'end' }));
  await page.waitForTimeout(200);
  const four = options(page).nth(3);
  console.log(`[${project}] før valg, alternativ 4:`, JSON.stringify(await four.boundingBox()), 'vh', page.viewportSize()?.height);
  await four.click({ noWaitAfter: true });
  console.log(`[${project}] dekket (rullet til alternativene):`, JSON.stringify(await overlap(four)), JSON.stringify(await resultInView()));
  await shot(page, '31-rullet-etter-valg');
  await nextButton(page).click();

  // «Lag svaralternativer» når bare forklaringskortet mangler.
  await page.getByRole('tab', { name: 'Alle kort' }).click();
  const panel = main(page).locator('#fc-panel-kort .fc-choices');
  await expect(panel).toContainText('2 av 3 kort har svaralternativer');
  await panel.getByRole('button', { name: 'Lag svaralternativer' }).focus();
  await page.keyboard.press('Enter');
  await page.waitForTimeout(300);
  console.log(`[${project}] fokus etter Lag (tastatur):`, await page.evaluate(() => `${document.activeElement?.tagName}.${document.activeElement?.className}`));
  await expect(panel).not.toContainText('Lager svaralternativer', SLOW);
  console.log(`[${project}] panel etter jobb:`, await panel.innerText());
  console.log(`[${project}] fokus etter jobb:`, await page.evaluate(() => `${document.activeElement?.tagName}.${document.activeElement?.className}`));
  await shot(page, '32-bare-forklaring-mangler');

  // «Lager …» med lukkeknappen ved velgeren.
  await makeDeck(page, subjectId, noteId, title, false);
  await mode(page, 'Flervalg').click({ force: true });
  await page.route('**/api/sync*', async (r) => {
    await new Promise((res) => setTimeout(res, 4000));
    await r.continue().catch(() => {});
  });
  const help = main(page).locator('#fc-panel-ov .fc-choices');
  await help.getByRole('button', { name: 'Lag svaralternativer' }).click();
  await expect(help).toContainText('Lager svaralternativer …');
  await help.getByRole('button', { name: 'Lukk' }).click();
  console.log(`[${project}] etter Lukk på «Lager»:`, await help.count(), await help.getByRole('button', { name: 'Lukk' }).count());
  await shot(page, '33-lager-etter-lukk');
  await page.unroute('**/api/sync*');
  void deckId;
  expect(errors).toEqual([]);
});
