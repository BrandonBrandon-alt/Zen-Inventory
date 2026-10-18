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

const movement = (id: number, extra: object = {}) => ({
  id,
  type: 'INGRESO',
  reason: 'COMPRA',
  quantity: 10,
  date: `2026-10-${String(10 + id).padStart(2, '0')}T09:30:00`,
  productId: 1,
  branchId: 10,
  userId: 7,
  referenceId: 40 + id,
  referenceType: 'COMPRA',
  observations: '',
  finalBalance: 100,
  ...extra,
});

const MOVEMENTS = [
  movement(1),
  movement(2, { type: 'RETIRO', reason: 'VENTA', quantity: 3, referenceType: 'VENTA', productId: 2, branchId: 20, userId: 8, finalBalance: 47 }),
  movement(3, { type: 'RETIRO', reason: 'MERMA', quantity: 2, subReason: 'CADUCIDAD', referenceType: '', referenceId: null, observations: 'Cajas vencidas en bodega', productId: 2 }),
  movement(4, { type: 'INGRESO', reason: 'AJUSTE_POSITIVO', quantity: 5, referenceType: '', referenceId: null, userId: null }),
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
const URL_M = `${TEST_API}/api/v1/inventory/movements`;

function stub(movements: unknown[] = MOVEMENTS, users: 'ok' | 403 = 'ok') {
  server.use(
    http.get(URL_M, () => HttpResponse.json(movements)),
    http.get(`${TEST_API}/api/branches`, () => HttpResponse.json(BRANCHES)),
    http.get(`${TEST_API}/api/catalog/products`, () => HttpResponse.json(PRODUCTS)),
    http.get(`${TEST_API}/api/users`, () => (users === 403 ? HttpResponse.json(apiErrorBody(403, 'ACCESS_DENIED', 'Sin acceso'), { status: 403 }) : HttpResponse.json(USERS))),
  );
}

const renderPage = () =>
  render(AuditPage, { providers: [provideHttpClient(withInterceptors([errorInterceptor])), { provide: API_BASE_URL, useValue: TEST_API }] });

/** Columna "Producto" (tercera) de cada fila, en el orden mostrado. */
const products = () => screen.getAllByRole('row').slice(1).map((r) => within(r).getAllByRole('cell')[2]?.textContent?.trim());

describe('AuditPage', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => vi.restoreAllMocks());

  describe('lista', () => {
    it('no tiene problemas de accesibilidad detectables', async () => {
      stub();
      await renderPage();
      await vi.waitFor(() => expect(screen.getAllByRole('row').length).toBeGreaterThan(1));
      await expectAccessible();
    });

    it('muestra los movimientos de todas las sucursales, el más reciente primero, con nombres en lugar de códigos', async () => {
      stub();
      await renderPage();
      expect((await screen.findAllByRole('row', { name: /Tuerca/ })).length).toBeGreaterThan(0);
      expect(screen.getByRole('heading', { level: 1, name: 'Auditoría global' })).toBeInTheDocument();
      expect(products()).toEqual(['Tornillo', 'Tuerca', 'Tuerca', 'Tornillo']); // por fecha: #4, #3, #2, #1
      const sale = screen.getByRole('row', { name: /Venta #42/ });
      expect(within(sale).getByText('Sucursal Norte')).toBeInTheDocument();
      expect(within(sale).getByText('Sofía Díaz')).toBeInTheDocument();
      expect(within(sale).getByText('−3')).toBeInTheDocument();
      expect(within(sale).getByText('Retiro')).toBeInTheDocument();
    });

    describe('filtros avanzados', () => {
      const STORE = 'zen:filters:1:audit';
      const login = () => localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify({ token: 't', email: 'e@z.co', nombre: 'Yo', rol: 'ADMIN', id: 1 }));
      const openAdvanced = async () => userEvent.click(await screen.findByRole('button', { name: /Más filtros/ }));

      it('filtra por producto, por responsable, por rango de cantidad y por observaciones', async () => {
        stub();
        await renderPage();
        await screen.findAllByRole('row', { name: /Tuerca/ });
        await openAdvanced();
        await chooseOption('Producto', 'Tuerca');
        expect(products()).toEqual(['Tuerca', 'Tuerca']);
        await chooseOption('Producto', 'Todos los productos');
        await chooseOption('Responsable', 'Sofía Díaz');
        expect(products()).toEqual(['Tuerca']);
        await chooseOption('Responsable', 'Todos los responsables');
        await userEvent.type(screen.getByLabelText('Cantidad desde'), '4');
        await userEvent.type(screen.getByLabelText('Cantidad hasta'), '6');
        expect(products()).toEqual(['Tornillo']); // solo el ajuste de 5
        await userEvent.clear(screen.getByLabelText('Cantidad desde'));
        await userEvent.clear(screen.getByLabelText('Cantidad hasta'));
        await userEvent.click(screen.getByRole('checkbox', { name: 'Solo con observaciones' }));
        expect(screen.getAllByRole('row').slice(1)).toHaveLength(1);
        expect(screen.getByRole('row', { name: /Merma/ })).toBeInTheDocument();
        expect(screen.getByLabelText('1 filtro activo')).toBeInTheDocument();
      });

      it('las etiquetas de filtros aplicados se quitan una a una y todas juntas', async () => {
        stub();
        await renderPage();
        await screen.findAllByRole('row', { name: /Tuerca/ });
        await chooseOption('Tipo de movimiento', 'Solo retiros');
        await chooseOption('Motivo', 'Merma');
        expect(products()).toEqual(['Tuerca']);
        await userEvent.click(screen.getByRole('button', { name: 'Quitar filtro Motivo: Merma' }));
        expect(products()).toEqual(['Tuerca', 'Tuerca']);
        await userEvent.click(screen.getByRole('button', { name: 'Quitar filtros' }));
        expect(products()).toHaveLength(4);
        expect(screen.queryByRole('group', { name: 'Filtros aplicados' })).not.toBeInTheDocument();
      });

      it('recuerda los filtros la próxima vez que se entra, también los del panel abierto', async () => {
        login();
        stub();
        const first = await renderPage();
        await screen.findAllByRole('row', { name: /Tuerca/ });
        await chooseOption('Sucursal', 'Sucursal Norte');
        await openAdvanced();
        await chooseOption('Producto', 'Tuerca');
        await vi.waitFor(() => expect(JSON.parse(localStorage.getItem(STORE) ?? '{}')).toMatchObject({ branch: 20, product: 'Tuerca', advancedOpen: true }));
        first.fixture.destroy();
        TestBed.resetTestingModule(); // otra visita

        await renderPage();
        // Los nombres de las opciones llegan con las sucursales y los movimientos: se espera a que estén.
        await vi.waitFor(() => expect(screen.getByRole('combobox', { name: 'Sucursal' })).toHaveTextContent('Sucursal Norte'));
        await vi.waitFor(() => expect(screen.getByRole('combobox', { name: 'Producto' })).toHaveTextContent('Tuerca'));
        await vi.waitFor(() => expect(products()).toEqual(['Tuerca']));
      });

      it('un filtro de producto recordado que ya no existe se ve como etiqueta y se quita', async () => {
        login();
        localStorage.setItem(STORE, JSON.stringify({ product: 'Producto descontinuado' }));
        stub();
        await renderPage();
        expect(await screen.findByText('Ningún movimiento coincide')).toBeInTheDocument();
        await userEvent.click(screen.getByRole('button', { name: 'Quitar filtro Producto: Producto descontinuado' }));
        await vi.waitFor(() => expect(products()).toHaveLength(4));
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

    it('descarta un movimiento con un motivo que la app no conoce (no lo muestra con un rótulo roto)', async () => {
      stub([...MOVEMENTS, movement(9, { type: 'INGRESO', reason: 'MOTIVO_NUEVO', quantity: 1, productId: 1, branchId: 10 })]);
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

    it('el resumen cuenta movimientos y unidades que entraron y salieron', async () => {
      stub();
      await renderPage();
      // Ingresos: 10 + 5; retiros: 3 + 2.
      expect(await screen.findByText('4 movimientos: entraron 15 unidades y salieron 5')).toBeInTheDocument();
    });

    it('si no se pueden leer los usuarios (403), muestra su número en lugar de romper', async () => {
      stub(MOVEMENTS, 403);
      await renderPage();
      expect(await screen.findByText('Usuario 8')).toBeInTheDocument();
    });

    it('sin movimientos explica de dónde saldrán', async () => {
      stub([]);
      await renderPage();
      expect(await screen.findByText('Todavía no hay movimientos')).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /Exportar CSV/ })).not.toBeInTheDocument(); // nada que exportar
    });

    it('si falla la carga muestra el error en la tabla, sin aviso global', async () => {
      stub();
      server.use(http.get(URL_M, () => HttpResponse.json(apiErrorBody(500, 'INTERNAL_ERROR', 'Falla de prueba'), { status: 500 })));
      await renderPage();
      expect(await screen.findByRole('alert')).toHaveTextContent('Falla de prueba');
      expect(TestBed.inject(NotificationService).items()).toEqual([]);
    });
  });

  describe('filtros', () => {
    it('busca por producto, responsable, documento u observaciones sin distinguir acentos', async () => {
      stub();
      await renderPage();
      await screen.findAllByRole('row', { name: /Tuerca/ });
      const search = screen.getByRole('searchbox', { name: 'Buscar movimiento' });
      await userEvent.type(search, 'sofia');
      expect(products()).toEqual(['Tuerca']);
      await userEvent.clear(search);
      await userEvent.type(search, 'vencidas');
      expect(products()).toEqual(['Tuerca']);
      await userEvent.clear(search);
      await userEvent.type(search, 'compra #41');
      expect(products()).toEqual(['Tornillo']);
    });

    it('filtra por sucursal, por tipo y por motivo', async () => {
      stub();
      await renderPage();
      await screen.findAllByRole('row', { name: /Tuerca/ });
      await chooseOption('Sucursal', 'Sucursal Norte');
      expect(products()).toEqual(['Tuerca']);
      await chooseOption('Sucursal', 'Todas las sucursales');
      await chooseOption('Tipo de movimiento', 'Solo retiros');
      expect(products()).toEqual(['Tuerca', 'Tuerca']);
      await chooseOption('Tipo de movimiento', 'Ingresos y retiros');
      await chooseOption('Motivo', 'Merma');
      expect(products()).toEqual(['Tuerca']);
    });

    it('filtra por un rango de fechas: el día "Hasta" se incluye completo', async () => {
      stub();
      await renderPage();
      await screen.findAllByRole('row', { name: /Tuerca/ });
      await userEvent.click(screen.getByRole('button', { name: 'Desde' }));
      await userEvent.click(screen.getByRole('button', { name: /12 de octubre de 2026/ }));
      await userEvent.click(screen.getByRole('button', { name: 'Hasta' }));
      await userEvent.click(screen.getByRole('button', { name: /13 de octubre de 2026/ }));
      // Movimientos del 12 (#2) y del 13 (#3): ambos días completos.
      expect(products()).toEqual(['Tuerca', 'Tuerca']);
      expect(screen.getByText(/2 movimientos/)).toBeInTheDocument();
    });

    it('"Quitar filtros" aparece solo con filtros y los restablece', async () => {
      stub();
      await renderPage();
      await screen.findAllByRole('row', { name: /Tuerca/ });
      expect(screen.queryByRole('button', { name: 'Quitar filtros' })).not.toBeInTheDocument();
      await chooseOption('Motivo', 'Venta');
      expect(products()).toHaveLength(1);
      await userEvent.click(screen.getByRole('button', { name: 'Quitar filtros' }));
      expect(products()).toHaveLength(4);
      expect(screen.queryByRole('button', { name: 'Quitar filtros' })).not.toBeInTheDocument();
    });

    it('una combinación sin resultados lo dice (no es "sin movimientos")', async () => {
      stub();
      await renderPage();
      await screen.findAllByRole('row', { name: /Tuerca/ });
      await userEvent.type(screen.getByRole('searchbox', { name: 'Buscar movimiento' }), 'zzz');
      expect(screen.getByText('Ningún movimiento coincide')).toBeInTheDocument();
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

    it('descarga un CSV con lo que se ve (con los filtros aplicados), cantidades con signo y nombres', async () => {
      stub();
      const captured = captureDownload();
      await renderPage();
      await screen.findAllByRole('row', { name: /Tuerca/ });
      await chooseOption('Motivo', 'Merma');
      await userEvent.click(screen.getByRole('button', { name: /Exportar CSV/ }));
      expect(captured.name).toMatch(/^auditoria-\d{4}-\d{2}-\d{2}\.csv$/);
      const text = (await captured.blob?.text()) ?? '';
      const lines = text.replace('﻿', '').split('\r\n');
      expect(lines[0]).toBe('Fecha,Sucursal,Producto,Tipo,Motivo,Submotivo,Cantidad,Saldo,Responsable,Documento,Observaciones');
      expect(lines).toHaveLength(2); // encabezado + la única merma
      expect(lines[1]).toContain('Sede Central,Tuerca,Retiro,Merma,Caducidad,-2,100,Luis Pérez');
      expect(lines[1]).toContain('Cajas vencidas en bodega');
    });
  });
});
