import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { render, screen, within } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { API_BASE_URL } from '@core/api/api-base-url';
import { errorInterceptor } from '@core/api/error.interceptor';
import { NotificationService } from '@core/notifications/notification.service';
import { SESSION_STORAGE_KEY } from '@core/auth/session/auth-store';
import { chooseOption } from '@testing/select-helpers';
import { apiErrorBody, server, TEST_API } from '@testing/msw-server';
import { expectAccessible } from '@testing/a11y';
import { AuditPage } from './audit-page';

/** Un movimiento tal como lo devuelve el servidor: ya trae los nombres. */
const movement = (id: number, extra: object = {}) => ({
  id,
  type: 'INGRESO',
  reason: 'COMPRA',
  quantity: 10,
  date: `2026-10-${String(10 + id).padStart(2, '0')}T09:30:00`,
  productId: 1,
  productName: 'Tornillo',
  branchId: 10,
  branchName: 'Sede Central',
  userId: 7,
  userName: 'Luis Pérez',
  referenceId: 40 + id,
  referenceType: 'COMPRA',
  observations: '',
  finalBalance: 100,
  ...extra,
});

/** Lo que manda el servidor, ya ordenado (el más reciente primero). */
const MOVEMENTS = [
  movement(4, { type: 'INGRESO', reason: 'AJUSTE_POSITIVO', quantity: 5, referenceType: '', referenceId: null, userId: null, userName: null }),
  movement(3, { type: 'RETIRO', reason: 'MERMA', quantity: 2, subReason: 'CADUCIDAD', referenceType: '', referenceId: null, observations: 'Cajas vencidas en bodega', productId: 2, productName: 'Tuerca' }),
  movement(2, { type: 'RETIRO', reason: 'VENTA', quantity: 3, referenceType: 'VENTA', productId: 2, productName: 'Tuerca', branchId: 20, branchName: 'Sucursal Norte', userId: 8, userName: 'Sofía Díaz', finalBalance: 47 }),
  movement(1),
];
const BRANCHES = [
  { id: 10, nombre: 'Sede Central', activa: true },
  { id: 20, nombre: 'Sucursal Norte', activa: true },
];
const PRODUCTS = [
  { id: 1, sku: 'TOR-1', nombre: 'Tornillo', precioVenta: 1, unitAbbreviation: 'UND', activo: true, proveedores: [] },
  { id: 2, sku: 'TUE-2', nombre: 'Tuerca', precioVenta: 1, unitAbbreviation: 'UND', activo: true, proveedores: [] },
];
const USERS = [
  { id: 7, nombre: 'Luis Pérez', email: 'luis@z.co' },
  { id: 8, nombre: 'Sofía Díaz', email: 'sofia@z.co' },
];
const URL_SEARCH = `${TEST_API}/api/v1/inventory/movements/search`;
const URL_EXPORT = `${TEST_API}/api/v1/inventory/movements/export`;

interface PageReply {
  content?: unknown[];
  totalElements?: number;
  totalIn?: number;
  totalOut?: number;
}

/** Cada búsqueda que pidió la pantalla, en orden (sus parámetros). */
let requests: URLSearchParams[] = [];
const last = () => requests.at(-1)!;

function stub(reply: PageReply = {}, users: 'ok' | 403 = 'ok') {
  const content = reply.content ?? MOVEMENTS;
  server.use(
    http.get(URL_SEARCH, ({ request }) => {
      requests.push(new URL(request.url).searchParams);
      return HttpResponse.json({
        content,
        totalElements: reply.totalElements ?? content.length,
        page: 0,
        size: 15,
        totalPages: 1,
        totalIn: reply.totalIn ?? 15,
        totalOut: reply.totalOut ?? 5,
      });
    }),
    http.get(`${TEST_API}/api/branches`, () => HttpResponse.json(BRANCHES)),
    http.get(`${TEST_API}/api/catalog/products`, () => HttpResponse.json(PRODUCTS)),
    http.get(`${TEST_API}/api/users`, () => (users === 403 ? HttpResponse.json(apiErrorBody(403, 'ACCESS_DENIED', 'Sin acceso'), { status: 403 }) : HttpResponse.json(USERS))),
  );
}

const renderPage = () =>
  render(AuditPage, { providers: [provideHttpClient(withInterceptors([errorInterceptor])), { provide: API_BASE_URL, useValue: TEST_API }] });

