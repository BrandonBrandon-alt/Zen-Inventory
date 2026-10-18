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
import { inDateRange, inNumberRange, numberFromInput, optionsFrom } from '@shared/filters/filter-helpers';
import { codecs, persistedFilter } from '@shared/filters/persisted-filter';
import { Badge } from '@shared/ui/badge/badge';
import { Button } from '@shared/ui/button/button';
import { DataTable, DataTableCell, type TableColumn } from '@shared/ui/data-table/data-table';
import { DatePicker } from '@shared/ui/date-picker/date-picker';
import { ActiveFilters, type ActiveFilter } from '@shared/ui/filters/active-filters';
import { AdvancedFilters } from '@shared/ui/filters/advanced-filters';
import { FormField, InputDirective } from '@shared/ui/form-field/form-field';
import { Select, type SelectOption } from '@shared/ui/select/select';
import { Tooltip } from '@shared/ui/tooltip/tooltip';
import { AuditDetailModal, type AuditRow } from '../../components/audit-detail-modal/audit-detail-modal';
import { MOVEMENT_REASONS, type AuditMovement, AuditApi, type MovementReason, type MovementType } from '../../data-access/audit-api';
import { REASON_INFO, documentLabel, subReasonText } from '../../data-access/audit-labels';

const rowKey = (row: AuditRow): number => row.id;
const DAY = new Intl.DateTimeFormat('es-CO', { dateStyle: 'medium' });

@Component({
  selector: 'app-audit-page',
  imports: [DataTable, DataTableCell, Badge, Button, DatePicker, ActiveFilters, AdvancedFilters, FormField, InputDirective, Select, Tooltip, AuditDetailModal, LucideEye, LucideSearch],
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

  // Los filtros se recuerdan por persona (la búsqueda de texto no: se escribe cada vez).
  private static readonly SCREEN = 'audit';
  protected readonly search = signal('');
  protected readonly branchFilter = persistedFilter(AuditPage.SCREEN, 'branch', null as number | null, codecs.nullable(codecs.number()));
  protected readonly typeFilter = persistedFilter(AuditPage.SCREEN, 'type', null as MovementType | null, codecs.nullable(codecs.oneOf(['INGRESO', 'RETIRO'] as const)));
  protected readonly reasonFilter = persistedFilter(AuditPage.SCREEN, 'reason', null as MovementReason | null, codecs.nullable(codecs.oneOf(MOVEMENT_REASONS)));
  protected readonly from = persistedFilter(AuditPage.SCREEN, 'from', null as Date | null, codecs.nullable(codecs.date()));
  protected readonly to = persistedFilter(AuditPage.SCREEN, 'to', null as Date | null, codecs.nullable(codecs.date()));
  protected readonly productFilter = persistedFilter(AuditPage.SCREEN, 'product', null as string | null, codecs.nullable(codecs.text()));
  protected readonly responsibleFilter = persistedFilter(AuditPage.SCREEN, 'responsible', null as string | null, codecs.nullable(codecs.text()));
  protected readonly minQuantity = persistedFilter(AuditPage.SCREEN, 'minQuantity', null as number | null, codecs.nullable(codecs.number()));
  protected readonly maxQuantity = persistedFilter(AuditPage.SCREEN, 'maxQuantity', null as number | null, codecs.nullable(codecs.number()));
  protected readonly onlyObserved = persistedFilter(AuditPage.SCREEN, 'onlyObserved', false, codecs.bool());
  protected readonly advancedOpen = persistedFilter(AuditPage.SCREEN, 'advancedOpen', false, codecs.bool());
  protected readonly numberFromInput = numberFromInput;

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
    const product = this.productFilter();
    const responsible = this.responsibleFilter();
    const minQuantity = this.minQuantity();
    const maxQuantity = this.maxQuantity();
    const onlyObserved = this.onlyObserved();
    return this.all().filter((r) => {
      if (branch !== null && r.branchId !== branch) return false;
      if (type !== null && r.type !== type) return false;
      if (reason !== null && r.reason !== reason) return false;
      if (!inDateRange(r.date, from, to)) return false;
      if (product !== null && r.product !== product) return false;
      if (responsible !== null && r.responsible !== responsible) return false;
      if (!inNumberRange(r.quantity, minQuantity, maxQuantity)) return false;
      if (onlyObserved && !r.observations) return false;
      return !needle || normalizeText(`${r.product} ${r.responsible} ${r.document} ${r.reasonLabel} ${r.observations} ${r.id}`).includes(needle);
    });
  });

  protected readonly productOptions = computed(() => optionsFrom(this.all().map((r) => r.product), this.productFilter(), 'Todos los productos'));
  protected readonly responsibleOptions = computed(() => optionsFrom(this.all().map((r) => r.responsible), this.responsibleFilter(), 'Todos los responsables'));

  /** Los filtros del panel «Más filtros» que están aplicados (el botón muestra cuántos). */
  protected readonly advancedCount = computed(
    () => [this.productFilter() !== null, this.responsibleFilter() !== null, this.minQuantity() !== null, this.maxQuantity() !== null, this.onlyObserved()].filter(Boolean).length,
  );

  /** Todos los filtros aplicados, para mostrarlos como etiquetas que se quitan. */
  protected readonly activeFilters = computed<ActiveFilter[]>(() => {
    const list: ActiveFilter[] = [];
    const branch = this.branchFilter();
    if (branch !== null) list.push({ id: 'branch', label: 'Sucursal', text: this.branchNames().get(branch) ?? `Sede ${branch}` });
    if (this.typeFilter() !== null) list.push({ id: 'type', label: 'Tipo', text: this.typeFilter() === 'INGRESO' ? 'Ingresos' : 'Retiros' });
    if (this.reasonFilter() !== null) list.push({ id: 'reason', label: 'Motivo', text: REASON_INFO[this.reasonFilter()!].label });
    if (this.from() !== null) list.push({ id: 'from', label: 'Desde', text: DAY.format(this.from()!) });
    if (this.to() !== null) list.push({ id: 'to', label: 'Hasta', text: DAY.format(this.to()!) });
    if (this.productFilter() !== null) list.push({ id: 'product', label: 'Producto', text: this.productFilter()! });
    if (this.responsibleFilter() !== null) list.push({ id: 'responsible', label: 'Responsable', text: this.responsibleFilter()! });
    if (this.minQuantity() !== null) list.push({ id: 'minQuantity', label: 'Cantidad desde', text: formatQuantity(this.minQuantity()) });
    if (this.maxQuantity() !== null) list.push({ id: 'maxQuantity', label: 'Cantidad hasta', text: formatQuantity(this.maxQuantity()) });
    if (this.onlyObserved()) list.push({ id: 'onlyObserved', label: 'Con', text: 'observaciones' });
    if (this.search().trim()) list.push({ id: 'search', label: 'Búsqueda', text: this.search().trim() });
    return list;
  });

  protected readonly filtered = computed(() => this.activeFilters().length > 0);

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
      case 'search': this.search.set(''); break;
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
