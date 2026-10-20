import { expect, test } from '@playwright/test';
import { login, stubLogin } from './support/auth';

// Una venta con muchas líneas: el diálogo no puede crecer más que la pantalla; su contenido debe desplazarse por dentro.
const lines = Array.from({ length: 45 }, (_, i) => ({ id: i + 1, productId: i + 1, productName: `Producto ${i + 1}`, quantity: 2, unitPriceApplied: 1000, discountPercentage: 0, subtotalLine: 2000 }));
const sale = {
  id: 1, date: '2026-10-18T10:00:00', status: 'COMPLETED', branchId: 1, branchName: 'Sede Central', userName: 'Luis', customerName: 'Ana', customerDocument: '1',
  paymentMethod: 'EFECTIVO', subtotal: 90000, totalDiscount: 0, totalFinal: 90000, globalDiscountPercentage: 0, details: lines,
};

test.beforeEach(async ({ page }) => {
  await page.route('**/api/v1/sales/search*', (route) => route.fulfill({ json: { content: [sale], totalElements: 1, totalPages: 1, completedCount: 1, completedTotal: 90000 } }));
  await page.route('**/api/v1/sales/filter-options*', (route) => route.fulfill({ json: { sellers: [], products: [] } }));
  await page.route('**/api/v1/analytics/**', (route) => route.fulfill({ json: [] }));
  await page.route('**/api/v1/alerts*', (route) => route.fulfill({ json: [] }));
  await page.route('**/api/v1/transfers*', (route) => route.fulfill({ json: [] }));
  await page.route('**/api/catalog/**', (route) => route.fulfill({ json: [] }));
  await page.route('**/api/branches', (route) => route.fulfill({ json: [{ id: 1, nombre: 'Sede Central', activa: true }] }));
  await stubLogin(page);
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto('/login');
  await login(page);
  await page.goto('/sales/history');
});

test('un modal con una lista larga cabe en la pantalla y se desplaza por dentro, con sus botones siempre a la vista', async ({ page }) => {
  await page.getByRole('button', { name: 'Ver venta 1' }).click();
  const dialog = page.getByRole('dialog', { name: 'Venta #1' });
  await expect(dialog).toBeVisible();

  const box = await dialog.boundingBox();
  expect(box!.y).toBeGreaterThanOrEqual(0);
  expect(box!.y + box!.height).toBeLessThanOrEqual(720);
  await expect(dialog.getByRole('button', { name: 'Cerrar', exact: true }).last()).toBeInViewport();

  // El contenido tiene su propio desplazamiento: llegar al final de la lista no mueve la página.
  const body = dialog.locator('div.overflow-y-auto');
  const { scrollHeight, clientHeight } = await body.evaluate((el) => ({ scrollHeight: el.scrollHeight, clientHeight: el.clientHeight }));
  expect(scrollHeight).toBeGreaterThan(clientHeight);
  await body.evaluate((el) => (el.scrollTop = el.scrollHeight));
  await expect(dialog.getByText('Producto 45')).toBeInViewport();
});

for (const size of [{ width: 420, height: 760 }, { width: 1366, height: 560 }, { width: 900, height: 480 }]) {
  test(`con la rueda sobre el modal se desplaza su contenido, no la página (${size.width}x${size.height})`, async ({ page }) => {
    await page.setViewportSize(size);
    await page.getByRole('button', { name: 'Ver venta 1' }).click();
    const dialog = page.getByRole('dialog', { name: 'Venta #1' });
    await expect(dialog).toBeVisible();
    const box = await dialog.boundingBox();
    expect(box!.y).toBeGreaterThanOrEqual(0);
    expect(box!.y + box!.height).toBeLessThanOrEqual(size.height);
    const body = dialog.locator('div.overflow-y-auto');
    await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2);
    await page.mouse.wheel(0, 3000);
    await expect.poll(() => body.evaluate((el) => el.scrollTop)).toBeGreaterThan(0);
    expect(await page.evaluate(() => window.scrollY)).toBe(0);
    await expect(dialog.getByRole('button', { name: 'Cerrar', exact: true }).last()).toBeInViewport();
  });
}

test.describe('punto de venta', () => {
  const products = Array.from({ length: 14 }, (_, i) => ({ id: i + 1, sku: `P-${i + 1}`, nombre: `Producto ${i + 1}`, precioVenta: 1000, unitAbbreviation: 'UND', activo: true, proveedores: [] }));
  const stock = products.map((p) => ({ productId: p.id, stockActual: 100, stockMinimo: 1 }));

  test('con muchas líneas el panel «Venta actual» cabe en la pantalla: la lista se desplaza y «Registrar venta» queda a la vista', async ({ page }) => {
    await page.route('**/api/catalog/products*', (route) => route.fulfill({ json: products }));
    await page.route('**/api/v1/inventory/branches/*', (route) => route.fulfill({ json: stock }));
    await page.route('**/api/v1/price-lists*', (route) => route.fulfill({ json: [] }));
    await page.setViewportSize({ width: 1366, height: 640 });
    await page.goto('/sales/pos');
    for (let i = 1; i <= 9; i++) await page.getByRole('button', { name: new RegExp(`Producto ${i}\\b`) }).first().click();

    const panel = page.getByRole('region', { name: 'Venta actual' });
    const register = panel.getByRole('button', { name: 'Registrar venta' });
    // Al bajar la página el panel debe tener a la vista su botón de registrar.
    await page.mouse.move(300, 400);
    await page.mouse.wheel(0, 600);
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(0);
    await expect(register).toBeInViewport();
    // El panel nunca es más alto que la pantalla (si no, su parte de abajo sería inalcanzable).
    expect((await panel.boundingBox())!.height).toBeLessThanOrEqual(640);

    // Las líneas se desplazan dentro del panel, no empujan el botón fuera de la pantalla.
    const list = panel.getByRole('list', { name: 'Productos de la venta' });
    const { scrollHeight, clientHeight } = await list.evaluate((el) => ({ scrollHeight: el.scrollHeight, clientHeight: el.clientHeight }));
    expect(scrollHeight).toBeGreaterThan(clientHeight);
    // Y queda un espacio útil para ver los productos (al menos unas tres líneas), no una rendija.
    expect(clientHeight).toBeGreaterThanOrEqual(180);
  });
});
