import { TestBed } from '@angular/core/testing';
import { render, screen, within } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Badge } from '../badge/badge';
import { LucideStore } from '@lucide/angular';
import { Button } from '../button/button';
import { DataTable, DataTableCell, type TableColumn } from './data-table';

interface Branch {
  id: number;
  nombre: string;
  ventas: number | null;
  activa: boolean | null;
}

const BRANCHES: Branch[] = [
  { id: 1, nombre: 'Norte', ventas: 10, activa: true },
  { id: 2, nombre: 'Álvaro Sur', ventas: 9, activa: false },
  { id: 3, nombre: 'Alberto Este', ventas: null, activa: null },
  { id: 4, nombre: 'Zona Ñandú', ventas: 100, activa: true },
];

const COLUMNS: TableColumn<Branch>[] = [
  { key: 'nombre', header: 'Nombre', sortable: true, primary: true },
  { key: 'ventas', header: 'Ventas', sortable: true, align: 'end' },
  { key: 'activa', header: 'Activa' },
];

const imports = [DataTable, DataTableCell, Badge, Button];

const TEMPLATE = `
  <app-data-table
    caption="Sucursales"
    [columns]="columns"
    [rows]="rows"
    [rowKey]="rowKey"
    [loading]="loading"
    [error]="error"
    [pageSize]="pageSize"
    [clickableRows]="clickableRows"
    emptyTitle="Sin sucursales"
    emptyDescription="Crea la primera para empezar."
    (rowClick)="onRowClick($event)"
    (retry)="onRetry()"
  >
    <ng-template appCell="activa" let-row>
      <app-badge [variant]="row.activa ? 'success' : 'neutral'">{{ row.activa ? 'Activa' : 'Inactiva' }}</app-badge>
    </ng-template>
    <ng-template appCell="acciones" let-row>
      <button type="button" (click)="onInner(row)">Editar {{ row.nombre }}</button>
    </ng-template>
    <button appButton data-slot="empty-action">Crear sucursal</button>
  </app-data-table>`;

type Props = Partial<{
  columns: TableColumn<Branch>[];
  rows: Branch[];
  loading: boolean;
  error: string | null;
  pageSize: number | null;
  clickableRows: boolean;
  onRowClick: (row: Branch) => void;
  onRetry: () => void;
  onInner: (row: Branch) => void;
}>;

function setup(props: Props = {}) {
  const componentProperties = {
    columns: COLUMNS,
    rows: BRANCHES,
    rowKey: (row: Branch) => row.id,
    loading: false,
    error: null,
    pageSize: null,
    clickableRows: false,
    onRowClick: vi.fn(),
    onRetry: vi.fn(),
    onInner: vi.fn(),
    ...props,
  };
  return render(TEMPLATE, { imports, componentProperties }).then((result) => ({ ...result, props: componentProperties }));
}

const dataRows = () => screen.getAllByRole('row').slice(1);
const firstColumn = () => dataRows().map((row) => within(row).getAllByRole('cell')[0].textContent?.trim());
const header = (name: string) => screen.getByRole('columnheader', { name: new RegExp(name) });

