import { expect, test, type Page } from '@playwright/test';
import { openSubjectFromHome } from './helpers';
import sharp from 'sharp';

/**
 * Øvingsformene i flashcards: Klassisk (blar uten å endre nivåene), Rask runde (nivåene i synken, også offline),
 * at formen huskes etter omlasting, Lengde (korte økter på 10 kort) og Luketekst. Falsk Claude lager tre kort per notat:
 * kort 1 har notattittelen i fet skrift (står også i spørsmålet, så det får ingen luke), kort 2 har «nøkkelbegrep» i fet
 * skrift (én luke) og kort 3 har ingen fet tekst. Med «Omtrent 20» lages 20 kort.
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

interface SyncData {
  notes: { id: string; title: string; status: string }[];
  cards: { id: string; deckId: string; level: number; position: number }[];
}

const syncData = (page: Page) => page.evaluate(async () => (await (await fetch('/api/sync?since=0')).json()) as SyncData);

/** Nivåene i kortstokken på serveren, i kortstokkens rekkefølge. */
const serverLevels = async (page: Page, deckId: string) =>
  (await syncData(page)).cards
    .filter((c) => c.deckId === deckId)
    .sort((a, b) => a.position - b.position)
    .map((c) => c.level);

/** Økta slik den er lagret på enheten (tabellen `practice` i IndexedDB), så omlastingen ikke kommer før lagringen. */
const savedPractice = (page: Page, deckId: string) =>
  page.evaluate(
    (id) =>
      new Promise<{ mode?: string; pass?: { index: number; marked: string[] } } | null>((resolve, reject) => {
        const open = indexedDB.open('smartnotes');
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const req = open.result.transaction('practice').objectStore('practice').get(id);
          req.onsuccess = () => {
            resolve(req.result ?? null);
            open.result.close();
          };
          req.onerror = () => reject(req.error);
        };
      }),
    deckId,
  );

const main = (page: Page) => page.locator('main');
const card = (page: Page) => main(page).locator('.fc-card');
const mode = (page: Page, name: string) => main(page).getByRole('radio', { name, exact: true });
const flip = (page: Page) => card(page).getByRole('button', { name: 'Trykk for å snu kortet' }).click();
const knew = (page: Page) => main(page).getByRole('button', { name: /^Kunne(?!\s*ikke)/ });
const didNotKnow = (page: Page) => main(page).getByRole('button', { name: /^Kunne ikke/ });
const firstQuestion = (title: string) => `Hva handler notatet «${title}» om?`;

