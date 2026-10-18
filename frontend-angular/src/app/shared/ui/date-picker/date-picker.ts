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
import { DOCUMENT } from '@angular/common';
import { type ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { LucideCalendar, LucideChevronLeft, LucideChevronRight } from '@lucide/angular';
import { FieldControl, FormField } from '../form-field/form-field';
import {
  WEEKDAYS,
  addDays,
  addMonths,
  clampDay,
  dayKey,
  dayLabel,
  formatTrigger,
  isDayDisabled,
  isSameDay,
  monthGrid,
  monthLabel,
  startOfDay,
  startOfMonth,
  startOfWeek,
  toTimeValue,
  withTime,
} from './date-picker-utils';

let nextId = 0;

/**
 * Selector de fecha (y hora, opcional) con calendario desplegable. El valor es un `Date` en hora local, o `null`.
 *
 * ```html
 * <app-form-field label="Llegada estimada">
 *   <app-date-picker formControlName="llegada" showTime [min]="ahora" placeholder="Sin fecha" />
 * </app-form-field>
 * ```
 *
 * - Sin `showTime` elige un día y se cierra; con `showTime` el panel sigue abierto para ajustar la hora y se cierra con "Listo".
 * - `min` y `max` deshabilitan los días fuera de rango (por día); con hora, una hora anterior al mínimo se sube al mínimo.
 * - Teclado: flechas mueven de día en día y de semana en semana, Inicio/Fin van al lunes/domingo, RePág/AvPág cambian de mes
 *   (con Mayús, de año), Enter elige, Escape cierra (sin cerrar el modal que lo contiene).
 * - El panel usa la capa superior del navegador (`popover`): no lo recorta un modal ni un contenedor con scroll.
 */
@Component({
  selector: 'app-date-picker',
  imports: [LucideCalendar, LucideChevronLeft, LucideChevronRight],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block', '(document:pointerdown)': 'onDocumentPointerDown($event)' },
  providers: [
    { provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => DatePicker), multi: true },
    { provide: FieldControl, useExisting: forwardRef(() => DatePicker) },
  ],
  template: `
    <button
      #trigger
      type="button"
      class="flex w-full cursor-pointer items-center gap-2 rounded-md border border-line bg-card px-3.5 py-[11px] text-left text-sm text-fg outline-none transition-[border-color,box-shadow] duration-200 hover:border-fg-subtle/40 focus-visible:border-brand focus-visible:ring-3 focus-visible:ring-brand/20 disabled:cursor-not-allowed disabled:opacity-60 aria-[invalid=true]:border-danger/50 aria-[invalid=true]:focus-visible:border-danger aria-[invalid=true]:focus-visible:ring-danger/15"
      [id]="id"
      [disabled]="isDisabled()"
      aria-haspopup="dialog"
      [attr.aria-expanded]="open()"
      [attr.aria-controls]="open() ? panelId : null"
      [attr.aria-label]="ariaLabel() || null"
      [attr.aria-invalid]="field?.error() ? true : null"
      [attr.aria-describedby]="field?.error() ? field?.errorId : null"
      (click)="toggle()"
      (keydown)="onTriggerKeydown($event)"
    >
      <svg lucideCalendar [size]="16" class="shrink-0 text-fg-subtle" aria-hidden="true" />
      <span class="min-w-0 flex-1 truncate" [class.text-fg-subtle]="!value()">{{ label() }}</span>
    </button>

    @if (open()) {
      <div
        #panel
        role="dialog"
        aria-label="Calendario"
        [id]="panelId"
        [attr.popover]="supportsPopover ? 'manual' : null"
        class="m-0 w-[17.5rem] max-w-[calc(100vw-1rem)] rounded-lg border border-line bg-card p-2.5 text-fg shadow-2xl animate-alert-in"
        style="position: fixed; inset: auto"
        (keydown)="onPanelKeydown($event)"
      >
        <div class="mb-1 flex items-center justify-between gap-2">
          <button type="button" class="flex size-8 cursor-pointer items-center justify-center rounded-md text-fg-muted transition-colors hover:bg-hover hover:text-fg focus-visible:ring-2 focus-visible:ring-brand/40 focus-visible:outline-none" aria-label="Mes anterior" (click)="moveMonth(-1)">
            <svg lucideChevronLeft [size]="16" aria-hidden="true" />
          </button>
          <h2 class="font-title text-lg font-bold first-letter:uppercase" aria-live="polite">{{ title() }}</h2>
          <button type="button" class="flex size-8 cursor-pointer items-center justify-center rounded-md text-fg-muted transition-colors hover:bg-hover hover:text-fg focus-visible:ring-2 focus-visible:ring-brand/40 focus-visible:outline-none" aria-label="Mes siguiente" (click)="moveMonth(1)">
            <svg lucideChevronRight [size]="16" aria-hidden="true" />
          </button>
        </div>

        <div role="grid" [attr.aria-label]="title()">
          <div role="row" class="mb-1 grid grid-cols-7 text-center text-[11px] font-medium text-fg-subtle">
            @for (weekday of weekdays; track weekday.long) {
              <span role="columnheader" [attr.aria-label]="weekday.long" class="py-1">{{ weekday.short }}</span>
            }
          </div>
          @for (week of visibleWeeks(); track week[0].getTime()) {
            <div role="row" class="grid grid-cols-7">
              @for (day of week; track day.getTime()) {
                <div role="gridcell" class="flex justify-center" [attr.aria-selected]="isSelected(day)">
                  <button
                    type="button"
                    class="flex size-8 cursor-pointer items-center justify-center rounded-md text-[13px] tabular-nums outline-none transition-colors focus-visible:ring-2 focus-visible:ring-brand/60 disabled:cursor-not-allowed disabled:opacity-35 disabled:hover:bg-transparent"
                    [class]="dayClass(day)"
                    [attr.data-day]="key(day)"
                    [attr.tabindex]="isFocused(day) ? 0 : -1"
                    [attr.aria-label]="dayName(day)"
                    [attr.aria-current]="isToday(day) ? 'date' : null"
                    [disabled]="isOutOfRange(day)"
                    (click)="pick(day)"
                  >
                    {{ day.getDate() }}
                  </button>
                </div>
              }
            </div>
          }
        </div>

        <div class="mt-2 flex flex-col gap-1.5 border-t border-line pt-2">
          @if (showTime()) {
            <div class="flex items-center justify-between gap-2">
              <span class="flex items-center gap-1.5">
                <select [class]="timeSelectClass" aria-label="Hora" [disabled]="!value()" (change)="onTimePart('hours', $event)">
                  @for (hour of hours; track hour) {
                    <option [value]="hour" [selected]="hour === hourValue()">{{ hour }}</option>
                  }
                </select>
                <span class="text-fg-subtle" aria-hidden="true">:</span>
                <select [class]="timeSelectClass" aria-label="Minutos" [disabled]="!value()" (change)="onTimePart('minutes', $event)">
                  @for (minute of minuteOptions(); track minute) {
                    <option [value]="minute" [selected]="minute === minuteValue()">{{ minute }}</option>
                  }
                </select>
                @if (!value()) {
                  <span class="text-xs text-fg-subtle">Elige un día</span>
                }
              </span>
              <button type="button" class="cursor-pointer rounded-md bg-brand px-3 py-1.5 text-[13px] font-semibold text-white transition-colors hover:bg-brand/90 focus-visible:ring-2 focus-visible:ring-brand/40 focus-visible:outline-none" (click)="close(true)">Listo</button>
            </div>
          }
          <div class="flex items-center justify-between gap-2">
            <button type="button" class="cursor-pointer rounded-md px-2.5 py-1 text-[13px] font-semibold text-brand transition-colors hover:bg-brand/10 focus-visible:ring-2 focus-visible:ring-brand/40 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-40" [disabled]="isOutOfRange(today)" (click)="pick(today)">Hoy</button>
            @if (clearable() && value()) {
              <button type="button" class="cursor-pointer rounded-md px-2.5 py-1 text-[13px] font-medium text-fg-muted transition-colors hover:bg-hover hover:text-fg focus-visible:ring-2 focus-visible:ring-brand/40 focus-visible:outline-none" (click)="clear()">Quitar fecha</button>
            }
          </div>
        </div>
      </div>
    }
  `,
})
export class DatePicker implements ControlValueAccessor, FieldControl {
  private readonly document = inject(DOCUMENT);
  private readonly injector = inject(Injector);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  protected readonly field = inject(FormField, { optional: true });

