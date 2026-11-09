import { expect, test, type Page } from '@playwright/test';
import { login, stubLogin } from './support/auth';

const nav = (page: Page) => page.getByRole('navigation', { name: 'Principal' });
const drawer = (page: Page) => page.locator('app-sidebar');

/** Cerrado en móvil = fuera de pantalla e inactivo (inert: sin foco ni lectura). */
async function expectClosed(page: Page): Promise<void> {
  await expect(drawer(page)).toHaveAttribute('inert', '');
  await expect(nav(page)).not.toBeInViewport();
}

/** El panel carga varias consultas al entrar: se simulan todas para que estas pruebas no dependan de ningún backend (un backend real respondería 401 al token de prueba y cerraría la sesión). */
async function stubPanel(page: Page): Promise<void> {
  const empty = { summary: { totalRevenue: 0, totalUnitsSold: 0, totalInventoryValue: 0, averageTicket: 0, branchCount: 1 }, salesTrend: [], topProducts: [], valuations: [], performance: [] };
  await page.route('**/api/v1/analytics/dashboard*', (route) => route.fulfill({ json: empty }));
  await page.route('**/api/v1/analytics/**', (route) => (route.request().url().includes('/dashboard') ? route.fallback() : route.fulfill({ json: [] })));
  await page.route('**/api/v1/alerts*', (route) => route.fulfill({ json: [] }));
  await page.route('**/api/v1/transfers*', (route) => route.fulfill({ json: [] }));
}

test.beforeEach(async ({ page }) => {
  await stubPanel(page);
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

test('en móvil el panel con cifras grandes y nombres largos no se desborda horizontalmente', async ({ page }) => {
  const days = Array.from({ length: 31 }, (_, i) => ({ saleDate: `2026-09-${String(i + 1).padStart(2, '0')}`, revenue: 1_000_000_000 + i * 90_000_000 }));
  const dashboard = {
    summary: { totalRevenue: 78_912_345_678, totalUnitsSold: 12_000, totalInventoryValue: 99_999_999_999, averageTicket: 150_000, branchCount: 6 },
    salesTrend: days,
    topProducts: [1, 2, 3].map((i) => ({ productId: i, productName: `Producto de nombre bastante largo número ${i}`, totalSoldQuantity: 800 - i * 20 })),
    valuations: [],
    performance: [1, 2, 3].map((i) => ({ branchId: i, branchName: `Sucursal Occidente ${i}`, revenue: 500_000_000, unitsSold: 1200, salesCount: 3000 })),
  };
  const replenishment = [1, 2, 3].map((i) => ({ branchId: 1, branchName: 'Sucursal Occidente', productId: i, productName: `Teja Fibrocemento No. ${i} con nombre largo`, currentStock: 0, minStock: 105, priority: 'HIGH' }));
  await page.route('**/api/v1/analytics/dashboard*', (route) => route.fulfill({ json: dashboard }));
  await page.route('**/api/v1/analytics/monthly-sales*', (route) => route.fulfill({ json: [1, 2, 3].map((m) => ({ monthName: 'Septiembre', year: 2026, revenue: 5_000_000 * m, volume: 10 })) }));
  await page.route('**/api/v1/analytics/inventory-rotation*', (route) => route.fulfill({ json: [] }));
  await page.route('**/api/v1/analytics/replenishment-insights*', (route) => route.fulfill({ json: replenishment }));
  await page.route('**/api/v1/alerts*', (route) => route.fulfill({ json: [{ id: 1, branchId: 1, productId: 1, message: 'Stock bajo', alertDate: '2026-10-15T08:00:00', resolved: false, type: 'LOW_STOCK' }] }));
  await page.route('**/api/v1/transfers*', (route) => route.fulfill({ json: [] }));
  for (const width of [411, 360]) {
    await page.setViewportSize({ width, height: 860 });
    await page.reload();
    await expect(page.getByText('Por atender')).toBeVisible();
    await expect(page.getByRole('button', { name: /Gestionar stock de/ }).first()).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow, `desborde horizontal a ${width} px`).toBeLessThanOrEqual(0);
  }
});

test('al pasar a escritorio vuelve la barra lateral fija y desaparece el botón de menú', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 760 });
  await expect(page.getByRole('button', { name: 'Abrir menú' })).toHaveCount(0);
  await expect(nav(page)).toBeInViewport();
  // El ancho se anima al cambiar de modo: se espera a que termine.
  await expect.poll(async () => (await page.locator('aside').boundingBox())?.width).toBe(240);
});
