import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { Hint } from '../hint/hint';

export type CardVariant = 'surface' | 'plain';

let nextId = 0;

/**
 * Sección con título para agrupar contenido (paneles, resúmenes). Es una región con nombre: su título es su etiqueta.
 *
 * - `surface`: sobre una superficie elevada, para lo que se actúa (listas de tareas, formularios).
 * - `plain`: solo una línea superior; para gráficas y datos de lectura, que no necesitan marco.
 *
 * ```html
 * <app-card title="Más vendidos" description="Unidades en el periodo" hint="Los productos con más unidades vendidas.">
 *   <button data-slot="actions">Ver todo</button>
 *   …contenido…
 * </app-card>
 * ```
 */
@Component({
  selector: 'app-card',
  imports: [Hint],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block', role: 'region', '[attr.aria-labelledby]': 'titleId' },
  template: `
    <div [class]="frame()">
      <div class="flex items-start justify-between gap-4">
        <div class="min-w-0">
          <div class="flex items-center gap-1.5">
            <h2 [id]="titleId" class="font-title text-xl font-bold tracking-tight text-fg">{{ title() }}</h2>
            @if (hint(); as text) {
              <app-hint [label]="title()" [text]="text" />
            }
          </div>
          @if (description(); as text) {
            <p class="mt-0.5 text-sm text-fg-subtle">{{ text }}</p>
          }
        </div>
        <div class="flex shrink-0 items-center gap-2 empty:hidden"><ng-content select="[data-slot=actions]" /></div>
      </div>
      <div class="mt-4"><ng-content /></div>
    </div>
  `,
})
export class Card {
  readonly title = input.required<string>();
  readonly description = input<string>();
  /** Explicación del contenido de la tarjeta: aparece como un icono de ayuda junto al título. */
  readonly hint = input<string>();
  readonly variant = input<CardVariant>('surface');

  protected readonly titleId = `app-card-title-${nextId++}`;
  protected readonly frame = computed(() =>
    this.variant() === 'surface' ? 'rounded-xl border border-line bg-card p-5' : 'border-t border-line pt-5',
  );
}
