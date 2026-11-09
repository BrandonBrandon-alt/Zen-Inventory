import { ChangeDetectionStrategy, Component, computed, effect, inject, input, model, output, signal, untracked } from '@angular/core';
import { FormArray, FormControl, NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { firstValueFrom, type Observable } from 'rxjs';
import { LucideArrowRight } from '@lucide/angular';
import { toApiError } from '@core/api/api-error';
import { type ConfirmationInput, NotificationService } from '@core/notifications/notification.service';
import { PAYMENT_METHODS, PAYMENT_METHOD_LABELS, type PaymentMethod } from '@core/payments/payment-method';
import { formatDateTime, formatMoney } from '@shared/format/format';
import { controlError } from '@shared/forms/control-error';
import { Alert } from '@shared/ui/alert/alert';
import { Badge } from '@shared/ui/badge/badge';
import { Button } from '@shared/ui/button/button';
import { DatePicker } from '@shared/ui/date-picker/date-picker';
import { FormField, InputDirective } from '@shared/ui/form-field/form-field';
import { Modal } from '@shared/ui/modal/modal';
import { Select, type SelectOption } from '@shared/ui/select/select';
import { FREIGHT_INFO, PRIORITY_INFO, STATUS_INFO } from '../../data-access/transfer-labels';
import { type Actor, transferActions } from '../../data-access/transfer-permissions';
import { type Transfer, type TransferLine, TransfersApi } from '../../data-access/transfers-api';

type Mode = 'view' | 'dispatch' | 'receive' | 'cancel' | 'reject' | 'payFreight';

const CARRIER = { required: 'Escribe el nombre del transportista.' };
const COST = { required: 'Escribe el costo (0 si no tiene).', min: 'No puede ser negativo.' };
const REASON = { required: 'Cuéntanos el motivo.' };
const AMOUNT = { required: 'Escribe cuánto se pagó.', min: 'Debe ser mayor que cero.', max: 'Es más de lo que se debe.' };
const QUANTITY = { required: 'Escribe la cantidad.', min: 'No puede ser negativa.', max: 'Es más de lo permitido.', pattern: 'Debe ser un número entero.' };

interface Step {
  readonly label: string;
  readonly who: string;
  readonly detail?: string;
}

/**
 * Detalle de un traslado y lo que se puede hacer con él según su estado y quién lo mira. Las acciones que piden datos
 * (despachar, recibir, cancelar, rechazar) se llenan dentro del mismo diálogo.
 */
@Component({
  selector: 'app-transfer-detail-modal',
  imports: [ReactiveFormsModule, Modal, Button, Alert, Badge, DatePicker, FormField, InputDirective, Select, LucideArrowRight],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './transfer-detail-modal.html',
})
export class TransferDetailModal {
  private readonly api = inject(TransfersApi);
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly notifications = inject(NotificationService);

  readonly open = model(false);
  readonly transfer = input<Transfer | null>(null);
  readonly branchNames = input<ReadonlyMap<number, string>>(new Map());
  readonly actor = input<Actor>({ role: null, branchId: null });
  /** El traslado cambió en el servidor: la lista debe recargarse. */
  readonly changed = output<void>();

  protected readonly mode = signal<Mode>('view');
  protected readonly busy = signal(false);
  protected readonly error = signal<string | null>(null);

  protected readonly formatDateTime = formatDateTime;
  protected readonly formatMoney = formatMoney;
  protected readonly statusInfo = STATUS_INFO;
  protected readonly priorityInfo = PRIORITY_INFO;
  protected readonly freightInfo = FREIGHT_INFO;
  protected readonly methodLabels = PAYMENT_METHOD_LABELS;
  protected readonly methodOptions: readonly SelectOption<PaymentMethod>[] = PAYMENT_METHODS.map((value) => ({ value, label: PAYMENT_METHOD_LABELS[value] }));

  private readonly formKey = computed(() => {
    const transfer = this.transfer();
    return transfer ? `${transfer.id}:${transfer.status}:${transfer.freightBalance}` : null;
  });

  protected readonly actions = computed(() => {
    const transfer = this.transfer();
    return transfer ? transferActions(transfer, this.actor()) : null;
  });

  protected readonly dispatchForm = this.fb.group({
    carrier: ['', Validators.required],
    trackingNumber: [''],
    shippingCost: new FormControl<number | null>(0, [Validators.required, Validators.min(0)]),
    estimatedArrival: new FormControl<Date | null>(null),
    sent: new FormArray<FormControl<number | null>>([]),
  });

  protected readonly receiveForm = this.fb.group({
    notes: [''],
    received: new FormArray<FormControl<number | null>>([]),
  });

  protected readonly reasonForm = this.fb.group({ reason: ['', Validators.required] });

  protected readonly payForm = this.fb.group({
    amount: new FormControl<number | null>(null, [Validators.required, Validators.min(0.01)]),
    method: this.fb.control<PaymentMethod>('TRANSFERENCIA'),
    reference: ['', Validators.maxLength(100)],
    notes: ['', Validators.maxLength(500)],
  });

  /** Recorrido del traslado: quién hizo cada paso y, si aplica, el dato que lo acompaña. */
  protected readonly steps = computed<Step[]>(() => {
    const t = this.transfer();
    if (!t) return [];
    const steps: Step[] = [];
    if (t.requester) steps.push({ label: 'Solicitó', who: t.requester, detail: t.requestDate ? formatDateTime(t.requestDate) : undefined });
    if (t.authorizer) steps.push({ label: 'Autorizó', who: t.authorizer });
    if (t.dispatcher) {
      const parts = [t.carrier, t.trackingNumber && `Guía ${t.trackingNumber}`, t.shippingCost ? `Envío ${formatMoney(t.shippingCost)}` : ''].filter(Boolean);
      steps.push({ label: 'Despachó', who: t.dispatcher, detail: [t.dispatchDate ? formatDateTime(t.dispatchDate) : '', ...parts].filter(Boolean).join(' · ') });
    }
    if (t.receiver) steps.push({ label: 'Recibió', who: t.receiver, detail: t.actualArrival ? formatDateTime(t.actualArrival) : undefined });
    if (t.resolver) steps.push({ label: this.resolverLabel(t), who: t.resolver });
    return steps;
  });

  protected readonly hasIssue = computed(() => (this.transfer()?.lines ?? []).some((l) => l.missing > 0));

  constructor() {
    // Solo al abrir, al cambiar de traslado o al avanzar de estado (cambian las cantidades enviadas que propone el
    // formulario de recepción): recargar la lista de fondo no debe cerrar el formulario que se está llenando.
    effect(() => {
      if (!this.open()) return;
      this.formKey();
      untracked(() => {
        this.mode.set('view');
        this.error.set(null);
        const transfer = this.transfer();
        if (transfer) this.resetForms(transfer);
      });
    });
  }

  protected submitLabel(): string {
    const labels: Partial<Record<Mode, string>> = {
      dispatch: 'Despachar',
      receive: 'Confirmar recepción',
      cancel: 'Cancelar traslado',
      reject: 'Rechazar traslado',
      payFreight: 'Registrar pago',
    };
    return labels[this.mode()] ?? '';
  }

  protected branch(id: number | undefined): string {
    return (id !== undefined && this.branchNames().get(id)) || `Sede ${id}`;
  }

  protected title(): string {
    const t = this.transfer();
    return t ? `Traslado #${t.id}` : 'Traslado';
  }

  protected fieldError(form: 'dispatch' | 'receive' | 'reason', field: string): string | null {
    const control =
      form === 'dispatch' ? this.dispatchForm.get(field) : form === 'receive' ? this.receiveForm.get(field) : this.reasonForm.get(field);
    const messages = { carrier: CARRIER, shippingCost: COST, reason: REASON }[field] ?? REASON;
    return control ? controlError(control, messages) : null;
  }

  protected amountError(): string | null {
    return controlError(this.payForm.controls.amount, AMOUNT);
  }

  protected lineError(kind: 'sent' | 'received', index: number): string | null {
    const array = kind === 'sent' ? this.dispatchForm.controls.sent : this.receiveForm.controls.received;
    return controlError(array.at(index), QUANTITY);
  }

  protected goto(mode: Mode): void {
    this.error.set(null);
    this.mode.set(mode);
  }

  // ---- Acciones directas ----

  protected approve(): void {
    const t = this.transfer();
    if (t)
      void this.run(this.api.approve(t.id), {
        title: `Traslado #${t.id} aprobado`,
        summary: 'El traslado se aprobó correctamente.',
        detail: 'Ahora la sucursal de origen puede autorizar la salida y preparar el envío.',
      });
  }

  protected prepare(): void {
    const t = this.transfer();
    if (t)
      void this.run(this.api.prepare(t), {
        title: `Traslado #${t.id} en preparación`,
        summary: 'La salida del traslado se autorizó correctamente.',
        detail: 'El siguiente paso es despacharlo indicando el transportista, la guía y el costo del envío.',
      });
  }

  protected resolve(kind: 'shrinkage' | 'resend' | 'claim'): void {
    const t = this.transfer();
    if (!t) return;
    const call = { shrinkage: this.api.resolveAsShrinkage(t.id), resend: this.api.resolveAsResend(t.id), claim: this.api.resolveAsClaim(t.id) }[kind];
    const confirmation: ConfirmationInput = {
      shrinkage: {
        title: `Traslado #${t.id} entregado`,
        summary: 'La diferencia se registró como merma correctamente.',
        detail: 'El traslado queda entregado con lo que realmente llegó; lo que faltó se da por perdido.',
      },
      resend: {
        title: `Faltantes del traslado #${t.id} reenviados`,
        summary: 'Se creó correctamente un traslado nuevo con lo que faltó.',
        detail: 'Búscalo en la lista de traslados: sigue el mismo camino (preparar, despachar y recibir).',
      },
      claim: {
        title: `Reclamo del traslado #${t.id}`,
        summary: 'El reclamo por la diferencia se abrió correctamente.',
        detail: 'El traslado queda en reclamo mientras se aclara con el transportista o la sucursal de origen.',
      },
    }[kind];
    void this.run(call, confirmation);
  }

  // ---- Acciones con formulario ----

  protected submitDispatch(): void {
    const t = this.transfer();
    this.dispatchForm.markAllAsTouched();
    if (!t || this.dispatchForm.invalid || this.busy()) return;
    const v = this.dispatchForm.getRawValue();
    const items = t.lines.map((line, i) => ({ detailId: line.id, sent: v.sent[i] ?? 0 }));
    if (items.every((i) => i.sent === 0)) {
      this.error.set('Debes enviar al menos una unidad.');
      return;
    }
    void this.run(
      this.api.dispatch(t.id, {
        carrier: v.carrier,
        shippingCost: v.shippingCost ?? 0,
        trackingNumber: v.trackingNumber,
        estimatedArrival: v.estimatedArrival,
        items,
      }),
      {
        title: `Traslado #${t.id} despachado`,
        summary: 'El traslado se despachó correctamente.',
        detail: 'El stock ya salió de la sucursal de origen. La sucursal de destino debe confirmar lo recibido cuando llegue.',
      },
    );
  }

  protected submitReceive(): void {
    const t = this.transfer();
    this.receiveForm.markAllAsTouched();
    if (!t || this.receiveForm.invalid || this.busy()) return;
    const v = this.receiveForm.getRawValue();
    const complete = t.lines.every((line, i) => (v.received[i] ?? 0) >= (line.sent ?? line.requested));
    void this.run(
      this.api.receive(t.id, { notes: v.notes, items: t.lines.map((line, i) => ({ detailId: line.id, received: v.received[i] ?? 0 })) }),
      complete
        ? {
            title: `Traslado #${t.id} recibido`,
            summary: 'El traslado se recibió completo correctamente.',
            detail: 'Lo recibido ya se sumó al stock de la sucursal de destino.',
          }
        : {
            title: `Traslado #${t.id} recibido con diferencias`,
            summary: 'La recepción se registró correctamente, pero llegó menos de lo enviado.',
            detail: 'Lo recibido ya se sumó al stock. Resuelve la diferencia desde el traslado: merma, reenvío de faltantes o reclamo.',
          },
    );
  }

  protected submitPayFreight(): void {
    const t = this.transfer();
    this.payForm.markAllAsTouched();
    if (!t || this.payForm.invalid || this.busy()) return;
    const { amount, method, reference, notes } = this.payForm.getRawValue();
    const paid = amount ?? 0;
    void this.run(
      this.api.payFreight(t.id, { amount: paid, method, reference, notes }),
      paid >= t.freightBalance
        ? { title: `Flete del traslado #${t.id} pagado`, summary: `El pago de ${formatMoney(paid)} se registró correctamente.`, detail: 'El flete quedó pagado por completo al transportista.' }
        : {
            title: `Abono al flete del traslado #${t.id}`,
            summary: `El abono de ${formatMoney(paid)} se registró correctamente.`,
            detail: `Queda un saldo de ${formatMoney(t.freightBalance - paid)} por pagar al transportista.`,
          },
    );
  }

  protected submitReason(): void {
    const t = this.transfer();
    const mode = this.mode();
    this.reasonForm.markAllAsTouched();
    if (!t || this.reasonForm.invalid || this.busy() || (mode !== 'cancel' && mode !== 'reject')) return;
    const reason = this.reasonForm.getRawValue().reason;
    void this.run(
      mode === 'cancel' ? this.api.cancel(t.id, reason) : this.api.reject(t.id, reason),
      {
        title: `Traslado #${t.id} ${mode === 'cancel' ? 'cancelado' : 'rechazado'}`,
        summary: `El traslado se ${mode === 'cancel' ? 'canceló' : 'rechazó'} correctamente.`,
        detail:
          t.status === 'IN_TRANSIT'
            ? 'Lo que se había enviado volvió al stock de la sucursal de origen.'
            : 'Lo que estaba reservado en la sucursal de origen vuelve a estar disponible.',
      },
    );
  }

  private async run(request: Observable<unknown>, confirmation: ConfirmationInput): Promise<void> {
    this.busy.set(true);
    this.error.set(null);
    try {
      await firstValueFrom(request);
      this.notifications.confirm(confirmation);
      this.changed.emit();
      this.open.set(false);
    } catch (error) {
      this.error.set(toApiError(error).message);
    } finally {
      this.busy.set(false);
    }
  }

  private resetForms(transfer: Transfer): void {
    const sent = this.dispatchForm.controls.sent;
    sent.clear({ emitEvent: false });
    for (const line of transfer.lines) sent.push(quantityControl(line.requested, line.requested), { emitEvent: false });
    this.dispatchForm.reset({ carrier: '', trackingNumber: '', shippingCost: 0, estimatedArrival: null, sent: transfer.lines.map((l) => l.requested) }, { emitEvent: false });
    this.now.set(new Date());

    const received = this.receiveForm.controls.received;
    received.clear({ emitEvent: false });
    for (const line of transfer.lines) received.push(quantityControl(line.sent ?? line.requested, line.sent ?? line.requested), { emitEvent: false });
    this.receiveForm.reset({ notes: '', received: transfer.lines.map((l) => l.sent ?? l.requested) }, { emitEvent: false });

    this.reasonForm.reset({ reason: '' }, { emitEvent: false });

    this.payForm.reset({ amount: transfer.freightBalance, method: 'TRANSFERENCIA', reference: '', notes: '' }, { emitEvent: false });
    this.payForm.controls.amount.setValidators([Validators.required, Validators.min(0.01), Validators.max(Math.max(transfer.freightBalance, 0.01))]);
    this.payForm.controls.amount.updateValueAndValidity({ emitEvent: false });
  }

  /** Mínimo de la llegada estimada: el momento en que se abre el detalle (no puede estar en el pasado). */
  protected readonly now = signal(new Date());

  protected lineSent(line: TransferLine): string {
    return line.sent === null ? '—' : String(line.sent);
  }

  private resolverLabel(t: Transfer): string {
    switch (t.status) {
      case 'CANCELLED':
        return 'Canceló';
      case 'REJECTED':
        return 'Rechazó';
      case 'UNDER_CLAIM':
        return 'Abrió el reclamo';
      default:
        return 'Resolvió';
    }
  }
}

/** Cantidad entera entre 0 y `max` (lo pedido o lo enviado). */
function quantityControl(value: number, max: number): FormControl<number | null> {
  return new FormControl<number | null>(value, [Validators.required, Validators.min(0), Validators.max(max), Validators.pattern(/^\d+$/)]);
}
