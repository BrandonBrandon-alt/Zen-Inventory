import { ChangeDetectionStrategy, Component, computed, effect, inject, input, model, output, signal, untracked } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { LucideArrowDownToLine, LucideArrowRight, LucideArrowUpFromLine, LucideDynamicIcon, LucideTriangleAlert } from '@lucide/angular';
import { toApiError } from '@core/api/api-error';
import { NotificationService } from '@core/notifications/notification.service';
import { formatQuantity } from '@shared/format/format';
import { applyServerErrors } from '@shared/forms/apply-server-errors';
import { controlError } from '@shared/forms/control-error';
import { Alert } from '@shared/ui/alert/alert';
import { Button } from '@shared/ui/button/button';
import { FormField, InputDirective } from '@shared/ui/form-field/form-field';
import { Modal } from '@shared/ui/modal/modal';
import { Select } from '@shared/ui/select/select';
import { type TabItem, Tabs } from '@shared/ui/tabs/tabs';
import { type InventoryItem, InventoryApi, type MovementReason, type MovementType } from '../../data-access/inventory-api';
import { GUIDED_REASONS, MANUAL_REASONS, MIN_JUSTIFICATION_LENGTH, SHRINKAGE_CATEGORIES, requiresJustification } from '../../data-access/inventory-labels';

const TYPE_TABS: readonly TabItem[] = [
  { id: 'INGRESO', label: 'Ingreso', icon: LucideArrowDownToLine.icon },
  { id: 'RETIRO', label: 'Retiro', icon: LucideArrowUpFromLine.icon },
];

const MESSAGES = {
  reason: { required: 'Elige un motivo.' },
  subReason: { required: 'Elige la categoría de la merma.' },
  quantity: { required: 'La cantidad es requerida.', min: 'La cantidad debe ser mayor a cero.' },
  unitCost: { min: 'El costo no puede ser negativo.' },
  observations: {
    required: 'Debes justificar el movimiento.',
    minlength: `Justifica con al menos ${MIN_JUSTIFICATION_LENGTH} caracteres.`,
  },
} as const;

let nextId = 0;

