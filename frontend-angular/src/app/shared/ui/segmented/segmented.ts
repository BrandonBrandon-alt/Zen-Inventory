import { ChangeDetectionStrategy, Component, ElementRef, input, model, viewChildren } from '@angular/core';

export interface SegmentedOption<T extends string = string> {
  readonly value: T;
  readonly label: string;
}

/**
 * Control segmentado: elegir una opción entre pocas y siempre visibles (rango de fechas, vista). Es un grupo de
 * opciones excluyentes (`radiogroup`): flechas para moverse, una sola entra en el orden de tabulación.
 *
 * ```html
 * <app-segmented [(value)]="range" [options]="ranges" ariaLabel="Periodo" />
 * ```
 */
@Component({
  selector: 'app-segmented',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'inline-flex' },
  template: `
    <div role="radiogroup" class="inline-flex rounded-lg border border-line bg-card p-0.5" [attr.aria-label]="ariaLabel() || null">
      @for (option of options(); track option.value; let i = $index) {
        <button
          #radio
          type="button"
          role="radio"
          class="cursor-pointer rounded-md px-3.5 py-1.5 text-sm font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-brand/40"
          [class]="option.value === value() ? 'bg-hover text-fg shadow-sm' : 'text-fg-subtle hover:text-fg'"
          [attr.aria-checked]="option.value === value()"
          [attr.tabindex]="option.value === value() ? 0 : -1"
          (click)="value.set(option.value)"
          (keydown)="onKeydown($event, i)"
        >
          {{ option.label }}
        </button>
      }
    </div>
  `,
})
export class Segmented<T extends string = string> {
  readonly options = input.required<readonly SegmentedOption<T>[]>();
  readonly value = model.required<T>();
  readonly ariaLabel = input<string>();

  private readonly radios = viewChildren<ElementRef<HTMLButtonElement>>('radio');

  protected onKeydown(event: KeyboardEvent, index: number): void {
    const count = this.options().length;
    const target =
      event.key === 'ArrowRight' || event.key === 'ArrowDown' ? (index + 1) % count
      : event.key === 'ArrowLeft' || event.key === 'ArrowUp' ? (index - 1 + count) % count
      : null;
    if (target === null) return;
    event.preventDefault();
    this.value.set(this.options()[target].value);
    this.radios()[target]?.nativeElement.focus();
  }
}
