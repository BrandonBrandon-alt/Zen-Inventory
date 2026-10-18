import { render, screen } from '@testing-library/angular';
import { describe, expect, it } from 'vitest';
import { Card } from './card';

describe('Card', () => {
  it('es una región con nombre: su título la etiqueta', async () => {
    await render('<app-card title="Más vendidos">contenido</app-card>', { imports: [Card] });
    const region = screen.getByRole('region', { name: 'Más vendidos' });
    expect(region).toHaveTextContent('contenido');
    expect(screen.getByRole('heading', { level: 2, name: 'Más vendidos' })).toBeInTheDocument();
  });

  it('muestra la descripción solo si se da', async () => {
    await render('<app-card title="A" description="Unidades en el periodo">x</app-card><app-card title="B">y</app-card>', { imports: [Card] });
    expect(screen.getByText('Unidades en el periodo')).toBeInTheDocument();
    expect(screen.getAllByRole('region')).toHaveLength(2);
  });

  it('proyecta las acciones del encabezado', async () => {
    await render('<app-card title="A"><button data-slot="actions">Ver todo</button>x</app-card>', { imports: [Card] });
    expect(screen.getByRole('button', { name: 'Ver todo' })).toBeInTheDocument();
  });

  it('"surface" lleva superficie y marco; "plain" solo una línea superior', async () => {
    await render('<app-card title="A">x</app-card><app-card title="B" variant="plain">y</app-card>', { imports: [Card] });
    const surface = screen.getByRole('region', { name: 'A' }).firstElementChild;
    const plain = screen.getByRole('region', { name: 'B' }).firstElementChild;
    expect(surface).toHaveClass('bg-card', 'border');
    expect(plain).toHaveClass('border-t');
    expect(plain).not.toHaveClass('bg-card');
  });

  it('dos tarjetas tienen títulos con ids distintos', async () => {
    await render('<app-card title="A">x</app-card><app-card title="B">y</app-card>', { imports: [Card] });
    expect(screen.getByRole('heading', { name: 'A' }).id).not.toBe(screen.getByRole('heading', { name: 'B' }).id);
  });
});
