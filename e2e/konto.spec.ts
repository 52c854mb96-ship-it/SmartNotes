import { expect, test, type Page } from '@playwright/test';
import sharp from 'sharp';
import { inviteLink, loginOwner, openSettings, register } from './helpers';

/**
 * Kontoene i appen: eieren inviterer en elev i Innstillinger, eleven lager en konto med lenken og ser bare sine egne
 * fag, eieren lager en lenke for nytt passord, og en enhet som bytter konto spør først og sletter den forrige kontoens
 * data. Serveren deles mellom prosjektene, så brukernavnene har prosjektnavnet i seg.
 */

function subjectCards(page: Page) {
  return page.locator('main').getByRole('list').filter({ has: page.locator('.subject-card') }).getByRole('link');
}

test('kontoer: eieren inviterer en elev, eleven ser bare sine egne fag, og en lenke gir nytt passord', async ({ page, browser }, info) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const username = `elev-${info.project.name}`;
  await loginOwner(page);
  await openSettings(page);
  await expect(page.getByText(/Logget inn som\s*eier\s*· Eier/)).toBeVisible();

  const link = await inviteLink(page);
  const student = await register(browser, link, username, 'Kjemi 1');

  // Eleven ser bare faget sitt, og ingen av eierens kort i Innstillinger.
  await expect(subjectCards(student.page)).toHaveCount(1);
  await expect(subjectCards(student.page).first()).toHaveAccessibleName(/^Kjemi 1/);
  await openSettings(student.page);
  await expect(student.page.getByText(new RegExp(`Logget inn som\\s*${username}\\s*· Gratis`))).toBeVisible();
  for (const heading of ['Inviter en elev', 'Brukere', 'Sikkerhetskopi', 'Forbruk av AI']) {
    await expect(student.page.getByRole('heading', { name: heading })).toHaveCount(0);
  }

  // Eieren ser eleven i brukerlista og lager en lenke for nytt passord.
  await page.reload();
  const users = page.locator('section').filter({ has: page.getByRole('heading', { name: 'Brukere' }) });
  const row = users.getByRole('listitem').filter({ hasText: username });
  await expect(row).toContainText('Gratis');
  await row.getByRole('button', { name: 'Nytt passord' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Lag lenke' }).click();
  const resetLink = await row.getByLabel(/Lenke for nytt passord/).inputValue();
  expect(resetLink).toMatch(/\/nytt-passord#[\w-]{20,}$/);

  const other = await browser.newContext();
  const resetPage = await other.newPage();
  await resetPage.goto(resetLink);
  await expect(resetPage).toHaveURL(/\/nytt-passord$/);
  await resetPage.getByLabel('Nytt passord', { exact: true }).fill('nytt-elevpassord');
  await resetPage.getByLabel('Gjenta passordet').fill('nytt-elevpassord');
  await resetPage.getByRole('button', { name: 'Lagre og logg inn' }).click();
  await expect(resetPage.getByRole('heading', { name: 'Fagene dine' })).toBeVisible();
  await expect(subjectCards(resetPage)).toHaveCount(1);

  // Den gamle økten er logget ut, og det nye passordet virker.
  await student.page.reload();
  await expect(student.page).toHaveURL(/logg-inn/);
  await student.page.getByLabel('Brukernavn').fill(username);
  await student.page.getByLabel('Passord', { exact: true }).fill('nytt-elevpassord');
  await student.page.getByRole('button', { name: 'Logg inn' }).click();
  // Tilbake til siden eleven var på (samme konto, så ingenting er slettet).
  await expect(student.page.getByRole('heading', { name: 'Innstillinger', level: 1 })).toBeVisible();
  await expect(student.page.getByText(new RegExp(`Logget inn som\\s*${username}`))).toBeVisible();

  await student.context.close();
  await other.close();
  expect(errors).toEqual([]);
});

test('bytte konto på en enhet: appen spør først og sletter den forrige kontoens data', async ({ page, browser, context }, info) => {
  const username = `bytte-${info.project.name}`;
  await loginOwner(page);
  await expect(subjectCards(page).filter({ hasText: 'Fysikk 1' })).toHaveCount(1);
  const link = await inviteLink(page);
  const student = await register(browser, link, username, 'Biologi 1');
  await student.context.close();

  // Økten forsvinner (utløpt eller slettet), men eierens data ligger fortsatt på enheten.
  await context.clearCookies();
  await page.goto('/');
  await expect(page).toHaveURL(/logg-inn/);

  await page.getByLabel('Brukernavn').fill(username);
  await page.getByLabel('Passord', { exact: true }).fill('elevens-passord');
  await page.getByRole('button', { name: 'Logg inn' }).click();
  const dialog = page.getByRole('dialog', { name: 'Bytte konto på denne enheten?' });
  await expect(dialog).toContainText('notatene til «eier»');
  await dialog.getByRole('button', { name: 'Avbryt' }).click();
  await expect(page).toHaveURL(/logg-inn/);
  await expect(page.getByRole('button', { name: 'Logg inn' })).toBeEnabled();

  await page.getByRole('button', { name: 'Logg inn' }).click();
  await dialog.getByRole('button', { name: 'Bytt konto' }).click();
  await expect(page.getByRole('heading', { name: 'Fagene dine' })).toBeVisible();
  await expect(subjectCards(page)).toHaveCount(1);
  await expect(subjectCards(page).first()).toHaveAccessibleName(/^Biologi 1/);
  // Ingenting fra eieren er igjen på enheten.
  const local = await page.evaluate(async () => {
    const names = await new Promise<string[]>((resolve, reject) => {
      const req = indexedDB.open('smartnotes');
      req.onerror = () => reject(req.error);
      req.onsuccess = () => {
        const tx = req.result.transaction('subjects', 'readonly');
        const all = tx.objectStore('subjects').getAll();
        all.onsuccess = () => resolve((all.result as { name: string }[]).map((s) => s.name));
        all.onerror = () => reject(all.error);
      };
    });
    return names;
  });
  expect(local).toEqual(['Biologi 1']);
});

async function localSubjects(page: Page): Promise<string[]> {
  return page.evaluate(
    () =>
      new Promise<string[]>((resolve, reject) => {
        const req = indexedDB.open('smartnotes');
        req.onerror = () => reject(req.error);
        req.onsuccess = () => {
          const all = req.result.transaction('subjects', 'readonly').objectStore('subjects').getAll();
          all.onsuccess = () => resolve((all.result as { name: string }[]).map((s) => s.name).sort());
          all.onerror = () => reject(all.error);
        };
      }),
  );
}

async function storedAccount(page: Page): Promise<{ id: number; plan: string } | null> {
  return page.evaluate(
    () =>
      new Promise<{ id: number; plan: string } | null>((resolve, reject) => {
        const req = indexedDB.open('smartnotes');
        req.onerror = () => reject(req.error);
        req.onsuccess = () => {
          const get = req.result.transaction('meta', 'readonly').objectStore('meta').get('account');
          get.onsuccess = () => resolve((get.result?.value as { id: number; plan: string } | undefined) ?? null);
          get.onerror = () => reject(get.error);
        };
      }),
  );
}

test('registrering mens eieren er logget inn: appen spør før kontoen byttes, og bare elevens fag blir igjen', async ({ page }, info) => {
  const username = `samme-fane-${info.project.name}`;
  await loginOwner(page);
  const link = await inviteLink(page);
  await page.goto(link);
  await expect(page.getByText(/Du er logget inn som «eier» på denne enheten/)).toBeVisible();
  await page.getByLabel('Brukernavn').fill(username);
  await page.getByLabel('Passord', { exact: true }).fill('elevens-passord');
  await page.getByRole('checkbox', { name: 'Kjemi 1' }).check();
  await page.getByRole('checkbox', { name: /Jeg er minst 15 år/ }).check();
  await page.getByRole('checkbox', { name: /godtar vilkårene/ }).check();
  await page.getByRole('button', { name: 'Lag konto' }).click();
  const dialog = page.getByRole('dialog', { name: 'Bytte konto på denne enheten?' });
  await expect(dialog).toContainText('Du er logget inn som «eier»');
  // Avbryt: ingenting skjer, og eieren er fortsatt logget inn.
  await dialog.getByRole('button', { name: 'Avbryt' }).click();
  await expect(dialog).toBeHidden();
  expect(await storedAccount(page)).toMatchObject({ id: 1, plan: 'owner' });
  await page.getByRole('button', { name: 'Lag konto' }).click();
  await dialog.getByRole('button', { name: 'Bytt konto' }).click();
  await expect(page.getByRole('heading', { name: 'Fagene dine' })).toBeVisible();
  await expect(page).toHaveURL(/\/$/);
  await expect(subjectCards(page)).toHaveCount(1);
  expect(await localSubjects(page)).toEqual(['Kjemi 1']);
  expect(await storedAccount(page)).toMatchObject({ plan: 'free' });
});

test('en enhet fra før kontoene tas over av eieren og beholder opplastingskøen', async ({ page, context }, info) => {
  test.skip(info.project.name !== 'desktop', 'Én gang er nok (serveren deles mellom prosjektene).');
  await loginOwner(page);
  // Service workeren må styre siden, så appen kan lastes uten nett.
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Fagene dine' })).toBeVisible();
  await page.locator('main').getByRole('link', { name: /^Fysikk 1\b/ }).first().click();
  await expect(page.getByRole('heading', { name: 'Fysikk 1', level: 1 })).toBeVisible();

  // Uten nett: et notat legges i køen.
  await context.setOffline(true);
  const title = `Fra før kontoene ${Date.now()}`;
  await page.getByRole('button', { name: 'Last opp notater' }).first().click();
  const upload = page.getByRole('dialog');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="1000"><rect width="100%" height="100%" fill="#fbf8ef"/><text x="60" y="120" font-size="48">Kø</text></svg>`;
  const jpeg = await sharp(Buffer.from(svg)).jpeg().toBuffer();
  await upload.locator('input[type=file]').first().setInputFiles({ name: 'side.jpg', mimeType: 'image/jpeg', buffer: jpeg });
  await upload.getByLabel(/Tittel/).fill(title);
  await upload.getByRole('button', { name: /Lagre i kø/ }).click();
  await expect(upload).toBeHidden();
  await expect(page.locator('main').getByText('Venter på nett').first()).toBeVisible();

  // Slik ser en enhet ut som var logget inn før kontoene: ingen konto er lagret.
  await page.evaluate(
    () =>
      new Promise<void>((resolve, reject) => {
        const req = indexedDB.open('smartnotes');
        req.onerror = () => reject(req.error);
        req.onsuccess = () => {
          const tx = req.result.transaction('meta', 'readwrite');
          tx.objectStore('meta').delete('account');
          tx.oncomplete = () => resolve();
          tx.onerror = () => reject(tx.error);
        };
      }),
  );
  await page.reload();
  expect(await storedAccount(page)).toBeNull();
  await expect(page.locator('main').getByText('Venter på nett').first()).toBeVisible();

  // På nett igjen: opplastingen sendes, og enheten husker at den tilhører eieren.
  await context.setOffline(false);
  await expect(page.locator('main').getByText('Venter på nett')).toHaveCount(0, { timeout: 60_000 });
  await expect.poll(() => storedAccount(page), { timeout: 30_000 }).toMatchObject({ id: 1, plan: 'owner' });
  expect(await localSubjects(page)).toContain('Fysikk 1');
  await page.goto('/innstillinger');
  await expect(page.getByRole('heading', { name: 'Inviter en elev' })).toBeVisible();
});
