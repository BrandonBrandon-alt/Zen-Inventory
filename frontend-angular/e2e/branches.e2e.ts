import { expect, test } from '@playwright/test';
import { login, stubLogin } from './support/auth';

const BRANCHES = [
  { id: 1, nombre: 'Sede Central', direccion: 'Calle 10 # 5-20, Bogotá', telefono: '6017001001', activa: true },
  { id: 2, nombre: 'Sucursal Norte', direccion: 'Av. 15 # 120-33, Bogotá', telefono: '6017002002', activa: true },
  { id: 3, nombre: 'Sucursal Sur', direccion: 'Carrera 30 # 2-10, Bogotá', telefono: '6017003003', activa: false },
];

test.beforeEach(async ({ page }) => {
  await stubLogin(page);
  await page.route('**/api/branches', (route) => route.fulfill({ json: BRANCHES }));
  await page.goto('/login');
  await login(page);
  await page.getByRole('link', { name: 'Sucursales' }).click();
});

const names = (page: import('@playwright/test').Page) =>
  page.getByRole('table', { name: 'Listado de sucursales' }).locator('tbody tr td:first-child').allTextContents();

test('Sucursales muestra los datos del backend en la tabla', async ({ page }) => {
  await expect(page).toHaveURL(/\/branches$/);
  await expect(page.getByRole('heading', { name: 'Sucursales', level: 1 })).toBeVisible();
  await expect(page.getByText('3 sucursales, 2 activas')).toBeVisible();
  expect((await names(page)).map((n) => n.trim())).toEqual(['Sede Central', 'Sucursal Norte', 'Sucursal Sur']);
  await expect(page.getByText('Inactiva')).toBeVisible();
});

test('se ordena por columna con el encabezado', async ({ page }) => {
  const header = page.getByRole('columnheader', { name: /Nombre/ });
  await header.getByRole('button').click();
  await expect(header).toHaveAttribute('aria-sort', 'ascending');
  await header.getByRole('button').click();
  await expect(header).toHaveAttribute('aria-sort', 'descending');
  expect((await names(page)).map((n) => n.trim())).toEqual(['Sucursal Sur', 'Sucursal Norte', 'Sede Central']);
});

test('si falla la carga muestra el error y reintentar recupera los datos', async ({ page }) => {
  // La carga inicial (del beforeEach) debe terminar antes de cambiar la ruta: si no, consumiría el error.
  await expect(page.getByText('Sede Central')).toBeVisible();
  let calls = 0;
  await page.route('**/api/branches', (route) => {
    calls++;
    return calls === 1 ? route.fulfill({ status: 500, json: { code: 'INTERNAL_ERROR', message: 'Falla de prueba' } }) : route.fulfill({ json: BRANCHES });
  });
  await page.getByRole('link', { name: 'Panel' }).click();
  await page.getByRole('link', { name: 'Sucursales' }).click();
  await expect(page.getByRole('alert')).toContainText('Falla de prueba');
  await page.getByRole('button', { name: 'Reintentar' }).click();
  await expect(page.getByText('Sede Central')).toBeVisible();
});
