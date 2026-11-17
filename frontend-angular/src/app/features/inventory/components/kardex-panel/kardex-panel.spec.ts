import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { render, screen, within } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { API_BASE_URL } from '@core/api/api-base-url';
import { errorInterceptor } from '@core/api/error.interceptor';
import { apiErrorBody, server, TEST_API } from '@testing/msw-server';
import type { InventoryItem } from '../../data-access/inventory-api';
import { KardexPanel } from './kardex-panel';

const PRODUCTS: InventoryItem[] = [
  { productId: 7, sku: 'T-1', nombre: 'Tornillo', unit: 'UND', stock: 10, minimum: 2, price: 5, cost: 2 },
  { productId: 8, sku: 'T-2', nombre: 'Tuerca', unit: 'UND', stock: 4, minimum: 0, price: 3, cost: 1 },
];
/** Un movimiento como lo devuelve el servidor: ya trae los nombres. */
const mov = (over: Record<string, unknown>) => ({
  id: 1,
  type: 'INGRESO',
  reason: 'AJUSTE_POSITIVO',
  quantity: 5,
  date: '2026-10-02T10:00:00',
  productId: 7,
  productName: 'Tornillo',
  branchId: 3,
  branchName: 'Sede Central',
  userId: 1,
  userName: 'Ana',
  finalBalance: 15,
  observations: '',
  ...over,
});
const MOVES = [
  mov({ id: 4, productId: 7, type: 'INGRESO', reason: 'AJUSTE_POSITIVO', date: '2026-10-18T09:00:00' }),
  mov({ id: 3, productId: 8, productName: 'Tuerca', type: 'RETIRO', reason: 'MERMA', subReason: 'DAÑO_FISICO', quantity: 2, finalBalance: 4, observations: 'bulto roto' }),
  mov({ id: 2, productId: 8, productName: 'Tuerca', type: 'RETIRO', reason: 'VENTA', quantity: 3, finalBalance: 6 }),
];
const URL_SEARCH = `${TEST_API}/api/v1/inventory/movements/search`;
const URL_EXPORT = `${TEST_API}/api/v1/inventory/movements/export`;

let requests: URLSearchParams[] = [];
const last = () => requests.at(-1)!;

function stub(content: unknown[] = MOVES, totals = { totalElements: content.length, totalIn: 5, totalOut: 5 }) {
  server.use(
    http.get(URL_SEARCH, ({ request }) => {
      requests.push(new URL(request.url).searchParams);
      return HttpResponse.json({ content, page: 0, size: 15, totalPages: 1, ...totals });
    }),
  );
}

const renderPanel = () =>
  render(`<app-kardex-panel [branchId]="3" [products]="products" />`, {
    imports: [KardexPanel],
    componentProperties: { products: PRODUCTS },
    providers: [provideHttpClient(withInterceptors([errorInterceptor])), { provide: API_BASE_URL, useValue: TEST_API }],
  });

const filter = () => screen.getByRole('combobox', { name: 'Filtrar por producto' });
/** Marca (o desmarca) opciones en un selector de varias opciones; la lista queda abierta entre una y otra. */
const toggle = async (combo: HTMLElement, ...names: string[]) => {
  await userEvent.click(combo);
  for (const name of names) await userEvent.click(screen.getByRole('option', { name: new RegExp(`^${name}`) }));
  await userEvent.keyboard('{Escape}');
};
const rowsText = () => screen.getAllByRole('row').slice(1).map((r) => r.textContent ?? '');
const expectLastSearch = (params: Record<string, string | string[] | null>) =>
  vi.waitFor(() => {
    for (const [key, value] of Object.entries(params)) {
      if (Array.isArray(value)) expect(last().getAll(key)).toEqual(value);
      else expect(last().get(key)).toBe(value);
    }
  });

