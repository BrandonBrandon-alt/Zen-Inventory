import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { render, screen, within } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { delay, http, HttpResponse } from 'msw';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { API_BASE_URL } from '@core/api/api-base-url';
import { errorInterceptor } from '@core/api/error.interceptor';
import { SESSION_STORAGE_KEY } from '@core/auth/session/auth-store';
import { NotificationService } from '@core/notifications/notification.service';
import { chooseOption } from '@testing/select-helpers';
import { apiErrorBody, server, TEST_API } from '@testing/msw-server';
import { expectAccessible } from '@testing/a11y';
import { InventoryPage } from './inventory-page';

const PRODUCTS = [
  { id: 1, sku: 'T-1', nombre: 'Tornillo', unitAbbreviation: 'UND', precioVenta: 5000, costoPromedio: 2000, activo: true },
  { id: 2, sku: 'T-2', nombre: 'Tuérca', unitAbbreviation: 'UND', precioVenta: 3000, costoPromedio: 1000, activo: true },
  { id: 3, sku: 'T-3', nombre: 'Arandela', unitAbbreviation: 'KG', precioVenta: 800, costoPromedio: 400, activo: true },
  { id: 4, sku: 'T-4', nombre: 'Descontinuado', unitAbbreviation: 'UND', activo: false },
];
const BRANCHES = [
  { id: 10, nombre: 'Sede Central', activa: true },
  { id: 20, nombre: 'Sucursal Norte', activa: true },
];
const INVENTORY_10 = [
  { productId: 1, stockActual: 12, stockMinimo: 5 },
  { productId: 2, stockActual: 3, stockMinimo: 5 },
];
const INVENTORY_20 = [{ productId: 1, stockActual: 99, stockMinimo: 0 }];

function useSession(rol: string, sucursalId?: number) {
  localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify({ token: 't', email: 'e@z.co', nombre: 'Yo', rol, id: 1, sucursalId }));
}

const inventoryUrl = (branch: number | string) => `${TEST_API}/api/v1/inventory/branches/${branch}`;

function stub(inventory: Record<number, unknown[]> = { 10: INVENTORY_10, 20: INVENTORY_20 }) {
  server.use(
    http.get(`${TEST_API}/api/catalog/products`, () => HttpResponse.json(PRODUCTS)),
    http.get(`${TEST_API}/api/branches`, () => HttpResponse.json(BRANCHES)),
    http.get(`${TEST_API}/api/v1/inventory/branches/:id`, ({ params }) => HttpResponse.json(inventory[Number(params['id'])] ?? [])),
    http.get(`${TEST_API}/api/v1/inventory/movements`, () => HttpResponse.json([])),
  );
}

const renderPage = () =>
  render(InventoryPage, {
    providers: [provideHttpClient(withInterceptors([errorInterceptor])), { provide: API_BASE_URL, useValue: TEST_API }],
  });

const names = () => screen.getAllByRole('row').slice(1).map((r) => within(r).getAllByRole('cell')[1]?.textContent?.trim());
const row = (name: string) => screen.getByRole('row', { name: new RegExp(name) });

