import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { forkJoin, firstValueFrom, catchError, of } from 'rxjs';
import { LucideBan, LucidePencil, LucidePlus, LucideRuler, LucideSearch } from '@lucide/angular';
import { toApiError } from '@core/api/api-error';
import { CatalogOptionsApi, type SupplierOption, type UnitOption } from '@core/catalog/catalog-options-api';
import { NotificationService } from '@core/notifications/notification.service';
import { formatMoney } from '@shared/format/format';
import { Badge } from '@shared/ui/badge/badge';
import { Button } from '@shared/ui/button/button';
import { ConfirmDialog } from '@shared/ui/confirm-dialog/confirm-dialog';
import { DataTable, DataTableCell, type TableColumn } from '@shared/ui/data-table/data-table';
import { FormField, InputDirective } from '@shared/ui/form-field/form-field';
import { Tooltip } from '@shared/ui/tooltip/tooltip';
import { ProductFormModal } from '../../components/product-form-modal/product-form-modal';
import { ProductUnitsModal } from '../../components/product-units-modal/product-units-modal';
import { type Product, ProductsApi, type ProductSupplier } from '../../data-access/products-api';

const COLUMNS: readonly TableColumn<Product>[] = [
  { key: 'sku', header: 'SKU', sortable: true },
  { key: 'nombre', header: 'Producto', sortable: true, primary: true },
  { key: 'unitAbbreviation', header: 'Unidad' },
  { key: 'cost', header: 'Costo prom.', sortable: true, align: 'end', display: (p) => formatMoney(p.cost) },
  { key: 'price', header: 'Precio venta', sortable: true, align: 'end', display: (p) => formatMoney(p.price) },
  { key: 'suppliers', header: 'Proveedores' },
  { key: 'activo', header: 'Estado', sortable: true },
  { key: 'acciones', header: 'Acciones', align: 'end' },
];

const rowKey = (product: Product): number => product.id;

/** Minúsculas y sin acentos: "tuerca" encuentra "Tuérca". */
const normalize = (text: string): string => text.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();

@Component({
  selector: 'app-products-page',
  imports: [
    DataTable,
    DataTableCell,
    Badge,
    Button,
    ConfirmDialog,
    FormField,
    InputDirective,
    ProductFormModal,
    ProductUnitsModal,
    Tooltip,
    LucideBan,
    LucidePencil,
    LucidePlus,
    LucideRuler,
    LucideSearch,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block p-(--page-padding)' },
  templateUrl: './products-page.html',
})
export class ProductsPage {
  private readonly api = inject(ProductsApi);
  private readonly catalog = inject(CatalogOptionsApi);
  private readonly notifications = inject(NotificationService);

  protected readonly columns = COLUMNS;
  protected readonly rowKey = rowKey;

  protected readonly products = signal<readonly Product[]>([]);
  protected readonly units = signal<readonly UnitOption[]>([]);
  protected readonly suppliers = signal<readonly SupplierOption[]>([]);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly search = signal('');

  protected readonly formOpen = signal(false);
  protected readonly editing = signal<Product | null>(null);

  protected readonly unitsOpen = signal(false);
  protected readonly unitsFor = signal<Product | null>(null);

  protected readonly confirmOpen = signal(false);
  protected readonly deactivating = signal<Product | null>(null);
  protected readonly deactivateBusy = signal(false);
  protected readonly deactivateError = signal<string | null>(null);

  protected readonly rows = computed(() => {
    const term = normalize(this.search().trim());
    if (!term) return this.products();
    return this.products().filter((p) => normalize(p.nombre).includes(term) || normalize(p.sku).includes(term));
  });

  protected readonly summary = computed(() => {
    const total = this.products().length;
    const active = this.products().filter((p) => p.activo).length;
    return `${total === 1 ? '1 producto' : `${total} productos`}, ${active} ${active === 1 ? 'activo' : 'activos'}`;
  });

  constructor() {
    void this.load();
    // Las listas de los selectores no son críticas: si fallan, el formulario se abre con ellas vacías.
    forkJoin({
      units: this.catalog.units().pipe(catchError(() => of([]))),
      suppliers: this.catalog.suppliers().pipe(catchError(() => of([]))),
    }).subscribe(({ units, suppliers }) => {
      this.units.set(units);
      this.suppliers.set(suppliers);
    });
  }

  protected async load(silent = false): Promise<void> {
    if (!silent) this.loading.set(true);
    this.error.set(null);
    try {
      this.products.set(await firstValueFrom(this.api.list()));
    } catch (error) {
      this.error.set(toApiError(error).message);
    } finally {
      this.loading.set(false);
    }
  }

  protected onSearch(event: Event): void {
    this.search.set((event.target as HTMLInputElement).value);
  }

  /** Proveedor que se muestra en la tabla: el preferido o, si no hay, el primero. */
  protected mainSupplier(product: Product): ProductSupplier | null {
    return product.suppliers.find((s) => s.preferred) ?? product.suppliers[0] ?? null;
  }

  /** Cuántos proveedores más tiene además del que se muestra. */
  protected otherCount(product: Product): number {
    return Math.max(0, product.suppliers.length - 1);
  }

  /** Detalle de todos los proveedores (uno por línea) para la descripción del "+N". */
  protected suppliersTooltip(product: Product): string {
    const main = this.mainSupplier(product);
    return [...product.suppliers]
      .sort((a, b) => Number(b === main) - Number(a === main))
      .map((s) => `${s.nombre}${s === main && s.preferred ? ' (preferido)' : ''}: ${formatMoney(s.negotiatedPrice)} · ${s.deliveryDays === 1 ? '1 día' : `${s.deliveryDays} días`}`)
      .join('\n');
  }

  protected openCreate(): void {
    this.editing.set(null);
    this.formOpen.set(true);
  }

  protected openEdit(product: Product): void {
    this.editing.set(product);
    this.formOpen.set(true);
  }

  protected openUnits(product: Product): void {
    this.unitsFor.set(product);
    this.unitsOpen.set(true);
  }

  protected askDeactivate(product: Product): void {
    this.deactivating.set(product);
    this.deactivateError.set(null);
    this.confirmOpen.set(true);
  }

  protected async confirmDeactivate(): Promise<void> {
    const product = this.deactivating();
    if (!product || this.deactivateBusy()) return;
    this.deactivateBusy.set(true);
    this.deactivateError.set(null);
    try {
      await firstValueFrom(this.api.deactivate(product.id));
      this.confirmOpen.set(false);
      this.notifications.success(`Producto "${product.nombre}" desactivado.`);
      await this.load(true);
    } catch (error) {
      this.deactivateError.set(toApiError(error).message);
    } finally {
      this.deactivateBusy.set(false);
    }
  }
}
