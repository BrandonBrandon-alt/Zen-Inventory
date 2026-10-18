import { expect, test, type Page } from '@playwright/test';
import { login, stubLogin } from './support/auth';

interface Spy {
  x: string;
  y: string;
  switching: boolean;
}

/** Espía `document.startViewTransition`: anota el origen y la marca que el servicio pone justo antes de llamarla. */
async function spyOnViewTransitions(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const target = document as unknown as { startViewTransition: (cb: () => void) => unknown };
    const original = target.startViewTransition.bind(document);
    const calls: Spy[] = [];
    (window as unknown as { __vt: Spy[] }).__vt = calls;
    target.startViewTransition = (cb) => {
      const root = document.documentElement;
      calls.push({
        x: root.style.getPropertyValue('--theme-x'),
        y: root.style.getPropertyValue('--theme-y'),
        switching: root.hasAttribute('data-theme-switching'),
      });
      return original(cb);
    };
  });
}

/** Solo las transiciones del cambio de tema (marcadas por ThemeService con data-theme-switching). */
const calls = (page: Page) =>
  page.evaluate(() => (window as unknown as { __vt: Spy[] }).__vt.filter((call) => call.switching));

test('el cambio de tema se revela desde el botón pulsado y deja el estado limpio', async ({ page }) => {
  await spyOnViewTransitions(page);
  await page.goto('/login');
  const button = page.getByRole('button', { name: 'Modo claro' });
  const box = (await button.boundingBox())!;

  await button.click();

  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  const [call] = await calls(page);
  expect(await calls(page)).toHaveLength(1);
  expect(call.switching).toBe(true);
  // El origen es el centro del botón.
  expect(Number.parseFloat(call.x)).toBeCloseTo(box.x + box.width / 2, 0);
  expect(Number.parseFloat(call.y)).toBeCloseTo(box.y + box.height / 2, 0);
  // Al terminar no queda rastro en <html>.
  await expect(page.locator('html')).not.toHaveAttribute('data-theme-switching');
  expect(await page.evaluate(() => document.documentElement.style.getPropertyValue('--theme-x'))).toBe('');
});

test('mientras dura, se ejecuta la animación de revelado sobre la pantalla nueva', async ({ page }) => {
  await page.goto('/login');
  await page.evaluate(() => {
    (window as unknown as { __seen: string[] }).__seen = [];
    const watch = (): void => {
      for (const a of document.getAnimations()) {
        const name = (a as CSSAnimation).animationName;
        const pseudo = (a.effect as KeyframeEffect | null)?.pseudoElement;
        if (name === 'theme-reveal') (window as unknown as { __seen: string[] }).__seen.push(String(pseudo));
      }
      requestAnimationFrame(watch);
    };
    watch();
  });
  await page.getByRole('button', { name: 'Modo claro' }).click();
  await expect
    .poll(() => page.evaluate(() => (window as unknown as { __seen: string[] }).__seen.length))
    .toBeGreaterThan(0);
  expect(await page.evaluate(() => (window as unknown as { __seen: string[] }).__seen[0])).toBe('::view-transition-new(root)');
});

test('quien pide menos movimiento recibe el cambio al instante, sin transición', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await spyOnViewTransitions(page);
  await page.goto('/login');
  await page.getByRole('button', { name: 'Modo claro' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  expect(await calls(page)).toHaveLength(0);
});

test('también anima desde el botón del menú lateral, y dos cambios seguidos terminan bien', async ({ page }) => {
  await spyOnViewTransitions(page);
  await stubLogin(page);
  await page.goto('/login');
  await login(page);
  await expect(page.getByRole('navigation', { name: 'Principal' })).toBeVisible();

  await page.getByRole('button', { name: 'Modo claro' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await page.getByRole('button', { name: 'Modo oscuro' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  expect(await calls(page)).toHaveLength(2);
  // La preferencia final queda guardada.
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
});
