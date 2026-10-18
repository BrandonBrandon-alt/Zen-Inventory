import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { LucideClock, LucideContact, LucideEllipsis, LucidePencil, LucidePlus, LucideTrash2, LucideTruck } from '@lucide/angular';
import { toApiError } from '@core/api/api-error';
import { NotificationService } from '@core/notifications/notification.service';
import { Button } from '@shared/ui/button/button';
import { ConfirmDialog } from '@shared/ui/confirm-dialog/confirm-dialog';
import { DataTable, DataTableCell, type TableColumn } from '@shared/ui/data-table/data-table';
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

@Component({
  selector: 'app-suppliers-page',
  imports: [DataTable, DataTableCell, Button, ConfirmDialog, SupplierFormModal, Tooltip, LucidePencil, LucidePlus, LucideTrash2],
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
