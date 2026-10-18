import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { catchError, firstValueFrom, forkJoin, of } from 'rxjs';
import {
  LucideCalendar,
  LucideCircleCheck,
  LucideEllipsis,
  LucideFlag,
  LucideMessageSquareText,
  LucidePackage,
  LucideReceiptText,
  LucideScanSearch,
  LucideSearch,
  LucideShoppingBag,
  LucideShuffle,
  LucideStore,
  LucideTag,
  LucideTriangleAlert,
  LucideUndo2,
  type LucideIconData,
} from '@lucide/angular';
import { toApiError } from '@core/api/api-error';
import { AlertCount } from '@core/alerts/alert-count';
import { AuthStore } from '@core/auth/session/auth-store';
import { type BranchOption, BranchOptionsApi } from '@core/branches/branch-options-api';
import { CatalogOptionsApi } from '@core/catalog/catalog-options-api';
import { NotificationService } from '@core/notifications/notification.service';
import { formatDateTime, normalizeText } from '@shared/format/format';
import { inDateRange, optionsFrom } from '@shared/filters/filter-helpers';
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
import { AlertResolutionModal } from '../../components/alert-resolution-modal/alert-resolution-modal';
import { ALERT_TYPES, type AlertType, AlertsApi, type StockAlert } from '../../data-access/alerts-api';

interface TypeInfo {
  readonly label: string;
  readonly variant: BadgeVariant;
  readonly icon: LucideIconData;
}

const TYPES: Readonly<Record<AlertType, TypeInfo>> = {
  LOW_STOCK: { label: 'Stock bajo', variant: 'warning', icon: LucideTriangleAlert.icon },
  TRANSFER_REQUEST: { label: 'Traslado', variant: 'info', icon: LucideShuffle.icon },
  RETURN_REQUEST: { label: 'Devolución', variant: 'info', icon: LucideUndo2.icon },
  PURCHASE_REQUEST: { label: 'Compra sugerida', variant: 'warning', icon: LucideShoppingBag.icon },
  ISSUE_REPORTED: { label: 'Incidencia', variant: 'danger', icon: LucideFlag.icon },
  VOID_SALE: { label: 'Venta anulada', variant: 'neutral', icon: LucideReceiptText.icon },
};

/** Fila de la tabla: la alerta con los nombres que muestra (producto y sucursal). */
interface AlertRow extends StockAlert {
  readonly product: string;
  readonly branch: string;
  readonly typeLabel: string;
}

const rowKey = (row: AlertRow): number => row.id;

const DAY = new Intl.DateTimeFormat('es-CO', { dateStyle: 'medium' });

@Component({
  selector: 'app-alerts-page',
  imports: [DataTable, DataTableCell, Badge, Button, DatePicker, ActiveFilters, AdvancedFilters, FormField, InputDirective, Select, Tooltip, AlertResolutionModal, LucideCircleCheck, LucideScanSearch, LucideSearch],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block p-(--page-padding)' },
  templateUrl: './alerts-page.html',
})
export class AlertsPage {
  private readonly api = inject(AlertsApi);
  private readonly branchApi = inject(BranchOptionsApi);
  private readonly catalog = inject(CatalogOptionsApi);
  private readonly notifications = inject(NotificationService);
  private readonly alertCount = inject(AlertCount);
  private readonly role = inject(AuthStore).role;

  protected readonly rowKey = rowKey;
  protected readonly formatDateTime = formatDateTime;
  protected readonly storeIcon = LucideStore.icon;
  protected readonly tagIcon = LucideTag.icon;
  protected readonly checkIcon = LucideCircleCheck.icon;

  protected readonly isAdmin = computed(() => this.role() === 'ADMIN');
  /** Descartar y marcar como resuelta son de ADMIN y MANAGER; el operador de inventario solo pide traslados y compras. */
  protected readonly canDismiss = computed(() => this.role() === 'ADMIN' || this.role() === 'MANAGER');

