import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { render, screen, within } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { API_BASE_URL } from '@core/api/api-base-url';
import { errorInterceptor } from '@core/api/error.interceptor';
import { SESSION_STORAGE_KEY } from '@core/auth/session/auth-store';
import { chooseOption } from '@testing/select-helpers';
import { apiErrorBody, server, TEST_API } from '@testing/msw-server';
import { PosPage } from './pos-page';

const PRODUCTS = [
  { id: 1, sku: 'TOR-1', nombre: 'Tornillo', unitAbbreviation: 'UND', precioVenta: 1000, activo: true },
  { id: 2, sku: 'TUE-2', nombre: 'Tuérca', unitAbbreviation: 'UND', precioVenta: 500, activo: true },
  { id: 3, sku: 'ARA-3', nombre: 'Arandela', unitAbbreviation: 'UND', precioVenta: 200, activo: true },
  { id: 4, sku: 'OLD-4', nombre: 'Descontinuado', unitAbbreviation: 'UND', precioVenta: 1, activo: false },
];
const STOCK = [
  { productId: 1, stockActual: 10 },
  { productId: 2, stockActual: 3 },
  // Arandela sin registro de inventario: sin stock.
];
const BRANCHES = [
  { id: 10, nombre: 'Sede Central', activa: true },
  { id: 20, nombre: 'Sucursal Norte', activa: true },
];
const LISTS = [{ id: 7, nombre: 'Mayoristas', descripcion: 'Clientes por volumen' }];
const SALE = {
  id: 55,
  date: '2026-10-15T10:00:00',
  status: 'COMPLETED',
  branchId: 10,
  branchName: 'Sede Central',
  userName: 'Yo',
  subtotal: 2500,
  totalDiscount: 250,
  totalFinal: 2250,
  globalDiscountPercentage: 10,
  details: [{ id: 1, productId: 1, productName: 'Tornillo', quantity: 2, unitPriceApplied: 1000, discountPercentage: 0, subtotalLine: 2000 }],
};

function useSession(rol: string, sucursalId?: number) {
  localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify({ token: 't', email: 'e@z.co', nombre: 'Yo', rol, id: 9, sucursalId }));
}

function stub(options: { lists?: unknown[] | 403; stock?: unknown[] } = {}) {
  server.use(
    http.get(`${TEST_API}/api/catalog/products`, () => HttpResponse.json(PRODUCTS)),
    http.get(`${TEST_API}/api/v1/inventory/branches/:id`, () => HttpResponse.json(options.stock ?? STOCK)),
    http.get(`${TEST_API}/api/branches`, () => HttpResponse.json(BRANCHES)),
    http.get(`${TEST_API}/api/v1/price-lists`, () =>
      options.lists === 403 ? HttpResponse.json(apiErrorBody(403, 'ACCESS_DENIED', 'Sin acceso'), { status: 403 }) : HttpResponse.json(options.lists ?? LISTS),
    ),
    http.get(`${TEST_API}/api/v1/price-lists/7/prices`, () => HttpResponse.json([{ id: 1, listaId: 7, productoId: 1, precio: 800 }])),
  );
}

const renderPage = () =>
  render(PosPage, { providers: [provideHttpClient(withInterceptors([errorInterceptor])), { provide: API_BASE_URL, useValue: TEST_API }] });

const add = async (name: string) => userEvent.click(await screen.findByRole('button', { name: `Agregar ${name}` }));
const cart = () => screen.getByRole('region', { name: 'Venta actual' });

