import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { catchError, firstValueFrom, forkJoin, of } from 'rxjs';
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
} from '@lucide/angular';
import { toApiError } from '@core/api/api-error';
import { type BranchOption, BranchOptionsApi } from '@core/branches/branch-options-api';
import { CatalogOptionsApi, type ProductOption } from '@core/catalog/catalog-options-api';
import { type UserName, UserOptionsApi } from '@core/users/user-options-api';
import { formatDateTime, formatQuantity, normalizeText } from '@shared/format/format';
import { Badge } from '@shared/ui/badge/badge';
import { Button } from '@shared/ui/button/button';
import { DataTable, DataTableCell, type TableColumn } from '@shared/ui/data-table/data-table';
import { DatePicker } from '@shared/ui/date-picker/date-picker';
import { FormField, InputDirective } from '@shared/ui/form-field/form-field';
import { Select, type SelectOption } from '@shared/ui/select/select';
import { Tooltip } from '@shared/ui/tooltip/tooltip';
import { AuditDetailModal, type AuditRow } from '../../components/audit-detail-modal/audit-detail-modal';
import { MOVEMENT_REASONS, type AuditMovement, AuditApi, type MovementReason, type MovementType } from '../../data-access/audit-api';
import { REASON_INFO, documentLabel, subReasonText } from '../../data-access/audit-labels';

const rowKey = (row: AuditRow): number => row.id;
const endOfDay = (date: Date): Date => new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999);

@Component({
  selector: 'app-audit-page',
  imports: [DataTable, DataTableCell, Badge, Button, DatePicker, FormField, InputDirective, Select, Tooltip, AuditDetailModal, LucideEye, LucideSearch],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block p-(--page-padding)' },
  templateUrl: './audit-page.html',
})
export class AuditPage {
  private readonly api = inject(AuditApi);
  private readonly branchApi = inject(BranchOptionsApi);
  private readonly catalog = inject(CatalogOptionsApi);
  private readonly userApi = inject(UserOptionsApi);

  protected readonly rowKey = rowKey;
  protected readonly storeIcon = LucideStore.icon;
  protected readonly tagIcon = LucideTag.icon;
  protected readonly typeIcon = LucideArrowUpDown.icon;
  protected readonly formatQuantity = formatQuantity;
  protected readonly reasonInfo = REASON_INFO;

  protected readonly movements = signal<readonly AuditMovement[]>([]);
  protected readonly branches = signal<readonly BranchOption[]>([]);
  protected readonly products = signal<readonly ProductOption[]>([]);
  protected readonly users = signal<readonly UserName[]>([]);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);

  protected readonly search = signal('');
  protected readonly branchFilter = signal<number | null>(null);
  protected readonly typeFilter = signal<MovementType | null>(null);
  protected readonly reasonFilter = signal<MovementReason | null>(null);
  protected readonly from = signal<Date | null>(null);
  protected readonly to = signal<Date | null>(null);

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

  private readonly branchNames = computed(() => new Map(this.branches().map((b) => [b.id, b.nombre])));
  private readonly productNames = computed(() => new Map(this.products().map((p) => [p.id, p.nombre])));
  private readonly userNames = computed(() => new Map(this.users().map((u) => [u.id, u.nombre])));

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
    { key: 'date', header: 'Fecha', icon: LucideCalendar.icon, sortable: true, width: '11.5rem', value: (r) => r.date, display: (r) => formatDateTime(r.date) },
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

  /** Todos los movimientos con sus nombres, antes de filtrar (de ahí salen los filtros y el CSV). */
  private readonly all = computed<AuditRow[]>(() => {
    const branches = this.branchNames();
    const products = this.productNames();
    const users = this.userNames();
    return this.movements().map((m) => ({
      ...m,
      product: products.get(m.productId) ?? `Producto ${m.productId}`,
      branch: branches.get(m.branchId) ?? `Sede ${m.branchId}`,
      responsible: m.userId === null ? 'Sistema' : (users.get(m.userId) ?? `Usuario ${m.userId}`),
      document: documentLabel(m.referenceType, m.referenceId),
      reasonLabel: REASON_INFO[m.reason].label,
      typeLabel: m.type === 'INGRESO' ? 'Ingreso' : 'Retiro',
      signedQuantity: m.type === 'INGRESO' ? m.quantity : -m.quantity,
    }));
  });

  protected readonly rows = computed<AuditRow[]>(() => {
    const needle = normalizeText(this.search().trim());
    const branch = this.branchFilter();
    const type = this.typeFilter();
    const reason = this.reasonFilter();
    const from = this.from();
    const to = this.to();
    return this.all().filter((r) => {
      if (branch !== null && r.branchId !== branch) return false;
      if (type !== null && r.type !== type) return false;
      if (reason !== null && r.reason !== reason) return false;
      if (from !== null && r.date < from) return false;
      if (to !== null && r.date > endOfDay(to)) return false;
      return !needle || normalizeText(`${r.product} ${r.responsible} ${r.document} ${r.reasonLabel} ${r.observations} ${r.id}`).includes(needle);
    });
  });

  protected readonly filtered = computed(() => this.rows().length !== this.all().length);

  protected readonly summary = computed(() => {
    const rows = this.rows();
    const ins = rows.filter((r) => r.type === 'INGRESO').reduce((sum, r) => sum + r.quantity, 0);
    const outs = rows.filter((r) => r.type === 'RETIRO').reduce((sum, r) => sum + r.quantity, 0);
    const count = rows.length === 1 ? '1 movimiento' : `${rows.length} movimientos`;
    return `${count}: entraron ${formatQuantity(ins)} unidades y salieron ${formatQuantity(outs)}`;
  });

  protected readonly selected = computed(() => this.all().find((r) => r.id === this.selectedId()) ?? null);

  constructor() {
    void this.load();
    // Los nombres adornan la tabla: si alguno no llega (p. ej. los usuarios), se muestran los códigos.
    forkJoin({
      branches: this.branchApi.list().pipe(catchError(() => of([]))),
      products: this.catalog.products().pipe(catchError(() => of([]))),
      users: this.userApi.names().pipe(catchError(() => of([]))),
    }).subscribe(({ branches, products, users }) => {
      this.branches.set(branches);
      this.products.set(products);
      this.users.set(users);
    });
  }

  protected async load(silent = false): Promise<void> {
    if (!silent) this.loading.set(true);
    this.error.set(null);
    try {
      this.movements.set(await firstValueFrom(this.api.movements()));
    } catch (error) {
      this.error.set(toApiError(error).message);
    } finally {
      this.loading.set(false);
    }
  }

  protected onSearch(event: Event): void {
    this.search.set((event.target as HTMLInputElement).value);
  }

  protected clearFilters(): void {
    this.search.set('');
    this.branchFilter.set(null);
    this.typeFilter.set(null);
    this.reasonFilter.set(null);
    this.from.set(null);
    this.to.set(null);
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
