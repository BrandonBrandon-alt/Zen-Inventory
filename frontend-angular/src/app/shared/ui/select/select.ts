import { DOCUMENT } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  Injector,
  afterNextRender,
  booleanAttribute,
  computed,
  effect,
  forwardRef,
  inject,
  input,
  model,
  signal,
  viewChild,
} from '@angular/core';
import { type ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { LucideCheck, LucideChevronDown, LucideDynamicIcon, LucideSearch, type LucideIconData } from '@lucide/angular';
import { normalizeText } from '../../format/format';
import { FieldControl, FormField } from '../form-field/form-field';

/** Una opción del selector. `icon` y `description` son opcionales. */
export interface SelectOption<T = unknown> {
  readonly value: T;
  readonly label: string;
  readonly icon?: LucideIconData;
  readonly description?: string;
  readonly disabled?: boolean;
}

let nextId = 0;

/**
 * Selector desplegable propio (reemplaza al `<select>` nativo): iconos por opción, búsqueda interna y teclado
 * completo. Funciona con formularios reactivos (`formControlName`), con `[(value)]` y dentro de `app-form-field`.
 *
 * ```html
 * <app-form-field label="Sucursal">
 *   <app-select formControlName="sucursalId" [options]="branches()" searchable [icon]="Store" placeholder="Elige una sucursal" />
 * </app-form-field>
 * ```
 *
 * - El panel usa la capa superior del navegador (`popover`): no lo recorta un modal ni un contenedor con scroll.
 * - Teclado: ↓/↑ mueven, Enter elige, Escape cierra (sin cerrar el modal que lo contiene), Inicio/Fin saltan, Tab sale.
 */
@Component({
  selector: 'app-select',
  imports: [LucideDynamicIcon, LucideChevronDown, LucideSearch, LucideCheck],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block', '(document:pointerdown)': 'onDocumentPointerDown($event)' },
  providers: [
    { provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => Select), multi: true },
    { provide: FieldControl, useExisting: forwardRef(() => Select) },
  ],
  template: `
    <button
      #trigger
      type="button"
      role="combobox"
      class="flex w-full cursor-pointer items-center gap-2 rounded-md border border-line bg-card px-3.5 py-[11px] text-left text-sm text-fg outline-none transition-[border-color,box-shadow] duration-200 hover:border-fg-subtle/40 focus-visible:border-brand focus-visible:ring-3 focus-visible:ring-brand/20 disabled:cursor-not-allowed disabled:opacity-60 aria-[invalid=true]:border-danger/50 aria-[invalid=true]:focus-visible:border-danger aria-[invalid=true]:focus-visible:ring-danger/15"
      [id]="id"
      [disabled]="isDisabled()"
      aria-haspopup="listbox"
      [attr.aria-expanded]="open()"
      [attr.aria-controls]="open() ? listboxId : null"
      [attr.aria-label]="ariaLabel() || null"
      [attr.aria-invalid]="field?.error() ? true : null"
      [attr.aria-describedby]="field?.error() ? field?.errorId : null"
      (click)="toggle()"
      (keydown)="onKeydown($event)"
    >
      @if (triggerIcon(); as iconData) {
        <svg [lucideIcon]="iconData" [size]="16" class="shrink-0 text-fg-subtle" aria-hidden="true" />
      }
      <span class="min-w-0 flex-1 truncate" [class.text-fg-subtle]="!selected()">{{ selected()?.label ?? placeholder() }}</span>
      <svg lucideChevronDown [size]="16" class="shrink-0 text-fg-subtle transition-transform duration-200" [class.rotate-180]="open()" aria-hidden="true" />
    </button>

    @if (open()) {
      <div
        #panel
        [attr.popover]="supportsPopover ? 'manual' : null"
        class="m-0 overflow-hidden rounded-lg border border-line bg-card p-0 text-fg shadow-2xl animate-alert-in"
        style="position: fixed; inset: auto"
      >
        @if (searchable()) {
          <div class="flex items-center gap-2 border-b border-line px-3">
            <svg lucideSearch [size]="15" class="shrink-0 text-fg-subtle" aria-hidden="true" />
            <input
              #search
              type="text"
              class="w-full bg-transparent py-2.5 text-sm text-fg outline-none placeholder:text-fg-subtle"
              [placeholder]="searchPlaceholder()"
              [attr.aria-label]="searchPlaceholder()"
              [attr.aria-controls]="listboxId"
              [attr.aria-activedescendant]="activeOptionId()"
              autocomplete="off"
              [value]="query()"
              (input)="onQuery($event)"
              (keydown)="onKeydown($event)"
            />
          </div>
        }
        <ul #list [id]="listboxId" role="listbox" class="max-h-64 overflow-y-auto p-1" [attr.aria-label]="ariaLabel() || placeholder()">
          @for (option of visible(); track $index; let i = $index) {
            <!-- Patrón combobox: el foco se queda en el selector y el teclado lo gestiona él (aria-activedescendant); la opción solo responde al ratón. -->
            <!-- eslint-disable-next-line @angular-eslint/template/click-events-have-key-events, @angular-eslint/template/interactive-supports-focus -->
            <li
              role="option"
              class="flex cursor-pointer items-center gap-2.5 rounded-md px-2.5 py-2 text-sm"
              [id]="optionId(i)"
              [class.bg-hover]="i === activeIndex()"
              [class.text-brand]="isSelected(option)"
              [class.opacity-50]="option.disabled"
              [class.cursor-not-allowed]="option.disabled"
              [attr.aria-selected]="isSelected(option)"
              [attr.aria-disabled]="option.disabled || null"
              (mousedown)="$event.preventDefault()"
              (mousemove)="hover(i)"
              (click)="choose(option)"
            >
              @if (option.icon) {
                <svg [lucideIcon]="option.icon" [size]="16" class="shrink-0 text-fg-subtle" aria-hidden="true" />
              }
              <span class="min-w-0 flex-1">
                <span class="block truncate">{{ option.label }}</span>
                @if (option.description) {
                  <span class="block truncate text-xs text-fg-subtle">{{ option.description }}</span>
                }
              </span>
              @if (isSelected(option)) {
                <svg lucideCheck [size]="15" class="shrink-0" aria-hidden="true" />
              }
            </li>
          } @empty {
            <li class="px-3 py-3 text-center text-sm text-fg-subtle" role="presentation">{{ emptyText() }}</li>
          }
        </ul>
      </div>
    }
  `,
})
export class Select<T = unknown> implements ControlValueAccessor, FieldControl {
  private readonly document = inject(DOCUMENT);
  private readonly injector = inject(Injector);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  protected readonly field = inject(FormField, { optional: true });

