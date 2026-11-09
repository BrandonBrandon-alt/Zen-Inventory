import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { render, screen, within } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { delay, http, HttpResponse } from 'msw';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { API_BASE_URL } from '@core/api/api-base-url';
import { errorInterceptor } from '@core/api/error.interceptor';
import { SESSION_STORAGE_KEY } from '@core/auth/session/auth-store';
import { NotificationService } from '@core/notifications/notification.service';
import { apiErrorBody, server, TEST_API } from '@testing/msw-server';
import { expectAccessible } from '@testing/a11y';
import { chooseOption } from '@testing/select-helpers';
import { UsersPage } from './users-page';

const URL = `${TEST_API}/api/users`;
const ROLES = [
  { id: 1, nombre: 'ADMIN' },
  { id: 2, nombre: 'MANAGER' },
  { id: 3, nombre: 'OPERADOR_INVENTARIO' },
  { id: 4, nombre: 'SELLER' },
];
const BRANCHES = [
  { id: 10, nombre: 'Sede Central', activa: true },
  { id: 20, nombre: 'Sucursal Norte', activa: true },
];
const user = (id: number, nombre: string, rol: string, sucursalId: number | undefined, activo = true) => ({
  id,
  nombre,
  email: `${nombre.split(' ')[0].toLowerCase()}@zen.com`,
  role: { id: ROLES.find((r) => r.nombre === rol)?.id, nombre: rol },
  sucursalId,
  activo,
});
const USERS = [
  user(1, 'Root Admin', 'ADMIN', undefined),
  user(2, 'Mario Gerente', 'MANAGER', 10),
  user(3, 'Sofia Vendedora', 'SELLER', 10),
  user(4, 'Omar Operador', 'OPERADOR_INVENTARIO', 20, false),
];

function useSession(rol: string, id: number, sucursalId?: number) {
  localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify({ token: 't', email: 'e@zen.com', nombre: 'Yo', rol, id, sucursalId }));
}

function stub(list: unknown[] = USERS, roles = ROLES) {
  server.use(
    http.get(URL, () => HttpResponse.json(list)),
    http.get(`${TEST_API}/api/roles`, () => HttpResponse.json(roles)),
    http.get(`${TEST_API}/api/branches`, () => HttpResponse.json(BRANCHES)),
  );
}

const renderPage = () =>
  render(UsersPage, {
    providers: [provideHttpClient(withInterceptors([errorInterceptor])), { provide: API_BASE_URL, useValue: TEST_API }],
  });

async function choose(label: 'Rol' | 'Sucursal', option: string) {
  await userEvent.click(screen.getByRole('combobox', { name: label }));
  await userEvent.click(screen.getByRole('option', { name: new RegExp(`^${option}`) }));
}

/** Nombres de las filas visibles (sin las iniciales del avatar, que van en la misma celda). */
const names = () => screen.getAllByRole('row').slice(1).map((r) => within(r).getAllByRole('cell')[0].querySelector('.truncate')?.textContent?.trim());

const row = (name: string) => screen.getByRole('row', { name: new RegExp(name) });

