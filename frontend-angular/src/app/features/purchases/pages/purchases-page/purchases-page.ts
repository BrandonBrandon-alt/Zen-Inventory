import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { catchError, firstValueFrom, forkJoin, of } from 'rxjs';
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
import { formatDateTime, formatMoney, normalizeText } from '@shared/format/format';
import { inDateRange, inNumberRange, numberFromInput, optionsFrom } from '@shared/filters/filter-helpers';
import { codecs, persistedFilter } from '@shared/filters/persisted-filter';
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
import { PurchaseFormModal } from '../../components/purchase-form-modal/purchase-form-modal';
import { OPEN_RECEPTIONS, PAYMENT_INFO, RECEPTION_INFO } from '../../data-access/purchase-labels';
import { purchaseActions } from '../../data-access/purchase-permissions';
import { PAYMENT_STATUSES, type PaymentStatus, type Purchase, PurchasesApi, RECEPTION_STATUSES, type ReceptionStatus } from '../../data-access/purchases-api';

/** Fila de la tabla: la orden con los textos que se muestran y se ordenan. */
interface PurchaseRow extends Purchase {
  readonly supplier: string;
  readonly branch: string;
  readonly receptionLabel: string;
  readonly paymentLabel: string;
  readonly needsMe: boolean;
}

const rowKey = (row: PurchaseRow): number => row.id;
const DAY = new Intl.DateTimeFormat('es-CO', { dateStyle: 'medium' });

