import { DOCUMENT } from '@angular/common';
import { DestroyRef, Directive, ElementRef, effect, inject, input, numberAttribute, signal } from '@angular/core';

export type TooltipPlacement = 'top' | 'bottom' | 'left' | 'right';

export interface Box {
  readonly top: number;
  readonly left: number;
  readonly width: number;
  readonly height: number;
}

const GAP = 8;
const MARGIN = 8;

/**
 * Posición de la descripción respecto a su elemento: centrada, en el lado pedido y, si ahí no cabe, en el contrario;
 * sin salirse de la ventana. Arriba y abajo se centra en horizontal; a los lados, en vertical (es lo que usa el menú
 * lateral, donde la descripción sale a la derecha del enlace). Función pura para poder probarla sin navegador.
 */
export function computeTooltipPosition(
  host: Box,
  tooltip: Pick<Box, 'width' | 'height'>,
  viewport: { width: number; height: number },
  preferred: TooltipPlacement,
): { top: number; left: number; placement: TooltipPlacement } {
  if (preferred === 'left' || preferred === 'right') {
    const fitsRight = host.left + host.width + GAP + tooltip.width <= viewport.width - MARGIN;
    const fitsLeft = host.left - GAP - tooltip.width >= MARGIN;
    const side: TooltipPlacement = preferred === 'right' ? (fitsRight || !fitsLeft ? 'right' : 'left') : fitsLeft || !fitsRight ? 'left' : 'right';
    const x = side === 'right' ? host.left + host.width + GAP : host.left - GAP - tooltip.width;
    const middle = host.top + host.height / 2 - tooltip.height / 2;
    const y = Math.max(MARGIN, Math.min(middle, viewport.height - tooltip.height - MARGIN));
    return { top: y, left: x, placement: side };
  }
  const fitsAbove = host.top - GAP - tooltip.height >= MARGIN;
  const fitsBelow = host.top + host.height + GAP + tooltip.height <= viewport.height - MARGIN;
  const placement: TooltipPlacement = preferred === 'top' ? (fitsAbove || !fitsBelow ? 'top' : 'bottom') : fitsBelow || !fitsAbove ? 'bottom' : 'top';
  const top = placement === 'top' ? host.top - GAP - tooltip.height : host.top + host.height + GAP;
  const centered = host.left + host.width / 2 - tooltip.width / 2;
  const left = Math.max(MARGIN, Math.min(centered, viewport.width - tooltip.width - MARGIN));
  return { top, left, placement };
}

let nextId = 0;

/**
 * Descripción emergente de un elemento (botones de solo icono, datos abreviados…). Aparece al pasar el cursor
 * (tras una breve espera) o al enfocar con el teclado, y se oculta al salir, al perder el foco o con Escape.
 *
 * ```html
 * <button appButton aria-label="Ajustar stock" appTooltip="Ajustar stock">…</button>
 * ```
 *
 * - Se dibuja en la capa superior del navegador (`popover`): no la recorta una tabla, un modal ni un contenedor con scroll.
 * - Mientras se muestra, el elemento queda descrito por ella (`aria-describedby`). Un botón de solo icono sigue
 *   necesitando su propio `aria-label`: el tooltip complementa, no sustituye.
 * - En pantallas táctiles no hay "pasar el cursor": allí solo aparece al enfocar.
 */
@Directive({
  selector: '[appTooltip]',
  host: {
    '(mouseenter)': 'scheduleShow()',
    '(mouseleave)': 'hide()',
    '(focusin)': 'show()',
    '(focusout)': 'hide()',
    '(keydown)': 'onKeydown($event)',
    '[attr.aria-describedby]': 'visible() ? tooltipId : null',
  },
})
export class Tooltip {
  private readonly document = inject(DOCUMENT);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  /** Texto de la descripción; vacío = sin descripción. */
  readonly text = input<string>('', { alias: 'appTooltip' });
  readonly tooltipPlacement = input<TooltipPlacement>('top');
  /** Espera (ms) antes de mostrarla al pasar el cursor; al enfocar es inmediata. */
  readonly tooltipDelay = input(350, { transform: numberAttribute });

  protected readonly tooltipId = `app-tooltip-${nextId++}`;
  protected readonly visible = signal(false);

  private element: HTMLElement | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    // Si el texto cambia mientras se muestra (o queda vacío), se actualiza o se oculta.
    effect(() => {
      const text = this.text();
      if (this.element) {
        if (text) this.element.textContent = text;
        else this.hide();
      }
    });
    inject(DestroyRef).onDestroy(() => this.hide());
  }

  protected scheduleShow(): void {
    this.clearTimer();
    this.timer = setTimeout(() => this.show(), this.tooltipDelay());
  }

  protected show(): void {
    this.clearTimer();
    const text = this.text();
    if (!text || this.element) return;

    const element = this.document.createElement('div');
    element.id = this.tooltipId;
    element.setAttribute('role', 'tooltip');
    element.textContent = text;
    element.className =
      'pointer-events-none max-w-64 rounded-md whitespace-pre-line border border-line bg-card px-2.5 py-1.5 text-xs font-medium text-fg shadow-xl animate-error-in';
    element.style.cssText = 'position: fixed; inset: auto; margin: 0; z-index: 1000;';
    if (typeof element.showPopover === 'function') element.setAttribute('popover', 'manual');
    this.document.body.appendChild(element);
    if (typeof element.showPopover === 'function') {
      try {
        element.showPopover();
      } catch {
        // Ya estaba mostrado.
      }
    }
    this.element = element;
    this.visible.set(true);
    this.place();
    this.document.defaultView?.addEventListener('scroll', this.onViewportChange, true);
    this.document.defaultView?.addEventListener('resize', this.onViewportChange);
  }

  protected hide(): void {
    this.clearTimer();
    if (!this.element) return;
    this.document.defaultView?.removeEventListener('scroll', this.onViewportChange, true);
    this.document.defaultView?.removeEventListener('resize', this.onViewportChange);
    this.element.remove();
    this.element = null;
    this.visible.set(false);
  }

  protected onKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape' && this.element) {
      // Cierra solo la descripción (no el modal o el menú que contenga al elemento).
      event.stopPropagation();
      this.hide();
    }
  }

  private readonly onViewportChange = (): void => this.place();

  private place(): void {
    if (!this.element) return;
    const view = this.document.defaultView;
    const rect = this.host.nativeElement.getBoundingClientRect();
    const { top, left } = computeTooltipPosition(
      { top: rect.top, left: rect.left, width: rect.width, height: rect.height },
      { width: this.element.offsetWidth, height: this.element.offsetHeight },
      { width: view?.innerWidth ?? 0, height: view?.innerHeight ?? 0 },
      this.tooltipPlacement(),
    );
    this.element.style.top = `${top}px`;
    this.element.style.left = `${left}px`;
  }

  private clearTimer(): void {
    if (this.timer !== null) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }
}
