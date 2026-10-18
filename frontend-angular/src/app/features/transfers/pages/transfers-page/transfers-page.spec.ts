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
import { TransfersPage } from './transfers-page';

const line = (id: number, productId: number, name: string, requested: number, extra: object = {}) => ({
  id,
  productId,
  productName: name,
  requestedQuantity: requested,
  missingQuantity: 0,
  ...extra,
});

const T = {
  pending: { id: 5, status: 'PENDING', priority: 'HIGH', originBranchId: 10, destinationBranchId: 20, requestDate: '2026-10-15T08:00:00', solicitanteNombre: 'Luis', details: [line(51, 100, 'Tornillo', 8), line(52, 101, 'Tuerca', 3)] },
  approved: { id: 4, status: 'APPROVED_DEST', priority: 'NORMAL', originBranchId: 10, destinationBranchId: 20, requestDate: '2026-10-14T08:00:00', details: [line(41, 100, 'Tornillo', 5)] },
  preparing: { id: 3, status: 'PREPARING', priority: 'NORMAL', originBranchId: 10, destinationBranchId: 20, requestDate: '2026-10-13T08:00:00', details: [line(31, 100, 'Tornillo', 6), line(32, 101, 'Tuerca', 2)] },
  transit: { id: 2, status: 'IN_TRANSIT', priority: 'LOW', originBranchId: 10, destinationBranchId: 20, requestDate: '2026-10-12T08:00:00', carrier: 'Servientrega', details: [line(21, 100, 'Tornillo', 4, { sentQuantity: 4 })] },
  issue: { id: 1, status: 'WITH_ISSUE', priority: 'NORMAL', originBranchId: 10, destinationBranchId: 20, requestDate: '2026-10-11T08:00:00', details: [line(11, 100, 'Tornillo', 4, { sentQuantity: 4, receivedQuantity: 2, missingQuantity: 2 })] },
  done: { id: 9, status: 'DELIVERED', priority: 'NORMAL', originBranchId: 20, destinationBranchId: 30, requestDate: '2026-10-01T08:00:00', details: [line(91, 100, 'Tornillo', 1, { sentQuantity: 1, receivedQuantity: 1 })] },
};
const ALL = [T.pending, T.approved, T.preparing, T.transit, T.issue, T.done];

const BRANCHES = [
  { id: 10, nombre: 'Sede Central', activa: true },
  { id: 20, nombre: 'Sucursal Norte', activa: true },
  { id: 30, nombre: 'Sucursal Sur', activa: true },
  { id: 40, nombre: 'Sucursal Cerrada', activa: false },
];
const PRODUCTS = [
  { id: 100, sku: 'TOR-1', nombre: 'Tornillo' },
  { id: 101, sku: 'TUE-2', nombre: 'Tuerca' },
];
const URL_T = `${TEST_API}/api/v1/transfers`;

function useSession(rol: string, sucursalId?: number) {
  localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify({ token: 't', email: 'e@z.co', nombre: 'Yo', rol, id: 1, sucursalId }));
}

function stub(transfers: unknown[] = ALL) {
  server.use(
    http.get(URL_T, () => HttpResponse.json(transfers)),
    http.get(`${TEST_API}/api/branches`, () => HttpResponse.json(BRANCHES)),
    http.get(`${TEST_API}/api/catalog/products`, () => HttpResponse.json(PRODUCTS)),
  );
}

const renderPage = () =>
  render(TransfersPage, { providers: [provideHttpClient(withInterceptors([errorInterceptor])), { provide: API_BASE_URL, useValue: TEST_API }] });

const ids = () => screen.getAllByRole('row').slice(1).map((r) => within(r).getAllByRole('cell')[0]?.textContent?.trim());

/** Abre el detalle del traslado con ese número (la fila es clicable). */
async function openDetail(id: number) {
  await userEvent.click(await screen.findByRole('button', { name: `Ver traslado ${id}` }));
  return screen.getByRole('dialog', { name: `Traslado #${id}` });
}

