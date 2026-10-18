import { render, screen } from '@testing-library/angular';
import { describe, expect, it } from 'vitest';
import { EmptyState } from './empty-state';

describe('EmptyState', () => {
  it('muestra el título y la descripción', async () => {
    await render(EmptyState, { inputs: { title: 'Sin sucursales', description: 'Crea la primera para empezar.' } });
    expect(screen.getByText('Sin sucursales')).toBeInTheDocument();
    expect(screen.getByText('Crea la primera para empezar.')).toBeInTheDocument();
  });

  it('la descripción es opcional', async () => {
    await render(EmptyState, { inputs: { title: 'Sin datos' } });
    expect(screen.getByText('Sin datos')).toBeInTheDocument();
  });

  it('proyecta el icono y la acción', async () => {
    await render(
      `<app-empty-state title="Vacío">
         <span data-slot="icon">ICONO</span>
         <button data-slot="action">Crear sucursal</button>
       </app-empty-state>`,
      { imports: [EmptyState] },
    );
    expect(screen.getByText('ICONO')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Crear sucursal' })).toBeInTheDocument();
  });
});
