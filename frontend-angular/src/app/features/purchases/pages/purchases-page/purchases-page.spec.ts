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
import { PurchasesPage } from './purchases-page';

const detail = (id: number, productId: number, quantity: number, unitPrice: number, discountPct = 0, receivedQuantity = 0) => ({
  id,
  productId,
  quantity,
  receivedQuantity,
  unitPrice,
  discountPct,
  subtotal: quantity * unitPrice * (1 - discountPct / 100),
});

const order = (id: number, receptionStatus: string, extra: object = {}) => ({
  id,
  receptionStatus,
  paymentStatus: 'POR_PAGAR',
  requestDate: `2026-10-${String(10 + id).padStart(2, '0')}T08:00:00`,
  supplierId: 100,
  branchId: 10,
  paymentDueDays: 30,
  total: 1000,
  details: [detail(id * 10, 1, 10, 100)],
  ...extra,
});

const ORDERS = [
  order(1, 'AWAITING_APPROVAL', { supplierId: 101 }),
  order(2, 'PENDING'),
  order(3, 'IN_TRANSIT'),
  order(4, 'RECEIVED_PARTIAL', { details: [detail(41, 1, 10, 100, 0, 6), detail(42, 2, 4, 50)], total: 1200 }),
  order(5, 'RECEIVED_TOTAL'),
  order(6, 'CANCELLED', { reasonResolution: 'Ya no se necesita' }),
];

const SUPPLIERS = [
  { id: 100, nombre: 'Ferretería Central', tiempoEntregaDias: 3 },
  { id: 101, nombre: 'Aceros del Sur', tiempoEntregaDias: 5 },
];
const PRODUCTS = [
  { id: 1, sku: 'TOR-1', nombre: 'Tornillo', precioVenta: 500, unitAbbreviation: 'UND', activo: true, proveedores: [{ id: 100, nombre: 'Ferretería Central', precioPactado: 80, tiempoEntregaDias: 3 }] },
  { id: 2, sku: 'TUE-2', nombre: 'Tuerca', precioVenta: 300, unitAbbreviation: 'UND', activo: true, proveedores: [] },
  { id: 3, sku: 'OLD-3', nombre: 'Descontinuado', precioVenta: 1, unitAbbreviation: 'UND', activo: false, proveedores: [] },
];
const BRANCHES = [
  { id: 10, nombre: 'Sede Central', activa: true },
  { id: 20, nombre: 'Sucursal Norte', activa: true },
];
const URL_P = `${TEST_API}/api/v1/purchases`;

function useSession(rol: string, sucursalId?: number) {
  localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify({ token: 't', email: 'e@z.co', nombre: 'Yo', rol, id: 1, sucursalId }));
}

function stub(orders: unknown[] = ORDERS) {
  server.use(
    http.get(URL_P, () => HttpResponse.json(orders)),
    http.get(`${TEST_API}/api/catalog/suppliers`, () => HttpResponse.json(SUPPLIERS)),
    http.get(`${TEST_API}/api/catalog/products`, () => HttpResponse.json(PRODUCTS)),
    http.get(`${TEST_API}/api/branches`, () => HttpResponse.json(BRANCHES)),
  );
}

const renderPage = () =>
  render(PurchasesPage, { providers: [provideHttpClient(withInterceptors([errorInterceptor])), { provide: API_BASE_URL, useValue: TEST_API }] });

const ids = () => screen.getAllByRole('row').slice(1).map((r) => within(r).getAllByRole('cell')[0]?.textContent?.trim());

async function openDetail(id: number) {
  await userEvent.click(await screen.findByRole('button', { name: `Ver orden ${id}` }));
  return screen.getByRole('dialog', { name: `Orden de compra #${id}` });
}

