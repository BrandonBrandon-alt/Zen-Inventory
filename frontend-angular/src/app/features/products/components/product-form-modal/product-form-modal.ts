import { ChangeDetectionStrategy, Component, DestroyRef, computed, effect, inject, input, model, output, signal, untracked } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormArray, FormControl, NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { LucidePlus, LucideRuler, LucideTrash2, LucideTruck } from '@lucide/angular';
import { toApiError } from '@core/api/api-error';
import type { SupplierOption, UnitOption } from '@core/catalog/catalog-options-api';
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
import { type Product, ProductsApi } from '../../data-access/products-api';

const NAME_MAX = 150;
const SKU_MAX = 50;
const SKU_PATTERN = /^[A-Z0-9-]+$/;

const SKU_MESSAGES: Record<string, string> = {
  required: 'El SKU es requerido.',
  maxlength: `El SKU no puede superar ${SKU_MAX} caracteres.`,
  pattern: 'Solo letras mayúsculas, números y guiones.',
};
const NAME_MESSAGES: Record<string, string> = {
  required: 'El nombre es requerido.',
  maxlength: `El nombre no puede superar ${NAME_MAX} caracteres.`,
};
const UNIT_MESSAGES: Record<string, string> = { required: 'Elige la unidad base.' };
const MONEY_MESSAGES: Record<string, string> = { required: 'Escribe un valor.', min: 'No puede ser negativo.' };
const SUPPLIER_MESSAGES: Record<string, string> = { required: 'Elige un proveedor.' };
const DAYS_MESSAGES: Record<string, string> = { required: 'Escribe los días.', min: 'No puede ser negativo.' };

let nextId = 0;

function supplierGroup(fb: NonNullableFormBuilder) {
  return fb.group({
    supplierId: new FormControl<number | null>(null, Validators.required),
    negotiatedPrice: new FormControl<number | null>(null, [Validators.required, Validators.min(0)]),
    deliveryDays: new FormControl<number | null>(null, [Validators.required, Validators.min(0)]),
    preferred: fb.control(false),
  });
}
type SupplierGroup = ReturnType<typeof supplierGroup>;

/**
 * Formulario de creación (sin `product`) o edición (con `product`) de un producto, dentro de un modal.
 *
 * El costo promedio lo calcula el sistema con cada compra: se pide solo al crear (costo inicial) y al editar se
 * muestra sin poder cambiarlo.
 */
@Component({
  selector: 'app-product-form-modal',
  imports: [ReactiveFormsModule, Modal, Button, Alert, FormField, InputDirective, Select, Tooltip, LucidePlus, LucideTrash2],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './product-form-modal.html',
})
export class ProductFormModal {
  private readonly api = inject(ProductsApi);
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly destroyRef = inject(DestroyRef);
  private readonly notifications = inject(NotificationService);

  readonly open = model(false);
  /** Producto a editar; sin él, el formulario crea uno nuevo. */
  readonly product = input<Product | null>(null);
  readonly units = input<readonly UnitOption[]>([]);
  readonly suppliers = input<readonly SupplierOption[]>([]);
  /** El producto ya guardado en el servidor. */
  readonly saved = output<Product>();

  protected readonly formId = `app-product-form-${nextId++}`;
  protected readonly saving = signal(false);
  protected readonly serverError = signal<string | null>(null);
  protected readonly formatMoney = formatMoney;
  protected readonly unitIcon = LucideRuler.icon;
  protected readonly truckIcon = LucideTruck.icon;

  protected readonly form = this.fb.group({
    sku: ['', [Validators.required, Validators.maxLength(SKU_MAX), Validators.pattern(SKU_PATTERN)]],
    nombre: ['', [Validators.required, Validators.maxLength(NAME_MAX)]],
    unitId: new FormControl<number | null>(null, Validators.required),
    cost: new FormControl<number | null>(null, [Validators.required, Validators.min(0)]),
    price: new FormControl<number | null>(null, [Validators.required, Validators.min(0)]),
    activo: this.fb.control(true),
    suppliers: new FormArray<SupplierGroup>([]),
  });

  protected readonly unitOptions = computed<SelectOption<number>[]>(() =>
    this.units().map((unit) => ({ value: unit.id, label: unit.nombre, description: unit.abreviatura })),
  );

  /** Los proveedores ya elegidos en otras filas no se ofrecen otra vez. */
  protected supplierOptions(row: SupplierGroup): SelectOption<number>[] {
    const own = row.controls.supplierId.value;
    const taken = new Set(this.form.controls.suppliers.controls.map((g) => g.controls.supplierId.value));
    return this.suppliers().map((supplier) => ({
      value: supplier.id,
      label: supplier.nombre,
      disabled: supplier.id !== own && taken.has(supplier.id),
    }));
  }

