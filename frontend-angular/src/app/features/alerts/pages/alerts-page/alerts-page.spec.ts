import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { render, screen, within } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { signal } from '@angular/core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AlertCount } from '@core/alerts/alert-count';
import { API_BASE_URL } from '@core/api/api-base-url';
import { errorInterceptor } from '@core/api/error.interceptor';
import { SESSION_STORAGE_KEY } from '@core/auth/session/auth-store';
import { NotificationService } from '@core/notifications/notification.service';
import { chooseOption } from '@testing/select-helpers';
import { apiErrorBody, server, TEST_API } from '@testing/msw-server';
import { expectAccessible } from '@testing/a11y';
import { AlertsPage } from './alerts-page';

const ALERTS = [
  { id: 1, branchId: 10, productId: 100, message: 'Stock bajo: quedan 2 de 10', alertDate: '2026-10-15T08:00:00', resolved: false, type: 'LOW_STOCK' },
  { id: 2, branchId: 20, productId: 101, message: 'Venta #55 anulada', alertDate: '2026-10-16T09:30:00', resolved: false, type: 'VOID_SALE' },
  { id: 3, branchId: 10, productId: 101, message: 'Compra sugerida', alertDate: '2026-10-14T07:00:00', resolved: false, type: 'PURCHASE_REQUEST' },
];
const ALERTS_URL = `${TEST_API}/api/v1/alerts`;

function useSession(rol: string) {
  localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify({ token: 't', email: 'e@z.co', nombre: 'Yo', rol, id: 1, sucursalId: rol === 'ADMIN' ? undefined : 10 }));
}

function stub(alerts: unknown[] = ALERTS) {
  server.use(
    http.get(ALERTS_URL, () => HttpResponse.json(alerts)),
    http.get(`${TEST_API}/api/catalog/products`, () =>
      HttpResponse.json([
        { id: 100, sku: 'TOR-1', nombre: 'Tornillo' },
        { id: 101, sku: 'TUE-2', nombre: 'Tuerca' },
      ]),
    ),
    http.get(`${TEST_API}/api/branches`, () =>
      HttpResponse.json([
        { id: 10, nombre: 'Sede Central', activa: true },
        { id: 20, nombre: 'Sucursal Norte', activa: true },
        { id: 30, nombre: 'Sucursal Sur', activa: false },
      ]),
    ),
    http.get(`${TEST_API}/api/catalog/suppliers/search`, () =>
      HttpResponse.json([
        { id: 7, nombre: 'Aceros del Sur', tiempoEntregaDias: 4 },
        { id: 8, nombre: 'Ferretería Central', tiempoEntregaDias: 2 },
      ]),
    ),
  );
}

// La insignia del menú tiene su propia prueba: aquí se aísla para contar solo las peticiones de la pantalla.
const refreshBadge = vi.fn();

const renderPage = () =>
  render(AlertsPage, {
    providers: [
      provideHttpClient(withInterceptors([errorInterceptor])),
      { provide: API_BASE_URL, useValue: TEST_API },
      { provide: AlertCount, useValue: { count: signal(0).asReadonly(), refresh: refreshBadge } },
    ],
  });

const products = () => screen.getAllByRole('row').slice(1).map((r) => within(r).getAllByRole('cell')[1]?.textContent?.trim());

