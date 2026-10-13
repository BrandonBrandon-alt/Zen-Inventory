import { expect, test } from '@playwright/test';
import { login, stubLogin } from './support/auth';

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 600 });
  await stubLogin(page);
  await page.goto('/login');
  await login(page);
  await expect(page.getByRole('navigation', { name: 'Principal' })).toBeVisible();
});

const separator = (page: import('@playwright/test').Page) =>
  page.getByRole('separator', { name: 'Cambiar ancho del menú' });

const sidebarWidth = (page: import('@playwright/test').Page) =>
  page.locator('aside').evaluate((el) => el.getBoundingClientRect().width);

test('arrastrar el borde con el ratón cambia el ancho y se conserva al recargar', async ({ page }) => {
  expect(await sidebarWidth(page)).toBe(240);

  const box = await separator(page).boundingBox();
  if (!box) throw new Error('El borde arrastrable no es visible');
  const y = box.y + box.height / 2;
  await page.mouse.move(box.x + box.width / 2, y);
  await page.mouse.down();
  await page.mouse.move(310, y, { steps: 6 });
  await page.mouse.up();

  await expect(separator(page)).toHaveAttribute('aria-valuenow', '310');
  expect(await sidebarWidth(page)).toBe(310);

  await page.reload();
  await expect(separator(page)).toHaveAttribute('aria-valuenow', '310');
  expect(await sidebarWidth(page)).toBe(310);
});

test('al arrastrar más allá de los límites el ancho se queda en 200–360 px', async ({ page }) => {
  const box = await separator(page).boundingBox();
  if (!box) throw new Error('El borde arrastrable no es visible');
  const y = box.y + box.height / 2;
  await page.mouse.move(box.x + box.width / 2, y);
  await page.mouse.down();
  await page.mouse.move(900, y, { steps: 4 });
  await expect(separator(page)).toHaveAttribute('aria-valuenow', '360');
  await page.mouse.move(20, y, { steps: 4 });
  await expect(separator(page)).toHaveAttribute('aria-valuenow', '200');
  await page.mouse.up();
});

test('el contenido ocupa el espacio que deja el menú', async ({ page }) => {
  await separator(page).focus();
  await page.keyboard.press('End');
  // Con el teclado el ancho se anima (300 ms): se espera a que termine antes de medir.
  await expect
    .poll(() => page.locator('main').evaluate((el) => el.getBoundingClientRect().left))
    .toBe(360);
});

test('el scroll usa la barra fina con el color del tema', async ({ page }) => {
  const styles = await page.locator('nav[aria-label="Principal"]').evaluate((el) => {
    const css = getComputedStyle(el);
    return { width: css.scrollbarWidth, color: css.scrollbarColor };
  });
  expect(styles.width).toBe('thin');
  // --neutral-600 del tema oscuro (#3d3b35)
  expect(styles.color).toContain('rgb(61, 59, 53)');
});

test('con la pantalla baja el menú hace scroll sin romper el diseño', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 420 });
  const overflow = await page
    .locator('nav[aria-label="Principal"]')
    .evaluate((el) => ({ scrolls: el.scrollHeight > el.clientHeight, overflowY: getComputedStyle(el).overflowY }));
  expect(overflow.scrolls).toBe(true);
  expect(overflow.overflowY).toBe('auto');
  // Cerrar sesión sigue visible: el pie no se sale de la pantalla.
  await expect(page.getByRole('button', { name: 'Cerrar sesión' })).toBeInViewport();
});
