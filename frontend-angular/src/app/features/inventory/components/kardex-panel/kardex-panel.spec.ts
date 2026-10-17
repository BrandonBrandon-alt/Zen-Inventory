import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { render, screen, within } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { delay, http, HttpResponse } from 'msw';
import { describe, expect, it, vi } from 'vitest';
import { API_BASE_URL } from '@core/api/api-base-url';
import { errorInterceptor } from '@core/api/error.interceptor';
import { chooseOption } from '@testing/select-helpers';
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

  it('filtrar por producto consulta el kardex de ese producto; "Todos" vuelve al listado general', async () => {
    let kardexCalls = 0;
    server.use(
      http.get(ALL, () => HttpResponse.json([mov({ id: 1 }), mov({ id: 2, productId: 8 })])),
      http.get(KARDEX_7, () => { kardexCalls++; return HttpResponse.json([mov({ id: 9, productId: 7, branchId: undefined })]); }),
    );
    await renderPanel();
    await screen.findAllByText('Tuerca');
    await chooseOption('Filtrar por producto', 'Tornillo');
    await vi.waitFor(() => expect(rowsText()).toHaveLength(1));
    expect(kardexCalls).toBe(1);
    await chooseOption('Filtrar por producto', 'Todos los productos');
    await vi.waitFor(() => expect(rowsText()).toHaveLength(2));
  });

  it('el filtro de producto se puede buscar por nombre', async () => {
    server.use(http.get(ALL, () => HttpResponse.json([])));
    await renderPanel();
    await userEvent.click(screen.getByRole('combobox', { name: 'Filtrar por producto' }));
    await userEvent.type(screen.getByRole('textbox', { name: 'Buscar producto…' }), 'tuer');
    expect(screen.getAllByRole('option').map((o) => o.textContent)).toEqual([expect.stringContaining('Tuerca')]);
  });

  it('descarta la respuesta de una consulta anterior si ya se cambió el filtro (la lenta no pisa a la nueva)', async () => {
    server.use(
      http.get(ALL, async () => { await delay(250); return HttpResponse.json([mov({ id: 1, productId: 7 }), mov({ id: 2, productId: 8 })]); }),
      http.get(KARDEX_7, () => HttpResponse.json([mov({ id: 9, productId: 7, branchId: undefined })])),
    );
    await renderPanel();
    await chooseOption('Filtrar por producto', 'Tornillo'); // mientras la general sigue en camino
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
});
