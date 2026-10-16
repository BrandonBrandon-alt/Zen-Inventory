import { ChangeDetectionStrategy, Component, effect, inject, input, model, output, signal, untracked } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { toApiError } from '@core/api/api-error';
import { NotificationService } from '@core/notifications/notification.service';
import { applyServerErrors } from '@shared/forms/apply-server-errors';
import { controlError } from '@shared/forms/control-error';
import { Alert } from '@shared/ui/alert/alert';
import { Button } from '@shared/ui/button/button';
import { FormField, InputDirective } from '@shared/ui/form-field/form-field';
import { Modal } from '@shared/ui/modal/modal';
import { type Branch, BranchesApi } from '../../data-access/branches-api';

const NAME_MIN = 3;
const NAME_MAX = 100;

const NAME_MESSAGES: Record<string, string> = {
  required: 'El nombre es requerido.',
  minlength: `El nombre debe tener entre ${NAME_MIN} y ${NAME_MAX} caracteres.`,
  maxlength: `El nombre debe tener entre ${NAME_MIN} y ${NAME_MAX} caracteres.`,
};
const ADDRESS_MESSAGES: Record<string, string> = { required: 'La dirección es requerida.' };

let nextId = 0;

/** Formulario de creación (sin `branch`) o edición (con `branch`) de una sucursal, dentro de un modal. */
@Component({
  selector: 'app-branch-form-modal',
  imports: [ReactiveFormsModule, Modal, Button, Alert, FormField, InputDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-modal
      [(open)]="open"
      [title]="branch() ? 'Editar sucursal' : 'Nueva sucursal'"
      [description]="branch() ? 'Actualiza los datos de la sucursal.' : 'Completa los datos de la nueva sucursal.'"
      [dismissible]="!saving()"
    >
      <form [id]="formId" class="flex flex-col gap-4" [formGroup]="form" novalidate (ngSubmit)="submit()">
        @if (serverError(); as message) {
          <app-alert>{{ message }}</app-alert>
        }
        <app-form-field label="Nombre" [error]="nameError()">
          <input appInput type="text" formControlName="nombre" autocomplete="off" />
        </app-form-field>
        <app-form-field label="Dirección" [error]="addressError()">
          <input appInput type="text" formControlName="direccion" autocomplete="off" />
        </app-form-field>
        <app-form-field label="Teléfono">
          <input appInput type="tel" formControlName="telefono" autocomplete="off" />
        </app-form-field>
      </form>
      <div data-slot="footer">
        <button appButton variant="ghost" type="button" [disabled]="saving()" (click)="open.set(false)">Cancelar</button>
        <button appButton type="submit" [attr.form]="formId" [loading]="saving()">
          {{ branch() ? 'Guardar cambios' : 'Crear sucursal' }}
        </button>
      </div>
    </app-modal>
  `,
})
export class BranchFormModal {
  private readonly api = inject(BranchesApi);
  private readonly notifications = inject(NotificationService);

  readonly open = model(false);
  /** Sucursal a editar; sin ella, el formulario crea una nueva. */
  readonly branch = input<Branch | null>(null);
  /** La sucursal ya guardada en el servidor. */
  readonly saved = output<Branch>();

  protected readonly formId = `app-branch-form-${nextId++}`;
  protected readonly saving = signal(false);
  protected readonly serverError = signal<string | null>(null);

  protected readonly form = inject(NonNullableFormBuilder).group({
    nombre: ['', [Validators.required, Validators.minLength(NAME_MIN), Validators.maxLength(NAME_MAX)]],
    direccion: ['', Validators.required],
    telefono: [''],
  });

  constructor() {
    // Cada vez que se abre, el formulario parte de cero (o de la sucursal a editar).
    effect(() => {
      if (!this.open()) return;
      const branch = this.branch();
      untracked(() => {
        this.form.reset({
          nombre: branch?.nombre ?? '',
          direccion: branch?.direccion ?? '',
          telefono: branch?.telefono ?? '',
        });
        this.serverError.set(null);
      });
    });
    this.form.valueChanges.pipe(takeUntilDestroyed()).subscribe(() => this.serverError.set(null));
  }

  protected nameError(): string | null {
    return controlError(this.form.controls.nombre, NAME_MESSAGES);
  }

  protected addressError(): string | null {
    return controlError(this.form.controls.direccion, ADDRESS_MESSAGES);
  }

  protected submit(): void {
    this.form.markAllAsTouched();
    if (this.form.invalid || this.saving()) return;

    const input = this.form.getRawValue();
    const current = this.branch();
    const request = current ? this.api.update(current.id, input) : this.api.create(input);

    this.saving.set(true);
    this.form.disable({ emitEvent: false });
    request.subscribe({
      next: (branch) => {
        this.saving.set(false);
        this.form.enable({ emitEvent: false });
        this.notifications.success(current ? 'Sucursal actualizada correctamente.' : 'Sucursal creada correctamente.');
        this.saved.emit(branch);
        this.open.set(false);
      },
      error: (error: unknown) => {
        this.saving.set(false);
        this.form.enable({ emitEvent: false });
        this.showError(error);
      },
    });
  }

  private showError(error: unknown): void {
    const apiError = toApiError(error);
    const applied = apiError.code === 'VALIDATION_FAILED' ? applyServerErrors(this.form, apiError.fieldErrors) : [];
    this.serverError.set(applied.length > 0 ? null : apiError.message);
  }
}
