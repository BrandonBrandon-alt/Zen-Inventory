import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { render, screen, within } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { delay, http, HttpResponse } from 'msw';
import { describe, expect, it, vi } from 'vitest';
import { API_BASE_URL } from '@core/api/api-base-url';
import { errorInterceptor } from '@core/api/error.interceptor';
import { NotificationService } from '@core/notifications/notification.service';
import { apiErrorBody, server, TEST_API } from '@testing/msw-server';
import { expectAccessible } from '@testing/a11y';
import { BranchesPage } from './branches-page';

const BRANCHES = [
  { id: 1, nombre: 'Sede Central', direccion: 'Calle 10 # 5-20', telefono: '6017001001', activa: true },
  { id: 2, nombre: 'Sucursal Norte', direccion: 'Av. 15 # 120-33', telefono: '6017002002', activa: true },
  { id: 3, nombre: 'Sucursal Sur', direccion: 'Carrera 30 # 2-10', telefono: '6017003003', activa: false },
];
const URL = `${TEST_API}/api/branches`;

const renderPage = () =>
  render(BranchesPage, {
    providers: [provideHttpClient(withInterceptors([errorInterceptor])), { provide: API_BASE_URL, useValue: TEST_API }],
  });

const names = () =>
  screen.getAllByRole('row').slice(1).map((r) => within(r).getAllByRole('cell')[0].textContent?.trim());

