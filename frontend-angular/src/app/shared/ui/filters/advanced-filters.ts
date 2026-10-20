import { ChangeDetectionStrategy, Component, input, model } from '@angular/core';
import { LucideChevronDown, LucideSlidersHorizontal } from '@lucide/angular';

let nextId = 0;

/**
 * Panel plegable de "Más filtros": los campos van dentro y la cantidad de filtros activos se ve en el botón aunque
 * esté cerrado. Quien lo usa guarda `open` si quiere que se recuerde.
 *
 * ```html
 * <app-advanced-filters [(open)]="advancedOpen" [activeCount]="advancedCount()">
 *   …campos…
 * </app-advanced-filters>
 * ```
 */
@Component({
  selector: 'app-advanced-filters',
  imports: [LucideSlidersHorizontal, LucideChevronDown],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  template: `
    <button
      type="button"
      class="inline-flex h-9 cursor-pointer items-center gap-2 rounded-lg border border-line bg-surface px-3 text-sm text-fg-muted transition-colors hover:text-fg focus-visible:outline-2 focus-visible:outline-brand"
      [attr.aria-expanded]="open()"
      [attr.aria-controls]="panelId"
      (click)="open.set(!open())"
    >
      <svg lucideSlidersHorizontal [size]="16" aria-hidden="true"></svg>
      Más filtros
      @if (activeCount() > 0) {
        <span class="inline-flex min-w-5 items-center justify-center rounded-full bg-brand px-1.5 text-[11px] font-semibold text-white" [attr.aria-label]="activeCount() + (activeCount() === 1 ? ' filtro activo' : ' filtros activos')">{{ activeCount() }}</span>
      }
      <svg lucideChevronDown [size]="14" aria-hidden="true" class="transition-transform" [class.rotate-180]="open()"></svg>
    </button>
    @if (open()) {
      <div [id]="panelId" role="group" aria-label="Más filtros" class="mt-3 grid animate-reveal grid-cols-1 items-end gap-x-3 gap-y-4 rounded-lg border border-line bg-surface p-4 sm:grid-cols-2 lg:grid-cols-4">
        <ng-content />
      </div>
    }
  `,
})
export class AdvancedFilters {
  readonly open = model(false);
  /** Cuántos filtros del panel están aplicados (se ve en el botón aunque el panel esté cerrado). */
  readonly activeCount = input(0);
  protected readonly panelId = `app-advanced-filters-${nextId++}`;
}
