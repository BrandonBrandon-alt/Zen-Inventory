import { DOCUMENT } from '@angular/common';
import { ApplicationRef, Injectable, computed, inject, signal } from '@angular/core';

export type Theme = 'dark' | 'light';

/** Punto de la pantalla (px) desde el que se revela el tema nuevo: normalmente el centro del botón pulsado. */
export interface ThemeOrigin {
  readonly x: number;
  readonly y: number;
}

export const THEME_STORAGE_KEY = 'zen_inventory_theme';

function isTheme(value: unknown): value is Theme {
  return value === 'dark' || value === 'light';
}

function readStoredTheme(): Theme {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    return isTheme(stored) ? stored : 'dark';
  } catch {
    return 'dark';
  }
}

function writeStoredTheme(theme: Theme): void {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // Almacenamiento no disponible: el tema sigue vigente solo en memoria.
  }
}

/**
 * Tema claro/oscuro. Se refleja en `<html data-theme>`, que activa los tokens de `theme.css`.
 *
 * Al cambiar con un `origin`, el tema nuevo se revela como un círculo que crece desde ese punto (View Transitions API).
 * Sin soporte del navegador, sin origen o si el usuario pidió menos movimiento, el cambio es instantáneo.
 */
@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly doc = inject(DOCUMENT);
  private readonly root = this.doc.documentElement;
  private readonly appRef = inject(ApplicationRef);
  private readonly state = signal<Theme>(readStoredTheme());
  /** Último tema pedido. Con la animación el cambio llega un instante después: cada `toggle()` parte de este valor. */
  private requested: Theme = this.state();

  readonly theme = this.state.asReadonly();
  readonly isDark = computed(() => this.state() === 'dark');

  constructor() {
    this.apply(this.state());
  }

  set(theme: Theme, origin?: ThemeOrigin): void {
    this.requested = theme;
    writeStoredTheme(theme);

    const commit = (): void => {
      this.state.set(theme);
      this.apply(theme);
    };
    if (origin && this.canAnimate()) {
      try {
        this.animate(commit, origin);
        return;
      } catch {
        // El navegador no pudo iniciar la transición: se aplica el cambio sin animación.
        this.clearTransitionMarks();
      }
    }
    commit();
  }

  toggle(origin?: ThemeOrigin): void {
    this.set(this.requested === 'dark' ? 'light' : 'dark', origin);
  }

  private apply(theme: Theme): void {
    this.root.dataset['theme'] = theme;
  }

  private canAnimate(): boolean {
    const win = this.doc.defaultView;
    const reduceMotion = typeof win?.matchMedia === 'function' && win.matchMedia('(prefers-reduced-motion: reduce)').matches;
    return typeof this.doc.startViewTransition === 'function' && !reduceMotion;
  }

  private animate(commit: () => void, origin: ThemeOrigin): void {
    this.root.style.setProperty('--theme-x', `${origin.x}px`);
    this.root.style.setProperty('--theme-y', `${origin.y}px`);
    this.root.dataset['themeSwitching'] = '';

    const transition = this.doc.startViewTransition(() => {
      commit();
      // Que el icono y el texto del botón ya muestren el estado nuevo cuando el navegador captura la pantalla nueva.
      this.appRef.tick();
    });
    void transition.finished.catch(() => undefined).finally(() => this.clearTransitionMarks());
  }

  private clearTransitionMarks(): void {
    this.root.style.removeProperty('--theme-x');
    this.root.style.removeProperty('--theme-y');
    delete this.root.dataset['themeSwitching'];
  }
}
