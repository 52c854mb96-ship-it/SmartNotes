import { defineConfig, devices } from '@playwright/test';

const PORT = Number(process.env.E2E_PORT ?? 8790);

/**
 * Ende-til-ende-tester mot den ferdigbygde appen (kjør `npm run build` først).
 * Serveren startes med falsk Claude og en midlertidig datamappe.
 */
export default defineConfig({
  testDir: 'e2e',
  timeout: 120_000,
  expect: { timeout: 30_000 },
  fullyParallel: false,
  workers: 1,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    locale: 'nb-NO',
    timezoneId: 'Europe/Oslo',
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 800 } }, testIgnore: /safari\.spec\.ts/ },
    { name: 'mobil', use: { ...devices['Pixel 7'] }, testIgnore: /safari\.spec\.ts/ },
    // Safari (WebKit): krever `npx playwright install webkit`. Kjøres i en egen CI-jobb (npm run test:e2e:webkit).
    { name: 'safari', use: { ...devices['Desktop Safari'], viewport: { width: 1440, height: 900 } }, testMatch: /safari\.spec\.ts/ },
    { name: 'ipad', use: { ...devices['iPad (gen 11) landscape'] }, testMatch: /safari\.spec\.ts/ },
  ],
  webServer: {
    command: 'node scripts/e2e-server.mjs',
    url: `http://localhost:${PORT}/api/health`,
    reuseExistingServer: false,
    timeout: 120_000,
    env: { E2E_PORT: String(PORT) },
  },
});
