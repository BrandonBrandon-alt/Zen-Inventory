import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { LucideCircleAlert, LucideCircleCheck, LucideDynamicIcon, LucideInfo, LucideTriangleAlert, LucideX } from '@lucide/angular';

export type ToastKind = 'error' | 'warning' | 'success' | 'info';

/**
 * Por tipo: la barra lateral y el ícono de color; el fondo del ícono, el mismo color muy suave. Los nombres de clase van
 * completos (no armados) para que Tailwind los genere.
 */
const STYLES: Record<ToastKind, { bar: string; badge: string; icon: typeof LucideInfo.icon; label: string }> = {
  error: { bar: 'bg-danger', badge: 'bg-danger/15 text-danger', icon: LucideCircleAlert.icon, label: 'Error' },
  warning: { bar: 'bg-warning', badge: 'bg-warning/15 text-warning', icon: LucideTriangleAlert.icon, label: 'Atención' },
  success: { bar: 'bg-success', badge: 'bg-success/15 text-success', icon: LucideCircleCheck.icon, label: 'Listo' },
  info: { bar: 'bg-info', badge: 'bg-info/15 text-info', icon: LucideInfo.icon, label: 'Aviso' },
};

/**
 * Aviso flotante. Fondo sólido (el de las tarjetas) y texto con el color normal para que se lea sobre cualquier
 * pantalla; el tipo se distingue por la barra lateral, el ícono y la etiqueta. Los errores y advertencias se anuncian
 * como `alert`; los éxitos y avisos, como `status`.
 */
@Component({
  selector: 'app-toast',
  imports: [LucideDynamicIcon, LucideX],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'relative block' },
  template: `
    <div
      class="relative flex items-start gap-3 overflow-hidden rounded-lg border border-line bg-card py-3 pr-10 pl-4 text-fg shadow-xl ring-1 ring-black/5"
      [attr.role]="role()"
    >
      <span class="absolute inset-y-0 left-0 w-1" [class]="style().bar" aria-hidden="true"></span>
      <span class="flex size-8 shrink-0 items-center justify-center rounded-full" [class]="style().badge" aria-hidden="true">
        <svg [lucideIcon]="style().icon" [size]="18"></svg>
      </span>
      <span class="min-w-0 pt-0.5">
        <span class="block text-xs font-semibold tracking-wide text-fg-muted uppercase">{{ style().label }}</span>
        <span class="block text-sm leading-snug font-medium text-fg">{{ message() }}</span>
      </span>
    </div>
    <button
      type="button"
      class="absolute top-2 right-2 flex cursor-pointer rounded-md p-1.5 text-fg-subtle transition-colors hover:bg-hover hover:text-fg focus-visible:ring-2 focus-visible:ring-brand/40 focus-visible:outline-none"
      aria-label="Cerrar aviso"
      (click)="dismissed.emit()"
    >
      <svg lucideX [size]="14" />
    </button>
  `,
})
export class Toast {
  readonly kind = input.required<ToastKind>();
  readonly message = input.required<string>();
  readonly dismissed = output<void>();

  protected readonly style = computed(() => STYLES[this.kind()]);
  protected readonly role = computed(() => (this.kind() === 'error' || this.kind() === 'warning' ? 'alert' : 'status'));
}
