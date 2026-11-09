import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { LucideClock, LucideContact, LucideEllipsis, LucidePencil, LucidePlus, LucideSearch, LucideTrash2, LucideTruck } from '@lucide/angular';
import { toApiError } from '@core/api/api-error';
import { NotificationService } from '@core/notifications/notification.service';
import { normalizeText } from '@shared/format/format';
import { codecs, persistedFilter } from '@shared/filters/persisted-filter';
import { Button } from '@shared/ui/button/button';
import { ConfirmDialog } from '@shared/ui/confirm-dialog/confirm-dialog';
import { DataTable, DataTableCell, type TableColumn } from '@shared/ui/data-table/data-table';
import { ActiveFilters, type ActiveFilter } from '@shared/ui/filters/active-filters';
import { FormField, InputDirective } from '@shared/ui/form-field/form-field';
import { Select, type SelectOption } from '@shared/ui/select/select';
import { Tooltip } from '@shared/ui/tooltip/tooltip';
import { SupplierFormModal } from '../../components/supplier-form-modal/supplier-form-modal';
import { type Supplier, SuppliersApi } from '../../data-access/suppliers-api';

const COLUMNS: readonly TableColumn<Supplier>[] = [
  { key: 'nombre', header: 'Nombre', icon: LucideTruck.icon, sortable: true, primary: true },
  { key: 'contacto', header: 'Contacto', icon: LucideContact.icon, sortable: true },
  {
    key: 'tiempoEntregaDias',
    header: 'Entrega',
    icon: LucideClock.icon,
    sortable: true,
    align: 'end',
    display: (s) => (s.tiempoEntregaDias === null ? '—' : s.tiempoEntregaDias === 1 ? '1 día' : `${s.tiempoEntregaDias} días`),
  },
  { key: 'acciones', header: 'Acciones', icon: LucideEllipsis.icon, align: 'end' },
];

const rowKey = (supplier: Supplier): number => supplier.id;

type DeliveryFilter = 'all' | 'upTo3' | 'upTo7' | 'over7' | 'unknown';
const DELIVERY_FILTERS = ['all', 'upTo3', 'upTo7', 'over7', 'unknown'] as const;
const DELIVERY_LABELS: Record<DeliveryFilter, string> = {
  all: 'Cualquier plazo de entrega',
  upTo3: 'Entrega en 3 días o menos',
  upTo7: 'Entrega en 7 días o menos',
  over7: 'Entrega en más de 7 días',
  unknown: 'Sin plazo registrado',
};

function matchesDelivery(days: number | null, filter: DeliveryFilter): boolean {
  switch (filter) {
    case 'all': return true;
    case 'unknown': return days === null;
    case 'upTo3': return days !== null && days <= 3;
    case 'upTo7': return days !== null && days <= 7;
    case 'over7': return days !== null && days > 7;
  }
}

const SCREEN = 'suppliers';

@Component({
  selector: 'app-suppliers-page',
  imports: [DataTable, DataTableCell, Button, ConfirmDialog, ActiveFilters, FormField, InputDirective, Select, SupplierFormModal, Tooltip, LucidePencil, LucidePlus, LucideSearch, LucideTrash2],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block p-(--page-padding)' },
  templateUrl: './suppliers-page.html',
})
export class SuppliersPage {
  private readonly api = inject(SuppliersApi);
  private readonly notifications = inject(NotificationService);

  protected readonly columns = COLUMNS;
  protected readonly rowKey = rowKey;

  protected readonly suppliers = signal<readonly Supplier[]>([]);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);

  // Los filtros se recuerdan por persona (la búsqueda de texto no: se escribe cada vez).
  protected readonly search = signal('');
  protected readonly deliveryFilter = persistedFilter(SCREEN, 'delivery', 'all' as DeliveryFilter, codecs.oneOf(DELIVERY_FILTERS));
  protected readonly deliveryOptions: readonly SelectOption<DeliveryFilter>[] = DELIVERY_FILTERS.map((value) => ({ value, label: DELIVERY_LABELS[value] }));

  protected readonly rows = computed(() => {
    const term = normalizeText(this.search().trim());
    const delivery = this.deliveryFilter();
    return this.suppliers()
      .filter((s) => matchesDelivery(s.tiempoEntregaDias, delivery))
      .filter((s) => !term || normalizeText(s.nombre).includes(term) || normalizeText(s.contacto).includes(term));
  });

  /** Todos los filtros aplicados, para mostrarlos como etiquetas que se quitan. */
  protected readonly activeFilters = computed<ActiveFilter[]>(() => {
    const list: ActiveFilter[] = [];
    if (this.deliveryFilter() !== 'all') list.push({ id: 'delivery', label: 'Plazo', text: DELIVERY_LABELS[this.deliveryFilter()] });
    if (this.search().trim()) list.push({ id: 'search', label: 'Búsqueda', text: this.search().trim() });
    return list;
  });

  protected readonly formOpen = signal(false);
  protected readonly editing = signal<Supplier | null>(null);

  protected readonly confirmOpen = signal(false);
  protected readonly deleting = signal<Supplier | null>(null);
  protected readonly deleteBusy = signal(false);
  protected readonly deleteError = signal<string | null>(null);

  protected readonly summary = computed(() => {
    const total = this.suppliers().length;
    return total === 1 ? '1 proveedor' : `${total} proveedores`;
  });

  constructor() {
    void this.load();
  }

  protected async load(silent = false): Promise<void> {
    if (!silent) this.loading.set(true);
    this.error.set(null);
    try {
      this.suppliers.set(await firstValueFrom(this.api.list()));
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
      case 'delivery': this.deliveryFilter.set('all'); break;
      case 'search': this.search.set(''); break;
    }
  }

  protected clearFilters(): void {
    for (const filter of this.activeFilters()) this.removeFilter(filter.id);
  }

  protected openCreate(): void {
    this.editing.set(null);
    this.formOpen.set(true);
  }

  protected openEdit(supplier: Supplier): void {
    this.editing.set(supplier);
    this.formOpen.set(true);
  }

  protected askDelete(supplier: Supplier): void {
    this.deleting.set(supplier);
    this.deleteError.set(null);
    this.confirmOpen.set(true);
  }

  protected async confirmDelete(): Promise<void> {
    const supplier = this.deleting();
    if (!supplier || this.deleteBusy()) return;
    this.deleteBusy.set(true);
    this.deleteError.set(null);
    try {
      await firstValueFrom(this.api.delete(supplier.id));
      this.confirmOpen.set(false);
      this.notifications.success(`Proveedor "${supplier.nombre}" eliminado.`);
      await this.load(true);
    } catch (error) {
      const apiError = toApiError(error);
      // 409: tiene productos o compras asociadas. El mensaje genérico del servidor no dice qué hacer.
      this.deleteError.set(apiError.status === 409 ? 'No se puede eliminar: el proveedor tiene productos o compras asociadas.' : apiError.message);
    } finally {
      this.deleteBusy.set(false);
    }
  }
}
