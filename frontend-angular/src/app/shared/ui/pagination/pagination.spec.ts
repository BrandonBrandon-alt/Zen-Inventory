import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Pagination } from './pagination';

const setup = (page: number, total = 42, pageSize = 10) => {
  const pageChange = vi.fn();
  return render(Pagination, { inputs: { page, pageSize, total }, on: { pageChange } }).then(() => pageChange);
};

describe('Pagination', () => {
  it('muestra el rango y la página actual', async () => {
    await setup(2);
    expect(screen.getByText('11–20 de 42')).toBeInTheDocument();
    expect(screen.getByText('Página 2 de 5')).toBeInTheDocument();
  });

  it('la última página recorta el rango al total', async () => {
    await setup(5);
    expect(screen.getByText('41–42 de 42')).toBeInTheDocument();
  });

  it('sin datos dice "Sin resultados" y queda en la página 1 de 1', async () => {
    await setup(1, 0);
    expect(screen.getByText('Sin resultados')).toBeInTheDocument();
    expect(screen.getByText('Página 1 de 1')).toBeInTheDocument();
  });

  it('siguiente y anterior piden la página vecina', async () => {
    const pageChange = await setup(2);
    await userEvent.click(screen.getByRole('button', { name: 'Página siguiente' }));
    await userEvent.click(screen.getByRole('button', { name: 'Página anterior' }));
    expect(pageChange.mock.calls).toEqual([[3], [1]]);
  });

  it('en la primera página no se puede retroceder', async () => {
    const pageChange = await setup(1);
    expect(screen.getByRole('button', { name: 'Página anterior' })).toBeDisabled();
    await userEvent.click(screen.getByRole('button', { name: 'Página anterior' }));
    expect(pageChange).not.toHaveBeenCalled();
  });

  it('en la última página no se puede avanzar', async () => {
    await setup(5);
    expect(screen.getByRole('button', { name: 'Página siguiente' })).toBeDisabled();
  });
});
