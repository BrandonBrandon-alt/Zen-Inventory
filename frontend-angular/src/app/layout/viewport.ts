import { DestroyRef, Injectable, inject, signal } from '@angular/core';

/** A partir de este ancho el menú es una barra lateral fija; por debajo, un cajón que se abre y se cierra. */
export const DESKTOP_QUERY = '(min-width: 768px)';

/** Si la pantalla es de escritorio. Sin `matchMedia` (tests, SSR) se asume escritorio. */
@Injectable({ providedIn: 'root' })
export class Viewport {
  private readonly desktop = signal(true);

  readonly isDesktop = this.desktop.asReadonly();

  constructor() {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    const query = window.matchMedia(DESKTOP_QUERY);
    this.desktop.set(query.matches);
    const onChange = (event: MediaQueryListEvent): void => this.desktop.set(event.matches);
    query.addEventListener('change', onChange);
    inject(DestroyRef).onDestroy(() => query.removeEventListener('change', onChange));
  }
}
