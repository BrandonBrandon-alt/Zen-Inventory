import { NgTemplateOutlet } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  Directive,
  TemplateRef,
  booleanAttribute,
  computed,
  contentChildren,
  effect,
  inject,
  input,
  model,
  output,
  signal,
  untracked,
} from '@angular/core';
import { LucideArrowDown, LucideArrowUp, LucideArrowUpDown, LucideDownload, LucideDynamicIcon, type LucideIconData, LucideInbox, LucideTriangleAlert } from '@lucide/angular';
import { downloadCsv, toCsv } from '@shared/export/csv';
import { formatDateTime } from '@shared/format/format';
import { type FilterCodec, loadStored, saveStored } from '@shared/filters/persisted-filter';
import { AuthStore } from '@core/auth/session/auth-store';
import { Button } from '../button/button';
import { EmptyState } from '../empty-state/empty-state';
import { Pagination } from '../pagination/pagination';

export type CellValue = string | number | boolean | Date | null | undefined;

export interface TableColumn<T> {
  /** Identificador de la columna; también la propiedad de la fila que se muestra si no hay `value`. */
  readonly key: string;
  readonly header: string;
  /** Icono que acompaña al encabezado y da una pista visual de qué contiene la columna. */
  readonly icon?: LucideIconData;
  /** Valor de la celda: es lo que se muestra (salvo `display`) y lo que se ordena. */
  readonly value?: (row: T) => CellValue;
  /** Texto a mostrar cuando difiere del valor ordenable (p. ej. un precio con símbolo de moneda). */
  readonly display?: (row: T) => string;
  readonly align?: 'start' | 'center' | 'end';
  readonly sortable?: boolean;
  /** Columna que identifica la fila (nombre, código): se destaca tipográficamente. */
  readonly primary?: boolean;
  readonly width?: string;
  /** El contenido no se parte en varias líneas (códigos, fechas, cifras): la columna toma el ancho que necesita. */
  readonly nowrap?: boolean;
  /**
   * Cómo sale la columna en el CSV: `false` la deja fuera; una función da el valor (útil para listas o textos armados);
   * sin ella se exporta el valor de la celda (los números como números, las fechas con su hora, los Sí/No en texto).
   */
  readonly export?: false | ((row: T) => CellValue);
}

/** Contexto de una plantilla de celda: `let-row` es la fila. */
export interface DataTableCellContext<T> {
  $implicit: T;
}

/**
 * Plantilla para personalizar las celdas de una columna:
 * `<ng-template appCell="estado" let-row><app-badge>…</app-badge></ng-template>`.
 */
@Directive({ selector: 'ng-template[appCell]' })
export class DataTableCell {
  /** `key` de la columna a la que reemplaza el contenido. */
  readonly name = input.required<string>({ alias: 'appCell' });
  readonly template = inject<TemplateRef<DataTableCellContext<unknown>>>(TemplateRef);
}

type Direction = 'asc' | 'desc';

const collator = new Intl.Collator('es', { numeric: true, sensitivity: 'base' });

const SKELETON_ROWS = [0, 1, 2, 3, 4];
const SKELETON_WIDTHS = ['w-3/4', 'w-1/2', 'w-2/3', 'w-1/3'];

function compareValues(a: CellValue, b: CellValue): number {
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  if (a instanceof Date && b instanceof Date) return a.getTime() - b.getTime();
  if (typeof a === 'boolean' && typeof b === 'boolean') return Number(a) - Number(b);
  return collator.compare(String(a), String(b));
}

/**
 * Tabla de datos reutilizable: ordenación, paginación, estados de carga/vacío/error y celdas personalizables.
 * Es de solo presentación: no pide datos ni filtra; la pantalla le entrega `rows` ya listos.
 */
@Component({
  selector: 'app-data-table',
  imports: [NgTemplateOutlet, Button, EmptyState, Pagination, LucideDownload, LucideDynamicIcon, LucideArrowUp, LucideArrowDown, LucideArrowUpDown, LucideInbox, LucideTriangleAlert],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  templateUrl: './data-table.html',
})
export class DataTable<T> {
  /** Nombre accesible de la tabla (se lee como su título). */
  readonly caption = input.required<string>();
  readonly columns = input.required<readonly TableColumn<T>[]>();
  readonly rows = input.required<readonly T[]>();
  /** Identificador estable de cada fila (para que Angular reutilice el DOM al ordenar/paginar). */
  readonly rowKey = input.required<(row: T) => string | number>();

