import { ChangeDetectionStrategy, Component, computed, effect, inject, input, model, output, signal, untracked } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { type AbstractControl, NonNullableFormBuilder, ReactiveFormsModule, type ValidationErrors, Validators } from '@angular/forms';
import { LucideBriefcase, LucidePackage, LucideShield, LucideShoppingBag, LucideStore, type LucideIconData } from '@lucide/angular';
import { toApiError } from '@core/api/api-error';
import type { BranchOption } from '@core/branches/branch-options-api';
import { NotificationService } from '@core/notifications/notification.service';
import { applyServerErrors } from '@shared/forms/apply-server-errors';
import { controlError } from '@shared/forms/control-error';
import { Checkbox } from '@shared/ui/checkbox/checkbox';
import { Alert } from '@shared/ui/alert/alert';
import { Button } from '@shared/ui/button/button';
import { FormField, InputDirective } from '@shared/ui/form-field/form-field';
import { Modal } from '@shared/ui/modal/modal';
import { Select, type SelectOption } from '@shared/ui/select/select';
import { type AppUser, type RoleOption, UsersApi } from '../../data-access/users-api';

const NAME_MIN = 3;
const PASSWORD_MIN = 6;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const NAME_MESSAGES: Record<string, string> = {
  required: 'El nombre es requerido.',
  minlength: `El nombre debe tener al menos ${NAME_MIN} caracteres.`,
};
const EMAIL_MESSAGES: Record<string, string> = { required: 'El correo es requerido.', pattern: 'Correo inválido.' };
const PASSWORD_MESSAGES: Record<string, string> = {
  required: 'La contraseña es requerida.',
  minlength: `Mínimo ${PASSWORD_MIN} caracteres.`,
};
const ROLE_MESSAGES: Record<string, string> = { required: 'Elige un rol.' };
const BRANCH_MESSAGES: Record<string, string> = { required: 'Elige una sucursal.' };

/** Un icono por rol: se reconoce de un vistazo en la lista. */
const ROLE_ICONS: Record<string, LucideIconData> = {
  ADMIN: LucideShield.icon,
  MANAGER: LucideBriefcase.icon,
  OPERADOR_INVENTARIO: LucidePackage.icon,
  SELLER: LucideShoppingBag.icon,
};

let nextId = 0;

/**
 * Formulario de creación (sin `user`) o edición (con `user`) de un usuario, dentro de un modal.
 *
 * - `roles` son los roles que quien opera puede asignar (el backend ya los filtra).
 * - `branchLocked`: el MANAGER siempre opera en su sucursal, así que no se le pide elegirla (el servidor la fija).
 * - El ADMIN no pertenece a una sucursal: al elegir ese rol el campo desaparece.
 */
