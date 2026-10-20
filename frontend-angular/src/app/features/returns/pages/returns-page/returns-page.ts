import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { catchError, firstValueFrom, forkJoin, of } from 'rxjs';
import { LucideCalendar, LucideCircleCheck, LucideCoins, LucideEye, LucideHash, LucideListFilter, LucidePackage, LucidePlus, LucideReceipt, LucideSearch, LucideStore, LucideUser } from '@lucide/angular';
import { toApiError } from '@core/api/api-error';
import { AuthStore } from '@core/auth/session/auth-store';
import { type BranchOption, BranchOptionsApi } from '@core/branches/branch-options-api';
import { CatalogOptionsApi, type ProductOption } from '@core/catalog/catalog-options-api';
import { type UserName, UserOptionsApi } from '@core/users/user-options-api';
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
import { ReturnDetailModal } from '../../components/return-detail-modal/return-detail-modal';
import { ReturnFormModal } from '../../components/return-form-modal/return-form-modal';
import { RETURN_INFO } from '../../data-access/return-labels';
import { RETURN_STATUSES, type ReturnRequest, type ReturnStatus, type ReturnableSale, ReturnsApi } from '../../data-access/returns-api';

/** Fila de la tabla: la solicitud con los textos que se muestran y se ordenan. */
interface ReturnRow extends ReturnRequest {
  readonly statusLabel: string;
  readonly products: string;
  readonly branch: string;
  readonly requester: string;
  readonly needsMe: boolean;
}

const DAY = new Intl.DateTimeFormat('es-CO', { dateStyle: 'medium' });
const rowKey = (row: ReturnRow): number => row.id;

@Component({
  selector: 'app-returns-page',
  imports: [DataTable, DataTableCell, Badge, Button, DatePicker, ActiveFilters, AdvancedFilters, FormField, InputDirective, Select, Tooltip, ReturnDetailModal, ReturnFormModal, LucideEye, LucidePlus, LucideSearch],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block p-(--page-padding)' },
  templateUrl: './returns-page.html',
})
export class ReturnsPage {
  private readonly api = inject(ReturnsApi);
  private readonly branchApi = inject(BranchOptionsApi);
  private readonly catalog = inject(CatalogOptionsApi);
  private readonly userApi = inject(UserOptionsApi);
  private readonly auth = inject(AuthStore);

  protected readonly rowKey = rowKey;
  protected readonly filterIcon = LucideListFilter.icon;

  protected readonly isAdmin = computed(() => this.auth.role() === 'ADMIN');
  /** ADMIN y MANAGER deciden las solicitudes. */
  protected readonly canDecide = computed(() => this.auth.role() === 'ADMIN' || this.auth.role() === 'MANAGER');
  private readonly ownBranch = computed(() => this.auth.session()?.sucursalId ?? null);

