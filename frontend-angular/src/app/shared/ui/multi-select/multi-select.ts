import { DOCUMENT } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
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
  numberAttribute,
  signal,
  viewChild,
} from '@angular/core';
import { type ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { LucideCheck, LucideChevronDown, LucideDynamicIcon, LucideX, type LucideIconData } from '@lucide/angular';
import { normalizeText } from '../../format/format';
import { FieldControl, FormField } from '../form-field/form-field';
import { ExitDelay } from '../motion/exit-delay';
import type { SelectOption } from '../select/select';

let nextId = 0;

/**
 * Selector de varias opciones con la búsqueda dentro del propio campo: lo elegido se ve como fichas y se escribe en el
 * mismo campo para filtrar la lista. Funciona con formularios reactivos (`formControlName`), con `[(values)]` y dentro
 * de `app-form-field`; usa el mismo `SelectOption` que `app-select`.
 *
 * ```html
 * <app-form-field label="Sucursales">
 *   <app-multi-select [(values)]="branchIds" [options]="branches()" [icon]="Store" placeholder="Todas las sucursales" />
 * </app-form-field>
 * ```
 *
 * - El panel no se cierra al elegir: se pueden marcar varias opciones seguidas. Incluye «Seleccionar visibles» (lo que
 *   deja el filtro) y «Limpiar».
 * - Teclado: ↓/↑ mueven, Enter marca o desmarca, Retroceso con el campo vacío quita la última ficha, Escape cierra
 *   (sin cerrar el modal que lo contiene), Tab sale.
 * - El panel usa la capa superior del navegador (`popover`): no lo recorta un modal ni un contenedor con scroll.
 */
@Component({
  selector: 'app-multi-select',
  imports: [LucideDynamicIcon, LucideChevronDown, LucideCheck, LucideX],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block', '(document:pointerdown)': 'onDocumentPointerDown($event)' },
  providers: [
    { provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => MultiSelect), multi: true },
    { provide: FieldControl, useExisting: forwardRef(() => MultiSelect) },
  ],
  template: `
    <!-- El clic en cualquier parte del campo lleva el foco a la búsqueda; el teclado lo gestiona esa búsqueda. -->
    <!-- eslint-disable-next-line @angular-eslint/template/click-events-have-key-events, @angular-eslint/template/interactive-supports-focus -->
    <div
      #trigger
      class="flex min-h-[44px] w-full cursor-text flex-wrap items-center gap-1.5 rounded-md border border-line bg-card px-2.5 py-1.5 text-sm text-fg transition-[border-color,box-shadow] duration-200 hover:border-fg-subtle/40 focus-within:border-brand focus-within:ring-3 focus-within:ring-brand/20"
      [class.opacity-60]="isDisabled()"
      [class.cursor-not-allowed]="isDisabled()"
      [class.border-danger/50]="field?.error()"
      (click)="onFieldClick()"
    >
      @if (icon(); as iconData) {
        <svg [lucideIcon]="iconData" [size]="16" class="ml-1 shrink-0 text-fg-subtle" aria-hidden="true" />
      }
      @for (chip of chips(); track chip.value) {
        <span class="inline-flex max-w-full items-center gap-1 rounded-md bg-hover py-0.5 pr-1 pl-2 text-[13px] text-fg">
          <span class="truncate">{{ chip.label }}</span>
          <button
            type="button"
            class="flex size-5 shrink-0 cursor-pointer items-center justify-center rounded text-fg-subtle transition-colors hover:bg-card hover:text-fg focus-visible:ring-2 focus-visible:ring-brand/40 focus-visible:outline-none disabled:cursor-not-allowed"
            [attr.aria-label]="'Quitar ' + chip.label"
            [disabled]="isDisabled()"
            (click)="remove(chip.value, $event)"
          >
            <svg lucideX [size]="12" aria-hidden="true" />
          </button>
        </span>
      }
      @if (hiddenCount() > 0) {
        <span class="rounded-md bg-hover px-2 py-0.5 text-[13px] text-fg-muted">+{{ hiddenCount() }} más</span>
      }
      <input
        #search
        type="text"
        role="combobox"
        class="min-w-24 flex-1 bg-transparent py-1 text-sm text-fg outline-none placeholder:text-fg-subtle disabled:cursor-not-allowed"
        aria-haspopup="listbox"
        aria-autocomplete="list"
        autocomplete="off"
        [id]="id"
        [disabled]="isDisabled()"
        [placeholder]="values().length === 0 ? placeholder() : searchPlaceholder()"
        [value]="query()"
        [attr.aria-expanded]="open()"
        [attr.aria-controls]="open() ? listboxId : null"
        [attr.aria-activedescendant]="activeOptionId()"
        [attr.aria-label]="ariaLabel() || null"
        [attr.aria-invalid]="field?.error() ? true : null"
        [attr.aria-describedby]="field?.error() ? field?.errorId : null"
        (input)="onQuery($event)"
        (keydown)="onKeydown($event)"
      />
      <button
        type="button"
        tabindex="-1"
        class="flex size-7 shrink-0 cursor-pointer items-center justify-center rounded text-fg-subtle disabled:cursor-not-allowed"
        [attr.aria-label]="open() ? 'Cerrar la lista' : 'Abrir la lista'"
        [disabled]="isDisabled()"
        (mousedown)="$event.preventDefault()"
        (click)="toggle($event)"
      >
        <svg lucideChevronDown [size]="16" class="transition-transform duration-200" [class.rotate-180]="open()" aria-hidden="true" />
      </button>
    </div>

    @if (open() || exit.active()) {
      <div
        #panel
        [attr.popover]="supportsPopover ? 'manual' : null"
        class="m-0 overflow-hidden rounded-lg border border-line bg-card p-0 text-fg shadow-2xl"
        [class]="open() ? 'animate-pop-in' : 'pointer-events-none animate-pop-out'"
        [style.transform-origin]="origin()"
        style="position: fixed; inset: auto"
      >
        <div class="flex items-center justify-between gap-3 border-b border-line px-3 py-2 text-xs text-fg-subtle">
          <span aria-live="polite">{{ summary() }}</span>
          <span class="flex items-center gap-1">
            <button
              type="button"
              class="cursor-pointer rounded px-1.5 py-0.5 font-medium text-fg-muted transition-colors hover:text-fg focus-visible:ring-2 focus-visible:ring-brand/40 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
              [disabled]="visible().length === 0"
              (mousedown)="$event.preventDefault()"
              (click)="selectVisible()"
            >
              Seleccionar visibles
            </button>
            <button
              type="button"
              class="cursor-pointer rounded px-1.5 py-0.5 font-medium text-fg-muted transition-colors hover:text-fg focus-visible:ring-2 focus-visible:ring-brand/40 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
              [disabled]="values().length === 0"
              (mousedown)="$event.preventDefault()"
              (click)="clear()"
            >
              Limpiar
            </button>
          </span>
        </div>
        <ul #list [id]="listboxId" role="listbox" aria-multiselectable="true" class="max-h-64 overflow-y-auto overscroll-contain p-1" [attr.aria-label]="ariaLabel() || placeholder()">
          @for (option of visible(); track $index; let i = $index) {
            <!-- Patrón combobox: el foco se queda en la búsqueda y el teclado lo gestiona ella (aria-activedescendant); la opción solo responde al ratón. -->
            <!-- eslint-disable-next-line @angular-eslint/template/click-events-have-key-events, @angular-eslint/template/interactive-supports-focus -->
            <li
              role="option"
              class="flex cursor-pointer items-center gap-2.5 rounded-md px-2.5 py-2 text-sm"
              [id]="optionId(i)"
              [class.bg-hover]="i === activeIndex()"
              [class.opacity-50]="option.disabled"
              [class.cursor-not-allowed]="option.disabled"
              [attr.aria-selected]="isSelected(option)"
              [attr.aria-disabled]="option.disabled || null"
              (mousedown)="$event.preventDefault()"
              (mousemove)="hover(i)"
              (click)="toggleOption(option)"
            >
              <span
                class="flex size-[18px] shrink-0 items-center justify-center rounded-[5px] border transition-[background-color,border-color] duration-150"
                [class]="isSelected(option) ? 'border-brand bg-brand text-white' : 'border-neutral-500 bg-card'"
                aria-hidden="true"
              >
                @if (isSelected(option)) {
                  <svg lucideCheck [size]="12" [strokeWidth]="3" />
                }
              </span>
              @if (option.icon) {
                <svg [lucideIcon]="option.icon" [size]="16" class="shrink-0 text-fg-subtle" aria-hidden="true" />
              }
              <span class="min-w-0 flex-1">
                <span class="block truncate">{{ option.label }}</span>
                @if (option.description) {
                  <span class="block truncate text-xs text-fg-subtle">{{ option.description }}</span>
                }
              </span>
            </li>
          } @empty {
            <li class="px-3 py-3 text-center text-sm text-fg-subtle" role="presentation">{{ emptyText() }}</li>
          }
        </ul>
      </div>
    }
  `,
})
export class MultiSelect<T = unknown> implements ControlValueAccessor, FieldControl {
  private readonly document = inject(DOCUMENT);
  private readonly injector = inject(Injector);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  protected readonly field = inject(FormField, { optional: true });

