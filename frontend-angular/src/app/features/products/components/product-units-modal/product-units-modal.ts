import { ChangeDetectionStrategy, Component, computed, effect, inject, input, model, signal, untracked } from '@angular/core';
import { type AbstractControl, NonNullableFormBuilder, ReactiveFormsModule, type ValidationErrors, Validators } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { LucidePlus, LucideRuler, LucideTrash2 } from '@lucide/angular';
import { toApiError } from '@core/api/api-error';
import type { UnitOption } from '@core/catalog/catalog-options-api';
import { NotificationService } from '@core/notifications/notification.service';
import { formatQuantity } from '@shared/format/format';
import { controlError } from '@shared/forms/control-error';
import { Alert } from '@shared/ui/alert/alert';
import { Badge } from '@shared/ui/badge/badge';
import { Button } from '@shared/ui/button/button';
import { FormField, InputDirective } from '@shared/ui/form-field/form-field';
import { Modal } from '@shared/ui/modal/modal';
import { Select, type SelectOption } from '@shared/ui/select/select';
import { Spinner } from '@shared/ui/spinner/spinner';
import { Tooltip } from '@shared/ui/tooltip/tooltip';
import { type Product, ProductsApi, type ProductUnit } from '../../data-access/products-api';

const UNIT_MESSAGES: Record<string, string> = { required: 'Elige una unidad.' };
const FACTOR_MESSAGES: Record<string, string> = {
  required: 'Escribe la equivalencia.',
  min: 'Debe ser mayor que 0.',
  pattern: 'Máximo 4 decimales.',
};

/** La equivalencia debe ser mayor que 0. */
const positive = (control: AbstractControl): ValidationErrors | null => (Number(control.value) > 0 ? null : { min: true });

/**
 * Unidades en las que se puede manejar un producto además de su unidad base ("1 CAJA = 12 UND").
 * Cada cambio se guarda al instante: no hay botón "Guardar".
 */
