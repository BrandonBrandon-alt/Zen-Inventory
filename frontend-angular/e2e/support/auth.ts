import type { Page } from '@playwright/test';

// Los E2E de UI no necesitan backend: interceptan las llamadas a /api/**.
export const adminSession = {
  token: 'jwt-e2e',
  tipo: 'Bearer',
  email: 'ana@zen.com',
  nombre: 'Ana Admin',
  rol: 'ADMIN',
  id: 1,
};

export async function stubLogin(page: Page): Promise<void> {
  await page.route('**/api/auth/login', async (route) => {
    const body = route.request().postDataJSON() as { password: string };
    if (body.password === 'secreto1') {
      await route.fulfill({ json: adminSession });
    } else {
      await route.fulfill({ status: 401, json: { message: 'Credenciales incorrectas' } });
    }
  });
}

export async function login(page: Page, password = 'secreto1'): Promise<void> {
  await page.getByLabel('Correo electrónico').fill('ana@zen.com');
  await page.getByLabel('Contraseña', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Ingresar al sistema' }).click();
}