  private readonly trigger = viewChild.required<ElementRef<HTMLElement>>('trigger');
  private readonly panel = viewChild<ElementRef<HTMLElement>>('panel');
  private readonly search = viewChild.required<ElementRef<HTMLInputElement>>('search');
  private readonly list = viewChild<ElementRef<HTMLElement>>('list');

  /** Valores elegidos, en el orden en que se eligieron. Bidireccional (`[(values)]`) y sincronizado con el formulario. */
  readonly values = model<readonly T[]>([]);
  readonly options = input.required<readonly SelectOption<T>[]>();
  /** Texto del campo mientras no hay nada elegido. */
  readonly placeholder = input('Selecciona una o varias opciones');
  /** Texto del campo de búsqueda cuando ya hay fichas. */
  readonly searchPlaceholder = input('Buscar…');
  readonly emptyText = input('Sin resultados');
  /** Cuántas fichas se dibujan antes de resumir el resto como «+N más». */
  readonly maxChips = input(3, { transform: numberAttribute });
  /** Icono al inicio del campo. */
  readonly icon = input<LucideIconData>();
  /** Nombre accesible cuando no se usa dentro de `app-form-field` con etiqueta. */
  readonly ariaLabel = input<string>();
  readonly disabled = input(false, { transform: booleanAttribute });