@Component({
  selector: 'app-purchases-page',
  imports: [DataTable, DataTableCell, Badge, Button, DatePicker, ActiveFilters, AdvancedFilters, FormField, InputDirective, Select, Tooltip, PurchaseDetailModal, PurchaseFormModal, LucideEye, LucidePlus, LucideSearch],
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
  protected readonly filterIcon = LucideListFilter.icon;
  protected readonly paymentIcon = LucideWallet.icon;
  protected readonly role = this.auth.role;
  protected readonly isAdmin = computed(() => this.role() === 'ADMIN');

  protected readonly purchases = signal<readonly Purchase[]>([]);
  protected readonly suppliers = signal<readonly SupplierOption[]>([]);
  protected readonly products = signal<readonly ProductOption[]>([]);
  protected readonly branches = signal<readonly BranchOption[]>([]);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);

  // Los filtros se recuerdan por persona (la búsqueda de texto no: se escribe cada vez).
  private static readonly SCREEN = 'purchases';
  protected readonly search = signal('');
  protected readonly statusFilter = persistedFilter(PurchasesPage.SCREEN, 'status', 'open' as 'open' | 'all' | ReceptionStatus, codecs.oneOf(['open', 'all', ...RECEPTION_STATUSES] as const));
  protected readonly paymentFilter = persistedFilter(PurchasesPage.SCREEN, 'payment', null as PaymentStatus | null, codecs.nullable(codecs.oneOf(PAYMENT_STATUSES)));
  protected readonly from = persistedFilter(PurchasesPage.SCREEN, 'from', null as Date | null, codecs.nullable(codecs.date()));
  protected readonly to = persistedFilter(PurchasesPage.SCREEN, 'to', null as Date | null, codecs.nullable(codecs.date()));
  protected readonly supplierFilter = persistedFilter(PurchasesPage.SCREEN, 'supplier', null as number | null, codecs.nullable(codecs.number()));
  protected readonly branchFilter = persistedFilter(PurchasesPage.SCREEN, 'branch', null as number | null, codecs.nullable(codecs.number()));
  protected readonly productFilter = persistedFilter(PurchasesPage.SCREEN, 'product', null as string | null, codecs.nullable(codecs.text()));
  protected readonly minTotal = persistedFilter(PurchasesPage.SCREEN, 'minTotal', null as number | null, codecs.nullable(codecs.number()));
  protected readonly maxTotal = persistedFilter(PurchasesPage.SCREEN, 'maxTotal', null as number | null, codecs.nullable(codecs.number()));
  protected readonly onlyMine = persistedFilter(PurchasesPage.SCREEN, 'onlyMine', false, codecs.bool());
  protected readonly advancedOpen = persistedFilter(PurchasesPage.SCREEN, 'advancedOpen', false, codecs.bool());
  protected readonly numberFromInput = numberFromInput;

  protected readonly formOpen = signal(false);
  protected readonly detailOpen = signal(false);
  protected readonly selectedId = signal<number | null>(null);

  protected readonly statusOptions: readonly SelectOption<'open' | 'all' | ReceptionStatus>[] = [
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
  protected readonly productOptions = computed(() => optionsFrom(this.purchases().flatMap((p) => p.lines.map((l) => this.productNames().get(l.productId) ?? `Producto ${l.productId}`)), this.productFilter(), 'Todos los productos'));

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
    { key: 'requestDate', header: 'Solicitada', icon: LucideCalendar.icon, sortable: true, width: '11.5rem', value: (r: PurchaseRow) => r.requestDate, display: (r: PurchaseRow) => formatDateTime(r.requestDate) },
    { key: 'acciones', header: 'Acciones', align: 'end' as const },
  ]);

  protected readonly rows = computed<PurchaseRow[]>(() => {
    const status = this.statusFilter();
    const suppliers = this.supplierNames();
    const branches = this.branchNames();
    const names = this.productNames();
    const needle = normalizeText(this.search().trim());
    const { payment, from, to, supplier, branch, product, minTotal, maxTotal } = {
      payment: this.paymentFilter(),
      from: this.from(),
      to: this.to(),
      supplier: this.supplierFilter(),
      branch: this.isAdmin() ? this.branchFilter() : null,
      product: this.productFilter(),
      minTotal: this.minTotal(),
      maxTotal: this.maxTotal(),
    };
    return this.purchases()
      .filter((p) => (status === 'open' ? OPEN_RECEPTIONS.includes(p.reception) : status === 'all' || p.reception === status))
      .filter((p) => payment === null || p.payment === payment)
      .filter((p) => inDateRange(p.requestDate, from, to))
      .filter((p) => supplier === null || p.supplierId === supplier)
      .filter((p) => branch === null || p.branchId === branch)
      .filter((p) => product === null || p.lines.some((l) => (names.get(l.productId) ?? `Producto ${l.productId}`) === product))
      .filter((p) => inNumberRange(p.total, minTotal, maxTotal))
      .filter((p) => !needle || normalizeText(`${p.id} ${suppliers.get(p.supplierId) ?? ''}`).includes(needle))
      .map((p) => {
        const actions = purchaseActions(p, this.role());
        return {
          ...p,
          supplier: suppliers.get(p.supplierId) ?? `Proveedor ${p.supplierId}`,
          branch: branches.get(p.branchId) ?? `Sede ${p.branchId}`,
          receptionLabel: RECEPTION_INFO[p.reception].label,
          paymentLabel: PAYMENT_INFO[p.payment].label,
          // Le toca a quien mira: aprobar una orden, o recibir la que ya viene en camino.
          needsMe: actions.approve || (actions.receive && p.reception === 'IN_TRANSIT'),
        };
      })
      .filter((r) => !this.onlyMine() || r.needsMe);
  });

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
    if (this.productFilter() !== null) list.push({ id: 'product', label: 'Producto', text: this.productFilter()! });
    if (this.minTotal() !== null) list.push({ id: 'minTotal', label: 'Total desde', text: formatMoney(this.minTotal()) });
    if (this.maxTotal() !== null) list.push({ id: 'maxTotal', label: 'Total hasta', text: formatMoney(this.maxTotal()) });
    if (this.onlyMine()) list.push({ id: 'onlyMine', label: 'Solo las que', text: 'esperan mi acción' });
    if (this.search().trim()) list.push({ id: 'search', label: 'Búsqueda', text: this.search().trim() });
    return list;
  });

  /** Lo que se le debe a los proveedores en las órdenes visibles y cuántas ya vencieron. */
  protected readonly payables = computed(() => {
    const owed = this.purchases().filter((p) => p.balance > 0);
    return { total: owed.reduce((sum, p) => sum + p.balance, 0), count: owed.length, overdue: owed.filter((p) => p.overdue).length };
  });

  protected readonly selected = computed(() => this.purchases().find((p) => p.id === this.selectedId()) ?? null);
  protected readonly pending = computed(() => this.rows().filter((r) => r.needsMe).length);
  protected readonly selectedSupplier = computed(() => this.supplierNames().get(this.selected()?.supplierId ?? -1) ?? '');
  protected readonly selectedBranch = computed(() => (this.isAdmin() ? (this.branchNames().get(this.selected()?.branchId ?? -1) ?? '') : ''));

  protected readonly formatMoney = formatMoney;

  protected readonly summary = computed(() => {
    const open = this.purchases().filter((p) => OPEN_RECEPTIONS.includes(p.reception)).length;
    return open === 1 ? '1 orden en curso' : `${open} órdenes en curso`;
  });

  constructor() {
    void this.load();
    // Los nombres de proveedor, producto y sucursal adornan la tabla y el formulario: si fallan, se muestran los códigos.
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

  protected async load(silent = false): Promise<void> {
    if (!silent) this.loading.set(true);
    this.error.set(null);
    try {
      this.purchases.set(await firstValueFrom(this.api.list()));
    } catch (error) {
      this.error.set(toApiError(error).message);
    } finally {
      this.loading.set(false);
    }
  }

  protected onSearch(event: Event): void {
    this.search.set((event.target as HTMLInputElement).value);
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
      case 'search': this.search.set(''); break;
    }
  }

  protected clearFilters(): void {
    for (const filter of this.activeFilters()) this.removeFilter(filter.id);
  }

  protected openDetail(row: PurchaseRow): void {
    this.selectedId.set(row.id);
    this.detailOpen.set(true);
  }

  protected receptionVariant(row: PurchaseRow): BadgeVariant {
    return RECEPTION_INFO[row.reception].variant;
  }

  protected paymentVariant(row: PurchaseRow): BadgeVariant {
    return PAYMENT_INFO[row.payment].variant;
  }
}
