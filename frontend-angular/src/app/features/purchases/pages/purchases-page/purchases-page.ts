import { ChangeDetectionStrategy, Component, computed, inject, signal, untracked } from '@angular/core';
import { catchError, firstValueFrom, forkJoin, map, of } from 'rxjs';
import {
  LucideCalendar,
  LucideCircleCheck,
  LucideEye,
  LucideHash,
  LucideListFilter,
  LucidePlus,
  LucideSearch,
  LucideStore,
  LucideTruck,
  LucideWallet,
  LucideCoins,
} from '@lucide/angular';
import { toApiError } from '@core/api/api-error';
import { AuthStore } from '@core/auth/session/auth-store';
import { type BranchOption, BranchOptionsApi } from '@core/branches/branch-options-api';
import { CatalogOptionsApi, type ProductOption, type SupplierOption } from '@core/catalog/catalog-options-api';
import { debouncedText } from '@shared/data/debounced-text';
import { type PagedQuery, type SortState, serverPagedList } from '@shared/data/server-paged-list';
import { formatDateTime, formatMoney } from '@shared/format/format';
import { numberFromInput } from '@shared/filters/filter-helpers';
import { codecs, persistedFilter } from '@shared/filters/persisted-filter';
import { Checkbox } from '@shared/ui/checkbox/checkbox';
import { Badge, type BadgeVariant } from '@shared/ui/badge/badge';
import { Button } from '@shared/ui/button/button';
import { DatePicker } from '@shared/ui/date-picker/date-picker';
import { ActiveFilters, type ActiveFilter } from '@shared/ui/filters/active-filters';
import { AdvancedFilters } from '@shared/ui/filters/advanced-filters';
import { FormField, InputDirective } from '@shared/ui/form-field/form-field';
import { DataTable, DataTableCell, type TableColumn } from '@shared/ui/data-table/data-table';
import { Select, type SelectOption } from '@shared/ui/select/select';
import { Tooltip } from '@shared/ui/tooltip/tooltip';
import { PurchaseDetailModal } from '../../components/purchase-detail-modal/purchase-detail-modal';
import { PurchaseFormModal, type PurchasePreset } from '../../components/purchase-form-modal/purchase-form-modal';
import { takeNewDocumentRequest } from '@core/navigation/new-document-link';
import { PAYMENT_INFO, RECEPTION_INFO } from '../../data-access/purchase-labels';
import {
  PAYMENT_STATUSES,
  type PaymentStatus,
  type Purchase,
  type PurchaseListRow,
  type PurchaseQuery,
  type PurchaseSortField,
  type PurchaseSummary,
  PurchasesApi,
  RECEPTION_STATUSES,
  type ReceptionStatus,
} from '../../data-access/purchases-api';

/** Fila de la tabla: la orden con los textos que se muestran. */
interface PurchaseRow extends PurchaseListRow {
  readonly supplier: string;
  readonly branch: string;
  readonly receptionLabel: string;
  readonly paymentLabel: string;
}

type StatusFilter = 'open' | 'all' | ReceptionStatus;
interface PurchaseFilters {
  readonly status: StatusFilter;
  readonly payment: PaymentStatus | null;
  readonly from: Date | null;
  readonly to: Date | null;
  readonly supplierId: number | null;
  readonly branchId: number | null;
  readonly productId: number | null;
  readonly minTotal: number | null;
  readonly maxTotal: number | null;
  readonly onlyMine: boolean;
  readonly text: string;
}

const PAGE_SIZE = 10;
const SEARCH_DELAY_MS = 300;
/** Columna de la tabla → campo de orden del servidor. */
const SORT_KEYS: Readonly<Record<string, PurchaseSortField>> = {
  id: 'id',
  receptionLabel: 'reception',
  supplier: 'supplier',
  branch: 'branch',
  total: 'total',
  balance: 'balance',
  paymentLabel: 'payment',
  requestDate: 'requestDate',
};

const rowKey = (row: PurchaseRow): number => row.id;
const DAY = new Intl.DateTimeFormat('es-CO', { dateStyle: 'medium' });

