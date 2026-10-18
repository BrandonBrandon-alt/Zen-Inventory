import { ChangeDetectionStrategy, Component, DestroyRef, Directive, ElementRef, contentChild, forwardRef, inject, input } from '@angular/core';
import { LucideMinus, LucidePlus } from '@lucide/angular';

let nextId = 0;

/**
 * Cualquier control que `app-form-field` pueda etiquetar: la etiqueta apunta a su `id`. Lo implementan el
 * `<input>`/`<select>` con `appInput` y el componente `app-select`.
 */
export abstract class FieldControl {
  abstract readonly id: string;
  /** Solo los campos numéricos: suben o bajan el valor un paso (los botones − y + de `app-form-field`). */
  step?(direction: 1 | -1): void;
}

/** Estilos de un `<input>`, `<select>` o `<textarea>` del sistema de diseño. Dentro de `app-form-field` hereda errores y etiqueta. */
@Directive({
  selector: 'input[appInput], select[appInput], textarea[appInput]',
  host: {
    class:
      'w-full rounded-md border border-line bg-card px-3.5 py-[11px] text-sm text-fg outline-none ' +
      'transition-[border-color,box-shadow] duration-200 placeholder:text-fg-subtle ' +
      'focus:border-brand focus:ring-3 focus:ring-brand/20 disabled:opacity-60 ' +
      'aria-[invalid=true]:border-danger/50 aria-[invalid=true]:focus:border-danger ' +
      'aria-[invalid=true]:focus:ring-danger/15 ' +
      'group-has-[[data-slot=prefix]]:pl-10 group-has-[[data-slot=suffix]]:pr-12',
    '[id]': 'id',
    '[attr.aria-invalid]': 'field?.error() ? true : null',
    '[attr.aria-describedby]': 'field?.error() ? field?.errorId : null',
    // Deja espacio a la derecha para los botones − y +.
    '[style.padding-right]': 'numeric ? "5.25rem" : null',
    // La rueda del ratón no debe cambiar el número al pasar por encima de un campo enfocado.
    '(wheel)': 'numeric && blurOnWheel($event)',
  },
  providers: [{ provide: FieldControl, useExisting: forwardRef(() => InputDirective) }],
})
export class InputDirective implements FieldControl {
  readonly id = `app-input-${nextId++}`;
  protected readonly field = inject(FormField, { optional: true });
  private readonly element = inject<ElementRef<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>>(ElementRef).nativeElement;

  /** `type="number"` es estático en todas las plantillas: se lee una vez. */
  protected readonly numeric = this.element instanceof HTMLInputElement && this.element.type === 'number';

  /** Solo existe en campos numéricos: es lo que hace aparecer los botones − y + en `app-form-field`. */
  readonly step: FieldControl['step'] = this.numeric ? (direction) => this.stepBy(direction) : undefined;

  /**
   * Sube o baja el valor un paso (el atributo `step`; con `step="any"` o sin él, 1), respetando `min` y `max`.
   * Si el campo está vacío parte de 0. Avisa con un evento `input` para que el formulario se entere.
   */
  private stepBy(direction: 1 | -1): void {
    const input = this.element;
    if (!(input instanceof HTMLInputElement) || !this.numeric || input.disabled || input.readOnly) return;
    const stepAttr = Number(input.step);
    const step = Number.isFinite(stepAttr) && stepAttr > 0 ? stepAttr : 1;
    const current = input.value === '' || Number.isNaN(Number(input.value)) ? 0 : Number(input.value);
    let next = current + direction * step;
    // 0.1 + 0.2 no da 0.3 en coma flotante: se redondea a los decimales del paso y del valor.
    const decimals = Math.min(8, Math.max(decimalsOf(step), decimalsOf(current)));
    next = Number(next.toFixed(decimals));
    if (input.min !== '' && next < Number(input.min)) next = Number(input.min);
    if (input.max !== '' && next > Number(input.max)) next = Number(input.max);
    input.value = String(next);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  }