describe('BranchesPage', () => {
  it('no tiene problemas de accesibilidad detectables', async () => {
    server.use(http.get(URL, () => HttpResponse.json(BRANCHES)));
    await renderPage();
    await vi.waitFor(() => expect(screen.getAllByRole('row').length).toBeGreaterThan(1));
    await expectAccessible();
  });

  it('mientras carga muestra el estado de carga y luego las sucursales', async () => {
    server.use(http.get(URL, () => HttpResponse.json(BRANCHES)));
    await renderPage();
    expect(await screen.findByText('Sede Central')).toBeInTheDocument();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(names()).toEqual(['Sede Central', 'Sucursal Norte', 'Sucursal Sur']);
  });

  it('muestra título, resumen y el estado de cada sucursal con texto (no solo color)', async () => {
    server.use(http.get(URL, () => HttpResponse.json(BRANCHES)));
    await renderPage();
    expect(screen.getByRole('heading', { level: 1, name: 'Sucursales' })).toBeInTheDocument();
    expect(await screen.findByText('3 sucursales, 2 activas')).toBeInTheDocument();
    expect(screen.getAllByText('Activa')).toHaveLength(2);
    expect(screen.getByText('Inactiva')).toBeInTheDocument();
  });

  it('el resumen respeta el singular', async () => {
    server.use(http.get(URL, () => HttpResponse.json([BRANCHES[0]])));
    await renderPage();
    expect(await screen.findByText('1 sucursal, 1 activa')).toBeInTheDocument();
  });

  it('se puede ordenar por nombre', async () => {
    server.use(http.get(URL, () => HttpResponse.json(BRANCHES)));
    await renderPage();
    await screen.findByText('Sede Central');
    const button = within(screen.getByRole('columnheader', { name: /Nombre/ })).getByRole('button');
    await userEvent.click(button);
    await userEvent.click(button);
    expect(names()).toEqual(['Sucursal Sur', 'Sucursal Norte', 'Sede Central']);
  });

  it('sin sucursales muestra un estado vacío explicativo', async () => {
    server.use(http.get(URL, () => HttpResponse.json([])));
    await renderPage();
    expect(await screen.findByText('Todavía no hay sucursales')).toBeInTheDocument();
    expect(screen.queryByText(/sucursales,/)).not.toBeInTheDocument();
  });

  it('si falla la carga muestra el error en la tabla, permite reintentar y entonces carga', async () => {
    let calls = 0;
    server.use(
      http.get(URL, () => {
        calls++;
        return calls === 1
          ? HttpResponse.json(apiErrorBody(500, 'INTERNAL_ERROR', 'Ocurrió un error inesperado. Código: a1b2c3d4'), { status: 500 })
          : HttpResponse.json(BRANCHES);
      }),
    );
    await renderPage();
    expect(await screen.findByRole('alert')).toHaveTextContent('Código: a1b2c3d4');
    expect(screen.queryByText('Sede Central')).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
    expect(await screen.findByText('Sede Central')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(calls).toBe(2);
  });

  it('el error se muestra en la tabla y NO como aviso global duplicado', async () => {
    server.use(http.get(URL, () => HttpResponse.error()));
    await renderPage();
    expect(await screen.findByRole('alert')).toHaveTextContent('No se pudo conectar');
    expect(TestBed.inject(NotificationService).items()).toEqual([]);
  });

  describe('crear', () => {
    it('"Nueva sucursal" abre el formulario, crea y la lista se actualiza sin mostrar el esqueleto', async () => {
      let list = BRANCHES;
      let listCalls = 0;
      server.use(
        http.get(URL, () => { listCalls++; return HttpResponse.json(list); }),
        http.post(URL, () => {
          const created = { id: 9, nombre: 'Sucursal Oriente', direccion: 'Calle 50', telefono: '', activa: true };
          list = [...BRANCHES, created];
          return HttpResponse.json(created, { status: 201 });
        }),
      );
      await renderPage();
      await screen.findByText('Sede Central');
      await userEvent.click(screen.getByRole('button', { name: /Nueva sucursal/ }));
      await userEvent.type(screen.getByLabelText('Nombre'), 'Sucursal Oriente');
      await userEvent.type(screen.getByLabelText('Dirección'), 'Calle 50');
      await userEvent.click(screen.getByRole('button', { name: 'Crear sucursal' }));

      expect(await screen.findByText('4 sucursales, 3 activas')).toBeInTheDocument();
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      expect(listCalls).toBe(2);
      expect(TestBed.inject(NotificationService).items()[0]).toMatchObject({ kind: 'success' });
    });
  });

  describe('editar', () => {
    it('abre el formulario con los datos de esa fila y guarda en esa sucursal', async () => {
      let putId = '';
      server.use(
        http.get(URL, () => HttpResponse.json(BRANCHES)),
        http.put(`${URL}/:id`, ({ params }) => { putId = String(params['id']); return HttpResponse.json({ ...BRANCHES[1], nombre: 'Norte 2' }); }),
      );
      await renderPage();
      await screen.findByText('Sede Central');
      await userEvent.click(screen.getByRole('button', { name: 'Editar Sucursal Norte' }));
      expect(screen.getByRole('dialog', { name: 'Editar sucursal' })).toBeInTheDocument();
      expect(screen.getByLabelText('Nombre')).toHaveValue('Sucursal Norte');
      await userEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }));
      await vi.waitFor(() => expect(putId).toBe('2'));
    });

    it('tras crear, abrir otra vez "Nueva sucursal" no arrastra la sucursal editada antes', async () => {
      server.use(http.get(URL, () => HttpResponse.json(BRANCHES)));
      await renderPage();
      await screen.findByText('Sede Central');
      await userEvent.click(screen.getByRole('button', { name: 'Editar Sede Central' }));
      await userEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
      await userEvent.click(screen.getByRole('button', { name: /Nueva sucursal/ }));
      expect(screen.getByRole('dialog', { name: 'Nueva sucursal' })).toBeInTheDocument();
      expect(screen.getByLabelText('Nombre')).toHaveValue('');
    });
  });

  describe('desactivar', () => {
    it('solo las sucursales activas tienen el botón de desactivar', async () => {
      server.use(http.get(URL, () => HttpResponse.json(BRANCHES)));
      await renderPage();
      await screen.findByText('Sede Central');
      expect(screen.getAllByRole('button', { name: /^Desactivar / })).toHaveLength(2);
      expect(screen.queryByRole('button', { name: 'Desactivar Sucursal Sur' })).not.toBeInTheDocument();
    });

    it('pide confirmación; cancelar no llama al backend', async () => {
      let calls = 0;
      server.use(http.get(URL, () => HttpResponse.json(BRANCHES)), http.delete(`${URL}/:id`, () => { calls++; return new HttpResponse(null, { status: 204 }); }));
      await renderPage();
      await screen.findByText('Sede Central');
      await userEvent.click(screen.getByRole('button', { name: 'Desactivar Sede Central' }));
      expect(screen.getByRole('dialog', { name: 'Desactivar sucursal' })).toHaveTextContent('Sede Central');
      await userEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      expect(calls).toBe(0);
    });

    it('al confirmar desactiva esa sucursal, avisa y recarga la lista', async () => {
      let deleted = '';
      let list = BRANCHES;
      server.use(
        http.get(URL, () => HttpResponse.json(list)),
        http.delete(`${URL}/:id`, ({ params }) => {
          deleted = String(params['id']);
          list = BRANCHES.map((b) => (b.id === 1 ? { ...b, activa: false } : b));
          return new HttpResponse(null, { status: 204 });
        }),
      );
      await renderPage();
      await screen.findByText('Sede Central');
      await userEvent.click(screen.getByRole('button', { name: 'Desactivar Sede Central' }));
      await userEvent.click(screen.getByRole('button', { name: 'Desactivar' }));

      expect(await screen.findByText('3 sucursales, 1 activa')).toBeInTheDocument();
      expect(deleted).toBe('1');
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      expect(TestBed.inject(NotificationService).items()[0]).toMatchObject({ kind: 'success', message: 'Sucursal "Sede Central" desactivada.' });
    });

    it('la recarga posterior es silenciosa: la tabla no vuelve al esqueleto mientras llega la lista', async () => {
      let listCalls = 0;
      server.use(
        http.get(URL, async () => {
          listCalls++;
          if (listCalls > 1) await delay(300);
          return HttpResponse.json(BRANCHES);
        }),
        http.delete(`${URL}/:id`, () => new HttpResponse(null, { status: 204 })),
      );
      await renderPage();
      await screen.findByText('Sede Central');
      await userEvent.click(screen.getByRole('button', { name: 'Desactivar Sede Central' }));
      await userEvent.click(screen.getByRole('button', { name: 'Desactivar' }));
      await vi.waitFor(() => expect(listCalls).toBe(2));
      expect(screen.getByText('Sede Central')).toBeInTheDocument();
      expect(screen.queryByRole('status')).not.toBeInTheDocument();
    });

    it('si falla, el error queda en el diálogo (abierto) y no hay aviso global', async () => {
      server.use(
        http.get(URL, () => HttpResponse.json(BRANCHES)),
        http.delete(`${URL}/:id`, () => HttpResponse.json(apiErrorBody(409, 'INVALID_STATE', 'La sucursal tiene stock'), { status: 409 })),
      );
      await renderPage();
      await screen.findByText('Sede Central');
      await userEvent.click(screen.getByRole('button', { name: 'Desactivar Sede Central' }));
      await userEvent.click(screen.getByRole('button', { name: 'Desactivar' }));

      expect(await screen.findByRole('alert')).toHaveTextContent('La sucursal tiene stock');
      expect(screen.getByRole('dialog', { name: 'Desactivar sucursal' })).toBeInTheDocument();
      expect(TestBed.inject(NotificationService).items()).toEqual([]);
    });
  });
});
