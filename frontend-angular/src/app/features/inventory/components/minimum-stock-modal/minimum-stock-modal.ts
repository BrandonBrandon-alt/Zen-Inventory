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
import { type InventoryItem, InventoryApi } from '../../data-access/inventory-api';

const MESSAGES = {
  required: 'El stock mínimo es requerido.',
  min: 'El stock mínimo no puede ser negativo.',
} as const;

let nextId = 0;

/** Define el stock mínimo de un producto en la sucursal: por debajo (o igual) se considera crítico y genera alertas. */
@Component({
  selector: 'app-minimum-stock-modal',
  imports: [ReactiveFormsModule, Modal, Button, Alert, FormField, InputDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-modal
      [(open)]="open"
      title="Stock mínimo"
      [description]="product() ? product()!.nombre + ': con esta cantidad o menos el producto se marca como crítico y genera una alerta.' : undefined"
      size="sm"
      [dismissible]="!saving()"
    >
      <form [id]="formId" class="flex flex-col gap-4" [formGroup]="form" novalidate (ngSubmit)="submit()">
        @if (serverError(); as message) {
          <app-alert>{{ message }}</app-alert>
        }
        <app-form-field label="Stock mínimo" [error]="error()">
          <input appInput type="number" inputmode="decimal" min="0" step="any" formControlName="minimum" />
        </app-form-field>
      </form>
      <div data-slot="footer">
        <button appButton variant="ghost" type="button" [disabled]="saving()" (click)="open.set(false)">Cancelar</button>
        <button appButton type="submit" [attr.form]="formId" [loading]="saving()">Guardar</button>
      </div>
    </app-modal>
  `,
})
export class MinimumStockModal {
  private readonly api = inject(InventoryApi);
  private readonly notifications = inject(NotificationService);

  readonly open = model(false);
  readonly product = input<InventoryItem | null>(null);
  readonly branchId = input.required<number>();
  readonly saved = output<void>();

  protected readonly formId = `app-minimum-stock-${nextId++}`;
  protected readonly saving = signal(false);
  protected readonly serverError = signal<string | null>(null);
  protected readonly form = inject(NonNullableFormBuilder).group({
    minimum: [null as number | null, [Validators.required, Validators.min(0)]],
  });

  constructor() {
    effect(() => {
      if (!this.open()) return;
      const product = this.product();
      untracked(() => {
        this.form.reset({ minimum: product?.minimum ?? 0 });
        this.serverError.set(null);
      });
    });
    this.form.valueChanges.pipe(takeUntilDestroyed()).subscribe(() => this.serverError.set(null));
  }

  protected error(): string | null {
    return controlError(this.form.controls.minimum, MESSAGES);
  }

  protected submit(): void {
    this.form.markAllAsTouched();
    const product = this.product();
    if (this.form.invalid || this.saving() || !product) return;

    this.saving.set(true);
    this.form.disable({ emitEvent: false });
    this.api.setMinimum(this.branchId(), product.productId, this.form.getRawValue().minimum as number).subscribe({
      next: () => {
        this.saving.set(false);
        this.form.enable({ emitEvent: false });
        this.notifications.success('Stock mínimo actualizado correctamente.');
        this.saved.emit();
        this.open.set(false);
      },
      error: (error: unknown) => {
        this.saving.set(false);
        this.form.enable({ emitEvent: false });
        const apiError = toApiError(error);
        const applied = apiError.code === 'VALIDATION_FAILED' ? applyServerErrors(this.form, { minimum: apiError.fieldErrors['minimumStock'] ?? apiError.message }) : [];
        this.serverError.set(applied.length > 0 ? null : apiError.message);
      },
    });
  }
}