  protected blurOnWheel(event: Event): void {
    if (this.element === this.element.ownerDocument.activeElement) (this.element as HTMLElement).blur();
    event.stopPropagation();
  }
}

function decimalsOf(value: number): number {
  const [, fraction = ''] = String(value).split('.');
  return fraction.length;
}

/** Etiqueta + control + mensaje de error. Los iconos se proyectan con `data-slot="prefix|suffix"`. */
@Component({
  selector: 'app-form-field',
  imports: [LucideMinus, LucidePlus],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'group flex flex-col gap-1.5' },
  template: `
    @if (label(); as text) {
      <label
        class="text-[13px] font-medium"
        [class]="error() ? 'text-danger' : 'text-fg-muted'"
        [attr.for]="control()?.id"
        >{{ text }}</label
      >
    }
    <div class="relative">
      <span
        class="pointer-events-none absolute top-1/2 left-3.5 flex -translate-y-1/2"
        [class]="error() ? 'text-danger' : 'text-fg-subtle'"
      >
        <ng-content select="[data-slot=prefix]" />
      </span>
      <ng-content />
      <span class="absolute top-1/2 right-3 flex -translate-y-1/2">
        <ng-content select="[data-slot=suffix]" />
      </span>
      @if (control()?.step) {
        <span class="absolute top-1/2 right-1.5 flex -translate-y-1/2 gap-0.5 group-has-[:disabled]:pointer-events-none group-has-[:disabled]:opacity-50">
          <button type="button" tabindex="-1" aria-label="Disminuir" [class]="stepperClass" (pointerdown)="press(-1, $event)" (pointerup)="release()" (pointerleave)="release()" (pointercancel)="release()" (keydown.enter)="control()?.step?.(-1)">
            <svg lucideMinus [size]="14" aria-hidden="true"></svg>
          </button>
          <button type="button" tabindex="-1" aria-label="Aumentar" [class]="stepperClass" (pointerdown)="press(1, $event)" (pointerup)="release()" (pointerleave)="release()" (pointercancel)="release()" (keydown.enter)="control()?.step?.(1)">
            <svg lucidePlus [size]="14" aria-hidden="true"></svg>
          </button>
        </span>
      }
    </div>
    @if (error(); as message) {
      <p [id]="errorId" role="alert" class="flex animate-error-in items-center gap-1 text-xs text-danger">{{ message }}</p>
    }
  `,
})
export class FormField {
  readonly label = input<string>();
  readonly error = input<string | null>(null);

  readonly errorId = `app-field-error-${nextId++}`;
  protected readonly control = contentChild(FieldControl);

  protected readonly stepperClass =
    'flex size-7 cursor-pointer items-center justify-center rounded-md text-fg-subtle transition-colors ' +
    'hover:bg-hover hover:text-fg active:bg-brand/15 active:text-brand focus-visible:ring-2 focus-visible:ring-brand/40 focus-visible:outline-none';

  private holdTimer: ReturnType<typeof setTimeout> | null = null;
  private repeatTimer: ReturnType<typeof setInterval> | null = null;

  constructor() {
    inject(DestroyRef).onDestroy(() => this.release());
  }

  /** Un paso al pulsar; si se mantiene pulsado, sigue subiendo o bajando a ritmo constante. */
  protected press(direction: 1 | -1, event: PointerEvent): void {
    // El botón no debe quitarle el foco al campo (ni abrir un menú con el botón derecho).
    event.preventDefault();
    if (event.button !== 0) return;
    this.release();
    this.control()?.step?.(direction);
    this.holdTimer = setTimeout(() => {
      this.repeatTimer = setInterval(() => this.control()?.step?.(direction), 70);
    }, 400);
  }

  protected release(): void {
    if (this.holdTimer) clearTimeout(this.holdTimer);
    if (this.repeatTimer) clearInterval(this.repeatTimer);
    this.holdTimer = this.repeatTimer = null;
  }
}