  private readonly trigger = viewChild.required<ElementRef<HTMLButtonElement>>('trigger');
  private readonly panel = viewChild<ElementRef<HTMLElement>>('panel');

  /** Fecha elegida (con su hora si `showTime`); `null` si no hay. Bidireccional (`[(value)]`) y sincronizada con el formulario. */
  readonly value = model<Date | null>(null);
  readonly placeholder = input('Elige una fecha');
  /** Agrega la hora (HH:mm) al valor. */
  readonly showTime = input(false, { transform: booleanAttribute });
  /** Primera fecha elegible (por día; con hora, también la hora mínima de ese día). */
  readonly min = input<Date | null>(null);
  readonly max = input<Date | null>(null);
  /** Permite quitar la fecha elegida. */
  readonly clearable = input(true, { transform: booleanAttribute });
  readonly ariaLabel = input<string>();
  readonly disabled = input(false, { transform: booleanAttribute });

  protected readonly supportsPopover = typeof HTMLElement !== 'undefined' && typeof HTMLElement.prototype.showPopover === 'function';

  readonly id = `app-date-picker-${nextId}`;
  protected readonly panelId = `app-date-picker-panel-${nextId++}`;

  protected readonly weekdays = WEEKDAYS;
  protected readonly today = startOfDay(new Date());

