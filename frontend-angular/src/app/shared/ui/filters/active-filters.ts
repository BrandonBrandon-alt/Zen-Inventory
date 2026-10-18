import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { LucideX } from '@lucide/angular';

/** Un filtro aplicado: `label` es de qué (Estado), `text` es cuál (Anulada). */
export interface ActiveFilter {
  readonly id: string;
  readonly label: string;
  readonly text: string;
}

/**
 * Los filtros que están aplicando, como etiquetas que se quitan una a una. Sirve sobre todo porque hay filtros que se
 * recuerdan entre visitas o que viven en el panel de "Más filtros": así nunca queda uno activo sin que se vea.
 */
@Component({
  selector: 'app-active-filters',
  imports: [LucideX],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  template: `
    @if (filters().length > 0) {
      <div role="group" aria-label="Filtros aplicados" class="flex flex-wrap items-center gap-2">
        @for (filter of filters(); track filter.id) {
          <span class="inline-flex items-center gap-1 rounded-full border border-line bg-surface py-0.5 pr-1 pl-3 text-xs text-fg-muted">
            <span class="text-fg-subtle">{{ filter.label }}:</span>
            <span class="font-medium text-fg">{{ filter.text }}</span>
            <button
              type="button"
              class="inline-flex size-5 cursor-pointer items-center justify-center rounded-full text-fg-subtle transition-colors hover:bg-brand/15 hover:text-fg focus-visible:outline-2 focus-visible:outline-brand"
              [attr.aria-label]="'Quitar filtro ' + filter.label + ': ' + filter.text"
              (click)="removed.emit(filter.id)"
            >
              <svg lucideX [size]="12" aria-hidden="true"></svg>
            </button>
          </span>
        }
        <button type="button" class="cursor-pointer text-xs text-fg-subtle underline-offset-2 hover:text-fg hover:underline focus-visible:outline-2 focus-visible:outline-brand" (click)="cleared.emit()">
          Quitar filtros
        </button>
      </div>
    }
  `,
})
export class ActiveFilters {
  readonly filters = input.required<readonly ActiveFilter[]>();
  readonly removed = output<string>();
  readonly cleared = output<void>();
}
