import { ChangeDetectionStrategy, Component, forwardRef, input, model, signal } from '@angular/core';
import { type ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

/**
 * Casilla de verificación propia de la app. Usa un `<input type="checkbox">` real (oculto a la vista, no al teclado ni
 * a los lectores de pantalla) y dibuja encima su propia caja, así conserva el comportamiento nativo —espacio para
 * marcar, foco, nombre accesible— con el aspecto de Zen Inventory: la caja se tiñe de la marca y la marca de verificación
 * se traza al marcarla.
 *
 * El texto proyectado es su etiqueta; sin texto, `ariaLabel` da el nombre.
 *
 * ```html
 * <app-checkbox [(checked)]="soloSinMinimo">Solo sin mínimo definido</app-checkbox>
 * <app-checkbox formControlName="activo">Usuario activo</app-checkbox>
 * ```
 */
@Component({
  selector: 'app-checkbox',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'inline-flex' },
  providers: [{ provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => Checkbox), multi: true }],
  template: `
    <label class="group flex items-center gap-2.5 text-sm text-fg-muted" [class]="disabledState() ? 'cursor-not-allowed opacity-55' : 'cursor-pointer'">
      <input
        type="checkbox"
        class="peer sr-only"
        [checked]="checked()"
        [disabled]="disabledState()"
        [attr.aria-label]="ariaLabel() || null"
        (change)="onToggle($event)"
        (blur)="onTouched()"
      />
      <span
        class="relative flex size-5 shrink-0 items-center justify-center rounded-md border transition-[background-color,border-color,box-shadow,transform] duration-150 peer-focus-visible:ring-2 peer-focus-visible:ring-brand/40 peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-base peer-enabled:group-active:scale-90"
        [class]="
          checked()
            ? 'border-brand bg-brand shadow-[0_0_0_3px_var(--brand-glow)]'
            : 'border-neutral-500 bg-card peer-enabled:group-hover:border-brand-soft'
        "
        aria-hidden="true"
      >
        <svg viewBox="0 0 16 16" class="size-3.5 fill-none stroke-white" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
          <path
            d="M3.5 8.5 6.7 11.6 12.5 4.8"
            pathLength="1"
            stroke-dasharray="1"
            class="transition-[stroke-dashoffset] duration-200 ease-out motion-reduce:transition-none"
            [attr.stroke-dashoffset]="checked() ? 0 : 1"
          />
        </svg>
      </span>
      <span class="select-none empty:hidden"><ng-content /></span>
    </label>
  `,
})
export class Checkbox implements ControlValueAccessor {
  /** Si está marcada; con `[(checked)]` se enlaza a un valor, con formularios reactivos lo maneja el control. */
  readonly checked = model(false);
  /** Nombre accesible cuando no hay texto visible. */
  readonly ariaLabel = input('');

  protected readonly disabledState = signal(false);
  private onChange: (value: boolean) => void = () => undefined;
  protected onTouched: () => void = () => undefined;

  protected onToggle(event: Event): void {
    const value = (event.target as HTMLInputElement).checked;
    this.checked.set(value);
    this.onChange(value);
  }

  writeValue(value: boolean | null): void {
    this.checked.set(!!value);
  }

  registerOnChange(fn: (value: boolean) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(disabled: boolean): void {
    this.disabledState.set(disabled);
  }
}
