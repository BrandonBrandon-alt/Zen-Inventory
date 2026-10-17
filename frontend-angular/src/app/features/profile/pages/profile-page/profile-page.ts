import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { type AbstractControl, NonNullableFormBuilder, ReactiveFormsModule, type ValidationErrors, Validators } from '@angular/forms';
import { LucideImagePlus, LucideTrash2 } from '@lucide/angular';
import { catchError, map, of, switchMap } from 'rxjs';
import { toApiError } from '@core/api/api-error';
import { BranchOptionsApi } from '@core/branches/branch-options-api';
import { AuthStore } from '@core/auth/session/auth-store';
import { NotificationService } from '@core/notifications/notification.service';
import { applyServerErrors } from '@shared/forms/apply-server-errors';
import { controlError } from '@shared/forms/control-error';
import { Alert } from '@shared/ui/alert/alert';
import { UserAvatar } from '@shared/ui/avatar/user-avatar';
import { Badge } from '@shared/ui/badge/badge';
import { Button } from '@shared/ui/button/button';
import { Card } from '@shared/ui/card/card';
import { FormField, InputDirective } from '@shared/ui/form-field/form-field';
import { PasswordToggle } from '@shared/ui/password-toggle/password-toggle';
import { AVATAR_MAX_BYTES, AVATAR_TYPES, type Profile, ProfileApi } from '../../data-access/profile-api';

const NAME_MIN = 3;
const NAME_MAX = 100;
const PASSWORD_MIN = 6;

const NAME_MESSAGES: Record<string, string> = {
  required: 'El nombre es requerido.',
  minlength: `El nombre debe tener al menos ${NAME_MIN} caracteres.`,
  maxlength: `El nombre no puede superar ${NAME_MAX} caracteres.`,
};
const CURRENT_MESSAGES: Record<string, string> = { required: 'Escribe tu contraseña actual.' };
const NEW_MESSAGES: Record<string, string> = {
  required: 'Escribe la contraseña nueva.',
  minlength: `Mínimo ${PASSWORD_MIN} caracteres.`,
  sameAsCurrent: 'La contraseña nueva debe ser distinta de la actual.',
};
const CONFIRM_MESSAGES: Record<string, string> = { required: 'Repite la contraseña nueva.', mismatch: 'Las contraseñas no coinciden.' };

@Component({
  selector: 'app-profile-page',
  imports: [ReactiveFormsModule, Alert, Badge, Button, Card, FormField, InputDirective, PasswordToggle, UserAvatar, LucideImagePlus, LucideTrash2],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block p-(--page-padding)' },
  templateUrl: './profile-page.html',
})
export class ProfilePage {
  private readonly api = inject(ProfileApi);
  private readonly auth = inject(AuthStore);
  private readonly notifications = inject(NotificationService);
  private readonly branchApi = inject(BranchOptionsApi);

  protected readonly session = this.auth.session;
  protected readonly acceptedTypes = AVATAR_TYPES.join(',');

  /** Ámbito del usuario: "Gestión Global" para el ADMIN; para el resto, el nombre de su sucursal. */
  protected readonly branchLabel = toSignal(
    toObservable(this.session).pipe(
      switchMap((current) => {
        if (current?.rol === 'ADMIN') return of('Gestión Global');
        const branchId = current?.sucursalId;
        if (branchId === undefined) return of('Sin sucursal');
        return this.branchApi.list().pipe(
          map((branches) => branches.find((branch) => branch.id === branchId)?.nombre ?? 'Sin sucursal'),
          catchError(() => of('Sin sucursal')),
        );
      }),
    ),
    { initialValue: '' },
  );

  // ---- Foto ----
  protected readonly photoBusy = signal(false);
  protected readonly photoError = signal<string | null>(null);
  protected readonly hasPhoto = computed(() => !!this.session()?.avatarVersion);

  // ---- Nombre ----
  protected readonly nameSaving = signal(false);
  protected readonly nameError = signal<string | null>(null);
  protected readonly nameForm = inject(NonNullableFormBuilder).group({
    nombre: [this.session()?.nombre ?? '', [Validators.required, Validators.minLength(NAME_MIN), Validators.maxLength(NAME_MAX)]],
  });

  // ---- Contraseña ----
  protected readonly passwordSaving = signal(false);
  protected readonly passwordError = signal<string | null>(null);
  protected readonly showCurrent = signal(false);
  protected readonly showNew = signal(false);
  protected readonly passwordForm = inject(NonNullableFormBuilder).group(
    {
      actual: ['', Validators.required],
      nueva: ['', [Validators.required, Validators.minLength(PASSWORD_MIN)]],
      confirmar: ['', Validators.required],
    },
    { validators: [(group: AbstractControl) => this.passwordRules(group)] },
  );