  readonly loading = input(false, { transform: booleanAttribute });
  /** Mensaje de error de la carga; muestra el estado de error con "Reintentar". */
  readonly error = input<string | null>(null);
  /** Filas por página; `null` muestra todas sin paginación. */
  readonly pageSize = input<number | null>(null);
  /**
   * Paginación en el servidor: total de filas que cumplen los filtros (no solo las recibidas). Con este valor la tabla
   * no corta ni ordena `rows` (ya llegan como deben): pide la página con `[(page)]` y el orden con `(sortChange)`.
   */
  readonly total = input<number | null>(null);
  /** Página visible, desde 1. Con paginación en el servidor la controla quien usa la tabla. */
  readonly page = model(1);
  readonly clickableRows = input(false, { transform: booleanAttribute });
  /** Ancho mínimo de la tabla: por debajo, se desplaza horizontalmente en vez de comprimirse. */
  readonly minWidth = input('40rem');

  readonly emptyTitle = input('No hay datos para mostrar');
  readonly emptyDescription = input<string>();

  /**
   * Activa el botón "Exportar CSV" sobre la tabla; es el comienzo del nombre del archivo (`inventario` → `inventario-2026-10-18.csv`).
   * Exporta todas las filas recibidas (no solo la página que se ve), en el orden elegido; la columna de acciones no sale.
   */
  readonly exportName = input<string | null>(null);
  /** Si se indica, el orden de la tabla se recuerda por persona (p. ej. `ventas`): vuelve como se dejó la última vez. */
  readonly persistKey = input<string | null>(null);
  /** Columnas del CSV cuando difieren de las de la pantalla (p. ej. para agregar observaciones largas). */
  readonly exportColumns = input<readonly TableColumn<T>[] | null>(null);

  readonly rowClick = output<T>();
  /** El orden elegido (`null`: el original). Solo se usa con paginación en el servidor. */
  readonly sortChange = output<{ key: string; direction: Direction } | null>();
  readonly retry = output<void>();

  private readonly cells = contentChildren(DataTableCell);

  protected readonly skeletonRows = SKELETON_ROWS;
  protected readonly skeletonWidths = SKELETON_WIDTHS;

  protected readonly sort = signal<{ key: string; direction: Direction } | null>(null);
  protected readonly serverSide = computed(() => this.total() !== null);

  private readonly templates = computed(() => new Map(this.cells().map((cell) => [cell.name(), cell.template])));

  /** Primera carga (o tabla vacía): se dibuja el esqueleto. */
  protected readonly skeleton = computed(() => this.loading() && (this.rows().length === 0 || !!this.error()));
  /** Recarga con datos ya a la vista (cambio de sucursal, filtro…): se conservan atenuados hasta que llegan los nuevos. */
  protected readonly refreshing = computed(() => this.loading() && this.rows().length > 0 && !this.error());

  protected readonly sortedRows = computed(() => {
    const sort = this.sort();
    const column = sort ? this.columns().find((c) => c.key === sort.key) : undefined;
    if (!sort || !column || this.serverSide()) return this.rows();
    const sign = sort.direction === 'asc' ? 1 : -1;
    return [...this.rows()].sort((a, b) => {
      const va = this.valueOf(column, a);
      const vb = this.valueOf(column, b);
      // Los vacíos van siempre al final, sea cual sea la dirección.
      if (va == null || vb == null) return va == null ? (vb == null ? 0 : 1) : -1;
      return sign * compareValues(va, vb);
    });
  });

  protected readonly pageCount = computed(() => {
    const size = this.pageSize();
    return size ? Math.max(1, Math.ceil((this.total() ?? this.rows().length) / size)) : 1;
  });

  protected readonly visibleRows = computed(() => {
    const size = this.pageSize();
    if (!size || this.serverSide()) return this.sortedRows();
    const start = (Math.min(this.page(), this.pageCount()) - 1) * size;
    return this.sortedRows().slice(start, start + size);
  });

  /** Hay datos que exportar: el botón va sobre la tabla (no cuando se carga, falla o no hay filas). */
  protected readonly showExport = computed(() => !!this.exportName() && !this.serverSide() && !this.skeleton() && !this.error() && this.rows().length > 0);

  /** Paginación bajo la tabla. */
  protected readonly showFooter = computed(() => !this.skeleton() && !this.error() && this.rows().length > 0 && !!this.pageSize());

  protected readonly currentPage = computed(() => Math.min(this.page(), this.pageCount()));

  private readonly userId = inject(AuthStore).session()?.id;

  /** Los datos acaban de llegar (de marcador a filas): un fundido breve, una sola vez, en lugar de un corte seco. */
  protected readonly revealing = signal(false);
  private revealTimer: ReturnType<typeof setTimeout> | undefined;

