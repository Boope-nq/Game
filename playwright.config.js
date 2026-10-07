import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './QA/e2e',
  timeout: 120000,
  expect: {
    timeout: 10000
  },
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 1,
  reporter: [
    ['list'],
    ['html', { outputFolder: 'QA/reports/html-report', open: 'never' }]
  ],
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'off'
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        channel: 'chrome'
      },
    }
  ],
  webServer: {
    command: 'node server/server.js',
    url: 'http://localhost:3000',
    reuseExistingServer: true,
    timeout: 15000,
  }
});
