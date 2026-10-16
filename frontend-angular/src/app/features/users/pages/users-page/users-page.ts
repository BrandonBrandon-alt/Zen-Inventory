import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { LucideBan, LucidePencil, LucidePlus } from '@lucide/angular';
import { toApiError } from '@core/api/api-error';
import { AuthStore } from '@core/auth/session/auth-store';
import { NotificationService } from '@core/notifications/notification.service';
import { type BadgeVariant, Badge } from '@shared/ui/badge/badge';
import { Button } from '@shared/ui/button/button';
import { ConfirmDialog } from '@shared/ui/confirm-dialog/confirm-dialog';
import { DataTable, DataTableCell, type TableColumn } from '@shared/ui/data-table/data-table';
import { UserFormModal } from '../../components/user-form-modal/user-form-modal';
import { type AppUser, type BranchOption, type RoleOption, UsersApi } from '../../data-access/users-api';

/** Fila de la tabla: el usuario más el nombre de su sucursal (para mostrarlo y ordenarlo). */
interface UserRow extends AppUser {
  readonly sucursal: string;
}

const COLUMNS: readonly TableColumn<UserRow>[] = [
  { key: 'nombre', header: 'Nombre', sortable: true, primary: true },
  { key: 'email', header: 'Correo', sortable: true },
  { key: 'rol', header: 'Rol', sortable: true },
  { key: 'sucursal', header: 'Sucursal', sortable: true },
  { key: 'activo', header: 'Estado', sortable: true },
  { key: 'acciones', header: 'Acciones', align: 'end' },
];

const ROLE_VARIANTS: Record<string, BadgeVariant> = { ADMIN: 'danger', MANAGER: 'info' };

/** Roles que un MANAGER puede administrar (siempre inferiores al suyo); el backend lo vuelve a exigir. */
const MANAGER_MANAGEABLE: readonly string[] = ['SELLER', 'OPERADOR_INVENTARIO'];

const rowKey = (user: UserRow): number => user.id;

@Component({
  selector: 'app-users-page',
  imports: [DataTable, DataTableCell, Badge, Button, ConfirmDialog, UserFormModal, LucideBan, LucidePencil, LucidePlus],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block p-(--page-padding)' },
  templateUrl: './users-page.html',
})
export class UsersPage {
  private readonly api = inject(UsersApi);
  private readonly notifications = inject(NotificationService);
  private readonly session = inject(AuthStore).session;

  protected readonly columns = COLUMNS;
  protected readonly rowKey = rowKey;

  protected readonly users = signal<readonly AppUser[]>([]);
  protected readonly roles = signal<readonly RoleOption[]>([]);
  protected readonly branches = signal<readonly BranchOption[]>([]);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);

  /** Un MANAGER siempre opera en su sucursal: no elige sucursal al crear o editar. */
  protected readonly isManager = computed(() => this.session()?.rol === 'MANAGER');
  protected readonly currentUserId = computed(() => this.session()?.id);
  /** El formulario necesita los roles; hasta que lleguen no se ofrece crear ni editar. */
  protected readonly canOpenForm = computed(() => this.roles().length > 0);

  protected readonly rows = computed<UserRow[]>(() => {
    const names = new Map(this.branches().map((branch) => [branch.id, branch.nombre]));
    return this.users().map((user) => ({
      ...user,
      sucursal: user.sucursalId === null ? '' : (names.get(user.sucursalId) ?? `Sucursal ${user.sucursalId}`),
    }));
  });

  protected readonly summary = computed(() => {
    const total = this.users().length;
    const active = this.users().filter((user) => user.activo).length;
    return `${total === 1 ? '1 usuario' : `${total} usuarios`}, ${active} ${active === 1 ? 'activo' : 'activos'}`;
  });

  /** Formulario de crear/editar: `editing` es el usuario a editar (null = crear). */
  protected readonly formOpen = signal(false);
  protected readonly editing = signal<AppUser | null>(null);

  /** Desactivación pendiente de confirmar. */
  protected readonly confirmOpen = signal(false);
  protected readonly deactivating = signal<AppUser | null>(null);
  protected readonly deactivateBusy = signal(false);
  protected readonly deactivateError = signal<string | null>(null);

  constructor() {
    void this.load();
    void this.loadOptions();
  }

  protected roleVariant(user: AppUser): BadgeVariant {
    return ROLE_VARIANTS[user.rol] ?? 'neutral';
  }

  /** Si quien opera puede editar o desactivar a este usuario (un MANAGER solo a roles inferiores). */
  protected canManage(user: AppUser): boolean {
    return !this.isManager() || MANAGER_MANAGEABLE.includes(user.rol);
  }

  /** Desactivar: usuarios activos y administrables, nunca la propia cuenta. */
  protected canDeactivate(user: AppUser): boolean {
    return user.activo && this.canManage(user) && user.id !== this.session()?.id;
  }

  /** `silent`: recarga sin mostrar el esqueleto (tras guardar o desactivar la tabla no debe parpadear). */
  protected async load(silent = false): Promise<void> {
    if (!silent) this.loading.set(true);
    this.error.set(null);
    try {
      this.users.set(await firstValueFrom(this.api.list()));
    } catch (error) {
      this.error.set(toApiError(error).message);
    } finally {
      this.loading.set(false);
    }
  }

  /** Roles y sucursales de los selects; si fallan, la tabla sigue funcionando y se avisa del motivo. */
  private async loadOptions(): Promise<void> {
    try {
      const [roles, branches] = await Promise.all([firstValueFrom(this.api.roles()), firstValueFrom(this.api.branches())]);
      this.roles.set(roles);
      this.branches.set(branches);
    } catch (error) {
      this.notifications.error(toApiError(error).message);
    }
  }

  protected openCreate(): void {
    this.editing.set(null);
    this.formOpen.set(true);
  }

  protected openEdit(user: AppUser): void {
    this.editing.set(user);
    this.formOpen.set(true);
  }

  protected askDeactivate(user: AppUser): void {
    this.deactivating.set(user);
    this.deactivateError.set(null);
    this.confirmOpen.set(true);
  }

  protected async confirmDeactivate(): Promise<void> {
    const user = this.deactivating();
    if (!user || this.deactivateBusy()) return;
    this.deactivateBusy.set(true);
    this.deactivateError.set(null);
    try {
      await firstValueFrom(this.api.deactivate(user.id));
      this.confirmOpen.set(false);
      this.notifications.success(`Usuario "${user.nombre}" desactivado.`);
      await this.load(true);
    } catch (error) {
      this.deactivateError.set(toApiError(error).message);
    } finally {
      this.deactivateBusy.set(false);
    }
  }
}
