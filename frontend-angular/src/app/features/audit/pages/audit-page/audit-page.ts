import { ChangeDetectionStrategy, Component, computed, inject, signal, untracked } from '@angular/core';
import { catchError, firstValueFrom, map, of } from 'rxjs';
import {
  LucideCalendar,
  LucideClipboardList,
  LucideEye,
  LucideFileText,
  LucideHash,
  LucidePackage,
  LucideSearch,
  LucideStore,
  LucideTag,
  LucideUser,
  LucideArrowUpDown,
  LucideScale,
  LucideLock,
} from '@lucide/angular';
import { toApiError } from '@core/api/api-error';
import { type BranchOption, BranchOptionsApi } from '@core/branches/branch-options-api';
import { CatalogOptionsApi, type ProductOption } from '@core/catalog/catalog-options-api';
import { NotificationService } from '@core/notifications/notification.service';
import { type UserName, UserOptionsApi } from '@core/users/user-options-api';
import { formatDateTime, formatQuantity } from '@shared/format/format';
import { numberFromInput } from '@shared/filters/filter-helpers';
import { codecs, persistedFilter } from '@shared/filters/persisted-filter';
import { debouncedText } from '@shared/data/debounced-text';
import { type PagedQuery, serverPagedList } from '@shared/data/server-paged-list';
import { Checkbox } from '@shared/ui/checkbox/checkbox';
import { Badge } from '@shared/ui/badge/badge';
import { Button } from '@shared/ui/button/button';
import { DataTable, DataTableCell, type TableColumn } from '@shared/ui/data-table/data-table';
import { DatePicker } from '@shared/ui/date-picker/date-picker';
import { ActiveFilters, type ActiveFilter } from '@shared/ui/filters/active-filters';
import { AdvancedFilters } from '@shared/ui/filters/advanced-filters';
import { FormField, InputDirective } from '@shared/ui/form-field/form-field';
import { Select, type SelectOption } from '@shared/ui/select/select';
import { type TabItem, Tabs } from '@shared/ui/tabs/tabs';
import { Tooltip } from '@shared/ui/tooltip/tooltip';
import { LoginEventsPanel } from '../../components/login-events-panel/login-events-panel';
import { AuditDetailModal, type AuditRow } from '../../components/audit-detail-modal/audit-detail-modal';
import { MOVEMENT_REASONS, type MovementQuery, type MovementReason, type MovementRecord, MovementSearchApi, type MovementType } from '@core/inventory/movement-search-api';
import { REASON_INFO, documentLabel, subReasonText } from '../../data-access/audit-labels';

const rowKey = (row: AuditRow): number => row.id;
const DAY = new Intl.DateTimeFormat('es-CO', { dateStyle: 'medium' });
/** Filas por página. */
const PAGE_SIZE = 15;
/** Espera tras la última tecla antes de buscar: no se pide una página por cada letra. */
const SEARCH_DELAY_MS = 300;

/** De la consulta de la lista al formato de la API (orden por fecha, del más reciente, si no se eligió otro). */
/** Columna de la tabla → campo de orden del servidor. */
const SORT_KEYS: Readonly<Record<string, string>> = {
  date: 'date',
  branch: 'branch',
  product: 'product',
  typeLabel: 'type',
  reasonLabel: 'reason',
  signedQuantity: 'quantity',
  balance: 'balance',
  responsible: 'responsible',
  document: 'document',
};

const toMovementQuery = ({ sort, ...query }: PagedQuery<Omit<MovementQuery, 'page' | 'size' | 'sortBy' | 'ascending'>>): MovementQuery => ({
  ...query,
  sortBy: sort ? (SORT_KEYS[sort.key] ?? 'date') : 'date',
  ascending: sort ? sort.direction === 'asc' : false,
});

const toRow = (m: MovementRecord): AuditRow => ({
  ...m,
  product: m.productName,
  branch: m.branchName,
  responsible: m.userName,
  document: documentLabel(m.referenceType, m.referenceId),
  reasonLabel: REASON_INFO[m.reason].label,
  typeLabel: m.type === 'INGRESO' ? 'Ingreso' : 'Retiro',
  signedQuantity: m.type === 'INGRESO' ? m.quantity : -m.quantity,
});

/**
 * Auditoría global: todos los movimientos de existencias. El servidor filtra, ordena y pagina (son decenas de miles);
 * la pantalla pide solo la página que se ve y vuelve a pedir al cambiar un filtro, el orden o la página.
 */
