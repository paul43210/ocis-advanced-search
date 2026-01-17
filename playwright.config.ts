import { defineConfig, devices } from '@playwright/test'

/**
 * Playwright E2E test configuration for oCIS Advanced Search extension
 *
 * Environment variables:
 *   OCIS_URL - Base URL (default: https://cloud.faure.ca)
 *   OCIS_USER - oCIS username (default: admin)
 *   OCIS_PASSWORD - oCIS password (required)
 */
export default defineConfig({
  testDir: './tests/e2e',

  // Run tests sequentially to avoid auth conflicts
  fullyParallel: false,
  workers: 1,

  // Fail CI if test.only is left in code
  forbidOnly: !!process.env.CI,

  // Retry failed tests in CI
  retries: process.env.CI ? 2 : 0,

  // Reporter - HTML report with detailed results
  reporter: 'html',

  // Global timeout per test (90 seconds for oCIS which can be slow)
  timeout: 90000,

  // Expect timeout
  expect: {
    timeout: 15000,
  },

  use: {
    // Base URL for oCIS instance
    baseURL: process.env.OCIS_URL || 'https://cloud.faure.ca',

    // Capture trace on first retry for debugging
    trace: 'on-first-retry',

    // Screenshot only on failure
    screenshot: 'only-on-failure',

    // Keep video only on failure
    video: 'retain-on-failure',

    // Ignore HTTPS errors (for self-signed certs)
    ignoreHTTPSErrors: true,
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    // Uncomment to test other browsers:
    // {
    //   name: 'firefox',
    //   use: { ...devices['Desktop Firefox'] },
    // },
  ],

  // Global setup runs authentication before all tests
  globalSetup: './tests/e2e/global-setup.ts',
})
