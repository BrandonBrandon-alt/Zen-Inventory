import { expect, test, type Page } from '@playwright/test';
import { choose, loginReal, requireBackend } from '../support/backend';

// Desde el ajuste de stock, «Compra a proveedor» y «Traslado» llevan a su pantalla con el formulario ya abierto y el
// producto elegido. Solo abre formularios: no guarda nada en la base.
requireBackend();

/** Abre el ajuste del primer producto del inventario y devuelve su nombre. */
async function openAdjust(page: Page): Promise<string> {
  await page.goto('/inventory');
  const adjust = page.getByRole('button', { name: /^Ajustar stock de / }).first();
  await expect(adjust).toBeVisible();
  const name = ((await adjust.getAttribute('aria-label')) ?? '').replace(/^Ajustar stock de /, '');
  await adjust.click();
  return name;
}

test('ingreso por compra: abre la orden de compra con el producto y deja la URL limpia', async ({ page }) => {
  await loginReal(page);
  const product = await openAdjust(page);
  await choose(page, 'Motivo', 'Compra a proveedor');
  await page.getByRole('button', { name: /Crear orden de compra/ }).click();

  const dialog = page.getByRole('dialog', { name: 'Nueva orden de compra' });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('combobox', { name: 'Producto', exact: true })).toContainText(product);
  await expect(page).toHaveURL(/\/purchases$/); // recargar no vuelve a abrirlo
});

test('traslado enviado: abre la solicitud con la sucursal del inventario como origen y el producto', async ({ page }) => {
  await loginReal(page);
  const product = await openAdjust(page);
  const branch = ((await page.getByRole('combobox', { name: 'Sucursal' }).textContent()) ?? '').trim();
  await page.getByRole('dialog', { name: 'Ajustar stock' }).getByRole('tab', { name: 'Retiro' }).click();
  await choose(page, 'Motivo', 'Traslado enviado');
  await page.getByRole('button', { name: /Crear traslado/ }).click();

  const dialog = page.getByRole('dialog', { name: 'Solicitar traslado' });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('combobox', { name: 'Sucursal que lo envía' })).toContainText(branch);
  await expect(dialog.getByRole('combobox', { name: 'Producto', exact: true })).toContainText(product);
  await expect(page).toHaveURL(/\/transfers$/);
});