describe('AlertsPage', () => {
  beforeEach(() => {
    localStorage.clear();
    refreshBadge.mockClear();
  });
  afterEach(() => localStorage.clear());

  describe('lista', () => {
    it('no tiene problemas de accesibilidad detectables', async () => {
      useSession('ADMIN');
      stub();
      await renderPage();
      await vi.waitFor(() => expect(screen.getAllByRole('row').length).toBeGreaterThan(1));
      await expectAccessible();
    });

    it('muestra las alertas con su tipo (en texto), producto por nombre y la más reciente primero', async () => {
      useSession('ADMIN');
      stub();
      await renderPage();
      expect(await screen.findByText('Venta anulada')).toBeInTheDocument();
      expect(screen.getByRole('heading', { level: 1, name: 'Alertas' })).toBeInTheDocument();
      expect(screen.getByText('3 alertas activas')).toBeInTheDocument();
      expect(screen.getByText('Stock bajo')).toBeInTheDocument();
      expect(screen.getByText('Compra sugerida', { selector: 'app-badge' })).toBeInTheDocument();
      // Más reciente primero: la del 16, luego la del 15, luego la del 14.
      expect(products()).toEqual(['Tuerca', 'Tornillo', 'Tuerca']);
    });

    it('el ADMIN ve la columna de sucursal; el gerente no', async () => {
      useSession('ADMIN');
      stub();
      await renderPage();
      await screen.findByText('Venta anulada');
      expect(screen.getByRole('columnheader', { name: 'Sucursal' })).toBeInTheDocument();
      expect(screen.getAllByText('Sucursal Norte').length).toBeGreaterThan(0);
    });

    it('un gerente no ve la columna de sucursal ni el botón de revisar stock', async () => {
      useSession('MANAGER');
      stub();
      await renderPage();
      await screen.findByText('Venta anulada');
      expect(screen.queryByRole('columnheader', { name: 'Sucursal' })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /Revisar stock/ })).not.toBeInTheDocument();
    });

    it('sin alertas explica que todo está en orden', async () => {
      useSession('ADMIN');
      stub([]);
      await renderPage();
      expect(await screen.findByText('No hay alertas activas')).toBeInTheDocument();
      expect(screen.getByText('0 alertas activas')).toBeInTheDocument();
    });

    it('filtra por tipo y solo ofrece los tipos presentes', async () => {
      useSession('ADMIN');
      stub();
      await renderPage();
      await screen.findByText('Venta anulada');
      await userEvent.click(screen.getByRole('combobox', { name: 'Tipo de alerta' }));
      expect(screen.queryByRole('option', { name: 'Devolución' })).not.toBeInTheDocument();
      await userEvent.click(screen.getByRole('option', { name: 'Venta anulada' }));
      expect(products()).toEqual(['Tuerca']);
    });

    it('el ADMIN filtra por sucursal: pide al servidor solo esa sucursal', async () => {
      useSession('ADMIN');
      stub();
      const requested: (string | null)[] = [];
      server.use(
        http.get(ALERTS_URL, ({ request }) => {
          requested.push(new URL(request.url).searchParams.get('branchId'));
          return HttpResponse.json(ALERTS);
        }),
      );
      await renderPage();
      await screen.findByText('Venta anulada');
      await chooseOption('Sucursal', 'Sucursal Norte');
      await vi.waitFor(() => expect(requested).toEqual([null, '20']));
    });

    it('si la respuesta de una sucursal anterior llega tarde, no pisa la de la elegida', async () => {
      useSession('ADMIN');
      stub();
      let release: () => void = () => undefined;
      const gate = new Promise<void>((resolve) => (release = resolve));
      server.use(
        http.get(ALERTS_URL, async ({ request }) => {
          if (new URL(request.url).searchParams.get('branchId') === '20') {
            await gate; // la respuesta de «Sucursal Norte» tarda
            return HttpResponse.json([ALERTS[1]]);
          }
          return HttpResponse.json(ALERTS);
        }),
      );
      await renderPage();
      await screen.findByText('Stock bajo: quedan 2 de 10');
      await chooseOption('Sucursal', 'Sucursal Norte');
      await chooseOption('Sucursal', 'Todas las sucursales');
      await screen.findByText('Stock bajo: quedan 2 de 10');
      release();
      await new Promise((resolve) => setTimeout(resolve, 50));
      expect(screen.getByText('Stock bajo: quedan 2 de 10')).toBeInTheDocument();
      expect(screen.getByText('Venta #55 anulada')).toBeInTheDocument();
    });

    it('si falla la carga muestra el error en la tabla, sin aviso global', async () => {
      useSession('ADMIN');
      stub();
      server.use(http.get(ALERTS_URL, () => HttpResponse.json(apiErrorBody(500, 'INTERNAL_ERROR', 'Falla de prueba'), { status: 500 })));
      await renderPage();
      expect(await screen.findByRole('alert')).toHaveTextContent('Falla de prueba');
      expect(TestBed.inject(NotificationService).items()).toEqual([]);
    });

    it('si no cargan los nombres de producto muestra el código en su lugar', async () => {
      useSession('ADMIN');
      stub();
      server.use(http.get(`${TEST_API}/api/catalog/products`, () => HttpResponse.json(apiErrorBody(500, 'INTERNAL_ERROR', 'x'), { status: 500 })));
      await renderPage();
      expect(await screen.findAllByText('Producto 101')).not.toHaveLength(0);
    });
  });

  describe('revisar stock (ADMIN)', () => {
    it('lanza la revisión, avisa y recarga la lista', async () => {
      useSession('ADMIN');
      stub();
      let scans = 0;
      let lists = 0;
      server.use(
        http.get(ALERTS_URL, () => (lists++, HttpResponse.json(ALERTS))),
        http.post(`${ALERTS_URL}/scan`, () => (scans++, HttpResponse.json({ message: 'ok' }))),
      );
      await renderPage();
      await screen.findByText('Venta anulada');
      await userEvent.click(screen.getByRole('button', { name: /Revisar stock/ }));
      await vi.waitFor(() => expect(lists).toBe(2));
      expect(scans).toBe(1);
      expect(refreshBadge).toHaveBeenCalledTimes(1); // la insignia del menú se actualiza
      expect(TestBed.inject(NotificationService).items()[0]).toMatchObject({ kind: 'success', message: 'Revisión de stock completada.' });
    });
  });

  describe('filtros', () => {
    const STORE = 'zen:filters:1:alerts';
    const openAdvanced = async () => userEvent.click(await screen.findByRole('button', { name: /Más filtros/ }));

    it('busca por producto o por detalle', async () => {
      useSession('ADMIN');
      stub();
      await renderPage();
      await screen.findByText('Venta anulada');
      await userEvent.type(screen.getByLabelText('Buscar alerta'), 'sugerida');
      expect(products()).toEqual(['Tuerca']); // «Compra sugerida»
      await userEvent.clear(screen.getByLabelText('Buscar alerta'));
      await userEvent.type(screen.getByLabelText('Buscar alerta'), 'tornillo');
      expect(products()).toEqual(['Tornillo']);
    });

    it('filtra por producto desde «Más filtros» y por rango de fechas recordado', async () => {
      useSession('ADMIN');
      stub();
      await renderPage();
      await screen.findByText('Venta anulada');
      await openAdvanced();
      await chooseOption('Producto', 'Tuerca');
      expect(products()).toEqual(['Tuerca', 'Tuerca']);
      expect(screen.getByLabelText('1 filtro activo')).toBeInTheDocument();
    });

    it('un rango de fechas guardado se aplica y se ve como etiqueta', async () => {
      useSession('ADMIN');
      localStorage.setItem(STORE, JSON.stringify({ from: new Date(2026, 9, 15).toISOString(), to: new Date(2026, 9, 16).toISOString() }));
      stub();
      await renderPage();
      await screen.findByText('Venta anulada');
      expect(products().sort()).toEqual(['Tornillo', 'Tuerca']); // 15 y 16 de octubre; la del 14 queda fuera
      expect(screen.getByRole('group', { name: 'Filtros aplicados' })).toHaveTextContent('Desde:');
    });

    it('las etiquetas se quitan una a una y todas juntas', async () => {
      useSession('ADMIN');
      stub();
      await renderPage();
      await screen.findByText('Venta anulada');
      await chooseOption('Tipo de alerta', 'Stock bajo');
      expect(products()).toEqual(['Tornillo']);
      await userEvent.click(screen.getByRole('button', { name: 'Quitar filtro Tipo: Stock bajo' }));
      expect(products()).toHaveLength(3);
      await chooseOption('Tipo de alerta', 'Stock bajo');
      await userEvent.click(screen.getByRole('button', { name: 'Quitar filtros' }));
      expect(products()).toHaveLength(3);
    });

    it('la sucursal recordada se pide al servidor desde la primera carga', async () => {
      useSession('ADMIN');
      localStorage.setItem(STORE, JSON.stringify({ branch: 20 }));
      const requested: (string | null)[] = [];
      stub();
      server.use(http.get(ALERTS_URL, ({ request }) => (requested.push(new URL(request.url).searchParams.get('branchId')), HttpResponse.json(ALERTS))));
      await renderPage();
      await screen.findByText('Venta anulada');
      expect(requested[0]).toBe('20');
    });

    it('recuerda los filtros la próxima vez que se entra, pero no la búsqueda', async () => {
      useSession('ADMIN');
      stub();
      const first = await renderPage();
      await screen.findByText('Venta anulada');
      await chooseOption('Tipo de alerta', 'Compra sugerida');
      await openAdvanced();
      await chooseOption('Producto', 'Tuerca');
      await userEvent.type(screen.getByLabelText('Buscar alerta'), 'x');
      await vi.waitFor(() => expect(JSON.parse(localStorage.getItem(STORE) ?? '{}')).toMatchObject({ type: 'PURCHASE_REQUEST', product: 'Tuerca', advancedOpen: true }));
      first.fixture.destroy();
      TestBed.resetTestingModule(); // otra visita

      await renderPage();
      await vi.waitFor(() => expect(products()).toEqual(['Tuerca']));
      expect(screen.getByLabelText('Buscar alerta')).toHaveValue('');
      expect(products()).toEqual(['Tuerca']);
    });

    it('un valor guardado dañado se ignora', async () => {
      useSession('ADMIN');
      localStorage.setItem(STORE, JSON.stringify({ type: 'INVENTADO', from: 'nada', branch: 'x' }));
      stub();
      await renderPage();
      expect(await screen.findByText('Venta anulada')).toBeInTheDocument();
      expect(screen.queryByRole('group', { name: 'Filtros aplicados' })).not.toBeInTheDocument();
    });

    it('el panel abierto no tiene problemas de accesibilidad detectables', async () => {
      useSession('ADMIN');
      stub();
      await renderPage();
      await screen.findByText('Venta anulada');
      await openAdvanced();
      await expectAccessible();
    });
  });

  describe('permisos del botón Resolver', () => {
    it('el gerente puede resolver cualquier alerta', async () => {
      useSession('MANAGER');
      stub();
      await renderPage();
      await screen.findByText('Venta anulada');
      expect(screen.getAllByRole('button', { name: /^Resolver alerta/ })).toHaveLength(3);
    });

    it('el operador de inventario solo resuelve alertas de stock', async () => {
      useSession('OPERADOR_INVENTARIO');
      stub();
      await renderPage();
      await screen.findByText('Venta anulada');
      expect(screen.getAllByRole('button', { name: /^Resolver alerta/ })).toHaveLength(2);
      expect(within(screen.getByRole('row', { name: /Venta anulada/ })).queryByRole('button')).not.toBeInTheDocument();
    });
  });

  describe('resolver', () => {
    const open = async (name: string) => {
      await screen.findByText('Venta anulada');
      await userEvent.click(screen.getAllByRole('button', { name })[0]);
      return screen.getByRole('dialog', { name: 'Resolver alerta' });
    };

    it('el diálogo de resolver no tiene problemas de accesibilidad en ninguna de sus pestañas', async () => {
      useSession('MANAGER');
      stub();
      await renderPage();
      const dialog = await open('Resolver alerta de Tornillo');
      await expectAccessible(dialog);
      for (const tab of within(dialog).getAllByRole('tab')) {
        await userEvent.click(tab);
        await expectAccessible(dialog);
      }
    });

    it('pidiendo a otra sucursal: no ofrece la propia ni las inactivas y envía la solicitud', async () => {
      useSession('MANAGER');
      stub();
      let body: unknown;
      let lists = 0;
      server.use(
        http.get(ALERTS_URL, () => (lists++, HttpResponse.json(ALERTS))),
        http.post(`${ALERTS_URL}/1/resolve/transfer`, async ({ request }) => ((body = await request.json()), HttpResponse.json({ message: 'ok' }))),
      );
      await renderPage();
      const dialog = await open('Resolver alerta de Tornillo');
      expect(dialog).toHaveTextContent('Tornillo');
      await userEvent.click(within(dialog).getByRole('combobox', { name: 'Sucursal que lo envía' }));
      expect(screen.queryByRole('option', { name: 'Sede Central' })).not.toBeInTheDocument(); // la propia
      expect(screen.queryByRole('option', { name: /Sucursal Sur/ })).not.toBeInTheDocument(); // inactiva
      await userEvent.click(screen.getByRole('option', { name: 'Sucursal Norte' }));
      await userEvent.type(within(dialog).getByLabelText('Cantidad'), '5');
      await userEvent.click(within(dialog).getByRole('button', { name: 'Solicitar traslado' }));
      await vi.waitFor(() => expect(body).toEqual({ originBranchId: 20, quantity: 5, priority: 'NORMAL' }));
      await vi.waitFor(() => expect(lists).toBe(2));
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      expect(refreshBadge).toHaveBeenCalledTimes(1);
      expect(TestBed.inject(NotificationService).items()[0]).toMatchObject({ kind: 'success' });
    });

    it('exige sucursal y una cantidad entera mayor que 0', async () => {
      useSession('MANAGER');
      stub();
      let called = false;
      server.use(http.post(`${ALERTS_URL}/1/resolve/transfer`, () => ((called = true), HttpResponse.json({}))));
      await renderPage();
      const dialog = await open('Resolver alerta de Tornillo');
      await userEvent.type(within(dialog).getByLabelText('Cantidad'), '2.5');
      await userEvent.click(within(dialog).getByRole('button', { name: 'Solicitar traslado' }));
      expect(await within(dialog).findByText('Elige la sucursal que enviará el stock.')).toBeInTheDocument();
      expect(within(dialog).getByText('Debe ser un número entero.')).toBeInTheDocument();
      expect(called).toBe(false);
    });

    it('comprando: propone la entrega del proveedor y crea la orden', async () => {
      useSession('MANAGER');
      stub();
      let body: unknown;
      server.use(http.post(`${ALERTS_URL}/1/resolve/purchase`, async ({ request }) => ((body = await request.json()), HttpResponse.json({ message: 'ok' }))));
      await renderPage();
      const dialog = await open('Resolver alerta de Tornillo');
      await userEvent.click(within(dialog).getByRole('tab', { name: 'Comprar' }));
      await chooseOption('Proveedor', 'Aceros del Sur');
      expect(within(dialog).getByLabelText('Tiempo de entrega (días)')).toHaveValue(4);
      await userEvent.type(within(dialog).getByLabelText('Cantidad'), '12.5');
      await userEvent.click(within(dialog).getByRole('button', { name: 'Crear orden de compra' }));
      await vi.waitFor(() => expect(body).toEqual({ supplierId: 7, quantity: 12.5, leadTimeDays: 4 }));
    });

    it('descartando: el motivo "Otro" pide que lo cuentes y se envía el texto', async () => {
      useSession('MANAGER');
      stub();
      let body: unknown;
      server.use(http.post(`${ALERTS_URL}/1/resolve/dismiss`, async ({ request }) => ((body = await request.json()), HttpResponse.json({ message: 'ok' }))));
      await renderPage();
      const dialog = await open('Resolver alerta de Tornillo');
      await userEvent.click(within(dialog).getByRole('tab', { name: 'Descartar' }));
      await chooseOption('Motivo', 'Otro motivo');
      await userEvent.click(within(dialog).getByRole('button', { name: 'Descartar alerta' }));
      expect(await within(dialog).findByText('Cuéntanos el motivo.')).toBeInTheDocument();
      await userEvent.type(within(dialog).getByLabelText('¿Cuál?'), 'Producto dañado');
      await userEvent.click(within(dialog).getByRole('button', { name: 'Descartar alerta' }));
      await vi.waitFor(() => expect(body).toEqual({ reason: 'Producto dañado' }));
    });

    it('el operador de inventario no ve la pestaña de descartar', async () => {
      useSession('OPERADOR_INVENTARIO');
      stub();
      await renderPage();
      const dialog = await open('Resolver alerta de Tornillo');
      expect(within(dialog).getByRole('tab', { name: 'Comprar' })).toBeInTheDocument();
      expect(within(dialog).queryByRole('tab', { name: 'Descartar' })).not.toBeInTheDocument();
    });

    it('una alerta que no es de stock solo se marca como resuelta', async () => {
      useSession('MANAGER');
      stub();
      let patched = '';
      server.use(http.patch(`${ALERTS_URL}/:id/resolve`, ({ params }) => ((patched = String(params['id'])), HttpResponse.json({ message: 'ok' }))));
      await renderPage();
      await screen.findByText('Venta anulada');
      await userEvent.click(within(screen.getByRole('row', { name: /Venta anulada/ })).getByRole('button', { name: 'Resolver alerta de Tuerca' }));
      const dialog = screen.getByRole('dialog', { name: 'Resolver alerta' });
      expect(within(dialog).queryByRole('tab')).not.toBeInTheDocument();
      await userEvent.click(within(dialog).getByRole('button', { name: 'Marcar como resuelta' }));
      await vi.waitFor(() => expect(patched).toBe('2'));
    });

    it('si el servidor rechaza, el error queda en el diálogo (abierto) y sin aviso global', async () => {
      useSession('MANAGER');
      stub();
      server.use(http.post(`${ALERTS_URL}/1/resolve/transfer`, () => HttpResponse.json(apiErrorBody(409, 'INSUFFICIENT_STOCK', 'La sucursal de origen no tiene stock suficiente.'), { status: 409 })));
      await renderPage();
      const dialog = await open('Resolver alerta de Tornillo');
      await chooseOption('Sucursal que lo envía', 'Sucursal Norte');
      await userEvent.type(within(dialog).getByLabelText('Cantidad'), '5');
      await userEvent.click(within(dialog).getByRole('button', { name: 'Solicitar traslado' }));
      expect(await within(dialog).findByRole('alert')).toHaveTextContent('no tiene stock suficiente');
      expect(screen.getByRole('dialog', { name: 'Resolver alerta' })).toBeInTheDocument();
      expect(TestBed.inject(NotificationService).items()).toEqual([]);
    });

    it('al reabrir otra alerta el formulario parte de cero', async () => {
      useSession('MANAGER');
      stub();
      await renderPage();
      const dialog = await open('Resolver alerta de Tornillo');
      await userEvent.type(within(dialog).getByLabelText('Cantidad'), '9');
      await userEvent.click(within(dialog).getByRole('button', { name: 'Cancelar' }));
      await userEvent.click(screen.getAllByRole('button', { name: 'Resolver alerta de Tuerca' })[1]);
      expect(within(screen.getByRole('dialog', { name: 'Resolver alerta' })).getByLabelText('Cantidad')).toHaveValue(null);
    });
  });
});