/** Logger inn og gir notatet `title` (lastes opp og konverteres første gang) og faget det ligger i. */
async function setup(page: Page, title: string): Promise<{ subjectId: string; noteId: string }> {
  await page.goto('/');
  await expect(page).toHaveURL(/logg-inn/);
  await page.getByLabel('Passord', { exact: true }).fill(PASSWORD);
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

/** En ny kortstokk fra notatet `title` (med «Omtrent `count`» kort), åpnet på fanen «Øv». Gir id-en. */
async function makeDeck(page: Page, subjectId: string, noteId: string, title: string, count?: number): Promise<string> {
  await page.goto(`/fag/${subjectId}/flashcards/ny?notat=${noteId}`);
  await expect(page.getByRole('heading', { name: 'Ny kortstokk', level: 1 })).toBeVisible();
  // Forhåndsvalget gjelder bare notater enheten alt vet er ferdige; et notat som nettopp ble ferdig, velges for hånd.
  await main(page).getByRole('checkbox', { name: new RegExp(`^${title}\\b`) }).check();
  await expect(main(page).getByText('1 notat valgt')).toBeVisible();
  if (count) await main(page).getByRole('radio', { name: `Omtrent ${count}` }).click();
  await main(page).getByRole('button', { name: 'Lag kortstokk' }).click();
  await expect(page.getByRole('tab', { name: 'Øv' })).toBeVisible(SLOW);
  await expect(card(page)).toBeVisible();
  return page.url().split('/flashcards/')[1]!.split('?')[0]!;
}

const noteTitle = (project: string) => `Former ${project}`;

test.describe('flashcards: øvingsformer', () => {
  let errors: string[] = [];
  test.beforeEach(({ page }) => {
    errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
  });
  test.afterEach(() => {
    expect(errors).toEqual([]);
  });

  test('Klassisk: bla, merk og gå videre til en rask runde, uten å endre nivåene', async ({ page }, info) => {
    const title = noteTitle(info.project.name);
    const { subjectId, noteId } = await setup(page, title);
    const deckId = await makeDeck(page, subjectId, noteId, title);

    // Mestring er standard, med «Lengde».
    await expect(mode(page, 'Mestring')).toHaveAttribute('aria-checked', 'true');
    await expect(main(page).getByLabel('Lengde')).toBeVisible();

    await mode(page, 'Klassisk').click();
    await expect(mode(page, 'Klassisk')).toHaveAttribute('aria-checked', 'true');
    await expect(main(page).getByText('Snu og gå videre. Endrer ikke mestringen.')).toBeVisible();
    await expect(main(page).getByLabel('Lengde')).toHaveCount(0);
    await expect(main(page).getByText('Kort 1 av 3')).toBeVisible();
    await expect(main(page).getByText(/^Rekke \d/)).toHaveCount(0);
    await expect(card(page)).toContainText(firstQuestion(title));
    await expect(card(page)).toContainText('Svar i hodet før du snur.');

    // Snu og merk det første kortet.
    await flip(page);
    await expect(card(page).locator('.fc-answer')).toContainText(title);
    const markButton = main(page).getByRole('button', { name: 'Merk', exact: true });
    await markButton.click();
    await expect(markButton).toHaveAttribute('aria-pressed', 'true');
    await expect(card(page).getByText('Merket', { exact: true })).toBeVisible();

    // Neste og Forrige: kortet vises med spørsmålet, og merket står.
    await main(page).getByRole('button', { name: 'Neste', exact: true }).click();
    await expect(main(page).getByText('Kort 2 av 3')).toBeVisible();
    await expect(card(page)).toContainText('Forklar hovedideen');
    await expect(card(page).locator('.fc-answer')).toHaveCount(0);
    await expect(markButton).toHaveAttribute('aria-pressed', 'false');
    await main(page).getByRole('button', { name: 'Forrige', exact: true }).click();
    await expect(main(page).getByText('Kort 1 av 3')).toBeVisible();
    await expect(markButton).toHaveAttribute('aria-pressed', 'true');

    if (info.project.name === 'desktop') {
      // Tastaturet: høyre pil er neste kort, M merker og fjerner merket.
      await page.keyboard.press('ArrowRight');
      await expect(main(page).getByText('Kort 2 av 3')).toBeVisible();
      await page.keyboard.press('m');
      await expect(markButton).toHaveAttribute('aria-pressed', 'true');
      await page.keyboard.press('m');
      await expect(markButton).toHaveAttribute('aria-pressed', 'false');
      await page.keyboard.press('ArrowLeft');
      await expect(main(page).getByText('Kort 1 av 3')).toBeVisible();
    }

    for (let i = 0; i < 3; i++) await main(page).getByRole('button', { name: 'Neste', exact: true }).click();
    await expect(main(page).getByRole('heading', { name: 'Du har gått gjennom 3 kort' })).toBeVisible();
    await expect(main(page).getByRole('button', { name: /Bla gjennom på nytt/ })).toBeVisible();
    await expect(main(page).getByRole('button', { name: /Bytt til mestring/ })).toBeVisible();
    expect(await serverLevels(page, deckId)).toEqual([0, 0, 0]);

    // Det merkede kortet går rett til en rask runde.
    await main(page).getByRole('button', { name: /Rask runde med det merkede kortet/ }).click();
    await expect(mode(page, 'Rask runde')).toHaveAttribute('aria-checked', 'true');
    await expect(main(page).getByText('Repetisjon av 1 kort')).toBeVisible();
    await expect(main(page).getByText('Igjen 1 av 1')).toBeVisible();
    await expect(card(page)).toContainText(firstQuestion(title));
    expect(await serverLevels(page, deckId)).toEqual([0, 0, 0]);
  });

  test('Rask runde: «Kunne ikke» kommer igjen til slutt, og nivåene synkes', async ({ page }, info) => {
    const title = noteTitle(info.project.name);
    const { subjectId, noteId } = await setup(page, title);
    const deckId = await makeDeck(page, subjectId, noteId, title);

    await mode(page, 'Rask runde').click();
    await expect(main(page).getByText('Ett riktig svar per kort. Kortene du ikke kunne, kommer igjen til slutt.')).toBeVisible();
    await expect(main(page).getByText('Igjen 3 av 3')).toBeVisible();
    await expect(main(page).getByText('Rekke 0')).toBeVisible();
    await expect(knew(page)).toBeDisabled();

    await flip(page);
    await didNotKnow(page).click();
    await expect(main(page).getByText('Tilbake til nivå 0. Kortet kommer igjen til slutt.')).toBeVisible();
    await expect(main(page).getByText('Igjen 3 av 3')).toBeVisible();
    await expect(card(page)).toContainText('Forklar hovedideen');

    await flip(page);
    await knew(page).click();
    await expect(main(page).getByText('Nivå 1 av 3. Kortet er ferdig for denne runden.')).toBeVisible();
    await expect(main(page).getByText('Rekke 1')).toBeVisible();
    await expect(main(page).getByText('Igjen 2 av 3')).toBeVisible();
    await expect(card(page)).toContainText('regn ut');

    if (info.project.name === 'desktop') {
      // Tastaturet: mellomrom snur, høyre pil er «Kunne».
      await page.keyboard.press(' ');
      await expect(card(page).locator('.fc-answer')).toBeVisible();
      await page.keyboard.press('ArrowRight');
    } else {
      await flip(page);
      await knew(page).click();
    }
    // Kortet jeg ikke kunne, kommer igjen til slutt.
    await expect(main(page).getByText('Igjen 1 av 3')).toBeVisible();
    await expect(card(page)).toContainText(firstQuestion(title));
    await flip(page);
    await knew(page).click();

    await expect(main(page).getByRole('heading', { name: '2 av 3 kunne du med en gang' })).toBeVisible();
    await expect(main(page).getByRole('button', { name: /De du ikke kunne/ })).toBeVisible();
    await expect(main(page).getByRole('button', { name: /Øv dem med mestring/ })).toBeVisible();
    await expect(main(page).getByRole('button', { name: /Ny rask runde med alle/ })).toBeVisible();
    await expect.poll(() => serverLevels(page, deckId), SLOW).toEqual([1, 1, 1]);

    // En ny rask runde nullstiller ikke nivåene.
    await main(page).getByRole('button', { name: /Ny rask runde med alle/ }).click();
    await expect(main(page).getByText('Igjen 3 av 3')).toBeVisible();
    await expect(card(page).getByRole('img', { name: 'Nivå 1 av 3' })).toBeVisible();
  });

  test('formen huskes etter omlasting', async ({ page }, info) => {
    const title = noteTitle(info.project.name);
    const { subjectId, noteId } = await setup(page, title);
    const deckId = await makeDeck(page, subjectId, noteId, title);

    await mode(page, 'Klassisk').click();
    await main(page).getByRole('button', { name: 'Neste', exact: true }).click();
    await main(page).getByRole('button', { name: 'Merk', exact: true }).click();
    await expect(main(page).getByText('Kort 2 av 3')).toBeVisible();
    await expect.poll(async () => (await savedPractice(page, deckId))?.pass).toMatchObject({ index: 1, marked: [expect.any(String)] });

    await page.reload();
    await expect(mode(page, 'Klassisk')).toHaveAttribute('aria-checked', 'true');
    await expect(main(page).getByText('Kort 2 av 3')).toBeVisible();
    await expect(main(page).getByRole('button', { name: 'Merk', exact: true })).toHaveAttribute('aria-pressed', 'true');

    await mode(page, 'Rask runde').click();
    await expect(main(page).getByText('Igjen 3 av 3')).toBeVisible();
    await expect.poll(async () => (await savedPractice(page, deckId))?.mode).toBe('quick');
    await page.reload();
    await expect(mode(page, 'Rask runde')).toHaveAttribute('aria-checked', 'true');
    await expect(main(page).getByText('Igjen 3 av 3')).toBeVisible();
  });

  test('Rask runde offline: fremgangen kommer fram når nettet er tilbake', async ({ page, context }, info) => {
    const title = noteTitle(info.project.name);
    const { subjectId, noteId } = await setup(page, title);
    const deckId = await makeDeck(page, subjectId, noteId, title);
    await mode(page, 'Rask runde').click();

    await context.setOffline(true);
    for (let i = 0; i < 3; i++) {
      await flip(page);
      await knew(page).click();
    }
    await expect(main(page).getByRole('heading', { name: '3 av 3 kunne du med en gang' })).toBeVisible();
    await expect(main(page).getByText('Kortene du kunne, gikk ett nivå opp.', { exact: false })).toBeVisible();

    await context.setOffline(false);
    await expect.poll(() => serverLevels(page, deckId), SLOW).toEqual([1, 1, 1]);
  });

  test('Lengde: økter på 10 kort og «Neste 10 kort»', async ({ page }, info) => {
    const title = noteTitle(info.project.name);
    const { subjectId, noteId } = await setup(page, title);
    const deckId = await makeDeck(page, subjectId, noteId, title, 20);
    await expect(main(page).getByText('0 av 20 mestret')).toBeVisible();

    // Mestring: de ti første som ikke er mestret.
    await main(page).getByLabel('Lengde').selectOption('10');
    await expect(main(page).getByText('Økt på 10 kort')).toBeVisible();
    await expect(main(page).getByText('0 av 10 mestret')).toBeVisible();

    // Rask runde beholder lengden.
    await mode(page, 'Rask runde').click();
    await expect(main(page).getByText('Økt på 10 kort')).toBeVisible();
    await expect(main(page).getByText('Igjen 10 av 10')).toBeVisible();
    await expect(card(page)).toContainText(firstQuestion(title));
    for (let i = 0; i < 10; i++) {
      await flip(page);
      await knew(page).click();
    }
    await expect(main(page).getByRole('heading', { name: '10 av 10 kunne du med en gang' })).toBeVisible();
    const next = main(page).getByRole('button', { name: /^Neste 10 kort/ });
    await expect(main(page).locator('.fc-repeat-btn').first()).toHaveText(/^Neste 10 kort/);
    await expect
      .poll(async () => (await serverLevels(page, deckId)).join(''), SLOW)
      .toBe('1'.repeat(10) + '0'.repeat(10));

    // De ti neste: kort 11 er kort 2 fra notatet i fjerde omgang.
    await next.click();
    await expect(main(page).getByText('Økt på 10 kort')).toBeVisible();
    await expect(main(page).getByText('Igjen 10 av 10')).toBeVisible();
    await expect(card(page)).toContainText('Forklar hovedideen');
    await expect(card(page)).toContainText('(4)');

    // Tilbake til hele utvalget: lengden blir «Alle kort».
    await main(page).getByRole('button', { name: 'Tilbake til hele utvalget' }).click();
    await expect(main(page).getByText('Igjen 20 av 20')).toBeVisible();
    await expect(main(page).getByLabel('Lengde')).toHaveValue('');
    await expect(main(page).getByText('Økt på 10 kort')).toHaveCount(0);
  });

  test('Luketekst: skriv begrepet, «Jeg hadde rett» og kort uten luke', async ({ page }, info) => {
    const title = noteTitle(info.project.name);
    const { subjectId, noteId } = await setup(page, title);
    const deckId = await makeDeck(page, subjectId, noteId, title);
    await mode(page, 'Luketekst').click();
    await expect(main(page).getByText(/Skriv begrepet som mangler i svaret/)).toBeVisible();

    // Kort 1: tittelen står i spørsmålet, så kortet vises med to knapper som i Rask runde.
    await expect(card(page)).toContainText(firstQuestion(title));
    await expect(main(page).getByRole('textbox', { name: 'Begrepet som mangler' })).toHaveCount(0);
    await flip(page);
    await knew(page).click();

    // Kort 2: «nøkkelbegrep» er byttet ut med et felt.
    const field = main(page).getByRole('textbox', { name: 'Begrepet som mangler' });
    await expect(field).toBeVisible();
    await expect(card(page)).toContainText('Forklar hovedideen');
    await expect(card(page)).toContainText('Andre punkt med');
    await expect(card(page)).not.toContainText('nøkkelbegrep');
    await expect(field).toHaveAttribute('autocapitalize', 'off');
    await expect(field).toHaveAttribute('autocorrect', 'off');
    await expect(field).toHaveAttribute('spellcheck', 'false');
    await expect(field).toHaveAttribute('enterkeyhint', 'done');
    // Fokus står i feltet etter forrige kort, og et klikk i feltet snur ikke kortet.
    await expect(field).toBeFocused();
    await field.click();
    await expect(field).toBeFocused();
    await expect(field).toBeVisible();

    await field.fill('feil');
    await field.press('Enter');
    await expect(field).toHaveClass(/is-wrong/);
    await expect(main(page).getByText('Ikke riktig. Fasit: nøkkelbegrep.')).toBeVisible();
    await expect(card(page).locator('.fc-gap-answer')).toHaveText('nøkkelbegrep');
    await main(page).getByRole('button', { name: 'Jeg hadde rett' }).click();
    await expect(field).toHaveClass(/is-right/);
    await expect(main(page).getByText('Riktig.', { exact: true })).toBeVisible();
    await main(page).getByRole('button', { name: 'Neste', exact: true }).click();
    await expect(main(page).getByText('Nivå 1 av 3. Kortet er ferdig for denne runden.')).toBeVisible();

    // Kort 3: ingen fet tekst, to knapper.
    await expect(card(page)).toContainText('regn ut');
    await flip(page);
    await knew(page).click();
    await expect(main(page).getByRole('heading', { name: '3 av 3 kunne du med en gang' })).toBeVisible();
    await expect.poll(() => serverLevels(page, deckId), SLOW).toEqual([1, 1, 1]);

    // En ny runde: en endelse godtas, og Enter går videre fra «Neste».
    await main(page).getByRole('button', { name: /Ny runde med alle/ }).click();
    await flip(page);
    await knew(page).click();
    await expect(field).toBeFocused();
    await field.fill('Nøkkelbegrepet');
    await field.press('Enter');
    await expect(field).toHaveClass(/is-right/);
    await expect(main(page).getByRole('button', { name: 'Neste', exact: true })).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(card(page)).toContainText('regn ut');
    // Luketekst gjør aldri et kort mestret: kort 2 blir på nivå 1.
    await expect.poll(async () => (await serverLevels(page, deckId))[1], SLOW).toBe(1);
  });
});
