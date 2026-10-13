import { ChangeDetectionStrategy, Component, model } from '@angular/core';
import { LucideEye, LucideEyeOff } from '@lucide/angular';

/** Botón para mostrar u ocultar una contraseña. Se coloca en el slot `suffix` de un `FormField`. */
@Component({
  selector: 'app-password-toggle',
  imports: [LucideEye, LucideEyeOff],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'flex' },
  template: `
    <button
      type="button"
      class="flex cursor-pointer rounded-sm text-fg-subtle transition-colors hover:text-fg-muted focus-visible:ring-2 focus-visible:ring-brand/40 focus-visible:outline-none"
      [attr.aria-label]="visible() ? 'Ocultar contraseña' : 'Mostrar contraseña'"
      [attr.aria-pressed]="visible()"
      (click)="visible.set(!visible())"
    >
      @if (visible()) {
        <svg lucideEyeOff [size]="16" />
      } @else {
        <svg lucideEye [size]="16" />
      }
    </button>
  `,
})
export class PasswordToggle {
  readonly visible = model(false);
}
