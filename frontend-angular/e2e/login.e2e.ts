import { expect, test, type Page } from '@playwright/test';

// Estos E2E no necesitan backend: interceptan las llamadas a /api/**.
const adminSession = {
  token: 'jwt-e2e',
  tipo: 'Bearer',
  email: 'ana@zen.com',
  nombre: 'Ana Admin',
  rol: 'ADMIN',
  id: 1,
};

async function stubLogin(page: Page) {
  await page.route('**/api/auth/login', async (route) => {
    const body = route.request().postDataJSON() as { password: string };
    if (body.password === 'secreto1') {
      await route.fulfill({ json: adminSession });
    } else {
      await route.fulfill({ status: 401, json: { message: 'Credenciales incorrectas' } });
    }
  });
}

async function login(page: Page, password = 'secreto1') {
  await page.getByLabel('Correo electrónico').fill('ana@zen.com');
  await page.getByLabel('Contraseña', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Ingresar al sistema' }).click();
}

test('sin sesión, la raíz lleva al login', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole('heading', { name: 'Bienvenido de vuelta' })).toBeVisible();
});

test('el formulario valida antes de llamar al backend', async ({ page }) => {
  await page.goto('/login');
  await page.getByRole('button', { name: 'Ingresar al sistema' }).click();
  await expect(page.getByText('El correo es requerido.')).toBeVisible();
  await expect(page.getByText('La contraseña es requerida.')).toBeVisible();
});

test('credenciales incorrectas muestran el mensaje y no entran', async ({ page }) => {
  await stubLogin(page);
  await page.goto('/login');
  await login(page, 'incorrecta');
  await expect(page.getByRole('alert')).toContainText('Credenciales incorrectas');
  await expect(page).toHaveURL(/\/login$/);
});

test('inicia sesión, conserva la sesión al recargar y cierra sesión', async ({ page }) => {
  await stubLogin(page);
  await page.goto('/login');
  await login(page);

  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByRole('navigation', { name: 'Principal' })).toBeVisible();
  await expect(page.getByText('Ana Admin')).toBeVisible();

  await page.reload();
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByText('Ana Admin')).toBeVisible();

  await page.getByRole('button', { name: 'Cerrar sesión' }).click();
  await expect(page).toHaveURL(/\/login$/);
  await page.goto('/inventory');
  await expect(page).toHaveURL(/\/login$/);
});

test('el tema elegido se conserva al recargar', async ({ page }) => {
  await stubLogin(page);
  await page.goto('/login');
  await login(page);
  await page.getByRole('button', { name: 'Modo claro' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
});

test('el menú del sidebar navega entre pantallas', async ({ page }) => {
  await stubLogin(page);
  await page.goto('/login');
  await login(page);
  await page.getByRole('link', { name: 'Inventario' }).click();
  await expect(page).toHaveURL(/\/inventory$/);
  await expect(page.getByRole('link', { name: 'Inventario' })).toHaveAttribute('aria-current', 'page');
});