  protected readonly requests = signal<readonly ReturnRequest[]>([]);
  protected readonly sales = signal<readonly ReturnableSale[]>([]);
  protected readonly branches = signal<readonly BranchOption[]>([]);
  protected readonly products = signal<readonly ProductOption[]>([]);
  protected readonly users = signal<readonly UserName[]>([]);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);

  // Los filtros se recuerdan por persona (la búsqueda de texto no: se escribe cada vez).
  private static readonly SCREEN = 'returns';
  protected readonly search = signal('');
  protected readonly statusFilter = persistedFilter(ReturnsPage.SCREEN, 'status', 'PENDIENTE' as 'all' | ReturnStatus, codecs.oneOf(['all', ...RETURN_STATUSES] as const));
  protected readonly from = persistedFilter(ReturnsPage.SCREEN, 'from', null as Date | null, codecs.nullable(codecs.date()));
  protected readonly to = persistedFilter(ReturnsPage.SCREEN, 'to', null as Date | null, codecs.nullable(codecs.date()));
  protected readonly productFilter = persistedFilter(ReturnsPage.SCREEN, 'product', null as string | null, codecs.nullable(codecs.text()));
  protected readonly requesterFilter = persistedFilter(ReturnsPage.SCREEN, 'requester', null as string | null, codecs.nullable(codecs.text()));
  protected readonly branchFilter = persistedFilter(ReturnsPage.SCREEN, 'branch', null as number | null, codecs.nullable(codecs.number()));
  protected readonly minTotal = persistedFilter(ReturnsPage.SCREEN, 'minTotal', null as number | null, codecs.nullable(codecs.number()));
  protected readonly maxTotal = persistedFilter(ReturnsPage.SCREEN, 'maxTotal', null as number | null, codecs.nullable(codecs.number()));
  protected readonly advancedOpen = persistedFilter(ReturnsPage.SCREEN, 'advancedOpen', false, codecs.bool());
  protected readonly numberFromInput = numberFromInput;

  protected readonly formOpen = signal(false);
  protected readonly detailOpen = signal(false);
  protected readonly selectedId = signal<number | null>(null);

  protected readonly statusOptions: readonly SelectOption<'all' | ReturnStatus>[] = [
    { value: 'PENDIENTE', label: 'Pendientes', icon: RETURN_INFO.PENDIENTE.icon },
    { value: 'all', label: 'Todas' },
    ...RETURN_STATUSES.filter((s) => s !== 'PENDIENTE').map((value) => ({ value, label: RETURN_INFO[value].label, icon: RETURN_INFO[value].icon })),
  ];

  protected readonly branchOptions = computed<SelectOption<number | null>[]>(() => [
    { value: null, label: 'Todas las sucursales' },
    ...this.branches().map((b) => ({ value: b.id, label: b.nombre })),
  ]);
  protected readonly productOptions = computed(() =>
    optionsFrom(this.requests().flatMap((r) => r.lines.map((l) => this.productNames().get(l.productId) ?? `Producto ${l.productId}`)), this.productFilter(), 'Todos los productos'),
  );
  protected readonly requesterOptions = computed(() =>
    optionsFrom(this.requests().map((r) => (r.requesterId === null ? '' : (this.userNames().get(r.requesterId) ?? `Usuario ${r.requesterId}`))), this.requesterFilter(), 'Todos'),
  );

  private readonly branchNames = computed(() => new Map(this.branches().map((b) => [b.id, b.nombre])));
  protected readonly productNames = computed<ReadonlyMap<number, string>>(() => new Map(this.products().map((p) => [p.id, p.nombre])));
  protected readonly userNames = computed<ReadonlyMap<number, string>>(() => new Map(this.users().map((u) => [u.id, u.nombre])));

  protected readonly columns = computed<readonly TableColumn<ReturnRow>[]>(() => [
    { key: 'id', header: 'N.º', icon: LucideHash.icon, sortable: true, width: '5rem', display: (r) => `#${r.id}` },
    { key: 'statusLabel', header: 'Estado', icon: LucideCircleCheck.icon, sortable: true },
    { key: 'saleId', header: 'Venta', icon: LucideReceipt.icon, sortable: true, display: (r) => `#${r.saleId}` },
    { key: 'products', header: 'Productos', icon: LucidePackage.icon, primary: true },
    ...(this.isAdmin() ? [{ key: 'branch', header: 'Sucursal', icon: LucideStore.icon, sortable: true }] : []),
    { key: 'total', header: 'Valor', icon: LucideCoins.icon, sortable: true, align: 'end' as const, display: (r: ReturnRow) => formatMoney(r.total) },
    { key: 'requester', header: 'Solicitó', icon: LucideUser.icon, sortable: true },
    { key: 'requestDate', header: 'Fecha', icon: LucideCalendar.icon, sortable: true, nowrap: true, width: '11.5rem', value: (r: ReturnRow) => r.requestDate, display: (r: ReturnRow) => formatDateTime(r.requestDate) },
    { key: 'acciones', header: 'Acciones', align: 'end' as const },
  ]);

  protected readonly rows = computed<ReturnRow[]>(() => {
    const status = this.statusFilter();
    const branches = this.branchNames();
    const products = this.productNames();
    const users = this.userNames();
    const needle = normalizeText(this.search().trim());
    const { from, to, product, requester, branch, minTotal, maxTotal } = {
      from: this.from(),
      to: this.to(),
      product: this.productFilter(),
      requester: this.requesterFilter(),
      branch: this.isAdmin() ? this.branchFilter() : null,
      minTotal: this.minTotal(),
      maxTotal: this.maxTotal(),
    };
    const productName = (id: number) => products.get(id) ?? `Producto ${id}`;
    const requesterName = (id: number | null) => (id === null ? '—' : (users.get(id) ?? `Usuario ${id}`));
    return this.requests()
      .filter((r) => status === 'all' || r.status === status)
      .filter((r) => inDateRange(r.requestDate, from, to))
      .filter((r) => product === null || r.lines.some((l) => productName(l.productId) === product))
      .filter((r) => requester === null || requesterName(r.requesterId) === requester)
      .filter((r) => branch === null || r.branchId === branch)
      .filter((r) => inNumberRange(r.total, minTotal, maxTotal))
      .filter((r) => !needle || normalizeText(`${r.id} ${r.saleId} ${r.lines.map((l) => productName(l.productId)).join(' ')}`).includes(needle))
      .map((r) => {
        const [first] = r.lines;
        const others = r.lines.length - 1;
        const name = first ? (products.get(first.productId) ?? `Producto ${first.productId}`) : '—';
        return {
          ...r,
          statusLabel: RETURN_INFO[r.status].label,
          products: others > 0 ? `${name} +${others}` : name,
          branch: branches.get(r.branchId) ?? `Sede ${r.branchId}`,
          requester: r.requesterId === null ? '—' : (users.get(r.requesterId) ?? `Usuario ${r.requesterId}`),
          needsMe: this.canDecide() && r.status === 'PENDIENTE',
        };
      });
  });

  /** Los filtros del panel «Más filtros» que están aplicados (el botón muestra cuántos). */
  protected readonly advancedCount = computed(
    () => [this.productFilter() !== null, this.requesterFilter() !== null, this.isAdmin() && this.branchFilter() !== null, this.minTotal() !== null, this.maxTotal() !== null].filter(Boolean).length,
  );

  /** Todos los filtros aplicados (menos «Pendientes», que es el de siempre), para mostrarlos como etiquetas. */
  protected readonly activeFilters = computed<ActiveFilter[]>(() => {
    const list: ActiveFilter[] = [];
    const status = this.statusFilter();
    if (status !== 'PENDIENTE') list.push({ id: 'status', label: 'Estado', text: status === 'all' ? 'Todas' : RETURN_INFO[status].label });
    if (this.from() !== null) list.push({ id: 'from', label: 'Desde', text: DAY.format(this.from()!) });
    if (this.to() !== null) list.push({ id: 'to', label: 'Hasta', text: DAY.format(this.to()!) });
    if (this.productFilter() !== null) list.push({ id: 'product', label: 'Producto', text: this.productFilter()! });
    if (this.requesterFilter() !== null) list.push({ id: 'requester', label: 'Solicitó', text: this.requesterFilter()! });
    if (this.isAdmin() && this.branchFilter() !== null) list.push({ id: 'branch', label: 'Sucursal', text: this.branchNames().get(this.branchFilter()!) ?? `Sede ${this.branchFilter()}` });
    if (this.minTotal() !== null) list.push({ id: 'minTotal', label: 'Valor desde', text: formatMoney(this.minTotal()) });
    if (this.maxTotal() !== null) list.push({ id: 'maxTotal', label: 'Valor hasta', text: formatMoney(this.maxTotal()) });
    if (this.search().trim()) list.push({ id: 'search', label: 'Búsqueda', text: this.search().trim() });
    return list;
  });

  protected readonly selected = computed(() => this.requests().find((r) => r.id === this.selectedId()) ?? null);
  protected readonly selectedBranch = computed(() => (this.isAdmin() ? (this.branchNames().get(this.selected()?.branchId ?? -1) ?? '') : ''));
  protected readonly pending = computed(() => this.requests().filter((r) => r.status === 'PENDIENTE').length);

  protected readonly summary = computed(() => {
    const pending = this.pending();
    const total = this.requests().length;
    const all = total === 1 ? '1 solicitud' : `${total} solicitudes`;
    return pending === 0 ? `${all}, ninguna pendiente` : `${all}, ${pending === 1 ? '1 pendiente' : `${pending} pendientes`}`;
  });

  constructor() {
    void this.load();
    forkJoin({
      sales: this.api.sales().pipe(catchError(() => of([]))),
      products: this.catalog.products().pipe(catchError(() => of([]))),
      branches: this.branchApi.list().pipe(catchError(() => of([]))),
      // Quien no administra usuarios (403) no puede pedir sus nombres: se muestra el número.
      users: this.userApi.names().pipe(catchError(() => of([]))),
    }).subscribe(({ sales, products, branches, users }) => {
      this.sales.set(sales);
      this.products.set(products);
      this.branches.set(branches);
      this.users.set(users);
    });
  }

  protected async load(silent = false): Promise<void> {
    if (!silent) this.loading.set(true);
    this.error.set(null);
    try {
      const branch = this.isAdmin() ? null : this.ownBranch();
      if (!this.isAdmin() && branch === null) throw new Error('Tu usuario no tiene una sucursal asignada.');
      this.requests.set(await firstValueFrom(this.api.list(branch)));
    } catch (error) {
      this.error.set(error instanceof Error && !('status' in error) ? error.message : toApiError(error).message);
    } finally {
      this.loading.set(false);
    }
  }

  /** Tras crear o decidir una solicitud se vuelve a pedir la lista (de ahí sale lo que ya se devolvió de cada venta). */
  protected async refresh(): Promise<void> {
    await this.load(true);
  }

  protected onSearch(event: Event): void {
    this.search.set((event.target as HTMLInputElement).value);
  }

  protected removeFilter(id: string): void {
    switch (id) {
      case 'status': this.statusFilter.set('PENDIENTE'); break;
      case 'from': this.from.set(null); break;
      case 'to': this.to.set(null); break;
      case 'product': this.productFilter.set(null); break;
      case 'requester': this.requesterFilter.set(null); break;
      case 'branch': this.branchFilter.set(null); break;
      case 'minTotal': this.minTotal.set(null); break;
      case 'maxTotal': this.maxTotal.set(null); break;
      case 'search': this.search.set(''); break;
    }
  }

  protected clearFilters(): void {
    for (const filter of this.activeFilters()) this.removeFilter(filter.id);
  }

  protected openDetail(row: ReturnRow): void {
    this.selectedId.set(row.id);
    this.detailOpen.set(true);
  }

  protected statusVariant(row: ReturnRow): BadgeVariant {
    return RETURN_INFO[row.status].variant;
  }
}
