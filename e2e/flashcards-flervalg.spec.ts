import { expect, test, type Page } from '@playwright/test';
import { openSubjectFromHome } from './helpers';
import sharp from 'sharp';

/**
 * Flervalg i flashcards. Svaralternativene lages bare når eleven ber om det: med avkrysningen på «Ny kortstokk» eller
 * med «Lag svaralternativer» på en kortstokk som finnes. Falsk Claude lager tre kort per notat: begrepskortet (svaret er
 * notattittelen, de gale er «Feil svar A–C»), forklaringskortet (ingen alternativer, øves som i Rask runde) og regnekortet
 * (riktig $6{,}0\ \text{N}$, gale $5{,}0\ \text{N}$, $1{,}5\ \text{N}$ og $6{,}0\ \text{kg}$). For en kortstokk som finnes,
 * er det riktige svaret den første svarlinjen, og et kort med «FEIL» i spørsmålet gir en feil.
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

interface Choices {
  correct: string;
  wrong: string[];
}

interface SyncData {
  notes: { id: string; title: string; status: string }[];
  decks: { id: string; choicesStatus: string | null; choicesError: string | null }[];
  cards: { id: string; deckId: string; level: number; position: number; front: string; choices: Choices | null; choicesDeclined: boolean }[];
}

const syncData = (page: Page) => page.evaluate(async () => (await (await fetch('/api/sync?since=0')).json()) as SyncData);

/** Kortene i kortstokken på serveren, i kortstokkens rekkefølge. */
const serverCards = async (page: Page, deckId: string) =>
  (await syncData(page)).cards.filter((c) => c.deckId === deckId).sort((a, b) => a.position - b.position);
const serverLevels = async (page: Page, deckId: string) => (await serverCards(page, deckId)).map((c) => c.level);

