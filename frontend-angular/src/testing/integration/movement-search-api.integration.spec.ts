import { provideHttpClient } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { http, HttpResponse } from 'msw';
import { firstValueFrom } from 'rxjs';
import { beforeEach, describe, expect, it } from 'vitest';
import { API_BASE_URL } from '@core/api/api-base-url';
import { type MovementQuery, MovementSearchApi } from '@core/inventory/movement-search-api';
import { server, TEST_API } from '../msw-server';

const SEARCH = `${TEST_API}/api/v1/inventory/movements/search`;
const EXPORT = `${TEST_API}/api/v1/inventory/movements/export`;

const query = (over: Partial<MovementQuery> = {}): MovementQuery => ({
  page: 1,
  size: 15,
  sortBy: 'date',
  ascending: false,
  branchId: null,
  type: null,
  reasons: [],
  from: null,
  to: null,
  productIds: [],
  userId: null,
  minQuantity: null,
  maxQuantity: null,
  onlyObserved: false,
  text: '',
  ...over,
});

describe('MovementSearchApi (contrato HTTP con MSW)', () => {
  let api: MovementSearchApi;
  let params: URLSearchParams;

  beforeEach(() => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ providers: [provideHttpClient(), { provide: API_BASE_URL, useValue: TEST_API }] });
    api = TestBed.inject(MovementSearchApi);
  });

  it('manda la página desde 0, el orden y solo los filtros con valor; listas como parámetros repetidos', async () => {
    server.use(http.get(SEARCH, ({ request }) => ((params = new URL(request.url).searchParams), HttpResponse.json({ content: [], totalElements: 0 }))));
    await firstValueFrom(
      api.search(query({ page: 3, sortBy: 'quantity', ascending: true, branchId: 3, productIds: [7, 8], reasons: ['VENTA', 'MERMA'], from: new Date(2026, 9, 12), text: '  bulto ' })),
    );
    expect(params.get('page')).toBe('2');
    expect(params.get('sortBy')).toBe('quantity');
    expect(params.get('direction')).toBe('asc');
    expect(params.get('branchId')).toBe('3');
    expect(params.getAll('productId')).toEqual(['7', '8']);
    expect(params.getAll('reason')).toEqual(['VENTA', 'MERMA']);
    expect(params.get('from')).toBe('2026-10-12');
    expect(params.get('q')).toBe('bulto');
    for (const key of ['type', 'to', 'userId', 'minQuantity', 'maxQuantity', 'onlyObserved']) expect(params.has(key)).toBe(false);
  });

  it('convierte la respuesta con nombres de respaldo y descarta movimientos incompletos o con motivo desconocido', async () => {
    server.use(
      http.get(SEARCH, () =>
        HttpResponse.json({
          content: [
            { id: 1, type: 'RETIRO', reason: 'VENTA', quantity: 3, date: '2026-10-12T09:00:00', productId: 7, branchId: 3, userId: null, finalBalance: 97 },
            { id: 2, type: 'RETIRO', reason: 'MOTIVO_NUEVO', quantity: 1, date: '2026-10-12T09:00:00', productId: 7, branchId: 3 },
            { id: 3, type: 'INGRESO', reason: 'COMPRA', quantity: 1, date: 'no es fecha', productId: 7, branchId: 3 },
          ],
          totalElements: 40,
          totalIn: 10,
          totalOut: 3,
        }),
      ),
    );
    const page = await firstValueFrom(api.search(query()));
    expect(page.movements.map((m) => m.id)).toEqual([1]);
    expect(page.movements[0]).toMatchObject({ productName: 'Producto 7', branchName: 'Sede 3', userName: 'Sistema', balance: 97 });
    expect(page).toMatchObject({ total: 40, totalIn: 10, totalOut: 3 });
  });

  it('exportar manda los mismos filtros sin paginar', async () => {
    server.use(http.get(EXPORT, ({ request }) => ((params = new URL(request.url).searchParams), HttpResponse.json([]))));
    await firstValueFrom(api.exportAll(query({ branchId: 3, reasons: ['MERMA'] })));
    expect(params.get('branchId')).toBe('3');
    expect(params.getAll('reason')).toEqual(['MERMA']);
    expect(params.has('page')).toBe(false);
  });
});
