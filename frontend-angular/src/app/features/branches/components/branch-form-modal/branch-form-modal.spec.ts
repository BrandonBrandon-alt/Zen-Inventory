import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse, delay } from 'msw';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { API_BASE_URL } from '@core/api/api-base-url';
import { errorInterceptor } from '@core/api/error.interceptor';
import { NotificationService } from '@core/notifications/notification.service';
import { apiErrorBody, server, TEST_API } from '@testing/msw-server';
import type { Branch } from '../../data-access/branches-api';
import { BranchFormModal } from './branch-form-modal';

const BRANCHES = `${TEST_API}/api/branches`;
const EXISTING: Branch = { id: 7, nombre: 'Sede Central', direccion: 'Calle 10 # 5-20', telefono: '6017001001', activa: true, managerId: null };
const CREATED = { id: 9, nombre: 'Sucursal Oriente', direccion: 'Calle 50 # 8-12', telefono: '6015550000', activa: true };

const TEMPLATE = `<app-branch-form-modal [(open)]="open" [branch]="branch" (saved)="onSaved($event)" />`;

async function setup(props: Partial<{ open: boolean; branch: Branch | null }> = {}) {
  const componentProperties = { open: true, branch: null as Branch | null, onSaved: vi.fn(), ...props };
  const result = await render(TEMPLATE, {
    imports: [BranchFormModal],
    componentProperties,
    providers: [provideHttpClient(withInterceptors([errorInterceptor])), { provide: API_BASE_URL, useValue: TEST_API }],
  });
  const host = result.fixture.componentInstance as unknown as typeof componentProperties;
  const update = async (changes: Partial<typeof componentProperties>) => {
    Object.assign(host, changes);
    result.fixture.detectChanges();
    await result.fixture.whenStable();
  };
  return { ...result, host, update };
}

const nombre = () => screen.getByLabelText('Nombre');
const direccion = () => screen.getByLabelText('Dirección');
const telefono = () => screen.getByLabelText('Teléfono');
const submit = (label: string | RegExp) => screen.getByRole('button', { name: label });

async function fillValid() {
  await userEvent.type(nombre(), 'Sucursal Oriente');
  await userEvent.type(direccion(), 'Calle 50 # 8-12');
  await userEvent.type(telefono(), '6015550000');
}