describe('InventoryPage', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => {
    localStorage.clear();
    document.body.style.overflow = '';
  });

  describe('existencias', () => {
    it('no tiene problemas de accesibilidad detectables', async () => {
      useSession('ADMIN');
      stub();
      await renderPage();
      await vi.waitFor(() => expect(screen.getAllByRole('row').length).toBeGreaterThan(1));
      await expectAccessible();
    });

    it('lista los productos activos con su stock, marca crítico y agotado, y resume', async () => {
      useSession('ADMIN');
      stub();
      await renderPage();
      expect(await screen.findByText('Tornillo')).toBeInTheDocument();
      expect(names().sort()).toEqual(['Arandela', 'Tornillo', 'Tuérca']);
      expect(screen.queryByText('Descontinuado')).not.toBeInTheDocument();
      expect(within(row('Tuérca')).getByText('Crítico')).toBeInTheDocument();
      expect(within(row('Arandela')).getByText('Agotado')).toBeInTheDocument();
      expect(within(row('Tornillo')).queryByText(/Crítico|Agotado/)).not.toBeInTheDocument();
      expect(screen.getByText('3 productos · 1 crítico · 1 agotado')).toBeInTheDocument();
    });

    it('un producto sin registro de inventario aparece con 0', async () => {
      useSession('ADMIN');
      stub();
      await renderPage();
      await screen.findByText('Arandela');
      // Columnas: SKU, Producto, Unidad, Existencias (agotado + 0)…
      expect(within(row('Arandela')).getAllByRole('cell')[3]).toHaveTextContent(/Agotado\s*0/);
    });

    it('busca por nombre o SKU sin distinguir mayúsculas ni acentos; sin coincidencias, lo dice', async () => {
      useSession('ADMIN');
      stub();
      await renderPage();
      await screen.findByText('Tornillo');
      const search = screen.getByRole('searchbox', { name: 'Buscar producto' });
      await userEvent.type(search, 'TUERCA');
      expect(names()).toEqual(['Tuérca']);
      await userEvent.clear(search);
      await userEvent.type(search, 't-1');
      expect(names()).toEqual(['Tornillo']);
      await userEvent.clear(search);
      await userEvent.type(search, 'zzz');
      expect(screen.getByText('Ningún producto coincide con la búsqueda.')).toBeInTheDocument();
    });

    it('si falla la carga muestra el error en la tabla, sin aviso global, y reintentar recupera', async () => {
      useSession('MANAGER', 10);
      let calls = 0;
      stub();
      server.use(
        http.get(inventoryUrl(10), () => {
          calls++;
          return calls === 1 ? HttpResponse.json(apiErrorBody(500, 'INTERNAL_ERROR', 'Falla de prueba'), { status: 500 }) : HttpResponse.json(INVENTORY_10);
        }),
      );
      await renderPage();
      expect(await screen.findByRole('alert')).toHaveTextContent('Falla de prueba');
      expect(TestBed.inject(NotificationService).items()).toEqual([]);
      await userEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
      expect(await screen.findByText('Tornillo')).toBeInTheDocument();
    });
  });

  describe('sucursal según el rol', () => {
    it('ADMIN elige la sucursal: parte de la primera activa y al cambiar carga la otra', async () => {
      useSession('ADMIN');
      stub();
      await renderPage();
      await screen.findByText('Tornillo');
      expect(screen.getByRole('combobox', { name: 'Sucursal' })).toHaveTextContent('Sede Central');
      expect(within(row('Tornillo')).getByText('12')).toBeInTheDocument();
      await chooseOption('Sucursal', 'Sucursal Norte');
      await vi.waitFor(() => expect(within(row('Tornillo')).getByText('99')).toBeInTheDocument());
    });

    it('al cambiar de sucursal rápido, la respuesta lenta de la anterior no pisa a la nueva', async () => {
      useSession('ADMIN');
      stub();
      server.use(http.get(inventoryUrl(10), async () => { await delay(300); return HttpResponse.json(INVENTORY_10); }));
      await renderPage();
      await vi.waitFor(() => expect(screen.getByRole('combobox', { name: 'Sucursal' })).toBeInTheDocument());
      await chooseOption('Sucursal', 'Sucursal Norte');
      await vi.waitFor(() => expect(within(row('Tornillo')).getByText('99')).toBeInTheDocument());
      await new Promise((resolve) => setTimeout(resolve, 450));
      expect(within(row('Tornillo')).getByText('99')).toBeInTheDocument();
    });

    it('un MANAGER trabaja en su sucursal: no hay selector y se consulta solo la suya', async () => {
      useSession('MANAGER', 20);
      let requested = '';
      stub();
      server.use(http.get(`${TEST_API}/api/v1/inventory/branches/:id`, ({ params }) => { requested = String(params['id']); return HttpResponse.json(INVENTORY_20); }));
      await renderPage();
      await screen.findByText('Tornillo');
      expect(requested).toBe('20');
      expect(screen.queryByRole('combobox', { name: 'Sucursal' })).not.toBeInTheDocument();
    });

    it('un usuario sin sucursal asignada ve el motivo, no una tabla vacía', async () => {
      useSession('OPERADOR_INVENTARIO');
      stub();
      await renderPage();
      expect(await screen.findByRole('alert')).toHaveTextContent('Tu usuario no tiene una sucursal asignada.');
    });
  });

  describe('permisos', () => {
    it.each([
      ['ADMIN', true],
      ['MANAGER', true],
      ['OPERADOR_INVENTARIO', false],
      ['SELLER', false],
    ] as const)('%s: ¿ve costo y precio? %s', async (rol, sees) => {
      useSession(rol, 10);
      stub();
      await renderPage();
      await screen.findByText('Tornillo');
      expect(screen.queryByRole('columnheader', { name: /Costo prom/ }) !== null).toBe(sees);
      expect(screen.queryByRole('columnheader', { name: /Precio venta/ }) !== null).toBe(sees);
    });

    it('quienes pueden editar ven las acciones; el vendedor no, y tampoco ve el kardex', async () => {
      useSession('SELLER', 10);
      stub();
      await renderPage();
      await screen.findByText('Tornillo');
      expect(screen.queryByRole('button', { name: /Ajustar stock de/ })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /Configurar stock mínimo/ })).not.toBeInTheDocument();
      expect(screen.queryByRole('tab', { name: 'Kardex' })).not.toBeInTheDocument();
    });

    it('el operador de inventario sí ajusta y ve el kardex', async () => {
      useSession('OPERADOR_INVENTARIO', 10);
      stub();
      await renderPage();
      await screen.findByText('Tornillo');
      expect(screen.getByRole('button', { name: 'Ajustar stock de Tornillo' })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: 'Kardex' })).toBeInTheDocument();
    });
  });

  describe('acciones', () => {
    it('ajustar stock: abre el formulario con ese producto, guarda y la tabla se recarga sin volver al esqueleto', async () => {
      useSession('MANAGER', 10);
      let listCalls = 0;
      let inventory = INVENTORY_10;
      stub();
      server.use(
        http.get(inventoryUrl(10), async () => { listCalls++; if (listCalls > 1) await delay(250); return HttpResponse.json(inventory); }),
        http.post(`${inventoryUrl(10)}/products/1/add`, () => { inventory = [{ productId: 1, stockActual: 20, stockMinimo: 5 }, INVENTORY_10[1]]; return new HttpResponse(null, { status: 204 }); }),
      );
      await renderPage();
      await screen.findByText('Tornillo');
      await userEvent.click(screen.getByRole('button', { name: 'Ajustar stock de Tornillo' }));
      expect(screen.getByRole('dialog', { name: 'Ajustar stock' })).toHaveAccessibleDescription(/Tornillo/);
      await userEvent.type(screen.getByLabelText('Cantidad a ingresar'), '8');
      await userEvent.type(screen.getByLabelText('Justificación'), 'Conteo físico del lunes en bodega');
      await userEvent.click(screen.getByRole('button', { name: 'Registrar movimiento' }));

      await vi.waitFor(() => expect(listCalls).toBe(2));
      expect(screen.getByText('Tornillo')).toBeInTheDocument();
      expect(screen.queryByRole('status')).not.toBeInTheDocument();
      await vi.waitFor(() => expect(within(row('Tornillo')).getByText('20')).toBeInTheDocument());
    });

    it('configurar stock mínimo: guarda para ese producto y recarga', async () => {
      useSession('MANAGER', 10);
      let query = '';
      let listCalls = 0;
      stub();
      server.use(
        http.get(inventoryUrl(10), () => { listCalls++; return HttpResponse.json(INVENTORY_10); }),
        http.put(`${inventoryUrl(10)}/products/2/config`, ({ request }) => { query = new URL(request.url).search; return HttpResponse.json({}); }),
      );
      await renderPage();
      await screen.findByText('Tuérca');
      await userEvent.click(screen.getByRole('button', { name: 'Configurar stock mínimo de Tuérca' }));
      const input = screen.getByRole('spinbutton', { name: 'Stock mínimo' });
      expect(input).toHaveValue(5);
      await userEvent.clear(input);
      await userEvent.type(input, '2');
      await userEvent.click(screen.getByRole('button', { name: 'Guardar' }));
      await vi.waitFor(() => expect(listCalls).toBe(2));
      expect(query).toBe('?minimumStock=2');
    });
  });

  describe('kardex', () => {
    it('la pestaña Kardex muestra el historial de la sucursal y se puede volver a Existencias', async () => {
      useSession('MANAGER', 10);
      stub();
      server.use(
        http.get(`${TEST_API}/api/v1/inventory/movements`, () =>
          HttpResponse.json([{ id: 1, type: 'INGRESO', reason: 'AJUSTE_POSITIVO', quantity: 4, date: '2026-01-02T10:00:00', productId: 1, branchId: 10, finalBalance: 16 }]),
        ),
      );
      await renderPage();
      await screen.findByText('Tornillo');
      await userEvent.click(screen.getByRole('tab', { name: 'Kardex' }));
      expect(await screen.findByText('Ajuste (+)')).toBeInTheDocument();
      expect(screen.getByRole('tabpanel')).toHaveAttribute('aria-labelledby', 'inventory-tab-kardex');
      await userEvent.click(screen.getByRole('tab', { name: 'Existencias' }));
      expect(await screen.findByRole('searchbox', { name: 'Buscar producto' })).toBeInTheDocument();
    });
  });
});
