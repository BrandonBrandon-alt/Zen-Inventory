import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/**
 * Marcador de una gráfica que todavía no tiene datos: reserva el mismo espacio que ocupará (así nada salta al llegar)
 * y respira con suavidad. Es solo visual (`aria-hidden`): quien lo usa anuncia la carga con `aria-busy` en su tarjeta.
 *
 * - `area`: la tendencia por día (línea sobre una cuadrícula).
 * - `bars`: una lista de barras horizontales (más vendidos, por sede).
 * - `columns`: columnas verticales (meses recientes).
 */
@Component({
  selector: 'app-chart-skeleton',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block', 'aria-hidden': 'true' },
  template: `
    @switch (variant()) {
      @case ('area') {
        <div class="relative aspect-[4/1] w-full min-h-40 overflow-hidden rounded-lg">
          @for (line of [25, 50, 75]; track line) {
            <div class="absolute inset-x-0 border-t border-line-subtle" [style.top.%]="line"></div>
          }
          <svg viewBox="0 0 720 180" preserveAspectRatio="none" class="absolute inset-0 size-full animate-pulse motion-reduce:animate-none">
            <path d="M0 140 C90 120 150 130 220 110 S340 60 420 70 S560 120 620 100 S700 80 720 90 L720 180 L0 180 Z" class="fill-hover" />
          </svg>
        </div>
      }
      @case ('bars') {
        <ul class="flex flex-col gap-4">
          @for (width of [100, 72, 54, 38, 26]; track width) {
            <li class="flex flex-col gap-2">
              <div class="flex justify-between gap-6">
                <div class="h-3 w-2/5 animate-pulse rounded-full bg-hover motion-reduce:animate-none"></div>
                <div class="h-3 w-10 animate-pulse rounded-full bg-hover motion-reduce:animate-none"></div>
              </div>
              <div class="h-1.5 rounded-full bg-hover/60"><div class="h-full animate-pulse rounded-full bg-hover motion-reduce:animate-none" [style.width.%]="width"></div></div>
            </li>
          }
        </ul>
      }
      @default {
        <div class="flex h-40 items-end gap-3">
          @for (height of [38, 55, 44, 70, 62, 85]; track $index) {
            <div class="flex-1 animate-pulse rounded-t-md bg-hover motion-reduce:animate-none" [style.height.%]="height"></div>
          }
        </div>
      }
    }
  `,
})
export class ChartSkeleton {
  readonly variant = input<'area' | 'bars' | 'columns'>('area');
}
