import { type Page, test } from '@playwright/test';

/**
 * Los flujos de `e2e/negocio` usan el backend REAL (localhost:8080) y dejan datos en su base de desarrollo: se activan
 * solo con las credenciales de un ADMIN de pruebas.
 *
 *   E2E_USER=correo E2E_PASSWORD=clave npm run test:e2e -- e2e/negocio
 */
export const E2E_USER = process.env['E2E_USER'] ?? '';
export const E2E_PASSWORD = process.env['E2E_PASSWORD'] ?? '';

/** Salta el archivo entero si no hay credenciales (así `npm run test:e2e` sigue funcionando sin backend). */
export function requireBackend(): void {
  test.skip(!E2E_USER || !E2E_PASSWORD, 'Define E2E_USER y E2E_PASSWORD (un ADMIN de pruebas) para correr los flujos con el backend real.');
}

export async function loginReal(page: Page): Promise<void> {
  await page.goto('/login');
  await page.getByLabel('Correo electrónico').fill(E2E_USER);
  await page.getByLabel('Contraseña', { exact: true }).fill(E2E_PASSWORD);
  await page.getByRole('button', { name: 'Ingresar al sistema' }).click();
  await page.waitForURL('**/dashboard');
}

/** Abre un selector propio y elige la opción cuyo texto empieza por `option` (o la primera si no se indica). */
export async function choose(page: Page, label: string, option?: string): Promise<string> {
  await page.getByRole('combobox', { name: label }).click();
  const options = page.getByRole('option');
  const target = option ? options.filter({ hasText: new RegExp(`^${option}`) }).first() : options.first();
  const text = ((await target.textContent()) ?? '').trim();
  await target.click();
  return text;
}
