import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { AreaChart, type SeriesPoint } from './area-chart';

const POINTS: SeriesPoint[] = [
  { label: '1 oct', value: 100 },
  { label: '2 oct', value: 300 },
  { label: '3 oct', value: 200 },
];
const money = (n: number) => `$${n}`;

async function setup(points: SeriesPoint[] = POINTS) {
  await render('<app-area-chart [points]="points" [format]="format" ariaLabel="Ingresos por día" />', {
    imports: [AreaChart],
    componentProperties: { points, format: money },
  });
  return screen.getByRole('group');
}

describe('AreaChart', () => {
  it('expone un resumen y una tabla con todos los datos para lectores de pantalla', async () => {
    await setup();
    expect(screen.getByRole('group')).toHaveAccessibleName(/Ingresos por día/);
    const table = screen.getByRole('table', { name: 'Ingresos por día' });
    expect(table).toHaveTextContent('2 oct');
    expect(table).toHaveTextContent('$300');
    expect(screen.getAllByRole('row')).toHaveLength(4); // encabezado + 3 datos
  });

  it('muestra el máximo y las fechas del primer, del medio y del último punto', async () => {
    await setup();
    expect(screen.getByText('Máx. $300')).toBeInTheDocument();
    expect(screen.getAllByText('1 oct').length).toBeGreaterThan(0);
    expect(screen.getAllByText('3 oct').length).toBeGreaterThan(0);
  });

  it('dibuja la línea y el relleno', async () => {
    await setup();
    const paths = document.querySelectorAll('svg path');
    expect(paths).toHaveLength(2);
    expect(paths[1].getAttribute('d')).toMatch(/^M/);
  });

  it('con el teclado, al enfocar muestra el último valor y las flechas recorren los puntos', async () => {
    const chart = await setup();
    await userEvent.tab();
    expect(chart).toHaveFocus();
    expect(document.body).toHaveTextContent('3 oct');
    expect(document.querySelector('circle')).not.toBeNull();
    await userEvent.keyboard('{ArrowLeft}');
    expect(document.querySelector('.shadow-xl')).toHaveTextContent('2 oct');
    expect(document.querySelector('.shadow-xl')).toHaveTextContent('$300');
    await userEvent.keyboard('{Home}');
    expect(document.querySelector('.shadow-xl')).toHaveTextContent('$100');
    await userEvent.keyboard('{End}');
    expect(document.querySelector('.shadow-xl')).toHaveTextContent('$200');
  });

  it('no se sale de los extremos con las flechas', async () => {
    await setup();
    await userEvent.tab();
    await userEvent.keyboard('{ArrowRight}{ArrowRight}');
    expect(document.querySelector('.shadow-xl')).toHaveTextContent('$200');
    await userEvent.keyboard('{Home}{ArrowLeft}{ArrowLeft}');
    expect(document.querySelector('.shadow-xl')).toHaveTextContent('$100');
  });

  it('al salir del gráfico el valor desaparece', async () => {
    await setup();
    await userEvent.tab();
    expect(document.querySelector('.shadow-xl')).not.toBeNull();
    await userEvent.tab();
    expect(document.querySelector('.shadow-xl')).toBeNull();
  });

  it('con el cursor muestra el punto más cercano', async () => {
    const chart = await setup();
    vi.spyOn(chart, 'getBoundingClientRect').mockReturnValue({ left: 0, width: 720, top: 0, height: 240, right: 720, bottom: 240, x: 0, y: 0, toJSON: () => ({}) });
    // 720 de ancho = viewBox: x=715 está al final de la serie (tercer punto)
    chart.dispatchEvent(new PointerEvent('pointermove', { clientX: 715, bubbles: true }));
    await vi.waitFor(() => expect(document.querySelector('.shadow-xl')).toHaveTextContent('3 oct'));
    chart.dispatchEvent(new PointerEvent('pointerleave', { bubbles: true }));
    await vi.waitFor(() => expect(document.querySelector('.shadow-xl')).toBeNull());
  });

  it('sin datos no dibuja relleno ni etiquetas y las flechas no fallan', async () => {
    await setup([]);
    await userEvent.tab();
    await userEvent.keyboard('{ArrowRight}');
    expect(document.querySelector('.shadow-xl')).toBeNull();
    expect(screen.queryByText(/Máx\./)).not.toBeInTheDocument();
  });

  it('un solo dato también se muestra (sin relleno)', async () => {
    await setup([{ label: 'Hoy', value: 50 }]);
    expect(document.querySelectorAll('svg path')).toHaveLength(1);
    await userEvent.tab();
    expect(document.querySelector('.shadow-xl')).toHaveTextContent('$50');
  });
});
