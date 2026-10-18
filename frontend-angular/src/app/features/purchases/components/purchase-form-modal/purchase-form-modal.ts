import { ChangeDetectionStrategy, Component, DestroyRef, computed, effect, inject, input, model, output, signal, untracked } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormArray, FormControl, NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { LucidePackage, LucidePlus, LucideStore, LucideTrash2, LucideTruck } from '@lucide/angular';
import { toApiError } from '@core/api/api-error';
import type { BranchOption } from '@core/branches/branch-options-api';
import type { ProductOption, SupplierOption } from '@core/catalog/catalog-options-api';
import { NotificationService } from '@core/notifications/notification.service';
import { formatMoney } from '@shared/format/format';
import { applyServerErrors } from '@shared/forms/apply-server-errors';
import { controlError } from '@shared/forms/control-error';
import { Alert } from '@shared/ui/alert/alert';
import { Button } from '@shared/ui/button/button';
import { FormField, InputDirective } from '@shared/ui/form-field/form-field';
import { Modal } from '@shared/ui/modal/modal';
import { Select, type SelectOption } from '@shared/ui/select/select';
import { Tooltip } from '@shared/ui/tooltip/tooltip';
import { type Purchase, PurchasesApi } from '../../data-access/purchases-api';

const REQUIRED = { required: 'Elige una opción.' };
const LEAD = { required: 'Escribe los días.', min: 'Debe ser al menos 1 día.', pattern: 'Debe ser un número entero.' };
const DUE = { required: 'Escribe los días.', min: 'No puede ser negativo.', pattern: 'Debe ser un número entero.' };
const QUANTITY = { required: 'Escribe la cantidad.', min: 'Debe ser mayor que 0.' };
const PRICE = { required: 'Escribe el precio.', min: 'Debe ser mayor que 0.' };
const DISCOUNT = { min: 'No puede ser negativo.', max: 'No puede superar 100.' };

let nextId = 0;

function itemGroup(fb: NonNullableFormBuilder) {
  return fb.group({
    productId: new FormControl<number | null>(null, Validators.required),
    quantity: new FormControl<number | null>(null, [Validators.required, Validators.min(0.0001)]),
    unitPrice: new FormControl<number | null>(null, [Validators.required, Validators.min(0.01)]),
    discountPct: new FormControl<number | null>(0, [Validators.min(0), Validators.max(100)]),
  });
}
type ItemGroup = ReturnType<typeof itemGroup>;

/**
 * Nueva orden de compra a un proveedor. Al elegir proveedor y producto se propone el precio pactado (se puede cambiar).
 * Una orden creada por un gerente queda aprobada; la de un operador espera aprobación (lo decide el servidor).
 */
@Component({
  selector: 'app-purchase-form-modal',
  imports: [ReactiveFormsModule, Modal, Button, Alert, FormField, InputDirective, Select, Tooltip, LucidePlus, LucideTrash2],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './purchase-form-modal.html',
})
export class PurchaseFormModal {
  private readonly api = inject(PurchasesApi);
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly notifications = inject(NotificationService);
  private readonly destroyRef = inject(DestroyRef);

  readonly open = model(false);
  readonly suppliers = input<readonly SupplierOption[]>([]);
  readonly products = input<readonly ProductOption[]>([]);
  readonly branches = input<readonly BranchOption[]>([]);
  /** Solo el ADMIN elige la sucursal de la orden; los demás compran para la suya. */
  readonly chooseBranch = input(false);
  /** La orden ya creada en el servidor. */
  readonly saved = output<Purchase>();

  protected readonly formId = `app-purchase-form-${nextId++}`;
  protected readonly saving = signal(false);
  protected readonly serverError = signal<string | null>(null);
  protected readonly formatMoney = formatMoney;
  protected readonly storeIcon = LucideStore.icon;
  protected readonly truckIcon = LucideTruck.icon;
  protected readonly productIcon = LucidePackage.icon;

  protected readonly form = this.fb.group({
    supplierId: new FormControl<number | null>(null, Validators.required),
    branchId: new FormControl<number | null>(null),
    leadTimeDays: new FormControl<number | null>(1, [Validators.required, Validators.min(1), Validators.pattern(/^\d+$/)]),
    paymentDueDays: new FormControl<number | null>(30, [Validators.required, Validators.min(0), Validators.pattern(/^\d+$/)]),
    items: new FormArray<ItemGroup>([]),
  });

  /** Total de la orden, recalculado mientras se escribe. */
  protected readonly total = signal(0);

  protected readonly supplierOptions = computed<SelectOption<number>[]>(() =>
    this.suppliers().map((s) => ({ value: s.id, label: s.nombre })),
  );
  protected readonly branchOptions = computed<SelectOption<number>[]>(() =>
    this.branches().filter((b) => b.activa).map((b) => ({ value: b.id, label: b.nombre })),
  );

