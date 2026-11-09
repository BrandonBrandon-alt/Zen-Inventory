import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { LucideMoon, LucideSun } from '@lucide/angular';
import { ThemeService } from '@core/theme/theme.service';

/**
 * Interruptor de tema claro/oscuro. Cambia el tema de toda la app (lo guarda `ThemeService`), así que puede
 * ponerse en cualquier pantalla: `icon` para esquinas (login) y `row` para filas de menú (sidebar).
 */
@Component({
  selector: 'app-theme-toggle',
  imports: [LucideSun, LucideMoon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[class]': "variant() === 'row' ? 'block' : 'inline-flex'" },
  template: `
    <button
      type="button"
      class="flex cursor-pointer items-center text-fg-muted transition-colors hover:text-fg focus-visible:ring-2 focus-visible:ring-brand/40 focus-visible:outline-none"
      [class]="buttonClasses()"
      [attr.aria-label]="label()"
      (click)="toggle($event)"
    >
      @if (theme.isDark()) {
        <svg lucideSun [size]="18" class="shrink-0" />
      } @else {
        <svg lucideMoon [size]="18" class="shrink-0" />
      }
      @if (variant() === 'row' && labelVisible()) {
        <span class="text-[13px]">{{ label() }}</span>
      }
    </button>
  `,
})
export class ThemeToggle {
  protected readonly theme = inject(ThemeService);

  /** `icon`: botón redondo solo con icono. `row`: fila a todo el ancho, con texto opcional. */
  readonly variant = input<'icon' | 'row'>('icon');
  /** Solo en `row`: muestra el texto junto al icono (se oculta, p. ej., con el sidebar colapsado). */
  readonly labelVisible = input(true);

  /** Pide el cambio con el centro del botón como origen de la animación (también al activarlo con el teclado). */
  protected toggle(event: Event): void {
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    this.theme.toggle({ x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 });
  }

  protected label(): string {
    return this.theme.isDark() ? 'Modo claro' : 'Modo oscuro';
  }

  protected buttonClasses(): string {
    if (this.variant() === 'icon') {
      return 'size-9 justify-center rounded-full border border-line bg-card hover:bg-hover';
    }
    return `w-full gap-3 rounded-md px-3 py-2 hover:bg-hover ${this.labelVisible() ? '' : 'justify-center'}`;
  }
}
