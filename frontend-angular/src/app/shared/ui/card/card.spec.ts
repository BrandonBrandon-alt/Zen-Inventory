import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
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

  it('con `hint` muestra un icono de ayuda que explica la tarjeta sin cambiar el nombre de la región', async () => {
    await render('<app-card title="Más vendidos" hint="Los productos con más unidades vendidas.">x</app-card>', { imports: [Card] });
    expect(screen.getByRole('region', { name: 'Más vendidos' })).toBeInTheDocument();
    await userEvent.hover(screen.getByRole('button', { name: 'Qué significa: Más vendidos' }));
    expect(await screen.findByRole('tooltip')).toHaveTextContent('Los productos con más unidades vendidas.');
  });

  it('sin `hint` no hay icono de ayuda', async () => {
    await render('<app-card title="A">x</app-card>', { imports: [Card] });
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
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
