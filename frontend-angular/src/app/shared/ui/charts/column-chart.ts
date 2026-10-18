import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { Tooltip } from '../tooltip/tooltip';

export interface ColumnItem {
  readonly label: string;
  readonly value: number;
  /** Texto completo para lectores de pantalla y la descripción emergente (p. ej. "Mayo 2026: $ 12 M"). */
  readonly title: string;
}

/** Columnas por periodo (p. ej. ventas mensuales). La última, el periodo actual, va en el color principal. */
@Component({
  selector: 'app-column-chart',
  imports: [Tooltip],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  template: `
    @if (items().length === 0) {
      <p class="py-6 text-center text-sm text-fg-subtle">{{ emptyText() }}</p>
    } @else {
      <div class="flex h-40 items-end gap-2">
        @for (item of items(); track $index; let last = $last) {
          <div class="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-2">
            <div
              class="w-full max-w-10 rounded-t-md outline-none transition-colors focus-visible:ring-2 focus-visible:ring-brand/40"
              [class]="last ? 'bg-brand hover:bg-brand-soft' : 'bg-fg-subtle/40 hover:bg-fg-subtle/60'"
              [style.height.%]="height(item.value)"
              role="img"
              tabindex="0"
              [attr.aria-label]="item.title"
              [appTooltip]="item.title"
              tooltipDelay="0"
            ></div>
            <span class="text-xs text-fg-subtle">{{ item.label }}</span>
          </div>
        }
      </div>
    }
  `,
})
export class ColumnChart {
  readonly items = input.required<readonly ColumnItem[]>();
  readonly emptyText = input('Sin datos todavía');

  private readonly max = computed(() => Math.max(0, ...this.items().map((item) => item.value)));

  /** Alto relativo al mayor, dejando espacio para la etiqueta; un valor positivo nunca desaparece (mínimo 3 %). */
  protected height(value: number): number {
    const max = this.max();
    if (max <= 0 || value <= 0) return 0;
    return Math.max(3, (value / max) * 88);
  }
}
