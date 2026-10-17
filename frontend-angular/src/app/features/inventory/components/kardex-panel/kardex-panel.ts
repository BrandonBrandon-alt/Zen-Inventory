import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { LucidePackage } from '@lucide/angular';
import { toApiError } from '@core/api/api-error';
import { formatDateTime, formatQuantity } from '@shared/format/format';
import { Badge } from '@shared/ui/badge/badge';
import { DataTable, DataTableCell, type TableColumn } from '@shared/ui/data-table/data-table';
import { Select, type SelectOption } from '@shared/ui/select/select';
import { type InventoryItem, InventoryApi, type Movement } from '../../data-access/inventory-api';
import { REASON_LABELS, subReasonLabel } from '../../data-access/inventory-labels';

/** Fila del kardex: el movimiento con el nombre de su producto. */
interface MovementRow extends Movement {
  readonly productName: string;
}

/** Movimientos con signo: los retiros restan, para mostrarlos y ordenarlos como "+5" / "−3". */
const signed = (row: Movement): number => (row.type === 'INGRESO' ? row.quantity : -row.quantity);

const COLUMNS: readonly TableColumn<MovementRow>[] = [
  { key: 'date', header: 'Fecha', sortable: true, width: '11.5rem', value: (r) => r.date, display: (r) => formatDateTime(r.date) },
  { key: 'productName', header: 'Producto', sortable: true, primary: true },
  { key: 'type', header: 'Tipo', sortable: true },
  { key: 'reason', header: 'Motivo', sortable: true, value: (r) => REASON_LABELS[r.reason] },
  { key: 'quantity', header: 'Cantidad', sortable: true, align: 'end', value: signed },
  { key: 'balance', header: 'Saldo', align: 'end', display: (r) => formatQuantity(r.balance) },
  { key: 'observations', header: 'Observaciones' },
];

const rowKey = (row: MovementRow): number => row.id;

/** Historial de movimientos (kardex) de una sucursal, de un producto o de todos. */
@Component({
  selector: 'app-kardex-panel',
  imports: [DataTable, DataTableCell, Badge, Select],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="mb-4 max-w-sm">
      <app-select
        [(value)]="productId"
        [options]="productOptions()"
        [icon]="packageIcon"
        searchable
        searchPlaceholder="Buscar producto…"
        ariaLabel="Filtrar por producto"
        placeholder="Todos los productos"
      />
    </div>

    <app-data-table
      caption="Historial de movimientos"
      [columns]="columns"
      [rows]="rows()"
      [rowKey]="rowKey"
      [loading]="loading()"
      [error]="error()"
      [pageSize]="15"
      minWidth="56rem"
      emptyTitle="Sin movimientos"
      emptyDescription="Los ingresos y retiros de existencias aparecerán aquí."
      (retry)="load()"
    >
      <ng-template appCell="type" let-row>
        <app-badge [variant]="row.type === 'INGRESO' ? 'success' : 'danger'">{{ row.type === 'INGRESO' ? 'Ingreso' : 'Retiro' }}</app-badge>
      </ng-template>
      <ng-template appCell="reason" let-row>
        {{ reasonLabel(row) }}
      </ng-template>
      <ng-template appCell="quantity" let-row>
        <span class="font-semibold tabular-nums" [class]="row.type === 'INGRESO' ? 'text-success' : 'text-danger'">
          {{ row.type === 'INGRESO' ? '+' : '−' }}{{ formatQuantity(row.quantity) }}
        </span>
      </ng-template>
      <ng-template appCell="observations" let-row>
        <span class="block max-w-64 truncate text-fg-muted" [attr.title]="row.observations || null">{{ row.observations || '—' }}</span>
      </ng-template>
    </app-data-table>
  `,
})
export class KardexPanel {
  private readonly api = inject(InventoryApi);

  readonly branchId = input.required<number>();
  /** Productos de la sucursal: sirven para el filtro y para nombrar cada movimiento. */
  readonly products = input.required<readonly InventoryItem[]>();

  protected readonly columns = COLUMNS;
  protected readonly rowKey = rowKey;
  protected readonly packageIcon = LucidePackage.icon;
  protected readonly formatQuantity = formatQuantity;

  protected readonly productId = signal<number | null>(null);
  private readonly movements = signal<readonly Movement[]>([]);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);

  protected readonly productOptions = computed<SelectOption<number | null>[]>(() => [
    { value: null, label: 'Todos los productos' },
    ...this.products().map((product) => ({ value: product.productId, label: product.nombre, description: product.sku || undefined })),
  ]);

  protected readonly rows = computed<MovementRow[]>(() => {
    const names = new Map(this.products().map((product) => [product.productId, product.nombre]));
    return this.movements().map((movement) => ({ ...movement, productName: names.get(movement.productId) ?? `Producto ${movement.productId}` }));
  });

  /** Para descartar la respuesta de una consulta anterior si el usuario cambió de sucursal o de producto mientras llegaba. */
  private requestId = 0;

  constructor() {
    effect(() => {
      this.branchId();
      this.productId();
      untracked(() => this.load());
    });
  }

  protected reasonLabel(row: Movement): string {
    const label = REASON_LABELS[row.reason];
    return row.subReason ? `${label} · ${subReasonLabel(row.subReason)}` : label;
  }

  protected load(): void {
    const id = ++this.requestId;
    this.loading.set(true);
    this.error.set(null);
    this.api.movements(this.branchId(), this.productId()).subscribe({
      next: (movements) => {
        if (id !== this.requestId) return;
        this.movements.set(movements);
        this.loading.set(false);
      },
      error: (error: unknown) => {
        if (id !== this.requestId) return;
        this.error.set(toApiError(error).message);
        this.loading.set(false);
      },
    });
  }
}
