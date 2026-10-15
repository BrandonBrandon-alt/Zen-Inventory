import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Toast } from './toast';

describe('Toast', () => {
  it('muestra el mensaje', async () => {
    await render(Toast, { inputs: { kind: 'error', message: 'No se pudo guardar' } });
    expect(screen.getByText('No se pudo guardar')).toBeInTheDocument();
  });

  it.each([
    ['error', 'alert'],
    ['warning', 'alert'],
    ['success', 'status'],
    ['info', 'status'],
  ] as const)('el tipo %s se anuncia como %s', async (kind, role) => {
    await render(Toast, { inputs: { kind, message: 'Hola' } });
    expect(screen.getByRole(role)).toHaveTextContent('Hola');
  });

  it('el botón de cerrar emite dismissed', async () => {
    const dismissed = vi.fn();
    await render(Toast, { inputs: { kind: 'error', message: 'x' }, on: { dismissed } });
    await userEvent.click(screen.getByRole('button', { name: 'Cerrar aviso' }));
    expect(dismissed).toHaveBeenCalledTimes(1);
  });
});
