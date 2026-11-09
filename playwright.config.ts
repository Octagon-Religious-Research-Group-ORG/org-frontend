import { defineConfig, devices } from '@playwright/test'

const port = 50074
const baseURL = `http://127.0.0.1:${port}`

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: 'list',
  use: {
    baseURL,
    trace: 'retain-on-failure',
  },
  webServer: [
    {
      command: 'node e2e/fake-members-api.mjs',
      url: 'http://127.0.0.1:3001/api/v1/members/chats',
      reuseExistingServer: !process.env.CI,
    },
    {
      command: 'npm run build && npm run preview:test',
      url: baseURL,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
  ],
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
})
