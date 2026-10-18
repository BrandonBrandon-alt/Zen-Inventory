import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { LucideX } from '@lucide/angular';
import { Alert, type AlertVariant } from '../alert/alert';

export type ToastKind = 'error' | 'warning' | 'success' | 'info';

const VARIANTS: Record<ToastKind, AlertVariant> = {
  error: 'danger',
  warning: 'warning',
  success: 'success',
  info: 'info',
};

/** Aviso flotante: un `Alert` con botón de cerrar. */
@Component({
  selector: 'app-toast',
  imports: [Alert, LucideX],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'relative block shadow-lg' },
  template: `
    <app-alert [variant]="variant()">
      <span class="pr-6">{{ message() }}</span>
    </app-alert>
    <button
      type="button"
      class="absolute top-2 right-2 flex cursor-pointer rounded-sm p-1 text-current opacity-70 transition-opacity hover:opacity-100 focus-visible:ring-2 focus-visible:ring-brand/40 focus-visible:outline-none"
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

  protected readonly variant = computed(() => VARIANTS[this.kind()]);
}
