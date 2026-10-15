import { provideHttpClient } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { http, HttpResponse } from 'msw';
import { firstValueFrom } from 'rxjs';
import { beforeEach, describe, expect, it } from 'vitest';
import { API_BASE_URL } from '@core/api/api-base-url';
import { BranchesApi } from '../../app/features/branches/data-access/branches-api';
import { server, TEST_API } from '../msw-server';

describe('BranchesApi (contrato HTTP con MSW)', () => {
  let api: BranchesApi;

  beforeEach(() => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ providers: [provideHttpClient(), { provide: API_BASE_URL, useValue: TEST_API }] });
    api = TestBed.inject(BranchesApi);
  });

  it('lista las sucursales con todos sus campos', async () => {
    server.use(
      http.get(`${TEST_API}/api/branches`, () =>
        HttpResponse.json([{ id: 1, nombre: 'Sede Central', direccion: 'Calle 10 # 5-20', telefono: '6017001001', activa: true, managerId: 4 }]),
      ),
    );
    expect(await firstValueFrom(api.list())).toEqual([
      { id: 1, nombre: 'Sede Central', direccion: 'Calle 10 # 5-20', telefono: '6017001001', activa: true, managerId: 4 },
    ]);
  });

  it('completa los campos ausentes (el OpenAPI los marca todos como opcionales)', async () => {
    server.use(http.get(`${TEST_API}/api/branches`, () => HttpResponse.json([{ id: 2, nombre: '  Norte  ' }])));
    expect(await firstValueFrom(api.list())).toEqual([
      { id: 2, nombre: 'Norte', direccion: '', telefono: '', activa: true, managerId: null },
    ]);
  });

  it('una sucursal marcada como inactiva se respeta', async () => {
    server.use(http.get(`${TEST_API}/api/branches`, () => HttpResponse.json([{ id: 3, nombre: 'Sur', activa: false }])));
    expect((await firstValueFrom(api.list()))[0].activa).toBe(false);
  });

  it('descarta los registros que no se pueden identificar (sin id o sin nombre)', async () => {
    server.use(
      http.get(`${TEST_API}/api/branches`, () =>
        HttpResponse.json([{ nombre: 'Sin id' }, { id: 5 }, { id: 6, nombre: '   ' }, { id: 7, nombre: 'Válida' }]),
      ),
    );
    expect((await firstValueFrom(api.list())).map((b) => b.id)).toEqual([7]);
  });

  it('una lista vacía es una lista vacía', async () => {
    server.use(http.get(`${TEST_API}/api/branches`, () => HttpResponse.json([])));
    expect(await firstValueFrom(api.list())).toEqual([]);
  });
});