@Component({
  selector: 'app-audit-page',
  imports: [Checkbox, DataTable, DataTableCell, Badge, Button, DatePicker, ActiveFilters, AdvancedFilters, FormField, InputDirective, Select, Tabs, Tooltip, AuditDetailModal, LoginEventsPanel, LucideEye, LucideSearch],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block p-(--page-padding)' },
  templateUrl: './audit-page.html',
})
export class AuditPage {
  private readonly api = inject(MovementSearchApi);
  private readonly branchApi = inject(BranchOptionsApi);
  private readonly catalog = inject(CatalogOptionsApi);
  private readonly userApi = inject(UserOptionsApi);
  private readonly notifications = inject(NotificationService);

  protected readonly rowKey = rowKey;
  protected readonly pageSize = PAGE_SIZE;
  protected readonly storeIcon = LucideStore.icon;
  protected readonly tagIcon = LucideTag.icon;
  protected readonly typeIcon = LucideArrowUpDown.icon;
  protected readonly formatQuantity = formatQuantity;
  protected readonly reasonInfo = REASON_INFO;

  protected readonly branches = signal<readonly BranchOption[]>([]);
  protected readonly products = signal<readonly ProductOption[]>([]);
  protected readonly users = signal<readonly UserName[]>([]);

  // Los filtros se recuerdan por persona (la búsqueda de texto no: se escribe cada vez). Producto y responsable se
  // guardan por id (antes, por nombre: las claves cambiaron para no leer un valor viejo).
  private static readonly SCREEN = 'audit';
  private readonly searchBox = debouncedText(SEARCH_DELAY_MS);
  protected readonly search = this.searchBox.text;
  protected readonly branchFilter = persistedFilter(AuditPage.SCREEN, 'branch', null as number | null, codecs.nullable(codecs.number()));
  protected readonly typeFilter = persistedFilter(AuditPage.SCREEN, 'type', null as MovementType | null, codecs.nullable(codecs.oneOf(['INGRESO', 'RETIRO'] as const)));
  protected readonly reasonFilter = persistedFilter(AuditPage.SCREEN, 'reason', null as MovementReason | null, codecs.nullable(codecs.oneOf(MOVEMENT_REASONS)));
  protected readonly from = persistedFilter(AuditPage.SCREEN, 'from', null as Date | null, codecs.nullable(codecs.date()));
  protected readonly to = persistedFilter(AuditPage.SCREEN, 'to', null as Date | null, codecs.nullable(codecs.date()));
  protected readonly productFilter = persistedFilter(AuditPage.SCREEN, 'productId', null as number | null, codecs.nullable(codecs.number()));
  protected readonly responsibleFilter = persistedFilter(AuditPage.SCREEN, 'userId', null as number | null, codecs.nullable(codecs.number()));
  protected readonly minQuantity = persistedFilter(AuditPage.SCREEN, 'minQuantity', null as number | null, codecs.nullable(codecs.number()));
  protected readonly maxQuantity = persistedFilter(AuditPage.SCREEN, 'maxQuantity', null as number | null, codecs.nullable(codecs.number()));
  protected readonly onlyObserved = persistedFilter(AuditPage.SCREEN, 'onlyObserved', false, codecs.bool());
  protected readonly advancedOpen = persistedFilter(AuditPage.SCREEN, 'advancedOpen', false, codecs.bool());
  protected readonly numberFromInput = numberFromInput;
  protected readonly sort = signal<{ key: string; direction: 'asc' | 'desc' } | null>(null);

  /** Qué se audita: los movimientos de inventario o los inicios de sesión. Se recuerda por persona. */
  protected readonly tab = persistedFilter(AuditPage.SCREEN, 'tab', 'movements', codecs.oneOf(['movements', 'logins'] as const));
  protected readonly tabs: readonly TabItem[] = [
    { id: 'movements', label: 'Movimientos de inventario', icon: LucideArrowUpDown.icon },
    { id: 'logins', label: 'Inicios de sesión', icon: LucideLock.icon },
  ];

  protected readonly detailOpen = signal(false);
  protected readonly selectedId = signal<number | null>(null);

  protected readonly branchOptions = computed<SelectOption<number | null>[]>(() => [
    { value: null, label: 'Todas las sucursales' },
    ...this.branches().map((b) => ({ value: b.id, label: b.nombre })),
  ]);
  protected readonly typeOptions: readonly SelectOption<MovementType | null>[] = [
    { value: null, label: 'Ingresos y retiros' },
    { value: 'INGRESO', label: 'Solo ingresos' },
    { value: 'RETIRO', label: 'Solo retiros' },
  ];
  protected readonly reasonOptions: readonly SelectOption<MovementReason | null>[] = [
    { value: null, label: 'Todos los motivos' },
    ...MOVEMENT_REASONS.map((value) => ({ value, label: REASON_INFO[value].label, icon: REASON_INFO[value].icon })),
  ];
  protected readonly productOptions = computed<SelectOption<number | null>[]>(() => [
    { value: null, label: 'Todos los productos' },
    ...this.products().map((p) => ({ value: p.id, label: p.nombre, description: p.sku || undefined })),
  ]);
  protected readonly responsibleOptions = computed<SelectOption<number | null>[]>(() => [
    { value: null, label: 'Todos los responsables' },
    ...this.users().map((u) => ({ value: u.id, label: u.nombre })),
  ]);

