import { ChangeDetectionStrategy, Component, booleanAttribute, computed, input } from '@angular/core';
import { Spinner } from '../spinner/spinner';

export type ButtonVariant = 'primary' | 'ghost' | 'ghost-brand' | 'ghost-danger' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

const BASE =
  'inline-flex cursor-pointer items-center justify-center gap-2 font-semibold tracking-tight ' +
  'transition-[background-color,border-color,color,box-shadow,transform,opacity] duration-200 outline-none focus-visible:ring-2 focus-visible:ring-brand/40 ' +
  'disabled:cursor-not-allowed disabled:opacity-55 enabled:hover:-translate-y-px ' +
  'enabled:active:translate-y-0 enabled:active:scale-[0.98]';

const VARIANTS: Record<ButtonVariant, string> = {
  primary:
    'bg-primary text-primary-fg border border-transparent enabled:hover:bg-primary-hover enabled:hover:shadow-lg',
  ghost: 'bg-transparent text-fg-muted border border-transparent enabled:hover:bg-hover',
  // Acciones de fila con icono: neutras en reposo; al pasar el cursor, color principal (editar) o rojo (desactivar).
  'ghost-brand':
    'bg-transparent text-fg-muted border border-transparent enabled:hover:bg-brand/10 enabled:hover:text-brand',
  'ghost-danger':
    'bg-transparent text-fg-muted border border-transparent enabled:hover:bg-danger/10 enabled:hover:text-danger',
  danger: 'bg-danger/10 text-danger border border-danger/30 enabled:hover:bg-danger/20',
};

const SIZES: Record<ButtonSize, string> = {
  sm: 'px-3.5 py-[7px] text-[13px] rounded-sm',
  md: 'px-[18px] py-2.5 text-sm rounded-md',
  lg: 'px-[22px] py-3 text-[14.5px] rounded-md',
};

/** Botón nativo con estilos del sistema de diseño. Uso: `<button appButton variant="danger">`. */
@Component({
  // Selector de atributo sobre <button> a propósito: conserva la semántica y los atributos nativos (type, form…).
  // eslint-disable-next-line @angular-eslint/component-selector
  selector: 'button[appButton]',
  imports: [Spinner],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[class]': 'classes()',
    '[disabled]': 'isDisabled()',
    '[attr.aria-busy]': 'loading() || null',
  },
  template: `
    @if (loading()) {
      <app-spinner [size]="14" />
    }
    <ng-content />
  `,
})
export class Button {
  readonly variant = input<ButtonVariant>('primary');
  readonly size = input<ButtonSize>('md');
  readonly loading = input(false, { transform: booleanAttribute });
  readonly fullWidth = input(false, { transform: booleanAttribute });
  readonly disabled = input(false, { transform: booleanAttribute });

  protected readonly isDisabled = computed(() => this.disabled() || this.loading());
  protected readonly classes = computed(() =>
    [BASE, VARIANTS[this.variant()], SIZES[this.size()], this.fullWidth() ? 'w-full' : ''].join(' '),
  );
}
