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
import { SuppliersPage } from './suppliers-page';

const SUPPLIERS = [
  { id: 1, nombre: 'Ferretería Central', contacto: '3001112233', tiempoEntregaDias: 3 },
  { id: 2, nombre: 'Aceros del Sur', contacto: 'ventas@aceros.co', tiempoEntregaDias: 1 },
  { id: 3, nombre: 'Sin datos' },
];
const URL = `${TEST_API}/api/catalog/suppliers`;

const renderPage = () =>
  render(SuppliersPage, { providers: [provideHttpClient(withInterceptors([errorInterceptor])), { provide: API_BASE_URL, useValue: TEST_API }] });

const names = () => screen.getAllByRole('row').slice(1).map((r) => within(r).getAllByRole('cell')[0].textContent?.trim());

describe('SuppliersPage', () => {
  it('no tiene problemas de accesibilidad detectables', async () => {
    server.use(http.get(URL, () => HttpResponse.json(SUPPLIERS)));
    await renderPage();
    await vi.waitFor(() => expect(screen.getAllByRole('row').length).toBeGreaterThan(1));
    await expectAccessible();
  });

  it('lista proveedores con contacto y días de entrega (singular, plural y sin dato)', async () => {
    server.use(http.get(URL, () => HttpResponse.json(SUPPLIERS)));
    await renderPage();
    expect(await screen.findByText('Ferretería Central')).toBeInTheDocument();
    expect(screen.getByText('3 proveedores')).toBeInTheDocument();
    expect(screen.getByText('3 días')).toBeInTheDocument();
    expect(screen.getByText('1 día')).toBeInTheDocument();
    // Sin contacto ni días: ambas celdas muestran un guion.
    expect(within(screen.getByRole('row', { name: /Sin datos/ })).getAllByText('—')).toHaveLength(2);
    expect(names()).toEqual(['Ferretería Central', 'Aceros del Sur', 'Sin datos']);
  });

  it('sin proveedores muestra un estado vacío', async () => {
    server.use(http.get(URL, () => HttpResponse.json([])));
    await renderPage();
    expect(await screen.findByText('Todavía no hay proveedores')).toBeInTheDocument();
  });

  it('si falla la carga muestra el error en la tabla, sin aviso global', async () => {
    server.use(http.get(URL, () => HttpResponse.json(apiErrorBody(500, 'INTERNAL_ERROR', 'Falla de prueba'), { status: 500 })));
    await renderPage();
    expect(await screen.findByRole('alert')).toHaveTextContent('Falla de prueba');
    expect(TestBed.inject(NotificationService).items()).toEqual([]);
  });

  it('crea un proveedor; el contacto y los días vacíos se envían como ausentes', async () => {
    let list = SUPPLIERS;
    let body: unknown;
    server.use(
      http.get(URL, () => HttpResponse.json(list)),
      http.post(URL, async ({ request }) => {
        body = await request.json();
        list = [...SUPPLIERS, { id: 4, nombre: 'Nuevo' }];
        return HttpResponse.json({ id: 4, nombre: 'Nuevo' }, { status: 201 });
      }),
    );
    await renderPage();
    await screen.findByText('Aceros del Sur');
    await userEvent.click(screen.getByRole('button', { name: /Nuevo proveedor/ }));
    await userEvent.type(screen.getByLabelText('Nombre'), ' Nuevo ');
    await userEvent.click(screen.getByRole('button', { name: 'Crear proveedor' }));
    expect(await screen.findByText('4 proveedores')).toBeInTheDocument();
    expect(body).toEqual({ nombre: 'Nuevo' });
  });

  it('envía los días de entrega como número', async () => {
    let body: unknown;
    server.use(
      http.get(URL, () => HttpResponse.json(SUPPLIERS)),
      http.post(URL, async ({ request }) => ((body = await request.json()), HttpResponse.json({ id: 9, nombre: 'X' }, { status: 201 }))),
    );
    await renderPage();
    await screen.findByText('Aceros del Sur');
    await userEvent.click(screen.getByRole('button', { name: /Nuevo proveedor/ }));
    await userEvent.type(screen.getByLabelText('Nombre'), 'X');
    await userEvent.type(screen.getByLabelText('Contacto (teléfono o correo)'), '3001234567');
    await userEvent.type(screen.getByLabelText('Tiempo de entrega (días)'), '5');
    await userEvent.click(screen.getByRole('button', { name: 'Crear proveedor' }));
    await vi.waitFor(() => expect(body).toEqual({ nombre: 'X', contacto: '3001234567', tiempoEntregaDias: 5 }));
  });

  it('el nombre es obligatorio', async () => {
    let called = false;
    server.use(http.get(URL, () => HttpResponse.json(SUPPLIERS)), http.post(URL, () => ((called = true), HttpResponse.json({}))));
    await renderPage();
    await screen.findByText('Aceros del Sur');
    await userEvent.click(screen.getByRole('button', { name: /Nuevo proveedor/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Crear proveedor' }));
    expect(await screen.findByText('El nombre es requerido.')).toBeInTheDocument();
    expect(called).toBe(false);
  });

  it('editar abre el formulario con los datos de esa fila', async () => {
    let putId = '';
    server.use(
      http.get(URL, () => HttpResponse.json(SUPPLIERS)),
      http.put(`${URL}/:id`, ({ params }) => ((putId = String(params['id'])), HttpResponse.json(SUPPLIERS[1]))),
    );
    await renderPage();
    await screen.findByText('Aceros del Sur');
    await userEvent.click(screen.getByRole('button', { name: 'Editar Aceros del Sur' }));
    expect(screen.getByLabelText('Contacto (teléfono o correo)')).toHaveValue('ventas@aceros.co');
    expect(screen.getByLabelText('Tiempo de entrega (días)')).toHaveValue(1);
    await userEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }));
    await vi.waitFor(() => expect(putId).toBe('2'));
  });

  it('eliminar pide confirmación y, al confirmar, borra y avisa', async () => {
    let deleted = '';
    let list = SUPPLIERS;
    server.use(
      http.get(URL, () => HttpResponse.json(list)),
      http.delete(`${URL}/:id`, ({ params }) => {
        deleted = String(params['id']);
        list = SUPPLIERS.filter((s) => s.id !== 1);
        return new HttpResponse(null, { status: 204 });
      }),
    );
    await renderPage();
    await screen.findByText('Ferretería Central');
    await userEvent.click(screen.getByRole('button', { name: 'Eliminar Ferretería Central' }));
    expect(screen.getByRole('dialog', { name: 'Eliminar proveedor' })).toHaveTextContent('Ferretería Central');
    await userEvent.click(screen.getByRole('button', { name: 'Eliminar' }));
    expect(await screen.findByText('2 proveedores')).toBeInTheDocument();
    expect(deleted).toBe('1');
    expect(TestBed.inject(NotificationService).items()[0]).toMatchObject({ message: 'Proveedor "Ferretería Central" eliminado.' });
  });

  it('con productos o compras asociadas (409) el diálogo lo explica y sigue abierto', async () => {
    server.use(
      http.get(URL, () => HttpResponse.json(SUPPLIERS)),
      http.delete(`${URL}/:id`, () => HttpResponse.json(apiErrorBody(409, 'DATA_INTEGRITY', 'fk violation'), { status: 409 })),
    );
    await renderPage();
    await screen.findByText('Aceros del Sur');
    await userEvent.click(screen.getByRole('button', { name: 'Eliminar Aceros del Sur' }));
    await userEvent.click(screen.getByRole('button', { name: 'Eliminar' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('productos o compras asociadas');
    expect(screen.getByRole('dialog', { name: 'Eliminar proveedor' })).toBeInTheDocument();
  });
});
