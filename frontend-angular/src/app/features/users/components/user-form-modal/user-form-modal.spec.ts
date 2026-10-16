import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { render, screen, within } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { delay, http, HttpResponse } from 'msw';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { API_BASE_URL } from '@core/api/api-base-url';
import { errorInterceptor } from '@core/api/error.interceptor';
import { NotificationService } from '@core/notifications/notification.service';
import { apiErrorBody, server, TEST_API } from '@testing/msw-server';
import type { AppUser, BranchOption, RoleOption } from '../../data-access/users-api';
import { UserFormModal } from './user-form-modal';

const USERS = `${TEST_API}/api/users`;
const ROLES: RoleOption[] = [
  { id: 1, nombre: 'ADMIN' },
  { id: 2, nombre: 'MANAGER' },
  { id: 3, nombre: 'OPERADOR_INVENTARIO' },
  { id: 4, nombre: 'SELLER' },
];
const BRANCHES: BranchOption[] = [
  { id: 10, nombre: 'Sede Central', activa: true },
  { id: 20, nombre: 'Sucursal Norte', activa: true },
  { id: 30, nombre: 'Sucursal Cerrada', activa: false },
];
const EXISTING: AppUser = { id: 7, nombre: 'Luis Pérez', email: 'luis@zen.com', rol: 'SELLER', sucursalId: 20, activo: true };
const SAVED_RESPONSE = { id: 9, nombre: 'Ana Gómez', email: 'ana@zen.com', role: { id: 4, nombre: 'SELLER' }, sucursalId: 10, activo: true };

const TEMPLATE = `<app-user-form-modal [(open)]="open" [user]="user" [roles]="roles" [branches]="branches" [branchLocked]="locked" [self]="self" (saved)="onSaved($event)" />`;

interface Props {
  open: boolean;
  user: AppUser | null;
  roles: RoleOption[];
  branches: BranchOption[];
  locked: boolean;
  self: boolean;
  onSaved: ReturnType<typeof vi.fn>;
}

async function setup(props: Partial<Props> = {}) {
  const componentProperties: Props = { open: true, user: null, roles: ROLES, branches: BRANCHES, locked: false, self: false, onSaved: vi.fn(), ...props };
  const result = await render(TEMPLATE, {
    imports: [UserFormModal],
    componentProperties,
    providers: [provideHttpClient(withInterceptors([errorInterceptor])), { provide: API_BASE_URL, useValue: TEST_API }],
  });
  const host = result.fixture.componentInstance as unknown as Props;
  const update = async (changes: Partial<Props>) => {
    Object.assign(host, changes);
    result.fixture.detectChanges();
    await result.fixture.whenStable();
  };
  return { host, update };
}

const nombre = () => screen.getByLabelText('Nombre completo');
const correo = () => screen.getByLabelText('Correo');
const password = () => screen.getByLabelText(/contraseña/i);
const rol = () => screen.getByLabelText('Rol');
const sucursal = () => screen.getByLabelText('Sucursal');
const submit = (label: string) => screen.getByRole('button', { name: label });

async function fillCommon() {
  await userEvent.type(nombre(), 'Ana Gómez');
  await userEvent.type(correo(), 'ana@zen.com');
  await userEvent.type(password(), 'secret1');
}

