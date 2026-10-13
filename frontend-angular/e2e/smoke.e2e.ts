import { expect, test } from '@playwright/test';

test('la app arranca y tiene el título del producto', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle('Zen Inventory');
});

test('el tema oscuro por defecto aplica los tokens de diseño', async ({ page }) => {
  await page.goto('/');
  const background = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  // --bg-base (#242421) en el tema oscuro por defecto.
  expect(background).toBe('rgb(36, 36, 33)');
});
