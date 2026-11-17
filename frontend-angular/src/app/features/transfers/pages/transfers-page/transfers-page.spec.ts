import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap } from '@angular/router';
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
const stockUrl = (branch: number) => `${TEST_API}/api/v1/inventory/branches/${branch}/availability`;

function useSession(rol: string, sucursalId?: number) {
  localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify({ token: 't', email: 'e@z.co', nombre: 'Yo', rol, id: 1, sucursalId }));
}

interface Fixture {
  id: number;
  status: string;
  priority: string;
  originBranchId: number;
  destinationBranchId: number;
  requestDate: string;
  details: { productId: number; productName: string }[];
  freightBalance?: number;
  freightStatus?: string;
}
const OPEN = ['PENDING', 'APPROVED_DEST', 'PREPARING', 'IN_TRANSIT', 'WITH_ISSUE', 'UNDER_CLAIM'];
const session = () => JSON.parse(localStorage.getItem(SESSION_STORAGE_KEY) ?? '{}') as { rol?: string; sucursalId?: number };
/** Lo que el servidor decide con `TransferActionPolicy` (aquí, con el rol y la sucursal de la sesión de la prueba). */
function awaitsMe(t: Fixture): boolean {
  const { rol, sucursalId } = session();
  const admin = rol === 'ADMIN';
  const manager = admin || rol === 'MANAGER';
  const operational = manager || rol === 'OPERADOR_INVENTARIO';
  const origin = admin || sucursalId === t.originBranchId;
  const destination = admin || sucursalId === t.destinationBranchId;
  switch (t.status) {
    case 'PENDING': return manager && destination;
    case 'APPROVED_DEST': return manager && origin;
    case 'PREPARING': return operational && origin;
    case 'IN_TRANSIT': return operational && destination;
    case 'WITH_ISSUE': return manager && (origin || destination);
    default: return false;
  }
}
const branchName = (id: number) => BRANCHES.find((b) => b.id === id)?.nombre ?? '';
const listRow = (t: Fixture) => ({
  id: t.id,
  status: t.status,
  priority: t.priority,
  originId: t.originBranchId,
  originName: branchName(t.originBranchId),
  destinationId: t.destinationBranchId,
  destinationName: branchName(t.destinationBranchId),
  firstProductName: t.details[0]?.productName ?? null,
  productCount: t.details.length,
  freightStatus: t.freightStatus ?? 'SIN_COSTO',
  freightBalance: t.freightBalance ?? 0,
  requestDate: t.requestDate,
  awaitsMe: awaitsMe(t),
});
const listRowOf = (t: unknown) => listRow(t as Fixture);

/** Cada búsqueda que llegó al servidor falso (la última es la que se ve). */
let searches: URLSearchParams[] = [];
const lastSearch = () => searches.at(-1)!;

/**
 * Un servidor falso de traslados: alcance por sucursal, filtros, orden por número y página como el real; resume lo
 * visible y devuelve cada traslado por id.
 */
