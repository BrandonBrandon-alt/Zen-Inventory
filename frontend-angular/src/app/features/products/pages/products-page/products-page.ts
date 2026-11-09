import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { forkJoin, firstValueFrom, catchError, of } from 'rxjs';
import { LucideBan, LucideBarcode, LucideCircleCheck, LucideCoins, LucideEllipsis, LucidePackage, LucidePencil, LucidePlus, LucideRuler, LucideSearch, LucideTag, LucideTruck } from '@lucide/angular';
import { toApiError } from '@core/api/api-error';
import { CatalogOptionsApi, type SupplierOption, type UnitOption } from '@core/catalog/catalog-options-api';
import { NotificationService } from '@core/notifications/notification.service';
import { formatMoney, normalizeText } from '@shared/format/format';
import { inNumberRange, numberFromInput } from '@shared/filters/filter-helpers';
import { codecs, persistedFilter } from '@shared/filters/persisted-filter';
import { Checkbox } from '@shared/ui/checkbox/checkbox';
import { Badge } from '@shared/ui/badge/badge';
import { Button } from '@shared/ui/button/button';
import { ConfirmDialog } from '@shared/ui/confirm-dialog/confirm-dialog';
import { DataTable, DataTableCell, type TableColumn } from '@shared/ui/data-table/data-table';
import { ActiveFilters, type ActiveFilter } from '@shared/ui/filters/active-filters';
import { AdvancedFilters } from '@shared/ui/filters/advanced-filters';
import { FormField, InputDirective } from '@shared/ui/form-field/form-field';
import { Select, type SelectOption } from '@shared/ui/select/select';
import { Tooltip } from '@shared/ui/tooltip/tooltip';
import { ProductFormModal } from '../../components/product-form-modal/product-form-modal';
import { ProductUnitsModal } from '../../components/product-units-modal/product-units-modal';
import { type Product, ProductsApi, type ProductSupplier } from '../../data-access/products-api';

const COLUMNS: readonly TableColumn<Product>[] = [
  { key: 'sku', header: 'SKU', icon: LucideBarcode.icon, sortable: true },
  { key: 'nombre', header: 'Producto', icon: LucidePackage.icon, sortable: true, nowrap: true, primary: true },
  { key: 'unitAbbreviation', header: 'Unidad', icon: LucideRuler.icon },
  { key: 'cost', header: 'Costo prom.', icon: LucideCoins.icon, sortable: true, align: 'end', display: (p) => formatMoney(p.cost) },
  { key: 'price', header: 'Precio venta', icon: LucideTag.icon, sortable: true, align: 'end', display: (p) => formatMoney(p.price) },
  { key: 'suppliers', header: 'Proveedores', icon: LucideTruck.icon, export: (p) => p.suppliers.map((s) => s.nombre).join('; ') },
  { key: 'activo', header: 'Estado', icon: LucideCircleCheck.icon, sortable: true },
  { key: 'acciones', header: 'Acciones', icon: LucideEllipsis.icon, align: 'end' },
];

const rowKey = (product: Product): number => product.id;

/** Minúsculas y sin acentos: "tuerca" encuentra "Tuérca". */