describe('PurchasesPage', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => localStorage.clear());

  describe('lista', () => {
    it('muestra por defecto las órdenes en curso, con proveedor por nombre, estado y total', async () => {
      useSession('MANAGER', 10);
      stub();
      await renderPage();
      expect(await screen.findByText('#1')).toBeInTheDocument();
      expect(screen.getByRole('heading', { level: 1, name: 'Compras' })).toBeInTheDocument();
      expect(ids()).toEqual(['#4', '#3', '#2', '#1']); // recibida total (#5) y cancelada (#6) quedan fuera; la más reciente primero
      const row = screen.getByRole('row', { name: /#2/ });
      expect(within(row).getByText('Ferretería Central')).toBeInTheDocument();
      expect(within(row).getByText('Aprobada')).toBeInTheDocument();
      expect(within(row).getByText('Por pagar')).toBeInTheDocument();
      expect(within(screen.getByRole('row', { name: /#1\b/ })).getByText('Aceros del Sur')).toBeInTheDocument();
      expect(screen.getByText(/4 órdenes en curso/)).toBeInTheDocument();
    });

    it('el filtro de estado permite ver todas o una en concreto', async () => {
      useSession('MANAGER', 10);
      stub();
      await renderPage();
      await screen.findByText('#1');
      await chooseOption('Estado de la orden', 'Todas');
      expect(ids()).toHaveLength(6);
      await chooseOption('Estado de la orden', 'Cancelada');
      expect(ids()).toEqual(['#6']);
    });

    it('solo el administrador ve la columna de sucursal', async () => {
      useSession('ADMIN');
      stub();
      await renderPage();
      await screen.findByText('#1');
      expect(screen.getByRole('columnheader', { name: /Sucursal/ })).toBeInTheDocument();
    });

    it('un gerente no ve la columna de sucursal', async () => {
      useSession('MANAGER', 10);
      stub();
      await renderPage();
      await screen.findByText('#1');
      expect(screen.queryByRole('columnheader', { name: /Sucursal/ })).not.toBeInTheDocument();
    });

    it('marca "Te toca" en lo que debe aprobar el gerente y en lo que el operador debe recibir', async () => {
      useSession('MANAGER', 10);
      stub();
      await renderPage();
      await screen.findByText('#1');
      // Gerente: aprobar la #1 y recibir la que viene en camino (#3).
      for (const id of [1, 3]) expect(within(screen.getByRole('row', { name: new RegExp(`#${id}\\b`) })).getByText('Te toca')).toBeInTheDocument();
      expect(within(screen.getByRole('row', { name: /#2\b/ })).queryByText('Te toca')).not.toBeInTheDocument();
      expect(screen.getByText(/2 esperan tu acción/)).toBeInTheDocument();
    });

    it('el operador no tiene nada que aprobar: solo le toca recibir lo que viene en camino', async () => {
      useSession('OPERADOR_INVENTARIO', 10);
      stub();
      await renderPage();
      await screen.findByText('#1');
      expect(within(screen.getByRole('row', { name: /#1\b/ })).queryByText('Te toca')).not.toBeInTheDocument();
      expect(within(screen.getByRole('row', { name: /#3\b/ })).getByText('Te toca')).toBeInTheDocument();
    });

    it('sin órdenes invita a crear la primera', async () => {
      useSession('MANAGER', 10);
      stub([]);
      await renderPage();
      expect(await screen.findByText('No hay órdenes en curso')).toBeInTheDocument();
    });

    it('si falla la carga muestra el error en la tabla, sin aviso global', async () => {
      useSession('MANAGER', 10);
      stub();
      server.use(http.get(URL_P, () => HttpResponse.json(apiErrorBody(500, 'INTERNAL_ERROR', 'Falla de prueba'), { status: 500 })));
      await renderPage();
      expect(await screen.findByRole('alert')).toHaveTextContent('Falla de prueba');
      expect(TestBed.inject(NotificationService).items()).toEqual([]);
    });
  });

  describe('detalle y acciones', () => {
    it('muestra los productos con cantidad, precio y subtotal, el total y las fechas', async () => {
      useSession('MANAGER', 10);
      stub();
      await renderPage();
      const dialog = await openDetail(4);
      expect(within(dialog).getByText('Recibida parcial')).toBeInTheDocument();
      expect(within(dialog).getByRole('row', { name: /Tornillo/ })).toHaveTextContent('Tornillo10');
      expect(within(dialog).getByRole('row', { name: /Tuerca/ })).toBeInTheDocument();
      expect(within(dialog).getByRole('row', { name: /Total/ })).toHaveTextContent('1.200');
    });

    it('aprobar una orden llama al servidor, avisa y recarga la lista', async () => {
      useSession('MANAGER', 10);
      stub();
      let lists = 0;
      let approved = '';
      server.use(
        http.get(URL_P, () => (lists++, HttpResponse.json(ORDERS))),
        http.post(`${URL_P}/:id/approve`, ({ params }) => ((approved = String(params['id'])), HttpResponse.json(order(1, 'PENDING')))),
      );
      await renderPage();
      const dialog = await openDetail(1);
      await userEvent.click(within(dialog).getByRole('button', { name: 'Aprobar' }));
      await vi.waitFor(() => expect(lists).toBe(2));
      expect(approved).toBe('1');
      await vi.waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
      expect(TestBed.inject(NotificationService).items()[0]).toMatchObject({ kind: 'success', message: 'Orden #1 aprobada.' });
    });

    it('el operador no ve aprobar ni cancelar, pero sí recibir', async () => {
      useSession('OPERADOR_INVENTARIO', 10);
      stub();
      await renderPage();
      const dialog = await openDetail(2);
      expect(within(dialog).queryByRole('button', { name: /Aprobar|Cancelar orden|Marcar como/ })).not.toBeInTheDocument();
      expect(within(dialog).getByRole('button', { name: 'Recibir mercancía' })).toBeInTheDocument();
    });

    it('"Marcar como enviada" solo aparece en una orden aprobada y llama a su endpoint', async () => {
      useSession('MANAGER', 10);
      stub();
      let hit = '';
      server.use(http.post(`${URL_P}/:id/dispatch`, ({ params }) => ((hit = String(params['id'])), HttpResponse.json(order(2, 'IN_TRANSIT')))));
      await renderPage();
      const dialog = await openDetail(2);
      await userEvent.click(within(dialog).getByRole('button', { name: 'Marcar como enviada' }));
      await vi.waitFor(() => expect(hit).toBe('2'));
    });

    it('una orden recibida del todo se paga; una pagada ya no ofrece pagar', async () => {
      useSession('MANAGER', 10);
      stub();
      let paid = '';
      server.use(http.post(`${URL_P}/:id/pay`, ({ params }) => ((paid = String(params['id'])), HttpResponse.json(order(5, 'RECEIVED_TOTAL', { paymentStatus: 'PAGADO' })))));
      await renderPage();
      await userEvent.click(screen.getByRole('combobox', { name: 'Estado de la orden' }));
      await userEvent.click(screen.getByRole('option', { name: 'Recibida' })); // exacto: "Recibida parcial" también existe
      const dialog = await openDetail(5);
      await userEvent.click(within(dialog).getByRole('button', { name: 'Marcar como pagada' }));
      await vi.waitFor(() => expect(paid).toBe('5'));
    });

    it('cerrar con faltante es solo del administrador', async () => {
      useSession('MANAGER', 10);
      stub();
      await renderPage();
      const dialog = await openDetail(4);
      expect(within(dialog).queryByRole('button', { name: 'Cerrar con faltante' })).not.toBeInTheDocument();
    });

    it('el administrador cierra una orden parcial con faltante', async () => {
      useSession('ADMIN');
      stub();
      let hit = '';
      server.use(http.post(`${URL_P}/:id/close-shortfall`, ({ params }) => ((hit = String(params['id'])), HttpResponse.json(order(4, 'RECEIVED_TOTAL')))));
      await renderPage();
      const dialog = await openDetail(4);
      await userEvent.click(within(dialog).getByRole('button', { name: 'Cerrar con faltante' }));
      await vi.waitFor(() => expect(hit).toBe('4'));
    });

    it('cancelar exige el motivo y lo envía', async () => {
      useSession('MANAGER', 10);
      stub();
      let body: unknown;
      server.use(http.post(`${URL_P}/2/cancel`, async ({ request }) => ((body = await request.json()), new HttpResponse(null, { status: 204 }))));
      await renderPage();
      const dialog = await openDetail(2);
      await userEvent.click(within(dialog).getByRole('button', { name: 'Cancelar orden' }));
      await userEvent.click(within(dialog).getByRole('button', { name: 'Cancelar orden' })); // enviar vacío
      expect(await within(dialog).findByText('Cuéntanos el motivo.')).toBeInTheDocument();
      await userEvent.type(within(dialog).getByLabelText('Motivo de la cancelación'), ' Cambió el pedido ');
      await userEvent.click(within(dialog).getByRole('button', { name: 'Cancelar orden' }));
      await vi.waitFor(() => expect(body).toEqual({ reason: 'Cambió el pedido' }));
    });

    it('si el servidor rechaza, el error queda en el diálogo (abierto) y sin aviso global', async () => {
      useSession('MANAGER', 10);
      stub();
      server.use(http.post(`${URL_P}/1/approve`, () => HttpResponse.json(apiErrorBody(409, 'INVALID_STATE', 'Solo se pueden aprobar órdenes por aprobar.'), { status: 409 })));
      await renderPage();
      const dialog = await openDetail(1);
      await userEvent.click(within(dialog).getByRole('button', { name: 'Aprobar' }));
      expect(await within(dialog).findByRole('alert')).toHaveTextContent('Solo se pueden aprobar');
      expect(screen.getByRole('dialog', { name: 'Orden de compra #1' })).toBeInTheDocument();
      expect(TestBed.inject(NotificationService).items()).toEqual([]);
    });
  });

  describe('recibir', () => {
    it('propone todo lo pedido, envía las cantidades y muestra cómo cambió el costo promedio', async () => {
      useSession('OPERADOR_INVENTARIO', 10);
      stub();
      let body: unknown;
      let lists = 0;
      server.use(
        http.get(URL_P, () => (lists++, HttpResponse.json(ORDERS))),
        http.post(`${URL_P}/4/receive`, async ({ request }) => {
          body = await request.json();
          return HttpResponse.json({
            orderId: 4,
            status: 'RECEIVED_TOTAL',
            impacts: [{ productId: 1, productName: 'Tornillo', oldCpp: 100, newCpp: 90, quantityReceived: 4 }],
          });
        }),
      );
      await renderPage();
      const dialog = await openDetail(4);
      await userEvent.click(within(dialog).getByRole('button', { name: 'Recibir mercancía' }));
      // Ya llegaron 6 de 10: el formulario propone y limita a lo que falta, no a lo pedido.
      const tornillo = within(dialog).getByLabelText('Tornillo (faltan 4 de 10)');
      expect(tornillo).toHaveValue(4);
      await userEvent.clear(tornillo);
      await userEvent.type(tornillo, '3');
      await userEvent.click(within(dialog).getByRole('button', { name: 'Registrar recepción' }));
      await vi.waitFor(() => expect(body).toEqual({ items: [{ detailId: 41, quantityReceived: 3 }, { detailId: 42, quantityReceived: 4 }] }));
      expect(await within(dialog).findByText(/Recepción registrada/)).toBeInTheDocument();
      expect(within(dialog).getByRole('row', { name: /Tornillo/ })).toHaveTextContent('Tornillo4$ 100$ 90');
      await vi.waitFor(() => expect(lists).toBe(2)); // la lista se actualiza aunque el diálogo siga abierto
      await userEvent.click(within(dialog).getByRole('button', { name: 'Listo' }));
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('en una orden parcial no deja recibir más de lo que falta aunque no pase de lo pedido', async () => {
      useSession('OPERADOR_INVENTARIO', 10);
      stub();
      let called = false;
      server.use(http.post(`${URL_P}/4/receive`, () => ((called = true), HttpResponse.json({}))));
      await renderPage();
      const dialog = await openDetail(4);
      expect(within(dialog).getByRole('row', { name: /Tornillo/ })).toHaveTextContent('Tornillo106'); // pedido 10, recibido 6
      await userEvent.click(within(dialog).getByRole('button', { name: 'Recibir mercancía' }));
      const qty = within(dialog).getByLabelText('Tornillo (faltan 4 de 10)');
      await userEvent.clear(qty);
      await userEvent.type(qty, '5');
      await userEvent.click(within(dialog).getByRole('button', { name: 'Registrar recepción' }));
      expect(await within(dialog).findByText('Es más de lo que falta por recibir.')).toBeInTheDocument();
      expect(called).toBe(false);
    });

    it('no deja recibir más de lo pedido ni todo en cero', async () => {
      useSession('OPERADOR_INVENTARIO', 10);
      stub();
      let called = false;
      server.use(http.post(`${URL_P}/3/receive`, () => ((called = true), HttpResponse.json({}))));
      await renderPage();
      const dialog = await openDetail(3);
      await userEvent.click(within(dialog).getByRole('button', { name: 'Recibir mercancía' }));
      const qty = within(dialog).getByLabelText('Tornillo (faltan 10 de 10)');
      await userEvent.clear(qty);
      await userEvent.type(qty, '11');
      await userEvent.click(within(dialog).getByRole('button', { name: 'Registrar recepción' }));
      expect(await within(dialog).findByText('Es más de lo que falta por recibir.')).toBeInTheDocument();
      await userEvent.clear(qty);
      await userEvent.type(qty, '0');
      await userEvent.click(within(dialog).getByRole('button', { name: 'Registrar recepción' }));
      expect(await within(dialog).findByRole('alert')).toHaveTextContent('al menos una unidad');
      expect(called).toBe(false);
    });

    it('si el servidor rechaza la recepción, el error queda en el diálogo', async () => {
      useSession('OPERADOR_INVENTARIO', 10);
      stub();
      server.use(http.post(`${URL_P}/3/receive`, () => HttpResponse.json(apiErrorBody(400, 'INVALID_ARGUMENT', 'No se puede recibir más de lo pendiente en el producto 1.'), { status: 400 })));
      await renderPage();
      const dialog = await openDetail(3);
      await userEvent.click(within(dialog).getByRole('button', { name: 'Recibir mercancía' }));
      await userEvent.click(within(dialog).getByRole('button', { name: 'Registrar recepción' }));
      expect(await within(dialog).findByRole('alert')).toHaveTextContent('más de lo pendiente');
    });
  });

  describe('nueva orden', () => {
    it('propone el plazo del proveedor y el precio pactado, calcula el total y envía la orden', async () => {
      useSession('MANAGER', 10);
      stub();
      let body: unknown;
      server.use(http.post(URL_P, async ({ request }) => ((body = await request.json()), HttpResponse.json(order(9, 'PENDING'), { status: 201 }))));
      await renderPage();
      await screen.findByText('#1');
      await userEvent.click(screen.getByRole('button', { name: /Nueva orden de compra/ }));
      const dialog = screen.getByRole('dialog', { name: 'Nueva orden de compra' });
      await chooseOption('Proveedor', 'Ferretería Central');
      expect(within(dialog).getByLabelText('Tiempo de entrega (días)')).toHaveValue(3);
      await chooseOption('Producto', 'Tornillo');
      expect(within(dialog).getByLabelText('Precio unitario')).toHaveValue(80); // precio pactado
      await userEvent.type(within(dialog).getByLabelText('Cantidad'), '10');
      await userEvent.clear(within(dialog).getByLabelText('Descuento %'));
      await userEvent.type(within(dialog).getByLabelText('Descuento %'), '10');
      expect(within(dialog).getByText(/\$\s?720/, { selector: 'strong' })).toBeInTheDocument(); // 10 × 80 − 10 %
      await userEvent.click(within(dialog).getByRole('button', { name: 'Crear orden' }));
      await vi.waitFor(() =>
        expect(body).toEqual({
          supplierId: 100,
          leadTimeDays: 3,
          paymentDueDays: 30,
          items: [{ productId: 1, quantity: 10, unitPrice: 80, discountPct: 10 }],
        }),
      );
      expect(TestBed.inject(NotificationService).items()[0]).toMatchObject({ message: 'Orden #9 creada.' });
    });

    it('un operador crea una orden que queda esperando aprobación y el aviso lo dice', async () => {
      useSession('OPERADOR_INVENTARIO', 10);
      stub();
      server.use(http.post(URL_P, () => HttpResponse.json(order(9, 'AWAITING_APPROVAL'), { status: 201 })));
      await renderPage();
      await screen.findByText('#1');
      await userEvent.click(screen.getByRole('button', { name: /Nueva orden de compra/ }));
      const dialog = screen.getByRole('dialog', { name: 'Nueva orden de compra' });
      await chooseOption('Proveedor', 'Aceros del Sur');
      await chooseOption('Producto', 'Tuerca');
      await userEvent.type(within(dialog).getByLabelText('Cantidad'), '2');
      await userEvent.type(within(dialog).getByLabelText('Precio unitario'), '50');
      await userEvent.click(within(dialog).getByRole('button', { name: 'Crear orden' }));
      await vi.waitFor(() =>
        expect(TestBed.inject(NotificationService).items()[0]).toMatchObject({ message: 'Orden #9 creada: espera la aprobación de un gerente.' }),
      );
    });

    it('solo el administrador elige la sucursal que recibe', async () => {
      useSession('ADMIN');
      stub();
      await renderPage();
      await screen.findByText('#1');
      await userEvent.click(screen.getByRole('button', { name: /Nueva orden de compra/ }));
      expect(screen.getByRole('combobox', { name: 'Sucursal que recibe' })).toBeInTheDocument();
    });

    it('un gerente no ve la sucursal (compra para la suya)', async () => {
      useSession('MANAGER', 10);
      stub();
      await renderPage();
      await screen.findByText('#1');
      await userEvent.click(screen.getByRole('button', { name: /Nueva orden de compra/ }));
      expect(screen.queryByRole('combobox', { name: 'Sucursal que recibe' })).not.toBeInTheDocument();
    });

    it('no ofrece productos inactivos ni repite un producto ya agregado', async () => {
      useSession('MANAGER', 10);
      stub();
      await renderPage();
      await screen.findByText('#1');
      await userEvent.click(screen.getByRole('button', { name: /Nueva orden de compra/ }));
      const dialog = screen.getByRole('dialog', { name: 'Nueva orden de compra' });
      await chooseOption('Producto', 'Tornillo');
      await userEvent.click(within(dialog).getByRole('button', { name: /Agregar producto/ }));
      await userEvent.click(within(dialog).getAllByRole('combobox', { name: /^Producto/ })[1]);
      expect(screen.queryByRole('option', { name: /Descontinuado/ })).not.toBeInTheDocument();
      expect(screen.getByRole('option', { name: /Tornillo/ })).toHaveAttribute('aria-disabled', 'true');
    });

    it('sin datos obligatorios no envía y señala cada campo', async () => {
      useSession('MANAGER', 10);
      stub();
      let called = false;
      server.use(http.post(URL_P, () => ((called = true), HttpResponse.json({}))));
      await renderPage();
      await screen.findByText('#1');
      await userEvent.click(screen.getByRole('button', { name: /Nueva orden de compra/ }));
      const dialog = screen.getByRole('dialog', { name: 'Nueva orden de compra' });
      await userEvent.click(within(dialog).getByRole('button', { name: 'Crear orden' }));
      expect(await within(dialog).findAllByText('Elige una opción.')).toHaveLength(2); // proveedor y producto
      expect(within(dialog).getByText('Escribe la cantidad.')).toBeInTheDocument();
      expect(within(dialog).getByText('Escribe el precio.')).toBeInTheDocument();
      expect(called).toBe(false);
    });

    it('si el servidor rechaza la orden, lo explica dentro del formulario', async () => {
      useSession('MANAGER', 10);
      stub();
      server.use(http.post(URL_P, () => HttpResponse.json(apiErrorBody(400, 'INVALID_ARGUMENT', 'El proveedor no existe.'), { status: 400 })));
      await renderPage();
      await screen.findByText('#1');
      await userEvent.click(screen.getByRole('button', { name: /Nueva orden de compra/ }));
      const dialog = screen.getByRole('dialog', { name: 'Nueva orden de compra' });
      await chooseOption('Proveedor', 'Ferretería Central');
      await chooseOption('Producto', 'Tuerca');
      await userEvent.type(within(dialog).getByLabelText('Cantidad'), '1');
      await userEvent.type(within(dialog).getByLabelText('Precio unitario'), '10');
      await userEvent.click(within(dialog).getByRole('button', { name: 'Crear orden' }));
      expect(await within(dialog).findByRole('alert')).toHaveTextContent('El proveedor no existe.');
    });
  });
});