function stub(transfers: unknown[] = ALL) {
  const current = transfers as Fixture[];
  searches = [];
  const visible = () => {
    const { rol, sucursalId } = session();
    return current.filter((t) => rol === 'ADMIN' || t.originBranchId === sucursalId || t.destinationBranchId === sucursalId);
  };
  server.use(
    http.get(`${URL_T}/search`, ({ request }) => {
      const q = new URL(request.url).searchParams;
      searches.push(q);
      const own = session().sucursalId;
      const status = q.get('status') ?? 'open';
      const flow = q.get('flow') ?? 'all';
      const text = (q.get('q') ?? '').toLowerCase();
      const num = (key: string) => (q.has(key) ? Number(q.get(key)) : null);
      const [origin, destination, product, page, size] = [num('originId'), num('destinationId'), num('productId'), num('page') ?? 0, num('size') ?? 25];
      const rows = visible()
        .filter((t) => (status === 'open' ? OPEN.includes(t.status) : status === 'all' || t.status === status))
        .filter((t) => flow === 'all' || (flow === 'incoming' ? t.destinationBranchId === own : t.originBranchId === own))
        .filter((t) => !q.has('priority') || t.priority === q.get('priority'))
        .filter((t) => (origin === null || t.originBranchId === origin) && (destination === null || t.destinationBranchId === destination))
        .filter((t) => product === null || t.details.some((d) => d.productId === product))
        .filter((t) => q.get('onlyMine') !== 'true' || awaitsMe(t))
        .filter((t) => !text || `${t.id} ${branchName(t.originBranchId)} ${branchName(t.destinationBranchId)} ${t.details.map((d) => d.productName).join(' ')}`.toLowerCase().includes(text))
        .sort((a, b) => b.id - a.id)
        .map(listRow);
      return HttpResponse.json({ content: rows.slice(page * size, page * size + size), totalElements: rows.length, page, size, totalPages: Math.ceil(rows.length / size) });
    }),
    http.get(`${URL_T}/summary`, () => {
      const seen = visible();
      const owed = seen.filter((t) => (t.freightBalance ?? 0) > 0);
      return HttpResponse.json({
        open: seen.filter((t) => OPEN.includes(t.status)).length,
        awaitingMe: seen.filter(awaitsMe).length,
        freightOwed: owed.reduce((sum, t) => sum + (t.freightBalance ?? 0), 0),
        freightOwedCount: owed.length,
      });
    }),
    http.get(`${URL_T}/:id`, ({ params }) => {
      const found = current.find((t) => String(t.id) === params['id']);
      return found ? HttpResponse.json(found) : HttpResponse.json(apiErrorBody(404, 'NOT_FOUND', 'Traslado no encontrado'), { status: 404 });
    }),
    http.get(`${TEST_API}/api/branches`, () => HttpResponse.json(BRANCHES)),
    http.get(`${TEST_API}/api/catalog/products`, () => HttpResponse.json(PRODUCTS)),
    // Lo que cada sucursal tiene disponible para enviar: la Sede Central tiene Tornillo (50) y Tuerca (8); la Sur nada.
    http.get(stockUrl(10), () => HttpResponse.json([{ productId: 100, available: 50 }, { productId: 101, available: 8 }])),
    http.get(stockUrl(30), () => HttpResponse.json([])),
  );
}

const navigate = vi.fn(async () => true);

/** `query`: los parámetros con los que se llega a la pantalla (p. ej. desde el ajuste de stock). */
const renderPage = (query: Record<string, string> = {}) =>
  render(TransfersPage, {
    providers: [
      provideHttpClient(withInterceptors([errorInterceptor])),
      { provide: API_BASE_URL, useValue: TEST_API },
      { provide: ActivatedRoute, useValue: { snapshot: { queryParamMap: convertToParamMap(query) } } },
      { provide: Router, useValue: { navigate } },
    ],
  });

const ids = () => screen.getAllByRole('row').slice(1).map((r) => within(r).getAllByRole('cell')[0]?.textContent?.trim());

