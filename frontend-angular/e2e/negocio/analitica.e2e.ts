import { expect, test } from '@playwright/test';
import { loginReal, requireBackend } from '../support/backend';

// Componente 4 (analítica, kardex y auditoría) contra el backend real. Solo lee: no deja datos en la base.
// Con los datos de demostración cargados (scripts/demo-data) todas las listas tienen filas.
requireBackend();

test('panel: los indicadores de reabastecimiento, más vendidos y rotación cargan sin error', async ({ page }) => {
  await loginReal(page);
  for (const title of ['Por atender', 'Más vendidos', 'Sin movimiento']) {
    const card = page.getByRole('region', { name: title });
    await expect(card).toBeVisible();
    await expect(card.getByRole('alert')).toHaveCount(0);
  }
  // Cada producto sin movimiento muestra su existencia y los días que lleva quieto.
  const stagnant = page.getByRole('region', { name: 'Sin movimiento' });
  await expect(stagnant.getByText(/en stock · \d+ días/).first().or(stagnant.getByText(/se han vendido recientemente/))).toBeVisible();
});

test('kardex: el historial de movimientos de la sucursal se lista y se filtra por texto', async ({ page }) => {
  await loginReal(page);
  await page.goto('/inventory');
  await page.getByRole('tab', { name: 'Kardex' }).click();
  const panel = page.getByRole('tabpanel', { name: 'Kardex' });
  const rows = panel.getByRole('row');
  await expect(rows.nth(1)).toBeVisible(); // fila 0: encabezados
  await panel.getByLabel('Buscar en el kardex').fill('texto-que-no-existe-en-ningun-movimiento');
  await expect(panel.getByText('Ningún movimiento coincide')).toBeVisible();
});

test('auditoría global: lista los movimientos de todas las sucursales con su detalle', async ({ page }) => {
  await loginReal(page);
  await page.goto('/audit');
  await expect(page.getByRole('heading', { level: 1, name: 'Auditoría global' })).toBeVisible();
  const detail = page.getByRole('button', { name: /^Ver movimiento \d+$/ }).first();
  await expect(detail).toBeVisible();
  await detail.click();
  await expect(page.getByRole('dialog')).toBeVisible();
});