/** Ajuste manual de existencias de un producto: ingreso o retiro, con su motivo y la justificación que queda en el kardex. */
@Component({
  selector: 'app-adjust-stock-modal',
  imports: [ReactiveFormsModule, Modal, Button, Alert, FormField, InputDirective, Select, Tabs, LucideArrowRight, LucideDynamicIcon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-modal
      [(open)]="open"
      title="Ajustar stock"
      [description]="product() ? product()!.nombre + ' · Existencias: ' + stockText() : undefined"
      [dismissible]="!saving()"
    >
      <form [id]="formId" class="flex flex-col gap-4" [formGroup]="form" novalidate (ngSubmit)="submit()">
        @if (serverError(); as message) {
          <app-alert>{{ message }}</app-alert>
        }

        <app-tabs [tabs]="typeTabs" [active]="type()" (activeChange)="setType($event)" idPrefix="adjust" ariaLabel="Tipo de movimiento" />

        <app-form-field label="Motivo" [error]="error('reason')">
          <app-select formControlName="reason" [options]="reasonOptions()" placeholder="Selecciona un motivo" />
        </app-form-field>

        @if (guided(); as g) {
          <section class="flex flex-col items-center gap-3 rounded-lg border border-line bg-surface p-5 text-center" aria-live="polite">
            <span class="flex size-10 items-center justify-center rounded-full bg-brand/15 text-brand">
              <svg [lucideIcon]="g.icon!" [size]="20" aria-hidden="true"></svg>
            </span>
            <h3 class="font-title text-base font-bold text-fg">Este movimiento se registra en otra pantalla</h3>
            <p class="max-w-prose text-sm text-fg-muted">{{ g.explanation }}</p>
            <button appButton type="button" (click)="goTo(g.path)">
              {{ g.action }}
              <svg lucideArrowRight [size]="16" aria-hidden="true"></svg>
            </button>
          </section>
        } @else {
        @if (isShrinkage()) {
          <app-form-field label="Categoría de la merma" [error]="error('subReason')">
            <app-select formControlName="subReason" [options]="categories" [icon]="warningIcon" placeholder="Selecciona una categoría" />
          </app-form-field>
        }

        <app-form-field [label]="type() === 'INGRESO' ? 'Cantidad a ingresar' : 'Cantidad a retirar'" [error]="error('quantity')">
          <input appInput type="number" inputmode="decimal" min="0" step="any" formControlName="quantity" />
        </app-form-field>
        @if (resulting() !== null) {
          <p class="-mt-2 text-xs text-fg-subtle" [class.text-danger]="resulting()! < 0">
            Quedaría en {{ formatQuantity(resulting()) }} {{ product()?.unit }}
          </p>
        }

        @if (showCost()) {
          <app-form-field label="Costo unitario (opcional)" [error]="error('unitCost')">
            <input appInput type="number" inputmode="decimal" min="0" step="any" formControlName="unitCost" />
          </app-form-field>
        }

        <app-form-field [label]="justificationRequired() ? 'Justificación' : 'Observaciones (opcional)'" [error]="error('observations')">
          <textarea appInput rows="3" formControlName="observations" [attr.maxlength]="500"></textarea>
        </app-form-field>
        }
      </form>
      <div data-slot="footer">
        <button appButton variant="ghost" type="button" [disabled]="saving()" (click)="open.set(false)">Cancelar</button>
        @if (!guided()) {
          <button appButton type="submit" [attr.form]="formId" [loading]="saving()">Registrar movimiento</button>
        }
      </div>
    </app-modal>
  `,
})
export class AdjustStockModal {
  private readonly api = inject(InventoryApi);
  private readonly notifications = inject(NotificationService);
  private readonly router = inject(Router);

  readonly open = model(false);
  readonly product = input<InventoryItem | null>(null);
  readonly branchId = input.required<number>();
  /** El movimiento quedó registrado. */
  readonly saved = output<void>();

  protected readonly typeTabs = TYPE_TABS;
  protected readonly categories = SHRINKAGE_CATEGORIES;
  protected readonly warningIcon = LucideTriangleAlert.icon;
  protected readonly formatQuantity = formatQuantity;
  protected readonly formId = `app-adjust-stock-${nextId++}`;
  protected readonly saving = signal(false);
  protected readonly serverError = signal<string | null>(null);
  protected readonly type = signal<MovementType>('INGRESO');
  private readonly reasonValue = signal<MovementReason | null>(null);
  private readonly quantityValue = signal<number | null>(null);

  protected readonly form = inject(NonNullableFormBuilder).group({
    reason: [null as MovementReason | null, Validators.required],
    subReason: [null as string | null],
    quantity: [null as number | null, [Validators.required, Validators.min(0.0001)]],
    unitCost: [null as number | null, Validators.min(0)],
    observations: [''],
  });

  protected readonly reasonOptions = computed(() => [...MANUAL_REASONS[this.type()], ...GUIDED_REASONS[this.type()]]);
  /** El motivo elegido se registra en otra pantalla: en vez del formulario se muestra a dónde ir. */
  protected readonly guided = computed(() => GUIDED_REASONS[this.type()].find((g) => g.value === this.reasonValue()) ?? null);
  protected readonly isShrinkage = computed(() => this.reasonValue() === 'MERMA');
  protected readonly justificationRequired = computed(() => requiresJustification(this.reasonValue()));
  /** El costo solo se ofrece en ingresos por ajuste: una devolución de cliente no es una compra y no altera el costo promedio. */
  protected readonly showCost = computed(() => this.type() === 'INGRESO' && this.reasonValue() === 'AJUSTE_POSITIVO');
  protected readonly stockText = computed(() => `${formatQuantity(this.product()?.stock)} ${this.product()?.unit ?? ''}`.trim());
  protected readonly resulting = computed(() => {
    const product = this.product();
    const quantity = this.quantityValue();
    if (!product || quantity === null || !(quantity > 0)) return null;
    return this.type() === 'INGRESO' ? product.stock + quantity : product.stock - quantity;
  });

  constructor() {
    // Cada vez que se abre, parte de cero con un ingreso.
    effect(() => {
      if (!this.open()) return;
      this.product();
      untracked(() => {
        this.type.set('INGRESO');
        this.resetForm();
        this.serverError.set(null);
      });
    });
    this.form.controls.reason.valueChanges.pipe(takeUntilDestroyed()).subscribe((reason) => {
      this.reasonValue.set(reason);
      this.syncValidators();
    });
    this.form.controls.quantity.valueChanges.pipe(takeUntilDestroyed()).subscribe((quantity) => this.quantityValue.set(quantity));
    this.form.valueChanges.pipe(takeUntilDestroyed()).subscribe(() => this.serverError.set(null));
  }

  protected goTo(path: string): void {
    this.open.set(false);
    void this.router.navigateByUrl(path);
  }

  protected setType(id: string): void {
    this.type.set(id as MovementType);
    // El motivo y la categoría de un tipo no valen para el otro.
    this.form.patchValue({ reason: MANUAL_REASONS[this.type()][0].value, subReason: null });
  }

  protected error(field: keyof typeof MESSAGES): string | null {
    return controlError(this.form.controls[field], MESSAGES[field]);
  }

  private resetForm(): void {
    this.form.reset({ reason: MANUAL_REASONS.INGRESO[0].value, subReason: null, quantity: null, unitCost: null, observations: '' });
    this.reasonValue.set(MANUAL_REASONS.INGRESO[0].value);
    this.quantityValue.set(null);
    this.syncValidators();
  }

  /** La categoría solo se exige en mermas y la justificación (de longitud mínima) en ajustes y mermas. */
  private syncValidators(): void {
    const { subReason, observations } = this.form.controls;
    subReason.setValidators(this.isShrinkage() ? Validators.required : null);
    observations.setValidators(
      this.justificationRequired()
        ? [Validators.required, (c) => ((c.value as string).trim().length < MIN_JUSTIFICATION_LENGTH ? { minlength: true } : null)]
        : null,
    );
    subReason.updateValueAndValidity({ emitEvent: false });
    observations.updateValueAndValidity({ emitEvent: false });
  }

  protected submit(): void {
    this.form.markAllAsTouched();
    const product = this.product();
    if (this.form.invalid || this.saving() || !product || this.guided()) return;

    const value = this.form.getRawValue();
    const type = this.type();
    this.saving.set(true);
    this.form.disable({ emitEvent: false });
    this.api
      .adjust(this.branchId(), product.productId, {
        type,
        quantity: value.quantity as number,
        reason: value.reason as MovementReason,
        observations: value.observations,
        ...(this.isShrinkage() && value.subReason ? { subReason: value.subReason } : {}),
        ...(this.showCost() && value.unitCost !== null ? { unitCost: value.unitCost } : {}),
      })
      .subscribe({
        next: () => {
          this.saving.set(false);
          this.form.enable({ emitEvent: false });
          this.notifications.success(type === 'INGRESO' ? 'Ingreso registrado correctamente.' : 'Retiro registrado correctamente.');
          this.saved.emit();
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