  protected readonly open = signal(false);
  /** Mes que se está mirando. */
  private readonly viewMonth = signal(startOfMonth(new Date()));
  /** Día con el cursor del teclado (el único que entra en el orden de Tab). */
  private readonly cursor = signal(startOfDay(new Date()));
  private readonly formDisabled = signal(false);
  protected readonly isDisabled = computed(() => this.disabled() || this.formDisabled());

  /** Cinco semanas; la sexta solo se dibuja si el mes la necesita (así el calendario es más bajo y cabe mejor). */
  protected readonly visibleWeeks = computed(() => {
    const month = this.viewMonth().getMonth();
    return monthGrid(this.viewMonth()).filter((week, index) => index < 5 || week.some((day) => day.getMonth() === month));
  });
  protected readonly title = computed(() => monthLabel(this.viewMonth()));
  protected readonly label = computed(() => {
    const value = this.value();
    return value ? formatTrigger(value, this.showTime()) : this.placeholder();
  });
  protected readonly hours = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'));
  protected readonly timeSelectClass =
    'rounded-md border border-line bg-card px-2 py-1 text-sm tabular-nums text-fg outline-none transition-[border-color,box-shadow] duration-200 focus:border-brand focus:ring-3 focus:ring-brand/20 disabled:cursor-not-allowed disabled:opacity-50';
  protected readonly hourValue = computed(() => String(this.value()?.getHours() ?? 9).padStart(2, '0'));
  protected readonly minuteValue = computed(() => String(this.value()?.getMinutes() ?? 0).padStart(2, '0'));
  /** Minutos de cinco en cinco; si la hora elegida trae otro minuto (p. ej. un mínimo de "ahora"), también se ofrece. */
  protected readonly minuteOptions = computed(() => {
    const options = Array.from({ length: 12 }, (_, i) => String(i * 5).padStart(2, '0'));
    const current = this.minuteValue();
    return options.includes(current) ? options : [...options, current].sort();
  });

  private onChange: (value: Date | null) => void = () => undefined;
  private onTouched: () => void = () => undefined;

  constructor() {
    // Mientras está abierto, el panel sigue al campo si la página se desplaza o cambia de tamaño.
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
  writeValue(value: Date | null): void {
    this.value.set(value instanceof Date && !Number.isNaN(value.getTime()) ? value : null);
  }
  registerOnChange(fn: (value: Date | null) => void): void {
    this.onChange = fn;
  }
  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }
  setDisabledState(disabled: boolean): void {
    this.formDisabled.set(disabled);
    if (disabled) this.close(false);
  }

  // ---- Apariencia de cada día ----
  protected key = dayKey;
  protected dayName = dayLabel;
  protected isSelected(day: Date): boolean {
    return isSameDay(day, this.value());
  }
  protected isToday(day: Date): boolean {
    return isSameDay(day, this.today);
  }
  protected isFocused(day: Date): boolean {
    return isSameDay(day, this.cursor());
  }
  protected isOutOfRange(day: Date): boolean {
    return isDayDisabled(day, this.min(), this.max());
  }
  protected dayClass(day: Date): string {
    if (this.isSelected(day)) return 'bg-brand font-semibold text-white';
    const outside = day.getMonth() !== this.viewMonth().getMonth();
    const base = outside ? 'text-fg-subtle/60 hover:bg-hover' : 'text-fg hover:bg-hover';
    return this.isToday(day) ? `${base} ring-1 ring-brand/60 font-semibold` : base;
  }

  // ---- Abrir y cerrar ----
  protected toggle(): void {
    if (this.open()) this.close(true);
    else this.openPanel();
  }

