import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { render, screen, within } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { API_BASE_URL } from '@core/api/api-base-url';
import { errorInterceptor } from '@core/api/error.interceptor';
import { SESSION_STORAGE_KEY } from '@core/auth/session/auth-store';
import { NotificationService } from '@core/notifications/notification.service';
import { chooseOption } from '@testing/select-helpers';
import { apiErrorBody, server, TEST_API } from '@testing/msw-server';
import { PrintService } from '@shared/print/print.service';
import { SalesHistoryPage } from './sales-history-page';

const sale = (id: number, status: string, extra: object = {}) => ({
  id,
  date: `2026-10-${String(10 + id).padStart(2, '0')}T10:00:00`,
  status,
  branchId: 10,
  branchName: 'Sede Central',
  userName: 'Luis',
  customerName: 'Ana Pérez',
  customerDocument: '123',
  subtotal: 1000 * id,
  totalDiscount: 0,
  totalFinal: 1000 * id,
  globalDiscountPercentage: 0,
  details: [{ id: id * 10, productId: 1, productName: 'Tornillo', quantity: 2, unitPriceApplied: 500 * id, discountPercentage: 0, subtotalLine: 1000 * id }],
  ...extra,
});

const SALES = [
  sale(1, 'COMPLETED'),
  sale(2, 'CANCELED', { customerName: '', customerDocument: '', cancellationReason: 'Error de digitación' }),
  sale(3, 'RETURNED', { customerName: 'Marta Ríos', customerDocument: '555', userName: 'Sofía' }),
  sale(4, 'COMPLETED', { customerName: 'Pedro Gómez', customerDocument: '777', branchId: 20, branchName: 'Sucursal Norte' }),
];
const BRANCHES = [
  { id: 10, nombre: 'Sede Central', activa: true },
  { id: 20, nombre: 'Sucursal Norte', activa: true },
];
const URL_S = `${TEST_API}/api/v1/sales`;

function useSession(rol: string, sucursalId?: number) {
  localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify({ token: 't', email: 'e@z.co', nombre: 'Yo', rol, id: 1, sucursalId }));
}

function stub(sales: unknown[] = SALES) {
  server.use(http.get(URL_S, () => HttpResponse.json(sales)), http.get(`${TEST_API}/api/branches`, () => HttpResponse.json(BRANCHES)));
}

const printed: string[] = [];
const renderPage = () =>
  render(SalesHistoryPage, {
    providers: [
      provideHttpClient(withInterceptors([errorInterceptor])),
      { provide: API_BASE_URL, useValue: TEST_API },
      { provide: PrintService, useValue: { print: (html: string) => printed.push(html) } },
    ],
  });

const ids = () => screen.getAllByRole('row').slice(1).map((r) => within(r).getAllByRole('cell')[0]?.textContent?.trim());

async function openDetail(id: number) {
  await userEvent.click(await screen.findByRole('button', { name: `Ver venta ${id}` }));
  return screen.getByRole('dialog', { name: `Venta #${id}` });
}

