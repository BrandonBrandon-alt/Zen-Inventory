import { provideHttpClient } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { http, HttpResponse } from 'msw';
import { firstValueFrom, Observable } from 'rxjs';
import { beforeEach, describe, expect, it } from 'vitest';
import { API_BASE_URL } from '@core/api/api-base-url';
import { AuthStore } from '@core/auth/session/auth-store';
import { BranchesApi } from '../../app/features/branches/data-access/branches-api';
import { InventoryApi } from '../../app/features/inventory/data-access/inventory-api';
import { ProductsApi } from '../../app/features/products/data-access/products-api';
import { SuppliersApi } from '../../app/features/suppliers/data-access/suppliers-api';
import { UnitsApi } from '../../app/features/units/data-access/units-api';
import { UsersApi } from '../../app/features/users/data-access/users-api';
import { server, TEST_API } from '../msw-server';

/** Las tablas muestran arriba lo más reciente, aunque el servidor devuelva las filas en otro orden. */
describe('Listas de las tablas: lo más reciente primero', () => {
  beforeEach(() => {
    localStorage.clear();
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ providers: [provideHttpClient(), { provide: API_BASE_URL, useValue: TEST_API }] });
  });

  const ids = async (list: Observable<{ id: number }[]>) => (await firstValueFrom(list)).map((r) => r.id);

  it('productos', async () => {
    server.use(
      http.get(`${TEST_API}/api/catalog/products`, () =>
        HttpResponse.json([3, 10, 7].map((id) => ({ id, sku: `S-${id}`, nombre: `P${id}` }))),
      ),
    );
    expect(await ids(TestBed.inject(ProductsApi).list())).toEqual([10, 7, 3]);
  });

  it('proveedores', async () => {
    server.use(http.get(`${TEST_API}/api/catalog/suppliers`, () => HttpResponse.json([3, 10, 7].map((id) => ({ id, nombre: `Prov ${id}` })))));
    expect(await ids(TestBed.inject(SuppliersApi).list())).toEqual([10, 7, 3]);
  });

  it('unidades', async () => {
    server.use(
      http.get(`${TEST_API}/api/catalog/units`, () => HttpResponse.json([3, 10, 7].map((id) => ({ id, nombre: `U${id}`, abreviatura: `u${id}` })))),
    );
    expect(await ids(TestBed.inject(UnitsApi).list())).toEqual([10, 7, 3]);
  });

  it('sucursales', async () => {
    server.use(http.get(`${TEST_API}/api/branches`, () => HttpResponse.json([3, 10, 7].map((id) => ({ id, nombre: `Sede ${id}` })))));
    expect(await ids(TestBed.inject(BranchesApi).list())).toEqual([10, 7, 3]);
  });

  it('usuarios', async () => {
    server.use(
      http.get(`${TEST_API}/api/users`, () =>
        HttpResponse.json([3, 10, 7].map((id) => ({ id, email: `u${id}@zen.co`, role: { id: 4, nombre: 'SELLER' } }))),
      ),
    );
    expect(await ids(TestBed.inject(UsersApi).list())).toEqual([10, 7, 3]);
  });

  it('inventario: arriba lo que se movió último; lo que nunca se movió va después, del producto más nuevo al más viejo', async () => {
    TestBed.inject(AuthStore).start({ token: 't', email: 'a@z.co', nombre: 'Ana', rol: 'ADMIN', id: 42 });
    server.use(
      http.get(`${TEST_API}/api/catalog/products`, () => HttpResponse.json([1, 2, 3, 4, 5].map((id) => ({ id, sku: `S-${id}`, nombre: `P${id}` })))),
      http.get(`${TEST_API}/api/v1/inventory/branches/1`, () =>
        HttpResponse.json([
          { productId: 1, stockActual: 1, lastUpdated: '2026-11-16T10:00:00' },
          { productId: 2, stockActual: 1, lastUpdated: '2026-11-16T19:30:00' },
          { productId: 3, stockActual: 1 },
        ]),
      ),
    );
    const items = await firstValueFrom(TestBed.inject(InventoryApi).list(1));
    expect(items.map((i) => i.productId)).toEqual([2, 1, 5, 4, 3]);
  });
});
