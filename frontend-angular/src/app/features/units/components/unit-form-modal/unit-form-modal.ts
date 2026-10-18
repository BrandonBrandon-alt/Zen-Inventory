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
import { type Unit, UnitsApi } from '../../data-access/units-api';

const NAME_MAX = 50;
const ABBREVIATION_MAX = 10;

const NAME_MESSAGES: Record<string, string> = {
  required: 'El nombre es requerido.',
  maxlength: `El nombre no puede superar ${NAME_MAX} caracteres.`,
};
const ABBREVIATION_MESSAGES: Record<string, string> = {
  required: 'La abreviatura es requerida.',
  maxlength: `La abreviatura no puede superar ${ABBREVIATION_MAX} caracteres.`,
};

let nextId = 0;

/** Formulario de creación (sin `unit`) o edición (con `unit`) de una unidad de medida, dentro de un modal. */
@Component({
  selector: 'app-unit-form-modal',
  imports: [ReactiveFormsModule, Modal, Button, Alert, FormField, InputDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-modal
      [(open)]="open"
      [title]="unit() ? 'Editar unidad' : 'Nueva unidad'"
      [description]="unit() ? 'Actualiza los datos de la unidad.' : 'Define una nueva unidad de medida.'"
      [dismissible]="!saving()"
    >
      <form [id]="formId" class="flex flex-col gap-4" [formGroup]="form" novalidate (ngSubmit)="submit()">
        @if (serverError(); as message) {
          <app-alert>{{ message }}</app-alert>
        }
        <app-form-field label="Nombre" [error]="error('nombre')">
          <input appInput type="text" formControlName="nombre" autocomplete="off" placeholder="Kilogramo" />
        </app-form-field>
        <app-form-field label="Abreviatura" [error]="error('abreviatura')">
          <input appInput type="text" formControlName="abreviatura" autocomplete="off" placeholder="KG" />
        </app-form-field>
      </form>
      <div data-slot="footer">
        <button appButton variant="ghost" type="button" [disabled]="saving()" (click)="open.set(false)">Cancelar</button>
        <button appButton type="submit" [attr.form]="formId" [loading]="saving()">
          {{ unit() ? 'Guardar cambios' : 'Crear unidad' }}
        </button>
      </div>
    </app-modal>
  `,
})
export class UnitFormModal {
  private readonly api = inject(UnitsApi);
  private readonly notifications = inject(NotificationService);

  readonly open = model(false);
  /** Unidad a editar; sin ella, el formulario crea una nueva. */
  readonly unit = input<Unit | null>(null);
  /** La unidad ya guardada en el servidor. */
  readonly saved = output<Unit>();

  protected readonly formId = `app-unit-form-${nextId++}`;
  protected readonly saving = signal(false);
  protected readonly serverError = signal<string | null>(null);

  protected readonly form = inject(NonNullableFormBuilder).group({
    nombre: ['', [Validators.required, Validators.maxLength(NAME_MAX)]],
    abreviatura: ['', [Validators.required, Validators.maxLength(ABBREVIATION_MAX)]],
  });

  constructor() {
    effect(() => {
      if (!this.open()) return;
      const unit = this.unit();
      untracked(() => {
        this.form.reset({ nombre: unit?.nombre ?? '', abreviatura: unit?.abreviatura ?? '' });
        this.serverError.set(null);
      });
    });
    this.form.valueChanges.pipe(takeUntilDestroyed()).subscribe(() => this.serverError.set(null));
  }

  protected error(field: 'nombre' | 'abreviatura'): string | null {
    return controlError(this.form.controls[field], field === 'nombre' ? NAME_MESSAGES : ABBREVIATION_MESSAGES);
  }

  protected submit(): void {
    this.form.markAllAsTouched();
    if (this.form.invalid || this.saving()) return;

    const input = this.form.getRawValue();
    const current = this.unit();
    const request = current ? this.api.update(current.id, input) : this.api.create(input);

    this.saving.set(true);
    this.form.disable({ emitEvent: false });
    request.subscribe({
      next: (unit) => {
        this.saving.set(false);
        this.form.enable({ emitEvent: false });
        this.notifications.success(current ? 'Unidad actualizada correctamente.' : 'Unidad creada correctamente.');
        this.saved.emit(unit);
        this.open.set(false);
      },
      error: (error: unknown) => {
        this.saving.set(false);
        this.form.enable({ emitEvent: false });
        const apiError = toApiError(error);
        const applied = apiError.code === 'VALIDATION_FAILED' ? applyServerErrors(this.form, apiError.fieldErrors) : [];
        this.serverError.set(applied.length > 0 ? null : apiError.message);
      },
    });
  }
}