/** Abre el detalle del traslado con ese número (la fila es clicable). */
async function openDetail(id: number) {
  await userEvent.click(await screen.findByRole('button', { name: `Ver traslado ${id}` }));
  const dialog = screen.getByRole('dialog', { name: `Traslado #${id}` });
  await vi.waitFor(() => expect(within(dialog).queryByText('Cargando el traslado…')).not.toBeInTheDocument());
  return dialog;
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

    it('el encabezado resume lo que se debe a transportistas y la tabla muestra el estado del flete de cada traslado', async () => {
  useSession('ADMIN');
  stub([
    { ...T.transit, shippingCost: 90000, freightPaid: 30000, freightBalance: 60000, freightStatus: 'PAGO_PARCIAL' },
    { ...T.issue, shippingCost: 40000, freightPaid: 0, freightBalance: 40000, freightStatus: 'POR_PAGAR' },
    { ...T.done, shippingCost: 25000, freightPaid: 25000, freightBalance: 0, freightStatus: 'PAGADO' },
    T.pending,
  ]);
  await renderPage();
  expect(await screen.findByText(/en 2 traslados/)).toBeInTheDocument();
  expect(screen.getByText('$ 100.000')).toBeInTheDocument();
  expect(screen.getByText('Flete con abono')).toBeInTheDocument();
  expect(screen.getByText('Flete por pagar')).toBeInTheDocument();
  expect(screen.getByText('Saldo $ 60.000')).toBeInTheDocument();
  // Un traslado sin envío no muestra flete.
  expect(screen.queryByText('Sin flete')).not.toBeInTheDocument();
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
      await vi.waitFor(() => expect(ids()).toHaveLength(6));
      expect(lastSearch().get('status')).toBe('all');
      await chooseOption('Estado del traslado', 'Entregado');
      await vi.waitFor(() => expect(ids()).toEqual(['#9']));
      expect(lastSearch().get('status')).toBe('DELIVERED');
    });

    it('un gerente filtra entrantes y salientes de su sucursal', async () => {
      useSession('MANAGER', 20);
      stub();
      await renderPage();
      await screen.findByText('#5');
      await chooseOption('Estado del traslado', 'Todos los estados');
      await userEvent.click(screen.getByRole('radio', { name: 'Entrantes' }));
      await vi.waitFor(() => expect(ids()).toEqual(['#5', '#4', '#3', '#2', '#1'])); // destino 20
      expect(lastSearch().get('flow')).toBe('incoming');
      await userEvent.click(screen.getByRole('radio', { name: 'Salientes' }));
      await vi.waitFor(() => expect(ids()).toEqual(['#9'])); // origen 20
      expect(lastSearch().get('flow')).toBe('outgoing');
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

    it('pide al servidor la primera página en curso, del más nuevo al más viejo', async () => {
      useSession('MANAGER', 20);
      stub();
      await renderPage();
      await screen.findByText('#5');
      expect(Object.fromEntries(lastSearch())).toEqual({ page: '0', size: '10', sortBy: 'id', direction: 'desc', status: 'open', flow: 'all' });
    });

    it('con más traslados que una página, «Página siguiente» pide la siguiente', async () => {
      useSession('ADMIN');
      stub(Array.from({ length: 12 }, (_, i) => ({ ...T.pending, id: i + 1 })));
      await renderPage();
      await screen.findByText('#12');
      expect(ids()).toHaveLength(10);
      await userEvent.click(screen.getByRole('button', { name: 'Página siguiente' }));
      await vi.waitFor(() => expect(ids()).toEqual(['#2', '#1']));
      expect(lastSearch().get('page')).toBe('1');
    });

    it('ordenar por una columna lo pide al servidor', async () => {
      useSession('ADMIN');
      stub();
      await renderPage();
      await screen.findByText('#5');
      await userEvent.click(screen.getByRole('button', { name: /Ruta/ }));
      await vi.waitFor(() => expect(lastSearch().get('sortBy')).toBe('route'));
      expect(lastSearch().get('direction')).toBe('asc');
    });

    it('«Te toca» lo decide el servidor, no la pantalla', async () => {
      useSession('MANAGER', 20);
      stub();
      server.use(
        http.get(`${URL_T}/search`, () =>
          HttpResponse.json({ content: [{ ...listRowOf(T.approved), awaitsMe: true }, { ...listRowOf(T.pending), awaitsMe: false }], totalElements: 2 }),
        ),
      );
      await renderPage();
      await screen.findByText('#5');
      expect(within(screen.getByRole('row', { name: /#4\b/ })).getByText('Te toca')).toBeInTheDocument();
      expect(within(screen.getByRole('row', { name: /#5\b/ })).queryByText('Te toca')).not.toBeInTheDocument();
    });

    it('el encabezado viene de /summary: cuenta todo lo visible, no solo la página', async () => {
      useSession('ADMIN');
      stub();
      server.use(http.get(`${URL_T}/summary`, () => HttpResponse.json({ open: 37, awaitingMe: 6, freightOwed: 450000, freightOwedCount: 9 })));
      await renderPage();
      expect(await screen.findByText(/37 traslados en curso, 6 esperan tu acción/)).toBeInTheDocument();
      expect(screen.getByText(/en 9 traslados/)).toHaveTextContent('450.000');
    });

    it('exportar trae del servidor todo lo filtrado, no solo la página', async () => {
      useSession('ADMIN');
      stub(Array.from({ length: 12 }, (_, i) => ({ ...T.pending, id: i + 1 })));
      let csv = '';
      vi.spyOn(URL, 'createObjectURL').mockImplementation((blob: Blob | MediaSource) => (void (blob as Blob).text().then((t) => (csv = t)), 'blob:csv'));
      vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
      vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
      await renderPage();
      await screen.findByText('#12');
      await userEvent.click(screen.getByRole('button', { name: /Exportar CSV/ }));
      await vi.waitFor(() => expect(csv.trim().split('\n')).toHaveLength(13)); // encabezado + 12 traslados
      expect(lastSearch().get('size')).toBe('100');
      vi.restoreAllMocks();
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
      server.use(http.get(`${URL_T}/search`, () => HttpResponse.json(apiErrorBody(500, 'INTERNAL_ERROR', 'Falla de prueba'), { status: 500 })));
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
      const before = searches.length;
      await userEvent.type(screen.getByLabelText('Buscar traslado'), 'tuerca');
      await vi.waitFor(() => expect(ids().sort()).toEqual(['3', '5']));
      expect(searches.length).toBe(before + 1); // una sola búsqueda, al dejar de escribir
      expect(lastSearch().get('q')).toBe('tuerca');
    });

    it('filtra por prioridad', async () => {
      useSession('ADMIN');
      stub();
      await renderPage();
      await screen.findByText('#5');
      await chooseOption('Prioridad', 'Alta');
      await vi.waitFor(() => expect(ids()).toEqual(['5']));
      expect(lastSearch().get('priority')).toBe('HIGH');
      await userEvent.click(screen.getByRole('button', { name: 'Quitar filtro Prioridad: Alta' }));
      await vi.waitFor(() => expect(ids().length).toBe(5)); // en curso: todos menos el entregado
    });

    it('filtra por sede de origen y de destino y por producto desde «Más filtros»', async () => {
      useSession('ADMIN');
      stub();
      await renderPage();
      await screen.findByText('#5');
      await chooseOption('Estado del traslado', 'Todos los estados');
      await openAdvanced();
      await chooseOption('Sede de origen', 'Sucursal Norte');
      await vi.waitFor(() => expect(ids()).toEqual(['9']));
      expect(lastSearch().get('originId')).toBe('20');
      await chooseOption('Sede de origen', 'Todas las sucursales');
      await chooseOption('Sede de destino', 'Sucursal Sur');
      await vi.waitFor(() => expect(ids()).toEqual(['9']));
      expect(lastSearch().get('destinationId')).toBe('30');
      await chooseOption('Sede de destino', 'Todas las sucursales');
      await chooseOption('Producto', 'Tuerca');
      await vi.waitFor(() => expect(ids().sort()).toEqual(['3', '5']));
      expect(lastSearch().get('productId')).toBe('101'); // por id, no por nombre
      expect(screen.getByLabelText('1 filtro activo')).toBeInTheDocument();
    });

    it('«solo los que esperan mi acción» deja lo que le toca a quien mira', async () => {
      useSession('MANAGER', 20);
      stub();
      await renderPage();
      await screen.findByText('#5');
      await openAdvanced();
      await userEvent.click(screen.getByRole('checkbox', { name: 'Solo los que esperan mi acción' }));
      await vi.waitFor(() => expect(ids().sort()).toEqual(['1', '2', '5']));
      expect(lastSearch().get('onlyMine')).toBe('true');
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
      await vi.waitFor(() => expect(JSON.parse(localStorage.getItem(STORE) ?? '{}')).toMatchObject({ priority: 'HIGH', productId: 100, advancedOpen: true }));
      first.fixture.destroy();
      TestBed.resetTestingModule(); // otra visita

      await renderPage();
      await screen.findByText('#5');
      expect(screen.getByRole('combobox', { name: 'Prioridad' })).toHaveTextContent('Alta');
      await vi.waitFor(() => expect(screen.getByRole('combobox', { name: 'Producto' })).toHaveTextContent('Tornillo'));
      expect(screen.getByLabelText('Buscar traslado')).toHaveValue('');
      await vi.waitFor(() => expect(ids()).toEqual(['5']));
    });

    it('un filtro de producto guardado por nombre (formato anterior) se descarta', async () => {
      useSession('ADMIN');
      localStorage.setItem(STORE, JSON.stringify({ product: 'Tuerca' }));
      stub();
      await renderPage();
      await screen.findByText('#5');
      expect(lastSearch().has('productId')).toBe(false);
      expect(screen.queryByRole('group', { name: 'Filtros aplicados' })).not.toBeInTheDocument();
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

    it('abrir un traslado pide su detalle completo al servidor', async () => {
      useSession('ADMIN');
      stub();
      const asked: string[] = [];
      server.use(http.get(`${URL_T}/5`, () => (asked.push('5'), HttpResponse.json(T.pending))));
      await renderPage();
      const dialog = await openDetail(5);
      expect(asked).toEqual(['5']);
      expect(within(dialog).getByText('Tuerca')).toBeInTheDocument();
    });

    it('si el detalle no carga, el diálogo muestra el error y la lista sigue', async () => {
      useSession('ADMIN');
      stub();
      server.use(http.get(`${URL_T}/4`, () => HttpResponse.json(apiErrorBody(500, 'INTERNAL_ERROR', 'No se pudo leer el traslado'), { status: 500 })));
      await renderPage();
      await userEvent.click(await screen.findByRole('button', { name: 'Ver traslado 4' }));
      const dialog = screen.getByRole('dialog', { name: 'Traslado #4' });
      expect(await within(dialog).findByText('No se pudo leer el traslado')).toBeInTheDocument();
      expect(TestBed.inject(NotificationService).items()).toEqual([]);
      expect(ids()).toHaveLength(5);
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
      let approved = '';
      stub();
      server.use(
        http.post(`${URL_T}/:id/approve-destination`, ({ params }) => ((approved = String(params['id'])), HttpResponse.json({ ...T.pending, status: 'APPROVED_DEST' }))),
      );
      await renderPage();
      const dialog = await openDetail(5);
      const before = searches.length;
      await userEvent.click(within(dialog).getByRole('button', { name: 'Aprobar' }));
      await vi.waitFor(() => expect(searches.length).toBe(before + 1));
      expect(approved).toBe('5');
      await vi.waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
      expect(TestBed.inject(NotificationService).confirmation()).toMatchObject({
        title: 'Traslado #5 aprobado',
        summary: 'El traslado se aprobó correctamente.',
        detail: 'Ahora la sucursal de origen puede autorizar la salida y preparar el envío.',
      });
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
    it('desde «Traslado recibido» abre la solicitud con esa sucursal como destino y conserva el producto', async () => {
      useSession('ADMIN');
      stub();
      navigate.mockClear();
      await renderPage({ nuevo: '1', producto: '101', sucursal: '20', lado: 'destino' });
      const dialog = await screen.findByRole('dialog', { name: 'Solicitar traslado' });
      await vi.waitFor(() => expect(within(dialog).getByRole('combobox', { name: 'Sucursal que lo recibe' })).toHaveTextContent('Sucursal Norte'));
      // El producto se ve al elegir de dónde viene: solo entonces se sabe si esa sucursal lo tiene.
      await chooseOption('Sucursal que lo envía', 'Sede Central');
      await vi.waitFor(() => expect(within(dialog).getByRole('combobox', { name: 'Producto' })).toHaveTextContent('Tuerca'));
      await vi.waitFor(() => expect(navigate).toHaveBeenCalledWith([], expect.objectContaining({ queryParams: expect.objectContaining({ nuevo: null, lado: null }), replaceUrl: true })));
    });

    it('desde «Traslado enviado» abre la solicitud con esa sucursal como origen y el producto elegido', async () => {
      useSession('ADMIN');
      stub();
      await renderPage({ nuevo: '1', producto: '100', sucursal: '10', lado: 'origen' });
      const dialog = await screen.findByRole('dialog', { name: 'Solicitar traslado' });
      await vi.waitFor(() => expect(within(dialog).getByRole('combobox', { name: 'Sucursal que lo envía' })).toHaveTextContent('Sede Central'));
      await vi.waitFor(() => expect(within(dialog).getByRole('combobox', { name: 'Producto' })).toHaveTextContent('Tornillo'));
    });

    it('quien no es ADMIN pide para su sucursal: si el origen sería la misma, se deja por elegir', async () => {
      useSession('MANAGER', 20);
      stub();
      await renderPage({ nuevo: '1', producto: '100', sucursal: '20', lado: 'origen' });
      const dialog = await screen.findByRole('dialog', { name: 'Solicitar traslado' });
      expect(within(dialog).getByRole('combobox', { name: 'Sucursal que lo envía' })).not.toHaveTextContent('Sucursal Norte');
      await chooseOption('Sucursal que lo envía', 'Sede Central');
      await vi.waitFor(() => expect(within(dialog).getByRole('combobox', { name: 'Producto' })).toHaveTextContent('Tornillo'));
    });

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
      await vi.waitFor(() => expect(within(dialog).getByRole('combobox', { name: 'Producto' })).toBeEnabled());
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
      expect(TestBed.inject(NotificationService).confirmation()).toMatchObject({
        title: 'Traslado #77 solicitado',
        summary: 'La solicitud de traslado se registró correctamente.',
        detail: 'Lo pedido queda reservado en la sucursal de origen hasta que lo autorice y lo despache.',
      });
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

    it('sin origen no se puede elegir producto; al elegirlo solo salen los que tiene disponibles, con su cantidad', async () => {
      useSession('MANAGER', 20);
      stub();
      server.use(
        http.get(`${TEST_API}/api/branches`, () => HttpResponse.json(BRANCHES)),
        http.get(`${TEST_API}/api/catalog/products`, () => HttpResponse.json([...PRODUCTS, { id: 102, sku: 'ARA-3', nombre: 'Arandela' }])),
        http.get(stockUrl(10), () => HttpResponse.json([{ productId: 100, available: 50 }, { productId: 101, available: 8 }])), // Arandela no tiene
      );
      await renderPage();
      await screen.findByText('#5');
      await userEvent.click(screen.getByRole('button', { name: /Solicitar traslado/ }));
      const dialog = screen.getByRole('dialog', { name: 'Solicitar traslado' });
      const product = within(dialog).getByRole('combobox', { name: 'Producto' });
      expect(product).toBeDisabled();
      expect(product).toHaveTextContent('Elige primero la sucursal que lo envía');
      await chooseOption('Sucursal que lo envía', 'Sede Central');
      await vi.waitFor(() => expect(within(dialog).getByRole('combobox', { name: 'Producto' })).toBeEnabled());
      await userEvent.click(within(dialog).getByRole('combobox', { name: 'Producto' }));
      const options = screen.getAllByRole('option').map((o) => o.textContent?.replace(/\s+/g, ' ').trim());
      expect(options).toHaveLength(2);
      expect(options[0]).toContain('Tornillo');
      expect(options[0]).toContain('50 disponibles');
      expect(options[1]).toContain('Tuerca');
      expect(options[1]).toContain('8 disponibles');
      expect(screen.queryByRole('option', { name: /Arandela/ })).not.toBeInTheDocument();
    });

    it('un origen sin existencias lo avisa y no ofrece productos', async () => {
      useSession('MANAGER', 20);
      stub();
      await renderPage();
      await screen.findByText('#5');
      await userEvent.click(screen.getByRole('button', { name: /Solicitar traslado/ }));
      const dialog = screen.getByRole('dialog', { name: 'Solicitar traslado' });
      await chooseOption('Sucursal que lo envía', 'Sucursal Sur');
      expect(await within(dialog).findByText('Esa sucursal no tiene productos disponibles para enviar.')).toBeInTheDocument();
      await userEvent.click(within(dialog).getByRole('combobox', { name: 'Producto' }));
      expect(screen.queryAllByRole('option')).toHaveLength(0);
    });

    it('al cambiar de origen se suelta el producto que el nuevo origen no tiene', async () => {
      useSession('ADMIN');
      stub();
      server.use(
        http.get(`${TEST_API}/api/branches`, () => HttpResponse.json(BRANCHES)),
        http.get(`${TEST_API}/api/catalog/products`, () => HttpResponse.json(PRODUCTS)),
        http.get(stockUrl(10), () => HttpResponse.json([{ productId: 100, available: 50 }, { productId: 101, available: 8 }])),
        http.get(stockUrl(30), () => HttpResponse.json([{ productId: 101, available: 3 }])),
      );
      await renderPage();
      await screen.findByText('#5');
      await userEvent.click(screen.getByRole('button', { name: /Solicitar traslado/ }));
      const dialog = screen.getByRole('dialog', { name: 'Solicitar traslado' });
      await chooseOption('Sucursal que lo recibe', 'Sucursal Norte');
      await chooseOption('Sucursal que lo envía', 'Sede Central');
      await vi.waitFor(() => expect(within(dialog).getByRole('combobox', { name: 'Producto' })).toBeEnabled());
      await chooseOption('Producto', 'Tornillo');
      expect(within(dialog).getByRole('combobox', { name: 'Producto' })).toHaveTextContent('Tornillo');
      await chooseOption('Sucursal que lo envía', 'Sucursal Sur');
      await vi.waitFor(() => expect(within(dialog).getByRole('combobox', { name: 'Producto' })).not.toHaveTextContent('Tornillo'));
    });

    it('no deja pedir más de lo disponible en el origen y lo dice', async () => {
      useSession('MANAGER', 20);
      stub();
      let called = false;
      server.use(http.post(URL_T, () => ((called = true), HttpResponse.json({}))));
      await renderPage();
      await screen.findByText('#5');
      await userEvent.click(screen.getByRole('button', { name: /Solicitar traslado/ }));
      const dialog = screen.getByRole('dialog', { name: 'Solicitar traslado' });
      await chooseOption('Sucursal que lo envía', 'Sede Central');
      await vi.waitFor(() => expect(within(dialog).getByRole('combobox', { name: 'Producto' })).toBeEnabled());
      await chooseOption('Producto', 'Tuerca');
      await userEvent.type(within(dialog).getByLabelText('Cantidad'), '9');
      await userEvent.click(within(dialog).getByRole('button', { name: 'Solicitar traslado' }));
      expect(await within(dialog).findByText('Solo hay 8 disponibles en el origen.')).toBeInTheDocument();
      expect(called).toBe(false);
    });

    it('si no se puede consultar la existencia del origen, ofrece todos los productos y avisa', async () => {
      useSession('MANAGER', 20);
      stub();
      server.use(http.get(stockUrl(10), () => HttpResponse.json(apiErrorBody(500, 'INTERNAL_ERROR', 'Falla'), { status: 500 })));
      await renderPage();
      await screen.findByText('#5');
      await userEvent.click(screen.getByRole('button', { name: /Solicitar traslado/ }));
      const dialog = screen.getByRole('dialog', { name: 'Solicitar traslado' });
      await chooseOption('Sucursal que lo envía', 'Sede Central');
      expect(await within(dialog).findByText(/No se pudo consultar lo disponible en el origen/)).toBeInTheDocument();
      await userEvent.click(within(dialog).getByRole('combobox', { name: 'Producto' }));
      expect(screen.getAllByRole('option')).toHaveLength(2);
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
      await vi.waitFor(() => expect(within(dialog).getByRole('combobox', { name: 'Producto' })).toBeEnabled());
      await chooseOption('Producto', 'Tornillo');
      await userEvent.type(within(dialog).getByLabelText('Cantidad'), '49'); // dentro de lo disponible (50): el rechazo lo decide el servidor
      await userEvent.click(within(dialog).getByRole('button', { name: 'Solicitar traslado' }));
      expect(await within(dialog).findByRole('alert')).toHaveTextContent('Stock insuficiente');
      expect(screen.getByRole('dialog', { name: 'Solicitar traslado' })).toBeInTheDocument();
    });
  });
});
