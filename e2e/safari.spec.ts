import { expect, test, type Page } from '@playwright/test';
import { openSubjectFromHome } from './helpers';
import sharp from 'sharp';

/**
 * Safari (WebKit) på Mac og iPad: de viktigste dialogene og opplastingen.
 * Kjøres bare i prosjektene «safari» og «ipad» (se playwright.config.ts), i en egen CI-jobb.
 * Skriver ut målinger av dialogen (DIAG) så feil i WebKit kan forstås fra CI-loggen.
 */

const PASSWORD = 'e2e-passord';
const SLOW = { timeout: 90_000 };

async function login(page: Page): Promise<void> {
  await page.goto('/');
  await expect(page).toHaveURL(/logg-inn/);
  await page.getByLabel('Passord', { exact: true }).fill(PASSWORD);
  await page.getByRole('button', { name: 'Logg inn' }).click();
  await openSubjectFromHome(page, 'Fysikk 1');
}

/** Målinger av den åpne dialogen: størrelse, stil og hva som faktisk ligger øverst midt i den. */
async function diagnose(page: Page, selector: string): Promise<Record<string, unknown>> {
  return page.evaluate((sel) => {
    const d = document.querySelector(sel) as HTMLDialogElement | null;
    if (!d) return { found: false };
    const cs = getComputedStyle(d);
    const r = d.getBoundingClientRect();
    const inner = d.querySelector('.modal-inner, .search-head') as HTMLElement | null;
    const ir = inner?.getBoundingClientRect();
    const probe = (x: number, y: number) => {
      const el = document.elementFromPoint(x, y);
      return el ? `${el.tagName.toLowerCase()}.${String(el.className).slice(0, 40)}` : null;
    };
    const toaster = document.querySelector('.toaster') as HTMLElement | null;
    const tr = toaster?.getBoundingClientRect();
    return {
      found: true,
      open: d.open,
      modal: d.matches(':modal'),
      rect: [r.x, r.y, r.width, r.height].map(Math.round),
      display: cs.display,
      position: cs.position,
      opacity: cs.opacity,
      visibility: cs.visibility,
      transform: cs.transform,
      animation: cs.animationName,
      innerRect: ir ? [ir.x, ir.y, ir.width, ir.height].map(Math.round) : null,
      atCenter: probe(r.x + r.width / 2, r.y + Math.min(r.height / 2, 60)),
      atViewportCenter: probe(innerWidth / 2, innerHeight / 2),
      toasterOpen: toaster ? toaster.matches(':popover-open') : null,
      toasterRect: tr ? [tr.x, tr.y, tr.width, tr.height].map(Math.round) : null,
      viewport: [innerWidth, innerHeight],
      userAgent: navigator.userAgent,
    };
  }, selector);
}

/** Elementet er synlig og ligger helt innenfor rammen (ikke klippet bort av en for lav forelder). */
async function expectInside(locator: ReturnType<Page['locator']>, outer: { x: number; y: number; width: number; height: number } | null): Promise<void> {
  await expect(locator).toBeVisible();
  const b = await locator.boundingBox();
  expect(b && outer).toBeTruthy();
  if (!b || !outer) return;
  expect(b.height).toBeGreaterThan(10);
  expect(b.y).toBeGreaterThanOrEqual(outer.y - 1);
  expect(b.y + b.height).toBeLessThanOrEqual(outer.y + outer.height + 1);
}