  protected readonly alerts = signal<readonly StockAlert[]>([]);
  protected readonly branches = signal<readonly BranchOption[]>([]);
  private readonly productNames = signal<ReadonlyMap<number, string>>(new Map());
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);

  // Los filtros se recuerdan por persona (la búsqueda de texto no: se escribe cada vez).
  private static readonly SCREEN = 'alerts';
  protected readonly search = signal('');
  protected readonly branchFilter = persistedFilter(AlertsPage.SCREEN, 'branch', null as number | null, codecs.nullable(codecs.number()));
  protected readonly typeFilter = persistedFilter(AlertsPage.SCREEN, 'type', null as AlertType | null, codecs.nullable(codecs.oneOf(ALERT_TYPES)));
  protected readonly from = persistedFilter(AlertsPage.SCREEN, 'from', null as Date | null, codecs.nullable(codecs.date()));
  protected readonly to = persistedFilter(AlertsPage.SCREEN, 'to', null as Date | null, codecs.nullable(codecs.date()));
  protected readonly productFilter = persistedFilter(AlertsPage.SCREEN, 'product', null as string | null, codecs.nullable(codecs.text()));
  protected readonly advancedOpen = persistedFilter(AlertsPage.SCREEN, 'advancedOpen', false, codecs.bool());

  protected readonly scanning = signal(false);

  protected readonly resolveOpen = signal(false);
  protected readonly resolving = signal<StockAlert | null>(null);

  protected readonly columns = computed<readonly TableColumn<AlertRow>[]>(() => [
    { key: 'typeLabel', header: 'Tipo', icon: LucideTag.icon, sortable: true },
    { key: 'product', header: 'Producto', icon: LucidePackage.icon, sortable: true, primary: true },
    ...(this.isAdmin() ? [{ key: 'branch', header: 'Sucursal', icon: LucideStore.icon, sortable: true }] : []),
    { key: 'message', header: 'Detalle', icon: LucideMessageSquareText.icon },
    { key: 'date', header: 'Fecha', icon: LucideCalendar.icon, sortable: true, width: '11.5rem', value: (r: AlertRow) => r.date, display: (r: AlertRow) => formatDateTime(r.date) },
    { key: 'acciones', header: 'Acciones', icon: LucideEllipsis.icon, align: 'end' },
  ]);

  protected readonly rows = computed<AlertRow[]>(() => {
    const branches = new Map(this.branches().map((b) => [b.id, b.nombre]));
    const type = this.typeFilter();
    const { from, to, product } = { from: this.from(), to: this.to(), product: this.productFilter() };
    const needle = normalizeText(this.search().trim());
    return this.alerts()
      .map((a) => ({
        ...a,
        product: this.productNames().get(a.productId) ?? `Producto ${a.productId}`,
        branch: branches.get(a.branchId) ?? `Sede ${a.branchId}`,
        typeLabel: TYPES[a.type].label,
      }))
      .filter((a) => type === null || a.type === type)
      .filter((a) => inDateRange(a.date, from, to))
      .filter((a) => product === null || a.product === product)
      .filter((a) => !needle || normalizeText(`${a.product} ${a.message} ${a.typeLabel}`).includes(needle));
  });

  protected readonly productOptions = computed(() => optionsFrom(this.alerts().map((a) => this.productNames().get(a.productId) ?? `Producto ${a.productId}`), this.productFilter(), 'Todos los productos'));

  /** Los filtros del panel «Más filtros» que están aplicados (el botón muestra cuántos). */
  protected readonly advancedCount = computed(() => (this.productFilter() !== null ? 1 : 0));

  /** Todos los filtros aplicados, para mostrarlos como etiquetas que se quitan. */
  protected readonly activeFilters = computed<ActiveFilter[]>(() => {
    const list: ActiveFilter[] = [];
    const branch = this.branchFilter();
    if (this.isAdmin() && branch !== null) list.push({ id: 'branch', label: 'Sucursal', text: this.branches().find((b) => b.id === branch)?.nombre ?? `Sede ${branch}` });
    if (this.typeFilter() !== null) list.push({ id: 'type', label: 'Tipo', text: TYPES[this.typeFilter()!].label });
    if (this.from() !== null) list.push({ id: 'from', label: 'Desde', text: DAY.format(this.from()!) });
    if (this.to() !== null) list.push({ id: 'to', label: 'Hasta', text: DAY.format(this.to()!) });
    if (this.productFilter() !== null) list.push({ id: 'product', label: 'Producto', text: this.productFilter()! });
    if (this.search().trim()) list.push({ id: 'search', label: 'Búsqueda', text: this.search().trim() });
    return list;
  });

  protected readonly summary = computed(() => {
    const total = this.alerts().length;
    return total === 1 ? '1 alerta activa' : `${total} alertas activas`;
  });

  protected readonly branchOptions = computed<SelectOption<number | null>[]>(() => [
    { value: null, label: 'Todas las sucursales' },
    ...this.branches().map((b) => ({ value: b.id, label: b.nombre })),
  ]);

  /** Solo los tipos que hay en la lista, para no ofrecer filtros vacíos. */
  protected readonly typeOptions = computed<SelectOption<AlertType | null>[]>(() => {
    const present = new Set(this.alerts().map((a) => a.type));
    return [
      { value: null, label: 'Todos los tipos' },
      ...ALERT_TYPES.filter((t) => present.has(t) || t === this.typeFilter()).map((t) => ({ value: t, label: TYPES[t].label, icon: TYPES[t].icon })),
    ];
  });

  protected readonly resolvingName = computed(() => {
    const alert = this.resolving();
    return alert ? (this.productNames().get(alert.productId) ?? '') : '';
  });

  constructor() {
    void this.load();
    // Los nombres de producto y sucursal solo adornan la tabla: si fallan, se muestran los códigos.
    forkJoin({
      products: this.catalog.products().pipe(catchError(() => of([]))),
      branches: this.branchApi.list().pipe(catchError(() => of([]))),
    }).subscribe(({ products, branches }) => {
      this.productNames.set(new Map(products.map((p) => [p.id, p.nombre])));
      this.branches.set(branches);
    });
  }

  /** Solo la última petición manda: al cambiar de sucursal rápido, la respuesta de la anterior no debe pisar la lista. */
  private loadId = 0;

  protected async load(silent = false): Promise<void> {
    const id = ++this.loadId;
    if (!silent) this.loading.set(true);
    this.error.set(null);
    try {
      const alerts = await firstValueFrom(this.api.list(this.isAdmin() ? this.branchFilter() : null));
      if (id !== this.loadId) return;
      this.alerts.set(alerts);
      // La insignia del menú cuenta todas las alertas, no solo las de la sucursal filtrada: se le pide el dato aparte.
      if (silent) this.alertCount.refresh();
    } catch (error) {
      if (id === this.loadId) this.error.set(toApiError(error).message);
    } finally {
      if (id === this.loadId) this.loading.set(false);
    }
  }

  protected onSearch(event: Event): void {
    this.search.set((event.target as HTMLInputElement).value);
  }

  protected removeFilter(id: string): void {
    switch (id) {
      case 'branch': this.setBranch(null); break;
      case 'type': this.typeFilter.set(null); break;
      case 'from': this.from.set(null); break;
      case 'to': this.to.set(null); break;
      case 'product': this.productFilter.set(null); break;
      case 'search': this.search.set(''); break;
    }
  }

  protected clearFilters(): void {
    for (const filter of this.activeFilters()) this.removeFilter(filter.id);
  }

  protected setBranch(branchId: number | null): void {
    this.branchFilter.set(branchId);
    void this.load();
  }

  protected variantOf(alert: StockAlert): BadgeVariant {
    return TYPES[alert.type].variant;
  }

  protected canResolve(alert: StockAlert): boolean {
    // El operador solo atiende alertas de stock (traslado o compra); lo demás es de gerencia.
    return this.canDismiss() || alert.type === 'LOW_STOCK' || alert.type === 'PURCHASE_REQUEST';
  }

  protected openResolve(alert: StockAlert): void {
    this.resolving.set(alert);
    this.resolveOpen.set(true);
  }

  protected async scan(): Promise<void> {
    if (this.scanning()) return;
    this.scanning.set(true);
    try {
      await firstValueFrom(this.api.scan());
      this.notifications.success('Revisión de stock completada.');
      await this.load(true);
    } catch (error) {
      this.notifications.error(toApiError(error).message);
    } finally {
      this.scanning.set(false);
    }
  }
}
