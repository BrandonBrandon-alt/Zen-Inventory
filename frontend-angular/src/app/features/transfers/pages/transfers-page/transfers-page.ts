import { ChangeDetectionStrategy, Component, computed, inject, signal, untracked } from '@angular/core';
import { catchError, firstValueFrom, forkJoin, map, of } from 'rxjs';
import {
  LucideCalendar,
  LucideCircleCheck,
  LucideEye,
  LucideFlag,
  LucideHash,
  LucideListFilter,
  LucidePackage,
  LucidePlus,
  LucideRoute,
  LucideSearch,
  LucideWallet,
} from '@lucide/angular';
import { toApiError } from '@core/api/api-error';
import { AuthStore } from '@core/auth/session/auth-store';
import { type BranchOption, BranchOptionsApi } from '@core/branches/branch-options-api';
import { CatalogOptionsApi, type ProductOption } from '@core/catalog/catalog-options-api';
import { debouncedText } from '@shared/data/debounced-text';
import { type PagedQuery, type SortState, serverPagedList } from '@shared/data/server-paged-list';
import { formatDateTime, formatMoney } from '@shared/format/format';
import { codecs, persistedFilter } from '@shared/filters/persisted-filter';
import { Checkbox } from '@shared/ui/checkbox/checkbox';
import { Badge, type BadgeVariant } from '@shared/ui/badge/badge';
import { Button } from '@shared/ui/button/button';
import { DatePicker } from '@shared/ui/date-picker/date-picker';
import { ActiveFilters, type ActiveFilter } from '@shared/ui/filters/active-filters';
import { AdvancedFilters } from '@shared/ui/filters/advanced-filters';
import { FormField, InputDirective } from '@shared/ui/form-field/form-field';
import { DataTable, DataTableCell, type TableColumn } from '@shared/ui/data-table/data-table';
import { Segmented, type SegmentedOption } from '@shared/ui/segmented/segmented';
import { Select, type SelectOption } from '@shared/ui/select/select';
import { Tooltip } from '@shared/ui/tooltip/tooltip';
import { TransferDetailModal } from '../../components/transfer-detail-modal/transfer-detail-modal';
import { TransferRequestModal, type TransferPreset } from '../../components/transfer-request-modal/transfer-request-modal';
import { takeNewDocumentRequest } from '@core/navigation/new-document-link';
import { FREIGHT_INFO, PRIORITY_INFO, STATUS_INFO } from '../../data-access/transfer-labels';
import type { Actor } from '../../data-access/transfer-permissions';
import {
  type Transfer,
  type TransferListRow,
  type TransferQuery,
  type TransferSortField,
  type TransferSummary,
  TRANSFER_STATUSES,
  type TransferPriority,
  type TransferStatus,
  TransfersApi,
} from '../../data-access/transfers-api';

type Direction = 'all' | 'incoming' | 'outgoing';

/** Fila de la tabla: el traslado con los textos que se muestran. */
interface TransferRow extends TransferListRow {
  readonly route: string;
  readonly statusLabel: string;
  readonly priorityLabel: string;
  readonly freightLabel: string;
  readonly products: string;
}

type StatusFilter = 'open' | 'all' | TransferStatus;
interface TransferFilters {
  readonly status: StatusFilter;
  readonly flow: Direction;
  readonly priority: TransferPriority | null;
  readonly from: Date | null;
  readonly to: Date | null;
  readonly originId: number | null;
  readonly destinationId: number | null;
  readonly productId: number | null;
  readonly onlyMine: boolean;
  readonly text: string;
}

const PAGE_SIZE = 10;
const SEARCH_DELAY_MS = 300;
/** Columna de la tabla → campo de orden del servidor. */
const SORT_KEYS: Readonly<Record<string, TransferSortField>> = {
  id: 'id',
  statusLabel: 'status',
  route: 'route',
  priorityLabel: 'priority',
  freightLabel: 'freight',
  requestDate: 'requestDate',
};

const toRow = (t: TransferListRow): TransferRow => ({
  ...t,
  route: `${t.originName} → ${t.destinationName}`,
  statusLabel: STATUS_INFO[t.status].label,
  priorityLabel: PRIORITY_INFO[t.priority].label,
  freightLabel: FREIGHT_INFO[t.freightStatus].label,
  products: !t.firstProductName ? '—' : t.productCount > 1 ? `${t.firstProductName} +${t.productCount - 1}` : t.firstProductName,
});

function toTransferQuery({ sort, ...query }: PagedQuery<TransferFilters>): TransferQuery {
  return { ...query, sortBy: sort ? (SORT_KEYS[sort.key] ?? 'id') : 'id', ascending: sort ? sort.direction === 'asc' : false };
}

