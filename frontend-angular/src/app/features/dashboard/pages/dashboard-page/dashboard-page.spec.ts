import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { API_BASE_URL } from '@core/api/api-base-url';
import { errorInterceptor } from '@core/api/error.interceptor';
import { SESSION_STORAGE_KEY } from '@core/auth/session/auth-store';
import { apiErrorBody, server, TEST_API } from '@testing/msw-server';
import { DashboardPage } from './dashboard-page';

const DASHBOARD = {
  summary: { totalRevenue: 2_500_000, totalUnitsSold: 120, totalInventoryValue: 9_000_000, averageTicket: 50_000, branchCount: 2 },
  salesTrend: [
    { saleDate: '2026-10-14', revenue: 1_000_000 },
    { saleDate: '2026-10-15', revenue: 1_500_000 },
  ],
  topProducts: [{ productId: 1, productName: 'Tornillo', totalSoldQuantity: 80 }],
  valuations: [],
  performance: [{ branchId: 10, branchName: 'Sede Central', revenue: 2_500_000, unitsSold: 120, salesCount: 7 }],
};

function useSession(rol: string) {
  localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify({ token: 't', email: 'e@z.co', nombre: 'Ana Pérez', rol, id: 1, sucursalId: 10 }));
}

function stub(overrides: { replenishment?: unknown[]; transfers?: unknown[] } = {}) {
  server.use(
    http.get(`${TEST_API}/api/v1/analytics/dashboard`, () => HttpResponse.json(DASHBOARD)),
    http.get(`${TEST_API}/api/v1/analytics/monthly-sales`, () => HttpResponse.json([{ monthName: 'Septiembre', year: 2026, revenue: 5_000_000, volume: 10 }])),
    http.get(`${TEST_API}/api/v1/analytics/inventory-rotation`, () => HttpResponse.json([])),
    http.get(`${TEST_API}/api/v1/analytics/replenishment-insights`, () =>
      HttpResponse.json(overrides.replenishment ?? [{ productId: 2, productName: 'Tuerca', currentStock: 1, minStock: 5, priority: 'HIGH' }]),
    ),
    http.get(`${TEST_API}/api/v1/alerts`, () => HttpResponse.json([])),
    http.get(`${TEST_API}/api/v1/transfers`, () => HttpResponse.json(overrides.transfers ?? [])),
    http.get(`${TEST_API}/api/branches`, () => HttpResponse.json([{ id: 10, nombre: 'Sede Central', activa: true }])),
  );
}

const renderPage = () =>
  render(DashboardPage, { providers: [provideHttpClient(withInterceptors([errorInterceptor])), { provide: API_BASE_URL, useValue: TEST_API }] });

describe('DashboardPage', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => localStorage.clear());

  it('saluda por el primer nombre y resume lo pendiente', async () => {
    useSession('ADMIN');
    stub();
    await renderPage();
    expect(screen.getByRole('heading', { level: 1, name: /^Buen(os|as) (días|tardes|noches), Ana Pérez$/ })).toBeTruthy();
    expect(await screen.findByText('Hay 1 producto por reponer.')).toBeTruthy();
  });

  it('dice que todo está en orden cuando no hay nada pendiente', async () => {
    useSession('ADMIN');
    stub({ replenishment: [] });
    await renderPage();
    expect(await screen.findByText('Todo en orden: no hay nada pendiente.')).toBeTruthy();
  });

  it('el administrador ve ingresos, ticket, valor del inventario y la comparación por sede', async () => {
    useSession('ADMIN');
    stub();
    await renderPage();
    expect(await screen.findByText('Ingresos', { selector: 'dt' })).toBeTruthy();
    expect(screen.getByText('Valor del inventario')).toBeTruthy();
    expect(screen.getByText('Por sede')).toBeTruthy();
    expect(screen.getByText('7 ventas')).toBeTruthy();
  });

  it('el operador de inventario no ve cifras financieras', async () => {
    useSession('OPERADOR_INVENTARIO');
    stub();
    await renderPage();
    expect(await screen.findByText('Unidades vendidas')).toBeTruthy();
    expect(screen.queryByText('Ingresos', { selector: 'dt' })).toBeNull();
    expect(screen.queryByText('Valor del inventario')).toBeNull();
    expect(screen.queryByText('Por sede')).toBeNull();
  });

  it('el vendedor no consulta la analítica y ve solo el saludo', async () => {
    useSession('SELLER');
    let called = false;
    server.use(http.get(`${TEST_API}/api/v1/analytics/*`, () => ((called = true), HttpResponse.json({}))));
    await renderPage();
    expect(screen.getByText('Tu cuenta no incluye indicadores')).toBeTruthy();
    expect(called).toBe(false);
  });

  it('cambiar el periodo vuelve a pedir las cifras con ese rango', async () => {
    useSession('ADMIN');
    stub();
    const starts: string[] = [];
    server.use(
      http.get(`${TEST_API}/api/v1/analytics/dashboard`, ({ request }) => {
        starts.push(new URL(request.url).searchParams.get('startDate') ?? '');
        return HttpResponse.json(DASHBOARD);
      }),
    );
    await renderPage();
    await screen.findByText('Unidades vendidas');
    await userEvent.click(screen.getByRole('radio', { name: 'Hoy' }));
    await screen.findByText('Unidades vendidas');
    expect(starts.length).toBe(2);
    expect(starts[1]).toMatch(/T00:00:00$/);
    expect(starts[0]).not.toBe(starts[1]);
  });

  it('si una sección falla, las demás siguen mostrándose', async () => {
    useSession('ADMIN');
    stub();
    server.use(http.get(`${TEST_API}/api/v1/analytics/replenishment-insights`, () => HttpResponse.json(apiErrorBody(500, 'INTERNAL_ERROR', 'Falla de reposición'), { status: 500 })));
    await renderPage();
    expect(await screen.findByText('Falla de reposición')).toBeTruthy();
    expect(await screen.findByText('Unidades vendidas')).toBeTruthy();
  });

  it('si fallan las cifras ofrece reintentar', async () => {
    useSession('ADMIN');
    stub();
    server.use(http.get(`${TEST_API}/api/v1/analytics/dashboard`, () => HttpResponse.json(apiErrorBody(500, 'INTERNAL_ERROR', 'Sin cifras'), { status: 500 })), http.get(`${TEST_API}/api/v1/analytics/dashboard`, () => HttpResponse.json(DASHBOARD), { once: true }));
    await renderPage();
    await screen.findByText('Sin cifras');
    server.use(http.get(`${TEST_API}/api/v1/analytics/dashboard`, () => HttpResponse.json(DASHBOARD)));
    await userEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
    expect(await screen.findByText('Unidades vendidas')).toBeTruthy();
  });
});
