import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { catchError, firstValueFrom, forkJoin, of } from 'rxjs';
import {
  LucideCalendar,
  LucideCircleCheck,
  LucideEye,
  LucideHash,
  LucideListFilter,
  LucidePlus,
  LucideStore,
  LucideTruck,
  LucideWallet,
  LucideCoins,
} from '@lucide/angular';
import { toApiError } from '@core/api/api-error';
import { AuthStore } from '@core/auth/session/auth-store';
import { type BranchOption, BranchOptionsApi } from '@core/branches/branch-options-api';
import { CatalogOptionsApi, type ProductOption, type SupplierOption } from '@core/catalog/catalog-options-api';
import { formatDateTime, formatMoney } from '@shared/format/format';
import { Badge, type BadgeVariant } from '@shared/ui/badge/badge';
import { Button } from '@shared/ui/button/button';
import { DataTable, DataTableCell, type TableColumn } from '@shared/ui/data-table/data-table';
import { Select, type SelectOption } from '@shared/ui/select/select';
import { Tooltip } from '@shared/ui/tooltip/tooltip';
import { PurchaseDetailModal } from '../../components/purchase-detail-modal/purchase-detail-modal';
import { PurchaseFormModal } from '../../components/purchase-form-modal/purchase-form-modal';
import { OPEN_RECEPTIONS, PAYMENT_INFO, RECEPTION_INFO } from '../../data-access/purchase-labels';
import { purchaseActions } from '../../data-access/purchase-permissions';
import { type Purchase, PurchasesApi, RECEPTION_STATUSES, type ReceptionStatus } from '../../data-access/purchases-api';

/** Fila de la tabla: la orden con los textos que se muestran y se ordenan. */
interface PurchaseRow extends Purchase {
  readonly supplier: string;
  readonly branch: string;
  readonly receptionLabel: string;
  readonly paymentLabel: string;
  readonly needsMe: boolean;
}

const rowKey = (row: PurchaseRow): number => row.id;

@Component({
  selector: 'app-purchases-page',
  imports: [DataTable, DataTableCell, Badge, Button, Select, Tooltip, PurchaseDetailModal, PurchaseFormModal, LucideEye, LucidePlus],
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
  protected readonly role = this.auth.role;
  protected readonly isAdmin = computed(() => this.role() === 'ADMIN');

  protected readonly purchases = signal<readonly Purchase[]>([]);
  protected readonly suppliers = signal<readonly SupplierOption[]>([]);
  protected readonly products = signal<readonly ProductOption[]>([]);
  protected readonly branches = signal<readonly BranchOption[]>([]);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);

  protected readonly statusFilter = signal<'open' | 'all' | ReceptionStatus>('open');

  protected readonly formOpen = signal(false);
  protected readonly detailOpen = signal(false);
  protected readonly selectedId = signal<number | null>(null);

  protected readonly statusOptions: readonly SelectOption<'open' | 'all' | ReceptionStatus>[] = [
    { value: 'open', label: 'En curso' },
    { value: 'all', label: 'Todas' },
    ...RECEPTION_STATUSES.map((value) => ({ value, label: RECEPTION_INFO[value].label, icon: RECEPTION_INFO[value].icon })),
  ];

  private readonly supplierNames = computed(() => new Map(this.suppliers().map((s) => [s.id, s.nombre])));
  private readonly branchNames = computed(() => new Map(this.branches().map((b) => [b.id, b.nombre])));
  protected readonly productNames = computed<ReadonlyMap<number, string>>(() => new Map(this.products().map((p) => [p.id, p.nombre])));

  protected readonly columns = computed<readonly TableColumn<PurchaseRow>[]>(() => [
    { key: 'id', header: 'N.º', icon: LucideHash.icon, sortable: true, width: '5rem', display: (r) => `#${r.id}` },
    { key: 'receptionLabel', header: 'Estado', icon: LucideCircleCheck.icon, sortable: true },
    { key: 'supplier', header: 'Proveedor', icon: LucideTruck.icon, sortable: true, primary: true },
    ...(this.isAdmin() ? [{ key: 'branch', header: 'Sucursal', icon: LucideStore.icon, sortable: true }] : []),
    { key: 'total', header: 'Total', icon: LucideCoins.icon, sortable: true, align: 'end' as const, display: (r: PurchaseRow) => formatMoney(r.total) },
    { key: 'paymentLabel', header: 'Pago', icon: LucideWallet.icon, sortable: true },
    { key: 'requestDate', header: 'Solicitada', icon: LucideCalendar.icon, sortable: true, width: '11.5rem', value: (r: PurchaseRow) => r.requestDate, display: (r: PurchaseRow) => formatDateTime(r.requestDate) },
    { key: 'acciones', header: 'Acciones', align: 'end' as const },
  ]);

  protected readonly rows = computed<PurchaseRow[]>(() => {
    const status = this.statusFilter();
    const suppliers = this.supplierNames();
    const branches = this.branchNames();
    return this.purchases()
      .filter((p) => (status === 'open' ? OPEN_RECEPTIONS.includes(p.reception) : status === 'all' || p.reception === status))
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
      });
  });

  protected readonly selected = computed(() => this.purchases().find((p) => p.id === this.selectedId()) ?? null);
  protected readonly pending = computed(() => this.rows().filter((r) => r.needsMe).length);
  protected readonly selectedSupplier = computed(() => this.supplierNames().get(this.selected()?.supplierId ?? -1) ?? '');
  protected readonly selectedBranch = computed(() => (this.isAdmin() ? (this.branchNames().get(this.selected()?.branchId ?? -1) ?? '') : ''));

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
