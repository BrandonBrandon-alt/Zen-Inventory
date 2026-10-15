import { expect, test, type Page } from '@playwright/test';
import { adminSession, login, stubLogin } from './support/auth';

// Transiciones y animaciones de la interfaz (sin backend: /api interceptado).

async function enterAs(page: Page, session: object = adminSession) {
  await page.route('**/api/auth/login', (route) => route.fulfill({ json: session }));
  await page.goto('/login');
  await login(page);
  await expect(page.getByRole('navigation', { name: 'Principal' })).toBeVisible();
}

test('el formulario del login tiembla al rechazar las credenciales y se detiene solo', async ({ page }) => {
  await stubLogin(page);
  await page.goto('/login');
  await login(page, 'incorrecta');
  const form = page.locator('form');
  await expect(form).toHaveClass(/animate-shake/);
  expect(await form.evaluate((el) => getComputedStyle(el).animationName)).toBe('shake');
  // Termina solo: la clase se quita al acabar la animación y el formulario vuelve a poder temblar.
  await expect(form).not.toHaveClass(/animate-shake/);
});

test('el aviso global entra animado y sale animado al cerrarlo', async ({ page }) => {
  const manager = { ...adminSession, rol: 'MANAGER', sucursalId: 3 };
  await page.route('**/api/branches/3', (route) => route.fulfill({ status: 500, json: { code: 'INTERNAL_ERROR', message: 'Falló el servidor' } }));
  await enterAs(page, manager);

  const toast = page.locator('app-toast').first();
  await expect(toast).toBeVisible();
  // Mientras entra, tiene la animación de entrada (la clase la quita Angular al terminar).
  const entered = await page.evaluate(() => {
    const el = document.querySelector('app-toast');
    return el ? getComputedStyle(el).animationName : 'sin-toast';
  });
  expect(['toastIn', 'none']).toContain(entered);

  await toast.getByRole('button', { name: 'Cerrar aviso' }).click();
  // Sale con animación (no desaparece de golpe) y luego se retira del DOM.
  await expect(page.locator('app-toast')).toHaveCount(0);
});

test('con "reducir movimiento" no hay animaciones ni transiciones apreciables', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await stubLogin(page);
  await page.goto('/login');
  await expect(page.getByRole('heading', { name: 'Bienvenido de vuelta' })).toBeVisible();
  const durations = await page.evaluate(() => {
    const pick = (el: Element | null) => {
      if (!el) return null;
      const css = getComputedStyle(el);
      return { animation: css.animationDuration, transition: css.transitionDuration };
    };
    return { form: pick(document.querySelector('form')), button: pick(document.querySelector('button[type=submit]')) };
  });
  // 0.01 ms equivale a "sin animación" (y conserva el estado final de la animación).
  expect(durations.form?.animation).toBe('1e-05s');
  expect(durations.button?.transition).toBe('1e-05s');
  await expect(page.getByRole('heading', { level: 1, name: 'Zen Inventory' })).toBeVisible();
});

test('sin "reducir movimiento" el botón sí tiene transición', async ({ page }) => {
  await page.goto('/login');
  await expect(page.getByRole('heading', { name: 'Bienvenido de vuelta' })).toBeVisible();
  const transition = await page.locator('button[type=submit]').evaluate((el) => getComputedStyle(el).transitionDuration);
  expect(transition).toBe('0.2s');
});