const toRow = (p: PurchaseListRow): PurchaseRow => ({
  ...p,
  supplier: p.supplierName,
  branch: p.branchName,
  receptionLabel: RECEPTION_INFO[p.reception].label,
  paymentLabel: PAYMENT_INFO[p.payment].label,
});

function toPurchaseQuery({ sort, ...query }: PagedQuery<PurchaseFilters>): PurchaseQuery {
  return { ...query, sortBy: sort ? (SORT_KEYS[sort.key] ?? 'id') : 'id', ascending: sort ? sort.direction === 'asc' : false };
}

/**
 * Compras: la lista se pide al servidor de a una página (filtros, orden y «te toca» los resuelve el servidor) y cada
 * orden se pide completa al abrir su detalle.
 */
@Component({
  selector: 'app-purchases-page',
  imports: [Checkbox, DataTable, DataTableCell, Badge, Button, DatePicker, ActiveFilters, AdvancedFilters, FormField, InputDirective, Select, Tooltip, PurchaseDetailModal, PurchaseFormModal, LucideEye, LucidePlus, LucideSearch],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block p-(--page-padding)' },
  templateUrl: './purchases-page.html',
})
export class PurchasesPage {
  private readonly api = inject(PurchasesApi);
  private readonly branchApi = inject(BranchOptionsApi);
  private readonly catalog = inject(CatalogOptionsApi);
  private readonly auth = inject(AuthStore);

  protected readonly rowKey = rowKey;
  protected readonly pageSize = PAGE_SIZE;
  protected readonly filterIcon = LucideListFilter.icon;
  protected readonly paymentIcon = LucideWallet.icon;
  protected readonly role = this.auth.role;
  protected readonly isAdmin = computed(() => this.role() === 'ADMIN');

  protected readonly suppliers = signal<readonly SupplierOption[]>([]);
  protected readonly products = signal<readonly ProductOption[]>([]);
  protected readonly branches = signal<readonly BranchOption[]>([]);

  // Los filtros se recuerdan por persona (la búsqueda de texto no: se escribe cada vez).
  private static readonly SCREEN = 'purchases';
  private readonly searchBox = debouncedText(SEARCH_DELAY_MS);
  protected readonly search = this.searchBox.text;
  protected readonly statusFilter = persistedFilter(PurchasesPage.SCREEN, 'status', 'open' as StatusFilter, codecs.oneOf(['open', 'all', ...RECEPTION_STATUSES] as const));
  protected readonly paymentFilter = persistedFilter(PurchasesPage.SCREEN, 'payment', null as PaymentStatus | null, codecs.nullable(codecs.oneOf(PAYMENT_STATUSES)));
  protected readonly from = persistedFilter(PurchasesPage.SCREEN, 'from', null as Date | null, codecs.nullable(codecs.date()));
  protected readonly to = persistedFilter(PurchasesPage.SCREEN, 'to', null as Date | null, codecs.nullable(codecs.date()));
  protected readonly supplierFilter = persistedFilter(PurchasesPage.SCREEN, 'supplier', null as number | null, codecs.nullable(codecs.number()));
  protected readonly branchFilter = persistedFilter(PurchasesPage.SCREEN, 'branch', null as number | null, codecs.nullable(codecs.number()));
  // Por id (antes se guardaba el nombre con la clave «product»: ese valor viejo ya no se lee).
  protected readonly productFilter = persistedFilter(PurchasesPage.SCREEN, 'productId', null as number | null, codecs.nullable(codecs.number()));
  protected readonly minTotal = persistedFilter(PurchasesPage.SCREEN, 'minTotal', null as number | null, codecs.nullable(codecs.number()));
  protected readonly maxTotal = persistedFilter(PurchasesPage.SCREEN, 'maxTotal', null as number | null, codecs.nullable(codecs.number()));
  protected readonly onlyMine = persistedFilter(PurchasesPage.SCREEN, 'onlyMine', false, codecs.bool());
  protected readonly advancedOpen = persistedFilter(PurchasesPage.SCREEN, 'advancedOpen', false, codecs.bool());
  protected readonly numberFromInput = numberFromInput;

