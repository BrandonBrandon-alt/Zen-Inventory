import { defineConfig, devices } from '@playwright/test';

// Los flujos de negocio requieren el backend real en localhost:8080 (el proxy de `npm start`
// lo apunta ahí). Playwright solo levanta el frontend: el backend se arranca a mano.
export default defineConfig({
  testDir: './e2e',
  testMatch: '**/*.e2e.ts',
  fullyParallel: true,
  forbidOnly: !!process.env['CI'],
  use: { baseURL: 'http://localhost:4200', trace: 'on-first-retry' },
  webServer: {
    command: 'npm start',
    url: 'http://localhost:4200',
    reuseExistingServer: true,
    timeout: 120_000,
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
