import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { LucideChevronLeft, LucideChevronRight } from '@lucide/angular';
import { Tooltip } from '../tooltip/tooltip';

/** Paginación: "11–20 de 42" y botones anterior/siguiente. No pagina datos: solo emite la página pedida. */
@Component({
  selector: 'app-pagination',
  imports: [LucideChevronLeft, LucideChevronRight, Tooltip],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'flex flex-wrap items-center justify-between gap-x-3 gap-y-2 text-[13px] text-fg-subtle' },
  template: `
    <p aria-live="polite" class="whitespace-nowrap tabular-nums">
      @if (total() === 0) {
        Sin resultados
      } @else {
        {{ from() }}–{{ to() }} de {{ total() }}
      }
    </p>
    <div class="flex items-center gap-1">
      <button
        type="button"
        class="flex size-8 cursor-pointer items-center justify-center rounded-md border border-line text-fg-muted transition-colors hover:bg-hover hover:text-fg focus-visible:ring-2 focus-visible:ring-brand/40 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent"
        aria-label="Página anterior"
        appTooltip="Página anterior"
        [disabled]="page() <= 1"
        (click)="pageChange.emit(page() - 1)"
      >
        <svg lucideChevronLeft [size]="16" />
      </button>
      <span class="min-w-20 px-2 text-center whitespace-nowrap tabular-nums">Página {{ page() }} de {{ pageCount() }}</span>
      <button
        type="button"
        class="flex size-8 cursor-pointer items-center justify-center rounded-md border border-line text-fg-muted transition-colors hover:bg-hover hover:text-fg focus-visible:ring-2 focus-visible:ring-brand/40 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent"
        aria-label="Página siguiente"
        appTooltip="Página siguiente"
        [disabled]="page() >= pageCount()"
        (click)="pageChange.emit(page() + 1)"
      >
        <svg lucideChevronRight [size]="16" />
      </button>
    </div>
  `,
})
export class Pagination {
  readonly page = input.required<number>();
  readonly pageSize = input.required<number>();
  readonly total = input.required<number>();

  readonly pageChange = output<number>();

  protected readonly pageCount = computed(() => Math.max(1, Math.ceil(this.total() / this.pageSize())));
  protected readonly from = computed(() => (this.page() - 1) * this.pageSize() + 1);
  protected readonly to = computed(() => Math.min(this.page() * this.pageSize(), this.total()));
}
