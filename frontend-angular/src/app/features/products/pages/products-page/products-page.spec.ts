import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { render, screen, within } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it, vi } from 'vitest';
import { API_BASE_URL } from '@core/api/api-base-url';
import { errorInterceptor } from '@core/api/error.interceptor';
import { NotificationService } from '@core/notifications/notification.service';
import { chooseOption } from '@testing/select-helpers';
import { apiErrorBody, server, TEST_API } from '@testing/msw-server';
import { expectAccessible } from '@testing/a11y';
import { ProductsPage } from './products-page';

const PRODUCTS = [
  {
    id: 1,
    sku: 'TOR-001',
    nombre: 'Tornillo',
    costoPromedio: 2000,
    precioVenta: 5000,
    unitId: 10,
    unitAbbreviation: 'UND',
    activo: true,
    proveedores: [
      { id: 100, nombre: 'Ferretería Central', precioPactado: 1800, preferido: false, tiempoEntregaDias: 3 },
      { id: 101, nombre: 'Aceros del Sur', precioPactado: 1700, preferido: true, tiempoEntregaDias: 1 },
    ],
  },
  { id: 2, sku: 'TUE-002', nombre: 'Tuérca', costoPromedio: 1000, precioVenta: 3000, unitId: 10, unitAbbreviation: 'UND', activo: true, proveedores: [] },
  { id: 3, sku: 'ARA-003', nombre: 'Arandela', costoPromedio: 400, precioVenta: 800, unitId: 11, unitAbbreviation: 'KG', activo: false, proveedores: [] },
];
const UNITS = [
  { id: 10, nombre: 'Unidad', abreviatura: 'UND' },
  { id: 11, nombre: 'Kilogramo', abreviatura: 'KG' },
  { id: 12, nombre: 'Caja', abreviatura: 'CJ' },
];
const SUPPLIERS = [
  { id: 100, nombre: 'Ferretería Central', tiempoEntregaDias: 3 },
  { id: 101, nombre: 'Aceros del Sur', tiempoEntregaDias: 1 },
];
const URL = `${TEST_API}/api/catalog/products`;

function stub(products: unknown[] = PRODUCTS) {
  server.use(
    http.get(URL, () => HttpResponse.json(products)),
    http.get(`${TEST_API}/api/catalog/units`, () => HttpResponse.json(UNITS)),
    http.get(`${TEST_API}/api/catalog/suppliers`, () => HttpResponse.json(SUPPLIERS)),
  );
}

const renderPage = () =>
  render(ProductsPage, { providers: [provideHttpClient(withInterceptors([errorInterceptor])), { provide: API_BASE_URL, useValue: TEST_API }] });

const skus = () => screen.getAllByRole('row').slice(1).map((r) => within(r).getAllByRole('cell')[0].textContent?.trim());