@Component({
  selector: 'app-user-form-modal',
  imports: [Checkbox, ReactiveFormsModule, Modal, Button, Alert, FormField, InputDirective, Select],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-modal
      [(open)]="open"
      [title]="user() ? 'Editar usuario' : 'Nuevo usuario'"
      [description]="user() ? 'Actualiza los datos del usuario.' : 'Completa los datos del nuevo usuario.'"
      [dismissible]="!saving()"
    >
      <form [id]="formId" class="flex flex-col gap-4" [formGroup]="form" novalidate (ngSubmit)="submit()">
        @if (serverError(); as message) {
          <app-alert>{{ message }}</app-alert>
        }
        <app-form-field label="Nombre completo" [error]="error('nombre')">
          <input appInput type="text" formControlName="nombre" autocomplete="off" />
        </app-form-field>
        <app-form-field label="Correo" [error]="error('email')">
          <input appInput type="email" formControlName="email" autocomplete="off" />
        </app-form-field>
        <app-form-field [label]="user() ? 'Nueva contraseña (vacía para no cambiarla)' : 'Contraseña'" [error]="error('password')">
          <input appInput type="password" formControlName="password" autocomplete="new-password" />
        </app-form-field>
        <app-form-field label="Rol" [error]="error('rolId')">
          <app-select formControlName="rolId" [options]="roleOptions()" [icon]="shieldIcon" placeholder="Selecciona un rol" />
        </app-form-field>
        @if (showBranch()) {
          <app-form-field label="Sucursal" [error]="error('sucursalId')">
            <app-select
              formControlName="sucursalId"
              [options]="branchOptions()"
              [icon]="storeIcon"
              searchable
              searchPlaceholder="Buscar sucursal…"
              placeholder="Selecciona una sucursal"
            />
          </app-form-field>
        }
        @if (user() && !self()) {
          <app-checkbox formControlName="activo">Usuario activo</app-checkbox>
        }
      </form>
      <div data-slot="footer">
        <button appButton variant="ghost" type="button" [disabled]="saving()" (click)="open.set(false)">Cancelar</button>
        <button appButton type="submit" [attr.form]="formId" [loading]="saving()">
          {{ user() ? 'Guardar cambios' : 'Crear usuario' }}
        </button>
      </div>
    </app-modal>
  `,
})
export class UserFormModal {
  private readonly api = inject(UsersApi);
  private readonly notifications = inject(NotificationService);

  readonly open = model(false);
  /** Usuario a editar; sin él, el formulario crea uno nuevo. */
  readonly user = input<AppUser | null>(null);
  readonly roles = input<readonly RoleOption[]>([]);
  readonly branches = input<readonly BranchOption[]>([]);
  readonly branchLocked = input(false);
  /** Edita su propia cuenta: no puede cambiar su rol ni desactivarse (el backend también lo rechaza). */
  readonly self = input(false);
  /** El usuario ya guardado en el servidor. */
  readonly saved = output<AppUser>();

  protected readonly formId = `app-user-form-${nextId++}`;
  protected readonly saving = signal(false);
  protected readonly serverError = signal<string | null>(null);
  private readonly selectedRoleId = signal<number | null>(null);

  private readonly selectedRole = computed(() => this.roles().find((role) => role.id === this.selectedRoleId()) ?? null);

  /** La sucursal se pide a quien no es ADMIN, salvo que el servidor la fije (MANAGER). */
  protected readonly showBranch = computed(() => {
    const role = this.selectedRole();
    return !this.branchLocked() && role !== null && role.nombre !== 'ADMIN';
  });

  protected readonly form = inject(NonNullableFormBuilder).group({
    nombre: ['', [Validators.required, Validators.minLength(NAME_MIN)]],
    email: ['', [Validators.required, Validators.pattern(EMAIL_PATTERN)]],
    password: [''],
    rolId: [null as number | null, Validators.required],
    sucursalId: [null as number | null, (control: AbstractControl): ValidationErrors | null => this.branchRequired(control)],
    activo: [true],
  });

  protected readonly shieldIcon = LucideShield.icon;
  protected readonly storeIcon = LucideStore.icon;

  protected readonly roleOptions = computed<SelectOption<number>[]>(() =>
    this.roles().map((role) => ({ value: role.id, label: role.nombre, icon: ROLE_ICONS[role.nombre] })),
  );

  /** Sucursales activas, más la actual del usuario aunque esté inactiva (para no perderla al editar). */
  protected readonly branchChoices = computed(() => {
    const current = this.user()?.sucursalId;
    return this.branches().filter((branch) => branch.activa || branch.id === current);
  });

  protected readonly branchOptions = computed<SelectOption<number>[]>(() =>
    this.branchChoices().map((branch) => ({ value: branch.id, label: branch.nombre + (branch.activa ? '' : ' (inactiva)') })),
  );

  constructor() {
    // Cada vez que se abre, el formulario parte de cero (o del usuario a editar).
    effect(() => {
      if (!this.open()) return;
      const user = this.user();
      const roles = this.roles();
      untracked(() => {
        const roleId = user ? (roles.find((role) => role.nombre === user.rol)?.id ?? null) : null;
        this.form.controls.rolId.enable({ emitEvent: false });
        this.form.reset({
          nombre: user?.nombre ?? '',
          email: user?.email ?? '',
          password: '',
          rolId: roleId,
          sucursalId: user?.sucursalId ?? null,
          activo: user?.activo ?? true,
        });
        // La contraseña es obligatoria solo al crear.
        this.form.controls.password.setValidators(user ? [Validators.minLength(PASSWORD_MIN)] : [Validators.required, Validators.minLength(PASSWORD_MIN)]);
        this.form.controls.password.updateValueAndValidity();
        this.selectedRoleId.set(roleId);
        this.lockOwnRole();
        this.serverError.set(null);
      });
    });
    this.form.controls.rolId.valueChanges.pipe(takeUntilDestroyed()).subscribe((roleId) => {
      this.selectedRoleId.set(roleId);
      this.form.controls.sucursalId.updateValueAndValidity();
    });
    this.form.valueChanges.pipe(takeUntilDestroyed()).subscribe(() => this.serverError.set(null));
  }

  protected error(field: 'nombre' | 'email' | 'password' | 'rolId' | 'sucursalId'): string | null {
    const messages = {
      nombre: NAME_MESSAGES,
      email: EMAIL_MESSAGES,
      password: PASSWORD_MESSAGES,
      rolId: ROLE_MESSAGES,
      sucursalId: BRANCH_MESSAGES,
    }[field];
    return controlError(this.form.controls[field], messages);
  }

  protected submit(): void {
    this.form.markAllAsTouched();
    if (this.form.invalid || this.saving()) return;

    const value = this.form.getRawValue();
    const current = this.user();
    const request = {
      nombre: value.nombre,
      email: value.email,
      password: value.password,
      rolId: value.rolId as number,
      sucursalId: this.showBranch() ? value.sucursalId : null,
      ...(current ? { activo: value.activo } : {}),
    };
    const call = current ? this.api.update(current.id, request) : this.api.create(request);

    this.saving.set(true);
    this.form.disable({ emitEvent: false });
    call.subscribe({
      next: (user) => {
        this.saving.set(false);
        this.form.enable({ emitEvent: false });
        this.lockOwnRole();
        this.notifications.success(current ? 'Usuario actualizado correctamente.' : 'Usuario creado correctamente.');
        this.saved.emit(user);
        this.open.set(false);
      },
      error: (error: unknown) => {
        this.saving.set(false);
        this.form.enable({ emitEvent: false });
        this.lockOwnRole();
        const apiError = toApiError(error);
        const applied = apiError.code === 'VALIDATION_FAILED' ? applyServerErrors(this.form, apiError.fieldErrors) : [];
        this.serverError.set(applied.length > 0 ? null : apiError.message);
      },
    });
  }

  /** Con la propia cuenta el rol no se puede cambiar: el select queda deshabilitado. */
  private lockOwnRole(): void {
    if (this.self() && this.user()) this.form.controls.rolId.disable({ emitEvent: false });
  }

  /** Validador de la sucursal: obligatoria solo mientras el campo está visible. */
  private branchRequired(control: AbstractControl): ValidationErrors | null {
    return this.showBranch() && control.value === null ? { required: true } : null;
  }
}