  constructor() {
    let wasSkeleton = false;
    effect(() => {
      const isSkeleton = this.skeleton();
      if (wasSkeleton && !isSkeleton) {
        this.revealing.set(true);
        clearTimeout(this.revealTimer);
        this.revealTimer = setTimeout(() => this.revealing.set(false), 200);
      }
      wasSkeleton = isSkeleton;
    });
    // El orden recordado se lee una vez, cuando la pantalla dice cómo se llama (y solo si esa columna existe y se puede ordenar).
    let hydrated = false;
    effect(() => {
      const key = this.persistKey();
      const columns = this.columns();
      if (!key || hydrated) return;
      hydrated = true;
      const codec: FilterCodec<{ key: string; direction: Direction }> = {
        parse: (raw) => {
          const value = raw as { key?: unknown; direction?: unknown } | null;
          const column = columns.find((c) => c.key === value?.key);
          return column?.sortable && (value?.direction === 'asc' || value?.direction === 'desc') ? { key: column.key, direction: value.direction } : undefined;
        },
      };
      const saved = loadStored(this.userId, `table:${key}`, 'sort', codec);
      if (saved) untracked(() => this.sort.set(saved));
    });
    effect(() => {
      const key = this.persistKey();
      const sort = this.sort();
      if (key && hydrated) saveStored(this.userId, `table:${key}`, 'sort', sort, null);
    });
    // Si cambian los datos o el orden, se vuelve a la primera página (con paginación en el servidor, quien la usa decide).
    effect(() => {
      if (this.serverSide()) return;
      this.rows();
      this.sort();
      untracked(() => this.page.set(1));
    });
    effect(() => {
      const sort = this.sort();
      if (!untracked(() => this.serverSide())) return;
      untracked(() => {
        this.page.set(1);
        this.sortChange.emit(sort);
      });
    });
  }

  protected templateFor(column: TableColumn<T>): TemplateRef<DataTableCellContext<unknown>> | undefined {
    return this.templates().get(column.key);
  }

  protected text(column: TableColumn<T>, row: T): string {
    if (column.display) return column.display(row);
    const value = this.valueOf(column, row);
    if (value == null || value === '') return '—';
    if (typeof value === 'boolean') return value ? 'Sí' : 'No';
    if (value instanceof Date) return value.toLocaleDateString('es-CO');
    if (typeof value === 'number') return value.toLocaleString('es-CO');
    return value;
  }

  /** Descarga el CSV con todas las filas y las columnas exportables, en el orden actual. */
  protected exportCsv(): void {
    const name = this.exportName();
    if (!name || this.rows().length === 0) return;
    const columns = (this.exportColumns() ?? this.columns()).filter((c) => c.export !== false && c.key !== 'acciones');
    const header = columns.map((c) => c.header);
    const body = this.sortedRows().map((row) => columns.map((c) => this.exportValue(c, row)));
    // Fecha local (no UTC): de noche el día del archivo no debe saltar al siguiente.
    const now = new Date();
    const stamp = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    downloadCsv(`${name}-${stamp}.csv`, toCsv([header, ...body]));
  }

  private exportValue(column: TableColumn<T>, row: T): string | number | null {
    const raw: CellValue | unknown = typeof column.export === 'function' ? column.export(row) : this.valueOf(column, row);
    if (raw == null || raw === '') return '';
    if (typeof raw === 'number') return raw;
    if (typeof raw === 'boolean') return raw ? 'Sí' : 'No';
    if (raw instanceof Date) return Number.isNaN(raw.getTime()) ? '' : formatDateTime(raw);
    if (typeof raw === 'string') return raw;
    // Un objeto o lista no cabe en una celda: se usa el texto que la tabla muestra (si lo hay).
    return column.display ? column.display(row) : '';
  }

  protected ariaSort(column: TableColumn<T>): 'ascending' | 'descending' | 'none' | null {
    if (!column.sortable) return null;
    const sort = this.sort();
    if (sort?.key !== column.key) return 'none';
    return sort.direction === 'asc' ? 'ascending' : 'descending';
  }

  protected direction(column: TableColumn<T>): Direction | null {
    const sort = this.sort();
    return sort?.key === column.key ? sort.direction : null;
  }

  /** Ciclo de ordenación: ascendente → descendente → orden original. */
  protected toggleSort(column: TableColumn<T>): void {
    const current = this.sort();
    if (current?.key !== column.key) this.sort.set({ key: column.key, direction: 'asc' });
    else if (current.direction === 'asc') this.sort.set({ key: column.key, direction: 'desc' });
    else this.sort.set(null);
  }

  protected setPage(page: number): void {
    this.page.set(Math.min(Math.max(1, page), this.pageCount()));
  }

  protected onRowClick(event: Event, row: T): void {
    // Un botón o enlace dentro de la fila tiene su propia acción: no se activa además la de la fila.
    if (event.target instanceof Element && event.target.closest('button, a, input, select, textarea, [role="button"]')) return;
    this.rowClick.emit(row);
  }

  protected onRowKey(event: Event, row: T): void {
    if (event.target !== event.currentTarget) return;
    event.preventDefault();
    this.rowClick.emit(row);
  }

  protected alignClass(column: TableColumn<T>): string {
    return { start: 'text-left', center: 'text-center', end: 'text-right tabular-nums' }[column.align ?? 'start'];
  }

  private valueOf(column: TableColumn<T>, row: T): CellValue {
    return column.value ? column.value(row) : (row as Record<string, CellValue>)[column.key];
  }
}