async function notePage(title: string): Promise<Buffer> {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="1600">
    <rect width="100%" height="100%" fill="#fbf8ef"/>
    <text x="80" y="160" font-size="64" font-family="serif">${title}</text></svg>`;
  return sharp(Buffer.from(svg)).jpeg().toBuffer();
}

test('opplastingsdialogen vises og kan brukes', async ({ page }, info) => {
  const logLines: string[] = [];
  page.on('console', (m) => (m.type() === 'error' || m.type() === 'warning') && logLines.push(`${m.type()}: ${m.text()}`));
  page.on('pageerror', (e) => logLines.push(`pageerror: ${e.message}`));
  await login(page);
  await page.getByRole('button', { name: 'Last opp notater' }).first().click();
  await page.waitForTimeout(600); // la åpningsanimasjonen bli ferdig
  const diag = await diagnose(page, 'dialog.modal');
  console.log(`DIAG upload [${info.project.name}]`, JSON.stringify(diag));

  const dialog = page.getByRole('dialog', { name: 'Last opp notater' });
  await expect(dialog.getByRole('heading', { name: 'Last opp notater' })).toBeVisible();
  const box = await dialog.boundingBox();
  expect(box?.height ?? 0).toBeGreaterThan(200);
  expect(box?.width ?? 0).toBeGreaterThan(280);
  // Det som ligger øverst midt i dialogen, skal være innholdet i den (ikke dialogen selv eller noe som dekker den).
  expect(String(diag.atCenter)).not.toMatch(/^(div\.toaster|dialog)/);
  // Filvelgeren og knappene skal ligge innenfor dialogen, ikke klippes bort.
  await expectInside(dialog.getByRole('button', { name: /^Last opp$/ }), box);

  // Hele opplastingen i Safari
  const title = `Safari ${info.project.name}`;
  await dialog.locator('input[type=file]').first().setInputFiles({ name: 'side1.jpg', mimeType: 'image/jpeg', buffer: await notePage(title) });
  await expect(dialog.getByText('side1.jpg')).toBeVisible();
  await dialog.getByLabel(/Tittel/).fill(title);
  await dialog.getByRole('button', { name: /^Last opp$/ }).click();
  try {
    await expect(dialog).toBeHidden();
  } catch (err) {
    const text = (await dialog.innerText().catch(() => '')).replace(/\s+/g, ' ').slice(0, 600);
    console.log(`DIAG upload-error [${info.project.name}]`, JSON.stringify({ text, log: logLines }));
    throw err;
  }
  await expect(page.locator('main').getByText(title).first()).toBeVisible(SLOW);
});

test('søk og visualiseringer i Safari', async ({ page }, info) => {
  await login(page);

  // Søket åpnes fra knappen i sidepanelet på brede skjermer, ellers med tastatur.
  const searchButton = page.getByRole('button', { name: /^Søk/ }).first();
  if (await searchButton.isVisible()) await searchButton.click();
  else await page.keyboard.press('Control+k');
  const palette = page.getByRole('dialog', { name: 'Søk' });
  await expect(palette).toBeVisible();
  console.log(`DIAG search [${info.project.name}]`, JSON.stringify(await diagnose(page, 'dialog.search-palette')));
  await palette.getByRole('combobox', { name: 'Søk' }).fill('friksjon');
  const option = palette.getByRole('option', { name: /Statisk friksjon og glidefriksjon/ });
  await expect(option).toBeVisible();
  await page.waitForTimeout(300);
  console.log(`DIAG search-results [${info.project.name}]`, JSON.stringify(await diagnose(page, 'dialog.search-palette')));
  // Treffene skal få plass i søkevinduet (Safari klemte dem tidligere til 0 px).
  expect((await palette.locator('.search-body').boundingBox())?.height ?? 0).toBeGreaterThan(60);
  await expectInside(option, await palette.boundingBox());
  await option.click();

  await expect(page.getByRole('heading', { name: 'Statisk friksjon og glidefriksjon', level: 1 })).toBeVisible();
  const figure = page.locator('.viz-figure svg').first();
  await expect(figure).toBeVisible();
  expect((await figure.boundingBox())?.height ?? 0).toBeGreaterThan(100);
  await page.locator('main').getByRole('slider', { name: 'Dytt F' }).fill('200');
  await expect(page.locator('main').getByText('Kassen glir.')).toBeVisible();
});

test('flashcards: øvingsformene og luka i Safari', async ({ page }, info) => {
  await login(page);
  const subjectId = new URL(page.url()).pathname.split('/')[2]!;
  const main = page.locator('main');

  // Et konvertert notat å lage kort av (falsk Claude: tre kort, kort 2 har «nøkkelbegrep» i fet skrift).
  const title = `Kort ${info.project.name}`;
  await page.getByRole('button', { name: 'Last opp notater' }).first().click();
  const dialog = page.getByRole('dialog', { name: 'Last opp notater' });
  await dialog.locator('input[type=file]').first().setInputFiles({ name: 'side1.jpg', mimeType: 'image/jpeg', buffer: await notePage(title) });
  await dialog.getByLabel(/Tittel/).fill(title);
  await dialog.getByRole('button', { name: /^Last opp$/ }).click();
  await expect(dialog).toBeHidden();
  let noteId = '';
  await expect
    .poll(async () => {
      const notes = await page.evaluate(
        async () => ((await (await fetch('/api/sync?since=0')).json()) as { notes: { id: string; title: string; status: string }[] }).notes,
      );
      const n = notes.find((x) => x.title === title);
      noteId = n?.id ?? '';
      return n?.status;
    }, SLOW)
    .toBe('done');
  await page.goto(`/fag/${subjectId}/flashcards/ny?notat=${noteId}`);
  // Forhåndsvalget gjelder bare notater enheten alt vet er ferdige; et notat som nettopp ble ferdig, velges for hånd.
  await main.getByRole('checkbox', { name: new RegExp(`^${title}\\b`) }).check();
  await expect(main.getByText('1 notat valgt')).toBeVisible();
  await main.getByRole('button', { name: 'Lag kortstokk' }).click();
  await expect(page.getByRole('tab', { name: 'Øv' })).toBeVisible(SLOW);

  // Velgeren: fem former på én rad, innenfor skjermen. Flervalg er dempet: kortstokken har ingen svaralternativer.
  const picker = main.getByRole('radiogroup', { name: 'Øvingsform' });
  const radios = picker.getByRole('radio');
  await expect(radios).toHaveCount(5);
  await expect(picker.getByRole('radio', { name: 'Flervalg' })).toHaveAttribute('aria-disabled', 'true');
  const first = await radios.first().boundingBox();
  const last = await radios.last().boundingBox();
  const width = page.viewportSize()?.width ?? 0;
  console.log(`DIAG flashcards-velger [${info.project.name}]`, JSON.stringify({ first, last, width }));
  expect(first && last).toBeTruthy();
  expect(Math.abs((first?.y ?? 0) - (last?.y ?? 0))).toBeLessThan(2);
  expect((last?.x ?? 0) + (last?.width ?? 0)).toBeLessThanOrEqual(width);

  // Rask runde: «Kunne ikke» og «Kunne» side om side, store nok for tommelen.
  await picker.getByRole('radio', { name: 'Rask runde' }).click();
  await expect(picker.getByRole('radio', { name: 'Rask runde' })).toHaveAttribute('aria-checked', 'true');
  const card = main.locator('.fc-card');
  const no = main.getByRole('button', { name: /^Kunne ikke/ });
  const yes = main.getByRole('button', { name: /^Kunne(?!\s*ikke)/ });
  await card.getByRole('button', { name: 'Trykk for å snu kortet' }).click();
  await expect(yes).toBeEnabled();
  const a = await no.boundingBox();
  const b = await yes.boundingBox();
  console.log(`DIAG flashcards-knapper [${info.project.name}]`, JSON.stringify({ no: a, yes: b }));
  expect(a && b).toBeTruthy();
  expect(Math.abs((a?.y ?? 0) - (b?.y ?? 0))).toBeLessThan(2);
  expect(a?.height ?? 0).toBeGreaterThanOrEqual(44);
  expect(b?.height ?? 0).toBeGreaterThanOrEqual(44);
  expect((b?.x ?? 0) + (b?.width ?? 0)).toBeLessThanOrEqual(width);
  await yes.click();
  await expect(main.getByText('Nivå 1 av 3. Kortet er ferdig for denne runden.')).toBeVisible();

  // Luketekst: feltet i kort 2 kan brukes med tastaturet (WebKit stopper skriving under user-select: none).
  await picker.getByRole('radio', { name: 'Luketekst' }).click();
  await card.getByRole('button', { name: 'Trykk for å snu kortet' }).click();
  await yes.click();
  const field = main.getByRole('textbox', { name: 'Begrepet som mangler' });
  await expect(field).toBeVisible();
  await field.click();
  await field.pressSequentially('nøkkelbegrep');
  await expect(field).toHaveValue('nøkkelbegrep');
  await field.press('Enter');
  await expect(field).toHaveClass(/is-right/);
  await expect(main.getByRole('button', { name: 'Neste', exact: true })).toBeFocused();
});
