import { Injectable, computed, signal } from '@angular/core';
import { type AuthSession, isAuthSession } from './auth-session';

export const SESSION_STORAGE_KEY = 'zen_inventory_session';

function readStoredSession(): AuthSession | null {
  try {
    const raw = localStorage.getItem(SESSION_STORAGE_KEY);
    if (raw === null) return null;
    const parsed: unknown = JSON.parse(raw);
    return isAuthSession(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function writeStoredSession(session: AuthSession | null): void {
  try {
    if (session === null) localStorage.removeItem(SESSION_STORAGE_KEY);
    else localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
  } catch {
    // Almacenamiento no disponible: la sesión sigue viva solo en memoria.
  }
}

@Injectable({ providedIn: 'root' })
export class AuthStore {
  private readonly state = signal<AuthSession | null>(readStoredSession());

  readonly session = this.state.asReadonly();
  readonly isAuthenticated = computed(() => this.state() !== null);
  readonly token = computed(() => this.state()?.token ?? null);

  start(session: AuthSession): void {
    this.state.set(session);
    writeStoredSession(session);
  }

  clear(): void {
    this.state.set(null);
    writeStoredSession(null);
  }
}
