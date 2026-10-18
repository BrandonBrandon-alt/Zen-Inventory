import { render, screen } from '@testing-library/angular';
import { describe, expect, it } from 'vitest';
import { Logo } from './logo';

describe('Logo', () => {
  it('sin texto es una imagen accesible con el nombre del producto', async () => {
    await render(Logo);
    expect(screen.getByRole('img', { name: 'Zen Inventory' })).toBeInTheDocument();
    expect(screen.queryByText('Zen Inventory')).not.toBeInTheDocument();
  });

  it('con showText muestra el nombre y oculta el dibujo a los lectores de pantalla', async () => {
    await render(Logo, { inputs: { showText: true } });
    expect(screen.getByText('Zen Inventory')).toBeInTheDocument();
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    // El dibujo es decorativo cuando ya hay texto: no debe leerse dos veces.
    expect(document.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
  });

  it('respeta el tamaño pedido', async () => {
    await render(Logo, { inputs: { size: 120 } });
    expect(screen.getByRole('img')).toHaveAttribute('width', '120');
  });
});
