import { expect, test } from '@playwright/test';
import { choose, loginReal, requireBackend } from '../support/backend';

requireBackend();

test('compra: se crea, se envía, se recibe en dos partes y la segunda propone solo lo que falta', async ({ page }) => {
  await loginReal(page);
  await page.goto('/purchases');
  await page.getByRole('button', { name: /Nueva orden de compra/ }).click();
  const form = page.getByRole('dialog', { name: 'Nueva orden de compra' });
  await choose(page, 'Proveedor');
  await choose(page, 'Producto');
  const price = form.getByLabel('Precio unitario');
  if (!(await price.inputValue())) await price.fill('1000');
  await form.getByLabel('Cantidad').fill('4');
  await form.getByRole('button', { name: 'Crear orden' }).click();

  const created = page.getByText(/Orden #\d+ creada\./);
  await expect(created).toBeVisible();
  const id = /#(\d+)/.exec((await created.textContent()) ?? '')?.[1];
  expect(id).toBeTruthy();

  await page.getByRole('button', { name: `Ver orden ${id}` }).click();
  const detail = page.getByRole('dialog', { name: `Orden de compra #${id}` });
  // Un ADMIN la crea ya aprobada; si no, se aprueba.
  const approve = detail.getByRole('button', { name: 'Aprobar' });
  if (await approve.isVisible()) await approve.click();
  await detail.getByRole('button', { name: 'Marcar como enviada' }).click();

  await detail.getByRole('button', { name: 'Recibir mercancía' }).click();
  const first = detail.getByLabel(/faltan 4 de 4/);
  await expect(first).toHaveValue('4');
  await first.fill('3');
  await detail.getByRole('button', { name: 'Registrar recepción' }).click();
  await expect(detail.getByText(/Recepción registrada/)).toBeVisible();
  await detail.getByRole('button', { name: 'Listo' }).click();

  // Segunda recepción: ya llegaron 3 de 4, solo falta 1 (no se vuelve a proponer el total pedido).
  await page.getByRole('button', { name: `Ver orden ${id}` }).click();
  await expect(detail.getByText('Recibida parcial')).toBeVisible();
  await detail.getByRole('button', { name: 'Recibir mercancía' }).click();
  const rest = detail.getByLabel(/faltan 1 de 4/);
  await expect(rest).toHaveValue('1');
  await rest.fill('2');
  await detail.getByRole('button', { name: 'Registrar recepción' }).click();
  await expect(detail.getByText('Es más de lo que falta por recibir.')).toBeVisible();
  await rest.fill('1');
  await detail.getByRole('button', { name: 'Registrar recepción' }).click();
  await expect(detail.getByText(/Recepción registrada/)).toBeVisible();
  await detail.getByRole('button', { name: 'Listo' }).click();

  await page.getByRole('button', { name: `Ver orden ${id}` }).click();
  await expect(detail.getByText('Recibida', { exact: true })).toBeVisible();
});