describe('KardexPanel', () => {
  beforeEach(() => {
    requests = [];
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('pide al servidor la primera página de la sucursal, del más reciente al más antiguo', async () => {
    stub();
    await renderPanel();
    await expectLastSearch({ branchId: '3', page: '0', size: '15', sortBy: 'date', direction: 'desc', productId: [], reason: [] });
  });

  it('muestra producto, tipo, motivo (con su categoría), cantidad con signo y el saldo que manda el servidor', async () => {
    stub();
    await renderPanel();
    await vi.waitFor(() => expect(rowsText()).toHaveLength(3));
    const merma = screen.getByRole('row', { name: /bulto roto/ });
    expect(within(merma).getByText('Tuerca')).toBeInTheDocument();
    expect(within(merma).getByText('Retiro')).toBeInTheDocument();
    expect(merma).toHaveTextContent(/Merma · Daño físico/);
    expect(merma).toHaveTextContent('−2');
    expect(merma).toHaveTextContent('4');
  });

  it('el resumen de entradas y salidas es de todo lo filtrado (lo calcula el servidor)', async () => {
    stub(MOVES, { totalElements: 120, totalIn: 300, totalOut: 180 });
    await renderPanel();
    expect(await screen.findByText('120 movimientos: entraron 300 unidades y salieron 180')).toBeInTheDocument();
  });

  it('con más filas que una página, «Página siguiente» pide la siguiente', async () => {
    stub(MOVES, { totalElements: 40, totalIn: 0, totalOut: 0 });
    await renderPanel();
    await vi.waitFor(() => expect(rowsText()).toHaveLength(3));
    await userEvent.click(screen.getByRole('button', { name: 'Página siguiente' }));
    await expectLastSearch({ page: '1' });
  });

  it('ordenar por cantidad lo pide al servidor', async () => {
    stub();
    await renderPanel();
    await vi.waitFor(() => expect(rowsText()).toHaveLength(3));
    await userEvent.click(screen.getByRole('button', { name: /Cantidad/ }));
    await expectLastSearch({ sortBy: 'quantity', direction: 'asc' });
  });

  it('sin movimientos muestra el estado vacío', async () => {
    stub([]);
    await renderPanel();
    expect(await screen.findByText('Sin movimientos')).toBeInTheDocument();
  });

  it('si falla, muestra el error en la tabla y reintentar recupera', async () => {
    server.use(http.get(URL_SEARCH, () => HttpResponse.json(apiErrorBody(500, 'INTERNAL_ERROR', 'Falla de prueba'), { status: 500 })));
    await renderPanel();
    expect(await screen.findByRole('alert')).toHaveTextContent('Falla de prueba');
    stub();
    await userEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
    await vi.waitFor(() => expect(rowsText()).toHaveLength(3));
  });

  describe('filtros', () => {
    it('varios productos se mandan como lista y quitarlos vuelve a todos', async () => {
      stub();
      await renderPanel();
      await vi.waitFor(() => expect(rowsText()).toHaveLength(3));
      await toggle(filter(), 'Tornillo', 'Tuerca');
      await expectLastSearch({ productId: ['7', '8'], page: '0' });
      await userEvent.click(screen.getByRole('button', { name: /Quitar filtro Producto/ }));
      await expectLastSearch({ productId: [] });
    });

    it('el filtro de producto se puede buscar por nombre', async () => {
      stub();
      await renderPanel();
      await userEvent.type(filter(), 'tuer');
      expect(screen.getAllByRole('option').map((o) => o.textContent)).toEqual([expect.stringContaining('Tuerca')]);
    });

    it('el tipo y varios motivos se mandan al servidor', async () => {
      stub();
      await renderPanel();
      await vi.waitFor(() => expect(rowsText()).toHaveLength(3));
      await userEvent.click(screen.getByRole('radio', { name: 'Retiros' }));
      await toggle(screen.getByRole('combobox', { name: 'Filtrar por motivo' }), 'Venta', 'Merma');
      await expectLastSearch({ type: 'RETIRO', reason: ['VENTA', 'MERMA'] });
    });

    it('el rango de fechas se manda como días locales', async () => {
      vi.useFakeTimers({ toFake: ['Date'] });
      vi.setSystemTime(new Date(2026, 9, 20, 10, 0));
      stub();
      await renderPanel();
      await vi.waitFor(() => expect(rowsText()).toHaveLength(3));
      await userEvent.click(screen.getByRole('button', { name: 'Desde' }));
      await userEvent.click(screen.getByRole('button', { name: /12 de octubre de 2026/ }));
      await userEvent.click(screen.getByRole('button', { name: 'Hasta' }));
      await userEvent.click(screen.getByRole('button', { name: /13 de octubre de 2026/ }));
      await expectLastSearch({ from: '2026-10-12', to: '2026-10-13' });
    });

    it('la búsqueda se manda una vez, al dejar de escribir', async () => {
      stub();
      await renderPanel();
      await vi.waitFor(() => expect(rowsText()).toHaveLength(3));
      const before = requests.length;
      await userEvent.type(screen.getByRole('searchbox', { name: 'Buscar en el kardex' }), ' bulto ');
      await expectLastSearch({ q: 'bulto' });
      expect(requests.length).toBe(before + 1);
    });

    it('los filtros se ven como etiquetas y «Quitar filtros» los restablece', async () => {
      stub();
      await renderPanel();
      await vi.waitFor(() => expect(rowsText()).toHaveLength(3));
      await userEvent.click(screen.getByRole('radio', { name: 'Ingresos' }));
      await toggle(filter(), 'Tornillo');
      expect(screen.getByRole('button', { name: 'Quitar filtro Tipo: Ingresos' })).toBeInTheDocument();
      await userEvent.click(screen.getByRole('button', { name: 'Quitar filtros' }));
      await expectLastSearch({ type: null, productId: [] });
    });

    it('si ningún movimiento coincide lo dice y propone quitar filtros', async () => {
      stub();
      await renderPanel();
      await vi.waitFor(() => expect(rowsText()).toHaveLength(3));
      stub([]);
      await userEvent.click(screen.getByRole('radio', { name: 'Retiros' }));
      expect(await screen.findByText('Ningún movimiento coincide')).toBeInTheDocument();
    });
  });

  it('exportar trae todo lo filtrado del servidor, no solo la página', async () => {
    stub(MOVES, { totalElements: 40, totalIn: 0, totalOut: 0 });
    let exported: URLSearchParams | null = null;
    server.use(
      http.get(URL_EXPORT, ({ request }) => {
        exported = new URL(request.url).searchParams;
        return HttpResponse.json([...MOVES, mov({ id: 9, productName: 'Arandela' })]);
      }),
    );
    let csv = '';
    vi.spyOn(URL, 'createObjectURL').mockImplementation((blob: Blob | MediaSource) => (void (blob as Blob).text().then((t) => (csv = t)), 'blob:csv'));
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
    await renderPanel();
    await vi.waitFor(() => expect(rowsText()).toHaveLength(3));
    await userEvent.click(screen.getByRole('button', { name: /Exportar CSV/ }));
    await vi.waitFor(() => expect(csv).toContain('Arandela'));
    expect(exported!.get('branchId')).toBe('3');
    expect(exported!.has('page')).toBe(false);
  });
});
