import { ChangeDetectionStrategy, Component, computed, effect, inject, input, model, output, signal, untracked } from '@angular/core';
import { FormArray, FormControl, NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { firstValueFrom, type Observable } from 'rxjs';
import type { Role } from '@core/auth/roles/role';
import { toApiError } from '@core/api/api-error';
import { NotificationService } from '@core/notifications/notification.service';
import { formatDateTime, formatMoney, formatQuantity } from '@shared/format/format';
import { controlError } from '@shared/forms/control-error';
import { Alert } from '@shared/ui/alert/alert';
import { Badge } from '@shared/ui/badge/badge';
import { Button } from '@shared/ui/button/button';
import { FormField, InputDirective } from '@shared/ui/form-field/form-field';
import { Modal } from '@shared/ui/modal/modal';
import { Select, type SelectOption } from '@shared/ui/select/select';
import { PAYMENT_INFO, PAYMENT_METHOD_LABELS, RECEPTION_INFO } from '../../data-access/purchase-labels';
import { purchaseActions } from '../../data-access/purchase-permissions';
import { PAYMENT_METHODS, type PaymentMethod, type Purchase, type PurchaseLine, PurchasesApi, type Receipt } from '../../data-access/purchases-api';

type Mode = 'view' | 'receive' | 'cancel' | 'receipt' | 'pay';

/** Lo que falta por recibir de una línea (una orden parcialmente recibida ya trae parte). */
export const pendingOf = (line: PurchaseLine): number => Math.max(0, line.quantity - line.received);

const QUANTITY = { required: 'Escribe la cantidad.', min: 'No puede ser negativa.', max: 'Es más de lo que falta por recibir.' };
const REASON = { required: 'Cuéntanos el motivo.' };
const AMOUNT = { required: 'Escribe cuánto se pagó.', min: 'Debe ser mayor que cero.', max: 'Es más de lo que se debe.' };

/**
 * Detalle de una orden de compra y lo que se puede hacer con ella según su estado y el rol de quien la mira.
 * Recibir y cancelar piden datos dentro del mismo diálogo; al recibir se muestra cómo cambió el costo promedio.
 */
@Component({
  selector: 'app-purchase-detail-modal',
  imports: [ReactiveFormsModule, Modal, Button, Alert, Badge, FormField, InputDirective, Select],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './purchase-detail-modal.html',
})
export class PurchaseDetailModal {
  private readonly api = inject(PurchasesApi);
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly notifications = inject(NotificationService);

  readonly open = model(false);
  readonly purchase = input<Purchase | null>(null);
  readonly role = input<Role | null>(null);
  readonly supplierName = input('');
  readonly branchName = input('');
  /** Nombre de cada producto por su id. */
  readonly productNames = input<ReadonlyMap<number, string>>(new Map());
  /** La orden cambió en el servidor: la lista debe recargarse. */
  readonly changed = output<void>();

  protected readonly mode = signal<Mode>('view');
  protected readonly busy = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly receipt = signal<Receipt | null>(null);

  protected readonly formatDateTime = formatDateTime;
  protected readonly formatMoney = formatMoney;
  protected readonly formatQuantity = formatQuantity;
  protected readonly pending = pendingOf;
  protected readonly receptionInfo = RECEPTION_INFO;
  protected readonly paymentInfo = PAYMENT_INFO;
  protected readonly methodLabels = PAYMENT_METHOD_LABELS;
  protected readonly methodOptions: readonly SelectOption<PaymentMethod>[] = PAYMENT_METHODS.map((value) => ({ value, label: PAYMENT_METHOD_LABELS[value] }));

  protected readonly actions = computed(() => {
    const purchase = this.purchase();
    return purchase ? purchaseActions(purchase, this.role()) : null;
  });

  private readonly purchaseId = computed(() => this.purchase()?.id ?? null);

  protected readonly receiveForm = this.fb.group({ received: new FormArray<FormControl<number | null>>([]) });
  protected readonly reasonForm = this.fb.group({ reason: ['', Validators.required] });
  protected readonly payForm = this.fb.group({
    amount: new FormControl<number | null>(null, [Validators.required, Validators.min(0.01)]),
    method: this.fb.control<PaymentMethod>('TRANSFERENCIA'),
    reference: ['', Validators.maxLength(100)],
    notes: ['', Validators.maxLength(500)],
  });

  constructor() {
    // Solo al abrir (o al cambiar de orden): la lista se recarga mientras se ve el resultado de una recepción, y ese
    // refresco no debe devolver el diálogo a la vista de detalle.
    effect(() => {
      if (!this.open()) return;
      this.purchaseId();
      untracked(() => {
        this.mode.set('view');
        this.error.set(null);
        this.receipt.set(null);
        const purchase = this.purchase();
        if (purchase) this.resetForms(purchase);
      });
    });
  }

  protected title(): string {
    const purchase = this.purchase();
    return purchase ? `Orden de compra #${purchase.id}` : 'Orden de compra';
  }

  protected productName(id: number): string {
    return this.productNames().get(id) ?? `Producto ${id}`;
  }

  protected lineError(index: number): string | null {
    return controlError(this.receiveForm.controls.received.at(index), QUANTITY);
  }

  protected amountError(): string | null {
    return controlError(this.payForm.controls.amount, AMOUNT);
  }

  protected reasonError(): string | null {
    return controlError(this.reasonForm.controls.reason, REASON);
  }

  protected goto(mode: Mode): void {
    this.error.set(null);
    this.mode.set(mode);
  }

  protected submitLabel(): string {
    const mode = this.mode();
    return mode === 'receive' ? 'Registrar recepción' : mode === 'pay' ? 'Registrar pago' : 'Cancelar orden';
  }

  // ---- Acciones directas ----
  protected approve(): void {
    const p = this.purchase();
    if (p) void this.run(this.api.approve(p.id), `Orden #${p.id} aprobada.`);
  }

  protected dispatch(): void {
    const p = this.purchase();
    if (p) void this.run(this.api.dispatch(p.id), `Orden #${p.id} marcada como enviada.`);
  }

  protected closeShortfall(): void {
    const p = this.purchase();
    if (p) void this.run(this.api.closeShortfall(p.id), `Orden #${p.id} cerrada con faltante.`);
  }

  // ---- Con formulario ----
  protected submit(): void {
    const p = this.purchase();
    if (!p || this.busy()) return;
    if (this.mode() === 'receive') {
      this.receiveForm.markAllAsTouched();
      if (this.receiveForm.invalid) return;
      const values = this.receiveForm.getRawValue().received;
      const items = p.lines.map((line, i) => ({ detailId: line.id, received: values[i] ?? 0 }));
      if (items.every((i) => i.received === 0)) {
        this.error.set('Debes recibir al menos una unidad.');
        return;
      }
      void this.receive(p, items);
    } else if (this.mode() === 'pay') {
      this.payForm.markAllAsTouched();
      if (this.payForm.invalid) return;
      const { amount, method, reference, notes } = this.payForm.getRawValue();
      const paid = amount ?? 0;
      const full = paid >= p.balance;
      void this.run(
        this.api.pay(p.id, { amount: paid, method, reference, notes }),
        full ? `Orden #${p.id} pagada por completo.` : `Abono de ${formatMoney(paid)} registrado en la orden #${p.id}.`,
      );
    } else if (this.mode() === 'cancel') {
      this.reasonForm.markAllAsTouched();
      if (this.reasonForm.invalid) return;
      void this.run(this.api.cancel(p.id, this.reasonForm.getRawValue().reason), `Orden #${p.id} cancelada.`);
    }
  }

  private async receive(purchase: Purchase, items: readonly { detailId: number; received: number }[]): Promise<void> {
    this.busy.set(true);
    this.error.set(null);
    try {
      const result = await firstValueFrom(this.api.receive(purchase.id, items));
      this.receipt.set(result);
      this.mode.set('receipt');
      this.changed.emit();
    } catch (error) {
      this.error.set(toApiError(error).message);
    } finally {
      this.busy.set(false);
    }
  }

  private async run(request: Observable<unknown>, message: string): Promise<void> {
    this.busy.set(true);
    this.error.set(null);
    try {
      await firstValueFrom(request);
      this.notifications.success(message);
      this.changed.emit();
      this.open.set(false);
    } catch (error) {
      this.error.set(toApiError(error).message);
    } finally {
      this.busy.set(false);
    }
  }

  private resetForms(purchase: Purchase): void {
    const received = this.receiveForm.controls.received;
    received.clear({ emitEvent: false });
    for (const line of purchase.lines) {
      const pending = pendingOf(line);
      received.push(new FormControl<number | null>(pending, [Validators.required, Validators.min(0), Validators.max(pending)]), { emitEvent: false });
    }
    this.reasonForm.reset({ reason: '' }, { emitEvent: false });
    this.payForm.reset({ amount: purchase.balance, method: 'TRANSFERENCIA', reference: '', notes: '' }, { emitEvent: false });
    this.payForm.controls.amount.setValidators([Validators.required, Validators.min(0.01), Validators.max(purchase.balance)]);
    this.payForm.controls.amount.updateValueAndValidity({ emitEvent: false });
  }
}
