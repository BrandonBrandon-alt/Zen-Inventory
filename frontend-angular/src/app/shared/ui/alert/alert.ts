import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { LucideCircleAlert } from '@lucide/angular';

export type AlertVariant = 'danger' | 'warning' | 'success' | 'info';

const STYLES: Record<AlertVariant, string> = {
  danger: 'bg-danger/10 border-danger/25 text-danger',
  warning: 'bg-warning/10 border-warning/25 text-warning',
  success: 'bg-success/10 border-success/25 text-success',
  info: 'bg-info/10 border-info/25 text-info',
};

/** Mensaje destacado. `danger` y `warning` interrumpen al lector de pantalla; el resto, no. */
@Component({
  selector: 'app-alert',
  imports: [LucideCircleAlert],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  template: `
    <div
      class="flex items-center gap-2.5 rounded-md border px-4 py-3 text-[13px]"
      [class]="styles()"
      [attr.role]="role()"
    >
      <svg lucideCircleAlert [size]="15" class="shrink-0" />
      <span><ng-content /></span>
    </div>
  `,
})
export class Alert {
  readonly variant = input<AlertVariant>('danger');

  protected readonly styles = computed(() => STYLES[this.variant()]);
  protected readonly role = computed(() =>
    this.variant() === 'danger' || this.variant() === 'warning' ? 'alert' : 'status',
  );
}
