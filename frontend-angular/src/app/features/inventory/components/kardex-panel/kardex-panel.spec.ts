import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { render, screen, within } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { delay, http, HttpResponse } from 'msw';
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
const mov = (over: Record<string, unknown>) => ({ id: 1, type: 'INGRESO', reason: 'AJUSTE_POSITIVO', quantity: 5, date: '2026-01-02T10:00:00', productId: 7, branchId: 3, finalBalance: 15, observations: '', ...over });
const ALL = `${TEST_API}/api/v1/inventory/movements`;
const KARDEX_7 = `${TEST_API}/api/v1/inventory/branches/3/products/7/kardex`;

const renderPanel = () =>
  render(`<app-kardex-panel [branchId]="3" [products]="products" />`, {
    imports: [KardexPanel],
    componentProperties: { products: PRODUCTS },
    providers: [provideHttpClient(withInterceptors([errorInterceptor])), { provide: API_BASE_URL, useValue: TEST_API }],
  });

const filter = () => screen.getByRole('combobox', { name: 'Filtrar por producto' });
/** Marca (o desmarca) productos en el filtro de varias opciones; la lista queda abierta entre una y otra. */
const toggleProducts = async (...names: string[]) => {
  await userEvent.click(filter());
  for (const name of names) await userEvent.click(screen.getByRole('option', { name: new RegExp(`^${name}`) }));
  await userEvent.keyboard('{Escape}');
};

const rowsText = () => screen.getAllByRole('row').slice(1).map((r) => r.textContent ?? '');