  protected readonly formOpen = signal(false);
  /** Lo que llega ya elegido al formulario cuando se viene de otra pantalla (el ajuste de stock). */
  protected readonly formPreset = signal<PurchasePreset | null>(null);
  protected readonly detailOpen = signal(false);
  protected readonly selectedRow = signal<PurchaseRow | null>(null);
  protected readonly selected = signal<Purchase | null>(null);
  protected readonly detailError = signal<string | null>(null);
  private detailRequest = 0;

  protected readonly statusOptions: readonly SelectOption<StatusFilter>[] = [
    { value: 'open', label: 'En curso' },
    { value: 'all', label: 'Todas' },
    ...RECEPTION_STATUSES.map((value) => ({ value, label: RECEPTION_INFO[value].label, icon: RECEPTION_INFO[value].icon })),
  ];

  protected readonly paymentOptions: readonly SelectOption<PaymentStatus | null>[] = [
    { value: null, label: 'Todos los pagos' },
    ...PAYMENT_STATUSES.map((value) => ({ value, label: PAYMENT_INFO[value].label, icon: PAYMENT_INFO[value].icon })),
  ];
  protected readonly supplierOptions = computed<SelectOption<number | null>[]>(() => [
    { value: null, label: 'Todos los proveedores' },
    ...this.suppliers().map((s) => ({ value: s.id, label: s.nombre })),
  ]);
  protected readonly branchOptions = computed<SelectOption<number | null>[]>(() => [
    { value: null, label: 'Todas las sucursales' },
    ...this.branches().map((b) => ({ value: b.id, label: b.nombre })),
  ]);
  protected readonly productOptions = computed<SelectOption<number | null>[]>(() => [
    { value: null, label: 'Todos los productos' },
    ...this.products().map((p) => ({ value: p.id, label: p.nombre })),
  ]);

  private readonly supplierNames = computed(() => new Map(this.suppliers().map((s) => [s.id, s.nombre])));
  private readonly branchNames = computed(() => new Map(this.branches().map((b) => [b.id, b.nombre])));
  protected readonly productNames = computed<ReadonlyMap<number, string>>(() => new Map(this.products().map((p) => [p.id, p.nombre])));

  protected readonly columns = computed<readonly TableColumn<PurchaseRow>[]>(() => [
    { key: 'id', header: 'N.º', icon: LucideHash.icon, sortable: true, width: '5rem', display: (r) => `#${r.id}` },
    { key: 'receptionLabel', header: 'Estado', icon: LucideCircleCheck.icon, sortable: true },
    { key: 'supplier', header: 'Proveedor', icon: LucideTruck.icon, sortable: true, primary: true },
    ...(this.isAdmin() ? [{ key: 'branch', header: 'Sucursal', icon: LucideStore.icon, sortable: true }] : []),
    { key: 'total', header: 'Total', icon: LucideCoins.icon, sortable: true, align: 'end' as const, display: (r: PurchaseRow) => formatMoney(r.total) },
    { key: 'balance', header: 'Saldo', icon: LucideCoins.icon, sortable: true, align: 'end' as const, display: (r: PurchaseRow) => formatMoney(r.balance) },
    { key: 'paymentLabel', header: 'Pago', icon: LucideWallet.icon, sortable: true },
    { key: 'requestDate', header: 'Solicitada', icon: LucideCalendar.icon, sortable: true, nowrap: true, width: '11.5rem', value: (r: PurchaseRow) => r.requestDate, display: (r: PurchaseRow) => formatDateTime(r.requestDate) },
    { key: 'acciones', header: 'Acciones', align: 'end' as const },
  ]);

