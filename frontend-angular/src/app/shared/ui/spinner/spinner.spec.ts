import { render, screen } from '@testing-library/angular';
import { describe, expect, it } from 'vitest';
import { Spinner } from './spinner';

describe('Spinner', () => {
  it('se anuncia como estado de carga accesible', async () => {
    await render(Spinner);
    expect(screen.getByRole('status', { name: 'Cargando' })).toBeInTheDocument();
  });

  it('respeta el tamaño pedido', async () => {
    await render(Spinner, { inputs: { size: 40 } });
    const spinner = screen.getByRole('status');
    expect(spinner).toHaveAttribute('width', '40');
    expect(spinner).toHaveAttribute('height', '40');
  });
});
