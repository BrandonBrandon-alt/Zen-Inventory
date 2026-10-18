import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { LucideEllipsis, LucidePencil, LucidePlus, LucideRuler, LucideTrash2, LucideType } from '@lucide/angular';
import { toApiError } from '@core/api/api-error';
import { NotificationService } from '@core/notifications/notification.service';
import { Button } from '@shared/ui/button/button';
import { ConfirmDialog } from '@shared/ui/confirm-dialog/confirm-dialog';
import { DataTable, DataTableCell, type TableColumn } from '@shared/ui/data-table/data-table';
import { Tooltip } from '@shared/ui/tooltip/tooltip';
import { UnitFormModal } from '../../components/unit-form-modal/unit-form-modal';
import { type Unit, UnitsApi } from '../../data-access/units-api';

const COLUMNS: readonly TableColumn<Unit>[] = [
  { key: 'nombre', header: 'Nombre', icon: LucideRuler.icon, sortable: true, primary: true },
  { key: 'abreviatura', header: 'Abreviatura', icon: LucideType.icon, sortable: true },
  { key: 'acciones', header: 'Acciones', icon: LucideEllipsis.icon, align: 'end' },
];

const rowKey = (unit: Unit): number => unit.id;

@Component({
  selector: 'app-units-page',
  imports: [DataTable, DataTableCell, Button, ConfirmDialog, UnitFormModal, Tooltip, LucidePencil, LucidePlus, LucideTrash2],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block p-(--page-padding)' },
  templateUrl: './units-page.html',
})
export class UnitsPage {
  private readonly api = inject(UnitsApi);
  private readonly notifications = inject(NotificationService);

  protected readonly columns = COLUMNS;
  protected readonly rowKey = rowKey;

  protected readonly units = signal<readonly Unit[]>([]);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);

  protected readonly formOpen = signal(false);
  protected readonly editing = signal<Unit | null>(null);

  protected readonly confirmOpen = signal(false);
  protected readonly deleting = signal<Unit | null>(null);
  protected readonly deleteBusy = signal(false);
  protected readonly deleteError = signal<string | null>(null);

  protected readonly summary = computed(() => {
    const total = this.units().length;
    return total === 1 ? '1 unidad' : `${total} unidades`;
  });

  constructor() {
    void this.load();
  }

  protected async load(silent = false): Promise<void> {
    if (!silent) this.loading.set(true);
    this.error.set(null);
    try {
      this.units.set(await firstValueFrom(this.api.list()));
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

  protected openEdit(unit: Unit): void {
    this.editing.set(unit);
    this.formOpen.set(true);
  }

  protected askDelete(unit: Unit): void {
    this.deleting.set(unit);
    this.deleteError.set(null);
    this.confirmOpen.set(true);
  }

  protected async confirmDelete(): Promise<void> {
    const unit = this.deleting();
    if (!unit || this.deleteBusy()) return;
    this.deleteBusy.set(true);
    this.deleteError.set(null);
    try {
      await firstValueFrom(this.api.delete(unit.id));
      this.confirmOpen.set(false);
      this.notifications.success(`Unidad "${unit.nombre}" eliminada.`);
      await this.load(true);
    } catch (error) {
      const apiError = toApiError(error);
      // 409: algún producto la usa. El mensaje genérico del servidor no dice qué hacer.
      this.deleteError.set(apiError.status === 409 ? 'No se puede eliminar: hay productos que usan esta unidad.' : apiError.message);
    } finally {
      this.deleteBusy.set(false);
    }
  }
}
