import { render, screen, within } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Badge } from '../badge/badge';
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
  it('cargando: muestra un esqueleto (sin filas de datos), marca la tabla como ocupada y lo anuncia', async () => {
    await setup({ loading: true });
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