  private readonly trigger = viewChild.required<ElementRef<HTMLButtonElement>>('trigger');
  private readonly panel = viewChild<ElementRef<HTMLElement>>('panel');
  private readonly search = viewChild<ElementRef<HTMLInputElement>>('search');
  private readonly list = viewChild<ElementRef<HTMLElement>>('list');

  /** Valor elegido; `null` si no hay. Bidireccional (`[(value)]`) y sincronizado con el formulario. */
  readonly value = model<T | null>(null);
  readonly options = input.required<readonly SelectOption<T>[]>();
  readonly placeholder = input('Selecciona una opción');
  /** Muestra un cuadro de búsqueda dentro del panel. */
  readonly searchable = input(false, { transform: booleanAttribute });
  readonly searchPlaceholder = input('Buscar…');
  readonly emptyText = input('Sin resultados');
  /** Icono del selector cuando no hay una opción con su propio icono elegida. */
  readonly icon = input<LucideIconData>();
  /** Nombre accesible cuando no se usa dentro de `app-form-field` con etiqueta. */
  readonly ariaLabel = input<string>();
  readonly disabled = input(false, { transform: booleanAttribute });

  /** Capa superior del navegador (Popover API); sin ella el panel queda en línea, posicionado igualmente. */
  protected readonly supportsPopover = typeof HTMLElement !== 'undefined' && typeof HTMLElement.prototype.showPopover === 'function';

