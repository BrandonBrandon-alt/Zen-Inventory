import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/** Indicador de carga. Toma el color del texto del contenedor (`currentColor`). */
@Component({
  selector: 'app-spinner',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'inline-flex' },
  template: `
    <svg
      role="status"
      aria-label="Cargando"
      class="animate-spin shrink-0"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2.5"
      [attr.width]="size()"
      [attr.height]="size()"
    >
      <path d="M21 12a9 9 0 1 1-6.22-8.56" stroke-linecap="round" />
    </svg>
  `,
})
export class Spinner {
  readonly size = input(22);
}