  constructor() {
    effect(() => {
      if (!this.open()) return;
      const product = this.product();
      untracked(() => {
        // Primero el reinicio y después las filas: `reset` sin la clave `suppliers` vaciaría sus valores.
        this.form.controls.suppliers.clear({ emitEvent: false });
        this.form.reset(
          {
            sku: product?.sku ?? '',
            nombre: product?.nombre ?? '',
            unitId: product?.unitId ?? null,
            cost: product?.cost ?? null,
            price: product?.price ?? null,
            activo: product?.activo ?? true,
          },
          { emitEvent: false },
        );
        for (const s of product?.suppliers ?? []) {
          const row = supplierGroup(this.fb);
          row.setValue({ supplierId: s.supplierId, negotiatedPrice: s.negotiatedPrice, deliveryDays: s.deliveryDays, preferred: s.preferred });
          this.form.controls.suppliers.push(row, { emitEvent: false });
        }
        // El costo de un producto existente lo calcula el sistema: no se valida ni se edita.
        if (product) this.form.controls.cost.disable({ emitEvent: false });
        else this.form.controls.cost.enable({ emitEvent: false });
        this.serverError.set(null);
      });
    });
    this.form.valueChanges.pipe(takeUntilDestroyed()).subscribe(() => this.serverError.set(null));
  }

  protected error(field: 'sku' | 'nombre' | 'unitId' | 'cost' | 'price'): string | null {
    const messages = { sku: SKU_MESSAGES, nombre: NAME_MESSAGES, unitId: UNIT_MESSAGES, cost: MONEY_MESSAGES, price: MONEY_MESSAGES }[field];
    return controlError(this.form.controls[field], messages);
  }

  protected supplierError(row: SupplierGroup, field: 'supplierId' | 'negotiatedPrice' | 'deliveryDays'): string | null {
    const messages = { supplierId: SUPPLIER_MESSAGES, negotiatedPrice: MONEY_MESSAGES, deliveryDays: DAYS_MESSAGES }[field];
    return controlError(row.controls[field], messages);
  }

  /** El SKU solo admite mayúsculas: se escribe en mayúsculas mientras se teclea. */
  protected upperSku(event: Event): void {
    const input = event.target as HTMLInputElement;
    const upper = input.value.toUpperCase();
    if (upper !== input.value) {
      input.value = upper;
      this.form.controls.sku.setValue(upper);
    }
  }

  protected addSupplier(): void {
    const row = supplierGroup(this.fb);
    // Al elegir un proveedor se propone su tiempo de entrega habitual (se puede cambiar).
    row.controls.supplierId.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((id) => {
      const supplier = this.suppliers().find((s) => s.id === id);
      if (supplier?.tiempoEntregaDias != null && row.controls.deliveryDays.value === null) {
        row.controls.deliveryDays.setValue(supplier.tiempoEntregaDias);
      }
    });
    this.form.controls.suppliers.push(row);
  }

  protected removeSupplier(index: number): void {
    this.form.controls.suppliers.removeAt(index);
  }

  /** Solo un proveedor puede ser el preferido: marcar uno desmarca el resto. */
  protected setPreferred(row: SupplierGroup, preferred: boolean): void {
    if (preferred) {
      for (const other of this.form.controls.suppliers.controls) other.controls.preferred.setValue(other === row);
    } else {
      row.controls.preferred.setValue(false);
    }
  }

  protected submit(): void {
    this.form.markAllAsTouched();
    if (this.form.invalid || this.saving()) return;

    const value = this.form.getRawValue();
    const current = this.product();
    const input = {
      sku: value.sku,
      nombre: value.nombre,
      cost: value.cost as number,
      price: value.price as number,
      unitId: value.unitId as number,
      suppliers: value.suppliers.map((s) => ({
        supplierId: s.supplierId as number,
        negotiatedPrice: s.negotiatedPrice as number,
        deliveryDays: s.deliveryDays as number,
        preferred: s.preferred,
      })),
      ...(current ? { activo: value.activo } : {}),
    };
    const request = current ? this.api.update(current.id, input) : this.api.create(input);

    this.saving.set(true);
    this.form.disable({ emitEvent: false });
    request.subscribe({
      next: (product) => {
        this.saving.set(false);
        this.form.enable({ emitEvent: false });
        this.notifications.success(current ? 'Producto actualizado correctamente.' : 'Producto creado correctamente.');
        this.saved.emit(product);
        this.open.set(false);
      },
      error: (error: unknown) => {
        this.saving.set(false);
        this.form.enable({ emitEvent: false });
        if (this.product()) this.form.controls.cost.disable({ emitEvent: false });
        const apiError = toApiError(error);
        const applied = apiError.code === 'VALIDATION_FAILED' ? applyServerErrors(this.form, apiError.fieldErrors) : [];
        // Un SKU repetido llega como DUPLICATE_SKU: se muestra bajo su campo.
        if (apiError.code === 'DUPLICATE_SKU') {
          this.form.controls.sku.setErrors({ server: apiError.message });
          this.form.controls.sku.markAsTouched();
          this.serverError.set(null);
          return;
        }
        this.serverError.set(applied.length > 0 ? null : apiError.message);
      },
    });
  }
}
