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
} from '@lucide/angular';
import { toApiError } from '@core/api/api-error';
import { AuthStore } from '@core/auth/session/auth-store';
import { type BranchOption, BranchOptionsApi } from '@core/branches/branch-options-api';
import { CatalogOptionsApi, type ProductOption } from '@core/catalog/catalog-options-api';
import { formatDateTime } from '@shared/format/format';
import { Badge, type BadgeVariant } from '@shared/ui/badge/badge';
import { Button } from '@shared/ui/button/button';
import { DataTable, DataTableCell, type TableColumn } from '@shared/ui/data-table/data-table';
import { Segmented, type SegmentedOption } from '@shared/ui/segmented/segmented';
import { Select, type SelectOption } from '@shared/ui/select/select';
import { Tooltip } from '@shared/ui/tooltip/tooltip';
import { TransferDetailModal } from '../../components/transfer-detail-modal/transfer-detail-modal';
import { TransferRequestModal } from '../../components/transfer-request-modal/transfer-request-modal';
import { OPEN_STATUSES, PRIORITY_INFO, STATUS_INFO } from '../../data-access/transfer-labels';
import { type Actor, transferActions } from '../../data-access/transfer-permissions';
import { type Transfer, TRANSFER_STATUSES, type TransferStatus, TransfersApi } from '../../data-access/transfers-api';

type Direction = 'all' | 'incoming' | 'outgoing';

/** Fila de la tabla: el traslado con los textos que se ordenan y se muestran. */
interface TransferRow extends Transfer {
  readonly route: string;
  readonly statusLabel: string;
  readonly priorityLabel: string;
  readonly products: string;
  readonly needsMe: boolean;
}

const rowKey = (row: TransferRow): number => row.id;

@Component({
  selector: 'app-transfers-page',
  imports: [
    DataTable,
    DataTableCell,
    Badge,
    Button,
    Segmented,
    Select,
    Tooltip,
    TransferDetailModal,
    TransferRequestModal,
    LucideEye,
    LucidePlus,
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

  protected readonly isAdmin = computed(() => this.role() === 'ADMIN');
  protected readonly ownBranchId = computed(() => this.session()?.sucursalId ?? null);
  protected readonly actor = computed<Actor>(() => ({ role: this.role(), branchId: this.ownBranchId() }));

  protected readonly transfers = signal<readonly Transfer[]>([]);
  protected readonly branches = signal<readonly BranchOption[]>([]);
  protected readonly products = signal<readonly ProductOption[]>([]);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);

  protected readonly direction = signal<Direction>('all');
  protected readonly statusFilter = signal<'open' | 'all' | TransferStatus>('open');

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

  private readonly branchNames = computed(() => new Map(this.branches().map((b) => [b.id, b.nombre])));
  protected readonly names = computed<ReadonlyMap<number, string>>(() => this.branchNames());

  protected readonly columns: readonly TableColumn<TransferRow>[] = [
    { key: 'id', header: 'N.º', icon: LucideHash.icon, sortable: true, width: '5rem', display: (r) => `#${r.id}` },
    { key: 'statusLabel', header: 'Estado', icon: LucideCircleCheck.icon, sortable: true },
    { key: 'route', header: 'Ruta', icon: LucideRoute.icon, sortable: true, primary: true },
    { key: 'products', header: 'Productos', icon: LucidePackage.icon },
    { key: 'priorityLabel', header: 'Prioridad', icon: LucideFlag.icon, sortable: true },
    { key: 'requestDate', header: 'Solicitado', icon: LucideCalendar.icon, sortable: true, width: '11.5rem', value: (r) => r.requestDate, display: (r) => formatDateTime(r.requestDate) },
    { key: 'acciones', header: 'Acciones', align: 'end' },
  ];

  protected readonly rows = computed<TransferRow[]>(() => {
    const own = this.ownBranchId();
    const direction = this.direction();
    const status = this.statusFilter();
    const names = this.branchNames();
    const name = (id: number) => names.get(id) ?? `Sede ${id}`;
    return this.transfers()
      .filter((t) => {
        if (direction === 'incoming' && t.destinationBranchId !== own) return false;
        if (direction === 'outgoing' && t.originBranchId !== own) return false;
        if (status === 'open') return OPEN_STATUSES.includes(t.status);
        return status === 'all' || t.status === status;
      })
      .map((t) => {
        const actions = transferActions(t, this.actor());
        return {
          ...t,
          route: `${name(t.originBranchId)} → ${name(t.destinationBranchId)}`,
          statusLabel: STATUS_INFO[t.status].label,
          priorityLabel: PRIORITY_INFO[t.priority].label,
          products: this.productsLabel(t),
          // Le toca a quien mira: hay un paso que solo él puede dar.
          needsMe: actions.approve || actions.prepare || actions.dispatch || actions.receive || actions.resolve,
        };
      });
  });

  protected readonly selected = computed(() => this.transfers().find((t) => t.id === this.selectedId()) ?? null);

  protected readonly pending = computed(() => this.rows().filter((r) => r.needsMe).length);

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

  private productsLabel(transfer: Transfer): string {
    const [first] = transfer.lines;
    if (!first) return '—';
    const others = transfer.lines.length - 1;
    return others > 0 ? `${first.productName} +${others}` : first.productName;
  }
}
