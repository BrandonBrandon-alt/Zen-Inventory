import { ChangeDetectionStrategy, Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { catchError, of } from 'rxjs';
import { type BranchOption, BranchOptionsApi } from '@core/branches/branch-options-api';
import { AuthStore } from '@core/auth/session/auth-store';
import { formatMoney, formatMoneyCompact, formatQuantity, formatShortDate } from '@shared/format/format';
import { Loadable } from '@shared/state/loadable';
import { Alert } from '@shared/ui/alert/alert';
import { UserAvatar } from '@shared/ui/avatar/user-avatar';
import { Button } from '@shared/ui/button/button';
import { Badge, type BadgeVariant } from '@shared/ui/badge/badge';
import { Card } from '@shared/ui/card/card';
import { AreaChart } from '@shared/ui/charts/area-chart';
import { ChartSkeleton } from '@shared/ui/charts/chart-skeleton';
import { BarList } from '@shared/ui/charts/bar-list';
import { ColumnChart } from '@shared/ui/charts/column-chart';
import { EmptyState } from '@shared/ui/empty-state/empty-state';
import { Segmented, type SegmentedOption } from '@shared/ui/segmented/segmented';
import { Spinner } from '@shared/ui/spinner/spinner';
import { AlertResolutionModal } from '@shared/ui/alert-resolution-modal/alert-resolution-modal';
import { AlertsApi, type StockAlert } from '@core/alerts/alerts-api';
import { DashboardApi, type Range, type ReplenishmentPriority } from '../../data-access/dashboard-api';

const RANGES: readonly SegmentedOption<Range>[] = [
  { value: 'today', label: 'Hoy' },
  { value: 'week', label: '7 días' },
  { value: 'month', label: 'Este mes' },
];

const PRIORITY: Readonly<Record<ReplenishmentPriority, { label: string; variant: BadgeVariant }>> = {
  HIGH: { label: 'Urgente', variant: 'danger' },
  MEDIUM: { label: 'Pronto', variant: 'warning' },
  LOW: { label: 'Con tiempo', variant: 'neutral' },
};

const TRANSFER_STATUS: Readonly<Record<string, string>> = {
  PENDING: 'Pendiente',
  APPROVED_DEST: 'Aprobado',
  PREPARING: 'En preparación',
  IN_TRANSIT: 'En camino',
};

const MAX_ATTENTION_ITEMS = 6;

function greeting(hour: number): string {
  if (hour < 12) return 'Buenos días';
  if (hour < 19) return 'Buenas tardes';
  return 'Buenas noches';
}

const plural = (n: number, one: string, many: string): string => `${n} ${n === 1 ? one : many}`;

@Component({
  selector: 'app-dashboard-page',
  imports: [ChartSkeleton, Alert, AlertResolutionModal, Button, UserAvatar, Badge, Card, AreaChart, BarList, ColumnChart, EmptyState, Segmented, Spinner],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block p-(--page-padding)' },
  templateUrl: './dashboard-page.html',
})
export class DashboardPage {
  private readonly api = inject(DashboardApi);
  private readonly branchApi = inject(BranchOptionsApi);
  private readonly alertsApi = inject(AlertsApi);
  protected readonly auth = inject(AuthStore);

  protected readonly ranges = RANGES;
  protected readonly priority = PRIORITY;
  protected readonly transferStatus = TRANSFER_STATUS;
  protected readonly formatMoney = formatMoney;
  protected readonly formatMoneyCompact = formatMoneyCompact;
  protected readonly formatQuantity = formatQuantity;
  protected readonly formatShortDate = formatShortDate;
  protected readonly maxItems = MAX_ATTENTION_ITEMS;

  protected readonly range = signal<Range>('week');

  protected readonly overview = new Loadable<import('../../data-access/dashboard-api').Overview>();
  protected readonly monthly = new Loadable<import('../../data-access/dashboard-api').MonthlySales[]>();
  protected readonly replenishment = new Loadable<import('../../data-access/dashboard-api').Replenishment[]>();
  protected readonly rotation = new Loadable<import('../../data-access/dashboard-api').Rotation[]>();
  protected readonly alerts = new Loadable<import('../../data-access/dashboard-api').OpenAlert[]>();
  protected readonly transfers = new Loadable<import('../../data-access/dashboard-api').TransferInProgress[]>();
  private readonly branchNames = signal<ReadonlyMap<number, string>>(new Map());
  protected readonly branchOptions = signal<readonly BranchOption[]>([]);
  /** Alertas abiertas: la de cada producto por reponer es la que se atiende desde «Por atender». */
  private readonly openAlerts = signal<readonly StockAlert[]>([]);
  protected readonly resolveOpen = signal(false);
  protected readonly resolving = signal<StockAlert | null>(null);
  protected readonly resolvingName = signal('');

  private readonly role = this.auth.role;
  /** El vendedor no tiene acceso a la analítica: ve solo el saludo. */
  protected readonly hasAnalytics = computed(() => this.role() !== null && this.role() !== 'SELLER');
  /** Ingresos y valoración son datos financieros: no los ve el operador de inventario. */
  protected readonly canSeeMoney = computed(() => this.role() === 'ADMIN' || this.role() === 'MANAGER');
  protected readonly isAdmin = computed(() => this.role() === 'ADMIN');
  /** Descartar una alerta es de ADMIN y MANAGER; pedir traslado o comprar también lo puede el operador. */
  protected readonly canDismiss = computed(() => this.role() === 'ADMIN' || this.role() === 'MANAGER');

  protected readonly hello = computed(() => {
    const name = this.auth.session()?.nombre.trim().replace(/\s+/g, ' ');
    return `${greeting(new Date().getHours())}${name ? `, ${name}` : ''}`;
  });

  protected readonly digest = computed(() => {
    const replenishment = this.replenishment.data();
    const transfers = this.transfers.data();
    if (replenishment === null && transfers === null) return null;
    const parts: string[] = [];
    if (replenishment && replenishment.length > 0) parts.push(`${plural(replenishment.length, 'producto por reponer', 'productos por reponer')}`);
    if (transfers && transfers.length > 0) parts.push(`${plural(transfers.length, 'traslado en curso', 'traslados en curso')}`);
    return parts.length > 0 ? `Hay ${parts.join(' y ')}.` : 'Todo en orden: no hay nada pendiente.';
  });

  protected readonly trendPoints = computed(() =>
    (this.overview.data()?.trend ?? []).map((p) => ({ label: formatShortDate(p.date), value: p.revenue })),
  );
  protected readonly topProducts = computed(() =>
    (this.overview.data()?.topProducts ?? []).slice(0, 5).map((p) => ({ label: p.name, value: p.value })),
  );
  protected readonly branchBars = computed(() =>
    (this.overview.data()?.branches ?? []).map((b) => ({ label: b.name, value: b.revenue, note: plural(b.sales, 'venta', 'ventas') })),
  );
  protected readonly monthColumns = computed(() =>
    (this.monthly.data() ?? []).slice(-6).map((m) => {
      const short = m.month.slice(0, 3);
      return { label: short, value: m.revenue, title: `${m.month} ${m.year}: ${formatMoney(m.revenue)}` };
    }),
  );
  /** Productos por atender, cada uno con su alerta de stock abierta (si ya la hay) para gestionarlo desde aquí. */
  protected readonly attention = computed(() =>
    (this.replenishment.data() ?? []).slice(0, MAX_ATTENTION_ITEMS).map((item) => ({
      ...item,
      alert: this.openAlerts().find((a) => a.branchId === item.branchId && a.productId === item.productId && (a.type === 'LOW_STOCK' || a.type === 'PURCHASE_REQUEST')) ?? null,
    })),
  );
  protected readonly stagnant = computed(() => (this.rotation.data() ?? []).filter((r) => r.dead).slice(0, MAX_ATTENTION_ITEMS));
  protected readonly transferRows = computed(() =>
    (this.transfers.data() ?? []).slice(0, MAX_ATTENTION_ITEMS).map((t) => ({
      ...t,
      route: `${this.branchName(t.originBranchId)} → ${this.branchName(t.destinationBranchId)}`,
    })),
  );

  constructor() {
    effect(() => {
      if (!this.hasAnalytics()) return;
      const range = this.range();
      untracked(() => this.overview.load(this.api.overview(range)));
    });
    effect(() => {
      if (!this.hasAnalytics()) return;
      untracked(() => this.loadSecondary());
    });
  }

  protected branchName(id: number): string {
    return this.branchNames().get(id) ?? `Sede ${id}`;
  }

  protected manage(item: { name: string; alert: StockAlert | null }): void {
    if (!item.alert) return;
    this.resolving.set(item.alert);
    this.resolvingName.set(item.name);
    this.resolveOpen.set(true);
  }

  /** La alerta ya se resolvió (se pidió un traslado, se creó una compra o se descartó): se actualiza lo que depende de ella. */
  protected onResolved(): void {
    this.replenishment.load(this.api.replenishment());
    this.transfers.load(this.api.transfersInProgress());
    this.alerts.load(this.api.alerts());
    this.loadOpenAlerts();
  }

  protected retryOverview(): void {
    this.overview.load(this.api.overview(this.range()));
  }

  private loadSecondary(): void {
    this.replenishment.load(this.api.replenishment());
    this.transfers.load(this.api.transfersInProgress());
    this.alerts.load(this.api.alerts());
    this.rotation.load(this.api.rotation());
    if (this.canSeeMoney()) this.monthly.load(this.api.monthly());
    this.loadOpenAlerts();
    this.branchApi
      .list()
      .pipe(catchError(() => of([])))
      .subscribe((branches) => {
        this.branchOptions.set(branches);
        this.branchNames.set(new Map(branches.map((b) => [b.id, b.nombre])));
      });
  }

  private loadOpenAlerts(): void {
    this.alertsApi
      .list()
      .pipe(catchError(() => of([])))
      .subscribe((alerts) => this.openAlerts.set(alerts));
  }
}