  readonly id = `app-select-${nextId}`;
  protected readonly listboxId = `app-select-list-${nextId++}`;

  protected readonly open = signal(false);
  protected readonly query = signal('');
  protected readonly activeIndex = signal(-1);
  private readonly formDisabled = signal(false);
  protected readonly isDisabled = computed(() => this.disabled() || this.formDisabled());

  protected readonly selected = computed(() => this.options().find((option) => option.value === this.value()) ?? null);
  protected readonly triggerIcon = computed(() => this.selected()?.icon ?? this.icon());
  protected readonly visible = computed(() => {
    const needle = normalizeText(this.query().trim());
    if (needle === '') return this.options();
    return this.options().filter((option) => normalizeText(`${option.label} ${option.description ?? ''}`).includes(needle));
  });
  protected readonly activeOptionId = computed(() => (this.open() && this.activeIndex() >= 0 ? this.optionId(this.activeIndex()) : null));

  private onChange: (value: T | null) => void = () => undefined;
  private onTouched: () => void = () => undefined;

  constructor() {
    // Mientras está abierto, el panel sigue al selector si la página se desplaza o cambia de tamaño.
    effect((onCleanup) => {
      if (!this.open()) return;
      const view = this.document.defaultView;
      const place = () => this.place();
      view?.addEventListener('resize', place);
      view?.addEventListener('scroll', place, true);
      onCleanup(() => {
        view?.removeEventListener('resize', place);
        view?.removeEventListener('scroll', place, true);
      });
    });
  }