describe('UsersPage', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => {
    localStorage.clear();
    document.body.style.overflow = '';
  });

  describe('listado', () => {
    it('no tiene problemas de accesibilidad detectables', async () => {
      useSession('ADMIN', 1);
      stub();
      await renderPage();
      await vi.waitFor(() => expect(screen.getAllByRole('row').length).toBeGreaterThan(1));
      await expectAccessible();
    });

    it('muestra usuarios con rol, nombre de la sucursal y estado en texto', async () => {
      useSession('ADMIN', 1);
      stub();
      await renderPage();
      expect(await screen.findByText('Sofia Vendedora')).toBeInTheDocument();
      const sofia = within(row('Sofia'));
      expect(sofia.getByText('SELLER')).toBeInTheDocument();
      expect(sofia.getByText('Sede Central')).toBeInTheDocument();
      expect(sofia.getByText('Activo')).toBeInTheDocument();
      expect(within(row('Omar')).getByText('Inactivo')).toBeInTheDocument();
      expect(within(row('Omar')).getByText('Sucursal Norte')).toBeInTheDocument();
      expect(screen.getByText('4 usuarios, 3 activos')).toBeInTheDocument();
    });

    it('un MANAGER ve en el resumen que es de su sucursal', async () => {
      useSession('MANAGER', 2, 10);
      stub([USERS[1], USERS[2]], ROLES.slice(2));
      await renderPage();
      expect(await screen.findByText(/2 usuarios, 2 activos/)).toHaveTextContent('en tu sucursal');
    });

    it('sin usuarios, estado vacío', async () => {
      useSession('ADMIN', 1);
      stub([]);
      await renderPage();
      expect(await screen.findByText('Todavía no hay usuarios')).toBeInTheDocument();
    });

    it('si falla la carga muestra el error en la tabla, sin aviso global, y reintentar recupera', async () => {
      useSession('ADMIN', 1);
      let calls = 0;
      stub();
      server.use(
        http.get(URL, () => {
          calls++;
          return calls === 1 ? HttpResponse.json(apiErrorBody(500, 'INTERNAL_ERROR', 'Falla de prueba'), { status: 500 }) : HttpResponse.json(USERS);
        }),
      );
      await renderPage();
      expect(await screen.findByRole('alert')).toHaveTextContent('Falla de prueba');
      expect(TestBed.inject(NotificationService).items()).toEqual([]);
      await userEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
      expect(await screen.findByText('Sofia Vendedora')).toBeInTheDocument();
    });

    it('"Nuevo usuario" espera a que lleguen los roles', async () => {
      useSession('ADMIN', 1);
      stub();
      server.use(http.get(`${TEST_API}/api/roles`, async () => { await delay(100); return HttpResponse.json(ROLES); }));
      await renderPage();
      expect(screen.getByRole('button', { name: /Nuevo usuario/ })).toBeDisabled();
      await vi.waitFor(() => expect(screen.getByRole('button', { name: /Nuevo usuario/ })).toBeEnabled());
    });
  });

  describe('acciones según quién opera', () => {
    it('ADMIN edita a todos y desactiva a los activos, salvo su propia cuenta', async () => {
      useSession('ADMIN', 1);
      stub();
      await renderPage();
      await screen.findByText('Sofia Vendedora');
      for (const name of ['Root Admin', 'Mario Gerente', 'Sofia Vendedora', 'Omar Operador']) {
        expect(screen.getByRole('button', { name: `Editar ${name}` })).toBeInTheDocument();
      }
      expect(screen.getByRole('button', { name: 'Desactivar Mario Gerente' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Desactivar Sofia Vendedora' })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Desactivar Root Admin' })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Desactivar Omar Operador' })).not.toBeInTheDocument();
    });

    it('un MANAGER solo gestiona roles inferiores: no ve acciones sobre ADMIN ni sobre otro MANAGER', async () => {
      useSession('MANAGER', 2, 10);
      stub();
      await renderPage();
      await screen.findByText('Sofia Vendedora');
      expect(screen.getByRole('button', { name: 'Editar Sofia Vendedora' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Desactivar Sofia Vendedora' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Editar Omar Operador' })).toBeInTheDocument();
      for (const name of ['Root Admin', 'Mario Gerente']) {
        expect(screen.queryByRole('button', { name: `Editar ${name}` })).not.toBeInTheDocument();
        expect(screen.queryByRole('button', { name: `Desactivar ${name}` })).not.toBeInTheDocument();
      }
    });
  });

  describe('crear y editar', () => {
    it('ADMIN crea un usuario y la tabla se recarga sin volver al esqueleto', async () => {
      useSession('ADMIN', 1);
      let list = USERS;
      let listCalls = 0;
      let body: unknown;
      stub();
      server.use(
        http.get(URL, () => { listCalls++; return HttpResponse.json(list); }),
        http.post(URL, async ({ request }) => {
          body = await request.json();
          const created = user(9, 'Nora Nueva', 'SELLER', 20);
          list = [...USERS, created];
          return HttpResponse.json(created, { status: 201 });
        }),
      );
      await renderPage();
      await screen.findByText('Sofia Vendedora');
      await vi.waitFor(() => expect(screen.getByRole('button', { name: /Nuevo usuario/ })).toBeEnabled());
      await userEvent.click(screen.getByRole('button', { name: /Nuevo usuario/ }));
      await userEvent.type(screen.getByLabelText('Nombre completo'), 'Nora Nueva');
      await userEvent.type(screen.getByLabelText('Correo'), 'nora@zen.com');
      await userEvent.type(screen.getByLabelText('Contraseña'), 'secret1');
      await choose('Rol', 'SELLER');
      await choose('Sucursal', 'Sucursal Norte');
      await userEvent.click(screen.getByRole('button', { name: 'Crear usuario' }));

      expect(await screen.findByText('5 usuarios, 4 activos')).toBeInTheDocument();
      expect(body).toEqual({ nombre: 'Nora Nueva', email: 'nora@zen.com', password: 'secret1', rolId: 4, sucursalId: 20 });
      expect(listCalls).toBe(2);
    });

    it('un MANAGER crea sin elegir sucursal y solo ve los roles que le entrega el backend', async () => {
      useSession('MANAGER', 2, 10);
      stub([USERS[2]], ROLES.slice(2));
      await renderPage();
      await screen.findByText('Sofia Vendedora');
      await vi.waitFor(() => expect(screen.getByRole('button', { name: /Nuevo usuario/ })).toBeEnabled());
      await userEvent.click(screen.getByRole('button', { name: /Nuevo usuario/ }));
      await userEvent.click(screen.getByRole('combobox', { name: 'Rol' }));
      const roleOptions = screen.getAllByRole('option').map((o) => o.textContent?.trim());
      expect(roleOptions).toEqual(['OPERADOR_INVENTARIO', 'SELLER']);
      await userEvent.click(screen.getByRole('option', { name: /^SELLER/ }));
      expect(screen.queryByLabelText('Sucursal')).not.toBeInTheDocument();
    });

    it('al editar su propia cuenta el rol queda bloqueado; en la de otro no', async () => {
      useSession('ADMIN', 1);
      stub();
      await renderPage();
      await screen.findByText('Sofia Vendedora');
      await vi.waitFor(() => expect(screen.getByRole('button', { name: 'Editar Root Admin' })).toBeEnabled());
      await userEvent.click(screen.getByRole('button', { name: 'Editar Root Admin' }));
      expect(screen.getByRole('combobox', { name: 'Rol' })).toBeDisabled();
      await userEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
      await userEvent.click(screen.getByRole('button', { name: 'Editar Sofia Vendedora' }));
      expect(screen.getByRole('combobox', { name: 'Rol' })).toBeEnabled();
    });

    it('editar abre el formulario con los datos de esa fila', async () => {
      useSession('ADMIN', 1);
      stub();
      await renderPage();
      await screen.findByText('Sofia Vendedora');
      await vi.waitFor(() => expect(screen.getByRole('button', { name: 'Editar Sofia Vendedora' })).toBeEnabled());
      await userEvent.click(screen.getByRole('button', { name: 'Editar Sofia Vendedora' }));
      expect(screen.getByRole('dialog', { name: 'Editar usuario' })).toBeInTheDocument();
      expect(screen.getByLabelText('Nombre completo')).toHaveValue('Sofia Vendedora');
      expect(screen.getByRole('combobox', { name: 'Rol' })).toHaveTextContent('SELLER');
    });
  });

  describe('desactivar', () => {
    it('pide confirmación; cancelar no llama al backend', async () => {
      useSession('ADMIN', 1);
      let calls = 0;
      stub();
      server.use(http.delete(`${URL}/:id`, () => { calls++; return new HttpResponse(null, { status: 204 }); }));
      await renderPage();
      await screen.findByText('Sofia Vendedora');
      await userEvent.click(screen.getByRole('button', { name: 'Desactivar Sofia Vendedora' }));
      expect(screen.getByRole('dialog', { name: 'Desactivar usuario' })).toHaveTextContent('Sofia Vendedora');
      await userEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      expect(calls).toBe(0);
    });

    it('al confirmar desactiva a ese usuario, avisa y recarga sin parpadeo', async () => {
      useSession('ADMIN', 1);
      let deleted = '';
      let list = USERS;
      let listCalls = 0;
      stub();
      server.use(
        http.get(URL, async () => { listCalls++; if (listCalls > 1) await delay(300); return HttpResponse.json(list); }),
        http.delete(`${URL}/:id`, ({ params }) => {
          deleted = String(params['id']);
          list = USERS.map((u) => (u.id === 3 ? { ...u, activo: false } : u));
          return new HttpResponse(null, { status: 204 });
        }),
      );
      await renderPage();
      await screen.findByText('Sofia Vendedora');
      await userEvent.click(screen.getByRole('button', { name: 'Desactivar Sofia Vendedora' }));
      await userEvent.click(screen.getByRole('button', { name: 'Desactivar' }));
      await vi.waitFor(() => expect(listCalls).toBe(2));
      expect(screen.getByText('Sofia Vendedora')).toBeInTheDocument();
      expect(screen.queryByRole('status')).not.toBeInTheDocument();
      expect(await screen.findByText('4 usuarios, 2 activos')).toBeInTheDocument();
      expect(deleted).toBe('3');
      expect(TestBed.inject(NotificationService).items()[0]).toMatchObject({ kind: 'success', message: 'Usuario "Sofia Vendedora" desactivado.' });
    });

    it('si el backend lo rechaza, el motivo queda en el diálogo (abierto) y no hay aviso global', async () => {
      useSession('MANAGER', 2, 10);
      stub();
      server.use(http.delete(`${URL}/:id`, () => HttpResponse.json(apiErrorBody(403, 'FORBIDDEN_ACTION', 'Solo puede gestionar usuarios de su propia sucursal.'), { status: 403 })));
      await renderPage();
      await screen.findByText('Sofia Vendedora');
      await userEvent.click(screen.getByRole('button', { name: 'Desactivar Sofia Vendedora' }));
      await userEvent.click(screen.getByRole('button', { name: 'Desactivar' }));
      expect(await screen.findByRole('alert')).toHaveTextContent('propia sucursal');
      expect(screen.getByRole('dialog', { name: 'Desactivar usuario' })).toBeInTheDocument();
      expect(TestBed.inject(NotificationService).items()).toEqual([]);
    });
  });

  describe('filtros', () => {
    const STORE = 'zen:filters:1:users';

    it('busca por nombre o correo sin distinguir mayúsculas ni acentos', async () => {
      useSession('ADMIN', 1);
      stub();
      await renderPage();
      await screen.findByText('Sofia Vendedora');
      await userEvent.type(screen.getByRole('searchbox', { name: 'Buscar usuario' }), 'SOFÍA');
      expect(names()).toEqual(['Sofia Vendedora']);
      await userEvent.clear(screen.getByRole('searchbox', { name: 'Buscar usuario' }));
      await userEvent.type(screen.getByRole('searchbox', { name: 'Buscar usuario' }), 'omar@');
      expect(names()).toEqual(['Omar Operador']);
    });

    it('filtra por rol, estado y sucursal, y se combinan', async () => {
      useSession('ADMIN', 1);
      stub();
      await renderPage();
      await screen.findByText('Sofia Vendedora');
      await chooseOption('Rol del usuario', 'SELLER');
      expect(names()).toEqual(['Sofia Vendedora']);
      await chooseOption('Rol del usuario', 'Todos los roles');
      await chooseOption('Estado del usuario', 'Solo inactivos');
      expect(names()).toEqual(['Omar Operador']);
      await chooseOption('Estado del usuario', 'Solo activos');
      await vi.waitFor(() => expect(screen.getByRole('combobox', { name: 'Sucursal del usuario' })).toBeEnabled());
      await chooseOption('Sucursal del usuario', 'Sede Central');
      expect(names()).toEqual(['Mario Gerente', 'Sofia Vendedora']);
      await chooseOption('Sucursal del usuario', 'Sucursal Norte');
      expect(screen.getByText('Ningún usuario coincide')).toBeInTheDocument();
    });

    it('las etiquetas se quitan una a una y todas juntas', async () => {
      useSession('ADMIN', 1);
      stub();
      await renderPage();
      await screen.findByText('Sofia Vendedora');
      await chooseOption('Estado del usuario', 'Solo activos');
      await userEvent.type(screen.getByLabelText('Buscar usuario'), 'mario');
      expect(names()).toEqual(['Mario Gerente']);
      await userEvent.click(screen.getByRole('button', { name: 'Quitar filtro Estado: Activos' }));
      expect(screen.getByRole('combobox', { name: 'Estado del usuario' })).toHaveTextContent('Activos e inactivos');
      await userEvent.click(screen.getByRole('button', { name: 'Quitar filtros' }));
      expect(screen.getByLabelText('Buscar usuario')).toHaveValue('');
      expect(names()).toHaveLength(4);
    });

    it('recuerda los filtros la próxima vez que se entra, pero no la búsqueda', async () => {
      useSession('ADMIN', 1);
      stub();
      const first = await renderPage();
      await screen.findByText('Sofia Vendedora');
      await chooseOption('Rol del usuario', 'OPERADOR_INVENTARIO');
      await userEvent.type(screen.getByLabelText('Buscar usuario'), 'zzz');
      await vi.waitFor(() => expect(JSON.parse(localStorage.getItem(STORE) ?? '{}')).toEqual({ role: 'OPERADOR_INVENTARIO' }));
      first.fixture.destroy();
      TestBed.resetTestingModule(); // otra visita

      await renderPage();
      await screen.findByText('Omar Operador');
      expect(screen.getByLabelText('Buscar usuario')).toHaveValue('');
      expect(names()).toEqual(['Omar Operador']);
    });

    it('un valor guardado dañado se ignora', async () => {
      useSession('ADMIN', 1);
      localStorage.setItem(STORE, JSON.stringify({ role: 'SUPERUSER', status: 'x', branch: 'abc' }));
      stub();
      await renderPage();
      await screen.findByText('Sofia Vendedora');
      expect(names()).toHaveLength(4);
      expect(screen.queryByRole('group', { name: 'Filtros aplicados' })).not.toBeInTheDocument();
    });

    it('un MANAGER no ve el filtro de sucursal, y uno guardado no le esconde usuarios', async () => {
      useSession('MANAGER', 2, 10);
      localStorage.setItem('zen:filters:2:users', JSON.stringify({ branch: 20 }));
      stub([USERS[1], USERS[2]], ROLES.slice(2));
      await renderPage();
      await screen.findByText('Sofia Vendedora');
      expect(screen.queryByRole('combobox', { name: 'Sucursal del usuario' })).not.toBeInTheDocument();
      expect(names()).toEqual(['Mario Gerente', 'Sofia Vendedora']);
      expect(screen.queryByRole('group', { name: 'Filtros aplicados' })).not.toBeInTheDocument();
    });
  });
});