  /** Capa superior del navegador (Popover API); sin ella el panel queda en línea, posicionado igualmente. */
  protected readonly supportsPopover = typeof HTMLElement !== 'undefined' && typeof HTMLElement.prototype.showPopover === 'function';

  readonly id = `app-multi-select-${nextId}`;
  protected readonly listboxId = `app-multi-select-list-${nextId++}`;

  protected readonly open = signal(false);
  protected readonly exit = new ExitDelay(inject(DestroyRef));
  protected readonly origin = signal('top left');
  protected readonly query = signal('');
  protected readonly activeIndex = signal(-1);
  private readonly formDisabled = signal(false);
  protected readonly isDisabled = computed(() => this.disabled() || this.formDisabled());

  /** Las opciones elegidas, en el orden de elección (los valores que ya no están en la lista se ignoran). */
  private readonly selectedOptions = computed(() =>
    this.values().flatMap((value) => {
      const option = this.options().find((o) => o.value === value);
      return option ? [option] : [];
    }),
  );
  protected readonly chips = computed(() => this.selectedOptions().slice(0, Math.max(0, this.maxChips())));
  protected readonly hiddenCount = computed(() => Math.max(0, this.selectedOptions().length - this.chips().length));
  protected readonly visible = computed(() => {
    const needle = normalizeText(this.query().trim());
    if (needle === '') return this.options();
    return this.options().filter((option) => normalizeText(`${option.label} ${option.description ?? ''}`).includes(needle));
  });
  protected readonly summary = computed(() => {
    const total = this.options().length;
    const count = this.selectedOptions().length;
    return count === 0 ? `${total} ${total === 1 ? 'opción' : 'opciones'}` : `${count} de ${total} elegidas`;
  });
  protected readonly activeOptionId = computed(() => (this.open() && this.activeIndex() >= 0 ? this.optionId(this.activeIndex()) : null));

  private onChange: (value: readonly T[]) => void = () => undefined;
  private onTouched: () => void = () => undefined;

  constructor() {
    // Mientras está abierto, el panel sigue al campo si cambia el tamaño de la ventana, se hace scroll o cambian las fichas
    // (el campo puede crecer al añadir una).
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
    effect(() => {
      this.values();
      if (this.open()) afterNextRender(() => this.place(), { injector: this.injector });
    });
  }

