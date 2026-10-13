import { Injectable, signal } from '@angular/core';

export const SIDEBAR_STORAGE_KEY = 'zen_inventory_sidebar_collapsed';

function readCollapsed(): boolean {
  try {
    return localStorage.getItem(SIDEBAR_STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
}

function writeCollapsed(collapsed: boolean): void {
  try {
    localStorage.setItem(SIDEBAR_STORAGE_KEY, String(collapsed));
  } catch {
    // Almacenamiento no disponible: el estado sigue vigente solo en memoria.
  }
}

/** Estado colapsado/expandido del sidebar, persistido entre sesiones. */
@Injectable({ providedIn: 'root' })
export class SidebarState {
  private readonly state = signal(readCollapsed());

  readonly collapsed = this.state.asReadonly();

  toggle(): void {
    const next = !this.state();
    this.state.set(next);
    writeCollapsed(next);
  }
}
