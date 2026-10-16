import { ChangeDetectionStrategy, Component, Directive, contentChild, inject, input } from '@angular/core';

let nextId = 0;

/** Estilos de un `<input>` o `<select>` del sistema de diseño. Dentro de `app-form-field` hereda errores y etiqueta. */
@Directive({
  selector: 'input[appInput], select[appInput]',
  host: {
    class:
      'w-full rounded-md border border-line bg-card px-3.5 py-[11px] text-sm text-fg outline-none ' +
      'transition-[border-color,box-shadow] duration-200 placeholder:text-fg-subtle ' +
      'focus:border-brand focus:ring-3 focus:ring-brand/20 disabled:opacity-60 ' +
      'aria-[invalid=true]:border-danger/50 aria-[invalid=true]:focus:border-danger ' +
      'aria-[invalid=true]:focus:ring-danger/15 ' +
      'group-has-[[data-slot=prefix]]:pl-10 group-has-[[data-slot=suffix]]:pr-12',
    '[id]': 'id',
    '[attr.aria-invalid]': 'field?.error() ? true : null',
    '[attr.aria-describedby]': 'field?.error() ? field?.errorId : null',
  },
})
export class InputDirective {
  readonly id = `app-input-${nextId++}`;
  protected readonly field = inject(FormField, { optional: true });
}

/** Etiqueta + control + mensaje de error. Los iconos se proyectan con `data-slot="prefix|suffix"`. */
@Component({
  selector: 'app-form-field',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'group flex flex-col gap-1.5' },
  template: `
    @if (label(); as text) {
      <label
        class="text-[13px] font-medium"
        [class]="error() ? 'text-danger' : 'text-fg-muted'"
        [attr.for]="control()?.id"
        >{{ text }}</label
      >
    }
    <div class="relative">
      <span
        class="pointer-events-none absolute top-1/2 left-3.5 flex -translate-y-1/2"
        [class]="error() ? 'text-danger' : 'text-fg-subtle'"
      >
        <ng-content select="[data-slot=prefix]" />
      </span>
      <ng-content />
      <span class="absolute top-1/2 right-3 flex -translate-y-1/2">
        <ng-content select="[data-slot=suffix]" />
      </span>
    </div>
    @if (error(); as message) {
      <p [id]="errorId" role="alert" class="flex animate-error-in items-center gap-1 text-xs text-danger">{{ message }}</p>
    }
  `,
})
export class FormField {
  readonly label = input<string>();
  readonly error = input<string | null>(null);

  readonly errorId = `app-field-error-${nextId++}`;
  protected readonly control = contentChild(InputDirective);
}
