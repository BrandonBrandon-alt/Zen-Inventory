import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { expectAccessible } from '@testing/a11y';
import { AdvancedFilters } from './advanced-filters';

const TEMPLATE = `<app-advanced-filters [(open)]="open" [activeCount]="count"><label>Vendedor <input /></label></app-advanced-filters>`;
const setup = (props: { open?: boolean; count?: number } = {}) =>
  render(TEMPLATE, { imports: [AdvancedFilters], componentProperties: { open: false, count: 0, ...props } });

describe('AdvancedFilters', () => {
  it('cerrado no muestra los campos; el botón los abre y los cierra', async () => {
    await setup();
    const button = screen.getByRole('button', { name: /Más filtros/ });
    expect(button).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByLabelText('Vendedor')).not.toBeInTheDocument();
    await userEvent.click(button);
    expect(button).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByLabelText('Vendedor')).toBeInTheDocument();
    expect(button).toHaveAttribute('aria-controls', screen.getByRole('group', { name: 'Más filtros' }).id);
    await userEvent.click(button);
    expect(screen.queryByLabelText('Vendedor')).not.toBeInTheDocument();
  });

  it('muestra cuántos filtros hay activos aunque esté cerrado', async () => {
    await setup({ count: 2 });
    expect(screen.getByLabelText('2 filtros activos')).toHaveTextContent('2');
  });

  it('con un solo filtro activo lo dice en singular y sin ninguno no muestra la cifra', async () => {
    await setup({ count: 1 });
    expect(screen.getByLabelText('1 filtro activo')).toBeInTheDocument();
  });

  it('no tiene problemas de accesibilidad detectables, abierto y cerrado', async () => {
    await setup({ open: true, count: 1 });
    await expectAccessible();
  });
});
