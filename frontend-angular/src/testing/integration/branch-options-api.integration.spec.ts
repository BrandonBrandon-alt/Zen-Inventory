import { provideHttpClient } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { http, HttpResponse } from 'msw';
import { firstValueFrom } from 'rxjs';
import { beforeEach, describe, expect, it } from 'vitest';
import { API_BASE_URL } from '@core/api/api-base-url';
import { BranchOptionsApi } from '@core/branches/branch-options-api';
import { server, TEST_API } from '../msw-server';

describe('BranchOptionsApi (contrato HTTP con MSW)', () => {
  let api: BranchOptionsApi;

  beforeEach(() => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ providers: [provideHttpClient(), { provide: API_BASE_URL, useValue: TEST_API }] });
    api = TestBed.inject(BranchOptionsApi);
  });

  it('devuelve id, nombre recortado y si está activa', async () => {
    server.use(http.get(`${TEST_API}/api/branches`, () => HttpResponse.json([{ id: 1, nombre: ' Norte ', direccion: 'x' }, { id: 2, nombre: 'Sur', activa: false }])));
    expect(await firstValueFrom(api.list())).toEqual([
      { id: 1, nombre: 'Norte', activa: true },
      { id: 2, nombre: 'Sur', activa: false },
    ]);
  });

  it('descarta las que no se pueden identificar (sin id o sin nombre)', async () => {
    server.use(http.get(`${TEST_API}/api/branches`, () => HttpResponse.json([{ nombre: 'Sin id' }, { id: 3 }, { id: 4, nombre: '   ' }, { id: 5, nombre: 'Válida' }])));
    expect((await firstValueFrom(api.list())).map((b) => b.id)).toEqual([5]);
  });
});
