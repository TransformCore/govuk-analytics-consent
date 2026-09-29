import { defineConfig, devices } from '@playwright/test'
import { scenarios } from './e2e/scenarios.js'
import type { ScenarioOptions } from './e2e/fixtures.js'

export default defineConfig<ScenarioOptions>({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    ...devices['Desktop Chrome'],
    trace: 'retain-on-failure'
  },
  projects: scenarios.map((scenario) => ({
    name: scenario.name,
    use: { baseURL: `http://localhost:${scenario.port}`, scenario }
  })),
  // Servers need `npm run build` first; `npm run test:e2e` does that.
  webServer: scenarios.map((scenario) => ({
    command: `node ${scenario.server}`,
    url: `http://localhost:${scenario.port}/`,
    reuseExistingServer: !process.env.CI,
    stdout: 'ignore',
    env: {
      PORT: String(scenario.port),
      NODE_ENV: 'development',
      GTM_CONTAINER_ID: scenario.gtmContainerId ?? '',
      GA_MEASUREMENT_ID: scenario.gaMeasurementId ?? '',
      EXTRA_COOKIE_CATEGORIES: scenario.extraCategories.join(',')
    }
  }))
})
