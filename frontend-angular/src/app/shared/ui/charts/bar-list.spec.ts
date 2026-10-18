import { render, screen } from '@testing-library/angular';
import { describe, expect, it } from 'vitest';
import { BarList, type BarItem } from './bar-list';

const ITEMS: BarItem[] = [
  { label: 'Tornillo', value: 200, note: '12 ventas' },
  { label: 'Tuerca', value: 100 },
  { label: 'Arandela', value: 0 },
];

const bars = () => [...document.querySelectorAll<HTMLElement>('[style*="width"]')];

async function setup(items: BarItem[] = ITEMS, extra = '') {
  await render(`<app-bar-list [items]="items" [format]="format" ${extra} />`, {
    imports: [BarList],
    componentProperties: { items, format: (n: number) => `${n} u.` },
  });
}

describe('BarList', () => {
  it('lista nombre, valor y nota como texto (la barra solo refuerza)', async () => {
    await setup();
    expect(screen.getAllByRole('listitem')).toHaveLength(3);
    expect(screen.getByText('Tornillo')).toBeInTheDocument();
    expect(screen.getByText('200 u.')).toBeInTheDocument();
    expect(screen.getByText('12 ventas')).toBeInTheDocument();
  });

  it('el ancho es proporcional al mayor; un valor positivo nunca queda en cero y el cero queda vacío', async () => {
    await setup([{ label: 'A', value: 1000 }, { label: 'B', value: 500 }, { label: 'C', value: 1 }, { label: 'D', value: 0 }]);
    expect(bars().map((b) => b.style.width)).toEqual(['100%', '50%', '2%', '0%']);
  });

  it('solo la mayor va en el color principal', async () => {
    await setup();
    const fills = bars();
    expect(fills[0]).toHaveClass('bg-brand');
    expect(fills[1]).not.toHaveClass('bg-brand');
  });

  it('sin resaltar, ninguna va en el color principal', async () => {
    await render('<app-bar-list [items]="items" [highlightFirst]="false" />', { imports: [BarList], componentProperties: { items: ITEMS } });
    expect(bars()[0]).not.toHaveClass('bg-brand');
  });

  it('sin datos muestra el mensaje', async () => {
    await setup([]);
    expect(screen.getByText('Sin datos todavía')).toBeInTheDocument();
    expect(screen.queryByRole('list')).not.toBeInTheDocument();
  });

  it('con todos los valores en cero no hay barras con ancho ni división entre cero', async () => {
    await setup([{ label: 'A', value: 0 }]);
    expect(bars()[0].style.width).toBe('0%');
  });
});