const rowKey = (row: TransferRow): number => row.id;
const DAY = new Intl.DateTimeFormat('es-CO', { dateStyle: 'medium' });
const PRIORITIES: readonly TransferPriority[] = ['HIGH', 'NORMAL', 'LOW'];

@Component({
  selector: 'app-transfers-page',
  imports: [
    Checkbox,
    DataTable,
    DataTableCell,
    Badge,
    Button,
    DatePicker,
    ActiveFilters,
    AdvancedFilters,
    FormField,
    InputDirective,
    Segmented,
    Select,
    Tooltip,
    TransferDetailModal,
    TransferRequestModal,
    LucideEye,
    LucidePlus,
    LucideSearch,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block p-(--page-padding)' },
  templateUrl: './transfers-page.html',
})
export class TransfersPage {
  private readonly api = inject(TransfersApi);
  private readonly branchApi = inject(BranchOptionsApi);
  private readonly catalog = inject(CatalogOptionsApi);
  private readonly session = inject(AuthStore).session;
  private readonly role = inject(AuthStore).role;

  protected readonly rowKey = rowKey;
  protected readonly pageSize = PAGE_SIZE;
  protected readonly formatDateTime = formatDateTime;
  protected readonly filterIcon = LucideListFilter.icon;
  protected readonly priorityIcon = LucideFlag.icon;

  protected readonly isAdmin = computed(() => this.role() === 'ADMIN');
  protected readonly ownBranchId = computed(() => this.session()?.sucursalId ?? null);
  protected readonly actor = computed<Actor>(() => ({ role: this.role(), branchId: this.ownBranchId() }));

  protected readonly branches = signal<readonly BranchOption[]>([]);
  protected readonly products = signal<readonly ProductOption[]>([]);

  // Los filtros se recuerdan por persona (la búsqueda de texto no: se escribe cada vez).
  private static readonly SCREEN = 'transfers';
  private readonly searchBox = debouncedText(SEARCH_DELAY_MS);
  protected readonly search = this.searchBox.text;
  protected readonly direction = persistedFilter(TransfersPage.SCREEN, 'direction', 'all' as Direction, codecs.oneOf(['all', 'incoming', 'outgoing'] as const));
  protected readonly statusFilter = persistedFilter(TransfersPage.SCREEN, 'status', 'open' as StatusFilter, codecs.oneOf(['open', 'all', ...TRANSFER_STATUSES] as const));
  protected readonly priorityFilter = persistedFilter(TransfersPage.SCREEN, 'priority', null as TransferPriority | null, codecs.nullable(codecs.oneOf(PRIORITIES)));
  protected readonly from = persistedFilter(TransfersPage.SCREEN, 'from', null as Date | null, codecs.nullable(codecs.date()));
  protected readonly to = persistedFilter(TransfersPage.SCREEN, 'to', null as Date | null, codecs.nullable(codecs.date()));
  protected readonly originFilter = persistedFilter(TransfersPage.SCREEN, 'origin', null as number | null, codecs.nullable(codecs.number()));
  protected readonly destinationFilter = persistedFilter(TransfersPage.SCREEN, 'destination', null as number | null, codecs.nullable(codecs.number()));
  // Por id (antes se guardaba el nombre con la clave «product»: ese valor viejo ya no se lee).
  protected readonly productFilter = persistedFilter(TransfersPage.SCREEN, 'productId', null as number | null, codecs.nullable(codecs.number()));
  protected readonly onlyMine = persistedFilter(TransfersPage.SCREEN, 'onlyMine', false, codecs.bool());
  protected readonly advancedOpen = persistedFilter(TransfersPage.SCREEN, 'advancedOpen', false, codecs.bool());

  protected readonly requestOpen = signal(false);
  /** Lo que llega ya elegido a la solicitud cuando se viene de otra pantalla (el ajuste de stock). */
  protected readonly requestPreset = signal<TransferPreset | null>(null);
  protected readonly detailOpen = signal(false);
  protected readonly selectedRow = signal<TransferRow | null>(null);
  protected readonly selected = signal<Transfer | null>(null);
  protected readonly detailError = signal<string | null>(null);
  private detailRequest = 0;

  protected readonly directionOptions: readonly SegmentedOption<Direction>[] = [
    { value: 'all', label: 'Todos' },
    { value: 'incoming', label: 'Entrantes' },
    { value: 'outgoing', label: 'Salientes' },
  ];

  protected readonly statusOptions: readonly SelectOption<StatusFilter>[] = [
    { value: 'open', label: 'En curso' },
    { value: 'all', label: 'Todos los estados' },
    ...TRANSFER_STATUSES.map((value) => ({ value, label: STATUS_INFO[value].label, icon: STATUS_INFO[value].icon })),
  ];

  protected readonly priorityOptions: readonly SelectOption<TransferPriority | null>[] = [
    { value: null, label: 'Todas las prioridades' },
    ...PRIORITIES.map((value) => ({ value, label: PRIORITY_INFO[value].label })),
  ];
  protected readonly branchOptions = computed<SelectOption<number | null>[]>(() => [
    { value: null, label: 'Todas las sucursales' },
    ...this.branches().map((b) => ({ value: b.id, label: b.nombre })),
  ]);
  protected readonly productOptions = computed<SelectOption<number | null>[]>(() => [
    { value: null, label: 'Todos los productos' },
    ...this.products().map((p) => ({ value: p.id, label: p.nombre })),
  ]);
  private readonly productNames = computed(() => new Map(this.products().map((p) => [p.id, p.nombre])));

  private readonly branchNames = computed(() => new Map(this.branches().map((b) => [b.id, b.nombre])));
  protected readonly names = computed<ReadonlyMap<number, string>>(() => this.branchNames());

  protected readonly columns: readonly TableColumn<TransferRow>[] = [
    { key: 'id', header: 'N.º', icon: LucideHash.icon, sortable: true, width: '5rem', display: (r) => `#${r.id}` },
    { key: 'statusLabel', header: 'Estado', icon: LucideCircleCheck.icon, sortable: true },
    { key: 'route', header: 'Ruta', icon: LucideRoute.icon, sortable: true, primary: true },
    { key: 'products', header: 'Productos', icon: LucidePackage.icon },
    { key: 'priorityLabel', header: 'Prioridad', icon: LucideFlag.icon, sortable: true },
    { key: 'freightLabel', header: 'Flete', icon: LucideWallet.icon, sortable: true },
    { key: 'requestDate', header: 'Solicitado', icon: LucideCalendar.icon, sortable: true, nowrap: true, width: '11.5rem', value: (r) => r.requestDate, display: (r) => formatDateTime(r.requestDate) },
    { key: 'acciones', header: 'Acciones', align: 'end' },
  ];

  protected readonly sort = signal<SortState | null>(null);
  private readonly filters = computed<TransferFilters>(() => ({
    status: this.statusFilter(),
    // El ADMIN no tiene «Entrantes/Salientes» (ve todas las sucursales).
    flow: this.isAdmin() ? 'all' : this.direction(),
    priority: this.priorityFilter(),
    from: this.from(),
    to: this.to(),
    originId: this.originFilter(),
    destinationId: this.destinationFilter(),
    productId: this.productFilter(),
    onlyMine: this.onlyMine(),
    text: this.searchBox.term(),
  }));
  private readonly list = serverPagedList({
    filters: this.filters,
    sort: this.sort,
    size: PAGE_SIZE,
    fetch: (query) => this.api.search(toTransferQuery(query)).pipe(map((page) => ({ ...page, rows: page.transfers.map(toRow) }))),
  });
  protected readonly rows = this.list.rows;
  protected readonly total = this.list.total;
  protected readonly loading = this.list.loading;
  protected readonly error = this.list.error;
  protected readonly page = this.list.page;
  protected readonly exportAll = (): Promise<readonly TransferRow[]> =>
    firstValueFrom(this.api.searchAll(toTransferQuery(untracked(this.list.query))).pipe(map((rows) => rows.map(toRow))));

  /** Los filtros del panel «Más filtros» que están aplicados (el botón muestra cuántos). */
  protected readonly advancedCount = computed(
    () => [this.originFilter() !== null, this.destinationFilter() !== null, this.productFilter() !== null, this.onlyMine()].filter(Boolean).length,
  );

  /** Todos los filtros aplicados (menos los de siempre: «En curso» y «Todos»), para mostrarlos como etiquetas. */
  protected readonly activeFilters = computed<ActiveFilter[]>(() => {
    const list: ActiveFilter[] = [];
    const status = this.statusFilter();
    const branch = (id: number) => this.branchNames().get(id) ?? `Sede ${id}`;
    if (this.direction() !== 'all') list.push({ id: 'direction', label: 'Dirección', text: this.direction() === 'incoming' ? 'Entrantes' : 'Salientes' });
    if (status !== 'open') list.push({ id: 'status', label: 'Estado', text: status === 'all' ? 'Todos' : STATUS_INFO[status].label });
    if (this.priorityFilter() !== null) list.push({ id: 'priority', label: 'Prioridad', text: PRIORITY_INFO[this.priorityFilter()!].label });
    if (this.from() !== null) list.push({ id: 'from', label: 'Desde', text: DAY.format(this.from()!) });
    if (this.to() !== null) list.push({ id: 'to', label: 'Hasta', text: DAY.format(this.to()!) });
    if (this.originFilter() !== null) list.push({ id: 'origin', label: 'Origen', text: branch(this.originFilter()!) });
    if (this.destinationFilter() !== null) list.push({ id: 'destination', label: 'Destino', text: branch(this.destinationFilter()!) });
    if (this.productFilter() !== null) list.push({ id: 'product', label: 'Producto', text: this.productNames().get(this.productFilter()!) ?? `Producto ${this.productFilter()}` });
    if (this.onlyMine()) list.push({ id: 'onlyMine', label: 'Solo los que', text: 'esperan mi acción' });
    if (this.search().trim()) list.push({ id: 'search', label: 'Búsqueda', text: this.search().trim() });
    return list;
  });

  /** Los totales del encabezado, sobre todo lo visible (no solo la página): los calcula el servidor. */
  protected readonly headline = signal<TransferSummary | null>(null);
  protected readonly pending = computed(() => this.headline()?.awaitingMe ?? 0);
  protected readonly formatMoney = formatMoney;

  protected readonly summary = computed(() => {
    const open = this.headline()?.open ?? 0;
    return open === 1 ? '1 traslado en curso' : `${open} traslados en curso`;
  });

  constructor() {
    // Desde «Traslado recibido/enviado» en el ajuste de stock: la sucursal del inventario es el destino o el origen.
    const request = takeNewDocumentRequest();
    if (request) {
      const sending = request.side === 'origen';
      this.openRequest({
        productId: request.productId,
        originBranchId: sending ? request.branchId : null,
        destinationBranchId: sending ? null : request.branchId,
      });
    }
    void this.loadSummary();
    // Los nombres de sucursal y de producto alimentan los filtros y el formulario: si fallan, se muestran los códigos.
    forkJoin({
      branches: this.branchApi.list().pipe(catchError(() => of([]))),
      products: this.catalog.products().pipe(catchError(() => of([]))),
    }).subscribe(({ branches, products }) => {
      this.branches.set(branches);
      this.products.set(products);
    });
  }

  protected openRequest(preset: TransferPreset | null = null): void {
    this.requestPreset.set(preset);
    this.requestOpen.set(true);
  }

  /** Recarga la página que se ve y el encabezado (tras solicitar o cambiar un traslado). */
  protected async load(silent = false): Promise<void> {
    await Promise.all([this.list.reload(silent), this.loadSummary()]);
  }

  /** Un traslado cambió desde su detalle: se recargan la lista, el encabezado y el traslado abierto. */
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
      const transfer = await firstValueFrom(this.api.get(id));
      if (request === this.detailRequest) {
        this.selected.set(transfer);
        this.detailError.set(null);
      }
    } catch (error) {
      if (request === this.detailRequest && this.selected()?.id !== id) this.detailError.set(toApiError(error).message);
    }
  }

  protected openDetail(row: TransferRow): void {
    // Si es otro traslado, no se muestra el anterior mientras llega el nuevo; si es el mismo, se ve lo último mientras se refresca.
    if (this.selected()?.id !== row.id) this.selected.set(null);
    this.detailError.set(null);
    this.selectedRow.set(row);
    this.detailOpen.set(true);
    void this.loadDetail(row.id);
  }

  protected statusVariant(row: TransferRow): BadgeVariant {
    return STATUS_INFO[row.status].variant;
  }

  protected priorityVariant(row: TransferRow): BadgeVariant {
    return PRIORITY_INFO[row.priority].variant;
  }

  protected onSearch(event: Event): void {
    this.searchBox.set((event.target as HTMLInputElement).value);
  }

  protected removeFilter(id: string): void {
    switch (id) {
      case 'direction': this.direction.set('all'); break;
      case 'status': this.statusFilter.set('open'); break;
      case 'priority': this.priorityFilter.set(null); break;
      case 'from': this.from.set(null); break;
      case 'to': this.to.set(null); break;
      case 'origin': this.originFilter.set(null); break;
      case 'destination': this.destinationFilter.set(null); break;
      case 'product': this.productFilter.set(null); break;
      case 'onlyMine': this.onlyMine.set(false); break;
      case 'search': this.searchBox.clear(); break;
    }
  }

  protected clearFilters(): void {
    for (const filter of this.activeFilters()) this.removeFilter(filter.id);
  }

  protected freightVariant(row: TransferRow): BadgeVariant {
    return FREIGHT_INFO[row.freightStatus].variant;
  }
}