  // ---- ControlValueAccessor ----
  writeValue(value: readonly T[] | null): void {
    this.values.set(value ?? []);
  }
  registerOnChange(fn: (value: readonly T[]) => void): void {
    this.onChange = fn;
  }
  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }
  setDisabledState(disabled: boolean): void {
    this.formDisabled.set(disabled);
    if (disabled) this.close();
  }

  protected optionId(index: number): string {
    return `${this.listboxId}-opt-${index}`;
  }

  protected isSelected(option: SelectOption<T>): boolean {
    return this.values().includes(option.value);
  }

  // ---- Abrir y cerrar ----
  protected onFieldClick(): void {
    if (this.isDisabled()) return;
    this.search().nativeElement.focus();
    this.openPanel();
  }

  protected toggle(event: Event): void {
    event.stopPropagation();
    if (this.open()) this.close();
    else {
      this.search().nativeElement.focus();
      this.openPanel();
    }
  }

  private openPanel(): void {
    if (this.isDisabled() || this.open()) return;
    this.exit.cancel();
    this.activeIndex.set(this.firstEnabled(this.visible(), 0, 1));
    this.open.set(true);
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
      },
      { injector: this.injector },
    );
  }

  private close(): void {
    if (!this.open()) return;
    this.open.set(false);
    this.activeIndex.set(-1);
    this.query.set('');
    this.onTouched();
    this.exit.begin(() => {
      const panel = this.panel()?.nativeElement;
      if (panel && typeof panel.hidePopover === 'function') {
        try {
          panel.hidePopover();
        } catch {
          // Ya estaba oculto.
        }
      }
    });
  }

  protected onDocumentPointerDown(event: PointerEvent): void {
    if (this.open() && !this.host.nativeElement.contains(event.target as Node)) this.close();
  }

  // ---- Elegir ----
  protected toggleOption(option: SelectOption<T>): void {
    if (option.disabled || this.isDisabled()) return;
    this.commit(this.isSelected(option) ? this.values().filter((v) => v !== option.value) : [...this.values(), option.value]);
    // Tras elegir, el filtro vuelve a empezar: la persona sigue con la siguiente búsqueda.
    this.query.set('');
    this.activeIndex.set(this.firstEnabled(this.visible(), Math.max(0, this.indexOfVisible(option)), 1));
  }

  protected remove(value: T, event: Event): void {
    event.stopPropagation();
    if (this.isDisabled()) return;
    this.commit(this.values().filter((v) => v !== value));
    this.search().nativeElement.focus();
  }

  /** Marca todo lo que deja el filtro actual (lo que ya estaba marcado se conserva). */
  protected selectVisible(): void {
    const toAdd = this.visible().filter((o) => !o.disabled && !this.values().includes(o.value)).map((o) => o.value);
    if (toAdd.length > 0) this.commit([...this.values(), ...toAdd]);
  }

  protected clear(): void {
    if (this.values().length > 0) this.commit([]);
  }

  private commit(next: readonly T[]): void {
    this.values.set(next);
    this.onChange(next);
  }

  private indexOfVisible(option: SelectOption<T>): number {
    return this.visible().findIndex((o) => o.value === option.value);
  }

  protected hover(index: number): void {
    if (!this.visible()[index]?.disabled) this.activeIndex.set(index);
  }

  protected onQuery(event: Event): void {
    this.query.set((event.target as HTMLInputElement).value);
    if (!this.open()) this.openPanel();
    this.activeIndex.set(this.firstEnabled(this.visible(), 0, 1));
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
      case 'Enter': {
        event.preventDefault();
        if (!this.open()) {
          this.openPanel();
          return;
        }
        const active = options[this.activeIndex()];
        if (active) this.toggleOption(active);
        return;
      }
      case 'Backspace':
        // Con el campo vacío, Retroceso quita la última ficha (la que se ve; las resumidas siguen con «+N más»).
        if (this.query() === '' && this.values().length > 0 && !this.isDisabled()) {
          this.commit(this.values().slice(0, -1));
        }
        return;
      case 'Escape':
        if (this.open()) {
          // No debe cerrar también el modal o la pantalla que lo contiene.
          event.preventDefault();
          event.stopPropagation();
          this.close();
        }
        return;
      case 'Tab':
        this.close();
        return;
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

  /** Coloca el panel bajo el campo (o encima si abajo no cabe), con su mismo ancho. */
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
    this.origin.set(placeAbove ? 'bottom left' : 'top left');
    panel.style.width = `${rect.width}px`;
  }
}
