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
import { type Supplier, SuppliersApi } from '../../data-access/suppliers-api';

const NAME_MAX = 150;
const CONTACT_MAX = 150;

const NAME_MESSAGES: Record<string, string> = {
  required: 'El nombre es requerido.',
  maxlength: `El nombre no puede superar ${NAME_MAX} caracteres.`,
};
const CONTACT_MESSAGES: Record<string, string> = { maxlength: `El contacto no puede superar ${CONTACT_MAX} caracteres.` };
const DAYS_MESSAGES: Record<string, string> = { min: 'Los días de entrega no pueden ser negativos.' };

let nextId = 0;

/** Formulario de creación (sin `supplier`) o edición (con `supplier`) de un proveedor, dentro de un modal. */
@Component({
  selector: 'app-supplier-form-modal',
  imports: [ReactiveFormsModule, Modal, Button, Alert, FormField, InputDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-modal
      [(open)]="open"
      [title]="supplier() ? 'Editar proveedor' : 'Nuevo proveedor'"
      [description]="supplier() ? 'Actualiza los datos del proveedor.' : 'Registra un nuevo proveedor.'"
      [dismissible]="!saving()"
    >
      <form [id]="formId" class="flex flex-col gap-4" [formGroup]="form" novalidate (ngSubmit)="submit()">
        @if (serverError(); as message) {
          <app-alert>{{ message }}</app-alert>
        }
        <app-form-field label="Nombre" [error]="error('nombre')">
          <input appInput type="text" formControlName="nombre" autocomplete="off" />
        </app-form-field>
        <app-form-field label="Contacto (teléfono o correo)" [error]="error('contacto')">
          <input appInput type="text" formControlName="contacto" autocomplete="off" />
        </app-form-field>
        <app-form-field label="Tiempo de entrega (días)" [error]="error('tiempoEntregaDias')">
          <input appInput type="number" min="0" step="1" inputmode="numeric" formControlName="tiempoEntregaDias" />
        </app-form-field>
      </form>
      <div data-slot="footer">
        <button appButton variant="ghost" type="button" [disabled]="saving()" (click)="open.set(false)">Cancelar</button>
        <button appButton type="submit" [attr.form]="formId" [loading]="saving()">
          {{ supplier() ? 'Guardar cambios' : 'Crear proveedor' }}
        </button>
      </div>
    </app-modal>
  `,
})
export class SupplierFormModal {
  private readonly api = inject(SuppliersApi);
  private readonly notifications = inject(NotificationService);

  readonly open = model(false);
  /** Proveedor a editar; sin él, el formulario crea uno nuevo. */
  readonly supplier = input<Supplier | null>(null);
  /** El proveedor ya guardado en el servidor. */
  readonly saved = output<Supplier>();

  protected readonly formId = `app-supplier-form-${nextId++}`;
  protected readonly saving = signal(false);
  protected readonly serverError = signal<string | null>(null);

  protected readonly form = inject(NonNullableFormBuilder).group({
    nombre: ['', [Validators.required, Validators.maxLength(NAME_MAX)]],
    contacto: ['', Validators.maxLength(CONTACT_MAX)],
    tiempoEntregaDias: [null as number | null, Validators.min(0)],
  });

  constructor() {
    effect(() => {
      if (!this.open()) return;
      const supplier = this.supplier();
      untracked(() => {
        this.form.reset({
          nombre: supplier?.nombre ?? '',
          contacto: supplier?.contacto ?? '',
          tiempoEntregaDias: supplier?.tiempoEntregaDias ?? null,
        });
        this.serverError.set(null);
      });
    });
    this.form.valueChanges.pipe(takeUntilDestroyed()).subscribe(() => this.serverError.set(null));
  }

  protected error(field: 'nombre' | 'contacto' | 'tiempoEntregaDias'): string | null {
    const messages = { nombre: NAME_MESSAGES, contacto: CONTACT_MESSAGES, tiempoEntregaDias: DAYS_MESSAGES }[field];
    return controlError(this.form.controls[field], messages);
  }

  protected submit(): void {
    this.form.markAllAsTouched();
    if (this.form.invalid || this.saving()) return;

    const input = this.form.getRawValue();
    const current = this.supplier();
    const request = current ? this.api.update(current.id, input) : this.api.create(input);

    this.saving.set(true);
    this.form.disable({ emitEvent: false });
    request.subscribe({
      next: (saved) => {
        this.saving.set(false);
        this.form.enable({ emitEvent: false });
        this.notifications.success(current ? 'Proveedor actualizado correctamente.' : 'Proveedor creado correctamente.');
        this.saved.emit(saved);
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
