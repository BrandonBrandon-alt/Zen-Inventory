import { ChangeDetectionStrategy, Component, ElementRef, input, model, viewChildren } from '@angular/core';
import { LucideDynamicIcon, type LucideIconData } from '@lucide/angular';

export interface TabItem {
  readonly id: string;
  readonly label: string;
  readonly icon?: LucideIconData;
}

/**
 * Pestañas accesibles (patrón WAI-ARIA "tabs"): flechas, Inicio y Fin cambian de pestaña.
 *
 * El panel lo dibuja quien las usa, con los ids que esperan las pestañas:
 *
 * ```html
 * <app-tabs [tabs]="tabs" [(active)]="active" idPrefix="inv" ariaLabel="Secciones" />
 * <div role="tabpanel" id="inv-panel-stock" aria-labelledby="inv-tab-stock">…</div>
 * ```
 */
@Component({
  selector: 'app-tabs',
  imports: [LucideDynamicIcon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  template: `
    <div role="tablist" class="flex gap-1 border-b border-line" [attr.aria-label]="ariaLabel() || null">
      @for (tab of tabs(); track tab.id; let i = $index) {
        <button
          #tabButton
          type="button"
          role="tab"
          class="-mb-px flex cursor-pointer items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-brand/40"
          [class]="tab.id === active() ? 'border-brand text-fg' : 'border-transparent text-fg-subtle hover:text-fg'"
          [id]="idPrefix() + '-tab-' + tab.id"
          [attr.aria-selected]="tab.id === active()"
          [attr.aria-controls]="idPrefix() + '-panel-' + tab.id"
          [attr.tabindex]="tab.id === active() ? 0 : -1"
          (click)="select(tab.id)"
          (keydown)="onKeydown($event, i)"
        >
          @if (tab.icon) {
            <svg [lucideIcon]="tab.icon" [size]="16" aria-hidden="true" />
          }
          {{ tab.label }}
        </button>
      }
    </div>
  `,
})
export class Tabs {
  readonly tabs = input.required<readonly TabItem[]>();
  /** Id de la pestaña activa. Bidireccional: `[(active)]`. */
  readonly active = model.required<string>();
  /** Prefijo de los ids (`<prefix>-tab-<id>` y `<prefix>-panel-<id>`): distinto en cada grupo de pestañas de la página. */
  readonly idPrefix = input('tabs');
  readonly ariaLabel = input<string>();

  private readonly buttons = viewChildren<ElementRef<HTMLButtonElement>>('tabButton');

  protected select(id: string): void {
    this.active.set(id);
  }

  protected onKeydown(event: KeyboardEvent, index: number): void {
    const count = this.tabs().length;
    const target =
      event.key === 'ArrowRight' ? (index + 1) % count
      : event.key === 'ArrowLeft' ? (index - 1 + count) % count
      : event.key === 'Home' ? 0
      : event.key === 'End' ? count - 1
      : null;
    if (target === null) return;
    event.preventDefault();
    this.active.set(this.tabs()[target].id);
    this.buttons()[target]?.nativeElement.focus();
  }
}
