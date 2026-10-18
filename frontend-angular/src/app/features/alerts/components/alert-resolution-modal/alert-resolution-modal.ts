import { ChangeDetectionStrategy, Component, computed, effect, inject, input, model, output, signal, untracked } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { type FormGroup, NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { LucideBan, LucideCircleCheck, LucideShoppingBag, LucideShuffle, LucideStore, LucideTruck } from '@lucide/angular';
import { toApiError } from '@core/api/api-error';
import type { BranchOption } from '@core/branches/branch-options-api';
import { CatalogOptionsApi, type SupplierOption } from '@core/catalog/catalog-options-api';
import { NotificationService } from '@core/notifications/notification.service';
import { controlError } from '@shared/forms/control-error';
import { Alert } from '@shared/ui/alert/alert';
import { Button } from '@shared/ui/button/button';
import { FormField, InputDirective } from '@shared/ui/form-field/form-field';
import { Modal } from '@shared/ui/modal/modal';
import { Select, type SelectOption } from '@shared/ui/select/select';
import { type TabItem, Tabs } from '@shared/ui/tabs/tabs';
import { AlertsApi, type StockAlert, type TransferPriority } from '../../data-access/alerts-api';

type Method = 'transfer' | 'purchase' | 'dismiss';

const PRIORITIES: readonly SelectOption<TransferPriority>[] = [
  { value: 'HIGH', label: 'Alta urgencia' },
  { value: 'NORMAL', label: 'Normal' },
  { value: 'LOW', label: 'Baja prioridad' },
];

const DISMISS_REASONS: readonly SelectOption<string>[] = [
  { value: 'Fin de temporada', label: 'Fin de temporada' },
  { value: 'Producto descontinuado', label: 'Producto descontinuado' },
  { value: 'Error de conteo o ajuste pendiente', label: 'Error de conteo o ajuste pendiente' },
  { value: 'other', label: 'Otro motivo' },
];

const REQUIRED = { required: 'Este dato es requerido.' };
const MESSAGES = {
  origin: { required: 'Elige la sucursal que enviará el stock.' },
  quantityInt: { required: 'Escribe la cantidad.', min: 'Debe ser mayor que 0.', pattern: 'Debe ser un número entero.' },
  quantity: { required: 'Escribe la cantidad.', min: 'Debe ser mayor que 0.' },
  supplier: { required: 'Elige un proveedor.' },
  leadTime: { required: 'Escribe los días.', min: 'Debe ser al menos 1 día.', pattern: 'Debe ser un número entero.' },
  reason: { required: 'Elige un motivo.' },
  other: { required: 'Cuéntanos el motivo.' },
} as const;

/**
 * Cómo se atiende una alerta de stock: pedir el producto a otra sucursal, comprarlo a un proveedor o descartarla.
 * Las alertas de otros tipos (devoluciones, incidencias…) solo se marcan como resueltas.
 *
 * - `canDismiss`: descartar y marcar como resuelta son acciones de ADMIN y MANAGER.
 */
@Component({
  selector: 'app-alert-resolution-modal',
  imports: [ReactiveFormsModule, Modal, Button, Alert, FormField, InputDirective, Select, Tabs],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './alert-resolution-modal.html',
})
export class AlertResolutionModal {
  private readonly api = inject(AlertsApi);
  private readonly catalog = inject(CatalogOptionsApi);
  private readonly notifications = inject(NotificationService);
  private readonly fb = inject(NonNullableFormBuilder);

  readonly open = model(false);
  readonly alert = input<StockAlert | null>(null);
  readonly productName = input('');
  readonly branches = input<readonly BranchOption[]>([]);
  readonly canDismiss = input(false);
  /** La alerta ya quedó resuelta en el servidor. */
  readonly resolved = output<StockAlert>();

  protected readonly method = signal<Method>('transfer');
  protected readonly busy = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly suppliers = signal<readonly SupplierOption[]>([]);
  protected readonly suppliersLoading = signal(false);

  protected readonly priorities = PRIORITIES;
  protected readonly dismissReasons = DISMISS_REASONS;
  protected readonly storeIcon = LucideStore.icon;
  protected readonly truckIcon = LucideTruck.icon;
  protected readonly checkIcon = LucideCircleCheck.icon;

  /** Solo las alertas de stock se resuelven moviendo mercancía. */
  protected readonly isStock = computed(() => {
    const type = this.alert()?.type;
    return type === 'LOW_STOCK' || type === 'PURCHASE_REQUEST';
  });

  protected readonly tabs = computed<readonly TabItem[]>(() => [
    { id: 'transfer', label: 'Pedir a otra sucursal', icon: LucideShuffle.icon },
    { id: 'purchase', label: 'Comprar', icon: LucideShoppingBag.icon },
    ...(this.canDismiss() ? [{ id: 'dismiss', label: 'Descartar', icon: LucideBan.icon }] : []),
  ]);

  protected readonly transferForm = this.fb.group({
    originBranchId: [null as number | null, Validators.required],
    quantity: [null as number | null, [Validators.required, Validators.min(1), Validators.pattern(/^\d+$/)]],
    priority: ['NORMAL' as TransferPriority],
  });

  protected readonly purchaseForm = this.fb.group({
    supplierId: [null as number | null, Validators.required],
    quantity: [null as number | null, [Validators.required, Validators.min(0.0001)]],
    leadTimeDays: [null as number | null, [Validators.required, Validators.min(1), Validators.pattern(/^\d+$/)]],
  });

  protected readonly dismissForm = this.fb.group({
    reason: [null as string | null, Validators.required],
    other: [''],
  });

  protected readonly originOptions = computed<SelectOption<number>[]>(() =>
    this.branches()
      .filter((branch) => branch.activa && branch.id !== this.alert()?.branchId)
      .map((branch) => ({ value: branch.id, label: branch.nombre })),
  );

  protected readonly supplierOptions = computed<SelectOption<number>[]>(() =>
    this.suppliers().map((supplier) => ({
      value: supplier.id,
      label: supplier.nombre,
      description: supplier.tiempoEntregaDias === null ? undefined : `Entrega en ${supplier.tiempoEntregaDias} ${supplier.tiempoEntregaDias === 1 ? 'día' : 'días'}`,
    })),
  );

  protected readonly otherReason = computed(() => this.dismissReasonValue() === 'other');
  private readonly dismissReasonValue = signal<string | null>(null);

  constructor() {
    effect(() => {
      if (!this.open()) return;
      const alert = this.alert();
      if (!alert) return;
      untracked(() => {
        this.method.set('transfer');
        this.error.set(null);
        this.transferForm.reset({ originBranchId: null, quantity: null, priority: 'NORMAL' });
        this.purchaseForm.reset();
        this.dismissForm.reset({ reason: null, other: '' });
        this.dismissReasonValue.set(null);
        this.suppliers.set([]);
        if (this.isStock()) void this.loadSuppliers(alert.productId);
      });
    });
    this.dismissForm.controls.reason.valueChanges.pipe(takeUntilDestroyed()).subscribe((reason) => {
      this.dismissReasonValue.set(reason);
      const other = this.dismissForm.controls.other;
      other.setValidators(reason === 'other' ? [Validators.required] : []);
      other.updateValueAndValidity();
    });
    // Al elegir proveedor se propone su tiempo de entrega habitual (se puede cambiar).
    this.purchaseForm.controls.supplierId.valueChanges.pipe(takeUntilDestroyed()).subscribe((id) => {
      const days = this.suppliers().find((s) => s.id === id)?.tiempoEntregaDias;
      if (days && this.purchaseForm.controls.leadTimeDays.value === null) this.purchaseForm.controls.leadTimeDays.setValue(days);
    });
  }

  protected fieldError(group: 'transfer' | 'purchase' | 'dismiss', field: string): string | null {
    const form: FormGroup = { transfer: this.transferForm, purchase: this.purchaseForm, dismiss: this.dismissForm }[group];
    const control = form.get(field);
    if (!control) return null;
    const messages: Record<string, Record<string, string>> = {
      originBranchId: MESSAGES.origin,
      supplierId: MESSAGES.supplier,
      reason: MESSAGES.reason,
      other: MESSAGES.other,
      leadTimeDays: MESSAGES.leadTime,
      quantity: group === 'transfer' ? MESSAGES.quantityInt : MESSAGES.quantity,
    };
    return controlError(control, messages[field] ?? REQUIRED);
  }

  protected submit(): void {
    const alert = this.alert();
    if (!alert || this.busy()) return;
    switch (this.method()) {
      case 'transfer': {
        this.transferForm.markAllAsTouched();
        if (this.transferForm.invalid) return;
        const v = this.transferForm.getRawValue();
        void this.run(
          alert,
          this.api.resolveViaTransfer(alert.id, { originBranchId: v.originBranchId as number, quantity: v.quantity as number, priority: v.priority }),
          'Solicitud de traslado creada y alerta resuelta.',
        );
        return;
      }
      case 'purchase': {
        this.purchaseForm.markAllAsTouched();
        if (this.purchaseForm.invalid) return;
        const v = this.purchaseForm.getRawValue();
        void this.run(
          alert,
          this.api.resolveViaPurchase(alert.id, { supplierId: v.supplierId as number, quantity: v.quantity as number, leadTimeDays: v.leadTimeDays as number }),
          'Orden de compra creada y alerta resuelta.',
        );
        return;
      }
      case 'dismiss': {
        this.dismissForm.markAllAsTouched();
        if (this.dismissForm.invalid) return;
        const v = this.dismissForm.getRawValue();
        const reason = v.reason === 'other' ? v.other.trim() : (v.reason as string);
        if (!reason) return;
        void this.run(alert, this.api.dismiss(alert.id, reason), 'Alerta descartada.');
        return;
      }
    }
  }

  /** Alertas que no son de stock: se marcan como resueltas sin más. */
  protected markResolved(): void {
    const alert = this.alert();
    if (alert && !this.busy()) void this.run(alert, this.api.resolve(alert.id), 'Alerta marcada como resuelta.');
  }

  private async run(alert: StockAlert, request: ReturnType<AlertsApi['dismiss']>, message: string): Promise<void> {
    this.busy.set(true);
    this.error.set(null);
    try {
      await firstValueFrom(request);
      this.notifications.success(message);
      this.resolved.emit(alert);
      this.open.set(false);
    } catch (error) {
      this.error.set(toApiError(error).message);
    } finally {
      this.busy.set(false);
    }
  }

  private async loadSuppliers(productId: number): Promise<void> {
    this.suppliersLoading.set(true);
    try {
      this.suppliers.set(await firstValueFrom(this.catalog.suppliersOf(productId)));
    } catch {
      // Sin la lista no se puede comprar; las demás opciones siguen disponibles.
      this.suppliers.set([]);
    } finally {
      this.suppliersLoading.set(false);
    }
  }
}