  /** Columnas del CSV: las de la tabla más el detalle que ahí no cabe (submotivo y observaciones completas). */
  protected readonly exportColumns: readonly TableColumn<AuditRow>[] = [
    { key: 'date', header: 'Fecha', value: (r) => r.date },
    { key: 'branch', header: 'Sucursal' },
    { key: 'product', header: 'Producto' },
    { key: 'typeLabel', header: 'Tipo' },
    { key: 'reasonLabel', header: 'Motivo' },
    { key: 'subReason', header: 'Submotivo', value: (r) => (r.subReason ? subReasonText(r.subReason) : '') },
    { key: 'signedQuantity', header: 'Cantidad' },
    { key: 'balance', header: 'Saldo' },
    { key: 'responsible', header: 'Responsable' },
    { key: 'document', header: 'Documento' },
    { key: 'observations', header: 'Observaciones' },
  ];

  protected readonly columns: readonly TableColumn<AuditRow>[] = [
    { key: 'date', header: 'Fecha', icon: LucideCalendar.icon, sortable: true, nowrap: true, width: '11.5rem', value: (r) => r.date, display: (r) => formatDateTime(r.date) },
    { key: 'branch', header: 'Sucursal', icon: LucideStore.icon, sortable: true },
    { key: 'product', header: 'Producto', icon: LucidePackage.icon, sortable: true, primary: true },
    { key: 'typeLabel', header: 'Tipo', icon: LucideArrowUpDown.icon, sortable: true },
    { key: 'reasonLabel', header: 'Motivo', icon: LucideTag.icon, sortable: true },
    { key: 'signedQuantity', header: 'Cantidad', icon: LucideHash.icon, sortable: true, align: 'end', display: (r) => `${r.type === 'INGRESO' ? '+' : '−'}${formatQuantity(r.quantity)}` },
    { key: 'balance', header: 'Saldo', icon: LucideScale.icon, sortable: true, align: 'end', display: (r) => (r.balance === null ? '—' : formatQuantity(r.balance)) },
    { key: 'responsible', header: 'Responsable', icon: LucideUser.icon, sortable: true },
    { key: 'document', header: 'Documento', icon: LucideFileText.icon, sortable: true },
    { key: 'acciones', header: 'Detalle', icon: LucideClipboardList.icon, align: 'end' },
  ];

  /** Los filtros tal como se mandan al servidor (al cambiar alguno, se vuelve a la página 1). */
  private readonly filters = computed(() => ({
    branchId: this.branchFilter(),
    type: this.typeFilter(),
    reasons: this.reasonFilter() === null ? [] : [this.reasonFilter()!],
    from: this.from(),
    to: this.to(),
    productIds: this.productFilter() === null ? [] : [this.productFilter()!],
    userId: this.responsibleFilter(),
    minQuantity: this.minQuantity(),
    maxQuantity: this.maxQuantity(),
    onlyObserved: this.onlyObserved(),
    text: this.searchBox.term(),
  }));
  /** La página que se ve: el servidor filtra, ordena, pagina y suma lo que entró y salió. */
  private readonly list = serverPagedList({
    filters: this.filters,
    sort: this.sort,
    size: PAGE_SIZE,
    fetch: (query) => this.api.search(toMovementQuery(query)).pipe(map((page) => ({ ...page, rows: page.movements.map(toRow) }))),
  });
  protected readonly rows = this.list.rows;
  protected readonly total = this.list.total;
  protected readonly loading = this.list.loading;
  protected readonly error = this.list.error;
  protected readonly page = this.list.page;
  private readonly totals = computed(() => ({ in: this.list.last()?.totalIn ?? 0, out: this.list.last()?.totalOut ?? 0 }));

  /** Los filtros del panel «Más filtros» que están aplicados (el botón muestra cuántos). */
  protected readonly advancedCount = computed(
    () => [this.productFilter() !== null, this.responsibleFilter() !== null, this.minQuantity() !== null, this.maxQuantity() !== null, this.onlyObserved()].filter(Boolean).length,
  );

