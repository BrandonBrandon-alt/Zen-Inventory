import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { LucideInfo } from '@lucide/angular';
import { Tooltip, type TooltipPlacement } from '../tooltip/tooltip';

/**
 * Icono de ayuda junto a un dato o un título: al pasar el cursor, enfocarlo con el teclado o tocarlo explica qué significa.
 *
 * ```html
 * <dt>Valor promedio por venta <app-hint label="Valor promedio por venta" text="Lo que se vende en promedio en cada venta." /></dt>
 * ```
 *
 * - `label` es el nombre del dato: el botón se anuncia como «Qué significa: …» y la explicación se lee como su descripción.
 * - Es un botón (enfocable) para que el teclado y las pantallas táctiles también lleguen a la explicación.
 */
@Component({
  selector: 'app-hint',
  imports: [Tooltip, LucideInfo],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'inline-flex align-middle' },
  template: `
    <button
      type="button"
      class="inline-flex size-5 cursor-help items-center justify-center rounded-full text-fg-subtle transition-colors hover:text-fg focus-visible:text-fg focus-visible:ring-2 focus-visible:ring-brand/40 focus-visible:outline-none"
      [attr.aria-label]="'Qué significa: ' + label()"
      [appTooltip]="text()"
      [tooltipPlacement]="placement()"
      [tooltipDelay]="150"
    >
      <svg lucideInfo [size]="14" aria-hidden="true"></svg>
    </button>
  `,
})
export class Hint {
  /** Nombre del dato que explica (para el lector de pantalla). */
  readonly label = input.required<string>();
  /** La explicación. */
  readonly text = input.required<string>();
  readonly placement = input<TooltipPlacement>('top');
}
