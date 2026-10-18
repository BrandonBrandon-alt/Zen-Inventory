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
import { formatDateTime } from '@shared/format/format';
import { Badge, type BadgeVariant } from '@shared/ui/badge/badge';
import { Button } from '@shared/ui/button/button';
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

@Component({
  selector: 'app-alerts-page',
  imports: [DataTable, DataTableCell, Badge, Button, Select, Tooltip, AlertResolutionModal, LucideCircleCheck, LucideScanSearch],
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

  protected readonly branchFilter = signal<number | null>(null);
  protected readonly typeFilter = signal<AlertType | null>(null);

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
    return this.alerts()
      .filter((a) => type === null || a.type === type)
      .map((a) => ({
        ...a,
        product: this.productNames().get(a.productId) ?? `Producto ${a.productId}`,
        branch: branches.get(a.branchId) ?? `Sede ${a.branchId}`,
        typeLabel: TYPES[a.type].label,
      }));
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

  protected async load(silent = false): Promise<void> {
    if (!silent) this.loading.set(true);
    this.error.set(null);
    try {
      this.alerts.set(await firstValueFrom(this.api.list(this.isAdmin() ? this.branchFilter() : null)));
      // La insignia del menú cuenta todas las alertas, no solo las de la sucursal filtrada: se le pide el dato aparte.
      if (silent) this.alertCount.refresh();
    } catch (error) {
      this.error.set(toApiError(error).message);
    } finally {
      this.loading.set(false);
    }
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
