import { ChangeDetectionStrategy, Component, computed, effect, inject, input, model, output, signal, untracked } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormArray, FormControl, NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { LucideReceipt } from '@lucide/angular';
import { toApiError } from '@core/api/api-error';
import { AuthStore } from '@core/auth/session/auth-store';
import { NotificationService } from '@core/notifications/notification.service';
import { formatDateTime, formatMoney, formatQuantity } from '@shared/format/format';
import { applyServerErrors } from '@shared/forms/apply-server-errors';
import { controlError } from '@shared/forms/control-error';
import { Alert } from '@shared/ui/alert/alert';
import { Button } from '@shared/ui/button/button';
import { FormField, InputDirective } from '@shared/ui/form-field/form-field';
import { Modal } from '@shared/ui/modal/modal';
import { Select, type SelectOption } from '@shared/ui/select/select';
import { type ReturnRequest, type ReturnableSale, ReturnsApi } from '../../data-access/returns-api';

interface SaleLine {
  readonly productId: number;
  readonly name: string;
  readonly sold: number;
  /** Lo que ya se devolvió o está pendiente de decidir en otras solicitudes de esta venta. */
  readonly processed: number;
  readonly available: number;
  readonly unitPrice: number;
}

const SALE = { required: 'Elige la venta.' };
const REASON = { required: 'Cuéntanos por qué se devuelve.' };

/**
 * Solicitud de devolución sobre una venta. Cada producto muestra cuánto se vendió, cuánto ya se devolvió (o espera
 * decisión) y cuánto queda por devolver: no se puede pedir más. Una solicitud queda pendiente hasta que un gerente la decide.
 */
@Component({
  selector: 'app-return-form-modal',
  imports: [ReactiveFormsModule, Modal, Button, Alert, FormField, InputDirective, Select],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './return-form-modal.html',
})
export class ReturnFormModal {
  private readonly api = inject(ReturnsApi);
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly notifications = inject(NotificationService);
  private readonly session = inject(AuthStore).session;

  readonly open = model(false);
  readonly sales = input<readonly ReturnableSale[]>([]);
  /** Solicitudes que ya existen: de ahí sale lo que ya se devolvió de cada venta. */
  readonly existing = input<readonly ReturnRequest[]>([]);
  /** La solicitud ya creada en el servidor. */
  readonly saved = output<ReturnRequest>();

  protected readonly saving = signal(false);
  protected readonly serverError = signal<string | null>(null);
  protected readonly formatMoney = formatMoney;
  protected readonly formatQuantity = formatQuantity;
  protected readonly receiptIcon = LucideReceipt.icon;

  protected readonly form = this.fb.group({
    saleId: new FormControl<number | null>(null, Validators.required),
    reason: ['', [Validators.required, Validators.pattern(/\S/)]],
    quantities: new FormArray<FormControl<number | null>>([]),
    reasons: new FormArray<FormControl<string>>([]),
  });

  private readonly chosenId = signal<number | null>(null);
  protected readonly sale = computed(() => this.sales().find((s) => s.id === this.chosenId()) ?? null);

  protected readonly saleOptions = computed<SelectOption<number>[]>(() =>
    this.sales().map((s) => ({
      value: s.id,
      label: `Venta #${s.id}`,
      description: [s.customerName || 'Cliente sin registrar', formatMoney(s.total), s.date ? formatDateTime(s.date) : ''].filter(Boolean).join(' · '),
    })),
  );

  /** Los productos de la venta elegida, con lo que queda por devolver de cada uno. */
  protected readonly lines = computed<SaleLine[]>(() => {
    const sale = this.sale();
    if (!sale) return [];
    const processed = new Map<number, number>();
    for (const request of this.existing()) {
      if (request.saleId !== sale.id || request.status === 'RECHAZADA') continue;
      for (const line of request.lines) processed.set(line.productId, (processed.get(line.productId) ?? 0) + line.quantity);
    }
    // Una venta puede repetir un producto en varias líneas: se unen, como hace el servidor.
    const merged = new Map<number, { name: string; sold: number; unitPrice: number }>();
    for (const line of sale.lines) {
      const current = merged.get(line.productId);
      merged.set(line.productId, { name: line.productName, sold: (current?.sold ?? 0) + line.quantity, unitPrice: line.unitPrice });
    }
    return [...merged].map(([productId, m]) => {
      const done = processed.get(productId) ?? 0;
      return { productId, name: m.name, sold: m.sold, processed: done, available: Math.max(0, m.sold - done), unitPrice: m.unitPrice };
    });
  });

  protected readonly nothingToReturn = computed(() => this.sale() !== null && this.lines().every((l) => l.available === 0));

  constructor() {
    effect(() => {
      if (!this.open()) return;
      untracked(() => {
        this.form.reset({ saleId: null, reason: '' }, { emitEvent: false });
        this.chosenId.set(null);
        this.rebuild([]);
        this.serverError.set(null);
      });
    });
    this.form.controls.saleId.valueChanges.pipe(takeUntilDestroyed()).subscribe((id) => {
      this.chosenId.set(id);
      this.rebuild(this.lines());
    });
    this.form.valueChanges.pipe(takeUntilDestroyed()).subscribe(() => this.serverError.set(null));
  }

  protected error(field: 'saleId' | 'reason'): string | null {
    return controlError(this.form.controls[field], field === 'saleId' ? SALE : REASON);
  }

  protected quantityError(index: number): string | null {
    return controlError(this.form.controls.quantities.at(index), { min: 'No puede ser negativa.', max: 'Es más de lo que queda por devolver.', pattern: 'Debe ser un número entero.' });
  }

  protected submit(): void {
    this.form.markAllAsTouched();
    const session = this.session();
    const sale = this.sale();
    if (this.saving() || !sale || !session) return;
    if (this.form.invalid) return;
    const lines = this.lines();
    const quantities = this.form.controls.quantities.getRawValue();
    const reasons = this.form.controls.reasons.getRawValue();
    const items = lines.flatMap((line, i) => ((quantities[i] ?? 0) > 0 ? [{ productId: line.productId, quantity: quantities[i] as number, reason: reasons[i] ?? '', unitPrice: line.unitPrice }] : []));
    if (items.length === 0) {
      this.serverError.set('Indica cuántas unidades se devuelven de al menos un producto.');
      return;
    }

    this.saving.set(true);
    this.form.disable({ emitEvent: false });
    this.api.create({ saleId: sale.id, branchId: sale.branchId, userId: session.id, reason: this.form.controls.reason.value, items }).subscribe({
      next: (request) => {
        this.saving.set(false);
        this.form.enable({ emitEvent: false });
        this.notifications.success(`Devolución #${request.id} solicitada: espera la decisión de un gerente.`);
        this.saved.emit(request);
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

  private rebuild(lines: readonly SaleLine[]): void {
    const quantities = this.form.controls.quantities;
    const reasons = this.form.controls.reasons;
    quantities.clear({ emitEvent: false });
    reasons.clear({ emitEvent: false });
    for (const line of lines) {
      const control = new FormControl<number | null>(0, [Validators.required, Validators.min(0), Validators.max(line.available), Validators.pattern(/^\d+$/)]);
      // Sin unidades por devolver, el campo no se puede editar.
      if (line.available === 0) control.disable({ emitEvent: false });
      quantities.push(control, { emitEvent: false });
      reasons.push(this.fb.control(''), { emitEvent: false });
    }
  }
}
