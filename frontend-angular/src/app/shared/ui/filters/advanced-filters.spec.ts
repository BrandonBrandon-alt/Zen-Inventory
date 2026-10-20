import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
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

  describe('salida animada', () => {
    afterEach(() => delete (globalThis as { matchMedia?: unknown }).matchMedia);
    const withMotion = () =>
      Object.defineProperty(globalThis, 'matchMedia', { configurable: true, writable: true, value: vi.fn().mockReturnValue({ matches: false }) });

    it('al cerrar con movimiento el panel sale (animate-reveal-out, sin recibir clics) y se quita después', async () => {
      withMotion();
      await setup({ open: true });
      const button = screen.getByRole('button', { name: /Más filtros/ });
      expect(screen.getByRole('group', { name: 'Más filtros' })).toHaveClass('animate-reveal');
      await userEvent.click(button);
      const leaving = screen.getByRole('group', { name: 'Más filtros' });
      expect(leaving).toHaveClass('animate-reveal-out');
      expect(leaving).toHaveClass('pointer-events-none');
      expect(button).toHaveAttribute('aria-expanded', 'false');
      await vi.waitFor(() => expect(screen.queryByRole('group', { name: 'Más filtros' })).not.toBeInTheDocument());
    });

    it('volver a abrirlo mientras sale lo deja abierto', async () => {
      withMotion();
      await setup({ open: true });
      const button = screen.getByRole('button', { name: /Más filtros/ });
      await userEvent.click(button);
      await userEvent.click(button);
      await new Promise((r) => setTimeout(r, 250));
      expect(screen.getByRole('group', { name: 'Más filtros' })).toHaveClass('animate-reveal');
      expect(button).toHaveAttribute('aria-expanded', 'true');
    });
  });
});
