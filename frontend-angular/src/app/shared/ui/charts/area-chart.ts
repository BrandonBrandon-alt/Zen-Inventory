import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';
import { buildAreaGeometry, nearestIndex } from './chart-geometry';

export interface SeriesPoint {
  readonly label: string;
  readonly value: number;
}

const WIDTH = 720;
const HEIGHT = 180;
const PAD = { top: 18, right: 6, bottom: 6, left: 6 };

/**
 * Gráfica de área de una serie (p. ej. ingresos por día). La línea se dibuja una vez al entrar; al pasar el cursor
 * o con las flechas aparece el valor de cada punto. Para lectores de pantalla expone el resumen y una tabla con los datos.
 *
 * ```html
 * <app-area-chart [points]="series()" [format]="formatMoneyCompact" ariaLabel="Ingresos por día" />
 * ```
 */
@Component({
  selector: 'app-area-chart',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  template: `
    <!-- Grupo enfocable: el teclado recorre los puntos (flechas, Inicio y Fin) y muestra su valor. -->
    <div
      class="relative rounded-md outline-none focus-visible:ring-2 focus-visible:ring-brand/40"
      role="group"
      tabindex="0"
      [attr.aria-label]="ariaLabel() + '. Usa las flechas para ver cada valor.'"
      (pointermove)="onPointer($event)"
      (pointerleave)="active.set(null)"
      (focus)="onFocus()"
      (blur)="active.set(null)"
      (keydown)="onKeydown($event)"
    >
      <svg class="block h-auto w-full" [attr.viewBox]="'0 0 ' + width + ' ' + height" aria-hidden="true" focusable="false">
        <defs>
          <linearGradient [id]="gradientId" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="var(--brand-500)" stop-opacity="0.28" />
            <stop offset="100%" stop-color="var(--brand-500)" stop-opacity="0" />
          </linearGradient>
        </defs>
        @for (y of gridLines; track y) {
          <line [attr.x1]="pad.left" [attr.x2]="width - pad.right" [attr.y1]="y" [attr.y2]="y" stroke="var(--border-default)" stroke-width="1" vector-effect="non-scaling-stroke" />
        }
        @if (geometry().area) {
          <path [attr.d]="geometry().area" [attr.fill]="'url(#' + gradientId + ')'" class="animate-area-in" />
        }
        <path
          [attr.d]="geometry().line"
          fill="none"
          stroke="var(--brand-500)"
          stroke-width="2.5"
          stroke-linecap="round"
          stroke-linejoin="round"
          pathLength="1"
          style="stroke-dasharray: 1"
          vector-effect="non-scaling-stroke"
          class="animate-draw-line"
        />
        @if (activePoint(); as point) {
          <line [attr.x1]="point.x" [attr.x2]="point.x" [attr.y1]="pad.top" [attr.y2]="height - pad.bottom" stroke="var(--border-default)" stroke-width="1" vector-effect="non-scaling-stroke" />
          <circle [attr.cx]="point.x" [attr.cy]="point.y" r="5" fill="var(--bg-card)" stroke="var(--brand-500)" stroke-width="2.5" vector-effect="non-scaling-stroke" />
        }
      </svg>

      @if (peak() > 0) {
        <span class="pointer-events-none absolute top-0 left-1.5 text-xs text-fg-subtle tabular-nums">Máx. {{ format()(peak()) }}</span>
      }

      @if (activePoint(); as point) {
        <div
          class="pointer-events-none absolute top-0 z-10 -translate-x-1/2 rounded-md border border-line bg-card px-2.5 py-1.5 text-xs shadow-xl"
          [style.left.%]="tooltipLeft()"
          aria-hidden="true"
        >
          <div class="text-fg-subtle">{{ points()[activeIndex()!].label }}</div>
          <div class="font-semibold text-fg tabular-nums">{{ format()(points()[activeIndex()!].value) }}</div>
        </div>
      }
    </div>

    @if (points().length > 0) {
      <div class="mt-2 flex justify-between text-xs text-fg-subtle" aria-hidden="true">
        <span>{{ points()[0].label }}</span>
        @if (points().length > 2) {
          <span>{{ points()[middle()].label }}</span>
        }
        @if (points().length > 1) {
          <span>{{ points()[points().length - 1].label }}</span>
        }
      </div>
    }

    <table class="sr-only">
      <caption>{{ ariaLabel() }}</caption>
      <thead>
        <tr><th scope="col">Fecha</th><th scope="col">Valor</th></tr>
      </thead>
      <tbody>
        @for (point of points(); track $index) {
          <tr><th scope="row">{{ point.label }}</th><td>{{ format()(point.value) }}</td></tr>
        }
      </tbody>
    </table>
  `,
})
export class AreaChart {
  readonly points = input.required<readonly SeriesPoint[]>();
  /** Cómo se escribe un valor (p. ej. en pesos). */
  readonly format = input<(value: number) => string>((value) => String(value));
  /** Resumen de lo que muestra la gráfica, para lectores de pantalla. */
  readonly ariaLabel = input.required<string>();

  protected readonly width = WIDTH;
  protected readonly height = HEIGHT;
  protected readonly pad = PAD;
  protected readonly gradientId = `area-fill-${Math.random().toString(36).slice(2, 8)}`;
  protected readonly gridLines = [0.25, 0.5, 0.75].map((ratio) => PAD.top + (HEIGHT - PAD.top - PAD.bottom) * ratio);

  protected readonly geometry = computed(() =>
    buildAreaGeometry(this.points().map((point) => point.value), WIDTH, HEIGHT, PAD),
  );
  protected readonly peak = computed(() => Math.max(0, ...this.points().map((point) => point.value)));
  protected readonly middle = computed(() => Math.floor((this.points().length - 1) / 2));

  protected readonly active = signal<number | null>(null);
  protected readonly activeIndex = computed(() => {
    const index = this.active();
    return index !== null && index < this.points().length ? index : null;
  });
  protected readonly activePoint = computed(() => {
    const index = this.activeIndex();
    return index === null ? null : (this.geometry().points[index] ?? null);
  });
  /** Posición horizontal del cuadro con el valor, sin que se salga por los lados. */
  protected readonly tooltipLeft = computed(() => {
    const point = this.activePoint();
    return point ? Math.max(12, Math.min(88, (point.x / WIDTH) * 100)) : 50;
  });

  protected onPointer(event: PointerEvent): void {
    // El gráfico mismo (no el host): es el que ocupa exactamente el ancho del viewBox.
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    if (rect.width === 0) return;
    const x = ((event.clientX - rect.left) / rect.width) * WIDTH;
    const index = nearestIndex(this.geometry().points, x);
    this.active.set(index >= 0 ? index : null);
  }

  protected onFocus(): void {
    // Al llegar con el teclado empieza por el valor más reciente.
    if (this.points().length > 0 && this.active() === null) this.active.set(this.points().length - 1);
  }

  protected onKeydown(event: KeyboardEvent): void {
    const count = this.points().length;
    if (count === 0) return;
    const current = this.activeIndex() ?? count - 1;
    const next =
      event.key === 'ArrowRight' ? Math.min(count - 1, current + 1)
      : event.key === 'ArrowLeft' ? Math.max(0, current - 1)
      : event.key === 'Home' ? 0
      : event.key === 'End' ? count - 1
      : null;
    if (next === null) return;
    event.preventDefault();
    this.active.set(next);
  }
}
