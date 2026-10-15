import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/**
 * Estado vacío: explica qué falta y, si procede, ofrece la acción para resolverlo.
 * Slots: `data-slot="icon"` (dibujo) y `data-slot="action"` (botón).
 */
@Component({
  selector: 'app-empty-state',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'flex flex-col items-center justify-center gap-2.5 px-6 py-10 text-center' },
  template: `
    <div class="mb-1 text-fg-subtle opacity-70 empty:hidden"><ng-content select="[data-slot=icon]" /></div>
    <p class="text-sm font-medium text-fg-muted">{{ title() }}</p>
    @if (description(); as text) {
      <p class="max-w-72 text-[13px] text-fg-subtle">{{ text }}</p>
    }
    <div class="mt-2 empty:hidden"><ng-content select="[data-slot=action]" /></div>
  `,
})
export class EmptyState {
  readonly title = input.required<string>();
  readonly description = input<string>();
}