  // ---- ControlValueAccessor ----
  writeValue(value: T | null): void {
    this.value.set(value ?? null);
  }
  registerOnChange(fn: (value: T | null) => void): void {
    this.onChange = fn;
  }
  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }
  setDisabledState(disabled: boolean): void {
    this.formDisabled.set(disabled);
    if (disabled) this.close(false);
  }

  protected optionId(index: number): string {
    return `${this.listboxId}-opt-${index}`;
  }

  protected isSelected(option: SelectOption<T>): boolean {
    return option.value === this.value();
  }

  protected toggle(): void {
    if (this.open()) this.close(true);
    else this.openPanel();
  }

  private openPanel(): void {
    if (this.isDisabled() || this.open()) return;
    this.query.set('');
    const selectedIndex = this.options().findIndex((option) => option.value === this.value() && !option.disabled);
    this.activeIndex.set(selectedIndex >= 0 ? selectedIndex : this.firstEnabled(this.options(), 0, 1));
    this.open.set(true);
    // Cuando el panel ya está en el DOM: capa superior, posición y foco en la búsqueda.
    afterNextRender(
      () => {
        const panel = this.panel()?.nativeElement;
        if (panel && typeof panel.showPopover === 'function') {
          try {
            panel.showPopover();
          } catch {
            // Ya estaba mostrado.
          }
        }
        this.place();
        this.search()?.nativeElement.focus();
        this.scrollActiveIntoView();
      },
      { injector: this.injector },
    );
  }

  private close(returnFocus: boolean): void {
    if (!this.open()) return;
    const panel = this.panel()?.nativeElement;
    if (panel && typeof panel.hidePopover === 'function') {
      try {
        panel.hidePopover();
      } catch {
        // Ya estaba oculto.
      }
    }
    this.open.set(false);
    this.activeIndex.set(-1);
    this.onTouched();
    if (returnFocus) this.trigger().nativeElement.focus();
  }

  protected choose(option: SelectOption<T>): void {
    if (option.disabled) return;
    this.value.set(option.value);
    this.onChange(option.value);
    this.close(true);
  }

  protected hover(index: number): void {
    if (!this.visible()[index]?.disabled) this.activeIndex.set(index);
  }

  protected onQuery(event: Event): void {
    this.query.set((event.target as HTMLInputElement).value);
    this.activeIndex.set(this.firstEnabled(this.visible(), 0, 1));
  }

  protected onDocumentPointerDown(event: PointerEvent): void {
    if (this.open() && !this.host.nativeElement.contains(event.target as Node)) this.close(false);
  }

  protected onKeydown(event: KeyboardEvent): void {
    const options = this.visible();
    switch (event.key) {
      case 'ArrowDown':
      case 'ArrowUp': {
        event.preventDefault();
        if (!this.open()) {
          this.openPanel();
          return;
        }
        const step = event.key === 'ArrowDown' ? 1 : -1;
        this.activeIndex.set(this.firstEnabled(options, this.activeIndex() + step, step));
        this.scrollActiveIntoView();
        return;
      }
      case 'Home':
      case 'End':
        if (!this.open() || this.searchable()) return; // en el cuadro de búsqueda mueven el cursor
        event.preventDefault();
        this.activeIndex.set(event.key === 'Home' ? this.firstEnabled(options, 0, 1) : this.firstEnabled(options, options.length - 1, -1));
        this.scrollActiveIntoView();
        return;
      case 'Enter':
      case ' ': {
        if (event.key === ' ' && this.searchable() && this.open()) return; // espacio dentro de la búsqueda
        event.preventDefault();
        if (!this.open()) {
          this.openPanel();
          return;
        }
        const active = options[this.activeIndex()];
        if (active) this.choose(active);
        return;
      }
      case 'Escape':
        if (this.open()) {
          // No debe cerrar también el modal o la pantalla que lo contiene.
          event.preventDefault();
          event.stopPropagation();
          this.close(true);
        }
        return;
      case 'Tab':
        this.close(false);
        return;
      default:
        if (!this.searchable() && event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
          this.jumpToInitial(event.key);
        }
    }
  }

  /** Sin búsqueda: escribir una letra salta a la siguiente opción que empieza por ella. */
  private jumpToInitial(letter: string): void {
    const options = this.visible();
    const initial = normalizeText(letter);
    const start = this.open() ? this.activeIndex() + 1 : 0;
    for (let offset = 0; offset < options.length; offset++) {
      const index = (start + offset) % options.length;
      if (!options[index].disabled && normalizeText(options[index].label).startsWith(initial)) {
        if (!this.open()) this.openPanel();
        this.activeIndex.set(index);
        this.scrollActiveIntoView();
        return;
      }
    }
  }

  /** Primera opción habilitada a partir de `from` yendo en el sentido `step`, con vuelta al otro extremo. */
  private firstEnabled(options: readonly SelectOption<T>[], from: number, step: 1 | -1): number {
    if (options.length === 0) return -1;
    for (let offset = 0; offset < options.length; offset++) {
      const index = (((from + offset * step) % options.length) + options.length) % options.length;
      if (!options[index].disabled) return index;
    }
    return -1;
  }

  private scrollActiveIntoView(): void {
    const index = this.activeIndex();
    if (index < 0) return;
    this.list()?.nativeElement.querySelector(`#${CSS.escape(this.optionId(index))}`)?.scrollIntoView?.({ block: 'nearest' });
  }

  /** Coloca el panel bajo el selector (o encima si abajo no cabe). Usa coordenadas de la ventana: va en la capa superior. */
  private place(): void {
    const panel = this.panel()?.nativeElement;
    if (!panel) return;
    const rect = this.trigger().nativeElement.getBoundingClientRect();
    const view = this.document.defaultView;
    const viewportHeight = view?.innerHeight ?? 0;
    const viewportWidth = view?.innerWidth ?? 0;
    const height = panel.offsetHeight;
    const below = viewportHeight - rect.bottom;
    const placeAbove = viewportHeight > 0 && below < height + 8 && rect.top > below;
    const left = viewportWidth > 0 ? Math.max(8, Math.min(rect.left, viewportWidth - rect.width - 8)) : rect.left;
    panel.style.left = `${left}px`;
    panel.style.top = placeAbove ? `${Math.max(8, rect.top - height - 4)}px` : `${rect.bottom + 4}px`;
    panel.style.width = `${rect.width}px`;
  }
}