  private openPanel(): void {
    if (this.isDisabled() || this.open()) return;
    const start = this.value() ?? clampDay(new Date(), this.min(), this.max());
    this.cursor.set(startOfDay(start));
    this.viewMonth.set(startOfMonth(start));
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
        this.focusCursor();
      },
      { injector: this.injector },
    );
  }

  protected close(returnFocus: boolean): void {
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
    this.onTouched();
    if (returnFocus) this.trigger().nativeElement.focus();
  }

  protected onDocumentPointerDown(event: PointerEvent): void {
    if (this.open() && !this.host.nativeElement.contains(event.target as Node)) this.close(false);
  }

  // ---- Elegir ----
  protected pick(day: Date): void {
    if (this.isOutOfRange(day)) return;
    const current = this.value();
    // Con hora se conserva la que ya había (o las 09:00 la primera vez); sin hora, el día a medianoche.
    const next = this.showTime() ? this.clampToMin(withTime(day, current ? toTimeValue(current) : '09:00')) : startOfDay(day);
    this.set(next);
    this.cursor.set(startOfDay(day));
    this.viewMonth.set(startOfMonth(day));
    if (!this.showTime()) this.close(true);
  }

  protected clear(): void {
    this.set(null);
    this.close(true);
  }

  protected onTimePart(part: 'hours' | 'minutes', event: Event): void {
    const current = this.value();
    if (!current) return;
    const chosen = (event.target as HTMLSelectElement).value;
    const time = part === 'hours' ? `${chosen}:${this.minuteValue()}` : `${this.hourValue()}:${chosen}`;
    this.set(this.clampToMin(withTime(current, time)));
  }

  /** Con un mínimo con hora (por ejemplo "ahora"), una hora anterior a él en ese mismo día se sube al mínimo. */
  private clampToMin(date: Date): Date {
    const min = this.min();
    return min !== null && isSameDay(date, min) && date < min ? new Date(min.getFullYear(), min.getMonth(), min.getDate(), min.getHours(), min.getMinutes()) : date;
  }

  private set(value: Date | null): void {
    this.value.set(value);
    this.onChange(value);
  }

  // ---- Teclado ----
  protected onTriggerKeydown(event: KeyboardEvent): void {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      this.openPanel();
    }
  }

  protected onPanelKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      // No debe cerrar también el modal o la pantalla que lo contiene.
      event.preventDefault();
      event.stopPropagation();
      this.close(true);
      return;
    }
    // Las flechas solo mueven el calendario cuando el foco está en un día (no al escribir la hora).
    if (!(event.target instanceof HTMLElement) || !event.target.hasAttribute('data-day')) return;
    const cursor = this.cursor();
    const moves: Record<string, Date> = {
      ArrowLeft: addDays(cursor, -1),
      ArrowRight: addDays(cursor, 1),
      ArrowUp: addDays(cursor, -7),
      ArrowDown: addDays(cursor, 7),
      Home: startOfWeek(cursor),
      End: addDays(startOfWeek(cursor), 6),
      PageUp: addMonths(cursor, event.shiftKey ? -12 : -1),
      PageDown: addMonths(cursor, event.shiftKey ? 12 : 1),
    };
    const target = moves[event.key];
    if (!target) return;
    event.preventDefault();
    this.moveCursor(target);
  }

  protected moveMonth(delta: number): void {
    this.moveCursor(addMonths(this.cursor(), delta));
  }

  private moveCursor(target: Date): void {
    this.cursor.set(startOfDay(target));
    this.viewMonth.set(startOfMonth(target));
    afterNextRender(() => this.focusCursor(), { injector: this.injector });
  }

  /** Lleva el foco al día del cursor, salvo que el usuario esté en los botones de mes (ahí conserva el suyo). */
  private focusCursor(): void {
    const panel = this.panel()?.nativeElement;
    const button = panel?.querySelector<HTMLElement>(`[data-day="${dayKey(this.cursor())}"]`);
    button?.focus();
  }

  /** Coloca el panel bajo el campo (o encima si abajo no cabe), dentro de la ventana. */
  private place(): void {
    const panel = this.panel()?.nativeElement;
    if (!panel) return;
    const rect = this.trigger().nativeElement.getBoundingClientRect();
    const view = this.document.defaultView;
    const viewportHeight = view?.innerHeight ?? 0;
    const viewportWidth = view?.innerWidth ?? 0;
    const height = panel.offsetHeight;
    const width = panel.offsetWidth;
    const below = viewportHeight - rect.bottom;
    const placeAbove = viewportHeight > 0 && below < height + 8 && rect.top > below;
    const left = viewportWidth > 0 ? Math.max(8, Math.min(rect.left, viewportWidth - width - 8)) : rect.left;
    let top = placeAbove ? rect.top - height - 4 : rect.bottom + 4;
    // Si no cabe ni arriba ni abajo (campo en el medio de una ventana baja), se desplaza para que el calendario se vea entero.
    if (viewportHeight > 0 && height > 0) top = Math.min(Math.max(8, top), Math.max(8, viewportHeight - height - 8));
    panel.style.left = `${left}px`;
    panel.style.top = `${top}px`;
  }
}
