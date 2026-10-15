import { expect, test } from '@playwright/test';
import { login, stubLogin } from './support/auth';

// Estos E2E no necesitan backend: interceptan /api/** (ver ./support/auth.ts).

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

test('el título de marca se anima letra por letra', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 760 });
  await page.goto('/login');
  const letters = page.getByRole('heading', { level: 1 }).locator('span');
  await expect(letters).toHaveCount('Zen Inventory'.length);
  const info = await letters.evaluateAll((els) =>
    els.map((el) => ({ name: getComputedStyle(el).animationName, delay: getComputedStyle(el).animationDelay })),
  );
  expect(info.every((i) => i.name === 'letterReveal')).toBe(true);
  expect(info[0].delay).toBe('0.2s');
  expect(info[12].delay).toBe('0.68s');
});

test('con "reducir movimiento" activado el título aparece sin animación', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 1280, height: 760 });
  await page.goto('/login');
  const names = await page
    .getByRole('heading', { level: 1 })
    .locator('span')
    .evaluateAll((els) => els.map((el) => getComputedStyle(el).animationName));
  expect(names.every((n) => n === 'none')).toBe(true);
  await expect(page.getByRole('heading', { level: 1, name: 'Zen Inventory' })).toBeVisible();
});

