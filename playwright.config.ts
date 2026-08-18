import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright Configuration for Pet Wash™ E2E Testing
 * 
 * This config supports both Replit dev environment and local development.
 * Uses REPLIT_DEV_DOMAIN to automatically construct the correct public URL.
 */
export default defineConfig({
  testDir: './tests',
  
  // Maximum time one test can run (30 seconds)
  timeout: 30 * 1000,
  
  // Run tests in files in parallel
  fullyParallel: true,
  
  // Fail the build on CI if you accidentally left test.only in the source code
  forbidOnly: !!process.env.CI,
  
  // Retry on CI only
  retries: process.env.CI ? 2 : 0,
  
  // Opt out of parallel tests on CI
  workers: process.env.CI ? 1 : undefined,
  
  // Reporter to use
  reporter: 'html',
  
  // Shared settings for all the projects below
  use: {
    /**
     * CRITICAL FIX for Replit E2E Testing:
     *
     * 1. process.env.REPLIT_DEV_DOMAIN: Public URL automatically provided by Replit
     * 2. Falls back to http://localhost:5000 for local development
     *
     * This allows E2E tests to access the public dev environment.
     */
    baseURL: process.env.REPLIT_DEV_DOMAIN
      ? 'https://' + process.env.REPLIT_DEV_DOMAIN
      : 'http://localhost:5000',

    // Collect trace when retrying the failed test
    trace: 'on-first-retry',

    // Take screenshot on failure
    screenshot: 'only-on-failure',

    // Ignore HTTPS errors (for dev environments)
    ignoreHTTPSErrors: true,

    /**
     * TEST_BYPASS_TOKEN plumbing (2026-08-18):
     *
     * The server's dev-only auth bypass (server/customAuth.ts:170,
     * server/middleware/gates.ts:78, and requireStaffApproved) reads
     * the header `x-test-user-bypass` and compares it to
     * `process.env.TEST_BYPASS_TOKEN`. In production the token env var
     * is unset and the bypass is fail-closed, so this is safe to plumb
     * unconditionally.
     *
     * When TEST_BYPASS_TOKEN is set in the shell that launches
     * Playwright, we forward it as `x-test-user-bypass` on every
     * request, and forward `x-test-user-role` + `x-test-user-status`
     * from optional companion env vars so a spec can act as a specific
     * persona.
     *
     * Specs override these headers per-persona via
     * `test.use({ extraHTTPHeaders: {...} })` when they need mixed
     * customer / provider identities in the same run.
     */
    extraHTTPHeaders: process.env.TEST_BYPASS_TOKEN
      ? {
          'x-test-user-bypass': process.env.TEST_BYPASS_TOKEN,
          ...(process.env.TEST_USER_ROLE
            ? { 'x-test-user-role': process.env.TEST_USER_ROLE }
            : {}),
          ...(process.env.TEST_USER_STATUS
            ? { 'x-test-user-status': process.env.TEST_USER_STATUS }
            : {}),
        }
      : {},
  },

  // Configure projects for major browsers
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },
    // Mobile viewports
    {
      name: 'Mobile Chrome',
      use: { ...devices['Pixel 5'] },
    },
    {
      name: 'Mobile Safari',
      use: { ...devices['iPhone 13'] },
    },
  ],

  // Run local dev server before starting the tests (optional)
  // Uncomment if you want Playwright to start the server automatically
  // webServer: {
  //   command: 'npm run dev',
  //   url: 'http://localhost:5000',
  //   reuseExistingServer: !process.env.CI,
  // },
});
