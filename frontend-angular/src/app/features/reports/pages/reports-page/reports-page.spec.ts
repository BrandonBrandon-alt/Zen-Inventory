import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { render, screen, within } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { API_BASE_URL } from '@core/api/api-base-url';
import { errorInterceptor } from '@core/api/error.interceptor';
import { SESSION_STORAGE_KEY } from '@core/auth/session/auth-store';
import { CompanyInfo, DEFAULT_COMPANY } from '@core/company/company-info';
import { formatMoney } from '@shared/format/format';
import { PrintService } from '@shared/print/print.service';
import { expectAccessible } from '@testing/a11y';
import { chooseOption } from '@testing/select-helpers';
import { apiErrorBody, server, TEST_API } from '@testing/msw-server';
import { toLocalIso } from '@shared/format/format';
import { ReportsPage } from './reports-page';

const now = new Date();
const todayAt = (hour: number) => toLocalIso(new Date(now.getFullYear(), now.getMonth(), now.getDate(), hour));
const longAgo = toLocalIso(new Date(now.getFullYear() - 1, 0, 5, 10));

const sale = (id: number, extra: object = {}) => ({
  id,
  date: todayAt(10),
  status: 'COMPLETED',
  branchId: 10,
  branchName: 'Sede Central',
  userName: 'Luis',
  subtotal: 1000,
  totalDiscount: 0,
  totalFinal: 1000,
  globalDiscountPercentage: 0,
  details: [{ id: id * 10, productId: 1, productName: 'Tornillo', quantity: 2, unitPriceApplied: 500, discountPercentage: 0, subtotalLine: 1000 }],
  ...extra,
});

const SALES = [
  sale(1),
  sale(2, { userName: 'Sofía', subtotal: 3000, totalFinal: 3000, details: [{ id: 21, productId: 2, productName: 'Tuerca', quantity: 3, unitPriceApplied: 1000, discountPercentage: 0, subtotalLine: 3000 }] }),
  sale(3, { status: 'CANCELED', totalFinal: 700, subtotal: 700 }),
  sale(4, { date: longAgo }),
];
const BRANCHES = [
  { id: 10, nombre: 'Sede Central', activa: true },
  { id: 20, nombre: 'Sucursal Norte', activa: true },
];
/** El espacio tras «$» es no separable: se iguala para comparar texto. */
const norm = (text: string | null): string => (text ?? '').replace(/\s/g, ' ');
const URL_S = `${TEST_API}/api/v1/sales`;

function useSession(rol: string, sucursalId?: number) {
  localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify({ token: 't', email: 'e@z.co', nombre: 'Yo', rol, id: 1, sucursalId }));
}

function stub(sales: unknown[] = SALES) {
  server.use(http.get(URL_S, () => HttpResponse.json(sales)), http.get(`${TEST_API}/api/branches`, () => HttpResponse.json(BRANCHES)));
}

const printed: string[] = [];
const renderPage = () =>
  render(ReportsPage, {
    providers: [
      provideHttpClient(withInterceptors([errorInterceptor])),
      { provide: API_BASE_URL, useValue: TEST_API },
      { provide: PrintService, useValue: { print: (html: string) => printed.push(html) } },
      { provide: CompanyInfo, useValue: { load: async () => DEFAULT_COMPANY } },
    ],
  });

