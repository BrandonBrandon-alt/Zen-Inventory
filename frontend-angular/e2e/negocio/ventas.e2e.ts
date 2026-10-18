import { expect, test } from '@playwright/test';
import { loginReal, requireBackend } from '../support/backend';

requireBackend();

test('venta: se registra en el punto de venta, aparece en el historial y se puede imprimir la factura', async ({ page }) => {
  await loginReal(page);
  await page.goto('/sales/pos');
  // El primer producto con existencias.
  await page.getByRole('button', { name: /^Agregar / }).and(page.locator(':enabled')).first().click();
  const cart = page.getByRole('region', { name: 'Venta actual' });
  await cart.getByRole('button', { name: 'Registrar venta' }).click();

  const receipt = page.getByRole('dialog', { name: /Venta #\d+ registrada/ });
  await expect(receipt).toBeVisible();
  const id = /#(\d+)/.exec((await receipt.getByRole('heading').textContent()) ?? '')?.[1];
  expect(id).toBeTruthy();

  // Imprimir: se carga la factura en un iframe oculto; se comprueba su contenido sin abrir el diálogo del sistema.
  await page.evaluate(() => {
    const original = document.createElement.bind(document);
    document.createElement = ((tag: string, options?: ElementCreationOptions) => {
      const el = original(tag, options);
      if (tag === 'iframe') el.addEventListener('load', () => ((el as HTMLIFrameElement).contentWindow!.print = () => undefined));
      return el;
    }) as typeof document.createElement;
  });
  await receipt.getByRole('button', { name: 'Imprimir factura' }).click();
  const frame = page.frameLocator('iframe[aria-hidden="true"]');
  await expect(frame.getByText(new RegExp(`FACTURA DE VENTA N° [A-Z]*-?0*${id}`))).toBeAttached();

  await receipt.getByRole('button', { name: 'Nueva venta' }).click();
  await page.goto('/sales/history');
  await expect(page.getByRole('button', { name: `Ver venta ${id}` })).toBeVisible();
});
