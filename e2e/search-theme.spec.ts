import { expect, test, type Page } from '@playwright/test';
import sharp from 'sharp';

/**
 * Søkepaletten (Ctrl+K), tema-velgeren og delkapittel-gruppene i notatlisten (tre kolonner på PC).
 * Falsk Claude legger notatet i første kapittel og første delkapittel: «1A Fysikk som målefag».
 */

const PASSWORD = 'e2e-passord';
const SLOW = { timeout: 90_000 };

const main = (page: Page) => page.locator('main');

async function notePage(title: string): Promise<Buffer> {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="1600">
    <rect width="100%" height="100%" fill="#fbf8ef"/>
    <text x="80" y="160" font-size="64" font-family="serif">${title}</text>
    <text x="80" y="300" font-size="48" font-family="serif">v = s / t</text></svg>`;
  return sharp(Buffer.from(svg)).jpeg().toBuffer();
}

async function login(page: Page): Promise<void> {
  await page.goto('/');
  await expect(page).toHaveURL(/logg-inn/);
  await page.getByLabel('Passord', { exact: true }).fill(PASSWORD);
  await page.getByRole('button', { name: 'Logg inn' }).click();
  await expect(page.getByRole('heading', { name: 'Fysikk', level: 1 })).toBeVisible();
}

test('søk med Ctrl+K, tema og delkapitler i notatlisten', async ({ page }, info) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await login(page);

  // Et notat med et ord som bare finnes i denne testen (per prosjekt).
  const word = info.project.name === 'desktop' ? 'Kvantesprangpc' : 'Kvantesprangmobil';
  const title = `${word} og fart`;
  await page.getByRole('button', { name: 'Last opp notater' }).first().click();
  const dialog = page.getByRole('dialog', { name: 'Last opp notater' });
  await expect(dialog).toBeVisible();
  await dialog
    .locator('input[type=file]')
    .first()
    .setInputFiles({ name: 'side1.jpg', mimeType: 'image/jpeg', buffer: await notePage(title) });
  await dialog.getByLabel(/Tittel/).fill(title);
  await dialog.getByRole('button', { name: /^Last opp$/ }).click();
  await expect(dialog).toBeHidden();

  // Vent til notatet er konvertert (ingenting under arbeid lenger på fagsiden).
  await expect(main(page).getByText(title).first()).toBeVisible();
  await expect(main(page).getByRole('heading', { name: 'Under arbeid' })).toHaveCount(0, SLOW);

  // 1) Søk: Ctrl+K åpner paletten, søket treffer tittelen (uten hensyn til store/små bokstaver), Enter åpner notatet.
  await page.keyboard.press('Control+k');
  const palette = page.getByRole('dialog', { name: 'Søk' });
  await expect(palette).toBeVisible();
  const box = palette.getByRole('combobox', { name: 'Søk' });
  await expect(box).toBeFocused();
  await box.fill(word.toUpperCase());
  await expect(palette.getByRole('option', { name: new RegExp(title, 'i') }).first()).toBeVisible();
  await page.keyboard.press('Enter');
  await expect(palette).toBeHidden();
  await expect(page).toHaveURL(/\/notat\//);
  await expect(page.getByRole('heading', { name: title, level: 1 })).toBeVisible();

  // 2) På PC vises notatlisten ved siden av, gruppert etter delkapittel, med notatet markert.
  if (info.project.name === 'desktop') {
    const pane = page.getByRole('complementary', { name: 'Notatliste' });
    await expect(pane).toBeVisible();
    await expect(pane.getByRole('heading', { name: /1A\s*Fysikk som målefag/ })).toBeVisible();
    const group = pane.getByRole('region', { name: 'Fysikk som målefag' });
    const link = group.getByRole('link', { name: new RegExp(title) });
    await expect(link).toBeVisible();
    await expect(link).toHaveAttribute('aria-current', 'page');
    // Delkapittel-velgeren i notatet viser det samme.
    await expect(main(page).getByLabel('Delkapittel')).toHaveValue('1A');
  }

  // 3) Tema: Lys / Mørk / System settes som data-theme på <html> og huskes ved omlasting.
  await page.goto('/innstillinger');
  const html = page.locator('html');
  await main(page).getByRole('radio', { name: 'Mørk' }).click();
  await expect(html).toHaveAttribute('data-theme', 'dark');
  await page.reload();
  await expect(html).toHaveAttribute('data-theme', 'dark');
  await expect(main(page).getByRole('radio', { name: 'Mørk' })).toBeChecked();
  await main(page).getByRole('radio', { name: 'Lys' }).click();
  await expect(html).toHaveAttribute('data-theme', 'light');
  await main(page).getByRole('radio', { name: 'System' }).click();
  await expect(html).not.toHaveAttribute('data-theme');

  expect(errors).toEqual([]);
});