  /** Todos los filtros aplicados, para mostrarlos como etiquetas que se quitan. */
  protected readonly activeFilters = computed<ActiveFilter[]>(() => {
    const list: ActiveFilter[] = [];
    const branch = this.branchFilter();
    if (branch !== null) list.push({ id: 'branch', label: 'Sucursal', text: this.branches().find((b) => b.id === branch)?.nombre ?? `Sede ${branch}` });
    if (this.typeFilter() !== null) list.push({ id: 'type', label: 'Tipo', text: this.typeFilter() === 'INGRESO' ? 'Ingresos' : 'Retiros' });
    if (this.reasonFilter() !== null) list.push({ id: 'reason', label: 'Motivo', text: REASON_INFO[this.reasonFilter()!].label });
    if (this.from() !== null) list.push({ id: 'from', label: 'Desde', text: DAY.format(this.from()!) });
    if (this.to() !== null) list.push({ id: 'to', label: 'Hasta', text: DAY.format(this.to()!) });
    const product = this.productFilter();
    if (product !== null) list.push({ id: 'product', label: 'Producto', text: this.products().find((p) => p.id === product)?.nombre ?? `Producto ${product}` });
    const user = this.responsibleFilter();
    if (user !== null) list.push({ id: 'responsible', label: 'Responsable', text: this.users().find((u) => u.id === user)?.nombre ?? `Usuario ${user}` });
    if (this.minQuantity() !== null) list.push({ id: 'minQuantity', label: 'Cantidad desde', text: formatQuantity(this.minQuantity()) });
    if (this.maxQuantity() !== null) list.push({ id: 'maxQuantity', label: 'Cantidad hasta', text: formatQuantity(this.maxQuantity()) });
    if (this.onlyObserved()) list.push({ id: 'onlyObserved', label: 'Con', text: 'observaciones' });
    if (this.search().trim()) list.push({ id: 'search', label: 'Búsqueda', text: this.search().trim() });
    return list;
  });

  protected readonly filtered = computed(() => this.activeFilters().length > 0);

  /** Resumen de TODO lo filtrado (lo calcula el servidor), no solo de la página. */
  protected readonly summary = computed(() => {
    const count = this.total();
    const { in: ins, out } = this.totals();
    const label = count === 1 ? '1 movimiento' : `${formatQuantity(count)} movimientos`;
    return `${label}: entraron ${formatQuantity(ins)} unidades y salieron ${formatQuantity(out)}`;
  });

  protected readonly selected = computed(() => this.rows().find((r) => r.id === this.selectedId()) ?? null);

  /** Para el CSV: todas las filas filtradas en el orden elegido, no solo la página. */
  protected readonly exportAll = (): Promise<readonly AuditRow[]> =>
    firstValueFrom(this.api.exportAll(toMovementQuery(untracked(this.list.query)))).then((movements) => movements.map(toRow));

  constructor() {
    // Las opciones de los filtros: si alguna lista no llega (p. ej. la de usuarios, que no todos pueden ver), queda vacía.
    this.branchApi.list().pipe(catchError(() => of([]))).subscribe((branches) => this.branches.set(branches));
    this.catalog.products().pipe(catchError(() => of([]))).subscribe((products) => this.products.set(products));
    this.userApi.names().pipe(catchError(() => of([]))).subscribe((users) => this.users.set(users));
  }

  protected load(silent = false): Promise<void> {
    return this.list.reload(silent);
  }

  protected onSearch(event: Event): void {
    this.searchBox.set((event.target as HTMLInputElement).value);
  }

  protected exportFailed(error: unknown): void {
    this.notifications.error(`No se pudo exportar: ${toApiError(error).message}`);
  }

  protected removeFilter(id: string): void {
    switch (id) {
      case 'branch': this.branchFilter.set(null); break;
      case 'type': this.typeFilter.set(null); break;
      case 'reason': this.reasonFilter.set(null); break;
      case 'from': this.from.set(null); break;
      case 'to': this.to.set(null); break;
      case 'product': this.productFilter.set(null); break;
      case 'responsible': this.responsibleFilter.set(null); break;
      case 'minQuantity': this.minQuantity.set(null); break;
      case 'maxQuantity': this.maxQuantity.set(null); break;
      case 'onlyObserved': this.onlyObserved.set(false); break;
      case 'search': this.searchBox.clear(); break;
    }
  }

  protected clearFilters(): void {
    for (const filter of this.activeFilters()) this.removeFilter(filter.id);
  }

  protected openDetail(row: AuditRow): void {
    this.selectedId.set(row.id);
    this.detailOpen.set(true);
  }

  protected reasonVariant(row: AuditRow) {
    return REASON_INFO[row.reason].variant;
  }

  protected subReason(row: AuditRow): string {
    return row.subReason ? subReasonText(row.subReason) : '';
  }
}
