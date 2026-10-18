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
import { ReturnsPage } from './returns-page';

const item = (id: number, productoId: number, cantidad: number, precio: number, motivo = '') => ({ id, productoId, cantidad, motivoEspecifico: motivo, precioUnidadVenta: precio });
const request = (id: number, estado: string, extra: object = {}) => ({
  id,
  saleId: 50 + id,
  sucursalId: 10,
  solicitanteId: 7,
  estado,
  fechaSolicitud: `2026-10-${String(10 + id).padStart(2, '0')}T09:00:00`,
  motivoGeneral: 'Producto defectuoso',
  items: [item(id * 10, 1, 2, 1000, 'Rayado')],
  ...extra,
});

const REQUESTS = [
  request(1, 'PENDIENTE', { items: [item(10, 1, 2, 1000, 'Rayado'), item(11, 2, 1, 500)] }),
  request(2, 'APROBADA', { aprobadorId: 8, fechaProcesamiento: '2026-10-13T10:00:00', comentarioAprobador: 'Todo en orden' }),
  request(3, 'RECHAZADA', { aprobadorId: 8, fechaProcesamiento: '2026-10-14T10:00:00', comentarioAprobador: 'Fuera de plazo' }),
  request(4, 'PENDIENTE', { sucursalId: 20 }),
];
const SALES = [
  {
    id: 60,
    date: '2026-10-15T10:00:00',
    status: 'COMPLETED',
    branchId: 10,
    customerName: 'Ana Pérez',
    totalFinal: 5000,
    details: [
      { id: 1, productId: 1, productName: 'Tornillo', quantity: 5, unitPriceApplied: 1000, subtotalLine: 5000 },
      { id: 2, productId: 2, productName: 'Tuerca', quantity: 2, unitPriceApplied: 500, subtotalLine: 1000 },
    ],
  },
  // 10 % de descuento en la línea y 20 % general; el mismo producto en dos líneas con distinto precio.
  {
    id: 62,
    date: '2026-10-13T10:00:00',
    status: 'COMPLETED',
    branchId: 10,
    customerName: 'Descuentos',
    totalFinal: 1000,
    globalDiscountPercentage: 20,
    details: [
      { id: 3, productId: 1, productName: 'Tornillo', quantity: 1, unitPriceApplied: 1000, discountPercentage: 10, subtotalLine: 900 },
      { id: 4, productId: 1, productName: 'Tornillo', quantity: 1, unitPriceApplied: 800, discountPercentage: 0, subtotalLine: 800 },
    ],
  },
  { id: 61, date: '2026-10-14T10:00:00', status: 'CANCELED', branchId: 10, customerName: 'Anulada', totalFinal: 100, details: [] },
];
const PRODUCTS = [
  { id: 1, sku: 'TOR-1', nombre: 'Tornillo', precioVenta: 1000, unitAbbreviation: 'UND', activo: true, proveedores: [] },
  { id: 2, sku: 'TUE-2', nombre: 'Tuerca', precioVenta: 500, unitAbbreviation: 'UND', activo: true, proveedores: [] },
];
const BRANCHES = [
  { id: 10, nombre: 'Sede Central', activa: true },
  { id: 20, nombre: 'Sucursal Norte', activa: true },
];
const USERS = [
  { id: 7, nombre: 'Luis Pérez', email: 'l@z.co' },
  { id: 8, nombre: 'Sofía Díaz', email: 's@z.co' },
];
const URL_R = `${TEST_API}/api/v1/returns`;

function useSession(rol: string, sucursalId?: number) {
  localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify({ token: 't', email: 'e@z.co', nombre: 'Yo', rol, id: 9, sucursalId }));
}

