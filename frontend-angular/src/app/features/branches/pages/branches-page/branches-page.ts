import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { NotificationService } from '@core/notifications/notification.service';
import { toApiError } from '@core/api/api-error';
import { LucideBan, LucideCircleCheck, LucideEllipsis, LucideMapPin, LucidePencil, LucidePhone, LucidePlus, LucideStore } from '@lucide/angular';
import { Badge } from '@shared/ui/badge/badge';
import { Button } from '@shared/ui/button/button';
import { ConfirmDialog } from '@shared/ui/confirm-dialog/confirm-dialog';
import { Tooltip } from '@shared/ui/tooltip/tooltip';
import { DataTable, DataTableCell, type TableColumn } from '@shared/ui/data-table/data-table';
import { type Branch, BranchesApi } from '../../data-access/branches-api';
import { BranchFormModal } from '../../components/branch-form-modal/branch-form-modal';

const COLUMNS: readonly TableColumn<Branch>[] = [
  { key: 'nombre', header: 'Nombre', icon: LucideStore.icon, sortable: true, primary: true },
  { key: 'direccion', header: 'Dirección', icon: LucideMapPin.icon, sortable: true },
  { key: 'telefono', header: 'Teléfono', icon: LucidePhone.icon },
  { key: 'activa', header: 'Estado', icon: LucideCircleCheck.icon, sortable: true },
  { key: 'acciones', header: 'Acciones', icon: LucideEllipsis.icon, align: 'end' },
];

const rowKey = (branch: Branch): number => branch.id;

@Component({
  selector: 'app-branches-page',
  imports: [DataTable, DataTableCell, Badge, Button, ConfirmDialog, BranchFormModal, Tooltip, LucideBan, LucidePencil, LucidePlus],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block p-(--page-padding)' },
  templateUrl: './branches-page.html',
})
export class BranchesPage {
  private readonly api = inject(BranchesApi);
  private readonly notifications = inject(NotificationService);

  protected readonly columns = COLUMNS;
  protected readonly rowKey = rowKey;

  protected readonly branches = signal<readonly Branch[]>([]);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);

  /** Formulario de crear/editar: `editing` es la sucursal a editar (null = crear). */
  protected readonly formOpen = signal(false);
  protected readonly editing = signal<Branch | null>(null);

  /** Desactivación pendiente de confirmar. */
  protected readonly confirmOpen = signal(false);
  protected readonly deactivating = signal<Branch | null>(null);
  protected readonly deactivateBusy = signal(false);
  protected readonly deactivateError = signal<string | null>(null);

  protected readonly summary = computed(() => {
    const total = this.branches().length;
    const active = this.branches().filter((b) => b.activa).length;
    const sucursales = total === 1 ? '1 sucursal' : `${total} sucursales`;
    return `${sucursales}, ${active} ${active === 1 ? 'activa' : 'activas'}`;
  });

  constructor() {
    void this.load();
  }

  /** `silent`: recarga sin mostrar el esqueleto (tras guardar o desactivar la tabla no debe parpadear). */
  protected async load(silent = false): Promise<void> {
    if (!silent) this.loading.set(true);
    this.error.set(null);
    try {
      this.branches.set(await firstValueFrom(this.api.list()));
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

  protected openEdit(branch: Branch): void {
    this.editing.set(branch);
    this.formOpen.set(true);
  }

  protected askDeactivate(branch: Branch): void {
    this.deactivating.set(branch);
    this.deactivateError.set(null);
    this.confirmOpen.set(true);
  }

  protected async confirmDeactivate(): Promise<void> {
    const branch = this.deactivating();
    if (!branch || this.deactivateBusy()) return;
    this.deactivateBusy.set(true);
    this.deactivateError.set(null);
    try {
      await firstValueFrom(this.api.deactivate(branch.id));
      this.confirmOpen.set(false);
      this.notifications.success(`Sucursal "${branch.nombre}" desactivada.`);
      await this.load(true);
    } catch (error) {
      this.deactivateError.set(toApiError(error).message);
    } finally {
      this.deactivateBusy.set(false);
    }
  }
}
