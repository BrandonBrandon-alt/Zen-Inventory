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

  describe('escritura', () => {
    const response = { id: 9, nombre: 'Nueva', direccion: 'Calle 1', telefono: '601', activa: true };

    it('create: POST /api/branches con los datos recortados y devuelve la sucursal creada', async () => {
      let body: unknown;
      server.use(
        http.post(`${TEST_API}/api/branches`, async ({ request }) => {
          body = await request.json();
          return HttpResponse.json(response, { status: 201 });
        }),
      );
      const created = await firstValueFrom(api.create({ nombre: '  Nueva ', direccion: ' Calle 1 ', telefono: ' 601 ' }));
      expect(body).toEqual({ nombre: 'Nueva', direccion: 'Calle 1', telefono: '601' });
      expect(created).toMatchObject({ id: 9, nombre: 'Nueva', activa: true });
    });

    it('un teléfono vacío no se envía', async () => {
      let body: Record<string, unknown> = {};
      server.use(
        http.post(`${TEST_API}/api/branches`, async ({ request }) => {
          body = (await request.json()) as Record<string, unknown>;
          return HttpResponse.json(response, { status: 201 });
        }),
      );
      await firstValueFrom(api.create({ nombre: 'Nueva', direccion: 'Calle 1', telefono: '   ' }));
      expect(body).toEqual({ nombre: 'Nueva', direccion: 'Calle 1' });
      expect('telefono' in body).toBe(false);
    });

    it('update: PUT /api/branches/{id}', async () => {
      let url = '';
      let body: unknown;
      server.use(
        http.put(`${TEST_API}/api/branches/:id`, async ({ request, params }) => {
          url = String(params['id']);
          body = await request.json();
          return HttpResponse.json({ ...response, nombre: 'Editada' });
        }),
      );
      const updated = await firstValueFrom(api.update(9, { nombre: 'Editada', direccion: 'Calle 1', telefono: '' }));
      expect(url).toBe('9');
      expect(body).toEqual({ nombre: 'Editada', direccion: 'Calle 1' });
      expect(updated.nombre).toBe('Editada');
    });

    it('deactivate: DELETE /api/branches/{id}', async () => {
      let called = '';
      server.use(
        http.delete(`${TEST_API}/api/branches/:id`, ({ params }) => {
          called = String(params['id']);
          return new HttpResponse(null, { status: 204 });
        }),
      );
      await firstValueFrom(api.deactivate(4));
      expect(called).toBe('4');
    });

    it('si el servidor devuelve una sucursal sin id o nombre, falla en vez de aceptar datos a medias', async () => {
      server.use(http.post(`${TEST_API}/api/branches`, () => HttpResponse.json({ nombre: 'sin id' }, { status: 201 })));
      await expect(firstValueFrom(api.create({ nombre: 'x', direccion: 'y', telefono: '' }))).rejects.toThrow('incompleta');
    });
  });
});