describe('KardexPanel', () => {
  it('muestra los movimientos de la sucursal con producto, tipo, motivo, cantidad con signo y saldo', async () => {
    server.use(
      http.get(ALL, () =>
        HttpResponse.json([
          mov({ id: 1 }),
          mov({ id: 2, type: 'RETIRO', reason: 'MERMA', subReason: 'DAÑO_FISICO', quantity: 2, finalBalance: 13, productId: 8, date: '2026-01-03T10:00:00', observations: 'bulto roto' }),
        ]),
      ),
    );
    await renderPanel();
    expect(await screen.findByText('Tuerca')).toBeInTheDocument();
    const [first, second] = rowsText();
    expect(first).toContain('Tuerca');
    expect(first).toContain('Retiro');
    expect(first).toContain('Merma · Daño físico');
    expect(first).toContain('−2');
    expect(first).toContain('bulto roto');
    expect(second).toContain('Tornillo');
    expect(second).toContain('Ingreso');
    expect(second).toContain('+5');
  });

  it('sin movimientos muestra el estado vacío', async () => {
    server.use(http.get(ALL, () => HttpResponse.json([])));
    await renderPanel();
    expect(await screen.findByText('Sin movimientos')).toBeInTheDocument();
  });

  it('filtrar por un producto consulta su kardex; quitarlo vuelve al listado general', async () => {
    let kardexCalls = 0;
    server.use(
      http.get(ALL, () => HttpResponse.json([mov({ id: 1 }), mov({ id: 2, productId: 8 })])),
      http.get(KARDEX_7, () => { kardexCalls++; return HttpResponse.json([mov({ id: 9, productId: 7, branchId: undefined })]); }),
    );
    await renderPanel();
    await screen.findAllByText('Tuerca');
    await toggleProducts('Tornillo');
    await vi.waitFor(() => expect(rowsText()).toHaveLength(1));
    expect(kardexCalls).toBe(1);
    await userEvent.click(screen.getByRole('button', { name: 'Quitar Tornillo' }));
    await vi.waitFor(() => expect(rowsText()).toHaveLength(2));
  });

  it('con varios productos usa el listado general y muestra solo los movimientos de los elegidos', async () => {
    server.use(
      http.get(ALL, () => HttpResponse.json([mov({ id: 1, productId: 7 }), mov({ id: 2, productId: 8 }), mov({ id: 3, productId: 9 })])),
      http.get(KARDEX_7, () => HttpResponse.json([mov({ id: 9, productId: 7 })])),
    );
    await renderPanel();
    await vi.waitFor(() => expect(rowsText()).toHaveLength(3));
    await toggleProducts('Tornillo', 'Tuerca');
    await vi.waitFor(() => expect(rowsText()).toHaveLength(2));
    expect(rowsText().join(' ')).not.toContain('Producto 9');
    expect(rowsText().join(' ')).toContain('Tuerca');
  });

  it('el filtro de producto se puede buscar por nombre', async () => {
    server.use(http.get(ALL, () => HttpResponse.json([])));
    await renderPanel();
    await userEvent.type(filter(), 'tuer');
    expect(screen.getAllByRole('option').map((o) => o.textContent)).toEqual([expect.stringContaining('Tuerca')]);
  });

  it('descarta la respuesta de una consulta anterior si ya se cambió el filtro (la lenta no pisa a la nueva)', async () => {
    server.use(
      http.get(ALL, async () => { await delay(250); return HttpResponse.json([mov({ id: 1, productId: 7 }), mov({ id: 2, productId: 8 })]); }),
      http.get(KARDEX_7, () => HttpResponse.json([mov({ id: 9, productId: 7, branchId: undefined })])),
    );
    await renderPanel();
    await toggleProducts('Tornillo'); // mientras la general sigue en camino
    await vi.waitFor(() => expect(rowsText()).toHaveLength(1));
    await new Promise((resolve) => setTimeout(resolve, 400)); // llega la respuesta tardía
    expect(rowsText()).toHaveLength(1);
  });

  it('si falla, muestra el error en la tabla (sin aviso global) y reintentar recupera', async () => {
    let calls = 0;
    server.use(
      http.get(ALL, () => {
        calls++;
        return calls === 1 ? HttpResponse.json(apiErrorBody(500, 'INTERNAL_ERROR', 'Falla de prueba'), { status: 500 }) : HttpResponse.json([mov({ id: 1 })]);
      }),
    );
    await renderPanel();
    expect(await screen.findByRole('alert')).toHaveTextContent('Falla de prueba');
    await userEvent.click(within(screen.getByRole('alert').parentElement as HTMLElement).getByRole('button', { name: 'Reintentar' }));
    expect(await screen.findByText('Tornillo')).toBeInTheDocument();
  });
  describe('filtros', () => {
    // Hoy: 20 de octubre de 2026, para que el calendario de los filtros abra en octubre.
    beforeEach(() => {
      vi.useFakeTimers({ toFake: ['Date'] });
      vi.setSystemTime(new Date(2026, 9, 20, 10, 0));
    });
    afterEach(() => vi.useRealTimers());

    const MOVES = [
      mov({ id: 1, productId: 7, type: 'INGRESO', reason: 'COMPRA', date: '2026-10-05T09:00:00', observations: 'Factura 123' }),
      mov({ id: 2, productId: 8, type: 'RETIRO', reason: 'VENTA', date: '2026-10-12T09:00:00' }),
      mov({ id: 3, productId: 8, type: 'RETIRO', reason: 'MERMA', subReason: 'DAÑO_FISICO', date: '2026-10-13T23:30:00', observations: 'bulto roto' }),
      mov({ id: 4, productId: 7, type: 'INGRESO', reason: 'AJUSTE_POSITIVO', date: '2026-10-18T09:00:00' }),
    ];
    const load = async () => {
      server.use(http.get(ALL, () => HttpResponse.json(MOVES)));
      await renderPanel();
      await vi.waitFor(() => expect(rowsText()).toHaveLength(4));
    };

    it('el tipo deja solo ingresos o solo retiros', async () => {
      await load();
      await userEvent.click(screen.getByRole('radio', { name: 'Retiros' }));
      expect(rowsText()).toHaveLength(2);
      expect(rowsText().every((r) => r.includes('Retiro'))).toBe(true);
      await userEvent.click(screen.getByRole('radio', { name: 'Ingresos' }));
      expect(rowsText().every((r) => r.includes('Ingreso'))).toBe(true);
    });

    it('el motivo admite varios a la vez', async () => {
      await load();
      await userEvent.click(screen.getByRole('combobox', { name: 'Filtrar por motivo' }));
      await userEvent.click(screen.getByRole('option', { name: /^Compra/ }));
      await userEvent.click(screen.getByRole('option', { name: /^Merma/ }));
      expect(rowsText()).toHaveLength(2);
      expect(rowsText().join(' ')).toContain('Merma');
      expect(rowsText().join(' ')).toContain('Compra');
    });

    it('el rango de fechas incluye completo el día «Hasta»', async () => {
      await load();
      await userEvent.click(screen.getByRole('button', { name: 'Desde' }));
      await userEvent.click(screen.getByRole('button', { name: /12 de octubre de 2026/ }));
      await userEvent.click(screen.getByRole('button', { name: 'Hasta' }));
      await userEvent.click(screen.getByRole('button', { name: /13 de octubre de 2026/ }));
      // El movimiento del 13 a las 23:30 entra: el día «Hasta» cuenta completo.
      expect(rowsText()).toHaveLength(2);
      expect(rowsText().join(' ')).toContain('Merma');
    });

    it('la búsqueda mira producto, motivo y observaciones, sin importar tildes ni mayúsculas', async () => {
      await load();
      await userEvent.type(screen.getByRole('searchbox', { name: 'Buscar en el kardex' }), 'FACTURA');
      expect(rowsText()).toHaveLength(1);
      await userEvent.clear(screen.getByRole('searchbox', { name: 'Buscar en el kardex' }));
      await userEvent.type(screen.getByRole('searchbox', { name: 'Buscar en el kardex' }), 'merma');
      expect(rowsText()).toHaveLength(1);
      await userEvent.clear(screen.getByRole('searchbox', { name: 'Buscar en el kardex' }));
      await userEvent.type(screen.getByRole('searchbox', { name: 'Buscar en el kardex' }), 'tuerca');
      expect(rowsText()).toHaveLength(2);
    });

    it('los filtros se combinan, se ven como etiquetas y «Quitar filtros» los restablece', async () => {
      await load();
      await userEvent.click(screen.getByRole('radio', { name: 'Retiros' }));
      await userEvent.type(screen.getByRole('searchbox', { name: 'Buscar en el kardex' }), 'bulto');
      expect(rowsText()).toHaveLength(1);
      const chips = screen.getByRole('group', { name: 'Filtros aplicados' });
      expect(chips).toHaveTextContent('Tipo:');
      expect(chips).toHaveTextContent('Búsqueda:');
      await userEvent.click(screen.getByRole('button', { name: 'Quitar filtro Tipo: Retiros' }));
      expect(rowsText()).toHaveLength(1);
      await userEvent.click(screen.getByRole('button', { name: 'Quitar filtros' }));
      expect(rowsText()).toHaveLength(4);
      expect(screen.queryByRole('group', { name: 'Filtros aplicados' })).not.toBeInTheDocument();
    });

    it('si ningún movimiento coincide lo dice y propone quitar filtros', async () => {
      await load();
      await userEvent.type(screen.getByRole('searchbox', { name: 'Buscar en el kardex' }), 'zzzz');
      expect(await screen.findByText('Ningún movimiento coincide')).toBeInTheDocument();
      expect(screen.getByText('Prueba quitando algún filtro.')).toBeInTheDocument();
    });
  });
});
