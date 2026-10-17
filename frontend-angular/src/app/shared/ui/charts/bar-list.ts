import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

export interface BarItem {
  readonly label: string;
  readonly value: number;
  /** Texto secundario bajo la etiqueta (p. ej. "12 ventas"). */
  readonly note?: string;
}

/**
 * Ranking en barras horizontales: el nombre y el valor se leen como texto (la barra solo refuerza la proporción),
 * así que funciona igual para lectores de pantalla. La primera barra, la mayor, va en el color principal.
 */
@Component({
  selector: 'app-bar-list',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  template: `
    @if (items().length === 0) {
      <p class="py-6 text-center text-sm text-fg-subtle">{{ emptyText() }}</p>
    } @else {
      <ul class="flex flex-col gap-3.5">
        @for (item of items(); track $index; let i = $index) {
          <li>
            <div class="flex items-baseline justify-between gap-3 text-sm">
              <span class="min-w-0 truncate text-fg">{{ item.label }}</span>
              <span class="shrink-0 font-semibold text-fg tabular-nums">{{ format()(item.value) }}</span>
            </div>
            @if (item.note) {
              <div class="text-xs text-fg-subtle">{{ item.note }}</div>
            }
            <div class="mt-1.5 h-1.5 overflow-hidden rounded-full bg-hover" aria-hidden="true">
              <div class="h-full rounded-full" [class]="i === 0 && highlightFirst() ? 'bg-brand' : 'bg-fg-subtle/45'" [style.width.%]="width(item.value)"></div>
            </div>
          </li>
        }
      </ul>
    }
  `,
})
export class BarList {
  readonly items = input.required<readonly BarItem[]>();
  readonly format = input<(value: number) => string>((value) => String(value));
  readonly highlightFirst = input(true);
  readonly emptyText = input('Sin datos todavía');

  private readonly max = computed(() => Math.max(0, ...this.items().map((item) => item.value)));

  /** Ancho relativo al mayor; las barras con valor no se reducen a nada (mínimo 2 %). */
  protected width(value: number): number {
    const max = this.max();
    if (max <= 0 || value <= 0) return 0;
    return Math.max(2, (value / max) * 100);
  }
}