describe('ProductsPage', () => {
  describe('lista', () => {
    it('no tiene problemas de accesibilidad detectables', async () => {
      stub();
      await renderPage();
      await vi.waitFor(() => expect(screen.getAllByRole('row').length).toBeGreaterThan(1));
      await expectAccessible();
    });

    it('muestra los productos con unidad, precios, proveedor preferido y estado en texto', async () => {
      stub();
      await renderPage();
      expect(await screen.findByText('Tornillo')).toBeInTheDocument();
      expect(screen.getByRole('heading', { level: 1, name: 'Productos' })).toBeInTheDocument();
      expect(screen.getByText('3 productos, 2 activos')).toBeInTheDocument();
      const row = screen.getByRole('row', { name: /Tornillo/ });
      expect(within(row).getByText('Aceros del Sur')).toBeInTheDocument(); // el preferido, no el primero
      expect(within(row).getByText('+1')).toBeInTheDocument();
      expect(within(row).getByText('Activo')).toBeInTheDocument();
      expect(within(screen.getByRole('row', { name: /Tuérca/ })).getByText('Sin proveedores')).toBeInTheDocument();
      expect(within(screen.getByRole('row', { name: /Arandela/ })).getByText('Inactivo')).toBeInTheDocument();
    });

    it('el "+1" enfocado muestra el detalle de todos los proveedores, el preferido primero', async () => {
      stub();
      await renderPage();
      await screen.findByText('Tornillo');
      const more = within(screen.getByRole('row', { name: /Tornillo/ })).getByLabelText('y 1 proveedor más');
      more.focus();
      const tip = await screen.findByRole('tooltip');
      expect(tip.textContent?.replaceAll(String.fromCharCode(160), ' ')).toBe('Aceros del Sur (preferido): $ 1.700 · 1 día\nFerretería Central: $ 1.800 · 3 días');
      expect(more).toHaveAttribute('aria-describedby', tip.id);
    });

    it('un producto con un solo proveedor no muestra el "+N"', async () => {
      stub([{ ...PRODUCTS[0], proveedores: [PRODUCTS[0].proveedores[0]] }]);
      await renderPage();
      expect(await screen.findByText('Ferretería Central')).toBeInTheDocument();
      expect(screen.queryByText(/^\+\d/)).not.toBeInTheDocument();
    });

    it('busca por nombre o SKU sin distinguir mayúsculas ni acentos', async () => {
      stub();
      await renderPage();
      await screen.findByText('Tornillo');
      await userEvent.type(screen.getByRole('searchbox', { name: 'Buscar producto' }), 'tuerca');
      expect(skus()).toEqual(['TUE-002']);
      await userEvent.clear(screen.getByRole('searchbox', { name: 'Buscar producto' }));
      await userEvent.type(screen.getByRole('searchbox', { name: 'Buscar producto' }), 'ara-0');
      expect(skus()).toEqual(['ARA-003']);
    });

    it('una búsqueda sin resultados lo dice (no es un catálogo vacío)', async () => {
      stub();
      await renderPage();
      await screen.findByText('Tornillo');
      await userEvent.type(screen.getByRole('searchbox', { name: 'Buscar producto' }), 'zzz');
      expect(screen.getByText('Ningún producto coincide')).toBeInTheDocument();
    });

    it('catálogo vacío invita a crear el primero', async () => {
      stub([]);
      await renderPage();
      expect(await screen.findByText('Todavía no hay productos')).toBeInTheDocument();
    });

    it('si falla la carga muestra el error en la tabla, sin aviso global', async () => {
      server.use(
        http.get(URL, () => HttpResponse.json(apiErrorBody(500, 'INTERNAL_ERROR', 'Falla de prueba'), { status: 500 })),
        http.get(`${TEST_API}/api/catalog/units`, () => HttpResponse.json(UNITS)),
        http.get(`${TEST_API}/api/catalog/suppliers`, () => HttpResponse.json(SUPPLIERS)),
      );
      await renderPage();
      expect(await screen.findByRole('alert')).toHaveTextContent('Falla de prueba');
      expect(TestBed.inject(NotificationService).items()).toEqual([]);
    });
  });

  describe('crear', () => {
    it('envía el producto con el SKU en mayúsculas, el costo inicial y sus proveedores', async () => {
      stub();
      let body: Record<string, unknown> = {};
      server.use(
        http.post(URL, async ({ request }) => {
          body = (await request.json()) as Record<string, unknown>;
          return HttpResponse.json({ ...PRODUCTS[1], id: 9, sku: 'NUE-001', nombre: 'Nuevo' }, { status: 201 });
        }),
      );
      await renderPage();
      await screen.findByText('Tornillo');
      await userEvent.click(screen.getByRole('button', { name: /Nuevo producto/ }));
      await userEvent.type(screen.getByLabelText('SKU'), 'nue-001');
      expect(screen.getByLabelText('SKU')).toHaveValue('NUE-001');
      await userEvent.type(screen.getByLabelText('Nombre'), 'Nuevo');
      await chooseOption('Unidad base', 'Kilogramo');
      await userEvent.type(screen.getByLabelText('Costo inicial'), '1500');
      await userEvent.type(screen.getByLabelText('Precio de venta'), '2500');
      await userEvent.click(screen.getByRole('button', { name: /Agregar proveedor/ }));
      await chooseOption('Proveedor', 'Ferretería Central');
      // Propone los días de entrega habituales del proveedor.
      expect(screen.getByLabelText('Entrega (días)')).toHaveValue(3);
      await userEvent.type(screen.getByLabelText('Precio pactado'), '1400');
      await userEvent.click(screen.getByLabelText('Preferido'));
      await userEvent.click(screen.getByRole('button', { name: 'Crear producto' }));

      await vi.waitFor(() => expect(body['sku']).toBe('NUE-001'));
      expect(body).toMatchObject({
        nombre: 'Nuevo',
        unitId: 11,
        costoPromedio: 1500,
        precioVenta: 2500,
        suppliers: [{ supplierId: 100, negotiatedPrice: 1400, deliveryDays: 3, preferred: true }],
      });
      expect(body).not.toHaveProperty('activo');
      expect(TestBed.inject(NotificationService).items()[0]).toMatchObject({ kind: 'success' });
    });

    it('sin datos obligatorios no envía y señala cada campo', async () => {
      stub();
      let called = false;
      server.use(http.post(URL, () => ((called = true), HttpResponse.json({}))));
      await renderPage();
      await screen.findByText('Tornillo');
      await userEvent.click(screen.getByRole('button', { name: /Nuevo producto/ }));
      await userEvent.click(screen.getByRole('button', { name: 'Crear producto' }));
      expect(await screen.findByText('El SKU es requerido.')).toBeInTheDocument();
      expect(screen.getByText('El nombre es requerido.')).toBeInTheDocument();
      expect(screen.getByText('Elige la unidad base.')).toBeInTheDocument();
      expect(called).toBe(false);
    });

    it('un SKU con caracteres no permitidos se rechaza', async () => {
      stub();
      await renderPage();
      await screen.findByText('Tornillo');
      await userEvent.click(screen.getByRole('button', { name: /Nuevo producto/ }));
      await userEvent.type(screen.getByLabelText('SKU'), 'ab_12');
      await userEvent.click(screen.getByRole('button', { name: 'Crear producto' }));
      expect(await screen.findByText('Solo letras mayúsculas, números y guiones.')).toBeInTheDocument();
    });

    it('un SKU repetido (DUPLICATE_SKU) se muestra bajo el campo, no como error general', async () => {
      stub();
      server.use(http.post(URL, () => HttpResponse.json(apiErrorBody(409, 'DUPLICATE_SKU', 'Ya existe un producto con el SKU indicado.'), { status: 409 })));
      await renderPage();
      await screen.findByText('Tornillo');
      await userEvent.click(screen.getByRole('button', { name: /Nuevo producto/ }));
      await userEvent.type(screen.getByLabelText('SKU'), 'TOR-001');
      await userEvent.type(screen.getByLabelText('Nombre'), 'Otro');
      await chooseOption('Unidad base', 'Unidad');
      await userEvent.type(screen.getByLabelText('Costo inicial'), '1');
      await userEvent.type(screen.getByLabelText('Precio de venta'), '2');
      await userEvent.click(screen.getByRole('button', { name: 'Crear producto' }));
      expect(await screen.findByText('Ya existe un producto con el SKU indicado.')).toBeInTheDocument();
      expect(screen.getByLabelText('SKU')).toHaveAttribute('aria-invalid', 'true');
      expect(screen.getByRole('dialog', { name: 'Nuevo producto' })).toBeInTheDocument();
    });

    it('un proveedor ya elegido en otra fila no se ofrece otra vez', async () => {
      stub();
      await renderPage();
      await screen.findByText('Tornillo');
      await userEvent.click(screen.getByRole('button', { name: /Nuevo producto/ }));
      await userEvent.click(screen.getByRole('button', { name: /Agregar proveedor/ }));
      await chooseOption('Proveedor', 'Ferretería Central');
      await userEvent.click(screen.getByRole('button', { name: /Agregar proveedor/ }));
      await userEvent.click(screen.getAllByRole('combobox', { name: 'Proveedor' })[1]);
      expect(screen.getByRole('option', { name: /Ferretería Central/ })).toHaveAttribute('aria-disabled', 'true');
      expect(screen.getByRole('option', { name: /Aceros del Sur/ })).not.toHaveAttribute('aria-disabled', 'true');
    });

    it('solo un proveedor puede ser el preferido', async () => {
      stub();
      await renderPage();
      await screen.findByText('Tornillo');
      await userEvent.click(screen.getByRole('button', { name: /Nuevo producto/ }));
      await userEvent.click(screen.getByRole('button', { name: /Agregar proveedor/ }));
      await userEvent.click(screen.getByRole('button', { name: /Agregar proveedor/ }));
      const [first, second] = screen.getAllByLabelText('Preferido');
      await userEvent.click(first);
      await userEvent.click(second);
      expect(first).not.toBeChecked();
      expect(second).toBeChecked();
    });

    it('quitar una fila de proveedor la elimina', async () => {
      stub();
      await renderPage();
      await screen.findByText('Tornillo');
      await userEvent.click(screen.getByRole('button', { name: /Nuevo producto/ }));
      await userEvent.click(screen.getByRole('button', { name: /Agregar proveedor/ }));
      expect(screen.getAllByRole('combobox', { name: 'Proveedor' })).toHaveLength(1);
      await userEvent.click(screen.getByRole('button', { name: 'Quitar proveedor 1' }));
      expect(screen.queryByRole('combobox', { name: 'Proveedor' })).not.toBeInTheDocument();
    });
  });

  describe('editar', () => {
    it('precarga el producto, muestra el costo sin poder editarlo y no lo envía (no pisa el costo calculado por las compras)', async () => {
      stub();
      let body: Record<string, unknown> = {};
      let putId = '';
      server.use(
        http.put(`${URL}/:id`, async ({ params, request }) => {
          putId = String(params['id']);
          body = (await request.json()) as Record<string, unknown>;
          return HttpResponse.json(PRODUCTS[0]);
        }),
      );
      await renderPage();
      await screen.findByText('Tornillo');
      await userEvent.click(screen.getByRole('button', { name: 'Editar Tornillo' }));
      const dialog = screen.getByRole('dialog', { name: 'Editar producto' });
      expect(screen.getByLabelText('SKU')).toHaveValue('TOR-001');
      expect(screen.queryByLabelText('Costo inicial')).not.toBeInTheDocument();
      expect(within(dialog).getByText('Lo calcula el sistema con cada compra.')).toBeInTheDocument();
      expect(screen.getAllByRole('combobox', { name: 'Proveedor' })).toHaveLength(2);
      await userEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }));
      await vi.waitFor(() => expect(putId).toBe('1'));
      expect(body).toMatchObject({ activo: true, unitId: 10 });
      expect(body).not.toHaveProperty('costoPromedio');
      expect(body['suppliers']).toEqual([
        { supplierId: 100, negotiatedPrice: 1800, deliveryDays: 3, preferred: false },
        { supplierId: 101, negotiatedPrice: 1700, deliveryDays: 1, preferred: true },
      ]);
    });

    it('un producto inactivo se puede reactivar desde el formulario', async () => {
      stub();
      let body: Record<string, unknown> = {};
      server.use(http.put(`${URL}/:id`, async ({ request }) => ((body = (await request.json()) as Record<string, unknown>), HttpResponse.json(PRODUCTS[2]))));
      await renderPage();
      await screen.findByText('Arandela');
      await userEvent.click(screen.getByRole('button', { name: 'Editar Arandela' }));
      await userEvent.click(screen.getByLabelText('Producto activo'));
      await userEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }));
      await vi.waitFor(() => expect(body['activo']).toBe(true));
    });

    it('al abrir "Nuevo producto" después de editar no arrastra los datos del anterior', async () => {
      stub();
      await renderPage();
      await screen.findByText('Tornillo');
      await userEvent.click(screen.getByRole('button', { name: 'Editar Tornillo' }));
      await userEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
      await userEvent.click(screen.getByRole('button', { name: /Nuevo producto/ }));
      expect(screen.getByLabelText('SKU')).toHaveValue('');
      expect(screen.queryByRole('combobox', { name: 'Proveedor' })).not.toBeInTheDocument();
      expect(screen.getByLabelText('Costo inicial')).toBeInTheDocument();
    });
  });

  describe('desactivar', () => {
    it('solo los productos activos tienen el botón', async () => {
      stub();
      await renderPage();
      await screen.findByText('Tornillo');
      expect(screen.getAllByRole('button', { name: /^Desactivar / })).toHaveLength(2);
      expect(screen.queryByRole('button', { name: 'Desactivar Arandela' })).not.toBeInTheDocument();
    });

    it('al confirmar desactiva ese producto, avisa y recarga', async () => {
      let deleted = '';
      let list: unknown[] = PRODUCTS;
      stub();
      server.use(
        http.get(URL, () => HttpResponse.json(list)),
        http.delete(`${URL}/:id`, ({ params }) => {
          deleted = String(params['id']);
          list = PRODUCTS.map((p) => (p.id === 2 ? { ...p, activo: false } : p));
          return new HttpResponse(null, { status: 204 });
        }),
      );
      await renderPage();
      await screen.findByText('Tuérca');
      await userEvent.click(screen.getByRole('button', { name: 'Desactivar Tuérca' }));
      expect(screen.getByRole('dialog', { name: 'Desactivar producto' })).toHaveTextContent('Tuérca');
      await userEvent.click(screen.getByRole('button', { name: 'Desactivar' }));
      expect(await screen.findByText('3 productos, 1 activo')).toBeInTheDocument();
      expect(deleted).toBe('2');
      expect(TestBed.inject(NotificationService).items()[0]).toMatchObject({ message: 'Producto "Tuérca" desactivado.' });
    });

    it('si falla, el error queda en el diálogo', async () => {
      stub();
      server.use(http.delete(`${URL}/:id`, () => HttpResponse.json(apiErrorBody(409, 'INVALID_STATE', 'Tiene stock'), { status: 409 })));
      await renderPage();
      await screen.findByText('Tornillo');
      await userEvent.click(screen.getByRole('button', { name: 'Desactivar Tornillo' }));
      await userEvent.click(screen.getByRole('button', { name: 'Desactivar' }));
      expect(await screen.findByRole('alert')).toHaveTextContent('Tiene stock');
    });
  });

  describe('unidades alternas', () => {
    const UNITS_URL = `${URL}/1/units`;
    const BASE = { id: 1, productoId: 1, unidadId: 10, nombreUnidad: 'Unidad', abreviaturaUnidad: 'UND', factorConversion: 1, esBase: true };
    const BOX = { id: 2, productoId: 1, unidadId: 12, nombreUnidad: 'Caja', abreviaturaUnidad: 'CJ', factorConversion: 12, esBase: false };

    it('lista la base y las equivalencias ("1 CJ = 12 UND")', async () => {
      stub();
      server.use(http.get(UNITS_URL, () => HttpResponse.json([BASE, BOX])));
      await renderPage();
      await screen.findByText('Tornillo');
      await userEvent.click(screen.getByRole('button', { name: 'Unidades de Tornillo' }));
      const dialog = screen.getByRole('dialog', { name: 'Unidades de Tornillo' });
      expect(await within(dialog).findByText('1 CJ = 12 UND')).toBeInTheDocument();
      expect(within(dialog).getByText('Base')).toBeInTheDocument();
      // La base no se puede quitar.
      expect(within(dialog).queryByRole('button', { name: 'Quitar Unidad' })).not.toBeInTheDocument();
      expect(within(dialog).getByRole('button', { name: 'Quitar Caja' })).toBeInTheDocument();
    });

    it('agrega una unidad con su equivalencia y no ofrece la base ni las ya agregadas', async () => {
      stub();
      let units = [BASE];
      let body: unknown;
      server.use(
        http.get(UNITS_URL, () => HttpResponse.json(units)),
        http.post(UNITS_URL, async ({ request }) => {
          body = await request.json();
          units = [BASE, BOX];
          return HttpResponse.json(BOX, { status: 201 });
        }),
      );
      await renderPage();
      await screen.findByText('Tornillo');
      await userEvent.click(screen.getByRole('button', { name: 'Unidades de Tornillo' }));
      const dialog = await screen.findByRole('dialog', { name: 'Unidades de Tornillo' });
      await within(dialog).findByText('Base');
      await userEvent.click(within(dialog).getByRole('combobox', { name: 'Unidad' }));
      expect(screen.queryByRole('option', { name: /^Unidad/ })).not.toBeInTheDocument(); // la base
      await userEvent.click(screen.getByRole('option', { name: /^Caja/ }));
      await userEvent.type(within(dialog).getByLabelText('Equivale a (UND)'), '12');
      await userEvent.click(within(dialog).getByRole('button', { name: 'Agregar' }));
      expect(await within(dialog).findByText('1 CJ = 12 UND')).toBeInTheDocument();
      expect(body).toEqual({ productoId: 1, unidadId: 12, factorConversion: 12, esBase: false });
      // Ya agregada: deja de ofrecerse.
      await userEvent.click(within(dialog).getByRole('combobox', { name: 'Unidad' }));
      expect(screen.queryByRole('option', { name: /^Caja/ })).not.toBeInTheDocument();
    });

    it('rechaza una equivalencia de 0 o con más de 4 decimales sin llamar al servidor', async () => {
      stub();
      let posted = false;
      server.use(http.get(UNITS_URL, () => HttpResponse.json([BASE])), http.post(UNITS_URL, () => ((posted = true), HttpResponse.json(BOX))));
      await renderPage();
      await screen.findByText('Tornillo');
      await userEvent.click(screen.getByRole('button', { name: 'Unidades de Tornillo' }));
      const dialog = await screen.findByRole('dialog', { name: 'Unidades de Tornillo' });
      await within(dialog).findByText('Base');
      await userEvent.click(within(dialog).getByRole('combobox', { name: 'Unidad' }));
      await userEvent.click(screen.getByRole('option', { name: /^Caja/ }));
      await userEvent.type(within(dialog).getByLabelText('Equivale a (UND)'), '0.00001');
      await userEvent.click(within(dialog).getByRole('button', { name: 'Agregar' }));
      expect(await within(dialog).findByText('Máximo 4 decimales.')).toBeInTheDocument();
      expect(posted).toBe(false);
    });

    it('rechaza una equivalencia de 0', async () => {
      stub();
      server.use(http.get(UNITS_URL, () => HttpResponse.json([BASE])));
      await renderPage();
      await screen.findByText('Tornillo');
      await userEvent.click(screen.getByRole('button', { name: 'Unidades de Tornillo' }));
      const dialog = await screen.findByRole('dialog', { name: 'Unidades de Tornillo' });
      await within(dialog).findByText('Base');
      await userEvent.click(within(dialog).getByRole('combobox', { name: 'Unidad' }));
      await userEvent.click(screen.getByRole('option', { name: /^Caja/ }));
      await userEvent.type(within(dialog).getByLabelText('Equivale a (UND)'), '0');
      await userEvent.click(within(dialog).getByRole('button', { name: 'Agregar' }));
      expect(await within(dialog).findByText('Debe ser mayor que 0.')).toBeInTheDocument();
    });

    it('quita una unidad alterna', async () => {
      stub();
      let units = [BASE, BOX];
      let deleted = '';
      server.use(
        http.get(UNITS_URL, () => HttpResponse.json(units)),
        http.delete(`${UNITS_URL}/:unitId`, ({ params }) => {
          deleted = String(params['unitId']);
          units = [BASE];
          return new HttpResponse(null, { status: 204 });
        }),
      );
      await renderPage();
      await screen.findByText('Tornillo');
      await userEvent.click(screen.getByRole('button', { name: 'Unidades de Tornillo' }));
      const dialog = await screen.findByRole('dialog', { name: 'Unidades de Tornillo' });
      await userEvent.click(await within(dialog).findByRole('button', { name: 'Quitar Caja' }));
      await vi.waitFor(() => expect(within(dialog).queryByText('1 CJ = 12 UND')).not.toBeInTheDocument());
      expect(deleted).toBe('12');
    });

    it('si falla al cargar muestra el error dentro del diálogo', async () => {
      stub();
      server.use(http.get(UNITS_URL, () => HttpResponse.json(apiErrorBody(500, 'INTERNAL_ERROR', 'Falla de prueba'), { status: 500 })));
      await renderPage();
      await screen.findByText('Tornillo');
      await userEvent.click(screen.getByRole('button', { name: 'Unidades de Tornillo' }));
      expect(await screen.findByRole('alert')).toHaveTextContent('Falla de prueba');
    });
  });
});
