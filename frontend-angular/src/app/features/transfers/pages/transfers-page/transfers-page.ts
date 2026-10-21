import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { catchError, firstValueFrom, forkJoin, of } from 'rxjs';
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
import { formatDateTime, formatMoney, normalizeText } from '@shared/format/format';
import { inDateRange, optionsFrom } from '@shared/filters/filter-helpers';
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
import { TransferRequestModal } from '../../components/transfer-request-modal/transfer-request-modal';
import { FREIGHT_INFO, OPEN_STATUSES, PRIORITY_INFO, STATUS_INFO } from '../../data-access/transfer-labels';
import { type Actor, transferActions } from '../../data-access/transfer-permissions';
import { type Transfer, TRANSFER_STATUSES, type TransferPriority, type TransferStatus, TransfersApi } from '../../data-access/transfers-api';

type Direction = 'all' | 'incoming' | 'outgoing';

/** Fila de la tabla: el traslado con los textos que se ordenan y se muestran. */
interface TransferRow extends Transfer {
  readonly route: string;
  readonly statusLabel: string;
  readonly priorityLabel: string;
  readonly freightLabel: string;
  readonly products: string;
  readonly needsMe: boolean;
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
  protected readonly formatDateTime = formatDateTime;
  protected readonly filterIcon = LucideListFilter.icon;
  protected readonly priorityIcon = LucideFlag.icon;

  protected readonly isAdmin = computed(() => this.role() === 'ADMIN');
  protected readonly ownBranchId = computed(() => this.session()?.sucursalId ?? null);
  protected readonly actor = computed<Actor>(() => ({ role: this.role(), branchId: this.ownBranchId() }));