@Component({
  selector: 'app-products-page',
  imports: [
    Checkbox,
    DataTable,
    DataTableCell,
    Badge,
    Button,
    ConfirmDialog,
    ActiveFilters,
    AdvancedFilters,
    Select,
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
  // Los filtros se recuerdan por persona (la búsqueda de texto no: se escribe cada vez).
  private static readonly SCREEN = 'products';
  protected readonly search = signal('');
  protected readonly statusFilter = persistedFilter(ProductsPage.SCREEN, 'status', 'all' as 'all' | 'active' | 'inactive', codecs.oneOf(['all', 'active', 'inactive'] as const));
  protected readonly unitFilter = persistedFilter(ProductsPage.SCREEN, 'unit', null as number | null, codecs.nullable(codecs.number()));
  protected readonly supplierFilter = persistedFilter(ProductsPage.SCREEN, 'supplier', null as number | null, codecs.nullable(codecs.number()));
  protected readonly minPrice = persistedFilter(ProductsPage.SCREEN, 'minPrice', null as number | null, codecs.nullable(codecs.number()));
  protected readonly maxPrice = persistedFilter(ProductsPage.SCREEN, 'maxPrice', null as number | null, codecs.nullable(codecs.number()));
  protected readonly noSuppliers = persistedFilter(ProductsPage.SCREEN, 'noSuppliers', false, codecs.bool());
  protected readonly advancedOpen = persistedFilter(ProductsPage.SCREEN, 'advancedOpen', false, codecs.bool());
  protected readonly numberFromInput = numberFromInput;
  protected readonly statusOptions: readonly SelectOption<'all' | 'active' | 'inactive'>[] = [
    { value: 'all', label: 'Activos e inactivos' },
    { value: 'active', label: 'Solo activos' },
    { value: 'inactive', label: 'Solo inactivos' },
  ];

  protected readonly formOpen = signal(false);
  protected readonly editing = signal<Product | null>(null);

  protected readonly unitsOpen = signal(false);
  protected readonly unitsFor = signal<Product | null>(null);

  protected readonly confirmOpen = signal(false);
  protected readonly deactivating = signal<Product | null>(null);
  protected readonly deactivateBusy = signal(false);
  protected readonly deactivateError = signal<string | null>(null);

  protected readonly unitOptions = computed<SelectOption<number | null>[]>(() => [
    { value: null, label: 'Todas las unidades' },
    ...this.units().map((u) => ({ value: u.id, label: `${u.nombre} (${u.abreviatura})` })),
  ]);
  protected readonly supplierOptions = computed<SelectOption<number | null>[]>(() => [
    { value: null, label: 'Todos los proveedores' },
    ...this.suppliers().map((s) => ({ value: s.id, label: s.nombre })),
  ]);

  protected readonly rows = computed(() => {
    const term = normalizeText(this.search().trim());
    const status = this.statusFilter();
    const { unit, supplier, minPrice, maxPrice, noSuppliers } = {
      unit: this.unitFilter(),
      supplier: this.supplierFilter(),
      minPrice: this.minPrice(),
      maxPrice: this.maxPrice(),
      noSuppliers: this.noSuppliers(),
    };
    return this.products()
      .filter((p) => status === 'all' || (status === 'active') === p.activo)
      .filter((p) => unit === null || p.unitId === unit)
      .filter((p) => supplier === null || p.suppliers.some((s) => s.supplierId === supplier))
      .filter((p) => inNumberRange(p.price, minPrice, maxPrice))
      .filter((p) => !noSuppliers || p.suppliers.length === 0)
      .filter((p) => !term || normalizeText(p.nombre).includes(term) || normalizeText(p.sku).includes(term));
  });

  /** Los filtros del panel «Más filtros» que están aplicados (el botón muestra cuántos). */
  protected readonly advancedCount = computed(
    () => [this.supplierFilter() !== null, this.minPrice() !== null, this.maxPrice() !== null, this.noSuppliers()].filter(Boolean).length,
  );

  /** Todos los filtros aplicados, para mostrarlos como etiquetas que se quitan. */
  protected readonly activeFilters = computed<ActiveFilter[]>(() => {
    const list: ActiveFilter[] = [];
    if (this.statusFilter() !== 'all') list.push({ id: 'status', label: 'Estado', text: this.statusFilter() === 'active' ? 'Activos' : 'Inactivos' });
    if (this.unitFilter() !== null) {
      const unit = this.units().find((u) => u.id === this.unitFilter());
      list.push({ id: 'unit', label: 'Unidad', text: unit ? unit.nombre : `Unidad ${this.unitFilter()}` });
    }
    if (this.supplierFilter() !== null) list.push({ id: 'supplier', label: 'Proveedor', text: this.suppliers().find((s) => s.id === this.supplierFilter())?.nombre ?? `Proveedor ${this.supplierFilter()}` });
    if (this.minPrice() !== null) list.push({ id: 'minPrice', label: 'Precio desde', text: formatMoney(this.minPrice()) });
    if (this.maxPrice() !== null) list.push({ id: 'maxPrice', label: 'Precio hasta', text: formatMoney(this.maxPrice()) });
    if (this.noSuppliers()) list.push({ id: 'noSuppliers', label: 'Sin', text: 'proveedores' });
    if (this.search().trim()) list.push({ id: 'search', label: 'Búsqueda', text: this.search().trim() });
    return list;
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

  protected removeFilter(id: string): void {
    switch (id) {
      case 'status': this.statusFilter.set('all'); break;
      case 'unit': this.unitFilter.set(null); break;
      case 'supplier': this.supplierFilter.set(null); break;
      case 'minPrice': this.minPrice.set(null); break;
      case 'maxPrice': this.maxPrice.set(null); break;
      case 'noSuppliers': this.noSuppliers.set(false); break;
      case 'search': this.search.set(''); break;
    }
  }

  protected clearFilters(): void {
    for (const filter of this.activeFilters()) this.removeFilter(filter.id);
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
