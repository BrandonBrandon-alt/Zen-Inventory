import { defineConfig, devices } from '@playwright/test';

// Puerto propio del E2E, distinto del de desarrollo (4200) y del de Docker, para no probar por error otra versión.
const E2E_PORT = 4300;

// Los flujos de negocio requieren el backend real en localhost:8080 (el proxy de `npm start`
// lo apunta ahí). Playwright solo levanta el frontend: el backend se arranca a mano.
export default defineConfig({
  testDir: './e2e',
  testMatch: '**/*.e2e.ts',
  fullyParallel: true,
  forbidOnly: !!process.env['CI'],
  // El servidor de desarrollo compila los trozos perezosos bajo demanda: en frío, las primeras pantallas tardan más que 5 s.
  expect: { timeout: 10_000 },
  use: { baseURL: `http://localhost:${E2E_PORT}`, trace: 'on-first-retry' },
  webServer: {
    command: `npm start -- --port ${E2E_PORT}`,
    url: `http://localhost:${E2E_PORT}`,
    // Nunca se reutiliza un servidor ajeno: en 4200 puede haber un `npm start` o un contenedor con código viejo.
    reuseExistingServer: false,
    timeout: 120_000,
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