/** Columna "Producto" (tercera) de cada fila, en el orden mostrado. */
const products = () => screen.getAllByRole('row').slice(1).map((r) => within(r).getAllByRole('cell')[2]?.textContent?.trim());

/** Espera a que la última búsqueda tenga estos parámetros. */
const expectLastSearch = (params: Record<string, string | null>) =>
  vi.waitFor(() => {
    for (const [key, value] of Object.entries(params)) expect(last().get(key)).toBe(value);
  });

describe('AuditPage', () => {
  beforeEach(() => {
    localStorage.clear();
    requests = [];
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  describe('lista', () => {
    it('no tiene problemas de accesibilidad detectables', async () => {
      stub();
      await renderPage();
      await vi.waitFor(() => expect(screen.getAllByRole('row').length).toBeGreaterThan(1));
      await expectAccessible();
    });

    it('pide al servidor solo la primera página, del más reciente al más antiguo', async () => {
      stub();
      await renderPage();
      await expectLastSearch({ page: '0', size: '15', sortBy: 'date', direction: 'desc' });
      // Sin filtros no se manda ninguno.
      for (const key of ['branchId', 'type', 'reason', 'from', 'to', 'productId', 'userId', 'q', 'onlyObserved']) expect(last().has(key)).toBe(false);
    });

    it('muestra los movimientos con los nombres que trae el servidor, en su orden', async () => {
      stub();
      await renderPage();
      expect((await screen.findAllByRole('row', { name: /Tuerca/ })).length).toBeGreaterThan(0);
      expect(screen.getByRole('heading', { level: 1, name: 'Auditoría global' })).toBeInTheDocument();
      expect(products()).toEqual(['Tornillo', 'Tuerca', 'Tuerca', 'Tornillo']);
      const sale = screen.getByRole('row', { name: /Venta #42/ });
      expect(within(sale).getByText('Sucursal Norte')).toBeInTheDocument();
      expect(within(sale).getByText('Sofía Díaz')).toBeInTheDocument();
      expect(within(sale).getByText('−3')).toBeInTheDocument();
      expect(within(sale).getByText('Retiro')).toBeInTheDocument();
    });

    it('descarta un movimiento con un motivo que la app no conoce (no lo muestra con un rótulo roto)', async () => {
      stub({ content: [...MOVEMENTS, movement(9, { reason: 'MOTIVO_NUEVO' })] });
      await renderPage();
      await screen.findAllByRole('row', { name: /Tuerca/ });
      expect(products()).toHaveLength(MOVEMENTS.length);
    });

    it('un ajuste sin documento ni responsable se ve como tal', async () => {
      stub();
      await renderPage();
      const adjust = await screen.findByRole('row', { name: /Ajuste \(\+\)/ });
      expect(within(adjust).getByText('Sistema')).toBeInTheDocument();
      expect(within(adjust).getAllByText('—').length).toBeGreaterThan(0); // sin documento
    });

    it('una merma muestra su categoría', async () => {
      stub();
      await renderPage();
      const row = await screen.findByRole('row', { name: /Merma/ });
      expect(within(row).getByText('Caducidad')).toBeInTheDocument();
    });

    it('el resumen es de todo lo filtrado (lo calcula el servidor), no solo de la página', async () => {
      stub({ totalElements: 51, totalIn: 120, totalOut: 30 });
      await renderPage();
      expect(await screen.findByText('51 movimientos: entraron 120 unidades y salieron 30')).toBeInTheDocument();
    });

    it('si no se pueden leer los usuarios (403), la tabla igual muestra los nombres (vienen con cada movimiento)', async () => {
      stub({}, 403);
      await renderPage();
      expect(await screen.findByText('Sofía Díaz')).toBeInTheDocument();
    });

    it('sin movimientos explica de dónde saldrán', async () => {
      stub({ content: [] });
      await renderPage();
      expect(await screen.findByText('Todavía no hay movimientos')).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /Exportar CSV/ })).not.toBeInTheDocument(); // nada que exportar
    });

    it('si falla la carga muestra el error en la tabla, sin aviso global', async () => {
      stub();
      server.use(http.get(URL_SEARCH, () => HttpResponse.json(apiErrorBody(500, 'INTERNAL_ERROR', 'Falla de prueba'), { status: 500 })));
      await renderPage();
      expect(await screen.findByRole('alert')).toHaveTextContent('Falla de prueba');
      expect(TestBed.inject(NotificationService).items()).toEqual([]);
    });
  });

  describe('páginas y orden', () => {
    it('con más filas que una página, «Página siguiente» pide la siguiente al servidor', async () => {
      stub({ totalElements: 40 });
      await renderPage();
      await screen.findAllByRole('row', { name: /Tuerca/ });
      await userEvent.click(screen.getByRole('button', { name: 'Página siguiente' }));
      await expectLastSearch({ page: '1' });
    });

    it('ordenar por una columna lo pide al servidor con su campo', async () => {
      stub();
      await renderPage();
      await screen.findAllByRole('row', { name: /Tuerca/ });
      await userEvent.click(screen.getByRole('button', { name: /Cantidad/ }));
      await expectLastSearch({ sortBy: 'quantity', direction: 'asc' });
      await userEvent.click(screen.getByRole('button', { name: /Cantidad/ }));
      await expectLastSearch({ sortBy: 'quantity', direction: 'desc' });
    });

    it('cambiar un filtro vuelve a la primera página', async () => {
      stub({ totalElements: 40 });
      await renderPage();
      await screen.findAllByRole('row', { name: /Tuerca/ });
      await userEvent.click(screen.getByRole('button', { name: 'Página siguiente' }));
      await expectLastSearch({ page: '1' });
      await chooseOption('Motivo', 'Merma');
      await expectLastSearch({ page: '0', reason: 'MERMA' });
    });
  });

  describe('filtros', () => {
    it('sucursal, tipo y motivo se mandan al servidor', async () => {
      stub();
      await renderPage();
      await screen.findAllByRole('row', { name: /Tuerca/ });
      await chooseOption('Sucursal', 'Sucursal Norte');
      await chooseOption('Tipo de movimiento', 'Solo retiros');
      await chooseOption('Motivo', 'Merma');
      await expectLastSearch({ branchId: '20', type: 'RETIRO', reason: 'MERMA' });
    });

    it('el rango de fechas se manda como días locales (el servidor incluye el día «Hasta» completo)', async () => {
      // El calendario abre en el mes en curso: sin fijar el reloj, el 12 de octubre deja de verse al pasar de mes.
      vi.useFakeTimers({ toFake: ['Date'] });
      vi.setSystemTime(new Date(2026, 9, 20, 10, 0));
      stub();
      await renderPage();
      await screen.findAllByRole('row', { name: /Tuerca/ });
      await userEvent.click(screen.getByRole('button', { name: 'Desde' }));
      await userEvent.click(screen.getByRole('button', { name: /12 de octubre de 2026/ }));
      await userEvent.click(screen.getByRole('button', { name: 'Hasta' }));
      await userEvent.click(screen.getByRole('button', { name: /13 de octubre de 2026/ }));
      await expectLastSearch({ from: '2026-10-12', to: '2026-10-13' });
    });

    it('la búsqueda se manda una vez, al dejar de escribir, sin espacios sobrantes', async () => {
      stub();
      await renderPage();
      await screen.findAllByRole('row', { name: /Tuerca/ });
      const before = requests.length;
      await userEvent.type(screen.getByRole('searchbox', { name: 'Buscar movimiento' }), ' sofía ');
      await expectLastSearch({ q: 'sofía' });
      expect(requests.length).toBe(before + 1); // no una petición por letra
    });

    it('"Quitar filtros" aparece solo con filtros y los restablece', async () => {
      stub();
      await renderPage();
      await screen.findAllByRole('row', { name: /Tuerca/ });
      expect(screen.queryByRole('button', { name: 'Quitar filtros' })).not.toBeInTheDocument();
      await chooseOption('Motivo', 'Venta');
      await expectLastSearch({ reason: 'VENTA' });
      await userEvent.click(screen.getByRole('button', { name: 'Quitar filtros' }));
      await expectLastSearch({ reason: null });
      expect(screen.queryByRole('button', { name: 'Quitar filtros' })).not.toBeInTheDocument();
    });

    it('una combinación sin resultados lo dice (no es "sin movimientos")', async () => {
      stub();
      await renderPage();
      await screen.findAllByRole('row', { name: /Tuerca/ });
      stub({ content: [] });
      await chooseOption('Motivo', 'Devolución');
      expect(await screen.findByText('Ningún movimiento coincide')).toBeInTheDocument();
    });

    describe('avanzados', () => {
      const STORE = 'zen:filters:1:audit';
      const login = () => localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify({ token: 't', email: 'e@z.co', nombre: 'Yo', rol: 'ADMIN', id: 1 }));
      const openAdvanced = async () => userEvent.click(await screen.findByRole('button', { name: /Más filtros/ }));

      it('producto y responsable se mandan por id; también cantidad y «solo con observaciones»', async () => {
        stub();
        await renderPage();
        await screen.findAllByRole('row', { name: /Tuerca/ });
        await openAdvanced();
        await chooseOption('Producto', 'Tuerca');
        await chooseOption('Responsable', 'Sofía Díaz');
        await userEvent.type(screen.getByLabelText('Cantidad desde'), '4');
        await userEvent.type(screen.getByLabelText('Cantidad hasta'), '6');
        await userEvent.click(screen.getByRole('checkbox', { name: 'Solo con observaciones' }));
        await expectLastSearch({ productId: '2', userId: '8', minQuantity: '4', maxQuantity: '6', onlyObserved: 'true' });
        expect(screen.getByLabelText('5 filtros activos')).toBeInTheDocument();
      });

      it('las etiquetas de filtros aplicados se quitan una a una y muestran nombres, no ids', async () => {
        stub();
        await renderPage();
        await screen.findAllByRole('row', { name: /Tuerca/ });
        await openAdvanced();
        await chooseOption('Producto', 'Tuerca');
        await chooseOption('Motivo', 'Merma');
        await userEvent.click(screen.getByRole('button', { name: 'Quitar filtro Producto: Tuerca' }));
        await expectLastSearch({ productId: null, reason: 'MERMA' });
      });

      it('recuerda los filtros la próxima vez que se entra, también los del panel abierto', async () => {
        login();
        stub();
        const first = await renderPage();
        await screen.findAllByRole('row', { name: /Tuerca/ });
        await chooseOption('Sucursal', 'Sucursal Norte');
        await openAdvanced();
        await chooseOption('Producto', 'Tuerca');
        await vi.waitFor(() => expect(JSON.parse(localStorage.getItem(STORE) ?? '{}')).toMatchObject({ branch: 20, productId: 2, advancedOpen: true }));
        first.fixture.destroy();
        TestBed.resetTestingModule(); // otra visita
        requests = [];

        await renderPage();
        await vi.waitFor(() => expect(screen.getByRole('combobox', { name: 'Sucursal' })).toHaveTextContent('Sucursal Norte'));
        await vi.waitFor(() => expect(screen.getByRole('combobox', { name: 'Producto' })).toHaveTextContent('Tuerca'));
        expect(requests[0].get('branchId')).toBe('20'); // la primera petición ya va filtrada
        expect(requests[0].get('productId')).toBe('2');
      });

      it('un producto recordado que ya no existe se ve como etiqueta con su número y se quita', async () => {
        login();
        localStorage.setItem(STORE, JSON.stringify({ productId: 99 }));
        stub();
        await renderPage();
        await expectLastSearch({ productId: '99' });
        await userEvent.click(await screen.findByRole('button', { name: 'Quitar filtro Producto: Producto 99' }));
        await expectLastSearch({ productId: null });
        expect(localStorage.getItem(STORE)).toBeNull();
      });

      it('el panel abierto no tiene problemas de accesibilidad detectables', async () => {
        stub();
        await renderPage();
        await screen.findAllByRole('row', { name: /Tuerca/ });
        await openAdvanced();
        await expectAccessible();
      });
    });
  });

  describe('pestañas', () => {
    it('«Inicios de sesión» muestra los intentos de entrar al sistema y se recuerda', async () => {
      localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify({ token: 't', email: 'e@z.co', nombre: 'Yo', rol: 'ADMIN', id: 1 }));
      stub();
      server.use(
        http.get(`${TEST_API}/api/v1/audit/logins`, () =>
          HttpResponse.json({ content: [{ id: 1, date: '2026-11-08T21:00:00', email: 'ana@x.co', userId: 7, userName: 'Ana Ruiz', outcome: 'EXITOSO', ip: '10.0.0.5' }], totalElements: 1, failures: 0 }),
        ),
      );
      const first = await renderPage();
      await screen.findAllByRole('row', { name: /Tuerca/ });
      await userEvent.click(screen.getByRole('tab', { name: 'Inicios de sesión' }));
      expect(await screen.findByRole('row', { name: /ana@x\.co/ })).toBeInTheDocument();
      expect(screen.queryByRole('searchbox', { name: 'Buscar movimiento' })).not.toBeInTheDocument();
      first.fixture.destroy();
      TestBed.resetTestingModule();

      await renderPage(); // otra visita: abre en la misma pestaña
      expect(await screen.findByRole('row', { name: /ana@x\.co/ })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: 'Inicios de sesión' })).toHaveAttribute('aria-selected', 'true');
    });
  });

  describe('detalle', () => {
    it('muestra todo el movimiento, con las observaciones completas', async () => {
      stub();
      await renderPage();
      await userEvent.click(await screen.findByRole('button', { name: 'Ver movimiento 3' }));
      const dialog = screen.getByRole('dialog', { name: 'Movimiento #3' });
      expect(dialog).toHaveTextContent('Cajas vencidas en bodega');
      expect(dialog).toHaveTextContent('Merma');
      expect(dialog).toHaveTextContent('Caducidad');
      expect(dialog).toHaveTextContent('Ajuste manual (sin documento)');
      expect(dialog).toHaveTextContent('−2');
    });

    it('sin observaciones lo dice', async () => {
      stub();
      await renderPage();
      await userEvent.click(await screen.findByRole('button', { name: 'Ver movimiento 1' }));
      expect(screen.getByRole('dialog', { name: 'Movimiento #1' })).toHaveTextContent('Sin observaciones.');
    });
  });

  describe('exportar', () => {
    function captureDownload() {
      const captured: { blob: Blob | null; name: string } = { blob: null, name: '' };
      URL.createObjectURL = vi.fn((blob: Blob) => ((captured.blob = blob), 'blob:csv'));
      URL.revokeObjectURL = vi.fn();
      vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
        captured.name = this.download;
      });
      return captured;
    }

    it('descarga TODO lo filtrado (no solo la página), con cantidades con signo y nombres', async () => {
      stub({ totalElements: 40 });
      let exportParams: URLSearchParams | null = null;
      // El servidor manda para exportar dos mermas: más de las que se ven en la página.
      server.use(
        http.get(URL_EXPORT, ({ request }) => {
          exportParams = new URL(request.url).searchParams;
          return HttpResponse.json([MOVEMENTS[1], movement(7, { type: 'RETIRO', reason: 'MERMA', quantity: 1, productName: 'Arandela' })]);
        }),
      );
      const captured = captureDownload();
      await renderPage();
      await screen.findAllByRole('row', { name: /Tuerca/ });
      await chooseOption('Motivo', 'Merma');
      await expectLastSearch({ reason: 'MERMA' });
      await userEvent.click(screen.getByRole('button', { name: /Exportar CSV/ }));
      await vi.waitFor(() => expect(captured.name).toMatch(/^auditoria-\d{4}-\d{2}-\d{2}\.csv$/));
      expect(exportParams!.get('reason')).toBe('MERMA');
      expect(exportParams!.has('page')).toBe(false); // sin paginar
      const lines = ((await captured.blob?.text()) ?? '').replace('﻿', '').split('\r\n');
      expect(lines[0]).toBe('Fecha,Sucursal,Producto,Tipo,Motivo,Submotivo,Cantidad,Saldo,Responsable,Documento,Observaciones');
      expect(lines).toHaveLength(3); // encabezado + las dos mermas
      expect(lines[1]).toContain('Sede Central,Tuerca,Retiro,Merma,Caducidad,-2,100,Luis Pérez');
      expect(lines[1]).toContain('Cajas vencidas en bodega');
      expect(lines[2]).toContain('Arandela');
    });

    it('si exportar falla, lo avisa y no descarga nada', async () => {
      stub();
      server.use(http.get(URL_EXPORT, () => HttpResponse.json(apiErrorBody(500, 'INTERNAL_ERROR', 'Falla de prueba'), { status: 500 })));
      const captured = captureDownload();
      await renderPage();
      await screen.findAllByRole('row', { name: /Tuerca/ });
      await userEvent.click(screen.getByRole('button', { name: /Exportar CSV/ }));
      await vi.waitFor(() => expect(TestBed.inject(NotificationService).items()[0]?.message).toContain('No se pudo exportar'));
      expect(captured.name).toBe('');
    });
  });
});
