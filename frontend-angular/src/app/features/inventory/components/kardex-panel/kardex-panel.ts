import { ChangeDetectionStrategy, Component, computed, inject, input, signal, untracked } from '@angular/core';
import { firstValueFrom, map } from 'rxjs';
import { LucideArrowUpDown, LucideCalendar, LucideHash, LucideInfo, LucideListFilter, LucideMessageSquareText, LucidePackage, LucideScale, LucideSearch } from '@lucide/angular';
import { type MovementQuery, type MovementRecord, MovementSearchApi } from '@core/inventory/movement-search-api';
import { debouncedText } from '@shared/data/debounced-text';
import { type PagedQuery, serverPagedList } from '@shared/data/server-paged-list';
import { formatDateTime, formatQuantity } from '@shared/format/format';
import { Badge } from '@shared/ui/badge/badge';
import { DataTable, DataTableCell, type TableColumn } from '@shared/ui/data-table/data-table';
import { DatePicker } from '@shared/ui/date-picker/date-picker';
import { type ActiveFilter, ActiveFilters } from '@shared/ui/filters/active-filters';
import { FormField, InputDirective } from '@shared/ui/form-field/form-field';
import { MultiSelect } from '@shared/ui/multi-select/multi-select';
import { Segmented, type SegmentedOption } from '@shared/ui/segmented/segmented';
import type { SelectOption } from '@shared/ui/select/select';
import type { InventoryItem, MovementReason, MovementType } from '../../data-access/inventory-api';
import { REASON_LABELS, subReasonLabel } from '../../data-access/inventory-labels';

/** Fila del kardex: el movimiento tal como lo manda el servidor (ya trae el nombre del producto y el saldo). */
type MovementRow = MovementRecord;

/** Movimientos con signo: los retiros restan, para mostrarlos y exportarlos como "+5" / "−3". */
const signed = (row: MovementRow): number => (row.type === 'INGRESO' ? row.quantity : -row.quantity);

/** Columna de la tabla → campo de orden del servidor. */
const SORT_KEYS: Readonly<Record<string, string>> = { date: 'date', productName: 'product', type: 'type', reason: 'reason', quantity: 'quantity' };
const PAGE_SIZE = 15;

const COLUMNS: readonly TableColumn<MovementRow>[] = [
  { key: 'date', header: 'Fecha', icon: LucideCalendar.icon, sortable: true, nowrap: true, width: '11.5rem', value: (r) => r.date, display: (r) => formatDateTime(r.date) },
  { key: 'productName', header: 'Producto', icon: LucidePackage.icon, sortable: true, primary: true },
  { key: 'type', header: 'Tipo', icon: LucideArrowUpDown.icon, sortable: true },
  { key: 'reason', header: 'Motivo', icon: LucideInfo.icon, sortable: true, value: (r) => REASON_LABELS[r.reason] },
  { key: 'quantity', header: 'Cantidad', icon: LucideHash.icon, sortable: true, align: 'end', value: signed },
  { key: 'balance', header: 'Saldo', icon: LucideScale.icon, align: 'end', display: (r) => formatQuantity(r.balance) },
  { key: 'observations', header: 'Observaciones', icon: LucideMessageSquareText.icon },
];

const rowKey = (row: MovementRow): number => row.id;

type TypeFilter = 'all' | MovementType;
const TYPE_OPTIONS: readonly SegmentedOption<TypeFilter>[] = [
  { value: 'all', label: 'Todos' },
  { value: 'INGRESO', label: 'Ingresos' },
  { value: 'RETIRO', label: 'Retiros' },
];
const TYPE_LABELS: Record<MovementType, string> = { INGRESO: 'Ingresos', RETIRO: 'Retiros' };
const REASON_OPTIONS: readonly SelectOption<MovementReason>[] = (Object.entries(REASON_LABELS) as [MovementReason, string][]).map(([value, label]) => ({ value, label }));
const DAY = new Intl.DateTimeFormat('es-CO', { dateStyle: 'medium' });

/** «A», «A y B», «A, B y 2 más»: para nombrar lo elegido en una etiqueta de filtro. */
function summarize(names: readonly string[]): string {
  if (names.length <= 2) return names.join(' y ');
  return `${names[0]}, ${names[1]} y ${names.length - 2} más`;
}

