import { defineConfig } from '@playwright/test';

/**
 * End-to-end tests, kept separate from the vitest suite.
 *
 * These exist because three bugs shipped past a green unit suite: a blank page
 * offline (a service worker does not control the page that registered it), a
 * 503 on every precached asset (`Vary: Origin` vs a `crossorigin` script tag),
 * and a sticky bar overlapping the card it describes. None were reachable
 * without a real browser.
 *
 * They run against the PRODUCTION build, not the dev server — the service
 * worker only registers in production, so `npm run dev` cannot exercise it.
 */
const PORT = 4173;
// Vite's `base` — the app is served from a subpath on GitHub Pages.
const BASE_URL = `http://localhost:${PORT}/Fitness-track/`;

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? [['html'], ['list']] : 'list',

  use: {
    baseURL: BASE_URL,
    trace: 'on-first-failure',
    screenshot: 'only-on-failure',
    /**
     * Phone-sized with touch, because that is how this app is used — but NOT
     * `devices['Pixel 7']`. That preset also sets `isMobile: true`, which
     * switches Chromium into touch-event emulation and stops dnd-kit's pointer
     * and keyboard sensors from seeing synthetic input at all; the reorder
     * specs silently did nothing under it.
     */
    viewport: { width: 375, height: 800 },
    hasTouch: true,
    /**
     * Escape hatch for sandboxes that ship a pre-installed Chromium whose build
     * does not match this Playwright version. Unset in CI, where
     * `playwright install` puts the matching build in place.
     */
    launchOptions: process.env.PW_CHROMIUM_PATH
      ? { executablePath: process.env.PW_CHROMIUM_PATH }
      : {},
  },

  projects: [{ name: 'mobile-chromium' }],

  webServer: {
    // `preview` serves dist/, so the build has to happen first.
    command: 'npm run build && npm run preview',
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
