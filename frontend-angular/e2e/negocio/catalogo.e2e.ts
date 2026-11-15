import { expect, test } from '@playwright/test';
import { loginReal, requireBackend } from '../support/backend';

// Auditoría del catálogo contra el backend real: cambia el precio de un producto, lo deja como estaba y comprueba que
// los dos cambios quedaron en «Cambios del catálogo» con el antes, el después y quién.
requireBackend();

test('catálogo: cambiar el precio de un producto queda en «Cambios del catálogo»', async ({ page }) => {
  test.setTimeout(60_000);
  await loginReal(page);
  await page.goto('/catalog/products');
  const edit = page.getByRole('button', { name: /^Editar / }).first();
  await expect(edit).toBeVisible();
  const name = ((await edit.getAttribute('aria-label')) ?? '').replace(/^Editar /, '');

  const form = page.getByRole('dialog', { name: 'Editar producto' });
  const priceField = form.getByLabel('Precio de venta');
  const setPrice = async (value: string) => {
    await page.getByRole('button', { name: `Editar ${name}` }).click();
    await expect(form).toBeVisible();
    await priceField.fill(value);
    await form.getByRole('button', { name: 'Guardar cambios' }).click();
    await expect(form).toBeHidden();
  };

  await page.getByRole('button', { name: `Editar ${name}` }).click();
  await expect(form).toBeVisible();
  const original = await priceField.inputValue();
  await form.getByRole('button', { name: 'Cancelar' }).click();
  await expect(form).toBeHidden();
  const changed = String(Number(original) + 1);

  await setPrice(changed);
  await setPrice(original); // se deja como estaba

  await page.goto('/audit');
  await page.getByRole('tab', { name: 'Cambios del catálogo' }).click();
  const panel = page.getByRole('tabpanel', { name: 'Cambios del catálogo' });
  await panel.getByLabel('Buscar cambio').fill(name);
  const money = (value: string) => `$ ${Number(value).toLocaleString('es-CO')}`;
  const rows = panel.getByRole('row', { name: new RegExp(`Producto «${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}»`) });
  // La más reciente primero: la vuelta al precio original y, debajo, el cambio.
  await expect(rows.nth(0)).toContainText(`${money(changed)} → ${money(original)}`);
  await expect(rows.nth(1)).toContainText(`${money(original)} → ${money(changed)}`);
  await expect(rows.nth(0)).toContainText('Precio de venta');
  await page.getByRole('tab', { name: 'Movimientos de inventario' }).click(); // la pestaña se recuerda: se deja como estaba
});
