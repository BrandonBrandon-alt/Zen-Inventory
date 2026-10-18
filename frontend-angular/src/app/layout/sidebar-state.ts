import { Injectable, signal } from '@angular/core';

export const SIDEBAR_STORAGE_KEY = 'zen_inventory_sidebar_collapsed';
export const SIDEBAR_WIDTH_STORAGE_KEY = 'zen_inventory_sidebar_width';
export const SIDEBAR_AUTOHIDE_STORAGE_KEY = 'zen_inventory_sidebar_autohide';

/** Ancho (px) del sidebar expandido: estándar y límites al arrastrar. */
export const SIDEBAR_DEFAULT_WIDTH = 240;
export const SIDEBAR_MIN_WIDTH = 200;
export const SIDEBAR_MAX_WIDTH = 360;

/** Ancho (px) del sidebar colapsado (solo iconos). */
export const SIDEBAR_COLLAPSED_WIDTH = 80;

function clampWidth(value: number): number {
  return Math.min(SIDEBAR_MAX_WIDTH, Math.max(SIDEBAR_MIN_WIDTH, Math.round(value)));
}

function readCollapsed(): boolean {
  try {
    return localStorage.getItem(SIDEBAR_STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
}

function readAutoHide(): boolean {
  try {
    return localStorage.getItem(SIDEBAR_AUTOHIDE_STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
}

function readWidth(): number {
  try {
    const stored = localStorage.getItem(SIDEBAR_WIDTH_STORAGE_KEY);
    const parsed = stored === null ? Number.NaN : Number(stored);
    return stored === null || stored.trim() === '' || !Number.isFinite(parsed)
      ? SIDEBAR_DEFAULT_WIDTH
      : clampWidth(parsed);
  } catch {
    return SIDEBAR_DEFAULT_WIDTH;
  }
}

function write(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Almacenamiento no disponible: el estado sigue vigente solo en memoria.
  }
}

/** Estado del sidebar (colapsado y ancho), persistido entre sesiones. */
@Injectable({ providedIn: 'root' })
export class SidebarState {
  private readonly collapsedState = signal(readCollapsed());
  private readonly widthState = signal(readWidth());
  private readonly autoHideState = signal(readAutoHide());

  readonly collapsed = this.collapsedState.asReadonly();
  /**
   * Menú oculto por defecto: aparece sobre el contenido al acercar el puntero al borde izquierdo y se esconde al
   * alejarse. Solo escritorio; en móvil el menú ya es un cajón.
   */
  readonly autoHide = this.autoHideState.asReadonly();
  /** Ancho del sidebar expandido, en px. Colapsado se ignora (ver `SIDEBAR_COLLAPSED_WIDTH`). */
  readonly width = this.widthState.asReadonly();

  toggle(): void {
    const next = !this.collapsedState();
    this.collapsedState.set(next);
    write(SIDEBAR_STORAGE_KEY, String(next));
  }

  toggleAutoHide(): void {
    const next = !this.autoHideState();
    this.autoHideState.set(next);
    write(SIDEBAR_AUTOHIDE_STORAGE_KEY, String(next));
  }

  setWidth(px: number): void {
    if (!Number.isFinite(px)) return;
    const next = clampWidth(px);
    this.widthState.set(next);
    write(SIDEBAR_WIDTH_STORAGE_KEY, String(next));
  }

  resetWidth(): void {
    this.setWidth(SIDEBAR_DEFAULT_WIDTH);
  }
}
