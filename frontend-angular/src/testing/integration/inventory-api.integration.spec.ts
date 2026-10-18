import { provideHttpClient } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { http, HttpResponse } from 'msw';
import { firstValueFrom } from 'rxjs';
import { beforeEach, describe, expect, it } from 'vitest';
import { API_BASE_URL } from '@core/api/api-base-url';
import { AuthStore } from '@core/auth/session/auth-store';
import { InventoryApi, stockLevel } from '../../app/features/inventory/data-access/inventory-api';
import { server, TEST_API } from '../msw-server';

const PRODUCTS = `${TEST_API}/api/catalog/products`;
const inventoryUrl = (branch: number) => `${TEST_API}/api/v1/inventory/branches/${branch}`;

describe('InventoryApi (contrato HTTP con MSW)', () => {
  let api: InventoryApi;

  beforeEach(() => {
    localStorage.clear();
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ providers: [provideHttpClient(), { provide: API_BASE_URL, useValue: TEST_API }] });
    TestBed.inject(AuthStore).start({ token: 't', email: 'a@z.co', nombre: 'Ana', rol: 'ADMIN', id: 42 });
    api = TestBed.inject(InventoryApi);
  });

  describe('list', () => {
    it('une productos con su existencia; los que no tienen registro quedan en 0', async () => {
      server.use(
        http.get(PRODUCTS, () =>
          HttpResponse.json([
            { id: 1, sku: ' A-1 ', nombre: ' Tornillo ', unitAbbreviation: 'UND', precioVenta: 5, costoPromedio: 2, activo: true },
            { id: 2, sku: 'B-2', nombre: 'Tuerca', unitAbbreviation: 'KG', precioVenta: 1, costoPromedio: 0.5, activo: true },
          ]),
        ),
        http.get(inventoryUrl(3), () => HttpResponse.json([{ productId: 1, stockActual: 12, stockMinimo: 5 }])),
      );
      expect(await firstValueFrom(api.list(3))).toEqual([
        { productId: 1, sku: 'A-1', nombre: 'Tornillo', unit: 'UND', stock: 12, minimum: 5, price: 5, cost: 2 },
        { productId: 2, sku: 'B-2', nombre: 'Tuerca', unit: 'KG', stock: 0, minimum: 0, price: 1, cost: 0.5 },
      ]);
    });

    it('omite productos inactivos y los que no se pueden identificar', async () => {
      server.use(
        http.get(PRODUCTS, () =>
          HttpResponse.json([{ id: 1, nombre: 'Viejo', activo: false }, { nombre: 'Sin id' }, { id: 3, nombre: '  ' }, { id: 4, nombre: 'Válido' }]),
        ),
        http.get(inventoryUrl(1), () => HttpResponse.json([])),
      );
      expect((await firstValueFrom(api.list(1))).map((i) => i.productId)).toEqual([4]);
    });

    it('un fallo de cualquiera de las dos consultas es un error', async () => {
      server.use(http.get(PRODUCTS, () => HttpResponse.json([])), http.get(inventoryUrl(1), () => new HttpResponse(null, { status: 500 })));
      await expect(firstValueFrom(api.list(1))).rejects.toBeTruthy();
    });
  });

  describe('stockLevel', () => {
    it('agotado, crítico (en o bajo el mínimo) y normal; sin mínimo no hay crítico', () => {
      expect(stockLevel({ stock: 0, minimum: 5 })).toBe('out');
      expect(stockLevel({ stock: -2, minimum: 0 })).toBe('out');
      expect(stockLevel({ stock: 5, minimum: 5 })).toBe('critical');
      expect(stockLevel({ stock: 3, minimum: 5 })).toBe('critical');
      expect(stockLevel({ stock: 6, minimum: 5 })).toBe('ok');
      expect(stockLevel({ stock: 1, minimum: 0 })).toBe('ok');
    });
  });

  describe('movements', () => {
    const raw = (over: Record<string, unknown>) => ({ id: 1, type: 'INGRESO', reason: 'AJUSTE_POSITIVO', quantity: 5, date: '2026-01-02T10:00:00', productId: 7, branchId: 3, finalBalance: 9, ...over });

    it('sin producto usa /movements, deja solo la sucursal elegida y ordena del más reciente al más antiguo', async () => {
      server.use(
        http.get(`${TEST_API}/api/v1/inventory/movements`, () =>
          HttpResponse.json([
            raw({ id: 1, date: '2026-01-01T10:00:00' }),
            raw({ id: 2, date: '2026-01-03T10:00:00' }),
            raw({ id: 3, branchId: 99, date: '2026-01-05T10:00:00' }),
          ]),
        ),
      );
      expect((await firstValueFrom(api.movements(3, null))).map((m) => m.id)).toEqual([2, 1]);
    });

    it('con producto usa el kardex de ese producto (ya viene de la sucursal)', async () => {
      server.use(http.get(`${inventoryUrl(3)}/products/7/kardex`, () => HttpResponse.json([raw({ id: 8, branchId: undefined })])));
      const [movement] = await firstValueFrom(api.movements(3, 7));
      expect(movement).toMatchObject({ id: 8, type: 'INGRESO', reason: 'AJUSTE_POSITIVO', quantity: 5, productId: 7, balance: 9, observations: '', subReason: '' });
      expect(movement.date).toBeInstanceOf(Date);
    });

    it('descarta movimientos incompletos o con tipo o fecha inválidos', async () => {
      server.use(
        http.get(`${TEST_API}/api/v1/inventory/movements`, () =>
          HttpResponse.json([raw({ id: 1 }), raw({ id: 2, type: 'OTRO' }), raw({ id: 3, date: 'no-es-fecha' }), raw({ id: 4, quantity: undefined }), raw({ id: 5, reason: undefined })]),
        ),
      );
      expect((await firstValueFrom(api.movements(3, null))).map((m) => m.id)).toEqual([1]);
    });
  });

  describe('adjust', () => {
    it('un ingreso llama a /add con la autoría de la sesión, observaciones recortadas y costo sugerido', async () => {
      let body: Record<string, unknown> = {};
      server.use(http.post(`${inventoryUrl(3)}/products/7/add`, async ({ request }) => { body = (await request.json()) as Record<string, unknown>; return new HttpResponse(null, { status: 204 }); }));
      await firstValueFrom(api.adjust(3, 7, { type: 'INGRESO', quantity: 4, reason: 'AJUSTE_POSITIVO', observations: '  conteo físico del lunes  ', unitCost: 2.5 }));
      expect(body).toEqual({ quantity: 4, reason: 'AJUSTE_POSITIVO', userId: 42, observations: 'conteo físico del lunes', unitCost: 2.5 });
    });

    it('un retiro llama a /withdraw con la categoría de la merma y sin costo', async () => {
      let body: Record<string, unknown> = {};
      server.use(http.post(`${inventoryUrl(3)}/products/7/withdraw`, async ({ request }) => { body = (await request.json()) as Record<string, unknown>; return new HttpResponse(null, { status: 204 }); }));
      await firstValueFrom(api.adjust(3, 7, { type: 'RETIRO', quantity: 2, reason: 'MERMA', observations: 'bulto roto en bodega', subReason: 'DANO_FISICO', unitCost: 9 }));
      expect(body).toEqual({ quantity: 2, reason: 'MERMA', userId: 42, observations: 'bulto roto en bodega', subReason: 'DANO_FISICO' });
      expect('unitCost' in body).toBe(false);
    });
  });

  describe('setMinimum', () => {
    it('envía el mínimo como parámetro de consulta a la ruta de configuración', async () => {
      let query = '';
      server.use(http.put(`${inventoryUrl(3)}/products/7/config`, ({ request }) => { query = new URL(request.url).search; return HttpResponse.json({}); }));
      await firstValueFrom(api.setMinimum(3, 7, 15));
      expect(query).toBe('?minimumStock=15');
    });
  });
});
