/**
 * Focused verification-journey config.
 *
 * SEPARATE from playwright.config.ts on purpose. The historical suite is 780
 * tests written against a repo that has moved a long way, and it has never
 * been executed in CI — waiting for all of it to be triaged before proving the
 * migrated verification flow in a real browser would mean never proving it.
 * This config runs one directory, on three browsers, and is the thing that
 * goes into CI first.
 *
 * The specs mock every API call with page.route(), exactly like the existing
 * journey specs, so no backend is needed — only the built SPA. `webServer`
 * serves dist/public and tears itself down, so the run needs no manual setup
 * and cannot leave a stray process behind.
 */
import { defineConfig, devices } from '@playwright/test';

const PORT = Number(process.env.PW_VERIFY_PORT || 4319);

export default defineConfig({
  testDir: './tests/e2e/verification',
  timeout: 30_000,
  expect: { timeout: 7_000 },
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['list']] : [['list']],

  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    // The shared verification UI is behind an independent rollout switch;
    // each spec opts in with ?pwverify=new. That is the point of the switch:
    // this suite exercises the migrated screen without changing anyone
    // else's signup.
  },

  projects: [
    { name: 'desktop-chrome', use: { ...devices['Desktop Chrome'] } },
    // Safari/WebKit stands in for iPhone — same engine, and it is where
    // one-time-code autofill and RTL text shaping actually differ.
    { name: 'mobile-safari', use: { ...devices['iPhone 13'] } },
    { name: 'mobile-chrome', use: { ...devices['Pixel 5'] } },
  ],

  webServer: {
    /**
     * Serves the standalone harness build, not the product SPA.
     *
     * The product bundle does NOT boot when served statically — one of
     * main.tsx's three parallel dynamic imports resolves to undefined
     * ("Cannot read properties of undefined (reading 'default')"), reproduced
     * on a clean --emptyOutDir rebuild. That is a real finding, filed
     * separately; it is not the verification flow, and blocking this proof on
     * it would mean never running it.
     *
     * `localhost`, not 127.0.0.1: vite preview binds IPv6 ::1 here, so the v4
     * literal times out even though the server is up.
     */
    command: `npx vite preview --config tests/e2e/verification/harness-app/vite.config.ts --outDir ../../../../dist-verification-harness --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}/`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
