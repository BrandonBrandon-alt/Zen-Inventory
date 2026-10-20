import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { delay, http, HttpResponse } from 'msw';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
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

function stub(overrides: { replenishment?: unknown[]; transfers?: unknown[]; alerts?: unknown[] } = {}) {
  server.use(
    http.get(`${TEST_API}/api/v1/analytics/dashboard`, () => HttpResponse.json(DASHBOARD)),
    http.get(`${TEST_API}/api/v1/analytics/monthly-sales`, () => HttpResponse.json([{ monthName: 'Septiembre', year: 2026, revenue: 5_000_000, volume: 10 }])),
    http.get(`${TEST_API}/api/v1/analytics/inventory-rotation`, () => HttpResponse.json([])),
    http.get(`${TEST_API}/api/v1/analytics/replenishment-insights`, () =>
      HttpResponse.json(overrides.replenishment ?? [{ branchId: 10, branchName: 'Sede Central', productId: 2, productName: 'Tuerca', currentStock: 1, minStock: 5, priority: 'HIGH' }]),
    ),
    http.get(`${TEST_API}/api/v1/alerts`, () => HttpResponse.json(overrides.alerts ?? [])),
    http.get(`${TEST_API}/api/v1/transfers`, () => HttpResponse.json(overrides.transfers ?? [])),
    http.get(`${TEST_API}/api/catalog/suppliers`, () => HttpResponse.json([])),
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

  describe('estado de carga de las gráficas', () => {
    const card = (name: string) => screen.getByRole('region', { name });
    const skeleton = (el: HTMLElement) => el.querySelector('app-chart-skeleton');

    it('mientras llegan los datos, cada gráfica muestra su marcador y la tarjeta se anuncia como ocupada; al llegar, lo cambia por la gráfica', async () => {
      useSession('ADMIN');
      stub();
      server.use(http.get(`${TEST_API}/api/v1/analytics/dashboard`, async () => (await delay(150), HttpResponse.json(DASHBOARD))));
      await renderPage();
      expect(skeleton(card('Ingresos'))).not.toBeNull();
      expect(card('Ingresos')).toHaveAttribute('aria-busy', 'true');
      expect(skeleton(card('Más vendidos'))).not.toBeNull();
      expect(skeleton(card('Por sede'))).not.toBeNull();
      await screen.findByText('Unidades vendidas');
      await vi.waitFor(() => expect(skeleton(card('Ingresos'))).toBeNull());
      expect(card('Ingresos')).toHaveAttribute('aria-busy', 'false');
      expect(skeleton(card('Más vendidos'))).toBeNull();
      expect(card('Ingresos').querySelector('app-area-chart')).not.toBeNull();
    });

    it('al cambiar de periodo la gráfica anterior se queda atenuada con una barra de progreso, sin volver al marcador', async () => {
      useSession('ADMIN');
      stub();
      let calls = 0;
      server.use(
        http.get(`${TEST_API}/api/v1/analytics/dashboard`, async () => {
          calls++;
          if (calls > 1) await delay(300);
          return HttpResponse.json(DASHBOARD);
        }),
      );
      await renderPage();
      await screen.findByText('Unidades vendidas');
      await vi.waitFor(() => expect(card('Ingresos').querySelector('app-area-chart')).not.toBeNull());
      await userEvent.click(screen.getByRole('radio', { name: 'Hoy' }));
      const ingresos = card('Ingresos');
      await vi.waitFor(() => expect(ingresos).toHaveAttribute('aria-busy', 'true'));
      expect(skeleton(ingresos)).toBeNull();
      expect(ingresos.querySelector('app-area-chart')?.parentElement).toHaveClass('opacity-45');
      expect(ingresos.querySelector('.animate-progress')).not.toBeNull();
      await vi.waitFor(() => expect(ingresos).toHaveAttribute('aria-busy', 'false'));
      expect(ingresos.querySelector('.animate-progress')).toBeNull();
    });

    it('si falla la carga, la gráfica principal lo dice en lugar de quedarse vacía o cargando', async () => {
      useSession('ADMIN');
      stub();
      server.use(http.get(`${TEST_API}/api/v1/analytics/dashboard`, () => HttpResponse.json(apiErrorBody(500, 'INTERNAL_ERROR', 'Falla del panel'), { status: 500 })));
      await renderPage();
      await vi.waitFor(() => expect(card('Ingresos')).toHaveTextContent('No se pudo cargar la gráfica'));
      expect(skeleton(card('Ingresos'))).toBeNull();
    });
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
  describe('Por atender: gestionar el stock desde el panel', () => {
    const ALERT = { id: 7, branchId: 10, productId: 2, message: 'Stock bajo: quedan 1 de 5', alertDate: '2026-10-15T08:00:00', resolved: false, type: 'LOW_STOCK' };

    it('si el producto ya tiene su alerta abierta, ofrece «Gestionar» y abre la resolución de esa alerta', async () => {
      useSession('MANAGER');
      stub({ alerts: [ALERT] });
      await renderPage();
      await userEvent.click(await screen.findByRole('button', { name: 'Gestionar stock de Tuerca' }));
      expect(await screen.findByRole('dialog', { name: 'Resolver alerta' })).toBeTruthy();
    });

    it('sin alerta abierta de ese producto en esa sucursal no hay botón (la alerta de otra sucursal no cuenta)', async () => {
      useSession('MANAGER');
      stub({ alerts: [{ ...ALERT, branchId: 20 }] });
      await renderPage();
      await screen.findByText('Tuerca');
      expect(screen.queryByRole('button', { name: /Gestionar stock/ })).toBeNull();
    });

    it('el administrador ve de qué sucursal es cada fila, y dos sucursales con el mismo producto no se mezclan', async () => {
      useSession('ADMIN');
      stub({
        replenishment: [
          { branchId: 10, branchName: 'Sede Central', productId: 2, productName: 'Tuerca', currentStock: 1, minStock: 5, priority: 'HIGH' },
          { branchId: 20, branchName: 'Sucursal Norte', productId: 2, productName: 'Tuerca', currentStock: 0, minStock: 8, priority: 'HIGH' },
        ],
      });
      await renderPage();
      expect(await screen.findByText(/Sede Central ·/)).toBeTruthy();
      expect(screen.getByText(/Sucursal Norte ·/)).toBeTruthy();
      expect(screen.getAllByText('Tuerca')).toHaveLength(2);
    });
  });
});
