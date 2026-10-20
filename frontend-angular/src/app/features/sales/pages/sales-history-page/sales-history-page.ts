import { ChangeDetectionStrategy, Component, DestroyRef, computed, effect, inject, linkedSignal, signal, untracked } from '@angular/core';
import { catchError, firstValueFrom, of } from 'rxjs';
import {
  LucideCalendar,
  LucideCircleCheck,
  LucideCoins,
  LucideWallet,
  LucideEye,
  LucideHash,
  LucideListFilter,
  LucideSearch,
  LucideStore,
  LucideUser,
  LucideUserRound,
} from '@lucide/angular';
import { toApiError } from '@core/api/api-error';
import { AuthStore } from '@core/auth/session/auth-store';
import { type BranchOption, BranchOptionsApi } from '@core/branches/branch-options-api';
import { CatalogOptionsApi, type SupplierOption } from '@core/catalog/catalog-options-api';
import { formatDateTime, formatMoney, formatQuantity } from '@shared/format/format';
import { numberFromInput, optionsFrom } from '@shared/filters/filter-helpers';
import { codecs, persistedFilter } from '@shared/filters/persisted-filter';
import { Badge, type BadgeVariant } from '@shared/ui/badge/badge';
import { Button } from '@shared/ui/button/button';
import { DatePicker } from '@shared/ui/date-picker/date-picker';
import { ActiveFilters, type ActiveFilter } from '@shared/ui/filters/active-filters';
import { AdvancedFilters } from '@shared/ui/filters/advanced-filters';
import { DataTable, DataTableCell, type TableColumn } from '@shared/ui/data-table/data-table';
import { FormField, InputDirective } from '@shared/ui/form-field/form-field';
import { Select, type SelectOption } from '@shared/ui/select/select';
import { Tooltip } from '@shared/ui/tooltip/tooltip';
import { SaleDetailModal } from '../../components/sale-detail-modal/sale-detail-modal';
import { PAYMENT_METHOD_LABELS, SALE_PAYMENT_METHODS, type SalePaymentMethod, paymentLabel } from '@core/sales/payment-method';
import { SALE_INFO, customerLabel } from '../../data-access/sale-labels';
import { SALE_STATUSES, type Sale, type SaleQuery, type SaleStatus, SalesApi } from '../../data-access/sales-api';

/** Fila de la tabla: la venta con los textos que se muestran y se ordenan. */
interface SaleRow extends Sale {
  readonly customer: string;
  readonly paymentText: string;
  readonly statusLabel: string;
}

const rowKey = (row: SaleRow): number => row.id;
const PAGE_SIZE = 10;
/** Pausa tras la última tecla antes de buscar en el servidor. */
const SEARCH_DELAY_MS = 300;
/** Columnas de la tabla → clave de orden del servidor. */
const SORT_KEYS: Readonly<Record<string, string>> = { statusLabel: 'status' };
const DAY = new Intl.DateTimeFormat('es-CO', { dateStyle: 'medium' });

@Component({
  selector: 'app-sales-history-page',
  imports: [DataTable, DataTableCell, Badge, Button, DatePicker, ActiveFilters, AdvancedFilters, FormField, InputDirective, Select, Tooltip, SaleDetailModal, LucideEye, LucideSearch],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block p-(--page-padding)' },
  templateUrl: './sales-history-page.html',
})
export class SalesHistoryPage {
  private readonly api = inject(SalesApi);
  private readonly branchApi = inject(BranchOptionsApi);
  private readonly catalogApi = inject(CatalogOptionsApi);
  private readonly auth = inject(AuthStore);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly rowKey = rowKey;
  protected readonly storeIcon = LucideStore.icon;
  protected readonly filterIcon = LucideListFilter.icon;

  protected readonly isAdmin = computed(() => this.auth.role() === 'ADMIN');
  /** Anular una venta es de ADMIN y MANAGER. */
  protected readonly canCancel = computed(() => this.auth.role() === 'ADMIN' || this.auth.role() === 'MANAGER');