describe('PosPage', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => localStorage.clear());

  describe('productos', () => {
    it('lista los productos activos con su precio y existencias en la sucursal', async () => {
      useSession('SELLER', 10);
      stub();
      await renderPage();
      expect(await screen.findByRole('button', { name: 'Agregar Tornillo' })).toHaveTextContent('10 disp.');
      expect(screen.getByRole('button', { name: 'Agregar Tornillo' })).toHaveTextContent('$ 1.000');
      expect(screen.getByRole('button', { name: 'Agregar Tuérca' })).toHaveTextContent('3 disp.');
      expect(screen.queryByRole('button', { name: /Descontinuado/ })).not.toBeInTheDocument();
    });

    it('un producto sin existencias no se puede agregar y lo dice con texto', async () => {
      useSession('SELLER', 10);
      stub();
      await renderPage();
      const button = await screen.findByRole('button', { name: 'Agregar Arandela' });
      expect(button).toBeDisabled();
      expect(button).toHaveTextContent('Sin stock');
    });

    it('busca por nombre o SKU sin distinguir mayúsculas ni acentos', async () => {
      useSession('SELLER', 10);
      stub();
      await renderPage();
      await screen.findByRole('button', { name: 'Agregar Tornillo' });
      await userEvent.type(screen.getByRole('searchbox', { name: 'Buscar producto' }), 'tuerca');
      expect(screen.getAllByRole('button', { name: /^Agregar / }).map((b) => b.getAttribute('aria-label'))).toEqual(['Agregar Tuérca']);
    });

    it('Enter agrega el producto cuando la búsqueda lo identifica (un solo resultado o un SKU exacto)', async () => {
      useSession('SELLER', 10);
      stub();
      await renderPage();
      await screen.findByRole('button', { name: 'Agregar Tornillo' });
      const search = screen.getByRole('searchbox', { name: 'Buscar producto' });
      await userEvent.type(search, 'tor-1{Enter}');
      expect(within(cart()).getByText('Tornillo')).toBeInTheDocument();
      expect(search).toHaveValue(''); // listo para el siguiente
    });

    it('Enter no agrega nada si la búsqueda es ambigua', async () => {
      useSession('SELLER', 10);
      stub();
      await renderPage();
      await screen.findByRole('button', { name: 'Agregar Tornillo' });
      await userEvent.type(screen.getByRole('searchbox', { name: 'Buscar producto' }), '-{Enter}'); // coincide con varios SKU
      expect(screen.getByText('Aún no hay productos.')).toBeInTheDocument();
    });

    it('si falla la carga muestra el error', async () => {
      useSession('SELLER', 10);
      stub();
      server.use(http.get(`${TEST_API}/api/catalog/products`, () => HttpResponse.json(apiErrorBody(500, 'INTERNAL_ERROR', 'Falla de prueba'), { status: 500 })));
      await renderPage();
      expect(await screen.findByRole('alert')).toHaveTextContent('Falla de prueba');
    });

    it('un usuario sin sucursal lo ve explicado', async () => {
      useSession('SELLER');
      stub();
      await renderPage();
      expect(await screen.findByText('Tu usuario no tiene una sucursal asignada.')).toBeInTheDocument();
    });
  });

  describe('venta actual', () => {
    it('agregar el mismo producto suma una unidad, sin pasar de las existencias', async () => {
      useSession('SELLER', 10);
      stub();
      await renderPage();
      for (let i = 0; i < 5; i++) await add('Tuérca');
      expect(within(cart()).getByLabelText('Cantidad de Tuérca')).toHaveValue(3);
    });

    it('cada línea rotula sus campos: "Cantidad" y "Descuento %" visibles (no solo un placeholder)', async () => {
      useSession('SELLER', 10);
      stub();
      await renderPage();
      await add('Tornillo');
      await add('Tuérca');
      const line = within(cart()).getAllByRole('listitem')[0];
      expect(within(line).getByText('Cantidad', { selector: 'label' })).toBeInTheDocument();
      expect(within(line).getByText('Descuento %', { selector: 'label' })).toBeInTheDocument();
      expect(within(line).getByLabelText('Cantidad de Tornillo')).toBeInTheDocument(); // el nombre accesible sigue diciendo de qué producto es
    });

    it('calcula subtotal por línea, descuento general y total', async () => {
      useSession('SELLER', 10);
      stub();
      await renderPage();
      await add('Tornillo');
      await add('Tuérca');
      const qty = within(cart()).getByLabelText('Cantidad de Tornillo');
      await userEvent.clear(qty);
      await userEvent.type(qty, '2');
      await userEvent.type(within(cart()).getByLabelText('Descuento % de Tuérca'), '20'); // 500 − 20 % = 400
      // Subtotal 2.000 + 400 y, sin descuento general, el total es el mismo.
      expect(within(cart()).getAllByText('$ 2.400', { selector: 'dd' })).toHaveLength(2);
      const general = within(cart()).getByLabelText('Descuento general %');
      await userEvent.clear(general);
      await userEvent.type(general, '10');
      expect(within(cart()).getByText('− $ 240')).toBeInTheDocument();
      expect(within(cart()).getByText('$ 2.160', { selector: 'dd' })).toBeInTheDocument();
    });

    it('una cantidad mayor que las existencias se señala y bloquea el registro', async () => {
      useSession('SELLER', 10);
      stub();
      await renderPage();
      await add('Tuérca');
      const qty = within(cart()).getByLabelText('Cantidad de Tuérca');
      await userEvent.clear(qty);
      await userEvent.type(qty, '9');
      expect(within(cart()).getByText('Solo hay 3 en stock.')).toBeInTheDocument();
      expect(within(cart()).getByRole('button', { name: 'Registrar venta' })).toBeDisabled();
    });

    it('una cantidad vacía o decimal también bloquea el registro', async () => {
      useSession('SELLER', 10);
      stub();
      await renderPage();
      await add('Tornillo');
      const qty = within(cart()).getByLabelText('Cantidad de Tornillo');
      await userEvent.clear(qty);
      expect(within(cart()).getByText(/número entero/)).toBeInTheDocument();
      await userEvent.type(qty, '1.5');
      expect(within(cart()).getByRole('button', { name: 'Registrar venta' })).toBeDisabled();
    });

    it('quitar una línea y vaciar la venta', async () => {
      useSession('SELLER', 10);
      stub();
      await renderPage();
      await add('Tornillo');
      await add('Tuérca');
      await userEvent.click(within(cart()).getByRole('button', { name: 'Quitar Tornillo' }));
      expect(within(cart()).queryByText('Tornillo')).not.toBeInTheDocument();
      await userEvent.click(within(cart()).getByRole('button', { name: 'Vaciar' }));
      expect(screen.getByText('Aún no hay productos.')).toBeInTheDocument();
    });

    it('con una lista de precios usa el precio de la lista y, si el producto no está en ella, el normal', async () => {
      useSession('MANAGER', 10);
      stub();
      await renderPage();
      await add('Tornillo');
      await add('Tuérca');
      expect(within(cart()).getByText('$ 1.000 c/u')).toBeInTheDocument();
      await chooseOption('Lista de precios', 'Mayoristas');
      expect(await within(cart()).findByText('$ 800 c/u')).toBeInTheDocument();
      expect(within(cart()).getByText('$ 500 c/u')).toBeInTheDocument(); // Tuérca no está en la lista
    });

    it('el operador de inventario no tiene listas de precios (403): no se ofrece el selector y vende al precio normal', async () => {
      useSession('OPERADOR_INVENTARIO', 10);
      stub({ lists: 403 });
      await renderPage();
      await add('Tornillo');
      expect(within(cart()).queryByLabelText('Lista de precios')).not.toBeInTheDocument();
      expect(within(cart()).getByText('$ 1.000 c/u')).toBeInTheDocument();
    });
  });

  describe('registrar', () => {
    it('envía la venta con cliente, descuentos y lista, muestra el comprobante y deja la caja lista para otra', async () => {
      useSession('MANAGER', 10);
      stub();
      let body: Record<string, unknown> = {};
      let catalogCalls = 0;
      server.use(
        http.get(`${TEST_API}/api/v1/inventory/branches/:id`, () => (catalogCalls++, HttpResponse.json(STOCK))),
        http.post(`${TEST_API}/api/v1/sales`, async ({ request }) => ((body = (await request.json()) as Record<string, unknown>), HttpResponse.json(SALE, { status: 201 }))),
      );
      await renderPage();
      await add('Tornillo');
      const qty = within(cart()).getByLabelText('Cantidad de Tornillo');
      await userEvent.clear(qty);
      await userEvent.type(qty, '2');
      await userEvent.type(within(cart()).getByLabelText('Cliente (opcional)'), '  Ana Pérez ');
      await userEvent.type(within(cart()).getByLabelText('Documento (opcional)'), '123');
      const general = within(cart()).getByLabelText('Descuento general %');
      await userEvent.clear(general);
      await userEvent.type(general, '10');
      await chooseOption('Lista de precios', 'Mayoristas');
      await userEvent.click(within(cart()).getByRole('button', { name: 'Registrar venta' }));

      await vi.waitFor(() =>
        expect(body).toEqual({
          branchId: 10,
          userId: 9,
          customerName: 'Ana Pérez',
          customerDocument: '123',
          globalDiscountPercentage: 10,
          priceListId: 7,
          items: [{ productId: 1, quantity: 2, discountPercentage: 0 }],
        }),
      );
      const receipt = await screen.findByRole('dialog', { name: 'Venta #55 registrada' });
      expect(within(receipt).getByText('Tornillo')).toBeInTheDocument();
      expect(receipt).toHaveTextContent('$ 2.250');
      // La caja queda limpia y el stock se vuelve a pedir.
      expect(screen.getByText('Aún no hay productos.')).toBeInTheDocument();
      await vi.waitFor(() => expect(catalogCalls).toBe(2));
      await userEvent.click(within(receipt).getByRole('button', { name: 'Nueva venta' }));
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('sin cliente ni descuento envía solo lo necesario', async () => {
      useSession('SELLER', 10);
      stub({ lists: [] });
      let body: Record<string, unknown> = {};
      server.use(http.post(`${TEST_API}/api/v1/sales`, async ({ request }) => ((body = (await request.json()) as Record<string, unknown>), HttpResponse.json(SALE, { status: 201 }))));
      await renderPage();
      await add('Tornillo');
      await userEvent.click(within(cart()).getByRole('button', { name: 'Registrar venta' }));
      await vi.waitFor(() => expect(body['items']).toEqual([{ productId: 1, quantity: 1, discountPercentage: 0 }]));
      expect(body).not.toHaveProperty('customerName');
      expect(body).not.toHaveProperty('priceListId');
      expect(body['globalDiscountPercentage']).toBe(0);
    });

    it('si el servidor rechaza la venta (sin stock), lo explica en la venta y conserva los productos', async () => {
      useSession('SELLER', 10);
      stub();
      server.use(http.post(`${TEST_API}/api/v1/sales`, () => HttpResponse.json(apiErrorBody(422, 'INSUFFICIENT_STOCK', 'Stock insuficiente para Tornillo.'), { status: 422 })));
      await renderPage();
      await add('Tornillo');
      await userEvent.click(within(cart()).getByRole('button', { name: 'Registrar venta' }));
      expect(await within(cart()).findByRole('alert')).toHaveTextContent('Stock insuficiente para Tornillo.');
      expect(within(cart()).getByLabelText('Cantidad de Tornillo')).toBeInTheDocument();
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
  });

  describe('administrador', () => {
    it('elige la sucursal desde la que vende; al cambiarla pide su catálogo y vacía la venta', async () => {
      useSession('ADMIN');
      stub();
      const asked: string[] = [];
      server.use(http.get(`${TEST_API}/api/v1/inventory/branches/:id`, ({ params }) => (asked.push(String(params['id'])), HttpResponse.json(STOCK))));
      await renderPage();
      await add('Tornillo');
      expect(asked).toEqual(['10']);
      await chooseOption('Sucursal desde la que se vende', 'Sucursal Norte');
      await vi.waitFor(() => expect(asked).toEqual(['10', '20']));
      expect(await screen.findByText('Aún no hay productos.')).toBeInTheDocument();
    });

    it('vende con la sucursal elegida', async () => {
      useSession('ADMIN');
      stub();
      let body: Record<string, unknown> = {};
      server.use(http.post(`${TEST_API}/api/v1/sales`, async ({ request }) => ((body = (await request.json()) as Record<string, unknown>), HttpResponse.json(SALE, { status: 201 }))));
      await renderPage();
      await screen.findByRole('combobox', { name: 'Sucursal desde la que se vende' });
      await chooseOption('Sucursal desde la que se vende', 'Sucursal Norte');
      await add('Tornillo');
      await userEvent.click(within(cart()).getByRole('button', { name: 'Registrar venta' }));
      await vi.waitFor(() => expect(body['branchId']).toBe(20));
    });

    it('quien no es administrador no ve el selector de sucursal', async () => {
      useSession('SELLER', 10);
      stub();
      await renderPage();
      await screen.findByRole('button', { name: 'Agregar Tornillo' });
      expect(screen.queryByRole('combobox', { name: 'Sucursal desde la que se vende' })).not.toBeInTheDocument();
    });
  });
});
