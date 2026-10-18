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
import { PAYMENT_INFO, RECEPTION_INFO } from '../../data-access/purchase-labels';
import { purchaseActions } from '../../data-access/purchase-permissions';
import { type Purchase, PurchasesApi, type Receipt } from '../../data-access/purchases-api';

type Mode = 'view' | 'receive' | 'cancel' | 'receipt';

const QUANTITY = { required: 'Escribe la cantidad.', min: 'No puede ser negativa.', max: 'Es más de lo pedido.' };
const REASON = { required: 'Cuéntanos el motivo.' };

/**
 * Detalle de una orden de compra y lo que se puede hacer con ella según su estado y el rol de quien la mira.
 * Recibir y cancelar piden datos dentro del mismo diálogo; al recibir se muestra cómo cambió el costo promedio.
 */
@Component({
  selector: 'app-purchase-detail-modal',
  imports: [ReactiveFormsModule, Modal, Button, Alert, Badge, FormField, InputDirective],
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
  protected readonly receptionInfo = RECEPTION_INFO;
  protected readonly paymentInfo = PAYMENT_INFO;

  protected readonly actions = computed(() => {
    const purchase = this.purchase();
    return purchase ? purchaseActions(purchase, this.role()) : null;
  });

  private readonly purchaseId = computed(() => this.purchase()?.id ?? null);

  protected readonly receiveForm = this.fb.group({ received: new FormArray<FormControl<number | null>>([]) });
  protected readonly reasonForm = this.fb.group({ reason: ['', Validators.required] });

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

  protected reasonError(): string | null {
    return controlError(this.reasonForm.controls.reason, REASON);
  }

  protected goto(mode: Mode): void {
    this.error.set(null);
    this.mode.set(mode);
  }

  protected submitLabel(): string {
    return this.mode() === 'receive' ? 'Registrar recepción' : 'Cancelar orden';
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

  protected pay(): void {
    const p = this.purchase();
    if (p) void this.run(this.api.pay(p.id), `Orden #${p.id} marcada como pagada.`);
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
      received.push(new FormControl<number | null>(line.quantity, [Validators.required, Validators.min(0), Validators.max(line.quantity)]), { emitEvent: false });
    }
    this.reasonForm.reset({ reason: '' }, { emitEvent: false });
  }
}
