import { expect, test } from '@playwright/test';
import { loginReal, requireBackend } from '../support/backend';

// Componente 4 (analítica, kardex y auditoría) contra el backend real. Solo lee: no deja datos en la base.
// Con los datos de demostración cargados (scripts/demo-data) todas las listas tienen filas.
requireBackend();

test('panel: los indicadores de reabastecimiento, más vendidos y rotación cargan sin error', async ({ page }) => {
  // El panel pide varias consultas de analítica a la vez; la primera carga (con el servidor de desarrollo compilando y
  // otra prueba en paralelo) puede pasar de los 10 s por defecto.
  test.setTimeout(60_000);
  await loginReal(page);
  for (const title of ['Por atender', 'Más vendidos', 'Sin movimiento']) {
    const card = page.getByRole('region', { name: title });
    await expect(card).toBeVisible({ timeout: 30_000 });
    await expect(card.getByRole('alert')).toHaveCount(0);
  }
  // Cada producto sin movimiento muestra su existencia y los días que lleva quieto.
  const stagnant = page.getByRole('region', { name: 'Sin movimiento' });
  await expect(stagnant.getByText(/en stock · \d+ días/).first().or(stagnant.getByText(/se han vendido recientemente/))).toBeVisible({ timeout: 30_000 });
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

test('auditoría global: el inicio de sesión que se acaba de hacer aparece en «Inicios de sesión»', async ({ page }) => {
  await loginReal(page);
  await page.goto('/audit');
  await page.getByRole('tab', { name: 'Inicios de sesión' }).click();
  const latest = page.getByRole('row').nth(1); // fila 0: encabezados; la más reciente primero
  await expect(latest).toContainText(process.env['E2E_USER'] ?? '');
  await expect(latest).toContainText('Exitoso');
  await page.getByRole('tab', { name: 'Movimientos de inventario' }).click(); // la pestaña se recuerda: se deja como estaba
});