  protected readonly sort = signal<SortState | null>(null);
  private readonly filters = computed<PurchaseFilters>(() => ({
    status: this.statusFilter(),
    payment: this.paymentFilter(),
    from: this.from(),
    to: this.to(),
    supplierId: this.supplierFilter(),
    // Solo el ADMIN elige sucursal; para el resto el servidor siempre usa la suya.
    branchId: this.isAdmin() ? this.branchFilter() : null,
    productId: this.productFilter(),
    minTotal: this.minTotal(),
    maxTotal: this.maxTotal(),
    onlyMine: this.onlyMine(),
    text: this.searchBox.term(),
  }));
  private readonly list = serverPagedList({
    filters: this.filters,
    sort: this.sort,
    size: PAGE_SIZE,
    fetch: (query) => this.api.search(toPurchaseQuery(query)).pipe(map((page) => ({ ...page, rows: page.purchases.map(toRow) }))),
  });
  protected readonly rows = this.list.rows;
  protected readonly total = this.list.total;
  protected readonly loading = this.list.loading;
  protected readonly error = this.list.error;
  protected readonly page = this.list.page;
  protected readonly exportAll = (): Promise<readonly PurchaseRow[]> =>
    firstValueFrom(this.api.searchAll(toPurchaseQuery(untracked(this.list.query))).pipe(map((rows) => rows.map(toRow))));

  /** Los filtros del panel «Más filtros» que están aplicados (el botón muestra cuántos). */
  protected readonly advancedCount = computed(
    () => [this.supplierFilter() !== null, this.isAdmin() && this.branchFilter() !== null, this.productFilter() !== null, this.minTotal() !== null, this.maxTotal() !== null, this.onlyMine()].filter(Boolean).length,
  );

  /** Todos los filtros aplicados (menos el estado «En curso», que es el de siempre), para mostrarlos como etiquetas. */
  protected readonly activeFilters = computed<ActiveFilter[]>(() => {
    const list: ActiveFilter[] = [];
    const status = this.statusFilter();
    if (status !== 'open') list.push({ id: 'status', label: 'Estado', text: status === 'all' ? 'Todas' : RECEPTION_INFO[status].label });
    if (this.paymentFilter() !== null) list.push({ id: 'payment', label: 'Pago', text: PAYMENT_INFO[this.paymentFilter()!].label });
    if (this.from() !== null) list.push({ id: 'from', label: 'Desde', text: DAY.format(this.from()!) });
    if (this.to() !== null) list.push({ id: 'to', label: 'Hasta', text: DAY.format(this.to()!) });
    if (this.supplierFilter() !== null) list.push({ id: 'supplier', label: 'Proveedor', text: this.supplierNames().get(this.supplierFilter()!) ?? `Proveedor ${this.supplierFilter()}` });
    if (this.isAdmin() && this.branchFilter() !== null) list.push({ id: 'branch', label: 'Sucursal', text: this.branchNames().get(this.branchFilter()!) ?? `Sede ${this.branchFilter()}` });
    if (this.productFilter() !== null) list.push({ id: 'product', label: 'Producto', text: this.productNames().get(this.productFilter()!) ?? `Producto ${this.productFilter()}` });
    if (this.minTotal() !== null) list.push({ id: 'minTotal', label: 'Total desde', text: formatMoney(this.minTotal()) });
    if (this.maxTotal() !== null) list.push({ id: 'maxTotal', label: 'Total hasta', text: formatMoney(this.maxTotal()) });
    if (this.onlyMine()) list.push({ id: 'onlyMine', label: 'Solo las que', text: 'esperan mi acción' });
    if (this.search().trim()) list.push({ id: 'search', label: 'Búsqueda', text: this.search().trim() });
    return list;
  });

  /** Los totales del encabezado, sobre todo lo visible (no solo la página): los calcula el servidor. */
  protected readonly headline = signal<PurchaseSummary | null>(null);
  protected readonly summary = computed(() => {
    const open = this.headline()?.open ?? 0;
    return open === 1 ? '1 orden en curso' : `${open} órdenes en curso`;
  });
  protected readonly pending = computed(() => this.headline()?.awaitingMe ?? 0);

