import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { LucideArrowUpDown, LucideCalendar, LucideHash, LucideInfo, LucideListFilter, LucideMessageSquareText, LucidePackage, LucideScale, LucideSearch } from '@lucide/angular';
import { toApiError } from '@core/api/api-error';
import { formatDateTime, formatQuantity, normalizeText } from '@shared/format/format';
import { inDateRange } from '@shared/filters/filter-helpers';
import { Badge } from '@shared/ui/badge/badge';
import { DataTable, DataTableCell, type TableColumn } from '@shared/ui/data-table/data-table';
import { DatePicker } from '@shared/ui/date-picker/date-picker';
import { type ActiveFilter, ActiveFilters } from '@shared/ui/filters/active-filters';
import { FormField, InputDirective } from '@shared/ui/form-field/form-field';
import { MultiSelect } from '@shared/ui/multi-select/multi-select';
import { Segmented, type SegmentedOption } from '@shared/ui/segmented/segmented';
import type { SelectOption } from '@shared/ui/select/select';
import { type InventoryItem, InventoryApi, type Movement, type MovementReason, type MovementType } from '../../data-access/inventory-api';
import { REASON_LABELS, subReasonLabel } from '../../data-access/inventory-labels';

/** Fila del kardex: el movimiento con el nombre de su producto. */
interface MovementRow extends Movement {
  readonly productName: string;
}

/** Movimientos con signo: los retiros restan, para mostrarlos y ordenarlos como "+5" / "−3". */
const signed = (row: Movement): number => (row.type === 'INGRESO' ? row.quantity : -row.quantity);

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

    <app-data-table
      caption="Historial de movimientos"
      exportName="kardex"
      [columns]="columns"
      [rows]="rows()"
      [rowKey]="rowKey"
      [loading]="loading()"
      [error]="error()"
      [pageSize]="15"
      minWidth="56rem"
      [emptyTitle]="activeFilters().length === 0 ? 'Sin movimientos' : 'Ningún movimiento coincide'"
      [emptyDescription]="activeFilters().length === 0 ? 'Los ingresos y retiros de existencias aparecerán aquí.' : 'Prueba quitando algún filtro.'"
      (retry)="load()"
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
  private readonly api = inject(InventoryApi);

  readonly branchId = input.required<number>();
  /** Productos de la sucursal: sirven para el filtro y para nombrar cada movimiento. */
  readonly products = input.required<readonly InventoryItem[]>();

  protected readonly columns = COLUMNS;
  protected readonly rowKey = rowKey;
  protected readonly packageIcon = LucidePackage.icon;
  protected readonly filterIcon = LucideListFilter.icon;
  protected readonly typeOptions = TYPE_OPTIONS;
  protected readonly reasonOptions = REASON_OPTIONS;
  protected readonly formatQuantity = formatQuantity;

  protected readonly productIds = signal<readonly number[]>([]);
  protected readonly search = signal('');
  protected readonly typeFilter = signal<TypeFilter>('all');
  protected readonly reasonFilter = signal<readonly MovementReason[]>([]);
  protected readonly from = signal<Date | null>(null);
  protected readonly to = signal<Date | null>(null);
  /** Con un solo producto se pide su kardex al servidor; con ninguno o con varios se pide el general y se filtra aquí. */
  private readonly serverProductId = computed(() => (this.productIds().length === 1 ? this.productIds()[0] : null));
  private readonly movements = signal<readonly Movement[]>([]);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);

  protected readonly productOptions = computed<SelectOption<number>[]>(() =>
    this.products().map((product) => ({ value: product.productId, label: product.nombre, description: product.sku || undefined })),
  );

  protected readonly rows = computed<MovementRow[]>(() => {
    const names = new Map(this.products().map((product) => [product.productId, product.nombre]));
    const chosen = new Set(this.productIds());
    const reasons = new Set(this.reasonFilter());
    const type = this.typeFilter();
    const from = this.from();
    const to = this.to();
    const needle = normalizeText(this.search().trim());
    return this.movements()
      .filter((movement) => chosen.size < 2 || chosen.has(movement.productId))
      .filter((movement) => type === 'all' || movement.type === type)
      .filter((movement) => reasons.size === 0 || reasons.has(movement.reason))
      .filter((movement) => inDateRange(movement.date, from, to))
      .map((movement) => ({ ...movement, productName: names.get(movement.productId) ?? `Producto ${movement.productId}` }))
      .filter((row) => needle === '' || normalizeText(`${row.productName} ${this.reasonLabel(row)} ${row.observations}`).includes(needle));
  });

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

  /** Para descartar la respuesta de una consulta anterior si el usuario cambió de sucursal o de producto mientras llegaba. */
  private requestId = 0;

  constructor() {
    effect(() => {
      this.branchId();
      this.serverProductId();
      untracked(() => this.load());
    });
  }

  protected onSearch(event: Event): void {
    this.search.set((event.target as HTMLInputElement).value);
  }

  protected removeFilter(id: string): void {
    switch (id) {
      case 'products': this.productIds.set([]); break;
      case 'type': this.typeFilter.set('all'); break;
      case 'reasons': this.reasonFilter.set([]); break;
      case 'from': this.from.set(null); break;
      case 'to': this.to.set(null); break;
      case 'search': this.search.set(''); break;
    }
  }

  protected clearFilters(): void {
    for (const filter of this.activeFilters()) this.removeFilter(filter.id);
  }

  protected reasonLabel(row: Movement): string {
    const label = REASON_LABELS[row.reason];
    return row.subReason ? `${label} · ${subReasonLabel(row.subReason)}` : label;
  }

  protected load(): void {
    const id = ++this.requestId;
    this.loading.set(true);
    this.error.set(null);
    this.api.movements(this.branchId(), this.serverProductId()).subscribe({
      next: (movements) => {
        if (id !== this.requestId) return;
        this.movements.set(movements);
        this.loading.set(false);
      },
      error: (error: unknown) => {
        if (id !== this.requestId) return;
        this.error.set(toApiError(error).message);
        this.loading.set(false);
      },
    });
  }
}