describe('BranchFormModal', () => {
  afterEach(() => {
    document.body.style.overflow = '';
  });

  describe('modos', () => {
    it('cerrado no es accesible', async () => {
      await setup({ open: false });
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('sin sucursal es el formulario de creación, con los campos vacíos', async () => {
      await setup();
      expect(screen.getByRole('dialog', { name: 'Nueva sucursal' })).toBeInTheDocument();
      expect(nombre()).toHaveValue('');
      expect(direccion()).toHaveValue('');
      expect(telefono()).toHaveValue('');
      expect(submit('Crear sucursal')).toBeInTheDocument();
    });

    it('con una sucursal es el de edición, con sus datos cargados', async () => {
      await setup({ branch: EXISTING });
      expect(screen.getByRole('dialog', { name: 'Editar sucursal' })).toBeInTheDocument();
      expect(nombre()).toHaveValue('Sede Central');
      expect(direccion()).toHaveValue('Calle 10 # 5-20');
      expect(telefono()).toHaveValue('6017001001');
      expect(submit('Guardar cambios')).toBeInTheDocument();
    });
  });

  describe('validación', () => {
    it('no muestra errores antes de que el usuario toque un campo', async () => {
      await setup();
      expect(screen.queryByText('El nombre es requerido.')).not.toBeInTheDocument();
    });

    it('al enviar vacío muestra los errores y no llama al backend', async () => {
      let calls = 0;
      server.use(http.post(BRANCHES, () => { calls++; return HttpResponse.json(CREATED, { status: 201 }); }));
      await setup();
      await userEvent.click(submit('Crear sucursal'));
      expect(screen.getByText('El nombre es requerido.')).toBeInTheDocument();
      expect(screen.getByText('La dirección es requerida.')).toBeInTheDocument();
      expect(calls).toBe(0);
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    it('el nombre debe tener entre 3 y 100 caracteres', async () => {
      await setup();
      await userEvent.type(nombre(), 'ab');
      await userEvent.tab();
      expect(screen.getByText('El nombre debe tener entre 3 y 100 caracteres.')).toBeInTheDocument();
      await userEvent.clear(nombre());
      await userEvent.type(nombre(), 'a'.repeat(101));
      await userEvent.tab();
      expect(screen.getByText('El nombre debe tener entre 3 y 100 caracteres.')).toBeInTheDocument();
    });

    it('el teléfono es opcional', async () => {
      server.use(http.post(BRANCHES, () => HttpResponse.json({ ...CREATED, telefono: undefined }, { status: 201 })));
      const { host } = await setup();
      await userEvent.type(nombre(), 'Sucursal Oriente');
      await userEvent.type(direccion(), 'Calle 50 # 8-12');
      await userEvent.click(submit('Crear sucursal'));
      await vi.waitFor(() => expect(host.onSaved).toHaveBeenCalled());
    });
  });

  describe('guardar', () => {
    it('crear: envía los datos, avisa del éxito, entrega la sucursal y se cierra', async () => {
      let body: unknown;
      server.use(http.post(BRANCHES, async ({ request }) => { body = await request.json(); return HttpResponse.json(CREATED, { status: 201 }); }));
      const { host } = await setup();
      await fillValid();
      await userEvent.click(submit('Crear sucursal'));

      await vi.waitFor(() => expect(host.onSaved).toHaveBeenCalledTimes(1));
      expect(body).toEqual({ nombre: 'Sucursal Oriente', direccion: 'Calle 50 # 8-12', telefono: '6015550000' });
      expect(host.onSaved).toHaveBeenCalledWith(expect.objectContaining({ id: 9, nombre: 'Sucursal Oriente' }));
      expect(host.open).toBe(false);
      expect(TestBed.inject(NotificationService).items()).toEqual([
        expect.objectContaining({ kind: 'success', message: 'Sucursal creada correctamente.' }),
      ]);
    });

    it('editar: actualiza la sucursal indicada y avisa del éxito', async () => {
      let id = '';
      server.use(http.put(`${BRANCHES}/:id`, ({ params }) => { id = String(params['id']); return HttpResponse.json({ ...CREATED, id: 7, nombre: 'Sede Central 2' }); }));
      const { host } = await setup({ branch: EXISTING });
      await userEvent.type(nombre(), ' 2');
      await userEvent.click(submit('Guardar cambios'));

      await vi.waitFor(() => expect(host.onSaved).toHaveBeenCalledTimes(1));
      expect(id).toBe('7');
      expect(TestBed.inject(NotificationService).items()[0]).toMatchObject({ kind: 'success', message: 'Sucursal actualizada correctamente.' });
    });

    it('mientras guarda no se puede cerrar ni cancelar, y un doble envío hace una sola petición', async () => {
      let calls = 0;
      server.use(http.post(BRANCHES, async () => { calls++; await delay(150); return HttpResponse.json(CREATED, { status: 201 }); }));
      const { host } = await setup();
      await fillValid();
      await userEvent.dblClick(submit('Crear sucursal'));

      expect(screen.queryByRole('button', { name: 'Cerrar' })).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Cancelar' })).toBeDisabled();
      await vi.waitFor(() => expect(host.onSaved).toHaveBeenCalled());
      expect(calls).toBe(1);
    });
  });

  describe('errores del servidor', () => {
    it('un error por campo aparece bajo ese campo, el modal sigue abierto y no hay aviso general', async () => {
      server.use(
        http.post(BRANCHES, () =>
          HttpResponse.json(
            apiErrorBody(400, 'VALIDATION_FAILED', 'nombre: ya existe', { fieldErrors: [{ field: 'nombre', message: 'Ya existe una sucursal con ese nombre' }] }),
            { status: 400 },
          ),
        ),
      );
      const { host } = await setup();
      await fillValid();
      await userEvent.click(submit('Crear sucursal'));

      expect(await screen.findByText('Ya existe una sucursal con ese nombre')).toBeInTheDocument();
      expect(nombre()).toHaveAttribute('aria-invalid', 'true');
      expect(screen.getAllByRole('alert')).toHaveLength(1);
      expect(host.open).toBe(true);
      expect(host.onSaved).not.toHaveBeenCalled();
    });

    it('un error general se muestra en el formulario, conserva lo escrito y permite reintentar', async () => {
      let calls = 0;
      server.use(
        http.post(BRANCHES, () => {
          calls++;
          return calls === 1
            ? HttpResponse.json(apiErrorBody(500, 'INTERNAL_ERROR', 'Ocurrió un error inesperado. Código: a1b2c3d4'), { status: 500 })
            : HttpResponse.json(CREATED, { status: 201 });
        }),
      );
      const { host } = await setup();
      await fillValid();
      await userEvent.click(submit('Crear sucursal'));

      expect(await screen.findByRole('alert')).toHaveTextContent('Código: a1b2c3d4');
      expect(nombre()).toHaveValue('Sucursal Oriente');
      expect(screen.getByRole('dialog')).toBeInTheDocument();
      // Se puede cerrar de nuevo y reintentar.
      expect(screen.getByRole('button', { name: 'Cerrar' })).toBeInTheDocument();

      await userEvent.click(submit('Crear sucursal'));
      await vi.waitFor(() => expect(host.onSaved).toHaveBeenCalledTimes(1));
      expect(calls).toBe(2);
    });

    it('un fallo de red se muestra en el formulario y no como aviso global duplicado', async () => {
      server.use(http.post(BRANCHES, () => HttpResponse.error()));
      await setup();
      await fillValid();
      await userEvent.click(submit('Crear sucursal'));
      expect(await screen.findByRole('alert')).toHaveTextContent('No se pudo conectar');
      expect(TestBed.inject(NotificationService).items()).toEqual([]);
    });

    it('el error general desaparece al editar un campo', async () => {
      server.use(http.post(BRANCHES, () => new HttpResponse(null, { status: 500 })));
      await setup();
      await fillValid();
      await userEvent.click(submit('Crear sucursal'));
      await screen.findByRole('alert');
      await userEvent.type(nombre(), 'x');
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });
  });

  describe('reapertura', () => {
    it('al cancelar y volver a abrir el formulario aparece limpio (sin lo escrito ni errores)', async () => {
      const { update } = await setup();
      await userEvent.type(nombre(), 'Algo');
      await userEvent.click(submit('Crear sucursal'));
      expect(screen.getByText('La dirección es requerida.')).toBeInTheDocument();
      await userEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

      await update({ open: true });
      expect(nombre()).toHaveValue('');
      expect(screen.queryByText('La dirección es requerida.')).not.toBeInTheDocument();
    });

    it('cambia a los datos de otra sucursal al reabrir para editarla', async () => {
      const { update } = await setup({ open: false, branch: EXISTING });
      await update({ open: true });
      expect(nombre()).toHaveValue('Sede Central');
      await update({ open: false });
      await update({ branch: { ...EXISTING, id: 8, nombre: 'Sucursal Sur', direccion: 'Carrera 30', telefono: '' }, open: true });
      expect(nombre()).toHaveValue('Sucursal Sur');
      expect(telefono()).toHaveValue('');
    });

    it('un error del servidor anterior no reaparece al reabrir', async () => {
      server.use(http.post(BRANCHES, () => new HttpResponse(null, { status: 500 })));
      const { update } = await setup();
      await fillValid();
      await userEvent.click(submit('Crear sucursal'));
      await screen.findByRole('alert');
      await userEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
      await update({ open: true });
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });
  });
});