describe('DataTable — contenido', () => {
  it('es una tabla con nombre accesible (el caption)', async () => {
    await setup();
    expect(screen.getByRole('table', { name: 'Sucursales' })).toBeInTheDocument();
  });

  it('muestra los encabezados y una fila por dato, en el orden recibido', async () => {
    await setup();
    expect(screen.getAllByRole('columnheader').map((h) => h.textContent?.trim())).toEqual(['Nombre', 'Ventas', 'Activa']);
    expect(firstColumn()).toEqual(['Norte', 'Álvaro Sur', 'Alberto Este', 'Zona Ñandú']);
  });

  it('una columna con icono lo dibuja junto al encabezado, decorativo y sin cambiar su nombre accesible', async () => {
    await setup({
      columns: [
        { key: 'nombre', header: 'Nombre', icon: LucideStore.icon, sortable: true, primary: true },
        { key: 'ventas', header: 'Ventas', icon: LucideStore.icon },
        { key: 'activa', header: 'Activa' },
      ],
    });
    const sortable = screen.getByRole('columnheader', { name: 'Nombre' });
    const plain = screen.getByRole('columnheader', { name: 'Ventas' });
    // Con orden, el icono de la columna convive con el de la dirección (que solo aparece al pasar el cursor).
    expect(sortable.querySelector('svg[aria-hidden="true"]')).toBeInTheDocument();
    expect(plain.querySelector('svg[aria-hidden="true"]')).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Activa' }).querySelector('svg')).toBeNull();
    expect(plain.textContent?.trim()).toBe('Ventas');
  });

  it('un valor ausente se muestra como guion y los booleanos como Sí/No', async () => {
    await setup({
      columns: [
        { key: 'ventas', header: 'Ventas' },
        // Sin plantilla de celda (la columna "activa" del montaje sí la tiene): usa el formato por defecto.
        { key: 'habilitada', header: 'Habilitada', value: (r) => r.activa },
      ],
      rows: [{ id: 1, nombre: 'x', ventas: null, activa: true }, { id: 2, nombre: 'y', ventas: 5, activa: false }],
    });
    const cells = (i: number) => within(dataRows()[i]).getAllByRole('cell').map((c) => c.textContent?.trim());
    expect(cells(0)).toEqual(['—', 'Sí']);
    expect(cells(1)).toEqual(['5', 'No']);
  });

  it('usa value() y display() cuando se definen', async () => {
    await setup({
      columns: [{ key: 'precio', header: 'Precio', value: (r) => r.ventas, display: (r) => `$ ${r.ventas}` }],
      rows: [{ id: 1, nombre: 'x', ventas: 7, activa: true }],
    });
    expect(within(dataRows()[0]).getByRole('cell')).toHaveTextContent('$ 7');
  });

  it('los números se alinean a la derecha con cifras tabulares', async () => {
    await setup();
    const cell = within(dataRows()[0]).getAllByRole('cell')[1];
    expect(cell).toHaveClass('text-right');
    expect(cell).toHaveClass('tabular-nums');
  });

  it('la columna principal destaca sobre las demás', async () => {
    await setup();
    expect(within(dataRows()[0]).getAllByRole('cell')[0]).toHaveClass('font-medium');
    expect(within(dataRows()[0]).getAllByRole('cell')[1]).not.toHaveClass('font-medium');
  });

  it('una plantilla de celda reemplaza el texto de esa columna', async () => {
    await setup();
    expect(within(dataRows()[0]).getByText('Activa')).toBeInTheDocument();
    expect(within(dataRows()[1]).getByText('Inactiva')).toBeInTheDocument();
  });
});

describe('DataTable — ordenación', () => {
  it('solo las columnas ordenables tienen botón en el encabezado', async () => {
    await setup();
    expect(within(header('Nombre')).getByRole('button')).toBeInTheDocument();
    expect(within(header('Activa')).queryByRole('button')).not.toBeInTheDocument();
    expect(header('Activa')).not.toHaveAttribute('aria-sort');
  });

  it('el clic cicla ascendente → descendente → orden original, y lo anuncia con aria-sort', async () => {
    await setup();
    const button = within(header('Nombre')).getByRole('button');
    expect(header('Nombre')).toHaveAttribute('aria-sort', 'none');

    await userEvent.click(button);
    expect(header('Nombre')).toHaveAttribute('aria-sort', 'ascending');
    expect(firstColumn()).toEqual(['Alberto Este', 'Álvaro Sur', 'Norte', 'Zona Ñandú']);

    await userEvent.click(button);
    expect(header('Nombre')).toHaveAttribute('aria-sort', 'descending');
    expect(firstColumn()).toEqual(['Zona Ñandú', 'Norte', 'Álvaro Sur', 'Alberto Este']);

    await userEvent.click(button);
    expect(header('Nombre')).toHaveAttribute('aria-sort', 'none');
    expect(firstColumn()).toEqual(['Norte', 'Álvaro Sur', 'Alberto Este', 'Zona Ñandú']);
  });

  it('ordena con reglas del español: las tildes no rompen el orden alfabético', async () => {
    await setup();
    await userEvent.click(within(header('Nombre')).getByRole('button'));
    // "Alberto" < "Álvaro" aunque la Á lleve tilde.
    expect(firstColumn().slice(0, 2)).toEqual(['Alberto Este', 'Álvaro Sur']);
  });

  it('ordena los números como números (9 antes que 10), con los vacíos siempre al final', async () => {
    await setup();
    const button = within(header('Ventas')).getByRole('button');
    await userEvent.click(button);
    expect(firstColumn()).toEqual(['Álvaro Sur', 'Norte', 'Zona Ñandú', 'Alberto Este']);
    await userEvent.click(button);
    expect(firstColumn()).toEqual(['Zona Ñandú', 'Norte', 'Álvaro Sur', 'Alberto Este']);
  });

  it('al ordenar otra columna, la anterior vuelve a "none"', async () => {
    await setup();
    await userEvent.click(within(header('Nombre')).getByRole('button'));
    await userEvent.click(within(header('Ventas')).getByRole('button'));
    expect(header('Nombre')).toHaveAttribute('aria-sort', 'none');
    expect(header('Ventas')).toHaveAttribute('aria-sort', 'ascending');
  });

  it('ordenar no modifica el arreglo recibido', async () => {
    const { props } = await setup();
    const before = props.rows.map((r) => r.id);
    await userEvent.click(within(header('Nombre')).getByRole('button'));
    expect(props.rows.map((r) => r.id)).toEqual(before);
  });
});

