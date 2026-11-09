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

/** Valores con los que se abre el formulario en vez de vacío. */
export interface PurchasePreset {
  readonly productId: number | null;
  readonly branchId: number | null;
}

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
  /** Lo que llega ya elegido al abrir (p. ej. desde el ajuste de stock): el producto de la primera fila y la sucursal. */
  readonly preset = input<PurchasePreset | null>(null);
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

  /** El proveedor y los productos elegidos, como señales: de ellos dependen las opciones de cada selector. */
  private readonly supplierValue = signal<number | null>(null);
  private readonly chosenProducts = signal<readonly number[]>([]);
  /** Producto que llegó ya elegido y cuyo proveedor preferido falta proponer (cuando cargue el catálogo). */
  private readonly pendingSupplierFor = signal<number | null>(null);

  /**
   * Los productos que vende el proveedor elegido (su asociación en el catálogo). `null` si no hay proveedor o si no tiene
   * ninguno asociado: entonces se ofrecen todos, para no bloquear la compra a un proveedor nuevo.
   */
  private readonly supplierCatalog = computed<ReadonlySet<number> | null>(() => {
    const supplier = this.supplierValue();
    if (supplier === null) return null;
    const ids = this.products().filter((p) => p.suppliers.some((s) => s.supplierId === supplier)).map((p) => p.id);
    return ids.length > 0 ? new Set(ids) : null;
  });
  /** El proveedor elegido no tiene productos asociados: se avisa que la lista no está filtrada. */
  protected readonly supplierWithoutCatalog = computed(
    () => this.supplierValue() !== null && this.products().length > 0 && this.supplierCatalog() === null,
  );

  /**
   * Primero los proveedores que venden los productos ya elegidos (el preferido marcado), luego los demás. Así, si se
   * llega con un producto, se ve enseguida a quién se le puede comprar.
   */
  protected readonly supplierOptions = computed<SelectOption<number>[]>(() => {
    const chosen = this.products().filter((p) => this.chosenProducts().includes(p.id));
    const options = this.suppliers().map((supplier) => {
      const deals = chosen.flatMap((p) => p.suppliers.filter((s) => s.supplierId === supplier.id));
      const sells = deals.length;
      let description: string | undefined;
      if (sells > 0) {
        const what = chosen.length === 1 ? 'Vende este producto' : `Vende ${sells} de ${chosen.length} productos`;
        description = deals.some((d) => d.preferred) ? `${what} · Preferido` : what;
      }
      return { option: { value: supplier.id, label: supplier.nombre, description }, sells };
    });
    return options.sort((a, b) => b.sells - a.sells).map((o) => o.option);
  });
  protected readonly branchOptions = computed<SelectOption<number>[]>(() =>
    this.branches().filter((b) => b.activa).map((b) => ({ value: b.id, label: b.nombre })),
  );

  /**
   * Solo productos activos y, con un proveedor elegido, solo los que ese proveedor vende. Uno ya agregado en otra fila
   * no se ofrece otra vez.
   */
  protected productOptions(row: ItemGroup): SelectOption<number>[] {
    const own = row.controls.productId.value;
    const taken = new Set(this.form.controls.items.controls.map((g) => g.controls.productId.value));
    const supplier = this.supplierValue();
    const catalog = this.supplierCatalog();
    return this.products()
      .filter((p) => (p.active && (catalog === null || catalog.has(p.id))) || p.id === own)
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
        this.supplierValue.set(null);
        this.pendingSupplierFor.set(null);
        this.addItem();
        this.applyPreset(this.preset());
        this.syncChosenProducts();
        this.recalculate();
        this.serverError.set(null);
      });
    });
    // Con un producto ya elegido se propone su proveedor preferido (o el único que lo vende) cuando llega el catálogo.
    effect(() => {
      const productId = this.pendingSupplierFor();
      const product = this.products().find((p) => p.id === productId);
      if (productId === null || !product) return;
      untracked(() => {
        this.pendingSupplierFor.set(null);
        if (this.form.controls.supplierId.value !== null) return;
        const deal = product.suppliers.find((s) => s.preferred) ?? (product.suppliers.length === 1 ? product.suppliers[0] : undefined);
        if (deal) this.form.controls.supplierId.setValue(deal.supplierId);
      });
    });
    this.form.controls.supplierId.valueChanges.pipe(takeUntilDestroyed()).subscribe((id) => this.supplierChosen(id));
    this.form.valueChanges.pipe(takeUntilDestroyed()).subscribe(() => {
      this.serverError.set(null);
      this.syncChosenProducts();
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
      // Si el precio no lo escribió la persona (vacío o propuesto antes), se propone el del producto elegido ahora.
      if (!row.controls.unitPrice.pristine && row.controls.unitPrice.value !== null) return;
      row.controls.unitPrice.setValue(agreement && agreement.price > 0 ? agreement.price : null);
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
  private applyPreset(preset: PurchasePreset | null): void {
    if (!preset) return;
    // Solo el ADMIN elige sucursal; los demás compran siempre para la suya.
    if (this.chooseBranch() && preset.branchId !== null) this.form.controls.branchId.setValue(preset.branchId, { emitEvent: false });
    if (preset.productId !== null) {
      this.form.controls.items.at(0).controls.productId.setValue(preset.productId);
      this.pendingSupplierFor.set(preset.productId);
    }
  }

  private syncChosenProducts(): void {
    const ids = this.form.controls.items.controls.map((row) => row.controls.productId.value).filter((id): id is number => id !== null);
    const current = this.chosenProducts();
    if (ids.length !== current.length || ids.some((id, i) => id !== current[i])) this.chosenProducts.set(ids);
  }

  /**
   * Al elegir proveedor: se sueltan los productos que no vende (no se le puede pedir lo que no tiene), se propone el
   * precio pactado de los que sí y el plazo de entrega: el pactado más largo entre esos productos o, si no hay, el
   * habitual del proveedor.
   */
  private supplierChosen(id: number | null): void {
    this.supplierValue.set(id);
    const catalog = this.supplierCatalog();
    const agreedDays: number[] = [];
    for (const row of this.form.controls.items.controls) {
      const productId = row.controls.productId.value;
      if (productId === null) continue;
      if (catalog !== null && !catalog.has(productId)) {
        row.controls.productId.setValue(null);
        row.controls.unitPrice.setValue(null, { emitEvent: false });
        continue;
      }
      const agreement = this.products().find((p) => p.id === productId)?.suppliers.find((s) => s.supplierId === id);
      if (agreement && agreement.price > 0) row.controls.unitPrice.setValue(agreement.price, { emitEvent: false });
      if (agreement && agreement.deliveryDays > 0) agreedDays.push(agreement.deliveryDays);
    }
    const usual = this.suppliers().find((s) => s.id === id)?.tiempoEntregaDias ?? 0;
    const days = agreedDays.length > 0 ? Math.max(...agreedDays) : usual;
    if (days > 0) this.form.controls.leadTimeDays.setValue(days, { emitEvent: false });
  }

  private recalculate(): void {
    this.total.set(this.form.controls.items.controls.reduce((sum, row) => sum + lineSubtotal(row.getRawValue()), 0));
  }
}

function lineSubtotal(row: { quantity: number | null; unitPrice: number | null; discountPct: number | null }): number {
  const gross = (row.quantity ?? 0) * (row.unitPrice ?? 0);
  return Math.round(gross * (1 - (row.discountPct ?? 0) / 100) * 100) / 100;
}