describe('ReportsPage', () => {
  beforeEach(() => {
    localStorage.clear();
    printed.length = 0;
  });
  afterEach(() => localStorage.clear());

  it('arranca con el cierre de caja de hoy: totales y ventas por vendedor, sin las anuladas ni las de otros días', async () => {
    useSession('MANAGER', 10);
    stub();
    await renderPage();
    const card = await screen.findByRole('region', { name: 'Cierre de caja' });
    expect(norm(card.textContent)).toContain(norm(formatMoney(4000)));
    expect(card).toHaveTextContent('1 venta anulada');
    const sellers = screen.getByRole('table', { name: 'Ventas por vendedor' });
    expect(within(sellers).getAllByRole('row').slice(1).map((r) => within(r).getAllByRole('cell')[0].textContent?.trim())).toEqual(['Sofía', 'Luis']);
    const products = screen.getByRole('table', { name: 'Productos más vendidos' });
    expect(within(products).getByText('Tuerca')).toBeInTheDocument();
  });

  it('un rango de fechas largo cambia el título a «Reporte de ventas» e incluye las ventas antiguas', async () => {
    useSession('MANAGER', 10);
    stub();
    await renderPage();
    await screen.findByRole('region', { name: 'Cierre de caja' });
    expect(screen.queryByRole('region', { name: 'Reporte de ventas' })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Este mes' }));
    expect(await screen.findByRole('region', { name: /Cierre de caja|Reporte de ventas/ })).toBeInTheDocument();
  });

  it('«Descargar PDF» abre el reporte A4 con lo que se ve', async () => {
    useSession('MANAGER', 10);
    stub();
    await renderPage();
    await screen.findByRole('region', { name: 'Cierre de caja' });
    await userEvent.click(screen.getByRole('button', { name: 'Descargar PDF' }));
    await vi.waitFor(() => expect(printed).toHaveLength(1));
    expect(printed[0]).toContain('Cierre de caja');
    expect(printed[0]).toContain('Sede Central');
    expect(printed[0]).toContain(formatMoney(4000));
  });

  it('el gerente no elige sucursal (el servidor le da la suya); el ADMIN sí, y el reporte la pide al servidor', async () => {
    useSession('MANAGER', 10);
    stub();
    await renderPage();
    await screen.findByRole('region', { name: 'Cierre de caja' });
    expect(screen.queryByRole('combobox', { name: 'Sucursal' })).not.toBeInTheDocument();
  });

  it('el ADMIN filtra por sucursal: pide solo esa al servidor y la rotula en el reporte', async () => {
    useSession('ADMIN');
    const asked: (string | null)[] = [];
    server.use(
      http.get(URL_S, ({ request }) => (asked.push(new URL(request.url).searchParams.get('branchId')), HttpResponse.json(SALES))),
      http.get(`${TEST_API}/api/branches`, () => HttpResponse.json(BRANCHES)),
    );
    await renderPage();
    await screen.findByRole('region', { name: 'Cierre de caja' });
    expect(screen.getByRole('region', { name: 'Cierre de caja' })).toHaveTextContent('Todas las sucursales');
    await chooseOption('Sucursal', 'Sucursal Norte');
    await vi.waitFor(() => expect(asked).toEqual([null, '20']));
    expect(await screen.findByText('Sucursal Norte', { selector: 'p' })).toBeInTheDocument();
  });

  it('sin ventas en el periodo lo dice en las dos tablas', async () => {
    useSession('MANAGER', 10);
    stub([]);
    await renderPage();
    await screen.findByRole('region', { name: 'Cierre de caja' });
    expect(screen.getAllByText('No hubo ventas en este periodo')).toHaveLength(2);
  });

  it('si falla la carga muestra el error y reintentar lo recupera; no se puede descargar mientras tanto', async () => {
    useSession('MANAGER', 10);
    let fail = true;
    server.use(
      http.get(URL_S, () => (fail ? HttpResponse.json(apiErrorBody(500, 'INTERNAL_ERROR', 'Falla de prueba'), { status: 500 }) : HttpResponse.json(SALES))),
      http.get(`${TEST_API}/api/branches`, () => HttpResponse.json(BRANCHES)),
    );
    await renderPage();
    expect(await screen.findByRole('alert')).toHaveTextContent('Falla de prueba');
    expect(screen.getByRole('button', { name: 'Descargar PDF' })).toBeDisabled();
    fail = false;
    await userEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
    expect(await screen.findByRole('region', { name: 'Cierre de caja' })).toBeInTheDocument();
  });

  it('no tiene problemas de accesibilidad detectables', async () => {
    useSession('ADMIN');
    stub();
    await renderPage();
    await screen.findByRole('region', { name: 'Cierre de caja' });
    await expectAccessible();
  });
});