describe('DataTable — paginación', () => {
  const MANY: Branch[] = Array.from({ length: 8 }, (_, i) => ({ id: i + 1, nombre: `Sucursal ${i + 1}`, ventas: i, activa: true }));

  it('sin pageSize muestra todo y no hay barra de paginación', async () => {
    await setup({ rows: MANY });
    expect(dataRows()).toHaveLength(8);
    expect(screen.queryByRole('button', { name: 'Página siguiente' })).not.toBeInTheDocument();
  });

  it('con pageSize muestra solo la página actual y el rango', async () => {
    await setup({ rows: MANY, pageSize: 3 });
    expect(firstColumn()).toEqual(['Sucursal 1', 'Sucursal 2', 'Sucursal 3']);
    expect(screen.getByText('1–3 de 8')).toBeInTheDocument();
  });

  it('avanza y retrocede de página', async () => {
    await setup({ rows: MANY, pageSize: 3 });
    await userEvent.click(screen.getByRole('button', { name: 'Página siguiente' }));
    expect(firstColumn()).toEqual(['Sucursal 4', 'Sucursal 5', 'Sucursal 6']);
    await userEvent.click(screen.getByRole('button', { name: 'Página siguiente' }));
    expect(firstColumn()).toEqual(['Sucursal 7', 'Sucursal 8']);
    expect(screen.getByRole('button', { name: 'Página siguiente' })).toBeDisabled();
    await userEvent.click(screen.getByRole('button', { name: 'Página anterior' }));
    expect(firstColumn()[0]).toBe('Sucursal 4');
  });

  it('ordenar vuelve a la primera página', async () => {
    await setup({ rows: MANY, pageSize: 3 });
    await userEvent.click(screen.getByRole('button', { name: 'Página siguiente' }));
    await userEvent.click(within(header('Nombre')).getByRole('button'));
    expect(screen.getByText('1–3 de 8')).toBeInTheDocument();
  });

  it('el orden se aplica a todos los datos, no solo a la página visible', async () => {
    await setup({ rows: MANY, pageSize: 3 });
    const button = within(header('Ventas')).getByRole('button');
    await userEvent.click(button);
    await userEvent.click(button);
    // Descendente: la mayor venta (Sucursal 8) debe abrir la primera página aunque estuviera en la última.
    expect(firstColumn()[0]).toBe('Sucursal 8');
  });

  it('si cambian los datos y la página actual ya no existe, vuelve a la primera', async () => {
    const { fixture } = await setup({ rows: MANY, pageSize: 3 });
    await userEvent.click(screen.getByRole('button', { name: 'Página siguiente' }));
    await userEvent.click(screen.getByRole('button', { name: 'Página siguiente' }));
    expect(firstColumn()).toEqual(['Sucursal 7', 'Sucursal 8']);

    (fixture.componentInstance as { rows: Branch[] }).rows = MANY.slice(0, 2);
    fixture.detectChanges();
    await fixture.whenStable();

    expect(firstColumn()).toEqual(['Sucursal 1', 'Sucursal 2']);
    expect(screen.getByText('1–2 de 2')).toBeInTheDocument();
  });
});