describe('SalesHistoryPage', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => localStorage.clear());

  describe('lista', () => {
    it('muestra las ventas, la más reciente primero, con cliente, estado en texto y total', async () => {
      useSession('MANAGER', 10);
      stub();
      await renderPage();
      expect(await screen.findByText('#4')).toBeInTheDocument();
      expect(screen.getByRole('heading', { level: 1, name: 'Historial de ventas' })).toBeInTheDocument();
      expect(ids()).toEqual(['#4', '#3', '#2', '#1']);
      expect(within(screen.getByRole('row', { name: /#2\b/ })).getByText('Cliente sin registrar')).toBeInTheDocument();
      expect(within(screen.getByRole('row', { name: /#2\b/ })).getByText('Anulada')).toBeInTheDocument();
      expect(within(screen.getByRole('row', { name: /#3\b/ })).getByText('Con devolución')).toBeInTheDocument();
      expect(within(screen.getByRole('row', { name: /#1\b/ })).getByText('$ 1.000')).toBeInTheDocument();
    });

    it('el resumen suma solo las ventas completadas', async () => {
      useSession('MANAGER', 10);
      stub();
      await renderPage();
      expect(await screen.findByText('2 ventas completadas, $ 5.000')).toBeInTheDocument(); // #1 (1.000) + #4 (4.000)
    });

    it('filtra por estado', async () => {
      useSession('MANAGER', 10);
      stub();
      await renderPage();
      await screen.findByText('#4');
      await chooseOption('Estado de la venta', 'Anulada');
      expect(ids()).toEqual(['#2']);
    });

    it('busca por número, cliente, documento o vendedor sin distinguir acentos', async () => {
      useSession('MANAGER', 10);
      stub();
      await renderPage();
      await screen.findByText('#4');
      const search = screen.getByRole('searchbox', { name: 'Buscar venta' });
      await userEvent.type(search, 'rios');
      expect(ids()).toEqual(['#3']);
      await userEvent.clear(search);
      await userEvent.type(search, 'sofia');
      expect(ids()).toEqual(['#3']);
      await userEvent.clear(search);
      await userEvent.type(search, '123');
      expect(ids()).toEqual(['#1']);
    });

    it('una búsqueda sin resultados lo dice', async () => {
      useSession('MANAGER', 10);
      stub();
      await renderPage();
      await screen.findByText('#4');
      await userEvent.type(screen.getByRole('searchbox', { name: 'Buscar venta' }), 'zzz');
      expect(screen.getByText('Ninguna venta coincide')).toBeInTheDocument();
    });

    it('sin ventas invita a registrar la primera', async () => {
      useSession('MANAGER', 10);
      stub([]);
      await renderPage();
      expect(await screen.findByText('Todavía no hay ventas')).toBeInTheDocument();
    });

    it('si falla la carga muestra el error en la tabla, sin aviso global', async () => {
      useSession('MANAGER', 10);
      stub();
      server.use(http.get(URL_S, () => HttpResponse.json(apiErrorBody(500, 'INTERNAL_ERROR', 'Falla de prueba'), { status: 500 })));
      await renderPage();
      expect(await screen.findByRole('alert')).toHaveTextContent('Falla de prueba');
      expect(TestBed.inject(NotificationService).items()).toEqual([]);
    });

    it('solo el administrador ve la columna y el filtro de sucursal; este lo aplica el servidor', async () => {
      useSession('ADMIN');
      stub();
      const asked: (string | null)[] = [];
      server.use(http.get(URL_S, ({ request }) => (asked.push(new URL(request.url).searchParams.get('branchId')), HttpResponse.json(SALES))));
      await renderPage();
      await screen.findByText('#4');
      expect(screen.getByRole('columnheader', { name: /Sucursal/ })).toBeInTheDocument();
      await chooseOption('Sucursal', 'Sucursal Norte');
      await vi.waitFor(() => expect(asked).toEqual([null, '20']));
    });

    it('un gerente no ve la sucursal ni su filtro', async () => {
      useSession('MANAGER', 10);
      stub();
      await renderPage();
      await screen.findByText('#4');
      expect(screen.queryByRole('columnheader', { name: /Sucursal/ })).not.toBeInTheDocument();
      expect(screen.queryByRole('combobox', { name: 'Sucursal' })).not.toBeInTheDocument();
    });
  });

  describe('detalle', () => {
    it('muestra los productos con cantidad, precio y subtotal, y el total', async () => {
      useSession('MANAGER', 10);
      stub();
      await renderPage();
      const dialog = await openDetail(1);
      expect(within(dialog).getByText('Completada')).toBeInTheDocument();
      expect(within(dialog).getByRole('row', { name: /Tornillo/ })).toHaveTextContent('Tornillo2$ 500');
      expect(dialog).toHaveTextContent('Ana Pérez');
      expect(dialog).toHaveTextContent('$ 1.000');
    });

    it('subtotal, descuento y total van en la tabla, en la misma columna que el subtotal de cada producto', async () => {
      useSession('MANAGER', 10);
      stub([sale(5, 'COMPLETED', { totalDiscount: 100, globalDiscountPercentage: 10, totalFinal: 4900, subtotal: 5000 })]);
      await renderPage();
      const dialog = await openDetail(5);
      const table = within(dialog).getByRole('table', { name: 'Productos de la venta' });
      const column = (row: HTMLElement) => within(row).getAllByRole('cell').at(-1) as HTMLElement;
      // La última celda de cada fila (producto, subtotal, descuento y total) es la misma columna.
      const rows = within(table).getAllByRole('row').slice(1);
      expect(rows).toHaveLength(4);
      expect(rows.map((r) => within(r).getAllByRole('cell').length)).toEqual([4, 1, 1, 1]);
      expect(column(rows[1])).toHaveTextContent('$ 5.000');
      expect(column(rows[2])).toHaveTextContent('− $ 100');
      expect(column(rows[3])).toHaveTextContent('$ 4.900');
      for (const cell of rows.map(column)) expect(cell).toHaveClass('text-right');
    });

    it('imprime la factura de una venta completada, pero no la de una anulada', async () => {
      useSession('MANAGER', 10);
      stub();
      printed.length = 0;
      await renderPage();
      const dialog = await openDetail(1);
      await userEvent.click(within(dialog).getByRole('button', { name: 'Imprimir factura' }));
      expect(printed).toHaveLength(1);
      expect(printed[0]).toContain('FACTURA DE VENTA N° 000001');
      expect(printed[0]).toContain('Tornillo');
      await userEvent.click(within(dialog).getAllByRole('button', { name: 'Cerrar' }).at(-1) as HTMLElement);
      await vi.waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
      const canceled = await openDetail(2);
      expect(within(canceled).queryByRole('button', { name: 'Imprimir factura' })).not.toBeInTheDocument();
    });

    it('una venta anulada muestra el motivo y no ofrece anular otra vez', async () => {
      useSession('MANAGER', 10);
      stub();
      await renderPage();
      const dialog = await openDetail(2);
      expect(dialog).toHaveTextContent('Error de digitación');
      expect(within(dialog).queryByRole('button', { name: 'Anular venta' })).not.toBeInTheDocument();
    });

    it('con descuento muestra cuánto se descontó', async () => {
      useSession('MANAGER', 10);
      stub([sale(5, 'COMPLETED', { totalDiscount: 100, globalDiscountPercentage: 10, totalFinal: 4900, subtotal: 5000 })]);
      await renderPage();
      const dialog = await openDetail(5);
      expect(dialog).toHaveTextContent('10 % general');
      expect(dialog).toHaveTextContent('− $ 100');
    });
  });

  describe('anular', () => {
    it('el gerente anula una venta completada con un motivo, avisa y recarga', async () => {
      useSession('MANAGER', 10);
      let lists = 0;
      let hit: { id: string; reason: string | null } | null = null;
      stub();
      server.use(
        http.get(URL_S, () => (lists++, HttpResponse.json(SALES))),
        http.delete(`${URL_S}/:id`, ({ params, request }) => ((hit = { id: String(params['id']), reason: new URL(request.url).searchParams.get('reason') }), new HttpResponse(null, { status: 204 }))),
      );
      await renderPage();
      const dialog = await openDetail(1);
      await userEvent.click(within(dialog).getByRole('button', { name: 'Anular venta' }));
      await userEvent.click(within(dialog).getByRole('button', { name: 'Anular venta' })); // enviar vacío
      expect(await within(dialog).findByText('Cuéntanos el motivo.')).toBeInTheDocument();
      await userEvent.type(within(dialog).getByLabelText('Motivo de la anulación'), ' Cliente se arrepintió ');
      await userEvent.click(within(dialog).getByRole('button', { name: 'Anular venta' }));
      await vi.waitFor(() => expect(hit).toEqual({ id: '1', reason: 'Cliente se arrepintió' }));
      await vi.waitFor(() => expect(lists).toBe(2));
      expect(TestBed.inject(NotificationService).items()[0]).toMatchObject({ kind: 'success', message: 'Venta #1 anulada: el stock volvió a la sucursal.' });
    });

    it.each(['SELLER', 'OPERADOR_INVENTARIO'])('%s no puede anular', async (rol) => {
      useSession(rol, 10);
      stub();
      await renderPage();
      const dialog = await openDetail(1);
      expect(within(dialog).queryByRole('button', { name: 'Anular venta' })).not.toBeInTheDocument();
    });

    it('si el servidor rechaza la anulación, el error queda en el diálogo (abierto)', async () => {
      useSession('MANAGER', 10);
      stub();
      server.use(http.delete(`${URL_S}/:id`, () => HttpResponse.json(apiErrorBody(409, 'INVALID_STATE', 'La venta ya tiene una devolución.'), { status: 409 })));
      await renderPage();
      const dialog = await openDetail(1);
      await userEvent.click(within(dialog).getByRole('button', { name: 'Anular venta' }));
      await userEvent.type(within(dialog).getByLabelText('Motivo de la anulación'), 'Error');
      await userEvent.click(within(dialog).getByRole('button', { name: 'Anular venta' }));
      expect(await within(dialog).findByRole('alert')).toHaveTextContent('La venta ya tiene una devolución.');
      expect(screen.getByRole('dialog', { name: 'Venta #1' })).toBeInTheDocument();
      expect(TestBed.inject(NotificationService).items()).toEqual([]);
    });
  });
});
