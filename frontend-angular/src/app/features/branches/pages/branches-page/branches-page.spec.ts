import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { render, screen, within } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { API_BASE_URL } from '@core/api/api-base-url';
import { errorInterceptor } from '@core/api/error.interceptor';
import { NotificationService } from '@core/notifications/notification.service';
import { apiErrorBody, server, TEST_API } from '@testing/msw-server';
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
});
