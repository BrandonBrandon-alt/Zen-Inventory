import { ChangeDetectionStrategy, Component, computed, effect, inject, input, model, output, signal, untracked } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { toApiError } from '@core/api/api-error';
import { NotificationService } from '@core/notifications/notification.service';
import { formatDateTime, formatMoney, formatQuantity } from '@shared/format/format';
import { controlError } from '@shared/forms/control-error';
import { Alert } from '@shared/ui/alert/alert';
import { Badge } from '@shared/ui/badge/badge';
import { Button } from '@shared/ui/button/button';
import { FormField, InputDirective } from '@shared/ui/form-field/form-field';
import { Modal } from '@shared/ui/modal/modal';
import { SALE_INFO, customerLabel } from '../../data-access/sale-labels';
import { type Sale, SalesApi } from '../../data-access/sales-api';

type Mode = 'view' | 'cancel';

/**
 * Detalle de una venta: productos, descuentos y total. Con `created` es el comprobante que se ve al registrarla.
 * `canCancel` (ADMIN y MANAGER) ofrece anular una venta completada, devolviendo el stock a la sucursal.
 */
@Component({
  selector: 'app-sale-detail-modal',
  imports: [ReactiveFormsModule, Modal, Button, Alert, Badge, FormField, InputDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './sale-detail-modal.html',
})
export class SaleDetailModal {
  private readonly api = inject(SalesApi);
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly notifications = inject(NotificationService);

  readonly open = model(false);
  readonly sale = input<Sale | null>(null);
  /** La venta se acaba de registrar: el diálogo hace de comprobante. */
  readonly created = input(false);
  readonly canCancel = input(false);
  /** La venta se anuló en el servidor: la lista debe recargarse. */
  readonly changed = output<void>();

  protected readonly mode = signal<Mode>('view');
  protected readonly busy = signal(false);
  protected readonly error = signal<string | null>(null);

  protected readonly formatDateTime = formatDateTime;
  protected readonly formatMoney = formatMoney;
  protected readonly formatQuantity = formatQuantity;
  protected readonly info = SALE_INFO;
  protected readonly customerLabel = customerLabel;

  protected readonly reasonForm = this.fb.group({ reason: ['', Validators.required] });

  protected readonly title = computed(() => {
    const sale = this.sale();
    if (!sale) return 'Venta';
    return this.created() ? `Venta #${sale.id} registrada` : `Venta #${sale.id}`;
  });

  protected readonly cancellable = computed(() => this.canCancel() && this.sale()?.status === 'COMPLETED' && !this.created());

  private readonly saleId = computed(() => this.sale()?.id ?? null);

  constructor() {
    // Solo al abrir (o al cambiar de venta): recargar la lista de fondo no debe borrar lo que se está escribiendo.
    effect(() => {
      if (!this.open()) return;
      this.saleId();
      untracked(() => {
        this.mode.set('view');
        this.error.set(null);
        this.reasonForm.reset({ reason: '' });
      });
    });
  }

  protected reasonError(): string | null {
    return controlError(this.reasonForm.controls.reason, { required: 'Cuéntanos el motivo.' });
  }

  protected goto(mode: Mode): void {
    this.error.set(null);
    this.mode.set(mode);
  }

  protected async submitCancel(): Promise<void> {
    const sale = this.sale();
    this.reasonForm.markAllAsTouched();
    if (!sale || this.reasonForm.invalid || this.busy()) return;
    this.busy.set(true);
    this.error.set(null);
    try {
      await firstValueFrom(this.api.cancel(sale.id, this.reasonForm.getRawValue().reason));
      this.notifications.success(`Venta #${sale.id} anulada: el stock volvió a la sucursal.`);
      this.changed.emit();
      this.open.set(false);
    } catch (error) {
      this.error.set(toApiError(error).message);
    } finally {
      this.busy.set(false);
    }
  }
}
