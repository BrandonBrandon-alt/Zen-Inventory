import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ConfirmDialog } from './confirm-dialog';

const TEMPLATE = `
  <app-confirm-dialog
    [(open)]="open"
    title="Desactivar sucursal"
    message="La sucursal dejará de estar disponible."
    confirmLabel="Desactivar"
    [busy]="busy"
    [error]="error"
    (confirmed)="onConfirm()"
  />`;

async function setup(props: Partial<{ open: boolean; busy: boolean; error: string | null }> = {}) {
  const componentProperties = { open: true, busy: false, error: null as string | null, onConfirm: vi.fn(), ...props };
  const result = await render(TEMPLATE, { imports: [ConfirmDialog], componentProperties });
  return { ...result, host: result.fixture.componentInstance as unknown as typeof componentProperties };
}

describe('ConfirmDialog', () => {
  afterEach(() => {
    document.body.style.overflow = '';
  });

  it('muestra el título como nombre del diálogo y el mensaje', async () => {
    await setup();
    expect(screen.getByRole('dialog', { name: 'Desactivar sucursal' })).toBeInTheDocument();
    expect(screen.getByText('La sucursal dejará de estar disponible.')).toBeInTheDocument();
  });

  it('cerrado no es accesible', async () => {
    await setup({ open: false });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('confirmar emite `confirmed` y NO cierra por sí mismo (lo decide la pantalla al terminar la acción)', async () => {
    const { host } = await setup();
    await userEvent.click(screen.getByRole('button', { name: 'Desactivar' }));
    expect(host.onConfirm).toHaveBeenCalledTimes(1);
    expect(host.open).toBe(true);
  });

  it('cancelar cierra sin confirmar', async () => {
    const { host } = await setup();
    await userEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(host.open).toBe(false);
    expect(host.onConfirm).not.toHaveBeenCalled();
  });

  it('ocupado: no se puede cancelar, cerrar ni confirmar otra vez', async () => {
    const { host } = await setup({ busy: true });
    expect(screen.getByRole('button', { name: 'Cancelar' })).toBeDisabled();
    expect(screen.getByRole('button', { name: /Desactivar/ })).toBeDisabled();
    expect(screen.queryByRole('button', { name: 'Cerrar' })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /Desactivar/ }));
    expect(host.onConfirm).not.toHaveBeenCalled();
  });

  it('si la acción falló muestra el error y el diálogo sigue abierto', async () => {
    await setup({ error: 'No se pudo conectar con el servidor.' });
    expect(screen.getByRole('alert')).toHaveTextContent('No se pudo conectar con el servidor.');
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('sin error no hay alerta', async () => {
    await setup();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});
