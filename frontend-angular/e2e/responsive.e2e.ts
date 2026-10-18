import { expect, test, type Page } from '@playwright/test';
import { login, stubLogin } from './support/auth';

const nav = (page: Page) => page.getByRole('navigation', { name: 'Principal' });
const drawer = (page: Page) => page.locator('app-sidebar');

/** Cerrado en móvil = fuera de pantalla e inactivo (inert: sin foco ni lectura). */
async function expectClosed(page: Page): Promise<void> {
  await expect(drawer(page)).toHaveAttribute('inert', '');
  await expect(nav(page)).not.toBeInViewport();
}

test.beforeEach(async ({ page }) => {
  await page.route('**/api/branches', (route) => route.fulfill({ json: [{ id: 1, nombre: 'Sede Central', direccion: 'Calle 10', telefono: '601', activa: true }] }));
  await stubLogin(page);
  await page.setViewportSize({ width: 420, height: 760 });
  await page.goto('/login');
  await login(page);
  await expect(page).toHaveURL(/\/dashboard$/);
});

test('en móvil el menú empieza cerrado y el contenido usa todo el ancho', async ({ page }) => {
  await expectClosed(page);
  await expect(page.getByRole('button', { name: 'Abrir menú' })).toBeVisible();
  const main = await page.locator('main').boundingBox();
  expect(main?.x).toBe(0);
  expect(main?.width).toBe(420);
});

test('el botón abre el cajón dentro de la pantalla y lo cierra con Escape', async ({ page }) => {
  await page.getByRole('button', { name: 'Abrir menú' }).click();
  await expect(nav(page)).toBeInViewport();
  await expect(page.getByRole('button', { name: 'Abrir menú' })).toHaveAttribute('aria-expanded', 'true');
  await expect(drawer(page)).not.toHaveAttribute('inert', '');
  await page.keyboard.press('Escape');
  await expectClosed(page);
});

test('pulsar fuera del cajón lo cierra', async ({ page }) => {
  await page.getByRole('button', { name: 'Abrir menú' }).click();
  await expect(nav(page)).toBeInViewport();
  await page.mouse.click(400, 400);
  await expectClosed(page);
});

test('elegir una pantalla navega y cierra el cajón', async ({ page }) => {
  await page.getByRole('button', { name: 'Abrir menú' }).click();
  await page.getByRole('link', { name: 'Sucursales' }).click();
  await expect(page).toHaveURL(/\/branches$/);
  await expectClosed(page);
  await expect(page.getByRole('table', { name: 'Listado de sucursales' })).toBeVisible();
});

test('en móvil la página no se desborda horizontalmente', async ({ page }) => {
  await page.getByRole('button', { name: 'Abrir menú' }).click();
  await page.getByRole('link', { name: 'Sucursales' }).click();
  await expect(page.getByRole('table')).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});

test('al pasar a escritorio vuelve la barra lateral fija y desaparece el botón de menú', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 760 });
  await expect(page.getByRole('button', { name: 'Abrir menú' })).toHaveCount(0);
  await expect(nav(page)).toBeInViewport();
  // El ancho se anima al cambiar de modo: se espera a que termine.
  await expect.poll(async () => (await page.locator('aside').boundingBox())?.width).toBe(240);
});
