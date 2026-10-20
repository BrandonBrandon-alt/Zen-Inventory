import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, afterNextRender, effect, inject, input, model, signal, viewChild, viewChildren } from '@angular/core';
import { LucideDynamicIcon, type LucideIconData } from '@lucide/angular';

export interface TabItem {
  readonly id: string;
  readonly label: string;
  readonly icon?: LucideIconData;
}

/**
 * Pestañas accesibles (patrón WAI-ARIA "tabs"): flechas, Inicio y Fin cambian de pestaña.
 *
 * La línea de la pestaña activa se desliza de una a otra (no salta); la primera vez aparece ya colocada.
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
    <div #tablist role="tablist" class="relative flex gap-1 border-b border-line" [attr.aria-label]="ariaLabel() || null">
      @for (tab of tabs(); track tab.id; let i = $index) {
        <button
          #tabButton
          type="button"
          role="tab"
          class="flex cursor-pointer items-center gap-2 px-4 py-2.5 text-sm font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-brand/40"
          [class]="tab.id === active() ? 'text-fg' : 'text-fg-subtle hover:text-fg'"
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
      <span
        class="pointer-events-none absolute bottom-0 left-0 h-0.5 rounded-full bg-brand motion-reduce:transition-none"
        [class]="animated() ? 'transition-[transform,width] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]' : ''"
        [style.width.px]="indicator().width"
        [style.transform]="'translateX(' + indicator().left + 'px)'"
        [style.opacity]="indicator().width > 0 ? 1 : 0"
        aria-hidden="true"
      ></span>
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
  private readonly tablist = viewChild<ElementRef<HTMLElement>>('tablist');

  /** Posición y ancho de la línea de la pestaña activa, medidos sobre el botón. */
  protected readonly indicator = signal({ left: 0, width: 0 });
  /** La línea solo se anima después de colocarse la primera vez: así no cruza desde el borde al abrir la página. */
  protected readonly animated = signal(false);

  private readonly destroyRef = inject(DestroyRef);

  constructor() {
    const measure = (): void => {
      const index = this.tabs().findIndex((tab) => tab.id === this.active());
      const button = this.buttons()[index]?.nativeElement;
      if (button) this.indicator.set({ left: button.offsetLeft, width: button.offsetWidth });
    };
    // Cada vez que cambia la pestaña activa (o la lista) se recoloca la línea.
    effect(() => {
      this.active();
      this.tabs();
      this.buttons();
      measure();
    });
    afterNextRender(() => {
      measure();
      // Un fotograma después: la primera colocación no se anima.
      requestAnimationFrame(() => this.animated.set(true));
      const list = this.tablist()?.nativeElement;
      if (list && typeof ResizeObserver !== 'undefined') {
        const observer = new ResizeObserver(() => measure());
        observer.observe(list);
        this.destroyRef.onDestroy(() => observer.disconnect());
      }
    });
  }

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