  /** Solo productos activos; uno ya agregado en otra fila no se ofrece otra vez. */
  protected productOptions(row: ItemGroup): SelectOption<number>[] {
    const own = row.controls.productId.value;
    const taken = new Set(this.form.controls.items.controls.map((g) => g.controls.productId.value));
    const supplier = this.form.controls.supplierId.value;
    return this.products()
      .filter((p) => p.active || p.id === own)
      .map((p) => {
        const agreed = supplier !== null && p.suppliers.some((s) => s.supplierId === supplier);
        return {
          value: p.id,
          label: p.nombre,
          description: [p.sku, agreed ? 'Con precio pactado' : ''].filter(Boolean).join(' · ') || undefined,
          disabled: p.id !== own && taken.has(p.id),
        };
      });
  }

  /** Subtotal de una fila: cantidad × precio, menos el descuento. */
  protected lineTotal(row: ItemGroup): number {
    return lineSubtotal(row.getRawValue());
  }

  constructor() {
    effect(() => {
      if (!this.open()) return;
      untracked(() => {
        this.form.controls.items.clear({ emitEvent: false });
        this.form.reset({ supplierId: null, branchId: null, leadTimeDays: 1, paymentDueDays: 30 }, { emitEvent: false });
        this.addItem();
        this.recalculate();
        this.serverError.set(null);
      });
    });
    this.form.controls.supplierId.valueChanges.pipe(takeUntilDestroyed()).subscribe((id) => this.supplierChosen(id));
    this.form.valueChanges.pipe(takeUntilDestroyed()).subscribe(() => {
      this.serverError.set(null);
      this.recalculate();
    });
  }

  protected error(field: 'supplierId' | 'branchId' | 'leadTimeDays' | 'paymentDueDays'): string | null {
    const messages = { supplierId: REQUIRED, branchId: REQUIRED, leadTimeDays: LEAD, paymentDueDays: DUE }[field];
    return controlError(this.form.controls[field], messages);
  }

  protected itemError(row: ItemGroup, field: 'productId' | 'quantity' | 'unitPrice' | 'discountPct'): string | null {
    const messages = { productId: REQUIRED, quantity: QUANTITY, unitPrice: PRICE, discountPct: DISCOUNT }[field];
    return controlError(row.controls[field], messages);
  }

  protected addItem(): void {
    const row = itemGroup(this.fb);
    // Al elegir el producto se propone el precio pactado con el proveedor de la orden.
    row.controls.productId.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((productId) => {
      const agreement = this.products().find((p) => p.id === productId)?.suppliers.find((s) => s.supplierId === this.form.controls.supplierId.value);
      if (agreement && agreement.price > 0 && row.controls.unitPrice.value === null) row.controls.unitPrice.setValue(agreement.price);
    });
    this.form.controls.items.push(row);
  }

  protected removeItem(index: number): void {
    this.form.controls.items.removeAt(index);
  }

  protected submit(): void {
    this.form.markAllAsTouched();
    if (this.saving()) return;
    if (this.chooseBranch() && this.form.controls.branchId.value === null) {
      this.form.controls.branchId.setErrors({ required: true });
    }
    if (this.form.controls.items.length === 0) {
      this.serverError.set('Agrega al menos un producto a la orden.');
      return;
    }
    if (this.form.invalid) return;
    const v = this.form.getRawValue();

    this.saving.set(true);
    this.form.disable({ emitEvent: false });
    this.api
      .create({
        supplierId: v.supplierId as number,
        branchId: this.chooseBranch() ? v.branchId : null,
        leadTimeDays: v.leadTimeDays as number,
        paymentDueDays: v.paymentDueDays as number,
        items: v.items.map((i) => ({
          productId: i.productId as number,
          quantity: i.quantity as number,
          unitPrice: i.unitPrice as number,
          discountPct: i.discountPct ?? 0,
        })),
      })
      .subscribe({
        next: (purchase) => {
          this.saving.set(false);
          this.form.enable({ emitEvent: false });
          this.notifications.success(
            purchase.reception === 'AWAITING_APPROVAL' ? `Orden #${purchase.id} creada: espera la aprobación de un gerente.` : `Orden #${purchase.id} creada.`,
          );
          this.saved.emit(purchase);
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

  /** Al elegir proveedor se propone su tiempo de entrega y, en las filas ya con producto, su precio pactado. */
  private supplierChosen(id: number | null): void {
    const supplier = this.suppliers().find((s) => s.id === id);
    if (supplier?.tiempoEntregaDias && supplier.tiempoEntregaDias > 0) this.form.controls.leadTimeDays.setValue(supplier.tiempoEntregaDias, { emitEvent: false });
    for (const row of this.form.controls.items.controls) {
      const agreement = this.products().find((p) => p.id === row.controls.productId.value)?.suppliers.find((s) => s.supplierId === id);
      if (agreement && agreement.price > 0) row.controls.unitPrice.setValue(agreement.price, { emitEvent: false });
    }
  }

  private recalculate(): void {
    this.total.set(this.form.controls.items.controls.reduce((sum, row) => sum + lineSubtotal(row.getRawValue()), 0));
  }
}

function lineSubtotal(row: { quantity: number | null; unitPrice: number | null; discountPct: number | null }): number {
  const gross = (row.quantity ?? 0) * (row.unitPrice ?? 0);
  return Math.round(gross * (1 - (row.discountPct ?? 0) / 100) * 100) / 100;
}