/** Historial de movimientos (kardex) de una sucursal, de un producto o de todos. */
@Component({
  selector: 'app-kardex-panel',
  imports: [DataTable, DataTableCell, Badge, MultiSelect, Segmented, DatePicker, FormField, InputDirective, ActiveFilters, LucideSearch],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="mb-3 flex flex-wrap items-center gap-3">
      <div class="min-w-44 max-w-56 flex-1">
        <app-form-field>
          <input appInput type="search" placeholder="Buscar en el kardex…" aria-label="Buscar en el kardex" autocomplete="off" [value]="search()" (input)="onSearch($event)" />
          <svg data-slot="prefix" lucideSearch [size]="16" aria-hidden="true"></svg>
        </app-form-field>
      </div>
      <div class="w-56 max-w-full">
        <app-multi-select
          [(values)]="productIds"
          [options]="productOptions()"
          [icon]="packageIcon"
          searchPlaceholder="Buscar producto…"
          ariaLabel="Filtrar por producto"
          placeholder="Todos los productos"
        />
      </div>
      <app-segmented [options]="typeOptions" [(value)]="typeFilter" size="lg" ariaLabel="Tipo de movimiento" />
      <div class="w-52 max-w-full">
        <app-multi-select [(values)]="reasonFilter" [options]="reasonOptions" [icon]="filterIcon" ariaLabel="Filtrar por motivo" placeholder="Todos los motivos" searchPlaceholder="Buscar motivo…" />
      </div>
      <div class="w-34"><app-date-picker [(value)]="from" [max]="to()" placeholder="Desde" ariaLabel="Desde" /></div>
      <div class="w-34"><app-date-picker [(value)]="to" [min]="from()" placeholder="Hasta" ariaLabel="Hasta" /></div>
    </div>
    <app-active-filters class="mb-4" [filters]="activeFilters()" (removed)="removeFilter($event)" (cleared)="clearFilters()" />
    @if (!error() && total() > 0) {
      <p class="mb-3 text-sm text-fg-subtle">{{ summary() }}</p>
    }

    <app-data-table
      caption="Historial de movimientos"
      exportName="kardex"
      [columns]="columns"
      [rows]="rows()"
      [rowKey]="rowKey"
      [loading]="loading()"
      [error]="error()"
      [pageSize]="pageSize"
      [total]="total()"
      [(page)]="page"
      [exportAll]="exportAll"
      minWidth="56rem"
      [emptyTitle]="activeFilters().length === 0 ? 'Sin movimientos' : 'Ningún movimiento coincide'"
      [emptyDescription]="activeFilters().length === 0 ? 'Los ingresos y retiros de existencias aparecerán aquí.' : 'Prueba quitando algún filtro.'"
      (retry)="load()"
      (sortChange)="sort.set($event)"
    >
      <ng-template appCell="type" let-row>
        <app-badge [variant]="row.type === 'INGRESO' ? 'success' : 'danger'">{{ row.type === 'INGRESO' ? 'Ingreso' : 'Retiro' }}</app-badge>
      </ng-template>
      <ng-template appCell="reason" let-row>
        {{ reasonLabel(row) }}
      </ng-template>
      <ng-template appCell="quantity" let-row>
        <span class="font-semibold tabular-nums" [class]="row.type === 'INGRESO' ? 'text-success' : 'text-danger'">
          {{ row.type === 'INGRESO' ? '+' : '−' }}{{ formatQuantity(row.quantity) }}
        </span>
      </ng-template>
      <ng-template appCell="observations" let-row>
        <span class="block max-w-64 truncate text-fg-muted" [attr.title]="row.observations || null">{{ row.observations || '—' }}</span>
      </ng-template>
    </app-data-table>
  `,
})
export class KardexPanel {
  private readonly api = inject(MovementSearchApi);

  readonly branchId = input.required<number>();
  /** Productos de la sucursal: son las opciones del filtro de producto. */
  readonly products = input.required<readonly InventoryItem[]>();

  protected readonly columns = COLUMNS;
  protected readonly rowKey = rowKey;
  protected readonly pageSize = PAGE_SIZE;
  protected readonly packageIcon = LucidePackage.icon;
  protected readonly filterIcon = LucideListFilter.icon;
  protected readonly typeOptions = TYPE_OPTIONS;
  protected readonly reasonOptions = REASON_OPTIONS;
  protected readonly formatQuantity = formatQuantity;

  protected readonly productIds = signal<readonly number[]>([]);
  private readonly searchBox = debouncedText();
  protected readonly search = this.searchBox.text;
  protected readonly typeFilter = signal<TypeFilter>('all');
  protected readonly reasonFilter = signal<readonly MovementReason[]>([]);
  protected readonly from = signal<Date | null>(null);
  protected readonly to = signal<Date | null>(null);
  protected readonly sort = signal<{ key: string; direction: 'asc' | 'desc' } | null>(null);

  protected readonly productOptions = computed<SelectOption<number>[]>(() =>
    this.products().map((product) => ({ value: product.productId, label: product.nombre, description: product.sku || undefined })),
  );

  /** Lo que se filtra en el servidor; la sucursal es siempre la elegida en Inventario. */
  private readonly filters = computed(() => ({
    branchId: this.branchId(),
    productIds: this.productIds(),
    type: this.typeFilter() === 'all' ? null : (this.typeFilter() as MovementType),
    reasons: this.reasonFilter(),
    from: this.from(),
    to: this.to(),
    text: this.searchBox.term(),
  }));

  private readonly list = serverPagedList({
    filters: this.filters,
    sort: this.sort,
    size: PAGE_SIZE,
    fetch: (query) => this.api.search(toMovementQuery(query)).pipe(map((page) => ({ ...page, rows: page.movements }))),
  });
  protected readonly rows = this.list.rows;
  protected readonly total = this.list.total;
  protected readonly loading = this.list.loading;
  protected readonly error = this.list.error;
  protected readonly page = this.list.page;

  /** Resumen de todo lo filtrado (lo suma el servidor), no solo de la página. */
  protected readonly summary = computed(() => {
    const total = this.total();
    const label = total === 1 ? '1 movimiento' : `${formatQuantity(total)} movimientos`;
    return `${label}: entraron ${formatQuantity(this.list.last()?.totalIn ?? 0)} unidades y salieron ${formatQuantity(this.list.last()?.totalOut ?? 0)}`;
  });

  /** Para el CSV: todo lo filtrado, en el orden elegido. */
  protected readonly exportAll = (): Promise<readonly MovementRow[]> => firstValueFrom(this.api.exportAll(toMovementQuery(untracked(this.list.query))));

  /** Los filtros aplicados, como etiquetas que se quitan una a una. */
  protected readonly activeFilters = computed<ActiveFilter[]>(() => {
    const list: ActiveFilter[] = [];
    const names = new Map(this.products().map((product) => [product.productId, product.nombre]));
    if (this.productIds().length > 0) list.push({ id: 'products', label: 'Producto', text: summarize(this.productIds().map((id) => names.get(id) ?? `Producto ${id}`)) });
    if (this.typeFilter() !== 'all') list.push({ id: 'type', label: 'Tipo', text: TYPE_LABELS[this.typeFilter() as MovementType] });
    if (this.reasonFilter().length > 0) list.push({ id: 'reasons', label: 'Motivo', text: summarize(this.reasonFilter().map((reason) => REASON_LABELS[reason])) });
    if (this.from() !== null) list.push({ id: 'from', label: 'Desde', text: DAY.format(this.from()!) });
    if (this.to() !== null) list.push({ id: 'to', label: 'Hasta', text: DAY.format(this.to()!) });
    if (this.search().trim()) list.push({ id: 'search', label: 'Búsqueda', text: this.search().trim() });
    return list;
  });

  protected load(): Promise<void> {
    return this.list.reload();
  }

  protected onSearch(event: Event): void {
    this.searchBox.set((event.target as HTMLInputElement).value);
  }

  protected removeFilter(id: string): void {
    switch (id) {
      case 'products': this.productIds.set([]); break;
      case 'type': this.typeFilter.set('all'); break;
      case 'reasons': this.reasonFilter.set([]); break;
      case 'from': this.from.set(null); break;
      case 'to': this.to.set(null); break;
      case 'search': this.searchBox.clear(); break;
    }
  }

  protected clearFilters(): void {
    for (const filter of this.activeFilters()) this.removeFilter(filter.id);
  }

  protected reasonLabel(row: MovementRow): string {
    const label = REASON_LABELS[row.reason];
    return row.subReason ? `${label} · ${subReasonLabel(row.subReason)}` : label;
  }
}

/** Filtros del kardex → consulta de la búsqueda de movimientos (del más reciente, si no se eligió otro orden). */
function toMovementQuery({ sort, ...query }: PagedQuery<{ branchId: number; productIds: readonly number[]; type: MovementType | null; reasons: readonly MovementReason[]; from: Date | null; to: Date | null; text: string }>): MovementQuery {
  return {
    ...query,
    userId: null,
    minQuantity: null,
    maxQuantity: null,
    onlyObserved: false,
    sortBy: sort ? (SORT_KEYS[sort.key] ?? 'date') : 'date',
    ascending: sort ? sort.direction === 'asc' : false,
  };
}