function stub(users: 'ok' | 403 = 'ok') {
  server.use(
    http.get(URL_R, () => HttpResponse.json(REQUESTS)),
    http.get(`${URL_R}/branch/:id`, ({ params }) => HttpResponse.json(REQUESTS.filter((r) => r.sucursalId === Number(params['id'])))),
    http.get(`${TEST_API}/api/v1/sales`, () => HttpResponse.json(SALES)),
    http.get(`${TEST_API}/api/catalog/products`, () => HttpResponse.json(PRODUCTS)),
    http.get(`${TEST_API}/api/branches`, () => HttpResponse.json(BRANCHES)),
    http.get(`${TEST_API}/api/users`, () => (users === 403 ? HttpResponse.json(apiErrorBody(403, 'ACCESS_DENIED', 'Sin acceso'), { status: 403 }) : HttpResponse.json(USERS))),
  );
}

const renderPage = () =>
  render(ReturnsPage, { providers: [provideHttpClient(withInterceptors([errorInterceptor])), { provide: API_BASE_URL, useValue: TEST_API }] });

const ids = () => screen.getAllByRole('row').slice(1).map((r) => within(r).getAllByRole('cell')[0]?.textContent?.trim());

async function openDetail(id: number) {
  await userEvent.click(await screen.findByRole('button', { name: `Ver devolución ${id}` }));
  return screen.getByRole('dialog', { name: `Devolución #${id}` });
}