  protected nameFieldError(): string | null {
    return controlError(this.nameForm.controls.nombre, NAME_MESSAGES);
  }

  protected passwordFieldError(field: 'actual' | 'nueva' | 'confirmar'): string | null {
    const control = this.passwordForm.controls[field];
    const messages = { actual: CURRENT_MESSAGES, nueva: NEW_MESSAGES, confirmar: CONFIRM_MESSAGES }[field];
    const own = controlError(control, messages);
    if (own) return own;
    // Los errores cruzados (distinta de la actual, coincide con la confirmación) viven en el grupo.
    const group = this.passwordForm.errors;
    if (!control.touched || !group) return null;
    if (field === 'nueva' && group['sameAsCurrent']) return NEW_MESSAGES['sameAsCurrent'];
    if (field === 'confirmar' && group['mismatch']) return CONFIRM_MESSAGES['mismatch'];
    return null;
  }

  protected chooseFile(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = ''; // permite elegir de nuevo el mismo archivo
    if (!file) return;
    this.photoError.set(null);
    if (!AVATAR_TYPES.includes(file.type)) {
      this.photoError.set('Elige una imagen JPG, PNG o GIF.');
      return;
    }
    if (file.size > AVATAR_MAX_BYTES) {
      this.photoError.set('La imagen pesa más de 5 MB. Elige una más liviana.');
      return;
    }
    this.photoBusy.set(true);
    this.api.uploadAvatar(file).subscribe({
      next: (profile) => this.photoDone(profile, 'Foto actualizada.'),
      error: (error: unknown) => this.photoFailed(error),
    });
  }

  protected removePhoto(): void {
    if (this.photoBusy()) return;
    this.photoError.set(null);
    this.photoBusy.set(true);
    this.api.removeAvatar().subscribe({
      next: (profile) => this.photoDone(profile, 'Foto eliminada.'),
      error: (error: unknown) => this.photoFailed(error),
    });
  }

  protected saveName(): void {
    this.nameForm.markAllAsTouched();
    if (this.nameForm.invalid || this.nameSaving()) return;
    this.nameError.set(null);
    this.nameSaving.set(true);
    this.api.updateName(this.nameForm.getRawValue().nombre).subscribe({
      next: (profile) => {
        this.nameSaving.set(false);
        this.auth.update({ nombre: profile.nombre });
        this.nameForm.reset({ nombre: profile.nombre });
        this.notifications.success('Nombre actualizado.');
      },
      error: (error: unknown) => {
        this.nameSaving.set(false);
        const apiError = toApiError(error);
        const applied = apiError.code === 'VALIDATION_FAILED' ? applyServerErrors(this.nameForm, apiError.fieldErrors) : [];
        this.nameError.set(applied.length > 0 ? null : apiError.message);
      },
    });
  }

  protected savePassword(): void {
    this.passwordForm.markAllAsTouched();
    if (this.passwordForm.invalid || this.passwordSaving()) return;
    this.passwordError.set(null);
    this.passwordSaving.set(true);
    const { actual, nueva } = this.passwordForm.getRawValue();
    this.api.changePassword(actual, nueva).subscribe({
      next: () => {
        this.passwordSaving.set(false);
        this.passwordForm.reset();
        this.notifications.success('Contraseña actualizada.');
      },
      error: (error: unknown) => {
        this.passwordSaving.set(false);
        const apiError = toApiError(error);
        const applied = apiError.code === 'VALIDATION_FAILED' ? applyServerErrors(this.passwordForm, apiError.fieldErrors) : [];
        this.passwordError.set(applied.length > 0 ? null : apiError.message);
      },
    });
  }

  private photoDone(profile: Profile, message: string): void {
    this.photoBusy.set(false);
    // `avatarVersion` ausente al quitar la foto: la sesión vuelve a las iniciales.
    this.auth.update({ avatarVersion: profile.avatarVersion ?? undefined });
    this.notifications.success(message);
  }

  private photoFailed(error: unknown): void {
    this.photoBusy.set(false);
    this.photoError.set(toApiError(error).message);
  }

  /** Reglas entre campos: la nueva contraseña no es la actual y la confirmación coincide. */
  private passwordRules(group: AbstractControl): ValidationErrors | null {
    const actual = group.get('actual')?.value as string | undefined;
    const nueva = group.get('nueva')?.value as string | undefined;
    const confirmar = group.get('confirmar')?.value as string | undefined;
    const errors: ValidationErrors = {};
    if (actual && nueva && actual === nueva) errors['sameAsCurrent'] = true;
    if (nueva && confirmar && nueva !== confirmar) errors['mismatch'] = true;
    return Object.keys(errors).length > 0 ? errors : null;
  }
}