describe('DataTable — estados', () => {
  it('cargando sin datos: muestra un esqueleto (sin filas de datos), marca la tabla como ocupada y lo anuncia', async () => {
    await setup({ loading: true, rows: [] });
    expect(screen.getByRole('table')).toHaveAttribute('aria-busy', 'true');
    expect(screen.getByRole('status')).toHaveTextContent('Cargando datos…');
    expect(screen.queryByText('Norte')).not.toBeInTheDocument();
    expect(screen.queryByText('Sin sucursales')).not.toBeInTheDocument();
  });

  it('sin datos: estado vacío con título, descripción y la acción proyectada', async () => {
    await setup({ rows: [] });
    expect(screen.getByText('Sin sucursales')).toBeInTheDocument();
    expect(screen.getByText('Crea la primera para empezar.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Crear sucursal' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Página siguiente' })).not.toBeInTheDocument();
  });

  it('error: muestra el mensaje y permite reintentar', async () => {
    const { props } = await setup({ error: 'No se pudo conectar con el servidor.' });
    expect(screen.getByRole('alert')).toHaveTextContent('No se pudo conectar con el servidor.');
    expect(screen.queryByText('Norte')).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
    expect(props.onRetry).toHaveBeenCalledTimes(1);
  });

  it('con error y sin datos prevalece el error sobre el estado vacío', async () => {
    await setup({ rows: [], error: 'Falló' });
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.queryByText('Sin sucursales')).not.toBeInTheDocument();
  });

  it('cargando prevalece sobre el error', async () => {
    await setup({ loading: true, error: 'Falló' });
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  describe('recarga con datos a la vista (cambio de sucursal, filtro…)', () => {
    const body = () => screen.getAllByRole('rowgroup')[1];

    it('conserva las filas en lugar de volver al esqueleto, atenuadas y sin interacción', async () => {
      await setup({ loading: true });
      expect(firstColumn()).toEqual(['Norte', 'Álvaro Sur', 'Alberto Este', 'Zona Ñandú']);
      expect(body()).toHaveClass('opacity-40');
      expect(body()).toHaveClass('pointer-events-none');
      expect(screen.getByRole('table')).toHaveAttribute('aria-busy', 'true');
    });

    it('muestra la barra de progreso mientras actualiza y desaparece al terminar', async () => {
      const { container, fixture } = await setup({ loading: true });
      expect(container.querySelector('.animate-progress')).toBeInTheDocument();
      (fixture.componentInstance as { loading: boolean }).loading = false;
      fixture.detectChanges();
      expect(container.querySelector('.animate-progress')).not.toBeInTheDocument();
      expect(body()).not.toHaveClass('opacity-40');
    });

    it('al terminar, el cuerpo vuelve a opacidad completa con una transición (no de golpe)', async () => {
      await setup({ loading: true });
      expect(body()).toHaveClass('transition-opacity');
    });

    it('la paginación sigue visible durante la recarga (no salta el pie de la tabla)', async () => {
      await setup({ loading: true, pageSize: 2 });
      expect(screen.getByRole('button', { name: 'Página siguiente' })).toBeInTheDocument();
    });

    it('sin datos previos sigue siendo un esqueleto, sin barra de progreso', async () => {
      const { container } = await setup({ loading: true, rows: [] });
      expect(container.querySelector('.animate-progress')).not.toBeInTheDocument();
      expect(screen.queryByText('Norte')).not.toBeInTheDocument();
    });
  });
});

describe('DataTable — filas clicables', () => {
  it('por defecto las filas no son interactivas', async () => {
    const { props } = await setup();
    await userEvent.click(dataRows()[0]);
    expect(props.onRowClick).not.toHaveBeenCalled();
    expect(dataRows()[0]).not.toHaveAttribute('tabindex');
  });

  it('con clickableRows el clic emite la fila', async () => {
    const { props } = await setup({ clickableRows: true });
    await userEvent.click(dataRows()[1]);
    expect(props.onRowClick).toHaveBeenCalledWith(BRANCHES[1]);
  });

  it('con clickableRows se puede activar con teclado (Enter y Espacio)', async () => {
    const { props } = await setup({ clickableRows: true });
    dataRows()[2].focus();
    await userEvent.keyboard('{Enter}');
    await userEvent.keyboard(' ');
    expect(props.onRowClick).toHaveBeenCalledTimes(2);
    expect(props.onRowClick).toHaveBeenCalledWith(BRANCHES[2]);
  });

  it('hacer clic en un control dentro de la fila (p. ej. un botón) no dispara además el clic de la fila', async () => {
    const { props } = await setup({
      clickableRows: true,
      columns: [{ key: 'nombre', header: 'Nombre' }, { key: 'acciones', header: 'Acciones' }],
    });
    await userEvent.click(screen.getByRole('button', { name: 'Editar Norte' }));
    expect(props.onInner).toHaveBeenCalledWith(BRANCHES[0]);
    expect(props.onRowClick).not.toHaveBeenCalled();
  });
});

describe('DataTable — exportar a CSV', () => {
  let captured: { blob: Blob | null; name: string };

  beforeEach(() => {
    captured = { blob: null, name: '' };
    URL.createObjectURL = vi.fn((blob: Blob) => ((captured.blob = blob), 'blob:csv'));
    URL.revokeObjectURL = vi.fn();
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      captured.name = this.download;
    });
  });
  afterEach(() => vi.restoreAllMocks());

  const csvLines = async () => ((await captured.blob?.text()) ?? '').replace('\uFEFF', '').split('\r\n');
  const TABLE = (extra: string) =>
    `<app-data-table caption="Sucursales" [columns]="columns" [rows]="rows" [rowKey]="rowKey" ${extra}></app-data-table>`;
  const setupExport = (extra: string, props: Record<string, unknown> = {}) =>
    render(TABLE(extra), {
      imports,
      componentProperties: { columns: COLUMNS, rows: BRANCHES, rowKey: (r: Branch) => r.id, ...props },
    });

  it('sin exportName no hay botón de exportar', async () => {
    await setupExport('');
    expect(screen.queryByRole('button', { name: /Exportar CSV/ })).not.toBeInTheDocument();
  });

  it('con exportName aparece el botón y descarga <nombre>-<fecha>.csv con encabezados y todas las filas', async () => {
    await setupExport('exportName="sucursales"');
    await userEvent.click(screen.getByRole('button', { name: /Exportar CSV/ }));
    expect(captured.name).toMatch(/^sucursales-\d{4}-\d{2}-\d{2}\.csv$/);
    const lines = await csvLines();
    expect(lines[0]).toBe('Nombre,Ventas,Activa');
    expect(lines).toHaveLength(5); // encabezado + 4 sucursales
    expect(lines[1]).toBe('Norte,10,Sí');
  });

  it('el nombre del archivo lleva la fecha local, no la UTC (a las 11 p. m. sigue siendo el mismo día)', async () => {
    vi.useFakeTimers({ toFake: ['Date'], now: new Date(2026, 9, 18, 23, 30) });
    try {
      await setupExport('exportName="s"');
      await userEvent.click(screen.getByRole('button', { name: /Exportar CSV/ }));
      expect(captured.name).toBe('s-2026-10-18.csv');
    } finally {
      vi.useRealTimers();
    }
  });

  it('exporta todas las filas aunque la tabla esté paginada', async () => {
    await setupExport('exportName="s" [pageSize]="2"');
    expect(screen.getAllByRole('row').slice(1)).toHaveLength(2); // se ven 2
    await userEvent.click(screen.getByRole('button', { name: /Exportar CSV/ }));
    expect(await csvLines()).toHaveLength(5);
  });

  it('respeta el orden elegido en la tabla', async () => {
    await setupExport('exportName="s"');
    const nombre = within(screen.getByRole('columnheader', { name: /Nombre/ })).getByRole('button');
    await userEvent.click(nombre); // ascendente
    await userEvent.click(screen.getByRole('button', { name: /Exportar CSV/ }));
    const names = (await csvLines()).slice(1).map((l) => l.split(',')[0]);
    expect(names).toEqual(['Alberto Este', 'Álvaro Sur', 'Norte', 'Zona Ñandú']);
  });

  it('los números salen como números (sin formato) y los vacíos como celdas vacías', async () => {
    await setupExport('exportName="s"');
    await userEvent.click(screen.getByRole('button', { name: /Exportar CSV/ }));
    const lines = await csvLines();
    expect(lines.find((l) => l.startsWith('Alberto Este'))).toBe('Alberto Este,,');
    expect(lines.find((l) => l.startsWith('Zona Ñandú'))).toBe('Zona Ñandú,100,Sí');
  });

  it('la columna "acciones" y las que piden export:false no salen', async () => {
    await setupExport('exportName="s"', {
      columns: [...COLUMNS, { key: 'secreto', header: 'Secreto', export: false }, { key: 'acciones', header: 'Acciones' }],
    });
    await userEvent.click(screen.getByRole('button', { name: /Exportar CSV/ }));
    expect((await csvLines())[0]).toBe('Nombre,Ventas,Activa');
  });

  it('una columna puede dar su propio valor de exportación (listas, textos armados)', async () => {
    await setupExport('exportName="s"', {
      columns: [{ key: 'nombre', header: 'Sucursal' }, { key: 'etiqueta', header: 'Etiqueta', export: (r: Branch) => `#${r.id} ${r.nombre}` }],
    });
    await userEvent.click(screen.getByRole('button', { name: /Exportar CSV/ }));
    expect((await csvLines())[1]).toBe('Norte,#1 Norte');
  });

  it('exportColumns reemplaza las columnas de la pantalla en el archivo', async () => {
    await setupExport('exportName="s" [exportColumns]="extra"', { extra: [{ key: 'id', header: 'Código' }, { key: 'nombre', header: 'Nombre' }] });
    await userEvent.click(screen.getByRole('button', { name: /Exportar CSV/ }));
    const lines = await csvLines();
    expect(lines[0]).toBe('Código,Nombre');
    expect(lines[1]).toBe('1,Norte');
  });

  it('un valor que parece fórmula se neutraliza y uno con coma se entrecomilla', async () => {
    await setupExport('exportName="s"', {
      columns: [{ key: 'nombre', header: 'Nombre' }],
      rows: [{ id: 1, nombre: '=HYPERLINK("x")', ventas: 0, activa: true }, { id: 2, nombre: 'Uno, dos', ventas: 0, activa: true }],
    });
    await userEvent.click(screen.getByRole('button', { name: /Exportar CSV/ }));
    expect((await csvLines()).slice(1)).toEqual(['"\'=HYPERLINK(""x"")"', '"Uno, dos"']);
  });

  it('las fechas salen con día y hora legibles', async () => {
    await setupExport('exportName="s"', {
      columns: [{ key: 'cuando', header: 'Cuándo', value: () => new Date(2026, 9, 15, 14, 30) }],
    });
    await userEvent.click(screen.getByRole('button', { name: /Exportar CSV/ }));
    expect((await csvLines())[1]).toMatch(/15/);
    expect((await csvLines())[1]).toMatch(/14:30|2:30/);
  });

  it('sin filas, cargando o con error no se ofrece exportar', async () => {
    await setupExport('exportName="s"', { rows: [] });
    expect(screen.queryByRole('button', { name: /Exportar CSV/ })).not.toBeInTheDocument();
  });
});

describe('DataTable · orden recordado (persistKey)', () => {
  const STORE = 'zen:filters:7:table:sucursales';
  const TABLE = (extra: string) => `<app-data-table caption="Sucursales" [columns]="columns" [rows]="rows" [rowKey]="rowKey" ${extra}></app-data-table>`;
  const setup = (extra: string, columns = COLUMNS) =>
    render(TABLE(extra), { imports, componentProperties: { columns, rows: BRANCHES, rowKey: (r: Branch) => r.id } });
  const names = () => screen.getAllByRole('row').slice(1).map((r) => within(r).getAllByRole('cell')[0].textContent?.trim());
  const login = () => localStorage.setItem('zen_inventory_session', JSON.stringify({ token: 't', email: 'e', nombre: 'Ana', rol: 'ADMIN', id: 7 }));

  beforeEach(() => localStorage.clear());
  afterEach(() => localStorage.clear());

  it('guarda el orden elegido y la próxima vez la tabla ya viene ordenada así', async () => {
    login();
    const first = await setup('persistKey="sucursales"');
    await userEvent.click(within(screen.getByRole('columnheader', { name: /Ventas/ })).getByRole('button'));
    await userEvent.click(within(screen.getByRole('columnheader', { name: /Ventas/ })).getByRole('button'));
    await vi.waitFor(() => expect(JSON.parse(localStorage.getItem(STORE) ?? 'null')).toEqual({ sort: { key: 'ventas', direction: 'desc' } }));
    first.fixture.destroy();
    TestBed.resetTestingModule();

    await setup('persistKey="sucursales"');
    expect(screen.getByRole('columnheader', { name: /Ventas/ })).toHaveAttribute('aria-sort', 'descending');
    expect(names()).toEqual(['Zona Ñandú', 'Norte', 'Álvaro Sur', 'Alberto Este']); // mayor a menor; sin dato al final
  });

  it('sin persistKey no guarda ni recuerda nada', async () => {
    login();
    await setup('');
    await userEvent.click(within(screen.getByRole('columnheader', { name: /Nombre/ })).getByRole('button'));
    expect(localStorage.getItem(STORE)).toBeNull();
  });

  it('un orden guardado de una columna que no existe o no se ordena se ignora', async () => {
    login();
    localStorage.setItem(STORE, JSON.stringify({ sort: { key: 'activa', direction: 'asc' } })); // existe, pero no es ordenable
    await setup('persistKey="sucursales"');
    expect(screen.getByRole('columnheader', { name: /Nombre/ })).toHaveAttribute('aria-sort', 'none');
    expect(names()[0]).toBe('Norte'); // en el orden en que llegaron

    TestBed.resetTestingModule();
    localStorage.setItem(STORE, JSON.stringify({ sort: { key: 'inexistente', direction: 'asc' } }));
    await setup('persistKey="sucursales"');
    expect(names()[0]).toBe('Norte');
  });

  it('volver al orden original borra lo guardado', async () => {
    login();
    localStorage.setItem(STORE, JSON.stringify({ sort: { key: 'nombre', direction: 'asc' } }));
    await setup('persistKey="sucursales"');
    expect(screen.getByRole('columnheader', { name: /Nombre/ })).toHaveAttribute('aria-sort', 'ascending');
    await userEvent.click(within(screen.getByRole('columnheader', { name: /Nombre/ })).getByRole('button')); // desc
    await userEvent.click(within(screen.getByRole('columnheader', { name: /Nombre/ })).getByRole('button')); // sin orden
    await vi.waitFor(() => expect(localStorage.getItem(STORE)).toBeNull());
  });
});

describe('DataTable — paginación en el servidor ([total])', () => {
  // Quien usa la tabla entrega solo la página que se ve; la tabla no corta, no ordena ni exporta por su cuenta.
  const PAGE_ROWS = BRANCHES.slice(0, 3);
  const setup = (extra = '') =>
    render(
      `<app-data-table caption="Sucursales" [columns]="columns" [rows]="rows" [rowKey]="rowKey" [pageSize]="3" [total]="total" [(page)]="page" (sortChange)="onSort($event)" ${extra}></app-data-table>`,
      {
        imports,
        componentProperties: { columns: COLUMNS, rows: PAGE_ROWS, rowKey: (r: Branch) => r.id, total: 8, page: 1, onSort: vi.fn() },
      },
    );
  const names = () => screen.getAllByRole('row').slice(1).map((r) => within(r).getAllByRole('cell')[0].textContent?.trim());

  it('muestra las filas recibidas tal cual y cuenta páginas con el total del servidor', async () => {
    await setup();
    expect(names()).toEqual(['Norte', 'Álvaro Sur', 'Alberto Este']);
    expect(screen.getByText('1–3 de 8')).toBeInTheDocument();
    expect(screen.getByText('Página 1 de 3')).toBeInTheDocument();
  });

  it('al cambiar de página actualiza [(page)] para que quien la usa pida esa página', async () => {
    const { fixture } = await setup();
    await userEvent.click(screen.getByRole('button', { name: 'Página siguiente' }));
    expect(fixture.componentInstance['page']).toBe(2);
  });

  it('ordenar emite sortChange y no reordena las filas recibidas', async () => {
    const { fixture } = await setup();
    await userEvent.click(within(screen.getByRole('columnheader', { name: /Nombre/ })).getByRole('button'));
    expect(fixture.componentInstance['onSort']).toHaveBeenLastCalledWith({ key: 'nombre', direction: 'asc' });
    expect(names()).toEqual(['Norte', 'Álvaro Sur', 'Alberto Este']); // el servidor es quien las ordena
  });

  it('no ofrece exportar: solo tendría la página que se ve', async () => {
    await setup('exportName="sucursales"');
    expect(screen.queryByRole('button', { name: /Exportar CSV/ })).not.toBeInTheDocument();
  });
});
