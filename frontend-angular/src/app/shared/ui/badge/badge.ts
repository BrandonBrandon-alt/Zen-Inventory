import { ChangeDetectionStrategy, Component, booleanAttribute, computed, input } from '@angular/core';

export type BadgeVariant = 'success' | 'danger' | 'warning' | 'info' | 'neutral';

const STYLES: Record<BadgeVariant, string> = {
  success: 'bg-success/12 text-success border-success/25',
  danger: 'bg-brand/12 text-brand-soft border-brand/25',
  warning: 'bg-warning/10 text-warning border-warning/25',
  info: 'bg-info/10 text-info border-info/25',
  neutral: 'bg-hover text-fg-subtle border-line',
};

/** Pastilla de estado ("Activa", "Pendiente"…). El color nunca es la única señal: lleva siempre texto. */
@Component({
  selector: 'app-badge',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold whitespace-nowrap',
    '[class]': 'styles()',
  },
  template: `
    @if (dot()) {
      <span class="size-1.5 shrink-0 rounded-full bg-current" aria-hidden="true"></span>
    }
    <ng-content />
  `,
})
export class Badge {
  readonly variant = input<BadgeVariant>('neutral');
  /** Punto de color antes del texto. */
  readonly dot = input(false, { transform: booleanAttribute });

  protected readonly styles = computed(() => STYLES[this.variant()]);
}