describe('UserFormModal', () => {
  afterEach(() => {
    document.body.style.overflow = '';
  });

  describe('modos', () => {
    it('crear: formulario vacío con los roles disponibles y contraseña obligatoria', async () => {
      await setup();
      expect(screen.getByRole('dialog', { name: 'Nuevo usuario' })).toBeInTheDocument();
      expect(nombre()).toHaveValue('');
      expect(screen.getAllByRole('option').map((o) => o.textContent?.trim())).toEqual(
        expect.arrayContaining(['ADMIN', 'MANAGER', 'OPERADOR_INVENTARIO', 'SELLER']),
      );
      expect(screen.queryByLabelText('Usuario activo')).not.toBeInTheDocument();
      expect(submit('Crear usuario')).toBeInTheDocument();
    });

    it('editar: carga los datos del usuario, su rol y sucursal, con el estado activo', async () => {
      await setup({ user: EXISTING });
      expect(screen.getByRole('dialog', { name: 'Editar usuario' })).toBeInTheDocument();
      expect(nombre()).toHaveValue('Luis Pérez');
      expect(correo()).toHaveValue('luis@zen.com');
      expect(password()).toHaveValue('');
      expect(rol()).toHaveDisplayValue('SELLER');
      expect(sucursal()).toHaveDisplayValue('Sucursal Norte');
      expect(screen.getByLabelText('Usuario activo')).toBeChecked();
    });
  });

  describe('sucursal según el rol', () => {
    it('no se pide hasta elegir un rol; con un rol operativo aparece y con ADMIN desaparece', async () => {
      await setup();
      expect(screen.queryByLabelText('Sucursal')).not.toBeInTheDocument();
      await userEvent.selectOptions(rol(), 'SELLER');
      expect(sucursal()).toBeInTheDocument();
      await userEvent.selectOptions(rol(), 'ADMIN');
      expect(screen.queryByLabelText('Sucursal')).not.toBeInTheDocument();
    });

    it('solo ofrece sucursales activas (más la actual del usuario aunque esté inactiva)', async () => {
      await setup({ user: { ...EXISTING, sucursalId: 30 } });
      expect(within(sucursal()).getAllByRole('option').map((o) => o.textContent?.trim())).toEqual([
        'Selecciona una sucursal',
        'Sede Central',
        'Sucursal Norte',
        'Sucursal Cerrada (inactiva)',
      ]);
    });

    it('bloqueada (MANAGER): no se muestra y no se envía', async () => {
      let body: Record<string, unknown> = {};
      server.use(http.post(USERS, async ({ request }) => { body = (await request.json()) as Record<string, unknown>; return HttpResponse.json(SAVED_RESPONSE, { status: 201 }); }));
      const { host } = await setup({ locked: true, roles: ROLES.slice(2) });
      await fillCommon();
      await userEvent.selectOptions(rol(), 'SELLER');
      expect(screen.queryByLabelText('Sucursal')).not.toBeInTheDocument();
      await userEvent.click(submit('Crear usuario'));
      await vi.waitFor(() => expect(host.onSaved).toHaveBeenCalled());
      expect('sucursalId' in body).toBe(false);
    });
  });

  describe('validación', () => {
    it('al enviar vacío muestra los errores y no llama al backend', async () => {
      let calls = 0;
      server.use(http.post(USERS, () => { calls++; return HttpResponse.json(SAVED_RESPONSE, { status: 201 }); }));
      await setup();
      await userEvent.click(submit('Crear usuario'));
      expect(screen.getByText('El nombre es requerido.')).toBeInTheDocument();
      expect(screen.getByText('El correo es requerido.')).toBeInTheDocument();
      expect(screen.getByText('La contraseña es requerida.')).toBeInTheDocument();
      expect(screen.getByText('Elige un rol.')).toBeInTheDocument();
      expect(calls).toBe(0);
    });

    it('correo con formato inválido, nombre corto y contraseña corta', async () => {
      await setup();
      await userEvent.type(nombre(), 'ab');
      await userEvent.type(correo(), 'no-es-correo');
      await userEvent.type(password(), '123');
      await userEvent.click(submit('Crear usuario'));
      expect(screen.getByText('El nombre debe tener al menos 3 caracteres.')).toBeInTheDocument();
      expect(screen.getByText('Correo inválido.')).toBeInTheDocument();
      expect(screen.getByText('Mínimo 6 caracteres.')).toBeInTheDocument();
    });

    it('un rol que no es ADMIN exige elegir sucursal', async () => {
      await setup();
      await fillCommon();
      await userEvent.selectOptions(rol(), 'SELLER');
      await userEvent.click(submit('Crear usuario'));
      expect(screen.getByText('Elige una sucursal.')).toBeInTheDocument();
    });

    it('en edición la contraseña es opcional, pero si se escribe debe tener 6 o más', async () => {
      server.use(http.put(`${USERS}/:id`, () => HttpResponse.json(SAVED_RESPONSE)));
      const { host } = await setup({ user: EXISTING });
      await userEvent.type(password(), '123');
      await userEvent.click(submit('Guardar cambios'));
      expect(screen.getByText('Mínimo 6 caracteres.')).toBeInTheDocument();
      expect(host.onSaved).not.toHaveBeenCalled();
      await userEvent.clear(password());
      await userEvent.click(submit('Guardar cambios'));
      await vi.waitFor(() => expect(host.onSaved).toHaveBeenCalled());
    });
  });

  describe('guardar', () => {
    it('crear: envía los datos, avisa, entrega el usuario y se cierra', async () => {
      let body: unknown;
      server.use(http.post(USERS, async ({ request }) => { body = await request.json(); return HttpResponse.json(SAVED_RESPONSE, { status: 201 }); }));
      const { host } = await setup();
      await fillCommon();
      await userEvent.selectOptions(rol(), 'SELLER');
      await userEvent.selectOptions(sucursal(), 'Sede Central');
      await userEvent.click(submit('Crear usuario'));

      await vi.waitFor(() => expect(host.onSaved).toHaveBeenCalledTimes(1));
      expect(body).toEqual({ nombre: 'Ana Gómez', email: 'ana@zen.com', password: 'secret1', rolId: 4, sucursalId: 10 });
      expect(host.onSaved).toHaveBeenCalledWith(expect.objectContaining({ id: 9, rol: 'SELLER' }));
      expect(host.open).toBe(false);
      expect(TestBed.inject(NotificationService).items()[0]).toMatchObject({ kind: 'success', message: 'Usuario creado correctamente.' });
    });

    it('crear un ADMIN no envía sucursal aunque se hubiera elegido antes', async () => {
      let body: Record<string, unknown> = {};
      server.use(http.post(USERS, async ({ request }) => { body = (await request.json()) as Record<string, unknown>; return HttpResponse.json(SAVED_RESPONSE, { status: 201 }); }));
      const { host } = await setup();
      await fillCommon();
      await userEvent.selectOptions(rol(), 'SELLER');
      await userEvent.selectOptions(sucursal(), 'Sede Central');
      await userEvent.selectOptions(rol(), 'ADMIN');
      await userEvent.click(submit('Crear usuario'));
      await vi.waitFor(() => expect(host.onSaved).toHaveBeenCalled());
      expect(body['rolId']).toBe(1);
      expect('sucursalId' in body).toBe(false);
    });

    it('editar: actualiza ese usuario sin enviar contraseña vacía y con su estado activo', async () => {
      let id = '';
      let body: Record<string, unknown> = {};
      server.use(http.put(`${USERS}/:id`, async ({ request, params }) => { id = String(params['id']); body = (await request.json()) as Record<string, unknown>; return HttpResponse.json(SAVED_RESPONSE); }));
      const { host } = await setup({ user: EXISTING });
      await userEvent.click(screen.getByLabelText('Usuario activo'));
      await userEvent.click(submit('Guardar cambios'));

      await vi.waitFor(() => expect(host.onSaved).toHaveBeenCalledTimes(1));
      expect(id).toBe('7');
      expect(body).toEqual({ nombre: 'Luis Pérez', email: 'luis@zen.com', rolId: 4, sucursalId: 20, activo: false });
      expect(TestBed.inject(NotificationService).items()[0]).toMatchObject({ message: 'Usuario actualizado correctamente.' });
    });

    it('mientras guarda no se puede cerrar y un doble envío hace una sola petición', async () => {
      let calls = 0;
      server.use(http.post(USERS, async () => { calls++; await delay(150); return HttpResponse.json(SAVED_RESPONSE, { status: 201 }); }));
      const { host } = await setup({ locked: true });
      await fillCommon();
      await userEvent.selectOptions(rol(), 'SELLER');
      await userEvent.dblClick(submit('Crear usuario'));
      expect(screen.queryByRole('button', { name: 'Cerrar' })).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Cancelar' })).toBeDisabled();
      await vi.waitFor(() => expect(host.onSaved).toHaveBeenCalled());
      expect(calls).toBe(1);
    });
  });

  describe('errores del servidor', () => {
    it('un error por campo (correo repetido) aparece bajo ese campo y no hay aviso general', async () => {
      server.use(
        http.post(USERS, () =>
          HttpResponse.json(
            apiErrorBody(400, 'VALIDATION_FAILED', 'email: en uso', { fieldErrors: [{ field: 'email', message: 'Ese correo ya está registrado' }] }),
            { status: 400 },
          ),
        ),
      );
      const { host } = await setup({ locked: true });
      await fillCommon();
      await userEvent.selectOptions(rol(), 'SELLER');
      await userEvent.click(submit('Crear usuario'));

      expect(await screen.findByText('Ese correo ya está registrado')).toBeInTheDocument();
      expect(correo()).toHaveAttribute('aria-invalid', 'true');
      expect(screen.getAllByRole('alert')).toHaveLength(1);
      expect(host.open).toBe(true);
    });

    it('un 403 (fuera de alcance) se muestra en el formulario sin cerrarlo, conservando lo escrito', async () => {
      server.use(http.post(USERS, () => HttpResponse.json(apiErrorBody(403, 'FORBIDDEN_ACTION', 'No puede asignar el rol ADMIN.'), { status: 403 })));
      const { host } = await setup({ locked: true });
      await fillCommon();
      await userEvent.selectOptions(rol(), 'SELLER');
      await userEvent.click(submit('Crear usuario'));

      expect(await screen.findByRole('alert')).toHaveTextContent('No puede asignar el rol ADMIN.');
      expect(nombre()).toHaveValue('Ana Gómez');
      expect(host.open).toBe(true);
      expect(TestBed.inject(NotificationService).items()).toEqual([]);
    });

    it('el aviso general desaparece al editar un campo', async () => {
      server.use(http.post(USERS, () => new HttpResponse(null, { status: 500 })));
      await setup({ locked: true });
      await fillCommon();
      await userEvent.selectOptions(rol(), 'SELLER');
      await userEvent.click(submit('Crear usuario'));
      await screen.findByRole('alert');
      await userEvent.type(nombre(), 'x');
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });
  });

  describe('cuenta propia', () => {
    it('no puede cambiar su rol ni desactivarse: rol bloqueado y sin interruptor de activo', async () => {
      await setup({ user: EXISTING, self: true });
      expect(rol()).toBeDisabled();
      expect(screen.queryByLabelText('Usuario activo')).not.toBeInTheDocument();
    });

    it('puede guardar sus otros datos y se envía el mismo rol', async () => {
      let body: Record<string, unknown> = {};
      server.use(http.put(`${USERS}/:id`, async ({ request }) => { body = (await request.json()) as Record<string, unknown>; return HttpResponse.json(SAVED_RESPONSE); }));
      const { host } = await setup({ user: EXISTING, self: true });
      await userEvent.type(nombre(), ' Jr');
      await userEvent.click(submit('Guardar cambios'));
      await vi.waitFor(() => expect(host.onSaved).toHaveBeenCalled());
      expect(body['rolId']).toBe(4);
      expect(body['nombre']).toBe('Luis Pérez Jr');
      expect('activo' in body && body['activo'] === false).toBe(false);
    });

    it('al abrir después a otro usuario, el rol vuelve a poder cambiarse', async () => {
      const { update } = await setup({ user: EXISTING, self: true });
      await update({ open: false });
      await update({ user: { ...EXISTING, id: 8 }, self: false, open: true });
      expect(rol()).toBeEnabled();
    });
  });

  describe('reapertura', () => {
    it('al cancelar y volver a abrir aparece limpio, sin lo escrito ni errores', async () => {
      const { update } = await setup();
      await userEvent.type(nombre(), 'Algo');
      await userEvent.click(submit('Crear usuario'));
      expect(screen.getByText('El correo es requerido.')).toBeInTheDocument();
      await userEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
      await update({ open: true });
      expect(nombre()).toHaveValue('');
      expect(screen.queryByText('El correo es requerido.')).not.toBeInTheDocument();
    });

    it('abre con los datos de otro usuario al editar uno distinto', async () => {
      const { update } = await setup({ open: false, user: EXISTING });
      await update({ open: true });
      expect(nombre()).toHaveValue('Luis Pérez');
      await update({ open: false });
      await update({ user: { ...EXISTING, id: 8, nombre: 'Marta Ruiz', rol: 'OPERADOR_INVENTARIO', sucursalId: 10 }, open: true });
      expect(nombre()).toHaveValue('Marta Ruiz');
      expect(rol()).toHaveDisplayValue('OPERADOR_INVENTARIO');
      expect(sucursal()).toHaveDisplayValue('Sede Central');
    });
  });
});
