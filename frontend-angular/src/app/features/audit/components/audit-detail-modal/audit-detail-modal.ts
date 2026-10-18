import { ChangeDetectionStrategy, Component, input, model } from '@angular/core';
import { formatDateTime, formatQuantity } from '@shared/format/format';
import { Badge } from '@shared/ui/badge/badge';
import { Button } from '@shared/ui/button/button';
import { Modal } from '@shared/ui/modal/modal';
import { REASON_INFO, documentLabel, subReasonText } from '../../data-access/audit-labels';
import type { AuditMovement } from '../../data-access/audit-api';

/** Un movimiento con los nombres ya resueltos (producto, sucursal, responsable). */
export interface AuditRow extends AuditMovement {
  readonly product: string;
  readonly branch: string;
  readonly responsible: string;
  readonly document: string;
  readonly reasonLabel: string;
  readonly typeLabel: string;
  /** Cantidad con signo: positiva en ingresos, negativa en retiros. */
  readonly signedQuantity: number;
}

/** Todo lo que se sabe de un movimiento de existencias, incluidas las observaciones completas. */
@Component({
  selector: 'app-audit-detail-modal',
  imports: [Modal, Button, Badge],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-modal [(open)]="open" [title]="row() ? 'Movimiento #' + row()!.id : 'Movimiento'" [description]="row() ? formatDateTime(row()!.date) : ''">
      @if (row(); as r) {
        <div class="flex flex-wrap items-center gap-2">
          <app-badge [variant]="r.type === 'INGRESO' ? 'success' : 'danger'" dot>{{ r.typeLabel }}</app-badge>
          <app-badge [variant]="reasonInfo[r.reason].variant">{{ r.reasonLabel }}</app-badge>
          @if (r.subReason) {
            <span class="text-sm text-fg-muted">{{ subReason(r.subReason) }}</span>
          }
        </div>
        <dl class="mt-5 grid gap-x-8 gap-y-3 text-sm sm:grid-cols-2">
          <div><dt class="text-fg-subtle">Producto</dt><dd class="mt-0.5 font-medium text-fg">{{ r.product }}</dd></div>
          <div><dt class="text-fg-subtle">Sucursal</dt><dd class="mt-0.5 text-fg">{{ r.branch }}</dd></div>
          <div>
            <dt class="text-fg-subtle">Cantidad</dt>
            <dd class="mt-0.5 font-semibold tabular-nums" [class]="r.type === 'INGRESO' ? 'text-success' : 'text-danger'">{{ r.type === 'INGRESO' ? '+' : '−' }}{{ formatQuantity(r.quantity) }}</dd>
          </div>
          <div><dt class="text-fg-subtle">Existencias después</dt><dd class="mt-0.5 tabular-nums text-fg">{{ r.balance === null ? '—' : formatQuantity(r.balance) }}</dd></div>
          <div><dt class="text-fg-subtle">Responsable</dt><dd class="mt-0.5 text-fg">{{ r.responsible }}</dd></div>
          <div><dt class="text-fg-subtle">Documento</dt><dd class="mt-0.5 text-fg">{{ r.document || 'Ajuste manual (sin documento)' }}</dd></div>
        </dl>
        <div class="mt-5 border-t border-line pt-4">
          <p class="text-sm text-fg-subtle">Observaciones</p>
          <p class="mt-1 text-sm whitespace-pre-line text-fg">{{ r.observations || 'Sin observaciones.' }}</p>
        </div>
      }
      <div data-slot="footer">
        <button appButton variant="ghost" type="button" (click)="open.set(false)">Cerrar</button>
      </div>
    </app-modal>
  `,
})
export class AuditDetailModal {
  readonly open = model(false);
  readonly row = input<AuditRow | null>(null);

  protected readonly formatDateTime = formatDateTime;
  protected readonly formatQuantity = formatQuantity;
  protected readonly reasonInfo = REASON_INFO;
  protected readonly subReason = subReasonText;
  protected readonly documentLabel = documentLabel;
}
