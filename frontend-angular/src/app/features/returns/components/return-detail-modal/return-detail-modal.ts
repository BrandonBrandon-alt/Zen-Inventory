import { ChangeDetectionStrategy, Component, computed, effect, inject, input, model, output, signal, untracked } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { firstValueFrom, type Observable } from 'rxjs';
import { toApiError } from '@core/api/api-error';
import { NotificationService } from '@core/notifications/notification.service';
import { formatDateTime, formatMoney, formatQuantity } from '@shared/format/format';
import { controlError } from '@shared/forms/control-error';
import { Alert } from '@shared/ui/alert/alert';
import { Badge } from '@shared/ui/badge/badge';
import { Button } from '@shared/ui/button/button';
import { FormField, InputDirective } from '@shared/ui/form-field/form-field';
import { Modal } from '@shared/ui/modal/modal';
import { RETURN_INFO } from '../../data-access/return-labels';
import type { ReturnRequest } from '../../data-access/returns-api';
import { ReturnsApi } from '../../data-access/returns-api';

type Mode = 'view' | 'approve' | 'reject';

/**
 * Detalle de una solicitud de devolución. Un gerente (o el administrador) la aprueba, y entonces las unidades vuelven al
 * stock de la sucursal, o la rechaza con un motivo; ninguna de las dos se puede deshacer.
 */
@Component({
  selector: 'app-return-detail-modal',
  imports: [ReactiveFormsModule, Modal, Button, Alert, Badge, FormField, InputDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './return-detail-modal.html',
})
export class ReturnDetailModal {
  private readonly api = inject(ReturnsApi);
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly notifications = inject(NotificationService);

  readonly open = model(false);
  readonly request = input<ReturnRequest | null>(null);
  /** ADMIN y MANAGER deciden las solicitudes pendientes. */
  readonly canDecide = input(false);
  readonly productNames = input<ReadonlyMap<number, string>>(new Map());
  readonly userNames = input<ReadonlyMap<number, string>>(new Map());
  readonly branchName = input('');
  /** La solicitud cambió en el servidor: la lista debe recargarse. */
  readonly changed = output<void>();

  protected readonly mode = signal<Mode>('view');
  protected readonly busy = signal(false);
  protected readonly error = signal<string | null>(null);

  protected readonly formatDateTime = formatDateTime;
  protected readonly formatMoney = formatMoney;
  protected readonly formatQuantity = formatQuantity;
  protected readonly info = RETURN_INFO;

  protected readonly decidable = computed(() => this.canDecide() && this.request()?.status === 'PENDIENTE');

  protected readonly approveForm = this.fb.group({ comment: [''] });
  protected readonly rejectForm = this.fb.group({ reason: ['', [Validators.required, Validators.pattern(/\S/)]] });

  private readonly requestId = computed(() => this.request()?.id ?? null);

  constructor() {
    effect(() => {
      if (!this.open()) return;
      this.requestId();
      untracked(() => {
        this.mode.set('view');
        this.error.set(null);
        this.approveForm.reset({ comment: '' });
        this.rejectForm.reset({ reason: '' });
      });
    });
  }

  protected productName(id: number): string {
    return this.productNames().get(id) ?? `Producto ${id}`;
  }

  protected person(id: number | null): string {
    return id === null ? '' : (this.userNames().get(id) ?? `Usuario ${id}`);
  }

  protected reasonError(): string | null {
    return controlError(this.rejectForm.controls.reason, { required: 'Cuéntanos el motivo del rechazo.', pattern: 'Cuéntanos el motivo del rechazo.' });
  }

  protected goto(mode: Mode): void {
    this.error.set(null);
    this.mode.set(mode);
  }

  protected submit(): void {
    const request = this.request();
    if (!request || this.busy()) return;
    if (this.mode() === 'approve') {
      void this.run(this.api.approve(request.id, this.approveForm.getRawValue().comment), `Devolución #${request.id} aprobada: las unidades volvieron al stock.`);
    } else if (this.mode() === 'reject') {
      this.rejectForm.markAllAsTouched();
      if (this.rejectForm.invalid) return;
      void this.run(this.api.reject(request.id, this.rejectForm.getRawValue().reason), `Devolución #${request.id} rechazada.`);
    }
  }

  private async run(call: Observable<unknown>, message: string): Promise<void> {
    this.busy.set(true);
    this.error.set(null);
    try {
      await firstValueFrom(call);
      this.notifications.success(message);
      this.changed.emit();
      this.open.set(false);
    } catch (error) {
      this.error.set(toApiError(error).message);
    } finally {
      this.busy.set(false);
    }
  }
}