  protected readonly transfers = signal<readonly Transfer[]>([]);
  protected readonly branches = signal<readonly BranchOption[]>([]);
  protected readonly products = signal<readonly ProductOption[]>([]);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);

  // Los filtros se recuerdan por persona (la búsqueda de texto no: se escribe cada vez).
  private static readonly SCREEN = 'transfers';
  protected readonly search = signal('');
  protected readonly direction = persistedFilter(TransfersPage.SCREEN, 'direction', 'all' as Direction, codecs.oneOf(['all', 'incoming', 'outgoing'] as const));
  protected readonly statusFilter = persistedFilter(TransfersPage.SCREEN, 'status', 'open' as 'open' | 'all' | TransferStatus, codecs.oneOf(['open', 'all', ...TRANSFER_STATUSES] as const));
  protected readonly priorityFilter = persistedFilter(TransfersPage.SCREEN, 'priority', null as TransferPriority | null, codecs.nullable(codecs.oneOf(PRIORITIES)));
  protected readonly from = persistedFilter(TransfersPage.SCREEN, 'from', null as Date | null, codecs.nullable(codecs.date()));
  protected readonly to = persistedFilter(TransfersPage.SCREEN, 'to', null as Date | null, codecs.nullable(codecs.date()));
  protected readonly originFilter = persistedFilter(TransfersPage.SCREEN, 'origin', null as number | null, codecs.nullable(codecs.number()));
  protected readonly destinationFilter = persistedFilter(TransfersPage.SCREEN, 'destination', null as number | null, codecs.nullable(codecs.number()));
  protected readonly productFilter = persistedFilter(TransfersPage.SCREEN, 'product', null as string | null, codecs.nullable(codecs.text()));
  protected readonly onlyMine = persistedFilter(TransfersPage.SCREEN, 'onlyMine', false, codecs.bool());
  protected readonly advancedOpen = persistedFilter(TransfersPage.SCREEN, 'advancedOpen', false, codecs.bool());

  protected readonly requestOpen = signal(false);
  protected readonly detailOpen = signal(false);
  protected readonly selectedId = signal<number | null>(null);

  protected readonly directionOptions: readonly SegmentedOption<Direction>[] = [
    { value: 'all', label: 'Todos' },
    { value: 'incoming', label: 'Entrantes' },
    { value: 'outgoing', label: 'Salientes' },
  ];

  protected readonly statusOptions: readonly SelectOption<'open' | 'all' | TransferStatus>[] = [
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
  protected readonly productOptions = computed(() => optionsFrom(this.transfers().flatMap((t) => t.lines.map((l) => l.productName)), this.productFilter(), 'Todos los productos'));

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

  protected readonly rows = computed<TransferRow[]>(() => {
    const own = this.ownBranchId();
    const direction = this.direction();
    const status = this.statusFilter();
    const names = this.branchNames();
    const name = (id: number) => names.get(id) ?? `Sede ${id}`;
    const needle = normalizeText(this.search().trim());
    const { priority, from, to, origin, destination, product } = {
      priority: this.priorityFilter(),
      from: this.from(),
      to: this.to(),
      origin: this.originFilter(),
      destination: this.destinationFilter(),
      product: this.productFilter(),
    };
    return this.transfers()
      .filter((t) => {
        if (direction === 'incoming' && t.destinationBranchId !== own) return false;
        if (direction === 'outgoing' && t.originBranchId !== own) return false;
        if (status === 'open') return OPEN_STATUSES.includes(t.status);
        return status === 'all' || t.status === status;
      })
      .filter((t) => priority === null || t.priority === priority)
      .filter((t) => inDateRange(t.requestDate, from, to))
      .filter((t) => origin === null || t.originBranchId === origin)
      .filter((t) => destination === null || t.destinationBranchId === destination)
      .filter((t) => product === null || t.lines.some((l) => l.productName === product))
      .filter((t) => !needle || normalizeText(`${t.id} ${name(t.originBranchId)} ${name(t.destinationBranchId)} ${t.lines.map((l) => l.productName).join(' ')}`).includes(needle))
      .map((t) => {
        const actions = transferActions(t, this.actor());
        return {
          ...t,
          route: `${name(t.originBranchId)} → ${name(t.destinationBranchId)}`,
          statusLabel: STATUS_INFO[t.status].label,
          priorityLabel: PRIORITY_INFO[t.priority].label,
          freightLabel: FREIGHT_INFO[t.freightStatus].label,
          products: this.productsLabel(t),
          // Le toca a quien mira: hay un paso que solo él puede dar.
          needsMe: actions.approve || actions.prepare || actions.dispatch || actions.receive || actions.resolve,
        };
      })
      .filter((r) => !this.onlyMine() || r.needsMe);
  });

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
    if (this.productFilter() !== null) list.push({ id: 'product', label: 'Producto', text: this.productFilter()! });
    if (this.onlyMine()) list.push({ id: 'onlyMine', label: 'Solo los que', text: 'esperan mi acción' });
    if (this.search().trim()) list.push({ id: 'search', label: 'Búsqueda', text: this.search().trim() });
    return list;
  });

  protected readonly selected = computed(() => this.transfers().find((t) => t.id === this.selectedId()) ?? null);

  protected readonly pending = computed(() => this.rows().filter((r) => r.needsMe).length);

  /** Lo que se le debe a los transportistas en los traslados visibles. */
  protected readonly freightOwed = computed(() => {
    const owed = this.transfers().filter((t) => t.freightBalance > 0);
    return { total: owed.reduce((sum, t) => sum + t.freightBalance, 0), count: owed.length };
  });
  protected readonly formatMoney = formatMoney;

  protected readonly summary = computed(() => {
    const open = this.transfers().filter((t) => OPEN_STATUSES.includes(t.status)).length;
    return open === 1 ? '1 traslado en curso' : `${open} traslados en curso`;
  });

  constructor() {
    void this.load();
    // Los nombres de sucursal y de producto adornan la tabla y el formulario: si fallan, se muestran los códigos.
    forkJoin({
      branches: this.branchApi.list().pipe(catchError(() => of([]))),
      products: this.catalog.products().pipe(catchError(() => of([]))),
    }).subscribe(({ branches, products }) => {
      this.branches.set(branches);
      this.products.set(products);
    });
  }

  protected async load(silent = false): Promise<void> {
    if (!silent) this.loading.set(true);
    this.error.set(null);
    try {
      this.transfers.set(await firstValueFrom(this.api.list()));
    } catch (error) {
      this.error.set(toApiError(error).message);
    } finally {
      this.loading.set(false);
    }
  }

  protected openDetail(row: TransferRow): void {
    this.selectedId.set(row.id);
    this.detailOpen.set(true);
  }

  protected statusVariant(row: TransferRow): BadgeVariant {
    return STATUS_INFO[row.status].variant;
  }

  protected priorityVariant(row: TransferRow): BadgeVariant {
    return PRIORITY_INFO[row.priority].variant;
  }

  protected onSearch(event: Event): void {
    this.search.set((event.target as HTMLInputElement).value);
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
      case 'search': this.search.set(''); break;
    }
  }

  protected clearFilters(): void {
    for (const filter of this.activeFilters()) this.removeFilter(filter.id);
  }

  private productsLabel(transfer: Transfer): string {
    const [first] = transfer.lines;
    if (!first) return '—';
    const others = transfer.lines.length - 1;
    return others > 0 ? `${first.productName} +${others}` : first.productName;
  }

  protected freightVariant(row: TransferRow): BadgeVariant {
    return FREIGHT_INFO[row.freightStatus].variant;
  }
}
