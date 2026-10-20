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
import { expectAccessible } from '@testing/a11y';
import { CompanyInfo, DEFAULT_COMPANY } from '@core/company/company-info';
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
  paymentMethod: 'EFECTIVO' as string | null,
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

const URL_SEARCH = `${URL_S}/search`;
type RawSale = ReturnType<typeof sale>;
const plain = (text: string) => text.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();

/** Lo que hace el servidor: filtra, ordena, pagina y resume sobre `sales`; `asked` guarda cada petición. */
function searchResponse(sales: RawSale[], params: URLSearchParams) {
  const num = (name: string) => (params.get(name) === null ? null : Number(params.get(name)));
  const day = (iso: string) => iso.slice(0, 10);
  const q = plain(params.get('q') ?? '');
  const filtered = sales
    .filter((s) => num('branchId') === null || s.branchId === num('branchId'))
    .filter((s) => !params.get('status') || s.status === params.get('status'))
    .filter((s) => !params.get('from') || day(s.date) >= params.get('from')!)
    .filter((s) => !params.get('to') || day(s.date) <= params.get('to')!)
    .filter((s) => !params.get('seller') || s.userName === params.get('seller'))
    .filter((s) => !params.get('product') || s.details.some((d) => d.productName === params.get('product')))
    .filter((s) => num('supplierId') === null || s.details.some((d) => SUPPLIED_BY[d.productId]?.includes(num('supplierId')!)))
    .filter((s) => params.get('withDiscount') === null || (s.totalDiscount > 0) === (params.get('withDiscount') === 'true'))
    .filter((s) => params.get('registeredCustomer') === null || !!s.customerName.trim() === (params.get('registeredCustomer') === 'true'))
    .filter((s) => params.get('paymentMethod') === null || s.paymentMethod === params.get('paymentMethod'))
    .filter((s) => num('minTotal') === null || s.totalFinal >= num('minTotal')!)
    .filter((s) => num('maxTotal') === null || s.totalFinal <= num('maxTotal')!)
    .filter((s) => !q || plain(`${s.id} ${s.customerName} ${s.customerDocument} ${s.userName}`).includes(q));
  const keys: Record<string, (s: RawSale) => string | number> = {
    id: (s) => s.id, date: (s) => s.date, customer: (s) => s.customerName, seller: (s) => s.userName,
    branchName: (s) => s.branchName, total: (s) => s.totalFinal, status: (s) => s.status,
  };
  const key = keys[params.get('sortBy') ?? 'id'] ?? keys['id']!;
  const sign = params.get('direction') === 'asc' ? 1 : -1;
  const sorted = [...filtered].sort((a, b) => (key(a) < key(b) ? -sign : key(a) > key(b) ? sign : b.id - a.id));
  const page = Number(params.get('page') ?? 0);
  const size = Number(params.get('size') ?? 10);
  const completed = filtered.filter((s) => s.status === 'COMPLETED');
  return {
    content: sorted.slice(page * size, page * size + size),
    totalElements: filtered.length,
    page,
    size,
    totalPages: Math.ceil(filtered.length / size),
    completedCount: completed.length,
    completedTotal: completed.reduce((sum, s) => sum + s.totalFinal, 0),
  };
}

const SUPPLIERS = [
  { id: 5, nombre: 'Ferretería Sur', tiempoEntregaDias: 3 },
  { id: 6, nombre: 'Tornillos SA', tiempoEntregaDias: 2 },
];
/** Qué proveedores surten cada producto (por id de producto). */
const SUPPLIED_BY: Record<number, number[]> = { 1: [6], 2: [5] };

const asked: URLSearchParams[] = [];

function stub(sales: RawSale[] = SALES) {
  asked.length = 0;
  server.use(
    http.get(URL_SEARCH, ({ request }) => {
      const params = new URL(request.url).searchParams;
      asked.push(params);
      return HttpResponse.json(searchResponse(sales, params));
    }),
    http.get(`${URL_S}/filter-options`, () =>
      HttpResponse.json({ sellers: [...new Set(sales.map((s) => s.userName))], products: [...new Set(sales.flatMap((s) => s.details.map((d) => d.productName)))] }),
    ),
    http.get(`${TEST_API}/api/branches`, () => HttpResponse.json(BRANCHES)),
    http.get(`${TEST_API}/api/catalog/suppliers`, () => HttpResponse.json(SUPPLIERS)),
  );
}

