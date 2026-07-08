import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  timeout: 30_000,
  expect: { timeout: 10_000 },

  reporter: [
    ['html', { open: 'never', outputFolder: 'playwright-report' }],
    ['list'],
  ],

  use: {
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },

  projects: [
    {
      name: 'rm-setup',
      testDir: './tests/setup',
      testMatch: 'rm-auth.setup.ts',
      use: {
        ...devices['Desktop Chrome'],
        baseURL: 'http://localhost:3005',
      },
    },
    {
      name: 'fg-setup',
      testDir: './tests/setup',
      testMatch: 'fg-auth.setup.ts',
      use: {
        ...devices['Desktop Chrome'],
        baseURL: 'http://localhost:3004',
      },
    },
    {
      name: 'rm',
      testDir: './tests/rm',
      dependencies: ['rm-setup'],
      use: {
        ...devices['Desktop Chrome'],
        baseURL: 'http://localhost:3005',
        storageState: 'auth/rm-storage.json',
      },
    },
    {
      name: 'fg',
      testDir: './tests/fg',
      dependencies: ['fg-setup'],
      use: {
        ...devices['Desktop Chrome'],
        baseURL: 'http://localhost:3004',
        storageState: 'auth/fg-storage.json',
      },
    },
  ],
});
