import { DOCUMENT } from '@angular/common';
import { Injectable, computed, inject, signal } from '@angular/core';

export type Theme = 'dark' | 'light';

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

/** Tema claro/oscuro. Se refleja en `<html data-theme>`, que activa los tokens de `theme.css`. */
@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly root = inject(DOCUMENT).documentElement;
  private readonly state = signal<Theme>(readStoredTheme());

  readonly theme = this.state.asReadonly();
  readonly isDark = computed(() => this.state() === 'dark');

  constructor() {
    this.apply(this.state());
  }

  set(theme: Theme): void {
    this.state.set(theme);
    this.apply(theme);
    writeStoredTheme(theme);
  }

  toggle(): void {
    this.set(this.state() === 'dark' ? 'light' : 'dark');
  }

  private apply(theme: Theme): void {
    this.root.dataset['theme'] = theme;
  }
}
