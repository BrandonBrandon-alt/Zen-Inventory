import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { ColumnChart, type ColumnItem } from './column-chart';

const ITEMS: ColumnItem[] = [
  { label: 'ago.', value: 100, title: 'Agosto 2026: $ 100' },
  { label: 'sep.', value: 400, title: 'Septiembre 2026: $ 400' },
  { label: 'oct.', value: 0, title: 'Octubre 2026: $ 0' },
];

async function setup(items: ColumnItem[] = ITEMS) {
  await render('<app-column-chart [items]="items" />', { imports: [ColumnChart], componentProperties: { items } });
}

describe('ColumnChart', () => {
  it('cada columna se describe con su texto completo para lectores de pantalla', async () => {
    await setup();
    expect(screen.getByRole('img', { name: 'Septiembre 2026: $ 400' })).toBeInTheDocument();
    expect(screen.getAllByRole('img')).toHaveLength(3);
  });

  it('las alturas son proporcionales a la mayor; un valor positivo no desaparece y el cero queda vacío', async () => {
    await setup([{ label: 'a', value: 1000, title: 'A' }, { label: 'b', value: 500, title: 'B' }, { label: 'c', value: 1, title: 'C' }, { label: 'd', value: 0, title: 'D' }]);
    const heights = screen.getAllByRole('img').map((c) => (c as HTMLElement).style.height);
    expect(heights).toEqual(['88%', '44%', '3%', '0%']);
  });

  it('solo la última (el periodo actual) va en el color principal', async () => {
    await setup();
    const columns = screen.getAllByRole('img');
    expect(columns[2]).toHaveClass('bg-brand');
    expect(columns[0]).not.toHaveClass('bg-brand');
  });

  it('al enfocar una columna aparece su descripción', async () => {
    await setup();
    await userEvent.tab();
    expect(await screen.findByRole('tooltip')).toHaveTextContent('Agosto 2026: $ 100');
  });

  it('sin datos muestra el mensaje', async () => {
    await setup([]);
    expect(screen.getByText('Sin datos todavía')).toBeInTheDocument();
  });
});
