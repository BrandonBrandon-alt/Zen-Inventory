import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { render, screen, within } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it, vi } from 'vitest';
import { API_BASE_URL } from '@core/api/api-base-url';
import { errorInterceptor } from '@core/api/error.interceptor';
import { NotificationService } from '@core/notifications/notification.service';
import { apiErrorBody, server, TEST_API } from '@testing/msw-server';
import { expectAccessible } from '@testing/a11y';
import { UnitsPage } from './units-page';

const UNITS = [
  { id: 1, nombre: 'Unidad', abreviatura: 'UND' },
  { id: 2, nombre: 'Kilogramo', abreviatura: 'KG' },
];
const URL = `${TEST_API}/api/catalog/units`;

const renderPage = () =>
  render(UnitsPage, { providers: [provideHttpClient(withInterceptors([errorInterceptor])), { provide: API_BASE_URL, useValue: TEST_API }] });

const names = () => screen.getAllByRole('row').slice(1).map((r) => within(r).getAllByRole('cell')[0].textContent?.trim());

describe('UnitsPage', () => {
  it('no tiene problemas de accesibilidad detectables', async () => {
    server.use(http.get(URL, () => HttpResponse.json(UNITS)));
    await renderPage();
    await vi.waitFor(() => expect(screen.getAllByRole('row').length).toBeGreaterThan(1));
    await expectAccessible();
  });

  it('lista las unidades con su abreviatura y el resumen', async () => {
    server.use(http.get(URL, () => HttpResponse.json(UNITS)));
    await renderPage();
    expect(await screen.findByText('Kilogramo')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1, name: 'Unidades de medida' })).toBeInTheDocument();
    expect(screen.getByText('2 unidades')).toBeInTheDocument();
    expect(screen.getByText('KG')).toBeInTheDocument();
    expect(names()).toEqual(['Unidad', 'Kilogramo']);
  });

  it('sin unidades explica cómo seguir', async () => {
    server.use(http.get(URL, () => HttpResponse.json([])));
    await renderPage();
    expect(await screen.findByText('Todavía no hay unidades de medida')).toBeInTheDocument();
  });

  it('si falla la carga muestra el error en la tabla, sin aviso global', async () => {
    server.use(http.get(URL, () => HttpResponse.json(apiErrorBody(500, 'INTERNAL_ERROR', 'Falla de prueba'), { status: 500 })));
    await renderPage();
    expect(await screen.findByRole('alert')).toHaveTextContent('Falla de prueba');
    expect(TestBed.inject(NotificationService).items()).toEqual([]);
  });

  it('crea una unidad enviando nombre y abreviatura recortados, y recarga la lista', async () => {
    let list = UNITS;
    let body: unknown;
    server.use(
      http.get(URL, () => HttpResponse.json(list)),
      http.post(URL, async ({ request }) => {
        body = await request.json();
        const created = { id: 3, nombre: 'Litro', abreviatura: 'L' };
        list = [...UNITS, created];
        return HttpResponse.json(created, { status: 201 });
      }),
    );
    await renderPage();
    await screen.findByText('Kilogramo');
    await userEvent.click(screen.getByRole('button', { name: /Nueva unidad/ }));
    await userEvent.type(screen.getByLabelText('Nombre'), '  Litro ');
    await userEvent.type(screen.getByLabelText('Abreviatura'), ' L ');
    await userEvent.click(screen.getByRole('button', { name: 'Crear unidad' }));
    expect(await screen.findByText('3 unidades')).toBeInTheDocument();
    expect(body).toEqual({ nombre: 'Litro', abreviatura: 'L' });
  });

  it('el formulario vacío no se envía y señala los campos requeridos', async () => {
    let called = false;
    server.use(http.get(URL, () => HttpResponse.json(UNITS)), http.post(URL, () => ((called = true), HttpResponse.json({}))));
    await renderPage();
    await screen.findByText('Kilogramo');
    await userEvent.click(screen.getByRole('button', { name: /Nueva unidad/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Crear unidad' }));
    expect(await screen.findByText('El nombre es requerido.')).toBeInTheDocument();
    expect(screen.getByText('La abreviatura es requerida.')).toBeInTheDocument();
    expect(called).toBe(false);
  });

  it('una abreviatura de más de 10 caracteres se rechaza', async () => {
    server.use(http.get(URL, () => HttpResponse.json(UNITS)));
    await renderPage();
    await screen.findByText('Kilogramo');
    await userEvent.click(screen.getByRole('button', { name: /Nueva unidad/ }));
    await userEvent.type(screen.getByLabelText('Nombre'), 'Algo');
    await userEvent.type(screen.getByLabelText('Abreviatura'), 'DEMASIADOLARGA');
    await userEvent.click(screen.getByRole('button', { name: 'Crear unidad' }));
    expect(await screen.findByText('La abreviatura no puede superar 10 caracteres.')).toBeInTheDocument();
  });

  it('editar abre el formulario con los datos de esa fila y guarda en esa unidad', async () => {
    let putId = '';
    server.use(
      http.get(URL, () => HttpResponse.json(UNITS)),
      http.put(`${URL}/:id`, ({ params }) => ((putId = String(params['id'])), HttpResponse.json({ ...UNITS[1], nombre: 'Kilo' }))),
    );
    await renderPage();
    await screen.findByText('Kilogramo');
    await userEvent.click(screen.getByRole('button', { name: 'Editar Kilogramo' }));
    expect(screen.getByRole('dialog', { name: 'Editar unidad' })).toBeInTheDocument();
    expect(screen.getByLabelText('Abreviatura')).toHaveValue('KG');
    await userEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }));
    await vi.waitFor(() => expect(putId).toBe('2'));
  });

  it('eliminar pide confirmación; cancelar no llama al backend', async () => {
    let calls = 0;
    server.use(http.get(URL, () => HttpResponse.json(UNITS)), http.delete(`${URL}/:id`, () => ((calls++), new HttpResponse(null, { status: 204 }))));
    await renderPage();
    await screen.findByText('Kilogramo');
    await userEvent.click(screen.getByRole('button', { name: 'Eliminar Kilogramo' }));
    expect(screen.getByRole('dialog', { name: 'Eliminar unidad' })).toHaveTextContent('Kilogramo');
    await userEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(calls).toBe(0);
  });

  it('al confirmar elimina esa unidad, avisa y recarga', async () => {
    let deleted = '';
    let list = UNITS;
    server.use(
      http.get(URL, () => HttpResponse.json(list)),
      http.delete(`${URL}/:id`, ({ params }) => {
        deleted = String(params['id']);
        list = UNITS.filter((u) => u.id !== 2);
        return new HttpResponse(null, { status: 204 });
      }),
    );
    await renderPage();
    await screen.findByText('Kilogramo');
    await userEvent.click(screen.getByRole('button', { name: 'Eliminar Kilogramo' }));
    await userEvent.click(screen.getByRole('button', { name: 'Eliminar' }));
    expect(await screen.findByText('1 unidad')).toBeInTheDocument();
    expect(deleted).toBe('2');
    expect(TestBed.inject(NotificationService).items()[0]).toMatchObject({ kind: 'success', message: 'Unidad "Kilogramo" eliminada.' });
  });

  it('si algún producto la usa (409), el diálogo explica por qué y sigue abierto', async () => {
    server.use(
      http.get(URL, () => HttpResponse.json(UNITS)),
      http.delete(`${URL}/:id`, () => HttpResponse.json(apiErrorBody(409, 'DATA_INTEGRITY', 'violates foreign key'), { status: 409 })),
    );
    await renderPage();
    await screen.findByText('Kilogramo');
    await userEvent.click(screen.getByRole('button', { name: 'Eliminar Kilogramo' }));
    await userEvent.click(screen.getByRole('button', { name: 'Eliminar' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('hay productos que usan esta unidad');
    expect(screen.getByRole('dialog', { name: 'Eliminar unidad' })).toBeInTheDocument();
    expect(screen.queryByText(/foreign key/)).not.toBeInTheDocument();
  });
});