  protected readonly selectedSupplier = computed(() => this.supplierNames().get(this.selected()?.supplierId ?? -1) ?? this.selectedRow()?.supplier ?? '');
  protected readonly selectedBranch = computed(() => (this.isAdmin() ? (this.branchNames().get(this.selected()?.branchId ?? -1) ?? this.selectedRow()?.branch ?? '') : ''));

  protected readonly formatMoney = formatMoney;

  constructor() {
    // Desde «Compra a proveedor» en el ajuste de stock: se abre la orden nueva con ese producto (y su sucursal).
    const request = takeNewDocumentRequest();
    if (request) this.openForm({ productId: request.productId, branchId: request.branchId });
    void this.loadSummary();
    // Los nombres de proveedor, producto y sucursal alimentan los filtros y el formulario: si fallan, se muestran los códigos.
    forkJoin({
      suppliers: this.catalog.suppliers().pipe(catchError(() => of([]))),
      products: this.catalog.products().pipe(catchError(() => of([]))),
      branches: this.branchApi.list().pipe(catchError(() => of([]))),
    }).subscribe(({ suppliers, products, branches }) => {
      this.suppliers.set(suppliers);
      this.products.set(products);
      this.branches.set(branches);
    });
  }

  /** Recarga la página que se ve y el encabezado (tras crear o cambiar una orden). */
  protected async load(silent = false): Promise<void> {
    await Promise.all([this.list.reload(silent), this.loadSummary()]);
  }

  /** Una orden cambió desde su detalle: se recargan la lista, el encabezado y la orden abierta. */
  protected onChanged(): void {
    void this.load(true);
    const id = this.selectedRow()?.id;
    if (id !== undefined) void this.loadDetail(id);
  }

  private async loadSummary(): Promise<void> {
    try {
      this.headline.set(await firstValueFrom(this.api.summary()));
    } catch {
      // El encabezado es un resumen: si falla, la lista sigue sirviendo (y muestra su propio error si también falla).
    }
  }

  private async loadDetail(id: number): Promise<void> {
    const request = ++this.detailRequest;
    try {
      const purchase = await firstValueFrom(this.api.get(id));
      if (request === this.detailRequest) {
        this.selected.set(purchase);
        this.detailError.set(null);
      }
    } catch (error) {
      if (request === this.detailRequest && this.selected()?.id !== id) this.detailError.set(toApiError(error).message);
    }
  }

  protected onSearch(event: Event): void {
    this.searchBox.set((event.target as HTMLInputElement).value);
  }

  protected removeFilter(id: string): void {
    switch (id) {
      case 'status': this.statusFilter.set('open'); break;
      case 'payment': this.paymentFilter.set(null); break;
      case 'from': this.from.set(null); break;
      case 'to': this.to.set(null); break;
      case 'supplier': this.supplierFilter.set(null); break;
      case 'branch': this.branchFilter.set(null); break;
      case 'product': this.productFilter.set(null); break;
      case 'minTotal': this.minTotal.set(null); break;
      case 'maxTotal': this.maxTotal.set(null); break;
      case 'onlyMine': this.onlyMine.set(false); break;
      case 'search': this.searchBox.clear(); break;
    }
  }

  protected clearFilters(): void {
    for (const filter of this.activeFilters()) this.removeFilter(filter.id);
  }

  protected openForm(preset: PurchasePreset | null = null): void {
    this.formPreset.set(preset);
    this.formOpen.set(true);
  }

  protected openDetail(row: PurchaseRow): void {
    // Si es otra orden, no se muestra la anterior mientras llega la nueva; si es la misma, se ve lo último mientras se refresca.
    if (this.selected()?.id !== row.id) this.selected.set(null);
    this.detailError.set(null);
    this.selectedRow.set(row);
    this.detailOpen.set(true);
    void this.loadDetail(row.id);
  }

  protected receptionVariant(row: PurchaseRow): BadgeVariant {
    return RECEPTION_INFO[row.reception].variant;
  }

  protected paymentVariant(row: PurchaseRow): BadgeVariant {
    return PAYMENT_INFO[row.payment].variant;
  }
}
