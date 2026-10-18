import { ChangeDetectionStrategy, Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { LucideArrowDownToLine, LucideArrowUpDown, LucideBarcode, LucideCoins, LucideEllipsis, LucideLayers, LucidePackage, LucideRuler, LucideSearch, LucideSlidersHorizontal, LucideStore, LucideTag } from '@lucide/angular';
import { toApiError } from '@core/api/api-error';
import { type BranchOption, BranchOptionsApi } from '@core/branches/branch-options-api';
import { AuthStore } from '@core/auth/session/auth-store';
import { formatMoney, formatQuantity } from '@shared/format/format';
import { Badge } from '@shared/ui/badge/badge';
import { Button } from '@shared/ui/button/button';
import { DataTable, DataTableCell, type TableColumn } from '@shared/ui/data-table/data-table';
import { FormField, InputDirective } from '@shared/ui/form-field/form-field';
import { Select, type SelectOption } from '@shared/ui/select/select';
import { type TabItem, Tabs } from '@shared/ui/tabs/tabs';
import { Tooltip } from '@shared/ui/tooltip/tooltip';
import { AdjustStockModal } from '../../components/adjust-stock-modal/adjust-stock-modal';
import { KardexPanel } from '../../components/kardex-panel/kardex-panel';
import { MinimumStockModal } from '../../components/minimum-stock-modal/minimum-stock-modal';
import { type InventoryItem, InventoryApi, type StockLevel, stockLevel } from '../../data-access/inventory-api';

/** Producto con su nivel de stock ya calculado (para ordenar y mostrar). */
interface InventoryRow extends InventoryItem {
  readonly level: StockLevel;
}

const BASE_COLUMNS: readonly TableColumn<InventoryRow>[] = [
  { key: 'sku', header: 'SKU', icon: LucideBarcode.icon, sortable: true },
  { key: 'nombre', header: 'Producto', icon: LucidePackage.icon, sortable: true, primary: true },
  { key: 'unit', header: 'Unidad', icon: LucideRuler.icon },
  { key: 'stock', header: 'Existencias', icon: LucideLayers.icon, sortable: true, align: 'end' },
  { key: 'minimum', header: 'Mínimo', icon: LucideArrowDownToLine.icon, sortable: true, align: 'end', display: (r) => formatQuantity(r.minimum) },
];
const COST_COLUMNS: readonly TableColumn<InventoryRow>[] = [
  { key: 'cost', header: 'Costo prom.', icon: LucideCoins.icon, sortable: true, align: 'end', display: (r) => formatMoney(r.cost) },
  { key: 'price', header: 'Precio venta', icon: LucideTag.icon, sortable: true, align: 'end', display: (r) => formatMoney(r.price) },
];
const ACTIONS_COLUMN: TableColumn<InventoryRow> = { key: 'acciones', header: 'Acciones', icon: LucideEllipsis.icon, align: 'end' };

const TABS: readonly TabItem[] = [
  { id: 'stock', label: 'Existencias' },
  { id: 'kardex', label: 'Kardex' },
];

const rowKey = (row: InventoryRow): number => row.productId;

/** Minúsculas y sin acentos: "tuerca" encuentra "Tuérca". */
const normalize = (text: string): string => text.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();

@Component({
  selector: 'app-inventory-page',
  imports: [
    DataTable,
    DataTableCell,
    Badge,
    Button,
    FormField,
    InputDirective,
    Select,
    Tabs,
    Tooltip,
    AdjustStockModal,
    MinimumStockModal,
    KardexPanel,
    LucideArrowUpDown,
    LucideSearch,
    LucideSlidersHorizontal,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block p-(--page-padding)' },
  templateUrl: './inventory-page.html',
})
export class InventoryPage {
  private readonly api = inject(InventoryApi);
  private readonly branchApi = inject(BranchOptionsApi);
  private readonly session = inject(AuthStore).session;

  protected readonly rowKey = rowKey;
  protected readonly storeIcon = LucideStore.icon;
  protected readonly formatQuantity = formatQuantity;

  private readonly role = computed(() => this.session()?.rol ?? null);
  protected readonly isAdmin = computed(() => this.role() === 'ADMIN');
  /** El costo y el precio son datos de margen: solo para ADMIN y MANAGER. */
  protected readonly canSeeCost = computed(() => this.role() === 'ADMIN' || this.role() === 'MANAGER');
  /** Ajustar existencias: ADMIN, MANAGER y OPERADOR_INVENTARIO (los dos últimos solo en su sucursal, que el backend también exige). */
  protected readonly canEdit = computed(() => this.role() === 'ADMIN' || this.role() === 'MANAGER' || this.role() === 'OPERADOR_INVENTARIO');
  /** El historial completo de la sucursal no está abierto al vendedor. */
  protected readonly canSeeKardex = computed(() => this.role() !== 'SELLER');

  protected readonly tabs = computed<readonly TabItem[]>(() => (this.canSeeKardex() ? TABS : TABS.slice(0, 1)));
  protected readonly activeTab = signal('stock');

  protected readonly branches = signal<readonly BranchOption[]>([]);
  protected readonly branchId = signal<number | null>(null);
  protected readonly branchOptions = computed<SelectOption<number>[]>(() =>
    this.branches().map((branch) => ({ value: branch.id, label: branch.nombre + (branch.activa ? '' : ' (inactiva)') })),
  );

  protected readonly items = signal<readonly InventoryItem[]>([]);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly search = signal('');

  protected readonly columns = computed<readonly TableColumn<InventoryRow>[]>(() => [
    ...BASE_COLUMNS,
    ...(this.canSeeCost() ? COST_COLUMNS : []),
    ...(this.canEdit() ? [ACTIONS_COLUMN] : []),
  ]);

  private readonly allRows = computed<InventoryRow[]>(() => this.items().map((item) => ({ ...item, level: stockLevel(item) })));
  protected readonly rows = computed<InventoryRow[]>(() => {
    const needle = normalize(this.search().trim());
    if (needle === '') return this.allRows();
    return this.allRows().filter((row) => normalize(`${row.nombre} ${row.sku}`).includes(needle));
  });

  protected readonly summary = computed(() => {
    const rows = this.allRows();
    const critical = rows.filter((row) => row.level === 'critical').length;
    const out = rows.filter((row) => row.level === 'out').length;
    const parts = [rows.length === 1 ? '1 producto' : `${rows.length} productos`];
    if (critical > 0) parts.push(critical === 1 ? '1 crítico' : `${critical} críticos`);
    if (out > 0) parts.push(out === 1 ? '1 agotado' : `${out} agotados`);
    return parts.join(' · ');
  });

  /** Formularios abiertos. */
  protected readonly adjusting = signal<InventoryItem | null>(null);
  protected readonly adjustOpen = signal(false);
  protected readonly configuring = signal<InventoryItem | null>(null);
  protected readonly configOpen = signal(false);

  /** Para descartar la respuesta de una carga anterior si se cambió de sucursal mientras llegaba. */
  private requestId = 0;

  constructor() {
    void this.init();
    effect(() => {
      const branch = this.branchId();
      if (branch !== null) untracked(() => void this.load(branch));
    });
  }

  /** ADMIN elige entre todas las sucursales; el resto trabaja siempre en la suya. */
  private async init(): Promise<void> {
    if (!this.isAdmin()) {
      const own = this.session()?.sucursalId;
      if (own === undefined) {
        this.error.set('Tu usuario no tiene una sucursal asignada.');
        this.loading.set(false);
      } else {
        this.branchId.set(own);
      }
      return;
    }
    try {
      const branches = await new Promise<BranchOption[]>((resolve, reject) => this.branchApi.list().subscribe({ next: resolve, error: reject }));
      this.branches.set(branches);
      const first = branches.find((branch) => branch.activa) ?? branches[0];
      if (first) this.branchId.set(first.id);
      else this.loading.set(false);
    } catch (error) {
      this.error.set(toApiError(error).message);
      this.loading.set(false);
    }
  }

  protected load(branch = this.branchId(), silent = false): void {
    if (branch === null) return;
    const id = ++this.requestId;
    if (!silent) this.loading.set(true);
    this.error.set(null);
    this.api.list(branch).subscribe({
      next: (items) => {
        if (id !== this.requestId) return;
        this.items.set(items);
        this.loading.set(false);
      },
      error: (error: unknown) => {
        if (id !== this.requestId) return;
        this.error.set(toApiError(error).message);
        this.loading.set(false);
      },
    });
  }

  protected onSearch(event: Event): void {
    this.search.set((event.target as HTMLInputElement).value);
  }

  protected openAdjust(item: InventoryItem): void {
    this.adjusting.set(item);
    this.adjustOpen.set(true);
  }

  protected openMinimum(item: InventoryItem): void {
    this.configuring.set(item);
    this.configOpen.set(true);
  }
}