const printed: string[] = [];
const renderPage = () =>
  render(SalesHistoryPage, {
    providers: [
      provideHttpClient(withInterceptors([errorInterceptor])),
      { provide: API_BASE_URL, useValue: TEST_API },
      { provide: PrintService, useValue: { print: (html: string) => printed.push(html) } },
      { provide: CompanyInfo, useValue: { load: async () => DEFAULT_COMPANY } },
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
    it('no tiene problemas de accesibilidad detectables', async () => {
      useSession('MANAGER', 10);
      stub();
      await renderPage();
      await vi.waitFor(() => expect(screen.getAllByRole('row').length).toBeGreaterThan(1));
      await expectAccessible();
    });

    it('muestra las ventas, la más reciente primero, con cliente, estado en texto y total', async () => {
      useSession('MANAGER', 10);
      stub();
      await renderPage();
      expect(await screen.findByText('#4')).toBeInTheDocument();
      expect(screen.getByRole('heading', { level: 1, name: 'Historial de ventas' })).toBeInTheDocument();
      await vi.waitFor(() => expect(ids()).toEqual(['#4', '#3', '#2', '#1']));
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
      await vi.waitFor(() => expect(ids()).toEqual(['#2']));
    });

    it('busca por número, cliente, documento o vendedor sin distinguir acentos', async () => {
      useSession('MANAGER', 10);
      stub();
      await renderPage();
      await screen.findByText('#4');
      const search = screen.getByRole('searchbox', { name: 'Buscar venta' });
      await userEvent.type(search, 'rios');
      await vi.waitFor(() => expect(ids()).toEqual(['#3']));
      await userEvent.clear(search);
      await userEvent.type(search, 'sofia');
      await vi.waitFor(() => expect(ids()).toEqual(['#3']));
      await userEvent.clear(search);
      await userEvent.type(search, '123');
      await vi.waitFor(() => expect(ids()).toEqual(['#1']));
    });

    it('una búsqueda sin resultados lo dice', async () => {
      useSession('MANAGER', 10);
      stub();
      await renderPage();
      await screen.findByText('#4');
      await userEvent.type(screen.getByRole('searchbox', { name: 'Buscar venta' }), 'zzz');
      expect(await screen.findByText('Ninguna venta coincide')).toBeInTheDocument();
    });

    describe('paginación en el servidor', () => {
      // 25 ventas: 12 completadas de monto creciente y 13 anuladas; la página 1 trae las 10 más recientes.
      const MANY = Array.from({ length: 25 }, (_, i) => sale(i + 1, i % 2 === 0 ? 'COMPLETED' : 'CANCELED', { date: `2026-09-${String(i + 1).padStart(2, '0')}T10:00:00` }));

      it('pide solo una página al servidor y cambia de página pidiendo la siguiente', async () => {
        useSession('MANAGER', 10);
        stub(MANY);
        await renderPage();
        await vi.waitFor(() => expect(ids()).toEqual(['#25', '#24', '#23', '#22', '#21', '#20', '#19', '#18', '#17', '#16']));
        expect(asked.at(-1)?.get('page')).toBe('0');
        expect(asked.at(-1)?.get('size')).toBe('10');
        expect(screen.getByText('1–10 de 25')).toBeInTheDocument();

        await userEvent.click(screen.getByRole('button', { name: 'Página siguiente' }));
        await vi.waitFor(() => expect(ids()).toEqual(['#15', '#14', '#13', '#12', '#11', '#10', '#9', '#8', '#7', '#6']));
        expect(asked.at(-1)?.get('page')).toBe('1');
        expect(screen.getByText('11–20 de 25')).toBeInTheDocument();
      });

      it('el resumen abarca todas las ventas que cumplen los filtros, no solo la página', async () => {
        useSession('MANAGER', 10);
        stub(MANY);
        await renderPage();
        // 13 completadas (ids impares 1, 3, …, 25) de 1.000 × id cada una: 169.000
        expect(await screen.findByText('13 ventas completadas, $ 169.000')).toBeInTheDocument();
      });

      it('ordenar una columna lo pide al servidor y vuelve a la primera página', async () => {
        useSession('MANAGER', 10);
        stub(MANY);
        await renderPage();
        await screen.findByText('#25');
        await userEvent.click(screen.getByRole('button', { name: 'Página siguiente' }));
        await screen.findByText('#15');

        await userEvent.click(screen.getByRole('button', { name: /Total/ }));
        await vi.waitFor(() => expect(asked.at(-1)?.get('sortBy')).toBe('total'));
        expect(asked.at(-1)?.get('direction')).toBe('asc');
        expect(asked.at(-1)?.get('page')).toBe('0');
        await vi.waitFor(() => expect(ids()[0]).toBe('#1'));
      });

      it('cambiar un filtro vuelve a la primera página', async () => {
        useSession('MANAGER', 10);
        stub(MANY);
        await renderPage();
        await screen.findByText('#25');
        await userEvent.click(screen.getByRole('button', { name: 'Página siguiente' }));
        await screen.findByText('#15');
        await chooseOption('Estado de la venta', 'Anulada');
        await vi.waitFor(() => expect(asked.at(-1)?.get('status')).toBe('CANCELED'));
        expect(asked.at(-1)?.get('page')).toBe('0');
        expect(await screen.findByText('1–10 de 12')).toBeInTheDocument();
      });

      it('la búsqueda espera a que se deje de escribir antes de pedir al servidor', async () => {
        useSession('MANAGER', 10);
        stub(MANY);
        await renderPage();
        await screen.findByText('#25');
        const before = asked.length;
        await userEvent.type(screen.getByRole('searchbox', { name: 'Buscar venta' }), 'Pérez');
        await vi.waitFor(() => expect(asked.at(-1)?.get('q')).toBe('Pérez'));
        expect(asked.length).toBe(before + 1); // una sola petición, no una por letra
      });
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
      server.use(http.get(URL_SEARCH, () => HttpResponse.json(apiErrorBody(500, 'INTERNAL_ERROR', 'Falla de prueba'), { status: 500 })));
      await renderPage();
      expect(await screen.findByRole('alert')).toHaveTextContent('Falla de prueba');
      expect(TestBed.inject(NotificationService).items()).toEqual([]);
    });

    it('solo el administrador ve la columna y el filtro de sucursal; este lo aplica el servidor', async () => {
      useSession('ADMIN');
      stub();
      await renderPage();
      await screen.findByText('#4');
      expect(screen.getByRole('columnheader', { name: /Sucursal/ })).toBeInTheDocument();
      await chooseOption('Sucursal', 'Sucursal Norte');
      await vi.waitFor(() => expect(asked.map((p) => p.get('branchId'))).toEqual([null, '20']));
    });

    describe('filtros avanzados', () => {
      const STORE = 'zen:filters:1:sales-history';
      const ids = () => screen.queryAllByRole('row').slice(1).map((r) => /#(\d+)/.exec(r.textContent ?? '')?.[1]);
      const openAdvanced = async () => userEvent.click(await screen.findByRole('button', { name: /Más filtros/ }));

      it('filtra por vendedor y por rango de total desde «Más filtros», y el botón cuenta los activos', async () => {
        useSession('MANAGER', 10);
        stub();
        await renderPage();
        await screen.findByText('#4');
        expect(screen.queryByLabelText('Total desde')).not.toBeInTheDocument(); // el panel empieza cerrado
        await openAdvanced();
        await chooseOption('Vendedor', 'Sofía');
        await vi.waitFor(() => expect(ids()).toEqual(['3']));
        expect(screen.getByLabelText('1 filtro activo')).toBeInTheDocument();
        await chooseOption('Vendedor', 'Todos los vendedores');
        await userEvent.type(screen.getByLabelText('Total desde'), '2000');
        await userEvent.type(screen.getByLabelText('Total hasta'), '3000');
        await vi.waitFor(() => expect(ids().sort()).toEqual(['2', '3']));
        expect(screen.getByLabelText('2 filtros activos')).toBeInTheDocument();
      });

      it('filtra por proveedor: las ventas con algún producto que ese proveedor surte', async () => {
        useSession('MANAGER', 10);
        stub([
          sale(1, 'COMPLETED'),
          sale(2, 'COMPLETED', { details: [{ id: 21, productId: 2, productName: 'Tuerca', quantity: 1, unitPriceApplied: 2000, discountPercentage: 0, subtotalLine: 2000 }] }),
        ]);
        await renderPage();
        await screen.findByText('#2');
        await openAdvanced();
        await chooseOption('Proveedor', 'Ferretería Sur');
        await vi.waitFor(() => expect(ids()).toEqual(['2']));
        expect(asked.at(-1)?.get('supplierId')).toBe('5');
        expect(screen.getByRole('group', { name: 'Filtros aplicados' })).toHaveTextContent('Proveedor:Ferretería Sur');
      });

      it('filtra por descuento y por cliente registrado', async () => {
        useSession('MANAGER', 10);
        stub([
          sale(1, 'COMPLETED', { totalDiscount: 100 }),
          sale(2, 'COMPLETED', { customerName: '', customerDocument: '' }),
          sale(3, 'COMPLETED'),
        ]);
        await renderPage();
        await screen.findByText('#3');
        await openAdvanced();
        await chooseOption('Descuento', 'Con descuento');
        await vi.waitFor(() => expect(ids()).toEqual(['1']));
        expect(asked.at(-1)?.get('withDiscount')).toBe('true');
        await chooseOption('Descuento', 'Con o sin descuento');
        await chooseOption('Cliente', 'Cliente sin registrar');
        await vi.waitFor(() => expect(ids()).toEqual(['2']));
        expect(asked.at(-1)?.get('registeredCustomer')).toBe('false');
        await chooseOption('Cliente', 'Cliente registrado');
        await vi.waitFor(() => expect(ids().sort()).toEqual(['1', '3']));
        expect(screen.getByLabelText('1 filtro activo')).toBeInTheDocument();
      });

      it('filtra por forma de pago, la muestra en la tabla y las ventas anteriores dicen «Sin registrar»', async () => {
        useSession('MANAGER', 10);
        stub([
          sale(1, 'COMPLETED', { paymentMethod: 'TARJETA' }),
          sale(2, 'COMPLETED', { paymentMethod: null }),
          sale(3, 'COMPLETED'),
        ]);
        await renderPage();
        await screen.findByText('#3');
        expect(screen.getByText('Tarjeta')).toBeInTheDocument();
        expect(screen.getByText('Sin registrar')).toBeInTheDocument();
        await openAdvanced();
        await chooseOption('Forma de pago', 'Tarjeta');
        await vi.waitFor(() => expect(ids()).toEqual(['1']));
        expect(asked.at(-1)?.get('paymentMethod')).toBe('TARJETA');
        expect(screen.getByLabelText('1 filtro activo')).toBeInTheDocument();
      });

      it('filtra por producto', async () => {
        useSession('MANAGER', 10);
        stub([
          sale(1, 'COMPLETED'),
          sale(2, 'COMPLETED', { details: [{ id: 21, productId: 2, productName: 'Tuerca', quantity: 1, unitPriceApplied: 2000, discountPercentage: 0, subtotalLine: 2000 }] }),
        ]);
        await renderPage();
        await screen.findByText('#2');
        await openAdvanced();
        await chooseOption('Producto', 'Tuerca');
        await vi.waitFor(() => expect(ids()).toEqual(['2']));
      });

      it('las etiquetas de filtros aplicados se quitan una a una y todas juntas', async () => {
        useSession('MANAGER', 10);
        stub();
        await renderPage();
        await screen.findByText('#4');
        await chooseOption('Estado de la venta', 'Anulada');
        await userEvent.type(screen.getByLabelText('Buscar venta'), 'Luis');
        const chips = screen.getByRole('group', { name: 'Filtros aplicados' });
        expect(chips).toHaveTextContent('Estado:');
        expect(chips).toHaveTextContent('Búsqueda:');
        await userEvent.click(within(chips).getByRole('button', { name: 'Quitar filtro Estado: Anulada' }));
        expect(screen.queryByRole('button', { name: /Quitar filtro Estado/ })).not.toBeInTheDocument();
        await userEvent.click(screen.getByRole('button', { name: 'Quitar filtros' }));
        expect(screen.queryByRole('group', { name: 'Filtros aplicados' })).not.toBeInTheDocument();
        expect(screen.getByLabelText('Buscar venta')).toHaveValue('');
        await vi.waitFor(() => expect(ids().length).toBe(4));
      });

      it('recuerda los filtros la próxima vez que se entra, pero no el texto de la búsqueda', async () => {
        useSession('MANAGER', 10);
        stub();
        const first = await renderPage();
        await screen.findByText('#4');
        await chooseOption('Estado de la venta', 'Anulada');
        await userEvent.type(screen.getByLabelText('Buscar venta'), 'Luis');
        await openAdvanced();
        await userEvent.type(screen.getByLabelText('Total desde'), '1500');
        await vi.waitFor(() => expect(JSON.parse(localStorage.getItem(STORE) ?? '{}')).toMatchObject({ status: 'CANCELED', minTotal: 1500, advancedOpen: true }));
        first.fixture.destroy();
        TestBed.resetTestingModule(); // otra visita: se vuelve a construir todo desde cero

        await renderPage();
        expect(await screen.findByRole('combobox', { name: 'Estado de la venta' })).toHaveTextContent('Anulada');
        expect(screen.getByLabelText('Total desde')).toHaveValue(1500); // el panel queda abierto como se dejó
        expect(screen.getByLabelText('Buscar venta')).toHaveValue('');
        await screen.findByText('#2');
        await vi.waitFor(() => expect(ids()).toEqual(['2']));
      });

      it('un rango de fechas recordado se aplica y se ve como etiqueta', async () => {
        useSession('MANAGER', 10);
        localStorage.setItem(STORE, JSON.stringify({ from: new Date(2026, 9, 12).toISOString(), to: new Date(2026, 9, 13).toISOString() }));
        stub();
        await renderPage();
        await screen.findByText('#2');
        await vi.waitFor(() => expect(ids().sort()).toEqual(['2', '3'])); // 12 y 13 de octubre, completos
        const chips = screen.getByRole('group', { name: 'Filtros aplicados' });
        expect(chips).toHaveTextContent('Desde:');
        expect(chips).toHaveTextContent('Hasta:');
      });

      it('un filtro recordado que ya no coincide con nada sigue a la vista y se puede quitar', async () => {
        useSession('MANAGER', 10);
        localStorage.setItem(STORE, JSON.stringify({ seller: 'Ana la que ya no trabaja' }));
        stub();
        await renderPage();
        expect(await screen.findByText('Ninguna venta coincide')).toBeInTheDocument();
        await userEvent.click(screen.getByRole('button', { name: /Quitar filtro Vendedor/ }));
        expect(await screen.findByText('#4')).toBeInTheDocument();
        expect(localStorage.getItem(STORE)).toBeNull(); // volver al valor inicial borra lo guardado
      });

      it('un valor guardado dañado se ignora (no rompe la pantalla)', async () => {
        useSession('MANAGER', 10);
        localStorage.setItem(STORE, JSON.stringify({ status: 'INVENTADO', minTotal: 'abc', from: 'no es fecha' }));
        stub();
        await renderPage();
        expect(await screen.findByText('#4')).toBeInTheDocument();
        expect(screen.queryByRole('group', { name: 'Filtros aplicados' })).not.toBeInTheDocument();
      });

      it('el panel abierto no tiene problemas de accesibilidad detectables', async () => {
        useSession('MANAGER', 10);
        stub();
        await renderPage();
        await screen.findByText('#4');
        await openAdvanced();
        await expectAccessible();
      });
    });

    it('si la respuesta de una sucursal anterior llega tarde, no pisa la de la elegida', async () => {
      useSession('ADMIN');
      stub();
      let release: () => void = () => undefined;
      const gate = new Promise<void>((resolve) => (release = resolve));
      server.use(
        http.get(URL_SEARCH, async ({ request }) => {
          const params = new URL(request.url).searchParams;
          if (params.get('branchId') === '20') {
            await gate; // la respuesta de «Sucursal Norte» tarda
            return HttpResponse.json(searchResponse([sale(9, 'COMPLETED')], params));
          }
          return HttpResponse.json(searchResponse(SALES, params));
        }),
      );
      await renderPage();
      await screen.findByText('#4');
      await chooseOption('Sucursal', 'Sucursal Norte');
      await chooseOption('Sucursal', 'Todas las sucursales');
      await screen.findByText('#4');
      release();
      await new Promise((resolve) => setTimeout(resolve, 50));
      expect(screen.getByText('#4')).toBeInTheDocument();
      expect(screen.queryByText('#9')).not.toBeInTheDocument();
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
      expect(printed[0]).toContain('FACTURA DE VENTA N° FV-000001');
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
        http.get(URL_SEARCH, ({ request }) => (lists++, HttpResponse.json(searchResponse(SALES, new URL(request.url).searchParams)))),
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
