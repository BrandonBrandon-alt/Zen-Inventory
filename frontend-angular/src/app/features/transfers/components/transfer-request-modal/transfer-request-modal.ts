import { ChangeDetectionStrategy, Component, computed, effect, inject, input, model, output, signal, untracked } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormArray, FormControl, NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { LucidePackage, LucidePlus, LucideStore, LucideTrash2 } from '@lucide/angular';
import { toApiError } from '@core/api/api-error';
import type { BranchOption } from '@core/branches/branch-options-api';
import type { ProductOption } from '@core/catalog/catalog-options-api';
import { NotificationService } from '@core/notifications/notification.service';
import { applyServerErrors } from '@shared/forms/apply-server-errors';
import { controlError } from '@shared/forms/control-error';
import { Alert } from '@shared/ui/alert/alert';
import { Button } from '@shared/ui/button/button';
import { DatePicker } from '@shared/ui/date-picker/date-picker';
import { FormField, InputDirective } from '@shared/ui/form-field/form-field';
import { Modal } from '@shared/ui/modal/modal';
import { Select, type SelectOption } from '@shared/ui/select/select';
import { Tooltip } from '@shared/ui/tooltip/tooltip';
import { PRIORITY_INFO } from '../../data-access/transfer-labels';
import { type Transfer, type TransferPriority, TransfersApi } from '../../data-access/transfers-api';

const REQUIRED_BRANCH = { required: 'Elige una sucursal.' };
const REQUIRED_PRODUCT = { required: 'Elige un producto.' };
const QUANTITY = { required: 'Escribe la cantidad.', min: 'Debe ser mayor que 0.', pattern: 'Debe ser un número entero.' };

const PRIORITIES: readonly SelectOption<TransferPriority>[] = (['HIGH', 'NORMAL', 'LOW'] as const).map((value) => ({
  value,
  label: PRIORITY_INFO[value].label,
}));

let nextId = 0;

function itemGroup(fb: NonNullableFormBuilder) {
  return fb.group({
    productId: new FormControl<number | null>(null, Validators.required),
    quantity: new FormControl<number | null>(null, [Validators.required, Validators.min(1), Validators.pattern(/^\d+$/)]),
  });
}
type ItemGroup = ReturnType<typeof itemGroup>;

/**
 * Solicitud de traslado: se pide mercancía de otra sucursal (origen) hacia la propia (destino).
 *
 * - `ownBranchId`: quien no es ADMIN solo pide hacia su sucursal, así que el destino queda fijo.
 * - Un gerente o administrador deja el traslado aprobado en destino desde el primer momento; el servidor lo decide.
 */
@Component({
  selector: 'app-transfer-request-modal',
  imports: [ReactiveFormsModule, Modal, Button, Alert, FormField, InputDirective, DatePicker, Select, Tooltip, LucidePlus, LucideTrash2],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './transfer-request-modal.html',
})
export class TransferRequestModal {
  private readonly api = inject(TransfersApi);
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly notifications = inject(NotificationService);

  readonly open = model(false);
  readonly branches = input<readonly BranchOption[]>([]);
  readonly products = input<readonly ProductOption[]>([]);
  /** Sucursal del usuario; `null` para el ADMIN, que elige el destino. */
  readonly ownBranchId = input<number | null>(null);
  /** El traslado ya creado en el servidor. */
  readonly saved = output<Transfer>();

  protected readonly formId = `app-transfer-form-${nextId++}`;
  protected readonly saving = signal(false);
  protected readonly serverError = signal<string | null>(null);
  protected readonly storeIcon = LucideStore.icon;
  protected readonly productIcon = LucidePackage.icon;
  protected readonly priorities = PRIORITIES;

  protected readonly form = this.fb.group({
    originBranchId: new FormControl<number | null>(null, Validators.required),
    destinationBranchId: new FormControl<number | null>(null, Validators.required),
    priority: this.fb.control<TransferPriority>('NORMAL'),
    estimatedArrival: new FormControl<Date | null>(null),
    items: new FormArray<ItemGroup>([]),
  });

  private readonly destination = signal<number | null>(null);
  private readonly origin = signal<number | null>(null);

  protected readonly destinationLocked = computed(() => this.ownBranchId() !== null);

  protected readonly originOptions = computed<SelectOption<number>[]>(() =>
    this.branches()
      .filter((b) => b.activa && b.id !== this.destination())
      .map((b) => ({ value: b.id, label: b.nombre })),
  );
  protected readonly destinationOptions = computed<SelectOption<number>[]>(() =>
    this.branches()
      .filter((b) => b.activa && b.id !== this.origin())
      .map((b) => ({ value: b.id, label: b.nombre })),
  );

  /** Un producto ya pedido en otra fila no se ofrece otra vez. */
  protected productOptions(row: ItemGroup): SelectOption<number>[] {
    const own = row.controls.productId.value;
    const taken = new Set(this.form.controls.items.controls.map((g) => g.controls.productId.value));
    return this.products().map((p) => ({
      value: p.id,
      label: p.nombre,
      description: p.sku || undefined,
      disabled: p.id !== own && taken.has(p.id),
    }));
  }

  /** Mínimo de la fecha estimada: el momento en que se abre el formulario (el servidor no acepta fechas pasadas). */
  protected readonly now = signal(new Date());

  constructor() {
    effect(() => {
      if (!this.open()) return;
      const own = this.ownBranchId();
      untracked(() => {
        this.form.controls.items.clear({ emitEvent: false });
        this.form.reset({ originBranchId: null, destinationBranchId: own, priority: 'NORMAL', estimatedArrival: null }, { emitEvent: false });
        this.now.set(new Date());
        this.destination.set(own);
        this.origin.set(null);
        this.addItem();
        this.serverError.set(null);
      });
    });
    this.form.controls.originBranchId.valueChanges.pipe(takeUntilDestroyed()).subscribe((id) => this.origin.set(id));
    this.form.controls.destinationBranchId.valueChanges.pipe(takeUntilDestroyed()).subscribe((id) => this.destination.set(id));
    this.form.valueChanges.pipe(takeUntilDestroyed()).subscribe(() => this.serverError.set(null));
  }

  protected branchError(field: 'originBranchId' | 'destinationBranchId'): string | null {
    return controlError(this.form.controls[field], REQUIRED_BRANCH);
  }

  protected itemError(row: ItemGroup, field: 'productId' | 'quantity'): string | null {
    return controlError(row.controls[field], field === 'productId' ? REQUIRED_PRODUCT : QUANTITY);
  }

  protected addItem(): void {
    this.form.controls.items.push(itemGroup(this.fb));
  }

  protected removeItem(index: number): void {
    this.form.controls.items.removeAt(index);
  }

  protected submit(): void {
    this.form.markAllAsTouched();
    if (this.saving()) return;
    if (this.form.controls.items.length === 0) {
      this.serverError.set('Agrega al menos un producto al traslado.');
      return;
    }
    if (this.form.invalid) return;
    const v = this.form.getRawValue();

    this.saving.set(true);
    this.form.disable({ emitEvent: false });
    this.api
      .request({
        originBranchId: v.originBranchId as number,
        destinationBranchId: v.destinationBranchId as number,
        priority: v.priority,
        estimatedArrival: v.estimatedArrival,
        items: v.items.map((i) => ({ productId: i.productId as number, quantity: i.quantity as number })),
      })
      .subscribe({
        next: (transfer) => {
          this.saving.set(false);
          this.form.enable({ emitEvent: false });
          this.notifications.success(`Traslado #${transfer.id} solicitado.`);
          this.saved.emit(transfer);
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
