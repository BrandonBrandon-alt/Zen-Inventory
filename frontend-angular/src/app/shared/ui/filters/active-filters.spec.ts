import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { expectAccessible } from '@testing/a11y';
import { ActiveFilters } from './active-filters';

const FILTERS = [
  { id: 'status', label: 'Estado', text: 'Anulada' },
  { id: 'seller', label: 'Vendedor', text: 'Luis' },
];

describe('ActiveFilters', () => {
  it('sin filtros no dibuja nada', async () => {
    const { container } = await render(ActiveFilters, { inputs: { filters: [] } });
    expect(container.querySelector('[role="group"]')).toBeNull();
  });

  it('muestra cada filtro con su nombre y valor, y se quita uno a uno por su id', async () => {
    const removed = vi.fn();
    await render(ActiveFilters, { inputs: { filters: FILTERS }, on: { removed } });
    expect(screen.getByRole('group', { name: 'Filtros aplicados' })).toHaveTextContent('Estado:');
    await userEvent.click(screen.getByRole('button', { name: 'Quitar filtro Vendedor: Luis' }));
    expect(removed).toHaveBeenCalledWith('seller');
  });

  it('«Quitar filtros» los quita todos', async () => {
    const cleared = vi.fn();
    await render(ActiveFilters, { inputs: { filters: FILTERS }, on: { cleared } });
    await userEvent.click(screen.getByRole('button', { name: 'Quitar filtros' }));
    expect(cleared).toHaveBeenCalledTimes(1);
  });

  it('no tiene problemas de accesibilidad detectables', async () => {
    await render(ActiveFilters, { inputs: { filters: FILTERS } });
    await expectAccessible();
  });
});