describe('TransfersPage', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => localStorage.clear());

  describe('lista', () => {
    it('no tiene problemas de accesibilidad detectables', async () => {
      useSession('ADMIN');
      stub();
      await renderPage();
      await vi.waitFor(() => expect(screen.getAllByRole('row').length).toBeGreaterThan(1));
      await expectAccessible();
    });

    it('muestra por defecto solo los traslados en curso, con la ruta por nombre y el estado en texto', async () => {
      useSession('ADMIN');
      stub();
      await renderPage();
      expect(await screen.findByText('#5')).toBeInTheDocument();
      expect(screen.getByRole('heading', { level: 1, name: 'Traslados' })).toBeInTheDocument();
      expect(ids()).toEqual(['#5', '#4', '#3', '#2', '#1']); // el entregado (#9) queda fuera; el más reciente primero
      expect(within(screen.getByRole('row', { name: /#5/ })).getByText('Sede Central → Sucursal Norte')).toBeInTheDocument();
      expect(within(screen.getByRole('row', { name: /#5/ })).getByText('Pendiente')).toBeInTheDocument();
      expect(screen.getByText(/5 traslados en curso/)).toBeInTheDocument();
    });

    it('resume varios productos como "Tornillo +1"', async () => {
      useSession('ADMIN');
      stub();
      await renderPage();
      await screen.findByText('#5');
      expect(within(screen.getByRole('row', { name: /#5/ })).getByText('Tornillo +1')).toBeInTheDocument();
    });

    it('el filtro de estado permite ver todos o uno en concreto', async () => {
      useSession('ADMIN');
      stub();
      await renderPage();
      await screen.findByText('#5');
      await chooseOption('Estado del traslado', 'Todos los estados');
      expect(ids()).toHaveLength(6);
      await chooseOption('Estado del traslado', 'Entregado');
      expect(ids()).toEqual(['#9']);
    });

    it('un gerente filtra entrantes y salientes de su sucursal', async () => {
      useSession('MANAGER', 20);
      stub();
      await renderPage();
      await screen.findByText('#5');
      await chooseOption('Estado del traslado', 'Todos los estados');
      await userEvent.click(screen.getByRole('radio', { name: 'Entrantes' }));
      expect(ids()).toEqual(['#5', '#4', '#3', '#2', '#1']); // destino 20
      await userEvent.click(screen.getByRole('radio', { name: 'Salientes' }));
      expect(ids()).toEqual(['#9']); // origen 20
    });

    it('el administrador no ve el filtro de dirección (no tiene sucursal)', async () => {
      useSession('ADMIN');
      stub();
      await renderPage();
      await screen.findByText('#5');
      expect(screen.queryByRole('radio', { name: 'Entrantes' })).not.toBeInTheDocument();
    });

    it('marca "Te toca" en lo que solo quien mira puede avanzar y lo cuenta en el resumen', async () => {
      useSession('MANAGER', 20); // destino de todos los traslados en curso
      stub();
      await renderPage();
      await screen.findByText('#5');
      // Destino: aprobar el pendiente (#5), recibir el que viene en camino (#2) y resolver la novedad (#1).
      for (const id of [5, 2, 1]) expect(within(screen.getByRole('row', { name: new RegExp(`#${id}\\b`) })).getByText('Te toca')).toBeInTheDocument();
      for (const id of [4, 3]) expect(within(screen.getByRole('row', { name: new RegExp(`#${id}\\b`) })).queryByText('Te toca')).not.toBeInTheDocument();
      expect(screen.getByText(/3 esperan tu acción/)).toBeInTheDocument();
    });

    it('sin traslados invita a solicitar el primero', async () => {
      useSession('ADMIN');
      stub([]);
      await renderPage();
      expect(await screen.findByText('No hay traslados en curso')).toBeInTheDocument();
    });

    it('si falla la carga muestra el error en la tabla, sin aviso global', async () => {
      useSession('ADMIN');
      stub();
      server.use(http.get(URL_T, () => HttpResponse.json(apiErrorBody(500, 'INTERNAL_ERROR', 'Falla de prueba'), { status: 500 })));
      await renderPage();
      expect(await screen.findByRole('alert')).toHaveTextContent('Falla de prueba');
      expect(TestBed.inject(NotificationService).items()).toEqual([]);
    });
  });

  describe('filtros', () => {
    const STORE = 'zen:filters:1:transfers';
    const ids = () => screen.queryAllByRole('row').slice(1).map((r) => /#(\d+)/.exec(r.textContent ?? '')?.[1]);
    const openAdvanced = async () => userEvent.click(await screen.findByRole('button', { name: /Más filtros/ }));

    it('busca por número, sede o producto', async () => {
      useSession('ADMIN');
      stub();
      await renderPage();
      await screen.findByText('#5');
      await userEvent.type(screen.getByLabelText('Buscar traslado'), 'tuerca');
      expect(ids().sort()).toEqual(['3', '5']);
    });

    it('filtra por prioridad', async () => {
      useSession('ADMIN');
      stub();
      await renderPage();
      await screen.findByText('#5');
      await chooseOption('Prioridad', 'Alta');
      expect(ids()).toEqual(['5']);
      await userEvent.click(screen.getByRole('button', { name: 'Quitar filtro Prioridad: Alta' }));
      expect(ids().length).toBe(5); // en curso: todos menos el entregado
    });

    it('filtra por sede de origen y de destino y por producto desde «Más filtros»', async () => {
      useSession('ADMIN');
      stub();
      await renderPage();
      await screen.findByText('#5');
      await chooseOption('Estado del traslado', 'Todos los estados');
      await openAdvanced();
      await chooseOption('Sede de origen', 'Sucursal Norte');
      expect(ids()).toEqual(['9']);
      await chooseOption('Sede de origen', 'Todas las sucursales');
      await chooseOption('Sede de destino', 'Sucursal Sur');
      expect(ids()).toEqual(['9']);
      await chooseOption('Sede de destino', 'Todas las sucursales');
      await chooseOption('Producto', 'Tuerca');
      expect(ids().sort()).toEqual(['3', '5']);
      expect(screen.getByLabelText('1 filtro activo')).toBeInTheDocument();
    });

    it('«solo los que esperan mi acción» deja lo que le toca a quien mira', async () => {
      useSession('MANAGER', 20);
      stub();
      await renderPage();
      await screen.findByText('#5');
      await openAdvanced();
      await userEvent.click(screen.getByRole('checkbox', { name: 'Solo los que esperan mi acción' }));
      const mine = ids();
      expect(mine.length).toBeGreaterThan(0);
      expect(mine.length).toBeLessThan(5);
      expect(screen.getByRole('group', { name: 'Filtros aplicados' })).toHaveTextContent('esperan mi acción');
    });

    it('recuerda los filtros la próxima vez que se entra, pero no la búsqueda', async () => {
      useSession('ADMIN');
      stub();
      const first = await renderPage();
      await screen.findByText('#5');
      await chooseOption('Prioridad', 'Alta');
      await openAdvanced();
      await chooseOption('Producto', 'Tornillo');
      await userEvent.type(screen.getByLabelText('Buscar traslado'), '5');
      await vi.waitFor(() => expect(JSON.parse(localStorage.getItem(STORE) ?? '{}')).toMatchObject({ priority: 'HIGH', product: 'Tornillo', advancedOpen: true }));
      first.fixture.destroy();
      TestBed.resetTestingModule(); // otra visita

      await renderPage();
      await screen.findByText('#5');
      expect(screen.getByRole('combobox', { name: 'Prioridad' })).toHaveTextContent('Alta');
      expect(screen.getByRole('combobox', { name: 'Producto' })).toHaveTextContent('Tornillo');
      expect(screen.getByLabelText('Buscar traslado')).toHaveValue('');
      expect(ids()).toEqual(['5']);
    });

    it('un valor guardado dañado se ignora', async () => {
      useSession('ADMIN');
      localStorage.setItem(STORE, JSON.stringify({ status: 'INVENTADO', priority: 3, direction: 'sideways', origin: 'x' }));
      stub();
      await renderPage();
      expect(await screen.findByText('#5')).toBeInTheDocument();
      expect(screen.queryByRole('group', { name: 'Filtros aplicados' })).not.toBeInTheDocument();
    });

    it('el panel abierto no tiene problemas de accesibilidad detectables', async () => {
      useSession('ADMIN');
      stub();
      await renderPage();
      await screen.findByText('#5');
      await openAdvanced();
      await expectAccessible();
    });
  });

  describe('detalle', () => {
    it('muestra el estado, qué sigue, la ruta y los productos con sus cantidades', async () => {
      useSession('ADMIN');
      stub();
      await renderPage();
      const dialog = await openDetail(1);
      expect(within(dialog).getByText('Con novedad')).toBeInTheDocument();
      expect(dialog).toHaveTextContent('Llegó distinto a lo enviado');
      expect(within(dialog).getByRole('row', { name: /Tornillo/ })).toHaveTextContent('Tornillo4422');
    });

    it('un traslado terminado no ofrece ninguna acción', async () => {
      useSession('ADMIN');
      stub();
      await renderPage();
      await chooseOption('Estado del traslado', 'Entregado');
      const dialog = await openDetail(9);
      expect(within(dialog).queryByRole('button', { name: /Aprobar|Autorizar|Despachar|Recibir|Cancelar|Rechazar/ })).not.toBeInTheDocument();
      // "Cerrar" es la X del encabezado y el botón del pie.
      expect(within(dialog).getAllByRole('button', { name: 'Cerrar' }).length).toBeGreaterThan(0);
    });
  });

  describe('acciones de un solo paso', () => {
    it('aprobar en destino llama al servidor, avisa y recarga la lista', async () => {
      useSession('MANAGER', 20);
      let lists = 0;
      let approved = '';
      stub();
      server.use(
        http.get(URL_T, () => (lists++, HttpResponse.json(ALL))),
        http.post(`${URL_T}/:id/approve-destination`, ({ params }) => ((approved = String(params['id'])), HttpResponse.json({ ...T.pending, status: 'APPROVED_DEST' }))),
      );
      await renderPage();
      const dialog = await openDetail(5);
      await userEvent.click(within(dialog).getByRole('button', { name: 'Aprobar' }));
      await vi.waitFor(() => expect(lists).toBe(2));
      expect(approved).toBe('5');
      await vi.waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
      expect(TestBed.inject(NotificationService).items()[0]).toMatchObject({ kind: 'success', message: 'Traslado #5 aprobado.' });
    });

    it('el gerente de origen no ve "Aprobar" en un traslado pendiente', async () => {
      useSession('MANAGER', 10);
      stub();
      await renderPage();
      const dialog = await openDetail(5);
      expect(within(dialog).queryByRole('button', { name: 'Aprobar' })).not.toBeInTheDocument();
    });

    it('autorizar la salida envía los productos del traslado tal cual', async () => {
      useSession('MANAGER', 10);
      stub();
      let body: unknown;
      server.use(http.post(`${URL_T}/4/prepare`, async ({ request }) => ((body = await request.json()), HttpResponse.json({ ...T.approved, status: 'PREPARING' }))));
      await renderPage();
      const dialog = await openDetail(4);
      await userEvent.click(within(dialog).getByRole('button', { name: 'Autorizar salida' }));
      await vi.waitFor(() => expect(body).toEqual({ items: [{ productId: 100, requestedQuantity: 5 }] }));
    });

    it('con una novedad: merma, reclamo y reenvío van a su endpoint', async () => {
      useSession('MANAGER', 20);
      stub();
      const hits: string[] = [];
      server.use(
        http.post(`${URL_T}/1/resolve-shrinkage`, () => (hits.push('shrinkage'), new HttpResponse(null, { status: 200 }))),
        http.post(`${URL_T}/1/resolve-claim`, () => (hits.push('claim'), new HttpResponse(null, { status: 200 }))),
        http.post(`${URL_T}/1/resolve-resend`, () => (hits.push('resend'), new HttpResponse(null, { status: 200 }))),
      );
      await renderPage();
      for (const [name, hit] of [['Aceptar como merma', 'shrinkage'], ['Abrir reclamo', 'claim'], ['Reenviar faltantes', 'resend']] as const) {
        const dialog = await openDetail(1);
        await userEvent.click(within(dialog).getByRole('button', { name }));
        await vi.waitFor(() => expect(hits).toContain(hit));
        await vi.waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
      }
    });

    it('si el servidor rechaza, el error queda en el diálogo (abierto)', async () => {
      useSession('MANAGER', 20);
      stub();
      server.use(http.post(`${URL_T}/5/approve-destination`, () => HttpResponse.json(apiErrorBody(409, 'INVALID_STATE', 'Solo se puede aprobar un traslado pendiente.'), { status: 409 })));
      await renderPage();
      const dialog = await openDetail(5);
      await userEvent.click(within(dialog).getByRole('button', { name: 'Aprobar' }));
      expect(await within(dialog).findByRole('alert')).toHaveTextContent('Solo se puede aprobar');
      expect(screen.getByRole('dialog', { name: 'Traslado #5' })).toBeInTheDocument();
      expect(TestBed.inject(NotificationService).items()).toEqual([]);
    });
  });

  describe('despachar', () => {
    it('envía transportista, costo, guía y las cantidades que salen (pueden ser menos de lo pedido)', async () => {
      useSession('OPERADOR_INVENTARIO', 10);
      stub();
      let body: Record<string, unknown> = {};
      server.use(http.post(`${URL_T}/3/dispatch`, async ({ request }) => ((body = (await request.json()) as Record<string, unknown>), HttpResponse.json({ ...T.preparing, status: 'IN_TRANSIT' }))));
      await renderPage();
      const dialog = await openDetail(3);
      await userEvent.click(within(dialog).getByRole('button', { name: 'Despachar' }));
      await userEvent.type(within(dialog).getByLabelText('Transportista'), 'Servientrega');
      await userEvent.type(within(dialog).getByLabelText('Número de guía (opcional)'), 'ABC123');
      await userEvent.clear(within(dialog).getByLabelText('Costo del envío'));
      await userEvent.type(within(dialog).getByLabelText('Costo del envío'), '15000');
      const tuerca = within(dialog).getByLabelText('Tuerca (pedido: 2)');
      await userEvent.clear(tuerca);
      await userEvent.type(tuerca, '1');
      await userEvent.click(within(dialog).getByRole('button', { name: 'Despachar' }));
      await vi.waitFor(() =>
        expect(body).toEqual({
          carrier: 'Servientrega',
          shippingCost: 15000,
          trackingNumber: 'ABC123',
          items: [{ detailId: 31, sentQuantity: 6 }, { detailId: 32, sentQuantity: 1 }],
        }),
      );
    });

    it('exige el transportista y no deja enviar más de lo pedido', async () => {
      useSession('OPERADOR_INVENTARIO', 10);
      stub();
      let called = false;
      server.use(http.post(`${URL_T}/3/dispatch`, () => ((called = true), HttpResponse.json({}))));
      await renderPage();
      const dialog = await openDetail(3);
      await userEvent.click(within(dialog).getByRole('button', { name: 'Despachar' }));
      const tornillo = within(dialog).getByLabelText('Tornillo (pedido: 6)');
      await userEvent.clear(tornillo);
      await userEvent.type(tornillo, '9');
      await userEvent.click(within(dialog).getByRole('button', { name: 'Despachar' }));
      expect(await within(dialog).findByText('Escribe el nombre del transportista.')).toBeInTheDocument();
      expect(within(dialog).getByText('Es más de lo permitido.')).toBeInTheDocument();
      expect(called).toBe(false);
    });

    it('no se puede despachar con todas las cantidades en cero', async () => {
      useSession('OPERADOR_INVENTARIO', 10);
      stub();
      let called = false;
      server.use(http.post(`${URL_T}/3/dispatch`, () => ((called = true), HttpResponse.json({}))));
      await renderPage();
      const dialog = await openDetail(3);
      await userEvent.click(within(dialog).getByRole('button', { name: 'Despachar' }));
      await userEvent.type(within(dialog).getByLabelText('Transportista'), 'X');
      for (const label of ['Tornillo (pedido: 6)', 'Tuerca (pedido: 2)']) {
        await userEvent.clear(within(dialog).getByLabelText(label));
        await userEvent.type(within(dialog).getByLabelText(label), '0');
      }
      await userEvent.click(within(dialog).getByRole('button', { name: 'Despachar' }));
      expect(await within(dialog).findByRole('alert')).toHaveTextContent('al menos una unidad');
      expect(called).toBe(false);
    });

    it('"Volver" regresa al detalle sin enviar nada', async () => {
      useSession('OPERADOR_INVENTARIO', 10);
      stub();
      await renderPage();
      const dialog = await openDetail(3);
      await userEvent.click(within(dialog).getByRole('button', { name: 'Despachar' }));
      await userEvent.click(within(dialog).getByRole('button', { name: 'Volver' }));
      expect(within(dialog).getByRole('table', { name: 'Productos del traslado' })).toBeInTheDocument();
    });
  });

  describe('recibir', () => {
    it('propone lo enviado, permite recibir menos y envía las notas', async () => {
      useSession('OPERADOR_INVENTARIO', 20);
      stub();
      let body: unknown;
      server.use(http.post(`${URL_T}/2/receive`, async ({ request }) => ((body = await request.json()), HttpResponse.json({ ...T.transit, status: 'WITH_ISSUE' }))));
      await renderPage();
      const dialog = await openDetail(2);
      await userEvent.click(within(dialog).getByRole('button', { name: 'Recibir' }));
      const qty = within(dialog).getByLabelText('Tornillo (enviado: 4)');
      expect(qty).toHaveValue(4);
      await userEvent.clear(qty);
      await userEvent.type(qty, '3');
      await userEvent.type(within(dialog).getByLabelText('Notas de recepción (opcional)'), 'Una caja llegó rota');
      await userEvent.click(within(dialog).getByRole('button', { name: 'Confirmar recepción' }));
      await vi.waitFor(() => expect(body).toEqual({ notes: 'Una caja llegó rota', items: [{ detailId: 21, receivedQuantity: 3 }] }));
    });

    it('no deja recibir más de lo enviado', async () => {
      useSession('OPERADOR_INVENTARIO', 20);
      stub();
      let called = false;
      server.use(http.post(`${URL_T}/2/receive`, () => ((called = true), HttpResponse.json({}))));
      await renderPage();
      const dialog = await openDetail(2);
      await userEvent.click(within(dialog).getByRole('button', { name: 'Recibir' }));
      const qty = within(dialog).getByLabelText('Tornillo (enviado: 4)');
      await userEvent.clear(qty);
      await userEvent.type(qty, '5');
      await userEvent.click(within(dialog).getByRole('button', { name: 'Confirmar recepción' }));
      expect(await within(dialog).findByText('Es más de lo permitido.')).toBeInTheDocument();
      expect(called).toBe(false);
    });

    it('el origen no puede recibir su propio envío', async () => {
      useSession('OPERADOR_INVENTARIO', 10);
      stub();
      await renderPage();
      const dialog = await openDetail(2);
      expect(within(dialog).queryByRole('button', { name: 'Recibir' })).not.toBeInTheDocument();
    });
  });

  describe('cancelar y rechazar', () => {
    it('cancelar exige el motivo y lo envía', async () => {
      useSession('MANAGER', 20);
      stub();
      let body: unknown;
      server.use(http.post(`${URL_T}/5/cancel`, async ({ request }) => ((body = await request.json()), new HttpResponse(null, { status: 204 }))));
      await renderPage();
      const dialog = await openDetail(5);
      await userEvent.click(within(dialog).getByRole('button', { name: 'Cancelar traslado' }));
      await userEvent.click(within(dialog).getByRole('button', { name: 'Cancelar traslado' })); // enviar vacío
      expect(await within(dialog).findByText('Cuéntanos el motivo.')).toBeInTheDocument();
      await userEvent.type(within(dialog).getByLabelText('Motivo de la cancelación'), '  Ya no se necesita ');
      await userEvent.click(within(dialog).getByRole('button', { name: 'Cancelar traslado' }));
      await vi.waitFor(() => expect(body).toEqual({ reason: 'Ya no se necesita' }));
    });

    it('rechazar un traslado en camino explica que la mercancía vuelve al origen', async () => {
      useSession('MANAGER', 20);
      stub();
      let body: unknown;
      server.use(http.post(`${URL_T}/2/reject`, async ({ request }) => ((body = await request.json()), new HttpResponse(null, { status: 204 }))));
      await renderPage();
      const dialog = await openDetail(2);
      await userEvent.click(within(dialog).getByRole('button', { name: 'Rechazar' }));
      expect(dialog).toHaveTextContent('vuelve al inventario de la sucursal de origen');
      await userEvent.type(within(dialog).getByLabelText('Motivo del rechazo'), 'Mercancía equivocada');
      await userEvent.click(within(dialog).getByRole('button', { name: 'Rechazar traslado' }));
      await vi.waitFor(() => expect(body).toEqual({ reason: 'Mercancía equivocada' }));
    });

    it('el operador no ve cancelar ni rechazar', async () => {
      useSession('OPERADOR_INVENTARIO', 20);
      stub();
      await renderPage();
      const dialog = await openDetail(2);
      expect(within(dialog).queryByRole('button', { name: /Cancelar traslado|Rechazar/ })).not.toBeInTheDocument();
    });
  });

  describe('solicitar', () => {
    it('un gerente pide hacia su propia sucursal: el destino queda fijo y no ofrece repetir un producto', async () => {
      useSession('MANAGER', 20);
      stub();
      let body: unknown;
      server.use(http.post(URL_T, async ({ request }) => ((body = await request.json()), HttpResponse.json({ ...T.pending, id: 77 }, { status: 201 }))));
      await renderPage();
      await screen.findByText('#5');
      await userEvent.click(screen.getByRole('button', { name: /Solicitar traslado/ }));
      const dialog = screen.getByRole('dialog', { name: 'Solicitar traslado' });
      expect(dialog).toHaveTextContent('Solo puedes pedir mercancía para tu propia sucursal.');
      await userEvent.click(within(dialog).getByRole('combobox', { name: 'Sucursal que lo envía' }));
      expect(screen.queryByRole('option', { name: 'Sucursal Norte' })).not.toBeInTheDocument(); // el destino no es origen
      expect(screen.queryByRole('option', { name: 'Sucursal Cerrada' })).not.toBeInTheDocument(); // inactiva
      await userEvent.click(screen.getByRole('option', { name: 'Sede Central' }));
      await chooseOption('Producto', 'Tornillo');
      await userEvent.type(within(dialog).getByLabelText('Cantidad'), '6');
      await userEvent.click(within(dialog).getByRole('button', { name: /Agregar producto/ }));
      await userEvent.click(within(dialog).getAllByRole('combobox', { name: /^Producto/ })[1]);
      expect(screen.getByRole('option', { name: /Tornillo/ })).toHaveAttribute('aria-disabled', 'true');
      await userEvent.click(screen.getByRole('option', { name: /Tuerca/ }));
      await userEvent.type(within(dialog).getAllByLabelText('Cantidad')[1], '2');
      await userEvent.click(within(dialog).getByRole('button', { name: 'Solicitar traslado' }));
      await vi.waitFor(() =>
        expect(body).toEqual({
          originBranchId: 10,
          destinationBranchId: 20,
          priority: 'NORMAL',
          items: [{ productId: 100, requestedQuantity: 6 }, { productId: 101, requestedQuantity: 2 }],
        }),
      );
      expect(TestBed.inject(NotificationService).items()[0]).toMatchObject({ message: 'Traslado #77 solicitado.' });
    });

    it('el administrador elige también el destino', async () => {
      useSession('ADMIN');
      stub();
      await renderPage();
      await screen.findByText('#5');
      await userEvent.click(screen.getByRole('button', { name: /Solicitar traslado/ }));
      const dialog = screen.getByRole('dialog', { name: 'Solicitar traslado' });
      expect(dialog).not.toHaveTextContent('Solo puedes pedir mercancía para tu propia sucursal.');
      await chooseOption('Sucursal que lo recibe', 'Sucursal Sur');
    });

    it('sin sucursal, producto ni cantidad no envía y señala cada dato', async () => {
      useSession('MANAGER', 20);
      stub();
      let called = false;
      server.use(http.post(URL_T, () => ((called = true), HttpResponse.json({}))));
      await renderPage();
      await screen.findByText('#5');
      await userEvent.click(screen.getByRole('button', { name: /Solicitar traslado/ }));
      const dialog = screen.getByRole('dialog', { name: 'Solicitar traslado' });
      await userEvent.click(within(dialog).getByRole('button', { name: 'Solicitar traslado' }));
      expect(await within(dialog).findByText('Elige una sucursal.')).toBeInTheDocument();
      expect(within(dialog).getByText('Elige un producto.')).toBeInTheDocument();
      expect(within(dialog).getByText('Escribe la cantidad.')).toBeInTheDocument();
      expect(called).toBe(false);
    });

    it('si el servidor responde sin stock, lo explica dentro del formulario', async () => {
      useSession('MANAGER', 20);
      stub();
      server.use(http.post(URL_T, () => HttpResponse.json(apiErrorBody(422, 'INSUFFICIENT_STOCK', 'Stock insuficiente en la sucursal de origen.'), { status: 422 })));
      await renderPage();
      await screen.findByText('#5');
      await userEvent.click(screen.getByRole('button', { name: /Solicitar traslado/ }));
      const dialog = screen.getByRole('dialog', { name: 'Solicitar traslado' });
      await chooseOption('Sucursal que lo envía', 'Sede Central');
      await chooseOption('Producto', 'Tornillo');
      await userEvent.type(within(dialog).getByLabelText('Cantidad'), '999');
      await userEvent.click(within(dialog).getByRole('button', { name: 'Solicitar traslado' }));
      expect(await within(dialog).findByRole('alert')).toHaveTextContent('Stock insuficiente');
      expect(screen.getByRole('dialog', { name: 'Solicitar traslado' })).toBeInTheDocument();
    });
  });
});