describe('ReturnsPage', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => localStorage.clear());

  describe('lista', () => {
    it('el gerente ve las pendientes de su sucursal (pide solo las de su sucursal al servidor)', async () => {
      useSession('MANAGER', 10);
      stub();
      let asked = '';
      server.use(http.get(`${URL_R}/branch/:id`, ({ params }) => ((asked = String(params['id'])), HttpResponse.json(REQUESTS.filter((r) => r.sucursalId === 10)))));
      await renderPage();
      expect(await screen.findByText('#1')).toBeInTheDocument();
      expect(screen.getByRole('heading', { level: 1, name: 'Devoluciones' })).toBeInTheDocument();
      expect(asked).toBe('10');
      expect(ids()).toEqual(['#1']); // por defecto solo pendientes; #4 es de otra sucursal
      expect(screen.getByText('3 solicitudes, 1 pendiente')).toBeInTheDocument();
    });

    it('el administrador pide todas las sucursales y ve la columna de sucursal', async () => {
      useSession('ADMIN');
      stub();
      await renderPage();
      await screen.findByText('#1');
      expect(ids()).toEqual(['#4', '#1']);
      expect(screen.getByRole('columnheader', { name: /Sucursal/ })).toBeInTheDocument();
      expect(within(screen.getByRole('row', { name: /#4/ })).getByText('Sucursal Norte')).toBeInTheDocument();
    });

    it('muestra productos por nombre ("Tornillo +1"), valor y quién solicitó', async () => {
      useSession('MANAGER', 10);
      stub();
      await renderPage();
      const row = await screen.findByRole('row', { name: /#1/ });
      expect(within(row).getByText('Tornillo +1')).toBeInTheDocument();
      expect(within(row).getByText('$ 2.500')).toBeInTheDocument(); // 2 × 1.000 + 1 × 500
      expect(within(row).getByText('Luis Pérez')).toBeInTheDocument();
      expect(within(row).getByText('Pendiente')).toBeInTheDocument();
    });

    it('si no se pueden leer los usuarios (403), muestra su número', async () => {
      useSession('MANAGER', 10);
      stub(403);
      await renderPage();
      expect(await screen.findByText('Usuario 7')).toBeInTheDocument();
    });

    it('el filtro de estado muestra aprobadas, rechazadas o todas', async () => {
      useSession('MANAGER', 10);
      stub();
      await renderPage();
      await screen.findByText('#1');
      await chooseOption('Estado de la devolución', 'Aprobada');
      expect(ids()).toEqual(['#2']);
      await chooseOption('Estado de la devolución', 'Todas');
      expect(ids()).toEqual(['#3', '#2', '#1']);
    });

    it('al gerente le marca "Te toca" en lo pendiente; al vendedor no', async () => {
      useSession('MANAGER', 10);
      stub();
      await renderPage();
      expect(within(await screen.findByRole('row', { name: /#1/ })).getByText('Te toca')).toBeInTheDocument();
    });

    it('el vendedor ve las suyas sin "Te toca" ni botones de decidir', async () => {
      useSession('SELLER', 10);
      stub();
      await renderPage();
      expect(within(await screen.findByRole('row', { name: /#1/ })).queryByText('Te toca')).not.toBeInTheDocument();
      const dialog = await openDetail(1);
      expect(within(dialog).queryByRole('button', { name: /Aprobar|Rechazar/ })).not.toBeInTheDocument();
    });

    it('sin pendientes dice que no hay nada por decidir', async () => {
      useSession('MANAGER', 10);
      stub();
      server.use(http.get(`${URL_R}/branch/:id`, () => HttpResponse.json([])));
      await renderPage();
      expect(await screen.findByText('No hay devoluciones pendientes')).toBeInTheDocument();
    });

    it('si falla la carga muestra el error en la tabla, sin aviso global', async () => {
      useSession('MANAGER', 10);
      stub();
      server.use(http.get(`${URL_R}/branch/:id`, () => HttpResponse.json(apiErrorBody(500, 'INTERNAL_ERROR', 'Falla de prueba'), { status: 500 })));
      await renderPage();
      expect(await screen.findByRole('alert')).toHaveTextContent('Falla de prueba');
      expect(TestBed.inject(NotificationService).items()).toEqual([]);
    });

    it('un usuario sin sucursal lo ve explicado', async () => {
      useSession('MANAGER');
      stub();
      await renderPage();
      expect(await screen.findByRole('alert')).toHaveTextContent('Tu usuario no tiene una sucursal asignada.');
    });
  });

  describe('detalle y decisión', () => {
    it('muestra los productos con motivo, el total a devolver, quién solicitó y el motivo general', async () => {
      useSession('MANAGER', 10);
      stub();
      await renderPage();
      const dialog = await openDetail(1);
      expect(within(dialog).getByRole('row', { name: /Tornillo/ })).toHaveTextContent('Rayado');
      expect(dialog).toHaveTextContent('Venta #51');
      expect(dialog).toHaveTextContent('Producto defectuoso');
      expect(dialog).toHaveTextContent('Luis Pérez');
      expect(within(dialog).getByRole('row', { name: /Total a devolver/ })).toHaveTextContent('$ 2.500');
    });

    it('una decidida muestra quién y qué comentó, y no ofrece decidir otra vez', async () => {
      useSession('MANAGER', 10);
      stub();
      await renderPage();
      await chooseOption('Estado de la devolución', 'Rechazada');
      const dialog = await openDetail(3);
      expect(dialog).toHaveTextContent('Sofía Díaz');
      expect(dialog).toHaveTextContent('Motivo del rechazo');
      expect(dialog).toHaveTextContent('Fuera de plazo');
      expect(within(dialog).queryByRole('button', { name: /Aprobar|Rechazar/ })).not.toBeInTheDocument();
    });

    it('aprobar envía el comentario (opcional), avisa que el stock volvió y recarga', async () => {
      useSession('MANAGER', 10);
      stub();
      let lists = 0;
      let hit: { id: string; comment: string | null } | null = null;
      server.use(
        http.get(`${URL_R}/branch/:id`, () => (lists++, HttpResponse.json(REQUESTS))),
        http.post(`${URL_R}/:id/approve`, ({ params, request: req }) => ((hit = { id: String(params['id']), comment: new URL(req.url).searchParams.get('comment') }), new HttpResponse(null, { status: 204 }))),
      );
      await renderPage();
      const dialog = await openDetail(1);
      await userEvent.click(within(dialog).getByRole('button', { name: 'Aprobar' }));
      await userEvent.type(within(dialog).getByLabelText('Comentario (opcional)'), ' Revisado ');
      await userEvent.click(within(dialog).getByRole('button', { name: 'Aprobar devolución' }));
      await vi.waitFor(() => expect(hit).toEqual({ id: '1', comment: 'Revisado' }));
      await vi.waitFor(() => expect(lists).toBe(2));
      expect(TestBed.inject(NotificationService).items()[0]).toMatchObject({ kind: 'success', message: 'Devolución #1 aprobada: las unidades volvieron al stock.' });
    });

    it('aprobar sin comentario también se puede', async () => {
      useSession('MANAGER', 10);
      stub();
      let comment: string | null = 'x';
      server.use(http.post(`${URL_R}/:id/approve`, ({ request: req }) => ((comment = new URL(req.url).searchParams.get('comment')), new HttpResponse(null, { status: 204 }))));
      await renderPage();
      const dialog = await openDetail(1);
      await userEvent.click(within(dialog).getByRole('button', { name: 'Aprobar' }));
      await userEvent.click(within(dialog).getByRole('button', { name: 'Aprobar devolución' }));
      await vi.waitFor(() => expect(comment).toBe(''));
    });

    it('rechazar exige el motivo y lo envía', async () => {
      useSession('MANAGER', 10);
      stub();
      let reason: string | null = null;
      server.use(http.post(`${URL_R}/:id/reject`, ({ request: req }) => ((reason = new URL(req.url).searchParams.get('reason')), new HttpResponse(null, { status: 204 }))));
      await renderPage();
      const dialog = await openDetail(1);
      await userEvent.click(within(dialog).getByRole('button', { name: 'Rechazar' }));
      await userEvent.click(within(dialog).getByRole('button', { name: 'Rechazar devolución' }));
      expect(await within(dialog).findByText('Cuéntanos el motivo del rechazo.')).toBeInTheDocument();
      expect(reason).toBeNull();
      await userEvent.type(within(dialog).getByLabelText('Motivo del rechazo'), 'Fuera del plazo de garantía');
      await userEvent.click(within(dialog).getByRole('button', { name: 'Rechazar devolución' }));
      await vi.waitFor(() => expect(reason).toBe('Fuera del plazo de garantía'));
    });

    it('si el servidor rechaza la decisión, el error queda en el diálogo (abierto)', async () => {
      useSession('MANAGER', 10);
      stub();
      server.use(http.post(`${URL_R}/:id/approve`, () => HttpResponse.json(apiErrorBody(400, 'INVALID_ARGUMENT', 'No se pueden gestionar devoluciones de una venta anulada.'), { status: 400 })));
      await renderPage();
      const dialog = await openDetail(1);
      await userEvent.click(within(dialog).getByRole('button', { name: 'Aprobar' }));
      await userEvent.click(within(dialog).getByRole('button', { name: 'Aprobar devolución' }));
      expect(await within(dialog).findByRole('alert')).toHaveTextContent('venta anulada');
      expect(screen.getByRole('dialog', { name: 'Devolución #1' })).toBeInTheDocument();
    });
  });

  describe('solicitar', () => {
    const open = async () => {
      await screen.findByText('#1');
      await userEvent.click(screen.getByRole('button', { name: /Solicitar devolución/ }));
      return screen.getByRole('dialog', { name: 'Solicitar devolución' });
    };

    it('solo ofrece ventas no anuladas, y al elegir una muestra lo vendido y lo que queda por devolver', async () => {
      useSession('SELLER', 10);
      stub();
      await renderPage();
      const dialog = await open();
      await userEvent.click(within(dialog).getByRole('combobox', { name: 'Venta' }));
      expect(screen.queryByRole('option', { name: /Venta #61/ })).not.toBeInTheDocument(); // anulada
      await userEvent.click(screen.getByRole('option', { name: /Venta #60/ }));
      // Pendiente #1 (venta 51) no es de esta venta; la venta 60 no tiene devoluciones previas.
      expect(within(dialog).getByText(/Vendidas 5/)).toBeInTheDocument();
      expect(within(dialog).getByLabelText('Unidades a devolver de Tornillo')).toHaveValue(0);
    });

    it('descuenta lo ya devuelto o pendiente de esa venta (no las rechazadas) y no deja pedir más', async () => {
      useSession('SELLER', 10);
      stub();
      server.use(
        http.get(`${URL_R}/branch/:id`, () =>
          HttpResponse.json([
            request(7, 'PENDIENTE', { saleId: 60, items: [item(70, 1, 2, 1000)] }),
            request(8, 'APROBADA', { saleId: 60, items: [item(80, 1, 1, 1000)] }),
            request(9, 'RECHAZADA', { saleId: 60, items: [item(90, 1, 2, 1000)] }),
          ]),
        ),
      );
      await renderPage();
      await screen.findByText('#7');
      await userEvent.click(screen.getByRole('button', { name: /Solicitar devolución/ }));
      const dialog = screen.getByRole('dialog', { name: 'Solicitar devolución' });
      await chooseOption('Venta', 'Venta #60');
      // Tornillo: 5 vendidas − 2 pendientes − 1 aprobada = 2 por devolver (la rechazada no cuenta).
      expect(within(dialog).getByText(/ya devueltas o pendientes 3/)).toBeInTheDocument();
      const qty = within(dialog).getByLabelText('Unidades a devolver de Tornillo');
      await userEvent.type(qty, '3');
      await userEvent.click(within(dialog).getByRole('button', { name: 'Solicitar devolución' }));
      expect(await within(dialog).findByText('Es más de lo que queda por devolver.')).toBeInTheDocument();
    });

    it('el precio pagado incluye los descuentos (de la línea y el general) y promedia las líneas repetidas del producto', async () => {
      useSession('SELLER', 10);
      stub();
      let body: { items?: { unitPricePaid: number }[] } = {};
      server.use(http.post(URL_R, async ({ request: req }) => ((body = (await req.json()) as typeof body), HttpResponse.json(request(20, 'PENDIENTE'), { status: 201 }))));
      await renderPage();
      const dialog = await open();
      await chooseOption('Venta', 'Venta #62');
      await userEvent.clear(within(dialog).getByLabelText('Unidades a devolver de Tornillo'));
      await userEvent.type(within(dialog).getByLabelText('Unidades a devolver de Tornillo'), '1');
      await userEvent.type(within(dialog).getByLabelText('Motivo de la devolución de Tornillo'), 'Rayado');
      await userEvent.type(within(dialog).getByLabelText('Motivo general'), 'Defecto');
      await userEvent.click(within(dialog).getByRole('button', { name: 'Solicitar devolución' }));
      // (900 + 800) × (1 − 20 %) = 1.360 por 2 unidades.
      await vi.waitFor(() => expect(body.items?.[0]?.unitPricePaid).toBe(680));
    });

    it('envía la solicitud con solo los productos que se devuelven, el motivo y el precio pagado', async () => {
      useSession('SELLER', 10);
      stub();
      let body: Record<string, unknown> = {};
      server.use(http.post(URL_R, async ({ request: req }) => ((body = (await req.json()) as Record<string, unknown>), HttpResponse.json(request(20, 'PENDIENTE'), { status: 201 }))));
      await renderPage();
      const dialog = await open();
      await chooseOption('Venta', 'Venta #60');
      await userEvent.clear(within(dialog).getByLabelText('Unidades a devolver de Tornillo'));
      await userEvent.type(within(dialog).getByLabelText('Unidades a devolver de Tornillo'), '2');
      await userEvent.type(within(dialog).getByLabelText('Motivo de la devolución de Tornillo'), 'Rayado');
      await userEvent.type(within(dialog).getByLabelText('Motivo general'), 'Producto defectuoso');
      await userEvent.click(within(dialog).getByRole('button', { name: 'Solicitar devolución' }));
      await vi.waitFor(() =>
        expect(body).toEqual({
          saleId: 60,
          branchId: 10,
          requesterId: 9,
          generalReason: 'Producto defectuoso',
          items: [{ productId: 1, quantity: 2, reasonSpecific: 'Rayado', unitPricePaid: 1000 }],
        }),
      );
      expect(TestBed.inject(NotificationService).items()[0]).toMatchObject({ message: 'Devolución #20 solicitada: espera la decisión de un gerente.' });
    });

    it('exige elegir la venta, el motivo y al menos una unidad', async () => {
      useSession('SELLER', 10);
      stub();
      let called = false;
      server.use(http.post(URL_R, () => ((called = true), HttpResponse.json({}))));
      await renderPage();
      const dialog = await open();
      await userEvent.click(within(dialog).getByRole('button', { name: 'Solicitar devolución' }));
      expect(screen.queryByRole('dialog', { name: 'Solicitar devolución' })).toBeInTheDocument();
      // "Solicitar" está deshabilitado hasta elegir la venta.
      expect(within(dialog).getByRole('button', { name: 'Solicitar devolución' })).toBeDisabled();
      await chooseOption('Venta', 'Venta #60');
      await userEvent.click(within(dialog).getByRole('button', { name: 'Solicitar devolución' }));
      expect(await within(dialog).findByText('Cuéntanos por qué se devuelve.')).toBeInTheDocument();
      await userEvent.type(within(dialog).getByLabelText('Motivo general'), 'Defectuoso');
      await userEvent.click(within(dialog).getByRole('button', { name: 'Solicitar devolución' }));
      expect(await within(dialog).findByRole('alert')).toHaveTextContent('al menos un producto');
      expect(called).toBe(false);
    });

    it('si ya se devolvió todo lo vendido, lo explica y no deja solicitar', async () => {
      useSession('SELLER', 10);
      stub();
      server.use(
        http.get(`${URL_R}/branch/:id`, () =>
          HttpResponse.json([request(7, 'APROBADA', { saleId: 60, items: [item(70, 1, 5, 1000), item(71, 2, 2, 500)] })]),
        ),
      );
      await renderPage();
      await screen.findByText(/solicitud/);
      await userEvent.click(screen.getByRole('button', { name: /Solicitar devolución/ }));
      const dialog = screen.getByRole('dialog', { name: 'Solicitar devolución' });
      await chooseOption('Venta', 'Venta #60');
      expect(within(dialog).getByText(/ya no tiene unidades por devolver/)).toBeInTheDocument();
      expect(within(dialog).getByRole('button', { name: 'Solicitar devolución' })).toBeDisabled();
    });

    it('si el servidor rechaza la solicitud, lo explica dentro del formulario', async () => {
      useSession('SELLER', 10);
      stub();
      server.use(http.post(URL_R, () => HttpResponse.json(apiErrorBody(422, 'INVALID_RETURN_OPERATION', 'La venta no pertenece a la sucursal indicada.'), { status: 422 })));
      await renderPage();
      const dialog = await open();
      await chooseOption('Venta', 'Venta #60');
      await userEvent.clear(within(dialog).getByLabelText('Unidades a devolver de Tornillo'));
      await userEvent.type(within(dialog).getByLabelText('Unidades a devolver de Tornillo'), '1');
      await userEvent.type(within(dialog).getByLabelText('Motivo general'), 'Defectuoso');
      await userEvent.click(within(dialog).getByRole('button', { name: 'Solicitar devolución' }));
      expect(await within(dialog).findByRole('alert')).toHaveTextContent('La venta no pertenece a la sucursal indicada.');
      expect(screen.getByRole('dialog', { name: 'Solicitar devolución' })).toBeInTheDocument();
    });
  });
});
