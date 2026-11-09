import { ChangeDetectionStrategy, Component, computed, effect, inject, input, model, output, signal, untracked } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { type FormGroup, NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { catchError, firstValueFrom, forkJoin, map, of } from 'rxjs';
import { LucideBan, LucideCircleCheck, LucideShoppingBag, LucideShuffle, LucideStore, LucideTruck } from '@lucide/angular';
import { toApiError } from '@core/api/api-error';
import type { BranchOption } from '@core/branches/branch-options-api';
import { CatalogOptionsApi, type SupplierOption } from '@core/catalog/catalog-options-api';
import { StockAvailabilityApi } from '@core/inventory/stock-availability-api';
import { type ConfirmationInput, NotificationService } from '@core/notifications/notification.service';
import { formatQuantity } from '@shared/format/format';
import { controlError } from '@shared/forms/control-error';
import { Alert } from '@shared/ui/alert/alert';
import { Button } from '@shared/ui/button/button';
import { FormField, InputDirective } from '@shared/ui/form-field/form-field';
import { Modal } from '@shared/ui/modal/modal';
import { Select, type SelectOption } from '@shared/ui/select/select';
import { type TabItem, Tabs } from '@shared/ui/tabs/tabs';
import { AlertsApi, type StockAlert, type TransferPriority } from '@core/alerts/alerts-api';

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
  private readonly stockApi = inject(StockAvailabilityApi);
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

  /**
   * Cuánto tiene disponible del producto cada otra sucursal: la cantidad, 0 si nada, o `null` si no se pudo consultar.
   * `loading` mientras se consulta; `null` (sin mapa) si todavía no se pidió.
   */
  protected readonly originStock = signal<ReadonlyMap<number, number | null> | 'loading' | null>(null);
  private stockRequest = 0;

  private readonly candidateOrigins = computed(() =>
    this.branches().filter((branch) => branch.activa && branch.id !== this.alert()?.branchId),
  );

  /**
   * Solo las sucursales que tienen el producto disponible, de la que más tiene a la que menos, con la cantidad a la
   * vista. Una sucursal cuya existencia no se pudo consultar se ofrece igual (al final): el servidor valida al pedir.
   */
  protected readonly originOptions = computed<SelectOption<number>[]>(() => {
    const stock = this.originStock();
    const candidates = this.candidateOrigins();
    if (stock === 'loading') return [];
    if (stock === null) return candidates.map((branch) => ({ value: branch.id, label: branch.nombre }));
    const withStock = candidates
      .filter((branch) => (stock.get(branch.id) ?? 0) > 0)
      .sort((a, b) => (stock.get(b.id) ?? 0) - (stock.get(a.id) ?? 0))
      .map((branch) => ({ value: branch.id, label: branch.nombre, description: `${formatQuantity(stock.get(branch.id))} disponibles` }));
    const unknown = candidates
      .filter((branch) => stock.has(branch.id) && stock.get(branch.id) === null)
      .map((branch) => ({ value: branch.id, label: branch.nombre, description: 'No se pudo consultar su existencia' }));
    return [...withStock, ...unknown];
  });

  protected readonly originPlaceholder = computed(() => {
    const stock = this.originStock();
    if (stock === 'loading') return 'Consultando existencias…';
    if (stock !== null && this.originOptions().length === 0) return 'Ninguna otra sucursal lo tiene disponible';
    return 'Selecciona una sucursal';
  });

  /** Lo disponible en la sucursal elegida, para no pedir más de lo que tiene. */
  private readonly chosenOriginAvailable = signal<number | null>(null);

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
        this.chosenOriginAvailable.set(null);
        this.originStock.set(null);
        if (this.isStock()) void this.loadSuppliers(alert.productId);
      });
    });
    // La existencia del producto en las demás sucursales: se consulta al abrir, cuando ya se conocen las sucursales.
    effect(() => {
      const alert = this.alert();
      const candidates = this.candidateOrigins();
      if (!this.open() || !alert || !this.isStock() || candidates.length === 0) return;
      untracked(() => this.loadOriginStock(alert.productId, candidates.map((branch) => branch.id)));
    });
    // Al elegir la sucursal de origen no se puede pedir más de lo que tiene disponible.
    this.transferForm.controls.originBranchId.valueChanges.pipe(takeUntilDestroyed()).subscribe((id) => {
      const stock = this.originStock();
      const available = id !== null && stock instanceof Map ? (stock.get(id) ?? null) : null;
      this.chosenOriginAvailable.set(available);
      const quantity = this.transferForm.controls.quantity;
      quantity.setValidators([Validators.required, Validators.min(1), Validators.pattern(/^\d+$/), ...(available !== null ? [Validators.max(available)] : [])]);
      quantity.updateValueAndValidity({ emitEvent: false });
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
      quantity:
        group === 'transfer'
          ? { ...MESSAGES.quantityInt, max: `Esa sucursal solo tiene ${formatQuantity(this.chosenOriginAvailable())} disponibles.` }
          : MESSAGES.quantity,
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
          {
            title: 'Traslado solicitado',
            summary: 'La alerta se resolvió correctamente con una solicitud de traslado.',
            detail: 'La sucursal de origen debe autorizar y despachar el envío. Síguelo en Traslados.',
          },
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
          {
            title: 'Orden de compra creada',
            summary: 'La alerta se resolvió correctamente con una orden de compra.',
            detail: 'Síguela en Compras: cuando llegue la mercancía, al recibirla se suma al stock.',
          },
        );
        return;
      }
      case 'dismiss': {
        this.dismissForm.markAllAsTouched();
        if (this.dismissForm.invalid) return;
        const v = this.dismissForm.getRawValue();
        const reason = v.reason === 'other' ? v.other.trim() : (v.reason as string);
        if (!reason) return;
        void this.run(alert, this.api.dismiss(alert.id, reason), {
          title: 'Alerta descartada',
          summary: 'La alerta se descartó correctamente.',
          detail: `Motivo: ${reason}. Si el stock vuelve a bajar del mínimo, se creará una alerta nueva.`,
        });
        return;
      }
    }
  }

  /** Alertas que no son de stock: se marcan como resueltas sin más. */
  protected markResolved(): void {
    const alert = this.alert();
    if (alert && !this.busy()) void this.run(alert, this.api.resolve(alert.id), {
        title: 'Alerta resuelta',
        summary: 'La alerta se marcó como resuelta correctamente.',
        detail: 'Ya no aparece entre las alertas pendientes.',
      });
  }

  private async run(alert: StockAlert, request: ReturnType<AlertsApi['dismiss']>, confirmation: ConfirmationInput): Promise<void> {
    this.busy.set(true);
    this.error.set(null);
    try {
      await firstValueFrom(request);
      this.notifications.confirm(confirmation);
      this.resolved.emit(alert);
      this.open.set(false);
    } catch (error) {
      this.error.set(toApiError(error).message);
    } finally {
      this.busy.set(false);
    }
  }

  private loadOriginStock(productId: number, branchIds: readonly number[]): void {
    const request = ++this.stockRequest;
    this.originStock.set('loading');
    forkJoin(
      branchIds.map((id) =>
        this.stockApi.availability(id).pipe(
          map((byProduct): [number, number | null] => [id, byProduct.get(productId) ?? 0]),
          catchError(() => of<[number, number | null]>([id, null])),
        ),
      ),
    ).subscribe((rows) => {
      if (request === this.stockRequest) this.originStock.set(new Map(rows));
    });
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