  /** Las ventas de la página que se ve; el resto las pide el servidor al cambiar de página, orden o filtros. */
  protected readonly sales = signal<readonly Sale[]>([]);
  protected readonly total = signal(0);
  private readonly completed = signal({ count: 0, total: 0 });
  private readonly sellers = signal<readonly string[]>([]);
  private readonly products = signal<readonly string[]>([]);
  protected readonly branches = signal<readonly BranchOption[]>([]);
  protected readonly suppliers = signal<readonly SupplierOption[]>([]);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);

  // Los filtros se recuerdan por persona (la búsqueda de texto no: se escribe cada vez).
  private static readonly SCREEN = 'sales-history';
  protected readonly branchFilter = persistedFilter(SalesHistoryPage.SCREEN, 'branch', null as number | null, codecs.nullable(codecs.number()));
  protected readonly statusFilter = persistedFilter(SalesHistoryPage.SCREEN, 'status', 'all' as 'all' | SaleStatus, codecs.oneOf(['all', ...SALE_STATUSES] as const));
  protected readonly from = persistedFilter(SalesHistoryPage.SCREEN, 'from', null as Date | null, codecs.nullable(codecs.date()));
  protected readonly to = persistedFilter(SalesHistoryPage.SCREEN, 'to', null as Date | null, codecs.nullable(codecs.date()));
  protected readonly sellerFilter = persistedFilter(SalesHistoryPage.SCREEN, 'seller', null as string | null, codecs.nullable(codecs.text()));
  protected readonly productFilter = persistedFilter(SalesHistoryPage.SCREEN, 'product', null as string | null, codecs.nullable(codecs.text()));
  protected readonly minTotal = persistedFilter(SalesHistoryPage.SCREEN, 'minTotal', null as number | null, codecs.nullable(codecs.number()));
  protected readonly maxTotal = persistedFilter(SalesHistoryPage.SCREEN, 'maxTotal', null as number | null, codecs.nullable(codecs.number()));
  protected readonly supplierFilter = persistedFilter(SalesHistoryPage.SCREEN, 'supplier', null as number | null, codecs.nullable(codecs.number()));
  protected readonly discountFilter = persistedFilter(SalesHistoryPage.SCREEN, 'discount', 'all' as 'all' | 'with' | 'without', codecs.oneOf(['all', 'with', 'without'] as const));
  protected readonly customerFilter = persistedFilter(SalesHistoryPage.SCREEN, 'customer', 'all' as 'all' | 'registered' | 'anonymous', codecs.oneOf(['all', 'registered', 'anonymous'] as const));
  protected readonly paymentFilter = persistedFilter(SalesHistoryPage.SCREEN, 'payment', null as SalePaymentMethod | null, codecs.nullable(codecs.oneOf(SALE_PAYMENT_METHODS)));
  protected readonly advancedOpen = persistedFilter(SalesHistoryPage.SCREEN, 'advancedOpen', false, codecs.bool());
  protected readonly search = signal('');
  /** Lo buscado, ya con la pausa: es lo que se envía al servidor. */
  private readonly searchTerm = signal('');
  private searchTimer: ReturnType<typeof setTimeout> | undefined;
  protected readonly sort = signal<{ key: string; direction: 'asc' | 'desc' } | null>(null);

  protected readonly detailOpen = signal(false);
  protected readonly selectedId = signal<number | null>(null);

  protected readonly statusOptions: readonly SelectOption<'all' | SaleStatus>[] = [
    { value: 'all', label: 'Todas' },
    ...SALE_STATUSES.map((value) => ({ value, label: SALE_INFO[value].label, icon: SALE_INFO[value].icon })),
  ];
  protected readonly branchOptions = computed<SelectOption<number | null>[]>(() => [
    { value: null, label: 'Todas las sucursales' },
    ...this.branches().map((b) => ({ value: b.id, label: b.nombre })),
  ]);

  protected readonly discountOptions: readonly SelectOption<'all' | 'with' | 'without'>[] = [
    { value: 'all', label: 'Con o sin descuento' },
    { value: 'with', label: 'Con descuento' },
    { value: 'without', label: 'Sin descuento' },
  ];
  protected readonly customerOptions: readonly SelectOption<'all' | 'registered' | 'anonymous'>[] = [
    { value: 'all', label: 'Todos los clientes' },
    { value: 'registered', label: 'Cliente registrado' },
    { value: 'anonymous', label: 'Cliente sin registrar' },
  ];
  protected readonly paymentOptions: readonly SelectOption<SalePaymentMethod | null>[] = [
    { value: null, label: 'Todas las formas de pago' },
    ...SALE_PAYMENT_METHODS.map((value) => ({ value, label: PAYMENT_METHOD_LABELS[value] })),
  ];
  protected readonly supplierOptions = computed<SelectOption<number | null>[]>(() => [
    { value: null, label: 'Todos los proveedores' },
    ...this.suppliers().map((s) => ({ value: s.id, label: s.nombre })),
  ]);

  protected readonly columns = computed<readonly TableColumn<SaleRow>[]>(() => [
    { key: 'id', header: 'N.º', icon: LucideHash.icon, sortable: true, width: '5rem', display: (r) => `#${r.id}` },
    { key: 'date', header: 'Fecha', icon: LucideCalendar.icon, sortable: true, width: '11.5rem', value: (r) => r.date, display: (r) => formatDateTime(r.date) },
    { key: 'customer', header: 'Cliente', icon: LucideUserRound.icon, sortable: true, primary: true },
    { key: 'seller', header: 'Vendedor', icon: LucideUser.icon, sortable: true },
    ...(this.isAdmin() ? [{ key: 'branchName', header: 'Sucursal', icon: LucideStore.icon, sortable: true }] : []),
    { key: 'total', header: 'Total', icon: LucideCoins.icon, sortable: true, align: 'end' as const, display: (r: SaleRow) => formatMoney(r.total) },
    { key: 'paymentText', header: 'Pago', icon: LucideWallet.icon, sortable: false },
    { key: 'statusLabel', header: 'Estado', icon: LucideCircleCheck.icon, sortable: true },
    { key: 'acciones', header: 'Acciones', align: 'end' as const },
  ]);

  protected readonly sellerOptions = computed(() => optionsFrom(this.sellers(), this.sellerFilter(), 'Todos los vendedores'));
  protected readonly productOptions = computed(() => optionsFrom(this.products(), this.productFilter(), 'Todos los productos'));

  protected readonly rows = computed<SaleRow[]>(() =>
    this.sales().map((s) => ({ ...s, customer: customerLabel(s.customerName), statusLabel: SALE_INFO[s.status].label, paymentText: paymentLabel(s.paymentMethod) })),
  );

  /** Lo que filtra al servidor; si cambia, se vuelve a la primera página. */
  private readonly filters = computed(() => ({
    branchId: this.isAdmin() ? this.branchFilter() : null,
    status: this.statusFilter() === 'all' ? null : (this.statusFilter() as SaleStatus),
    from: this.from(),
    to: this.to(),
    seller: this.sellerFilter(),
    product: this.productFilter(),
    minTotal: this.minTotal(),
    maxTotal: this.maxTotal(),
    text: this.searchTerm(),
    supplierId: this.supplierFilter(),
    withDiscount: this.discountFilter() === 'all' ? null : this.discountFilter() === 'with',
    registeredCustomer: this.customerFilter() === 'all' ? null : this.customerFilter() === 'registered',
    paymentMethod: this.paymentFilter(),
  }));
  protected readonly page = linkedSignal<unknown, number>({ source: this.filters, computation: () => 1 });

  private readonly query = computed<SaleQuery>(() => {
    const sort = this.sort();
    return {
      ...this.filters(),
      page: this.page(),
      size: PAGE_SIZE,
      sortBy: sort ? (SORT_KEYS[sort.key] ?? sort.key) : null,
      direction: sort?.direction ?? 'desc',
    };
  });

  /** Los filtros del panel «Más filtros» que están aplicados (el botón muestra cuántos). */
  protected readonly advancedCount = computed(
    () => [this.sellerFilter() !== null, this.productFilter() !== null, this.supplierFilter() !== null, this.discountFilter() !== 'all', this.customerFilter() !== 'all', this.paymentFilter() !== null, this.minTotal() !== null, this.maxTotal() !== null].filter(Boolean).length,
  );

  /** Todos los filtros aplicados, para mostrarlos como etiquetas que se quitan. */
  protected readonly activeFilters = computed<ActiveFilter[]>(() => {
    const list: ActiveFilter[] = [];
    const branch = this.branchFilter();
    if (this.statusFilter() !== 'all') list.push({ id: 'status', label: 'Estado', text: SALE_INFO[this.statusFilter() as SaleStatus].label });
    if (this.isAdmin() && branch !== null) list.push({ id: 'branch', label: 'Sucursal', text: this.branches().find((b) => b.id === branch)?.nombre ?? `Sucursal ${branch}` });
    if (this.from() !== null) list.push({ id: 'from', label: 'Desde', text: DAY.format(this.from()!) });
    if (this.to() !== null) list.push({ id: 'to', label: 'Hasta', text: DAY.format(this.to()!) });
    if (this.sellerFilter() !== null) list.push({ id: 'seller', label: 'Vendedor', text: this.sellerFilter()! });
    if (this.productFilter() !== null) list.push({ id: 'product', label: 'Producto', text: this.productFilter()! });
    if (this.supplierFilter() !== null) list.push({ id: 'supplier', label: 'Proveedor', text: this.suppliers().find((s) => s.id === this.supplierFilter())?.nombre ?? `Proveedor ${this.supplierFilter()}` });
    if (this.discountFilter() !== 'all') list.push({ id: 'discount', label: 'Descuento', text: this.discountFilter() === 'with' ? 'Con descuento' : 'Sin descuento' });
    if (this.customerFilter() !== 'all') list.push({ id: 'customer', label: 'Cliente', text: this.customerFilter() === 'registered' ? 'Registrado' : 'Sin registrar' });
    if (this.paymentFilter() !== null) list.push({ id: 'payment', label: 'Pago', text: PAYMENT_METHOD_LABELS[this.paymentFilter()!] });
    if (this.minTotal() !== null) list.push({ id: 'minTotal', label: 'Total desde', text: formatMoney(this.minTotal()) });
    if (this.maxTotal() !== null) list.push({ id: 'maxTotal', label: 'Total hasta', text: formatMoney(this.maxTotal()) });
    if (this.search().trim()) list.push({ id: 'search', label: 'Búsqueda', text: this.search().trim() });
    return list;
  });

  protected readonly selected = computed(() => this.sales().find((s) => s.id === this.selectedId()) ?? null);

  protected readonly summary = computed(() => {
    const { count, total } = this.completed();
    return `${count === 1 ? '1 venta completada' : `${formatQuantity(count)} ventas completadas`}, ${formatMoney(total)}`;
  });

  constructor() {
    if (this.isAdmin()) {
      this.branchApi
        .list()
        .pipe(catchError(() => of([])))
        .subscribe((branches) => this.branches.set(branches));
    }
    this.catalogApi
      .suppliers()
      .pipe(catchError(() => of([])))
      .subscribe((suppliers) => this.suppliers.set(suppliers));
    // Cada cambio de página, orden o filtro vuelve a pedir la página al servidor.
    effect(() => {
      const query = this.query();
      untracked(() => void this.load(false, query));
    });
    // Los vendedores y productos que se pueden elegir dependen de la sucursal.
    effect(() => {
      const branch = this.isAdmin() ? this.branchFilter() : null;
      untracked(() =>
        this.api
          .filterOptions(branch)
          .pipe(catchError(() => of({ sellers: [], products: [] })))
          .subscribe((o) => {
            this.sellers.set(o.sellers);
            this.products.set(o.products);
          }),
      );
    });
    this.destroyRef.onDestroy(() => clearTimeout(this.searchTimer));
  }

  /** Solo la última petición manda: al cambiar de página o filtro rápido, la respuesta de la anterior no debe pisar la lista. */
  private loadId = 0;

  protected async load(silent = false, query = untracked(this.query)): Promise<void> {
    const id = ++this.loadId;
    if (!silent) this.loading.set(true);
    this.error.set(null);
    try {
      const page = await firstValueFrom(this.api.search(query));
      if (id === this.loadId) {
        this.sales.set(page.sales);
        this.total.set(page.total);
        this.completed.set({ count: page.completedCount, total: page.completedTotal });
      }
    } catch (error) {
      if (id === this.loadId) this.error.set(toApiError(error).message);
    } finally {
      if (id === this.loadId) this.loading.set(false);
    }
  }

  protected onSearch(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.search.set(value);
    clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(() => this.searchTerm.set(value.trim()), SEARCH_DELAY_MS);
  }

  protected readonly numberFromInput = numberFromInput;

  protected removeFilter(id: string): void {
    switch (id) {
      case 'status': this.statusFilter.set('all'); break;
      case 'branch': this.branchFilter.set(null); break;
      case 'from': this.from.set(null); break;
      case 'to': this.to.set(null); break;
      case 'seller': this.sellerFilter.set(null); break;
      case 'product': this.productFilter.set(null); break;
      case 'supplier': this.supplierFilter.set(null); break;
      case 'discount': this.discountFilter.set('all'); break;
      case 'customer': this.customerFilter.set('all'); break;
      case 'payment': this.paymentFilter.set(null); break;
      case 'minTotal': this.minTotal.set(null); break;
      case 'maxTotal': this.maxTotal.set(null); break;
      case 'search': this.search.set(''); clearTimeout(this.searchTimer); this.searchTerm.set(''); break;
    }
  }

  protected clearFilters(): void {
    for (const filter of this.activeFilters()) this.removeFilter(filter.id);
  }

  protected openDetail(row: SaleRow): void {
    this.selectedId.set(row.id);
    this.detailOpen.set(true);
  }

  protected statusVariant(row: SaleRow): BadgeVariant {
    return SALE_INFO[row.status].variant;
  }
}