@Component({
  selector: 'app-product-units-modal',
  imports: [ReactiveFormsModule, Modal, Button, Alert, Badge, FormField, InputDirective, Select, Spinner, Tooltip, LucidePlus, LucideTrash2],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-modal
      [(open)]="open"
      [title]="'Unidades de ' + (product()?.nombre ?? '')"
      description="Equivalencias respecto a la unidad base del producto."
    >
      @if (error(); as message) {
        <app-alert class="mb-4">{{ message }}</app-alert>
      }
      @if (loading()) {
        <div class="flex justify-center py-6"><app-spinner /></div>
      } @else {
        <ul class="divide-y divide-line">
          @for (unit of units(); track unit.unitId) {
            <li class="flex items-center justify-between gap-3 py-2.5">
              <p class="min-w-0 text-sm text-fg">
                @if (unit.isBase) {
                  {{ unit.nombre }} ({{ unit.abreviatura }})
                } @else {
                  1 {{ unit.abreviatura }} = {{ formatQuantity(unit.factor) }} {{ baseLabel() }}
                }
              </p>
              @if (unit.isBase) {
                <app-badge variant="info">Base</app-badge>
              } @else {
                <button
                  appButton
                  variant="ghost-danger"
                  size="sm"
                  type="button"
                  appTooltip="Quitar unidad"
                  [attr.aria-label]="'Quitar ' + unit.nombre"
                  [disabled]="busy()"
                  (click)="remove(unit)"
                >
                  <svg lucideTrash2 [size]="16" aria-hidden="true"></svg>
                </button>
              }
            </li>
          } @empty {
            <li class="py-2.5 text-sm text-fg-subtle">Este producto solo se maneja en su unidad base.</li>
          }
        </ul>

        <form class="mt-5 grid items-start gap-3 border-t border-line pt-5 sm:grid-cols-[2fr_1fr_auto]" [formGroup]="form" novalidate (ngSubmit)="add()">
          <app-form-field label="Unidad" [error]="fieldError('unitId')">
            <app-select formControlName="unitId" [options]="options()" [icon]="unitIcon" searchable searchPlaceholder="Buscar unidad…" placeholder="Selecciona" />
          </app-form-field>
          <app-form-field [label]="'Equivale a (' + baseAbbreviation() + ')'" [error]="fieldError('factor')">
            <input appInput type="number" min="0" step="0.0001" inputmode="decimal" formControlName="factor" />
          </app-form-field>
          <button appButton type="submit" class="sm:mt-7" [loading]="busy()">
            <svg lucidePlus [size]="16" aria-hidden="true"></svg>
            Agregar
          </button>
        </form>
      }
      <div data-slot="footer">
        <button appButton variant="ghost" type="button" (click)="open.set(false)">Cerrar</button>
      </div>
    </app-modal>
  `,
})
export class ProductUnitsModal {
  private readonly api = inject(ProductsApi);
  private readonly notifications = inject(NotificationService);

  readonly open = model(false);
  readonly product = input<Product | null>(null);
  readonly allUnits = input<readonly UnitOption[]>([]);

  protected readonly units = signal<readonly ProductUnit[]>([]);
  protected readonly loading = signal(false);
  protected readonly busy = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly unitIcon = LucideRuler.icon;
  protected readonly formatQuantity = formatQuantity;

  protected readonly form = inject(NonNullableFormBuilder).group({
    unitId: [null as number | null, Validators.required],
    // Hasta 4 decimales, como valida el servidor.
    factor: [null as number | null, [Validators.required, positive, Validators.pattern(/^\d+(\.\d{1,4})?$/)]],
  });

  protected readonly baseAbbreviation = computed(() => this.product()?.unitAbbreviation || 'base');
  protected readonly baseLabel = this.baseAbbreviation;

  /** Unidades que todavía se pueden agregar: ni la base del producto ni las ya asignadas. */
  protected readonly options = computed<SelectOption<number>[]>(() => {
    const taken = new Set(this.units().map((u) => u.unitId));
    const base = this.product()?.unitId;
    return this.allUnits()
      .filter((unit) => unit.id !== base && !taken.has(unit.id))
      .map((unit) => ({ value: unit.id, label: unit.nombre, description: unit.abreviatura }));
  });

  constructor() {
    effect(() => {
      if (!this.open()) return;
      const product = this.product();
      if (!product) return;
      untracked(() => {
        this.form.reset();
        this.error.set(null);
        void this.load(product.id);
      });
    });
  }

  protected fieldError(field: 'unitId' | 'factor'): string | null {
    return controlError(this.form.controls[field], field === 'unitId' ? UNIT_MESSAGES : FACTOR_MESSAGES);
  }

  protected async add(): Promise<void> {
    const product = this.product();
    this.form.markAllAsTouched();
    if (!product || this.form.invalid || this.busy()) return;
    const { unitId, factor } = this.form.getRawValue();
    this.busy.set(true);
    this.error.set(null);
    try {
      await firstValueFrom(this.api.addUnit(product.id, unitId as number, factor as number));
      this.form.reset();
      await this.load(product.id);
      this.notifications.success('Unidad agregada.');
    } catch (error) {
      this.error.set(toApiError(error).message);
    } finally {
      this.busy.set(false);
    }
  }

  protected async remove(unit: ProductUnit): Promise<void> {
    const product = this.product();
    if (!product || this.busy()) return;
    this.busy.set(true);
    this.error.set(null);
    try {
      await firstValueFrom(this.api.removeUnit(product.id, unit.unitId));
      await this.load(product.id);
      this.notifications.success(`Unidad "${unit.nombre}" quitada.`);
    } catch (error) {
      this.error.set(toApiError(error).message);
    } finally {
      this.busy.set(false);
    }
  }

  private async load(productId: number): Promise<void> {
    this.loading.set(true);
    try {
      this.units.set(await firstValueFrom(this.api.units(productId)));
    } catch (error) {
      this.error.set(toApiError(error).message);
    } finally {
      this.loading.set(false);
    }
  }
}
