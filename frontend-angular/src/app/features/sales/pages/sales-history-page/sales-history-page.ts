import { ChangeDetectionStrategy, Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { catchError, firstValueFrom, of } from 'rxjs';
import {
  LucideCalendar,
  LucideCircleCheck,
  LucideCoins,
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
import { formatDateTime, formatMoney } from '@shared/format/format';
import { Badge, type BadgeVariant } from '@shared/ui/badge/badge';
import { Button } from '@shared/ui/button/button';
import { DataTable, DataTableCell, type TableColumn } from '@shared/ui/data-table/data-table';
import { FormField, InputDirective } from '@shared/ui/form-field/form-field';
import { Select, type SelectOption } from '@shared/ui/select/select';
import { Tooltip } from '@shared/ui/tooltip/tooltip';
import { SaleDetailModal } from '../../components/sale-detail-modal/sale-detail-modal';
import { SALE_INFO, customerLabel } from '../../data-access/sale-labels';
import { SALE_STATUSES, type Sale, type SaleStatus, SalesApi } from '../../data-access/sales-api';

/** Fila de la tabla: la venta con los textos que se muestran y se ordenan. */
interface SaleRow extends Sale {
  readonly customer: string;
  readonly statusLabel: string;
}

const rowKey = (row: SaleRow): number => row.id;
const normalize = (text: string): string => text.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();

@Component({
  selector: 'app-sales-history-page',
  imports: [DataTable, DataTableCell, Badge, Button, FormField, InputDirective, Select, Tooltip, SaleDetailModal, LucideEye, LucideSearch],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block p-(--page-padding)' },
  templateUrl: './sales-history-page.html',
})
export class SalesHistoryPage {
  private readonly api = inject(SalesApi);
  private readonly branchApi = inject(BranchOptionsApi);
  private readonly auth = inject(AuthStore);

  protected readonly rowKey = rowKey;
  protected readonly storeIcon = LucideStore.icon;
  protected readonly filterIcon = LucideListFilter.icon;

  protected readonly isAdmin = computed(() => this.auth.role() === 'ADMIN');
  /** Anular una venta es de ADMIN y MANAGER. */
  protected readonly canCancel = computed(() => this.auth.role() === 'ADMIN' || this.auth.role() === 'MANAGER');

  protected readonly sales = signal<readonly Sale[]>([]);
  protected readonly branches = signal<readonly BranchOption[]>([]);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);

  protected readonly branchFilter = signal<number | null>(null);
  protected readonly statusFilter = signal<'all' | SaleStatus>('all');
  protected readonly search = signal('');

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

  protected readonly columns = computed<readonly TableColumn<SaleRow>[]>(() => [
    { key: 'id', header: 'N.º', icon: LucideHash.icon, sortable: true, width: '5rem', display: (r) => `#${r.id}` },
    { key: 'date', header: 'Fecha', icon: LucideCalendar.icon, sortable: true, width: '11.5rem', value: (r) => r.date, display: (r) => formatDateTime(r.date) },
    { key: 'customer', header: 'Cliente', icon: LucideUserRound.icon, sortable: true, primary: true },
    { key: 'seller', header: 'Vendedor', icon: LucideUser.icon, sortable: true },
    ...(this.isAdmin() ? [{ key: 'branchName', header: 'Sucursal', icon: LucideStore.icon, sortable: true }] : []),
    { key: 'total', header: 'Total', icon: LucideCoins.icon, sortable: true, align: 'end' as const, display: (r: SaleRow) => formatMoney(r.total) },
    { key: 'statusLabel', header: 'Estado', icon: LucideCircleCheck.icon, sortable: true },
    { key: 'acciones', header: 'Acciones', align: 'end' as const },
  ]);

  protected readonly rows = computed<SaleRow[]>(() => {
    const status = this.statusFilter();
    const needle = normalize(this.search().trim());
    return this.sales()
      .filter((s) => status === 'all' || s.status === status)
      .filter((s) => !needle || normalize(`${s.id} ${s.customerName} ${s.customerDocument} ${s.seller}`).includes(needle))
      .map((s) => ({ ...s, customer: customerLabel(s.customerName), statusLabel: SALE_INFO[s.status].label }));
  });

  protected readonly selected = computed(() => this.sales().find((s) => s.id === this.selectedId()) ?? null);

  protected readonly summary = computed(() => {
    const rows = this.rows().filter((r) => r.status === 'COMPLETED');
    const total = rows.reduce((sum, r) => sum + r.total, 0);
    return `${rows.length === 1 ? '1 venta completada' : `${rows.length} ventas completadas`}, ${formatMoney(total)}`;
  });

  constructor() {
    if (this.isAdmin()) {
      this.branchApi
        .list()
        .pipe(catchError(() => of([])))
        .subscribe((branches) => this.branches.set(branches));
    }
    // La sucursal elegida la filtra el servidor (solo el ADMIN puede elegir); cada cambio vuelve a pedir la lista.
    effect(() => {
      const branch = this.branchFilter();
      untracked(() => void this.load(false, branch));
    });
  }

  /** Solo la última petición manda: al cambiar de sucursal rápido, la respuesta de la anterior no debe pisar la lista. */
  private loadId = 0;

  protected async load(silent = false, branch = this.branchFilter()): Promise<void> {
    const id = ++this.loadId;
    if (!silent) this.loading.set(true);
    this.error.set(null);
    try {
      const sales = await firstValueFrom(this.api.list(this.isAdmin() ? branch : null));
      if (id === this.loadId) this.sales.set(sales);
    } catch (error) {
      if (id === this.loadId) this.error.set(toApiError(error).message);
    } finally {
      if (id === this.loadId) this.loading.set(false);
    }
  }

  protected onSearch(event: Event): void {
    this.search.set((event.target as HTMLInputElement).value);
  }

  protected openDetail(row: SaleRow): void {
    this.selectedId.set(row.id);
    this.detailOpen.set(true);
  }

  protected statusVariant(row: SaleRow): BadgeVariant {
    return SALE_INFO[row.status].variant;
  }
}