/** Økta slik den er lagret på enheten, så omlastingen ikke kommer før lagringen. */
const savedMode = (page: Page, deckId: string) =>
  page.evaluate(
    (id) =>
      new Promise<string | null>((resolve, reject) => {
        const open = indexedDB.open('smartnotes');
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const req = open.result.transaction('practice').objectStore('practice').get(id);
          req.onsuccess = () => {
            resolve((req.result as { mode?: string } | undefined)?.mode ?? null);
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
const options = (page: Page) => main(page).getByRole('group', { name: 'Svaralternativer' }).getByRole('button');
const nextButton = (page: Page) => main(page).getByRole('button', { name: 'Neste', exact: true });
const firstQuestion = (title: string) => `Hva handler notatet «${title}» om?`;

/**
 * Ruller så alternativet står rett over linja med resultatet og «Neste» nederst i bildet: det nederste eleven kan trykke
 * på uten å rulle videre.
 */
const scrollAboveBar = (page: Page, option: ReturnType<typeof options>) =>
  option.evaluate((el) => {
    const bar = document.querySelector('.fc-choice-actions');
    if (bar) window.scrollBy(0, el.getBoundingClientRect().bottom - bar.getBoundingClientRect().top + 2);
  });

/** Om punktet midt i elementet hører til elementet selv (ikke dekket av linja nederst eller noe annet). */
const uncovered = (option: ReturnType<typeof options>) =>
  option.evaluate((el) => {
    const r = el.getBoundingClientRect();
    return el.contains(document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2));
  });

/** De gale svarene fra falsk Claude (i teksten til alternativet, også LaTeX-koden som KaTeX legger ved). */
const WRONG = ['Feil svar', '5{,}0', '1{,}5', '\\text{kg}'];
/** Plassen (0–3) til det riktige alternativet på kortet som vises. */
const correctIndex = (page: Page) =>
  main(page)
    .locator('.fc-option')
    .evaluateAll((els, wrong) => els.findIndex((el) => !wrong.some((w) => (el.textContent ?? '').includes(w))), WRONG);

/** Svarer riktig på kortet som vises: det riktige alternativet og «Neste», eller «Kunne» for et kort uten alternativer. */
async function answerRight(page: Page): Promise<void> {
  await expect(card(page)).toBeVisible();
  if ((await options(page).count()) > 0) {
    await options(page).nth(await correctIndex(page)).click();
    await nextButton(page).click();
  } else {
    await flip(page);
    await knew(page).click();
  }
}

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

/** En ny kortstokk fra notatet `title`, med eller uten svaralternativer, åpnet på fanen «Øv». Gir id-en. */
async function makeDeck(page: Page, subjectId: string, noteId: string, title: string, withChoices: boolean): Promise<string> {
  await page.goto(`/fag/${subjectId}/flashcards/ny?notat=${noteId}`);
  await expect(page.getByRole('heading', { name: 'Ny kortstokk', level: 1 })).toBeVisible();
  await main(page).getByRole('checkbox', { name: new RegExp(`^${title}\\b`) }).check();
  await expect(main(page).getByText('1 notat valgt')).toBeVisible();
  // Svaralternativer er av som standard.
  const choices = main(page).getByRole('checkbox', { name: 'Lag også svaralternativer (flervalg)' });
  await expect(choices).not.toBeChecked();
  await expect(main(page).getByText('Claude lager tre gale svar som ligner det riktige. Det tar litt lenger tid.')).toBeVisible();
  if (withChoices) await choices.check();
  await main(page).getByRole('button', { name: 'Lag kortstokk' }).click();
  await expect(page.getByRole('tab', { name: 'Øv' })).toBeVisible(SLOW);
  await expect(card(page)).toBeVisible();
  return page.url().split('/flashcards/')[1]!.split('?')[0]!;
}

const noteTitle = (project: string) => `Flervalg ${project}`;

test.describe('flashcards: flervalg', () => {
  let errors: string[] = [];
  test.beforeEach(({ page }) => {
    errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
  });
  test.afterEach(() => {
    expect(errors).toEqual([]);
  });

  test('ny kortstokk med svaralternativer: en runde med ett galt svar, nivåene og høyst nivå 2', async ({ page }, info) => {
    const title = noteTitle(info.project.name);
    const desktop = info.project.name === 'desktop';
    const { subjectId, noteId } = await setup(page, title);
    const deckId = await makeDeck(page, subjectId, noteId, title, true);

    // Begreps- og regnekortet har svaralternativer, forklaringskortet ikke.
    const cards = await serverCards(page, deckId);
    expect(cards.map((c) => c.choices)).toEqual([
      { correct: title, wrong: ['Feil svar A', 'Feil svar B', 'Feil svar C'] },
      null,
      { correct: '$6{,}0\\ \\text{N}$', wrong: ['$5{,}0\\ \\text{N}$', '$1{,}5\\ \\text{N}$', '$6{,}0\\ \\text{kg}$'] },
    ]);

    // Flervalg står sist i velgeren og kan velges.
    await expect(main(page).getByRole('radiogroup', { name: 'Øvingsform' }).getByRole('radio').last()).toHaveAccessibleName('Flervalg');
    await expect(mode(page, 'Flervalg')).not.toHaveAttribute('aria-disabled', 'true');
    await mode(page, 'Flervalg').click();
    await expect(mode(page, 'Flervalg')).toHaveAttribute('aria-checked', 'true');
    await expect(main(page).getByText(/^Velg det riktige av fire svar\./)).toBeVisible();
    await expect(main(page).getByText('Igjen 3 av 3')).toBeVisible();

    // Kort 1: spørsmålet og fire alternativer, under hverandre på mobil og to og to på PC, med store trykkflater.
    await expect(card(page)).toContainText(firstQuestion(title));
    await expect(options(page)).toHaveCount(4);
    const boxes = await Promise.all([0, 1, 2, 3].map((i) => options(page).nth(i).boundingBox()));
    for (const b of boxes) expect(b?.height ?? 0).toBeGreaterThanOrEqual(44);
    if (desktop) {
      expect(Math.abs((boxes[0]?.y ?? 0) - (boxes[1]?.y ?? 99))).toBeLessThan(2);
      expect(Math.abs((boxes[0]?.x ?? 0) - (boxes[2]?.x ?? 99))).toBeLessThan(2);
    } else {
      for (const b of boxes) expect(Math.abs((b?.x ?? 0) - (boxes[0]?.x ?? 99))).toBeLessThan(2);
      expect(boxes[1]!.y).toBeGreaterThan(boxes[0]!.y + boxes[0]!.height - 1);
    }

    // Rekkefølgen er fast for kortet og runden: den samme etter omlasting.
    const order = await main(page).locator('.fc-option-text').allInnerTexts();
    expect([...order].sort()).toEqual(['Feil svar A', 'Feil svar B', 'Feil svar C', title]);
    await expect.poll(() => savedMode(page, deckId)).toBe('choice');
    await page.reload();
    await expect(mode(page, 'Flervalg')).toHaveAttribute('aria-checked', 'true');
    await expect(options(page)).toHaveCount(4);
    expect(await main(page).locator('.fc-option-text').allInnerTexts()).toEqual(order);

    // Galt svar: det valgte blir rødt og det riktige grønt, og baksiden og den detaljerte forklaringen vises. Linja med
    // resultatet og «Neste» står nederst fra starten («Neste» av), så den aldri dekker alternativet eleven trykker på,
    // heller ikke når det står nederst i bildet; etter valget rulles starten av baksiden fram over linja.
    const wrong = options(page).filter({ hasText: 'Feil svar A' });
    const right = options(page).filter({ hasText: title });
    await expect(nextButton(page)).toBeDisabled();
    await expect(main(page).locator('.fc-choice-result')).toHaveText('Velg ett av de fire svarene.');
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await scrollAboveBar(page, wrong);
    expect(await uncovered(wrong)).toBe(true);
    await wrong.click();
    await expect(wrong).toHaveClass(/is-wrong/);
    await expect(right).toHaveClass(/is-right/);
    await expect(main(page).getByText('Ikke riktig.')).toBeVisible();
    await expect(main(page).getByText('Ikke riktig.')).toBeInViewport();
    expect(await uncovered(wrong)).toBe(true);
    await expect(card(page).locator('.fc-answer')).toContainText(title);
    await expect
      .poll(async () => {
        const answer = await card(page).locator('.fc-answer').boundingBox();
        const bar = await main(page).locator('.fc-choice-actions').boundingBox();
        return (answer?.y ?? Infinity) < (bar?.y ?? 0);
      })
      .toBe(true);
    await expect(nextButton(page)).toBeFocused();
    await expect.poll(async () => (await nextButton(page).boundingBox())?.y ?? Infinity).toBeLessThan(page.viewportSize()!.height);
    await card(page).getByRole('button', { name: 'Detaljert forklaring' }).click();
    await expect(card(page).locator('.fc-detail')).toContainText('huskelapp');
    // Et nytt trykk endrer ikke svaret (alternativene er `aria-disabled`, så Playwright må tvinges til å trykke).
    await right.click({ force: true });
    await expect(wrong).toHaveClass(/is-wrong/);
    await nextButton(page).click();
    await expect(main(page).getByText('Tilbake til nivå 0. Kortet kommer igjen til slutt.')).toBeVisible();
    await expect(main(page).getByText('Igjen 3 av 3')).toBeVisible();

    // Kort 2 har ingen alternativer: som i Rask runde.
    await expect(card(page)).toContainText('Forklar hovedideen');
    await expect(options(page)).toHaveCount(0);
    await flip(page);
    await knew(page).click();
    await expect(main(page).getByText('Nivå 1 av 3. Kortet er ferdig for denne runden.')).toBeVisible();

    // Kort 3: det riktige svaret (en formel). På PC med tastene 1–4 og Enter.
    await expect(card(page)).toContainText('regn ut');
    await expect(options(page)).toHaveCount(4);
    const index = await correctIndex(page);
    expect(index).toBeGreaterThanOrEqual(0);
    if (desktop) await page.keyboard.press(String(index + 1));
    else await options(page).nth(index).click();
    await expect(options(page).nth(index)).toHaveClass(/is-right/);
    await expect(main(page).getByText('Riktig.', { exact: true })).toBeVisible();
    await expect(card(page).locator('.fc-answer')).toHaveCount(0);
    if (desktop) await page.keyboard.press('Enter');
    else await nextButton(page).click();
    await expect(main(page).getByText('Nivå 1 av 3. Kortet er ferdig for denne runden.')).toBeVisible();

    // Kort 1 igjen til slutt, nå riktig.
    await expect(main(page).getByText('Igjen 1 av 3')).toBeVisible();
    await expect(card(page)).toContainText(firstQuestion(title));
    await options(page).filter({ hasText: title }).click();
    await nextButton(page).click();

    await expect(main(page).getByRole('heading', { name: '2 av 3 riktige med en gang' })).toBeVisible();
    await expect(main(page).locator('.fc-done')).toContainText('Et riktig svar gir ett nivå opp, men høyst nivå 2');
    await expect(main(page).locator('.fc-done')).toContainText('falt til nivå 0 og står nå på nivå 1');
    await expect(main(page).getByRole('button', { name: /De du svarte feil på/ })).toBeVisible();
    await expect(main(page).getByRole('button', { name: /Øv dem med mestring/ })).toBeVisible();
    await expect(main(page).getByRole('button', { name: /Ny runde med alle/ })).toBeVisible();
    await expect.poll(() => serverLevels(page, deckId), SLOW).toEqual([1, 1, 1]);

    // To nye runder med bare riktige svar: kortene med alternativer stopper på nivå 2, forklaringskortet blir mestret.
    await main(page).getByRole('button', { name: /Ny runde med alle/ }).click();
    for (let i = 0; i < 3; i++) await answerRight(page);
    await expect(main(page).getByRole('heading', { name: '3 av 3 riktige med en gang' })).toBeVisible();
    await expect.poll(() => serverLevels(page, deckId), SLOW).toEqual([2, 2, 2]);
    await main(page).getByRole('button', { name: /Ny runde med alle/ }).click();
    await options(page).filter({ hasText: title }).click();
    await nextButton(page).click();
    await expect(main(page).getByText('Nivå 2 av 3, det høyeste flervalg gir. Kortet er ferdig for denne runden.')).toBeVisible();
    for (let i = 0; i < 2; i++) await answerRight(page);
    await expect(main(page).getByRole('heading', { name: '3 av 3 riktige med en gang' })).toBeVisible();
    await expect.poll(() => serverLevels(page, deckId), SLOW).toEqual([2, 3, 2]);

    // Claude har allerede fått forklaringskortet: «Alle kort» sier det rolig, uten knappen (et nytt trykk ville ikke gitt noe).
    expect((await serverCards(page, deckId)).map((c) => c.choicesDeclined)).toEqual([false, true, false]);
    await page.getByRole('tab', { name: 'Alle kort' }).click();
    const panel = main(page).locator('#fc-panel-kort .fc-choices');
    await expect(panel).toContainText('2 av 3 kort har svaralternativer. Claude fant ingen gode til de andre');
    await expect(panel.getByRole('button', { name: 'Lag svaralternativer' })).toHaveCount(0);
  });

  test('uten svaralternativer kan Flervalg ikke velges, og «Lag svaralternativer» lager dem', async ({ page }, info) => {
    const title = noteTitle(info.project.name);
    const { subjectId, noteId } = await setup(page, title);
    const deckId = await makeDeck(page, subjectId, noteId, title, false);
    expect((await serverCards(page, deckId)).map((c) => c.choices)).toEqual([null, null, null]);

    // Formen er dempet. Piltastene gir den fokus uten å velge den, og mellomrom gir forklaringen.
    await expect(mode(page, 'Flervalg')).toHaveAttribute('aria-disabled', 'true');
    const help = main(page).locator('#fc-panel-ov .fc-choices');
    if (info.project.name === 'desktop') {
      await mode(page, 'Mestring').focus();
      await page.keyboard.press('End');
      await expect(mode(page, 'Flervalg')).toBeFocused();
      await expect(mode(page, 'Flervalg')).toHaveAttribute('aria-checked', 'false');
      await expect(mode(page, 'Mestring')).toHaveAttribute('aria-checked', 'true');
      await page.keyboard.press('ArrowRight');
      await expect(mode(page, 'Mestring')).toBeFocused();
      await expect(mode(page, 'Mestring')).toHaveAttribute('aria-checked', 'true');
      await page.keyboard.press('ArrowLeft');
      await expect(mode(page, 'Flervalg')).toBeFocused();
      await page.keyboard.press(' ');
      await expect(help).toContainText('Flervalg trenger svaralternativer');
      await expect(help).toBeFocused();
      await expect(mode(page, 'Mestring')).toHaveAttribute('aria-checked', 'true');
    }

    // Et trykk på den gir forklaringen i stedet for formen (`aria-disabled`, så Playwright må tvinges til å trykke).
    await mode(page, 'Flervalg').click({ force: true });
    await expect(mode(page, 'Flervalg')).toHaveAttribute('aria-checked', 'false');
    await expect(mode(page, 'Mestring')).toHaveAttribute('aria-checked', 'true');
    await expect(help).toContainText('Flervalg trenger svaralternativer');
    await expect(help).toContainText('Ingen av kortene har svaralternativer ennå.');
    await expect(card(page)).toContainText(firstQuestion(title));

    // «Lag svaralternativer»: Claude lager dem i bakgrunnen.
    // Knappen forsvinner, men fokus blir i forklaringen (ikke på siden), også når den bytter til «Nå kan du øve …».
    await help.getByRole('button', { name: 'Lag svaralternativer' }).click();
    await expect(help).toContainText('Lager svaralternativer …');
    await expect(help).toContainText('Nå kan du øve med flervalg', SLOW);
    await expect(page.getByText('Svaralternativene er klare.')).toBeVisible();
    await expect(help).toBeFocused();
    await expect(mode(page, 'Flervalg')).not.toHaveAttribute('aria-disabled', 'true');
    const after = await serverCards(page, deckId);
    expect(after.map((c) => c.choices?.correct ?? null)).toEqual([title, null, '$F = m \\cdot a$']);
    expect((await syncData(page)).decks.find((d) => d.id === deckId)?.choicesStatus).toBeNull();

    await help.getByRole('button', { name: 'Øv med flervalg' }).click();
    await expect(mode(page, 'Flervalg')).toHaveAttribute('aria-checked', 'true');
    await expect(help).toHaveCount(0);
    await expect(options(page)).toHaveCount(4);

    // «Alle kort»: alternativene vises diskret. Claude fant ingen til forklaringskortet, så ingen knapp, bare en rolig linje.
    await page.getByRole('tab', { name: 'Alle kort' }).click();
    const panel = main(page).locator('#fc-panel-kort .fc-choices');
    await expect(panel).toContainText('2 av 3 kort har svaralternativer. Claude fant ingen gode til de andre');
    await expect(panel).toContainText('Du kan skrive dem selv når du redigerer et kort.');
    await expect(panel.getByRole('button', { name: 'Lag svaralternativer' })).toHaveCount(0);
    const items = main(page).locator('details.fc-item');
    await items.nth(0).locator('summary').click();
    await expect(items.nth(0).locator('.fc-choice-summary')).toContainText('Feil svar A');

    // Svaralternativer skrevet for hånd: de samme reglene som på serveren.
    await items.nth(1).locator('summary').click();
    await items.nth(1).getByRole('button', { name: 'Rediger' }).click();
    const editor = page.getByRole('dialog', { name: 'Rediger kortet' });
    await editor.getByText('Svaralternativer til flervalg').click();
    await editor.getByLabel('Kort riktig svar').fill('nøkkelbegrep');
    await editor.getByLabel('Galt svar 1').fill('nøkkel begrep.');
    await editor.getByLabel('Galt svar 2').fill('grunnbegrep');
    await editor.getByLabel('Galt svar 3').fill('grunnbegrep');
    await editor.getByRole('button', { name: 'Lagre' }).click();
    // Meldingen står rett under feltene, i bildet, og feltet med feilen er markert og viser til den.
    await expect(editor.getByRole('alert')).toHaveText('Et galt svar kan ikke være likt det riktige svaret.');
    await expect(editor.getByRole('alert')).toBeInViewport();
    await expect(editor.getByLabel('Galt svar 1')).toHaveAttribute('aria-invalid', 'true');
    await expect(editor.getByLabel('Galt svar 1')).toHaveAccessibleDescription('Et galt svar kan ikke være likt det riktige svaret.');
    await expect(editor.getByLabel('Galt svar 1')).toBeFocused();
    await editor.getByLabel('Galt svar 1').fill('sidebegrep');
    await editor.getByRole('button', { name: 'Lagre' }).click();
    await expect(editor.getByRole('alert')).toHaveText('De tre gale svarene må være ulike.');
    await editor.getByLabel('Galt svar 3').fill('fagord');
    await expect(editor.locator('.fc-preview .fc-choice-summary')).toContainText('nøkkelbegrep');
    await editor.getByRole('button', { name: 'Lagre' }).click();
    await expect(editor).toBeHidden();
    await expect
      .poll(async () => (await serverCards(page, deckId))[1]?.choices)
      .toEqual({ correct: 'nøkkelbegrep', wrong: ['sidebegrep', 'grunnbegrep', 'fagord'] });
    // Alle kortene har alternativer: ingen knapp.
    await expect(panel).toHaveCount(0);

    // Tomme felt fjerner dem igjen.
    await items.nth(1).getByRole('button', { name: 'Rediger' }).click();
    await editor.getByRole('button', { name: 'Fjern svaralternativene' }).click();
    await expect(editor.getByLabel('Kort riktig svar')).toHaveValue('');
    await editor.getByRole('button', { name: 'Lagre' }).click();
    await expect(editor).toBeHidden();
    await expect.poll(async () => (await serverCards(page, deckId))[1]?.choices).toBeNull();
    // Kortet eleven selv tok alternativene fra, kan Claude prøve igjen.
    await expect(panel).toContainText('2 av 3 kort har svaralternativer. Claude kan prøve å lage dem til 1 kort som mangler dem.');
    await expect(panel.getByRole('button', { name: 'Lag svaralternativer' })).toBeVisible();
  });

  test('en feil vises med «Prøv igjen»', async ({ page }, info) => {
    const title = noteTitle(info.project.name);
    const { subjectId, noteId } = await setup(page, title);
    const deckId = await makeDeck(page, subjectId, noteId, title, false);

    // Et eget kort med «FEIL» i spørsmålet får falsk Claude til å feile.
    await page.getByRole('tab', { name: 'Alle kort' }).click();
    await main(page).getByRole('button', { name: 'Nytt kort' }).click();
    const editor = page.getByRole('dialog', { name: 'Nytt kort' });
    await editor.getByLabel('Spørsmål').fill('FEIL: hva er enheten for kraft?');
    await editor.getByLabel('Svar').fill('newton');
    await editor.getByRole('button', { name: 'Legg til' }).click();
    await expect(editor).toBeHidden();

    const panel = main(page).locator('#fc-panel-kort .fc-choices');
    await panel.getByRole('button', { name: 'Lag svaralternativer' }).click();
    await expect(panel).toContainText('Svaralternativene kunne ikke lages', SLOW);
    await expect(panel).toContainText('Testfeil fra falsk Claude.');
    expect((await syncData(page)).decks.find((d) => d.id === deckId)?.choicesStatus).toBe('failed');

    // Rett kortet og prøv igjen.
    const own = main(page).locator('details.fc-item').filter({ hasText: 'FEIL: hva er enheten' });
    await own.locator('summary').click();
    await own.getByRole('button', { name: 'Rediger' }).click();
    const edit = page.getByRole('dialog', { name: 'Rediger kortet' });
    await edit.getByLabel('Spørsmål').fill('Hva er enheten for kraft?');
    await edit.getByRole('button', { name: 'Lagre' }).click();
    await expect(edit).toBeHidden();
    await panel.getByRole('button', { name: 'Prøv igjen' }).click();
    await expect(panel).toContainText('3 av 4 kort har svaralternativer. Claude fant ingen gode til de andre', SLOW);
    await expect(panel.getByRole('button')).toHaveCount(0);
    await expect
      .poll(async () => (await serverCards(page, deckId)).map((c) => c.choices?.correct ?? null))
      .toEqual([title, null, '$F = m \\cdot a$', 'newton']);
  });
});
