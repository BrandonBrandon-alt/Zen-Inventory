import { provideHttpClient } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { http, HttpResponse } from 'msw';
import { firstValueFrom } from 'rxjs';
import { beforeEach, describe, expect, it } from 'vitest';
import { API_BASE_URL } from '@core/api/api-base-url';
import { UsersApi } from '../../app/features/users/data-access/users-api';
import { server, TEST_API } from '../msw-server';

const USERS = `${TEST_API}/api/users`;
const input = { nombre: '  Ana Gómez ', email: ' ana@zen.com ', password: 'secret1', rolId: 4, sucursalId: 3 };

describe('UsersApi (contrato HTTP con MSW)', () => {
  let api: UsersApi;

  beforeEach(() => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ providers: [provideHttpClient(), { provide: API_BASE_URL, useValue: TEST_API }] });
    api = TestBed.inject(UsersApi);
  });

  it('lista los usuarios con su rol y sucursal', async () => {
    server.use(
      http.get(USERS, () =>
        HttpResponse.json([{ id: 1, nombre: 'Ana', email: 'ana@zen.com', role: { id: 4, nombre: 'SELLER' }, sucursalId: 3, activo: true }]),
      ),
    );
    expect(await firstValueFrom(api.list())).toEqual([
      { id: 1, nombre: 'Ana', email: 'ana@zen.com', rol: 'SELLER', sucursalId: 3, activo: true },
    ]);
  });

  it('completa lo que falta: sin sucursal es null, sin activo es activo, sin nombre usa el correo', async () => {
    server.use(http.get(USERS, () => HttpResponse.json([{ id: 2, email: 'root@zen.com', role: { id: 1, nombre: 'ADMIN' } }])));
    expect(await firstValueFrom(api.list())).toEqual([
      { id: 2, nombre: 'root@zen.com', email: 'root@zen.com', rol: 'ADMIN', sucursalId: null, activo: true },
    ]);
  });

  it('respeta un usuario inactivo y descarta los que no se pueden identificar o con un rol desconocido', async () => {
    server.use(
      http.get(USERS, () =>
        HttpResponse.json([
          { id: 3, email: 'a@z.com', role: { nombre: 'SELLER' }, activo: false },
          { email: 'sin-id@z.com', role: { nombre: 'SELLER' } },
          { id: 4, role: { nombre: 'SELLER' } },
          { id: 5, email: 'raro@z.com', role: { nombre: 'SUPERHEROE' } },
          { id: 6, email: 'sin-rol@z.com' },
        ]),
      ),
    );
    const users = await firstValueFrom(api.list());
    expect(users.map((u) => [u.id, u.activo])).toEqual([[3, false]]);
  });

  it('crear envía los datos recortados y la contraseña', async () => {
    let body: unknown;
    server.use(
      http.post(USERS, async ({ request }) => {
        body = await request.json();
        return HttpResponse.json({ id: 9, nombre: 'Ana Gómez', email: 'ana@zen.com', role: { id: 4, nombre: 'SELLER' }, sucursalId: 3, activo: true }, { status: 201 });
      }),
    );
    const created = await firstValueFrom(api.create(input));
    expect(body).toEqual({ nombre: 'Ana Gómez', email: 'ana@zen.com', password: 'secret1', rolId: 4, sucursalId: 3 });
    expect(created.id).toBe(9);
  });

  it('sin sucursal (ADMIN o MANAGER) no la envía, y sin contraseña tampoco; "activo" solo si se indica', async () => {
    let body: Record<string, unknown> = {};
    server.use(
      http.put(`${USERS}/:id`, async ({ request, params }) => {
        body = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json({ id: Number(params['id']), nombre: 'X', email: 'x@z.com', role: { id: 4, nombre: 'SELLER' }, activo: false });
      }),
    );
    await firstValueFrom(api.update(5, { ...input, password: '', sucursalId: null, activo: false }));
    expect(body).toEqual({ nombre: 'Ana Gómez', email: 'ana@zen.com', rolId: 4, activo: false });
    expect('password' in body).toBe(false);
    expect('sucursalId' in body).toBe(false);
  });

  it('una respuesta de creación incompleta es un error, no un usuario a medias', async () => {
    server.use(http.post(USERS, () => HttpResponse.json({ id: 9 }, { status: 201 })));
    await expect(firstValueFrom(api.create(input))).rejects.toThrow('incompleto');
  });

  it('desactivar llama a DELETE sobre ese usuario', async () => {
    let id = '';
    server.use(http.delete(`${USERS}/:id`, ({ params }) => { id = String(params['id']); return new HttpResponse(null, { status: 204 }); }));
    await firstValueFrom(api.deactivate(8));
    expect(id).toBe('8');
  });

  it('roles: solo los que la app conoce', async () => {
    server.use(http.get(`${TEST_API}/api/roles`, () => HttpResponse.json([{ id: 3, nombre: 'SELLER' }, { id: 9, nombre: 'RARO' }, { nombre: 'ADMIN' }])));
    expect(await firstValueFrom(api.roles())).toEqual([{ id: 3, nombre: 'SELLER' }]);
  });

});
